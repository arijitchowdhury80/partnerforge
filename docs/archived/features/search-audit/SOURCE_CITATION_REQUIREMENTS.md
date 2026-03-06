# Source Citation Requirements - MANDATORY

**Date**: March 6, 2026
**Status**: CRITICAL REQUIREMENT
**Rule**: EVERY data point MUST have a verifiable source

---

## Core Principle

> **Nothing is ever unvalidated. Every single piece of data must link back to its source.**

---

## 1. What Must Be Cited

### EVERYTHING. No Exceptions.

| Data Type | Example | Required Source |
|-----------|---------|----------------|
| **Traffic data** | "100.9M monthly visits" | SimilarWeb API URL + timestamp |
| **Tech stack** | "Uses Shopify Plus" | BuiltWith API URL + detection date |
| **Financial data** | "$254B revenue (FY2024)" | Yahoo Finance API URL + filing date |
| **Job postings** | "28 open engineering roles" | LinkedIn jobs URL + scrape timestamp |
| **Social engagement** | "2.5M LinkedIn followers" | LinkedIn company page URL + timestamp |
| **Executive quote** | "We're investing heavily in tech" | SEC 10-K URL + page number + date |
| **Competitor data** | "Uses Elastic search" | BuiltWith URL OR screenshot |
| **Contact info** | "cto@company.com" | Apollo.io API URL + verified date |

**No exceptions**. If we can't cite it, we don't include it.

---

## 2. Data Structure: Sourced Data

### TypeScript Interface

```typescript
/**
 * Every piece of data in the system uses this wrapper
 */
interface SourcedData<T> {
  // The actual value
  value: T;

  // Source metadata (MANDATORY)
  source: {
    // Provider name
    provider: 'SimilarWeb' | 'BuiltWith' | 'Apollo.io' | 'Yahoo Finance' | 'SEC Edgar' | 'Apify';

    // Exact URL that returned this data
    // For APIs: full API endpoint with query params
    // For web pages: exact URL
    url: string;

    // When we fetched this data
    fetchedAt: Date;

    // Was this from cache or fresh?
    cacheHit: boolean;

    // Has this been validated?
    validated: boolean;

    // Data freshness (how old is this?)
    ageInDays: number;
  };
}
```

---

### Example: Traffic Data

```typescript
const monthlyVisits: SourcedData<number> = {
  value: 100900000,
  source: {
    provider: 'SimilarWeb',
    url: 'https://api.similarweb.com/v1/website/costco.com/total-traffic-and-engagement/desktop_mau_visits?start_date=2025-12&end_date=2025-12&country=ww&granularity=monthly',
    fetchedAt: new Date('2025-12-15T14:23:00Z'),
    cacheHit: false,
    validated: true,
    ageInDays: 0
  }
};
```

---

### Example: Job Posting

```typescript
const jobPosting: SourcedData<JobData> = {
  value: {
    title: 'Senior Search Engineer',
    department: 'Engineering',
    posted_date: '2025-12-10'
  },
  source: {
    provider: 'Apify',
    url: 'https://www.linkedin.com/jobs/view/3812345678',
    fetchedAt: new Date('2025-12-15T10:00:00Z'),
    cacheHit: false,
    validated: true,
    ageInDays: 0
  }
};
```

---

### Example: Executive Quote

```typescript
const executiveQuote: SourcedData<Quote> = {
  value: {
    text: "We're investing heavily in technology infrastructure",
    speaker: "Richard Galanti",
    title: "CFO",
    company: "Costco Wholesale"
  },
  source: {
    provider: 'SEC Edgar',
    url: 'https://www.sec.gov/Archives/edgar/data/909832/000090983224000015/cost-20240901.htm#i4f7c8b8b9e8e4c5c9f5e5f5e5f5e5f5e',
    fetchedAt: new Date('2025-12-15T16:00:00Z'),
    cacheHit: false,
    validated: true,
    ageInDays: 106  // Quote from Sept 1, 2024
  }
};
```

---

## 3. Database Schema: Source Citations

### JSONB Structure in PostgreSQL

