import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import crypto from 'crypto';


const server = Fastify({ logger: true });

// ALLOW DIFFERENT PORT EXCHANGE FOR FRONT TO BACK
server.register(cors, {
  origin: 'http://localhost:5173',
  credentials: true,
});

server.register(cookie);

//ABSOLUTE PATH USED TO LINK OUR DIFFERENT DATABASE
const dataDir = path.resolve('./data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// SIGN-UP SECTION
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
    const sessionToken = crypto.randomBytes(32).toString('hex');

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    return reply
      .setCookie('session_token', sessionToken, {
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

  // LOGOUT SECTION CLEAR COOKIE
  server.post('/api/logout', (req, reply) => {
  reply
    .clearCookie('session_token', { path: '/' })
    .send({ message: 'Logged out' });
});
  // END LOGOUT SECTION

  // VISUALIZING DATA TABLE INTO LOCALHOST:3000
  server.get('/api/dev/users', async (req, reply) => {
    try {
      const query = 'SELECT id, username, password, email FROM users';
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