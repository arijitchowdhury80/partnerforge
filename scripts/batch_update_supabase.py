#!/usr/bin/env python3
"""
Batch update Supabase with enrichment data from multiple JSON files.
Handles various JSON formats produced by enrichment agents.
"""

import json
import os
import requests
from datetime import datetime
from glob import glob

# Supabase credentials
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA4NTU0MCwiZXhwIjoyMDg3NjYxNTQwfQ.tVnqtUbxS55dNnUiKY6_LBqVYYLhGztWoagg-efc3Ac"

def update_target(domain: str, data: dict) -> bool:
    """Update a single target in Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.{domain}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    response = requests.patch(url, headers=headers, json=data)
    return response.status_code in (200, 204)

def calculate_icp_score(traffic: float = 0, revenue: float = 0, is_public: bool = False) -> int:
    """Calculate ICP score based on traffic and revenue."""
    score = 30  # Base score for Adobe AEM targets

    # Traffic component (0-30 points)
    if traffic:
        if traffic >= 50_000_000:
            score += 30
        elif traffic >= 20_000_000:
            score += 25
        elif traffic >= 10_000_000:
            score += 20
        elif traffic >= 5_000_000:
            score += 15
        elif traffic >= 1_000_000:
            score += 10
        elif traffic >= 500_000:
            score += 5

    # Revenue component (0-30 points)
    if revenue:
        if revenue >= 10_000_000_000:  # $10B+
            score += 30
        elif revenue >= 5_000_000_000:  # $5B+
            score += 25
        elif revenue >= 1_000_000_000:  # $1B+
            score += 20
        elif revenue >= 500_000_000:   # $500M+
            score += 15
        elif revenue >= 100_000_000:   # $100M+
            score += 10

    # Public company bonus
    if is_public:
        score += 10

    return min(score, 100)

def process_simple_format(data: list) -> list:
    """Process simple format: [{"domain": "x.com", "traffic": 123, ...}]"""
    results = []
    for item in data:
        if not isinstance(item, dict):
            continue
        domain = item.get("domain")
        if not domain:
            continue
        results.append({
            "domain": domain,
            "ticker": item.get("ticker"),
            "is_public": item.get("is_public", False),
            "traffic": item.get("traffic", 0),
            "revenue": item.get("revenue", 0),
            "icp_score": item.get("icp_score")
        })
    return results

def process_nested_format(data: list) -> list:
    """Process nested format from enrichment_10_companies.json"""
    results = []
    for item in data:
        company = item.get("company", {})
        sw = item.get("similarweb", {})
        yahoo = item.get("yahoo", {})

        domain = company.get("domain")
        if not domain:
            continue

        results.append({
            "domain": domain,
            "ticker": company.get("ticker"),
            "is_public": not company.get("private", True),
            "traffic": sw.get("total_visits", 0),
            "revenue": yahoo.get("revenue", 0),
            "icp_score": None  # Will be calculated
        })
    return results

def process_json_file(filepath: str) -> list:
    """Load and process a JSON file, handling different formats."""
    with open(filepath, "r") as f:
        data = json.load(f)

    if not data:
        return []

    # Detect format based on first item
    first = data[0] if isinstance(data, list) else {}

    # Check if "company" is a dict (nested format) or string (simple format)
    if "company" in first and isinstance(first.get("company"), dict):
        return process_nested_format(data)
    else:
        return process_simple_format(data)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "data")

    # Find all enrichment JSON files
    patterns = [
        "enrichment_*.json",
        "batch*.json"
    ]

    json_files = []
    for pattern in patterns:
        json_files.extend(glob(os.path.join(data_dir, pattern)))

    if not json_files:
        print("No enrichment JSON files found")
        return

    print(f"Found {len(json_files)} enrichment files:")
    for f in json_files:
        print(f"  - {os.path.basename(f)}")
    print()

    total_updated = 0
    total_failed = 0

    for json_file in json_files:
        print(f"\n{'='*60}")
        print(f"Processing: {os.path.basename(json_file)}")
        print('='*60)

        try:
            companies = process_json_file(json_file)
        except Exception as e:
            print(f"Error loading {json_file}: {e}")
            continue

        for company in companies:
            domain = company["domain"]
            traffic = company.get("traffic", 0) or 0
            revenue = company.get("revenue", 0) or 0
            is_public = company.get("is_public", False)
            ticker = company.get("ticker")

            # Calculate ICP if not provided
            icp_score = company.get("icp_score")
            if not icp_score:
                icp_score = calculate_icp_score(traffic, revenue, is_public)

            # Prepare update
            update_data = {
                "sw_monthly_visits": int(traffic) if traffic else None,
                "icp_score": icp_score,
                "last_enriched": datetime.now().isoformat(),
                "enrichment_level": "full" if revenue else ("traffic" if traffic else "basic"),
            }

            if ticker:
                update_data["ticker"] = ticker
            if is_public:
                update_data["is_public"] = True
            if revenue:
                update_data["revenue"] = revenue

            print(f"{domain}: ", end="")

            if update_target(domain, update_data):
                print(f"✓ ICP={icp_score}")
                total_updated += 1
            else:
                print("✗ Failed")
                total_failed += 1

    print(f"\n{'='*60}")
    print(f"TOTAL: Updated {total_updated}, Failed {total_failed}")
    print('='*60)

if __name__ == "__main__":
    main()
