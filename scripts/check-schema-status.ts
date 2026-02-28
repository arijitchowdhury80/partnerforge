/**
 * Check current database schema status
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("=".repeat(60));
  console.log("DATABASE SCHEMA STATUS CHECK");
  console.log("=".repeat(60));

  // 1. Check companies table and new columns
  console.log("\n1. COMPANIES TABLE:");
  const { data: companySample, error: companyError } = await supabase
    .from("companies")
    .select("domain, company_name, cms_tech, commerce_tech, martech_tech, search_tech, cloud_tech")
    .limit(3);

  if (companyError) {
    console.log("   Error:", companyError.message);
  } else {
    console.log("   Status: EXISTS");
    console.log("   Sample:", JSON.stringify(companySample?.[0] || {}, null, 2));
  }

  // Check if new columns exist
  const { data: newColSample, error: newColError } = await supabase
    .from("companies")
    .select("monthly_tech_spend, vertical, linkedin_url")
    .limit(1);

  if (newColError && newColError.message.includes("does not exist")) {
    console.log("   NEW COLUMNS (monthly_tech_spend, vertical, linkedin_url): NOT YET MIGRATED");
  } else if (newColError) {
    console.log("   NEW COLUMNS check error:", newColError.message);
  } else {
    console.log("   NEW COLUMNS: EXIST ✓");
  }

  // Count companies
  const { count: companyCount } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });
  console.log(`   Total rows: ${companyCount}`);

  // 2. Check company_technologies table
  console.log("\n2. COMPANY_TECHNOLOGIES TABLE:");
  const { data: techData, error: techError } = await supabase
    .from("company_technologies")
    .select("*")
    .limit(1);

  if (techError) {
    if (techError.message.includes("does not exist")) {
      console.log("   Status: NOT CREATED YET - Migration needed");
    } else {
      console.log("   Error:", techError.message);
    }
  } else {
    const { count: techCount } = await supabase
      .from("company_technologies")
      .select("*", { count: "exact", head: true });
    console.log(`   Status: EXISTS ✓`);
    console.log(`   Total rows: ${techCount}`);
  }

  // 3. Check technologies reference table
  console.log("\n3. TECHNOLOGIES REFERENCE TABLE:");
  const { data: refData, error: refError } = await supabase
    .from("technologies")
    .select("*")
    .limit(1);

  if (refError) {
    if (refError.message.includes("does not exist")) {
      console.log("   Status: NOT CREATED YET - Migration needed");
    } else {
      console.log("   Error:", refError.message);
    }
  } else {
    const { count: refCount } = await supabase
      .from("technologies")
      .select("*", { count: "exact", head: true });
    console.log(`   Status: EXISTS ✓`);
    console.log(`   Total rows: ${refCount}`);
  }

  // 4. Check company_relationships table
  console.log("\n4. COMPANY_RELATIONSHIPS TABLE:");
  const { data: relData, error: relError } = await supabase
    .from("company_relationships")
    .select("*")
    .limit(1);

  if (relError) {
    if (relError.message.includes("does not exist")) {
      console.log("   Status: NOT CREATED YET - Migration needed");
    } else {
      console.log("   Error:", relError.message);
    }
  } else {
    const { count: relCount } = await supabase
      .from("company_relationships")
      .select("*", { count: "exact", head: true });
    console.log(`   Status: EXISTS ✓`);
    console.log(`   Total rows: ${relCount}`);
  }

  // 5. Check builtwith_raw table
  console.log("\n5. BUILTWITH_RAW TABLE:");
  const { data: rawData, error: rawError } = await supabase
    .from("builtwith_raw")
    .select("*")
    .limit(1);

  if (rawError) {
    if (rawError.message.includes("does not exist")) {
      console.log("   Status: NOT CREATED YET - Migration needed");
    } else {
      console.log("   Error:", rawError.message);
    }
  } else {
    const { count: rawCount } = await supabase
      .from("builtwith_raw")
      .select("*", { count: "exact", head: true });
    console.log(`   Status: EXISTS ✓`);
    console.log(`   Total rows: ${rawCount}`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Companies table: ${companyCount} rows`);
  console.log("\nNEXT STEPS:");
  console.log("1. Run migration: 20260228_comprehensive_builtwith_schema.sql");
  console.log("2. Run hyperscaler fetch: npx ts-node scripts/fetch-hyperscaler-data.ts");
  console.log("3. Run domain enrichment: npx ts-node scripts/enrich-domain-techstack.ts");
}

main().catch(console.error);
