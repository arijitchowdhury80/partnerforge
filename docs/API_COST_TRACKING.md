# PartnerForge API Cost Tracking & Budget Management

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Architecture Design
**Priority:** P1 - Critical for Budget Control

---

## 1. Why This Matters

**Real scenario:**
- BuiltWith charges $0.10 per API call
- SimilarWeb charges $0.08 per endpoint
- Full enrichment = ~15 API calls = ~$1.20 per account
- Batch enrich 2,687 targets = **$3,224 in API costs**

Without tracking:
- No visibility into who's spending what
- No alerts when approaching limits
- No ability to forecast costs
- CFO asks "Why did costs spike?" → No answer

---

## 2. Cost Configuration

```python
# billing/costs.py

from decimal import Decimal
from dataclasses import dataclass

@dataclass
class APIEndpointCost:
    adapter: str
    endpoint: str
    cost_per_call_usd: Decimal
    included_in_plan: bool = False  # Some calls might be free tier

# Master cost table
API_COSTS: list[APIEndpointCost] = [
    # BuiltWith
    APIEndpointCost("builtwith", "domain-api", Decimal("0.10")),
    APIEndpointCost("builtwith", "relationships-api", Decimal("0.05")),
    APIEndpointCost("builtwith", "free-api", Decimal("0.00"), included_in_plan=True),

    # SimilarWeb
    APIEndpointCost("similarweb", "traffic", Decimal("0.08")),
    APIEndpointCost("similarweb", "engagement", Decimal("0.08")),
    APIEndpointCost("similarweb", "sources", Decimal("0.08")),
    APIEndpointCost("similarweb", "geography", Decimal("0.08")),
    APIEndpointCost("similarweb", "demographics", Decimal("0.08")),
    APIEndpointCost("similarweb", "keywords", Decimal("0.08")),
    APIEndpointCost("similarweb", "similar-sites", Decimal("0.08")),
    APIEndpointCost("similarweb", "competitors", Decimal("0.08")),
    APIEndpointCost("similarweb", "technographics", Decimal("0.08")),

    # Yahoo Finance (free via MCP)
    APIEndpointCost("yahoo_finance", "financials", Decimal("0.00")),
    APIEndpointCost("yahoo_finance", "stock_info", Decimal("0.00")),

    # SEC EDGAR (free)
    APIEndpointCost("sec_edgar", "filings", Decimal("0.00")),

    # WebSearch (Claude usage)
    APIEndpointCost("websearch", "search", Decimal("0.002")),  # ~$2 per 1000 searches
]

# Cost lookup
def get_call_cost(adapter: str, endpoint: str) -> Decimal:
    for cost in API_COSTS:
        if cost.adapter == adapter and cost.endpoint == endpoint:
            return cost.cost_per_call_usd
    return Decimal("0.00")  # Unknown = free (be conservative)

# Enrichment cost estimate
def estimate_enrichment_cost(modules: list[str]) -> Decimal:
    """Estimate cost to enrich with given modules."""
    MODULE_COSTS = {
        "M01": Decimal("0.004"),  # WebSearch only
        "M02": Decimal("0.15"),   # BuiltWith domain + relationships
        "M03": Decimal("0.56"),   # SimilarWeb 7 endpoints
        "M04": Decimal("0.10"),   # BuiltWith for each competitor
        "M05": Decimal("0.00"),   # Analysis only
        "M06": Decimal("0.02"),   # WebSearch
        "M07": Decimal("0.02"),   # WebSearch
        "M08": Decimal("0.00"),   # Yahoo Finance (free)
        "M09": Decimal("0.00"),   # Browser (no API cost)
        "M10": Decimal("0.00"),   # Analysis only
        "M11": Decimal("0.01"),   # SEC + WebSearch
        "M12": Decimal("0.00"),   # Internal
        "M13": Decimal("0.00"),   # Analysis
        "M14": Decimal("0.00"),   # Calculation
        "M15": Decimal("0.00"),   # Generation
    }
    return sum(MODULE_COSTS.get(m, Decimal("0.00")) for m in modules)
```

---

## 3. Database Schema

