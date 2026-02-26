"""
Tests for VersioningService

Tests all snapshot management and diff computation functionality.

Validation Criteria:
- Snapshots are created with correct version numbers
- Source citations are REQUIRED (SOURCE CITATION MANDATE)
- Diffs accurately detect added/removed/changed fields
- Historical queries return correct snapshots
- Version-at-timestamp queries are accurate
"""

import pytest
import uuid
from datetime import datetime, timedelta

from app.services.versioning import VersioningService
from app.services.validation import MissingSourceError, SourceFreshnessError
from app.models.versioning import IntelSnapshot


class TestVersioningServiceCreateSnapshot:
    """
    Tests for VersioningService.create_snapshot()

    CRITICAL REQUIREMENT: source_url and source_date are MANDATORY.
    The service MUST reject any snapshot without valid source citations.
    """

    @pytest.mark.asyncio
    async def test_create_first_snapshot_success(
        self,
        db_session,
        sample_intel_snapshot_v1,
    ):
        """
        Test: Creating first snapshot for a domain+module succeeds.

        Setup:
            - Empty database (no prior snapshots)
            - Valid snapshot data with source citations

        Expected:
            - Snapshot is created with version=1
            - Source URL and date are stored
            - has_changes=False (no prior version to compare)
            - diff_from_previous is None

        Validation:
            - Version is 1
            - All fields stored correctly
        """
        # SETUP
        service = VersioningService(db_session)
        data = sample_intel_snapshot_v1

        # ACTION
        snapshot = await service.create_snapshot(
            domain=data["domain"],
            module_type=data["module_type"],
            data=data["data"],
            source_url=data["source_url"],
            source_date=data["source_date"],
        )

        # EXPECTED
        expected = {
            "domain": "costco.com",
            "module_type": "m09_executive",
            "version": 1,
            "has_changes": False,
            "source_url": data["source_url"],
        }

        # ACTUAL
        actual = {
            "domain": snapshot.domain,
            "module_type": snapshot.module_type,
            "version": snapshot.version,
            "has_changes": snapshot.has_changes,
            "source_url": snapshot.source_url,
        }

        # VALIDATION
        assert actual == expected, f"""
        VALIDATION FAILED: First snapshot creation

        Expected: {expected}
        Actual:   {actual}

        Self-Correction:
        - Check version increment logic in create_snapshot()
        - Verify has_changes is False for first snapshot
        """

        assert snapshot.id is not None, "ID should be generated"
        assert snapshot.data == data["data"], "Data should match input"
        assert snapshot.source_date == data["source_date"], "Source date should match"
        assert snapshot.diff_from_previous is None, "First snapshot has no diff"

    @pytest.mark.asyncio
    async def test_create_second_snapshot_increments_version(
        self,
        db_session,
        sample_intel_snapshot_v1,
        sample_intel_snapshot_v2,
    ):
        """
        Test: Creating second snapshot increments version correctly.

        Setup:
            - Create first snapshot (v1)
            - Create second snapshot with different data (v2)

        Expected:
            - Second snapshot has version=2
            - has_changes=True (data differs from v1)
            - diff_from_previous is populated

        Validation:
            - Version increment is correct
            - Diff is computed automatically
        """
        # SETUP
        service = VersioningService(db_session)
        v1_data = sample_intel_snapshot_v1
        v2_data = sample_intel_snapshot_v2

        # Create v1
        await service.create_snapshot(
            domain=v1_data["domain"],
            module_type=v1_data["module_type"],
            data=v1_data["data"],
            source_url=v1_data["source_url"],
            source_date=v1_data["source_date"],
        )

        # ACTION - Create v2
        snapshot_v2 = await service.create_snapshot(
            domain=v2_data["domain"],
            module_type=v2_data["module_type"],
            data=v2_data["data"],
            source_url=v2_data["source_url"],
            source_date=v2_data["source_date"],
        )

        # VALIDATION
        assert snapshot_v2.version == 2, f"Version should be 2, got {snapshot_v2.version}"
        assert snapshot_v2.has_changes == True, "Should have changes detected"
        assert snapshot_v2.change_count > 0, "Change count should be > 0"
        assert snapshot_v2.diff_from_previous is not None, "Diff should be computed"
        assert "changed" in snapshot_v2.diff_from_previous, "Diff should have 'changed' key"

    @pytest.mark.asyncio
    async def test_create_snapshot_missing_source_url_fails(self, db_session):
        """
        Test: Creating snapshot without source_url FAILS.

        Setup:
            - Snapshot data missing source_url

        Expected:
            - MissingSourceError is raised
            - Snapshot is NOT created

        Validation:
            - Correct exception type
            - Error message mentions source_url

        CRITICAL: This enforces the SOURCE CITATION MANDATE.
        """
        # SETUP
        service = VersioningService(db_session)

        # ACTION & VALIDATION
        with pytest.raises(MissingSourceError) as exc_info:
            await service.create_snapshot(
                domain="costco.com",
                module_type="m09_executive",
                data={"executives": []},
                source_url=None,  # MISSING!
                source_date=datetime.utcnow(),
            )

        assert "source_url" in str(exc_info.value).lower(), \
            "Error should mention source_url"

    @pytest.mark.asyncio
    async def test_create_snapshot_missing_source_date_fails(self, db_session):
        """
        Test: Creating snapshot without source_date FAILS.

        Setup:
            - Snapshot data missing source_date

        Expected:
            - MissingSourceError is raised

        Validation:
            - Correct exception type

        CRITICAL: This enforces the SOURCE CITATION MANDATE.
        """
        # SETUP
        service = VersioningService(db_session)

        # ACTION & VALIDATION
        with pytest.raises(MissingSourceError) as exc_info:
            await service.create_snapshot(
                domain="costco.com",
                module_type="m09_executive",
                data={"executives": []},
                source_url="https://example.com",
                source_date=None,  # MISSING!
            )

        assert "source_date" in str(exc_info.value).lower(), \
            "Error should mention source_date"

    @pytest.mark.asyncio
    async def test_create_snapshot_expired_source_fails(self, db_session):
        """
        Test: Creating snapshot with expired source FAILS.

        Setup:
            - source_date older than 12 months

        Expected:
            - SourceFreshnessError is raised

        Validation:
            - Correct exception type
            - Cannot bypass 12-month limit
        """
        # SETUP
        service = VersioningService(db_session)
        expired_date = datetime.utcnow() - timedelta(days=400)  # 13+ months ago

        # ACTION & VALIDATION
        with pytest.raises(SourceFreshnessError) as exc_info:
            await service.create_snapshot(
                domain="costco.com",
                module_type="m09_executive",
                data={"executives": []},
                source_url="https://example.com",
                source_date=expired_date,
            )

        assert "365" in str(exc_info.value) or "12" in str(exc_info.value), \
            "Error should mention 12-month limit"

    @pytest.mark.asyncio
    async def test_create_snapshot_stores_triggered_by(self, db_session):
        """
        Test: Snapshot stores who/what triggered the creation.

        Setup:
            - Create snapshot with triggered_by parameter

        Expected:
            - triggered_by is stored correctly

        Validation:
            - Field is persisted
        """
        # SETUP
        service = VersioningService(db_session)

        # ACTION
        snapshot = await service.create_snapshot(
            domain="costco.com",
            module_type="m09_executive",
            data={"executives": []},
            source_url="https://example.com",
            source_date=datetime.utcnow(),
            triggered_by="test@algolia.com",
        )

        # VALIDATION
        assert snapshot.triggered_by == "test@algolia.com"

    @pytest.mark.asyncio
    async def test_create_snapshot_stores_job_id(self, db_session):
        """
        Test: Snapshot stores enrichment job ID.

        Setup:
            - Create snapshot with job_id parameter

        Expected:
            - job_id is stored correctly

        Validation:
            - Field is persisted and retrievable
        """
        # SETUP
        service = VersioningService(db_session)
        job_id = str(uuid.uuid4())

        # ACTION
        snapshot = await service.create_snapshot(
            domain="costco.com",
            module_type="m09_executive",
            data={"executives": []},
            source_url="https://example.com",
            source_date=datetime.utcnow(),
            job_id=job_id,
        )

        # VALIDATION
        assert snapshot.job_id == job_id


