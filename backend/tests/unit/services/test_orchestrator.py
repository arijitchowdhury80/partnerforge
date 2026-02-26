"""
Tests for EnrichmentOrchestrator

Tests wave-based enrichment orchestration.

Validation Criteria:
- Jobs are created with correct status
- Waves execute in sequence
- Modules execute in parallel within waves
- Job status tracking is accurate
- Cancellation works correctly
"""

import pytest
import pytest_asyncio
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.services.orchestrator import (
    EnrichmentOrchestrator,
    MODULE_DEFINITIONS,
    get_module_info,
    get_all_modules,
    get_modules_by_wave,
)
from app.models.platform import JobExecution


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def orchestrator_engine():
    """Create test database engine with job tables."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(JobExecution.__table__.create)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def orchestrator_db_session(orchestrator_engine) -> AsyncGenerator:
    """Create test database session."""
    async_session = async_sessionmaker(
        orchestrator_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def mock_module_executor():
    """Create a mock module executor that returns placeholder data."""
    async def executor(domain: str, context: dict):
        await asyncio.sleep(0.01)  # Simulate some work
        return {
            "module": "test",
            "domain": domain,
            "data": {"placeholder": True},
            "source_url": f"https://test.com/{domain}",
            "source_date": datetime.utcnow().isoformat(),
        }
    return executor


# =============================================================================
# TestEnrichmentOrchestratorEnrichDomain
# =============================================================================

class TestEnrichmentOrchestratorEnrichDomain:
    """
    Tests for EnrichmentOrchestrator.enrich_domain()
    """

    @pytest.mark.asyncio
    async def test_enrich_domain_creates_job(self, orchestrator_db_session):
        """
        Test: enrich_domain creates a job record.

        Setup:
            - Call enrich_domain

        Expected:
            - Job created with queued status

        Validation:
            - Job fields correct
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # ACTION
        job = await orchestrator.enrich_domain(
            domain="costco.com",
            triggered_by="test@algolia.com",
            trigger_source="api",
        )

        # VALIDATION
        assert job.id is not None
        assert job.domain == "costco.com"
        assert job.status == "queued"
        assert job.triggered_by == "test@algolia.com"
        assert job.trigger_source == "api"
        assert job.total_steps == len(MODULE_DEFINITIONS)

    @pytest.mark.asyncio
    async def test_enrich_domain_full_enrichment(self, orchestrator_db_session):
        """
        Test: Full enrichment includes all modules.

        Setup:
            - No modules or waves specified

        Expected:
            - All modules included

        Validation:
            - Module count matches definitions
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # ACTION
        job = await orchestrator.enrich_domain(domain="costco.com")

        # VALIDATION
        assert job.job_type == "full_enrichment"
        assert len(job.modules) == len(MODULE_DEFINITIONS)
        assert job.waves == [1, 2, 3, 4]

    @pytest.mark.asyncio
    async def test_enrich_domain_specific_modules(self, orchestrator_db_session):
        """
        Test: Specific modules only runs those modules.

        Setup:
            - modules parameter with 2 modules

        Expected:
            - Only specified modules included

        Validation:
            - Module list matches input
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        target_modules = ["m01_company_context", "m02_tech_stack"]

        # ACTION
        job = await orchestrator.enrich_domain(
            domain="costco.com",
            modules=target_modules,
        )

        # VALIDATION
        assert job.job_type == "module_enrichment"
        assert job.modules == target_modules
        assert job.total_steps == 2

    @pytest.mark.asyncio
    async def test_enrich_domain_specific_waves(self, orchestrator_db_session):
        """
        Test: Specific waves only runs modules in those waves.

        Setup:
            - waves parameter with wave 1

        Expected:
            - Only wave 1 modules included

        Validation:
            - Module count matches wave 1
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # ACTION
        job = await orchestrator.enrich_domain(
            domain="costco.com",
            waves=[1],
        )

        # VALIDATION
        assert job.job_type == "wave_enrichment"
        assert job.waves == [1]
        # Wave 1 has m01-m04 (4 modules)
        wave_1_modules = get_modules_by_wave(1)
        assert job.modules == wave_1_modules


# =============================================================================
# TestEnrichmentOrchestratorExecuteJob
# =============================================================================

class TestEnrichmentOrchestratorExecuteJob:
    """
    Tests for EnrichmentOrchestrator.execute_job()
    """

    @pytest.mark.asyncio
    async def test_execute_job_updates_status_to_running(
        self, orchestrator_db_session, mock_module_executor
    ):
        """
        Test: Job status updates to running when execution starts.

        Setup:
            - Create queued job
            - Start execution

        Expected:
            - Status becomes running

        Validation:
            - Status transitions
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # Register mock executors for all modules
        for module_type in MODULE_DEFINITIONS.keys():
            orchestrator.register_module_executor(module_type, mock_module_executor)

        job = await orchestrator.enrich_domain(
            domain="test.com",
            modules=["m01_company_context"],
        )
        assert job.status == "queued"

        # ACTION
        completed_job = await orchestrator.execute_job(job.id)

        # VALIDATION
        assert completed_job.started_at is not None
        assert completed_job.status == "completed"

    @pytest.mark.asyncio
    async def test_execute_job_completes_successfully(
        self, orchestrator_db_session, mock_module_executor
    ):
        """
        Test: Job completes with correct final state.

        Setup:
            - Job with single module
            - Execute to completion

        Expected:
            - Status is completed
            - Duration calculated

        Validation:
            - Final state correct
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        orchestrator.register_module_executor("m01_company_context", mock_module_executor)

        job = await orchestrator.enrich_domain(
            domain="test.com",
            modules=["m01_company_context"],
        )

        # ACTION
        completed = await orchestrator.execute_job(job.id)

        # VALIDATION
        assert completed.status == "completed"
        assert completed.completed_at is not None
        assert completed.duration_seconds is not None
        assert "m01_company_context" in completed.modules_completed

    @pytest.mark.asyncio
    async def test_execute_job_tracks_failed_modules(
        self, orchestrator_db_session
    ):
        """
        Test: Failed modules are tracked separately.

        Setup:
            - Module executor that raises exception
            - Execute job

        Expected:
            - Module appears in modules_failed

        Validation:
            - Failure tracking works
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        async def failing_executor(domain, context):
            raise ValueError("Test failure")

        orchestrator.register_module_executor("m01_company_context", failing_executor)

        job = await orchestrator.enrich_domain(
            domain="test.com",
            modules=["m01_company_context"],
        )

        # ACTION
        completed = await orchestrator.execute_job(job.id)

        # VALIDATION
        assert "m01_company_context" in completed.modules_failed

    @pytest.mark.asyncio
    async def test_execute_job_nonexistent_fails(self, orchestrator_db_session):
        """
        Test: Executing non-existent job raises error.

        Setup:
            - Invalid job ID

        Expected:
            - ValueError raised

        Validation:
            - Correct exception
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # ACTION & VALIDATION
        with pytest.raises(ValueError) as exc_info:
            await orchestrator.execute_job(str(uuid.uuid4()))

        assert "not found" in str(exc_info.value).lower()


# =============================================================================
# TestEnrichmentOrchestratorExecuteWave
# =============================================================================

class TestEnrichmentOrchestratorExecuteWave:
    """
    Tests for EnrichmentOrchestrator.execute_wave()
    """

    @pytest.mark.asyncio
    async def test_execute_wave_runs_modules(
        self, orchestrator_db_session, mock_module_executor
    ):
        """
        Test: execute_wave runs all modules in the wave.

        Setup:
            - Register executors for wave 1 modules
            - Execute wave 1

        Expected:
            - Results from all modules

        Validation:
            - Result dict has module keys
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        wave_1_modules = get_modules_by_wave(1)

        for module in wave_1_modules:
            orchestrator.register_module_executor(module, mock_module_executor)

        # ACTION
        results = await orchestrator.execute_wave(
            wave_number=1,
            domain="test.com",
            context={},
        )

        # VALIDATION
        assert len(results) == len(wave_1_modules)
        for module in wave_1_modules:
            assert module in results

    @pytest.mark.asyncio
    async def test_execute_wave_respects_target_modules(
        self, orchestrator_db_session, mock_module_executor
    ):
        """
        Test: execute_wave only runs specified target modules.

        Setup:
            - Target only 1 of 4 wave 1 modules

        Expected:
            - Only that module runs

        Validation:
            - Single result
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        orchestrator.register_module_executor("m01_company_context", mock_module_executor)

        # ACTION
        results = await orchestrator.execute_wave(
            wave_number=1,
            domain="test.com",
            context={},
            target_modules=["m01_company_context"],
        )

        # VALIDATION
        assert len(results) == 1
        assert "m01_company_context" in results

    @pytest.mark.asyncio
    async def test_execute_wave_skips_missing_dependencies(
        self, orchestrator_db_session, mock_module_executor
    ):
        """
        Test: Modules with missing dependencies are skipped.

        Setup:
            - Wave 2 module with dep on wave 1
            - No wave 1 results in context

        Expected:
            - Module skipped

        Validation:
            - Result not in output
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # m05_competitors depends on m03_traffic
        orchestrator.register_module_executor("m05_competitors", mock_module_executor)

        # ACTION - Empty context (no m03_traffic results)
        results = await orchestrator.execute_wave(
            wave_number=2,
            domain="test.com",
            context={},  # Missing m03_traffic
            target_modules=["m05_competitors"],
        )

        # VALIDATION
        # Module should be skipped due to missing dependency
        assert "m05_competitors" not in results

    @pytest.mark.asyncio
    async def test_execute_wave_runs_with_satisfied_dependencies(
        self, orchestrator_db_session, mock_module_executor
    ):
        """
        Test: Modules run when dependencies are satisfied.

        Setup:
            - Provide dependency result in context

        Expected:
            - Module runs successfully

        Validation:
            - Result present
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        orchestrator.register_module_executor("m05_competitors", mock_module_executor)

        # ACTION - Context includes m03_traffic
        results = await orchestrator.execute_wave(
            wave_number=2,
            domain="test.com",
            context={"m03_traffic": {"visits": 1000000}},
            target_modules=["m05_competitors"],
        )

        # VALIDATION
        assert "m05_competitors" in results


# =============================================================================
# TestEnrichmentOrchestratorGetJobStatus
# =============================================================================

class TestEnrichmentOrchestratorGetJobStatus:
    """
    Tests for EnrichmentOrchestrator.get_job_status()
    """

    @pytest.mark.asyncio
    async def test_get_job_status_returns_details(self, orchestrator_db_session):
        """
        Test: get_job_status returns comprehensive status.

        Setup:
            - Create job

        Expected:
            - Status dict with all fields

        Validation:
            - Required fields present
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        job = await orchestrator.enrich_domain(
            domain="test.com",
            triggered_by="test@algolia.com",
        )

        # ACTION
        status = await orchestrator.get_job_status(job.id)

        # VALIDATION
        assert status is not None
        assert status["id"] == job.id
        assert status["domain"] == "test.com"
        assert status["status"] == "queued"
        assert "progress" in status
        assert status["progress"]["total_steps"] > 0
        assert status["triggered_by"] == "test@algolia.com"

    @pytest.mark.asyncio
    async def test_get_job_status_nonexistent_returns_none(
        self, orchestrator_db_session
    ):
        """
        Test: Non-existent job returns None.

        Setup:
            - Invalid job ID

        Expected:
            - Returns None

        Validation:
            - No exception
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # ACTION
        status = await orchestrator.get_job_status(str(uuid.uuid4()))

        # VALIDATION
        assert status is None

    @pytest.mark.asyncio
    async def test_get_job_status_progress_percentage(
        self, orchestrator_db_session
    ):
        """
        Test: Progress percentage is calculated correctly.

        Setup:
            - Job with known steps

        Expected:
            - Percentage calculated

        Validation:
            - Math is correct
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        job = await orchestrator.enrich_domain(
            domain="test.com",
            modules=["m01_company_context", "m02_tech_stack"],
        )
        job.completed_steps = 1
        await orchestrator_db_session.flush()

        # ACTION
        status = await orchestrator.get_job_status(job.id)

        # VALIDATION
        assert status["progress"]["percentage"] == 50.0  # 1 of 2


