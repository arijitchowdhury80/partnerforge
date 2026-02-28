/**
 * Adobe (Crossbeam) List - ICP Distribution
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

function bar(pct: number, maxWidth = 40): string {
  const filled = Math.round((pct / 100) * maxWidth);
  return "█".repeat(filled) + "░".repeat(maxWidth - filled);
}

async function main() {
  // Get crossbeam_overlaps data
  const { data: adobeList, error: adobeError } = await supabase
    .from("crossbeam_overlaps")
    .select("domain, company_name, industry, partner_product, algolia_status");

  if (adobeError || !adobeList) {
    console.log("Error fetching crossbeam_overlaps:", adobeError?.message);
    return;
  }

  const total = adobeList.length;

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log(`║           ADOBE (CROSSBEAM) LIST - ICP DISTRIBUTION (n=${total})                ║`);
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");

  // Count by industry
  const industryCounts: Record<string, number> = {};
  for (const row of adobeList) {
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

  // Sort
  icpIndustries.sort((a, b) => b[1] - a[1]);
  techIndustries.sort((a, b) => b[1] - a[1]);
  otherIndustries.sort((a, b) => b[1] - a[1]);

  const icpPct = (icpCount / total) * 100;
  const techPct = (techCount / total) * 100;
  const otherPct = (otherCount / total) * 100;

  console.log("║                                                                              ║");
  console.log("║  CATEGORY BREAKDOWN                                                          ║");
  console.log("║  ─────────────────                                                           ║");
  console.log("║                                                                              ║");
  console.log(`║  ✅ ICP-ALIGNED     ${bar(icpPct)} ${icpPct.toFixed(1).padStart(5)}%  (${String(icpCount).padStart(3)})   ║`);
  console.log(`║  ❌ TECH (NON-ICP)  ${bar(techPct)} ${techPct.toFixed(1).padStart(5)}%  (${String(techCount).padStart(3)})   ║`);
  console.log(`║  ⚪ OTHER NON-ICP   ${bar(otherPct)} ${otherPct.toFixed(1).padStart(5)}%  (${String(otherCount).padStart(3)})   ║`);
  console.log("║                                                                              ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
  console.log("║                                                                              ║");
  console.log("║  ✅ ICP-ALIGNED INDUSTRIES                                                   ║");
  console.log("║  ─────────────────────────                                                   ║");

  for (const [industry, count] of icpIndustries) {
    const pct = (count / total) * 100;
    const indName = industry.substring(0, 25).padEnd(25);
    console.log(`║     ${indName} ${bar(pct, 30)} ${pct.toFixed(1).padStart(5)}%  (${String(count).padStart(3)}) ║`);
  }

  if (icpIndustries.length === 0) {
    console.log("║     (none)                                                                  ║");
  }

  console.log("║                                                                              ║");
  console.log("║  ❌ TECH INDUSTRIES                                                          ║");
  console.log("║  ──────────────────                                                          ║");

  for (const [industry, count] of techIndustries) {
    const pct = (count / total) * 100;
    const indName = industry.substring(0, 25).padEnd(25);
    console.log(`║     ${indName} ${bar(pct, 30)} ${pct.toFixed(1).padStart(5)}%  (${String(count).padStart(3)}) ║`);
  }

  if (techIndustries.length === 0) {
    console.log("║     (none)                                                                  ║");
  }

  console.log("║                                                                              ║");
  console.log("║  ⚪ OTHER NON-ICP (Top 15)                                                   ║");
  console.log("║  ──────────────────────────                                                  ║");

  for (const [industry, count] of otherIndustries.slice(0, 15)) {
    const pct = (count / total) * 100;
    const indName = industry.substring(0, 25).padEnd(25);
    console.log(`║     ${indName} ${bar(pct, 30)} ${pct.toFixed(1).padStart(5)}%  (${String(count).padStart(3)}) ║`);
  }

  if (otherIndustries.length > 15) {
    console.log(`║     ... and ${otherIndustries.length - 15} more industries                                           ║`);
  }

  console.log("║                                                                              ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
  console.log("║                                                                              ║");
  console.log("║  📊 COMPARISON: ADOBE LIST vs WHALE_COMPOSITE                                ║");
  console.log("║  ────────────────────────────────────────────                                ║");
  console.log("║                                                                              ║");
  console.log(`║     Adobe List:                                                              ║`);
  console.log(`║       Total:        ${String(total).padStart(5)}                                                  ║`);
  console.log(`║       ICP-Aligned:  ${String(icpCount).padStart(5)} (${icpPct.toFixed(1)}%)                                           ║`);
  console.log(`║       Non-ICP:      ${String(total - icpCount).padStart(5)} (${(100 - icpPct).toFixed(1)}%)                                           ║`);
  console.log("║                                                                              ║");
  console.log(`║     Whale Composite (for reference):                                         ║`);
  console.log(`║       Total:          772                                                    ║`);
  console.log(`║       ICP-Aligned:    166 (21.5%)                                            ║`);
  console.log(`║       Non-ICP:        606 (78.5%)                                            ║`);
  console.log("║                                                                              ║");

  // Verdict
  const betterOrWorse = icpPct > 21.5 ? "BETTER" : "WORSE";
  const diff = Math.abs(icpPct - 21.5).toFixed(1);
  console.log(`║  🎯 VERDICT: Adobe list is ${betterOrWorse} than whale_composite by ${diff}pp              ║`);
  console.log("║                                                                              ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");

  // List ICP companies from Adobe list
  console.log("\n\n");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("ICP-ALIGNED COMPANIES IN ADOBE LIST (Ready for ABM)");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");

  const icpCompanies = adobeList.filter((c) =>
    ICP_INDUSTRIES.some(
      (icp) =>
        c.industry?.toLowerCase().includes(icp.toLowerCase()) ||
        icp.toLowerCase().includes(c.industry?.toLowerCase() || "")
    )
  );

  // Group by industry
  const icpByIndustry: Record<string, typeof icpCompanies> = {};
  for (const c of icpCompanies) {
    const ind = c.industry || "Unknown";
    if (!icpByIndustry[ind]) icpByIndustry[ind] = [];
    icpByIndustry[ind].push(c);
  }

  for (const [industry, companies] of Object.entries(icpByIndustry).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${industry} (${companies.length})`);
    console.log("-".repeat(50));
    for (const c of companies.slice(0, 15)) {
      console.log(`  ${c.domain.padEnd(35)} ${c.company_name || ""}`);
    }
    if (companies.length > 15) {
      console.log(`  ... and ${companies.length - 15} more`);
    }
  }
}

main().catch(console.error);
