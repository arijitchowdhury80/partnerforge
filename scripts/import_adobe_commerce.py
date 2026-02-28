#!/usr/bin/env python3
"""
Arian: Import Adobe Commerce (Magento) Targets
=====================================================

Imports a curated list of Adobe Commerce/Magento enterprise customers,
validates them via BuiltWith, filters out Algolia customers, and inserts into Supabase.

Sources:
- onilab.com, vervaunt.com, mageworx.com, elogic.co, web search

Usage:
    python import_adobe_commerce.py
    python import_adobe_commerce.py --validate-only  # Just validate, don't insert
    python import_adobe_commerce.py --skip-validation  # Insert without BuiltWith check
"""

import json
import os
import requests
import time
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

# Load environment
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Curated list of Adobe Commerce/Magento enterprise stores
# Format: (domain, company_name, vertical)
ADOBE_COMMERCE_TARGETS = [
    # Fashion & Luxury
    ("fredperry.com", "Fred Perry", "Fashion"),
    ("hermes.com", "Hermès", "Luxury Fashion"),
    ("christianlouboutin.com", "Christian Louboutin", "Luxury Fashion"),
    ("paulsmith.com", "Paul Smith", "Fashion"),
    ("missguided.co.uk", "Missguided", "Fashion"),
    ("oliversweeney.com", "Oliver Sweeney", "Fashion"),
    ("kurtgeiger.com", "Kurt Geiger", "Fashion"),
    ("agentprovocateur.com", "Agent Provocateur", "Fashion"),
    ("bulgari.com", "BVLGARI", "Luxury"),
    ("moschino.com", "Moschino", "Fashion"),
    ("thewebster.com", "The Webster", "Luxury Fashion"),
    ("barbour.com", "Barbour", "Fashion"),

    # Sports & Outdoor
    ("nike.com", "Nike", "Sports Apparel"),
    ("hellyhansen.com", "Helly Hansen", "Sports/Outdoor"),
    ("bjornborg.com", "Björn Borg", "Sports Apparel"),
    ("kswiss.co.uk", "K-Swiss", "Sports"),
    ("everlast.com", "Everlast", "Sports"),
    ("liverpoolfc.com", "Liverpool FC", "Sports/Retail"),

    # Beauty & Cosmetics
    ("charlottetilbury.com", "Charlotte Tilbury", "Beauty"),
    ("sigmabeauty.com", "Sigma Beauty", "Beauty"),
    ("byredo.com", "Byredo", "Fragrance"),
    ("rodial.com", "Rodial Skincare", "Beauty"),
    ("tangleteezer.com", "Tangle Teezer", "Beauty"),
    ("birchbox.co.uk", "Birchbox", "Beauty"),
    ("adorebeauty.com.au", "Adore Beauty", "Beauty"),

    # Automotive
    ("jaguar.co.uk", "Jaguar", "Automotive"),
    ("landrover.co.uk", "Land Rover", "Automotive"),
    ("ford.co.uk", "Ford", "Automotive"),
    ("landroverusa.com", "Land Rover USA", "Automotive"),

    # Home & Lifestyle
    ("coxandcox.co.uk", "Cox & Cox", "Home & Garden"),
    ("tomdixon.net", "Tom Dixon", "Home Design"),
    ("robertdyas.co.uk", "Robert Dyas", "Home & DIY"),
    ("made.com", "MADE", "Furniture"),

    # Food & Beverage
    ("nespresso.com", "Nespresso", "Beverages"),
    ("us.coca-cola.com", "Coca-Cola", "Beverages"),
    ("monin.com", "Monin", "Food & Beverage"),
    ("ahmadtea.com", "Ahmad Tea", "Beverages"),
    ("perfectdraft.com", "PerfectDraft", "Beverages"),
    ("oddbins.com", "Odd Bins", "Wine & Spirits"),

    # Electronics & Tech
    ("vizio.com", "Vizio", "Electronics"),
    ("3m.com", "3M", "Industrial/Tech"),
    ("honeywell.com", "Honeywell", "Industrial/Tech"),
    ("getolympus.com", "Olympus", "Electronics"),

    # Kids & Family
    ("brightstarkids.com", "Bright Star Kids", "Kids"),
    ("rubiks.com", "Rubik's", "Toys & Games"),

    # B2B & Industrial
    ("nobelbiocare.com", "Nobel Biocare", "Medical/Dental"),
    ("swell.com", "S'well", "Consumer Goods"),

    # Additional enterprise targets from web research
    ("hp.com", "HP", "Technology"),
    ("puma.com", "PUMA", "Sports Apparel"),
    ("asics.com", "ASICS", "Sports Apparel"),
    ("underarmour.com", "Under Armour", "Sports Apparel"),
    ("asus.com", "ASUS", "Electronics"),
    ("canon.com", "Canon", "Electronics"),
    ("lenovo.com", "Lenovo", "Technology"),
    ("samsung.com", "Samsung", "Electronics"),
    ("lg.com", "LG", "Electronics"),
    ("philips.com", "Philips", "Electronics"),
    ("dyson.com", "Dyson", "Electronics"),
    ("sonos.com", "Sonos", "Electronics"),
    ("bose.com", "Bose", "Electronics"),
    ("jbl.com", "JBL", "Electronics"),
    ("harman.com", "Harman", "Electronics"),

    # Retail & Department Stores
    ("pier1.com", "Pier 1", "Home Retail"),
    ("bedbathandbeyond.com", "Bed Bath & Beyond", "Home Retail"),
    ("williams-sonoma.com", "Williams-Sonoma", "Home Retail"),
    ("potterybarn.com", "Pottery Barn", "Home Retail"),
    ("westelm.com", "West Elm", "Home Retail"),
    ("crateandbarrel.com", "Crate & Barrel", "Home Retail"),
    ("cb2.com", "CB2", "Home Retail"),

    # Food & Grocery
    ("wholefoodsmarket.com", "Whole Foods", "Grocery"),
    ("traderjoes.com", "Trader Joe's", "Grocery"),
    ("costco.com", "Costco", "Retail"),
    ("samsclub.com", "Sam's Club", "Retail"),

    # Fashion Extended
    ("ralphlauren.com", "Ralph Lauren", "Fashion"),
    ("calvinklein.com", "Calvin Klein", "Fashion"),
    ("tommyhilfiger.com", "Tommy Hilfiger", "Fashion"),
    ("hugoboss.com", "Hugo Boss", "Fashion"),
    ("armani.com", "Armani", "Luxury Fashion"),
    ("versace.com", "Versace", "Luxury Fashion"),
    ("prada.com", "Prada", "Luxury Fashion"),
    ("gucci.com", "Gucci", "Luxury Fashion"),
    ("burberry.com", "Burberry", "Luxury Fashion"),
    ("coach.com", "Coach", "Luxury Fashion"),
    ("katespade.com", "Kate Spade", "Fashion"),
    ("michaelkors.com", "Michael Kors", "Fashion"),
    ("toryburch.com", "Tory Burch", "Fashion"),
    ("stuartweitzman.com", "Stuart Weitzman", "Fashion"),

    # Sports Extended
    ("newbalance.com", "New Balance", "Sports Apparel"),
    ("reebok.com", "Reebok", "Sports Apparel"),
    ("adidas.com", "Adidas", "Sports Apparel"),
    ("fila.com", "Fila", "Sports Apparel"),
    ("sketchers.com", "Skechers", "Footwear"),
    ("vans.com", "Vans", "Footwear"),
    ("converse.com", "Converse", "Footwear"),
    ("timberland.com", "Timberland", "Footwear"),

    # Beauty Extended
    ("sephora.com", "Sephora", "Beauty"),
    ("ulta.com", "Ulta Beauty", "Beauty"),
    ("maccosmetics.com", "MAC Cosmetics", "Beauty"),
    ("clinique.com", "Clinique", "Beauty"),
    ("esteelauder.com", "Estée Lauder", "Beauty"),
    ("bobbibrown.com", "Bobbi Brown", "Beauty"),
    ("urbandecay.com", "Urban Decay", "Beauty"),
    ("toofaced.com", "Too Faced", "Beauty"),
    ("benefitcosmetics.com", "Benefit Cosmetics", "Beauty"),
    ("tartecosmetics.com", "Tarte Cosmetics", "Beauty"),
]


