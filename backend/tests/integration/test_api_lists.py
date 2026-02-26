"""
Integration Tests for List API Endpoints

Tests CSV upload, validation, and enrichment workflows.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from datetime import datetime
import io
import csv

# Import app and models
from app.main import app
from app.database import Base, get_session
from app.models import UploadedList, UploadedListItem, User, Team
from app.api.deps import get_current_user, CurrentUser


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture(scope="function")
async def test_db():
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
def sample_csv_content():
    """Generate sample CSV content."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Domain", "Company Name", "Industry", "Revenue"])
    writer.writerow(["costco.com", "Costco Wholesale", "Retail", "240000000000"])
    writer.writerow(["target.com", "Target Corporation", "Retail", "100000000000"])
    writer.writerow(["walmart.com", "Walmart Inc", "Retail", "600000000000"])
    return output.getvalue().encode("utf-8")


@pytest.fixture
def sample_csv_with_errors():
    """Generate CSV with validation errors."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Domain", "Company Name"])
    writer.writerow(["costco.com", "Costco Wholesale"])
    writer.writerow(["", "Missing Domain Co"])  # Missing domain
    writer.writerow(["invalid domain", "Invalid Domain Format"])  # Invalid format
    writer.writerow(["costco.com", "Costco Duplicate"])  # Duplicate
    return output.getvalue().encode("utf-8")


# =============================================================================
# Health Check Tests
# =============================================================================

@pytest.mark.asyncio
async def test_health_check(client):
    """Test basic health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert data["service"] == "PartnerForge"


@pytest.mark.asyncio
async def test_readiness_check(client):
    """Test readiness check endpoint."""
    response = await client.get("/health/ready")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert "checks" in data
    assert "database" in data["checks"]


@pytest.mark.asyncio
async def test_version_endpoint(client):
    """Test version endpoint."""
    response = await client.get("/version")
    assert response.status_code == 200

    data = response.json()
    assert data["service"] == "PartnerForge"
    assert "version" in data
    assert data["api_version"] == "v1"


# =============================================================================
# List Upload Tests
# =============================================================================

@pytest.mark.asyncio
async def test_upload_csv_success(client, sample_csv_content):
    """Test successful CSV upload."""
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List", "source": "manual"}

    response = await client.post(
        "/api/v1/lists/upload",
        files=files,
        params=params,
    )
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "Test List"
    assert data["status"] == "uploaded"
    assert data["total_rows"] == 3
    assert "domain" in data["column_mapping"]
    assert data["detected_columns"] == ["Domain", "Company Name", "Industry", "Revenue"]


@pytest.mark.asyncio
async def test_upload_csv_invalid_file_type(client):
    """Test upload rejection for non-CSV files."""
    files = {"file": ("test.txt", b"not a csv", "text/plain")}
    params = {"name": "Test List"}

    response = await client.post(
        "/api/v1/lists/upload",
        files=files,
        params=params,
    )
    assert response.status_code == 400
    assert "CSV" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_csv_empty_file(client):
    """Test upload rejection for empty CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Domain", "Company"])  # Only header, no data

    files = {"file": ("test.csv", output.getvalue().encode("utf-8"), "text/csv")}
    params = {"name": "Test List"}

    response = await client.post(
        "/api/v1/lists/upload",
        files=files,
        params=params,
    )
    assert response.status_code == 400
    assert "at least" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_csv_duplicate_detection(client, sample_csv_content):
    """Test duplicate file upload detection."""
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}

    # First upload should succeed
    response1 = await client.post("/api/v1/lists/upload", files=files, params=params)
    assert response1.status_code == 200

    # Second upload of same file should fail
    files2 = {"file": ("test.csv", sample_csv_content, "text/csv")}
    response2 = await client.post("/api/v1/lists/upload", files=files2, params={"name": "Duplicate List"})
    assert response2.status_code == 409
    assert "already been uploaded" in response2.json()["detail"]


# =============================================================================
# List CRUD Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_lists_empty(client):
    """Test getting lists when none exist."""
    response = await client.get("/api/v1/lists")
    assert response.status_code == 200

    data = response.json()
    assert data["lists"] == []
    assert data["pagination"]["total"] == 0


@pytest.mark.asyncio
async def test_get_lists_with_data(client, sample_csv_content):
    """Test getting lists after upload."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    await client.post("/api/v1/lists/upload", files=files, params=params)

    # Get lists
    response = await client.get("/api/v1/lists")
    assert response.status_code == 200

    data = response.json()
    assert len(data["lists"]) == 1
    assert data["lists"][0]["name"] == "Test List"
    assert data["pagination"]["total"] == 1


