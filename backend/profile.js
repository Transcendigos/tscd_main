import { getDB } from './db.js';
import jwt from 'jsonwebtoken';
import fp from 'fastify-plugin';
import bcrypt from 'bcrypt';
import setAuthCookie from './auth.js';


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


    // Update username
    server.post('/api/profile/update-username', async (req, reply) => {
        const { username } = req.body;
        if (!username) return reply.code(400).send({ error: 'Username is required' });

        const token = req.cookies.auth_token;
        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET username = ? WHERE id = ?',
                [username, user.userId],
                (err) => (err ? reject(err) : resolve())
            );
        });


        const newPayload = {
            userId: user.userId,
            username: username,
            email: user.email,
            method_sign: user.method_sign,
            picture: user.picture
        };

        const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '7d' });
        setAuthCookie(reply, newToken);
        return reply.send({ message: 'Username updated' });
    });

    // Update email
    server.post('/api/profile/update-email', async (req, reply) => {
        const { email } = req.body;
        if (!email) return reply.code(400).send({ error: 'Email is required' });

        const token = req.cookies.auth_token;
        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET email = ? WHERE id = ?',
                [email, user.userId],
                (err) => (err ? reject(err) : resolve())
            );
        });

        const newPayload = {
            userId: user.userId,
            username: user.username,
            email: email,
            method_sign: user.method_sign,
            picture: user.picture
        };

        const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '7d' });
        setAuthCookie(reply, newToken);
        return reply.send({ message: 'Email updated' });
    });

    // Update password
    server.post('/api/profile/update-password', async (req, reply) => {
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
    });

    // Upload profile picture (base64 or file path via multipart/form-data)
    server.post('/api/profile/upload-picture', async (req, reply) => {
        const token = req.cookies.auth_token;
        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }

        const data = await req.file(); // expects file field as `profilePic`
        if (!data) return reply.code(400).send({ error: 'No file uploaded' });

        const filePath = `/uploads/${Date.now()}_${data.filename}`;
        await data.toFile(`public${filePath}`);

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET picture = ? WHERE id = ?',
                [filePath, user.userId],
                (err) => (err ? reject(err) : resolve())
            );
        });

        const newPayload = {
            userId: user.userId,
            username: user.username,
            email: user.email,
            method_sign: user.method_sign,
            picture: filePath
        };

        const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '7d' });
        setAuthCookie(reply, newToken);
        return reply.send({ message: 'Picture uploaded', url: filePath });
    });




























});
