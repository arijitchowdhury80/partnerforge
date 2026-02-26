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

- API access (no authentication required for read endpoints)
- curl, Python, or any HTTP client
- (Optional) API token for write operations

---

## Base URL

```
https://partnerforge-production.up.railway.app/api/v1
```

---

## Step 1: Check API Health

```bash
curl "https://partnerforge-production.up.railway.app/health"
```

**Response:**
```json
{
  "status": "healthy",
  "service": "PartnerForge API",
  "version": "2.2.0"
}
```

---

## Step 2: Get Overall Statistics

```bash
curl "https://partnerforge-production.up.railway.app/api/v1/targets/stats"
```

**Response:**
```json
{
  "total": 2687,
  "by_status": {
    "hot": 9,
    "warm": 49,
    "cool": 150,
    "cold": 2479
  },
  "avg_icp_score": 51.2,
  "total_pipeline_value": 63000000
}
```

---

## Step 3: List Hot Leads

Get the highest-scored displacement targets:

```bash
curl "https://partnerforge-production.up.railway.app/api/v1/targets?status=hot&page_size=10"
```

**Response:**
```json
{
  "targets": [
    {
      "domain": "mercedes-benz.com",
      "company_name": "Mercedes-Benz",
      "icp_score": 95,
      "icp_tier_name": "hot",
      "vertical": "Automotive",
      "sw_monthly_visits": 15000000,
      "revenue": 156000000000
    }
  ],
  "pagination": {
    "total": 9,
    "page": 1,
    "page_size": 10
  }
}
```

---

## Step 4: Get Target Details

Get full details for a specific company:

```bash
curl "https://partnerforge-production.up.railway.app/api/v1/targets/mercedes-benz.com"
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

Find targets in a specific industry:

```bash
curl "https://partnerforge-production.up.railway.app/api/v1/targets?vertical=Commerce&min_traffic=1000000&sort_by=revenue&sort_order=desc"
```

**Available filters:**
- `status`: hot, warm, cool, cold
- `vertical`: Commerce, Media, Financial, Healthcare
- `partner_tech`: Adobe AEM, Shopify Plus
- `min_score` / `max_score`: 0-100
- `min_traffic`: Monthly visits threshold
- `is_public`: true/false
- `search`: Text search in domain/name

---

## Step 6: Bulk Search

Check if specific accounts are targets:

```bash
curl -X POST "https://partnerforge-production.up.railway.app/api/v1/targets/search" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": ["costco.com", "walmart.com", "target.com"]
  }'
```

**Response:**
```json
{
  "found": [
    {"domain": "costco.com", "icp_score": 75}
  ],
  "not_found": ["walmart.com", "target.com"],
  "total_found": 1
}
```

---

## Python Example

```python
import requests

BASE_URL = "https://partnerforge-production.up.railway.app/api/v1"

# Get hot leads
response = requests.get(f"{BASE_URL}/targets", params={
    "status": "hot",
    "page_size": 10
})

targets = response.json()["targets"]
for t in targets:
    print(f"{t['company_name']}: ICP {t['icp_score']}, ${t['revenue']/1e9:.1f}B revenue")
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

```javascript
const BASE_URL = "https://partnerforge-production.up.railway.app/api/v1";

// Get hot leads
async function getHotLeads() {
  const response = await fetch(`${BASE_URL}/targets?status=hot&page_size=10`);
  const { targets } = await response.json();

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
curl "https://partnerforge-production.up.railway.app/api/v1/targets?status=warm&vertical=Commerce&min_traffic=5000000"
```

### 2. Account Research

```bash
# Check if a prospect is in our database
curl "https://partnerforge-production.up.railway.app/api/v1/targets/costco.com"
```

### 3. Pipeline Building

```bash
# Get all public companies (easier to research)
curl "https://partnerforge-production.up.railway.app/api/v1/targets?is_public=true&min_score=60"
```

### 4. Territory Planning

```bash
# Get targets by region
curl "https://partnerforge-production.up.railway.app/api/v1/targets?country=Germany&min_score=50"
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
