// tscd_main/backend/chat.js
import jwt from "jsonwebtoken";
import { getDB } from "./db.js";
import { getRedisPublisher, createNewRedisSubscriber } from "./redis.js"; // Assuming redis.js
import Redis from "ioredis"; // Still need Redis for creating new subscribers dynamically

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Store for active WebSocket connections: Map<userId, WebSocketConnection>
const activeConnections = new Map();
// Store for user-specific Redis subscribers: Map<userId, RedisClientInstance>
const userSubscribers = new Map();

export default async function chatRoutes(server, options) {
  const db = getDB();
  const redisPublisher = getRedisPublisher();

  server.route({
    method: "GET",
    url: "/ws/chat",
    handler: (req, reply) => {
      // Non-WebSocket requests to this URL
      reply
        .code(400)
        .send({
          error:
            "This is a WebSocket endpoint. Please connect using a WebSocket client.",
        });
    },
    wsHandler: (connection, req) => {
      // req is the initial HTTP upgrade request
      server.log.info(
        { remoteAddress: req.socket.remoteAddress },
        ">>> chat.js: wsHandler invoked. Attempting immediate auth from cookie."
      );

      const ws = connection; // 'connection' IS the WebSocket object
      let authenticatedUserId = null;
      let userJWTPayload = null; // To store the payload for later use (e.g., username)
      let dedicatedSubscriber = null; // To store the Redis subscriber for this connection

      // --- IMMEDIATE AUTHENTICATION FROM COOKIE ---
      const token = req.cookies.auth_token; // Get token from HttpOnly cookie
      if (!token) {
        server.log.warn(
          { ip: req.ip },
          "WebSocket connection attempt without auth_token cookie."
        );
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Authentication required. Missing token.",
          })
        );
        ws.close(1008, "Policy Violation: Missing authentication token");
        return;
      }

      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload.userId || !payload.username || !payload.email) {
          server.log.warn(
            { ip: req.ip, payload },
            "WebSocket connection attempt with invalid token payload."
          );
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Authentication failed: Invalid token data.",
            })
          );
          ws.close(1008, "Policy Violation: Invalid token data");
          return;
        }

        authenticatedUserId = payload.userId;
        userJWTPayload = payload; // Store the verified payload

        // Clean up any old connection/subscriber for this user (important for re-connections)
        if (activeConnections.has(authenticatedUserId)) {
          const oldSocket = activeConnections.get(authenticatedUserId);
          if (
            oldSocket &&
            oldSocket !== ws &&
            (oldSocket.readyState === WebSocket.OPEN ||
              oldSocket.readyState === 1)
          ) {
            server.log.info(
              { userId: authenticatedUserId },
              "Closing old WebSocket connection for re-authenticating user."
            );
            oldSocket.close(
              1000,
              "New connection established by the same user."
            );
          }
        }
        if (userSubscribers.has(authenticatedUserId)) {
          const oldSub = userSubscribers.get(authenticatedUserId);
          oldSub
            .quit()
            .catch((err) =>
              server.log.error(
                { err, userId: authenticatedUserId },
                "Error quitting old subscriber"
              )
            );
          userSubscribers.delete(authenticatedUserId);
          server.log.info(
            { userId: authenticatedUserId },
            "Cleaned up pre-existing Redis subscriber for user on new connection."
          );
        }

        activeConnections.set(authenticatedUserId, ws);
        server.log.info(
          { userId: authenticatedUserId, username: userJWTPayload.username },
          `User authenticated via cookie and WebSocket connected.`
        );

        // Send auth_success message to client
        ws.send(
          JSON.stringify({
            type: "auth_success",
            message: "Authenticated successfully via cookie.",
            user: userJWTPayload,
          })
        );

        // Subscribe this user to their Redis channel
        const userChannel = `user:${authenticatedUserId}:messages`;
        dedicatedSubscriber = createNewRedisSubscriber(server.log); // Assign to handler-scoped variable
        userSubscribers.set(authenticatedUserId, dedicatedSubscriber);

        dedicatedSubscriber
          .subscribe(userChannel)
          .then(() => {
            server.log.info(
              { userId: authenticatedUserId, channel: userChannel },
              `User subscribed to Redis channel`
            );
          })
          .catch((err) => {
            server.log.error(
              { err, userId: authenticatedUserId, channel: userChannel },
              "Failed to subscribe to Redis channel"
            );
            //  Consider closing ws connection if subscription fails critically
          });

        dedicatedSubscriber.on("message", (channel, messageContent) => {
          server.log.info(
            {
              channel,
              userId: authenticatedUserId,
              receivedContent: messageContent,
            },
            `Redis: Received message for user`
          );
          const currentWs = activeConnections.get(authenticatedUserId);
          if (
            currentWs === ws &&
            (currentWs.readyState === WebSocket.OPEN ||
              currentWs.readyState === 1)
          ) {
            try {
              JSON.parse(messageContent);
              currentWs.send(messageContent);
            } catch (e) {
              server.log.error(
                {
                  error: e,
                  rawContent: messageContent,
                  userId: authenticatedUserId,
                },
                "Error forwarding message from Redis: not valid JSON"
              );
            }
          }
        });
        dedicatedSubscriber.on("error", (err) => {
          server.log.error(
            { err, userId: authenticatedUserId, channel: userChannel },
            "Error on user-specific Redis subscriber"
          );
        });
      } catch (err) {
        // Catch errors from jwt.verify or other synchronous setup issues
        server.log.warn(
          { ip: req.ip, error: err.message },
          "WebSocket authentication failed (e.g. invalid/expired token)."
        );
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Authentication failed: " + err.message,
          })
        );
        ws.close(1008, "Policy Violation: Authentication failed");
        return;
      }

      // --- MESSAGE HANDLING (client no longer sends 'auth' type) ---
      ws.on("message", async (messageBuffer) => {
        // If authenticatedUserId is not set here, it means the initial cookie auth failed and connection should have been closed.
        // However, as a safeguard:
        if (!authenticatedUserId || !userJWTPayload) {
          server.log.warn(
            { ip: req.ip },
            "Received WebSocket message from unauthenticated connection. Closing."
          );
          ws.send(
            JSON.stringify({ type: "error", message: "Not authenticated." })
          );
          ws.close(1008, "Policy Violation: Unauthenticated message");
          return;
        }

        const messageString = messageBuffer.toString();
        let data;
        try {
          data = JSON.parse(messageString);
        } catch (parseError) {
          server.log.warn(
            {
              rawMessage: messageString,
              error: parseError,
              userId: authenticatedUserId,
            },
            "WebSocket: Received non-JSON message"
          );
          if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid message format. Expected JSON.",
              })
            );
          }
          return;
        }

        server.log.info(
          { userId: authenticatedUserId, parsedData: data },
          ">>> WebSocket: Parsed message data (post-auth)."
        );

        try {
          // Inner try-catch for message processing logic
          if (data.type === "privateMessage") {
            // Client now only sends this type for chat
            const senderId = authenticatedUserId; // Already known
            const { toUserId, content } = data;

            // ... (rest of your privateMessage handling logic is the same) ...
            // Ensure fromUsername comes from userJWTPayload.username
            if (!toUserId || typeof content === "undefined") {
              if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "Missing toUserId or content for private message.",
                  })
                );
              }
              return;
            }
            const recipientId = parseInt(toUserId, 10);
            if (isNaN(recipientId)) {
              if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "Invalid recipient ID.",
                  })
                );
              }
              return;
            }

            server.log.info(
              {
                senderId,
                toUserId: recipientId,
                contentLen: content ? content.length : 0,
              },
              `Processing private message details`
            );

            const recipientChannel = `user:${recipientId}:messages`;
            const fromUsername = userJWTPayload.username;
            const messageDataToSend = {
              type: "newMessage",
              fromUserId: senderId,
              fromUsername: fromUsername,
              toUserId: recipientId,
              content: content,
              timestamp: new Date().toISOString(),
            };
            const messageToSendString = JSON.stringify(messageDataToSend);

            await redisPublisher.publish(recipientChannel, messageToSendString);
            server.log.info(
              { senderId, toUserId: recipientId, channel: recipientChannel },
              `Message published to Redis`
            );

            db.run(
              "INSERT INTO chat_messages (sender_id, receiver_id, message_content) VALUES (?, ?, ?)",
              [senderId, recipientId, content],
              function (dbErr) {
                if (dbErr) {
                  server.log.error(
                    { err: dbErr, senderId, toUserId: recipientId },
                    "Failed to save chat message to DB"
                  );
                  if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                    ws.send(
                      JSON.stringify({
                        type: "error",
                        message: "Failed to send message (DB error).",
                      })
                    );
                  }
                } else {
                  server.log.info(
                    { messageId: this.lastID, senderId, toUserId: recipientId },
                    "Message saved to DB"
                  );
                  if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
                    ws.send(
                      JSON.stringify({
                        type: "message_sent_ack",
                        toUserId: recipientId,
                        content,
                        messageId: this.lastID,
                        timestamp: messageDataToSend.timestamp,
                      })
                    );
                  }
                }
              }
            );
          } else {
            server.log.warn(
              { userId: authenticatedUserId, receivedData: data },
              "WebSocket: Received unhandled message type (post-auth)"
            );
            if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Unhandled message type: " + data.type,
                })
              );
            }
          }
        } catch (error) {
          server.log.error(
            {
              error: error.message,
              stack: error.stack,
              rawMessage: messageString,
              userId: authenticatedUserId,
            },
            "WebSocket message processing logic error (post-auth)"
          );
          if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Error processing your request.",
              })
            );
          }
        }
      });

      ws.on("close", async (code, reason) => {
        const reasonString = reason ? reason.toString() : "N/A";
        server.log.info(
          { userId: authenticatedUserId, code, reason: reasonString },
          `>>> chat.js: WebSocket client disconnected (on.close).`
        );
        if (authenticatedUserId) {
          if (activeConnections.get(authenticatedUserId) === ws) {
            activeConnections.delete(authenticatedUserId);
          }
          // Use the handler-scoped 'dedicatedSubscriber' for cleanup
          if (dedicatedSubscriber) {
            userSubscribers.delete(authenticatedUserId); // Remove from map first
            await dedicatedSubscriber
              .quit()
              .catch((err) =>
                server.log.error(
                  { err, userId: authenticatedUserId },
                  "Error quitting dedicated subscriber on close."
                )
              );
            server.log.info(
              { userId: authenticatedUserId },
              `Dedicated Redis subscriber quit for disconnected user.`
            );
            dedicatedSubscriber = null;
          }
        }
      });

      ws.on("error", (err) => {
        server.log.error(
          { err, userId: authenticatedUserId },
          ">>> chat.js: WebSocket error on ws object (on.error):"
        );
      });
      server.log.info(
        { userId: authenticatedUserId },
        ">>> chat.js: Successfully attached 'message', 'close', and 'error' listeners to ws object (post-auth)."
      );
    },
  });

  // HTTP API Endpoint to get chat history
  server.get("/api/chat/history/:peerUserId", async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token) {
      return reply.code(401).send({ error: "Unauthorized: Missing token" });
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const currentUserId = payload.userId;
      const peerUserId = parseInt(req.params.peerUserId, 10);

      if (isNaN(peerUserId) || !Number.isInteger(peerUserId)) {
        return reply.code(400).send({ error: "Invalid peer user ID." });
      }
      if (currentUserId === peerUserId) {
        return reply
          .code(400)
          .send({ error: "Cannot fetch chat history with oneself." });
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
      server.log.error({ err }, "Error fetching chat history or invalid token");
      if (
        err.name === "JsonWebTokenError" ||
        err.name === "TokenExpiredError"
      ) {
        return reply
          .code(401)
          .send({ error: "Unauthorized: Invalid or expired token" });
      }
      return reply
        .code(500)
        .send({ error: "Server error fetching chat history." });
    }
  });

  // HTTP API Endpoint to list users (for chat contacts)
  server.get("/api/chat/users", async (req, reply) => {
    const token = req.cookies.auth_token;
    server.log.info(
      { tokenExists: !!token, path: req.raw.url },
      "Attempting to fetch chat users list."
    ); // Log entry
    if (!token) {
      return reply.code(401).send({ error: "Unauthorized: Missing token" });
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      server.log.info(
        { payload, path: req.raw.url },
        "JWT verified for chat users list."
      ); // Log payload
      const currentUserId = payload.userId;

      if (typeof currentUserId === "undefined") {
        server.log.error(
          { payload, path: req.raw.url },
          "currentUserId is undefined after JWT verification for /api/chat/users"
        );
        return reply
          .code(500)
          .send({
            error: "Internal server error: User ID not found in token.",
          });
      }

      const users = await new Promise((resolve, reject) => {
        server.log.info(
          { currentUserId, path: req.raw.url },
          "Querying database for user list."
        ); // Log before DB query
        db.all(
          "SELECT id, username, picture FROM users WHERE id != ? ORDER BY username ASC",
          [currentUserId],
          (err, rows) => {
            if (err) {
              server.log.error(
                {
                  err,
                  queryContext: "loadUserList-api",
                  currentUserId,
                  path: req.raw.url,
                },
                "Error in DB.all for /api/chat/users"
              );
              return reject(err);
            }
            server.log.info(
              { count: rows ? rows.length : 0, path: req.raw.url },
              "Successfully fetched user list from DB."
            ); // Log success
            resolve(rows);
          }
        );
      });
      reply.send(users);
    } catch (err) {
      server.log.error(
        {
          err: { message: err.message, name: err.name, stack: err.stack },
          context: "/api/chat/users handler",
          path: req.raw.url,
        },
        "Error fetching users for chat or invalid token"
      );
      if (
        err.name === "JsonWebTokenError" ||
        err.name === "TokenExpiredError"
      ) {
        return reply
          .code(401)
          .send({ error: "Unauthorized: Invalid or expired token" });
      }
      return reply
        .code(500)
        .send({
          error: "Server error processing your request to fetch users.",
        });
    }
  });
}

export async function cleanupChatResources(logger) {
    logger.info("Cleaning up chat resources (global)...");

    for (const [_userId, subscriber] of userSubscribers) {
        try {
            await subscriber.quit();
            logger.info({ userId: _userId }, "User-specific Redis subscriber (from map) quit during shutdown.");
        } catch (e) {
            logger.error({ err: e, userId: _userId }, "Error quitting user-specific subscriber (from map) during shutdown");
        }
    }
    userSubscribers.clear();
    activeConnections.clear();
    logger.info("Chat resources (global) cleaned up.");
}