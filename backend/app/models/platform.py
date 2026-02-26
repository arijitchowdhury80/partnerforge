"""
Platform Models - Users, Teams, Territories, API Costs, Audit

Tables:
- users: User accounts
- teams: Team groupings
- territories: Sales territories
- account_assignments: Account ownership
- api_usage: API call tracking and cost
- api_budgets: Budget limits
- audit_log: Audit trail
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, JSON,
    ForeignKey, Index, UniqueConstraint, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
import uuid

from ..database import Base


# =============================================================================
# Enums
# =============================================================================

class UserRole(str, Enum):
    """User role for access control."""
    ADMIN = "admin"         # Full access, can delete, manage users
    MANAGER = "manager"     # Can see team's accounts, manage team
    AE = "ae"               # Account Executive - assigned accounts
    SDR = "sdr"             # Sales Dev Rep - limited intel access
    SE = "se"               # Sales Engineer - technical view
    VIEWER = "viewer"       # Read-only access


class AccountRole(str, Enum):
    """User's role on a specific account."""
    OWNER = "owner"         # Primary owner
    TEAM_MEMBER = "team_member"  # Can view and contribute
    VIEWER = "viewer"       # Read-only


# =============================================================================
# User & Team Models
# =============================================================================

class User(Base):
    """
    User account.

    Represents a sales user who can view and manage accounts.
    """
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Identity
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    avatar_url = Column(String(500))

    # Role & access
    role = Column(String(20), default=UserRole.AE.value)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    # Team membership
    team_id = Column(String(36), ForeignKey("teams.id"))

    # Settings
    timezone = Column(String(50), default="America/Los_Angeles")
    notification_settings = Column(JSON, default={})

    # Authentication (for future SSO)
    auth_provider = Column(String(50))  # "google", "okta", "saml"
    auth_provider_id = Column(String(255))
    last_login = Column(DateTime)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    team = relationship("Team", back_populates="members")
    account_assignments = relationship("AccountAssignment", back_populates="user")
    alert_rules = relationship("AlertRule", back_populates="user")
    alerts = relationship("Alert", back_populates="user")
    alert_preferences = relationship("AlertPreference", back_populates="user", uselist=False)

    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_team", "team_id"),
        Index("idx_users_active", "is_active"),
    )


class Team(Base):
    """
    Sales team.

    Groups users for territory and account management.
    """
    __tablename__ = "teams"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    name = Column(String(255), nullable=False)
    description = Column(String(500))

    # Manager
    manager_id = Column(String(36), ForeignKey("users.id"))

    # Team settings
    default_territory_id = Column(String(36), ForeignKey("territories.id"))

    # Budget
    monthly_api_budget_usd = Column(Float, default=1000.0)
    current_month_spend_usd = Column(Float, default=0.0)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members = relationship("User", back_populates="team", foreign_keys=[User.team_id])
    manager = relationship("User", foreign_keys=[manager_id])
    territories = relationship("Territory", back_populates="team")

    __table_args__ = (
        Index("idx_teams_name", "name"),
    )


class Territory(Base):
    """
    Sales territory.

    Defines a geographic or segment-based grouping of accounts.
    """
    __tablename__ = "territories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    name = Column(String(255), nullable=False)
    description = Column(String(500))

    # Team ownership
    team_id = Column(String(36), ForeignKey("teams.id"))

    # Territory definition (filters)
    filters = Column(JSON)
    # Schema:
    # {
    #     "regions": ["US-West", "US-Central"],
    #     "countries": ["US", "CA"],
    #     "verticals": ["Retail", "Marketplace"],
    #     "min_icp_score": 60,
    #     "partner_techs": ["Adobe AEM"]
    # }

    # Coverage
    account_count = Column(Integer, default=0)
    hot_lead_count = Column(Integer, default=0)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    team = relationship("Team", back_populates="territories")
    account_assignments = relationship("AccountAssignment", back_populates="territory")

    __table_args__ = (
        Index("idx_territories_team", "team_id"),
    )


