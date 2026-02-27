/**
 * Investor Data Transformer
 *
 * Transforms WebSearch investor intelligence into the InvestorData type
 * used throughout the PartnerForge application.
 */

import type { InvestorData, SecFiling, RiskFactor, EarningsHighlight } from '@/types';
import type {
  InvestorData as WebSearchInvestorData,
  SecFiling as WebSearchFiling,
  RiskFactor as WebSearchRiskFactor,
  EarningsHighlight as WebSearchEarningsHighlight,
} from '../clients/websearch';

// ============================================================================
// Algolia-Relevant Risk Categories
// ============================================================================

const HIGH_RELEVANCE_CATEGORIES = [
  'Technology Risk',
  'Digital Risk',
  'Customer Experience Risk',
  'E-commerce Risk',
];

const MEDIUM_RELEVANCE_CATEGORIES = [
  'Customer Risk',
  'Competitive Risk',
  'Security Risk',
  'Innovation Risk',
];

// Keywords that indicate high relevance to Algolia
const ALGOLIA_RELEVANT_KEYWORDS = [
  'search',
  'discovery',
  'digital',
  'ecommerce',
  'e-commerce',
  'online',
  'website',
  'customer experience',
  'technology platform',
  'platform',
  'modernization',
  'personalization',
];

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform WebSearch investor data into InvestorData type
 */
export function transformInvestorData(
  domain: string,
  data: WebSearchInvestorData | null
): InvestorData | null {
  if (!data) return null;

  return {
    domain,
    sec_filings: data.sec_filings.map(transformSecFiling),
    earnings_highlights: data.earnings_highlights.map(transformEarningsHighlight),
    risk_factors: data.risk_factors.map(transformRiskFactor),
  };
}

/**
 * Transform a WebSearch SEC filing to SecFiling type
 */
export function transformSecFiling(filing: WebSearchFiling): SecFiling {
  return {
    type: filing.type,
    filing_date: filing.filing_date,
    url: filing.url,
    highlights: filing.highlights,
  };
}

/**
 * Transform a WebSearch earnings highlight to EarningsHighlight type
 */
export function transformEarningsHighlight(highlight: WebSearchEarningsHighlight): EarningsHighlight {
  return {
    quarter: highlight.quarter,
    date: parseQuarterToDate(highlight.quarter),
    key_points: highlight.key_points,
    transcript_url: highlight.transcript_url,
  };
}

/**
 * Transform a WebSearch risk factor to RiskFactor type
 */
export function transformRiskFactor(factor: WebSearchRiskFactor): RiskFactor {
  return {
    category: factor.category,
    description: factor.description,
    relevance_to_algolia: factor.relevance_to_algolia,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse quarter string (e.g., "Q1 2024") to approximate date
 */
export function parseQuarterToDate(quarter: string): string {
  const match = quarter.match(/Q(\d)\s*(\d{4})/i);
  if (!match) return '';

  const q = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);

  // Map quarter to month (end of quarter)
  const monthMap: Record<number, string> = {
    1: '03-31',
    2: '06-30',
    3: '09-30',
    4: '12-31',
  };

  return `${year}-${monthMap[q] || '12-31'}`;
}

// ============================================================================
// Investor Signal Scoring
// ============================================================================

/**
 * Get investor signal score for composite scoring (0-100)
 *
 * Factors:
 * - High-relevance risk factors: up to 40 points
 * - Recent SEC filings with highlights: up to 30 points
 * - Earnings highlights mentioning search/digital: up to 30 points
 */
export function getInvestorSignalScore(data: InvestorData): number {
  let score = 0;

  // High-relevance risk factors (40 points max)
  const highRelevance = data.risk_factors.filter((f) => f.relevance_to_algolia === 'high');
  score += Math.min(40, highRelevance.length * 10);

  // Recent SEC filings with highlights (30 points max)
  const recentFilings = data.sec_filings.filter(
    (f) => f.highlights && f.highlights.length > 0
  );
  score += Math.min(30, recentFilings.length * 10);

  // Earnings highlights mentioning search/digital (30 points max)
  const relevantEarnings = data.earnings_highlights.filter((e) =>
    e.key_points.some((p) =>
      ALGOLIA_RELEVANT_KEYWORDS.some((k) => p.toLowerCase().includes(k))
    )
  );
  score += Math.min(30, relevantEarnings.length * 10);

  return Math.min(100, score);
}

/**
 * Classify investor signal level
 */
export function getInvestorSignalLevel(data: InvestorData): 'high' | 'medium' | 'low' | 'none' {
  const score = getInvestorSignalScore(data);
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 15) return 'low';
  return 'none';
}

