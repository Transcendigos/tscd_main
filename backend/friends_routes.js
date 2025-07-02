import { getDB } from './db.js';
import { authenticate } from './middleware.js';
import { getRedisPublisher } from './redis.js';

export default function(fastify, options, done) {
    const db = getDB();
    const redisPublisher = getRedisPublisher();

    // Add a friend
    fastify.post('/api/friends/add', { preHandler: [authenticate] }, (request, reply) => {
        const currentUserId = request.user.id;
        const { friendId } = request.body;

        if (!friendId) {
            return reply.code(400).send({ error: 'friendId is required.' });
        }

        const stmt = db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)');
        stmt.run(currentUserId, friendId, function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return reply.code(409).send({ message: 'Already friends.' });
                }
                request.log.error({ err }, "Failed to add friend");
                return reply.code(500).send({ error: 'Database error while adding friend.' });
            }
            reply.code(201).send({ message: 'Friend added successfully.' });
        });
        stmt.finalize();
    });

    // Remove a friend
    fastify.post('/api/friends/remove', { preHandler: [authenticate] }, (request, reply) => {
        const currentUserId = request.user.id;
        const { friendId } = request.body;

        if (!friendId) {
            return reply.code(400).send({ error: 'friendId is required.' });
        }

        const stmt = db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?');
        stmt.run(currentUserId, friendId, function(err) {
            if (err) {
                request.log.error({ err }, "Failed to remove friend");
                return reply.code(500).send({ error: 'Database error while removing friend.' });
            }
             if (this.changes === 0) {
                return reply.code(404).send({ message: 'Friendship not found.' });
            }
            reply.send({ message: 'Friend removed successfully.' });
        });
        stmt.finalize();
    });

    fastify.get('/api/friends/:userId', { preHandler: [authenticate] }, async (request, reply) => {
        const { userId } = request.params;
        const numericUserId = parseInt(userId.replace('user_', ''), 10);

        if (isNaN(numericUserId)) {
            return reply.code(400).send({ error: 'Invalid user ID format.' });
        }

        try {
            // 1. Fetch friend details from the database
            const friendsFromDB = await new Promise((resolve, reject) => {
                const sql = `
                    SELECT u.id, u.username, u.picture
                    FROM users u
                    INNER JOIN friends f ON u.id = f.friend_id
                    WHERE f.user_id = ?
                `;
                db.all(sql, [numericUserId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });

            // 2. Fetch all online users from Redis
            const onlineUserPrefixedIds = await redisPublisher.smembers('online_users');
            const onlineUsersSet = new Set(onlineUserPrefixedIds);

            // 3. Combine the data to include online status
            const friendsWithStatus = friendsFromDB.map(friend => ({
                id: friend.id,
                username: friend.username,
                picture: friend.picture,
                isOnline: onlineUsersSet.has(`user_${friend.id}`)
            }));

            reply.send(friendsWithStatus);

        } catch (err) {
            request.log.error({ err }, 'Failed to fetch friend list');
            reply.code(500).send({ error: 'Server error while fetching friends.' });
        }
    });

    done();
}