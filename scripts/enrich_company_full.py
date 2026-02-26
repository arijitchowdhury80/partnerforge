#!/usr/bin/env python3
"""
PartnerForge: Full Company Enrichment Pipeline

Pipeline:
1. BuiltWith → Get company tech stack
2. SimilarWeb → Get traffic + competitors
3. BuiltWith → Get competitor tech stacks
4. Check which competitors use Algolia

Usage:
    python enrich_company_full.py --domain mercedes-benz.com
    python enrich_company_full.py --top 10  # Enrich top 10 hot leads
"""

import json
import requests
import argparse
import time
from datetime import datetime

# API Keys
BUILTWITH_API_KEY = "8fd992ef-88d0-4554-a20b-364e97b2d302"
SIMILARWEB_API_KEY = "483b77d48d254810b4caf3d376b28ce7"

# Supabase config
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"

def supabase_get(endpoint, params=None):
    """GET from Supabase REST API."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    response = requests.get(url, headers=headers, params=params)
    if response.status_code >= 400:
        print(f"   ⚠️ Supabase GET error: {response.status_code}")
        return None
    return response.json()

def supabase_patch(endpoint, data, params):
    """PATCH to Supabase REST API."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    response = requests.patch(url, headers=headers, json=data, params=params)
    if response.status_code >= 400:
        print(f"   ⚠️ Supabase PATCH error: {response.status_code} - {response.text[:200]}")
        return False
    return True

# =============================================================================
# Step 1: BuiltWith - Get Company Tech Stack
# =============================================================================

def get_builtwith_tech(domain: str) -> dict:
    """Get tech stack from BuiltWith v21 API (full data)."""
    print(f"   📡 BuiltWith: Fetching tech stack for {domain}...")

    url = f"https://api.builtwith.com/v21/api.json?KEY={BUILTWITH_API_KEY}&LOOKUP={domain}"

    try:
        response = requests.get(url, timeout=30)
        data = response.json()

        errors = data.get("Errors", [])
        if errors and len(errors) > 0:
            print(f"   ⚠️ BuiltWith error: {errors}")
            return {}

        # Extract technologies from v21 format
        techs = []
        tech_categories = {}
        search_techs = []

        for result in data.get("Results", []):
            result_data = result.get("Result", {})
            paths = result_data.get("Paths", [])

            for path in paths:
                technologies = path.get("Technologies", [])
                for tech in technologies:
                    tech_name = tech.get("Name", "")
                    tech_tag = tech.get("Tag", "Other")

                    if tech_name:
                        techs.append(tech_name)
                        if tech_tag not in tech_categories:
                            tech_categories[tech_tag] = []
                        tech_categories[tech_tag].append(tech_name)

                        # Check for search providers
                        name_lower = tech_name.lower()
                        if any(s in name_lower for s in [
                            "algolia", "elasticsearch", "elastic", "solr", "coveo",
                            "searchspring", "klevu", "bloomreach", "lucidworks",
                            "searchanise", "doofinder", "swiftype", "meilisearch"
                        ]):
                            search_techs.append(tech_name)

        # Dedupe
        techs = list(set(techs))
        search_techs = list(set(search_techs))

        # Check for Algolia
        has_algolia = any("algolia" in t.lower() for t in techs)

        result = {
            "all_techs": techs[:50],  # Limit
            "tech_categories": tech_categories,
            "has_algolia": has_algolia,
            "search_providers": search_techs,
            "tech_count": len(techs),
        }

        print(f"   ✅ Found {len(techs)} technologies, search: {search_techs or 'none detected'}")
        return result

    except Exception as e:
        print(f"   ❌ BuiltWith error: {e}")
        return {}

# =============================================================================
# Step 2: SimilarWeb - Get Traffic & Competitors
# =============================================================================

def get_similarweb_data(domain: str) -> dict:
    """Get traffic and competitors from SimilarWeb."""
    print(f"   📡 SimilarWeb: Fetching data for {domain}...")

    result = {
        "monthly_visits": None,
        "global_rank": None,
        "country_rank": None,
        "category": None,
        "competitors": [],
        "top_countries": [],
    }

    headers = {"api-key": SIMILARWEB_API_KEY}
    base_url = "https://api.similarweb.com/v1/website"

    # Get traffic overview
    try:
        url = f"{base_url}/{domain}/total-traffic-and-engagement/visits?api_key={SIMILARWEB_API_KEY}&country=world&granularity=monthly&main_domain_only=false&format=json&show_verified=false&mtd=false"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            visits = data.get("visits", [])
            if visits:
                latest = visits[-1] if isinstance(visits, list) else visits
                result["monthly_visits"] = latest.get("visits") if isinstance(latest, dict) else latest
                print(f"   ✅ Traffic: {result['monthly_visits']:,} monthly visits" if result['monthly_visits'] else "   ⚠️ No traffic data")
    except Exception as e:
        print(f"   ⚠️ Traffic API error: {e}")

    # Get competitors (similar sites)
    try:
        url = f"{base_url}/{domain}/similar-sites/similarsites?api_key={SIMILARWEB_API_KEY}&format=json"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            similar = data.get("similar_sites", [])
            result["competitors"] = [s.get("url", s) if isinstance(s, dict) else s for s in similar[:10]]
            print(f"   ✅ Competitors: {len(result['competitors'])} found")
    except Exception as e:
        print(f"   ⚠️ Competitors API error: {e}")

    # Get global rank
    try:
        url = f"{base_url}/{domain}/global-rank/global-rank?api_key={SIMILARWEB_API_KEY}&format=json"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            result["global_rank"] = data.get("global_rank")
            print(f"   ✅ Global rank: #{result['global_rank']}" if result['global_rank'] else "   ⚠️ No rank data")
    except Exception as e:
        print(f"   ⚠️ Rank API error: {e}")

    return result

