"""
Arian Intelligence Orchestrator
======================================

Parallel execution engine for the 15-module intelligence pipeline.

This package provides:
- EnrichmentOrchestrator: Main orchestrator for domain enrichment
- BatchOrchestrator: Batch processing of multiple domains
- WaveExecutor: Wave-based parallel execution
- ProgressTracker: Real-time progress tracking

4-Wave Execution Model:
```
Wave 1 (Foundation):
  - M01: Company Context
  - M02: Technology Stack
  - M03: Traffic Analysis
  - M04: Financial Profile

Wave 2 (Competitive):
  - M05: Competitor Intelligence
  - M06: Hiring Signals
  - M07: Strategic Context

Wave 3 (Buying Signals):
  - M08: Investor Intelligence
  - M09: Executive Intelligence
  - M10: Buying Committee
  - M11: Displacement Analysis

Wave 4 (Synthesis):
  - M12: Case Study Matching
  - M13: ICP-Priority Mapping
  - M14: Signal Scoring
  - M15: Strategic Signal Brief
```

Usage:
    from pipeline.orchestrator import (
        EnrichmentOrchestrator,
        orchestrate_enrichment,
        EnrichmentResult,
    )

    # Simple usage
    result = await orchestrate_enrichment("costco.com")

    # With specific modules
    result = await orchestrate_enrichment(
        "costco.com",
        modules=["m01_company_context", "m02_technology_stack"]
    )

    # Full orchestrator with configuration
    orchestrator = EnrichmentOrchestrator(
        config=OrchestratorConfig(
            module_timeout_seconds=180,
            max_retries=3,
        )
    )
    result = await orchestrator.orchestrate("costco.com")

    # Batch processing
    batch_orchestrator = BatchOrchestrator(max_concurrent_domains=10)
    results = await batch_orchestrator.enrich_batch([
        "costco.com",
        "sallybeauty.com",
        "mercedes-benz.com",
    ])

References:
- docs/PARALLEL_EXECUTION_ARCHITECTURE.md
- docs/ORCHESTRATOR_DESIGN.md
- docs/INTELLIGENCE_MODULES_SPEC.md
"""

from pipeline.orchestrator.engine import (
    # Main orchestrator
    EnrichmentOrchestrator,
    BatchOrchestrator,
    # Configuration
    OrchestratorConfig,
    # Results
    EnrichmentResult,
    JobStatus,
    # Circuit breaker
    CircuitBreaker,
    CircuitState,
    # Convenience functions
    get_orchestrator,
    orchestrate_enrichment,
)

from pipeline.orchestrator.wave import (
    # Wave execution
    WaveExecutor,
    WaveResult,
    WaveStatus,
    # Wave definitions
    WAVE_DEFINITIONS,
    MODULE_DEPENDENCIES,
    # Utilities
    build_execution_plan,
    estimate_execution_time,
    get_modules_for_wave,
    get_wave_for_module,
    resolve_dependencies,
    filter_modules_by_request,
)

from pipeline.orchestrator.progress import (
    # Progress tracking
    ProgressTracker,
    ProgressManager,
    ProgressStatus,
    # Progress models
    JobProgress,
    WaveProgress,
    ModuleProgress,
    # Manager
    get_progress_manager,
)

__all__ = [
    # Main orchestrator
    "EnrichmentOrchestrator",
    "BatchOrchestrator",
    "OrchestratorConfig",
    # Results
    "EnrichmentResult",
    "JobStatus",
    # Circuit breaker
    "CircuitBreaker",
    "CircuitState",
    # Wave execution
    "WaveExecutor",
    "WaveResult",
    "WaveStatus",
    # Wave definitions
    "WAVE_DEFINITIONS",
    "MODULE_DEPENDENCIES",
    # Progress tracking
    "ProgressTracker",
    "ProgressManager",
    "ProgressStatus",
    "JobProgress",
    "WaveProgress",
    "ModuleProgress",
    # Convenience functions
    "get_orchestrator",
    "orchestrate_enrichment",
    "get_progress_manager",
    # Wave utilities
    "build_execution_plan",
    "estimate_execution_time",
    "get_modules_for_wave",
    "get_wave_for_module",
    "resolve_dependencies",
    "filter_modules_by_request",
]

__version__ = "1.0.0"
