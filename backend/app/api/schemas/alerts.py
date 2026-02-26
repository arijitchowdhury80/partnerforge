"""
Pydantic Schemas for Alert Operations

Request/Response models for alert management endpoints.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, List, Dict
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class AlertStatus(str, Enum):
    """Status of an alert."""
    UNREAD = "unread"
    READ = "read"
    DISMISSED = "dismissed"
    ACTED = "acted"


class AlertSignificance(str, Enum):
    """Significance level of an alert."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AlertChannel(str, Enum):
    """Notification channel."""
    IN_APP = "in_app"
    EMAIL = "email"
    SLACK = "slack"


class AlertFrequency(str, Enum):
    """Alert delivery frequency."""
    IMMEDIATE = "immediate"
    HOURLY_DIGEST = "hourly_digest"
    DAILY_DIGEST = "daily_digest"


class AlertScope(str, Enum):
    """Scope for alert rules."""
    MY_TERRITORY = "my_territory"
    MY_TEAM = "my_team"
    ALL = "all"
    SPECIFIC_DOMAINS = "specific_domains"


class ChangeCategory(str, Enum):
    """Categories of changes that can trigger alerts."""
    EXECUTIVE_CHANGE = "executive_change"
    TECH_STACK_CHANGE = "tech_stack_change"
    SCORE_CHANGE = "score_change"
    HIRING_CHANGE = "hiring_change"
    FINANCIAL_CHANGE = "financial_change"
    COMPETITIVE_CHANGE = "competitive_change"
    STRATEGIC_CHANGE = "strategic_change"


# =============================================================================
# Alert Rule Schemas
# =============================================================================

class AlertRuleConditions(BaseModel):
    """Conditions for an alert rule."""
    scope: AlertScope = Field(
        AlertScope.MY_TERRITORY,
        description="Scope of accounts to monitor"
    )
    domains: Optional[List[str]] = Field(
        None,
        description="Specific domains (required if scope is SPECIFIC_DOMAINS)"
    )
    change_categories: List[ChangeCategory] = Field(
        ...,
        min_length=1,
        description="Categories of changes to alert on"
    )
    min_significance: AlertSignificance = Field(
        AlertSignificance.HIGH,
        description="Minimum significance to trigger alert"
    )
    additional_filters: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional filters (e.g., icp_score_gt, vertical_in)"
    )
    module_types: Optional[List[str]] = Field(
        None,
        description="Specific modules to monitor"
    )

    @field_validator("domains")
    @classmethod
    def validate_domains_scope(cls, v, info):
        """Validate domains required for SPECIFIC_DOMAINS scope."""
        # Note: validation context not available in Pydantic V2 field_validator
        # This would need to be a model_validator for cross-field validation
        return v


class AlertRuleCreate(BaseModel):
    """Request to create an alert rule."""
    name: str = Field(..., min_length=1, max_length=255, description="Rule name")
    description: Optional[str] = Field(None, max_length=500, description="Rule description")
    conditions: AlertRuleConditions = Field(..., description="Alert conditions")
    channels: List[AlertChannel] = Field(
        [AlertChannel.IN_APP],
        description="Notification channels"
    )
    frequency: AlertFrequency = Field(
        AlertFrequency.IMMEDIATE,
        description="Delivery frequency"
    )
    is_active: bool = Field(True, description="Whether rule is active")


class AlertRuleUpdate(BaseModel):
    """Request to update an alert rule."""
    name: Optional[str] = Field(None, max_length=255, description="Rule name")
    description: Optional[str] = Field(None, max_length=500, description="Rule description")
    conditions: Optional[AlertRuleConditions] = Field(None, description="Alert conditions")
    channels: Optional[List[AlertChannel]] = Field(None, description="Notification channels")
    frequency: Optional[AlertFrequency] = Field(None, description="Delivery frequency")
    is_active: Optional[bool] = Field(None, description="Whether rule is active")


class AlertRuleResponse(BaseModel):
    """Response for an alert rule."""
    id: str = Field(..., description="Rule ID")
    user_id: str = Field(..., description="Owner user ID")
    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(None, description="Rule description")
    is_active: bool = Field(..., description="Whether rule is active")
    conditions: Dict[str, Any] = Field(..., description="Alert conditions")
    channels: List[str] = Field(..., description="Notification channels")
    frequency: str = Field(..., description="Delivery frequency")
    trigger_count: int = Field(0, description="Number of times triggered")
    last_triggered: Optional[datetime] = Field(None, description="Last trigger time")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class AlertRuleListResponse(BaseModel):
    """List of alert rules."""
    rules: List[AlertRuleResponse] = Field(..., description="Alert rules")
    total: int = Field(..., description="Total rules")
    active_count: int = Field(..., description="Active rules count")


# =============================================================================
# Alert Schemas
# =============================================================================

class AlertChangeDetail(BaseModel):
    """Details of a change that triggered an alert."""
    field: str = Field(..., description="Field that changed")
    old_value: Optional[Any] = Field(None, description="Previous value")
    new_value: Optional[Any] = Field(None, description="New value")
    category: ChangeCategory = Field(..., description="Change category")
    significance: AlertSignificance = Field(..., description="Change significance")
    summary: str = Field(..., description="Human-readable summary")


