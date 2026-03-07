/**
 * Enrichment Persistence Service
 *
 * Transforms API responses into database schema and persists to 11 enrichment tables.
 * All tables use composite primary key: (company_id, audit_id, domain_key)
 *
 * Design Pattern:
 * - Each persist method handles one enrichment table
 * - Batch inserts for multiple rows
 * - Graceful error handling (don't fail entire persistence)
 * - Upsert strategy to handle duplicate data
 * - Detailed logging for observability
 */

import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface PersistenceResult {
  succeeded: string[];
  failed: Array<{ table: string; error: string }>;
  totalRecords: number;
}

export interface TrafficDataRow {
  company_id: string;
  audit_id: string;
  month: Date;
  monthly_visits?: number;
  unique_visitors?: number;
  page_views?: number;
  bounce_rate?: number;
  avg_visit_duration?: number;
  pages_per_visit?: number;
  direct_traffic_pct?: number;
  search_traffic_pct?: number;
  social_traffic_pct?: number;
  referral_traffic_pct?: number;
  paid_traffic_pct?: number;
  email_traffic_pct?: number;
  top_country?: string;
  top_country_pct?: number;
  desktop_pct?: number;
  mobile_pct?: number;
  tablet_pct?: number;
  source_provider?: string;
  source_url?: string;
  fetched_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface FinancialDataRow {
  company_id: string;
  audit_id: string;
  fiscal_year: number;
  fiscal_quarter: number;
  revenue?: number;
  gross_profit?: number;
  operating_income?: number;
  net_income?: number;
  total_assets?: number;
  total_liabilities?: number;
  shareholders_equity?: number;
  cash_and_equivalents?: number;
  operating_cash_flow?: number;
  investing_cash_flow?: number;
  financing_cash_flow?: number;
  free_cash_flow?: number;
  ebitda?: number;
  earnings_per_share?: number;
  price_to_earnings?: number;
  source_provider?: string;
  source_url?: string;
  fetched_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface TechnologyDataRow {
  company_id: string;
  audit_id: string;
  technology_name: string;
  technology_category?: string;
  technology_vendor?: string;
  confidence_level?: string;
  first_detected?: Date;
  last_detected?: Date;
  source_provider?: string;
  source_url?: string;
  detected_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface CompetitorDataRow {
  company_id: string;
  audit_id: string;
  competitor_domain: string;
  competitor_name?: string;
  similarity_score?: number;
  competitor_search_provider?: string;
  competitor_ecommerce_platform?: string;
  competitor_monthly_visits?: number;
  traffic_ratio?: number;
  source_provider?: string;
  source_url?: string;
  detected_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface ExecutiveDataRow {
  company_id: string;
  audit_id: string;
  full_name: string;
  title?: string;
  role_category?: string;
  department?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  start_date?: Date;
  is_current?: boolean;
  source_provider?: string;
  apollo_person_id?: string;
  fetched_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface ExecutiveQuoteRow {
  company_id: string;
  audit_id: string;
  executive_name: string;
  quote_text: string;
  context?: string;
  keywords?: string[];
  source_type: string;
  source_date: Date;
  source_url?: string;
  fetched_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface SocialProfileRow {
  company_id: string;
  audit_id: string;
  platform: string;
  profile_url: string;
  follower_count?: number;
  following_count?: number;
  avg_likes_per_post?: number;
  avg_comments_per_post?: number;
  avg_shares_per_post?: number;
  engagement_rate?: number;
  post_frequency_per_week?: number;
  last_post_date?: Date;
  source_actor?: string;
  fetched_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface SocialPostRow {
  company_id: string;
  audit_id: string;
  platform: string;
  post_url: string;
  post_text?: string;
  post_date?: Date;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  mentions_search?: boolean;
  sentiment?: string;
  scraped_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface BuyingCommitteeRow {
  company_id: string;
  audit_id: string;
  full_name: string;
  title?: string;
  role_category?: string;
  department?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  seniority_level?: string;
  apollo_person_id?: string;
  source_provider?: string;
  fetched_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface IntentSignalRow {
  company_id: string;
  audit_id: string;
  signal_type: string;
  signal_description: string;
  signal_category?: string;
  confidence_score?: number;
  detected_at?: Date;
  source_provider?: string;
  source_url?: string;
  insight?: string;
  evidence_urls?: string[];
}

export interface HiringDataRow {
  company_id: string;
  audit_id: string;
  job_title: string;
  posted_date: Date;
  department?: string;
  role_category?: string;
  location?: string;
  employment_type?: string;
  is_buying_committee?: boolean;
  keywords?: string[];
  source_url?: string;
  fetched_at?: Date;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}

export interface EnrichmentData {
  traffic?: TrafficDataRow[];
  financials?: FinancialDataRow[];
  technologies?: TechnologyDataRow[];
  competitors?: CompetitorDataRow[];
  executives?: ExecutiveDataRow[];
  quotes?: ExecutiveQuoteRow[];
  socialProfiles?: SocialProfileRow[];
  socialPosts?: SocialPostRow[];
  buyingCommittee?: BuyingCommitteeRow[];
  intentSignals?: IntentSignalRow[];
  hiring?: HiringDataRow[];
}

// =============================================================================
// ENRICHMENT PERSISTENCE SERVICE
// =============================================================================

export class EnrichmentPersistence {
  private db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  // ===========================================================================
  // MASTER METHOD: Persist All Enrichment Data
  // ===========================================================================

  /**
   * Persist all enrichment data across 11 tables in parallel.
   * Returns partial success - some tables may succeed while others fail.
   */
  async persistAllEnrichmentData(
    companyId: string,
    auditId: string,
    enrichmentData: EnrichmentData
  ): Promise<PersistenceResult> {
    const startTime = Date.now();
    logger.info('Starting enrichment persistence', {
      companyId,
      auditId,
      tables: Object.keys(enrichmentData).length,
    });

    const results: PersistenceResult = {
      succeeded: [],
      failed: [],
      totalRecords: 0,
    };

    // Table names for tracking
    const tableNames = [
      'company_traffic',
      'company_financials',
      'company_technologies',
      'company_competitors',
      'company_executives',
      'executive_quotes',
      'company_social_profiles',
      'company_social_posts',
      'buying_committee',
      'intent_signals',
      'company_hiring',
    ];

    // Run all persist operations in parallel
    const persistencePromises = [
      this.persistTrafficData(companyId, auditId, enrichmentData.traffic),
      this.persistFinancials(companyId, auditId, enrichmentData.financials),
      this.persistTechnologies(companyId, auditId, enrichmentData.technologies),
      this.persistCompetitors(companyId, auditId, enrichmentData.competitors),
      this.persistExecutives(companyId, auditId, enrichmentData.executives),
      this.persistExecutiveQuotes(companyId, auditId, enrichmentData.quotes),
      this.persistSocialProfiles(companyId, auditId, enrichmentData.socialProfiles),
      this.persistSocialPosts(companyId, auditId, enrichmentData.socialPosts),
      this.persistBuyingCommittee(companyId, auditId, enrichmentData.buyingCommittee),
      this.persistIntentSignals(companyId, auditId, enrichmentData.intentSignals),
      this.persistHiring(companyId, auditId, enrichmentData.hiring),
    ];

    // Wait for all persistence operations
    const settled = await Promise.allSettled(persistencePromises);

    // Process results
    settled.forEach((result, index) => {
      const tableName = tableNames[index];
      if (result.status === 'fulfilled') {
        results.succeeded.push(tableName);
        results.totalRecords += result.value.count;
      } else {
        const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
        results.failed.push({ table: tableName, error });
        logger.error(`Failed to persist ${tableName}`, {
          companyId,
          auditId,
          error,
        });
      }
    });

    const duration = Date.now() - startTime;
    logger.info('Enrichment persistence completed', {
      companyId,
      auditId,
      succeeded: results.succeeded.length,
      failed: results.failed.length,
      totalRecords: results.totalRecords,
      durationMs: duration,
    });

    return results;
  }

  // ===========================================================================
  // TABLE-SPECIFIC PERSISTENCE METHODS
  // ===========================================================================

  /**
   * 1. Persist Traffic Data (SimilarWeb)
   * Table: company_traffic
   * PK: (company_id, audit_id, month)
   */
  async persistTrafficData(
    companyId: string,
    auditId: string,
    data?: TrafficDataRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No traffic data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      // Ensure all rows have required composite key fields
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        fetched_at: row.fetched_at || new Date(),
      }));

      // Use upsert to handle duplicates
      const { error } = await this.db['client']
        .from('company_traffic')
        .upsert(rows, { onConflict: 'company_id,audit_id,month' });

      if (error) throw error;

      logger.info('Traffic data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist traffic data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 2. Persist Financial Data (Yahoo Finance / SEC Edgar)
   * Table: company_financials
   * PK: (company_id, audit_id, fiscal_year, fiscal_quarter)
   */
  async persistFinancials(
    companyId: string,
    auditId: string,
    data?: FinancialDataRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No financial data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        fiscal_quarter: row.fiscal_quarter ?? 0,
        fetched_at: row.fetched_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('company_financials')
        .upsert(rows, { onConflict: 'company_id,audit_id,fiscal_year,fiscal_quarter' });

      if (error) throw error;

      logger.info('Financial data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist financial data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 3. Persist Technology Stack (BuiltWith)
   * Table: company_technologies
   * PK: (company_id, audit_id, technology_name)
   */
  async persistTechnologies(
    companyId: string,
    auditId: string,
    data?: TechnologyDataRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No technology data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        detected_at: row.detected_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('company_technologies')
        .upsert(rows, { onConflict: 'company_id,audit_id,technology_name' });

      if (error) throw error;

      logger.info('Technology data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist technology data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 4. Persist Competitor Data (SimilarWeb)
   * Table: company_competitors
   * PK: (company_id, audit_id, competitor_domain)
   */
  async persistCompetitors(
    companyId: string,
    auditId: string,
    data?: CompetitorDataRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No competitor data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        detected_at: row.detected_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('company_competitors')
        .upsert(rows, { onConflict: 'company_id,audit_id,competitor_domain' });

      if (error) throw error;

      logger.info('Competitor data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist competitor data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 5. Persist Executive Data (Apollo.io / LinkedIn)
   * Table: company_executives
   * PK: (company_id, audit_id, full_name)
   */
  async persistExecutives(
    companyId: string,
    auditId: string,
    data?: ExecutiveDataRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No executive data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        is_current: row.is_current ?? true,
        fetched_at: row.fetched_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('company_executives')
        .upsert(rows, { onConflict: 'company_id,audit_id,full_name' });

      if (error) throw error;

      logger.info('Executive data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist executive data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 6. Persist Executive Quotes (SEC filings / Earnings calls)
   * Table: executive_quotes
   * PK: (company_id, audit_id, executive_name, source_type, source_date)
   */
  async persistExecutiveQuotes(
    companyId: string,
    auditId: string,
    data?: ExecutiveQuoteRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No executive quotes to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        fetched_at: row.fetched_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('executive_quotes')
        .upsert(rows, {
          onConflict: 'company_id,audit_id,executive_name,source_type,source_date',
        });

      if (error) throw error;

      logger.info('Executive quotes persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist executive quotes', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 7. Persist Social Profiles (Apify LinkedIn scraper)
   * Table: company_social_profiles
   * PK: (company_id, audit_id, platform)
   */
  async persistSocialProfiles(
    companyId: string,
    auditId: string,
    data?: SocialProfileRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No social profile data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        fetched_at: row.fetched_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('company_social_profiles')
        .upsert(rows, { onConflict: 'company_id,audit_id,platform' });

      if (error) throw error;

      logger.info('Social profile data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist social profile data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 8. Persist Social Posts (Apify LinkedIn scraper)
   * Table: company_social_posts
   * PK: (company_id, audit_id, platform, post_url)
   */
  async persistSocialPosts(
    companyId: string,
    auditId: string,
    data?: SocialPostRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No social post data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        mentions_search: row.mentions_search ?? false,
        scraped_at: row.scraped_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('company_social_posts')
        .upsert(rows, { onConflict: 'company_id,audit_id,platform,post_url' });

      if (error) throw error;

      logger.info('Social post data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist social post data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 9. Persist Buying Committee (Apollo.io)
   * Table: buying_committee
   * PK: (company_id, audit_id, full_name)
   */
  async persistBuyingCommittee(
    companyId: string,
    auditId: string,
    data?: BuyingCommitteeRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No buying committee data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        source_provider: row.source_provider || 'apollo',
        fetched_at: row.fetched_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('buying_committee')
        .upsert(rows, { onConflict: 'company_id,audit_id,full_name' });

      if (error) throw error;

      logger.info('Buying committee data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist buying committee data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 10. Persist Intent Signals (Apollo.io)
   * Table: intent_signals
   * PK: (company_id, audit_id, signal_type, signal_description)
   */
  async persistIntentSignals(
    companyId: string,
    auditId: string,
    data?: IntentSignalRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No intent signal data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        source_provider: row.source_provider || 'apollo',
        detected_at: row.detected_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('intent_signals')
        .upsert(rows, { onConflict: 'company_id,audit_id,signal_type,signal_description' });

      if (error) throw error;

      logger.info('Intent signal data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist intent signal data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  /**
   * 11. Persist Hiring Data (Apify LinkedIn jobs scraper)
   * Table: company_hiring
   * PK: (company_id, audit_id, job_title, posted_date)
   */
  async persistHiring(
    companyId: string,
    auditId: string,
    data?: HiringDataRow[]
  ): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      logger.debug('No hiring data to persist', { companyId, auditId });
      return { count: 0 };
    }

    try {
      const rows = data.map((row) => ({
        ...row,
        company_id: companyId,
        audit_id: auditId,
        is_buying_committee: row.is_buying_committee ?? false,
        fetched_at: row.fetched_at || new Date(),
      }));

      const { error } = await this.db['client']
        .from('company_hiring')
        .upsert(rows, { onConflict: 'company_id,audit_id,job_title,posted_date' });

      if (error) throw error;

      logger.info('Hiring data persisted', {
        companyId,
        auditId,
        rows: rows.length,
      });

      return { count: rows.length };
    } catch (error) {
      logger.error('Failed to persist hiring data', {
        companyId,
        auditId,
        error,
      });
      throw error;
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Delete all enrichment data for a specific audit
   * Useful for re-running enrichment or cleanup
   */
  async deleteAuditData(companyId: string, auditId: string): Promise<void> {
    logger.info('Deleting audit enrichment data', { companyId, auditId });

    const tables = [
      'company_traffic',
      'company_financials',
      'company_technologies',
      'company_competitors',
      'company_executives',
      'executive_quotes',
      'company_social_profiles',
      'company_social_posts',
      'buying_committee',
      'intent_signals',
      'company_hiring',
    ];

    // Delete in parallel
    await Promise.all(
      tables.map((table) =>
        this.db['client']
          .from(table)
          .delete()
          .eq('company_id', companyId)
          .eq('audit_id', auditId)
      )
    );

    logger.info('Audit enrichment data deleted', { companyId, auditId });
  }

  /**
   * Get enrichment data statistics for an audit
   */
  async getAuditDataStats(companyId: string, auditId: string): Promise<Record<string, number>> {
    const tables = [
      'company_traffic',
      'company_financials',
      'company_technologies',
      'company_competitors',
      'company_executives',
      'executive_quotes',
      'company_social_profiles',
      'company_social_posts',
      'buying_committee',
      'intent_signals',
      'company_hiring',
    ];

    const stats: Record<string, number> = {};

    await Promise.all(
      tables.map(async (table) => {
        const { count, error } = await this.db['client']
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('audit_id', auditId);

        stats[table] = error ? 0 : count || 0;
      })
    );

    return stats;
  }
}