// ============================================================================
// Risk Factor Analysis
// ============================================================================

/**
 * Extract SEC risk factors relevant to Algolia
 * Returns only high and medium relevance factors, limited to 5
 */
export function extractRelevantRiskFactors(data: InvestorData): RiskFactor[] {
  return data.risk_factors
    .filter((f) => f.relevance_to_algolia !== 'low')
    .slice(0, 5);
}

/**
 * Get risk factors by relevance level
 */
export function getRiskFactorsByRelevance(
  data: InvestorData,
  relevance: 'high' | 'medium' | 'low'
): RiskFactor[] {
  return data.risk_factors.filter((f) => f.relevance_to_algolia === relevance);
}

/**
 * Categorize risk factors by their category
 */
export function categorizeRiskFactors(data: InvestorData): Record<string, RiskFactor[]> {
  const categories: Record<string, RiskFactor[]> = {};

  for (const factor of data.risk_factors) {
    if (!categories[factor.category]) {
      categories[factor.category] = [];
    }
    categories[factor.category].push(factor);
  }

  return categories;
}

/**
 * Check if there are technology-related risk factors
 */
export function hasTechnologyRisks(data: InvestorData): boolean {
  return data.risk_factors.some(
    (f) =>
      f.category === 'Technology Risk' ||
      f.category === 'Digital Risk' ||
      f.description.toLowerCase().includes('technology') ||
      f.description.toLowerCase().includes('platform')
  );
}

// ============================================================================
// SEC Filing Analysis
// ============================================================================

/**
 * Get the most recent 10-K filing
 */
export function getMostRecent10K(data: InvestorData): SecFiling | null {
  const filings10K = data.sec_filings.filter((f) => f.type === '10-K');
  if (filings10K.length === 0) return null;

  // Sort by date descending
  return filings10K.sort((a, b) => b.filing_date.localeCompare(a.filing_date))[0];
}

/**
 * Get the most recent 10-Q filing
 */
export function getMostRecent10Q(data: InvestorData): SecFiling | null {
  const filings10Q = data.sec_filings.filter((f) => f.type === '10-Q');
  if (filings10Q.length === 0) return null;

  return filings10Q.sort((a, b) => b.filing_date.localeCompare(a.filing_date))[0];
}

/**
 * Get SEC filings by type
 */
export function getFilingsByType(
  data: InvestorData,
  type: '10-K' | '10-Q' | '8-K' | 'DEF 14A'
): SecFiling[] {
  return data.sec_filings.filter((f) => f.type === type);
}

/**
 * Check if company has recent SEC filings (within last year)
 */
export function hasRecentFilings(data: InvestorData): boolean {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoffDate = oneYearAgo.toISOString().split('T')[0];

  return data.sec_filings.some((f) => f.filing_date >= cutoffDate);
}

// ============================================================================
// Earnings Analysis
// ============================================================================

/**
 * Get the most recent earnings highlight
 */
export function getMostRecentEarnings(data: InvestorData): EarningsHighlight | null {
  if (data.earnings_highlights.length === 0) return null;

  return data.earnings_highlights.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    return dateB.localeCompare(dateA);
  })[0];
}

