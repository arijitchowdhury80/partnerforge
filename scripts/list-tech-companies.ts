/**
 * List Tech Companies in Whale Composite
 *
 * Shows companies in non-ICP industries like Computer Software,
 * Computer Hardware, and Telecommunications that may have been
 * enriched unnecessarily.
 *
 * Usage:
 *   npx ts-node scripts/list-tech-companies.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Non-ICP industries to investigate
const NON_ICP_INDUSTRIES = [
  "Computer Software",
  "Computer Hardware",
  "Telecommunications",
  "Information Technology and Services",
  "Semiconductors",
];

async function main() {
  console.log("=".repeat(70));
  console.log("NON-ICP COMPANIES IN WHALE_COMPOSITE");
  console.log("=".repeat(70));
  console.log("\nThese companies are NOT in your ICP but were enriched.\n");

  for (const industry of NON_ICP_INDUSTRIES) {
    // Query companies in this industry
    const { data: companies, error } = await supabase
      .from("whale_composite")
      .select("domain, account_name, industry, estimated_revenue, monthly_visits, tech_cohort")
      .eq("industry", industry)
      .order("estimated_revenue", { ascending: false, nullsFirst: false });

    if (error) {
      console.log(`Error querying ${industry}: ${error.message}`);
      continue;
    }

    if (!companies || companies.length === 0) {
      continue;
    }

    console.log("-".repeat(70));
    console.log(`${industry.toUpperCase()} (${companies.length} companies)`);
    console.log("-".repeat(70));

    // Show top 20 by revenue
    const topCompanies = companies.slice(0, 20);
    for (const company of topCompanies) {
      const revenue = company.estimated_revenue
        ? `$${(company.estimated_revenue / 1e9).toFixed(1)}B`
        : "N/A";
      const traffic = company.monthly_visits
        ? `${(company.monthly_visits / 1e6).toFixed(1)}M visits`
        : "N/A";
      const cohort = company.tech_cohort || "Not classified";

      console.log(`  ${company.domain}`);
      console.log(`      ${company.account_name || "Unknown"} | ${revenue} | ${traffic} | ${cohort}`);
    }

    if (companies.length > 20) {
      console.log(`  ... and ${companies.length - 20} more\n`);
    }
    console.log();
  }

  // Summary: ICP vs Non-ICP breakdown
  console.log("=".repeat(70));
  console.log("INDUSTRY BREAKDOWN SUMMARY");
  console.log("=".repeat(70));

  const { data: allIndustries, error: summaryError } = await supabase
    .from("whale_composite")
    .select("industry");

  if (summaryError || !allIndustries) {
    console.log("Error fetching summary:", summaryError?.message);
    return;
  }

  // Count by industry
  const industryCounts: Record<string, number> = {};
  for (const row of allIndustries) {
    const ind = row.industry || "Unknown";
    industryCounts[ind] = (industryCounts[ind] || 0) + 1;
  }

  // Sort by count descending
  const sorted = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]);

  // ICP industries (from your ICP_DEFINITION)
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

  let icpCount = 0;
  let nonIcpCount = 0;

  console.log("\nAll industries in whale_composite:\n");
  for (const [industry, count] of sorted) {
    const isIcp = ICP_INDUSTRIES.some(icp =>
      industry.toLowerCase().includes(icp.toLowerCase()) ||
      icp.toLowerCase().includes(industry.toLowerCase())
    );
    const marker = isIcp ? "✓ ICP" : "✗ NON-ICP";

    if (isIcp) {
      icpCount += count;
    } else {
      nonIcpCount += count;
    }

    console.log(`  ${industry}: ${count} (${marker})`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("VERDICT");
  console.log("=".repeat(70));
  console.log(`Total accounts: ${allIndustries.length}`);
  console.log(`ICP-aligned: ${icpCount} (${((icpCount / allIndustries.length) * 100).toFixed(1)}%)`);
  console.log(`Non-ICP: ${nonIcpCount} (${((nonIcpCount / allIndustries.length) * 100).toFixed(1)}%)`);
  console.log("\nRecommendation: Create ICP-filtered view to avoid enriching non-target companies.");
}

main().catch(console.error);
