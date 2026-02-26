"""
Enrichment API Endpoints

Domain enrichment endpoints for intelligence gathering.

Endpoints:
- POST /api/v1/enrich/{domain}       - Start enrichment for a domain
- GET  /api/v1/enrich/{domain}/status - Get enrichment status
- GET  /api/v1/enrich/{domain}/results - Get enrichment results
- POST /api/v1/enrich/batch          - Start batch enrichment
- POST /api/v1/enrich/{domain}/cancel - Cancel enrichment job
- POST /api/v1/enrich/{domain}/retry  - Retry failed modules
- GET  /api/v1/enrich/{domain}/cache  - Get cache status
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid
import logging

from ..deps import get_db, get_current_user, CurrentUser
from ...services.enrichment import get_enrichment_service
from ..schemas.enrich import (
    # Request schemas
    EnrichRequest,
    BatchEnrichRequest,
    EnrichRetryRequest,
    # Response schemas
    EnrichResponse,
    BatchEnrichResponse,
    EnrichStatusResponse,
    EnrichmentResultsResponse,
    EnrichCancelResponse,
    DomainCacheStatus,
    ModuleCacheStatus,
    ModuleStatusDetail,
    WaveResult,
    ModuleResult,
    # Enums
    EnrichmentStatus,
    EnrichmentPriority,
    WaveStatus,
    # Constants
    VALID_MODULES,
    WAVE_MODULES,
)
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/enrich", tags=["Enrichment"])
settings = get_settings()


# =============================================================================
# In-Memory Job Storage (Replace with Redis/DB in production)
# =============================================================================

# Job storage for development (use Redis in production)
_enrichment_jobs: Dict[str, Dict[str, Any]] = {}
_batch_jobs: Dict[str, Dict[str, Any]] = {}


def _normalize_domain(domain: str) -> str:
    """Normalize domain format."""
    d = domain.strip().lower()
    d = d.replace("https://", "").replace("http://", "")
    d = d.replace("www.", "").rstrip("/")
    return d


def _get_modules_for_request(
    modules: Optional[List[str]],
    waves: Optional[List[int]],
) -> List[str]:
    """Determine which modules to run based on request."""
    if modules:
        return modules

    if waves:
        result = []
        for wave in waves:
            result.extend(WAVE_MODULES.get(wave, []))
        return result

    # Default: all modules
    return VALID_MODULES.copy()


def _estimate_duration(modules: List[str], force: bool) -> int:
    """Estimate enrichment duration in seconds."""
    # Base: 3 seconds per module
    base_time = len(modules) * 3

    # Add 2 seconds overhead per wave
    waves = set()
    for m in modules:
        for wave_num, wave_modules in WAVE_MODULES.items():
            if m in wave_modules:
                waves.add(wave_num)
                break
    wave_overhead = len(waves) * 2

    # If not forcing, cached modules are faster
    if not force:
        base_time = int(base_time * 0.5)

    return base_time + wave_overhead


# =============================================================================
# Enrichment Endpoints
# =============================================================================

@router.post("/{domain}", response_model=EnrichResponse)
async def start_enrichment(
    domain: str,
    request: EnrichRequest = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Start enrichment for a single domain.

    Queues the domain for enrichment through the specified modules.
    Returns a job ID that can be used to track progress.

    Query Parameters:
    - modules: Optional list of module IDs to run (default: all)
    - force: Bypass cache and re-enrich (default: false)

    Returns:
    - EnrichmentJob with job_id, status, modules_requested
    """
    if request is None:
        request = EnrichRequest()

    # Normalize domain
    domain = _normalize_domain(domain)

    if not domain or "." not in domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid domain format: {domain}",
        )

    # Determine modules to run
    modules = _get_modules_for_request(request.modules, request.waves)

    # Determine waves
    waves = request.waves or [1, 2, 3, 4]

    # Create job
    job_id = f"enrich_{domain.replace('.', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"

    job = {
        "job_id": job_id,
        "domain": domain,
        "status": EnrichmentStatus.QUEUED,
        "modules": modules,
        "waves": waves,
        "priority": request.priority,
        "force": request.force,
        "estimated_time_seconds": _estimate_duration(modules, request.force),
        "created_at": datetime.utcnow(),
        "started_at": None,
        "completed_at": None,
        "current_wave": None,
        "current_module": None,
        "module_results": {},
        "user_id": current_user.user_id,
        "errors": [],
    }

    # Store job
    _enrichment_jobs[job_id] = job

    logger.info(
        f"Enrichment job created: {job_id} for {domain} "
        f"({len(modules)} modules, priority={request.priority.value})"
    )

    # Run enrichment synchronously for immediate results
    try:
        job["status"] = EnrichmentStatus.RUNNING
        job["started_at"] = datetime.utcnow()
        job["current_wave"] = 1

        # Call the real enrichment service
        enrichment_service = get_enrichment_service()
        result = await enrichment_service.enrich_domain(domain, db, force=request.force)

        # Update job with results
        if result.get("success"):
            job["status"] = EnrichmentStatus.COMPLETED
            for module in result.get("modules_completed", []):
                job["module_results"][module] = {
                    "status": "completed",
                    "data_points": 1,
                    "source_url": result.get(module, {}).get("source_url") if isinstance(result.get(module), dict) else None,
                }
        else:
            job["status"] = EnrichmentStatus.FAILED
            job["errors"] = result.get("errors", [])

        for module in result.get("modules_failed", []):
            job["module_results"][module] = {
                "status": "failed",
                "error_message": "API call failed",
            }

        job["completed_at"] = datetime.utcnow()
        logger.info(f"Enrichment completed for {domain}: {job['status'].value}")

    except Exception as e:
        logger.error(f"Enrichment failed for {domain}: {e}")
        job["status"] = EnrichmentStatus.FAILED
        job["errors"].append(str(e))
        job["completed_at"] = datetime.utcnow()

    return EnrichResponse(
        job_id=job_id,
        domain=domain,
        status=job["status"],
        modules=modules,
        waves=waves,
        priority=request.priority,
        force=request.force,
        estimated_time_seconds=job["estimated_time_seconds"],
        created_at=job["created_at"],
    )


