/**
 * Composite Scoring Service
 *
 * Calculates Fit, Intent, Value, and Displacement scores based on enrichment data.
 * Each dimension is weighted equally (25%) to produce overall score (0-100).
 *
 * Score to Status Mapping:
 * - 70-100: HOT (ready for outreach)
 * - 40-69: WARM (nurture pipeline)
 * - 0-39: COLD (low priority)
 *
 * Data Sources:
 * - companies table (attributes)
 * - company_traffic (SimilarWeb)
 * - company_financials (Yahoo Finance)
 * - company_technologies (BuiltWith)
 * - company_competitors (SimilarWeb)
 * - company_executives (Apollo)
 * - executive_quotes (SEC/earnings)
 * - company_hiring (Apify)
 * - intent_signals (Apollo)
 */

import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';

/**
 * Enrichment data structure (aggregated from all tables)
 */
export interface EnrichmentData {
  // Company attributes (from companies table)
  company: {
    id: string;
    domain: string;
    name: string;
    industry?: string;
    sector?: string;
    founded_year?: number;
    headquarters_country?: string;
    employee_count?: number;
    annual_revenue?: number;
    is_public?: boolean;
    stock_ticker?: string;
  };

  // Traffic metrics (from company_traffic)
  traffic?: {
    monthly_visits: number;
    bounce_rate: number;
    avg_visit_duration: number;
    mobile_pct: number;
    yoy_growth?: number; // Calculated from historical data
  };

  // Financials (from company_financials)
  financials?: {
    revenue: number;
    revenue_growth?: number; // YoY percentage
    gross_profit?: number;
    net_income?: number;
    free_cash_flow?: number;
    margin?: number; // net_income / revenue * 100
  };

  // Technologies (from company_technologies)
  technologies?: {
    technology_name: string;
    technology_category: string;
  }[];

  // Competitors (from company_competitors)
  competitors?: {
    competitor_domain: string;
    competitor_search_provider?: string;
  }[];

  // Executives (from company_executives)
  executives?: {
    full_name: string;
    title: string;
    role_category: string;
  }[];

  // Executive quotes (from executive_quotes)
  quotes?: {
    executive_name: string;
    quote_text: string;
    keywords: string[];
    source_type: string;
  }[];

  // Hiring signals (from company_hiring)
  hiring?: {
    job_title: string;
    department?: string;
    posted_date: Date;
  }[];

  // Intent signals (from intent_signals)
  intent_signals?: {
    signal_type: string;
    signal_description: string;
    confidence_score?: number;
  }[];
}

/**
 * Composite scores result
 */
export interface CompositeScores {
  fitScore: number;
  intentScore: number;
  valueScore: number;
  displacementScore: number;
  overallScore: number;
  status: 'hot' | 'warm' | 'cold';
  breakdown: {
    fit: string[];
    intent: string[];
    value: string[];
    displacement: string[];
  };
}

/**
 * Algolia target verticals (highest fit)
 */
const TARGET_VERTICALS = [
  'ecommerce',
  'e-commerce',
  'retail',
  'saas',
  'software',
  'media',
  'publishing',
  'marketplace',
];

/**
 * Partner technologies (displacement opportunities)
 */
const PARTNER_TECHNOLOGIES = [
  'Adobe Experience Manager',
  'Adobe AEM',
  'Amplience',
  'Spryker',
  'Shopify Plus',
  'Salesforce Commerce Cloud',
  'SAP Commerce',
  'Oracle ATG',
];

/**
 * Displaceable search providers
 */