@pytest.mark.asyncio
async def test_get_list_details(client, sample_csv_content):
    """Test getting specific list details with items."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Get details
    response = await client.get(f"/api/v1/lists/{list_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["list"]["id"] == list_id
    assert data["list"]["name"] == "Test List"
    assert len(data["items"]) == 3
    assert data["items"][0]["domain"] == "costco.com"


@pytest.mark.asyncio
async def test_get_list_not_found(client):
    """Test 404 for non-existent list."""
    response = await client.get("/api/v1/lists/nonexistent-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_list(client, sample_csv_content):
    """Test list deletion."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Delete it
    response = await client.delete(f"/api/v1/lists/{list_id}")
    assert response.status_code == 200
    assert response.json()["id"] == list_id

    # Verify it's gone
    get_response = await client.get(f"/api/v1/lists/{list_id}")
    assert get_response.status_code == 404


# =============================================================================
# List Validation Tests
# =============================================================================

@pytest.mark.asyncio
async def test_validate_list_success(client, sample_csv_content):
    """Test successful list validation."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Validate
    response = await client.post(f"/api/v1/lists/{list_id}/validate")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "validated"
    assert data["valid_rows"] == 3
    assert data["invalid_rows"] == 0
    assert data["ready_for_enrichment"] is True


@pytest.mark.asyncio
async def test_validate_list_with_errors(client, sample_csv_with_errors):
    """Test validation with error detection."""
    # Upload a list with errors
    files = {"file": ("test.csv", sample_csv_with_errors, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Validate
    response = await client.post(f"/api/v1/lists/{list_id}/validate")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "validated"
    assert data["valid_rows"] == 1  # Only costco.com is valid
    assert data["invalid_rows"] == 2  # Missing domain and invalid format
    assert data["duplicate_rows"] == 1  # Second costco.com
    assert len(data["errors"]) > 0


@pytest.mark.asyncio
async def test_validate_list_not_uploaded(client, sample_csv_content):
    """Test validation fails for wrong status."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Validate first time
    await client.post(f"/api/v1/lists/{list_id}/validate")

    # Try to validate again should work (allows re-validation)
    response = await client.post(f"/api/v1/lists/{list_id}/validate")
    assert response.status_code == 200


# =============================================================================
# List Enrichment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_enrich_list_success(client, sample_csv_content):
    """Test starting enrichment on a validated list."""
    # Upload and validate
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]
    await client.post(f"/api/v1/lists/{list_id}/validate")

    # Start enrichment
    response = await client.post(f"/api/v1/lists/{list_id}/enrich")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "queued"
    assert data["items_queued"] == 3
    assert "enrichment_job_id" in data
    assert len(data["modules"]) == 15  # All modules


@pytest.mark.asyncio
async def test_enrich_list_specific_modules(client, sample_csv_content):
    """Test enrichment with specific modules."""
    # Upload and validate
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]
    await client.post(f"/api/v1/lists/{list_id}/validate")

    # Start enrichment with specific modules
    response = await client.post(
        f"/api/v1/lists/{list_id}/enrich",
        json={"modules": ["m01_company_context", "m02_tech_stack"]},
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["modules"]) == 2
    assert "m01_company_context" in data["modules"]


@pytest.mark.asyncio
async def test_enrich_list_specific_waves(client, sample_csv_content):
    """Test enrichment with specific waves."""
    # Upload and validate
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]
    await client.post(f"/api/v1/lists/{list_id}/validate")

    # Start enrichment with waves 1 and 2
    response = await client.post(
        f"/api/v1/lists/{list_id}/enrich",
        json={"waves": [1, 2]},
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["modules"]) == 7  # Wave 1 (4) + Wave 2 (3)


@pytest.mark.asyncio
async def test_enrich_list_not_validated(client, sample_csv_content):
    """Test enrichment fails for non-validated list."""
    # Upload only
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Try enrichment without validation
    response = await client.post(f"/api/v1/lists/{list_id}/enrich")
    assert response.status_code == 400
    assert "validated" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_processing_status(client, sample_csv_content):
    """Test getting processing status."""
    # Upload and validate
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]
    await client.post(f"/api/v1/lists/{list_id}/validate")
    await client.post(f"/api/v1/lists/{list_id}/enrich")

    # Get status
    response = await client.get(f"/api/v1/lists/{list_id}/status")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == list_id
    assert data["status"] == "queued"
    assert data["total_items"] == 3


@pytest.mark.asyncio
async def test_cancel_enrichment(client, sample_csv_content):
    """Test cancelling enrichment."""
    # Upload, validate, and start enrichment
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]
    await client.post(f"/api/v1/lists/{list_id}/validate")
    await client.post(f"/api/v1/lists/{list_id}/enrich")

    # Cancel
    response = await client.post(f"/api/v1/lists/{list_id}/cancel")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "cancelled"


# =============================================================================
# Column Mapping Tests
# =============================================================================

