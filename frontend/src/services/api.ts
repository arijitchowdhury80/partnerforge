/**
 * Arian API Service
 *
 * Now powered by Supabase
 */

import type {
  Company,
  DashboardStats,
  EnrichmentStatus,
  EnrichmentJob,
  ModuleId,
  ModuleResult,
  ModuleStatus,
  PaginatedResponse,
  FilterState,
  TechStackData,
  Technology,
} from '@/types';

// =============================================================================
// Supabase Configuration - from environment variables
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

const ALL_MODULE_IDS: ModuleId[] = [
  'm01_company_context', 'm02_tech_stack', 'm03_traffic', 'm04_financials',
  'm05_competitors', 'm06_hiring', 'm07_strategic', 'm08_investor',
  'm09_executive', 'm10_buying_committee', 'm11_displacement', 'm12_case_study',
  'm13_icp_priority', 'm14_signal_scoring', 'm15_strategic_brief'
];

// API Version for deployment tracking
export const API_VERSION = '3.2.0-debug-visible';

async function supabaseFetch<T>(
  endpoint: string,
  options: { countExact?: boolean } = {}
): Promise<{ data: T | null; count?: number; error?: string }> {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (options.countExact) {
    headers['Prefer'] = 'count=exact';
  }

  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  console.log(`[API v${API_VERSION}] Fetching: ${url.substring(0, 100)}...`);

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API v${API_VERSION}] Error ${response.status}: ${errorText}`);
      return { data: null, error: errorText };
    }
    const data = await response.json();
    const contentRange = response.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1]) : undefined;
    console.log(`[API v${API_VERSION}] Success: ${Array.isArray(data) ? data.length : 1} records, total: ${count || 'N/A'}`);
    return { data, count };
  } catch (err) {
    console.error(`[API v${API_VERSION}] Fetch error:`, err);
    return { data: null, error: String(err) };
  }
}

// =============================================================================
// Health & Stats
// =============================================================================

export async function getHealth(): Promise<{
  status: string;
  app: string;
  version: string;
  database: { status: string; latency_ms: number };
}> {
  const start = Date.now();
  const { error } = await supabaseFetch<unknown[]>('displacement_targets?select=id&limit=1');
  const latency = Date.now() - start;

  return {
    status: error ? 'unhealthy' : 'healthy',
    app: 'Arian',
    version: '3.0.0-supabase',
    database: { status: error ? 'error' : 'connected', latency_ms: latency },
  };
}

export async function getStats(): Promise<DashboardStats> {
  // Fetch more fields to determine enrichment depth
  const { data, count } = await supabaseFetch<Array<{
    icp_score: number | null;
    vertical: string | null;
    sw_monthly_visits: number | null;
    revenue: number | null;
    tech_stack_json: string | null;
    competitors_json: string | null;
    enrichment_level: string | null;
  }>>('displacement_targets?select=icp_score,vertical,sw_monthly_visits,revenue,tech_stack_json,competitors_json,enrichment_level', { countExact: true });

  if (!data) {
    return {
      total_companies: 0,
      enriched_companies: 0,
      hot_leads: 0,
      warm_leads: 0,
      cold_leads: 0,
      modules_active: 2,
      waves_configured: 1,
      enrichment_depth: { basic: 0, standard: 0, deep: 0, unenriched: 0 },
    };
  }

  // 3 tiers: Hot (70-100), Warm (40-69), Cold (0-39) - matches composite scoring
  let hot = 0, warm = 0, cold = 0, enriched = 0;
  const byVertical: Record<string, number> = {};

  // Enrichment depth counters
  let deepCount = 0, standardCount = 0, basicCount = 0, unenrichedCount = 0;

  for (const target of data) {
    const score = target.icp_score || 0;
    if (score > 0) enriched++;
    if (score >= 70) hot++;
    else if (score >= 40) warm++;
    else cold++;

    const v = target.vertical || 'Unknown';
    byVertical[v] = (byVertical[v] || 0) + 1;

    // Determine enrichment depth
    // Deep: has financials OR tech stack OR competitors
    const hasDeepData = (
      (target.revenue && target.revenue > 0) ||
      (target.tech_stack_json && target.tech_stack_json !== '{}') ||
      (target.competitors_json && target.competitors_json !== '[]') ||
      target.enrichment_level === 'deep' ||
      target.enrichment_level === 'full'
    );

    // Standard: has traffic data
    const hasStandardData = target.sw_monthly_visits && target.sw_monthly_visits > 0;

    // Basic: has ICP score
    const hasBasicData = score > 0;

    if (hasDeepData) {
      deepCount++;
    } else if (hasStandardData) {
      standardCount++;
    } else if (hasBasicData) {
      basicCount++;
    } else {
      unenrichedCount++;
    }
  }

  return {
    total_companies: count || data.length,
    enriched_companies: enriched,
    hot_leads: hot,
    warm_leads: warm,
    cold_leads: cold,
    modules_active: 2,
    waves_configured: 1,
    by_vertical: byVertical,
    enrichment_depth: {
      basic: basicCount,
      standard: standardCount,
      deep: deepCount,
      unenriched: unenrichedCount,
    },
  };
}

// Distribution data for the grid - 3 tiers only
export interface VerticalInfo {
  name: string;
  shortName: string;
  total: number;
  hot: number;
  warm: number;
  cold: number;
}

export interface DistributionData {
  verticals: string[];
  allVerticals: VerticalInfo[];  // Full list with counts for the expanded view
  tiers: {
    key: 'hot' | 'warm' | 'cold';
    label: string;
    score: string;
    color: string;
    values: Record<string, number>;
    total: number;
  }[];
  grandTotal: number;
  hiddenVerticalsCount: number;
}

// Shorten long vertical names
function getShortName(name: string): string {
  const map: Record<string, string> = {
    'Business And Industrial': 'Business',
    'Technology And Computing': 'Technology',
    'Automotive And Vehicles': 'Automotive',
    'Law, Govt And Politics': 'Government',
    'Health And Fitness': 'Healthcare',
    'Art And Entertainment': 'Entertainment',
    'Style And Fashion': 'Fashion',
    'Food And Drink': 'F&B',
    'Home And Garden': 'Home',
    'Hobbies And Interests': 'Hobbies',
    'Family And Parenting': 'Family',
    'Religion And Spirituality': 'Religion',
    'Real Estate': 'Real Estate',
  };
  return map[name] || name;
}

export async function getDistribution(): Promise<DistributionData> {
  const { data } = await supabaseFetch<Array<{
    icp_score: number | null;
    vertical: string | null;
  }>>('displacement_targets?select=icp_score,vertical');

  if (!data) {
    return { verticals: [], allVerticals: [], tiers: [], grandTotal: 0, hiddenVerticalsCount: 0 };
  }

  // Count by vertical and tier - 3 tiers: Hot (70+), Warm (40-69), Cold (0-39) - matches composite scoring
  const counts: Record<string, Record<string, number>> = {};
  const tierTotals = { hot: 0, warm: 0, cold: 0 };
  const verticalSet = new Set<string>();

  for (const target of data) {
    const score = target.icp_score || 0;
    const vertical = target.vertical || 'Unknown';
    verticalSet.add(vertical);

    if (!counts[vertical]) {
      counts[vertical] = { hot: 0, warm: 0, cold: 0 };
    }

    if (score >= 70) {
      counts[vertical].hot++;
      tierTotals.hot++;
    } else if (score >= 40) {
      counts[vertical].warm++;
      tierTotals.warm++;
    } else {
      counts[vertical].cold++;
      tierTotals.cold++;
    }
  }

  // Build vertical stats
  const verticalTotals = Array.from(verticalSet).map(v => ({
    name: v,
    shortName: getShortName(v),
    total: Object.values(counts[v] || {}).reduce((a, b) => a + b, 0),
    hot: counts[v]?.hot || 0,
    warm: counts[v]?.warm || 0,
    cold: counts[v]?.cold || 0,
  }));

  // EXCLUDE "Unknown" - it's not a real vertical, always goes to "Other"
  const realVerticals = verticalTotals.filter(v => v.name !== 'Unknown');
  const unknownVertical = verticalTotals.find(v => v.name === 'Unknown');

  // SORT BY PRIORITY: Hot leads are most valuable, then Warm, then Cold
  // Weighted score: Hot × 1000 + Warm × 10 + Cold × 1
  // This ensures Automotive (4 hot) ranks above Unknown (309 cold)
  realVerticals.sort((a, b) => {
    const scoreA = a.hot * 1000 + a.warm * 10 + a.cold;
    const scoreB = b.hot * 1000 + b.warm * 10 + b.cold;
    return scoreB - scoreA;
  });

  // Top 5 = real verticals with highest priority score (Hot > Warm > Cold)
  const topVerticals = realVerticals.slice(0, 5).map(v => v.name);
  const otherVerticals = [...realVerticals.slice(5)];
  if (unknownVertical) {
    otherVerticals.push(unknownVertical); // Unknown always goes to Other
  }
  const hiddenCount = otherVerticals.length;

  // Combine "Other" verticals for collapsed view
  if (hiddenCount > 0) {
    counts['Other'] = { hot: 0, warm: 0, cold: 0 };
    for (const v of otherVerticals) {
      counts['Other'].hot += v.hot;
      counts['Other'].warm += v.warm;
      counts['Other'].cold += v.cold;
    }
    topVerticals.push('Other');
  }

  // Build tier data with ALL verticals (for expanded view)
  // Already sorted by priority (Hot > Warm > Cold), Unknown at the end
  const sortedAllVerticals = [...realVerticals]; // Already sorted by priority
  if (unknownVertical) {
    sortedAllVerticals.push(unknownVertical); // Unknown always last
  }
  const allVerticalNames = sortedAllVerticals.map(v => v.name);

  const tiers: DistributionData['tiers'] = [
    {
      key: 'hot',
      label: 'HOT',
      score: '70-100',  // Matches composite scoring thresholds
      color: '#ff6b6b', // Vibrant red
      values: Object.fromEntries(allVerticalNames.map(v => [v, counts[v]?.hot || 0])),
      total: tierTotals.hot,
    },
    {
      key: 'warm',
      label: 'WARM',
      score: '40-69',   // Matches composite scoring thresholds
      color: '#ffa94d', // Vibrant orange
      values: Object.fromEntries(allVerticalNames.map(v => [v, counts[v]?.warm || 0])),
      total: tierTotals.warm,
    },
    {
      key: 'cold',
      label: 'COLD',
      score: '0-39',
      color: '#94a3b8', // Bright slate
      values: Object.fromEntries(allVerticalNames.map(v => [v, counts[v]?.cold || 0])),
      total: tierTotals.cold,
    },
  ];

  return {
    verticals: topVerticals,
    allVerticals: sortedAllVerticals, // Real verticals sorted by count, Unknown at end
    tiers,
    grandTotal: data.length,
    hiddenVerticalsCount: hiddenCount,
  };
}

// =============================================================================
// Companies / Targets
// =============================================================================

function getStatusFromScore(score: number): 'hot' | 'warm' | 'cold' {
  // Matches composite scoring thresholds: 70+ = hot, 40-69 = warm, <40 = cold
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// Parse tech_stack_json into TechStackData format
interface RawTechStack {
  cms?: string[];
  ecommerce?: string[];
  analytics?: string[];
  search?: string[];
  cdn?: string[];
  payment?: string[];
  marketing?: string[];
  frameworks?: string[];
}

function parseTechStackJson(json: string | null, domain: string): TechStackData | undefined {
  if (!json) return undefined;

  try {
    const raw: RawTechStack = typeof json === 'string' ? JSON.parse(json) : json;

    // Convert arrays to Technology objects
    const technologies: Technology[] = [];
    const categories: Record<string, string[]> = {
      'CMS': raw.cms || [],
      'E-commerce': raw.ecommerce || [],
      'Analytics': raw.analytics || [],
      'Search': raw.search || [],
      'CDN': raw.cdn || [],
      'Payment': raw.payment || [],
      'Marketing': raw.marketing || [],
      'Frameworks': raw.frameworks || [],
    };

    for (const [category, techs] of Object.entries(categories)) {
      for (const name of techs) {
        technologies.push({ name, category });
      }
    }

    // Determine search provider
    let searchProvider: string | undefined;
    for (const s of raw.search || []) {
      const sl = s.toLowerCase();
      if (sl.includes('algolia')) { searchProvider = 'Algolia'; break; }
      if (sl.includes('elastic')) searchProvider = 'Elasticsearch';
      else if (sl.includes('constructor')) searchProvider = 'Constructor IO';
      else if (sl.includes('coveo')) searchProvider = 'Coveo';
      else if (sl.includes('lucidworks') || sl.includes('solr')) searchProvider = 'Lucidworks/Solr';
    }

    return {
      domain,
      technologies,
      partner_tech_detected: raw.cms?.filter(c =>
        ['amplience', 'adobe', 'spryker', 'bloomreach'].some(p => c.toLowerCase().includes(p))
      ) || [],
      search_provider: searchProvider,
      cms: raw.cms?.[0],
      ecommerce_platform: raw.ecommerce?.[0],
      analytics: raw.analytics?.slice(0, 5),
      cdn: raw.cdn?.[0],
    };
  } catch (e) {
    console.warn('[API] Failed to parse tech_stack_json:', e);
    return undefined;
  }
}

function transformTarget(target: Record<string, unknown>): Company {
  const icpScore = (target.icp_score as number) || 0;
  const domain = target.domain as string;

  // Parse tech stack JSON if available
  const techStackData = parseTechStackJson(
    target.tech_stack_json as string | null,
    domain
  );

  return {
    domain,
    company_name: (target.company_name as string) || domain,
    ticker: target.ticker as string | undefined,
    exchange: undefined,
    is_public: Boolean(target.is_public),
    headquarters: {
      city: (target.city as string) || '',
      state: (target.state as string) || '',
      country: (target.country as string) || '',
    },
    industry: (target.vertical as string) || '',
    vertical: (target.vertical as string) || '',
    icp_score: icpScore,
    signal_score: Math.round(icpScore * 0.8),
    priority_score: icpScore,
    status: getStatusFromScore(icpScore),
    partner_tech: target.partner_tech ? [target.partner_tech as string] : [],
    last_enriched: target.last_enriched as string | undefined,
    // Extended Supabase fields
    sw_monthly_visits: target.sw_monthly_visits as number | undefined,
    revenue: target.revenue as number | undefined,
    current_search: target.current_search as string | undefined,
    enrichment_level: target.enrichment_level as string | undefined,
    // Tech stack data (parsed from tech_stack_json)
    tech_stack_data: techStackData,
  };
}

// Extended filter state for internal use
interface ExtendedFilterState extends FilterState {
  page?: number;
  limit?: number;
  vertical?: string;
  search?: string;
}

export async function getCompanies(
  filters: ExtendedFilterState
): Promise<PaginatedResponse<Company>> {
  const {
    status,
    partner,
    vertical,
    min_score,
    search,
    sort_by = 'icp_score',
    sort_order = 'desc',
    page = 1,
    limit = 50,
  } = filters;

  const params: string[] = ['select=*'];

  if (partner) {
    params.push(`partner_tech=eq.${encodeURIComponent(partner)}`);
  }
  if (vertical) {
    params.push(`vertical=eq.${encodeURIComponent(vertical)}`);
  }
  if (min_score !== undefined) {
    params.push(`icp_score=gte.${min_score}`);
  }
  if (status) {
    // 3 tiers: Hot (70-100), Warm (40-69), Cold (0-39) - matches composite scoring
    const ranges: Record<string, [number, number]> = {
      hot: [70, 100],
      warm: [40, 69],
      cold: [0, 39],
    };
    const [min, max] = ranges[status] || [0, 100];
    params.push(`icp_score=gte.${min}`);
    params.push(`icp_score=lte.${max}`);
  }
  if (search) {
    params.push(`or=(domain.ilike.*${encodeURIComponent(search)}*,company_name.ilike.*${encodeURIComponent(search)}*)`);
  }

  const sortCol = sort_by === 'traffic' ? 'sw_monthly_visits' : sort_by === 'name' ? 'company_name' : sort_by;
  params.push(`order=${sortCol}.${sort_order}.nullslast`);

  const offset = (page - 1) * limit;
  params.push(`offset=${offset}`);
  params.push(`limit=${limit}`);

  const query = params.join('&');
  const { data, count, error } = await supabaseFetch<Record<string, unknown>[]>(
    `displacement_targets?${query}`,
    { countExact: true }
  );

  if (error || !data) {
    console.error('Error fetching companies:', error);
    return {
      data: [],
      pagination: { page, limit, total: 0, total_pages: 0 },
    };
  }

  return {
    data: data.map(transformTarget),
    pagination: {
      page,
      limit,
      total: count || data.length,
      total_pages: Math.ceil((count || data.length) / limit),
    },
  };
}

export async function getCompany(domain: string): Promise<Company> {
  const { data, error } = await supabaseFetch<Record<string, unknown>[]>(
    `displacement_targets?domain=eq.${encodeURIComponent(domain)}&limit=1`
  );

  if (error || !data || data.length === 0) {
    throw new Error(`Company not found: ${domain}`);
  }

  return transformTarget(data[0]);
}

export async function createCompany(domain: string): Promise<Company> {
  return {
    domain,
    company_name: domain.split('.')[0],
    is_public: false,
    headquarters: { city: '', state: '', country: '' },
    industry: '',
    vertical: '',
    icp_score: 0,
    signal_score: 0,
    priority_score: 0,
    status: 'cold',
    partner_tech: [],
  };
}

// =============================================================================
// Intelligence Modules
// =============================================================================

export async function getIntelOverview(
  domain: string
): Promise<{ domain: string; modules: Record<ModuleId, { status: string; last_updated?: string }> }> {
  const modules = {} as Record<ModuleId, { status: string; last_updated?: string }>;
  for (const id of ALL_MODULE_IDS) {
    modules[id] = { status: 'pending' };
  }
  return { domain, modules };
}

export async function getModuleData<T>(
  domain: string,
  moduleId: ModuleId
): Promise<ModuleResult<T>> {
  return {
    module_id: moduleId,
    domain,
    data: null as unknown as T,
    source: {
      url: '',
      date: new Date().toISOString(),
      type: 'api',
    },
    enriched_at: new Date().toISOString(),
    is_cached: false,
  };
}

export const modules = {
  companyContext: (domain: string) => getModuleData(domain, 'm01_company_context'),
  techStack: (domain: string) => getModuleData(domain, 'm02_tech_stack'),
  traffic: (domain: string) => getModuleData(domain, 'm03_traffic'),
  financials: (domain: string) => getModuleData(domain, 'm04_financials'),
  competitors: (domain: string) => getModuleData(domain, 'm05_competitors'),
  hiring: (domain: string) => getModuleData(domain, 'm06_hiring'),
  strategic: (domain: string) => getModuleData(domain, 'm07_strategic'),
  investor: (domain: string) => getModuleData(domain, 'm08_investor'),
  executive: (domain: string) => getModuleData(domain, 'm09_executive'),
  buyingCommittee: (domain: string) => getModuleData(domain, 'm10_buying_committee'),
  displacement: (domain: string) => getModuleData(domain, 'm11_displacement'),
  caseStudy: (domain: string) => getModuleData(domain, 'm12_case_study'),
  icpPriority: (domain: string) => getModuleData(domain, 'm13_icp_priority'),
  signalScoring: (domain: string) => getModuleData(domain, 'm14_signal_scoring'),
  strategicBrief: (domain: string) => getModuleData(domain, 'm15_strategic_brief'),
};

// =============================================================================
// Enrichment
// =============================================================================

function createEmptyModuleStatuses(): Record<ModuleId, ModuleStatus> {
  const result = {} as Record<ModuleId, ModuleStatus>;
  for (const id of ALL_MODULE_IDS) {
    result[id] = { status: 'pending' };
  }
  return result;
}

export async function triggerEnrichment(
  domain: string,
  _force = false
): Promise<EnrichmentJob> {
  return {
    job_id: `enrich_${domain}_${Date.now()}`,
    domain,
    status: 'queued',
    modules: [],
  };
}

export async function triggerWaveEnrichment(
  domain: string,
  _waveNum: 1 | 2 | 3 | 4,
  force = false
): Promise<EnrichmentJob> {
  return triggerEnrichment(domain, force);
}

export async function triggerModuleEnrichment(
  domain: string,
  _moduleId: ModuleId,
  force = false
): Promise<EnrichmentJob> {
  return triggerEnrichment(domain, force);
}

export async function getEnrichmentStatus(domain: string): Promise<EnrichmentStatus> {
  return {
    domain,
    overall_status: 'idle',
    modules: createEmptyModuleStatuses(),
    active_jobs: [],
  };
}

export async function getActiveJobs(
  _status?: 'queued' | 'running' | 'complete' | 'failed'
): Promise<{ jobs: EnrichmentJob[] }> {
  return { jobs: [] };
}

// =============================================================================
// Cache Management
// =============================================================================

export async function getCacheStatus(): Promise<{
  total_cached: number;
  fresh: number;
  stale: number;
  expired: number;
}> {
  return { total_cached: 0, fresh: 0, stale: 0, expired: 0 };
}

export async function invalidateCache(
  _domain: string,
  _moduleId?: ModuleId
): Promise<{ invalidated: boolean }> {
  return { invalidated: true };
}

// =============================================================================
// Legacy apiClient export for compatibility with hooks
// =============================================================================

interface ApiClientConfig {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  responseType?: string;
}

export const apiClient = {
  get: async <T = unknown>(_url: string, _config?: ApiClientConfig): Promise<{ data: T }> => {
    return { data: null as unknown as T };
  },
  post: async <T = unknown>(_url: string, _data?: unknown, _config?: ApiClientConfig): Promise<{ data: T }> => {
    return { data: null as unknown as T };
  },
  delete: async (_url: string): Promise<void> => {
    // stub
  },
};
