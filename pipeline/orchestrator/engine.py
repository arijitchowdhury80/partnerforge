"""
Intelligence Orchestrator Engine
================================

Main orchestrator for parallel execution of intelligence modules.

The orchestrator:
1. Accepts enrichment requests for a domain
2. Builds an execution plan respecting module dependencies
3. Executes waves in sequence, modules within waves in parallel
4. Tracks progress and handles failures gracefully
5. Returns partial results if some modules fail
6. Integrates with caching for performance

4-Wave Execution Model:
- Wave 1 (Foundation): M01-M04 - No dependencies
- Wave 2 (Competitive): M05-M07 - Depends on Wave 1
- Wave 3 (Buying Signals): M08-M11 - Depends on Wave 2
- Wave 4 (Synthesis): M12-M15 - Depends on Wave 3

References:
- docs/PARALLEL_EXECUTION_ARCHITECTURE.md
- docs/ORCHESTRATOR_DESIGN.md
"""

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

from pydantic import BaseModel, Field

from pipeline.modules.base import (
    ModuleResult,
    ModuleStatus,
    get_module_class,
    instantiate_module,
)
from pipeline.orchestrator.wave import (
    WAVE_DEFINITIONS,
    MODULE_DEPENDENCIES,
    WaveExecutor,
    WaveResult,
    WaveStatus,
    build_execution_plan,
    estimate_execution_time,
    filter_modules_by_request,
    get_modules_for_wave,
    resolve_dependencies,
)
from pipeline.orchestrator.progress import (
    ProgressTracker,
    ProgressManager,
    ProgressStatus,
    get_progress_manager,
)

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Status of an enrichment job."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


class CircuitState(str, Enum):
    """Circuit breaker state."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Blocking requests
    HALF_OPEN = "half_open"  # Testing recovery


class EnrichmentResult(BaseModel):
    """
    Result of an enrichment orchestration.

    Contains all module results and execution metadata.
    """

    job_id: str = Field(..., description="Unique job identifier")
    domain: str = Field(..., description="Domain that was enriched")
    status: JobStatus = Field(..., description="Final job status")

    # Results
    results: Dict[str, Any] = Field(
        default_factory=dict,
        description="Module ID -> ModuleResult data"
    )

    # Module tracking
    completed_modules: List[str] = Field(
        default_factory=list,
        description="Successfully completed module IDs"
    )
    failed_modules: List[str] = Field(
        default_factory=list,
        description="Failed module IDs"
    )
    skipped_modules: List[str] = Field(
        default_factory=list,
        description="Skipped module IDs (dependencies failed)"
    )

    # Timing
    queued_at: Optional[datetime] = Field(None, description="When job was queued")
    started_at: Optional[datetime] = Field(None, description="When execution started")
    completed_at: Optional[datetime] = Field(None, description="When job completed")
    duration_ms: float = Field(default=0.0, description="Total execution time in ms")

    # Metadata
    wave_results: Dict[int, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Per-wave execution results"
    )
    errors: List[str] = Field(
        default_factory=list,
        description="Error messages"
    )
    cached_modules: List[str] = Field(
        default_factory=list,
        description="Modules served from cache"
    )

    # Metrics
    api_calls_count: int = Field(default=0, description="Total API calls made")
    retry_count: int = Field(default=0, description="Total retries across modules")

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        total = (
            len(self.completed_modules) +
            len(self.failed_modules) +
            len(self.skipped_modules)
        )
        if total == 0:
            return 0.0
        return (len(self.completed_modules) / total) * 100

    @property
    def is_successful(self) -> bool:
        """Check if enrichment was fully successful."""
        return self.status == JobStatus.COMPLETED

    @property
    def has_partial_results(self) -> bool:
        """Check if there are any usable results."""
        return len(self.completed_modules) > 0


@dataclass
class CircuitBreaker:
    """
    Circuit breaker for module execution.

    Prevents cascade failures by stopping execution after
    too many failures.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests blocked
    - HALF_OPEN: Testing if service recovered
    """

    name: str
    failure_threshold: int = 5
    recovery_timeout_seconds: int = 60
    expected_exceptions: tuple = field(default_factory=lambda: (TimeoutError, ConnectionError))

    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure_time: Optional[float] = None
    success_count: int = 0

    def record_success(self) -> None:
        """Record a successful execution."""
        self.failure_count = 0
        self.success_count += 1
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            logger.info(f"Circuit breaker {self.name} closed after recovery")

    def record_failure(self) -> None:
        """Record a failed execution."""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(
                f"Circuit breaker {self.name} opened after "
                f"{self.failure_count} failures"
            )

    def can_execute(self) -> bool:
        """Check if execution is allowed."""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self.last_failure_time:
                elapsed = time.time() - self.last_failure_time
                if elapsed >= self.recovery_timeout_seconds:
                    self.state = CircuitState.HALF_OPEN
                    logger.info(
                        f"Circuit breaker {self.name} entering half-open state"
                    )
                    return True
            return False

        # HALF_OPEN: allow one request to test
        return True

    def reset(self) -> None:
        """Reset circuit breaker to initial state."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.success_count = 0


