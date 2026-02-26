"""
Alerts API Endpoints

Alert rules, notifications, and digest management endpoints.

Endpoints:
- GET  /api/v1/alerts           - List alerts for current user
- POST /api/v1/alerts/{id}/read - Mark alert as read
- POST /api/v1/alerts/read-bulk - Mark multiple alerts as read
- POST /api/v1/alerts/{id}/dismiss - Dismiss alert
- POST /api/v1/alerts/{id}/act  - Mark alert as acted upon
- GET  /api/v1/alerts/rules     - List alert rules
- POST /api/v1/alerts/rules     - Create alert rule
- GET  /api/v1/alerts/rules/{id} - Get alert rule
- PUT  /api/v1/alerts/rules/{id} - Update alert rule
- DELETE /api/v1/alerts/rules/{id} - Delete alert rule
- GET  /api/v1/alerts/digest    - Get alert digest
- GET  /api/v1/alerts/preferences - Get alert preferences
- PUT  /api/v1/alerts/preferences - Update alert preferences
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid
import logging

from ..deps import get_db, get_current_user, CurrentUser
from ..schemas.alerts import (
    # Rule schemas
    AlertRuleCreate,
    AlertRuleUpdate,
    AlertRuleResponse,
    AlertRuleListResponse,
    # Alert schemas
    AlertResponse,
    AlertListResponse,
    AlertMarkReadRequest,
    AlertMarkReadResponse,
    AlertChangeDetail,
    # Digest schemas
    AlertDigestResponse,
    DigestSummaryByCategory,
    DigestSummaryByDomain,
    # Preference schemas
    AlertPreferenceUpdate,
    AlertPreferenceResponse,
    # Enums
    AlertStatus,
    AlertSignificance,
    AlertChannel,
    AlertFrequency,
    ChangeCategory,
)
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["Alerts"])
settings = get_settings()


# =============================================================================
# In-Memory Storage (Replace with DB in production)
# =============================================================================

_alert_rules: Dict[str, Dict[str, Any]] = {}
_alerts: Dict[str, Dict[str, Any]] = {}
_preferences: Dict[str, Dict[str, Any]] = {}


def _get_default_preferences(user_id: str) -> Dict[str, Any]:
    """Get default alert preferences."""
    return {
        "user_id": user_id,
        "alerts_enabled": True,
        "email_enabled": True,
        "slack_enabled": False,
        "in_app_enabled": True,
        "digest_frequency": "daily",
        "digest_time": "09:00",
        "quiet_hours_enabled": False,
        "quiet_hours_start": None,
        "quiet_hours_end": None,
        "quiet_hours_timezone": None,
        "min_significance_email": "high",
        "min_significance_slack": "critical",
        "updated_at": datetime.utcnow(),
    }


# =============================================================================
# Alert List Endpoints
# =============================================================================

@router.get("", response_model=AlertListResponse)
async def list_alerts(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter by status (unread/read/dismissed/acted)",
        regex="^(unread|read|dismissed|acted)$"
    ),
    significance: Optional[str] = Query(
        None,
        description="Filter by significance (critical/high/medium/low)",
        regex="^(critical|high|medium|low)$"
    ),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    List alerts for the current user.

    **Filters:**
    - `status`: Filter by alert status
    - `significance`: Filter by significance level
    - `domain`: Filter by company domain

    **Returns:**
    Paginated list of alerts with unread count.
    """
    # Filter alerts for current user
    user_alerts = []
    unread_count = 0

    for alert_id, alert in _alerts.items():
        if alert["user_id"] != current_user.user_id:
            continue

        # Apply filters
        if status_filter and alert["status"] != status_filter:
            continue
        if significance and alert["significance"] != significance:
            continue
        if domain and alert["domain"].lower() != domain.lower():
            continue

        user_alerts.append(alert)

        if alert["status"] == "unread":
            unread_count += 1

    # Sort by created_at descending
    user_alerts.sort(key=lambda x: x["created_at"], reverse=True)

    # Paginate
    total = len(user_alerts)
    offset = (page - 1) * limit
    paginated = user_alerts[offset:offset + limit]

    # Convert to response models
    alerts = []
    for alert in paginated:
        alerts.append(AlertResponse(
            id=alert["id"],
            rule_id=alert.get("rule_id"),
            user_id=alert["user_id"],
            domain=alert["domain"],
            module_type=alert.get("module_type"),
            title=alert["title"],
            summary=alert.get("summary"),
            changes=[AlertChangeDetail(**c) for c in alert.get("changes", [])],
            significance=AlertSignificance(alert["significance"]),
            recommended_action=alert.get("recommended_action"),
            algolia_opportunity=alert.get("algolia_opportunity"),
            status=AlertStatus(alert["status"]),
            created_at=alert["created_at"],
            read_at=alert.get("read_at"),
            dismissed_at=alert.get("dismissed_at"),
            acted_at=alert.get("acted_at"),
        ))

    return AlertListResponse(
        alerts=alerts,
        total=total,
        unread_count=unread_count,
        pagination={
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if limit > 0 else 0,
        }
    )