@pytest.mark.asyncio
async def test_confirm_column_mapping(client, sample_csv_content):
    """Test confirming column mapping."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Confirm mapping
    response = await client.post(
        f"/api/v1/lists/{list_id}/confirm-mapping",
        json={
            "mapping": {
                "domain": "Domain",
                "company_name": "Company Name",
                "revenue": "Revenue",
            },
            "confirmed": True,
        },
    )
    assert response.status_code == 200
    assert response.json()["mapping_confirmed"] is True


@pytest.mark.asyncio
async def test_confirm_mapping_missing_domain(client, sample_csv_content):
    """Test mapping confirmation fails without domain."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Try to confirm without domain
    response = await client.post(
        f"/api/v1/lists/{list_id}/confirm-mapping",
        json={
            "mapping": {
                "company_name": "Company Name",
            },
            "confirmed": True,
        },
    )
    assert response.status_code == 400
    assert "domain" in response.json()["detail"].lower()


# =============================================================================
# Item Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_list_item(client, sample_csv_content):
    """Test getting a specific list item."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Get list to find item ID
    list_response = await client.get(f"/api/v1/lists/{list_id}")
    item_id = list_response.json()["items"][0]["id"]

    # Get item
    response = await client.get(f"/api/v1/lists/{list_id}/items/{item_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    assert data["company_name"] == "Costco Wholesale"
    assert "csv_data" in data


@pytest.mark.asyncio
async def test_get_item_not_found(client, sample_csv_content):
    """Test 404 for non-existent item."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Try to get non-existent item
    response = await client.get(f"/api/v1/lists/{list_id}/items/nonexistent-id")
    assert response.status_code == 404


# =============================================================================
# Pagination Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_pagination(client):
    """Test list pagination."""
    # Upload multiple lists
    for i in range(5):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Domain", "Company"])
        writer.writerow([f"company{i}.com", f"Company {i}"])

        files = {"file": (f"test{i}.csv", output.getvalue().encode("utf-8"), "text/csv")}
        params = {"name": f"Test List {i}"}
        await client.post("/api/v1/lists/upload", files=files, params=params)

    # Get first page
    response = await client.get("/api/v1/lists?page=1&limit=2")
    assert response.status_code == 200

    data = response.json()
    assert len(data["lists"]) == 2
    assert data["pagination"]["total"] == 5
    assert data["pagination"]["total_pages"] == 3

    # Get second page
    response2 = await client.get("/api/v1/lists?page=2&limit=2")
    data2 = response2.json()
    assert len(data2["lists"]) == 2


@pytest.mark.asyncio
async def test_item_pagination(client):
    """Test item pagination within a list."""
    # Create CSV with many rows
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Domain", "Company"])
    for i in range(25):
        writer.writerow([f"company{i}.com", f"Company {i}"])

    files = {"file": ("test.csv", output.getvalue().encode("utf-8"), "text/csv")}
    params = {"name": "Big List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]

    # Get with pagination
    response = await client.get(f"/api/v1/lists/{list_id}?page=1&limit=10")
    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) == 10
    assert data["pagination"]["total"] == 25
    assert data["pagination"]["total_pages"] == 3


# =============================================================================
# Filter Tests
# =============================================================================

@pytest.mark.asyncio
async def test_filter_lists_by_status(client, sample_csv_content):
    """Test filtering lists by status."""
    # Upload a list
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    params = {"name": "Test List"}
    await client.post("/api/v1/lists/upload", files=files, params=params)

    # Filter by uploaded status
    response = await client.get("/api/v1/lists?status=uploaded")
    assert response.status_code == 200
    assert len(response.json()["lists"]) == 1

    # Filter by non-matching status
    response2 = await client.get("/api/v1/lists?status=validated")
    assert len(response2.json()["lists"]) == 0


@pytest.mark.asyncio
async def test_search_lists_by_name(client, sample_csv_content):
    """Test searching lists by name."""
    # Upload lists
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    await client.post("/api/v1/lists/upload", files=files, params={"name": "Retail Targets"})

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Domain"])
    writer.writerow(["tech.com"])
    files2 = {"file": ("test2.csv", output.getvalue().encode("utf-8"), "text/csv")}
    await client.post("/api/v1/lists/upload", files=files2, params={"name": "Tech Companies"})

    # Search for retail
    response = await client.get("/api/v1/lists?search=retail")
    assert response.status_code == 200
    assert len(response.json()["lists"]) == 1
    assert "Retail" in response.json()["lists"][0]["name"]


@pytest.mark.asyncio
async def test_filter_items_by_status(client, sample_csv_with_errors):
    """Test filtering list items by status."""
    # Upload and validate
    files = {"file": ("test.csv", sample_csv_with_errors, "text/csv")}
    params = {"name": "Test List"}
    upload_response = await client.post("/api/v1/lists/upload", files=files, params=params)
    list_id = upload_response.json()["id"]
    await client.post(f"/api/v1/lists/{list_id}/validate")

    # Get only valid items
    response = await client.get(f"/api/v1/lists/{list_id}?item_status=valid")
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1

    # Get only invalid items
    response2 = await client.get(f"/api/v1/lists/{list_id}?item_status=invalid")
    assert len(response2.json()["items"]) == 2