/**
 * Get earnings highlights mentioning specific topics
 */
export function getEarningsWithTopic(data: InvestorData, topic: string): EarningsHighlight[] {
  const topicLower = topic.toLowerCase();
  return data.earnings_highlights.filter((e) =>
    e.key_points.some((p) => p.toLowerCase().includes(topicLower))
  );
}

/**
 * Extract all key points from earnings highlights
 */
export function getAllEarningsKeyPoints(data: InvestorData): string[] {
  return data.earnings_highlights.flatMap((e) => e.key_points);
}

/**
 * Check if earnings mention digital transformation
 */
export function earningsMentionDigitalTransformation(data: InvestorData): boolean {
  const digitalKeywords = [
    'digital transformation',
    'digital initiative',
    'digital strategy',
    'digital investment',
    'e-commerce',
    'ecommerce',
    'online growth',
  ];

  return data.earnings_highlights.some((e) =>
    e.key_points.some((p) =>
      digitalKeywords.some((k) => p.toLowerCase().includes(k))
    )
  );
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format SEC filing for display
 */
export function formatSecFiling(filing: SecFiling): string {
  return `${filing.type} (${filing.filing_date})`;
}

/**
 * Format risk factor for display
 */
export function formatRiskFactor(factor: RiskFactor): string {
  const relevance = factor.relevance_to_algolia.toUpperCase();
  return `[${relevance}] ${factor.category}: ${factor.description.slice(0, 100)}...`;
}

/**
 * Get investor data summary
 */
export function getInvestorSummary(data: InvestorData): string {
  const filingCount = data.sec_filings.length;
  const highRelevanceCount = data.risk_factors.filter((f) => f.relevance_to_algolia === 'high').length;
  const earningsCount = data.earnings_highlights.length;

  const parts: string[] = [];

  if (filingCount > 0) {
    parts.push(`${filingCount} SEC filing${filingCount > 1 ? 's' : ''}`);
  }
  if (highRelevanceCount > 0) {
    parts.push(`${highRelevanceCount} high-relevance risk factor${highRelevanceCount > 1 ? 's' : ''}`);
  }
  if (earningsCount > 0) {
    parts.push(`${earningsCount} earnings highlight${earningsCount > 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No investor data available';
}

/**
 * Get the most actionable insight from investor data
 */
export function getMostActionableInsight(data: InvestorData): string | null {
  // First, check for high-relevance risk factors
  const highRelevance = data.risk_factors.filter((f) => f.relevance_to_algolia === 'high');
  if (highRelevance.length > 0) {
    return `Risk Factor: ${highRelevance[0].description.slice(0, 150)}`;
  }

  // Then, check for digital transformation mentions in earnings
  const digitalEarnings = data.earnings_highlights.filter((e) =>
    e.key_points.some((p) =>
      ['digital', 'ecommerce', 'e-commerce', 'online', 'search'].some((k) =>
        p.toLowerCase().includes(k)
      )
    )
  );
  if (digitalEarnings.length > 0 && digitalEarnings[0].key_points.length > 0) {
    return `Earnings (${digitalEarnings[0].quarter}): ${digitalEarnings[0].key_points[0].slice(0, 150)}`;
  }

  return null;
}

// ============================================================================
// Extended Investor Intelligence Type
// ============================================================================

export interface InvestorIntelligence {
  sec_filings: Array<{
    type: '10-K' | '10-Q' | '8-K' | 'DEF 14A';
    filing_date: string;
    fiscal_year?: number;
    fiscal_quarter?: number;
    url: string;
    key_highlights: string[];
    algolia_relevant_excerpts: string[];
  }>;

  risk_factors: Array<{
    category: string;
    summary: string;
    algolia_relevance: 'high' | 'medium' | 'low';
    algolia_mitigation: string;  // How Algolia helps address this risk
  }>;

  earnings_insights: Array<{
    quarter: string;
    key_metrics: {
      revenue?: number;
      growth?: number;
      guidance?: string;
    };
    digital_mentions: string[];
    search_mentions: string[];
    transcript_url?: string;
  }>;

  // Investment thesis
  growth_drivers: string[];
  headwinds: string[];
  digital_transformation_stage: 'early' | 'mid' | 'advanced' | 'unknown';

  fetched_at: string;
}

// ============================================================================
// Risk Category to Algolia Mitigation Mappings
// ============================================================================

export const RISK_MITIGATIONS: Record<string, string> = {
  'technology': 'Algolia provides enterprise-grade search infrastructure with 99.999% uptime SLA',
  'technology risk': 'Algolia provides enterprise-grade search infrastructure with 99.999% uptime SLA',
  'competition': 'Algolia-powered search drives higher conversion rates (15-30% lift typical)',
  'competitive risk': 'Algolia-powered search drives higher conversion rates (15-30% lift typical)',
  'customer': 'Better search = better findability = lower bounce rates and higher satisfaction',
  'customer risk': 'Better search = better findability = lower bounce rates and higher satisfaction',
  'customer_acquisition': 'Better search = better findability = lower bounce rates',
  'digital': 'Algolia accelerates digital transformation with fast implementation (days, not months)',
  'digital risk': 'Algolia accelerates digital transformation with fast implementation (days, not months)',
  'digital_transformation': 'Algolia accelerates digital transformation with fast implementation',
  'scalability': 'Algolia scales automatically to handle traffic spikes - no capacity planning needed',
  'security': 'Algolia is SOC 2 Type II certified with enterprise security features',
  'security risk': 'Algolia is SOC 2 Type II certified with enterprise security features',
  'cybersecurity': 'Algolia is SOC 2 Type II certified with enterprise security features',
  'economic': 'Algolia offers flexible pricing that scales with usage - pay for what you use',
  'economic risk': 'Algolia offers flexible pricing that scales with usage - pay for what you use',
  'supply chain': 'Algolia helps customers find alternative products when inventory is limited',
  'innovation': 'Algolia continuously ships new AI/ML features to keep customers ahead',
  'default': 'Algolia helps enterprises deliver better customer experiences through AI-powered search',
};

// ============================================================================
// Extended Transformers
// ============================================================================

/**
 * Transform SEC filing with enhanced Algolia relevance extraction
 */
export function transformSecFilingEnhanced(
  filing: SecFiling
): InvestorIntelligence['sec_filings'][0] {
  // Extract fiscal year from filing date
  const dateMatch = filing.filing_date.match(/(\d{4})/);
  const fiscal_year = dateMatch ? parseInt(dateMatch[1], 10) : undefined;

  // Extract fiscal quarter for 10-Q
  let fiscal_quarter: number | undefined;
  if (filing.type === '10-Q' && filing.highlights) {
    const qMatch = filing.highlights.join(' ').match(/Q([1-4])/i);
    if (qMatch) {
      fiscal_quarter = parseInt(qMatch[1], 10);
    }
  }

  // Extract Algolia-relevant excerpts from highlights
  const algolia_relevant_excerpts: string[] = [];
  if (filing.highlights) {
    for (const highlight of filing.highlights) {
      if (ALGOLIA_RELEVANT_KEYWORDS.some((k) => highlight.toLowerCase().includes(k))) {
        algolia_relevant_excerpts.push(highlight);
      }
    }
  }

  return {
    type: filing.type,
    filing_date: filing.filing_date,
    fiscal_year,
    fiscal_quarter,
    url: filing.url,
    key_highlights: filing.highlights || [],
    algolia_relevant_excerpts,
  };
}

/**
 * Transform risk factor with Algolia mitigation strategy
 */
export function transformRiskFactorEnhanced(
  factor: RiskFactor
): InvestorIntelligence['risk_factors'][0] {
  const categoryLower = factor.category.toLowerCase();

  // Find matching mitigation
  let algolia_mitigation = RISK_MITIGATIONS.default;
  for (const [key, mitigation] of Object.entries(RISK_MITIGATIONS)) {
    if (categoryLower.includes(key)) {
      algolia_mitigation = mitigation;
      break;
    }
  }

  return {
    category: factor.category,
    summary: factor.description,
    algolia_relevance: factor.relevance_to_algolia,
    algolia_mitigation,
  };
}

/**
 * Extract digital mentions from text
 */
export function extractDigitalMentions(text: string): string[] {
  const mentions: string[] = [];
  const patterns = [
    /digital\s+[a-z]+/gi,
    /e-?commerce\s+[a-z]*/gi,
    /online\s+[a-z]+/gi,
    /website\s+[a-z]*/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      mentions.push(...matches);
    }
  }

  return [...new Set(mentions)];
}

/**
 * Extract search mentions from text
 */
export function extractSearchMentions(text: string): string[] {
  const mentions: string[] = [];
  const patterns = [
    /search\s+[a-z]+/gi,
    /discovery\s+[a-z]*/gi,
    /findability/gi,
    /relevance/gi,
    /personalization/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      mentions.push(...matches);
    }
  }

  return [...new Set(mentions)];
}

/**
 * Determine digital transformation stage from filings and quotes
 */
export function determineDigitalTransformationStage(
  filings: SecFiling[],
  quotes: string[]
): InvestorIntelligence['digital_transformation_stage'] {
  const allText = [
    ...filings.flatMap((f) => f.highlights || []),
    ...quotes,
  ].join(' ').toLowerCase();

  // Count digital/tech mentions
  const digitalKeywords = [
    'digital', 'ecommerce', 'e-commerce', 'online', 'technology',
    'platform', 'modernization', 'transformation', 'cloud',
  ];

  let digitalMentions = 0;
  for (const keyword of digitalKeywords) {
    const matches = allText.match(new RegExp(keyword, 'gi'));
    if (matches) {
      digitalMentions += matches.length;
    }
  }

  // Count advanced indicators
  const advancedKeywords = [
    'ai', 'machine learning', 'personalization', 'omnichannel',
    'headless', 'microservices', 'data-driven', 'analytics platform',
  ];

  let advancedMentions = 0;
  for (const keyword of advancedKeywords) {
    if (allText.includes(keyword)) {
      advancedMentions++;
    }
  }

  // Classify based on mentions
  if (advancedMentions >= 3 && digitalMentions >= 10) {
    return 'advanced';
  }
  if (digitalMentions >= 5 || advancedMentions >= 1) {
    return 'mid';
  }
  if (digitalMentions >= 2) {
    return 'early';
  }
  return 'unknown';
}

/**
 * Extract growth drivers from investor data
 */
export function extractGrowthDrivers(data: InvestorData): string[] {
  const drivers: string[] = [];
  const allText = [
    ...data.sec_filings.flatMap((f) => f.highlights || []),
    ...data.earnings_highlights.flatMap((e) => e.key_points),
  ].join(' ').toLowerCase();

  const driverPatterns: Array<{ pattern: RegExp; driver: string }> = [
    { pattern: /e-?commerce growth/i, driver: 'E-commerce expansion' },
    { pattern: /digital transformation/i, driver: 'Digital transformation initiatives' },
    { pattern: /new customer/i, driver: 'Customer acquisition' },
    { pattern: /international expansion/i, driver: 'International expansion' },
    { pattern: /market share/i, driver: 'Market share gains' },
    { pattern: /product innovation/i, driver: 'Product innovation' },
    { pattern: /mobile|app/i, driver: 'Mobile/app growth' },
    { pattern: /personalization/i, driver: 'Personalization investments' },
  ];

  for (const { pattern, driver } of driverPatterns) {
    if (pattern.test(allText) && !drivers.includes(driver)) {
      drivers.push(driver);
    }
  }

  return drivers.slice(0, 5);
}

/**
 * Extract headwinds from investor data
 */
export function extractHeadwinds(data: InvestorData): string[] {
  const headwinds: string[] = [];

  // Extract from risk factors
  const highRisks = data.risk_factors.filter((f) => f.relevance_to_algolia === 'high');
  for (const risk of highRisks) {
    if (!headwinds.includes(risk.category)) {
      headwinds.push(risk.category);
    }
  }

  // Look for common headwind indicators in text
  const allText = [
    ...data.sec_filings.flatMap((f) => f.highlights || []),
    ...data.earnings_highlights.flatMap((e) => e.key_points),
  ].join(' ').toLowerCase();

  const headwindPatterns: Array<{ pattern: RegExp; headwind: string }> = [
    { pattern: /declining traffic/i, headwind: 'Declining web traffic' },
    { pattern: /competitive pressure/i, headwind: 'Competitive pressure' },
    { pattern: /margin compression/i, headwind: 'Margin compression' },
    { pattern: /technical debt/i, headwind: 'Technical debt' },
    { pattern: /legacy system/i, headwind: 'Legacy technology constraints' },
  ];

  for (const { pattern, headwind } of headwindPatterns) {
    if (pattern.test(allText) && !headwinds.includes(headwind)) {
      headwinds.push(headwind);
    }
  }

  return headwinds.slice(0, 5);
}

/**
 * Transform InvestorData into InvestorIntelligence
 */
export function transformToInvestorIntelligence(data: InvestorData): InvestorIntelligence {
  // Transform filings
  const sec_filings = data.sec_filings.map(transformSecFilingEnhanced);

  // Transform risk factors
  const risk_factors = data.risk_factors.map(transformRiskFactorEnhanced);

  // Transform earnings with enhanced extraction
  const earnings_insights: InvestorIntelligence['earnings_insights'] = data.earnings_highlights.map((e) => {
    const allText = e.key_points.join(' ');
    return {
      quarter: e.quarter,
      key_metrics: {}, // Would need actual parsing to extract metrics
      digital_mentions: extractDigitalMentions(allText),
      search_mentions: extractSearchMentions(allText),
      transcript_url: e.transcript_url,
    };
  });

  // Extract quotes for digital transformation analysis
  const allQuotes = data.earnings_highlights.flatMap((e) => e.key_points);

  return {
    sec_filings,
    risk_factors,
    earnings_insights,
    growth_drivers: extractGrowthDrivers(data),
    headwinds: extractHeadwinds(data),
    digital_transformation_stage: determineDigitalTransformationStage(data.sec_filings, allQuotes),
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Get investor data actionable insights
 */
export function getInvestorActionableInsights(data: InvestorData): string[] {
  const insights: string[] = [];
  const intelligence = transformToInvestorIntelligence(data);

  // Digital transformation stage insight
  if (intelligence.digital_transformation_stage !== 'unknown') {
    insights.push(
      `Digital transformation stage: ${intelligence.digital_transformation_stage} - ` +
      (intelligence.digital_transformation_stage === 'early'
        ? 'opportunity to be a strategic partner'
        : intelligence.digital_transformation_stage === 'mid'
        ? 'ready for advanced search capabilities'
        : 'looking for best-in-class solutions')
    );
  }

  // High relevance risk factors
  const highRisks = intelligence.risk_factors.filter((f) => f.algolia_relevance === 'high');
  if (highRisks.length > 0) {
    insights.push(
      `SEC risk factor "${highRisks[0].category}" - Algolia solution: ${highRisks[0].algolia_mitigation}`
    );
  }

  // Growth drivers
  if (intelligence.growth_drivers.length > 0) {
    insights.push(`Growth drivers: ${intelligence.growth_drivers.slice(0, 3).join(', ')}`);
  }

  return insights;
}
