/**
 * Fetch Search Galaxy Data from BuiltWith Lists API
 *
 * Fetches companies using Search competitor technologies and UPSERTS into the `companies` table.
 * Preserves existing CMS/Commerce data when updating.
 *
 * Usage:
 *   npx ts-node scripts/fetch-search-galaxy.ts
 *   npx ts-node scripts/fetch-search-galaxy.ts --tech Elastic     # Single tech
 *   npx ts-node scripts/fetch-search-galaxy.ts --test             # Test mode (1 tech, limit 10)
 *   npx ts-node scripts/fetch-search-galaxy.ts --dry-run          # Preview only
 */

import { createClient } from "@supabase/supabase-js";

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Search Technologies - BuiltWith tech names mapped to our slugs
// These are Algolia COMPETITORS - companies using these are DISPLACEMENT targets
//
// NOTE: Many common search techs (Elasticsearch, Solr, SearchSpring, Klevu, etc.)
// are NOT available in BuiltWith Lists API. These will be enriched separately
// via the Domain API on a per-company basis.
//
// Available in Lists API (verified 2026-02-27):
const SEARCH_TECHS: Record<string, string> = {
  // Coveo - Enterprise search (works)
  "Coveo": "Coveo",

  // Swiftype - Elastic's hosted search (works)
  "Swiftype": "Swiftype",

  // Doofinder - E-commerce search (works)
  "Doofinder": "Doofinder",

  // Yext - Local/answers search (works)
  "Yext": "Yext",

  // Cludo - Site search (works)
  "Cludo": "Cludo",

  // Searchanise - E-commerce search (works)
  "Searchanise": "Searchanise",

  // AddSearch - Site search (works)
  "AddSearch": "AddSearch",

  // Sooqr - E-commerce search (works)
  "Sooqr": "Sooqr",
};

// These are NOT available in Lists API - need Domain API enrichment:
// - Elasticsearch, Solr (open source - detected differently)
// - SearchSpring, Klevu, Bloomreach, Lucidworks, Constructor (enterprise)

// Delay between API calls (rate limiting)
const DELAY_BETWEEN_CALLS = 3000; // 3 seconds

// =============================================================================
// TYPES
// =============================================================================

interface BuiltWithListResult {
  D: string;  // Domain
  FL?: number; // First Live (timestamp)
  LL?: number; // Last Live (timestamp)
}

interface BuiltWithListsResponse {
  Results?: BuiltWithListResult[];
  Errors?: string[];
  NextOffset?: string;
  Identifier?: string;
}

interface CompanyUpsert {
  domain: string;
  search_tech: string;
  source: string;
  source_date: string;
}

// =============================================================================
// BUILTWITH LISTS API CALL
// =============================================================================