@router.post("/{alert_id}/read", response_model=AlertResponse)
async def mark_alert_read(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Mark a single alert as read.
    """
    alert = _alerts.get(alert_id)

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert not found: {alert_id}"
        )

    if alert["user_id"] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this alert"
        )

    # Update status
    alert["status"] = "read"
    alert["read_at"] = datetime.utcnow()

    logger.info(f"Alert marked as read: {alert_id} by {current_user.user_id}")

    return AlertResponse(
        id=alert["id"],
        rule_id=alert.get("rule_id"),
        user_id=alert["user_id"],
        domain=alert["domain"],
        module_type=alert.get("module_type"),
        title=alert["title"],
        summary=alert.get("summary"),
        changes=[AlertChangeDetail(**c) for c in alert.get("changes", [])],
        significance=AlertSignificance(alert["significance"]),
        recommended_action=alert.get("recommended_action"),
        algolia_opportunity=alert.get("algolia_opportunity"),
        status=AlertStatus(alert["status"]),
        created_at=alert["created_at"],
        read_at=alert.get("read_at"),
        dismissed_at=alert.get("dismissed_at"),
        acted_at=alert.get("acted_at"),
    )


@router.post("/read-bulk", response_model=AlertMarkReadResponse)
async def mark_alerts_read_bulk(
    request: AlertMarkReadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Mark multiple alerts as read.

    If alert_ids is None, marks all unread alerts as read.
    """
    marked_count = 0

    for alert_id, alert in _alerts.items():
        if alert["user_id"] != current_user.user_id:
            continue

        if alert["status"] != "unread":
            continue

        # Filter by specific IDs if provided
        if request.alert_ids and alert_id not in request.alert_ids:
            continue

        alert["status"] = "read"
        alert["read_at"] = datetime.utcnow()
        marked_count += 1

    # Count remaining unread
    remaining = sum(
        1 for a in _alerts.values()
        if a["user_id"] == current_user.user_id and a["status"] == "unread"
    )

    logger.info(f"Bulk marked {marked_count} alerts as read for {current_user.user_id}")

    return AlertMarkReadResponse(
        marked_count=marked_count,
        remaining_unread=remaining,
    )


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Dismiss an alert (user acknowledged but not acting on it).
    """
    alert = _alerts.get(alert_id)

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert not found: {alert_id}"
        )

    if alert["user_id"] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this alert"
        )

    alert["status"] = "dismissed"
    alert["dismissed_at"] = datetime.utcnow()

    logger.info(f"Alert dismissed: {alert_id} by {current_user.user_id}")

    return {"message": "Alert dismissed", "alert_id": alert_id}


@router.post("/{alert_id}/act")
async def mark_alert_acted(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Mark an alert as acted upon (user took action based on the alert).
    """
    alert = _alerts.get(alert_id)

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert not found: {alert_id}"
        )

    if alert["user_id"] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this alert"
        )

    alert["status"] = "acted"
    alert["acted_at"] = datetime.utcnow()

    logger.info(f"Alert marked as acted: {alert_id} by {current_user.user_id}")

    return {"message": "Alert marked as acted upon", "alert_id": alert_id}


# =============================================================================
# Alert Rules Endpoints
# =============================================================================

