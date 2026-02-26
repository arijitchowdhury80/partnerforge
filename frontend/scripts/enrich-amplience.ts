#!/usr/bin/env npx tsx
/**
 * Batch Enrichment Script for Amplience Customers
 *
 * Usage: npx tsx scripts/enrich-amplience.ts
 *
 * This script enriches all Amplience customers with:
 * - SimilarWeb traffic data
 * - BuiltWith tech stack
 * - Competitor analysis
 * - JSearch hiring signals (2,000/month quota)
 */

// Load environment variables from .env
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;
const SIMILARWEB_API_KEY = process.env.VITE_SIMILARWEB_API_KEY;
const BUILTWITH_API_KEY = process.env.VITE_BUILTWITH_API_KEY;
const JSEARCH_API_KEY = process.env.VITE_JSEARCH_API_KEY;

console.log('='.repeat(60));
console.log('PARTNERFORGE BATCH ENRICHMENT - AMPLIENCE CUSTOMERS');
console.log('='.repeat(60));
console.log(`Supabase: ${SUPABASE_URL ? '✓' : '✗'}`);
console.log(`SimilarWeb API: ${SIMILARWEB_API_KEY ? '✓' : '✗'}`);
console.log(`BuiltWith API: ${BUILTWITH_API_KEY ? '✓' : '✗'}`);
console.log(`JSearch API: ${JSEARCH_API_KEY ? '✓' : '✗'}`);
console.log('='.repeat(60));

if (!SUPABASE_KEY) {
  console.error('ERROR: VITE_SUPABASE_SERVICE_KEY or VITE_SUPABASE_KEY required');
  process.exit(1);
}

// =============================================================================
// Tier and Category Classification (same as enrichment.ts)
// =============================================================================

const TIER_1_PATTERNS = [
  /\b(vp|vice president)\b/i,
  /\b(cto|cio|cdo|cmo|cco|coo|ceo)\b/i,
  /\bchief\s+\w+\s+officer\b/i,
  /\bhead\s+of\b/i,
  /\bsvp|senior\s+vice\s+president\b/i,
  /\bdirector\b/i,
  /\bprincipal\b/i,
  /\bco-?founder\b/i,
];

const TIER_2_PATTERNS = [
  /\bsenior\s+manager\b/i,
  /\bmanager\b/i,
  /\blead\b/i,
  /\barchitect\b/i,
  /\bsenior\s+product\b/i,
  /\bproduct\s+manager\b/i,
  /\bproduct\s+owner\b/i,
];

const RELEVANT_CATEGORIES: Record<string, string[]> = {
  'search': ['search', 'discovery', 'relevance', 'findability', 'browse', 'catalog', 'autocomplete'],
  'e-commerce': ['ecommerce', 'e-commerce', 'commerce', 'merchandis', 'online store', 'digital commerce'],
  'product': ['product manager', 'product owner', 'product lead', 'product director'],
  'engineering': ['engineer', 'developer', 'architect', 'devops', 'software', 'sre', 'platform'],
  'data': ['data scientist', 'data engineer', 'analytics', 'ai', 'ml', 'machine learning', 'nlp'],
  'digital-cx': ['customer experience', 'cx', 'ux', 'user experience', 'digital experience'],
  'merchandising': ['merchandis', 'category manager', 'assortment', 'pricing', 'site merchandis'],
};

function classifyJobTier(title: string): number {
  for (const pattern of TIER_1_PATTERNS) {
    if (pattern.test(title)) return 1;
  }
  for (const pattern of TIER_2_PATTERNS) {
    if (pattern.test(title)) return 2;
  }
  return 3;
}

function classifyJobCategories(title: string): string[] {
  const titleLower = title.toLowerCase();
  const categories: string[] = [];
  for (const [category, keywords] of Object.entries(RELEVANT_CATEGORIES)) {
    if (keywords.some(kw => titleLower.includes(kw))) {
      categories.push(category);
    }
  }
  return categories;
}

function calculateSignalScore(
  tierBreakdown: { tier_1: number; tier_2: number; tier_3: number },
  categoryBreakdown: Record<string, number>
): number {
  let score = 0;
  score += Math.min(60, tierBreakdown.tier_1 * 30);
  score += Math.min(45, tierBreakdown.tier_2 * 15);
  score += Math.min(20, tierBreakdown.tier_3 * 5);
  if ((categoryBreakdown['search'] || 0) > 0) score += 25;
  if ((categoryBreakdown['e-commerce'] || 0) > 0) score += 15;
  if ((categoryBreakdown['merchandising'] || 0) > 0) score += 10;
  return Math.min(100, score);
}

function getSignalStrength(score: number): 'strong' | 'moderate' | 'weak' | 'none' {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'moderate';
  if (score >= 15) return 'weak';
  return 'none';
}

// =============================================================================
// API Functions
// =============================================================================

interface AmplenceCustomer {
  domain: string;
  company_name: string;
  icp_score: number;
  hiring_fetched_at: string | null;
}

async function getAmplienceCustomers(): Promise<AmplenceCustomer[]> {
  // CRITICAL: Exclude Algolia customers - displacement targets only
  const url = `${SUPABASE_URL}/rest/v1/displacement_targets?partner_tech=ilike.*Amplience*&or=(current_search.is.null,current_search.neq.Algolia)&select=domain,company_name,icp_score,hiring_fetched_at&order=icp_score.desc`;

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  return response.json();
}

