"""
Integration Tests for Changes API Endpoints

Tests change history, significant changes, recent changes, and analytics.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime, timedelta
from typing import AsyncGenerator
import uuid

# Import app and dependencies
from app.main import app
from app.database import Base, get_session
from app.api.deps import get_current_user, CurrentUser
from app.models import DisplacementTarget
from app.models.versioning import ChangeEvent, IntelSnapshot


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
async def sample_target(test_db) -> DisplacementTarget:
    """Create a sample displacement target."""
    target = DisplacementTarget(
        domain="costco.com",
        company_name="Costco Wholesale Corporation",
        partner_tech="Adobe AEM",
        vertical="Retail",
        country="US",
        icp_score=85,
        icp_tier_name="hot",
    )
    test_db.add(target)
    await test_db.commit()
    await test_db.refresh(target)
    return target


@pytest.fixture
async def sample_snapshots(test_db, sample_target) -> list[IntelSnapshot]:
    """Create sample intel snapshots."""
    snapshot1 = IntelSnapshot(
        id=uuid.uuid4(),
        domain="costco.com",
        module_type="m09_executive",
        version=1,
        snapshot_type="auto",
        data={
            "executives": [
                {"name": "John Smith", "title": "CFO"},
                {"name": "Bob Johnson", "title": "CEO"},
            ],
            "key_themes": ["cost_efficiency", "member_experience"],
        },
        snapshot_at=datetime.utcnow() - timedelta(days=30),
    )

    snapshot2 = IntelSnapshot(
        id=uuid.uuid4(),
        domain="costco.com",
        module_type="m09_executive",
        version=2,
        snapshot_type="auto",
        data={
            "executives": [
                {"name": "Jane Doe", "title": "CFO"},  # Changed
                {"name": "Bob Johnson", "title": "CEO"},
            ],
            "key_themes": ["digital_transformation", "member_experience"],  # Changed
        },
        snapshot_at=datetime.utcnow(),
    )

    test_db.add(snapshot1)
    test_db.add(snapshot2)
    await test_db.commit()
    await test_db.refresh(snapshot1)
    await test_db.refresh(snapshot2)

    return [snapshot1, snapshot2]


@pytest.fixture
async def sample_changes(test_db, sample_target, sample_snapshots) -> list[ChangeEvent]:
    """Create sample change events."""
    changes = [
        ChangeEvent(
            id=uuid.uuid4(),
            snapshot_id=sample_snapshots[1].id,
            domain="costco.com",
            module_type="m09_executive",
            category="executive_change",
            significance="high",
            field="executives",
            old_value="CFO: John Smith",
            new_value="CFO: Jane Doe",
            summary="CFO changed: John Smith -> Jane Doe",
            algolia_relevance="New CFO may not have existing vendor relationships",
            detected_at=datetime.utcnow(),
        ),
        ChangeEvent(
            id=uuid.uuid4(),
            snapshot_id=sample_snapshots[1].id,
            domain="costco.com",
            module_type="m09_executive",
            category="strategic_change",
            significance="medium",
            field="key_themes",
            old_value="cost_efficiency",
            new_value="digital_transformation",
            summary="Key theme changed from cost_efficiency to digital_transformation",
            algolia_relevance="Digital transformation focus indicates search investment priority",
            detected_at=datetime.utcnow() - timedelta(hours=1),
        ),
        ChangeEvent(
            id=uuid.uuid4(),
            snapshot_id=sample_snapshots[1].id,
            domain="costco.com",
            module_type="m02_tech_stack",
            category="tech_stack_change",
            significance="critical",
            field="current_search_provider",
            old_value="Elasticsearch",
            new_value=None,
            summary="Search provider removed: Elasticsearch",
            algolia_relevance="No current search provider = greenfield opportunity",
            detected_at=datetime.utcnow() - timedelta(hours=2),
        ),
    ]

    for change in changes:
        test_db.add(change)
    await test_db.commit()

    return changes


# =============================================================================
# Domain Change History Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_change_history_empty(client, sample_target):
    """Test getting change history with no changes."""
    response = await client.get("/api/v1/changes/costco.com")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    assert data["changes"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_change_history_with_data(client, sample_target, sample_changes):
    """Test getting change history with sample data."""
    response = await client.get("/api/v1/changes/costco.com")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    assert data["company_name"] == "Costco Wholesale Corporation"
    assert len(data["changes"]) == 3
    assert data["total"] == 3


@pytest.mark.asyncio
async def test_get_change_history_pagination(client, sample_target, sample_changes):
    """Test change history pagination."""
    response = await client.get("/api/v1/changes/costco.com?page=1&limit=2")
    assert response.status_code == 200

    data = response.json()
    assert len(data["changes"]) == 2
    assert data["total"] == 3
    assert data["total_pages"] == 2


@pytest.mark.asyncio
async def test_get_change_history_filter_by_category(client, sample_target, sample_changes):
    """Test filtering changes by category."""
    response = await client.get("/api/v1/changes/costco.com?category=executive_change")
    assert response.status_code == 200

    data = response.json()
    assert len(data["changes"]) == 1
    assert data["changes"][0]["category"] == "executive_change"


@pytest.mark.asyncio
async def test_get_change_history_filter_by_significance(client, sample_target, sample_changes):
    """Test filtering changes by significance."""
    response = await client.get("/api/v1/changes/costco.com?significance=critical")
    assert response.status_code == 200

    data = response.json()
    assert len(data["changes"]) == 1
    assert data["changes"][0]["significance"] == "critical"


@pytest.mark.asyncio
async def test_get_change_history_filter_by_date(client, sample_target, sample_changes):
    """Test filtering changes by date."""
    since = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    response = await client.get(f"/api/v1/changes/costco.com?since={since}")
    assert response.status_code == 200

    data = response.json()
    # Should only get changes from last hour
    assert len(data["changes"]) <= 2


@pytest.mark.asyncio
async def test_get_change_history_target_not_found(client):
    """Test 404 for non-existent target."""
    response = await client.get("/api/v1/changes/nonexistent.com")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_change_history_counts(client, sample_target, sample_changes):
    """Test that change history includes significance counts."""
    response = await client.get("/api/v1/changes/costco.com")
    assert response.status_code == 200

    data = response.json()
    assert "critical_count" in data
    assert "high_count" in data
    assert "medium_count" in data
    assert data["critical_count"] == 1
    assert data["high_count"] == 1
    assert data["medium_count"] == 1


# =============================================================================
# Significant Changes Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_significant_changes(client, sample_target, sample_changes):
    """Test getting significant (high/critical) changes."""
    response = await client.get("/api/v1/changes/costco.com/significant")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    # Only critical and high changes
    assert len(data["changes"]) == 2
    for change in data["changes"]:
        assert change["significance"] in ["critical", "high"]


@pytest.mark.asyncio
async def test_get_significant_changes_lookback(client, sample_target, sample_changes):
    """Test significant changes with custom lookback period."""
    response = await client.get("/api/v1/changes/costco.com/significant?days=7")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_significant_changes_includes_opportunities(client, sample_target, sample_changes):
    """Test that significant changes include Algolia opportunities."""
    response = await client.get("/api/v1/changes/costco.com/significant")
    assert response.status_code == 200

    data = response.json()
    assert "opportunities" in data
    assert "recommended_actions" in data


@pytest.mark.asyncio
async def test_get_significant_changes_target_not_found(client):
    """Test 404 for non-existent target."""
    response = await client.get("/api/v1/changes/nonexistent.com/significant")
    assert response.status_code == 404


# =============================================================================
# Recent Changes (Global) Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_recent_changes_empty(client):
    """Test getting recent changes with no data."""
    response = await client.get("/api/v1/changes/recent")
    assert response.status_code == 200

    data = response.json()
    assert data["changes"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_recent_changes_with_data(client, sample_target, sample_changes):
    """Test getting recent changes with sample data."""
    response = await client.get("/api/v1/changes/recent")
    assert response.status_code == 200

    data = response.json()
    assert len(data["changes"]) == 3
    assert data["domains_affected"] >= 1


@pytest.mark.asyncio
async def test_get_recent_changes_pagination(client, sample_target, sample_changes):
    """Test recent changes pagination."""
    response = await client.get("/api/v1/changes/recent?page=1&limit=2")
    assert response.status_code == 200

    data = response.json()
    assert len(data["changes"]) == 2
    assert data["total_pages"] >= 1


@pytest.mark.asyncio
async def test_get_recent_changes_filter_by_category(client, sample_target, sample_changes):
    """Test filtering recent changes by category."""
    response = await client.get("/api/v1/changes/recent?category=tech_stack_change")
    assert response.status_code == 200

    data = response.json()
    for item in data["changes"]:
        assert item["change"]["category"] == "tech_stack_change"


@pytest.mark.asyncio
async def test_get_recent_changes_min_significance(client, sample_target, sample_changes):
    """Test filtering recent changes by minimum significance."""
    response = await client.get("/api/v1/changes/recent?min_significance=high")
    assert response.status_code == 200

    data = response.json()
    for item in data["changes"]:
        assert item["change"]["significance"] in ["high", "critical"]


@pytest.mark.asyncio
async def test_get_recent_changes_custom_hours(client, sample_target, sample_changes):
    """Test recent changes with custom hours lookback."""
    response = await client.get("/api/v1/changes/recent?hours=48")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_recent_changes_includes_context(client, sample_target, sample_changes):
    """Test that recent changes include target context."""
    response = await client.get("/api/v1/changes/recent")
    assert response.status_code == 200

    data = response.json()
    if data["changes"]:
        item = data["changes"][0]
        assert "domain" in item
        assert "company_name" in item
        assert "icp_score" in item


@pytest.mark.asyncio
async def test_get_recent_changes_top_domains(client, sample_target, sample_changes):
    """Test that recent changes include top domains."""
    response = await client.get("/api/v1/changes/recent")
    assert response.status_code == 200

    data = response.json()
    assert "top_domains" in data


# =============================================================================
# Snapshot Comparison Tests
# =============================================================================

@pytest.mark.asyncio
async def test_compare_snapshots(client, sample_target, sample_snapshots):
    """Test comparing two snapshots."""
    response = await client.get(
        "/api/v1/changes/costco.com/compare?module_type=m09_executive"
    )
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    assert data["module_type"] == "m09_executive"
    assert data["version_old"] == 1
    assert data["version_new"] == 2


@pytest.mark.asyncio
async def test_compare_snapshots_specific_versions(client, sample_target, sample_snapshots):
    """Test comparing specific snapshot versions."""
    response = await client.get(
        "/api/v1/changes/costco.com/compare?module_type=m09_executive&version_old=1&version_new=2"
    )
    assert response.status_code == 200

    data = response.json()
    assert data["version_old"] == 1
    assert data["version_new"] == 2


@pytest.mark.asyncio
async def test_compare_snapshots_diff_structure(client, sample_target, sample_snapshots):
    """Test that comparison includes diff structure."""
    response = await client.get(
        "/api/v1/changes/costco.com/compare?module_type=m09_executive"
    )
    assert response.status_code == 200

    data = response.json()
    assert "diff" in data
    diff = data["diff"]
    assert "added" in diff
    assert "removed" in diff
    assert "changed" in diff
    assert "unchanged" in diff


@pytest.mark.asyncio
async def test_compare_snapshots_not_enough(client, sample_target):
    """Test 404 when not enough snapshots for comparison."""
    # Only one snapshot exists (need at least 2)
    snapshot = IntelSnapshot(
        id=uuid.uuid4(),
        domain="costco.com",
        module_type="m02_tech_stack",
        version=1,
        snapshot_type="auto",
        data={"tech": "test"},
        snapshot_at=datetime.utcnow(),
    )

    # Add directly to session through client fixture
    response = await client.get(
        "/api/v1/changes/costco.com/compare?module_type=m02_tech_stack"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_compare_snapshots_invalid_versions(client, sample_target, sample_snapshots):
    """Test 404 when specified versions don't exist."""
    response = await client.get(
        "/api/v1/changes/costco.com/compare?module_type=m09_executive&version_old=99&version_new=100"
    )
    assert response.status_code == 404


