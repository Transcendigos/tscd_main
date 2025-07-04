// backend/chat.js

import jwt from "jsonwebtoken";
import { getDB } from "./db.js";
import fp from "fastify-plugin";
import { getRedisPublisher, createNewRedisSubscriber } from "./redis.js";
import {
  startGame,
  stopGame,
  handlePlayerInput,
  activeGames as pongActiveGames,
  generateGameId,
  isPlayerInActiveGame
} from "./pong_server.js";
import { chatMessagesCounter } from './monitoring.js';
import { processGameCompletion } from "./tournament_logic.js";


const activeConnections = new Map();
const userSubscribers = new Map();
const pongGameConnections = new Map();
const matchReadyState = new Map();

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
    if (statePayload.type === 'PONG_GAME_OVER' && statePayload.winnerId) {
        (async () => {
            try {
                const db = getDB();
                const match = await new Promise((res, rej) => 
                    db.get('SELECT id FROM tournament_matches WHERE game_id = ?', [gameId], (err, row) => err ? rej(err) : res(row))
                );
                
                const gameMode = match ? 'Tournament' : '1v1 Remote';

                await processGameCompletion(gameId, statePayload.winnerId, statePayload.finalScores, gameMode);
            } catch (err) {
                server.log.error({ err, gameId }, "Error processing game completion.");
            }
        })();
    }
    const connections = pongGameConnections.get(gameId);
    if (connections) {
      // server.log.info(
      //   { gameId, connectionCount: connections.size, type: statePayload.type },
      //   "Broadcasting to connections ================="
      // );
      const payloadString = JSON.stringify(statePayload);
      connections.forEach((ws) => {
        if (ws.readyState === 1) {
          try {
            ws.send(payloadString);
            // server.log.info(
            //   {
            //     gameId,
            //     userId: ws.authenticatedUserId,
            //     type: statePayload.type,
            //   },
            //   "Message sent to client"
            // );
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
        "No connections found for this gameId to broadcast to."
      );
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
        const payload = jwt.verify(token, server.jwt_secret);
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
            oldSocket.close(4001, "New connection established, this one is being closed.");
          }
        }
        activeConnections.set(prefixedAuthenticatedUserId, ws);

        if (userSubscribers.has(rawAuthenticatedUserId)) {
            const oldSub = userSubscribers.get(rawAuthenticatedUserId);
            userSubscribers.delete(rawAuthenticatedUserId);
            await oldSub.quit();
            server.log.info({ userId: rawAuthenticatedUserId }, "Old Redis subscriber quit successfully.");
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
        ws.send(JSON.stringify({ type: "error", message: "Not authenticated." }));
        ws.close(1008, "Policy Violation: Unauthenticated message");
        return;
    }

    const messageString = messageBuffer.toString();
    let data;
    try {
        data = JSON.parse(messageString);
    } catch (parseError) {
        server.log.warn({ rawMessage: messageString, error: parseError, userId: rawAuthenticatedUserId, }, "WebSocket: Received non-JSON message");
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid message format." }));
        }
        return;
    }

    server.log.info({ userId: rawAuthenticatedUserId, parsedData: data }, ">>> WebSocket: Parsed message data (post-auth).");

    try {
        if (data.type === "privateMessage") {
            const senderRawId = ws.rawAuthenticatedUserId;
            const senderPrefixedId = ws.authenticatedUserId;
            const { toUserId, content, drawingDataUrl } = data;

            if (!toUserId || (typeof content === "undefined" && typeof drawingDataUrl === "undefined")) {
              if (ws.readyState === 1) { ws.send(JSON.stringify({ type: "error", message: "Missing toUserId or content." })); }
              return;
            }
            const recipientRawId = parseInt(toUserId, 10);
            if (isNaN(recipientRawId)) {
              if (ws.readyState === 1) { ws.send(JSON.stringify({ type: "error", message: "Invalid recipient ID."})); }
              return;
            }
            const isBlocked = await new Promise((resolve, reject) => {
              db.get(`SELECT 1 FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1`,
                [senderRawId, recipientRawId, recipientRawId, senderRawId],
                (err, row) => { if (err) return reject(err); resolve(!!row); });
            });
            if (isBlocked) {
                if (ws.readyState === 1) { ws.send(JSON.stringify({ type: "error", message: "You cannot message this user." }));}
                return;
            }
            const recipientChannel = `user:${recipientRawId}:messages`;
            const messageDataToSend = { type: "newMessage", fromUserId: senderPrefixedId, fromUsername: userJWTPayload.username, toUserId: `user_${recipientRawId}`, content: content, drawingDataUrl: drawingDataUrl, timestamp: new Date().toISOString() };
            await redisPublisher.publish(recipientChannel, JSON.stringify(messageDataToSend));
            chatMessagesCounter.inc({ sender_id: senderRawId.toString(), receiver_id: recipientRawId.toString() });
            db.run("INSERT INTO chat_messages (sender_id, receiver_id, message_content) VALUES (?, ?, ?)", [senderRawId, recipientRawId, content], function (dbErr) { /* ... */ });

        } else if (data.type === 'publicMessage') {
            const senderUsername = ws.userJWTPayload?.username || 'Anonymous';
            const content = data.content;
            if (!content || typeof content !== 'string' || content.trim().length === 0) { return; }
            const publicMessagePayload = JSON.stringify({ type: 'newPublicMessage', fromUsername: senderUsername, fromUserId: ws.authenticatedUserId, content: content.trim(), timestamp: new Date().toISOString() });
            await redisPublisher.publish('chat:general', publicMessagePayload);

        } else if (data.type === "PONG_ACCEPT_INVITE") {
            const { inviterId, inviterUsername } = data;
            const inviteeId = ws.authenticatedUserId;
            const inviteeUsername = ws.userJWTPayload.username;

            if (isPlayerInActiveGame(inviterId) || isPlayerInActiveGame(inviteeId)) {
                ws.send(JSON.stringify({ type: "PONG_ERROR", message: "A player is already in a game." }));
                const inviterWs = activeConnections.get(inviterId);
                if (inviterWs && inviterWs.readyState === 1) { inviterWs.send(JSON.stringify({ type: "PONG_ERROR", message: "Your opponent accepted an invite but one of you is already in a game." }));}
                return;
            }
            
            const inviterWs = activeConnections.get(inviterId);
            if (!inviterWs || inviterWs.readyState !== 1) {
                ws.send(JSON.stringify({ type: "PONG_ERROR", message: "Inviter is no longer online." }));
                return;
            }
            const gameId = generateGameId();
            const gameOptions = { canvasWidth: 800, canvasHeight: 600, winningScore: 5, player1Username: inviterUsername, player2Username: inviteeUsername };
            const newGame = startGame(gameId, inviterId, inviteeId, gameOptions, server.broadcastPongGameState);
            if (newGame) {
                const gameConnections = new Set([ws, inviterWs]);
                pongGameConnections.set(gameId, gameConnections);
                ws.currentGameId = gameId;
                inviterWs.currentGameId = gameId;
                
                const cleanInitialState = { gameId: newGame.gameId, players: newGame.players, ball: newGame.ball, status: newGame.status, canvasWidth: newGame.canvasWidth, canvasHeight: newGame.canvasHeight, ballStartX: newGame.ballStartX, ballStartY: newGame.ballStartY, paddleStartY: newGame.paddleStartY, winningScore: newGame.winningScore, player1Id: newGame.player1Id, player2Id: newGame.player2Id };
                gameConnections.forEach(clientWs => {
                    const yourPlayerId = clientWs.authenticatedUserId;
                    const opponentId = (yourPlayerId === inviterId) ? inviteeId : inviterId;
                    const opponentUsername = (yourPlayerId === inviterId) ? inviteeUsername : inviterUsername;
                    const payloadWithPlayerInfo = { type: "PONG_GAME_STARTED", gameId, initialState: cleanInitialState, yourPlayerId, opponentId, opponentUsername };
                    clientWs.send(JSON.stringify(payloadWithPlayerInfo));
                });
            } else {
                ws.send(JSON.stringify({ type: "PONG_ERROR", message: "Failed to create game session." }));
                if (inviterWs) { inviterWs.send(JSON.stringify({ type: "PONG_ERROR", message: "Failed to create game session with opponent." })); }
            }

        } else if (data.type === "PONG_PLAYER_INPUT") {
            const { gameId, input } = data;
            if (!gameId || typeof input === "undefined" || ws.currentGameId !== gameId) { return; }
            handlePlayerInput(gameId, ws.authenticatedUserId, input);

        } else if (data.type === "PONG_PLAYER_READY") {
            const { gameId } = data;
            const playerPrefixedId = ws.authenticatedUserId;
            if (!gameId) { return; }
            const gameInstance = pongActiveGames.get(gameId);
            if (gameInstance && gameInstance.players[playerPrefixedId]) {
                gameInstance.players[playerPrefixedId].isReady = true;
            }

        } else if (data.type === 'PONG_LEAVE_GAME') {
            const { gameId } = data;
            const leavingPlayerId = ws.authenticatedUserId;
            const connections = pongGameConnections.get(gameId);
            const gameInstance = pongActiveGames.get(gameId);
            if (connections && gameInstance) {
                connections.delete(ws);
                if (connections.size === 1) {
                    const remainingPlayerWs = connections.values().next().value;
                    const winnerId = remainingPlayerWs.authenticatedUserId;
                    const scores = { [winnerId]: gameInstance.players[winnerId]?.score || 0, [leavingPlayerId]: gameInstance.players[leavingPlayerId]?.score || 0, };
                    if (remainingPlayerWs.readyState === 1) {
                        remainingPlayerWs.send(JSON.stringify({ type: 'PONG_GAME_OVER', gameId, winnerId, scores, reason: 'Opponent left the match.' }));
                    }
                }
                stopGame(gameId);
                pongGameConnections.delete(gameId);
            }

        } else if (data.type === "PONG_INVITE_DECLINED") {
            const { inviterId } = data;
            const declinerUsername = userJWTPayload.username;
            if (!inviterId) { return; }
            let inviterNumericId = null;
            if (typeof inviterId === "string" && inviterId.startsWith("user_")) { inviterNumericId = parseInt(inviterId.substring(5), 10); } 
            else { inviterNumericId = parseInt(inviterId, 10); }

            if (inviterNumericId && !isNaN(inviterNumericId)) {
                const inviterChannel = `user:${inviterNumericId}:messages`;
                const declineNotification = { type: "PONG_INVITE_WAS_DECLINED", declinedByUsername: declinerUsername };
                await redisPublisher.publish(inviterChannel, JSON.stringify(declineNotification));
            }
            
        } else if (data.type === 'PLAYER_READY_FOR_MATCH') {
            const { matchId } = data;
            const userId = ws.rawAuthenticatedUserId;

            if (!matchReadyState.has(matchId)) {
                matchReadyState.set(matchId, new Set());
            }
            const readyPlayers = matchReadyState.get(matchId);
            readyPlayers.add(userId);
            
            server.log.info({ matchId, userId, readyCount: readyPlayers.size }, "Player is ready for tournament match");

            if (readyPlayers.size === 2) {
                server.log.info({ matchId }, "Both players ready. Starting tournament game.");

                const match = await new Promise((res, rej) => db.get('SELECT * FROM tournament_matches WHERE id = ?', [matchId], (err, row) => err ? rej(err) : res(row)));
                
                if (match && match.status === 'pending') {
                    const player1Id = `user_${match.player1_id}`;
                    const player2Id = `user_${match.player2_id}`;

                    const player1Ws = activeConnections.get(player1Id);
                    const player2Ws = activeConnections.get(player2Id);

                    if (!player1Ws || !player2Ws) {
                        server.log.error({ matchId, p1_online: !!player1Ws, p2_online: !!player2Ws }, "One or more tournament players are not connected.");
                        matchReadyState.delete(matchId);
                        return;
                    }

                    const p1 = await new Promise((res, rej) => db.get('SELECT username FROM users WHERE id = ?', [match.player1_id], (err, row) => err ? rej(err) : res(row)));
                    const p2 = await new Promise((res, rej) => db.get('SELECT username FROM users WHERE id = ?', [match.player2_id], (err, row) => err ? rej(err) : res(row)));

                    const gameId = generateGameId();
                    const gameOptions = { canvasWidth: 800, canvasHeight: 600, winningScore: 5, player1Username: p1.username, player2Username: p2.username };
                    const newGame = startGame(gameId, player1Id, player2Id, gameOptions, server.broadcastPongGameState);

                    if (newGame) {
                        const gameConnections = new Set([player1Ws, player2Ws]);
                        pongGameConnections.set(gameId, gameConnections);
                        player1Ws.currentGameId = gameId;
                        player2Ws.currentGameId = gameId;

                        await new Promise((res, rej) => db.run('UPDATE tournament_matches SET status = ?, game_id = ? WHERE id = ?', ['in_progress', gameId, matchId], (err) => err ? rej(err) : res()));
                        
                        const cleanInitialState = { gameId: newGame.gameId, players: newGame.players, ball: newGame.ball, status: newGame.status, canvasWidth: newGame.canvasWidth, canvasHeight: newGame.canvasHeight, ballStartX: newGame.ballStartX, ballStartY: newGame.ballStartY, paddleStartY: newGame.paddleStartY, winningScore: newGame.winningScore, player1Id: newGame.player1Id, player2Id: newGame.player2Id };
                        
                        gameConnections.forEach(clientWs => {
                            const yourPlayerId = clientWs.authenticatedUserId;
                            const opponentId = (yourPlayerId === player1Id) ? player2Id : player1Id;
                            const opponentUsername = (yourPlayerId === player1Id) ? p2.username : p1.username;
                            clientWs.send(JSON.stringify({ type: "PONG_GAME_STARTED", gameId, initialState: cleanInitialState, yourPlayerId, opponentId, opponentUsername }));
                        });
                        
                        // TODO: Broadcast a BRACKET_UPDATE to all tournament participants
                    }
                    
                    matchReadyState.delete(matchId);
                }
            }
        } else {
            server.log.warn({ userId: ws.authenticatedUserId, data }, "Unhandled WebSocket message type.");
        }
    } catch (error) {
        server.log.error({ error: error.message, raw: messageString, userId: ws.authenticatedUserId, }, "WebSocket message processing error.");
    }
});


      ws.on("close", async (code, reason) => {
        const reasonString = reason ? reason.toString() : "N/A";
        server.log.info(
          { userId: ws.authenticatedUserId, code, reason: reasonString },
          `WebSocket client disconnected.`
        );
        if (ws.authenticatedUserId) {
          if (ws.currentGameId && pongGameConnections.has(ws.currentGameId)) {
            const connections = pongGameConnections.get(ws.currentGameId);
            const gameInstance = pongActiveGames.get(ws.currentGameId);
            connections.delete(ws);

            if (connections.size === 1 && gameInstance) {
              const remainingPlayerWs = connections.values().next().value;
              const winnerId = remainingPlayerWs.authenticatedUserId;
              const disconnectedPlayerId = ws.authenticatedUserId;

              server.log.info(
                { gameId: ws.currentGameId, winner: winnerId, disconnected: disconnectedPlayerId },
                `Pong player disconnected. Declaring winner.`
              );

              const scores = {
                [winnerId]: gameInstance.players[winnerId]?.score || 0,
                [disconnectedPlayerId]: gameInstance.players[disconnectedPlayerId]?.score || 0
              };
              
              if (remainingPlayerWs.readyState === 1) {
                remainingPlayerWs.send(JSON.stringify({
                  type: 'PONG_GAME_OVER',
                  gameId: ws.currentGameId,
                  winnerId: winnerId,
                  scores: scores,
                  reason: `Opponent disconnected.`
                }));
              }
              
              pongGameConnections.delete(ws.currentGameId);
              stopGame(ws.currentGameId); //

            } else if (connections.size === 0) {
              pongGameConnections.delete(ws.currentGameId);
              server.log.info(
                { gameId: ws.currentGameId },
                `All players disconnected from Pong game. Cleaning up game state.`
              );
              stopGame(ws.currentGameId); //
            }
          }

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
      const payload = jwt.verify(token, server.jwt_secret);
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
        const payload = jwt.verify(token, server.jwt_secret);
        const currentUserRawId = payload.userId;
        const redisPublisher = getRedisPublisher();

        const onlineUserPrefixedIds = await redisPublisher.smembers('online_users');

        // Fetch users I have blocked
        const iHaveBlockedRows = await new Promise((resolve, reject) => {
            db.all('SELECT blocked_id FROM blocked_users WHERE blocker_id = ?', [currentUserRawId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        const iHaveBlockedSet = new Set(iHaveBlockedRows.map(r => r.blocked_id));

        // Fetch users who have blocked me
        const whoHaveBlockedMeRows = await new Promise((resolve, reject) => {
            db.all('SELECT blocker_id FROM blocked_users WHERE blocked_id = ?', [currentUserRawId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        const whoHaveBlockedMeSet = new Set(whoHaveBlockedMeRows.map(r => r.blocker_id));

        const friendsRows = await new Promise((resolve, reject) => {
            db.all('SELECT friend_id FROM friends WHERE user_id = ?', [currentUserRawId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        const friendsSet = new Set(friendsRows.map(r => r.friend_id));

        // Fetch all users except myself
        const allUsersFromDB = await new Promise((resolve, reject) => {
            db.all("SELECT id, username, picture FROM users WHERE id != ?", [currentUserRawId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        // Map all data together
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
                isBlockedByMe: isBlockedByMe,
                isFriend: friendsSet.has(user.id)
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