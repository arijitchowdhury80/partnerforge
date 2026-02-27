/**
 * Transformer Tests for Financials, Hiring, Executive, and Investor
 *
 * Tests all transformer functions for data transformations
 * from raw API responses to PartnerForge-standardized types.
 */

import { describe, it, expect } from 'vitest';

// Financial transformers
import {
  transformFinancialData,
  transformRevenueMetrics,
  transformNetIncomeMetrics,
  transformStockInfo,
  transformIncomeStatement,
  transformBalanceSheet,
  transformHistoricalFinancials,
  transformAnalystRatings,
  calculateGrowthRates,
  calculateMargins,
  estimatePrivateCompanyFinancials,
  getPrivateCompanyEstimateConfidence,
  formatFinancialNumber,
  determineMarginZone,
  calculateEbitdaMargin,
  getFinancialHealthScore,
  calculateRevenueCAGR,
  getRevenueTrend,
} from '../transformers/financials';

// Hiring transformers
import {
  transformHiringData,
  transformJob,
  transformHiringJobToKeyRole,
  calculateEnrichedTierBreakdown,
  extractTechSignals,
  determineGrowthIndicators,
  transformToEnrichedHiringData,
  getHiringSignalScore,
  isHiringForSearch,
  getSearchRelatedJobs,
  isBuildingTeam,
} from '../transformers/hiring';

// Executive transformers
import {
  transformExecutiveData,
  scoreQuoteRelevanceLevel,
  mapQuoteToAlgoliaValueProp,
  extractSpeakingPhrases,
  generateAlgoliaAngle,
  transformToExecutiveInsights,
  getExecutiveSignalScore,
  getCLevelQuotes,
  extractStrategicPriorities,
} from '../transformers/executive';

// Investor transformers
import {
  transformInvestorData,
  transformRiskFactorEnhanced,
  extractDigitalMentions,
  extractSearchMentions,
  determineDigitalTransformationStage,
  extractGrowthDrivers,
  extractHeadwinds,
  transformToInvestorIntelligence,
  getInvestorSignalScore,
  hasTechnologyRisks,
  parseQuarterToDate,
} from '../transformers/investor';

// Types
import type { HiringData, Job, ExecutiveData, InvestorData } from '@/types';
import type { HiringSignal, HiringJob } from '../clients/websearch';

// ============================================================================
// Mock Data Factories
// ============================================================================

function createMockYahooFinanceData() {
  return {
    quote_summary: {
      ticker: 'COST',
      company_name: 'Costco Wholesale Corporation',
      sector: 'Consumer Defensive',
      industry: 'Discount Stores',
      employees: 316000,
      market_cap: 395000000000,
      enterprise_value: 400000000000,
      pe_ratio: 48.5,
      peg_ratio: 4.2,
      price_to_book: 14.5,
      revenue_growth: 0.12,
      profit_margins: 0.025,
      operating_margins: 0.035,
      return_on_equity: 0.28,
      description: 'Costco Wholesale Corporation operates membership warehouses...',
    },
    financials_3_year: {
      income_statements: [
        {
          fiscal_year: 2024,
          fiscal_date: '2024-08-31',
          total_revenue: 242290000000,
          cost_of_revenue: 210990000000,
          gross_profit: 31300000000,
          operating_income: 8500000000,
          net_income: 6292000000,
          ebitda: 12000000000,
          eps_basic: 14.16,
          eps_diluted: 14.16,
        },
        {
          fiscal_year: 2023,
          fiscal_date: '2023-08-31',
          total_revenue: 226954000000,
          cost_of_revenue: 197527000000,
          gross_profit: 29427000000,
          operating_income: 7800000000,
          net_income: 5844000000,
          ebitda: 11200000000,
          eps_basic: 13.14,
          eps_diluted: 13.14,
        },
        {
          fiscal_year: 2022,
          fiscal_date: '2022-08-31',
          total_revenue: 222730000000,
          cost_of_revenue: 193963000000,
          gross_profit: 28767000000,
          operating_income: 7410000000,
          net_income: 5007000000,
          ebitda: 10500000000,
          eps_basic: 11.27,
          eps_diluted: 11.27,
        },
      ],
      balance_sheets: [
        {
          fiscal_year: 2024,
          total_assets: 68994000000,
          total_liabilities: 44689000000,
          total_equity: 24305000000,
          total_debt: 7472000000,
          cash_and_equivalents: 13700000000,
          current_assets: 30200000000,
          current_liabilities: 32022000000,
        },
      ],
      cash_flows: [],
      quarterly_results: [],
      revenue_cagr: 0.044,
      profit_cagr: 0.12,
      margin_trend: 'improving' as const,
    },
    stock_info: {
      ticker: 'COST',
      current_price: 890.50,
      previous_close: 885.20,
      day_change: 5.30,
      day_change_percent: 0.6,
      fifty_two_week_high: 920.00,
      fifty_two_week_low: 650.00,
      volume: 1500000,
      avg_volume: 1800000,
      dividend_yield: 0.0052,
      ex_dividend_date: '2024-02-01',
    },
    recommendations: {
      strong_buy: 8,
      buy: 15,
      hold: 5,
      sell: 1,
      strong_sell: 0,
      mean_rating: 2.1,
      target_mean_price: 950.00,
      target_high_price: 1050.00,
      target_low_price: 850.00,
      recent_changes: [],
    },
    institutional_holders: [],
    insider_holders: [],
    recent_news: [],
    price_history: [],
    fetched_at: new Date().toISOString(),
  };
}

