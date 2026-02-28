/**
 * WebSearch Proxy Service
 *
 * Provides web search-based enrichment for signals that cannot be obtained from structured APIs:
 * 1. Hiring signals from careers pages
 * 2. Executive quotes from earnings calls, investor days
 * 3. Investor intelligence from 10-K, 10-Q filings
 * 4. Strategic context and trigger events
 *
 * This is a PARSER and QUERY BUILDER service - actual search execution would be done by a backend.
 * Design is testable without live search execution.
 */

// =============================================================================
// Types - Hiring Signals
// =============================================================================

export interface HiringJob {
  title: string;
  tier: 1 | 2 | 3;
  department?: string;
  location?: string;
  url: string;
  posted_date?: string;
  relevance_score: number;
  search_related: boolean;
}

export interface HiringSignal {
  signal_strength: 'strong' | 'moderate' | 'weak' | 'none';
  total_relevant_openings: number;
  tier_breakdown: {
    tier_1_vp: number;
    tier_2_director: number;
    tier_3_ic: number;
  };
  relevant_jobs: HiringJob[];
  tech_keywords_detected: string[];
}

// =============================================================================
// Types - Executive Quotes
// =============================================================================

export interface ExecutiveQuote {
  speaker: string;
  title: string;
  quote: string;
  topic_tags: string[];
  maps_to_algolia_value: string;
  source_url: string;
  source_type: 'earnings_call' | 'investor_day' | 'interview' | 'press_release';
  date: string;
}

export interface ExecutiveData {
  domain: string;
  quotes: ExecutiveQuote[];
  themes: Array<{
    theme: string;
    frequency: number;
    example_quote: string;
  }>;
  key_executives: Array<{
    name: string;
    title: string;
    tenure_years?: number;
  }>;
}

// =============================================================================
// Types - Investor Intelligence
// =============================================================================

// Note: SecFiling is in secedgar.ts - this is a websearch-specific variant
export interface WebSearchSecFiling {
  type: '10-K' | '10-Q' | '8-K' | 'DEF 14A';
  filing_date: string;
  url: string;
  highlights: string[];
}

export interface RiskFactor {
  category: string;
  description: string;
  relevance_to_algolia: 'high' | 'medium' | 'low';
}

export interface EarningsHighlight {
  quarter: string;
  key_points: string[];
  transcript_url?: string;
}

export interface InvestorData {
  domain: string;
  sec_filings: WebSearchSecFiling[];
  risk_factors: RiskFactor[];
  earnings_highlights: EarningsHighlight[];
}

// =============================================================================
// Types - Strategic Context
// =============================================================================

export interface StrategicTrigger {
  event_type: 'acquisition' | 'partnership' | 'replatform' | 'launch' | 'leadership_change';
  description: string;
  date: string;
  source_url: string;
  relevance_score: number;
}

export interface StrategicData {
  domain: string;
  triggers: StrategicTrigger[];
  recent_announcements: Array<{
    headline: string;
    date: string;
    url: string;
  }>;
  competitive_moves: string[];
}

// =============================================================================
// Types - Aggregated
// =============================================================================

export interface WebSearchFullData {
  hiring: HiringSignal;
  executive: ExecutiveData;
  investor: InvestorData | null;
  strategic: StrategicData;
  fetched_at: string;
}

// =============================================================================
// Types - Search Interface
// =============================================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

export interface SearchExecutor {
  search(query: string): Promise<SearchResult[]>;
}

// =============================================================================
// Constants - Job Title Patterns
// =============================================================================

const TIER_1_PATTERNS: RegExp[] = [
  /\b(vp|vice president)\b/i,
  /\b(cto|cio|cdo|cmo)\b/i,
  /\bchief\s+\w+\s+officer\b/i,
  /\bhead\s+of\b/i,
  /\bsvp|senior\s+vice\s+president\b/i,
];

const TIER_2_PATTERNS: RegExp[] = [
  /\bdirector\b/i,
  /\bsenior\s+director\b/i,
  /\bprincipal\b/i,
  /\bgroup\s+manager\b/i,
];

const TIER_3_PATTERNS: RegExp[] = [
  /\bsenior\b/i,
  /\bstaff\b/i,
  /\blead\b/i,
  /\bmanager\b/i,
  /\bengineer\b/i,
  /\bdeveloper\b/i,
  /\barchitect\b/i,
  /\banalyst\b/i,
];