# =============================================================================
# TestEnrichmentOrchestratorCancelJob
# =============================================================================

class TestEnrichmentOrchestratorCancelJob:
    """
    Tests for EnrichmentOrchestrator.cancel_job()
    """

    @pytest.mark.asyncio
    async def test_cancel_job_queued(self, orchestrator_db_session):
        """
        Test: Cancel a queued job.

        Setup:
            - Job in queued status

        Expected:
            - Status becomes cancelled
            - Returns True

        Validation:
            - Cancellation successful
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        job = await orchestrator.enrich_domain(domain="test.com")

        # ACTION
        result = await orchestrator.cancel_job(job.id)

        # VALIDATION
        assert result == True
        status = await orchestrator.get_job_status(job.id)
        assert status["status"] == "cancelled"

    @pytest.mark.asyncio
    async def test_cancel_job_already_completed_fails(
        self, orchestrator_db_session, mock_module_executor
    ):
        """
        Test: Cannot cancel completed job.

        Setup:
            - Execute job to completion
            - Try to cancel

        Expected:
            - Returns False

        Validation:
            - Cannot cancel finished job
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)
        orchestrator.register_module_executor("m01_company_context", mock_module_executor)

        job = await orchestrator.enrich_domain(
            domain="test.com",
            modules=["m01_company_context"],
        )
        await orchestrator.execute_job(job.id)

        # ACTION
        result = await orchestrator.cancel_job(job.id)

        # VALIDATION
        assert result == False

    @pytest.mark.asyncio
    async def test_cancel_job_nonexistent_returns_false(
        self, orchestrator_db_session
    ):
        """
        Test: Cancelling non-existent job returns False.

        Setup:
            - Invalid job ID

        Expected:
            - Returns False

        Validation:
            - No exception
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # ACTION
        result = await orchestrator.cancel_job(str(uuid.uuid4()))

        # VALIDATION
        assert result == False


# =============================================================================
# TestEnrichmentOrchestratorGetRecentJobs
# =============================================================================

class TestEnrichmentOrchestratorGetRecentJobs:
    """
    Tests for EnrichmentOrchestrator.get_recent_jobs()
    """

    @pytest.mark.asyncio
    async def test_get_recent_jobs(self, orchestrator_db_session):
        """
        Test: Get recent jobs across domains.

        Setup:
            - Create multiple jobs

        Expected:
            - All jobs returned

        Validation:
            - Count matches
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        for i in range(5):
            await orchestrator.enrich_domain(domain=f"domain{i}.com")

        # ACTION
        jobs = await orchestrator.get_recent_jobs()

        # VALIDATION
        assert len(jobs) == 5

    @pytest.mark.asyncio
    async def test_get_recent_jobs_filter_by_domain(self, orchestrator_db_session):
        """
        Test: Filter jobs by domain.

        Setup:
            - Jobs for different domains

        Expected:
            - Only matching domain returned

        Validation:
            - Domain filter works
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        await orchestrator.enrich_domain(domain="costco.com")
        await orchestrator.enrich_domain(domain="costco.com")
        await orchestrator.enrich_domain(domain="walmart.com")

        # ACTION
        jobs = await orchestrator.get_recent_jobs(domain="costco.com")

        # VALIDATION
        assert len(jobs) == 2
        assert all(j["domain"] == "costco.com" for j in jobs)

    @pytest.mark.asyncio
    async def test_get_recent_jobs_filter_by_status(self, orchestrator_db_session):
        """
        Test: Filter jobs by status.

        Setup:
            - Jobs with different statuses

        Expected:
            - Only matching status returned

        Validation:
            - Status filter works
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        job1 = await orchestrator.enrich_domain(domain="test1.com")
        job2 = await orchestrator.enrich_domain(domain="test2.com")
        await orchestrator.cancel_job(job1.id)

        # ACTION
        queued = await orchestrator.get_recent_jobs(status="queued")
        cancelled = await orchestrator.get_recent_jobs(status="cancelled")

        # VALIDATION
        assert len(queued) == 1
        assert len(cancelled) == 1