function createMockHiringSignal(): HiringSignal {
  return {
    signal_strength: 'strong',
    total_relevant_openings: 15,
    tier_breakdown: {
      tier_1_vp: 2,
      tier_2_director: 4,
      tier_3_ic: 9,
    },
    relevant_jobs: [
      {
        title: 'VP of Engineering',
        tier: 1 as const,
        department: 'Engineering',
        location: 'Seattle, WA',
        url: 'https://careers.example.com/vp-eng',
        posted_date: '2024-02-01',
        relevance_score: 85,
        search_related: true,
      },
      {
        title: 'Director of Search & Discovery',
        tier: 2 as const,
        department: 'Product',
        location: 'Remote',
        url: 'https://careers.example.com/dir-search',
        posted_date: '2024-02-05',
        relevance_score: 95,
        search_related: true,
      },
      {
        title: 'Senior Search Engineer',
        tier: 3 as const,
        department: 'Engineering',
        location: 'Seattle, WA',
        url: 'https://careers.example.com/sr-search-eng',
        posted_date: '2024-02-10',
        relevance_score: 90,
        search_related: true,
      },
      {
        title: 'Software Engineer - Ecommerce Platform',
        tier: 3 as const,
        department: 'Engineering',
        location: 'Seattle, WA',
        url: 'https://careers.example.com/swe-ecom',
        posted_date: '2024-02-10',
        relevance_score: 70,
        search_related: false,
      },
    ],
    tech_keywords_detected: ['react', 'elasticsearch', 'algolia', 'kubernetes', 'ecommerce'],
  };
}

function createMockHiringData(): HiringData {
  return {
    domain: 'example.com',
    signal_strength: 'strong',
    total_openings: 15,
    tier_breakdown: {
      tier_1_vp: 2,
      tier_2_director: 4,
      tier_3_ic: 9,
    },
    relevant_jobs: [
      {
        title: 'VP of Engineering',
        tier: 1,
        department: 'Engineering',
        location: 'Seattle, WA',
        url: 'https://careers.example.com/vp-eng',
        posted_date: '2024-02-01',
        relevance_score: 85,
      },
      {
        title: 'Director of Search & Discovery',
        tier: 2,
        department: 'Product',
        location: 'Remote',
        url: 'https://careers.example.com/dir-search',
        posted_date: '2024-02-05',
        relevance_score: 95,
      },
      {
        title: 'Senior Search Engineer',
        tier: 3,
        department: 'Engineering',
        location: 'Seattle, WA',
        url: 'https://careers.example.com/sr-search-eng',
        posted_date: '2024-02-10',
        relevance_score: 90,
      },
    ],
    tech_keywords: ['react', 'elasticsearch', 'algolia', 'kubernetes', 'ecommerce'],
  };
}

