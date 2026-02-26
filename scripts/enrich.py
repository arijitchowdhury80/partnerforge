#!/usr/bin/env python3
"""
Universal Deep Enrichment Script with Batch Processing

Enriches companies for ANY partner with ALL data sources using BATCH API calls:
- SimilarWeb (batch traffic, engagement)
- BuiltWith (batch technology stack)
- Yahoo Finance (batch financials for public companies)
- Strategic insights

Usage:
  python3 scripts/enrich.py <partner_name>                    # Enrich all companies
  python3 scripts/enrich.py <partner_name> --batch 1 --of 4   # Parallel batch
  python3 scripts/enrich.py --list                            # List partners

Examples:
  python3 scripts/enrich.py Amplience
  python3 scripts/enrich.py "Adobe Experience Manager"
"""

import argparse
import json
import requests
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any, Optional

try:
    import yfinance as yf
except ImportError:
    import subprocess
    subprocess.check_call(['pip3', 'install', 'yfinance', '-q'])
    import yfinance as yf

# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co'
SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA4NTU0MCwiZXhwIjoyMDg3NjYxNTQwfQ.tVnqtUbxS55dNnUiKY6_LBqVYYLhGztWoagg-efc3Ac'

SIMILARWEB_API_KEY = '483b77d48d254810b4caf3d376b28ce7'
BUILTWITH_API_KEY = '8fd992ef-88d0-4554-a20b-364e97b2d302'

# Batch sizes for API calls
BATCH_SIZE_SW = 10      # SimilarWeb batch limit
BATCH_SIZE_BW = 10      # BuiltWith batch limit
BATCH_SIZE_YF = 20      # Yahoo Finance batch limit
PARALLEL_WORKERS = 5    # Concurrent threads

HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
    'Content-Type': 'application/json'
}


# =============================================================================
# Supabase Functions
# =============================================================================

def list_partners() -> list[dict]:
    """List all unique partners in the database."""
    url = f"{SUPABASE_URL}/rest/v1/displacement_targets?select=partner_tech"
    response = requests.get(url, headers=HEADERS)

    if response.ok:
        data = response.json()
        partners = {}
        for row in data:
            tech = row.get('partner_tech', 'Unknown')
            partners[tech] = partners.get(tech, 0) + 1
        return sorted([{'name': k, 'count': v} for k, v in partners.items()], key=lambda x: -x['count'])
    return []


def fetch_companies(partner: str, limit: Optional[int] = None, exclude_algolia: bool = True) -> list[dict]:
    """Fetch displacement targets for a given partner (excludes Algolia customers by default)."""
    url = f"{SUPABASE_URL}/rest/v1/displacement_targets?partner_tech=ilike.*{partner}*&select=*&order=revenue.desc.nullslast"
    if limit:
        url += f"&limit={limit}"

    response = requests.get(url, headers=HEADERS)
    if not response.ok:
        return []

    companies = response.json()

    # Filter out Algolia customers - they're not displacement targets!
    if exclude_algolia:
        before = len(companies)
        companies = [
            c for c in companies
            if not c.get('current_search') or 'algolia' not in c.get('current_search', '').lower()
        ]
        excluded = before - len(companies)
        if excluded > 0:
            print(f"  (Excluded {excluded} existing Algolia customers)")

    return companies


def batch_update_companies(updates: list[dict]) -> int:
    """Batch update multiple companies in Supabase."""
    success = 0
    for update in updates:
        domain = update.pop('_domain')
        url = f"{SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.{requests.utils.quote(domain)}"
        update['last_enriched'] = datetime.now().isoformat()
        update['enrichment_level'] = 'deep'

        response = requests.patch(url, headers={**HEADERS, 'Prefer': 'return=minimal'}, json=update)
        if response.ok:
            success += 1
    return success


# =============================================================================
# Batch SimilarWeb
# =============================================================================

def fetch_similarweb_batch(domains: list[str]) -> dict[str, dict]:
    """Fetch SimilarWeb data for multiple domains in parallel."""
    results = {}

    def fetch_single(domain: str) -> tuple[str, dict]:
        data = {}
        try:
            url = f"https://api.similarweb.com/v1/SimilarWebAddon/{domain}/all"
            response = requests.get(url, params={'api_key': SIMILARWEB_API_KEY}, timeout=30)
            if response.ok:
                sw = response.json()
                visits = sw.get('visits') or sw.get('GlobalRank', {}).get('Visits')
                if isinstance(visits, (int, float)) and visits > 0:
                    data['sw_monthly_visits'] = int(visits)

                bounce = sw.get('bounce_rate') or sw.get('BounceRate')
                if isinstance(bounce, (int, float)):
                    data['sw_bounce_rate'] = float(bounce)

                pages = sw.get('pages_per_visit') or sw.get('PagePerVisit')
                if isinstance(pages, (int, float)):
                    data['sw_pages_per_visit'] = float(pages)

                duration = sw.get('time_on_site') or sw.get('TimeOnSite')
                if isinstance(duration, (int, float)):
                    data['sw_avg_duration'] = int(duration)

                global_rank = sw.get('GlobalRank', {})
                if isinstance(global_rank, dict):
                    rank = global_rank.get('Rank')
                    if isinstance(rank, (int, float)) and rank > 0:
                        data['sw_rank_global'] = int(rank)
        except:
            pass
        return domain, data

    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
        futures = {executor.submit(fetch_single, d): d for d in domains}
        for future in as_completed(futures):
            domain, data = future.result()
            results[domain] = data

    return results


