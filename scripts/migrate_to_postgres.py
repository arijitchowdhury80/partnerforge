#!/usr/bin/env python3
"""
Arian SQLite to PostgreSQL Migration Script

Migrates all data from the local SQLite database to Supabase PostgreSQL.

Usage:
    python scripts/migrate_to_postgres.py [--dry-run] [--table TABLE]

Environment:
    DATABASE_URL: PostgreSQL connection string (Supabase)
    SQLITE_PATH: Path to SQLite database (default: data/arian.db)
"""

import os
import sys
import json
import sqlite3
import argparse
import logging
from datetime import datetime
from typing import Any, Dict, List
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import Json
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# Configuration
# =============================================================================

SQLITE_PATH = os.getenv("SQLITE_PATH", "data/arian.db")
DATABASE_URL = os.getenv("DATABASE_URL")

# Table mappings: SQLite table -> PostgreSQL table
TABLE_MAPPINGS = {
    "displacement_targets": "core.accounts",
    "companies": "core.algolia_customers",  # Existing Algolia customers
    "competitive_intel": "intel.competitors",
    "case_studies": "core.case_studies",
}

# Column mappings: SQLite column -> PostgreSQL column
COLUMN_MAPPINGS = {
    "displacement_targets": {
        "id": "id",
        "domain": "domain",
        "company_name": "company_name",
        "vertical": "vertical",
        "icp_tier": "icp_tier",
        "icp_tier_name": "icp_tier_name",
        "icp_score": "icp_score",
        "traffic_monthly": "monthly_visits",
        "tech_spend": "tech_spend_estimate",
        "partner_tech": "partner_technology",
        "headquarters_country": "headquarters_country",
        "founded_year": "founded_year",
        "employee_count": "employee_count",
        "priority_status": "priority_status",
        "enriched_at": "last_enriched_at",
        "created_at": "created_at",
        "updated_at": "updated_at",
        # JSON fields
        "technologies": "technologies",
        "competitors": "competitors_domains",
        "enrichment_data": "enrichment_data",
    }
}

# =============================================================================
# PostgreSQL Schema (Run this first in Supabase SQL Editor)
# =============================================================================