const SEARCH_RELATED_KEYWORDS: string[] = [
  'search', 'discovery', 'algolia', 'elasticsearch', 'solr', 'elastic',
  'relevance', 'ranking', 'recommendations', 'personalization', 'findability',
  'site search', 'product search', 'catalog', 'merchandising', 'browse',
  'autocomplete', 'typeahead', 'faceting', 'filtering', 'query',
];

const TECH_KEYWORDS: string[] = [
  'react', 'vue', 'angular', 'typescript', 'javascript', 'python', 'java',
  'node', 'aws', 'gcp', 'azure', 'kubernetes', 'docker', 'microservices',
  'api', 'graphql', 'rest', 'machine learning', 'ml', 'ai', 'data science',
  'ecommerce', 'e-commerce', 'headless', 'composable', 'jamstack',
];

// =============================================================================
// Constants - Algolia Value Mapping
// =============================================================================

export const ALGOLIA_RELEVANT_TOPICS: string[] = [
  'search', 'discovery', 'findability', 'customer experience',
  'digital transformation', 'ecommerce', 'conversion', 'personalization',
  'site performance', 'mobile experience', 'omnichannel', 'engagement',
  'browse', 'catalog', 'product discovery', 'relevance', 'recommendations',
];

const ALGOLIA_VALUE_MAPPINGS: Array<{ keywords: string[]; value: string }> = [
  { keywords: ['search', 'discovery', 'findability', 'browse', 'catalog'], value: 'Search & Discovery' },
  { keywords: ['customer experience', 'cx', 'user experience', 'ux'], value: 'Customer Experience' },
  { keywords: ['conversion', 'revenue', 'sales', 'cart', 'checkout'], value: 'Revenue & Conversion' },
  { keywords: ['personalization', 'recommendations', 'personalized'], value: 'Personalization' },
  { keywords: ['mobile', 'app', 'native', 'ios', 'android'], value: 'Mobile Experience' },
  { keywords: ['omnichannel', 'unified', 'multichannel'], value: 'Omnichannel Commerce' },
  { keywords: ['speed', 'performance', 'fast', 'milliseconds', 'latency'], value: 'Performance' },
  { keywords: ['scale', 'traffic', 'volume', 'peak', 'black friday'], value: 'Scalability' },
  { keywords: ['ai', 'ml', 'machine learning', 'intelligence', 'nlp'], value: 'AI & ML' },
  { keywords: ['digital transformation', 'modernization', 'replatform'], value: 'Digital Transformation' },
];

// =============================================================================
// Constants - Risk Factor Categories
// =============================================================================

const RISK_FACTOR_CATEGORIES: Array<{
  keywords: string[];
  category: string;
  relevance: 'high' | 'medium' | 'low';
}> = [
  { keywords: ['technology', 'technical', 'system', 'platform', 'infrastructure'], category: 'Technology Risk', relevance: 'high' },
  { keywords: ['customer acquisition', 'customer retention', 'customer experience'], category: 'Customer Risk', relevance: 'medium' },
  { keywords: ['competition', 'competitive', 'market share', 'competitors'], category: 'Competitive Risk', relevance: 'medium' },
  { keywords: ['digital', 'ecommerce', 'online', 'website', 'web'], category: 'Digital Risk', relevance: 'high' },
  { keywords: ['supply chain', 'inventory', 'logistics'], category: 'Supply Chain Risk', relevance: 'low' },
  { keywords: ['regulatory', 'compliance', 'legal', 'privacy', 'gdpr'], category: 'Regulatory Risk', relevance: 'low' },
  { keywords: ['cybersecurity', 'security', 'data breach', 'hack'], category: 'Security Risk', relevance: 'medium' },
  { keywords: ['economic', 'recession', 'inflation', 'consumer spending'], category: 'Economic Risk', relevance: 'low' },
];

// =============================================================================
// Constants - Strategic Trigger Patterns
// =============================================================================

