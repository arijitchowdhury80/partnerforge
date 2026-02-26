# Enrichment API

The Enrichment API manages data enrichment jobs that populate target records with intelligence from external data sources (BuiltWith, SimilarWeb, Yahoo Finance).

**Base Path:** `/api/v1/enrich`

---

## Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/enrich` | List enrichment jobs | Yes |
| POST | `/enrich/{domain}` | Start enrichment job | Yes |
| GET | `/enrich/{domain}/status` | Check job progress | Yes |
| GET | `/enrich/{domain}/results` | Get enrichment data | Yes |
| POST | `/enrich/batch` | Batch enrich multiple | Yes |
| POST | `/enrich/{domain}/cancel` | Cancel running job | Yes |
| POST | `/enrich/{domain}/retry` | Retry failed modules | Yes |
| GET | `/enrich/{domain}/cache` | Check cache freshness | Yes |

---

## Enrichment Modules

Jobs are organized into **4 waves** of **15 modules**:

### Wave 1: Company Context
| Module | Description | Source |
|--------|-------------|--------|
| `m01_company_context` | Basic company info | BuiltWith |
| `m02_tech_stack` | Technology detection | BuiltWith |

### Wave 2: Traffic & Competitors
| Module | Description | Source |
|--------|-------------|--------|
| `m03_traffic` | Monthly visits, engagement | SimilarWeb |
| `m04_traffic_sources` | Traffic breakdown | SimilarWeb |
| `m05_competitors` | Similar sites | SimilarWeb |
| `m06_keywords` | Search keywords | SimilarWeb |

### Wave 3: Financial Data
| Module | Description | Source |
|--------|-------------|--------|
| `m07_financials` | Revenue, margins | Yahoo Finance |
| `m08_stock_info` | Stock price, market cap | Yahoo Finance |
| `m09_analyst_ratings` | Buy/sell recommendations | Yahoo Finance |

### Wave 4: Deep Intelligence
| Module | Description | Source |
|--------|-------------|--------|
| `m10_hiring_signals` | Job postings analysis | WebSearch |
| `m11_exec_quotes` | Executive statements | WebSearch |
| `m12_trigger_events` | Business events | WebSearch |
| `m13_case_study_match` | Relevant case studies | Internal DB |
| `m14_icp_scoring` | Score calculation | Internal |
| `m15_displacement_angle` | Sales angle generation | AI |

---

## Start Enrichment Job

Start an enrichment job for a single domain.

