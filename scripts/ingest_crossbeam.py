#!/usr/bin/env python3
"""
Ingest Crossbeam CSV into Supabase

Usage:
    export SUPABASE_SERVICE_KEY="your-service-role-key"
    python3 scripts/ingest_crossbeam.py
"""

import csv
import json
import os
import re
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# Configuration
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
CSV_PATH = "data/Algolias_Prospects_vs_Adobe_SITES_Customerss_Customers_2026-02-27_0442AM_286.csv"

def get_service_key():
    """Get service role key from environment"""
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not key:
        print("ERROR: Set SUPABASE_SERVICE_KEY environment variable")
        print("Get it from: https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/settings/api")
        sys.exit(1)
    return key

def clean_domain(url):
    """Extract clean domain from URL"""
    if not url:
        return None
    domain = url.lower().strip()
    domain = re.sub(r'^https?://', '', domain)
    domain = re.sub(r'^www\.', '', domain)
    domain = re.sub(r'/.*$', '', domain)
    return domain if domain else None

def parse_date(date_str):
    """Parse Crossbeam date format"""
    if not date_str or date_str == '()':
        return None
    match = re.search(r'"(\d{4}-\d{2}-\d{2}T[^"]+)"', date_str)
    return match.group(1) if match else None

def parse_csv(filepath):
    """Parse CSV and dedupe by domain"""
    records = []
    seen_domains = set()

    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            domain = clean_domain(row.get('Adobe SITES Customers: Company Website', ''))

            if not domain or domain in seen_domains:
                continue
            seen_domains.add(domain)

            record = {
                'domain': domain,
                'company_name': row.get('Adobe SITES Customers: Company Name') or row.get('Record', ''),
                'record_name': row.get('Record', ''),
                'algolia_status': row.get('Our Populations', ''),
                'partner_status': row.get('Partner Populations', ''),
                'partner_name': 'Adobe',
                'partner_product': 'AEM',
                'algolia_owner': row.get('Account Owner Name', ''),
                'partner_owner': row.get('Adobe SITES Customers: Account Owner Name', ''),
                'industry': row.get('Adobe SITES Customers: Adobe: industry') or row.get('Industry', ''),
                'geo': row.get('Adobe SITES Customers: Adobe: geo', ''),
                'billing_country': row.get('Billing Country', ''),
                'opportunities_amount': float(row.get('Opportunities Amount', 0) or 0),
                'opportunities_count': int(row.get('Opportunities Count', 0) or 0),
                'overlap_detected_at': parse_date(row.get('Overlap Time', '')),
                'partner_close_date': parse_date(row.get('Adobe SITES Customers: Adobe: Close Date', '')),
                'source_file': row.get('Adobe SITES Customers: File Name', ''),
                'uploaded_at': parse_date(row.get('Adobe SITES Customers: Upload Time', '')),
            }
            records.append(record)

    return records

def insert_batch(records, service_key):
    """Insert a batch of records into Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/crossbeam_overlaps"

    headers = {
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
    }

    data = json.dumps(records).encode('utf-8')
    req = Request(url, data=data, headers=headers, method='POST')

    try:
        with urlopen(req) as response:
            return True, response.status
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        return False, f"{e.code}: {error_body}"

def main():
    print("=" * 60)
    print("CROSSBEAM DATA INGESTION")
    print("=" * 60)

    # Get service key
    service_key = get_service_key()
    print(f"✓ Service key configured")

    # Parse CSV
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, '..', CSV_PATH)

    print(f"\nReading CSV: {CSV_PATH}")
    records = parse_csv(csv_path)
    print(f"✓ Parsed {len(records)} unique domains")

    # Show sample
    print("\nSample records:")
    for r in records[:3]:
        print(f"  {r['domain']} | {r['company_name'][:30]} | {r['industry'][:20]} | {r['geo']}")

    # Insert in batches
    print(f"\nInserting into Supabase...")
    batch_size = 100
    inserted = 0
    errors = 0

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        success, result = insert_batch(batch, service_key)

        if success:
            inserted += len(batch)
        else:
            print(f"  Batch {i // batch_size + 1} failed: {result}")
            errors += len(batch)

        # Progress every 5 batches
        if (i // batch_size + 1) % 5 == 0:
            print(f"  Progress: {inserted} inserted, {errors} errors")

    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {inserted} inserted, {errors} errors")
    print(f"{'=' * 60}")

if __name__ == '__main__':
    main()