# =============================================================================
# TestModuleHelpers
# =============================================================================

class TestModuleHelpers:
    """
    Tests for module utility functions.
    """

    def test_get_module_info(self):
        """
        Test: get_module_info returns module metadata.

        Setup:
            - Known module type

        Expected:
            - Metadata dict returned

        Validation:
            - Contains expected keys
        """
        # ACTION
        info = get_module_info("m01_company_context")

        # VALIDATION
        assert info is not None
        assert info["wave"] == 1
        assert "name" in info
        assert "providers" in info

    def test_get_module_info_unknown_returns_none(self):
        """
        Test: Unknown module returns None.

        Setup:
            - Invalid module type

        Expected:
            - Returns None

        Validation:
            - No exception
        """
        # ACTION
        info = get_module_info("invalid_module")

        # VALIDATION
        assert info is None

    def test_get_all_modules(self):
        """
        Test: get_all_modules returns all module IDs.

        Setup:
            - None

        Expected:
            - List of all module IDs

        Validation:
            - Count matches MODULE_DEFINITIONS
        """
        # ACTION
        modules = get_all_modules()

        # VALIDATION
        assert len(modules) == len(MODULE_DEFINITIONS)
        assert "m01_company_context" in modules
        assert "m15_strategic_brief" in modules

    def test_get_modules_by_wave(self):
        """
        Test: get_modules_by_wave filters correctly.

        Setup:
            - Each wave

        Expected:
            - Correct modules for each wave

        Validation:
            - Wave 1 has m01-m04
        """
        # ACTION
        wave_1 = get_modules_by_wave(1)
        wave_4 = get_modules_by_wave(4)

        # VALIDATION
        assert "m01_company_context" in wave_1
        assert "m02_tech_stack" in wave_1
        assert "m03_traffic" in wave_1
        assert "m04_financials" in wave_1
        assert len(wave_1) == 4

        assert "m15_strategic_brief" in wave_4


