/**
 * Normalize BuiltWith Tech Stack to account_technologies
 *
 * Extracts partner technologies from raw BuiltWith JSONB data
 * and populates the normalized account_technologies table.
 *
 * Usage:
 *   npx ts-node scripts/normalize-builtwith-tech.ts
 *   npx ts-node scripts/normalize-builtwith-tech.ts --limit 10  # Test with 10
 *   npx ts-node scripts/normalize-builtwith-tech.ts --domain costco.com
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================================================
// TYPES
// =============================================================================

interface Technology {
  id: number;
  name: string;
  slug: string;
  category: string;
  builtwith_name: string | null;
  is_partner_tech: boolean;
  partner_tier: string | null;
}

interface BuiltWithTech {
  Name: string;
  Tag: string;
  Categories?: string[];
  FirstDetected?: number;
  LastDetected?: number;
}

interface WhaleAccount {
  domain: string;
  builtwith_technologies: {
    technologies: BuiltWithTech[];
    tech_count: number;
  } | null;
}

// =============================================================================
// TECH MATCHING (fuzzy matching for BuiltWith names)
// =============================================================================

/**
 * Build a lookup map for matching BuiltWith technology names
 * Handles variations like "Shopify Plus" vs "Shopify"
 */
function buildTechLookup(technologies: Technology[]): Map<string, Technology> {
  const lookup = new Map<string, Technology>();

  for (const tech of technologies) {
    // Exact match on builtwith_name
    if (tech.builtwith_name) {
      lookup.set(tech.builtwith_name.toLowerCase(), tech);
    }
    // Also match on name
    lookup.set(tech.name.toLowerCase(), tech);
    // Also match on slug (useful for variations)
    lookup.set(tech.slug.toLowerCase(), tech);
  }

  return lookup;
}

/**
 * Match a BuiltWith technology to our technologies table
 */
function matchTechnology(
  bwTech: BuiltWithTech,
  lookup: Map<string, Technology>,
  technologies: Technology[]
): Technology | null {
  const name = bwTech.Name.toLowerCase();

  // 1. Exact match
  if (lookup.has(name)) {
    return lookup.get(name)!;
  }

  // 2. Partial match for composite names (e.g., "Salesforce Commerce Cloud B2C" → "Salesforce Commerce Cloud")
  for (const tech of technologies) {
    if (tech.builtwith_name) {
      const bwName = tech.builtwith_name.toLowerCase();
      if (name.includes(bwName) || bwName.includes(name)) {
        return tech;
      }
    }
  }

  // 3. Check categories for search competitors
  if (bwTech.Categories?.some((c) => c.toLowerCase().includes("search"))) {
    // Check if it's a known search tech
    const searchTerms = ["algolia", "elastic", "solr", "searchspring", "klevu", "constructor", "bloomreach", "coveo"];
    for (const term of searchTerms) {
      if (name.includes(term)) {
        return lookup.get(term) || null;
      }
    }
  }

  return null;
}

