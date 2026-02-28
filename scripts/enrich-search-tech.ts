/**
 * Enrich Search Tech for CMS Companies
 *
 * Uses BuiltWith Domain API to look up full tech stack for CMS companies,
 * then extracts and updates search_tech column.
 *
 * Usage:
 *   npx ts-node scripts/enrich-search-tech.ts                    # All CMS companies
 *   npx ts-node scripts/enrich-search-tech.ts --limit 10         # Test with 10
 *   npx ts-node scripts/enrich-search-tech.ts --dry-run          # Preview only
 *   npx ts-node scripts/enrich-search-tech.ts --force            # Re-fetch already enriched
 */

import { createClient } from "@supabase/supabase-js";

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BATCH_SIZE = 10;
const DELAY_BETWEEN_REQUESTS = 600; // 600ms between requests (rate limiting)
const DELAY_BETWEEN_BATCHES = 3000; // 3s between batches

// Search technology mappings
// Key = our slug (used in companies.search_tech column)
// Values = BuiltWith technology names that map to this slug
const SEARCH_TECH_MAPPINGS: Record<string, string[]> = {
  Elastic: ["Elasticsearch", "Elastic Search", "Elastic Site Search", "Elastic App Search"],
  Solr: ["Apache Solr", "Solr", "Solr Search"],
  Coveo: ["Coveo", "Coveo Cloud", "Coveo for Sitecore"],
  Bloomreach: ["Bloomreach", "Bloomreach Search", "Bloomreach Discovery", "brSM"],
  SearchSpring: ["SearchSpring", "Search Spring"],
  Lucidworks: ["Lucidworks", "Lucidworks Fusion"],
  Klevu: ["Klevu", "Klevu Search"],
  Constructor: ["Constructor", "Constructor.io", "Constructor IO"],
  // Note: Algolia is excluded - we want to find non-Algolia companies
};

// Technologies to EXCLUDE (Algolia customers)
const ALGOLIA_TECH_NAMES = ["Algolia", "Algolia Search", "Algolia Recommend"];

// =============================================================================
// TYPES
// =============================================================================

interface BuiltWithTechnology {
  Name: string;
  Tag: string;
  FirstDetected?: number;
  LastDetected?: number;
}

interface BuiltWithResponse {
  Results?: Array<{
    Result?: {
      Paths?: Array<{
        Technologies?: BuiltWithTechnology[];
      }>;
    };
    Paths?: Array<{
      Technologies?: BuiltWithTechnology[];
    }>;
  }>;
  Errors?: Array<{ Message?: string; Code?: number } | string>;
}

// =============================================================================
// BUILTWITH DOMAIN API CALL
// =============================================================================

