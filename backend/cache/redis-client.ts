import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheError } from '../utils/errors';
import { CacheStats } from '../types';

export class RedisClient {
  private client: Redis;
  private connected: boolean = false;

  constructor() {
    this.client = new Redis(config.redis.url, {
      password: config.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.client.on('connect', () => {
      this.connected = true;
      logger.info('Redis connected');
    });

    this.client.on('error', (err) => {
      logger.error('Redis error:', err);
      this.connected = false;
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      throw new CacheError(`Failed to get key: ${error}`, 'get', key);
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      const expirySeconds = ttl || config.redis.cacheTTL;
      await this.client.setex(key, expirySeconds, value);
    } catch (error) {
      throw new CacheError(`Failed to set key: ${error}`, 'set', key);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      throw new CacheError(`Failed to delete key: ${error}`, 'del', key);
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    try {
      return await this.client.mget(...keys);
    } catch (error) {
      throw new CacheError(`Failed to mget keys: ${error}`, 'mget');
    }
  }

  async mset(entries: Record<string, string>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.client.pipeline();
      const expirySeconds = ttl || config.redis.cacheTTL;

      for (const [key, value] of Object.entries(entries)) {
        pipeline.setex(key, expirySeconds, value);
      }

      await pipeline.exec();
    } catch (error) {
      throw new CacheError(`Failed to mset entries: ${error}`, 'mset');
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();

      // Parse Redis INFO output
      const hitRate = this.parseInfoValue(info, 'keyspace_hits');
      const missRate = this.parseInfoValue(info, 'keyspace_misses');
      const totalRequests = hitRate + missRate;
      const hitRatePercent = totalRequests > 0 ? (hitRate / totalRequests) * 100 : 0;

      return {
        total_keys: dbSize,
        hit_rate: hitRatePercent,
        miss_rate: 100 - hitRatePercent,
        size_mb: 0, // TODO: Calculate actual size
        oldest_key_age_hours: 0,
        newest_key_age_hours: 0
      };
    } catch (error) {
      throw new CacheError(`Failed to get cache stats: ${error}`, 'stats');
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      throw new CacheError(`Failed to invalidate pattern: ${error}`, 'invalidate', pattern);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    this.connected = false;
  }

  private parseInfoValue(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1], 10) : 0;
  }
}
