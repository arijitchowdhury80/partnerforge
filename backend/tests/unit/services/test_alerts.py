"""
Tests for AlertService

Tests all alert rule management, evaluation, and notification functionality.

Validation Criteria:
- Alert rules are created and managed correctly
- Rule evaluation matches expected conditions
- Alerts are triggered appropriately
- Digests aggregate alerts correctly
- Read/dismiss status tracking works
"""

import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timedelta
from typing import AsyncGenerator
from unittest.mock import MagicMock

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.services.alerts import AlertService, SIGNIFICANCE_HIERARCHY
from app.models.alerts import AlertRule, Alert, AlertDigest
from app.models.versioning import ChangeEvent


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def alert_engine():
    """Create test database engine with alert tables."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(AlertRule.__table__.create)
        await conn.run_sync(Alert.__table__.create)
        await conn.run_sync(AlertDigest.__table__.create)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def alert_db_session(alert_engine) -> AsyncGenerator:
    """Create test database session."""
    async_session = async_sessionmaker(
        alert_engine,
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
def sample_change_event():
    """Create a mock change event for testing."""
    event = MagicMock(spec=ChangeEvent)
    event.id = str(uuid.uuid4())
    event.domain = "costco.com"
    event.module_type = "m09_executive"
    event.category = "executive_change"
    event.significance = "high"
    event.field = "cfo"
    event.old_value = "John Smith"
    event.new_value = "Jane Doe"
    event.summary = "CFO changed: John Smith -> Jane Doe"
    event.algolia_relevance = "New CFO opportunity"
    event.snapshot_id = str(uuid.uuid4())
    return event


# =============================================================================
# TestAlertServiceCreateRule
# =============================================================================

class TestAlertServiceCreateRule:
    """
    Tests for AlertService.create_rule()
    """

    @pytest.mark.asyncio
    async def test_create_rule_success(self, alert_db_session, sample_user_id):
        """
        Test: Creating an alert rule succeeds with valid parameters.

        Setup:
            - Valid rule parameters

        Expected:
            - Rule is created
            - All fields are populated correctly
            - Rule is active by default

        Validation:
            - Field values match input
        """
        # SETUP
        service = AlertService(alert_db_session)
        conditions = {
            "scope": "all",
            "change_categories": ["executive_change"],
            "min_significance": "high",
        }

        # ACTION
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions=conditions,
            channels=["in_app", "email"],
            description="Test description",
        )

        # VALIDATION
        assert rule.id is not None
        assert rule.user_id == sample_user_id
        assert rule.name == "Test Rule"
        assert rule.description == "Test description"
        assert rule.is_active == True
        assert rule.conditions == conditions
        assert rule.channels == ["in_app", "email"]
        assert rule.trigger_count == 0

    @pytest.mark.asyncio
    async def test_create_rule_default_channels(self, alert_db_session, sample_user_id):
        """
        Test: Rule created with default channels when not specified.

        Setup:
            - No channels parameter

        Expected:
            - channels defaults to ["in_app"]

        Validation:
            - Default channels applied
        """
        # SETUP
        service = AlertService(alert_db_session)

        # ACTION
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )

        # VALIDATION
        assert rule.channels == ["in_app"]

    @pytest.mark.asyncio
    async def test_create_rule_invalid_significance_fails(self, alert_db_session, sample_user_id):
        """
        Test: Invalid significance level fails validation.

        Setup:
            - Invalid min_significance value

        Expected:
            - ValueError raised

        Validation:
            - Correct exception
        """
        # SETUP
        service = AlertService(alert_db_session)

        # ACTION & VALIDATION
        with pytest.raises(ValueError) as exc_info:
            await service.create_rule(
                user_id=sample_user_id,
                name="Test Rule",
                conditions={
                    "scope": "all",
                    "min_significance": "super_critical",  # Invalid
                },
            )

        assert "Invalid significance" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_rule_empty_conditions_fails(self, alert_db_session, sample_user_id):
        """
        Test: Empty conditions fails validation.

        Setup:
            - Empty conditions dict

        Expected:
            - ValueError raised

        Validation:
            - Conditions are required
        """
        # SETUP
        service = AlertService(alert_db_session)

        # ACTION & VALIDATION
        with pytest.raises(ValueError) as exc_info:
            await service.create_rule(
                user_id=sample_user_id,
                name="Test Rule",
                conditions={},  # Empty
            )

        assert "empty" in str(exc_info.value).lower()


# =============================================================================
# TestAlertServiceUpdateDeleteRule
# =============================================================================

class TestAlertServiceUpdateDeleteRule:
    """
    Tests for updating and deleting rules.
    """

    @pytest.mark.asyncio
    async def test_update_rule_success(self, alert_db_session, sample_user_id):
        """
        Test: Updating a rule succeeds.

        Setup:
            - Create rule
            - Update name and is_active

        Expected:
            - Fields are updated

        Validation:
            - Updated values match
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Original Name",
            conditions={"scope": "all"},
        )

        # ACTION
        updated = await service.update_rule(
            rule_id=rule.id,
            updates={
                "name": "Updated Name",
                "is_active": False,
            },
        )

        # VALIDATION
        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.is_active == False

    @pytest.mark.asyncio
    async def test_update_nonexistent_rule_returns_none(self, alert_db_session):
        """
        Test: Updating non-existent rule returns None.

        Setup:
            - Non-existent rule ID

        Expected:
            - Returns None

        Validation:
            - No exception
        """
        # SETUP
        service = AlertService(alert_db_session)

        # ACTION
        result = await service.update_rule(
            rule_id=str(uuid.uuid4()),
            updates={"name": "New Name"},
        )

        # VALIDATION
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_rule_success(self, alert_db_session, sample_user_id):
        """
        Test: Deleting a rule succeeds.

        Setup:
            - Create rule
            - Delete it

        Expected:
            - Rule is deleted
            - True returned

        Validation:
            - Rule no longer exists
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="To Delete",
            conditions={"scope": "all"},
        )

        # ACTION
        result = await service.delete_rule(rule.id)

        # VALIDATION
        assert result == True
        rules = await service.get_user_rules(sample_user_id)
        assert len(rules) == 0

    @pytest.mark.asyncio
    async def test_delete_nonexistent_rule_returns_false(self, alert_db_session):
        """
        Test: Deleting non-existent rule returns False.

        Setup:
            - Non-existent rule ID

        Expected:
            - Returns False

        Validation:
            - No exception
        """
        # SETUP
        service = AlertService(alert_db_session)

        # ACTION
        result = await service.delete_rule(str(uuid.uuid4()))

        # VALIDATION
        assert result == False


# =============================================================================
# TestAlertServiceEvaluateRule
# =============================================================================

class TestAlertServiceEvaluateRule:
    """
    Tests for AlertService.evaluate_rule()
    """

    @pytest.mark.asyncio
    async def test_evaluate_rule_matches_all_conditions(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Rule matches when all conditions are met.

        Setup:
            - Rule with category and significance conditions
            - Event matching those conditions

        Expected:
            - evaluate_rule returns True

        Validation:
            - Match is correct
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Match Rule",
            conditions={
                "scope": "all",
                "change_categories": ["executive_change"],
                "min_significance": "high",
            },
        )

        # ACTION
        result = service.evaluate_rule(rule, sample_change_event)

        # VALIDATION
        assert result == True

    @pytest.mark.asyncio
    async def test_evaluate_rule_fails_category_mismatch(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Rule fails when category doesn't match.

        Setup:
            - Rule requiring tech_stack_change
            - Event with executive_change

        Expected:
            - evaluate_rule returns False

        Validation:
            - No match
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="No Match Rule",
            conditions={
                "scope": "all",
                "change_categories": ["tech_stack_change"],  # Not executive_change
            },
        )

        # ACTION
        result = service.evaluate_rule(rule, sample_change_event)

        # VALIDATION
        assert result == False

    @pytest.mark.asyncio
    async def test_evaluate_rule_fails_significance_below_threshold(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Rule fails when significance is below threshold.

        Setup:
            - Rule requiring critical significance
            - Event with high significance

        Expected:
            - evaluate_rule returns False

        Validation:
            - Significance threshold enforced
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Critical Only",
            conditions={
                "scope": "all",
                "min_significance": "critical",  # Event is "high"
            },
        )

        # ACTION
        result = service.evaluate_rule(rule, sample_change_event)

        # VALIDATION
        assert result == False

    @pytest.mark.asyncio
    async def test_evaluate_rule_domain_scope_list(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Rule with domain list scope.

        Setup:
            - Rule with scope = ["costco.com", "walmart.com"]
            - Event for costco.com

        Expected:
            - evaluate_rule returns True

        Validation:
            - Domain in list matches
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Domain List Rule",
            conditions={
                "scope": ["costco.com", "walmart.com"],
            },
        )

        # ACTION
        result = service.evaluate_rule(rule, sample_change_event)

        # VALIDATION
        assert result == True

    @pytest.mark.asyncio
    async def test_evaluate_rule_domain_not_in_list(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Rule fails when domain not in list.

        Setup:
            - Rule with scope = ["target.com"]
            - Event for costco.com

        Expected:
            - evaluate_rule returns False

        Validation:
            - Domain filtering works
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Other Domains",
            conditions={
                "scope": ["target.com", "walmart.com"],
            },
        )

        # ACTION
        result = service.evaluate_rule(rule, sample_change_event)

        # VALIDATION
        assert result == False

    @pytest.mark.asyncio
    async def test_evaluate_rule_inactive_rule_fails(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Inactive rules always fail evaluation.

        Setup:
            - Inactive rule that would otherwise match

        Expected:
            - evaluate_rule returns False

        Validation:
            - Inactive rules skipped
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Inactive Rule",
            conditions={"scope": "all"},
        )
        await service.update_rule(rule.id, {"is_active": False})

        # ACTION
        result = service.evaluate_rule(rule, sample_change_event)

        # VALIDATION
        assert result == False

    @pytest.mark.asyncio
    async def test_evaluate_rule_my_territory_scope(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: my_territory scope requires territory domains.

        Setup:
            - Rule with my_territory scope
            - Territory includes costco.com

        Expected:
            - evaluate_rule returns True

        Validation:
            - Territory matching works
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Territory Rule",
            conditions={
                "scope": "my_territory",
            },
        )

        # ACTION
        result = service.evaluate_rule(
            rule,
            sample_change_event,
            user_territory_domains=["costco.com", "walmart.com"],
        )

        # VALIDATION
        assert result == True


# =============================================================================
# TestAlertServiceTriggerAlert
# =============================================================================

class TestAlertServiceTriggerAlert:
    """
    Tests for AlertService.trigger_alert()
    """

    @pytest.mark.asyncio
    async def test_trigger_alert_creates_alert(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Triggering alert creates alert record.

        Setup:
            - Rule and matching event

        Expected:
            - Alert is created with correct fields

        Validation:
            - Alert fields populated
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )

        # ACTION
        alert = await service.trigger_alert(rule, sample_change_event)

        # VALIDATION
        assert alert.id is not None
        assert alert.rule_id == rule.id
        assert alert.user_id == sample_user_id
        assert alert.domain == "costco.com"
        assert alert.status == "unread"
        assert alert.significance == "high"
        assert alert.title is not None
        assert alert.summary is not None

    @pytest.mark.asyncio
    async def test_trigger_alert_updates_rule_stats(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Triggering alert updates rule statistics.

        Setup:
            - Rule with trigger_count = 0

        Expected:
            - trigger_count incremented
            - last_triggered updated

        Validation:
            - Stats updated
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )
        original_count = rule.trigger_count

        # ACTION
        await service.trigger_alert(rule, sample_change_event)

        # VALIDATION
        assert rule.trigger_count == original_count + 1
        assert rule.last_triggered is not None


# =============================================================================
# TestAlertServiceUserAlerts
# =============================================================================

class TestAlertServiceUserAlerts:
    """
    Tests for alert retrieval and status management.
    """

    @pytest.mark.asyncio
    async def test_get_user_alerts(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Get alerts for a user.

        Setup:
            - Create multiple alerts

        Expected:
            - All alerts returned

        Validation:
            - Count matches
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )

        # Create 3 alerts
        for _ in range(3):
            await service.trigger_alert(rule, sample_change_event)

        # ACTION
        alerts = await service.get_user_alerts(sample_user_id)

        # VALIDATION
        assert len(alerts) == 3
        assert all(a.user_id == sample_user_id for a in alerts)

    @pytest.mark.asyncio
    async def test_get_user_alerts_by_status(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Filter alerts by status.

        Setup:
            - Create alerts, mark some as read

        Expected:
            - Only unread alerts returned

        Validation:
            - Status filtering works
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )

        # Create 3 alerts
        alerts = []
        for _ in range(3):
            a = await service.trigger_alert(rule, sample_change_event)
            alerts.append(a)

        # Mark one as read
        await service.mark_read(alerts[0].id)

        # ACTION
        unread = await service.get_user_alerts(sample_user_id, status="unread")

        # VALIDATION
        assert len(unread) == 2

    @pytest.mark.asyncio
    async def test_mark_read(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Mark alert as read.

        Setup:
            - Unread alert

        Expected:
            - Status changes to read
            - read_at is set

        Validation:
            - Status updated
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )
        alert = await service.trigger_alert(rule, sample_change_event)

        # ACTION
        updated = await service.mark_read(alert.id)

        # VALIDATION
        assert updated.status == "read"
        assert updated.read_at is not None

    @pytest.mark.asyncio
    async def test_mark_acted(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Mark alert as acted upon.

        Setup:
            - Unread alert

        Expected:
            - Status changes to acted
            - acted_at is set

        Validation:
            - Status updated
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )
        alert = await service.trigger_alert(rule, sample_change_event)

        # ACTION
        updated = await service.mark_acted(alert.id)

        # VALIDATION
        assert updated.status == "acted"
        assert updated.acted_at is not None
        assert updated.read_at is not None  # Also marked as read

    @pytest.mark.asyncio
    async def test_dismiss_alert(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Dismiss an alert.

        Setup:
            - Unread alert

        Expected:
            - Status changes to dismissed
            - dismissed_at is set

        Validation:
            - Status updated
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )
        alert = await service.trigger_alert(rule, sample_change_event)

        # ACTION
        updated = await service.dismiss_alert(alert.id)

        # VALIDATION
        assert updated.status == "dismissed"
        assert updated.dismissed_at is not None


# =============================================================================
# TestAlertServiceDigests
# =============================================================================

class TestAlertServiceDigests:
    """
    Tests for digest creation.
    """

    @pytest.mark.asyncio
    async def test_create_digest_success(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Create daily digest aggregates alerts.

        Setup:
            - Multiple alerts in the period

        Expected:
            - Digest created with correct counts

        Validation:
            - Alert counts match
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )

        # Create 5 alerts
        for _ in range(5):
            await service.trigger_alert(rule, sample_change_event)

        # ACTION
        digest = await service.create_digest(sample_user_id, period="daily")

        # VALIDATION
        assert digest is not None
        assert digest.alert_count == 5
        assert digest.user_id == sample_user_id
        assert digest.digest_type == "daily"
        assert digest.status == "pending"
        assert len(digest.alert_ids) == 5

    @pytest.mark.asyncio
    async def test_create_digest_no_alerts_returns_none(
        self, alert_db_session, sample_user_id
    ):
        """
        Test: No digest created if no alerts in period.

        Setup:
            - No alerts

        Expected:
            - Returns None

        Validation:
            - No unnecessary digests
        """
        # SETUP
        service = AlertService(alert_db_session)

        # ACTION
        digest = await service.create_digest(sample_user_id, period="daily")

        # VALIDATION
        assert digest is None

    @pytest.mark.asyncio
    async def test_create_digest_counts_by_significance(
        self, alert_db_session, sample_user_id
    ):
        """
        Test: Digest counts alerts by significance.

        Setup:
            - Alerts with different significance levels

        Expected:
            - Counts by significance are correct

        Validation:
            - Significance breakdown
        """
        # SETUP
        service = AlertService(alert_db_session)
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Test Rule",
            conditions={"scope": "all"},
        )

        # Create alerts with different significance
        for sig in ["critical", "high", "medium"]:
            event = MagicMock(spec=ChangeEvent)
            event.domain = "test.com"
            event.module_type = "m09_executive"
            event.category = "executive_change"
            event.significance = sig
            event.field = "test"
            event.old_value = "old"
            event.new_value = "new"
            event.summary = "test"
            event.algolia_relevance = "test"
            event.snapshot_id = str(uuid.uuid4())

            await service.trigger_alert(rule, event)

        # ACTION
        digest = await service.create_digest(sample_user_id)

        # VALIDATION
        assert digest.critical_count == 1
        assert digest.high_count == 1
        assert digest.medium_count == 1


# =============================================================================
# TestAlertServiceIntegration
# =============================================================================

class TestAlertServiceIntegration:
    """
    Integration tests for complete alert workflows.
    """

    @pytest.mark.asyncio
    async def test_full_alert_workflow(
        self, alert_db_session, sample_user_id, sample_change_event
    ):
        """
        Test: Complete workflow from rule to digest.

        Setup:
            - Create rule
            - Trigger alerts
            - Mark some as read
            - Create digest

        Expected:
            - All operations succeed

        Validation:
            - End-to-end workflow
        """
        # SETUP
        service = AlertService(alert_db_session)

        # Create rule
        rule = await service.create_rule(
            user_id=sample_user_id,
            name="Workflow Test Rule",
            conditions={
                "scope": "all",
                "change_categories": ["executive_change"],
                "min_significance": "medium",
            },
            channels=["in_app", "email"],
        )

        # Evaluate and trigger
        if service.evaluate_rule(rule, sample_change_event):
            await service.trigger_alert(rule, sample_change_event)
            await service.trigger_alert(rule, sample_change_event)

        # Get alerts
        alerts = await service.get_user_alerts(sample_user_id)
        assert len(alerts) == 2

        # Mark one as read
        await service.mark_read(alerts[0].id)

        # Verify counts
        unread = await service.get_user_alerts(sample_user_id, status="unread")
        assert len(unread) == 1

        unread_count = await service.get_alert_count(sample_user_id, status="unread")
        assert unread_count == 1

        # Create digest
        digest = await service.create_digest(sample_user_id)
        assert digest is not None
        assert digest.alert_count == 2

        # Mark digest as sent
        await service.mark_digest_sent(digest.id)

        # VALIDATION
        rules = await service.get_user_rules(sample_user_id)
        assert len(rules) == 1
        assert rules[0].trigger_count == 2
