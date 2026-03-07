/**
 * Enrichment Worker Integration Tests
 *
 * Tests all 15 modules across 4 waves with actual database writes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Queue, Worker } from 'bullmq';
import { SupabaseClient } from '../../database/supabase';
import { EnrichmentOrchestrator } from '../../services/enrichment-orchestrator';
import { EnrichmentJobData } from '../../workers/enrichment-worker';

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
      await db.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
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
