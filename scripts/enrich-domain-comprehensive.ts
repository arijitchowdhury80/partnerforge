/**
 * Comprehensive Domain Enrichment - Phase 2
 *
 * Fetches FULL data from BuiltWith Domain API including:
 * - All technologies (50-200 per domain) with timeline
 * - Firmographics (location, vertical, revenue band)
 * - Contact info (email, phone)
 * - Social links (LinkedIn, Twitter, Facebook, Instagram)
 * - Tech spend estimates
 * - Rankings (Alexa, Quantcast, Majestic)
 * - Company relationships
 *
 * Stores in 4 tables:
 * - companies (enhanced with firmographics)
 * - company_technologies (all techs with timeline)
 * - company_relationships (parent/child)
 * - builtwith_raw (full API response)
 *
 * Usage:
 *   npx ts-node scripts/enrich-domain-comprehensive.ts --start 0 --count 100
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds (BuiltWith: 8 concurrent, 10/sec max)

// =============================================================================
// TECH GALAXY MAPPING (from technologies reference table)
// =============================================================================

const TECH_TO_GALAXY: Record<string, { galaxy: string; our_name: string; is_competitor: boolean }> = {
  // CMS Galaxy (Partners)
  'Adobe Experience Manager': { galaxy: 'cms', our_name: 'AEM', is_competitor: false },
  'Adobe-Experience-Manager': { galaxy: 'cms', our_name: 'AEM', is_competitor: false },
  'Contentful': { galaxy: 'cms', our_name: 'Contentful', is_competitor: false },
  'Contentstack': { galaxy: 'cms', our_name: 'Contentstack', is_competitor: false },
  'Amplience': { galaxy: 'cms', our_name: 'Amplience', is_competitor: false },
  'Sitecore': { galaxy: 'cms', our_name: 'Sitecore', is_competitor: false },

  // Commerce Galaxy (Partners)
  'Salesforce Commerce Cloud': { galaxy: 'commerce', our_name: 'SFCC', is_competitor: false },
  'Salesforce-Commerce-Cloud': { galaxy: 'commerce', our_name: 'SFCC', is_competitor: false },
  'Demandware': { galaxy: 'commerce', our_name: 'SFCC', is_competitor: false },
  'Shopify Plus': { galaxy: 'commerce', our_name: 'Shopify+', is_competitor: false },
  'Shopify-Plus': { galaxy: 'commerce', our_name: 'Shopify+', is_competitor: false },
  'Magento': { galaxy: 'commerce', our_name: 'Magento', is_competitor: false },
  'Adobe Commerce': { galaxy: 'commerce', our_name: 'Magento', is_competitor: false },
  'BigCommerce': { galaxy: 'commerce', our_name: 'BigCommerce', is_competitor: false },
  'commercetools': { galaxy: 'commerce', our_name: 'Commercetools', is_competitor: false },
  'Commercetools': { galaxy: 'commerce', our_name: 'Commercetools', is_competitor: false },
  'Spryker': { galaxy: 'commerce', our_name: 'Spryker', is_competitor: false },

  // MarTech Galaxy (Partners)
  'Salesforce Marketing Cloud': { galaxy: 'martech', our_name: 'SFMC', is_competitor: false },
  'ExactTarget': { galaxy: 'martech', our_name: 'SFMC', is_competitor: false },
  'Marketo': { galaxy: 'martech', our_name: 'Marketo', is_competitor: false },
  'Adobe Marketo': { galaxy: 'martech', our_name: 'Marketo', is_competitor: false },
  'HubSpot': { galaxy: 'martech', our_name: 'HubSpot', is_competitor: false },
  'Hubspot': { galaxy: 'martech', our_name: 'HubSpot', is_competitor: false },
  'Klaviyo': { galaxy: 'martech', our_name: 'Klaviyo', is_competitor: false },

  // Search Galaxy (Competitors - DISPLACEMENT targets)
  'Elasticsearch': { galaxy: 'search', our_name: 'Elastic', is_competitor: true },
  'Elastic': { galaxy: 'search', our_name: 'Elastic', is_competitor: true },
  'ElasticSearch': { galaxy: 'search', our_name: 'Elastic', is_competitor: true },
  'ElasticPress': { galaxy: 'search', our_name: 'Elastic', is_competitor: true },
  'Apache Solr': { galaxy: 'search', our_name: 'Solr', is_competitor: true },
  'Solr': { galaxy: 'search', our_name: 'Solr', is_competitor: true },
  'Coveo': { galaxy: 'search', our_name: 'Coveo', is_competitor: true },
  'Bloomreach': { galaxy: 'search', our_name: 'Bloomreach', is_competitor: true },
  'BloomReach': { galaxy: 'search', our_name: 'Bloomreach', is_competitor: true },
  'SearchSpring': { galaxy: 'search', our_name: 'SearchSpring', is_competitor: true },
  'Searchspring': { galaxy: 'search', our_name: 'SearchSpring', is_competitor: true },
  'Lucidworks': { galaxy: 'search', our_name: 'Lucidworks', is_competitor: true },
  'Klevu': { galaxy: 'search', our_name: 'Klevu', is_competitor: true },
  'Constructor': { galaxy: 'search', our_name: 'Constructor', is_competitor: true },
  'Constructor.io': { galaxy: 'search', our_name: 'Constructor', is_competitor: true },
  'Constructor IO': { galaxy: 'search', our_name: 'Constructor', is_competitor: true },
  'ConstructorIO': { galaxy: 'search', our_name: 'Constructor', is_competitor: true },
  'Swiftype': { galaxy: 'search', our_name: 'Swiftype', is_competitor: true },
  'Doofinder': { galaxy: 'search', our_name: 'Doofinder', is_competitor: true },
  'Yext': { galaxy: 'search', our_name: 'Yext', is_competitor: true },

  // Cloud Galaxy (Partners - NO GCP, it's a competitor)
  'Amazon CloudFront': { galaxy: 'cloud', our_name: 'AWS', is_competitor: false },
  'Amazon-CloudFront': { galaxy: 'cloud', our_name: 'AWS', is_competitor: false },
  'Amazon S3': { galaxy: 'cloud', our_name: 'AWS', is_competitor: false },
  'Amazon-S3': { galaxy: 'cloud', our_name: 'AWS', is_competitor: false },
  'Amazon Web Services': { galaxy: 'cloud', our_name: 'AWS', is_competitor: false },
  'Microsoft Azure': { galaxy: 'cloud', our_name: 'Azure', is_competitor: false },
  'Microsoft-Azure': { galaxy: 'cloud', our_name: 'Azure', is_competitor: false },
  'Azure CDN': { galaxy: 'cloud', our_name: 'Azure', is_competitor: false },
};

// =============================================================================
// TYPES
// =============================================================================

interface BuiltWithTechnology {
  Name: string;
  Description?: string;
  Tag?: string;
  Categories?: string[];
  FirstDetected?: number;  // Unix timestamp (ms)
  LastDetected?: number;   // Unix timestamp (ms)
}

interface BuiltWithMeta {
  City?: string;
  State?: string;
  Country?: string;
  Postcode?: string;
  Vertical?: string;
  Telephones?: string[];
  Emails?: string[];
  Names?: string[];
  Social?: string[];  // LinkedIn, Twitter, etc URLs
  CompanyName?: string;
  Majestic?: number;
  Umbrella?: number;
  ARank?: number;  // Alexa
  QRank?: number;  // Quantcast
  QReach?: number;
  RefSN?: number;  // Referring subnets
}

interface BuiltWithSpend {
  Identifier?: string;
  MonthlyTechnologySpend?: number;
  SalesRevenue?: string;  // "10M-50M", "50M-100M", etc
}

interface BuiltWithRelationship {
  Domain?: string;
  Type?: string;  // "parent", "child", "subsidiary"
}

interface BuiltWithResult {
  Meta?: BuiltWithMeta;
  Spend?: BuiltWithSpend;
  Relationships?: BuiltWithRelationship[];
  Result?: {
    Paths?: Array<{
      Domain?: string;
      Technologies?: BuiltWithTechnology[];
      FirstIndexed?: number;
      LastIndexed?: number;
    }>;
  };
  Paths?: Array<{
    Domain?: string;
    Technologies?: BuiltWithTechnology[];
    FirstIndexed?: number;
    LastIndexed?: number;
  }>;
}

interface BuiltWithResponse {
  Results?: BuiltWithResult[];
  Errors?: Array<{ Message: string }>;
}

interface CompanyUpdate {
  // Location
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  vertical?: string;

  // Contact
  email?: string;
  phone?: string;

  // Social
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  instagram_url?: string;

  // Spend & Revenue
  monthly_tech_spend?: number;
  sales_revenue_band?: string;

  // Rankings
  alexa_rank?: number;
  quantcast_rank?: number;
  quantcast_reach?: number;
  majestic_rank?: number;
  referring_subnets?: number;

  // Timeline
  first_indexed?: string;
  last_indexed?: string;

  // Tech (simplified for quick queries)
  cms_tech?: string;
  commerce_tech?: string;
  martech_tech?: string;
  search_tech?: string;
  cloud_tech?: string;

  // Metadata
  source?: string;
  source_date?: string;
  updated_at?: string;
}

interface TechnologyInsert {
  domain: string;
  tech_name: string;
  tech_description?: string;
  tech_tag?: string;
  tech_categories?: string[];
  galaxy?: string;
  our_tech_name?: string;
  first_detected: string;
  last_detected: string;
  is_current: boolean;
}

interface RelationshipInsert {
  domain: string;
  related_domain: string;
  relationship_type: string;
  source: string;
}

// =============================================================================
// PARSE BUILTWITH RESPONSE
// =============================================================================

function extractSocialUrl(socials: string[] | undefined, platform: string): string | undefined {
  if (!socials) return undefined;
  const url = socials.find(s => s.toLowerCase().includes(platform.toLowerCase()));
  return url || undefined;
}

function parseBuiltWithResponse(
  domain: string,
  response: BuiltWithResponse
): {
  company: CompanyUpdate;
  technologies: TechnologyInsert[];
  relationships: RelationshipInsert[];
} {
  const company: CompanyUpdate = {
    source: 'builtwith-domain',
    source_date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  };
  const technologies: TechnologyInsert[] = [];
  const relationships: RelationshipInsert[] = [];

  if (!response.Results || response.Results.length === 0) {
    return { company, technologies, relationships };
  }

  const result = response.Results[0];

  // 1. Extract Meta (firmographics)
  if (result.Meta) {
    const meta = result.Meta;
    company.city = meta.City;
    company.state = meta.State;
    company.country = meta.Country;
    company.postcode = meta.Postcode;
    company.vertical = meta.Vertical;

    // Contact
    if (meta.Emails && meta.Emails.length > 0) {
      company.email = meta.Emails[0];
    }
    if (meta.Telephones && meta.Telephones.length > 0) {
      company.phone = meta.Telephones[0];
    }

    // Socials
    company.linkedin_url = extractSocialUrl(meta.Social, 'linkedin');
    company.twitter_url = extractSocialUrl(meta.Social, 'twitter');
    company.facebook_url = extractSocialUrl(meta.Social, 'facebook');
    company.instagram_url = extractSocialUrl(meta.Social, 'instagram');

    // Rankings
    company.alexa_rank = meta.ARank;
    company.quantcast_rank = meta.QRank;
    company.quantcast_reach = meta.QReach;
    company.majestic_rank = meta.Majestic;
    company.referring_subnets = meta.RefSN;
  }

  // 2. Extract Spend
  if (result.Spend) {
    company.monthly_tech_spend = result.Spend.MonthlyTechnologySpend;
    company.sales_revenue_band = result.Spend.SalesRevenue;
  }

  // 3. Extract Technologies
  const paths = result.Result?.Paths || result.Paths || [];
  const seenTechs = new Set<string>();

  for (const path of paths) {
    // Path-level timestamps
    const pathFirstIndexed = path.FirstIndexed
      ? new Date(path.FirstIndexed).toISOString()
      : new Date().toISOString();
    const pathLastIndexed = path.LastIndexed
      ? new Date(path.LastIndexed).toISOString()
      : new Date().toISOString();

    company.first_indexed = company.first_indexed || pathFirstIndexed;
    company.last_indexed = pathLastIndexed;

    if (path.Technologies) {
      for (const tech of path.Technologies) {
        // Skip duplicates within this response
        if (seenTechs.has(tech.Name)) continue;
        seenTechs.add(tech.Name);

        // Determine galaxy classification
        const mapping = TECH_TO_GALAXY[tech.Name];

        // Convert timestamps
        const firstDetected = tech.FirstDetected
          ? new Date(tech.FirstDetected).toISOString()
          : pathFirstIndexed;
        const lastDetected = tech.LastDetected
          ? new Date(tech.LastDetected).toISOString()
          : pathLastIndexed;

        technologies.push({
          domain,
          tech_name: tech.Name,
          tech_description: tech.Description,
          tech_tag: tech.Tag,
          tech_categories: tech.Categories,
          galaxy: mapping?.galaxy,
          our_tech_name: mapping?.our_name,
          first_detected: firstDetected,
          last_detected: lastDetected,
          is_current: true,
        });

        // Update simplified galaxy columns (first found wins)
        if (mapping) {
          if (mapping.galaxy === 'cms' && !company.cms_tech) {
            company.cms_tech = mapping.our_name;
          } else if (mapping.galaxy === 'commerce' && !company.commerce_tech) {
            company.commerce_tech = mapping.our_name;
          } else if (mapping.galaxy === 'martech' && !company.martech_tech) {
            company.martech_tech = mapping.our_name;
          } else if (mapping.galaxy === 'search' && !company.search_tech) {
            company.search_tech = mapping.our_name;
          } else if (mapping.galaxy === 'cloud' && !company.cloud_tech) {
            company.cloud_tech = mapping.our_name;
          }
        }
      }
    }
  }

  // 4. Extract Relationships
  if (result.Relationships) {
    for (const rel of result.Relationships) {
      if (rel.Domain && rel.Type) {
        relationships.push({
          domain,
          related_domain: rel.Domain,
          relationship_type: rel.Type.toLowerCase(),
          source: 'builtwith',
        });
      }
    }
  }

  return { company, technologies, relationships };
}

// =============================================================================
// FETCH & STORE
// =============================================================================

async function fetchDomainData(domain: string): Promise<{
  success: boolean;
  rawResponse?: BuiltWithResponse;
  error?: string;
}> {
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
          endpoint: 'v21',  // Enterprise API for full data
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

    return { success: true, rawResponse: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function storeEnrichedData(
  domain: string,
  company: CompanyUpdate,
  technologies: TechnologyInsert[],
  relationships: RelationshipInsert[],
  rawResponse: BuiltWithResponse
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update companies table
    const { error: companyError } = await supabase
      .from('companies')
      .update(company)
      .eq('domain', domain);

    if (companyError) {
      return { success: false, error: `Company update: ${companyError.message}` };
    }

    // 2. Upsert technologies (delete old, insert new)
    if (technologies.length > 0) {
      // Delete existing technologies for this domain
      await supabase
        .from('company_technologies')
        .delete()
        .eq('domain', domain);

      // Insert new technologies
      const { error: techError } = await supabase
        .from('company_technologies')
        .insert(technologies);

      if (techError) {
        console.warn(`  Tech insert warning: ${techError.message}`);
        // Don't fail the whole operation for this
      }
    }

    // 3. Upsert relationships
    if (relationships.length > 0) {
      await supabase
        .from('company_relationships')
        .delete()
        .eq('domain', domain);

      const { error: relError } = await supabase
        .from('company_relationships')
        .insert(relationships);

      if (relError) {
        console.warn(`  Relationship insert warning: ${relError.message}`);
      }
    }

    // 4. Store raw response
    const { error: rawError } = await supabase
      .from('builtwith_raw')
      .upsert({
        domain,
        api_response: rawResponse,
        api_version: 'v21',
        fetched_at: new Date().toISOString(),
      });

    if (rawError) {
      console.warn(`  Raw storage warning: ${rawError.message}`);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Store error' };
  }
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

  console.log(`\n${"=".repeat(60)}`);
  console.log(`COMPREHENSIVE DOMAIN ENRICHMENT`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Batch: ${start} to ${start + count - 1}`);
  console.log(`Rate limit: ${DELAY_BETWEEN_REQUESTS}ms between requests`);

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
  let totalTechs = 0;

  for (const company of companies) {
    const idx = start + processed + 1;
    process.stdout.write(`[${idx}] ${company.domain}... `);

    const result = await fetchDomainData(company.domain);

    if (result.success && result.rawResponse) {
      const parsed = parseBuiltWithResponse(company.domain, result.rawResponse);

      const storeResult = await storeEnrichedData(
        company.domain,
        parsed.company,
        parsed.technologies,
        parsed.relationships,
        result.rawResponse
      );

      if (storeResult.success) {
        const tags = [
          parsed.company.cms_tech,
          parsed.company.commerce_tech,
          parsed.company.martech_tech,
          parsed.company.search_tech,
          parsed.company.cloud_tech,
        ].filter(Boolean);

        totalTechs += parsed.technologies.length;

        console.log(`✓ ${parsed.technologies.length} techs | ${tags.length > 0 ? tags.join(', ') : '(no partner tech)'}`);
        if (parsed.company.monthly_tech_spend) {
          console.log(`     Spend: $${parsed.company.monthly_tech_spend}/mo | Revenue: ${parsed.company.sales_revenue_band || 'N/A'}`);
        }
        success++;
      } else {
        console.log(`✗ ${storeResult.error}`);
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

  console.log(`\n${"=".repeat(60)}`);
  console.log(`BATCH COMPLETE`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Processed: ${processed}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total technologies stored: ${totalTechs}`);
  console.log(`Average techs per company: ${success > 0 ? Math.round(totalTechs / success) : 0}`);
}

main().catch(console.error);
