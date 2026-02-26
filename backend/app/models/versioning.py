"""
Versioning Models - Snapshot Storage and Change Tracking

Tables:
- intel_snapshots: Point-in-time snapshots of intelligence data
- change_events: Detected changes with significance classification
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, JSON,
    ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional, Dict, Any
import uuid

from ..database import Base


class IntelSnapshot(Base):
    """
    Point-in-time snapshot of intelligence data.

    Every time a module enriches a domain, we capture a full snapshot
    before overwriting the current record. This enables:
    - "What changed since last time?"
    - Historical trends
    - Audit trail
    """
    __tablename__ = "intel_snapshots"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # What this is a snapshot of
    module_type = Column(String(50), nullable=False)  # m01, m02, ..., m15
    domain = Column(String(255), nullable=False, index=True)
    record_id = Column(Integer)  # FK to the main intel table

    # Version tracking
    version = Column(Integer, nullable=False)
    snapshot_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    snapshot_type = Column(String(20), default="auto")  # auto, manual, pre_update

    # The actual data (full snapshot)
    data = Column(JSON, nullable=False)

    # Source info preserved from the enrichment
    source_url = Column(String(1000))
    source_date = Column(DateTime)

    # Enrichment context
    job_id = Column(String(36))  # Which enrichment job created this
    triggered_by = Column(String(255))  # User email or "system"

    # Computed diff from previous version (stored for fast access)
    diff_from_previous = Column(JSON)

    # Change summary (computed from diff)
    has_changes = Column(Boolean, default=False)
    change_count = Column(Integer, default=0)
    highest_significance = Column(String(20))  # critical, high, medium, low

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("module_type", "domain", "version", name="uq_snapshot_version"),
        Index("idx_snapshots_module_domain", "module_type", "domain"),
        Index("idx_snapshots_date", "snapshot_at"),
        Index("idx_snapshots_has_changes", "has_changes"),
    )


class ChangeEvent(Base):
    """
    Detected change event.

    When a snapshot diff reveals changes, we create individual
    ChangeEvent records for:
    - Easier querying ("all executive changes in last 30 days")
    - Alert matching
    - Analytics
    """
    __tablename__ = "change_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Link to snapshot
    snapshot_id = Column(String(36), ForeignKey("intel_snapshots.id"), nullable=False)

    # Context
    domain = Column(String(255), nullable=False, index=True)
    module_type = Column(String(50), nullable=False)

    # Change classification
    category = Column(String(50), nullable=False)
    # executive_change, tech_stack_change, score_change, hiring_change,
    # financial_change, competitive_change, strategic_change

    significance = Column(String(20), nullable=False)
    # critical, high, medium, low

    # Change details
    field = Column(String(100), nullable=False)
    old_value = Column(JSON)
    new_value = Column(JSON)
    summary = Column(String(500))

    # Algolia relevance
    algolia_relevance = Column(String(500))

    # Metadata
    detected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    snapshot = relationship("IntelSnapshot", backref="change_events")

    __table_args__ = (
        Index("idx_changes_domain", "domain"),
        Index("idx_changes_category", "category"),
        Index("idx_changes_significance", "significance"),
        Index("idx_changes_date", "detected_at"),
    )


class SnapshotComparison(Base):
    """
    Cached comparison between two snapshots.

    Pre-computed for frequently accessed comparisons
    (e.g., "current vs 90 days ago").
    """
    __tablename__ = "snapshot_comparisons"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    domain = Column(String(255), nullable=False, index=True)
    module_type = Column(String(50), nullable=False)

    # The two snapshots being compared
    snapshot_old_id = Column(String(36), ForeignKey("intel_snapshots.id"))
    snapshot_new_id = Column(String(36), ForeignKey("intel_snapshots.id"))

    version_old = Column(Integer)
    version_new = Column(Integer)

    # Comparison results
    full_diff = Column(JSON)
    change_summary = Column(JSON)  # Array of changes
    total_changes = Column(Integer)
    highest_significance = Column(String(20))

    # Metadata
    comparison_type = Column(String(50))  # "previous", "30_days", "90_days", "custom"
    computed_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_comparison_domain_module", "domain", "module_type"),
    )
