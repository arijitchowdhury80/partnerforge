import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function main() {
  // Sample from companies table
  const { data, error } = await supabase
    .from('companies')
    .select('domain, company_name, cms_tech, commerce_tech, martech_tech, search_tech, cloud_tech')
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));

  // Count by partner tech
  console.log('\n\n=== COUNTS BY PARTNER TECH ===\n');

  const techs = ['AEM', 'Contentful', 'Contentstack', 'Amplience', 'SFCC', 'Shopify+', 'Magento'];

  for (const tech of techs) {
    const { count: cmsCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .ilike('cms_tech', `%${tech}%`);

    const { count: commerceCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .ilike('commerce_tech', `%${tech}%`);

    const total = (cmsCount || 0) + (commerceCount || 0);
    if (total > 0) {
      console.log(`${tech}: ${total.toLocaleString()}`);
    }
  }
}

main().catch(console.error);
