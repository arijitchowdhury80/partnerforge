# PartnerForge Orchestrator & Parallel Execution Design

**Version**: 1.0
**Date**: 2026-02-25
**Author**: Thread 4 (Infrastructure)

---

## Executive Summary

PartnerForge uses a **Job-Based Orchestrator** pattern where:
1. **Human triggers** work (UI, CLI, API, scheduled)
2. **Orchestrator Service** coordinates parallel execution
3. **Worker Pool** executes intelligence modules in parallel
4. **Event Bus** enables real-time progress updates

---

## Part 1: Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATION ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRIGGERS (Human or Scheduled)                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Dashboard  │  │  CLI/Skill  │  │  REST API   │  │  Scheduler  │        │
│  │  (Click)    │  │  /pf enrich │  │  POST /api  │  │  (Cron)     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                                   ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        API GATEWAY (FastAPI)                          │  │
│  │  • Request validation                                                 │  │
│  │  • Authentication                                                     │  │
│  │  • Rate limiting (per user)                                          │  │
│  │  • Job creation                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                   │                                          │
│                                   ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     ORCHESTRATOR SERVICE                              │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │ Job Queue   │  │ Dependency  │  │ Progress    │                   │  │
│  │  │ Manager     │  │ Resolver    │  │ Tracker     │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │ Wave        │  │ Retry       │  │ Circuit     │                   │  │
│  │  │ Coordinator │  │ Handler     │  │ Breaker     │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                   │                                          │
│         ┌─────────────────────────┼─────────────────────────┐               │
│         │                         │                         │               │
│         ▼                         ▼                         ▼               │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐       │
│  │  WORKER 1   │           │  WORKER 2   │           │  WORKER N   │       │
│  │  (Module)   │           │  (Module)   │           │  (Module)   │       │
│  └─────────────┘           └─────────────┘           └─────────────┘       │
│         │                         │                         │               │
│         └─────────────────────────┼─────────────────────────┘               │
│                                   │                                          │
│                                   ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         REDIS (Event Bus)                             │  │
│  │  • Job queues (priority-based)                                        │  │
│  │  • Progress events (SSE/WebSocket)                                    │  │
│  │  • Rate limit counters                                                │  │
│  │  • Circuit breaker state                                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Parallel Execution Patterns

### Pattern 1: Wave-Based Module Execution

Intelligence modules have dependencies. We execute in **5 parallel waves**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WAVE-BASED PARALLEL EXECUTION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WAVE 1 (Parallel: 1 task)                    ⏱️ 5-10 sec                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      COMPANY CONTEXT                                │    │
│  │  WebSearch + BuiltWith keywords-api                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                   │                                          │
│                                   ▼                                          │
│  WAVE 2 (Parallel: 3 tasks)                   ⏱️ 15-30 sec                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  TECH STACK     │  │  FINANCIAL      │  │  TRAFFIC        │              │
│  │  BuiltWith ×6   │  │  Yahoo Finance  │  │  SimilarWeb ×11 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│         │                    │                    │                          │
│         └────────────────────┴────────────────────┘                          │
│                                   │                                          │
│                                   ▼                                          │
│  WAVE 3 (Parallel: 4 tasks)                   ⏱️ 30-60 sec                   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐                 │
│  │ COMPETITOR│  │ STRATEGIC │  │  HIRING   │  │ INVESTOR  │                 │
│  │ INTEL     │  │ CONTEXT   │  │ SIGNALS   │  │ INTEL     │                 │
│  │           │  │           │  │           │  │           │                 │
│  │ SW similar│  │ WebSearch │  │ LinkedIn  │  │ SEC EDGAR │                 │
│  │ + BW ×N   │  │ news/PR   │  │ Jobs API  │  │ + earnings│                 │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘                 │
│         │              │              │              │                       │
│         └──────────────┴──────────────┴──────────────┘                       │
│                                   │                                          │
│                                   ▼                                          │
│  WAVE 4 (Parallel: 3 tasks)                   ⏱️ 10-20 sec                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  CASE STUDY     │  │  EXECUTIVE      │  │  BUYING         │              │
│  │  MATCHING       │  │  QUOTES         │  │  COMMITTEE      │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                   │                                          │
│                                   ▼                                          │
│  WAVE 5 (Sequential: 1 task)                  ⏱️ 5-10 sec                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ICP-PRIORITY MAPPING                             │    │
│  │  Cross-reference all data, calculate scores, generate deliverables │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  TOTAL TIME: 65-130 seconds (vs 300+ seconds sequential)                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pattern 2: Competitor Analysis Parallelization

When analyzing competitors, fetch tech stack for ALL competitors in parallel:

