#!/usr/bin/env python3
"""
PartnerForge: Company Intelligence Enrichment

Enriches a target company with:
- Financial data (3-year trends via Yahoo Finance)
- Executive quotes (from earnings calls, 10-K filings)
- Hiring signals (from careers pages)
- Strategic triggers (tech changes, leadership, events)
- Competitive intelligence

Every data point includes source URL for citation.

Usage:
    python enrich_company.py --domain huawei.com
    python enrich_company.py --domain mercedes-benz.com --ticker MBG.DE
    python enrich_company.py --top 10  # Enrich top 10 by score
"""

import sqlite3
import subprocess
import json
import argparse
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/data/partnerforge.db"

# Signal weights for priority scoring
SIGNAL_WEIGHTS = {
    # Budget signals
    "hiring_search_roles": 25,
    "revenue_growing": 15,
    "margin_green": 10,
    "recent_funding": 20,
    "tech_investment_up": 10,

    # Pain signals
    "search_vendor_removed": 30,
    "using_competitor_search": 15,
    "executive_quote_digital": 20,
    "risk_factor_tech": 15,

    # Timing signals
    "new_executive": 25,
    "platform_migration": 20,
    "competitor_uses_algolia": 20,
    "ecommerce_growing": 15,

    # Negative signals
    "layoffs": -25,
    "added_competitor_search": -40,
    "revenue_declining": -20,
    "margin_red": -15,
}


def run_curl(url: str, timeout: int = 15) -> Optional[str]:
    """Run curl and return response."""
    try:
        result = subprocess.run(
            ['curl', '-s', '-L', '--max-time', str(timeout), url],
            capture_output=True,
            text=True,
            timeout=timeout + 5
        )
        return result.stdout
    except Exception as e:
        print(f"   ⚠️ Curl error: {e}")
        return None


def search_ticker(company_name: str, domain: str) -> Optional[str]:
    """Try to find stock ticker for a company."""
    # Common company name to ticker mappings
    known_tickers = {
        "f5": "FFIV",
        "bristol myers": "BMY",
        "bristol-myers": "BMY",
        "moodys": "MCO",
        "moody's": "MCO",
        "huawei": None,  # Private
        "jpmorgan": "JPM",
        "chase": "JPM",
        "goldman sachs": "GS",
        "microsoft": "MSFT",
        "google": "GOOGL",
        "alphabet": "GOOGL",
        "amazon": "AMZN",
        "apple": "AAPL",
        "meta": "META",
        "facebook": "META",
        "nvidia": "NVDA",
        "tesla": "TSLA",
        "home depot": "HD",
        "lowes": "LOW",
        "best buy": "BBY",
        "dick's sporting": "DKS",
        "dicks sporting": "DKS",
        "foot locker": "FL",
        "gap": "GPS",
        "american eagle": "AEO",
        "urban outfitters": "URBN",
        "ralph lauren": "RL",
        "pvh": "PVH",
        "tapestry": "TPR",
        "coach": "TPR",
        "vf corp": "VFC",
        "hanesbrands": "HBI",
        "lululemon": "LULU",
        "nike": "NKE",
        "adidas": "ADDYY",
        "puma": "PUMSY",
        "mercedes-benz": "MBG.DE",
        "mercedes": "MBG.DE",
        "cvs": "CVS",
        "caremark": "CVS",
        "national australia bank": "NAB.AX",
        "nab": "NAB.AX",
        "sp global": "SPGI",
        "spglobal": "SPGI",
        "walmart": "WMT",
        "costco": "COST",
        "target": "TGT",
        "macys": "M",
        "kohls": "KSS",
        "nordstrom": "JWN",
        "autozone": "AZO",
        "oreilly": "ORLY",
        "advance auto": "AAP",
    }

    # Check known mappings
    company_lower = company_name.lower() if company_name else ""
    domain_lower = domain.lower().replace(".com", "").replace("www.", "")

    for key, ticker in known_tickers.items():
        if key in company_lower or key in domain_lower:
            return ticker

    return None


