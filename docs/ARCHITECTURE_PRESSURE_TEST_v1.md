# PartnerForge Architecture Pressure Test

**Date:** 2026-02-25
**Purpose:** Identify blind spots, corner cases, and extensibility gaps before they become expensive problems

---

## 1. CRITICAL BLIND SPOTS (High Pain if Ignored)

### 1.1 Data Versioning & Historical Intelligence

**The Problem:**
When you enrich Costco today and again in 3 months, you're overwriting data. But sales needs to know:
- "What changed since my last call?"
- "They had Elasticsearch last quarter, now they have... nothing?"
- "Their hiring signals were STRONG 2 months ago, what happened?"

**Current Gap:** No historical tracking. We capture `fetched_at` but not `previous_value`.

**Solution Required:**
```sql
-- Every intel table needs a history table
CREATE TABLE intel_technology_stack_history (
    id UUID PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    snapshot_date DATE NOT NULL,
    data JSONB NOT NULL,  -- Full snapshot
    change_summary TEXT,   -- "search_provider: Elasticsearch → None"
    UNIQUE(domain, snapshot_date)
);

-- Trigger on update to auto-snapshot
CREATE TRIGGER snapshot_tech_stack_changes
BEFORE UPDATE ON intel_technology_stack
FOR EACH ROW EXECUTE FUNCTION create_intel_snapshot();
```

**Value:** AE walks into call knowing "They removed Constructor last month" = timing signal.

---

### 1.2 Multi-Tenancy & Territory Management

