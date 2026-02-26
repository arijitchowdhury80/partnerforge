"""
Jobs API Endpoints

Job management for enrichment and background processing.

Endpoints:
- GET  /api/v1/jobs              - List all jobs with filtering/pagination
- GET  /api/v1/jobs/{id}         - Get job details
- POST /api/v1/jobs/{id}/cancel  - Cancel a running job
- GET  /api/v1/jobs/{id}/logs    - Get job execution logs
- GET  /api/v1/jobs/stats        - Get job statistics
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import logging

from ..deps import get_db, get_current_user, CurrentUser, PaginationParams, get_pagination
from ..schemas.jobs import (
    # Response schemas
    JobResponse,
    JobListResponse,
    JobProgressResponse,
    JobLogsResponse,
    JobCancelResponse,
    JobStatsResponse,
    # Detail schemas
    JobModuleProgress,
    JobWaveProgress,
    JobLogEntry,
    # Enums
    JobStatus,
    JobType,
    # Pagination
    PaginationMeta,
)
from ...models import JobExecution
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["Jobs"])
settings = get_settings()


# =============================================================================
# Helper Functions
# =============================================================================

def _job_to_response(job: JobExecution) -> JobResponse:
    """Convert JobExecution model to JobResponse schema."""
    # Calculate progress
    total = job.total_steps or 0
    completed = job.completed_steps or 0
    progress_pct = (completed / total * 100) if total > 0 else 0

    # Calculate duration
    duration = None
    if job.started_at:
        end_time = job.completed_at or datetime.utcnow()
        duration = (end_time - job.started_at).total_seconds()

    return JobResponse(
        id=job.id,
        job_type=job.job_type,
        domain=job.domain,
        status=job.status,
        modules=job.modules or [],
        waves=job.waves or [],
        force=job.force or False,
        total_steps=total,
        completed_steps=completed,
        progress_percent=round(progress_pct, 1),
        current_step=job.current_step,
        modules_completed=job.modules_completed or [],
        modules_failed=job.modules_failed or [],
        triggered_by=job.triggered_by,
        trigger_source=job.trigger_source,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        duration_seconds=duration,
    )


# =============================================================================
# List Jobs Endpoint
# =============================================================================

@router.get("", response_model=JobListResponse)
async def list_jobs(
    # Filtering
    domain: Optional[str] = Query(None, description="Filter by domain"),
    status: Optional[str] = Query(
        None,
        description="Filter by status",
        regex="^(queued|running|completed|failed|cancelled)$"
    ),
    job_type: Optional[str] = Query(
        None,
        description="Filter by job type",
        regex="^(full_enrichment|wave_enrichment|module_enrichment)$"
    ),
    triggered_by: Optional[str] = Query(None, description="Filter by trigger user/system"),
    since: Optional[datetime] = Query(None, description="Jobs created after this time"),
    until: Optional[datetime] = Query(None, description="Jobs created before this time"),
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    # Sorting
    sort_by: str = Query(
        "created_at",
        description="Sort field",
        regex="^(created_at|started_at|completed_at|domain|status)$"
    ),
    sort_order: str = Query("desc", description="Sort order", regex="^(asc|desc)$"),
    # Database
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    List all jobs with filtering, pagination, and sorting.

    **Filters:**
    - `domain`: Filter by target domain
    - `status`: Filter by job status (queued/running/completed/failed/cancelled)
    - `job_type`: Filter by job type (full/wave/module enrichment)
    - `triggered_by`: Filter by trigger source (user email or "system")
    - `since`/`until`: Filter by creation time range

    **Sorting:**
    - `sort_by`: Field to sort by (default: created_at)
    - `sort_order`: asc or desc (default: desc)

    **Returns:**
    Paginated list of jobs with statistics.
    """
    # Build query
    query = select(JobExecution)
    filters = []

    # Apply filters
    if domain:
        domain = domain.strip().lower()
        domain = domain.replace("https://", "").replace("http://", "")
        domain = domain.replace("www.", "").rstrip("/")
        filters.append(JobExecution.domain == domain)

    if status:
        filters.append(JobExecution.status == status)

    if job_type:
        filters.append(JobExecution.job_type == job_type)

    if triggered_by:
        filters.append(JobExecution.triggered_by == triggered_by)

    if since:
        filters.append(JobExecution.created_at >= since)

    if until:
        filters.append(JobExecution.created_at <= until)

    # Apply filters
    if filters:
        query = query.where(and_(*filters))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Get running/queued counts
    running_query = select(func.count()).where(
        JobExecution.status == "running"
    )
    queued_query = select(func.count()).where(
        JobExecution.status == "queued"
    )
    running_count = (await db.execute(running_query)).scalar() or 0
    queued_count = (await db.execute(queued_query)).scalar() or 0

    # Apply sorting
    sort_column_map = {
        "created_at": JobExecution.created_at,
        "started_at": JobExecution.started_at,
        "completed_at": JobExecution.completed_at,
        "domain": JobExecution.domain,
        "status": JobExecution.status,
    }
    sort_column = sort_column_map.get(sort_by, JobExecution.created_at)

    if sort_order == "desc":
        query = query.order_by(sort_column.desc().nullslast())
    else:
        query = query.order_by(sort_column.asc().nullsfirst())

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute query
    result = await db.execute(query)
    jobs = result.scalars().all()

    return JobListResponse(
        jobs=[_job_to_response(j) for j in jobs],
        pagination=PaginationMeta.from_query(page, page_size, total),
        running_count=running_count,
        queued_count=queued_count,
        filters={
            "domain": domain,
            "status": status,
            "job_type": job_type,
            "triggered_by": triggered_by,
            "since": since.isoformat() if since else None,
            "until": until.isoformat() if until else None,
        },
    )


