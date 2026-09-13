import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { ChangeStream } from 'mongodb';
import { debounce } from 'lodash';
import * as momentTz from 'moment-timezone';

const ASIA_CALCUTTA_TIMEZONE = 'Asia/Calcutta';
const TRENDING_ORDERS_CACHE_COLLECTION = 'topOrdersTodayCache';
const TRENDING_PRODUCTS_CACHE_COLLECTION = 'topProductsTodayCache';
const DEBOUNCE_DELAY_MS = 60000;      // 1 minute
const STREAM_RESTART_DELAY_MS = 5000; // 5 seconds

@Injectable()
export class MongoViewService implements OnModuleInit, OnModuleDestroy {
    private changeStream: ChangeStream | null = null;
    private debouncedRefresh: () => void;
    private isStreamActive = false;

    constructor(@InjectConnection() private readonly connection: Connection) {
        this.debouncedRefresh = debounce(async () => {
            await this.refreshTrendingOrdersCache();
            await this.refreshTrendingProductsCache();
        }, DEBOUNCE_DELAY_MS);
    }

    async onModuleInit() {
        await this.refreshTrendingOrdersCache();
        await this.refreshTrendingProductsCache();
        this.watchOrderChanges();
    }

    async onModuleDestroy() {
        await this.stopChangeStream();
    }

    private watchOrderChanges() {
        try {
            const collection = this.connection.db.collection('orders');

            this.changeStream = collection.watch(
                [{ $match: { operationType: 'insert' } }],
                { fullDocument: 'updateLookup' },
            );

            this.isStreamActive = true;
            console.log(`[ChangeStream] Watching orders collection...`);

            this.changeStream.on('change', (change) => {
                console.log(`[ChangeStream] New order detected — debounce timer reset`);
                this.debouncedRefresh(); // waits 1 min after last order, then refreshes
            });

            this.changeStream.on('error', (error) => {
                console.error(`[ChangeStream] Error:`, error.message);
                this.isStreamActive = false;
                this.restartChangeStream();
            });

            this.changeStream.on('close', () => {
                console.warn(`[ChangeStream] Stream closed`);
                this.isStreamActive = false;
            });

        } catch (error: any) {
            console.error(`[ChangeStream] Failed to start:`, error.message);
            this.restartChangeStream();
        }
    }

    private restartChangeStream() {
        console.log(`[ChangeStream] Restarting in ${STREAM_RESTART_DELAY_MS / 1000}s...`);
        setTimeout(() => {
            this.watchOrderChanges();
        }, STREAM_RESTART_DELAY_MS);
    }

    private async stopChangeStream() {
        if (this.changeStream) {
            await this.changeStream.close();
            this.changeStream = null;
            this.isStreamActive = false;
            console.log(`[ChangeStream] Stopped cleanly`);
        }
    }

    @Cron('0 */5 * * * *')
    async handleCronTrendingOrders() {
        console.log(`[Cron] Triggering trending orders/products cache refresh`);
        await this.refreshTrendingOrdersCache();
        await this.refreshTrendingProductsCache();
    }

    async refreshTrendingOrdersCache(): Promise<void> {
        try {
            const startOfDay = momentTz.tz(new Date(), ASIA_CALCUTTA_TIMEZONE)
                .startOf('day')
                .utc()
                .toDate();

            await this.connection.db.collection('orders').aggregate([
                { $match: { createdAt: { $gte: startOfDay } } },
                { $sort: { restaurantId: 1, total: -1 } },
                {
                    $group: {
                        _id: '$restaurantId',
                        topOrders: { $push: '$$ROOT' },
                    },
                },
                {
                    $project: {
                        topOrders: { $slice: ['$topOrders', 10] }, // top 10 per restaurant
                    },
                },
                { $unwind: '$topOrders' },
                { $replaceRoot: { newRoot: '$topOrders' } },
                { $out: TRENDING_ORDERS_CACHE_COLLECTION },
            ]).toArray();

            await this.connection.db
                .collection(TRENDING_ORDERS_CACHE_COLLECTION)
                .createIndex({ restaurantId: 1, total: -1 });

            console.log(`[Cache] Refreshed at ${new Date().toISOString()}`);

        } catch (error: any) {
            console.error(`[Cache] Refresh failed:`, error.message);
        }
    }

