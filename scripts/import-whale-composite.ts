/**
 * Import Whale Composite Data
 *
 * Imports the FY27 Q1 whale accounts from the merged Demandbase + ZoomInfo CSV
 * into the whale_composite Supabase table.
 *
 * Usage:
 *   npx ts-node scripts/import-whale-composite.ts
 *
 * Requires:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 *   - The whale_composite table to exist (run migration first)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// CONFIG
// =============================================================================

const CSV_PATH = path.join(__dirname, '../../../AI/DATA/2026-02-27_FY27-Q1-Whale_Demandbase+ZoomInfo.csv');
const SOURCE_FILE = '2026-02-27_FY27-Q1-Whale_Demandbase+ZoomInfo.csv';

// Load from environment or use defaults for local dev
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable required');
  console.error('Run: export SUPABASE_SERVICE_ROLE_KEY=your_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// =============================================================================
// COLUMN MAPPING: CSV Header -> DB Column
// =============================================================================

function mapRow(row: Record<string, string>): Record<string, unknown> {
  // Helper to parse numbers
  const toInt = (v: string | undefined): number | null => {
    if (!v || v === '') return null;
    const n = parseInt(v.replace(/,/g, ''), 10);
    return isNaN(n) ? null : n;
  };

  const toFloat = (v: string | undefined): number | null => {
    if (!v || v === '') return null;
    const n = parseFloat(v.replace(/,/g, ''));
    return isNaN(n) ? null : n;
  };

  const toBool = (v: string | undefined): boolean => {
    return v?.toLowerCase() === 'true';
  };

  const toStr = (v: string | undefined): string | null => {
    if (!v || v === '' || v === 'null') return null;
    return v.trim();
  };

  // Extract domain, clean it
  let domain = toStr(row['Domain']);
  if (domain) {
    domain = domain.toLowerCase().replace(/^www\./, '').replace(/\/$/, '');
  }

  if (!domain) {
    console.warn('Skipping row with no domain:', row['Account Name'] || row['﻿Account Name']);
    return {};
  }

  return {
    // Core identifiers
    domain,
    account_name: toStr(row['Account Name'] || row['﻿Account Name']),
    salesforce_account_id: toStr(row['18 digit Account ID']),
    abm_id: toStr(row['ABM ID']),
    acc_id: toInt(row['acc_id']),
    zoominfo_company_id: toInt(row['ZoomInfo Company ID']),

    // Demandbase ABX
    journey_stage: toStr(row['Journey Stage']),
    days_in_journey_stage: toInt(row['Days in Journey Stage']),
    date_of_last_web_activity: toStr(row['Date of Last Web Activity']),
    engaged_known_people: toInt(row['Engaged Known People']),
    engagement_points_3mo: toFloat(row['Engagement Points (3 mo.)']),
    target_account: toStr(row['Target Account']),
    abx_status: toStr(row['ABX Status']),
    abx_status_reason: toStr(row['ABX Status Reason']),
    abx_status_reason_description: toStr(row['ABX Status Reason Description']),
    gtm_tag: toStr(row['GTM Tag']),

    // Demandbase firmographics
    billing_country: toStr(row['Billing Country']),
    naics_code: toStr(row['NAICS Code']),
    naics_code_priority_1: toStr(row['NAICS Code Priority 1']),
    naics_description_priority_1: toStr(row['NAICS Description Priority 1']),
    industry: toStr(row['Industry']),
    demandbase_industry: toStr(row['Demandbase Industry']),
    demandbase_sub_industry: toStr(row['Demandbase Sub Industry']),
    revenue: toInt(row['Revenue']),
    revenue_range: toStr(row['Revenue Range']),
    expected_revenue: toFloat(row['Expected Revenue']),
    arr: toFloat(row['ARR']),
    traffic: toInt(row['Traffic']),

    // Sales assignment
    local_segment: toStr(row['Local Segment']),
    account_region: toStr(row['Account Region']),
    demandbase_account_owner: toStr(row['Demandbase - Account Owner Name']),
    sales_region: toStr(row['Sales Region']),
    sales_sub_region: toStr(row['Sales Sub-Region']),
    sales_segment: toStr(row['Sales Segment']),

    // Technology flags
    has_bigcommerce: toBool(row['Bigcommerce Technology']),
    has_commercetools: toBool(row['Commercetools Technology']),
    has_magento: toBool(row['Magento Technology']),
    has_magento_open_source: toBool(row['Magento Open Source Technology']),
    has_salesforce_b2b_commerce: toBool(row['Salesforce B2b Commerce Technology']),
    has_salesforce_commerce_cloud: toBool(row['Salesforce Commerce Cloud Technology']),
    has_shopify_hosted: toBool(row['Shopify Hosted Technology']),
    has_shopify_plus: toBool(row['Shopify Plus Technology']),
    has_shopify: toBool(row['Shopify Technology']),
    has_spryker: toBool(row['Spryker Technology']),

    // ZoomInfo company data
    zi_company_name: toStr(row['Company Name']),
    zi_company_description: toStr(row['Company Description']),
    zi_website: toStr(row['Website']),
    zi_founded_year: toInt(row['Founded Year']),
    zi_company_hq_phone: toStr(row['Company HQ Phone']),
    zi_fax: toStr(row['Fax']),
    zi_ticker: toStr(row['Ticker']),

    // ZoomInfo financials
    zi_revenue_thousands: toInt(row['Revenue (in 000s USD)']),
    zi_revenue_range: toStr(row['Revenue Range (in USD)']),
    zi_est_marketing_budget_thousands: toInt(row['Est. Marketing Department Budget (in 000s USD)']),
    zi_est_finance_budget_thousands: toInt(row['Est. Finance Department Budget (in 000s USD)']),
    zi_est_it_budget_thousands: toInt(row['Est. IT Department Budget (in 000s USD)']),
    zi_est_hr_budget_thousands: toInt(row['Est. HR Department Budget (in 000s USD)']),

    // ZoomInfo employees
    zi_employees: toInt(row['Employees']),
    zi_employee_range: toStr(row['Employee Range']),
    zi_employee_growth_1yr: toFloat(row['Past 1 Year Employee Growth Rate']),
    zi_employee_growth_2yr: toFloat(row['Past 2 Year Employee Growth Rate']),

    // ZoomInfo industry
    zi_sic_code_1: toStr(row['SIC Code 1']),
    zi_sic_code_2: toStr(row['SIC Code 2']),
    zi_sic_codes: toStr(row['SIC Codes']),
    zi_naics_code_1: toStr(row['NAICS Code 1']),
    zi_naics_code_2: toStr(row['NAICS Code 2']),
    zi_naics_codes: toStr(row['NAICS Codes']),
    zi_primary_industry: toStr(row['Primary Industry']),
    zi_primary_sub_industry: toStr(row['Primary Sub-Industry']),
    zi_all_industries: toStr(row['All Industries']),
    zi_all_sub_industries: toStr(row['All Sub-Industries']),
    zi_industry_hierarchical_category: toStr(row['Industry Hierarchical Category']),
    zi_secondary_industry_hierarchical_category: toStr(row['Secondary Industry Hierarchical Category']),

    // ZoomInfo digital presence
    zi_alexa_rank: toInt(row['Alexa Rank']),
    zi_profile_url: toStr(row['ZoomInfo Company Profile URL']),
    zi_linkedin_url: toStr(row['LinkedIn Company Profile URL']),
    zi_facebook_url: toStr(row['Facebook Company Profile URL']),
    zi_twitter_url: toStr(row['Twitter Company Profile URL']),

    // ZoomInfo corporate
    zi_ownership_type: toStr(row['Ownership Type']),
    zi_business_model: toStr(row['Business Model']),
    zi_certified_active: toStr(row['Certified Active Company']),
    zi_certification_date: toStr(row['Certification Date']),
    zi_defunct_company: toStr(row['Defunct Company']),
    zi_company_is_acquired: toStr(row['Company Is Acquired']),
    zi_number_of_locations: toInt(row['Number of Locations']),

    // ZoomInfo funding
    zi_total_funding_thousands: toInt(row['Total Funding Amount (in 000s USD)']),
    zi_recent_funding_thousands: toInt(row['Recent Funding Amount (in 000s USD)']),
    zi_recent_funding_round: toStr(row['Recent Funding Round']),
    zi_recent_funding_date: toStr(row['Recent Funding Date']),
    zi_recent_investors: toStr(row['Recent Investors']),
    zi_all_investors: toStr(row['All Investors']),

    // ZoomInfo address
    zi_street_address: toStr(row['Company Street Address']),
    zi_city: toStr(row['Company City']),
    zi_state: toStr(row['Company State']),
    zi_zip_code: toStr(row['Company Zip Code']),
    zi_country: toStr(row['Company Country']),
    zi_full_address: toStr(row['Full Address']),

    // ZoomInfo corporate hierarchy
    zi_ultimate_parent_id: toStr(row['Company ID (Ultimate Parent)']),
    zi_ultimate_parent_name: toStr(row['Entity Name (Ultimate Parent)']),
    zi_immediate_parent_id: toStr(row['Company ID (Immediate Parent)']),
    zi_immediate_parent_name: toStr(row['Entity Name (Immediate Parent)']),
    zi_immediate_parent_relationship: toStr(row['Relationship (Immediate Parent)']),

    // ZoomInfo match quality
    zi_match_status: toStr(row['Match status']),
    zi_match_insight_name: toStr(row['Company Name Match Insight']),
    zi_match_insight_domain: toStr(row['Company Domain Match Insight']),
    zi_match_insight_address: toStr(row['Company Address Match Insight']),
    zi_match_insight_phone: toStr(row['Company Phone Match Insight']),
    zi_match_insight_id: toStr(row['Company ID Match Insight']),
    zi_match_insight_social: toStr(row['Company Social URL Match Insight']),

    // Metadata
    source_file: SOURCE_FILE,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('WHALE COMPOSITE IMPORT');
  console.log('='.repeat(60));

  // Read CSV
  console.log(`\nReading CSV: ${CSV_PATH}`);
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Parsed ${records.length} records from CSV`);

  // Map rows
  const mappedRows = records
    .map((row: Record<string, string>) => mapRow(row))
    .filter((row: Record<string, unknown>) => row.domain); // Skip empty rows

  console.log(`Mapped ${mappedRows.length} valid records`);

  // Batch insert (Supabase has limits, use batches of 100)
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
    const batch = mappedRows.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('whale_composite')
      .upsert(batch, { onConflict: 'domain' });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\rInserted: ${inserted}/${mappedRows.length}`);
    }
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total records: ${mappedRows.length}`);
  console.log(`Inserted/Updated: ${inserted}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
