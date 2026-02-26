"""
Tests for BudgetService

Tests API cost tracking and budget enforcement.

Validation Criteria:
- API calls are tracked with correct costs
- Budget limits are enforced
- Usage breakdowns are accurate
- Budget alerts fire at thresholds
"""

import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timedelta
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.services.budget import BudgetService, DEFAULT_API_COSTS
from app.models.platform import APIUsage, APIBudget


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def budget_engine():
    """Create test database engine with budget tables."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(APIUsage.__table__.create)
        await conn.run_sync(APIBudget.__table__.create)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def budget_db_session(budget_engine) -> AsyncGenerator:
    """Create test database session."""
    async_session = async_sessionmaker(
        budget_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def sample_user_id():
    """Generate a sample user ID."""
    return str(uuid.uuid4())


@pytest.fixture
def sample_team_id():
    """Generate a sample team ID."""
    return str(uuid.uuid4())


# =============================================================================
# TestBudgetServiceTrackApiCall
# =============================================================================

class TestBudgetServiceTrackApiCall:
    """
    Tests for BudgetService.track_api_call()
    """

    @pytest.mark.asyncio
    async def test_track_api_call_success(self, budget_db_session, sample_user_id):
        """
        Test: Track an API call with calculated cost.

        Setup:
            - Track a builtwith domain-lookup call

        Expected:
            - Usage record created
            - Cost calculated from defaults

        Validation:
            - Fields match input
        """
        # SETUP
        service = BudgetService(budget_db_session)

        # ACTION
        usage = await service.track_api_call(
            provider="builtwith",
            endpoint="domain-lookup",
            user_id=sample_user_id,
            domain="costco.com",
        )

        # VALIDATION
        assert usage.id is not None
        assert usage.provider == "builtwith"
        assert usage.endpoint == "domain-lookup"
        assert usage.domain == "costco.com"
        assert usage.cost_usd == DEFAULT_API_COSTS["builtwith"]["domain-lookup"]
        assert usage.success == True

    @pytest.mark.asyncio
    async def test_track_api_call_custom_cost(self, budget_db_session, sample_user_id):
        """
        Test: Track API call with custom cost override.

        Setup:
            - cost_override parameter

        Expected:
            - Custom cost used instead of default

        Validation:
            - cost_usd matches override
        """
        # SETUP
        service = BudgetService(budget_db_session)

        # ACTION
        usage = await service.track_api_call(
            provider="builtwith",
            endpoint="domain-lookup",
            cost_override=0.99,
        )

        # VALIDATION
        assert usage.cost_usd == 0.99

    @pytest.mark.asyncio
    async def test_track_api_call_failed(self, budget_db_session):
        """
        Test: Track a failed API call.

        Setup:
            - success=False, error_message provided

        Expected:
            - Usage recorded with failure info

        Validation:
            - success is False
            - error_message stored
        """
        # SETUP
        service = BudgetService(budget_db_session)

        # ACTION
        usage = await service.track_api_call(
            provider="similarweb",
            endpoint="traffic",
            success=False,
            error_message="Rate limit exceeded",
            status_code=429,
        )

        # VALIDATION
        assert usage.success == False
        assert usage.error_message == "Rate limit exceeded"
        assert usage.status_code == 429

    @pytest.mark.asyncio
    async def test_track_api_call_updates_budget(
        self, budget_db_session, sample_team_id
    ):
        """
        Test: Tracking call updates associated budget.

        Setup:
            - Set budget for team
            - Track API call for that team

        Expected:
            - Budget spend updated

        Validation:
            - current_spend_usd increased
        """
        # SETUP
        service = BudgetService(budget_db_session)
        budget = await service.set_budget(
            monthly_limit=100.0,
            scope_type="team",
            scope_id=sample_team_id,
        )
        initial_spend = budget.current_spend_usd

        # ACTION
        await service.track_api_call(
            provider="builtwith",
            endpoint="domain-lookup",
            team_id=sample_team_id,
        )

        # VALIDATION
        updated_budget = await service.get_budget(team_id=sample_team_id)
        expected_cost = DEFAULT_API_COSTS["builtwith"]["domain-lookup"]
        assert updated_budget.current_spend_usd == initial_spend + expected_cost


# =============================================================================
# TestBudgetServiceGetUsage
# =============================================================================

class TestBudgetServiceGetUsage:
    """
    Tests for BudgetService.get_usage()
    """

    @pytest.mark.asyncio
    async def test_get_usage_totals(self, budget_db_session, sample_user_id):
        """
        Test: Get usage totals for a period.

        Setup:
            - Track multiple API calls

        Expected:
            - Totals calculated correctly

        Validation:
            - total_calls and total_cost match
        """
        # SETUP
        service = BudgetService(budget_db_session)

        # Track 5 calls
        total_expected_cost = 0
        for i in range(5):
            await service.track_api_call(
                provider="builtwith",
                endpoint="domain-lookup",
                user_id=sample_user_id,
            )
            total_expected_cost += DEFAULT_API_COSTS["builtwith"]["domain-lookup"]

        # ACTION
        usage = await service.get_usage(user_id=sample_user_id, period="monthly")

        # VALIDATION
        assert usage["total_calls"] == 5
        assert abs(usage["total_cost_usd"] - total_expected_cost) < 0.001

    @pytest.mark.asyncio
    async def test_get_usage_by_provider(self, budget_db_session, sample_user_id):
        """
        Test: Get usage breakdown by provider.

        Setup:
            - Track calls to multiple providers

        Expected:
            - Breakdown by provider correct

        Validation:
            - Each provider has correct count
        """
        # SETUP
        service = BudgetService(budget_db_session)

        # Track calls to different providers
        await service.track_api_call(
            provider="builtwith", endpoint="domain-lookup", user_id=sample_user_id
        )
        await service.track_api_call(
            provider="builtwith", endpoint="domain-lookup", user_id=sample_user_id
        )
        await service.track_api_call(
            provider="similarweb", endpoint="traffic", user_id=sample_user_id
        )

        # ACTION
        usage = await service.get_usage(user_id=sample_user_id)

        # VALIDATION
        assert "builtwith" in usage["by_provider"]
        assert "similarweb" in usage["by_provider"]
        assert usage["by_provider"]["builtwith"]["calls"] == 2
        assert usage["by_provider"]["similarweb"]["calls"] == 1


# =============================================================================
# TestBudgetServiceCheckBudget
# =============================================================================

class TestBudgetServiceCheckBudget:
    """
    Tests for BudgetService.check_budget()
    """

    @pytest.mark.asyncio
    async def test_check_budget_allows_under_limit(
        self, budget_db_session, sample_team_id
    ):
        """
        Test: Budget check allows call under limit.

        Setup:
            - Budget with room remaining

        Expected:
            - Returns (True, None)

        Validation:
            - Call allowed
        """
        # SETUP
        service = BudgetService(budget_db_session)
        await service.set_budget(
            monthly_limit=100.0,
            scope_type="team",
            scope_id=sample_team_id,
        )

        # ACTION
        allowed, reason = await service.check_budget(
            team_id=sample_team_id,
            estimated_cost=0.05,
        )

        # VALIDATION
        assert allowed == True
        assert reason is None

    @pytest.mark.asyncio
    async def test_check_budget_blocks_over_limit(
        self, budget_db_session, sample_team_id
    ):
        """
        Test: Budget check blocks when over hard cap.

        Setup:
            - Budget at 99% used
            - Estimated cost would exceed limit

        Expected:
            - Returns (False, reason)

        Validation:
            - Call blocked with reason
        """
        # SETUP
        service = BudgetService(budget_db_session)
        budget = await service.set_budget(
            monthly_limit=100.0,
            scope_type="team",
            scope_id=sample_team_id,
            hard_cap=True,
        )
        # Manually set spend near limit
        budget.current_spend_usd = 99.99

        # ACTION
        allowed, reason = await service.check_budget(
            team_id=sample_team_id,
            estimated_cost=0.10,  # Would exceed
        )

        # VALIDATION
        assert allowed == False
        assert "limit reached" in reason.lower()

    @pytest.mark.asyncio
    async def test_check_budget_no_budget_allows_all(self, budget_db_session):
        """
        Test: No budget set allows all calls.

        Setup:
            - No budget configured

        Expected:
            - Returns (True, None)

        Validation:
            - Calls allowed by default
        """
        # SETUP
        service = BudgetService(budget_db_session)

        # ACTION
        allowed, reason = await service.check_budget(
            user_id=str(uuid.uuid4()),
            estimated_cost=1000.0,  # Large cost
        )

        # VALIDATION
        assert allowed == True
        assert reason is None

    @pytest.mark.asyncio
    async def test_check_budget_triggers_alert_threshold(
        self, budget_db_session, sample_team_id
    ):
        """
        Test: Budget check triggers alert at threshold.

        Setup:
            - Budget at 75% used
            - Call would push to 81%

        Expected:
            - alert_sent_80 flag set

        Validation:
            - Alert tracking updated
        """
        # SETUP
        service = BudgetService(budget_db_session)
        budget = await service.set_budget(
            monthly_limit=100.0,
            scope_type="team",
            scope_id=sample_team_id,
        )
        budget.current_spend_usd = 79.0
        assert budget.alert_sent_80 == False

        # ACTION
        await service.check_budget(
            team_id=sample_team_id,
            estimated_cost=2.0,  # 79 + 2 = 81 > 80%
        )

        # VALIDATION
        updated = await service.get_budget(team_id=sample_team_id)
        assert updated.alert_sent_80 == True


# =============================================================================
# TestBudgetServiceSetBudget
# =============================================================================

class TestBudgetServiceSetBudget:
    """
    Tests for BudgetService.set_budget()
    """

    @pytest.mark.asyncio
    async def test_set_budget_creates_new(self, budget_db_session, sample_team_id):
        """
        Test: Creating a new budget.

        Setup:
            - No existing budget

        Expected:
            - Budget created with correct values

        Validation:
            - All fields set
        """
        # SETUP
        service = BudgetService(budget_db_session)

        # ACTION
        budget = await service.set_budget(
            monthly_limit=500.0,
            scope_type="team",
            scope_id=sample_team_id,
            alert_threshold_pct=75,
            hard_cap=True,
        )

        # VALIDATION
        assert budget.id is not None
        assert budget.budget_usd == 500.0
        assert budget.scope_type == "team"
        assert budget.scope_id == sample_team_id
        assert budget.alert_threshold_pct == 75
        assert budget.hard_cap == True
        assert budget.current_spend_usd == 0.0

    @pytest.mark.asyncio
    async def test_set_budget_updates_existing(
        self, budget_db_session, sample_team_id
    ):
        """
        Test: Updating an existing budget.

        Setup:
            - Existing budget

        Expected:
            - Budget updated, not duplicated

        Validation:
            - Only one budget exists
        """
        # SETUP
        service = BudgetService(budget_db_session)
        original = await service.set_budget(
            monthly_limit=100.0,
            scope_type="team",
            scope_id=sample_team_id,
        )

        # ACTION
        updated = await service.set_budget(
            monthly_limit=200.0,
            scope_type="team",
            scope_id=sample_team_id,
        )

        # VALIDATION
        assert updated.id == original.id
        assert updated.budget_usd == 200.0


# =============================================================================
# TestBudgetServiceCostBreakdown
# =============================================================================

class TestBudgetServiceCostBreakdown:
    """
    Tests for BudgetService.get_cost_breakdown()
    """

    @pytest.mark.asyncio
    async def test_get_cost_breakdown_by_endpoint(
        self, budget_db_session, sample_user_id
    ):
        """
        Test: Cost breakdown includes endpoint details.

        Setup:
            - Calls to different endpoints

        Expected:
            - Breakdown by endpoint available

        Validation:
            - Endpoints listed with costs
        """
        # SETUP
        service = BudgetService(budget_db_session)

        await service.track_api_call(
            provider="builtwith", endpoint="domain-lookup", user_id=sample_user_id
        )
        await service.track_api_call(
            provider="builtwith", endpoint="relationships-api", user_id=sample_user_id
        )
        await service.track_api_call(
            provider="similarweb", endpoint="traffic", user_id=sample_user_id
        )

        # ACTION
        breakdown = await service.get_cost_breakdown(user_id=sample_user_id)

        # VALIDATION
        assert "by_endpoint" in breakdown
        assert len(breakdown["by_endpoint"]) == 3

    @pytest.mark.asyncio
    async def test_get_cost_breakdown_top_domains(
        self, budget_db_session, sample_user_id
    ):
        """
        Test: Cost breakdown includes top domains.

        Setup:
            - Calls for different domains

        Expected:
            - Top domains listed

        Validation:
            - Domain costs accurate
        """
        # SETUP
        service = BudgetService(budget_db_session)

        domains = ["costco.com", "costco.com", "walmart.com"]
        for domain in domains:
            await service.track_api_call(
                provider="builtwith",
                endpoint="domain-lookup",
                user_id=sample_user_id,
                domain=domain,
            )

        # ACTION
        breakdown = await service.get_cost_breakdown(user_id=sample_user_id)

        # VALIDATION
        assert "top_domains" in breakdown
        domain_names = [d["domain"] for d in breakdown["top_domains"]]
        assert "costco.com" in domain_names
        assert "walmart.com" in domain_names


# =============================================================================
# TestBudgetServiceResetPeriod
# =============================================================================

class TestBudgetServiceResetPeriod:
    """
    Tests for BudgetService.reset_budget_period()
    """

    @pytest.mark.asyncio
    async def test_reset_budget_period(self, budget_db_session, sample_team_id):
        """
        Test: Reset budget for new period.

        Setup:
            - Budget with spend and alerts

        Expected:
            - Spend reset to 0
            - Alert flags reset

        Validation:
            - Clean slate for new period
        """
        # SETUP
        service = BudgetService(budget_db_session)
        budget = await service.set_budget(
            monthly_limit=100.0,
            scope_type="team",
            scope_id=sample_team_id,
        )
        budget.current_spend_usd = 75.0
        budget.current_call_count = 100
        budget.alert_sent_50 = True
        budget.alert_sent_80 = True
        await budget_db_session.flush()

        # ACTION
        reset = await service.reset_budget_period(budget.id)

        # VALIDATION
        assert reset.current_spend_usd == 0.0
        assert reset.current_call_count == 0
        assert reset.alert_sent_50 == False
        assert reset.alert_sent_80 == False
        assert reset.alert_sent_100 == False


# =============================================================================
# TestBudgetServiceIntegration
# =============================================================================

class TestBudgetServiceIntegration:
    """
    Integration tests for complete budget workflows.
    """

    @pytest.mark.asyncio
    async def test_full_budget_workflow(
        self, budget_db_session, sample_team_id, sample_user_id
    ):
        """
        Test: Complete workflow from budget creation to breakdown.

        Setup:
            - Create budget
            - Track multiple calls
            - Check budget
            - Get breakdown

        Expected:
            - All operations succeed

        Validation:
            - End-to-end workflow
        """
        # SETUP
        service = BudgetService(budget_db_session)

        # Create budget
        budget = await service.set_budget(
            monthly_limit=10.0,
            scope_type="team",
            scope_id=sample_team_id,
        )

        # Track calls
        for i in range(10):
            # Check budget before each call
            allowed, _ = await service.check_budget(
                team_id=sample_team_id,
                estimated_cost=0.05,
            )

            if allowed:
                await service.track_api_call(
                    provider="builtwith",
                    endpoint="domain-lookup",
                    team_id=sample_team_id,
                    user_id=sample_user_id,
                    domain=f"domain{i}.com",
                )

        # Get usage
        usage = await service.get_usage(team_id=sample_team_id)

        # Get breakdown
        breakdown = await service.get_cost_breakdown(team_id=sample_team_id)

        # VALIDATION
        assert usage["total_calls"] == 10
        assert usage["total_cost_usd"] > 0
        assert len(breakdown["top_domains"]) > 0

        # Check budget was updated
        updated_budget = await service.get_budget(team_id=sample_team_id)
        assert updated_budget.current_spend_usd > 0
        assert updated_budget.current_call_count == 10
