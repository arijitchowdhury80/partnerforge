/**
 * Galaxy API Service
 * Fetches data from the Layer 0 companies table and related views
 */

import type {
  GalaxyCompany,
  TechOption,
  GalaxySummary,
  CohortSummary,
  GalaxyFilterState,
  FunnelSummary,
} from '../types';

// =============================================================================
// Environment
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// =============================================================================
// Base Request Helper
// =============================================================================

async function supabaseGet<T>(
  endpoint: string,
  options?: {
    countExact?: boolean;
    range?: [number, number];
  }
): Promise<{ data: T | null; error: string | null; count?: number }> {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (options?.countExact) {
    headers['Prefer'] = 'count=exact';
  }

  if (options?.range) {
    headers['Range'] = `${options.range[0]}-${options.range[1]}`;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: errorText };
    }

    const data = await response.json();

    // Extract count from content-range header
    const contentRange = response.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1]) : undefined;

    return { data, error: null, count };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

// =============================================================================
// Galaxy API Functions
// =============================================================================

/**
 * Get companies with filters and pagination
 */
export async function getCompanies(
  filters: Partial<GalaxyFilterState> = {},
  options: { limit?: number; offset?: number } = {}
): Promise<{ companies: GalaxyCompany[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  // Build query string
  let query = 'companies?select=*';

  // Apply filters
  if (filters.cms_tech?.length) {
    query += `&cms_tech=in.(${filters.cms_tech.filter(Boolean).join(',')})`;
  }
  if (filters.commerce_tech?.length) {
    query += `&commerce_tech=in.(${filters.commerce_tech.filter(Boolean).join(',')})`;
  }
  if (filters.martech_tech?.length) {
    query += `&martech_tech=in.(${filters.martech_tech.filter(Boolean).join(',')})`;
  }
  if (filters.search_tech?.length) {
    query += `&search_tech=in.(${filters.search_tech.filter(Boolean).join(',')})`;
  }
  if (filters.tech_cohort?.length) {
    query += `&tech_cohort=in.(${filters.tech_cohort.join(',')})`;
  }
  if (filters.sales_play?.length) {
    query += `&sales_play=in.(${filters.sales_play.join(',')})`;
  }
  if (filters.search) {
    query += `&or=(domain.ilike.*${encodeURIComponent(filters.search)}*,company_name.ilike.*${encodeURIComponent(filters.search)}*)`;
  }

  // Order by domain
  query += '&order=domain.asc';

  const { data, error, count } = await supabaseGet<GalaxyCompany[]>(query, {
    countExact: true,
    range: [offset, offset + limit - 1],
  });

  if (error) {
    console.error('Error fetching companies:', error);
    return { companies: [], total: 0 };
  }

  return {
    companies: data || [],
    total: count || 0,
  };
}

/**
 * Get a single company by domain
 */
export async function getCompanyByDomain(domain: string): Promise<GalaxyCompany | null> {
  const { data, error } = await supabaseGet<GalaxyCompany[]>(
    `companies?domain=eq.${encodeURIComponent(domain)}`
  );

  if (error || !data?.length) {
    return null;
  }

  return data[0];
}

/**
 * Get tech options for dropdowns
 */
export async function getTechOptions(): Promise<TechOption[]> {
  const { data, error } = await supabaseGet<TechOption[]>(
    'tech_options?select=*&order=galaxy.asc,display_order.asc'
  );

  if (error) {
    console.error('Error fetching tech options:', error);
    return [];
  }

  return data || [];
}

/**
 * Get galaxy summary (counts per technology)
 */
export async function getGalaxySummary(): Promise<GalaxySummary[]> {
  const { data, error } = await supabaseGet<GalaxySummary[]>(
    'galaxy_summary?select=*'
  );

  if (error) {
    console.error('Error fetching galaxy summary:', error);
    return [];
  }

  return data || [];
}

/**
 * Get cohort summary (counts per tech cohort)
 */
export async function getCohortSummary(): Promise<CohortSummary[]> {
  const { data, error } = await supabaseGet<CohortSummary[]>(
    'cohort_summary?select=*'
  );

  if (error) {
    console.error('Error fetching cohort summary:', error);
    return [];
  }

  return data || [];
}

/**
 * Get total company count
 */
export async function getTotalCount(): Promise<number> {
  const { count } = await supabaseGet<GalaxyCompany[]>('companies?select=domain', {
    countExact: true,
    range: [0, 0],
  });

  return count || 0;
}

/**
 * Get funnel summary (counts at each layer)
 * Note: This requires the funnel_master view to be created
 */
export async function getFunnelSummary(): Promise<FunnelSummary> {
  // For now, return placeholder until funnel_master view is created
  const total = await getTotalCount();

  return {
    layer0_galaxy: total,
    layer2_whale: 0,  // Will be populated when whale join is implemented
    layer3_crossbeam: 0,  // Will be populated when crossbeam join is implemented
    cream_set: 0,
    hot_targets: 0,
  };
}

// =============================================================================
// Data Import Functions (for loading BuiltWith data)
// =============================================================================

/**
 * Upsert companies from CSV data
 */
export async function upsertCompanies(
  companies: Partial<GalaxyCompany>[]
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  // Use service key for writes
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.error('Service key required for writes');
    return { success: 0, errors: companies.length };
  }

  for (const company of companies) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          domain: company.domain,
          company_name: company.company_name,
          cms_tech: company.cms_tech,
          commerce_tech: company.commerce_tech,
          martech_tech: company.martech_tech,
          search_tech: company.search_tech,
          source: company.source || 'builtwith',
          source_date: company.source_date || new Date().toISOString().split('T')[0],
        }),
      });

      if (response.ok) {
        success++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { success, errors };
}
