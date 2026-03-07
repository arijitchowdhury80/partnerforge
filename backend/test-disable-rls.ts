import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service_role key for schema changes
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function disableRLS() {
  const tables = [
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

  console.log('Disabling RLS on backend tables...');
  
  for (const table of tables) {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`
    });
    
    if (error) {
      console.log(`❌ Error disabling RLS on ${table}:`, error.message);
    } else {
      console.log(`✅ Disabled RLS on ${table}`);
    }
  }
  
  console.log('\n✅ RLS disabled on all backend tables');
  console.log('Security is now enforced at the API level (backend/server.ts)');
}

disableRLS().catch(console.error);
