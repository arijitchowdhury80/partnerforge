"""
Tests for ChangeDetectionService

Tests all change detection and classification functionality.

Validation Criteria:
- Change events are created with correct significance
- Categories are correctly classified
- Significance scores are calculated accurately
- Query methods return expected results
"""

import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timedelta
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.services.change_detection import (
    ChangeDetectionService,
    CHANGE_CATEGORIES,
    SIGNIFICANCE_LEVELS,
)
from app.models.versioning import IntelSnapshot, ChangeEvent


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def change_detection_engine():
    """Create test database engine with versioning tables."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(IntelSnapshot.__table__.create)
        await conn.run_sync(ChangeEvent.__table__.create)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def change_db_session(change_detection_engine) -> AsyncGenerator:
    """Create test database session."""
    async_session = async_sessionmaker(
        change_detection_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def sample_snapshot_id():
    """Generate a sample snapshot ID."""
    return str(uuid.uuid4())


# =============================================================================
# TestChangeDetectionServiceCreateEvent
# =============================================================================

class TestChangeDetectionServiceCreateEvent:
    """
    Tests for ChangeDetectionService.create_change_event()
    """

    @pytest.mark.asyncio
    async def test_create_change_event_success(self, change_db_session, sample_snapshot_id):
        """
        Test: Creating a change event succeeds with valid parameters.

        Setup:
            - Valid change event parameters

        Expected:
            - Change event is created
            - All fields are populated correctly
            - ID is generated

        Validation:
            - Field values match input
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION
        event = await service.create_change_event(
            domain="costco.com",
            module_type="m09_executive",
            snapshot_id=sample_snapshot_id,
            category="executive_change",
            field="executives",
            old_value={"name": "John Smith"},
            new_value={"name": "Jane Doe"},
        )

        # VALIDATION
        assert event.id is not None, "ID should be generated"
        assert event.domain == "costco.com"
        assert event.module_type == "m09_executive"
        assert event.category == "executive_change"
        assert event.field == "executives"
        assert event.old_value == {"name": "John Smith"}
        assert event.new_value == {"name": "Jane Doe"}
        assert event.significance in ["critical", "high", "medium", "low"]
        assert event.summary is not None
        assert event.algolia_relevance is not None

    @pytest.mark.asyncio
    async def test_create_change_event_invalid_category_fails(self, change_db_session, sample_snapshot_id):
        """
        Test: Creating event with invalid category fails.

        Setup:
            - Unknown category value

        Expected:
            - ValueError is raised

        Validation:
            - Correct exception type
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION & VALIDATION
        with pytest.raises(ValueError) as exc_info:
            await service.create_change_event(
                domain="costco.com",
                module_type="m09_executive",
                snapshot_id=sample_snapshot_id,
                category="invalid_category",
                field="test",
                old_value="old",
                new_value="new",
            )

        assert "Unknown change category" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_change_event_custom_significance(self, change_db_session, sample_snapshot_id):
        """
        Test: Custom significance overrides calculated value.

        Setup:
            - Explicit significance parameter

        Expected:
            - Provided significance is used

        Validation:
            - significance matches input
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION
        event = await service.create_change_event(
            domain="costco.com",
            module_type="m02_tech_stack",
            snapshot_id=sample_snapshot_id,
            category="tech_stack_change",
            field="search",
            old_value="Elasticsearch",
            new_value=None,
            significance="critical",  # Explicit
        )

        # VALIDATION
        assert event.significance == "critical"

    @pytest.mark.asyncio
    async def test_create_change_event_custom_summary(self, change_db_session, sample_snapshot_id):
        """
        Test: Custom summary is used when provided.

        Setup:
            - Explicit summary parameter

        Expected:
            - Provided summary is used

        Validation:
            - summary matches input
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)
        custom_summary = "Custom: Search provider removed"

        # ACTION
        event = await service.create_change_event(
            domain="costco.com",
            module_type="m02_tech_stack",
            snapshot_id=sample_snapshot_id,
            category="tech_stack_change",
            field="search",
            old_value="Elasticsearch",
            new_value=None,
            summary=custom_summary,
        )

        # VALIDATION
        assert event.summary == custom_summary


# =============================================================================
# TestChangeDetectionServiceCreateFromDiff
# =============================================================================

class TestChangeDetectionServiceCreateFromDiff:
    """
    Tests for ChangeDetectionService.create_change_events_from_diff()
    """

    @pytest.mark.asyncio
    async def test_create_events_from_diff_changed_fields(self, change_db_session, sample_snapshot_id):
        """
        Test: Creating events from diff with changed fields.

        Setup:
            - Diff with 2 changed fields

        Expected:
            - 2 change events created

        Validation:
            - Event count matches
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)
        diff = {
            "changed": {
                "executives": {
                    "old": [{"name": "John"}],
                    "new": [{"name": "Jane"}],
                },
                "key_themes": {
                    "old": ["growth"],
                    "new": ["efficiency"],
                },
            },
            "added": {},
            "removed": {},
        }

        # ACTION
        events = await service.create_change_events_from_diff(
            domain="costco.com",
            module_type="m09_executive",
            snapshot_id=sample_snapshot_id,
            diff=diff,
        )

        # VALIDATION
        assert len(events) == 2, f"Expected 2 events, got {len(events)}"
        fields = {e.field for e in events}
        assert "executives" in fields
        assert "key_themes" in fields

    @pytest.mark.asyncio
    async def test_create_events_from_diff_removed_fields(self, change_db_session, sample_snapshot_id):
        """
        Test: Creating events from diff with removed fields.

        Setup:
            - Diff with removed field

        Expected:
            - Event created with high significance

        Validation:
            - new_value is None
            - significance is high
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)
        diff = {
            "changed": {},
            "added": {},
            "removed": {
                "search_provider": "Elasticsearch",
            },
        }

        # ACTION
        events = await service.create_change_events_from_diff(
            domain="costco.com",
            module_type="m02_tech_stack",
            snapshot_id=sample_snapshot_id,
            diff=diff,
        )

        # VALIDATION
        assert len(events) == 1
        event = events[0]
        assert event.field == "search_provider"
        assert event.new_value is None
        assert event.old_value == "Elasticsearch"
        assert event.significance == "high"  # Removals are high significance

    @pytest.mark.asyncio
    async def test_create_events_from_diff_added_fields(self, change_db_session, sample_snapshot_id):
        """
        Test: Creating events from diff with added fields.

        Setup:
            - Diff with added field

        Expected:
            - Event created with old_value=None

        Validation:
            - old_value is None
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)
        diff = {
            "changed": {},
            "added": {
                "new_metric": 100,
            },
            "removed": {},
        }

        # ACTION
        events = await service.create_change_events_from_diff(
            domain="costco.com",
            module_type="m04_financials",
            snapshot_id=sample_snapshot_id,
            diff=diff,
        )

        # VALIDATION
        assert len(events) == 1
        event = events[0]
        assert event.field == "new_metric"
        assert event.old_value is None
        assert event.new_value == 100

    @pytest.mark.asyncio
    async def test_create_events_from_empty_diff(self, change_db_session, sample_snapshot_id):
        """
        Test: Empty diff creates no events.

        Setup:
            - Diff with no changes

        Expected:
            - Empty list returned

        Validation:
            - No events created
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)
        diff = {
            "changed": {},
            "added": {},
            "removed": {},
        }

        # ACTION
        events = await service.create_change_events_from_diff(
            domain="costco.com",
            module_type="m09_executive",
            snapshot_id=sample_snapshot_id,
            diff=diff,
        )

        # VALIDATION
        assert len(events) == 0


# =============================================================================
# TestChangeDetectionServiceQueries
# =============================================================================

class TestChangeDetectionServiceQueries:
    """
    Tests for ChangeDetectionService query methods.
    """

    @pytest.mark.asyncio
    async def test_get_changes_for_domain(self, change_db_session, sample_snapshot_id):
        """
        Test: get_changes_for_domain returns domain-specific changes.

        Setup:
            - Create events for multiple domains
            - Query for one domain

        Expected:
            - Only events for queried domain returned

        Validation:
            - All events have correct domain
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # Create events for costco.com
        for i in range(3):
            await service.create_change_event(
                domain="costco.com",
                module_type="m09_executive",
                snapshot_id=sample_snapshot_id,
                category="executive_change",
                field=f"field_{i}",
                old_value=f"old_{i}",
                new_value=f"new_{i}",
            )

        # Create events for walmart.com
        for i in range(2):
            await service.create_change_event(
                domain="walmart.com",
                module_type="m09_executive",
                snapshot_id=sample_snapshot_id,
                category="executive_change",
                field=f"field_{i}",
                old_value=f"old_{i}",
                new_value=f"new_{i}",
            )

        # ACTION
        events = await service.get_changes_for_domain("costco.com")

        # VALIDATION
        assert len(events) == 3
        assert all(e.domain == "costco.com" for e in events)

    @pytest.mark.asyncio
    async def test_get_changes_for_domain_respects_since_date(self, change_db_session, sample_snapshot_id):
        """
        Test: get_changes_for_domain filters by date.

        Setup:
            - Events at different dates
            - Query with since_date

        Expected:
            - Only events after since_date returned

        Validation:
            - All events have detected_at >= since_date
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)
        now = datetime.utcnow()

        # Create event (default = now)
        await service.create_change_event(
            domain="costco.com",
            module_type="m09_executive",
            snapshot_id=sample_snapshot_id,
            category="executive_change",
            field="test",
            old_value="old",
            new_value="new",
        )

        # ACTION - Query from 1 day ago
        since_date = now - timedelta(days=1)
        events = await service.get_changes_for_domain("costco.com", since_date=since_date)

        # VALIDATION
        assert len(events) == 1
        assert events[0].detected_at >= since_date

    @pytest.mark.asyncio
    async def test_get_significant_changes_filters_by_threshold(self, change_db_session, sample_snapshot_id):
        """
        Test: get_significant_changes filters by significance.

        Setup:
            - Events with different significance levels
            - Query with threshold

        Expected:
            - Only events at or above threshold returned

        Validation:
            - All events meet threshold
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # Create events with different significance
        await service.create_change_event(
            domain="costco.com",
            module_type="m02_tech_stack",
            snapshot_id=sample_snapshot_id,
            category="tech_stack_change",
            field="search",
            old_value="ES",
            new_value=None,
            significance="critical",
        )
        await service.create_change_event(
            domain="costco.com",
            module_type="m09_executive",
            snapshot_id=sample_snapshot_id,
            category="executive_change",
            field="cfo",
            old_value="John",
            new_value="Jane",
            significance="high",
        )
        await service.create_change_event(
            domain="costco.com",
            module_type="m04_financials",
            snapshot_id=sample_snapshot_id,
            category="financial_change",
            field="revenue",
            old_value=100,
            new_value=105,
            significance="low",
        )

        # ACTION
        events = await service.get_significant_changes(threshold="high")

        # VALIDATION
        assert len(events) == 2
        significance_levels = {e.significance for e in events}
        assert "low" not in significance_levels
        assert "critical" in significance_levels or "high" in significance_levels

    @pytest.mark.asyncio
    async def test_get_changes_by_category(self, change_db_session, sample_snapshot_id):
        """
        Test: get_changes_by_category filters by category.

        Setup:
            - Events with different categories
            - Query for specific category

        Expected:
            - Only events in category returned

        Validation:
            - All events have correct category
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # Create events with different categories
        await service.create_change_event(
            domain="costco.com",
            module_type="m09_executive",
            snapshot_id=sample_snapshot_id,
            category="executive_change",
            field="ceo",
            old_value="old",
            new_value="new",
        )
        await service.create_change_event(
            domain="costco.com",
            module_type="m02_tech_stack",
            snapshot_id=sample_snapshot_id,
            category="tech_stack_change",
            field="search",
            old_value="old",
            new_value="new",
        )

        # ACTION
        events = await service.get_changes_by_category("executive_change")

        # VALIDATION
        assert len(events) == 1
        assert events[0].category == "executive_change"

    @pytest.mark.asyncio
    async def test_get_recent_changes(self, change_db_session, sample_snapshot_id):
        """
        Test: get_recent_changes returns ordered list.

        Setup:
            - Multiple events

        Expected:
            - Events ordered by detected_at DESC

        Validation:
            - Order is correct
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        for i in range(5):
            await service.create_change_event(
                domain="costco.com",
                module_type="m09_executive",
                snapshot_id=sample_snapshot_id,
                category="executive_change",
                field=f"field_{i}",
                old_value=f"old_{i}",
                new_value=f"new_{i}",
            )

        # ACTION
        events = await service.get_recent_changes(limit=10)

        # VALIDATION
        assert len(events) == 5
        # Check ordering (most recent first)
        for i in range(len(events) - 1):
            assert events[i].detected_at >= events[i + 1].detected_at


