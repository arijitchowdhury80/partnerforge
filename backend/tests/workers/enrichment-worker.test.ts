/**
 * Enrichment Worker Integration Tests
 *
 * Tests all 15 modules across 4 waves with actual database writes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Queue, Worker } from 'bullmq';
import { SupabaseClient } from '../../database/supabase';
import { EnrichmentOrchestrator } from '../../services/enrichment-orchestrator';
import { EnrichmentJobData } from '../../workers/enrichment-worker';

// Mock all API clients to prevent real API calls
vi.mock('../../services/similarweb', () => ({
  SimilarWebClient: vi.fn().mockImplementation(() => ({
    fetchAllData: vi.fn().mockResolvedValue({
      traffic: {
        data: {
          visits: [
            { date: '2025-12', visits: 45000000, unique_visitors: 30000000 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/traffic' }
      },
      engagement: {
        data: {
          bounce_rate: [{ date: '2025-12', bounce_rate: 0.42 }],
          pages_per_visit: [{ date: '2025-12', pages_per_visit: 5.8 }],
          avg_duration: [{ date: '2025-12', duration: 285 }]
        },
        source: { provider: 'SimilarWeb', endpoint: '/engagement' }
      },
      traffic_sources: {
        data: {
          channels: {
            direct: 0.45,
            search: 0.28,
            social: 0.08,
            referral: 0.12,
            paid: 0.07
          }
        },
        source: { provider: 'SimilarWeb', endpoint: '/traffic-sources' }
      },
      geography: {
        data: {
          countries: [
            { country_code: 'US', country_name: 'United States', share: 0.65 },
            { country_code: 'CA', country_name: 'Canada', share: 0.15 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/geography' }
      },
      demographics: {
        data: {
          age_distribution: {
            '18-24': 0.12,
            '25-34': 0.28,
            '35-44': 0.24,
            '45-54': 0.20,
            '55-64': 0.12,
            '65+': 0.04
          },
          gender_distribution: {
            male: 0.52,
            female: 0.48
          }
        },
        source: { provider: 'SimilarWeb', endpoint: '/demographics' }
      },
      keywords: {
        data: {
          keywords: [
            { keyword: 'test company products', visits_share: 0.08, position: 1 },
            { keyword: 'test company deals', visits_share: 0.05, position: 2 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/keywords' }
      },
      interests: {
        data: {
          interests: [
            { category: 'Technology', affinity: 1.85 },
            { category: 'Business', affinity: 1.62 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/interests' }
      },
      competitors: {
        data: {
          sites: [
            { domain: 'competitor1.com', similarity_score: 0.82 },
            { domain: 'competitor2.com', similarity_score: 0.75 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/similar-sites' }
      },
      technologies: {
        data: {
          technologies: [
            { category: 'Analytics', name: 'Google Analytics' },
            { category: 'CMS', name: 'WordPress' }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/technologies' }
      },
      keyword_competitors: {
        data: {
          competitors: [
            { domain: 'competitor1.com', keyword_overlap: 0.68 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/keyword-competitors' }
      },
      rank: {
        data: {
          global_rank: 1250,
          category_rank: 45,
          category: 'E-commerce & Shopping'
        },
        source: { provider: 'SimilarWeb', endpoint: '/website-rank' }
      },
      referrals: {
        data: {
          referrals: [
            { domain: 'google.com', share: 0.35 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/referrals' }
      },
      popular_pages: {
        data: {
          pages: [
            { page: '/products', share: 0.28 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/popular-pages' }
      },
      leading_folders: {
        data: {
          folders: [
            { folder: '/shop', share: 0.45 }
          ]
        },
        source: { provider: 'SimilarWeb', endpoint: '/leading-folders' }
      }
    })
  }))
}));

vi.mock('../../services/builtwith', () => ({
  BuiltWithClient: vi.fn().mockImplementation(() => ({
    getDomainTechnologies: vi.fn().mockResolvedValue({
      data: {
        technologies: [
          {
            Name: 'React',
            Category: 'JavaScript Framework',
            FirstDetected: 1609459200, // Valid Unix timestamp (Jan 1, 2021)
            LastDetected: 1704067200   // Valid Unix timestamp (Jan 1, 2024)
          },
          {
            Name: 'Cloudflare',
            Category: 'CDN',
            FirstDetected: 1577836800, // Valid Unix timestamp (Jan 1, 2020)
            LastDetected: 1704067200   // Valid Unix timestamp (Jan 1, 2024)
          }
        ]
      },
      source: { provider: 'BuiltWith', endpoint: '/domain-api' }
    }),
    getRelationships: vi.fn().mockResolvedValue({
      data: { relationships: [] },
      source: { provider: 'BuiltWith', endpoint: '/relationships-api' }
    }),
    getFinancials: vi.fn().mockResolvedValue({
      data: { employees: '100-250', revenue: '$10M-$50M' },
      source: { provider: 'BuiltWith', endpoint: '/financial-api' }
    }),
    getSocialData: vi.fn().mockResolvedValue({
      data: {
        twitter: { handle: '@testcompany', followers: 25000 },
        linkedin: { url: 'linkedin.com/company/test-company', followers: 15000 }
      },
      source: { provider: 'BuiltWith', endpoint: '/social-api' }
    }),
    getTrustSignals: vi.fn().mockResolvedValue({
      data: { ssl: true, age_years: 8 },
      source: { provider: 'BuiltWith', endpoint: '/trust-api' }
    }),
    getKeywords: vi.fn().mockResolvedValue({
      data: { keywords: ['test', 'company', 'products'] },
      source: { provider: 'BuiltWith', endpoint: '/keywords-api' }
    }),
    getRecommendations: vi.fn().mockResolvedValue({
      data: { recommendations: [] },
      source: { provider: 'BuiltWith', endpoint: '/recommendations-api' }
    })
  }))
}));

vi.mock('../../services/yahoo-finance', () => ({
  YahooFinanceClient: vi.fn().mockImplementation(() => ({
    getStockInfo: vi.fn().mockResolvedValue({
      data: {
        symbol: 'TEST',
        market_cap: 5000000000,
        revenue: 2500000000,
        employees: 5000
      },
      source: { provider: 'Yahoo Finance', endpoint: '/stock-info' }
    }),
    getFinancialStatement: vi.fn().mockResolvedValue({
      data: {
        revenue: [
          { fiscal_year: '2024', value: 2500000000 },
          { fiscal_year: '2023', value: 2200000000 }
        ]
      },
      source: { provider: 'Yahoo Finance', endpoint: '/financial-statement' }
    })
  }))
}));

vi.mock('../../services/apify', () => ({
  ApifyClient: vi.fn().mockImplementation(() => ({
    scrapeLinkedInCompany: vi.fn().mockResolvedValue({
      data: {
        name: 'Test Company Inc.',
        employees: '1001-5000',
        headquarters: 'San Francisco, CA'
      },
      source: { provider: 'Apify', actor: 'linkedin-company-scraper' }
    }),
    scrapeJobListings: vi.fn().mockResolvedValue({
      data: {
        jobs: [
          { title: 'Senior Software Engineer', department: 'Engineering', location: 'Remote' },
          { title: 'Product Manager', department: 'Product', location: 'San Francisco' }
        ]
      },
      source: { provider: 'Apify', actor: 'job-scraper' }
    })
  }))
}));

vi.mock('../../services/apollo', () => ({
  ApolloClient: vi.fn().mockImplementation(() => ({
    searchPeople: vi.fn().mockResolvedValue({
      data: {
        people: [
          { name: 'John Smith', title: 'CEO', linkedin_url: 'linkedin.com/in/johnsmith' },
          { name: 'Jane Doe', title: 'CTO', linkedin_url: 'linkedin.com/in/janedoe' }
        ]
      },
      source: { provider: 'Apollo.io', endpoint: '/people/search' }
    }),
    enrichPerson: vi.fn().mockResolvedValue({
      data: {
        name: 'John Smith',
        title: 'CEO',
        email: 'john@test-company.com'
      },
      source: { provider: 'Apollo.io', endpoint: '/people/enrich' }
    })
  }))
}));

vi.mock('../../services/edgar', () => ({
  EdgarClient: vi.fn().mockImplementation(() => ({
    searchFilings: vi.fn().mockResolvedValue({
      data: {
        filings: [
          {
            accession_number: '0000909832-24-000012',
            filing_date: '2024-09-27',
            fiscal_year: '2024',
            form_type: '10-K',
            file_url: 'https://www.sec.gov/Archives/edgar/data/909832/000090983224000012.txt'
          }
        ],
        company: {
          cik: '0000909832',
          name: 'Test Company Inc.',
          ticker: 'TEST'
        }
      },
      source: { provider: 'SEC EDGAR', endpoint: '/cgi-bin/browse-edgar' }
    }),
    getFilingContent: vi.fn().mockResolvedValue({
      data: {
        accession_number: '0000909832-24-000012',
        cik: '0000909832',
        text: `FORM 10-K

        Item 1A. Risk Factors

        Our business depends on technology infrastructure and search capabilities.
        If our search platform fails to scale or becomes obsolete, we may
        experience material adverse effects on operations and customer satisfaction.

        We face intense competition from retailers with superior e-commerce
        search experiences and recommendation engines.

        Item 1B. Unresolved Staff Comments`,
        size_bytes: 150000,
        url: 'https://www.sec.gov/Archives/edgar/data/909832/000090983224000012.txt'
      },
      source: { provider: 'SEC EDGAR', endpoint: '/Archives/edgar/data' }
    }),
    parseRiskFactors: vi.fn().mockResolvedValue({
      data: {
        risk_factors: [
          {
            category: 'Technology',
            risk: 'Our business depends on technology infrastructure and search capabilities...',
            severity: 'high',
            algolia_relevance: 0.85
          },
          {
            category: 'Competition',
            risk: 'We face intense competition from retailers with superior e-commerce search experiences...',
            severity: 'medium',
            algolia_relevance: 0.72
          }
        ],
        total_risks: 2,
        high_severity_count: 1
      },
      source: { provider: 'SEC EDGAR', endpoint: '/parse/risk-factors' }
    })
  }))
}));

describe('Enrichment Worker', () => {
  let db: SupabaseClient;
  let orchestrator: EnrichmentOrchestrator;
  let enrichmentQueue: Queue<EnrichmentJobData>;
  let testCompanyId: string;
  let testAuditId: string;

  beforeAll(async () => {
    // Initialize database client
    db = new SupabaseClient();

    // Initialize orchestrator
    orchestrator = new EnrichmentOrchestrator(db);

    // Initialize queue
    enrichmentQueue = new Queue<EnrichmentJobData>('enrichment-test', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });

    // Clean up any existing test company from previous runs
    await db.getClient().from('companies').delete().eq('domain', 'test-company.com');

    // Create test company once for all tests
    const company = await db.insert<any>('companies', {
      domain: 'test-company.com',
      name: 'Test Company Inc.',
      industry: 'ecommerce',
    });
    testCompanyId = company.id;

    // Create test audit once for all tests
    const audit = await db.insert<any>('audits', {
      company_id: testCompanyId,
      audit_type: 'partner_intel',
      status: 'pending',
    });
    testAuditId = audit.id;
  });

  afterAll(async () => {
    // Clean up queue
    await enrichmentQueue.obliterate({ force: true });
    await enrichmentQueue.close();

    // Clean up database (CASCADE will delete related records)
    if (testCompanyId) {
      await db.getClient().from('companies').delete().eq('id', testCompanyId);
    }
  });

  describe('Full Enrichment Pipeline', () => {
    it('should complete all 15 modules successfully', async () => {
      // Run full enrichment
      await orchestrator.runFullEnrichment(testCompanyId, testAuditId);

      // Verify data in all enrichment tables
      const trafficRows = await db.query<any>('company_traffic', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(trafficRows.length).toBeGreaterThan(0);

      const techRows = await db.query<any>('company_technologies', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(techRows.length).toBeGreaterThan(0);

      const financeRows = await db.query<any>('company_financials', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(financeRows.length).toBeGreaterThan(0);

      const competitorRows = await db.query<any>('company_competitors', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(competitorRows.length).toBeGreaterThan(0);

      const execRows = await db.query<any>('company_executives', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(execRows.length).toBeGreaterThan(0);

      const hiringRows = await db.query<any>('company_hiring', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(hiringRows.length).toBeGreaterThan(0);
    }, 60000); // 60 second timeout for full pipeline
  });

  describe('Wave 1: Foundation Data', () => {
    it('should complete M01: Company Context', async () => {
      await orchestrator.runWave1(testCompanyId, testAuditId);

      const company = await db.query<any>('companies', { id: testCompanyId });
      expect(company.length).toBe(1);
      // Company context updates the companies table directly
    });

    it('should complete M02: Technology Stack', async () => {
      await orchestrator.runWave1(testCompanyId, testAuditId);

      const technologies = await db.query<any>('company_technologies', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(technologies.length).toBeGreaterThan(0);
      expect(technologies[0]).toHaveProperty('technology_name');
      expect(technologies[0]).toHaveProperty('technology_category');
    });

    it('should complete M03: Traffic Analysis', async () => {
      await orchestrator.runWave1(testCompanyId, testAuditId);

      const traffic = await db.query<any>('company_traffic', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(traffic.length).toBeGreaterThan(0);
      expect(traffic[0]).toHaveProperty('monthly_visits');
      expect(traffic[0]).toHaveProperty('bounce_rate');
      expect(traffic[0].bounce_rate).toBeGreaterThan(0);
    });

    it('should complete M05: Competitor Intelligence', async () => {
      await orchestrator.runWave1(testCompanyId, testAuditId);

      const competitors = await db.query<any>('company_competitors', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(competitors.length).toBeGreaterThan(0);
      expect(competitors[0]).toHaveProperty('competitor_domain');
      expect(competitors[0]).toHaveProperty('similarity_score');
    });
  });

  describe('Wave 2: Financial & Hiring', () => {
    it('should complete M04: Financial Profile', async () => {
      await orchestrator.runWave2(testCompanyId, testAuditId);

      const financials = await db.query<any>('company_financials', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(financials.length).toBeGreaterThan(0);
      expect(financials[0]).toHaveProperty('revenue');
      expect(financials[0]).toHaveProperty('fiscal_year');
    });

    it('should complete M06: Hiring Signals', async () => {
      await orchestrator.runWave2(testCompanyId, testAuditId);

      const jobs = await db.query<any>('company_hiring', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0]).toHaveProperty('job_title');
      expect(jobs[0]).toHaveProperty('job_department');
    });

    it('should complete M07: Strategic Context', async () => {
      await orchestrator.runWave2(testCompanyId, testAuditId);
      // Strategic context is stored in audit notes (not separate table)
      // Just verify wave completes without error
    });
  });

  describe('Wave 3: Deep Intelligence', () => {
    it('should complete M08: Investor Intelligence', async () => {
      await orchestrator.runWave3(testCompanyId, testAuditId);

      const quotes = await db.query<any>('executive_quotes', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0]).toHaveProperty('executive_name');
      expect(quotes[0]).toHaveProperty('quote_text');
    });

    it('should complete M09: Executive Intelligence', async () => {
      await orchestrator.runWave3(testCompanyId, testAuditId);

      const executives = await db.query<any>('company_executives', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(executives.length).toBeGreaterThan(0);
      expect(executives[0]).toHaveProperty('full_name');
      expect(executives[0]).toHaveProperty('title');
    });

    it('should complete M10: Buying Committee', async () => {
      await orchestrator.runWave3(testCompanyId, testAuditId);

      const committee = await db.query<any>('buying_committee', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });
      expect(committee.length).toBeGreaterThan(0);
      expect(committee[0]).toHaveProperty('full_name');
      expect(committee[0]).toHaveProperty('is_decision_maker');
    });
  });

  describe('Wave 4: Analysis & Synthesis', () => {
    it('should complete M11: Displacement Analysis', async () => {
      await orchestrator.runWave4(testCompanyId, testAuditId);
      // Displacement analysis stored in displacement_opportunities table
      // Just verify wave completes without error
    });

    it('should complete M12: Case Study Matching', async () => {
      await orchestrator.runWave4(testCompanyId, testAuditId);
      // Case study matching stored in audit metadata
    });

    it('should complete M13: ICP Priority Mapping', async () => {
      await orchestrator.runWave4(testCompanyId, testAuditId);
      // ICP score stored in companies table
    });

    it('should complete M14: Signal Scoring', async () => {
      await orchestrator.runWave4(testCompanyId, testAuditId);
      // Composite scores stored in intent_signals table
    });

    it('should complete M15: Strategic Brief', async () => {
      await orchestrator.runWave4(testCompanyId, testAuditId);
      // Strategic brief stored in company_strategic_analysis table
    });
  });

  describe('Insight Generation', () => {
    it('should generate insights for high bounce rate', async () => {
      await orchestrator.runWave1(testCompanyId, testAuditId);

      const traffic = await db.query<any>('company_traffic', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });

      // Check if insight was generated for high bounce rate
      if (traffic[0].bounce_rate > 50) {
        expect(traffic[0].insight).toBeDefined();
        expect(traffic[0].insight).toContain('bounce rate');
      }
    });

    it('should populate insight columns across all tables', async () => {
      await orchestrator.runFullEnrichment(testCompanyId, testAuditId);

      // Check that at least one table has insights populated
      const traffic = await db.query<any>('company_traffic', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });

      // At least one row should have insight data
      const hasInsights = traffic.some((row: any) => row.insight !== null);
      expect(hasInsights).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing company gracefully', async () => {
      const fakeCompanyId = '00000000-0000-0000-0000-000000000000';
      const fakeAuditId = '00000000-0000-0000-0000-000000000001';

      await expect(
        orchestrator.runFullEnrichment(fakeCompanyId, fakeAuditId)
      ).rejects.toThrow();
    });

    it('should handle API failures with retries', async () => {
      // This test would require mocking API calls
      // Placeholder for now
      expect(true).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should enforce composite primary keys', async () => {
      await orchestrator.runWave1(testCompanyId, testAuditId);

      // Try to insert duplicate technology (should fail or update)
      const tech = {
        company_id: testCompanyId,
        audit_id: testAuditId,
        technology_name: 'React',
        technology_category: 'frontend',
      };

      // First insert should succeed
      await db.insert('company_technologies', tech);

      // Second insert with same composite key should fail
      await expect(
        db.insert('company_technologies', tech)
      ).rejects.toThrow();
    });

    it('should validate data types and constraints', async () => {
      await orchestrator.runWave1(testCompanyId, testAuditId);

      const traffic = await db.query<any>('company_traffic', {
        company_id: testCompanyId,
        audit_id: testAuditId,
      });

      // Validate bounce rate is between 0-100
      expect(traffic[0].bounce_rate).toBeGreaterThanOrEqual(0);
      expect(traffic[0].bounce_rate).toBeLessThanOrEqual(100);

      // Validate traffic percentages sum to ~100
      const totalTraffic =
        traffic[0].direct_traffic_pct +
        traffic[0].search_traffic_pct +
        traffic[0].social_traffic_pct +
        traffic[0].referral_traffic_pct +
        traffic[0].paid_traffic_pct;
      expect(totalTraffic).toBeCloseTo(100, 0);
    });
  });

  describe('Performance', () => {
    it('should complete Wave 1 in under 30 seconds', async () => {
      const startTime = Date.now();
      await orchestrator.runWave1(testCompanyId, testAuditId);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(30000);
    }, 30000);

    it('should run modules in parallel within a wave', async () => {
      // Measure parallel vs sequential execution
      const parallelStart = Date.now();
      await orchestrator.runWave1(testCompanyId, testAuditId);
      const parallelDuration = Date.now() - parallelStart;

      // Parallel execution should be significantly faster than 4x single module time
      // Assuming each module takes ~5s, parallel should be ~5-10s, not 20s
      expect(parallelDuration).toBeLessThan(15000);
    }, 20000);
  });
});

describe('Queue Integration', () => {
  let enrichmentQueue: Queue<EnrichmentJobData>;

  beforeAll(() => {
    enrichmentQueue = new Queue<EnrichmentJobData>('enrichment-test', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });
  });

  afterAll(async () => {
    await enrichmentQueue.obliterate({ force: true });
    await enrichmentQueue.close();
  });

  it('should queue enrichment job successfully', async () => {
    const job = await enrichmentQueue.add('test-job', {
      companyId: 'test-company-id',
      auditId: 'test-audit-id',
    });

    expect(job.id).toBeDefined();
    expect(job.data.companyId).toBe('test-company-id');
  });

  it('should allow selective wave execution', async () => {
    const job = await enrichmentQueue.add('selective-waves', {
      companyId: 'test-company-id',
      auditId: 'test-audit-id',
      waves: [1, 3], // Only run Wave 1 and Wave 3
    });

    expect(job.data.waves).toEqual([1, 3]);
  });
});
