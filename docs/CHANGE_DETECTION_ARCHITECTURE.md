# PartnerForge Change Detection & Intelligence Versioning

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Architecture Design
**Priority:** P1 - Critical for Enterprise ABM

---

## Executive Summary

Change detection transforms PartnerForge from a "snapshot tool" into a **continuous intelligence system**. Instead of just showing "Costco uses Elasticsearch", we show:

- "Costco **removed** Constructor.io 45 days ago" → They're evaluating alternatives
- "Costco's **VP of Digital Commerce left** 30 days ago" → New decision maker incoming
- "Costco's **search-related hiring increased 300%**" → They're investing in search
- "Costco's **ecommerce revenue grew 23%** this quarter" → Budget is available

**This is the difference between data and intelligence.**

---

## 1. Core Architecture

### 1.1 Snapshot-Based Versioning

Every enrichment creates an immutable **snapshot**. We never overwrite - we append.

```
Timeline for costco.com:
─────────────────────────────────────────────────────────────────────
│ 2026-02-01   │ 2026-02-25   │ 2026-05-25   │ (Future)
│ Snapshot #1  │ Snapshot #2  │ Snapshot #3  │
│              │              │              │
│ Tech: Const. │ Tech: None   │ Tech: Algolia│  ← You won the deal!
│ VP: John Doe │ VP: Jane Doe │ VP: Jane Doe │
│ Score: 72    │ Score: 85    │ Score: 95    │
─────────────────────────────────────────────────────────────────────
                    ↓
              Change Detected:
              • Constructor removed
              • New VP (Jane Doe)
              • Score increased +13
```

### 1.2 Data Model

```sql
-- Core snapshots table (one row per enrichment)
CREATE TABLE intel_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    snapshot_number INTEGER NOT NULL,
    snapshot_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Trigger for this snapshot
    trigger_type VARCHAR(50) NOT NULL,  -- 'manual', 'scheduled', 'event'
    triggered_by UUID REFERENCES users(id),

    -- Full intelligence data (JSONB for flexibility)
    company_context JSONB,
    technology_stack JSONB,
    traffic_analysis JSONB,
    financial_profile JSONB,
    competitor_intel JSONB,
    hiring_signals JSONB,
    strategic_context JSONB,
    investor_intel JSONB,
    executive_intel JSONB,
    buying_committee JSONB,
    displacement_analysis JSONB,
    case_study_matches JSONB,
    icp_mapping JSONB,
    signal_scoring JSONB,

    -- Computed scores
    icp_score INTEGER,
    priority VARCHAR(20),  -- HOT, WARM, COOL, COLD

    -- Metadata
    modules_completed TEXT[],
    modules_failed TEXT[],
    duration_ms INTEGER,

    -- Source tracking
    sources JSONB,  -- Array of all sources used

    UNIQUE(domain, snapshot_number)
);

CREATE INDEX idx_snapshots_domain ON intel_snapshots(domain);
CREATE INDEX idx_snapshots_date ON intel_snapshots(snapshot_date DESC);

-- Changes detected between snapshots
CREATE TABLE intel_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,

    -- Which snapshots are being compared
    previous_snapshot_id UUID REFERENCES intel_snapshots(id),
    current_snapshot_id UUID REFERENCES intel_snapshots(id),

    -- Change metadata
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_count INTEGER NOT NULL,

    -- Significance scoring
    significance_score INTEGER NOT NULL,  -- 0-100
    significance_level VARCHAR(20) NOT NULL,  -- CRITICAL, HIGH, MEDIUM, LOW

    -- The actual changes (detailed)
    changes JSONB NOT NULL,

    -- Notification status
    notifications_sent BOOLEAN DEFAULT FALSE,
    notified_users UUID[],

    UNIQUE(previous_snapshot_id, current_snapshot_id)
);

CREATE INDEX idx_changes_domain ON intel_changes(domain);
CREATE INDEX idx_changes_significance ON intel_changes(significance_level);

-- Individual change records (for querying specific change types)
CREATE TABLE intel_change_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_id UUID REFERENCES intel_changes(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,

    -- What changed
    module VARCHAR(50) NOT NULL,  -- M01, M02, etc.
    field_path TEXT NOT NULL,     -- e.g., "technology_stack.search_provider"
    change_type VARCHAR(20) NOT NULL,  -- ADDED, REMOVED, MODIFIED, SCORE_CHANGE

    -- Values
    old_value JSONB,
    new_value JSONB,

    -- Significance
    significance VARCHAR(20) NOT NULL,  -- CRITICAL, HIGH, MEDIUM, LOW
    opportunity_signal BOOLEAN DEFAULT FALSE,

    -- Human-readable description
    description TEXT NOT NULL,  -- "Search provider changed from Constructor to None"

    -- Algolia relevance
    maps_to_algolia TEXT,  -- "Evaluating search alternatives - timing opportunity"

    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_details_domain ON intel_change_details(domain);
CREATE INDEX idx_change_details_type ON intel_change_details(change_type);
CREATE INDEX idx_change_details_opportunity ON intel_change_details(opportunity_signal);
```

