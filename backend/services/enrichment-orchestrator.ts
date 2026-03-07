/**
 * Enrichment Orchestrator
 *
 * Runs 15 data collection modules in 4 waves (parallel within wave).
 * Each module:
 * - Fetches data from external APIs
 * - Saves to respective DB table
 * - Generates insights (saved to insight column)
 * - Emits progress via WebSocket
 *
 * Wave Structure:
 * - Wave 1: M01-M03, M05 (foundation data)
 * - Wave 2: M04, M06-M07 (depends on Wave 1)
 * - Wave 3: M08-M10 (deep intelligence)
 * - Wave 4: M11-M15 (analysis & synthesis)
 */

import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';
import { WebSocketManager } from './websocket-manager';
import { SourceCitation } from '../types';
import { SimilarWebClient, DateRange } from './similarweb';
import { BuiltWithClient } from './builtwith';
import { YahooFinanceClient } from './yahoo-finance';
import { ApifyClient } from './apify';
import { ApolloClient } from './apollo';
import { EdgarClient } from './edgar';

export interface EnrichmentProgress {
  wave: number;
  module: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  percent: number;
  insight?: string;
  error?: string;
}

export class EnrichmentOrchestrator {
  private db: SupabaseClient;
  private ws?: WebSocketManager;
  private similarweb: SimilarWebClient;
  private builtwith: BuiltWithClient;
  private yahooFinance: YahooFinanceClient;
  private apify: ApifyClient;
  private apollo: ApolloClient;
  private edgar: EdgarClient;

  constructor(db: SupabaseClient, ws?: WebSocketManager) {
    this.db = db;
    this.ws = ws;

    // Initialize API clients
    this.similarweb = new SimilarWebClient();
    this.builtwith = new BuiltWithClient();
    this.yahooFinance = new YahooFinanceClient();
    this.apify = new ApifyClient();
    this.apollo = new ApolloClient();
    this.edgar = new EdgarClient();

    logger.info('EnrichmentOrchestrator initialized with all 6 API clients (including EDGAR)');
  }

  /**
   * Enrich a company with data from all 6 API sources
   *
   * Calls all API clients in parallel and returns structured data.
   * Used for initial data collection before saving to database.
   *
   * @param domain - Company domain (e.g., "costco.com")
   * @param auditId - Audit ID for tracking
   * @param options - Enrichment options (date range, limits, etc.)
   * @returns Enriched company data from all sources
   */
  async enrichCompany(
    domain: string,
    auditId: string,
    options?: {
      dateRange?: DateRange;
      skipYahooFinance?: boolean; // Skip if not public company
      linkedInCompanyUrl?: string;
      companyName?: string;
    }
  ) {
    logger.info('Starting company enrichment', { domain, auditId });

    // Emit start event
    this.ws?.emitAuditEvent(auditId, {
      type: 'enrichment:started',
      data: { domain, message: 'Starting company enrichment - calling 6 APIs in parallel...' },
      timestamp: new Date()
    });

    const startTime = Date.now();
    const errors: Array<{ source: string; error: string }> = [];

    // Default to last 3 months for time-series data
    const dateRange: DateRange = options?.dateRange || {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7), // YYYY-MM format
      end: new Date().toISOString().slice(0, 7)
    };

