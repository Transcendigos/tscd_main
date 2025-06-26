// backend/pong_routes.js

import { startGame, stopGame, activeGames, isPlayerInActiveGame } from "./pong_server.js";
import { getDB } from "./db.js";
import jwt from "jsonwebtoken";
import { getRedisPublisher } from "./redis.js";

const INVITATION_TIMEOUT_MS = 20000; // 20 seconds for invitation to expire

function generateGameId() {
  return `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export default async function pongRoutes(server, options) {
  const db = getDB();
  const redisPublisher = getRedisPublisher();
  
  server.post("/api/pong/games", async (req, reply) => {
    const inviterToken = req.cookies.auth_token;
    if (!inviterToken) {
      return reply.code(401).send({ error: "Authentication required to create a game." });
    }

    const { opponentPlayerId } = req.body; 
    if (!opponentPlayerId) {
      return reply.code(400).send({ error: "Opponent player ID is required." });
    }

    let inviterDecoded;
    let inviterUserId; 
    let inviterRawId; 

    try {
      inviterDecoded = jwt.verify(inviterToken, server.jwt_secret);
      inviterRawId = inviterDecoded.userId; 
      inviterUserId = `user_${inviterRawId}`;
    } catch (err) {
      server.log.warn({ err }, "Failed to verify inviter token for game creation");
      return reply.code(401).send({ error: "Invalid or expired inviter token." });
    }

    let opponentRawId;
    if (typeof opponentPlayerId === 'string' && opponentPlayerId.startsWith('user_')) {
        opponentRawId = parseInt(opponentPlayerId.substring(5), 10);
    } else {
        opponentRawId = parseInt(opponentPlayerId, 10); 
    }

    if (isNaN(opponentRawId)) {
        server.log.warn({ opponentPlayerIdReceived: opponentPlayerId }, "Could not parse raw numeric ID from opponentPlayerId");
        return reply.code(400).send({ error: "Invalid opponent player ID format." });
    }

    if (inviterRawId === opponentRawId) {
      return reply.code(400).send({ error: "Cannot invite yourself to a game." });
    }

    const isBlocked = await new Promise((resolve, reject) => {
        db.get(`SELECT 1 FROM blocked_users 
                WHERE (blocker_id = ? AND blocked_id = ?) 
                   OR (blocker_id = ? AND blocked_id = ?) 
                LIMIT 1`,
            [inviterRawId, opponentRawId, opponentRawId, inviterRawId],
            (err, row) => {
                if (err) return reject(err);
                resolve(!!row);
            }
        );
    });

    if (isBlocked) {
        return reply.code(403).send({ error: "Interaction with this user is blocked." });
    }

    if (isPlayerInActiveGame(inviterUserId) || isPlayerInActiveGame(`user_${opponentRawId}`)) {
        return reply.code(409).send({ error: "One or more players are already in a game." });
    }
    
    const gameId = generateGameId();
    const gameOptions = {
      canvasWidth: 800,
      canvasHeight: 600,
      winningScore: 5,
    };

    try {
      const newGame = startGame(
        gameId,
        inviterUserId, 
        `user_${opponentRawId}`, 
        {
          ...gameOptions,
          player1Username: inviterDecoded.username,
        },
        server.broadcastPongGameState
      );

      if (newGame) {
        server.log.info(
          { gameId, inviter: inviterUserId, opponent: `user_${opponentRawId}` },
          "New Pong game created via API for chat invite"
        );
        
        const opponentChannel = `user:${opponentRawId}:messages`;
        const invitationPayload = {
          type: "PONG_GAME_INVITE",
          gameId: newGame.gameId,
          inviterUsername: inviterDecoded.username,
          inviterId: inviterUserId, 
        };
        await redisPublisher.publish(
          opponentChannel,
          JSON.stringify(invitationPayload)
        );

        // --- NEW SMARTER TIMEOUT LOGIC ---
        setTimeout(async () => {
            const gameOnTimeout = activeGames.get(gameId);
            if (gameOnTimeout && gameOnTimeout.status === 'waiting_for_ready') {
                server.log.info({ gameId }, `Invitation timed out. Cleaning up.`);
                stopGame(gameId);

                const expirationPayload = JSON.stringify({
                    type: 'PONG_INVITE_EXPIRED',
                    gameId: gameId,
                    message: `The game invitation has expired.`
                });

                // Notify both the inviter and the invitee
                const inviterChannel = `user:${inviterRawId}:messages`;
                await redisPublisher.publish(inviterChannel, expirationPayload);
                await redisPublisher.publish(opponentChannel, expirationPayload);
                 server.log.info({ gameId, inviterChannel, opponentChannel }, `Sent expiration notices.`);
            }
        }, INVITATION_TIMEOUT_MS);
        // --- END NEW TIMEOUT LOGIC ---

        return reply.code(201).send({
          message: "Game created and invitation sent",
          gameId: newGame.gameId,
        });
      } else {
        server.log.error({ gameId }, "Failed to start game, startGame returned falsy");
        return reply.code(500).send({ error: "Failed to create game session." });
      }
    } catch (error) {
      server.log.error({ error, gameId }, "Error during game creation");
      return reply.code(500).send({ error: "Internal server error creating game." });
    }
  });
}