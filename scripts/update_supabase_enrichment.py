#!/usr/bin/env python3
"""
Update Supabase with enrichment data from JSON files.
Uses service_role key for write access.
"""

import json
import os
import requests
from datetime import datetime

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
    if response.status_code in (200, 204):
        return True
    else:
        print(f"  Error updating {domain}: {response.status_code} - {response.text}")
        return False

def calculate_icp_score(traffic: float, revenue: float = None, is_public: bool = False) -> int:
    """Calculate ICP score based on traffic and revenue."""
    score = 20  # Base score

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

    # Public company bonus (0-10 points)
    if is_public:
        score += 10

    # Partner tech bonus (already accounted for in base)
    score += 10  # Adobe AEM targets

    return min(score, 100)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "data")

    # Load enrichment data
    json_file = os.path.join(data_dir, "enrichment_10_companies.json")
    if not os.path.exists(json_file):
        print(f"Error: {json_file} not found")
        return

    with open(json_file, "r") as f:
        companies = json.load(f)

    print(f"Loaded {len(companies)} companies from enrichment JSON")
    print("=" * 60)

    updated = 0
    failed = 0

    for company in companies:
        domain = company["company"]["domain"]
        ticker = company["company"].get("ticker")
        is_public = not company["company"].get("private", True)

        # Extract data
        sw_data = company.get("similarweb", {})
        yahoo_data = company.get("yahoo", {})

        traffic = sw_data.get("total_visits", 0)
        revenue = yahoo_data.get("revenue")
        market_cap = yahoo_data.get("market_cap")
        employees = yahoo_data.get("employees")
        competitors = sw_data.get("top_competitors", [])

        # Calculate ICP score
        icp_score = calculate_icp_score(traffic, revenue, is_public)

        # Prepare update payload
        update_data = {
            "sw_monthly_visits": int(traffic) if traffic else None,
            "icp_score": icp_score,
            "last_enriched": datetime.now().isoformat(),
            "enrichment_level": "full" if revenue else "traffic",
        }

        if ticker:
            update_data["ticker"] = ticker
        if is_public:
            update_data["is_public"] = True
        if revenue:
            update_data["revenue"] = revenue
        # Note: competitors column doesn't exist in current schema
        # if competitors:
        #     update_data["competitors"] = ",".join(competitors[:5])

        print(f"\n{domain}:")
        print(f"  Traffic: {traffic:,.0f} | Revenue: ${revenue:,.0f}" if revenue else f"  Traffic: {traffic:,.0f} | Revenue: N/A")
        print(f"  ICP Score: {icp_score} | Public: {is_public}")

        if update_target(domain, update_data):
            print(f"  ✓ Updated")
            updated += 1
        else:
            failed += 1

    print("\n" + "=" * 60)
    print(f"Updated: {updated} | Failed: {failed}")

if __name__ == "__main__":
    main()