const DISPLACEABLE_SEARCH = [
  'Elasticsearch',
  'Solr',
  'Apache Solr',
  'Coveo',
  'Swiftype',
  'Site Search 360',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract industry from enrichment data
 */
function extractIndustry(data: EnrichmentData): string | undefined {
  return data.company.industry || data.company.sector;
}

/**
 * Calculate traffic growth YoY (if historical data available)
 */
function calculateTrafficGrowth(data: EnrichmentData): number {
  // If yoy_growth already calculated, return it
  if (data.traffic?.yoy_growth !== undefined) {
    return data.traffic.yoy_growth;
  }
  // Default: 0 (no growth data)
  return 0;
}

/**
 * Calculate revenue growth YoY
 */
function calculateRevenueGrowth(data: EnrichmentData): number {
  return data.financials?.revenue_growth || 0;
}

/**
 * Check if company uses partner technology
 */
function hasPartnerTechnology(technologies?: { technology_name: string }[]): boolean {
  if (!technologies || technologies.length === 0) return false;

  return technologies.some((tech) =>
    PARTNER_TECHNOLOGIES.some((partner) => tech.technology_name.toLowerCase().includes(partner.toLowerCase()))
  );
}

/**
 * Get current search provider from tech stack
 */
function getCurrentSearchProvider(technologies?: { technology_name: string }[]): string | null {
  if (!technologies || technologies.length === 0) return null;

  for (const tech of technologies) {
    for (const provider of DISPLACEABLE_SEARCH) {
      if (tech.technology_name.toLowerCase().includes(provider.toLowerCase())) {
        return provider;
      }
    }
  }

  return null;
}

/**
 * Check if Algolia is in tech stack
 */
function hasAlgolia(technologies?: { technology_name: string }[]): boolean {
  if (!technologies || technologies.length === 0) return false;

  return technologies.some((tech) => tech.technology_name.toLowerCase().includes('algolia'));
}

/**
 * Count hiring roles matching keywords
 */
function countHiringRoles(
  hiring?: { job_title: string; department?: string }[],
  keywords: string[] = ['search', 'engineer', 'data', 'platform']
): number {
  if (!hiring || hiring.length === 0) return 0;

  return hiring.filter((job) => {
    const title = job.job_title.toLowerCase();
    const dept = job.department?.toLowerCase() || '';
    return keywords.some((keyword) => title.includes(keyword) || dept.includes(keyword));
  }).length;
}

/**
 * Check if executive quotes mention search/experience keywords
 */
function hasSearchQuotes(quotes?: { keywords: string[] }[]): boolean {
  if (!quotes || quotes.length === 0) return false;

  const searchKeywords = ['search', 'customer experience', 'personalization', 'discovery', 'findability'];
  return quotes.some((quote) =>
    quote.keywords.some((keyword) => searchKeywords.some((sk) => keyword.toLowerCase().includes(sk.toLowerCase())))
  );
}

/**
 * Check if competitor uses Algolia
 */
function competitorUsesAlgolia(competitors?: { competitor_search_provider?: string }[]): boolean {
  if (!competitors || competitors.length === 0) return false;

  return competitors.some((comp) => comp.competitor_search_provider?.toLowerCase().includes('algolia'));
}

/**
 * Round score to 1 decimal place and clamp to 0-100
 */
function clampScore(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return Math.round(clamped * 10) / 10;
}

// =============================================================================
// SCORING FUNCTIONS
// =============================================================================

/**
 * Calculate Fit Score (0-100)
 *
 * Measures how well the company matches Algolia's ICP.
 *
 * Factors:
 * - Industry match with target verticals (+25)
 * - Company size (1000-10000 employees: +20, >10000: +15)
 * - Geography (US/Europe: +15, Other: +10)
 * - Public company (+15) vs private (+10)
 * - Revenue range (>$100M: +15, >$1B: +20)
 *
 * Weight: 25% of overall score
 */
export function calculateFitScore(data: EnrichmentData): { score: number; breakdown: string[] } {
  let score = 0;
  const breakdown: string[] = [];

  // Factor 1: Industry match (0-25 points)
  const industry = extractIndustry(data);
  if (industry) {
    const isTargetVertical = TARGET_VERTICALS.some((vertical) => industry.toLowerCase().includes(vertical));
    if (isTargetVertical) {
      score += 25;
      breakdown.push(`Target vertical (${industry}): +25`);
    } else {
      score += 10;
      breakdown.push(`Non-target vertical (${industry}): +10`);
    }
  } else {
    breakdown.push('Industry unknown: +0');
  }

  // Factor 2: Company size (0-20 points)
  const employees = data.company.employee_count;
  if (employees) {
    if (employees >= 10000) {
      score += 15;
      breakdown.push(`Large enterprise (${employees.toLocaleString()} employees): +15`);
    } else if (employees >= 1000) {
      score += 20;
      breakdown.push(`Mid-market sweet spot (${employees.toLocaleString()} employees): +20`);
    } else if (employees >= 100) {
      score += 10;
      breakdown.push(`SMB (${employees.toLocaleString()} employees): +10`);
    } else {
      score += 5;
      breakdown.push(`Small company (${employees} employees): +5`);
    }
  } else {
    breakdown.push('Employee count unknown: +0');
  }

  // Factor 3: Geography (0-15 points)
  const country = data.company.headquarters_country;
  if (country) {
    if (['US', 'CA', 'GB', 'FR', 'DE', 'NL', 'SE', 'NO', 'DK', 'CH'].includes(country)) {
      score += 15;
      breakdown.push(`Prime geography (${country}): +15`);
    } else {
      score += 10;
      breakdown.push(`Other geography (${country}): +10`);
    }
  } else {
    breakdown.push('Geography unknown: +0');
  }

  // Factor 4: Public vs Private (0-15 points)
  if (data.company.is_public) {
    score += 15;
    breakdown.push(`Public company (${data.company.stock_ticker || 'N/A'}): +15`);
  } else {
    score += 10;
    breakdown.push('Private company: +10');
  }

  // Factor 5: Revenue range (0-20 points)
  const revenue = data.company.annual_revenue;
  if (revenue) {
    if (revenue >= 1_000_000_000) {
      score += 20;
      breakdown.push(`Enterprise revenue (${(revenue / 1e9).toFixed(1)}B): +20`);
    } else if (revenue >= 100_000_000) {
      score += 15;
      breakdown.push(`Mid-market revenue (${(revenue / 1e6).toFixed(0)}M): +15`);
    } else if (revenue >= 10_000_000) {
      score += 10;
      breakdown.push(`SMB revenue (${(revenue / 1e6).toFixed(0)}M): +10`);
    } else {
      score += 5;
      breakdown.push(`Small revenue (<10M): +5`);
    }
  } else {
    breakdown.push('Revenue unknown: +0');
  }

  return { score: clampScore(score), breakdown };
}

/**
 * Calculate Intent Score (0-100)
 *
 * Measures buying signals and urgency.
 *
 * Factors:
 * - Monthly traffic >1M visits (+20)
 * - Traffic growth trend (YoY >20%: +15)
 * - Hiring for search/engineering roles (+15)
 * - High bounce rate >60% (+10, indicates search problems)
 * - Executive quotes mentioning search/experience (+20)
 * - Intent signals from Apollo (+20)
 *
 * Weight: 25% of overall score
 */
export function calculateIntentScore(data: EnrichmentData): { score: number; breakdown: string[] } {
  let score = 0;
  const breakdown: string[] = [];

  // Factor 1: Monthly traffic (0-20 points)
  const visits = data.traffic?.monthly_visits;
  if (visits) {
    if (visits >= 10_000_000) {
      score += 20;
      breakdown.push(`High traffic (${(visits / 1e6).toFixed(1)}M visits/month): +20`);
    } else if (visits >= 1_000_000) {
      score += 15;
      breakdown.push(`Good traffic (${(visits / 1e6).toFixed(1)}M visits/month): +15`);
    } else if (visits >= 100_000) {
      score += 10;
      breakdown.push(`Moderate traffic (${(visits / 1e3).toFixed(0)}K visits/month): +10`);
    } else {
      score += 5;
      breakdown.push(`Low traffic (<100K visits/month): +5`);
    }
  } else {
    breakdown.push('Traffic data unavailable: +0');
  }

  // Factor 2: Traffic growth (0-15 points)
  const growth = calculateTrafficGrowth(data);
  if (growth > 20) {
    score += 15;
    breakdown.push(`Strong growth (${growth.toFixed(1)}% YoY): +15`);
  } else if (growth > 10) {
    score += 10;
    breakdown.push(`Moderate growth (${growth.toFixed(1)}% YoY): +10`);
  } else if (growth > 0) {
    score += 5;
    breakdown.push(`Positive growth (${growth.toFixed(1)}% YoY): +5`);
  } else if (growth < 0) {
    breakdown.push(`Declining traffic (${growth.toFixed(1)}% YoY): +0`);
  } else {
    breakdown.push('Traffic growth data unavailable: +0');
  }

  // Factor 3: Hiring signals (0-15 points)
  const hiringCount = countHiringRoles(data.hiring);
  if (hiringCount >= 5) {
    score += 15;
    breakdown.push(`Active hiring (${hiringCount} search/eng roles): +15`);
  } else if (hiringCount >= 2) {
    score += 10;
    breakdown.push(`Some hiring (${hiringCount} search/eng roles): +10`);
  } else if (hiringCount === 1) {
    score += 5;
    breakdown.push(`1 search/eng role: +5`);
  } else {
    breakdown.push('No search/eng hiring: +0');
  }

  // Factor 4: High bounce rate (indicates search problems) (0-10 points)
  const bounceRate = data.traffic?.bounce_rate;
  if (bounceRate) {
    if (bounceRate >= 70) {
      score += 10;
      breakdown.push(`Very high bounce rate (${bounceRate.toFixed(1)}%): +10`);
    } else if (bounceRate >= 60) {
      score += 8;
      breakdown.push(`High bounce rate (${bounceRate.toFixed(1)}%): +8`);
    } else if (bounceRate >= 50) {
      score += 5;
      breakdown.push(`Moderate bounce rate (${bounceRate.toFixed(1)}%): +5`);
    } else {
      breakdown.push(`Low bounce rate (${bounceRate.toFixed(1)}%): +0`);
    }
  } else {
    breakdown.push('Bounce rate unavailable: +0');
  }

  // Factor 5: Executive quotes about search/experience (0-20 points)
  const hasQuotes = hasSearchQuotes(data.quotes);
  if (hasQuotes) {
    score += 20;
    breakdown.push('Executives discussing search/CX: +20');
  } else if (data.quotes && data.quotes.length > 0) {
    breakdown.push('Executive quotes available (no search mentions): +0');
  } else {
    breakdown.push('No executive quotes: +0');
  }

  // Factor 6: Apollo intent signals (0-20 points)
  if (data.intent_signals && data.intent_signals.length > 0) {
    const avgConfidence = data.intent_signals.reduce((sum, sig) => sum + (sig.confidence_score || 0), 0) / data.intent_signals.length;
    if (avgConfidence >= 80) {
      score += 20;
      breakdown.push(`Strong intent signals (${data.intent_signals.length} signals, ${avgConfidence.toFixed(0)}% confidence): +20`);
    } else if (avgConfidence >= 50) {
      score += 15;
      breakdown.push(`Moderate intent signals (${data.intent_signals.length} signals, ${avgConfidence.toFixed(0)}% confidence): +15`);
    } else {
      score += 10;
      breakdown.push(`Weak intent signals (${data.intent_signals.length} signals, ${avgConfidence.toFixed(0)}% confidence): +10`);
    }
  } else {
    breakdown.push('No Apollo intent signals: +0');
  }

  return { score: clampScore(score), breakdown };
}

/**
 * Calculate Value Score (0-100)
 *
 * Measures deal size and financial health.
 *
 * Factors:
 * - Annual revenue >$500M (+20)
 * - Revenue growth >15% YoY (+15)
 * - Strong margins (>20%: +15)
 * - Positive free cash flow (+15)
 * - High traffic * engagement (proxy for contract value) (+20)
 * - Public company with strong financials (+15)
 *
 * Weight: 25% of overall score
 */
export function calculateValueScore(data: EnrichmentData): { score: number; breakdown: string[] } {
  let score = 0;
  const breakdown: string[] = [];

  // Factor 1: Annual revenue (0-20 points)
  const revenue = data.company.annual_revenue;
  if (revenue) {
    if (revenue >= 1_000_000_000) {
      score += 20;
      breakdown.push(`Enterprise revenue (${(revenue / 1e9).toFixed(1)}B): +20`);
    } else if (revenue >= 500_000_000) {
      score += 18;
      breakdown.push(`Large revenue (${(revenue / 1e6).toFixed(0)}M): +18`);
    } else if (revenue >= 100_000_000) {
      score += 15;
      breakdown.push(`Mid-market revenue (${(revenue / 1e6).toFixed(0)}M): +15`);
    } else {
      score += 10;
      breakdown.push(`SMB revenue (${(revenue / 1e6).toFixed(0)}M): +10`);
    }
  } else {
    breakdown.push('Revenue unknown: +0');
  }

  // Factor 2: Revenue growth (0-15 points)
  const revenueGrowth = calculateRevenueGrowth(data);
  if (revenueGrowth >= 25) {
    score += 15;
    breakdown.push(`Strong revenue growth (${revenueGrowth.toFixed(1)}% YoY): +15`);
  } else if (revenueGrowth >= 15) {
    score += 12;
    breakdown.push(`Good revenue growth (${revenueGrowth.toFixed(1)}% YoY): +12`);
  } else if (revenueGrowth >= 5) {
    score += 8;
    breakdown.push(`Modest revenue growth (${revenueGrowth.toFixed(1)}% YoY): +8`);
  } else if (revenueGrowth > 0) {
    score += 5;
    breakdown.push(`Positive revenue growth (${revenueGrowth.toFixed(1)}% YoY): +5`);
  } else {
    breakdown.push('Revenue growth unavailable or negative: +0');
  }

  // Factor 3: Profit margins (0-15 points)
  const margin = data.financials?.margin;
  if (margin) {
    if (margin >= 30) {
      score += 15;
      breakdown.push(`Excellent margins (${margin.toFixed(1)}%): +15`);
    } else if (margin >= 20) {
      score += 12;
      breakdown.push(`Strong margins (${margin.toFixed(1)}%): +12`);
    } else if (margin >= 10) {
      score += 8;
      breakdown.push(`Healthy margins (${margin.toFixed(1)}%): +8`);
    } else if (margin > 0) {
      score += 5;
      breakdown.push(`Positive margins (${margin.toFixed(1)}%): +5`);
    } else {
      breakdown.push(`Negative margins (${margin.toFixed(1)}%): +0`);
    }
  } else {
    breakdown.push('Margin data unavailable: +0');
  }

  // Factor 4: Free cash flow (0-15 points)
  const fcf = data.financials?.free_cash_flow;
  if (fcf !== undefined) {
    if (fcf > 100_000_000) {
      score += 15;
      breakdown.push(`Strong FCF (${(fcf / 1e6).toFixed(0)}M): +15`);
    } else if (fcf > 10_000_000) {
      score += 12;
      breakdown.push(`Positive FCF (${(fcf / 1e6).toFixed(0)}M): +12`);
    } else if (fcf > 0) {
      score += 8;
      breakdown.push(`Modest FCF: +8`);
    } else {
      breakdown.push(`Negative FCF: +0`);
    }
  } else {
    breakdown.push('FCF data unavailable: +0');
  }

  // Factor 5: Traffic * engagement (proxy for contract value) (0-20 points)
  const visits = data.traffic?.monthly_visits;
  const duration = data.traffic?.avg_visit_duration;
  if (visits && duration) {
    const engagement = (visits / 1_000_000) * (duration / 60); // Millions of visitor-minutes per month
    if (engagement >= 100) {
      score += 20;
      breakdown.push(`Very high engagement (${engagement.toFixed(0)}M visitor-min/mo): +20`);
    } else if (engagement >= 50) {
      score += 15;
      breakdown.push(`High engagement (${engagement.toFixed(0)}M visitor-min/mo): +15`);
    } else if (engagement >= 10) {
      score += 10;
      breakdown.push(`Good engagement (${engagement.toFixed(0)}M visitor-min/mo): +10`);
    } else {
      score += 5;
      breakdown.push(`Moderate engagement: +5`);
    }
  } else {
    breakdown.push('Engagement data unavailable: +0');
  }

  // Factor 6: Public company with strong financials (0-15 points)
  if (data.company.is_public && revenue && revenue >= 100_000_000) {
    score += 15;
    breakdown.push('Public company with strong financials: +15');
  } else if (data.company.is_public) {
    score += 10;
    breakdown.push('Public company: +10');
  } else {
    breakdown.push('Private company: +0');
  }

  return { score: clampScore(score), breakdown };
}

/**
 * Calculate Displacement Score (0-100)
 *
 * Measures opportunity to displace incumbent search provider.
 *
 * Factors:
 * - Uses partner technology (Adobe AEM, Amplience, etc.) (+25)
 * - Current search provider is displaceable (Elasticsearch, Solr) (+20)
 * - No Algolia in tech stack (+25, otherwise 0)
 * - High e-commerce component (+15)
 * - Poor search experience (high bounce, low engagement) (+10)
 * - Competitor using Algolia (+5, proof of value)
 *
 * Weight: 25% of overall score
 */
export function calculateDisplacementScore(data: EnrichmentData): { score: number; breakdown: string[] } {
  let score = 0;
  const breakdown: string[] = [];

  // Factor 1: Partner technology (0-25 points)
  const hasPartnerTech = hasPartnerTechnology(data.technologies);
  if (hasPartnerTech) {
    score += 25;
    breakdown.push('Uses partner technology (Adobe/Amplience/etc.): +25');
  } else {
    breakdown.push('No partner technology detected: +0');
  }

  // Factor 2: Displaceable search provider (0-20 points)
  const searchProvider = getCurrentSearchProvider(data.technologies);
  if (searchProvider) {
    score += 20;
    breakdown.push(`Using displaceable search (${searchProvider}): +20`);
  } else {
    breakdown.push('No displaceable search provider detected: +0');
  }

  // Factor 3: No Algolia (0-25 points or DISQUALIFIER)
  const alreadyHasAlgolia = hasAlgolia(data.technologies);
  if (!alreadyHasAlgolia) {
    score += 25;
    breakdown.push('No Algolia in tech stack (opportunity): +25');
  } else {
    // CRITICAL: If they already have Algolia, this is NOT a displacement opportunity
    score = 0;
    breakdown.push('Already using Algolia (NOT a displacement opportunity): DISQUALIFIED');
    return { score: 0, breakdown };
  }

  // Factor 4: High e-commerce component (0-15 points)
  const industry = extractIndustry(data);
  const isEcommerce =
    industry &&
    (industry.toLowerCase().includes('ecommerce') ||
      industry.toLowerCase().includes('e-commerce') ||
      industry.toLowerCase().includes('retail'));
  if (isEcommerce) {
    score += 15;
    breakdown.push(`E-commerce company (${industry}): +15`);
  } else {
    breakdown.push('Not e-commerce focused: +0');
  }

  // Factor 5: Poor search experience signals (0-10 points)
  const bounceRate = data.traffic?.bounce_rate;
  const duration = data.traffic?.avg_visit_duration;
  let poorExperienceCount = 0;
  if (bounceRate && bounceRate >= 60) {
    poorExperienceCount++;
    breakdown.push(`High bounce rate (${bounceRate.toFixed(1)}%): indicates search problems`);
  }
  if (duration && duration < 120) {
    poorExperienceCount++;
    breakdown.push(`Low engagement (${duration}s avg): indicates poor discovery`);
  }
  if (poorExperienceCount >= 2) {
    score += 10;
    breakdown.push('Multiple poor experience signals: +10');
  } else if (poorExperienceCount === 1) {
    score += 5;
    breakdown.push('Some poor experience signals: +5');
  } else {
    breakdown.push('No clear search problems: +0');
  }

  // Factor 6: Competitor using Algolia (0-5 points - proof of value)
  const compUsesAlgolia = competitorUsesAlgolia(data.competitors);
  if (compUsesAlgolia) {
    score += 5;
    breakdown.push('Competitor using Algolia (proof of value): +5');
  } else {
    breakdown.push('Competitors not using Algolia: +0');
  }

  return { score: clampScore(score), breakdown };
}

/**
 * Calculate Overall Score (0-100)
 *
 * Weighted average of all four dimensions.
 * Each dimension contributes 25% to overall score.
 */
export function calculateOverallScore(fit: number, intent: number, value: number, displacement: number): number {
  const overall = fit * 0.25 + intent * 0.25 + value * 0.25 + displacement * 0.25;
  return clampScore(overall);
}

/**
 * Determine status from overall score
 */
export function getStatusFromScore(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// =============================================================================
// MASTER SCORING METHOD
// =============================================================================

/**
 * Calculate composite scores for a company audit
 *
 * @param companyId - Company UUID
 * @param auditId - Audit UUID
 * @param enrichmentData - Aggregated enrichment data from all tables
 * @returns Composite scores with breakdown
 */
export async function calculateCompositeScores(
  companyId: string,
  auditId: string,
  enrichmentData: EnrichmentData
): Promise<CompositeScores> {
  logger.info('Calculating composite scores', { companyId, auditId });

  // Calculate each dimension
  const fit = calculateFitScore(enrichmentData);
  const intent = calculateIntentScore(enrichmentData);
  const value = calculateValueScore(enrichmentData);
  const displacement = calculateDisplacementScore(enrichmentData);

  // Calculate overall score
  const overallScore = calculateOverallScore(fit.score, intent.score, value.score, displacement.score);
  const status = getStatusFromScore(overallScore);

  logger.info('Scores calculated', {
    companyId,
    auditId,
    fit: fit.score,
    intent: intent.score,
    value: value.score,
    displacement: displacement.score,
    overall: overallScore,
    status,
  });

  // Persist scores to audits table
  await updateAuditScores(auditId, {
    fit_score: fit.score,
    intent_score: intent.score,
    value_score: value.score,
    displacement_score: displacement.score,
    overall_score: overallScore,
  });

  return {
    fitScore: fit.score,
    intentScore: intent.score,
    valueScore: value.score,
    displacementScore: displacement.score,
    overallScore,
    status,
    breakdown: {
      fit: fit.breakdown,
      intent: intent.breakdown,
      value: value.breakdown,
      displacement: displacement.breakdown,
    },
  };
}

/**
 * Update audit scores in database
 */
async function updateAuditScores(
  auditId: string,
  scores: {
    fit_score: number;
    intent_score: number;
    value_score: number;
    displacement_score: number;
    overall_score: number;
  }
): Promise<void> {
  const db = new SupabaseClient();

  try {
    await db.update('audits', auditId, scores);
    logger.info('Audit scores persisted', { auditId, scores });
  } catch (error) {
    logger.error('Failed to persist audit scores', { auditId, error });
    throw error;
  }
}

/**
 * Fetch enrichment data from database
 *
 * Aggregates data from all enrichment tables for scoring.
 *
 * @param companyId - Company UUID
 * @param auditId - Audit UUID
 * @returns Enrichment data object
 */
export async function fetchEnrichmentData(companyId: string, auditId: string): Promise<EnrichmentData> {
  const db = new SupabaseClient();

  // Fetch company attributes
  const company = await db.query<any>('companies', { id: companyId });
  if (!company || company.length === 0) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Fetch latest traffic data (most recent month)
  const traffic = await db.query<any>(
    'company_traffic',
    { company_id: companyId, audit_id: auditId, order: 'month', limit: 1 }
  );

  // Fetch latest financials (most recent year)
  const financials = await db.query<any>(
    'company_financials',
    { company_id: companyId, audit_id: auditId, order: 'fiscal_year', limit: 1 }
  );

  // Fetch technologies
  const technologies = await db.query<any>('company_technologies', { company_id: companyId, audit_id: auditId });

  // Fetch competitors
  const competitors = await db.query<any>('company_competitors', { company_id: companyId, audit_id: auditId });

  // Fetch executives
  const executives = await db.query<any>('company_executives', { company_id: companyId, audit_id: auditId });

  // Fetch executive quotes
  const quotes = await db.query<any>('executive_quotes', { company_id: companyId, audit_id: auditId });

  // Fetch hiring data
  const hiring = await db.query<any>('company_hiring', { company_id: companyId, audit_id: auditId });

  // Fetch intent signals
  const intent_signals = await db.query<any>('intent_signals', { company_id: companyId, audit_id: auditId });

  // Build enrichment data object
  const data: EnrichmentData = {
    company: company[0],
    traffic: traffic && traffic.length > 0 ? traffic[0] : undefined,
    financials:
      financials && financials.length > 0
        ? {
            revenue: financials[0].revenue,
            revenue_growth: financials[0].revenue_growth,
            gross_profit: financials[0].gross_profit,
            net_income: financials[0].net_income,
            free_cash_flow: financials[0].free_cash_flow,
            margin: financials[0].net_income && financials[0].revenue ? (financials[0].net_income / financials[0].revenue) * 100 : undefined,
          }
        : undefined,
    technologies: technologies || [],
    competitors: competitors || [],
    executives: executives || [],
    quotes: quotes || [],
    hiring: hiring || [],
    intent_signals: intent_signals || [],
  };

  return data;
}
