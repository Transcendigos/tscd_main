import Fastify from 'fastify';
import cors from '@fastify/cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const server = Fastify({ logger: true });

server.register(cors, {
  origin: 'http://localhost:5173'
});

const dataDir = path.resolve('./data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'db.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`Failed to open database at ${dbPath}:`, err.message);
    process.exit(1);
  }
  console.log(`Database opened successfully: ${dbPath}`);
});

let createTableStmt = db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL
  )
`);
createTableStmt.run((err) => {
    if (err) {
        console.error("Error running CREATE TABLE statement:", err.message);
    }
});
createTableStmt.finalize((err) => {
  if (err) {
    console.error("Error finalizing CREATE TABLE statement:", err.message);
  }
});

server.post('/api/signup', async (req, reply) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return reply.code(400).send({error: 'Missing fields'});
  }
  let stmt;
  try {
    stmt = db.prepare(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
    );
    stmt.run(username, email, password, function(runErr) {
        if (runErr) {
            throw runErr;
        }
        console.log(`User stored: ${username}, ${email}`);
    });
    return reply.code(201).send({ message: 'Signup successful' });
  } catch (err) {
    console.error('DB insert error:', err.message);
    return reply.code(500).send({error: 'Database error during signup'});
  } finally {
    if (stmt) {
      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          console.error('Error finalizing signup statement:', finalizeErr.message);
        }
      });
    }
  }
});

server.get('/api/dev/users', async (req, reply) => {
  try {
    const query = 'SELECT id, username, email FROM users';
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

server.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});