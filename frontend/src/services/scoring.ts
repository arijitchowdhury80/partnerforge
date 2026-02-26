/**
 * Composite Scoring Service
 *
 * Multi-factor scoring system for company prioritization.
 * Replaces simple ICP score with a weighted composite of:
 * - Fit (25%): How well they match ICP criteria
 * - Intent (25%): Buying signals and readiness
 * - Value (25%): Deal potential and size
 * - Displacement (25%): Ease of converting from current provider
 */

import type { Company, CompositeScore, DetailedScoreBreakdown, ScoringFactorDetail } from '@/types';

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
// Individual Factor Calculations
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
    signals.push(`Enterprise size: ${formatNumber(employees)} employees`);
  } else if (employees >= EMPLOYEE_TIERS.large) {
    score += 25;
    signals.push(`Large company: ${formatNumber(employees)} employees`);
  } else if (employees >= EMPLOYEE_TIERS.mid) {
    score += 15;
    signals.push(`Mid-market: ${formatNumber(employees)} employees`);
  } else if (employees >= EMPLOYEE_TIERS.small) {
    score += 5;
    signals.push(`Small company: ${formatNumber(employees)} employees`);
  }

  // Geographic fit (0-20 points) - US/UK/EU preferred
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
    signals.push('Public company (accountable spend)');
  }

  return { score: Math.min(100, score), signals };
}

function calculateIntentScore(company: Company): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  // Traffic growth signals (0-30 points)
  const monthlyVisits = company.sw_monthly_visits || 0;
  if (monthlyVisits >= TRAFFIC_TIERS.excellent) {
    score += 30;
    signals.push('Very high traffic (need scalable search)');
  } else if (monthlyVisits >= TRAFFIC_TIERS.great) {
    score += 25;
    signals.push('High traffic volume');
  } else if (monthlyVisits >= TRAFFIC_TIERS.good) {
    score += 15;
    signals.push('Solid traffic base');
  }

  // Existing search pain indicators (0-30 points)
  // Companies with content platforms often have search pain
  const partnerTech = company.partner_tech?.map(t => t.toLowerCase()) || [];
  const hasContentPlatform = partnerTech.some(t =>
    WEAK_SEARCH_PARTNERS.some(w => t.includes(w))
  );
  if (hasContentPlatform) {
    score += 25;
    signals.push('Uses content platform with weak native search');
  }

  // Tech stack complexity (0-20 points)
  if (partnerTech.length >= 3) {
    score += 20;
    signals.push(`Complex tech stack (${partnerTech.length} partners)`);
  } else if (partnerTech.length >= 1) {
    score += 10;
    signals.push('Has partner technology detected');
  }

  // Executive quote/displacement angle (0-20 points)
  if (company.exec_quote) {
    score += 15;
    signals.push('Executive quote captured');
  }
  if (company.displacement_angle) {
    score += 5;
    signals.push('Displacement angle identified');
  }

  return { score: Math.min(100, score), signals };
}

function calculateValueScore(company: Company): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  // Revenue potential (0-40 points)
  const revenue = company.revenue || 0;
  if (revenue >= REVENUE_TIERS.enterprise) {
    score += 40;
    signals.push(`Enterprise revenue: ${formatCurrency(revenue)}`);
  } else if (revenue >= REVENUE_TIERS.large) {
    score += 30;
    signals.push(`Large revenue: ${formatCurrency(revenue)}`);
  } else if (revenue >= REVENUE_TIERS.mid) {
    score += 20;
    signals.push(`Mid-market revenue: ${formatCurrency(revenue)}`);
  } else if (revenue >= REVENUE_TIERS.small) {
    score += 10;
    signals.push(`Small revenue: ${formatCurrency(revenue)}`);
  }

  // Traffic volume = search volume proxy (0-30 points)
  const monthlyVisits = company.sw_monthly_visits || 0;
  if (monthlyVisits >= TRAFFIC_TIERS.excellent) {
    score += 30;
    signals.push(`${formatNumber(monthlyVisits)} monthly visits = high search volume`);
  } else if (monthlyVisits >= TRAFFIC_TIERS.great) {
    score += 20;
    signals.push(`${formatNumber(monthlyVisits)} monthly visits`);
  } else if (monthlyVisits >= TRAFFIC_TIERS.good) {
    score += 10;
    signals.push(`${formatNumber(monthlyVisits)} monthly visits`);
  }

  // Multi-site potential (0-15 points)
  if (company.store_count && company.store_count > 100) {
    score += 15;
    signals.push(`${company.store_count} stores = multi-site potential`);
  } else if (company.store_count && company.store_count > 10) {
    score += 10;
    signals.push(`${company.store_count} stores`);
  }

  // Growth indicators (0-15 points)
  // Young companies in high-value verticals are often growth-stage
  if (company.founded_year && company.founded_year >= 2015) {
    const vertical = company.vertical?.toLowerCase() || '';
    if (HIGH_VALUE_VERTICALS.some(v => vertical.includes(v))) {
      score += 15;
      signals.push('Growth-stage company in high-value vertical');
    }
  }

  return { score: Math.min(100, score), signals };
}

function calculateDisplacementScore(company: Company): { score: number; signals: string[] } {
  let score = 50; // Start at neutral
  const signals: string[] = [];

  const partnerTech = company.partner_tech?.map(t => t.toLowerCase()) || [];
  const currentSearch = company.current_search?.toLowerCase() || '';

  // Current search provider analysis
  if (currentSearch === 'none' || !currentSearch) {
    score += 30;
    signals.push('No detected search provider (greenfield)');
  } else if (currentSearch === 'elasticsearch' || currentSearch === 'solr') {
    score += 20;
    signals.push('Uses open-source search (maintainability pain)');
  } else if (currentSearch === 'algolia') {
    score -= 50;
    signals.push('Already using Algolia (existing customer)');
  } else if (['google custom search', 'swiftype', 'searchspring'].includes(currentSearch)) {
    score += 15;
    signals.push(`Displaceable provider: ${company.current_search}`);
  }

  // Partner tech assessment
  const hasWeakSearchPartner = partnerTech.some(t =>
    WEAK_SEARCH_PARTNERS.some(w => t.includes(w))
  );
  const hasStrongSearchPartner = partnerTech.some(t =>
    STRONG_SEARCH_PARTNERS.some(w => t.includes(w))
  );

  if (hasWeakSearchPartner && !hasStrongSearchPartner) {
    score += 20;
    signals.push('Partner platform has weak native search');
  } else if (hasStrongSearchPartner) {
    score -= 10;
    signals.push('Partner platform has native search capabilities');
  }

  // Competitor intelligence
  if (company.competitor_data?.competitors) {
    const competitorsUsingAlgolia = company.competitor_data.competitors.filter(c => c.using_algolia);
    if (competitorsUsingAlgolia.length > 0) {
      score += 15;
      signals.push(`${competitorsUsingAlgolia.length} competitor(s) using Algolia`);
    }
  }

  return { score: Math.max(0, Math.min(100, score)), signals };
}

// =============================================================================
// Data Completeness Calculation
// =============================================================================

function calculateDataCompleteness(company: Company): number {
  const dataPoints = [
    company.company_name,
    company.domain,
    company.vertical,
    company.industry,
    company.headquarters?.country,
    company.employee_count,
    company.revenue,
    company.sw_monthly_visits,
    company.partner_tech?.length,
    company.current_search,
    company.is_public !== undefined,
    company.founded_year,
    company.competitor_data,
    company.exec_quote,
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
