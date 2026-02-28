/**
 * Executive Data Transformer
 *
 * Transforms WebSearch executive data into the ExecutiveData type
 * used throughout the Arian application.
 */

import type { ExecutiveData, ExecutiveQuote, ExecutiveTheme } from '@/types';
import type {
  ExecutiveData as WebSearchExecutiveData,
  ExecutiveQuote as WebSearchQuote,
} from '../clients/websearch';

// ============================================================================
// Algolia Value Mappings
// ============================================================================

const ALGOLIA_VALUE_KEYWORDS: Record<string, string[]> = {
  'Search & Discovery': ['search', 'discovery', 'findability', 'browse', 'catalog', 'site search'],
  'Customer Experience': ['customer experience', 'cx', 'user experience', 'ux', 'engagement'],
  'Revenue & Conversion': ['conversion', 'revenue', 'sales', 'cart', 'checkout', 'aov'],
  Personalization: ['personalization', 'recommendations', 'personalized', '1:1', 'one-to-one'],
  'Mobile Experience': ['mobile', 'app', 'native', 'ios', 'android', 'mobile-first'],
  'Omnichannel Commerce': ['omnichannel', 'unified', 'multichannel', 'cross-channel'],
  Performance: ['speed', 'performance', 'fast', 'milliseconds', 'latency', 'sub-second'],
  Scalability: ['scale', 'traffic', 'volume', 'peak', 'black friday', 'cyber monday'],
  'AI & ML': ['ai', 'ml', 'machine learning', 'intelligence', 'nlp', 'neural'],
  'Digital Transformation': ['digital transformation', 'modernization', 'replatform', 'headless'],
};

// C-Level titles for scoring bonus
const C_LEVEL_TITLES = ['ceo', 'cfo', 'cto', 'cio', 'cdo', 'cmo', 'coo', 'chief'];

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform WebSearch executive data into ExecutiveData type
 */
export function transformExecutiveData(
  domain: string,
  data: WebSearchExecutiveData | null
): ExecutiveData | null {
  if (!data) return null;

  return {
    domain,
    quotes: data.quotes.map(transformQuote),
    themes: data.themes.map(transformTheme),
  };
}

/**
 * Transform a single WebSearch quote to ExecutiveQuote type
 */
export function transformQuote(quote: WebSearchQuote): ExecutiveQuote {
  return {
    speaker: quote.speaker,
    title: quote.title,
    quote: quote.quote,
    topic_tags: quote.topic_tags,
    maps_to_algolia: quote.maps_to_algolia_value || '',
    relevance_score: calculateQuoteRelevance(quote),
    source_url: quote.source_url,
    source_date: quote.date,
  };
}

/**
 * Transform a theme object to ExecutiveTheme type
 */
export function transformTheme(theme: {
  theme: string;
  frequency: number;
  example_quote: string;
}): ExecutiveTheme {
  return {
    theme: theme.theme,
    frequency: theme.frequency,
    example_quote: theme.example_quote,
  };
}

// ============================================================================
// Quote Relevance Scoring
// ============================================================================

/**
 * Calculate relevance score for a quote (0-100)
 */
export function calculateQuoteRelevance(quote: WebSearchQuote): number {
  let score = 0;

  // Algolia value mapping (30 points max)
  if (quote.maps_to_algolia_value && quote.maps_to_algolia_value !== 'None') {
    score += 30;
  }

  // Topic tags (20 points max)
  score += Math.min(20, quote.topic_tags.length * 5);

  // C-level speaker bonus (25 points)
  const titleLower = quote.title.toLowerCase();
  if (C_LEVEL_TITLES.some((title) => titleLower.includes(title))) {
    score += 25;
  }

  // Priority/urgency indicators (15 points)
  const quoteLower = quote.quote.toLowerCase();
  if (/priority|critical|focus|invest|transform|strategic/i.test(quoteLower)) {
    score += 15;
  }

  // Quantitative statements (10 points)
  if (/\d+%|\d+x|million|billion|increase|growth/i.test(quoteLower)) {
    score += 10;
  }

  return Math.min(100, score);
}

// ============================================================================
// Executive Signal Scoring
// ============================================================================