# =============================================================================
# Batch BuiltWith
# =============================================================================

def fetch_builtwith_batch(domains: list[str]) -> dict[str, dict]:
    """Fetch BuiltWith data for multiple domains using enterprise API."""
    results = {}

    # BuiltWith enterprise API v21
    def fetch_single(domain: str) -> tuple[str, dict]:
        data = {}
        try:
            url = "https://api.builtwith.com/v21/api.json"
            response = requests.get(url, params={'KEY': BUILTWITH_API_KEY, 'LOOKUP': domain}, timeout=30)
            if response.ok:
                bw = response.json()
                if 'Results' in bw and bw['Results']:
                    paths = bw['Results'][0].get('Result', {}).get('Paths', [])
                    if paths:
                        techs = paths[0].get('Technologies', [])
                        tech_data = {
                            'technologies': [t.get('Name') for t in techs if t.get('Name')],
                            'categories': list(set([t.get('Categories', [''])[0] for t in techs if t.get('Categories')])),
                        }
                        data['tech_stack_json'] = json.dumps(tech_data)

                        search_providers = ['Algolia', 'Elasticsearch', 'Coveo', 'Bloomreach', 'Searchspring']
                        found = [t for t in tech_data['technologies'] if any(s.lower() in t.lower() for s in search_providers)]
                        if found:
                            data['current_search'] = found[0]
        except:
            pass
        return domain, data

    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
        futures = {executor.submit(fetch_single, d): d for d in domains}
        for future in as_completed(futures):
            domain, data = future.result()
            results[domain] = data

    return results


# =============================================================================
# Batch Yahoo Finance
# =============================================================================

def fetch_yahoo_finance_batch(tickers: list[str]) -> dict[str, dict]:
    """Fetch Yahoo Finance data for multiple tickers at once."""
    results = {}

    # Filter out invalid tickers
    valid_tickers = [t for t in tickers if t and t not in ['NULL', 'Private', 'None', '']]

    if not valid_tickers:
        return results

    try:
        # yfinance supports batch downloads
        ticker_str = ' '.join(valid_tickers)
        data = yf.Tickers(ticker_str)

        for ticker in valid_tickers:
            try:
                info = data.tickers[ticker].info
                if info and info.get('regularMarketPrice'):
                    def format_pct(v):
                        return f"{v * 100:.1f}%" if v else None

                    results[ticker] = {
                        'financials_json': {
                            'ticker': ticker,
                            'fetchedAt': datetime.now().isoformat(),
                            'revenue': info.get('totalRevenue'),
                            'revenueGrowth': format_pct(info.get('revenueGrowth')),
                            'grossMargins': format_pct(info.get('grossMargins')),
                            'operatingMargins': format_pct(info.get('operatingMargins')),
                            'profitMargins': format_pct(info.get('profitMargins')),
                            'ebitda': info.get('ebitda'),
                            'marketCap': info.get('marketCap'),
                            'sector': info.get('sector'),
                            'industry': info.get('industry'),
                            'employees': info.get('fullTimeEmployees'),
                        },
                        'revenue': info.get('totalRevenue'),
                        'gross_margin': round(info['grossMargins'] * 100, 1) if info.get('grossMargins') else None,
                        'vertical': info.get('sector'),
                    }
            except:
                pass
    except Exception as e:
        print(f"  Yahoo Finance batch error: {e}")

    return results


# =============================================================================
# Strategic Insights (batch)
# =============================================================================

def generate_insights_batch(companies: list[dict], enrichments: dict[str, dict]) -> dict[str, dict]:
    """Generate strategic insights for all companies."""
    results = {}

    for company in companies:
        domain = company['domain']
        enrichment = enrichments.get(domain, {})
        angles = []

        visits = enrichment.get('sw_monthly_visits')
        if visits and visits > 1000000:
            angles.append(f"High traffic ({visits/1e6:.1f}M/mo)")

        revenue = enrichment.get('revenue') or company.get('revenue')
        if revenue and revenue > 1e9:
            angles.append(f"Enterprise (${revenue/1e9:.1f}B)")

        current_search = enrichment.get('current_search')
        if current_search:
            angles.append(f"Displacing {current_search}")
        else:
            angles.append("Greenfield")

        results[domain] = {'displacement_angle': '; '.join(angles[:3])} if angles else {}

    return results