const STRATEGIC_TRIGGER_PATTERNS: Array<{
  pattern: RegExp;
  event_type: StrategicTrigger['event_type'];
}> = [
  { pattern: /\b(acquires?|acquisition|acquired|bought|purchased)\b/i, event_type: 'acquisition' },
  { pattern: /\b(partners?|partnership|partnering|teamed up|collaboration)\b/i, event_type: 'partnership' },
  { pattern: /\b(replatform(ing)?|migration|migrating|new platform|platform change)\b/i, event_type: 'replatform' },
  { pattern: /\b(launch|launches|launching|unveil|unveils|announces new|new website)\b/i, event_type: 'launch' },
  { pattern: /\b(appoints?|hired|joins?|new (ceo|cto|cio|cdo|vp)|leadership change)\b/i, event_type: 'leadership_change' },
];

// =============================================================================
// Query Builders - Hiring
// =============================================================================

/**
 * Build search queries to find hiring information for a company
 */
export function buildHiringSearchQueries(company: string, domain: string): string[] {
  const baseDomain = domain.replace(/^www\./, '').split('.')[0];
  const queries: string[] = [];

  // Main careers page queries
  queries.push(`${company} careers`);
  queries.push(`${company} jobs`);
  queries.push(`site:${domain}/careers`);
  queries.push(`site:${domain}/jobs`);

  // LinkedIn jobs
  queries.push(`${company} site:linkedin.com/jobs`);

  // Specific role searches
  queries.push(`${company} hiring VP Engineering`);
  queries.push(`${company} hiring Director Search`);
  queries.push(`${company} hiring Senior Engineer`);
  queries.push(`${company} hiring Product Manager ecommerce`);

  // Tech-specific searches
  queries.push(`${company} jobs search relevance`);
  queries.push(`${company} careers ecommerce platform`);

  // Greenhouse/Lever/Workday career sites
  queries.push(`site:boards.greenhouse.io ${baseDomain}`);
  queries.push(`site:jobs.lever.co ${baseDomain}`);

  return queries;
}

/**
 * Get common career page URL patterns for a domain
 */
export function getCareersPagesUrls(domain: string): string[] {
  const baseDomain = domain.replace(/^www\./, '');
  const urls: string[] = [];

  // Common career page patterns
  const patterns = [
    '/careers',
    '/jobs',
    '/careers/',
    '/jobs/',
    '/en/careers',
    '/work-with-us',
    '/join-us',
    '/about/careers',
    '/company/careers',
  ];

  for (const pattern of patterns) {
    urls.push(`https://${baseDomain}${pattern}`);
    urls.push(`https://www.${baseDomain}${pattern}`);
  }

  // Common ATS patterns
  const baseName = baseDomain.split('.')[0];
  urls.push(`https://boards.greenhouse.io/${baseName}`);
  urls.push(`https://jobs.lever.co/${baseName}`);
  urls.push(`https://${baseName}.wd5.myworkdayjobs.com`);
  urls.push(`https://careers.${baseDomain}`);

  return urls;
}

// =============================================================================
// Query Builders - Executive
// =============================================================================

/**
 * Build search queries to find executive quotes and statements
 */
export function buildExecutiveSearchQueries(company: string): string[] {
  const queries: string[] = [];

  // Earnings calls and investor presentations
  queries.push(`${company} earnings call transcript`);
  queries.push(`${company} investor day presentation`);
  queries.push(`${company} annual meeting transcript`);
  queries.push(`${company} analyst day`);

  // CEO/Executive interviews
  queries.push(`${company} CEO interview`);
  queries.push(`${company} CTO interview technology`);
  queries.push(`${company} CFO interview strategy`);
  queries.push(`${company} executive digital transformation`);

  // Topic-specific searches
  queries.push(`${company} CEO "customer experience"`);
  queries.push(`${company} "digital strategy" executive`);
  queries.push(`${company} "ecommerce" CEO remarks`);
  queries.push(`${company} "online" executive quote`);
  queries.push(`${company} "search" "discovery" executive`);

  // Conference talks
  queries.push(`${company} NRF conference`);
  queries.push(`${company} Shoptalk presentation`);

  return queries;
}

// =============================================================================
// Query Builders - Investor
// =============================================================================

/**
 * Build search queries for investor/SEC information
 */
