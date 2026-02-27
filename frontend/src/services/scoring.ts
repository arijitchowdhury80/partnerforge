/**
 * Composite Scoring Service v2
 *
 * Multi-factor scoring system for company prioritization.
 * Enhanced to use v3 enrichment data from all sources:
 * - SimilarWeb: Traffic, engagement, competitors
 * - BuiltWith: Tech stack, search provider
 * - Yahoo Finance: Financials, analyst sentiment
 * - SEC EDGAR: Risk factors, digital mentions
 * - JSearch: Hiring signals
 * - WebSearch: Executive quotes
 *
 * Factors (25% each):
 * - Fit: How well they match ICP criteria
 * - Intent: Buying signals and readiness (includes hiring!)
 * - Value: Deal potential and size (includes financial health!)
 * - Displacement: Ease of converting from current provider
 */

import type { Company, CompositeScore, DetailedScoreBreakdown } from '@/types';

// =============================================================================
// Factor Weights (must sum to 1.0)
// =============================================================================

const WEIGHTS = {
  fit: 0.25,
  intent: 0.25,
  value: 0.25,
  displacement: 0.25,
} as const;

// =============================================================================
// Scoring Thresholds
// =============================================================================

// Traffic tiers (monthly visits)
const TRAFFIC_TIERS = {
  excellent: 10_000_000,  // 10M+
  great: 1_000_000,       // 1M+
  good: 100_000,          // 100K+
  okay: 10_000,           // 10K+
};

// Revenue tiers (annual USD)
const REVENUE_TIERS = {
  enterprise: 1_000_000_000,  // $1B+
  large: 100_000_000,         // $100M+
  mid: 10_000_000,            // $10M+
  small: 1_000_000,           // $1M+
};

// Employee count tiers
const EMPLOYEE_TIERS = {
  enterprise: 10_000,
  large: 1_000,
  mid: 100,
  small: 10,
};

// High-value verticals for Algolia
const HIGH_VALUE_VERTICALS = [
  'retail', 'ecommerce', 'e-commerce', 'marketplace',
  'media', 'publishing', 'entertainment',
  'saas', 'technology', 'software',
];

const MEDIUM_VALUE_VERTICALS = [
  'finance', 'financial services', 'banking',
  'healthcare', 'travel', 'hospitality',
  'education', 'edtech',
];

// Partner tech with weak search (easier displacement)
const WEAK_SEARCH_PARTNERS = [
  'adobe experience manager', 'aem', 'amplience', 'contentful',
  'sitecore', 'wordpress', 'drupal', 'magento',
];

// Partner tech with strong native search (harder displacement)
const STRONG_SEARCH_PARTNERS = [
  'shopify', 'salesforce commerce cloud', 'commercetools',
  'bigcommerce', 'elasticsearch',
];

// =============================================================================
// Main Scoring Function
// =============================================================================

export function calculateCompositeScore(company: Company): CompositeScore {
  const fitScore = calculateFitScore(company);
  const intentScore = calculateIntentScore(company);
  const valueScore = calculateValueScore(company);
  const displacementScore = calculateDisplacementScore(company);

  const total = Math.round(
    fitScore.score * WEIGHTS.fit +
    intentScore.score * WEIGHTS.intent +
    valueScore.score * WEIGHTS.value +
    displacementScore.score * WEIGHTS.displacement
  );

  const dataCompleteness = calculateDataCompleteness(company);
  const confidence = dataCompleteness >= 70 ? 'high' : dataCompleteness >= 40 ? 'medium' : 'low';

  return {
    total,
    factors: {
      fit: fitScore.score,
      intent: intentScore.score,
      value: valueScore.score,
      displacement: displacementScore.score,
    },
    confidence,
    dataCompleteness,
  };
}

// =============================================================================
// FIT Factor (25%)
// =============================================================================

