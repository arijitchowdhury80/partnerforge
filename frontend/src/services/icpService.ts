/**
 * ICP Service - Fetch ICP data from Supabase
 *
 * Uses direct REST API calls to match project patterns.
 */

// =============================================================================
// Environment
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// =============================================================================
// Types
// =============================================================================

export interface ICPIndustry {
  id: string;
  name: string;
  display_name: string;
  color: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  proof_points: number;
  company_count?: number;
  quote_count?: number;
}

export interface ICPCompany {
  id: string;
  company_name: string;
  story_url: string | null;
  industry_id: string | null;
  industry_raw: string;
  use_case: string;
  country: string;
  region: string;
  evidence_tier: 'GOLD' | 'SILVER' | 'BRONZE';
  quotes?: ICPQuote[];
  features?: ICPFeature[];
  metrics?: ICPMetric[];
}

export interface ICPQuote {
  id: string;
  company_id: string;
  quote_text: string;
  speaker_name: string;
  speaker_title: string;
  source: string;
  company_name?: string;
}

export interface ICPFeature {
  id: string;
  name: string;
  display_name: string;
  description: string;
}

export interface ICPMetric {
  id: string;
  company_id: string;
  metric_text: string;
  metric_value: number | null;
  metric_unit: string | null;
  metric_category: string | null;
}

export interface ICPPersona {
  id: string;
  persona_key: string;
  name: string;
  percentage: number;
  color: string;
  sample_quote: string;
  sample_speaker: string;
  titles: string[];
  themes: string[];
}

export interface ICPSummary {
  total_companies: number;
  with_stories: number;
  total_quotes: number;
  companies_with_quotes: number;
  total_proofpoints: number;
  total_metrics: number;
  total_personas: number;
  gold_tier: number;
  silver_tier: number;
  bronze_tier: number;
}

interface SupabaseResponse<T> {
  data: T | null;
  error: string | null;
  count?: number;
}

// =============================================================================
// Base Request Function
// =============================================================================

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
// API Functions
// =============================================================================

/**
 * Get ICP summary stats
 */
export async function getICPSummary(): Promise<ICPSummary | null> {
  const { data, error } = await supabaseRequest<ICPSummary[]>('icp_summary?select=*');

  if (error || !data || data.length === 0) {
    console.error('Error fetching ICP summary:', error);
    return null;
  }

  return data[0];
}

/**
 * Get all industries
 */