export function buildInvestorSearchQueries(company: string, ticker?: string): string[] {
  const queries: string[] = [];

  // SEC filings
  queries.push(`${company} 10-K annual report`);
  queries.push(`${company} 10-Q quarterly report`);
  queries.push(`${company} 8-K filing`);
  queries.push(`${company} SEC filings`);

  // If we have a ticker, use it for more specific queries
  if (ticker) {
    queries.push(`${ticker} 10-K site:sec.gov`);
    queries.push(`${ticker} earnings transcript`);
    queries.push(`${ticker} investor presentation`);
  }

  // Risk factors and MD&A
  queries.push(`${company} risk factors technology`);
  queries.push(`${company} MD&A management discussion`);

  // Earnings
  queries.push(`${company} earnings call Q4`);
  queries.push(`${company} earnings highlights`);
  queries.push(`${company} guidance fiscal year`);

  // Investor sites
  queries.push(`${company} investor relations`);
  queries.push(`site:seekingalpha.com ${company} earnings`);
  queries.push(`site:fool.com ${company} analysis`);

  return queries;
}

/**
 * Build SEC EDGAR URLs for a company
 */
export function buildEdgarSearchUrl(company: string, filingType: '10-K' | '10-Q' | '8-K'): string {
  const encodedCompany = encodeURIComponent(company);
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodedCompany}&type=${filingType}&dateb=&owner=include&count=10`;
}

/**
 * Get SEC EDGAR filing URLs for a ticker
 */
export function getEdgarFilingsUrls(ticker: string): string[] {
  const urls: string[] = [];

  // Direct EDGAR search
  urls.push(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-K&dateb=&owner=include&count=5`);
  urls.push(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-Q&dateb=&owner=include&count=5`);
  urls.push(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=8-K&dateb=&owner=include&count=10`);

  return urls;
}

// =============================================================================
// Query Builders - Strategic
// =============================================================================

/**
 * Build search queries for strategic intelligence
 */
export function buildStrategicSearchQueries(company: string): string[] {
  const queries: string[] = [];

  // Announcements and news
  queries.push(`${company} announces technology`);
  queries.push(`${company} announces partnership`);
  queries.push(`${company} launches new website`);
  queries.push(`${company} digital transformation`);

  // Acquisitions and partnerships
  queries.push(`${company} acquires`);
  queries.push(`${company} partnership technology`);
  queries.push(`${company} acquisition ecommerce`);

  // Platform changes
  queries.push(`${company} replatforming`);
  queries.push(`${company} new ecommerce platform`);
  queries.push(`${company} website redesign`);
  queries.push(`${company} headless commerce`);

  // Leadership changes
  queries.push(`${company} appoints CTO`);
  queries.push(`${company} new Chief Digital Officer`);
  queries.push(`${company} hires VP Engineering`);

  // Competitive moves
  queries.push(`${company} vs competitors`);
  queries.push(`${company} market share`);
  queries.push(`${company} competitive advantage`);

  // Recent news
  queries.push(`${company} news latest`);
  queries.push(`${company} press release digital`);

  return queries;
}

// =============================================================================
// Scoring Functions - Job Relevance
// =============================================================================

/**
 * Score job relevance based on title and optional description
 */
export function scoreJobRelevance(
  title: string,
  description?: string
): {
  tier: 1 | 2 | 3;
  relevance_score: number;
  search_related: boolean;
} {
  const combinedText = `${title} ${description || ''}`.toLowerCase();
  let tier: 1 | 2 | 3 = 3;
  let relevance_score = 0;
  let search_related = false;

  // Determine tier based on title patterns
  for (const pattern of TIER_1_PATTERNS) {
    if (pattern.test(title)) {
      tier = 1;
      relevance_score += 30;
      break;
    }
  }

  if (tier !== 1) {
    for (const pattern of TIER_2_PATTERNS) {
      if (pattern.test(title)) {
        tier = 2;
        relevance_score += 20;
        break;
      }
    }
  }

  if (tier === 3) {
    for (const pattern of TIER_3_PATTERNS) {
      if (pattern.test(title)) {
        relevance_score += 10;
        break;
      }
    }
  }

  // Check for search-related keywords
  for (const keyword of SEARCH_RELATED_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      search_related = true;
      relevance_score += 25;
      break;
    }
  }

  // Bonus for tech keywords
  let techKeywordCount = 0;
  for (const keyword of TECH_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      techKeywordCount++;
    }
  }
  relevance_score += Math.min(techKeywordCount * 5, 20);

  // Bonus for department relevance
  if (/engineering|product|tech|digital/i.test(combinedText)) {
    relevance_score += 10;
  }

  // Normalize to 0-100
  relevance_score = Math.min(100, relevance_score);

  return { tier, relevance_score, search_related };
}

