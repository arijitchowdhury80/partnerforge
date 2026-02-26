#!/usr/bin/env python3
"""
PartnerForge: Batch Enrichment to Supabase
==========================================

Reads enrichment JSON files and batch-updates Supabase displacement_targets table.

Features:
- Parallel processing using ThreadPoolExecutor (10 concurrent workers)
- Batch API calls for efficiency
- Processes both v1 and v2 enrichment formats
- Uses service_role key for write access

Usage:
    python batch_enrich_supabase.py                    # Process all enrichment files
    python batch_enrich_supabase.py --dry-run          # Preview without updating
    python batch_enrich_supabase.py --batch-size 20    # Custom batch size
    python batch_enrich_supabase.py --file domain.json # Process single file
"""

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from glob import glob
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import argparse
import time

import requests
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Supabase configuration (use service_role key for write access)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

# Enrichments directory
ENRICHMENTS_DIR = Path(__file__).parent.parent / "data" / "enrichments"

# Search provider mapping for cleaner display
SEARCH_PROVIDER_MAP = {
    "algolia": "Algolia",
    "elasticsearch": "Elasticsearch",
    "elastic": "Elasticsearch",
    "solr": "Solr",
    "coveo": "Coveo",
    "searchspring": "SearchSpring",
    "klevu": "Klevu",
    "bloomreach": "BloomReach",
    "lucidworks": "LucidWorks",
    "searchanise": "Searchanise",
    "doofinder": "Doofinder",
    "swiftype": "Swiftype",
    "meilisearch": "Meilisearch",
    "amazon elastic load": "AWS ELB",
}


def normalize_search_provider(providers: List[str]) -> Optional[str]:
    """Normalize search provider list to primary provider name."""
    if not providers:
        return None

    # Filter out AWS ELB (not a search provider)
    search_providers = []
    for p in providers:
        p_lower = p.lower()
        # Skip AWS ELB entries
        if "elastic load" in p_lower or "elb" in p_lower:
            continue
        # Check for known search providers
        for key, name in SEARCH_PROVIDER_MAP.items():
            if key in p_lower:
                search_providers.append(name)
                break

    # Return first real search provider found
    return search_providers[0] if search_providers else None


def parse_enrichment_file(filepath: Path) -> Optional[Dict]:
    """
    Parse enrichment JSON file and extract relevant fields.

    Returns dict with:
        - domain: str
        - enrichment_level: 'full'
        - last_enriched: ISO timestamp
        - tech_stack_json: dict (builtwith data)
        - sw_monthly_visits: int
        - current_search: str (search provider if found)
        - is_public: bool
        - ticker: str
    """
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ERROR reading {filepath.name}: {e}")
        return None

    # Skip files that indicate existing customers
    if data.get("status") == "EXISTING_CUSTOMER":
        return None

    domain = data.get("domain")
    if not domain:
        return None

    # Extract BuiltWith data
    builtwith = data.get("builtwith", {})
    similarweb = data.get("similarweb", {})
    financials = data.get("financials", {})

    # Get monthly visits (handle both formats)
    monthly_visits = similarweb.get("monthly_visits")
    if monthly_visits is None:
        monthly_visits = similarweb.get("total_visits")

    # Get search provider
    search_providers = builtwith.get("search_providers", [])
    current_search = normalize_search_provider(search_providers)

    # Check if Algolia customer (should skip)
    if builtwith.get("has_algolia"):
        return None

    return {
        "domain": domain,
        "enrichment_level": "full",
        "last_enriched": datetime.now().isoformat(),
        "tech_stack_json": {
            "tech_count": builtwith.get("tech_count", 0),
            "technologies": builtwith.get("all_techs", [])[:50],  # Limit to 50 for storage
            "search_providers": search_providers,
        },
        "sw_monthly_visits": int(monthly_visits) if monthly_visits else None,
        "current_search": current_search,
        "is_public": financials.get("is_public", False),
        "ticker": financials.get("ticker"),
    }


def update_single_target(domain: str, update_data: Dict, dry_run: bool = False) -> Tuple[str, bool, str]:
    """
    Update a single target in Supabase.

    Returns tuple: (domain, success, message)
    """
    if dry_run:
        return (domain, True, "DRY RUN - would update")

    url = f"{SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.{domain}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    try:
        response = requests.patch(url, headers=headers, json=update_data, timeout=30)

        if response.status_code in (200, 204):
            return (domain, True, "Updated")
        else:
            return (domain, False, f"HTTP {response.status_code}: {response.text[:100]}")
    except Exception as e:
        return (domain, False, str(e))


