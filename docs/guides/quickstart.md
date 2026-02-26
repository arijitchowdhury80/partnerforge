# Quickstart Guide

Get started with the PartnerForge API in 5 minutes.

---

## Overview

PartnerForge identifies **displacement opportunities** — companies using partner technologies (Adobe AEM, Shopify) that are NOT using Algolia. Use this API to:

- Browse and filter displacement targets
- Get detailed company intelligence
- Trigger data enrichment from external sources
- Track ICP scores and lead status

---

## Prerequisites

- Supabase anon key (provided below)
- curl, Python, or any HTTP client
- (Optional) Supabase client library for your language

---

## Base URL

```
https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1
```

## Authentication

All requests require the Supabase `apikey` header:

```
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg
```

---

## Step 1: Test Connection

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=count&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

**Response:**
```json
[{"count": 2737}]
```

---

## Step 2: Get Overall Statistics

Use Supabase's built-in aggregation to count by status:

```bash
# Get total count
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=count" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg" \
  -H "Prefer: count=exact"
```

**Response Headers include:**
```
content-range: 0-0/2737
```

**Current data:**
- **Total:** 2,737 displacement targets
- **Hot (80-100):** 9
- **Warm (60-79):** 49
- **Cool (40-59):** 394
- **Cold (0-39):** 2,285

---

## Step 3: List Hot Leads

Get the highest-scored displacement targets (ICP score >= 80):

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain,company_name,icp_score,icp_tier_name,vertical,sw_monthly_visits,revenue&icp_score=gte.80&order=icp_score.desc&limit=10" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

**Response:**
```json
[
  {
    "domain": "mercedes-benz.com",
    "company_name": "Mercedes-Benz",
    "icp_score": 95,
    "icp_tier_name": "hot",
    "vertical": "Automotive",
    "sw_monthly_visits": 15000000,
    "revenue": 156000000000
  },
  {
    "domain": "marks.com",
    "company_name": "Mark's",
    "icp_score": 85,
    "icp_tier_name": "hot"
  }
]
```

---

## Step 4: Get Target Details

Get full details for a specific company by domain:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&domain=eq.mercedes-benz.com" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

**Response includes:**
- Company info (name, location, contacts)
- Traffic metrics (monthly visits, bounce rate)
- Financial data (revenue, market cap, ticker)
- ICP scoring (score, tier, reasons)
- Intelligence (exec quotes, trigger events)
- Displacement angle (sales messaging)

---

## Step 5: Filter by Vertical

Find targets in a specific industry using PostgREST query syntax:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain,company_name,icp_score,revenue,sw_monthly_visits&vertical=eq.Commerce&sw_monthly_visits=gte.1000000&order=revenue.desc&limit=20" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

**Available PostgREST operators:**
- `eq`: equals (e.g., `vertical=eq.Commerce`)
- `gte`: greater than or equal (e.g., `icp_score=gte.80`)
- `lte`: less than or equal (e.g., `icp_score=lte.50`)
- `like`: pattern match (e.g., `domain=like.*amazon*`)
- `ilike`: case-insensitive pattern match
- `order`: sorting (e.g., `order=icp_score.desc`)

**Filterable columns:**
- `icp_tier_name`: hot, warm, cool, cold
- `vertical`: Commerce, Media, Financial, Healthcare
- `partner_technology`: Adobe AEM, Shopify Plus
- `icp_score`: 0-100
- `sw_monthly_visits`: Monthly traffic
- `is_public`: true/false

---

## Step 6: Search Multiple Domains

Check if specific accounts are targets using the `in` operator:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain,company_name,icp_score&domain=in.(costco.com,walmart.com,target.com)" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

**Response:**
```json
[
  {"domain": "costco.com", "company_name": "Costco", "icp_score": 75}
]
```

Note: Domains not found simply won't appear in the response array.

---

## Python Example

