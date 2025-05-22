import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pino from 'pino';


import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const logStream = fs.createWriteStream('/logs/backend.log', {flags: 'a'});
const logger = pino(logStream);

const server = Fastify({ logger });

// ALLOW DIFFERENT PORT EXCHANGE FOR FRONT TO BACK
server.register(cors, {
  origin: 'http://localhost:5173',
  credentials: true,
});

server.register(cookie);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key'; // replace with real secret in production

//ABSOLUTE PATH USED TO LINK OUR DIFFERENT DATABASE
const dataDir = path.resolve('./data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// SIGN-UP SECTION - NO GOOGLE
const dbPath = path.join(dataDir, 'db.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`Failed to open database at ${dbPath}:`, err.message);
    process.exit(1);
  }
  console.log(`Database opened successfully: ${dbPath}`);
});

let signupuserTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL
  )
`);
signupuserTable.run((err) => {
    if (err) {
        console.error("Error running CREATE TABLE statement:", err.message);
    }
});
signupuserTable.finalize((err) => {
  if (err) {
    console.error("Error finalizing CREATE TABLE statement:", err.message);
  }
});

server.post('/api/signup', async (req, reply) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return reply.code(400).send({ error: 'Missing fields' });
  }

  try {
    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ? OR username = ?',
        [email, username],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    if (existingUser) {
      const conflictField = existingUser.email === email ? 'email' : 'username';
      return reply.code(409).send({ error: `A user with that ${conflictField} already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userID = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID); // return inserted user ID;
        }
      );
    });

    const token = jwt.sign({ userID, username, email }, JWT_SECRET, { expiresIn: '7d'});
    reply.clearCookie('session_token', { path: '/' }); // cleanup legacy
    console.log("token from signup api is ", token);

    return reply
      .setCookie('auth_token', token, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
      })
      .code(201)
      .send({ message: 'Signup successful', username });

  } catch (err) {
    console.error('Signup error:', err.message);
    return reply.code(500).send({ error: 'Server error during signup' });
  }
});
  // END SIGN-UP SECTION

//GOOGLE AUTHORIZATION SIGN UP
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
console.log("BACKEND GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);

server.post('/api/google-login', async (req, reply) => {
  const { credential } = req.body;
  if (!credential) {
    return reply.code(400).send({ error: 'Missing credential token' });
  }

  try 
  {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    let userId;
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    if (!user) 
    {
       userId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [name, email, 'google-oauth'],
          function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });
    }
    else
    {
      userId = user.id;
    }

    const token = jwt.sign({ userId, name, email }, JWT_SECRET, { expiresIn: '7d' });
    console.log("token from goog api is ", token);
    return reply
      .setCookie('auth_token', token, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
      })
      .send({ message: 'Google login successful', name });

  } 
  catch (err) 
  {
    console.error('Google login error:', err.message);
    return reply.code(401).send({ error: 'Invalid Google token' });
  }
});
// END GOOGLE AUTHORIZATION SIGN UP

// SECTION VERIFY IF LOG IN
// `/api/me` – check if user is logged in
server.get('/api/me', (req, reply) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return reply.send({ signedIn: false });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    reply.send({ signedIn: true, user: payload });
  } catch {
    reply.send({ signedIn: false });
  }
});
// END SECTION

// SECTION LOG OUT - CLEAR COOKIE JWT TOKEN
server.post('/api/logout', (req, reply) => {
  reply
    .clearCookie('auth_token', { path: '/' })
    .send({ message: 'Logged out' });
});
// END SECTION


  // VISUALIZING DATA TABLE INTO LOCALHOST:3000
  server.get('/api/dev/users', async (req, reply) => {
    try {
      const query = 'SELECT id, username, email, password FROM users';
      const rows = await new Promise((resolve, reject) => {
        db.all(query, [], (err, resultRows) => {
          if (err) {
            return reject(err);
          }
          resolve(resultRows);
        });
      });
      return reply.send(rows);
    } catch (err) {
      console.error('[GET /api/dev/users] Error fetching users:', err.message);
      return reply.code(500).send({ error: 'Failed to fetch users.' });
    }
});
// END VISIALIZING DATA TABLE

server.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});