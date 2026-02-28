/**
 * Fetch Commerce Galaxy Data from BuiltWith Lists API
 *
 * Fetches companies using Commerce technologies and inserts into the `companies` table.
 *
 * Usage:
 *   npx ts-node scripts/fetch-commerce-galaxy.ts
 *   npx ts-node scripts/fetch-commerce-galaxy.ts --tech SFCC          # Single tech
 *   npx ts-node scripts/fetch-commerce-galaxy.ts --test               # Test mode (1 tech, limit 10)
 */

import { createClient } from "@supabase/supabase-js";

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Commerce Technologies - BuiltWith tech names mapped to our slugs
const COMMERCE_TECHS: Record<string, string> = {
  "Salesforce-Commerce-Cloud": "SFCC",
  "Shopify-Plus": "Shopify+",
  "Magento": "Magento",
  "Adobe-Commerce": "Magento",  // Adobe Commerce = Magento rebrand
  "BigCommerce": "BigCommerce",
  "commercetools": "Commercetools",
  "Spryker": "Spryker",
};

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

interface CompanyInsert {
  domain: string;
  company_name: string | null;
  commerce_tech: string;
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

    const data = (await response.json()) as BuiltWithListsResponse;

    // Check for BuiltWith errors
    if (data.Errors && data.Errors.length > 0) {
      return { success: false, error: data.Errors.join(", ") };
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
// UPSERT COMPANIES
// =============================================================================

async function upsertCompanies(
  companies: CompanyInsert[]
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  // Batch insert in chunks of 100
  const BATCH_SIZE = 100;

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);

    const { error } = await supabase.from("companies").upsert(
      batch,
      {
        onConflict: "domain",
        ignoreDuplicates: false, // Update if exists
      }
    );

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, errors };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("COMMERCE GALAXY FETCHER");
  console.log("=".repeat(60));

  // Parse args
  const args = process.argv.slice(2);
  let singleTech: string | null = null;
  let testMode = false;
  let sinceDays = "90";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tech" && args[i + 1]) {
      singleTech = args[i + 1];
    }
    if (args[i] === "--test") {
      testMode = true;
    }
    if (args[i] === "--since" && args[i + 1]) {
      sinceDays = args[i + 1];
    }
  }

  // Determine which techs to fetch
  let techsToFetch: Array<[string, string]>;

  if (singleTech) {
    // Find matching tech
    const match = Object.entries(COMMERCE_TECHS).find(
      ([bwName, slug]) => slug === singleTech || bwName === singleTech
    );
    if (!match) {
      console.error(`Unknown tech: ${singleTech}`);
      console.log("Available:", Object.values(COMMERCE_TECHS).join(", "));
      process.exit(1);
    }
    techsToFetch = [match];
  } else if (testMode) {
    // Test with just SFCC
    techsToFetch = [["Salesforce-Commerce-Cloud", "SFCC"]];
  } else {
    techsToFetch = Object.entries(COMMERCE_TECHS);
  }

  console.log(`\nFetching ${techsToFetch.length} technology(s)...`);
  console.log(`Since: ${sinceDays} days ago`);
  if (testMode) console.log("TEST MODE - limited results");

  const stats = {
    totalDomains: 0,
    uniqueDomains: new Set<string>(),
    inserted: 0,
    errors: [] as string[],
  };

  const today = new Date().toISOString().split("T")[0];

  for (const [bwTechName, ourSlug] of techsToFetch) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Fetching: ${bwTechName} → ${ourSlug}`);

    const result = await fetchTechList(bwTechName, sinceDays);

    if (!result.success) {
      console.log(`  ✗ Error: ${result.error}`);
      stats.errors.push(`${ourSlug}: ${result.error}`);
      continue;
    }

    const domains = extractDomains(result.data!);
    console.log(`  ✓ Found ${domains.length} domains`);

    if (domains.length === 0) {
      continue;
    }

    // Limit in test mode
    const domainsToInsert = testMode ? domains.slice(0, 10) : domains;

    // Prepare company records
    const companies: CompanyInsert[] = domainsToInsert.map((domain) => ({
      domain,
      company_name: null, // Will be enriched later
      commerce_tech: ourSlug,
      source: "builtwith",
      source_date: today,
    }));

    // Track unique domains
    domainsToInsert.forEach((d) => stats.uniqueDomains.add(d));
    stats.totalDomains += domainsToInsert.length;

    // Upsert to database
    console.log(`  Inserting ${companies.length} companies...`);
    const { inserted, errors } = await upsertCompanies(companies);

    if (errors.length > 0) {
      console.log(`  ⚠ ${errors.length} batch errors`);
      stats.errors.push(...errors);
    } else {
      console.log(`  ✓ Inserted/updated: ${inserted}`);
      stats.inserted += inserted;
    }

    // Rate limiting
    if (techsToFetch.indexOf([bwTechName, ourSlug]) < techsToFetch.length - 1) {
      console.log(`  (waiting ${DELAY_BETWEEN_CALLS / 1000}s...)`);
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total domains fetched: ${stats.totalDomains}`);
  console.log(`Unique domains: ${stats.uniqueDomains.size}`);
  console.log(`Inserted/updated: ${stats.inserted}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
    if (stats.errors.length > 5) {
      console.log(`  ... and ${stats.errors.length - 5} more`);
    }
  }

  // Verification
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION");
  console.log("=".repeat(60));

  const { data: summary, error: summaryError } = await supabase
    .from("companies")
    .select("commerce_tech")
    .not("commerce_tech", "is", null);

  if (summaryError) {
    console.log("Could not verify:", summaryError.message);
  } else if (summary) {
    const counts: Record<string, number> = {};
    summary.forEach((r) => {
      const tech = r.commerce_tech as string;
      counts[tech] = (counts[tech] || 0) + 1;
    });
    console.log("Commerce tech distribution:");
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tech, count]) => {
        console.log(`  ${tech}: ${count}`);
      });
  }
}

main().catch(console.error);
