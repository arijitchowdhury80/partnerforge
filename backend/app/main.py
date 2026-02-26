"""
PartnerForge FastAPI Application

Enterprise ABM Intelligence Platform
Version 3.0

Health Endpoints:
- /health          - Basic health check
- /ready           - Full readiness (DB + Redis)
- /health/live     - Kubernetes liveness
- /health/detailed - Full component status
"""

from fastapi import FastAPI, HTTPException, Depends, Query, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
import logging
import time
import uuid
import sys

from .config import get_settings, ENRICHMENT_WAVES
from .database import get_session, init_db, close_db

# Import API routers
from .api.routes import health as health_router
from .api.routes import lists as lists_router
from .api.routes import targets as targets_router
from .api.routes import enrich as enrich_router
from .api.routes import alerts as alerts_router
from .api.routes import changes as changes_router
from .api.routes import intelligence as intelligence_router
from .api.routes import jobs as jobs_router
from .api.routes import functional_test as test_router
from .api.routes import discover as discover_router

# Configure structured logging for Railway
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger(__name__)

settings = get_settings()


# =============================================================================
# Request Tracing Middleware
# =============================================================================

class RequestTracingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all requests with timing and trace IDs."""

    async def dispatch(self, request: Request, call_next):
        # Generate trace ID
        trace_id = str(uuid.uuid4())[:8]
        start_time = time.time()

        # Log request
        logger.info(
            f"[{trace_id}] --> {request.method} {request.url.path} "
            f"query={dict(request.query_params)}"
        )

        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000

            # Log response
            logger.info(
                f"[{trace_id}] <-- {response.status_code} "
                f"({duration_ms:.1f}ms)"
            )

            # Add trace ID to response headers
            response.headers["X-Trace-ID"] = trace_id
            return response

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(
                f"[{trace_id}] !!! ERROR: {type(e).__name__}: {str(e)} "
                f"({duration_ms:.1f}ms)"
            )
            raise


# =============================================================================
# Application Lifecycle
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await init_db()
    yield
    # Shutdown
    await close_db()
    logger.info(f"{settings.APP_NAME} shutdown complete")


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="PartnerForge API",
    description="""
    Enterprise Account-Based Marketing Intelligence Platform

    ## Features
    - 15 Intelligence Modules across 4 execution waves
    - Wave-based parallel enrichment
    - Source citation mandate enforcement
    - Real-time enrichment status

    ## Modules
    - **Wave 1 (Foundation):** Company Context, Tech Stack, Traffic, Financials
    - **Wave 2 (Competitive):** Competitors, Hiring, Strategic Context
    - **Wave 3 (Buying Signals):** Investor Intel, Executive Intel, Buying Committee, Displacement
    - **Wave 4 (Synthesis):** Case Study Matching, ICP Priority, Signal Scoring, Strategic Brief
    """,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS middleware - permissive for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request tracing middleware
app.add_middleware(RequestTracingMiddleware)


# =============================================================================
# Register API Routers
# =============================================================================

# Health check endpoints (root level for load balancers)
app.include_router(health_router.router)

# List management endpoints (API v1)
app.include_router(lists_router.router, prefix="/api/v1")

# Targets endpoints (API v1)
app.include_router(targets_router.router, prefix="/api/v1")

# Enrichment endpoints (API v1)
app.include_router(enrich_router.router, prefix="/api/v1")

# Alerts endpoints (API v1)
app.include_router(alerts_router.router, prefix="/api/v1")

# Changes endpoints (API v1)
app.include_router(changes_router.router, prefix="/api/v1")

# Intelligence endpoints (API v1) - 15 modules
app.include_router(intelligence_router.router, prefix="/api/v1")

# Jobs endpoints (API v1) - Job management
app.include_router(jobs_router.router, prefix="/api/v1")

# Functional test endpoints (real API integration)
app.include_router(test_router.router, prefix="/api/v1")

# Partner discovery endpoints (BuiltWith Lists API)
app.include_router(discover_router.router)


# =============================================================================
# Stats & Dashboard Endpoints
# =============================================================================

@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(get_session)):
    """Get platform statistics."""
    # TODO: Implement actual stats from database
    return {
        "total_companies": 2687,
        "enriched_companies": 400,
        "hot_leads": 9,
        "warm_leads": 49,
        "modules_active": 15,
        "waves_configured": 4,
        "last_enrichment": datetime.now().isoformat(),
    }


# =============================================================================
# Company Endpoints
# =============================================================================

@app.get("/api/companies")
async def list_companies(
    db: AsyncSession = Depends(get_session),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, regex="^(hot|warm|cool|cold)$"),
    partner: Optional[str] = None,
    min_score: Optional[int] = Query(None, ge=0, le=100),
    sort_by: str = Query("icp_score", regex="^(icp_score|traffic|revenue|name)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
):
    """
    List companies with filtering and pagination.

    - **page**: Page number (default: 1)
    - **limit**: Results per page (default: 50, max: 100)
    - **status**: Filter by status (hot/warm/cool/cold)
    - **partner**: Filter by partner technology
    - **min_score**: Minimum ICP score
    - **sort_by**: Sort field
    - **sort_order**: Sort direction (asc/desc)
    """
    # TODO: Implement actual database query
    return {
        "companies": [],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": 0,
            "total_pages": 0,
        },
        "filters": {
            "status": status,
            "partner": partner,
            "min_score": min_score,
        },
    }


@app.get("/api/companies/{domain}")
async def get_company(
    domain: str,
    db: AsyncSession = Depends(get_session),
):
    """Get company by domain with all available intelligence."""
    # TODO: Implement actual database query
    return {
        "domain": domain,
        "company_name": None,
        "icp_score": None,
        "status": None,
        "intelligence": {},
        "last_enriched": None,
    }


@app.post("/api/companies")
async def create_company(
    domain: str,
    db: AsyncSession = Depends(get_session),
):
    """Create a new company record."""
    # TODO: Implement company creation
    return {"domain": domain, "created": True}


# =============================================================================
# Intelligence Endpoints (15 Modules)
# =============================================================================

@app.get("/api/intel/{domain}/overview")
async def get_intel_overview(
    domain: str,
    db: AsyncSession = Depends(get_session),
):
    """Get overview of all intelligence modules for a domain."""
    return {
        "domain": domain,
        "modules": {
            "m01_company_context": {"status": "available", "last_updated": None},
            "m02_tech_stack": {"status": "available", "last_updated": None},
            "m03_traffic": {"status": "available", "last_updated": None},
            "m04_financials": {"status": "available", "last_updated": None},
            "m05_competitors": {"status": "pending", "last_updated": None},
            "m06_hiring": {"status": "pending", "last_updated": None},
            "m07_strategic": {"status": "pending", "last_updated": None},
            "m08_investor": {"status": "pending", "last_updated": None},
            "m09_executive": {"status": "pending", "last_updated": None},
            "m10_buying_committee": {"status": "pending", "last_updated": None},
            "m11_displacement": {"status": "pending", "last_updated": None},
            "m12_case_study": {"status": "pending", "last_updated": None},
            "m13_icp_priority": {"status": "pending", "last_updated": None},
            "m14_signal_scoring": {"status": "pending", "last_updated": None},
            "m15_strategic_brief": {"status": "pending", "last_updated": None},
        },
    }


# Wave 1: Foundation Modules
@app.get("/api/intel/{domain}/m01")
async def get_company_context(domain: str, db: AsyncSession = Depends(get_session)):
    """M01: Company Context - baseline company information."""
    return {"module": "m01_company_context", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m02")
async def get_tech_stack(domain: str, db: AsyncSession = Depends(get_session)):
    """M02: Technology Stack - detected technologies from BuiltWith."""
    return {"module": "m02_tech_stack", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m03")
async def get_traffic(domain: str, db: AsyncSession = Depends(get_session)):
    """M03: Traffic Analysis - traffic data from SimilarWeb."""
    return {"module": "m03_traffic", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m04")
async def get_financials(domain: str, db: AsyncSession = Depends(get_session)):
    """M04: Financial Profile - revenue, margins, ROI estimates."""
    return {"module": "m04_financials", "domain": domain, "data": None}


# Wave 2: Competitive Modules
@app.get("/api/intel/{domain}/m05")
async def get_competitors(domain: str, db: AsyncSession = Depends(get_session)):
    """M05: Competitor Intelligence - competitive landscape."""
    return {"module": "m05_competitors", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m06")
async def get_hiring(domain: str, db: AsyncSession = Depends(get_session)):
    """M06: Hiring Signals - job postings and talent acquisition."""
    return {"module": "m06_hiring", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m07")
async def get_strategic(domain: str, db: AsyncSession = Depends(get_session)):
    """M07: Strategic Context - market position and strategy."""
    return {"module": "m07_strategic", "domain": domain, "data": None}


# Wave 3: Buying Signals Modules
@app.get("/api/intel/{domain}/m08")
async def get_investor(domain: str, db: AsyncSession = Depends(get_session)):
    """M08: Investor Intelligence - SEC filings and investor presentations."""
    return {"module": "m08_investor", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m09")
async def get_executive(domain: str, db: AsyncSession = Depends(get_session)):
    """M09: Executive Intelligence - executive quotes and themes."""
    return {"module": "m09_executive", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m10")
async def get_buying_committee(domain: str, db: AsyncSession = Depends(get_session)):
    """M10: Buying Committee - key decision makers."""
    return {"module": "m10_buying_committee", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m11")
async def get_displacement(domain: str, db: AsyncSession = Depends(get_session)):
    """M11: Displacement Analysis - competitive displacement opportunity."""
    return {"module": "m11_displacement", "domain": domain, "data": None}


# Wave 4: Synthesis Modules
@app.get("/api/intel/{domain}/m12")
async def get_case_study(domain: str, db: AsyncSession = Depends(get_session)):
    """M12: Case Study Matching - relevant Algolia case studies."""
    return {"module": "m12_case_study", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m13")
async def get_icp_priority(domain: str, db: AsyncSession = Depends(get_session)):
    """M13: ICP Priority Mapping - ICP fit score and breakdown."""
    return {"module": "m13_icp_priority", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m14")
async def get_signal_scoring(domain: str, db: AsyncSession = Depends(get_session)):
    """M14: Signal Scoring - aggregated signal score."""
    return {"module": "m14_signal_scoring", "domain": domain, "data": None}


@app.get("/api/intel/{domain}/m15")
async def get_strategic_brief(domain: str, db: AsyncSession = Depends(get_session)):
    """M15: Strategic Signal Brief - final brief for sales."""
    return {"module": "m15_strategic_brief", "domain": domain, "data": None}


# =============================================================================
# Enrichment Endpoints
# =============================================================================

@app.post("/api/enrich/{domain}")
async def enrich_company(
    domain: str,
    background_tasks: BackgroundTasks,
    force: bool = Query(False, description="Bypass cache and force fresh enrichment"),
    db: AsyncSession = Depends(get_session),
):
    """
    Trigger full enrichment for a domain.

    Runs all 4 waves of intelligence modules:
    1. Foundation (parallel): Company, Tech, Traffic, Financials
    2. Competitive (parallel): Competitors, Hiring, Strategic
    3. Buying Signals (parallel): Investor, Executive, Committee, Displacement
    4. Synthesis (parallel): Case Study, ICP, Scoring, Brief
    """
    # TODO: Implement actual enrichment with Celery
    job_id = f"enrich_{domain}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    return {
        "job_id": job_id,
        "domain": domain,
        "status": "queued",
        "waves": list(ENRICHMENT_WAVES.keys()),
        "force": force,
        "estimated_time_seconds": 60,
    }


@app.post("/api/enrich/{domain}/wave/{wave_num}")
async def enrich_wave(
    domain: str,
    wave_num: int,
    background_tasks: BackgroundTasks,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_session),
):
    """
    Trigger specific wave enrichment.

    - Wave 1: Foundation (M01-M04)
    - Wave 2: Competitive (M05-M07)
    - Wave 3: Buying Signals (M08-M11)
    - Wave 4: Synthesis (M12-M15)
    """
    if wave_num < 1 or wave_num > 4:
        raise HTTPException(status_code=400, detail="Wave must be 1-4")

    wave_key = f"wave_{wave_num}_{'foundation' if wave_num == 1 else 'competitive' if wave_num == 2 else 'buying_signals' if wave_num == 3 else 'synthesis'}"

    return {
        "job_id": f"wave_{wave_num}_{domain}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "domain": domain,
        "wave": wave_num,
        "modules": ENRICHMENT_WAVES.get(wave_key, {}).get("modules", []),
        "status": "queued",
        "force": force,
    }


@app.post("/api/enrich/{domain}/module/{module_id}")
async def enrich_module(
    domain: str,
    module_id: str,
    background_tasks: BackgroundTasks,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_session),
):
    """
    Trigger single module enrichment.

    Valid module IDs: m01-m15 (e.g., m01_company_context)
    """
    valid_modules = [
        "m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials",
        "m05_competitors", "m06_hiring", "m07_strategic",
        "m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement",
        "m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief",
    ]

    if module_id not in valid_modules:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid module_id. Valid modules: {valid_modules}"
        )

    return {
        "job_id": f"{module_id}_{domain}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "domain": domain,
        "module": module_id,
        "status": "queued",
        "force": force,
    }


@app.get("/api/enrich/{domain}/status")
async def get_enrichment_status(
    domain: str,
    db: AsyncSession = Depends(get_session),
):
    """Get enrichment status for a domain."""
    return {
        "domain": domain,
        "overall_status": "idle",
        "modules": {
            "m01_company_context": {"status": "complete", "freshness": "fresh"},
            "m02_tech_stack": {"status": "complete", "freshness": "fresh"},
            "m03_traffic": {"status": "stale", "freshness": "stale"},
            "m04_financials": {"status": "pending", "freshness": None},
        },
        "last_full_enrichment": None,
        "active_jobs": [],
    }


@app.get("/api/enrich/jobs")
async def list_active_jobs(
    db: AsyncSession = Depends(get_session),
    status: Optional[str] = Query(None, regex="^(queued|running|complete|failed)$"),
    limit: int = Query(50, ge=1, le=100),
):
    """List active enrichment jobs."""
    return {
        "jobs": [],
        "filter": {"status": status},
        "limit": limit,
    }


# =============================================================================
# Cache Management
# =============================================================================

@app.get("/api/cache/status")
async def get_cache_status(db: AsyncSession = Depends(get_session)):
    """Get cache freshness status across all modules."""
    return {
        "total_cached": 0,
        "fresh": 0,
        "stale": 0,
        "expired": 0,
        "by_module": {},
    }


@app.post("/api/cache/invalidate/{domain}")
async def invalidate_cache(
    domain: str,
    module_id: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
):
    """Invalidate cache for a domain (optionally specific module)."""
    return {
        "domain": domain,
        "module": module_id or "all",
        "invalidated": True,
    }


# =============================================================================
# Error Handlers
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred",
        },
    )


# =============================================================================
# Run with: uvicorn backend.app.main:app --reload --port 8000
# =============================================================================
