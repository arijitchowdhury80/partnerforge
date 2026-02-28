/**
 * Fetch MarTech Galaxy Data from BuiltWith Lists API
 *
 * Fetches companies using partner MarTech technologies and upserts into companies table.
 *
 * Usage:
 *   npx ts-node scripts/fetch-martech-galaxy.ts                    # Fetch all MarTech
 *   npx ts-node scripts/fetch-martech-galaxy.ts --tech SFMC        # Fetch single tech
 *   npx ts-node scripts/fetch-martech-galaxy.ts --dry-run          # Preview without DB writes
 *   npx ts-node scripts/fetch-martech-galaxy.ts --since 30         # Last 30 days only
 */

import { createClient } from "@supabase/supabase-js";

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// MarTech Technology mappings
// Key = our slug (used in companies.martech_tech column)
// Value = BuiltWith technology name
// Note: SFMC is "ExactTarget" (old name before Salesforce acquisition)
// Note: HubSpot is "Hubspot" (lowercase 's') in BuiltWith
const MARTECH_TECHNOLOGIES: Record<string, string> = {
  SFMC: "ExactTarget",
  Marketo: "Marketo",
  HubSpot: "Hubspot",
  Klaviyo: "Klaviyo",
};

// =============================================================================
// TYPES
// =============================================================================

interface BuiltWithListResult {
  D?: string;      // Domain
  FI?: number;     // First Indexed (epoch)
  LI?: number;     // Last Indexed (epoch)
  FD?: number;     // First Detected (epoch)
  LD?: number;     // Last Detected (epoch)
  S?: number;      // Score/rank
  LOS?: string[];  // List of URLs
  // Note: Company name is NOT included in Lists API
}

interface BuiltWithListsResponse {
  Results?: BuiltWithListResult[];
  Errors?: string[];
  // Pagination info
  NextOffset?: string;
  Total?: number;
}

interface CompanyRecord {
  domain: string;
  company_name: string | null;
  martech_tech: string;
  source: string;
  source_date: string;
}

// =============================================================================
// API CALL VIA EDGE FUNCTION
// =============================================================================

