# PartnerForge Parallel Execution Architecture

**Version:** 1.0
**Date:** 2026-02-25
**Author:** Thread 1 - Backend Architecture
**Status:** Design Specification

---

## Executive Summary

PartnerForge implements a **4-Wave Parallel Execution Model** with an **Automated Orchestrator** that eliminates the need for human coordination during enrichment. The system processes 15 intelligence modules across 4 waves, where modules within each wave execute in parallel, and wave dependencies are resolved automatically.

**Key Design Decisions:**
1. **No Human Orchestrator Required** - The system auto-orchestrates based on dependency graph
2. **Maximum Parallelism** - Up to 4 modules execute concurrently within each wave
3. **Async Background Jobs** - Long-running enrichment doesn't block API responses
4. **Circuit Breaker Pattern** - Failed modules don't cascade to healthy modules
5. **Incremental Results** - Partial results available as modules complete

---

## Execution Model Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ORCHESTRATOR (Automated)                               │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                        DEPENDENCY RESOLVER                               │  │
│   │                                                                          │  │
│   │   Input: domain                                                          │  │
│   │   Output: Ordered execution plan with parallel groups                    │  │
│   │                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                          │
│                                      ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────────┐ │
│   │ WAVE 1 (Parallel)                                                        │ │
│   │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │ │
│   │ │   M01:     │ │   M02:     │ │   M03:     │ │   M04:     │             │ │
│   │ │ Company    │ │ Tech Stack │ │ Traffic    │ │ Financial  │             │ │
│   │ │ Context    │ │            │ │ Analysis   │ │ Profile    │             │ │
│   │ └────────────┘ └────────────┘ └────────────┘ └────────────┘             │ │
│   │      │              │              │              │                      │ │
│   │      └──────────────┴──────────────┴──────────────┘                      │ │
│   │                            │                                              │ │
│   │                       JOIN BARRIER                                        │ │
│   │                            │                                              │ │
│   └──────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                          │
│                                      ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────────┐ │
│   │ WAVE 2 (Parallel)                                                        │ │
│   │ ┌────────────┐ ┌────────────┐ ┌────────────┐                            │ │
│   │ │   M05:     │ │   M06:     │ │   M07:     │                            │ │
│   │ │ Competitor │ │ Hiring     │ │ Strategic  │                            │ │
│   │ │ Intel      │ │ Signals    │ │ Context    │                            │ │
│   │ └────────────┘ └────────────┘ └────────────┘                            │ │
│   │      │              │              │                                     │ │
│   │      └──────────────┴──────────────┘                                     │ │
│   │                     │                                                     │ │
│   │                JOIN BARRIER                                               │ │
│   │                     │                                                     │ │
│   └──────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                          │
│                                      ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────────┐ │
│   │ WAVE 3 (Parallel)                                                        │ │
│   │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │ │
│   │ │   M08:     │ │   M09:     │ │   M10:     │ │   M11:     │             │ │
│   │ │ Investor   │ │ Executive  │ │ Buying     │ │ Displacement│             │ │
│   │ │ Intel      │ │ Intel      │ │ Committee  │ │ Analysis   │             │ │
│   │ └────────────┘ └────────────┘ └────────────┘ └────────────┘             │ │
│   │      │              │              │              │                      │ │
│   │      └──────────────┴──────────────┴──────────────┘                      │ │
│   │                            │                                              │ │
│   │                       JOIN BARRIER                                        │ │
│   │                            │                                              │ │
│   └──────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                          │
│                                      ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────────┐ │
│   │ WAVE 4 (Parallel)                                                        │ │
│   │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │ │
│   │ │   M12:     │ │   M13:     │ │   M14:     │ │   M15:     │             │ │
│   │ │ Case Study │ │ ICP-Priority│ │ Signal    │ │ Strategic  │             │ │
│   │ │ Matching   │ │ Mapping    │ │ Scoring   │ │ Brief      │             │ │
│   │ └────────────┘ └────────────┘ └────────────┘ └────────────┘             │ │
│   │      │              │              │              │                      │ │
│   │      └──────────────┴──────────────┴──────────────┘                      │ │
│   │                            │                                              │ │
│   │                    COMPLETION HANDLER                                     │ │
│   │                            │                                              │ │
│   └──────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                          │
│                                      ▼                                          │
│                          ┌─────────────────┐                                    │
│                          │ DELIVERY LAYER  │                                    │
│                          │ Dashboard, API, │                                    │
│                          │ Reports, Alerts │                                    │
│                          └─────────────────┘                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Orchestrator Design

