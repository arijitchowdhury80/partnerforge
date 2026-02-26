#!/usr/bin/env python3
"""
PartnerForge Database Initialization Script

Initializes the PostgreSQL database with all required tables and indexes.
Can be run standalone or as part of the setup process.

Usage:
    python scripts/init_db.py [--drop-existing] [--dry-run]

Environment:
    DATABASE_URL: PostgreSQL connection string
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import asyncio
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install python-dotenv")
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
# Database Schema SQL
# =============================================================================

SCHEMA_SQL = """
-- =============================================================================
-- PartnerForge Database Schema
-- =============================================================================
-- Version: 3.0.0
-- Database: PostgreSQL 15+
-- Generated: 2026-02-25
-- =============================================================================

-- Create schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS intel;
CREATE SCHEMA IF NOT EXISTS jobs;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- =============================================================================
-- CORE SCHEMA - Main business entities
-- =============================================================================

-- Partner technologies tracked by the platform
CREATE TABLE IF NOT EXISTS core.partner_technologies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    vendor VARCHAR(100),
    category VARCHAR(50),  -- e.commerce, cms, search, etc.
    builtwith_key VARCHAR(100),  -- Key used in BuiltWith API
    priority INTEGER DEFAULT 5,  -- 1=highest priority
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
    region VARCHAR(50),

    -- Company Type
    ownership_type VARCHAR(50),  -- public, private, subsidiary
    stock_ticker VARCHAR(20),
    stock_exchange VARCHAR(20),
    parent_company VARCHAR(255),

    -- Size Indicators
    employee_count INTEGER,
    employee_count_range VARCHAR(50),
    employee_count_source VARCHAR(50),
    founded_year INTEGER,

    -- Traffic (cached from SimilarWeb)
    monthly_visits BIGINT,
    bounce_rate DECIMAL(5,2),
    pages_per_visit DECIMAL(5,2),
    avg_visit_duration INTEGER,  -- seconds
    traffic_trend VARCHAR(20),  -- up, down, stable
    traffic_updated_at TIMESTAMPTZ,

    -- Technology (cached from BuiltWith)
    partner_technology_id UUID REFERENCES core.partner_technologies(id),
    partner_technology VARCHAR(100),
    search_vendor VARCHAR(100),
    ecommerce_platform VARCHAR(100),
    cms_platform VARCHAR(100),
    has_algolia BOOLEAN DEFAULT FALSE,
    technologies JSONB,
    tech_spend_estimate INTEGER,
    tech_updated_at TIMESTAMPTZ,

    -- Algolia Status
    is_algolia_customer BOOLEAN DEFAULT FALSE,
    algolia_products TEXT[],
    algolia_arr DECIMAL(12,2),
    algolia_customer_since DATE,

    -- Scoring
    icp_score INTEGER CHECK (icp_score BETWEEN 0 AND 100),
    priority_score INTEGER,
    priority_status VARCHAR(20),  -- hot, warm, cool, cold
    signal_score INTEGER,
    score_breakdown JSONB,

    -- Competitors
    competitors_domains TEXT[],
    competitor_count INTEGER,

    -- Intelligence Status
    intelligence_level VARCHAR(20) DEFAULT 'none',  -- none, basic, full, premium
    enrichment_status VARCHAR(20) DEFAULT 'pending',
    last_enriched_at TIMESTAMPTZ,
    enrichment_data JSONB,
    enrichment_errors JSONB,

    -- Sources tracking
    data_sources TEXT[],
    confidence_score DECIMAL(3,2),

    -- List membership
    list_ids UUID[],
    tags TEXT[],

    -- Metadata
    notes TEXT,
    assigned_to VARCHAR(255),
    source_sqlite_id INTEGER,  -- For migration tracking

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for accounts
CREATE INDEX IF NOT EXISTS idx_accounts_domain ON core.accounts(domain);
CREATE INDEX IF NOT EXISTS idx_accounts_domain_trgm ON core.accounts USING gin(domain gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_accounts_company_name_trgm ON core.accounts USING gin(company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_accounts_vertical ON core.accounts(vertical);
CREATE INDEX IF NOT EXISTS idx_accounts_icp_tier ON core.accounts(icp_tier);
CREATE INDEX IF NOT EXISTS idx_accounts_icp_score ON core.accounts(icp_score DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_priority ON core.accounts(priority_status);
CREATE INDEX IF NOT EXISTS idx_accounts_is_algolia ON core.accounts(is_algolia_customer);
CREATE INDEX IF NOT EXISTS idx_accounts_monthly_visits ON core.accounts(monthly_visits DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_partner_tech ON core.accounts(partner_technology);
CREATE INDEX IF NOT EXISTS idx_accounts_search_vendor ON core.accounts(search_vendor);
CREATE INDEX IF NOT EXISTS idx_accounts_enrichment_status ON core.accounts(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON core.accounts(created_at DESC);

-- Target Lists (user-uploaded lists)
CREATE TABLE IF NOT EXISTS core.lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(100),  -- csv_upload, builtwith_api, manual

    -- Stats
    total_accounts INTEGER DEFAULT 0,
    enriched_accounts INTEGER DEFAULT 0,
    hot_leads INTEGER DEFAULT 0,
    warm_leads INTEGER DEFAULT 0,

    -- Processing
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, complete, error
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- User
    created_by VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- List membership (many-to-many)
CREATE TABLE IF NOT EXISTS core.list_accounts (
    list_id UUID REFERENCES core.lists(id) ON DELETE CASCADE,
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,
    position INTEGER,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (list_id, account_id)
);

-- Existing Algolia customers (for exclusion)
CREATE TABLE IF NOT EXISTS core.algolia_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(500),
    arr DECIMAL(12,2),
    products TEXT[],
    customer_since DATE,
    vertical VARCHAR(100),
    account_owner VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case studies
CREATE TABLE IF NOT EXISTS core.case_studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    vertical VARCHAR(100),
    sub_vertical VARCHAR(100),
    use_case VARCHAR(255),
    headline TEXT,
    summary TEXT,
    url TEXT,
    pdf_url TEXT,
    video_url TEXT,

    -- Metrics
    metrics JSONB,
    primary_metric_label VARCHAR(100),
    primary_metric_value VARCHAR(50),

    -- Matching
    tags TEXT[],
    products_used TEXT[],

    is_verified BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_studies_vertical ON core.case_studies(vertical);
CREATE INDEX IF NOT EXISTS idx_case_studies_tags ON core.case_studies USING gin(tags);

-- =============================================================================
-- INTEL SCHEMA - Intelligence module data
-- =============================================================================

-- Financial Intelligence (M04)
CREATE TABLE IF NOT EXISTS intel.financials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    -- Stock info
    ticker VARCHAR(20),
    exchange VARCHAR(20),
    market_cap BIGINT,
    current_price DECIMAL(12,4),
    price_updated_at TIMESTAMPTZ,

    -- Historical financials (arrays for year-over-year)
    fiscal_years INTEGER[],
    revenue BIGINT[],
    net_income BIGINT[],
    operating_margin DECIMAL(5,2)[],
    ebitda BIGINT[],

    -- Calculated metrics
    revenue_cagr DECIMAL(5,2),
    margin_zone VARCHAR(10),  -- green, yellow, red

    -- E-commerce specific
    ecommerce_revenue BIGINT,
    ecommerce_pct DECIMAL(5,2),
    digital_revenue BIGINT,
    digital_pct DECIMAL(5,2),

    -- Analyst info
    analyst_target_price DECIMAL(12,4),
    analyst_rating VARCHAR(20),
    analyst_count INTEGER,

    -- Source tracking
    data_source VARCHAR(50),
    source_urls JSONB,
    fetched_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id)
);

-- Competitor Intelligence (M05)
CREATE TABLE IF NOT EXISTS intel.competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,
    competitor_domain VARCHAR(255) NOT NULL,

    -- Similarity
    similarity_score DECIMAL(5,2),
    similarity_source VARCHAR(50),  -- similarweb, manual

    -- Traffic comparison
    monthly_visits BIGINT,
    bounce_rate DECIMAL(5,2),
    traffic_rank INTEGER,

    -- Technology
    search_vendor VARCHAR(100),
    has_algolia BOOLEAN DEFAULT FALSE,
    ecommerce_platform VARCHAR(100),
    technologies JSONB,

    -- Source tracking
    source_urls JSONB,
    fetched_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id, competitor_domain)
);

CREATE INDEX IF NOT EXISTS idx_competitors_account ON intel.competitors(account_id);
CREATE INDEX IF NOT EXISTS idx_competitors_has_algolia ON intel.competitors(has_algolia);

-- Hiring Signals (M06)
CREATE TABLE IF NOT EXISTS intel.hiring_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    job_title VARCHAR(500) NOT NULL,
    job_url TEXT,
    job_location VARCHAR(255),
    job_type VARCHAR(50),  -- full-time, contract, etc.

    -- Classification
    signal_type VARCHAR(50),  -- search, ecommerce, digital, other
    signal_strength INTEGER,  -- 1-10
    is_relevant BOOLEAN DEFAULT TRUE,

    -- Extracted info
    keywords TEXT[],
    technologies_mentioned TEXT[],

    posted_date DATE,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hiring_account ON intel.hiring_signals(account_id);
CREATE INDEX IF NOT EXISTS idx_hiring_signal_type ON intel.hiring_signals(signal_type);

-- Executive Intelligence (M08, M09)
CREATE TABLE IF NOT EXISTS intel.executives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    linkedin_url TEXT,

    -- Classification
    is_decision_maker BOOLEAN DEFAULT FALSE,
    is_influencer BOOLEAN DEFAULT FALSE,
    relevance_score INTEGER,

    -- Quotes and insights
    quotes JSONB,  -- Array of {quote, source, date, context}

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_executives_account ON intel.executives(account_id);

-- Strategic Signals (M07, M14)
CREATE TABLE IF NOT EXISTS intel.strategic_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    signal_type VARCHAR(50) NOT NULL,  -- exec_quote, sec_filing, press_release, etc.
    signal_category VARCHAR(50),  -- digital, search, conversion, growth
    signal_strength INTEGER,  -- 1-10

    title VARCHAR(500),
    content TEXT,
    source_url TEXT,
    source_name VARCHAR(255),

    -- Extracted entities
    keywords TEXT[],
    mentioned_technologies TEXT[],
    mentioned_competitors TEXT[],

    signal_date DATE,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_account ON intel.strategic_signals(account_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON intel.strategic_signals(signal_type);

-- =============================================================================
-- JOBS SCHEMA - Background job tracking
-- =============================================================================

-- Enrichment Jobs
CREATE TABLE IF NOT EXISTS jobs.enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    job_type VARCHAR(50),  -- full, wave, module
    modules TEXT[],
    wave INTEGER,
    priority INTEGER DEFAULT 5,

    status VARCHAR(20) DEFAULT 'pending',  -- pending, queued, running, complete, failed
    progress INTEGER DEFAULT 0,
    current_module VARCHAR(50),

    -- Timing
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Results
    modules_completed TEXT[],
    modules_failed TEXT[],
    errors JSONB,

    -- Request context
    requested_by VARCHAR(255),
    request_source VARCHAR(50),  -- api, scheduler, manual
    force_refresh BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs.enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_account ON jobs.enrichment_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_jobs_queued ON jobs.enrichment_jobs(queued_at DESC);

-- List Processing Jobs
CREATE TABLE IF NOT EXISTS jobs.list_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID REFERENCES core.lists(id) ON DELETE CASCADE,

    job_type VARCHAR(50),  -- import, enrich, export
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,

    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    errors JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- UTILITY TABLES
-- =============================================================================

-- API Rate Limit Tracking
CREATE TABLE IF NOT EXISTS core.api_rate_limits (
    id SERIAL PRIMARY KEY,
    api_name VARCHAR(50) NOT NULL,
    requests_made INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_minutes INTEGER DEFAULT 1,
    UNIQUE(api_name, window_start)
);

-- Cache for expensive API calls
CREATE TABLE IF NOT EXISTS core.api_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_name VARCHAR(50) NOT NULL,
    cache_key VARCHAR(500) NOT NULL,
    response_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(api_name, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON core.api_cache(expires_at);

-- Migration tracking
CREATE TABLE IF NOT EXISTS core.migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    rows_migrated INTEGER,
    source_table VARCHAR(100),
    target_table VARCHAR(100)
);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_accounts_updated_at ON core.accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON core.accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lists_updated_at ON core.lists;
CREATE TRIGGER update_lists_updated_at
    BEFORE UPDATE ON core.lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_case_studies_updated_at ON core.case_studies;
CREATE TRIGGER update_case_studies_updated_at
    BEFORE UPDATE ON core.case_studies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financials_updated_at ON intel.financials;
CREATE TRIGGER update_financials_updated_at
    BEFORE UPDATE ON intel.financials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Seed partner technologies
INSERT INTO core.partner_technologies (name, vendor, category, builtwith_key, priority) VALUES
    ('Adobe Experience Manager', 'Adobe', 'cms', 'Adobe-Experience-Manager', 1),
    ('Adobe Commerce', 'Adobe', 'ecommerce', 'Adobe-Commerce', 1),
    ('Shopify Plus', 'Shopify', 'ecommerce', 'Shopify-Plus', 2),
    ('Shopify', 'Shopify', 'ecommerce', 'Shopify', 3),
    ('Salesforce Commerce Cloud', 'Salesforce', 'ecommerce', 'Salesforce-Commerce-Cloud', 2),
    ('SAP Commerce Cloud', 'SAP', 'ecommerce', 'SAP-Commerce-Cloud', 2),
    ('Magento', 'Adobe', 'ecommerce', 'Magento', 3),
    ('BigCommerce', 'BigCommerce', 'ecommerce', 'BigCommerce', 3),
    ('Contentful', 'Contentful', 'cms', 'Contentful', 3),
    ('Sitecore', 'Sitecore', 'cms', 'Sitecore', 2)
ON CONFLICT (name) DO NOTHING;

-- Record this schema version
INSERT INTO core.migrations (name, source_table, target_table, rows_migrated)
VALUES ('init_schema_v3', 'N/A', 'all', 0)
ON CONFLICT (name) DO NOTHING;
"""

DROP_SCHEMA_SQL = """
-- Drop all tables (use with caution!)
DROP SCHEMA IF EXISTS jobs CASCADE;
DROP SCHEMA IF EXISTS intel CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;
"""

# =============================================================================
# Initialization Functions
# =============================================================================

async def check_database_connection(database_url: str) -> bool:
    """Check if we can connect to the database."""
    try:
        import asyncpg
        conn = await asyncpg.connect(database_url)
        await conn.close()
        return True
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        return False


async def init_database(database_url: str, drop_existing: bool = False, dry_run: bool = False):
    """Initialize the database with the schema."""
    import asyncpg

    logger.info(f"Connecting to database...")

    # Convert SQLAlchemy URL to asyncpg format if needed
    if database_url.startswith("postgresql+asyncpg://"):
        database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    try:
        conn = await asyncpg.connect(database_url)
        logger.info("Connected successfully")

        if drop_existing:
            if dry_run:
                logger.info("[DRY RUN] Would drop existing schema")
            else:
                logger.warning("Dropping existing schema...")
                await conn.execute(DROP_SCHEMA_SQL)
                logger.info("Schema dropped")

        if dry_run:
            logger.info("[DRY RUN] Would create schema")
            logger.info(f"SQL to execute:\n{SCHEMA_SQL[:500]}...")
        else:
            logger.info("Creating schema...")
            await conn.execute(SCHEMA_SQL)
            logger.info("Schema created successfully")

        # Verify tables were created
        tables = await conn.fetch("""
            SELECT schemaname, tablename
            FROM pg_tables
            WHERE schemaname IN ('core', 'intel', 'jobs')
            ORDER BY schemaname, tablename
        """)

        logger.info(f"\nCreated {len(tables)} tables:")
        for table in tables:
            logger.info(f"  {table['schemaname']}.{table['tablename']}")

        await conn.close()
        return True

    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        return False


def get_database_url() -> str:
    """Get database URL from environment."""
    url = os.getenv("DATABASE_URL")

    if not url:
        # Try to construct from individual vars
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
        description="Initialize PartnerForge database"
    )
    parser.add_argument(
        "--drop-existing",
        action="store_true",
        help="Drop existing schema before creating (DESTRUCTIVE)"
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
        logger.info("Set it with: export DATABASE_URL='postgresql://user:pass@host:5432/db'")
        sys.exit(1)

    # Mask password in log output
    safe_url = database_url
    if "@" in safe_url:
        parts = safe_url.split("@")
        creds = parts[0].rsplit(":", 1)
        if len(creds) == 2:
            safe_url = f"{creds[0]}:****@{parts[1]}"
    logger.info(f"Database URL: {safe_url}")

    if args.drop_existing and not args.dry_run:
        confirm = input("This will DROP ALL EXISTING DATA. Type 'yes' to confirm: ")
        if confirm.lower() != 'yes':
            logger.info("Aborted")
            sys.exit(0)

    success = asyncio.run(init_database(
        database_url,
        drop_existing=args.drop_existing,
        dry_run=args.dry_run
    ))

    if success:
        logger.info("\nDatabase initialization complete!")
        if not args.dry_run:
            logger.info("Run 'make db-seed' to populate with sample data")
    else:
        logger.error("\nDatabase initialization failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
