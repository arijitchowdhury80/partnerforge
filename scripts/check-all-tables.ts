/**
 * Check all tables in the database to identify legacy tables for cleanup
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// All possible tables (current + potential legacy)
const TABLES_TO_CHECK = [
  // ========== CURRENT SCHEMA (v2) ==========
  { name: 'companies', status: 'KEEP', purpose: 'Layer 0 - All companies with 5 galaxies' },
  { name: 'company_technologies', status: 'KEEP', purpose: 'All techs per company (50-200 each)' },
  { name: 'company_relationships', status: 'KEEP', purpose: 'Parent/child relationships' },
  { name: 'technologies', status: 'KEEP', purpose: 'Reference: BuiltWith → galaxy mapping' },
  { name: 'builtwith_raw', status: 'KEEP', purpose: 'Raw API responses' },
  { name: 'whale_composite', status: 'KEEP', purpose: 'Layer 2 - Demandbase + ZoomInfo' },
  { name: 'crossbeam_overlaps', status: 'KEEP', purpose: 'Layer 3 - Partner CRM overlaps' },
  { name: 'industries', status: 'KEEP', purpose: 'Industry taxonomy' },
  { name: 'tech_options', status: 'KEEP', purpose: 'Dropdown values for galaxies' },

  // ========== ICP TABLES (may be needed) ==========
  { name: 'icp_customers', status: 'REVIEW', purpose: 'ICP customer evidence' },
  { name: 'icp_case_studies', status: 'REVIEW', purpose: 'ICP case studies' },
  { name: 'icp_quotes', status: 'REVIEW', purpose: 'ICP customer quotes' },
  { name: 'icp_metrics', status: 'REVIEW', purpose: 'ICP success metrics' },
  { name: 'icp_advocates', status: 'REVIEW', purpose: 'ICP customer advocates' },
  { name: 'icp_personas', status: 'REVIEW', purpose: 'ICP buyer personas' },

  // ========== POTENTIAL LEGACY (v1) ==========
  { name: 'targets', status: 'DROP', purpose: 'Legacy v1 targets table' },
  { name: 'target_technologies', status: 'DROP', purpose: 'Legacy v1 tech mapping' },
  { name: 'enrichment_cache', status: 'DROP', purpose: 'Legacy enrichment cache' },
  { name: 'upload_batches', status: 'DROP', purpose: 'Legacy upload tracking' },
  { name: 'partner_targets', status: 'DROP', purpose: 'Legacy partner targets' },
  { name: 'displacement_targets', status: 'DROP', purpose: 'Legacy displacement' },
  { name: 'tech_stack', status: 'DROP', purpose: 'Legacy tech stack' },
  { name: 'company_intel', status: 'DROP', purpose: 'Legacy company intel' },
];

async function main() {
  console.log("=".repeat(70));
  console.log("DATABASE TABLE AUDIT");
  console.log("=".repeat(70));
  console.log("");

  const existing: string[] = [];
  const notFound: string[] = [];
  const toKeep: string[] = [];
  const toDrop: string[] = [];
  const toReview: string[] = [];

  for (const table of TABLES_TO_CHECK) {
    const { count, error } = await supabase
      .from(table.name)
      .select("*", { count: "exact", head: true });

    const exists = !error || (!error.message.includes("does not exist") && !error.message.includes("not found"));
    const rowCount = exists ? (count || 0) : 0;

    if (exists) {
      existing.push(table.name);
      const statusEmoji = table.status === 'KEEP' ? '✓' : table.status === 'DROP' ? '✗' : '?';
      console.log(`${statusEmoji} ${table.name.padEnd(25)} | ${String(rowCount).padStart(6)} rows | ${table.status.padEnd(6)} | ${table.purpose}`);

      if (table.status === 'KEEP') toKeep.push(table.name);
      else if (table.status === 'DROP') toDrop.push(table.name);
      else toReview.push(table.name);
    } else {
      notFound.push(table.name);
    }
  }

  console.log("");
  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`Tables found: ${existing.length}`);
  console.log(`Tables to KEEP: ${toKeep.length} (${toKeep.join(', ')})`);
  console.log(`Tables to DROP: ${toDrop.length} (${toDrop.join(', ') || 'none found'})`);
  console.log(`Tables to REVIEW: ${toReview.length} (${toReview.join(', ') || 'none'})`);
  console.log(`Tables NOT FOUND: ${notFound.length}`);

  if (toDrop.length > 0) {
    console.log("");
    console.log("=".repeat(70));
    console.log("CLEANUP SQL (run in Supabase Dashboard)");
    console.log("=".repeat(70));
    console.log("");
    for (const table of toDrop) {
      console.log(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }
  }
}

main().catch(console.error);
