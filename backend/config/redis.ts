import { config } from './index';

export interface RedisConfig {
  url: string;
  password?: string;
  cacheTTL: number;
  retryStrategy: (times: number) => number;
  maxRetriesPerRequest: number;
}

export const redisConfig: RedisConfig = {
  url: config.redis.url,
  password: config.redis.password,
  cacheTTL: config.redis.cacheTTL,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
};
