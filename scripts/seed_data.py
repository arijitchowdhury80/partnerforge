#!/usr/bin/env python3
"""
PartnerForge Data Seeding Script

Seeds the PostgreSQL database with sample data from the existing SQLite database.
Migrates displacement targets, case studies, and other entities.

Usage:
    python scripts/seed_data.py [--source sqlite|sample] [--dry-run] [--limit N]

Environment:
    DATABASE_URL: PostgreSQL connection string
    SQLITE_PATH: Path to source SQLite database (default: data/partnerforge.db)
"""

import os
import sys
import json
import sqlite3
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import asyncio
    import asyncpg
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install python-dotenv asyncpg")
    sys.exit(1)

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

SQLITE_PATH = os.getenv("SQLITE_PATH", "data/partnerforge.db")

# Sample data for when SQLite isn't available
SAMPLE_ACCOUNTS = [
    {
        "domain": "mercedes-benz.com",
        "company_name": "Mercedes-Benz",
        "vertical": "Automotive",
        "icp_tier": 1,
        "icp_tier_name": "Enterprise",
        "icp_score": 95,
        "monthly_visits": 45000000,
        "tech_spend_estimate": 150000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Germany",
        "employee_count": 170000,
        "priority_status": "hot",
        "ownership_type": "public",
        "stock_ticker": "MBG",
    },
    {
        "domain": "marks.com",
        "company_name": "Mark's Work Wearhouse",
        "vertical": "Retail",
        "icp_tier": 1,
        "icp_tier_name": "Enterprise",
        "icp_score": 85,
        "monthly_visits": 5000000,
        "tech_spend_estimate": 75000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Canada",
        "employee_count": 8000,
        "priority_status": "hot",
    },
    {
        "domain": "infiniti.com",
        "company_name": "Infiniti",
        "vertical": "Automotive",
        "icp_tier": 1,
        "icp_tier_name": "Enterprise",
        "icp_score": 85,
        "monthly_visits": 12000000,
        "tech_spend_estimate": 100000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Japan",
        "employee_count": 5000,
        "priority_status": "hot",
    },
    {
        "domain": "allianz.com",
        "company_name": "Allianz",
        "vertical": "Insurance",
        "icp_tier": 1,
        "icp_tier_name": "Enterprise",
        "icp_score": 85,
        "monthly_visits": 25000000,
        "tech_spend_estimate": 200000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Germany",
        "employee_count": 150000,
        "priority_status": "hot",
        "ownership_type": "public",
        "stock_ticker": "ALV",
    },
    {
        "domain": "hofer.at",
        "company_name": "HOFER",
        "vertical": "Retail",
        "icp_tier": 1,
        "icp_tier_name": "Enterprise",
        "icp_score": 85,
        "monthly_visits": 8000000,
        "tech_spend_estimate": 80000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Austria",
        "employee_count": 12000,
        "priority_status": "hot",
    },
    {
        "domain": "fiat.com",
        "company_name": "Fiat",
        "vertical": "Automotive",
        "icp_tier": 1,
        "icp_tier_name": "Enterprise",
        "icp_score": 85,
        "monthly_visits": 15000000,
        "tech_spend_estimate": 90000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Italy",
        "employee_count": 50000,
        "priority_status": "hot",
    },
    {
        "domain": "bever.nl",
        "company_name": "Bever",
        "vertical": "Retail",
        "icp_tier": 1,
        "icp_tier_name": "Enterprise",
        "icp_score": 85,
        "monthly_visits": 3000000,
        "tech_spend_estimate": 50000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Netherlands",
        "employee_count": 1500,
        "priority_status": "hot",
    },
    {
        "domain": "sunstar.com",
        "company_name": "Sunstar",
        "vertical": "Consumer Goods",
        "icp_tier": 2,
        "icp_tier_name": "Mid-Market",
        "icp_score": 80,
        "monthly_visits": 2000000,
        "tech_spend_estimate": 40000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Japan",
        "employee_count": 3000,
        "priority_status": "warm",
    },
    {
        "domain": "harley-davidson.com",
        "company_name": "Harley-Davidson",
        "vertical": "Automotive",
        "icp_tier": 2,
        "icp_tier_name": "Mid-Market",
        "icp_score": 75,
        "monthly_visits": 10000000,
        "tech_spend_estimate": 70000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "USA",
        "employee_count": 6000,
        "priority_status": "warm",
        "ownership_type": "public",
        "stock_ticker": "HOG",
    },
    {
        "domain": "continental.com",
        "company_name": "Continental",
        "vertical": "Automotive",
        "icp_tier": 2,
        "icp_tier_name": "Mid-Market",
        "icp_score": 72,
        "monthly_visits": 8000000,
        "tech_spend_estimate": 120000,
        "partner_technology": "Adobe Experience Manager",
        "headquarters_country": "Germany",
        "employee_count": 200000,
        "priority_status": "warm",
        "ownership_type": "public",
        "stock_ticker": "CON",
    },
]

