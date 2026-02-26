"""
Health Check API Endpoints

Provides health and status endpoints for monitoring and load balancers.

Endpoints:
- /health          - Basic health (always 200 if running)
- /ready           - Full readiness (DB + Redis check)
- /health/live     - Liveness (for Kubernetes)
- /health/ready    - Alias for /ready
- /health/detailed - Full component status
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
from typing import Optional
import logging
import time
import os

from ..deps import get_db
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])
settings = get_settings()


# =============================================================================
# Health Status Constants
# =============================================================================

class HealthStatus:
    """Health status constants."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


# =============================================================================
# Redis Client Helper
# =============================================================================

async def get_redis_client():
    """Get async Redis client."""
    try:
        import redis.asyncio as redis
        redis_url = settings.REDIS_URL
        client = redis.from_url(redis_url, decode_responses=True)
        return client
    except ImportError:
        logger.warning("redis package not installed")
        return None
    except Exception as e:
        logger.error(f"Failed to create Redis client: {e}")
        return None


# =============================================================================
# Health Check Endpoints
# =============================================================================

@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.

    Returns 200 if the service is running.
    Used by load balancers for quick health probes.

    Does NOT check dependencies - use /ready for that.
    """
    return {
        "status": HealthStatus.HEALTHY,
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@router.get("/ready")
async def readiness_check_root(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Full readiness check endpoint (root level).

    Verifies all required dependencies are available:
    - Database connection is working
    - Redis connection is working (if configured)

    Returns:
    - 200 if all checks pass
    - 503 if any critical check fails

    Use this endpoint for load balancer health checks that need
    to verify the service can actually handle requests.
    """
    checks = {
        "database": await _check_database(db),
        "redis": await _check_redis(),
    }

    # Database is critical
    db_healthy = checks["database"]["status"] == HealthStatus.HEALTHY

    # Redis is critical for production
    redis_healthy = checks["redis"]["status"] == HealthStatus.HEALTHY
    redis_optional = checks["redis"].get("optional", False)

    # Determine overall status
    if db_healthy and (redis_healthy or redis_optional):
        overall = HealthStatus.HEALTHY
        response.status_code = status.HTTP_200_OK
    elif db_healthy:
        overall = HealthStatus.DEGRADED
        response.status_code = status.HTTP_200_OK
    else:
        overall = HealthStatus.UNHEALTHY
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": overall,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@router.get("/health/ready")
async def readiness_check(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Readiness check endpoint (nested under /health).

    Alias for /ready - verifies the service can handle requests.
    """
    return await readiness_check_root(response, db)


@router.get("/health/live")
async def liveness_check():
    """
    Liveness check endpoint.

    Returns 200 if the service process is alive.
    Used by Kubernetes for restart decisions.

    This check is intentionally simple - if the process can
    respond, it's alive. Use /ready for dependency checks.
    """
    return {
        "status": HealthStatus.HEALTHY,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/health/detailed")
async def detailed_health_check(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Detailed health check with all component status.

    Includes:
    - Database status, driver, and latency
    - Redis status and latency
    - Configuration completeness
    - Environment information
    - Memory/resource info (if available)

    This endpoint is for debugging and monitoring dashboards,
    not for load balancer health checks.
    """
    checks = {
        "database": await _check_database(db),
        "redis": await _check_redis(),
        "configuration": _check_configuration(),
    }

    # Add memory info if available
    try:
        import psutil
        process = psutil.Process()
        checks["resources"] = {
            "status": HealthStatus.HEALTHY,
            "memory_mb": round(process.memory_info().rss / 1024 / 1024, 2),
            "cpu_percent": process.cpu_percent(),
            "threads": process.num_threads(),
        }
    except ImportError:
        checks["resources"] = {
            "status": HealthStatus.HEALTHY,
            "message": "psutil not installed, resource metrics unavailable",
        }
    except Exception as e:
        checks["resources"] = {
            "status": HealthStatus.DEGRADED,
            "error": str(e),
        }

    # Determine overall status
    statuses = [c["status"] for c in checks.values()]
    if all(s == HealthStatus.HEALTHY for s in statuses):
        overall = HealthStatus.HEALTHY
        response.status_code = status.HTTP_200_OK
    elif any(s == HealthStatus.UNHEALTHY for s in statuses):
        overall = HealthStatus.UNHEALTHY
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        overall = HealthStatus.DEGRADED
        response.status_code = status.HTTP_200_OK

    return {
        "status": overall,
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": "development" if settings.DEBUG else "production",
        "python_version": f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
        "checks": checks,
    }


# =============================================================================
# Component Check Functions
# =============================================================================

async def _check_database(db: AsyncSession) -> dict:
    """
    Check database connectivity and latency.

    Returns:
        dict with status, latency_ms, driver, and pool info
    """
    start = time.time()
    try:
        result = await db.execute(text("SELECT 1"))
        _ = result.scalar()
        latency_ms = (time.time() - start) * 1000

        response = {
            "status": HealthStatus.HEALTHY,
            "latency_ms": round(latency_ms, 2),
            "driver": "sqlite" if settings.is_sqlite else "postgresql",
        }

        # Add pool info for PostgreSQL
        if not settings.is_sqlite:
            response["pool_size"] = settings.DATABASE_POOL_SIZE
            response["max_overflow"] = settings.DATABASE_MAX_OVERFLOW

        return response

    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": HealthStatus.UNHEALTHY,
            "error": str(e),
            "latency_ms": round((time.time() - start) * 1000, 2),
        }


