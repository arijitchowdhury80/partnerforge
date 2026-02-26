"""
Integration Tests for Targets API Endpoints

Tests target listing, filtering, search, and status updates.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime
from typing import AsyncGenerator
import json

# Import app and dependencies
from app.main import app
from app.database import Base, get_session
from app.api.deps import get_current_user, CurrentUser
from app.models import DisplacementTarget


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
def mock_admin_user():
    """Create a mock admin user."""
    return CurrentUser(
        user_id="admin-user-001",
        email="admin@partnerforge.local",
        name="Admin User",
        role="admin",
        team_id="test-team-001",
        is_active=True,
        is_admin=True,
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
async def admin_client(test_db, mock_admin_user):
    """Create a test client with admin user."""

    async def override_get_session():
        yield test_db

    async def override_get_user():
        return mock_admin_user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def sample_targets(test_db) -> list[DisplacementTarget]:
    """Create sample displacement targets for testing."""
    targets = [
        DisplacementTarget(
            domain="costco.com",
            company_name="Costco Wholesale Corporation",
            partner_tech="Adobe AEM",
            vertical="Retail",
            country="US",
            icp_score=85,
            icp_tier_name="hot",
            icp_tier=1,
            sw_monthly_visits=50000000,
            revenue=240000000000,
            current_search="Elasticsearch",
            is_public=True,
            ticker="COST",
            enrichment_level="full",
            last_enriched=datetime.utcnow(),
        ),
        DisplacementTarget(
            domain="target.com",
            company_name="Target Corporation",
            partner_tech="Adobe AEM",
            vertical="Retail",
            country="US",
            icp_score=70,
            icp_tier_name="warm",
            icp_tier=2,
            sw_monthly_visits=35000000,
            revenue=100000000000,
            current_search="Algolia",
            is_public=True,
            ticker="TGT",
            enrichment_level="standard",
        ),
        DisplacementTarget(
            domain="mercedes-benz.com",
            company_name="Mercedes-Benz Group AG",
            partner_tech="Adobe AEM",
            vertical="Automotive",
            country="DE",
            icp_score=95,
            icp_tier_name="hot",
            icp_tier=1,
            sw_monthly_visits=25000000,
            revenue=150000000000,
            current_search=None,
            is_public=True,
            ticker="MBG.DE",
            enrichment_level="basic",
        ),
        DisplacementTarget(
            domain="smallco.io",
            company_name="Small Company Inc",
            partner_tech="Shopify",
            vertical="Technology",
            country="US",
            icp_score=35,
            icp_tier_name="cold",
            icp_tier=4,
            sw_monthly_visits=10000,
            revenue=5000000,
            is_public=False,
            enrichment_level=None,
        ),
        DisplacementTarget(
            domain="unscored.com",
            company_name="Unscored Company",
            partner_tech="Adobe AEM",
            vertical="Finance",
            country="UK",
            icp_score=None,
            icp_tier_name=None,
            sw_monthly_visits=1000000,
        ),
    ]

    for target in targets:
        test_db.add(target)
    await test_db.commit()

    # Refresh to get IDs
    for target in targets:
        await test_db.refresh(target)

    return targets


# =============================================================================
# List Targets Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_targets_empty(client):
    """Test listing targets when none exist."""
    response = await client.get("/api/v1/targets")
    assert response.status_code == 200

    data = response.json()
    assert data["targets"] == []
    assert data["pagination"]["total"] == 0


@pytest.mark.asyncio
async def test_list_targets_with_data(client, sample_targets):
    """Test listing targets with sample data."""
    response = await client.get("/api/v1/targets")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 5
    assert data["pagination"]["total"] == 5


@pytest.mark.asyncio
async def test_list_targets_pagination(client, sample_targets):
    """Test target pagination."""
    # First page
    response = await client.get("/api/v1/targets?page=1&page_size=2")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 2
    assert data["pagination"]["total"] == 5
    assert data["pagination"]["total_pages"] == 3
    assert data["pagination"]["page"] == 1

    # Second page
    response2 = await client.get("/api/v1/targets?page=2&page_size=2")
    data2 = response2.json()
    assert len(data2["targets"]) == 2
    assert data2["pagination"]["page"] == 2


@pytest.mark.asyncio
async def test_list_targets_filter_by_status_hot(client, sample_targets):
    """Test filtering targets by hot status."""
    response = await client.get("/api/v1/targets?status=hot")
    assert response.status_code == 200

    data = response.json()
    # costco (85) and mercedes (95) are hot
    assert len(data["targets"]) == 2
    for target in data["targets"]:
        assert target["icp_score"] >= 80


@pytest.mark.asyncio
async def test_list_targets_filter_by_status_warm(client, sample_targets):
    """Test filtering targets by warm status."""
    response = await client.get("/api/v1/targets?status=warm")
    assert response.status_code == 200

    data = response.json()
    # target (70) is warm
    assert len(data["targets"]) == 1
    assert data["targets"][0]["domain"] == "target.com"


@pytest.mark.asyncio
async def test_list_targets_filter_by_status_unscored(client, sample_targets):
    """Test filtering targets by unscored status."""
    response = await client.get("/api/v1/targets?status=unscored")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 1
    assert data["targets"][0]["domain"] == "unscored.com"


@pytest.mark.asyncio
async def test_list_targets_filter_by_vertical(client, sample_targets):
    """Test filtering targets by vertical."""
    response = await client.get("/api/v1/targets?vertical=Retail")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 2
    for target in data["targets"]:
        assert "Retail" in target["vertical"]


@pytest.mark.asyncio
async def test_list_targets_filter_by_partner_tech(client, sample_targets):
    """Test filtering targets by partner technology."""
    response = await client.get("/api/v1/targets?partner_tech=Adobe")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 4
    for target in data["targets"]:
        assert "Adobe" in target["partner_tech"]


@pytest.mark.asyncio
async def test_list_targets_filter_by_country(client, sample_targets):
    """Test filtering targets by country."""
    response = await client.get("/api/v1/targets?country=DE")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 1
    assert data["targets"][0]["domain"] == "mercedes-benz.com"


@pytest.mark.asyncio
async def test_list_targets_filter_by_min_score(client, sample_targets):
    """Test filtering targets by minimum ICP score."""
    response = await client.get("/api/v1/targets?min_score=70")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 3
    for target in data["targets"]:
        assert target["icp_score"] >= 70


@pytest.mark.asyncio
async def test_list_targets_filter_by_score_range(client, sample_targets):
    """Test filtering targets by ICP score range."""
    response = await client.get("/api/v1/targets?min_score=60&max_score=90")
    assert response.status_code == 200

    data = response.json()
    for target in data["targets"]:
        assert 60 <= target["icp_score"] <= 90


@pytest.mark.asyncio
async def test_list_targets_filter_by_is_public(client, sample_targets):
    """Test filtering by public companies."""
    response = await client.get("/api/v1/targets?is_public=true")
    assert response.status_code == 200

    data = response.json()
    # costco, target, mercedes are public
    assert len(data["targets"]) == 3


@pytest.mark.asyncio
async def test_list_targets_filter_by_min_traffic(client, sample_targets):
    """Test filtering by minimum traffic."""
    response = await client.get("/api/v1/targets?min_traffic=10000000")
    assert response.status_code == 200

    data = response.json()
    for target in data["targets"]:
        assert target["sw_monthly_visits"] >= 10000000


@pytest.mark.asyncio
async def test_list_targets_filter_by_enrichment_level(client, sample_targets):
    """Test filtering by enrichment level."""
    response = await client.get("/api/v1/targets?enrichment_level=full")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 1
    assert data["targets"][0]["domain"] == "costco.com"


@pytest.mark.asyncio
async def test_list_targets_search_by_domain(client, sample_targets):
    """Test searching targets by domain."""
    response = await client.get("/api/v1/targets?search=costco")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 1
    assert data["targets"][0]["domain"] == "costco.com"


@pytest.mark.asyncio
async def test_list_targets_search_by_company_name(client, sample_targets):
    """Test searching targets by company name."""
    response = await client.get("/api/v1/targets?search=Mercedes")
    assert response.status_code == 200

    data = response.json()
    assert len(data["targets"]) == 1
    assert "Mercedes" in data["targets"][0]["company_name"]


@pytest.mark.asyncio
async def test_list_targets_sort_by_icp_score_desc(client, sample_targets):
    """Test sorting targets by ICP score descending."""
    response = await client.get("/api/v1/targets?sort_by=icp_score&sort_order=desc")
    assert response.status_code == 200

    data = response.json()
    scores = [t["icp_score"] for t in data["targets"] if t["icp_score"] is not None]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.asyncio
async def test_list_targets_sort_by_company_name(client, sample_targets):
    """Test sorting targets by company name."""
    response = await client.get("/api/v1/targets?sort_by=company_name&sort_order=asc")
    assert response.status_code == 200

    data = response.json()
    names = [t["company_name"] for t in data["targets"]]
    assert names == sorted(names)


@pytest.mark.asyncio
async def test_list_targets_combined_filters(client, sample_targets):
    """Test combining multiple filters."""
    response = await client.get(
        "/api/v1/targets?vertical=Retail&min_score=70&is_public=true"
    )
    assert response.status_code == 200

    data = response.json()
    for target in data["targets"]:
        assert "Retail" in target["vertical"]
        assert target["icp_score"] >= 70


# =============================================================================
# Get Target Details Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_target_success(client, sample_targets):
    """Test getting a single target by domain."""
    response = await client.get("/api/v1/targets/costco.com")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    assert data["company_name"] == "Costco Wholesale Corporation"
    assert data["icp_score"] == 85
    assert data["ticker"] == "COST"
    assert data["is_public"] is True


@pytest.mark.asyncio
async def test_get_target_with_url_prefix(client, sample_targets):
    """Test getting target with URL prefixes (should be normalized)."""
    response = await client.get("/api/v1/targets/https://www.costco.com/")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"


@pytest.mark.asyncio
async def test_get_target_not_found(client, sample_targets):
    """Test 404 for non-existent target."""
    response = await client.get("/api/v1/targets/nonexistent.com")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# =============================================================================
# Target Stats Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_target_stats(client, sample_targets):
    """Test getting target statistics."""
    response = await client.get("/api/v1/targets/stats")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 5
    assert "by_status" in data
    assert data["by_status"]["hot"] == 2  # costco, mercedes
    assert data["by_status"]["warm"] == 1  # target
    assert data["by_status"]["cold"] == 1  # smallco
    assert data["by_status"]["unscored"] == 1  # unscored.com


@pytest.mark.asyncio
async def test_get_target_stats_vertical_breakdown(client, sample_targets):
    """Test vertical breakdown in stats."""
    response = await client.get("/api/v1/targets/stats")
    assert response.status_code == 200

    data = response.json()
    assert "by_vertical" in data
    assert len(data["by_vertical"]) > 0

    # Check Retail vertical
    retail_stats = next(
        (v for v in data["by_vertical"] if v["vertical"] == "Retail"),
        None
    )
    assert retail_stats is not None
    assert retail_stats["count"] == 2


@pytest.mark.asyncio
async def test_get_target_stats_partner_tech_breakdown(client, sample_targets):
    """Test partner tech breakdown in stats."""
    response = await client.get("/api/v1/targets/stats")
    assert response.status_code == 200

    data = response.json()
    assert "by_partner_tech" in data

    # Check Adobe AEM
    aem_stats = next(
        (p for p in data["by_partner_tech"] if p["partner_tech"] == "Adobe AEM"),
        None
    )
    assert aem_stats is not None
    assert aem_stats["count"] == 4


@pytest.mark.asyncio
async def test_get_target_stats_enrichment_counts(client, sample_targets):
    """Test enrichment counts in stats."""
    response = await client.get("/api/v1/targets/stats")
    assert response.status_code == 200

    data = response.json()
    assert "enriched_count" in data
    assert "public_count" in data
    # costco, target, mercedes have enrichment levels set
    assert data["enriched_count"] == 3
    assert data["public_count"] == 3


# =============================================================================
# Search Targets Tests
# =============================================================================

@pytest.mark.asyncio
async def test_search_targets_found(client, sample_targets):
    """Test searching targets by domain list."""
    response = await client.post(
        "/api/v1/targets/search",
        json={"domains": ["costco.com", "target.com", "unknown.com"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["total_searched"] == 3
    assert data["total_found"] == 2
    assert len(data["found"]) == 2
    assert len(data["not_found"]) == 1
    assert "unknown.com" in data["not_found"]


@pytest.mark.asyncio
async def test_search_targets_all_found(client, sample_targets):
    """Test searching when all domains are found."""
    response = await client.post(
        "/api/v1/targets/search",
        json={"domains": ["costco.com", "target.com"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["total_found"] == 2
    assert len(data["not_found"]) == 0


@pytest.mark.asyncio
async def test_search_targets_none_found(client, sample_targets):
    """Test searching when no domains are found."""
    response = await client.post(
        "/api/v1/targets/search",
        json={"domains": ["unknown1.com", "unknown2.com"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["total_found"] == 0
    assert len(data["not_found"]) == 2


@pytest.mark.asyncio
async def test_search_targets_normalizes_domains(client, sample_targets):
    """Test that search normalizes domain formats."""
    response = await client.post(
        "/api/v1/targets/search",
        json={"domains": ["https://www.costco.com/", "HTTP://TARGET.COM"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["total_found"] == 2


# =============================================================================
# Update Target Status Tests
# =============================================================================

@pytest.mark.asyncio
async def test_update_target_status_icp_score(client, sample_targets):
    """Test updating target ICP score."""
    response = await client.put(
        "/api/v1/targets/costco.com/status",
        json={"icp_score": 90}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["icp_score"] == 90
    assert data["icp_tier_name"] == "hot"
    assert "updated" in data["message"].lower()


@pytest.mark.asyncio
async def test_update_target_status_auto_tier(client, sample_targets):
    """Test that tier is auto-computed from score."""
    # Update to warm range
    response = await client.put(
        "/api/v1/targets/costco.com/status",
        json={"icp_score": 65}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["icp_score"] == 65
    assert data["icp_tier_name"] == "warm"
    assert data["status"] == "warm"


@pytest.mark.asyncio
async def test_update_target_status_tier_override(client, sample_targets):
    """Test overriding tier name."""
    response = await client.put(
        "/api/v1/targets/costco.com/status",
        json={"icp_tier_name": "warm"}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["icp_tier_name"] == "warm"


@pytest.mark.asyncio
async def test_update_target_status_score_reasons(client, sample_targets):
    """Test updating score reasons."""
    response = await client.put(
        "/api/v1/targets/costco.com/status",
        json={"score_reasons": ["High traffic", "Public company", "Retail vertical"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert "reasons updated" in data["message"].lower()


@pytest.mark.asyncio
async def test_update_target_status_not_found(client, sample_targets):
    """Test 404 when updating non-existent target."""
    response = await client.put(
        "/api/v1/targets/nonexistent.com/status",
        json={"icp_score": 50}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_target_status_no_changes(client, sample_targets):
    """Test update with no changes."""
    response = await client.put(
        "/api/v1/targets/costco.com/status",
        json={}
    )
    assert response.status_code == 200

    data = response.json()
    assert "no changes" in data["message"].lower()


# =============================================================================
# Edge Cases and Error Handling Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_targets_invalid_status(client, sample_targets):
    """Test invalid status filter value."""
    response = await client.get("/api/v1/targets?status=invalid")
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_list_targets_invalid_sort_field(client, sample_targets):
    """Test invalid sort field."""
    response = await client.get("/api/v1/targets?sort_by=invalid_field")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_targets_invalid_page_number(client, sample_targets):
    """Test invalid page number."""
    response = await client.get("/api/v1/targets?page=0")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_targets_page_size_exceeds_max(client, sample_targets):
    """Test page size exceeds maximum."""
    response = await client.get("/api/v1/targets?page_size=500")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_targets_empty_list(client, sample_targets):
    """Test search with empty domain list."""
    response = await client.post(
        "/api/v1/targets/search",
        json={"domains": []}
    )
    # Should either return empty results or validation error
    assert response.status_code in (200, 422)


# =============================================================================
# Response Format Tests
# =============================================================================

@pytest.mark.asyncio
async def test_target_summary_fields(client, sample_targets):
    """Test that target summary includes required fields."""
    response = await client.get("/api/v1/targets")
    assert response.status_code == 200

    target = response.json()["targets"][0]
    required_fields = [
        "id", "domain", "company_name", "partner_tech", "vertical",
        "country", "icp_score", "icp_tier_name"
    ]
    for field in required_fields:
        assert field in target, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_target_detail_fields(client, sample_targets):
    """Test that target detail includes all fields."""
    response = await client.get("/api/v1/targets/costco.com")
    assert response.status_code == 200

    target = response.json()
    detail_fields = [
        "id", "domain", "company_name", "partner_tech", "vertical",
        "country", "city", "state", "tech_spend", "sw_monthly_visits",
        "icp_score", "icp_tier_name", "ticker", "is_public", "revenue",
        "current_search", "enrichment_level", "last_enriched", "created_at"
    ]
    for field in detail_fields:
        assert field in target, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_pagination_meta_fields(client, sample_targets):
    """Test that pagination metadata includes required fields."""
    response = await client.get("/api/v1/targets")
    assert response.status_code == 200

    pagination = response.json()["pagination"]
    required_fields = ["page", "page_size", "total", "total_pages", "has_next", "has_prev"]
    for field in required_fields:
        assert field in pagination, f"Missing pagination field: {field}"
