#!/usr/bin/env python3
"""
Enrich 10 companies with Yahoo Finance + SimilarWeb data.
"""

import os
import json
import requests
from datetime import datetime
from typing import Optional, Dict, Any

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

SIMILARWEB_API_KEY = os.getenv('SIMILARWEB_API_KEY', '483b77d48d254810b4caf3d376b28ce7')

# Companies to enrich
COMPANIES = [
    {"name": "The Very Group", "domain": "very.co.uk", "ticker": None, "private": True},
    {"name": "Crate & Barrel", "domain": "crateandbarrel.com", "ticker": None, "private": True},
    {"name": "Coach/Tapestry", "domain": "coach.com", "ticker": "TPR", "private": False},
    {"name": "Converse/Nike", "domain": "converse.com", "ticker": "NKE", "private": False},
    {"name": "Primark/ABF", "domain": "primark.com", "ticker": "ABF.L", "private": False},
    {"name": "Under Armour", "domain": "underarmour.com", "ticker": "UAA", "private": False},
    {"name": "Boohoo", "domain": "boohoo.com", "ticker": "BOO.L", "private": False},
    {"name": "Aldi Sud", "domain": "aldi-sued.de", "ticker": None, "private": True},
    {"name": "NAB", "domain": "nab.com.au", "ticker": "NAB.AX", "private": False},
    {"name": "Ricoh", "domain": "ricoh.com", "ticker": "7752.T", "private": False},
]


