"""
Pydantic Schemas for Change Tracking Operations

Request/Response models for change history and detection endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any, List, Dict
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class ChangeSignificance(str, Enum):
    """Significance level of a change."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ChangeCategory(str, Enum):
    """Category of change."""
    EXECUTIVE_CHANGE = "executive_change"
    TECH_STACK_CHANGE = "tech_stack_change"
    SCORE_CHANGE = "score_change"
    HIRING_CHANGE = "hiring_change"
    FINANCIAL_CHANGE = "financial_change"
    COMPETITIVE_CHANGE = "competitive_change"
    STRATEGIC_CHANGE = "strategic_change"


# =============================================================================
# Change Event Schemas
# =============================================================================

class ChangeEventResponse(BaseModel):
    """Response for a single change event."""
    id: str = Field(..., description="Change event ID")
    snapshot_id: str = Field(..., description="Snapshot that detected this change")
    domain: str = Field(..., description="Domain that changed")
    module_type: str = Field(..., description="Module that detected the change")

    # Classification
    category: ChangeCategory = Field(..., description="Change category")
    significance: ChangeSignificance = Field(..., description="Change significance")

    # Change details
    field: str = Field(..., description="Field that changed")
    old_value: Optional[Any] = Field(None, description="Previous value")
    new_value: Optional[Any] = Field(None, description="New value")
    summary: str = Field(..., description="Human-readable summary")

    # Algolia context
    algolia_relevance: Optional[str] = Field(None, description="Why this matters for Algolia")

    # Metadata
    detected_at: datetime = Field(..., description="Detection timestamp")

    class Config:
        from_attributes = True


class ChangeHistoryResponse(BaseModel):
    """Change history for a domain."""
    domain: str = Field(..., description="Domain")
    company_name: Optional[str] = Field(None, description="Company name")

    # Changes
    changes: List[ChangeEventResponse] = Field(..., description="Change events")
    total: int = Field(..., description="Total changes")

    # Summary
    critical_count: int = Field(0, description="Critical changes")
    high_count: int = Field(0, description="High significance changes")
    medium_count: int = Field(0, description="Medium significance changes")
    low_count: int = Field(0, description="Low significance changes")

    # By category
    by_category: Dict[str, int] = Field(
        default_factory=dict,
        description="Change count by category"
    )

    # Time range
    earliest_change: Optional[datetime] = Field(None, description="Earliest change")
    latest_change: Optional[datetime] = Field(None, description="Latest change")

    # Pagination
    page: int = Field(1, description="Current page")
    limit: int = Field(50, description="Items per page")
    total_pages: int = Field(1, description="Total pages")


class SignificantChangeResponse(BaseModel):
    """Significant changes for a domain (filtered to high/critical)."""
    domain: str = Field(..., description="Domain")
    company_name: Optional[str] = Field(None, description="Company name")

    # Only significant changes
    changes: List[ChangeEventResponse] = Field(..., description="Significant changes")
    total: int = Field(..., description="Total significant changes")

    # Summary
    critical_count: int = Field(0, description="Critical changes")
    high_count: int = Field(0, description="High significance changes")

    # Algolia opportunities
    opportunities: List[str] = Field(
        default_factory=list,
        description="Algolia opportunities identified from changes"
    )

    # Recommended actions
    recommended_actions: List[str] = Field(
        default_factory=list,
        description="Recommended follow-up actions"
    )


# =============================================================================
# Recent Changes Schemas
# =============================================================================

class RecentChangeItem(BaseModel):
    """A change item with domain context."""
    change: ChangeEventResponse = Field(..., description="The change event")
    domain: str = Field(..., description="Domain")
    company_name: Optional[str] = Field(None, description="Company name")
    icp_score: Optional[int] = Field(None, description="Current ICP score")
    icp_tier: Optional[str] = Field(None, description="ICP tier (hot/warm/cool/cold)")


class RecentChangesResponse(BaseModel):
    """Recent changes across all domains."""
    changes: List[RecentChangeItem] = Field(..., description="Recent changes with context")
    total: int = Field(..., description="Total changes in period")

    # Summary
    domains_affected: int = Field(..., description="Number of domains with changes")
    critical_count: int = Field(0, description="Critical changes")
    high_count: int = Field(0, description="High significance changes")

    # By category
    by_category: Dict[str, int] = Field(
        default_factory=dict,
        description="Changes by category"
    )

    # By domain (top N)
    top_domains: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Domains with most changes"
    )

    # Time range
    period_start: datetime = Field(..., description="Period start")
    period_end: datetime = Field(..., description="Period end")

    # Pagination
    page: int = Field(1, description="Current page")
    limit: int = Field(50, description="Items per page")
    total_pages: int = Field(1, description="Total pages")


# =============================================================================
# Snapshot Comparison Schemas
# =============================================================================

class SnapshotDiff(BaseModel):
    """Diff between two snapshots."""
    added: Dict[str, Any] = Field(default_factory=dict, description="Added fields")
    removed: Dict[str, Any] = Field(default_factory=dict, description="Removed fields")
    changed: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Changed fields with old/new values"
    )
    unchanged: List[str] = Field(default_factory=list, description="Unchanged fields")


class SnapshotComparisonResponse(BaseModel):
    """Response for comparing two snapshots."""
    domain: str = Field(..., description="Domain")
    module_type: str = Field(..., description="Module type")

    # Snapshot info
    snapshot_old_id: str = Field(..., description="Older snapshot ID")
    snapshot_new_id: str = Field(..., description="Newer snapshot ID")
    version_old: int = Field(..., description="Older version number")
    version_new: int = Field(..., description="Newer version number")

    # Time info
    old_snapshot_at: datetime = Field(..., description="Older snapshot timestamp")
    new_snapshot_at: datetime = Field(..., description="Newer snapshot timestamp")

    # Diff
    diff: SnapshotDiff = Field(..., description="Detailed diff")

    # Summary
    total_changes: int = Field(..., description="Total fields changed")
    highest_significance: Optional[ChangeSignificance] = Field(
        None, description="Highest significance of changes"
    )

    # Change events
    change_events: List[ChangeEventResponse] = Field(
        default_factory=list,
        description="Individual change events"
    )


# =============================================================================
# Change Analytics Schemas
# =============================================================================

class ChangeAnalyticsResponse(BaseModel):
    """Analytics about changes over time."""
    period_start: datetime = Field(..., description="Analysis period start")
    period_end: datetime = Field(..., description="Analysis period end")

    # Overall stats
    total_changes: int = Field(..., description="Total changes detected")
    domains_with_changes: int = Field(..., description="Domains with changes")

    # By significance
    by_significance: Dict[str, int] = Field(
        default_factory=dict,
        description="Changes by significance"
    )

    # By category
    by_category: Dict[str, int] = Field(
        default_factory=dict,
        description="Changes by category"
    )

    # By module
    by_module: Dict[str, int] = Field(
        default_factory=dict,
        description="Changes by module"
    )

    # Trends (daily counts)
    daily_counts: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Daily change counts"
    )

    # Top movers
    top_domains_by_changes: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Domains with most changes"
    )

    # Opportunities
    high_opportunity_changes: int = Field(
        0,
        description="Changes that indicate high Algolia opportunity"
    )
