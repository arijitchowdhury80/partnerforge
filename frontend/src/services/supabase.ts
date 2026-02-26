/**
 * Supabase Client for PartnerForge
 *
 * Direct connection to Supabase for all data operations.
 * No more Railway headaches!
 */

// Environment variables - never hardcode keys in source code
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

interface SupabaseResponse<T> {
  data: T | null;
  error: string | null;
  count?: number;
}

async function supabaseRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  countExact = false
): Promise<SupabaseResponse<T>> {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (countExact) {
    headers['Prefer'] = 'count=exact';
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: errorText };
    }

    const data = await response.json();
    const contentRange = response.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1]) : undefined;

    return { data, error: null, count };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

// =============================================================================
// Displacement Targets
// =============================================================================

export interface DisplacementTarget {
  id: number;
  domain: string;
  company_name: string | null;
  partner_tech: string | null;
  vertical: string | null;
  country: string | null;
  icp_score: number | null;
  icp_tier: number | null;
  icp_tier_name: string | null;
  sw_monthly_visits: number | null;
  revenue: number | null;
  current_search: string | null;
  enrichment_level: string | null;
  last_enriched: string | null;
  created_at: string | null;
  // Additional fields
  ticker: string | null;
  is_public: boolean;
  tech_spend: number | null;
  traffic_growth: number | null;
  exec_quote: string | null;
  exec_name: string | null;
  exec_title: string | null;
  displacement_angle: string | null;
  // Full enrichment fields (v2.0)
  tech_stack_json: string | null;
  competitors_json: string | null;
  case_studies_json: string | null;
  competitor_count: number | null;
  competitors_using_algolia: number | null;
  reference_implementation: string | null;
  sw_bounce_rate: number | null;
  sw_pages_per_visit: number | null;
  sw_time_on_site: number | null;
  sw_global_rank: number | null;
  sw_category_rank: number | null;
  cms: string | null;
  ecommerce_platform: string | null;
  cdn: string | null;
}

