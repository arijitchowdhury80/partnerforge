"""
PartnerForge Database Configuration

Dual-driver support:
- SQLite + aiosqlite (development)
- PostgreSQL + asyncpg (production)

Implements connection pooling and health checks.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text, event
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging
import os

from .config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def get_async_database_url() -> str:
    """
    Get async-compatible database URL.

    Handles:
    - sqlite:// → sqlite+aiosqlite://
    - postgres:// → postgresql+asyncpg://
    - postgresql:// → postgresql+asyncpg://
    """
    url = settings.DATABASE_URL

    # SQLite handling
    if url.startswith("sqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    if url.startswith("sqlite+aiosqlite://"):
        return url

    # PostgreSQL handling
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql+asyncpg://"):
        return url

    # Already correct format
    return url


def ensure_data_directory():
    """Ensure the data directory exists for SQLite database."""
    if settings.is_sqlite:
        url = settings.DATABASE_URL
        if ":///" in url:
            path = url.split(":///")[1]
            if not os.path.isabs(path):
                path = os.path.join(os.getcwd(), path)
            directory = os.path.dirname(path)
            if directory and not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
                logger.info(f"Created data directory: {directory}")


# Ensure data directory exists before engine creation
ensure_data_directory()


def get_engine_kwargs() -> dict:
    """Get engine configuration based on database type."""
    if settings.is_sqlite:
        return {
            "echo": settings.DEBUG,
            # SQLite-specific: enable foreign keys
            "connect_args": {"check_same_thread": False},
        }
    else:
        return {
            "pool_size": settings.DATABASE_POOL_SIZE,
            "max_overflow": settings.DATABASE_MAX_OVERFLOW,
            "pool_pre_ping": True,  # Enable connection health checks
            "echo": settings.DEBUG,
        }


# Create async engine
engine = create_async_engine(
    get_async_database_url(),
    **get_engine_kwargs(),
)


# Enable foreign keys for SQLite
if settings.is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database sessions.

    Usage:
        @router.get("/companies")
        async def get_companies(db: AsyncSession = Depends(get_session)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for database sessions.

    Usage:
        async with get_db_context() as db:
            result = await db.execute(query)
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def check_database_health() -> dict:
    """
    Check database connectivity and return status.

    Returns:
        dict with status, latency, and connection pool info
    """
    import time

    try:
        start = time.time()
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        latency = (time.time() - start) * 1000  # ms

        result = {
            "status": "healthy",
            "latency_ms": round(latency, 2),
            "driver": "sqlite" if settings.is_sqlite else "postgresql",
        }

        if not settings.is_sqlite:
            result["pool_size"] = settings.DATABASE_POOL_SIZE
            result["max_overflow"] = settings.DATABASE_MAX_OVERFLOW

        return result

    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
        }


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info(f"Database tables initialized (driver: {'sqlite' if settings.is_sqlite else 'postgresql'})")


async def close_db():
    """Close database connections."""
    await engine.dispose()
    logger.info("Database connections closed")


def get_database_path() -> str:
    """
    Get the path to the SQLite database file.
    Only relevant for SQLite databases.
    """
    if not settings.is_sqlite:
        return ""

    url = settings.DATABASE_URL
    # Extract path from sqlite:///path or sqlite+aiosqlite:///path
    if ":///" in url:
        path = url.split(":///")[1]
        # Handle relative paths
        if not os.path.isabs(path):
            # Assume relative to project root (one level up from backend/app)
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            path = os.path.join(project_root, path)
        return path
    return ""
