import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

async function check() {
  // Check 1800contacts
  const { data: d1, error: e1 } = await supabase
    .from("whale_composite")
    .select("domain, builtwith_technologies, builtwith_fetched_at")
    .eq("domain", "1800contacts.com")
    .single();

  console.log("=== 1800contacts.com ===");
  if (e1) console.log("Error:", e1.message);
  else {
    console.log("Fetched at:", d1?.builtwith_fetched_at);
    console.log("Stored data:", JSON.stringify(d1?.builtwith_technologies, null, 2));
  }

  // Check costco
  const { data: d2, error: e2 } = await supabase
    .from("whale_composite")
    .select("domain, builtwith_technologies")
    .eq("domain", "costco.com")
    .single();

  console.log("\n=== costco.com ===");
  if (e2) console.log("Error:", e2.message);
  else {
    const tech = d2?.builtwith_technologies as any;
    console.log("Tech count:", tech?.tech_count);
    console.log("Categories:", tech?.categories);
    console.log("Sample technologies:", tech?.technologies?.slice(0, 5).map((t: any) => t.Name));
  }

  // Count how many have been fetched
  const { data: fetched, count } = await supabase
    .from("whale_composite")
    .select("domain", { count: "exact" })
    .not("builtwith_fetched_at", "is", null);

  console.log("\n=== SUMMARY ===");
  console.log("Accounts with BuiltWith data:", count);
}

check();