export interface TargetFilters {
  status?: 'hot' | 'warm' | 'cold';
  partner?: string;
  vertical?: string;
  min_score?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export async function getTargets(filters: TargetFilters = {}): Promise<{
  targets: DisplacementTarget[];
  total: number;
  page: number;
  limit: number;
}> {
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

  // Build query params
  const params: string[] = [];

  // Select all fields
  params.push('select=*');

  // Filters
  if (partner) {
    // Use ilike for partial matching (e.g., "Adobe" matches "Adobe Experience Manager")
    params.push(`partner_tech=ilike.*${encodeURIComponent(partner)}*`);
  }
  if (vertical) {
    params.push(`vertical=eq.${encodeURIComponent(vertical)}`);
  }
  if (min_score !== undefined) {
    params.push(`icp_score=gte.${min_score}`);
  }
  if (status) {
    // Map status to ICP score ranges (3 tiers)
    const ranges: Record<string, [number, number]> = {
      hot: [80, 100],
      warm: [40, 79],
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
  const { data, error, count } = await supabaseRequest<DisplacementTarget[]>(
    `displacement_targets?${query}`,
    {},
    true
  );

  if (error || !data) {
    console.error('Error fetching targets:', error);
    return { targets: [], total: 0, page, limit };
  }

  return {
    targets: data,
    total: count || data.length,
    page,
    limit,
  };
}

export async function getTarget(domain: string): Promise<DisplacementTarget | null> {
  const { data, error } = await supabaseRequest<DisplacementTarget[]>(
    `displacement_targets?domain=eq.${encodeURIComponent(domain)}&limit=1`
  );

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
}

// =============================================================================
// Stats
// =============================================================================

export interface DashboardStats {
  total_targets: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  by_partner: Record<string, number>;
  by_vertical: Record<string, number>;
}

export async function getStats(): Promise<DashboardStats> {
  // Get all targets to calculate stats (Supabase doesn't have built-in aggregation via REST)
  const { data, error, count } = await supabaseRequest<DisplacementTarget[]>(
    'displacement_targets?select=icp_score,partner_tech,vertical',
    {},
    true
  );

  if (error || !data) {
    return {
      total_targets: 0,
      hot_leads: 0,
      warm_leads: 0,
      cold_leads: 0,
      by_partner: {},
      by_vertical: {},
    };
  }

  // Calculate stats (3 tiers)
  let hot = 0, warm = 0, cold = 0;
  const byPartner: Record<string, number> = {};
  const byVertical: Record<string, number> = {};

  for (const target of data) {
    const score = target.icp_score || 0;
    if (score >= 80) hot++;
    else if (score >= 40) warm++;
    else cold++;

    if (target.partner_tech) {
      byPartner[target.partner_tech] = (byPartner[target.partner_tech] || 0) + 1;
    }
    if (target.vertical) {
      byVertical[target.vertical] = (byVertical[target.vertical] || 0) + 1;
    }
  }

  return {
    total_targets: count || data.length,
    hot_leads: hot,
    warm_leads: warm,
    cold_leads: cold,
    by_partner: byPartner,
    by_vertical: byVertical,
  };
}

// =============================================================================
// Health Check
// =============================================================================

export async function healthCheck(): Promise<{ status: string; version: string }> {
  // Simple health check - just verify we can reach Supabase
  const { data, error } = await supabaseRequest<DisplacementTarget[]>(
    'displacement_targets?select=id&limit=1'
  );

  if (error) {
    return { status: 'unhealthy', version: 'supabase-error' };
  }

  return { status: 'healthy', version: '3.0.0-supabase' };
}

// =============================================================================
// Data Feedback - User corrections system
// =============================================================================

export interface DataFeedbackRecord {
  id?: number;
  domain: string;
  company_name?: string | null;
  feedback_type: string;
  reported_value?: string | null;
  original_value?: string | null;
  confidence?: string;
  evidence_url?: string | null;
  notes?: string | null;
  reported_by?: string;
  source?: string;
  status?: string;
  reported_at?: string;
}

/**
 * Submit data feedback/correction
 * Users can report issues like "this is an Algolia customer" or "wrong company name"
 */
export async function submitFeedback(feedback: Omit<DataFeedbackRecord, 'id' | 'reported_at' | 'status'>): Promise<{
  success: boolean;
  error?: string;
}> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/data_feedback`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(feedback),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: errorText };
  }

  return { success: true };
}

/**
 * Get pending feedback items
 */
export async function getPendingFeedback(): Promise<DataFeedbackRecord[]> {
  const { data, error } = await supabaseRequest<DataFeedbackRecord[]>(
    'data_feedback?status=eq.pending&order=reported_at.desc'
  );

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Check if a domain has been reported as an Algolia customer
 */
export async function isVerifiedCustomer(domain: string): Promise<boolean> {
  const { data, error } = await supabaseRequest<DataFeedbackRecord[]>(
    `data_feedback?domain=eq.${encodeURIComponent(domain)}&feedback_type=eq.is_algolia_customer&status=in.(verified,applied)&limit=1`
  );

  return !error && data !== null && data.length > 0;
}

// =============================================================================
// Supabase client-like interface for compatibility
// =============================================================================

/**
 * Simple supabase client interface for components that expect it
 */
export const supabase = {
  from: (table: string) => ({
    insert: async (data: Record<string, unknown>) => {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { data: null, error: { message: errorText } };
      }

      return { data: null, error: null };
    },

    select: (columns = '*') => ({
      eq: (column: string, value: string | number) => ({
        single: async () => {
          const { data, error } = await supabaseRequest<Record<string, unknown>[]>(
            `${table}?select=${columns}&${column}=eq.${encodeURIComponent(String(value))}&limit=1`
          );
          return {
            data: data && data.length > 0 ? data[0] : null,
            error: error ? { message: error } : null,
          };
        },
      }),
    }),
  }),
};
