#!/usr/bin/env python3
"""
Deep Enrichment for Amplience Targets

Fetches FULL tech stack from BuiltWith + detailed traffic from SimilarWeb
for all Amplience displacement targets.

This is the COMPLETE enrichment - not just ICP scores.
"""

import json
import os
import requests
from datetime import datetime
from typing import Dict, List, Optional
import time

# API Keys
BUILTWITH_API_KEY = "8fd992ef-88d0-4554-a20b-364e97b2d302"
SIMILARWEB_API_KEY = "483b77d48d254810b4caf3d376b28ce7"

# Supabase
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA4NTU0MCwiZXhwIjoyMDg3NjYxNTQwfQ.tVnqtUbxS55dNnUiKY6_LBqVYYLhGztWoagg-efc3Ac"


def get_amplience_targets() -> List[Dict]:
    """Get all Amplience targets from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/displacement_targets?partner_tech=eq.Amplience&select=domain,company_name,icp_score"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    response = requests.get(url, headers=headers)
    return response.json() if response.status_code == 200 else []


def get_builtwith_tech_stack(domain: str) -> Dict:
    """
    Fetch FULL tech stack from BuiltWith API.

    Returns categories like:
    - Analytics & Tracking
    - E-commerce
    - CMS
    - Search
    - CDN
    - Payment
    - Marketing
    - etc.
    """
    # Try the free lookup first
    url = f"https://api.builtwith.com/free1/api.json?KEY={BUILTWITH_API_KEY}&LOOKUP={domain}"

    try:
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            print(f"    BuiltWith API error: {response.status_code}")
            return {}

        data = response.json()

        # Parse the tech stack into categories
        tech_stack = {
            "cms": [],
            "ecommerce": [],
            "analytics": [],
            "search": [],
            "cdn": [],
            "payment": [],
            "marketing": [],
            "hosting": [],
            "javascript": [],
            "other": [],
        }

        # Extract groups from response
        if "groups" in data:
            for group in data.get("groups", []):
                group_name = group.get("name", "").lower()
                categories = group.get("categories", [])

                for cat in categories:
                    cat_name = cat.get("name", "").lower()
                    live_techs = cat.get("live", [])

                    for tech in live_techs:
                        tech_name = tech.get("name", "")
                        if not tech_name:
                            continue

                        # Categorize based on group/category name
                        if "cms" in group_name or "content" in group_name:
                            tech_stack["cms"].append(tech_name)
                        elif "commerce" in group_name or "shop" in group_name or "cart" in group_name:
                            tech_stack["ecommerce"].append(tech_name)
                        elif "analytics" in group_name or "tracking" in group_name:
                            tech_stack["analytics"].append(tech_name)
                        elif "search" in cat_name:
                            tech_stack["search"].append(tech_name)
                        elif "cdn" in group_name or "delivery" in group_name:
                            tech_stack["cdn"].append(tech_name)
                        elif "payment" in group_name:
                            tech_stack["payment"].append(tech_name)
                        elif "marketing" in group_name or "email" in group_name:
                            tech_stack["marketing"].append(tech_name)
                        elif "hosting" in group_name or "server" in group_name:
                            tech_stack["hosting"].append(tech_name)
                        elif "javascript" in group_name or "framework" in group_name:
                            tech_stack["javascript"].append(tech_name)
                        else:
                            tech_stack["other"].append(tech_name)

        # Also check Results array (different API version)
        if "Results" in data:
            for result in data.get("Results", []):
                for path in result.get("Result", {}).get("Paths", []):
                    for tech in path.get("Technologies", []):
                        tech_name = tech.get("Name", "")
                        tag = tech.get("Tag", "").lower()

                        if not tech_name:
                            continue

                        if "cms" in tag or "content" in tag:
                            tech_stack["cms"].append(tech_name)
                        elif "ecommerce" in tag or "shop" in tag:
                            tech_stack["ecommerce"].append(tech_name)
                        elif "analytics" in tag:
                            tech_stack["analytics"].append(tech_name)
                        elif "search" in tag:
                            tech_stack["search"].append(tech_name)
                        elif "cdn" in tag:
                            tech_stack["cdn"].append(tech_name)
                        elif "payment" in tag:
                            tech_stack["payment"].append(tech_name)
                        elif "marketing" in tag or "email" in tag:
                            tech_stack["marketing"].append(tech_name)
                        else:
                            tech_stack["other"].append(tech_name)

        # Dedupe
        for key in tech_stack:
            tech_stack[key] = list(set(tech_stack[key]))

        return tech_stack

    except Exception as e:
        print(f"    BuiltWith error: {e}")
        return {}


def get_similarweb_traffic(domain: str) -> Dict:
    """
    Fetch detailed traffic data from SimilarWeb API.

    Returns:
    - Total visits
    - Traffic sources (organic, paid, direct, referral, social, email)
    - Top countries
    - Bounce rate
    - Pages per visit
    - Visit duration
    """
    base_url = "https://api.similarweb.com/v1/website"

    traffic_data = {
        "total_visits": None,
        "traffic_sources": {},
        "top_countries": [],
        "engagement": {},
    }

    headers = {"api-key": SIMILARWEB_API_KEY}

    try:
        # Get total traffic
        url = f"{base_url}/{domain}/total-traffic-and-engagement/visits?api_key={SIMILARWEB_API_KEY}&country=world&granularity=monthly&main_domain_only=false&format=json"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            visits = data.get("visits", [])
            if visits:
                traffic_data["total_visits"] = visits[-1].get("visits", 0)

        # Get traffic sources
        url = f"{base_url}/{domain}/traffic-sources/overview?api_key={SIMILARWEB_API_KEY}&country=world&granularity=monthly&main_domain_only=false&format=json"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            overview = data.get("overview", {})
            traffic_data["traffic_sources"] = {
                "organic_search": round(overview.get("organic_search", 0) * 100, 1),
                "paid_search": round(overview.get("paid_search", 0) * 100, 1),
                "direct": round(overview.get("direct", 0) * 100, 1),
                "referral": round(overview.get("referral", 0) * 100, 1),
                "social": round(overview.get("social", 0) * 100, 1),
                "email": round(overview.get("mail", 0) * 100, 1),
            }

        # Get geography
        url = f"{base_url}/{domain}/geo/traffic-by-country?api_key={SIMILARWEB_API_KEY}&country=world&granularity=monthly&main_domain_only=false&format=json"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            countries = data.get("records", [])[:5]  # Top 5
            traffic_data["top_countries"] = [
                {"country": c.get("country"), "share": round(c.get("share", 0) * 100, 1)}
                for c in countries
            ]

        # Get engagement
        url = f"{base_url}/{domain}/total-traffic-and-engagement/metrics?api_key={SIMILARWEB_API_KEY}&country=world&granularity=monthly&main_domain_only=false&format=json"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            traffic_data["engagement"] = {
                "bounce_rate": round(data.get("bounce_rate", 0) * 100, 1),
                "pages_per_visit": round(data.get("pages_per_visit", 0), 1),
                "avg_visit_duration": data.get("average_visit_duration", 0),
            }

    except Exception as e:
        print(f"    SimilarWeb error: {e}")

    return traffic_data


def update_supabase(domain: str, data: Dict) -> bool:
    """Update Supabase with enrichment data."""
    url = f"{SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.{domain}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    response = requests.patch(url, headers=headers, json=data)
    return response.status_code in (200, 204)


def main():
    print("=" * 70)
    print("Deep Enrichment for Amplience Targets")
    print("=" * 70)

    # Get all Amplience targets
    targets = get_amplience_targets()
    print(f"\nFound {len(targets)} Amplience targets")

    enrichment_results = []

    for i, target in enumerate(targets, 1):
        domain = target["domain"]
        company = target.get("company_name", domain)

        print(f"\n[{i}/{len(targets)}] {company} ({domain})")
        print("-" * 50)

        result = {
            "domain": domain,
            "company_name": company,
            "enriched_at": datetime.now().isoformat(),
        }

        # Get BuiltWith tech stack
        print("  Fetching BuiltWith tech stack...")
        tech_stack = get_builtwith_tech_stack(domain)
        result["tech_stack"] = tech_stack

        # Count techs found
        total_techs = sum(len(v) for v in tech_stack.values())
        print(f"    Found {total_techs} technologies")

        if tech_stack.get("search"):
            print(f"    Search providers: {', '.join(tech_stack['search'])}")
        if tech_stack.get("ecommerce"):
            print(f"    E-commerce: {', '.join(tech_stack['ecommerce'][:3])}")
        if tech_stack.get("analytics"):
            print(f"    Analytics: {', '.join(tech_stack['analytics'][:3])}")

        # Get SimilarWeb traffic
        print("  Fetching SimilarWeb traffic...")
        traffic = get_similarweb_traffic(domain)
        result["traffic_data"] = traffic

        if traffic.get("total_visits"):
            print(f"    Monthly visits: {traffic['total_visits']:,}")
        if traffic.get("traffic_sources"):
            sources = traffic["traffic_sources"]
            print(f"    Sources: Organic {sources.get('organic_search', 0)}%, Direct {sources.get('direct', 0)}%")

        enrichment_results.append(result)

        # Determine current search provider for displacement opportunity
        current_search = None
        search_techs = tech_stack.get("search", [])
        for s in search_techs:
            s_lower = s.lower()
            if "algolia" in s_lower:
                current_search = "Algolia"  # Already using Algolia!
                break
            elif "elastic" in s_lower or "elasticsearch" in s_lower:
                current_search = "Elasticsearch"
            elif "lucid" in s_lower or "solr" in s_lower or "fusion" in s_lower:
                current_search = "Lucidworks/Solr"
            elif "searchspring" in s_lower:
                current_search = "SearchSpring"
            elif "klevu" in s_lower:
                current_search = "Klevu"
            elif "constructor" in s_lower:
                current_search = "Constructor.io"
            elif "bloomreach" in s_lower:
                current_search = "Bloomreach"

        # Update Supabase with the enrichment
        update_data = {
            "last_enriched": datetime.now().isoformat(),
            "enrichment_level": "full",
        }

        if traffic.get("total_visits"):
            update_data["sw_monthly_visits"] = traffic["total_visits"]

        if current_search:
            update_data["current_search"] = current_search
            print(f"    Current search: {current_search}")

        # Store tech stack as JSON in a text field (if available)
        # Note: This requires the column to exist
        # update_data["tech_stack_json"] = json.dumps(tech_stack)

        if update_supabase(domain, update_data):
            print("  ✓ Updated Supabase")
        else:
            print("  ✗ Failed to update Supabase")

        # Rate limiting
        time.sleep(1)

    # Save full results to JSON
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "..", "data", "amplience_deep_enrichment.json")

    with open(output_file, "w") as f:
        json.dump(enrichment_results, f, indent=2)

    print("\n" + "=" * 70)
    print(f"COMPLETE: Enriched {len(targets)} Amplience targets")
    print(f"Results saved to: {output_file}")
    print("=" * 70)


if __name__ == "__main__":
    main()
