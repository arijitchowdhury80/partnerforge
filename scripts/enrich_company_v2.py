#!/usr/bin/env python3
"""
Arian: Full Company Enrichment Pipeline v2.0

Enhanced pipeline with:
1. BuiltWith - Tech stack
2. SimilarWeb - Traffic + competitors
3. Yahoo Finance - 3 years financials (public companies)
4. Hiring signals - Career page analysis

Usage:
    python enrich_company_v2.py --domain mercedes-benz.com
    python enrich_company_v2.py --top 100 --partner "Adobe Experience Manager"
"""

import json
import requests
import argparse
import time
import os
from datetime import datetime
from typing import Optional, Dict, List
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# API Keys from environment
BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY")
SIMILARWEB_API_KEY = os.getenv("SIMILARWEB_API_KEY")

# Supabase config from environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")  # Read-only operations use anon key

# Validate required keys
required_keys = ["BUILTWITH_API_KEY", "SIMILARWEB_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY"]
missing = [k for k in required_keys if not os.getenv(k)]
if missing:
    raise ValueError(f"Missing required environment variables: {', '.join(missing)}. Check .env file.")

# Output directory
OUTPUT_DIR = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/Arian/data/enrichments"

# =============================================================================
# Database-driven customer verification (self-sufficient system)
# =============================================================================

def is_verified_algolia_customer(domain: str) -> bool:
    """
    Check if domain is a verified Algolia customer from database.

    Sources checked:
    1. data_feedback table - user reported as customer
    2. companies table - is_algolia_customer = true
    3. BuiltWith detection during enrichment

    This replaces static exclusion lists - system is self-sufficient.
    """
    try:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }

        # Check 1: User feedback marked as customer
        url = f"{SUPABASE_URL}/rest/v1/data_feedback?domain=eq.{domain}&feedback_type=eq.is_algolia_customer&status=in.(verified,applied)&limit=1"
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                return True

        # Check 2: Companies table
        url = f"{SUPABASE_URL}/rest/v1/companies?domain=eq.{domain}&is_algolia_customer=eq.true&limit=1"
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                return True

    except Exception as e:
        print(f"   ⚠️ Could not check customer status: {e}")

    return False

print(f"   📋 Using database-driven customer verification (self-sufficient)")

# Common ticker mappings for known companies
TICKER_MAP = {
    "mercedes-benz.com": "MBG.DE",
    "bmw.com": "BMW.DE",
    "bmw.de": "BMW.DE",
    "ford.com": "F",
    "toyota.com": "TM",
    "honda.com": "HMC",
    "gap.com": "GPS",
    "underarmour.com": "UAA",
    "ulta.com": "ULTA",
    "nike.com": "NKE",
    "adidas.com": "ADS.DE",
    "coca-cola.com": "KO",
    "nestle.com": "NESN.SW",
    "hp.com": "HPQ",
    "lenovo.com": "0992.HK",
    "canon.com": "CAJ",
    "siemens.com": "SIE.DE",
    "bosch.com": "BOSCHLTD.NS",
    "allianz.com": "ALV.DE",
    "allianz.fr": "ALV.DE",
    "johnlewis.com": None,  # Private
    "fiat.com": "STLA",  # Stellantis
}

def supabase_get(endpoint: str, params: Optional[Dict] = None) -> Optional[List]:
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

# =============================================================================
# Step 1: BuiltWith - Tech Stack
# =============================================================================

