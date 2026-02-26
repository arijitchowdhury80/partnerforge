# Enrichment API

> **Architecture Change (February 2026):** With the migration from Railway to Supabase, enrichment is now handled **client-side** by the frontend's `api.ts` service. There is no separate backend enrichment server.

The frontend directly calls external APIs and updates Supabase with the results.

---

## How Enrichment Works Now

1. **Frontend triggers enrichment** via the "Refresh Data" button
2. **Frontend calls external APIs** directly:
   - BuiltWith API for technology detection
   - SimilarWeb API for traffic data
   - Yahoo Finance API for financial data
3. **Frontend updates Supabase** with collected data via PATCH request

---

## No Server-Side Endpoints

The following endpoints from the old Railway API are **no longer available**:

| Old Endpoint | Status |
|--------------|--------|
| `POST /enrich/{domain}` | Removed |
| `GET /enrich/{domain}/status` | Removed |
| `GET /enrich/{domain}/results` | Removed |
| `POST /enrich/batch` | Removed |
| `POST /enrich/{domain}/cancel` | Removed |
| `POST /enrich/{domain}/retry` | Removed |
| `GET /enrich/{domain}/cache` | Removed |

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

## Client-Side Enrichment Flow

The frontend's `api.ts` service handles enrichment. Here's how to replicate it:

### Step 1: Call BuiltWith API

```javascript
const response = await fetch(
  `https://api.builtwith.com/v21/api.json?KEY=${BUILTWITH_KEY}&LOOKUP=${domain}`
);
const techData = await response.json();
```

### Step 2: Call SimilarWeb API

```javascript
const response = await fetch(
  `https://api.similarweb.com/v1/website/${domain}/total-traffic-and-engagement/visits?api_key=${SIMILARWEB_KEY}`
);
const trafficData = await response.json();
```

### Step 3: Update Supabase

```bash
curl -X PATCH "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.costco.com" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "sw_monthly_visits": 15000000,
    "sw_bounce_rate": 45.2,
    "tech_spend": 50000000,
    "last_enriched": "2026-02-26T10:35:00"
  }'
```

---

## Check Enrichment Status

Since enrichment is client-side, there's no job queue. Check the `last_enriched` timestamp:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.costco.com&select=domain,last_enriched,enrichment_level" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### Response

```json
[
  {
    "domain": "costco.com",
    "last_enriched": "2026-02-26T10:35:00",
    "enrichment_level": "full"
  }
]
```

### Enrichment Levels

| Level | Description |
|-------|-------------|
| `basic` | Only BuiltWith data |
| `standard` | BuiltWith + SimilarWeb |
| `full` | All sources including Yahoo Finance |
| `null` | Not enriched |

---

## Get Enrichment Results

Enrichment data is stored directly in the `displacement_targets` table. Query it:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.costco.com&select=*" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### Response (All Enriched Fields)

```json
[
  {
    "domain": "costco.com",
    "company_name": "Costco Wholesale",

    "sw_monthly_visits": 15000000,
    "sw_bounce_rate": 45.2,
    "sw_pages_per_visit": 3.2,
    "sw_avg_duration": 180,
    "sw_search_traffic_pct": 25.5,
    "sw_rank_global": 245,

    "tech_spend": 50000000,
    "partner_tech": "Adobe AEM",

    "ticker": "COST",
    "is_public": true,
    "revenue": 242300000000,
    "gross_margin": 11.2,

    "last_enriched": "2026-02-26T10:35:00",
    "enrichment_level": "full"
  }
]
```

### Select Specific Fields

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.costco.com&select=domain,sw_monthly_visits,revenue,last_enriched" \
  -H "apikey: YOUR_ANON_KEY"
```

---

## Batch Enrichment

Batch enrichment is handled client-side by iterating through domains. There's no server-side batch endpoint.

### Client-Side Batch Pattern

```javascript
// In api.ts
async function batchEnrich(domains: string[]) {
  const results = [];

  for (const domain of domains) {
    try {
      // 1. Fetch from external APIs
      const [builtwith, similarweb] = await Promise.all([
        fetchBuiltWith(domain),
        fetchSimilarWeb(domain)
      ]);

      // 2. Update Supabase
      const { data, error } = await supabase
        .from('displacement_targets')
        .update({
          sw_monthly_visits: similarweb.visits,
          tech_spend: builtwith.spend,
          last_enriched: new Date().toISOString()
        })
        .eq('domain', domain);

      results.push({ domain, success: true });
    } catch (err) {
      results.push({ domain, success: false, error: err.message });
    }
  }

  return results;
}
```

### Find Targets Needing Enrichment

Query for stale or unenriched targets:

```bash
# Targets never enriched
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain&last_enriched=is.null&limit=10" \
  -H "apikey: YOUR_ANON_KEY"

# Targets enriched more than 7 days ago
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain,last_enriched&last_enriched=lt.2026-02-19&limit=10" \
  -H "apikey: YOUR_ANON_KEY"
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