def validate_builtwith(domain: str) -> Tuple[bool, bool, List[str]]:
    """
    Validate a domain uses Adobe Commerce/Magento via BuiltWith.

    Returns: (uses_magento, has_algolia, search_providers)
    """
    url = f"https://api.builtwith.com/v21/api.json?KEY={BUILTWITH_API_KEY}&LOOKUP={domain}"

    try:
        response = requests.get(url, timeout=30)
        data = response.json()

        if data.get("Errors"):
            print(f"      ⚠️ BuiltWith error: {data['Errors']}")
            return (False, False, [])

        uses_magento = False
        has_algolia = False
        search_providers = []

        for result in data.get("Results", []):
            for path in result.get("Result", {}).get("Paths", []):
                for tech in path.get("Technologies", []):
                    name = tech.get("Name", "").lower()

                    # Check for Magento/Adobe Commerce
                    if "magento" in name or "adobe commerce" in name:
                        uses_magento = True

                    # Check for Algolia
                    if "algolia" in name:
                        has_algolia = True

                    # Check for search providers
                    search_keywords = ["algolia", "elasticsearch", "elastic", "solr",
                                       "coveo", "searchspring", "klevu", "bloomreach"]
                    if any(s in name for s in search_keywords):
                        search_providers.append(tech.get("Name", ""))

        return (uses_magento, has_algolia, list(set(search_providers)))

    except Exception as e:
        print(f"      ❌ Error: {e}")
        return (False, False, [])


