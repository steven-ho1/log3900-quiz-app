/* eslint-disable no-console */
import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const redisClient = createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
});

redisClient.on('error', (error) => console.log('Redis Client Error', error));
redisClient.on('connect', () => console.log('Redis connected'));

export default redisClient;
