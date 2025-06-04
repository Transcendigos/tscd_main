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
  
  console.log(`--- PONG_ROUTES.JS: typeof server.broadcastPongGameState: ${typeof server.broadcastPongGameState} ---`);

  server.post("/api/pong/games", async (req, reply) => {
    console.log(`--- PONG_ROUTES.JS /api/pong/games: typeof server.broadcastPongGameState: ${typeof server.broadcastPongGameState} ---`);
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

    if (inviterUserId === opponentPlayerId) {
      return reply.code(400).send({ error: "Cannot invite yourself to a game." });
    }

    if (isPlayerInActiveGame(inviterUserId)) {
      server.log.warn({ inviterUserId }, "Inviter attempted to create game while already in an active game.");
      return reply.code(409).send({ error: "You are already in an active game." });
    }
    
    if (isPlayerInActiveGame(opponentPlayerId)) {
      server.log.warn({ opponentPlayerId }, "Attempted to invite player who is already in an active game.");
      return reply.code(409).send({ error: "Opponent is currently in another game." });
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
        server.log.info(
          { channel: opponentChannel, payload: invitationPayload },
          "Published game invitation to opponent"
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