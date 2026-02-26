"""
List Enrichment Service
=======================

Manages enrichment processing for uploaded lists.

Features:
- Queue valid rows for enrichment
- Track per-row enrichment status
- Merge pre-existing CSV data with enrichment results
- Progress tracking and reporting
- Priority-based processing

Supports wave-based parallel execution for scalability.
"""

import logging
import json
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class EnrichmentPriority(str, Enum):
    """Priority levels for enrichment processing."""
    HIGH = "high"        # Process immediately
    NORMAL = "normal"    # Standard queue
    LOW = "low"          # Background processing
    BATCH = "batch"      # Large batch, lowest priority


class EnrichmentStatus(str, Enum):
    """Status of enrichment job or item."""
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    ENRICHING = "enriching"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PARTIAL = "partial"  # Some items failed


class EnrichmentModule(str, Enum):
    """Available enrichment modules."""
    COMPANY_CONTEXT = "company_context"
    TECHNOLOGY_STACK = "technology_stack"
    TRAFFIC_ANALYSIS = "traffic_analysis"
    FINANCIAL_DATA = "financial_data"
    COMPETITIVE_INTEL = "competitive_intel"
    HIRING_SIGNALS = "hiring_signals"
    EXECUTIVE_INTEL = "executive_intel"
    INVESTOR_INTEL = "investor_intel"
    TRIGGER_EVENTS = "trigger_events"
    ICP_SCORING = "icp_scoring"


# Default modules for standard enrichment
DEFAULT_MODULES = [
    EnrichmentModule.COMPANY_CONTEXT,
    EnrichmentModule.TECHNOLOGY_STACK,
    EnrichmentModule.TRAFFIC_ANALYSIS,
    EnrichmentModule.COMPETITIVE_INTEL,
    EnrichmentModule.ICP_SCORING,
]

# All modules for full enrichment
ALL_MODULES = list(EnrichmentModule)

# Priority to integer mapping for queue ordering
PRIORITY_VALUES = {
    EnrichmentPriority.HIGH: 1,
    EnrichmentPriority.NORMAL: 5,
    EnrichmentPriority.LOW: 8,
    EnrichmentPriority.BATCH: 10,
}


@dataclass
class EnrichmentItem:
    """Represents a single item to be enriched."""
    id: str
    list_id: str
    item_id: str
    domain: str
    company_name: Optional[str]
    priority: int
    status: EnrichmentStatus
    pre_existing_data: Dict[str, Any] = field(default_factory=dict)
    enrichment_result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class EnrichmentJob:
    """Represents an enrichment job for a list."""
    id: str
    list_id: str
    total_items: int
    processed_items: int
    success_count: int
    error_count: int
    status: EnrichmentStatus
    priority: EnrichmentPriority
    modules: List[EnrichmentModule]
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    @property
    def progress_percent(self) -> float:
        """Calculate progress percentage."""
        if self.total_items == 0:
            return 0.0
        return (self.processed_items / self.total_items) * 100

    @property
    def estimated_remaining_seconds(self) -> Optional[float]:
        """Estimate remaining time based on current progress."""
        if not self.started_at or self.processed_items == 0:
            return None

        elapsed = (datetime.utcnow() - self.started_at).total_seconds()
        rate = self.processed_items / elapsed  # items per second

        if rate > 0:
            remaining_items = self.total_items - self.processed_items
            return remaining_items / rate

        return None

    def to_dict(self) -> Dict:
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "list_id": self.list_id,
            "total_items": self.total_items,
            "processed_items": self.processed_items,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "status": self.status.value,
            "priority": self.priority.value,
            "modules": [m.value for m in self.modules],
            "progress_percent": round(self.progress_percent, 1),
            "estimated_remaining_seconds": self.estimated_remaining_seconds,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
        }


