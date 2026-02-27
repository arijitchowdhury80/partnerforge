#!/usr/bin/env python3
"""
Import Whale Composite Data to Supabase

Imports the FY27 Q1 whale accounts from the merged Demandbase + ZoomInfo CSV.
"""

import pandas as pd
import requests
import json
import sys
from pathlib import Path

# =============================================================================
# CONFIG
# =============================================================================

CSV_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/DATA/2026-02-27-Whale_Demandbase+ZoomInfo.csv"
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
SOURCE_FILE = "2026-02-27-Whale_Demandbase+ZoomInfo.csv"
BATCH_SIZE = 50

# =============================================================================
# COLUMN MAPPING
# =============================================================================

COLUMN_MAP = {
    # Core identifiers
    'Domain': 'domain',
    'Account Name': 'account_name',
    '\ufeffAccount Name': 'account_name',  # BOM variant
    '18 digit Account ID': 'salesforce_account_id',
    'ABM ID': 'abm_id',
    'acc_id': 'acc_id',
    'ZoomInfo Company ID': 'zoominfo_company_id',

    # Demandbase ABX
    'Journey Stage': 'journey_stage',
    'Days in Journey Stage': 'days_in_journey_stage',
    'Date of Last Web Activity': 'date_of_last_web_activity',
    'Engaged Known People': 'engaged_known_people',
    'Engagement Points (3 mo.)': 'engagement_points_3mo',
    'Target Account': 'target_account',
    'ABX Status': 'abx_status',
    'ABX Status Reason': 'abx_status_reason',
    'ABX Status Reason Description': 'abx_status_reason_description',
    'GTM Tag': 'gtm_tag',

    # Demandbase firmographics
    'Billing Country': 'billing_country',
    'NAICS Code': 'naics_code',
    'NAICS Code Priority 1': 'naics_code_priority_1',
    'NAICS Description Priority 1': 'naics_description_priority_1',
    'Industry': 'industry',
    'Demandbase Industry': 'demandbase_industry',
    'Demandbase Sub Industry': 'demandbase_sub_industry',
    'Revenue': 'revenue',
    'Revenue Range': 'revenue_range',
    'Expected Revenue': 'expected_revenue',
    'ARR': 'arr',
    'Traffic': 'traffic',

    # Sales assignment
    'Local Segment': 'local_segment',
    'Account Region': 'account_region',
    'Demandbase - Account Owner Name': 'demandbase_account_owner',
    'Sales Region': 'sales_region',
    'Sales Sub-Region': 'sales_sub_region',
    'Sales Segment': 'sales_segment',

    # Technology flags
    'Bigcommerce Technology': 'has_bigcommerce',
    'Commercetools Technology': 'has_commercetools',
    'Magento Technology': 'has_magento',
    'Magento Open Source Technology': 'has_magento_open_source',
    'Salesforce B2b Commerce Technology': 'has_salesforce_b2b_commerce',
    'Salesforce Commerce Cloud Technology': 'has_salesforce_commerce_cloud',
    'Shopify Hosted Technology': 'has_shopify_hosted',
    'Shopify Plus Technology': 'has_shopify_plus',
    'Shopify Technology': 'has_shopify',
    'Spryker Technology': 'has_spryker',

    # ZoomInfo company data
    'Company Name': 'zi_company_name',
    'Company Description': 'zi_company_description',
    'Website': 'zi_website',
    'Founded Year': 'zi_founded_year',
    'Company HQ Phone': 'zi_company_hq_phone',
    'Fax': 'zi_fax',
    'Ticker': 'zi_ticker',

    # ZoomInfo financials
    'Revenue (in 000s USD)': 'zi_revenue_thousands',
    'Revenue Range (in USD)': 'zi_revenue_range',
    'Est. Marketing Department Budget (in 000s USD)': 'zi_est_marketing_budget_thousands',
    'Est. Finance Department Budget (in 000s USD)': 'zi_est_finance_budget_thousands',
    'Est. IT Department Budget (in 000s USD)': 'zi_est_it_budget_thousands',
    'Est. HR Department Budget (in 000s USD)': 'zi_est_hr_budget_thousands',

    # ZoomInfo employees
    'Employees': 'zi_employees',
    'Employee Range': 'zi_employee_range',
    'Past 1 Year Employee Growth Rate': 'zi_employee_growth_1yr',
    'Past 2 Year Employee Growth Rate': 'zi_employee_growth_2yr',

    # ZoomInfo industry
    'SIC Code 1': 'zi_sic_code_1',
    'SIC Code 2': 'zi_sic_code_2',
    'SIC Codes': 'zi_sic_codes',
    'NAICS Code 1': 'zi_naics_code_1',
    'NAICS Code 2': 'zi_naics_code_2',
    'NAICS Codes': 'zi_naics_codes',
    'Primary Industry': 'zi_primary_industry',
    'Primary Sub-Industry': 'zi_primary_sub_industry',
    'All Industries': 'zi_all_industries',
    'All Sub-Industries': 'zi_all_sub_industries',
    'Industry Hierarchical Category': 'zi_industry_hierarchical_category',
    'Secondary Industry Hierarchical Category': 'zi_secondary_industry_hierarchical_category',

    # ZoomInfo digital presence
    'Alexa Rank': 'zi_alexa_rank',
    'ZoomInfo Company Profile URL': 'zi_profile_url',
    'LinkedIn Company Profile URL': 'zi_linkedin_url',
    'Facebook Company Profile URL': 'zi_facebook_url',
    'Twitter Company Profile URL': 'zi_twitter_url',

    # ZoomInfo corporate
    'Ownership Type': 'zi_ownership_type',
    'Business Model': 'zi_business_model',
    'Certified Active Company': 'zi_certified_active',
    'Certification Date': 'zi_certification_date',
    'Defunct Company': 'zi_defunct_company',
    'Company Is Acquired': 'zi_company_is_acquired',
    'Number of Locations': 'zi_number_of_locations',

    # ZoomInfo funding
    'Total Funding Amount (in 000s USD)': 'zi_total_funding_thousands',
    'Recent Funding Amount (in 000s USD)': 'zi_recent_funding_thousands',
    'Recent Funding Round': 'zi_recent_funding_round',
    'Recent Funding Date': 'zi_recent_funding_date',
    'Recent Investors': 'zi_recent_investors',
    'All Investors': 'zi_all_investors',

    # ZoomInfo address
    'Company Street Address': 'zi_street_address',
    'Company City': 'zi_city',
    'Company State': 'zi_state',
    'Company Zip Code': 'zi_zip_code',
    'Company Country': 'zi_country',
    'Full Address': 'zi_full_address',

    # ZoomInfo corporate hierarchy
    'Company ID (Ultimate Parent)': 'zi_ultimate_parent_id',
    'Entity Name (Ultimate Parent)': 'zi_ultimate_parent_name',
    'Company ID (Immediate Parent)': 'zi_immediate_parent_id',
    'Entity Name (Immediate Parent)': 'zi_immediate_parent_name',
    'Relationship (Immediate Parent)': 'zi_immediate_parent_relationship',

    # ZoomInfo match quality
    'Match status': 'zi_match_status',
    'Company Name Match Insight': 'zi_match_insight_name',
    'Company Domain Match Insight': 'zi_match_insight_domain',
    'Company Address Match Insight': 'zi_match_insight_address',
    'Company Phone Match Insight': 'zi_match_insight_phone',
    'Company ID Match Insight': 'zi_match_insight_id',
    'Company Social URL Match Insight': 'zi_match_insight_social',
}