# =============================================================================
# TestChangeDetectionServiceCalculateSignificance
# =============================================================================

class TestChangeDetectionServiceCalculateSignificance:
    """
    Tests for significance calculation logic.
    """

    def test_calculate_significance_critical_field(self, change_db_session):
        """
        Test: Critical fields get high significance.

        Setup:
            - Change to search field (critical for tech_stack_change)

        Expected:
            - Significance score in critical range

        Validation:
            - Score >= 0.9
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION
        score = service.calculate_significance(
            category="tech_stack_change",
            field="search_provider",
            old_value="Elasticsearch",
            new_value=None,
        )

        # VALIDATION
        assert score >= 0.9, f"Expected critical score (>=0.9), got {score}"

    def test_calculate_significance_removal_boosts_score(self, change_db_session):
        """
        Test: Removal of value boosts significance.

        Setup:
            - Change where new_value is None

        Expected:
            - Score boosted by 0.2

        Validation:
            - Score higher than base
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION
        score = service.calculate_significance(
            category="executive_change",
            field="advisor",
            old_value="Some Advisor",
            new_value=None,  # Removed
        )

        # VALIDATION
        base_score = CHANGE_CATEGORIES["executive_change"]["default_significance"]
        assert score >= base_score, f"Score should be >= base ({base_score})"

    def test_calculate_significance_large_numeric_change(self, change_db_session):
        """
        Test: Large numeric change boosts significance.

        Setup:
            - >50% change in numeric value

        Expected:
            - Score boosted

        Validation:
            - Score higher than base
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION - 100% change (100 -> 200)
        score = service.calculate_significance(
            category="financial_change",
            field="revenue",
            old_value=100,
            new_value=200,
        )

        # VALIDATION
        base_score = CHANGE_CATEGORIES["financial_change"]["default_significance"]
        assert score > base_score, f"Score should be > base ({base_score})"

    def test_calculate_significance_small_change_uses_base(self, change_db_session):
        """
        Test: Small changes use base significance.

        Setup:
            - <20% change in numeric value

        Expected:
            - Score equals base

        Validation:
            - Score equals category default
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION - 5% change
        score = service.calculate_significance(
            category="financial_change",
            field="minor_metric",
            old_value=100,
            new_value=105,
        )

        # VALIDATION
        base_score = CHANGE_CATEGORIES["financial_change"]["default_significance"]
        assert score == base_score, f"Score should equal base ({base_score})"