---

## 2. Change Detection Engine

### 2.1 Change Categories & Significance

```python
# changes/categories.py

from enum import Enum
from dataclasses import dataclass

class ChangeType(Enum):
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    SCORE_CHANGE = "score_change"

class Significance(Enum):
    CRITICAL = "critical"  # Immediate action required
    HIGH = "high"          # Review within 24 hours
    MEDIUM = "medium"      # Review within 1 week
    LOW = "low"            # Informational

@dataclass
class ChangeRule:
    """Defines significance of a specific change type."""
    field_pattern: str          # Regex pattern for field path
    change_type: ChangeType
    significance: Significance
    opportunity_signal: bool
    description_template: str
    maps_to_algolia: str | None


# Change significance rules - ordered by importance
CHANGE_RULES: list[ChangeRule] = [
    # ============ CRITICAL CHANGES ============

    # Search provider changes (GOLD)
    ChangeRule(
        field_pattern=r"technology_stack\.search_provider\.provider_name",
        change_type=ChangeType.MODIFIED,
        significance=Significance.CRITICAL,
        opportunity_signal=True,
        description_template="Search provider changed from {old} to {new}",
        maps_to_algolia="Active search evaluation - IMMEDIATE outreach opportunity"
    ),
    ChangeRule(
        field_pattern=r"technology_stack\.search_provider\.provider_name",
        change_type=ChangeType.REMOVED,
        significance=Significance.CRITICAL,
        opportunity_signal=True,
        description_template="Search provider {old} was REMOVED",
        maps_to_algolia="Search solution removed - actively seeking replacement"
    ),

    # Executive departures (decision maker change)
    ChangeRule(
        field_pattern=r"executive_intel\.executives\[\d+\]",
        change_type=ChangeType.REMOVED,
        significance=Significance.CRITICAL,
        opportunity_signal=True,
        description_template="Executive departed: {old.name} ({old.title})",
        maps_to_algolia="Decision maker change - new stakeholder may be open to evaluation"
    ),

    # ICP score jumps
    ChangeRule(
        field_pattern=r"signal_scoring\.icp_score",
        change_type=ChangeType.SCORE_CHANGE,
        significance=Significance.CRITICAL,
        opportunity_signal=True,
        description_template="ICP score increased from {old} to {new} (+{delta})",
        maps_to_algolia="Account priority increased significantly",
        # Only critical if delta > 15
    ),

    # ============ HIGH CHANGES ============

    # New executive joins
    ChangeRule(
        field_pattern=r"executive_intel\.executives\[\d+\]",
        change_type=ChangeType.ADDED,
        significance=Significance.HIGH,
        opportunity_signal=True,
        description_template="New executive joined: {new.name} as {new.title}",
        maps_to_algolia="New decision maker - opportunity for fresh conversation"
    ),

    # Hiring signal strength changes
    ChangeRule(
        field_pattern=r"hiring_signals\.tier1_signals",
        change_type=ChangeType.ADDED,
        significance=Significance.HIGH,
        opportunity_signal=True,
        description_template="New STRONG hiring signal: {new.role}",
        maps_to_algolia="Investing in search/digital - budget allocated"
    ),

    # Technology additions
    ChangeRule(
        field_pattern=r"technology_stack\.recently_added",
        change_type=ChangeType.ADDED,
        significance=Significance.HIGH,
        opportunity_signal=False,
        description_template="Added technology: {new.tech}",
        maps_to_algolia="Technology investment in progress"
    ),

    # Revenue significant change (>10%)
    ChangeRule(
        field_pattern=r"financial_profile\.revenue_3yr\[0\]\.revenue",
        change_type=ChangeType.MODIFIED,
        significance=Significance.HIGH,
        opportunity_signal=True,
        description_template="Revenue changed from ${old:,.0f} to ${new:,.0f} ({delta_pct:+.1f}%)",
        maps_to_algolia="Financial position changed - reassess deal size"
    ),

    # Competitor search provider changes
    ChangeRule(
        field_pattern=r"competitor_intel\.competitors\[\d+\]\.search_provider",
        change_type=ChangeType.MODIFIED,
        significance=Significance.HIGH,
        opportunity_signal=True,
        description_template="Competitor {parent.name} changed search from {old} to {new}",
        maps_to_algolia="Competitive pressure - 'Your competitor just upgraded their search'"
    ),

    # Strategic initiative mentions Algolia-relevant terms
    ChangeRule(
        field_pattern=r"strategic_context\.strategic_initiatives",
        change_type=ChangeType.ADDED,
        significance=Significance.HIGH,
        opportunity_signal=True,
        description_template="New strategic initiative: {new.name}",
        maps_to_algolia="Strategic priority alignment"
    ),

    # ============ MEDIUM CHANGES ============

    # Traffic changes (>20%)
    ChangeRule(
        field_pattern=r"traffic_analysis\.monthly_sessions",
        change_type=ChangeType.MODIFIED,
        significance=Significance.MEDIUM,
        opportunity_signal=False,
        description_template="Monthly traffic changed from {old:,} to {new:,} ({delta_pct:+.1f}%)",
        maps_to_algolia="Traffic volume affects ROI calculation"
    ),

    # Buying committee changes
    ChangeRule(
        field_pattern=r"buying_committee\.members",
        change_type=ChangeType.MODIFIED,
        significance=Significance.MEDIUM,
        opportunity_signal=False,
        description_template="Buying committee updated: {change_summary}",
        maps_to_algolia="Stakeholder map needs refresh"
    ),

    # Margin zone changes
    ChangeRule(
        field_pattern=r"financial_profile\.margin_zone",
        change_type=ChangeType.MODIFIED,
        significance=Significance.MEDIUM,
        opportunity_signal=True,
        description_template="Margin zone changed from {old} to {new}",
        maps_to_algolia="Financial pressure changed - adjust messaging"
    ),

    # ============ LOW CHANGES ============

    # Employee count
    ChangeRule(
        field_pattern=r"company_context\.employee_count",
        change_type=ChangeType.MODIFIED,
        significance=Significance.LOW,
        opportunity_signal=False,
        description_template="Employee count: {old:,} → {new:,}",
        maps_to_algolia=None
    ),

    # Case study matches
    ChangeRule(
        field_pattern=r"case_study_matches\.matches",
        change_type=ChangeType.MODIFIED,
        significance=Significance.LOW,
        opportunity_signal=False,
        description_template="Case study relevance updated",
        maps_to_algolia=None
    ),
]
```