def batch_update_targets(updates: List[Dict], batch_size: int = 10, dry_run: bool = False) -> Dict:
    """
    Update multiple targets in parallel using ThreadPoolExecutor.

    Args:
        updates: List of dicts with 'domain' and update fields
        batch_size: Number of concurrent workers (default 10)
        dry_run: If True, don't actually update

    Returns:
        Dict with 'success', 'failed', 'skipped' counts and details
    """
    results = {
        "success": [],
        "failed": [],
        "total": len(updates),
        "start_time": datetime.now().isoformat(),
    }

    if not updates:
        return results

    print(f"\nProcessing {len(updates)} enrichment records...")
    print(f"Batch size: {batch_size} concurrent workers")
    if dry_run:
        print("DRY RUN MODE - no actual updates will be made\n")

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=batch_size) as executor:
        # Submit all tasks
        future_to_domain = {}
        for update in updates:
            domain = update.pop("domain")
            future = executor.submit(update_single_target, domain, update, dry_run)
            future_to_domain[future] = domain

        # Process results as they complete
        for i, future in enumerate(as_completed(future_to_domain), 1):
            domain, success, message = future.result()

            if success:
                results["success"].append(domain)
                status = "OK"
            else:
                results["failed"].append({"domain": domain, "error": message})
                status = "FAIL"

            # Progress indicator
            print(f"  [{i}/{len(updates)}] {domain}: {status}")

    elapsed = time.time() - start_time
    results["elapsed_seconds"] = round(elapsed, 2)
    results["end_time"] = datetime.now().isoformat()

    return results


def collect_enrichment_files(directory: Path, single_file: Optional[str] = None) -> List[Path]:
    """Collect all enrichment JSON files from directory."""
    if single_file:
        filepath = directory / single_file
        if filepath.exists():
            return [filepath]
        # Try with .json extension
        filepath = directory / f"{single_file}.json"
        if filepath.exists():
            return [filepath]
        print(f"ERROR: File not found: {single_file}")
        return []

    # Get all JSON files, prefer v2 versions
    all_files = list(directory.glob("*.json"))

    # Deduplicate: if both domain.json and domain_v2.json exist, use v2
    file_map = {}
    for f in all_files:
        name = f.stem
        # Normalize name (remove _v2 suffix for comparison)
        base_name = name.replace("_v2", "")

        if base_name not in file_map:
            file_map[base_name] = f
        elif "_v2" in name:
            # Prefer v2 version
            file_map[base_name] = f

    return sorted(file_map.values())


def main():
    parser = argparse.ArgumentParser(description="Batch update Supabase with enrichment data")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    parser.add_argument("--batch-size", type=int, default=10, help="Concurrent workers (default: 10)")
    parser.add_argument("--file", "-f", help="Process single enrichment file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")

    args = parser.parse_args()

    print("=" * 60)
    print("PartnerForge: Batch Enrichment to Supabase")
    print("=" * 60)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Enrichments dir: {ENRICHMENTS_DIR}")
    print()

    # Collect files
    files = collect_enrichment_files(ENRICHMENTS_DIR, args.file)
    print(f"Found {len(files)} enrichment files")

    if not files:
        print("No files to process")
        return

    # Parse all files and collect updates
    updates = []
    skipped = {"no_domain": 0, "algolia_customer": 0, "parse_error": 0}

    print("\nParsing enrichment files...")
    for filepath in files:
        result = parse_enrichment_file(filepath)
        if result:
            updates.append(result)
            if args.verbose:
                print(f"  + {result['domain']}: {result.get('sw_monthly_visits', 'N/A')} visits")
        else:
            skipped["parse_error"] += 1

    print(f"\nParsed {len(updates)} valid enrichments (skipped {sum(skipped.values())})")

    if not updates:
        print("No valid updates to process")
        return

    # Run batch update
    results = batch_update_targets(updates, batch_size=args.batch_size, dry_run=args.dry_run)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total processed: {results['total']}")
    print(f"Successful: {len(results['success'])}")
    print(f"Failed: {len(results['failed'])}")
    print(f"Elapsed time: {results.get('elapsed_seconds', 'N/A')} seconds")

    if results["failed"]:
        print("\nFailed updates:")
        for fail in results["failed"][:10]:  # Show first 10
            print(f"  - {fail['domain']}: {fail['error']}")
        if len(results["failed"]) > 10:
            print(f"  ... and {len(results['failed']) - 10} more")

    print("\nDone!")


if __name__ == "__main__":
    main()