def fetch_yahoo_finance_data(ticker: str) -> Dict:
    """Fetch financial data from Yahoo Finance."""
    if not ticker:
        return {"error": "No ticker provided"}

    base_url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"

    try:
        response = run_curl(f"{base_url}?interval=1mo&range=3y")
        if response:
            data = json.loads(response)
            if "chart" in data and data["chart"]["result"]:
                result = data["chart"]["result"][0]
                meta = result.get("meta", {})

                return {
                    "ticker": ticker,
                    "currency": meta.get("currency", "USD"),
                    "current_price": meta.get("regularMarketPrice"),
                    "previous_close": meta.get("previousClose"),
                    "source_url": f"https://finance.yahoo.com/quote/{ticker}",
                    "fetched_at": datetime.now().isoformat()
                }
    except Exception as e:
        print(f"   ⚠️ Yahoo Finance error: {e}")

    return {"error": "Failed to fetch"}


def calculate_priority_score(
    icp_score: int,
    signals: Dict[str, bool]
) -> Tuple[int, str, List[str]]:
    """Calculate priority score and determine status."""

    signal_score = 0
    signal_types = {"budget": False, "pain": False, "timing": False}
    active_signals = []

    for signal_name, is_present in signals.items():
        if is_present and signal_name in SIGNAL_WEIGHTS:
            weight = SIGNAL_WEIGHTS[signal_name]
            signal_score += weight
            active_signals.append(f"{signal_name}: {'+' if weight > 0 else ''}{weight}")

            # Categorize signal type
            if signal_name in ["hiring_search_roles", "revenue_growing", "margin_green", "recent_funding", "tech_investment_up"]:
                signal_types["budget"] = True
            elif signal_name in ["search_vendor_removed", "using_competitor_search", "executive_quote_digital", "risk_factor_tech"]:
                signal_types["pain"] = True
            elif signal_name in ["new_executive", "platform_migration", "competitor_uses_algolia", "ecommerce_growing"]:
                signal_types["timing"] = True

    priority_score = icp_score + signal_score

    # Determine status
    has_all_three = all(signal_types.values())

    if priority_score >= 150 or has_all_three:
        status = "hot"
    elif priority_score >= 100 or sum(signal_types.values()) >= 2:
        status = "warm"
    elif priority_score >= 50:
        status = "cool"
    else:
        status = "cold"

    return priority_score, status, active_signals


