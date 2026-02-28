/**
 * Import Search Competitors from BuiltWith Lists API
 *
 * Fetches domains using specific search technologies and imports them
 * into our companies table with the correct search_tech field.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Search competitors to import from Lists API
// Format: { builtwithName: our_name }
const SEARCH_COMPETITORS: Record<string, string> = {
  'Constructor-IO': 'Constructor',
  'BloomReach': 'Bloomreach',
};

interface ListsApiResult {
  D: string; // Domain
  FL?: number; // First Live
  LL?: number; // Last Live
}

async function fetchListsApi(tech: string): Promise<ListsApiResult[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/enrich-proxy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'builtwith-lists',
      tech,
      since: '365',
    }),
  });

  const data = await response.json();
  return data.Results || [];
}

async function importSearchCompetitor(
  builtwithName: string,
  ourName: string
): Promise<number> {
  console.log(`\nFetching ${builtwithName} from BuiltWith Lists API...`);

  const results = await fetchListsApi(builtwithName);
  console.log(`  Found ${results.length} domains`);

  if (results.length === 0) return 0;

  // Extract domains
  const domains = results.map((r) => r.D.toLowerCase());
  console.log(`  Sample domains: ${domains.slice(0, 5).join(', ')}...`);

  // Check which domains already exist in our companies table
  const { data: existingCompanies, error: checkError } = await supabase
    .from('companies')
    .select('domain, search_tech')
    .in('domain', domains);

  if (checkError) {
    console.error('  Error checking existing companies:', checkError.message);
    return 0;
  }

  const existingDomains = new Set(
    (existingCompanies || []).map((c) => c.domain)
  );
  const needsUpdate = (existingCompanies || []).filter(
    (c) => !c.search_tech || c.search_tech !== ourName
  );
  const newDomains = domains.filter((d) => !existingDomains.has(d));

  console.log(`  Existing in DB: ${existingDomains.size}`);
  console.log(`  Needs update: ${needsUpdate.length}`);
  console.log(`  New domains: ${newDomains.length}`);

  let updatedCount = 0;
  let insertedCount = 0;

  // Update existing companies that don't have this search_tech
  for (const company of needsUpdate) {
    const { error: updateError } = await supabase
      .from('companies')
      .update({ search_tech: ourName })
      .eq('domain', company.domain);

    if (updateError) {
      console.error(`  Error updating ${company.domain}:`, updateError.message);
    } else {
      updatedCount++;
    }
  }

  // Insert new companies
  const BATCH_SIZE = 100;
  for (let i = 0; i < newDomains.length; i += BATCH_SIZE) {
    const batch = newDomains.slice(i, i + BATCH_SIZE);
    const records = batch.map((domain) => ({
      domain,
      company_name: domain.split('.')[0],
      search_tech: ourName,
    }));

    const { error: insertError } = await supabase
      .from('companies')
      .upsert(records, { onConflict: 'domain' });

    if (insertError) {
      console.error(`  Error inserting batch:`, insertError.message);
    } else {
      insertedCount += batch.length;
    }
  }

  console.log(`  Updated: ${updatedCount}, Inserted: ${insertedCount}`);
  return updatedCount + insertedCount;
}

async function main() {
  console.log('=== Importing Search Competitors from BuiltWith Lists API ===');
  console.log('');

  let totalImported = 0;

  for (const [builtwithName, ourName] of Object.entries(SEARCH_COMPETITORS)) {
    const count = await importSearchCompetitor(builtwithName, ourName);
    totalImported += count;
  }

  console.log('\n=== Summary ===');
  console.log(`Total records imported/updated: ${totalImported}`);

  // Verify with galaxy_summary
  console.log('\nVerifying with galaxy_summary...');
  const { data: summary } = await supabase
    .from('galaxy_summary')
    .select('*')
    .eq('galaxy', 'search')
    .in('tech', Object.values(SEARCH_COMPETITORS));

  if (summary) {
    console.log('\nSearch galaxy data:');
    for (const row of summary) {
      console.log(`  ${row.tech}: ${row.company_count} companies`);
    }
  }
}

main().catch(console.error);