### 2.2 Change Detection Service

```python
# changes/detector.py

import json
from typing import Any
from deepdiff import DeepDiff
from datetime import datetime

class ChangeDetector:
    """
    Detects and categorizes changes between intelligence snapshots.
    """

    def __init__(self):
        self.rules = CHANGE_RULES

    async def detect_changes(
        self,
        previous_snapshot: IntelSnapshot,
        current_snapshot: IntelSnapshot,
    ) -> ChangeReport:
        """
        Compare two snapshots and generate change report.
        """
        changes: list[ChangeDetail] = []

        # Compare each module
        modules_to_compare = [
            ("company_context", "M01"),
            ("technology_stack", "M02"),
            ("traffic_analysis", "M03"),
            ("financial_profile", "M04"),
            ("competitor_intel", "M05"),
            ("hiring_signals", "M06"),
            ("strategic_context", "M07"),
            ("investor_intel", "M08"),
            ("executive_intel", "M09"),
            ("buying_committee", "M10"),
            ("displacement_analysis", "M11"),
            ("case_study_matches", "M12"),
            ("icp_mapping", "M13"),
            ("signal_scoring", "M14"),
        ]

        for field_name, module_id in modules_to_compare:
            old_data = getattr(previous_snapshot, field_name, None)
            new_data = getattr(current_snapshot, field_name, None)

            if old_data is None and new_data is None:
                continue

            module_changes = self._compare_module(
                module_id=module_id,
                field_name=field_name,
                old_data=old_data,
                new_data=new_data,
            )
            changes.extend(module_changes)

        # Calculate overall significance
        significance_score = self._calculate_significance_score(changes)
        significance_level = self._score_to_level(significance_score)

        # Identify opportunity signals
        opportunity_changes = [c for c in changes if c.opportunity_signal]

        return ChangeReport(
            domain=current_snapshot.domain,
            previous_snapshot_id=previous_snapshot.id,
            current_snapshot_id=current_snapshot.id,
            detected_at=datetime.utcnow(),
            changes=changes,
            change_count=len(changes),
            significance_score=significance_score,
            significance_level=significance_level,
            opportunity_signals=opportunity_changes,
            days_between_snapshots=(
                current_snapshot.snapshot_date - previous_snapshot.snapshot_date
            ).days,
        )

    def _compare_module(
        self,
        module_id: str,
        field_name: str,
        old_data: dict | None,
        new_data: dict | None,
    ) -> list[ChangeDetail]:
        """Compare a single module's data."""
        changes = []

        # Handle None cases
        if old_data is None and new_data is not None:
            changes.append(ChangeDetail(
                module=module_id,
                field_path=field_name,
                change_type=ChangeType.ADDED,
                old_value=None,
                new_value=new_data,
                significance=Significance.MEDIUM,
                description=f"Module {module_id} data now available",
            ))
            return changes

        if old_data is not None and new_data is None:
            changes.append(ChangeDetail(
                module=module_id,
                field_path=field_name,
                change_type=ChangeType.REMOVED,
                old_value=old_data,
                new_value=None,
                significance=Significance.MEDIUM,
                description=f"Module {module_id} data no longer available",
            ))
            return changes

        # Deep comparison
        diff = DeepDiff(
            old_data,
            new_data,
            ignore_order=True,
            report_repetition=True,
            verbose_level=2,
        )

        # Process additions
        for path, value in diff.get("dictionary_item_added", {}).items():
            change = self._create_change_detail(
                module_id=module_id,
                field_path=self._clean_path(field_name, path),
                change_type=ChangeType.ADDED,
                old_value=None,
                new_value=value,
            )
            if change:
                changes.append(change)

        # Process removals
        for path, value in diff.get("dictionary_item_removed", {}).items():
            change = self._create_change_detail(
                module_id=module_id,
                field_path=self._clean_path(field_name, path),
                change_type=ChangeType.REMOVED,
                old_value=value,
                new_value=None,
            )
            if change:
                changes.append(change)

        # Process modifications
        for path, values in diff.get("values_changed", {}).items():
            change = self._create_change_detail(
                module_id=module_id,
                field_path=self._clean_path(field_name, path),
                change_type=ChangeType.MODIFIED,
                old_value=values.get("old_value"),
                new_value=values.get("new_value"),
            )
            if change:
                changes.append(change)

        # Process list additions
        for path, values in diff.get("iterable_item_added", {}).items():
            change = self._create_change_detail(
                module_id=module_id,
                field_path=self._clean_path(field_name, path),
                change_type=ChangeType.ADDED,
                old_value=None,
                new_value=values,
            )
            if change:
                changes.append(change)

        # Process list removals
        for path, values in diff.get("iterable_item_removed", {}).items():
            change = self._create_change_detail(
                module_id=module_id,
                field_path=self._clean_path(field_name, path),
                change_type=ChangeType.REMOVED,
                old_value=values,
                new_value=None,
            )
            if change:
                changes.append(change)

        return changes

    def _create_change_detail(
        self,
        module_id: str,
        field_path: str,
        change_type: ChangeType,
        old_value: Any,
        new_value: Any,
    ) -> ChangeDetail | None:
        """Create change detail with significance from rules."""

        # Find matching rule
        rule = self._find_matching_rule(field_path, change_type)

        if rule is None:
            # Default to LOW significance if no rule matches
            return ChangeDetail(
                module=module_id,
                field_path=field_path,
                change_type=change_type,
                old_value=old_value,
                new_value=new_value,
                significance=Significance.LOW,
                opportunity_signal=False,
                description=self._generate_default_description(
                    field_path, change_type, old_value, new_value
                ),
                maps_to_algolia=None,
            )

        # Apply rule
        description = self._format_description(
            rule.description_template,
            old_value,
            new_value,
        )

        # Check for score changes with threshold
        significance = rule.significance
        if "score" in field_path.lower() and change_type == ChangeType.MODIFIED:
            if isinstance(old_value, (int, float)) and isinstance(new_value, (int, float)):
                delta = new_value - old_value
                if abs(delta) < 10:
                    significance = Significance.LOW
                elif abs(delta) >= 15:
                    significance = Significance.CRITICAL

        return ChangeDetail(
            module=module_id,
            field_path=field_path,
            change_type=change_type,
            old_value=old_value,
            new_value=new_value,
            significance=significance,
            opportunity_signal=rule.opportunity_signal,
            description=description,
            maps_to_algolia=rule.maps_to_algolia,
        )

    def _find_matching_rule(
        self,
        field_path: str,
        change_type: ChangeType,
    ) -> ChangeRule | None:
        """Find the first matching rule for a field path."""
        import re

        for rule in self.rules:
            if rule.change_type != change_type:
                continue
            if re.match(rule.field_pattern, field_path):
                return rule

        return None

    def _calculate_significance_score(self, changes: list[ChangeDetail]) -> int:
        """Calculate overall significance score (0-100)."""
        if not changes:
            return 0

        weights = {
            Significance.CRITICAL: 40,
            Significance.HIGH: 20,
            Significance.MEDIUM: 10,
            Significance.LOW: 2,
        }

        score = sum(weights[c.significance] for c in changes)
        return min(100, score)  # Cap at 100

    def _score_to_level(self, score: int) -> Significance:
        """Convert numeric score to significance level."""
        if score >= 60:
            return Significance.CRITICAL
        elif score >= 40:
            return Significance.HIGH
        elif score >= 20:
            return Significance.MEDIUM
        else:
            return Significance.LOW
```

