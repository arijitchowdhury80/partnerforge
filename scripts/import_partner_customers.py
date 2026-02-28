#!/usr/bin/env python3
"""
Arian: Import Known Partner Customers

This script imports known customers of partner technologies (Amplience, Spryker, Adobe Commerce)
by verifying them with BuiltWith and adding them as displacement targets.

Usage:
    python import_partner_customers.py
"""

import sqlite3
import json
import subprocess
import os
import time

DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/Arian/data/arian.db"
BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY", "8fd992ef-88d0-4554-a20b-364e97b2d302")

# Known customers by partner technology (from public sources)
PARTNER_CUSTOMERS = {
    "Amplience": [
        # Source: https://amplience.com/our-customers/
        {"domain": "underarmour.com", "company_name": "Under Armour", "vertical": "Retail", "country": "US"},
        {"domain": "ulta.com", "company_name": "Ulta Beauty", "vertical": "Retail", "country": "US"},
        {"domain": "tapestry.com", "company_name": "Tapestry", "vertical": "Retail", "country": "US"},
        {"domain": "columbia.com", "company_name": "Columbia Sportswear", "vertical": "Retail", "country": "US"},
        {"domain": "converse.com", "company_name": "Converse", "vertical": "Retail", "country": "US"},
        {"domain": "johnlewis.com", "company_name": "John Lewis", "vertical": "Retail", "country": "UK"},
        {"domain": "boots.com", "company_name": "Boots", "vertical": "Retail", "country": "UK"},
        {"domain": "armani.com", "company_name": "Armani", "vertical": "Retail", "country": "IT"},
        {"domain": "asda.com", "company_name": "ASDA", "vertical": "Retail", "country": "UK"},
        {"domain": "primark.com", "company_name": "Primark", "vertical": "Retail", "country": "IE"},
        {"domain": "crateandbarrel.com", "company_name": "Crate & Barrel", "vertical": "Retail", "country": "US"},
        {"domain": "otto.de", "company_name": "OTTO Group", "vertical": "Retail", "country": "DE"},
        {"domain": "gap.com", "company_name": "GAP", "vertical": "Retail", "country": "US"},
        {"domain": "very.co.uk", "company_name": "The Very Group", "vertical": "Retail", "country": "UK"},
        {"domain": "southwest.com", "company_name": "Southwest Airlines", "vertical": "Travel", "country": "US"},
        {"domain": "xcelenergy.com", "company_name": "Xcel Energy", "vertical": "Utilities", "country": "US"},
        {"domain": "jdsports.com", "company_name": "JD Sports", "vertical": "Retail", "country": "UK"},
        {"domain": "canon-europe.com", "company_name": "Canon Europe", "vertical": "Manufacturing", "country": "UK"},
        {"domain": "coach.com", "company_name": "Coach", "vertical": "Retail", "country": "US"},
        {"domain": "katespade.com", "company_name": "Kate Spade", "vertical": "Retail", "country": "US"},
    ],
    "Spryker": [
        # Source: https://spryker.com/about-us/
        {"domain": "aldi.com", "company_name": "ALDI", "vertical": "Retail", "country": "DE"},
        {"domain": "siemens.com", "company_name": "Siemens", "vertical": "Manufacturing", "country": "DE"},
        {"domain": "hilti.com", "company_name": "Hilti", "vertical": "Manufacturing", "country": "LI"},
        {"domain": "ricoh.com", "company_name": "Ricoh", "vertical": "Manufacturing", "country": "JP"},
        {"domain": "daimler-truck.com", "company_name": "Daimler Truck", "vertical": "Manufacturing", "country": "DE"},
        {"domain": "bosch.com", "company_name": "BOSCH", "vertical": "Manufacturing", "country": "DE"},
        {"domain": "zf.com", "company_name": "ZF Group", "vertical": "Manufacturing", "country": "DE"},
        {"domain": "jungheinrich.com", "company_name": "Jungheinrich", "vertical": "Manufacturing", "country": "DE"},
        {"domain": "lekkerland.com", "company_name": "Lekkerland", "vertical": "Wholesale", "country": "DE"},
        {"domain": "pferd.com", "company_name": "PFERD", "vertical": "Manufacturing", "country": "DE"},
        {"domain": "optibelt.com", "company_name": "Optibelt", "vertical": "Manufacturing", "country": "DE"},
        {"domain": "hardeck.de", "company_name": "HARDECK", "vertical": "Retail", "country": "DE"},
    ],
    "Adobe Commerce": [
        # Known large Magento/Adobe Commerce users
        {"domain": "hp.com", "company_name": "HP", "vertical": "Technology", "country": "US"},
        {"domain": "coca-cola.com", "company_name": "Coca-Cola", "vertical": "Beverages", "country": "US"},
        {"domain": "ford.com", "company_name": "Ford", "vertical": "Automotive", "country": "US"},
        {"domain": "nestle.com", "company_name": "Nestle", "vertical": "Food & Beverage", "country": "CH"},
        {"domain": "lenovo.com", "company_name": "Lenovo", "vertical": "Technology", "country": "CN"},
        {"domain": "olympus.com", "company_name": "Olympus", "vertical": "Manufacturing", "country": "JP"},
        {"domain": "canon.com", "company_name": "Canon", "vertical": "Manufacturing", "country": "JP"},
        {"domain": "pepe-jeans.com", "company_name": "Pepe Jeans", "vertical": "Retail", "country": "ES"},
        {"domain": "land-rover.com", "company_name": "Land Rover", "vertical": "Automotive", "country": "UK"},
        {"domain": "jaguar.com", "company_name": "Jaguar", "vertical": "Automotive", "country": "UK"},
        {"domain": "bulgari.com", "company_name": "Bulgari", "vertical": "Luxury", "country": "IT"},
        {"domain": "omega.com", "company_name": "Omega Watches", "vertical": "Luxury", "country": "CH"},
        {"domain": "nikon.com", "company_name": "Nikon", "vertical": "Manufacturing", "country": "JP"},
        {"domain": "monin.com", "company_name": "Monin", "vertical": "Food & Beverage", "country": "FR"},
        {"domain": "paul-smith.com", "company_name": "Paul Smith", "vertical": "Retail", "country": "UK"},
        {"domain": "liverpool.com.mx", "company_name": "Liverpool Mexico", "vertical": "Retail", "country": "MX"},
        {"domain": "rural-king.com", "company_name": "Rural King", "vertical": "Retail", "country": "US"},
        {"domain": "shoebacca.com", "company_name": "SHOEBACCA", "vertical": "Retail", "country": "US"},
    ]
}