# =============================================================================
# Get Job Details Endpoint
# =============================================================================

@router.get("/{job_id}", response_model=JobProgressResponse)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get detailed job status and progress.

    Returns:
    - Job metadata and configuration
    - Overall progress percentage
    - Wave-level progress (for full enrichment)
    - Module-level status
    - Error details if failed
    """
    # Get job
    result = await db.execute(
        select(JobExecution).where(JobExecution.id == job_id)
    )
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}"
        )

    # Build wave progress
    wave_progress = []
    modules = job.modules or []
    completed_modules = set(job.modules_completed or [])
    failed_modules = set(job.modules_failed or [])

    # Module to wave mapping
    wave_mapping = {
        1: ["m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials"],
        2: ["m05_competitors", "m06_hiring", "m07_strategic"],
        3: ["m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement"],
        4: ["m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief"],
    }

    for wave_num in job.waves or [1, 2, 3, 4]:
        wave_modules = [m for m in wave_mapping.get(wave_num, []) if m in modules]
        if not wave_modules:
            continue

        module_progress = []
        wave_completed = 0
        wave_failed = 0

        for module_id in wave_modules:
            if module_id in completed_modules:
                mod_status = "completed"
                wave_completed += 1
            elif module_id in failed_modules:
                mod_status = "failed"
                wave_failed += 1
            elif job.current_step == module_id:
                mod_status = "running"
            else:
                mod_status = "pending"

            module_progress.append(JobModuleProgress(
                module_id=module_id,
                status=mod_status,
            ))

        # Determine wave status
        if wave_completed + wave_failed == len(wave_modules):
            wave_status = "completed" if wave_failed == 0 else "failed"
        elif wave_completed + wave_failed > 0 or job.current_step in wave_modules:
            wave_status = "running"
        else:
            wave_status = "pending"

        wave_progress.append(JobWaveProgress(
            wave_number=wave_num,
            status=wave_status,
            modules=module_progress,
            modules_total=len(wave_modules),
            modules_completed=wave_completed,
            modules_failed=wave_failed,
        ))

    # Calculate overall progress
    total = job.total_steps or 0
    completed = job.completed_steps or 0
    failed = len(failed_modules)
    progress_pct = (completed / total * 100) if total > 0 else 0

    # Calculate duration and ETA
    duration = None
    eta = None
    if job.started_at:
        end_time = job.completed_at or datetime.utcnow()
        duration = (end_time - job.started_at).total_seconds()

        # Estimate ETA if running
        if job.status == "running" and completed > 0:
            avg_time_per_step = duration / completed
            remaining_steps = total - completed
            eta_seconds = remaining_steps * avg_time_per_step
            eta = datetime.utcnow() + timedelta(seconds=eta_seconds)

    return JobProgressResponse(
        id=job.id,
        job_type=job.job_type,
        domain=job.domain,
        status=job.status,
        modules=modules,
        waves=job.waves or [],
        force=job.force or False,
        # Progress
        total_steps=total,
        completed_steps=completed,
        failed_steps=failed,
        progress_percent=round(progress_pct, 1),
        current_step=job.current_step,
        # Wave/module detail
        wave_progress=wave_progress,
        modules_completed=job.modules_completed or [],
        modules_failed=job.modules_failed or [],
        # Metadata
        triggered_by=job.triggered_by,
        trigger_source=job.trigger_source,
        error_message=job.error_message,
        # Timing
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        duration_seconds=duration,
        estimated_completion=eta,
        # Checkpoint for resumption
        checkpoint=job.checkpoint,
    )


# =============================================================================
# Cancel Job Endpoint
# =============================================================================

@router.post("/{job_id}/cancel", response_model=JobCancelResponse)
async def cancel_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Cancel a running or queued job.

    Modules already completed will retain their data.
    Currently running modules will be stopped.
    Queued modules will not be executed.

    Returns the job's final state after cancellation.
    """
    # Get job
    result = await db.execute(
        select(JobExecution).where(JobExecution.id == job_id)
    )
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}"
        )

    # Check if cancellable
    if job.status not in ("queued", "running"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job in status: {job.status}. Only queued/running jobs can be cancelled."
        )

    # Cancel job
    modules_completed = len(job.modules_completed or [])
    modules_cancelled = len(job.modules or []) - modules_completed - len(job.modules_failed or [])

    job.status = "cancelled"
    job.error_message = f"Cancelled by {current_user.email}"
    job.completed_at = datetime.utcnow()
    job.updated_at = datetime.utcnow()

    if job.started_at:
        job.duration_seconds = (job.completed_at - job.started_at).total_seconds()

    await db.commit()

    logger.info(f"Job cancelled: {job_id} by {current_user.email}")

    return JobCancelResponse(
        id=job.id,
        status="cancelled",
        message=f"Job cancelled successfully. {modules_completed} modules completed, {modules_cancelled} modules cancelled.",
        modules_completed=modules_completed,
        modules_cancelled=modules_cancelled,
        cancelled_at=job.completed_at,
        cancelled_by=current_user.email,
    )