function createMockExecutiveData(): ExecutiveData {
  return {
    domain: 'example.com',
    quotes: [
      {
        speaker: 'John Smith',
        title: 'CEO',
        quote: 'Our priority is improving customer experience through better search and discovery. We are investing heavily in personalization to drive conversion.',
        topic_tags: ['search', 'customer experience', 'personalization'],
        maps_to_algolia: 'Search & Discovery',
        relevance_score: 85,
        source_url: 'https://example.com/earnings-call',
        source_date: '2024-01-15',
      },
      {
        speaker: 'Jane Doe',
        title: 'CTO',
        quote: 'We need to transform our digital platform to stay competitive. Performance and scalability are critical.',
        topic_tags: ['digital transformation', 'performance'],
        maps_to_algolia: 'Digital Transformation',
        relevance_score: 75,
        source_url: 'https://example.com/investor-day',
        source_date: '2024-02-01',
      },
    ],
    themes: [
      { theme: 'customer experience', frequency: 5, example_quote: 'Customer experience is our top priority' },
      { theme: 'digital transformation', frequency: 3, example_quote: 'We are transforming our digital capabilities' },
      { theme: 'search', frequency: 2, example_quote: 'Search is critical for product discovery' },
    ],
  };
}

function createMockInvestorData(): InvestorData {
  return {
    domain: 'example.com',
    sec_filings: [
      {
        type: '10-K',
        filing_date: '2024-02-15',
        url: 'https://sec.gov/cgi-bin/browse-edgar?company=example',
        highlights: [
          'Digital sales increased 25% year-over-year',
          'Technology investments totaled $500M',
          'E-commerce platform modernization ongoing',
        ],
      },
      {
        type: '10-Q',
        filing_date: '2024-05-01',
        url: 'https://sec.gov/cgi-bin/browse-edgar?company=example&type=10-Q',
        highlights: ['Q1 2024 showed strong digital growth'],
      },
    ],
    earnings_highlights: [
      {
        quarter: 'Q4 2024',
        date: '2024-02-15',
        key_points: [
          'Digital transformation accelerating',
          'Search functionality driving customer engagement',
          'E-commerce revenue up 30%',
        ],
        transcript_url: 'https://example.com/q4-2024-transcript',
      },
    ],
    risk_factors: [
      {
        category: 'Technology Risk',
        description: 'Our business depends on the effective operation of our technology systems and website.',
        relevance_to_algolia: 'high',
      },
      {
        category: 'Competitive Risk',
        description: 'We face intense competition from other retailers and e-commerce platforms.',
        relevance_to_algolia: 'medium',
      },
    ],
  };
}

// ============================================================================
// Financial Transformer Tests
// ============================================================================

