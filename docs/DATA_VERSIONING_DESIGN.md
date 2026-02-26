# Data Versioning & Change Detection System

**Document Version:** 1.0
**Last Updated:** 2026-02-25
**Status:** Design Complete

---

## 1. The Problem

When you enrich Costco today and again in 3 months:

```
Today (Feb 2026):
- CFO: John Smith
- Search Provider: Elasticsearch
- ICP Score: 75 (warm)
- Hiring: 5 search-related roles

3 Months Later (May 2026):
- CFO: Jane Doe (NEW!)
- Search Provider: None (REMOVED!)
- ICP Score: 92 (HOT!)
- Hiring: 12 search-related roles (INCREASED!)
```

**Questions we must answer:**
1. What exactly changed?
2. When did it change?
3. Should someone be notified?
4. How do we show this in the UI?

---

## 2. Solution Architecture

### 2.1 Three-Layer Approach

```
┌─────────────────────────────────────────────────────────────┐
│                    CHANGE DETECTION                         │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │  LAYER 1:    │   │  LAYER 2:    │   │  LAYER 3:    │    │
│  │  Snapshots   │ → │  Change Diff │ → │  Alerts      │    │
│  │              │   │              │   │              │    │
│  │ Full record  │   │ What changed │   │ Who to       │    │
│  │ at each      │   │ between      │   │ notify and   │    │
│  │ enrichment   │   │ snapshots    │   │ how          │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Layer 1: Snapshot Storage

### 3.1 Snapshot Table Design

Every intel table gets a corresponding snapshot table:

```sql
-- Example: intel_executive_intelligence snapshots
CREATE TABLE intel_executive_intelligence_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to the current record
    record_id INTEGER NOT NULL,
    domain VARCHAR(255) NOT NULL,

    -- Snapshot metadata
    snapshot_version INTEGER NOT NULL,  -- Incrementing version number
    snapshot_at TIMESTAMP NOT NULL DEFAULT NOW(),
    snapshot_type VARCHAR(20) NOT NULL,  -- 'auto', 'manual', 'pre_update'

    -- The actual data (full snapshot)
    data JSONB NOT NULL,

    -- Source info at time of snapshot
    source_url VARCHAR(1000),
    source_date TIMESTAMP,

    -- Enrichment context
    job_id UUID,  -- Which enrichment job created this
    triggered_by VARCHAR(255),  -- User or system

    -- Indexes for fast queries
    UNIQUE(domain, snapshot_version)
);

CREATE INDEX idx_exec_snapshots_domain ON intel_executive_intelligence_snapshots(domain);
CREATE INDEX idx_exec_snapshots_date ON intel_executive_intelligence_snapshots(snapshot_at);
```

### 3.2 Generic Snapshot Model

```python
# backend/app/models/versioning.py

from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from ..database import Base


class IntelSnapshot(Base):
    """
    Generic snapshot table for all intelligence modules.

    Uses single-table inheritance with module_type discriminator.
    This allows querying across all snapshots while maintaining
    per-module indexes.
    """
    __tablename__ = "intel_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # What this is a snapshot of
    module_type = Column(String(50), nullable=False)  # m01, m02, ..., m15
    domain = Column(String(255), nullable=False, index=True)
    record_id = Column(Integer)

    # Version tracking
    version = Column(Integer, nullable=False)
    snapshot_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    snapshot_type = Column(String(20), default="auto")  # auto, manual, pre_update

    # The actual data
    data = Column(JSON, nullable=False)

    # Source info preserved
    source_url = Column(String(1000))
    source_date = Column(DateTime)

    # Context
    job_id = Column(UUID(as_uuid=True))
    triggered_by = Column(String(255))

    # Computed diff from previous version (stored for fast access)
    diff_from_previous = Column(JSON)  # See Layer 2

    __table_args__ = (
        Index("idx_snapshots_module_domain", "module_type", "domain"),
        Index("idx_snapshots_date", "snapshot_at"),
    )
```

### 3.3 Snapshot Creation Logic

```python
# backend/app/services/versioning.py