### Answer to Your Question: Human vs. Automated Orchestrator

**The orchestrator is AUTOMATED - no human required during execution.**

The human's role is limited to:
1. **Initiating enrichment** - Click "Enrich" or call API endpoint
2. **Reviewing results** - View dashboard, download reports
3. **Handling exceptions** - Only if circuit breaker triggers

The orchestrator handles:
- Dependency resolution
- Parallel execution scheduling
- Failure recovery
- Progress tracking
- Result aggregation

### Orchestrator Components

```python
# services/orchestrator.py

class EnrichmentOrchestrator:
    """
    Automated orchestrator for parallel module execution.
    No human intervention required during normal execution.
    """

    DEPENDENCY_GRAPH = {
        # Wave 1: No dependencies (run immediately)
        "company_context": [],
        "technology_stack": [],
        "traffic_analysis": [],
        "financial_profile": [],

        # Wave 2: Depends on Wave 1
        "competitor_intelligence": ["company_context", "technology_stack"],
        "hiring_signals": ["company_context"],
        "strategic_context": ["company_context"],

        # Wave 3: Depends on Wave 2
        "investor_intelligence": ["company_context", "financial_profile"],
        "executive_intelligence": ["company_context", "strategic_context"],
        "buying_committee": ["company_context", "hiring_signals", "executive_intelligence"],
        "displacement_analysis": ["technology_stack", "competitor_intelligence"],

        # Wave 4: Depends on all previous
        "case_study_matching": ["company_context", "technology_stack"],
        "icp_priority_mapping": ["company_context", "traffic_analysis", "financial_profile",
                                 "technology_stack", "competitor_intelligence"],
        "signal_scoring": ["hiring_signals", "strategic_context", "investor_intelligence"],
        "strategic_signal_brief": ["ALL"]  # Depends on all modules
    }

    WAVES = [
        ["company_context", "technology_stack", "traffic_analysis", "financial_profile"],
        ["competitor_intelligence", "hiring_signals", "strategic_context"],
        ["investor_intelligence", "executive_intelligence", "buying_committee", "displacement_analysis"],
        ["case_study_matching", "icp_priority_mapping", "signal_scoring", "strategic_signal_brief"]
    ]

    async def execute_enrichment(self, domain: str, modules: List[str] = None) -> EnrichmentResult:
        """
        Execute full or partial enrichment with automatic parallelization.

        Args:
            domain: Target company domain
            modules: Specific modules to run (None = all modules)

        Returns:
            EnrichmentResult with all module outputs
        """
        job_id = str(uuid.uuid4())

        # Create execution plan
        execution_plan = self._build_execution_plan(modules)

        # Execute waves sequentially, modules within wave in parallel
        results = {}
        for wave_num, wave_modules in enumerate(execution_plan):
            wave_results = await self._execute_wave(
                domain=domain,
                wave_num=wave_num,
                modules=wave_modules,
                previous_results=results
            )
            results.update(wave_results)

            # Early exit if critical modules failed
            if not self._wave_health_check(wave_results):
                break

        return EnrichmentResult(
            job_id=job_id,
            domain=domain,
            results=results,
            completed_modules=list(results.keys()),
            failed_modules=self._get_failed_modules(results)
        )

    async def _execute_wave(
        self,
        domain: str,
        wave_num: int,
        modules: List[str],
        previous_results: Dict
    ) -> Dict:
        """Execute all modules in a wave concurrently."""

        # Create concurrent tasks for all modules in wave
        tasks = [
            self._execute_module(domain, module, previous_results)
            for module in modules
        ]

        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Map results back to module names
        return {
            module: result
            for module, result in zip(modules, results)
        }

    async def _execute_module(
        self,
        domain: str,
        module_name: str,
        context: Dict
    ) -> ModuleResult:
        """Execute a single module with circuit breaker protection."""

        module = self._get_module_instance(module_name)
        circuit_breaker = self._get_circuit_breaker(module_name)

        try:
            async with circuit_breaker:
                return await module.execute(domain, context)
        except CircuitBreakerOpen:
            return ModuleResult(
                module=module_name,
                status="skipped",
                error="Circuit breaker open - too many failures"
            )
        except Exception as e:
            return ModuleResult(
                module=module_name,
                status="failed",
                error=str(e)
            )
```