describe('Financials Transformer', () => {
  describe('transformStockInfo', () => {
    it('should extract market cap', () => {
      const raw = {
        ticker: 'COST',
        current_price: 890.50,
        fifty_two_week_high: 920.00,
        fifty_two_week_low: 650.00,
      };

      const result = transformStockInfo(raw);

      expect(result.ticker).toBe('COST');
      expect(result.current_price).toBe(890.50);
    });

    it('should extract current price', () => {
      const raw = { current_price: 150.25 };
      const result = transformStockInfo(raw);
      expect(result.current_price).toBe(150.25);
    });

    it('should extract 52-week range', () => {
      const raw = {
        fifty_two_week_high: 200.00,
        fifty_two_week_low: 100.00,
      };

      const result = transformStockInfo(raw);

      expect(result.fifty_two_week_high).toBe(200.00);
      expect(result.fifty_two_week_low).toBe(100.00);
    });

    it('should handle missing data gracefully', () => {
      const result = transformStockInfo(null);
      expect(result).toEqual({});
    });

    it('should handle partial data', () => {
      const raw = { ticker: 'TEST' };
      const result = transformStockInfo(raw);
      expect(result.ticker).toBe('TEST');
      // current_price can be null or undefined when not provided
      expect(result.current_price == null).toBe(true);
    });
  });

  describe('transformIncomeStatement', () => {
    it('should extract revenue', () => {
      const raw = { total_revenue: 100000000000 };
      const result = transformIncomeStatement(raw);
      expect(result.revenue).toBe(100000000000);
    });

    it('should extract gross profit', () => {
      const raw = { gross_profit: 30000000000 };
      const result = transformIncomeStatement(raw);
      expect(result.gross_profit).toBe(30000000000);
    });

    it('should calculate margins correctly', () => {
      const revenue = 100000000000;
      const grossProfit = 30000000000;
      const operatingIncome = 10000000000;
      const netIncome = 7000000000;

      const margins = calculateMargins(revenue, grossProfit, operatingIncome, netIncome);

      expect(margins.gross_margin).toBeCloseTo(30, 5);
      expect(margins.operating_margin).toBeCloseTo(10, 5);
      expect(margins.net_margin).toBeCloseTo(7, 5);
    });

    it('should handle null values', () => {
      const result = transformIncomeStatement(null);
      expect(result.revenue).toBeNull();
      expect(result.gross_profit).toBeNull();
    });
  });

  describe('transformHistoricalFinancials', () => {
    it('should create 3-year history', () => {
      const income = [
        { fiscal_year: 2024, total_revenue: 150, gross_profit: 45, operating_income: 15, net_income: 10 },
        { fiscal_year: 2023, total_revenue: 125, gross_profit: 37, operating_income: 12, net_income: 8 },
        { fiscal_year: 2022, total_revenue: 100, gross_profit: 30, operating_income: 10, net_income: 6 },
      ];

      const result = transformHistoricalFinancials(income);

      expect(result).toHaveLength(3);
    });

    it('should sort by year descending', () => {
      const income = [
        { fiscal_year: 2022, total_revenue: 100, gross_profit: 30, operating_income: 10, net_income: 6 },
        { fiscal_year: 2024, total_revenue: 150, gross_profit: 45, operating_income: 15, net_income: 10 },
        { fiscal_year: 2023, total_revenue: 125, gross_profit: 37, operating_income: 12, net_income: 8 },
      ];

      const result = transformHistoricalFinancials(income);

      expect(result[0].year).toBe(2024);
      expect(result[1].year).toBe(2023);
      expect(result[2].year).toBe(2022);
    });

    it('should handle empty array', () => {
      const result = transformHistoricalFinancials([]);
      expect(result).toEqual([]);
    });
  });

  describe('calculateGrowthRates', () => {
    it('should calculate YoY revenue growth', () => {
      const historical = [
        { year: 2024, revenue: 150, gross_profit: 45, operating_income: 15, net_income: 10 },
        { year: 2023, revenue: 100, gross_profit: 30, operating_income: 10, net_income: 6 },
      ];

      const result = calculateGrowthRates(historical);

      expect(result.revenue_growth_yoy).toBe(50); // 50% growth
    });

    it('should handle negative growth', () => {
      const historical = [
        { year: 2024, revenue: 80, gross_profit: 24, operating_income: 8, net_income: 5 },
        { year: 2023, revenue: 100, gross_profit: 30, operating_income: 10, net_income: 6 },
      ];

      const result = calculateGrowthRates(historical);

      expect(result.revenue_growth_yoy).toBe(-20); // -20% growth
    });

    it('should return null for insufficient data', () => {
      const historical = [
        { year: 2024, revenue: 150, gross_profit: 45, operating_income: 15, net_income: 10 },
      ];

      const result = calculateGrowthRates(historical);

      expect(result.revenue_growth_yoy).toBeNull();
    });
  });

  describe('estimatePrivateCompanyFinancials', () => {
    it('should estimate revenue from employee count', () => {
      const signals = {
        employee_count: 100,
        industry: 'software',
      };

      const result = estimatePrivateCompanyFinancials(signals);

      expect(result.revenue).toBeDefined();
      expect(result.revenue).toBeGreaterThan(0);
    });

    it('should factor in industry multipliers', () => {
      const softwareSignals = { employee_count: 100, industry: 'software' };
      const retailSignals = { employee_count: 100, industry: 'retail' };

      const softwareResult = estimatePrivateCompanyFinancials(softwareSignals);
      const retailResult = estimatePrivateCompanyFinancials(retailSignals);

      // Software should have higher revenue per employee
      expect(softwareResult.revenue).toBeGreaterThan(retailResult.revenue!);
    });

    it('should estimate from funding total', () => {
      const signals = {
        funding_total: 50000000, // $50M
        last_funding_round: 'series b',
      };

      const result = estimatePrivateCompanyFinancials(signals);

      expect(result.revenue).toBeDefined();
      expect(result.market_cap).toBeDefined();
    });

    it('should return is_public: false', () => {
      const signals = { employee_count: 50 };
      const result = estimatePrivateCompanyFinancials(signals);
      expect(result.is_public).toBe(false);
    });
  });

  describe('getPrivateCompanyEstimateConfidence', () => {
    it('should return high confidence with multiple signals', () => {
      const signals = {
        employee_count: 100,
        funding_total: 50000000,
        last_funding_round: 'series b',
        industry: 'software',
      };

      const result = getPrivateCompanyEstimateConfidence(signals);
      expect(result).toBe('high');
    });

    it('should return low confidence with minimal signals', () => {
      const signals = { employee_count: 50 };
      const result = getPrivateCompanyEstimateConfidence(signals);
      expect(result).toBe('low');
    });
  });

  describe('formatFinancialNumber', () => {
    it('should format billions correctly', () => {
      expect(formatFinancialNumber(1500000000)).toBe('$1.50B');
    });

    it('should format millions correctly', () => {
      expect(formatFinancialNumber(5000000)).toBe('$5.00M');
    });

    it('should handle negative numbers', () => {
      expect(formatFinancialNumber(-1000000000)).toBe('-$1.00B');
    });
  });

  describe('determineMarginZone', () => {
    it('should return green for high margins', () => {
      expect(determineMarginZone(0.15)).toBe('green');
    });

    it('should return yellow for moderate margins', () => {
      expect(determineMarginZone(0.05)).toBe('yellow');
    });

    it('should return red for negative margins', () => {
      expect(determineMarginZone(-0.05)).toBe('red');
    });
  });
});

