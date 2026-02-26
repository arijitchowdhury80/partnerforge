# Targets API

The Targets API provides access to displacement target companies — organizations using partner technologies (Adobe AEM, Shopify, etc.) that are not currently Algolia customers.

**Base URL:** `https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1`
**Table:** `displacement_targets`

---

## Architecture Note

With the migration from Railway to Supabase, all target data is accessed directly via Supabase's REST API (PostgREST). The frontend's `api.ts` service handles all queries client-side.

---

## Common Operations

| Operation | Method | URL Pattern |
|-----------|--------|-------------|
| List targets | GET | `/displacement_targets?select=*` |
| Get by domain | GET | `/displacement_targets?domain=eq.{domain}` |
| Filter by score | GET | `/displacement_targets?icp_score=gte.{score}` |
| Get count | GET | `/displacement_targets?select=count` |

**Required Header:**
```http
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg
```

---

## List Targets

Retrieve displacement targets with optional filtering and sorting.

```http
GET /displacement_targets?select=*
```

### Query Parameters (PostgREST Syntax)

| Parameter | Example | Description |
|-----------|---------|-------------|
| `select` | `select=*` or `select=domain,icp_score` | Columns to return |
| `limit` | `limit=50` | Items per page |
| `offset` | `offset=50` | Skip items for pagination |
| `order` | `order=icp_score.desc` | Sort field and direction |
| `icp_score` | `icp_score=gte.80` | Filter by score |
| `icp_tier_name` | `icp_tier_name=eq.hot` | Filter by tier: hot, warm, cool, cold |
| `vertical` | `vertical=ilike.%commerce%` | Filter by vertical (case-insensitive) |
| `partner_tech` | `partner_tech=eq.Adobe AEM` | Filter by technology |
| `country` | `country=eq.United States` | Filter by country |
| `domain` | `domain=ilike.%costco%` | Search in domain |

### PostgREST Operators
- `eq` — Equals
- `neq` — Not equals
- `gt`, `gte` — Greater than (or equal)
- `lt`, `lte` — Less than (or equal)
- `like`, `ilike` — Pattern match (case-sensitive/insensitive)
- `in` — In list: `icp_tier_name=in.(hot,warm)`

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
# Get all hot leads (score >= 80)
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&icp_score=gte.80&order=icp_score.desc" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"

# Get warm leads (60-79) in Commerce vertical
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&icp_score=gte.60&icp_score=lt.80&vertical=ilike.%25commerce%25" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"

# Get public companies with high traffic, sorted by revenue
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&is_public=eq.true&sw_monthly_visits=gte.1000000&order=revenue.desc" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"

# Search for company by domain
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&domain=ilike.%25costco%25" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

---

## Get Target Statistics

With Supabase, aggregate statistics are computed using count queries or handled client-side.

### Total Count

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=count" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg" \
  -H "Prefer: count=exact"
```

### Count by Tier

```bash
# Count hot leads
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=count&icp_score=gte.80" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Prefer: count=exact"

# Count warm leads
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=count&icp_score=gte.60&icp_score=lt.80" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Prefer: count=exact"
```

### Note

Complex aggregations (average scores, pipeline value) are computed in the frontend's `api.ts` service after fetching the data. Supabase's REST API does not support SQL aggregate functions directly - you would need to use Supabase Edge Functions or RPC calls for server-side aggregation.

---

## Get Target Details

Retrieve full details for a single target by domain.

```http
GET /displacement_targets?domain=eq.{domain}
```

### Query Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `domain` | `eq.costco.com` | Exact domain match |
| `select` | `*` | All columns (default) |

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

### Domain Format

Domains are stored normalized (lowercase, no protocol, no www):
- Stored as: `costco.com`
- Query with: `domain=eq.costco.com`

### Example

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.costco.com" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### Empty Result (No Match)

If the domain is not found, Supabase returns an empty array:

```json
[]
```

To get an error instead, add the object header:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.nonexistent.com" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Accept: application/vnd.pgrst.object+json"
```

Returns 406 with:
```json
{
  "code": "PGRST116",
  "message": "The result contains 0 rows"
}
```

---

## Bulk Search Targets

Look up multiple domains at once using the `in` operator.

```http
GET /displacement_targets?domain=in.(domain1,domain2,domain3)
```

### Example

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&domain=in.(costco.com,walmart.com,amazon.com,bestbuy.com)" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### Response

Returns only the domains that exist in the database:

```json
[
  {
    "id": 123,
    "domain": "costco.com",
    "company_name": "Costco Wholesale",
    "partner_tech": "Adobe AEM",
    "vertical": "Commerce",
    "country": "United States",
    "icp_score": 75,
    "icp_tier_name": "warm",
    ...
  }
]
```

**Note:** Unlike the old API, Supabase does not return a `not_found` list. The client must compute which domains were not found by comparing the request list to the response.

---

## Update Target Status

Manually override ICP score and tier (sales team adjustment).

```http
PATCH /displacement_targets?domain=eq.{domain}
```

**Note:** Write operations require the service role key (not the anon key) or appropriate RLS policies.

### Request Body

```json
{
  "icp_score": 85,
  "icp_tier_name": "hot",
  "score_reasons": "Sales team override: High traffic, public company"
}
```

### Example

```bash
curl -X PATCH "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.costco.com" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "icp_score": 85,
    "icp_tier_name": "hot"
  }'
```

### Response (with `Prefer: return=representation`)

```json
[
  {
    "id": 123,
    "domain": "costco.com",
    "icp_score": 85,
    "icp_tier_name": "hot",
    ...
  }
]
```

---

## Delete Target

Remove a target from the database.

```http
DELETE /displacement_targets?domain=eq.{domain}
```

**Note:** Write operations require the service role key or appropriate RLS policies.

### Example

```bash
curl -X DELETE "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.example.com" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Prefer: return=representation"
```

### Response (with `Prefer: return=representation`)

Returns the deleted row(s):

```json
[
  {
    "id": 123,
    "domain": "example.com",
    "company_name": "Example Corp",
    ...
  }
]
```

---

## Trigger Target Enrichment

> **Architecture Change:** Enrichment is now handled client-side by the frontend's `api.ts` service. There is no server-side enrichment endpoint.

The frontend directly calls:
- **BuiltWith API** for technology detection
- **SimilarWeb API** for traffic data
- **Yahoo Finance API** for financial data

After collecting data, the frontend updates Supabase:

```bash
curl -X PATCH "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.costco.com" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sw_monthly_visits": 15000000,
    "sw_bounce_rate": 45.2,
    "revenue": 242300000000,
    "last_enriched": "2026-02-26T10:35:00"
  }'
```

See [Enrichment Documentation](enrichment.md) for details on the client-side enrichment flow.

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