```sql
-- Budget configuration
CREATE TABLE billing_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    team_id UUID REFERENCES teams(id),  -- NULL = org-wide
    user_id UUID REFERENCES users(id),  -- NULL = team-wide

    -- Budget limits
    monthly_limit_usd DECIMAL(10,2) NOT NULL,
    daily_limit_usd DECIMAL(10,2),  -- Optional daily cap

    -- Alert thresholds
    alert_at_pct INTEGER DEFAULT 80,      -- Alert at 80%
    hard_cap_at_pct INTEGER DEFAULT 100,  -- Block at 100%

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage log (every call)
CREATE TABLE billing_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who
    org_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),

    -- What
    adapter VARCHAR(50) NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    domain VARCHAR(255),  -- Which company was being enriched

    -- Cost
    cost_usd DECIMAL(10,6) NOT NULL,
    cached BOOLEAN DEFAULT FALSE,  -- Was this a cache hit?

    -- Request details
    request_id UUID,  -- Correlation ID
    job_id UUID,      -- If part of batch job

    -- Timing
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

CREATE INDEX idx_usage_org_month ON billing_api_usage(org_id, date_trunc('month', timestamp));
CREATE INDEX idx_usage_user_day ON billing_api_usage(user_id, date_trunc('day', timestamp));
CREATE INDEX idx_usage_adapter ON billing_api_usage(adapter, timestamp);

-- Daily aggregates (for fast queries)
CREATE TABLE billing_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),

    usage_date DATE NOT NULL,

    -- Aggregates
    total_calls INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,2) DEFAULT 0,
    cached_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,

    -- By adapter
    costs_by_adapter JSONB DEFAULT '{}',
    calls_by_adapter JSONB DEFAULT '{}',

    UNIQUE(org_id, user_id, usage_date)
);

-- Alerts sent
CREATE TABLE billing_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID REFERENCES billing_budgets(id),

    alert_type VARCHAR(50) NOT NULL,  -- 'threshold_80', 'threshold_100', 'daily_exceeded'
    threshold_pct INTEGER,
    current_spend_usd DECIMAL(10,2),
    limit_usd DECIMAL(10,2),

    -- Notification
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    sent_to TEXT[],  -- Email addresses
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id)
);
```

---

## 4. Usage Tracking Service