class AccountAssignment(Base):
    """
    Account ownership assignment.

    Links accounts to users with specific roles.
    """
    __tablename__ = "account_assignments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # The account
    domain = Column(String(255), nullable=False, index=True)

    # The user
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Role on this account
    role = Column(String(20), default=AccountRole.OWNER.value)

    # Territory
    territory_id = Column(String(36), ForeignKey("territories.id"))

    # Assignment details
    assigned_at = Column(DateTime, default=datetime.utcnow)
    assigned_by = Column(String(36), ForeignKey("users.id"))

    # Activity tracking
    last_viewed = Column(DateTime)
    last_enriched = Column(DateTime)
    notes = Column(Text)

    # Relationships
    user = relationship("User", back_populates="account_assignments", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])
    territory = relationship("Territory", back_populates="account_assignments")

    __table_args__ = (
        UniqueConstraint("domain", "user_id", name="uq_account_user"),
        Index("idx_assignments_domain", "domain"),
        Index("idx_assignments_user", "user_id"),
        Index("idx_assignments_territory", "territory_id"),
    )


# =============================================================================
# API Usage & Cost Tracking
# =============================================================================

class APIUsage(Base):
    """
    API call tracking.

    Records every external API call for cost tracking and debugging.
    """
    __tablename__ = "api_usage"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # What was called
    provider = Column(String(50), nullable=False)  # builtwith, similarweb, yahoo_finance
    endpoint = Column(String(100), nullable=False)
    method = Column(String(10), default="GET")

    # Request context
    domain = Column(String(255))  # Which domain this was for
    job_id = Column(String(36))  # Which enrichment job
    module_type = Column(String(50))  # Which module

    # Who triggered it
    user_id = Column(String(36), ForeignKey("users.id"))
    team_id = Column(String(36), ForeignKey("teams.id"))
    triggered_by = Column(String(50), default="system")  # "system", "user", "scheduled"

    # Cost
    cost_usd = Column(Float, default=0.0)
    cost_credits = Column(Float, default=0.0)

    # Response
    status_code = Column(Integer)
    response_time_ms = Column(Integer)
    success = Column(Boolean, default=True)
    error_message = Column(String(500))

    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User")
    team = relationship("Team")

    __table_args__ = (
        Index("idx_usage_provider", "provider"),
        Index("idx_usage_domain", "domain"),
        Index("idx_usage_timestamp", "timestamp"),
        Index("idx_usage_team", "team_id"),
    )


class APIBudget(Base):
    """
    API budget configuration and tracking.

    Sets limits on API spending per team/user.
    """
    __tablename__ = "api_budgets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Scope
    scope_type = Column(String(20), nullable=False)  # "team", "user", "global"
    scope_id = Column(String(36))  # team_id or user_id

    # Budget period
    period = Column(String(20), default="monthly")  # "daily", "monthly"
    period_start = Column(DateTime)
    period_end = Column(DateTime)

    # Limits
    budget_usd = Column(Float, nullable=False)
    alert_threshold_pct = Column(Integer, default=80)  # Alert at 80%
    hard_cap = Column(Boolean, default=True)  # Block at 100%

    # Current usage
    current_spend_usd = Column(Float, default=0.0)
    current_call_count = Column(Integer, default=0)

    # Per-provider breakdown
    spend_by_provider = Column(JSON, default={})
    # {"builtwith": 45.50, "similarweb": 23.20}

    # Alerts
    alert_sent_50 = Column(Boolean, default=False)
    alert_sent_80 = Column(Boolean, default=False)
    alert_sent_100 = Column(Boolean, default=False)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_budget_scope", "scope_type", "scope_id"),
        Index("idx_budget_period", "period_start", "period_end"),
    )