# =============================================================================
# HELPERS
# =============================================================================

def clean_value(val):
    """Clean a value for JSON serialization."""
    if pd.isna(val) or val == '' or val == 'null':
        return None
    if isinstance(val, float) and val != val:  # NaN check
        return None
    return val

def clean_domain(domain):
    """Clean and normalize domain."""
    if not domain or pd.isna(domain):
        return None
    domain = str(domain).strip().lower()
    domain = domain.replace('www.', '').rstrip('/')
    if '.' not in domain:
        return None
    return domain

def to_bool(val):
    """Convert to boolean."""
    if pd.isna(val):
        return False
    return str(val).lower() == 'true'

def to_int(val):
    """Convert to integer."""
    if pd.isna(val) or val == '':
        return None
    try:
        return int(float(str(val).replace(',', '')))
    except (ValueError, TypeError):
        return None

def to_float(val):
    """Convert to float."""
    if pd.isna(val) or val == '':
        return None
    try:
        return float(str(val).replace(',', ''))
    except (ValueError, TypeError):
        return None

def map_row(row):
    """Map a DataFrame row to database columns."""
    record = {}

    for csv_col, db_col in COLUMN_MAP.items():
        if csv_col not in row:
            continue

        val = row[csv_col]

        # Handle boolean columns
        if db_col.startswith('has_'):
            record[db_col] = to_bool(val)
        # Handle integer columns
        elif db_col in ['days_in_journey_stage', 'engaged_known_people', 'acc_id',
                        'zi_founded_year', 'zi_employees', 'zi_alexa_rank',
                        'zi_number_of_locations', 'revenue', 'traffic',
                        'zi_revenue_thousands', 'zi_est_marketing_budget_thousands',
                        'zi_est_finance_budget_thousands', 'zi_est_it_budget_thousands',
                        'zi_est_hr_budget_thousands', 'zi_total_funding_thousands',
                        'zi_recent_funding_thousands', 'zoominfo_company_id']:
            record[db_col] = to_int(val)
        # Handle float columns
        elif db_col in ['engagement_points_3mo', 'expected_revenue', 'arr',
                        'zi_employee_growth_1yr', 'zi_employee_growth_2yr']:
            record[db_col] = to_float(val)
        # Handle domain specially
        elif db_col == 'domain':
            record[db_col] = clean_domain(val)
        else:
            record[db_col] = clean_value(val)

    # Add source file
    record['source_file'] = SOURCE_FILE

    return record

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 60)
    print("WHALE COMPOSITE IMPORT")
    print("=" * 60)

    # Read CSV
    print(f"\nReading CSV: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, dtype=str)  # Read all as string first
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")

    # Map rows
    print("\nMapping rows to database schema...")
    records = []
    skipped = 0

    for idx, row in df.iterrows():
        mapped = map_row(row)
        if mapped.get('domain'):
            records.append(mapped)
        else:
            skipped += 1

    print(f"Mapped {len(records)} valid records, skipped {skipped}")

    # Deduplicate by domain (keep last occurrence - usually more complete)
    seen_domains = {}
    for record in records:
        domain = record.get('domain')
        if domain:
            seen_domains[domain] = record

    records = list(seen_domains.values())
    print(f"After deduplication: {len(records)} unique domains")

    # Insert in batches
    print(f"\nInserting to Supabase in batches of {BATCH_SIZE}...")

    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'  # Upsert on conflict
    }

    # Use on_conflict to enable proper upsert
    url = f"{SUPABASE_URL}/rest/v1/whale_composite?on_conflict=domain"
    inserted = 0
    errors = 0

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]

        # Convert to JSON, handling any remaining issues
        try:
            payload = json.dumps(batch, default=str)
        except Exception as e:
            print(f"\nJSON error at batch {i // BATCH_SIZE + 1}: {e}")
            errors += len(batch)
            continue

        response = requests.post(url, headers=headers, data=payload)

        if response.status_code in [200, 201]:
            inserted += len(batch)
            sys.stdout.write(f"\rInserted: {inserted}/{len(records)}")
            sys.stdout.flush()
        else:
            print(f"\nBatch {i // BATCH_SIZE + 1} error: {response.status_code}")
            print(response.text[:200])
            errors += len(batch)

    print("\n")
    print("=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"Total records: {len(records)}")
    print(f"Inserted: {inserted}")
    print(f"Errors: {errors}")

    # Verify
    print("\nVerifying...")
    verify_url = f"{SUPABASE_URL}/rest/v1/whale_composite?select=count"
    verify_headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Prefer': 'count=exact'
    }
    verify_response = requests.get(f"{SUPABASE_URL}/rest/v1/whale_composite?select=id", headers=verify_headers)

    if 'content-range' in verify_response.headers:
        count = verify_response.headers['content-range'].split('/')[1]
        print(f"Records in database: {count}")
    else:
        print(f"Records in response: {len(verify_response.json())}")

if __name__ == '__main__':
    main()