/**
 * Get executive signal score for composite scoring (0-100)
 *
 * Factors:
 * - Quotes mentioning Algolia-relevant topics: up to 40 points
 * - Relevant themes frequency: up to 30 points
 * - C-level speaker bonus: up to 30 points
 */
export function getExecutiveSignalScore(data: ExecutiveData): number {
  let score = 0;

  // Quotes mentioning Algolia-relevant topics (40 points max)
  const relevantQuotes = data.quotes.filter(
    (q) => q.maps_to_algolia && q.maps_to_algolia !== '' && q.maps_to_algolia !== 'None'
  );
  score += Math.min(40, relevantQuotes.length * 10);

  // Themes frequency (30 points max)
  const relevantThemes = data.themes.filter((t) => {
    const themeLower = t.theme.toLowerCase();
    return (
      themeLower.includes('search') ||
      themeLower.includes('customer experience') ||
      themeLower.includes('digital') ||
      themeLower.includes('ecommerce') ||
      themeLower.includes('conversion') ||
      themeLower.includes('personalization')
    );
  });
  score += Math.min(30, relevantThemes.reduce((sum, t) => sum + t.frequency * 5, 0));

  // C-level speaker bonus (30 points max)
  const cLevelQuotes = data.quotes.filter((q) => {
    const titleLower = q.title.toLowerCase();
    return C_LEVEL_TITLES.some((title) => titleLower.includes(title));
  });
  score += Math.min(30, cLevelQuotes.length * 10);

  return Math.min(100, score);
}

/**
 * Classify executive signal level
 */
export function getExecutiveSignalLevel(data: ExecutiveData): 'high' | 'medium' | 'low' | 'none' {
  const score = getExecutiveSignalScore(data);
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 15) return 'low';
  return 'none';
}

// ============================================================================
// Strategic Priority Extraction
// ============================================================================

/**
 * Extract key strategic priorities from quotes
 * Returns unique Algolia value mappings, limited to top 5
 */
export function extractStrategicPriorities(data: ExecutiveData): string[] {
  const priorities: string[] = [];

  for (const quote of data.quotes) {
    if (quote.maps_to_algolia && quote.maps_to_algolia !== '' && quote.maps_to_algolia !== 'None') {
      if (!priorities.includes(quote.maps_to_algolia)) {
        priorities.push(quote.maps_to_algolia);
      }
    }
  }

  return priorities.slice(0, 5);
}

/**
 * Map a text to Algolia value proposition
 */
export function mapTextToAlgoliaValue(text: string): string | null {
  const textLower = text.toLowerCase();

  for (const [value, keywords] of Object.entries(ALGOLIA_VALUE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        return value;
      }
    }
  }

  return null;
}

// ============================================================================
// C-Level Quote Analysis
// ============================================================================

/**
 * Get quotes from C-level executives only
 */
export function getCLevelQuotes(data: ExecutiveData): ExecutiveQuote[] {
  return data.quotes.filter((q) => {
    const titleLower = q.title.toLowerCase();
    return C_LEVEL_TITLES.some((title) => titleLower.includes(title));
  });
}

/**
 * Check if there are any CEO quotes
 */
export function hasCEOQuotes(data: ExecutiveData): boolean {
  return data.quotes.some((q) => q.title.toLowerCase().includes('ceo'));
}

/**
 * Get the most senior speaker
 */
export function getMostSeniorSpeaker(data: ExecutiveData): ExecutiveQuote | null {
  const seniorityOrder = ['ceo', 'cfo', 'coo', 'cto', 'cio', 'cdo', 'cmo', 'chief'];

  for (const title of seniorityOrder) {
    const quote = data.quotes.find((q) => q.title.toLowerCase().includes(title));
    if (quote) return quote;
  }

  return data.quotes.length > 0 ? data.quotes[0] : null;
}

// ============================================================================
// Theme Analysis
// ============================================================================

/**
 * Get the most frequent theme
 */
export function getMostFrequentTheme(data: ExecutiveData): ExecutiveTheme | null {
  if (data.themes.length === 0) return null;
  return data.themes.reduce((max, theme) => (theme.frequency > max.frequency ? theme : max));
}

/**
 * Get themes related to search/discovery
 */
