import client from 'prom-client';

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});


// Chat Messages Counter
export const chatMessagesCounter = new client.Counter({
  name: 'chat_messages_total',
  help: 'Total number of chat messages sent',
  labelNames: ['sender_id', 'receiver_id'],
});

export function registerMonitoring(server) {
  // Collect default process metrics
  client.collectDefaultMetrics();

  // Fastify lifecycle hook to track all HTTP requests
  server.addHook('onResponse', (request, reply, done) => {
    if (request.url !== '/metrics') {
      httpRequestCounter.inc({
        method: request.method,
        route: request.routerPath || request.url,
        status_code: reply.statusCode,
      });
    }
    done();
  });

  // Metrics endpoint
  server.get('/metrics', async (req, reply) => {
    try {
      reply.header('Content-Type', client.register.contentType);
      reply.send(await client.register.metrics());
    } catch (err) {
      server.log.error({ err }, 'Error generating metrics');
      reply.code(500).send(err);
    }
  });
}