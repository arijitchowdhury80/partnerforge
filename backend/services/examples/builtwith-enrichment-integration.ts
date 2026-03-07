/**
 * BuiltWith Integration Example for Enrichment Service
 *
 * This example demonstrates how the BuiltWith client integrates with
 * the enrichment orchestrator for the Search Audit Dashboard.
 */

import { builtWithClient } from '../builtwith';
import { logger } from '../../utils/logger';

/**
 * Enrichment data structure (to be saved to database)
 */
interface CompanyEnrichmentData {
  company_id: string;
  audit_id: string;
  technologies: any[];
  financials: any;
  social_profiles: any[];
  trust_indicators: any;
  keywords: any[];
  enrichment_metadata: {
    builtwith_calls: number;
    builtwith_cost: number;
    cache_hits: number;
    total_latency_ms: number;
  };
}

/**
 * Enrich company using BuiltWith APIs
 *
 * This function would be called by the EnrichmentOrchestrator as part
 * of Phase 1 research (14-step data collection process).
 *
 * @param companyId - Company UUID from database
 * @param auditId - Audit UUID from database
 * @param domain - Company domain to analyze
 * @returns Enrichment data ready for database insertion
 */
export async function enrichCompanyWithBuiltWith(
  companyId: string,
  auditId: string,
  domain: string
): Promise<CompanyEnrichmentData> {
  logger.info(`Starting BuiltWith enrichment for ${domain}`);

  const startTime = Date.now();
  const metadata = {
    builtwith_calls: 0,
    builtwith_cost: 0,
    cache_hits: 0,
    total_latency_ms: 0
  };

  // 1. Technology Stack (Primary data source)
  logger.debug(`[1/5] Fetching technology stack for ${domain}`);
  const techStackResult = await builtWithClient.getDomainTechnologies(domain);
  metadata.builtwith_calls++;
  metadata.builtwith_cost += 0.02;
  metadata.total_latency_ms += techStackResult.meta.latency_ms;
  if (techStackResult.meta.cached) metadata.cache_hits++;

  const technologies = techStackResult.data.Results[0]?.Result.Paths[0]?.Technologies || [];

  // Transform for database storage (company_technologies table)
  const technologiesData = technologies.map(tech => ({
    company_id: companyId,
    audit_id: auditId,
    technology_name: tech.Name,
    category: tech.Tag,
    first_detected: new Date(tech.FirstDetected),
    last_detected: new Date(tech.LastDetected),
    is_premium: tech.IsPremium || false,
    source_url: `https://builtwith.com/${domain}`,
    raw_data: tech
  }));

  // 2. Financial Estimates (For ICP scoring)
  logger.debug(`[2/5] Fetching financial estimates for ${domain}`);
  const financialsResult = await builtWithClient.getFinancials(domain);
  metadata.builtwith_calls++;
  metadata.builtwith_cost += 0.02;
  metadata.total_latency_ms += financialsResult.meta.latency_ms;
  if (financialsResult.meta.cached) metadata.cache_hits++;

  // Transform for database (company_financials table)
  const financialsData = {
    company_id: companyId,
    audit_id: auditId,
    fiscal_year: new Date().getFullYear(),
    fiscal_quarter: null,
    revenue_min: financialsResult.data.Estimates.Revenue.Min,
    revenue_max: financialsResult.data.Estimates.Revenue.Max,
    revenue_currency: financialsResult.data.Estimates.Revenue.Currency,
    employee_count_min: financialsResult.data.Estimates.Employees.Min,
    employee_count_max: financialsResult.data.Estimates.Employees.Max,
    company_size: financialsResult.data.Estimates.CompanySize,
    funding_stage: financialsResult.data.Estimates.FundingStage || null,
    source: 'builtwith',
    source_url: `https://builtwith.com/${domain}`,
    confidence_score: 0.7, // BuiltWith estimates are moderately reliable
    raw_data: financialsResult.data
  };

  // 3. Social Profiles (For outreach)
  logger.debug(`[3/5] Fetching social profiles for ${domain}`);
  const socialResult = await builtWithClient.getSocialProfiles(domain);
  metadata.builtwith_calls++;
  metadata.builtwith_cost += 0.02;
  metadata.total_latency_ms += socialResult.meta.latency_ms;
  if (socialResult.meta.cached) metadata.cache_hits++;

  // Transform for database (company_social_profiles table)
  const socialData = socialResult.data.Profiles.map(profile => ({
    company_id: companyId,
    audit_id: auditId,
    platform: profile.Platform.toLowerCase(),
    profile_url: profile.Url,
    handle: profile.Handle || null,
    follower_count: profile.Followers || null,
    is_verified: profile.Verified || false,
    last_updated: profile.LastUpdated ? new Date(profile.LastUpdated) : new Date(),
    source: 'builtwith'
  }));

  // 4. Trust Indicators (For risk assessment)
  logger.debug(`[4/5] Fetching trust indicators for ${domain}`);
  const trustResult = await builtWithClient.getTrustIndicators(domain);
  metadata.builtwith_calls++;
  metadata.builtwith_cost += 0.02;
  metadata.total_latency_ms += trustResult.meta.latency_ms;
  if (trustResult.meta.cached) metadata.cache_hits++;

  // Transform for database (custom trust_indicators column in companies table)
  const trustData = {
    security: {
      has_ssl: trustResult.data.Security.HasSSL,
      ssl_provider: trustResult.data.Security.SSLProvider || null,
      ssl_expiry: trustResult.data.Security.SSLExpiry || null,
      has_hsts: trustResult.data.Security.HasHSTS || false
    },
    trust_signals: {
      has_privacy_policy: trustResult.data.TrustSignals.HasPrivacyPolicy,
      has_terms_of_service: trustResult.data.TrustSignals.HasTermsOfService,
      has_cookie_consent: trustResult.data.TrustSignals.HasCookieConsent,
      trust_badges: trustResult.data.TrustSignals.TrustBadges
    },
    compliance: trustResult.data.Compliance
  };

  // 5. Keywords (Optional - for SEO context)
  logger.debug(`[5/5] Fetching keywords for ${domain}`);
  const keywordsResult = await builtWithClient.getKeywords(domain);
  metadata.builtwith_calls++;
  metadata.builtwith_cost += 0.02;
  metadata.total_latency_ms += keywordsResult.meta.latency_ms;
  if (keywordsResult.meta.cached) metadata.cache_hits++;

  // Transform for database (can be stored in company JSON column or separate table)
  const keywordsData = keywordsResult.data.Keywords.slice(0, 20).map(kw => ({
    keyword: kw.Keyword,
    rank: kw.Rank,
    volume: kw.Volume,
    competition: kw.Competition,
    cpc: kw.CPC || null
  }));

  const totalTime = Date.now() - startTime;
  logger.info(
    `BuiltWith enrichment complete for ${domain}: ` +
    `${metadata.builtwith_calls} calls, ` +
    `${metadata.cache_hits} cache hits (${((metadata.cache_hits / metadata.builtwith_calls) * 100).toFixed(0)}%), ` +
    `$${metadata.builtwith_cost.toFixed(2)} cost, ` +
    `${totalTime}ms total`
  );

  return {
    company_id: companyId,
    audit_id: auditId,
    technologies: technologiesData,
    financials: financialsData,
    social_profiles: socialData,
    trust_indicators: trustData,
    keywords: keywordsData,
    enrichment_metadata: {
      ...metadata,
      total_latency_ms: totalTime
    }
  };
}

