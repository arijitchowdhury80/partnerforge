#!/usr/bin/env python3
"""
PartnerForge: Seed Verified Algolia Case Studies

Fetches and verifies Algolia customer case study URLs.
Only stores URLs that return HTTP 200.
"""

import sqlite3
import subprocess
import json
from datetime import datetime

DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/data/partnerforge.db"

# Known Algolia case studies with verified URLs (as of Feb 2026)
# Updated with real working URLs from algolia.com
CASE_STUDIES = [
    # Retail / E-commerce - VERIFIED
    {"company": "Harry Rosen", "vertical": "Fashion Retail", "url": "https://www.algolia.com/customers/harry-rosen/", "headline": "+360% conversion rate", "result_metric": "360% conversion increase, 68% more transactions"},
    {"company": "Lacoste", "vertical": "Fashion Retail", "url": "https://www.algolia.com/customers/lacoste/", "headline": "+37% conversion rate", "result_metric": "37% conversion increase"},
    {"company": "Under Armour", "vertical": "Sports Apparel", "url": "https://www.algolia.com/customers/under-armour/", "headline": "Instant search experience", "result_metric": "Sub-second search"},
    {"company": "Staples", "vertical": "Office Retail", "url": "https://www.algolia.com/customers/staples/", "headline": "-40% zero-result searches", "result_metric": "40% fewer zero results"},
    {"company": "Swedol", "vertical": "B2B Retail", "url": "https://resources.algolia.com/customer-stories/casestudy-swedol", "headline": "+22% conversion rate", "result_metric": "22% conversion, 26% more time on site"},
    {"company": "Everlane", "vertical": "Fashion DTC", "url": "https://www.algolia.com/blog/ecommerce/how-3-retailers-are-using-ai-powered-search-and-discovery-to-crush-their-numbers", "headline": "+7.1% revenue increase", "result_metric": "7.1% revenue, 5% click-through"},

    # Documentation / Search best practices
    {"company": "Online Clothing Case Study", "vertical": "Fashion E-commerce", "url": "https://www.algolia.com/doc/guides/going-to-production/case-study", "headline": "Best practices guide", "result_metric": "Implementation guide"},

    # Industry benchmarks (for reference)
    {"company": "E-commerce Stats", "vertical": "Industry Benchmark", "url": "https://www.algolia.com/blog/ecommerce/e-commerce-search-and-kpis-statistics", "headline": "40+ search stats", "result_metric": "1.8x conversion for search users"},
]


def verify_url(url: str) -> bool:
    """Check if URL returns HTTP 200."""
    try:
        result = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-L', url],
            capture_output=True,
            text=True,
            timeout=10
        )
        status = result.stdout.strip()
        return status == '200'
    except Exception as e:
        print(f"   ⚠️ Error checking {url}: {e}")
        return False


def seed_case_studies():
    """Verify and seed case studies into database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create verified_case_studies table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verified_case_studies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT NOT NULL UNIQUE,
            vertical TEXT,
            url TEXT NOT NULL,
            headline TEXT,
            result_metric TEXT,
            is_verified INTEGER DEFAULT 0,
            last_verified TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    print("🔍 Verifying Algolia case study URLs...")
    print("-" * 60)

    verified_count = 0
    failed_count = 0

    for cs in CASE_STUDIES:
        print(f"   Checking {cs['company']}...", end=" ")

        is_valid = verify_url(cs['url'])

        if is_valid:
            print("✅")
            verified_count += 1

            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO verified_case_studies
                    (company_name, vertical, url, headline, result_metric, is_verified, last_verified)
                    VALUES (?, ?, ?, ?, ?, 1, ?)
                """, (
                    cs['company'],
                    cs['vertical'],
                    cs['url'],
                    cs['headline'],
                    cs['result_metric'],
                    datetime.now().isoformat()
                ))
            except Exception as e:
                print(f"      DB error: {e}")
        else:
            print("❌ (404 or error)")
            failed_count += 1

    conn.commit()

    # Show summary
    cursor.execute("SELECT COUNT(*) FROM verified_case_studies WHERE is_verified = 1")
    total_verified = cursor.fetchone()[0]

    print("-" * 60)
    print(f"\n✅ Verified: {verified_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"📊 Total in database: {total_verified}")

    # Show by vertical
    print("\n📁 By Vertical:")
    cursor.execute("""
        SELECT vertical, COUNT(*) as cnt
        FROM verified_case_studies
        WHERE is_verified = 1
        GROUP BY vertical
        ORDER BY cnt DESC
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]}: {row[1]}")

    conn.close()


if __name__ == "__main__":
    seed_case_studies()
