/**
 * List Tech Companies in Detail
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

async function main() {
  // Computer Hardware
  console.log("\n=== COMPUTER HARDWARE (2 companies) ===");
  const { data: hw } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry, monthly_visits, tech_cohort")
    .eq("industry", "Computer Hardware");

  for (const c of hw || []) {
    const visits = c.monthly_visits
      ? (c.monthly_visits / 1e6).toFixed(1) + "M"
      : "N/A";
    console.log(
      `  ${c.domain} | ${c.account_name} | ${visits} visits | ${c.tech_cohort || "N/A"}`
    );
  }

  // Semiconductors
  console.log("\n=== SEMICONDUCTORS (2 companies) ===");
  const { data: semi } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry, monthly_visits, tech_cohort")
    .eq("industry", "Semiconductors");

  for (const c of semi || []) {
    const visits = c.monthly_visits
      ? (c.monthly_visits / 1e6).toFixed(1) + "M"
      : "N/A";
    console.log(
      `  ${c.domain} | ${c.account_name} | ${visits} visits | ${c.tech_cohort || "N/A"}`
    );
  }

  // Computer Software - Top 30 by traffic
  console.log("\n=== COMPUTER SOFTWARE - TOP 30 by Traffic ===");
  const { data: sw } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry, monthly_visits, tech_cohort")
    .eq("industry", "Computer Software")
    .order("monthly_visits", { ascending: false, nullsFirst: false })
    .limit(30);

  for (const c of sw || []) {
    const visits = c.monthly_visits
      ? (c.monthly_visits / 1e6).toFixed(1) + "M"
      : "N/A";
    console.log(
      `  ${c.domain} | ${c.account_name || "Unknown"} | ${visits} visits | ${c.tech_cohort || "N/A"}`
    );
  }

  // Telecommunications - Top 20
  console.log("\n=== TELECOMMUNICATIONS - TOP 20 ===");
  const { data: telecom } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry, monthly_visits, tech_cohort")
    .eq("industry", "Telecommunications")
    .order("monthly_visits", { ascending: false, nullsFirst: false })
    .limit(20);

  for (const c of telecom || []) {
    const visits = c.monthly_visits
      ? (c.monthly_visits / 1e6).toFixed(1) + "M"
      : "N/A";
    console.log(
      `  ${c.domain} | ${c.account_name || "Unknown"} | ${visits} visits | ${c.tech_cohort || "N/A"}`
    );
  }
}

main().catch(console.error);
