// backend/tournament_logic.js

import { getDB } from "./db.js";
import { getRedisPublisher } from "./redis.js";

export async function processGameCompletion(gameId, winnerPrefixedId, finalScores, gameMode) {
    const db = getDB();
    const redisPublisher = getRedisPublisher();

    console.log(`[Stats] Starting processGameCompletion for gameId: ${gameId}, Winner: ${winnerPrefixedId}`);

    if (!finalScores) {
        console.error(`[Stats] CRITICAL: finalScores object was not provided. No stats will be saved.`);
        return;
    }
    
    // Get player IDs and scores from the keys and values of the finalScores object
    const [p1_prefixedId, p2_prefixedId] = Object.keys(finalScores);
    const p1_score = finalScores[p1_prefixedId];
    const p2_score = finalScores[p2_prefixedId];

    const player1_id = parseInt(p1_prefixedId.replace('user_', ''), 10);
    const player2_id = parseInt(p2_prefixedId.replace('user_', ''), 10);
    const winner_id = parseInt(winnerPrefixedId.replace('user_', ''), 10);
    
    if (isNaN(player1_id) || isNaN(player2_id) || isNaN(winner_id)) {
        console.error(`[Stats] CRITICAL: Failed to parse one or more IDs. Aborting save.`);
        return;
    }
    
    const match = await new Promise((res, rej) => db.get('SELECT * FROM tournament_matches WHERE game_id = ?', [gameId], (err, row) => err ? rej(err) : res(row)));
    
    const sql = `INSERT INTO match_history (game_mode, player1_id, player2_id, player1_score, player2_score, winner_id, tournament_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        gameMode,
        player1_id,
        player2_id,
        p1_score,
        p2_score,
        winner_id,
        match ? match.tournament_id : null
    ];
    
    console.log(`[Stats] Executing SQL: ${sql} with PARAMS:`, params);

    await new Promise((res, rej) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error("[Stats] CRITICAL: SQL Error saving to match_history:", err);
                return rej(err);
            }
            console.log(`[Stats] Successfully inserted into match_history. New row ID: ${this.lastID}`);
            res();
        });
    });

    if (match && match.status !== 'finished') {
        console.log(`[Stats] Continuing with tournament logic for match ID: ${match.id}`);
        const tournamentId = match.tournament_id;
        await new Promise((res, rej) => db.run('UPDATE tournament_matches SET winner_id = ?, status = ? WHERE id = ?', [winner_id, 'finished', match.id], (err) => err ? rej(err) : res()));
        const participants = await new Promise((res, rej) => db.all('SELECT user_id FROM tournament_participants WHERE tournament_id = ?', [tournamentId], (err, rows) => err ? rej(err) : res(rows)));
        const bracketUpdatePayload = JSON.stringify({ type: 'BRACKET_UPDATE', tournamentId });
        participants.forEach(p => { redisPublisher.publish(`user:${p.user_id}:messages`, bracketUpdatePayload); });
        const currentRoundMatches = await new Promise((res, rej) => db.all('SELECT * FROM tournament_matches WHERE tournament_id = ? AND round = ?', [tournamentId, match.round], (err, rows) => err ? rej(err) : res(rows)));
        const allRoundMatchesFinished = currentRoundMatches.every(m => m.status === 'finished');
        if (allRoundMatchesFinished) {
            const winners = currentRoundMatches.map(m => ({ winner_id: m.winner_id })).sort(() => Math.random() - 0.5);
            if (winners.length === 1) {
                await new Promise((res, rej) => db.run('UPDATE tournaments SET status = ?, winner_id = ? WHERE id = ?', ['finished', winners[0].winner_id, tournamentId], (err) => err ? rej(err) : res()));
            } else {
                const nextRound = match.round + 1;
                const matchInsertStmt = db.prepare('INSERT INTO tournament_matches (tournament_id, round, match_in_round, player1_id, player2_id) VALUES (?, ?, ?, ?, ?)');
                for (let i = 0; i < winners.length; i += 2) {
                    const matchNumberInRound = (i / 2) + 1;
                    const p1_next_id = winners[i].winner_id;
                    const p2_next_id = winners[i+1].winner_id;
                    matchInsertStmt.run(tournamentId, nextRound, matchNumberInRound, p1_next_id, p2_next_id);
                    const readyPayload = JSON.stringify({ type: 'MATCH_READY', tournamentId });
                    redisPublisher.publish(`user:${p1_next_id}:messages`, readyPayload);
                    redisPublisher.publish(`user:${p2_next_id}:messages`, readyPayload);
                }
                await new Promise((res, rej) => matchInsertStmt.finalize(err => err ? rej(err) : res()));
            }
        }
    }
}