class APICostConfig(Base):
    """
    API cost configuration.

    Defines cost per API endpoint for budget tracking.
    """
    __tablename__ = "api_cost_config"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    provider = Column(String(50), nullable=False)
    endpoint = Column(String(100), nullable=False)

    # Cost
    cost_per_call_usd = Column(Float, nullable=False)
    cost_per_credit = Column(Float, default=1.0)

    # Rate limits
    rate_limit_rpm = Column(Integer)  # Requests per minute
    rate_limit_daily = Column(Integer)  # Requests per day

    # Status
    is_active = Column(Boolean, default=True)

    # Metadata
    effective_from = Column(DateTime, default=datetime.utcnow)
    notes = Column(String(500))

    __table_args__ = (
        UniqueConstraint("provider", "endpoint", name="uq_cost_config"),
        Index("idx_cost_provider", "provider"),
    )


# =============================================================================
# Audit Log
# =============================================================================

class AuditLog(Base):
    """
    Audit trail for compliance and debugging.

    Records all significant actions in the system.
    """
    __tablename__ = "audit_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Who
    user_id = Column(String(36), ForeignKey("users.id"))
    user_email = Column(String(255))  # Denormalized for fast access

    # What
    action = Column(String(100), nullable=False)
    # Examples: "enrichment.triggered", "account.viewed", "brief.exported",
    # "alert_rule.created", "user.login", "api.called"

    # On what
    resource_type = Column(String(50))  # "company", "intel", "brief", "user"
    resource_id = Column(String(255))  # Domain, record ID, etc.

    # Details
    details = Column(JSON)
    # {
    #     "domain": "costco.com",
    #     "modules": ["m01", "m02"],
    #     "previous_value": {...},
    #     "new_value": {...}
    # }

    # Context
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    session_id = Column(String(100))

    # Status
    status = Column(String(20), default="success")  # success, failure, partial
    error_message = Column(String(500))

    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_action", "action"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
        Index("idx_audit_timestamp", "timestamp"),
    )


# =============================================================================
# Observability
# =============================================================================

class SystemMetric(Base):
    """
    System metrics for observability.

    Stores time-series metrics for dashboards and alerting.
    """
    __tablename__ = "system_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Metric identification
    metric_name = Column(String(100), nullable=False)
    # Examples: "enrichment.duration", "api.error_rate", "queue.depth"

    metric_type = Column(String(20), nullable=False)
    # "counter", "gauge", "histogram"

    # Labels (dimensions)
    labels = Column(JSON, default={})
    # {"module": "m01", "provider": "builtwith", "status": "success"}

    # Value
    value = Column(Float, nullable=False)

    # For histograms
    bucket = Column(String(50))  # "le_100", "le_500", "le_1000"

    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("idx_metrics_name", "metric_name"),
        Index("idx_metrics_timestamp", "timestamp"),
        Index("idx_metrics_name_time", "metric_name", "timestamp"),
    )


class JobExecution(Base):
    """
    Job execution tracking.

    Tracks enrichment jobs for observability and debugging.
    """
    __tablename__ = "job_executions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Job identification
    job_type = Column(String(50), nullable=False)
    # "full_enrichment", "wave_enrichment", "module_enrichment", "batch_enrichment"

    domain = Column(String(255))  # For single-domain jobs
    batch_domains = Column(JSON)  # For batch jobs

    # Configuration
    modules = Column(JSON)  # Which modules to run
    waves = Column(JSON)  # Which waves to run
    force = Column(Boolean, default=False)

    # Execution
    status = Column(String(20), default="queued")
    # "queued", "running", "completed", "failed", "cancelled"

    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Float)

    # Progress
    total_steps = Column(Integer)
    completed_steps = Column(Integer)
    current_step = Column(String(100))

    # Results
    modules_completed = Column(JSON, default=[])
    modules_failed = Column(JSON, default=[])
    error_message = Column(Text)

    # Context
    triggered_by = Column(String(255))  # User email or "system"
    trigger_source = Column(String(50))  # "api", "ui", "scheduled", "webhook"

    # Checkpointing (for resume)
    checkpoint = Column(JSON)
    # {"completed_modules": ["m01", "m02"], "wave_results": {...}}

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_jobs_domain", "domain"),
        Index("idx_jobs_status", "status"),
        Index("idx_jobs_created", "created_at"),
    )
