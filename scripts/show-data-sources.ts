import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function main() {
  console.log('=== DATABASE BREAKDOWN ===\n');

  // By source
  const { data: all } = await supabase
    .from('companies')
    .select('source, cms_tech');

  const bySrc: Record<string, number> = {};
  const byTech: Record<string, number> = {};

  all?.forEach((row: any) => {
    bySrc[row.source] = (bySrc[row.source] || 0) + 1;
    if (row.cms_tech) {
      byTech[row.cms_tech] = (byTech[row.cms_tech] || 0) + 1;
    }
  });

  console.log('By SOURCE:');
  Object.entries(bySrc).forEach(([src, count]) => {
    console.log(`  ${src}: ${count}`);
  });

  console.log('\nBy CMS TECH:');
  Object.entries(byTech).forEach(([tech, count]) => {
    console.log(`  ${tech}: ${count}`);
  });

  console.log(`\nTOTAL: ${all?.length || 0} companies`);
}

main().catch(console.error);