/**
 * Competitive Intelligence: Batch analyze competitors
 *
 * This function demonstrates batch processing for competitive analysis.
 * Used in Partner Intelligence feature to find displacement opportunities.
 *
 * @param competitors - Array of competitor domains
 * @returns Technology adoption analysis
 */
export async function batchCompetitorAnalysis(
  competitors: string[]
): Promise<{
  commonTechnologies: Array<{ name: string; adoptionRate: number }>;
  searchProviders: Record<string, number>;
  algoliaUsage: string[];
  displacementTargets: string[];
}> {
  logger.info(`Running batch competitor analysis on ${competitors.length} domains`);

  // Use batch lookup for efficiency (max 100 domains per call)
  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < competitors.length; i += batchSize) {
    batches.push(competitors.slice(i, i + batchSize));
  }

  // Technology usage aggregation
  const techUsage: Record<string, number> = {};
  const searchProviders: Record<string, number> = {};
  const algoliaUsers: string[] = [];

  for (const batch of batches) {
    const result = await builtWithClient.batchLookup(batch);

    result.data.Results.forEach(({ Domain, Result }) => {
      const technologies = Result.Paths[0]?.Technologies || [];

      technologies.forEach(tech => {
        techUsage[tech.Name] = (techUsage[tech.Name] || 0) + 1;

        // Track search providers specifically
        if (tech.Tag === 'Search' || tech.Name.toLowerCase().includes('search')) {
          searchProviders[tech.Name] = (searchProviders[tech.Name] || 0) + 1;

          if (tech.Name.toLowerCase().includes('algolia')) {
            algoliaUsers.push(Domain);
          }
        }
      });
    });
  }

  // Find commonly used technologies (adopted by 30%+ of competitors)
  const threshold = competitors.length * 0.3;
  const commonTechnologies = Object.entries(techUsage)
    .filter(([_, count]) => count >= threshold)
    .map(([name, count]) => ({
      name,
      adoptionRate: count / competitors.length
    }))
    .sort((a, b) => b.adoptionRate - a.adoptionRate);

  // Identify displacement targets (not using Algolia)
  const displacementTargets = competitors.filter(
    domain => !algoliaUsers.includes(domain)
  );

  logger.info(
    `Competitor analysis complete: ` +
    `${commonTechnologies.length} common techs, ` +
    `${Object.keys(searchProviders).length} search providers, ` +
    `${algoliaUsers.length} Algolia users, ` +
    `${displacementTargets.length} displacement opportunities`
  );

  return {
    commonTechnologies,
    searchProviders,
    algoliaUsage: algoliaUsers,
    displacementTargets
  };
}