function calculateFitScore(company: Company): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  // Vertical fit (0-40 points)
  const vertical = company.vertical?.toLowerCase() || '';
  if (HIGH_VALUE_VERTICALS.some(v => vertical.includes(v))) {
    score += 40;
    signals.push(`High-value vertical: ${company.vertical}`);
  } else if (MEDIUM_VALUE_VERTICALS.some(v => vertical.includes(v))) {
    score += 25;
    signals.push(`Medium-value vertical: ${company.vertical}`);
  } else if (vertical) {
    score += 10;
    signals.push(`Other vertical: ${company.vertical}`);
  }

  // Company size fit (0-30 points)
  const employees = company.employee_count || 0;
  if (employees >= EMPLOYEE_TIERS.enterprise) {
    score += 30;
    signals.push(`Enterprise: ${formatNumber(employees)} employees`);
  } else if (employees >= EMPLOYEE_TIERS.large) {
    score += 25;
    signals.push(`Large: ${formatNumber(employees)} employees`);
  } else if (employees >= EMPLOYEE_TIERS.mid) {
    score += 15;
    signals.push(`Mid-market: ${formatNumber(employees)} employees`);
  } else if (employees >= EMPLOYEE_TIERS.small) {
    score += 5;
    signals.push(`Small: ${formatNumber(employees)} employees`);
  }

  // Geographic fit (0-20 points)
  const country = company.headquarters?.country?.toLowerCase() || '';
  if (['united states', 'us', 'usa'].includes(country)) {
    score += 20;
    signals.push('US headquarters');
  } else if (['united kingdom', 'uk', 'germany', 'france', 'canada', 'australia'].includes(country)) {
    score += 15;
    signals.push(`Tier 1 geography: ${company.headquarters?.country}`);
  } else if (country) {
    score += 5;
    signals.push(`Other geography: ${company.headquarters?.country}`);
  }

  // Public company bonus (0-10 points)
  if (company.is_public) {
    score += 10;
    signals.push('Public company');
  }

  return { score: Math.min(100, score), signals };
}

// =============================================================================
// INTENT Factor (25%) - Enhanced with hiring signals!
// =============================================================================

function calculateIntentScore(company: Company): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  // Traffic = active digital presence (0-20 points)
  const monthlyVisits = company.sw_monthly_visits || 0;
  if (monthlyVisits >= TRAFFIC_TIERS.excellent) {
    score += 20;
    signals.push('Very high traffic (needs scalable search)');
  } else if (monthlyVisits >= TRAFFIC_TIERS.great) {
    score += 15;
    signals.push('High traffic volume');
  } else if (monthlyVisits >= TRAFFIC_TIERS.good) {
    score += 10;
    signals.push('Solid traffic base');
  }

  // Content platform = search pain (0-20 points)
  const partnerTech = company.partner_tech?.map(t => t.toLowerCase()) || [];
  const hasContentPlatform = partnerTech.some(t =>
    WEAK_SEARCH_PARTNERS.some(w => t.includes(w))
  );
  if (hasContentPlatform) {
    score += 20;
    signals.push('Uses content platform with weak native search');
  }

  // *** NEW: Hiring signals from JSearch (0-25 points) ***
  const hiringScore = company.hiring_signal_score || 0;
  const hiringStrength = company.hiring_signal_strength;

  if (hiringStrength === 'strong' || hiringScore >= 70) {
    score += 25;
    signals.push(`Strong hiring signal (score: ${hiringScore})`);
  } else if (hiringStrength === 'moderate' || hiringScore >= 40) {
    score += 15;
    signals.push(`Moderate hiring signal (score: ${hiringScore})`);
  } else if (hiringStrength === 'weak' || hiringScore >= 15) {
    score += 5;
    signals.push(`Weak hiring signal (score: ${hiringScore})`);
  }

  // Hiring for search-specific roles (0-10 bonus)
  if (company.hiring_has_search_roles) {
    score += 10;
    signals.push('Hiring for search/discovery roles');
  }

  // Hiring for e-commerce roles (0-5 bonus)
  if (company.hiring_has_ecommerce_roles) {
    score += 5;
    signals.push('Hiring for e-commerce roles');
  }

  // *** NEW: SEC risk factors mentioning tech/digital (0-10 points) ***
  if (company.has_tech_risk_factors) {
    score += 10;
    signals.push('SEC filings mention technology risks');
  }
  if (company.has_digital_mentions) {
    score += 5;
    signals.push('SEC filings mention digital transformation');
  }

  // Executive quotes (0-10 points)
  if (company.exec_quote) {
    score += 10;
    signals.push('Executive quote captured');
  }
  if (company.exec_quotes_count && company.exec_quotes_count > 1) {
    score += 5;
    signals.push(`${company.exec_quotes_count} exec quotes found`);
  }

  return { score: Math.min(100, score), signals };
}

// =============================================================================
// VALUE Factor (25%) - Enhanced with financial health!
// =============================================================================