# =============================================================================
# Step 3: BuiltWith - Get Competitor Tech Stacks
# =============================================================================

def get_competitor_tech_stacks(competitors: list) -> dict:
    """Get tech stack for each competitor."""
    print(f"   📡 BuiltWith: Fetching tech for {len(competitors)} competitors...")

    competitor_data = {}
    algolia_competitors = []

    for i, comp in enumerate(competitors[:5]):  # Limit to 5 to save API calls
        print(f"      [{i+1}/{min(5, len(competitors))}] Checking {comp}...")
        time.sleep(0.5)  # Rate limiting

        tech = get_builtwith_tech(comp)
        if tech:
            competitor_data[comp] = {
                "search_providers": tech.get("search_providers", []),
                "has_algolia": tech.get("has_algolia", False),
                "tech_count": tech.get("tech_count", 0),
            }
            if tech.get("has_algolia"):
                algolia_competitors.append(comp)

    return {
        "competitor_tech": competitor_data,
        "algolia_competitors": algolia_competitors,
        "competitors_checked": len(competitor_data),
    }

# =============================================================================
# Main Enrichment Pipeline
# =============================================================================

def enrich_company(domain: str) -> dict:
    """Full enrichment pipeline for a single company."""
    print(f"\n{'='*60}")
    print(f"🔍 ENRICHING: {domain}")
    print(f"{'='*60}")

    enrichment = {
        "domain": domain,
        "enriched_at": datetime.now().isoformat(),
        "builtwith": {},
        "similarweb": {},
        "competitors": {},
    }

    # Step 1: BuiltWith tech stack
    print("\n📦 STEP 1: Company Tech Stack (BuiltWith)")
    enrichment["builtwith"] = get_builtwith_tech(domain)

    # Step 2: SimilarWeb traffic & competitors
    print("\n📦 STEP 2: Traffic & Competitors (SimilarWeb)")
    enrichment["similarweb"] = get_similarweb_data(domain)

    # Step 3: Competitor tech stacks (if we found competitors)
    competitors = enrichment["similarweb"].get("competitors", [])
    if competitors:
        print(f"\n📦 STEP 3: Competitor Tech Stacks ({len(competitors)} competitors)")
        enrichment["competitors"] = get_competitor_tech_stacks(competitors)
    else:
        print("\n📦 STEP 3: Skipped (no competitors found)")

    # Update Supabase - only use existing columns
    print("\n📦 STEP 4: Saving to Supabase...")

    # Extract numeric traffic value
    monthly_visits = enrichment["similarweb"].get("monthly_visits")
    if monthly_visits:
        monthly_visits = int(monthly_visits)

    update_data = {
        "sw_monthly_visits": monthly_visits,
        "current_search": ", ".join(enrichment["builtwith"].get("search_providers", [])) or None,
        "enrichment_level": "full",
        "last_enriched": datetime.now().isoformat(),
    }

    success = supabase_patch(
        "displacement_targets",
        update_data,
        {"domain": f"eq.{domain}"}
    )

    if success:
        print(f"   ✅ Saved to Supabase")
    else:
        print(f"   ⚠️ Failed to save to Supabase")

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 ENRICHMENT SUMMARY: {domain}")
    print(f"{'='*60}")
    print(f"   Tech stack: {enrichment['builtwith'].get('tech_count', 0)} technologies")
    print(f"   Search providers: {enrichment['builtwith'].get('search_providers', [])}")
    print(f"   Monthly visits: {enrichment['similarweb'].get('monthly_visits', 'N/A'):,}" if enrichment['similarweb'].get('monthly_visits') else "   Monthly visits: N/A")
    print(f"   Global rank: #{enrichment['similarweb'].get('global_rank', 'N/A')}")
    print(f"   Competitors found: {len(competitors)}")
    print(f"   Competitors using Algolia: {enrichment['competitors'].get('algolia_competitors', [])}")

    # Save to local JSON as backup (Supabase writes need service_role key)
    output_dir = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/data/enrichments"
    import os
    os.makedirs(output_dir, exist_ok=True)
    output_file = f"{output_dir}/{domain.replace('.', '_')}.json"
    with open(output_file, 'w') as f:
        json.dump(enrichment, f, indent=2, default=str)
    print(f"   📁 Saved to: {output_file}")

    return enrichment

def get_top_leads(n: int = 10) -> list:
    """Get top N leads by ICP score."""
    data = supabase_get(
        "displacement_targets",
        {"select": "domain,company_name,icp_score", "order": "icp_score.desc.nullslast", "limit": str(n)}
    )
    return data or []

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Full company enrichment pipeline')
    parser.add_argument('--domain', '-d', help='Single domain to enrich')
    parser.add_argument('--top', '-t', type=int, help='Enrich top N leads')

    args = parser.parse_args()

    print("🚀 PartnerForge: Full Enrichment Pipeline")
    print(f"   BuiltWith API: {BUILTWITH_API_KEY[:8]}...")
    print(f"   SimilarWeb API: {SIMILARWEB_API_KEY[:8]}...")

    if args.domain:
        enrich_company(args.domain)
    elif args.top:
        leads = get_top_leads(args.top)
        print(f"\n📋 Enriching top {len(leads)} leads...")
        for i, lead in enumerate(leads):
            print(f"\n[{i+1}/{len(leads)}] {lead['company_name']} ({lead['domain']})")
            enrich_company(lead['domain'])
            time.sleep(1)  # Rate limiting between companies
    else:
        print("Usage: python enrich_company_full.py --domain example.com")
        print("       python enrich_company_full.py --top 10")

    print("\n✅ Done!")
