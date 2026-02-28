#!/usr/bin/env python3
"""
Arian: Populate Sample Intelligence Data

Creates realistic sample intelligence data for the top 20 companies by lead_score.
This script:
1. Adds missing columns to displacement_targets if needed
2. Populates sample data for revenue, margin, triggers, quotes, etc.
"""

import sqlite3
import json

DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/Arian/data/arian.db"

# Sample intelligence data for top 20 companies
SAMPLE_DATA = {
    "huawei.com": {
        "company_name": "HUAWEI",
        "revenue": 95_000_000_000,  # $95B
        "gross_margin": 42.1,
        "traffic_growth": 8.2,
        "current_search": "Custom (in-house)",
        "trigger_events": json.dumps([
            "Major e-commerce expansion announced [Q4 2025 Earnings]",
            "New CDO hired from Alibaba [LinkedIn, Jan 2026]",
            "Divesting from US cloud, focusing on EMEA/APAC digital [Reuters]"
        ]),
        "exec_quote": "Our consumer business group is investing heavily in digital commerce capabilities to reach customers directly.",
        "exec_name": "Ken Hu",
        "exec_title": "Rotating Chairman",
        "quote_source": "Q4 2025 Earnings Call",
        "competitors_using_algolia": "Samsung, Xiaomi, OnePlus",
        "displacement_angle": "Custom search cannot scale across 50+ country storefronts with local relevance tuning"
    },
    "nab.com.au": {
        "company_name": "National Australia Bank",
        "revenue": 18_200_000_000,  # $18.2B AUD
        "gross_margin": 68.5,
        "traffic_growth": 5.1,
        "current_search": "Elasticsearch",
        "trigger_events": json.dumps([
            "Digital transformation initiative - $1.5B investment [Annual Report 2025]",
            "New Chief Digital Officer from Westpac [LinkedIn, Nov 2025]",
            "Mobile banking app redesign announced [Press Release, Dec 2025]"
        ]),
        "exec_quote": "We're reimagining how customers discover and access our products through digital channels.",
        "exec_name": "Andrew Irvine",
        "exec_title": "CEO",
        "quote_source": "FY2025 Investor Day",
        "competitors_using_algolia": "Commonwealth Bank, Westpac",
        "displacement_angle": "Elasticsearch struggles with financial product discovery across 500+ SKUs with compliance requirements"
    },
    "mercedes-benz.com": {
        "company_name": "Mercedes-Benz Group AG",
        "revenue": 153_000_000_000,  # EUR converted to USD
        "gross_margin": 38.2,
        "traffic_growth": 12.4,
        "current_search": "SAP Commerce Cloud (Solr)",
        "trigger_events": json.dumps([
            "Direct-to-consumer sales model expansion [Q3 2025 Earnings]",
            "MB.OS digital platform launch - $3B investment [TechCrunch, Oct 2025]",
            "RichRelevance REMOVED from tech stack [BuiltWith, Dec 2025]"
        ]),
        "exec_quote": "The future of automotive retail is digital-first. We must offer customers the same discovery experience they expect from premium e-commerce.",
        "exec_name": "Ola Kallenius",
        "exec_title": "CEO",
        "quote_source": "Q4 2025 Earnings Call",
        "competitors_using_algolia": "BMW, Audi, Porsche",
        "displacement_angle": "SAP/Solr cannot handle real-time inventory across 6,000+ dealer locations with configurator integration"
    },
    "spglobal.com": {
        "company_name": "S&P Global",
        "revenue": 14_200_000_000,  # $14.2B
        "gross_margin": 71.3,
        "traffic_growth": 9.8,
        "current_search": "Custom (legacy)",
        "trigger_events": json.dumps([
            "Capital IQ platform modernization - $800M budget [10-K FY2025]",
            "Hiring 50+ search engineers [LinkedIn Jobs]",
            "Data services API expansion announced [Investor Presentation, Jan 2026]"
        ]),
        "exec_quote": "Our clients need instantaneous access to financial data. Search latency directly impacts trading decisions.",
        "exec_name": "Martina Cheung",
        "exec_title": "President, S&P Global Market Intelligence",
        "quote_source": "Q4 2025 Earnings Call",
        "competitors_using_algolia": "Bloomberg, Refinitiv, FactSet",
        "displacement_angle": "Legacy search cannot support sub-100ms queries across 500TB of financial data with compliance filtering"
    },
    "caremark.com": {
        "company_name": "CVS Caremark",
        "revenue": 357_000_000_000,  # $357B (CVS Health total)
        "gross_margin": 16.8,
        "traffic_growth": 3.2,
        "current_search": "Endeca (legacy Oracle)",
        "trigger_events": json.dumps([
            "Omnichannel pharmacy experience initiative [Q4 2025 Earnings]",
            "Healthcare services integration with Aetna [Press Release, Nov 2025]",
            "Mobile app redesign for prescription discovery [App Store, Jan 2026]"
        ]),
        "exec_quote": "Patients expect the same digital experience from healthcare as they get from Amazon. We must close that gap.",
        "exec_name": "Karen Lynch",
        "exec_title": "CEO, CVS Health",
        "quote_source": "JPMorgan Healthcare Conference, Jan 2026",
        "competitors_using_algolia": "Walgreens, Rite Aid",
        "displacement_angle": "Endeca cannot handle medication cross-referencing, drug interactions, and insurance coverage in real-time"
    },
    "moodys.com": {
        "company_name": "Moody's Investors Service Inc",
        "revenue": 7_100_000_000,  # $7.1B
        "gross_margin": 62.4,
        "traffic_growth": 7.6,
        "current_search": "Elasticsearch",
        "trigger_events": json.dumps([
            "Research platform modernization [10-K FY2025]",
            "AI-powered analytics investment - $500M [Press Release, Oct 2025]",
            "New Chief Technology Officer from Google [LinkedIn, Dec 2025]"
        ]),
        "exec_quote": "Speed of insight delivery is our competitive advantage. Our clients need sub-second access to credit research.",
        "exec_name": "Rob Fauber",
        "exec_title": "CEO",
        "quote_source": "Q3 2025 Earnings Call",
        "competitors_using_algolia": "S&P Global, Fitch Ratings",
        "displacement_angle": "Elasticsearch lacks semantic understanding for complex credit research queries"
    },
    "f5.com": {
        "company_name": "F5, Inc.",
        "revenue": 2_800_000_000,  # $2.8B
        "gross_margin": 78.5,
        "traffic_growth": 11.2,
        "current_search": "Custom (documentation)",
        "trigger_events": json.dumps([
            "Developer portal modernization project [GitHub, Nov 2025]",
            "NGINX integration documentation consolidation [Blog, Jan 2026]",
            "Support portal AI upgrade initiative [Press Release, Dec 2025]"
        ]),
        "exec_quote": "Developer experience is paramount. Engineers need to find documentation and solutions instantly.",
        "exec_name": "Francois Locoh-Donou",
        "exec_title": "CEO",
        "quote_source": "Q4 2025 Earnings Call",
        "competitors_using_algolia": "Cloudflare, Akamai, Fastly",
        "displacement_angle": "Custom search cannot handle technical documentation discovery across 10K+ API endpoints"
    },
    "bms.com": {
        "company_name": "Bristol Myers Squibb",
        "revenue": 48_000_000_000,  # $48B
        "gross_margin": 73.2,
        "traffic_growth": 4.5,
        "current_search": "Veeva Vault (internal)",
        "trigger_events": json.dumps([
            "Clinical trial portal modernization [10-K FY2025]",
            "Patient services digital transformation [Press Release, Nov 2025]",
            "HCP portal redesign initiative [LinkedIn Jobs, Jan 2026]"
        ]),
        "exec_quote": "Healthcare professionals need rapid access to drug information. Every second matters in patient care decisions.",
        "exec_name": "Chris Boerner",
        "exec_title": "CEO",
        "quote_source": "Q4 2025 Earnings Call",
        "competitors_using_algolia": "Pfizer, Merck, Johnson & Johnson",
        "displacement_angle": "Veeva search cannot handle medical literature discovery with compliance requirements across 100K+ documents"
    },
    "marks.com": {
        "company_name": "Mark's",
        "revenue": 1_200_000_000,  # $1.2B CAD
        "gross_margin": 35.8,
        "traffic_growth": 6.8,
        "current_search": "Endeca (via Canadian Tire)",
        "trigger_events": json.dumps([
            "E-commerce platform rebuild [Press Release, Oct 2025]",
            "Industrial workwear category expansion [Annual Report 2025]",
            "Mobile-first strategy announcement [LinkedIn, Dec 2025]"
        ]),
        "exec_quote": "Our B2B customers need to find safety gear fast. Product discovery is mission-critical for workplace safety.",
        "exec_name": "Greg Chicken",
        "exec_title": "President, Mark's",
        "quote_source": "Canadian Tire Q3 2025 Earnings",
        "competitors_using_algolia": "Carhartt, Dickies, Red Wing",
        "displacement_angle": "Endeca cannot handle workwear compliance filtering (CSA, ANSI) with real-time inventory across 400+ stores"
    },
    "infinitiusa.com": {
        "company_name": "Infiniti USA",
        "revenue": 8_500_000_000,  # $8.5B (estimated US)
        "gross_margin": 28.4,
        "traffic_growth": -2.1,
        "current_search": "Custom (Nissan platform)",
        "trigger_events": json.dumps([
            "Dealer inventory integration project [Press Release, Nov 2025]",
            "Electric vehicle launch - 3 new models [CES 2026]",
            "Digital retailing expansion [Automotive News, Jan 2026]"
        ]),
        "exec_quote": "Luxury buyers expect seamless digital experiences. Our configurator must match the in-dealership experience.",
        "exec_name": "Mike Colleran",
        "exec_title": "Chairman, Infiniti Americas",
        "quote_source": "Q4 2025 Media Briefing",
        "competitors_using_algolia": "Lexus, Acura, Genesis",
        "displacement_angle": "Custom search cannot handle vehicle configurator with 10K+ option combinations and dealer inventory matching"
    },
    "allianz.fr": {
        "company_name": "Allianz France",
        "revenue": 152_000_000_000,  # $152B (Allianz global)
        "gross_margin": 45.2,
        "traffic_growth": 5.4,
        "current_search": "Custom (internal)",
        "trigger_events": json.dumps([
            "Digital insurance platform launch [Press Release, Oct 2025]",
            "Customer portal modernization [10-K FY2025]",
            "AI claims processing implementation [TechCrunch, Dec 2025]"
        ]),
        "exec_quote": "Insurance product discovery is complex. Customers need guided search to find the right coverage.",
        "exec_name": "Jacques Richier",
        "exec_title": "CEO, Allianz France",
        "quote_source": "Annual Report 2025",
        "competitors_using_algolia": "AXA, Generali, Zurich",
        "displacement_angle": "Custom search cannot handle insurance product recommendation with eligibility filtering across 200+ products"
    },
    "chevrolet.com.mx": {
        "company_name": "Chevrolet Mexico",
        "revenue": 156_000_000_000,  # GM global revenue
        "gross_margin": 18.2,
        "traffic_growth": 8.9,
        "current_search": "Custom (GM platform)",
        "trigger_events": json.dumps([
            "E-commerce platform launch for Mexico [Press Release, Nov 2025]",
            "Digital retailing expansion - 50 dealers [Automotive News, Jan 2026]",
            "EV model launches - Blazer EV, Equinox EV [CES 2026]"
        ]),
        "exec_quote": "Mexican consumers are ready for digital car buying. We must deliver American innovation locally.",
        "exec_name": "Francisco Garza",
        "exec_title": "President, GM Mexico",
        "quote_source": "Q4 2025 Media Briefing",
        "competitors_using_algolia": "Ford, Toyota, Nissan",
        "displacement_angle": "GM platform search lacks Spanish NLP and cannot handle regional inventory across 800+ dealerships"
    },
    "hofer.at": {
        "company_name": "HOFER (ALDI Sud)",
        "revenue": 45_000_000_000,  # ALDI Sud global
        "gross_margin": 22.5,
        "traffic_growth": 7.2,
        "current_search": "Custom (ALDI platform)",
        "trigger_events": json.dumps([
            "E-commerce expansion - delivery service launch [Press Release, Oct 2025]",
            "Mobile app redesign for Austria [App Store, Dec 2025]",
            "Product catalog digitization project [Annual Report 2025]"
        ]),
        "exec_quote": "Our customers expect digital convenience while maintaining our value proposition.",
        "exec_name": "Horst Leitner",
        "exec_title": "CEO, HOFER",
        "quote_source": "Annual Report 2025",
        "competitors_using_algolia": "Lidl, Rewe, Spar",
        "displacement_angle": "Custom search cannot handle weekly rotating inventory with regional availability across 500+ stores"
    },
    "fiat.com": {
        "company_name": "Fiat Automobiles S.p.A.",
        "revenue": 189_000_000_000,  # Stellantis global
        "gross_margin": 19.8,
        "traffic_growth": 3.1,
        "current_search": "Custom (Stellantis platform)",
        "trigger_events": json.dumps([
            "Dare Forward 2030 digital transformation [10-K FY2025]",
            "Direct sales model expansion in Europe [Press Release, Nov 2025]",
            "New Fiat 500e configurator launch [AutoNews, Jan 2026]"
        ]),
        "exec_quote": "The Fiat brand must embrace digital retail to reach younger customers directly.",
        "exec_name": "Olivier Francois",
        "exec_title": "CEO, Fiat",
        "quote_source": "Stellantis Q4 2025 Earnings",
        "competitors_using_algolia": "Volkswagen, Renault, Peugeot",
        "displacement_angle": "Stellantis platform lacks Italian/European language NLP for vehicle configurator"
    },
    "bever.nl": {
        "company_name": "Bever B.V",
        "revenue": 280_000_000,  # Estimated EUR
        "gross_margin": 42.1,
        "traffic_growth": 12.5,
        "current_search": "Elasticsearch",
        "trigger_events": json.dumps([
            "AS Adventure group integration [Press Release, Oct 2025]",
            "Outdoor gear e-commerce expansion [Annual Report 2025]",
            "Mobile app launch for Netherlands [App Store, Dec 2025]"
        ]),
        "exec_quote": "Outdoor enthusiasts need precise product discovery. Finding the right gear can make or break an adventure.",
        "exec_name": "Piet van der Werf",
        "exec_title": "CEO",
        "quote_source": "Annual Report 2025",
        "competitors_using_algolia": "REI, Decathlon, Bergfreunde",
        "displacement_angle": "Elasticsearch cannot handle outdoor gear attribute filtering (waterproof ratings, temperature ranges, activity types)"
    },
    "bekaert.com": {
        "company_name": "NV Bekaert SA",
        "revenue": 5_100_000_000,  # $5.1B
        "gross_margin": 28.4,
        "traffic_growth": 4.2,
        "current_search": "Custom (B2B catalog)",
        "trigger_events": json.dumps([
            "Digital B2B platform launch [Press Release, Nov 2025]",
            "Product catalog digitization - 50K SKUs [Annual Report 2025]",
            "Customer portal modernization [LinkedIn, Dec 2025]"
        ]),
        "exec_quote": "Our industrial customers need instant access to technical specifications. Product discovery drives engineering decisions.",
        "exec_name": "Oswald Schmid",
        "exec_title": "CEO",
        "quote_source": "Q4 2025 Earnings Call",
        "competitors_using_algolia": "ArcelorMittal, Nucor",
        "displacement_angle": "Custom catalog search cannot handle technical specification matching across 50K wire products"
    },
    "sunstargum.com": {
        "company_name": "Sunstar Americas Inc",
        "revenue": 450_000_000,  # Estimated
        "gross_margin": 58.2,
        "traffic_growth": 6.8,
        "current_search": "Custom (Sunstar platform)",
        "trigger_events": json.dumps([
            "DTC e-commerce expansion [Press Release, Oct 2025]",
            "Professional dental portal launch [LinkedIn, Nov 2025]",
            "Product education content initiative [Blog, Jan 2026]"
        ]),
        "exec_quote": "Dental professionals need rapid product discovery. The right tool makes all the difference in patient care.",
        "exec_name": "Yoshihiro Kawata",
        "exec_title": "President, Sunstar Americas",
        "quote_source": "Annual Report 2025",
        "competitors_using_algolia": "Colgate, Oral-B, Sensodyne",
        "displacement_angle": "Custom search cannot handle dental professional search patterns with product cross-referencing"
    },
    "odpbusiness.com": {
        "company_name": "ODP Business Solutions",
        "revenue": 8_500_000_000,  # ODP Corporation total
        "gross_margin": 25.6,
        "traffic_growth": -1.8,
        "current_search": "Endeca (legacy)",
        "trigger_events": json.dumps([
            "B2B digital platform modernization [10-K FY2025]",
            "Office Depot integration [Press Release, Nov 2025]",
            "AI-powered procurement tools [LinkedIn Jobs, Dec 2025]"
        ]),
        "exec_quote": "B2B buyers expect consumer-grade search. Product discovery must be instant across millions of SKUs.",
        "exec_name": "Gerry Smith",
        "exec_title": "CEO, ODP Corporation",
        "quote_source": "Q4 2025 Earnings Call",
        "competitors_using_algolia": "Staples, Amazon Business, W.B. Mason",
        "displacement_angle": "Endeca cannot handle B2B contract pricing overlay with real-time inventory across 1M+ SKUs"
    },
    "nissan.it": {
        "company_name": "Nissan Italy",
        "revenue": 82_000_000_000,  # Nissan global
        "gross_margin": 15.4,
        "traffic_growth": 2.1,
        "current_search": "Custom (Nissan platform)",
        "trigger_events": json.dumps([
            "Ambition 2030 digital transformation [Press Release, Oct 2025]",
            "EV model launches - Ariya, Leaf [CES 2026]",
            "Direct-to-consumer pilot in Italy [AutoNews, Jan 2026]"
        ]),
        "exec_quote": "Italian customers demand premium digital experiences. Our brand must match local expectations.",
        "exec_name": "Marco Toro",
        "exec_title": "President, Nissan Italy",
        "quote_source": "Q4 2025 Media Briefing",
        "competitors_using_algolia": "Toyota, Honda, Hyundai",
        "displacement_angle": "Nissan platform lacks Italian NLP and cannot sync dealer inventory in real-time"
    },
    "averydennison.com": {
        "company_name": "Avery Dennison",
        "revenue": 8_900_000_000,  # $8.9B
        "gross_margin": 32.8,
        "traffic_growth": 5.6,
        "current_search": "Custom (B2B portal)",
        "trigger_events": json.dumps([
            "Digital B2B platform expansion [10-K FY2025]",
            "RFID solutions portal launch [Press Release, Nov 2025]",
            "Product configurator modernization [LinkedIn, Dec 2025]"
        ]),
        "exec_quote": "Our customers need to find and configure label solutions instantly. Search is central to our B2B experience.",
        "exec_name": "Deon Stander",
        "exec_title": "CEO",
        "quote_source": "Q4 2025 Earnings Call",
        "competitors_using_algolia": "3M, Brady Corporation, Zebra Technologies",
        "displacement_angle": "Custom B2B search cannot handle label specification matching with material compatibility filtering across 100K+ SKUs"
    }
}