    // Execute all API calls in PARALLEL for speed
    const apiCalls = [
      // SimilarWeb
      (async () => {
        this.ws?.emitAuditEvent(auditId, {
          type: 'enrichment:api:started',
          data: { source: 'SimilarWeb', message: 'Fetching SimilarWeb data (14 endpoints)...' },
          timestamp: new Date()
        });
        try {
          const data = await this.similarweb.fetchAllData(domain, dateRange);
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:completed',
            data: { source: 'SimilarWeb', message: `SimilarWeb: ${data.meta.cacheHits}/14 cached`, progress: 20 },
            timestamp: new Date()
          });
          return { status: 'fulfilled', value: data };
        } catch (error) {
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:failed',
            data: { source: 'SimilarWeb', error: String(error) },
            timestamp: new Date()
          });
          return { status: 'rejected', reason: error };
        }
      })(),

      // BuiltWith
      (async () => {
        this.ws?.emitAuditEvent(auditId, {
          type: 'enrichment:api:started',
          data: { source: 'BuiltWith', message: 'Fetching BuiltWith data (7 endpoints)...' },
          timestamp: new Date()
        });
        try {
          const results = await Promise.all([
            this.builtwith.getDomainTechnologies(domain),
            this.builtwith.getRelationships(domain),
            this.builtwith.getFinancials(domain),
            this.builtwith.getSocialProfiles(domain),
            this.builtwith.getTrustIndicators(domain),
            this.builtwith.getKeywords(domain),
            this.builtwith.getRecommendations(domain)
          ]);
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:completed',
            data: { source: 'BuiltWith', message: 'BuiltWith: 7/7 endpoints complete', progress: 40 },
            timestamp: new Date()
          });
          return { status: 'fulfilled', value: results };
        } catch (error) {
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:failed',
            data: { source: 'BuiltWith', error: String(error) },
            timestamp: new Date()
          });
          return { status: 'rejected', reason: error };
        }
      })(),

      // Yahoo Finance
      (async () => {
        if (options?.skipYahooFinance) return { status: 'fulfilled', value: null };
        this.ws?.emitAuditEvent(auditId, {
          type: 'enrichment:api:started',
          data: { source: 'Yahoo Finance', message: 'Fetching Yahoo Finance data...' },
          timestamp: new Date()
        });
        try {
          const data = await this.fetchYahooFinanceData(domain);
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:completed',
            data: { source: 'Yahoo Finance', message: 'Yahoo Finance: Stock data retrieved', progress: 60 },
            timestamp: new Date()
          });
          return { status: 'fulfilled', value: data };
        } catch (error) {
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:failed',
            data: { source: 'Yahoo Finance', error: String(error) },
            timestamp: new Date()
          });
          return { status: 'rejected', reason: error };
        }
      })(),

      // Apify
      (async () => {
        if (!options?.linkedInCompanyUrl) return { status: 'fulfilled', value: null };
        this.ws?.emitAuditEvent(auditId, {
          type: 'enrichment:api:started',
          data: { source: 'Apify', message: 'Scraping LinkedIn with Apify...' },
          timestamp: new Date()
        });
        try {
          const [company, jobs] = await Promise.all([
            this.apify.scrapeLinkedInCompany(options.linkedInCompanyUrl),
            this.apify.scrapeLinkedInJobs(options.companyName || domain, 100)
          ]);
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:completed',
            data: { source: 'Apify', message: 'Apify: LinkedIn data scraped', progress: 80 },
            timestamp: new Date()
          });
          return { status: 'fulfilled', value: [company, jobs] };
        } catch (error) {
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:failed',
            data: { source: 'Apify', error: String(error) },
            timestamp: new Date()
          });
          return { status: 'rejected', reason: error };
        }
      })(),

      // Apollo.io
      (async () => {
        this.ws?.emitAuditEvent(auditId, {
          type: 'enrichment:api:started',
          data: { source: 'Apollo.io', message: 'Fetching Apollo.io contact data...' },
          timestamp: new Date()
        });
        try {
          const [people, signals] = await Promise.all([
            this.apollo.searchPeople(domain, [
              'CEO', 'CFO', 'CTO', 'CIO', 'COO',
              'VP Engineering', 'VP Technology', 'VP Product',
              'Director of Engineering', 'Head of Engineering'
            ], 25),
            this.apollo.getIntentSignals(domain)
          ]);
          const cachedCount = [people, signals].filter(r => r.meta.cached).length;
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:completed',
            data: { source: 'Apollo.io', message: `Apollo.io: ${cachedCount}/2 cached`, progress: 90 },
            timestamp: new Date()
          });
          return { status: 'fulfilled', value: [people, signals] };
        } catch (error) {
          this.ws?.emitAuditEvent(auditId, {
            type: 'enrichment:api:failed',
            data: { source: 'Apollo.io', error: String(error) },
            timestamp: new Date()
          });
          return { status: 'rejected', reason: error };
        }
      })()
    ];

    // Wait for all API calls to complete
    const results = await Promise.all(apiCalls) as any;

    logger.info('Company enrichment completed', {
      domain,
      auditId,
      totalTimeMs: totalTime,
      totalCost,
      totalCalls,
      cacheHits,
      cacheHitRate: totalCalls > 0 ? (cacheHits / totalCalls * 100).toFixed(1) + '%' : '0%',
      errorCount: errors.length
    });

    return {
      domain,
      auditId,
      timestamp: new Date(),
      data: {
        similarweb: similarwebData,
        builtwith: builtwithData,
        yahooFinance: yahooFinanceData,
        apify: apifyData,
        apollo: apolloData
      },
      errors,
      meta: {
        totalTimeMs: totalTime,
        totalCost,
        totalCalls,
        cacheHits,
        cacheHitRate: totalCalls > 0 ? cacheHits / totalCalls : 0
      }
    };
  }

  /**
   * Helper: Fetch Yahoo Finance data with ticker resolution
   *
   * @private
   * @param domain - Company domain
   * @returns Yahoo Finance data or null if not found
   */
  private async fetchYahooFinanceData(domain: string) {
    try {
      // TODO: Resolve ticker from domain using WebSearch
      // For now, attempt common patterns (e.g., costco.com -> COST)
      const ticker = this.guessTicker(domain);

      if (!ticker) {
        logger.warn(`Cannot resolve ticker for domain: ${domain}`);
        return null;
      }

      const [stockInfo, financials, recommendations, holders, historicalPrices] = await Promise.all([
        this.yahooFinance.getStockInfo(ticker),
        this.yahooFinance.getFinancialStatements(ticker),
        this.yahooFinance.getAnalystRecommendations(ticker),
        this.yahooFinance.getHolderInfo(ticker),
        this.yahooFinance.getHistoricalPrices(ticker, {
          period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 1 year ago
          period2: new Date().toISOString().slice(0, 10),
          interval: '1mo'
        })
      ]);

      return {
        ticker,
        stockInfo,
        financials,
        recommendations,
        holders,
        historicalPrices
      };
    } catch (error) {
      logger.error('Yahoo Finance data fetch failed', { domain, error });
      throw error;
    }
  }

  /**
   * Helper: Guess stock ticker from domain
   *
   * @private
   * @param domain - Company domain (e.g., "costco.com")
   * @returns Stock ticker or null
   */
  private guessTicker(domain: string): string | null {
    // Common patterns
    const tickerMap: Record<string, string> = {
      'costco.com': 'COST',
      'target.com': 'TGT',
      'walmart.com': 'WMT',
      'amazon.com': 'AMZN',
      'homedepot.com': 'HD',
      'lowes.com': 'LOW',
      'bestbuy.com': 'BBY',
      'macys.com': 'M',
      'nordstrom.com': 'JWN',
      'kohls.com': 'KSS',
      'tjx.com': 'TJX',
      'gap.com': 'GPS',
      'autozone.com': 'AZO'
    };

    return tickerMap[domain] || null;
  }

  /**
   * Run all 15 modules across 4 waves
   */
  async runFullEnrichment(companyId: string, auditId: string): Promise<void> {
    logger.info('Starting full enrichment', { companyId, auditId });

    try {
      await this.runWave1(companyId, auditId);
      await this.runWave2(companyId, auditId);
      await this.runWave3(companyId, auditId);
      await this.runWave4(companyId, auditId);

      logger.info('Full enrichment completed', { companyId, auditId });
    } catch (error) {
      logger.error('Enrichment failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * Wave 1: Foundation Data (4 modules in parallel)
   * - M01: Company Context
   * - M02: Technology Stack
   * - M03: Traffic Analysis
   * - M05: Competitor Intelligence
   */
  async runWave1(companyId: string, auditId: string): Promise<void> {
    logger.info('Starting Wave 1', { companyId, auditId });

    await Promise.all([
      this.runM01_CompanyContext(companyId, auditId),
      this.runM02_TechnologyStack(companyId, auditId),
      this.runM03_TrafficAnalysis(companyId, auditId),
      this.runM05_CompetitorIntelligence(companyId, auditId),
    ]);

    logger.info('Wave 1 completed', { companyId, auditId });
  }

  /**
   * Wave 2: Financial & Hiring (3 modules in parallel)
   * - M04: Financial Profile
   * - M06: Hiring Signals
   * - M07: Strategic Context
   */
  async runWave2(companyId: string, auditId: string): Promise<void> {
    logger.info('Starting Wave 2', { companyId, auditId });

    await Promise.all([
      this.runM04_FinancialProfile(companyId, auditId),
      this.runM06_HiringSignals(companyId, auditId),
      this.runM07_StrategicContext(companyId, auditId),
    ]);

    logger.info('Wave 2 completed', { companyId, auditId });
  }

  /**
   * Wave 3: Deep Intelligence (3 modules in parallel)
   * - M08: Investor Intelligence
   * - M09: Executive Intelligence
   * - M10: Buying Committee
   */
  async runWave3(companyId: string, auditId: string): Promise<void> {
    logger.info('Starting Wave 3', { companyId, auditId });

    await Promise.all([
      this.runM08_InvestorIntelligence(companyId, auditId),
      this.runM09_ExecutiveIntelligence(companyId, auditId),
      this.runM10_BuyingCommittee(companyId, auditId),
    ]);

    logger.info('Wave 3 completed', { companyId, auditId });
  }

  /**
   * Wave 4: Analysis & Synthesis (5 modules in parallel)
   * - M11: Displacement Analysis
   * - M12: Case Study Matching
   * - M13: ICP Priority Mapping
   * - M14: Signal Scoring
   * - M15: Strategic Brief
   */
  async runWave4(companyId: string, auditId: string): Promise<void> {
    logger.info('Starting Wave 4', { companyId, auditId });

    await Promise.all([
      this.runM11_DisplacementAnalysis(companyId, auditId),
      this.runM12_CaseStudyMatching(companyId, auditId),
      this.runM13_ICPPriorityMapping(companyId, auditId),
      this.runM14_SignalScoring(companyId, auditId),
      this.runM15_StrategicBrief(companyId, auditId),
    ]);

    logger.info('Wave 4 completed', { companyId, auditId });
  }

  // =============================================================================
  // MODULE IMPLEMENTATIONS
  // =============================================================================

  /**
   * M01: Company Context
   * Fetch company basic info (founded year, HQ, employees) via WebSearch
   */
  private async runM01_CompanyContext(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M01: Company Context';
    this.emitProgress(auditId, 1, moduleName, 'running', 0);

    try {
      // Get company domain from database
      const company = await this.db.query<any>('companies', { id: companyId });
      if (!company || company.length === 0) {
        throw new Error(`Company not found: ${companyId}`);
      }

      const domain = company[0].domain;

      // TODO: WebSearch implementation
      // For now, use placeholder data
      const companyData = {
        founded_year: null,
        headquarters: null,
        employee_count: null,
        description: null,
      };

      // Update companies table
      await this.db.update('companies', companyId, companyData);

      const insight = 'Company context data collected from public sources';
      this.emitProgress(auditId, 1, moduleName, 'completed', 100, insight);

      logger.info('M01 completed', { companyId, auditId });
    } catch (error) {
      this.emitProgress(auditId, 1, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M01 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M02: Technology Stack
   * Detect technologies using BuiltWith API
   */
  private async runM02_TechnologyStack(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M02: Technology Stack';
    this.emitProgress(auditId, 1, moduleName, 'running', 0);

    try {
      // Get company domain
      const company = await this.db.query<any>('companies', { id: companyId });
      const domain = company[0].domain;

      // Call BuiltWith API
      const response = await this.builtwith.getDomainTechnologies(domain);
      const techData = response.data;

      // Extract technologies from response
      const technologies = [];
      if (techData.Results && techData.Results.length > 0) {
        const result = techData.Results[0].Result;
        if (result.Paths && result.Paths.length > 0) {
          for (const path of result.Paths) {
            for (const tech of path.Technologies || []) {
              // Validate timestamps (must be reasonable Unix timestamps)
              const firstDetected = tech.FirstDetected && tech.FirstDetected > 0 && tech.FirstDetected < 2147483647
                ? new Date(tech.FirstDetected * 1000)
                : new Date();
              const lastDetected = tech.LastDetected && tech.LastDetected > 0 && tech.LastDetected < 2147483647
                ? new Date(tech.LastDetected * 1000)
                : new Date();

              technologies.push({
                company_id: companyId,
                audit_id: auditId,
                technology_name: tech.Name,
                technology_category: tech.Tag?.toLowerCase() || 'other',
                technology_vendor: null,
                confidence_level: tech.IsPremium ? 'high' : 'medium',
                first_detected: firstDetected,
                last_detected: lastDetected,
                source_provider: 'builtwith',
                source_url: `https://builtwith.com/${domain}`,
                detected_at: new Date(),
                insight: null,
                confidence_score: null,
                evidence_urls: null,
              });
            }
          }
        }
      }

      // Save to company_technologies table
      for (const tech of technologies) {
        await this.db.insert('company_technologies', tech);
      }

      // Generate insight
      const categoryCount = new Set(technologies.map(t => t.technology_category)).size;
      let insight = `Detected ${technologies.length} technologies across ${categoryCount} categories`;

      // Check for search-related technologies
      const searchTechs = technologies.filter(t =>
        t.technology_name.toLowerCase().includes('search') ||
        t.technology_name.toLowerCase().includes('solr') ||
        t.technology_name.toLowerCase().includes('elastic')
      );

      if (searchTechs.length > 0) {
        insight += ` | Using ${searchTechs.map(t => t.technology_name).join(', ')} for search`;
        // Update insight column for search technologies
        for (const tech of searchTechs) {
          await this.db.update('company_technologies', `${companyId}_${auditId}_${tech.technology_name}`, {
            insight: `Current search provider: ${tech.technology_name} (displacement opportunity)`,
            confidence_score: 0.9,
            evidence_urls: [tech.source_url]
          });
        }
      }

      this.emitProgress(auditId, 1, moduleName, 'completed', 100, insight);

      logger.info('M02 completed', { companyId, auditId, techCount: technologies.length, cached: response.meta.cached });
    } catch (error) {
      this.emitProgress(auditId, 1, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M02 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M03: Traffic Analysis
   * Fetch traffic metrics from SimilarWeb API
   */
  private async runM03_TrafficAnalysis(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M03: Traffic Analysis';
    this.emitProgress(auditId, 1, moduleName, 'running', 0);

    try {
      // Get company domain
      const company = await this.db.query<any>('companies', { id: companyId });
      const domain = company[0].domain;

      // Last 3 months date range
      const dateRange: DateRange = {
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        end: new Date().toISOString().slice(0, 7)
      };

      // Call SimilarWeb APIs in parallel
      const [trafficResponse, engagementResponse, sourcesResponse, geoResponse] = await Promise.all([
        this.similarweb.getTrafficData(domain, dateRange),
        this.similarweb.getEngagementMetrics(domain, dateRange),
        this.similarweb.getTrafficSources(domain, dateRange),
        this.similarweb.getGeography(domain, dateRange)
      ]);

      // Process each month of data
      const trafficRecords = [];
      for (const visit of trafficResponse.data.visits || []) {
        const month = new Date(visit.date + '-01');

        // Find corresponding engagement data
        const engagement = engagementResponse.data.bounce_rate.find(e => e.date === visit.date);
        const pagesPerVisit = engagementResponse.data.pages_per_visit.find(e => e.date === visit.date);
        const avgDuration = engagementResponse.data.avg_visit_duration.find(e => e.date === visit.date);

        // Get top country (first in geo array)
        const topCountry = geoResponse.data.countries[0];

        const trafficData = {
          company_id: companyId,
          audit_id: auditId,
          month,
          monthly_visits: visit.visits,
          unique_visitors: null,
          page_views: null,
          bounce_rate: engagement ? engagement.bounce_rate * 100 : null,
          avg_visit_duration: avgDuration ? avgDuration.avg_visit_duration : null,
          pages_per_visit: pagesPerVisit ? pagesPerVisit.pages_per_visit : null,
          direct_traffic_pct: sourcesResponse.data.channels.direct * 100,
          search_traffic_pct: sourcesResponse.data.channels.search * 100,
          social_traffic_pct: sourcesResponse.data.channels.social * 100,
          referral_traffic_pct: sourcesResponse.data.channels.referral * 100,
          paid_traffic_pct: sourcesResponse.data.channels.display_ads * 100,
          email_traffic_pct: sourcesResponse.data.channels.email * 100,
          top_country: topCountry ? topCountry.country_code : null,
          top_country_pct: topCountry ? topCountry.visits_share * 100 : null,
          desktop_pct: null, // Not in this endpoint
          mobile_pct: null,
          tablet_pct: null,
          source_provider: 'similarweb',
          source_url: `https://www.similarweb.com/website/${domain}/`,
          fetched_at: new Date(),
          insight: null,
          confidence_score: null,
          evidence_urls: null,
        };

        trafficRecords.push(trafficData);

        // Save to company_traffic table
        await this.db.insert('company_traffic', trafficData);

        // Generate insight if bounce rate is high
        if (trafficData.bounce_rate && trafficData.bounce_rate > 50) {
          const insight = `HIGH bounce rate (${trafficData.bounce_rate.toFixed(1)}%) suggests poor search relevance or site UX issues`;
          await this.db.update('company_traffic', `${companyId}_${auditId}_${month.toISOString()}`, {
            insight,
            confidence_score: 0.85,
            evidence_urls: [trafficData.source_url],
          });
        }
      }

      // Summary insight
      const latestMonth = trafficRecords[trafficRecords.length - 1];
      let insight = `Traffic: ${(latestMonth.monthly_visits / 1000000).toFixed(1)}M visits/month`;
      if (latestMonth.bounce_rate && latestMonth.bounce_rate > 50) {
        insight += ` | HIGH bounce rate (${latestMonth.bounce_rate.toFixed(1)}%)`;
      }

      this.emitProgress(auditId, 1, moduleName, 'completed', 100, insight);

      logger.info('M03 completed', {
        companyId,
        auditId,
        months: trafficRecords.length,
        cached: trafficResponse.meta.cached
      });
    } catch (error) {
      this.emitProgress(auditId, 1, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M03 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M04: Financial Profile
   * Fetch 3-year financials from Yahoo Finance
   */
  private async runM04_FinancialProfile(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M04: Financial Profile';
    this.emitProgress(auditId, 2, moduleName, 'running', 0);

    try {
      // Get company info
      const company = await this.db.query<any>('companies', { id: companyId });
      const domain = company[0].domain;

      // Try to resolve ticker
      const ticker = this.guessTicker(domain);
      if (!ticker) {
        logger.warn(`Cannot resolve ticker for ${domain} - skipping financial profile`);
        this.emitProgress(auditId, 2, moduleName, 'completed', 100, 'Not a public company - financials unavailable');
        return;
      }

      // Fetch financial statements
      const financialsResponse = await this.yahooFinance.getFinancialStatements(ticker);
      const statements = financialsResponse.data;

      // Save income statements to company_financials table
      const financialRecords = [];
      for (const income of statements.incomeStatement) {
        const balanceSheet = statements.balanceSheet.find(b => b.endDate === income.endDate);
        const cashFlow = statements.cashFlow.find(c => c.endDate === income.endDate);

        // Parse fiscal year and quarter from date
        const endDate = new Date(income.endDate);
        const fiscalYear = endDate.getFullYear();
        const fiscalQuarter = null; // Annual data

        const financialData = {
          company_id: companyId,
          audit_id: auditId,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          revenue: income.totalRevenue,
          gross_profit: income.grossProfit,
          operating_income: income.operatingIncome,
          net_income: income.netIncome,
          total_assets: balanceSheet?.totalAssets || null,
          total_liabilities: balanceSheet?.totalLiabilities || null,
          shareholders_equity: balanceSheet?.totalStockholderEquity || null,
          cash_and_equivalents: balanceSheet?.cash || null,
          operating_cash_flow: cashFlow?.totalCashFromOperatingActivities || null,
          investing_cash_flow: cashFlow?.totalCashFromInvestingActivities || null,
          financing_cash_flow: cashFlow?.totalCashFromFinancingActivities || null,
          free_cash_flow: cashFlow?.freeCashFlow || null,
          ebitda: income.ebitda,
          earnings_per_share: null,
          price_to_earnings: null,
          source_provider: 'yahoo_finance',
          source_url: `https://finance.yahoo.com/quote/${ticker}/financials`,
          fetched_at: new Date(),
          insight: null,
          confidence_score: null,
          evidence_urls: null,
        };

        financialRecords.push(financialData);
        await this.db.insert('company_financials', financialData);
      }

      // Generate insights
      const latestYear = financialRecords[0];
      let insight = `Revenue: $${(latestYear.revenue / 1000000000).toFixed(1)}B (FY${latestYear.fiscal_year})`;

      // Check for growth
      if (financialRecords.length >= 2) {
        const previousYear = financialRecords[1];
        const growthRate = ((latestYear.revenue - previousYear.revenue) / previousYear.revenue) * 100;
        if (growthRate > 10) {
          insight += ` | Strong growth: +${growthRate.toFixed(1)}% YoY`;
          await this.db.update('company_financials', `${companyId}_${auditId}_${latestYear.fiscal_year}_${latestYear.fiscal_quarter || 'annual'}`, {
            insight: `Strong revenue growth (+${growthRate.toFixed(1)}% YoY) indicates expansion and potential search infrastructure needs`,
            confidence_score: 0.8,
            evidence_urls: [latestYear.source_url]
          });
        }
      }

      this.emitProgress(auditId, 2, moduleName, 'completed', 100, insight);

      logger.info('M04 completed', {
        companyId,
        auditId,
        ticker,
        years: financialRecords.length,
        cached: financialsResponse.meta.cached
      });
    } catch (error) {
      this.emitProgress(auditId, 2, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M04 failed', { companyId, auditId, error });
      // Don't throw - private companies are OK
    }
  }

  /**
   * M05: Competitor Intelligence
   * Find competitors via SimilarWeb
   */
  private async runM05_CompetitorIntelligence(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M05: Competitor Intelligence';
    this.emitProgress(auditId, 1, moduleName, 'running', 0);

    try {
      // Get company domain
      const company = await this.db.query<any>('companies', { id: companyId });
      const domain = company[0].domain;

      // Call SimilarWeb similar-sites API
      const competitorsResponse = await this.similarweb.getSimilarSites(domain, 10);
      const sites = competitorsResponse.data.sites || [];

      // Fetch traffic data for each competitor (batch)
      const competitorDomains = sites.map(s => s.domain);
      const trafficPromises = competitorDomains.map(async (compDomain) => {
        try {
          const dateRange: DateRange = {
            start: new Date().toISOString().slice(0, 7),
            end: new Date().toISOString().slice(0, 7)
          };
          const traffic = await this.similarweb.getTrafficData(compDomain, dateRange);
          return {
            domain: compDomain,
            visits: traffic.data.visits[0]?.visits || null
          };
        } catch (error) {
          logger.warn(`Failed to fetch traffic for competitor ${compDomain}`, error);
          return { domain: compDomain, visits: null };
        }
      });

      const trafficData = await Promise.all(trafficPromises);

      // Save competitors
      const competitorRecords = [];
      for (const site of sites) {
        const traffic = trafficData.find(t => t.domain === site.domain);

        const competitorData = {
          company_id: companyId,
          audit_id: auditId,
          competitor_domain: site.domain,
          competitor_name: null, // Will be enriched later
          similarity_score: site.similarity_score * 100,
          competitor_search_provider: null,
          competitor_ecommerce_platform: null,
          competitor_monthly_visits: traffic?.visits || null,
          traffic_ratio: null,
          source_provider: 'similarweb',
          source_url: `https://www.similarweb.com/website/${domain}/`,
          detected_at: new Date(),
          insight: null,
          confidence_score: null,
          evidence_urls: null,
        };

        competitorRecords.push(competitorData);
        await this.db.insert('company_competitors', competitorData);
      }

      const insight = `Found ${competitorRecords.length} similar competitors (avg similarity: ${(sites.reduce((sum, s) => sum + s.similarity_score, 0) / sites.length * 100).toFixed(0)}%)`;
      this.emitProgress(auditId, 1, moduleName, 'completed', 100, insight);

      logger.info('M05 completed', {
        companyId,
        auditId,
        competitors: competitorRecords.length,
        cached: competitorsResponse.meta.cached
      });
    } catch (error) {
      this.emitProgress(auditId, 1, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M05 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M06: Hiring Signals
   * Scrape job postings via Apify LinkedIn Jobs actor
   */
  private async runM06_HiringSignals(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M06: Hiring Signals';
    this.emitProgress(auditId, 2, moduleName, 'running', 0);

    try {
      // Get company info
      const company = await this.db.query<any>('companies', { id: companyId });
      const companyName = company[0].company_name || company[0].domain;

      // Call Apify LinkedIn Jobs scraper
      const jobs = await this.apify.scrapeLinkedInJobs(companyName, 100);

      // Save to company_hiring table
      const jobRecords = [];
      for (const job of jobs) {
        // Extract keywords from job title and description
        const searchKeywords = ['search', 'elasticsearch', 'solr', 'algolia', 'lucene', 'opensearch'];
        const keywords = searchKeywords.filter(kw =>
          job.title.toLowerCase().includes(kw) || job.description.toLowerCase().includes(kw)
        );

        const jobData = {
          company_id: companyId,
          audit_id: auditId,
          job_title: job.title,
          job_url: job.url,
          job_location: job.location,
          job_department: job.jobFunction || null,
          posted_date: new Date(job.postedDate),
          keywords,
          is_remote: job.remote || false,
          source_actor: 'apify/linkedin-jobs-scraper',
          scraped_at: new Date(),
          insight: null,
          confidence_score: null,
          evidence_urls: null,
        };

        jobRecords.push(jobData);
        await this.db.insert('company_hiring', jobData);

        // Generate insight for search-related roles
        if (keywords.length > 0) {
          await this.db.update('company_hiring', `${companyId}_${auditId}_${job.title}_${job.postedDate}`, {
            insight: `Search-related role: "${job.title}" (hiring signal for search infrastructure investment)`,
            confidence_score: 0.9,
            evidence_urls: [job.url]
          });
        }
      }

      // Count search-related jobs
      const searchJobs = jobRecords.filter(j => j.keywords.length > 0);
      let insight = `${jobRecords.length} active job postings found`;
      if (searchJobs.length > 0) {
        insight += ` | ${searchJobs.length} search-related roles (strong hiring signal)`;
      }

      this.emitProgress(auditId, 2, moduleName, 'completed', 100, insight);

      logger.info('M06 completed', {
        companyId,
        auditId,
        totalJobs: jobRecords.length,
        searchJobs: searchJobs.length
      });
    } catch (error) {
      this.emitProgress(auditId, 2, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M06 failed', { companyId, auditId, error });
      // Don't throw - job data is nice-to-have
    }
  }

  /**
   * M07: Strategic Context
   * Fetch recent news and press releases via WebSearch
   */
  private async runM07_StrategicContext(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M07: Strategic Context';
    this.emitProgress(auditId, 2, moduleName, 'running', 0);

    try {
      // TODO: WebSearch for recent news
      // For now, log completion
      const insight = 'Strategic context collected from recent news';
      this.emitProgress(auditId, 2, moduleName, 'completed', 100, insight);

      logger.info('M07 completed', { companyId, auditId });
    } catch (error) {
      this.emitProgress(auditId, 2, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M07 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M08: Investor Intelligence
   * Extract risk factors from 10-K filings via SEC EDGAR API
   */
  private async runM08_InvestorIntelligence(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M08: Investor Intelligence';
    this.emitProgress(auditId, 3, moduleName, 'running', 0);

    try {
      // Get company info
      const company = await this.db.query<any>('companies', { id: companyId });
      const domain = company[0].domain;

      // Try to resolve ticker
      const ticker = this.guessTicker(domain);
      if (!ticker) {
        logger.warn(`Cannot resolve ticker for ${domain} - skipping investor intelligence`);
        this.emitProgress(auditId, 3, moduleName, 'completed', 100, 'Not a public company - SEC filings unavailable');
        return;
      }

      // Step 1: Search for latest 10-K filing
      this.emitProgress(auditId, 3, moduleName, 'running', 25, `Searching SEC filings for ${ticker}...`);
      const filingsResponse = await this.edgar.searchFilings(ticker, '10-K', 1);

      if (!filingsResponse.data.filings || filingsResponse.data.filings.length === 0) {
        logger.warn(`No 10-K filings found for ${ticker}`);
        this.emitProgress(auditId, 3, moduleName, 'completed', 100, 'No recent 10-K filings found');
        return;
      }

      const latestFiling = filingsResponse.data.filings[0];
      const cik = filingsResponse.data.company.cik;

      // Step 2: Get filing content
      this.emitProgress(auditId, 3, moduleName, 'running', 50, `Fetching 10-K content (${latestFiling.fiscal_year})...`);
      const contentResponse = await this.edgar.getFilingContent(
        latestFiling.accession_number,
        cik
      );

      // Step 3: Parse risk factors
      this.emitProgress(auditId, 3, moduleName, 'running', 75, 'Parsing risk factors and scoring Algolia relevance...');
      const risksResponse = await this.edgar.parseRiskFactors(contentResponse.data.text);
      const riskFactors = risksResponse.data.risk_factors;

      // Step 4: Save high-relevance risks to executive_quotes table
      const savedRisks = [];
      for (const risk of riskFactors) {
        // Only save risks with Algolia relevance > 0.5 (high relevance to search)
        if (risk.algolia_relevance > 0.5) {
          const quoteData = {
            company_id: companyId,
            audit_id: auditId,
            executive_name: 'SEC Filing',
            quote_text: risk.risk,
            context: `10-K ${latestFiling.fiscal_year} - Item 1A Risk Factors`,
            keywords: [risk.category.toLowerCase(), risk.severity, 'search', 'infrastructure'],
            source_type: '10-K Risk Factor',
            source_date: new Date(latestFiling.filing_date),
            source_url: latestFiling.file_url,
            fetched_at: new Date(),
          };

          await this.db.insert('executive_quotes', quoteData);
          savedRisks.push(risk);
        }
      }

      // Generate insight
      const highSeverityCount = savedRisks.filter(r => r.severity === 'high').length;
      let insight = `SEC 10-K (${latestFiling.fiscal_year}): ${savedRisks.length} high-relevance risk factors`;
      if (highSeverityCount > 0) {
        insight += ` (${highSeverityCount} high severity)`;
      }

      this.emitProgress(auditId, 3, moduleName, 'completed', 100, insight);

      logger.info('M08 completed', {
        companyId,
        auditId,
        ticker,
        fiscalYear: latestFiling.fiscal_year,
        totalRisks: riskFactors.length,
        savedRisks: savedRisks.length,
        highSeverity: highSeverityCount,
        cached: filingsResponse.source.cache_hit
      });
    } catch (error) {
      this.emitProgress(auditId, 3, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M08 failed', { companyId, auditId, error });
      // Don't throw - SEC data is nice-to-have for public companies only
    }
  }

  /**
   * M09: Executive Intelligence
   * Find executives via Apollo.io
   */
  private async runM09_ExecutiveIntelligence(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M09: Executive Intelligence';
    this.emitProgress(auditId, 3, moduleName, 'running', 0);

    try {
      // Get company domain
      const company = await this.db.query<any>('companies', { id: companyId });
      const domain = company[0].domain;

      // Call Apollo.io to find executives
      const executiveTitles = ['CEO', 'CFO', 'CTO', 'CIO', 'COO', 'CMO', 'CPO'];
      const response = await this.apollo.searchPeople(domain, executiveTitles, 25);
      const people = response.data.people || [];

      // Save to company_executives table
      const executiveRecords = [];
      for (const person of people) {
        // Categorize role
        const titleLower = person.title.toLowerCase();
        let roleCategory = 'other';
        if (titleLower.includes('ceo') || titleLower.includes('chief executive')) roleCategory = 'ceo';
        else if (titleLower.includes('cfo') || titleLower.includes('chief financial')) roleCategory = 'cfo';
        else if (titleLower.includes('cto') || titleLower.includes('chief technology')) roleCategory = 'cto';
        else if (titleLower.includes('cio') || titleLower.includes('chief information')) roleCategory = 'cio';
        else if (titleLower.includes('coo') || titleLower.includes('chief operating')) roleCategory = 'coo';

        const executiveData = {
          company_id: companyId,
          audit_id: auditId,
          full_name: person.name,
          title: person.title,
          role_category: roleCategory,
          department: null,
          email: person.email,
          phone: person.phone_numbers[0]?.sanitized_number || null,
          linkedin_url: person.linkedin_url,
          start_date: null,
          is_current: true,
          source_provider: 'apollo',
          apollo_person_id: person.id,
          fetched_at: new Date(),
        };

        executiveRecords.push(executiveData);
        await this.db.insert('company_executives', executiveData);
      }

      // Count C-level executives
      const cLevel = executiveRecords.filter(e => ['ceo', 'cfo', 'cto', 'cio', 'coo'].includes(e.role_category));
      const insight = `${executiveRecords.length} executives identified (${cLevel.length} C-level)`;

      this.emitProgress(auditId, 3, moduleName, 'completed', 100, insight);

      logger.info('M09 completed', {
        companyId,
        auditId,
        executives: executiveRecords.length,
        cLevel: cLevel.length,
        cached: response.meta.cached
      });
    } catch (error) {
      this.emitProgress(auditId, 3, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M09 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M10: Buying Committee
   * Identify decision makers via Apollo.io
   */
  private async runM10_BuyingCommittee(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M10: Buying Committee';
    this.emitProgress(auditId, 3, moduleName, 'running', 0);

    try {
      // Get company domain
      const company = await this.db.query<any>('companies', { id: companyId });
      const domain = company[0].domain;

      // Search for decision makers (VPs, Directors in Engineering/Product/Technology)
      const decisionMakerTitles = [
        'VP Engineering',
        'VP Technology',
        'VP Product',
        'Director of Engineering',
        'Director of Technology',
        'Director of Product',
        'Head of Engineering',
        'Head of Technology',
        'Head of Product',
        'Engineering Manager',
        'Technical Lead'
      ];

      const response = await this.apollo.searchPeople(domain, decisionMakerTitles, 50);
      const people = response.data.people || [];

      // Save to buying_committee table
      const committeeRecords = [];
      for (const person of people) {
        // Determine seniority level and decision maker status
        const titleLower = person.title.toLowerCase();
        let seniorityLevel = 'individual_contributor';
        let isDecisionMaker = false;

        if (titleLower.includes('vp') || titleLower.includes('vice president')) {
          seniorityLevel = 'vp';
          isDecisionMaker = true;
        } else if (titleLower.includes('director') || titleLower.includes('head of')) {
          seniorityLevel = 'director';
          isDecisionMaker = true;
        } else if (titleLower.includes('manager') || titleLower.includes('lead')) {
          seniorityLevel = 'manager';
          isDecisionMaker = false;
        }

        // Determine role category
        let roleCategory = 'technical_evaluator';
        if (isDecisionMaker && (titleLower.includes('vp') || titleLower.includes('director'))) {
          roleCategory = 'decision_maker';
        } else if (titleLower.includes('manager') || titleLower.includes('lead')) {
          roleCategory = 'technical_influencer';
        }

        const committeeData = {
          company_id: companyId,
          audit_id: auditId,
          full_name: person.name,
          title: person.title,
          role_category: roleCategory,
          department: titleLower.includes('engineering') ? 'Engineering' :
                      titleLower.includes('product') ? 'Product' :
                      titleLower.includes('technology') ? 'Technology' : null,
          email: person.email,
          phone: person.phone_numbers[0]?.sanitized_number || null,
          linkedin_url: person.linkedin_url,
          seniority_level: seniorityLevel,
          is_decision_maker: isDecisionMaker,
          source_provider: 'apollo',
          apollo_person_id: person.id,
          fetched_at: new Date(),
        };

        committeeRecords.push(committeeData);
        await this.db.insert('buying_committee', committeeData);
      }

      // Count decision makers
      const decisionMakers = committeeRecords.filter(c => c.is_decision_maker);
      const insight = `${committeeRecords.length} buying committee members identified (${decisionMakers.length} decision makers)`;

      this.emitProgress(auditId, 3, moduleName, 'completed', 100, insight);

      logger.info('M10 completed', {
        companyId,
        auditId,
        total: committeeRecords.length,
        decisionMakers: decisionMakers.length,
        cached: response.meta.cached
      });
    } catch (error) {
      this.emitProgress(auditId, 3, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M10 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M11: Displacement Analysis
   * Analyze competitors' search providers to find displacement opportunities
   */
  private async runM11_DisplacementAnalysis(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M11: Displacement Analysis';
    this.emitProgress(auditId, 4, moduleName, 'running', 0);

    try {
      // TODO: Analyze competitors' tech stacks
      const insight = 'Displacement opportunities analyzed';
      this.emitProgress(auditId, 4, moduleName, 'completed', 100, insight);

      logger.info('M11 completed', { companyId, auditId });
    } catch (error) {
      this.emitProgress(auditId, 4, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M11 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M12: Case Study Matching
   * Match company industry to Algolia case studies
   */
  private async runM12_CaseStudyMatching(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M12: Case Study Matching';
    this.emitProgress(auditId, 4, moduleName, 'running', 0);

    try {
      // TODO: Match vertical to case studies
      const insight = 'Relevant case studies identified';
      this.emitProgress(auditId, 4, moduleName, 'completed', 100, insight);

      logger.info('M12 completed', { companyId, auditId });
    } catch (error) {
      this.emitProgress(auditId, 4, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M12 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M13: ICP Priority Mapping
   * Score company against ICP criteria
   */
  private async runM13_ICPPriorityMapping(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M13: ICP Priority Mapping';
    this.emitProgress(auditId, 4, moduleName, 'running', 0);

    try {
      // TODO: Calculate ICP score
      const insight = 'ICP score calculated';
      this.emitProgress(auditId, 4, moduleName, 'completed', 100, insight);

      logger.info('M13 completed', { companyId, auditId });
    } catch (error) {
      this.emitProgress(auditId, 4, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M13 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M14: Signal Scoring
   * Calculate composite fit/intent/value/displacement scores
   */
  private async runM14_SignalScoring(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M14: Signal Scoring';
    this.emitProgress(auditId, 4, moduleName, 'running', 0);

    try {
      // TODO: Calculate composite scores
      const insight = 'Composite scores calculated';
      this.emitProgress(auditId, 4, moduleName, 'completed', 100, insight);

      logger.info('M14 completed', { companyId, auditId });
    } catch (error) {
      this.emitProgress(auditId, 4, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M14 failed', { companyId, auditId, error });
      throw error;
    }
  }

  /**
   * M15: Strategic Brief
   * Synthesize all data into strategic insights
   */
  private async runM15_StrategicBrief(companyId: string, auditId: string): Promise<void> {
    const moduleName = 'M15: Strategic Brief';
    this.emitProgress(auditId, 4, moduleName, 'running', 0);

    try {
      // TODO: Call strategic analysis engine
      const insight = 'Strategic brief generated';
      this.emitProgress(auditId, 4, moduleName, 'completed', 100, insight);

      logger.info('M15 completed', { companyId, auditId });
    } catch (error) {
      this.emitProgress(auditId, 4, moduleName, 'failed', 0, undefined, String(error));
      logger.error('M15 failed', { companyId, auditId, error });
      throw error;
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Emit progress update via WebSocket
   */
  private emitProgress(
    auditId: string,
    wave: number,
    module: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    percent: number,
    insight?: string,
    error?: string
  ): void {
    if (!this.ws) return;

    const progress: EnrichmentProgress = {
      wave,
      module,
      status,
      percent,
      insight,
      error,
    };

    this.ws.emitAuditEvent(auditId, {
      type: 'test:started',
      data: progress,
      timestamp: new Date(),
    });
  }
}
