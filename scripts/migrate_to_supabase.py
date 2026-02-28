#!/usr/bin/env python3
"""
Migrate Arian data from SQLite to Supabase
"""

import sqlite3
import json
import requests
from datetime import datetime

# Supabase config
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"

# SQLite path
SQLITE_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/Arian/data/arian.db"

def get_sqlite_data():
    """Export all data from SQLite."""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM displacement_targets")
    rows = cursor.fetchall()

    data = []
    for row in rows:
        record = dict(row)
        # Convert SQLite id to avoid conflicts
        record.pop('id', None)
        # Clean up None values
        for key, value in record.items():
            if value == '':
                record[key] = None
        data.append(record)

    conn.close()
    return data


def create_table_sql():
    """Generate Supabase-compatible CREATE TABLE SQL."""
    return """
-- Drop existing table if exists
DROP TABLE IF EXISTS displacement_targets;

-- Create displacement_targets table
CREATE TABLE displacement_targets (
    id BIGSERIAL PRIMARY KEY,
    domain TEXT UNIQUE NOT NULL,
    company_name TEXT,
    partner_tech TEXT,
    vertical TEXT,
    country TEXT,
    city TEXT,
    state TEXT,
    tech_spend INTEGER,
    emails TEXT,
    phones TEXT,
    socials TEXT,
    exec_titles TEXT,

    -- SimilarWeb data
    sw_monthly_visits INTEGER,
    sw_bounce_rate REAL,
    sw_pages_per_visit REAL,
    sw_avg_duration INTEGER,
    sw_search_traffic_pct REAL,
    sw_rank_global INTEGER,

    -- Matching
    matched_case_studies TEXT,
    lead_score INTEGER,

    -- ICP scoring
    icp_tier INTEGER,
    icp_score INTEGER,
    score_reasons TEXT,
    icp_tier_name TEXT,
    score_breakdown TEXT,

    -- Company info
    ticker TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    enrichment_level TEXT DEFAULT 'basic',
    last_enriched TIMESTAMPTZ,
    revenue REAL,
    gross_margin REAL,
    traffic_growth REAL,
    current_search TEXT,

    -- Intelligence
    trigger_events TEXT,
    exec_quote TEXT,
    exec_name TEXT,
    exec_title TEXT,
    quote_source TEXT,
    competitors_using_algolia TEXT,
    displacement_angle TEXT,
    financials_json TEXT,
    hiring_signals TEXT,
    tech_stack_json TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_displacement_targets_partner ON displacement_targets(partner_tech);
CREATE INDEX idx_displacement_targets_icp ON displacement_targets(icp_score DESC);
CREATE INDEX idx_displacement_targets_vertical ON displacement_targets(vertical);

-- Enable Row Level Security (optional, disabled for now)
-- ALTER TABLE displacement_targets ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON displacement_targets
    FOR SELECT USING (true);
"""


def insert_to_supabase(data):
    """Insert data into Supabase using REST API."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    url = f"{SUPABASE_URL}/rest/v1/displacement_targets"

    # Insert in batches of 100
    batch_size = 100
    total = len(data)
    inserted = 0
    errors = []

    for i in range(0, total, batch_size):
        batch = data[i:i+batch_size]

        # Clean up data for Supabase
        clean_batch = []
        for record in batch:
            clean = {}
            for k, v in record.items():
                # Convert is_public to boolean
                if k == 'is_public':
                    clean[k] = bool(v) if v is not None else False
                # Skip None timestamps that would fail
                elif k == 'last_enriched' and v is None:
                    continue
                elif k == 'created_at' and v is None:
                    continue
                else:
                    clean[k] = v
            clean_batch.append(clean)

        response = requests.post(url, headers=headers, json=clean_batch)

        if response.status_code in [200, 201]:
            inserted += len(batch)
            print(f"  Inserted {inserted}/{total} records...")
        else:
            errors.append({
                "batch": i,
                "status": response.status_code,
                "error": response.text[:500]
            })
            print(f"  Error at batch {i}: {response.status_code}")
            print(f"    {response.text[:200]}")

    return inserted, errors


def main():
    print("=" * 60)
    print("Arian: SQLite to Supabase Migration")
    print("=" * 60)

    # Step 1: Get SQLite data
    print("\n1. Exporting data from SQLite...")
    data = get_sqlite_data()
    print(f"   Found {len(data)} records")

    # Step 2: Print CREATE TABLE SQL
    print("\n2. Table creation SQL (run this in Supabase SQL Editor):")
    print("-" * 60)
    print(create_table_sql())
    print("-" * 60)

    # Step 3: Wait for user confirmation
    print("\n3. After creating the table in Supabase, press Enter to continue...")
    print("   (Or Ctrl+C to abort)")

    try:
        input()
    except KeyboardInterrupt:
        print("\nAborted.")
        return

    # Step 4: Insert data
    print("\n4. Inserting data into Supabase...")
    inserted, errors = insert_to_supabase(data)

    print(f"\n5. Migration complete!")
    print(f"   Total records: {len(data)}")
    print(f"   Inserted: {inserted}")
    print(f"   Errors: {len(errors)}")

    if errors:
        print("\n   Error details:")
        for err in errors[:5]:
            print(f"     Batch {err['batch']}: {err['status']} - {err['error'][:100]}")


if __name__ == "__main__":
    main()
