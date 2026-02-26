# PartnerForge Observability & Metrics Architecture

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Architecture Design
**Priority:** P1 - Required for Production Operations

---

## 1. Observability Pillars

```
┌─────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY STACK                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    METRICS   │  │    LOGS      │  │   TRACES     │          │
│  │  (Prometheus)│  │  (Loki/ELK)  │  │  (Jaeger)    │          │
│  │              │  │              │  │              │          │
│  │  • Counters  │  │  • Errors    │  │  • Request   │          │
│  │  • Gauges    │  │  • Audit     │  │    flow      │          │
│  │  • Histograms│  │  • Debug     │  │  • Latency   │          │
│  │              │  │              │  │    breakdown │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                      │
│                   ┌───────────────┐                             │
│                   │   GRAFANA     │                             │
│                   │  Dashboards   │                             │
│                   └───────┬───────┘                             │
│                           │                                      │
│                   ┌───────▼───────┐                             │
│                   │    ALERTS     │                             │
│                   │  (PagerDuty/  │                             │
│                   │   Slack)      │                             │
│                   └───────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Metrics Definition

### 2.1 Core Metrics

```python
# observability/metrics.py

from prometheus_client import Counter, Histogram, Gauge, Info
from functools import wraps
import time

# ============ ENRICHMENT METRICS ============

# Total enrichments
enrichment_total = Counter(
    "partnerforge_enrichment_total",
    "Total number of enrichment jobs",
    ["status", "trigger_type"]  # status: completed, partial, failed
)

# Enrichment duration
enrichment_duration_seconds = Histogram(
    "partnerforge_enrichment_duration_seconds",
    "Time to complete enrichment",
    ["wave", "domain_tier"],
    buckets=[5, 10, 30, 60, 120, 300, 600]  # 5s to 10min
)

# Active enrichments
active_enrichments = Gauge(
    "partnerforge_active_enrichments",
    "Number of currently running enrichments"
)

# Enrichment queue depth
queue_depth = Gauge(
    "partnerforge_queue_depth",
    "Number of enrichments waiting in queue",
    ["priority"]  # HOT, WARM, COOL, COLD
)


# ============ MODULE METRICS ============

# Module executions
module_executions_total = Counter(
    "partnerforge_module_executions_total",
    "Total module executions",
    ["module_id", "status"]  # M01-M15, success/failure
)

# Module duration
module_duration_seconds = Histogram(
    "partnerforge_module_duration_seconds",
    "Module execution time",
    ["module_id"],
    buckets=[0.5, 1, 2, 5, 10, 30, 60]
)

# Module failure rate (derived metric for alerting)
# Calculated as: rate(module_executions_total{status="failed"}[5m]) /
#                rate(module_executions_total[5m])


# ============ ADAPTER METRICS ============

# API calls
api_calls_total = Counter(
    "partnerforge_api_calls_total",
    "Total external API calls",
    ["adapter", "endpoint", "status"]  # status: success, error, timeout
)

# API latency
api_latency_seconds = Histogram(
    "partnerforge_api_latency_seconds",
    "External API response time",
    ["adapter", "endpoint"],
    buckets=[0.1, 0.25, 0.5, 1, 2, 5, 10, 30]
)

# API error rate (for circuit breaker)
api_errors_total = Counter(
    "partnerforge_api_errors_total",
    "Total API errors by type",
    ["adapter", "error_type"]  # timeout, rate_limit, server_error, auth_error
)


# ============ CIRCUIT BREAKER METRICS ============

circuit_breaker_state = Gauge(
    "partnerforge_circuit_breaker_state",
    "Circuit breaker state (0=closed, 1=open, 2=half_open)",
    ["adapter"]
)

circuit_breaker_trips = Counter(
    "partnerforge_circuit_breaker_trips_total",
    "Number of times circuit breaker tripped to OPEN",
    ["adapter"]
)


# ============ RATE LIMITER METRICS ============

rate_limiter_tokens = Gauge(
    "partnerforge_rate_limiter_tokens",
    "Available rate limit tokens",
    ["adapter"]
)

rate_limiter_waits_total = Counter(
    "partnerforge_rate_limiter_waits_total",
    "Number of requests that had to wait for rate limit",
    ["adapter"]
)

