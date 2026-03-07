/**
 * Strategic Analysis Engine Tests
 *
 * Tests for backend/services/strategic-analysis-engine.ts:
 * - Data gathering from all enrichment modules
 * - Value proposition scoring and ranking
 * - Business impact calculation
 * - Sales pitch generation
 * - Timing intelligence extraction
 * - Overall confidence calculation
 * - Database persistence
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StrategicAnalysisEngine } from '../../services/strategic-analysis-engine';
import { SupabaseClient } from '../../database/supabase';

// Mock the Supabase client
vi.mock('../../database/supabase');
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('StrategicAnalysisEngine', () => {
  let engine: StrategicAnalysisEngine;
  let mockSupabase: any;

  const TEST_COMPANY_ID = 'comp_test123';
  const TEST_AUDIT_ID = 'audit_test456';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      query: vi.fn(),
      insert: vi.fn(),
    };

    // Mock the constructor to return our mock
    (SupabaseClient as any).mockImplementation(() => mockSupabase);

    engine = new StrategicAnalysisEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('synthesize - Complete Flow', () => {
    it('should synthesize strategic analysis from complete enrichment data', async () => {
      // Mock enrichment data with high-quality insights
      mockSupabase.query.mockImplementation(async (table: string) => {
        switch (table) {
          case 'company_traffic':
            return [{
              insight: 'High bounce rate 52% indicates poor search relevance',
              confidence_score: 9.2,
              evidence_urls: ['https://similarweb.com/...'],
              monthly_visits: 5_000_000,
              bounce_rate: 0.52,
              avg_visit_duration_seconds: 180,
              pages_per_visit: 2.5,
              mobile_traffic_share: 0.45
            }];

          case 'company_financials':
            return [{
              insight: 'Revenue declining 8% YoY - digital optimization critical',
              confidence_score: 9.5,
              evidence_urls: ['https://finance.yahoo.com/...'],
              revenue: 2_400_000_000, // $2.4B annual
              revenue_growth_yoy: -0.08,
              profit_margin: 0.12
            }];

          case 'company_technologies':
            return [{
              insight: 'Using legacy Elasticsearch - migration opportunity',
              confidence_score: 9.0,
              evidence_urls: ['https://builtwith.com/...']
            }];

          case 'company_competitors':
            return [{
              insight: '3 of 5 competitors use Algolia - competitive pressure',
              confidence_score: 8.8,
              evidence_urls: ['https://builtwith.com/...']
            }];

          case 'company_hiring':
            return [
              {
                job_title: 'Senior Search Engineer',
                insight: 'Hiring search engineers - build vs buy decision point',
                confidence_score: 8.5,
                evidence_urls: ['https://careers.example.com/...']
              },
              {
                job_title: 'Search Platform Architect',
                insight: null,
                confidence_score: null,
                evidence_urls: []
              },
              {
                job_title: 'Full Stack Engineer (Search)',
                insight: null,
                confidence_score: null,
                evidence_urls: []
              }
            ];

          case 'search_audit_tests':
            return [{
              insight: 'Zero typo tolerance - users hitting dead ends',
              confidence_score: 9.3,
              evidence_urls: ['screenshot://01-typo-test.png']
            }];

          case 'executive_quotes':
            return [{
              executive_name: 'Jane Smith',
              quote_text: 'We are prioritizing digital transformation and customer experience',
              source_date: '2026-02-15',
              source_type: 'earnings_call',
              insight: 'CEO prioritizing digital transformation',
              confidence_score: 9.0,
              evidence_urls: ['https://seekingalpha.com/...']
            }];

          case 'company_executives':
          case 'company_social_profiles':
          case 'company_social_posts':
          case 'buying_committee':
          case 'intent_signals':
            return [];

          default:
            return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({
        company_id: TEST_COMPANY_ID,
        audit_id: TEST_AUDIT_ID
      });

      // Execute synthesis
      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      // Assertions
      expect(result).toBeDefined();
      expect(result.company_id).toBe(TEST_COMPANY_ID);
      expect(result.audit_id).toBe(TEST_AUDIT_ID);

      // Primary value prop should be search_relevance (strongest signals)
      expect(result.primary_value_prop).toBe('search_relevance');

      // Should have secondary value props
      expect(result.secondary_value_props.length).toBeGreaterThan(0);

      // Sales pitch should be generated
      expect(result.sales_pitch).toContain('search relevance');
      expect(result.sales_pitch.length).toBeGreaterThan(100);

      // Business impact should be quantified
      expect(result.business_impact).toContain('$');
      expect(result.business_impact).toMatch(/\d+\.\d+M/); // Format: $X.XM

      // Strategic recommendations should be present
      expect(result.strategic_recommendations).toContain('## How Algolia Can Help');
      expect(result.strategic_recommendations).toContain('Search Relevance');

      // Timing intelligence
      expect(result.trigger_events.length).toBeGreaterThan(0);
      expect(result.timing_signals.length).toBeGreaterThan(0);
      expect(result.caution_signals.length).toBeGreaterThan(0);

      // Confidence score should be >= 8.0
      expect(result.overall_confidence_score).toBeGreaterThanOrEqual(8.0);
      expect(result.overall_confidence_score).toBeLessThanOrEqual(10.0);

      // Should have synthesized from multiple modules
      expect(result.insights_synthesized_from.length).toBeGreaterThanOrEqual(6);

      // Should have saved to database
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        'company_strategic_analysis',
        expect.objectContaining({
          company_id: TEST_COMPANY_ID,
          audit_id: TEST_AUDIT_ID,
          primary_value_prop: 'search_relevance'
        })
      );
    });

    it('should handle partial enrichment data gracefully', async () => {
      // Mock only 2 modules with insights
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_traffic') {
          return [{
            insight: 'Mobile traffic 60% - mobile experience optimization needed',
            confidence_score: 8.5,
            evidence_urls: ['https://similarweb.com/...'],
            monthly_visits: 1_000_000,
            mobile_traffic_share: 0.60
          }];
        } else if (table === 'company_technologies') {
          return [{
            insight: 'Using Adobe Commerce - Algolia integration available',
            confidence_score: 8.2,
            evidence_urls: ['https://builtwith.com/...']
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      // Should still generate analysis with available data
      expect(result).toBeDefined();
      expect(result.primary_value_prop).toBe('mobile_experience');
      expect(result.overall_confidence_score).toBeGreaterThanOrEqual(8.0);
      expect(result.insights_synthesized_from.length).toBe(2);
    });

    it('should throw error when no enrichment data exists', async () => {
      // Mock empty results for all tables
      mockSupabase.query.mockResolvedValue([]);

      await expect(
        engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID)
      ).rejects.toThrow('No enrichment data found');
    });
  });

  describe('Value Prop Scoring', () => {
    it('should prioritize search_relevance with strong search-related insights', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'search_audit_tests') {
          return [
            {
              insight: 'Poor typo tolerance causing 23% search failures',
              confidence_score: 9.5,
              evidence_urls: []
            },
            {
              insight: 'Zero results on 15% of queries - relevance tuning needed',
              confidence_score: 9.2,
              evidence_urls: []
            },
            {
              insight: 'Synonym matching broken - "headlamp" returns 2 results vs "headlight" 538',
              confidence_score: 9.0,
              evidence_urls: []
            }
          ];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      expect(result.primary_value_prop).toBe('search_relevance');
    });

    it('should prioritize scale_performance with traffic/performance insights', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_traffic') {
          return [{
            insight: 'Traffic growing 120% YoY - scale concerns with current infrastructure',
            confidence_score: 9.3,
            evidence_urls: []
          }];
        } else if (table === 'company_technologies') {
          return [{
            insight: 'Self-hosted Elasticsearch struggling with 50M+ records',
            confidence_score: 9.0,
            evidence_urls: []
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      expect(result.primary_value_prop).toBe('scale_performance');
    });
  });

  describe('Business Impact Calculation', () => {
    it('should calculate revenue at risk from poor search relevance', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'search_audit_tests') {
          return [{
            insight: 'Poor search relevance',
            confidence_score: 9.0,
            evidence_urls: []
          }];
        } else if (table === 'company_traffic') {
          return [{
            insight: 'Traffic insight',
            confidence_score: 8.5,
            evidence_urls: [],
            monthly_visits: 2_000_000,
            bounce_rate: 0.50 // 50% bounce rate (35% is good)
          }];
        } else if (table === 'company_financials') {
          return [{
            insight: 'Financial insight',
            confidence_score: 8.5,
            evidence_urls: [],
            revenue: 1_200_000_000 // $1.2B annual
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      // Should calculate revenue impact
      expect(result.business_impact).toContain('$');
      expect(result.business_impact).toContain('M');
      expect(result.business_impact).toContain('bounce rate');
    });
  });

  describe('Timing Intelligence', () => {
    it('should extract trigger events from executive quotes', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_technologies') {
          return [{
            insight: 'Test insight',
            confidence_score: 8.5,
            evidence_urls: []
          }];
        } else if (table === 'executive_quotes') {
          return [{
            executive_name: 'John CEO',
            quote_text: 'We are investing heavily in digital transformation this year',
            source_date: '2026-03-01',
            source_type: 'earnings_call',
            insight: 'CEO prioritizing digital',
            confidence_score: 9.0,
            evidence_urls: []
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      expect(result.trigger_events.length).toBeGreaterThan(0);
      expect(result.trigger_events[0]).toContain('John CEO');
      expect(result.trigger_events[0]).toContain('digital transformation');
    });

    it('should identify hiring signals as timing indicators', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_technologies') {
          return [{
            insight: 'Test insight',
            confidence_score: 8.5,
            evidence_urls: []
          }];
        } else if (table === 'company_hiring') {
          return [
            { job_title: 'Senior Search Engineer', insight: null, confidence_score: null },
            { job_title: 'Search Platform Architect', insight: null, confidence_score: null },
            { job_title: 'ML Engineer - Search', insight: null, confidence_score: null },
            { job_title: 'Principal Engineer - Discovery', insight: null, confidence_score: null }
          ];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      expect(result.timing_signals.length).toBeGreaterThan(0);
      expect(result.timing_signals[0]).toContain('Hiring');
      expect(result.timing_signals[0]).toContain('search');
    });

    it('should flag declining revenue as caution signal', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_technologies') {
          return [{
            insight: 'Test insight',
            confidence_score: 8.5,
            evidence_urls: []
          }];
        } else if (table === 'company_financials') {
          return [{
            insight: 'Revenue declining',
            confidence_score: 9.0,
            evidence_urls: [],
            revenue_growth_yoy: -0.12 // -12% YoY
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      expect(result.timing_signals.length).toBeGreaterThan(0);
      expect(result.timing_signals[0]).toContain('declining');
      expect(result.timing_signals[0]).toContain('12');
    });
  });

  describe('Confidence Score Calculation', () => {
    it('should calculate weighted average of module confidence scores', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_traffic') {
          return [{
            insight: 'Traffic insight',
            confidence_score: 9.5,
            evidence_urls: []
          }];
        } else if (table === 'company_financials') {
          return [{
            insight: 'Financial insight',
            confidence_score: 9.0,
            evidence_urls: []
          }];
        } else if (table === 'company_technologies') {
          return [{
            insight: 'Tech insight',
            confidence_score: 8.5,
            evidence_urls: []
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      // Average of 9.5, 9.0, 8.5 = 9.0
      expect(result.overall_confidence_score).toBeCloseTo(9.0, 1);
    });

    it('should floor confidence score at 8.0', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_technologies') {
          return [{
            insight: 'Low confidence insight',
            confidence_score: 8.0,
            evidence_urls: []
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      const result = await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      expect(result.overall_confidence_score).toBeGreaterThanOrEqual(8.0);
    });
  });

  describe('Database Persistence', () => {
    it('should save strategic analysis to company_strategic_analysis table', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_technologies') {
          return [{
            insight: 'Test insight',
            confidence_score: 9.0,
            evidence_urls: []
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockResolvedValue({});

      await engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        'company_strategic_analysis',
        expect.objectContaining({
          company_id: TEST_COMPANY_ID,
          audit_id: TEST_AUDIT_ID,
          primary_value_prop: expect.any(String),
          overall_confidence_score: expect.any(Number)
        })
      );
    });

    it('should throw error if database save fails', async () => {
      mockSupabase.query.mockImplementation(async (table: string) => {
        if (table === 'company_technologies') {
          return [{
            insight: 'Test insight',
            confidence_score: 9.0,
            evidence_urls: []
          }];
        } else {
          return [];
        }
      });

      mockSupabase.insert.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        engine.synthesize(TEST_COMPANY_ID, TEST_AUDIT_ID)
      ).rejects.toThrow('Failed to save strategic analysis');
    });
  });
});
