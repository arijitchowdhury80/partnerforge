/**
 * Whale Composite - ICP Companies by Vertical
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

// ICP Industries (from your ICP definition)
const ICP_INDUSTRIES = [
  "Retail",
  "Consumer Goods",
  "Food & Beverages",
  "Apparel & Fashion",
  "Food Production",
  "Supermarkets",
  "Luxury Goods & Jewelry",
  "Cosmetics",
  "Sporting Goods",
  "Furniture",
  "Wholesale",
];

function bar(pct: number, maxWidth = 30): string {
  const filled = Math.round((pct / 100) * maxWidth);
  return "█".repeat(filled) + "░".repeat(maxWidth - filled);
}

async function main() {
  // Get whale_composite data
  const { data: whaleList, error } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry, traffic, tech_cohort, current_search_provider")
    .order("traffic", { ascending: false, nullsFirst: false });

  if (error || !whaleList) {
    console.log("Error:", error?.message);
    return;
  }

  // Filter to ICP companies
  const icpCompanies = whaleList.filter((c) =>
    ICP_INDUSTRIES.some(
      (icp) =>
        c.industry?.toLowerCase().includes(icp.toLowerCase()) ||
        icp.toLowerCase().includes(c.industry?.toLowerCase() || "")
    )
  );

  const total = whaleList.length;
  const icpTotal = icpCompanies.length;

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log(`║         WHALE_COMPOSITE - ICP COMPANIES BY VERTICAL (${icpTotal}/${total})                ║`);
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");

  // Group by industry
  const byIndustry: Record<string, typeof icpCompanies> = {};
  for (const c of icpCompanies) {
    const ind = c.industry || "Unknown";
    if (!byIndustry[ind]) byIndustry[ind] = [];
    byIndustry[ind].push(c);
  }

  // Sort industries by count
  const sortedIndustries = Object.entries(byIndustry).sort((a, b) => b[1].length - a[1].length);

  console.log("║                                                                              ║");
  console.log("║  VERTICAL DISTRIBUTION                                                       ║");
  console.log("║  ─────────────────────                                                       ║");
  console.log("║                                                                              ║");

  for (const [industry, companies] of sortedIndustries) {
    const pct = (companies.length / icpTotal) * 100;
    const indName = industry.substring(0, 22).padEnd(22);
    console.log(`║   ${indName} ${bar(pct)} ${pct.toFixed(1).padStart(5)}%  (${String(companies.length).padStart(3)})  ║`);
  }

  console.log("║                                                                              ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");

  // Now list companies by vertical
  console.log("\n\n");

  for (const [industry, companies] of sortedIndustries) {
    const pct = (companies.length / icpTotal) * 100;

    console.log("═".repeat(80));
    console.log(`${industry.toUpperCase()} (${companies.length} companies, ${pct.toFixed(1)}% of ICP)`);
    console.log("═".repeat(80));
    console.log("");
    console.log("Domain".padEnd(35) + "Company".padEnd(30) + "Traffic".padStart(10) + "  Cohort");
    console.log("-".repeat(80));

    for (const c of companies) {
      const traffic = c.traffic
        ? (c.traffic / 1e6).toFixed(1) + "M"
        : "N/A";
      const cohort = c.tech_cohort?.replace("CMS + Commerce + Hyperscaler", "JACKPOT") || "-";
      const search = c.current_search_provider || "";
      const searchIndicator = search === "Algolia" ? " ✓" : search ? ` [${search}]` : "";

      console.log(
        `${c.domain.substring(0, 34).padEnd(35)}${(c.account_name || "").substring(0, 29).padEnd(30)}${traffic.padStart(10)}  ${cohort}${searchIndicator}`
      );
    }
    console.log("\n");
  }

  // Summary stats
  console.log("═".repeat(80));
  console.log("SUMMARY");
  console.log("═".repeat(80));
  console.log("");

  // Count by cohort within ICP
  const cohortCounts: Record<string, number> = {};
  const searchCounts: Record<string, number> = {};

  for (const c of icpCompanies) {
    const cohort = c.tech_cohort || "Not Classified";
    cohortCounts[cohort] = (cohortCounts[cohort] || 0) + 1;

    if (c.current_search_provider) {
      searchCounts[c.current_search_provider] = (searchCounts[c.current_search_provider] || 0) + 1;
    }
  }

  console.log("COHORT DISTRIBUTION (within ICP):");
  for (const [cohort, count] of Object.entries(cohortCounts).sort((a, b) => b[1] - a[1])) {
    const pct = (count / icpTotal) * 100;
    console.log(`  ${cohort.padEnd(35)} ${count} (${pct.toFixed(1)}%)`);
  }

  console.log("\nSEARCH PROVIDER DISTRIBUTION (within ICP):");
  for (const [provider, count] of Object.entries(searchCounts).sort((a, b) => b[1] - a[1])) {
    const isCustomer = provider === "Algolia";
    const label = isCustomer ? `✓ ${provider} (CUSTOMER)` : `→ ${provider} (DISPLACE)`;
    console.log(`  ${label.padEnd(35)} ${count}`);
  }

  // JACKPOT + ICP + Displacement opportunity
  const jackpotIcpDisplace = icpCompanies.filter(
    (c) =>
      c.tech_cohort === "CMS + Commerce + Hyperscaler" &&
      c.current_search_provider &&
      c.current_search_provider !== "Algolia"
  );

  console.log("\n" + "═".repeat(80));
  console.log(`🎯 HOT TARGETS: JACKPOT + ICP + Displacement (${jackpotIcpDisplace.length})`);
  console.log("═".repeat(80));
  console.log("\nThese are your TOP PRIORITY accounts:\n");

  for (const c of jackpotIcpDisplace.slice(0, 25)) {
    const traffic = c.traffic ? (c.traffic / 1e6).toFixed(1) + "M" : "N/A";
    console.log(
      `  ${c.domain.padEnd(30)} ${(c.account_name || "").substring(0, 25).padEnd(25)} ${traffic.padStart(8)}  [${c.current_search_provider}]`
    );
  }

  if (jackpotIcpDisplace.length > 25) {
    console.log(`\n  ... and ${jackpotIcpDisplace.length - 25} more`);
  }
}

main().catch(console.error);