async function fetchTechnologyList(
  techSlug: string,
  builtwithTechName: string,
  since: string = "90"
): Promise<{ success: boolean; data?: BuiltWithListsResponse; error?: string }> {
  try {
    console.log(`  Calling BuiltWith Lists API for: ${builtwithTechName}`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/enrich-proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "builtwith-lists",
        tech: builtwithTechName,
        since: since,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      };
    }

    const data = (await response.json()) as BuiltWithListsResponse;

    // Check for BuiltWith errors
    if (data.Errors && data.Errors.length > 0) {
      const errorMsg = data.Errors.map((e: any) =>
        typeof e === 'string' ? e : (e.Message || JSON.stringify(e))
      ).join(", ");
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// =============================================================================
// TRANSFORM & FILTER
// =============================================================================

function transformResults(
  results: BuiltWithListResult[],
  martechTechSlug: string
): CompanyRecord[] {
  const today = new Date().toISOString().split("T")[0];

  return results
    .filter((r) => r.D) // Must have domain
    .map((r) => ({
      domain: r.D!.toLowerCase().replace(/^www\./, ""),
      company_name: null, // Lists API doesn't include company name
      martech_tech: martechTechSlug,
      source: "builtwith-lists",
      source_date: today,
    }))
    .filter((r) => {
      // Exclude obviously invalid domains
      if (r.domain.length < 4) return false;
      if (!r.domain.includes(".")) return false;
      return true;
    });
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function upsertCompanies(companies: CompanyRecord[]): Promise<{
  inserted: number;
  updated: number;
  errors: number;
}> {
  const results = { inserted: 0, updated: 0, errors: 0 };

  // Process in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);

    const { error } = await supabase.from("companies").upsert(
      batch.map((c) => ({
        domain: c.domain,
        company_name: c.company_name,
        martech_tech: c.martech_tech,
        source: c.source,
        source_date: c.source_date,
      })),
      {
        onConflict: "domain",
        ignoreDuplicates: false, // Update existing records
      }
    );

    if (error) {
      console.error(`  Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      results.errors += batch.length;
    } else {
      results.inserted += batch.length;
    }
  }

  return results;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("MARTECH GALAXY DATA FETCHER");
  console.log("=".repeat(60));

  // Parse command line args
  const args = process.argv.slice(2);
  let targetTech: string | null = null;
  let dryRun = false;
  let since = "90"; // Default: last 90 days

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tech" && args[i + 1]) {
      targetTech = args[i + 1];
    }
    if (args[i] === "--dry-run") {
      dryRun = true;
    }
    if (args[i] === "--since" && args[i + 1]) {
      since = args[i + 1];
    }
  }

  // Determine which technologies to fetch
  const techsToFetch = targetTech
    ? { [targetTech]: MARTECH_TECHNOLOGIES[targetTech] }
    : MARTECH_TECHNOLOGIES;

  if (targetTech && !MARTECH_TECHNOLOGIES[targetTech]) {
    console.error(`Unknown tech: ${targetTech}`);
    console.log("Available: " + Object.keys(MARTECH_TECHNOLOGIES).join(", "));
    process.exit(1);
  }

  console.log(`\nSettings:`);
  console.log(`  Technologies: ${Object.keys(techsToFetch).join(", ")}`);
  console.log(`  Since: ${since} days`);
  console.log(`  Dry run: ${dryRun}`);

  // Summary trackers
  const summary: Record<string, { fetched: number; saved: number; error?: string }> = {};

  // Fetch each technology
  for (const [slug, builtwithName] of Object.entries(techsToFetch)) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`FETCHING: ${slug} (${builtwithName})`);
    console.log("=".repeat(60));

    const result = await fetchTechnologyList(slug, builtwithName, since);

    if (!result.success) {
      console.error(`  ERROR: ${result.error}`);
      summary[slug] = { fetched: 0, saved: 0, error: result.error };
      continue;
    }

    const rawResults = result.data?.Results || [];
    console.log(`  Raw results: ${rawResults.length}`);

    // Transform
    const companies = transformResults(rawResults, slug);
    console.log(`  After filtering: ${companies.length}`);

    // Sample domains
    if (companies.length > 0) {
      console.log(`  Sample domains: ${companies.slice(0, 5).map(c => c.domain).join(", ")}`);
    }

    summary[slug] = { fetched: companies.length, saved: 0 };

    // Save to database
    if (!dryRun && companies.length > 0) {
      console.log(`  Saving to database...`);
      const dbResult = await upsertCompanies(companies);
      console.log(`  Saved: ${dbResult.inserted}, Errors: ${dbResult.errors}`);
      summary[slug].saved = dbResult.inserted;
    }
  }

  // Final summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));

  let totalFetched = 0;
  let totalSaved = 0;

  for (const [tech, stats] of Object.entries(summary)) {
    const status = stats.error ? `ERROR: ${stats.error}` : `${stats.fetched} fetched, ${stats.saved} saved`;
    console.log(`  ${tech}: ${status}`);
    totalFetched += stats.fetched;
    totalSaved += stats.saved;
  }

  console.log(`\nTotal: ${totalFetched} fetched, ${totalSaved} saved`);

  if (dryRun) {
    console.log("\n[DRY RUN - no data was saved to database]");
  }

  // Verify database
  if (!dryRun) {
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true });

    console.log(`\nCompanies table now has: ${count} records`);

    // Show MarTech distribution
    console.log("\nMarTech distribution in database:");
    for (const tech of Object.keys(MARTECH_TECHNOLOGIES)) {
      const { count: techCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .eq("martech_tech", tech);
      console.log(`  ${tech}: ${techCount}`);
    }
  }
}

main().catch(console.error);