export function getSearchRelatedThemes(data: ExecutiveData): ExecutiveTheme[] {
  const searchKeywords = ['search', 'discovery', 'findability', 'browse', 'catalog'];
  return data.themes.filter((t) => {
    const themeLower = t.theme.toLowerCase();
    return searchKeywords.some((keyword) => themeLower.includes(keyword));
  });
}

/**
 * Get themes related to customer experience
 */
export function getCXRelatedThemes(data: ExecutiveData): ExecutiveTheme[] {
  const cxKeywords = ['customer', 'experience', 'engagement', 'satisfaction', 'loyalty'];
  return data.themes.filter((t) => {
    const themeLower = t.theme.toLowerCase();
    return cxKeywords.some((keyword) => themeLower.includes(keyword));
  });
}

// ============================================================================
// Quote Categorization
// ============================================================================

/**
 * Categorize quotes by their Algolia value mapping
 */
export function categorizeQuotes(data: ExecutiveData): Record<string, ExecutiveQuote[]> {
  const categories: Record<string, ExecutiveQuote[]> = {};

  for (const quote of data.quotes) {
    const category = quote.maps_to_algolia || 'Other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(quote);
  }

  return categories;
}

/**
 * Get quotes mentioning specific Algolia value
 */
export function getQuotesByValue(data: ExecutiveData, value: string): ExecutiveQuote[] {
  return data.quotes.filter((q) => q.maps_to_algolia === value);
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format executive quote for display
 */
export function formatQuoteForDisplay(quote: ExecutiveQuote): string {
  return `"${quote.quote}" - ${quote.speaker}, ${quote.title}`;
}

/**
 * Get executive data summary
 */
export function getExecutiveSummary(data: ExecutiveData): string {
  const cLevelCount = getCLevelQuotes(data).length;
  const priorities = extractStrategicPriorities(data);

  if (cLevelCount === 0) {
    return 'No C-level executive quotes found';
  }

  const priorityText = priorities.length > 0 ? `, focusing on ${priorities.slice(0, 2).join(', ')}` : '';

  return `${cLevelCount} C-level quote${cLevelCount > 1 ? 's' : ''}${priorityText}`;
}

/**
 * Get the best quote for a quick look
 */
export function getBestQuote(data: ExecutiveData): ExecutiveQuote | null {
  if (data.quotes.length === 0) return null;

  // Sort by relevance score and return the highest
  const sorted = [...data.quotes].sort((a, b) => b.relevance_score - a.relevance_score);
  return sorted[0];
}

// ============================================================================
// Extended Executive Insights Type
// ============================================================================

export interface ExecutiveInsights {
  key_quotes: Array<{
    speaker: string;
    title: string;
    quote: string;
    algolia_relevance: 'high' | 'medium' | 'low';
    value_prop_mapping: string;  // Which Algolia value prop this maps to
    source: {
      type: 'earnings_call' | 'investor_day' | 'interview' | 'press_release';
      url: string;
      date: string;
    };
  }>;

  strategic_themes: Array<{
    theme: string;
    frequency: number;
    example_quotes: string[];
    algolia_angle: string;  // How Algolia addresses this theme
  }>;

  key_executives: Array<{
    name: string;
    title: string;
    tenure_years?: number;
    has_relevant_quotes: boolean;
  }>;

  // Summary metrics
  total_quotes: number;
  high_relevance_quotes: number;
  themes_identified: number;

  // Sales enablement
  speaking_their_language: string[];  // Key phrases to use in outreach

  fetched_at: string;
}

// ============================================================================
// Algolia Value Prop Constants
// ============================================================================

export const ALGOLIA_VALUE_PROPS: Record<string, string> = {
  'search_discovery': 'Search & Discovery',
  'customer_experience': 'Customer Experience',
  'conversion': 'Conversion Optimization',
  'personalization': 'Personalization',
  'mobile': 'Mobile Experience',
  'performance': 'Site Performance',
  'ai_ml': 'AI/ML Capabilities',
  'developer_experience': 'Developer Experience',
  'scalability': 'Scalability & Reliability',
  'analytics': 'Search Analytics',
};

// Theme to Algolia angle mappings
const THEME_TO_ALGOLIA_ANGLE: Record<string, string> = {
  'search': 'Algolia provides sub-200ms search experiences that drive 30%+ conversion lifts',
  'discovery': 'Algolia Discovery helps customers find products they didn\'t know they wanted',
  'customer experience': 'Algolia powers seamless customer journeys across all touchpoints',
  'personalization': 'Algolia Recommend delivers 1:1 personalization at scale',
  'mobile': 'Algolia\'s mobile-optimized SDKs deliver native-quality search experiences',
  'conversion': 'Algolia customers see 10-30% conversion improvements on average',
  'digital transformation': 'Algolia accelerates digital transformation with fast, flexible APIs',
  'performance': 'Algolia\'s distributed infrastructure delivers 99.999% uptime',
  'scale': 'Algolia handles billions of queries with consistent sub-50ms latency',
  'ecommerce': 'Algolia powers search for 17,000+ customers including 30% of Fortune 500',
};

// ============================================================================
// Extended Transformers
// ============================================================================

/**
 * Score quote relevance for Algolia
 * Returns 'high', 'medium', or 'low'
 */
export function scoreQuoteRelevanceLevel(quote: string): 'high' | 'medium' | 'low' {
  const quoteLower = quote.toLowerCase();
  let score = 0;

  // High relevance keywords
  const highKeywords = ['search', 'discovery', 'findability', 'relevance', 'personalization', 'recommendations'];
  if (highKeywords.some((kw) => quoteLower.includes(kw))) {
    score += 50;
  }

  // Medium relevance keywords
  const mediumKeywords = ['customer experience', 'conversion', 'digital', 'ecommerce', 'mobile', 'engagement'];
  if (mediumKeywords.some((kw) => quoteLower.includes(kw))) {
    score += 30;
  }

  // Urgency indicators
  if (/priority|critical|focus|invest|transform|strategic/i.test(quote)) {
    score += 15;
  }

  // Quantitative statements
  if (/\d+%|\d+x|million|billion|increase|growth/i.test(quote)) {
    score += 10;
  }

  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/**
 * Map quote text to an Algolia value prop
 */
export function mapQuoteToAlgoliaValueProp(quote: string): string {
  const quoteLower = quote.toLowerCase();

  // Direct keyword mappings
  const mappings: Array<{ keywords: string[]; value: string }> = [
    { keywords: ['search', 'findability', 'browse', 'catalog'], value: ALGOLIA_VALUE_PROPS.search_discovery },
    { keywords: ['customer experience', 'cx', 'user experience', 'ux'], value: ALGOLIA_VALUE_PROPS.customer_experience },
    { keywords: ['conversion', 'revenue', 'sales', 'checkout'], value: ALGOLIA_VALUE_PROPS.conversion },
    { keywords: ['personalization', 'recommendations', 'personalized'], value: ALGOLIA_VALUE_PROPS.personalization },
    { keywords: ['mobile', 'app', 'ios', 'android'], value: ALGOLIA_VALUE_PROPS.mobile },
    { keywords: ['performance', 'speed', 'fast', 'latency'], value: ALGOLIA_VALUE_PROPS.performance },
    { keywords: ['ai', 'ml', 'machine learning', 'nlp'], value: ALGOLIA_VALUE_PROPS.ai_ml },
    { keywords: ['developer', 'api', 'integration'], value: ALGOLIA_VALUE_PROPS.developer_experience },
    { keywords: ['scale', 'traffic', 'volume', 'peak'], value: ALGOLIA_VALUE_PROPS.scalability },
    { keywords: ['analytics', 'insights', 'data'], value: ALGOLIA_VALUE_PROPS.analytics },
  ];

  for (const mapping of mappings) {
    for (const keyword of mapping.keywords) {
      if (quoteLower.includes(keyword)) {
        return mapping.value;
      }
    }
  }

  return 'General';
}

/**
 * Extract key phrases that can be used in outreach ("Speaking Their Language")
 */
export function extractSpeakingPhrases(quotes: ExecutiveQuote[]): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();

  for (const quote of quotes) {
    // Extract phrases that are in quotes within the quote text
    const quotedPhrases = quote.quote.match(/"([^"]+)"/g);
    if (quotedPhrases) {
      for (const phrase of quotedPhrases) {
        const clean = phrase.replace(/"/g, '').trim();
        if (clean.length > 5 && clean.length < 50 && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          phrases.push(clean);
        }
      }
    }

    // Extract strategic phrases
    const strategicPatterns = [
      /our (focus|priority|strategy) is ([^,.]+)/gi,
      /we are (committed|focused|investing) (in|on) ([^,.]+)/gi,
      /(key|critical|important) to our (success|growth|strategy)/gi,
    ];

    for (const pattern of strategicPatterns) {
      const matches = quote.quote.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (!seen.has(match.toLowerCase())) {
            seen.add(match.toLowerCase());
            phrases.push(match);
          }
        }
      }
    }
  }

  return phrases.slice(0, 10);
}

