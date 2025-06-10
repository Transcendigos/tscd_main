// tscd_main/backend/chat.js
import jwt from 'jsonwebtoken';
import { getDB } from './db.js';
import { getRedisPublisher, createNewRedisSubscriber } from './redis.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

const activeConnections = new Map(); 
const userSubscribers = new Map();   

export default async function chatRoutes(server, options) {
  const db = getDB();
  const redisPublisher = getRedisPublisher();

  server.route({
    method: 'GET',
    url: '/ws/chat',
    handler: (req, reply) => {
        reply.code(400).send({error: 'This is a WebSocket endpoint.'});
    },
    wsHandler: (connection, req) => {
        server.log.info({ remoteAddress: req.socket.remoteAddress }, '>>> chat.js: wsHandler invoked. Attempting immediate auth from cookie.');
        
        const ws = connection;
        let authenticatedUserId = null;
        let userJWTPayload = null;
        let dedicatedSubscriber = null;

        const token = req.cookies.auth_token;
        if (!token) {
            server.log.warn({ ip: req.ip }, "WebSocket connection attempt without auth_token cookie.");
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication required. Missing token.' }));
            ws.close(1008, "Policy Violation: Missing authentication token");
            return;
        }

        try {
            const payload = jwt.verify(token, JWT_SECRET);
            if (!payload.userId || !payload.username || !payload.email) {
                server.log.warn({ ip: req.ip, payload }, "WebSocket connection attempt with invalid token payload.");
                ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed: Invalid token data.' }));
                ws.close(1008, "Policy Violation: Invalid token data");
                return;
            }

            authenticatedUserId = payload.userId;
            userJWTPayload = payload;

            if (activeConnections.has(authenticatedUserId)) {
                const oldSocket = activeConnections.get(authenticatedUserId);
                if (oldSocket && oldSocket !== ws && (oldSocket.readyState === WebSocket.OPEN || oldSocket.readyState === 1)) {
                    server.log.info({ userId: authenticatedUserId }, "Closing old WebSocket connection for re-authenticating user.");
                    oldSocket.close(1000, "New connection established by the same user.");
                }
            }
            if (userSubscribers.has(authenticatedUserId)) {
                const oldSub = userSubscribers.get(authenticatedUserId);
                oldSub.quit().catch(err => server.log.error({err, userId: authenticatedUserId}, "Error quitting old subscriber"));
                userSubscribers.delete(authenticatedUserId);
                server.log.info({ userId: authenticatedUserId }, "Cleaned up pre-existing Redis subscriber for user on new connection.");
            }

            activeConnections.set(authenticatedUserId, ws);
            server.log.info({ userId: authenticatedUserId, username: userJWTPayload.username }, `User authenticated via cookie and WebSocket connected.`);
            
            ws.send(JSON.stringify({ type: 'auth_success', message: 'Authenticated successfully via cookie.', user: userJWTPayload }));

            const newUserNotification = JSON.stringify({
                type: 'userOnline',
                user: {
                    id: userJWTPayload.userId,
                    username: userJWTPayload.username,
                    picture: userJWTPayload.picture
                }
            });
            activeConnections.forEach((clientWs, clientId) => {
                if (clientId !== authenticatedUserId && (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === 1)) {
                    try {
                        clientWs.send(newUserNotification);
                    } catch (e) {
                        server.log.error({ err: e, notifiedClientId: clientId }, "Error sending userOnline notification.");
                    }
                }
            });

            const userChannel = `user:${authenticatedUserId}:messages`;
            dedicatedSubscriber = createNewRedisSubscriber(server.log);
            userSubscribers.set(authenticatedUserId, dedicatedSubscriber);

            dedicatedSubscriber.subscribe(userChannel)
                .then(() => {
                    server.log.info({ userId: authenticatedUserId, channel: userChannel }, `User subscribed to Redis channel`);
                })
                .catch(err => {
                    server.log.error({ err, userId: authenticatedUserId, channel: userChannel }, "Failed to subscribe to Redis channel");
                });

            dedicatedSubscriber.on('message', (channel, messageContent) => {
                const currentWs = activeConnections.get(authenticatedUserId);
                if (currentWs === ws && (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === 1)) {
                    try {
                        JSON.parse(messageContent); 
                        currentWs.send(messageContent);
                    } catch (e) {
                        server.log.error({error: e, rawContent: messageContent, userId: authenticatedUserId}, "Error forwarding message from Redis: not valid JSON");
                    }
                }
            });
            dedicatedSubscriber.on('error', (err) => {
                server.log.error({err, userId: authenticatedUserId, channel: userChannel}, "Error on user-specific Redis subscriber");
            });

        } catch (err) {
            server.log.warn({ ip: req.ip, error: err.message }, "WebSocket authentication failed (e.g. invalid/expired token).");
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed: ' + err.message }));
            ws.close(1008, "Policy Violation: Authentication failed");
            return;
        }

        ws.on('message', async (messageBuffer) => {
            if (!authenticatedUserId || !userJWTPayload) {
                server.log.warn({ip: req.ip}, "Received WebSocket message from unauthenticated connection. Closing.");
                ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated.' }));
                ws.close(1008, "Policy Violation: Unauthenticated message");
                return;
            }

            const messageString = messageBuffer.toString();
            let data;
            try {
                data = JSON.parse(messageString);
            } catch (parseError) {
                server.log.warn({ rawMessage: messageString, error: parseError, userId: authenticatedUserId }, 'WebSocket: Received non-JSON message');
                if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format. Expected JSON.' }));
                }
                return;
            }

            server.log.info({ userId: authenticatedUserId, parsedData: data }, '>>> WebSocket: Parsed message data (post-auth).');

            try {
                if (data.type === 'privateMessage') {
                    const senderId = authenticatedUserId;
                    const { toUserId, content } = data;

                    if (!toUserId || typeof content === 'undefined') {
                        if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Missing toUserId or content for private message.' }));
                        }
                        return;
                    }
                    const recipientId = parseInt(toUserId, 10);
                    if (isNaN(recipientId)) {
                        if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Invalid recipient ID.' }));
                        }
                        return;
                    }

                    const recipientChannel = `user:${recipientId}:messages`;
                    const fromUsername = userJWTPayload.username; 
                    const messageDataToSend = {
                        type: 'newMessage',
                        fromUserId: senderId,
                        fromUsername: fromUsername,
                        toUserId: recipientId,
                        content: content,
                        timestamp: new Date().toISOString()
                    };
                    const messageToSendString = JSON.stringify(messageDataToSend);

                    await redisPublisher.publish(recipientChannel, messageToSendString);

                    db.run(
                        'INSERT INTO chat_messages (sender_id, receiver_id, message_content) VALUES (?, ?, ?)',
                        [senderId, recipientId, content],
                        function (dbErr) {
                            if (dbErr) {
                                server.log.error({ err: dbErr, senderId, toUserId: recipientId }, 'Failed to save chat message to DB');
                                if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to send message (DB error).'}));
                                }
                            } else {
                                if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                                    ws.send(JSON.stringify({ type: 'message_sent_ack', toUserId: recipientId, content, messageId: this.lastID, timestamp: messageDataToSend.timestamp }));
                                }
                            }
                        }
                    );

                } else {
                    server.log.warn({userId: authenticatedUserId, receivedData: data}, "WebSocket: Received unhandled message type (post-auth)");
                    if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                        ws.send(JSON.stringify({type: 'error', message: 'Unhandled message type: ' + data.type}));
                    }
                }
            } catch (error) {
                server.log.error({ error: error.message, stack: error.stack, rawMessage: messageString, userId: authenticatedUserId }, 'WebSocket message processing logic error (post-auth)');
                if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Error processing your request.' }));
                }
            }
        });

        ws.on('close', async (code, reason) => {
            const reasonString = reason ? reason.toString() : 'N/A';
            server.log.info({ userId: authenticatedUserId, code, reason: reasonString }, `>>> chat.js: WebSocket client disconnected (on.close).`);
            if (authenticatedUserId) {
                if (activeConnections.get(authenticatedUserId) === ws) {
                    activeConnections.delete(authenticatedUserId);
                }
                if (dedicatedSubscriber) { 
                    userSubscribers.delete(authenticatedUserId);
                    await dedicatedSubscriber.quit().catch(err => server.log.error({err, userId: authenticatedUserId}, "Error quitting dedicated subscriber on close."));
                    dedicatedSubscriber = null;
                }
                
                if (userJWTPayload) { // If we have user details, notify others
                    const userOfflineNotification = JSON.stringify({
                        type: 'userOffline',
                        user: {
                            id: userJWTPayload.userId,
                            username: userJWTPayload.username
                        }
                    });
                    activeConnections.forEach((clientWs, clientId) => {
                        if ((clientWs.readyState === WebSocket.OPEN || clientWs.readyState === 1)) {
                            try {
                                clientWs.send(userOfflineNotification);
                            } catch (e) {
                                server.log.error({ err: e, notifiedClientId: clientId }, "Error sending userOffline notification.");
                            }
                        }
                    });
                }
            }
        });

        ws.on('error', (err) => {
            server.log.error({ err, userId: authenticatedUserId }, '>>> chat.js: WebSocket error on ws object (on.error):');
        });
    }
  });

  server.get('/api/chat/history/:peerUserId', async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token) {
        return reply.code(401).send({ error: 'Unauthorized: Missing token' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const currentUserId = payload.userId;
        const peerUserId = parseInt(req.params.peerUserId, 10);

        if (isNaN(peerUserId) || !Number.isInteger(peerUserId)) {
            return reply.code(400).send({ error: 'Invalid peer user ID.' });
        }
        if (currentUserId === peerUserId) {
            return reply.code(400).send({ error: 'Cannot fetch chat history with oneself.'});
        }

        const messages = await new Promise((resolve, reject) => {
            db.all(
                `SELECT m.id, m.sender_id, u_sender.username as sender_username, m.receiver_id, u_receiver.username as receiver_username, m.message_content, m.timestamp 
                 FROM chat_messages m
                 JOIN users u_sender ON m.sender_id = u_sender.id
                 JOIN users u_receiver ON m.receiver_id = u_receiver.id
                 WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
                 ORDER BY m.timestamp ASC`,
                [currentUserId, peerUserId, peerUserId, currentUserId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
        reply.send(messages);
    } catch (err) {
        server.log.error({ err: { message: err.message, name: err.name }, context: "/api/chat/history handler" }, 'Error fetching chat history or invalid token');
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return reply.code(401).send({ error: 'Unauthorized: Invalid or expired token' });
        }
        return reply.code(500).send({ error: 'Server error fetching chat history.' });
    }
  });

  server.get('/api/chat/users', async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token) {
        return reply.code(401).send({ error: 'Unauthorized: Missing token' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const currentUserId = payload.userId;

        if (typeof currentUserId === 'undefined') {
            server.log.error({ payload, path: req.raw.url }, "currentUserId is undefined after JWT verification for /api/chat/users");
            return reply.code(500).send({ error: 'Internal server error: User ID not found in token.' });
        }

        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username, picture FROM users WHERE id != ? ORDER BY username ASC', [currentUserId], (err, rows) => {
                if (err) {
                    server.log.error({ err, queryContext: "loadUserList-api", currentUserId, path: req.raw.url }, "Error in DB.all for /api/chat/users");
                    return reject(err); 
                }
                resolve(rows);
            });
        });
        reply.send(users);
    } catch (err) {
        server.log.error({ err: { message: err.message, name: err.name }, context: "/api/chat/users handler" }, 'Error fetching users for chat or invalid token');
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return reply.code(401).send({ error: 'Unauthorized: Invalid or expired token' });
        }
        return reply.code(500).send({ error: 'Server error fetching users.' });
    }
  });
}

export async function cleanupChatResources(logger) {
    logger.info("Cleaning up chat resources (global)...");
    for (const [_userId, subscriber] of userSubscribers) {
        try {
            await subscriber.quit();
        } catch (e) {
            logger.error({ err: e, userId: _userId }, "Error quitting user-specific subscriber (from map) during shutdown");
        }
    }
    userSubscribers.clear();
    activeConnections.clear();
    logger.info("Chat resources (global) cleaned up.");
}