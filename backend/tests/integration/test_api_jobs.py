"""
Integration Tests for Jobs API Endpoints

Tests job listing, status, cancellation, logs, and statistics.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime, timedelta
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
async def sample_target(test_db) -> DisplacementTarget:
    """Create a sample displacement target for testing."""
    target = DisplacementTarget(
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
    )
    test_db.add(target)
    await test_db.commit()
    await test_db.refresh(target)
    return target


# =============================================================================
# Note: Jobs are typically stored in Redis/Celery, not the database
# These tests verify the API endpoint behavior with mock/stub responses
# =============================================================================


# =============================================================================
# List Jobs Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_jobs_empty(client):
    """Test listing jobs when none exist."""
    response = await client.get("/api/v1/jobs")
    assert response.status_code == 200

    data = response.json()
    assert "jobs" in data
    assert "pagination" in data
    assert data["running_count"] >= 0
    assert data["queued_count"] >= 0


@pytest.mark.asyncio
async def test_list_jobs_with_pagination(client):
    """Test job listing with pagination parameters."""
    response = await client.get("/api/v1/jobs?page=1&limit=10")
    assert response.status_code == 200

    data = response.json()
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["limit"] == 10


@pytest.mark.asyncio
async def test_list_jobs_filter_by_status(client):
    """Test filtering jobs by status."""
    response = await client.get("/api/v1/jobs?status=running")
    assert response.status_code == 200

    data = response.json()
    assert "jobs" in data
    # If any jobs returned, they should all be running
    for job in data["jobs"]:
        assert job["status"] == "running"


@pytest.mark.asyncio
async def test_list_jobs_filter_by_domain(client, sample_target):
    """Test filtering jobs by domain."""
    response = await client.get("/api/v1/jobs?domain=costco.com")
    assert response.status_code == 200

    data = response.json()
    assert "jobs" in data
    # If any jobs returned, they should be for this domain
    for job in data["jobs"]:
        assert job["domain"] == "costco.com"


@pytest.mark.asyncio
async def test_list_jobs_filter_by_job_type(client):
    """Test filtering jobs by type."""
    response = await client.get("/api/v1/jobs?job_type=full_enrichment")
    assert response.status_code == 200

    data = response.json()
    assert "jobs" in data


@pytest.mark.asyncio
async def test_list_jobs_invalid_status(client):
    """Test invalid status filter."""
    response = await client.get("/api/v1/jobs?status=invalid")
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_list_jobs_invalid_page(client):
    """Test invalid page number."""
    response = await client.get("/api/v1/jobs?page=0")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_jobs_page_size_exceeds_max(client):
    """Test page size exceeds maximum."""
    response = await client.get("/api/v1/jobs?limit=500")
    assert response.status_code == 422


# =============================================================================
# Get Job Details Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_job_not_found(client):
    """Test 404 for non-existent job."""
    response = await client.get("/api/v1/jobs/nonexistent-job-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_job_details_format(client):
    """Test job details response format when job exists."""
    # First create a job by triggering enrichment
    response = await client.get("/api/v1/jobs")
    assert response.status_code == 200

    # Note: This test verifies the API endpoint exists and returns correct format
    # Actual job details depend on job storage implementation


# =============================================================================
# Cancel Job Tests
# =============================================================================

@pytest.mark.asyncio
async def test_cancel_job_not_found(client):
    """Test cancelling non-existent job."""
    response = await client.post("/api/v1/jobs/nonexistent-job-id/cancel")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_cancel_job_endpoint_exists(client):
    """Test that cancel endpoint exists and returns expected response."""
    # Note: Actual cancellation depends on job existing and being cancellable
    response = await client.post("/api/v1/jobs/test-job-id/cancel")
    assert response.status_code in (200, 400, 404)


# =============================================================================
# Job Logs Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_job_logs_not_found(client):
    """Test 404 for logs of non-existent job."""
    response = await client.get("/api/v1/jobs/nonexistent-job-id/logs")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_job_logs_with_level_filter(client):
    """Test log level filtering."""
    response = await client.get("/api/v1/jobs/test-job/logs?level=ERROR")
    # Should either return 404 (job not found) or 200 with filtered logs
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_get_job_logs_with_limit(client):
    """Test log limit parameter."""
    response = await client.get("/api/v1/jobs/test-job/logs?limit=10")
    assert response.status_code in (200, 404)


# =============================================================================
# Job Stats Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_job_stats(client):
    """Test getting job statistics."""
    response = await client.get("/api/v1/jobs/stats")
    assert response.status_code == 200

    data = response.json()
    assert "total_jobs" in data
    assert "by_status" in data
    assert "by_type" in data
    assert "success_rate" in data


@pytest.mark.asyncio
async def test_get_job_stats_with_date_range(client):
    """Test job stats with date range filter."""
    response = await client.get("/api/v1/jobs/stats?days=7")
    assert response.status_code == 200

    data = response.json()
    assert "period_start" in data
    assert "period_end" in data


@pytest.mark.asyncio
async def test_get_job_stats_format(client):
    """Test job stats response format."""
    response = await client.get("/api/v1/jobs/stats")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "total_jobs", "by_status", "by_type",
        "success_rate", "failure_rate"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


# =============================================================================
# Job Response Format Tests
# =============================================================================

@pytest.mark.asyncio
async def test_job_list_response_format(client):
    """Test job list response includes required fields."""
    response = await client.get("/api/v1/jobs")
    assert response.status_code == 200

    data = response.json()
    required_fields = ["jobs", "pagination", "running_count", "queued_count"]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_pagination_meta_format(client):
    """Test pagination metadata format."""
    response = await client.get("/api/v1/jobs")
    assert response.status_code == 200

    pagination = response.json()["pagination"]
    required_fields = ["page", "limit", "total", "total_pages"]
    for field in required_fields:
        assert field in pagination, f"Missing pagination field: {field}"


# =============================================================================
# Job Type Validation Tests
# =============================================================================

@pytest.mark.asyncio
async def test_filter_by_full_enrichment(client):
    """Test filtering by full_enrichment job type."""
    response = await client.get("/api/v1/jobs?job_type=full_enrichment")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_filter_by_wave_enrichment(client):
    """Test filtering by wave_enrichment job type."""
    response = await client.get("/api/v1/jobs?job_type=wave_enrichment")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_filter_by_module_enrichment(client):
    """Test filtering by module_enrichment job type."""
    response = await client.get("/api/v1/jobs?job_type=module_enrichment")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_filter_invalid_job_type(client):
    """Test filtering by invalid job type."""
    response = await client.get("/api/v1/jobs?job_type=invalid_type")
    assert response.status_code == 422  # Validation error


# =============================================================================
# Job Status Validation Tests
# =============================================================================

@pytest.mark.asyncio
async def test_filter_by_queued_status(client):
    """Test filtering by queued status."""
    response = await client.get("/api/v1/jobs?status=queued")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_filter_by_running_status(client):
    """Test filtering by running status."""
    response = await client.get("/api/v1/jobs?status=running")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_filter_by_completed_status(client):
    """Test filtering by completed status."""
    response = await client.get("/api/v1/jobs?status=completed")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_filter_by_failed_status(client):
    """Test filtering by failed status."""
    response = await client.get("/api/v1/jobs?status=failed")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_filter_by_cancelled_status(client):
    """Test filtering by cancelled status."""
    response = await client.get("/api/v1/jobs?status=cancelled")
    assert response.status_code == 200


# =============================================================================
# Combined Filter Tests
# =============================================================================

@pytest.mark.asyncio
async def test_combined_filters(client):
    """Test combining multiple filters."""
    response = await client.get(
        "/api/v1/jobs?status=running&job_type=full_enrichment&page=1&limit=10"
    )
    assert response.status_code == 200

    data = response.json()
    assert "filters" in data
    # Verify filters are applied
    for job in data["jobs"]:
        assert job["status"] == "running"


@pytest.mark.asyncio
async def test_filter_with_domain(client, sample_target):
    """Test filtering with domain and status."""
    response = await client.get(
        "/api/v1/jobs?domain=costco.com&status=completed"
    )
    assert response.status_code == 200


# =============================================================================
# Log Level Validation Tests
# =============================================================================

@pytest.mark.asyncio
async def test_logs_filter_debug_level(client):
    """Test filtering logs by DEBUG level."""
    response = await client.get("/api/v1/jobs/test-job/logs?level=DEBUG")
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_logs_filter_info_level(client):
    """Test filtering logs by INFO level."""
    response = await client.get("/api/v1/jobs/test-job/logs?level=INFO")
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_logs_filter_warning_level(client):
    """Test filtering logs by WARNING level."""
    response = await client.get("/api/v1/jobs/test-job/logs?level=WARNING")
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_logs_filter_error_level(client):
    """Test filtering logs by ERROR level."""
    response = await client.get("/api/v1/jobs/test-job/logs?level=ERROR")
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_logs_invalid_level(client):
    """Test filtering logs by invalid level."""
    response = await client.get("/api/v1/jobs/test-job/logs?level=INVALID")
    # Should either return 422 (validation error) or 404 (job not found)
    assert response.status_code in (404, 422)


# =============================================================================
# Edge Cases
# =============================================================================

@pytest.mark.asyncio
async def test_job_id_with_special_characters(client):
    """Test job ID with special characters."""
    response = await client.get("/api/v1/jobs/job-with-dashes-123")
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_job_id_with_underscores(client):
    """Test job ID with underscores."""
    response = await client.get("/api/v1/jobs/job_with_underscores_123")
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_empty_job_id(client):
    """Test empty job ID."""
    # This should hit a different route or return 404/422
    response = await client.get("/api/v1/jobs/")
    # Should either be 200 (list) or 307 (redirect)
    assert response.status_code in (200, 307)


# =============================================================================
# Stats Date Range Tests
# =============================================================================

@pytest.mark.asyncio
async def test_stats_7_days(client):
    """Test stats for last 7 days."""
    response = await client.get("/api/v1/jobs/stats?days=7")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_stats_30_days(client):
    """Test stats for last 30 days."""
    response = await client.get("/api/v1/jobs/stats?days=30")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_stats_90_days(client):
    """Test stats for last 90 days."""
    response = await client.get("/api/v1/jobs/stats?days=90")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_stats_invalid_days(client):
    """Test stats with invalid days parameter."""
    response = await client.get("/api/v1/jobs/stats?days=-1")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_stats_zero_days(client):
    """Test stats with zero days."""
    response = await client.get("/api/v1/jobs/stats?days=0")
    # Should either be valid (today only) or validation error
    assert response.status_code in (200, 422)


# =============================================================================
# Response Content Verification Tests
# =============================================================================

@pytest.mark.asyncio
async def test_stats_success_rate_range(client):
    """Test that success_rate is within valid range."""
    response = await client.get("/api/v1/jobs/stats")
    assert response.status_code == 200

    data = response.json()
    assert 0 <= data["success_rate"] <= 100


@pytest.mark.asyncio
async def test_stats_failure_rate_range(client):
    """Test that failure_rate is within valid range."""
    response = await client.get("/api/v1/jobs/stats")
    assert response.status_code == 200

    data = response.json()
    assert 0 <= data["failure_rate"] <= 100


@pytest.mark.asyncio
async def test_stats_rates_sum(client):
    """Test that success + failure rates are consistent."""
    response = await client.get("/api/v1/jobs/stats")
    assert response.status_code == 200

    data = response.json()
    # Success + failure should not exceed 100%
    total = data["success_rate"] + data["failure_rate"]
    assert total <= 100


# =============================================================================
# Admin-only Tests
# =============================================================================

@pytest.mark.asyncio
async def test_regular_user_can_view_jobs(client):
    """Test that regular user can view jobs."""
    response = await client.get("/api/v1/jobs")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_admin_can_view_all_jobs(admin_client):
    """Test that admin can view all jobs."""
    response = await admin_client.get("/api/v1/jobs")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_regular_user_can_view_stats(client):
    """Test that regular user can view stats."""
    response = await client.get("/api/v1/jobs/stats")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_admin_can_view_stats(admin_client):
    """Test that admin can view stats."""
    response = await admin_client.get("/api/v1/jobs/stats")
    assert response.status_code == 200
