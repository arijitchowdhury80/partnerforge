"""
PartnerForge FastAPI Backend

REST API for the PartnerForge Partner Intelligence Platform.
Provides endpoints for company data retrieval and enrichment.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional
import logging

from .config import CORS_ORIGINS
from .enrichment import (
    get_company_by_domain,
    enrich_company,
    get_all_targets,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="PartnerForge API",
    description="Partner Intelligence Platform API for Algolia Sales",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "PartnerForge API",
        "version": "1.0.0",
    }


@app.get("/api/company/{domain}")
async def get_company(domain: str):
    """
    Get company data by domain.

    If the company is not enriched or enrichment is stale,
    returns basic data with a flag indicating enrichment is needed.

    Args:
        domain: Company domain (e.g., 'huawei.com')

    Returns:
        Company data including ICP scoring, traffic metrics, and enrichment status
    """
    # Normalize domain
    domain = domain.lower().strip()

    logger.info(f"Fetching company data for: {domain}")

    company = get_company_by_domain(domain)

    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company with domain '{domain}' not found in database"
        )

    # Add enrichment status flags
    company["needs_enrichment"] = company.get("enrichment_level") != "full"
    company["is_stale"] = company.get("last_enriched") is None

    return {
        "success": True,
        "company": company,
    }


@app.post("/api/enrich/{domain}")
async def enrich_company_endpoint(
    domain: str,
    force: bool = Query(default=False, description="Force refresh even if data is fresh"),
):
    """
    Trigger enrichment for a company.

    Fetches fresh data from:
    - BuiltWith (technology stack)
    - SimilarWeb (traffic metrics)
    - Yahoo Finance (financial data, if ticker is known)

    Args:
        domain: Company domain (e.g., 'huawei.com')
        force: If True, refresh even if cached data is still fresh

    Returns:
        Enrichment results including fetched data and any errors
    """
    # Normalize domain
    domain = domain.lower().strip()

    logger.info(f"Enriching company: {domain} (force={force})")

    result = enrich_company(domain, force=force)

    if result["status"] == "not_found":
        raise HTTPException(
            status_code=404,
            detail=f"Company with domain '{domain}' not found in database"
        )

    # Return appropriate response based on status
    if result["status"] == "success":
        return {
            "success": True,
            "message": "Enrichment completed successfully",
            "result": result,
        }
    elif result["status"] == "cached":
        return {
            "success": True,
            "message": "Data is still fresh (cached)",
            "cached": True,
            "result": result,
        }
    else:
        # Partial success
        return JSONResponse(
            status_code=207,
            content={
                "success": False,
                "message": "Enrichment partially completed",
                "errors": result["errors"],
                "result": result,
            }
        )


@app.get("/api/targets")
async def list_targets(
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=50, ge=1, le=200, description="Items per page"),
    tier: Optional[int] = Query(default=None, ge=1, le=3, description="Filter by ICP tier"),
    score_min: Optional[int] = Query(default=None, ge=0, le=100, description="Minimum ICP score"),
    score_max: Optional[int] = Query(default=None, ge=0, le=100, description="Maximum ICP score"),
    search: Optional[str] = Query(default=None, description="Search by company name or domain"),
):
    """
    List all displacement targets with pagination and filters.

    Args:
        page: Page number (starts at 1)
        per_page: Number of items per page (max 200)
        tier: Filter by ICP tier (1=Commerce, 2=Content, 3=Internal Support)
        score_min: Minimum ICP score filter
        score_max: Maximum ICP score filter
        search: Search query for company name or domain

    Returns:
        Paginated list of targets with metadata
    """
    logger.info(f"Listing targets: page={page}, per_page={per_page}, tier={tier}, search={search}")

    result = get_all_targets(
        page=page,
        per_page=per_page,
        tier_filter=tier,
        score_min=score_min,
        score_max=score_max,
        search=search,
    )

    return {
        "success": True,
        **result,
    }


@app.get("/api/stats")
async def get_stats():
    """
    Get summary statistics for the displacement targets.

    Returns:
        Counts by tier, score ranges, and enrichment status
    """
    from .enrichment import get_db_connection

    conn = get_db_connection()
    cursor = conn.cursor()

    # Total count
    cursor.execute("SELECT COUNT(*) as total FROM displacement_targets")
    total = cursor.fetchone()["total"]

    # Count by tier
    cursor.execute("""
        SELECT icp_tier, COUNT(*) as count
        FROM displacement_targets
        GROUP BY icp_tier
        ORDER BY icp_tier
    """)
    by_tier = {row["icp_tier"]: row["count"] for row in cursor.fetchall()}

    # Count by score range
    cursor.execute("""
        SELECT
            SUM(CASE WHEN icp_score >= 80 THEN 1 ELSE 0 END) as hot,
            SUM(CASE WHEN icp_score >= 60 AND icp_score < 80 THEN 1 ELSE 0 END) as warm,
            SUM(CASE WHEN icp_score >= 40 AND icp_score < 60 THEN 1 ELSE 0 END) as cool,
            SUM(CASE WHEN icp_score < 40 THEN 1 ELSE 0 END) as cold
        FROM displacement_targets
    """)
    score_row = cursor.fetchone()
    by_score = {
        "hot": score_row["hot"] or 0,
        "warm": score_row["warm"] or 0,
        "cool": score_row["cool"] or 0,
        "cold": score_row["cold"] or 0,
    }

    # Count enriched
    cursor.execute("""
        SELECT COUNT(*) as enriched
        FROM displacement_targets
        WHERE enrichment_level = 'full'
    """)
    enriched = cursor.fetchone()["enriched"]

    conn.close()

    return {
        "success": True,
        "stats": {
            "total": total,
            "by_tier": by_tier,
            "by_score": by_score,
            "enriched": enriched,
            "not_enriched": total - enriched,
        }
    }


# Error handlers
@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc),
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
