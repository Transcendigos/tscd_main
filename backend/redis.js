// tscd_main/backend/redis.js
import Redis from 'ioredis';

let publisher = null;
let subscriber = null;

export function initializeRedisClients(logger) {
    if (publisher && subscriber) {
        return { redisPublisher: publisher, redisSubscriber: subscriber };
    }

    const redisURL = process.env.REDIS_URL || 'redis://redis_chat:6379';

    publisher = new Redis(redisURL, { maxRetriesPerRequest: 3 });
    subscriber = new Redis(redisURL, { maxRetriesPerRequest: 3 });

    publisher.on('connect', () => {
      console.log('Redis Publisher connected successfully');
      if (logger) logger.info('Redis Publisher connected successfully');
    });
    publisher.on('error', (err) => {
      console.error('Redis Publisher connection error: ', err);
      if (logger) logger.error({ err }, 'Redis Publisher connection error');
    });

    subscriber.on('connect', () => {
      console.log('Redis Subscriber connected successfully');
      if (logger) logger.info('Redis Subscriber connected successfully');
    });
    subscriber.on('error', (err) => {
      console.error('Redis Subscriber connection error: ', err);
      if (logger) logger.error({ err }, 'Redis Subscriber connection error');
    });

    return { redisPublisher: publisher, redisSubscriber: subscriber };
}

export function getRedisPublisher() {
    if (!publisher) {
        throw new Error("Redis Publisher not initialized. Call initializeRedisClients first.");
    }
    return publisher;
}

export function getRedisSubscriber() {
    if (!subscriber) {
        throw new Error("Redis Subscriber not initialized. Call initializeRedisClients first.");
    }
    return subscriber;
}

export function createNewRedisSubscriber(logger) {
    const newSub = new Redis(process.env.REDIS_URL || 'redis://redis_chat:6379', {
        maxRetriesPerRequest: 3
    });
    newSub.on('connect', () => {
      if (logger) logger.info('New dedicated Redis Subscriber connected successfully');
    });
    newSub.on('error', (err) => {
      if (logger) logger.error({ err }, 'New dedicated Redis Subscriber connection error');
    });
    return newSub;
}