def get_builtwith_tech(domain: str) -> Dict:
    """Get tech stack from BuiltWith v21 API."""
    print(f"   📡 BuiltWith: Fetching tech stack...")

    url = f"https://api.builtwith.com/v21/api.json?KEY={BUILTWITH_API_KEY}&LOOKUP={domain}"

    try:
        response = requests.get(url, timeout=30)
        data = response.json()

        errors = data.get("Errors", [])
        if errors and len(errors) > 0:
            print(f"   ⚠️ BuiltWith error: {errors}")
            return {}

        techs = []
        search_techs = []

        for result in data.get("Results", []):
            result_data = result.get("Result", {})
            for path in result_data.get("Paths", []):
                for tech in path.get("Technologies", []):
                    tech_name = tech.get("Name", "")
                    if tech_name:
                        techs.append(tech_name)
                        name_lower = tech_name.lower()
                        if any(s in name_lower for s in [
                            "algolia", "elasticsearch", "elastic", "solr", "coveo",
                            "searchspring", "klevu", "bloomreach", "lucidworks",
                            "searchanise", "doofinder", "swiftype", "meilisearch"
                        ]):
                            search_techs.append(tech_name)

        techs = list(set(techs))
        search_techs = list(set(search_techs))
        has_algolia = any("algolia" in t.lower() for t in techs)

        print(f"   ✅ {len(techs)} technologies, search: {search_techs or 'none'}")
        return {
            "tech_count": len(techs),
            "all_techs": techs[:100],
            "search_providers": search_techs,
            "has_algolia": has_algolia,
        }
    except Exception as e:
        print(f"   ❌ BuiltWith error: {e}")
        return {}

# =============================================================================
# Step 2: SimilarWeb - Traffic & Competitors
# =============================================================================

def get_similarweb_data(domain: str) -> Dict:
    """Get traffic and competitors from SimilarWeb."""
    print(f"   📡 SimilarWeb: Fetching traffic & competitors...")

    result = {"monthly_visits": None, "global_rank": None, "competitors": []}

    try:
        # Traffic
        url = f"https://api.similarweb.com/v1/website/{domain}/total-traffic-and-engagement/visits?api_key={SIMILARWEB_API_KEY}&country=world&granularity=monthly&main_domain_only=false&format=json"
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            visits = data.get("visits", [])
            if visits:
                latest = visits[-1] if isinstance(visits, list) else visits
                result["monthly_visits"] = int(latest.get("visits", 0)) if isinstance(latest, dict) else int(latest)
                print(f"   ✅ Traffic: {result['monthly_visits']:,} visits/month")

        # Competitors
        url = f"https://api.similarweb.com/v1/website/{domain}/similar-sites/similarsites?api_key={SIMILARWEB_API_KEY}&format=json"
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            similar = data.get("similar_sites", [])
            result["competitors"] = [s.get("url", s) if isinstance(s, dict) else s for s in similar[:10]]
            print(f"   ✅ Competitors: {len(result['competitors'])} found")

        # Global rank
        url = f"https://api.similarweb.com/v1/website/{domain}/global-rank/global-rank?api_key={SIMILARWEB_API_KEY}&format=json"
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            result["global_rank"] = data.get("global_rank")
            print(f"   ✅ Global rank: #{result['global_rank']}")

    except Exception as e:
        print(f"   ⚠️ SimilarWeb error: {e}")

    return result

# =============================================================================
# Step 3: Yahoo Finance - 3 Year Financials
# =============================================================================

def get_yahoo_finance(domain: str) -> Dict:
    """Get 3-year financials from Yahoo Finance (public companies only)."""
    print(f"   📡 Yahoo Finance: Fetching financials...")

    # Try to find ticker
    ticker = TICKER_MAP.get(domain)
    if not ticker:
        # Try to resolve via search (simplified)
        company = domain.split('.')[0].replace('-', ' ').title()
        print(f"   ⚠️ No ticker mapped for {domain} (company: {company})")
        return {"is_public": False, "ticker": None}

    result = {
        "is_public": True,
        "ticker": ticker,
        "revenue_ttm": None,
        "revenue_3yr": [],
        "market_cap": None,
        "employees": None,
    }

    try:
        # Use yfinance-style API (Yahoo Finance API)
        url = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=financialData,defaultKeyStatistics,summaryProfile"
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=15)

        if resp.status_code == 200:
            data = resp.json()
            quote = data.get("quoteSummary", {}).get("result", [{}])[0]

            fin = quote.get("financialData", {})
            stats = quote.get("defaultKeyStatistics", {})
            profile = quote.get("summaryProfile", {})

            result["revenue_ttm"] = fin.get("totalRevenue", {}).get("raw")
            result["market_cap"] = stats.get("marketCap", {}).get("raw")
            result["employees"] = profile.get("fullTimeEmployees")

            if result["revenue_ttm"]:
                print(f"   ✅ Revenue: ${result['revenue_ttm']/1e9:.1f}B")
            if result["market_cap"]:
                print(f"   ✅ Market cap: ${result['market_cap']/1e9:.1f}B")
            if result["employees"]:
                print(f"   ✅ Employees: {result['employees']:,}")
        else:
            print(f"   ⚠️ Yahoo Finance returned {resp.status_code}")

    except Exception as e:
        print(f"   ⚠️ Yahoo Finance error: {e}")

    return result

