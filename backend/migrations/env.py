"""
Alembic Migration Environment

Configures async migrations for PartnerForge.
Supports both SQLite (development) and PostgreSQL (production).
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Add the backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the database Base and all models
from app.database import Base
from app.config import get_settings

# Import all models to ensure they're registered with Base.metadata
from app.models import (
    # Core
    Company, Technology, CompanyTechnology, CustomerLogo,
    # Targets
    DisplacementTarget, CompetitiveIntel,
    # Evidence
    CaseStudy, CustomerQuote, ProofPoint, VerifiedCaseStudy,
    # Enrichment
    CompanyFinancials, ExecutiveQuote, HiringSignal,
    StrategicTrigger, BuyingCommittee, EnrichmentStatus,
    # Intelligence modules (15)
    IntelCompanyContext, IntelTechnologyStack, IntelTrafficAnalysis, IntelFinancialProfile,
    IntelCompetitorIntelligence, IntelHiringSignals, IntelStrategicContext,
    IntelInvestorIntelligence, IntelExecutiveIntelligence, IntelBuyingCommittee, IntelDisplacementAnalysis,
    IntelCaseStudyMatches, IntelICPPriorityMapping, IntelSignalScoring, IntelStrategicSignalBrief,
    # Versioning
    IntelSnapshot, ChangeEvent, SnapshotComparison,
    # Alerts
    AlertRule, Alert, AlertDigest, AlertPreference,
    # Platform
    User, Team, Territory, AccountAssignment, APIUsage, APIBudget, APICostConfig, AuditLog, SystemMetric, JobExecution,
    # Lists
    UploadedList, UploadedListItem, ListProcessingQueue,
)

# This is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate' support
target_metadata = Base.metadata

# Get settings for database configuration
settings = get_settings()


def get_url() -> str:
    """
    Get the database URL for migrations.

    Priority:
    1. DATABASE_URL environment variable
    2. sqlalchemy.url in alembic.ini
    3. Default from settings
    """
    # Try environment variable first
    url = os.environ.get("DATABASE_URL")
    if url:
        # Handle Railway/Heroku postgres:// URLs
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    # Try alembic.ini config
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url

    # Fall back to settings
    return settings.DATABASE_URL


def get_async_url() -> str:
    """
    Convert a synchronous database URL to async format.

    - postgresql:// -> postgresql+asyncpg://
    - sqlite:// -> sqlite+aiosqlite://
    """
    url = get_url()

    # PostgreSQL
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)

    # SQLite
    if url.startswith("sqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)

    return url


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine,
    though an Engine is acceptable here as well. By skipping the Engine
    creation we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """
    Run migrations in a connection context.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        # PostgreSQL-specific settings
        include_schemas=True,
        # Handle UUID and JSONB columns correctly
        render_as_batch=False,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    Run migrations in 'online' mode using async engine.

    Creates an Engine and associates a connection with the context.
    """
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_async_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    Uses asyncio to run async migrations.
    """
    asyncio.run(run_async_migrations())


# Determine which mode to run in
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
