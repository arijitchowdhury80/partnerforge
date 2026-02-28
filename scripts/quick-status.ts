import { createClient } from "@supabase/supabase-js";
const supabase = createClient('https://xbitqeejsgqnwvxlnjra.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg');

async function check() {
  const { count: total } = await supabase.from('companies').select('*', { count: 'exact', head: true });
  const { count: enriched } = await supabase.from('companies').select('*', { count: 'exact', head: true }).eq('source', 'builtwith-domain');
  const { count: techs } = await supabase.from('company_technologies').select('*', { count: 'exact', head: true });
  const { count: raw } = await supabase.from('builtwith_raw').select('*', { count: 'exact', head: true });

  console.log('=== ENRICHMENT STATUS ===');
  console.log('Total companies:', total);
  console.log('Enriched (builtwith-domain):', enriched);
  console.log('Technologies stored:', techs);
  console.log('Raw responses stored:', raw);
  console.log('Remaining:', (total || 0) - (enriched || 0));
}
check().catch(console.error);