rate_limiter_wait_seconds = Histogram(
    "partnerforge_rate_limiter_wait_seconds",
    "Time spent waiting for rate limit",
    ["adapter"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30]
)


# ============ CACHE METRICS ============

cache_hits_total = Counter(
    "partnerforge_cache_hits_total",
    "Cache hits",
    ["cache_type", "adapter"]
)

cache_misses_total = Counter(
    "partnerforge_cache_misses_total",
    "Cache misses",
    ["cache_type", "adapter"]
)

cache_hit_ratio = Gauge(
    "partnerforge_cache_hit_ratio",
    "Cache hit ratio (0-1)",
    ["cache_type"]
)


# ============ DATA QUALITY METRICS ============

source_freshness_days = Histogram(
    "partnerforge_source_freshness_days",
    "Age of data sources in days",
    ["source_type"],
    buckets=[1, 7, 30, 90, 180, 365]
)

data_completeness = Gauge(
    "partnerforge_data_completeness",
    "Percentage of fields populated",
    ["module_id"]
)

source_validation_failures = Counter(
    "partnerforge_source_validation_failures_total",
    "Source citation validation failures",
    ["failure_type"]  # missing_url, expired, invalid_type
)


# ============ CHANGE DETECTION METRICS ============

changes_detected_total = Counter(
    "partnerforge_changes_detected_total",
    "Total changes detected",
    ["significance", "change_type"]
)

opportunity_signals_total = Counter(
    "partnerforge_opportunity_signals_total",
    "Total opportunity signals detected",
    ["signal_type"]
)

notification_sent_total = Counter(
    "partnerforge_notifications_sent_total",
    "Total notifications sent",
    ["channel", "significance"]
)


# ============ BUSINESS METRICS ============

accounts_enriched_total = Counter(
    "partnerforge_accounts_enriched_total",
    "Total unique accounts enriched",
    ["priority"]
)

hot_leads_detected_total = Counter(
    "partnerforge_hot_leads_detected_total",
    "Total hot leads (score >= 80) detected"
)

api_cost_usd = Counter(
    "partnerforge_api_cost_usd_total",
    "Total API costs in USD",
    ["adapter", "team"]
)
```

### 2.2 Metric Decorators

```python
# observability/decorators.py

def track_enrichment(func):
    """Decorator to track enrichment metrics."""
    @wraps(func)
    async def wrapper(self, domain: str, *args, **kwargs):
        active_enrichments.inc()
        start_time = time.time()

        try:
            result = await func(self, domain, *args, **kwargs)

            enrichment_total.labels(
                status=result.status,
                trigger_type=kwargs.get("trigger_type", "manual")
            ).inc()

            enrichment_duration_seconds.labels(
                wave="all",
                domain_tier=result.icp_tier or "unknown"
            ).observe(time.time() - start_time)

            return result

        except Exception as e:
            enrichment_total.labels(
                status="failed",
                trigger_type=kwargs.get("trigger_type", "manual")
            ).inc()
            raise

        finally:
            active_enrichments.dec()

    return wrapper


def track_module(module_id: str):
    """Decorator to track module execution metrics."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)

                module_executions_total.labels(
                    module_id=module_id,
                    status="success"
                ).inc()

                module_duration_seconds.labels(
                    module_id=module_id
                ).observe(time.time() - start_time)

                return result

            except Exception as e:
                module_executions_total.labels(
                    module_id=module_id,
                    status="failure"
                ).inc()
                raise

        return wrapper
    return decorator


def track_api_call(adapter: str, endpoint: str):
    """Decorator to track external API calls."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)

                api_calls_total.labels(
                    adapter=adapter,
                    endpoint=endpoint,
                    status="success"
                ).inc()

                api_latency_seconds.labels(
                    adapter=adapter,
                    endpoint=endpoint
                ).observe(time.time() - start_time)

                return result

            except TimeoutError:
                api_calls_total.labels(
                    adapter=adapter,
                    endpoint=endpoint,
                    status="timeout"
                ).inc()
                api_errors_total.labels(
                    adapter=adapter,
                    error_type="timeout"
                ).inc()
                raise

            except RateLimitError:
                api_calls_total.labels(
                    adapter=adapter,
                    endpoint=endpoint,
                    status="rate_limited"
                ).inc()
                api_errors_total.labels(
                    adapter=adapter,
                    error_type="rate_limit"
                ).inc()
                raise

            except Exception as e:
                api_calls_total.labels(
                    adapter=adapter,
                    endpoint=endpoint,
                    status="error"
                ).inc()
                api_errors_total.labels(
                    adapter=adapter,
                    error_type="server_error"
                ).inc()
                raise

        return wrapper
    return decorator