```sql
-- Every JSONB column must include source metadata
CREATE TABLE audits (
  id UUID PRIMARY KEY,
  domain VARCHAR(255),

  -- Traffic data with sources
  traffic_data JSONB,  -- Structure below

  -- Tech stack with sources
  tech_stack JSONB,    -- Structure below

  -- ALL JSONB columns follow same pattern
  ...
);

-- Example traffic_data JSONB structure
{
  "monthly_visits": {
    "value": 100900000,
    "source": {
      "provider": "SimilarWeb",
      "url": "https://api.similarweb.com/v1/website/costco.com/total-traffic-and-engagement/desktop_mau_visits?start_date=2025-12&end_date=2025-12",
      "fetched_at": "2025-12-15T14:23:00Z",
      "cache_hit": false,
      "validated": true,
      "age_in_days": 0
    }
  },
  "bounce_rate": {
    "value": 0.372,
    "source": {
      "provider": "SimilarWeb",
      "url": "https://api.similarweb.com/v1/website/costco.com/total-traffic-and-engagement/engagement?...",
      "fetched_at": "2025-12-15T14:23:10Z",
      "cache_hit": false,
      "validated": true,
      "age_in_days": 0
    }
  }
}
```

---

### Separate Source Citations Table (Optional)

For easier querying and validation:

```sql
CREATE TABLE source_citations (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),

  -- What data point is this citing?
  data_path VARCHAR(255),  -- e.g., "traffic_data.monthly_visits"

  -- The actual data value (for validation)
  data_value JSONB,

  -- Source metadata
  provider VARCHAR(50),
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  cache_hit BOOLEAN,
  validated BOOLEAN DEFAULT FALSE,

  -- Data freshness
  age_in_days INTEGER,
  stale_threshold_days INTEGER DEFAULT 365,  -- 12 months
  is_stale BOOLEAN GENERATED ALWAYS AS (age_in_days > stale_threshold_days) STORED,

  -- Validation
  validated_at TIMESTAMPTZ,
  validated_by VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for validation queries
CREATE INDEX idx_citations_audit ON source_citations(audit_id);
CREATE INDEX idx_citations_stale ON source_citations(is_stale);
CREATE INDEX idx_citations_provider ON source_citations(provider);
```

---

## 4. API Client Implementation

### Every API Call Saves Full Metadata

```typescript
class SimilarWebClient {
  async getTrafficData(domain: string): Promise<SourcedData<TrafficData>> {
    const endpoint = '/v1/website/{domain}/total-traffic-and-engagement/desktop_mau_visits';
    const queryParams = {
      start_date: '2025-12',
      end_date: '2025-12',
      country: 'ww',
      granularity: 'monthly'
    };

    // Build full URL for citation
    const fullUrl = `${this.baseURL}${endpoint}?${new URLSearchParams(queryParams)}`;

    // Make API call
    const startTime = Date.now();
    const data = await this.http.get(endpoint, queryParams);
    const fetchedAt = new Date();

    // Save to database (for audit trail)
    await this.db.saveAPICall({
      service: 'SimilarWeb',
      endpoint,
      full_url: fullUrl,
      request_params: queryParams,
      response_data: data,
      fetched_at: fetchedAt,
      latency_ms: Date.now() - startTime
    });

    // Return with source metadata
    return {
      value: data,
      source: {
        provider: 'SimilarWeb',
        url: fullUrl,
        fetchedAt,
        cacheHit: false,
        validated: true,  // API response is validated
        ageInDays: 0
      }
    };
  }
}
```

---

## 5. UI Display: Show Sources Everywhere

### Dashboard View

```
┌─────────────────────────────────────────────────┐
│ Traffic Metrics                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│ Monthly Visits: 100.9M  (SimilarWeb ↗)         │
│                         ↑                        │
│                         Clickable link           │
│                                                  │
│ Bounce Rate: 37.2%      (SimilarWeb ↗)         │
│                                                  │
│ Pages/Visit: 5.2        (SimilarWeb ↗)         │
│                                                  │
└─────────────────────────────────────────────────┘
```