function calculateValueScore(company: Company): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  // Revenue potential (0-35 points)
  const revenue = company.revenue || 0;
  if (revenue >= REVENUE_TIERS.enterprise) {
    score += 35;
    signals.push(`Enterprise revenue: ${formatCurrency(revenue)}`);
  } else if (revenue >= REVENUE_TIERS.large) {
    score += 25;
    signals.push(`Large revenue: ${formatCurrency(revenue)}`);
  } else if (revenue >= REVENUE_TIERS.mid) {
    score += 15;
    signals.push(`Mid-market revenue: ${formatCurrency(revenue)}`);
  } else if (revenue >= REVENUE_TIERS.small) {
    score += 8;
    signals.push(`Small revenue: ${formatCurrency(revenue)}`);
  }

  // Traffic volume = search volume proxy (0-20 points)
  const monthlyVisits = company.sw_monthly_visits || 0;
  if (monthlyVisits >= TRAFFIC_TIERS.excellent) {
    score += 20;
    signals.push(`${formatNumber(monthlyVisits)} visits = high search volume`);
  } else if (monthlyVisits >= TRAFFIC_TIERS.great) {
    score += 15;
    signals.push(`${formatNumber(monthlyVisits)} monthly visits`);
  } else if (monthlyVisits >= TRAFFIC_TIERS.good) {
    score += 8;
    signals.push(`${formatNumber(monthlyVisits)} monthly visits`);
  }

  // *** NEW: Revenue growth from Yahoo Finance (0-15 points) ***
  const revenueGrowth = company.revenue_growth || 0;
  if (revenueGrowth >= 0.20) {
    score += 15;
    signals.push(`High revenue growth: ${(revenueGrowth * 100).toFixed(0)}%`);
  } else if (revenueGrowth >= 0.10) {
    score += 10;
    signals.push(`Solid growth: ${(revenueGrowth * 100).toFixed(0)}%`);
  } else if (revenueGrowth >= 0.05) {
    score += 5;
    signals.push(`Moderate growth: ${(revenueGrowth * 100).toFixed(0)}%`);
  }

  // *** NEW: Analyst sentiment from Yahoo Finance (0-10 points) ***
  if (company.analyst_rating) {
    const { buy, hold, sell } = company.analyst_rating;
    const total = buy + hold + sell;
    if (total > 0) {
      const buyPct = buy / total;
      if (buyPct >= 0.7) {
        score += 10;
        signals.push(`Strong buy consensus (${Math.round(buyPct * 100)}% buy)`);
      } else if (buyPct >= 0.5) {
        score += 5;
        signals.push('Positive analyst sentiment');
      }
    }
  }

  // *** NEW: Profit margins = healthy business (0-10 points) ***
  const profitMargins = company.profit_margins || 0;
  if (profitMargins >= 0.15) {
    score += 10;
    signals.push(`Strong margins: ${(profitMargins * 100).toFixed(0)}%`);
  } else if (profitMargins >= 0.05) {
    score += 5;
    signals.push(`Healthy margins: ${(profitMargins * 100).toFixed(0)}%`);
  }

  // Multi-site potential (0-10 points)
  if (company.store_count && company.store_count > 100) {
    score += 10;
    signals.push(`${company.store_count} stores = multi-site potential`);
  } else if (company.store_count && company.store_count > 10) {
    score += 5;
    signals.push(`${company.store_count} stores`);
  }

  return { score: Math.min(100, score), signals };
}

// =============================================================================
// DISPLACEMENT Factor (25%) - Enhanced with competitor analysis!
// =============================================================================