@router.get("/{domain}/status", response_model=EnrichStatusResponse)
async def get_enrichment_status(
    domain: str,
    job_id: Optional[str] = Query(None, description="Specific job ID (default: latest)"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get enrichment status for a domain.

    Returns detailed status including:
    - Overall progress percentage
    - Module-level statuses
    - Current wave and module being processed
    - Estimated completion time

    If job_id is not provided, returns status of the most recent job for this domain.
    """
    domain = _normalize_domain(domain)

    # Find job
    job = None
    if job_id:
        job = _enrichment_jobs.get(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job not found: {job_id}",
            )
        if job["domain"] != domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job {job_id} is for domain {job['domain']}, not {domain}",
            )
    else:
        # Find most recent job for this domain
        domain_jobs = [
            j for j in _enrichment_jobs.values()
            if j["domain"] == domain and j["user_id"] == current_user.user_id
        ]
        if not domain_jobs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No enrichment jobs found for domain: {domain}",
            )
        job = max(domain_jobs, key=lambda j: j["created_at"])

    # Calculate progress
    modules = job["modules"]
    module_results = job.get("module_results", {})
    completed_count = sum(
        1 for m in modules
        if m in module_results and module_results[m].get("status") in ("completed", "failed", "skipped", "cached")
    )
    failed_count = sum(
        1 for m in modules
        if m in module_results and module_results[m].get("status") == "failed"
    )
    progress = (completed_count / len(modules) * 100) if modules else 0

    # Build wave results
    wave_results = []
    for wave_num in job["waves"]:
        wave_modules = [m for m in WAVE_MODULES.get(wave_num, []) if m in modules]
        if not wave_modules:
            continue

        wave_module_results = []
        wave_completed = 0
        wave_failed = 0

        for m in wave_modules:
            result = module_results.get(m, {})
            module_status = result.get("status", "pending")

            wave_module_results.append(ModuleResult(
                module_id=m,
                status=module_status,
                duration_seconds=result.get("duration_seconds"),
                data_points_collected=result.get("data_points"),
                source_url=result.get("source_url"),
                error_message=result.get("error_message"),
            ))

            if module_status in ("completed", "cached"):
                wave_completed += 1
            elif module_status == "failed":
                wave_failed += 1

        # Determine wave status
        if wave_completed + wave_failed == len(wave_modules):
            wave_status = WaveStatus.COMPLETED if wave_failed == 0 else WaveStatus.FAILED
        elif wave_completed + wave_failed > 0:
            wave_status = WaveStatus.RUNNING
        else:
            wave_status = WaveStatus.PENDING

        wave_results.append(WaveResult(
            wave_number=wave_num,
            status=wave_status,
            modules=wave_module_results,
            started_at=None,  # TODO: Track per-wave timing
            completed_at=None,
            duration_seconds=None,
        ))

    # Calculate duration
    duration = None
    if job["started_at"]:
        end_time = job.get("completed_at") or datetime.utcnow()
        duration = (end_time - job["started_at"]).total_seconds()

    return EnrichStatusResponse(
        job_id=job["job_id"],
        domain=job["domain"],
        status=job["status"],
        progress_percent=round(progress, 1),
        current_wave=job.get("current_wave"),
        current_module=job.get("current_module"),
        modules_total=len(modules),
        modules_completed=completed_count,
        modules_failed=failed_count,
        waves=wave_results,
        created_at=job["created_at"],
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
        duration_seconds=duration,
        error_message=job.get("error_message"),
        errors=job.get("errors", []),
    )


@router.get("/{domain}/results", response_model=EnrichmentResultsResponse)
async def get_enrichment_results(
    domain: str,
    job_id: Optional[str] = Query(None, description="Specific job ID (default: latest)"),
    modules: Optional[str] = Query(None, description="Comma-separated module IDs to filter"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get enrichment results for a domain.

    Returns the collected data from all completed modules.
    Results include source citations for data provenance.

    Query Parameters:
    - job_id: Specific job ID (default: most recent completed job)
    - modules: Comma-separated list of module IDs to filter results
    """
    domain = _normalize_domain(domain)

    # Find job
    job = None
    if job_id:
        job = _enrichment_jobs.get(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job not found: {job_id}",
            )
        if job["domain"] != domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job {job_id} is for domain {job['domain']}, not {domain}",
            )
    else:
        # Find most recent completed job for this domain
        domain_jobs = [
            j for j in _enrichment_jobs.values()
            if j["domain"] == domain
            and j["user_id"] == current_user.user_id
            and j["status"] in (EnrichmentStatus.COMPLETED, EnrichmentStatus.FAILED)
        ]
        if not domain_jobs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No completed enrichment jobs found for domain: {domain}",
            )
        job = max(domain_jobs, key=lambda j: j["created_at"])

    # Parse module filter
    filter_modules = None
    if modules:
        filter_modules = [m.strip() for m in modules.split(",")]
        invalid = [m for m in filter_modules if m not in VALID_MODULES]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid module IDs: {invalid}",
            )

    # Build results
    module_results = job.get("module_results", {})
    results: Dict[str, Any] = {}
    module_statuses: Dict[str, ModuleStatusDetail] = {}
    cached_modules: List[str] = []
    failed_modules: List[str] = []
    source_citations: Dict[str, List[Dict[str, Any]]] = {}

    for module_id in job["modules"]:
        if filter_modules and module_id not in filter_modules:
            continue

        result = module_results.get(module_id, {})
        module_status = result.get("status", "pending")

        # Build module status detail
        module_statuses[module_id] = ModuleStatusDetail(
            module_id=module_id,
            status=module_status,
            started_at=result.get("started_at"),
            completed_at=result.get("completed_at"),
            duration_ms=int(result.get("duration_seconds", 0) * 1000) if result.get("duration_seconds") else None,
            error_message=result.get("error_message"),
            cached=result.get("cached", False),
            source_url=result.get("source_url"),
            data_points=result.get("data_points"),
        )

        # Add to results if completed
        if module_status in ("completed", "cached"):
            results[module_id] = result.get("data", {})
            if result.get("cached"):
                cached_modules.append(module_id)
            # Add source citations
            if result.get("sources"):
                source_citations[module_id] = result["sources"]
        elif module_status == "failed":
            failed_modules.append(module_id)

    return EnrichmentResultsResponse(
        domain=domain,
        job_id=job["job_id"],
        status=job["status"],
        completed_at=job.get("completed_at"),
        results=results,
        module_statuses=module_statuses,
        cached_modules=cached_modules,
        failed_modules=failed_modules,
        source_citations=source_citations,
    )