POSTGRES_SCHEMA = """
-- Arian PostgreSQL Schema
-- Run this in Supabase SQL Editor before migration

-- Create schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS intel;
CREATE SCHEMA IF NOT EXISTS jobs;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CORE SCHEMA
-- =============================================================================

-- Main accounts table (displacement targets + enriched accounts)
CREATE TABLE IF NOT EXISTS core.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(500),

    -- Classification
    vertical VARCHAR(100),
    sub_vertical VARCHAR(100),
    icp_tier INTEGER CHECK (icp_tier BETWEEN 1 AND 3),
    icp_tier_name VARCHAR(50),

    -- Location
    headquarters_country VARCHAR(100),
    headquarters_city VARCHAR(100),
    headquarters_state VARCHAR(100),

    -- Company Type
    ownership_type VARCHAR(50),
    stock_ticker VARCHAR(20),
    stock_exchange VARCHAR(20),

    -- Size Indicators
    employee_count INTEGER,
    employee_count_source VARCHAR(50),
    founded_year INTEGER,

    -- Traffic (cached from SimilarWeb)
    monthly_visits BIGINT,
    bounce_rate DECIMAL(5,2),
    pages_per_visit DECIMAL(5,2),

    -- Technology (cached from BuiltWith)
    partner_technology VARCHAR(100),
    search_vendor VARCHAR(100),
    has_algolia BOOLEAN DEFAULT FALSE,
    technologies JSONB,
    tech_spend_estimate INTEGER,

    -- Algolia Status
    is_algolia_customer BOOLEAN DEFAULT FALSE,
    algolia_products TEXT[],
    algolia_arr DECIMAL(12,2),

    -- Scoring
    icp_score INTEGER CHECK (icp_score BETWEEN 0 AND 100),
    priority_score INTEGER,
    priority_status VARCHAR(20),
    score_breakdown JSONB,

    -- Competitors
    competitors_domains TEXT[],

    -- Intelligence Status
    intelligence_level VARCHAR(20) DEFAULT 'none',
    last_enriched_at TIMESTAMPTZ,
    enrichment_data JSONB,
    enrichment_errors JSONB,

    -- Metadata
    data_sources TEXT[],
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Source tracking
    source_sqlite_id INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_domain ON core.accounts(domain);
CREATE INDEX IF NOT EXISTS idx_accounts_vertical ON core.accounts(vertical);
CREATE INDEX IF NOT EXISTS idx_accounts_icp_tier ON core.accounts(icp_tier);
CREATE INDEX IF NOT EXISTS idx_accounts_icp_score ON core.accounts(icp_score DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_priority ON core.accounts(priority_status);
CREATE INDEX IF NOT EXISTS idx_accounts_is_algolia ON core.accounts(is_algolia_customer);
CREATE INDEX IF NOT EXISTS idx_accounts_monthly_visits ON core.accounts(monthly_visits DESC);

-- Existing Algolia customers (for exclusion)
CREATE TABLE IF NOT EXISTS core.algolia_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(500),
    arr DECIMAL(12,2),
    products TEXT[],
    customer_since DATE,
    vertical VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case studies
CREATE TABLE IF NOT EXISTS core.case_studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    vertical VARCHAR(100),
    use_case VARCHAR(255),
    headline TEXT,
    url TEXT,
    metrics JSONB,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INTEL SCHEMA (Intelligence Module Data)
-- =============================================================================

-- Financial Intelligence
CREATE TABLE IF NOT EXISTS intel.financial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    ticker VARCHAR(20),
    exchange VARCHAR(20),
    market_cap BIGINT,
    current_price DECIMAL(12,4),

    fiscal_years INTEGER[],
    revenue BIGINT[],
    net_income BIGINT[],
    operating_margin DECIMAL(5,2)[],
    ebitda BIGINT[],

    revenue_cagr DECIMAL(5,2),
    margin_zone VARCHAR(10),
    ecommerce_revenue BIGINT,
    ecommerce_pct DECIMAL(5,2),

    analyst_target_price DECIMAL(12,4),
    analyst_rating VARCHAR(20),

    data_source VARCHAR(50),
    source_urls JSONB,
    fetched_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id)
);

-- Competitors
CREATE TABLE IF NOT EXISTS intel.competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,
    competitor_domain VARCHAR(255) NOT NULL,

    similarity_score DECIMAL(5,2),
    similarity_source VARCHAR(50),

    monthly_visits BIGINT,
    bounce_rate DECIMAL(5,2),

    search_vendor VARCHAR(100),
    has_algolia BOOLEAN DEFAULT FALSE,
    ecommerce_platform VARCHAR(100),
    technologies JSONB,

    source_urls JSONB,
    fetched_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id, competitor_domain)
);

-- =============================================================================
-- JOBS SCHEMA
-- =============================================================================

CREATE TABLE IF NOT EXISTS jobs.enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    job_type VARCHAR(50),
    modules TEXT[],
    priority INTEGER DEFAULT 5,

    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    current_module VARCHAR(50),

    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    modules_completed TEXT[],
    modules_failed TEXT[],
    errors JSONB,

    requested_by UUID,
    request_source VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs.enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_account ON jobs.enrichment_jobs(account_id);

-- =============================================================================
-- Migration tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS core.migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    rows_migrated INTEGER,
    source_table VARCHAR(100),
    target_table VARCHAR(100)
);
"""

# =============================================================================
# Migration Functions
# =============================================================================

def connect_sqlite(path: str) -> sqlite3.Connection:
    """Connect to SQLite database."""
    if not Path(path).exists():
        raise FileNotFoundError(f"SQLite database not found: {path}")

    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def connect_postgres(url: str) -> psycopg2.extensions.connection:
    """Connect to PostgreSQL database."""
    if not url:
        raise ValueError("DATABASE_URL environment variable not set")

    return psycopg2.connect(url)


def get_sqlite_tables(conn: sqlite3.Connection) -> List[str]:
    """Get list of tables in SQLite database."""
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    return [row[0] for row in cursor.fetchall()]


def get_sqlite_table_info(conn: sqlite3.Connection, table: str) -> List[Dict]:
    """Get column info for a SQLite table."""
    cursor = conn.execute(f"PRAGMA table_info({table})")
    return [
        {"name": row[1], "type": row[2], "notnull": row[3], "pk": row[5]}
        for row in cursor.fetchall()
    ]


def get_row_count(conn: sqlite3.Connection, table: str) -> int:
    """Get row count for a SQLite table."""
    cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
    return cursor.fetchone()[0]


