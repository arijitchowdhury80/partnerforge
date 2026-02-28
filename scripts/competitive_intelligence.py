#!/usr/bin/env python3
"""
Arian: Competitive Intelligence Pipeline

This pipeline combines:
1. SimilarWeb - Get competitors for a target company
2. BuiltWith - Detect technologies on each competitor
3. Analysis - Find Shopify/AEM users NOT using Algolia

Usage:
    python competitive_intelligence.py --domain costco.com --partner shopify
    python competitive_intelligence.py --domain target.com --partner "adobe commerce"
"""

import subprocess
import json
import argparse
import sqlite3
from typing import Dict, List, Tuple
import time

# API Keys from environment variables
import os
SIMILARWEB_API_KEY = os.getenv("SIMILARWEB_API_KEY")
BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY")

if not SIMILARWEB_API_KEY or not BUILTWITH_API_KEY:
    raise ValueError("SIMILARWEB_API_KEY and BUILTWITH_API_KEY environment variables are required")

DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/Arian/data/arian.db"


def fetch_similarweb_competitors(domain: str) -> List[Dict]:
    """Fetch similar sites from SimilarWeb."""
    url = f"https://api.similarweb.com/v1/website/{domain}/similar-sites/similarsites?api_key={SIMILARWEB_API_KEY}"

    try:
        result = subprocess.run(
            ['curl', '-s', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        data = json.loads(result.stdout)

        # Handle different response formats
        if isinstance(data, dict):
            if "similar_sites" in data:
                return data["similar_sites"]
            elif "error" in data:
                print(f"   ⚠️ SimilarWeb error: {data.get('error')}")
                return []
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"   ❌ SimilarWeb error: {e}")
        return []


def fetch_similarweb_traffic(domain: str) -> Dict:
    """Fetch traffic metrics from SimilarWeb."""
    url = f"https://api.similarweb.com/v1/website/{domain}/total-traffic-and-engagement/visits?api_key={SIMILARWEB_API_KEY}&country=world&granularity=monthly&main_domain_only=false"

    try:
        result = subprocess.run(
            ['curl', '-s', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        data = json.loads(result.stdout)

        if isinstance(data, dict) and "visits" in data:
            visits = data["visits"]
            if visits:
                # Get most recent month
                latest = visits[-1] if isinstance(visits, list) else visits
                return {"monthly_visits": int(latest.get("visits", 0))}
        return {}
    except Exception as e:
        print(f"   ⚠️ Traffic fetch error: {e}")
        return {}


def fetch_builtwith_technologies(domain: str) -> Dict:
    """Fetch technology stack from BuiltWith."""
    url = f"https://api.builtwith.com/v22/api.json?KEY={BUILTWITH_API_KEY}&LOOKUP={domain}"

    try:
        result = subprocess.run(
            ['curl', '-s', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        data = json.loads(result.stdout)

        # Extract technologies
        techs = []
        results = data.get("Results", [])
        if results:
            paths = results[0].get("Result", {}).get("Paths", [])
            for path in paths:
                for tech in path.get("Technologies", []):
                    tech_name = tech.get("Name", "")
                    if tech_name:
                        techs.append({
                            "name": tech_name,
                            "tag": tech.get("Tag", ""),
                            "description": tech.get("Description", "")
                        })

        return {
            "domain": domain,
            "technologies": techs,
            "tech_names": [t["name"] for t in techs]
        }
    except Exception as e:
        print(f"   ❌ BuiltWith error for {domain}: {e}")
        return {"domain": domain, "technologies": [], "tech_names": []}


def detect_search_provider(tech_names: List[str]) -> Tuple[str, bool]:
    """Detect search provider from technology list."""
    search_providers = {
        "Algolia": ["algolia"],
        "Coveo": ["coveo"],
        "Elasticsearch": ["elasticsearch", "elastic"],
        "Searchspring": ["searchspring"],
        "Klevu": ["klevu"],
        "Constructor.io": ["constructor"],
        "Bloomreach": ["bloomreach"],
        "Lucidworks": ["lucidworks"],
        "Doofinder": ["doofinder"],
        "Swiftype": ["swiftype"],
        "Yext": ["yext"]
    }

    tech_names_lower = [t.lower() for t in tech_names]

    for provider, keywords in search_providers.items():
        for keyword in keywords:
            if any(keyword in t for t in tech_names_lower):
                is_algolia = provider == "Algolia"
                return (provider, is_algolia)

    return ("Unknown/Custom", False)


def detect_partner_tech(tech_names: List[str], partner_filter: str = None) -> List[str]:
    """Detect partner technologies from tech list."""
    partner_techs = {
        "Shopify": ["shopify"],
        "Shopify Plus": ["shopify plus"],
        "Adobe Commerce": ["magento", "adobe commerce"],
        "Adobe AEM": ["adobe experience manager", "aem"],
        "commercetools": ["commercetools"],
        "Salesforce Commerce Cloud": ["salesforce commerce", "demandware"],
        "BigCommerce": ["bigcommerce"],
        "SAP Commerce": ["sap commerce", "hybris"],
        "VTEX": ["vtex"]
    }

    tech_names_lower = [t.lower() for t in tech_names]
    found_partners = []

    for partner, keywords in partner_techs.items():
        for keyword in keywords:
            if any(keyword in t for t in tech_names_lower):
                found_partners.append(partner)
                break

    if partner_filter:
        filter_lower = partner_filter.lower()
        return [p for p in found_partners if filter_lower in p.lower()]

    return found_partners


def run_competitive_analysis(
    target_domain: str,
    partner_filter: str = None,
    max_competitors: int = 20
) -> Dict:
    """Run full competitive intelligence analysis."""

    print(f"\n{'='*60}")
    print("🔍 COMPETITIVE INTELLIGENCE ANALYSIS")
    print(f"{'='*60}")
    print(f"   Target: {target_domain}")
    print(f"   Partner Filter: {partner_filter or 'All'}")
    print(f"   Max Competitors: {max_competitors}")

    # Step 1: Get target company tech stack
    print("\n📡 Step 1: Analyzing target company...")
    target_tech = fetch_builtwith_technologies(target_domain)
    target_search, target_has_algolia = detect_search_provider(target_tech["tech_names"])
    target_partners = detect_partner_tech(target_tech["tech_names"])

    print(f"   Search Provider: {target_search}")
    print(f"   Has Algolia: {'✅ Yes' if target_has_algolia else '❌ No'}")
    print(f"   Partner Techs: {', '.join(target_partners) or 'None'}")

    # Step 2: Get competitors from SimilarWeb
    print("\n📡 Step 2: Fetching competitors from SimilarWeb...")
    competitors_raw = fetch_similarweb_competitors(target_domain)

    if not competitors_raw:
        print("   ⚠️ No competitors found")
        return {"error": "No competitors found", "target": target_domain}

    print(f"   Found {len(competitors_raw)} similar sites")

    # Limit competitors
    competitors_to_analyze = competitors_raw[:max_competitors]

    # Step 3: Analyze each competitor with BuiltWith
    print(f"\n📡 Step 3: Analyzing {len(competitors_to_analyze)} competitors...")

    results = {
        "target": {
            "domain": target_domain,
            "search_provider": target_search,
            "has_algolia": target_has_algolia,
            "partner_techs": target_partners
        },
        "competitors": [],
        "displacement_opportunities": [],
        "algolia_users": [],
        "partner_matches": []
    }

    for i, comp in enumerate(competitors_to_analyze):
        comp_domain = comp.get("url", comp.get("domain", ""))
        if not comp_domain:
            continue

        # Clean domain
        comp_domain = comp_domain.replace("www.", "").split("/")[0]

        print(f"   [{i+1}/{len(competitors_to_analyze)}] {comp_domain}...", end=" ")

        # Get tech stack
        comp_tech = fetch_builtwith_technologies(comp_domain)
        comp_search, comp_has_algolia = detect_search_provider(comp_tech["tech_names"])
        comp_partners = detect_partner_tech(comp_tech["tech_names"], partner_filter)

        # Get traffic (optional - can be slow)
        # comp_traffic = fetch_similarweb_traffic(comp_domain)

        competitor_data = {
            "domain": comp_domain,
            "similarity": comp.get("score", comp.get("similarity", 0)),
            "search_provider": comp_search,
            "has_algolia": comp_has_algolia,
            "partner_techs": comp_partners,
            "all_techs_count": len(comp_tech["tech_names"])
        }

        results["competitors"].append(competitor_data)

        # Classify
        if comp_has_algolia:
            results["algolia_users"].append(competitor_data)
            print("✅ Algolia")
        elif comp_partners:  # Has partner tech
            results["displacement_opportunities"].append(competitor_data)
            print(f"🎯 Target ({', '.join(comp_partners)}, search: {comp_search})")
        else:
            print(f"➖ No match (search: {comp_search})")

        # Rate limit
        time.sleep(0.3)

    # Summary
    print(f"\n{'='*60}")
    print("📊 ANALYSIS SUMMARY")
    print(f"{'='*60}")
    print(f"   Competitors Analyzed: {len(results['competitors'])}")
    print(f"   Already on Algolia: {len(results['algolia_users'])}")
    print(f"   Displacement Opportunities: {len(results['displacement_opportunities'])}")

    if results["displacement_opportunities"]:
        print("\n🎯 DISPLACEMENT TARGETS:")
        for opp in results["displacement_opportunities"]:
            print(f"   • {opp['domain']}")
            print(f"     Partners: {', '.join(opp['partner_techs'])}")
            print(f"     Current Search: {opp['search_provider']}")

    if results["algolia_users"]:
        print("\n✅ ALREADY ON ALGOLIA:")
        for user in results["algolia_users"]:
            print(f"   • {user['domain']}")

    return results


def save_results_to_db(results: Dict, conn: sqlite3.Connection):
    """Save competitive intelligence results to database."""
    cursor = conn.cursor()

    # Create competitive_intel table if not exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS competitive_intel (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_domain TEXT NOT NULL,
            competitor_domain TEXT NOT NULL,
            similarity_score REAL,
            search_provider TEXT,
            has_algolia INTEGER,
            partner_techs TEXT,
            is_displacement_target INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(target_domain, competitor_domain)
        )
    """)

    target_domain = results["target"]["domain"]

    for comp in results["competitors"]:
        is_target = 1 if comp in results["displacement_opportunities"] else 0

        try:
            cursor.execute("""
                INSERT OR REPLACE INTO competitive_intel (
                    target_domain, competitor_domain, similarity_score,
                    search_provider, has_algolia, partner_techs, is_displacement_target
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                target_domain,
                comp["domain"],
                comp.get("similarity", 0),
                comp["search_provider"],
                1 if comp["has_algolia"] else 0,
                json.dumps(comp["partner_techs"]),
                is_target
            ))
        except Exception as e:
            print(f"   ⚠️ DB insert error: {e}")

    conn.commit()
    print(f"\n💾 Saved {len(results['competitors'])} records to database")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run competitive intelligence analysis')
    parser.add_argument('--domain', '-d', required=True, help='Target company domain')
    parser.add_argument('--partner', '-p', help='Filter by partner technology (e.g., "shopify", "adobe commerce")')
    parser.add_argument('--max', '-m', type=int, default=20, help='Max competitors to analyze')
    parser.add_argument('--save', '-s', action='store_true', help='Save results to database')

    args = parser.parse_args()

    print("🚀 Arian Competitive Intelligence")

    results = run_competitive_analysis(
        target_domain=args.domain,
        partner_filter=args.partner,
        max_competitors=args.max
    )

    if args.save and "error" not in results:
        conn = sqlite3.connect(DB_PATH)
        save_results_to_db(results, conn)
        conn.close()

    print("\n✅ Analysis complete!")