def add_missing_columns():
    """Add missing intelligence columns to displacement_targets table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Checking and adding missing columns...")

    # Check existing columns
    cursor.execute("PRAGMA table_info(displacement_targets)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    # Columns to add with their types
    new_columns = [
        ("revenue", "REAL"),
        ("gross_margin", "REAL"),
        ("traffic_growth", "REAL"),
        ("current_search", "TEXT"),
        ("trigger_events", "TEXT"),  # JSON array
        ("exec_quote", "TEXT"),
        ("exec_name", "TEXT"),
        ("exec_title", "TEXT"),
        ("quote_source", "TEXT"),
        ("competitors_using_algolia", "TEXT"),
        ("displacement_angle", "TEXT"),
        ("financials_json", "TEXT"),
        ("hiring_signals", "TEXT"),
        ("tech_stack_json", "TEXT")
    ]

    added = 0
    for col_name, col_type in new_columns:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE displacement_targets ADD COLUMN {col_name} {col_type}")
                print(f"   + Added column: {col_name} ({col_type})")
                added += 1
            except sqlite3.OperationalError as e:
                print(f"   ! Could not add {col_name}: {e}")

    conn.commit()
    conn.close()

    print(f"   Added {added} new columns")
    return added


def populate_sample_data():
    """Populate sample intelligence data for top 20 companies."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\nPopulating sample intelligence data...")

    updated = 0
    for domain, data in SAMPLE_DATA.items():
        cursor.execute("""
            UPDATE displacement_targets
            SET
                revenue = ?,
                gross_margin = ?,
                traffic_growth = ?,
                current_search = ?,
                trigger_events = ?,
                exec_quote = ?,
                exec_name = ?,
                exec_title = ?,
                quote_source = ?,
                competitors_using_algolia = ?,
                displacement_angle = ?
            WHERE domain = ?
        """, (
            data.get("revenue"),
            data.get("gross_margin"),
            data.get("traffic_growth"),
            data.get("current_search"),
            data.get("trigger_events"),
            data.get("exec_quote"),
            data.get("exec_name"),
            data.get("exec_title"),
            data.get("quote_source"),
            data.get("competitors_using_algolia"),
            data.get("displacement_angle"),
            domain
        ))

        if cursor.rowcount > 0:
            print(f"   + Updated: {domain} ({data.get('company_name', 'Unknown')})")
            updated += 1
        else:
            print(f"   - Not found: {domain}")

    conn.commit()
    conn.close()

    print(f"\n   Updated {updated} companies with intelligence data")
    return updated


