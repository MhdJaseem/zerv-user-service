import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class RedisService {
    private client;
    private readonly logger = new Logger(RedisService.name);

    constructor() {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
        const redisUrl = `redis://${redisHost}:${redisPort}`;
        this.client = createClient({ url: redisUrl });
        this.client.on('error', (err) => this.logger.error('Redis Client Error', err));
        this.client.connect().catch((err) => this.logger.error('Redis Connection Error', err));
    }

    // Basic key-value operations
    async set<T>(key: string, value: T): Promise<void> {
        await this.client.set(key, JSON.stringify(value));
    }

    async get<T>(key: string): Promise<T | null> {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    // JSON-specific methods
    async setJson(key: string, value: Record<string, any>): Promise<void> {
        await this.set(key, value);
    }

    async getJson(key: string): Promise<Record<string, any> | null> {
        return await this.get(key);
    }

    async updateJson(key: string, value: Record<string, any>): Promise<void> {
        const existingJson = await this.getJson(key);
        if (existingJson) {
            const updatedJson = { ...existingJson, ...value };
            await this.setJson(key, updatedJson);
        } else {
            throw new BadRequestException(`JSON object with key "${key}" does not exist.`);
        }
    }

    async delJson(key: string): Promise<void> {
        await this.del(key);
    }

    // Array of objects methods
    async setArray(key: string, value: Record<string, any>[]): Promise<void> {
        await this.set(key, value);
    }

    async getArray(key: string): Promise<Record<string, any>[] | null> {
        return await this.get(key);
    }

    async updateArray(key: string, value: Record<string, any>): Promise<void> {
        const existingArray = await this.getArray(key);
        if (existingArray) {
            existingArray.push(value);
            await this.setArray(key, existingArray);
        } else {
            throw new BadRequestException(`Array with key "${key}" does not exist.`);
        }
    }

    // Hash operations
    async hSet(hash: string, key: string, value: string): Promise<void> {
        await this.client.hSet(hash, key, value);
    }

    async hGet(hash: string, key: string): Promise<string | null> {
        return await this.client.hGet(hash, key);
    }

    async hDel(hash: string, key: string): Promise<void> {
        await this.client.hDel(hash, key);
    }

    async hGetAll(hash: string): Promise<Record<string, string>> {
        return await this.client.hGetAll(hash);
    }

    async hUpdate(hash: string, key: string, value: string): Promise<void> {
        await this.hSet(hash, key, value);
    }
}