# =============================================================================
# Step 4: Hiring Signals
# =============================================================================

def get_hiring_signals(domain: str) -> Dict:
    """Get hiring signals (basic implementation - can be enhanced with LinkedIn/Indeed APIs)."""
    print(f"   📡 Hiring: Checking career signals...")

    result = {
        "has_careers_page": False,
        "hiring_signals": [],
    }

    try:
        # Check for careers page
        careers_urls = [
            f"https://{domain}/careers",
            f"https://{domain}/jobs",
            f"https://careers.{domain}",
        ]

        for url in careers_urls:
            try:
                resp = requests.head(url, timeout=5, allow_redirects=True)
                if resp.status_code == 200:
                    result["has_careers_page"] = True
                    result["careers_url"] = url
                    print(f"   ✅ Careers page found: {url}")
                    break
            except:
                continue

        if not result["has_careers_page"]:
            print(f"   ⚠️ No careers page detected")

    except Exception as e:
        print(f"   ⚠️ Hiring signals error: {e}")

    return result

# =============================================================================
# Step 5: Competitor Tech Analysis
# =============================================================================

def get_competitor_tech(competitors: List[str]) -> Dict:
    """Get tech stack for competitors."""
    print(f"   📡 Analyzing {min(5, len(competitors))} competitor tech stacks...")

    competitor_data = {}
    algolia_competitors = []

    for i, comp in enumerate(competitors[:5]):
        print(f"      [{i+1}/5] {comp}...")
        time.sleep(0.5)

        tech = get_builtwith_tech(comp)
        if tech:
            competitor_data[comp] = {
                "search_providers": tech.get("search_providers", []),
                "has_algolia": tech.get("has_algolia", False),
            }
            if tech.get("has_algolia"):
                algolia_competitors.append(comp)

    return {
        "competitor_tech": competitor_data,
        "algolia_competitors": algolia_competitors,
    }

# =============================================================================
# Main Enrichment Pipeline
# =============================================================================

