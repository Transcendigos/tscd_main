import jwt from "jsonwebtoken";
import { getDB } from "./db.js";
import fp from "fastify-plugin";
import { getRedisPublisher, createNewRedisSubscriber } from "./redis.js";
import {
  handlePlayerInput,
  activeGames as pongActiveGames,
  stopGame,
} from "./pong_server.js";
import { chatMessagesCounter } from './monitoring.js';


const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

const activeConnections = new Map();
const userSubscribers = new Map();
const pongGameConnections = new Map();

let globalSubscriber; 

async function chatRoutes(server, options) {
  const db = getDB();
  const redisPublisher = getRedisPublisher();


if (!globalSubscriber) {
      globalSubscriber = createNewRedisSubscriber(server.log);
      globalSubscriber.subscribe('chat:status', 'chat:general');
      globalSubscriber.on('message', (channel, message) => {
          if (channel === 'chat:status' || channel === 'chat:general') {
              activeConnections.forEach(ws => {
                  if (ws.readyState === 1) {
                      ws.send(message);
                  }
              });
          }
      });
  }


  server.decorate("broadcastPongGameState", (gameId, statePayload) => {
    const connections = pongGameConnections.get(gameId);
    if (connections) {
      server.log.info(
        { gameId, connectionCount: connections.size, type: statePayload.type },
        "Broadcasting to connections ================="
      );
      const payloadString = JSON.stringify(statePayload);
      connections.forEach((ws) => {
        if (ws.readyState === 1) {
          try {
            ws.send(payloadString);
            server.log.info(
              {
                gameId,
                userId: ws.authenticatedUserId,
                type: statePayload.type,
              },
              "Message sent to client"
            );
          } catch (e) {
            server.log.error(
              { gameId, userId: ws.authenticatedUserId, err: e },
              "Error sending message in broadcastPongGameState"
            );
          }
        } else {
          server.log.warn(
            {
              gameId,
              userId: ws.authenticatedUserId,
              readyState: ws.readyState,
            },
            "WebSocket not open in broadcastPongGameState, not sending."
          );
        }
      });
    } else {
      server.log.warn(
        { gameId, type: statePayload.type },
        "No connections found in pongGameConnections to broadcast to for this gameId."
      ); // ADD THIS LOG
    }
  });


  server.route({
    method: "GET",
    url: "/ws/chat",
    handler: (req, reply) => {
      reply.code(400).send({ error: "This is a WebSocket endpoint." });
    },
    wsHandler: async (connection, req) => {
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
        ws.userJWTPayload = userJWTPayload;

        await redisPublisher.sadd('online_users', prefixedAuthenticatedUserId);
        const userOnlineNotification = JSON.stringify({
            type: "userOnline",
            user: { id: prefixedAuthenticatedUserId, username: userJWTPayload.username, picture: userJWTPayload.picture }
        });
        await redisPublisher.publish('chat:status', userOnlineNotification);
        

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
            const { toUserId, content, drawingDataUrl } = data;

            if (!toUserId || (typeof content === "undefined" && typeof drawingDataUrl === "undefined")) {
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

            const isBlocked = await new Promise((resolve, reject) => {
              db.get(`SELECT 1 FROM blocked_users 
                WHERE (blocker_id = ? AND blocked_id = ?) 
                OR (blocker_id = ? AND blocked_id = ?) 
                LIMIT 1`,
                [senderRawId, recipientRawId, recipientRawId, senderRawId],
                (err, row) => {
                  if (err) return reject(err);
                  resolve(!!row);
                      }
                  );
              });
            
            if (isBlocked) {
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: "error", message: "You cannot message this user." }));
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
              drawingDataUrl: drawingDataUrl,
              timestamp: new Date().toISOString(),
            };
            const messageToSendString = JSON.stringify(messageDataToSend);

            await redisPublisher.publish(recipientChannel, messageToSendString);
            server.log.info(
              { sender: senderPrefixedId, recipientChannel, content, hasDrawing: !!drawingDataUrl },
              "Chat message published to Redis"
            );


            if (drawingDataUrl) {
              server.log.info({ sender: senderRawId, toUserId: recipientRawId}, "Received a message with a drawing (DB save skipped for MVP).");
            }

            //TO STORE THE METRIC IN PROMETHEUS
            chatMessagesCounter.inc({
              sender_id: senderRawId.toString(),
              receiver_id: recipientRawId.toString(),
            });


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
          } else if (data.type === 'publicMessage') {
            const senderUsername = ws.userJWTPayload?.username || 'Anonymous';
            const content = data.content;

            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return;
            }

            const publicMessagePayload = JSON.stringify({
                type: 'newPublicMessage',
                fromUsername: senderUsername,
                fromUserId: ws.authenticatedUserId,
                content: content.trim(),
                timestamp: new Date().toISOString()
            });
            
            await redisPublisher.publish('chat:general', publicMessagePayload);

          } else if (
            data.type === "PONG_ACCEPT_INVITE" ||
            data.type === "PONG_JOIN_GAME"
          ) {
            const { gameId } = data;
            server.log.info(
              {
                userId: ws.authenticatedUserId,
                gameIdAttemptingToJoin: gameId,
                type: data.type,
              },
              "ENTERING PONG_JOIN_GAME/ACCEPT_INVITE block"
            );

            if (!gameId) {
              server.log.warn(
                { userId: ws.authenticatedUserId },
                "PONG_JOIN_GAME: No gameId provided."
              );
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  message: "Missing gameId.",
                })
              );
              return;
            }

            server.log.info(
              { userId: ws.authenticatedUserId, gameId },
              "PONG_JOIN_GAME: Fetching gameInstance..."
            );
            const gameInstance = pongActiveGames.get(gameId);

            if (!gameInstance) {
              server.log.warn(
                { userId: ws.authenticatedUserId, gameId },
                "PONG_JOIN_GAME: gameInstance not found in pongActiveGames."
              );
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  gameId,
                  message: "Game not found.",
                })
              );
              return;
            }
            server.log.info(
              {
                userId: ws.authenticatedUserId,
                gameId,
                gameInstanceKeys: Object.keys(gameInstance),
              },
              "PONG_JOIN_GAME: gameInstance found."
            );

            if (!gameInstance.players) {
              server.log.error(
                { userId: ws.authenticatedUserId, gameId },
                "PONG_JOIN_GAME: gameInstance.players is undefined or null!"
              );
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  gameId,
                  message: "Game data error (no players).",
                })
              );
              return; // Critical error
            }
            server.log.info(
              {
                userId: ws.authenticatedUserId,
                gameId,
                playerKeysInGame: Object.keys(gameInstance.players),
              },
              "PONG_JOIN_GAME: Players in gameInstance."
            );

            if (
              gameInstance.players[ws.authenticatedUserId]?.id !==
              ws.authenticatedUserId
            ) {
              server.log.warn(
                {
                  userId: ws.authenticatedUserId,
                  gameId,
                  expectedPlayers: gameInstance.players,
                },
                "PONG_JOIN_GAME: User is not a listed player for this game."
              );
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  gameId,
                  message: "Not a player in this game.",
                })
              );
              return;
            }
            server.log.info(
              { userId: ws.authenticatedUserId, gameId },
              "PONG_JOIN_GAME: Player verified as part of game."
            );

            if (!pongGameConnections.has(gameId)) {
              pongGameConnections.set(gameId, new Set());
            }
            pongGameConnections.get(gameId).add(ws);
            ws.currentGameId = gameId;
            server.log.info(
              {
                userId: ws.authenticatedUserId,
                gameId,
                connectionsInRoom: pongGameConnections.get(gameId).size,
              },
              `User joined Pong game stream. pongGameConnections updated.`
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
                    player1Id: gameInstance.player1Id,
                    player2Id: gameInstance.player2Id,
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
          } else if (data.type === "PONG_PLAYER_READY") {
            const { gameId } = data;
            const playerPrefixedId = ws.authenticatedUserId; // This is "user_X"

            if (!gameId) {
              server.log.warn(
                { userId: playerPrefixedId },
                "PONG_PLAYER_READY: No gameId provided."
              );
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  message: "Missing gameId for ready signal.",
                })
              );
              return;
            }

            const gameInstance = pongActiveGames.get(gameId);
            if (!gameInstance) {
              server.log.warn(
                { userId: playerPrefixedId, gameId },
                "PONG_PLAYER_READY: gameInstance not found."
              );
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  gameId,
                  message: "Game not found for ready signal.",
                })
              );
              return;
            }
            if (gameInstance.players[playerPrefixedId]) {
              if (gameInstance.players[playerPrefixedId].isReady) {
                server.log.info(
                  { userId: playerPrefixedId, gameId },
                  "PONG_PLAYER_READY: Player already marked as ready."
                );
              } else {
                gameInstance.players[playerPrefixedId].isReady = true;
                server.log.info(
                  {
                    userId: playerPrefixedId,
                    gameId,
                    playerReadyState: gameInstance.players[playerPrefixedId],
                  },
                  `Player marked as ready.`
                );
              }
            } else {
              server.log.warn(
                { userId: playerPrefixedId, gameId },
                "PONG_PLAYER_READY: Player not found in this game instance."
              );
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  gameId,
                  message: "You are not a player in this game.",
                })
              );
            }
          } else if (data.type === "PONG_INVITE_DECLINED") {
            const { gameId, inviterId } = data;
            const declinerUsername = userJWTPayload.username;

            if (!gameId || !inviterId) {
              server.log.warn(
                { userId: ws.authenticatedUserId, data },
                "PONG_INVITE_DECLINED: Missing gameId or inviterId."
              );
              ws.send(
                JSON.stringify({
                  type: "PONG_ERROR",
                  message: "Invalid decline message.",
                })
              );
              return;
            }

            const gameInstance = pongActiveGames.get(gameId);
            if (gameInstance) {
              if (
                gameInstance.status === "waiting_for_ready" ||
                gameInstance.status === "initializing"
              ) {
                server.log.info(
                  {
                    gameId,
                    decliner: ws.authenticatedUserId,
                    inviter: inviterId,
                  },
                  "PONG_INVITE_DECLINED: Processing decline, stopping game."
                );
                stopGame(gameId);

                let inviterNumericId = null;
                if (
                  typeof inviterId === "string" &&
                  inviterId.startsWith("user_")
                ) {
                  inviterNumericId = parseInt(inviterId.substring(5), 10);
                } else {
                  inviterNumericId = parseInt(inviterId, 10);
                }

                if (inviterNumericId && !isNaN(inviterNumericId)) {
                  const inviterChannel = `user:${inviterNumericId}:messages`;
                  const declineNotification = {
                    type: "PONG_INVITE_WAS_DECLINED",
                    gameId: gameId,
                    declinedByUsername: declinerUsername,
                  };
                  await redisPublisher.publish(
                    inviterChannel,
                    JSON.stringify(declineNotification)
                  );
                  server.log.info(
                    { inviterChannel, payload: declineNotification },
                    "Notified inviter of declined Pong invitation."
                  );
                } else {
                  server.log.warn(
                    { inviterIdReceived: inviterId },
                    "Could not parse numeric ID for inviter to send decline notification."
                  );
                }
              } else {
                server.log.info(
                  { gameId, status: gameInstance.status },
                  "PONG_INVITE_DECLINED: Game already started or finished, decline ignored."
                );
              }
            } else {
              server.log.warn(
                { gameId },
                "PONG_INVITE_DECLINED: Game instance not found, perhaps already cleaned up."
              );
            }
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


          await redisPublisher.srem('online_users', ws.authenticatedUserId);
          
          const userOfflineNotification = JSON.stringify({
              type: "userOffline",
              user: { id: ws.authenticatedUserId, username: ws.userJWTPayload?.username }
          });
          await redisPublisher.publish('chat:status', userOfflineNotification);


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
    if (!token) return reply.code(401).send({ error: "Unauthorized" });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const currentUserRawId = payload.userId;
        const redisPublisher = getRedisPublisher();

        const onlineUserPrefixedIds = await redisPublisher.smembers('online_users');

        const iHaveBlockedRows = await new Promise((resolve, reject) => {
            db.all('SELECT blocked_id FROM blocked_users WHERE blocker_id = ?', [currentUserRawId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        const iHaveBlockedSet = new Set(iHaveBlockedRows.map(r => r.blocked_id));

        const whoHaveBlockedMeRows = await new Promise((resolve, reject) => {
            db.all('SELECT blocker_id FROM blocked_users WHERE blocked_id = ?', [currentUserRawId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        const whoHaveBlockedMeSet = new Set(whoHaveBlockedMeRows.map(r => r.blocker_id));

        const allUsersFromDB = await new Promise((resolve, reject) => {
            db.all("SELECT id, username, picture FROM users WHERE id != ?", [currentUserRawId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        
            const usersWithStatus = allUsersFromDB.map(user => {
            const prefixedId = `user_${user.id}`;
            const isBlockedByMe = iHaveBlockedSet.has(user.id);
            const hasBlockedMe = whoHaveBlockedMeSet.has(user.id);
            const isInteractionBlocked = isBlockedByMe || hasBlockedMe;
            
            return {
                id: prefixedId,
                username: user.username,
                picture: user.picture,
                isOnline: onlineUserPrefixedIds.includes(prefixedId) && !isInteractionBlocked,
                isBlockedByMe: isBlockedByMe
            };
        });

        reply.send(usersWithStatus);

    } catch (err) {
        server.log.error({ err }, "/api/chat/users error");
        reply.code(500).send({ error: "Server error" });
    }
});

}

export default fp(chatRoutes, {
  fastify: "^5.x",
  name: "chat-plugin",
});

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
