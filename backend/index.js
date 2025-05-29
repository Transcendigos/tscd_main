// tscd_main/backend/index.js
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';
import pino from 'pino';
import fs from 'fs';


import { initializeDB, getDB } from './db.js';
import { initializeRedisClients, getRedisPublisher, getRedisSubscriber } from './redis.js';
import authRoutes from './auth.js';
import chatRoutes, { cleanupChatResources } from './chat.js'; // Import cleanup
import twoFASettingRoutes from './setting_2fa.js';
import twofaRoutes from './signin_twofa.js';
import weatherRoutes from './weather.js';
import profileRoute from './profile.js';


console.log("🚀 Backend started at " + new Date().toLocaleTimeString());

dotenv.config();
console.log("Loaded API KEY:", process.env.OPENWEATHER_API_KEY);

const logStream = fs.createWriteStream('/logs/backend.log', { flags: 'a' });
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
}, pino.multistream([
  { level: 'info', stream: process.stdout },
  { level: 'info', stream: logStream }
]));

const server = Fastify({ logger });

// Initialize DB and Redis
const db = initializeDB(server.log);
const { redisPublisher, redisSubscriber: generalRedisSubscriber } = initializeRedisClients(server.log); // Renamed to avoid confusion

// Register common plugins
server.register(cors, {
  origin: 'http://localhost:5173',
  credentials: true,
});
server.register(cookie);
server.register(fastifyWebsocket);

// Register modular routes
server.register(authRoutes);
server.register(chatRoutes);
server.register(twofaRoutes);
server.register(twoFASettingRoutes);
server.register(weatherRoutes);
server.register(profileRoute);


// Start server
const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    // Fastify logger already logs this: server.log.info(`Server listening on ${server.server.address().port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const GSignals = ['SIGINT', 'SIGTERM'];
GSignals.forEach((signal) => {
  process.on(signal, async () => {
    server.log.info({ signal }, 'Received signal, shutting down gracefully...');

    await cleanupChatResources(server.log); // Cleanup chat-specific resources

    if (server.websocketServer) { // Close WebSocket server if it exists
      for (const client of server.websocketServer.clients) {
        client.close(1001, 'Server shutting down');
      }
    }

    await server.close(); // Close Fastify server (this also closes WebSocket connections)

    const publisher = getRedisPublisher();
    const subscriber = getRedisSubscriber(); // This is the general one
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