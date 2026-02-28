import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

const ICP = [
  "Retail",
  "Consumer Goods",
  "Food & Beverages",
  "Apparel & Fashion",
  "Food Production",
  "Luxury Goods & Jewelry",
  "Cosmetics",
  "Sporting Goods",
  "Furniture",
];

async function main() {
  const { data } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry, current_search_provider, tech_cohort");

  if (!data) return;

  const icp = data.filter((c) =>
    ICP.some((i) => c.industry?.toLowerCase().includes(i.toLowerCase()))
  );

  const algoliaCustomers = icp.filter(
    (c) => c.current_search_provider === "Algolia"
  );
  const nonAlgolia = icp.filter(
    (c) => c.current_search_provider !== "Algolia"
  );
  const jackpotNonAlgolia = nonAlgolia.filter(
    (c) => c.tech_cohort === "CMS + Commerce + Hyperscaler"
  );

  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║          ICP ACCOUNTS - ALGOLIA CUSTOMER BREAKDOWN            ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log("║                                                               ║");
  console.log(`║  Total ICP accounts:              ${String(icp.length).padStart(3)}                        ║`);
  console.log(`║  ├─ Algolia customers:            ${String(algoliaCustomers.length).padStart(3)}  (already won)       ║`);
  console.log(`║  └─ Non-Algolia:                  ${String(nonAlgolia.length).padStart(3)}  (displacement pool) ║`);
  console.log("║                                                               ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log("║  DISPLACEMENT TARGETS (Non-Algolia Only)                      ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log(`║  🔥 JACKPOT + ICP + Non-Algolia:   ${String(jackpotNonAlgolia.length).padStart(3)}  (TOP PRIORITY)     ║`);
  console.log(`║     Other ICP + Non-Algolia:       ${String(nonAlgolia.length - jackpotNonAlgolia.length).padStart(3)}                      ║`);
  console.log("║                                                               ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  // Show Algolia customers
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log(`ALGOLIA CUSTOMERS IN ICP (${algoliaCustomers.length}) - Already Won`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const c of algoliaCustomers.sort((a, b) => (b.account_name || "").localeCompare(a.account_name || ""))) {
    console.log(`  ${c.domain.padEnd(35)} ${(c.account_name || "").substring(0, 30)}`);
  }
}

main();