SAMPLE_CASE_STUDIES = [
    {
        "company_name": "Under Armour",
        "domain": "underarmour.com",
        "vertical": "Retail",
        "use_case": "E-commerce Search",
        "headline": "Under Armour increases conversion by 37% with Algolia",
        "url": "https://www.algolia.com/customers/under-armour/",
        "metrics": {"conversion_lift": "37%", "search_revenue": "+25%"},
        "tags": ["retail", "ecommerce", "fashion"],
    },
    {
        "company_name": "Lacoste",
        "domain": "lacoste.com",
        "vertical": "Retail",
        "use_case": "E-commerce Search",
        "headline": "Lacoste achieves 150% increase in search revenue",
        "url": "https://www.algolia.com/customers/lacoste/",
        "metrics": {"search_revenue": "+150%", "search_usage": "+40%"},
        "tags": ["retail", "fashion", "luxury"],
    },
    {
        "company_name": "Gymshark",
        "domain": "gymshark.com",
        "vertical": "Retail",
        "use_case": "E-commerce Search",
        "headline": "Gymshark scales search globally with Algolia",
        "url": "https://www.algolia.com/customers/gymshark/",
        "metrics": {"global_markets": "13", "search_speed": "<50ms"},
        "tags": ["retail", "fitness", "dtc"],
    },
    {
        "company_name": "Decathlon",
        "domain": "decathlon.com",
        "vertical": "Retail",
        "use_case": "E-commerce Search",
        "headline": "Decathlon powers search across 60+ countries",
        "url": "https://www.algolia.com/customers/decathlon/",
        "metrics": {"countries": "60+", "products_indexed": "2M+"},
        "tags": ["retail", "sports", "global"],
    },
    {
        "company_name": "Staples",
        "domain": "staples.com",
        "vertical": "Retail",
        "use_case": "B2B E-commerce",
        "headline": "Staples transforms B2B search experience",
        "url": "https://www.algolia.com/customers/staples/",
        "metrics": {"search_relevance": "+45%", "time_to_purchase": "-30%"},
        "tags": ["b2b", "office", "enterprise"],
    },
]

# =============================================================================
# Database Functions
# =============================================================================

def connect_sqlite(path: str) -> Optional[sqlite3.Connection]:
    """Connect to SQLite database if it exists."""
    if not Path(path).exists():
        logger.warning(f"SQLite database not found: {path}")
        return None

    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


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


