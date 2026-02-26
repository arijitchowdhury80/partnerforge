#!/usr/bin/env python3
"""
PartnerForge: Fetch Displacement Targets from BuiltWith (Supabase Version)

Fetches companies using partner technologies and stores in Supabase.

Usage:
    python fetch_partner_targets_supabase.py --partner "salesforce commerce cloud" --pages 3
    python fetch_partner_targets_supabase.py --partner "all" --pages 2
"""

import json
import subprocess
import argparse
import requests
from datetime import datetime

# Supabase config
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
BUILTWITH_API_KEY = "8fd992ef-88d0-4554-a20b-364e97b2d302"

# Partner technology mapping for BuiltWith
PARTNER_TECH_MAP = {
    "shopify": {
        "builtwith_name": "Shopify",
        "display_name": "Shopify",
        "category": "Ecommerce",
        "partner_id": 5,
        "icp_tier": 1
    },
    "shopify plus": {
        "builtwith_name": "Shopify Plus",
        "display_name": "Shopify Plus",
        "category": "Ecommerce",
        "partner_id": 5,
        "icp_tier": 1
    },
    "adobe commerce": {
        "builtwith_name": "Magento",
        "display_name": "Adobe Commerce",
        "category": "Ecommerce",
        "partner_id": 2,
        "icp_tier": 1
    },
    "adobe aem": {
        "builtwith_name": "Adobe Experience Manager",
        "display_name": "Adobe Experience Manager",
        "category": "CMS",
        "partner_id": 1,
        "icp_tier": 1
    },
    "commercetools": {
        "builtwith_name": "commercetools",
        "display_name": "Commercetools",
        "category": "Ecommerce",
        "partner_id": 8,
        "icp_tier": 1
    },
    "salesforce commerce cloud": {
        "builtwith_name": "Salesforce Commerce Cloud",
        "display_name": "Salesforce Commerce Cloud",
        "category": "Ecommerce",
        "partner_id": 6,
        "icp_tier": 1
    },
    "sap commerce cloud": {
        "builtwith_name": "SAP Commerce Cloud",
        "display_name": "SAP Commerce Cloud",
        "category": "Ecommerce",
        "partner_id": 7,
        "icp_tier": 1
    },
    "bigcommerce": {
        "builtwith_name": "BigCommerce",
        "display_name": "BigCommerce",
        "category": "Ecommerce",
        "partner_id": 9,
        "icp_tier": 2
    },
    "vtex": {
        "builtwith_name": "VTEX",
        "display_name": "VTEX",
        "category": "Ecommerce",
        "partner_id": None,
        "icp_tier": 1
    },
    "amplience": {
        "builtwith_name": "Amplience",
        "display_name": "Amplience",
        "category": "CMS",
        "partner_id": 3,
        "icp_tier": 1
    },
    "spryker": {
        "builtwith_name": "Spryker",
        "display_name": "Spryker",
        "category": "Ecommerce",
        "partner_id": 4,
        "icp_tier": 1
    }
}


