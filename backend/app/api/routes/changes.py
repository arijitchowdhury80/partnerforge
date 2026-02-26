"""
Change History API Endpoints

Endpoints for viewing change history and detecting significant changes.

Endpoints:
- GET  /api/v1/changes/{domain}           - Get change history for a domain
- GET  /api/v1/changes/{domain}/significant - Get significant changes
- GET  /api/v1/changes/recent             - Get recent changes across all domains
- GET  /api/v1/changes/{domain}/compare   - Compare two snapshots
- GET  /api/v1/changes/analytics          - Get change analytics
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import logging

from ..deps import get_db, get_current_user, CurrentUser
from ..schemas.changes import (
    ChangeEventResponse,
    ChangeHistoryResponse,
    SignificantChangeResponse,
    RecentChangesResponse,
    RecentChangeItem,
    SnapshotComparisonResponse,
    SnapshotDiff,
    ChangeAnalyticsResponse,
    ChangeSignificance,
    ChangeCategory,
)
from ...models.versioning import ChangeEvent, IntelSnapshot
from ...models.targets import DisplacementTarget
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/changes", tags=["Changes"])
settings = get_settings()


# =============================================================================
# Helper Functions
# =============================================================================

def _normalize_domain(domain: str) -> str:
    """Normalize domain format."""
    d = domain.strip().lower()
    d = d.replace("https://", "").replace("http://", "")
    d = d.replace("www.", "").rstrip("/")
    return d


# =============================================================================
# Domain Change History Endpoints
# =============================================================================

@router.get("/{domain}", response_model=ChangeHistoryResponse)
async def get_change_history(
    domain: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(
        None,
        description="Filter by category",
        regex="^(executive_change|tech_stack_change|score_change|hiring_change|financial_change|competitive_change|strategic_change)$"
    ),
    significance: Optional[str] = Query(
        None,
        description="Filter by significance",
        regex="^(critical|high|medium|low)$"
    ),
    since: Optional[datetime] = Query(None, description="Filter changes since this date"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get change history for a domain.

    Returns all detected changes with filtering options.

    **Filters:**
    - `category`: Change category (executive_change, tech_stack_change, etc.)
    - `significance`: Change significance level
    - `since`: Only changes after this date
    """
    domain = _normalize_domain(domain)

    # Verify domain exists
    target_result = await db.execute(
        select(DisplacementTarget).where(DisplacementTarget.domain == domain)
    )
    target = target_result.scalar()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target not found: {domain}"
        )

    # Build query
    query = select(ChangeEvent).where(ChangeEvent.domain == domain)
    count_query = select(func.count()).select_from(ChangeEvent).where(ChangeEvent.domain == domain)

    conditions = []

    if category:
        conditions.append(ChangeEvent.category == category)

    if significance:
        conditions.append(ChangeEvent.significance == significance)

    if since:
        conditions.append(ChangeEvent.detected_at >= since)

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    # Get total
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated changes
    offset = (page - 1) * limit
    query = query.order_by(desc(ChangeEvent.detected_at)).offset(offset).limit(limit)

    result = await db.execute(query)
    changes = result.scalars().all()

    # Count by significance
    sig_counts = await db.execute(
        select(ChangeEvent.significance, func.count())
        .where(ChangeEvent.domain == domain)
        .group_by(ChangeEvent.significance)
    )
    sig_dict = {row[0]: row[1] for row in sig_counts.all()}

    # Count by category
    cat_counts = await db.execute(
        select(ChangeEvent.category, func.count())
        .where(ChangeEvent.domain == domain)
        .group_by(ChangeEvent.category)
    )
    cat_dict = {row[0]: row[1] for row in cat_counts.all()}

    # Get time range
    time_range = await db.execute(
        select(func.min(ChangeEvent.detected_at), func.max(ChangeEvent.detected_at))
        .where(ChangeEvent.domain == domain)
    )
    time_row = time_range.one_or_none()
    earliest = time_row[0] if time_row else None
    latest = time_row[1] if time_row else None

    return ChangeHistoryResponse(
        domain=domain,
        company_name=target.company_name,
        changes=[
            ChangeEventResponse(
                id=str(c.id),
                snapshot_id=str(c.snapshot_id),
                domain=c.domain,
                module_type=c.module_type,
                category=ChangeCategory(c.category),
                significance=ChangeSignificance(c.significance),
                field=c.field,
                old_value=c.old_value,
                new_value=c.new_value,
                summary=c.summary,
                algolia_relevance=c.algolia_relevance,
                detected_at=c.detected_at,
            )
            for c in changes
        ],
        total=total,
        critical_count=sig_dict.get("critical", 0),
        high_count=sig_dict.get("high", 0),
        medium_count=sig_dict.get("medium", 0),
        low_count=sig_dict.get("low", 0),
        by_category=cat_dict,
        earliest_change=earliest,
        latest_change=latest,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit if limit > 0 else 0,
    )


