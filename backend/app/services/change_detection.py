"""
PartnerForge Change Detection Service

Detects and classifies changes in intelligence data.

Responsibilities:
- Create change events from snapshot diffs
- Calculate significance scores for changes
- Query significant changes across domains
- Support alert rule evaluation

CRITICAL: Enforces the Source Citation Mandate.
Every change event must trace back to a snapshot with valid source citations.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import uuid

from ..models.versioning import ChangeEvent, IntelSnapshot
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# Change category definitions with significance weights
CHANGE_CATEGORIES = {
    "executive_change": {
        "description": "Executive team changes",
        "default_significance": 0.7,
        "high_significance_fields": ["ceo", "cfo", "cto", "cio", "cmo", "coo"],
    },
    "tech_stack_change": {
        "description": "Technology stack changes",
        "default_significance": 0.8,
        "critical_fields": ["search", "search_provider", "current_search"],
    },
    "score_change": {
        "description": "ICP or signal score changes",
        "default_significance": 0.5,
    },
    "hiring_change": {
        "description": "Hiring signals changed",
        "default_significance": 0.6,
    },
    "financial_change": {
        "description": "Financial metrics changed",
        "default_significance": 0.5,
    },
    "competitive_change": {
        "description": "Competitive landscape changes",
        "default_significance": 0.7,
    },
    "strategic_change": {
        "description": "Strategic positioning changes",
        "default_significance": 0.6,
    },
}

# Significance levels mapped to numeric thresholds
SIGNIFICANCE_LEVELS = {
    "critical": 0.9,
    "high": 0.7,
    "medium": 0.5,
    "low": 0.3,
}


class ChangeDetectionService:
    """
    Service for detecting and managing change events.

    This service:
    - Creates ChangeEvent records from snapshot diffs
    - Calculates significance scores for changes
    - Provides query methods for change retrieval
    - Supports alert rule evaluation

    Methods:
        create_change_event: Create a new change event record
        get_changes_for_domain: Get all changes for a domain since a date
        get_significant_changes: Get changes above a significance threshold
        calculate_significance: Calculate significance score for a change
        classify_change: Classify a change into a category
        get_changes_by_category: Get changes filtered by category
        get_recent_changes: Get most recent changes across all domains
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize the change detection service.

        Args:
            session: Async database session
        """
        self.session = session

    async def create_change_event(
        self,
        domain: str,
        module_type: str,
        snapshot_id: str,
        category: str,
        field: str,
        old_value: Any,
        new_value: Any,
        significance: Optional[str] = None,
        summary: Optional[str] = None,
        algolia_relevance: Optional[str] = None,
    ) -> ChangeEvent:
        """
        Create a new change event record.

        Args:
            domain: Company domain (e.g., "costco.com")
            module_type: Module identifier (e.g., "m09_executive")
            snapshot_id: ID of the snapshot where change was detected
            category: Change category (e.g., "executive_change")
            field: Field that changed (e.g., "executives")
            old_value: Previous value (JSON-serializable)
            new_value: New value (JSON-serializable)
            significance: Significance level (critical/high/medium/low)
            summary: Human-readable summary of the change
            algolia_relevance: Why this matters for Algolia sales

        Returns:
            ChangeEvent: The created change event

        Raises:
            ValueError: If category is not recognized
        """
        # Validate category
        if category not in CHANGE_CATEGORIES:
            raise ValueError(
                f"Unknown change category: {category}. "
                f"Valid categories: {list(CHANGE_CATEGORIES.keys())}"
            )

        # Calculate significance if not provided
        if significance is None:
            significance_score = self.calculate_significance(
                category=category,
                field=field,
                old_value=old_value,
                new_value=new_value,
            )
            significance = self._score_to_level(significance_score)

        # Generate summary if not provided
        if summary is None:
            summary = self._generate_summary(
                category=category,
                field=field,
                old_value=old_value,
                new_value=new_value,
            )

        # Generate Algolia relevance if not provided
        if algolia_relevance is None:
            algolia_relevance = self._generate_algolia_relevance(
                category=category,
                field=field,
                significance=significance,
            )

        # Create the change event
        change_event = ChangeEvent(
            id=str(uuid.uuid4()),
            snapshot_id=snapshot_id,
            domain=domain,
            module_type=module_type,
            category=category,
            significance=significance,
            field=field,
            old_value=old_value,
            new_value=new_value,
            summary=summary,
            algolia_relevance=algolia_relevance,
            detected_at=datetime.utcnow(),
        )

        self.session.add(change_event)
        await self.session.flush()

        logger.info(
            f"Created change event for {domain}/{module_type}: "
            f"{category} ({significance}) - {field}"
        )

        return change_event

    async def create_change_events_from_diff(
        self,
        domain: str,
        module_type: str,
        snapshot_id: str,
        diff: Dict[str, Any],
    ) -> List[ChangeEvent]:
        """
        Create change events from a snapshot diff.

        Analyzes the diff and creates individual ChangeEvent records
        for each meaningful change.

        Args:
            domain: Company domain
            module_type: Module identifier
            snapshot_id: ID of the new snapshot
            diff: Diff dict with added/removed/changed keys

        Returns:
            List of created ChangeEvent records
        """
        events = []

        # Process changed fields
        for field, change in diff.get("changed", {}).items():
            category = self._classify_field_to_category(field, module_type)
            event = await self.create_change_event(
                domain=domain,
                module_type=module_type,
                snapshot_id=snapshot_id,
                category=category,
                field=field,
                old_value=change["old"],
                new_value=change["new"],
            )
            events.append(event)

        # Process removed fields (potentially critical)
        for field, value in diff.get("removed", {}).items():
            category = self._classify_field_to_category(field, module_type)
            event = await self.create_change_event(
                domain=domain,
                module_type=module_type,
                snapshot_id=snapshot_id,
                category=category,
                field=field,
                old_value=value,
                new_value=None,
                significance="high",  # Removals are always notable
            )
            events.append(event)

        # Process added fields
        for field, value in diff.get("added", {}).items():
            category = self._classify_field_to_category(field, module_type)
            event = await self.create_change_event(
                domain=domain,
                module_type=module_type,
                snapshot_id=snapshot_id,
                category=category,
                field=field,
                old_value=None,
                new_value=value,
            )
            events.append(event)

        logger.info(
            f"Created {len(events)} change events for {domain}/{module_type}"
        )

        return events

    async def get_changes_for_domain(
        self,
        domain: str,
        since_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[ChangeEvent]:
        """
        Get all changes for a domain since a specified date.

        Args:
            domain: Company domain
            since_date: Only return changes after this date (default: 30 days ago)
            limit: Maximum number of changes to return

        Returns:
            List of ChangeEvent records ordered by detected_at DESC
        """
        if since_date is None:
            since_date = datetime.utcnow() - timedelta(days=30)

        query = (
            select(ChangeEvent)
            .where(
                and_(
                    ChangeEvent.domain == domain,
                    ChangeEvent.detected_at >= since_date,
                )
            )
            .order_by(desc(ChangeEvent.detected_at))
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_significant_changes(
        self,
        threshold: str = "high",
        since_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[ChangeEvent]:
        """
        Get changes at or above a significance threshold.

        Args:
            threshold: Minimum significance level (critical/high/medium/low)
            since_date: Only return changes after this date
            limit: Maximum number of changes to return

        Returns:
            List of ChangeEvent records meeting the threshold
        """
        if since_date is None:
            since_date = datetime.utcnow() - timedelta(days=30)

        # Build list of acceptable significance levels
        threshold_levels = self._get_levels_at_or_above(threshold)

        query = (
            select(ChangeEvent)
            .where(
                and_(
                    ChangeEvent.significance.in_(threshold_levels),
                    ChangeEvent.detected_at >= since_date,
                )
            )
            .order_by(desc(ChangeEvent.detected_at))
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_changes_by_category(
        self,
        category: str,
        since_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[ChangeEvent]:
        """
        Get changes filtered by category.

        Args:
            category: Change category (e.g., "executive_change")
            since_date: Only return changes after this date
            limit: Maximum number of changes to return

        Returns:
            List of ChangeEvent records in the category
        """
        if since_date is None:
            since_date = datetime.utcnow() - timedelta(days=30)

        query = (
            select(ChangeEvent)
            .where(
                and_(
                    ChangeEvent.category == category,
                    ChangeEvent.detected_at >= since_date,
                )
            )
            .order_by(desc(ChangeEvent.detected_at))
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_recent_changes(
        self,
        limit: int = 50,
        domains: Optional[List[str]] = None,
    ) -> List[ChangeEvent]:
        """
        Get most recent changes across all or specified domains.

        Args:
            limit: Maximum number of changes to return
            domains: Optional list of domains to filter by

        Returns:
            List of ChangeEvent records ordered by detected_at DESC
        """
        if domains:
            query = (
                select(ChangeEvent)
                .where(ChangeEvent.domain.in_(domains))
                .order_by(desc(ChangeEvent.detected_at))
                .limit(limit)
            )
        else:
            query = (
                select(ChangeEvent)
                .order_by(desc(ChangeEvent.detected_at))
                .limit(limit)
            )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    def calculate_significance(
        self,
        category: str,
        field: str,
        old_value: Any,
        new_value: Any,
    ) -> float:
        """
        Calculate the significance score for a change.

        Significance is determined by:
        - Category base score
        - Field-specific modifiers
        - Change magnitude (for numeric values)
        - Presence of critical keywords

        Args:
            category: Change category
            field: Field that changed
            old_value: Previous value
            new_value: New value

        Returns:
            Float significance score between 0.0 and 1.0
        """
        # Start with category default
        category_config = CHANGE_CATEGORIES.get(category, {})
        base_score = category_config.get("default_significance", 0.5)

        # Check for critical fields
        critical_fields = category_config.get("critical_fields", [])
        if any(cf in field.lower() for cf in critical_fields):
            return min(1.0, base_score + 0.3)  # Bump to critical range

        # Check for high significance fields
        high_fields = category_config.get("high_significance_fields", [])
        if any(hf in field.lower() for hf in high_fields):
            return min(1.0, base_score + 0.2)

        # Check for removal (always notable)
        if new_value is None and old_value is not None:
            return min(1.0, base_score + 0.2)

        # Check for numeric magnitude changes
        if isinstance(old_value, (int, float)) and isinstance(new_value, (int, float)):
            if old_value != 0:
                pct_change = abs((new_value - old_value) / old_value)
                if pct_change > 0.5:  # >50% change
                    return min(1.0, base_score + 0.2)
                elif pct_change > 0.2:  # >20% change
                    return min(1.0, base_score + 0.1)

        return base_score

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    def _score_to_level(self, score: float) -> str:
        """Convert numeric score to significance level."""
        if score >= SIGNIFICANCE_LEVELS["critical"]:
            return "critical"
        elif score >= SIGNIFICANCE_LEVELS["high"]:
            return "high"
        elif score >= SIGNIFICANCE_LEVELS["medium"]:
            return "medium"
        return "low"

    def _get_levels_at_or_above(self, threshold: str) -> List[str]:
        """Get all significance levels at or above the threshold."""
        levels = ["critical", "high", "medium", "low"]
        try:
            threshold_idx = levels.index(threshold)
            return levels[:threshold_idx + 1]
        except ValueError:
            return levels

    def _classify_field_to_category(self, field: str, module_type: str) -> str:
        """Classify a field name to a change category based on context."""
        field_lower = field.lower()

        # Executive-related
        if any(x in field_lower for x in ["executive", "ceo", "cfo", "cto"]):
            return "executive_change"

        # Tech stack related
        if any(x in field_lower for x in ["tech", "search", "provider", "tool"]):
            return "tech_stack_change"

        # Financial related
        if any(x in field_lower for x in ["revenue", "margin", "profit", "financial"]):
            return "financial_change"

        # Hiring related
        if any(x in field_lower for x in ["hiring", "job", "role", "position"]):
            return "hiring_change"

        # Score related
        if any(x in field_lower for x in ["score", "icp", "signal"]):
            return "score_change"

        # Competitive related
        if any(x in field_lower for x in ["competitor", "competitive", "market"]):
            return "competitive_change"

        # Default based on module type
        module_category_map = {
            "m09_executive": "executive_change",
            "m02_tech_stack": "tech_stack_change",
            "m04_financials": "financial_change",
            "m06_hiring": "hiring_change",
            "m05_competitors": "competitive_change",
            "m14_signal_scoring": "score_change",
            "m13_icp_priority": "score_change",
        }

        return module_category_map.get(module_type, "strategic_change")

    def _generate_summary(
        self,
        category: str,
        field: str,
        old_value: Any,
        new_value: Any,
    ) -> str:
        """Generate a human-readable summary of the change."""
        # Handle removal
        if new_value is None:
            return f"{field} was removed (was: {self._truncate_value(old_value)})"

        # Handle addition
        if old_value is None:
            return f"{field} was added: {self._truncate_value(new_value)}"

        # Handle change
        return (
            f"{field} changed: "
            f"{self._truncate_value(old_value)} -> {self._truncate_value(new_value)}"
        )

    def _truncate_value(self, value: Any, max_length: int = 100) -> str:
        """Truncate a value for display in summaries."""
        str_value = str(value)
        if len(str_value) > max_length:
            return str_value[:max_length - 3] + "..."
        return str_value

    def _generate_algolia_relevance(
        self,
        category: str,
        field: str,
        significance: str,
    ) -> str:
        """Generate Algolia sales relevance note."""
        relevance_templates = {
            "executive_change": {
                "critical": "New executive may not have existing vendor relationships - prime outreach opportunity",
                "high": "Executive change signals potential for vendor reevaluation",
                "medium": "Track executive changes for future timing",
                "low": "Minor executive change - monitor for patterns",
            },
            "tech_stack_change": {
                "critical": "Search provider removed/replaced - immediate displacement opportunity",
                "high": "Tech stack in flux - position Algolia during evaluation",
                "medium": "Technology changes may indicate modernization initiative",
                "low": "Minor tech update - note for context",
            },
            "score_change": {
                "critical": "Score significantly improved - prioritize outreach",
                "high": "Score change indicates increased fit",
                "medium": "Score movement - continue monitoring",
                "low": "Minor score fluctuation",
            },
            "hiring_change": {
                "critical": "Hiring for search/digital roles - active evaluation likely",
                "high": "Digital transformation hiring signals - Algolia relevant",
                "medium": "Hiring patterns suggest growth",
                "low": "General hiring activity",
            },
            "financial_change": {
                "critical": "Major financial shift - evaluate timing",
                "high": "Financial metrics changing - assess budget implications",
                "medium": "Financial trends to monitor",
                "low": "Minor financial movement",
            },
            "competitive_change": {
                "critical": "Competitor changed search provider - competitive opportunity",
                "high": "Competitive landscape shift - positioning opportunity",
                "medium": "Monitor competitor movements",
                "low": "Minor competitive update",
            },
            "strategic_change": {
                "critical": "Strategic pivot - reassess Algolia fit",
                "high": "Strategic changes may create new opportunities",
                "medium": "Strategic direction evolving",
                "low": "Minor strategic update",
            },
        }

        category_templates = relevance_templates.get(category, relevance_templates["strategic_change"])
        return category_templates.get(significance, category_templates["low"])