---

## 3. Notification System

### 3.1 Notification Rules

```python
# notifications/rules.py

@dataclass
class NotificationRule:
    """Defines when and who to notify about changes."""
    id: UUID
    name: str

    # Conditions
    significance_levels: set[Significance]
    change_types: set[str] | None  # Field patterns to match
    opportunity_only: bool

    # Recipients
    notify_account_owner: bool
    notify_team_manager: bool
    additional_users: list[UUID]
    channels: set[str]  # email, slack, in_app

    # Timing
    frequency: str  # immediate, hourly_digest, daily_digest
    quiet_hours: tuple[int, int] | None  # (start_hour, end_hour)


DEFAULT_NOTIFICATION_RULES = [
    # Critical changes - immediate notification
    NotificationRule(
        id=uuid4(),
        name="Critical Changes - Immediate",
        significance_levels={Significance.CRITICAL},
        change_types=None,  # All types
        opportunity_only=False,
        notify_account_owner=True,
        notify_team_manager=True,
        additional_users=[],
        channels={"email", "slack", "in_app"},
        frequency="immediate",
        quiet_hours=None,  # Always notify
    ),

    # High significance opportunities - immediate
    NotificationRule(
        id=uuid4(),
        name="High Opportunity Signals",
        significance_levels={Significance.HIGH},
        change_types=None,
        opportunity_only=True,  # Only opportunity signals
        notify_account_owner=True,
        notify_team_manager=False,
        additional_users=[],
        channels={"slack", "in_app"},
        frequency="immediate",
        quiet_hours=(22, 7),  # Quiet 10pm-7am
    ),

    # Daily digest for all changes
    NotificationRule(
        id=uuid4(),
        name="Daily Intelligence Digest",
        significance_levels={
            Significance.CRITICAL,
            Significance.HIGH,
            Significance.MEDIUM,
        },
        change_types=None,
        opportunity_only=False,
        notify_account_owner=True,
        notify_team_manager=False,
        additional_users=[],
        channels={"email"},
        frequency="daily_digest",
        quiet_hours=None,
    ),
]
```