```http
POST /api/v1/enrich/{domain}
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Company domain |

### Request Body (optional)

```json
{
  "modules": ["m01_company_context", "m02_tech_stack"],
  "waves": [1],
  "force": false,
  "priority": "normal"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `modules` | array | all | Specific modules to run |
| `waves` | array | [1,2,3,4] | Specific waves to run |
| `force` | bool | false | Bypass cache |
| `priority` | string | "normal" | "low", "normal", "high" |

### Response

```json
{
  "job_id": "enrich_costco_com_20260226103500_abc12345",
  "domain": "costco.com",
  "status": "queued",
  "modules": ["m01_company_context", "m02_tech_stack"],
  "waves": [1],
  "priority": "normal",
  "force": false,
  "estimated_time_seconds": 6,
  "created_at": "2026-02-26T10:35:00"
}
```

### Example

```bash
# Start full enrichment
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/enrich/costco.com" \
  -H "Authorization: Bearer TOKEN"

# Start only wave 1
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/enrich/costco.com" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"waves": [1]}'

# Force re-enrichment with high priority
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/enrich/costco.com" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": true, "priority": "high"}'
```

---

## Get Job Status

Check the progress of an enrichment job.

```http
GET /api/v1/enrich/{domain}/status
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `job_id` | string | latest | Specific job ID |

### Response

```json
{
  "job_id": "enrich_costco_com_20260226103500_abc12345",
  "domain": "costco.com",
  "status": "running",
  "progress_percent": 45.5,
  "current_wave": 1,
  "current_module": "m02_tech_stack",
  "modules_total": 15,
  "modules_completed": 7,
  "modules_failed": 0,
  "waves": [
    {
      "wave_number": 1,
      "status": "running",
      "modules": [
        {
          "module_id": "m01_company_context",
          "status": "completed",
          "duration_seconds": 3.2,
          "data_points_collected": 10,
          "source_url": "https://builtwith.com"
        },
        {
          "module_id": "m02_tech_stack",
          "status": "running",
          "duration_seconds": null,
          "data_points_collected": null
        }
      ],
      "started_at": "2026-02-26T10:35:01",
      "completed_at": null
    }
  ],
  "created_at": "2026-02-26T10:35:00",
  "started_at": "2026-02-26T10:35:01",
  "completed_at": null,
  "duration_seconds": null
}
```

### Job Statuses

| Status | Description |
|--------|-------------|
| `queued` | Job waiting to start |
| `running` | Job in progress |
| `completed` | Job finished successfully |
| `failed` | Job failed (check errors) |
| `cancelled` | Job cancelled by user |

---

## Get Enrichment Results

Retrieve the data collected by an enrichment job.

```http
GET /api/v1/enrich/{domain}/results
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `job_id` | string | latest completed | Specific job ID |
| `modules` | string | all | Comma-separated module IDs |

### Response

```json
{
  "domain": "costco.com",
  "job_id": "enrich_costco_com_20260226103500_abc12345",
  "status": "completed",
  "completed_at": "2026-02-26T10:36:00",
  "results": {
    "m01_company_context": {
      "company_name": "Costco Wholesale",
      "founded": 1983,
      "hq": "Issaquah, WA",
      "employees": 289000
    },
    "m02_tech_stack": {
      "technologies": [
        {"name": "Adobe AEM", "category": "CMS"},
        {"name": "React", "category": "Frontend"},
        {"name": "Elasticsearch", "category": "Search"}
      ]
    },
    "m03_traffic": {
      "monthly_visits": 15000000,
      "bounce_rate": 45.2,
      "pages_per_visit": 3.2
    }
  },
  "module_statuses": {
    "m01_company_context": {
      "status": "completed",
      "duration_ms": 3200,
      "cached": false,
      "data_points": 10
    }
  },
  "cached_modules": [],
  "failed_modules": [],
  "source_citations": {
    "m03_traffic": [
      {
        "url": "https://similarweb.com",
        "title": "SimilarWeb Traffic Analysis"
      }
    ]
  }
}
```

---

## Batch Enrichment

Start enrichment jobs for multiple domains.

```http
POST /api/v1/enrich/batch
```

### Request Body

```json
{
  "domains": [
    "costco.com",
    "walmart.com",
    "target.com"
  ],
  "modules": null,
  "waves": null,
  "force": false,
  "priority": "normal",
  "concurrency": 5
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `domains` | array | required | List of domains |
| `modules` | array | all | Modules to run |
| `waves` | array | all | Waves to run |
| `force` | bool | false | Bypass cache |
| `priority` | string | "normal" | Job priority |
| `concurrency` | int | 5 | Max parallel jobs |

### Response

```json
{
  "batch_id": "batch_20260226103500_abc12345",
  "status": "queued",
  "total_domains": 3,
  "queued_count": 3,
  "skipped_count": 0,
  "jobs": [
    {
      "job_id": "enrich_costco_com_...",
      "domain": "costco.com",
      "status": "queued"
    },
    {
      "job_id": "enrich_walmart_com_...",
      "domain": "walmart.com",
      "status": "queued"
    },
    {
      "job_id": "enrich_target_com_...",
      "domain": "target.com",
      "status": "queued"
    }
  ],
  "estimated_time_seconds": 27,
  "created_at": "2026-02-26T10:35:00"
}
```

### Example

```bash
# Batch enrich top 10 hot leads
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/enrich/batch" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": [
      "mercedes-benz.com",
      "marks.com",
      "infiniti.com",
      "allianz.com",
      "chevrolet.com.mx"
    ],
    "priority": "high",
    "concurrency": 3
  }'