```python
# billing/service.py

class UsageTrackingService:
    """
    Tracks all API usage and enforces budgets.
    Called by every adapter before making API calls.
    """

    def __init__(self, db: AsyncSession, cache: Redis):
        self.db = db
        self.cache = cache

    async def can_make_call(
        self,
        user: User,
        adapter: str,
        endpoint: str,
        estimated_cost: Decimal = None,
    ) -> tuple[bool, str | None]:
        """
        Check if user can make this API call.
        Returns (allowed, reason_if_denied)
        """

        cost = estimated_cost or get_call_cost(adapter, endpoint)

        # Check user budget
        user_budget = await self._get_budget(user_id=user.id)
        if user_budget:
            user_spend = await self._get_current_spend(user_id=user.id)
            if user_spend + cost > user_budget.monthly_limit_usd:
                return False, f"User budget exceeded: ${user_spend:.2f} / ${user_budget.monthly_limit_usd:.2f}"

        # Check team budget
        if user.primary_team_id:
            team_budget = await self._get_budget(team_id=user.primary_team_id)
            if team_budget:
                team_spend = await self._get_current_spend(team_id=user.primary_team_id)
                if team_spend + cost > team_budget.monthly_limit_usd:
                    return False, f"Team budget exceeded"

        # Check org budget
        org_budget = await self._get_budget(org_id=user.org_id)
        if org_budget:
            org_spend = await self._get_current_spend(org_id=user.org_id)
            if org_spend + cost > org_budget.monthly_limit_usd:
                return False, f"Organization budget exceeded"

        return True, None

    async def record_call(
        self,
        user: User,
        adapter: str,
        endpoint: str,
        domain: str | None,
        cost: Decimal,
        cached: bool = False,
        success: bool = True,
        response_time_ms: int = None,
        error_message: str = None,
    ):
        """Record an API call."""

        # Insert into usage log
        await self.db.execute(
            insert(BillingAPIUsage).values(
                org_id=user.org_id,
                user_id=user.id,
                team_id=user.primary_team_id,
                adapter=adapter,
                endpoint=endpoint,
                domain=domain,
                cost_usd=cost,
                cached=cached,
                success=success,
                response_time_ms=response_time_ms,
                error_message=error_message,
            )
        )

        # Update daily aggregate (upsert)
        today = date.today()
        await self.db.execute(
            insert(BillingDailyUsage)
            .values(
                org_id=user.org_id,
                user_id=user.id,
                team_id=user.primary_team_id,
                usage_date=today,
                total_calls=1,
                total_cost_usd=cost,
                cached_calls=1 if cached else 0,
                failed_calls=0 if success else 1,
            )
            .on_conflict_do_update(
                index_elements=["org_id", "user_id", "usage_date"],
                set_={
                    "total_calls": BillingDailyUsage.total_calls + 1,
                    "total_cost_usd": BillingDailyUsage.total_cost_usd + cost,
                    "cached_calls": BillingDailyUsage.cached_calls + (1 if cached else 0),
                    "failed_calls": BillingDailyUsage.failed_calls + (0 if success else 1),
                }
            )
        )

        # Update Redis cache for fast budget checks
        await self._update_spend_cache(user, cost)

        # Check alert thresholds
        await self._check_alerts(user)

    async def _get_current_spend(
        self,
        org_id: UUID = None,
        team_id: UUID = None,
        user_id: UUID = None,
    ) -> Decimal:
        """Get current month's spend from cache or DB."""

        # Try cache first
        cache_key = self._spend_cache_key(org_id, team_id, user_id)
        cached = await self.cache.get(cache_key)
        if cached:
            return Decimal(cached)

        # Query DB
        start_of_month = date.today().replace(day=1)
        query = select(func.sum(BillingAPIUsage.cost_usd))

        if user_id:
            query = query.where(BillingAPIUsage.user_id == user_id)
        elif team_id:
            query = query.where(BillingAPIUsage.team_id == team_id)
        elif org_id:
            query = query.where(BillingAPIUsage.org_id == org_id)

        query = query.where(BillingAPIUsage.timestamp >= start_of_month)

        result = await self.db.execute(query)
        spend = result.scalar() or Decimal("0.00")

        # Cache for 5 minutes
        await self.cache.setex(cache_key, 300, str(spend))

        return spend

    async def _check_alerts(self, user: User):
        """Check if any budget thresholds are crossed."""

        for budget in await self._get_applicable_budgets(user):
            current_spend = await self._get_current_spend(
                org_id=budget.org_id,
                team_id=budget.team_id,
                user_id=budget.user_id,
            )

            spend_pct = (current_spend / budget.monthly_limit_usd) * 100

            # Check alert threshold
            if spend_pct >= budget.alert_at_pct:
                alert_type = f"threshold_{budget.alert_at_pct}"
                if not await self._alert_already_sent(budget.id, alert_type):
                    await self._send_budget_alert(
                        budget=budget,
                        alert_type=alert_type,
                        current_spend=current_spend,
                        spend_pct=spend_pct,
                    )

    async def _send_budget_alert(
        self,
        budget: BillingBudget,
        alert_type: str,
        current_spend: Decimal,
        spend_pct: float,
    ):
        """Send budget alert to appropriate users."""

        recipients = await self._get_alert_recipients(budget)

        # Email alert
        await self.email.send_budget_alert(
            to=recipients,
            budget_name=self._get_budget_name(budget),
            current_spend=current_spend,
            limit=budget.monthly_limit_usd,
            spend_pct=spend_pct,
            is_hard_cap=spend_pct >= budget.hard_cap_at_pct,
        )

        # Slack alert
        await self.slack.send_budget_alert(
            channel="#partnerforge-alerts",
            budget_name=self._get_budget_name(budget),
            current_spend=current_spend,
            limit=budget.monthly_limit_usd,
            spend_pct=spend_pct,
        )

        # Record alert
        await self.db.execute(
            insert(BillingAlert).values(
                budget_id=budget.id,
                alert_type=alert_type,
                threshold_pct=int(spend_pct),
                current_spend_usd=current_spend,
                limit_usd=budget.monthly_limit_usd,
                sent_to=recipients,
            )
        )
```

---

## 5. Adapter Integration

```python
# adapters/base.py - Updated with cost tracking

class BaseAdapter(ABC):
    """Base adapter with built-in cost tracking."""

    ADAPTER_NAME: str
    usage_service: UsageTrackingService

    async def fetch(
        self,
        endpoint: str,
        user: User,
        domain: str = None,
        **params
    ) -> SourcedResponse:
        """
        Fetch with cost tracking.
        Checks budget before call, records cost after.
        """

        cost = get_call_cost(self.ADAPTER_NAME, endpoint)

        # Check if call is allowed
        allowed, reason = await self.usage_service.can_make_call(
            user=user,
            adapter=self.ADAPTER_NAME,
            endpoint=endpoint,
            estimated_cost=cost,
        )

        if not allowed:
            raise BudgetExceededError(
                adapter=self.ADAPTER_NAME,
                endpoint=endpoint,
                reason=reason,
            )

        # Make the actual call
        start_time = time.monotonic()
        try:
            result = await self._fetch_raw(endpoint, **params)
            success = True
            error = None
        except Exception as e:
            success = False
            error = str(e)
            raise
        finally:
            # Record usage regardless of success/failure
            response_time_ms = int((time.monotonic() - start_time) * 1000)
            await self.usage_service.record_call(
                user=user,
                adapter=self.ADAPTER_NAME,
                endpoint=endpoint,
                domain=domain,
                cost=cost,
                cached=False,
                success=success,
                response_time_ms=response_time_ms,
                error_message=error,
            )

        return result
```