@dataclass
class EnrichmentProgress:
    """Real-time progress information for an enrichment job."""
    job_id: str
    list_id: str
    status: EnrichmentStatus
    total_items: int
    processed_items: int
    success_count: int
    error_count: int
    current_domain: Optional[str]
    current_module: Optional[str]
    progress_percent: float
    estimated_remaining_seconds: Optional[float]
    recent_completions: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "job_id": self.job_id,
            "list_id": self.list_id,
            "status": self.status.value,
            "total_items": self.total_items,
            "processed_items": self.processed_items,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "current_domain": self.current_domain,
            "current_module": self.current_module,
            "progress_percent": round(self.progress_percent, 1),
            "estimated_remaining_seconds": self.estimated_remaining_seconds,
            "recent_completions": self.recent_completions,
        }


class ListEnrichmentService:
    """
    Manages enrichment processing for uploaded lists.

    Features:
    - Queue management for enrichment jobs
    - Progress tracking with real-time updates
    - Pre-existing data merging from CSV
    - Priority-based processing
    - Error handling and retry logic

    Usage:
        service = ListEnrichmentService(db_session)

        # Start enrichment for a validated list
        job = await service.start_enrichment(
            list_id="abc123",
            valid_items=validated_rows,
            priority=EnrichmentPriority.NORMAL,
            modules=DEFAULT_MODULES,
        )

        # Check progress
        progress = await service.get_progress(job.id)
        print(f"Progress: {progress.progress_percent}%")
    """

    MAX_RETRIES = 3
    BATCH_SIZE = 10  # Items to process in parallel

    def __init__(
        self,
        db_session: Any = None,
        redis_client: Any = None,
    ):
        """
        Initialize enrichment service.

        Args:
            db_session: Database session for persistence
            redis_client: Optional Redis client for queue management
        """
        self.db_session = db_session
        self.redis_client = redis_client

        # In-memory storage for development (replace with Redis/DB in production)
        self._jobs: Dict[str, EnrichmentJob] = {}
        self._items: Dict[str, List[EnrichmentItem]] = {}  # job_id -> items
        self._progress_callbacks: Dict[str, List[callable]] = {}

    async def start_enrichment(
        self,
        list_id: str,
        valid_items: List[Dict[str, Any]],
        priority: EnrichmentPriority = EnrichmentPriority.NORMAL,
        modules: Optional[List[EnrichmentModule]] = None,
        pre_existing_data: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> EnrichmentJob:
        """
        Start enrichment for a list of valid items.

        Args:
            list_id: ID of the uploaded list
            valid_items: List of validated row dictionaries
            priority: Processing priority
            modules: List of enrichment modules to run
            pre_existing_data: Optional dict mapping domain -> pre-existing data

        Returns:
            EnrichmentJob tracking the enrichment process
        """
        logger.info(
            f"Starting enrichment for list {list_id} with {len(valid_items)} items, "
            f"priority={priority.value}"
        )

        modules = modules or DEFAULT_MODULES
        pre_existing_data = pre_existing_data or {}

        # Create job
        job_id = str(uuid.uuid4())
        job = EnrichmentJob(
            id=job_id,
            list_id=list_id,
            total_items=len(valid_items),
            processed_items=0,
            success_count=0,
            error_count=0,
            status=EnrichmentStatus.QUEUED,
            priority=priority,
            modules=modules,
            created_at=datetime.utcnow(),
        )

        # Create items
        items: List[EnrichmentItem] = []
        for item_data in valid_items:
            domain = item_data.get("normalized_domain") or item_data.get("domain")

            # Get pre-existing data for this domain
            pre_data = pre_existing_data.get(domain, {})

            # Also check if CSV data has useful fields
            csv_pre_existing = self._extract_pre_existing_from_csv(item_data)
            merged_pre_existing = {**csv_pre_existing, **pre_data}

            enrichment_item = EnrichmentItem(
                id=str(uuid.uuid4()),
                list_id=list_id,
                item_id=item_data.get("item_id", str(uuid.uuid4())),
                domain=domain,
                company_name=item_data.get("company_name"),
                priority=PRIORITY_VALUES[priority],
                status=EnrichmentStatus.QUEUED,
                pre_existing_data=merged_pre_existing,
            )
            items.append(enrichment_item)

        # Store job and items
        self._jobs[job_id] = job
        self._items[job_id] = items

        # Queue items for processing
        await self._queue_items(job_id, items, priority)

        logger.info(f"Created enrichment job {job_id} with {len(items)} items queued")

        return job

    def _extract_pre_existing_from_csv(
        self,
        row_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Extract pre-existing data from CSV row to avoid redundant API calls.

        CSV may contain:
        - Revenue data (use if reasonable)
        - Traffic data (use if recent)
        - Industry classification
        - Tech stack hints from Demandbase

        Args:
            row_data: Parsed CSV row dictionary

        Returns:
            Dict of pre-existing data with source attribution
        """
        pre_existing: Dict[str, Any] = {}

        # Revenue (use if present and reasonable)
        revenue_keys = ["revenue", "annual_revenue", "arr", "expected_revenue"]
        for key in revenue_keys:
            value = row_data.get(key)
            if value and self._parse_numeric(value):
                pre_existing["revenue"] = {
                    "value": self._parse_numeric(value),
                    "source": "csv_import",
                    "column": key,
                }
                break

        # Traffic
        traffic_keys = ["traffic", "monthly_visits", "visits", "monthly_traffic"]
        for key in traffic_keys:
            value = row_data.get(key)
            if value and self._parse_numeric(value):
                pre_existing["traffic"] = {
                    "value": self._parse_numeric(value),
                    "source": "csv_import",
                    "column": key,
                }
                break

        # Industry
        industry_keys = ["industry", "vertical", "demandbase_industry"]
        for key in industry_keys:
            value = row_data.get(key)
            if value and isinstance(value, str) and value.strip():
                pre_existing["industry"] = {
                    "value": value.strip(),
                    "source": "csv_import",
                    "column": key,
                }
                break

        # Employee count
        employee_keys = ["employees", "employee_count", "headcount"]
        for key in employee_keys:
            value = row_data.get(key)
            if value and self._parse_numeric(value):
                pre_existing["employee_count"] = {
                    "value": int(self._parse_numeric(value)),
                    "source": "csv_import",
                    "column": key,
                }
                break

        # Tech stack hints (from Demandbase technology flags)
        tech_hints: Dict[str, bool] = {}
        for key, value in row_data.items():
            if key.endswith("_Technology") or key.endswith("_technology"):
                # e.g., "Algolia_Technology" = True
                if value and str(value).lower() in ("true", "yes", "1"):
                    tech_name = key.replace("_Technology", "").replace("_technology", "")
                    tech_name = tech_name.replace("_", " ")
                    tech_hints[tech_name] = True

        if tech_hints:
            pre_existing["tech_stack_hints"] = {
                "value": tech_hints,
                "source": "csv_import",
            }

        # Engagement score (for prioritization)
        engagement_keys = ["engagement_score", "engagement_points", "intent_score"]
        for key in engagement_keys:
            value = row_data.get(key)
            if value and self._parse_numeric(value):
                pre_existing["engagement_score"] = {
                    "value": self._parse_numeric(value),
                    "source": "csv_import",
                    "column": key,
                }
                break

        return pre_existing

    def _parse_numeric(self, value: Any) -> Optional[float]:
        """Parse a numeric value from various formats."""
        if value is None:
            return None

        if isinstance(value, (int, float)):
            return float(value)

        if isinstance(value, str):
            # Remove common formatting
            cleaned = value.strip()
            cleaned = cleaned.replace("$", "").replace(",", "")
            cleaned = cleaned.replace("M", "000000").replace("B", "000000000")
            cleaned = cleaned.replace("K", "000")

            try:
                return float(cleaned)
            except ValueError:
                return None

        return None

    async def _queue_items(
        self,
        job_id: str,
        items: List[EnrichmentItem],
        priority: EnrichmentPriority,
    ) -> None:
        """
        Queue items for processing.

        Args:
            job_id: Enrichment job ID
            items: List of items to queue
            priority: Processing priority
        """
        if self.redis_client:
            # Use Redis queue in production
            queue_name = f"enrichment:queue:{priority.value}"

            for item in items:
                await self.redis_client.lpush(
                    queue_name,
                    json.dumps({
                        "job_id": job_id,
                        "item_id": item.id,
                        "domain": item.domain,
                        "list_id": item.list_id,
                        "priority": item.priority,
                    })
                )
        else:
            # In-memory queue for development
            logger.debug(f"Queued {len(items)} items for job {job_id}")

    async def get_job(self, job_id: str) -> Optional[EnrichmentJob]:
        """Get an enrichment job by ID."""
        return self._jobs.get(job_id)

    async def get_progress(self, job_id: str) -> Optional[EnrichmentProgress]:
        """
        Get real-time progress for an enrichment job.

        Args:
            job_id: Enrichment job ID

        Returns:
            EnrichmentProgress with current status
        """
        job = self._jobs.get(job_id)
        if not job:
            return None

        items = self._items.get(job_id, [])

        # Find current item being processed
        current_item = next(
            (i for i in items if i.status == EnrichmentStatus.ENRICHING),
            None
        )

        # Get recent completions
        completed = [i for i in items if i.status == EnrichmentStatus.COMPLETED]
        recent_completions = [
            {
                "domain": i.domain,
                "completed_at": i.completed_at.isoformat() if i.completed_at else None,
            }
            for i in sorted(
                completed,
                key=lambda x: x.completed_at or datetime.min,
                reverse=True
            )[:5]
        ]

        return EnrichmentProgress(
            job_id=job_id,
            list_id=job.list_id,
            status=job.status,
            total_items=job.total_items,
            processed_items=job.processed_items,
            success_count=job.success_count,
            error_count=job.error_count,
            current_domain=current_item.domain if current_item else None,
            current_module=None,  # Would be updated by worker
            progress_percent=job.progress_percent,
            estimated_remaining_seconds=job.estimated_remaining_seconds,
            recent_completions=recent_completions,
        )

    async def update_item_status(
        self,
        job_id: str,
        item_id: str,
        status: EnrichmentStatus,
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Update the status of an enrichment item.

        Args:
            job_id: Enrichment job ID
            item_id: Item ID
            status: New status
            result: Enrichment result (if completed)
            error_message: Error message (if failed)
        """
        items = self._items.get(job_id, [])
        item = next((i for i in items if i.id == item_id), None)

        if not item:
            logger.warning(f"Item {item_id} not found in job {job_id}")
            return

        job = self._jobs.get(job_id)
        if not job:
            logger.warning(f"Job {job_id} not found")
            return

        # Update item
        item.status = status

        if status == EnrichmentStatus.ENRICHING:
            item.started_at = datetime.utcnow()
            if job.status == EnrichmentStatus.QUEUED:
                job.status = EnrichmentStatus.PROCESSING
                job.started_at = datetime.utcnow()

        elif status == EnrichmentStatus.COMPLETED:
            item.completed_at = datetime.utcnow()
            item.enrichment_result = result
            job.processed_items += 1
            job.success_count += 1

        elif status == EnrichmentStatus.FAILED:
            item.completed_at = datetime.utcnow()
            item.error_message = error_message
            item.retry_count += 1
            job.processed_items += 1
            job.error_count += 1

        # Check if job is complete
        if job.processed_items >= job.total_items:
            job.completed_at = datetime.utcnow()
            if job.error_count == 0:
                job.status = EnrichmentStatus.COMPLETED
            elif job.success_count == 0:
                job.status = EnrichmentStatus.FAILED
            else:
                job.status = EnrichmentStatus.PARTIAL

        logger.debug(
            f"Updated item {item_id} to {status.value}, "
            f"job progress: {job.processed_items}/{job.total_items}"
        )

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel an enrichment job.

        Args:
            job_id: Job ID to cancel

        Returns:
            True if cancelled, False if job not found or already complete
        """
        job = self._jobs.get(job_id)
        if not job:
            return False

        if job.status in (EnrichmentStatus.COMPLETED, EnrichmentStatus.FAILED):
            return False

        job.status = EnrichmentStatus.CANCELLED
        job.completed_at = datetime.utcnow()

        # Cancel queued items
        items = self._items.get(job_id, [])
        for item in items:
            if item.status in (EnrichmentStatus.QUEUED, EnrichmentStatus.PENDING):
                item.status = EnrichmentStatus.CANCELLED

        logger.info(f"Cancelled enrichment job {job_id}")
        return True

    async def retry_failed_items(self, job_id: str) -> int:
        """
        Retry failed items in a job.

        Args:
            job_id: Job ID

        Returns:
            Number of items queued for retry
        """
        items = self._items.get(job_id, [])
        job = self._jobs.get(job_id)

        if not items or not job:
            return 0

        retry_count = 0
        for item in items:
            if item.status == EnrichmentStatus.FAILED and item.retry_count < self.MAX_RETRIES:
                item.status = EnrichmentStatus.QUEUED
                item.error_message = None
                retry_count += 1

        if retry_count > 0:
            job.status = EnrichmentStatus.PROCESSING
            job.error_count -= retry_count
            job.processed_items -= retry_count
            await self._queue_items(
                job_id,
                [i for i in items if i.status == EnrichmentStatus.QUEUED],
                job.priority,
            )

        logger.info(f"Queued {retry_count} items for retry in job {job_id}")
        return retry_count

    async def get_job_results(
        self,
        job_id: str,
        include_failed: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Get enrichment results for a completed job.

        Args:
            job_id: Job ID
            include_failed: Include failed items in results

        Returns:
            List of enrichment results
        """
        items = self._items.get(job_id, [])

        results = []
        for item in items:
            if item.status == EnrichmentStatus.COMPLETED:
                results.append({
                    "domain": item.domain,
                    "company_name": item.company_name,
                    "status": "success",
                    "result": item.enrichment_result,
                    "pre_existing_data": item.pre_existing_data,
                })
            elif include_failed and item.status == EnrichmentStatus.FAILED:
                results.append({
                    "domain": item.domain,
                    "company_name": item.company_name,
                    "status": "failed",
                    "error": item.error_message,
                })

        return results

    async def merge_enrichment_with_csv(
        self,
        enrichment_result: Dict[str, Any],
        pre_existing_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Merge enrichment results with pre-existing CSV data.

        Strategy:
        - Enrichment data takes precedence for API-sourced fields
        - CSV data is preserved if enrichment didn't provide value
        - Source attribution is maintained for each field

        Args:
            enrichment_result: Result from enrichment modules
            pre_existing_data: Data extracted from CSV

        Returns:
            Merged result with source attribution
        """
        merged = enrichment_result.copy()

        # Fields where CSV data can supplement enrichment
        supplementable_fields = [
            "revenue", "traffic", "industry", "employee_count", "engagement_score"
        ]

        for field in supplementable_fields:
            # If enrichment didn't find this field, use CSV data
            if field not in merged or merged[field] is None:
                csv_value = pre_existing_data.get(field)
                if csv_value:
                    merged[field] = csv_value.get("value") if isinstance(csv_value, dict) else csv_value
                    merged[f"{field}_source"] = "csv_import"

            # Add CSV source info for comparison
            if field in pre_existing_data:
                merged[f"csv_{field}"] = pre_existing_data[field]

        # Preserve tech stack hints for validation
        if "tech_stack_hints" in pre_existing_data:
            merged["csv_tech_hints"] = pre_existing_data["tech_stack_hints"]

        return merged

    def get_stats(self) -> Dict[str, Any]:
        """Get overall enrichment service statistics."""
        total_jobs = len(self._jobs)
        active_jobs = sum(
            1 for j in self._jobs.values()
            if j.status in (EnrichmentStatus.QUEUED, EnrichmentStatus.PROCESSING)
        )
        completed_jobs = sum(
            1 for j in self._jobs.values()
            if j.status == EnrichmentStatus.COMPLETED
        )

        total_items = sum(len(items) for items in self._items.values())
        completed_items = sum(
            1 for items in self._items.values()
            for item in items
            if item.status == EnrichmentStatus.COMPLETED
        )

        return {
            "total_jobs": total_jobs,
            "active_jobs": active_jobs,
            "completed_jobs": completed_jobs,
            "total_items_processed": completed_items,
            "total_items_queued": total_items - completed_items,
        }