```

---

## Cancel Job

Cancel a running enrichment job.

```http
POST /api/v1/enrich/{domain}/cancel
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `job_id` | string | latest running | Specific job ID |

### Response

```json
{
  "job_id": "enrich_costco_com_20260226103500_abc12345",
  "status": "cancelled",
  "message": "Job cancelled. 7 modules were already completed.",
  "modules_completed": 7
}
```

---

## Retry Failed Modules

Retry modules that failed in a previous job.

```http
POST /api/v1/enrich/{domain}/retry
```

### Request Body (optional)

```json
{
  "failed_modules_only": true
}
```

### Response

```json
{
  "job_id": "enrich_costco_com_20260226103501_xyz98765",
  "domain": "costco.com",
  "status": "queued",
  "modules": ["m03_traffic", "m05_competitors"],
  "force": true,
  "estimated_time_seconds": 6,
  "created_at": "2026-02-26T10:35:30"
}
```

---

## Check Cache Status

Check which modules have cached data and their freshness.

```http
GET /api/v1/enrich/{domain}/cache
```

### Response

```json
{
  "domain": "costco.com",
  "modules": [
    {
      "module_id": "m01_company_context",
      "is_cached": true,
      "cached_at": "2026-02-26T10:30:00",
      "freshness": "fresh",
      "ttl_remaining_seconds": 2592000
    },
    {
      "module_id": "m02_tech_stack",
      "is_cached": true,
      "cached_at": "2026-02-26T10:30:00",
      "freshness": "stale",
      "ttl_remaining_seconds": 172800
    }
  ],
  "overall_freshness": "stale",
  "last_enrichment": "2026-02-26T10:30:00",
  "stale_modules": ["m02_tech_stack", "m03_traffic"]
}
```

### Freshness States

| State | Description | TTL |
|-------|-------------|-----|
| `fresh` | Data recently updated | >7 days |
| `stale` | Data older than TTL | <7 days |
| `expired` | Data very old | 0 |
| `missing` | No cached data | N/A |

---

## List Enrichment Jobs

List all enrichment jobs with optional filtering.

```http
GET /api/v1/enrich
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domain` | string | - | Filter by domain |
| `status` | string | - | Filter by status |
| `limit` | int | 50 | Max results (max: 100) |
| `offset` | int | 0 | Pagination offset |

### Response

```json
{
  "jobs": [
    {
      "job_id": "enrich_costco_com_20260226103500_abc12345",
      "domain": "costco.com",
      "status": "completed",
      "progress_percent": 100.0,
      "modules_total": 15,
      "modules_completed": 15,
      "priority": "normal",
      "created_at": "2026-02-26T10:35:00",
      "started_at": "2026-02-26T10:35:01"
    }
  ],
  "total": 1,
  "running_count": 0,
  "queued_count": 0
}
```

---

## Cache TTL by Module Type

| Module Type | TTL | Reason |
|-------------|-----|--------|
| Company context | 30 days | Rarely changes |
| Tech stack | 7 days | May change with deploys |
| Traffic | 7 days | Weekly refresh |
| Financials | 1 day | Market data |
| Hiring signals | 3 days | Job postings change |
| Exec quotes | 30 days | Earnings quarterly |

---

## Data Source Fallbacks

| Primary | Fallback | Notes |
|---------|----------|-------|
| BuiltWith Paid | BuiltWith Free | Limited data |
| SimilarWeb | N/A | Required for traffic |
| Yahoo Finance | WebSearch | Public filings |

---

## Estimated Times

| Scope | Est. Time |
|-------|-----------|
| Single module | 2-5 sec |
| Wave 1 (2 modules) | 5-10 sec |
| Wave 2 (4 modules) | 10-20 sec |
| Full enrichment (15 modules) | 45-90 sec |
| Batch (10 domains) | 3-5 min |
