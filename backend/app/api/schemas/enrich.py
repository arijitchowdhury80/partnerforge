"""
Pydantic Schemas for Enrichment Operations

Request/Response models for enrichment endpoints.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, List, Dict
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class EnrichmentStatus(str, Enum):
    """Status of an enrichment job."""
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EnrichmentPriority(str, Enum):
    """Priority for enrichment processing."""
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class WaveStatus(str, Enum):
    """Status of an enrichment wave."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


# =============================================================================
# Module Definitions
# =============================================================================

VALID_MODULES = [
    "m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials",
    "m05_competitors", "m06_hiring", "m07_strategic",
    "m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement",
    "m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief",
]

WAVE_MODULES = {
    1: ["m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials"],
    2: ["m05_competitors", "m06_hiring", "m07_strategic"],
    3: ["m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement"],
    4: ["m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief"],
}


# =============================================================================
# Enrichment Request Schemas
# =============================================================================

class EnrichRequest(BaseModel):
    """Request to start enrichment for a single domain."""
    modules: Optional[List[str]] = Field(
        None,
        description="Specific modules to run (None = all modules)"
    )
    waves: Optional[List[int]] = Field(
        None,
        description="Specific waves to run (1-4, None = all waves)"
    )
    force: bool = Field(
        False,
        description="Force re-enrichment even if data is cached"
    )
    priority: EnrichmentPriority = Field(
        EnrichmentPriority.NORMAL,
        description="Processing priority"
    )

    @field_validator("modules")
    @classmethod
    def validate_modules(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate module IDs."""
        if v is None:
            return v
        invalid = [m for m in v if m not in VALID_MODULES]
        if invalid:
            raise ValueError(f"Invalid module IDs: {invalid}. Valid: {VALID_MODULES}")
        return v

    @field_validator("waves")
    @classmethod
    def validate_waves(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        """Validate wave numbers."""
        if v is None:
            return v
        invalid = [w for w in v if w < 1 or w > 4]
        if invalid:
            raise ValueError(f"Invalid wave numbers: {invalid}. Must be 1-4.")
        return v


class BatchEnrichRequest(BaseModel):
    """Request to start enrichment for multiple domains."""
    domains: List[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Domains to enrich"
    )
    modules: Optional[List[str]] = Field(
        None,
        description="Specific modules to run (None = all modules)"
    )
    waves: Optional[List[int]] = Field(
        None,
        description="Specific waves to run (1-4, None = all waves)"
    )
    force: bool = Field(
        False,
        description="Force re-enrichment even if cached"
    )
    priority: EnrichmentPriority = Field(
        EnrichmentPriority.NORMAL,
        description="Processing priority"
    )
    concurrency: int = Field(
        5,
        ge=1,
        le=20,
        description="Number of concurrent enrichments"
    )

    @field_validator("domains")
    @classmethod
    def validate_domains(cls, v: List[str]) -> List[str]:
        """Normalize domains."""
        normalized = []
        for domain in v:
            d = domain.strip().lower()
            if d.startswith("http://"):
                d = d[7:]
            elif d.startswith("https://"):
                d = d[8:]
            d = d.rstrip("/")
            if d.startswith("www."):
                d = d[4:]
            if d and "." in d:
                normalized.append(d)
        return normalized

    @field_validator("modules")
    @classmethod
    def validate_modules(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate module IDs."""
        if v is None:
            return v
        invalid = [m for m in v if m not in VALID_MODULES]
        if invalid:
            raise ValueError(f"Invalid module IDs: {invalid}")
        return v

    @field_validator("waves")
    @classmethod
    def validate_waves(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        """Validate wave numbers."""
        if v is None:
            return v
        invalid = [w for w in v if w < 1 or w > 4]
        if invalid:
            raise ValueError(f"Invalid wave numbers: {invalid}. Must be 1-4.")
        return v


# =============================================================================
# Enrichment Response Schemas
# =============================================================================

class ModuleResult(BaseModel):
    """Result of a single module enrichment."""
    module_id: str = Field(..., description="Module ID")
    status: str = Field(..., description="Status (completed/failed/skipped)")
    duration_seconds: Optional[float] = Field(None, description="Execution duration")
    data_points_collected: Optional[int] = Field(None, description="Number of data points")
    source_url: Optional[str] = Field(None, description="Primary source URL")
    error_message: Optional[str] = Field(None, description="Error message if failed")


class WaveResult(BaseModel):
    """Result of a single wave."""
    wave_number: int = Field(..., ge=1, le=4, description="Wave number")
    status: WaveStatus = Field(..., description="Wave status")
    modules: List[ModuleResult] = Field(..., description="Module results")
    started_at: Optional[datetime] = Field(None, description="Start time")
    completed_at: Optional[datetime] = Field(None, description="Completion time")
    duration_seconds: Optional[float] = Field(None, description="Total duration")


class EnrichResponse(BaseModel):
    """Response from starting enrichment."""
    job_id: str = Field(..., description="Unique job ID for tracking")
    domain: str = Field(..., description="Domain being enriched")
    status: EnrichmentStatus = Field(..., description="Job status")
    modules: List[str] = Field(..., description="Modules to be run")
    waves: List[int] = Field(..., description="Waves to be run")
    priority: EnrichmentPriority = Field(..., description="Processing priority")
    force: bool = Field(..., description="Whether forcing re-enrichment")
    estimated_time_seconds: int = Field(..., description="Estimated processing time")
    created_at: datetime = Field(..., description="Job creation timestamp")


class BatchEnrichResponse(BaseModel):
    """Response from batch enrichment request."""
    batch_id: str = Field(..., description="Batch job ID")
    status: EnrichmentStatus = Field(..., description="Overall batch status")
    total_domains: int = Field(..., description="Total domains in batch")
    queued_count: int = Field(..., description="Domains queued")
    skipped_count: int = Field(..., description="Domains skipped (no changes needed)")
    jobs: List[EnrichResponse] = Field(..., description="Individual job info")
    estimated_time_seconds: int = Field(..., description="Total estimated time")
    created_at: datetime = Field(..., description="Batch creation timestamp")


class EnrichStatusResponse(BaseModel):
    """Detailed status of an enrichment job."""
    job_id: str = Field(..., description="Job ID")
    domain: str = Field(..., description="Domain being enriched")
    status: EnrichmentStatus = Field(..., description="Current status")

    # Progress
    progress_percent: float = Field(..., ge=0, le=100, description="Progress percentage")
    current_wave: Optional[int] = Field(None, description="Current wave (1-4)")
    current_module: Optional[str] = Field(None, description="Current module")

    # Module status
    modules_total: int = Field(..., description="Total modules to run")
    modules_completed: int = Field(..., description="Modules completed")
    modules_failed: int = Field(..., description="Modules failed")

    # Wave results
    waves: List[WaveResult] = Field(default_factory=list, description="Wave results")

    # Timing
    created_at: datetime = Field(..., description="Job creation time")
    started_at: Optional[datetime] = Field(None, description="Job start time")
    completed_at: Optional[datetime] = Field(None, description="Job completion time")
    duration_seconds: Optional[float] = Field(None, description="Total duration")

    # Errors
    error_message: Optional[str] = Field(None, description="Error message if failed")
    errors: List[Dict[str, Any]] = Field(default_factory=list, description="Module errors")


class EnrichJobSummary(BaseModel):
    """Summary of an enrichment job for listing."""
    job_id: str = Field(..., description="Job ID")
    domain: str = Field(..., description="Domain")
    status: EnrichmentStatus = Field(..., description="Status")
    progress_percent: float = Field(..., description="Progress")
    modules_total: int = Field(..., description="Total modules")
    modules_completed: int = Field(..., description="Completed modules")
    priority: EnrichmentPriority = Field(..., description="Priority")
    created_at: datetime = Field(..., description="Created timestamp")
    started_at: Optional[datetime] = Field(None, description="Started timestamp")


class EnrichJobListResponse(BaseModel):
    """List of enrichment jobs."""
    jobs: List[EnrichJobSummary] = Field(..., description="Jobs")
    total: int = Field(..., description="Total matching jobs")
    running_count: int = Field(..., description="Currently running jobs")
    queued_count: int = Field(..., description="Queued jobs")


# =============================================================================
# Enrichment Cancel/Resume Schemas
# =============================================================================

class EnrichCancelResponse(BaseModel):
    """Response from cancelling an enrichment job."""
    job_id: str = Field(..., description="Job ID")
    status: EnrichmentStatus = Field(..., description="New status")
    message: str = Field(..., description="Status message")
    modules_completed: int = Field(..., description="Modules completed before cancel")


class EnrichRetryRequest(BaseModel):
    """Request to retry failed modules."""
    failed_modules_only: bool = Field(
        True,
        description="Only retry failed modules (vs full re-run)"
    )


# =============================================================================
# Cache Status Schemas
# =============================================================================

class ModuleCacheStatus(BaseModel):
    """Cache status for a single module."""
    module_id: str = Field(..., description="Module ID")
    is_cached: bool = Field(..., description="Has cached data")
    cached_at: Optional[datetime] = Field(None, description="Cache timestamp")
    freshness: Optional[str] = Field(None, description="Freshness (fresh/stale/expired)")
    ttl_remaining_seconds: Optional[int] = Field(None, description="Time until expiry")


class DomainCacheStatus(BaseModel):
    """Cache status for all modules of a domain."""
    domain: str = Field(..., description="Domain")
    modules: List[ModuleCacheStatus] = Field(..., description="Module cache statuses")
    overall_freshness: str = Field(..., description="Overall freshness")
    last_enrichment: Optional[datetime] = Field(None, description="Last enrichment time")
    stale_modules: List[str] = Field(default_factory=list, description="Stale module IDs")


# =============================================================================
# Enrichment Results Schemas (Module Data)
# =============================================================================

class ModuleStatusDetail(BaseModel):
    """Detailed status for a single module in status response."""
    module_id: str = Field(..., description="Module identifier")
    status: str = Field(..., description="pending/running/completed/failed/skipped/cached")
    started_at: Optional[datetime] = Field(None, description="When module started")
    completed_at: Optional[datetime] = Field(None, description="When module completed")
    duration_ms: Optional[int] = Field(None, description="Execution time in milliseconds")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    cached: bool = Field(False, description="Whether result was from cache")
    source_url: Optional[str] = Field(None, description="Primary source URL")
    data_points: Optional[int] = Field(None, description="Number of data points collected")


class EnrichmentResultsResponse(BaseModel):
    """
    Full enrichment results for a domain.

    Returned from GET /api/v1/enrich/{domain}/results
    """
    domain: str = Field(..., description="Enriched domain")
    job_id: str = Field(..., description="Job identifier")
    status: EnrichmentStatus = Field(..., description="Final job status")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    results: Dict[str, Any] = Field(
        default_factory=dict,
        description="Module results keyed by module_id"
    )
    module_statuses: Dict[str, ModuleStatusDetail] = Field(
        default_factory=dict,
        description="Status of each module"
    )
    cached_modules: List[str] = Field(
        default_factory=list,
        description="Modules that returned cached data"
    )
    failed_modules: List[str] = Field(
        default_factory=list,
        description="Modules that failed"
    )
    source_citations: Dict[str, List[Dict[str, Any]]] = Field(
        default_factory=dict,
        description="Source citations per module"
    )

    class Config:
        from_attributes = True


# =============================================================================
# Aliases for API Compatibility
# =============================================================================

# These aliases match the spec naming for cleaner API documentation
EnrichmentJob = EnrichResponse
EnrichmentStatusResponse = EnrichStatusResponse
BatchEnrichmentJob = BatchEnrichResponse
