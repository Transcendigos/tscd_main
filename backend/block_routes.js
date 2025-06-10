// backend/block_routes.js

import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { getDB } from './db.js';
import { getRedisPublisher } from './redis.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export default fp(async function blockRoutes(server, options) {
    const db = getDB();
    const redisPublisher = getRedisPublisher();

    const getUserIdFromToken = (req, reply) => {
        const token = req.cookies.auth_token;
        if (!token) {
            reply.code(401).send({ error: "Not authenticated" });
            return null;
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return decoded.userId;
        } catch (err) {
            reply.code(401).send({ error: "Invalid token" });
            return null;
        }
    };

    server.post('/api/chat/block', async (req, reply) => {
        const blockerId = getUserIdFromToken(req, reply);
        if (!blockerId) return;

        const { userIdToBlock } = req.body;
        if (!userIdToBlock) {
            return reply.code(400).send({ error: "userIdToBlock is required" });
        }

        await new Promise((resolve, reject) => {
            db.run('INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)', [blockerId, userIdToBlock], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
        
        const notificationPayload = JSON.stringify({
            type: 'BLOCK_STATUS_UPDATE',
            message: 'Your interaction status with another user has changed.'
        });
        const recipientChannel = `user:${userIdToBlock}:messages`;
        
        await redisPublisher.publish(recipientChannel, notificationPayload);
        
        return reply.send({ success: true, message: 'User blocked.' });
    });

    server.post('/api/chat/unblock', async (req, reply) => {
        const blockerId = getUserIdFromToken(req, reply);
        if (!blockerId) return;
        
        const { userIdToUnblock } = req.body;
        if (!userIdToUnblock) {
            return reply.code(400).send({ error: "userIdToUnblock is required" });
        }

        await new Promise((resolve, reject) => {
            db.run('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [blockerId, userIdToUnblock], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
        
        const notificationPayload = JSON.stringify({
            type: 'BLOCK_STATUS_UPDATE',
            message: 'Your interaction status with another user has changed.'
        });
        const recipientChannel = `user:${userIdToUnblock}:messages`;
        
        await redisPublisher.publish(recipientChannel, notificationPayload);

        return reply.send({ success: true, message: 'User unblocked.' });
    });

    server.get('/api/chat/blocked', async (req, reply) => {
        const userId = getUserIdFromToken(req, reply);
        if (!userId) return;

        const blockedUsers = await new Promise((resolve, reject) => {
            db.all('SELECT blocked_id FROM blocked_users WHERE blocker_id = ?', [userId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(row => row.blocked_id));
            });
        });
        
        return reply.send(blockedUsers);
    });
});