### 3.2 Notification Service

```python
# notifications/service.py

class NotificationService:
    """
    Sends notifications based on detected changes.
    """

    def __init__(
        self,
        email_client: EmailClient,
        slack_client: SlackClient,
        db: AsyncSession,
    ):
        self.email = email_client
        self.slack = slack_client
        self.db = db

    async def process_change_report(self, report: ChangeReport):
        """Process a change report and send appropriate notifications."""

        # Get applicable rules
        rules = await self._get_matching_rules(report)

        for rule in rules:
            if rule.frequency == "immediate":
                await self._send_immediate(report, rule)
            else:
                # Queue for digest
                await self._queue_for_digest(report, rule)

    async def _send_immediate(
        self,
        report: ChangeReport,
        rule: NotificationRule,
    ):
        """Send immediate notification."""
        recipients = await self._get_recipients(report.domain, rule)

        for recipient in recipients:
            notification = self._format_notification(report, recipient)

            if "slack" in rule.channels:
                await self.slack.send_change_alert(
                    user_id=recipient.slack_id,
                    notification=notification,
                )

            if "email" in rule.channels:
                await self.email.send_change_alert(
                    to=recipient.email,
                    notification=notification,
                )

            if "in_app" in rule.channels:
                await self._create_in_app_notification(
                    user_id=recipient.id,
                    notification=notification,
                )

    def _format_notification(
        self,
        report: ChangeReport,
        recipient: User,
    ) -> ChangeNotification:
        """Format notification for a specific recipient."""

        # Get most significant changes
        top_changes = sorted(
            report.changes,
            key=lambda c: SIGNIFICANCE_ORDER[c.significance],
            reverse=True,
        )[:5]

        # Build notification
        return ChangeNotification(
            domain=report.domain,
            company_name=report.company_name,
            significance_level=report.significance_level,
            change_count=report.change_count,
            opportunity_count=len(report.opportunity_signals),

            # Headline
            headline=self._generate_headline(report),

            # Top changes
            changes=[
                ChangeNotificationItem(
                    icon=self._get_change_icon(c),
                    description=c.description,
                    significance=c.significance,
                    action_text=c.maps_to_algolia,
                )
                for c in top_changes
            ],

            # CTA
            view_url=f"/company/{report.domain}/changes/{report.current_snapshot_id}",

            # Metadata
            detected_at=report.detected_at,
            days_since_last_check=report.days_between_snapshots,
        )

    def _generate_headline(self, report: ChangeReport) -> str:
        """Generate attention-grabbing headline."""

        # Check for specific high-value changes
        for change in report.changes:
            if "search_provider" in change.field_path:
                if change.change_type == ChangeType.REMOVED:
                    return f"🔥 {report.company_name} REMOVED their search provider"
                else:
                    return f"⚠️ {report.company_name} changed search providers"

            if "executive" in change.field_path.lower():
                if change.change_type == ChangeType.REMOVED:
                    return f"👤 Key executive left {report.company_name}"
                elif change.change_type == ChangeType.ADDED:
                    return f"👤 New executive joined {report.company_name}"

        # Default headline based on significance
        if report.significance_level == Significance.CRITICAL:
            return f"🚨 Critical changes detected at {report.company_name}"
        elif report.significance_level == Significance.HIGH:
            return f"📊 Significant intelligence update for {report.company_name}"
        else:
            return f"📋 {report.change_count} changes at {report.company_name}"
```