**The Problem:**
50-100 sales users. Are they ALL seeing ALL 2,687 targets? What about:
- Territory boundaries (West Coast AE vs East Coast AE)
- Account ownership (this is MY account, don't touch it)
- Manager vs IC permissions
- Competitive intel visibility (should SDR see competitor deal intel?)

**Current Gap:** No user roles, no territory model, no access control.

**Solution Required:**
```python
# users/models.py
class UserRole(Enum):
    ADMIN = "admin"           # Full access, can delete
    MANAGER = "manager"       # Can see team's accounts
    AE = "ae"                 # Can see assigned accounts
    SDR = "sdr"               # Limited intel (no financials?)
    VIEWER = "viewer"         # Read-only

class Territory(BaseModel):
    id: UUID
    name: str                 # "West Coast Enterprise"
    owner_id: UUID            # Manager
    members: list[UUID]       # AEs assigned
    filters: dict             # {"region": "US-West", "segment": "Enterprise"}

class AccountAssignment(BaseModel):
    account_id: UUID
    user_id: UUID
    role: Literal["owner", "team_member", "viewer"]
    assigned_at: datetime
    assigned_by: UUID
```

**Pain if ignored:** Political chaos. "Why can John see my accounts?" Audit nightmares.

---

### 1.3 API Cost Management & Budget Controls

**The Problem:**
BuiltWith and SimilarWeb are EXPENSIVE. Without controls:
- Intern runs batch enrich on 10,000 domains = $5,000 bill
- No visibility into cost per enrichment
- No budget caps per team/user

**Current Gap:** No cost tracking, no budget limits, no alerts.

**Solution Required:**
```python
# billing/models.py
API_COSTS = {
    "builtwith": {
        "domain-api": 0.10,      # $0.10 per call
        "relationships-api": 0.05,
    },
    "similarweb": {
        "traffic": 0.08,
        "competitors": 0.08,
    },
    "yahoo_finance": {
        "financials": 0.00,      # Free (for now)
    }
}

class UsageBudget(BaseModel):
    team_id: UUID
    monthly_limit_usd: Decimal
    current_spend_usd: Decimal
    alert_threshold_pct: int = 80  # Alert at 80%
    hard_cap: bool = True          # Block at 100%

class APIUsageLog(BaseModel):
    id: UUID
    user_id: UUID
    adapter: str
    endpoint: str
    domain: str
    cost_usd: Decimal
    timestamp: datetime
```

**Value:** CFO asks "Why did API costs spike 300%?" You have answers.

---

### 1.4 Compliance & Privacy (GDPR/CCPA)

**The Problem:**
PRD mentions GDPR for EU executive data. This isn't optional - it's legal requirement:
- Right to erasure ("Delete my data")
- Right to access ("What do you have on me?")
- Data retention limits
- LinkedIn scraping is legally gray

**Current Gap:** No privacy controls, no data retention policy, no deletion workflow.

**Solution Required:**
```python
# compliance/models.py
class DataRetentionPolicy:
    EXECUTIVE_DATA_DAYS = 365      # Delete after 1 year if not refreshed
    HIRING_SIGNALS_DAYS = 90       # Hiring data stales fast
    FINANCIAL_DATA_DAYS = 365      # Keep for 1 year

class PrivacyRequest(BaseModel):
    id: UUID
    request_type: Literal["access", "erasure", "rectification"]
    subject_email: str            # Person requesting
    subject_name: str
    status: Literal["pending", "processing", "completed"]
    requested_at: datetime
    completed_at: datetime | None
    affected_records: list[str]   # Tables/records modified

# Automatic PII detection
PII_FIELDS = [
    "speaker_name",
    "linkedin_url",
    "email",
    "phone",
]

async def handle_erasure_request(email: str):
    """GDPR Article 17 - Right to Erasure"""
    # Find all records mentioning this person
    # Anonymize or delete
    # Log for compliance audit
```

**Pain if ignored:** EU customer sues. €20M fine or 4% of global revenue.

---

### 1.5 Observability & Operational Visibility

**The Problem:**
Pipeline is running. Is it healthy? Questions you can't answer today:
- How many enrichments completed today?
- What's our API error rate?
- Which module is slowest?
- Why did the Costco enrichment fail?

**Current Gap:** No metrics, no dashboards, no alerting.

**Solution Required:**
```python
# observability/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# Counters
enrichment_total = Counter(
    "enrichment_total",
    "Total enrichments",
    ["domain", "status"]  # completed, partial, failed
)

module_executions = Counter(
    "module_executions_total",
    "Module execution count",
    ["module_id", "status"]
)

# Histograms
enrichment_duration = Histogram(
    "enrichment_duration_seconds",
    "Time to complete enrichment",
    ["wave"]
)

api_call_duration = Histogram(
    "api_call_duration_seconds",
    "External API call duration",
    ["adapter", "endpoint"]
)

# Gauges
circuit_breaker_state = Gauge(
    "circuit_breaker_state",
    "Circuit breaker state (0=closed, 1=open)",
    ["adapter"]
)

rate_limiter_tokens = Gauge(
    "rate_limiter_available_tokens",
    "Available rate limit tokens",
    ["adapter"]
)
```

**Value:** Ops dashboard shows "BuiltWith error rate at 45%" → investigate before users notice.

---

## 2. CORNER CASES (Will Bite You Eventually)

### 2.1 Partial Enrichment Recovery

**Scenario:** Wave 1 completes, Wave 2 fails mid-way. User retries.

**Question:** Do we re-run Wave 1 (wasting API calls) or resume from Wave 2?

**Solution:**
```python
class EnrichmentCheckpoint:
    """Track progress for resumable enrichments."""
    job_id: UUID
    domain: str
    completed_modules: set[str]  # {"M01", "M02", "M03"}
    failed_modules: dict[str, str]  # {"M04": "timeout"}
    wave_results: dict[str, Any]  # Cached outputs

async def resume_enrichment(job_id: UUID):
    """Resume from last checkpoint."""
    checkpoint = await load_checkpoint(job_id)
    remaining = ALL_MODULES - checkpoint.completed_modules
    # Run only remaining modules
```

---

### 2.2 Conflicting Data Sources

**Scenario:** BuiltWith says company uses Elasticsearch. SimilarWeb technographics says Algolia.

**Question:** Which is right? How do we handle conflicts?

**Solution:**
```python
class DataConflict(BaseModel):
    field: str
    sources: list[SourcedValue]
    resolution_strategy: Literal["newest", "most_trusted", "manual"]
    resolved_value: Any | None
    confidence: float

# Source trust hierarchy
SOURCE_TRUST = {
    "network_detection": 1.0,   # Actually saw API calls
    "builtwith_api": 0.9,
    "similarweb_api": 0.7,
    "websearch": 0.5,
}

def resolve_conflict(values: list[SourcedValue]) -> Any:
    # Newest + most trusted wins
    scored = [(v, SOURCE_TRUST[v.source_type] * freshness_score(v)) for v in values]
    return max(scored, key=lambda x: x[1])[0].value
```

---

### 2.3 Domain Variations & Subsidiaries

**Scenario:** User enriches `costco.com`. But company also owns:
- `costcobusinessdelivery.com`
- `costcotravel.com`
- `costco.ca` (Canada)
- `costco.co.uk` (UK)

**Question:** Do we track these as separate companies or link them?

**Solution:**
```python
class DomainFamily(BaseModel):
    primary_domain: str
    related_domains: list[RelatedDomain]
    relationship_source: str  # BuiltWith relationships-api

class RelatedDomain(BaseModel):
    domain: str
    relationship: Literal["subsidiary", "regional", "brand", "redirect"]
    traffic_share: float | None  # What % of traffic

# When enriching, auto-discover family
async def enrich_with_family(domain: str):
    family = await discover_domain_family(domain)
    # Enrich primary
    # Optionally enrich subsidiaries
    # Aggregate traffic across family
```

---

### 2.4 Company Renames & Acquisitions

**Scenario:**
- Facebook → Meta
- Salesforce acquires Slack
- Company goes private (no more SEC filings)

**Question:** How do we handle entity changes?

**Solution:**
```python
class CompanyEvent(BaseModel):
    event_type: Literal["rename", "merger", "acquisition", "ipo", "delisting"]
    old_entity: str
    new_entity: str
    event_date: date
    source_url: str

# Link old records to new entity
class EntityMapping(BaseModel):
    old_domain: str
    new_domain: str
    old_ticker: str | None
    new_ticker: str | None
    valid_from: date
```

---

### 2.5 Rate Limit Exhaustion Across Workers

**Scenario:** 3 workers running batch enrichment. Each has local rate limiter. Together they exceed API limits.

**Current Gap:** Rate limiters are per-process, not global.

**Solution:**
```python
# Distributed rate limiter using Redis
class RedisRateLimiter:
    """Global rate limiter shared across all workers."""

    def __init__(self, redis: Redis, name: str, rpm: int):
        self.redis = redis
        self.key = f"ratelimit:{name}"
        self.rpm = rpm

    async def acquire(self) -> bool:
        """
        Atomic acquire using Redis Lua script.
        Returns True if allowed, False if rate limited.
        """
        lua_script = """
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = 60

        local current = redis.call('GET', key)
        if current and tonumber(current) >= limit then
            return 0
        end

        redis.call('INCR', key)
        redis.call('EXPIRE', key, window)
        return 1
        """
        result = await self.redis.eval(lua_script, 1, self.key, self.rpm)
        return result == 1
```

---

## 3. EXTENSIBILITY ARCHITECTURE (Future-Proofing)

### 3.1 Module Registry Pattern

**Problem:** Adding a new module (M16: Social Media Intelligence) shouldn't require changing 10 files.

**Solution:**
```python
# modules/registry.py
class ModuleRegistry:
    """Central registry for all intelligence modules."""

    _modules: dict[str, type[BaseModule]] = {}
    _dependencies: dict[str, set[str]] = {}

    @classmethod
    def register(
        cls,
        module_id: str,
        depends_on: set[str] = None,
        wave: int = None
    ):
        """Decorator to register a module."""
        def decorator(module_class: type[BaseModule]):
            cls._modules[module_id] = module_class
            cls._dependencies[module_id] = depends_on or set()
            module_class.MODULE_ID = module_id
            module_class.WAVE = wave
            return module_class
        return decorator

    @classmethod
    def get_execution_order(cls) -> list[list[str]]:
        """Compute wave-based execution order from dependencies."""
        # Topological sort by dependencies
        # Group into waves for parallel execution
        ...

# Usage - adding a new module
@ModuleRegistry.register(
    module_id="M16",
    depends_on={"M01", "M07"},
    wave=2
)
class SocialMediaIntelligence(BaseModule):
    """Track company social media presence and sentiment."""

    async def execute(self, input: M16Input) -> M16Output:
        ...
```

**Value:** Adding new module = 1 file + decorator. No orchestrator changes.

---

### 3.2 Event-Driven Architecture

**Problem:** Tightly coupled modules make changes expensive.

**Solution:**
```python
# events/bus.py
class EventBus:
    """Publish-subscribe event bus for loose coupling."""

    _subscribers: dict[str, list[Callable]] = defaultdict(list)

    async def publish(self, event: Event):
        """Publish event to all subscribers."""
        for handler in self._subscribers[event.event_type]:
            await handler(event)

    def subscribe(self, event_type: str, handler: Callable):
        """Subscribe to event type."""
        self._subscribers[event_type].append(handler)

# Events
class EnrichmentCompleted(Event):
    event_type = "enrichment.completed"
    domain: str
    modules_completed: list[str]
    hot_lead: bool

class HotLeadDetected(Event):
    event_type = "lead.hot_detected"
    domain: str
    score: int
    signals: list[str]

# Subscribers can be added without touching core logic
@event_bus.subscribe("lead.hot_detected")
async def notify_slack(event: HotLeadDetected):
    await slack.post(f"🔥 Hot lead: {event.domain} (score: {event.score})")

@event_bus.subscribe("lead.hot_detected")
async def update_salesforce(event: HotLeadDetected):
    await salesforce.update_lead(event.domain, priority="high")
```

**Value:** Add Slack notifications, Salesforce sync, email alerts WITHOUT touching enrichment code.

---

### 3.3 Plugin System for Data Sources

**Problem:** Adding ZoomInfo, Crossbeam, Demandbase should be plug-and-play.

**Solution:**
```python
# adapters/plugin.py
class DataSourcePlugin(ABC):
    """Base class for pluggable data sources."""

    # Metadata
    PLUGIN_ID: str
    PLUGIN_NAME: str
    PLUGIN_VERSION: str

    # Capabilities
    PROVIDES_MODULES: set[str]  # Which modules this can power
    RATE_LIMIT: RateLimiterConfig

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if API is accessible."""
        pass

    @abstractmethod
    async def fetch(self, domain: str, **kwargs) -> SourcedResponse:
        """Fetch data for domain."""
        pass

    @abstractmethod
    def transform(self, raw: dict) -> dict:
        """Transform to normalized schema."""
        pass

# Plugin discovery
class PluginManager:
    """Discover and load data source plugins."""

    def discover_plugins(self, plugins_dir: Path) -> list[DataSourcePlugin]:
        """Auto-discover plugins from directory."""
        plugins = []
        for path in plugins_dir.glob("*/plugin.py"):
            module = importlib.import_module(path)
            if hasattr(module, "Plugin"):
                plugins.append(module.Plugin())
        return plugins

    def get_best_source(self, module_id: str) -> DataSourcePlugin:
        """Get best available source for module."""
        # Priority: paid > free, fresh > stale
        candidates = [p for p in self.plugins if module_id in p.PROVIDES_MODULES]
        return sorted(candidates, key=lambda p: p.priority)[0]
```

**Value:** Adding ZoomInfo = drop a `zoominfo/plugin.py` file. Done.

---

### 3.4 UI Component Architecture

**Problem:** New screens look different from old screens. UI becomes Frankenstein.

**Solution:**
```typescript
// frontend/src/design-system/index.ts

// 1. Consistent tokens
export const tokens = {
  colors: {
    // Status colors (consistent across ALL screens)
    hot: '#ef4444',      // Red - Hot leads
    warm: '#f59e0b',     // Orange - Warm leads
    cool: '#3b82f6',     // Blue - Cool leads
    cold: '#6b7280',     // Gray - Cold leads

    // Algolia brand
    primary: '#003DFF',  // Nebula Blue
    secondary: '#5468FF', // Algolia Purple
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { sm: 4, md: 8, lg: 12 },
};

// 2. Intelligence display components (reused everywhere)
export const IntelligenceCard: FC<Props> = ({ module, data, sources }) => (
  <Card>
    <CardHeader>
      <ModuleIcon module={module} />
      <Title>{module.name}</Title>
      <FreshnessIndicator sources={sources} />
    </CardHeader>
    <CardContent>
      {/* Module-specific content */}
    </CardContent>
    <CardFooter>
      <SourceBadges sources={sources} />
    </CardFooter>
  </Card>
);

// 3. Composable layouts
export const IntelligenceGrid: FC<Props> = ({ modules }) => (
  <Grid columns={{ base: 1, md: 2, lg: 3 }}>
    {modules.map(m => <IntelligenceCard key={m.id} {...m} />)}
  </Grid>
);
```

**Value:** Every new module uses `<IntelligenceCard>`. Automatic visual consistency.

---

### 3.5 Feature Flags & Gradual Rollout

**Problem:** Big-bang releases are risky. Need to test with subset of users.

**Solution:**
```python
# features/flags.py
class FeatureFlags:
    """Control feature rollout."""

    FLAGS = {
        "M16_SOCIAL_INTEL": {
            "enabled": False,
            "rollout_pct": 0,
            "allowed_users": ["arijit@algolia.com"],
            "allowed_teams": ["enterprise"],
        },
        "NEW_SCORING_ALGORITHM": {
            "enabled": True,
            "rollout_pct": 25,  # 25% of users
        },
    }

    @classmethod
    def is_enabled(cls, flag: str, user: User) -> bool:
        config = cls.FLAGS.get(flag, {})

        if not config.get("enabled"):
            return False

        if user.email in config.get("allowed_users", []):
            return True

        if user.team in config.get("allowed_teams", []):
            return True

        rollout_pct = config.get("rollout_pct", 100)
        return hash(user.id) % 100 < rollout_pct
```

**Value:** Ship M16 to 10% of users, validate, then roll out to 100%.

---

## 4. MISSING CAPABILITIES (Should Implement)

### 4.1 Search & Discovery

**Current gap:** How does AE find "all targets in retail using Elasticsearch"?

```python
# Implement full-text search across intelligence
class IntelligenceSearch:
    """Search across all intelligence data."""

    async def search(
        self,
        query: str,
        filters: SearchFilters = None,
    ) -> SearchResults:
        # Full-text search on:
        # - Company names
        # - Executive quotes
        # - Strategic initiatives
        # - Technology stack
        # - Hiring signals
        ...

# Example queries:
# "digital transformation" → Companies mentioning this
# "AI personalization" → Companies investing in AI
# "search optimization" → Companies talking about search
```

### 4.2 Alerts & Notifications

**Current gap:** No proactive notifications when interesting things happen.

```python
class AlertRule(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    condition: AlertCondition  # score > 80, tech_change, new_hiring
    channels: list[str]  # ["email", "slack"]
    frequency: str  # "immediate", "daily_digest"

class AlertCondition(BaseModel):
    field: str
    operator: Literal["eq", "gt", "lt", "contains", "changed"]
    value: Any

# Example rules:
# - Alert when any target hits score > 90
# - Alert when competitor removes Algolia
# - Alert when target posts VP Search job
```

### 4.3 Workflow Automation

**Current gap:** Manual trigger only. No integration triggers.

```python
class Workflow(BaseModel):
    trigger: WorkflowTrigger
    actions: list[WorkflowAction]

class WorkflowTrigger(BaseModel):
    type: Literal[
        "schedule",           # Daily at 9am
        "salesforce_stage",   # When opp moves to stage
        "manual",             # User clicks button
        "webhook",            # External system calls us
    ]

class WorkflowAction(BaseModel):
    type: Literal[
        "enrich",
        "notify",
        "create_task",
        "update_crm",
        "generate_brief",
    ]

# Example workflow:
# Trigger: Salesforce opp moves to "Qualification"
# Actions:
#   1. Enrich company (all modules)
#   2. Generate AE Pre-Call Brief
#   3. Create Salesforce task "Review PartnerForge intel"
#   4. Notify AE via Slack
```

### 4.4 CRM Integration

**Current gap:** Intelligence lives in PartnerForge. Sales lives in Salesforce.

```python
class SalesforceSync:
    """Bi-directional Salesforce integration."""

    async def push_intelligence(self, domain: str):
        """Push intelligence summary to Salesforce Account."""
        intel = await get_aggregated_intel(domain)

        await salesforce.update_account(
            domain=domain,
            fields={
                "PartnerForge_Score__c": intel.icp_score,
                "PartnerForge_Priority__c": intel.priority,
                "PartnerForge_Tech_Stack__c": intel.tech_summary,
                "PartnerForge_Last_Enriched__c": intel.last_enriched,
                "PartnerForge_Brief_URL__c": intel.brief_url,
            }
        )

    async def pull_accounts(self):
        """Pull accounts from Salesforce for enrichment."""
        accounts = await salesforce.query(
            "SELECT Domain__c FROM Account WHERE Type = 'Prospect'"
        )
        for account in accounts:
            await enqueue_enrichment(account.domain)
```

---

## 5. ARCHITECTURE DECISION RECORDS (ADRs)

Document key decisions so future developers understand WHY:

```markdown
# ADR-001: Source Citation Enforcement at Multiple Layers

## Status: Accepted

## Context
Enterprise ABM software requires trusted data. Sales reps must know
where data came from to confidently use it in prospect calls.

## Decision
Enforce source citation at FOUR layers:
1. Database: NOT NULL constraints on source columns
2. Model: Pydantic validators reject unsourced data
3. Service: ValidationService checks before save
4. Repository: save() method validates before write

## Consequences
- More code to write
- Slower initial development
- BUT: Impossible to have unsourced data
- BUT: Complete audit trail
- BUT: Sales confidence in data quality
```

---

## 6. TESTING STRATEGY

### 6.1 Mock API Responses

```python
# tests/fixtures/builtwith.py
BUILTWITH_RESPONSES = {
    "costco.com": {
        "Technologies": [
            {"Name": "Elasticsearch", "Category": "Search"},
            {"Name": "Adobe Experience Manager", "Category": "CMS"},
        ],
        "Spending": {"Estimated": 150000},
    },
    "error_domain.com": HTTPError(500, "Internal Server Error"),
    "rate_limited.com": HTTPError(429, "Too Many Requests"),
}

@pytest.fixture
def mock_builtwith():
    with patch("adapters.builtwith.BuiltWithAdapter") as mock:
        mock.fetch.side_effect = lambda domain: BUILTWITH_RESPONSES.get(domain)
        yield mock
```

### 6.2 Integration Test Environment

```yaml
# docker-compose.test.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: partnerforge_test

  redis:
    image: redis:7

  mock-apis:
    build: ./tests/mock-servers
    ports:
      - "9001:9001"  # Mock BuiltWith
      - "9002:9002"  # Mock SimilarWeb
```

---

## 7. PRIORITY MATRIX

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| Data versioning/history | HIGH | MEDIUM | P1 |
| Multi-tenancy/RBAC | HIGH | HIGH | P1 |
| API cost tracking | HIGH | LOW | P1 |
| Observability/metrics | HIGH | MEDIUM | P1 |
| GDPR compliance | HIGH | HIGH | P1 |
| Distributed rate limiter | MEDIUM | LOW | P2 |
| Event-driven architecture | MEDIUM | MEDIUM | P2 |
| Module registry pattern | MEDIUM | LOW | P2 |
| Full-text search | MEDIUM | MEDIUM | P2 |
| Alerts/notifications | MEDIUM | MEDIUM | P2 |
| CRM integration | HIGH | HIGH | P3 |
| Workflow automation | MEDIUM | HIGH | P3 |
| Feature flags | LOW | LOW | P3 |

---

*Document created: 2026-02-25*
*Author: Architecture Pressure Test*
*Status: Action Items Identified*
