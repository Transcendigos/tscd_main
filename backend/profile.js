import { getDB } from './db.js';
import jwt from 'jsonwebtoken';
import fp from 'fastify-plugin';
import bcrypt from 'bcrypt';
import { setAuthCookie } from './utils.js';
import path from 'path';
import fs from 'fs';
import multipart from '@fastify/multipart';


const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export default fp(async function profileRoute(server, options) {
    const db = getDB();


    // GET USER PROFILE

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

    // GET USER PROFILE BY ID

    server.get('/api/profile/:userId', async (req, reply) => {
        const token = req.cookies.auth_token;
        if (!token) {
            return reply.code(401).send({ error: 'Not authenticated' });
        }
        
        let requester;
        try {
            requester = jwt.verify(token, JWT_SECRET);
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }
        
        const requesterId = requester.userId;
        const requestedUserId = parseInt(req.params.userId, 10);

        if (isNaN(requestedUserId)) {
            return reply.code(400).send({ error: 'Invalid user ID' });
        }

        if (requesterId === requestedUserId) {
        } else {
            const isBlocked = await new Promise((resolve, reject) => {
                db.get(`SELECT 1 FROM blocked_users 
                        WHERE (blocker_id = ? AND blocked_id = ?) 
                        OR (blocker_id = ? AND blocked_id = ?) 
                        LIMIT 1`,
                    [requesterId, requestedUserId, requestedUserId, requesterId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(!!row);
                    }
                );
            });

            if (isBlocked) {
                return reply.code(403).send({ error: "You are not permitted to view this profile." });
            }
        }
        const result = await new Promise((resolve, reject) => {
            db.get('SELECT id, username, email, picture FROM users WHERE id = ?', [requestedUserId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!result) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return reply.send({ profile: result });
    });



    server.post('/api/profile/update-username', async (req, reply) => {
        try {
            const { username } = req.body;
            if (!username) {
                return reply.code(400).send({ error: 'Username is required' });
            }

            const token = req.cookies.auth_token;
            let user;
            try {
                user = jwt.verify(token, JWT_SECRET);
            } catch (err) {
                console.error("JWT decode failed:", err);
                return reply.code(401).send({ error: 'Invalid token' });
            }

            const existingUser = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT id FROM users WHERE username = ? AND id != ?',
                    [username, user.userId],
                    (err, row) => {
                        if (err) {
                            console.error("DB error while checking username uniqueness:", err);
                            return reject(err);
                        }
                        resolve(row);
                    }
                );
            });

            if (existingUser) {
                return reply.code(409).send({ error: 'Username is already taken' });
            }

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET username = ? WHERE id = ?',
                    [username, user.userId],
                    (err) => {
                        if (err) {
                            console.error("DB error while updating username:", err);
                            return reject(err);
                        }
                        resolve(null);
                    }
                );
            });

            const newPayload = {
                userId: user.userId,
                username,
                email: user.email,
                method_sign: user.method_sign,
                picture: user.picture
            };

            const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '7d' });
            setAuthCookie(reply, newToken);

            return reply.send({ message: 'Username updated', user: newPayload });

        } catch (err) {
            console.error("Unhandled error in update-username route:", err);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Update email
    server.post('/api/profile/update-email', async (req, reply) => {
        try {
            const { email } = req.body;
            if (!email) return reply.code(400).send({ error: 'Email is required' });

            const token = req.cookies.auth_token;
            let user;
            try {
                user = jwt.verify(token, JWT_SECRET);
            } catch {
                return reply.code(401).send({ error: 'Invalid token' });
            }

            const existingEmail = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT id FROM users WHERE email = ? AND id != ?',
                    [email, user.userId],
                    (err, row) => {
                        if (err) {
                            console.error("DB error while checking username uniqueness:", err);
                            return reject(err);
                        }
                        resolve(row);
                    }
                );
            });

            if (existingEmail) {
                return reply.code(409).send({ error: 'Email is already being used' });
            }

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET email = ? WHERE id = ?',
                    [email, user.userId],
                    (err) => {
                        if (err) {
                            console.error("DB error while updating username:", err);
                            return reject(err);
                        }
                        resolve(null);
                    }
                );
            });

            const newPayload = {
                userId: user.userId,
                username: user.username,
                email,
                method_sign: user.method_sign,
                picture: user.picture
            };

            const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '7d' });
            setAuthCookie(reply, newToken);

            return reply.send({ message: 'Email updated', user: newPayload });

        } catch (err) {
            console.error("Unhandled error in update-email route:", err);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Update password
    server.post('/api/profile/update-password', async (req, reply) => {
        try {
            const { password } = req.body;
            if (!password) return reply.code(400).send({ error: 'Password is required' });

            const token = req.cookies.auth_token;
            let user;
            try {
                user = jwt.verify(token, JWT_SECRET);
            } catch {
                return reply.code(401).send({ error: 'Invalid token' });
            }

            const hash = await bcrypt.hash(password, 10);

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET password = ? WHERE id = ?',
                    [hash, user.userId],
                    (err) => (err ? reject(err) : resolve())
                );
            });

            return reply.send({ message: 'Password updated' });
        } catch (err) {
            console.error("Unhandled error in update-password route:", err);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });


    // Upload profile picture (base64 or file path via multipart/form-data)
    server.post('/api/profile/upload-picture', async (req, reply) => {
        try {
            const token = req.cookies.auth_token;
            let user;
            try {
                user = jwt.verify(token, JWT_SECRET);
            } catch {
                return reply.code(401).send({ error: 'Invalid token' });
            }

            const data = await req.file();
            if (!data) return reply.code(400).send({ error: 'No file uploaded' });

            const safeName = data.filename.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
            const relativePath = `/uploads/${Date.now()}_${safeName}`;
            const fullPath = path.join('public', relativePath);

            // Ensure directory exists
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            // Save file manually
            const fileBuffer = await data.toBuffer();
            fs.writeFileSync(fullPath, fileBuffer);

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET picture = ? WHERE id = ?',
                    [relativePath, user.userId],
                    (err) => (err ? reject(err) : resolve())
                );
            });

            const newPayload = {
                userId: user.userId,
                username: user.username,
                email: user.email,
                method_sign: user.method_sign,
                picture: relativePath
            };

            const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '7d' });
            setAuthCookie(reply, newToken);

            return reply.send({ message: 'Picture uploaded', user: newPayload });

        } catch (err) {
            console.error("🧨 Upload picture failed:", err.message, err.stack);
            return reply.code(500).send({
                error: 'Internal server error',
                message: err.message,
            });
        }
    });

    // Delete Account
    server.post('/api/profile/delete-account', async (req, reply) => {
        const token = req.cookies.auth_token;
        if (!token) return reply.code(401).send({ error: 'Not authenticated' });

        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }

        try {
            // Delete from related tables first if needed (e.g., stats, matches, etc.)
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM users WHERE id = ?', [user.userId], (err) =>
                    err ? reject(err) : resolve()
                );
            });

            reply.clearCookie('auth_token', { path: '/' });
            return reply.send({ message: 'Account successfully deleted' });
        } catch (err) {
            console.error("❌ Failed to delete user:", err);
            return reply.code(500).send({ error: "Failed to delete account" });
        }
    });

});