/**
 * Generate Algolia angle for a theme
 */
export function generateAlgoliaAngle(theme: string): string {
  const themeLower = theme.toLowerCase();

  for (const [key, angle] of Object.entries(THEME_TO_ALGOLIA_ANGLE)) {
    if (themeLower.includes(key)) {
      return angle;
    }
  }

  // Default angle
  return 'Algolia helps enterprises deliver better digital experiences through AI-powered search and discovery';
}

/**
 * Transform ExecutiveData into ExecutiveInsights
 */
export function transformToExecutiveInsights(data: ExecutiveData): ExecutiveInsights {
  // Transform quotes
  const key_quotes = data.quotes.slice(0, 15).map((q) => ({
    speaker: q.speaker,
    title: q.title,
    quote: q.quote,
    algolia_relevance: scoreQuoteRelevanceLevel(q.quote),
    value_prop_mapping: mapQuoteToAlgoliaValueProp(q.quote),
    source: {
      type: inferSourceType(q.source_url) as ExecutiveInsights['key_quotes'][0]['source']['type'],
      url: q.source_url,
      date: q.source_date,
    },
  }));

  // Transform themes with Algolia angles
  const strategic_themes = data.themes.slice(0, 8).map((t) => ({
    theme: t.theme,
    frequency: t.frequency,
    example_quotes: t.example_quote ? [t.example_quote] : [],
    algolia_angle: generateAlgoliaAngle(t.theme),
  }));

  // Build key executives list
  const executiveNames = new Set<string>();
  const key_executives: ExecutiveInsights['key_executives'] = [];

  for (const quote of data.quotes) {
    if (!executiveNames.has(quote.speaker)) {
      executiveNames.add(quote.speaker);
      key_executives.push({
        name: quote.speaker,
        title: quote.title,
        has_relevant_quotes: scoreQuoteRelevanceLevel(quote.quote) !== 'low',
      });
    }
  }

  // Extract speaking phrases
  const speaking_their_language = extractSpeakingPhrases(data.quotes);

  // Calculate summary metrics
  const high_relevance_quotes = key_quotes.filter((q) => q.algolia_relevance === 'high').length;

  return {
    key_quotes,
    strategic_themes,
    key_executives: key_executives.slice(0, 10),
    total_quotes: data.quotes.length,
    high_relevance_quotes,
    themes_identified: strategic_themes.length,
    speaking_their_language,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Infer source type from URL
 */
function inferSourceType(url: string): string {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('earnings') || urlLower.includes('transcript')) {
    return 'earnings_call';
  }
  if (urlLower.includes('investor') || urlLower.includes('analyst')) {
    return 'investor_day';
  }
  if (urlLower.includes('interview') || urlLower.includes('cnbc') || urlLower.includes('bloomberg')) {
    return 'interview';
  }
  return 'press_release';
}

/**
 * Get top actionable insights from executive data
 */
export function getExecutiveActionableInsights(data: ExecutiveData): string[] {
  const insights: string[] = [];
  const cLevelQuotes = getCLevelQuotes(data);
  const priorities = extractStrategicPriorities(data);

  if (cLevelQuotes.length > 0) {
    const topQuote = cLevelQuotes[0];
    insights.push(
      `${topQuote.speaker} (${topQuote.title}) is focused on: ${priorities.slice(0, 2).join(', ')}`
    );
  }

  const searchThemes = getSearchRelatedThemes(data);
  if (searchThemes.length > 0) {
    insights.push(
      `Company discusses "${searchThemes[0].theme}" ${searchThemes[0].frequency}x - strong Algolia alignment`
    );
  }

  const cxThemes = getCXRelatedThemes(data);
  if (cxThemes.length > 0) {
    insights.push(`Customer experience is a recurring theme - ${cxThemes.length} mentions`);
  }

  return insights;
}
