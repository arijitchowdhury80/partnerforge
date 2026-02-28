/**
 * Fetch BuiltWith Tech Stack for Whale Composite Accounts
 *
 * Queries BuiltWith API for all 771 whale accounts and stores
 * the raw response in whale_composite.builtwith_technologies JSONB column.
 *
 * Usage:
 *   npx ts-node scripts/fetch-builtwith-techstack.ts
 *   npx ts-node scripts/fetch-builtwith-techstack.ts --limit 10  # Test with 10
 *   npx ts-node scripts/fetch-builtwith-techstack.ts --domain costco.com  # Single domain
 */

import { createClient } from "@supabase/supabase-js";

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const BATCH_SIZE = 10; // Process 10 domains at a time
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches (rate limiting)
const DELAY_BETWEEN_REQUESTS = 500; // 500ms between individual requests

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================================================
// TYPES
// =============================================================================

interface WhaleAccount {
  domain: string;
  account_name: string | null;
  builtwith_fetched_at: string | null;
}

interface BuiltWithTechnology {
  Name: string;
  Tag: string;
  FirstDetected?: number;
  LastDetected?: number;
}

interface BuiltWithResponse {
  Results?: Array<{
    // v21 API has nested Result object
    Result?: {
      Paths?: Array<{
        Technologies?: BuiltWithTechnology[];
      }>;
    };
    // Free API has Paths at top level
    Paths?: Array<{
      Technologies?: BuiltWithTechnology[];
    }>;
  }>;
  Errors?: string[];
}

// =============================================================================
// BUILTWITH API CALL (via Edge Function)
// =============================================================================

async function fetchBuiltWithTechStack(
  domain: string
): Promise<{ success: boolean; data?: BuiltWithResponse; error?: string }> {
  try {
    // Call via enrich-proxy Edge Function (v21 enterprise API)
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/enrich-proxy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "builtwith",
          // v21 is default (enterprise API with detailed tech names)
          domain: domain,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      };
    }

    const data = await response.json() as BuiltWithResponse;

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
// EXTRACT TECHNOLOGIES FROM BUILTWITH RESPONSE
// =============================================================================

function extractTechnologies(response: BuiltWithResponse): BuiltWithTechnology[] {
  const technologies: BuiltWithTechnology[] = [];

  if (response.Results) {
    for (const result of response.Results) {
      // v21 API: Technologies are in Result.Paths
      if (result.Result?.Paths) {
        for (const path of result.Result.Paths) {
          if (path.Technologies) {
            technologies.push(...path.Technologies);
          }
        }
      }
      // Free API: Technologies are directly in Paths
      else if (result.Paths) {
        for (const path of result.Paths) {
          if (path.Technologies) {
            technologies.push(...path.Technologies);
          }
        }
      }
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return technologies.filter((tech) => {
    if (seen.has(tech.Name)) return false;
    seen.add(tech.Name);
    return true;
  });
}

// =============================================================================
// UPDATE WHALE_COMPOSITE WITH TECH STACK
// =============================================================================

async function updateWhaleCompositeTechStack(
  domain: string,
  techStackData: BuiltWithResponse,
  technologies: BuiltWithTechnology[]
): Promise<boolean> {
  const { error } = await supabase
    .from("whale_composite")
    .update({
      builtwith_technologies: {
        raw_response: techStackData,
        technologies: technologies,
        tech_count: technologies.length,
        categories: [...new Set(technologies.map((t) => t.Tag))],
      },
      builtwith_fetched_at: new Date().toISOString(),
    })
    .eq("domain", domain);

  if (error) {
    console.error(`Failed to update ${domain}:`, error.message);
    return false;
  }

  return true;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("BUILTWITH TECH STACK FETCHER");
  console.log("=".repeat(60));

  // Parse command line args
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let singleDomain: string | null = null;
  let skipFetched = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === "--domain" && args[i + 1]) {
      singleDomain = args[i + 1];
    }
    if (args[i] === "--force") {
      skipFetched = false;
    }
  }

  // Fetch domains from whale_composite
  let query = supabase
    .from("whale_composite")
    .select("domain, account_name, builtwith_fetched_at")
    .order("domain");

  if (singleDomain) {
    query = query.eq("domain", singleDomain);
  } else if (skipFetched) {
    query = query.is("builtwith_fetched_at", null);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data: accounts, error: fetchError } = await query;

  if (fetchError) {
    console.error("Failed to fetch accounts:", fetchError.message);
    process.exit(1);
  }

  if (!accounts || accounts.length === 0) {
    console.log("\nNo accounts to process.");
    if (skipFetched) {
      console.log("(All accounts already have BuiltWith data. Use --force to re-fetch.)");
    }
    process.exit(0);
  }

  console.log(`\nAccounts to process: ${accounts.length}`);
  if (limit) console.log(`(Limited to ${limit})`);
  if (skipFetched) console.log("(Skipping already-fetched accounts)");

  // Process in batches
  let processed = 0;
  let successful = 0;
  let failed = 0;
  const errors: Array<{ domain: string; error: string }> = [];

  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(accounts.length / BATCH_SIZE)}`);

    for (const account of batch) {
      const domain = account.domain;
      process.stdout.write(`  ${domain}... `);

      // Fetch from BuiltWith
      const result = await fetchBuiltWithTechStack(domain);

      if (result.success && result.data) {
        // Extract technologies
        const technologies = extractTechnologies(result.data);

        // Update database
        const updated = await updateWhaleCompositeTechStack(
          domain,
          result.data,
          technologies
        );

        if (updated) {
          console.log(`✓ ${technologies.length} technologies`);
          successful++;
        } else {
          console.log("✗ DB update failed");
          failed++;
          errors.push({ domain, error: "Database update failed" });
        }
      } else {
        console.log(`✗ ${result.error}`);
        failed++;
        errors.push({ domain, error: result.error || "Unknown error" });
      }

      processed++;

      // Rate limiting between requests
      if (i + batch.indexOf(account) < accounts.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS));
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < accounts.length) {
      console.log(`  (waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...)`);
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Processed: ${processed}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (errors.length > 0) {
    console.log("\nFailed domains:");
    for (const err of errors.slice(0, 10)) {
      console.log(`  ${err.domain}: ${err.error}`);
    }
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more`);
    }
  }

  // Next steps
  console.log("\n" + "=".repeat(60));
  console.log("NEXT STEPS");
  console.log("=".repeat(60));
  console.log("1. Run migration: 20260227_tech_stack_schema.sql");
  console.log("2. Run normalization script to populate account_technologies");
  console.log("3. Compare Demandbase vs BuiltWith tech flags");
}

main().catch(console.error);