**On hover**:
```
┌─────────────────────────────────────────┐
│ Source Details                           │
├─────────────────────────────────────────┤
│ Provider: SimilarWeb                     │
│ Fetched: Dec 15, 2025 at 2:23 PM       │
│ Data Age: Fresh (0 days old)           │
│ Validated: ✅ Yes                       │
│                                          │
│ [View Full API Response ↗]              │
└─────────────────────────────────────────┘
```

---

### PDF Report: Footnotes

Every data point in the PDF includes a superscript citation:

```markdown
## Traffic Overview

Costco.com receives **100.9M monthly visits¹**, with a bounce rate
of **37.2%²** and an average of **5.2 pages per visit³**.

---

**Sources:**
¹ SimilarWeb API - Dec 15, 2025
  https://api.similarweb.com/v1/website/costco.com/total-traffic...

² SimilarWeb API - Dec 15, 2025
  https://api.similarweb.com/v1/website/costco.com/engagement...

³ SimilarWeb API - Dec 15, 2025
  https://api.similarweb.com/v1/website/costco.com/engagement...
```

---

### Audit Details Page: Sources Tab

```
┌─────────────────────────────────────────────────┐
│ [Overview] [Research] [Tests] [Sources] [Settings] │
├─────────────────────────────────────────────────┤
│                                                  │
│ All Sources (127 data points cited)             │
│                                                  │
│ ┌─ SimilarWeb (14 citations) ────────────────┐ │
│ │ ✅ Monthly visits (100.9M)                  │ │
│ │ ✅ Bounce rate (37.2%)                      │ │
│ │ ✅ Pages/visit (5.2)                        │ │
│ │ ... 11 more                                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ BuiltWith (7 citations) ───────────────────┐ │
│ │ ✅ E-commerce: Shopify Plus                 │ │
│ │ ✅ Analytics: Google Analytics              │ │
│ │ ... 5 more                                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ Apify/LinkedIn (28 citations) ─────────────┐ │
│ │ ✅ 28 job postings                          │ │
│ │    [View all LinkedIn URLs ↗]              │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 6. Validation Requirements

### Gate 6: Source Citation Validation (NEW)

Before audit marked as "complete", verify:

```typescript
async function validateSourceCitations(auditId: string): Promise<ValidationResult> {
  const citations = await db.getSourceCitations(auditId);

  const checks = {
    // Check 1: Every data point has a source
    all_cited: citations.length >= MIN_REQUIRED_CITATIONS,  // e.g., 100

    // Check 2: All source URLs are valid
    all_urls_valid: citations.every(c => isValidURL(c.source_url)),

    // Check 3: No stale data (>12 months old)
    no_stale_data: citations.every(c => c.age_in_days <= 365),

    // Check 4: All sources are from approved providers
    all_approved: citations.every(c => APPROVED_PROVIDERS.includes(c.provider)),

    // Check 5: At least 3 different sources used
    source_diversity: new Set(citations.map(c => c.provider)).size >= 3
  };

  const passed = Object.values(checks).every(Boolean);

  return {
    passed,
    checks,
    total_citations: citations.length,
    errors: getErrors(checks)
  };
}
```

**Fail conditions**:
- <100 citations → "Insufficient source citations"
- Any stale data (>12 months) → "Data freshness violation"
- <3 different sources → "Insufficient source diversity"

---

## 7. Source Citation Best Practices

### API Responses: Save Everything

```typescript
// DON'T do this (loses source context)
const visits = await similarWeb.getTrafficData(domain);
await db.save({ visits: visits.value });  // ❌ Lost source info!

// DO this (preserves source)
const visits = await similarWeb.getTrafficData(domain);
await db.save({ visits });  // ✅ Includes source metadata
```

---

### Caching: Preserve Source Metadata

```typescript
// Cache structure includes source
const cacheKey = 'traffic:costco.com';
const cachedData = await redis.get(cacheKey);

