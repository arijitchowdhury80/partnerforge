import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

async function check() {
  // Check if nvidia.com is in whale_composite
  const { data: nvidia } = await supabase
    .from("whale_composite")
    .select("domain, account_name, demandbase_industry")
    .eq("domain", "nvidia.com");

  console.log("=== IS NVIDIA IN WHALE_COMPOSITE? ===");
  console.log(nvidia?.length ? "YES: " + JSON.stringify(nvidia[0]) : "NO");

  // Check industry distribution
  const { data: industries } = await supabase
    .from("whale_composite")
    .select("demandbase_industry");

  const counts: Record<string, number> = {};
  industries?.forEach((r: any) => {
    const ind = r.demandbase_industry || "Unknown";
    counts[ind] = (counts[ind] || 0) + 1;
  });

  console.log("\n=== INDUSTRIES IN WHALE_COMPOSITE ===");
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Sample of tech companies that probably shouldn't be targets
  const { data: techCompanies } = await supabase
    .from("whale_composite")
    .select("domain, account_name, demandbase_industry")
    .in("demandbase_industry", ["Computer Software", "Computer Hardware", "Telecommunications"])
    .limit(10);

  console.log("\n=== SAMPLE TECH COMPANIES (Are these valid targets?) ===");
  techCompanies?.forEach((r: any) => {
    console.log(`  ${r.domain} | ${r.account_name} | ${r.demandbase_industry}`);
  });
}

check();
