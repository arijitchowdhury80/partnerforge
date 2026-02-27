/**
 * Supabase Client for PartnerForge
 *
 * Direct connection to Supabase for all data operations.
 * No more Railway headaches!
 */

// Environment variables - never hardcode keys in source code
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// SECURITY: Service role key removed (CRITICAL-2)
// Service role keys must NEVER be used in frontend code
// All privileged operations should go through backend API

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase environment variables (VITE_SUPABASE_URL or VITE_SUPABASE_KEY). Check your .env file.');
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

// SECURITY: supabaseServiceRequest() removed (CRITICAL-2)
// Service role keys must NEVER be used in frontend code.
// RLS policies have been updated to allow anon access to partners table.
// See migration: 20260226_fix_rls_security.sql

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

  // CRITICAL: Always exclude Algolia customers - this is a DISPLACEMENT targets table
  // Displacement = Companies Using Partner Tech − Existing Algolia Customers
  // Use 'or' to include NULL values (no search detected) AND non-Algolia values
  params.push('or=(current_search.is.null,current_search.neq.Algolia)');

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
  // CRITICAL: Exclude Algolia customers - displacement = partner tech MINUS Algolia customers
  const { data, error, count } = await supabaseRequest<DisplacementTarget[]>(
    'displacement_targets?select=icp_score,partner_tech,vertical&or=(current_search.is.null,current_search.neq.Algolia)',
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

  // Thresholds: 70+ = Hot, 40-69 = Warm, 0-39 = Cold (matches composite scoring)
  for (const target of data) {
    const score = target.icp_score || 0;
    if (score >= 70) hot++;
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

// SECURITY: Allowed feedback types (HIGH-5 validation)
const ALLOWED_FEEDBACK_TYPES = [
  'is_algolia_customer',
  'wrong_company_name',
  'missing_data',
  'incorrect_data',
  'wrong_vertical',
  'wrong_revenue',
  'other'
];
const MAX_NOTES_LENGTH = 5000;
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

/**
 * Submit data feedback/correction
 * Users can report issues like "this is an Algolia customer" or "wrong company name"
 */
export async function submitFeedback(feedback: Omit<DataFeedbackRecord, 'id' | 'reported_at' | 'status'>): Promise<{
  success: boolean;
  error?: string;
}> {
  // SECURITY: Input validation (HIGH-5)
  if (!ALLOWED_FEEDBACK_TYPES.includes(feedback.feedback_type)) {
    return { success: false, error: 'Invalid feedback type' };
  }

  if (!feedback.domain || !DOMAIN_REGEX.test(feedback.domain)) {
    return { success: false, error: 'Invalid domain format' };
  }

  if (feedback.notes && feedback.notes.length > MAX_NOTES_LENGTH) {
    return { success: false, error: `Notes must be under ${MAX_NOTES_LENGTH} characters` };
  }

  // Sanitize text fields
  const sanitizedFeedback = {
    ...feedback,
    domain: feedback.domain.toLowerCase().trim(),
    notes: feedback.notes?.slice(0, MAX_NOTES_LENGTH),
    company_name: feedback.company_name?.slice(0, 255),
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/data_feedback`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(sanitizedFeedback),
  });

  if (!response.ok) {
    // SECURITY: Don't expose raw error messages to users (MEDIUM-6)
    console.error('[Supabase] Feedback submission failed:', await response.text());
    return { success: false, error: 'Unable to submit feedback. Please try again.' };
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
// Partners - Fetch from database
// =============================================================================

export interface PartnerRecord {
  id: number;
  key: string;
  name: string;
  short_name: string;
  logo_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface PartnerProductRecord {
  id: number;
  partner_id: number;
  key: string;
  name: string;
  short_name: string;
  builtwith_tech_name?: string;
  is_active: boolean;
  sort_order: number;
}

/**
 * Fetch partners from database
 * Falls back to counting unique partner_tech values if partners table doesn't exist
 */
export async function getPartners(): Promise<{
  partners: Array<{
    key: string;
    name: string;
    shortName: string;
    count: number;
    products: Array<{
      key: string;
      name: string;
      shortName: string;
      builtWithTechName?: string;
      count: number;
    }>;
  }>;
}> {
  // Fetch from partners table (RLS allows anon read - see migration 20260226_fix_rls_security.sql)
  const { data: partnersData, error: partnersError } = await supabaseRequest<PartnerRecord[]>(
    'partners?is_active=eq.true&order=sort_order.asc'
  );

  // If partners table exists and has data, use it
  if (!partnersError && partnersData && partnersData.length > 0) {
    // Also fetch products for each partner
    const { data: productsData } = await supabaseRequest<PartnerProductRecord[]>(
      'partner_products?is_active=eq.true&order=sort_order.asc'
    );

    // Get counts from displacement_targets (excluding Algolia customers)
    const { data: countData } = await supabaseRequest<Array<{ partner_tech: string }>>(
      'displacement_targets?select=partner_tech&or=(current_search.is.null,current_search.neq.Algolia)'
    );

    const partnerCounts: Record<string, number> = {};
    if (countData) {
      for (const row of countData) {
        if (row.partner_tech) {
          // Match to partner key
          for (const p of partnersData) {
            if (row.partner_tech.toLowerCase().includes(p.key.toLowerCase())) {
              partnerCounts[p.key] = (partnerCounts[p.key] || 0) + 1;
              break;
            }
          }
        }
      }
    }

    return {
      partners: partnersData.map(p => ({
        key: p.key,
        name: p.name,
        shortName: p.short_name,
        count: partnerCounts[p.key] || 0,
        products: (productsData || [])
          .filter(prod => prod.partner_id === p.id)
          .map(prod => ({
            key: prod.key,
            name: prod.name,
            shortName: prod.short_name,
            builtWithTechName: prod.builtwith_tech_name,
            count: 0, // Would need separate query
          })),
      })),
    };
  }

  // Fallback: Derive partners from unique partner_tech values in displacement_targets
  // CRITICAL: Exclude Algolia customers
  const { data: targetsData } = await supabaseRequest<Array<{ partner_tech: string }>>(
    'displacement_targets?select=partner_tech&or=(current_search.is.null,current_search.neq.Algolia)'
  );

  if (!targetsData) {
    return { partners: [] };
  }

  // Count unique partner techs
  const partnerCounts: Record<string, number> = {};
  for (const row of targetsData) {
    if (row.partner_tech) {
      // Normalize partner tech name to key
      const tech = row.partner_tech;
      partnerCounts[tech] = (partnerCounts[tech] || 0) + 1;
    }
  }

  // Map known partner techs to our partner structure
  const knownPartners: Record<string, { name: string; shortName: string }> = {
    'Adobe Experience Manager': { name: 'Adobe', shortName: 'Adobe' },
    'Adobe': { name: 'Adobe', shortName: 'Adobe' },
    'Salesforce Commerce Cloud': { name: 'Salesforce', shortName: 'Salesforce' },
    'Salesforce': { name: 'Salesforce', shortName: 'Salesforce' },
    'Shopify': { name: 'Shopify', shortName: 'Shopify' },
    'Shopify Plus': { name: 'Shopify', shortName: 'Shopify' },
    'commercetools': { name: 'commercetools', shortName: 'CT' },
    'BigCommerce': { name: 'BigCommerce', shortName: 'BigCommerce' },
    'VTEX': { name: 'VTEX', shortName: 'VTEX' },
    'Amplience': { name: 'Amplience', shortName: 'Amplience' },
    'Spryker': { name: 'Spryker', shortName: 'Spryker' },
  };

  // Aggregate counts by partner key
  const aggregated: Record<string, { name: string; shortName: string; count: number }> = {};
  for (const [tech, count] of Object.entries(partnerCounts)) {
    const partner = knownPartners[tech];
    if (partner) {
      const key = partner.name.toLowerCase().replace(/\s+/g, '');
      if (!aggregated[key]) {
        aggregated[key] = { ...partner, count: 0 };
      }
      aggregated[key].count += count;
    }
  }

  return {
    partners: Object.entries(aggregated).map(([key, data]) => ({
      key,
      name: data.name,
      shortName: data.shortName,
      count: data.count,
      products: [], // No products in fallback mode
    })),
  };
}

// =============================================================================
// Supabase client-like interface for compatibility
// =============================================================================

/**
 * Simple supabase client interface for components that expect it
 */
// =============================================================================
// Edge Function Proxy - Secure API calls
// =============================================================================

export type EnrichSource = 'similarweb' | 'builtwith' | 'jsearch';

interface EnrichProxyRequest {
  source: EnrichSource;
  domain: string;
  companyName?: string;
}

/**
 * Call the enrich-proxy Edge Function
 * This proxies API calls to SimilarWeb, BuiltWith, and JSearch
 * API keys are stored securely in Supabase Secrets (server-side)
 */
export async function callEnrichProxy<T>(request: EnrichProxyRequest): Promise<{
  data: T | null;
  error: string | null;
}> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/enrich-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: data.error || `API returned ${response.status}` };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// =============================================================================
// Supabase client-like interface for compatibility
// =============================================================================

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
