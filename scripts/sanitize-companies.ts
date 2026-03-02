/**
 * SANITIZE COMPANIES - 3-Phase Quality Filter
 *
 * Takes 14,614 companies from BuiltWith and filters to high-quality displacement targets
 *
 * Phase 1: Domain Quality Filter (FREE)
 *   - TLD whitelist (.com, .co, .org, etc.)
 *   - Remove spam keywords (bet, casino, free, etc.)
 *   - Exclusion list (Amazon, Google, Meta, etc.)
 *   - Invalid patterns (>50 chars, all numbers, etc.)
 *
 * Phase 2: Traffic Validation (MEDIUM COST ~8K-10K calls)
 *   - SimilarWeb API: monthly visits
 *   - Keep domains with >100K monthly visits
 *
 * Phase 3: Industry Classification (Yahoo Finance MCP)
 *   - Yahoo Finance API: get industry/sector classification for public companies
 *   - Stores ticker, yf_industry, yf_sector in database for ICP filtering
 *
 * Expected Output: ~1,500-2,500 qualified targets
 */

import { createClient } from '@supabase/supabase-js';
import yahooFinance from 'yahoo-finance2';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================================================
// CONFIGURATION
// =============================================================================

// TLD Whitelist - Keep only these top-level domains
// NOTE: Excludes .org, .edu, .gov, .mil (non-commercial/government)
const ALLOWED_TLDS = [
  // Generic TLDs (COMMERCIAL ONLY)
  'com', 'co', 'io', 'ai', 'net', 'biz', 'info',
  // Country codes (major markets - English-speaking)
  'uk', 'us', 'ca', 'au', 'nz', 'ie',
  // Country codes (Europe)
  'de', 'fr', 'nl', 'es', 'it', 'se', 'no', 'dk', 'fi', 'ch', 'at', 'be',
  'eu', 'pl', 'pt', 'gr', 'cz', 'ro', 'hu',
  // Country codes (Asia-Pacific)
  'jp', 'kr', 'sg', 'hk', 'tw', 'in',
  // Country codes (Latin America)
  'br', 'mx', 'ar', 'cl', 'co',
  // Country codes (Middle East/Africa)
  'ae', 'za', 'il',
];

// Spam Keywords - Drop domains containing these
const SPAM_KEYWORDS = [
  'bet', 'casino', 'poker', 'gambling', 'free', 'gift', 'win', 'prize',
  'download', 'crack', 'keygen', 'porn', 'xxx', 'adult', 'sex',
  'forex', 'crypto', 'bitcoin', 'loan', 'pills', 'viagra',
];

// Exclusion List - Never-Gonna-Buy companies (mega-corps + competitors)
const EXCLUSION_DOMAINS = [
  // Big Tech
  'amazon.com', 'microsoft.com', 'google.com', 'facebook.com', 'meta.com',
  'apple.com', 'netflix.com', 'uber.com', 'airbnb.com', 'spotify.com',
  // Tech Giants
  'nvidia.com', 'salesforce.com', 'oracle.com', 'sap.com', 'adobe.com',
  'ibm.com', 'intel.com', 'cisco.com', 'dell.com', 'hp.com',
  // Search Competitors
  'elastic.co', 'coveo.com', 'bloomreach.com', 'constructor.io',
  'klevu.com', 'searchspring.com', 'lucidworks.com', 'swiftype.com',
  'doofinder.com', 'yext.com',
  // Mega Retailers (build their own tech)
  'walmart.com', 'target.com', 'costco.com', 'homedepot.com', 'lowes.com',
  'bestbuy.com', 'macys.com', 'kohls.com', 'nordstrom.com',
  // Chinese Tech Giants
  'alibaba.com', 'tencent.com', 'baidu.com', 'jd.com', 'pinduoduo.com',
];

// Traffic Threshold (monthly visits)
const TRAFFIC_THRESHOLD = 100_000; // 100K visits/month

// Revenue Threshold
const REVENUE_THRESHOLD = 100_000_000; // $100M annual revenue

// =============================================================================
// PHASE 1: DOMAIN QUALITY FILTER
// =============================================================================

interface Company {
  domain: string;
  company_name: string | null;
  cms_tech: string | null;
  commerce_tech: string | null;
  martech_tech: string | null;
  search_tech: string | null;
  cloud_tech: string | null;
}

function getTLD(domain: string): string {
  const parts = domain.split('.');
  return parts[parts.length - 1].toLowerCase();
}

function hasSpamKeyword(domain: string): boolean {
  const lower = domain.toLowerCase();
  return SPAM_KEYWORDS.some(keyword => lower.includes(keyword));
}

function isExcluded(domain: string): boolean {
  return EXCLUSION_DOMAINS.includes(domain.toLowerCase());
}

function hasInvalidPattern(domain: string): boolean {
  // Too long
  if (domain.length > 50) return true;

  // Multiple hyphens (e.g., free-gift-win-now.com)
  if ((domain.match(/-/g) || []).length >= 3) return true;

  // All numbers
  const domainPart = domain.split('.')[0];
  if (/^\d+$/.test(domainPart)) return true;

  // IP address pattern
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true;

  return false;
}