async def seed_from_sqlite(
    pg_conn: asyncpg.Connection,
    sqlite_conn: sqlite3.Connection,
    limit: Optional[int] = None,
    dry_run: bool = False
) -> Dict[str, int]:
    """Seed PostgreSQL from SQLite database."""
    results = {
        "accounts": 0,
        "case_studies": 0,
        "algolia_customers": 0,
        "competitors": 0,
    }

    # Migrate displacement_targets -> core.accounts
    logger.info("Migrating displacement_targets...")

    query = "SELECT * FROM displacement_targets"
    if limit:
        query += f" LIMIT {limit}"

    cursor = sqlite_conn.execute(query)
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]

    logger.info(f"Found {len(rows)} displacement targets")

    for row in rows:
        row_dict = dict(zip(columns, row))

        if dry_run:
            continue

        try:
            await pg_conn.execute("""
                INSERT INTO core.accounts (
                    domain, company_name, vertical, icp_tier, icp_tier_name,
                    icp_score, monthly_visits, tech_spend_estimate, partner_technology,
                    headquarters_country, founded_year, employee_count,
                    priority_status, last_enriched_at,
                    technologies, enrichment_data,
                    source_sqlite_id, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9,
                    $10, $11, $12,
                    $13, $14,
                    $15, $16,
                    $17, $18, $19
                )
                ON CONFLICT (domain) DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    icp_score = EXCLUDED.icp_score,
                    priority_status = EXCLUDED.priority_status,
                    enrichment_data = EXCLUDED.enrichment_data,
                    updated_at = NOW()
            """,
                row_dict.get("domain"),
                row_dict.get("company_name"),
                row_dict.get("vertical"),
                row_dict.get("icp_tier"),
                row_dict.get("icp_tier_name"),
                row_dict.get("icp_score"),
                row_dict.get("traffic_monthly"),
                row_dict.get("tech_spend"),
                row_dict.get("partner_tech"),
                row_dict.get("headquarters_country"),
                row_dict.get("founded_year"),
                row_dict.get("employee_count"),
                row_dict.get("priority_status"),
                row_dict.get("enriched_at"),
                json.dumps(parse_json_field(row_dict.get("technologies"))) if row_dict.get("technologies") else None,
                json.dumps(parse_json_field(row_dict.get("enrichment_data"))) if row_dict.get("enrichment_data") else None,
                row_dict.get("id"),
                row_dict.get("created_at") or datetime.now().isoformat(),
                row_dict.get("updated_at") or datetime.now().isoformat(),
            )
            results["accounts"] += 1

        except Exception as e:
            logger.error(f"Error migrating {row_dict.get('domain')}: {e}")

    # Migrate companies -> core.algolia_customers
    logger.info("Migrating companies (Algolia customers)...")

    cursor = sqlite_conn.execute("SELECT * FROM companies")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]

    logger.info(f"Found {len(rows)} Algolia customers")

    for row in rows:
        row_dict = dict(zip(columns, row))

        if dry_run:
            continue

        try:
            await pg_conn.execute("""
                INSERT INTO core.algolia_customers (
                    domain, company_name, arr, vertical
                ) VALUES ($1, $2, $3, $4)
                ON CONFLICT (domain) DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    arr = EXCLUDED.arr
            """,
                row_dict.get("domain"),
                row_dict.get("company_name"),
                row_dict.get("arr"),
                row_dict.get("vertical"),
            )
            results["algolia_customers"] += 1

        except Exception as e:
            logger.error(f"Error migrating customer {row_dict.get('domain')}: {e}")

    # Migrate case_studies
    logger.info("Migrating case studies...")

    cursor = sqlite_conn.execute("SELECT * FROM case_studies")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]

    logger.info(f"Found {len(rows)} case studies")

    for row in rows:
        row_dict = dict(zip(columns, row))

        if dry_run:
            continue

        try:
            await pg_conn.execute("""
                INSERT INTO core.case_studies (
                    company_name, domain, vertical, use_case, headline, url, metrics, tags
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
                row_dict.get("company_name"),
                row_dict.get("domain"),
                row_dict.get("vertical"),
                row_dict.get("use_case"),
                row_dict.get("headline"),
                row_dict.get("url"),
                json.dumps(parse_json_field(row_dict.get("metrics"))) if row_dict.get("metrics") else None,
                row_dict.get("tags", "").split(",") if row_dict.get("tags") else None,
            )
            results["case_studies"] += 1

        except Exception as e:
            logger.error(f"Error migrating case study {row_dict.get('company_name')}: {e}")

    return results


async def seed_from_samples(
    pg_conn: asyncpg.Connection,
    dry_run: bool = False
) -> Dict[str, int]:
    """Seed PostgreSQL with sample data."""
    results = {
        "accounts": 0,
        "case_studies": 0,
    }

    # Seed accounts
    logger.info(f"Seeding {len(SAMPLE_ACCOUNTS)} sample accounts...")

    for account in SAMPLE_ACCOUNTS:
        if dry_run:
            continue

        try:
            await pg_conn.execute("""
                INSERT INTO core.accounts (
                    domain, company_name, vertical, icp_tier, icp_tier_name,
                    icp_score, monthly_visits, tech_spend_estimate, partner_technology,
                    headquarters_country, employee_count, priority_status,
                    ownership_type, stock_ticker
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                )
                ON CONFLICT (domain) DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    icp_score = EXCLUDED.icp_score,
                    priority_status = EXCLUDED.priority_status,
                    updated_at = NOW()
            """,
                account.get("domain"),
                account.get("company_name"),
                account.get("vertical"),
                account.get("icp_tier"),
                account.get("icp_tier_name"),
                account.get("icp_score"),
                account.get("monthly_visits"),
                account.get("tech_spend_estimate"),
                account.get("partner_technology"),
                account.get("headquarters_country"),
                account.get("employee_count"),
                account.get("priority_status"),
                account.get("ownership_type"),
                account.get("stock_ticker"),
            )
            results["accounts"] += 1

        except Exception as e:
            logger.error(f"Error seeding {account.get('domain')}: {e}")

    # Seed case studies
    logger.info(f"Seeding {len(SAMPLE_CASE_STUDIES)} sample case studies...")

    for cs in SAMPLE_CASE_STUDIES:
        if dry_run:
            continue

        try:
            await pg_conn.execute("""
                INSERT INTO core.case_studies (
                    company_name, domain, vertical, use_case, headline, url, metrics, tags
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
                cs.get("company_name"),
                cs.get("domain"),
                cs.get("vertical"),
                cs.get("use_case"),
                cs.get("headline"),
                cs.get("url"),
                json.dumps(cs.get("metrics")),
                cs.get("tags"),
            )
            results["case_studies"] += 1

        except Exception as e:
            logger.error(f"Error seeding case study {cs.get('company_name')}: {e}")

    return results


async def seed_database(
    database_url: str,
    source: str = "sqlite",
    limit: Optional[int] = None,
    dry_run: bool = False
) -> bool:
    """Main seeding function."""

    # Convert SQLAlchemy URL to asyncpg format if needed
    if database_url.startswith("postgresql+asyncpg://"):
        database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    try:
        pg_conn = await asyncpg.connect(database_url)
        logger.info("Connected to PostgreSQL")

        if source == "sqlite":
            sqlite_conn = connect_sqlite(SQLITE_PATH)
            if sqlite_conn:
                results = await seed_from_sqlite(pg_conn, sqlite_conn, limit, dry_run)
                sqlite_conn.close()
            else:
                logger.warning("SQLite not available, falling back to sample data")
                results = await seed_from_samples(pg_conn, dry_run)
        else:
            results = await seed_from_samples(pg_conn, dry_run)

        await pg_conn.close()

        # Summary
        logger.info("\n" + "=" * 60)
        if dry_run:
            logger.info("[DRY RUN] Would seed:")
        else:
            logger.info("Seeding complete:")

        for table, count in results.items():
            logger.info(f"  {table}: {count} rows")

        return True

    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        return False


def get_database_url() -> str:
    """Get database URL from environment."""
    url = os.getenv("DATABASE_URL")

    if not url:
        user = os.getenv("POSTGRES_USER", "partnerforge")
        password = os.getenv("POSTGRES_PASSWORD", "partnerforge_dev_password")
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        db = os.getenv("POSTGRES_DB", "partnerforge")
        url = f"postgresql://{user}:{password}@{host}:{port}/{db}"

    return url


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Seed PartnerForge database with data"
    )
    parser.add_argument(
        "--source",
        type=str,
        choices=["sqlite", "sample"],
        default="sqlite",
        help="Data source: 'sqlite' (migrate from existing DB) or 'sample' (use built-in samples)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of records to migrate (for testing)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--database-url",
        type=str,
        help="Override DATABASE_URL from environment"
    )

    args = parser.parse_args()

    database_url = args.database_url or get_database_url()

    if not database_url:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    # Mask password in log output
    safe_url = database_url
    if "@" in safe_url:
        parts = safe_url.split("@")
        creds = parts[0].rsplit(":", 1)
        if len(creds) == 2:
            safe_url = f"{creds[0]}:****@{parts[1]}"
    logger.info(f"Database URL: {safe_url}")
    logger.info(f"Source: {args.source}")

    success = asyncio.run(seed_database(
        database_url,
        source=args.source,
        limit=args.limit,
        dry_run=args.dry_run
    ))

    if success:
        logger.info("\nSeeding complete!")
    else:
        logger.error("\nSeeding failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