async def _check_redis() -> dict:
    """
    Check Redis connectivity and latency.

    Returns:
        dict with status, latency_ms, and connection info
    """
    start = time.time()

    # Check if Redis is configured
    if not settings.REDIS_URL or settings.REDIS_URL == "redis://localhost:6379/0":
        # In development, Redis might not be required
        if settings.DEBUG:
            return {
                "status": HealthStatus.HEALTHY,
                "message": "Redis not configured (optional in development)",
                "optional": True,
            }

    try:
        import redis.asyncio as redis

        client = redis.from_url(settings.REDIS_URL, decode_responses=True)

        # Ping Redis
        await client.ping()
        latency_ms = (time.time() - start) * 1000

        # Get Redis info
        info = await client.info("server")
        await client.close()

        return {
            "status": HealthStatus.HEALTHY,
            "latency_ms": round(latency_ms, 2),
            "redis_version": info.get("redis_version", "unknown"),
            "connected_clients": info.get("connected_clients", "unknown"),
        }

    except ImportError:
        logger.warning("redis package not installed")
        return {
            "status": HealthStatus.DEGRADED,
            "message": "redis package not installed",
            "optional": settings.DEBUG,
        }

    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return {
            "status": HealthStatus.UNHEALTHY,
            "error": str(e),
            "latency_ms": round((time.time() - start) * 1000, 2),
            "optional": settings.DEBUG,
        }


def _check_configuration() -> dict:
    """
    Check configuration completeness.

    Verifies that all required configuration is present.
    API keys are considered optional but reported if missing.
    """
    missing_required = []
    missing_optional = []

    # Check required settings
    if not settings.DATABASE_URL:
        missing_required.append("DATABASE_URL")

    # Check optional API keys
    if not settings.BUILTWITH_API_KEY:
        missing_optional.append("BUILTWITH_API_KEY")
    if not settings.SIMILARWEB_API_KEY:
        missing_optional.append("SIMILARWEB_API_KEY")

    if missing_required:
        return {
            "status": HealthStatus.UNHEALTHY,
            "message": f"Missing required configuration: {missing_required}",
            "missing_required": missing_required,
            "missing_optional": missing_optional,
        }

    if missing_optional:
        return {
            "status": HealthStatus.DEGRADED,
            "message": f"Missing optional API keys: {missing_optional}",
            "missing_optional": missing_optional,
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
    Useful for debugging and client version compatibility checks.
    """
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "api_version": "v1",
        "supported_api_versions": ["v1"],
        "build_date": os.getenv("BUILD_DATE", "unknown"),
        "git_commit": os.getenv("GIT_COMMIT", "unknown"),
    }


# =============================================================================
# Metrics Endpoint (for Prometheus/monitoring)
# =============================================================================

@router.get("/metrics")
async def get_metrics():
    """
    Basic metrics endpoint.

    Returns key metrics for monitoring systems.
    For full Prometheus metrics, integrate with prometheus-fastapi-instrumentator.
    """
    try:
        import psutil
        process = psutil.Process()

        return {
            "uptime_seconds": time.time() - process.create_time(),
            "memory_bytes": process.memory_info().rss,
            "cpu_percent": process.cpu_percent(),
            "threads": process.num_threads(),
            "open_files": len(process.open_files()),
        }
    except ImportError:
        return {
            "message": "psutil not installed, metrics unavailable",
        }
    except Exception as e:
        return {
            "error": str(e),
        }
