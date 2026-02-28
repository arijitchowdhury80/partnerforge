/**
 * Industry Distribution Visualization
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

// ICP Industries
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

// Non-ICP Tech Industries
const TECH_INDUSTRIES = [
  "Computer Software",
  "Computer Hardware",
  "Telecommunications",
  "Information Technology and Services",
  "Semiconductors",
  "Computer & Network Security",
  "Computer Networking",
];

function bar(pct: number, maxWidth = 50): string {
  const filled = Math.round((pct / 100) * maxWidth);
  return "█".repeat(filled) + "░".repeat(maxWidth - filled);
}

async function main() {
  const { data: allData } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry");

  if (!allData) {
    console.log("No data");
    return;
  }

  const total = allData.length;

  // Count by industry
  const industryCounts: Record<string, number> = {};
  for (const row of allData) {
    const ind = row.industry || "Unknown";
    industryCounts[ind] = (industryCounts[ind] || 0) + 1;
  }

  // Categorize
  let icpCount = 0;
  let techCount = 0;
  let otherCount = 0;

  const icpIndustries: Array<[string, number]> = [];
  const techIndustries: Array<[string, number]> = [];
  const otherIndustries: Array<[string, number]> = [];

  for (const [industry, count] of Object.entries(industryCounts)) {
    const isIcp = ICP_INDUSTRIES.some(
      (icp) =>
        industry.toLowerCase().includes(icp.toLowerCase()) ||
        icp.toLowerCase().includes(industry.toLowerCase())
    );
    const isTech = TECH_INDUSTRIES.includes(industry);

    if (isIcp) {
      icpCount += count;
      icpIndustries.push([industry, count]);
    } else if (isTech) {
      techCount += count;
      techIndustries.push([industry, count]);
    } else {
      otherCount += count;
      otherIndustries.push([industry, count]);
    }
  }

  // Sort each category by count
  icpIndustries.sort((a, b) => b[1] - a[1]);
  techIndustries.sort((a, b) => b[1] - a[1]);
  otherIndustries.sort((a, b) => b[1] - a[1]);

  const icpPct = (icpCount / total) * 100;
  const techPct = (techCount / total) * 100;
  const otherPct = (otherCount / total) * 100;

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║              WHALE_COMPOSITE INDUSTRY DISTRIBUTION (n=772)                  ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
  console.log("║                                                                              ║");
  console.log("║  CATEGORY BREAKDOWN                                                          ║");
  console.log("║  ─────────────────                                                           ║");
  console.log("║                                                                              ║");
  console.log(`║  ✅ ICP-ALIGNED     ${bar(icpPct, 40)} ${icpPct.toFixed(1).padStart(5)}%  (${icpCount})    ║`);
  console.log(`║  ❌ TECH (NON-ICP)  ${bar(techPct, 40)} ${techPct.toFixed(1).padStart(5)}%  (${techCount})    ║`);
  console.log(`║  ⚪ OTHER NON-ICP   ${bar(otherPct, 40)} ${otherPct.toFixed(1).padStart(5)}%  (${otherCount})    ║`);
  console.log("║                                                                              ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
  console.log("║                                                                              ║");
  console.log("║  ✅ ICP-ALIGNED INDUSTRIES (Your Target Market)                              ║");
  console.log("║  ──────────────────────────────────────────────                              ║");

  for (const [industry, count] of icpIndustries.slice(0, 8)) {
    const pct = (count / total) * 100;
    const indName = industry.substring(0, 25).padEnd(25);
    console.log(`║     ${indName} ${bar(pct, 30)} ${pct.toFixed(1).padStart(5)}%  (${String(count).padStart(3)}) ║`);
  }

  console.log("║                                                                              ║");
  console.log("║  ❌ TECH INDUSTRIES (Wasted Enrichment)                                      ║");
  console.log("║  ──────────────────────────────────────                                      ║");

  for (const [industry, count] of techIndustries) {
    const pct = (count / total) * 100;
    const indName = industry.substring(0, 25).padEnd(25);
    console.log(`║     ${indName} ${bar(pct, 30)} ${pct.toFixed(1).padStart(5)}%  (${String(count).padStart(3)}) ║`);
  }

  console.log("║                                                                              ║");
  console.log("║  ⚪ OTHER NON-ICP (Top 10)                                                   ║");
  console.log("║  ─────────────────────────                                                   ║");

  for (const [industry, count] of otherIndustries.slice(0, 10)) {
    const pct = (count / total) * 100;
    const indName = industry.substring(0, 25).padEnd(25);
    console.log(`║     ${indName} ${bar(pct, 30)} ${pct.toFixed(1).padStart(5)}%  (${String(count).padStart(3)}) ║`);
  }

  console.log("║                                                                              ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
  console.log("║                                                                              ║");
  console.log("║  📊 SUMMARY                                                                  ║");
  console.log("║  ──────────                                                                  ║");
  console.log("║                                                                              ║");
  console.log(`║     Total Accounts:        ${String(total).padStart(5)}                                        ║`);
  console.log(`║     ICP-Aligned:           ${String(icpCount).padStart(5)} (${icpPct.toFixed(1)}%)                                    ║`);
  console.log(`║     Non-ICP (Wasted):      ${String(total - icpCount).padStart(5)} (${(100 - icpPct).toFixed(1)}%)                                    ║`);
  console.log("║                                                                              ║");
  console.log("║  💸 WASTED ENRICHMENT COST                                                   ║");
  console.log(`║     Tech companies enriched: ~196 BuiltWith API calls                        ║`);
  console.log(`║     Other non-ICP enriched:  ~403 BuiltWith API calls                        ║`);
  console.log(`║     Total wasted:            ~599 API calls (77.6%)                          ║`);
  console.log("║                                                                              ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");
  console.log("\n");
}

main().catch(console.error);
