/**
 * Composite Scoring Service Tests
 *
 * Tests all four scoring dimensions and overall scoring logic.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFitScore,
  calculateIntentScore,
  calculateValueScore,
  calculateDisplacementScore,
  calculateOverallScore,
  getStatusFromScore,
  EnrichmentData,
} from '../services/scoring';

// =============================================================================
// TEST DATA FIXTURES
// =============================================================================

const mockCompanyBase = {
  id: 'test-company-id',
  domain: 'example.com',
  name: 'Example Corp',
};

const mockEnrichmentMinimal: EnrichmentData = {
  company: mockCompanyBase,
};

const mockEnrichmentIdeal: EnrichmentData = {
  company: {
    ...mockCompanyBase,
    industry: 'ecommerce',
    sector: 'retail',
    founded_year: 1995,
    headquarters_country: 'US',
    employee_count: 5000,
    annual_revenue: 500_000_000,
    is_public: true,
    stock_ticker: 'EXMP',
  },
  traffic: {
    monthly_visits: 5_000_000,
    bounce_rate: 65,
    avg_visit_duration: 180,
    mobile_pct: 60,
    yoy_growth: 25,
  },
  financials: {
    revenue: 500_000_000,
    revenue_growth: 18,
    gross_profit: 200_000_000,
    net_income: 50_000_000,
    free_cash_flow: 40_000_000,
    margin: 10,
  },
  technologies: [
    { technology_name: 'Adobe Experience Manager', technology_category: 'cms' },
    { technology_name: 'Elasticsearch', technology_category: 'search' },
    { technology_name: 'Google Analytics', technology_category: 'analytics' },
  ],
  competitors: [
    { competitor_domain: 'competitor1.com', competitor_search_provider: 'Algolia' },
    { competitor_domain: 'competitor2.com', competitor_search_provider: 'Elasticsearch' },
  ],
  executives: [
    { full_name: 'Jane CEO', title: 'Chief Executive Officer', role_category: 'ceo' },
    { full_name: 'John CTO', title: 'Chief Technology Officer', role_category: 'cto' },
  ],
  quotes: [
    {
      executive_name: 'Jane CEO',
      quote_text: 'We need to improve our search experience',
      keywords: ['search', 'customer experience'],
      source_type: 'earnings_call',
    },
  ],
  hiring: [
    { job_title: 'Senior Search Engineer', department: 'Engineering', posted_date: new Date('2026-03-01') },
    { job_title: 'Platform Engineer', department: 'Engineering', posted_date: new Date('2026-02-15') },
    { job_title: 'Data Engineer', department: 'Data', posted_date: new Date('2026-02-01') },
  ],
  intent_signals: [
    { signal_type: 'technology_research', signal_description: 'Researching search solutions', confidence_score: 85 },
    { signal_type: 'funding_event', signal_description: 'Series C funding', confidence_score: 90 },
  ],
};

const mockEnrichmentAlreadyHasAlgolia: EnrichmentData = {
  ...mockEnrichmentIdeal,
  technologies: [
    { technology_name: 'Adobe Experience Manager', technology_category: 'cms' },
    { technology_name: 'Algolia', technology_category: 'search' },
  ],
};

// =============================================================================
// FIT SCORE TESTS
// =============================================================================

describe('calculateFitScore', () => {
  it('should return 0 for minimal data', () => {
    const result = calculateFitScore(mockEnrichmentMinimal);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown).toBeInstanceOf(Array);
  });

  it('should score high for target vertical (ecommerce)', () => {
    const data: EnrichmentData = {
      company: { ...mockCompanyBase, industry: 'ecommerce' },
    };
    const result = calculateFitScore(data);
    expect(result.breakdown.some((b) => b.includes('Target vertical'))).toBe(true);
  });

  it('should score higher for mid-market company size (1000-10000 employees)', () => {
    const data: EnrichmentData = {
      company: { ...mockCompanyBase, employee_count: 5000 },
    };
    const result = calculateFitScore(data);
    expect(result.breakdown.some((b) => b.includes('Mid-market sweet spot'))).toBe(true);
  });

  it('should score higher for US/Europe geography', () => {
    const data: EnrichmentData = {
      company: { ...mockCompanyBase, headquarters_country: 'US' },
    };
    const result = calculateFitScore(data);
    expect(result.breakdown.some((b) => b.includes('Prime geography'))).toBe(true);
  });

  it('should score higher for public companies', () => {
    const data: EnrichmentData = {
      company: { ...mockCompanyBase, is_public: true, stock_ticker: 'EXMP' },
    };
    const result = calculateFitScore(data);
    expect(result.breakdown.some((b) => b.includes('Public company'))).toBe(true);
  });

  it('should score higher for enterprise revenue (>$1B)', () => {
    const data: EnrichmentData = {
      company: { ...mockCompanyBase, annual_revenue: 2_000_000_000 },
    };
    const result = calculateFitScore(data);
    expect(result.breakdown.some((b) => b.includes('Enterprise revenue'))).toBe(true);
  });

  it('should return score between 0-100', () => {
    const result = calculateFitScore(mockEnrichmentIdeal);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// INTENT SCORE TESTS
// =============================================================================

describe('calculateIntentScore', () => {
  it('should return 0 for minimal data', () => {
    const result = calculateIntentScore(mockEnrichmentMinimal);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown).toBeInstanceOf(Array);
  });

  it('should score high for high traffic (>1M visits/month)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      traffic: { monthly_visits: 5_000_000, bounce_rate: 50, avg_visit_duration: 120, mobile_pct: 50 },
    };
    const result = calculateIntentScore(data);
    expect(result.breakdown.some((b) => b.includes('traffic'))).toBe(true);
  });

  it('should score high for strong traffic growth (>20% YoY)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      traffic: { monthly_visits: 1_000_000, bounce_rate: 50, avg_visit_duration: 120, mobile_pct: 50, yoy_growth: 25 },
    };
    const result = calculateIntentScore(data);
    expect(result.breakdown.some((b) => b.includes('Strong growth'))).toBe(true);
  });

  it('should score high for active hiring (multiple search/eng roles)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      hiring: [
        { job_title: 'Search Engineer', posted_date: new Date() },
        { job_title: 'Platform Engineer', posted_date: new Date() },
        { job_title: 'Data Engineer', posted_date: new Date() },
        { job_title: 'Software Engineer', posted_date: new Date() },
        { job_title: 'Backend Engineer', posted_date: new Date() },
      ],
    };
    const result = calculateIntentScore(data);
    expect(result.breakdown.some((b) => b.includes('Active hiring'))).toBe(true);
  });

  it('should score for high bounce rate (indicates search problems)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      traffic: { monthly_visits: 1_000_000, bounce_rate: 75, avg_visit_duration: 120, mobile_pct: 50 },
    };
    const result = calculateIntentScore(data);
    expect(result.breakdown.some((b) => b.includes('bounce rate'))).toBe(true);
  });

  it('should score high when executives mention search', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      quotes: [{ executive_name: 'CEO', quote_text: 'Search is critical', keywords: ['search'], source_type: 'earnings_call' }],
    };
    const result = calculateIntentScore(data);
    expect(result.breakdown.some((b) => b.includes('search/CX'))).toBe(true);
  });

  it('should score high for Apollo intent signals', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      intent_signals: [
        { signal_type: 'technology_research', signal_description: 'Researching search', confidence_score: 90 },
        { signal_type: 'funding', signal_description: 'Series C', confidence_score: 85 },
      ],
    };
    const result = calculateIntentScore(data);
    expect(result.breakdown.some((b) => b.includes('intent signals'))).toBe(true);
  });
});

// =============================================================================
// VALUE SCORE TESTS
// =============================================================================

describe('calculateValueScore', () => {
  it('should return 0 for minimal data', () => {
    const result = calculateValueScore(mockEnrichmentMinimal);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown).toBeInstanceOf(Array);
  });

  it('should score high for enterprise revenue (>$1B)', () => {
    const data: EnrichmentData = {
      company: { ...mockCompanyBase, annual_revenue: 2_000_000_000 },
    };
    const result = calculateValueScore(data);
    expect(result.breakdown.some((b) => b.includes('Enterprise revenue'))).toBe(true);
  });

  it('should score high for strong revenue growth (>15% YoY)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      financials: { revenue: 500_000_000, revenue_growth: 20, margin: 15 },
    };
    const result = calculateValueScore(data);
    expect(result.breakdown.some((b) => b.includes('revenue growth'))).toBe(true);
  });

  it('should score high for strong profit margins (>20%)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      financials: { revenue: 500_000_000, margin: 25 },
    };
    const result = calculateValueScore(data);
    expect(result.breakdown.some((b) => b.includes('margins'))).toBe(true);
  });

  it('should score high for positive free cash flow', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      financials: { revenue: 500_000_000, free_cash_flow: 50_000_000 },
    };
    const result = calculateValueScore(data);
    expect(result.breakdown.some((b) => b.includes('FCF'))).toBe(true);
  });

  it('should score high for high traffic * engagement', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      traffic: { monthly_visits: 10_000_000, bounce_rate: 50, avg_visit_duration: 300, mobile_pct: 50 },
    };
    const result = calculateValueScore(data);
    expect(result.breakdown.some((b) => b.includes('engagement'))).toBe(true);
  });

  it('should bonus for public company with strong financials', () => {
    const data: EnrichmentData = {
      company: { ...mockCompanyBase, is_public: true, annual_revenue: 500_000_000 },
    };
    const result = calculateValueScore(data);
    expect(result.breakdown.some((b) => b.includes('Public company'))).toBe(true);
  });
});

// =============================================================================
// DISPLACEMENT SCORE TESTS
// =============================================================================

describe('calculateDisplacementScore', () => {
  it('should return 0 for minimal data', () => {
    const result = calculateDisplacementScore(mockEnrichmentMinimal);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown).toBeInstanceOf(Array);
  });

  it('should score high for partner technology (Adobe AEM)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      technologies: [{ technology_name: 'Adobe Experience Manager', technology_category: 'cms' }],
    };
    const result = calculateDisplacementScore(data);
    expect(result.breakdown.some((b) => b.includes('partner technology'))).toBe(true);
  });

  it('should score high for displaceable search provider (Elasticsearch)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      technologies: [{ technology_name: 'Elasticsearch', technology_category: 'search' }],
    };
    const result = calculateDisplacementScore(data);
    expect(result.breakdown.some((b) => b.includes('displaceable search'))).toBe(true);
  });

  it('should return 0 if already using Algolia', () => {
    const result = calculateDisplacementScore(mockEnrichmentAlreadyHasAlgolia);
    expect(result.score).toBe(0);
    expect(result.breakdown.some((b) => b.includes('DISQUALIFIED'))).toBe(true);
  });

  it('should score high for no Algolia (opportunity)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      technologies: [{ technology_name: 'Elasticsearch', technology_category: 'search' }],
    };
    const result = calculateDisplacementScore(data);
    expect(result.breakdown.some((b) => b.includes('No Algolia'))).toBe(true);
  });

  it('should score high for e-commerce company', () => {
    const data: EnrichmentData = {
      company: { ...mockCompanyBase, industry: 'ecommerce' },
      technologies: [{ technology_name: 'Shopify', technology_category: 'ecommerce' }],
    };
    const result = calculateDisplacementScore(data);
    expect(result.breakdown.some((b) => b.includes('E-commerce'))).toBe(true);
  });

  it('should score for poor search experience (high bounce, low engagement)', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      technologies: [{ technology_name: 'Elasticsearch', technology_category: 'search' }],
      traffic: { monthly_visits: 1_000_000, bounce_rate: 70, avg_visit_duration: 90, mobile_pct: 50 },
    };
    const result = calculateDisplacementScore(data);
    expect(result.breakdown.some((b) => b.includes('experience'))).toBe(true);
  });

  it('should bonus if competitor uses Algolia', () => {
    const data: EnrichmentData = {
      company: mockCompanyBase,
      technologies: [{ technology_name: 'Elasticsearch', technology_category: 'search' }],
      competitors: [{ competitor_domain: 'competitor.com', competitor_search_provider: 'Algolia' }],
    };
    const result = calculateDisplacementScore(data);
    expect(result.breakdown.some((b) => b.includes('Competitor using Algolia'))).toBe(true);
  });
});

// =============================================================================
// OVERALL SCORE TESTS
// =============================================================================

describe('calculateOverallScore', () => {
  it('should calculate weighted average (25% each)', () => {
    const overall = calculateOverallScore(80, 60, 70, 50);
    // (80 + 60 + 70 + 50) / 4 = 65
    expect(overall).toBe(65.0);
  });

  it('should clamp score to 0-100 range', () => {
    const overall1 = calculateOverallScore(100, 100, 100, 100);
    expect(overall1).toBe(100.0);

    const overall2 = calculateOverallScore(0, 0, 0, 0);
    expect(overall2).toBe(0.0);
  });

  it('should round to 1 decimal place', () => {
    const overall = calculateOverallScore(75, 66, 83, 51);
    // (75 + 66 + 83 + 51) / 4 = 68.75
    expect(overall).toBe(68.8); // Rounded to 1 decimal
  });
});

// =============================================================================
// STATUS TESTS
// =============================================================================

describe('getStatusFromScore', () => {
  it('should return "hot" for score >= 70', () => {
    expect(getStatusFromScore(70)).toBe('hot');
    expect(getStatusFromScore(85)).toBe('hot');
    expect(getStatusFromScore(100)).toBe('hot');
  });

  it('should return "warm" for score 40-69', () => {
    expect(getStatusFromScore(40)).toBe('warm');
    expect(getStatusFromScore(55)).toBe('warm');
    expect(getStatusFromScore(69)).toBe('warm');
  });

  it('should return "cold" for score < 40', () => {
    expect(getStatusFromScore(0)).toBe('cold');
    expect(getStatusFromScore(25)).toBe('cold');
    expect(getStatusFromScore(39)).toBe('cold');
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration: Full scoring flow', () => {
  it('should score ideal company as HOT', () => {
    const fit = calculateFitScore(mockEnrichmentIdeal);
    const intent = calculateIntentScore(mockEnrichmentIdeal);
    const value = calculateValueScore(mockEnrichmentIdeal);
    const displacement = calculateDisplacementScore(mockEnrichmentIdeal);
    const overall = calculateOverallScore(fit.score, intent.score, value.score, displacement.score);
    const status = getStatusFromScore(overall);

    expect(fit.score).toBeGreaterThan(50);
    expect(intent.score).toBeGreaterThan(50);
    expect(value.score).toBeGreaterThan(50);
    expect(displacement.score).toBeGreaterThan(50);
    expect(overall).toBeGreaterThanOrEqual(70);
    expect(status).toBe('hot');
  });

  it('should score minimal company as COLD', () => {
    const fit = calculateFitScore(mockEnrichmentMinimal);
    const intent = calculateIntentScore(mockEnrichmentMinimal);
    const value = calculateValueScore(mockEnrichmentMinimal);
    const displacement = calculateDisplacementScore(mockEnrichmentMinimal);
    const overall = calculateOverallScore(fit.score, intent.score, value.score, displacement.score);
    const status = getStatusFromScore(overall);

    expect(overall).toBeLessThan(40);
    expect(status).toBe('cold');
  });

  it('should score company with Algolia as COLD (displacement = 0)', () => {
    const fit = calculateFitScore(mockEnrichmentAlreadyHasAlgolia);
    const intent = calculateIntentScore(mockEnrichmentAlreadyHasAlgolia);
    const value = calculateValueScore(mockEnrichmentAlreadyHasAlgolia);
    const displacement = calculateDisplacementScore(mockEnrichmentAlreadyHasAlgolia);
    const overall = calculateOverallScore(fit.score, intent.score, value.score, displacement.score);

    expect(displacement.score).toBe(0); // CRITICAL: Disqualified
    // Overall score will be dragged down by 0 displacement (25% weight)
    expect(overall).toBeLessThan(70); // Likely WARM or COLD
  });

  it('should have complete breakdown for all dimensions', () => {
    const fit = calculateFitScore(mockEnrichmentIdeal);
    const intent = calculateIntentScore(mockEnrichmentIdeal);
    const value = calculateValueScore(mockEnrichmentIdeal);
    const displacement = calculateDisplacementScore(mockEnrichmentIdeal);

    expect(fit.breakdown.length).toBeGreaterThan(0);
    expect(intent.breakdown.length).toBeGreaterThan(0);
    expect(value.breakdown.length).toBeGreaterThan(0);
    expect(displacement.breakdown.length).toBeGreaterThan(0);

    // Each breakdown should explain scoring decisions
    expect(fit.breakdown.every((b) => b.includes(':'))).toBe(true);
    expect(intent.breakdown.every((b) => b.includes(':'))).toBe(true);
    expect(value.breakdown.every((b) => b.includes(':'))).toBe(true);
    expect(displacement.breakdown.every((b) => b.includes(':'))).toBe(true);
  });
});
