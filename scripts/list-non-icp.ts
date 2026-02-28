/**
 * List Non-ICP Tech Companies in Whale Composite
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

// Industries we do NOT want to target
const NON_ICP_TECH_INDUSTRIES = [
  "Computer Software",
  "Computer Hardware",
  "Telecommunications",
  "Information Technology and Services",
  "Semiconductors",
  "Computer & Network Security",
  "Computer Networking",
];

async function main() {
  console.log("=".repeat(80));
  console.log("NON-ICP TECH COMPANIES IN WHALE_COMPOSITE");
  console.log("=".repeat(80));

  // Fetch ALL companies
  const { data: allCompanies, error } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry, traffic, tech_cohort, current_search_provider")
    .order("traffic", { ascending: false, nullsFirst: false });

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  if (!allCompanies) {
    console.log("No data");
    return;
  }

  console.log(`\nTotal companies in whale_composite: ${allCompanies.length}\n`);

  // Filter tech companies
  const techCompanies = allCompanies.filter((c) =>
    NON_ICP_TECH_INDUSTRIES.includes(c.industry || "")
  );

  console.log(`Non-ICP tech companies: ${techCompanies.length} (${((techCompanies.length / allCompanies.length) * 100).toFixed(1)}%)\n`);

  // Group by industry
  const byIndustry: Record<string, typeof techCompanies> = {};
  for (const c of techCompanies) {
    const ind = c.industry || "Unknown";
    if (!byIndustry[ind]) byIndustry[ind] = [];
    byIndustry[ind].push(c);
  }

  // Display each industry
  for (const [industry, companies] of Object.entries(byIndustry)) {
    console.log("-".repeat(80));
    console.log(`${industry.toUpperCase()} (${companies.length} companies)`);
    console.log("-".repeat(80));

    // Sort by traffic descending
    companies.sort((a, b) => (b.traffic || 0) - (a.traffic || 0));

    for (const c of companies.slice(0, 25)) {
      const traffic = c.traffic
        ? (c.traffic / 1e6).toFixed(1) + "M"
        : "N/A";
      const search = c.current_search_provider || "-";
      const cohort = c.tech_cohort || "-";

      console.log(
        `  ${c.domain.padEnd(35)} ${(c.account_name || "Unknown").substring(0, 25).padEnd(25)} ${traffic.padStart(10)} | ${cohort.padEnd(20)} | ${search}`
      );
    }

    if (companies.length > 25) {
      console.log(`  ... and ${companies.length - 25} more\n`);
    }
    console.log();
  }

  // Summary
  console.log("=".repeat(80));
  console.log("WASTED ENRICHMENT SUMMARY");
  console.log("=".repeat(80));

  // Count how many have been enriched (have builtwith data)
  const enrichedTech = techCompanies.filter((c) => c.tech_cohort !== null);
  console.log(`\nNon-ICP tech companies enriched: ${enrichedTech.length}`);
  console.log("These represent wasted BuiltWith API calls.\n");

  // ICP Industries for comparison
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

  const icpCompanies = allCompanies.filter((c) =>
    ICP_INDUSTRIES.some(
      (icp) =>
        c.industry?.toLowerCase().includes(icp.toLowerCase()) ||
        icp.toLowerCase().includes(c.industry?.toLowerCase() || "")
    )
  );

  console.log("ICP BREAKDOWN:");
  console.log(`  ICP-aligned companies: ${icpCompanies.length} (${((icpCompanies.length / allCompanies.length) * 100).toFixed(1)}%)`);
  console.log(`  Non-ICP companies: ${allCompanies.length - icpCompanies.length} (${(((allCompanies.length - icpCompanies.length) / allCompanies.length) * 100).toFixed(1)}%)`);
  console.log(`\n  Of which, pure tech companies: ${techCompanies.length}`);
}

main().catch(console.error);