/**
 * Calculate hiring signal strength based on job data
 */
export function calculateHiringSignalStrength(jobs: HiringJob[]): HiringSignal['signal_strength'] {
  if (jobs.length === 0) return 'none';

  const tier1Count = jobs.filter(j => j.tier === 1).length;
  const tier2Count = jobs.filter(j => j.tier === 2).length;
  const searchRelatedCount = jobs.filter(j => j.search_related).length;

  // Strong signal: VP+ hiring OR multiple search-related roles
  if (tier1Count >= 1 || searchRelatedCount >= 3) {
    return 'strong';
  }

  // Moderate signal: Director-level hiring OR some search-related roles
  if (tier2Count >= 2 || searchRelatedCount >= 1 || jobs.length >= 5) {
    return 'moderate';
  }

  // Weak signal: Some relevant hiring activity
  if (jobs.length >= 1) {
    return 'weak';
  }

  return 'none';
}

// =============================================================================
// Scoring Functions - Quote Mapping
// =============================================================================

/**
 * Map a quote to an Algolia value proposition
 */
export function mapQuoteToAlgoliaValue(quote: string): string | null {
  const quoteLower = quote.toLowerCase();

  for (const mapping of ALGOLIA_VALUE_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (quoteLower.includes(keyword)) {
        return mapping.value;
      }
    }
  }

  return null;
}

/**
 * Extract topic tags from a quote
 */
export function extractTopicTags(quote: string): string[] {
  const quoteLower = quote.toLowerCase();
  const tags: string[] = [];

  for (const topic of ALGOLIA_RELEVANT_TOPICS) {
    if (quoteLower.includes(topic)) {
      tags.push(topic);
    }
  }

  return tags;
}

/**
 * Score quote relevance to Algolia value props
 */
export function scoreQuoteRelevance(quote: string): number {
  const quoteLower = quote.toLowerCase();
  let score = 0;

  // Check for Algolia-relevant topics
  for (const topic of ALGOLIA_RELEVANT_TOPICS) {
    if (quoteLower.includes(topic)) {
      score += 15;
    }
  }

  // Bonus for urgency/priority indicators
  if (/priority|critical|focus|invest|transform/i.test(quote)) {
    score += 10;
  }

  // Bonus for quantitative statements
  if (/\d+%|\d+x|million|billion|increase|growth/i.test(quote)) {
    score += 10;
  }

  return Math.min(100, score);
}

// =============================================================================
// Scoring Functions - Risk Factor Categorization
// =============================================================================

/**
 * Categorize a risk factor and determine its relevance to Algolia
 */
export function categorizeRiskFactor(text: string): {
  category: string;
  relevance: 'high' | 'medium' | 'low';
} {
  const textLower = text.toLowerCase();

  for (const cat of RISK_FACTOR_CATEGORIES) {
    for (const keyword of cat.keywords) {
      if (textLower.includes(keyword)) {
        return { category: cat.category, relevance: cat.relevance };
      }
    }
  }

  return { category: 'General Risk', relevance: 'low' };
}

// =============================================================================
// Scoring Functions - Strategic Trigger
// =============================================================================

/**
 * Identify strategic trigger event type from text
 */
export function identifyTriggerEventType(text: string): StrategicTrigger['event_type'] | null {
  for (const trigger of STRATEGIC_TRIGGER_PATTERNS) {
    if (trigger.pattern.test(text)) {
      return trigger.event_type;
    }
  }
  return null;
}

/**
 * Score strategic trigger relevance
 */
export function scoreTriggerRelevance(text: string, event_type: StrategicTrigger['event_type']): number {
  const textLower = text.toLowerCase();
  let score = 30; // Base score for being a trigger

  // Bonus for type
  if (event_type === 'replatform') score += 30;
  if (event_type === 'leadership_change') score += 20;
  if (event_type === 'acquisition') score += 15;

  // Bonus for tech-related triggers
  if (/technology|digital|ecommerce|platform|website/i.test(textLower)) {
    score += 20;
  }

  // Bonus for search/discovery mentions
  if (/search|discovery|personalization/i.test(textLower)) {
    score += 25;
  }

  return Math.min(100, score);
}

// =============================================================================
// Result Parsers
// =============================================================================

/**
 * Parse search results into HiringSignal
 */