class AlertResponse(BaseModel):
    """Response for a single alert."""
    id: str = Field(..., description="Alert ID")
    rule_id: Optional[str] = Field(None, description="Rule that triggered this")
    user_id: str = Field(..., description="Owner user ID")

    # What triggered it
    domain: str = Field(..., description="Domain that changed")
    module_type: Optional[str] = Field(None, description="Module that detected change")

    # Content
    title: str = Field(..., description="Alert title")
    summary: Optional[str] = Field(None, description="Alert summary")
    changes: List[AlertChangeDetail] = Field(default_factory=list, description="Change details")
    significance: AlertSignificance = Field(..., description="Highest significance")

    # Actions
    recommended_action: Optional[str] = Field(None, description="Recommended action")
    algolia_opportunity: Optional[str] = Field(None, description="Algolia opportunity")

    # Status
    status: AlertStatus = Field(..., description="Alert status")
    created_at: datetime = Field(..., description="Creation timestamp")
    read_at: Optional[datetime] = Field(None, description="Read timestamp")
    dismissed_at: Optional[datetime] = Field(None, description="Dismissed timestamp")
    acted_at: Optional[datetime] = Field(None, description="Acted timestamp")

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    """Paginated list of alerts."""
    alerts: List[AlertResponse] = Field(..., description="Alerts")
    total: int = Field(..., description="Total alerts")
    unread_count: int = Field(..., description="Unread alerts count")
    pagination: Dict[str, int] = Field(..., description="Pagination info")


class AlertMarkReadRequest(BaseModel):
    """Request to mark alerts as read."""
    alert_ids: Optional[List[str]] = Field(
        None,
        description="Specific alert IDs (None = mark all as read)"
    )


class AlertMarkReadResponse(BaseModel):
    """Response from marking alerts as read."""
    marked_count: int = Field(..., description="Number of alerts marked")
    remaining_unread: int = Field(..., description="Remaining unread alerts")


# =============================================================================
# Alert Digest Schemas
# =============================================================================

class DigestSummaryByCategory(BaseModel):
    """Summary of alerts by category."""
    category: ChangeCategory = Field(..., description="Change category")
    count: int = Field(..., description="Number of alerts")
    domains: List[str] = Field(..., description="Affected domains")
    highest_significance: AlertSignificance = Field(..., description="Highest significance")


class DigestSummaryByDomain(BaseModel):
    """Summary of alerts by domain."""
    domain: str = Field(..., description="Domain")
    company_name: Optional[str] = Field(None, description="Company name")
    alert_count: int = Field(..., description="Number of alerts")
    highest_significance: AlertSignificance = Field(..., description="Highest significance")
    categories: List[ChangeCategory] = Field(..., description="Change categories")


class AlertDigestResponse(BaseModel):
    """Alert digest summary."""
    digest_id: str = Field(..., description="Digest ID")
    user_id: str = Field(..., description="User ID")
    digest_type: str = Field(..., description="Digest type (hourly/daily)")
    period_start: datetime = Field(..., description="Period start")
    period_end: datetime = Field(..., description="Period end")

    # Counts
    total_alerts: int = Field(..., description="Total alerts in period")
    critical_count: int = Field(..., description="Critical alerts")
    high_count: int = Field(..., description="High significance alerts")
    medium_count: int = Field(..., description="Medium significance alerts")

    # Summaries
    by_category: List[DigestSummaryByCategory] = Field(
        ..., description="Summary by category"
    )
    by_domain: List[DigestSummaryByDomain] = Field(
        ..., description="Summary by domain"
    )

    # Top alerts
    top_alerts: List[AlertResponse] = Field(
        ..., description="Most important alerts"
    )

    # Metadata
    generated_at: datetime = Field(..., description="Generation timestamp")


# =============================================================================
# Alert Preference Schemas
# =============================================================================

class AlertPreferenceUpdate(BaseModel):
    """Request to update alert preferences."""
    alerts_enabled: Optional[bool] = Field(None, description="Enable/disable all alerts")
    email_enabled: Optional[bool] = Field(None, description="Enable email notifications")
    slack_enabled: Optional[bool] = Field(None, description="Enable Slack notifications")
    in_app_enabled: Optional[bool] = Field(None, description="Enable in-app notifications")
    digest_frequency: Optional[AlertFrequency] = Field(None, description="Digest frequency")
    digest_time: Optional[str] = Field(None, description="Daily digest time (HH:MM)")
    quiet_hours_enabled: Optional[bool] = Field(None, description="Enable quiet hours")
    quiet_hours_start: Optional[str] = Field(None, description="Quiet hours start (HH:MM)")
    quiet_hours_end: Optional[str] = Field(None, description="Quiet hours end (HH:MM)")
    quiet_hours_timezone: Optional[str] = Field(None, description="Timezone for quiet hours")
    min_significance_email: Optional[AlertSignificance] = Field(
        None, description="Minimum significance for email"
    )
    min_significance_slack: Optional[AlertSignificance] = Field(
        None, description="Minimum significance for Slack"
    )


class AlertPreferenceResponse(BaseModel):
    """Response for alert preferences."""
    user_id: str = Field(..., description="User ID")
    alerts_enabled: bool = Field(..., description="Alerts enabled")
    email_enabled: bool = Field(..., description="Email enabled")
    slack_enabled: bool = Field(..., description="Slack enabled")
    in_app_enabled: bool = Field(..., description="In-app enabled")
    digest_frequency: str = Field(..., description="Digest frequency")
    digest_time: Optional[str] = Field(None, description="Daily digest time")
    quiet_hours_enabled: bool = Field(..., description="Quiet hours enabled")
    quiet_hours_start: Optional[str] = Field(None, description="Quiet hours start")
    quiet_hours_end: Optional[str] = Field(None, description="Quiet hours end")
    quiet_hours_timezone: Optional[str] = Field(None, description="Quiet hours timezone")
    min_significance_email: str = Field(..., description="Min significance for email")
    min_significance_slack: str = Field(..., description="Min significance for Slack")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True