```

---

## 3. Logging Architecture

### 3.1 Structured Logging

```python
# observability/logging.py

import structlog
from typing import Any

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


class EnrichmentLogger:
    """Structured logging for enrichment operations."""

    def __init__(self, domain: str, job_id: str = None):
        self.log = logger.bind(
            domain=domain,
            job_id=job_id,
            component="enrichment"
        )

    def start(self, modules: list[str], trigger: str):
        self.log.info(
            "enrichment_started",
            modules=modules,
            trigger=trigger,
        )

    def module_completed(self, module_id: str, duration_ms: int, data_points: int):
        self.log.info(
            "module_completed",
            module_id=module_id,
            duration_ms=duration_ms,
            data_points=data_points,
        )

    def module_failed(self, module_id: str, error: str, will_retry: bool):
        self.log.error(
            "module_failed",
            module_id=module_id,
            error=error,
            will_retry=will_retry,
        )

    def api_call(self, adapter: str, endpoint: str, duration_ms: int, cached: bool):
        self.log.debug(
            "api_call",
            adapter=adapter,
            endpoint=endpoint,
            duration_ms=duration_ms,
            cached=cached,
        )

    def completed(self, status: str, duration_ms: int, changes_detected: int):
        self.log.info(
            "enrichment_completed",
            status=status,
            duration_ms=duration_ms,
            changes_detected=changes_detected,
        )


class AuditLogger:
    """Audit logging for compliance."""

    def __init__(self):
        self.log = logger.bind(component="audit")

    def data_access(
        self,
        user_id: str,
        resource_type: str,
        resource_id: str,
        action: str,
        granted: bool,
    ):
        self.log.info(
            "data_access",
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            granted=granted,
        )

    def data_export(
        self,
        user_id: str,
        domains: list[str],
        export_format: str,
        fields_exported: list[str],
    ):
        self.log.info(
            "data_export",
            user_id=user_id,
            domain_count=len(domains),
            export_format=export_format,
            fields_exported=fields_exported,
        )

    def budget_exceeded(
        self,
        user_id: str,
        budget_type: str,
        current_spend: float,
        limit: float,
    ):
        self.log.warning(
            "budget_exceeded",
            user_id=user_id,
            budget_type=budget_type,
            current_spend=current_spend,
            limit=limit,
        )
```

---

## 4. Distributed Tracing

```python
# observability/tracing.py

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

# Initialize tracer
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# Export to Jaeger
jaeger_exporter = JaegerExporter(
    agent_host_name="localhost",
    agent_port=6831,
)
trace.get_tracer_provider().add_span_processor(
    BatchSpanProcessor(jaeger_exporter)
)

# Auto-instrument libraries
AioHttpClientInstrumentor().instrument()
SQLAlchemyInstrumentor().instrument()


class EnrichmentTracer:
    """Distributed tracing for enrichment pipeline."""

    def __init__(self, domain: str, job_id: str):
        self.domain = domain
        self.job_id = job_id

    def start_enrichment(self) -> trace.Span:
        """Start root span for enrichment."""
        span = tracer.start_span(
            "enrichment",
            attributes={
                "domain": self.domain,
                "job_id": self.job_id,
            }
        )
        return span

    def start_wave(self, wave_number: int, parent: trace.Span) -> trace.Span:
        """Start span for a wave."""
        context = trace.set_span_in_context(parent)
        span = tracer.start_span(
            f"wave_{wave_number}",
            context=context,
            attributes={
                "wave_number": wave_number,
            }
        )
        return span

    def start_module(self, module_id: str, parent: trace.Span) -> trace.Span:
        """Start span for a module."""
        context = trace.set_span_in_context(parent)
        span = tracer.start_span(
            f"module_{module_id}",
            context=context,
            attributes={
                "module_id": module_id,
            }
        )
        return span

    def start_api_call(
        self,
        adapter: str,
        endpoint: str,
        parent: trace.Span
    ) -> trace.Span:
        """Start span for external API call."""
        context = trace.set_span_in_context(parent)
        span = tracer.start_span(
            f"api_{adapter}_{endpoint}",
            context=context,
            attributes={
                "adapter": adapter,
                "endpoint": endpoint,
                "http.method": "GET",
            }
        )
        return span
