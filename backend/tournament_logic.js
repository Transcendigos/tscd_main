// backend/tournament_logic.js

import { getDB } from "./db.js";
import { getRedisPublisher } from "./redis.js";

// This function is the core of the tournament progression
export async function processMatchWinner(gameId, gameWinnerId) {
    const db = getDB();
    const redisPublisher = getRedisPublisher();

    // Find the match associated with this gameId
    const match = await new Promise((res, rej) => 
        db.get('SELECT * FROM tournament_matches WHERE game_id = ?', [gameId], (err, row) => err ? rej(err) : res(row))
    );

    if (!match || match.status === 'finished') {
        // Not a tournament match or already finished, do nothing
        return;
    }

    const tournamentId = match.tournament_id;

    // 1. Update the match with the winner
    await new Promise((res, rej) => 
        db.run('UPDATE tournament_matches SET winner_id = ?, status = ? WHERE id = ?', [gameWinnerId, 'finished', match.id], (err) => err ? rej(err) : res())
    );

    // 2. Broadcast to all participants that the bracket has changed
    const participants = await new Promise((res, rej) => db.all('SELECT user_id FROM tournament_participants WHERE tournament_id = ?', [tournamentId], (err, rows) => err ? rej(err) : res(rows)));

    const bracketUpdatePayload = JSON.stringify({ type: 'BRACKET_UPDATE', tournamentId });
    participants.forEach(p => {
        redisPublisher.publish(`user:${p.user_id}:messages`, bracketUpdatePayload);
    });

    // 3. Check if the round is now complete
    const currentRoundMatches = await new Promise((res, rej) => db.all('SELECT * FROM tournament_matches WHERE tournament_id = ? AND round = ?', [tournamentId, match.round], (err, rows) => err ? rej(err) : res(rows)));

    const allRoundMatchesFinished = currentRoundMatches.every(m => m.status === 'finished');

    if (allRoundMatchesFinished) {
        const winners = currentRoundMatches.map(m => ({ winner_id: m.winner_id })).sort(() => Math.random() - 0.5); // Sort/shuffle winners for next round

        // Is this the final match?
        if (winners.length === 1) {
            // End of tournament
            await new Promise((res, rej) => db.run('UPDATE tournaments SET status = ?, winner_id = ? WHERE id = ?', ['finished', winners[0].winner_id, tournamentId], (err) => err ? rej(err) : res()));
            console.log(`Tournament ${tournamentId} has finished. Winner: ${winners[0].winner_id}`);
            // The BRACKET_UPDATE message sent earlier will show the final state.
        } else {
            // Generate next round
            const nextRound = match.round + 1;
            const matchInsertStmt = db.prepare('INSERT INTO tournament_matches (tournament_id, round, match_in_round, player1_id, player2_id) VALUES (?, ?, ?, ?, ?)');
            for (let i = 0; i < winners.length; i += 2) {
                const matchNumberInRound = (i / 2) + 1;
                const p1 = winners[i].winner_id;
                const p2 = winners[i+1].winner_id;
                matchInsertStmt.run(tournamentId, nextRound, matchNumberInRound, p1, p2);

                // Notify the next players that their match is ready
                const readyPayload = JSON.stringify({ type: 'MATCH_READY', tournamentId, matchId: -1 }); // We don't have the new ID yet, but the client can just refresh
                redisPublisher.publish(`user:${p1}:messages`, readyPayload);
                redisPublisher.publish(`user:${p2}:messages`, readyPayload);
            }
            await new Promise((res, rej) => matchInsertStmt.finalize(err => err ? rej(err) : res()));
        }
    }
}