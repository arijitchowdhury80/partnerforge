# PartnerForge API Reference

**Version:** v1
**Base URL:** `https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1`
**Protocol:** HTTPS (required)

---

## Architecture Change (February 2026)

**IMPORTANT:** The PartnerForge architecture has been simplified:

- **Railway backend has been removed** from the architecture
- The **frontend now communicates directly with Supabase REST API**
- All database queries are handled client-side via the `api.ts` service
- No separate backend server is required

This change reduces complexity, eliminates an extra hop, and leverages Supabase's built-in REST API with Row Level Security (RLS).

---

## Overview

The PartnerForge API provides programmatic access to displacement target data via Supabase's auto-generated REST API (PostgREST). All queries go directly to the `displacement_targets` table in Supabase.

---

## Base URLs

| Environment | URL |
|-------------|-----|
| **Production** | `https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1` |
| **Development** | Same (Supabase handles both) |

---

## Authentication

Supabase REST API requires the `apikey` header for all requests:

### Required Headers

```http
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg
```

### Public Access (Anon Key)

The anon key provides read access to public data. This is safe to use in frontend code.

### Protected Operations

For write operations (INSERT, UPDATE, DELETE), you would need:
- A service role key (server-side only)
- Or Row Level Security (RLS) policies with user authentication

---

## Rate Limits

Supabase has generous rate limits on the free tier:

| Tier | Requests/day | Concurrent |
|------|-------------|------------|
| Free | 500,000 | 200 |
| Pro | Unlimited | 500 |

Rate limiting is handled automatically by Supabase.

---

## Response Format

Supabase REST API returns data directly as JSON arrays or objects:

### Success Response (List)
```json
[
  { "id": 1, "domain": "mercedes-benz.com", "icp_score": 95, ... },
  { "id": 2, "domain": "marks.com", "icp_score": 85, ... }
]
```

### Success Response (Single)
```json
{ "id": 1, "domain": "mercedes-benz.com", "icp_score": 95, ... }
```

### Error Response
```json
{
  "code": "PGRST116",
  "details": null,
  "hint": null,
  "message": "The result contains 0 rows"
}
```

---

## Pagination

Supabase uses `limit` and `offset` for pagination via the `Range` header:

### Using Range Header
```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Range: 0-49"
```

### Using Query Parameters
```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&limit=50&offset=0" \
  -H "apikey: YOUR_ANON_KEY"
```

### Getting Total Count
Add `Prefer: count=exact` header:
```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Prefer: count=exact"
```
Response includes `Content-Range: 0-49/2687` header.

---

## Sorting

Supabase uses `order` parameter:

```bash
# Sort by ICP score descending
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&order=icp_score.desc" \
  -H "apikey: YOUR_ANON_KEY"

# Sort by multiple columns
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&order=icp_score.desc,company_name.asc" \
  -H "apikey: YOUR_ANON_KEY"
```

**Sortable Fields:**
- `icp_score`
- `company_name`
- `domain`
- `sw_monthly_visits`
- `revenue`
- `created_at`
- `last_enriched`

**Sort Orders:**
- `.asc` — Ascending
- `.desc` — Descending
- `.nullsfirst` / `.nullslast` — Null handling

---

## Filtering

Supabase uses PostgREST operators for filtering:

```bash
# Filter by composite score >= 70 (hot leads)
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&icp_score=gte.70" \
  -H "apikey: YOUR_ANON_KEY"

# Filter by vertical
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&vertical=eq.Commerce" \
  -H "apikey: YOUR_ANON_KEY"

# Filter by minimum traffic
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&sw_monthly_visits=gte.1000000" \
  -H "apikey: YOUR_ANON_KEY"
```

**Common Operators:**
- `eq` — Equals
- `neq` — Not equals
- `gt`, `gte` — Greater than (or equal)
- `lt`, `lte` — Less than (or equal)
- `like`, `ilike` — Pattern matching (case-sensitive/insensitive)
- `in` — In list: `icp_tier_name=in.(hot,warm)`
- `is` — Is null: `revenue=is.null`

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

### Targets (`/displacement_targets`)

With Supabase, you query the table directly:

| Operation | Method | Example |
|-----------|--------|---------|
| List targets | GET | `/displacement_targets?select=*` |
| Get by domain | GET | `/displacement_targets?domain=eq.costco.com` |
| Filter hot leads | GET | `/displacement_targets?icp_score=gte.70` |
| Count targets | GET | `/displacement_targets?select=count` |

[→ Full Targets Documentation](endpoints/targets.md)

### Enrichment

> **Note:** Enrichment operations are now handled client-side via the frontend's `api.ts` service, which calls external APIs (BuiltWith, SimilarWeb) directly and updates Supabase.

[→ Enrichment Documentation](endpoints/enrichment.md)

### Health

> **Note:** With no separate backend server, traditional health endpoints are not applicable. Supabase provides its own status page at [status.supabase.com](https://status.supabase.com).

[→ Health Documentation](endpoints/health.md)

---

## CORS

Supabase handles CORS automatically. All origins are allowed for the anon key.

---

## Versioning

Supabase REST API is auto-generated from your database schema. There is no explicit versioning - the API always reflects the current table structure.

---

## SDKs & Tools

### curl
```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&icp_score=gte.70&order=icp_score.desc" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### Python
```python
import requests

SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

response = requests.get(
    f"{SUPABASE_URL}/displacement_targets",
    params={"select": "*", "icp_score": "gte.70", "order": "icp_score.desc"},
    headers={"apikey": ANON_KEY}
)
targets = response.json()
```

### JavaScript (Supabase Client)
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

const { data: targets, error } = await supabase
  .from('displacement_targets')
  .select('*')
  .gte('icp_score', 70)
  .order('icp_score', { ascending: false });
```

### JavaScript (Fetch)
```javascript
const response = await fetch(
  "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&icp_score=gte.70",
  {
    headers: {
      apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
);
const targets = await response.json();
```

---

## Related Documentation

- [Data Schemas](schemas.md)
- [Error Handling](errors.md)
- [Quickstart Guide](../guides/quickstart.md)