class TestVersioningServiceGetLatestSnapshot:
    """
    Tests for VersioningService.get_latest_snapshot()
    """

    @pytest.mark.asyncio
    async def test_get_latest_snapshot_returns_newest(
        self,
        db_session,
        sample_intel_snapshot_v1,
        sample_intel_snapshot_v2,
    ):
        """
        Test: get_latest_snapshot returns the highest version.

        Setup:
            - Create v1 and v2 snapshots

        Expected:
            - Returns v2 (highest version)

        Validation:
            - Version is 2
            - Data matches v2
        """
        # SETUP
        service = VersioningService(db_session)
        v1 = sample_intel_snapshot_v1
        v2 = sample_intel_snapshot_v2

        # Create snapshots
        await service.create_snapshot(
            domain=v1["domain"],
            module_type=v1["module_type"],
            data=v1["data"],
            source_url=v1["source_url"],
            source_date=v1["source_date"],
        )
        await service.create_snapshot(
            domain=v2["domain"],
            module_type=v2["module_type"],
            data=v2["data"],
            source_url=v2["source_url"],
            source_date=v2["source_date"],
        )

        # ACTION
        latest = await service.get_latest_snapshot(
            domain="costco.com",
            module_type="m09_executive",
        )

        # VALIDATION
        assert latest is not None, "Should find latest snapshot"
        assert latest.version == 2, f"Version should be 2, got {latest.version}"
        assert latest.data == v2["data"], "Data should match v2"

    @pytest.mark.asyncio
    async def test_get_latest_snapshot_none_if_not_exists(self, db_session):
        """
        Test: get_latest_snapshot returns None if no snapshots exist.

        Setup:
            - Empty database

        Expected:
            - Returns None

        Validation:
            - No exception, just None
        """
        # SETUP
        service = VersioningService(db_session)

        # ACTION
        result = await service.get_latest_snapshot(
            domain="nonexistent.com",
            module_type="m09_executive",
        )

        # VALIDATION
        assert result is None, "Should return None for non-existent domain"

    @pytest.mark.asyncio
    async def test_get_latest_snapshot_correct_module_isolation(self, db_session):
        """
        Test: get_latest_snapshot isolates by module_type.

        Setup:
            - Create snapshots for m09_executive and m02_tech_stack

        Expected:
            - Each module returns its own latest snapshot

        Validation:
            - Module isolation is correct
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        # Create snapshot for m09
        await service.create_snapshot(
            domain="costco.com",
            module_type="m09_executive",
            data={"executives": [{"name": "CEO"}]},
            source_url="https://example.com/exec",
            source_date=now,
        )

        # Create snapshot for m02
        await service.create_snapshot(
            domain="costco.com",
            module_type="m02_tech_stack",
            data={"search": "Elasticsearch"},
            source_url="https://example.com/tech",
            source_date=now,
        )

        # ACTION
        exec_snapshot = await service.get_latest_snapshot(
            domain="costco.com",
            module_type="m09_executive",
        )
        tech_snapshot = await service.get_latest_snapshot(
            domain="costco.com",
            module_type="m02_tech_stack",
        )

        # VALIDATION
        assert exec_snapshot.module_type == "m09_executive"
        assert "executives" in exec_snapshot.data
        assert tech_snapshot.module_type == "m02_tech_stack"
        assert "search" in tech_snapshot.data


class TestVersioningServiceGetSnapshotHistory:
    """
    Tests for VersioningService.get_snapshot_history()
    """

    @pytest.mark.asyncio
    async def test_get_snapshot_history_returns_ordered_list(self, db_session):
        """
        Test: get_snapshot_history returns snapshots in descending version order.

        Setup:
            - Create 5 snapshots

        Expected:
            - Returns list ordered by version DESC
            - Latest version first

        Validation:
            - Order is correct
            - All snapshots returned
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        # Create 5 snapshots
        for i in range(5):
            await service.create_snapshot(
                domain="costco.com",
                module_type="m09_executive",
                data={"version_index": i + 1},
                source_url=f"https://example.com/v{i+1}",
                source_date=now + timedelta(days=i),
            )

        # ACTION
        history = await service.get_snapshot_history(
            domain="costco.com",
            module_type="m09_executive",
        )

        # VALIDATION
        assert len(history) == 5, f"Expected 5 snapshots, got {len(history)}"
        versions = [s.version for s in history]
        assert versions == [5, 4, 3, 2, 1], f"Expected descending order, got {versions}"

    @pytest.mark.asyncio
    async def test_get_snapshot_history_respects_limit(self, db_session):
        """
        Test: get_snapshot_history respects the limit parameter.

        Setup:
            - Create 10 snapshots
            - Request only 3

        Expected:
            - Returns only 3 most recent

        Validation:
            - List length equals limit
            - Contains most recent versions
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        # Create 10 snapshots
        for i in range(10):
            await service.create_snapshot(
                domain="costco.com",
                module_type="m09_executive",
                data={"version_index": i + 1},
                source_url=f"https://example.com/v{i+1}",
                source_date=now + timedelta(days=i),
            )

        # ACTION
        history = await service.get_snapshot_history(
            domain="costco.com",
            module_type="m09_executive",
            limit=3,
        )

        # VALIDATION
        assert len(history) == 3, f"Expected 3 snapshots, got {len(history)}"
        versions = [s.version for s in history]
        assert versions == [10, 9, 8], f"Expected [10, 9, 8], got {versions}"

    @pytest.mark.asyncio
    async def test_get_snapshot_history_empty_for_nonexistent(self, db_session):
        """
        Test: get_snapshot_history returns empty list for non-existent domain.

        Setup:
            - Empty database

        Expected:
            - Returns empty list (not None)

        Validation:
            - List is empty
            - Type is list
        """
        # SETUP
        service = VersioningService(db_session)

        # ACTION
        history = await service.get_snapshot_history(
            domain="nonexistent.com",
            module_type="m09_executive",
        )

        # VALIDATION
        assert history == [], "Should return empty list"
        assert isinstance(history, list), "Should be a list type"


class TestVersioningServiceComputeDiff:
    """
    Tests for VersioningService.compute_diff()

    The diff algorithm must detect:
    - Added fields (in new, not in old)
    - Removed fields (in old, not in new)
    - Changed fields (different values)
    - Unchanged fields (same values)
    """

    @pytest.mark.asyncio
    async def test_compute_diff_detects_changed_fields(
        self,
        db_session,
        sample_intel_snapshot_v1,
        sample_intel_snapshot_v2,
    ):
        """
        Test: compute_diff correctly detects changed fields.

        Setup:
            - v1: executives = [John Smith (CFO), Bob Johnson (CEO)]
            - v2: executives = [Jane Doe (CFO), Bob Johnson (CEO)]

        Expected:
            - 'executives' is in changed dict
            - Old and new values are captured

        Validation:
            - Changed fields are identified
            - Values are correct
        """
        # SETUP
        service = VersioningService(db_session)

        # Create mock snapshot objects (not persisted, just for diff)
        old_snapshot = IntelSnapshot(
            module_type="m09_executive",
            domain="costco.com",
            version=1,
            data=sample_intel_snapshot_v1["data"],
            source_url=sample_intel_snapshot_v1["source_url"],
            source_date=sample_intel_snapshot_v1["source_date"],
        )
        new_snapshot = IntelSnapshot(
            module_type="m09_executive",
            domain="costco.com",
            version=2,
            data=sample_intel_snapshot_v2["data"],
            source_url=sample_intel_snapshot_v2["source_url"],
            source_date=sample_intel_snapshot_v2["source_date"],
        )

        # ACTION
        diff = service.compute_diff(old_snapshot, new_snapshot)

        # VALIDATION
        assert "changed" in diff, "Diff should have 'changed' key"
        assert "executives" in diff["changed"], "Should detect executives change"
        assert diff["changed"]["executives"]["old"] == sample_intel_snapshot_v1["data"]["executives"]
        assert diff["changed"]["executives"]["new"] == sample_intel_snapshot_v2["data"]["executives"]

    @pytest.mark.asyncio
    async def test_compute_diff_detects_added_fields(self, db_session):
        """
        Test: compute_diff correctly detects added fields.

        Setup:
            - v1: {"a": 1}
            - v2: {"a": 1, "b": 2}  # b is new

        Expected:
            - 'b' is in added dict

        Validation:
            - Added field detected
            - Value is correct
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        old_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=1,
            data={"a": 1},
            source_url="https://test.com",
            source_date=now,
        )
        new_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=2,
            data={"a": 1, "b": 2},
            source_url="https://test.com",
            source_date=now,
        )

        # ACTION
        diff = service.compute_diff(old_snapshot, new_snapshot)

        # VALIDATION
        assert "added" in diff, "Diff should have 'added' key"
        assert "b" in diff["added"], "Should detect 'b' as added"
        assert diff["added"]["b"] == 2, "Added value should be 2"

    @pytest.mark.asyncio
    async def test_compute_diff_detects_removed_fields(self, db_session):
        """
        Test: compute_diff correctly detects removed fields.

        Setup:
            - v1: {"a": 1, "b": 2}
            - v2: {"a": 1}  # b is removed

        Expected:
            - 'b' is in removed dict

        Validation:
            - Removed field detected
            - Old value is captured
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        old_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=1,
            data={"a": 1, "b": 2},
            source_url="https://test.com",
            source_date=now,
        )
        new_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=2,
            data={"a": 1},
            source_url="https://test.com",
            source_date=now,
        )

        # ACTION
        diff = service.compute_diff(old_snapshot, new_snapshot)

        # VALIDATION
        assert "removed" in diff, "Diff should have 'removed' key"
        assert "b" in diff["removed"], "Should detect 'b' as removed"
        assert diff["removed"]["b"] == 2, "Removed value should be 2"

    @pytest.mark.asyncio
    async def test_compute_diff_tracks_unchanged_fields(self, db_session):
        """
        Test: compute_diff lists unchanged field names.

        Setup:
            - v1: {"a": 1, "b": 2}
            - v2: {"a": 1, "b": 3}  # a unchanged, b changed

        Expected:
            - 'a' is in unchanged list

        Validation:
            - Unchanged fields listed
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        old_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=1,
            data={"a": 1, "b": 2},
            source_url="https://test.com",
            source_date=now,
        )
        new_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=2,
            data={"a": 1, "b": 3},
            source_url="https://test.com",
            source_date=now,
        )

        # ACTION
        diff = service.compute_diff(old_snapshot, new_snapshot)

        # VALIDATION
        assert "unchanged" in diff, "Diff should have 'unchanged' key"
        assert "a" in diff["unchanged"], "Should detect 'a' as unchanged"

    @pytest.mark.asyncio
    async def test_compute_diff_handles_nested_objects(self, db_session):
        """
        Test: compute_diff handles nested object changes.

        Setup:
            - v1: {"metrics": {"visits": 100}}
            - v2: {"metrics": {"visits": 200}}

        Expected:
            - Nested change is detected

        Validation:
            - Nested field in changed dict
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        old_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=1,
            data={"metrics": {"visits": 100, "bounce_rate": 0.3}},
            source_url="https://test.com",
            source_date=now,
        )
        new_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=2,
            data={"metrics": {"visits": 200, "bounce_rate": 0.3}},
            source_url="https://test.com",
            source_date=now,
        )

        # ACTION
        diff = service.compute_diff(old_snapshot, new_snapshot)

        # VALIDATION
        assert "metrics" in diff["changed"], "Should detect metrics change"
        # The entire metrics object is different, so it's treated as a changed field
        assert diff["changed"]["metrics"]["old"]["visits"] == 100
        assert diff["changed"]["metrics"]["new"]["visits"] == 200

    @pytest.mark.asyncio
    async def test_compute_diff_no_changes(self, db_session):
        """
        Test: compute_diff handles identical snapshots.

        Setup:
            - v1 and v2 have identical data

        Expected:
            - changed, added, removed are all empty
            - All fields in unchanged

        Validation:
            - Empty change sets
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()
        data = {"a": 1, "b": 2}

        old_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=1,
            data=data,
            source_url="https://test.com",
            source_date=now,
        )
        new_snapshot = IntelSnapshot(
            module_type="test",
            domain="test.com",
            version=2,
            data=data.copy(),  # Same data
            source_url="https://test.com",
            source_date=now,
        )

        # ACTION
        diff = service.compute_diff(old_snapshot, new_snapshot)

        # VALIDATION
        assert diff["changed"] == {}, "Changed should be empty"
        assert diff["added"] == {}, "Added should be empty"
        assert diff["removed"] == {}, "Removed should be empty"
        assert set(diff["unchanged"]) == {"a", "b"}, "All fields should be unchanged"


