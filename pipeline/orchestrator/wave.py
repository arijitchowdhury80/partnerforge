"""
Wave Execution Module
=====================

Handles wave-based parallel execution of intelligence modules.

The 4-Wave execution model ensures modules run in dependency order:
- Wave 1 (Foundation): M01-M04 - No dependencies, run first
- Wave 2 (Competitive): M05-M07 - Depends on Wave 1
- Wave 3 (Buying Signals): M08-M11 - Depends on Wave 2
- Wave 4 (Synthesis): M12-M15 - Depends on Wave 3

Within each wave, all modules execute in parallel using asyncio.gather().
Waves execute sequentially with a JOIN barrier between them.

References:
- docs/PARALLEL_EXECUTION_ARCHITECTURE.md
- docs/ORCHESTRATOR_DESIGN.md
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    get_module_class,
    get_modules_by_wave,
    instantiate_module,
)

logger = logging.getLogger(__name__)


class WaveStatus(str, Enum):
    """Status of wave execution."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"  # Some modules succeeded, some failed


@dataclass
class WaveResult:
    """Result of executing a single wave."""

    wave_number: int
    status: WaveStatus
    module_results: Dict[str, ModuleResult] = field(default_factory=dict)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: float = 0.0

    @property
    def successful_modules(self) -> List[str]:
        """Get list of successfully completed modules."""
        return [
            module_id for module_id, result in self.module_results.items()
            if result.status == ModuleStatus.SUCCESS
        ]

    @property
    def failed_modules(self) -> List[str]:
        """Get list of failed modules."""
        return [
            module_id for module_id, result in self.module_results.items()
            if result.status == ModuleStatus.FAILED
        ]

    @property
    def success_rate(self) -> float:
        """Calculate success rate for this wave."""
        if not self.module_results:
            return 0.0
        return len(self.successful_modules) / len(self.module_results) * 100


# Wave definitions with module IDs
WAVE_DEFINITIONS: Dict[int, List[str]] = {
    1: [
        "m01_company_context",
        "m02_technology_stack",
        "m03_traffic_analysis",
        "m04_financial_profile",
    ],
    2: [
        "m05_competitor_intelligence",
        "m06_hiring_signals",
        "m07_strategic_context",
    ],
    3: [
        "m08_investor_intelligence",
        "m09_executive_intelligence",
        "m10_buying_committee",
        "m11_displacement_analysis",
    ],
    4: [
        "m12_case_study_matching",
        "m13_icp_priority_mapping",
        "m14_signal_scoring",
        "m15_strategic_brief",
    ],
}

# Module dependencies (which modules must complete before this one can run)
MODULE_DEPENDENCIES: Dict[str, List[str]] = {
    # Wave 1: No dependencies
    "m01_company_context": [],
    "m02_technology_stack": [],
    "m03_traffic_analysis": [],
    "m04_financial_profile": [],

    # Wave 2: Depends on Wave 1
    "m05_competitor_intelligence": ["m01_company_context", "m02_technology_stack"],
    "m06_hiring_signals": ["m01_company_context"],
    "m07_strategic_context": ["m01_company_context"],

    # Wave 3: Depends on Wave 2
    "m08_investor_intelligence": ["m01_company_context", "m04_financial_profile"],
    "m09_executive_intelligence": ["m01_company_context", "m07_strategic_context"],
    "m10_buying_committee": ["m01_company_context", "m06_hiring_signals", "m09_executive_intelligence"],
    "m11_displacement_analysis": ["m02_technology_stack", "m05_competitor_intelligence"],

    # Wave 4: Depends on all previous
    "m12_case_study_matching": ["m01_company_context", "m02_technology_stack"],
    "m13_icp_priority_mapping": [
        "m01_company_context", "m03_traffic_analysis", "m04_financial_profile",
        "m02_technology_stack", "m05_competitor_intelligence"
    ],
    "m14_signal_scoring": [
        "m06_hiring_signals", "m07_strategic_context", "m08_investor_intelligence"
    ],
    "m15_strategic_brief": ["ALL"],  # Special marker: depends on all modules
}


def get_wave_for_module(module_id: str) -> Optional[int]:
    """Get the wave number for a given module ID."""
    for wave_num, modules in WAVE_DEFINITIONS.items():
        if module_id in modules:
            return wave_num
    return None


def get_modules_for_wave(wave_number: int) -> List[str]:
    """Get all module IDs for a specific wave."""
    return WAVE_DEFINITIONS.get(wave_number, [])


def resolve_dependencies(module_id: str, completed_modules: Set[str]) -> Tuple[bool, List[str]]:
    """
    Check if a module's dependencies are satisfied.

    Args:
        module_id: The module to check
        completed_modules: Set of module IDs that have completed successfully

    Returns:
        Tuple of (dependencies_met, list of missing dependencies)
    """
    deps = MODULE_DEPENDENCIES.get(module_id, [])

    # Special case: "ALL" means all other modules
    if deps == ["ALL"]:
        all_other_modules = set()
        for modules in WAVE_DEFINITIONS.values():
            all_other_modules.update(modules)
        all_other_modules.discard(module_id)
        deps = list(all_other_modules)

    missing = [dep for dep in deps if dep not in completed_modules]
    return len(missing) == 0, missing


