/**
 * Exhaustive BuiltWith Lists API Counter
 *
 * Paginates through all results for each technology to get exact counts.
 * Uses NextOffset pagination to bypass the 900-per-request limit.
 *
 * Usage:
 *   npx ts-node scripts/count-builtwith-exhaustive.ts
 *   npx ts-node scripts/count-builtwith-exhaustive.ts --tech Amplience
 */

const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg';

// Technologies to query
const TECHNOLOGIES = {
  cms: [
    { builtwith: 'Adobe-Experience-Manager', our: 'AEM' },
    { builtwith: 'Contentful', our: 'Contentful' },
    { builtwith: 'Contentstack', our: 'Contentstack' },
    { builtwith: 'Amplience', our: 'Amplience' },
    { builtwith: 'Sitecore CMS', our: 'Sitecore' },
  ],
  commerce: [
    { builtwith: 'Salesforce-Commerce-Cloud', our: 'SFCC' },
    { builtwith: 'Shopify-Plus', our: 'Shopify+' },
    { builtwith: 'Magento', our: 'Magento' },
    { builtwith: 'BigCommerce', our: 'BigCommerce' },
    { builtwith: 'commercetools', our: 'Commercetools' },
    { builtwith: 'Spryker', our: 'Spryker' },
  ],
  martech: [
    { builtwith: 'ExactTarget', our: 'SFMC' },
    { builtwith: 'Marketo', our: 'Marketo' },
    { builtwith: 'Hubspot', our: 'HubSpot' },
    { builtwith: 'Klaviyo', our: 'Klaviyo' },
  ],
  search: [
    { builtwith: 'Coveo', our: 'Coveo' },
    { builtwith: 'BloomReach', our: 'Bloomreach' },
    { builtwith: 'Constructor-IO', our: 'Constructor' },
    { builtwith: 'Yext', our: 'Yext' },
    { builtwith: 'Searchspring', our: 'SearchSpring' },
  ],
};

interface ListsApiResponse {
  NextOffset: string;
  Results: Array<{ D: string }>;
}

async function fetchPage(tech: string, since: string, offset?: string): Promise<ListsApiResponse> {
  const body: Record<string, string> = {
    source: 'builtwith-lists',
    tech,
    since,
  };
  if (offset) {
    body.offset = offset;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/enrich-proxy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<ListsApiResponse>;
}

async function countTech(tech: string, since: string = '365'): Promise<number> {
  let total = 0;
  let offset: string | undefined;
  let page = 1;

  while (true) {
    const data = await fetchPage(tech, since, offset);
    const count = data.Results?.length || 0;
    total += count;

    process.stdout.write(`  Page ${page}: ${count} (total: ${total})\r`);

    if (data.NextOffset === 'END' || count === 0) {
      break;
    }

    offset = data.NextOffset;
    page++;

    // Rate limiting - wait 500ms between pages
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`  Pages: ${page}, Total: ${total}                    `);
  return total;
}

async function main() {
  const args = process.argv.slice(2);
  const singleTech = args.includes('--tech') ? args[args.indexOf('--tech') + 1] : null;

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     BuiltWith Lists API - Exhaustive Count (with Pagination)   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const results: Array<{ galaxy: string; our: string; builtwith: string; count: number }> = [];

  for (const [galaxy, techs] of Object.entries(TECHNOLOGIES)) {
    console.log(`\n📊 ${galaxy.toUpperCase()} GALAXY`);
    console.log('─'.repeat(50));

    for (const tech of techs) {
      if (singleTech && tech.our !== singleTech && tech.builtwith !== singleTech) {
        continue;
      }

      console.log(`\n🔍 ${tech.our} (${tech.builtwith})`);

      try {
        const count = await countTech(tech.builtwith);
        results.push({ galaxy, our: tech.our, builtwith: tech.builtwith, count });
      } catch (err) {
        console.error(`   ❌ Error: ${err}`);
        results.push({ galaxy, our: tech.our, builtwith: tech.builtwith, count: -1 });
      }

      // Rate limiting between technologies
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary table
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY TABLE                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('| Galaxy   | Our Name      | BuiltWith Name              | Count  |');
  console.log('|----------|---------------|-----------------------------|---------:|');

  let grandTotal = 0;
  for (const r of results) {
    const countStr = r.count === -1 ? 'ERROR' : r.count.toLocaleString();
    console.log(`| ${r.galaxy.padEnd(8)} | ${r.our.padEnd(13)} | ${r.builtwith.padEnd(27)} | ${countStr.padStart(7)} |`);
    if (r.count > 0) grandTotal += r.count;
  }

  console.log('|----------|---------------|-----------------------------|---------:|');
  console.log(`| TOTAL    |               |                             | ${grandTotal.toLocaleString().padStart(7)} |`);
  console.log('\n');

  // Galaxy totals
  const galaxyTotals: Record<string, number> = {};
  for (const r of results) {
    if (r.count > 0) {
      galaxyTotals[r.galaxy] = (galaxyTotals[r.galaxy] || 0) + r.count;
    }
  }

  console.log('Galaxy Totals:');
  for (const [galaxy, total] of Object.entries(galaxyTotals)) {
    console.log(`  ${galaxy.toUpperCase()}: ${total.toLocaleString()}`);
  }
}

main().catch(console.error);