// ============================================================================
// Hiring Transformer Tests
// ============================================================================

describe('Hiring Transformer', () => {
  describe('transformHiringJobToKeyRole', () => {
    it('should map tier correctly', () => {
      const job: Job = {
        title: 'VP of Engineering',
        tier: 1,
        url: 'https://example.com',
        relevance_score: 85,
      };

      const result = transformHiringJobToKeyRole(job);

      expect(result.tier).toBe('executive');
    });

    it('should determine relevance', () => {
      const highRelevance: Job = {
        title: 'Search Engineer',
        tier: 3,
        url: 'https://example.com',
        relevance_score: 80,
      };

      const result = transformHiringJobToKeyRole(highRelevance);

      expect(result.relevance).toBe('high');
    });

    it('should detect search-related roles', () => {
      const searchJob: Job = {
        title: 'Senior Search Engineer',
        tier: 3,
        url: 'https://example.com',
        relevance_score: 70,
      };

      const result = transformHiringJobToKeyRole(searchJob);

      expect(result.is_search_related).toBe(true);
    });
  });

  describe('calculateEnrichedTierBreakdown', () => {
    it('should count by tier', () => {
      const jobs: Job[] = [
        { title: 'VP Eng', tier: 1, url: '', relevance_score: 80 },
        { title: 'Dir Product', tier: 2, url: '', relevance_score: 70 },
        { title: 'Engineer 1', tier: 3, url: '', relevance_score: 60 },
        { title: 'Engineer 2', tier: 3, url: '', relevance_score: 55 },
      ];

      const result = calculateEnrichedTierBreakdown(jobs);

      expect(result.executive).toBe(1);
      expect(result.director).toBe(1);
      expect(result.ic).toBe(2);
    });
  });

  describe('extractTechSignals', () => {
    it('should detect search keywords', () => {
      const data = createMockHiringData();

      const result = extractTechSignals(data);

      expect(result.search_tech_mentioned).toBe(true);
    });

    it('should detect ecommerce focus', () => {
      const data = createMockHiringData();

      const result = extractTechSignals(data);

      expect(result.ecommerce_focus).toBe(true);
    });
  });

  describe('determineGrowthIndicators', () => {
    it('should detect engineering scaling', () => {
      const jobs: Job[] = Array(6).fill(null).map((_, i) => ({
        title: `Software Engineer ${i}`,
        tier: 3 as const,
        url: '',
        relevance_score: 50,
      }));

      const tierBreakdown = { executive: 0, director: 0, ic: 6 };
      const result = determineGrowthIndicators(jobs, tierBreakdown);

      expect(result.is_scaling_engineering).toBe(true);
    });

    it('should detect search team building', () => {
      const jobs: Job[] = [
        { title: 'Senior Search Engineer', tier: 3, url: '', relevance_score: 80 },
      ];

      const tierBreakdown = { executive: 0, director: 0, ic: 1 };
      const result = determineGrowthIndicators(jobs, tierBreakdown);

      expect(result.is_building_search_team).toBe(true);
    });
  });

  describe('getHiringSignalScore', () => {
    it('should give high score for strong signals', () => {
      const data = createMockHiringData();
      const score = getHiringSignalScore(data);
      expect(score).toBeGreaterThan(50);
    });

    it('should factor in VP+ roles', () => {
      const dataWithVP = createMockHiringData();
      dataWithVP.tier_breakdown.tier_1_vp = 2;

      const dataWithoutVP = createMockHiringData();
      dataWithoutVP.tier_breakdown.tier_1_vp = 0;

      const scoreWithVP = getHiringSignalScore(dataWithVP);
      const scoreWithoutVP = getHiringSignalScore(dataWithoutVP);

      expect(scoreWithVP).toBeGreaterThan(scoreWithoutVP);
    });
  });

  describe('isHiringForSearch', () => {
    it('should return true when hiring search roles', () => {
      const data = createMockHiringData();
      expect(isHiringForSearch(data)).toBe(true);
    });

    it('should return false when no search roles', () => {
      const data = createMockHiringData();
      data.relevant_jobs = [
        { title: 'Marketing Manager', tier: 2, url: '', relevance_score: 40 },
      ];
      expect(isHiringForSearch(data)).toBe(false);
    });
  });

  describe('getSearchRelatedJobs', () => {
    it('should filter to search-related jobs only', () => {
      const data = createMockHiringData();
      const searchJobs = getSearchRelatedJobs(data);
      expect(searchJobs.length).toBeGreaterThan(0);
      expect(searchJobs.every((j) => j.title.toLowerCase().includes('search'))).toBe(true);
    });
  });
});

