/**
 * SimilarWeb Client Test Suite
 *
 * Unit tests with mocks + one integration test (skipped by default).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SimilarWebClient,
  SimilarWebError,
  SimilarWebRateLimitError,
  SimilarWebTrafficData,
  SimilarWebTrafficSources,
  SimilarWebGeography,
  SimilarWebDemographics,
  SimilarWebKeyword,
  SimilarWebCompetitor,
  SimilarWebReferral,
  SimilarWebPage,
  SimilarWebAudienceInterest,
  SimilarWebFullData,
} from '../clients/similarweb';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock import.meta.env
vi.mock('import.meta', () => ({
  env: {
    VITE_SIMILARWEB_API_KEY: 'test-api-key-123',
  },
}));

describe('SimilarWebClient', () => {
  let client: SimilarWebClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SimilarWebClient('test-api-key-123');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper to create mock response
  const mockResponse = (data: unknown, status = 200) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(data),
    });
  };

  // ============================================================================
  // Constructor & Configuration
  // ============================================================================
  describe('constructor', () => {
    it('should use provided API key', () => {
      const customClient = new SimilarWebClient('custom-key');
      expect(customClient.hasApiKey()).toBe(true);
    });

    it('should fallback to env var when empty string passed', () => {
      // When empty string is passed, constructor falls back to env var
      // In test environment, env var is stubbed with a value
      const noKeyClient = new SimilarWebClient('');
      // Since test setup stubs VITE_SIMILARWEB_API_KEY, this will be true
      expect(noKeyClient.hasApiKey()).toBe(true);
    });

    it('should have no API key when env var also missing', () => {
      // Temporarily unstub the env var
      vi.stubEnv('VITE_SIMILARWEB_API_KEY', '');
      const noKeyClient = new SimilarWebClient('');
      expect(noKeyClient.hasApiKey()).toBe(false);
      // Restore the stub
      vi.stubEnv('VITE_SIMILARWEB_API_KEY', 'test-api-key-123');
    });
  });

  // ============================================================================
  // 1. Traffic & Engagement
  // ============================================================================
  describe('getTrafficAndEngagement', () => {
    it('should return traffic data for valid domain', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockResponse({
            visits: 5000000,
            pages_per_visit: 4.5,
            average_visit_duration: 180,
            bounce_rate: 0.35,
            mom_growth: 0.05,
            category: 'Retail',
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            global_rank: 1500,
            country_rank: 500,
            category_rank: 25,
          })
        );

      const result = await client.getTrafficAndEngagement('walmart.com');

      expect(result).not.toBeNull();
      expect(result!.domain).toBe('walmart.com');
      expect(result!.monthly_visits).toBe(5000000);
      expect(result!.pages_per_visit).toBe(4.5);
      expect(result!.avg_visit_duration).toBe(180);
      expect(result!.bounce_rate).toBe(0.35);
      expect(result!.monthly_visits_trend).toBe(0.05);
      expect(result!.global_rank).toBe(1500);
    });

    it('should return null for invalid domain', async () => {
      mockFetch.mockResolvedValue(mockResponse(null, 404));

      const result = await client.getTrafficAndEngagement('nonexistent-domain-xyz.com');

      expect(result).toBeNull();
    });

    it('should handle API rate limits', async () => {
      mockFetch.mockResolvedValue(mockResponse({ error: 'rate_limit' }, 429));

      await expect(client.getTrafficAndEngagement('walmart.com')).rejects.toThrow(
        SimilarWebRateLimitError
      );
    });

    it('should normalize domain with protocol and www', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ visits: 1000000 }))
        .mockResolvedValueOnce(mockResponse(null, 404));

      const result = await client.getTrafficAndEngagement('https://www.walmart.com/');

      expect(result!.domain).toBe('walmart.com');
    });
  });

  // ============================================================================
  // 2. Traffic Sources
  // ============================================================================
  describe('getTrafficSources', () => {
    it('should return source breakdown', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          direct: 0.4,
          search: 0.3,
          referrals: 0.15,
          social: 0.08,
          mail: 0.02,
          paid_referrals: 0.03,
          display_ads: 0.02,
        })
      );

      const result = await client.getTrafficSources('walmart.com');

      expect(result).not.toBeNull();
      expect(result!.direct).toBe(40);
      expect(result!.search).toBe(30);
      expect(result!.referral).toBe(15);
      expect(result!.social).toBe(8);
      expect(result!.mail).toBe(2);
      expect(result!.paid).toBe(5); // paid_referrals + display_ads
    });

    it('should handle missing data gracefully', async () => {
      mockFetch.mockResolvedValue(mockResponse({}));

      const result = await client.getTrafficSources('walmart.com');

      expect(result).not.toBeNull();
      expect(result!.direct).toBe(0);
      expect(result!.search).toBe(0);
    });

    it('should handle percentage values already in 0-100 range', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          direct: 40, // Already a percentage
          search: 30,
        })
      );

      const result = await client.getTrafficSources('walmart.com');

      expect(result!.direct).toBe(40);
      expect(result!.search).toBe(30);
    });
  });

  // ============================================================================
  // 3. Geography
  // ============================================================================
  describe('getGeography', () => {
    it('should return top countries', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          records: [
            { country: 840, country_name: 'United States', share: 0.65 },
            { country: 826, country_name: 'United Kingdom', share: 0.15 },
            { country: 124, country_name: 'Canada', share: 0.1 },
          ],
        })
      );

      const result = await client.getGeography('walmart.com');

      expect(result).not.toBeNull();
      expect(result!.countries).toHaveLength(3);
      expect(result!.countries[0].country).toBe('United States');
      expect(result!.countries[0].country_code).toBe('US');
      expect(result!.countries[0].share).toBe(65);
    });

    it('should normalize country codes', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          records: [
            { country: 392, share: 0.5 }, // Japan
            { country: 156, share: 0.3 }, // China
          ],
        })
      );

      const result = await client.getGeography('rakuten.co.jp');

      expect(result!.countries[0].country_code).toBe('JP');
      expect(result!.countries[1].country_code).toBe('CN');
    });

    it('should handle unknown country codes', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          records: [{ country: 99999, share: 0.5 }],
        })
      );

      const result = await client.getGeography('example.com');

      expect(result!.countries[0].country_code).toBe('XX');
      expect(result!.countries[0].country).toContain('Unknown');
    });

    it('should sort countries by share descending', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          records: [
            { country: 124, share: 0.1 },
            { country: 840, share: 0.65 },
            { country: 826, share: 0.15 },
          ],
        })
      );

      const result = await client.getGeography('walmart.com');

      expect(result!.countries[0].share).toBeGreaterThan(result!.countries[1].share);
      expect(result!.countries[1].share).toBeGreaterThan(result!.countries[2].share);
    });
  });

  // ============================================================================
  // 4. Demographics
  // ============================================================================
  describe('getDemographics', () => {
    it('should return age and gender distribution', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          age_18_to_24: 0.15,
          age_25_to_34: 0.25,
          age_35_to_44: 0.22,
          age_45_to_54: 0.18,
          age_55_to_64: 0.12,
          age_65_plus: 0.08,
          male_ratio: 0.48,
          female_ratio: 0.52,
        })
      );

      const result = await client.getDemographics('walmart.com');

      expect(result).not.toBeNull();
      expect(result!.age_distribution['18-24']).toBe(15);
      expect(result!.age_distribution['25-34']).toBe(25);
      expect(result!.gender_distribution.male).toBe(48);
      expect(result!.gender_distribution.female).toBe(52);
    });

    it('should return null when demographics unavailable', async () => {
      mockFetch.mockResolvedValue(mockResponse(null, 404));

      const result = await client.getDemographics('small-site.com');

      expect(result).toBeNull();
    });

    it('should return null when all values are zero', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          age_18_to_24: 0,
          age_25_to_34: 0,
          male_ratio: 0,
          female_ratio: 0,
        })
      );

      const result = await client.getDemographics('small-site.com');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // 5. Organic Keywords
  // ============================================================================
  describe('getOrganicKeywords', () => {
    it('should return top keywords', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          search: [
            { search_term: 'walmart', share: 0.15, volume: 1000000, position: 1 },
            { search_term: 'walmart online', share: 0.08, volume: 500000, position: 2 },
            { search_term: 'walmart near me', share: 0.05, volume: 300000, position: 3 },
          ],
        })
      );

      const result = await client.getOrganicKeywords('walmart.com');

      expect(result).toHaveLength(3);
      expect(result[0].keyword).toBe('walmart');
      expect(result[0].volume).toBe(1000000);
      expect(result[0].position).toBe(1);
      expect(result[0].traffic_share).toBe(15);
    });

    it('should respect limit parameter', async () => {
      const keywords = Array.from({ length: 20 }, (_, i) => ({
        search_term: `keyword-${i}`,
        share: 0.01,
        volume: 1000,
      }));

      mockFetch.mockResolvedValue(mockResponse({ search: keywords }));

      const result = await client.getOrganicKeywords('walmart.com', 10);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array for no data', async () => {
      mockFetch.mockResolvedValue(mockResponse({ search: [] }));

      const result = await client.getOrganicKeywords('small-site.com');

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // 6. Paid Keywords
  // ============================================================================
  describe('getPaidKeywords', () => {
    it('should return paid keywords with CPC', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          search: [
            { search_term: 'buy tv online', share: 0.1, volume: 50000, cpc: 2.5 },
            { search_term: 'cheap electronics', share: 0.08, volume: 30000, cpc: 1.8 },
          ],
        })
      );

      const result = await client.getPaidKeywords('walmart.com');

      expect(result).toHaveLength(2);
      expect(result[0].keyword).toBe('buy tv online');
      expect(result[0].cpc).toBe(2.5);
      expect(result[0].traffic_share).toBe(10);
    });

    it('should handle missing CPC data', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          search: [{ search_term: 'test keyword', share: 0.05, volume: 1000 }],
        })
      );

      const result = await client.getPaidKeywords('walmart.com');

      expect(result[0].cpc).toBeUndefined();
    });
  });

  // ============================================================================
  // 7. Audience Interests
  // ============================================================================
  describe('getAudienceInterests', () => {
    it('should return audience interest categories', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          audience_interests: [
            { category: 'Shopping', affinity: 0.85 },
            { category: 'Electronics', affinity: 0.72 },
            { category: 'Home & Garden', affinity: 0.65 },
          ],
        })
      );

      const result = await client.getAudienceInterests('walmart.com');

      expect(result).toHaveLength(3);
      expect(result[0].category).toBe('Shopping');
      expect(result[0].affinity).toBe(0.85);
    });

    it('should sort by affinity descending', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          audience_interests: [
            { category: 'Low', affinity: 0.3 },
            { category: 'High', affinity: 0.9 },
            { category: 'Medium', affinity: 0.6 },
          ],
        })
      );

      const result = await client.getAudienceInterests('example.com');

      expect(result[0].category).toBe('High');
      expect(result[2].category).toBe('Low');
    });
  });

  // ============================================================================
  // 8. Similar Sites
  // ============================================================================
  describe('getSimilarSites', () => {
    it('should return competitors ranked by similarity', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          similar_sites: [
            { url: 'target.com', score: 0.85 },
            { url: 'amazon.com', score: 0.82 },
            { url: 'costco.com', score: 0.75 },
          ],
        })
      );

      const result = await client.getSimilarSites('walmart.com');

      expect(result).toHaveLength(3);
      expect(result[0].domain).toBe('target.com');
      expect(result[0].similarity_score).toBe(85);
    });

    it('should strip www prefix from domains', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          similar_sites: [{ url: 'www.target.com', score: 0.85 }],
        })
      );

      const result = await client.getSimilarSites('walmart.com');

      expect(result[0].domain).toBe('target.com');
    });

    it('should return empty array for no competitors', async () => {
      mockFetch.mockResolvedValue(mockResponse({ similar_sites: [] }));

      const result = await client.getSimilarSites('unique-site.com');

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // 9. Keyword Competitors
  // ============================================================================
  describe('getKeywordCompetitors', () => {
    it('should return SEO competitors', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          data: [
            { domain: 'target.com', overlap_score: 0.72, affinity: 0.85 },
            { domain: 'amazon.com', overlap_score: 0.68, affinity: 0.82 },
          ],
        })
      );

      const result = await client.getKeywordCompetitors('walmart.com');

      expect(result).toHaveLength(2);
      expect(result[0].domain).toBe('target.com');
      expect(result[0].overlap_score).toBe(72);
      expect(result[0].similarity_score).toBe(85);
    });

    it('should sort by similarity score', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          data: [
            { domain: 'low.com', affinity: 0.5 },
            { domain: 'high.com', affinity: 0.9 },
          ],
        })
      );

      const result = await client.getKeywordCompetitors('example.com');

      expect(result[0].domain).toBe('high.com');
    });
  });

  // ============================================================================
  // 10. Website Rank
  // ============================================================================
  describe('getWebsiteRank', () => {
    it('should return global, country, and category rank', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          global_rank: 100,
          country_rank: 25,
          category_rank: 5,
        })
      );

      const result = await client.getWebsiteRank('walmart.com');

      expect(result).not.toBeNull();
      expect(result!.global).toBe(100);
      expect(result!.country).toBe(25);
      expect(result!.category).toBe(5);
    });

    it('should return null for unranked site', async () => {
      mockFetch.mockResolvedValue(mockResponse(null, 404));

      const result = await client.getWebsiteRank('tiny-site.com');

      expect(result).toBeNull();
    });

    it('should handle partial rank data', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          global_rank: 5000,
        })
      );

      const result = await client.getWebsiteRank('medium-site.com');

      expect(result!.global).toBe(5000);
      expect(result!.country).toBe(0);
      expect(result!.category).toBe(0);
    });
  });

  // ============================================================================
  // 11. Referrals
  // ============================================================================
  describe('getReferrals', () => {
    it('should return top referring domains', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          referrals: [
            { domain: 'google.com', share: 0.25 },
            { domain: 'facebook.com', share: 0.15 },
            { domain: 'twitter.com', share: 0.08 },
          ],
        })
      );

      const result = await client.getReferrals('walmart.com');

      expect(result).toHaveLength(3);
      expect(result[0].domain).toBe('google.com');
      expect(result[0].traffic_share).toBe(25);
    });

    it('should sort by traffic share descending', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          referrals: [
            { domain: 'low.com', share: 0.05 },
            { domain: 'high.com', share: 0.3 },
          ],
        })
      );

      const result = await client.getReferrals('example.com');

      expect(result[0].domain).toBe('high.com');
    });
  });

  // ============================================================================
  // 12. Popular Pages
  // ============================================================================
  describe('getPopularPages', () => {
    it('should return most visited pages', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          popular_pages: [
            { page: '/products', share: 0.3 },
            { page: '/checkout', share: 0.2 },
            { page: '/account', share: 0.15 },
          ],
        })
      );

      const result = await client.getPopularPages('walmart.com');

      expect(result).toHaveLength(3);
      expect(result[0].url).toBe('/products');
      expect(result[0].share).toBe(30);
    });

    it('should return empty array for no data', async () => {
      mockFetch.mockResolvedValue(mockResponse({ popular_pages: [] }));

      const result = await client.getPopularPages('new-site.com');

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // 13. Leading Folders
  // ============================================================================
  describe('getLeadingFolders', () => {
    it('should return top URL paths', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          leading_folders: [
            { folder: '/shop', share: 0.4 },
            { folder: '/deals', share: 0.25 },
            { folder: '/electronics', share: 0.15 },
          ],
        })
      );

      const result = await client.getLeadingFolders('walmart.com');

      expect(result).toHaveLength(3);
      expect(result[0].url).toBe('/shop');
      expect(result[0].share).toBe(40);
    });
  });

  // ============================================================================
  // 14. Landing Pages
  // ============================================================================
  describe('getLandingPages', () => {
    it('should return top landing pages', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          landing_pages: [
            { page: '/promo/black-friday', share: 0.35 },
            { page: '/deals-of-the-day', share: 0.2 },
          ],
        })
      );

      const result = await client.getLandingPages('walmart.com');

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('/promo/black-friday');
      expect(result[0].share).toBe(35);
    });
  });

  // ============================================================================
  // getFullData - Aggregated
  // ============================================================================
  describe('getFullData', () => {
    // Use URL-based mock responses since Promise.all runs in parallel
    const setupFullDataMocks = () => {
      mockFetch.mockImplementation((url: string) => {
        // Match on URL path to return appropriate mock data
        if (url.includes('total-traffic-and-engagement')) {
          return mockResponse({
            visits: 5000000,
            pages_per_visit: 4.5,
            average_visit_duration: 180,
            bounce_rate: 0.35,
          });
        }
        if (url.includes('global-rank')) {
          return mockResponse({
            global_rank: 100,
            country_rank: 25,
            category_rank: 5,
          });
        }
        if (url.includes('traffic-sources/overview')) {
          return mockResponse({
            direct: 0.4,
            search: 0.3,
            referrals: 0.15,
            social: 0.08,
            mail: 0.02,
            paid_referrals: 0.05,
          });
        }
        if (url.includes('geo/traffic-by-country')) {
          return mockResponse({
            records: [{ country: 840, share: 0.65 }],
          });
        }
        if (url.includes('audience-demographics')) {
          return mockResponse({
            age_25_to_34: 0.3,
            male_ratio: 0.5,
            female_ratio: 0.5,
          });
        }
        if (url.includes('audience-interests')) {
          return mockResponse({
            audience_interests: [{ category: 'Shopping', affinity: 0.8 }],
          });
        }
        if (url.includes('organic-search-overview')) {
          return mockResponse({
            search: [{ search_term: 'walmart', share: 0.1, volume: 1000000 }],
          });
        }
        if (url.includes('paid-search-overview')) {
          return mockResponse({
            search: [{ search_term: 'buy online', share: 0.05, cpc: 1.5 }],
          });
        }
        if (url.includes('similar-sites')) {
          return mockResponse({
            similar_sites: [{ url: 'target.com', score: 0.8 }],
          });
        }
        if (url.includes('organicsearchcompetitors')) {
          return mockResponse({
            data: [{ domain: 'amazon.com', affinity: 0.75 }],
          });
        }
        if (url.includes('traffic-sources/referrals')) {
          return mockResponse({
            referrals: [{ domain: 'google.com', share: 0.2 }],
          });
        }
        if (url.includes('popular-pages')) {
          return mockResponse({
            popular_pages: [{ page: '/shop', share: 0.3 }],
          });
        }
        if (url.includes('leading-folders')) {
          return mockResponse({
            leading_folders: [{ folder: '/products', share: 0.25 }],
          });
        }
        if (url.includes('landing-pages')) {
          return mockResponse({
            landing_pages: [{ page: '/deals', share: 0.15 }],
          });
        }
        // Default response for any unmatched URL
        return mockResponse(null, 404);
      });
    };

    it('should aggregate all endpoint data', async () => {
      setupFullDataMocks();

      const result = await client.getFullData('walmart.com');

      expect(result).not.toBeNull();
      expect(result!.traffic.monthly_visits).toBe(5000000);
      expect(result!.sources.direct).toBe(40);
      expect(result!.geography.countries).toHaveLength(1);
      expect(result!.demographics).not.toBeNull();
      expect(result!.audience_interests).toHaveLength(1);
      expect(result!.organic_keywords).toHaveLength(1);
      expect(result!.paid_keywords).toHaveLength(1);
      expect(result!.competitors).toHaveLength(1);
      expect(result!.keyword_competitors).toHaveLength(1);
      expect(result!.referrals).toHaveLength(1);
      expect(result!.popular_pages).toHaveLength(1);
      expect(result!.leading_folders).toHaveLength(1);
      expect(result!.landing_pages).toHaveLength(1);
    });

    it('should handle partial failures gracefully', async () => {
      // Traffic succeeds
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          visits: 1000000,
          pages_per_visit: 3,
          average_visit_duration: 120,
          bounce_rate: 0.45,
        })
      );
      // Rank fails
      mockFetch.mockResolvedValueOnce(mockResponse(null, 404));
      // All other endpoints fail
      for (let i = 0; i < 12; i++) {
        mockFetch.mockResolvedValueOnce(mockResponse(null, 404));
      }

      const result = await client.getFullData('example.com');

      expect(result).not.toBeNull();
      expect(result!.traffic.monthly_visits).toBe(1000000);
      expect(result!.sources.direct).toBe(0); // Default value
      expect(result!.geography.countries).toEqual([]);
      expect(result!.demographics).toBeNull();
    });

    it('should set fetched_at timestamp', async () => {
      setupFullDataMocks();

      const before = new Date().toISOString();
      const result = await client.getFullData('walmart.com');
      const after = new Date().toISOString();

      expect(result!.fetched_at).toBeDefined();
      expect(result!.fetched_at >= before).toBe(true);
      expect(result!.fetched_at <= after).toBe(true);
    });

    it('should return null when traffic data unavailable', async () => {
      mockFetch.mockResolvedValue(mockResponse(null, 404));

      const result = await client.getFullData('nonexistent.com');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================
  describe('Error Handling', () => {
    it('should throw SimilarWebRateLimitError on 429', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 429));

      await expect(client.getTrafficAndEngagement('walmart.com')).rejects.toThrow(
        SimilarWebRateLimitError
      );
    });

    it('should throw SimilarWebError on server error', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 500));

      await expect(client.getTrafficAndEngagement('walmart.com')).rejects.toThrow(SimilarWebError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getTrafficAndEngagement('walmart.com')).rejects.toThrow(SimilarWebError);
    });

    it('should return null when API key is missing', async () => {
      // Temporarily clear the env var
      vi.stubEnv('VITE_SIMILARWEB_API_KEY', '');
      const noKeyClient = new SimilarWebClient('');

      const result = await noKeyClient.getTrafficAndEngagement('walmart.com');

      expect(result).toBeNull();
      // Restore the stub
      vi.stubEnv('VITE_SIMILARWEB_API_KEY', 'test-api-key-123');
    });
  });

  // ============================================================================
  // Integration Test (skipped by default)
  // ============================================================================
  describe.skip('Integration', () => {
    it('should fetch real data for walmart.com', async () => {
      // Use real API key from environment
      const realClient = new SimilarWebClient();

      const result = await realClient.getFullData('walmart.com');

      expect(result).not.toBeNull();
      expect(result!.traffic.monthly_visits).toBeGreaterThan(0);
      expect(result!.traffic.domain).toBe('walmart.com');

      console.log('Integration test result:', JSON.stringify(result, null, 2));
    }, 60000); // 60 second timeout for real API call
  });
});