class TestVersioningServiceGetVersionAt:
    """
    Tests for VersioningService.get_version_at()

    Retrieves the snapshot that was current at a specific timestamp.
    """

    @pytest.mark.asyncio
    async def test_get_version_at_returns_correct_snapshot(self, db_session):
        """
        Test: get_version_at returns snapshot valid at given timestamp.

        Setup:
            - v1 created at T0
            - v2 created at T0 + 30 days
            - Query at T0 + 15 days

        Expected:
            - Returns v1 (was current at T0 + 15 days)

        Validation:
            - Version is correct
        """
        # SETUP
        service = VersioningService(db_session)
        t0 = datetime(2026, 1, 1, 12, 0, 0)
        t1 = t0 + timedelta(days=30)
        query_time = t0 + timedelta(days=15)

        # Create v1 at T0
        await service.create_snapshot(
            domain="costco.com",
            module_type="m09_executive",
            data={"version": 1},
            source_url="https://example.com/v1",
            source_date=t0,
            snapshot_at=t0,  # Override default timestamp
        )

        # Create v2 at T1
        await service.create_snapshot(
            domain="costco.com",
            module_type="m09_executive",
            data={"version": 2},
            source_url="https://example.com/v2",
            source_date=t1,
            snapshot_at=t1,  # Override default timestamp
        )

        # ACTION
        snapshot = await service.get_version_at(
            domain="costco.com",
            module_type="m09_executive",
            timestamp=query_time,
        )

        # VALIDATION
        assert snapshot is not None, "Should find snapshot"
        assert snapshot.version == 1, f"Should return v1, got v{snapshot.version}"
        assert snapshot.data["version"] == 1, "Data should match v1"

    @pytest.mark.asyncio
    async def test_get_version_at_returns_latest_before_timestamp(self, db_session):
        """
        Test: get_version_at returns most recent snapshot before timestamp.

        Setup:
            - v1 at T0
            - v2 at T0 + 10 days
            - v3 at T0 + 20 days
            - Query at T0 + 15 days

        Expected:
            - Returns v2 (most recent before query time)

        Validation:
            - Version is 2
        """
        # SETUP
        service = VersioningService(db_session)
        t0 = datetime(2026, 1, 1, 12, 0, 0)

        # Create 3 snapshots at different times
        for i, days in enumerate([0, 10, 20], start=1):
            await service.create_snapshot(
                domain="costco.com",
                module_type="m09_executive",
                data={"version": i},
                source_url=f"https://example.com/v{i}",
                source_date=t0 + timedelta(days=days),
                snapshot_at=t0 + timedelta(days=days),
            )

        # ACTION
        query_time = t0 + timedelta(days=15)
        snapshot = await service.get_version_at(
            domain="costco.com",
            module_type="m09_executive",
            timestamp=query_time,
        )

        # VALIDATION
        assert snapshot is not None
        assert snapshot.version == 2, f"Should return v2, got v{snapshot.version}"

    @pytest.mark.asyncio
    async def test_get_version_at_returns_none_before_first_snapshot(self, db_session):
        """
        Test: get_version_at returns None if timestamp is before first snapshot.

        Setup:
            - v1 created at T0
            - Query at T0 - 30 days

        Expected:
            - Returns None

        Validation:
            - No snapshot exists at that time
        """
        # SETUP
        service = VersioningService(db_session)
        t0 = datetime(2026, 2, 1, 12, 0, 0)

        # Create v1 at T0
        await service.create_snapshot(
            domain="costco.com",
            module_type="m09_executive",
            data={"version": 1},
            source_url="https://example.com/v1",
            source_date=t0,
            snapshot_at=t0,
        )

        # ACTION - Query before first snapshot
        query_time = t0 - timedelta(days=30)
        snapshot = await service.get_version_at(
            domain="costco.com",
            module_type="m09_executive",
            timestamp=query_time,
        )

        # VALIDATION
        assert snapshot is None, "Should return None for time before first snapshot"

    @pytest.mark.asyncio
    async def test_get_version_at_returns_latest_for_future_timestamp(self, db_session):
        """
        Test: get_version_at returns latest snapshot for future timestamp.

        Setup:
            - v1 at T0
            - v2 at T0 + 30 days
            - Query at T0 + 365 days

        Expected:
            - Returns v2 (latest available)

        Validation:
            - Version is 2
        """
        # SETUP
        service = VersioningService(db_session)
        t0 = datetime(2026, 1, 1, 12, 0, 0)

        await service.create_snapshot(
            domain="costco.com",
            module_type="m09_executive",
            data={"version": 1},
            source_url="https://example.com/v1",
            source_date=t0,
            snapshot_at=t0,
        )
        await service.create_snapshot(
            domain="costco.com",
            module_type="m09_executive",
            data={"version": 2},
            source_url="https://example.com/v2",
            source_date=t0 + timedelta(days=30),
            snapshot_at=t0 + timedelta(days=30),
        )

        # ACTION - Query far in the future
        query_time = t0 + timedelta(days=365)
        snapshot = await service.get_version_at(
            domain="costco.com",
            module_type="m09_executive",
            timestamp=query_time,
        )

        # VALIDATION
        assert snapshot is not None
        assert snapshot.version == 2, "Should return latest (v2)"