// ============================================================================
// Executive Transformer Tests
// ============================================================================

describe('Executive Transformer', () => {
  describe('scoreQuoteRelevanceLevel', () => {
    it('should score search-related quotes as high', () => {
      const quote = 'We are investing heavily in search and discovery to improve customer experience';
      const result = scoreQuoteRelevanceLevel(quote);
      expect(result).toBe('high');
    });

    it('should score generic quotes as low', () => {
      const quote = 'We continue to operate our business as usual.';
      const result = scoreQuoteRelevanceLevel(quote);
      expect(result).toBe('low');
    });

    it('should score conversion-related quotes as medium or high', () => {
      const quote = 'Our focus is on improving conversion rates through better digital experience';
      const result = scoreQuoteRelevanceLevel(quote);
      expect(['medium', 'high']).toContain(result);
    });
  });

  describe('mapQuoteToAlgoliaValueProp', () => {
    it('should map to correct value prop', () => {
      const searchQuote = 'We need to improve our search functionality';
      expect(mapQuoteToAlgoliaValueProp(searchQuote)).toBe('Search & Discovery');

      const mobileQuote = 'Mobile experience is critical for our app users';
      expect(mapQuoteToAlgoliaValueProp(mobileQuote)).toBe('Mobile Experience');

      const conversionQuote = 'Conversion optimization is our top priority';
      expect(mapQuoteToAlgoliaValueProp(conversionQuote)).toBe('Conversion Optimization');
    });

    it('should return General for unmatched quotes', () => {
      const genericQuote = 'We had a great quarter with strong results';
      expect(mapQuoteToAlgoliaValueProp(genericQuote)).toBe('General');
    });
  });

  describe('extractSpeakingPhrases', () => {
    it('should extract key phrases', () => {
      const data = createMockExecutiveData();
      const phrases = extractSpeakingPhrases(data.quotes);
      expect(Array.isArray(phrases)).toBe(true);
    });

    it('should limit to 10 phrases', () => {
      const data = createMockExecutiveData();
      const phrases = extractSpeakingPhrases(data.quotes);
      expect(phrases.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateAlgoliaAngle', () => {
    it('should generate angle for search theme', () => {
      const angle = generateAlgoliaAngle('search optimization');
      expect(angle).toContain('Algolia');
    });

    it('should generate angle for customer experience', () => {
      const angle = generateAlgoliaAngle('customer experience improvement');
      expect(angle).toContain('Algolia');
    });
  });

  describe('transformToExecutiveInsights', () => {
    it('should transform data correctly', () => {
      const data = createMockExecutiveData();
      const insights = transformToExecutiveInsights(data);

      expect(insights.key_quotes.length).toBeGreaterThan(0);
      expect(insights.strategic_themes.length).toBeGreaterThan(0);
      expect(insights.total_quotes).toBe(data.quotes.length);
    });

    it('should include algolia angles in themes', () => {
      const data = createMockExecutiveData();
      const insights = transformToExecutiveInsights(data);

      for (const theme of insights.strategic_themes) {
        expect(theme.algolia_angle).toBeDefined();
        expect(theme.algolia_angle.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getCLevelQuotes', () => {
    it('should filter to C-level only', () => {
      const data = createMockExecutiveData();
      const cLevelQuotes = getCLevelQuotes(data);

      expect(cLevelQuotes.length).toBeGreaterThan(0);
      for (const quote of cLevelQuotes) {
        expect(quote.title.toLowerCase()).toMatch(/ceo|cto|cfo|cio|cdo|cmo|chief/);
      }
    });
  });

  describe('extractStrategicPriorities', () => {
    it('should extract unique priorities', () => {
      const data = createMockExecutiveData();
      const priorities = extractStrategicPriorities(data);

      expect(priorities.length).toBeGreaterThan(0);
      expect(priorities.length).toBeLessThanOrEqual(5);
      // Check uniqueness
      const unique = new Set(priorities);
      expect(unique.size).toBe(priorities.length);
    });
  });
});

// ============================================================================
// Investor Transformer Tests
// ============================================================================

describe('Investor Transformer', () => {
  describe('transformRiskFactorEnhanced', () => {
    it('should categorize correctly', () => {
      const factor = {
        category: 'Technology Risk',
        description: 'Our systems may fail',
        relevance_to_algolia: 'high' as const,
      };

      const result = transformRiskFactorEnhanced(factor);

      expect(result.category).toBe('Technology Risk');
      expect(result.algolia_relevance).toBe('high');
    });

    it('should provide Algolia mitigation', () => {
      const factor = {
        category: 'Technology Risk',
        description: 'Technology infrastructure concerns',
        relevance_to_algolia: 'high' as const,
      };

      const result = transformRiskFactorEnhanced(factor);

      expect(result.algolia_mitigation).toBeDefined();
      expect(result.algolia_mitigation).toContain('Algolia');
    });
  });

  describe('extractDigitalMentions', () => {
    it('should extract digital-related phrases', () => {
      const text = 'Our digital transformation is accelerating e-commerce growth';
      const mentions = extractDigitalMentions(text);

      expect(mentions.length).toBeGreaterThan(0);
    });
  });

  describe('extractSearchMentions', () => {
    it('should extract search-related phrases', () => {
      const text = 'Search functionality and discovery features are improving';
      const mentions = extractSearchMentions(text);

      expect(mentions.length).toBeGreaterThan(0);
    });
  });

  describe('determineDigitalTransformationStage', () => {
    it('should return early for minimal mentions', () => {
      const filings = [{ type: '10-K' as const, filing_date: '', url: '', highlights: ['Some business activities'] }];
      const quotes = ['We are a traditional company'];

      const result = determineDigitalTransformationStage(filings, quotes);

      expect(['early', 'unknown']).toContain(result);
    });

    it('should return advanced for heavy digital focus', () => {
      const filings = [
        {
          type: '10-K' as const,
          filing_date: '',
          url: '',
          highlights: [
            'Digital transformation',
            'AI and machine learning',
            'Personalization platform',
            'Omnichannel commerce',
            'Headless architecture',
            'Cloud migration',
            'Data-driven decisions',
            'E-commerce growth',
            'Digital technology investments',
            'Online platform modernization',
            'Analytics platform',
          ],
        },
      ];
      const quotes = [
        'We are investing in AI and machine learning',
        'Digital first strategy',
        'Personalization at scale',
      ];

      const result = determineDigitalTransformationStage(filings, quotes);

      expect(result).toBe('advanced');
    });

    it('should return mid for moderate mentions', () => {
      const filings = [
        {
          type: '10-K' as const,
          filing_date: '',
          url: '',
          highlights: [
            'Digital sales growth',
            'E-commerce platform',
            'Online customer engagement',
            'Technology investments',
            'Digital transformation underway',
          ],
        },
      ];
      const quotes = ['We are focused on digital growth'];

      const result = determineDigitalTransformationStage(filings, quotes);

      expect(['mid', 'advanced']).toContain(result);
    });
  });

  describe('extractGrowthDrivers', () => {
    it('should extract drivers from investor data', () => {
      const data = createMockInvestorData();
      const drivers = extractGrowthDrivers(data);

      expect(Array.isArray(drivers)).toBe(true);
    });

    it('should limit to 5 drivers', () => {
      const data = createMockInvestorData();
      const drivers = extractGrowthDrivers(data);

      expect(drivers.length).toBeLessThanOrEqual(5);
    });
  });

  describe('extractHeadwinds', () => {
    it('should extract headwinds from risk factors', () => {
      const data = createMockInvestorData();
      const headwinds = extractHeadwinds(data);

      expect(Array.isArray(headwinds)).toBe(true);
    });
  });

  describe('transformToInvestorIntelligence', () => {
    it('should transform data correctly', () => {
      const data = createMockInvestorData();
      const intelligence = transformToInvestorIntelligence(data);

      expect(intelligence.sec_filings.length).toBeGreaterThan(0);
      expect(intelligence.risk_factors.length).toBeGreaterThan(0);
      expect(intelligence.digital_transformation_stage).toBeDefined();
    });

    it('should include algolia mitigations for all risk factors', () => {
      const data = createMockInvestorData();
      const intelligence = transformToInvestorIntelligence(data);

      for (const risk of intelligence.risk_factors) {
        expect(risk.algolia_mitigation).toBeDefined();
        expect(risk.algolia_mitigation.length).toBeGreaterThan(0);
      }
    });
  });

  describe('parseQuarterToDate', () => {
    it('should parse Q1 correctly', () => {
      const result = parseQuarterToDate('Q1 2024');
      expect(result).toBe('2024-03-31');
    });

    it('should parse Q4 correctly', () => {
      const result = parseQuarterToDate('Q4 2024');
      expect(result).toBe('2024-12-31');
    });

    it('should handle invalid format', () => {
      const result = parseQuarterToDate('Invalid');
      expect(result).toBe('');
    });
  });

  describe('getInvestorSignalScore', () => {
    it('should score based on relevance', () => {
      const data = createMockInvestorData();
      const score = getInvestorSignalScore(data);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('hasTechnologyRisks', () => {
    it('should return true for tech risks', () => {
      const data = createMockInvestorData();
      expect(hasTechnologyRisks(data)).toBe(true);
    });

    it('should return false when no tech risks', () => {
      const data = createMockInvestorData();
      data.risk_factors = [
        {
          category: 'Economic Risk',
          description: 'Economic conditions',
          relevance_to_algolia: 'low',
        },
      ];
      expect(hasTechnologyRisks(data)).toBe(false);
    });
  });
});
