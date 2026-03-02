import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function main() {
  console.log('Analyzing what industries Yahoo Finance found in our 919 companies...\n');

  const { data: all } = await supabase
    .from('companies')
    .select('domain, yf_industry, yf_sector, commerce_tech, cms_tech');

  if (!all) {
    console.log('No data');
    return;
  }

  // Filter to companies with industry data
  const withIndustry = all.filter(c => c.yf_industry || c.yf_sector);
  const withCommerce = all.filter(c => c.commerce_tech);

  console.log(`Total companies: ${all.length}`);
  console.log(`With Yahoo Finance industry: ${withIndustry.length}`);
  console.log(`With commerce tech: ${withCommerce.length}\n`);

  // Count by industry
  const byIndustry: Record<string, number> = {};
  withIndustry.forEach(c => {
    const ind = c.yf_industry || c.yf_sector || 'Unknown';
    byIndustry[ind] = (byIndustry[ind] || 0) + 1;
  });

  console.log('TOP 30 INDUSTRIES (Yahoo Finance):');
  Object.entries(byIndustry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .forEach(([ind, count]) => {
      console.log(`  ${count.toString().padStart(4)} - ${ind}`);
    });

  // Check commerce tech distribution
  console.log('\n\nCOMMERCE TECH DISTRIBUTION:');
  const commerceTypes: Record<string, number> = {};
  withCommerce.forEach(c => {
    const tech = JSON.stringify(c.commerce_tech);
    commerceTypes[tech] = (commerceTypes[tech] || 0) + 1;
  });

  Object.entries(commerceTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([tech, count]) => {
      console.log(`  ${count.toString().padStart(4)} - ${tech}`);
    });
}

main().catch(console.error);