```

---

## 5. Alerting Rules

```yaml
# alerts/rules.yml

groups:
  - name: partnerforge_alerts
    rules:
      # High error rate
      - alert: HighEnrichmentErrorRate
        expr: |
          rate(partnerforge_enrichment_total{status="failed"}[5m]) /
          rate(partnerforge_enrichment_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High enrichment failure rate"
          description: "More than 10% of enrichments are failing"

      # Module failures
      - alert: ModuleFailureSpike
        expr: |
          rate(partnerforge_module_executions_total{status="failure"}[5m]) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Module {{ $labels.module_id }} failing frequently"

      # API errors
      - alert: APIErrorRateHigh
        expr: |
          rate(partnerforge_api_errors_total[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API error rate for {{ $labels.adapter }}"

      # Circuit breaker open
      - alert: CircuitBreakerOpen
        expr: partnerforge_circuit_breaker_state == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker OPEN for {{ $labels.adapter }}"
          description: "External service {{ $labels.adapter }} is unavailable"

      # Rate limit exhaustion
      - alert: RateLimitExhausted
        expr: partnerforge_rate_limiter_tokens < 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Rate limit tokens exhausted for {{ $labels.adapter }}"

      # Queue buildup
      - alert: QueueBacklog
        expr: partnerforge_queue_depth > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Enrichment queue building up"
          description: "{{ $value }} jobs waiting in queue"

      # Slow enrichments
      - alert: SlowEnrichments
        expr: |
          histogram_quantile(0.95, rate(partnerforge_enrichment_duration_seconds_bucket[5m])) > 120
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Enrichments taking too long"
          description: "95th percentile enrichment time is {{ $value }}s"

      # Data freshness
      - alert: StaleDataDetected
        expr: |
          histogram_quantile(0.5, partnerforge_source_freshness_days_bucket) > 180
        for: 1h
        labels:
          severity: info
        annotations:
          summary: "Data sources getting stale"

      # Budget alerts
      - alert: BudgetThresholdReached
        expr: |
          (partnerforge_api_cost_usd_total / on() group_left
           partnerforge_budget_limit_usd) > 0.8
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "API budget at {{ $value | humanizePercentage }}"
```

---

## 6. Grafana Dashboards

### 6.1 Dashboard Configuration

```json
{
  "title": "PartnerForge Operations",
  "panels": [
    {
      "title": "Enrichment Rate",
      "type": "timeseries",
      "targets": [
        {
          "expr": "rate(partnerforge_enrichment_total[5m])",
          "legendFormat": "{{ status }}"
        }
      ]
    },
    {
      "title": "Active Enrichments",
      "type": "gauge",
      "targets": [
        {
          "expr": "partnerforge_active_enrichments"
        }
      ],
      "thresholds": [
        { "value": 0, "color": "green" },
        { "value": 20, "color": "yellow" },
        { "value": 50, "color": "red" }
      ]
    },
    {
      "title": "Module Success Rate",
      "type": "heatmap",
      "targets": [
        {
          "expr": "sum by (module_id) (rate(partnerforge_module_executions_total{status='success'}[1h])) / sum by (module_id) (rate(partnerforge_module_executions_total[1h]))"
        }
      ]
    },
    {
      "title": "API Latency (p95)",
      "type": "timeseries",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, rate(partnerforge_api_latency_seconds_bucket[5m]))",
          "legendFormat": "{{ adapter }}"
        }
      ]
    },
    {
      "title": "Circuit Breaker Status",
      "type": "state-timeline",
      "targets": [
        {
          "expr": "partnerforge_circuit_breaker_state",
          "legendFormat": "{{ adapter }}"
        }
      ],
      "mappings": [
        { "value": 0, "text": "CLOSED", "color": "green" },
        { "value": 1, "text": "OPEN", "color": "red" },
        { "value": 2, "text": "HALF_OPEN", "color": "yellow" }
      ]
    },
    {
      "title": "API Costs Today",
      "type": "stat",
      "targets": [
        {
          "expr": "increase(partnerforge_api_cost_usd_total[24h])"
        }
      ],
      "unit": "currencyUSD"
    },
    {
      "title": "Queue Depth by Priority",
      "type": "bargauge",
      "targets": [
        {
          "expr": "partnerforge_queue_depth",
          "legendFormat": "{{ priority }}"
        }
      ]
    },
    {
      "title": "Cache Hit Ratio",
      "type": "gauge",
      "targets": [
        {
          "expr": "partnerforge_cache_hit_ratio"
        }
      ],
      "thresholds": [
        { "value": 0, "color": "red" },
        { "value": 0.5, "color": "yellow" },
        { "value": 0.8, "color": "green" }
      ]
    }
  ]
}
```

---

## 7. Health Checks

```python
# observability/health.py