# =============================================================================
# TestChangeDetectionServiceClassification
# =============================================================================

class TestChangeDetectionServiceClassification:
    """
    Tests for field-to-category classification.
    """

    def test_classify_executive_fields(self, change_db_session):
        """
        Test: Executive-related fields classify correctly.

        Setup:
            - Field containing "ceo"

        Expected:
            - Category is executive_change

        Validation:
            - Classification is correct
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION
        category = service._classify_field_to_category("ceo_name", "m01_company_context")

        # VALIDATION
        assert category == "executive_change"

    def test_classify_tech_fields(self, change_db_session):
        """
        Test: Tech-related fields classify correctly.

        Setup:
            - Field containing "search"

        Expected:
            - Category is tech_stack_change

        Validation:
            - Classification is correct
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION
        category = service._classify_field_to_category("search_provider", "m01_company_context")

        # VALIDATION
        assert category == "tech_stack_change"

    def test_classify_financial_fields(self, change_db_session):
        """
        Test: Financial fields classify correctly.

        Setup:
            - Field containing "revenue"

        Expected:
            - Category is financial_change

        Validation:
            - Classification is correct
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION
        category = service._classify_field_to_category("annual_revenue", "m01_company_context")

        # VALIDATION
        assert category == "financial_change"

    def test_classify_falls_back_to_module_type(self, change_db_session):
        """
        Test: Unknown fields fall back to module-based classification.

        Setup:
            - Generic field name
            - Module type m09_executive

        Expected:
            - Category based on module type

        Validation:
            - Falls back correctly
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)

        # ACTION
        category = service._classify_field_to_category("some_random_field", "m09_executive")

        # VALIDATION
        assert category == "executive_change"