function isQualityDomain(company: Company): { pass: boolean; reason?: string } {
  const domain = company.domain;

  // Check TLD
  const tld = getTLD(domain);
  if (!ALLOWED_TLDS.includes(tld)) {
    return { pass: false, reason: `Bad TLD: .${tld}` };
  }

  // Check spam keywords
  if (hasSpamKeyword(domain)) {
    return { pass: false, reason: 'Spam keyword' };
  }

  // Check exclusion list
  if (isExcluded(domain)) {
    return { pass: false, reason: 'Exclusion list (mega-corp/competitor)' };
  }

  // Check invalid patterns
  if (hasInvalidPattern(domain)) {
    return { pass: false, reason: 'Invalid pattern' };
  }

  return { pass: true };
}

async function phase1_filterDomains(): Promise<Company[]> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 1: DOMAIN QUALITY FILTER                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Fetch ALL companies (no limit - paginate if needed)
  console.log('Fetching all companies from database...');

  let allCompanies: Company[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('companies')
      .select('domain, company_name, cms_tech, commerce_tech, martech_tech, search_tech, cloud_tech')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    allCompanies = allCompanies.concat(data);
    process.stdout.write(`  Fetched ${allCompanies.length.toLocaleString()} companies...\r`);

    if (data.length < pageSize) break; // Last page
    page++;
  }

  const companies = allCompanies;
  console.log(`\n✓ Loaded ${companies.length.toLocaleString()} companies\n`);

  // Filter companies
  const results = {
    total: companies.length,
    passed: 0,
    failed: 0,
    reasons: {} as Record<string, number>,
  };

  const qualityDomains: Company[] = [];

  for (const company of companies) {
    const result = isQualityDomain(company);

    if (result.pass) {
      qualityDomains.push(company);
      results.passed++;
    } else {
      results.failed++;
      const reason = result.reason || 'Unknown';
      results.reasons[reason] = (results.reasons[reason] || 0) + 1;
    }
  }

  // Print summary
  console.log('FILTER RESULTS:');
  console.log(`  Total:  ${results.total.toLocaleString()}`);
  console.log(`  Passed: ${results.passed.toLocaleString()} (${((results.passed/results.total)*100).toFixed(1)}%)`);
  console.log(`  Failed: ${results.failed.toLocaleString()} (${((results.failed/results.total)*100).toFixed(1)}%)`);
  console.log('\nFAILURE REASONS:');

  const sortedReasons = Object.entries(results.reasons)
    .sort((a, b) => b[1] - a[1]);

  for (const [reason, count] of sortedReasons) {
    console.log(`  ${reason.padEnd(40)} ${count.toLocaleString().padStart(6)}`);
  }

  console.log('\n');
  return qualityDomains;
}

// =============================================================================
// PHASE 2: MULTI-LAYER TRAFFIC VALIDATION
// =============================================================================
// Uses 4 FREE sources to validate traffic via intersection:
//   1. Tranco - Combined ranking methodology (1M domains)
//   2. Majestic Million - Backlink strength (1M domains)
//   3. Cisco Umbrella - DNS requests 620B/day (1M domains)
//   4. AkaRank (Akamai) - Akamai DNS data (1M domains)
//
// Confidence scoring:
//   - 4/4 sources = VERY HIGH confidence (appears in all 4 lists)
//   - 3/4 sources = HIGH confidence (appears in 3 lists)
//   - 2/4 sources = MEDIUM confidence (appears in 2 lists)
//   - 1/4 sources = LOW confidence (appears in 1 list)
//   - 0/4 sources = NO traffic validation
// =============================================================================

interface CompanyWithTraffic extends Company {
  // Best rank across all sources (lowest number = highest traffic)
  best_rank: number | null;

  // Individual source ranks
  tranco_rank: number | null;
  majestic_rank: number | null;
  umbrella_rank: number | null;
  akarank_rank: number | null;

  // How many sources validate this domain has traffic
  source_count: number;
  confidence: 'very_high' | 'high' | 'medium' | 'low' | 'none';

  // Traffic tier based on best rank
  traffic_tier: 'massive' | 'high' | 'medium' | 'low' | 'none';
}

function getTrafficTier(rank: number | null): CompanyWithTraffic['traffic_tier'] {
  if (!rank) return 'none';
  if (rank <= 10_000) return 'massive';
  if (rank <= 100_000) return 'high';
  if (rank <= 500_000) return 'medium';
  return 'low';
}

function getConfidence(sourceCount: number): 'very_high' | 'high' | 'medium' | 'low' | 'none' {
  if (sourceCount === 4) return 'very_high';
  if (sourceCount === 3) return 'high';
  if (sourceCount === 2) return 'medium';
  if (sourceCount === 1) return 'low';
  return 'none';
}