class OrchestratorConfig(BaseModel):
    """Configuration for the enrichment orchestrator."""

    # Timeouts
    module_timeout_seconds: int = Field(
        default=120,
        description="Timeout for each module execution"
    )
    job_timeout_seconds: int = Field(
        default=600,
        description="Maximum time for entire job"
    )

    # Retry settings
    max_retries: int = Field(
        default=2,
        description="Maximum retries per module"
    )
    retry_backoff_base: float = Field(
        default=2.0,
        description="Exponential backoff base"
    )

    # Concurrency
    max_concurrent_modules: int = Field(
        default=10,
        description="Maximum modules executing in parallel"
    )

    # Circuit breaker
    circuit_breaker_threshold: int = Field(
        default=5,
        description="Failures before circuit opens"
    )
    circuit_breaker_recovery_seconds: int = Field(
        default=60,
        description="Time before circuit attempts recovery"
    )

    # Cache settings
    use_cache: bool = Field(
        default=True,
        description="Whether to use cached results"
    )
    cache_ttl_seconds: int = Field(
        default=86400,
        description="Cache TTL (24 hours default)"
    )
    force_refresh: bool = Field(
        default=False,
        description="Force refresh even if cached"
    )

    # Critical modules that abort job if they fail
    critical_modules: List[str] = Field(
        default_factory=lambda: ["m01_company_context"],
        description="Modules that must succeed"
    )