# =============================================================================
# TestChangeDetectionServiceIntegration
# =============================================================================

class TestChangeDetectionServiceIntegration:
    """
    Integration tests for end-to-end workflows.
    """

    @pytest.mark.asyncio
    async def test_full_change_detection_workflow(self, change_db_session, sample_snapshot_id):
        """
        Test: Full workflow from diff to query.

        Setup:
            - Create events from diff
            - Query changes

        Expected:
            - Events created and queryable

        Validation:
            - End-to-end success
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)
        diff = {
            "changed": {
                "executives": {
                    "old": [{"name": "Old CEO"}],
                    "new": [{"name": "New CEO"}],
                },
            },
            "added": {
                "new_metric": 100,
            },
            "removed": {
                "old_field": "removed_value",
            },
        }

        # ACTION - Create events
        created_events = await service.create_change_events_from_diff(
            domain="test.com",
            module_type="m09_executive",
            snapshot_id=sample_snapshot_id,
            diff=diff,
        )

        # ACTION - Query events
        queried_events = await service.get_changes_for_domain("test.com")

        # VALIDATION
        assert len(created_events) == 3  # 1 changed + 1 added + 1 removed
        assert len(queried_events) == 3
        assert all(e.domain == "test.com" for e in queried_events)

    @pytest.mark.asyncio
    async def test_multiple_domains_isolation(self, change_db_session, sample_snapshot_id):
        """
        Test: Events are isolated by domain.

        Setup:
            - Create events for 3 domains

        Expected:
            - Each domain query returns only its events

        Validation:
            - Domain isolation
        """
        # SETUP
        service = ChangeDetectionService(change_db_session)
        domains = ["domain1.com", "domain2.com", "domain3.com"]

        for domain in domains:
            await service.create_change_event(
                domain=domain,
                module_type="m09_executive",
                snapshot_id=sample_snapshot_id,
                category="executive_change",
                field="ceo",
                old_value="old",
                new_value="new",
            )

        # VALIDATION
        for domain in domains:
            events = await service.get_changes_for_domain(domain)
            assert len(events) == 1
            assert events[0].domain == domain
