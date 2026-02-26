# Health API

The Health API provides endpoints for monitoring service health, readiness, and runtime metrics. These endpoints are used by orchestration platforms (Kubernetes, Railway) and monitoring systems.

**Base Path:** `/` (root level)

---

## Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/health` | Basic health check | No |
| GET | `/ready` | Readiness probe | No |
| GET | `/health/ready` | Readiness probe (alias) | No |
| GET | `/health/live` | Liveness probe | No |
| GET | `/health/detailed` | Full diagnostics | No |
| GET | `/version` | Version information | No |
| GET | `/metrics` | Runtime metrics | No |

---

## Basic Health Check

Quick check if the service is running.

```http
GET /health
```

### Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2026-02-26T10:35:00",
  "service": "PartnerForge API",
  "version": "2.2.0"
}
```

### Response (503 Service Unavailable)

```json
{
  "status": "unhealthy",
  "timestamp": "2026-02-26T10:35:00",
  "service": "PartnerForge API",
  "version": "2.2.0",
  "error": "Database connection failed"
}
```

### Example

```bash
curl "https://partnerforge-production.up.railway.app/health"
```

---

## Readiness Probe

Check if the service is ready to accept traffic. Verifies database connectivity.

```http
GET /ready
GET /health/ready
```

### Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2026-02-26T10:35:00",
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 2.34,
      "driver": "postgresql"
    },
    "redis": {
      "status": "healthy",
      "latency_ms": 1.12,
      "redis_version": "7.0.0",
      "optional": false
    }
  },
  "service": "PartnerForge API",
  "version": "2.2.0"
}
```

### Response (503 Not Ready)

```json
{
  "status": "unhealthy",
  "timestamp": "2026-02-26T10:35:00",
  "checks": {
    "database": {
      "status": "unhealthy",
      "error": "Connection refused",
      "latency_ms": null
    }
  },
  "service": "PartnerForge API",
  "version": "2.2.0"
}
```

### Use Case

Kubernetes/Railway uses this endpoint to determine when to route traffic:
- **200**: Service ready for traffic
- **503**: Service not ready, don't route traffic

### Example

```bash
curl "https://partnerforge-production.up.railway.app/ready"
```

---

## Liveness Probe

Check if the service process is alive. Returns 200 if the process is running.

```http
GET /health/live
```

### Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2026-02-26T10:35:00"
}
```

### Use Case

Kubernetes uses this to detect crashed processes:
- **200**: Process is alive
- **Non-200**: Process may need restart

### Example

```bash
curl "https://partnerforge-production.up.railway.app/health/live"
```

---

## Detailed Health Check

Comprehensive health report with all subsystems.

```http
GET /health/detailed
```

### Response

```json
{
  "status": "healthy",
  "timestamp": "2026-02-26T10:35:00",
  "service": "PartnerForge API",
  "version": "2.2.0",
  "environment": "production",
  "python_version": "3.11.0",
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 2.34,
      "driver": "postgresql",
      "pool_size": 20,
      "pool_checked_out": 3,
      "pool_overflow": 0,
      "max_overflow": 10
    },
    "redis": {
      "status": "healthy",
      "latency_ms": 1.12,
      "redis_version": "7.0.0",
      "connected_clients": 5,
      "used_memory_human": "2.5M"
    },
    "configuration": {
      "status": "healthy",
      "message": "All required configuration present",
      "api_keys_configured": {
        "builtwith": true,
        "similarweb": true,
        "yahoo_finance": true
      }
    },
    "resources": {
      "status": "healthy",
      "memory_mb": 234.5,
      "memory_percent": 12.3,
      "cpu_percent": 5.2,
      "threads": 12,
      "open_files": 45
    }
  }
}
```

### Subsystem Checks

| Check | What It Verifies |
|-------|------------------|
| `database` | PostgreSQL/SQLite connectivity, pool status |
| `redis` | Redis connectivity (if configured) |
| `configuration` | Required env vars, API keys |
| `resources` | Memory, CPU, file handles |

### Example

```bash
curl "https://partnerforge-production.up.railway.app/health/detailed" | jq
```

---

## Version Information

Get service version and build information.

```http
GET /version
```

### Response

```json
{
  "service": "PartnerForge API",
  "version": "2.2.0",
  "api_version": "v1",
  "supported_api_versions": ["v1"],
  "build_date": "2026-02-26",
  "git_commit": "b8a36f3",
  "git_branch": "main"
}
```

### Example

```bash
curl "https://partnerforge-production.up.railway.app/version"
```

---

## Runtime Metrics

Get runtime performance metrics.

```http
GET /metrics
```

### Response

```json
{
  "uptime_seconds": 3600,
  "requests_total": 12345,
  "requests_per_minute": 42.5,
  "memory_bytes": 245856256,
  "memory_percent": 12.3,
  "cpu_percent": 5.2,
  "threads": 12,
  "open_files": 45,
  "active_connections": 8,
  "enrichment_jobs": {
    "queued": 2,
    "running": 1,
    "completed_today": 45,
    "failed_today": 2
  }
}
```

### Example

```bash
curl "https://partnerforge-production.up.railway.app/metrics"
```

---

## Health Check Configuration

### Railway (railway.toml)

```toml
[[services.health_checks]]
path = "/health"
interval = 30
timeout = 5
```

### Kubernetes

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Docker Compose

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

---

## Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Healthy | All good |
| 503 | Unhealthy | Check logs, may need restart |

---

## Monitoring Integration

### Uptime Monitoring (e.g., UptimeRobot)

Monitor: `https://partnerforge-production.up.railway.app/health`
- Interval: 60 seconds
- Timeout: 10 seconds
- Alert on: Non-200 response

### Prometheus Scraping

```yaml
scrape_configs:
  - job_name: 'partnerforge'
    static_configs:
      - targets: ['partnerforge-production.up.railway.app']
    metrics_path: '/metrics'
    scheme: 'https'
```

### Grafana Dashboard

Key metrics to display:
- `requests_per_minute`
- `memory_percent`
- `cpu_percent`
- `enrichment_jobs.running`
- `enrichment_jobs.queued`