# =============================================================================
# TestEnrichmentOrchestratorIntegration
# =============================================================================

class TestEnrichmentOrchestratorIntegration:
    """
    Integration tests for complete orchestration workflows.
    """

    @pytest.mark.asyncio
    async def test_full_enrichment_workflow(
        self, orchestrator_db_session, mock_module_executor
    ):
        """
        Test: Complete enrichment workflow.

        Setup:
            - Register all module executors
            - Create and execute job

        Expected:
            - All modules complete

        Validation:
            - End-to-end success
        """
        # SETUP
        orchestrator = EnrichmentOrchestrator(orchestrator_db_session)

        # Register executors for all modules
        for module in MODULE_DEFINITIONS.keys():
            orchestrator.register_module_executor(module, mock_module_executor)

        # Create job for wave 1 only (no dependencies)
        job = await orchestrator.enrich_domain(
            domain="costco.com",
            waves=[1],
            triggered_by="integration_test",
        )

        # ACTION
        completed = await orchestrator.execute_job(job.id)

        # VALIDATION
        assert completed.status == "completed"
        assert len(completed.modules_completed) == 4  # Wave 1 modules
        assert completed.duration_seconds is not None

        # Verify status API
        status = await orchestrator.get_job_status(job.id)
        assert status["status"] == "completed"
        assert status["progress"]["percentage"] == 100.0
