#!/usr/bin/env python3
"""
Arian: Intelligence Schema Migration

Creates new tables for the Search Audit Intelligence merger:
- company_financials: 3-year financial trends from Yahoo Finance
- executive_quotes: Quotes from earnings calls, 10-K filings
- hiring_signals: Job postings indicating buying signals
- strategic_triggers: Expansion, migration, competitive pressure
- buying_committee: Named stakeholders with priority signals
"""

import sqlite3

DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/Arian/data/arian.db"


def run_migration():
    """Create intelligence tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("🔧 Running Arian Intelligence Schema Migration...")

    # 1. Company Financials
    print("   📊 Creating company_financials table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS company_financials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL UNIQUE,
            ticker TEXT,
            company_name TEXT,

            -- Revenue (3 years)
            revenue_fy2023 REAL,
            revenue_fy2024 REAL,
            revenue_fy2025 REAL,
            revenue_cagr REAL,

            -- Net Income (3 years)
            net_income_fy2023 REAL,
            net_income_fy2024 REAL,
            net_income_fy2025 REAL,

            -- EBITDA & Margins
            ebitda_fy2025 REAL,
            ebitda_margin REAL,
            margin_zone TEXT,  -- 'green' (>20%), 'yellow' (10-20%), 'red' (<=10%)

            -- E-commerce metrics
            ecommerce_revenue REAL,
            ecommerce_percent REAL,
            ecommerce_growth REAL,

            -- Stock info
            market_cap REAL,
            stock_price REAL,
            price_change_1y REAL,

            -- Analyst data
            analyst_rating TEXT,  -- 'strong_buy', 'buy', 'hold', 'sell'
            analyst_target_price REAL,

            -- Metadata
            data_source TEXT DEFAULT 'yahoo_finance',
            confidence TEXT DEFAULT 'high',  -- 'high', 'medium', 'low'
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Executive Quotes
    print("   🎙️ Creating executive_quotes table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS executive_quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            speaker_name TEXT NOT NULL,
            speaker_title TEXT,
            quote TEXT NOT NULL,
            source_type TEXT,  -- 'earnings_call', '10-K', '10-Q', 'interview', 'investor_day'
            source_name TEXT,  -- 'Q4 2025 Earnings Call', 'FY2025 10-K'
            source_url TEXT,
            quote_date TEXT,
            maps_to_product TEXT,  -- 'NeuralSearch', 'Recommend', 'AI Search', etc.
            relevance_score INTEGER DEFAULT 0,  -- 0-100
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(domain, quote)
        )
    """)

    # 3. Hiring Signals
    print("   👔 Creating hiring_signals table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hiring_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            role_title TEXT NOT NULL,
            team TEXT,  -- 'Engineering', 'Product', 'eCommerce', 'Data'
            seniority TEXT,  -- 'VP', 'Director', 'Manager', 'IC'
            signal_type TEXT,  -- 'hot', 'warm', 'technical', 'caution'
            signal_reason TEXT,  -- 'budget_allocated', 'team_building', 'build_vs_buy'
            keywords_found TEXT,  -- 'search, algolia, elasticsearch'
            careers_url TEXT,
            job_url TEXT,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(domain, role_title)
        )
    """)

    # 4. Strategic Triggers
    print("   🎯 Creating strategic_triggers table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS strategic_triggers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            trigger_type TEXT NOT NULL,  -- 'expansion', 'migration', 'competitor_pressure', 'tech_removal', 'leadership_change'
            trigger_category TEXT,  -- 'positive', 'negative', 'neutral'
            title TEXT NOT NULL,
            description TEXT,
            source_url TEXT,
            source_date TEXT,
            algolia_angle TEXT,  -- How this connects to Algolia value
            priority INTEGER DEFAULT 0,  -- 1-5, higher = more urgent
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(domain, title)
        )
    """)

    # 5. Buying Committee
    print("   👥 Creating buying_committee table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS buying_committee (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            name TEXT NOT NULL,
            title TEXT,
            linkedin_url TEXT,
            email TEXT,
            buyer_role TEXT,  -- 'economic', 'technical', 'user', 'champion'
            priority TEXT,  -- 'hot', 'warm', 'cold'
            priority_reason TEXT,  -- 'new_in_role', 'ex_algolia_user', 'search_background'
            tenure TEXT,
            previous_company TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(domain, name)
        )
    """)

    # 6. Enrichment Status (tracks what's been enriched)
    print("   📋 Creating enrichment_status table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS enrichment_status (
            domain TEXT PRIMARY KEY,
            financials_enriched INTEGER DEFAULT 0,
            quotes_enriched INTEGER DEFAULT 0,
            hiring_enriched INTEGER DEFAULT 0,
            triggers_enriched INTEGER DEFAULT 0,
            committee_enriched INTEGER DEFAULT 0,
            last_enriched TIMESTAMP,
            enrichment_errors TEXT
        )
    """)

    # 7. Add enrichment columns to displacement_targets
    print("   🔗 Adding enrichment columns to displacement_targets...")

    # Check existing columns
    cursor.execute("PRAGMA table_info(displacement_targets)")
    existing_cols = [row[1] for row in cursor.fetchall()]

    new_cols = [
        ("ticker", "TEXT"),
        ("is_public", "INTEGER DEFAULT 0"),
        ("enrichment_level", "TEXT DEFAULT 'basic'"),
        ("last_enriched", "TIMESTAMP")
    ]

    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE displacement_targets ADD COLUMN {col_name} {col_type}")
            print(f"      + Added column: {col_name}")

    conn.commit()

    # Verify tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()

    print("\n✅ Migration complete!")
    print(f"   Tables in database: {[t[0] for t in tables]}")

    # Count records in new tables
    for table in ['company_financials', 'executive_quotes', 'hiring_signals', 'strategic_triggers', 'buying_committee', 'enrichment_status']:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"   {table}: {count} records")

    conn.close()


if __name__ == "__main__":
    run_migration()
