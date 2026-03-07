import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { RedisClient } from '../cache/redis-client';
import { logger } from '../utils/logger';
import { APIError, RateLimitError } from '../utils/errors';
import { APIResponse, RequestOptions, RateLimitState } from '../types';
import crypto from 'crypto';

export class HttpClient {
  private client: AxiosInstance;
  private redis: RedisClient;
  private cacheTTL: number;
  private rateLimits: Map<string, RateLimitState> = new Map();

  constructor(
    baseURL: string,
    cacheTTL: number = 604800,
    timeout: number = 30000
  ) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Algolia-Arian/1.0'
      }
    });

    this.redis = new RedisClient();
    this.cacheTTL = cacheTTL;

    // Configure retry logic
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 ||
          error.response?.status === 503
        );
      },
      onRetry: (retryCount, error) => {
        logger.warn(`Retry attempt ${retryCount} for ${error.config?.url}`);
      }
    });
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    const startTime = Date.now();
    const cacheKey = this.buildCacheKey(endpoint, params);

    try {
      // 1. Check cache (unless skipCache is true)
      if (!options?.skipCache) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          logger.debug(`Cache hit: ${cacheKey}`);
          const data = JSON.parse(cached);
          return {
            data,
            meta: {
              source: 'cache',
              cached: true,
              timestamp: new Date().toISOString(),
              latency_ms: Date.now() - startTime
            }
          };
        }
      }

      // 2. Rate limit check
      if (options?.rateLimitKey) {
        await this.rateLimit(options.rateLimitKey);
      }

      // 3. Make API call
      logger.debug(`API call: ${endpoint}`, params);
      const response = await this.client.get(endpoint, { params });

      // 4. Save to cache
      const ttl = options?.cacheTTL || this.cacheTTL;
      await this.redis.set(cacheKey, JSON.stringify(response.data), ttl);

      const latency = Date.now() - startTime;
      logger.info(`API success: ${endpoint} (${latency}ms)`);

      return {
        data: response.data,
        meta: {
          source: 'api',
          cached: false,
          timestamp: new Date().toISOString(),
          latency_ms: latency
        }
      };
    } catch (error) {
      this.handleError(error as AxiosError, endpoint);
      throw error; // TypeScript: this line never executes, but required for type safety
    }
  }

  async post<T>(
    endpoint: string,
    body: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    const startTime = Date.now();

    try {
      if (options?.rateLimitKey) {
        await this.rateLimit(options.rateLimitKey);
      }

      logger.debug(`API POST: ${endpoint}`, body);
      const response = await this.client.post(endpoint, body);

      const latency = Date.now() - startTime;
      logger.info(`API POST success: ${endpoint} (${latency}ms)`);

      return {
        data: response.data,
        meta: {
          source: 'api',
          cached: false,
          timestamp: new Date().toISOString(),
          latency_ms: latency
        }
      };
    } catch (error) {
      this.handleError(error as AxiosError, endpoint);
      throw error;
    }
  }

  private buildCacheKey(endpoint: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return `api:${endpoint}`;
    }

    // Sort params for consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    const paramHash = crypto
      .createHash('md5')
      .update(JSON.stringify(sortedParams))
      .digest('hex');

    return `api:${endpoint}:${paramHash}`;
  }

  private async rateLimit(key: string): Promise<void> {
    const now = Date.now();
    let state = this.rateLimits.get(key);

    if (!state) {
      // Initialize rate limit state (default: 5 requests per second)
      state = {
        tokens: 5,
        last_refill: now,
        max_tokens: 5,
        refill_rate: 5 // tokens per second
      };
      this.rateLimits.set(key, state);
    }

    // Refill tokens based on time elapsed
    const elapsed = (now - state.last_refill) / 1000;
    state.tokens = Math.min(state.max_tokens, state.tokens + elapsed * state.refill_rate);
    state.last_refill = now;

    // Check if we have tokens available
    if (state.tokens < 1) {
      const waitTime = Math.ceil((1 - state.tokens) / state.refill_rate * 1000);
      logger.warn(`Rate limit hit for ${key}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      state.tokens = 1;
    }

    // Consume one token
    state.tokens -= 1;
  }

  private handleError(error: AxiosError, endpoint: string): never {
    const status = error.response?.status || 0;
    const message = error.response?.data || error.message;

    logger.error(`API error: ${endpoint} (${status})`, { error: message });

    if (status === 429) {
      const retryAfter = parseInt(error.response?.headers['retry-after'] || '60', 10);
      throw new RateLimitError(endpoint, retryAfter);
    }

    throw new APIError(
      status,
      typeof message === 'string' ? message : JSON.stringify(message),
      endpoint,
      status >= 500 // Retryable if 5xx
    );
  }
}