# =============================================================================
# Get Job Logs Endpoint
# =============================================================================

@router.get("/{job_id}/logs", response_model=JobLogsResponse)
async def get_job_logs(
    job_id: str,
    limit: int = Query(100, ge=1, le=1000, description="Max log entries"),
    level: Optional[str] = Query(
        None,
        description="Filter by log level",
        regex="^(DEBUG|INFO|WARNING|ERROR)$"
    ),
    module: Optional[str] = Query(None, description="Filter by module ID"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get execution logs for a job.

    Returns timestamped log entries with:
    - Log level (DEBUG/INFO/WARNING/ERROR)
    - Module context
    - Message

    Useful for debugging failed jobs.
    """
    # Get job
    result = await db.execute(
        select(JobExecution).where(JobExecution.id == job_id)
    )
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}"
        )

    # In production, logs would be stored in a separate table or log aggregator
    # For now, return synthetic logs based on job state
    logs: List[JobLogEntry] = []

    # Job lifecycle logs
    logs.append(JobLogEntry(
        timestamp=job.created_at,
        level="INFO",
        message=f"Job created: {job.job_type} for {job.domain}",
        module=None,
    ))

    if job.started_at:
        logs.append(JobLogEntry(
            timestamp=job.started_at,
            level="INFO",
            message=f"Job started. {len(job.modules or [])} modules to process.",
            module=None,
        ))

    # Module completion logs
    for mod in job.modules_completed or []:
        logs.append(JobLogEntry(
            timestamp=job.updated_at,  # Would be actual completion time in production
            level="INFO",
            message=f"Module completed successfully",
            module=mod,
        ))

    # Module failure logs
    for mod in job.modules_failed or []:
        logs.append(JobLogEntry(
            timestamp=job.updated_at,
            level="ERROR",
            message=f"Module failed: {job.error_message or 'Unknown error'}",
            module=mod,
        ))

    if job.completed_at:
        if job.status == "completed":
            logs.append(JobLogEntry(
                timestamp=job.completed_at,
                level="INFO",
                message=f"Job completed successfully in {job.duration_seconds:.1f}s",
                module=None,
            ))
        elif job.status == "failed":
            logs.append(JobLogEntry(
                timestamp=job.completed_at,
                level="ERROR",
                message=f"Job failed: {job.error_message}",
                module=None,
            ))
        elif job.status == "cancelled":
            logs.append(JobLogEntry(
                timestamp=job.completed_at,
                level="WARNING",
                message=f"Job cancelled: {job.error_message}",
                module=None,
            ))

    # Apply filters
    if level:
        logs = [l for l in logs if l.level == level]
    if module:
        logs = [l for l in logs if l.module == module]

    # Sort by timestamp descending and limit
    logs = sorted(logs, key=lambda l: l.timestamp, reverse=True)[:limit]

    return JobLogsResponse(
        job_id=job.id,
        logs=logs,
        total_entries=len(logs),
        filters={
            "level": level,
            "module": module,
        },
    )


# =============================================================================
# Job Statistics Endpoint
# =============================================================================

@router.get("/stats", response_model=JobStatsResponse)
async def get_job_stats(
    since: Optional[datetime] = Query(
        None,
        description="Stats since this time (default: 24 hours ago)"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get job execution statistics.

    Returns aggregate statistics including:
    - Total jobs by status
    - Average completion time
    - Failure rate
    - Module success rates
    - Recent activity

    Default time range: last 24 hours.
    """
    if since is None:
        since = datetime.utcnow() - timedelta(hours=24)

    # Total jobs by status
    status_query = select(
        JobExecution.status,
        func.count().label("count"),
    ).where(
        JobExecution.created_at >= since
    ).group_by(JobExecution.status)

    status_result = await db.execute(status_query)
    status_counts = {row.status: row.count for row in status_result.all()}

    total_jobs = sum(status_counts.values())
    completed_jobs = status_counts.get("completed", 0)
    failed_jobs = status_counts.get("failed", 0)
    running_jobs = status_counts.get("running", 0)
    queued_jobs = status_counts.get("queued", 0)
    cancelled_jobs = status_counts.get("cancelled", 0)

    # Average completion time
    avg_duration_query = select(
        func.avg(JobExecution.duration_seconds).label("avg_duration"),
    ).where(
        JobExecution.created_at >= since,
        JobExecution.status == "completed",
        JobExecution.duration_seconds.isnot(None),
    )
    avg_result = await db.execute(avg_duration_query)
    avg_duration = avg_result.scalar() or 0

    # Failure rate
    failure_rate = (failed_jobs / total_jobs * 100) if total_jobs > 0 else 0

    # Success rate
    success_rate = (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0

    # Jobs by type
    type_query = select(
        JobExecution.job_type,
        func.count().label("count"),
    ).where(
        JobExecution.created_at >= since
    ).group_by(JobExecution.job_type)

    type_result = await db.execute(type_query)
    by_type = {row.job_type: row.count for row in type_result.all()}

    # Top domains
    domain_query = select(
        JobExecution.domain,
        func.count().label("count"),
    ).where(
        JobExecution.created_at >= since
    ).group_by(
        JobExecution.domain
    ).order_by(
        desc(func.count())
    ).limit(10)

    domain_result = await db.execute(domain_query)
    top_domains = [{"domain": row.domain, "count": row.count} for row in domain_result.all()]

    # Recent activity (last 10 jobs)
    recent_query = select(JobExecution).where(
        JobExecution.created_at >= since
    ).order_by(
        JobExecution.created_at.desc()
    ).limit(10)

    recent_result = await db.execute(recent_query)
    recent_jobs = [_job_to_response(j) for j in recent_result.scalars().all()]

    return JobStatsResponse(
        period_start=since,
        period_end=datetime.utcnow(),
        total_jobs=total_jobs,
        by_status={
            "completed": completed_jobs,
            "failed": failed_jobs,
            "running": running_jobs,
            "queued": queued_jobs,
            "cancelled": cancelled_jobs,
        },
        by_type=by_type,
        avg_duration_seconds=round(avg_duration, 1) if avg_duration else None,
        success_rate=round(success_rate, 1),
        failure_rate=round(failure_rate, 1),
        top_domains=top_domains,
        recent_jobs=recent_jobs,
    )