function calculateDisplacementScore(company: Company): { score: number; signals: string[] } {
  let score = 50; // Start at neutral
  const signals: string[] = [];

  const partnerTech = company.partner_tech?.map(t => t.toLowerCase()) || [];
  const currentSearch = company.current_search?.toLowerCase() || '';

  // Current search provider analysis (major impact)
  if (currentSearch === 'none' || !currentSearch) {
    score += 25;
    signals.push('No detected search provider (greenfield)');
  } else if (currentSearch === 'elasticsearch' || currentSearch === 'solr') {
    score += 20;
    signals.push('Uses open-source search (maintainability pain)');
  } else if (currentSearch === 'algolia') {
    score -= 50;
    signals.push('Already using Algolia');
  } else if (['google custom search', 'swiftype', 'searchspring', 'klevu'].includes(currentSearch)) {
    score += 15;
    signals.push(`Displaceable provider: ${company.current_search}`);
  } else if (['coveo', 'bloomreach', 'constructor'].some(c => currentSearch.includes(c))) {
    score += 5;
    signals.push(`Competitor provider: ${company.current_search}`);
  }

  // Partner tech assessment
  const hasWeakSearchPartner = partnerTech.some(t =>
    WEAK_SEARCH_PARTNERS.some(w => t.includes(w))
  );
  const hasStrongSearchPartner = partnerTech.some(t =>
    STRONG_SEARCH_PARTNERS.some(w => t.includes(w))
  );

  if (hasWeakSearchPartner && !hasStrongSearchPartner) {
    score += 15;
    signals.push('Partner platform has weak native search');
  } else if (hasStrongSearchPartner) {
    score -= 10;
    signals.push('Partner platform has native search');
  }

  // *** NEW: Similar sites / competitor analysis (0-5 points) ***
  if (company.similar_sites && company.similar_sites.length > 0) {
    signals.push(`${company.similar_sites.length} similar sites identified`);
  }

  // Competitor intelligence (existing)
  if (company.competitor_data?.competitors) {
    const competitorsUsingAlgolia = company.competitor_data.competitors.filter(c => c.using_algolia);
    if (competitorsUsingAlgolia.length >= 3) {
      score += 15;
      signals.push(`${competitorsUsingAlgolia.length} competitors using Algolia (strong proof)`);
    } else if (competitorsUsingAlgolia.length > 0) {
      score += 10;
      signals.push(`${competitorsUsingAlgolia.length} competitor(s) using Algolia`);
    }
  }

  // *** NEW: Engagement quality from SimilarWeb (0-10 points) ***
  // High bounce rate = poor user experience = search opportunity
  const bounceRate = company.sw_bounce_rate || 0;
  if (bounceRate >= 0.6) {
    score += 10;
    signals.push(`High bounce rate (${(bounceRate * 100).toFixed(0)}%) = UX opportunity`);
  } else if (bounceRate >= 0.45) {
    score += 5;
    signals.push(`Moderate bounce rate (${(bounceRate * 100).toFixed(0)}%)`);
  }

  return { score: Math.max(0, Math.min(100, score)), signals };
}

// =============================================================================
// Data Completeness - Enhanced for v3 sources
// =============================================================================

function calculateDataCompleteness(company: Company): number {
  const dataPoints = [
    // Basic info
    company.company_name,
    company.domain,
    company.vertical,
    company.industry,
    company.headquarters?.country,

    // SimilarWeb
    company.sw_monthly_visits,
    company.sw_bounce_rate,
    company.similar_sites?.length,

    // BuiltWith
    company.partner_tech?.length,
    company.current_search,
    company.tech_stack_data,

    // Yahoo Finance
    company.revenue,
    company.revenue_growth,
    company.profit_margins,
    company.analyst_rating,

    // SEC EDGAR
    company.has_tech_risk_factors !== undefined,
    company.has_digital_mentions !== undefined,

    // JSearch (hiring)
    company.hiring_signal_score !== undefined,
    company.hiring_signal_strength,

    // WebSearch (exec quotes)
    company.exec_quote,

    // Derived
    company.competitor_data,
    company.is_public !== undefined,
    company.employee_count,
  ];

  const available = dataPoints.filter(Boolean).length;
  return Math.round((available / dataPoints.length) * 100);
}

// =============================================================================
// Detailed Breakdown (for UI display)
// =============================================================================

export function getDetailedBreakdown(company: Company): DetailedScoreBreakdown {
  const fit = calculateFitScore(company);
  const intent = calculateIntentScore(company);
  const value = calculateValueScore(company);
  const displacement = calculateDisplacementScore(company);

  return {
    fit: {
      name: 'ICP Fit',
      weight: WEIGHTS.fit * 100,
      score: fit.score,
      maxScore: 100,
      signals: fit.signals,
    },
    intent: {
      name: 'Buying Intent',
      weight: WEIGHTS.intent * 100,
      score: intent.score,
      maxScore: 100,
      signals: intent.signals,
    },
    value: {
      name: 'Deal Value',
      weight: WEIGHTS.value * 100,
      score: value.score,
      maxScore: 100,
      signals: value.signals,
    },
    displacement: {
      name: 'Displacement',
      weight: WEIGHTS.displacement * 100,
      score: displacement.score,
      maxScore: 100,
      signals: displacement.signals,
    },
  };
}

// =============================================================================
// Status from Composite Score
// =============================================================================

export function getStatusFromCompositeScore(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// =============================================================================
// Helpers
// =============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