async function loadRankingList(
  filename: string,
  displayName: string,
  domainColumn: number = 1,
  rankColumn: number = 0,
  hasHeader: boolean = false
): Promise<Map<string, number>> {
  const fs = await import('fs');
  const path = await import('path');
  const { createInterface } = await import('readline');

  const filePath = path.join(process.cwd(), 'data', filename);
  const ranks = new Map<string, number>();
  let lineCount = 0;
  let headerSkipped = !hasHeader;

  const fileStream = fs.createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    // Skip header if it exists
    if (!headerSkipped && (line.startsWith('GlobalRank') || line.startsWith('domain_name'))) {
      headerSkipped = true;
      continue;
    }

    const parts = line.split(',');
    const rankStr = parts[rankColumn];
    let domain = parts[domainColumn];

    // Remove trailing dot from AkaRank domains (e.g., "google.com." -> "google.com")
    if (domain && domain.endsWith('.')) {
      domain = domain.slice(0, -1);
    }

    const rank = parseInt(rankStr);
    if (!isNaN(rank) && domain) {
      ranks.set(domain.trim(), rank);
      lineCount++;

      // Progress indicator every 100K lines
      if (lineCount % 100000 === 0) {
        process.stdout.write(`  Loaded ${lineCount.toLocaleString()} from ${displayName}...\r`);
      }
    }
  }

  console.log(`✓ Loaded ${lineCount.toLocaleString()} domains from ${displayName}`.padEnd(70));
  return ranks;
}

async function phase2_trafficValidation(companies: Company[]): Promise<CompanyWithTraffic[]> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 2: MULTI-LAYER TRAFFIC VALIDATION (4 SOURCES)         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Load all 4 ranking lists
  console.log('Loading traffic ranking lists...\n');
  const trancoRanks = await loadRankingList('tranco-top-1m.csv', 'Tranco', 1, 0, false);
  const majesticRanks = await loadRankingList('majestic-million.csv', 'Majestic Million', 2, 0, true);
  const umbrellaRanks = await loadRankingList('umbrella-top-1m.csv', 'Cisco Umbrella', 1, 0, false);
  const akarankRanks = await loadRankingList('top1M.csv', 'AkaRank (Akamai)', 0, 1, true);
  console.log('');

  // Match companies against all 4 sources
  console.log('Matching companies against all sources...\n');

  const companiesWithTraffic: CompanyWithTraffic[] = [];
  const stats = {
    total: companies.length,
    // Traffic tiers
    massive: 0,
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
    // Confidence levels
    conf_very_high: 0,  // 4/4 sources
    conf_high: 0,       // 3/4 sources
    conf_medium: 0,     // 2/4 sources
    conf_low: 0,        // 1/4 sources
    conf_none: 0,       // 0/4 sources
  };

  for (const company of companies) {
    // Check all 4 sources
    const trancoRank = trancoRanks.get(company.domain) || null;
    const majesticRank = majesticRanks.get(company.domain) || null;
    const umbrellaRank = umbrellaRanks.get(company.domain) || null;
    const akarankRank = akarankRanks.get(company.domain) || null;

    // Count how many sources found this domain
    const sourceCount = [trancoRank, majesticRank, umbrellaRank, akarankRank].filter(r => r !== null).length;

    // Get best rank (lowest number = highest traffic)
    const ranks = [trancoRank, majesticRank, umbrellaRank, akarankRank].filter((r): r is number => r !== null);
    const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;

    // Determine confidence and tier
    const confidence = getConfidence(sourceCount);
    const tier = getTrafficTier(bestRank);

    companiesWithTraffic.push({
      ...company,
      best_rank: bestRank,
      tranco_rank: trancoRank,
      majestic_rank: majesticRank,
      umbrella_rank: umbrellaRank,
      akarank_rank: akarankRank,
      source_count: sourceCount,
      confidence,
      traffic_tier: tier,
    });

    // Update stats
    stats[tier]++;
    stats[`conf_${confidence}`]++;
  }

  // Print results
  console.log('CONFIDENCE DISTRIBUTION (by source count):');
  console.log(`  VERY HIGH (4/4 sources):    ${stats.conf_very_high.toLocaleString().padStart(6)} (${((stats.conf_very_high/stats.total)*100).toFixed(1)}%)`);
  console.log(`  HIGH (3/4 sources):         ${stats.conf_high.toLocaleString().padStart(6)} (${((stats.conf_high/stats.total)*100).toFixed(1)}%)`);
  console.log(`  MEDIUM (2/4 sources):       ${stats.conf_medium.toLocaleString().padStart(6)} (${((stats.conf_medium/stats.total)*100).toFixed(1)}%)`);
  console.log(`  LOW (1/4 sources):          ${stats.conf_low.toLocaleString().padStart(6)} (${((stats.conf_low/stats.total)*100).toFixed(1)}%)`);
  console.log(`  NONE (0/4 sources):         ${stats.conf_none.toLocaleString().padStart(6)} (${((stats.conf_none/stats.total)*100).toFixed(1)}%)`);
  console.log('');

  console.log('TRAFFIC TIER DISTRIBUTION (by best rank):');
  console.log(`  Massive (rank 1-10K):       ${stats.massive.toLocaleString().padStart(6)} (${((stats.massive/stats.total)*100).toFixed(1)}%)`);
  console.log(`  High (rank 10K-100K):       ${stats.high.toLocaleString().padStart(6)} (${((stats.high/stats.total)*100).toFixed(1)}%)`);
  console.log(`  Medium (rank 100K-500K):    ${stats.medium.toLocaleString().padStart(6)} (${((stats.medium/stats.total)*100).toFixed(1)}%)`);
  console.log(`  Low (rank 500K+):           ${stats.low.toLocaleString().padStart(6)} (${((stats.low/stats.total)*100).toFixed(1)}%)`);
  console.log(`  None (not in any list):     ${stats.none.toLocaleString().padStart(6)} (${((stats.none/stats.total)*100).toFixed(1)}%)`);
  console.log('');

  const withTraffic = stats.massive + stats.high + stats.medium;
  const needsValidation = stats.low + stats.none;
  console.log(`  WITH TRAFFIC (Tiers 1-3):   ${withTraffic.toLocaleString().padStart(6)} (${((withTraffic/stats.total)*100).toFixed(1)}%)`);
  console.log(`  NEEDS VALIDATION (Tier 4+): ${needsValidation.toLocaleString().padStart(6)} (${((needsValidation/stats.total)*100).toFixed(1)}%)`);
  console.log('');

  // Show intersection analysis
  console.log('SOURCE INTERSECTION ANALYSIS:');
  const allFour = companiesWithTraffic.filter(c => c.source_count === 4).length;
  const anyThree = companiesWithTraffic.filter(c => c.source_count === 3).length;
  const anyTwo = companiesWithTraffic.filter(c => c.source_count === 2).length;
  const anyOne = companiesWithTraffic.filter(c => c.source_count === 1).length;

  console.log(`  All 4 sources:              ${allFour.toLocaleString().padStart(6)} ← GOLD STANDARD`);
  console.log(`  Any 3 sources:              ${anyThree.toLocaleString().padStart(6)}`);
  console.log(`  Any 2 sources:              ${anyTwo.toLocaleString().padStart(6)}`);
  console.log(`  Any 1 source:               ${anyOne.toLocaleString().padStart(6)}`);
  console.log('');

  // Show top 20 ranked companies
  const topCompanies = companiesWithTraffic
    .filter(c => c.best_rank !== null)
    .sort((a, b) => (a.best_rank || Infinity) - (b.best_rank || Infinity))
    .slice(0, 20);

  if (topCompanies.length > 0) {
    console.log('TOP 20 COMPANIES BY BEST RANK:');
    for (const company of topCompanies) {
      const tech = [company.cms_tech, company.commerce_tech, company.martech_tech]
        .filter(Boolean)
        .join(', ');
      const sources = [
        company.tranco_rank ? 'T' : '-',
        company.majestic_rank ? 'M' : '-',
        company.umbrella_rank ? 'U' : '-',
        company.akarank_rank ? 'A' : '-'
      ].join('');
      console.log(`  #${company.best_rank?.toLocaleString().padStart(6)} [${sources}] ${company.domain.padEnd(35)} [${tech}]`);
    }
    console.log('');
  }

  return companiesWithTraffic;
}

