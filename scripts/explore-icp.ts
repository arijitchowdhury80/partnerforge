import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function exploreTables() {
  console.log('Searching for ICP-related tables...\n');

  // Try common ICP table names
  const tableNames = [
    'icp',
    'icp_definition',
    'icp_criteria',
    'ideal_customer_profile',
    'customer_profile',
    'target_profile',
    'icp_verticals',
    'verticals',
    'industries'
  ];

  for (const table of tableNames) {
    const { data, error } = await supabase.from(table).select('*').limit(5);
    if (!error && data) {
      console.log(`\n✓ FOUND TABLE: ${table}`);
      console.log('Sample data:', JSON.stringify(data, null, 2));
    }
  }
}

exploreTables().catch(console.error);
