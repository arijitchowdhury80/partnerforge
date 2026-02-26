/**
 * Enrichment Service v2.0
 *
 * Multi-source enrichment pipeline:
 * 1. SimilarWeb - Traffic, engagement, competitors (similar-sites)
 * 2. BuiltWith - Full tech stack detection
 * 3. Algolia Customer Cross-Reference - Which competitors use Algolia
 * 4. Case Study Matching - Reference implementations by vertical
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const SIMILARWEB_API_KEY = import.meta.env.VITE_SIMILARWEB_API_KEY;
const BUILTWITH_API_KEY = import.meta.env.VITE_BUILTWITH_API_KEY;

// =============================================================================
// Types
// =============================================================================

export interface EnrichmentResult {
  success: boolean;
  domain: string;
  data?: EnrichedCompanyData;
  error?: string;
}

export interface EnrichmentProgress {
  domain: string;
  status: 'pending' | 'fetching' | 'updating' | 'complete' | 'error';
  message: string;
  step?: string;
}

export interface EnrichedCompanyData {
  // Traffic (SimilarWeb)
  sw_monthly_visits?: number;
  sw_bounce_rate?: number;
  sw_pages_per_visit?: number;
  sw_time_on_site?: number;
  sw_global_rank?: number;
  sw_category_rank?: number;
  traffic_growth?: number;

  // Category
  vertical?: string;
  country?: string;

  // Tech Stack (BuiltWith)
  tech_stack_json?: string;
  current_search?: string;
  cms?: string;
  ecommerce_platform?: string;
  cdn?: string;

  // Competitors (SimilarWeb similar-sites)
  competitors_json?: string;
  competitor_count?: number;
  competitors_using_algolia?: number;

  // Case Studies
  case_studies_json?: string;
  reference_implementation?: string;
}

export interface Competitor {
  domain: string;
  company_name?: string;
  similarity_score: number;
  search_provider?: string;
  using_algolia: boolean;
}

export interface CaseStudy {
  title: string;
  company: string;
  vertical: string;
  url: string;
  highlights?: string[];
}

// =============================================================================
// SimilarWeb API - Traffic & Engagement
// =============================================================================

interface SimilarWebTrafficResponse {
  visits?: number;
  category?: string;
  country?: number;
  global_rank?: { rank?: number };
  category_rank?: { category?: string; rank?: number };
  pages_per_visit?: number;
  time_on_site?: number;
  bounce_rate?: number;
}

async function fetchSimilarWebTraffic(domain: string): Promise<SimilarWebTrafficResponse | null> {
  if (!SIMILARWEB_API_KEY) {
    console.warn('[Enrichment] No SimilarWeb API key');
    return null;
  }

  const endpoints = [
    `https://api.similarweb.com/v1/SimilarWebAddon/${domain}/all`,
    `https://api.similarweb.com/v1/website/${domain}/total-traffic-and-engagement/visits`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(`${url}?api_key=${SIMILARWEB_API_KEY}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn(`[Enrichment] SimilarWeb traffic error:`, err);
    }
  }
  return null;
}

// =============================================================================
// SimilarWeb API - Similar Sites (Competitors)
// =============================================================================

interface SimilarWebSimilarSite {
  url: string;
  score: number;
}

async function fetchSimilarWebCompetitors(domain: string): Promise<SimilarWebSimilarSite[]> {
  if (!SIMILARWEB_API_KEY) return [];

  try {
    const url = `https://api.similarweb.com/v1/website/${domain}/similar-sites/similarsites?api_key=${SIMILARWEB_API_KEY}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      // API returns { similar_sites: [{url, score}, ...] }
      return data.similar_sites || [];
    }
  } catch (err) {
    console.warn(`[Enrichment] SimilarWeb competitors error:`, err);
  }
  return [];
}

// =============================================================================
// BuiltWith API - Tech Stack Detection
// =============================================================================

interface BuiltWithTech {
  Name: string;
  Tag: string;
  Categories?: string[];
}

interface BuiltWithResponse {
  Results?: Array<{
    Result?: {
      Paths?: Array<{
        Technologies?: BuiltWithTech[];
      }>;
    };
  }>;
}

interface TechStackResult {
  cms: string[];
  ecommerce: string[];
  analytics: string[];
  search: string[];
  cdn: string[];
  payment: string[];
  marketing: string[];
  frameworks: string[];
  all: BuiltWithTech[];
}

async function fetchBuiltWithTechStack(domain: string): Promise<TechStackResult | null> {
  if (!BUILTWITH_API_KEY) {
    console.warn('[Enrichment] No BuiltWith API key');
    return null;
  }

  try {
    const url = `https://api.builtwith.com/free1/api.json?KEY=${BUILTWITH_API_KEY}&LOOKUP=${domain}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[Enrichment] BuiltWith ${response.status}`);
      return null;
    }

    const data: BuiltWithResponse = await response.json();
    const techs = data.Results?.[0]?.Result?.Paths?.[0]?.Technologies || [];

    // Categorize technologies
    const result: TechStackResult = {
      cms: [],
      ecommerce: [],
      analytics: [],
      search: [],
      cdn: [],
      payment: [],
      marketing: [],
      frameworks: [],
      all: techs,
    };

    for (const tech of techs) {
      const name = tech.Name;
      const tag = (tech.Tag || '').toLowerCase();
      const cats = (tech.Categories || []).map(c => c.toLowerCase()).join(' ');
      const combined = `${tag} ${cats}`;

      // CMS
      if (combined.includes('cms') || combined.includes('content')) {
        result.cms.push(name);
      }
      // E-commerce
      if (combined.includes('ecommerce') || combined.includes('shop') || combined.includes('cart')) {
        result.ecommerce.push(name);
      }
      // Analytics
      if (combined.includes('analytics') || combined.includes('tracking')) {
        result.analytics.push(name);
      }
      // Search
      if (combined.includes('search') || name.toLowerCase().includes('search') ||
          name.toLowerCase().includes('algolia') || name.toLowerCase().includes('elastic')) {
        result.search.push(name);
      }
      // CDN
      if (combined.includes('cdn') || combined.includes('hosting')) {
        result.cdn.push(name);
      }
      // Payment
      if (combined.includes('payment') || combined.includes('checkout')) {
        result.payment.push(name);
      }
      // Marketing
      if (combined.includes('marketing') || combined.includes('email') || combined.includes('crm')) {
        result.marketing.push(name);
      }
      // Frameworks
      if (combined.includes('framework') || combined.includes('javascript')) {
        result.frameworks.push(name);
      }
    }

    return result;
  } catch (err) {
    console.warn(`[Enrichment] BuiltWith error:`, err);
    return null;
  }
}

// =============================================================================
// Algolia Customer Detection
// =============================================================================

// Known Algolia customers - this would ideally come from a database
const KNOWN_ALGOLIA_CUSTOMERS = new Set([
  'lacoste.com', 'staples.com', 'gymshark.com', 'discord.com', 'twitch.tv',
  'stripe.com', 'slack.com', 'medium.com', 'birchbox.com', 'vimeo.com',
  'asos.com', 'underarmour.com', 'decathlon.com', 'sephora.com',
  'lacoste.com', 'coupa.com', 'zendesk.com', 'perplexity.ai',
  // Add more as needed
]);

function checkIfAlgoliaCustomer(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().replace('www.', '');
  return KNOWN_ALGOLIA_CUSTOMERS.has(normalizedDomain);
}

async function detectSearchProvider(techStack: TechStackResult | null, domain: string): Promise<string | undefined> {
  const searchTechs = techStack?.search || [];

  for (const tech of searchTechs) {
    const name = tech.toLowerCase();
    if (name.includes('algolia')) return 'Algolia';
    if (name.includes('elastic')) return 'Elasticsearch';
    if (name.includes('constructor')) return 'Constructor IO';
    if (name.includes('coveo')) return 'Coveo';
    if (name.includes('lucidworks') || name.includes('solr')) return 'Lucidworks/Solr';
    if (name.includes('searchspring')) return 'SearchSpring';
    if (name.includes('bloomreach')) return 'Bloomreach';
    if (name.includes('klevu')) return 'Klevu';
  }

  // If in known customers list, they use Algolia
  if (checkIfAlgoliaCustomer(domain)) {
    return 'Algolia';
  }

  return undefined;
}

// =============================================================================
// Case Study Matching by Vertical
// =============================================================================

const CASE_STUDIES_BY_VERTICAL: Record<string, CaseStudy[]> = {
  'Retail': [
    { title: 'Staples: 3x search engagement', company: 'Staples', vertical: 'Retail', url: 'https://www.algolia.com/customers/staples/', highlights: ['3x search engagement', 'Mobile-first'] },
    { title: 'Decathlon: 50% faster search', company: 'Decathlon', vertical: 'Retail', url: 'https://www.algolia.com/customers/decathlon/', highlights: ['50% faster', '35+ countries'] },
  ],
  'Fashion': [
    { title: 'ASOS: Personalized search at scale', company: 'ASOS', vertical: 'Fashion', url: 'https://www.algolia.com/customers/asos/', highlights: ['85K products', 'Personalization'] },
    { title: 'Lacoste: Premium search experience', company: 'Lacoste', vertical: 'Fashion', url: 'https://www.algolia.com/customers/lacoste/', highlights: ['Global rollout', 'Premium UX'] },
    { title: 'Gymshark: Search-driven growth', company: 'Gymshark', vertical: 'Fashion', url: 'https://www.algolia.com/customers/gymshark/', highlights: ['D2C success', 'Mobile'] },
  ],
  'Consumer Cyclical': [
    { title: 'Under Armour: Unified commerce search', company: 'Under Armour', vertical: 'Consumer Cyclical', url: 'https://www.algolia.com/customers/under-armour/', highlights: ['Unified commerce', 'Omnichannel'] },
  ],
  'Technology And Computing': [
    { title: 'Stripe: Developer docs search', company: 'Stripe', vertical: 'Technology', url: 'https://www.algolia.com/customers/stripe/', highlights: ['Developer experience', 'Doc search'] },
    { title: 'Slack: Workspace search', company: 'Slack', vertical: 'Technology', url: 'https://www.algolia.com/customers/slack/', highlights: ['Enterprise', 'Real-time'] },
  ],
  'Media': [
    { title: 'Medium: Content discovery', company: 'Medium', vertical: 'Media', url: 'https://www.algolia.com/customers/medium/', highlights: ['Content search', 'Recommendations'] },
    { title: 'Twitch: Live content search', company: 'Twitch', vertical: 'Media', url: 'https://www.algolia.com/customers/twitch/', highlights: ['Real-time', 'Live content'] },
  ],
  'Finance': [
    { title: 'Coupa: B2B procurement search', company: 'Coupa', vertical: 'Finance', url: 'https://www.algolia.com/customers/coupa/', highlights: ['B2B', 'Enterprise'] },
  ],
  'Health And Fitness': [
    { title: 'Birchbox: Subscription discovery', company: 'Birchbox', vertical: 'Health And Fitness', url: 'https://www.algolia.com/customers/birchbox/', highlights: ['Subscription', 'Discovery'] },
  ],
};

function findCaseStudiesForVertical(vertical: string | undefined): CaseStudy[] {
  if (!vertical) return [];

  // Direct match
  if (CASE_STUDIES_BY_VERTICAL[vertical]) {
    return CASE_STUDIES_BY_VERTICAL[vertical];
  }

  // Fuzzy match
  const verticalLower = vertical.toLowerCase();
  for (const [key, studies] of Object.entries(CASE_STUDIES_BY_VERTICAL)) {
    if (key.toLowerCase().includes(verticalLower) || verticalLower.includes(key.toLowerCase())) {
      return studies;
    }
  }

  return [];
}

// =============================================================================
// Supabase Update
// =============================================================================

async function updateSupabase(
  domain: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!SUPABASE_KEY) {
    console.error('[Enrichment] No Supabase key');
    return false;
  }

  const url = `${SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.${encodeURIComponent(domain)}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        ...data,
        last_enriched: new Date().toISOString(),
        enrichment_level: 'full',
      }),
    });

    if (!response.ok) {
      console.error(`[Enrichment] Supabase update failed: ${await response.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Enrichment] Supabase error:`, err);
    return false;
  }
}

// =============================================================================
// Category Mapping
// =============================================================================

function mapCategory(category: string | undefined): string {
  if (!category) return 'Unknown';
  const cat = category.toLowerCase();

  if (cat.includes('auto')) return 'Automotive And Vehicles';
  if (cat.includes('retail') || cat.includes('shopping')) return 'Retail';
  if (cat.includes('health')) return 'Health And Fitness';
  if (cat.includes('finance') || cat.includes('banking')) return 'Finance';
  if (cat.includes('tech') || cat.includes('computer')) return 'Technology And Computing';
  if (cat.includes('media') || cat.includes('entertainment')) return 'Art And Entertainment';
  if (cat.includes('business') || cat.includes('industry')) return 'Business And Industrial';
  if (cat.includes('food')) return 'Food And Drink';
  if (cat.includes('fashion') || cat.includes('style') || cat.includes('apparel')) return 'Fashion';
  if (cat.includes('travel')) return 'Travel';
  if (cat.includes('consumer')) return 'Consumer Cyclical';

  return category;
}

// =============================================================================
// Main Enrichment Function
// =============================================================================

export async function enrichCompany(
  domain: string,
  onProgress?: (progress: EnrichmentProgress) => void
): Promise<EnrichmentResult> {
  const enrichedData: EnrichedCompanyData = {};

  // Step 1: SimilarWeb Traffic
  onProgress?.({
    domain,
    status: 'fetching',
    message: 'Fetching traffic data...',
    step: 'traffic',
  });

  const swTraffic = await fetchSimilarWebTraffic(domain);
  if (swTraffic) {
    enrichedData.sw_monthly_visits = swTraffic.visits;
    enrichedData.sw_bounce_rate = swTraffic.bounce_rate;
    enrichedData.sw_pages_per_visit = swTraffic.pages_per_visit;
    enrichedData.sw_time_on_site = swTraffic.time_on_site;
    enrichedData.sw_global_rank = swTraffic.global_rank?.rank;
    enrichedData.sw_category_rank = swTraffic.category_rank?.rank;
    enrichedData.vertical = mapCategory(swTraffic.category || swTraffic.category_rank?.category);
  }

  // Step 2: BuiltWith Tech Stack
  onProgress?.({
    domain,
    status: 'fetching',
    message: 'Detecting tech stack...',
    step: 'techstack',
  });

  const techStack = await fetchBuiltWithTechStack(domain);
  if (techStack) {
    enrichedData.tech_stack_json = JSON.stringify({
      cms: techStack.cms,
      ecommerce: techStack.ecommerce,
      analytics: techStack.analytics,
      search: techStack.search,
      cdn: techStack.cdn,
      payment: techStack.payment,
      marketing: techStack.marketing,
      frameworks: techStack.frameworks,
    });
    enrichedData.cms = techStack.cms[0];
    enrichedData.ecommerce_platform = techStack.ecommerce[0];
    enrichedData.cdn = techStack.cdn[0];
    enrichedData.current_search = await detectSearchProvider(techStack, domain);
  }

  // Step 3: SimilarWeb Competitors
  onProgress?.({
    domain,
    status: 'fetching',
    message: 'Finding competitors...',
    step: 'competitors',
  });

  const similarSites = await fetchSimilarWebCompetitors(domain);
  if (similarSites.length > 0) {
    const competitors: Competitor[] = [];
    let algoliaCount = 0;

    // Check each competitor for Algolia usage (limit to top 10 for API rate limits)
    for (const site of similarSites.slice(0, 10)) {
      const compDomain = site.url.replace('www.', '');
      const usesAlgolia = checkIfAlgoliaCustomer(compDomain);

      if (usesAlgolia) algoliaCount++;

      competitors.push({
        domain: compDomain,
        similarity_score: Math.round(site.score * 100),
        using_algolia: usesAlgolia,
      });
    }

    enrichedData.competitors_json = JSON.stringify(competitors);
    enrichedData.competitor_count = competitors.length;
    enrichedData.competitors_using_algolia = algoliaCount;
  }

  // Step 4: Case Study Matching
  onProgress?.({
    domain,
    status: 'fetching',
    message: 'Matching case studies...',
    step: 'casestudies',
  });

  const caseStudies = findCaseStudiesForVertical(enrichedData.vertical);
  if (caseStudies.length > 0) {
    enrichedData.case_studies_json = JSON.stringify(caseStudies);
    enrichedData.reference_implementation = caseStudies[0].company;
  }

  // Step 5: Update Supabase
  onProgress?.({
    domain,
    status: 'updating',
    message: 'Saving enriched data...',
    step: 'save',
  });

  const updated = await updateSupabase(domain, enrichedData as unknown as Record<string, unknown>);

  if (!updated) {
    onProgress?.({
      domain,
      status: 'error',
      message: 'Failed to save enriched data',
    });
    return { success: false, domain, error: 'Database update failed' };
  }

  // Success summary
  const summary = [
    swTraffic?.visits ? `${(swTraffic.visits / 1000000).toFixed(1)}M visits` : null,
    techStack ? `${techStack.all.length} technologies` : null,
    similarSites.length > 0 ? `${similarSites.length} competitors` : null,
    caseStudies.length > 0 ? `${caseStudies.length} case studies` : null,
  ].filter(Boolean).join(', ');

  onProgress?.({
    domain,
    status: 'complete',
    message: `Enriched: ${summary || 'Data updated'}`,
  });

  return {
    success: true,
    domain,
    data: enrichedData,
  };
}

// =============================================================================
// Batch Enrichment
// =============================================================================

export async function enrichBatch(
  domains: string[],
  onProgress?: (domain: string, progress: EnrichmentProgress) => void
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];

  for (const domain of domains) {
    const result = await enrichCompany(domain, (progress) => {
      onProgress?.(domain, progress);
    });
    results.push(result);

    // Rate limiting - 1 second between full enrichments
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

// =============================================================================
// Quick Competitor Check (for UI display without full enrichment)
// =============================================================================

export async function getCompetitorsQuick(domain: string): Promise<Competitor[]> {
  const similarSites = await fetchSimilarWebCompetitors(domain);

  return similarSites.slice(0, 10).map(site => ({
    domain: site.url.replace('www.', ''),
    similarity_score: Math.round(site.score * 100),
    using_algolia: checkIfAlgoliaCustomer(site.url),
  }));
}

// =============================================================================
// Deep Competitor Analysis - 3-Step Pipeline
// SimilarWeb → BuiltWith for each competitor → Algolia detection
// =============================================================================

export interface CompetitorWithTech extends Competitor {
  tech_stack?: {
    cms?: string[];
    ecommerce?: string[];
    search?: string[];
    analytics?: string[];
  };
  search_provider_detected?: string;
  fetched_at?: string;
}

export interface CompetitorAnalysisProgress {
  total: number;
  completed: number;
  current_domain?: string;
  status: 'pending' | 'fetching_competitors' | 'analyzing_tech' | 'complete' | 'error';
  message: string;
}

/**
 * Deep competitor analysis with full BuiltWith tech stack for each competitor.
 * This is the 3-step process:
 * 1. SimilarWeb - Get similar sites (competitors)
 * 2. BuiltWith - Get tech stack for each competitor
 * 3. Analysis - Determine search providers, flag Algolia users
 */
