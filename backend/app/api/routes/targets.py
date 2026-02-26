"""
Targets API Endpoints

Displacement targets CRUD, search, filtering, and statistics endpoints.

Endpoints:
- GET  /api/v1/targets              - List targets with pagination/filtering
- GET  /api/v1/targets/stats        - Aggregate statistics
- GET  /api/v1/targets/{domain}     - Get single target details
- POST /api/v1/targets/search       - Search targets by domain list
- PUT  /api/v1/targets/{domain}/status - Update target status/ICP score
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, or_, and_
from sqlalchemy.sql import text
from datetime import datetime
from typing import Optional, List
import logging
import json

from ..deps import get_db, get_current_user, get_pagination, CurrentUser, PaginationParams
from ..schemas.targets import (
    # Enums
    TargetStatus,
    SortField,
    SortOrder,
    EnrichmentLevel,
    # Response schemas
    TargetSummary,
    TargetResponse,
    TargetListResponse,
    PaginationMeta,
    # Search schemas
    TargetSearchRequest,
    TargetSearchResponse,
    # Status update schemas
    TargetStatusUpdate,
    TargetStatusUpdateResponse,
    # Stats schemas
    TargetStats,
    StatusBreakdown,
    VerticalBreakdown,
    PartnerTechBreakdown,
)
from ...models import DisplacementTarget, CompetitiveIntel
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/targets", tags=["Targets"])
settings = get_settings()


# =============================================================================
# Helper Functions
# =============================================================================

def compute_status_from_score(icp_score: Optional[int]) -> TargetStatus:
    """Compute lead status from ICP score."""
    if icp_score is None:
        return TargetStatus.UNSCORED
    if icp_score >= 80:
        return TargetStatus.HOT
    if icp_score >= 60:
        return TargetStatus.WARM
    if icp_score >= 40:
        return TargetStatus.COOL
    return TargetStatus.COLD


def parse_json_field(value: Optional[str]) -> Optional[List]:
    """Parse JSON string field to list."""
    if value is None:
        return None
    if isinstance(value, list):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def target_to_summary(target: DisplacementTarget) -> TargetSummary:
    """Convert DisplacementTarget model to TargetSummary schema."""
    return TargetSummary(
        id=target.id,
        domain=target.domain,
        company_name=target.company_name,
        partner_tech=target.partner_tech,
        vertical=target.vertical,
        country=target.country,
        icp_score=target.icp_score,
        icp_tier_name=target.icp_tier_name,
        sw_monthly_visits=target.sw_monthly_visits,
        revenue=target.revenue,
        current_search=target.current_search,
        enrichment_level=target.enrichment_level,
        last_enriched=target.last_enriched,
        created_at=target.created_at,
    )


def target_to_response(target: DisplacementTarget) -> TargetResponse:
    """Convert DisplacementTarget model to TargetResponse schema."""
    return TargetResponse(
        id=target.id,
        domain=target.domain,
        company_name=target.company_name,
        partner_tech=target.partner_tech,
        vertical=target.vertical,
        country=target.country,
        city=target.city,
        state=target.state,
        tech_spend=target.tech_spend,
        emails=parse_json_field(target.emails),
        phones=parse_json_field(target.phones),
        socials=parse_json_field(target.socials),
        exec_titles=parse_json_field(target.exec_titles),
        sw_monthly_visits=target.sw_monthly_visits,
        sw_bounce_rate=target.sw_bounce_rate,
        sw_pages_per_visit=target.sw_pages_per_visit,
        sw_avg_duration=target.sw_avg_duration,
        sw_search_traffic_pct=target.sw_search_traffic_pct,
        sw_rank_global=target.sw_rank_global,
        icp_tier=target.icp_tier,
        icp_score=target.icp_score,
        icp_tier_name=target.icp_tier_name,
        score_reasons=parse_json_field(target.score_reasons),
        score_breakdown=json.loads(target.score_breakdown) if target.score_breakdown else None,
        ticker=target.ticker,
        is_public=target.is_public or False,
        revenue=target.revenue,
        gross_margin=target.gross_margin,
        traffic_growth=target.traffic_growth,
        current_search=target.current_search,
        matched_case_studies=parse_json_field(target.matched_case_studies),
        lead_score=target.lead_score,
        trigger_events=parse_json_field(target.trigger_events),
        exec_quote=target.exec_quote,
        exec_name=target.exec_name,
        exec_title=target.exec_title,
        quote_source=target.quote_source,
        competitors_using_algolia=parse_json_field(target.competitors_using_algolia),
        displacement_angle=target.displacement_angle,
        enrichment_level=target.enrichment_level,
        last_enriched=target.last_enriched,
        created_at=target.created_at,
    )


# =============================================================================
# List Targets Endpoint
# =============================================================================

@router.get("", response_model=TargetListResponse)
async def list_targets(
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    # Filtering
    status: Optional[str] = Query(
        None,
        description="Filter by status (hot/warm/cool/cold/unscored)",
        regex="^(hot|warm|cool|cold|unscored)$"
    ),
    vertical: Optional[str] = Query(None, description="Filter by industry vertical"),
    partner_tech: Optional[str] = Query(None, description="Filter by partner technology"),
    country: Optional[str] = Query(None, description="Filter by country"),
    min_score: Optional[int] = Query(None, ge=0, le=100, description="Minimum ICP score"),
    max_score: Optional[int] = Query(None, ge=0, le=100, description="Maximum ICP score"),
    min_traffic: Optional[int] = Query(None, ge=0, description="Minimum monthly traffic"),
    is_public: Optional[bool] = Query(None, description="Filter public companies only"),
    enrichment_level: Optional[str] = Query(
        None,
        description="Filter by enrichment level",
        regex="^(basic|standard|full)$"
    ),
    search: Optional[str] = Query(None, min_length=2, description="Search in domain/company name"),
    # Sorting
    sort_by: str = Query(
        "icp_score",
        description="Sort field",
        regex="^(icp_score|company_name|domain|sw_monthly_visits|revenue|created_at|last_enriched)$"
    ),
    sort_order: str = Query("desc", description="Sort order", regex="^(asc|desc)$"),
    # Database
    db: AsyncSession = Depends(get_db),
):
    """
    List displacement targets with pagination, filtering, and sorting.

    **Filters:**
    - `status`: Filter by lead status (hot/warm/cool/cold/unscored)
    - `vertical`: Filter by industry vertical
    - `partner_tech`: Filter by partner technology (e.g., Adobe AEM)
    - `country`: Filter by country
    - `min_score`/`max_score`: Filter by ICP score range
    - `min_traffic`: Filter by minimum monthly traffic
    - `is_public`: Filter publicly traded companies
    - `enrichment_level`: Filter by enrichment level
    - `search`: Search in domain and company name

    **Sorting:**
    - `sort_by`: Field to sort by (default: icp_score)
    - `sort_order`: asc or desc (default: desc)

    **Returns:**
    Paginated list of targets with total count.
    """
    # Build base query
    query = select(DisplacementTarget)

    # Apply filters
    filters = []

    # Status filter (based on ICP score)
    if status:
        if status == "hot":
            filters.append(DisplacementTarget.icp_score >= 80)
        elif status == "warm":
            filters.append(and_(
                DisplacementTarget.icp_score >= 60,
                DisplacementTarget.icp_score < 80
            ))
        elif status == "cool":
            filters.append(and_(
                DisplacementTarget.icp_score >= 40,
                DisplacementTarget.icp_score < 60
            ))
        elif status == "cold":
            filters.append(and_(
                DisplacementTarget.icp_score.isnot(None),
                DisplacementTarget.icp_score < 40
            ))
        elif status == "unscored":
            filters.append(DisplacementTarget.icp_score.is_(None))

    if vertical:
        filters.append(DisplacementTarget.vertical.ilike(f"%{vertical}%"))

    if partner_tech:
        filters.append(DisplacementTarget.partner_tech.ilike(f"%{partner_tech}%"))

    if country:
        filters.append(DisplacementTarget.country.ilike(f"%{country}%"))

    if min_score is not None:
        filters.append(DisplacementTarget.icp_score >= min_score)

    if max_score is not None:
        filters.append(DisplacementTarget.icp_score <= max_score)

    if min_traffic is not None:
        filters.append(DisplacementTarget.sw_monthly_visits >= min_traffic)

    if is_public is not None:
        filters.append(DisplacementTarget.is_public == is_public)

    if enrichment_level:
        filters.append(DisplacementTarget.enrichment_level == enrichment_level)

    if search:
        filters.append(or_(
            DisplacementTarget.domain.ilike(f"%{search}%"),
            DisplacementTarget.company_name.ilike(f"%{search}%")
        ))

    # Apply all filters
    if filters:
        query = query.where(and_(*filters))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply sorting
    sort_column_map = {
        "icp_score": DisplacementTarget.icp_score,
        "company_name": DisplacementTarget.company_name,
        "domain": DisplacementTarget.domain,
        "sw_monthly_visits": DisplacementTarget.sw_monthly_visits,
        "revenue": DisplacementTarget.revenue,
        "created_at": DisplacementTarget.created_at,
        "last_enriched": DisplacementTarget.last_enriched,
    }

    sort_column = sort_column_map.get(sort_by, DisplacementTarget.icp_score)

    # Handle null values in sorting (put nulls last)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc().nullslast())
    else:
        query = query.order_by(sort_column.asc().nullsfirst())

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute query
    result = await db.execute(query)
    targets = result.scalars().all()

    # Build response
    return TargetListResponse(
        targets=[target_to_summary(t) for t in targets],
        pagination=PaginationMeta.from_query(page, page_size, total),
        filters={
            "status": status,
            "vertical": vertical,
            "partner_tech": partner_tech,
            "country": country,
            "min_score": min_score,
            "max_score": max_score,
            "min_traffic": min_traffic,
            "is_public": is_public,
            "enrichment_level": enrichment_level,
            "search": search,
        }
    )


# =============================================================================
# Get Target Details Endpoint
# =============================================================================

@router.get("/stats", response_model=TargetStats)
async def get_target_stats(
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregate statistics for displacement targets.

    **Returns:**
    - Total count
    - Breakdown by status (hot/warm/cool/cold/unscored)
    - Breakdown by vertical (top 10)
    - Breakdown by partner technology
    - Average metrics (ICP score, monthly visits)
    - Enrichment statistics
    """
    # Total count
    total_result = await db.execute(
        select(func.count()).select_from(DisplacementTarget)
    )
    total = total_result.scalar() or 0

    # Status breakdown using CASE
    status_query = select(
        func.sum(case((DisplacementTarget.icp_score >= 80, 1), else_=0)).label("hot"),
        func.sum(case((and_(
            DisplacementTarget.icp_score >= 60,
            DisplacementTarget.icp_score < 80
        ), 1), else_=0)).label("warm"),
        func.sum(case((and_(
            DisplacementTarget.icp_score >= 40,
            DisplacementTarget.icp_score < 60
        ), 1), else_=0)).label("cool"),
        func.sum(case((and_(
            DisplacementTarget.icp_score.isnot(None),
            DisplacementTarget.icp_score < 40
        ), 1), else_=0)).label("cold"),
        func.sum(case((DisplacementTarget.icp_score.is_(None), 1), else_=0)).label("unscored"),
    )
    status_result = await db.execute(status_query)
    status_row = status_result.one()

    status_breakdown = StatusBreakdown(
        hot=status_row.hot or 0,
        warm=status_row.warm or 0,
        cool=status_row.cool or 0,
        cold=status_row.cold or 0,
        unscored=status_row.unscored or 0,
    )

    # Vertical breakdown (top 10)
    vertical_query = select(
        DisplacementTarget.vertical,
        func.count().label("count"),
        func.avg(DisplacementTarget.icp_score).label("avg_score")
    ).where(
        DisplacementTarget.vertical.isnot(None)
    ).group_by(
        DisplacementTarget.vertical
    ).order_by(
        func.count().desc()
    ).limit(10)

    vertical_result = await db.execute(vertical_query)
    vertical_rows = vertical_result.all()

    by_vertical = [
        VerticalBreakdown(
            vertical=row.vertical,
            count=row.count,
            avg_icp_score=round(row.avg_score, 1) if row.avg_score else None
        )
        for row in vertical_rows
    ]

    # Partner tech breakdown
    partner_query = select(
        DisplacementTarget.partner_tech,
        func.count().label("count"),
        func.avg(DisplacementTarget.icp_score).label("avg_score")
    ).where(
        DisplacementTarget.partner_tech.isnot(None)
    ).group_by(
        DisplacementTarget.partner_tech
    ).order_by(
        func.count().desc()
    ).limit(10)

    partner_result = await db.execute(partner_query)
    partner_rows = partner_result.all()

    by_partner_tech = [
        PartnerTechBreakdown(
            partner_tech=row.partner_tech,
            count=row.count,
            avg_icp_score=round(row.avg_score, 1) if row.avg_score else None
        )
        for row in partner_rows
    ]

    # Average metrics
    avg_query = select(
        func.avg(DisplacementTarget.icp_score).label("avg_icp"),
        func.avg(DisplacementTarget.sw_monthly_visits).label("avg_visits"),
        func.sum(DisplacementTarget.revenue).label("total_revenue"),
    )
    avg_result = await db.execute(avg_query)
    avg_row = avg_result.one()

    # Enrichment stats
    enriched_query = select(func.count()).where(
        DisplacementTarget.enrichment_level.isnot(None)
    )
    enriched_count = (await db.execute(enriched_query)).scalar() or 0

    public_query = select(func.count()).where(
        DisplacementTarget.is_public == True
    )
    public_count = (await db.execute(public_query)).scalar() or 0

    # Estimate pipeline value (15% of digital revenue as addressable)
    pipeline_estimate = None
    if avg_row.total_revenue:
        pipeline_estimate = float(avg_row.total_revenue) * 0.15

    return TargetStats(
        total=total,
        by_status=status_breakdown,
        by_vertical=by_vertical,
        by_partner_tech=by_partner_tech,
        avg_icp_score=round(avg_row.avg_icp, 1) if avg_row.avg_icp else None,
        avg_monthly_visits=round(avg_row.avg_visits, 0) if avg_row.avg_visits else None,
        total_pipeline_value=pipeline_estimate,
        enriched_count=enriched_count,
        public_count=public_count,
        calculated_at=datetime.utcnow(),
    )