---

## Parallel Execution Patterns

### Pattern 1: Wave-Based Parallelism

All modules within a wave execute concurrently:

```python
# Wave 1: 4 parallel tasks
await asyncio.gather(
    fetch_company_context(domain),
    fetch_technology_stack(domain),
    fetch_traffic_analysis(domain),
    fetch_financial_profile(domain)
)

# Wave 2: 3 parallel tasks (after Wave 1 completes)
await asyncio.gather(
    fetch_competitor_intelligence(domain, tech_stack),
    fetch_hiring_signals(domain, company_context),
    fetch_strategic_context(domain, company_context)
)
```

### Pattern 2: Per-Module Parallelism

Within each module, API calls execute in parallel:

```python
# Inside technology_stack module
async def fetch_technology_stack(domain: str) -> TechStackResult:
    # 7 BuiltWith endpoints called in parallel
    builtwith_results = await asyncio.gather(
        builtwith_adapter.domain_lookup(domain),
        builtwith_adapter.relationships_api(domain),
        builtwith_adapter.recommendations_api(domain),
        builtwith_adapter.financial_api(domain),
        builtwith_adapter.social_api(domain),
        builtwith_adapter.trust_api(domain),
        builtwith_adapter.keywords_api(domain)
    )

    # Aggregate results
    return TechStackResult.from_builtwith_data(builtwith_results)
```

### Pattern 3: Competitor Parallelism

Analyze multiple competitors concurrently:

```python
# Inside competitor_intelligence module
async def analyze_competitors(domain: str, competitors: List[str]) -> List[CompetitorResult]:
    # Analyze up to 10 competitors in parallel
    return await asyncio.gather(*[
        analyze_single_competitor(comp)
        for comp in competitors[:10]
    ])
```

### Pattern 4: Data Source Parallelism

Query multiple data sources simultaneously:

```python
# Inside financial_profile module
async def fetch_financial_profile(domain: str, ticker: str) -> FinancialResult:
    # Query Yahoo Finance and SEC in parallel
    yahoo_result, sec_result, news_result = await asyncio.gather(
        yahoo_finance_adapter.get_financials(ticker),
        sec_edgar_adapter.get_latest_10k(ticker),
        websearch_adapter.search_financial_news(domain)
    )

    return FinancialResult.aggregate(yahoo_result, sec_result, news_result)
```

---

## Worker Architecture

### Redis Queue (RQ) Workers

```python
# workers/enrichment_worker.py

from redis import Redis
from rq import Worker, Queue

class EnrichmentWorker:
    """
    Background worker for async enrichment jobs.
    Scales horizontally with multiple worker instances.
    """

    def __init__(self, redis_url: str, concurrency: int = 4):
        self.redis = Redis.from_url(redis_url)
        self.high_queue = Queue('high', connection=self.redis)
        self.default_queue = Queue('default', connection=self.redis)
        self.low_queue = Queue('low', connection=self.redis)
        self.concurrency = concurrency

    def start(self):
        """Start worker with multi-queue support."""
        worker = Worker(
            queues=[self.high_queue, self.default_queue, self.low_queue],
            connection=self.redis
        )
        worker.work(burst=False)


# Job submission
def enqueue_enrichment(domain: str, priority: str = "default") -> str:
    """
    Enqueue enrichment job for background processing.
    Returns job_id for status tracking.
    """
    queue = get_queue(priority)
    job = queue.enqueue(
        EnrichmentOrchestrator.execute_enrichment,
        domain,
        job_timeout=600,  # 10 minutes max
        result_ttl=86400,  # Keep result 24 hours
        failure_ttl=86400
    )
    return job.id
```