export function parseHiringResults(results: SearchResult[]): HiringSignal {
  const jobs: HiringJob[] = [];
  const techKeywords = new Set<string>();

  for (const result of results) {
    // Check if this looks like a job posting
    if (!/job|career|position|opening|hiring|apply/i.test(result.title + result.snippet)) {
      continue;
    }

    const { tier, relevance_score, search_related } = scoreJobRelevance(
      result.title,
      result.snippet
    );

    // Only include relevant jobs
    if (relevance_score >= 20) {
      jobs.push({
        title: result.title,
        tier,
        url: result.url,
        posted_date: result.date,
        relevance_score,
        search_related,
      });
    }

    // Extract tech keywords
    const combined = `${result.title} ${result.snippet}`.toLowerCase();
    for (const keyword of TECH_KEYWORDS) {
      if (combined.includes(keyword)) {
        techKeywords.add(keyword);
      }
    }
  }

  // Sort by relevance
  jobs.sort((a, b) => b.relevance_score - a.relevance_score);

  // Calculate tier breakdown
  const tier_breakdown = {
    tier_1_vp: jobs.filter(j => j.tier === 1).length,
    tier_2_director: jobs.filter(j => j.tier === 2).length,
    tier_3_ic: jobs.filter(j => j.tier === 3).length,
  };

  return {
    signal_strength: calculateHiringSignalStrength(jobs),
    total_relevant_openings: jobs.length,
    tier_breakdown,
    relevant_jobs: jobs.slice(0, 20), // Limit to top 20
    tech_keywords_detected: Array.from(techKeywords),
  };
}

/**
 * Parse search results into ExecutiveData
 */
export function parseExecutiveResults(results: SearchResult[], domain: string): ExecutiveData {
  const quotes: ExecutiveQuote[] = [];
  const themeCount: Record<string, { count: number; example: string }> = {};
  const executives = new Set<string>();

  // Patterns to extract speaker and title
  const speakerPattern = /(?:said|according to|stated|noted|explained|commented)\s+(?:by\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+),?\s*(?:the\s+)?([A-Z][A-Za-z\s]+)?/g;
  const ceoPattern = /([A-Z][a-z]+\s+[A-Z][a-z]+),?\s*(?:CEO|Chief Executive|President|CTO|CFO|CDO|CMO)/g;

  for (const result of results) {
    const combined = `${result.title} ${result.snippet}`;

    // Try to extract executive names
    let match;
    while ((match = ceoPattern.exec(combined)) !== null) {
      executives.add(match[1]);
    }

    // Check if this contains a relevant quote
    const algoliaValue = mapQuoteToAlgoliaValue(combined);
    if (algoliaValue) {
      const topicTags = extractTopicTags(combined);
      const relevanceScore = scoreQuoteRelevance(combined);

      // Only include if relevance score is high enough
      if (relevanceScore >= 25) {
        // Determine source type
        let source_type: ExecutiveQuote['source_type'] = 'press_release';
        if (/earnings|call|transcript/i.test(result.title)) {
          source_type = 'earnings_call';
        } else if (/investor day|analyst day/i.test(result.title)) {
          source_type = 'investor_day';
        } else if (/interview/i.test(result.title)) {
          source_type = 'interview';
        }

        // Extract speaker info if available
        const speakerMatch = speakerPattern.exec(combined);
        const speaker = speakerMatch ? speakerMatch[1] : 'Executive';
        const title = speakerMatch?.[2] || 'Leadership';

        quotes.push({
          speaker,
          title,
          quote: result.snippet.slice(0, 500),
          topic_tags: topicTags,
          maps_to_algolia_value: algoliaValue,
          source_url: result.url,
          source_type,
          date: result.date || new Date().toISOString().split('T')[0],
        });

        // Track themes
        for (const tag of topicTags) {
          if (!themeCount[tag]) {
            themeCount[tag] = { count: 0, example: '' };
          }
          themeCount[tag].count++;
          if (!themeCount[tag].example) {
            themeCount[tag].example = result.snippet.slice(0, 200);
          }
        }
      }
    }
  }

  // Sort quotes by relevance
  quotes.sort((a, b) => {
    const scoreA = scoreQuoteRelevance(a.quote);
    const scoreB = scoreQuoteRelevance(b.quote);
    return scoreB - scoreA;
  });

  // Build themes array
  const themes = Object.entries(themeCount)
    .map(([theme, data]) => ({
      theme,
      frequency: data.count,
      example_quote: data.example,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  return {
    domain,
    quotes: quotes.slice(0, 20),
    themes,
    key_executives: Array.from(executives).map(name => ({ name, title: 'Executive' })),
  };
}

/**
 * Parse search results into InvestorData
 */
export function parseInvestorResults(results: SearchResult[], domain: string): InvestorData | null {
  const secFilings: WebSearchSecFiling[] = [];
  const riskFactors: RiskFactor[] = [];
  const earningsHighlights: EarningsHighlight[] = [];

  for (const result of results) {
    const combined = `${result.title} ${result.snippet}`;

    // Check for SEC filings
    if (/10-K|annual report/i.test(result.title)) {
      secFilings.push({
        type: '10-K',
        filing_date: result.date || '',
        url: result.url,
        highlights: [result.snippet.slice(0, 200)],
      });
    } else if (/10-Q|quarterly/i.test(result.title)) {
      secFilings.push({
        type: '10-Q',
        filing_date: result.date || '',
        url: result.url,
        highlights: [result.snippet.slice(0, 200)],
      });
    } else if (/8-K/i.test(result.title)) {
      secFilings.push({
        type: '8-K',
        filing_date: result.date || '',
        url: result.url,
        highlights: [result.snippet.slice(0, 200)],
      });
    }

    // Check for risk factors
    if (/risk factor|risk|MD&A/i.test(combined)) {
      const { category, relevance } = categorizeRiskFactor(combined);
      if (relevance !== 'low' || riskFactors.length < 5) {
        riskFactors.push({
          category,
          description: result.snippet.slice(0, 300),
          relevance_to_algolia: relevance,
        });
      }
    }

    // Check for earnings highlights
    if (/earnings|Q\d|quarter|fiscal/i.test(result.title)) {
      const quarterMatch = result.title.match(/Q(\d)|(\d)Q|(?:first|second|third|fourth)\s+quarter/i);
      const quarter = quarterMatch ? `Q${quarterMatch[1] || quarterMatch[2] || '?'}` : 'Recent';

      earningsHighlights.push({
        quarter,
        key_points: [result.snippet.slice(0, 200)],
        transcript_url: result.url,
      });
    }
  }

  // Return null if we didn't find any investor data
  if (secFilings.length === 0 && riskFactors.length === 0 && earningsHighlights.length === 0) {
    return null;
  }

  // Sort risk factors by relevance
  riskFactors.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.relevance_to_algolia] - order[b.relevance_to_algolia];
  });

  return {
    domain,
    sec_filings: secFilings.slice(0, 10),
    risk_factors: riskFactors.slice(0, 10),
    earnings_highlights: earningsHighlights.slice(0, 8),
  };
}

