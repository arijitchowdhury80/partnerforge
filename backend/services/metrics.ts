import { logger } from '../utils/logger';
import { MetricsSnapshot } from '../types';
import { CostTracker } from './cost-tracker';
import { RedisClient } from '../cache/redis-client';

interface LatencyRecord {
  endpoint: string;
  latency_ms: number;
  timestamp: number;
}

interface ErrorRecord {
  type: string;
  message: string;
  timestamp: number;
}

export class MetricsCollector {
  private cacheHits: Map<string, number> = new Map();
  private cacheMisses: Map<string, number> = new Map();
  private latencyRecords: LatencyRecord[] = [];
  private errorRecords: ErrorRecord[] = [];
  private costTracker: CostTracker;
  private redis: RedisClient;

  constructor() {
    this.costTracker = new CostTracker();
    this.redis = new RedisClient();
  }

  /**
   * Record a cache hit
   */
  recordCacheHit(provider: string): void {
    const count = this.cacheHits.get(provider) || 0;
    this.cacheHits.set(provider, count + 1);
    logger.debug(`Cache hit: ${provider} (total: ${count + 1})`);
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(provider: string): void {
    const count = this.cacheMisses.get(provider) || 0;
    this.cacheMisses.set(provider, count + 1);
    logger.debug(`Cache miss: ${provider} (total: ${count + 1})`);
  }

  /**
   * Record API latency
   */
  recordLatency(endpoint: string, latencyMs: number): void {
    this.latencyRecords.push({
      endpoint,
      latency_ms: latencyMs,
      timestamp: Date.now()
    });

    // Keep only last 1000 records
    if (this.latencyRecords.length > 1000) {
      this.latencyRecords.shift();
    }

    logger.debug(`Latency recorded: ${endpoint} = ${latencyMs}ms`);
  }

  /**
   * Record an error
   */
  recordError(type: string, message: string): void {
    this.errorRecords.push({
      type,
      message,
      timestamp: Date.now()
    });

    // Keep only last 500 errors
    if (this.errorRecords.length > 500) {
      this.errorRecords.shift();
    }

    logger.warn(`Error recorded: ${type} - ${message}`);
  }

  /**
   * Get complete metrics snapshot
   */
  async getMetricsSnapshot(): Promise<MetricsSnapshot> {
    try {
      // Cache metrics
      const totalHits = Array.from(this.cacheHits.values()).reduce((a, b) => a + b, 0);
      const totalMisses = Array.from(this.cacheMisses.values()).reduce((a, b) => a + b, 0);
      const totalRequests = totalHits + totalMisses;
      const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

      // Cost metrics
      const costs = await this.costTracker.getDailyCosts();

      // Latency metrics (p50, p95, p99)
      const latencies = this.latencyRecords
        .map(r => r.latency_ms)
        .sort((a, b) => a - b);

      const p50 = this.percentile(latencies, 0.5);
      const p95 = this.percentile(latencies, 0.95);
      const p99 = this.percentile(latencies, 0.99);

      // Error metrics
      const errorsByType: Record<string, number> = {};
      this.errorRecords.forEach(err => {
        errorsByType[err.type] = (errorsByType[err.type] || 0) + 1;
      });

      return {
        cache: {
          hit_rate: hitRate,
          miss_rate: 100 - hitRate,
          total_requests: totalRequests
        },
        costs,
        latency: {
          p50,
          p95,
          p99
        },
        errors: {
          total: this.errorRecords.length,
          by_type: errorsByType
        }
      };
    } catch (error) {
      logger.error('Failed to get metrics snapshot', error);
      throw error;
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.cacheHits.clear();
    this.cacheMisses.clear();
    this.latencyRecords = [];
    this.errorRecords = [];
    logger.info('Metrics reset');
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();