def supabase_request(method: str, endpoint: str, data=None, params=None):
    """Make a request to Supabase REST API."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal" if method == "POST" else "return=representation"
    }

    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"

    if method == "GET":
        response = requests.get(url, headers=headers, params=params)
    elif method == "POST":
        headers["Prefer"] = "return=minimal,resolution=merge-duplicates"
        response = requests.post(url, headers=headers, json=data)
    elif method == "PATCH":
        response = requests.patch(url, headers=headers, json=data, params=params)
    else:
        raise ValueError(f"Unsupported method: {method}")

    if response.status_code >= 400:
        print(f"   ⚠️ Supabase error: {response.status_code} - {response.text[:200]}")
        return None

    if method == "GET":
        return response.json()
    return response.status_code < 400


def fetch_builtwith_list(tech_name: str, page: int = 0) -> dict:
    """Fetch technology list from BuiltWith lists8 API."""
    url = f"https://api.builtwith.com/lists8/api.json?KEY={BUILTWITH_API_KEY}&TECH={tech_name}&META=yes&OFFSET={page}"

    try:
        result = subprocess.run(
            ['curl', '-s', url],
            capture_output=True,
            text=True,
            timeout=120
        )
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"   ❌ JSON decode error: {e}")
        print(f"   Response: {result.stdout[:500]}")
        return {}
    except Exception as e:
        print(f"   ❌ Error fetching BuiltWith data: {e}")
        return {}


def get_existing_domains() -> set:
    """Get set of domains already in displacement_targets."""
    data = supabase_request("GET", "displacement_targets", params={"select": "domain"})
    if data:
        return {row["domain"].lower() for row in data if row.get("domain")}
    return set()


def get_existing_companies() -> dict:
    """Get existing companies keyed by domain."""
    data = supabase_request("GET", "companies", params={"select": "id,domain"})
    if data:
        return {row["domain"].lower(): row["id"] for row in data if row.get("domain")}
    return {}


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

    # Calculate basic ICP score
    tech_spend = int(attr_map.get("Spend", 0)) if attr_map.get("Spend") else 0
    icp_score = calculate_basic_icp_score(attr_map.get("Category", ""), tech_spend)

    return {
        "domain": domain.lower(),
        "company_name": attr_map.get("Company Name", domain),
        "vertical": attr_map.get("Category", attr_map.get("Vertical", "Unknown")),
        "country": attr_map.get("Country", ""),
        "city": attr_map.get("City", ""),
        "state": attr_map.get("State", ""),
        "tech_spend": tech_spend,
        "emails": json.dumps(emails[:5]) if emails else None,
        "phones": json.dumps(phones[:3]) if phones else None,
        "socials": json.dumps(socials) if socials else None,
        "exec_titles": json.dumps(titles[:5]) if titles else None,
        "icp_score": icp_score,
        "icp_tier": 1 if icp_score >= 80 else 2 if icp_score >= 40 else 3,
        "icp_tier_name": "Commerce" if icp_score >= 80 else "Content" if icp_score >= 40 else "Other",
        "enrichment_level": "basic",
        "last_enriched": datetime.now().isoformat()
    }


def calculate_basic_icp_score(vertical: str, tech_spend: int) -> int:
    """Calculate a basic ICP score based on vertical and tech spend."""
    score = 30  # Base score

    # Vertical scoring
    high_value_verticals = ["Retail", "Commerce", "Fashion", "Shopping", "Marketplace"]
    medium_value_verticals = ["Technology", "Media", "Entertainment", "Finance", "Travel"]

    vertical_lower = vertical.lower() if vertical else ""
    for v in high_value_verticals:
        if v.lower() in vertical_lower:
            score += 30
            break
    else:
        for v in medium_value_verticals:
            if v.lower() in vertical_lower:
                score += 20
                break
        else:
            score += 10

    # Tech spend scoring
    if tech_spend >= 100000:
        score += 30
    elif tech_spend >= 50000:
        score += 25
    elif tech_spend >= 20000:
        score += 20
    elif tech_spend >= 5000:
        score += 15
    elif tech_spend > 0:
        score += 10

    return min(score, 95)  # Cap at 95


def upsert_displacement_target(target: dict, partner_tech: str) -> bool:
    """Upsert a displacement target into Supabase."""
    record = {
        **target,
        "partner_tech": partner_tech
    }

    return supabase_request("POST", "displacement_targets", data=record)


def fetch_partner_targets(partner_key: str, max_pages: int = 3):
    """Fetch and import displacement targets for a partner technology."""
    partner_key = partner_key.lower()

    if partner_key not in PARTNER_TECH_MAP:
        print(f"❌ Unknown partner: {partner_key}")
        print(f"   Available partners: {', '.join(PARTNER_TECH_MAP.keys())}")
        return 0

    partner_info = PARTNER_TECH_MAP[partner_key]
    builtwith_name = partner_info["builtwith_name"]
    display_name = partner_info["display_name"]

    print(f"\n🔍 Fetching {display_name} users from BuiltWith...")

    # Get existing data
    existing_domains = get_existing_domains()
    print(f"   📊 Existing targets in DB: {len(existing_domains)}")

    total_fetched = 0
    total_imported = 0
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

        batch = []
        for record in results:
            target = parse_builtwith_record(record)

            if not target["domain"]:
                continue

            # Skip duplicates
            if target["domain"] in existing_domains:
                total_duplicates += 1
                continue

            target["partner_tech"] = display_name
            batch.append(target)
            existing_domains.add(target["domain"])

        # Batch insert
        if batch:
            # Supabase supports bulk upsert
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal,resolution=merge-duplicates"
            }
            response = requests.post(
                f"{SUPABASE_URL}/rest/v1/displacement_targets",
                headers=headers,
                json=batch
            )

            if response.status_code < 300:
                total_imported += len(batch)
                print(f"   ✅ Imported {len(batch)} new targets")
            else:
                print(f"   ⚠️ Batch insert error: {response.status_code} - {response.text[:200]}")

    # Summary
    print(f"\n{'='*50}")
    print(f"📊 IMPORT SUMMARY: {display_name}")
    print(f"{'='*50}")
    print(f"   Total fetched:           {total_fetched:,}")
    print(f"   Filtered (duplicates):   {total_duplicates:,}")
    print(f"   New targets imported:    {total_imported:,}")

    return total_imported


def fetch_all_partners(max_pages: int = 2):
    """Fetch targets for all partners."""
    partners_to_fetch = [
        "salesforce commerce cloud",
        "sap commerce cloud",
        "shopify",
        "bigcommerce",
        "commercetools",
    ]

    total = 0
    for partner in partners_to_fetch:
        count = fetch_partner_targets(partner, max_pages)
        total += count

    print(f"\n{'='*50}")
    print(f"🎉 TOTAL NEW TARGETS: {total:,}")
    print(f"{'='*50}")
    return total


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Fetch displacement targets from BuiltWith')
    parser.add_argument('--partner', '-p', required=True, help='Partner technology name or "all"')
    parser.add_argument('--pages', '-n', type=int, default=2, help='Number of pages to fetch (900 results/page)')

    args = parser.parse_args()

    print("🚀 PartnerForge: Displacement Target Fetcher (Supabase)")
    print(f"   Partner: {args.partner}")
    print(f"   Pages: {args.pages}")

    if args.partner.lower() == "all":
        fetch_all_partners(args.pages)
    else:
        fetch_partner_targets(args.partner, args.pages)

    print("\n✅ Done!")
