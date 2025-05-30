// score.js
import { getDB } from './db.js';

export default async function (fastify, options) {
  const db = getDB();

  fastify.post('/scores', async (request, reply) => {
    const { tournament_id, user_id, score } = request.body;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO scores (tournament_id, user_id, score) VALUES (?, ?, ?)`,
        [tournament_id, user_id, score],
        function (err) {
          if (err) {
            fastify.log.error(err);
            reply.code(500).send({ error: 'Failed to add score' });
            reject(err);
          } else {
            const result = { id: this.lastID, tournament_id, user_id, score };
            reply.code(201).send(result);
            resolve(result);
          }
        }
      );
    });
  });

  // Optional: Add a GET route to fetch scores
  fastify.get('/scores', async (request, reply) => {
    db.all(`SELECT * FROM scores`, (err, rows) => {
      if (err) {
        fastify.log.error(err);
        reply.code(500).send({ error: 'Failed to fetch scores' });
      } else {
        reply.send(rows);
      }
    });
  });
}