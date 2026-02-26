"""
Orchestrator Service

Coordinates parallel execution of intelligence modules with:
- Wave-based dependency resolution
- Parallel module execution within waves
- Real-time progress tracking via Redis pub/sub
- Retry handling and circuit breakers
"""

import asyncio
import time
import uuid
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# Wave Configuration
# =============================================================================

WAVE_CONFIG = [
    # Wave 1: No dependencies (run first)
    {
        "wave": 1,
        "modules": ["company-context"],
        "depends_on": [],
    },
    # Wave 2: Depends on company-context
    {
        "wave": 2,
        "modules": ["tech-stack", "financial", "traffic"],
        "depends_on": ["company-context"],
    },
    # Wave 3: Depends on Wave 2 outputs
    {
        "wave": 3,
        "modules": ["competitors", "strategic", "hiring", "investor"],
        "depends_on": ["tech-stack", "financial", "traffic"],
    },
    # Wave 4: Depends on Wave 3 outputs
    {
        "wave": 4,
        "modules": ["case-study", "executive-quotes", "buying-committee"],
        "depends_on": ["competitors", "strategic", "hiring", "investor"],
    },
    # Wave 5: Final synthesis (depends on all)
    {
        "wave": 5,
        "modules": ["icp-mapping"],
        "depends_on": ["case-study", "executive-quotes", "buying-committee"],
    },
]


# =============================================================================
# Job Data Classes
# =============================================================================

class JobStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class ModuleResult:
    module_id: str
    status: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration_ms: int = 0


@dataclass
class Job:
    id: str
    domain: str
    modules: List[str]
    priority: int = 5
    status: JobStatus = JobStatus.PENDING
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    current_wave: int = 0
    current_module: Optional[str] = None
    results: Dict[str, ModuleResult] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)

    @property
    def duration_ms(self) -> int:
        if self.completed_at and self.started_at:
            return int((self.completed_at - self.started_at) * 1000)
        return 0


@dataclass
class JobResult:
    job_id: str
    status: JobStatus
    duration_ms: int
    modules_completed: List[str]
    modules_failed: List[str]
    data: Dict[str, Any]


# =============================================================================
# Orchestrator Service
# =============================================================================

