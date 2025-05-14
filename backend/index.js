// this is the main backend file. We will also need a db.js to implement the database.

import Fastify from 'fastify';

const server = Fastify();

server.get('/api/ping', async (request, reply) => {
  return { pong: true };
});

server.listen({ port: 3000, host: '0.0.0.0' }, err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Backend running on port 3000');
});