def filter_modules_by_request(
    wave_modules: List[str],
    requested_modules: Optional[List[str]] = None,
) -> List[str]:
    """
    Filter wave modules to only include requested modules.

    Args:
        wave_modules: List of module IDs in a wave
        requested_modules: Optional list of specific modules to run

    Returns:
        Filtered list of module IDs
    """
    if requested_modules is None:
        return wave_modules
    return [m for m in wave_modules if m in requested_modules]


class WaveExecutor:
    """
    Executes a single wave of modules in parallel.

    Responsibilities:
    - Instantiate and execute modules concurrently
    - Handle module failures gracefully
    - Track execution metrics
    - Report progress via callbacks
    """

    def __init__(
        self,
        wave_number: int,
        module_timeout_seconds: int = 120,
        max_retries: int = 0,
        progress_callback: Optional[Callable[[str, str, Dict], None]] = None,
    ):
        """
        Initialize wave executor.

        Args:
            wave_number: The wave number (1-4)
            module_timeout_seconds: Timeout for each module
            max_retries: Number of retries for failed modules
            progress_callback: Optional callback for progress updates
        """
        self.wave_number = wave_number
        self.module_timeout = module_timeout_seconds
        self.max_retries = max_retries
        self.progress_callback = progress_callback
        self.logger = logging.getLogger(f"{__name__}.Wave{wave_number}")

    async def execute(
        self,
        domain: str,
        modules: List[str],
        context: Dict[str, ModuleResult],
    ) -> WaveResult:
        """
        Execute all modules in this wave in parallel.

        Args:
            domain: Domain being enriched
            modules: List of module IDs to execute
            context: Results from previous waves

        Returns:
            WaveResult with all module results
        """
        started_at = datetime.utcnow()
        start_time = time.time()

        self._emit_progress("wave_start", {
            "wave": self.wave_number,
            "modules": modules,
            "domain": domain,
        })

        self.logger.info(
            f"Starting Wave {self.wave_number} with {len(modules)} modules: "
            f"{', '.join(modules)}"
        )

        # Create tasks for all modules
        tasks = []
        for module_id in modules:
            task = self._execute_module_with_retry(domain, module_id, context)
            tasks.append(task)

        # Execute all modules in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Map results back to module IDs
        module_results: Dict[str, ModuleResult] = {}
        for module_id, result in zip(modules, results):
            if isinstance(result, Exception):
                # Create error result for exceptions
                module_results[module_id] = ModuleResult.create_error_result(
                    module_id=module_id,
                    domain=domain,
                    error=result,
                )
                self.logger.error(f"Module {module_id} raised exception: {result}")
            else:
                module_results[module_id] = result

        # Calculate metrics
        duration_ms = (time.time() - start_time) * 1000
        completed_at = datetime.utcnow()

        # Determine wave status
        failed_count = sum(
            1 for r in module_results.values()
            if r.status == ModuleStatus.FAILED
        )

        if failed_count == 0:
            status = WaveStatus.COMPLETED
        elif failed_count == len(modules):
            status = WaveStatus.FAILED
        else:
            status = WaveStatus.PARTIAL

        wave_result = WaveResult(
            wave_number=self.wave_number,
            status=status,
            module_results=module_results,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
        )

        self._emit_progress("wave_complete", {
            "wave": self.wave_number,
            "status": status.value,
            "success_rate": wave_result.success_rate,
            "duration_ms": duration_ms,
            "successful_modules": wave_result.successful_modules,
            "failed_modules": wave_result.failed_modules,
        })

        self.logger.info(
            f"Wave {self.wave_number} complete. Status: {status.value}, "
            f"Success rate: {wave_result.success_rate:.1f}%, "
            f"Duration: {duration_ms:.0f}ms"
        )

        return wave_result

    async def _execute_module_with_retry(
        self,
        domain: str,
        module_id: str,
        context: Dict[str, ModuleResult],
    ) -> ModuleResult:
        """
        Execute a single module with retry logic.

        Args:
            domain: Domain being enriched
            module_id: Module to execute
            context: Results from previous modules

        Returns:
            ModuleResult
        """
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                result = await self._execute_single_module(domain, module_id, context)

                if result.status == ModuleStatus.SUCCESS:
                    return result

                # If module failed but didn't raise, check if we should retry
                if attempt < self.max_retries:
                    self.logger.warning(
                        f"Module {module_id} failed (attempt {attempt + 1}), retrying..."
                    )
                    await asyncio.sleep(1.0 * (2 ** attempt))  # Exponential backoff
                else:
                    return result

            except asyncio.TimeoutError:
                last_error = TimeoutError(
                    f"Module {module_id} timed out after {self.module_timeout}s"
                )
                if attempt < self.max_retries:
                    self.logger.warning(
                        f"Module {module_id} timed out (attempt {attempt + 1}), retrying..."
                    )
                    await asyncio.sleep(1.0 * (2 ** attempt))

            except Exception as e:
                last_error = e
                if attempt < self.max_retries:
                    self.logger.warning(
                        f"Module {module_id} error (attempt {attempt + 1}): {e}, retrying..."
                    )
                    await asyncio.sleep(1.0 * (2 ** attempt))

        # All retries exhausted
        return ModuleResult.create_error_result(
            module_id=module_id,
            domain=domain,
            error=last_error or Exception("Unknown error"),
        )

    async def _execute_single_module(
        self,
        domain: str,
        module_id: str,
        context: Dict[str, ModuleResult],
    ) -> ModuleResult:
        """
        Execute a single module with timeout.

        Args:
            domain: Domain being enriched
            module_id: Module to execute
            context: Results from previous modules

        Returns:
            ModuleResult
        """
        self._emit_progress("module_start", {
            "wave": self.wave_number,
            "module": module_id,
            "domain": domain,
        })

        start_time = time.time()

        # Instantiate the module
        module = instantiate_module(module_id)
        if module is None:
            return ModuleResult.create_error_result(
                module_id=module_id,
                domain=domain,
                error=ValueError(f"Module {module_id} not found in registry"),
            )

        try:
            # Execute with timeout
            result = await asyncio.wait_for(
                module.execute(domain, context),
                timeout=self.module_timeout,
            )

            duration_ms = (time.time() - start_time) * 1000

            self._emit_progress("module_complete", {
                "wave": self.wave_number,
                "module": module_id,
                "status": result.status.value,
                "duration_ms": duration_ms,
            })

            self.logger.debug(
                f"Module {module_id} completed with status {result.status.value} "
                f"in {duration_ms:.0f}ms"
            )

            return result

        except asyncio.TimeoutError:
            duration_ms = (time.time() - start_time) * 1000

            self._emit_progress("module_timeout", {
                "wave": self.wave_number,
                "module": module_id,
                "timeout_seconds": self.module_timeout,
            })

            raise

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            self._emit_progress("module_error", {
                "wave": self.wave_number,
                "module": module_id,
                "error": str(e),
                "error_type": type(e).__name__,
            })

            raise

    def _emit_progress(self, event: str, data: Dict[str, Any]) -> None:
        """Emit progress event through callback if registered."""
        if self.progress_callback:
            try:
                self.progress_callback(event, f"wave_{self.wave_number}", data)
            except Exception as e:
                self.logger.warning(f"Progress callback error: {e}")