### 3.3 Slack Integration

```python
# notifications/slack.py

class SlackClient:
    """Rich Slack notifications for change alerts."""

    async def send_change_alert(
        self,
        channel: str,
        notification: ChangeNotification,
    ):
        """Send formatted change alert to Slack."""

        blocks = [
            # Header
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": notification.headline,
                    "emoji": True,
                }
            },

            # Context
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"*{notification.domain}* • {notification.change_count} changes • {notification.days_since_last_check} days since last check"
                    }
                ]
            },

            {"type": "divider"},

            # Changes
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": self._format_changes_markdown(notification.changes),
                }
            },
        ]

        # Add opportunity signals section if present
        if notification.opportunity_count > 0:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🎯 *{notification.opportunity_count} Opportunity Signals Detected*",
                },
                "accessory": {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "View Details"},
                    "url": notification.view_url,
                    "action_id": "view_changes",
                }
            })

        # Action buttons
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "📊 View Intelligence"},
                    "url": f"/company/{notification.domain}",
                    "style": "primary",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "📝 Generate Brief"},
                    "url": f"/company/{notification.domain}/brief",
                },
            ]
        })

        await self.client.chat_postMessage(
            channel=channel,
            blocks=blocks,
            text=notification.headline,  # Fallback
        )

    def _format_changes_markdown(self, changes: list[ChangeNotificationItem]) -> str:
        """Format changes as Slack markdown."""
        lines = []
        for change in changes:
            icon = self._significance_icon(change.significance)
            lines.append(f"{icon} {change.description}")
            if change.action_text:
                lines.append(f"    → _{change.action_text}_")
        return "\n".join(lines)

    def _significance_icon(self, sig: Significance) -> str:
        return {
            Significance.CRITICAL: "🔴",
            Significance.HIGH: "🟠",
            Significance.MEDIUM: "🟡",
            Significance.LOW: "⚪",
        }[sig]
```

---

## 4. UI Components for Change Display

### 4.1 Change Timeline View

