import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function main() {
  console.log('ANALYZING TECHNOLOGY COMPOSITION OF 14,614 COMPANIES\n');

  // Fetch ALL companies
  let allCompanies: any[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data } = await supabase
      .from('companies')
      .select('domain, cms_tech, commerce_tech, martech_tech, search_tech, cloud_tech')
      .range(offset, offset + limit - 1);

    if (!data || data.length === 0) break;

    allCompanies = allCompanies.concat(data);
    offset += limit;

    if (data.length < limit) break;
  }

  console.log(`Total companies: ${allCompanies.length}\n`);

  // Count by each tech category
  const cms: Record<string, number> = {};
  const commerce: Record<string, number> = {};
  const martech: Record<string, number> = {};
  const search: Record<string, number> = {};
  const cloud: Record<string, number> = {};

  allCompanies.forEach(c => {
    if (c.cms_tech) cms[c.cms_tech] = (cms[c.cms_tech] || 0) + 1;

    if (c.commerce_tech) {
      const techs = Array.isArray(c.commerce_tech) ? c.commerce_tech : [c.commerce_tech];
      techs.forEach((t: string) => {
        commerce[t] = (commerce[t] || 0) + 1;
      });
    }

    if (c.martech_tech) {
      const techs = Array.isArray(c.martech_tech) ? c.martech_tech : [c.martech_tech];
      techs.forEach((t: string) => {
        martech[t] = (martech[t] || 0) + 1;
      });
    }

    if (c.search_tech) {
      const techs = Array.isArray(c.search_tech) ? c.search_tech : [c.search_tech];
      techs.forEach((t: string) => {
        search[t] = (search[t] || 0) + 1;
      });
    }

    if (c.cloud_tech) {
      const techs = Array.isArray(c.cloud_tech) ? c.cloud_tech : [c.cloud_tech];
      techs.forEach((t: string) => {
        cloud[t] = (cloud[t] || 0) + 1;
      });
    }
  });

  console.log('CMS TECHNOLOGIES:');
  Object.entries(cms).sort((a, b) => b[1] - a[1]).forEach(([tech, count]) => {
    console.log(`  ${count.toString().padStart(6)} - ${tech}`);
  });

  console.log('\nCOMMERCE TECHNOLOGIES:');
  Object.entries(commerce).sort((a, b) => b[1] - a[1]).forEach(([tech, count]) => {
    console.log(`  ${count.toString().padStart(6)} - ${tech}`);
  });

  console.log('\nMARTECH TECHNOLOGIES:');
  Object.entries(martech).sort((a, b) => b[1] - a[1]).forEach(([tech, count]) => {
    console.log(`  ${count.toString().padStart(6)} - ${tech}`);
  });

  console.log('\nSEARCH TECHNOLOGIES:');
  Object.entries(search).sort((a, b) => b[1] - a[1]).forEach(([tech, count]) => {
    console.log(`  ${count.toString().padStart(6)} - ${tech}`);
  });

  console.log('\nCLOUD TECHNOLOGIES:');
  Object.entries(cloud).sort((a, b) => b[1] - a[1]).forEach(([tech, count]) => {
    console.log(`  ${count.toString().padStart(6)} - ${tech}`);
  });

  // Count companies with commerce tech (most likely retail/e-commerce)
  const withCommerce = allCompanies.filter(c => c.commerce_tech && (Array.isArray(c.commerce_tech) ? c.commerce_tech.length > 0 : c.commerce_tech));
  console.log(`\n\nCOMPANIES WITH COMMERCE TECH: ${withCommerce.length} (${((withCommerce.length/allCompanies.length)*100).toFixed(1)}%)`);
  console.log('These are most likely retail/e-commerce companies.\n');
}

main().catch(console.error);
