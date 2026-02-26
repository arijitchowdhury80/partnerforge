#!/usr/bin/env python3
"""
Batch Enrichment Script
======================
Fetches SimilarWeb traffic and Yahoo Finance financial data for a list of domains.
Calculates ICP scores and outputs to JSON.

Usage:
    python scripts/batch_enrich.py
"""

import json
import os
import time
from typing import Optional, Dict, Any, List
import requests

# Load API key from .env
from dotenv import load_dotenv
load_dotenv()

SIMILARWEB_API_KEY = os.getenv("SIMILARWEB_API_KEY", "483b77d48d254810b4caf3d376b28ce7")

# Domains to enrich with their ticker info
DOMAINS = [
    {"domain": "f5.com", "ticker": "FFIV", "company": "F5 Networks"},
    {"domain": "juniper.net", "ticker": "JNPR", "company": "Juniper Networks"},
    {"domain": "hilti.com", "ticker": None, "company": "Hilti"},
    {"domain": "allianz.com.au", "ticker": "ALV.DE", "company": "Allianz Australia"},
    {"domain": "bms.com", "ticker": "BMY", "company": "Bristol-Myers Squibb"},
    {"domain": "moodys.com", "ticker": "MCO", "company": "Moody's"},
    {"domain": "mulberry.com", "ticker": "MUL.L", "company": "Mulberry Group"},
    {"domain": "siemens-healthineers.com", "ticker": "SHL.DE", "company": "Siemens Healthineers"},
    {"domain": "zf.com", "ticker": None, "company": "ZF Friedrichshafen"},
    {"domain": "daimlertruck.com", "ticker": "DTG.DE", "company": "Daimler Truck"},
    {"domain": "nissan.it", "ticker": "NSANY", "company": "Nissan Italy"},
    {"domain": "odpbusiness.com", "ticker": "ODP", "company": "ODP Corporation"},
    {"domain": "sunstargum.com", "ticker": None, "company": "Sunstar"},
    {"domain": "tapestry.com", "ticker": "TPR", "company": "Tapestry"},
    {"domain": "nissan.in", "ticker": "NSANY", "company": "Nissan India"},
    {"domain": "hardeck.de", "ticker": None, "company": "Hardeck"},
    {"domain": "aldi.com", "ticker": None, "company": "Aldi"},
    {"domain": "averydennison.com", "ticker": "AVY", "company": "Avery Dennison"},
    {"domain": "koempf24.de", "ticker": None, "company": "Koempf24"},
    {"domain": "chevrolet.com.ec", "ticker": "GM", "company": "Chevrolet Ecuador/GM"},
    {"domain": "landmarkgroup.com", "ticker": None, "company": "Landmark Group"},
    {"domain": "vraylar.com", "ticker": "ABBV", "company": "AbbVie"},
    {"domain": "missguided.com", "ticker": None, "company": "Missguided"},
    {"domain": "rosebikes.com", "ticker": None, "company": "Rose Bikes"},
    {"domain": "lumas.com", "ticker": None, "company": "LUMAS"},
]


def get_similarweb_traffic(domain: str) -> Optional[int]:
    """Get monthly traffic visits from SimilarWeb API."""
    url = f"https://api.similarweb.com/v1/website/{domain}/total-traffic-and-engagement/visits"
    params = {
        "api_key": SIMILARWEB_API_KEY,
        "country": "ww",  # worldwide
        "granularity": "monthly",
        "main_domain_only": "true",
    }

    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            visits = data.get("visits", [])
            if visits:
                # Get the latest month's visits
                latest = visits[-1]
                return latest.get("visits", 0)
        else:
            print(f"  SimilarWeb error for {domain}: {response.status_code}")
    except Exception as e:
        print(f"  SimilarWeb exception for {domain}: {e}")

    return None


def get_yahoo_finance_data(ticker: str) -> Dict[str, Any]:
    """Get revenue and market cap from Yahoo Finance."""
    result = {"revenue": None, "market_cap": None}

    if not ticker:
        return result

    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info

        # Get market cap
        result["market_cap"] = info.get("marketCap")

        # Get total revenue (TTM)
        result["revenue"] = info.get("totalRevenue")

    except Exception as e:
        print(f"  Yahoo Finance exception for {ticker}: {e}")

    return result


def calculate_icp_score(traffic: Optional[int], revenue: Optional[int], is_public: bool) -> int:
    """
    Calculate ICP score based on:
    - Traffic: 50M+=30pts, 20M+=25pts, 10M+=20pts, 5M+=15pts, 1M+=10pts
    - Revenue: $10B+=30pts, $5B+=25pts, $1B+=20pts
    - Public company bonus: 10pts
    - Base (Adobe AEM): 30pts
    """
    score = 30  # Base score for Adobe AEM

    # Traffic score
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

    # Revenue score
    if revenue:
        if revenue >= 10_000_000_000:  # $10B+
            score += 30
        elif revenue >= 5_000_000_000:  # $5B+
            score += 25
        elif revenue >= 1_000_000_000:  # $1B+
            score += 20

    # Public company bonus
    if is_public:
        score += 10

    return score


def main():
    """Main enrichment function."""
    results = []

    print("Starting batch enrichment for 25 domains...")
    print("=" * 60)

    for i, item in enumerate(DOMAINS, 1):
        domain = item["domain"]
        ticker = item["ticker"]
        company = item["company"]

        print(f"\n[{i}/25] Processing {domain} ({company})...")

        # Get SimilarWeb traffic
        traffic = get_similarweb_traffic(domain)
        print(f"  Traffic: {traffic:,}" if traffic else "  Traffic: N/A")

        # Get Yahoo Finance data
        finance_data = get_yahoo_finance_data(ticker)
        revenue = finance_data["revenue"]
        market_cap = finance_data["market_cap"]

        print(f"  Revenue: ${revenue:,.0f}" if revenue else "  Revenue: N/A")
        print(f"  Market Cap: ${market_cap:,.0f}" if market_cap else "  Market Cap: N/A")

        # Calculate ICP score
        is_public = ticker is not None
        icp_score = calculate_icp_score(traffic, revenue, is_public)
        print(f"  ICP Score: {icp_score}")

        results.append({
            "domain": domain,
            "company": company,
            "ticker": ticker,
            "is_public": is_public,
            "traffic": traffic,
            "revenue": revenue,
            "market_cap": market_cap,
            "icp_score": icp_score,
        })

        # Rate limit: 1 second between requests
        time.sleep(1)

    # Save results
    output_path = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/data/enrichment_batch1.json"

    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print(f"Enrichment complete! Results saved to:")
    print(f"  {output_path}")

    # Summary
    print("\nSummary:")
    public_count = sum(1 for r in results if r["is_public"])
    traffic_found = sum(1 for r in results if r["traffic"])
    revenue_found = sum(1 for r in results if r["revenue"])
    avg_score = sum(r["icp_score"] for r in results) / len(results)

    print(f"  Public companies: {public_count}/25")
    print(f"  Traffic data found: {traffic_found}/25")
    print(f"  Revenue data found: {revenue_found}/25")
    print(f"  Average ICP score: {avg_score:.1f}")

    # Top 5 by ICP score
    top5 = sorted(results, key=lambda x: x["icp_score"], reverse=True)[:5]
    print("\nTop 5 by ICP Score:")
    for r in top5:
        print(f"  {r['domain']}: {r['icp_score']} pts")


if __name__ == "__main__":
    main()