/**
 * Parse search results into StrategicData
 */
export function parseStrategicResults(results: SearchResult[], domain: string): StrategicData {
  const triggers: StrategicTrigger[] = [];
  const announcements: StrategicData['recent_announcements'] = [];
  const competitiveMoves = new Set<string>();

  for (const result of results) {
    const combined = `${result.title} ${result.snippet}`;

    // Check for strategic triggers
    const eventType = identifyTriggerEventType(combined);
    if (eventType) {
      const relevanceScore = scoreTriggerRelevance(combined, eventType);
      triggers.push({
        event_type: eventType,
        description: result.title,
        date: result.date || new Date().toISOString().split('T')[0],
        source_url: result.url,
        relevance_score: relevanceScore,
      });
    }

    // Check for announcements
    if (/announce|launch|unveil|introduce/i.test(result.title)) {
      announcements.push({
        headline: result.title,
        date: result.date || '',
        url: result.url,
      });
    }

    // Check for competitive moves
    if (/competitor|market share|competitive|vs\./i.test(combined)) {
      competitiveMoves.add(result.snippet.slice(0, 150));
    }
  }

  // Sort triggers by relevance
  triggers.sort((a, b) => b.relevance_score - a.relevance_score);

  return {
    domain,
    triggers: triggers.slice(0, 15),
    recent_announcements: announcements.slice(0, 10),
    competitive_moves: Array.from(competitiveMoves).slice(0, 5),
  };
}

// =============================================================================
// WebSearchProxy Class
// =============================================================================