class EnrichmentOrchestrator:
    """
    Main orchestrator for parallel enrichment execution.

    Coordinates the execution of 15 intelligence modules across 4 waves,
    handling dependencies, parallelism, caching, and error recovery.

    Usage:
        orchestrator = EnrichmentOrchestrator()
        result = await orchestrator.orchestrate("costco.com")

        # With specific modules
        result = await orchestrator.orchestrate(
            "costco.com",
            modules=["m01_company_context", "m02_technology_stack"]
        )

        # Force refresh (ignore cache)
        result = await orchestrator.orchestrate(
            "costco.com",
            force_refresh=True
        )
    """

    def __init__(
        self,
        config: Optional[OrchestratorConfig] = None,
        progress_manager: Optional[ProgressManager] = None,
    ):
        """
        Initialize orchestrator.

        Args:
            config: Orchestrator configuration
            progress_manager: Progress manager for tracking
        """
        self.config = config or OrchestratorConfig()
        self.progress_manager = progress_manager or get_progress_manager()

        # Circuit breakers per module
        self._circuit_breakers: Dict[str, CircuitBreaker] = {}

        # Execution metrics
        self._total_jobs = 0
        self._successful_jobs = 0
        self._failed_jobs = 0

        self.logger = logging.getLogger(f"{__name__}.Orchestrator")

    async def orchestrate(
        self,
        domain: str,
        modules: Optional[List[str]] = None,
        force_refresh: bool = False,
        priority: int = 5,
    ) -> EnrichmentResult:
        """
        Execute enrichment for a domain.

        Args:
            domain: Domain to enrich (e.g., "costco.com")
            modules: Specific modules to run (None = all)
            force_refresh: Ignore cache and fetch fresh data
            priority: Job priority (1=highest, 10=lowest)

        Returns:
            EnrichmentResult with all module outputs
        """
        job_id = str(uuid.uuid4())
        queued_at = datetime.utcnow()

        self.logger.info(
            f"Starting enrichment job {job_id[:8]} for {domain}. "
            f"Modules: {modules or 'ALL'}, Force refresh: {force_refresh}"
        )

        # Build execution plan
        execution_plan = build_execution_plan(modules)
        all_modules = [m for _, wave_modules in execution_plan for m in wave_modules]

        # Estimate execution time
        estimate = estimate_execution_time(modules)
        estimated_seconds = estimate["parallel_estimate_seconds"]

        # Create progress tracker
        tracker = await self.progress_manager.create_tracker(
            job_id=job_id,
            domain=domain,
            modules=all_modules,
            estimated_seconds=estimated_seconds,
        )

        # Initialize result
        result = EnrichmentResult(
            job_id=job_id,
            domain=domain,
            status=JobStatus.QUEUED,
            queued_at=queued_at,
        )

        try:
            # Start execution
            await tracker.start()
            result.status = JobStatus.RUNNING
            result.started_at = datetime.utcnow()
            start_time = time.time()

            # Execute waves
            context: Dict[str, ModuleResult] = {}

            for wave_num, wave_modules in execution_plan:
                # Check if we should abort (critical module failed)
                if self._should_abort(result):
                    self.logger.warning(
                        f"Job {job_id[:8]} aborting due to critical module failure"
                    )
                    break

                # Execute wave
                wave_result = await self._execute_wave(
                    domain=domain,
                    wave_num=wave_num,
                    modules=wave_modules,
                    context=context,
                    tracker=tracker,
                    force_refresh=force_refresh,
                )

                # Process wave results
                result.wave_results[wave_num] = {
                    "status": wave_result.status.value,
                    "duration_ms": wave_result.duration_ms,
                    "successful": wave_result.successful_modules,
                    "failed": wave_result.failed_modules,
                }

                # Update context with successful results
                for module_id, module_result in wave_result.module_results.items():
                    if module_result.status == ModuleStatus.SUCCESS:
                        context[module_id] = module_result
                        result.completed_modules.append(module_id)
                        result.results[module_id] = module_result.data
                    else:
                        result.failed_modules.append(module_id)
                        if module_result.error_message:
                            result.errors.append(
                                f"{module_id}: {module_result.error_message}"
                            )

                # Check wave health
                if wave_result.status == WaveStatus.FAILED:
                    self.logger.error(
                        f"Wave {wave_num} completely failed in job {job_id[:8]}"
                    )

            # Calculate final status
            result.duration_ms = (time.time() - start_time) * 1000
            result.completed_at = datetime.utcnow()

            if not result.failed_modules:
                result.status = JobStatus.COMPLETED
                self._successful_jobs += 1
            elif result.completed_modules:
                result.status = JobStatus.PARTIAL
            else:
                result.status = JobStatus.FAILED
                self._failed_jobs += 1

            # Complete tracking
            await tracker.complete(success=result.is_successful)

            self._total_jobs += 1

            self.logger.info(
                f"Job {job_id[:8]} completed with status {result.status.value}. "
                f"Completed: {len(result.completed_modules)}, "
                f"Failed: {len(result.failed_modules)}, "
                f"Duration: {result.duration_ms:.0f}ms"
            )

            return result

        except asyncio.TimeoutError:
            result.status = JobStatus.FAILED
            result.completed_at = datetime.utcnow()
            result.errors.append(
                f"Job timeout after {self.config.job_timeout_seconds}s"
            )
            await tracker.add_error("Job timeout", critical=True)
            await tracker.complete(success=False)
            self._failed_jobs += 1
            return result

        except Exception as e:
            self.logger.exception(f"Job {job_id[:8]} failed with exception: {e}")
            result.status = JobStatus.FAILED
            result.completed_at = datetime.utcnow()
            result.errors.append(str(e))
            await tracker.add_error(str(e), critical=True)
            await tracker.complete(success=False)
            self._failed_jobs += 1
            return result

    async def _execute_wave(
        self,
        domain: str,
        wave_num: int,
        modules: List[str],
        context: Dict[str, ModuleResult],
        tracker: ProgressTracker,
        force_refresh: bool = False,
    ) -> WaveResult:
        """
        Execute a single wave of modules.

        Args:
            domain: Domain being enriched
            wave_num: Wave number (1-4)
            modules: List of module IDs in this wave
            context: Results from previous waves
            tracker: Progress tracker
            force_refresh: Force fresh data

        Returns:
            WaveResult with all module outcomes
        """
        self.logger.info(
            f"Executing Wave {wave_num} with {len(modules)} modules: "
            f"{', '.join(modules)}"
        )

        await tracker.start_wave(wave_num, modules)

        # Filter modules based on circuit breakers
        executable_modules = []
        skipped_modules = []

        for module_id in modules:
            cb = self._get_circuit_breaker(module_id)
            if cb.can_execute():
                executable_modules.append(module_id)
            else:
                skipped_modules.append(module_id)
                self.logger.warning(
                    f"Module {module_id} skipped - circuit breaker open"
                )

        # Create wave executor with progress callback
        def progress_callback(event: str, source: str, data: Dict) -> None:
            asyncio.create_task(self._handle_progress_event(tracker, event, data))

        executor = WaveExecutor(
            wave_number=wave_num,
            module_timeout_seconds=self.config.module_timeout_seconds,
            max_retries=self.config.max_retries,
            progress_callback=progress_callback,
        )

        # Execute the wave
        wave_result = await executor.execute(
            domain=domain,
            modules=executable_modules,
            context=context,
        )

        # Update circuit breakers based on results
        for module_id, module_result in wave_result.module_results.items():
            cb = self._get_circuit_breaker(module_id)
            if module_result.status == ModuleStatus.SUCCESS:
                cb.record_success()
            else:
                cb.record_failure()

        # Add skipped modules to result
        for module_id in skipped_modules:
            wave_result.module_results[module_id] = ModuleResult.create_error_result(
                module_id=module_id,
                domain=domain,
                error=Exception("Circuit breaker open"),
            )

        await tracker.complete_wave(
            wave_num,
            success=wave_result.status == WaveStatus.COMPLETED,
            duration_ms=wave_result.duration_ms,
        )

        return wave_result

    async def _handle_progress_event(
        self,
        tracker: ProgressTracker,
        event: str,
        data: Dict[str, Any],
    ) -> None:
        """Handle progress events from wave executor."""
        try:
            if event == "module_start":
                await tracker.start_module(data.get("module", ""))
            elif event == "module_complete":
                await tracker.complete_module(
                    data.get("module", ""),
                    success=data.get("status") == "success",
                    duration_ms=data.get("duration_ms", 0),
                    error_message=data.get("error"),
                )
            elif event == "module_timeout":
                await tracker.complete_module(
                    data.get("module", ""),
                    success=False,
                    error_message=f"Timeout after {data.get('timeout_seconds')}s",
                )
            elif event == "module_error":
                await tracker.complete_module(
                    data.get("module", ""),
                    success=False,
                    error_message=data.get("error"),
                )
        except Exception as e:
            self.logger.warning(f"Error handling progress event: {e}")

    def _should_abort(self, result: EnrichmentResult) -> bool:
        """Check if job should abort due to critical module failure."""
        for critical in self.config.critical_modules:
            if critical in result.failed_modules:
                return True
        return False

    def _get_circuit_breaker(self, module_id: str) -> CircuitBreaker:
        """Get or create circuit breaker for a module."""
        if module_id not in self._circuit_breakers:
            self._circuit_breakers[module_id] = CircuitBreaker(
                name=module_id,
                failure_threshold=self.config.circuit_breaker_threshold,
                recovery_timeout_seconds=self.config.circuit_breaker_recovery_seconds,
            )
        return self._circuit_breakers[module_id]

    def reset_circuit_breakers(self) -> None:
        """Reset all circuit breakers to closed state."""
        for cb in self._circuit_breakers.values():
            cb.reset()
        self.logger.info("All circuit breakers reset")

    def get_metrics(self) -> Dict[str, Any]:
        """Get orchestrator execution metrics."""
        return {
            "total_jobs": self._total_jobs,
            "successful_jobs": self._successful_jobs,
            "failed_jobs": self._failed_jobs,
            "success_rate": (
                (self._successful_jobs / self._total_jobs * 100)
                if self._total_jobs > 0 else 0.0
            ),
            "circuit_breakers": {
                module_id: {
                    "state": cb.state.value,
                    "failure_count": cb.failure_count,
                    "success_count": cb.success_count,
                }
                for module_id, cb in self._circuit_breakers.items()
            },
        }