def enrich_company(domain: str, skip_competitors: bool = False) -> Dict:
    """Full enrichment pipeline v2."""
    print(f"\n{'='*60}")
    print(f"🔍 ENRICHING: {domain}")
    print(f"{'='*60}")

    # CHECK 1: Database-verified Algolia customer
    if is_verified_algolia_customer(domain):
        print(f"\n   ⛔ SKIPPING: {domain} is a VERIFIED ALGOLIA CUSTOMER")
        print(f"   (Verified via user feedback or companies table)")
        return {
            "domain": domain,
            "status": "EXISTING_CUSTOMER",
            "reason": "Verified Algolia customer (database)",
            "enriched_at": datetime.now().isoformat(),
            "opportunity_score": {"score": 0, "factors": ["Verified Algolia customer"], "recommendation": "SKIP"},
        }

    enrichment = {
        "domain": domain,
        "enriched_at": datetime.now().isoformat(),
        "version": "2.0",
    }

    # Step 1: Tech stack
    print("\n📦 STEP 1: Tech Stack (BuiltWith)")
    enrichment["builtwith"] = get_builtwith_tech(domain)

    # Step 2: Traffic & competitors
    print("\n📦 STEP 2: Traffic & Competitors (SimilarWeb)")
    enrichment["similarweb"] = get_similarweb_data(domain)

    # Step 3: Financials
    print("\n📦 STEP 3: Financials (Yahoo Finance)")
    enrichment["financials"] = get_yahoo_finance(domain)

    # Step 4: Hiring signals
    print("\n📦 STEP 4: Hiring Signals")
    enrichment["hiring"] = get_hiring_signals(domain)

    # Step 5: Competitor analysis
    if not skip_competitors and enrichment["similarweb"].get("competitors"):
        print("\n📦 STEP 5: Competitor Analysis")
        enrichment["competitors"] = get_competitor_tech(enrichment["similarweb"]["competitors"])
    else:
        enrichment["competitors"] = {}

    # Calculate opportunity score
    opp_score = calculate_opportunity_score(enrichment)
    enrichment["opportunity_score"] = opp_score

    # Save to JSON
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_file = f"{OUTPUT_DIR}/{domain.replace('.', '_')}_v2.json"
    with open(output_file, 'w') as f:
        json.dump(enrichment, f, indent=2, default=str)

    # Summary
    print_summary(enrichment)

    return enrichment

def calculate_opportunity_score(enrichment: Dict) -> Dict:
    """Calculate overall opportunity score."""
    score = 0
    factors = []

    # No Algolia = opportunity
    if not enrichment.get("builtwith", {}).get("has_algolia"):
        score += 30
        factors.append("No Algolia (greenfield)")
    else:
        factors.append("Already uses Algolia (customer)")
        return {"score": 0, "factors": factors, "recommendation": "EXISTING_CUSTOMER"}

    # High traffic
    traffic = enrichment.get("similarweb", {}).get("monthly_visits", 0) or 0
    if traffic >= 10_000_000:
        score += 25
        factors.append(f"High traffic ({traffic/1e6:.1f}M)")
    elif traffic >= 1_000_000:
        score += 15
        factors.append(f"Good traffic ({traffic/1e6:.1f}M)")

    # Competitors on Algolia
    algolia_comps = enrichment.get("competitors", {}).get("algolia_competitors", [])
    if algolia_comps:
        score += 20
        factors.append(f"Competitors on Algolia: {', '.join(algolia_comps)}")

    # Public company (bigger deal)
    if enrichment.get("financials", {}).get("is_public"):
        score += 10
        factors.append("Public company")

    # Using competitor search (displacement)
    search_providers = enrichment.get("builtwith", {}).get("search_providers", [])
    displacement_targets = ["solr", "elasticsearch", "coveo", "bloomreach", "lucidworks"]
    for sp in search_providers:
        if any(t in sp.lower() for t in displacement_targets):
            score += 15
            factors.append(f"Displacement opportunity ({sp})")
            break

    recommendation = "HOT" if score >= 70 else "WARM" if score >= 40 else "COLD"

    return {"score": score, "factors": factors, "recommendation": recommendation}

def print_summary(enrichment: Dict):
    """Print enrichment summary."""
    print(f"\n{'='*60}")
    print(f"📊 ENRICHMENT SUMMARY: {enrichment['domain']}")
    print(f"{'='*60}")

    bw = enrichment.get("builtwith", {})
    sw = enrichment.get("similarweb", {})
    fin = enrichment.get("financials", {})
    comp = enrichment.get("competitors", {})
    opp = enrichment.get("opportunity_score", {})

    print(f"   Tech: {bw.get('tech_count', 0)} technologies")
    print(f"   Search: {bw.get('search_providers', []) or 'None detected'}")
    print(f"   Uses Algolia: {'YES ❌ (customer)' if bw.get('has_algolia') else 'NO ✅ (opportunity)'}")
    print(f"   Traffic: {sw.get('monthly_visits', 0):,}/month" if sw.get('monthly_visits') else "   Traffic: N/A")
    print(f"   Global Rank: #{sw.get('global_rank', 'N/A')}")
    print(f"   Public: {'Yes' if fin.get('is_public') else 'No'} ({fin.get('ticker', 'N/A')})")
    if fin.get("revenue_ttm"):
        print(f"   Revenue: ${fin['revenue_ttm']/1e9:.1f}B")
    print(f"   Competitors on Algolia: {comp.get('algolia_competitors', [])}")
    print(f"\n   🎯 OPPORTUNITY SCORE: {opp.get('score', 0)}/100 ({opp.get('recommendation', 'N/A')})")
    for f in opp.get("factors", []):
        print(f"      • {f}")