@router.get("/{domain}/significant", response_model=SignificantChangeResponse)
async def get_significant_changes(
    domain: str,
    days: int = Query(30, ge=1, le=365, description="Look back period in days"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get significant changes (high/critical) for a domain.

    Includes Algolia opportunities and recommended actions based on changes.

    **Query Parameters:**
    - `days`: Look back period (default: 30)
    """
    domain = _normalize_domain(domain)

    # Verify domain exists
    target_result = await db.execute(
        select(DisplacementTarget).where(DisplacementTarget.domain == domain)
    )
    target = target_result.scalar()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target not found: {domain}"
        )

    cutoff = datetime.utcnow() - timedelta(days=days)

    # Get significant changes
    query = (
        select(ChangeEvent)
        .where(
            and_(
                ChangeEvent.domain == domain,
                ChangeEvent.detected_at >= cutoff,
                ChangeEvent.significance.in_(["critical", "high"])
            )
        )
        .order_by(desc(ChangeEvent.detected_at))
    )

    result = await db.execute(query)
    changes = result.scalars().all()

    # Count by significance
    critical_count = sum(1 for c in changes if c.significance == "critical")
    high_count = sum(1 for c in changes if c.significance == "high")

    # Build opportunities from changes
    opportunities = []
    recommended_actions = []

    for change in changes:
        if change.algolia_relevance:
            opportunities.append(change.algolia_relevance)

        # Generate recommendations based on category
        if change.category == "executive_change":
            recommended_actions.append(f"Research new executive: {change.summary}")
        elif change.category == "tech_stack_change":
            recommended_actions.append(f"Review tech implications: {change.summary}")
        elif change.category == "competitive_change":
            recommended_actions.append(f"Update competitive positioning: {change.summary}")
        elif change.category == "hiring_change":
            recommended_actions.append(f"Analyze hiring signals: {change.summary}")

    return SignificantChangeResponse(
        domain=domain,
        company_name=target.company_name,
        changes=[
            ChangeEventResponse(
                id=str(c.id),
                snapshot_id=str(c.snapshot_id),
                domain=c.domain,
                module_type=c.module_type,
                category=ChangeCategory(c.category),
                significance=ChangeSignificance(c.significance),
                field=c.field,
                old_value=c.old_value,
                new_value=c.new_value,
                summary=c.summary,
                algolia_relevance=c.algolia_relevance,
                detected_at=c.detected_at,
            )
            for c in changes
        ],
        total=len(changes),
        critical_count=critical_count,
        high_count=high_count,
        opportunities=list(set(opportunities))[:10],
        recommended_actions=list(set(recommended_actions))[:10],
    )


# =============================================================================
# Recent Changes (Global)
# =============================================================================

@router.get("/recent", response_model=RecentChangesResponse)
async def get_recent_changes(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    hours: int = Query(24, ge=1, le=168, description="Look back period in hours"),
    category: Optional[str] = Query(
        None,
        description="Filter by category",
        regex="^(executive_change|tech_stack_change|score_change|hiring_change|financial_change|competitive_change|strategic_change)$"
    ),
    min_significance: Optional[str] = Query(
        None,
        description="Minimum significance",
        regex="^(critical|high|medium|low)$"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get recent changes across all domains.

    Returns changes from the specified time period with context.

    **Query Parameters:**
    - `hours`: Look back period (default: 24)
    - `category`: Filter by change category
    - `min_significance`: Minimum significance level
    """
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    # Build query
    query = select(ChangeEvent).where(ChangeEvent.detected_at >= cutoff)
    count_query = (
        select(func.count())
        .select_from(ChangeEvent)
        .where(ChangeEvent.detected_at >= cutoff)
    )

    conditions = []

    if category:
        conditions.append(ChangeEvent.category == category)

    if min_significance:
        # Filter to specified significance or higher
        sig_order = ["low", "medium", "high", "critical"]
        min_idx = sig_order.index(min_significance)
        allowed_sigs = sig_order[min_idx:]
        conditions.append(ChangeEvent.significance.in_(allowed_sigs))

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    # Get total
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated changes
    offset = (page - 1) * limit
    query = query.order_by(desc(ChangeEvent.detected_at)).offset(offset).limit(limit)

    result = await db.execute(query)
    changes = result.scalars().all()

    # Get unique domains
    domains = set(c.domain for c in changes)

    # Get target info for context
    target_info: Dict[str, Dict[str, Any]] = {}
    if domains:
        targets_result = await db.execute(
            select(DisplacementTarget).where(DisplacementTarget.domain.in_(domains))
        )
        for target in targets_result.scalars().all():
            target_info[target.domain] = {
                "company_name": target.company_name,
                "icp_score": target.icp_score,
                "icp_tier": target.icp_tier_name,
            }

    # Count by significance
    sig_counts = await db.execute(
        select(ChangeEvent.significance, func.count())
        .where(ChangeEvent.detected_at >= cutoff)
        .group_by(ChangeEvent.significance)
    )
    sig_dict = {row[0]: row[1] for row in sig_counts.all()}

    # Count by category
    cat_counts = await db.execute(
        select(ChangeEvent.category, func.count())
        .where(ChangeEvent.detected_at >= cutoff)
        .group_by(ChangeEvent.category)
    )
    cat_dict = {row[0]: row[1] for row in cat_counts.all()}

    # Top domains by change count
    domain_counts = await db.execute(
        select(ChangeEvent.domain, func.count().label("count"))
        .where(ChangeEvent.detected_at >= cutoff)
        .group_by(ChangeEvent.domain)
        .order_by(desc("count"))
        .limit(10)
    )
    top_domains = [
        {"domain": row[0], "count": row[1], **target_info.get(row[0], {})}
        for row in domain_counts.all()
    ]

    return RecentChangesResponse(
        changes=[
            RecentChangeItem(
                change=ChangeEventResponse(
                    id=str(c.id),
                    snapshot_id=str(c.snapshot_id),
                    domain=c.domain,
                    module_type=c.module_type,
                    category=ChangeCategory(c.category),
                    significance=ChangeSignificance(c.significance),
                    field=c.field,
                    old_value=c.old_value,
                    new_value=c.new_value,
                    summary=c.summary,
                    algolia_relevance=c.algolia_relevance,
                    detected_at=c.detected_at,
                ),
                domain=c.domain,
                company_name=target_info.get(c.domain, {}).get("company_name"),
                icp_score=target_info.get(c.domain, {}).get("icp_score"),
                icp_tier=target_info.get(c.domain, {}).get("icp_tier"),
            )
            for c in changes
        ],
        total=total,
        domains_affected=len(domains),
        critical_count=sig_dict.get("critical", 0),
        high_count=sig_dict.get("high", 0),
        by_category=cat_dict,
        top_domains=top_domains,
        period_start=cutoff,
        period_end=datetime.utcnow(),
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit if limit > 0 else 0,
    )


# =============================================================================
# Snapshot Comparison
# =============================================================================

@router.get("/{domain}/compare", response_model=SnapshotComparisonResponse)
async def compare_snapshots(
    domain: str,
    module_type: str = Query(..., description="Module type (e.g., m09_executive)"),
    version_old: Optional[int] = Query(None, description="Older version number"),
    version_new: Optional[int] = Query(None, description="Newer version number"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Compare two snapshots for a domain and module.

    If versions not specified, compares current with previous.

    **Query Parameters:**
    - `module_type`: Module type (required)
    - `version_old`: Older version (optional, default: previous)
    - `version_new`: Newer version (optional, default: current)
    """
    domain = _normalize_domain(domain)

    # Get snapshots
    query = (
        select(IntelSnapshot)
        .where(
            and_(
                IntelSnapshot.domain == domain,
                IntelSnapshot.module_type == module_type
            )
        )
        .order_by(desc(IntelSnapshot.version))
    )

    result = await db.execute(query)
    snapshots = result.scalars().all()

    if len(snapshots) < 2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Not enough snapshots for comparison. Found: {len(snapshots)}"
        )

    # Get specified versions or default to current vs previous
    if version_old and version_new:
        old_snap = next((s for s in snapshots if s.version == version_old), None)
        new_snap = next((s for s in snapshots if s.version == version_new), None)

        if not old_snap or not new_snap:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified versions not found"
            )
    else:
        new_snap = snapshots[0]
        old_snap = snapshots[1]

    # Build diff
    old_data = old_snap.data or {}
    new_data = new_snap.data or {}

    added = {k: v for k, v in new_data.items() if k not in old_data}
    removed = {k: v for k, v in old_data.items() if k not in new_data}
    changed = {}
    unchanged = []

    for key in old_data:
        if key in new_data:
            if old_data[key] != new_data[key]:
                changed[key] = {"old": old_data[key], "new": new_data[key]}
            else:
                unchanged.append(key)

    diff = SnapshotDiff(
        added=added,
        removed=removed,
        changed=changed,
        unchanged=unchanged,
    )

    # Get associated change events
    change_query = (
        select(ChangeEvent)
        .where(ChangeEvent.snapshot_id == str(new_snap.id))
        .order_by(desc(ChangeEvent.detected_at))
    )
    change_result = await db.execute(change_query)
    change_events = change_result.scalars().all()

    # Determine highest significance
    highest_sig = None
    sig_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    for event in change_events:
        if highest_sig is None or sig_order.get(event.significance, 0) > sig_order.get(highest_sig, 0):
            highest_sig = event.significance

    return SnapshotComparisonResponse(
        domain=domain,
        module_type=module_type,
        snapshot_old_id=str(old_snap.id),
        snapshot_new_id=str(new_snap.id),
        version_old=old_snap.version,
        version_new=new_snap.version,
        old_snapshot_at=old_snap.snapshot_at,
        new_snapshot_at=new_snap.snapshot_at,
        diff=diff,
        total_changes=len(added) + len(removed) + len(changed),
        highest_significance=ChangeSignificance(highest_sig) if highest_sig else None,
        change_events=[
            ChangeEventResponse(
                id=str(c.id),
                snapshot_id=str(c.snapshot_id),
                domain=c.domain,
                module_type=c.module_type,
                category=ChangeCategory(c.category),
                significance=ChangeSignificance(c.significance),
                field=c.field,
                old_value=c.old_value,
                new_value=c.new_value,
                summary=c.summary,
                algolia_relevance=c.algolia_relevance,
                detected_at=c.detected_at,
            )
            for c in change_events
        ],
    )


# =============================================================================
# Analytics
# =============================================================================

@router.get("/analytics", response_model=ChangeAnalyticsResponse)
async def get_change_analytics(
    days: int = Query(30, ge=1, le=365, description="Analysis period in days"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get analytics about changes over time.

    Returns trends, counts by category, and top movers.

    **Query Parameters:**
    - `days`: Analysis period (default: 30)
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Total changes
    total_result = await db.execute(
        select(func.count())
        .select_from(ChangeEvent)
        .where(ChangeEvent.detected_at >= cutoff)
    )
    total = total_result.scalar() or 0

    # Unique domains
    domains_result = await db.execute(
        select(func.count(func.distinct(ChangeEvent.domain)))
        .where(ChangeEvent.detected_at >= cutoff)
    )
    domains_count = domains_result.scalar() or 0

    # By significance
    sig_result = await db.execute(
        select(ChangeEvent.significance, func.count())
        .where(ChangeEvent.detected_at >= cutoff)
        .group_by(ChangeEvent.significance)
    )
    by_significance = {row[0]: row[1] for row in sig_result.all()}

    # By category
    cat_result = await db.execute(
        select(ChangeEvent.category, func.count())
        .where(ChangeEvent.detected_at >= cutoff)
        .group_by(ChangeEvent.category)
    )
    by_category = {row[0]: row[1] for row in cat_result.all()}

    # By module
    mod_result = await db.execute(
        select(ChangeEvent.module_type, func.count())
        .where(ChangeEvent.detected_at >= cutoff)
        .group_by(ChangeEvent.module_type)
    )
    by_module = {row[0]: row[1] for row in mod_result.all()}

    # Daily counts (would require date functions in production)
    daily_counts: List[Dict[str, Any]] = []

    # Top domains
    top_result = await db.execute(
        select(ChangeEvent.domain, func.count().label("count"))
        .where(ChangeEvent.detected_at >= cutoff)
        .group_by(ChangeEvent.domain)
        .order_by(desc("count"))
        .limit(10)
    )
    top_domains = [
        {"domain": row[0], "change_count": row[1]}
        for row in top_result.all()
    ]

    # High opportunity changes (critical + high with algolia_relevance)
    high_opp = await db.execute(
        select(func.count())
        .select_from(ChangeEvent)
        .where(
            and_(
                ChangeEvent.detected_at >= cutoff,
                ChangeEvent.significance.in_(["critical", "high"]),
                ChangeEvent.algolia_relevance.isnot(None)
            )
        )
    )
    high_opportunity_changes = high_opp.scalar() or 0

    return ChangeAnalyticsResponse(
        period_start=cutoff,
        period_end=datetime.utcnow(),
        total_changes=total,
        domains_with_changes=domains_count,
        by_significance=by_significance,
        by_category=by_category,
        by_module=by_module,
        daily_counts=daily_counts,
        top_domains_by_changes=top_domains,
        high_opportunity_changes=high_opportunity_changes,
    )
