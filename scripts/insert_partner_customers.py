#!/usr/bin/env python3
"""
PartnerForge: Insert Known Partner Customers into Supabase

This script inserts verified Amplience and Spryker customers into the
displacement_targets table. These are known customers from case studies.

Usage:
    python3 insert_partner_customers.py
"""

import requests
import json
from datetime import datetime

# Supabase config
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"

# Known Amplience customers from case studies
AMPLIENCE_CUSTOMERS = [
    {"domain": "otto.de", "company_name": "Otto Group", "country": "Germany", "vertical": "Retail"},
    {"domain": "clarks.com", "company_name": "Clarks", "country": "UK", "vertical": "Fashion/Footwear"},
    {"domain": "very.co.uk", "company_name": "The Very Group", "country": "UK", "vertical": "Retail"},
    {"domain": "dfs.co.uk", "company_name": "DFS", "country": "UK", "vertical": "Furniture"},
    {"domain": "traeger.com", "company_name": "Traeger Grills", "country": "USA", "vertical": "Consumer Goods"},
    {"domain": "shoecarnival.com", "company_name": "Shoe Carnival", "country": "USA", "vertical": "Retail/Footwear"},
    {"domain": "mulberry.com", "company_name": "Mulberry", "country": "UK", "vertical": "Luxury Fashion"},
    {"domain": "crateandbarrel.com", "company_name": "Crate & Barrel", "country": "USA", "vertical": "Home/Furniture"},
    {"domain": "landmarkgroup.com", "company_name": "Landmark Group", "country": "UAE", "vertical": "Retail"},
    {"domain": "jcrew.com", "company_name": "J.Crew", "country": "USA", "vertical": "Fashion"},
    {"domain": "boohoo.com", "company_name": "Boohoo", "country": "UK", "vertical": "Fashion"},
    {"domain": "prettylittlething.com", "company_name": "PrettyLittleThing", "country": "UK", "vertical": "Fashion"},
    {"domain": "missguided.com", "company_name": "Missguided", "country": "UK", "vertical": "Fashion"},
    {"domain": "next.co.uk", "company_name": "Next", "country": "UK", "vertical": "Retail"},
    {"domain": "riverisland.com", "company_name": "River Island", "country": "UK", "vertical": "Fashion"},
]

# Known Spryker customers from case studies
SPRYKER_CUSTOMERS = [
    {"domain": "siemens-healthineers.com", "company_name": "Siemens Healthineers", "country": "Germany", "vertical": "Healthcare"},
    {"domain": "swisskrono.com", "company_name": "SWISS KRONO", "country": "Switzerland", "vertical": "Manufacturing"},
    {"domain": "loeffelhardt.de", "company_name": "Emil Löffelhardt", "country": "Germany", "vertical": "Industrial Supplies"},
    {"domain": "jungheinrich.com", "company_name": "Jungheinrich", "country": "Germany", "vertical": "Industrial Equipment"},
    {"domain": "stauff.com", "company_name": "STAUFF", "country": "Germany", "vertical": "Industrial Components"},
    {"domain": "pferdusa.com", "company_name": "PFERD", "country": "Germany", "vertical": "Industrial Tools"},
    {"domain": "optibelt.com", "company_name": "Optibelt", "country": "Germany", "vertical": "Manufacturing"},
    {"domain": "koczer.com", "company_name": "KoçZer", "country": "Turkey", "vertical": "Retail"},
    {"domain": "daimlertruck.com", "company_name": "Daimler Truck", "country": "Germany", "vertical": "Automotive"},
    {"domain": "meusburger.com", "company_name": "Meusburger", "country": "Austria", "vertical": "Industrial/Manufacturing"},
    {"domain": "rosebikes.com", "company_name": "ROSE Bikes", "country": "Germany", "vertical": "Sports/Cycling"},
    {"domain": "lumas.com", "company_name": "Lumas", "country": "Germany", "vertical": "Art/Photography"},
    {"domain": "koempf24.de", "company_name": "Kömpf", "country": "Germany", "vertical": "Home/Garden"},
    {"domain": "lekkerland.com", "company_name": "Lekkerland", "country": "Germany", "vertical": "Wholesale/Distribution"},
    {"domain": "slv.de", "company_name": "SLV", "country": "Germany", "vertical": "Lighting"},
    {"domain": "hardeck.de", "company_name": "HARDECK", "country": "Germany", "vertical": "Furniture"},
    {"domain": "aldi-sued.de", "company_name": "Aldi Süd", "country": "Germany", "vertical": "Retail/Grocery"},
    {"domain": "metro.de", "company_name": "Metro", "country": "Germany", "vertical": "Wholesale"},
    {"domain": "toyotamaterial.com", "company_name": "Toyota Material Handling", "country": "Japan", "vertical": "Industrial Equipment"},
    {"domain": "prym.com", "company_name": "Prym", "country": "Germany", "vertical": "Crafts/Sewing"},
]


def get_existing_domains():
    """Get set of domains already in displacement_targets."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }

    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/displacement_targets?select=domain",
        headers=headers
    )

    if response.status_code == 200:
        data = response.json()
        return {row["domain"].lower() for row in data if row.get("domain")}
    return set()


def insert_targets(targets: list, partner_tech: str):
    """Insert targets into Supabase."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=merge-duplicates"
    }

    existing = get_existing_domains()

    # Prepare batch
    batch = []
    for target in targets:
        if target["domain"].lower() in existing:
            print(f"   ⏭️  Skipping {target['domain']} (already exists)")
            continue

        record = {
            "domain": target["domain"].lower(),
            "company_name": target["company_name"],
            "partner_tech": partner_tech,
            "vertical": target.get("vertical", "Unknown"),
            "country": target.get("country", ""),
            "icp_score": 50,  # Default score for case study customers
            "icp_tier": 2,
            "icp_tier_name": "Commerce" if partner_tech == "Amplience" else "B2B Commerce",
            "enrichment_level": "basic",
            "last_enriched": datetime.now().isoformat()
        }
        batch.append(record)

    if not batch:
        print(f"   ℹ️  No new targets to insert for {partner_tech}")
        return 0

    # Batch insert
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/displacement_targets",
        headers=headers,
        json=batch
    )

    if response.status_code < 300:
        print(f"   ✅ Inserted {len(batch)} new {partner_tech} targets")
        return len(batch)
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text[:200]}")
        return 0


def main():
    print("🚀 PartnerForge: Inserting Known Partner Customers")
    print("=" * 50)

    # Insert Amplience customers
    print(f"\n📦 AMPLIENCE ({len(AMPLIENCE_CUSTOMERS)} customers)")
    amplience_count = insert_targets(AMPLIENCE_CUSTOMERS, "Amplience")

    # Insert Spryker customers
    print(f"\n📦 SPRYKER ({len(SPRYKER_CUSTOMERS)} customers)")
    spryker_count = insert_targets(SPRYKER_CUSTOMERS, "Spryker")

    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    print(f"   Amplience: {amplience_count} new targets")
    print(f"   Spryker:   {spryker_count} new targets")
    print(f"   TOTAL:     {amplience_count + spryker_count} new targets")
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
