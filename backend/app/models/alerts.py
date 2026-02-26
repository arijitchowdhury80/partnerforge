"""
Alert Models - Rules, Notifications, and Digests

Tables:
- alert_rules: User-defined alert conditions
- alerts: Generated notifications
- alert_digests: Aggregated periodic digests
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, JSON,
    ForeignKey, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from ..database import Base


class AlertRule(Base):
    """
    User-defined alert rule.

    Example rules:
    - "Alert me when any account in my territory hits score > 85"
    - "Alert when Costco has any CRITICAL change"
    - "Alert when any target removes their search provider"
    """
    __tablename__ = "alert_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Who owns this rule
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Rule metadata
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    is_active = Column(Boolean, default=True)

    # Conditions (flexible JSON structure)
    conditions = Column(JSON, nullable=False)
    # Schema:
    # {
    #     "scope": "my_territory" | "all" | ["costco.com", "walmart.com"],
    #     "change_categories": ["EXECUTIVE_CHANGE", "TECH_STACK_CHANGE"],
    #     "min_significance": "HIGH",
    #     "score_threshold": {"field": "icp_score", "operator": "gt", "value": 80},
    #     "module_types": ["m09", "m02"]
    # }

    # How to notify
    channels = Column(JSON, default=["in_app"])
    # Options: "in_app", "email", "slack"

    # Timing
    frequency = Column(String(20), default="immediate")
    # Options: "immediate", "hourly_digest", "daily_digest"

    # Statistics
    trigger_count = Column(Integer, default=0)
    last_triggered = Column(DateTime)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="alert_rules")
    alerts = relationship("Alert", back_populates="rule", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_rules_user", "user_id"),
        Index("idx_rules_active", "is_active"),
    )


class Alert(Base):
    """
    Generated alert notification.

    Created when a change matches an alert rule.
    """
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Which rule triggered this (optional - system alerts have no rule)
    rule_id = Column(String(36), ForeignKey("alert_rules.id"))

    # Who should see this
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # What triggered it
    domain = Column(String(255), nullable=False, index=True)
    module_type = Column(String(50))
    snapshot_id = Column(String(36), ForeignKey("intel_snapshots.id"))

    # Alert content
    title = Column(String(255), nullable=False)
    summary = Column(String(1000))
    changes = Column(JSON)  # Array of change details
    significance = Column(String(20))  # Highest significance in changes

    # Action context
    recommended_action = Column(String(500))
    algolia_opportunity = Column(String(500))

    # Status tracking
    status = Column(String(20), default="unread")
    # Options: "unread", "read", "dismissed", "acted"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime)
    dismissed_at = Column(DateTime)
    acted_at = Column(DateTime)

    # Delivery tracking
    delivered_channels = Column(JSON, default=[])
    delivery_status = Column(JSON)  # {"email": "sent", "slack": "failed"}

    # Relationships
    rule = relationship("AlertRule", back_populates="alerts")
    user = relationship("User", back_populates="alerts")
    snapshot = relationship("IntelSnapshot")

    __table_args__ = (
        Index("idx_alerts_user", "user_id"),
        Index("idx_alerts_domain", "domain"),
        Index("idx_alerts_status", "status"),
        Index("idx_alerts_created", "created_at"),
        Index("idx_alerts_significance", "significance"),
    )


class AlertDigest(Base):
    """
    Aggregated alert digest.

    For users who prefer hourly or daily summaries instead of
    immediate notifications.
    """
    __tablename__ = "alert_digests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Digest period
    digest_type = Column(String(20), nullable=False)  # "hourly", "daily"
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)

    # Contents
    alert_count = Column(Integer, default=0)
    alert_ids = Column(JSON)  # List of included alert IDs

    # Summary by significance
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)

    # Summary by category
    summary_by_category = Column(JSON)
    # {"EXECUTIVE_CHANGE": 3, "TECH_STACK_CHANGE": 2}

    # Summary by domain
    summary_by_domain = Column(JSON)
    # {"costco.com": 2, "walmart.com": 1}

    # Rendered content (pre-computed for sending)
    html_content = Column(Text)
    text_content = Column(Text)

    # Delivery
    status = Column(String(20), default="pending")
    # Options: "pending", "sent", "failed"
    sent_at = Column(DateTime)
    error_message = Column(String(500))

    # Relationships
    user = relationship("User")

    __table_args__ = (
        Index("idx_digests_user", "user_id"),
        Index("idx_digests_period", "period_start", "period_end"),
        Index("idx_digests_status", "status"),
    )


class AlertPreference(Base):
    """
    User alert preferences.

    Global settings for how a user receives notifications.
    """
    __tablename__ = "alert_preferences"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)

    # Global settings
    alerts_enabled = Column(Boolean, default=True)
    email_enabled = Column(Boolean, default=True)
    slack_enabled = Column(Boolean, default=False)
    in_app_enabled = Column(Boolean, default=True)

    # Digest preferences
    digest_frequency = Column(String(20), default="daily")  # immediate, hourly, daily
    digest_time = Column(String(10), default="09:00")  # For daily digests

    # Quiet hours
    quiet_hours_enabled = Column(Boolean, default=False)
    quiet_hours_start = Column(String(10))  # "22:00"
    quiet_hours_end = Column(String(10))  # "08:00"
    quiet_hours_timezone = Column(String(50))  # "America/Los_Angeles"

    # Minimum significance to notify
    min_significance_email = Column(String(20), default="high")
    min_significance_slack = Column(String(20), default="critical")

    # Slack integration
    slack_channel_id = Column(String(50))
    slack_dm_enabled = Column(Boolean, default=True)

    # Relationships
    user = relationship("User", back_populates="alert_preferences")

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