```python
async def analyze_competitors(domain: str, competitors: List[str]) -> List[CompetitorIntel]:
    """Fetch competitor intelligence in parallel."""

    # Create tasks for all competitors
    tasks = [
        asyncio.create_task(fetch_competitor_intel(comp))
        for comp in competitors[:10]  # Limit to top 10
    ]

    # Execute ALL in parallel
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out failures
    return [r for r in results if not isinstance(r, Exception)]


async def fetch_competitor_intel(competitor_domain: str) -> CompetitorIntel:
    """Fetch all data for one competitor in parallel."""

    # Parallel fetch: traffic + tech stack
    traffic_task = fetch_similarweb_traffic(competitor_domain)
    tech_task = fetch_builtwith_tech(competitor_domain)

    traffic, tech = await asyncio.gather(traffic_task, tech_task)

    return CompetitorIntel(
        domain=competitor_domain,
        monthly_visits=traffic.visits,
        search_vendor=extract_search_vendor(tech),
        has_algolia="algolia" in str(tech).lower(),
    )
```

### Pattern 3: Multi-Account Batch Enrichment

When enriching multiple accounts, process them in parallel batches:

```python
async def batch_enrich(
    domains: List[str],
    batch_size: int = 5,  # Parallel accounts
    max_concurrent_apis: int = 10  # Rate limit protection
) -> BatchResult:
    """Enrich multiple accounts in parallel batches."""

    semaphore = asyncio.Semaphore(max_concurrent_apis)
    results = []

    # Process in batches of 5 accounts
    for i in range(0, len(domains), batch_size):
        batch = domains[i:i + batch_size]

        # Enrich all accounts in this batch in parallel
        batch_tasks = [
            enrich_with_semaphore(domain, semaphore)
            for domain in batch
        ]

        batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
        results.extend(batch_results)

        # Progress update
        progress = (i + len(batch)) / len(domains) * 100
        await publish_progress(f"Batch enrichment: {progress:.1f}%")

    return BatchResult(results=results)
```

### Pattern 4: Data Source Parallelization

Within a single module, fetch from multiple endpoints in parallel:

```python
async def fetch_traffic_data(domain: str) -> TrafficData:
    """Fetch all SimilarWeb data in parallel."""

    # 11 parallel API calls
    tasks = {
        "visits": fetch_sw_visits(domain),
        "sources": fetch_sw_sources(domain),
        "geography": fetch_sw_geography(domain),
        "demographics": fetch_sw_demographics(domain),
        "keywords": fetch_sw_keywords(domain),
        "audience": fetch_sw_audience(domain),
        "rank": fetch_sw_rank(domain),
        "referrals": fetch_sw_referrals(domain),
        "popular_pages": fetch_sw_popular_pages(domain),
        "similar_sites": fetch_sw_similar_sites(domain),
        "keyword_competitors": fetch_sw_keyword_competitors(domain),
    }

    # Execute ALL in parallel
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    # Map results back to keys
    data = dict(zip(tasks.keys(), results))

    return TrafficData(**data)
```

---

## Part 3: Orchestrator Service Design

### Core Components

```python
# orchestrator/service.py

class OrchestratorService:
    """Coordinates parallel execution of intelligence modules."""

    def __init__(
        self,
        redis: Redis,
        db: AsyncSession,
        worker_pool: WorkerPool,
    ):
        self.redis = redis
        self.db = db
        self.workers = worker_pool
        self.dependency_graph = self._build_dependency_graph()

    async def enrich_account(
        self,
        domain: str,
        modules: List[str] = None,
        priority: int = 5,
    ) -> Job:
        """Create and execute an enrichment job."""

        # 1. Create job record
        job = await self._create_job(domain, modules, priority)

        # 2. Queue job
        await self._queue_job(job)

        # 3. Return immediately (async execution)
        return job

    async def execute_job(self, job: Job) -> JobResult:
        """Execute a job with wave-based parallelization."""

        # 1. Resolve dependencies into waves
        waves = self._resolve_waves(job.modules)

        # 2. Execute each wave
        for wave_num, wave_modules in enumerate(waves):
            await self._publish_progress(job, f"Wave {wave_num + 1}/{len(waves)}")

            # Execute all modules in this wave IN PARALLEL
            tasks = [
                self._execute_module(job, module)
                for module in wave_modules
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Handle failures
            for module, result in zip(wave_modules, results):
                if isinstance(result, Exception):
                    await self._handle_module_failure(job, module, result)

        # 3. Generate deliverables
        await self._generate_deliverables(job)

        return JobResult(job_id=job.id, status="completed")

    def _resolve_waves(self, modules: List[str]) -> List[List[str]]:
        """Resolve module dependencies into execution waves."""

        WAVES = [
            # Wave 1: No dependencies
            ["company-context"],

            # Wave 2: Depends on company-context
            ["tech-stack", "financial", "traffic"],

            # Wave 3: Depends on Wave 2
            ["competitors", "strategic", "hiring", "investor"],

            # Wave 4: Depends on Wave 3
            ["case-study", "executive-quotes", "buying-committee"],

            # Wave 5: Depends on all above
            ["icp-mapping"],
        ]

        # Filter to requested modules
        if modules:
            return [
                [m for m in wave if m in modules]
                for wave in WAVES
            ]
        return WAVES
```

