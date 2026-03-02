/**
 * OPTION B: Commerce companies with 2+ traffic sources
 *
 * Test if lowering from 3+ to 2+ sources gives us more enterprise retail/e-commerce targets
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

// Load traffic CSVs
const TRANCO_PATH = path.join(__dirname, '../data/tranco-top-1m.csv');
const MAJESTIC_PATH = path.join(__dirname, '../data/majestic-million.csv');
const UMBRELLA_PATH = path.join(__dirname, '../data/umbrella-top-1m.csv');

function loadRankingList(csvPath: string, domainCol: number = 1): Map<string, number> {
  const ranks = new Map<string, number>();

  if (!fs.existsSync(csvPath)) return ranks;

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(',');

    if (cols[domainCol]) {
      const domain = cols[domainCol].toLowerCase().replace(/^www\./, '').replace(/"/g, '').trim();
      if (domain && domain.length > 0) {
        ranks.set(domain, i + 1);
      }
    }
  }

  return ranks;
}

const ALLOWED_TLDS = ['com', 'co', 'io', 'ai', 'net', 'biz', 'info', 'uk', 'us', 'ca', 'au', 'nz', 'ie', 'de', 'fr', 'nl', 'es', 'it', 'se', 'no', 'dk', 'fi', 'ch', 'at', 'be', 'eu', 'pl', 'pt', 'gr', 'cz', 'ro', 'hu', 'jp', 'kr', 'sg', 'hk', 'tw', 'in', 'br', 'mx', 'ar', 'cl', 'co', 'ae', 'za', 'il'];

function isQualityDomain(domain: string): boolean {
  const tld = domain.split('.').pop()?.toLowerCase();
  return tld ? ALLOWED_TLDS.includes(tld) : false;
}

async function main() {
  console.log('='.repeat(70));
  console.log('OPTION B: COMMERCE COMPANIES WITH 2+ SOURCES');
  console.log('='.repeat(70));
  console.log('');

  // Load traffic lists
  console.log('Loading traffic ranking lists...');
  const trancoRanks = loadRankingList(TRANCO_PATH, 1);
  const majesticRanks = loadRankingList(MAJESTIC_PATH, 2);
  const umbrellaRanks = loadRankingList(UMBRELLA_PATH, 1);

  console.log(`  Tranco: ${trancoRanks.size.toLocaleString()} domains`);
  console.log(`  Majestic: ${majesticRanks.size.toLocaleString()} domains`);
  console.log(`  Umbrella: ${umbrellaRanks.size.toLocaleString()} domains\n`);

  // Fetch all companies with commerce tech
  let allCommerce: any[] = [];
  let offset = 0;
  const limit = 1000;

  console.log('Fetching all commerce companies from database...');
  while (true) {
    const { data } = await supabase
      .from('companies')
      .select('domain, commerce_tech, cms_tech')
      .not('commerce_tech', 'is', null)
      .range(offset, offset + limit - 1);

    if (!data || data.length === 0) break;

    allCommerce = allCommerce.concat(data);
    offset += limit;

    if (data.length < limit) break;
  }

  console.log(`✓ Found ${allCommerce.length.toLocaleString()} commerce companies\n`);

  // Apply filters
  const results: any[] = [];

  for (const company of allCommerce) {
    const domain = company.domain.toLowerCase();

    // Phase 1: Domain quality
    if (!isQualityDomain(domain)) continue;

    // Phase 2: Traffic validation (2+ sources)
    let sourceCount = 0;
    const ranks: number[] = [];

    const trancoRank = trancoRanks.get(domain);
    const majesticRank = majesticRanks.get(domain);
    const umbrellaRank = umbrellaRanks.get(domain);

    if (trancoRank) { sourceCount++; ranks.push(trancoRank); }
    if (majesticRank) { sourceCount++; ranks.push(majesticRank); }
    if (umbrellaRank) { sourceCount++; ranks.push(umbrellaRank); }

    if (sourceCount < 2) continue;

    const bestRank = Math.min(...ranks);

    results.push({
      domain,
      commerce_tech: company.commerce_tech,
      cms_tech: company.cms_tech,
      source_count: sourceCount,
      best_rank: bestRank,
      tranco_rank: trancoRank || null,
      majestic_rank: majesticRank || null,
      umbrella_rank: umbrellaRank || null,
    });
  }

  console.log('='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Total commerce companies with 2+ sources: ${results.length.toLocaleString()}\n`);

  // Sort by best rank
  results.sort((a, b) => a.best_rank - b.best_rank);

  // Count by source count
  const by2 = results.filter(r => r.source_count === 2).length;
  const by3 = results.filter(r => r.source_count === 3).length;

  console.log('By source count:');
  console.log(`  2 sources: ${by2.toLocaleString()}`);
  console.log(`  3 sources: ${by3.toLocaleString()}`);
  console.log('');

  // Count by commerce tech
  const byTech: Record<string, number> = {};
  results.forEach(r => {
    const tech = JSON.stringify(r.commerce_tech);
    byTech[tech] = (byTech[tech] || 0) + 1;
  });

  console.log('By commerce tech:');
  Object.entries(byTech)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tech, count]) => {
      console.log(`  ${count.toString().padStart(4)} - ${tech}`);
    });
  console.log('');

  // Show top 50
  console.log('TOP 50 COMMERCE COMPANIES (by traffic rank):\n');
  results.slice(0, 50).forEach((r, i) => {
    const tech = JSON.stringify(r.commerce_tech);
    const sources = `${r.source_count}src`;
    console.log(`${(i + 1).toString().padStart(3)}. #${r.best_rank.toString().padStart(7)} ${r.domain.padEnd(35)} ${sources} ${tech}`);
  });

  // Export to CSV
  const csvPath = path.join(__dirname, '../data/commerce-2plus-sources.csv');
  const csvHeader = 'domain,commerce_tech,cms_tech,source_count,best_rank,tranco_rank,majestic_rank,umbrella_rank\n';
  const csvRows = results.map(r => {
    return [
      r.domain,
      `"${JSON.stringify(r.commerce_tech)}"`,
      r.cms_tech || '',
      r.source_count,
      r.best_rank,
      r.tranco_rank || '',
      r.majestic_rank || '',
      r.umbrella_rank || '',
    ].join(',');
  });

  fs.writeFileSync(csvPath, csvHeader + csvRows.join('\n'));
  console.log(`\n✓ Exported to: ${csvPath}`);
  console.log(`✓ Total: ${results.length} commerce companies with 2+ traffic sources`);
}

main().catch(console.error);
