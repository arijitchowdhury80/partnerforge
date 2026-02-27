/**
 * Traffic Transformer Test Suite
 *
 * Comprehensive tests for all traffic transformation functions,
 * including data transformation, trend analysis, and Algolia-relevant metrics.
 */

import { describe, it, expect } from 'vitest';
import type { TrafficData, TrafficSource, CountryTraffic } from '@/types';
import type {
  SimilarWebFullData,
  SimilarWebTrafficSources,
  SimilarWebGeography,
  SimilarWebTrafficData,
} from '../clients/similarweb';
import {
  transformTrafficData,
  transformTrafficSources,
  transformGeography,
  getDominantTrafficSource,
  getOrganicVsPaidRatio,
  getPrimaryCountry,
  isUSCentric,
  getRegionalBreakdown,
  estimateDeviceDistribution,
  calculateTrafficTrend,
  classifyTrafficTrend,
  getTrafficTier,
  getTrafficTierScore,
  getTrafficDescription,
  calculateEngagementScore,
  getEngagementLevel,
  estimateSearchQueryVolume,
  classifySearchOpportunity,
  formatMonthlyVisits,
  formatDuration,
  formatPercentage,
} from '../transformers/traffic';

// ============================================================================
// Test Data Fixtures
// ============================================================================

const createMockTrafficData = (
  overrides: Partial<SimilarWebTrafficData> = {}
): SimilarWebTrafficData => ({
  domain: 'example.com',
  monthly_visits: 5000000,
  monthly_visits_trend: 0.05,
  bounce_rate: 0.35,
  pages_per_visit: 4.5,
  avg_visit_duration: 180,
  global_rank: 1500,
  country_rank: 500,
  category_rank: 25,
  category: 'Retail',
  ...overrides,
});

const createMockSources = (
  overrides: Partial<SimilarWebTrafficSources> = {}
): SimilarWebTrafficSources => ({
  direct: 40,
  search: 30,
  referral: 15,
  social: 8,
  mail: 2,
  paid: 5,
  ...overrides,
});

const createMockGeography = (
  countries: SimilarWebGeography['countries'] = []
): SimilarWebGeography => ({
  countries:
    countries.length > 0
      ? countries
      : [
          { country: 'United States', country_code: 'US', share: 65 },
          { country: 'United Kingdom', country_code: 'GB', share: 15 },
          { country: 'Canada', country_code: 'CA', share: 10 },
        ],
});

const createMockFullData = (
  overrides: Partial<SimilarWebFullData> = {}
): SimilarWebFullData => ({
  traffic: createMockTrafficData(),
  sources: createMockSources(),
  geography: createMockGeography(),
  demographics: null,
  audience_interests: [],
  organic_keywords: [],
  paid_keywords: [],
  competitors: [],
  keyword_competitors: [],
  referrals: [],
  popular_pages: [],
  leading_folders: [],
  landing_pages: [],
  fetched_at: new Date().toISOString(),
  ...overrides,
});

const createMockTransformedTrafficData = (
  overrides: Partial<TrafficData> = {}
): TrafficData => ({
  domain: 'example.com',
  monthly_visits: 5000000,
  monthly_visits_trend: 0.05,
  bounce_rate: 0.35,
  pages_per_visit: 4.5,
  avg_visit_duration: 180,
  traffic_sources: [
    { source: 'direct', percentage: 40 },
    { source: 'search', percentage: 30 },
    { source: 'referral', percentage: 15 },
    { source: 'social', percentage: 8 },
    { source: 'mail', percentage: 2 },
    { source: 'paid', percentage: 5 },
  ],
  top_countries: [
    { country: 'United States', country_code: 'US', percentage: 65 },
    { country: 'United Kingdom', country_code: 'GB', percentage: 15 },
    { country: 'Canada', country_code: 'CA', percentage: 10 },
  ],
  device_distribution: {
    desktop: 0.4,
    mobile: 0.55,
    tablet: 0.05,
  },
  ...overrides,
});

// ============================================================================
// Main Transformer Tests
// ============================================================================