class TestVersioningServiceIntegration:
    """
    Integration tests combining multiple service methods.
    """

    @pytest.mark.asyncio
    async def test_full_snapshot_lifecycle(self, db_session):
        """
        Test: Full lifecycle - create, retrieve, diff, history.

        Setup:
            - Create 3 snapshots over time

        Expected:
            - All operations work correctly together

        Validation:
            - End-to-end workflow succeeds
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        # Create 3 snapshots
        data_versions = [
            {"executives": [{"name": "CEO1"}], "theme": "growth"},
            {"executives": [{"name": "CEO1"}, {"name": "CFO1"}], "theme": "growth"},
            {"executives": [{"name": "CEO2"}, {"name": "CFO1"}], "theme": "efficiency"},
        ]

        for i, data in enumerate(data_versions, start=1):
            await service.create_snapshot(
                domain="test.com",
                module_type="m09_executive",
                data=data,
                source_url=f"https://example.com/v{i}",
                source_date=now + timedelta(days=i * 30),
            )

        # VALIDATE HISTORY
        history = await service.get_snapshot_history(
            domain="test.com",
            module_type="m09_executive",
        )
        assert len(history) == 3, "Should have 3 snapshots"
        assert [s.version for s in history] == [3, 2, 1], "Should be in descending order"

        # VALIDATE LATEST
        latest = await service.get_latest_snapshot(
            domain="test.com",
            module_type="m09_executive",
        )
        assert latest.version == 3
        assert latest.data["executives"][0]["name"] == "CEO2"

        # VALIDATE DIFF
        v1 = history[2]  # version 1
        v3 = history[0]  # version 3
        diff = service.compute_diff(v1, v3)

        assert "executives" in diff["changed"], "Executives changed"
        assert "theme" in diff["changed"], "Theme changed"

    @pytest.mark.asyncio
    async def test_multi_domain_isolation(self, db_session):
        """
        Test: Snapshots are isolated by domain.

        Setup:
            - Create snapshots for domain A and domain B

        Expected:
            - Each domain has its own history

        Validation:
            - Queries return only matching domain
        """
        # SETUP
        service = VersioningService(db_session)
        now = datetime.utcnow()

        # Domain A - 2 snapshots
        for i in range(2):
            await service.create_snapshot(
                domain="domainA.com",
                module_type="m09_executive",
                data={"domain": "A", "version": i + 1},
                source_url=f"https://domainA.com/v{i+1}",
                source_date=now + timedelta(days=i),
            )

        # Domain B - 3 snapshots
        for i in range(3):
            await service.create_snapshot(
                domain="domainB.com",
                module_type="m09_executive",
                data={"domain": "B", "version": i + 1},
                source_url=f"https://domainB.com/v{i+1}",
                source_date=now + timedelta(days=i),
            )

        # VALIDATE
        history_a = await service.get_snapshot_history(
            domain="domainA.com",
            module_type="m09_executive",
        )
        history_b = await service.get_snapshot_history(
            domain="domainB.com",
            module_type="m09_executive",
        )

        assert len(history_a) == 2, "Domain A should have 2 snapshots"
        assert len(history_b) == 3, "Domain B should have 3 snapshots"
        assert all(s.domain == "domainA.com" for s in history_a)
        assert all(s.domain == "domainB.com" for s in history_b)

    @pytest.mark.asyncio
    async def test_change_detection_flags_set_correctly(
        self,
        db_session,
        sample_intel_snapshot_v1,
        sample_intel_snapshot_v2,
    ):
        """
        Test: Change detection sets has_changes and change_count.

        Setup:
            - v1 with initial data
            - v2 with modified data

        Expected:
            - v1: has_changes=False, change_count=0
            - v2: has_changes=True, change_count > 0, highest_significance set

        Validation:
            - Flags are computed automatically
        """
        # SETUP
        service = VersioningService(db_session)
        v1 = sample_intel_snapshot_v1
        v2 = sample_intel_snapshot_v2

        # Create v1
        snapshot_v1 = await service.create_snapshot(
            domain=v1["domain"],
            module_type=v1["module_type"],
            data=v1["data"],
            source_url=v1["source_url"],
            source_date=v1["source_date"],
        )

        # Create v2
        snapshot_v2 = await service.create_snapshot(
            domain=v2["domain"],
            module_type=v2["module_type"],
            data=v2["data"],
            source_url=v2["source_url"],
            source_date=v2["source_date"],
        )

        # VALIDATE V1
        assert snapshot_v1.has_changes == False, "V1 should have no prior changes"
        assert snapshot_v1.change_count == 0, "V1 change count should be 0"

        # VALIDATE V2
        assert snapshot_v2.has_changes == True, "V2 should have changes"
        assert snapshot_v2.change_count > 0, "V2 change count should be > 0"
        assert snapshot_v2.diff_from_previous is not None, "V2 should have diff"