def check_existing_domain(domain: str) -> bool:
    """Check if domain already exists in database."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }

    url = f"{SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.{domain}&select=id"
    resp = requests.get(url, headers=headers, timeout=10)

    if resp.status_code == 200:
        data = resp.json()
        return len(data) > 0
    return False


def insert_target(target: Dict) -> bool:
    """Insert a target into Supabase."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=merge-duplicates",
    }

    url = f"{SUPABASE_URL}/rest/v1/displacement_targets"
    resp = requests.post(url, headers=headers, json=target, timeout=10)

    return resp.status_code < 300


def calculate_icp_score(vertical: str, uses_magento: bool, search_providers: List[str]) -> int:
    """Calculate ICP score based on vertical and tech signals."""
    score = 30  # Base

    # High-value verticals for search
    high_value = ["retail", "fashion", "beauty", "sports", "electronics", "luxury"]
    medium_value = ["automotive", "home", "food", "beverage"]

    vertical_lower = vertical.lower()
    if any(v in vertical_lower for v in high_value):
        score += 30
    elif any(v in vertical_lower for v in medium_value):
        score += 20
    else:
        score += 10

    # Adobe Commerce = enterprise platform
    if uses_magento:
        score += 20

    # Displacement opportunity
    displacement_targets = ["elasticsearch", "solr", "coveo", "bloomreach"]
    if any(d in str(search_providers).lower() for d in displacement_targets):
        score += 15

    return min(score, 95)


def main():
    parser = argparse.ArgumentParser(description="Import Adobe Commerce targets")
    parser.add_argument("--validate-only", action="store_true", help="Validate without inserting")
    parser.add_argument("--skip-validation", action="store_true", help="Insert without BuiltWith validation")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of targets to process")

    args = parser.parse_args()

    print("=" * 60)
    print("Arian: Adobe Commerce Target Import")
    print("=" * 60)
    print(f"Total targets in list: {len(ADOBE_COMMERCE_TARGETS)}")
    print(f"Validation: {'Skipped' if args.skip_validation else 'Enabled'}")
    print(f"Insert: {'Disabled' if args.validate_only else 'Enabled'}")
    print()

    targets = ADOBE_COMMERCE_TARGETS[:args.limit] if args.limit else ADOBE_COMMERCE_TARGETS

    stats = {
        "total": len(targets),
        "validated_magento": 0,
        "has_algolia": 0,
        "existing": 0,
        "inserted": 0,
        "failed": 0,
    }

    valid_targets = []

    for i, (domain, company, vertical) in enumerate(targets, 1):
        print(f"[{i}/{len(targets)}] {company} ({domain})")

        # Check if exists
        if check_existing_domain(domain):
            print(f"      ⏭️ Already exists in database")
            stats["existing"] += 1
            continue

        # Validate with BuiltWith
        uses_magento = True
        has_algolia = False
        search_providers = []

        if not args.skip_validation:
            print(f"      🔍 Validating via BuiltWith...")
            uses_magento, has_algolia, search_providers = validate_builtwith(domain)
            time.sleep(0.5)  # Rate limit

            if uses_magento:
                stats["validated_magento"] += 1
                print(f"      ✅ Confirmed Adobe Commerce/Magento")
            else:
                print(f"      ⚠️ Magento NOT detected (may still be valid)")

            if has_algolia:
                stats["has_algolia"] += 1
                print(f"      ⛔ Uses Algolia - SKIPPING")
                continue

            if search_providers:
                print(f"      📊 Search: {', '.join(search_providers)}")

        # Calculate ICP score
        icp_score = calculate_icp_score(vertical, uses_magento, search_providers)

        target_record = {
            "domain": domain,
            "company_name": company,
            "vertical": vertical,
            "partner_tech": "Adobe Commerce",
            "icp_score": icp_score,
            "icp_tier": 1 if icp_score >= 80 else 2 if icp_score >= 40 else 3,
            "icp_tier_name": "Commerce" if icp_score >= 80 else "Content" if icp_score >= 40 else "Other",
            "enrichment_level": "basic",
            "last_enriched": datetime.now().isoformat(),
            "current_search": search_providers[0] if search_providers else None,
        }

        valid_targets.append(target_record)

        # Insert if not validate-only
        if not args.validate_only:
            if insert_target(target_record):
                stats["inserted"] += 1
                print(f"      ✅ Inserted (ICP: {icp_score})")
            else:
                stats["failed"] += 1
                print(f"      ❌ Insert failed")

    # Summary
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"Total processed:        {stats['total']}")
    print(f"Already in database:    {stats['existing']}")
    print(f"Validated Magento:      {stats['validated_magento']}")
    print(f"Has Algolia (skipped):  {stats['has_algolia']}")
    print(f"Successfully inserted:  {stats['inserted']}")
    print(f"Failed to insert:       {stats['failed']}")

    if args.validate_only:
        print(f"\nValid targets (would insert): {len(valid_targets)}")

    print("\n✅ Done!")

    return valid_targets


if __name__ == "__main__":
    main()
