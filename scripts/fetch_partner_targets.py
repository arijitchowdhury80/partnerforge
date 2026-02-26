#!/usr/bin/env python3
"""
PartnerForge: Fetch Displacement Targets from BuiltWith

This script fetches companies using partner technologies (Shopify, Adobe Commerce, etc.)
and filters out existing Algolia customers to create displacement target lists.

Usage:
    python fetch_partner_targets.py --partner "Shopify" --pages 3
"""

import sqlite3
import json
import subprocess
import argparse

import os
DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/data/partnerforge.db"
BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY")
if not BUILTWITH_API_KEY:
    raise ValueError("BUILTWITH_API_KEY environment variable is required")

# Partner technology mapping for BuiltWith
PARTNER_TECH_MAP = {
    "shopify": {
        "builtwith_name": "Shopify",
        "display_name": "Shopify",
        "category": "Ecommerce",
        "icp_tier": 1
    },
    "shopify plus": {
        "builtwith_name": "Shopify Plus",
        "display_name": "Shopify Plus",
        "category": "Ecommerce",
        "icp_tier": 1
    },
    "adobe commerce": {
        "builtwith_name": "Magento",
        "display_name": "Adobe Commerce",
        "category": "Ecommerce",
        "icp_tier": 1
    },
    "adobe aem": {
        "builtwith_name": "Adobe Experience Manager",
        "display_name": "Adobe Experience Manager",
        "category": "CMS",
        "icp_tier": 1
    },
    "commercetools": {
        "builtwith_name": "commercetools",
        "display_name": "commercetools",
        "category": "Ecommerce",
        "icp_tier": 1
    },
    "salesforce commerce cloud": {
        "builtwith_name": "Salesforce Commerce Cloud",
        "display_name": "Salesforce Commerce Cloud",
        "category": "Ecommerce",
        "icp_tier": 1
    },
    "bigcommerce": {
        "builtwith_name": "BigCommerce",
        "display_name": "BigCommerce",
        "category": "Ecommerce",
        "icp_tier": 1
    },
    "vtex": {
        "builtwith_name": "VTEX",
        "display_name": "VTEX",
        "category": "Ecommerce",
        "icp_tier": 1
    },
    "zendesk": {
        "builtwith_name": "Zendesk",
        "display_name": "Zendesk",
        "category": "Support",
        "icp_tier": 3
    },
    "amplience": {
        "builtwith_name": "Amplience",
        "display_name": "Amplience",
        "category": "CMS",
        "icp_tier": 1
    },
    "spryker": {
        "builtwith_name": "Spryker",
        "display_name": "Spryker",
        "category": "Ecommerce",
        "icp_tier": 1
    }
}


def fetch_builtwith_list(tech_name: str, page: int = 0) -> dict:
    """Fetch technology list from BuiltWith lists8 API."""
    url = f"https://api.builtwith.com/lists8/api.json?KEY={BUILTWITH_API_KEY}&TECH={tech_name}&META=yes&OFFSET={page}"

    try:
        result = subprocess.run(
            ['curl', '-s', url],
            capture_output=True,
            text=True,
            timeout=60
        )
        return json.loads(result.stdout)
    except Exception as e:
        print(f"   ❌ Error fetching BuiltWith data: {e}")
        return {}


def get_algolia_customers(conn: sqlite3.Connection) -> set:
    """Get set of domains that are existing Algolia customers."""
    cursor = conn.cursor()
    cursor.execute("SELECT domain FROM companies WHERE is_algolia_customer = 1")
    return {row[0].lower() for row in cursor.fetchall() if row[0]}


def get_existing_targets(conn: sqlite3.Connection, partner_tech: str) -> set:
    """Get set of domains already in displacement_targets for this partner."""
    cursor = conn.cursor()
    cursor.execute("SELECT domain FROM displacement_targets WHERE partner_tech = ?", (partner_tech,))
    return {row[0].lower() for row in cursor.fetchall() if row[0]}


def insert_displacement_target(conn: sqlite3.Connection, target: dict, partner_tech: str):
    """Insert a new displacement target."""
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO displacement_targets (
                domain, company_name, partner_tech, vertical, country, city, state,
                tech_spend, emails, phones, socials, exec_titles
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            target.get("domain", "").lower(),
            target.get("company_name"),
            partner_tech,
            target.get("vertical"),
            target.get("country"),
            target.get("city"),
            target.get("state"),
            target.get("tech_spend"),
            json.dumps(target.get("emails", [])) if target.get("emails") else None,
            json.dumps(target.get("phones", [])) if target.get("phones") else None,
            json.dumps(target.get("socials", {})) if target.get("socials") else None,
            json.dumps(target.get("exec_titles", [])) if target.get("exec_titles") else None
        ))
        return True
    except sqlite3.IntegrityError:
        return False  # Already exists


