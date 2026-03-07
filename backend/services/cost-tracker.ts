import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';
import { config } from '../config';
import { APICallMetadata, CostStats } from '../types';

export class CostTracker {
  private db: SupabaseClient;
  private costs: Record<string, number>;

  constructor() {
    this.db = new SupabaseClient();
    this.costs = config.costs;
  }

  /**
   * Record an API call with cost tracking
   */
  async recordAPICall(
    service: string,
    endpoint: string,
    params: Record<string, any>,
    cached: boolean,
    latencyMs: number,
    auditId?: string,
    httpStatus?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const cost = cached ? 0 : this.getProviderCost(service);

      const metadata: APICallMetadata = {
        audit_id: auditId,
        service,
        endpoint,
        request_params: params,
        cache_hit: cached,
        latency_ms: latencyMs,
        cost_usd: cost,
        called_at: new Date(),
        http_status: httpStatus,
        error_message: errorMessage
      };

      await this.db.saveAPICall(metadata);

      logger.debug(`API call tracked: ${service}/${endpoint} (cached=${cached}, cost=$${cost})`);
    } catch (error) {
      logger.error('Failed to record API call', error);
      // Non-critical - don't throw
    }
  }

  /**
   * Get total cost for a specific audit
   */
  async getAuditCost(auditId: string): Promise<number> {
    try {
      const calls = await this.db.query<APICallMetadata>('api_calls', {
        audit_id: auditId
      });

      const totalCost = calls.reduce((sum, call) => sum + call.cost_usd, 0);

      logger.debug(`Audit ${auditId} total cost: $${totalCost.toFixed(4)}`);

      return totalCost;
    } catch (error) {
      logger.error('Failed to get audit cost', error);
      return 0;
    }
  }

  /**
   * Get daily cost breakdown
   */
  async getDailyCosts(): Promise<CostStats> {
    try {
      const calls = await this.db.query<APICallMetadata>('api_calls', {
        limit: 10000 // Last 10K calls
      });

      const totalCost = calls.reduce((sum, call) => sum + call.cost_usd, 0);

      // Group by provider
      const byProvider: Record<string, number> = {};
      calls.forEach(call => {
        byProvider[call.service] = (byProvider[call.service] || 0) + call.cost_usd;
      });

      // Group by day
      const byDay: Record<string, number> = {};
      calls.forEach(call => {
        const day = call.called_at.toISOString().split('T')[0];
        byDay[day] = (byDay[day] || 0) + call.cost_usd;
      });

      // Calculate cache savings
      const cachedCalls = calls.filter(c => c.cache_hit);
      const cacheSavings = cachedCalls.reduce((sum, call) => {
        const wouldHaveCost = this.getProviderCost(call.service);
        return sum + wouldHaveCost;
      }, 0);

      return {
        total: totalCost,
        by_provider: byProvider,
        by_day: byDay,
        cache_savings: cacheSavings
      };
    } catch (error) {
      logger.error('Failed to get daily costs', error);
      return {
        total: 0,
        by_provider: {},
        by_day: {},
        cache_savings: 0
      };
    }
  }

  /**
   * Get cache ROI (return on investment)
   */
  async getCacheROI(): Promise<{
    total_calls: number;
    cache_hits: number;
    cache_rate: number;
    savings_usd: number;
  }> {
    try {
      const calls = await this.db.query<APICallMetadata>('api_calls', {
        limit: 10000
      });

      const totalCalls = calls.length;
      const cacheHits = calls.filter(c => c.cache_hit).length;
      const cacheRate = totalCalls > 0 ? (cacheHits / totalCalls) * 100 : 0;

      const savings = calls
        .filter(c => c.cache_hit)
        .reduce((sum, call) => sum + this.getProviderCost(call.service), 0);

      return {
        total_calls: totalCalls,
        cache_hits: cacheHits,
        cache_rate: cacheRate,
        savings_usd: savings
      };
    } catch (error) {
      logger.error('Failed to get cache ROI', error);
      return {
        total_calls: 0,
        cache_hits: 0,
        cache_rate: 0,
        savings_usd: 0
      };
    }
  }

  /**
   * Get cost per provider from config
   */
  private getProviderCost(provider: string): number {
    const normalizedProvider = provider.toLowerCase();
    return this.costs[normalizedProvider] || 0;
  }
}
