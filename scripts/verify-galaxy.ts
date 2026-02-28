/**
 * Verify Galaxy Data
 * Quick script to check company counts by tech
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

async function verify() {
  console.log("=".repeat(60));
  console.log("GALAXY VERIFICATION");
  console.log("=".repeat(60));

  // Total count
  const { count: total } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });
  console.log(`\nTotal companies: ${total}`);

  // Commerce tech distribution
  console.log("\n--- COMMERCE TECH ---");
  const commerceTechs = ["SFCC", "Shopify+", "Magento", "BigCommerce", "Commercetools", "Spryker"];
  for (const tech of commerceTechs) {
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("commerce_tech", tech);
    console.log(`  ${tech.padEnd(15)}: ${count}`);
  }

  // CMS tech distribution
  console.log("\n--- CMS TECH ---");
  const cmsTechs = ["AEM", "Contentful", "Contentstack", "Amplience", "Sitecore"];
  for (const tech of cmsTechs) {
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("cms_tech", tech);
    console.log(`  ${tech.padEnd(15)}: ${count || 0}`);
  }

  // Cohort distribution
  console.log("\n--- TECH COHORTS ---");
  const cohorts = ["JACKPOT", "HIGH", "MEDIUM", "BASE"];
  for (const cohort of cohorts) {
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("tech_cohort", cohort);
    console.log(`  ${cohort.padEnd(10)}: ${count}`);
  }

  // Sales play distribution
  console.log("\n--- SALES PLAY ---");
  const plays = ["DISPLACEMENT", "GREENFIELD"];
  for (const play of plays) {
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("sales_play", play);
    console.log(`  ${play.padEnd(15)}: ${count}`);
  }

  // Sample records
  console.log("\n--- SAMPLE RECORDS ---");
  const { data: samples } = await supabase
    .from("companies")
    .select("domain, commerce_tech, cms_tech, tech_cohort, sales_play")
    .limit(10);

  samples?.forEach((r) => {
    console.log(`  ${r.domain}`);
    console.log(`    Commerce: ${r.commerce_tech || "-"} | CMS: ${r.cms_tech || "-"}`);
    console.log(`    Cohort: ${r.tech_cohort} | Play: ${r.sales_play}`);
  });
}

verify().catch(console.error);