# =============================================================================
# Change Analytics Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_change_analytics(client, sample_target, sample_changes):
    """Test getting change analytics."""
    response = await client.get("/api/v1/changes/analytics")
    assert response.status_code == 200

    data = response.json()
    assert "total_changes" in data
    assert "domains_with_changes" in data
    assert "by_significance" in data
    assert "by_category" in data


@pytest.mark.asyncio
async def test_get_change_analytics_custom_period(client, sample_target, sample_changes):
    """Test analytics with custom period."""
    response = await client.get("/api/v1/changes/analytics?days=7")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_change_analytics_breakdowns(client, sample_target, sample_changes):
    """Test that analytics includes breakdowns."""
    response = await client.get("/api/v1/changes/analytics")
    assert response.status_code == 200

    data = response.json()
    assert "by_significance" in data
    assert "by_category" in data
    assert "by_module" in data


@pytest.mark.asyncio
async def test_get_change_analytics_top_domains(client, sample_target, sample_changes):
    """Test that analytics includes top domains."""
    response = await client.get("/api/v1/changes/analytics")
    assert response.status_code == 200

    data = response.json()
    assert "top_domains_by_changes" in data


@pytest.mark.asyncio
async def test_get_change_analytics_opportunity_count(client, sample_target, sample_changes):
    """Test that analytics includes high opportunity count."""
    response = await client.get("/api/v1/changes/analytics")
    assert response.status_code == 200

    data = response.json()
    assert "high_opportunity_changes" in data