@router.get("/rules", response_model=AlertRuleListResponse)
async def list_alert_rules(
    active_only: bool = Query(False, description="Only return active rules"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    List alert rules for the current user.
    """
    user_rules = []
    active_count = 0

    for rule_id, rule in _alert_rules.items():
        if rule["user_id"] != current_user.user_id:
            continue

        if active_only and not rule["is_active"]:
            continue

        if rule["is_active"]:
            active_count += 1

        user_rules.append(AlertRuleResponse(
            id=rule["id"],
            user_id=rule["user_id"],
            name=rule["name"],
            description=rule.get("description"),
            is_active=rule["is_active"],
            conditions=rule["conditions"],
            channels=rule["channels"],
            frequency=rule["frequency"],
            trigger_count=rule.get("trigger_count", 0),
            last_triggered=rule.get("last_triggered"),
            created_at=rule["created_at"],
            updated_at=rule["updated_at"],
        ))

    return AlertRuleListResponse(
        rules=user_rules,
        total=len(user_rules),
        active_count=active_count,
    )


@router.post("/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    rule_data: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Create a new alert rule.

    **Request Body:**
    - `name`: Rule name
    - `description`: Optional description
    - `conditions`: Alert conditions (scope, categories, significance)
    - `channels`: Notification channels (in_app, email, slack)
    - `frequency`: Delivery frequency (immediate, hourly_digest, daily_digest)
    - `is_active`: Whether rule is active
    """
    rule_id = str(uuid.uuid4())
    now = datetime.utcnow()

    rule = {
        "id": rule_id,
        "user_id": current_user.user_id,
        "name": rule_data.name,
        "description": rule_data.description,
        "is_active": rule_data.is_active,
        "conditions": rule_data.conditions.model_dump(),
        "channels": [c.value for c in rule_data.channels],
        "frequency": rule_data.frequency.value,
        "trigger_count": 0,
        "last_triggered": None,
        "created_at": now,
        "updated_at": now,
    }

    _alert_rules[rule_id] = rule

    logger.info(f"Alert rule created: {rule_id} '{rule_data.name}' by {current_user.user_id}")

    return AlertRuleResponse(
        id=rule["id"],
        user_id=rule["user_id"],
        name=rule["name"],
        description=rule.get("description"),
        is_active=rule["is_active"],
        conditions=rule["conditions"],
        channels=rule["channels"],
        frequency=rule["frequency"],
        trigger_count=rule["trigger_count"],
        last_triggered=rule.get("last_triggered"),
        created_at=rule["created_at"],
        updated_at=rule["updated_at"],
    )


@router.get("/rules/{rule_id}", response_model=AlertRuleResponse)
async def get_alert_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get a single alert rule.
    """
    rule = _alert_rules.get(rule_id)

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule not found: {rule_id}"
        )

    if rule["user_id"] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this rule"
        )

    return AlertRuleResponse(
        id=rule["id"],
        user_id=rule["user_id"],
        name=rule["name"],
        description=rule.get("description"),
        is_active=rule["is_active"],
        conditions=rule["conditions"],
        channels=rule["channels"],
        frequency=rule["frequency"],
        trigger_count=rule.get("trigger_count", 0),
        last_triggered=rule.get("last_triggered"),
        created_at=rule["created_at"],
        updated_at=rule["updated_at"],
    )


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: str,
    update_data: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Update an alert rule.

    Only provided fields will be updated.
    """
    rule = _alert_rules.get(rule_id)

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule not found: {rule_id}"
        )

    if rule["user_id"] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this rule"
        )

    # Update fields
    if update_data.name is not None:
        rule["name"] = update_data.name
    if update_data.description is not None:
        rule["description"] = update_data.description
    if update_data.is_active is not None:
        rule["is_active"] = update_data.is_active
    if update_data.conditions is not None:
        rule["conditions"] = update_data.conditions.model_dump()
    if update_data.channels is not None:
        rule["channels"] = [c.value for c in update_data.channels]
    if update_data.frequency is not None:
        rule["frequency"] = update_data.frequency.value

    rule["updated_at"] = datetime.utcnow()

    logger.info(f"Alert rule updated: {rule_id} by {current_user.user_id}")

    return AlertRuleResponse(
        id=rule["id"],
        user_id=rule["user_id"],
        name=rule["name"],
        description=rule.get("description"),
        is_active=rule["is_active"],
        conditions=rule["conditions"],
        channels=rule["channels"],
        frequency=rule["frequency"],
        trigger_count=rule.get("trigger_count", 0),
        last_triggered=rule.get("last_triggered"),
        created_at=rule["created_at"],
        updated_at=rule["updated_at"],
    )


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Delete an alert rule.
    """
    rule = _alert_rules.get(rule_id)

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule not found: {rule_id}"
        )

    if rule["user_id"] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this rule"
        )

    del _alert_rules[rule_id]

    logger.info(f"Alert rule deleted: {rule_id} by {current_user.user_id}")


# =============================================================================
# Digest Endpoint
# =============================================================================

@router.get("/digest", response_model=AlertDigestResponse)
async def get_alert_digest(
    period: str = Query(
        "daily",
        description="Digest period (hourly/daily)",
        regex="^(hourly|daily)$"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get alert digest for the current user.

    Aggregates alerts from the specified period into a summary.

    **Query Parameters:**
    - `period`: hourly or daily
    """
    now = datetime.utcnow()

    if period == "hourly":
        period_start = now - timedelta(hours=1)
    else:
        period_start = now - timedelta(days=1)

    # Collect alerts in period
    period_alerts = []
    for alert in _alerts.values():
        if alert["user_id"] != current_user.user_id:
            continue
        if alert["created_at"] >= period_start:
            period_alerts.append(alert)

    # Count by significance
    critical_count = sum(1 for a in period_alerts if a["significance"] == "critical")
    high_count = sum(1 for a in period_alerts if a["significance"] == "high")
    medium_count = sum(1 for a in period_alerts if a["significance"] == "medium")

    # Group by category
    by_category: Dict[str, List[str]] = {}
    for alert in period_alerts:
        for change in alert.get("changes", []):
            cat = change.get("category", "strategic_change")
            if cat not in by_category:
                by_category[cat] = []
            if alert["domain"] not in by_category[cat]:
                by_category[cat].append(alert["domain"])

    valid_categories = [c.value for c in ChangeCategory]
    category_summaries = []
    for cat, domains in by_category.items():
        if cat in valid_categories:
            category_summaries.append(DigestSummaryByCategory(
                category=ChangeCategory(cat),
                count=len(domains),
                domains=domains,
                highest_significance=AlertSignificance.HIGH,
            ))

    # Group by domain
    by_domain: Dict[str, List[Dict]] = {}
    for alert in period_alerts:
        domain = alert["domain"]
        if domain not in by_domain:
            by_domain[domain] = []
        by_domain[domain].append(alert)

    domain_summaries = []
    for domain, alerts in by_domain.items():
        categories = []
        for a in alerts:
            for c in a.get("changes", []):
                cat = c.get("category")
                if cat in valid_categories:
                    categories.append(ChangeCategory(cat))

        domain_summaries.append(DigestSummaryByDomain(
            domain=domain,
            company_name=None,
            alert_count=len(alerts),
            highest_significance=AlertSignificance(
                max((a["significance"] for a in alerts), default="low")
            ),
            categories=list(set(categories))[:5],
        ))

    # Sort domain summaries by alert count
    domain_summaries.sort(key=lambda x: x.alert_count, reverse=True)

    # Build top alerts
    top_alerts_raw = sorted(period_alerts, key=lambda x: x["created_at"], reverse=True)[:5]
    top_alerts = [
        AlertResponse(
            id=a["id"],
            rule_id=a.get("rule_id"),
            user_id=a["user_id"],
            domain=a["domain"],
            module_type=a.get("module_type"),
            title=a["title"],
            summary=a.get("summary"),
            changes=[AlertChangeDetail(**c) for c in a.get("changes", [])],
            significance=AlertSignificance(a["significance"]),
            recommended_action=a.get("recommended_action"),
            algolia_opportunity=a.get("algolia_opportunity"),
            status=AlertStatus(a["status"]),
            created_at=a["created_at"],
            read_at=a.get("read_at"),
            dismissed_at=a.get("dismissed_at"),
            acted_at=a.get("acted_at"),
        )
        for a in top_alerts_raw
    ]

    return AlertDigestResponse(
        digest_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        digest_type=period,
        period_start=period_start,
        period_end=now,
        total_alerts=len(period_alerts),
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        by_category=category_summaries,
        by_domain=domain_summaries[:10],
        top_alerts=top_alerts,
        generated_at=now,
    )


# =============================================================================
# Preferences Endpoints
# =============================================================================

@router.get("/preferences", response_model=AlertPreferenceResponse)
async def get_alert_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get alert preferences for the current user.
    """
    prefs = _preferences.get(current_user.user_id)

    if not prefs:
        prefs = _get_default_preferences(current_user.user_id)
        _preferences[current_user.user_id] = prefs

    return AlertPreferenceResponse(**prefs)


@router.put("/preferences", response_model=AlertPreferenceResponse)
async def update_alert_preferences(
    update_data: AlertPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Update alert preferences for the current user.

    Only provided fields will be updated.
    """
    prefs = _preferences.get(current_user.user_id)

    if not prefs:
        prefs = _get_default_preferences(current_user.user_id)

    # Update provided fields
    update_dict = update_data.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in update_dict.items():
        if hasattr(value, "value"):  # Enum
            prefs[key] = value.value
        else:
            prefs[key] = value

    prefs["updated_at"] = datetime.utcnow()
    _preferences[current_user.user_id] = prefs

    logger.info(f"Alert preferences updated for {current_user.user_id}")

    return AlertPreferenceResponse(**prefs)
