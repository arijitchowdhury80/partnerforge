/**
 * PartnerForge API Service
 *
 * Now powered by Supabase - no more Railway bullshit!
 */

import type {
  Company,
  DashboardStats,
  EnrichmentStatus,
  EnrichmentJob,
  ModuleId,
  ModuleResult,
  PaginatedResponse,
  FilterState,
} from '@/types';

// =============================================================================
// Supabase Configuration
// =============================================================================

const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg';

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
  const { data, error } = await supabaseFetch<unknown[]>('displacement_targets?select=id&limit=1');
  const latency = Date.now() - start;

  return {
    status: error ? 'unhealthy' : 'healthy',
    app: 'PartnerForge',
    version: '3.0.0-supabase',
    database: { status: error ? 'error' : 'connected', latency_ms: latency },
  };
}

export async function getStats(): Promise<DashboardStats> {
  // Get all targets to calculate stats
  const { data, count } = await supabaseFetch<Array<{
    icp_score: number | null;
    partner_tech: string | null;
    vertical: string | null;
  }>>('displacement_targets?select=icp_score,partner_tech,vertical', { countExact: true });

  if (!data) {
    return {
      total_companies: 0,
      enriched_companies: 0,
      hot_leads: 0,
      warm_leads: 0,
      cool_leads: 0,
      cold_leads: 0,
      modules_active: 2,
      waves_configured: 1,
      by_partner: {},
      by_vertical: {},
      avg_icp_score: 0,
    };
  }

  let hot = 0, warm = 0, cool = 0, cold = 0;
  let totalScore = 0, scoredCount = 0;
  const byPartner: Record<string, number> = {};
  const byVertical: Record<string, number> = {};

  for (const target of data) {
    const score = target.icp_score || 0;
    if (score > 0) {
      totalScore += score;
      scoredCount++;
    }

    if (score >= 80) hot++;
    else if (score >= 60) warm++;
    else if (score >= 40) cool++;
    else cold++;

    if (target.partner_tech) {
      byPartner[target.partner_tech] = (byPartner[target.partner_tech] || 0) + 1;
    }
    if (target.vertical) {
      byVertical[target.vertical] = (byVertical[target.vertical] || 0) + 1;
    }
  }

  return {
    total_companies: count || data.length,
    enriched_companies: scoredCount,
    hot_leads: hot,
    warm_leads: warm,
    cool_leads: cool,
    cold_leads: cold,
    modules_active: 2, // SimilarWeb + BuiltWith
    waves_configured: 1,
    by_partner: byPartner,
    by_vertical: byVertical,
    avg_icp_score: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
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
    // Additional fields from Supabase
    sw_monthly_visits: target.sw_monthly_visits as number | undefined,
    revenue: target.revenue as number | undefined,
    current_search: target.current_search as string | undefined,
    enrichment_level: target.enrichment_level as string | undefined,
  };
}

export async function getCompanies(
  filters: FilterState & { page?: number; limit?: number }
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

  // Build Supabase query
  const params: string[] = ['select=*'];

  // Filters
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

  // Sorting
  const sortCol = sort_by === 'traffic' ? 'sw_monthly_visits' : sort_by === 'name' ? 'company_name' : sort_by;
  params.push(`order=${sortCol}.${sort_order}.nullslast`);

  // Pagination
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
  // For now, just return a stub - we'll implement proper creation later
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
// Intelligence Modules (stub implementations for now)
// =============================================================================

export async function getIntelOverview(
  domain: string
): Promise<{ domain: string; modules: Record<ModuleId, { status: string; last_updated?: string }> }> {
  // Return stub data - modules not yet implemented in Supabase
  const modules: Record<string, { status: string; last_updated?: string }> = {};
  const moduleIds = [
    'm01_company_context', 'm02_tech_stack', 'm03_traffic', 'm04_financials',
    'm05_competitors', 'm06_hiring', 'm07_strategic', 'm08_investor',
    'm09_executive', 'm10_buying_committee', 'm11_displacement', 'm12_case_study',
    'm13_icp_priority', 'm14_signal_scoring', 'm15_strategic_brief'
  ];

  for (const id of moduleIds) {
    modules[id as ModuleId] = { status: 'pending' };
  }

  return { domain, modules: modules as Record<ModuleId, { status: string; last_updated?: string }> };
}

export async function getModuleData<T>(
  domain: string,
  moduleId: ModuleId
): Promise<ModuleResult<T>> {
  // Return stub - will implement when we build proper schema
  return {
    status: 'pending',
    data: null as unknown as T,
    last_updated: undefined,
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
// Enrichment (stub - will implement with Edge Functions)
// =============================================================================

export async function triggerEnrichment(
  domain: string,
  force = false
): Promise<EnrichmentJob> {
  return {
    job_id: `enrich_${domain}_${Date.now()}`,
    domain,
    status: 'queued',
    modules: [],
    created_at: new Date().toISOString(),
  };
}

export async function triggerWaveEnrichment(
  domain: string,
  waveNum: 1 | 2 | 3 | 4,
  force = false
): Promise<EnrichmentJob> {
  return triggerEnrichment(domain, force);
}

export async function triggerModuleEnrichment(
  domain: string,
  moduleId: ModuleId,
  force = false
): Promise<EnrichmentJob> {
  return triggerEnrichment(domain, force);
}

export async function getEnrichmentStatus(domain: string): Promise<EnrichmentStatus> {
  return {
    domain,
    overall_status: 'pending',
    modules: {},
    last_updated: undefined,
  };
}

export async function getActiveJobs(
  status?: 'queued' | 'running' | 'complete' | 'failed'
): Promise<{ jobs: EnrichmentJob[] }> {
  return { jobs: [] };
}

// =============================================================================
// Cache Management (stub)
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
  domain: string,
  moduleId?: ModuleId
): Promise<{ invalidated: boolean }> {
  return { invalidated: true };
}

// =============================================================================
// Legacy export for compatibility
// =============================================================================

export const apiClient = {
  get: async (url: string) => ({ data: null }),
  post: async (url: string, data?: unknown) => ({ data: null }),
};
