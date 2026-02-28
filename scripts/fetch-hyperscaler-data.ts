/**
 * Fetch Hyperscaler Data from BuiltWith Lists API
 *
 * Fetches AWS and Azure company lists and updates the companies table.
 *
 * Usage:
 *   npx ts-node scripts/fetch-hyperscaler-data.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// BuiltWith technology names (actual names in their database)
const HYPERSCALERS = [
  { tech: 'Amazon-CloudFront', cloudTech: 'AWS' },
  { tech: 'Amazon-S3', cloudTech: 'AWS' },  // Secondary AWS indicator
  { tech: 'Microsoft-Azure', cloudTech: 'Azure' },
];

interface BuiltWithListResult {
  D: string;  // Domain
  // Other fields we don't need
}

interface BuiltWithListsResponse {
  Results?: BuiltWithListResult[];
  Errors?: string[];
}

async function fetchBuiltWithLists(tech: string): Promise<string[]> {
  console.log(`\nFetching ${tech} from BuiltWith Lists API...`);

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/enrich-proxy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'builtwith-lists',
        tech: tech,
        since: '365',  // Last year
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json() as BuiltWithListsResponse;

  if (data.Errors && data.Errors.length > 0) {
    throw new Error(`BuiltWith error: ${data.Errors.join(', ')}`);
  }

  if (!data.Results) {
    console.log(`  No results for ${tech}`);
    return [];
  }

  const domains = data.Results.map(r => r.D.toLowerCase());
  console.log(`  Found ${domains.length} domains using ${tech}`);
  return domains;
}

async function updateCompaniesCloudTech(domains: string[], cloudTech: string): Promise<number> {
  if (domains.length === 0) return 0;

  // Update in batches of 500
  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('companies')
      .update({ cloud_tech: cloudTech })
      .in('domain', batch)
      .select('domain');

    if (error) {
      console.error(`  Error updating batch ${i / BATCH_SIZE + 1}:`, error.message);
    } else {
      updated += data?.length || 0;
    }
  }

  return updated;
}

async function main() {
  console.log("=".repeat(60));
  console.log("HYPERSCALER DATA FETCH (AWS + Azure)");
  console.log("=".repeat(60));

  const results: { cloudTech: string; fetched: number; updated: number }[] = [];

  for (const { tech, cloudTech } of HYPERSCALERS) {
    try {
      // Fetch from BuiltWith
      const domains = await fetchBuiltWithLists(tech);

      // Update companies table
      const updated = await updateCompaniesCloudTech(domains, cloudTech);
      console.log(`  Updated ${updated} companies with cloud_tech = '${cloudTech}'`);

      results.push({ cloudTech, fetched: domains.length, updated });
    } catch (err) {
      console.error(`  Failed to fetch ${tech}:`, err instanceof Error ? err.message : err);
      results.push({ cloudTech, fetched: 0, updated: 0 });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  for (const r of results) {
    console.log(`${r.cloudTech}: ${r.fetched} fetched, ${r.updated} matched in companies table`);
  }

  // Verify counts
  const { count: awsCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('cloud_tech', 'AWS');

  const { count: azureCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('cloud_tech', 'Azure');

  console.log(`\nFinal counts in companies table:`);
  console.log(`  AWS: ${awsCount || 0}`);
  console.log(`  Azure: ${azureCount || 0}`);
  console.log(`  Total with cloud_tech: ${(awsCount || 0) + (azureCount || 0)}`);
}

main().catch(console.error);