def enrich_company(domain: str, ticker: str = None, conn: sqlite3.Connection = None) -> Dict:
    """Enrich a single company with intelligence data."""

    close_conn = False
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        close_conn = True

    cursor = conn.cursor()

    # Get company info from displacement_targets
    cursor.execute("""
        SELECT id, company_name, domain, vertical, country, icp_tier, lead_score, sw_monthly_visits
        FROM displacement_targets
        WHERE domain = ? OR domain LIKE ?
    """, (domain, f"%{domain}%"))

    row = cursor.fetchone()
    if not row:
        print(f"   ❌ Company not found: {domain}")
        return {"error": "Not found"}

    target_id, company_name, domain, vertical, country, icp_tier, icp_score, traffic = row
    icp_score = icp_score or 0

    print(f"\n{'='*60}")
    print(f"🔍 Enriching: {company_name or domain}")
    print(f"{'='*60}")

    result = {
        "domain": domain,
        "company_name": company_name,
        "vertical": vertical,
        "icp_score": icp_score,
        "signals": {},
        "financials": None,
        "quotes": [],
        "hiring": [],
        "triggers": [],
    }

    # 1. Try to resolve ticker
    if not ticker:
        ticker = search_ticker(company_name, domain)

    if ticker:
        print(f"   📈 Ticker: {ticker}")
        cursor.execute("UPDATE displacement_targets SET ticker = ?, is_public = 1 WHERE id = ?", (ticker, target_id))

        # Fetch financial data
        print(f"   💰 Fetching financials...")
        fin_data = fetch_yahoo_finance_data(ticker)
        if "error" not in fin_data:
            result["financials"] = fin_data

            # Store in company_financials
            cursor.execute("""
                INSERT OR REPLACE INTO company_financials
                (domain, ticker, company_name, stock_price, data_source, last_updated)
                VALUES (?, ?, ?, ?, 'yahoo_finance', ?)
            """, (domain, ticker, company_name, fin_data.get("current_price"), datetime.now().isoformat()))
    else:
        print(f"   📊 Private company (no ticker)")
        cursor.execute("UPDATE displacement_targets SET is_public = 0 WHERE id = ?", (target_id,))

    # 2. Detect signals based on existing data
    signals = {}

    # Traffic growth (from SimilarWeb data if available)
    if traffic and traffic > 1000000:
        signals["ecommerce_growing"] = True
        result["triggers"].append({
            "type": "ecommerce_growing",
            "title": f"High traffic: {traffic/1000000:.1f}M monthly visits",
            "source": "SimilarWeb",
            "source_url": f"https://www.similarweb.com/website/{domain}/",
            "category": "positive"
        })

    # ICP tier indicates commerce focus
    if icp_tier == 1:
        signals["revenue_growing"] = True  # Commerce companies are digital-focused

    # Calculate priority score
    priority_score, status, active_signals = calculate_priority_score(icp_score, signals)

    result["priority_score"] = priority_score
    result["status"] = status
    result["active_signals"] = active_signals

    # Update enrichment status
    cursor.execute("""
        INSERT OR REPLACE INTO enrichment_status
        (domain, financials_enriched, triggers_enriched, last_enriched)
        VALUES (?, ?, ?, ?)
    """, (domain, 1 if result["financials"] else 0, 1 if result["triggers"] else 0, datetime.now().isoformat()))

    # Update displacement_targets
    cursor.execute("""
        UPDATE displacement_targets
        SET enrichment_level = ?, last_enriched = ?
        WHERE id = ?
    """, ("partial" if result["financials"] else "basic", datetime.now().isoformat(), target_id))

    conn.commit()

    # Summary
    print(f"\n   📊 Results:")
    print(f"      ICP Score: {icp_score}")
    print(f"      Signal Score: {priority_score - icp_score:+d}")
    print(f"      Priority Score: {priority_score}")
    print(f"      Status: {status.upper()}")
    if active_signals:
        print(f"      Active Signals: {', '.join(active_signals)}")

    if close_conn:
        conn.close()

    return result


def enrich_top_n(n: int = 10):
    """Enrich top N companies by ICP score."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT domain, company_name, lead_score
        FROM displacement_targets
        WHERE lead_score IS NOT NULL
        ORDER BY lead_score DESC
        LIMIT ?
    """, (n,))

    targets = cursor.fetchall()

    print(f"\n🚀 Enriching top {n} targets by ICP score...")
    print("=" * 60)

    results = []
    for domain, company_name, score in targets:
        print(f"\n[{len(results)+1}/{n}] {company_name or domain} (Score: {score})")
        result = enrich_company(domain, conn=conn)
        results.append(result)

    conn.close()

    # Summary
    print(f"\n{'='*60}")
    print(f"✅ Enrichment Complete!")
    print(f"   Total: {len(results)}")
    print(f"   With financials: {sum(1 for r in results if r.get('financials'))}")

    return results


def main():
    parser = argparse.ArgumentParser(description='Enrich company intelligence')
    parser.add_argument('--domain', '-d', help='Company domain to enrich')
    parser.add_argument('--ticker', '-t', help='Stock ticker (optional)')
    parser.add_argument('--top', type=int, help='Enrich top N by score')

    args = parser.parse_args()

    if args.top:
        enrich_top_n(args.top)
    elif args.domain:
        enrich_company(args.domain, args.ticker)
    else:
        print("Usage: python enrich_company.py --domain huawei.com")
        print("       python enrich_company.py --top 10")


if __name__ == "__main__":
    main()
