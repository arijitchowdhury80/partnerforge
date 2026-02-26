/**
 * Enrichment Service
 *
 * Fetches data from SimilarWeb API and updates Supabase.
 * This makes the "Enrich Now" button actually work!
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY; // anon key - requires RLS policy for updates
const SIMILARWEB_API_KEY = import.meta.env.VITE_SIMILARWEB_API_KEY;

// =============================================================================
// Types
// =============================================================================

export interface EnrichmentResult {
  success: boolean;
  domain: string;
  data?: {
    sw_monthly_visits?: number;
    vertical?: string;
    country?: string;
    traffic_growth?: number;
  };
  error?: string;
}

export interface EnrichmentProgress {
  domain: string;
  status: 'pending' | 'fetching' | 'updating' | 'complete' | 'error';
  message: string;
}

// =============================================================================
// SimilarWeb API
// =============================================================================

interface SimilarWebResponse {
  visits?: number;
  category?: string;
  country?: number;
  global_rank?: {
    rank?: number;
  };
  category_rank?: {
    category?: string;
    rank?: number;
  };
  // Engagement data
  pages_per_visit?: number;
  time_on_site?: number;
  bounce_rate?: number;
}

async function fetchSimilarWebData(domain: string): Promise<SimilarWebResponse | null> {
  if (!SIMILARWEB_API_KEY) {
    console.error('[Enrichment] No SimilarWeb API key configured');
    return null;
  }

  // Try multiple endpoints
  const endpoints = [
    `https://api.similarweb.com/v1/SimilarWebAddon/${domain}/all`,
    `https://api.similarweb.com/v1/website/${domain}/total-traffic-and-engagement/visits`,
  ];

  for (const url of endpoints) {
    try {
      console.log(`[Enrichment] Fetching: ${url}`);
      const response = await fetch(`${url}?api_key=${SIMILARWEB_API_KEY}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[Enrichment] SimilarWeb response:`, data);
        return data;
      } else {
        console.warn(`[Enrichment] SimilarWeb ${response.status}: ${await response.text()}`);
      }
    } catch (err) {
      console.warn(`[Enrichment] SimilarWeb error:`, err);
    }
  }

  return null;
}

// =============================================================================
// Supabase Update (using anon key - requires RLS policy allowing updates)
// =============================================================================

async function updateSupabase(
  domain: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!SUPABASE_KEY) {
    console.error('[Enrichment] No Supabase key configured');
    return false;
  }

  const url = `${SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.${encodeURIComponent(domain)}`;

  try {
    console.log(`[Enrichment] Updating Supabase for ${domain}:`, data);
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
        enrichment_level: 'basic',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Enrichment] Supabase update failed: ${errorText}`);
      return false;
    }

    console.log(`[Enrichment] Successfully updated ${domain}`);
    return true;
  } catch (err) {
    console.error(`[Enrichment] Supabase error:`, err);
    return false;
  }
}

// =============================================================================
// Map SimilarWeb category to our verticals
// =============================================================================

function mapCategory(category: string | undefined): string {
  if (!category) return 'Unknown';

  const categoryLower = category.toLowerCase();

  if (categoryLower.includes('auto')) return 'Automotive And Vehicles';
  if (categoryLower.includes('retail') || categoryLower.includes('shopping')) return 'Retail';
  if (categoryLower.includes('health')) return 'Health And Fitness';
  if (categoryLower.includes('finance') || categoryLower.includes('banking')) return 'Finance';
  if (categoryLower.includes('tech') || categoryLower.includes('computer')) return 'Technology And Computing';
  if (categoryLower.includes('media') || categoryLower.includes('entertainment')) return 'Art And Entertainment';
  if (categoryLower.includes('business') || categoryLower.includes('industry')) return 'Business And Industrial';
  if (categoryLower.includes('food')) return 'Food And Drink';
  if (categoryLower.includes('fashion') || categoryLower.includes('style')) return 'Style And Fashion';
  if (categoryLower.includes('travel')) return 'Travel';

  return category;
}

// =============================================================================
// Main Enrichment Function
// =============================================================================

export async function enrichCompany(
  domain: string,
  onProgress?: (progress: EnrichmentProgress) => void
): Promise<EnrichmentResult> {
  // Step 1: Notify start
  onProgress?.({
    domain,
    status: 'fetching',
    message: 'Fetching traffic data from SimilarWeb...',
  });

  // Step 2: Fetch SimilarWeb data
  const swData = await fetchSimilarWebData(domain);

  if (!swData) {
    onProgress?.({
      domain,
      status: 'error',
      message: 'Could not fetch SimilarWeb data. The domain may not have enough traffic.',
    });

    // Still update the last_enriched timestamp
    await updateSupabase(domain, {});

    return {
      success: false,
      domain,
      error: 'SimilarWeb data not available',
    };
  }

  // Step 3: Prepare enrichment data
  onProgress?.({
    domain,
    status: 'updating',
    message: 'Updating database with enriched data...',
  });

  const enrichmentData: Record<string, unknown> = {};

  // Map SimilarWeb fields to our schema
  if (swData.visits) {
    enrichmentData.sw_monthly_visits = swData.visits;
  }

  if (swData.category || swData.category_rank?.category) {
    enrichmentData.vertical = mapCategory(swData.category || swData.category_rank?.category);
  }

  // Step 4: Update Supabase
  const updated = await updateSupabase(domain, enrichmentData);

  if (!updated) {
    onProgress?.({
      domain,
      status: 'error',
      message: 'Failed to update database',
    });

    return {
      success: false,
      domain,
      error: 'Database update failed',
    };
  }

  // Step 5: Success!
  onProgress?.({
    domain,
    status: 'complete',
    message: `Enriched! ${swData.visits ? `${(swData.visits / 1000000).toFixed(1)}M monthly visits` : 'Data updated'}`,
  });

  return {
    success: true,
    domain,
    data: {
      sw_monthly_visits: swData.visits,
      vertical: enrichmentData.vertical as string | undefined,
    },
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

    // Rate limiting - wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
