import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimilarWebClient, DateRange } from '../similarweb';
import { HttpClient } from '../http-client';

// Mock the HttpClient
vi.mock('../http-client');
vi.mock('../config', () => ({
  config: {
    redis: {
      cacheTTL: 604800
    },
    costs: {
      similarweb: 0.03
    },
    rateLimit: {
      similarweb: 2
    }
  }
}));
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('SimilarWebClient', () => {
  let client: SimilarWebClient;
  let mockHttpClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock HTTP client
    mockHttpClient = {
      get: vi.fn(),
      client: {
        defaults: {
          headers: {
            common: {}
          }
        }
      }
    };

    // Mock HttpClient constructor
    (HttpClient as any).mockImplementation(() => mockHttpClient);

    // Set environment variable
    process.env.SIMILARWEB_API_KEY = 'test-api-key';

    client = new SimilarWebClient();
  });

  afterEach(() => {
    delete process.env.SIMILARWEB_API_KEY;
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(HttpClient).toHaveBeenCalledWith(
        'https://api.similarweb.com/v1',
        604800,
        30000
      );
    });

    it('should set API key in headers', () => {
      expect(mockHttpClient.client.defaults.headers.common['api-key']).toBe('test-api-key');
    });
  });

  describe('getTrafficData', () => {
    it('should fetch traffic data with correct parameters', async () => {
      const mockResponse = {
        data: {
          visits: [
            { date: '2025-12', visits: 100900000 }
          ],
          meta: {
            request: { domain: 'costco.com' },
            status: 'success',
            last_updated: '2025-12-15'
          }
        },
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 250
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const dateRange: DateRange = {
        start: '2025-06',
        end: '2025-12'
      };

      const result = await client.getTrafficData('costco.com', dateRange);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/website/costco.com/total-traffic-and-engagement/desktop_mau_visits',
        {
          start_date: '2025-06',
          end_date: '2025-12',
          country: 'ww',
          granularity: 'monthly'
        },
        {
          rateLimitKey: 'similarweb',
          persist: true
        }
      );

      expect(result.data.visits).toHaveLength(1);
      expect(result.data.visits[0].visits).toBe(100900000);
    });
  });

  describe('getEngagementMetrics', () => {
    it('should fetch engagement metrics', async () => {
      const mockResponse = {
        data: {
          bounce_rate: [{ date: '2025-12', bounce_rate: 0.372 }],
          pages_per_visit: [{ date: '2025-12', pages_per_visit: 5.2 }],
          avg_visit_duration: [{ date: '2025-12', avg_visit_duration: 245 }],
          meta: {
            request: { domain: 'costco.com' },
            status: 'success',
            last_updated: '2025-12-15'
          }
        },
        meta: {
          source: 'cache',
          cached: true,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 5
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const dateRange: DateRange = {
        start: '2025-12',
        end: '2025-12'
      };

      const result = await client.getEngagementMetrics('costco.com', dateRange);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/website/costco.com/total-traffic-and-engagement/engagement',
        {
          start_date: '2025-12',
          end_date: '2025-12',
          country: 'ww',
          granularity: 'monthly'
        },
        {
          rateLimitKey: 'similarweb',
          persist: true
        }
      );

      expect(result.data.bounce_rate[0].bounce_rate).toBe(0.372);
      expect(result.meta.cached).toBe(true);
    });
  });

  describe('getTrafficSources', () => {
    it('should fetch traffic source breakdown', async () => {
      const mockResponse = {
        data: {
          channels: {
            direct: 0.45,
            search: 0.25,
            social: 0.15,
            referral: 0.10,
            email: 0.03,
            display_ads: 0.02
          },
          search_breakdown: {
            organic: 0.80,
            paid: 0.20
          },
          meta: {
            request: { domain: 'costco.com' },
            status: 'success',
            last_updated: '2025-12-15'
          }
        },
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 180
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const dateRange: DateRange = {
        start: '2025-12',
        end: '2025-12'
      };

      const result = await client.getTrafficSources('costco.com', dateRange);

      expect(result.data.channels.direct).toBe(0.45);
      expect(result.data.search_breakdown.organic).toBe(0.80);
    });
  });

  describe('getSimilarSites', () => {
    it('should fetch competitor data with default limit', async () => {
      const mockResponse = {
        data: {
          sites: [
            { domain: 'target.com', similarity_score: 0.85 },
            { domain: 'walmart.com', similarity_score: 0.82 }
          ],
          meta: {
            request: { domain: 'costco.com' },
            status: 'success',
            last_updated: '2025-12-15'
          }
        },
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 200
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const result = await client.getSimilarSites('costco.com');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/website/costco.com/similar-sites/similarsites',
        { limit: 10 },
        {
          rateLimitKey: 'similarweb',
          persist: true
        }
      );

      expect(result.data.sites).toHaveLength(2);
      expect(result.data.sites[0].domain).toBe('target.com');
    });

    it('should fetch competitor data with custom limit', async () => {
      const mockResponse = {
        data: {
          sites: [],
          meta: {
            request: { domain: 'costco.com' },
            status: 'success',
            last_updated: '2025-12-15'
          }
        },
        meta: {
          source: 'cache',
          cached: true,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 3
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      await client.getSimilarSites('costco.com', 5);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/website/costco.com/similar-sites/similarsites',
        { limit: 5 },
        {
          rateLimitKey: 'similarweb',
          persist: true
        }
      );
    });
  });

  describe('getTopKeywords', () => {
    it('should fetch keyword data with default limit', async () => {
      const mockResponse = {
        data: {
          keywords: [
            {
              keyword: 'costco tires',
              visits_share: 0.025,
              position: 1,
              volume: 50000
            }
          ],
          meta: {
            request: { domain: 'costco.com' },
            status: 'success',
            last_updated: '2025-12-15'
          }
        },
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 220
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const result = await client.getTopKeywords('costco.com');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/website/costco.com/keywords/top',
        {
          country: 'ww',
          limit: 50
        },
        {
          rateLimitKey: 'similarweb',
          persist: true
        }
      );

      expect(result.data.keywords[0].keyword).toBe('costco tires');
    });
  });

  describe('getDemographics', () => {
    it('should fetch demographics data', async () => {
      const mockResponse = {
        data: {
          age_distribution: {
            '18-24': 0.15,
            '25-34': 0.30,
            '35-44': 0.25,
            '45-54': 0.18,
            '55-64': 0.08,
            '65+': 0.04
          },
          gender_distribution: {
            male: 0.52,
            female: 0.48
          },
          meta: {
            request: { domain: 'costco.com' },
            status: 'success',
            last_updated: '2025-12-15'
          }
        },
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 190
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const result = await client.getDemographics('costco.com');

      expect(result.data.age_distribution['25-34']).toBe(0.30);
      expect(result.data.gender_distribution.male).toBe(0.52);
    });
  });

  describe('fetchAllData', () => {
    it('should fetch all endpoints in parallel', async () => {
      const mockResponse = {
        data: { mock: 'data' },
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 200
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const dateRange: DateRange = {
        start: '2025-12',
        end: '2025-12'
      };

      const result = await client.fetchAllData('costco.com', dateRange);

      // Should have called all 14 endpoints
      expect(mockHttpClient.get).toHaveBeenCalledTimes(15); // 14 main + 1 demographics

      // Check result structure
      expect(result).toHaveProperty('traffic');
      expect(result).toHaveProperty('engagement');
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('geography');
      expect(result).toHaveProperty('demographics');
      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('competitors');
      expect(result).toHaveProperty('interests');
      expect(result).toHaveProperty('technologies');
      expect(result).toHaveProperty('referrals');
      expect(result).toHaveProperty('popularPages');
      expect(result).toHaveProperty('leadingFolders');
      expect(result).toHaveProperty('landingPages');
      expect(result).toHaveProperty('keywordCompetitors');
      expect(result).toHaveProperty('websiteRank');
      expect(result).toHaveProperty('meta');

      // Check meta information
      expect(result.meta.totalEndpoints).toBe(14);
      expect(result.meta.cacheHits).toBe(0);
      expect(result.meta.cacheMisses).toBe(14);
    });

    it('should calculate cache hits correctly', async () => {
      let callCount = 0;
      mockHttpClient.get.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: { mock: 'data' },
          meta: {
            source: callCount % 2 === 0 ? 'cache' : 'api',
            cached: callCount % 2 === 0,
            timestamp: '2025-12-15T10:00:00Z',
            latency_ms: callCount % 2 === 0 ? 5 : 200
          }
        });
      });

      const dateRange: DateRange = {
        start: '2025-12',
        end: '2025-12'
      };

      const result = await client.fetchAllData('costco.com', dateRange);

      // Half should be cache hits (15 total calls, 7 cache hits)
      expect(result.meta.cacheHits).toBeGreaterThan(0);
      expect(result.meta.cacheHits + result.meta.cacheMisses).toBe(14);
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from HTTP client', async () => {
      const error = new Error('API Error');
      mockHttpClient.get.mockRejectedValue(error);

      const dateRange: DateRange = {
        start: '2025-12',
        end: '2025-12'
      };

      await expect(client.getTrafficData('costco.com', dateRange)).rejects.toThrow('API Error');
    });

    it('should log error in fetchAllData', async () => {
      const error = new Error('Network Error');
      mockHttpClient.get.mockRejectedValue(error);

      const dateRange: DateRange = {
        start: '2025-12',
        end: '2025-12'
      };

      await expect(client.fetchAllData('costco.com', dateRange)).rejects.toThrow('Network Error');
    });
  });

  describe('Rate Limiting', () => {
    it('should pass rate limit key to all endpoints', async () => {
      const mockResponse = {
        data: {},
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 200
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const dateRange: DateRange = {
        start: '2025-12',
        end: '2025-12'
      };

      await client.getTrafficData('costco.com', dateRange);
      await client.getEngagementMetrics('costco.com', dateRange);
      await client.getSimilarSites('costco.com');

      // All calls should have rate limit key
      const calls = mockHttpClient.get.mock.calls;
      calls.forEach((call: any) => {
        expect(call[2]).toHaveProperty('rateLimitKey', 'similarweb');
      });
    });
  });

  describe('Persistence', () => {
    it('should set persist flag on all endpoints', async () => {
      const mockResponse = {
        data: {},
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-12-15T10:00:00Z',
          latency_ms: 200
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const dateRange: DateRange = {
        start: '2025-12',
        end: '2025-12'
      };

      await client.getTrafficData('costco.com', dateRange);
      await client.getDemographics('costco.com');

      // All calls should have persist flag
      const calls = mockHttpClient.get.mock.calls;
      calls.forEach((call: any) => {
        expect(call[2]).toHaveProperty('persist', true);
      });
    });
  });
});
