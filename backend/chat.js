import jwt from "jsonwebtoken";
import { getDB } from "./db.js";
import { getRedisPublisher, createNewRedisSubscriber } from "./redis.js";
import {
  handlePlayerInput,
  activeGames as pongActiveGames,
} from "./pong_server.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

const activeConnections = new Map();
const userSubscribers = new Map();
const pongGameConnections = new Map();

export default async function chatRoutes(server, options) {
  const db = getDB();
  const redisPublisher = getRedisPublisher();

  server.decorate("broadcastPongGameState", (gameId, statePayload) => {
    const connections = pongGameConnections.get(gameId);
    if (connections) {
      const payloadString = JSON.stringify(statePayload);
      connections.forEach((ws) => {
        if (ws.readyState === 1) {
          ws.send(payloadString);
        }
      });
    }
  });

  server.route({
    method: "GET",
    url: "/ws/chat",
    handler: (req, reply) => {
      reply.code(400).send({ error: "This is a WebSocket endpoint." });
    },
    wsHandler: (connection, req) => {
      const ws = connection;

      server.log.info(
        { remoteAddress: req.socket.remoteAddress },
        ">>> chat.js: wsHandler invoked."
      );

      let rawAuthenticatedUserId = null;
      let prefixedAuthenticatedUserId = null;
      let userJWTPayload = null;
      let dedicatedSubscriber = null;

      const token = req.cookies.auth_token;
      if (!token) {
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
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Authentication failed: Invalid token data.",
            })
          );
          ws.close(1008, "Policy Violation: Invalid token data");
          return;
        }

        rawAuthenticatedUserId = payload.userId;
        prefixedAuthenticatedUserId = `user_${payload.userId}`;
        userJWTPayload = payload;

        ws.authenticatedUserId = prefixedAuthenticatedUserId;
        ws.rawAuthenticatedUserId = rawAuthenticatedUserId;

        if (activeConnections.has(prefixedAuthenticatedUserId)) {
          const oldSocket = activeConnections.get(prefixedAuthenticatedUserId);
          if (oldSocket && oldSocket !== ws && oldSocket.readyState === 1) {
            oldSocket.close(
              1000,
              "New connection established by the same user."
            );
          }
        }
        if (userSubscribers.has(rawAuthenticatedUserId)) {
          const oldSub = userSubscribers.get(rawAuthenticatedUserId);
          oldSub
            .quit()
            .catch((err) =>
              server.log.error(
                { err, userId: rawAuthenticatedUserId },
                "Error quitting old subscriber"
              )
            );
          userSubscribers.delete(rawAuthenticatedUserId);
        }

        activeConnections.set(prefixedAuthenticatedUserId, ws);
        server.log.info(
          {
            userId: prefixedAuthenticatedUserId,
            username: userJWTPayload.username,
          },
          `User authenticated and WebSocket connected.`
        );

        ws.send(
          JSON.stringify({
            type: "auth_success",
            message: "Authenticated successfully.",
            user: { ...userJWTPayload, userId: prefixedAuthenticatedUserId },
          })
        );

        const newUserNotification = JSON.stringify({
          type: "userOnline",
          user: {
            id: prefixedAuthenticatedUserId,
            username: userJWTPayload.username,
            picture: userJWTPayload.picture,
          },
        });
        activeConnections.forEach((clientWs, clientPrefixedId) => {
          if (
            clientPrefixedId !== prefixedAuthenticatedUserId &&
            clientWs.readyState === 1
          ) {
            try {
              clientWs.send(newUserNotification);
            } catch (e) {
              server.log.error(
                { err: e, notifiedClientId: clientPrefixedId },
                "Error sending userOnline."
              );
            }
          }
        });

        const userChannel = `user:${rawAuthenticatedUserId}:messages`;
        dedicatedSubscriber = createNewRedisSubscriber(server.log);
        userSubscribers.set(rawAuthenticatedUserId, dedicatedSubscriber);

        dedicatedSubscriber
          .subscribe(userChannel)
          .then(() => {
            server.log.info(
              { userId: rawAuthenticatedUserId, channel: userChannel },
              `User subscribed to Redis channel`
            );
          })
          .catch((err) => {
            server.log.error(
              { err, userId: rawAuthenticatedUserId, channel: userChannel },
              "Failed to subscribe to Redis channel"
            );
          });

        dedicatedSubscriber.on("message", (channel, messageContent) => {
          const currentWs = activeConnections.get(prefixedAuthenticatedUserId);
          if (currentWs === ws && currentWs.readyState === 1) {
            try {
              JSON.parse(messageContent);
              currentWs.send(messageContent);
            } catch (e) {
              server.log.error(
                {
                  error: e,
                  rawContent: messageContent,
                  userId: prefixedAuthenticatedUserId,
                },
                "Error forwarding message from Redis"
              );
            }
          }
        });
        dedicatedSubscriber.on("error", (err) => {
          server.log.error(
            { err, userId: rawAuthenticatedUserId, channel: userChannel },
            "Error on user-specific Redis subscriber"
          );
        });
      } catch (err) {
        server.log.warn(
          { ip: req.ip, error: err.message },
          "WebSocket authentication failed."
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

      ws.on("message", async (messageBuffer) => {
        if (!rawAuthenticatedUserId || !userJWTPayload) {
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
              userId: rawAuthenticatedUserId,
            },
            "WebSocket: Received non-JSON message"
          );
          if (ws.readyState === 1) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid message format.",
              })
            );
          }
          return;
        }

        server.log.info(
          { userId: rawAuthenticatedUserId, parsedData: data },
          ">>> WebSocket: Parsed message data (post-auth)."
        );

        try {
          if (data.type === "privateMessage") {
            const senderRawId = ws.rawAuthenticatedUserId;
            const senderPrefixedId = ws.authenticatedUserId;
            const { toUserId, content } = data;

            if (!toUserId || typeof content === "undefined") {
              if (ws.readyState === 1) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "Missing toUserId or content.",
                  })
                );
              }
              return;
            }

            const recipientRawId = parseInt(toUserId, 10);
            if (isNaN(recipientRawId)) {
              if (ws.readyState === 1) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "Invalid recipient ID.",
                  })
                );
              }
              return;
            }

            const recipientChannel = `user:${recipientRawId}:messages`;

            const messageDataToSend = {
              type: "newMessage",
              fromUserId: senderPrefixedId,
              fromUsername: userJWTPayload.username,
              toUserId: `user_${recipientRawId}`,
              content: content,
              timestamp: new Date().toISOString(),
            };
            const messageToSendString = JSON.stringify(messageDataToSend);

            await redisPublisher.publish(recipientChannel, messageToSendString);
            server.log.info(
              { sender: senderPrefixedId, recipientChannel, content },
              "Chat message published to Redis"
            );

            db.run(
              "INSERT INTO chat_messages (sender_id, receiver_id, message_content) VALUES (?, ?, ?)",
              [senderRawId, recipientRawId, content],
              function (dbErr) {
                if (dbErr) {
                  server.log.error(
                    {
                      err: dbErr,
                      senderId: senderRawId,
                      toUserId: recipientRawId,
                    },
                    "Failed to save chat message to DB"
                  );
                  if (ws.readyState === 1) {
                    ws.send(
                      JSON.stringify({ type: "error", message: "DB error." })
                    );
                  }
                } else {
                  if (ws.readyState === 1) {
                    ws.send(
                      JSON.stringify({
                        type: "message_sent_ack",
                        toUserId: `user_${recipientRawId}`,
                        content,
                        messageId: this.lastID,
                        timestamp: messageDataToSend.timestamp,
                      })
                    );
                  }
                }
              }
            );
          } else if (
            data.type === "PONG_ACCEPT_INVITE" ||
            data.type === "PONG_JOIN_GAME"
          ) {
            const { gameId } = data;
            if (!gameId) {
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  message: "Missing gameId.",
                })
              );
              return;
            }
            const gameInstance = pongActiveGames.get(gameId);
            if (!gameInstance) {
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  gameId,
                  message: "Game not found.",
                })
              );
              return;
            }
            if (
              gameInstance.players[ws.authenticatedUserId]?.id !==
              ws.authenticatedUserId
            ) {
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  gameId,
                  message: "Not a player.",
                })
              );
              return;
            }
            if (!pongGameConnections.has(gameId))
              pongGameConnections.set(gameId, new Set());
            pongGameConnections.get(gameId).add(ws);
            ws.currentGameId = gameId;
            server.log.info(
              { userId: ws.authenticatedUserId, gameId },
              `User joined Pong game stream.`
            );
            const connectedPlayersWebSockets = pongGameConnections.get(gameId);
            if (
              connectedPlayersWebSockets.size ===
              Object.keys(gameInstance.players).length
            ) {
              server.log.info(
                { gameId, count: connectedPlayersWebSockets.size },
                `All players connected. Sending PONG_GAME_STARTED.`
              );

              Object.entries(gameInstance.players).forEach(
                ([playerId, playerDetails]) => {
                  const opponentId = Object.keys(gameInstance.players).find(
                    (id) => id !== playerId
                  );
                  const opponentDetails = gameInstance.players[opponentId];
                  const opponentUsername =
                    opponentDetails?.username || "Opponent";

                  const cleanInitialState = {
                    gameId: gameInstance.gameId,
                    players: gameInstance.players,
                    ball: gameInstance.ball,
                    status: gameInstance.status,
                    canvasWidth: gameInstance.canvasWidth,
                    canvasHeight: gameInstance.canvasHeight,
                    ballStartX: gameInstance.ballStartX,
                    ballStartY: gameInstance.ballStartY,
                    paddleStartY: gameInstance.paddleStartY,
                    winningScore: gameInstance.winningScore,
                  };

                  for (const clientWs of connectedPlayersWebSockets) {
                    if (clientWs.authenticatedUserId === playerId) {
                      clientWs.send(
                        JSON.stringify({
                          type: "PONG_GAME_STARTED",
                          gameId,
                          initialState: cleanInitialState,
                          yourPlayerId: playerId,
                          opponentUsername,
                          opponentId,
                        })
                      );
                      server.log.info(
                        { userId: playerId, gameId },
                        `Sent PONG_GAME_STARTED.`
                      );
                      break;
                    }
                  }
                }
              );
            } else {
              server.log.info(
                {
                  gameId,
                  connected: connectedPlayersWebSockets.size,
                  needed: Object.keys(gameInstance.players).length,
                },
                `Waiting for more players.`
              );
            }
          } else if (data.type === "PONG_PLAYER_INPUT") {
            const { gameId, input } = data;
            if (!gameId || typeof input === "undefined") {
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  message: "Missing gameId/input.",
                })
              );
              return;
            }
            if (ws.currentGameId !== gameId) {
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  gameId,
                  message: "Not joined.",
                })
              );
              return;
            }
            handlePlayerInput(gameId, ws.authenticatedUserId, input);
          } else {
            server.log.warn(
              { userId: ws.authenticatedUserId, data },
              "Unhandled WebSocket message type."
            );
            if (ws.readyState === 1) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Unhandled type: " + data.type,
                })
              );
            }
          }
        } catch (error) {
          server.log.error(
            {
              error: error.message,
              raw: messageString,
              userId: ws.authenticatedUserId,
            },
            "WebSocket message processing error."
          );
          if (ws.readyState === 1) {
            ws.send(
              JSON.stringify({ type: "error", message: "Processing error." })
            );
          }
        }
      });

      ws.on("close", async (code, reason) => {
        const reasonString = reason ? reason.toString() : "N/A";
        server.log.info(
          { userId: ws.authenticatedUserId, code, reason: reasonString },
          `WebSocket client disconnected.`
        );
        if (ws.authenticatedUserId) {
          if (activeConnections.get(ws.authenticatedUserId) === ws) {
            activeConnections.delete(ws.authenticatedUserId);
          }
          if (
            ws.rawAuthenticatedUserId &&
            userSubscribers.has(ws.rawAuthenticatedUserId)
          ) {
            const subToQuit = userSubscribers.get(ws.rawAuthenticatedUserId);
            if (subToQuit === dedicatedSubscriber) {
              await subToQuit
                .quit()
                .catch((err) =>
                  server.log.error(
                    { err, userId: ws.rawAuthenticatedUserId },
                    "Error quitting dedicated subscriber on close."
                  )
                );
              userSubscribers.delete(ws.rawAuthenticatedUserId);
              dedicatedSubscriber = null;
            }
          }
          if (ws.currentGameId && pongGameConnections.has(ws.currentGameId)) {
            pongGameConnections.get(ws.currentGameId).delete(ws);
            if (pongGameConnections.get(ws.currentGameId).size === 0) {
              pongGameConnections.delete(ws.currentGameId);
              server.log.info(
                { gameId: ws.currentGameId },
                `All players disconnected from Pong game.`
              );
            }
          }
          if (userJWTPayload) {
            const userOfflineNotification = JSON.stringify({
              type: "userOffline",
              user: {
                id: prefixedAuthenticatedUserId,
                username: userJWTPayload.username,
              },
            });
            activeConnections.forEach((clientWs, clientPrefixedId) => {
              if (clientWs.readyState === 1) {
                try {
                  clientWs.send(userOfflineNotification);
                } catch (e) {
                  server.log.error(
                    { err: e, notifiedClientId: clientPrefixedId },
                    "Error sending userOffline."
                  );
                }
              }
            });
          }
        }
      });
      ws.on("error", (err) => {
        server.log.error(
          { err, userId: ws.authenticatedUserId },
          `WebSocket error on ws object.`
        );
      });
    },
  });

  server.get("/api/chat/history/:peerUserId", async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const currentUserRawId = payload.userId;
      const peerUserRawId = parseInt(req.params.peerUserId, 10);

      if (isNaN(peerUserRawId)) {
        return reply.code(400).send({ error: "Invalid peer ID." });
      }
      if (currentUserRawId === peerUserRawId) {
        return reply.code(400).send({ error: "Cannot fetch self-history." });
      }

      const messages = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.id, u_sender.username as fromUsername, u_receiver.username as toUsername, 
                  m.message_content as content, m.timestamp,
                  'user_' || m.sender_id as fromUserId, 'user_' || m.receiver_id as toUserId
           FROM chat_messages m
           JOIN users u_sender ON m.sender_id = u_sender.id 
           JOIN users u_receiver ON m.receiver_id = u_receiver.id 
           WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
           ORDER BY m.timestamp ASC`,
          [currentUserRawId, peerUserRawId, peerUserRawId, currentUserRawId],
          (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
          }
        );
      });
      reply.send(messages.map((msg) => ({ ...msg, type: "newMessage" })));
    } catch (err) {
      server.log.error({ err }, "/api/chat/history error");
      if (
        err.name === "JsonWebTokenError" ||
        err.name === "TokenExpiredError"
      ) {
        return reply.code(401).send({ error: "Invalid token" });
      }
      return reply.code(500).send({ error: "Server error" });
    }
  });

  server.get("/api/chat/users", async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const currentUserRawId = payload.userId;

      if (typeof currentUserRawId === "undefined") {
        return reply.code(500).send({ error: "User ID not found." });
      }

      const users = await new Promise((resolve, reject) => {
        db.all(
          "SELECT id, username, picture FROM users WHERE id != ? ORDER BY username ASC",
          [currentUserRawId],
          (err, rows) => {
            if (err) {
              return reject(err);
            }
            resolve(rows.map((row) => ({ ...row, id: `user_${row.id}` })));
          }
        );
      });
      reply.send(users);
    } catch (err) {
      server.log.error({ err }, "/api/chat/users error");
      if (
        err.name === "JsonWebTokenError" ||
        err.name === "TokenExpiredError"
      ) {
        return reply.code(401).send({ error: "Invalid token" });
      }
      return reply.code(500).send({ error: "Server error" });
    }
  });
}

export async function cleanupChatResources(logger) {
  logger.info("Cleaning up chat resources (global)...");
  for (const [rawUserId, subscriber] of userSubscribers) {
    try {
      await subscriber.quit();
    } catch (e) {
      logger.error(
        { err: e, userId: rawUserId },
        "Error quitting subscriber during shutdown"
      );
    }
  }
  userSubscribers.clear();
  activeConnections.clear();
  pongGameConnections.clear();
  logger.info("Chat resources (global) cleaned up.");
}