// =============================================================================
// PHASE 3: INDUSTRY CLASSIFICATION (Yahoo Finance)
// =============================================================================
// Get industry/sector classification from Yahoo Finance for ICP filtering.
// This is BASIC qualification only - deep financial analysis happens downstream.
// =============================================================================

interface CompanyWithIndustry extends CompanyWithTraffic {
  ticker: string | null;
  yf_industry: string | null;  // Yahoo Finance industry/sector
  yf_sector: string | null;     // Yahoo Finance broader sector
}

async function phase3_industryClassification(
  companies: CompanyWithTraffic[],
  minConfidence: 'very_high' | 'high' | 'medium' | 'low',
  dryRun: boolean = false  // Set to true to test without DB writes
): Promise<CompanyWithIndustry[]> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  PHASE 3: INDUSTRY CLASSIFICATION (${minConfidence.toUpperCase()}+ confidence)`.padEnd(63) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Filter by confidence threshold
  const confidenceLevels = ['very_high', 'high', 'medium', 'low'];
  const minIndex = confidenceLevels.indexOf(minConfidence);
  const allowedConfidences = confidenceLevels.slice(0, minIndex + 1);

  const filtered = companies.filter(c => allowedConfidences.includes(c.confidence));
  console.log(`Input: ${filtered.length.toLocaleString()} companies with ${minConfidence}+ confidence`);

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN MODE - No database writes will be performed\n`);
  }

  console.log(`\nFetching industry data from Yahoo Finance MCP...\n`);

  const companiesWithIndustry: CompanyWithIndustry[] = [];
  const stats = {
    total: filtered.length,
    success: 0,
    noTicker: 0,
    noData: 0,
    errors: 0,
  };

  const BATCH_SIZE = 100;
  let batchUpdates: Array<{domain: string; ticker: string; yf_industry: string; yf_sector: string}> = [];

  for (let i = 0; i < filtered.length; i++) {
    const company = filtered[i];
    process.stdout.write(`  Processing ${i + 1}/${filtered.length}: ${company.domain.padEnd(40)}\r`);

    try {
      // Step 1: Try to resolve ticker using Yahoo Finance search
      // Use domain name or company_name to search for ticker
      const searchTerm = company.company_name || company.domain.split('.')[0];
      let ticker: string | null = null;

      try {
        // Yahoo Finance search can find ticker by company name
        const searchResults = await yahooFinance.search(searchTerm, {
          newsCount: 0,
          enableFuzzyQuery: false,
        }) as any;

        // Get first quote result (most relevant)
        if (searchResults.quotes && searchResults.quotes.length > 0) {
          const firstQuote = searchResults.quotes[0];
          // Verify it's a stock (not a cryptocurrency, etc.)
          if (firstQuote.quoteType === 'EQUITY' && firstQuote.symbol) {
            ticker = firstQuote.symbol;
          }
        }
      } catch (searchError) {
        // Search failed, no ticker found
      }

      if (!ticker) {
        companiesWithIndustry.push({
          ...company,
          ticker: null,
          yf_industry: null,
          yf_sector: null,
        });
        stats.noTicker++;
        continue;
      }

      // Step 2: Get company info from Yahoo Finance
      try {
        const quoteSummary = await yahooFinance.quoteSummary(ticker, {
          modules: ['summaryProfile'],
        }) as any;

        const profile = quoteSummary.summaryProfile;

        if (profile && (profile.industry || profile.sector)) {
          const enriched = {
            ...company,
            ticker: ticker,
            yf_industry: profile.industry || null,
            yf_sector: profile.sector || null,
          };
          companiesWithIndustry.push(enriched);
          stats.success++;

          // Batch for database update
          if (!dryRun) {
            batchUpdates.push({
              domain: company.domain,
              ticker: ticker,
              yf_industry: profile.industry || '',
              yf_sector: profile.sector || '',
            });

            // Flush batch every BATCH_SIZE
            if (batchUpdates.length >= BATCH_SIZE) {
              await flushBatch(batchUpdates);
              batchUpdates = [];
            }
          }
        } else {
          // Yahoo Finance returned data but no industry/sector
          companiesWithIndustry.push({
            ...company,
            ticker: ticker,
            yf_industry: null,
            yf_sector: null,
          });
          stats.noData++;
        }
      } catch (yahooError) {
        // Yahoo Finance call failed for this ticker
        companiesWithIndustry.push({
          ...company,
          ticker: ticker,
          yf_industry: null,
          yf_sector: null,
        });
        stats.noData++;
      }

    } catch (error) {
      companiesWithIndustry.push({
        ...company,
        ticker: null,
        yf_industry: null,
        yf_sector: null,
      });
      stats.errors++;
    }
  }

  // Flush remaining batch
  if (!dryRun && batchUpdates.length > 0) {
    await flushBatch(batchUpdates);
  }

  console.log(`\n`);
  console.log('CLASSIFICATION RESULTS:');
  console.log(`  Success:       ${stats.success.toLocaleString().padStart(6)} (${((stats.success/stats.total)*100).toFixed(1)}%)`);
  console.log(`  No ticker:     ${stats.noTicker.toLocaleString().padStart(6)} (${((stats.noTicker/stats.total)*100).toFixed(1)}%)`);
  console.log(`  No data:       ${stats.noData.toLocaleString().padStart(6)} (${((stats.noData/stats.total)*100).toFixed(1)}%)`);
  console.log(`  Errors:        ${stats.errors.toLocaleString().padStart(6)} (${((stats.errors/stats.total)*100).toFixed(1)}%)`);
  console.log('');

  if (dryRun) {
    console.log(`💾 Dry run complete - no database writes performed\n`);
  } else {
    console.log(`💾 Stored ${stats.success.toLocaleString()} companies with industry data in database\n`);
  }

  return companiesWithIndustry;
}

