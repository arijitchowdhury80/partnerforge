"""
Pydantic Schemas for Job Operations

Request/Response models for job management endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any, List, Dict
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class JobStatus(str, Enum):
    """Job execution status."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    """Job type."""
    FULL_ENRICHMENT = "full_enrichment"
    WAVE_ENRICHMENT = "wave_enrichment"
    MODULE_ENRICHMENT = "module_enrichment"


class LogLevel(str, Enum):
    """Log level."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


# =============================================================================
# Pagination
# =============================================================================

class PaginationMeta(BaseModel):
    """Pagination metadata for list responses."""
    page: int = Field(..., ge=1, description="Current page number")
    limit: int = Field(..., ge=1, le=100, description="Items per page")
    total: int = Field(..., ge=0, description="Total number of items")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    @classmethod
    def from_query(cls, page: int, limit: int, total: int) -> "PaginationMeta":
        """Create pagination meta from query parameters."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(page=page, limit=limit, total=total, total_pages=total_pages)


# =============================================================================
# Module/Wave Progress
# =============================================================================

class JobModuleProgress(BaseModel):
    """Progress of a single module within a job."""
    module_id: str = Field(..., description="Module identifier")
    status: str = Field(..., description="Status (pending/running/completed/failed)")
    started_at: Optional[datetime] = Field(None, description="Start time")
    completed_at: Optional[datetime] = Field(None, description="Completion time")
    duration_seconds: Optional[float] = Field(None, description="Duration in seconds")
    error_message: Optional[str] = Field(None, description="Error message if failed")


class JobWaveProgress(BaseModel):
    """Progress of a single wave within a job."""
    wave_number: int = Field(..., ge=1, le=4, description="Wave number")
    status: str = Field(..., description="Status (pending/running/completed/failed)")
    modules: List[JobModuleProgress] = Field(..., description="Module progress")
    modules_total: int = Field(..., description="Total modules in wave")
    modules_completed: int = Field(..., description="Completed modules")
    modules_failed: int = Field(..., description="Failed modules")
    started_at: Optional[datetime] = Field(None, description="Wave start time")
    completed_at: Optional[datetime] = Field(None, description="Wave completion time")


# =============================================================================
# Job Response Schemas
# =============================================================================

class JobResponse(BaseModel):
    """Standard job response."""
    id: str = Field(..., description="Job ID")
    job_type: str = Field(..., description="Job type (full/wave/module enrichment)")
    domain: str = Field(..., description="Target domain")
    status: str = Field(..., description="Job status")
    modules: List[str] = Field(..., description="Modules to run")
    waves: List[int] = Field(..., description="Waves to run")
    force: bool = Field(False, description="Force re-enrichment")

    # Progress
    total_steps: int = Field(..., description="Total steps")
    completed_steps: int = Field(..., description="Completed steps")
    progress_percent: float = Field(..., ge=0, le=100, description="Progress %")
    current_step: Optional[str] = Field(None, description="Current step")

    # Results
    modules_completed: List[str] = Field(default_factory=list, description="Completed modules")
    modules_failed: List[str] = Field(default_factory=list, description="Failed modules")

    # Metadata
    triggered_by: Optional[str] = Field(None, description="Trigger user/system")
    trigger_source: Optional[str] = Field(None, description="Trigger source")
    error_message: Optional[str] = Field(None, description="Error message")

    # Timing
    created_at: datetime = Field(..., description="Creation time")
    started_at: Optional[datetime] = Field(None, description="Start time")
    completed_at: Optional[datetime] = Field(None, description="Completion time")
    duration_seconds: Optional[float] = Field(None, description="Duration in seconds")

    class Config:
        from_attributes = True


class JobProgressResponse(JobResponse):
    """Detailed job progress response."""
    # Additional progress details
    failed_steps: int = Field(0, description="Failed steps")
    wave_progress: List[JobWaveProgress] = Field(
        default_factory=list,
        description="Wave-level progress"
    )
    estimated_completion: Optional[datetime] = Field(
        None,
        description="Estimated completion time"
    )
    checkpoint: Optional[Dict[str, Any]] = Field(
        None,
        description="Checkpoint data for resumption"
    )


class JobListResponse(BaseModel):
    """Paginated list of jobs."""
    jobs: List[JobResponse] = Field(..., description="List of jobs")
    pagination: PaginationMeta = Field(..., description="Pagination info")
    running_count: int = Field(..., description="Currently running jobs")
    queued_count: int = Field(..., description="Queued jobs")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Applied filters")


# =============================================================================
# Job Cancel Response
# =============================================================================

class JobCancelResponse(BaseModel):
    """Response from cancelling a job."""
    id: str = Field(..., description="Job ID")
    status: str = Field(..., description="Final status")
    message: str = Field(..., description="Status message")
    modules_completed: int = Field(..., description="Modules that completed")
    modules_cancelled: int = Field(..., description="Modules that were cancelled")
    cancelled_at: datetime = Field(..., description="Cancellation time")
    cancelled_by: str = Field(..., description="User who cancelled")


# =============================================================================
# Job Logs
# =============================================================================

class JobLogEntry(BaseModel):
    """Single log entry."""
    timestamp: datetime = Field(..., description="Log timestamp")
    level: str = Field(..., description="Log level (DEBUG/INFO/WARNING/ERROR)")
    message: str = Field(..., description="Log message")
    module: Optional[str] = Field(None, description="Module context")
    extra: Optional[Dict[str, Any]] = Field(None, description="Additional data")


class JobLogsResponse(BaseModel):
    """Job logs response."""
    job_id: str = Field(..., description="Job ID")
    logs: List[JobLogEntry] = Field(..., description="Log entries")
    total_entries: int = Field(..., description="Total entries returned")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Applied filters")


# =============================================================================
# Job Statistics
# =============================================================================

class JobStatsResponse(BaseModel):
    """Job execution statistics."""
    period_start: datetime = Field(..., description="Stats period start")
    period_end: datetime = Field(..., description="Stats period end")
    total_jobs: int = Field(..., description="Total jobs in period")

    by_status: Dict[str, int] = Field(..., description="Jobs by status")
    by_type: Dict[str, int] = Field(..., description="Jobs by type")

    avg_duration_seconds: Optional[float] = Field(None, description="Average completion time")
    success_rate: float = Field(..., ge=0, le=100, description="Success rate %")
    failure_rate: float = Field(..., ge=0, le=100, description="Failure rate %")

    top_domains: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Top domains by job count"
    )
    recent_jobs: List[JobResponse] = Field(
        default_factory=list,
        description="Recent jobs"
    )
