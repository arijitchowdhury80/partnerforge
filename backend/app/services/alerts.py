"""
PartnerForge Alert Service

Manages alert rules, notifications, and digests.

Responsibilities:
- Create and manage alert rules
- Evaluate changes against rules
- Trigger alerts when rules match
- Create daily/hourly digests
- Track alert delivery status

CRITICAL: Alerts trace back to ChangeEvents which trace back to
IntelSnapshots with valid source citations.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, desc, and_, or_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import uuid
import json

from ..models.alerts import AlertRule, Alert, AlertDigest
from ..models.versioning import ChangeEvent
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# Significance level hierarchy for comparison
SIGNIFICANCE_HIERARCHY = {
    "critical": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
}


class AlertService:
    """
    Service for managing alerts and alert rules.

    This service:
    - Creates and manages user alert rules
    - Evaluates change events against rules
    - Triggers alerts when rules match
    - Creates periodic digests
    - Tracks alert read/delivery status

    Methods:
        create_rule: Create a new alert rule
        update_rule: Update an existing rule
        delete_rule: Delete a rule
        evaluate_rule: Check if a change event matches a rule
        trigger_alert: Create an alert from a matched rule
        get_user_alerts: Get alerts for a user
        mark_read: Mark an alert as read
        mark_acted: Mark an alert as acted upon
        create_digest: Create a periodic digest
        get_user_rules: Get all rules for a user
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize the alert service.

        Args:
            session: Async database session
        """
        self.session = session

    async def create_rule(
        self,
        user_id: str,
        name: str,
        conditions: Dict[str, Any],
        channels: Optional[List[str]] = None,
        description: Optional[str] = None,
        frequency: str = "immediate",
    ) -> AlertRule:
        """
        Create a new alert rule.

        Args:
            user_id: ID of the user creating the rule
            name: Human-readable rule name
            conditions: Rule conditions dict
                - scope: "my_territory" | "all" | ["domain1", "domain2"]
                - change_categories: List of categories to match
                - min_significance: Minimum significance level
                - score_threshold: {"field": str, "operator": str, "value": int}
                - module_types: List of module types to match
            channels: Notification channels ["in_app", "email", "slack"]
            description: Optional description
            frequency: "immediate" | "hourly_digest" | "daily_digest"

        Returns:
            AlertRule: The created rule

        Raises:
            ValueError: If conditions are invalid
        """
        # Validate conditions
        self._validate_conditions(conditions)

        if channels is None:
            channels = ["in_app"]

        rule = AlertRule(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            description=description,
            is_active=True,
            conditions=conditions,
            channels=channels,
            frequency=frequency,
            trigger_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.session.add(rule)
        await self.session.flush()

        logger.info(f"Created alert rule '{name}' for user {user_id}")
        return rule

    async def update_rule(
        self,
        rule_id: str,
        updates: Dict[str, Any],
    ) -> Optional[AlertRule]:
        """
        Update an existing alert rule.

        Args:
            rule_id: ID of the rule to update
            updates: Dict of fields to update

        Returns:
            Updated AlertRule or None if not found
        """
        query = select(AlertRule).where(AlertRule.id == rule_id)
        result = await self.session.execute(query)
        rule = result.scalar_one_or_none()

        if rule is None:
            return None

        # Update allowed fields
        allowed_fields = [
            "name", "description", "is_active", "conditions",
            "channels", "frequency"
        ]

        for field, value in updates.items():
            if field in allowed_fields:
                if field == "conditions":
                    self._validate_conditions(value)
                setattr(rule, field, value)

        rule.updated_at = datetime.utcnow()
        await self.session.flush()

        logger.info(f"Updated alert rule {rule_id}")
        return rule

    async def delete_rule(self, rule_id: str) -> bool:
        """
        Delete an alert rule.

        Args:
            rule_id: ID of the rule to delete

        Returns:
            True if deleted, False if not found
        """
        query = select(AlertRule).where(AlertRule.id == rule_id)
        result = await self.session.execute(query)
        rule = result.scalar_one_or_none()

        if rule is None:
            return False

        await self.session.delete(rule)
        await self.session.flush()

        logger.info(f"Deleted alert rule {rule_id}")
        return True

    async def get_user_rules(
        self,
        user_id: str,
        active_only: bool = False,
    ) -> List[AlertRule]:
        """
        Get all alert rules for a user.

        Args:
            user_id: User ID
            active_only: Only return active rules

        Returns:
            List of AlertRule records
        """
        conditions = [AlertRule.user_id == user_id]
        if active_only:
            conditions.append(AlertRule.is_active == True)

        query = (
            select(AlertRule)
            .where(and_(*conditions))
            .order_by(desc(AlertRule.created_at))
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    def evaluate_rule(
        self,
        rule: AlertRule,
        change_event: ChangeEvent,
        user_territory_domains: Optional[List[str]] = None,
    ) -> bool:
        """
        Evaluate if a change event matches an alert rule.

        Args:
            rule: The alert rule to evaluate
            change_event: The change event to check
            user_territory_domains: List of domains in user's territory
                (required if scope is "my_territory")

        Returns:
            True if the change matches the rule
        """
        if not rule.is_active:
            return False

        conditions = rule.conditions

        # Check scope
        scope = conditions.get("scope", "all")
        if scope == "my_territory":
            if user_territory_domains is None:
                return False
            if change_event.domain not in user_territory_domains:
                return False
        elif isinstance(scope, list):
            if change_event.domain not in scope:
                return False
        # "all" matches everything

        # Check change categories
        categories = conditions.get("change_categories")
        if categories and change_event.category not in categories:
            return False

        # Check minimum significance
        min_sig = conditions.get("min_significance")
        if min_sig:
            min_level = SIGNIFICANCE_HIERARCHY.get(min_sig.lower(), 0)
            event_level = SIGNIFICANCE_HIERARCHY.get(change_event.significance, 0)
            if event_level < min_level:
                return False

        # Check module types
        module_types = conditions.get("module_types")
        if module_types and change_event.module_type not in module_types:
            return False

        # All conditions passed
        return True

    async def trigger_alert(
        self,
        rule: AlertRule,
        change_event: ChangeEvent,
        snapshot_id: Optional[str] = None,
    ) -> Alert:
        """
        Trigger an alert based on a matched rule and change event.

        Args:
            rule: The matched alert rule
            change_event: The triggering change event
            snapshot_id: Optional snapshot ID for context

        Returns:
            Alert: The created alert
        """
        # Generate alert content
        title = self._generate_alert_title(change_event)
        summary = self._generate_alert_summary(change_event)
        recommended_action = self._generate_recommended_action(change_event)
        algolia_opportunity = change_event.algolia_relevance

        alert = Alert(
            id=str(uuid.uuid4()),
            rule_id=rule.id,
            user_id=rule.user_id,
            domain=change_event.domain,
            module_type=change_event.module_type,
            snapshot_id=snapshot_id or change_event.snapshot_id,
            title=title,
            summary=summary,
            changes=[{
                "category": change_event.category,
                "field": change_event.field,
                "old_value": change_event.old_value,
                "new_value": change_event.new_value,
                "significance": change_event.significance,
            }],
            significance=change_event.significance,
            recommended_action=recommended_action,
            algolia_opportunity=algolia_opportunity,
            status="unread",
            delivered_channels=[],
            created_at=datetime.utcnow(),
        )

        self.session.add(alert)

        # Update rule statistics
        rule.trigger_count = (rule.trigger_count or 0) + 1
        rule.last_triggered = datetime.utcnow()

        await self.session.flush()

        logger.info(
            f"Triggered alert for rule '{rule.name}' on {change_event.domain}"
        )

        return alert

    async def get_user_alerts(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Alert]:
        """
        Get alerts for a user.

        Args:
            user_id: User ID
            status: Filter by status (unread/read/dismissed/acted)
            limit: Maximum alerts to return
            offset: Pagination offset

        Returns:
            List of Alert records
        """
        conditions = [Alert.user_id == user_id]
        if status:
            conditions.append(Alert.status == status)

        query = (
            select(Alert)
            .where(and_(*conditions))
            .order_by(desc(Alert.created_at))
            .offset(offset)
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_alert_count(
        self,
        user_id: str,
        status: Optional[str] = None,
    ) -> int:
        """
        Get count of alerts for a user.

        Args:
            user_id: User ID
            status: Filter by status

        Returns:
            Count of matching alerts
        """
        conditions = [Alert.user_id == user_id]
        if status:
            conditions.append(Alert.status == status)

        query = (
            select(func.count(Alert.id))
            .where(and_(*conditions))
        )

        result = await self.session.execute(query)
        return result.scalar_one()

    async def mark_read(self, alert_id: str) -> Optional[Alert]:
        """
        Mark an alert as read.

        Args:
            alert_id: Alert ID

        Returns:
            Updated Alert or None if not found
        """
        query = select(Alert).where(Alert.id == alert_id)
        result = await self.session.execute(query)
        alert = result.scalar_one_or_none()

        if alert is None:
            return None

        alert.status = "read"
        alert.read_at = datetime.utcnow()
        await self.session.flush()

        return alert

    async def mark_acted(
        self,
        alert_id: str,
        action_notes: Optional[str] = None,
    ) -> Optional[Alert]:
        """
        Mark an alert as acted upon.

        Args:
            alert_id: Alert ID
            action_notes: Optional notes about the action taken

        Returns:
            Updated Alert or None if not found
        """
        query = select(Alert).where(Alert.id == alert_id)
        result = await self.session.execute(query)
        alert = result.scalar_one_or_none()

        if alert is None:
            return None

        alert.status = "acted"
        alert.acted_at = datetime.utcnow()
        if alert.read_at is None:
            alert.read_at = datetime.utcnow()

        await self.session.flush()
        return alert

    async def dismiss_alert(self, alert_id: str) -> Optional[Alert]:
        """
        Dismiss an alert.

        Args:
            alert_id: Alert ID

        Returns:
            Updated Alert or None if not found
        """
        query = select(Alert).where(Alert.id == alert_id)
        result = await self.session.execute(query)
        alert = result.scalar_one_or_none()

        if alert is None:
            return None

        alert.status = "dismissed"
        alert.dismissed_at = datetime.utcnow()
        await self.session.flush()

        return alert

    async def create_digest(
        self,
        user_id: str,
        period: str = "daily",
    ) -> Optional[AlertDigest]:
        """
        Create a periodic digest for a user.

        Aggregates all unread alerts in the period into a single digest.

        Args:
            user_id: User ID
            period: "hourly" or "daily"

        Returns:
            AlertDigest or None if no alerts in period
        """
        # Calculate period boundaries
        now = datetime.utcnow()
        if period == "hourly":
            period_start = now - timedelta(hours=1)
        else:  # daily
            period_start = now - timedelta(days=1)

        # Get alerts in period
        query = (
            select(Alert)
            .where(
                and_(
                    Alert.user_id == user_id,
                    Alert.created_at >= period_start,
                    Alert.created_at < now,
                )
            )
            .order_by(desc(Alert.created_at))
        )

        result = await self.session.execute(query)
        alerts = list(result.scalars().all())

        if not alerts:
            return None

        # Calculate summaries
        alert_ids = [a.id for a in alerts]
        significance_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        category_counts: Dict[str, int] = {}
        domain_counts: Dict[str, int] = {}

        for alert in alerts:
            # Count by significance
            sig = alert.significance or "low"
            significance_counts[sig] = significance_counts.get(sig, 0) + 1

            # Count by category (from changes)
            if alert.changes:
                for change in alert.changes:
                    cat = change.get("category", "unknown")
                    category_counts[cat] = category_counts.get(cat, 0) + 1

            # Count by domain
            domain_counts[alert.domain] = domain_counts.get(alert.domain, 0) + 1

        # Generate content
        html_content = self._generate_digest_html(alerts, significance_counts)
        text_content = self._generate_digest_text(alerts, significance_counts)

        digest = AlertDigest(
            id=str(uuid.uuid4()),
            user_id=user_id,
            digest_type=period,
            period_start=period_start,
            period_end=now,
            alert_count=len(alerts),
            alert_ids=alert_ids,
            critical_count=significance_counts["critical"],
            high_count=significance_counts["high"],
            medium_count=significance_counts["medium"],
            summary_by_category=category_counts,
            summary_by_domain=domain_counts,
            html_content=html_content,
            text_content=text_content,
            status="pending",
        )

        self.session.add(digest)
        await self.session.flush()

        logger.info(
            f"Created {period} digest for user {user_id} with {len(alerts)} alerts"
        )

        return digest

    async def get_pending_digests(self) -> List[AlertDigest]:
        """
        Get all pending digests ready for delivery.

        Returns:
            List of pending AlertDigest records
        """
        query = (
            select(AlertDigest)
            .where(AlertDigest.status == "pending")
            .order_by(AlertDigest.period_end)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def mark_digest_sent(
        self,
        digest_id: str,
        error_message: Optional[str] = None,
    ) -> Optional[AlertDigest]:
        """
        Mark a digest as sent or failed.

        Args:
            digest_id: Digest ID
            error_message: Error message if delivery failed

        Returns:
            Updated AlertDigest
        """
        query = select(AlertDigest).where(AlertDigest.id == digest_id)
        result = await self.session.execute(query)
        digest = result.scalar_one_or_none()

        if digest is None:
            return None

        if error_message:
            digest.status = "failed"
            digest.error_message = error_message
        else:
            digest.status = "sent"
            digest.sent_at = datetime.utcnow()

        await self.session.flush()
        return digest

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    def _validate_conditions(self, conditions: Dict[str, Any]) -> None:
        """Validate alert rule conditions."""
        if not conditions:
            raise ValueError("Conditions cannot be empty")

        # Validate scope
        scope = conditions.get("scope")
        if scope is not None:
            if not isinstance(scope, (str, list)):
                raise ValueError("Scope must be string or list")
            if isinstance(scope, str) and scope not in ["my_territory", "all"]:
                raise ValueError("Invalid scope string")

        # Validate min_significance
        min_sig = conditions.get("min_significance")
        if min_sig and min_sig.lower() not in SIGNIFICANCE_HIERARCHY:
            raise ValueError(f"Invalid significance level: {min_sig}")

        # Validate change_categories
        categories = conditions.get("change_categories")
        if categories and not isinstance(categories, list):
            raise ValueError("change_categories must be a list")

    def _generate_alert_title(self, change_event: ChangeEvent) -> str:
        """Generate alert title from change event."""
        category_titles = {
            "executive_change": "Executive Change",
            "tech_stack_change": "Tech Stack Change",
            "score_change": "Score Change",
            "hiring_change": "Hiring Signal",
            "financial_change": "Financial Change",
            "competitive_change": "Competitive Update",
            "strategic_change": "Strategic Change",
        }

        category_title = category_titles.get(change_event.category, "Change Detected")
        return f"{change_event.domain}: {category_title}"

    def _generate_alert_summary(self, change_event: ChangeEvent) -> str:
        """Generate alert summary from change event."""
        return change_event.summary or (
            f"{change_event.field} changed in {change_event.module_type}"
        )

    def _generate_recommended_action(self, change_event: ChangeEvent) -> str:
        """Generate recommended action based on change type."""
        actions = {
            "critical": "Immediate attention required - consider reaching out today",
            "high": "Follow up within this week",
            "medium": "Add to pipeline review for next planning session",
            "low": "Note for future reference",
        }
        return actions.get(change_event.significance, actions["low"])

    def _generate_digest_html(
        self,
        alerts: List[Alert],
        significance_counts: Dict[str, int],
    ) -> str:
        """Generate HTML content for digest email."""
        critical = significance_counts.get("critical", 0)
        high = significance_counts.get("high", 0)

        html = f"""
        <html>
        <body>
        <h1>PartnerForge Alert Digest</h1>
        <p>You have {len(alerts)} alerts to review.</p>
        <ul>
            <li><strong>Critical:</strong> {critical}</li>
            <li><strong>High:</strong> {high}</li>
            <li><strong>Medium:</strong> {significance_counts.get('medium', 0)}</li>
        </ul>
        <h2>Alerts</h2>
        <ul>
        """

        for alert in alerts[:10]:  # Limit to top 10
            html += f"<li><strong>{alert.title}</strong> - {alert.summary}</li>"

        if len(alerts) > 10:
            html += f"<li>... and {len(alerts) - 10} more</li>"

        html += """
        </ul>
        <p><a href="https://partnerforge.vercel.app/alerts">View all alerts</a></p>
        </body>
        </html>
        """

        return html

    def _generate_digest_text(
        self,
        alerts: List[Alert],
        significance_counts: Dict[str, int],
    ) -> str:
        """Generate plain text content for digest."""
        lines = [
            "PartnerForge Alert Digest",
            "=" * 40,
            f"Total alerts: {len(alerts)}",
            f"Critical: {significance_counts.get('critical', 0)}",
            f"High: {significance_counts.get('high', 0)}",
            "",
            "Alerts:",
            "-" * 40,
        ]

        for alert in alerts[:10]:
            lines.append(f"* {alert.title}")
            lines.append(f"  {alert.summary}")
            lines.append("")

        if len(alerts) > 10:
            lines.append(f"... and {len(alerts) - 10} more alerts")

        lines.append("")
        lines.append("View all: https://partnerforge.vercel.app/alerts")

        return "\n".join(lines)
