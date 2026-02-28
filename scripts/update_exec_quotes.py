#!/usr/bin/env python3
"""
Arian: Update Executive Quotes
======================================

Updates displacement_targets with executive intelligence data:
- exec_name, exec_title, exec_quote
- quote_source
- displacement_angle
- competitors_using_algolia

Features:
- Reads JSON file with domain-keyed executive data
- Parallel processing using ThreadPoolExecutor (10 workers)
- Uses SUPABASE_SERVICE_ROLE_KEY from .env for write access
- Detailed logging with success/failure tracking

Usage:
    python update_exec_quotes.py exec_quotes.json
    python update_exec_quotes.py exec_quotes.json --dry-run
    python update_exec_quotes.py exec_quotes.json --workers 5

Input JSON format:
{
  "mercedes-benz.com": {
    "exec_name": "Ola Kallenius",
    "exec_title": "CEO",
    "exec_quote": "...",
    "quote_source": "Q4 2025 Earnings Call",
    "displacement_angle": "...",
    "competitors_using_algolia": "BMW, Audi"
  }
}
"""

import argparse
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

# ============================================================================
# Configuration
# ============================================================================

# Load environment variables from .env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Validate required environment variables
if not SUPABASE_URL:
    print("ERROR: SUPABASE_URL not found in .env")
    print(f"Looked for .env at: {env_path}")
    sys.exit(1)

if not SUPABASE_SERVICE_ROLE_KEY:
    print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env")
    print(f"Looked for .env at: {env_path}")
    sys.exit(1)

# Default batch size for parallel processing
DEFAULT_WORKERS = 10

# Valid fields that can be updated
VALID_FIELDS = {
    "exec_name",
    "exec_title",
    "exec_quote",
    "quote_source",
    "displacement_angle",
    "competitors_using_algolia",
}

# ============================================================================
# Logging Setup
# ============================================================================

def setup_logging(verbose: bool = False) -> logging.Logger:
    """Configure logging with appropriate level and format."""
    level = logging.DEBUG if verbose else logging.INFO

    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    return logging.getLogger(__name__)


# ============================================================================
# JSON Loading
# ============================================================================

def load_json_file(filepath: str) -> Dict[str, Dict]:
    """
    Load and validate the input JSON file.

    Args:
        filepath: Path to JSON file

    Returns:
        Dict mapping domain -> executive data

    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If file is not valid JSON
        ValueError: If file format is invalid
    """
    path = Path(filepath)

    if not path.exists():
        raise FileNotFoundError(f"JSON file not found: {filepath}")

    if not path.suffix.lower() == '.json':
        raise ValueError(f"Expected .json file, got: {path.suffix}")

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object with domain keys, got: {type(data).__name__}")

    if not data:
        raise ValueError("JSON file is empty")

    return data


def validate_and_filter_data(
    data: Dict[str, Dict],
    logger: logging.Logger
) -> List[Dict[str, Any]]:
    """
    Validate input data and filter to valid fields.

    Args:
        data: Dict mapping domain -> executive data
        logger: Logger instance

    Returns:
        List of update records with 'domain' and valid fields
    """
    updates = []
    skipped = 0

    for domain, exec_data in data.items():
        if not isinstance(exec_data, dict):
            logger.warning(f"Skipping {domain}: value is not a dict")
            skipped += 1
            continue

        if not domain or not isinstance(domain, str):
            logger.warning(f"Skipping entry with invalid domain: {domain}")
            skipped += 1
            continue

        # Normalize domain (lowercase, strip whitespace)
        normalized_domain = domain.lower().strip()

        # Filter to only valid fields
        valid_data = {}
        for field in VALID_FIELDS:
            if field in exec_data:
                value = exec_data[field]
                # Only include non-empty strings
                if isinstance(value, str) and value.strip():
                    valid_data[field] = value.strip()

        if not valid_data:
            logger.warning(f"Skipping {normalized_domain}: no valid fields found")
            skipped += 1
            continue

        # Add domain to update record
        valid_data["domain"] = normalized_domain
        updates.append(valid_data)

    if skipped > 0:
        logger.info(f"Skipped {skipped} invalid entries")

    return updates


# ============================================================================
# Supabase Update Functions
# ============================================================================

def update_single_target(
    domain: str,
    update_data: Dict[str, Any],
    dry_run: bool = False,
    logger: Optional[logging.Logger] = None
) -> Tuple[str, bool, str]:
    """
    Update a single target in Supabase.

    Args:
        domain: Domain to update
        update_data: Fields to update (without domain key)
        dry_run: If True, don't actually update
        logger: Optional logger for debug output

    Returns:
        Tuple of (domain, success, message)
    """
    if dry_run:
        fields = ", ".join(update_data.keys())
        return (domain, True, f"DRY RUN - would update fields: {fields}")

    # Build Supabase REST API URL with domain filter
    url = f"{SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.{domain}"

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",  # Return updated row to verify
    }

    try:
        response = requests.patch(
            url,
            headers=headers,
            json=update_data,
            timeout=30
        )

        if response.status_code in (200, 204):
            # Check if any row was actually updated
            if response.status_code == 200:
                result = response.json()
                if not result:
                    return (domain, False, "No matching row found in database")
            return (domain, True, "Updated successfully")
        else:
            error_text = response.text[:200] if response.text else "No error details"
            return (domain, False, f"HTTP {response.status_code}: {error_text}")

    except requests.exceptions.Timeout:
        return (domain, False, "Request timed out after 30s")
    except requests.exceptions.ConnectionError as e:
        return (domain, False, f"Connection error: {str(e)[:100]}")
    except Exception as e:
        return (domain, False, f"Unexpected error: {str(e)[:100]}")