@router.post("/batch", response_model=BatchEnrichResponse)
async def start_batch_enrichment(
    request: BatchEnrichRequest,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Start batch enrichment for multiple domains.

    Queues all domains for parallel enrichment.
    Returns individual job IDs for each domain.

    Request Body:
    - domains: List of domains to enrich (max 100)
    - modules: Optional list of modules to run
    - force: Bypass cache for all domains
    - priority: Processing priority
    - concurrency: Max concurrent enrichments (1-20)
    """
    if not request.domains:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid domains provided",
        )

    # Determine modules
    modules = _get_modules_for_request(request.modules, request.waves)
    waves = request.waves or [1, 2, 3, 4]

    # Create batch ID
    batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"

    # Create individual jobs
    jobs: List[EnrichResponse] = []
    queued_count = 0
    skipped_count = 0

    for domain in request.domains:
        domain = _normalize_domain(domain)

        if not domain or "." not in domain:
            skipped_count += 1
            continue

        # Create job
        job_id = f"enrich_{domain.replace('.', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"

        job = {
            "job_id": job_id,
            "batch_id": batch_id,
            "domain": domain,
            "status": EnrichmentStatus.QUEUED,
            "modules": modules,
            "waves": waves,
            "priority": request.priority,
            "force": request.force,
            "estimated_time_seconds": _estimate_duration(modules, request.force),
            "created_at": datetime.utcnow(),
            "started_at": None,
            "completed_at": None,
            "current_wave": None,
            "current_module": None,
            "module_results": {},
            "user_id": current_user.user_id,
            "errors": [],
        }

        _enrichment_jobs[job_id] = job
        queued_count += 1

        jobs.append(EnrichResponse(
            job_id=job_id,
            domain=domain,
            status=EnrichmentStatus.QUEUED,
            modules=modules,
            waves=waves,
            priority=request.priority,
            force=request.force,
            estimated_time_seconds=job["estimated_time_seconds"],
            created_at=job["created_at"],
        ))

    # Store batch info
    batch_info = {
        "batch_id": batch_id,
        "job_ids": [j.job_id for j in jobs],
        "status": EnrichmentStatus.QUEUED,
        "total_domains": len(request.domains),
        "queued_count": queued_count,
        "skipped_count": skipped_count,
        "created_at": datetime.utcnow(),
        "user_id": current_user.user_id,
    }
    _batch_jobs[batch_id] = batch_info

    # Estimate total time (accounting for concurrency)
    total_time = sum(j.estimated_time_seconds for j in jobs)
    estimated_time = total_time // request.concurrency if request.concurrency > 0 else total_time

    logger.info(
        f"Batch enrichment created: {batch_id} with {queued_count} domains "
        f"({skipped_count} skipped)"
    )

    return BatchEnrichResponse(
        batch_id=batch_id,
        status=EnrichmentStatus.QUEUED,
        total_domains=len(request.domains),
        queued_count=queued_count,
        skipped_count=skipped_count,
        jobs=jobs,
        estimated_time_seconds=estimated_time,
        created_at=batch_info["created_at"],
    )


@router.post("/{domain}/cancel", response_model=EnrichCancelResponse)
async def cancel_enrichment(
    domain: str,
    job_id: Optional[str] = Query(None, description="Specific job ID (default: latest running)"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Cancel an ongoing enrichment job.

    Modules already completed will retain their data.
    Queued and running modules will be cancelled.
    """
    domain = _normalize_domain(domain)

    # Find job
    job = None
    if job_id:
        job = _enrichment_jobs.get(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job not found: {job_id}",
            )
    else:
        # Find most recent running job
        running_jobs = [
            j for j in _enrichment_jobs.values()
            if j["domain"] == domain
            and j["user_id"] == current_user.user_id
            and j["status"] in (EnrichmentStatus.QUEUED, EnrichmentStatus.RUNNING)
        ]
        if not running_jobs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active enrichment jobs found for domain: {domain}",
            )
        job = max(running_jobs, key=lambda j: j["created_at"])

    # Check if cancellable
    if job["status"] in (EnrichmentStatus.COMPLETED, EnrichmentStatus.CANCELLED, EnrichmentStatus.FAILED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job in status: {job['status'].value}",
        )

    # Cancel job
    module_results = job.get("module_results", {})
    completed_count = sum(
        1 for m in job["modules"]
        if m in module_results and module_results[m].get("status") in ("completed", "cached")
    )

    job["status"] = EnrichmentStatus.CANCELLED
    job["completed_at"] = datetime.utcnow()

    logger.info(f"Enrichment job cancelled: {job['job_id']} ({completed_count} modules completed)")

    return EnrichCancelResponse(
        job_id=job["job_id"],
        status=EnrichmentStatus.CANCELLED,
        message=f"Job cancelled. {completed_count} modules were already completed.",
        modules_completed=completed_count,
    )