from fastapi import APIRouter
from enum import Enum

router = APIRouter(prefix="/health")

class HealthStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@router.get("/")
async def health_check():
    """Overall health check."""
    checks = await run_all_health_checks()

    overall = HealthStatus.HEALTHY
    if any(c.status == HealthStatus.UNHEALTHY for c in checks):
        overall = HealthStatus.UNHEALTHY
    elif any(c.status == HealthStatus.DEGRADED for c in checks):
        overall = HealthStatus.DEGRADED

    return {
        "status": overall.value,
        "checks": {c.name: c.dict() for c in checks},
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/ready")
async def readiness_check():
    """Kubernetes readiness probe."""
    db_ok = await check_database()
    redis_ok = await check_redis()

    if db_ok and redis_ok:
        return {"status": "ready"}
    else:
        raise HTTPException(503, "Not ready")


@router.get("/live")
async def liveness_check():
    """Kubernetes liveness probe."""
    return {"status": "alive"}


async def run_all_health_checks() -> list[HealthCheck]:
    """Run all health checks."""
    return [
        await check_database_health(),
        await check_redis_health(),
        await check_builtwith_health(),
        await check_similarweb_health(),
        await check_queue_health(),
    ]


async def check_builtwith_health() -> HealthCheck:
    """Check BuiltWith API health."""
    circuit = circuit_registry.get("builtwith")

    if circuit and circuit.is_open:
        return HealthCheck(
            name="builtwith",
            status=HealthStatus.UNHEALTHY,
            message="Circuit breaker OPEN",
            latency_ms=None,
        )

    try:
        start = time.time()
        # Light API call to test connectivity
        await builtwith_adapter.health_ping()
        latency = (time.time() - start) * 1000

        return HealthCheck(
            name="builtwith",
            status=HealthStatus.HEALTHY if latency < 2000 else HealthStatus.DEGRADED,
            message="OK" if latency < 2000 else "Slow response",
            latency_ms=int(latency),
        )

    except Exception as e:
        return HealthCheck(
            name="builtwith",
            status=HealthStatus.UNHEALTHY,
            message=str(e),
            latency_ms=None,
        )
```

---

## 8. Integration Points

### 8.1 FastAPI Middleware

```python
# middleware/observability.py

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import time

class ObservabilityMiddleware(BaseHTTPMiddleware):
    """Add observability to all HTTP requests."""

    async def dispatch(self, request: Request, call_next):
        # Start timing
        start_time = time.time()

        # Create trace span
        with tracer.start_as_current_span(
            f"{request.method} {request.url.path}",
            attributes={
                "http.method": request.method,
                "http.url": str(request.url),
            }
        ) as span:
            try:
                response = await call_next(request)

                # Record metrics
                http_requests_total.labels(
                    method=request.method,
                    endpoint=request.url.path,
                    status=response.status_code
                ).inc()

                http_request_duration.labels(
                    method=request.method,
                    endpoint=request.url.path
                ).observe(time.time() - start_time)

                span.set_attribute("http.status_code", response.status_code)

                return response

            except Exception as e:
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                raise
```

---

*Document created: 2026-02-25*
*Author: Thread 2 - Data Pipeline*
*Status: Architecture Design*
*Priority: P1*
