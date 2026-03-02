/**
 * TRACE WHERE COMMERCE COMPANIES GOT LOST
 *
 * Starting: 4,400 companies with commerce tech
 * Ending: 9 retail/e-commerce in final 458
 *
 * Where did 4,391 commerce companies disappear?
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

function loadRankingList(csvPath: string, domainCol: number = 1): Set<string> {
  if (!fs.existsSync(csvPath)) return new Set();

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const domains = new Set<string>();

  for (const line of lines) {
    const cols = line.split(',');
    if (cols[domainCol]) {
      const domain = cols[domainCol].toLowerCase().replace(/^www\./, '').replace(/"/g, '').trim();
      if (domain && domain.length > 0) {
        domains.add(domain);
      }
    }
  }

  return domains;
}

async function main() {
  console.log('TRACING WHERE 4,400 COMMERCE COMPANIES GOT LOST\n');
  console.log('='.repeat(70));

  // Load traffic lists
  console.log('Loading traffic validation lists...');
  const trancoDomains = loadRankingList(TRANCO_PATH, 1);
  const majesticDomains = loadRankingList(MAJESTIC_PATH, 2);
  const umbrellaDomains = loadRankingList(UMBRELLA_PATH, 1);

  console.log(`  Tranco: ${trancoDomains.size.toLocaleString()} domains`);
  console.log(`  Majestic: ${majesticDomains.size.toLocaleString()} domains`);
  console.log(`  Umbrella: ${umbrellaDomains.size.toLocaleString()} domains\n`);

  // Fetch all companies with commerce tech
  let allCommerce: any[] = [];
  let offset = 0;
  const limit = 1000;

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

  console.log(`PHASE 0: Starting with ${allCommerce.length.toLocaleString()} commerce companies\n`);

  // Phase 1: Domain quality filter (simplified - just check TLD)
  const ALLOWED_TLDS = ['com', 'co', 'io', 'ai', 'net', 'biz', 'info', 'uk', 'us', 'ca', 'au', 'nz', 'ie', 'de', 'fr', 'nl', 'es', 'it', 'se', 'no', 'dk', 'fi', 'ch', 'at', 'be', 'eu', 'pl', 'pt', 'gr', 'cz', 'ro', 'hu', 'jp', 'kr', 'sg', 'hk', 'tw', 'in', 'br', 'mx', 'ar', 'cl', 'co', 'ae', 'za', 'il'];

  const phase1Pass = allCommerce.filter(c => {
    const tld = c.domain.split('.').pop()?.toLowerCase();
    return tld && ALLOWED_TLDS.includes(tld);
  });

  console.log(`PHASE 1 (Domain Quality): ${phase1Pass.length.toLocaleString()} passed`);
  console.log(`  Lost: ${(allCommerce.length - phase1Pass.length).toLocaleString()} companies\n`);

  // Phase 2: Traffic validation (need 3+ sources)
  const phase2Pass = phase1Pass.filter(c => {
    const domain = c.domain.toLowerCase();
    let sourceCount = 0;

    if (trancoDomains.has(domain)) sourceCount++;
    if (majesticDomains.has(domain)) sourceCount++;
    if (umbrellaDomains.has(domain)) sourceCount++;

    return sourceCount >= 3;
  });

  console.log(`PHASE 2 (Traffic Validation - 3+ sources): ${phase2Pass.length.toLocaleString()} passed`);
  console.log(`  Lost: ${(phase1Pass.length - phase2Pass.length).toLocaleString()} companies`);
  console.log(`  ** THIS IS WHERE MOST COMMERCE COMPANIES DIED **\n`);

  // Sample lost companies
  const lost = phase1Pass.filter(c => {
    const domain = c.domain.toLowerCase();
    let sourceCount = 0;
    if (trancoDomains.has(domain)) sourceCount++;
    if (majesticDomains.has(domain)) sourceCount++;
    if (umbrellaDomains.has(domain)) sourceCount++;
    return sourceCount < 3;
  });

  console.log(`Sample of LOST commerce companies (failed 3+ source check):`);
  lost.slice(0, 20).forEach(c => {
    const domain = c.domain.toLowerCase();
    let sources = 0;
    if (trancoDomains.has(domain)) sources++;
    if (majesticDomains.has(domain)) sources++;
    if (umbrellaDomains.has(domain)) sources++;

    console.log(`  ${c.domain.padEnd(35)} - ${sources} source(s) - ${JSON.stringify(c.commerce_tech)}`);
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log('CONCLUSION:');
  console.log(`The "3+ sources" requirement in Phase 2 killed ${(phase1Pass.length - phase2Pass.length).toLocaleString()} commerce companies.`);
  console.log(`Many small/mid-size e-commerce sites don't appear in 3+ traffic lists.`);
  console.log(`\nConsider lowering to 2+ sources for better yield.`);
}

main().catch(console.error);