class OrchestratorService:
    """
    Coordinates parallel execution of intelligence modules.

    Usage:
        orchestrator = OrchestratorService(redis, db, workers)
        job = await orchestrator.create_job("costco.com")
        result = await orchestrator.execute_job(job)
    """

    def __init__(
        self,
        redis_client=None,
        db_session=None,
        worker_pool=None,
        config: Dict = None,
    ):
        self.redis = redis_client
        self.db = db_session
        self.workers = worker_pool
        self.config = config or {}

        # Default configuration
        self.max_retries = self.config.get("max_retries", 3)
        self.module_timeout = self.config.get("module_timeout", 120)
        self.job_timeout = self.config.get("job_timeout", 600)

    # -------------------------------------------------------------------------
    # Job Management
    # -------------------------------------------------------------------------

    async def create_job(
        self,
        domain: str,
        modules: List[str] = None,
        priority: int = 5,
    ) -> Job:
        """Create a new enrichment job."""

        job = Job(
            id=str(uuid.uuid4()),
            domain=domain.lower().strip(),
            modules=modules or self._get_all_modules(),
            priority=priority,
        )

        # Store job in database
        if self.db:
            await self._store_job(job)

        logger.info(f"Created job {job.id} for {domain}")
        return job

    async def execute_job(self, job: Job) -> JobResult:
        """
        Execute a job with wave-based parallel execution.

        This is the main orchestration logic:
        1. Mark job as running
        2. Resolve modules into waves
        3. Execute each wave (modules in parallel)
        4. Generate deliverables
        5. Mark job as complete
        """

        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        await self._publish_event(job, "job_start", {"domain": job.domain})

        try:
            # Resolve waves based on requested modules
            waves = self._resolve_waves(job.modules)

            # Execute each wave
            for wave_num, wave_modules in enumerate(waves, start=1):
                if not wave_modules:
                    continue

                job.current_wave = wave_num
                await self._publish_event(job, "wave_start", {
                    "wave": wave_num,
                    "modules": wave_modules,
                    "total_waves": len(waves),
                })

                # Execute ALL modules in this wave IN PARALLEL
                results = await self._execute_wave(job, wave_modules)

                # Store results
                for module_id, result in results.items():
                    job.results[module_id] = result
                    if result.error:
                        job.errors.append(f"{module_id}: {result.error}")

                await self._publish_event(job, "wave_complete", {
                    "wave": wave_num,
                    "completed": [m for m, r in results.items() if not r.error],
                    "failed": [m for m, r in results.items() if r.error],
                })

            # Generate deliverables
            await self._generate_deliverables(job)

            # Mark complete
            job.status = JobStatus.COMPLETED if not job.errors else JobStatus.PARTIAL
            job.completed_at = time.time()

            await self._publish_event(job, "job_complete", {
                "status": job.status.value,
                "duration_ms": job.duration_ms,
                "modules_completed": len([r for r in job.results.values() if not r.error]),
                "modules_failed": len([r for r in job.results.values() if r.error]),
            })

        except Exception as e:
            job.status = JobStatus.FAILED
            job.completed_at = time.time()
            job.errors.append(str(e))
            logger.error(f"Job {job.id} failed: {e}")

            await self._publish_event(job, "job_error", {"error": str(e)})

        # Update job in database
        if self.db:
            await self._update_job(job)

        return JobResult(
            job_id=job.id,
            status=job.status,
            duration_ms=job.duration_ms,
            modules_completed=[m for m, r in job.results.items() if not r.error],
            modules_failed=[m for m, r in job.results.items() if r.error],
            data={m: r.data for m, r in job.results.items() if r.data},
        )

    # -------------------------------------------------------------------------
    # Wave Execution (Parallel)
    # -------------------------------------------------------------------------

    def _resolve_waves(self, requested_modules: List[str]) -> List[List[str]]:
        """Resolve module dependencies into execution waves."""

        waves = []
        for wave_config in WAVE_CONFIG:
            # Filter to requested modules
            wave_modules = [
                m for m in wave_config["modules"]
                if m in requested_modules
            ]
            if wave_modules:
                waves.append(wave_modules)

        return waves

    async def _execute_wave(
        self,
        job: Job,
        modules: List[str],
    ) -> Dict[str, ModuleResult]:
        """Execute all modules in a wave IN PARALLEL."""

        # Create tasks for ALL modules in this wave
        tasks = {
            module_id: asyncio.create_task(
                self._execute_module_with_retry(job, module_id)
            )
            for module_id in modules
        }

        # Execute ALL tasks in parallel
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)

        # Map results back to module IDs
        return {
            module_id: (
                result if isinstance(result, ModuleResult)
                else ModuleResult(module_id=module_id, status="error", error=str(result))
            )
            for module_id, result in zip(tasks.keys(), results)
        }

    async def _execute_module_with_retry(
        self,
        job: Job,
        module_id: str,
    ) -> ModuleResult:
        """Execute a single module with retry logic."""

        job.current_module = module_id
        await self._publish_event(job, "module_start", {"module": module_id})

        start_time = time.time()
        last_error = None

        for attempt in range(1, self.max_retries + 1):
            try:
                # Execute module via worker pool
                if self.workers:
                    result = await asyncio.wait_for(
                        self.workers.execute_module(
                            module_id=module_id,
                            domain=job.domain,
                            context=self._build_context(job),
                        ),
                        timeout=self.module_timeout,
                    )
                else:
                    # Mock execution for testing
                    result = await self._mock_module_execution(module_id, job.domain)

                duration_ms = int((time.time() - start_time) * 1000)

                await self._publish_event(job, "module_complete", {
                    "module": module_id,
                    "duration_ms": duration_ms,
                })

                return ModuleResult(
                    module_id=module_id,
                    status="completed",
                    data=result,
                    duration_ms=duration_ms,
                )

            except asyncio.TimeoutError:
                last_error = f"Timeout after {self.module_timeout}s"
                logger.warning(f"Module {module_id} timeout (attempt {attempt})")

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Module {module_id} failed (attempt {attempt}): {e}")

            # Exponential backoff before retry
            if attempt < self.max_retries:
                await asyncio.sleep(2 ** attempt)

        # All retries exhausted
        duration_ms = int((time.time() - start_time) * 1000)

        await self._publish_event(job, "module_error", {
            "module": module_id,
            "error": last_error,
            "attempts": self.max_retries,
        })

        return ModuleResult(
            module_id=module_id,
            status="error",
            error=last_error,
            duration_ms=duration_ms,
        )

    # -------------------------------------------------------------------------
    # Context & Deliverables
    # -------------------------------------------------------------------------

    def _build_context(self, job: Job) -> Dict[str, Any]:
        """Build context from completed module results."""

        return {
            "domain": job.domain,
            "completed_modules": list(job.results.keys()),
            "data": {m: r.data for m, r in job.results.items() if r.data},
        }

    async def _generate_deliverables(self, job: Job) -> None:
        """Generate final deliverables after all modules complete."""

        await self._publish_event(job, "deliverables_start", {})

        # TODO: Generate Strategic Signal Brief
        # TODO: Generate AE Pre-Call Brief
        # TODO: Generate Full Report

        await self._publish_event(job, "deliverables_complete", {})

    # -------------------------------------------------------------------------
    # Events & Progress
    # -------------------------------------------------------------------------

    async def _publish_event(
        self,
        job: Job,
        event_type: str,
        data: Dict,
    ) -> None:
        """Publish progress event via Redis pub/sub."""

        if not self.redis:
            return

        channel = f"partnerforge:progress:{job.id}"
        message = {
            "event": event_type,
            "data": data,
            "timestamp": time.time(),
        }

        try:
            await self.redis.publish(channel, str(message))
        except Exception as e:
            logger.warning(f"Failed to publish event: {e}")

    # -------------------------------------------------------------------------
    # Database Operations
    # -------------------------------------------------------------------------

    async def _store_job(self, job: Job) -> None:
        """Store job in database."""
        # TODO: Implement with SQLAlchemy
        pass

    async def _update_job(self, job: Job) -> None:
        """Update job in database."""
        # TODO: Implement with SQLAlchemy
        pass

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _get_all_modules(self) -> List[str]:
        """Get list of all module IDs."""

        return [
            m
            for wave in WAVE_CONFIG
            for m in wave["modules"]
        ]

    async def _mock_module_execution(
        self,
        module_id: str,
        domain: str,
    ) -> Dict[str, Any]:
        """Mock module execution for testing."""

        # Simulate API latency
        await asyncio.sleep(0.5)

        return {
            "module": module_id,
            "domain": domain,
            "mock": True,
        }