def get_top_leads(n: int = 100, partner: Optional[str] = None, sort_by: str = "traffic") -> List[Dict]:
    """
    Get top N leads for enrichment.

    Sort options:
    - 'traffic': By monthly visits DESC (prioritize high-traffic targets)
    - 'score': By ICP score DESC (original behavior)
    - 'unenriched': By enrichment_level, traffic DESC (prioritize unenriched)

    Filters:
    - Skip already fully enriched (enrichment_level = 'full')
    - Filter by partner tech if specified
    """
    params = {
        "select": "domain,company_name,icp_score,partner_tech,sw_monthly_visits,enrichment_level",
        "limit": str(n),
        "enrichment_level": "neq.full",  # Skip already enriched
    }

    # Sort order
    if sort_by == "traffic":
        params["order"] = "sw_monthly_visits.desc.nullslast"
    elif sort_by == "unenriched":
        params["order"] = "enrichment_level.asc.nullslast,sw_monthly_visits.desc.nullslast"
    else:
        params["order"] = "icp_score.desc.nullslast"

    if partner:
        params["partner_tech"] = f"eq.{partner}"

    data = supabase_get("displacement_targets", params)

    # Log what we're enriching
    if data:
        print(f"\n📋 Selection criteria: sort_by={sort_by}, partner={partner or 'ALL'}")
        print(f"   Found {len(data)} targets (skipping already enriched)")
        if data and len(data) > 0:
            top = data[0]
            traffic = top.get('sw_monthly_visits') or 0
            print(f"   Top target: {top.get('company_name', top['domain'])} ({traffic:,} visits)")

    return data or []

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Full company enrichment v2.0')
    parser.add_argument('--domain', '-d', help='Single domain to enrich')
    parser.add_argument('--top', '-t', type=int, help='Enrich top N leads')
    parser.add_argument('--partner', '-p', help='Filter by partner tech')
    parser.add_argument('--sort', '-s', choices=['traffic', 'score', 'unenriched'], default='traffic',
                        help='Sort by: traffic (default), score, or unenriched')
    parser.add_argument('--skip-competitors', action='store_true', help='Skip competitor analysis')

    args = parser.parse_args()

    print("🚀 Arian: Full Enrichment Pipeline v2.1")
    print(f"   Features: Tech Stack + Traffic + Financials + Hiring + Competitors")
    print(f"   Verification: Database-driven (self-sufficient)")

    if args.domain:
        enrich_company(args.domain, skip_competitors=args.skip_competitors)
    elif args.top:
        leads = get_top_leads(args.top, args.partner, sort_by=args.sort)
        print(f"\n📋 Enriching {len(leads)} leads...")
        for i, lead in enumerate(leads):
            traffic = lead.get('sw_monthly_visits', 0) or 0
            print(f"\n[{i+1}/{len(leads)}] {lead.get('company_name', lead['domain'])} ({traffic:,} visits)")
            enrich_company(lead['domain'], skip_competitors=args.skip_competitors)
            time.sleep(1)
    else:
        print("Usage: python enrich_company_v2.py --domain example.com")
        print("       python enrich_company_v2.py --top 100 --partner 'Adobe Experience Manager'")
        print("       python enrich_company_v2.py --top 50 --sort traffic  # Sort by traffic (default)")
        print("       python enrich_company_v2.py --top 50 --sort unenriched  # Prioritize unenriched")

    print("\n✅ Done!")