/**
 * Technology Gap Analysis
 *
 * Identify missing capabilities in a company's tech stack.
 * Used to position Algolia as a recommended solution.
 *
 * @param domain - Company domain
 * @param industryBenchmark - Expected technologies for this industry
 * @returns Gap analysis with recommendations
 */
export async function analyzeTechnologyGaps(
  domain: string,
  industryBenchmark: string[] = ['Search', 'Personalization', 'Analytics']
): Promise<{
  currentStack: string[];
  missingCapabilities: string[];
  recommendations: any[];
}> {
  logger.info(`Running technology gap analysis for ${domain}`);

  // Get current tech stack
  const techStackResult = await builtWithClient.getDomainTechnologies(domain);
  const technologies = techStackResult.data.Results[0]?.Result.Paths[0]?.Technologies || [];

  const currentCategories = [...new Set(technologies.map(t => t.Tag))];
  const missingCapabilities = industryBenchmark.filter(
    category => !currentCategories.includes(category)
  );

  // Get AI-powered recommendations
  const recsResult = await builtWithClient.getRecommendations(domain);

  logger.info(
    `Gap analysis complete: ${currentCategories.length} current capabilities, ` +
    `${missingCapabilities.length} gaps identified, ` +
    `${recsResult.data.Recommendations.length} recommendations available`
  );

  return {
    currentStack: currentCategories,
    missingCapabilities,
    recommendations: recsResult.data.Recommendations.filter(
      rec => missingCapabilities.includes(rec.Category)
    )
  };
}

/**
 * Example: Complete enrichment workflow
 */
async function exampleWorkflow() {
  const domain = 'costco.com';
  const companyId = '550e8400-e29b-41d4-a716-446655440000';
  const auditId = '660e8400-e29b-41d4-a716-446655440000';

  // Step 1: Enrich company data
  const enrichmentData = await enrichCompanyWithBuiltWith(
    companyId,
    auditId,
    domain
  );

  console.log('\n=== Enrichment Results ===');
  console.log(`Technologies: ${enrichmentData.technologies.length}`);
  console.log(`Revenue: $${enrichmentData.financials.revenue_min / 1000000}M - $${enrichmentData.financials.revenue_max / 1000000}M`);
  console.log(`Social Profiles: ${enrichmentData.social_profiles.length}`);
  console.log(`Cost: $${enrichmentData.enrichment_metadata.builtwith_cost}`);
  console.log(`Cache Hit Rate: ${((enrichmentData.enrichment_metadata.cache_hits / enrichmentData.enrichment_metadata.builtwith_calls) * 100).toFixed(0)}%`);

  // Step 2: Competitor analysis
  const competitors = ['walmart.com', 'target.com', 'kroger.com'];
  const compAnalysis = await batchCompetitorAnalysis(competitors);

  console.log('\n=== Competitor Analysis ===');
  console.log(`Common Technologies: ${compAnalysis.commonTechnologies.length}`);
  console.log(`Algolia Users: ${compAnalysis.algoliaUsage.length}`);
  console.log(`Displacement Targets: ${compAnalysis.displacementTargets.length}`);

  // Step 3: Gap analysis
  const gapAnalysis = await analyzeTechnologyGaps(domain);

  console.log('\n=== Gap Analysis ===');
  console.log(`Current Stack: ${gapAnalysis.currentStack.join(', ')}`);
  console.log(`Missing Capabilities: ${gapAnalysis.missingCapabilities.join(', ')}`);
  console.log(`Recommendations: ${gapAnalysis.recommendations.length}`);
}

// Export all functions for use in enrichment service
export {
  exampleWorkflow
};

// Run example if executed directly
if (require.main === module) {
  exampleWorkflow().catch(console.error);
}