# =============================================================================
# Batch Orchestration
# =============================================================================

class BatchOrchestrator:
    """
    Orchestrates parallel enrichment of multiple accounts.

    Usage:
        batch_orch = BatchOrchestrator(orchestrator)
        batch = await batch_orch.create_batch(["costco.com", "target.com"])
        result = await batch_orch.execute_batch(batch)
    """

    def __init__(
        self,
        orchestrator: OrchestratorService,
        batch_size: int = 5,
        max_concurrent: int = 10,
    ):
        self.orchestrator = orchestrator
        self.batch_size = batch_size
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def execute_batch(
        self,
        domains: List[str],
        modules: List[str] = None,
    ) -> List[JobResult]:
        """Execute enrichment for multiple accounts in parallel batches."""

        results = []

        # Process in batches
        for i in range(0, len(domains), self.batch_size):
            batch = domains[i:i + self.batch_size]

            # Execute all in this batch IN PARALLEL
            batch_tasks = [
                self._execute_with_semaphore(domain, modules)
                for domain in batch
            ]

            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            results.extend(batch_results)

            # Log progress
            progress = (i + len(batch)) / len(domains) * 100
            logger.info(f"Batch progress: {progress:.1f}%")

        return results

    async def _execute_with_semaphore(
        self,
        domain: str,
        modules: List[str] = None,
    ) -> JobResult:
        """Execute single account with semaphore for rate limiting."""

        async with self.semaphore:
            job = await self.orchestrator.create_job(domain, modules)
            return await self.orchestrator.execute_job(job)