async function flushBatch(batch: Array<{domain: string; ticker: string; yf_industry: string; yf_sector: string}>) {
  if (batch.length === 0) return;

  console.log(`  💾 Storing batch of ${batch.length} companies...`);

  for (const item of batch) {
    await supabase
      .from('companies')
      .update({
        ticker: item.ticker,
        yf_industry: item.yf_industry,
        yf_sector: item.yf_sector,
        industry_updated_at: new Date().toISOString(),
      })
      .eq('domain', item.domain);
  }
}

// =============================================================================
// PHASE 4: ICP FILTERING (DATABASE-DRIVEN WITH INDUSTRY DATA)
// =============================================================================
// Uses actual ICP data from `industries` table.
// Combines Yahoo Finance industry data (from Phase 3) with keyword matching.
// =============================================================================

interface CompanyWithICP extends CompanyWithIndustry {
  icp_tier: 'high' | 'medium' | 'low' | 'excluded';
  icp_signals: string[];
  matched_industry?: string;
}

interface Industry {
  name: string;
  icp_confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NEUTRAL' | null;
  icp_keywords: string[] | null;
  icp_proof_points: number | null;
}

// Known exclusions (dev platforms, infrastructure tools)
const ICP_EXCLUSIONS = [
  'github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'docker.com',
  'gstatic.com', 'cloudflareinsights.com', 'zdassets.com', // CDN/analytics
];

