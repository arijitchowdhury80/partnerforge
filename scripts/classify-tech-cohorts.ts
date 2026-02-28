/**
 * Classify Whale Accounts into Partner Tech Cohorts
 *
 * Based on Layer 1 of the Sales Machinery:
 *   CMS + Commerce + Hyperscaler = JACKPOT (100)
 *   CMS + Commerce + Marketing   = JACKPOT (95)
 *   CMS + Commerce               = HIGH (85)
 *   Commerce Only                = STANDARD (60)
 *   CMS Only                     = STANDARD (50)
 *
 * Usage:
 *   npx ts-node scripts/classify-tech-cohorts.ts
 *   npx ts-node scripts/classify-tech-cohorts.ts --limit 10
 *   npx ts-node scripts/classify-tech-cohorts.ts --dry-run
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
// COHORT DEFINITIONS (Layer 1 of Sales Machinery)
// =============================================================================

interface CohortResult {
  cohort: string;
  cohortScore: number;
  hasCMS: boolean;
  hasCommerce: boolean;
  hasHyperscaler: boolean;
  hasMarketing: boolean;
  hasSearch: boolean;
  searchProvider: string | null;
  cmsProviders: string[];
  commerceProviders: string[];
  hyperscalerProviders: string[];
}

const COHORTS = {
  JACKPOT_HYPER: { name: "CMS + Commerce + Hyperscaler", score: 100 },
  JACKPOT_MKTG: { name: "CMS + Commerce + Marketing", score: 95 },
  HIGH_CMS_COMMERCE: { name: "CMS + Commerce", score: 85 },
  STANDARD_COMMERCE: { name: "Commerce Only", score: 60 },
  STANDARD_CMS: { name: "CMS Only", score: 50 },
  NO_PARTNER: { name: "No Partner Tech", score: 0 },
};

// =============================================================================
// TECH STACK ANALYSIS
// =============================================================================

interface TechWithCategory {
  technology_id: number;
  technologies: {
    name: string;
    category: string;
    is_partner_tech: boolean;
    vendor: string;
  };
}

function classifyAccount(techs: TechWithCategory[]): CohortResult {
  // Group by category
  const cms: string[] = [];
  const commerce: string[] = [];
  const hyperscaler: string[] = [];
  const marketing: string[] = [];
  let searchProvider: string | null = null;

  for (const t of techs) {
    const tech = t.technologies;
    if (!tech) continue;

    switch (tech.category) {
      case "CMS":
        if (tech.is_partner_tech) cms.push(tech.name);
        break;
      case "Commerce":
        if (tech.is_partner_tech) commerce.push(tech.name);
        break;
      case "Hyperscaler":
        if (tech.is_partner_tech) hyperscaler.push(tech.name);
        break;
      case "Marketing":
        marketing.push(tech.name);
        break;
      case "Search":
        // Track search provider for displacement analysis
        searchProvider = tech.name;
        break;
    }
  }

  const hasCMS = cms.length > 0;
  const hasCommerce = commerce.length > 0;
  const hasHyperscaler = hyperscaler.length > 0;
  const hasMarketing = marketing.length > 0;
  const hasSearch = searchProvider !== null;

  // Determine cohort
  let cohort: string;
  let cohortScore: number;

  if (hasCMS && hasCommerce && hasHyperscaler) {
    cohort = COHORTS.JACKPOT_HYPER.name;
    cohortScore = COHORTS.JACKPOT_HYPER.score;
  } else if (hasCMS && hasCommerce && hasMarketing) {
    cohort = COHORTS.JACKPOT_MKTG.name;
    cohortScore = COHORTS.JACKPOT_MKTG.score;
  } else if (hasCMS && hasCommerce) {
    cohort = COHORTS.HIGH_CMS_COMMERCE.name;
    cohortScore = COHORTS.HIGH_CMS_COMMERCE.score;
  } else if (hasCommerce) {
    cohort = COHORTS.STANDARD_COMMERCE.name;
    cohortScore = COHORTS.STANDARD_COMMERCE.score;
  } else if (hasCMS) {
    cohort = COHORTS.STANDARD_CMS.name;
    cohortScore = COHORTS.STANDARD_CMS.score;
  } else {
    cohort = COHORTS.NO_PARTNER.name;
    cohortScore = COHORTS.NO_PARTNER.score;
  }

  return {
    cohort,
    cohortScore,
    hasCMS,
    hasCommerce,
    hasHyperscaler,
    hasMarketing,
    hasSearch,
    searchProvider,
    cmsProviders: cms,
    commerceProviders: commerce,
    hyperscalerProviders: hyperscaler,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("CLASSIFY PARTNER TECH COHORTS");
  console.log("=".repeat(60));

  // Parse args
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (dryRun) console.log("(DRY RUN - no database updates)");

  // 1. Get all accounts with tech data
  console.log("\n1. Fetching accounts with technology data...");

  let accountQuery = supabase
    .from("whale_composite")
    .select("domain, account_name")
    .not("builtwith_technologies", "is", null)
    .order("domain");

  if (limit) {
    accountQuery = accountQuery.limit(limit);
  }

  const { data: accounts, error: accountError } = await accountQuery;

  if (accountError || !accounts) {
    console.error("Failed to fetch accounts:", accountError?.message);
    process.exit(1);
  }

  console.log(`   Found ${accounts.length} accounts`);

  // 2. Process each account
  console.log("\n2. Classifying accounts...");

  const cohortStats: Record<string, number> = {};
  const searchStats: Record<string, number> = {};
  const jackpotAccounts: Array<{
    domain: string;
    result: CohortResult;
  }> = [];

  for (const account of accounts) {
    // Get technologies for this account
    const { data: techs, error: techError } = await supabase
      .from("account_technologies")
      .select(`
        technology_id,
        technologies (
          name,
          category,
          is_partner_tech,
          vendor
        )
      `)
      .eq("domain", account.domain)
      .eq("source", "builtwith");

    if (techError) {
      console.log(`   ✗ ${account.domain}: ${techError.message}`);
      continue;
    }

    if (!techs || techs.length === 0) {
      // No partner tech detected
      cohortStats[COHORTS.NO_PARTNER.name] =
        (cohortStats[COHORTS.NO_PARTNER.name] || 0) + 1;
      continue;
    }

    // Classify (cast via unknown to handle Supabase's typing)
    const result = classifyAccount(techs as unknown as TechWithCategory[]);

    // Update stats
    cohortStats[result.cohort] = (cohortStats[result.cohort] || 0) + 1;

    if (result.searchProvider) {
      searchStats[result.searchProvider] =
        (searchStats[result.searchProvider] || 0) + 1;
    }

    // Track JACKPOT accounts
    if (result.cohortScore >= 95) {
      jackpotAccounts.push({ domain: account.domain, result });
    }

    // Update whale_composite with cohort (if not dry run)
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("whale_composite")
        .update({
          tech_cohort: result.cohort,
          tech_cohort_score: result.cohortScore,
          has_partner_cms: result.hasCMS,
          has_partner_commerce: result.hasCommerce,
          has_partner_hyperscaler: result.hasHyperscaler,
          current_search_provider: result.searchProvider,
        })
        .eq("domain", account.domain);

      if (updateError) {
        console.log(`   ✗ ${account.domain}: Update failed - ${updateError.message}`);
      }
    }
  }

  // 3. Summary
  console.log("\n" + "=".repeat(60));
  console.log("COHORT DISTRIBUTION");
  console.log("=".repeat(60));

  const sortedCohorts = Object.entries(cohortStats).sort((a, b) => b[1] - a[1]);
  for (const [cohort, count] of sortedCohorts) {
    const pct = ((count / accounts.length) * 100).toFixed(1);
    console.log(`   ${cohort}: ${count} (${pct}%)`);
  }

  // Search provider distribution
  console.log("\n" + "=".repeat(60));
  console.log("SEARCH PROVIDER DISTRIBUTION (Displacement Opportunities)");
  console.log("=".repeat(60));

  const sortedSearch = Object.entries(searchStats).sort((a, b) => b[1] - a[1]);
  for (const [provider, count] of sortedSearch) {
    const isCompetitor = provider !== "Algolia";
    const label = isCompetitor ? `[DISPLACE] ${provider}` : `[CUSTOMER] ${provider}`;
    console.log(`   ${label}: ${count}`);
  }

  // JACKPOT accounts
  if (jackpotAccounts.length > 0) {
    console.log("\n" + "=".repeat(60));
    console.log(`JACKPOT ACCOUNTS (${jackpotAccounts.length})`);
    console.log("=".repeat(60));

    for (const { domain, result } of jackpotAccounts.slice(0, 20)) {
      const cms = result.cmsProviders.join(", ") || "—";
      const commerce = result.commerceProviders.join(", ") || "—";
      const hyper = result.hyperscalerProviders.join(", ") || "—";
      const search = result.searchProvider || "NO SEARCH";

      console.log(`\n   ${domain}`);
      console.log(`      CMS: ${cms}`);
      console.log(`      Commerce: ${commerce}`);
      console.log(`      Hyperscaler: ${hyper}`);
      console.log(`      Search: ${search}`);
    }

    if (jackpotAccounts.length > 20) {
      console.log(`\n   ... and ${jackpotAccounts.length - 20} more JACKPOT accounts`);
    }
  }

  // Next steps
  console.log("\n" + "=".repeat(60));
  console.log("NEXT STEPS");
  console.log("=".repeat(60));
  console.log("1. Apply ICP filter (Layer 2) to narrow to Fashion/Grocery");
  console.log("2. Cross-reference with S1/S2/S3 plays (Layer 3)");
  console.log("3. Generate ABM campaign lists (Layer 4)");
}

main().catch(console.error);
