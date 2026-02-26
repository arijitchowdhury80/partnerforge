"""
Integration Tests for Enrichment API Endpoints

Tests domain enrichment, batch enrichment, job status, and caching.
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


# =============================================================================
# Start Enrichment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_start_enrichment_success(client):
    """Test starting enrichment for a domain."""
    response = await client.post("/api/v1/enrich/costco.com")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    assert data["status"] == "queued"
    assert "job_id" in data
    assert len(data["modules"]) > 0
    assert "estimated_time_seconds" in data


@pytest.mark.asyncio
async def test_start_enrichment_with_specific_modules(client):
    """Test starting enrichment with specific modules."""
    response = await client.post(
        "/api/v1/enrich/costco.com",
        json={"modules": ["m01_company_context", "m02_tech_stack"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["modules"]) == 2
    assert "m01_company_context" in data["modules"]
    assert "m02_tech_stack" in data["modules"]


@pytest.mark.asyncio
async def test_start_enrichment_with_waves(client):
    """Test starting enrichment with specific waves."""
    response = await client.post(
        "/api/v1/enrich/costco.com",
        json={"waves": [1, 2]}
    )
    assert response.status_code == 200

    data = response.json()
    assert 1 in data["waves"]
    assert 2 in data["waves"]
    # Wave 1 + 2 modules
    assert len(data["modules"]) == 7


@pytest.mark.asyncio
async def test_start_enrichment_force_bypass_cache(client):
    """Test starting enrichment with force flag."""
    response = await client.post(
        "/api/v1/enrich/costco.com",
        json={"force": True}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["force"] is True


@pytest.mark.asyncio
async def test_start_enrichment_with_priority(client):
    """Test starting enrichment with different priorities."""
    response = await client.post(
        "/api/v1/enrich/costco.com",
        json={"priority": "high"}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_start_enrichment_normalizes_domain(client):
    """Test that domain is normalized."""
    response = await client.post("/api/v1/enrich/https://www.COSTCO.COM/")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"


@pytest.mark.asyncio
async def test_start_enrichment_invalid_domain(client):
    """Test starting enrichment with invalid domain."""
    response = await client.post("/api/v1/enrich/notadomain")
    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


# =============================================================================
# Enrichment Status Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_enrichment_status(client):
    """Test getting enrichment status."""
    # First start enrichment
    start_response = await client.post("/api/v1/enrich/costco.com")
    job_id = start_response.json()["job_id"]

    # Get status
    response = await client.get(f"/api/v1/enrich/costco.com/status?job_id={job_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["job_id"] == job_id
    assert data["domain"] == "costco.com"
    assert "status" in data
    assert "progress_percent" in data
    assert "modules_total" in data


@pytest.mark.asyncio
async def test_get_enrichment_status_latest(client):
    """Test getting status of latest job when job_id not specified."""
    # Start enrichment
    await client.post("/api/v1/enrich/costco.com")

    # Get status without job_id
    response = await client.get("/api/v1/enrich/costco.com/status")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"


@pytest.mark.asyncio
async def test_get_enrichment_status_job_not_found(client):
    """Test 404 when job not found."""
    response = await client.get("/api/v1/enrich/costco.com/status?job_id=nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_enrichment_status_no_jobs(client):
    """Test 404 when no jobs exist for domain."""
    response = await client.get("/api/v1/enrich/newdomain.com/status")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_enrichment_status_wave_details(client):
    """Test that status includes wave details."""
    # Start enrichment
    start_response = await client.post("/api/v1/enrich/costco.com")
    job_id = start_response.json()["job_id"]

    # Get status
    response = await client.get(f"/api/v1/enrich/costco.com/status?job_id={job_id}")
    assert response.status_code == 200

    data = response.json()
    assert "waves" in data
    assert len(data["waves"]) > 0

    wave = data["waves"][0]
    assert "wave_number" in wave
    assert "status" in wave
    assert "modules" in wave


# =============================================================================
# Enrichment Results Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_enrichment_results_no_completed_jobs(client):
    """Test getting results when no completed jobs."""
    # Start but don't complete enrichment
    await client.post("/api/v1/enrich/costco.com")

    response = await client.get("/api/v1/enrich/costco.com/results")
    # Should return 404 since no completed jobs
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_enrichment_results_with_module_filter(client):
    """Test getting results with module filter."""
    # Start enrichment
    await client.post("/api/v1/enrich/costco.com")

    response = await client.get(
        "/api/v1/enrich/costco.com/results?modules=m01_company_context,m02_tech_stack"
    )
    # Should return 404 since no completed jobs (but validates filter format)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_enrichment_results_invalid_module(client):
    """Test getting results with invalid module filter."""
    response = await client.get(
        "/api/v1/enrich/costco.com/results?modules=invalid_module"
    )
    assert response.status_code in (400, 404)


# =============================================================================
# Batch Enrichment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_batch_enrichment_success(client):
    """Test batch enrichment for multiple domains."""
    response = await client.post(
        "/api/v1/enrich/batch",
        json={"domains": ["costco.com", "target.com", "walmart.com"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["total_domains"] == 3
    assert data["queued_count"] == 3
    assert data["skipped_count"] == 0
    assert len(data["jobs"]) == 3
    assert "batch_id" in data


@pytest.mark.asyncio
async def test_batch_enrichment_with_options(client):
    """Test batch enrichment with options."""
    response = await client.post(
        "/api/v1/enrich/batch",
        json={
            "domains": ["costco.com", "target.com"],
            "modules": ["m01_company_context"],
            "priority": "high",
            "force": True,
            "concurrency": 5
        }
    )
    assert response.status_code == 200

    data = response.json()
    for job in data["jobs"]:
        assert len(job["modules"]) == 1
        assert job["priority"] == "high"
        assert job["force"] is True


@pytest.mark.asyncio
async def test_batch_enrichment_skips_invalid_domains(client):
    """Test that batch enrichment skips invalid domains."""
    response = await client.post(
        "/api/v1/enrich/batch",
        json={"domains": ["costco.com", "notadomain", "target.com"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["total_domains"] == 3
    assert data["queued_count"] == 2
    assert data["skipped_count"] == 1


@pytest.mark.asyncio
async def test_batch_enrichment_empty_domains(client):
    """Test batch enrichment with empty domain list."""
    response = await client.post(
        "/api/v1/enrich/batch",
        json={"domains": []}
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_batch_enrichment_estimates_time(client):
    """Test that batch enrichment includes time estimate."""
    response = await client.post(
        "/api/v1/enrich/batch",
        json={"domains": ["costco.com", "target.com"]}
    )
    assert response.status_code == 200

    data = response.json()
    assert "estimated_time_seconds" in data
    assert data["estimated_time_seconds"] > 0


# =============================================================================
# Cancel Enrichment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_cancel_enrichment_success(client):
    """Test cancelling an enrichment job."""
    # Start enrichment
    start_response = await client.post("/api/v1/enrich/costco.com")
    job_id = start_response.json()["job_id"]

    # Cancel
    response = await client.post(f"/api/v1/enrich/costco.com/cancel?job_id={job_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "cancelled"
    assert "job_id" in data


@pytest.mark.asyncio
async def test_cancel_enrichment_latest(client):
    """Test cancelling latest running job."""
    # Start enrichment
    await client.post("/api/v1/enrich/costco.com")

    # Cancel without job_id
    response = await client.post("/api/v1/enrich/costco.com/cancel")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_enrichment_not_found(client):
    """Test cancelling non-existent job."""
    response = await client.post("/api/v1/enrich/costco.com/cancel?job_id=nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_cancel_enrichment_no_running_jobs(client):
    """Test cancelling when no running jobs."""
    response = await client.post("/api/v1/enrich/newdomain.com/cancel")
    assert response.status_code == 404


# =============================================================================
# Retry Enrichment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_retry_enrichment_no_failed_jobs(client):
    """Test retrying when no failed jobs exist."""
    response = await client.post("/api/v1/enrich/costco.com/retry")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_retry_enrichment_options(client):
    """Test retry with options."""
    response = await client.post(
        "/api/v1/enrich/costco.com/retry",
        json={"failed_modules_only": False}
    )
    # Should return 404 since no failed jobs
    assert response.status_code == 404


# =============================================================================
# Cache Status Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_cache_status_no_cache(client):
    """Test cache status when no cached data."""
    response = await client.get("/api/v1/enrich/newdomain.com/cache")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "newdomain.com"
    assert data["overall_freshness"] == "expired"
    assert len(data["stale_modules"]) > 0


@pytest.mark.asyncio
async def test_get_cache_status_module_details(client):
    """Test that cache status includes module details."""
    response = await client.get("/api/v1/enrich/costco.com/cache")
    assert response.status_code == 200

    data = response.json()
    assert "modules" in data
    assert len(data["modules"]) > 0

    module = data["modules"][0]
    assert "module_id" in module
    assert "is_cached" in module
    assert "freshness" in module


@pytest.mark.asyncio
async def test_get_cache_status_freshness_values(client):
    """Test that freshness values are valid."""
    response = await client.get("/api/v1/enrich/costco.com/cache")
    assert response.status_code == 200

    data = response.json()
    valid_freshness = ["fresh", "stale", "expired"]
    assert data["overall_freshness"] in valid_freshness

    for module in data["modules"]:
        assert module["freshness"] in valid_freshness


# =============================================================================
# List Enrichment Jobs Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_enrichment_jobs_empty(client):
    """Test listing jobs when none exist."""
    response = await client.get("/api/v1/enrich")
    assert response.status_code == 200

    data = response.json()
    assert data["jobs"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_enrichment_jobs_with_data(client):
    """Test listing jobs after creating some."""
    # Create jobs
    await client.post("/api/v1/enrich/costco.com")
    await client.post("/api/v1/enrich/target.com")

    # List jobs
    response = await client.get("/api/v1/enrich")
    assert response.status_code == 200

    data = response.json()
    assert len(data["jobs"]) == 2
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_list_enrichment_jobs_filter_by_domain(client):
    """Test filtering jobs by domain."""
    # Create jobs
    await client.post("/api/v1/enrich/costco.com")
    await client.post("/api/v1/enrich/target.com")

    # Filter by domain
    response = await client.get("/api/v1/enrich?domain=costco.com")
    assert response.status_code == 200

    data = response.json()
    assert len(data["jobs"]) == 1
    assert data["jobs"][0]["domain"] == "costco.com"


@pytest.mark.asyncio
async def test_list_enrichment_jobs_filter_by_status(client):
    """Test filtering jobs by status."""
    # Create job
    await client.post("/api/v1/enrich/costco.com")

    # Filter by queued status
    response = await client.get("/api/v1/enrich?status=queued")
    assert response.status_code == 200

    data = response.json()
    for job in data["jobs"]:
        assert job["status"] == "queued"


@pytest.mark.asyncio
async def test_list_enrichment_jobs_pagination(client):
    """Test job listing pagination."""
    # Create several jobs
    for i in range(5):
        await client.post(f"/api/v1/enrich/company{i}.com")

    # Get first page
    response = await client.get("/api/v1/enrich?limit=2&offset=0")
    assert response.status_code == 200

    data = response.json()
    assert len(data["jobs"]) == 2
    assert data["total"] == 5


@pytest.mark.asyncio
async def test_list_enrichment_jobs_counts(client):
    """Test that job list includes running/queued counts."""
    # Create job
    await client.post("/api/v1/enrich/costco.com")

    # List jobs
    response = await client.get("/api/v1/enrich")
    assert response.status_code == 200

    data = response.json()
    assert "running_count" in data
    assert "queued_count" in data


# =============================================================================
# Response Format Tests
# =============================================================================

@pytest.mark.asyncio
async def test_enrich_response_fields(client):
    """Test enrichment response includes required fields."""
    response = await client.post("/api/v1/enrich/costco.com")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "job_id", "domain", "status", "modules", "waves",
        "priority", "force", "estimated_time_seconds", "created_at"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_status_response_fields(client):
    """Test status response includes required fields."""
    # Start enrichment
    await client.post("/api/v1/enrich/costco.com")

    # Get status
    response = await client.get("/api/v1/enrich/costco.com/status")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "job_id", "domain", "status", "progress_percent",
        "modules_total", "modules_completed", "modules_failed",
        "waves", "created_at"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_job_summary_fields(client):
    """Test job summary in list includes required fields."""
    # Create job
    await client.post("/api/v1/enrich/costco.com")

    # List jobs
    response = await client.get("/api/v1/enrich")
    assert response.status_code == 200

    job = response.json()["jobs"][0]
    required_fields = [
        "job_id", "domain", "status", "progress_percent",
        "modules_total", "modules_completed", "priority", "created_at"
    ]
    for field in required_fields:
        assert field in job, f"Missing field: {field}"
