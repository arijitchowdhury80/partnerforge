import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function main() {
  console.log('='.repeat(70));
  console.log('CHECKING FOR REVENUE DATA IN SUPABASE');
  console.log('='.repeat(70));

  // Check whale_composite
  console.log('\n1. whale_composite table:');
  const { count: whaleCount } = await supabase
    .from('whale_composite')
    .select('*', { count: 'exact', head: true });
  console.log(`   Rows: ${whaleCount}`);

  if (whaleCount && whaleCount > 0) {
    const { data: whaleSample } = await supabase
      .from('whale_composite')
      .select('*')
      .limit(3);
    console.log('   Sample:', JSON.stringify(whaleSample, null, 2));
  }

  // Check if companies table has revenue columns
  console.log('\n2. companies table - checking for revenue columns:');
  const { data: companiesSchema, error: schemaError } = await supabase
    .from('companies')
    .select('domain, company_name, revenue, annual_revenue, employee_count, industry')
    .limit(3);

  if (schemaError) {
    if (schemaError.message.includes('does not exist')) {
      console.log('   Revenue columns NOT found in companies table');
      console.log('   Error:', schemaError.message);
    } else {
      console.log('   Error:', schemaError.message);
    }
  } else {
    console.log('   Revenue columns FOUND!');
    console.log('   Sample:', JSON.stringify(companiesSchema, null, 2));

    // Count companies with revenue data
    const { count: revenueCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('revenue', 'is', null);
    console.log(`   Companies with revenue: ${revenueCount}`);
  }

  // Check crossbeam_overlaps
  console.log('\n3. crossbeam_overlaps table:');
  const { count: crossbeamCount } = await supabase
    .from('crossbeam_overlaps')
    .select('*', { count: 'exact', head: true });
  console.log(`   Rows: ${crossbeamCount}`);

  if (crossbeamCount && crossbeamCount > 0) {
    const { data: crossbeamSample } = await supabase
      .from('crossbeam_overlaps')
      .select('*')
      .limit(3);
    console.log('   Sample:', JSON.stringify(crossbeamSample, null, 2));
  }

  // List all tables to see if there's anything else
  console.log('\n4. All tables in database:');
  const { data: tables, error: tablesError } = await supabase.rpc('get_all_tables');
  if (tablesError) {
    console.log('   Could not fetch table list (RPC not available)');
  } else {
    console.log('   Tables:', tables);
  }
}

main().catch(console.error);