### Job Queue with Priority

```python
# orchestrator/queue.py

class JobQueue:
    """Redis-based job queue with priority support."""

    QUEUE_KEY = "partnerforge:jobs:{priority}"

    async def enqueue(self, job: Job) -> None:
        """Add job to priority queue."""
        queue_key = self.QUEUE_KEY.format(priority=job.priority)
        await self.redis.zadd(
            queue_key,
            {job.id: time.time()}
        )

    async def dequeue(self) -> Optional[Job]:
        """Get highest priority job."""

        # Check queues in priority order (1 = highest)
        for priority in range(1, 11):
            queue_key = self.QUEUE_KEY.format(priority=priority)

            # Atomic pop
            result = await self.redis.zpopmin(queue_key, count=1)
            if result:
                job_id = result[0][0]
                return await self._load_job(job_id)

        return None
```

### Progress Tracking with SSE

```python
# orchestrator/progress.py

class ProgressTracker:
    """Real-time progress updates via Server-Sent Events."""

    CHANNEL = "partnerforge:progress:{job_id}"

    async def publish(
        self,
        job_id: str,
        event: str,
        data: dict
    ) -> None:
        """Publish progress event."""

        message = {
            "event": event,
            "data": data,
            "timestamp": time.time(),
        }

        await self.redis.publish(
            self.CHANNEL.format(job_id=job_id),
            json.dumps(message)
        )

    async def subscribe(self, job_id: str) -> AsyncGenerator[dict, None]:
        """Subscribe to progress updates (for SSE endpoint)."""

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(self.CHANNEL.format(job_id=job_id))

        async for message in pubsub.listen():
            if message["type"] == "message":
                yield json.loads(message["data"])
```

---

## Part 4: Worker Pool Design

```python
# workers/pool.py

class WorkerPool:
    """Pool of workers for parallel module execution."""

    def __init__(
        self,
        num_workers: int = 10,
        adapters: Dict[str, DataAdapter] = None,
    ):
        self.num_workers = num_workers
        self.adapters = adapters or {}
        self.semaphores = {
            "builtwith": asyncio.Semaphore(5),   # 5 concurrent
            "similarweb": asyncio.Semaphore(5),  # 5 concurrent
            "yahoo": asyncio.Semaphore(3),       # 3 concurrent
            "websearch": asyncio.Semaphore(10),  # 10 concurrent
        }

    async def execute_module(
        self,
        module_id: str,
        domain: str,
        context: Dict,
    ) -> ModuleResult:
        """Execute a single intelligence module."""

        module = self._get_module(module_id)

        # Acquire semaphores for required data sources
        async with self._acquire_semaphores(module.data_sources):
            # Execute module pipeline
            raw = await module.collect(domain, context)
            normalized = await module.transform(raw)
            enriched = await module.enrich(normalized, context)

            return ModuleResult(
                module_id=module_id,
                data=enriched,
            )

    @asynccontextmanager
    async def _acquire_semaphores(self, sources: List[str]):
        """Acquire all required semaphores."""

        acquired = []
        try:
            for source in sources:
                sem = self.semaphores.get(source)
                if sem:
                    await sem.acquire()
                    acquired.append(sem)
            yield
        finally:
            for sem in acquired:
                sem.release()
```

---

## Part 5: API Endpoints

```python
# api/orchestrator_routes.py

@router.post("/api/v1/enrich/{domain}")
async def enrich_account(
    domain: str,
    background_tasks: BackgroundTasks,
    modules: List[str] = Query(default=None),
    priority: int = Query(default=5, ge=1, le=10),
    force: bool = Query(default=False),
) -> EnrichmentResponse:
    """
    Trigger enrichment for an account.

    Returns immediately with job_id. Use SSE endpoint to track progress.
    """

    # Create job
    job = await orchestrator.enrich_account(
        domain=domain,
        modules=modules,
        priority=priority,
        force=force,
    )

    # Execute in background
    background_tasks.add_task(orchestrator.execute_job, job)

    return EnrichmentResponse(
        job_id=job.id,
        status="queued",
        progress_url=f"/api/v1/enrich/progress/{job.id}",
    )


@router.get("/api/v1/enrich/progress/{job_id}")
async def stream_progress(job_id: str) -> EventSourceResponse:
    """
    Server-Sent Events endpoint for real-time progress.

    Events:
    - wave_start: {wave: 1, modules: ["company-context"]}
    - module_start: {module: "tech-stack"}
    - module_complete: {module: "tech-stack", duration_ms: 1234}
    - module_error: {module: "tech-stack", error: "..."}
    - wave_complete: {wave: 1}
    - job_complete: {status: "completed", duration_ms: 65000}
    """

    async def event_generator():
        async for event in progress_tracker.subscribe(job_id):
            yield {
                "event": event["event"],
                "data": json.dumps(event["data"]),
            }

    return EventSourceResponse(event_generator())


@router.post("/api/v1/batch/enrich")
async def batch_enrich(
    request: BatchEnrichRequest,
    background_tasks: BackgroundTasks,
) -> BatchResponse:
    """
    Enrich multiple accounts in parallel.

    Request body:
    {
        "domains": ["costco.com", "sallybeauty.com", ...],
        "batch_size": 5,
        "modules": ["financial", "competitors"]
    }
    """

    batch = await orchestrator.create_batch(
        domains=request.domains,
        modules=request.modules,
        batch_size=request.batch_size,
    )

    background_tasks.add_task(orchestrator.execute_batch, batch)

    return BatchResponse(
        batch_id=batch.id,
        total_accounts=len(request.domains),
        progress_url=f"/api/v1/batch/progress/{batch.id}",
    )
```