// Additional exclusion patterns (for domains that don't match retail keywords)
const EXCLUSION_PATTERNS = [
  // Tech companies (hardware, semiconductors, infrastructure)
  'amd', 'nvidia', 'intel', 'cisco', 'qualcomm', 'broadcom',
  // Financial services
  'bank', 'jpmorgan', 'goldman', 'finance', 'capital', 'insurance', 'trading',
  // Industrial/Manufacturing (non-consumer)
  'siemens', 'ge', 'honeywell', 'industrial', 'machinery',
  // Telecom
  'telecom', 'verizon', 'att', 'tmobile', 'vodafone',
];

async function loadICPFromDatabase(): Promise<Industry[]> {
  const { data, error } = await supabase
    .from('industries')
    .select('name, icp_confidence, icp_keywords, icp_proof_points');

  if (error) {
    throw new Error(`Failed to load ICP data: ${error.message}`);
  }

  return data || [];
}

function getICP(
  company: CompanyWithIndustry,
  industries: Industry[]
): { tier: CompanyWithICP['icp_tier']; signals: string[]; matchedIndustry?: string } {
  const signals: string[] = [];
  const domain = company.domain.toLowerCase();
  const companyName = (company.company_name || '').toLowerCase();

  // EXCLUSION 1: Known non-commercial domains (dev platforms, CDN)
  if (ICP_EXCLUSIONS.includes(domain)) {
    signals.push('Known exclusion (dev platform/CDN)');
    return { tier: 'excluded', signals };
  }

  // EXCLUSION 2: Exclusion patterns (hardware, finance, telecom, industrial)
  for (const pattern of EXCLUSION_PATTERNS) {
    if (domain.includes(pattern) || companyName.includes(pattern)) {
      signals.push(`Exclusion pattern: ${pattern}`);
      return { tier: 'excluded', signals };
    }
  }

  // PRIORITY 1: Yahoo Finance industry data (most authoritative)
  if (company.yf_industry || company.yf_sector) {
    const yfIndustry = (company.yf_industry || company.yf_sector || '').toLowerCase();

    // Match Yahoo Finance industry against our ICP industries
    for (const industry of industries) {
      const industryName = industry.name.toLowerCase();
      if (yfIndustry.includes(industryName) || industryName.includes(yfIndustry)) {
        signals.push(`Yahoo Finance: ${company.yf_industry || company.yf_sector}`);
        signals.push(`Matched industry: ${industry.name}`);

        const confidence = industry.icp_confidence;
        if (confidence === 'HIGH') {
          return { tier: 'high', signals, matchedIndustry: industry.name };
        } else if (confidence === 'MEDIUM') {
          return { tier: 'medium', signals, matchedIndustry: industry.name };
        } else if (confidence === 'LOW') {
          return { tier: 'low', signals, matchedIndustry: industry.name };
        } else if (confidence === 'NEUTRAL') {
          signals.push('Industry is NEUTRAL (not a target)');
          return { tier: 'excluded', signals, matchedIndustry: industry.name };
        }
      }
    }
  }

  // PRIORITY 2: KEYWORD MATCHING (fallback if no Yahoo Finance data)
  let bestMatch: { industry: Industry; matchedKeywords: string[] } | null = null;
  let bestScore = 0;

  for (const industry of industries) {
    if (!industry.icp_keywords || industry.icp_keywords.length === 0) continue;

    const matchedKeywords: string[] = [];
    for (const keyword of industry.icp_keywords) {
      const kw = keyword.toLowerCase();
      if (domain.includes(kw) || companyName.includes(kw)) {
        matchedKeywords.push(keyword);
      }
    }

    // Score = number of matched keywords * proof points
    const score = matchedKeywords.length * (industry.icp_proof_points || 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { industry, matchedKeywords };
    }
  }

  // Apply matched industry's ICP confidence
  if (bestMatch) {
    const { industry, matchedKeywords } = bestMatch;
    signals.push(`Industry: ${industry.name}`);
    signals.push(`Keywords: ${matchedKeywords.join(', ')}`);

    const confidence = industry.icp_confidence;
    if (confidence === 'HIGH') {
      return { tier: 'high', signals, matchedIndustry: industry.name };
    } else if (confidence === 'MEDIUM') {
      return { tier: 'medium', signals, matchedIndustry: industry.name };
    } else if (confidence === 'LOW') {
      return { tier: 'low', signals, matchedIndustry: industry.name };
    } else if (confidence === 'NEUTRAL') {
      signals.push('Industry is NEUTRAL (not a target)');
      return { tier: 'excluded', signals, matchedIndustry: industry.name };
    }
  }

  // PRIORITY 3: Tech-stack signals (if no industry match)
  if (company.commerce_tech) {
    signals.push(`Fallback: Has commerce tech (${company.commerce_tech})`);
    signals.push('⚠️  NEEDS MANUAL REVIEW - Could be retail OR manufacturer');
    return { tier: 'low', signals }; // Mark as LOW (not HIGH) - needs review
  }

  if (company.cms_tech && company.martech_tech) {
    signals.push('Fallback: Has CMS + MarTech');
    return { tier: 'low', signals };
  }

  // DEFAULT: Unknown industry, needs external classification
  signals.push('No keyword match, no clear signals');
  return { tier: 'excluded', signals };
}

