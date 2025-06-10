import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import path from 'path';
import multipart from '@fastify/multipart';

import { initializeDB, getDB } from './db.js';
import { initializeRedisClients, getRedisPublisher, getRedisSubscriber } from './redis.js';
import authRoutes from './auth.js';
import chatRoutes, { cleanupChatResources } from './chat.js';
import twoFASettingRoutes from './setting_2fa.js';
import twofaRoutes from './signin_twofa.js';
import weatherRoutes from './weather.js';
import profileRoute from './profile.js';
import openaiRoute from './openai.js';
import spotifyRoute from './music.js';
import scoreRoutes from './score.js';
import pongRoutes from './pong_routes.js';
import { registerMonitoring } from './monitoring.js';
import blockRoutes from './block_routes.js';


console.log("🚀 Backend started at " + new Date().toLocaleTimeString());

dotenv.config();

const server = Fastify({
  logger: {
    transport: {
      targets: [
        { level: 'info', target: 'pino/file', options: { destination: '/logs/backend.log' } }
      ]
    }
  }
});

function overrideConsoleMethods() {
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalConsoleDebug = console.debug;

  console.log = (...args) => server.log.info(...args);
  console.info = (...args) => server.log.info(...args);
  console.warn = (...args) => server.log.warn(...args);
  console.error = (...args) => server.log.error(...args);
  console.debug = (...args) => server.log.debug(...args);

}

overrideConsoleMethods();
console.log("Loaded API KEY:", process.env.OPENWEATHER_API_KEY);

const start = async () => {
  try {
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

    await server.register(multipart, {
      limits: { fileSize: 5 * 1024 * 1024 }, // optional limit
    });

    // Optional: serve static files like profile pictures
    await server.register(fastifyStatic, {
      root: path.join(process.cwd(), 'public'),
      prefix: '/',
    });

    initializeDB(server.log);
    initializeRedisClients(server.log);

    await server.register(cors, {
      origin: 'http://localhost:5173',
      credentials: true,
    });

    registerMonitoring(server);

    await server.register(cookie);
    await server.register(fastifyWebsocket);
    await server.register(authRoutes);
    await server.register(chatRoutes);
    await server.register(twofaRoutes);
    await server.register(twoFASettingRoutes);
    await server.register(weatherRoutes);
    await server.register(profileRoute);
    await server.register(openaiRoute);
    await server.register(spotifyRoute);
    await server.register(scoreRoutes);
    await server.register(pongRoutes);
    await server.register(blockRoutes);

    server.log.info("!!! INDEX.JS: Registered pongRoutes.");

    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    const originalConsoleError = console.error;
    originalConsoleError("!!! INDEX.JS: SERVER START ERROR !!!", err);
    if (server.log && typeof server.log.error === 'function') server.log.error(err);
    process.exit(1);
  }
};

start();

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

    try {
      const { activeGames: currentActivePongGames } = await import('./pong_server.js');
      if (currentActivePongGames) {
        server.log.info(`Cleaning up ${currentActivePongGames.size} active Pong game intervals.`);
        currentActivePongGames.forEach(game => {
          if (game.loopInterval) {
            clearInterval(game.loopInterval);
          }
        });
        currentActivePongGames.clear();
      }
    } catch (importError) {
      server.log.error({ err: importError }, "Error dynamically importing pong_server.js for cleanup.");
    }

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
        process.exit(err ? 1 : 0);
      });
    } else {
      process.exit(0);
    }
  });
});