def parse_json_field(value: Any) -> Any:
    """Parse a potential JSON string into a Python object."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def migrate_displacement_targets(
    sqlite_conn: sqlite3.Connection,
    pg_conn: psycopg2.extensions.connection,
    dry_run: bool = False
) -> int:
    """Migrate displacement_targets to core.accounts."""

    logger.info("Migrating displacement_targets -> core.accounts")

    # Get all rows from SQLite
    cursor = sqlite_conn.execute("SELECT * FROM displacement_targets")
    rows = cursor.fetchall()

    if not rows:
        logger.warning("No rows found in displacement_targets")
        return 0

    # Get column names
    columns = [desc[0] for desc in cursor.description]
    logger.info(f"Found {len(rows)} rows with columns: {columns}")

    if dry_run:
        logger.info(f"[DRY RUN] Would migrate {len(rows)} rows")
        return len(rows)

    # Prepare insert
    pg_cursor = pg_conn.cursor()

    migrated = 0
    for row in rows:
        row_dict = dict(zip(columns, row))

        try:
            # Map SQLite fields to PostgreSQL
            pg_cursor.execute("""
                INSERT INTO core.accounts (
                    domain, company_name, vertical, icp_tier, icp_tier_name,
                    icp_score, monthly_visits, tech_spend_estimate, partner_technology,
                    headquarters_country, founded_year, employee_count,
                    priority_status, last_enriched_at,
                    technologies, competitors_domains, enrichment_data,
                    source_sqlite_id, created_at, updated_at
                ) VALUES (
                    %(domain)s, %(company_name)s, %(vertical)s, %(icp_tier)s, %(icp_tier_name)s,
                    %(icp_score)s, %(traffic_monthly)s, %(tech_spend)s, %(partner_tech)s,
                    %(headquarters_country)s, %(founded_year)s, %(employee_count)s,
                    %(priority_status)s, %(enriched_at)s,
                    %(technologies)s, %(competitors)s, %(enrichment_data)s,
                    %(id)s, %(created_at)s, %(updated_at)s
                )
                ON CONFLICT (domain) DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    icp_score = EXCLUDED.icp_score,
                    priority_status = EXCLUDED.priority_status,
                    enrichment_data = EXCLUDED.enrichment_data,
                    updated_at = NOW()
            """, {
                "domain": row_dict.get("domain"),
                "company_name": row_dict.get("company_name"),
                "vertical": row_dict.get("vertical"),
                "icp_tier": row_dict.get("icp_tier"),
                "icp_tier_name": row_dict.get("icp_tier_name"),
                "icp_score": row_dict.get("icp_score"),
                "traffic_monthly": row_dict.get("traffic_monthly"),
                "tech_spend": row_dict.get("tech_spend"),
                "partner_tech": row_dict.get("partner_tech"),
                "headquarters_country": row_dict.get("headquarters_country"),
                "founded_year": row_dict.get("founded_year"),
                "employee_count": row_dict.get("employee_count"),
                "priority_status": row_dict.get("priority_status"),
                "enriched_at": row_dict.get("enriched_at"),
                "technologies": Json(parse_json_field(row_dict.get("technologies"))),
                "competitors": row_dict.get("competitors", "").split(",") if row_dict.get("competitors") else None,
                "enrichment_data": Json(parse_json_field(row_dict.get("enrichment_data"))),
                "id": row_dict.get("id"),
                "created_at": row_dict.get("created_at") or datetime.now().isoformat(),
                "updated_at": row_dict.get("updated_at") or datetime.now().isoformat(),
            })
            migrated += 1

        except Exception as e:
            logger.error(f"Error migrating row {row_dict.get('domain')}: {e}")
            continue

    pg_conn.commit()
    logger.info(f"Migrated {migrated}/{len(rows)} rows to core.accounts")

    return migrated


def migrate_companies(
    sqlite_conn: sqlite3.Connection,
    pg_conn: psycopg2.extensions.connection,
    dry_run: bool = False
) -> int:
    """Migrate companies (Algolia customers) to core.algolia_customers."""

    logger.info("Migrating companies -> core.algolia_customers")

    cursor = sqlite_conn.execute("SELECT * FROM companies")
    rows = cursor.fetchall()

    if not rows:
        logger.warning("No rows found in companies")
        return 0

    columns = [desc[0] for desc in cursor.description]
    logger.info(f"Found {len(rows)} rows")

    if dry_run:
        logger.info(f"[DRY RUN] Would migrate {len(rows)} rows")
        return len(rows)

    pg_cursor = pg_conn.cursor()
    migrated = 0

    for row in rows:
        row_dict = dict(zip(columns, row))

        try:
            pg_cursor.execute("""
                INSERT INTO core.algolia_customers (
                    domain, company_name, arr, vertical
                ) VALUES (
                    %(domain)s, %(company_name)s, %(arr)s, %(vertical)s
                )
                ON CONFLICT (domain) DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    arr = EXCLUDED.arr
            """, {
                "domain": row_dict.get("domain"),
                "company_name": row_dict.get("company_name"),
                "arr": row_dict.get("arr"),
                "vertical": row_dict.get("vertical"),
            })
            migrated += 1

        except Exception as e:
            logger.error(f"Error migrating company {row_dict.get('domain')}: {e}")
            continue

    pg_conn.commit()
    logger.info(f"Migrated {migrated}/{len(rows)} rows to core.algolia_customers")

    return migrated


def migrate_case_studies(
    sqlite_conn: sqlite3.Connection,
    pg_conn: psycopg2.extensions.connection,
    dry_run: bool = False
) -> int:
    """Migrate case_studies to core.case_studies."""

    logger.info("Migrating case_studies -> core.case_studies")

    cursor = sqlite_conn.execute("SELECT * FROM case_studies")
    rows = cursor.fetchall()

    if not rows:
        logger.warning("No rows found in case_studies")
        return 0

    columns = [desc[0] for desc in cursor.description]
    logger.info(f"Found {len(rows)} rows")

    if dry_run:
        logger.info(f"[DRY RUN] Would migrate {len(rows)} rows")
        return len(rows)

    pg_cursor = pg_conn.cursor()
    migrated = 0

    for row in rows:
        row_dict = dict(zip(columns, row))

        try:
            pg_cursor.execute("""
                INSERT INTO core.case_studies (
                    company_name, domain, vertical, use_case, headline, url, metrics, tags
                ) VALUES (
                    %(company_name)s, %(domain)s, %(vertical)s, %(use_case)s,
                    %(headline)s, %(url)s, %(metrics)s, %(tags)s
                )
            """, {
                "company_name": row_dict.get("company_name"),
                "domain": row_dict.get("domain"),
                "vertical": row_dict.get("vertical"),
                "use_case": row_dict.get("use_case"),
                "headline": row_dict.get("headline"),
                "url": row_dict.get("url"),
                "metrics": Json(parse_json_field(row_dict.get("metrics"))),
                "tags": row_dict.get("tags", "").split(",") if row_dict.get("tags") else None,
            })
            migrated += 1

        except Exception as e:
            logger.error(f"Error migrating case study {row_dict.get('company_name')}: {e}")
            continue

    pg_conn.commit()
    logger.info(f"Migrated {migrated}/{len(rows)} rows to core.case_studies")

    return migrated


def migrate_competitive_intel(
    sqlite_conn: sqlite3.Connection,
    pg_conn: psycopg2.extensions.connection,
    dry_run: bool = False
) -> int:
    """Migrate competitive_intel to intel.competitors."""

    logger.info("Migrating competitive_intel -> intel.competitors")

    cursor = sqlite_conn.execute("SELECT * FROM competitive_intel")
    rows = cursor.fetchall()

    if not rows:
        logger.warning("No rows found in competitive_intel")
        return 0

    columns = [desc[0] for desc in cursor.description]
    logger.info(f"Found {len(rows)} rows")

    if dry_run:
        logger.info(f"[DRY RUN] Would migrate {len(rows)} rows")
        return len(rows)

    pg_cursor = pg_conn.cursor()
    migrated = 0

    for row in rows:
        row_dict = dict(zip(columns, row))

        try:
            # First, get or create the account for this domain
            pg_cursor.execute(
                "SELECT id FROM core.accounts WHERE domain = %s",
                (row_dict.get("target_domain"),)
            )
            account_row = pg_cursor.fetchone()

            if not account_row:
                logger.warning(f"No account found for {row_dict.get('target_domain')}, skipping")
                continue

            account_id = account_row[0]

            pg_cursor.execute("""
                INSERT INTO intel.competitors (
                    account_id, competitor_domain, similarity_score, monthly_visits,
                    search_vendor, has_algolia, technologies, fetched_at
                ) VALUES (
                    %(account_id)s, %(competitor_domain)s, %(similarity_score)s,
                    %(monthly_visits)s, %(search_vendor)s, %(has_algolia)s,
                    %(technologies)s, %(fetched_at)s
                )
                ON CONFLICT (account_id, competitor_domain) DO UPDATE SET
                    search_vendor = EXCLUDED.search_vendor,
                    has_algolia = EXCLUDED.has_algolia,
                    technologies = EXCLUDED.technologies,
                    fetched_at = EXCLUDED.fetched_at
            """, {
                "account_id": account_id,
                "competitor_domain": row_dict.get("competitor_domain"),
                "similarity_score": row_dict.get("similarity_score"),
                "monthly_visits": row_dict.get("monthly_visits"),
                "search_vendor": row_dict.get("search_vendor"),
                "has_algolia": row_dict.get("has_algolia", False),
                "technologies": Json(parse_json_field(row_dict.get("technologies"))),
                "fetched_at": row_dict.get("fetched_at"),
            })
            migrated += 1

        except Exception as e:
            logger.error(f"Error migrating competitor {row_dict.get('competitor_domain')}: {e}")
            continue

    pg_conn.commit()
    logger.info(f"Migrated {migrated}/{len(rows)} rows to intel.competitors")

    return migrated


def run_schema_setup(pg_conn: psycopg2.extensions.connection, dry_run: bool = False):
    """Run the PostgreSQL schema setup."""
    logger.info("Setting up PostgreSQL schema...")

    if dry_run:
        logger.info("[DRY RUN] Would create schema")
        return

    cursor = pg_conn.cursor()
    cursor.execute(POSTGRES_SCHEMA)
    pg_conn.commit()
    logger.info("Schema setup complete")


def record_migration(
    pg_conn: psycopg2.extensions.connection,
    name: str,
    source: str,
    target: str,
    rows: int
):
    """Record a completed migration."""
    cursor = pg_conn.cursor()
    cursor.execute("""
        INSERT INTO core.migrations (name, source_table, target_table, rows_migrated)
        VALUES (%s, %s, %s, %s)
    """, (name, source, target, rows))
    pg_conn.commit()


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Migrate Arian data from SQLite to PostgreSQL"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes"
    )
    parser.add_argument(
        "--table",
        type=str,
        help="Migrate only a specific table"
    )
    parser.add_argument(
        "--schema-only",
        action="store_true",
        help="Only set up the PostgreSQL schema, don't migrate data"
    )
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Skip schema setup (use if schema already exists)"
    )

    args = parser.parse_args()

    # Validate environment
    if not DATABASE_URL:
        logger.error("DATABASE_URL environment variable not set")
        logger.info("Set it with: export DATABASE_URL='postgresql://user:pass@host:5432/db'")
        sys.exit(1)

    # Connect to databases
    try:
        sqlite_conn = connect_sqlite(SQLITE_PATH)
        logger.info(f"Connected to SQLite: {SQLITE_PATH}")
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)

    try:
        pg_conn = connect_postgres(DATABASE_URL)
        logger.info("Connected to PostgreSQL")
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL: {e}")
        sys.exit(1)

    # Show SQLite tables
    tables = get_sqlite_tables(sqlite_conn)
    logger.info(f"SQLite tables: {tables}")

    for table in tables:
        count = get_row_count(sqlite_conn, table)
        logger.info(f"  {table}: {count} rows")

    # Set up schema
    if not args.skip_schema:
        run_schema_setup(pg_conn, args.dry_run)

    if args.schema_only:
        logger.info("Schema-only mode, skipping data migration")
        return

    # Migrate tables
    total_migrated = 0

    # Migrate displacement_targets first (main table)
    if not args.table or args.table == "displacement_targets":
        rows = migrate_displacement_targets(sqlite_conn, pg_conn, args.dry_run)
        total_migrated += rows
        if not args.dry_run:
            record_migration(pg_conn, "displacement_targets", "displacement_targets", "core.accounts", rows)

    # Migrate companies (Algolia customers)
    if not args.table or args.table == "companies":
        rows = migrate_companies(sqlite_conn, pg_conn, args.dry_run)
        total_migrated += rows
        if not args.dry_run:
            record_migration(pg_conn, "companies", "companies", "core.algolia_customers", rows)

    # Migrate case studies
    if not args.table or args.table == "case_studies":
        rows = migrate_case_studies(sqlite_conn, pg_conn, args.dry_run)
        total_migrated += rows
        if not args.dry_run:
            record_migration(pg_conn, "case_studies", "case_studies", "core.case_studies", rows)

    # Migrate competitive intelligence (after accounts exist)
    if not args.table or args.table == "competitive_intel":
        rows = migrate_competitive_intel(sqlite_conn, pg_conn, args.dry_run)
        total_migrated += rows
        if not args.dry_run:
            record_migration(pg_conn, "competitive_intel", "competitive_intel", "intel.competitors", rows)

    # Summary
    logger.info("=" * 60)
    if args.dry_run:
        logger.info(f"[DRY RUN] Would migrate {total_migrated} total rows")
    else:
        logger.info(f"Migration complete! Migrated {total_migrated} total rows")

    # Cleanup
    sqlite_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    main()