def batch_update_targets(
    updates: List[Dict[str, Any]],
    workers: int = DEFAULT_WORKERS,
    dry_run: bool = False,
    logger: Optional[logging.Logger] = None
) -> Dict[str, Any]:
    """
    Update multiple targets in parallel using ThreadPoolExecutor.

    Args:
        updates: List of dicts with 'domain' and update fields
        workers: Number of concurrent workers
        dry_run: If True, don't actually update
        logger: Logger instance

    Returns:
        Dict with results summary
    """
    results = {
        "total": len(updates),
        "success": [],
        "failed": [],
        "start_time": datetime.now().isoformat(),
    }

    if not updates:
        if logger:
            logger.warning("No updates to process")
        return results

    if logger:
        logger.info(f"Processing {len(updates)} records with {workers} workers")
        if dry_run:
            logger.info("DRY RUN MODE - no actual updates will be made")

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        # Submit all tasks
        future_to_domain = {}

        for update in updates:
            # Extract domain and create update payload
            domain = update.pop("domain")
            future = executor.submit(
                update_single_target,
                domain,
                update,
                dry_run,
                logger
            )
            future_to_domain[future] = domain

        # Process results as they complete
        for i, future in enumerate(as_completed(future_to_domain), 1):
            domain, success, message = future.result()

            if success:
                results["success"].append({"domain": domain, "message": message})
                status_icon = "[OK]" if not dry_run else "[DRY]"
            else:
                results["failed"].append({"domain": domain, "error": message})
                status_icon = "[FAIL]"

            # Progress output
            if logger:
                logger.info(f"{status_icon} [{i}/{len(updates)}] {domain}: {message[:60]}")

    # Calculate elapsed time
    elapsed = time.time() - start_time
    results["elapsed_seconds"] = round(elapsed, 2)
    results["end_time"] = datetime.now().isoformat()
    results["success_count"] = len(results["success"])
    results["failed_count"] = len(results["failed"])

    return results


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Update Supabase displacement_targets with executive intelligence",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python update_exec_quotes.py data/exec_quotes.json
    python update_exec_quotes.py data/exec_quotes.json --dry-run
    python update_exec_quotes.py data/exec_quotes.json --workers 5 --verbose
        """
    )

    parser.add_argument(
        "json_file",
        help="Path to JSON file with executive data"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview updates without making changes"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        help=f"Number of concurrent workers (default: {DEFAULT_WORKERS})"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(args.verbose)

    # Banner
    print("=" * 60)
    print("Arian: Update Executive Quotes")
    print("=" * 60)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Input file:   {args.json_file}")
    print(f"Workers:      {args.workers}")
    print(f"Dry run:      {args.dry_run}")
    print("=" * 60)
    print(flush=True)

    # Load and validate JSON
    try:
        logger.info(f"Loading JSON file: {args.json_file}")
        data = load_json_file(args.json_file)
        logger.info(f"Loaded {len(data)} domain entries")
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON: {e}")
        sys.exit(1)
    except ValueError as e:
        logger.error(str(e))
        sys.exit(1)

    # Validate and filter data
    logger.info("Validating input data...")
    updates = validate_and_filter_data(data, logger)

    if not updates:
        logger.error("No valid updates found in input file")
        sys.exit(1)

    logger.info(f"Prepared {len(updates)} valid updates")
    print(flush=True)

    # Run batch update
    results = batch_update_targets(
        updates=updates,
        workers=args.workers,
        dry_run=args.dry_run,
        logger=logger
    )

    # Summary
    print(flush=True)
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60, flush=True)
    print(f"Total processed:  {results['total']}")
    print(f"Successful:       {results['success_count']}")
    print(f"Failed:           {results['failed_count']}")
    print(f"Elapsed time:     {results.get('elapsed_seconds', 'N/A')} seconds")

    if results["failed"]:
        print()
        print("FAILED UPDATES:")
        for fail in results["failed"][:10]:
            print(f"  - {fail['domain']}: {fail['error']}")
        if len(results["failed"]) > 10:
            print(f"  ... and {len(results['failed']) - 10} more")

    print()
    if args.dry_run:
        print("DRY RUN COMPLETE - no changes were made")
    else:
        print("UPDATE COMPLETE")

    # Exit with error code if any failures
    sys.exit(0 if results["failed_count"] == 0 else 1)


if __name__ == "__main__":
    main()