def parse_builtwith_record(record: dict) -> dict:
    """Parse a BuiltWith record into our format."""
    domain = record.get("D", "")

    # Extract attributes
    attributes = record.get("A", [])
    attr_map = {}
    for attr in attributes:
        key = attr.get("N", "")
        value = attr.get("V", "")
        attr_map[key] = value

    # Extract contacts
    contacts = record.get("C", [])
    emails = []
    phones = []
    for contact in contacts:
        if contact.get("E"):
            emails.append(contact["E"])
        if contact.get("P"):
            phones.append(contact["P"])

    # Extract social profiles
    socials = {}
    social_data = record.get("S", [])
    for social in social_data:
        if social.get("T") and social.get("U"):
            socials[social["T"]] = social["U"]

    # Extract executive titles
    titles = []
    people = record.get("P", [])
    for person in people:
        if person.get("T"):
            titles.append(person["T"])

    return {
        "domain": domain.lower(),
        "company_name": attr_map.get("Company Name", domain),
        "vertical": attr_map.get("Category", attr_map.get("Vertical")),
        "country": attr_map.get("Country"),
        "city": attr_map.get("City"),
        "state": attr_map.get("State"),
        "tech_spend": int(attr_map.get("Spend", 0)) if attr_map.get("Spend") else None,
        "emails": emails[:5],  # Limit to 5
        "phones": phones[:3],  # Limit to 3
        "socials": socials,
        "exec_titles": titles[:5]  # Limit to 5
    }


def fetch_partner_targets(partner_key: str, max_pages: int = 3, conn: sqlite3.Connection = None):
    """Fetch and import displacement targets for a partner technology."""
    partner_key = partner_key.lower()

    if partner_key not in PARTNER_TECH_MAP:
        print(f"❌ Unknown partner: {partner_key}")
        print(f"   Available partners: {', '.join(PARTNER_TECH_MAP.keys())}")
        return

    partner_info = PARTNER_TECH_MAP[partner_key]
    builtwith_name = partner_info["builtwith_name"]
    display_name = partner_info["display_name"]

    print(f"\n🔍 Fetching {display_name} users from BuiltWith...")

    # Get existing data
    if conn is None:
        conn = sqlite3.connect(DB_PATH)

    algolia_customers = get_algolia_customers(conn)
    existing_targets = get_existing_targets(conn, display_name)

    print(f"   📊 Existing Algolia customers: {len(algolia_customers)}")
    print(f"   📊 Existing {display_name} targets: {len(existing_targets)}")

    total_fetched = 0
    total_imported = 0
    total_filtered_algolia = 0
    total_duplicates = 0

    for page in range(max_pages):
        print(f"\n   📥 Fetching page {page + 1}/{max_pages}...")

        data = fetch_builtwith_list(builtwith_name, page)

        if not data:
            print(f"   ⚠️ No data returned for page {page + 1}")
            continue

        # Check for errors
        if data.get("Errors"):
            print(f"   ❌ API Error: {data['Errors']}")
            break

        # Get results
        results = data.get("Results", [])
        total_fetched += len(results)

        print(f"   📦 Received {len(results)} records")

        for record in results:
            target = parse_builtwith_record(record)

            if not target["domain"]:
                continue

            # Filter out Algolia customers
            if target["domain"] in algolia_customers:
                total_filtered_algolia += 1
                continue

            # Filter out already imported
            if target["domain"] in existing_targets:
                total_duplicates += 1
                continue

            # Insert new target
            if insert_displacement_target(conn, target, display_name):
                total_imported += 1
                existing_targets.add(target["domain"])

        conn.commit()

    # Summary
    print(f"\n{'='*50}")
    print(f"📊 IMPORT SUMMARY: {display_name}")
    print(f"{'='*50}")
    print(f"   Total fetched:           {total_fetched:,}")
    print(f"   Filtered (Algolia):      {total_filtered_algolia:,}")
    print(f"   Filtered (duplicates):   {total_duplicates:,}")
    print(f"   New targets imported:    {total_imported:,}")

    # Count total targets for this partner
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE partner_tech = ?", (display_name,))
    total_count = cursor.fetchone()[0]
    print(f"   Total {display_name} targets: {total_count:,}")

    return total_imported


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Fetch displacement targets from BuiltWith')
    parser.add_argument('--partner', '-p', required=True, help='Partner technology name')
    parser.add_argument('--pages', '-n', type=int, default=3, help='Number of pages to fetch (900 results/page)')

    args = parser.parse_args()

    print("🚀 PartnerForge: Displacement Target Fetcher")
    print(f"   Partner: {args.partner}")
    print(f"   Pages: {args.pages}")

    conn = sqlite3.connect(DB_PATH)

    fetch_partner_targets(args.partner, args.pages, conn)

    conn.close()
    print("\n✅ Done!")
