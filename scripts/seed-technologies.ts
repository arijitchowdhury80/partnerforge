/**
 * Seed the technologies reference table
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TECHNOLOGIES = [
  // CMS Galaxy (Partners)
  { builtwith_name: 'Adobe Experience Manager', our_name: 'AEM', galaxy: 'cms', is_partner: true, is_competitor: false, partner_name: 'Adobe', priority: 100 },
  { builtwith_name: 'Adobe-Experience-Manager', our_name: 'AEM', galaxy: 'cms', is_partner: true, is_competitor: false, partner_name: 'Adobe', priority: 100 },
  { builtwith_name: 'Contentful', our_name: 'Contentful', galaxy: 'cms', is_partner: true, is_competitor: false, partner_name: 'Contentful', priority: 90 },
  { builtwith_name: 'Contentstack', our_name: 'Contentstack', galaxy: 'cms', is_partner: true, is_competitor: false, partner_name: 'Contentstack', priority: 85 },
  { builtwith_name: 'Amplience', our_name: 'Amplience', galaxy: 'cms', is_partner: true, is_competitor: false, partner_name: 'Amplience', priority: 80 },
  { builtwith_name: 'Sitecore', our_name: 'Sitecore', galaxy: 'cms', is_partner: true, is_competitor: false, partner_name: 'Sitecore', priority: 75 },

  // Commerce Galaxy (Partners)
  { builtwith_name: 'Salesforce Commerce Cloud', our_name: 'SFCC', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'Salesforce', priority: 100 },
  { builtwith_name: 'Salesforce-Commerce-Cloud', our_name: 'SFCC', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'Salesforce', priority: 100 },
  { builtwith_name: 'Demandware', our_name: 'SFCC', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'Salesforce', priority: 100 },
  { builtwith_name: 'Shopify Plus', our_name: 'Shopify+', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'Shopify', priority: 95 },
  { builtwith_name: 'Shopify-Plus', our_name: 'Shopify+', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'Shopify', priority: 95 },
  { builtwith_name: 'Magento', our_name: 'Magento', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'Adobe', priority: 90 },
  { builtwith_name: 'Adobe Commerce', our_name: 'Magento', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'Adobe', priority: 90 },
  { builtwith_name: 'BigCommerce', our_name: 'BigCommerce', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'BigCommerce', priority: 85 },
  { builtwith_name: 'commercetools', our_name: 'Commercetools', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'commercetools', priority: 80 },
  { builtwith_name: 'Commercetools', our_name: 'Commercetools', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'commercetools', priority: 80 },
  { builtwith_name: 'Spryker', our_name: 'Spryker', galaxy: 'commerce', is_partner: true, is_competitor: false, partner_name: 'Spryker', priority: 75 },

  // MarTech Galaxy (Partners)
  { builtwith_name: 'Salesforce Marketing Cloud', our_name: 'SFMC', galaxy: 'martech', is_partner: true, is_competitor: false, partner_name: 'Salesforce', priority: 100 },
  { builtwith_name: 'ExactTarget', our_name: 'SFMC', galaxy: 'martech', is_partner: true, is_competitor: false, partner_name: 'Salesforce', priority: 100 },
  { builtwith_name: 'Marketo', our_name: 'Marketo', galaxy: 'martech', is_partner: true, is_competitor: false, partner_name: 'Adobe', priority: 95 },
  { builtwith_name: 'Adobe Marketo', our_name: 'Marketo', galaxy: 'martech', is_partner: true, is_competitor: false, partner_name: 'Adobe', priority: 95 },
  { builtwith_name: 'HubSpot', our_name: 'HubSpot', galaxy: 'martech', is_partner: true, is_competitor: false, partner_name: 'HubSpot', priority: 90 },
  { builtwith_name: 'Hubspot', our_name: 'HubSpot', galaxy: 'martech', is_partner: true, is_competitor: false, partner_name: 'HubSpot', priority: 90 },
  { builtwith_name: 'Klaviyo', our_name: 'Klaviyo', galaxy: 'martech', is_partner: true, is_competitor: false, partner_name: 'Klaviyo', priority: 85 },

  // Search Galaxy (COMPETITORS)
  { builtwith_name: 'Elasticsearch', our_name: 'Elastic', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 100 },
  { builtwith_name: 'Elastic', our_name: 'Elastic', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 100 },
  { builtwith_name: 'ElasticSearch', our_name: 'Elastic', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 100 },
  { builtwith_name: 'Apache Solr', our_name: 'Solr', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 95 },
  { builtwith_name: 'Solr', our_name: 'Solr', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 95 },
  { builtwith_name: 'Coveo', our_name: 'Coveo', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 90 },
  { builtwith_name: 'Bloomreach', our_name: 'Bloomreach', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 85 },
  { builtwith_name: 'SearchSpring', our_name: 'SearchSpring', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 80 },
  { builtwith_name: 'Searchspring', our_name: 'SearchSpring', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 80 },
  { builtwith_name: 'Lucidworks', our_name: 'Lucidworks', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 75 },
  { builtwith_name: 'Klevu', our_name: 'Klevu', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 70 },
  { builtwith_name: 'Constructor', our_name: 'Constructor', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 65 },
  { builtwith_name: 'Constructor.io', our_name: 'Constructor', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 65 },
  { builtwith_name: 'Swiftype', our_name: 'Swiftype', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 60 },
  { builtwith_name: 'Doofinder', our_name: 'Doofinder', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 55 },
  { builtwith_name: 'Yext', our_name: 'Yext', galaxy: 'search', is_partner: false, is_competitor: true, partner_name: null, priority: 50 },

  // Cloud Galaxy (Partners - NO GCP)
  { builtwith_name: 'Amazon CloudFront', our_name: 'AWS', galaxy: 'cloud', is_partner: true, is_competitor: false, partner_name: 'AWS', priority: 100 },
  { builtwith_name: 'Amazon-CloudFront', our_name: 'AWS', galaxy: 'cloud', is_partner: true, is_competitor: false, partner_name: 'AWS', priority: 100 },
  { builtwith_name: 'Amazon S3', our_name: 'AWS', galaxy: 'cloud', is_partner: true, is_competitor: false, partner_name: 'AWS', priority: 100 },
  { builtwith_name: 'Amazon-S3', our_name: 'AWS', galaxy: 'cloud', is_partner: true, is_competitor: false, partner_name: 'AWS', priority: 100 },
  { builtwith_name: 'Amazon Web Services', our_name: 'AWS', galaxy: 'cloud', is_partner: true, is_competitor: false, partner_name: 'AWS', priority: 100 },
  { builtwith_name: 'Microsoft Azure', our_name: 'Azure', galaxy: 'cloud', is_partner: true, is_competitor: false, partner_name: 'Microsoft', priority: 95 },
  { builtwith_name: 'Microsoft-Azure', our_name: 'Azure', galaxy: 'cloud', is_partner: true, is_competitor: false, partner_name: 'Microsoft', priority: 95 },
  { builtwith_name: 'Azure CDN', our_name: 'Azure', galaxy: 'cloud', is_partner: true, is_competitor: false, partner_name: 'Microsoft', priority: 95 },
];

async function main() {
  console.log("Seeding technologies table...");
  console.log(`Inserting ${TECHNOLOGIES.length} records`);

  // Try upsert
  const { data, error } = await supabase
    .from('technologies')
    .upsert(TECHNOLOGIES, { onConflict: 'builtwith_name' })
    .select();

  if (error) {
    console.error("Error:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
  } else {
    console.log(`Success! Inserted/updated ${data?.length || 0} records`);
  }

  // Verify
  const { count } = await supabase
    .from('technologies')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal rows in technologies table: ${count}`);
}

main().catch(console.error);