def get_similarweb_traffic(domain: str) -> Dict[str, Any]:
    """Get traffic data from SimilarWeb API."""
    base_url = "https://api.similarweb.com/v1/website"

    result = {
        "total_visits": None,
        "top_countries": [],
        "traffic_sources": {},
        "top_competitors": [],
        "error": None
    }

    headers = {"accept": "application/json"}

    # Get total traffic
    try:
        traffic_url = f"{base_url}/{domain}/total-traffic-and-engagement/visits"
        params = {
            "api_key": SIMILARWEB_API_KEY,
            "start_date": "2025-11",
            "end_date": "2026-01",
            "country": "world",
            "granularity": "monthly",
            "main_domain_only": "false"
        }
        resp = requests.get(traffic_url, params=params, headers=headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            visits = data.get("visits", [])
            if visits:
                # Get latest month's visits
                latest = visits[-1] if visits else {}
                result["total_visits"] = latest.get("visits", 0)
        else:
            result["error"] = f"Traffic API: {resp.status_code}"
    except Exception as e:
        result["error"] = str(e)

    # Get traffic sources
    try:
        sources_url = f"{base_url}/{domain}/traffic-sources/overview"
        params = {
            "api_key": SIMILARWEB_API_KEY,
            "start_date": "2025-11",
            "end_date": "2026-01",
            "country": "world",
            "granularity": "monthly",
            "main_domain_only": "false"
        }
        resp = requests.get(sources_url, params=params, headers=headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            overview = data.get("overview", [])
            # API returns list of sources with source_type and share
            if isinstance(overview, list) and overview:
                sources = {"direct": 0, "search": 0, "social": 0, "referrals": 0, "mail": 0, "display_ads": 0}
                for item in overview:
                    source_type = item.get("source_type", "").lower()
                    share = item.get("share", 0) * 100
                    if "direct" in source_type:
                        sources["direct"] += share
                    elif "search" in source_type:
                        sources["search"] += share
                    elif "social" in source_type:
                        sources["social"] += share
                    elif "referral" in source_type:
                        sources["referrals"] += share
                    elif "mail" in source_type:
                        sources["mail"] += share
                    elif "display" in source_type:
                        sources["display_ads"] += share
                result["traffic_sources"] = {k: round(v, 1) for k, v in sources.items()}
    except Exception as e:
        if not result["error"]:
            result["error"] = str(e)

    # Get competitors
    try:
        competitors_url = f"{base_url}/{domain}/similar-sites/similarsites"
        params = {
            "api_key": SIMILARWEB_API_KEY
        }
        resp = requests.get(competitors_url, params=params, headers=headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            similar = data.get("similar_sites", [])
            result["top_competitors"] = [s.get("url", "") for s in similar[:5]]
    except Exception as e:
        if not result["error"]:
            result["error"] = str(e)

    return result


def get_yahoo_finance_data(ticker: str) -> Dict[str, Any]:
    """Get financial data from Yahoo Finance using yfinance."""
    result = {
        "revenue": None,
        "market_cap": None,
        "employees": None,
        "currency": "USD",
        "error": None
    }

    # Currency conversion rates (approximate, for display purposes)
    FX_TO_USD = {
        "JPY": 0.0067,  # 1 JPY = 0.0067 USD
        "GBP": 1.27,    # 1 GBP = 1.27 USD
        "AUD": 0.65,    # 1 AUD = 0.65 USD
        "EUR": 1.08,    # 1 EUR = 1.08 USD
        "USD": 1.0
    }

    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info

        # Get currency
        currency = info.get("currency", "USD")
        result["currency"] = currency
        fx_rate = FX_TO_USD.get(currency, 1.0)

        # Market cap (already in currency)
        market_cap = info.get("marketCap")
        if market_cap:
            result["market_cap"] = market_cap * fx_rate

        # Employees
        result["employees"] = info.get("fullTimeEmployees")

        # Revenue - try multiple fields
        revenue = info.get("totalRevenue") or info.get("revenue")

        # If no revenue from info, try financials
        if not revenue:
            try:
                financials = stock.financials
                if financials is not None and not financials.empty:
                    if 'Total Revenue' in financials.index:
                        revenue = financials.loc['Total Revenue'].iloc[0]
            except:
                pass

        if revenue:
            result["revenue"] = revenue * fx_rate

    except Exception as e:
        result["error"] = str(e)

    return result


def format_number(n: Optional[float], prefix: str = "") -> str:
    """Format large numbers with B/M suffix."""
    if n is None:
        return "N/A"
    if n >= 1e9:
        return f"{prefix}{n/1e9:.1f}B"
    if n >= 1e6:
        return f"{prefix}{n/1e6:.1f}M"
    if n >= 1e3:
        return f"{prefix}{n/1e3:.0f}K"
    return f"{prefix}{n:.0f}"


def main():
    results = []

    print("=" * 80)
    print("Company Enrichment Report")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    for company in COMPANIES:
        print(f"\n--- Processing: {company['name']} ({company['domain']}) ---")

        # Get SimilarWeb data
        print(f"  Fetching SimilarWeb data...")
        sw_data = get_similarweb_traffic(company["domain"])

        # Get Yahoo Finance data (if public)
        yf_data = {"revenue": None, "market_cap": None, "employees": None}
        if company["ticker"]:
            print(f"  Fetching Yahoo Finance data for {company['ticker']}...")
            yf_data = get_yahoo_finance_data(company["ticker"])

        results.append({
            "company": company,
            "similarweb": sw_data,
            "yahoo": yf_data
        })

        # Print summary
        print(f"  Traffic: {format_number(sw_data['total_visits'])} visits/mo")
        if sw_data["traffic_sources"]:
            ts = sw_data["traffic_sources"]
            print(f"  Sources: Direct {ts.get('direct', 'N/A')}%, Search {ts.get('search', 'N/A')}%")
        if sw_data["top_competitors"]:
            print(f"  Top Competitors: {', '.join(sw_data['top_competitors'][:3])}")
        if company["ticker"]:
            print(f"  Revenue: {format_number(yf_data['revenue'], '$')}")
            print(f"  Market Cap: {format_number(yf_data['market_cap'], '$')}")
            print(f"  Employees: {format_number(yf_data['employees'])}")

    # Generate markdown table
    print("\n\n" + "=" * 80)
    print("MARKDOWN TABLE OUTPUT")
    print("=" * 80 + "\n")

    # Table header
    print("| Company | Domain | Ticker | Revenue | Market Cap | Employees | Monthly Traffic | Top Traffic Source | Top Competitors |")
    print("|---------|--------|--------|---------|------------|-----------|-----------------|-------------------|-----------------|")

    for r in results:
        c = r["company"]
        sw = r["similarweb"]
        yf = r["yahoo"]

        # Determine top traffic source
        top_source = "N/A"
        if sw["traffic_sources"]:
            ts = sw["traffic_sources"]
            max_source = max(ts.items(), key=lambda x: x[1] if x[1] else 0)
            top_source = f"{max_source[0].title()} ({max_source[1]}%)"

        # Format competitors
        competitors = ", ".join(sw["top_competitors"][:3]) if sw["top_competitors"] else "N/A"

        row = [
            c["name"],
            c["domain"],
            c["ticker"] or "Private",
            format_number(yf["revenue"], "$"),
            format_number(yf["market_cap"], "$"),
            format_number(yf["employees"]),
            format_number(sw["total_visits"]),
            top_source,
            competitors
        ]
        print("| " + " | ".join(row) + " |")

    # Save detailed JSON
    output_file = os.path.join(os.path.dirname(__file__), "..", "data", "enrichment_10_companies.json")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n\nDetailed results saved to: {output_file}")


if __name__ == "__main__":
    main()