---

## Part 6: Frontend Integration

```typescript
// hooks/useEnrichment.ts

export function useEnrichment(domain: string) {
  const [status, setStatus] = useState<EnrichmentStatus>("idle");
  const [progress, setProgress] = useState<Progress | null>(null);

  const startEnrichment = async (modules?: string[]) => {
    setStatus("starting");

    // 1. Trigger enrichment
    const { job_id, progress_url } = await api.post(`/enrich/${domain}`, {
      modules,
      priority: 5,
    });

    // 2. Connect to SSE for progress
    const eventSource = new EventSource(progress_url);

    eventSource.addEventListener("wave_start", (e) => {
      const data = JSON.parse(e.data);
      setProgress({ wave: data.wave, modules: data.modules });
    });

    eventSource.addEventListener("module_complete", (e) => {
      const data = JSON.parse(e.data);
      setProgress(prev => ({
        ...prev,
        completedModules: [...(prev?.completedModules || []), data.module],
      }));
    });

    eventSource.addEventListener("job_complete", (e) => {
      setStatus("completed");
      eventSource.close();
    });

    eventSource.addEventListener("error", () => {
      setStatus("error");
      eventSource.close();
    });
  };

  return { status, progress, startEnrichment };
}
```

---

## Part 7: Configuration

```python
# config/orchestrator.py

class OrchestratorConfig:
    """Configuration for parallel execution."""

    # Worker pool
    NUM_WORKERS: int = 10

    # Batch processing
    DEFAULT_BATCH_SIZE: int = 5
    MAX_BATCH_SIZE: int = 20

    # Rate limiting (per data source)
    RATE_LIMITS: Dict[str, int] = {
        "builtwith": 5,      # 5 concurrent requests
        "similarweb": 5,     # 5 concurrent requests
        "yahoo": 3,          # 3 concurrent requests
        "websearch": 10,     # 10 concurrent requests
        "linkedin": 2,       # 2 concurrent (strict rate limits)
    }

    # Circuit breaker
    CIRCUIT_BREAKER_THRESHOLD: int = 5  # failures before open
    CIRCUIT_BREAKER_TIMEOUT: int = 60   # seconds before half-open

    # Retry policy
    MAX_RETRIES: int = 3
    RETRY_BACKOFF: float = 2.0  # exponential backoff multiplier

    # Timeouts
    MODULE_TIMEOUT: int = 120   # seconds per module
    JOB_TIMEOUT: int = 600      # seconds per job (10 min)
```

---

## Summary

### Parallelization Points

| Level | What's Parallelized | Concurrency |
|-------|---------------------|-------------|
| **Wave** | Modules within same wave | 3-4 modules |
| **Module** | API calls within module | 6-11 endpoints |
| **Competitor** | Each competitor analysis | 5-10 competitors |
| **Batch** | Multiple accounts | 5-20 accounts |

### Orchestrator Responsibilities

1. **Job Management** - Create, queue, track, complete
2. **Dependency Resolution** - Wave-based execution order
3. **Parallel Coordination** - Semaphores, rate limiting
4. **Progress Streaming** - SSE events to frontend
5. **Error Handling** - Retries, circuit breakers
6. **Deliverable Generation** - After all modules complete

### Human vs. Orchestrator

| Action | Who Does It |
|--------|-------------|
| Trigger enrichment | Human (UI click, CLI, API call) |
| Coordinate waves | Orchestrator |
| Execute modules in parallel | Worker Pool |
| Track progress | Orchestrator + Redis |
| Handle retries | Orchestrator |
| Generate deliverables | Orchestrator |
| Monitor health | Human (dashboard) |

---

*Document Version: 1.0*
*Created: 2026-02-25*