def verify_with_builtwith(domain: str, tech_name: str) -> dict:
    """Verify a domain uses the expected technology via BuiltWith API."""
    url = f"https://api.builtwith.com/v21/api.json?KEY={BUILTWITH_API_KEY}&LOOKUP={domain}"

    try:
        result = subprocess.run(
            ['curl', '-s', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        data = json.loads(result.stdout)

        # Check if API returned results
        results = data.get("Results", [])
        if not results:
            return {"verified": False, "tech_detected": [], "search_provider": None, "tech_spend": 0}

        # Extract technology info
        tech_detected = []
        search_provider = None
        tech_spend = 0

        result_data = results[0].get("Result", {})
        tech_spend = result_data.get("Spend", 0)

        paths = result_data.get("Paths", [])
        for path in paths:
            tech_list = path.get("Technologies", [])
            for tech in tech_list:
                tech_name_found = tech.get("Name", "")
                tech_detected.append(tech_name_found)

                # Check for search providers
                categories = tech.get("Categories", [])
                if any("search" in cat.lower() for cat in categories):
                    search_provider = tech_name_found

        # Check if expected tech is present
        tech_keywords = {
            "Amplience": ["amplience"],
            "Spryker": ["spryker"],
            "Adobe Commerce": ["magento", "adobe commerce"]
        }

        keywords = tech_keywords.get(tech_name, [tech_name.lower()])
        verified = any(
            any(kw in t.lower() for kw in keywords)
            for t in tech_detected
        )

        return {
            "verified": verified,
            "tech_detected": tech_detected[:20],  # Limit to 20
            "search_provider": search_provider,
            "tech_spend": tech_spend
        }

    except Exception as e:
        print(f"      ❌ Error verifying {domain}: {e}")
        return {"verified": False, "tech_detected": [], "search_provider": None, "tech_spend": 0}


def get_algolia_customers(conn: sqlite3.Connection) -> set:
    """Get set of domains that are existing Algolia customers."""
    cursor = conn.cursor()
    cursor.execute("SELECT domain FROM companies WHERE is_algolia_customer = 1")
    return {row[0].lower() for row in cursor.fetchall() if row[0]}


def get_existing_targets(conn: sqlite3.Connection) -> set:
    """Get set of all domains already in displacement_targets."""
    cursor = conn.cursor()
    cursor.execute("SELECT domain FROM displacement_targets")
    return {row[0].lower() for row in cursor.fetchall() if row[0]}


def insert_displacement_target(conn: sqlite3.Connection, target: dict, partner_tech: str,
                                search_provider: str = None, tech_spend: int = 0):
    """Insert a new displacement target."""
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO displacement_targets (
                domain, company_name, partner_tech, vertical, country,
                current_search, tech_spend
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            target["domain"].lower(),
            target["company_name"],
            partner_tech,
            target.get("vertical"),
            target.get("country"),
            search_provider,
            tech_spend
        ))
        return True
    except sqlite3.IntegrityError:
        return False  # Already exists
    except Exception as e:
        print(f"      DB Error: {e}")
        return False


def main():
    print("🚀 Arian: Import Known Partner Customers")
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)

    # Get existing data
    algolia_customers = get_algolia_customers(conn)
    existing_targets = get_existing_targets(conn)

    print(f"📊 Existing Algolia customers: {len(algolia_customers)}")
    print(f"📊 Existing displacement targets: {len(existing_targets)}")

    total_imported = 0
    total_skipped_algolia = 0
    total_skipped_exists = 0
    total_verified = 0

    for partner_tech, customers in PARTNER_CUSTOMERS.items():
        print(f"\n{'='*60}")
        print(f"🔍 Processing {partner_tech} ({len(customers)} known customers)")
        print(f"{'='*60}")

        partner_imported = 0

        for i, customer in enumerate(customers, 1):
            domain = customer["domain"].lower()
            print(f"\n   [{i}/{len(customers)}] {customer['company_name']} ({domain})")

            # Skip if Algolia customer
            if domain in algolia_customers:
                print(f"      ⏭️ Skip: Existing Algolia customer")
                total_skipped_algolia += 1
                continue

            # Skip if already exists
            if domain in existing_targets:
                print(f"      ⏭️ Skip: Already in targets")
                total_skipped_exists += 1
                continue

            # Verify with BuiltWith (rate limited - 1 req/sec)
            print(f"      🔎 Verifying with BuiltWith...")
            time.sleep(1)  # Rate limiting

            verification = verify_with_builtwith(domain, partner_tech)

            if verification["verified"]:
                total_verified += 1
                print(f"      ✅ Verified! Tech spend: ${verification['tech_spend']:,}")
                if verification["search_provider"]:
                    print(f"      🔍 Search provider: {verification['search_provider']}")
            else:
                # Still import - web research says they're customers
                print(f"      ⚠️ Tech not detected by BuiltWith (may be headless/SSR)")

            # Import the target
            if insert_displacement_target(
                conn, customer, partner_tech,
                verification["search_provider"],
                verification["tech_spend"]
            ):
                print(f"      ✅ Imported as displacement target")
                partner_imported += 1
                total_imported += 1
                existing_targets.add(domain)
            else:
                print(f"      ❌ Failed to import")

            conn.commit()

        print(f"\n   📊 {partner_tech}: {partner_imported} new targets imported")

    # Final summary
    print(f"\n{'='*60}")
    print("📊 FINAL IMPORT SUMMARY")
    print(f"{'='*60}")
    print(f"   Total imported:          {total_imported}")
    print(f"   Verified by BuiltWith:   {total_verified}")
    print(f"   Skipped (Algolia):       {total_skipped_algolia}")
    print(f"   Skipped (exists):        {total_skipped_exists}")

    # Count by partner
    cursor = conn.cursor()
    for partner in ["Amplience", "Spryker", "Adobe Commerce"]:
        cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE partner_tech = ?", (partner,))
        count = cursor.fetchone()[0]
        print(f"   {partner} targets:        {count}")

    conn.close()
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
