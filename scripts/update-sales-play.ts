/**
 * Update sales_play Generated Column
 * Adds new search competitor technologies to DISPLACEMENT classification
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Updating sales_play classification...\n");

  // The generated column cannot be altered directly via Supabase client
  // We need to use the SQL Editor in Supabase Dashboard or the service role key

  // Instead, let's verify what we have and compute the correct counts

  // Get all unique search_tech values
  const { data: searchTechs } = await supabase
    .from("companies")
    .select("search_tech")
    .not("search_tech", "is", null);

  const uniqueTechs = [...new Set(searchTechs?.map(r => r.search_tech))];
  console.log("Search technologies in database:");
  uniqueTechs.forEach(t => console.log(`  - ${t}`));

  // Count how many should be DISPLACEMENT
  const displacementTechs = [
    'Elastic', 'Solr', 'Lucidworks',
    'Coveo', 'Bloomreach', 'SearchSpring', 'Klevu', 'Constructor',
    'Swiftype', 'Doofinder', 'Yext', 'Cludo', 'Searchanise', 'AddSearch', 'Sooqr'
  ];

  let displacementCount = 0;
  console.log("\nDisplacement counts by tech:");
  for (const tech of displacementTechs) {
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("search_tech", tech);
    if (count && count > 0) {
      console.log(`  ${tech.padEnd(15)}: ${count}`);
      displacementCount += count;
    }
  }

  console.log(`\nTotal DISPLACEMENT opportunities: ${displacementCount}`);

  // Check current sales_play counts
  const { count: currentDisplacement } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .eq("sales_play", "DISPLACEMENT");

  console.log(`Current sales_play=DISPLACEMENT: ${currentDisplacement}`);

  if (displacementCount > (currentDisplacement || 0)) {
    console.log("\n⚠️  Generated column needs update!");
    console.log("Run this SQL in Supabase Dashboard > SQL Editor:\n");
    console.log(`
ALTER TABLE companies DROP COLUMN sales_play;

ALTER TABLE companies ADD COLUMN sales_play VARCHAR(20) GENERATED ALWAYS AS (
    CASE
        WHEN search_tech IN (
            'Elastic', 'Solr', 'Lucidworks',
            'Coveo', 'Bloomreach', 'SearchSpring', 'Klevu', 'Constructor',
            'Swiftype', 'Doofinder', 'Yext', 'Cludo', 'Searchanise', 'AddSearch', 'Sooqr',
            'Attraqt', 'Hawksearch', 'Sajari', 'Typesense', 'Meilisearch'
        )
        THEN 'DISPLACEMENT'
        ELSE 'GREENFIELD'
    END
) STORED;
    `);
  }
}

main().catch(console.error);