export class WebSearchProxy {
  /**
   * Generate hiring search queries for a company
   */
  getHiringSearchQueries(company: string, domain: string): string[] {
    return buildHiringSearchQueries(company, domain);
  }

  /**
   * Generate executive search queries for a company
   */
  getExecutiveSearchQueries(company: string): string[] {
    return buildExecutiveSearchQueries(company);
  }

  /**
   * Generate investor/SEC search queries for a company
   */
  getInvestorSearchQueries(company: string, ticker?: string): string[] {
    return buildInvestorSearchQueries(company, ticker);
  }

  /**
   * Generate strategic context search queries for a company
   */
  getStrategicSearchQueries(company: string): string[] {
    return buildStrategicSearchQueries(company);
  }

  /**
   * Parse hiring search results into structured data
   */
  parseHiringResults(results: SearchResult[]): HiringSignal {
    return parseHiringResults(results);
  }

  /**
   * Parse executive search results into structured data
   */
  parseExecutiveResults(results: SearchResult[], domain: string): ExecutiveData {
    return parseExecutiveResults(results, domain);
  }

  /**
   * Parse investor search results into structured data
   */
  parseInvestorResults(results: SearchResult[], domain: string): InvestorData | null {
    return parseInvestorResults(results, domain);
  }

  /**
   * Parse strategic search results into structured data
   */
  parseStrategicResults(results: SearchResult[], domain: string): StrategicData {
    return parseStrategicResults(results, domain);
  }

  /**
   * Get common careers page URLs for a domain
   */
  getCareersPagesUrls(domain: string): string[] {
    return getCareersPagesUrls(domain);
  }

  /**
   * Get SEC EDGAR filing URLs for a ticker
   */
  getEdgarFilingsUrls(ticker: string): string[] {
    return getEdgarFilingsUrls(ticker);
  }

  /**
   * Build SEC EDGAR search URL for a specific filing type
   */
  buildEdgarSearchUrl(company: string, filingType: '10-K' | '10-Q' | '8-K'): string {
    return buildEdgarSearchUrl(company, filingType);
  }

  /**
   * Get full enrichment data using a search executor
   * This is the main entry point when you have a search backend available
   */
  async getFullData(
    company: string,
    domain: string,
    ticker?: string,
    searchExecutor?: SearchExecutor
  ): Promise<WebSearchFullData | null> {
    if (!searchExecutor) {
      // Without a search executor, we can't fetch data
      // Return structure with empty results
      return {
        hiring: {
          signal_strength: 'none',
          total_relevant_openings: 0,
          tier_breakdown: { tier_1_vp: 0, tier_2_director: 0, tier_3_ic: 0 },
          relevant_jobs: [],
          tech_keywords_detected: [],
        },
        executive: {
          domain,
          quotes: [],
          themes: [],
          key_executives: [],
        },
        investor: null,
        strategic: {
          domain,
          triggers: [],
          recent_announcements: [],
          competitive_moves: [],
        },
        fetched_at: new Date().toISOString(),
      };
    }

    try {
      // Execute all searches in parallel
      const [
        hiringResults,
        executiveResults,
        investorResults,
        strategicResults,
      ] = await Promise.all([
        // Hiring - run multiple queries and combine results
        Promise.all(
          this.getHiringSearchQueries(company, domain).slice(0, 5).map(q => searchExecutor.search(q))
        ).then(results => results.flat()),

        // Executive - run multiple queries and combine results
        Promise.all(
          this.getExecutiveSearchQueries(company).slice(0, 5).map(q => searchExecutor.search(q))
        ).then(results => results.flat()),

        // Investor - run multiple queries and combine results
        Promise.all(
          this.getInvestorSearchQueries(company, ticker).slice(0, 5).map(q => searchExecutor.search(q))
        ).then(results => results.flat()),

        // Strategic - run multiple queries and combine results
        Promise.all(
          this.getStrategicSearchQueries(company).slice(0, 5).map(q => searchExecutor.search(q))
        ).then(results => results.flat()),
      ]);

      return {
        hiring: this.parseHiringResults(hiringResults),
        executive: this.parseExecutiveResults(executiveResults, domain),
        investor: this.parseInvestorResults(investorResults, domain),
        strategic: this.parseStrategicResults(strategicResults, domain),
        fetched_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[WebSearchProxy] Error fetching data:', error);
      return null;
    }
  }
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const webSearchProxy = new WebSearchProxy();
