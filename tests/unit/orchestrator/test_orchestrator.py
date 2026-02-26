"""
Unit Tests for Intelligence Orchestrator
=========================================

Tests for the parallel execution engine including:
- Wave execution
- Progress tracking
- Circuit breakers
- Dependency resolution
- Error handling

Run tests:
    pytest tests/unit/orchestrator/test_orchestrator.py -v
"""

import asyncio
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, List, Optional

from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    register_module,
)
from pipeline.models.source import SourceCitation, SourceType
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
    get_wave_for_module,
    resolve_dependencies,
)
from pipeline.orchestrator.progress import (
    JobProgress,
    ModuleProgress,
    ProgressManager,
    ProgressStatus,
    ProgressTracker,
    WaveProgress,
)
from pipeline.orchestrator.engine import (
    BatchOrchestrator,
    CircuitBreaker,
    CircuitState,
    EnrichmentOrchestrator,
    EnrichmentResult,
    JobStatus,
    OrchestratorConfig,
    orchestrate_enrichment,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def sample_citation() -> SourceCitation:
    """Create a sample source citation for tests."""
    return SourceCitation(
        source_type=SourceType.WEBSEARCH,
        source_url="https://example.com/test",
        retrieved_at=datetime.utcnow(),
        confidence_score=0.9,
    )


@pytest.fixture
def sample_module_result(sample_citation: SourceCitation) -> ModuleResult:
    """Create a sample module result for tests."""
    return ModuleResult(
        module_id="m01_company_context",
        domain="example.com",
        status=ModuleStatus.SUCCESS,
        data={"company_name": "Example Corp"},
        primary_citation=sample_citation,
        duration_ms=100.0,
    )


@pytest.fixture
def orchestrator_config() -> OrchestratorConfig:
    """Create a test orchestrator configuration."""
    return OrchestratorConfig(
        module_timeout_seconds=10,
        job_timeout_seconds=60,
        max_retries=1,
        circuit_breaker_threshold=3,
        circuit_breaker_recovery_seconds=10,
    )


@pytest.fixture
def progress_manager() -> ProgressManager:
    """Create a fresh progress manager for tests."""
    return ProgressManager(retention_seconds=60)


# =============================================================================
# Wave Module Tests
# =============================================================================


class TestWaveDefinitions:
    """Tests for wave definitions and dependencies."""

    def test_wave_definitions_has_four_waves(self):
        """Verify there are exactly 4 waves defined."""
        assert len(WAVE_DEFINITIONS) == 4

    def test_wave_1_has_foundation_modules(self):
        """Wave 1 should contain the foundation modules."""
        wave_1 = get_modules_for_wave(1)
        assert "m01_company_context" in wave_1
        assert "m02_technology_stack" in wave_1
        assert "m03_traffic_analysis" in wave_1
        assert "m04_financial_profile" in wave_1

    def test_wave_2_has_competitive_modules(self):
        """Wave 2 should contain competitive modules."""
        wave_2 = get_modules_for_wave(2)
        assert "m05_competitor_intelligence" in wave_2
        assert "m06_hiring_signals" in wave_2
        assert "m07_strategic_context" in wave_2

    def test_wave_3_has_buying_signal_modules(self):
        """Wave 3 should contain buying signal modules."""
        wave_3 = get_modules_for_wave(3)
        assert "m08_investor_intelligence" in wave_3
        assert "m09_executive_intelligence" in wave_3
        assert "m10_buying_committee" in wave_3
        assert "m11_displacement_analysis" in wave_3

    def test_wave_4_has_synthesis_modules(self):
        """Wave 4 should contain synthesis modules."""
        wave_4 = get_modules_for_wave(4)
        assert "m12_case_study_matching" in wave_4
        assert "m13_icp_priority_mapping" in wave_4
        assert "m14_signal_scoring" in wave_4
        assert "m15_strategic_brief" in wave_4

    def test_all_modules_have_dependencies_defined(self):
        """Every module should have a dependency entry."""
        all_modules = []
        for modules in WAVE_DEFINITIONS.values():
            all_modules.extend(modules)

        for module_id in all_modules:
            assert module_id in MODULE_DEPENDENCIES, \
                f"Module {module_id} missing from MODULE_DEPENDENCIES"

    def test_wave_1_modules_have_no_dependencies(self):
        """Wave 1 modules should have no dependencies."""
        for module_id in get_modules_for_wave(1):
            deps = MODULE_DEPENDENCIES[module_id]
            assert deps == [], f"Wave 1 module {module_id} has unexpected deps: {deps}"


class TestDependencyResolution:
    """Tests for dependency resolution logic."""

    def test_resolve_dependencies_with_all_met(self):
        """Dependencies should resolve when all are completed."""
        completed = {"m01_company_context", "m02_technology_stack"}
        is_met, missing = resolve_dependencies(
            "m05_competitor_intelligence",
            completed
        )
        assert is_met is True
        assert missing == []

    def test_resolve_dependencies_with_missing(self):
        """Should identify missing dependencies."""
        completed = {"m01_company_context"}  # Missing m02_technology_stack
        is_met, missing = resolve_dependencies(
            "m05_competitor_intelligence",
            completed
        )
        assert is_met is False
        assert "m02_technology_stack" in missing

    def test_resolve_dependencies_wave_1_always_met(self):
        """Wave 1 modules have no deps, should always be met."""
        is_met, missing = resolve_dependencies("m01_company_context", set())
        assert is_met is True
        assert missing == []


class TestWaveForModule:
    """Tests for wave lookup functions."""

    def test_get_wave_for_wave_1_module(self):
        """Should return 1 for Wave 1 modules."""
        assert get_wave_for_module("m01_company_context") == 1
        assert get_wave_for_module("m04_financial_profile") == 1

    def test_get_wave_for_wave_4_module(self):
        """Should return 4 for Wave 4 modules."""
        assert get_wave_for_module("m15_strategic_brief") == 4

    def test_get_wave_for_unknown_module(self):
        """Should return None for unknown modules."""
        assert get_wave_for_module("m99_unknown") is None


class TestBuildExecutionPlan:
    """Tests for execution plan building."""

    def test_build_full_execution_plan(self):
        """Should build plan for all 4 waves."""
        plan = build_execution_plan()
        assert len(plan) == 4
        wave_nums = [w[0] for w in plan]
        assert wave_nums == [1, 2, 3, 4]

    def test_build_execution_plan_with_specific_modules(self):
        """Should filter to requested modules only."""
        plan = build_execution_plan(["m01_company_context", "m02_technology_stack"])
        assert len(plan) == 1  # Only Wave 1
        assert plan[0][0] == 1
        assert set(plan[0][1]) == {"m01_company_context", "m02_technology_stack"}

    def test_build_execution_plan_cross_wave(self):
        """Should include waves for all requested modules."""
        plan = build_execution_plan([
            "m01_company_context",
            "m05_competitor_intelligence",
        ])
        assert len(plan) == 2
        wave_nums = [w[0] for w in plan]
        assert wave_nums == [1, 2]


class TestFilterModules:
    """Tests for module filtering."""

    def test_filter_with_no_request_returns_all(self):
        """Should return all modules when no filter specified."""
        wave_modules = ["m01", "m02", "m03"]
        result = filter_modules_by_request(wave_modules, None)
        assert result == wave_modules

    def test_filter_with_request(self):
        """Should filter to only requested modules."""
        wave_modules = ["m01", "m02", "m03"]
        result = filter_modules_by_request(wave_modules, ["m01", "m03"])
        assert result == ["m01", "m03"]

    def test_filter_with_non_matching_request(self):
        """Should return empty list if no match."""
        wave_modules = ["m01", "m02"]
        result = filter_modules_by_request(wave_modules, ["m05"])
        assert result == []


class TestEstimateExecutionTime:
    """Tests for execution time estimation."""

    def test_estimate_for_all_modules(self):
        """Should provide estimate for full enrichment."""
        estimate = estimate_execution_time()
        assert "parallel_estimate_seconds" in estimate
        assert "sequential_estimate_seconds" in estimate
        assert "speedup_factor" in estimate
        assert "waves" in estimate
        assert estimate["parallel_estimate_seconds"] > 0
        assert estimate["speedup_factor"] > 1.0  # Parallel should be faster

    def test_estimate_for_single_wave(self):
        """Should estimate for single wave correctly."""
        estimate = estimate_execution_time(["m01_company_context"])
        assert len(estimate["waves"]) == 1


# =============================================================================
# Wave Executor Tests
# =============================================================================


class TestWaveExecutor:
    """Tests for WaveExecutor."""

    @pytest.mark.asyncio
    async def test_wave_executor_success(self, sample_citation):
        """Should execute all modules in parallel."""
        # Mock the module instantiation
        with patch('pipeline.orchestrator.wave.instantiate_module') as mock_instantiate:
            # Create a mock module that returns success
            mock_module = AsyncMock()
            mock_module.execute.return_value = ModuleResult(
                module_id="m01_company_context",
                domain="test.com",
                status=ModuleStatus.SUCCESS,
                data={},
                primary_citation=sample_citation,
            )
            mock_instantiate.return_value = mock_module

            executor = WaveExecutor(
                wave_number=1,
                module_timeout_seconds=10,
            )

            result = await executor.execute(
                domain="test.com",
                modules=["m01_company_context"],
                context={},
            )

            assert result.status == WaveStatus.COMPLETED
            assert "m01_company_context" in result.module_results

    @pytest.mark.asyncio
    async def test_wave_executor_handles_timeout(self):
        """Should handle module timeout gracefully."""
        with patch('pipeline.orchestrator.wave.instantiate_module') as mock_instantiate:
            # Create a mock module that times out
            mock_module = AsyncMock()
            mock_module.execute = AsyncMock(side_effect=asyncio.sleep(10))
            mock_instantiate.return_value = mock_module

            executor = WaveExecutor(
                wave_number=1,
                module_timeout_seconds=0.1,  # Very short timeout
            )

            result = await executor.execute(
                domain="test.com",
                modules=["m01_company_context"],
                context={},
            )

            assert result.status in (WaveStatus.FAILED, WaveStatus.PARTIAL)

    @pytest.mark.asyncio
    async def test_wave_executor_partial_success(self, sample_citation):
        """Should report partial when some modules fail."""
        with patch('pipeline.orchestrator.wave.instantiate_module') as mock_instantiate:
            # First module succeeds, second fails
            call_count = [0]

            def mock_instantiate_side_effect(module_id):
                call_count[0] += 1
                mock_module = AsyncMock()
                if "m01" in module_id:
                    mock_module.execute.return_value = ModuleResult(
                        module_id=module_id,
                        domain="test.com",
                        status=ModuleStatus.SUCCESS,
                        data={},
                        primary_citation=sample_citation,
                    )
                else:
                    mock_module.execute.return_value = ModuleResult.create_error_result(
                        module_id=module_id,
                        domain="test.com",
                        error=Exception("Test failure"),
                    )
                return mock_module

            mock_instantiate.side_effect = mock_instantiate_side_effect

            executor = WaveExecutor(wave_number=1, module_timeout_seconds=10)

            result = await executor.execute(
                domain="test.com",
                modules=["m01_company_context", "m02_technology_stack"],
                context={},
            )

            assert result.status == WaveStatus.PARTIAL
            assert len(result.successful_modules) == 1
            assert len(result.failed_modules) == 1


# =============================================================================
# Progress Tracking Tests
# =============================================================================


class TestProgressTracker:
    """Tests for ProgressTracker."""

    @pytest.mark.asyncio
    async def test_tracker_initialization(self):
        """Should initialize with correct state."""
        tracker = ProgressTracker(
            job_id="test-job",
            domain="test.com",
            modules=["m01", "m02"],
            estimated_seconds=30.0,
        )

        assert tracker.progress.status == ProgressStatus.QUEUED
        assert len(tracker.progress.modules) == 2
        assert tracker.progress.overall_percent == 0

    @pytest.mark.asyncio
    async def test_tracker_start(self):
        """Should transition to running on start."""
        tracker = ProgressTracker(
            job_id="test-job",
            domain="test.com",
            modules=["m01"],
            estimated_seconds=30.0,
        )

        await tracker.start()

        assert tracker.progress.status == ProgressStatus.RUNNING
        assert tracker.progress.started_at is not None

    @pytest.mark.asyncio
    async def test_tracker_module_progress(self):
        """Should track module progress correctly."""
        tracker = ProgressTracker(
            job_id="test-job",
            domain="test.com",
            modules=["m01", "m02"],
            estimated_seconds=30.0,
        )

        await tracker.start()
        await tracker.start_module("m01")

        assert tracker.progress.modules["m01"].status == ModuleStatus.RUNNING

        await tracker.complete_module("m01", success=True, duration_ms=100)

        assert tracker.progress.modules["m01"].status == ModuleStatus.SUCCESS
        assert tracker.progress.overall_percent == 50

    @pytest.mark.asyncio
    async def test_tracker_complete(self):
        """Should calculate final status correctly."""
        tracker = ProgressTracker(
            job_id="test-job",
            domain="test.com",
            modules=["m01"],
            estimated_seconds=30.0,
        )

        await tracker.start()
        await tracker.complete_module("m01", success=True)
        await tracker.complete(success=True)

        assert tracker.progress.status == ProgressStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_tracker_event_streaming(self):
        """Should emit events to subscribers."""
        tracker = ProgressTracker(
            job_id="test-job",
            domain="test.com",
            modules=["m01"],
            estimated_seconds=30.0,
        )

        events = []
        queue = await tracker.subscribe()

        async def collect_events():
            try:
                while True:
                    event = await asyncio.wait_for(queue.get(), timeout=1.0)
                    events.append(event)
                    if event.get("event") == "job_complete":
                        break
            except asyncio.TimeoutError:
                pass

        # Start collecting events
        collector = asyncio.create_task(collect_events())

        # Generate events
        await tracker.start()
        await tracker.complete_module("m01", success=True)
        await tracker.complete(success=True)

        await collector

        assert len(events) >= 3  # At least start, module, complete
        event_types = [e["event"] for e in events]
        assert "job_start" in event_types
        assert "job_complete" in event_types


class TestProgressManager:
    """Tests for ProgressManager."""

    @pytest.mark.asyncio
    async def test_create_and_get_tracker(self, progress_manager):
        """Should create and retrieve trackers."""
        tracker = await progress_manager.create_tracker(
            job_id="test-1",
            domain="test.com",
            modules=["m01"],
        )

        retrieved = await progress_manager.get_tracker("test-1")
        assert retrieved is tracker

    @pytest.mark.asyncio
    async def test_get_nonexistent_tracker(self, progress_manager):
        """Should return None for unknown job."""
        tracker = await progress_manager.get_tracker("nonexistent")
        assert tracker is None

    @pytest.mark.asyncio
    async def test_list_active_jobs(self, progress_manager):
        """Should list only running jobs."""
        # Create two trackers
        tracker1 = await progress_manager.create_tracker(
            job_id="job-1",
            domain="test1.com",
            modules=["m01"],
        )
        tracker2 = await progress_manager.create_tracker(
            job_id="job-2",
            domain="test2.com",
            modules=["m01"],
        )

        # Start only one
        await tracker1.start()

        active = await progress_manager.list_active_jobs()
        assert len(active) == 1
        assert active[0]["job_id"] == "job-1"


# =============================================================================
# Circuit Breaker Tests
# =============================================================================


class TestCircuitBreaker:
    """Tests for CircuitBreaker."""

    def test_initial_state_is_closed(self):
        """Circuit should start in closed state."""
        cb = CircuitBreaker(name="test", failure_threshold=3)
        assert cb.state == CircuitState.CLOSED
        assert cb.can_execute() is True

    def test_opens_after_threshold(self):
        """Circuit should open after threshold failures."""
        cb = CircuitBreaker(name="test", failure_threshold=3)

        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED

        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.can_execute() is False

    def test_success_resets_failure_count(self):
        """Success should reset the failure counter."""
        cb = CircuitBreaker(name="test", failure_threshold=3)

        cb.record_failure()
        cb.record_failure()
        cb.record_success()

        assert cb.failure_count == 0
        assert cb.state == CircuitState.CLOSED

    def test_half_open_on_recovery_timeout(self):
        """Should transition to half-open after recovery timeout."""
        cb = CircuitBreaker(
            name="test",
            failure_threshold=1,
            recovery_timeout_seconds=0,  # Immediate recovery
        )

        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        # Should transition to half-open
        assert cb.can_execute() is True
        assert cb.state == CircuitState.HALF_OPEN

    def test_reset_returns_to_closed(self):
        """Reset should return to initial state."""
        cb = CircuitBreaker(name="test", failure_threshold=1)
        cb.record_failure()
        cb.reset()

        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0


# =============================================================================
# Orchestrator Engine Tests
# =============================================================================


class TestOrchestratorConfig:
    """Tests for OrchestratorConfig."""

    def test_default_config(self):
        """Should have sensible defaults."""
        config = OrchestratorConfig()

        assert config.module_timeout_seconds == 120
        assert config.job_timeout_seconds == 600
        assert config.max_retries == 2
        assert config.use_cache is True
        assert "m01_company_context" in config.critical_modules

    def test_custom_config(self):
        """Should accept custom values."""
        config = OrchestratorConfig(
            module_timeout_seconds=60,
            max_retries=5,
        )

        assert config.module_timeout_seconds == 60
        assert config.max_retries == 5


class TestEnrichmentResult:
    """Tests for EnrichmentResult."""

    def test_success_rate_calculation(self):
        """Should calculate success rate correctly."""
        result = EnrichmentResult(
            job_id="test",
            domain="test.com",
            status=JobStatus.PARTIAL,
            completed_modules=["m01", "m02", "m03"],
            failed_modules=["m04"],
            skipped_modules=["m05"],
        )

        assert result.success_rate == 60.0  # 3 out of 5

    def test_is_successful(self):
        """Should identify successful jobs."""
        success = EnrichmentResult(
            job_id="test",
            domain="test.com",
            status=JobStatus.COMPLETED,
        )
        failure = EnrichmentResult(
            job_id="test",
            domain="test.com",
            status=JobStatus.FAILED,
        )

        assert success.is_successful is True
        assert failure.is_successful is False

    def test_has_partial_results(self):
        """Should detect partial results."""
        partial = EnrichmentResult(
            job_id="test",
            domain="test.com",
            status=JobStatus.PARTIAL,
            completed_modules=["m01"],
        )
        empty = EnrichmentResult(
            job_id="test",
            domain="test.com",
            status=JobStatus.FAILED,
        )

        assert partial.has_partial_results is True
        assert empty.has_partial_results is False


class TestEnrichmentOrchestrator:
    """Tests for EnrichmentOrchestrator."""

    @pytest.mark.asyncio
    async def test_orchestrate_creates_job_id(
        self,
        orchestrator_config,
        progress_manager,
        sample_citation,
    ):
        """Should generate unique job IDs."""
        with patch('pipeline.orchestrator.wave.instantiate_module') as mock:
            # Create mock module
            mock_module = AsyncMock()
            mock_module.execute.return_value = ModuleResult(
                module_id="m01_company_context",
                domain="test.com",
                status=ModuleStatus.SUCCESS,
                data={},
                primary_citation=sample_citation,
            )
            mock.return_value = mock_module

            orchestrator = EnrichmentOrchestrator(
                config=orchestrator_config,
                progress_manager=progress_manager,
            )

            result = await orchestrator.orchestrate(
                domain="test.com",
                modules=["m01_company_context"],
            )

            assert result.job_id is not None
            assert len(result.job_id) == 36  # UUID format

    @pytest.mark.asyncio
    async def test_orchestrate_respects_module_filter(
        self,
        orchestrator_config,
        progress_manager,
        sample_citation,
    ):
        """Should only execute requested modules."""
        executed_modules = []

        def track_execution(module_id):
            mock_module = AsyncMock()

            async def mock_execute(domain, context=None):
                executed_modules.append(module_id)
                return ModuleResult(
                    module_id=module_id,
                    domain=domain,
                    status=ModuleStatus.SUCCESS,
                    data={},
                    primary_citation=sample_citation,
                )

            mock_module.execute = mock_execute
            return mock_module

        with patch('pipeline.orchestrator.wave.instantiate_module') as mock:
            mock.side_effect = track_execution

            orchestrator = EnrichmentOrchestrator(
                config=orchestrator_config,
                progress_manager=progress_manager,
            )

            await orchestrator.orchestrate(
                domain="test.com",
                modules=["m01_company_context", "m02_technology_stack"],
            )

            assert set(executed_modules) == {
                "m01_company_context",
                "m02_technology_stack",
            }

    @pytest.mark.asyncio
    async def test_orchestrate_handles_critical_module_failure(
        self,
        orchestrator_config,
        progress_manager,
    ):
        """Should abort on critical module failure."""
        with patch('pipeline.orchestrator.wave.instantiate_module') as mock:
            mock_module = AsyncMock()
            mock_module.execute.return_value = ModuleResult.create_error_result(
                module_id="m01_company_context",
                domain="test.com",
                error=Exception("Critical failure"),
            )
            mock.return_value = mock_module

            orchestrator = EnrichmentOrchestrator(
                config=orchestrator_config,
                progress_manager=progress_manager,
            )

            result = await orchestrator.orchestrate(domain="test.com")

            assert result.status == JobStatus.FAILED
            assert "m01_company_context" in result.failed_modules

    @pytest.mark.asyncio
    async def test_orchestrate_collects_metrics(
        self,
        orchestrator_config,
        progress_manager,
        sample_citation,
    ):
        """Should track execution metrics."""
        with patch('pipeline.orchestrator.wave.instantiate_module') as mock:
            mock_module = AsyncMock()
            mock_module.execute.return_value = ModuleResult(
                module_id="m01_company_context",
                domain="test.com",
                status=ModuleStatus.SUCCESS,
                data={},
                primary_citation=sample_citation,
            )
            mock.return_value = mock_module

            orchestrator = EnrichmentOrchestrator(
                config=orchestrator_config,
                progress_manager=progress_manager,
            )

            await orchestrator.orchestrate(
                domain="test.com",
                modules=["m01_company_context"],
            )

            metrics = orchestrator.get_metrics()
            assert metrics["total_jobs"] == 1
            assert metrics["successful_jobs"] == 1


class TestBatchOrchestrator:
    """Tests for BatchOrchestrator."""

    @pytest.mark.asyncio
    async def test_batch_enrich_multiple_domains(
        self,
        orchestrator_config,
        progress_manager,
        sample_citation,
    ):
        """Should process multiple domains."""
        with patch('pipeline.orchestrator.wave.instantiate_module') as mock:
            mock_module = AsyncMock()
            mock_module.execute.return_value = ModuleResult(
                module_id="m01_company_context",
                domain="test.com",
                status=ModuleStatus.SUCCESS,
                data={},
                primary_citation=sample_citation,
            )
            mock.return_value = mock_module

            orchestrator = EnrichmentOrchestrator(
                config=orchestrator_config,
                progress_manager=progress_manager,
            )
            batch = BatchOrchestrator(
                orchestrator=orchestrator,
                max_concurrent_domains=2,
            )

            results = await batch.enrich_batch(
                domains=["test1.com", "test2.com", "test3.com"],
                modules=["m01_company_context"],
            )

            assert len(results) == 3
            assert all(
                r.status in (JobStatus.COMPLETED, JobStatus.PARTIAL)
                for r in results.values()
            )

    @pytest.mark.asyncio
    async def test_batch_respects_concurrency_limit(
        self,
        orchestrator_config,
        progress_manager,
        sample_citation,
    ):
        """Should not exceed max concurrent domains."""
        concurrent_count = [0]
        max_concurrent_seen = [0]

        async def track_concurrency(*args, **kwargs):
            concurrent_count[0] += 1
            max_concurrent_seen[0] = max(max_concurrent_seen[0], concurrent_count[0])
            await asyncio.sleep(0.1)  # Simulate work
            concurrent_count[0] -= 1
            return ModuleResult(
                module_id="m01_company_context",
                domain="test.com",
                status=ModuleStatus.SUCCESS,
                data={},
                primary_citation=sample_citation,
            )

        with patch('pipeline.orchestrator.wave.instantiate_module') as mock:
            mock_module = AsyncMock()
            mock_module.execute = track_concurrency
            mock.return_value = mock_module

            orchestrator = EnrichmentOrchestrator(
                config=orchestrator_config,
                progress_manager=progress_manager,
            )
            batch = BatchOrchestrator(
                orchestrator=orchestrator,
                max_concurrent_domains=2,
            )

            await batch.enrich_batch(
                domains=["d1.com", "d2.com", "d3.com", "d4.com"],
                modules=["m01_company_context"],
            )

            assert max_concurrent_seen[0] <= 2


# =============================================================================
# Integration Tests
# =============================================================================


class TestOrchestratorIntegration:
    """Integration tests for the orchestrator."""

    @pytest.mark.asyncio
    async def test_full_enrichment_flow(
        self,
        orchestrator_config,
        progress_manager,
        sample_citation,
    ):
        """Test complete enrichment flow with multiple waves."""
        module_execution_order = []

        def create_mock_module(module_id):
            mock_module = AsyncMock()

            async def mock_execute(domain, context=None):
                module_execution_order.append(module_id)
                await asyncio.sleep(0.01)  # Simulate work
                return ModuleResult(
                    module_id=module_id,
                    domain=domain,
                    status=ModuleStatus.SUCCESS,
                    data={"module": module_id},
                    primary_citation=sample_citation,
                )

            mock_module.execute = mock_execute
            return mock_module

        with patch('pipeline.orchestrator.wave.instantiate_module') as mock:
            mock.side_effect = create_mock_module

            orchestrator = EnrichmentOrchestrator(
                config=orchestrator_config,
                progress_manager=progress_manager,
            )

            result = await orchestrator.orchestrate(
                domain="test.com",
                modules=[
                    "m01_company_context",  # Wave 1
                    "m05_competitor_intelligence",  # Wave 2
                ],
            )

            # Verify execution order: Wave 1 before Wave 2
            m01_idx = module_execution_order.index("m01_company_context")
            m05_idx = module_execution_order.index("m05_competitor_intelligence")
            assert m01_idx < m05_idx

            # Verify results
            assert result.status == JobStatus.COMPLETED
            assert len(result.completed_modules) == 2

    @pytest.mark.asyncio
    async def test_progress_tracking_during_enrichment(
        self,
        orchestrator_config,
        progress_manager,
        sample_citation,
    ):
        """Test that progress is tracked throughout execution."""
        with patch('pipeline.orchestrator.wave.instantiate_module') as mock:
            mock_module = AsyncMock()
            mock_module.execute.return_value = ModuleResult(
                module_id="m01_company_context",
                domain="test.com",
                status=ModuleStatus.SUCCESS,
                data={},
                primary_citation=sample_citation,
            )
            mock.return_value = mock_module

            orchestrator = EnrichmentOrchestrator(
                config=orchestrator_config,
                progress_manager=progress_manager,
            )

            result = await orchestrator.orchestrate(
                domain="test.com",
                modules=["m01_company_context"],
            )

            # Verify progress was tracked
            progress = await progress_manager.get_progress(result.job_id)
            assert progress is not None
            assert progress["status"] in ("completed", "partial")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