class BatchOrchestrator:
    """
    Orchestrate parallel enrichment of multiple domains.

    Useful for batch processing of target lists.
    """

    def __init__(
        self,
        orchestrator: Optional[EnrichmentOrchestrator] = None,
        max_concurrent_domains: int = 5,
    ):
        """
        Initialize batch orchestrator.

        Args:
            orchestrator: Enrichment orchestrator to use
            max_concurrent_domains: Max domains to process in parallel
        """
        self.orchestrator = orchestrator or EnrichmentOrchestrator()
        self.max_concurrent = max_concurrent_domains
        self.logger = logging.getLogger(f"{__name__}.BatchOrchestrator")

    async def enrich_batch(
        self,
        domains: List[str],
        modules: Optional[List[str]] = None,
        force_refresh: bool = False,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
    ) -> Dict[str, EnrichmentResult]:
        """
        Enrich multiple domains in parallel batches.

        Args:
            domains: List of domains to enrich
            modules: Specific modules to run (None = all)
            force_refresh: Force fresh data
            progress_callback: Callback with (domain, completed, total)

        Returns:
            Dict mapping domain -> EnrichmentResult
        """
        self.logger.info(
            f"Starting batch enrichment for {len(domains)} domains "
            f"(max {self.max_concurrent} concurrent)"
        )

        semaphore = asyncio.Semaphore(self.max_concurrent)
        results: Dict[str, EnrichmentResult] = {}
        completed = 0
        total = len(domains)

        async def enrich_with_semaphore(domain: str) -> EnrichmentResult:
            nonlocal completed
            async with semaphore:
                result = await self.orchestrator.orchestrate(
                    domain=domain,
                    modules=modules,
                    force_refresh=force_refresh,
                )
                completed += 1
                if progress_callback:
                    progress_callback(domain, completed, total)
                return result

        # Execute all domains
        tasks = [enrich_with_semaphore(domain) for domain in domains]
        domain_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Map results
        for domain, result in zip(domains, domain_results):
            if isinstance(result, Exception):
                results[domain] = EnrichmentResult(
                    job_id=str(uuid.uuid4()),
                    domain=domain,
                    status=JobStatus.FAILED,
                    errors=[str(result)],
                )
            else:
                results[domain] = result

        # Log summary
        successful = sum(
            1 for r in results.values()
            if r.status in (JobStatus.COMPLETED, JobStatus.PARTIAL)
        )
        self.logger.info(
            f"Batch enrichment complete: {successful}/{total} successful"
        )

        return results


# Singleton orchestrator instance
_orchestrator: Optional[EnrichmentOrchestrator] = None


def get_orchestrator() -> EnrichmentOrchestrator:
    """Get or create the singleton orchestrator."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = EnrichmentOrchestrator()
    return _orchestrator


async def orchestrate_enrichment(
    domain: str,
    modules: Optional[List[str]] = None,
    force_refresh: bool = False,
) -> EnrichmentResult:
    """
    Convenience function for single-domain enrichment.

    Args:
        domain: Domain to enrich
        modules: Specific modules (None = all)
        force_refresh: Force fresh data

    Returns:
        EnrichmentResult
    """
    orchestrator = get_orchestrator()
    return await orchestrator.orchestrate(
        domain=domain,
        modules=modules,
        force_refresh=force_refresh,
    )
