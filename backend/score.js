import { getDB } from './db.js';
import fp from 'fastify-plugin';

export default fp(async function scoreRoutes(server, options) {
  const db = getDB();

  // POST /api/scores - Save a match score
  server.post('/api/scores', {
    schema: {
      body: {
        type: 'object',
        required: ['match_id', 'user_id', 'score', 'score_against', 'won', 'vs_ai'],
        properties: {
          tournament_id: { type: ['integer', 'null'] },
          match_id: { type: 'integer' },
          user_id: { type: 'integer' },
          score: { type: 'integer' },
          score_against: { type: 'integer' },
          won: { type: 'boolean' },
          vs_ai: { type: 'boolean' },
          duration_seconds: { type: 'integer' },
          opponent_id: { type: ['integer', 'null'] },
          opponent_alias: { type: ['string', 'null'] },
          is_disconnected: { type: 'boolean' },
          rank_delta: { type: 'integer' }
        }
      }
    }
  }, async (req, reply) => {
    const {
      tournament_id,
      match_id,
      user_id,
      score,
      score_against,
      won,
      vs_ai,
      duration_seconds,
      opponent_id,
      opponent_alias,
      is_disconnected,
      rank_delta
    } = req.body;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO scores (
          tournament_id,
          match_id,
          user_id,
          score,
          score_against,
          won,
          vs_ai,
          duration_seconds,
          opponent_id,
          opponent_alias,
          is_disconnected,
          rank_delta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tournament_id,
          match_id,
          user_id,
          score,
          score_against,
          won ? 1 : 0,
          vs_ai ? 1 : 0,
          duration_seconds ?? null,
          opponent_id ?? null,
          opponent_alias ?? null,
          is_disconnected ? 1 : 0,
          rank_delta ?? 0
        ],
        function (err) {
          if (err) {
            server.log.error(err);
            reply.code(500).send({ error: 'Failed to save score' });
            reject(err);
          } else {
            const result = { id: this.lastID };
            reply.code(201).send(result);
            resolve(result);
          }
        }
      );
    });
  });

  // GET /api/scores - Fetch all scores
  server.get('/api/scores', async (req, reply) => {
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM scores ORDER BY match_id DESC, user_id ASC`, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      reply.send(rows);
    } catch (err) {
      server.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch scores' });
    }
  });
});