async function fetchDomainTechStack(
  domain: string
): Promise<{ success: boolean; technologies?: BuiltWithTechnology[]; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/enrich-proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "builtwith",
        domain: domain,
        endpoint: "v21", // Use detailed API
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
      };
    }

    const data = (await response.json()) as BuiltWithResponse;

    // Check for errors
    if (data.Errors && data.Errors.length > 0) {
      const errorMsg = data.Errors.map((e) =>
        typeof e === "string" ? e : e.Message || JSON.stringify(e)
      ).join(", ");
      return { success: false, error: errorMsg };
    }

    // Extract technologies
    const technologies: BuiltWithTechnology[] = [];
    if (data.Results) {
      for (const result of data.Results) {
        const paths = result.Result?.Paths || result.Paths || [];
        for (const path of paths) {
          if (path.Technologies) {
            technologies.push(...path.Technologies);
          }
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const uniqueTech = technologies.filter((t) => {
      if (seen.has(t.Name)) return false;
      seen.add(t.Name);
      return true;
    });

    return { success: true, technologies: uniqueTech };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// =============================================================================
// DETECT SEARCH TECH FROM TECH STACK
// =============================================================================

function detectSearchTech(technologies: BuiltWithTechnology[]): {
  searchTech: string | null;
  isAlgoliaCustomer: boolean;
  allSearchTech: string[];
} {
  const techNames = technologies.map((t) => t.Name.toLowerCase());
  const allSearchTech: string[] = [];
  let searchTech: string | null = null;
  let isAlgoliaCustomer = false;

  // Check for Algolia first
  for (const algoliaName of ALGOLIA_TECH_NAMES) {
    if (techNames.includes(algoliaName.toLowerCase())) {
      isAlgoliaCustomer = true;
    }
  }

  // Find search competitors
  for (const [slug, names] of Object.entries(SEARCH_TECH_MAPPINGS)) {
    for (const name of names) {
      if (techNames.includes(name.toLowerCase())) {
        allSearchTech.push(slug);
        if (!searchTech) {
          searchTech = slug; // Take the first match
        }
        break;
      }
    }
  }

  return { searchTech, isAlgoliaCustomer, allSearchTech };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("SEARCH TECH ENRICHMENT");
  console.log("=".repeat(60));

  // Parse args
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === "--dry-run") {
      dryRun = true;
    }
    if (args[i] === "--force") {
      force = true;
    }
  }

  console.log(`\nSettings:`);
  console.log(`  Limit: ${limit || "all"}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  Force re-fetch: ${force}`);

  // Get CMS companies that need search_tech enrichment
  let query = supabase
    .from("companies")
    .select("domain, cms_tech, search_tech")
    .not("cms_tech", "is", null)
    .order("domain");

  if (!force) {
    // Only get companies without search_tech
    query = query.is("search_tech", null);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data: companies, error: fetchError } = await query;

  if (fetchError) {
    console.error("Failed to fetch companies:", fetchError.message);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.log("\nNo companies to process.");
    process.exit(0);
  }

  console.log(`\nCompanies to process: ${companies.length}`);

  // Stats
  let processed = 0;
  let enriched = 0;
  let errors = 0;
  let algoliaCustomers = 0;
  let noSearchTech = 0;
  const searchTechCounts: Record<string, number> = {};

  // Process in batches
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(companies.length / BATCH_SIZE);

    console.log(`\nBatch ${batchNum}/${totalBatches}`);

    for (const company of batch) {
      process.stdout.write(`  ${company.domain}... `);

      // Fetch tech stack
      const result = await fetchDomainTechStack(company.domain);

      if (!result.success) {
        console.log(`ERROR: ${result.error}`);
        errors++;
        processed++;
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS));
        continue;
      }

      // Detect search tech
      const { searchTech, isAlgoliaCustomer, allSearchTech } = detectSearchTech(
        result.technologies || []
      );

      if (isAlgoliaCustomer) {
        console.log(`ALGOLIA CUSTOMER (skip)`);
        algoliaCustomers++;
        // Optionally delete from companies table since they're customers
        if (!dryRun) {
          await supabase.from("companies").delete().eq("domain", company.domain);
        }
      } else if (searchTech) {
        console.log(`${searchTech} (${allSearchTech.join(", ")})`);
        searchTechCounts[searchTech] = (searchTechCounts[searchTech] || 0) + 1;
        enriched++;

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("companies")
            .update({ search_tech: searchTech })
            .eq("domain", company.domain);

          if (updateError) {
            console.log(`  -> DB ERROR: ${updateError.message}`);
          }
        }
      } else {
        console.log(`no search competitor`);
        noSearchTech++;
      }

      processed++;
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS));
    }

    // Delay between batches
    if (i + BATCH_SIZE < companies.length) {
      console.log(`  (waiting ${DELAY_BETWEEN_BATCHES / 1000}s...)`);
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Processed: ${processed}`);
  console.log(`Enriched with search_tech: ${enriched}`);
  console.log(`No search competitor: ${noSearchTech}`);
  console.log(`Algolia customers (removed): ${algoliaCustomers}`);
  console.log(`Errors: ${errors}`);

  if (Object.keys(searchTechCounts).length > 0) {
    console.log("\nSearch Tech Distribution:");
    for (const [tech, count] of Object.entries(searchTechCounts).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  ${tech}: ${count}`);
    }
  }

  if (dryRun) {
    console.log("\n[DRY RUN - no data was saved]");
  }

  // Verify
  if (!dryRun) {
    const { count: displacement } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("sales_play", "DISPLACEMENT");

    const { count: greenfield } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("sales_play", "GREENFIELD");

    console.log("\nSales Play Distribution:");
    console.log(`  DISPLACEMENT: ${displacement}`);
    console.log(`  GREENFIELD: ${greenfield}`);
  }
}

main().catch(console.error);
