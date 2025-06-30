// backend/tournament_routes.js

import { getDB } from "./db.js";
import jwt from "jsonwebtoken";
import { getRedisPublisher } from "./redis.js";

// Helper function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export default async function tournamentRoutes(server, options) {
    const db = getDB();
    const redisPublisher = getRedisPublisher();

    // Endpoint to Create a new tournament
    server.post("/api/tournaments", async (req, reply) => {
        const token = req.cookies.auth_token;
        if (!token) {
            return reply.code(401).send({ error: "Authentication required." });
        }
        let decoded;
        try {
            decoded = jwt.verify(token, server.jwt_secret);
        } catch (err) {
            return reply.code(401).send({ error: "Invalid token." });
        }
        const { name, size } = req.body;
        if (!name || !size || ![4, 8].includes(parseInt(size, 10))) {
            return reply.code(400).send({ error: "Invalid tournament name or size. Size must be 4 or 8." });
        }
        const creatorId = decoded.userId;

        try {
            const result = await new Promise((resolve, reject) => {
                db.run('INSERT INTO tournaments (name, size, creator_id) VALUES (?, ?, ?)', [name, size, creatorId], function (err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID });
                });
            });
            const tournamentId = result.id;
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO tournament_participants (tournament_id, user_id, join_order) VALUES (?, ?, ?)', [tournamentId, creatorId, 1], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            const lobbyUpdatePayload = JSON.stringify({ type: 'TOURNAMENT_LOBBY_UPDATE' });
            await redisPublisher.publish('chat:general', lobbyUpdatePayload);

            server.log.info({ tournamentId, name, creator: creatorId }, "New tournament created");
            reply.code(201).send({ message: "Tournament created successfully", tournamentId });

        } catch (error) {
            server.log.error({ err: error }, "Failed to create tournament");
            reply.code(500).send({ error: "Failed to create tournament." });
        }
    });

    // Endpoint to List all waiting and in-progress tournaments
    server.get("/api/tournaments", async (req, reply) => {
        const token = req.cookies.auth_token;
        let currentUserId = null;
        if (token) {
            try {
                const decoded = jwt.verify(token, server.jwt_secret);
                currentUserId = decoded.userId;
            } catch (err) { /* Treat as guest */ }
        }

        try {
            const tournaments = await new Promise((resolve, reject) => {
                const sql = `
                    SELECT
                        t.id,
                        t.name,
                        t.size,
                        t.status,
                        u.username as creator_username,
                        (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id) as player_count,
                        (SELECT 1 FROM tournament_participants WHERE tournament_id = t.id AND user_id = ?) as is_participant
                    FROM tournaments t
                    JOIN users u ON t.creator_id = u.id
                    WHERE t.status = 'waiting' OR t.status = 'in_progress'
                    ORDER BY t.created_at DESC
                `;
                db.all(sql, [currentUserId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });
            reply.send(tournaments);
        } catch (error) {
            server.log.error({ err: error }, "Failed to fetch tournaments");
            reply.code(500).send({ error: "Failed to fetch tournaments." });
        }
    });
    
    // Endpoint for a user to join a tournament
    server.post("/api/tournaments/:id/join", async (req, reply) => {
        const token = req.cookies.auth_token;
        if (!token) { return reply.code(401).send({ error: "Authentication required." }); }
        let decoded;
        try { decoded = jwt.verify(token, server.jwt_secret); } catch (err) { return reply.code(401).send({ error: "Invalid token." });}
        const tournamentId = parseInt(req.params.id, 10);
        if (isNaN(tournamentId)) { return reply.code(400).send({ error: "Invalid tournament ID." });}
        const userId = decoded.userId;

        try {
            let tournamentIsNowFull = false;
            let allParticipants = [];

            await new Promise((resolve, reject) => {
                db.serialize(async () => {
                    try {
                        db.run('BEGIN TRANSACTION');
                        const tournament = await new Promise((res, rej) => db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId], (err, row) => err ? rej(err) : res(row)));
                        if (!tournament) throw new Error("Tournament not found.");
                        if (tournament.status !== 'waiting') throw new Error("This tournament is no longer accepting players.");

                        const playerCountRow = await new Promise((res, rej) => db.get('SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?', [tournamentId], (err, row) => err ? rej(err) : res(row)));
                        const playerCount = playerCountRow.count;
                        if (playerCount >= tournament.size) throw new Error("This tournament is already full.");

                        const isParticipant = await new Promise((res, rej) => db.get('SELECT 1 FROM tournament_participants WHERE tournament_id = ? AND user_id = ?', [tournamentId, userId], (err, row) => err ? rej(err) : res(!!row)));
                        if (isParticipant) throw new Error("You have already joined this tournament.");

                        await new Promise((res, rej) => db.run('INSERT INTO tournament_participants (tournament_id, user_id, join_order) VALUES (?, ?, ?)', [tournamentId, userId, playerCount + 1], (err) => err ? rej(err) : res()));

                        if (playerCount + 1 === tournament.size) {
                            tournamentIsNowFull = true;
                            await new Promise((res, rej) => db.run('UPDATE tournaments SET status = ? WHERE id = ?', ['in_progress', tournamentId], (err) => err ? rej(err) : res()));
                            
                            allParticipants = await new Promise((res, rej) => db.all('SELECT user_id FROM tournament_participants WHERE tournament_id = ? ORDER BY join_order', [tournamentId], (err, rows) => err ? rej(err) : res(rows)));
                            const shuffledPlayers = shuffleArray(allParticipants);
                            
                            const matchInsertStmt = db.prepare('INSERT INTO tournament_matches (tournament_id, round, match_in_round, player1_id, player2_id) VALUES (?, ?, ?, ?, ?)');
                            for (let i = 0; i < shuffledPlayers.length; i += 2) {
                                const matchNumberInRound = (i / 2) + 1;
                                matchInsertStmt.run(tournamentId, 1, matchNumberInRound, shuffledPlayers[i].user_id, shuffledPlayers[i+1].user_id);
                            }
                            await new Promise((res, rej) => matchInsertStmt.finalize(err => err ? rej(err) : res()));
                        }

                        db.run('COMMIT', err => err ? reject(err) : resolve());
                    } catch (error) {
                        db.run('ROLLBACK');
                        reject(error);
                    }
                });
            });

            if (tournamentIsNowFull) {
                const startPayload = JSON.stringify({ type: 'TOURNAMENT_STARTED', tournamentId: tournamentId });
                allParticipants.forEach(p => {
                    redisPublisher.publish(`user:${p.user_id}:messages`, startPayload);
                });
                
                const firstRoundMatches = await new Promise((res, rej) => db.all('SELECT * FROM tournament_matches WHERE tournament_id = ? AND round = 1', [tournamentId], (err, rows) => err ? rej(err) : res(rows)));
                for (const match of firstRoundMatches) {
                    const readyPayload = JSON.stringify({ type: 'MATCH_READY', tournamentId, matchId: match.id });
                    redisPublisher.publish(`user:${match.player1_id}:messages`, readyPayload);
                    redisPublisher.publish(`user:${match.player2_id}:messages`, readyPayload);
                }
            } else {
                const lobbyUpdatePayload = JSON.stringify({ type: 'TOURNAMENT_LOBBY_UPDATE' });
                await redisPublisher.publish('chat:general', lobbyUpdatePayload);
            }

            reply.send({ message: "Successfully joined tournament." });

        } catch (error) {
            server.log.warn({ err: error, userId, tournamentId }, "Failed to join tournament");
            reply.code(400).send({ error: error.message });
        }
    });

    // Endpoint to get the details & bracket for a specific tournament
    server.get("/api/tournaments/:id", async (req, reply) => {
        const tournamentId = parseInt(req.params.id, 10);
        if (isNaN(tournamentId)) {
            return reply.code(400).send({ error: "Invalid tournament ID." });
        }
        try {
            const tournament = await new Promise((res, rej) => db.get('SELECT t.*, u.username as creator_username FROM tournaments t JOIN users u ON t.creator_id = u.id WHERE t.id = ?', [tournamentId], (err, row) => err ? rej(err) : res(row)));
            if (!tournament) return reply.code(404).send({ error: "Tournament not found." });
            
            const participants = await new Promise((res, rej) => db.all('SELECT p.user_id, u.username FROM tournament_participants p JOIN users u ON p.user_id = u.id WHERE p.tournament_id = ? ORDER BY p.join_order', [tournamentId], (err, rows) => err ? rej(err) : res(rows)));
            const matches = await new Promise((res, rej) => db.all('SELECT * FROM tournament_matches WHERE tournament_id = ? ORDER BY round, match_in_round', [tournamentId], (err, rows) => err ? rej(err) : res(rows)));
            
            reply.send({ ...tournament, participants, matches });
        } catch (error) {
            server.log.error({ err: error }, "Failed to fetch tournament details");
            reply.code(500).send({ error: "Server error fetching tournament details." });
        }
    });
}