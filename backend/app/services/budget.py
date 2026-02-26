"""
PartnerForge Budget Service

Tracks API usage costs and enforces budget limits.

Responsibilities:
- Track every API call with associated cost
- Enforce budget limits (block at 100%)
- Send budget alerts at thresholds
- Provide usage breakdowns and reports

Cost tracking is essential for controlling enrichment costs
across BuiltWith, SimilarWeb, and Yahoo Finance APIs.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import select, desc, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import uuid

from ..models.platform import APIUsage, APIBudget, APICostConfig
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# Default API costs per call (USD)
DEFAULT_API_COSTS = {
    "builtwith": {
        "domain-lookup": 0.05,
        "free-api": 0.00,
        "relationships-api": 0.10,
        "recommendations-api": 0.05,
        "financial-api": 0.08,
        "social-api": 0.03,
        "trust-api": 0.03,
        "keywords-api": 0.05,
        "default": 0.05,
    },
    "similarweb": {
        "traffic": 0.02,
        "engagement": 0.02,
        "sources": 0.03,
        "geography": 0.02,
        "demographics": 0.03,
        "keywords": 0.04,
        "audience-interests": 0.03,
        "similar-sites": 0.02,
        "keywords-competitors": 0.04,
        "website-rank": 0.01,
        "referrals": 0.02,
        "popular-pages": 0.02,
        "leading-folders": 0.02,
        "landing-pages": 0.02,
        "default": 0.02,
    },
    "yahoo_finance": {
        "quote": 0.01,
        "financials": 0.03,
        "recommendations": 0.02,
        "news": 0.01,
        "holders": 0.02,
        "default": 0.02,
    },
    "websearch": {
        "default": 0.00,  # WebSearch is free
    },
}


class BudgetService:
    """
    Service for tracking API costs and enforcing budgets.

    This service:
    - Records every API call with cost
    - Checks budget before allowing calls
    - Sends alerts at threshold levels
    - Provides usage breakdowns

    Methods:
        track_api_call: Record an API call with cost
        get_usage: Get usage summary for a period
        check_budget: Check if budget allows a call
        set_budget: Create or update a budget
        get_cost_breakdown: Get detailed cost breakdown
        get_budget: Get current budget settings
        reset_budget_period: Reset for new period
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize the budget service.

        Args:
            session: Async database session
        """
        self.session = session

    async def track_api_call(
        self,
        provider: str,
        endpoint: str,
        user_id: Optional[str] = None,
        team_id: Optional[str] = None,
        domain: Optional[str] = None,
        job_id: Optional[str] = None,
        module_type: Optional[str] = None,
        cost_override: Optional[float] = None,
        status_code: int = 200,
        response_time_ms: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        triggered_by: str = "system",
    ) -> APIUsage:
        """
        Track an API call with associated cost.

        Args:
            provider: API provider (builtwith, similarweb, yahoo_finance)
            endpoint: Specific endpoint called
            user_id: User who triggered the call
            team_id: Team for budget tracking
            domain: Target domain for the call
            job_id: Enrichment job ID
            module_type: Module that made the call
            cost_override: Override calculated cost
            status_code: HTTP status code
            response_time_ms: Response time in milliseconds
            success: Whether the call succeeded
            error_message: Error message if failed
            triggered_by: "system", "user", "scheduled"

        Returns:
            APIUsage: The created usage record
        """
        # Calculate cost
        if cost_override is not None:
            cost = cost_override
        else:
            cost = self._get_cost_for_call(provider, endpoint)

        usage = APIUsage(
            id=str(uuid.uuid4()),
            provider=provider,
            endpoint=endpoint,
            method="GET",
            domain=domain,
            job_id=job_id,
            module_type=module_type,
            user_id=user_id,
            team_id=team_id,
            triggered_by=triggered_by,
            cost_usd=cost,
            cost_credits=cost,  # 1:1 mapping for now
            status_code=status_code,
            response_time_ms=response_time_ms,
            success=success,
            error_message=error_message,
            timestamp=datetime.utcnow(),
        )

        self.session.add(usage)

        # Update budget tracking if applicable
        if team_id or user_id:
            await self._update_budget_spend(
                user_id=user_id,
                team_id=team_id,
                cost=cost,
                provider=provider,
            )

        await self.session.flush()

        logger.debug(
            f"Tracked API call: {provider}/{endpoint} - ${cost:.4f} "
            f"(domain: {domain}, success: {success})"
        )

        return usage

    async def get_usage(
        self,
        user_id: Optional[str] = None,
        team_id: Optional[str] = None,
        period: str = "monthly",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Get usage summary for a period.

        Args:
            user_id: Filter by user
            team_id: Filter by team
            period: "daily", "weekly", "monthly", "custom"
            start_date: Custom start date
            end_date: Custom end date

        Returns:
            Dict with usage summary:
            - total_calls: int
            - total_cost_usd: float
            - by_provider: Dict[str, float]
            - period_start: datetime
            - period_end: datetime
        """
        # Calculate period boundaries
        now = datetime.utcnow()
        if start_date and end_date:
            period_start = start_date
            period_end = end_date
        elif period == "daily":
            period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            period_end = now
        elif period == "weekly":
            period_start = now - timedelta(days=now.weekday())
            period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
            period_end = now
        else:  # monthly
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            period_end = now

        # Build query conditions
        conditions = [
            APIUsage.timestamp >= period_start,
            APIUsage.timestamp <= period_end,
        ]
        if user_id:
            conditions.append(APIUsage.user_id == user_id)
        if team_id:
            conditions.append(APIUsage.team_id == team_id)

        # Get totals
        totals_query = (
            select(
                func.count(APIUsage.id).label("total_calls"),
                func.sum(APIUsage.cost_usd).label("total_cost"),
            )
            .where(and_(*conditions))
        )
        result = await self.session.execute(totals_query)
        row = result.one()
        total_calls = row.total_calls or 0
        total_cost = float(row.total_cost or 0)

        # Get breakdown by provider
        provider_query = (
            select(
                APIUsage.provider,
                func.sum(APIUsage.cost_usd).label("cost"),
                func.count(APIUsage.id).label("calls"),
            )
            .where(and_(*conditions))
            .group_by(APIUsage.provider)
        )
        result = await self.session.execute(provider_query)
        by_provider = {
            row.provider: {
                "cost_usd": float(row.cost or 0),
                "calls": row.calls,
            }
            for row in result.all()
        }

        return {
            "total_calls": total_calls,
            "total_cost_usd": total_cost,
            "by_provider": by_provider,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "period": period,
        }

    async def check_budget(
        self,
        user_id: Optional[str] = None,
        team_id: Optional[str] = None,
        estimated_cost: float = 0.0,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if budget allows a call.

        Args:
            user_id: User making the call
            team_id: Team for budget check
            estimated_cost: Estimated cost of the call

        Returns:
            Tuple of (allowed: bool, reason: Optional[str])
        """
        # Get applicable budget
        budget = await self._get_applicable_budget(user_id, team_id)

        if budget is None:
            # No budget set - allow by default
            return True, None

        current_spend = budget.current_spend_usd or 0
        limit = budget.budget_usd

        # Check if would exceed hard cap
        if budget.hard_cap:
            if current_spend + estimated_cost > limit:
                return False, f"Budget limit reached: ${current_spend:.2f}/${limit:.2f}"

        # Check alert thresholds
        new_spend = current_spend + estimated_cost
        pct = (new_spend / limit) * 100 if limit > 0 else 0

        # Send alerts if needed (but still allow)
        if pct >= 100 and not budget.alert_sent_100:
            logger.warning(f"Budget at 100%: {budget.scope_type}/{budget.scope_id}")
            budget.alert_sent_100 = True
            await self.session.flush()
        elif pct >= 80 and not budget.alert_sent_80:
            logger.warning(f"Budget at 80%: {budget.scope_type}/{budget.scope_id}")
            budget.alert_sent_80 = True
            await self.session.flush()
        elif pct >= 50 and not budget.alert_sent_50:
            logger.info(f"Budget at 50%: {budget.scope_type}/{budget.scope_id}")
            budget.alert_sent_50 = True
            await self.session.flush()

        return True, None

    async def set_budget(
        self,
        monthly_limit: float,
        scope_type: str = "team",
        scope_id: Optional[str] = None,
        alert_threshold_pct: int = 80,
        hard_cap: bool = True,
    ) -> APIBudget:
        """
        Create or update a budget.

        Args:
            monthly_limit: Monthly budget in USD
            scope_type: "team", "user", or "global"
            scope_id: Team or user ID (None for global)
            alert_threshold_pct: Percentage to alert at
            hard_cap: Block calls at 100%

        Returns:
            APIBudget: The created or updated budget
        """
        # Check for existing budget
        existing = await self._get_applicable_budget(
            user_id=scope_id if scope_type == "user" else None,
            team_id=scope_id if scope_type == "team" else None,
        )

        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Calculate period end (last day of month)
        if now.month == 12:
            next_month = now.replace(year=now.year + 1, month=1, day=1)
        else:
            next_month = now.replace(month=now.month + 1, day=1)
        period_end = next_month - timedelta(seconds=1)

        if existing:
            # Update existing
            existing.budget_usd = monthly_limit
            existing.alert_threshold_pct = alert_threshold_pct
            existing.hard_cap = hard_cap
            existing.updated_at = now
            await self.session.flush()
            return existing

        # Create new
        budget = APIBudget(
            id=str(uuid.uuid4()),
            scope_type=scope_type,
            scope_id=scope_id,
            period="monthly",
            period_start=period_start,
            period_end=period_end,
            budget_usd=monthly_limit,
            alert_threshold_pct=alert_threshold_pct,
            hard_cap=hard_cap,
            current_spend_usd=0.0,
            current_call_count=0,
            spend_by_provider={},
            created_at=now,
            updated_at=now,
        )

        self.session.add(budget)
        await self.session.flush()

        logger.info(
            f"Created budget: ${monthly_limit:.2f}/month for {scope_type}/{scope_id}"
        )

        return budget

    async def get_budget(
        self,
        user_id: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> Optional[APIBudget]:
        """
        Get current budget settings.

        Args:
            user_id: User ID
            team_id: Team ID

        Returns:
            APIBudget or None
        """
        return await self._get_applicable_budget(user_id, team_id)

    async def get_cost_breakdown(
        self,
        user_id: Optional[str] = None,
        team_id: Optional[str] = None,
        period: str = "monthly",
    ) -> Dict[str, Any]:
        """
        Get detailed cost breakdown.

        Args:
            user_id: Filter by user
            team_id: Filter by team
            period: Time period

        Returns:
            Dict with detailed breakdown:
            - by_provider: costs per provider
            - by_endpoint: costs per endpoint
            - by_module: costs per module
            - by_day: daily costs
            - top_domains: most expensive domains
        """
        # Get basic usage
        usage = await self.get_usage(user_id, team_id, period)

        # Calculate period boundaries
        now = datetime.utcnow()
        if period == "monthly":
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            period_start = now - timedelta(days=30)

        conditions = [APIUsage.timestamp >= period_start]
        if user_id:
            conditions.append(APIUsage.user_id == user_id)
        if team_id:
            conditions.append(APIUsage.team_id == team_id)

        # By endpoint
        endpoint_query = (
            select(
                APIUsage.provider,
                APIUsage.endpoint,
                func.sum(APIUsage.cost_usd).label("cost"),
                func.count(APIUsage.id).label("calls"),
            )
            .where(and_(*conditions))
            .group_by(APIUsage.provider, APIUsage.endpoint)
            .order_by(desc("cost"))
            .limit(20)
        )
        result = await self.session.execute(endpoint_query)
        by_endpoint = [
            {
                "provider": row.provider,
                "endpoint": row.endpoint,
                "cost_usd": float(row.cost or 0),
                "calls": row.calls,
            }
            for row in result.all()
        ]

        # By module
        module_query = (
            select(
                APIUsage.module_type,
                func.sum(APIUsage.cost_usd).label("cost"),
                func.count(APIUsage.id).label("calls"),
            )
            .where(and_(*conditions, APIUsage.module_type.isnot(None)))
            .group_by(APIUsage.module_type)
            .order_by(desc("cost"))
        )
        result = await self.session.execute(module_query)
        by_module = {
            row.module_type: {
                "cost_usd": float(row.cost or 0),
                "calls": row.calls,
            }
            for row in result.all()
        }

        # Top domains
        domain_query = (
            select(
                APIUsage.domain,
                func.sum(APIUsage.cost_usd).label("cost"),
                func.count(APIUsage.id).label("calls"),
            )
            .where(and_(*conditions, APIUsage.domain.isnot(None)))
            .group_by(APIUsage.domain)
            .order_by(desc("cost"))
            .limit(10)
        )
        result = await self.session.execute(domain_query)
        top_domains = [
            {
                "domain": row.domain,
                "cost_usd": float(row.cost or 0),
                "calls": row.calls,
            }
            for row in result.all()
        ]

        return {
            **usage,
            "by_endpoint": by_endpoint,
            "by_module": by_module,
            "top_domains": top_domains,
        }

    async def reset_budget_period(
        self,
        budget_id: str,
    ) -> Optional[APIBudget]:
        """
        Reset budget for a new period.

        Args:
            budget_id: Budget ID to reset

        Returns:
            Updated APIBudget or None
        """
        query = select(APIBudget).where(APIBudget.id == budget_id)
        result = await self.session.execute(query)
        budget = result.scalar_one_or_none()

        if budget is None:
            return None

        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        if now.month == 12:
            next_month = now.replace(year=now.year + 1, month=1, day=1)
        else:
            next_month = now.replace(month=now.month + 1, day=1)
        period_end = next_month - timedelta(seconds=1)

        budget.period_start = period_start
        budget.period_end = period_end
        budget.current_spend_usd = 0.0
        budget.current_call_count = 0
        budget.spend_by_provider = {}
        budget.alert_sent_50 = False
        budget.alert_sent_80 = False
        budget.alert_sent_100 = False
        budget.updated_at = now

        await self.session.flush()

        logger.info(f"Reset budget period for {budget.scope_type}/{budget.scope_id}")

        return budget

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    def _get_cost_for_call(self, provider: str, endpoint: str) -> float:
        """Get cost for a specific API call."""
        provider_costs = DEFAULT_API_COSTS.get(provider, {})
        cost = provider_costs.get(endpoint)
        if cost is None:
            cost = provider_costs.get("default", 0.01)
        return cost

    async def _get_applicable_budget(
        self,
        user_id: Optional[str],
        team_id: Optional[str],
    ) -> Optional[APIBudget]:
        """Get the most specific applicable budget."""
        # Try user budget first
        if user_id:
            query = select(APIBudget).where(
                and_(
                    APIBudget.scope_type == "user",
                    APIBudget.scope_id == user_id,
                )
            )
            result = await self.session.execute(query)
            budget = result.scalar_one_or_none()
            if budget:
                return budget

        # Try team budget
        if team_id:
            query = select(APIBudget).where(
                and_(
                    APIBudget.scope_type == "team",
                    APIBudget.scope_id == team_id,
                )
            )
            result = await self.session.execute(query)
            budget = result.scalar_one_or_none()
            if budget:
                return budget

        # Try global budget
        query = select(APIBudget).where(APIBudget.scope_type == "global")
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def _update_budget_spend(
        self,
        user_id: Optional[str],
        team_id: Optional[str],
        cost: float,
        provider: str,
    ) -> None:
        """Update budget spend tracking."""
        budget = await self._get_applicable_budget(user_id, team_id)
        if budget is None:
            return

        budget.current_spend_usd = (budget.current_spend_usd or 0) + cost
        budget.current_call_count = (budget.current_call_count or 0) + 1

        # Update per-provider spend
        spend_by_provider = budget.spend_by_provider or {}
        spend_by_provider[provider] = spend_by_provider.get(provider, 0) + cost
        budget.spend_by_provider = spend_by_provider

        budget.updated_at = datetime.utcnow()