# =============================================================================
# Main Batch Enrichment
# =============================================================================

def run_enrichment(partner: str, batch_num: Optional[int] = None, total_batches: int = 1, limit: Optional[int] = None):
    """Run batch enrichment for all companies of a partner."""

    print(f"\n{'='*70}")
    print(f"BATCH DEEP ENRICHMENT: {partner.upper()}")
    print(f"{'='*70}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Mode: Parallel batch processing (5 workers, chunked API calls)")

    # 1. Fetch all companies
    print(f"\n[1/5] Fetching companies from database...")
    companies = fetch_companies(partner, limit)
    total = len(companies)

    if total == 0:
        print(f"No companies found for partner: {partner}")
        return

    # Handle batching for parallel execution
    if batch_num is not None:
        batch_size = (total + total_batches - 1) // total_batches
        start_idx = (batch_num - 1) * batch_size
        end_idx = min(start_idx + batch_size, total)
        companies = companies[start_idx:end_idx]
        print(f"  Batch {batch_num}/{total_batches}: companies {start_idx+1}-{end_idx}")
    else:
        print(f"  Found {total} companies")

    domains = [c['domain'] for c in companies]
    tickers = list(set([c.get('ticker') for c in companies if c.get('ticker') and c.get('ticker') not in ['NULL', 'Private']]))

    # 2. Batch fetch SimilarWeb
    print(f"\n[2/5] SimilarWeb traffic (parallel, {len(domains)} domains)...")
    start = time.time()
    sw_results = fetch_similarweb_batch(domains)
    sw_success = sum(1 for v in sw_results.values() if v)
    print(f"  ✓ Got data for {sw_success}/{len(domains)} domains in {time.time()-start:.1f}s")

    # 3. Batch fetch BuiltWith
    print(f"\n[3/5] BuiltWith tech stack (parallel, {len(domains)} domains)...")
    start = time.time()
    bw_results = fetch_builtwith_batch(domains)
    bw_success = sum(1 for v in bw_results.values() if v)
    print(f"  ✓ Got data for {bw_success}/{len(domains)} domains in {time.time()-start:.1f}s")

    # 4. Batch fetch Yahoo Finance
    print(f"\n[4/5] Yahoo Finance (batch, {len(tickers)} tickers)...")
    start = time.time()
    yf_results = fetch_yahoo_finance_batch(tickers)
    yf_success = len(yf_results)
    print(f"  ✓ Got data for {yf_success}/{len(tickers)} tickers in {time.time()-start:.1f}s")

    # Build ticker -> domain mapping
    ticker_to_domain = {c.get('ticker'): c['domain'] for c in companies if c.get('ticker')}

    # 5. Merge all enrichments
    print(f"\n[5/5] Merging data and generating insights...")
    all_enrichments = {}

    for company in companies:
        domain = company['domain']
        ticker = company.get('ticker')

        enrichment = {'_domain': domain}

        # Add SimilarWeb data
        if domain in sw_results:
            enrichment.update(sw_results[domain])

        # Add BuiltWith data
        if domain in bw_results:
            enrichment.update(bw_results[domain])

        # Add Yahoo Finance data
        if ticker and ticker in yf_results:
            yf_data = yf_results[ticker]
            enrichment.update(yf_data)

        all_enrichments[domain] = enrichment

    # Generate strategic insights
    insights = generate_insights_batch(companies, all_enrichments)
    for domain, insight in insights.items():
        all_enrichments[domain].update(insight)

    # 6. Batch update database
    print(f"\n[6/5] Saving to database...")
    updates = list(all_enrichments.values())
    success = batch_update_companies(updates)

    # Summary
    print(f"\n{'='*70}")
    print(f"ENRICHMENT COMPLETE")
    print(f"{'='*70}")
    print(f"Partner:     {partner}")
    print(f"Companies:   {len(companies)}")
    print(f"SimilarWeb:  {sw_success} enriched")
    print(f"BuiltWith:   {bw_success} enriched")
    print(f"Yahoo Fin:   {yf_success} enriched")
    print(f"DB Updates:  {success} saved")
    print(f"{'='*70}")

    return {'success': success, 'total': len(companies)}


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Universal Batch Enrichment Script')
    parser.add_argument('partner', nargs='?', help='Partner name to enrich')
    parser.add_argument('--list', action='store_true', help='List all available partners')
    parser.add_argument('--batch', type=int, help='Batch number (for parallel execution)')
    parser.add_argument('--of', type=int, default=1, dest='total_batches', help='Total batches')
    parser.add_argument('--limit', type=int, help='Limit number of companies')

    args = parser.parse_args()

    if args.list:
        print("\nAvailable Partners:")
        print("-" * 40)
        for p in list_partners():
            print(f"  {p['name']}: {p['count']} companies")
        return

    if not args.partner:
        parser.print_help()
        return

    run_enrichment(args.partner, args.batch, args.total_batches, args.limit)


if __name__ == '__main__':
    main()
