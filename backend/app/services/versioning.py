"""
PartnerForge Versioning Service

Core service for snapshot management and diff computation.

CRITICAL: Enforces the Source Citation Mandate.
Every snapshot MUST have source_url and source_date.

Responsibilities:
- Create point-in-time snapshots of intelligence data
- Compute diffs between snapshots
- Retrieve historical snapshots
- Query version at specific timestamp
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from ..models.versioning import IntelSnapshot
from .validation import (
    MissingSourceError,
    validate_source_freshness,
)

logger = logging.getLogger(__name__)


class VersioningService:
    """
    Service for managing intelligence snapshots and version history.

    This service enforces the SOURCE CITATION MANDATE:
    - Every snapshot MUST have a source_url
    - Every snapshot MUST have a source_date within 12 months

    Methods:
        create_snapshot: Create a new snapshot with automatic versioning
        get_latest_snapshot: Get the most recent snapshot for domain+module
        get_snapshot_history: Get ordered list of snapshots
        compute_diff: Compute differences between two snapshots
        get_version_at: Get snapshot that was current at a timestamp
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize the versioning service.

        Args:
            session: Async database session
        """
        self.session = session

    async def create_snapshot(
        self,
        domain: str,
        module_type: str,
        data: Dict[str, Any],
        source_url: Optional[str],
        source_date: Optional[datetime],
        triggered_by: Optional[str] = None,
        job_id: Optional[str] = None,
        snapshot_type: str = "auto",
        snapshot_at: Optional[datetime] = None,
    ) -> IntelSnapshot:
        """
        Create a new snapshot of intelligence data.

        This method:
        1. Validates source citations (MANDATORY)
        2. Determines the next version number
        3. Computes diff from previous version (if exists)
        4. Creates and persists the snapshot

        Args:
            domain: Company domain (e.g., "costco.com")
            module_type: Module identifier (e.g., "m09_executive")
            data: The intelligence data to snapshot (JSON-serializable dict)
            source_url: URL of the data source (REQUIRED)
            source_date: Date of the source (REQUIRED, must be < 12 months old)
            triggered_by: Email or identifier of who triggered the snapshot
            job_id: Enrichment job ID if part of a job
            snapshot_type: Type of snapshot ("auto", "manual", "pre_update")
            snapshot_at: Override snapshot timestamp (for testing/backfill)

        Returns:
            IntelSnapshot: The created snapshot

        Raises:
            MissingSourceError: If source_url or source_date is None
            SourceFreshnessError: If source_date is older than 12 months
        """
        # =============================================================
        # STEP 1: Enforce Source Citation Mandate
        # =============================================================
        if source_url is None:
            raise MissingSourceError(module_type, "source_url")

        if source_date is None:
            raise MissingSourceError(module_type, "source_date")

        # Validate freshness (raises SourceFreshnessError if too old)
        validate_source_freshness(source_date)

        # =============================================================
        # STEP 2: Get previous snapshot and determine version
        # =============================================================
        previous = await self.get_latest_snapshot(domain, module_type)

        if previous is None:
            version = 1
            diff_from_previous = None
            has_changes = False
            change_count = 0
            highest_significance = None
        else:
            version = previous.version + 1
            # Compute diff using a temporary snapshot object for the new data
            temp_new = IntelSnapshot(
                module_type=module_type,
                domain=domain,
                version=version,
                data=data,
                source_url=source_url,
                source_date=source_date,
            )
            diff_from_previous = self.compute_diff(previous, temp_new)
            has_changes = self._has_meaningful_changes(diff_from_previous)
            change_count = self._count_changes(diff_from_previous)
            highest_significance = self._determine_significance(
                diff_from_previous, module_type
            )

        # =============================================================
        # STEP 3: Create the snapshot
        # =============================================================
        snapshot = IntelSnapshot(
            module_type=module_type,
            domain=domain,
            version=version,
            snapshot_type=snapshot_type,
            data=data,
            source_url=source_url,
            source_date=source_date,
            triggered_by=triggered_by,
            job_id=job_id,
            diff_from_previous=diff_from_previous,
            has_changes=has_changes,
            change_count=change_count,
            highest_significance=highest_significance,
        )

        # Override snapshot_at if provided (for testing/backfill)
        if snapshot_at is not None:
            snapshot.snapshot_at = snapshot_at

        self.session.add(snapshot)
        await self.session.flush()

        logger.info(
            f"Created snapshot v{version} for {domain}/{module_type}. "
            f"Changes: {has_changes}, Count: {change_count}"
        )

        return snapshot

    async def get_latest_snapshot(
        self,
        domain: str,
        module_type: str,
    ) -> Optional[IntelSnapshot]:
        """
        Get the most recent snapshot for a domain and module.

        Args:
            domain: Company domain
            module_type: Module identifier

        Returns:
            IntelSnapshot if found, None otherwise
        """
        query = (
            select(IntelSnapshot)
            .where(
                and_(
                    IntelSnapshot.domain == domain,
                    IntelSnapshot.module_type == module_type,
                )
            )
            .order_by(desc(IntelSnapshot.version))
            .limit(1)
        )

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_snapshot_history(
        self,
        domain: str,
        module_type: str,
        limit: int = 10,
    ) -> List[IntelSnapshot]:
        """
        Get the history of snapshots for a domain and module.

        Returns snapshots in descending version order (newest first).

        Args:
            domain: Company domain
            module_type: Module identifier
            limit: Maximum number of snapshots to return (default: 10)

        Returns:
            List of IntelSnapshot objects, ordered by version DESC
        """
        query = (
            select(IntelSnapshot)
            .where(
                and_(
                    IntelSnapshot.domain == domain,
                    IntelSnapshot.module_type == module_type,
                )
            )
            .order_by(desc(IntelSnapshot.version))
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    def compute_diff(
        self,
        old_snapshot: IntelSnapshot,
        new_snapshot: IntelSnapshot,
    ) -> Dict[str, Any]:
        """
        Compute the difference between two snapshots.

        The diff structure:
        {
            "added": {field: value},      # Fields in new but not old
            "removed": {field: value},    # Fields in old but not new
            "changed": {                  # Fields with different values
                field: {"old": value, "new": value}
            },
            "unchanged": [field_names]    # Fields with same values
        }

        Args:
            old_snapshot: The older snapshot
            new_snapshot: The newer snapshot

        Returns:
            Dict with added, removed, changed, and unchanged keys
        """
        old_data = old_snapshot.data or {}
        new_data = new_snapshot.data or {}

        old_keys = set(old_data.keys())
        new_keys = set(new_data.keys())

        # Added fields: in new but not in old
        added_keys = new_keys - old_keys
        added = {k: new_data[k] for k in added_keys}

        # Removed fields: in old but not in new
        removed_keys = old_keys - new_keys
        removed = {k: old_data[k] for k in removed_keys}

        # Changed and unchanged: in both
        common_keys = old_keys & new_keys
        changed = {}
        unchanged = []

        for key in common_keys:
            old_val = old_data[key]
            new_val = new_data[key]

            if self._values_equal(old_val, new_val):
                unchanged.append(key)
            else:
                changed[key] = {
                    "old": old_val,
                    "new": new_val,
                }

        return {
            "added": added,
            "removed": removed,
            "changed": changed,
            "unchanged": unchanged,
        }

    async def get_version_at(
        self,
        domain: str,
        module_type: str,
        timestamp: datetime,
    ) -> Optional[IntelSnapshot]:
        """
        Get the snapshot that was current at a specific timestamp.

        Returns the most recent snapshot with snapshot_at <= timestamp.

        Args:
            domain: Company domain
            module_type: Module identifier
            timestamp: The point in time to query

        Returns:
            IntelSnapshot if found, None if no snapshot existed at that time
        """
        query = (
            select(IntelSnapshot)
            .where(
                and_(
                    IntelSnapshot.domain == domain,
                    IntelSnapshot.module_type == module_type,
                    IntelSnapshot.snapshot_at <= timestamp,
                )
            )
            .order_by(desc(IntelSnapshot.snapshot_at))
            .limit(1)
        )

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    def _values_equal(self, val1: Any, val2: Any) -> bool:
        """
        Compare two values for equality.

        Handles nested dicts and lists properly.

        Args:
            val1: First value
            val2: Second value

        Returns:
            True if values are equal
        """
        # Handle None cases
        if val1 is None and val2 is None:
            return True
        if val1 is None or val2 is None:
            return False

        # Same type check
        if type(val1) != type(val2):
            return False

        # For dicts, compare recursively
        if isinstance(val1, dict):
            if set(val1.keys()) != set(val2.keys()):
                return False
            return all(
                self._values_equal(val1[k], val2[k])
                for k in val1.keys()
            )

        # For lists, compare elements
        if isinstance(val1, list):
            if len(val1) != len(val2):
                return False
            return all(
                self._values_equal(v1, v2)
                for v1, v2 in zip(val1, val2)
            )

        # Direct comparison for primitives
        return val1 == val2

    def _has_meaningful_changes(self, diff: Dict[str, Any]) -> bool:
        """
        Determine if the diff contains meaningful changes.

        Args:
            diff: The computed diff

        Returns:
            True if there are added, removed, or changed fields
        """
        return bool(diff["added"] or diff["removed"] or diff["changed"])

    def _count_changes(self, diff: Dict[str, Any]) -> int:
        """
        Count the total number of changes in a diff.

        Args:
            diff: The computed diff

        Returns:
            Total count of changed fields
        """
        return len(diff["added"]) + len(diff["removed"]) + len(diff["changed"])

    def _determine_significance(
        self,
        diff: Dict[str, Any],
        module_type: str,
    ) -> Optional[str]:
        """
        Determine the highest significance level of changes.

        Significance levels:
        - critical: Search provider removed, major exec change
        - high: CFO/CEO change, tech stack change
        - medium: Minor exec change, metric change
        - low: Theme change, minor updates

        Args:
            diff: The computed diff
            module_type: Module identifier for context

        Returns:
            Significance level string, or None if no changes
        """
        if not self._has_meaningful_changes(diff):
            return None

        # Check for critical changes
        if "search" in diff.get("removed", {}):
            return "critical"

        # Check changed fields for high-significance patterns
        changed = diff.get("changed", {})

        # Executive changes
        if "executives" in changed and module_type == "m09_executive":
            old_execs = changed["executives"]["old"]
            new_execs = changed["executives"]["new"]

            # Check for CFO/CEO changes (high significance)
            if self._has_c_level_change(old_execs, new_execs):
                return "high"
            return "medium"

        # Tech stack changes
        if module_type == "m02_tech_stack":
            if "search" in changed:
                return "critical"
            return "high"

        # Financial changes
        if module_type == "m04_financials":
            return "medium"

        # Hiring changes
        if module_type == "m06_hiring":
            return "medium"

        # Default to low for other changes
        return "low"

    def _has_c_level_change(
        self,
        old_execs: List[Dict],
        new_execs: List[Dict],
    ) -> bool:
        """
        Check if there's a C-level executive change.

        Args:
            old_execs: Old executives list
            new_execs: New executives list

        Returns:
            True if CFO or CEO changed
        """
        c_level_titles = ["ceo", "cfo", "coo", "cto", "cio", "cmo"]

        def get_c_level_names(execs):
            """Extract names of C-level execs."""
            result = {}
            for exec in execs:
                title = exec.get("title", "").lower()
                for c_title in c_level_titles:
                    if c_title in title:
                        result[c_title] = exec.get("name")
                        break
            return result

        old_c_level = get_c_level_names(old_execs)
        new_c_level = get_c_level_names(new_execs)

        # Check if any C-level changed
        for title in c_level_titles:
            old_name = old_c_level.get(title)
            new_name = new_c_level.get(title)

            if old_name and new_name and old_name != new_name:
                return True
            if old_name and not new_name:  # C-level left
                return True
            if not old_name and new_name:  # New C-level
                return True

        return False