async function fetchJSearchHiring(companyName: string): Promise<{
  signal_score: number;
  signal_strength: 'strong' | 'moderate' | 'weak' | 'none';
  total_jobs_found: number;
  relevant_jobs: number;
  tier_breakdown: { tier_1: number; tier_2: number; tier_3: number };
  category_breakdown: Record<string, number>;
  top_jobs: Array<{ title: string; tier: number; categories: string[] }>;
} | null> {
  if (!JSEARCH_API_KEY) {
    console.log('  [SKIP] No JSearch API key');
    return null;
  }

  const query = encodeURIComponent(`${companyName} jobs`);
  const url = `https://jsearch.p.rapidapi.com/search?query=${query}&num_pages=2`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': JSEARCH_API_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      console.log(`  [ERROR] JSearch API ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.data) {
      console.log('  [WARN] JSearch returned no data');
      return null;
    }

    // Filter jobs to this company
    const companyLower = companyName.toLowerCase();
    const companyJobs = data.data.filter((job: any) =>
      job.employer_name?.toLowerCase().includes(companyLower)
    );

    if (companyJobs.length === 0) {
      return {
        signal_score: 0,
        signal_strength: 'none',
        total_jobs_found: 0,
        relevant_jobs: 0,
        tier_breakdown: { tier_1: 0, tier_2: 0, tier_3: 0 },
        category_breakdown: {},
        top_jobs: [],
      };
    }

    // Analyze jobs
    const tierBreakdown = { tier_1: 0, tier_2: 0, tier_3: 0 };
    const categoryBreakdown: Record<string, number> = {};
    const matchedJobs: Array<{ title: string; tier: number; categories: string[] }> = [];

    for (const job of companyJobs) {
      const title = job.job_title;
      if (!title) continue;

      const tier = classifyJobTier(title);
      const categories = classifyJobCategories(title);

      if (categories.length > 0) {
        tierBreakdown[`tier_${tier}` as keyof typeof tierBreakdown]++;
        for (const cat of categories) {
          categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
        }
        matchedJobs.push({ title, tier, categories });
      }
    }

    matchedJobs.sort((a, b) => a.tier - b.tier);
    const signalScore = calculateSignalScore(tierBreakdown, categoryBreakdown);

    return {
      signal_score: signalScore,
      signal_strength: getSignalStrength(signalScore),
      total_jobs_found: companyJobs.length,
      relevant_jobs: matchedJobs.length,
      tier_breakdown: tierBreakdown,
      category_breakdown: categoryBreakdown,
      top_jobs: matchedJobs.slice(0, 20),
    };
  } catch (err) {
    console.log(`  [ERROR] JSearch: ${err}`);
    return null;
  }
}

async function updateSupabase(domain: string, data: Record<string, unknown>): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.${encodeURIComponent(domain)}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY!,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        ...data,
        last_enriched: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.log(`  [ERROR] Supabase update: ${await response.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.log(`  [ERROR] Supabase: ${err}`);
    return false;
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  // Get all Amplience customers
  const customers = await getAmplienceCustomers();
  console.log(`\nFound ${customers.length} Amplience customers\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const progress = `[${i + 1}/${customers.length}]`;

    // Skip if already has hiring data
    if (customer.hiring_fetched_at) {
      console.log(`${progress} ${customer.company_name} - SKIPPED (already enriched)`);
      skippedCount++;
      continue;
    }

    console.log(`${progress} ${customer.company_name} (${customer.domain})`);

    // Fetch hiring signals
    const hiringData = await fetchJSearchHiring(customer.company_name);

    if (hiringData) {
      const updateData = {
        hiring_signal_score: hiringData.signal_score,
        hiring_signal_strength: hiringData.signal_strength,
        hiring_total_jobs: hiringData.total_jobs_found,
        hiring_relevant_jobs: hiringData.relevant_jobs,
        hiring_tier_breakdown: hiringData.tier_breakdown,
        hiring_category_breakdown: hiringData.category_breakdown,
        hiring_top_jobs: hiringData.top_jobs,
        hiring_fetched_at: new Date().toISOString(),
      };

      const updated = await updateSupabase(customer.domain, updateData);

      if (updated) {
        console.log(`  ✓ ${hiringData.signal_strength.toUpperCase()} (score: ${hiringData.signal_score}, ${hiringData.relevant_jobs} relevant jobs)`);
        successCount++;
      } else {
        errorCount++;
      }
    } else {
      // Still mark as fetched even if no data
      await updateSupabase(customer.domain, {
        hiring_signal_score: 0,
        hiring_signal_strength: 'none',
        hiring_total_jobs: 0,
        hiring_relevant_jobs: 0,
        hiring_tier_breakdown: { tier_1: 0, tier_2: 0, tier_3: 0 },
        hiring_category_breakdown: {},
        hiring_top_jobs: [],
        hiring_fetched_at: new Date().toISOString(),
      });
      console.log(`  - No hiring data found`);
      successCount++;
    }

    // Rate limiting: 1 second between API calls
    if (i < customers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('BATCH ENRICHMENT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Total API calls: ${successCount} (of 2,000/month quota)`);
}

main().catch(console.error);
