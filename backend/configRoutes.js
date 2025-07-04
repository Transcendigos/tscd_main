// backend/configRoutes.js
import fp from 'fastify-plugin';

async function configRoutes(server, options) {
  server.get('/api/config', async (request, reply) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      server.log.error("CONFIG: GOOGLE_CLIENT_ID is not set on the server.");
      reply.code(500).send({ error: "Server configuration error." });
      return;
    }
    reply.send({
      googleClientId: process.env.GOOGLE_CLIENT_ID,
    });
  });
}

export default fp(configRoutes);