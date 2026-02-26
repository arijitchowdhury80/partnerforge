"""
Integration Tests for Alerts API Endpoints

Tests alert rules, notifications, digest, and preferences.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime
from typing import AsyncGenerator

# Import app and dependencies
from app.main import app
from app.database import Base, get_session
from app.api.deps import get_current_user, CurrentUser


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh in-memory database for each test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def mock_user():
    """Create a mock current user."""
    return CurrentUser(
        user_id="test-user-001",
        email="test@partnerforge.local",
        name="Test User",
        role="ae",
        team_id="test-team-001",
        is_active=True,
        is_admin=False,
    )


@pytest.fixture
def mock_other_user():
    """Create a mock different user."""
    return CurrentUser(
        user_id="other-user-001",
        email="other@partnerforge.local",
        name="Other User",
        role="ae",
        team_id="test-team-001",
        is_active=True,
        is_admin=False,
    )


@pytest.fixture
async def client(test_db, mock_user):
    """Create a test client with database and user overrides."""

    async def override_get_session():
        yield test_db

    async def override_get_user():
        return mock_user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def other_client(test_db, mock_other_user):
    """Create a test client with a different user."""

    async def override_get_session():
        yield test_db

    async def override_get_user():
        return mock_other_user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def sample_rule_data():
    """Sample alert rule data."""
    return {
        "name": "Executive Changes - Hot Leads",
        "description": "Alert when executives change at hot lead accounts",
        "is_active": True,
        "conditions": {
            "scope": "my_territory",
            "change_categories": ["executive_change"],
            "min_significance": "high",
            "additional_filters": {
                "icp_score_gt": 70
            }
        },
        "channels": ["in_app", "email"],
        "frequency": "immediate"
    }


# =============================================================================
# List Alerts Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_alerts_empty(client):
    """Test listing alerts when none exist."""
    response = await client.get("/api/v1/alerts")
    assert response.status_code == 200

    data = response.json()
    assert data["alerts"] == []
    assert data["total"] == 0
    assert data["unread_count"] == 0


@pytest.mark.asyncio
async def test_list_alerts_pagination(client):
    """Test alert list pagination metadata."""
    response = await client.get("/api/v1/alerts?page=1&limit=10")
    assert response.status_code == 200

    data = response.json()
    assert "pagination" in data
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["limit"] == 10


@pytest.mark.asyncio
async def test_list_alerts_filter_by_status(client):
    """Test filtering alerts by status."""
    response = await client.get("/api/v1/alerts?status=unread")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_alerts_filter_by_significance(client):
    """Test filtering alerts by significance."""
    response = await client.get("/api/v1/alerts?significance=high")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_alerts_filter_by_domain(client):
    """Test filtering alerts by domain."""
    response = await client.get("/api/v1/alerts?domain=costco.com")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_alerts_invalid_status(client):
    """Test filtering with invalid status."""
    response = await client.get("/api/v1/alerts?status=invalid")
    assert response.status_code == 422


# =============================================================================
# Alert Rules CRUD Tests
# =============================================================================

@pytest.mark.asyncio
async def test_create_alert_rule(client, sample_rule_data):
    """Test creating an alert rule."""
    response = await client.post("/api/v1/alerts/rules", json=sample_rule_data)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == sample_rule_data["name"]
    assert data["is_active"] is True
    assert "id" in data
    assert data["trigger_count"] == 0


@pytest.mark.asyncio
async def test_create_alert_rule_minimal(client):
    """Test creating an alert rule with minimal data."""
    response = await client.post(
        "/api/v1/alerts/rules",
        json={
            "name": "Minimal Rule",
            "conditions": {
                "scope": "all",
                "change_categories": ["tech_stack_change"],
                "min_significance": "medium"
            },
            "channels": ["in_app"],
            "frequency": "daily_digest"
        }
    )
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "Minimal Rule"


@pytest.mark.asyncio
async def test_list_alert_rules_empty(client):
    """Test listing rules when none exist."""
    response = await client.get("/api/v1/alerts/rules")
    assert response.status_code == 200

    data = response.json()
    assert data["rules"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_alert_rules_with_data(client, sample_rule_data):
    """Test listing rules after creating one."""
    # Create rule
    await client.post("/api/v1/alerts/rules", json=sample_rule_data)

    # List rules
    response = await client.get("/api/v1/alerts/rules")
    assert response.status_code == 200

    data = response.json()
    assert len(data["rules"]) == 1
    assert data["total"] == 1


@pytest.mark.asyncio
async def test_list_alert_rules_active_only(client, sample_rule_data):
    """Test listing only active rules."""
    # Create active rule
    await client.post("/api/v1/alerts/rules", json=sample_rule_data)

    # Create inactive rule
    inactive_rule = sample_rule_data.copy()
    inactive_rule["name"] = "Inactive Rule"
    inactive_rule["is_active"] = False
    await client.post("/api/v1/alerts/rules", json=inactive_rule)

    # List active only
    response = await client.get("/api/v1/alerts/rules?active_only=true")
    assert response.status_code == 200

    data = response.json()
    assert len(data["rules"]) == 1
    assert data["rules"][0]["is_active"] is True


@pytest.mark.asyncio
async def test_get_alert_rule(client, sample_rule_data):
    """Test getting a single alert rule."""
    # Create rule
    create_response = await client.post("/api/v1/alerts/rules", json=sample_rule_data)
    rule_id = create_response.json()["id"]

    # Get rule
    response = await client.get(f"/api/v1/alerts/rules/{rule_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == rule_id
    assert data["name"] == sample_rule_data["name"]


@pytest.mark.asyncio
async def test_get_alert_rule_not_found(client):
    """Test 404 for non-existent rule."""
    response = await client.get("/api/v1/alerts/rules/nonexistent-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_alert_rule(client, sample_rule_data):
    """Test updating an alert rule."""
    # Create rule
    create_response = await client.post("/api/v1/alerts/rules", json=sample_rule_data)
    rule_id = create_response.json()["id"]

    # Update rule
    response = await client.put(
        f"/api/v1/alerts/rules/{rule_id}",
        json={"name": "Updated Rule Name", "is_active": False}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "Updated Rule Name"
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_update_alert_rule_partial(client, sample_rule_data):
    """Test partial update of an alert rule."""
    # Create rule
    create_response = await client.post("/api/v1/alerts/rules", json=sample_rule_data)
    rule_id = create_response.json()["id"]
    original_name = create_response.json()["name"]

    # Update only is_active
    response = await client.put(
        f"/api/v1/alerts/rules/{rule_id}",
        json={"is_active": False}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == original_name  # Unchanged
    assert data["is_active"] is False  # Changed


@pytest.mark.asyncio
async def test_update_alert_rule_not_found(client):
    """Test 404 when updating non-existent rule."""
    response = await client.put(
        "/api/v1/alerts/rules/nonexistent-id",
        json={"name": "New Name"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_alert_rule(client, sample_rule_data):
    """Test deleting an alert rule."""
    # Create rule
    create_response = await client.post("/api/v1/alerts/rules", json=sample_rule_data)
    rule_id = create_response.json()["id"]

    # Delete rule
    response = await client.delete(f"/api/v1/alerts/rules/{rule_id}")
    assert response.status_code == 204

    # Verify deleted
    get_response = await client.get(f"/api/v1/alerts/rules/{rule_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_alert_rule_not_found(client):
    """Test 404 when deleting non-existent rule."""
    response = await client.delete("/api/v1/alerts/rules/nonexistent-id")
    assert response.status_code == 404


# =============================================================================
# Alert Actions Tests
# =============================================================================

@pytest.mark.asyncio
async def test_mark_alert_read_not_found(client):
    """Test marking non-existent alert as read."""
    response = await client.post("/api/v1/alerts/nonexistent-id/read")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_dismiss_alert_not_found(client):
    """Test dismissing non-existent alert."""
    response = await client.post("/api/v1/alerts/nonexistent-id/dismiss")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_mark_alert_acted_not_found(client):
    """Test marking non-existent alert as acted."""
    response = await client.post("/api/v1/alerts/nonexistent-id/act")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_bulk_mark_read_empty(client):
    """Test bulk mark read with no alerts."""
    response = await client.post(
        "/api/v1/alerts/read-bulk",
        json={"alert_ids": None}  # Mark all
    )
    assert response.status_code == 200

    data = response.json()
    assert data["marked_count"] == 0


# =============================================================================
# Alert Digest Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_alert_digest_daily(client):
    """Test getting daily alert digest."""
    response = await client.get("/api/v1/alerts/digest?period=daily")
    assert response.status_code == 200

    data = response.json()
    assert data["digest_type"] == "daily"
    assert "total_alerts" in data
    assert "critical_count" in data
    assert "high_count" in data
    assert "by_category" in data
    assert "by_domain" in data


@pytest.mark.asyncio
async def test_get_alert_digest_hourly(client):
    """Test getting hourly alert digest."""
    response = await client.get("/api/v1/alerts/digest?period=hourly")
    assert response.status_code == 200

    data = response.json()
    assert data["digest_type"] == "hourly"


@pytest.mark.asyncio
async def test_get_alert_digest_invalid_period(client):
    """Test getting digest with invalid period."""
    response = await client.get("/api/v1/alerts/digest?period=invalid")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_alert_digest_structure(client):
    """Test alert digest response structure."""
    response = await client.get("/api/v1/alerts/digest")
    assert response.status_code == 200

    data = response.json()
    assert "digest_id" in data
    assert "user_id" in data
    assert "period_start" in data
    assert "period_end" in data
    assert "generated_at" in data
    assert "top_alerts" in data


# =============================================================================
# Alert Preferences Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_alert_preferences_default(client):
    """Test getting default alert preferences."""
    response = await client.get("/api/v1/alerts/preferences")
    assert response.status_code == 200

    data = response.json()
    assert data["alerts_enabled"] is True
    assert data["email_enabled"] is True
    assert data["in_app_enabled"] is True
    assert "digest_frequency" in data


@pytest.mark.asyncio
async def test_update_alert_preferences(client):
    """Test updating alert preferences."""
    response = await client.put(
        "/api/v1/alerts/preferences",
        json={
            "alerts_enabled": False,
            "email_enabled": False,
            "digest_frequency": "weekly"
        }
    )
    assert response.status_code == 200

    data = response.json()
    assert data["alerts_enabled"] is False
    assert data["email_enabled"] is False


@pytest.mark.asyncio
async def test_update_preferences_partial(client):
    """Test partial preference update."""
    # First get defaults
    default_response = await client.get("/api/v1/alerts/preferences")
    default_email = default_response.json()["email_enabled"]

    # Update only alerts_enabled
    response = await client.put(
        "/api/v1/alerts/preferences",
        json={"alerts_enabled": False}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["alerts_enabled"] is False
    assert data["email_enabled"] == default_email  # Unchanged


@pytest.mark.asyncio
async def test_update_preferences_quiet_hours(client):
    """Test updating quiet hours preferences."""
    response = await client.put(
        "/api/v1/alerts/preferences",
        json={
            "quiet_hours_enabled": True,
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "08:00",
            "quiet_hours_timezone": "America/New_York"
        }
    )
    assert response.status_code == 200

    data = response.json()
    assert data["quiet_hours_enabled"] is True


@pytest.mark.asyncio
async def test_update_preferences_significance_thresholds(client):
    """Test updating significance thresholds."""
    response = await client.put(
        "/api/v1/alerts/preferences",
        json={
            "min_significance_email": "critical",
            "min_significance_slack": "high"
        }
    )
    assert response.status_code == 200

    data = response.json()
    assert data["min_significance_email"] == "critical"
    assert data["min_significance_slack"] == "high"


# =============================================================================
# User Isolation Tests
# =============================================================================

@pytest.mark.asyncio
async def test_rules_isolated_by_user(client, other_client, sample_rule_data):
    """Test that rules are isolated by user."""
    # Create rule as first user
    await client.post("/api/v1/alerts/rules", json=sample_rule_data)

    # List rules as second user
    response = await other_client.get("/api/v1/alerts/rules")
    assert response.status_code == 200

    data = response.json()
    assert data["rules"] == []  # Should not see other user's rules


# =============================================================================
# Response Format Tests
# =============================================================================

@pytest.mark.asyncio
async def test_alert_rule_response_fields(client, sample_rule_data):
    """Test alert rule response includes required fields."""
    response = await client.post("/api/v1/alerts/rules", json=sample_rule_data)
    assert response.status_code == 201

    data = response.json()
    required_fields = [
        "id", "user_id", "name", "is_active", "conditions",
        "channels", "frequency", "trigger_count", "created_at", "updated_at"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_alert_list_response_fields(client):
    """Test alert list response includes required fields."""
    response = await client.get("/api/v1/alerts")
    assert response.status_code == 200

    data = response.json()
    required_fields = ["alerts", "total", "unread_count", "pagination"]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_preferences_response_fields(client):
    """Test preferences response includes required fields."""
    response = await client.get("/api/v1/alerts/preferences")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "user_id", "alerts_enabled", "email_enabled", "slack_enabled",
        "in_app_enabled", "digest_frequency", "updated_at"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"
