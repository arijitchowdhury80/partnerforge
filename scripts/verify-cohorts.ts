import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

async function verify() {
  // Count by cohort
  const { data: cohorts } = await supabase
    .from("whale_composite")
    .select("tech_cohort")
    .not("tech_cohort", "is", null);

  const counts: Record<string, number> = {};
  cohorts?.forEach((r: any) => {
    counts[r.tech_cohort] = (counts[r.tech_cohort] || 0) + 1;
  });

  console.log("=== COHORT COUNTS IN DATABASE ===");
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => {
      console.log("  " + k + ": " + v);
    });

  // Sample JACKPOT with Solr displacement
  const { data: jackpot } = await supabase
    .from("whale_composite")
    .select("domain, account_name, tech_cohort, current_search_provider")
    .eq("tech_cohort", "CMS + Commerce + Hyperscaler")
    .eq("current_search_provider", "Solr")
    .limit(10);

  console.log("\n=== SAMPLE JACKPOT + SOLR (Top Displacement Targets) ===");
  jackpot?.forEach((r: any) => {
    console.log(
      "  " + r.domain + " | " + (r.account_name || "N/A")
    );
  });
}

verify();