@router.post("/{domain}/retry", response_model=EnrichResponse)
async def retry_enrichment(
    domain: str,
    job_id: Optional[str] = Query(None, description="Specific job ID (default: latest failed)"),
    request: EnrichRetryRequest = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Retry failed modules in an enrichment job.

    By default, only retries failed modules.
    Set failed_modules_only=false to re-run all modules.
    """
    if request is None:
        request = EnrichRetryRequest()

    domain = _normalize_domain(domain)

    # Find job
    job = None
    if job_id:
        job = _enrichment_jobs.get(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job not found: {job_id}",
            )
    else:
        # Find most recent failed job
        failed_jobs = [
            j for j in _enrichment_jobs.values()
            if j["domain"] == domain
            and j["user_id"] == current_user.user_id
            and j["status"] in (EnrichmentStatus.FAILED,)
        ]
        if not failed_jobs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No failed enrichment jobs found for domain: {domain}",
            )
        job = max(failed_jobs, key=lambda j: j["created_at"])

    # Determine modules to retry
    if request.failed_modules_only:
        module_results = job.get("module_results", {})
        modules_to_retry = [
            m for m in job["modules"]
            if m not in module_results or module_results[m].get("status") == "failed"
        ]
    else:
        modules_to_retry = job["modules"]

    if not modules_to_retry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No modules to retry",
        )

    # Create new job for retry
    new_job_id = f"enrich_{domain.replace('.', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"

    new_job = {
        "job_id": new_job_id,
        "parent_job_id": job["job_id"],
        "domain": domain,
        "status": EnrichmentStatus.QUEUED,
        "modules": modules_to_retry,
        "waves": job["waves"],
        "priority": job["priority"],
        "force": True,  # Force re-enrichment for retry
        "estimated_time_seconds": _estimate_duration(modules_to_retry, True),
        "created_at": datetime.utcnow(),
        "started_at": None,
        "completed_at": None,
        "current_wave": None,
        "current_module": None,
        "module_results": {},
        "user_id": current_user.user_id,
        "errors": [],
    }

    _enrichment_jobs[new_job_id] = new_job

    logger.info(f"Retry job created: {new_job_id} for {len(modules_to_retry)} modules")

    return EnrichResponse(
        job_id=new_job_id,
        domain=domain,
        status=EnrichmentStatus.QUEUED,
        modules=modules_to_retry,
        waves=job["waves"],
        priority=job["priority"],
        force=True,
        estimated_time_seconds=new_job["estimated_time_seconds"],
        created_at=new_job["created_at"],
    )


@router.get("/{domain}/cache", response_model=DomainCacheStatus)
async def get_cache_status(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get cache status for a domain's enrichment data.

    Returns freshness information for each module's cached data.
    Use this to determine if re-enrichment is needed.
    """
    domain = _normalize_domain(domain)

    # In production, this would query the cache (Redis/DB)
    # For now, return mock data based on recent jobs

    # Find most recent completed job
    domain_jobs = [
        j for j in _enrichment_jobs.values()
        if j["domain"] == domain
        and j["status"] in (EnrichmentStatus.COMPLETED,)
    ]

    if not domain_jobs:
        # No cache - all modules stale
        return DomainCacheStatus(
            domain=domain,
            modules=[
                ModuleCacheStatus(
                    module_id=m,
                    is_cached=False,
                    cached_at=None,
                    freshness="expired",
                    ttl_remaining_seconds=0,
                )
                for m in VALID_MODULES
            ],
            overall_freshness="expired",
            last_enrichment=None,
            stale_modules=VALID_MODULES.copy(),
        )

    latest_job = max(domain_jobs, key=lambda j: j["created_at"])
    module_results = latest_job.get("module_results", {})
    completed_at = latest_job.get("completed_at") or datetime.utcnow()

    # Calculate TTL based on module type
    # Different modules have different freshness requirements
    module_ttls = {
        "m01_company_context": 86400 * 30,  # 30 days
        "m02_tech_stack": 86400 * 7,        # 7 days
        "m03_traffic": 86400 * 7,           # 7 days
        "m04_financials": 86400 * 1,        # 1 day (stock data)
        "m05_competitors": 86400 * 30,      # 30 days
        "m06_hiring": 86400 * 7,            # 7 days
        "m07_strategic": 86400 * 30,        # 30 days
        "m08_investor": 86400 * 30,         # 30 days
        "m09_executive": 86400 * 30,        # 30 days
        "m10_buying_committee": 86400 * 30, # 30 days
        "m11_displacement": 86400 * 7,      # 7 days
        "m12_case_study": 86400 * 90,       # 90 days
        "m13_icp_priority": 86400 * 30,     # 30 days
        "m14_signal_scoring": 86400 * 7,    # 7 days
        "m15_strategic_brief": 86400 * 7,   # 7 days
    }

    module_statuses: List[ModuleCacheStatus] = []
    stale_modules: List[str] = []
    now = datetime.utcnow()
    age_seconds = (now - completed_at).total_seconds()

    for module_id in VALID_MODULES:
        result = module_results.get(module_id, {})
        is_cached = result.get("status") in ("completed", "cached")
        ttl = module_ttls.get(module_id, 86400 * 7)
        ttl_remaining = max(0, ttl - age_seconds) if is_cached else 0

        # Determine freshness
        if not is_cached:
            freshness = "expired"
            stale_modules.append(module_id)
        elif ttl_remaining <= 0:
            freshness = "expired"
            stale_modules.append(module_id)
        elif ttl_remaining < ttl * 0.2:  # Less than 20% TTL remaining
            freshness = "stale"
            stale_modules.append(module_id)
        else:
            freshness = "fresh"

        module_statuses.append(ModuleCacheStatus(
            module_id=module_id,
            is_cached=is_cached,
            cached_at=completed_at if is_cached else None,
            freshness=freshness,
            ttl_remaining_seconds=int(ttl_remaining) if is_cached else None,
        ))

    # Determine overall freshness
    if len(stale_modules) == 0:
        overall = "fresh"
    elif len(stale_modules) < len(VALID_MODULES) / 2:
        overall = "stale"
    else:
        overall = "expired"

    return DomainCacheStatus(
        domain=domain,
        modules=module_statuses,
        overall_freshness=overall,
        last_enrichment=completed_at,
        stale_modules=stale_modules,
    )


# =============================================================================
# Job Listing Endpoint
# =============================================================================

@router.get("", response_model=Dict[str, Any])
async def list_enrichment_jobs(
    domain: Optional[str] = Query(None, description="Filter by domain"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    List enrichment jobs for the current user.

    Query Parameters:
    - domain: Filter by domain
    - status: Filter by status (queued, running, completed, failed)
    - limit: Max results (default 50, max 100)
    - offset: Pagination offset
    """
    # Filter jobs
    jobs = [
        j for j in _enrichment_jobs.values()
        if j["user_id"] == current_user.user_id
    ]

    if domain:
        normalized = _normalize_domain(domain)
        jobs = [j for j in jobs if j["domain"] == normalized]

    if status:
        try:
            status_enum = EnrichmentStatus(status.lower())
            jobs = [j for j in jobs if j["status"] == status_enum]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status}",
            )

    # Sort by created_at descending
    jobs = sorted(jobs, key=lambda j: j["created_at"], reverse=True)

    # Count running and queued
    running_count = sum(1 for j in jobs if j["status"] == EnrichmentStatus.RUNNING)
    queued_count = sum(1 for j in jobs if j["status"] == EnrichmentStatus.QUEUED)

    # Paginate
    total = len(jobs)
    jobs = jobs[offset:offset + limit]

    # Build response
    job_summaries = []
    for j in jobs:
        module_results = j.get("module_results", {})
        completed = sum(
            1 for m in j["modules"]
            if m in module_results and module_results[m].get("status") in ("completed", "cached")
        )
        progress = (completed / len(j["modules"]) * 100) if j["modules"] else 0

        job_summaries.append({
            "job_id": j["job_id"],
            "domain": j["domain"],
            "status": j["status"].value,
            "progress_percent": round(progress, 1),
            "modules_total": len(j["modules"]),
            "modules_completed": completed,
            "priority": j["priority"].value,
            "created_at": j["created_at"].isoformat(),
            "started_at": j["started_at"].isoformat() if j.get("started_at") else None,
        })

    return {
        "jobs": job_summaries,
        "total": total,
        "running_count": running_count,
        "queued_count": queued_count,
    }