export async function analyzeCompetitorsDeep(
  domain: string,
  onProgress?: (progress: CompetitorAnalysisProgress) => void
): Promise<CompetitorWithTech[]> {
  // Step 1: Get competitors from SimilarWeb
  onProgress?.({
    total: 0,
    completed: 0,
    status: 'fetching_competitors',
    message: 'Fetching competitors from SimilarWeb...',
  });

  const similarSites = await fetchSimilarWebCompetitors(domain);

  if (similarSites.length === 0) {
    onProgress?.({
      total: 0,
      completed: 0,
      status: 'complete',
      message: 'No competitors found',
    });
    return [];
  }

  const competitors: CompetitorWithTech[] = [];
  const topCompetitors = similarSites.slice(0, 8); // Limit to 8 to avoid API rate limits

  // Step 2: For each competitor, fetch BuiltWith tech stack
  for (let i = 0; i < topCompetitors.length; i++) {
    const site = topCompetitors[i];
    const compDomain = site.url.replace('www.', '');

    onProgress?.({
      total: topCompetitors.length,
      completed: i,
      current_domain: compDomain,
      status: 'analyzing_tech',
      message: `Analyzing tech stack: ${compDomain} (${i + 1}/${topCompetitors.length})`,
    });

    let searchProvider: string | undefined;
    let techStack: CompetitorWithTech['tech_stack'];
    let usesAlgolia = false;

    // Try to get BuiltWith data for this competitor
    try {
      const bwData = await fetchBuiltWithTechStack(compDomain);
      if (bwData) {
        techStack = {
          cms: bwData.cms,
          ecommerce: bwData.ecommerce,
          search: bwData.search,
          analytics: bwData.analytics,
        };

        // Detect search provider from tech stack
        searchProvider = await detectSearchProvider(bwData, compDomain);
        usesAlgolia = searchProvider?.toLowerCase().includes('algolia') || checkIfAlgoliaCustomer(compDomain);
      } else {
        // Fallback to known customers check
        usesAlgolia = checkIfAlgoliaCustomer(compDomain);
      }
    } catch (err) {
      console.warn(`[Enrichment] Error analyzing ${compDomain}:`, err);
      // Fallback
      usesAlgolia = checkIfAlgoliaCustomer(compDomain);
    }

    competitors.push({
      domain: compDomain,
      similarity_score: Math.round(site.score * 100),
      using_algolia: usesAlgolia,
      search_provider: searchProvider,
      search_provider_detected: searchProvider,
      tech_stack: techStack,
      fetched_at: new Date().toISOString(),
    });

    // Rate limiting between BuiltWith calls (500ms)
    if (i < topCompetitors.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Step 3: Summary
  const algoliaCount = competitors.filter(c => c.using_algolia).length;
  const withSearch = competitors.filter(c => c.search_provider_detected).length;

  onProgress?.({
    total: competitors.length,
    completed: competitors.length,
    status: 'complete',
    message: `Analysis complete: ${algoliaCount}/${competitors.length} use Algolia, ${withSearch} have detectable search`,
  });

  return competitors;
}

/**
 * Get cached competitor data or fetch fresh if not available
 */
export async function getCompetitorData(
  domain: string,
  cachedData?: string | null,
  forceRefresh?: boolean,
  onProgress?: (progress: CompetitorAnalysisProgress) => void
): Promise<CompetitorWithTech[]> {
  // Try to use cached data if available and not forcing refresh
  if (cachedData && !forceRefresh) {
    try {
      const parsed = JSON.parse(cachedData) as CompetitorWithTech[];
      // Check if data has tech_stack (was fetched with deep analysis)
      if (parsed.length > 0 && parsed[0].tech_stack) {
        return parsed;
      }
    } catch {
      // Parse failed, fetch fresh
    }
  }

  // Fetch fresh competitor data with full tech stack analysis
  return analyzeCompetitorsDeep(domain, onProgress);
}

// =============================================================================
// Get Case Studies for Display
// =============================================================================

export function getCaseStudiesForVertical(vertical: string): CaseStudy[] {
  return findCaseStudiesForVertical(vertical);
}
