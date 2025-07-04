// backend/stats_routes.js

import { getDB } from "./db.js";
import jwt from "jsonwebtoken";

export default async function statsRoutes(server, options) {
    const db = getDB();

    function getTargetUserId(req) {
        if (req.params.userId) {
            return parseInt(req.params.userId.replace('user_', ''), 10);
        }
        return null;
    }

    server.get("/api/stats/summary/:userId?", async (req, reply) => {
        const targetUserId = getTargetUserId(req);
        if (!targetUserId || isNaN(targetUserId)) {
            return reply.code(400).send({ error: "Invalid or missing user ID." });
        }

        try {
            const matches = await new Promise((res, rej) => {
                db.all('SELECT winner_id, player1_id, player2_id FROM match_history WHERE player1_id = ? OR player2_id = ?', [targetUserId, targetUserId], (err, rows) => err ? rej(err) : res(rows));
            });

            let wins = 0;
            let losses = 0;
            matches.forEach(match => {
                if (match.winner_id === targetUserId) {
                    wins++;
                } else {
                    losses++;
                }
            });
            
            const tournamentsWon = await new Promise((res, rej) => {
                db.get('SELECT COUNT(*) as count FROM tournaments WHERE winner_id = ?', [targetUserId], (err, row) => err ? rej(err) : res(row.count || 0));
            });

            const totalGames = wins + losses;
            const winRatio = totalGames > 0 ? (wins / totalGames).toFixed(2) : "0.00";

            reply.send({
                wins,
                losses,
                winRatio,
                totalGames,
                tournamentsWon
            });

        } catch (error) {
            server.log.error({ err: error, userId: targetUserId }, "Failed to fetch stats summary");
            reply.code(500).send({ error: "Server error fetching stats summary." });
        }
    });

    server.get("/api/stats/match-history/:userId?", async (req, reply) => {
        const targetUserId = getTargetUserId(req);
        if (!targetUserId || isNaN(targetUserId)) {
            return reply.code(400).send({ error: "Invalid or missing user ID." });
        }

        try {
            const history = await new Promise((resolve, reject) => {
                const sql = `
                    SELECT
                        h.id, h.game_mode, h.player1_id, h.player2_id, h.player1_score, h.player2_score, h.winner_id, h.played_at,
                        p1.username as player1_name,
                        p2.username as player2_name
                    FROM match_history h
                    JOIN users p1 ON h.player1_id = p1.id
                    JOIN users p2 ON h.player2_id = p2.id
                    WHERE h.player1_id = ? OR h.player2_id = ?
                    ORDER BY h.played_at DESC
                    LIMIT 20
                `;
                db.all(sql, [targetUserId, targetUserId], (err, rows) => {
                    if (err) return reject(err);
                    
                    const processedRows = rows.map(row => {
                        const isPlayer1 = row.player1_id === targetUserId;
                        return {
                            id: row.id,
                            mode: row.game_mode,
                            opponent: isPlayer1 ? row.player2_name : row.player1_name,
                            yourScore: isPlayer1 ? row.player1_score : row.player2_score,
                            opponentScore: isPlayer1 ? row.player2_score : row.player1_score,
                            result: row.winner_id === targetUserId ? 'Win' : 'Loss',
                            date: row.played_at
                        };
                    });
                    resolve(processedRows);
                });
            });

            reply.send(history);
        } catch (error) {
            server.log.error({ err: error, userId: targetUserId }, "Failed to fetch match history");
            reply.code(500).send({ error: "Server error fetching match history." });
        }
    });
}