---

## 6. Cost Dashboard API

```python
# api/billing.py

@router.get("/billing/usage/summary")
async def get_usage_summary(
    period: str = "month",  # month, week, day
    user: User = Depends(get_current_user),
):
    """Get usage summary for current user/team/org."""

    if period == "month":
        start = date.today().replace(day=1)
    elif period == "week":
        start = date.today() - timedelta(days=7)
    else:
        start = date.today()

    return {
        "period": period,
        "start_date": start.isoformat(),

        # User level
        "user": {
            "total_cost": await get_spend(user_id=user.id, since=start),
            "total_calls": await get_call_count(user_id=user.id, since=start),
            "budget_limit": await get_budget_limit(user_id=user.id),
            "budget_remaining": await get_budget_remaining(user_id=user.id),
        },

        # Team level (if applicable)
        "team": await get_team_summary(user.primary_team_id, start) if user.primary_team_id else None,

        # Org level
        "organization": await get_org_summary(user.org_id, start),

        # Breakdown by adapter
        "by_adapter": await get_costs_by_adapter(user.org_id, start),

        # Top consumers
        "top_users": await get_top_users_by_spend(user.org_id, start, limit=10),

        # Trend
        "daily_trend": await get_daily_cost_trend(user.org_id, days=30),
    }


@router.get("/billing/usage/estimate")
async def estimate_batch_cost(
    domains: list[str],
    modules: list[str] = None,
    user: User = Depends(get_current_user),
):
    """Estimate cost for batch enrichment."""

    modules = modules or ["M01", "M02", "M03", "M04", "M08"]
    per_account_cost = estimate_enrichment_cost(modules)
    total_cost = per_account_cost * len(domains)

    # Check against budget
    budget_remaining = await get_budget_remaining(user_id=user.id)

    return {
        "domain_count": len(domains),
        "modules": modules,
        "per_account_cost_usd": float(per_account_cost),
        "total_estimated_cost_usd": float(total_cost),
        "budget_remaining_usd": float(budget_remaining),
        "will_exceed_budget": total_cost > budget_remaining,
        "domains_affordable": int(budget_remaining / per_account_cost),
    }
```

---

## 7. UI Components

```typescript
// frontend/src/components/billing/BudgetIndicator.tsx

export const BudgetIndicator: FC = () => {
  const { data: usage } = useQuery(['billing', 'summary'], fetchUsageSummary);

  if (!usage) return null;

  const spendPct = (usage.user.total_cost / usage.user.budget_limit) * 100;

  return (
    <div className="budget-indicator">
      <div className="budget-bar">
        <div
          className={`budget-fill ${spendPct > 80 ? 'warning' : ''} ${spendPct > 95 ? 'danger' : ''}`}
          style={{ width: `${Math.min(100, spendPct)}%` }}
        />
      </div>

      <div className="budget-text">
        <span className="spent">${usage.user.total_cost.toFixed(2)}</span>
        <span className="separator">/</span>
        <span className="limit">${usage.user.budget_limit.toFixed(2)}</span>
        <span className="period">this month</span>
      </div>

      {spendPct > 80 && (
        <Alert variant="warning">
          You've used {spendPct.toFixed(0)}% of your monthly budget
        </Alert>
      )}
    </div>
  );
};

// Cost estimate before batch
export const BatchCostEstimate: FC<{ domains: string[] }> = ({ domains }) => {
  const { data: estimate } = useQuery(
    ['billing', 'estimate', domains],
    () => fetchBatchEstimate(domains)
  );

  return (
    <div className="cost-estimate">
      <h4>Estimated Cost</h4>

      <div className="estimate-details">
        <div className="row">
          <span>{estimate.domain_count} accounts</span>
          <span>× ${estimate.per_account_cost_usd.toFixed(2)}</span>
        </div>
        <div className="row total">
          <span>Total</span>
          <span className={estimate.will_exceed_budget ? 'danger' : ''}>
            ${estimate.total_estimated_cost_usd.toFixed(2)}
          </span>
        </div>
      </div>

      {estimate.will_exceed_budget && (
        <Alert variant="danger">
          This batch will exceed your budget.
          You can afford {estimate.domains_affordable} accounts.
        </Alert>
      )}
    </div>
  );
};
```

---

*Document created: 2026-02-25*
*Author: Thread 2 - Data Pipeline*
*Status: Architecture Design*
*Priority: P1*
