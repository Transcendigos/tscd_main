import { getDB } from './db.js';
import jwt from 'jsonwebtoken';
import fp from 'fastify-plugin';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export default fp(async function profileRoute(server, options) {
    const db = getDB();

    server.get('/api/profile', async (req, reply) => {
        const token = req.cookies.auth_token;
        if (!token) return reply.code(401).send({ error: 'Not authenticated' });

        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }

        const result = await new Promise((resolve, reject) => {
            db.get('SELECT username, email, picture FROM users WHERE id = ?', [user.userId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!result) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return reply.send({ profile: result });
    });
});
