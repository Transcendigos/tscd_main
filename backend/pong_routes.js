// backend/pong_routes.js

import { isPlayerInActiveGame } from "./pong_server.js";
import { getDB } from "./db.js";
import jwt from "jsonwebtoken";
import { getRedisPublisher } from "./redis.js";

export default async function pongRoutes(server, options) {
  const db = getDB();
  const redisPublisher = getRedisPublisher();
  
  server.post("/api/pong/games", async (req, reply) => {
    const inviterToken = req.cookies.auth_token;
    if (!inviterToken) {
      return reply.code(401).send({ error: "Authentication required to send an invitation." });
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
      server.log.warn({ err }, "Failed to verify inviter token for invitation");
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
    
    try {
        const opponentChannel = `user:${opponentRawId}:messages`;
        const invitationPayload = {
          type: "PONG_GAME_INVITE",
          inviterUsername: inviterDecoded.username,
          inviterId: inviterUserId, 
        };
        await redisPublisher.publish(
          opponentChannel,
          JSON.stringify(invitationPayload)
        );

        server.log.info(
          { inviter: inviterUserId, opponent: `user_${opponentRawId}` },
          "Pong game invitation sent via API"
        );

        return reply.code(200).send({
          message: "Invitation sent successfully",
        });

    } catch (error) {
      server.log.error({ error }, "Error sending game invitation");
      return reply.code(500).send({ error: "Internal server error sending invitation." });
    }
  });
}