def build_execution_plan(
    requested_modules: Optional[List[str]] = None,
) -> List[Tuple[int, List[str]]]:
    """
    Build an execution plan respecting dependencies.

    Args:
        requested_modules: Optional list of specific modules to run.
                          If None, runs all modules.

    Returns:
        List of (wave_number, module_ids) tuples in execution order
    """
    plan: List[Tuple[int, List[str]]] = []

    for wave_num in sorted(WAVE_DEFINITIONS.keys()):
        wave_modules = get_modules_for_wave(wave_num)
        filtered = filter_modules_by_request(wave_modules, requested_modules)

        if filtered:
            plan.append((wave_num, filtered))

    return plan


def estimate_execution_time(
    requested_modules: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Estimate total execution time for an enrichment run.

    Uses average module execution times to provide estimate.

    Args:
        requested_modules: Optional list of specific modules

    Returns:
        Dict with estimated times
    """
    # Average execution times per module (in seconds)
    MODULE_AVG_TIMES = {
        "m01_company_context": 10,
        "m02_technology_stack": 15,
        "m03_traffic_analysis": 8,
        "m04_financial_profile": 12,
        "m05_competitor_intelligence": 20,
        "m06_hiring_signals": 12,
        "m07_strategic_context": 8,
        "m08_investor_intelligence": 15,
        "m09_executive_intelligence": 10,
        "m10_buying_committee": 8,
        "m11_displacement_analysis": 12,
        "m12_case_study_matching": 5,
        "m13_icp_priority_mapping": 8,
        "m14_signal_scoring": 5,
        "m15_strategic_brief": 10,
    }

    plan = build_execution_plan(requested_modules)

    wave_estimates = []
    total_parallel_time = 0
    total_sequential_time = 0

    for wave_num, modules in plan:
        module_times = [MODULE_AVG_TIMES.get(m, 10) for m in modules]
        wave_max = max(module_times) if module_times else 0
        wave_sum = sum(module_times)

        wave_estimates.append({
            "wave": wave_num,
            "modules": modules,
            "parallel_time_seconds": wave_max,
            "sequential_time_seconds": wave_sum,
        })

        total_parallel_time += wave_max
        total_sequential_time += wave_sum

    return {
        "parallel_estimate_seconds": total_parallel_time,
        "sequential_estimate_seconds": total_sequential_time,
        "speedup_factor": (
            total_sequential_time / total_parallel_time
            if total_parallel_time > 0 else 1.0
        ),
        "waves": wave_estimates,
    }
