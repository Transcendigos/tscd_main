import Fastify from 'fastify';
import cors from '@fastify/cors';
import sqlite3 from 'sqlite3'

const server = Fastify();

server.register(cors, {
  origin: 'http://localhost:5173'
});


//  SECTION TO SIGN - UP USERS INTO THE DATABASE
//create and run the database
const db = new sqlite3.Database('./data/db');
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL
  )
`).run();
//register the actual route
server.post('/api/signup', async (req, reply) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) 
  {
    return reply.code(400).send({error: 'Missing fields'});
  }
  try
  {
    const stmt = db.prepare(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
    );
    stmt.run(username, email, password);
    console.log(`User stored: ${username}, ${email}`);
  return { message: 'Signup successful' };
  }
  catch
  {
    console.log('DB insert error:', err);
    return reply.code(500).send({error: 'Database error'});
  }
});
// END OF SIGN UP SECTION

server.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Backend running on port 3000');
});