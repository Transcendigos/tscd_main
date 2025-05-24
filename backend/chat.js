// tscd_main/backend/chat.js
import jwt from 'jsonwebtoken';
import { getDB } from './db.js';
import { getRedisPublisher, createNewRedisSubscriber } from './redis.js'; // Assuming redis.js
import Redis from 'ioredis'; // Still need Redis for creating new subscribers dynamically

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Store for active WebSocket connections: Map<userId, WebSocketConnection>
const activeConnections = new Map();
// Store for user-specific Redis subscribers: Map<userId, RedisClientInstance>
const userSubscribers = new Map();


export default async function chatRoutes(server, options) {
  const db = getDB();
  const redisPublisher = getRedisPublisher();

  server.route({
    method: 'GET',
    url: '/ws/chat',
    handler: (req, reply) => { // Non-WebSocket requests to this URL
        reply.code(400).send({error: 'This is a WebSocket endpoint. Please connect using a WebSocket client.'});
    },
    wsHandler: (connection, req) => {
        server.log.info('WebSocket client attempting to connect to /ws/chat');
        let authenticatedUserId = null;
        let userJWTPayload = null; // Store the verified JWT payload

        const ws = connection;

        ws.on('message', async (messageBuffer) => {
            const messageString = messageBuffer.toString();
            let data;
            try {
                data = JSON.parse(messageString);
            } catch (parseError) {
                server.log.warn({ rawMessage: messageString, error: parseError }, 'WebSocket: Received non-JSON message or parse error');
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format. Expected JSON.' }));
                return;
            }

            try {
                if (data.type === 'auth' && data.token) {
                    if (authenticatedUserId) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Already authenticated.' }));
                        return;
                    }
                    const token = data.token;
                    const payload = jwt.verify(token, JWT_SECRET);
                    
                    if (!payload.userId || !payload.username || !payload.email) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed: Invalid token payload.' }));
                        ws.close();
                        return;
                    }
                    authenticatedUserId = payload.userId;
                    userJWTPayload = payload; // Store payload

                    // Clean up any old connection/subscriber for this user
                    if (activeConnections.has(authenticatedUserId)) {
                        server.log.info({ userId: authenticatedUserId }, "Closing old WebSocket connection for re-authenticating user.");
                        activeConnections.get(authenticatedUserId).close(1000, "New connection established by the same user.");
                        // The 'close' handler for the old socket should clean up its subscriber
                    }
                    
                    activeConnections.set(authenticatedUserId, ws);
                    server.log.info({ userId: authenticatedUserId, username: payload.username }, `User authenticated and connected via WebSocket.`);
                    ws.send(JSON.stringify({ type: 'auth_success', message: 'Authenticated successfully.', user: payload }));

                    // Subscribe this user to their Redis channel
                    const userChannel = `user:${authenticatedUserId}:messages`;
                    
                    // Ensure old subscriber is cleaned up if exists (e.g. from a rapid reconnect)
                    if (userSubscribers.has(authenticatedUserId)) {
                        const oldSub = userSubscribers.get(authenticatedUserId);
                        await oldSub.quit();
                        userSubscribers.delete(authenticatedUserId);
                         server.log.info({ userId: authenticatedUserId}, "Cleaned up pre-existing Redis subscriber for user.");
                    }

                    const newSubscriber = createNewRedisSubscriber(server.log);
                    userSubscribers.set(authenticatedUserId, newSubscriber);

                    await newSubscriber.subscribe(userChannel);
                    server.log.info({ userId: authenticatedUserId, channel: userChannel }, `User subscribed to Redis channel`);

                    newSubscriber.on('message', (channel, messageContent) => {
                        server.log.info({ channel, userId: authenticatedUserId, receivedContent: messageContent }, `Redis: Received message for user`);
                        const currentWs = activeConnections.get(authenticatedUserId);
                        if (currentWs && currentWs === ws) { // Ensure it's the current active socket for this user
                            try {
                                JSON.parse(messageContent); 
                                currentWs.send(messageContent);
                            } catch (e) {
                                server.log.error({error: e, rawContent: messageContent}, "Error forwarding message from Redis: not valid JSON");
                            }
                        }
                    });
                    newSubscriber.on('error', (err) => {
                        server.log.error({err, userId: authenticatedUserId, channel: userChannel}, "Error on user-specific Redis subscriber");
                        // Optionally try to re-subscribe or handle error
                    });

                } else if (data.type === 'privateMessage') {
                    if (!authenticatedUserId || !userJWTPayload) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated. Please send auth message first.' }));
                        return;
                    }
                    
                    const senderId = authenticatedUserId;
                    const { toUserId, content } = data;

                    if (!toUserId || typeof content === 'undefined') {
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing toUserId or content for private message.' }));
                        return;
                    }
                    const recipientId = parseInt(toUserId, 10);
                     if (isNaN(recipientId)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid recipient ID.' }));
                        return;
                    }


                    server.log.info({ senderId, toUserId: recipientId, contentLen: content.length }, `Processing private message`);

                    const recipientChannel = `user:${recipientId}:messages`;
                    const messageToSend = JSON.stringify({
                        type: 'newMessage',
                        fromUserId: senderId,
                        fromUsername: userJWTPayload.username, // Use stored username
                        toUserId: recipientId,
                        content: content,
                        timestamp: new Date().toISOString()
                    });

                    await redisPublisher.publish(recipientChannel, messageToSend);
                    server.log.info({ senderId, toUserId: recipientId, channel: recipientChannel }, `Message published to Redis`);

                    db.run(
                        'INSERT INTO chat_messages (sender_id, receiver_id, message_content) VALUES (?, ?, ?)',
                        [senderId, recipientId, content],
                        function (err) {
                            if (err) {
                                server.log.error({ err, senderId, toUserId: recipientId }, 'Failed to save chat message to DB');
                                ws.send(JSON.stringify({ type: 'error', message: 'Failed to send message (DB error).'}));
                            } else {
                                server.log.info({ messageId: this.lastID, senderId, toUserId: recipientId }, 'Message saved to DB');
                                ws.send(JSON.stringify({ type: 'message_sent_ack', toUserId: recipientId, content, messageId: this.lastID, timestamp: messageToSend.timestamp }));
                            }
                        }
                    );
                } else if (!authenticatedUserId && data.type !== 'auth') {
                     ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated. Please send auth message first.' }));
                } else {
                    server.log.warn({userId: authenticatedUserId, receivedData: data}, "WebSocket: Received unhandled message type");
                    ws.send(JSON.stringify({type: 'error', message: 'Unhandled message type: ' + data.type}));
                }
            } catch (error) {
                server.log.error({ error: error.message, stack: error.stack, rawMessage: messageString }, 'WebSocket message processing error');
                if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                    ws.send(JSON.stringify({ type: 'error', message: 'Authentication error: ' + error.message }));
                    if (!authenticatedUserId) ws.close();
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Error processing your request.' }));
                }
            }
        });

        ws.on('close', async (code, reason) => {
            server.log.info({ userId: authenticatedUserId, code, reason: reason ? reason.toString() : 'N/A' }, `WebSocket client disconnected.`);
            if (authenticatedUserId) {
                // Only remove from activeConnections if it's this specific socket instance
                if (activeConnections.get(authenticatedUserId) === ws) {
                    activeConnections.delete(authenticatedUserId);
                }
                
                const subscriber = userSubscribers.get(authenticatedUserId);
                if (subscriber) {
                    // Only quit the subscriber if this was the socket that established it
                    // This check might be tricky if multiple sockets from same user can exist (though current logic tries to prevent it)
                    // Assuming one active authenticated socket per user for now
                    await subscriber.quit();
                    userSubscribers.delete(authenticatedUserId);
                    server.log.info({ userId: authenticatedUserId }, `Redis subscriber quit and removed for disconnected user.`);
                }
                // authenticatedUserId = null; // Reset for this specific ws instance scope
            }
        });

        ws.on('error', (err) => {
            server.log.error({ err, userId: authenticatedUserId }, 'WebSocket error on connection:');
        });
    }
  });

  // HTTP API Endpoint to get chat history
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
        server.log.error({ err }, 'Error fetching chat history or invalid token');
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return reply.code(401).send({ error: 'Unauthorized: Invalid or expired token' });
        }
        return reply.code(500).send({ error: 'Server error fetching chat history.' });
    }
  });

  // HTTP API Endpoint to list users (for chat contacts)
  server.get('/api/chat/users', async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token) {
        return reply.code(401).send({ error: 'Unauthorized: Missing token' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const currentUserId = payload.userId;

        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username, picture FROM users WHERE id != ? ORDER BY username ASC', [currentUserId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        reply.send(users);
    } catch (err) {
        server.log.error({ err }, 'Error fetching users for chat or invalid token');
         if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return reply.code(401).send({ error: 'Unauthorized: Invalid or expired token' });
        }
        return reply.code(500).send({ error: 'Server error fetching users.' });
    }
  });
}

// Export cleanup function for graceful shutdown for chat module specifically
export async function cleanupChatResources(logger) {
    logger.info("Cleaning up chat resources...");
    for (const [_userId, subscriber] of userSubscribers) {
        try {
            await subscriber.quit();
            logger.info({ userId: _userId }, "User-specific Redis subscriber quit.");
        } catch (e) {
            logger.error({ err: e, userId: _userId }, "Error quitting user-specific subscriber during shutdown");
        }
    }
    userSubscribers.clear();
    activeConnections.clear(); // Sockets will be closed by Fastify server.close()
    logger.info("Chat resources cleaned up.");
}