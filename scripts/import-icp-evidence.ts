/**
 * Import ICP Evidence Data to Supabase
 *
 * Reads customerEvidence.json and imports all companies, quotes, and features
 * to the ICP tables in Supabase.
 *
 * Usage: npx tsx scripts/import-icp-evidence.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is required');
  console.log('Set it via: export SUPABASE_SERVICE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Types from customerEvidenceTypes.ts
interface Quote {
  text: string;
  speaker: string;
  title: string;
  source: string;
}

interface CustomerEvidence {
  company: string;
  storyUrl: string | null;
  industry: string;
  useCase: string;
  country: string;
  region: string;
  featuresUsed: string[];
  quotes: Quote[];
  metrics: string[];
}

interface CustomerEvidenceData {
  companies: CustomerEvidence[];
}

// Industry normalization mapping
function normalizeIndustry(rawIndustry: string): string {
  const lower = rawIndustry.toLowerCase();

  if (lower.includes('fashion') || lower.includes('apparel') || lower.includes('clothing') || lower.includes('streetwear') || lower.includes('fitness') || lower.includes('luxury')) {
    return 'fashion-apparel';
  }
  if (lower.includes('grocery') || lower.includes('food')) {
    return 'grocery-food';
  }
  if (lower.includes('saas') || lower.includes('software')) {
    return 'saas';
  }
  if (lower.includes('b2b')) {
    return 'b2b-ecommerce';
  }
  if (lower.includes('media') || lower.includes('publishing')) {
    return 'media-publishing';
  }
  if (lower.includes('retail') || lower.includes('e-comm') || lower.includes('ecomm') || lower.includes('commerce')) {
    return 'retail-ecommerce';
  }
  if (lower.includes('health') || lower.includes('pharmacy')) {
    return 'healthcare';
  }
  return 'other';
}

// Feature normalization mapping
function normalizeFeature(rawFeature: string): string {
  const lower = rawFeature.toLowerCase().replace(/[^a-z]/g, '');

  const mapping: Record<string, string> = {
    'neuralsearch': 'neuralsearch',
    'personalization': 'personalization',
    'rules': 'rules',
    'recommend': 'recommend',
    'analytics': 'analytics',
    'abtesting': 'ab-testing',
    'browse': 'browse',
    'autocomplete': 'autocomplete',
    'drr': 'drr',
    'dynamicreranking': 'drr',
  };

  return mapping[lower] || null;
}

// Determine evidence tier based on data completeness
function calculateEvidenceTier(company: CustomerEvidence): 'GOLD' | 'SILVER' | 'BRONZE' {
  let score = 0;

  if (company.quotes.length > 0) score++;
  if (company.storyUrl) score++;
  if (company.featuresUsed.length > 0) score++;
  if (company.metrics.length > 0) score++;

  if (score >= 3) return 'GOLD';
  if (score >= 2) return 'SILVER';
  return 'BRONZE';
}

async function main() {
  console.log('📊 ICP Evidence Data Import');
  console.log('=' .repeat(50));

  // 1. Load JSON data
  const jsonPath = path.resolve(__dirname, '../frontend/src/data/customerEvidence.json');
  console.log(`\n📁 Loading data from: ${jsonPath}`);

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const data: CustomerEvidenceData = JSON.parse(rawData);

  console.log(`   Found ${data.companies.length} companies`);
  const totalQuotes = data.companies.reduce((sum, c) => sum + c.quotes.length, 0);
  console.log(`   Found ${totalQuotes} quotes`);

  // 2. Fetch existing industry and feature IDs
  console.log('\n📌 Fetching industry and feature mappings...');

  const { data: industries } = await supabase.from('icp_industries').select('id, name');
  const { data: features } = await supabase.from('icp_features').select('id, name');

  const industryMap = new Map(industries?.map(i => [i.name, i.id]) || []);
  const featureMap = new Map(features?.map(f => [f.name, f.id]) || []);

  console.log(`   Industries: ${industryMap.size}`);
  console.log(`   Features: ${featureMap.size}`);

  // 3. Process and insert companies
  console.log('\n🏢 Importing companies...');

  let companiesInserted = 0;
  let companiesSkipped = 0;
  let quotesInserted = 0;
  let featuresLinked = 0;
  let metricsInserted = 0;

  for (const company of data.companies) {
    // Normalize industry
    const industryKey = normalizeIndustry(company.industry);
    const industryId = industryMap.get(industryKey);

    // Calculate tier
    const evidenceTier = calculateEvidenceTier(company);

    // Insert company
    const { data: insertedCompany, error: companyError } = await supabase
      .from('icp_companies')
      .upsert({
        company_name: company.company,
        story_url: company.storyUrl || null,
        industry_id: industryId,
        industry_raw: company.industry,
        use_case: company.useCase,
        country: company.country,
        region: company.region,
        evidence_tier: evidenceTier,
      }, {
        onConflict: 'company_name',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    if (companyError) {
      console.error(`   ❌ Error inserting ${company.company}: ${companyError.message}`);
      companiesSkipped++;
      continue;
    }

    companiesInserted++;
    const companyId = insertedCompany.id;

    // Insert quotes
    for (const quote of company.quotes) {
      const { error: quoteError } = await supabase
        .from('icp_quotes')
        .insert({
          company_id: companyId,
          quote_text: quote.text.replace(/[""]/g, '"'), // Normalize quotes
          speaker_name: quote.speaker,
          speaker_title: quote.title,
          source: quote.source,
        });

      if (!quoteError) {
        quotesInserted++;
      }
    }

    // Link features
    for (const rawFeature of company.featuresUsed) {
      const featureKey = normalizeFeature(rawFeature);
      const featureId = featureMap.get(featureKey);

      if (featureId) {
        const { error: linkError } = await supabase
          .from('icp_company_features')
          .insert({
            company_id: companyId,
            feature_id: featureId,
          });

        if (!linkError) {
          featuresLinked++;
        }
      }
    }

    // Insert metrics
    for (const metric of company.metrics) {
      const { error: metricError } = await supabase
        .from('icp_metrics')
        .insert({
          company_id: companyId,
          metric_text: metric,
        });

      if (!metricError) {
        metricsInserted++;
      }
    }

    // Progress indicator
    if (companiesInserted % 20 === 0) {
      console.log(`   Processed ${companiesInserted}/${data.companies.length} companies...`);
    }
  }

  // 4. Summary
  console.log('\n' + '=' .repeat(50));
  console.log('✅ Import Complete!');
  console.log('=' .repeat(50));
  console.log(`   Companies inserted: ${companiesInserted}`);
  console.log(`   Companies skipped:  ${companiesSkipped}`);
  console.log(`   Quotes inserted:    ${quotesInserted}`);
  console.log(`   Features linked:    ${featuresLinked}`);
  console.log(`   Metrics inserted:   ${metricsInserted}`);

  // 5. Verify with summary view
  console.log('\n📈 Database Summary:');
  const { data: summary } = await supabase.from('icp_summary').select('*').single();
  if (summary) {
    console.log(`   Total companies:     ${summary.total_companies}`);
    console.log(`   With stories:        ${summary.with_stories}`);
    console.log(`   Total quotes:        ${summary.total_quotes}`);
    console.log(`   Companies w/ quotes: ${summary.companies_with_quotes}`);
    console.log(`   GOLD tier:           ${summary.gold_tier}`);
    console.log(`   SILVER tier:         ${summary.silver_tier}`);
    console.log(`   BRONZE tier:         ${summary.bronze_tier}`);
  }
}

main().catch(console.error);