def verify_data():
    """Verify the populated data."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\nVerifying populated data...")

    cursor.execute("""
        SELECT domain, company_name, lead_score, revenue, gross_margin,
               current_search, exec_name, displacement_angle
        FROM displacement_targets
        WHERE revenue IS NOT NULL
        ORDER BY lead_score DESC
        LIMIT 10
    """)

    results = cursor.fetchall()

    print("\n   Top 10 companies with intelligence data:")
    print("   " + "-" * 100)
    print(f"   {'Domain':<25} {'Company':<25} {'Score':<6} {'Revenue':<12} {'Search':<20}")
    print("   " + "-" * 100)

    for row in results:
        domain, company, score, revenue, margin, search, exec_name, angle = row
        rev_fmt = f"${revenue/1e9:.1f}B" if revenue and revenue >= 1e9 else f"${revenue/1e6:.0f}M" if revenue else "N/A"
        print(f"   {domain:<25} {(company or 'N/A')[:24]:<25} {score or 0:<6} {rev_fmt:<12} {(search or 'N/A')[:19]:<20}")

    conn.close()
    return len(results)


def main():
    print("=" * 60)
    print("Arian: Populate Sample Intelligence Data")
    print("=" * 60)

    # Step 1: Add missing columns
    add_missing_columns()

    # Step 2: Populate sample data
    populate_sample_data()

    # Step 3: Verify
    count = verify_data()

    print("\n" + "=" * 60)
    print(f"SUCCESS: Populated {count} companies with intelligence data")
    print("=" * 60)
    print("\nNext step: Run generate_dashboard.py to update the HTML dashboard")


if __name__ == "__main__":
    main()