async function fetchTechList(
  tech: string,
  since: string = "90"
): Promise<{ success: boolean; data?: BuiltWithListsResponse; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/enrich-proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "builtwith-lists",
        tech: tech,
        since: since,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 300)}`,
      };
    }

    const rawText = await response.text();
    let data: BuiltWithListsResponse;

    try {
      data = JSON.parse(rawText) as BuiltWithListsResponse;
    } catch (parseErr) {
      return { success: false, error: `JSON parse error: ${rawText.substring(0, 300)}` };
    }

    // Check for BuiltWith errors
    if (data.Errors && data.Errors.length > 0) {
      return { success: false, error: data.Errors.join(", ") };
    }

    // Check for error property (different error format)
    if ((data as any).error) {
      return { success: false, error: `API error: ${JSON.stringify((data as any).error)}` };
    }

    // Check if Results is missing or empty (might indicate tech not found)
    if (!data.Results) {
      return { success: false, error: `No Results: ${rawText.substring(0, 300)}` };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
}

// =============================================================================
// EXTRACT DOMAINS FROM RESPONSE
// =============================================================================

function extractDomains(response: BuiltWithListsResponse): string[] {
  if (!response.Results || !Array.isArray(response.Results)) {
    return [];
  }

  return response.Results
    .map((r) => r.D?.toLowerCase().trim())
    .filter((d): d is string => !!d && d.length > 0);
}

// =============================================================================
// UPSERT COMPANIES (preserving existing data)
// =============================================================================

async function upsertCompanies(
  companies: CompanyUpsert[],
  dryRun: boolean = false
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;

  if (dryRun) {
    console.log(`  [DRY RUN] Would upsert ${companies.length} companies`);
    return { inserted: companies.length, updated: 0, errors: [] };
  }

  // Batch upsert in chunks of 100
  const BATCH_SIZE = 100;

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);

    // Use upsert with onConflict to preserve existing columns
    const { data, error } = await supabase.from("companies").upsert(
      batch.map(c => ({
        domain: c.domain,
        search_tech: c.search_tech,
        source: c.source,
        source_date: c.source_date,
      })),
      {
        onConflict: "domain",
        ignoreDuplicates: false, // Update if exists
      }
    ).select("domain");

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, updated, errors };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("SEARCH GALAXY FETCHER (Competitor Search Technologies)");
  console.log("=".repeat(60));

  // Parse args
  const args = process.argv.slice(2);
  let singleTech: string | null = null;
  let testMode = false;
  let dryRun = false;
  let sinceDays = "90";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tech" && args[i + 1]) {
      singleTech = args[i + 1];
    }
    if (args[i] === "--test") {
      testMode = true;
    }
    if (args[i] === "--dry-run") {
      dryRun = true;
    }
    if (args[i] === "--since" && args[i + 1]) {
      sinceDays = args[i + 1];
    }
  }

  // Determine which techs to fetch
  let techsToFetch: Array<[string, string]>;

  if (singleTech) {
    // Find matching tech by slug or BuiltWith name
    const match = Object.entries(SEARCH_TECHS).find(
      ([bwName, slug]) =>
        slug.toLowerCase() === singleTech!.toLowerCase() ||
        bwName.toLowerCase() === singleTech!.toLowerCase()
    );
    if (!match) {
      console.error(`Unknown tech: ${singleTech}`);
      console.log("Available slugs:", [...new Set(Object.values(SEARCH_TECHS))].join(", "));
      process.exit(1);
    }
    // Get all BuiltWith names for this slug
    techsToFetch = Object.entries(SEARCH_TECHS).filter(([_, slug]) => slug === match[1]);
  } else if (testMode) {
    // Test with just Coveo (smaller result set)
    techsToFetch = [["Coveo", "Coveo"]];
  } else {
    techsToFetch = Object.entries(SEARCH_TECHS);
  }

  console.log(`\nFetching ${techsToFetch.length} technology variant(s)...`);
  console.log(`Since: ${sinceDays} days ago`);
  if (testMode) console.log("TEST MODE - limited results");
  if (dryRun) console.log("DRY RUN - no database writes");

  const stats = {
    totalDomains: 0,
    uniqueDomains: new Set<string>(),
    inserted: 0,
    errors: [] as string[],
    byTech: {} as Record<string, number>,
  };

  const today = new Date().toISOString().split("T")[0];
  const allCompanies: CompanyUpsert[] = [];

  for (const [bwTechName, ourSlug] of techsToFetch) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Fetching: ${bwTechName} → ${ourSlug}`);

    const result = await fetchTechList(bwTechName, sinceDays);

    if (!result.success) {
      const errMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      console.log(`  ✗ Error: ${errMsg}`);
      stats.errors.push(`${bwTechName}: ${errMsg}`);

      // Rate limiting between calls even on error
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS));
      continue;
    }

    const domains = extractDomains(result.data!);
    console.log(`  ✓ Found ${domains.length} domains`);

    if (domains.length === 0) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS));
      continue;
    }

    // Limit in test mode
    const domainsToProcess = testMode ? domains.slice(0, 10) : domains;

    // Prepare company records
    for (const domain of domainsToProcess) {
      // Only add if not already seen (avoid duplicates across tech variants)
      if (!stats.uniqueDomains.has(domain)) {
        stats.uniqueDomains.add(domain);
        allCompanies.push({
          domain,
          search_tech: ourSlug,
          source: "builtwith",
          source_date: today,
        });
      }
    }

    stats.byTech[ourSlug] = (stats.byTech[ourSlug] || 0) + domainsToProcess.length;
    stats.totalDomains += domainsToProcess.length;

    // Rate limiting between API calls
    console.log(`  (waiting ${DELAY_BETWEEN_CALLS / 1000}s...)`);
    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS));
  }

  // Upsert all companies at once
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Upserting ${allCompanies.length} unique companies...`);

  const { inserted, errors } = await upsertCompanies(allCompanies, dryRun);
  stats.inserted = inserted;
  if (errors.length > 0) {
    stats.errors.push(...errors);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total domains fetched: ${stats.totalDomains}`);
  console.log(`Unique domains: ${stats.uniqueDomains.size}`);
  console.log(`Inserted/updated: ${stats.inserted}`);

  console.log("\nBy search technology:");
  Object.entries(stats.byTech)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tech, count]) => {
      console.log(`  ${tech.padEnd(15)}: ${count}`);
    });

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
    if (stats.errors.length > 5) {
      console.log(`  ... and ${stats.errors.length - 5} more`);
    }
  }

  // Verification
  if (!dryRun) {
    console.log("\n" + "=".repeat(60));
    console.log("VERIFICATION");
    console.log("=".repeat(60));

    // Count DISPLACEMENT plays
    const { count: displacementCount } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("sales_play", "DISPLACEMENT");

    console.log(`DISPLACEMENT opportunities: ${displacementCount}`);

    // Count by search_tech - all possible values
    const searchTechs = [
      // From Lists API
      "Coveo", "Swiftype", "Doofinder", "Yext", "Cludo", "Searchanise", "AddSearch", "Sooqr",
      // From Domain API enrichment (future)
      "Elastic", "Solr", "Bloomreach", "SearchSpring", "Lucidworks", "Klevu", "Constructor"
    ];
    console.log("\nSearch tech distribution:");
    for (const tech of searchTechs) {
      const { count } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .eq("search_tech", tech);
      if (count && count > 0) {
        console.log(`  ${tech.padEnd(15)}: ${count}`);
      }
    }
  }
}

main().catch(console.error);