describe('Traffic Transformer', () => {
  describe('transformTrafficData', () => {
    it('should transform complete SimilarWeb data', () => {
      const swData = createMockFullData();
      const result = transformTrafficData('example.com', swData);

      expect(result).not.toBeNull();
      expect(result!.domain).toBe('example.com');
      expect(result!.monthly_visits).toBe(5000000);
      expect(result!.bounce_rate).toBe(0.35);
      expect(result!.pages_per_visit).toBe(4.5);
      expect(result!.avg_visit_duration).toBe(180);
    });

    it('should return null for null input', () => {
      const result = transformTrafficData('example.com', null);
      expect(result).toBeNull();
    });

    it('should include traffic sources in the output', () => {
      const swData = createMockFullData();
      const result = transformTrafficData('example.com', swData);

      expect(result!.traffic_sources).toHaveLength(6);
      expect(result!.traffic_sources[0]).toEqual({
        source: 'direct',
        percentage: 40,
      });
    });

    it('should include geography data in the output', () => {
      const swData = createMockFullData();
      const result = transformTrafficData('example.com', swData);

      expect(result!.top_countries).toHaveLength(3);
      expect(result!.top_countries[0].country).toBe('United States');
      expect(result!.top_countries[0].percentage).toBe(65);
    });

    it('should include device distribution in the output', () => {
      const swData = createMockFullData();
      const result = transformTrafficData('example.com', swData);

      expect(result!.device_distribution).toBeDefined();
      expect(result!.device_distribution.desktop).toBeGreaterThan(0);
      expect(result!.device_distribution.mobile).toBeGreaterThan(0);
    });

    it('should preserve monthly_visits_trend', () => {
      const swData = createMockFullData({
        traffic: createMockTrafficData({ monthly_visits_trend: -0.15 }),
      });
      const result = transformTrafficData('example.com', swData);

      expect(result!.monthly_visits_trend).toBe(-0.15);
    });
  });

  // ============================================================================
  // Traffic Sources Tests
  // ============================================================================

  describe('transformTrafficSources', () => {
    it('should map all source types correctly', () => {
      const sources = createMockSources();
      const result = transformTrafficSources(sources);

      expect(result).toHaveLength(6);
      expect(result.find((s) => s.source === 'direct')!.percentage).toBe(40);
      expect(result.find((s) => s.source === 'search')!.percentage).toBe(30);
      expect(result.find((s) => s.source === 'referral')!.percentage).toBe(15);
      expect(result.find((s) => s.source === 'social')!.percentage).toBe(8);
      expect(result.find((s) => s.source === 'mail')!.percentage).toBe(2);
      expect(result.find((s) => s.source === 'paid')!.percentage).toBe(5);
    });

    it('should handle missing sources as 0', () => {
      const sources: SimilarWebTrafficSources = {
        direct: 50,
        search: 0,
        referral: 0,
        social: 0,
        mail: 0,
        paid: 0,
      };
      const result = transformTrafficSources(sources);

      expect(result.find((s) => s.source === 'direct')!.percentage).toBe(50);
      expect(result.find((s) => s.source === 'search')!.percentage).toBe(0);
    });

    it('should preserve percentage values', () => {
      const sources = createMockSources({ direct: 100, search: 0 });
      const result = transformTrafficSources(sources);

      expect(result.find((s) => s.source === 'direct')!.percentage).toBe(100);
    });

    it('should handle zero values', () => {
      const sources: SimilarWebTrafficSources = {
        direct: 0,
        search: 0,
        referral: 0,
        social: 0,
        mail: 0,
        paid: 0,
      };
      const result = transformTrafficSources(sources);

      result.forEach((source) => {
        expect(source.percentage).toBe(0);
      });
    });
  });

  describe('getDominantTrafficSource', () => {
    it('should return the source with highest percentage', () => {
      const sources: TrafficSource[] = [
        { source: 'direct', percentage: 20 },
        { source: 'search', percentage: 50 },
        { source: 'referral', percentage: 30 },
      ];
      const result = getDominantTrafficSource(sources);

      expect(result!.source).toBe('search');
      expect(result!.percentage).toBe(50);
    });

    it('should return null for empty array', () => {
      const result = getDominantTrafficSource([]);
      expect(result).toBeNull();
    });

    it('should return first source when all are equal', () => {
      const sources: TrafficSource[] = [
        { source: 'direct', percentage: 50 },
        { source: 'search', percentage: 50 },
      ];
      const result = getDominantTrafficSource(sources);

      expect(result).not.toBeNull();
      expect(result!.percentage).toBe(50);
    });
  });

  describe('getOrganicVsPaidRatio', () => {
    it('should calculate organic vs paid correctly', () => {
      const sources: TrafficSource[] = [
        { source: 'direct', percentage: 40 },
        { source: 'search', percentage: 30 },
        { source: 'referral', percentage: 15 },
        { source: 'social', percentage: 8 },
        { source: 'mail', percentage: 2 },
        { source: 'paid', percentage: 5 },
      ];
      const result = getOrganicVsPaidRatio(sources);

      expect(result.organic).toBe(95); // 40 + 30 + 15 + 8 + 2
      expect(result.paid).toBe(5);
    });

    it('should handle 100% organic traffic', () => {
      const sources: TrafficSource[] = [
        { source: 'direct', percentage: 60 },
        { source: 'search', percentage: 40 },
        { source: 'paid', percentage: 0 },
      ];
      const result = getOrganicVsPaidRatio(sources);

      expect(result.organic).toBe(100);
      expect(result.paid).toBe(0);
    });

    it('should handle 100% paid traffic', () => {
      const sources: TrafficSource[] = [{ source: 'paid', percentage: 100 }];
      const result = getOrganicVsPaidRatio(sources);

      expect(result.organic).toBe(0);
      expect(result.paid).toBe(100);
    });

    it('should return 0 for both when sources is empty', () => {
      const result = getOrganicVsPaidRatio([]);

      expect(result.organic).toBe(0);
      expect(result.paid).toBe(0);
    });
  });

  // ============================================================================
  // Geography Tests
  // ============================================================================

  describe('transformGeography', () => {
    it('should extract country name and code', () => {
      const geo = createMockGeography();
      const result = transformGeography(geo);

      expect(result[0].country).toBe('United States');
      expect(result[0].country_code).toBe('US');
    });

    it('should convert share to percentage', () => {
      const geo = createMockGeography([
        { country: 'United States', country_code: 'US', share: 65 },
      ]);
      const result = transformGeography(geo);

      expect(result[0].percentage).toBe(65);
    });

    it('should return empty array for null geography', () => {
      const result = transformGeography(null as unknown as SimilarWebGeography);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty countries', () => {
      const result = transformGeography({ countries: [] });
      expect(result).toEqual([]);
    });

    it('should handle multiple countries', () => {
      const geo = createMockGeography();
      const result = transformGeography(geo);

      expect(result).toHaveLength(3);
    });
  });

  describe('getPrimaryCountry', () => {
    it('should return country with highest percentage', () => {
      const countries: CountryTraffic[] = [
        { country: 'United States', country_code: 'US', percentage: 65 },
        { country: 'United Kingdom', country_code: 'GB', percentage: 25 },
        { country: 'Canada', country_code: 'CA', percentage: 10 },
      ];
      const result = getPrimaryCountry(countries);

      expect(result!.country).toBe('United States');
      expect(result!.percentage).toBe(65);
    });

    it('should return null for empty array', () => {
      const result = getPrimaryCountry([]);
      expect(result).toBeNull();
    });
  });

  describe('isUSCentric', () => {
    it('should return true when US traffic is >50%', () => {
      const countries: CountryTraffic[] = [
        { country: 'United States', country_code: 'US', percentage: 65 },
        { country: 'United Kingdom', country_code: 'GB', percentage: 35 },
      ];
      expect(isUSCentric(countries)).toBe(true);
    });

    it('should return false when US traffic is <=50%', () => {
      const countries: CountryTraffic[] = [
        { country: 'United States', country_code: 'US', percentage: 40 },
        { country: 'United Kingdom', country_code: 'GB', percentage: 60 },
      ];
      expect(isUSCentric(countries)).toBe(false);
    });

    it('should return false when US is not in list', () => {
      const countries: CountryTraffic[] = [
        { country: 'Germany', country_code: 'DE', percentage: 60 },
        { country: 'France', country_code: 'FR', percentage: 40 },
      ];
      expect(isUSCentric(countries)).toBe(false);
    });

    it('should match by country name (case insensitive)', () => {
      const countries: CountryTraffic[] = [
        { country: 'united states', country_code: 'XX', percentage: 75 },
      ];
      expect(isUSCentric(countries)).toBe(true);
    });
  });

  describe('getRegionalBreakdown', () => {
    it('should categorize Americas traffic', () => {
      const countries: CountryTraffic[] = [
        { country: 'United States', country_code: 'US', percentage: 50 },
        { country: 'Canada', country_code: 'CA', percentage: 30 },
        { country: 'Mexico', country_code: 'MX', percentage: 20 },
      ];
      const result = getRegionalBreakdown(countries);

      expect(result.americas).toBe(100);
      expect(result.emea).toBe(0);
      expect(result.apac).toBe(0);
    });

    it('should categorize APAC traffic', () => {
      const countries: CountryTraffic[] = [
        { country: 'Japan', country_code: 'JP', percentage: 40 },
        { country: 'Australia', country_code: 'AU', percentage: 30 },
        { country: 'China', country_code: 'CN', percentage: 30 },
      ];
      const result = getRegionalBreakdown(countries);

      expect(result.apac).toBe(100);
      expect(result.americas).toBe(0);
      expect(result.emea).toBe(0);
    });

    it('should categorize EMEA traffic (everything else)', () => {
      const countries: CountryTraffic[] = [
        { country: 'Germany', country_code: 'DE', percentage: 50 },
        { country: 'France', country_code: 'FR', percentage: 30 },
        { country: 'Italy', country_code: 'IT', percentage: 20 },
      ];
      const result = getRegionalBreakdown(countries);

      expect(result.emea).toBe(100);
      expect(result.americas).toBe(0);
      expect(result.apac).toBe(0);
    });

    it('should handle mixed regions', () => {
      const countries: CountryTraffic[] = [
        { country: 'United States', country_code: 'US', percentage: 40 },
        { country: 'Germany', country_code: 'DE', percentage: 30 },
        { country: 'Japan', country_code: 'JP', percentage: 30 },
      ];
      const result = getRegionalBreakdown(countries);

      expect(result.americas).toBe(40);
      expect(result.emea).toBe(30);
      expect(result.apac).toBe(30);
    });
  });

  // ============================================================================
  // Device Distribution Tests
  // ============================================================================

  describe('estimateDeviceDistribution', () => {
    it('should return higher mobile for retail/shopping categories', () => {
      const swData = createMockFullData({
        traffic: createMockTrafficData({ category: 'Shopping' }),
      });
      const result = estimateDeviceDistribution(swData);

      expect(result.mobile).toBeGreaterThan(result.desktop);
      expect(result.mobile).toBe(0.55);
      expect(result.desktop).toBe(0.4);
      expect(result.tablet).toBe(0.05);
    });

    it('should return higher desktop for B2B/business categories', () => {
      const swData = createMockFullData({
        traffic: createMockTrafficData({ category: 'Business Services' }),
      });
      const result = estimateDeviceDistribution(swData);

      expect(result.desktop).toBeGreaterThan(result.mobile);
      expect(result.desktop).toBe(0.7);
      expect(result.mobile).toBe(0.25);
    });

    it('should return balanced distribution for other categories', () => {
      const swData = createMockFullData({
        traffic: createMockTrafficData({ category: 'News' }),
      });
      const result = estimateDeviceDistribution(swData);

      expect(result.desktop).toBe(0.55);
      expect(result.mobile).toBe(0.4);
      expect(result.tablet).toBe(0.05);
    });

    it('should sum to 100%', () => {
      const swData = createMockFullData();
      const result = estimateDeviceDistribution(swData);

      const total = result.desktop + result.mobile + result.tablet;
      expect(total).toBe(1);
    });

    it('should handle empty category', () => {
      const swData = createMockFullData({
        traffic: createMockTrafficData({ category: '' }),
      });
      const result = estimateDeviceDistribution(swData);

      // Should return default values
      expect(result.desktop).toBe(0.55);
      expect(result.mobile).toBe(0.4);
    });
  });

  // ============================================================================
  // Traffic Trend Tests
  // ============================================================================

  describe('calculateTrafficTrend', () => {
    it('should calculate positive trend correctly', () => {
      const result = calculateTrafficTrend(1100, 1000);
      expect(result).toBe(10);
    });

    it('should calculate negative trend correctly', () => {
      const result = calculateTrafficTrend(900, 1000);
      expect(result).toBe(-10);
    });

    it('should return 0 for no change', () => {
      const result = calculateTrafficTrend(1000, 1000);
      expect(result).toBe(0);
    });

    it('should return 0 for zero previous value', () => {
      const result = calculateTrafficTrend(1000, 0);
      expect(result).toBe(0);
    });

    it('should handle large percentage changes', () => {
      const result = calculateTrafficTrend(3000, 1000);
      expect(result).toBe(200);
    });
  });

  describe('classifyTrafficTrend', () => {
    it('should return growing for positive trend > 5%', () => {
      expect(classifyTrafficTrend(10)).toBe('growing');
      expect(classifyTrafficTrend(5.1)).toBe('growing');
    });

    it('should return declining for negative trend < -5%', () => {
      expect(classifyTrafficTrend(-10)).toBe('declining');
      expect(classifyTrafficTrend(-5.1)).toBe('declining');
    });

    it('should return stable for trend between -5% and 5%', () => {
      expect(classifyTrafficTrend(0)).toBe('stable');
      expect(classifyTrafficTrend(5)).toBe('stable');
      expect(classifyTrafficTrend(-5)).toBe('stable');
      expect(classifyTrafficTrend(3)).toBe('stable');
      expect(classifyTrafficTrend(-3)).toBe('stable');
    });
  });

  // ============================================================================
  // Traffic Tier Tests
  // ============================================================================

  describe('getTrafficTier', () => {
    it('should return excellent for 10M+ visits', () => {
      expect(getTrafficTier(10_000_000)).toBe('excellent');
      expect(getTrafficTier(50_000_000)).toBe('excellent');
    });

    it('should return great for 1M+ visits', () => {
      expect(getTrafficTier(1_000_000)).toBe('great');
      expect(getTrafficTier(5_000_000)).toBe('great');
      expect(getTrafficTier(9_999_999)).toBe('great');
    });

    it('should return good for 100K+ visits', () => {
      expect(getTrafficTier(100_000)).toBe('good');
      expect(getTrafficTier(500_000)).toBe('good');
    });

    it('should return okay for 10K+ visits', () => {
      expect(getTrafficTier(10_000)).toBe('okay');
      expect(getTrafficTier(50_000)).toBe('okay');
    });

    it('should return low for < 10K visits', () => {
      expect(getTrafficTier(9_999)).toBe('low');
      expect(getTrafficTier(1_000)).toBe('low');
      expect(getTrafficTier(0)).toBe('low');
    });
  });

  describe('getTrafficTierScore', () => {
    it('should return 100 for excellent tier', () => {
      expect(getTrafficTierScore(10_000_000)).toBe(100);
    });

    it('should return 80 for great tier', () => {
      expect(getTrafficTierScore(5_000_000)).toBe(80);
    });

    it('should return 60 for good tier', () => {
      expect(getTrafficTierScore(500_000)).toBe(60);
    });

    it('should return 40 for okay tier', () => {
      expect(getTrafficTierScore(50_000)).toBe(40);
    });

    it('should return 20 for low tier', () => {
      expect(getTrafficTierScore(1_000)).toBe(20);
    });
  });

  describe('getTrafficDescription', () => {
    it('should describe 100M+ as top-tier enterprise', () => {
      expect(getTrafficDescription(100_000_000)).toContain('Top-tier enterprise');
    });

    it('should describe 10M+ as major enterprise', () => {
      expect(getTrafficDescription(10_000_000)).toContain('Major enterprise');
    });

    it('should describe 1M+ as large business', () => {
      expect(getTrafficDescription(1_000_000)).toContain('Large business');
    });

    it('should describe 100K+ as mid-market', () => {
      expect(getTrafficDescription(100_000)).toContain('Mid-market');
    });

    it('should describe 10K+ as growing business', () => {
      expect(getTrafficDescription(10_000)).toContain('Growing business');
    });

    it('should describe < 10K as small business', () => {
      expect(getTrafficDescription(5_000)).toContain('Small business');
    });
  });

  // ============================================================================
  // Engagement Scoring Tests
  // ============================================================================

  describe('calculateEngagementScore', () => {
    it('should calculate high score for good engagement', () => {
      const traffic = createMockTransformedTrafficData({
        bounce_rate: 25, // Low bounce rate (good)
        pages_per_visit: 6, // High pages (good)
        avg_visit_duration: 240, // 4 minutes (good)
      });
      const result = calculateEngagementScore(traffic);

      expect(result).toBeGreaterThan(70);
    });

    it('should calculate low score for poor engagement', () => {
      const traffic = createMockTransformedTrafficData({
        bounce_rate: 80, // High bounce rate (bad)
        pages_per_visit: 1, // Low pages (bad)
        avg_visit_duration: 30, // 30 seconds (bad)
      });
      const result = calculateEngagementScore(traffic);

      expect(result).toBeLessThan(40);
    });

    it('should return score between 0 and 100', () => {
      const traffic = createMockTransformedTrafficData();
      const result = calculateEngagementScore(traffic);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should handle extreme values', () => {
      const traffic = createMockTransformedTrafficData({
        bounce_rate: 100,
        pages_per_visit: 0,
        avg_visit_duration: 0,
      });
      const result = calculateEngagementScore(traffic);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEngagementLevel', () => {
    it('should return high for score >= 70', () => {
      const traffic = createMockTransformedTrafficData({
        bounce_rate: 20,
        pages_per_visit: 6,
        avg_visit_duration: 300,
      });
      expect(getEngagementLevel(traffic)).toBe('high');
    });

    it('should return medium for score between 40-69', () => {
      const traffic = createMockTransformedTrafficData({
        bounce_rate: 45,
        pages_per_visit: 3,
        avg_visit_duration: 120,
      });
      expect(getEngagementLevel(traffic)).toBe('medium');
    });

    it('should return low for score < 40', () => {
      const traffic = createMockTransformedTrafficData({
        bounce_rate: 85,
        pages_per_visit: 1,
        avg_visit_duration: 20,
      });
      expect(getEngagementLevel(traffic)).toBe('low');
    });
  });

  // ============================================================================
  // Search Analysis Tests (Algolia relevance)
  // ============================================================================

  describe('estimateSearchQueryVolume', () => {
    it('should estimate search queries based on traffic', () => {
      const traffic = createMockTransformedTrafficData({
        monthly_visits: 1_000_000,
        traffic_sources: [
          { source: 'search', percentage: 30 },
          { source: 'direct', percentage: 70 },
        ],
      });
      const result = estimateSearchQueryVolume(traffic);

      // 1M * 10% site search rate * 2.5 queries = 250,000
      expect(result).toBe(250_000);
    });

    it('should return 0 for no traffic', () => {
      const traffic = createMockTransformedTrafficData({
        monthly_visits: 0,
      });
      const result = estimateSearchQueryVolume(traffic);

      expect(result).toBe(0);
    });

    it('should return positive number for high traffic sites', () => {
      const traffic = createMockTransformedTrafficData({
        monthly_visits: 100_000_000,
      });
      const result = estimateSearchQueryVolume(traffic);

      expect(result).toBeGreaterThan(0);
    });
  });

  describe('classifySearchOpportunity', () => {
    it('should return massive for 10M+ queries', () => {
      expect(classifySearchOpportunity(10_000_000)).toBe('massive');
      expect(classifySearchOpportunity(50_000_000)).toBe('massive');
    });

    it('should return large for 1M+ queries', () => {
      expect(classifySearchOpportunity(1_000_000)).toBe('large');
      expect(classifySearchOpportunity(5_000_000)).toBe('large');
    });

    it('should return moderate for 100K+ queries', () => {
      expect(classifySearchOpportunity(100_000)).toBe('moderate');
      expect(classifySearchOpportunity(500_000)).toBe('moderate');
    });

    it('should return small for < 100K queries', () => {
      expect(classifySearchOpportunity(99_999)).toBe('small');
      expect(classifySearchOpportunity(10_000)).toBe('small');
      expect(classifySearchOpportunity(0)).toBe('small');
    });
  });

  // ============================================================================
  // Format Helper Tests
  // ============================================================================

  describe('formatMonthlyVisits', () => {
    it('should format billions correctly', () => {
      expect(formatMonthlyVisits(1_000_000_000)).toBe('1.0B');
      expect(formatMonthlyVisits(2_500_000_000)).toBe('2.5B');
    });

    it('should format millions correctly', () => {
      expect(formatMonthlyVisits(1_000_000)).toBe('1.0M');
      expect(formatMonthlyVisits(5_500_000)).toBe('5.5M');
    });

    it('should format thousands correctly', () => {
      expect(formatMonthlyVisits(1_000)).toBe('1.0K');
      expect(formatMonthlyVisits(50_000)).toBe('50.0K');
    });

    it('should format small numbers as-is', () => {
      expect(formatMonthlyVisits(500)).toBe('500');
      expect(formatMonthlyVisits(0)).toBe('0');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only for < 60s', () => {
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(59)).toBe('59s');
    });

    it('should format minutes and seconds for >= 60s', () => {
      expect(formatDuration(60)).toBe('1m 0s');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(180)).toBe('3m 0s');
      expect(formatDuration(185)).toBe('3m 5s');
    });

    it('should handle 0 seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should round fractional seconds', () => {
      expect(formatDuration(30.7)).toBe('31s');
      expect(formatDuration(90.4)).toBe('1m 30s');
    });
  });

  describe('formatPercentage', () => {
    it('should format with one decimal place', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(33.333)).toBe('33.3%');
      expect(formatPercentage(0.1)).toBe('0.1%');
    });

    it('should handle 0 and 100', () => {
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(100)).toBe('100.0%');
    });

    it('should handle negative values', () => {
      expect(formatPercentage(-5.5)).toBe('-5.5%');
    });
  });
});
