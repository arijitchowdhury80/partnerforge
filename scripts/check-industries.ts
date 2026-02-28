/**
 * Check industry names and get tech companies
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

async function main() {
  // Get all unique industries
  console.log("=== ALL INDUSTRIES IN WHALE_COMPOSITE ===\n");
  const { data: allData } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry, monthly_visits, tech_cohort");

  if (!allData) {
    console.log("No data returned");
    return;
  }

  console.log(`Total records: ${allData.length}\n`);

  // Count by industry
  const industryCounts: Record<string, number> = {};
  for (const row of allData) {
    const ind = row.industry || "Unknown";
    industryCounts[ind] = (industryCounts[ind] || 0) + 1;
  }

  // Sort by count
  const sorted = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]);
  console.log("Industry counts:");
  for (const [ind, count] of sorted.slice(0, 20)) {
    console.log(`  ${ind}: ${count}`);
  }

  // Find companies that look like tech companies
  console.log("\n=== TECH-RELATED COMPANIES (by industry keyword) ===\n");

  const techKeywords = ["computer", "software", "hardware", "tech", "semi", "telecom"];
  const techCompanies = allData.filter((c) => {
    const ind = (c.industry || "").toLowerCase();
    return techKeywords.some((kw) => ind.includes(kw));
  });

  console.log(`Found ${techCompanies.length} tech-related companies:\n`);

  // Sort by traffic
  techCompanies.sort((a, b) => (b.monthly_visits || 0) - (a.monthly_visits || 0));

  for (const c of techCompanies.slice(0, 50)) {
    const visits = c.monthly_visits
      ? (c.monthly_visits / 1e6).toFixed(1) + "M"
      : "N/A";
    console.log(
      `  ${c.domain.padEnd(30)} | ${(c.account_name || "Unknown").padEnd(30)} | ${c.industry?.padEnd(30)} | ${visits} | ${c.tech_cohort || "N/A"}`
    );
  }

  // Check for NVIDIA specifically
  console.log("\n=== LOOKING FOR NVIDIA ===");
  const nvidia = allData.filter(
    (c) =>
      c.domain?.toLowerCase().includes("nvidia") ||
      c.account_name?.toLowerCase().includes("nvidia")
  );
  console.log(nvidia);
}

main().catch(console.error);