    async refreshTrendingProductsCache(): Promise<void> {
        try {
            const startOfDay = momentTz.tz(new Date(), ASIA_CALCUTTA_TIMEZONE)
                .startOf('day')
                .utc()
                .toDate();

            await this.connection.db.collection('orders').aggregate([
                { $match: { createdAt: { $gte: startOfDay } } },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: {
                            restaurantId: '$restaurantId',
                            productId: '$items.productId',
                        },
                        productName: { $first: '$items.productName' },
                        count: { $sum: '$items.quantity' },
                        orderCount: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        restaurantId: '$_id.restaurantId',
                        productId: '$_id.productId',
                        productName: 1,
                        count: 1,
                        orderCount: 1,
                    },
                },
                { $out: TRENDING_PRODUCTS_CACHE_COLLECTION },
            ]).toArray();

            await this.connection.db
                .collection(TRENDING_PRODUCTS_CACHE_COLLECTION)
                .createIndex({ restaurantId: 1, count: -1 });

            console.log(`[Cache] Trending products refreshed at ${new Date().toISOString()}`);
        } catch (error: any) {
            console.error(`[Cache] Trending products refresh failed:`, error.message);
        }
    }

    async getTrendingOrders(clientId: string) {
        try {
            const collection = this.connection.db.collection(TRENDING_ORDERS_CACHE_COLLECTION);

            const cached = await collection
                .find({ restaurantId: clientId })
                .sort({ total: -1 })
                .limit(10)
                .toArray();

            if (cached.length === 0) {
                console.warn(`[Cache] Empty for client ${clientId} — falling back to live query`);
                return await this.getLiveTopOrders(clientId);
            }

            return cached;

        } catch (error) {
            console.warn(`[Cache] Read failed — falling back to live query`);
            return await this.getLiveTopOrders(clientId);
        }
    }

    private async getLiveTopOrders(clientId: string) {
        const startOfDay = momentTz.tz(new Date(), ASIA_CALCUTTA_TIMEZONE)
            .startOf('day')
            .utc()
            .toDate();

        return this.connection.db
            .collection('orders')
            .find({ restaurantId: clientId, createdAt: { $gte: startOfDay } })
            .sort({ total: -1 })
            .limit(10)
            .toArray();
    }

    async getTrendingProducts(clientId: string): Promise<{ productId: string; productName: string; count: number; orderCount: number }[]> {
        try {
            const cached = await this.connection.db
                .collection(TRENDING_PRODUCTS_CACHE_COLLECTION)
                .find({ restaurantId: clientId })
                .sort({ count: -1 })
                .toArray();

            if (cached.length === 0) {
                return await this.getLiveTrendingProducts(clientId);
            }

            return cached.map((doc: any) => ({
                productId: doc.productId,
                productName: doc.productName,
                count: doc.count,
                orderCount: doc.orderCount ?? 0,
            }));
        } catch (error) {
            console.warn(`[Cache] Trending products read failed — falling back to live query`);
            return await this.getLiveTrendingProducts(clientId);
        }
    }

    private async getLiveTrendingProducts(clientId: string): Promise<{ productId: string; productName: string; count: number; orderCount: number }[]> {
        const startOfDay = momentTz.tz(new Date(), ASIA_CALCUTTA_TIMEZONE)
            .startOf('day')
            .utc()
            .toDate();

        const result = await this.connection.db
            .collection('orders')
            .aggregate([
                { $match: { restaurantId: clientId, createdAt: { $gte: startOfDay } } },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.productId',
                        productName: { $first: '$items.productName' },
                        count: { $sum: '$items.quantity' },
                        orderCount: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                {
                    $project: {
                        _id: 0,
                        productId: '$_id',
                        productName: 1,
                        count: 1,
                        orderCount: 1,
                    },
                },
            ])
            .toArray();

        return result as { productId: string; productName: string; count: number; orderCount: number }[];
    }

    getStreamStatus() {
        return {
            isStreamActive: this.isStreamActive,
            cacheCollection: TRENDING_ORDERS_CACHE_COLLECTION,
            trendingProductsCacheCollection: TRENDING_PRODUCTS_CACHE_COLLECTION,
        };
    }
}