### Option 1: Using Supabase Python Client (Recommended)

```python
from supabase import create_client

SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Get hot leads (ICP score >= 80)
response = supabase.table("displacement_targets") \
    .select("domain, company_name, icp_score, revenue") \
    .gte("icp_score", 80) \
    .order("icp_score", desc=True) \
    .limit(10) \
    .execute()

for t in response.data:
    revenue = t.get('revenue') or 0
    print(f"{t['company_name']}: ICP {t['icp_score']}, ${revenue/1e9:.1f}B revenue")
```

### Option 2: Using requests

```python
import requests

SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1"
HEADERS = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
}

# Get hot leads
response = requests.get(
    f"{SUPABASE_URL}/displacement_targets",
    headers=HEADERS,
    params={
        "select": "domain,company_name,icp_score,revenue",
        "icp_score": "gte.80",
        "order": "icp_score.desc",
        "limit": 10
    }
)

for t in response.json():
    revenue = t.get('revenue') or 0
    print(f"{t['company_name']}: ICP {t['icp_score']}, ${revenue/1e9:.1f}B revenue")
```

**Output:**
```
Mercedes-Benz: ICP 95, $156.0B revenue
Mark's: ICP 85, $2.1B revenue
Infiniti: ICP 85, $15.2B revenue
...
```

---

## JavaScript Example

### Option 1: Using Supabase JS Client (Recommended)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

// Get hot leads (ICP score >= 80)
async function getHotLeads() {
  const { data, error } = await supabase
    .from('displacement_targets')
    .select('domain, company_name, icp_score, revenue')
    .gte('icp_score', 80)
    .order('icp_score', { ascending: false })
    .limit(10);

  if (error) throw error;

  data.forEach(t => {
    console.log(`${t.company_name}: ICP ${t.icp_score}`);
  });
}

getHotLeads();
```

### Option 2: Using fetch

```javascript
const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg';

async function getHotLeads() {
  const response = await fetch(
    `${SUPABASE_URL}/displacement_targets?select=domain,company_name,icp_score&icp_score=gte.80&order=icp_score.desc&limit=10`,
    {
      headers: { 'apikey': SUPABASE_KEY }
    }
  );

  const targets = await response.json();
  targets.forEach(t => {
    console.log(`${t.company_name}: ICP ${t.icp_score}`);
  });
}

getHotLeads();
```

---

## ICP Score Reference

| Tier | Score | Description |
|------|-------|-------------|
| Hot | 80-100 | Ready for outreach |
| Warm | 60-79 | Strong potential |
| Cool | 40-59 | Nurture required |
| Cold | 0-39 | Low priority |

---

## Common Use Cases

### 1. Sales Prospecting

```bash
# Get warm leads in Commerce with high traffic
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&icp_tier_name=eq.warm&vertical=eq.Commerce&sw_monthly_visits=gte.5000000" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### 2. Account Research

```bash
# Check if a prospect is in our database
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&domain=eq.costco.com" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### 3. Pipeline Building

```bash
# Get all public companies with ICP score >= 60
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain,company_name,icp_score,ticker&is_public=eq.true&icp_score=gte.60&order=icp_score.desc" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### 4. Territory Planning

```bash
# Get targets by country
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain,company_name,icp_score&country=eq.Germany&icp_score=gte.50&order=icp_score.desc" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

---

## Next Steps

1. **Explore Filtering** — See [Targets API](../api/endpoints/targets.md) for all filter options
2. **Enrich Data** — Trigger enrichment for detailed intelligence (requires auth)
3. **Use the Dashboard** — Visit https://partnerforge.vercel.app for visual exploration
4. **Integrate** — Build the API into your CRM or sales tools

---

## Need Help?

- API Reference: [docs/api/README.md](../api/README.md)
- Error Handling: [docs/api/errors.md](../api/errors.md)
- Issues: https://github.com/arijitchowdhury80/partnerforge/issues
