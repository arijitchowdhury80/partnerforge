import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTables() {
  // Get all tables in public schema
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const tables = data?.map((t: any) => t.table_name).sort() || [];
  console.log('Existing tables:');
  console.log(tables.join('\n'));
  
  // Check which tables from our migration exist
  const expectedTables = [
    'companies',
    'audits',
    'company_traffic',
    'company_financials',
    'company_technologies',
    'company_competitors',
    'company_executives',
    'executive_quotes',
    'company_social_profiles',
    'company_social_posts',
    'buying_committee',
    'intent_signals',
    'company_hiring',
    'audit_log',
    'api_call_log',
    'api_error_log',
    'data_freshness',
    'search_audit_tests',
    'search_audit_screenshots',
    'displacement_opportunities',
    'partner_engagement_log',
    'company_strategic_analysis'
  ];
  
  const existingFromExpected = expectedTables.filter(t => tables.includes(t));
  const missingFromExpected = expectedTables.filter(t => !tables.includes(t));
  
  console.log('\n✅ Tables that exist:', existingFromExpected.length);
  console.log(existingFromExpected.join(', '));
  
  console.log('\n❌ Tables that do not exist:', missingFromExpected.length);
  console.log(missingFromExpected.join(', '));
}

checkTables().catch(console.error);