```typescript
// frontend/src/components/changes/ChangeTimeline.tsx

interface ChangeTimelineProps {
  domain: string;
  snapshots: Snapshot[];
  changes: ChangeReport[];
}

export const ChangeTimeline: FC<ChangeTimelineProps> = ({
  domain,
  snapshots,
  changes,
}) => {
  return (
    <div className="change-timeline">
      <h2>Intelligence History</h2>

      <div className="timeline">
        {snapshots.map((snapshot, index) => {
          const changeReport = changes.find(
            c => c.current_snapshot_id === snapshot.id
          );

          return (
            <TimelineEntry key={snapshot.id}>
              {/* Date marker */}
              <TimelineMarker
                date={snapshot.snapshot_date}
                isLatest={index === 0}
              />

              {/* Snapshot summary */}
              <TimelineContent>
                <SnapshotSummary snapshot={snapshot} />

                {/* Changes from previous */}
                {changeReport && (
                  <ChangesSummary
                    report={changeReport}
                    expanded={index === 0}
                  />
                )}
              </TimelineContent>
            </TimelineEntry>
          );
        })}
      </div>
    </div>
  );
};

// Change summary component
const ChangesSummary: FC<{ report: ChangeReport; expanded: boolean }> = ({
  report,
  expanded,
}) => {
  const [isExpanded, setExpanded] = useState(expanded);

  return (
    <div className={`changes-summary significance-${report.significance_level}`}>
      <div className="changes-header" onClick={() => setExpanded(!isExpanded)}>
        <SignificanceBadge level={report.significance_level} />
        <span>{report.change_count} changes detected</span>
        {report.opportunity_signals.length > 0 && (
          <span className="opportunity-badge">
            🎯 {report.opportunity_signals.length} opportunities
          </span>
        )}
        <ChevronIcon direction={isExpanded ? 'up' : 'down'} />
      </div>

      {isExpanded && (
        <div className="changes-list">
          {report.changes.map(change => (
            <ChangeItem key={change.id} change={change} />
          ))}
        </div>
      )}
    </div>
  );
};

// Individual change item
const ChangeItem: FC<{ change: ChangeDetail }> = ({ change }) => {
  return (
    <div className={`change-item ${change.change_type} ${change.significance}`}>
      <div className="change-icon">
        {change.change_type === 'added' && <PlusIcon />}
        {change.change_type === 'removed' && <MinusIcon />}
        {change.change_type === 'modified' && <EditIcon />}
      </div>

      <div className="change-content">
        <div className="change-description">{change.description}</div>

        {change.maps_to_algolia && (
          <div className="algolia-insight">
            <LightbulbIcon />
            {change.maps_to_algolia}
          </div>
        )}

        {/* Show before/after for modifications */}
        {change.change_type === 'modified' && (
          <div className="change-diff">
            <span className="old-value">{formatValue(change.old_value)}</span>
            <ArrowIcon />
            <span className="new-value">{formatValue(change.new_value)}</span>
          </div>
        )}
      </div>

      <SignificanceDot level={change.significance} />
    </div>
  );
};
```

### 4.2 Comparison View

```typescript
// frontend/src/components/changes/SnapshotComparison.tsx

interface ComparisonProps {
  previousSnapshot: Snapshot;
  currentSnapshot: Snapshot;
  changes: ChangeReport;
}

export const SnapshotComparison: FC<ComparisonProps> = ({
  previousSnapshot,
  currentSnapshot,
  changes,
}) => {
  return (
    <div className="snapshot-comparison">
      <div className="comparison-header">
        <div className="snapshot-label">
          <CalendarIcon />
          {formatDate(previousSnapshot.snapshot_date)}
        </div>
        <ArrowIcon />
        <div className="snapshot-label current">
          <CalendarIcon />
          {formatDate(currentSnapshot.snapshot_date)}
          <Badge>Current</Badge>
        </div>
      </div>

      {/* Side-by-side module comparison */}
      <div className="modules-comparison">
        {MODULES.map(module => (
          <ModuleComparison
            key={module.id}
            module={module}
            previous={previousSnapshot[module.field]}
            current={currentSnapshot[module.field]}
            changes={changes.changes.filter(c => c.module === module.id)}
          />
        ))}
      </div>
    </div>
  );
};

// Module comparison component
const ModuleComparison: FC<ModuleComparisonProps> = ({
  module,
  previous,
  current,
  changes,
}) => {
  const hasChanges = changes.length > 0;

  return (
    <div className={`module-comparison ${hasChanges ? 'has-changes' : ''}`}>
      <div className="module-header">
        <ModuleIcon module={module} />
        <span>{module.name}</span>
        {hasChanges && (
          <Badge variant="change">{changes.length} changes</Badge>
        )}
      </div>

      <div className="comparison-content">
        <div className="snapshot-column previous">
          <ModuleDataView data={previous} highlightRemovals={changes} />
        </div>

        <div className="changes-column">
          {changes.map(c => (
            <ChangeIndicator key={c.id} change={c} />
          ))}
        </div>

        <div className="snapshot-column current">
          <ModuleDataView data={current} highlightAdditions={changes} />
        </div>
      </div>
    </div>
  );
};
```

---

## 5. Scheduled Enrichment & Change Detection

### 5.1 Scheduler Configuration