@router.get("/{domain}", response_model=TargetResponse)
async def get_target(
    domain: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get full details for a single displacement target.

    **Path Parameters:**
    - `domain`: Company domain (e.g., costco.com)

    **Returns:**
    Full target details including all enrichment data.
    """
    # Normalize domain
    domain = domain.strip().lower()
    domain = domain.replace("https://", "").replace("http://", "")
    domain = domain.replace("www.", "").rstrip("/")

    # Query target
    result = await db.execute(
        select(DisplacementTarget).where(
            DisplacementTarget.domain == domain
        )
    )
    target = result.scalar()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target not found: {domain}"
        )

    return target_to_response(target)


# =============================================================================
# Search Targets Endpoint
# =============================================================================

@router.post("/search", response_model=TargetSearchResponse)
async def search_targets(
    request: TargetSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Search targets by a list of domains.

    Useful for bulk lookups (e.g., "which of these accounts are in our system?").

    **Request Body:**
    - `domains`: List of domains to search for (max 100)

    **Returns:**
    - `found`: Targets that exist in the system
    - `not_found`: Domains not in the system
    - `total_searched`: Total domains searched
    - `total_found`: Number of targets found
    """
    # Domains are already cleaned by the validator
    domains_to_search = request.domains

    # Query all matching targets
    result = await db.execute(
        select(DisplacementTarget).where(
            DisplacementTarget.domain.in_(domains_to_search)
        )
    )
    targets = result.scalars().all()

    # Build found domains set
    found_domains = {t.domain for t in targets}

    # Determine not found domains
    not_found = [d for d in domains_to_search if d not in found_domains]

    return TargetSearchResponse(
        found=[target_to_summary(t) for t in targets],
        not_found=not_found,
        total_searched=len(domains_to_search),
        total_found=len(targets),
    )


# =============================================================================
# Update Target Status Endpoint
# =============================================================================

@router.put("/{domain}/status", response_model=TargetStatusUpdateResponse)
async def update_target_status(
    domain: str,
    request: TargetStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Update target status (ICP score and tier).

    Allows manual override of ICP score for sales team prioritization.

    **Path Parameters:**
    - `domain`: Company domain

    **Request Body:**
    - `icp_score`: New ICP score (0-100)
    - `icp_tier_name`: New tier name (hot/warm/cool/cold)
    - `score_reasons`: Updated score reasoning

    **Returns:**
    Updated target status with computed status based on new score.
    """
    # Normalize domain
    domain = domain.strip().lower()
    domain = domain.replace("https://", "").replace("http://", "")
    domain = domain.replace("www.", "").rstrip("/")

    # Query target
    result = await db.execute(
        select(DisplacementTarget).where(
            DisplacementTarget.domain == domain
        )
    )
    target = result.scalar()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target not found: {domain}"
        )

    # Update fields if provided
    updates_made = []

    if request.icp_score is not None:
        target.icp_score = request.icp_score
        updates_made.append(f"icp_score={request.icp_score}")

        # Auto-compute tier from score
        if request.icp_score >= 80:
            target.icp_tier_name = "hot"
            target.icp_tier = 1
        elif request.icp_score >= 60:
            target.icp_tier_name = "warm"
            target.icp_tier = 2
        elif request.icp_score >= 40:
            target.icp_tier_name = "cool"
            target.icp_tier = 3
        else:
            target.icp_tier_name = "cold"
            target.icp_tier = 4

    if request.icp_tier_name is not None:
        target.icp_tier_name = request.icp_tier_name
        updates_made.append(f"tier={request.icp_tier_name}")

        # Map tier to number
        tier_map = {"hot": 1, "warm": 2, "cool": 3, "cold": 4}
        target.icp_tier = tier_map.get(request.icp_tier_name)

    if request.score_reasons is not None:
        target.score_reasons = json.dumps(request.score_reasons)
        updates_made.append(f"reasons updated")

    # Commit changes
    await db.commit()
    await db.refresh(target)

    logger.info(
        f"Target status updated: {domain} by {current_user.email} - {', '.join(updates_made)}"
    )

    return TargetStatusUpdateResponse(
        id=target.id,
        domain=target.domain,
        icp_score=target.icp_score,
        icp_tier_name=target.icp_tier_name,
        status=compute_status_from_score(target.icp_score),
        updated_at=datetime.utcnow(),
        message=f"Target updated: {', '.join(updates_made)}" if updates_made else "No changes made",
    )
