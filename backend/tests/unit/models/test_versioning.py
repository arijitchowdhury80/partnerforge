"""
Tests for Versioning Models

Tests IntelSnapshot, ChangeEvent, and SnapshotComparison models.

Validation Criteria:
- Snapshots store full data as JSON
- Version increments correctly
- Diff is computed from previous version
- Change events are categorized correctly
"""

import pytest
from datetime import datetime
import uuid


class TestIntelSnapshot:
    """
    Tests for IntelSnapshot model.

    Each test documents:
    - Setup: Initial state
    - Expected: What should happen
    - Validation: How we verify
    """

    @pytest.mark.asyncio
    async def test_snapshot_creation_with_valid_data(
        self,
        db_session,
        sample_intel_snapshot_v1,
    ):
        """
        Test: Creating a snapshot with valid data succeeds.

        Setup:
            - Valid snapshot data with all required fields

        Expected:
            - Snapshot is created with correct values
            - ID is generated (UUID format)
            - created_at is set automatically

        Validation:
            - All fields match input
            - ID is valid UUID
            - Timestamps are set
        """
        from app.models.versioning import IntelSnapshot

        # SETUP
        data = sample_intel_snapshot_v1

        # ACTION
        snapshot = IntelSnapshot(
            module_type=data["module_type"],
            domain=data["domain"],
            version=data["version"],
            snapshot_type=data["snapshot_type"],
            data=data["data"],
            source_url=data["source_url"],
            source_date=data["source_date"],
            has_changes=data["has_changes"],
            change_count=data["change_count"],
        )
        db_session.add(snapshot)
        await db_session.flush()

        # EXPECTED
        expected = {
            "module_type": "m09_executive",
            "domain": "costco.com",
            "version": 1,
            "has_changes": False,
            "change_count": 0,
        }

        # ACTUAL
        actual = {
            "module_type": snapshot.module_type,
            "domain": snapshot.domain,
            "version": snapshot.version,
            "has_changes": snapshot.has_changes,
            "change_count": snapshot.change_count,
        }

        # VALIDATION
        assert actual == expected, f"""
        VALIDATION FAILED: Snapshot creation

        Expected: {expected}
        Actual:   {actual}

        Self-Correction:
        - Check that all fields are being set correctly
        - Verify column types in models/versioning.py
        """

        # Additional validations
        assert snapshot.id is not None, "ID should be generated"
        assert len(snapshot.id) == 36, "ID should be UUID format (36 chars)"
        assert snapshot.created_at is not None, "created_at should be auto-set"
        assert snapshot.data == data["data"], "Data should be stored as JSON"

    @pytest.mark.asyncio
    async def test_snapshot_with_changes(
        self,
        db_session,
        sample_intel_snapshot_v2,
        expected_diff_v1_to_v2,
    ):
        """
        Test: Snapshot with changes has correct flags set.

        Setup:
            - Snapshot data with has_changes=True
            - Diff from previous version

        Expected:
            - has_changes is True
            - change_count > 0
            - highest_significance is set
            - diff_from_previous is stored

        Validation:
            - Boolean flags correct
            - Diff structure is valid JSON
        """
        from app.models.versioning import IntelSnapshot

        # SETUP
        data = sample_intel_snapshot_v2
        data["diff_from_previous"] = expected_diff_v1_to_v2

        # ACTION
        snapshot = IntelSnapshot(
            module_type=data["module_type"],
            domain=data["domain"],
            version=data["version"],
            data=data["data"],
            source_url=data["source_url"],
            source_date=data["source_date"],
            has_changes=data["has_changes"],
            change_count=data["change_count"],
            highest_significance=data["highest_significance"],
            diff_from_previous=data["diff_from_previous"],
        )
        db_session.add(snapshot)
        await db_session.flush()

        # VALIDATION
        assert snapshot.has_changes == True, "Should have changes"
        assert snapshot.change_count == 3, "Should have 3 changes"
        assert snapshot.highest_significance == "high", "Should be high significance"
        assert "changed" in snapshot.diff_from_previous, "Diff should have 'changed' key"
        assert "executives" in snapshot.diff_from_previous["changed"], "Should detect exec change"

    @pytest.mark.asyncio
    async def test_snapshot_unique_constraint(
        self,
        db_session,
        sample_intel_snapshot_v1,
    ):
        """
        Test: Cannot create duplicate version for same module+domain.

        Setup:
            - Create snapshot v1
            - Attempt to create another v1 for same module+domain

        Expected:
            - Second insert fails with integrity error

        Validation:
            - IntegrityError is raised
        """
        from app.models.versioning import IntelSnapshot
        from sqlalchemy.exc import IntegrityError

        # SETUP - Create first snapshot
        data = sample_intel_snapshot_v1
        snapshot1 = IntelSnapshot(
            module_type=data["module_type"],
            domain=data["domain"],
            version=data["version"],
            data=data["data"],
            source_url=data["source_url"],
            source_date=data["source_date"],
        )
        db_session.add(snapshot1)
        await db_session.flush()

        # ACTION - Try to create duplicate
        snapshot2 = IntelSnapshot(
            module_type=data["module_type"],
            domain=data["domain"],
            version=data["version"],  # Same version!
            data=data["data"],
            source_url=data["source_url"],
            source_date=data["source_date"],
        )
        db_session.add(snapshot2)

        # VALIDATION
        with pytest.raises(IntegrityError):
            await db_session.flush()