```python
# scheduler/jobs.py

class EnrichmentScheduler:
    """
    Schedules periodic enrichment for change detection.
    """

    # Default schedules by priority
    SCHEDULES = {
        "HOT": timedelta(days=7),      # Weekly for hot leads
        "WARM": timedelta(days=14),    # Bi-weekly for warm
        "COOL": timedelta(days=30),    # Monthly for cool
        "COLD": timedelta(days=90),    # Quarterly for cold
    }

    async def schedule_enrichment(
        self,
        domain: str,
        priority: str,
        force: bool = False,
    ):
        """Schedule next enrichment based on priority."""

        schedule = self.SCHEDULES.get(priority, timedelta(days=30))
        next_run = datetime.utcnow() + schedule

        await self.job_queue.schedule(
            job_type="enrichment",
            domain=domain,
            scheduled_for=next_run,
            metadata={
                "priority": priority,
                "auto_scheduled": True,
            }
        )

    async def run_scheduled_enrichments(self):
        """
        Run all due scheduled enrichments.
        Called by cron job.
        """
        due_jobs = await self.job_queue.get_due_jobs("enrichment")

        for job in due_jobs:
            # Get previous snapshot
            previous = await self.get_latest_snapshot(job.domain)

            # Run enrichment
            result = await self.orchestrator.enrich(job.domain)

            # Create new snapshot
            current = await self.create_snapshot(job.domain, result)

            # Detect changes
            if previous:
                changes = await self.change_detector.detect_changes(
                    previous, current
                )

                # Store changes
                await self.store_changes(changes)

                # Send notifications
                await self.notification_service.process_change_report(changes)

            # Schedule next run
            await self.schedule_enrichment(
                domain=job.domain,
                priority=current.priority,
            )
```

---

## 6. API Endpoints

```python
# api/changes.py

@router.get("/company/{domain}/snapshots")
async def list_snapshots(
    domain: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """List all snapshots for a domain."""
    snapshots = await db.execute(
        select(IntelSnapshot)
        .where(IntelSnapshot.domain == domain)
        .order_by(IntelSnapshot.snapshot_date.desc())
        .limit(limit)
    )
    return snapshots.scalars().all()


@router.get("/company/{domain}/changes")
async def list_changes(
    domain: str,
    significance: str = None,  # Filter by significance
    opportunity_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List all detected changes for a domain."""
    query = select(IntelChangeDetail).where(
        IntelChangeDetail.domain == domain
    )

    if significance:
        query = query.where(IntelChangeDetail.significance == significance)

    if opportunity_only:
        query = query.where(IntelChangeDetail.opportunity_signal == True)

    query = query.order_by(IntelChangeDetail.detected_at.desc()).limit(limit)

    changes = await db.execute(query)
    return changes.scalars().all()


@router.get("/company/{domain}/compare/{snapshot_id_1}/{snapshot_id_2}")
async def compare_snapshots(
    domain: str,
    snapshot_id_1: UUID,
    snapshot_id_2: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Compare two snapshots and return changes."""
    snapshot_1 = await db.get(IntelSnapshot, snapshot_id_1)
    snapshot_2 = await db.get(IntelSnapshot, snapshot_id_2)

    if not snapshot_1 or not snapshot_2:
        raise HTTPException(404, "Snapshot not found")

    detector = ChangeDetector()
    changes = await detector.detect_changes(snapshot_1, snapshot_2)

    return changes


@router.get("/changes/feed")
async def get_change_feed(
    user: User = Depends(get_current_user),
    significance: str = None,
    opportunity_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """
    Get change feed for current user's accounts.
    Shows all recent changes across their territory.
    """
    # Get user's assigned accounts
    account_domains = await get_user_accounts(user.id, db)

    query = (
        select(IntelChangeDetail)
        .where(IntelChangeDetail.domain.in_(account_domains))
        .order_by(IntelChangeDetail.detected_at.desc())
        .limit(limit)
    )

    if significance:
        query = query.where(IntelChangeDetail.significance == significance)

    if opportunity_only:
        query = query.where(IntelChangeDetail.opportunity_signal == True)

    changes = await db.execute(query)
    return changes.scalars().all()
```

---

## 7. Integration with Existing Architecture

### 7.1 Orchestrator Updates

```python
# orchestrator.py - Updated to create snapshots

class EnrichmentOrchestrator:

    async def enrich(self, request: EnrichmentRequest) -> EnrichmentResult:
        # ... existing enrichment logic ...

        # After successful enrichment:
        result = await self._run_waves(domain)

        # Create snapshot
        snapshot = await self._create_snapshot(domain, result)

        # Detect changes from previous snapshot
        previous = await self._get_previous_snapshot(domain)
        if previous:
            changes = await self.change_detector.detect_changes(
                previous, snapshot
            )
            await self._store_changes(changes)

            # Trigger notifications asynchronously
            asyncio.create_task(
                self.notification_service.process_change_report(changes)
            )

        return EnrichmentResult(
            snapshot_id=snapshot.id,
            changes=changes if previous else None,
            **result,
        )
```

---

*Document created: 2026-02-25*
*Author: Thread 2 - Data Pipeline*
*Status: Architecture Design Complete*
*Priority: P1 - Critical for Enterprise ABM*
