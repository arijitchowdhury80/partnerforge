"""
Partner Discovery API Routes

Discover companies using specific partner technologies via BuiltWith Lists API.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import aiohttp
import logging

from ...database import get_session
from ...config import get_settings

router = APIRouter(prefix="/api/v1/discover", tags=["discovery"])
logger = logging.getLogger(__name__)
settings = get_settings()


# =============================================================================
# Models
# =============================================================================

class DiscoveryRequest(BaseModel):
    """Request to discover companies using a technology."""
    technology: str = Field(..., description="Technology name (e.g., 'Adobe Experience Manager')")
    amount: int = Field(default=100, ge=1, le=1000, description="Number of results to fetch")
    country: Optional[str] = Field(None, description="Filter by country code (e.g., 'US')")


class DiscoveredCompany(BaseModel):
    """A company discovered from BuiltWith."""
    domain: str
    country: Optional[str] = None
    first_indexed: Optional[str] = None
    last_indexed: Optional[str] = None


class DiscoveryResponse(BaseModel):
    """Response from discovery operation."""
    technology: str
    total_found: int
    new_added: int
    duplicates_skipped: int
    companies: List[DiscoveredCompany]


# =============================================================================
# Partner Technology Mappings
# =============================================================================

PARTNER_TECHNOLOGIES = {
    "adobe": "Adobe Experience Manager",
    "aem": "Adobe Experience Manager",
    "shopify": "Shopify",
    "salesforce": "Salesforce Commerce Cloud",
    "sfcc": "Salesforce Commerce Cloud",
    "bigcommerce": "BigCommerce",
    "magento": "Magento",
    "commercetools": "commercetools",
    "vtex": "VTEX",
    "sap": "SAP Commerce Cloud",
    "hybris": "SAP Commerce Cloud",
    "oracle": "Oracle Commerce Cloud",
    "elastic": "Elasticsearch",
    "algolia": "Algolia",
}


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/partners")
async def list_partners():
    """List available partner technologies for discovery."""
    return {
        "partners": [
            {"key": "adobe", "name": "Adobe Experience Manager", "description": "Adobe's enterprise CMS"},
            {"key": "shopify", "name": "Shopify", "description": "E-commerce platform"},
            {"key": "salesforce", "name": "Salesforce Commerce Cloud", "description": "Enterprise e-commerce"},
            {"key": "bigcommerce", "name": "BigCommerce", "description": "E-commerce platform"},
            {"key": "magento", "name": "Magento", "description": "Adobe Commerce"},
            {"key": "commercetools", "name": "commercetools", "description": "Headless commerce"},
            {"key": "vtex", "name": "VTEX", "description": "E-commerce platform"},
            {"key": "sap", "name": "SAP Commerce Cloud", "description": "Enterprise commerce"},
            {"key": "elastic", "name": "Elasticsearch", "description": "Search engine (competitor)"},
        ]
    }


@router.get("/test/{partner}")
async def test_discovery(
    partner: str,
    amount: int = Query(default=5, ge=1, le=10, description="Number of test results"),
):
    """
    Test discovery for a partner without saving to database.
    Limited to 10 results to conserve API credits.
    """
    # Resolve technology name
    technology = PARTNER_TECHNOLOGIES.get(partner.lower())
    if not technology:
        technology = partner  # Use as-is if not in mapping

    # Check API key
    if not settings.BUILTWITH_API_KEY:
        raise HTTPException(status_code=500, detail="BUILTWITH_API_KEY not configured")

    # Call BuiltWith Lists API
    url = "https://api.builtwith.com/lists5/api.json"
    params = {
        "KEY": settings.BUILTWITH_API_KEY,
        "TECH": technology,
        "AMOUNT": amount,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BuiltWith API error: {str(e)}")

    if "Errors" in data:
        raise HTTPException(status_code=400, detail=f"BuiltWith error: {data['Errors']}")

    results = data.get("Results", [])
    companies = []
    for r in results:
        companies.append(DiscoveredCompany(
            domain=r.get("D", ""),
            country=r.get("Country"),
            first_indexed=str(r.get("FI")) if r.get("FI") else None,
            last_indexed=str(r.get("LI")) if r.get("LI") else None,
        ))

    return {
        "technology": technology,
        "total_in_response": len(results),
        "companies": companies,
        "note": "This is a test - no data was saved to database",
    }


@router.post("/{partner}")
async def discover_partner_targets(
    partner: str,
    amount: int = Query(default=100, ge=1, le=1000, description="Number of results to fetch"),
    db: AsyncSession = Depends(get_session),
):
    """
    Discover companies using a partner technology and save to database.

    - **partner**: Partner key (adobe, shopify, salesforce, etc.) or full technology name
    - **amount**: Number of companies to fetch (1-1000)
    """
    # Resolve technology name
    technology = PARTNER_TECHNOLOGIES.get(partner.lower())
    if not technology:
        technology = partner  # Use as-is if not in mapping

    # Check API key
    if not settings.BUILTWITH_API_KEY:
        raise HTTPException(status_code=500, detail="BUILTWITH_API_KEY not configured")

    # Call BuiltWith Lists API
    url = "https://api.builtwith.com/lists5/api.json"
    params = {
        "KEY": settings.BUILTWITH_API_KEY,
        "TECH": technology,
        "AMOUNT": amount,
    }

    logger.info(f"Discovering {amount} companies using {technology}")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BuiltWith API error: {str(e)}")

    if "Errors" in data:
        raise HTTPException(status_code=400, detail=f"BuiltWith error: {data['Errors']}")

    results = data.get("Results", [])
    logger.info(f"Got {len(results)} results from BuiltWith")

    # Insert into displacement_targets table
    new_added = 0
    duplicates_skipped = 0
    companies = []

    for r in results:
        domain = r.get("D", "")
        if not domain:
            continue

        country = r.get("Country", "")

        # Check if already exists
        check_sql = text("SELECT id FROM displacement_targets WHERE domain = :domain")
        result = await db.execute(check_sql, {"domain": domain})
        existing = result.fetchone()

        if existing:
            duplicates_skipped += 1
        else:
            # Insert new target
            insert_sql = text("""
                INSERT INTO displacement_targets (
                    domain, company_name, partner_tech, country,
                    icp_score, enrichment_level, created_at
                ) VALUES (
                    :domain, :company_name, :partner_tech, :country,
                    50, 'none', :created_at
                )
            """)
            await db.execute(insert_sql, {
                "domain": domain,
                "company_name": domain.split('.')[0].title(),  # Basic company name from domain
                "partner_tech": technology,
                "country": country,
                "created_at": datetime.utcnow().isoformat(),
            })
            new_added += 1

        companies.append(DiscoveredCompany(
            domain=domain,
            country=country if country else None,
        ))

    await db.commit()

    logger.info(f"Discovery complete: {new_added} new, {duplicates_skipped} duplicates")

    return DiscoveryResponse(
        technology=technology,
        total_found=len(results),
        new_added=new_added,
        duplicates_skipped=duplicates_skipped,
        companies=companies[:50],  # Return first 50 for response size
    )


@router.delete("/clear/{partner}")
async def clear_partner_targets(
    partner: str,
    confirm: bool = Query(default=False, description="Set to true to confirm deletion"),
    db: AsyncSession = Depends(get_session),
):
    """
    Clear all targets for a specific partner technology.
    Requires confirm=true to execute.
    """
    if not confirm:
        raise HTTPException(status_code=400, detail="Set confirm=true to delete targets")

    # Resolve technology name
    technology = PARTNER_TECHNOLOGIES.get(partner.lower())
    if not technology:
        technology = partner

    # Count before delete
    count_sql = text("SELECT COUNT(*) FROM displacement_targets WHERE partner_tech = :tech")
    result = await db.execute(count_sql, {"tech": technology})
    count = result.scalar()

    # Delete
    delete_sql = text("DELETE FROM displacement_targets WHERE partner_tech = :tech")
    await db.execute(delete_sql, {"tech": technology})
    await db.commit()

    return {
        "deleted": count,
        "technology": technology,
        "message": f"Deleted {count} targets for {technology}",
    }