if (cachedData) {
  const parsed: SourcedData<TrafficData> = JSON.parse(cachedData);

  // Update cache metadata
  parsed.source.cacheHit = true;
  parsed.source.ageInDays = calculateAge(parsed.source.fetchedAt);

  return parsed;
}
```

---

### UI Components: Always Show Source

```typescript
// Reusable source badge component
function SourceBadge({ source }: { source: Source }) {
  return (
    <Tooltip content={
      <div>
        <strong>{source.provider}</strong>
        <br />
        Fetched: {formatDate(source.fetchedAt)}
        <br />
        Age: {source.ageInDays} days
        <br />
        <a href={source.url} target="_blank">View Source ↗</a>
      </div>
    }>
      <Badge color={source.ageInDays > 365 ? 'red' : 'green'}>
        {source.provider} ↗
      </Badge>
    </Tooltip>
  );
}

// Usage
<DataPoint
  label="Monthly Visits"
  value="100.9M"
  source={trafficData.source}  // ALWAYS pass source
/>
```

---

## 8. Implementation Checklist

### Week 1-2: API Clients

- [ ] Every API client returns `SourcedData<T>` wrapper
- [ ] Every API call saves full request/response to `api_calls` table
- [ ] Every API call includes full URL in source metadata

### Week 3-4: Database

- [ ] All JSONB columns use `{ value, source }` structure
- [ ] Create `source_citations` table for validation
- [ ] Add indexes for citation queries

### Week 5-6: UI Components

- [ ] Create `<SourceBadge>` component
- [ ] Create `<DataPoint>` component (always shows source)
- [ ] Add "Sources" tab to Audit Details page
- [ ] Add footnotes to PDF report generator

### Week 7-8: Validation

- [ ] Implement Gate 6: Source Citation Validation
- [ ] Add data freshness checks (12-month rule)
- [ ] Add source diversity checks (≥3 providers)
- [ ] Fail audits with insufficient citations

### Week 9-10: Testing

- [ ] Test: Every data point in UI has clickable source link
- [ ] Test: PDF report has footnotes for all claims
- [ ] Test: Gate 6 catches missing citations
- [ ] Test: Stale data (>12 months) triggers warnings

---

## 9. G2 Crowd Decision: Skip Web Scraping

### Problem with G2 Web Scraping

**Legal risks**:
- G2's Terms of Service prohibit scraping
- No public API for reviews
- Risk of IP bans, legal action

**Reliability risks**:
- HTML changes break scraper
- Anti-bot detection (Cloudflare)
- Data quality unknown

**Source citation problem**:
- Scraped data = no official source URL
- Can't verify accuracy
- Violates "every data point must be cited" rule

---

### Alternative: Use Official Sources Instead

**Instead of G2 reviews, use**:

1. **Gartner Peer Insights** (has API)
   - Official analyst reviews
   - Verified purchasers only
   - API access available ($500/month)

2. **TrustRadius** (has API)
   - Verified reviews
   - API access ($250/month)
   - Better data quality than scraping

3. **Vendor case studies** (official sources)
   - Algolia's own case studies
   - Competitor case studies (Elastic, Bloomreach)
   - Fully citable (official URLs)

4. **Industry analyst reports**
   - Gartner Magic Quadrant
   - Forrester Wave
   - Already part of SAIM reference

**Recommendation**: **Skip G2 entirely**. Use Gartner Peer Insights API or official case studies instead.

---

## Summary: Source Citation Requirements

### The Rule
> **Every single data point must have a verifiable source URL and timestamp.**

### Implementation
1. ✅ All API clients return `SourcedData<T>` wrapper
2. ✅ All database JSONB uses `{ value, source }` structure
3. ✅ All UI components show source badges
4. ✅ All PDF reports include footnotes
5. ✅ Gate 6 validates source citations

### What We're NOT Doing
❌ **NO web scraping** (G2, Glassdoor, etc.)
- Can't guarantee source validity
- Legal/reliability risks
- Use official APIs only

---

**Status**: Requirements documented
**Next**: Implement `SourcedData<T>` wrapper in API clients
**Owner**: Dashboard Builder Team
**Last Updated**: March 6, 2026