# =============================================================================
# Response Format Tests
# =============================================================================

@pytest.mark.asyncio
async def test_change_event_response_fields(client, sample_target, sample_changes):
    """Test change event response includes required fields."""
    response = await client.get("/api/v1/changes/costco.com")
    assert response.status_code == 200

    change = response.json()["changes"][0]
    required_fields = [
        "id", "snapshot_id", "domain", "module_type", "category",
        "significance", "field", "summary", "detected_at"
    ]
    for field in required_fields:
        assert field in change, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_change_history_response_fields(client, sample_target, sample_changes):
    """Test change history response includes required fields."""
    response = await client.get("/api/v1/changes/costco.com")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "domain", "company_name", "changes", "total",
        "critical_count", "high_count", "medium_count", "low_count",
        "page", "limit", "total_pages"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_recent_changes_response_fields(client, sample_target, sample_changes):
    """Test recent changes response includes required fields."""
    response = await client.get("/api/v1/changes/recent")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "changes", "total", "domains_affected",
        "critical_count", "high_count", "by_category",
        "period_start", "period_end"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_analytics_response_fields(client, sample_target, sample_changes):
    """Test analytics response includes required fields."""
    response = await client.get("/api/v1/changes/analytics")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "period_start", "period_end", "total_changes",
        "domains_with_changes", "by_significance", "by_category"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"