### Worker Scaling

```yaml
# docker-compose.yml
services:
  enrichment-worker-1:
    image: partnerforge-worker
    command: python -m workers.enrichment_worker
    environment:
      - REDIS_URL=redis://redis:6379
      - WORKER_CONCURRENCY=4
    deploy:
      replicas: 3  # 3 worker instances

  enrichment-worker-high:
    image: partnerforge-worker
    command: python -m workers.enrichment_worker --queue high
    environment:
      - REDIS_URL=redis://redis:6379
      - WORKER_CONCURRENCY=2
    deploy:
      replicas: 2  # Dedicated high-priority workers
```

---

## Circuit Breaker Pattern

Prevents cascade failures when external APIs are down:

```python
# adapters/circuit_breaker.py

class CircuitBreaker:
    """
    Circuit breaker for external API resilience.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests blocked
    - HALF_OPEN: Testing if service recovered
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exceptions: tuple = (TimeoutError, ConnectionError)
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exceptions = expected_exceptions
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED

    async def __aenter__(self):
        if self.state == CircuitState.OPEN:
            if self._should_attempt_recovery():
                self.state = CircuitState.HALF_OPEN
            else:
                raise CircuitBreakerOpen()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self._record_success()
        elif exc_type in self.expected_exceptions:
            self._record_failure()
        return False

    def _record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

    def _record_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED

    def _should_attempt_recovery(self) -> bool:
        return time.time() - self.last_failure_time > self.recovery_timeout


# Per-adapter circuit breakers
CIRCUIT_BREAKERS = {
    "builtwith": CircuitBreaker(failure_threshold=5, recovery_timeout=60),
    "similarweb": CircuitBreaker(failure_threshold=5, recovery_timeout=60),
    "yahoo_finance": CircuitBreaker(failure_threshold=3, recovery_timeout=120),
    "sec_edgar": CircuitBreaker(failure_threshold=3, recovery_timeout=120),
    "websearch": CircuitBreaker(failure_threshold=10, recovery_timeout=30),
}
```

---

## Rate Limiting Architecture

### Per-User Rate Limiting

```python
# middleware/rate_limiter.py

class RateLimiter:
    """
    Redis-backed sliding window rate limiter.
    Applies per-API-key limits.
    """

    def __init__(self, redis: Redis, default_rpm: int = 60):
        self.redis = redis
        self.default_rpm = default_rpm

    async def check_rate_limit(self, api_key_id: str, limit: int = None) -> bool:
        """
        Check if request is within rate limit.

        Args:
            api_key_id: Unique API key identifier
            limit: Requests per minute (None = use default)

        Returns:
            True if within limit, False if exceeded
        """
        limit = limit or self.default_rpm
        key = f"rate_limit:{api_key_id}"
        current_minute = int(time.time() / 60)

        # Use Redis pipeline for atomic operations
        pipe = self.redis.pipeline()
        pipe.hincrby(key, str(current_minute), 1)
        pipe.expire(key, 120)  # Keep 2 minutes of data
        result = await pipe.execute()

        count = result[0]
        return count <= limit


# Apply to FastAPI
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    api_key = request.headers.get("X-API-Key")
    if api_key:
        api_key_data = await get_api_key_data(api_key)
        if not await rate_limiter.check_rate_limit(
            api_key_data.id,
            api_key_data.rate_limit_rpm
        ):
            raise HTTPException(429, "Rate limit exceeded")

    return await call_next(request)
```

### Per-API Rate Limiting

Respect external API rate limits:

```python
# adapters/rate_limited_adapter.py

class RateLimitedAdapter:
    """
    Adapter with built-in rate limiting for external APIs.
    """

    # External API rate limits
    RATE_LIMITS = {
        "builtwith": {"rpm": 30, "concurrent": 5},
        "similarweb": {"rpm": 60, "concurrent": 10},
        "yahoo_finance": {"rpm": 100, "concurrent": 10},
        "websearch": {"rpm": 300, "concurrent": 20}
    }

    def __init__(self, api_name: str):
        self.api_name = api_name
        self.limits = self.RATE_LIMITS[api_name]
        self.semaphore = asyncio.Semaphore(self.limits["concurrent"])
        self.rate_limiter = LeakyBucketRateLimiter(
            rate=self.limits["rpm"],
            capacity=self.limits["rpm"]
        )

    async def call(self, endpoint: str, **kwargs) -> dict:
        """Make rate-limited API call."""

        # Wait for rate limit token
        await self.rate_limiter.acquire()

        # Limit concurrent requests
        async with self.semaphore:
            return await self._make_request(endpoint, **kwargs)
```

---

## Progress Tracking

Real-time progress updates via WebSocket:

```python
# services/progress_tracker.py

class ProgressTracker:
    """
    Track and broadcast enrichment progress.
    """

    def __init__(self, redis: Redis):
        self.redis = redis
        self.pubsub = redis.pubsub()

    async def update_progress(
        self,
        job_id: str,
        module: str,
        status: str,
        percent: int = None
    ):
        """Update progress and broadcast to subscribers."""

        progress = {
            "job_id": job_id,
            "module": module,
            "status": status,
            "percent": percent,
            "timestamp": time.time()
        }

        # Store in Redis
        await self.redis.hset(f"progress:{job_id}", module, json.dumps(progress))

        # Broadcast to WebSocket subscribers
        await self.redis.publish(f"progress:{job_id}", json.dumps(progress))

    async def get_progress(self, job_id: str) -> dict:
        """Get current progress for all modules."""
        progress = await self.redis.hgetall(f"progress:{job_id}")
        return {
            module: json.loads(data)
            for module, data in progress.items()
        }


# WebSocket endpoint
@app.websocket("/ws/progress/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()

    # Subscribe to progress updates
    tracker = ProgressTracker(redis)
    async for message in tracker.subscribe(job_id):
        await websocket.send_json(message)
```

---

## Execution Time Estimates

### Sequential Execution (Current)
```
M01 + M02 + M03 + M04 + M05 + ... + M15
= 10s + 15s + 8s + 12s + 20s + ...
= ~180-300 seconds (3-5 minutes)
```

### Parallel Execution (New Architecture)
```
Wave 1: max(M01, M02, M03, M04) = max(10s, 15s, 8s, 12s) = 15s
Wave 2: max(M05, M06, M07) = max(20s, 12s, 8s) = 20s
Wave 3: max(M08, M09, M10, M11) = max(15s, 10s, 8s, 12s) = 15s
Wave 4: max(M12, M13, M14, M15) = max(5s, 8s, 5s, 10s) = 10s

Total = 15 + 20 + 15 + 10 = 60 seconds
```

**Speedup: 3-5x faster with parallel execution**

---

## API Endpoints for Orchestration

### Trigger Enrichment
```
POST /api/v1/enrich/{domain}
Content-Type: application/json
X-API-Key: your-api-key

{
  "modules": ["all"],  // or specific modules
  "priority": "high",   // high, default, low
  "async": true         // true = background job, false = wait for completion
}

Response:
{
  "job_id": "uuid",
  "status": "queued",
  "estimated_time_seconds": 60,
  "progress_websocket": "wss://api.partnerforge.com/ws/progress/{job_id}"
}
```

### Check Progress
```
GET /api/v1/jobs/{job_id}/progress

Response:
{
  "job_id": "uuid",
  "status": "running",
  "wave": 2,
  "modules": {
    "company_context": {"status": "completed", "duration_ms": 8500},
    "technology_stack": {"status": "completed", "duration_ms": 12300},
    "traffic_analysis": {"status": "completed", "duration_ms": 6200},
    "financial_profile": {"status": "completed", "duration_ms": 10100},
    "competitor_intelligence": {"status": "running", "percent": 60},
    "hiring_signals": {"status": "running", "percent": 40},
    "strategic_context": {"status": "pending"}
  },
  "elapsed_seconds": 25,
  "estimated_remaining_seconds": 35
}
```

