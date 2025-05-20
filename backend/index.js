import Fastify from 'fastify';
import cors from '@fastify/cors';

const server = Fastify();

server.register(cors, {
  origin: 'http://localhost:5173'
});

// // Log all incoming requests
// server.addHook('onRequest', async (request, reply) => {
//   console.log(`[${request.method}] ${request.url}`);
// });

// Actual route
server.post('/api/signup', async (request, reply) => {
  console.log("Signup request received:", request.body);
  return { message: "Signup successful" };
});

// server.route({
//   method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   url: '*',
//   handler: async (request, reply) => {
//     console.log(`Unhandled route: ${request.method} ${request.url}`);
//     reply.code(404).send({ error: "Not found" });
//   }
// });


server.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Backend running on port 3000');
});