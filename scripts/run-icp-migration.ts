/**
 * Run ICP Evidence Tables Migration
 *
 * Creates the icp_* tables in Supabase if they don't exist.
 * Run with: npx tsx scripts/run-icp-migration.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA4NTU0MCwiZXhwIjoyMDg3NjYxNTQwfQ.tVnqtUbxS55dNnUiKY6_LBqVYYLhGztWoagg-efc3Ac';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' }
});

async function runMigration() {
  console.log('Running ICP Evidence tables migration...\n');

  // Check if tables already exist
  const { data: existingTables, error: checkError } = await supabase
    .from('icp_industries')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('Tables already exist! Checking data...');
    const { data: industries } = await supabase.from('icp_industries').select('*');
    console.log(`Industries: ${industries?.length || 0}`);
    const { data: companies } = await supabase.from('icp_companies').select('id');
    console.log(`Companies: ${companies?.length || 0}`);
    const { data: quotes } = await supabase.from('icp_quotes').select('id');
    console.log(`Quotes: ${quotes?.length || 0}`);
    return;
  }

  // If tables don't exist, we need to run the SQL via the SQL endpoint
  console.log('Tables do not exist. You need to run the SQL migration manually.');
  console.log('\n1. Go to: https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/sql');
  console.log('2. Copy the contents of: supabase/migrations/20260227_icp_evidence_tables.sql');
  console.log('3. Paste and run in the SQL editor');
  console.log('\nAlternatively, run: supabase db reset --linked (WARNING: This resets all data!)');
}

runMigration().catch(console.error);
