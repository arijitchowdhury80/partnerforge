# Targets API

The Targets API provides access to displacement target companies — organizations using partner technologies (Adobe AEM, Shopify, etc.) that are not currently Algolia customers.

**Base Path:** `/api/v1/targets`

---

## Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/targets` | List targets | No |
| GET | `/targets/stats` | Get statistics | No |
| GET | `/targets/{domain}` | Get target details | No |
| POST | `/targets/search` | Bulk domain lookup | No |
| PUT | `/targets/{domain}/status` | Update ICP score | Yes |
| DELETE | `/targets/{domain}` | Delete target | Yes |
| POST | `/targets/{domain}/enrich` | Trigger enrichment | Yes |

---

## List Targets

Retrieve a paginated list of displacement targets with optional filtering and sorting.

```http
GET /api/v1/targets
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (min: 1) |
| `page_size` | int | 50 | Items per page (max: 100) |
| `status` | string | - | Filter by ICP tier: `hot`, `warm`, `cool`, `cold`, `unscored` |
| `vertical` | string | - | Filter by vertical (case-insensitive) |
| `partner_tech` | string | - | Filter by technology (e.g., "Adobe AEM") |
| `country` | string | - | Filter by country (case-insensitive) |
| `min_score` | int | - | Minimum ICP score (0-100) |
| `max_score` | int | - | Maximum ICP score (0-100) |
| `min_traffic` | int | - | Minimum monthly visits |
| `is_public` | bool | - | Filter public companies only |
| `enrichment_level` | string | - | Filter: `basic`, `standard`, `full` |
| `search` | string | - | Search in domain/company_name |
| `sort_by` | string | `icp_score` | Sort field |
| `sort_order` | string | `desc` | Sort direction: `asc`, `desc` |

### Sortable Fields
- `icp_score` (default)
- `company_name`
- `domain`
- `sw_monthly_visits`
- `revenue`
- `created_at`
- `last_enriched`

### Response

```json
{
  "targets": [
    {
      "id": 1,
      "domain": "mercedes-benz.com",
      "company_name": "Mercedes-Benz",
      "partner_tech": "Adobe AEM",
      "vertical": "Automotive",
      "country": "Germany",
      "icp_score": 95,
      "icp_tier_name": "hot",
      "sw_monthly_visits": 15000000,
      "revenue": 156000000000,
      "current_search": "site search gap analysis",
      "enrichment_level": "full",
      "last_enriched": "2026-02-26T10:30:00",
      "created_at": "2026-02-20T08:00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 2687,
    "total_pages": 54,
    "has_next": true,
    "has_prev": false
  },
  "filters": {
    "status": null,
    "vertical": null,
    "partner_tech": null,
    "country": null,
    "min_score": null,
    "max_score": null,
    "min_traffic": null,
    "is_public": null,
    "enrichment_level": null,
    "search": null
  }
}
```

### Examples

```bash
# Get all hot leads
curl "https://partnerforge-production.up.railway.app/api/v1/targets?status=hot"

# Get warm leads in Commerce vertical
curl "https://partnerforge-production.up.railway.app/api/v1/targets?status=warm&vertical=Commerce"

# Get public companies with high traffic, sorted by revenue
curl "https://partnerforge-production.up.railway.app/api/v1/targets?is_public=true&min_traffic=1000000&sort_by=revenue&sort_order=desc"

# Search for specific company
curl "https://partnerforge-production.up.railway.app/api/v1/targets?search=costco"
```

---

## Get Target Statistics

Retrieve aggregate statistics across all targets.

```http
GET /api/v1/targets/stats
```

### Response

```json
{
  "total": 2687,
  "by_status": {
    "hot": 9,
    "warm": 49,
    "cool": 150,
    "cold": 200,
    "unscored": 2279
  },
  "by_vertical": [
    {
      "vertical": "Commerce",
      "count": 850,
      "avg_icp_score": 52.3
    },
    {
      "vertical": "Media & Publishing",
      "count": 620,
      "avg_icp_score": 48.1
    }
  ],
  "by_partner_tech": [
    {
      "partner_tech": "Adobe AEM",
      "count": 2687,
      "avg_icp_score": 51.2
    }
  ],
  "avg_icp_score": 51.2,
  "avg_monthly_visits": 1234567,
  "total_pipeline_value": 12345678901.5,
  "enriched_count": 408,
  "public_count": 156,
  "calculated_at": "2026-02-26T10:35:00"
}
```

### Example

```bash
curl "https://partnerforge-production.up.railway.app/api/v1/targets/stats"
```

---

## Get Target Details

Retrieve full details for a single target by domain.

```http
GET /api/v1/targets/{domain}
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Company domain (auto-normalized) |

### Response

```json
{
  "id": 123,
  "domain": "costco.com",
  "company_name": "Costco Wholesale",
  "partner_tech": "Adobe AEM",
  "vertical": "Commerce",
  "country": "United States",
  "city": "Issaquah",
  "state": "WA",
  "tech_spend": 50000000,
  "emails": ["contact@costco.com"],
  "phones": ["+1-425-313-8100"],
  "socials": ["twitter.com/costco"],
  "exec_titles": ["VP of eCommerce", "Chief Technology Officer"],

  "sw_monthly_visits": 15000000,
  "sw_bounce_rate": 45.2,
  "sw_pages_per_visit": 3.2,
  "sw_avg_duration": 180,
  "sw_search_traffic_pct": 25.5,
  "sw_rank_global": 245,

  "icp_tier": 1,
  "icp_score": 75,
  "icp_tier_name": "warm",
  "score_reasons": "High traffic, public company",
  "score_breakdown": {
    "vertical": 25,
    "traffic": 30,
    "tech_spend": 20
  },

  "ticker": "COST",
  "is_public": true,
  "revenue": 242300000000,
  "gross_margin": 11.2,
  "traffic_growth": 8.5,

  "current_search": "internal search analysis",
  "matched_case_studies": ["Case Study 1", "Case Study 2"],
  "lead_score": 75,
  "trigger_events": ["New site redesign", "Tech team expansion"],

  "exec_quote": "We're investing heavily in search and personalization",
  "exec_name": "Ron Vachris",
  "exec_title": "VP, eCommerce",
  "quote_source": "Q4 2025 Earnings Call",

  "competitors_using_algolia": ["Amazon", "Walmart"],
  "displacement_angle": "Reduce search friction, improve relevance",

  "enrichment_level": "full",
  "last_enriched": "2026-02-26T10:30:00",
  "created_at": "2026-02-20T08:00:00"
}
```

### Domain Normalization

All these inputs resolve to the same target:
- `costco.com`
- `www.costco.com`
- `COSTCO.COM`
- `https://costco.com/`

### Example

```bash
curl "https://partnerforge-production.up.railway.app/api/v1/targets/costco.com"
```

### Error Response (404)

```json
{
  "success": false,
  "error": "Target not found: amazon.com",
  "status_code": 404
}
```

---

## Bulk Search Targets

Look up multiple domains at once.

```http
POST /api/v1/targets/search
```

### Request Body

```json
{
  "domains": [
    "costco.com",
    "walmart.com",
    "amazon.com",
    "bestbuy.com"
  ]
}
```

### Response

```json
{
  "found": [
    {
      "id": 123,
      "domain": "costco.com",
      "company_name": "Costco Wholesale",
      "partner_tech": "Adobe AEM",
      "vertical": "Commerce",
      "country": "United States",
      "icp_score": 75,
      "icp_tier_name": "warm",
      "sw_monthly_visits": 15000000,
      "revenue": 242300000000,
      "current_search": "internal search analysis",
      "enrichment_level": "full",
      "last_enriched": "2026-02-26T10:30:00",
      "created_at": "2026-02-20T08:00:00"
    }
  ],
  "not_found": ["amazon.com", "bestbuy.com", "walmart.com"],
  "total_searched": 4,
  "total_found": 1
}
```

### Example

```bash
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/targets/search" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": ["costco.com", "walmart.com", "amazon.com"]
  }'
```

---

## Update Target Status

Manually override ICP score and tier (sales team adjustment).

```http
PUT /api/v1/targets/{domain}/status
```

**Authentication Required**

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Company domain |

### Request Body

```json
{
  "icp_score": 85,
  "icp_tier_name": "hot",
  "score_reasons": {
    "reason_1": "High traffic",
    "reason_2": "Public company",
    "reason_3": "Tech investment signals"
  }
}
```

### Response

```json
{
  "id": 123,
  "domain": "costco.com",
  "icp_score": 85,
  "icp_tier_name": "hot",
  "status": "hot",
  "updated_at": "2026-02-26T10:35:00",
  "message": "Target updated: icp_score=85, tier=hot, reasons updated"
}
```

### Example

```bash
curl -X PUT "https://partnerforge-production.up.railway.app/api/v1/targets/costco.com/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "icp_score": 85,
    "icp_tier_name": "hot",
    "score_reasons": {"reason": "Sales team override"}
  }'
```

---

## Delete Target

Remove a target from the database.

```http
DELETE /api/v1/targets/{domain}
```

**Authentication Required**

### Response

```json
{
  "id": 123,
  "domain": "costco.com",
  "company_name": "Costco Wholesale",
  "deleted": true,
  "message": "Target 'costco.com' deleted successfully"
}
```

---

## Trigger Target Enrichment

Start an enrichment job for a specific target.

```http
POST /api/v1/targets/{domain}/enrich
```

**Authentication Required**

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `modules` | string | all | Comma-separated module IDs |
| `waves` | string | all | Comma-separated wave numbers (1-4) |
| `force` | bool | false | Force re-enrichment even if cached |

### Response

```json
{
  "job_id": "enrich_costco_com_20260226103500_abc12345",
  "domain": "costco.com",
  "target_id": 123,
  "status": "queued",
  "modules": [
    "m01_company_context",
    "m02_tech_stack",
    "m03_traffic",
    "m04_financials"
  ],
  "waves": [1, 2, 3, 4],
  "force": false,
  "estimated_time_seconds": 45,
  "triggered_by": "user@example.com",
  "created_at": "2026-02-26T10:35:00"
}
```

### Example

```bash
# Enrich all modules
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/targets/costco.com/enrich" \
  -H "Authorization: Bearer TOKEN"

# Enrich only wave 1
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/targets/costco.com/enrich?waves=1" \
  -H "Authorization: Bearer TOKEN"

# Force re-enrichment
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/targets/costco.com/enrich?force=true" \
  -H "Authorization: Bearer TOKEN"
```

---

## ICP Scoring Reference

| Tier | Score Range | Label | Color |
|------|-------------|-------|-------|
| 1 | 80-100 | Hot | `#ef4444` (Red) |
| 2 | 60-79 | Warm | `#f97316` (Orange) |
| 3 | 40-59 | Cool | `#5468FF` (Purple) |
| 4 | 0-39 | Cold | `#6b7280` (Gray) |

### Score Calculation

| Component | Weight | Logic |
|-----------|--------|-------|
| Vertical | 40% | Commerce=40, Content=25, Support=15 |
| Traffic | 30% | 50M+=30, 10M+=25, 1M+=15 |
| Tech Spend | 20% | $100K+=20, $50K+=15 |
| Partner Tech | 10% | Adobe=10, Shopify=7 |

---

## Hot Leads (Current)

| Company | Domain | Score | Vertical |
|---------|--------|-------|----------|
| Mercedes-Benz | mercedes-benz.com | 95 | Automotive |
| Mark's | marks.com | 85 | Retail |
| Infiniti | infiniti.com | 85 | Automotive |
| Allianz | allianz.com | 85 | Financial |
| Chevrolet Mexico | chevrolet.com.mx | 85 | Automotive |
| HOFER | hofer.at | 85 | Retail |
| Fiat | fiat.com | 85 | Automotive |
| Bever | bever.com | 85 | Retail |
| Sunstar | sunstar.com | 80 | Consumer Goods |