async function phase4_icpFiltering(
  companies: CompanyWithIndustry[],
  minConfidence: 'very_high' | 'high' | 'medium' | 'low'
): Promise<CompanyWithICP[]> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  PHASE 4: ICP FILTERING (${minConfidence.toUpperCase()} confidence+)`.padEnd(63) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Load ICP data from database
  console.log('Loading ICP data from industries table...');
  const industries = await loadICPFromDatabase();
  console.log(`✓ Loaded ${industries.length} industries with ICP classifications\n`);

  // Filter by confidence threshold
  const confidenceLevels = ['very_high', 'high', 'medium', 'low'];
  const minIndex = confidenceLevels.indexOf(minConfidence);
  const allowedConfidences = confidenceLevels.slice(0, minIndex + 1);

  const filtered = companies.filter(c => allowedConfidences.includes(c.confidence));
  console.log(`Input: ${filtered.length.toLocaleString()} companies with ${minConfidence}+ confidence\n`);

  // Apply ICP filtering
  const companiesWithICP: CompanyWithICP[] = [];
  const stats = {
    total: filtered.length,
    high: 0,
    medium: 0,
    low: 0,
    excluded: 0,
  };

  for (const company of filtered) {
    const { tier, signals, matchedIndustry } = getICP(company, industries);

    companiesWithICP.push({
      ...company,
      icp_tier: tier,
      icp_signals: signals,
      matched_industry: matchedIndustry,
    });

    stats[tier]++;
  }

  // Print results
  console.log('ICP TIER DISTRIBUTION:');
  console.log(`  HIGH (Retail/E-commerce):   ${stats.high.toLocaleString().padStart(6)} (${((stats.high/stats.total)*100).toFixed(1)}%)`);
  console.log(`  MEDIUM (SaaS/B2B/Media):    ${stats.medium.toLocaleString().padStart(6)} (${((stats.medium/stats.total)*100).toFixed(1)}%)`);
  console.log(`  LOW (Unclear vertical):     ${stats.low.toLocaleString().padStart(6)} (${((stats.low/stats.total)*100).toFixed(1)}%)`);
  console.log(`  EXCLUDED (Non-commercial):  ${stats.excluded.toLocaleString().padStart(6)} (${((stats.excluded/stats.total)*100).toFixed(1)}%)`);
  console.log('');

  const qualified = stats.high + stats.medium + stats.low;
  console.log(`  QUALIFIED TARGETS:          ${qualified.toLocaleString().padStart(6)} (${((qualified/stats.total)*100).toFixed(1)}%)`);
  console.log(`  EXCLUDED:                   ${stats.excluded.toLocaleString().padStart(6)} (${((stats.excluded/stats.total)*100).toFixed(1)}%)`);
  console.log('');

  // Show sample qualified companies
  const qualifiedCompanies = companiesWithICP
    .filter(c => c.icp_tier !== 'excluded')
    .sort((a, b) => {
      // Sort by ICP tier first (high > medium > low)
      const tierOrder = { high: 0, medium: 1, low: 2, excluded: 3 };
      const tierDiff = tierOrder[a.icp_tier] - tierOrder[b.icp_tier];
      if (tierDiff !== 0) return tierDiff;
      // Then by best rank
      return (a.best_rank || Infinity) - (b.best_rank || Infinity);
    })
    .slice(0, 20);

  if (qualifiedCompanies.length > 0) {
    console.log('TOP 20 QUALIFIED TARGETS (by ICP tier + traffic):');
    for (const company of qualifiedCompanies) {
      const icpLabel = company.icp_tier.toUpperCase().padEnd(6);
      const rankStr = company.best_rank ? `#${company.best_rank.toLocaleString().padStart(6)}` : '      -';
      const industry = company.matched_industry || 'Unknown';
      const firstSignal = company.icp_signals[0] || '';
      console.log(`  ${icpLabel} ${rankStr} ${company.domain.padEnd(35)} [${industry}]`);
      if (firstSignal.includes('Keywords:')) {
        console.log(`         ${' '.repeat(43)} ${firstSignal}`);
      }
    }
    console.log('');
  }

  return companiesWithICP;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('COMPANY SANITIZATION PIPELINE');
  console.log('═'.repeat(70));
  console.log('\n');

  try {
    // Phase 1: Domain Quality Filter
    const qualityDomains = await phase1_filterDomains();
    console.log(`\n✓ Phase 1 complete: ${qualityDomains.length.toLocaleString()} quality domains\n`);

    // Phase 2: Traffic Validation (4 sources)
    const trafficValidated = await phase2_trafficValidation(qualityDomains);
    console.log(`\n✓ Phase 2 complete: ${trafficValidated.length.toLocaleString()} companies with traffic data\n`);

    // Phase 3: Industry Classification (Yahoo Finance)
    // Run on MEDIUM+ confidence (free API, so no cost concern)
    const industryClassified = await phase3_industryClassification(trafficValidated, 'medium');
    console.log(`\n✓ Phase 3 complete: ${industryClassified.length.toLocaleString()} companies classified\n`);

    // Phase 4A: ICP Filtering - OPTION A (CONSERVATIVE)
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  OPTION A: CONSERVATIVE (VERY HIGH + HIGH CONFIDENCE)        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    const optionA = await phase4_icpFiltering(industryClassified, 'high');
    const optionA_qualified = optionA.filter(c => c.icp_tier !== 'excluded');
    console.log(`✓ Option A result: ${optionA_qualified.length.toLocaleString()} qualified targets\n`);

    // Export Option A to CSV
    const csvPath = path.join(__dirname, '../data/qualified-targets-optionA.csv');
    const csvHeader = 'domain,company_name,cms_tech,confidence,source_count,traffic_tier,tranco_rank,majestic_rank,umbrella_rank,akarank_rank,ticker,yf_industry,yf_sector,icp_tier,icp_signals\n';
    const csvRows = optionA_qualified.map(c => {
      const signals = (c.icp_signals || []).join('; ').replace(/,/g, ';');
      return [
        c.domain,
        c.company_name || '',
        c.cms_tech || '',
        c.confidence,
        c.source_count,
        c.traffic_tier,
        c.tranco_rank || '',
        c.majestic_rank || '',
        c.umbrella_rank || '',
        c.akarank_rank || '',
        c.ticker || '',
        c.yf_industry || '',
        c.yf_sector || '',
        c.icp_tier,
        `"${signals}"`
      ].join(',');
    });
    fs.writeFileSync(csvPath, csvHeader + csvRows.join('\n'));
    console.log(`✓ Exported to: ${csvPath}\n`);

    // Phase 4B: ICP Filtering - OPTION B (BALANCED)
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  OPTION B: BALANCED (VERY HIGH + HIGH + MEDIUM CONFIDENCE)   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    const optionB = await phase4_icpFiltering(industryClassified, 'medium');
    const optionB_qualified = optionB.filter(c => c.icp_tier !== 'excluded');
    console.log(`✓ Option B result: ${optionB_qualified.length.toLocaleString()} qualified targets\n`);

    // Summary comparison
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  FINAL SUMMARY: OPTION A vs OPTION B                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('OPTION A (Conservative - 3-4 sources):');
    const optionA_input = industryClassified.filter(c =>
      ['very_high', 'high'].includes(c.confidence)
    ).length;
    console.log(`  Input:     ${optionA_input.toLocaleString()} companies (VERY HIGH + HIGH confidence)`);
    console.log(`  Excluded:  ${optionA.filter(c => c.icp_tier === 'excluded').length.toLocaleString()} companies (non-commercial)`);
    console.log(`  QUALIFIED: ${optionA_qualified.length.toLocaleString()} targets`);
    console.log('');
    console.log('OPTION B (Balanced - 2-4 sources):');
    const optionB_input = industryClassified.filter(c =>
      ['very_high', 'high', 'medium'].includes(c.confidence)
    ).length;
    console.log(`  Input:     ${optionB_input.toLocaleString()} companies (VERY HIGH + HIGH + MEDIUM confidence)`);
    console.log(`  Excluded:  ${optionB.filter(c => c.icp_tier === 'excluded').length.toLocaleString()} companies (non-commercial)`);
    console.log(`  QUALIFIED: ${optionB_qualified.length.toLocaleString()} targets`);
    console.log('');
    console.log(`DIFFERENCE: +${(optionB_qualified.length - optionA_qualified.length).toLocaleString()} additional targets in Option B`);
    console.log('');

    // Show detailed breakdown of Option A (458 qualified targets)
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  OPTION A: DETAILED BREAKDOWN (458 QUALIFIED TARGETS)       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Sort by traffic rank (best first)
    const sorted = [...optionA_qualified].sort((a, b) => {
      const aRank = a.tranco_rank || a.majestic_rank || a.umbrella_rank || a.akarank_rank || 999999999;
      const bRank = b.tranco_rank || b.majestic_rank || b.umbrella_rank || b.akarank_rank || 999999999;
      return aRank - bRank;
    });

    // Group by ICP tier
    const byTier: Record<string, typeof sorted> = {
      high: sorted.filter(c => c.icp_tier === 'high'),
      medium: sorted.filter(c => c.icp_tier === 'medium'),
      low: sorted.filter(c => c.icp_tier === 'low'),
    };

    console.log('BY ICP TIER:');
    console.log(`  HIGH (Retail/E-commerce):    ${byTier.high.length.toLocaleString()}`);
    console.log(`  MEDIUM (SaaS/B2B/Media):     ${byTier.medium.length.toLocaleString()}`);
    console.log(`  LOW (Unclear vertical):      ${byTier.low.length.toLocaleString()}`);
    console.log('');

    console.log('TOP 50 QUALIFIED TARGETS (by traffic rank):\n');
    sorted.slice(0, 50).forEach((c, i) => {
      const rank = c.tranco_rank || c.majestic_rank || c.umbrella_rank || c.akarank_rank || '?';
      const industry = c.yf_industry || c.yf_sector || 'Unknown';
      const tier = c.icp_tier.toUpperCase().padStart(6);
      console.log(`${(i + 1).toString().padStart(3)}. ${tier} #${rank.toString().padStart(7)} ${c.domain.padEnd(35)} [${industry}]`);
    });

    // NOTE: Deep financial analysis (3-year trends, Edgar, exec quotes) happens
    // downstream after qualification - not in this pipeline.

  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

main().catch(console.error);
