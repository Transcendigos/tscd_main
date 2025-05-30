// backend/index.js
console.log("✅ Je suis bien le bon index.js !");


import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import staticPlugin from '@fastify/static';
import fs from 'fs';
import path from 'path';

import { initializeDB, getDB } from './db.js';
import { initializeRedisClients, getRedisPublisher, getRedisSubscriber } from './redis.js';
import authRoutes from './auth.js';
import chatRoutes, { cleanupChatResources } from './chat.js';
import twoFASettingRoutes from './setting_2fa.js';
import twofaRoutes from './signin_twofa.js';

console.log("\u{1F680} Backend started at " + new Date().toLocaleTimeString());

dotenv.config();

const server = Fastify({
  logger: {
    transport: {
      targets: [
        { level: 'info', target: 'pino/file', options: { destination: './logs/backend.log' } }
      ]
    }
  }
});

// Swagger setup
await server.register(swagger, {
  openapi: {
    info: {
      title: 'Transcendance API',
      description: 'API du projet Transcendance',
      version: '1.0.0'
    }
  }
});
await server.register(swaggerUi, {
  routePrefix: '/docs',
});

server.get('/', async (request, reply) => {
  reply.send({ hello: 'world' });
});

// Init DB & Redis
const db = initializeDB(server.log);
const { redisPublisher, redisSubscriber: generalRedisSubscriber } = initializeRedisClients(server.log);

// Register core plugins
await server.register(cors, {
  origin: 'http://localhost:5173',
  credentials: true,
});
await server.register(cookie);
await server.register(fastifyWebsocket);

// Register app routes
await server.register(authRoutes);
await server.register(chatRoutes);
await server.register(twofaRoutes);
await server.register(twoFASettingRoutes);

// ------------------------- Avatar Upload -------------------------
const avatarDir = path.join(process.cwd(), 'backend', 'uploads', 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });

server.post('/api/users/avatar', async (request, reply) => {
  const { avatar } = request.body;

  if (!avatar || !avatar.startsWith('data:image/png;base64,')) {
    return reply.status(400).send({ error: "Format d'image invalide" });
  }

  const base64Data = avatar.replace(/^data:image\/png;base64,/, "");
  const userId = 42; // TODO: remplacer par l'ID utilisateur réel

const filePath = path.join(process.cwd(), 'backend', 'uploads', 'avatars', `${userId}.png`);
  try {
    fs.writeFileSync(filePath, base64Data, 'base64');
    return { message: 'Avatar enregistré', file: `/uploads/avatars/${userId}.png` };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erreur serveur' });
  }
});

// Serve static avatar files
await server.register(staticPlugin, {
  root: path.join(process.cwd(), 'backend', 'uploads'),
  prefix: '/uploads/',
  setHeaders(res, path, stat) {
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
  }
});

// ------------------------- Server Startup -------------------------
const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

// ------------------------- Graceful Shutdown -------------------------
const GSignals = ['SIGINT', 'SIGTERM'];
GSignals.forEach((signal) => {
  process.on(signal, async () => {
    server.log.info({ signal }, 'Received signal, shutting down gracefully...');

    await cleanupChatResources(server.log);

    if (server.websocketServer) {
      for (const client of server.websocketServer.clients) {
        client.close(1001, 'Server shutting down');
      }
    }

    await server.close();

    const publisher = getRedisPublisher();
    const subscriber = getRedisSubscriber();
    if (publisher) await publisher.quit();
    if (subscriber) await subscriber.quit();

    const currentDb = getDB();
    if (currentDb) {
      currentDb.close((err) => {
        if (err) {
          server.log.error({ err }, 'Error closing the SQLite database');
        } else {
          server.log.info('SQLite database closed.');
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

server.get('/test', async (req, reply) => {
  return { ok: true };
});