// =============================================================================
// MAIN NORMALIZATION
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("NORMALIZE BUILTWITH TECH STACK");
  console.log("=".repeat(60));

  // Parse command line args
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let singleDomain: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === "--domain" && args[i + 1]) {
      singleDomain = args[i + 1];
    }
  }

  // 1. Load technologies reference table
  console.log("\n1. Loading technologies reference table...");
  const { data: technologies, error: techError } = await supabase
    .from("technologies")
    .select("*")
    .eq("is_active", true);

  if (techError || !technologies) {
    console.error("Failed to load technologies:", techError?.message);
    process.exit(1);
  }

  console.log(`   Loaded ${technologies.length} technologies`);
  const techLookup = buildTechLookup(technologies as Technology[]);

  // 2. Fetch whale accounts with BuiltWith data (paginated to avoid timeout)
  console.log("\n2. Fetching whale accounts with BuiltWith data...");

  const BATCH_SIZE = 50;
  const accounts: WhaleAccount[] = [];
  let offset = 0;
  let hasMore = true;

  if (singleDomain) {
    // Single domain query
    const { data, error } = await supabase
      .from("whale_composite")
      .select("domain, builtwith_technologies")
      .eq("domain", singleDomain)
      .single();

    if (error) {
      console.error("Failed to fetch account:", error.message);
      process.exit(1);
    }
    if (data) accounts.push(data as WhaleAccount);
  } else {
    // Paginated fetch
    while (hasMore) {
      const maxRecords = limit ? Math.min(BATCH_SIZE, limit - accounts.length) : BATCH_SIZE;

      const { data, error } = await supabase
        .from("whale_composite")
        .select("domain, builtwith_technologies")
        .not("builtwith_technologies", "is", null)
        .order("domain")
        .range(offset, offset + maxRecords - 1);

      if (error) {
        console.error("Failed to fetch accounts:", error.message);
        process.exit(1);
      }

      if (data && data.length > 0) {
        accounts.push(...(data as WhaleAccount[]));
        offset += data.length;
        process.stdout.write(`\r   Fetched ${accounts.length} accounts...`);

        // Check if we've hit the limit or no more records
        if (data.length < maxRecords || (limit && accounts.length >= limit)) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
  }

  console.log(`\n   Found ${accounts.length} accounts with BuiltWith data`);

  // 3. Process each account
  console.log("\n3. Processing accounts...");
  let totalMatched = 0;
  let totalInserted = 0;
  const partnerCounts: Record<string, number> = {};
  const searchCounts: Record<string, number> = {};

  for (const account of accounts as WhaleAccount[]) {
    const domain = account.domain;
    const bwTechs = account.builtwith_technologies?.technologies || [];

    if (bwTechs.length === 0) continue;

    const matched: Array<{ tech: Technology; bwTech: BuiltWithTech }> = [];

    // Match each BuiltWith technology
    for (const bwTech of bwTechs) {
      const match = matchTechnology(bwTech, techLookup, technologies as Technology[]);
      if (match) {
        matched.push({ tech: match, bwTech });

        // Count partner techs
        if (match.is_partner_tech) {
          partnerCounts[match.name] = (partnerCounts[match.name] || 0) + 1;
        }

        // Count search techs
        if (match.category === "Search") {
          searchCounts[match.name] = (searchCounts[match.name] || 0) + 1;
        }
      }
    }

    if (matched.length > 0) {
      totalMatched += matched.length;

      // Deduplicate by technology_id (multiple BuiltWith techs may map to same normalized tech)
      const seenTechIds = new Set<number>();
      const dedupedMatched = matched.filter(({ tech }) => {
        if (seenTechIds.has(tech.id)) return false;
        seenTechIds.add(tech.id);
        return true;
      });

      // Insert into account_technologies (upsert)
      const inserts = dedupedMatched.map(({ tech, bwTech }) => ({
        domain,
        technology_id: tech.id,
        source: "builtwith",
        confidence: 90, // High confidence from BuiltWith
        first_detected_at: bwTech.FirstDetected
          ? new Date(bwTech.FirstDetected).toISOString()
          : new Date().toISOString(),
        last_confirmed_at: bwTech.LastDetected
          ? new Date(bwTech.LastDetected).toISOString()
          : new Date().toISOString(),
        is_active: true,
      }));

      const { error: insertError, data: inserted } = await supabase
        .from("account_technologies")
        .upsert(inserts, { onConflict: "domain,technology_id,source" })
        .select();

      if (insertError) {
        console.log(`   ✗ ${domain}: ${insertError.message}`);
      } else {
        totalInserted += inserted?.length || 0;
        process.stdout.write(`   ✓ ${domain}: ${matched.length} techs matched\n`);
      }
    }
  }

  // 4. Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Accounts processed: ${accounts.length}`);
  console.log(`Technologies matched: ${totalMatched}`);
  console.log(`Records inserted/updated: ${totalInserted}`);

  // Partner tech distribution
  console.log("\n--- PARTNER TECH DISTRIBUTION ---");
  const sortedPartners = Object.entries(partnerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  for (const [name, count] of sortedPartners) {
    console.log(`   ${name}: ${count}`);
  }

  // Search tech distribution (competitors + Algolia customers)
  console.log("\n--- SEARCH TECH DISTRIBUTION ---");
  const sortedSearch = Object.entries(searchCounts).sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sortedSearch) {
    console.log(`   ${name}: ${count}`);
  }

  // 5. Next steps
  console.log("\n" + "=".repeat(60));
  console.log("NEXT STEPS");
  console.log("=".repeat(60));
  console.log("1. Run cohort classification script");
  console.log("2. Compare Demandbase flags vs BuiltWith detections");
  console.log("3. Generate ABM target lists by cohort");
}

main().catch(console.error);
