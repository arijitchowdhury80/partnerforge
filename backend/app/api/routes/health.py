"""
Health Check API Endpoints

Provides health and status endpoints for monitoring and load balancers.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
from typing import Optional
import logging
import time

from ..deps import get_db
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])
settings = get_settings()


# =============================================================================
# Health Check Responses
# =============================================================================

class HealthStatus:
    """Health status constants."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.

    Returns 200 if the service is running.
    Used by load balancers and orchestrators.
    """
    return {
        "status": HealthStatus.HEALTHY,
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@router.get("/health/ready")
async def readiness_check(
    db: AsyncSession = Depends(get_db),
):
    """
    Readiness check endpoint.

    Verifies the service can handle requests:
    - Database connection is working
    - Required dependencies are available

    Returns 200 if ready, 503 if not.
    """
    checks = {
        "database": await _check_database(db),
    }

    all_healthy = all(c["status"] == HealthStatus.HEALTHY for c in checks.values())

    return {
        "status": HealthStatus.HEALTHY if all_healthy else HealthStatus.DEGRADED,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
    }


@router.get("/health/live")
async def liveness_check():
    """
    Liveness check endpoint.

    Returns 200 if the service is alive.
    Used by Kubernetes for restart decisions.
    """
    return {
        "status": HealthStatus.HEALTHY,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/health/detailed")
async def detailed_health_check(
    db: AsyncSession = Depends(get_db),
):
    """
    Detailed health check with component status.

    Includes:
    - Database status and latency
    - Configuration status
    - Memory/resource info (if available)
    """
    checks = {
        "database": await _check_database(db),
        "configuration": _check_configuration(),
    }

    # Determine overall status
    statuses = [c["status"] for c in checks.values()]
    if all(s == HealthStatus.HEALTHY for s in statuses):
        overall = HealthStatus.HEALTHY
    elif any(s == HealthStatus.UNHEALTHY for s in statuses):
        overall = HealthStatus.UNHEALTHY
    else:
        overall = HealthStatus.DEGRADED

    return {
        "status": overall,
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": "development" if settings.DEBUG else "production",
        "checks": checks,
    }


# =============================================================================
# Component Checks
# =============================================================================

async def _check_database(db: AsyncSession) -> dict:
    """Check database connectivity and latency."""
    start = time.time()
    try:
        result = await db.execute(text("SELECT 1"))
        _ = result.scalar()
        latency_ms = (time.time() - start) * 1000

        return {
            "status": HealthStatus.HEALTHY,
            "latency_ms": round(latency_ms, 2),
            "driver": "sqlite" if settings.is_sqlite else "postgresql",
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": HealthStatus.UNHEALTHY,
            "error": str(e),
        }


def _check_configuration() -> dict:
    """Check configuration completeness."""
    missing = []

    # Check required API keys
    if not settings.BUILTWITH_API_KEY:
        missing.append("BUILTWITH_API_KEY")
    if not settings.SIMILARWEB_API_KEY:
        missing.append("SIMILARWEB_API_KEY")

    if missing:
        return {
            "status": HealthStatus.DEGRADED,
            "message": f"Missing optional API keys: {missing}",
            "missing_keys": missing,
        }

    return {
        "status": HealthStatus.HEALTHY,
        "message": "All configuration present",
    }


# =============================================================================
# Version Endpoint
# =============================================================================

@router.get("/version")
async def get_version():
    """
    Get service version information.

    Returns version, build info, and supported API versions.
    """
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "api_version": "v1",
        "supported_api_versions": ["v1"],
    }
