/**
 * PartnerForge API Service
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
} from '@/types';

// =============================================================================
// Supabase Configuration
// =============================================================================

const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg';

const ALL_MODULE_IDS: ModuleId[] = [
  'm01_company_context', 'm02_tech_stack', 'm03_traffic', 'm04_financials',
  'm05_competitors', 'm06_hiring', 'm07_strategic', 'm08_investor',
  'm09_executive', 'm10_buying_committee', 'm11_displacement', 'm12_case_study',
  'm13_icp_priority', 'm14_signal_scoring', 'm15_strategic_brief'
];

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

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { headers });
    if (!response.ok) {
      return { data: null, error: await response.text() };
    }
    const data = await response.json();
    const contentRange = response.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1]) : undefined;
    return { data, count };
  } catch (err) {
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
    app: 'PartnerForge',
    version: '3.0.0-supabase',
    database: { status: error ? 'error' : 'connected', latency_ms: latency },
  };
}

export async function getStats(): Promise<DashboardStats> {
  const { data, count } = await supabaseFetch<Array<{
    icp_score: number | null;
  }>>('displacement_targets?select=icp_score', { countExact: true });

  if (!data) {
    return {
      total_companies: 0,
      enriched_companies: 0,
      hot_leads: 0,
      warm_leads: 0,
      modules_active: 2,
      waves_configured: 1,
    };
  }

  let hot = 0, warm = 0, enriched = 0;
  for (const target of data) {
    const score = target.icp_score || 0;
    if (score > 0) enriched++;
    if (score >= 80) hot++;
    else if (score >= 60) warm++;
  }

  return {
    total_companies: count || data.length,
    enriched_companies: enriched,
    hot_leads: hot,
    warm_leads: warm,
    modules_active: 2,
    waves_configured: 1,
  };
}

// =============================================================================
// Companies / Targets
// =============================================================================

function getStatusFromScore(score: number): 'hot' | 'warm' | 'cool' | 'cold' {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'cool';
  return 'cold';
}

function transformTarget(target: Record<string, unknown>): Company {
  const icpScore = (target.icp_score as number) || 0;
  return {
    domain: target.domain as string,
    company_name: (target.company_name as string) || (target.domain as string),
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
    const ranges: Record<string, [number, number]> = {
      hot: [80, 100],
      warm: [60, 79],
      cool: [40, 59],
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