export async function getIndustries(): Promise<ICPIndustry[]> {
  const { data, error } = await supabaseRequest<ICPIndustry[]>(
    'icp_industries?select=*&order=proof_points.desc'
  );

  if (error) {
    console.error('Error fetching industries:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all companies
 */
export async function getCompanies(options?: {
  industryId?: string;
  evidenceTier?: 'GOLD' | 'SILVER' | 'BRONZE';
  limit?: number;
}): Promise<ICPCompany[]> {
  let endpoint = 'icp_companies?select=*&order=evidence_tier.asc';

  if (options?.industryId) {
    endpoint += `&industry_id=eq.${options.industryId}`;
  }

  if (options?.evidenceTier) {
    endpoint += `&evidence_tier=eq.${options.evidenceTier}`;
  }

  if (options?.limit) {
    endpoint += `&limit=${options.limit}`;
  }

  const { data, error } = await supabaseRequest<ICPCompany[]>(endpoint);

  if (error) {
    console.error('Error fetching companies:', error);
    return [];
  }

  return data || [];
}

/**
 * Get company by ID with full details
 */
export async function getCompanyWithDetails(companyId: string): Promise<ICPCompany | null> {
  // Fetch company
  const { data: companyData, error: companyError } = await supabaseRequest<ICPCompany[]>(
    `icp_companies?id=eq.${companyId}&select=*`
  );

  if (companyError || !companyData || companyData.length === 0) {
    console.error('Error fetching company:', companyError);
    return null;
  }

  const company = companyData[0];

  // Fetch quotes
  const { data: quotes } = await supabaseRequest<ICPQuote[]>(
    `icp_quotes?company_id=eq.${companyId}&select=*`
  );

  // Fetch feature IDs
  const { data: featureLinks } = await supabaseRequest<{ feature_id: string }[]>(
    `icp_company_features?company_id=eq.${companyId}&select=feature_id`
  );

  let features: ICPFeature[] = [];
  if (featureLinks && featureLinks.length > 0) {
    const featureIds = featureLinks.map(f => f.feature_id);
    const { data: featureData } = await supabaseRequest<ICPFeature[]>(
      `icp_features?id=in.(${featureIds.join(',')})&select=*`
    );
    features = featureData || [];
  }

  // Fetch metrics
  const { data: metrics } = await supabaseRequest<ICPMetric[]>(
    `icp_metrics?company_id=eq.${companyId}&select=*`
  );

  return {
    ...company,
    quotes: quotes || [],
    features,
    metrics: metrics || [],
  };
}

/**
 * Get quotes with optional filtering
 */
export async function getQuotes(options?: {
  companyId?: string;
  limit?: number;
}): Promise<ICPQuote[]> {
  let endpoint = 'icp_quotes?select=*,icp_companies(company_name)&order=created_at.desc';

  if (options?.companyId) {
    endpoint += `&company_id=eq.${options.companyId}`;
  }

  if (options?.limit) {
    endpoint += `&limit=${options.limit}`;
  }

  interface QuoteWithCompany extends ICPQuote {
    icp_companies: { company_name: string } | null;
  }

  const { data, error } = await supabaseRequest<QuoteWithCompany[]>(endpoint);

  if (error) {
    console.error('Error fetching quotes:', error);
    return [];
  }

  return (data || []).map(q => ({
    ...q,
    company_name: q.icp_companies?.company_name,
  }));
}

/**
 * Get featured quotes from GOLD tier companies
 */
export async function getFeaturedQuotes(limit = 6): Promise<ICPQuote[]> {
  // First get GOLD companies with stories
  const { data: goldCompanies } = await supabaseRequest<ICPCompany[]>(
    `icp_companies?evidence_tier=eq.GOLD&story_url=not.is.null&select=id,company_name`
  );

  if (!goldCompanies || goldCompanies.length === 0) {
    return [];
  }

  const companyIds = goldCompanies.map(c => c.id);
  const companyNameMap = new Map(goldCompanies.map(c => [c.id, c.company_name]));

  // Fetch quotes from those companies
  const { data: quotes, error } = await supabaseRequest<ICPQuote[]>(
    `icp_quotes?company_id=in.(${companyIds.join(',')})&select=*&limit=${limit}`
  );

  if (error) {
    console.error('Error fetching featured quotes:', error);
    return [];
  }

  return (quotes || []).map(q => ({
    ...q,
    company_name: companyNameMap.get(q.company_id) || '',
  }));
}

/**
 * Get all features
 */
export async function getFeatures(): Promise<ICPFeature[]> {
  const { data, error } = await supabaseRequest<ICPFeature[]>(
    'icp_features?select=*&order=display_name.asc'
  );

  if (error) {
    console.error('Error fetching features:', error);
    return [];
  }

  return data || [];
}

/**
 * Get personas with titles and themes (using view)
 */
export async function getPersonas(): Promise<ICPPersona[]> {
  const { data, error } = await supabaseRequest<ICPPersona[]>(
    'icp_persona_details?select=*&order=percentage.desc'
  );

  if (error) {
    console.error('Error fetching personas:', error);
    return [];
  }

  return data || [];
}

/**
 * Search companies by name
 */
export async function searchCompanies(query: string, limit = 10): Promise<ICPCompany[]> {
  const { data, error } = await supabaseRequest<ICPCompany[]>(
    `icp_companies?company_name=ilike.*${encodeURIComponent(query)}*&select=*&limit=${limit}`
  );

  if (error) {
    console.error('Error searching companies:', error);
    return [];
  }

  return data || [];
}

/**
 * Get companies grouped by industry with counts
 */
export async function getIndustriesWithStats(): Promise<ICPIndustry[]> {
  const industries = await getIndustries();

  // Fetch all companies
  const { data: companies } = await supabaseRequest<ICPCompany[]>(
    'icp_companies?select=industry_id'
  );

  // Count per industry
  const countMap = new Map<string, number>();
  companies?.forEach(c => {
    if (c.industry_id) {
      countMap.set(c.industry_id, (countMap.get(c.industry_id) || 0) + 1);
    }
  });

  return industries.map(ind => ({
    ...ind,
    company_count: countMap.get(ind.id) || 0,
  }));
}

/**
 * Check if ICP tables exist and have data
 */
export async function checkICPDataExists(): Promise<boolean> {
  const summary = await getICPSummary();
  return summary !== null && summary.total_companies > 0;
}