### Get Partial Results
```
GET /api/v1/jobs/{job_id}/results?include_partial=true

Response:
{
  "job_id": "uuid",
  "status": "running",
  "completed_modules": ["company_context", "technology_stack", "traffic_analysis", "financial_profile"],
  "results": {
    "company_context": {...},
    "technology_stack": {...},
    "traffic_analysis": {...},
    "financial_profile": {...}
  },
  "pending_modules": ["competitor_intelligence", "hiring_signals", ...]
}
```

---

## Batch Enrichment

Process multiple domains in parallel:

```python
# services/batch_orchestrator.py

class BatchOrchestrator:
    """
    Orchestrate parallel enrichment of multiple domains.
    """

    MAX_CONCURRENT_DOMAINS = 10  # Respect external API limits

    async def enrich_batch(
        self,
        domains: List[str],
        priority: str = "default"
    ) -> BatchResult:
        """
        Enrich multiple domains with controlled parallelism.
        """
        semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_DOMAINS)

        async def enrich_with_limit(domain: str):
            async with semaphore:
                return await EnrichmentOrchestrator().execute_enrichment(domain)

        results = await asyncio.gather(*[
            enrich_with_limit(domain)
            for domain in domains
        ], return_exceptions=True)

        return BatchResult(
            total=len(domains),
            successful=sum(1 for r in results if not isinstance(r, Exception)),
            failed=sum(1 for r in results if isinstance(r, Exception)),
            results=dict(zip(domains, results))
        )
```

---

## Error Recovery

### Retry Strategy

```python
# adapters/retry.py

class RetryStrategy:
    """
    Exponential backoff retry with jitter.
    """

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
        exponential_base: float = 2.0
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base

    async def execute(self, func: Callable, *args, **kwargs):
        """Execute function with retry logic."""

        last_exception = None

        for attempt in range(self.max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except (TimeoutError, ConnectionError) as e:
                last_exception = e

                if attempt < self.max_retries:
                    delay = self._calculate_delay(attempt)
                    await asyncio.sleep(delay)

        raise last_exception

    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and jitter."""
        delay = self.base_delay * (self.exponential_base ** attempt)
        delay = min(delay, self.max_delay)
        # Add jitter (±25%)
        jitter = delay * 0.25 * (random.random() * 2 - 1)
        return delay + jitter
```

### Partial Failure Handling

```python
# services/failure_handler.py

class FailureHandler:
    """
    Handle module failures gracefully.
    """

    # Critical modules - abort if these fail
    CRITICAL_MODULES = ["company_context"]

    # Optional modules - continue if these fail
    OPTIONAL_MODULES = ["investor_intelligence", "hiring_signals"]

    async def handle_module_failure(
        self,
        job_id: str,
        module: str,
        error: Exception
    ) -> FailureAction:
        """
        Determine action for module failure.

        Returns:
            ABORT: Stop entire enrichment
            CONTINUE: Continue with remaining modules
            RETRY: Retry this module
        """
        if module in self.CRITICAL_MODULES:
            return FailureAction.ABORT

        if isinstance(error, (TimeoutError, RateLimitError)):
            return FailureAction.RETRY

        # Log and continue for optional modules
        await self._log_failure(job_id, module, error)
        return FailureAction.CONTINUE
```

---

## Summary: Orchestration Design

| Question | Answer |
|----------|--------|
| **Human orchestrator needed?** | NO - Fully automated |
| **What does human do?** | Initiate, review results, handle exceptions |
| **What does orchestrator do?** | Resolve dependencies, parallelize, recover from failures |
| **Max parallel modules?** | 4 per wave |
| **Max parallel domains?** | 10 for batch operations |
| **Speedup vs. sequential?** | 3-5x faster |
| **Failure handling?** | Circuit breaker + retry + partial completion |

---

*Document Version: 1.0*
*Last Updated: 2026-02-25*
*Author: Thread 1 - Backend Architecture*
