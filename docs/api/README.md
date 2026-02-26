# PartnerForge API Reference

**Version:** v1
**Base URL:** `https://partnerforge-production.up.railway.app/api/v1`
**Protocol:** HTTPS (required in production)

---

## Overview

The PartnerForge API provides programmatic access to displacement target data, enrichment jobs, and analytics. It follows REST conventions and returns JSON responses.

---

## Base URLs

| Environment | URL |
|-------------|-----|
| **Production** | `https://partnerforge-production.up.railway.app/api/v1` |
| **Development** | `http://localhost:8000/api/v1` |

---

## Authentication

Currently, the API supports two modes:

### Public Endpoints (No Auth Required)
- `GET /targets` — List targets
- `GET /targets/{domain}` — Get target details
- `GET /targets/stats` — Get statistics
- `POST /targets/search` — Bulk search
- `GET /health` — Health check

### Protected Endpoints (Auth Required)
- `PUT /targets/{domain}/status` — Update ICP score
- `DELETE /targets/{domain}` — Delete target
- `POST /enrich/*` — All enrichment endpoints

### Authentication Header
```http
Authorization: Bearer <token>
```

---

## Rate Limits

| Tier | Requests/min | Burst |
|------|-------------|-------|
| Default | 60 | 100 |
| Enrichment | 10 | 20 |

Rate limit headers:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1709000000
```

---

## Response Format

All responses follow this structure:

### Success Response
```json
{
  "data": { ... },
  "pagination": { ... },
  "meta": {
    "timestamp": "2026-02-26T10:35:00Z",
    "request_id": "req_abc123"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error title",
  "detail": "Detailed error message",
  "status_code": 404
}
```

---

## Pagination

List endpoints support pagination:

| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `page` | int | 1 | - |
| `page_size` | int | 50 | 100 |

Response includes:
```json
{
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 2687,
    "total_pages": 54,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## Sorting

Use `sort_by` and `sort_order` parameters:

```
GET /targets?sort_by=icp_score&sort_order=desc
```

**Sortable Fields:**
- `icp_score` (default)
- `company_name`
- `domain`
- `sw_monthly_visits`
- `revenue`
- `created_at`
- `last_enriched`

**Sort Orders:**
- `asc` — Ascending
- `desc` — Descending (default)

---

## Filtering

Most list endpoints support filtering:

```
GET /targets?status=hot&vertical=Commerce&min_traffic=1000000
```

See individual endpoint docs for available filters.

---

## Domain Normalization

All domain inputs are automatically normalized:

| Input | Normalized To |
|-------|---------------|
| `www.costco.com` | `costco.com` |
| `COSTCO.COM` | `costco.com` |
| `https://costco.com/` | `costco.com` |
| `http://www.costco.com` | `costco.com` |

---

## Endpoint Summary

### Targets (`/api/v1/targets`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/targets` | List targets with filters |
| GET | `/targets/stats` | Get aggregate statistics |
| GET | `/targets/{domain}` | Get single target details |
| POST | `/targets/search` | Bulk domain lookup |
| PUT | `/targets/{domain}/status` | Update ICP score |
| DELETE | `/targets/{domain}` | Delete target |
| POST | `/targets/{domain}/enrich` | Trigger enrichment |

[→ Full Targets Documentation](endpoints/targets.md)

### Enrichment (`/api/v1/enrich`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/enrich` | List enrichment jobs |
| POST | `/enrich/{domain}` | Start enrichment job |
| GET | `/enrich/{domain}/status` | Check job progress |
| GET | `/enrich/{domain}/results` | Get enrichment data |
| POST | `/enrich/batch` | Batch enrich multiple |
| POST | `/enrich/{domain}/cancel` | Cancel running job |
| POST | `/enrich/{domain}/retry` | Retry failed modules |
| GET | `/enrich/{domain}/cache` | Check cache freshness |

[→ Full Enrichment Documentation](endpoints/enrichment.md)

### Health (`/health`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Basic health check |
| GET | `/ready` | Readiness probe |
| GET | `/health/live` | Liveness probe |
| GET | `/health/detailed` | Full diagnostics |
| GET | `/version` | Version info |
| GET | `/metrics` | Runtime metrics |

[→ Full Health Documentation](endpoints/health.md)

---

## CORS

The API allows requests from:
- `http://localhost:3000`
- `http://localhost:8000`
- `https://partnerforge.vercel.app`

---

## Versioning

The API uses URL-based versioning:
```
/api/v1/targets
```

Current version: `v1`

---

## SDKs & Tools

### curl
```bash
curl "https://partnerforge-production.up.railway.app/api/v1/targets?status=hot"
```

### Python
```python
import requests

response = requests.get(
    "https://partnerforge-production.up.railway.app/api/v1/targets",
    params={"status": "hot", "page_size": 10}
)
targets = response.json()["targets"]
```

### JavaScript
```javascript
const response = await fetch(
  "https://partnerforge-production.up.railway.app/api/v1/targets?status=hot"
);
const { targets } = await response.json();
```

---

## Related Documentation

- [Data Schemas](schemas.md)
- [Error Handling](errors.md)
- [Quickstart Guide](../guides/quickstart.md)
