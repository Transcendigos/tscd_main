// backend/pong_routes.js

import { startGame, activeGames, isPlayerInActiveGame } from "./pong_server.js";
import { getDB } from "./db.js";
import jwt from "jsonwebtoken";
import { getRedisPublisher } from "./redis.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

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
      inviterDecoded = jwt.verify(inviterToken, JWT_SECRET);
      inviterRawId = inviterDecoded.userId; 
      inviterUserId = `user_${inviterRawId}`;
    } catch (err) {
      server.log.warn({ err }, "Failed to verify inviter token for game creation");
      return reply.code(401).send({ error: "Invalid or expired inviter token." });
    }

    // --- MOVED THIS BLOCK UP ---
    // It must be defined before it is used in the block check.
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
    // --- END MOVED BLOCK ---

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

    if (isPlayerInActiveGame(inviterUserId) || isPlayerInActiveGame(opponentPlayerId)) {
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
        opponentPlayerId, 
        {
          ...gameOptions,
          player1Username: inviterDecoded.username,
        },
        server.broadcastPongGameState
      );

      if (newGame) {
        server.log.info(
          { gameId, inviter: inviterUserId, opponent: opponentPlayerId },
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