/**
 * Debug database connectivity
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xbitqeejsgqnwvxlnjra.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
);

async function main() {
  console.log("Testing database connection...\n");

  // Simple count query
  const { count, error: countError } = await supabase
    .from("whale_composite")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.log("Count error:", countError.message);
  } else {
    console.log(`Total rows in whale_composite: ${count}`);
  }

  // Get first 5 rows
  console.log("\nFirst 5 rows:");
  const { data, error } = await supabase
    .from("whale_composite")
    .select("domain, account_name, industry")
    .limit(5);

  if (error) {
    console.log("Query error:", error.message);
    console.log("Full error:", JSON.stringify(error, null, 2));
  } else if (data) {
    console.log(data);
  } else {
    console.log("No data and no error - strange");
  }

  // Check if industry column exists
  console.log("\nChecking columns...");
  const { data: sample, error: sampleError } = await supabase
    .from("whale_composite")
    .select("*")
    .limit(1)
    .single();

  if (sampleError) {
    console.log("Sample error:", sampleError.message);
  } else if (sample) {
    console.log("Available columns:", Object.keys(sample).join(", "));
  }
}

main().catch(console.error);
