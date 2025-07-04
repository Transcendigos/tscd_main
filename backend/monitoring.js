import client from 'prom-client';

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});


export const chatMessagesCounter = new client.Counter({
  name: 'chat_messages_total',
  help: 'Total number of chat messages sent',
  labelNames: ['sender_id', 'receiver_id'],
});

export function registerMonitoring(server) {
  client.collectDefaultMetrics();

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