class TestChangeEvent:
    """
    Tests for ChangeEvent model.

    Validation Criteria:
    - Category is valid enum value
    - Significance is valid enum value
    - Summary is human-readable
    - Algolia relevance is populated
    """

    @pytest.mark.asyncio
    async def test_change_event_creation(
        self,
        db_session,
        expected_executive_change,
    ):
        """
        Test: Creating a change event with valid data.

        Setup:
            - Valid change event data
            - Parent snapshot (required)

        Expected:
            - Event is created
            - All fields stored correctly
        """
        from app.models.versioning import ChangeEvent, IntelSnapshot

        # SETUP - Create parent snapshot first
        snapshot = IntelSnapshot(
            module_type="m09_executive",
            domain="costco.com",
            version=1,
            data={"executives": []},
            source_url="https://example.com",
            source_date=datetime.utcnow(),
        )
        db_session.add(snapshot)
        await db_session.flush()

        data = expected_executive_change

        # ACTION
        event = ChangeEvent(
            snapshot_id=snapshot.id,  # Required FK
            domain="costco.com",
            module_type="m09_executive",
            category=data["category"],
            significance=data["significance"],
            field=data["field"],
            old_value={"name": "John Smith"},
            new_value={"name": "Jane Doe"},
            summary=data["summary"],
            algolia_relevance=data["algolia_relevance"],
        )
        db_session.add(event)
        await db_session.flush()

        # VALIDATION
        assert event.id is not None, "ID should be generated"
        assert event.category == "executive_change"
        assert event.significance == "high"
        assert "CFO" in event.summary, "Summary should mention CFO"
        assert event.algolia_relevance is not None, "Algolia relevance required"
        assert event.detected_at is not None, "detected_at should be auto-set"
        assert event.snapshot_id == snapshot.id, "Should link to parent snapshot"

    @pytest.mark.asyncio
    async def test_change_event_with_snapshot_link(
        self,
        db_session,
        sample_intel_snapshot_v2,
    ):
        """
        Test: Change event links to parent snapshot.

        Setup:
            - Create snapshot
            - Create change event with snapshot_id

        Expected:
            - Event references correct snapshot
        """
        from app.models.versioning import IntelSnapshot, ChangeEvent

        # SETUP - Create snapshot
        snapshot = IntelSnapshot(
            module_type="m09_executive",
            domain="costco.com",
            version=2,
            data=sample_intel_snapshot_v2["data"],
            source_url="https://example.com",
            source_date=datetime.utcnow(),
        )
        db_session.add(snapshot)
        await db_session.flush()

        # ACTION - Create linked event
        event = ChangeEvent(
            snapshot_id=snapshot.id,
            domain="costco.com",
            module_type="m09_executive",
            category="executive_change",
            significance="high",
            field="executives",
            summary="CFO changed",
            algolia_relevance="New relationship opportunity",
        )
        db_session.add(event)
        await db_session.flush()

        # VALIDATION
        assert event.snapshot_id == snapshot.id


class TestSnapshotComparison:
    """
    Tests for SnapshotComparison model.

    Used for caching comparisons between versions.
    """

    @pytest.mark.asyncio
    async def test_comparison_creation(self, db_session):
        """
        Test: Creating a snapshot comparison.

        Setup:
            - Two snapshots
            - Comparison data

        Expected:
            - Comparison is created
            - References both snapshots
        """
        from app.models.versioning import IntelSnapshot, SnapshotComparison

        # SETUP - Create two snapshots
        snapshot1 = IntelSnapshot(
            module_type="m02_tech_stack",
            domain="costco.com",
            version=1,
            data={"search": "Elasticsearch"},
            source_url="https://example.com",
            source_date=datetime.utcnow(),
        )
        snapshot2 = IntelSnapshot(
            module_type="m02_tech_stack",
            domain="costco.com",
            version=2,
            data={"search": None},  # Removed!
            source_url="https://example.com",
            source_date=datetime.utcnow(),
        )
        db_session.add_all([snapshot1, snapshot2])
        await db_session.flush()

        # ACTION
        comparison = SnapshotComparison(
            domain="costco.com",
            module_type="m02_tech_stack",
            snapshot_old_id=snapshot1.id,
            snapshot_new_id=snapshot2.id,
            version_old=1,
            version_new=2,
            full_diff={
                "changed": {"search": {"old": "Elasticsearch", "new": None}},
            },
            total_changes=1,
            highest_significance="critical",
            comparison_type="previous",
        )
        db_session.add(comparison)
        await db_session.flush()

        # VALIDATION
        assert comparison.id is not None
        assert comparison.snapshot_old_id == snapshot1.id
        assert comparison.snapshot_new_id == snapshot2.id
        assert comparison.total_changes == 1
        assert comparison.highest_significance == "critical"
