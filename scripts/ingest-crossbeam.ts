#!/usr/bin/env npx ts-node

/**
 * Ingest Crossbeam CSV into Supabase
 *
 * Usage: npx ts-node scripts/ingest-crossbeam.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// Supabase config
const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_KEY) {
  console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

interface CrossbeamRow {
  Record: string;
  'Our Populations': string;
  'Partner Populations': string;
  'Account Owner Name': string;
  'Billing Country': string;
  Industry: string;
  'Overlap Time': string;
  'Is a Customer of': string;
  'Opportunities Amount': string;
  'Opportunities Count': string;
  'Adobe SITES Customers: Account Owner Name': string;
  'Adobe SITES Customers: Adobe: Close Date': string;
  'Adobe SITES Customers: Adobe: geo': string;
  'Adobe SITES Customers: Adobe: industry': string;
  'Adobe SITES Customers: Company Name': string;
  'Adobe SITES Customers: Company Website': string;
  'Adobe SITES Customers: File Name': string;
  'Adobe SITES Customers: Upload Time': string;
}

interface CrossbeamRecord {
  domain: string;
  company_name: string;
  record_name: string;
  algolia_status: string;
  partner_status: string;
  partner_name: string;
  partner_product: string;
  algolia_owner: string;
  partner_owner: string;
  industry: string;
  geo: string;
  billing_country: string;
  opportunities_amount: number;
  opportunities_count: number;
  overlap_detected_at: string | null;
  partner_close_date: string | null;
  source_file: string;
  uploaded_at: string | null;
}

function cleanDomain(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr === '()') return null;
  // Handle Crossbeam's date format: ("2023-08-08T00:00:00.000+00:00" ...)
  const match = dateStr.match(/"(\d{4}-\d{2}-\d{2}T[^"]+)"/);
  if (match) {
    return match[1];
  }
  return null;
}

async function upsertRecords(records: CrossbeamRecord[]): Promise<void> {
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/crossbeam_overlaps`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Batch ${i / batchSize + 1} failed:`, error);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }

    // Progress
    if ((i / batchSize + 1) % 10 === 0) {
      console.log(`Progress: ${inserted} inserted, ${errors} errors`);
    }
  }

  console.log(`\nFinal: ${inserted} inserted, ${errors} errors`);
}

async function main() {
  const csvPath = path.join(__dirname, '../data/Algolias_Prospects_vs_Adobe_SITES_Customerss_Customers_2026-02-27_0442AM_286.csv');

  console.log('Reading CSV...');
  const content = fs.readFileSync(csvPath, 'utf-8');

  console.log('Parsing CSV...');
  const rows: CrossbeamRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Parsed ${rows.length} rows`);

  // Dedupe by domain (take first occurrence)
  const seenDomains = new Set<string>();
  const records: CrossbeamRecord[] = [];

  for (const row of rows) {
    const domain = cleanDomain(row['Adobe SITES Customers: Company Website'] || '');

    if (!domain || seenDomains.has(domain)) {
      continue;
    }
    seenDomains.add(domain);

    records.push({
      domain,
      company_name: row['Adobe SITES Customers: Company Name'] || row.Record || '',
      record_name: row.Record || '',
      algolia_status: row['Our Populations'] || '',
      partner_status: row['Partner Populations'] || '',
      partner_name: 'Adobe',
      partner_product: 'AEM',
      algolia_owner: row['Account Owner Name'] || '',
      partner_owner: row['Adobe SITES Customers: Account Owner Name'] || '',
      industry: row['Adobe SITES Customers: Adobe: industry'] || row.Industry || '',
      geo: row['Adobe SITES Customers: Adobe: geo'] || '',
      billing_country: row['Billing Country'] || '',
      opportunities_amount: parseFloat(row['Opportunities Amount']) || 0,
      opportunities_count: parseInt(row['Opportunities Count']) || 0,
      overlap_detected_at: parseDate(row['Overlap Time']),
      partner_close_date: parseDate(row['Adobe SITES Customers: Adobe: Close Date']),
      source_file: row['Adobe SITES Customers: File Name'] || '',
      uploaded_at: parseDate(row['Adobe SITES Customers: Upload Time']),
    });
  }

  console.log(`Deduplicated to ${records.length} unique domains`);

  // Show sample
  console.log('\nSample records:');
  records.slice(0, 3).forEach(r => {
    console.log(`  ${r.domain} | ${r.company_name} | ${r.industry} | ${r.geo}`);
  });

  console.log('\nInserting into Supabase...');
  await upsertRecords(records);

  console.log('\nDone!');
}

main().catch(console.error);