from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import json

from ..models.versioning import IntelSnapshot
from ..models.intelligence import *


class VersioningService:
    """
    Handles snapshot creation and retrieval.
    """

    async def create_snapshot(
        self,
        db: AsyncSession,
        module_type: str,
        domain: str,
        data: Dict[str, Any],
        source_url: str,
        source_date: datetime,
        job_id: Optional[str] = None,
        triggered_by: str = "system",
    ) -> IntelSnapshot:
        """
        Create a new snapshot for a domain's intelligence data.

        1. Get the previous version number
        2. Compute diff from previous snapshot
        3. Store new snapshot with diff
        """
        # Get latest version
        latest = await self.get_latest_snapshot(db, module_type, domain)
        new_version = (latest.version + 1) if latest else 1

        # Compute diff if there's a previous version
        diff = None
        if latest:
            diff = self._compute_diff(latest.data, data)

        # Create snapshot
        snapshot = IntelSnapshot(
            module_type=module_type,
            domain=domain,
            version=new_version,
            data=data,
            source_url=source_url,
            source_date=source_date,
            diff_from_previous=diff,
            job_id=job_id,
            triggered_by=triggered_by,
        )

        db.add(snapshot)
        await db.flush()

        return snapshot

    async def get_latest_snapshot(
        self,
        db: AsyncSession,
        module_type: str,
        domain: str,
    ) -> Optional[IntelSnapshot]:
        """Get the most recent snapshot for a domain."""
        result = await db.execute(
            select(IntelSnapshot)
            .where(IntelSnapshot.module_type == module_type)
            .where(IntelSnapshot.domain == domain)
            .order_by(IntelSnapshot.version.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_snapshot_history(
        self,
        db: AsyncSession,
        module_type: str,
        domain: str,
        limit: int = 10,
    ) -> list[IntelSnapshot]:
        """Get snapshot history for a domain, newest first."""
        result = await db.execute(
            select(IntelSnapshot)
            .where(IntelSnapshot.module_type == module_type)
            .where(IntelSnapshot.domain == domain)
            .order_by(IntelSnapshot.version.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    def _compute_diff(
        self,
        old_data: Dict[str, Any],
        new_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Compute a semantic diff between two data snapshots.

        Returns:
            {
                "added": {"field": "new_value"},
                "removed": {"field": "old_value"},
                "changed": {
                    "field": {"old": "...", "new": "..."}
                },
                "unchanged": ["field1", "field2"]
            }
        """
        diff = {
            "added": {},
            "removed": {},
            "changed": {},
            "unchanged": [],
        }

        all_keys = set(old_data.keys()) | set(new_data.keys())

        for key in all_keys:
            old_val = old_data.get(key)
            new_val = new_data.get(key)

            if key not in old_data:
                diff["added"][key] = new_val
            elif key not in new_data:
                diff["removed"][key] = old_val
            elif old_val != new_val:
                diff["changed"][key] = {
                    "old": old_val,
                    "new": new_val,
                }
            else:
                diff["unchanged"].append(key)

        return diff
```

---

## 4. Layer 2: Change Detection & Semantic Analysis

### 4.1 Change Types

Not all changes are equal. We categorize them:

```python
# backend/app/services/change_detection.py

from enum import Enum
from typing import Dict, Any, List
from dataclasses import dataclass


class ChangeSignificance(Enum):
    """How significant is this change?"""
    CRITICAL = "critical"    # Immediate action needed
    HIGH = "high"            # Should notify soon
    MEDIUM = "medium"        # Include in digest
    LOW = "low"              # Informational only
    NOISE = "noise"          # Ignore (timestamp updates, etc.)


class ChangeCategory(Enum):
    """What type of change is this?"""
    EXECUTIVE_CHANGE = "executive_change"      # Person added/removed/title changed
    TECH_STACK_CHANGE = "tech_stack_change"    # Technology added/removed
    SCORE_CHANGE = "score_change"              # ICP/Signal score changed
    HIRING_CHANGE = "hiring_change"            # Job postings changed
    FINANCIAL_CHANGE = "financial_change"      # Revenue/margin changed
    COMPETITIVE_CHANGE = "competitive_change"  # Competitor landscape changed
    STRATEGIC_CHANGE = "strategic_change"      # Strategic priorities changed


@dataclass
class DetectedChange:
    """A single detected change."""
    category: ChangeCategory
    significance: ChangeSignificance
    field: str
    old_value: Any
    new_value: Any
    summary: str  # Human-readable summary
    algolia_relevance: str  # Why this matters for Algolia


class ChangeDetector:
    """
    Analyzes diffs and extracts meaningful changes.
    """

    # Rules for categorizing changes
    CHANGE_RULES = {
        # Executive changes
        "executives": {
            "category": ChangeCategory.EXECUTIVE_CHANGE,
            "significance": ChangeSignificance.HIGH,
            "algolia_relevance": "New executives may not have existing vendor relationships",
        },
        "quotes": {
            "category": ChangeCategory.EXECUTIVE_CHANGE,
            "significance": ChangeSignificance.MEDIUM,
            "algolia_relevance": "New executive quotes may reveal priorities",
        },

        # Tech stack changes
        "current_search_provider": {
            "category": ChangeCategory.TECH_STACK_CHANGE,
            "significance": ChangeSignificance.CRITICAL,
            "algolia_relevance": "Search provider change = displacement opportunity",
        },
        "partner_technologies": {
            "category": ChangeCategory.TECH_STACK_CHANGE,
            "significance": ChangeSignificance.HIGH,
            "algolia_relevance": "Partner tech changes affect co-sell motion",
        },

        # Score changes
        "icp_score": {
            "category": ChangeCategory.SCORE_CHANGE,
            "significance": ChangeSignificance.HIGH,
            "algolia_relevance": "Score increase = higher priority target",
        },
        "signal_score": {
            "category": ChangeCategory.SCORE_CHANGE,
            "significance": ChangeSignificance.HIGH,
            "algolia_relevance": "Signal increase = buying readiness",
        },

        # Hiring changes
        "hot_signals": {
            "category": ChangeCategory.HIRING_CHANGE,
            "significance": ChangeSignificance.CRITICAL,
            "algolia_relevance": "Hot hiring signals = budget allocated",
        },
        "total_roles": {
            "category": ChangeCategory.HIRING_CHANGE,
            "significance": ChangeSignificance.MEDIUM,
            "algolia_relevance": "More roles = team building, potential need",
        },

        # Financial changes
        "margin_zone": {
            "category": ChangeCategory.FINANCIAL_CHANGE,
            "significance": ChangeSignificance.HIGH,
            "algolia_relevance": "Margin pressure = efficiency focus = search ROI pitch",
        },
        "revenue_current": {
            "category": ChangeCategory.FINANCIAL_CHANGE,
            "significance": ChangeSignificance.MEDIUM,
            "algolia_relevance": "Revenue change affects deal size potential",
        },

        # Competitive changes
        "competitors_with_algolia": {
            "category": ChangeCategory.COMPETITIVE_CHANGE,
            "significance": ChangeSignificance.CRITICAL,
            "algolia_relevance": "Competitor adopted Algolia = FOMO opportunity",
        },
        "first_mover_opportunity": {
            "category": ChangeCategory.COMPETITIVE_CHANGE,
            "significance": ChangeSignificance.HIGH,
            "algolia_relevance": "First mover status changed",
        },
    }

    def detect_changes(
        self,
        module_type: str,
        diff: Dict[str, Any],
    ) -> List[DetectedChange]:
        """
        Analyze a diff and return a list of detected changes.

        Example output for Costco scenario:
        [
            DetectedChange(
                category=EXECUTIVE_CHANGE,
                significance=HIGH,
                field="executives",
                old_value=[{"name": "John Smith", "title": "CFO"}],
                new_value=[{"name": "Jane Doe", "title": "CFO"}],
                summary="CFO changed: John Smith → Jane Doe",
                algolia_relevance="New CFO may not have existing vendor relationships"
            ),
            DetectedChange(
                category=TECH_STACK_CHANGE,
                significance=CRITICAL,
                field="current_search_provider",
                old_value="Elasticsearch",
                new_value=None,
                summary="Search provider removed: Elasticsearch",
                algolia_relevance="No current search provider = greenfield opportunity"
            ),
        ]
        """
        changes = []

        # Process all changed fields
        for field, change in diff.get("changed", {}).items():
            rule = self._get_rule(module_type, field)
            if rule:
                changes.append(DetectedChange(
                    category=rule["category"],
                    significance=rule["significance"],
                    field=field,
                    old_value=change["old"],
                    new_value=change["new"],
                    summary=self._generate_summary(field, change["old"], change["new"]),
                    algolia_relevance=rule["algolia_relevance"],
                ))

        # Process added fields
        for field, value in diff.get("added", {}).items():
            rule = self._get_rule(module_type, field)
            if rule:
                changes.append(DetectedChange(
                    category=rule["category"],
                    significance=rule["significance"],
                    field=field,
                    old_value=None,
                    new_value=value,
                    summary=f"{field} added: {self._truncate(value)}",
                    algolia_relevance=rule["algolia_relevance"],
                ))

        # Process removed fields
        for field, value in diff.get("removed", {}).items():
            rule = self._get_rule(module_type, field)
            if rule:
                changes.append(DetectedChange(
                    category=rule["category"],
                    significance=rule["significance"],
                    field=field,
                    old_value=value,
                    new_value=None,
                    summary=f"{field} removed: {self._truncate(value)}",
                    algolia_relevance=rule["algolia_relevance"],
                ))

        # Sort by significance
        significance_order = [
            ChangeSignificance.CRITICAL,
            ChangeSignificance.HIGH,
            ChangeSignificance.MEDIUM,
            ChangeSignificance.LOW,
        ]
        changes.sort(key=lambda c: significance_order.index(c.significance))

        return changes

    def _get_rule(self, module_type: str, field: str) -> Optional[Dict]:
        """Get the rule for a field, with module-specific overrides."""
        # Module-specific rules could override defaults here
        return self.CHANGE_RULES.get(field)

    def _generate_summary(self, field: str, old: Any, new: Any) -> str:
        """Generate a human-readable summary of a change."""
        # Special handling for executives (list comparison)
        if field == "executives":
            return self._summarize_executive_change(old, new)

        # Special handling for scores (show direction)
        if "score" in field.lower():
            if isinstance(old, (int, float)) and isinstance(new, (int, float)):
                direction = "↑" if new > old else "↓"
                return f"{field}: {old} → {new} ({direction}{abs(new - old)})"

        # Default
        return f"{field}: {self._truncate(old)} → {self._truncate(new)}"

    def _summarize_executive_change(self, old: list, new: list) -> str:
        """Generate summary for executive changes."""
        old_names = {e.get("name") for e in (old or [])}
        new_names = {e.get("name") for e in (new or [])}

        added = new_names - old_names
        removed = old_names - new_names

        parts = []
        if added:
            parts.append(f"Added: {', '.join(added)}")
        if removed:
            parts.append(f"Removed: {', '.join(removed)}")

        return "Executives changed: " + "; ".join(parts) if parts else "Executive details updated"

    def _truncate(self, value: Any, max_length: int = 50) -> str:
        """Truncate long values for display."""
        s = str(value)
        return s[:max_length] + "..." if len(s) > max_length else s
```

---

## 5. Layer 3: Notifications & Alerts

### 5.1 Alert Rules Model

```python
# backend/app/models/alerts.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from ..database import Base


class AlertRule(Base):
    """
    User-defined alert rules.

    Example rules:
    - "Alert me when any account in my territory hits score > 85"
    - "Alert when Costco has any CRITICAL change"
    - "Alert when any target removes their search provider"
    """
    __tablename__ = "alert_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Who owns this rule
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Rule definition
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    is_active = Column(Boolean, default=True)

    # Conditions (JSON for flexibility)
    conditions = Column(JSON, nullable=False)
    # Example:
    # {
    #     "scope": "my_territory" | "all" | ["costco.com", "walmart.com"],
    #     "change_categories": ["EXECUTIVE_CHANGE", "TECH_STACK_CHANGE"],
    #     "min_significance": "HIGH",
    #     "additional_filters": {
    #         "icp_score_gt": 70,
    #         "module_types": ["m09", "m02"]
    #     }
    # }

    # How to notify
    channels = Column(JSON, default=["in_app"])
    # ["in_app", "email", "slack"]

    # Timing
    frequency = Column(String(20), default="immediate")
    # "immediate", "hourly_digest", "daily_digest"

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_triggered = Column(DateTime)
    trigger_count = Column(Integer, default=0)


class Alert(Base):
    """
    Generated alerts from triggered rules.
    """
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Which rule triggered this
    rule_id = Column(UUID(as_uuid=True), ForeignKey("alert_rules.id"))

    # Who should see this
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # What triggered it
    domain = Column(String(255), nullable=False)
    module_type = Column(String(50))
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey("intel_snapshots.id"))

    # Alert content
    title = Column(String(255), nullable=False)
    summary = Column(String(1000))
    changes = Column(JSON)  # List of DetectedChange as dicts
    significance = Column(String(20))  # Highest significance in changes

    # Status
    status = Column(String(20), default="unread")  # unread, read, dismissed, acted

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime)

    # Delivery tracking
    delivered_channels = Column(JSON, default=[])  # ["in_app", "email"]


class AlertDigest(Base):
    """
    Aggregated alerts for digest delivery.
    """
    __tablename__ = "alert_digests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Digest period
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    digest_type = Column(String(20))  # "hourly", "daily"

    # Contents
    alert_count = Column(Integer, default=0)
    alert_ids = Column(JSON)  # List of alert IDs included
    summary = Column(JSON)  # Aggregated summary

    # Delivery
    status = Column(String(20), default="pending")  # pending, sent, failed
    sent_at = Column(DateTime)
    delivered_to = Column(JSON)  # ["email", "slack"]
```

### 5.2 Alert Service

```python
# backend/app/services/alerts.py

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import asyncio

from ..models.alerts import AlertRule, Alert
from ..models.versioning import IntelSnapshot
from .change_detection import DetectedChange, ChangeSignificance


class AlertService:
    """
    Evaluates changes against rules and generates alerts.
    """

    async def process_changes(
        self,
        db: AsyncSession,
        domain: str,
        module_type: str,
        snapshot: IntelSnapshot,
        changes: List[DetectedChange],
    ) -> List[Alert]:
        """
        Process detected changes and generate alerts.

        Called after every enrichment that produces changes.
        """
        if not changes:
            return []

        # Get all active rules
        rules = await self._get_matching_rules(db, domain, module_type, changes)

        alerts = []
        for rule in rules:
            if self._rule_matches(rule, domain, module_type, changes):
                alert = await self._create_alert(
                    db, rule, domain, module_type, snapshot, changes
                )
                alerts.append(alert)

        # Trigger notifications
        for alert in alerts:
            await self._send_notifications(alert)

        return alerts

    async def _get_matching_rules(
        self,
        db: AsyncSession,
        domain: str,
        module_type: str,
        changes: List[DetectedChange],
    ) -> List[AlertRule]:
        """Get all rules that might match these changes."""
        result = await db.execute(
            select(AlertRule).where(AlertRule.is_active == True)
        )
        return list(result.scalars().all())

    def _rule_matches(
        self,
        rule: AlertRule,
        domain: str,
        module_type: str,
        changes: List[DetectedChange],
    ) -> bool:
        """Check if a rule matches the given changes."""
        conditions = rule.conditions

        # Check scope
        scope = conditions.get("scope", "all")
        if scope == "my_territory":
            # TODO: Check territory ownership
            pass
        elif isinstance(scope, list) and domain not in scope:
            return False

        # Check change categories
        required_categories = conditions.get("change_categories")
        if required_categories:
            change_categories = {c.category.value for c in changes}
            if not change_categories.intersection(required_categories):
                return False

        # Check minimum significance
        min_sig = conditions.get("min_significance", "LOW")
        sig_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        min_idx = sig_order.index(min_sig)
        max_change_sig = min(
            sig_order.index(c.significance.value) for c in changes
        )
        if max_change_sig > min_idx:
            return False

        # Check additional filters
        filters = conditions.get("additional_filters", {})
        if filters.get("module_types"):
            if module_type not in filters["module_types"]:
                return False

        return True

    async def _create_alert(
        self,
        db: AsyncSession,
        rule: AlertRule,
        domain: str,
        module_type: str,
        snapshot: IntelSnapshot,
        changes: List[DetectedChange],
    ) -> Alert:
        """Create an alert from matched rule and changes."""
        # Determine highest significance
        highest = min(changes, key=lambda c: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].index(c.significance.value))

        alert = Alert(
            rule_id=rule.id,
            user_id=rule.user_id,
            domain=domain,
            module_type=module_type,
            snapshot_id=snapshot.id,
            title=self._generate_alert_title(domain, changes),
            summary=self._generate_alert_summary(changes),
            changes=[
                {
                    "category": c.category.value,
                    "significance": c.significance.value,
                    "field": c.field,
                    "summary": c.summary,
                    "algolia_relevance": c.algolia_relevance,
                }
                for c in changes
            ],
            significance=highest.significance.value,
        )

        db.add(alert)

        # Update rule stats
        rule.last_triggered = datetime.utcnow()
        rule.trigger_count += 1

        await db.flush()
        return alert

    def _generate_alert_title(
        self,
        domain: str,
        changes: List[DetectedChange],
    ) -> str:
        """Generate a concise alert title."""
        # Find most significant change
        top = changes[0]  # Already sorted by significance

        if top.significance == ChangeSignificance.CRITICAL:
            return f"🔴 CRITICAL: {domain} - {top.category.value.replace('_', ' ').title()}"
        elif top.significance == ChangeSignificance.HIGH:
            return f"🟠 {domain} - {top.category.value.replace('_', ' ').title()}"
        else:
            return f"📊 {domain} - {len(changes)} changes detected"

    def _generate_alert_summary(
        self,
        changes: List[DetectedChange],
    ) -> str:
        """Generate alert summary."""
        summaries = [c.summary for c in changes[:3]]
        if len(changes) > 3:
            summaries.append(f"...and {len(changes) - 3} more changes")
        return " | ".join(summaries)

    async def _send_notifications(self, alert: Alert):
        """Send notifications through configured channels."""
        # Get rule's channels
        rule = await self._get_rule(alert.rule_id)
        channels = rule.channels if rule else ["in_app"]

        delivered = []

        if "in_app" in channels:
            # Always delivered (it's stored in DB)
            delivered.append("in_app")

        if "email" in channels:
            # TODO: Send email via email service
            # await email_service.send_alert(alert)
            delivered.append("email")

        if "slack" in channels:
            # TODO: Send Slack notification
            # await slack_service.send_alert(alert)
            delivered.append("slack")

        alert.delivered_channels = delivered
```

---

## 6. UI Display: "What Changed" View

### 6.1 API Endpoints

```python
# backend/app/api/history.py

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timedelta

from ..database import get_session
from ..services.versioning import VersioningService
from ..services.change_detection import ChangeDetector

router = APIRouter(prefix="/api/v1/history", tags=["history"])


@router.get("/{domain}/timeline")
async def get_change_timeline(
    domain: str,
    db: AsyncSession = Depends(get_session),
    since: Optional[datetime] = None,
    modules: Optional[str] = None,  # Comma-separated: "m02,m06,m09"
):
    """
    Get timeline of changes for a domain.

    Response:
    {
        "domain": "costco.com",
        "timeline": [
            {
                "date": "2026-05-15",
                "module": "m09_executive",
                "version": 3,
                "changes": [
                    {
                        "category": "EXECUTIVE_CHANGE",
                        "significance": "HIGH",
                        "summary": "CFO changed: John Smith → Jane Doe",
                        "algolia_relevance": "New CFO may not have existing vendor relationships"
                    }
                ]
            },
            {
                "date": "2026-05-15",
                "module": "m02_tech_stack",
                "version": 4,
                "changes": [
                    {
                        "category": "TECH_STACK_CHANGE",
                        "significance": "CRITICAL",
                        "summary": "Search provider removed: Elasticsearch",
                        "algolia_relevance": "No current search provider = greenfield opportunity"
                    }
                ]
            }
        ],
        "summary": {
            "total_changes": 5,
            "critical": 1,
            "high": 2,
            "medium": 2,
            "time_span": "3 months"
        }
    }
    """
    versioning = VersioningService()
    detector = ChangeDetector()

    # Default to last 90 days
    if not since:
        since = datetime.utcnow() - timedelta(days=90)

    module_list = modules.split(",") if modules else None

    # Get snapshots with diffs
    snapshots = await versioning.get_snapshots_since(db, domain, since, module_list)

    timeline = []
    for snapshot in snapshots:
        if snapshot.diff_from_previous:
            changes = detector.detect_changes(
                snapshot.module_type,
                snapshot.diff_from_previous
            )
            if changes:
                timeline.append({
                    "date": snapshot.snapshot_at.isoformat(),
                    "module": snapshot.module_type,
                    "version": snapshot.version,
                    "changes": [
                        {
                            "category": c.category.value,
                            "significance": c.significance.value,
                            "summary": c.summary,
                            "algolia_relevance": c.algolia_relevance,
                        }
                        for c in changes
                    ],
                })

    return {
        "domain": domain,
        "timeline": timeline,
        "summary": _summarize_timeline(timeline),
    }


@router.get("/{domain}/compare")
async def compare_versions(
    domain: str,
    module: str,
    version1: int,
    version2: int,
    db: AsyncSession = Depends(get_session),
):
    """
    Side-by-side comparison of two versions.

    Returns the full data for both versions plus the diff.
    """
    versioning = VersioningService()

    v1 = await versioning.get_snapshot_by_version(db, module, domain, version1)
    v2 = await versioning.get_snapshot_by_version(db, module, domain, version2)

    diff = versioning._compute_diff(v1.data, v2.data)

    return {
        "domain": domain,
        "module": module,
        "version1": {
            "version": v1.version,
            "date": v1.snapshot_at.isoformat(),
            "data": v1.data,
        },
        "version2": {
            "version": v2.version,
            "date": v2.snapshot_at.isoformat(),
            "data": v2.data,
        },
        "diff": diff,
    }
```

### 6.2 Frontend Component Concept

```typescript
// frontend/src/components/ChangeTimeline.tsx

interface ChangeTimelineProps {
  domain: string;
}

const ChangeTimeline: FC<ChangeTimelineProps> = ({ domain }) => {
  const { data, isLoading } = useQuery(
    ['timeline', domain],
    () => api.getChangeTimeline(domain)
  );

  if (isLoading) return <Skeleton />;

  return (
    <div className="change-timeline">
      <h3>What Changed</h3>

      {/* Summary banner */}
      <div className="change-summary">
        <Badge color="red">{data.summary.critical} critical</Badge>
        <Badge color="orange">{data.summary.high} high</Badge>
        <span>in the last {data.summary.time_span}</span>
      </div>

      {/* Timeline */}
      <Timeline>
        {data.timeline.map((entry, i) => (
          <Timeline.Item
            key={i}
            color={getColor(entry.changes[0].significance)}
            label={formatDate(entry.date)}
          >
            <div className="timeline-entry">
              <ModuleBadge module={entry.module} />
              {entry.changes.map((change, j) => (
                <ChangeCard key={j} change={change} />
              ))}
            </div>
          </Timeline.Item>
        ))}
      </Timeline>
    </div>
  );
};

const ChangeCard: FC<{ change: Change }> = ({ change }) => (
  <Card className={`change-card change-${change.significance.toLowerCase()}`}>
    <div className="change-header">
      <SignificanceBadge level={change.significance} />
      <CategoryIcon category={change.category} />
    </div>
    <p className="change-summary">{change.summary}</p>
    <p className="algolia-relevance">
      <Icon name="algolia" />
      {change.algolia_relevance}
    </p>
  </Card>
);
```

---

## 7. Integration with Enrichment Flow

### 7.1 Updated Module Base Class

```python
# backend/app/modules/base.py (updated)

class BaseIntelligenceModule(ABC):
    """Updated to integrate versioning."""

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Main entry point - now with versioning.
        """
        # 1. Fetch new data
        raw_data = await self.fetch_data(domain)
        transformed = await self.transform_data(raw_data)

        # 2. Create result
        result = self._create_result(
            domain=domain,
            data=transformed,
            source_url=raw_data["source_url"],
            source_date=raw_data["source_date"],
        )

        # 3. Create snapshot and detect changes
        async with get_db_context() as db:
            versioning = VersioningService()
            snapshot = await versioning.create_snapshot(
                db=db,
                module_type=self.MODULE_ID,
                domain=domain,
                data=result.data,
                source_url=result.source.url,
                source_date=result.source.date,
                triggered_by="enrichment",
            )

            # 4. Detect and process changes
            if snapshot.diff_from_previous:
                detector = ChangeDetector()
                changes = detector.detect_changes(
                    self.MODULE_ID,
                    snapshot.diff_from_previous
                )

                # 5. Trigger alerts
                if changes:
                    alert_service = AlertService()
                    await alert_service.process_changes(
                        db, domain, self.MODULE_ID, snapshot, changes
                    )

            # 6. Save to main table
            await self.save_to_db(result, db)

        return result
```

---

## 8. Example: Costco Scenario

### Initial Enrichment (Feb 2026)

```json
{
  "domain": "costco.com",
  "module": "m09_executive",
  "version": 1,
  "data": {
    "executives": [
      {"name": "John Smith", "title": "CFO"},
      {"name": "Bob Johnson", "title": "CEO"}
    ],
    "key_themes": ["cost_efficiency", "member_experience"]
  }
}
```

### Re-enrichment (May 2026)

```json
{
  "domain": "costco.com",
  "module": "m09_executive",
  "version": 2,
  "data": {
    "executives": [
      {"name": "Jane Doe", "title": "CFO"},
      {"name": "Bob Johnson", "title": "CEO"}
    ],
    "key_themes": ["digital_transformation", "member_experience"]
  },
  "diff_from_previous": {
    "changed": {
      "executives": {
        "old": [{"name": "John Smith", "title": "CFO"}, ...],
        "new": [{"name": "Jane Doe", "title": "CFO"}, ...]
      },
      "key_themes": {
        "old": ["cost_efficiency", "member_experience"],
        "new": ["digital_transformation", "member_experience"]
      }
    }
  }
}
```

### Generated Alert

```json
{
  "id": "alert-123",
  "title": "🟠 costco.com - Executive Change",
  "summary": "CFO changed: John Smith → Jane Doe | New theme: digital_transformation",
  "changes": [
    {
      "category": "EXECUTIVE_CHANGE",
      "significance": "HIGH",
      "summary": "CFO changed: John Smith → Jane Doe",
      "algolia_relevance": "New CFO may not have existing vendor relationships"
    },
    {
      "category": "STRATEGIC_CHANGE",
      "significance": "MEDIUM",
      "summary": "Key themes changed: Added digital_transformation",
      "algolia_relevance": "Digital transformation = search modernization opportunity"
    }
  ]
}
```

---

## 9. Implementation Plan

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Create `intel_snapshots` table and model | 1 day |
| 2 | Implement `VersioningService` | 2 days |
| 3 | Implement `ChangeDetector` with rules | 2 days |
| 4 | Create alert models and `AlertService` | 2 days |
| 5 | Integrate with module base class | 1 day |
| 6 | Create history API endpoints | 1 day |
| 7 | Frontend timeline component | 2 days |

**Total: ~11 days**

---

*Document created: 2026-02-25*
*Status: Ready for Implementation*
