/**
 * Enrich Domain Tech Stack - Phase 2
 *
 * Fetches full tech stack for each domain using BuiltWith Domain API
 * and updates the companies table with all 5 galaxies.
 *
 * Usage:
 *   npx ts-node scripts/enrich-domain-techstack.ts --start 0 --count 100
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between API calls (BuiltWith rate limit: 8 concurrent, 10/sec)

// =============================================================================
// TECH MAPPING - Map BuiltWith tech names to our galaxy columns
// =============================================================================

const CMS_MAPPING: Record<string, string> = {
  'Adobe Experience Manager': 'AEM',
  'Adobe-Experience-Manager': 'AEM',
  'AEM': 'AEM',
  'Contentful': 'Contentful',
  'Contentstack': 'Contentstack',
  'Amplience': 'Amplience',
  'Sitecore': 'Sitecore',
};

const COMMERCE_MAPPING: Record<string, string> = {
  'Salesforce Commerce Cloud': 'SFCC',
  'Salesforce-Commerce-Cloud': 'SFCC',
  'Demandware': 'SFCC',
  'Shopify Plus': 'Shopify+',
  'Shopify-Plus': 'Shopify+',
  'Magento': 'Magento',
  'Adobe Commerce': 'Magento',
  'BigCommerce': 'BigCommerce',
  'commercetools': 'Commercetools',
  'Commercetools': 'Commercetools',
  'Spryker': 'Spryker',
};

const MARTECH_MAPPING: Record<string, string> = {
  'Salesforce Marketing Cloud': 'SFMC',
  'ExactTarget': 'SFMC',
  'Marketo': 'Marketo',
  'Adobe Marketo': 'Marketo',
  'HubSpot': 'HubSpot',
  'Hubspot': 'HubSpot',
  'Klaviyo': 'Klaviyo',
};

const SEARCH_MAPPING: Record<string, string> = {
  'Elasticsearch': 'Elastic',
  'Elastic': 'Elastic',
  'ElasticSearch': 'Elastic',
  'Apache Solr': 'Solr',
  'Solr': 'Solr',
  'Coveo': 'Coveo',
  'Bloomreach': 'Bloomreach',
  'SearchSpring': 'SearchSpring',
  'Searchspring': 'SearchSpring',
  'Lucidworks': 'Lucidworks',
  'Klevu': 'Klevu',
  'Constructor': 'Constructor',
  'Constructor.io': 'Constructor',
  // Note: Algolia is excluded - those are our customers
};

const CLOUD_MAPPING: Record<string, string> = {
  'Amazon CloudFront': 'AWS',
  'Amazon-CloudFront': 'AWS',
  'Amazon S3': 'AWS',
  'Amazon-S3': 'AWS',
  'AWS': 'AWS',
  'Amazon Web Services': 'AWS',
  'Microsoft Azure': 'Azure',
  'Microsoft-Azure': 'Azure',
  'Azure': 'Azure',
  'Azure CDN': 'Azure',
  // GCP excluded - competitor
};

// =============================================================================
// TYPES
// =============================================================================

interface BuiltWithTechnology {
  Name: string;
  Tag: string;
}

interface BuiltWithResponse {
  Results?: Array<{
    Result?: {
      Paths?: Array<{
        Technologies?: BuiltWithTechnology[];
      }>;
    };
    Paths?: Array<{
      Technologies?: BuiltWithTechnology[];
    }>;
  }>;
  Errors?: Array<{ Message: string }>;
}

interface TechStack {
  cms_tech: string | null;
  commerce_tech: string | null;
  martech_tech: string | null;
  search_tech: string | null;
  cloud_tech: string | null;
}

// =============================================================================
// FETCH DOMAIN TECH STACK
// =============================================================================

async function fetchDomainTechStack(domain: string): Promise<{ success: boolean; data?: TechStack; error?: string }> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/enrich-proxy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'builtwith',
          domain: domain,
          endpoint: 'v21',  // Use enterprise API for detailed tech names
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` };
    }

    const data = await response.json() as BuiltWithResponse;

    if (data.Errors && data.Errors.length > 0) {
      return { success: false, error: data.Errors[0].Message };
    }

    // Extract technologies
    const technologies: string[] = [];
    if (data.Results) {
      for (const result of data.Results) {
        const paths = result.Result?.Paths || result.Paths || [];
        for (const path of paths) {
          if (path.Technologies) {
            technologies.push(...path.Technologies.map(t => t.Name));
          }
        }
      }
    }

    // Map to our galaxy columns
    const techStack: TechStack = {
      cms_tech: null,
      commerce_tech: null,
      martech_tech: null,
      search_tech: null,
      cloud_tech: null,
    };

    for (const tech of technologies) {
      if (!techStack.cms_tech && CMS_MAPPING[tech]) {
        techStack.cms_tech = CMS_MAPPING[tech];
      }
      if (!techStack.commerce_tech && COMMERCE_MAPPING[tech]) {
        techStack.commerce_tech = COMMERCE_MAPPING[tech];
      }
      if (!techStack.martech_tech && MARTECH_MAPPING[tech]) {
        techStack.martech_tech = MARTECH_MAPPING[tech];
      }
      if (!techStack.search_tech && SEARCH_MAPPING[tech]) {
        techStack.search_tech = SEARCH_MAPPING[tech];
      }
      if (!techStack.cloud_tech && CLOUD_MAPPING[tech]) {
        techStack.cloud_tech = CLOUD_MAPPING[tech];
      }
    }

    return { success: true, data: techStack };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// =============================================================================
// UPDATE COMPANY
// =============================================================================

async function updateCompanyTechStack(domain: string, techStack: TechStack): Promise<boolean> {
  const { error } = await supabase
    .from('companies')
    .update({
      cms_tech: techStack.cms_tech,
      commerce_tech: techStack.commerce_tech,
      martech_tech: techStack.martech_tech,
      search_tech: techStack.search_tech,
      cloud_tech: techStack.cloud_tech,
      source: 'builtwith-domain',
      source_date: new Date().toISOString().split('T')[0],
    })
    .eq('domain', domain);

  return !error;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let start = 0;
  let count = 100;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) {
      start = parseInt(args[i + 1]);
    }
    if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1]);
    }
  }

  console.log(`\n=== DOMAIN TECH STACK ENRICHMENT ===`);
  console.log(`Batch: ${start} to ${start + count - 1}`);

  // Fetch domains
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('domain')
    .order('domain')
    .range(start, start + count - 1);

  if (fetchError || !companies) {
    console.error('Failed to fetch companies:', fetchError?.message);
    process.exit(1);
  }

  console.log(`Found ${companies.length} companies to process\n`);

  let processed = 0;
  let success = 0;
  let failed = 0;

  for (const company of companies) {
    process.stdout.write(`[${start + processed + 1}] ${company.domain}... `);

    const result = await fetchDomainTechStack(company.domain);

    if (result.success && result.data) {
      const updated = await updateCompanyTechStack(company.domain, result.data);
      if (updated) {
        const tags = [
          result.data.cms_tech,
          result.data.commerce_tech,
          result.data.martech_tech,
          result.data.search_tech,
          result.data.cloud_tech,
        ].filter(Boolean);
        console.log(`✓ ${tags.length > 0 ? tags.join(', ') : '(no partner tech)'}`);
        success++;
      } else {
        console.log('✗ DB update failed');
        failed++;
      }
    } else {
      console.log(`✗ ${result.error}`);
      failed++;
    }

    processed++;

    // Rate limiting
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS));
  }

  console.log(`\n=== BATCH COMPLETE ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
