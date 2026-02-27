/**
 * Batch Enrichment Script for Amplience and Spryker Partners
 *
 * Run with: npx tsx scripts/batch-enrich.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env file
const envPath = resolve(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
}

const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_KEY = env.VITE_SUPABASE_KEY || '';
const SIMILARWEB_API_KEY = env.VITE_SIMILARWEB_API_KEY || '';
const BUILTWITH_API_KEY = env.VITE_BUILTWITH_API_KEY || '';

async function getDomainsForPartners(partners: string[]): Promise<string[]> {
  const domains: string[] = [];

  for (const partner of partners) {
    const url = `${SUPABASE_URL}/rest/v1/displacement_targets?select=domain&partner_tech=ilike.*${partner}*&order=icp_score.desc.nullslast`;

    const response = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY },
    });

    if (response.ok) {
      const data = await response.json();
      domains.push(...data.map((d: { domain: string }) => d.domain));
    }
  }

  return domains;
}

async function fetchSimilarWebTraffic(domain: string) {
  if (!SIMILARWEB_API_KEY) return null;

  try {
    const url = `https://api.similarweb.com/v1/SimilarWebAddon/${domain}/all?api_key=${SIMILARWEB_API_KEY}`;
    const response = await fetch(url);
    if (response.ok) return await response.json();
  } catch (err) {
    console.warn(`[SW] Error for ${domain}:`, err);
  }
  return null;
}

async function fetchBuiltWithTech(domain: string) {
  if (!BUILTWITH_API_KEY) return null;

  try {
    const url = `https://api.builtwith.com/free1/api.json?KEY=${BUILTWITH_API_KEY}&LOOKUP=${domain}`;
    const response = await fetch(url);
    if (response.ok) return await response.json();
  } catch (err) {
    console.warn(`[BW] Error for ${domain}:`, err);
  }
  return null;
}

async function updateSupabase(domain: string, data: Record<string, unknown>): Promise<boolean> {
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

    return response.ok;
  } catch (err) {
    console.error(`[DB] Error updating ${domain}:`, err);
    return false;
  }
}

async function enrichDomain(domain: string): Promise<{ success: boolean; message: string }> {
  console.log(`\n→ Enriching ${domain}...`);

  // Step 1: SimilarWeb Traffic
  const swData = await fetchSimilarWebTraffic(domain);
  const enrichedData: Record<string, unknown> = {};

  if (swData?.visits) {
    enrichedData.sw_monthly_visits = swData.visits;
    enrichedData.sw_bounce_rate = swData.bounce_rate;
    enrichedData.sw_pages_per_visit = swData.pages_per_visit;
    enrichedData.sw_time_on_site = swData.time_on_site;
    enrichedData.sw_global_rank = swData.global_rank?.rank;
    console.log(`  ✓ Traffic: ${(swData.visits / 1000000).toFixed(1)}M visits`);
  } else {
    console.log(`  ○ No traffic data`);
  }

  // Step 2: BuiltWith Tech Stack
  const bwData = await fetchBuiltWithTech(domain);
  if (bwData?.Results?.[0]?.Result?.Paths?.[0]?.Technologies) {
    const techs = bwData.Results[0].Result.Paths[0].Technologies;
    enrichedData.tech_stack_json = JSON.stringify(techs);

    // Detect search
    for (const tech of techs) {
      const name = (tech.Name || '').toLowerCase();
      if (name.includes('algolia')) {
        enrichedData.current_search = 'Algolia';
        break;
      } else if (name.includes('elastic')) {
        enrichedData.current_search = 'Elasticsearch';
        break;
      } else if (name.includes('search')) {
        enrichedData.current_search = tech.Name;
        break;
      }
    }
    console.log(`  ✓ Tech stack: ${techs.length} technologies`);
    if (enrichedData.current_search) {
      console.log(`  ✓ Search: ${enrichedData.current_search}`);
    }
  } else {
    console.log(`  ○ No tech stack data`);
  }

  // Step 3: Save to Supabase
  if (Object.keys(enrichedData).length > 0) {
    const saved = await updateSupabase(domain, enrichedData);
    if (saved) {
      console.log(`  ✓ Saved to database`);
      return { success: true, message: 'Enriched and saved' };
    } else {
      console.log(`  ✗ Failed to save`);
      return { success: false, message: 'Save failed' };
    }
  } else {
    console.log(`  ○ No new data to save`);
    return { success: true, message: 'No new data' };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Batch Enrichment: Amplience + Spryker Partners');
  console.log('='.repeat(60));

  // Check API keys
  if (!SUPABASE_KEY) {
    console.error('ERROR: VITE_SUPABASE_KEY not set');
    console.log('Run with: VITE_SUPABASE_KEY=... npx tsx scripts/batch-enrich.ts');
    process.exit(1);
  }

  if (!SIMILARWEB_API_KEY) {
    console.warn('WARNING: No SimilarWeb API key - traffic data will be skipped');
  }

  if (!BUILTWITH_API_KEY) {
    console.warn('WARNING: No BuiltWith API key - tech stack will be skipped');
  }

  // Get domains
  console.log('\nFetching domains for Amplience and Spryker...');
  const domains = await getDomainsForPartners(['amplience', 'spryker']);
  console.log(`Found ${domains.length} domains to enrich`);

  // Enrich each domain
  let success = 0;
  let failed = 0;

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    console.log(`\n[${i + 1}/${domains.length}] ${domain}`);

    try {
      const result = await enrichDomain(domain);
      if (result.success) success++;
      else failed++;
    } catch (err) {
      console.error(`  ✗ Error:`, err);
      failed++;
    }

    // Rate limiting - 1.5 seconds between requests
    if (i < domains.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`COMPLETE: ${success} succeeded, ${failed} failed out of ${domains.length}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
