import { getDB } from './db.js';
import fp from 'fastify-plugin';
import { promisify } from 'util';

const ScoreSchema = {
	type: 'object',
	required: ['match_id', 'user_id', 'score', 'score_against', 'won', 'vs_ai'],
	properties: {
		tournament_id: { type: ['integer', 'null'] },
		match_id: { type: 'integer' },
		user_id: { type: 'integer' },
		username: { type: ['string', 'null'] },
		score: { type: 'integer' },
		score_against: { type: 'integer' },
		won: { type: 'boolean' },
		vs_ai: { type: 'boolean' },
		duration_seconds: { type: 'integer' },
		opponent_id: { type: ['integer', 'null'] },
		opponent_username: { type: ['string', 'null'] },
		is_disconnected: { type: 'boolean' },
		rank_delta: { type: 'integer' }
	}
};

export default fp(async function scoreRoutes(server) {
	const db = getDB();
	const dbRun = promisify(db.run.bind(db));
	const dbAll = promisify(db.all.bind(db));

	// POST /api/scores - Save a match score
	server.post('/api/scores', {
		schema: { body: ScoreSchema }
	}, async (req, reply) => {
		const data = {
		tournament_id: req.body.tournament_id,
		match_id: req.body.match_id,
		user_id: req.body.user_id,
		username: req.body.username,
		score: req.body.score,
		score_against: req.body.score_against,
		won: req.body.won ? 1 : 0,
		vs_ai: req.body.vs_ai ? 1 : 0,
		duration_seconds: req.body.duration_seconds ?? null,
		opponent_id: req.body.opponent_id ?? null,
		opponent_username: req.body.opponent_username ?? null,
		is_disconnected: req.body.is_disconnected ? 1 : 0,
		rank_delta: req.body.rank_delta ?? 0
		};

		try {
			const result = await dbRun(`
			INSERT INTO scores (
			tournament_id, match_id, user_id, username, score,
			score_against, won, vs_ai, duration_seconds,
			opponent_id, opponent_username, is_disconnected, rank_delta
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, Object.values(data));
			reply.code(201).send({ id: result.lastID });
		} catch (err) {
			server.log.error(err);
			reply.code(500).send({ error: 'Failed to save score' });
		}
	});

	server.get('/api/scores', async (req, reply) => {
		try {
			const rows = await dbAll(`SELECT * FROM scores ORDER BY match_id DESC, user_id ASC`);
			reply.send(rows);
		} catch (err) {
			server.log.error(err);
			reply.code(500).send({ error: 'Failed to fetch scores' });
		}
	});
});