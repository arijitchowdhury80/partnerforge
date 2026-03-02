import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function main() {
  const suspects = ['decathlon.fr', 'decathlon.com', 'newbalance.com', 'hallmark.com', 'hermanmiller.com'];

  console.log('Checking if these domains have Algolia search_tech:\n');

  for (const domain of suspects) {
    const { data } = await supabase
      .from('companies')
      .select('domain, search_tech')
      .eq('domain', domain)
      .limit(1);

    if (data && data.length > 0) {
      const searchTech = data[0].search_tech;
      const hasAlgolia = searchTech && (
        Array.isArray(searchTech) ? searchTech.includes('Algolia') : searchTech === 'Algolia'
      );

      console.log(`${domain.padEnd(25)} - search_tech: ${JSON.stringify(searchTech)} ${hasAlgolia ? '⚠️  ALGOLIA CUSTOMER!' : ''}`);
    } else {
      console.log(`${domain.padEnd(25)} - NOT FOUND in database`);
    }
  }
}

main().catch(console.error);
