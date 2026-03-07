# API Client Specifications

**Version**: 1.0
**Date**: March 6, 2026
**Status**: Ready for Implementation
**Architecture**: Direct APIs with 7-Day Redis Caching

---

## Overview

This document specifies the **31 API endpoints** across **5 services** that power the Algolia Search Audit Dashboard.

**Services**:
1. **SimilarWeb** (14 endpoints) - Traffic, engagement, competitors
2. **BuiltWith** (7 endpoints) - Tech stack detection
3. **Yahoo Finance** (5 endpoints) - Financial data
4. **SEC Edgar** (3 endpoints) - 10-K/10-Q filings
5. **JSearch** (2 endpoints) - Job postings

---

## Client Architecture

### Base HTTP Client

```typescript
// src/clients/HttpClient.ts
export class HttpClient {
  constructor(
    private baseURL: string,
    private apiKey: string,
    private rateLimiter: RateLimiter,
    private cache: RedisCache,
    private db: DatabaseClient
  ) {}

  async get<T>(
    endpoint: string,
    params: Record<string, any>,
    options?: RequestOptions
  ): Promise<T> {
    // 1. Build cache key
    const cacheKey = this.buildCacheKey(endpoint, params);

    // 2. Check cache (7-day TTL)
    const cached = await this.cache.get(cacheKey);
    if (cached && !options?.bypassCache) {
      await this.metrics.incrementCounter('cache_hits');
      return JSON.parse(cached);
    }

    // 3. Rate limit
    await this.rateLimiter.acquire();

    // 4. Make API call with retry
    const startTime = Date.now();
    try {
      const response = await this.retryableRequest(() =>
        axios.get<T>(`${this.baseURL}${endpoint}`, {
          params,
          headers: { Authorization: `Bearer ${this.apiKey}` }
        })
      );

      const latencyMs = Date.now() - startTime;
      const data = response.data;

      // 5. Save to cache (7-day TTL = 604800 seconds)
      await this.cache.set(cacheKey, JSON.stringify(data), 604800);

      // 6. Save to database (persistence)
      await this.db.saveAPICall({
        service: this.serviceName,
        endpoint,
        requestParams: params,
        responseData: data,
        cacheHit: false,
        latencyMs,
        costUsd: options?.costUsd || 0,
        calledAt: new Date()
      });

      await this.metrics.incrementCounter('cache_misses');
      return data;

    } catch (error) {
      await this.metrics.incrementCounter('api_errors');
      throw new APIError(`${this.serviceName} API failed`, error);
    }
  }

  private async retryableRequest<T>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        await sleep(delayMs);
      }
    }
    throw new Error('Max retries exceeded');
  }
}
```

---

## 1. SimilarWeb Client (14 Endpoints)

### Base Configuration

```typescript
const SIMILARWEB_CONFIG = {
  baseURL: 'https://api.similarweb.com/v1',
  apiKey: process.env.SIMILARWEB_API_KEY,
  rateLimit: 10, // requests per second
  costPerCall: 0.05 // USD
};
```

---

### 1.1 Traffic & Engagement Metrics

#### Endpoint: `getTrafficData`

```typescript
/**
 * Get total traffic data (monthly visits, unique visitors)
 * Cache TTL: 7 days
 */
async getTrafficData(domain: string, dateRange: DateRange): Promise<TrafficData> {
  return this.http.get('/website/{domain}/total-traffic-and-engagement/desktop_mau_visits', {
    domain,
    start_date: dateRange.start, // YYYY-MM format
    end_date: dateRange.end,
    country: 'ww', // worldwide
    granularity: 'monthly'
  }, { costUsd: 0.05 });
}

// Response Type
interface TrafficData {
  visits: Array<{
    date: string;        // "2025-12"
    visits: number;      // 100900000
  }>;
  meta: {
    request: {
      domain: string;
      start_date: string;
      end_date: string;
    };
    status: string;
    last_updated: string;
  };
}
```

---

#### Endpoint: `getEngagementMetrics`

```typescript
/**
 * Get engagement metrics (bounce rate, pages/visit, avg duration)
 * Cache TTL: 7 days
 */
async getEngagementMetrics(domain: string, dateRange: DateRange): Promise<EngagementData> {
  return this.http.get('/website/{domain}/total-traffic-and-engagement/engagement', {
    domain,
    start_date: dateRange.start,
    end_date: dateRange.end,
    country: 'ww',
    granularity: 'monthly'
  }, { costUsd: 0.05 });
}

// Response Type
interface EngagementData {
  bounce_rate: Array<{
    date: string;
    bounce_rate: number;  // 0.372 (37.2%)
  }>;
  pages_per_visit: Array<{
    date: string;
    pages_per_visit: number; // 5.2
  }>;
  avg_visit_duration: Array<{
    date: string;
    avg_visit_duration: number; // 245 (seconds)
  }>;
  meta: MetaInfo;
}
```

---

### 1.2 Traffic Sources

#### Endpoint: `getTrafficSources`

```typescript
/**
 * Get traffic source breakdown (direct, search, social, referral, email, display)
 * Cache TTL: 7 days
 */
async getTrafficSources(domain: string, dateRange: DateRange): Promise<TrafficSourceData> {
  return this.http.get('/website/{domain}/traffic-sources/overview', {
    domain,
    start_date: dateRange.start,
    end_date: dateRange.end,
    country: 'ww'
  }, { costUsd: 0.05 });
}

// Response Type
interface TrafficSourceData {
  channels: {
    direct: number;           // 0.45 (45%)
    search: number;           // 0.25 (25%)
    social: number;           // 0.15 (15%)
    referral: number;         // 0.10 (10%)
    email: number;            // 0.03 (3%)
    display_ads: number;      // 0.02 (2%)
  };
  search_breakdown: {
    organic: number;          // 0.80 (80% of search)
    paid: number;             // 0.20 (20% of search)
  };
  meta: MetaInfo;
}
```

---

### 1.3 Geographic Distribution

#### Endpoint: `getGeography`

```typescript
/**
 * Get geographic traffic distribution (top 5 countries)
 * Cache TTL: 7 days
 */
async getGeography(domain: string, dateRange: DateRange): Promise<GeographyData> {
  return this.http.get('/website/{domain}/geo/traffic-shares', {
    domain,
    start_date: dateRange.start,
    end_date: dateRange.end,
    granularity: 'monthly'
  }, { costUsd: 0.05 });
}

// Response Type
interface GeographyData {
  countries: Array<{
    country_code: string;     // "US", "GB", "CA"
    country_name: string;     // "United States"
    visits_share: number;     // 0.45 (45%)
  }>;
  meta: MetaInfo;
}
```

---

### 1.4 Demographics

#### Endpoint: `getDemographics`

```typescript
/**
 * Get audience demographics (age, gender)
 * Cache TTL: 7 days
 */
async getDemographics(domain: string): Promise<DemographicsData> {
  return this.http.get('/website/{domain}/demographics/age', {
    domain,
    country: 'ww'
  }, { costUsd: 0.05 });
}

// Response Type
interface DemographicsData {
  age_distribution: {
    '18-24': number;          // 0.15 (15%)
    '25-34': number;          // 0.30 (30%)
    '35-44': number;          // 0.25 (25%)
    '45-54': number;          // 0.18 (18%)
    '55-64': number;          // 0.08 (8%)
    '65+': number;            // 0.04 (4%)
  };
  gender_distribution: {
    male: number;             // 0.52 (52%)
    female: number;           // 0.48 (48%)
  };
  meta: MetaInfo;
}
```

---

### 1.5 Keywords (SEO)

#### Endpoint: `getTopKeywords`

```typescript
/**
 * Get top organic search keywords
 * Cache TTL: 7 days
 */
async getTopKeywords(domain: string): Promise<KeywordData> {
  return this.http.get('/website/{domain}/keywords/top', {
    domain,
    country: 'ww',
    limit: 50
  }, { costUsd: 0.05 });
}

// Response Type
interface KeywordData {
  keywords: Array<{
    keyword: string;          // "costco tires"
    visits_share: number;     // 0.025 (2.5% of search traffic)
    position: number;         // 1 (rank in SERP)
    volume: number;           // 50000 (monthly searches)
  }>;
  meta: MetaInfo;
}
```

---

### 1.6 Competitors

#### Endpoint: `getSimilarSites`

```typescript
/**
 * Get similar/competitor websites
 * Cache TTL: 7 days
 */
async getSimilarSites(domain: string): Promise<CompetitorData> {
  return this.http.get('/website/{domain}/similar-sites/similarsites', {
    domain,
    limit: 10
  }, { costUsd: 0.05 });
}

// Response Type
interface CompetitorData {
  sites: Array<{
    domain: string;           // "target.com"
    similarity_score: number; // 0.85 (85% similar)
  }>;
  meta: MetaInfo;
}
```

---

### 1.7 Audience Interests

#### Endpoint: `getAudienceInterests`

```typescript
/**
 * Get audience interest categories
 * Cache TTL: 7 days
 */
async getAudienceInterests(domain: string): Promise<InterestData> {
  return this.http.get('/website/{domain}/audience-interests', {
    domain
  }, { costUsd: 0.05 });
}

// Response Type
interface InterestData {
  interests: Array<{
    category: string;         // "Home & Garden"
    affinity: number;         // 1.85 (1.85x more likely than avg)
  }>;
  meta: MetaInfo;
}
```

---

### 1.8 Technology Stack

#### Endpoint: `getTechnologies`

```typescript
/**
 * Get website technology stack (analytics, advertising, CMS)
 * Cache TTL: 7 days
 */
async getTechnologies(domain: string): Promise<TechnologyData> {
  return this.http.get('/website/{domain}/technographics/all', {
    domain
  }, { costUsd: 0.05 });
}

// Response Type
interface TechnologyData {
  technologies: Array<{
    category: string;         // "Analytics", "Advertising", "CMS"
    name: string;             // "Google Analytics", "Google Ads"
  }>;
  meta: MetaInfo;
}
```

---

### 1.9-1.14 Additional Endpoints (Summary)

| Method | Endpoint | Purpose | Cost |
|--------|----------|---------|------|
| `getReferrals()` | `/website/{domain}/referrals` | Top referring domains | $0.05 |
| `getPopularPages()` | `/website/{domain}/content/pages` | Top landing pages | $0.05 |
| `getLeadingFolders()` | `/website/{domain}/content/leading-folders` | Top URL folders | $0.05 |
| `getLandingPages()` | `/website/{domain}/keywords/landing-pages` | SEO landing pages | $0.05 |
| `getKeywordCompetitors()` | `/website/{domain}/keywords/competitors` | Keyword overlap with competitors | $0.05 |
| `getWebsiteRank()` | `/website/{domain}/global-rank/global-rank` | Global + category rank | $0.05 |

---

## 2. BuiltWith Client (7 Endpoints)

### Base Configuration

```typescript
const BUILTWITH_CONFIG = {
  baseURL: 'https://api.builtwith.com',
  apiKey: process.env.BUILTWITH_API_KEY,
  rateLimit: 5, // requests per second (conservative)
  costPerCall: 0.10 // USD (estimate)
};
```

---

### 2.1 Domain Lookup

#### Endpoint: `getTechStack`

```typescript
/**
 * Get complete technology stack for a domain
 * Cache TTL: 7 days
 */
async getTechStack(domain: string): Promise<TechStackData> {
  return this.http.get('/v20/api.json', {
    KEY: this.apiKey,
    LOOKUP: domain
  }, { costUsd: 0.10 });
}

// Response Type
interface TechStackData {
  Results: Array<{
    Result: {
      Paths: Array<{
        Domain: string;
        Url: string;
        Technologies: Array<{
          Tag: string;          // "CMS", "eCommerce", "Analytics"
          Name: string;         // "Shopify Plus", "Google Analytics"
          FirstDetected: number;  // Unix timestamp
          LastDetected: number;   // Unix timestamp
        }>;
      }>;
    };
  }>;
}
```

---

### 2.2 Relationships API

#### Endpoint: `getRelationships`

```typescript
/**
 * Get technology combinations (what techs are used together)
 * Cache TTL: 7 days
 */
async getRelationships(domain: string): Promise<RelationshipData> {
  return this.http.get('/v13/api.json', {
    KEY: this.apiKey,
    LOOKUP: domain
  }, { costUsd: 0.10 });
}

// Response Type
interface RelationshipData {
  Relationships: Array<{
    TechA: string;            // "Shopify"
    TechB: string;            // "Klaviyo"
    Count: number;            // 15000 (sites using both)
  }>;
}
```

---

### 2.3-2.7 Additional Endpoints (Summary)

| Method | Endpoint | Purpose | Cost |
|--------|----------|---------|------|
| `getRecommendations()` | `/v16/api.json` | Recommended technologies based on stack | $0.10 |
| `getFinancialData()` | `/v17/api.json` | Company size, revenue estimate | $0.10 |
| `getSocialProfiles()` | `/v18/api.json` | Social media presence | $0.10 |
| `getTrustSignals()` | `/v19/api.json` | SSL, security, trust badges | $0.10 |
| `getKeywords()` | `/v21/api.json` | SEO keywords (BuiltWith's own data) | $0.10 |

---

## 3. Yahoo Finance Client (5 Endpoints)

### Base Configuration

```typescript
const YAHOO_FINANCE_CONFIG = {
  baseURL: 'https://query2.finance.yahoo.com',
  apiKey: null, // Public API (no key required)
  rateLimit: 2, // requests per second (conservative)
  costPerCall: 0 // Free API
};
```

---

### 3.1 Stock Info

#### Endpoint: `getStockInfo`

```typescript
/**
 * Get current stock price, market cap, P/E ratio
 * Cache TTL: 24 hours (more dynamic than other data)
 */
async getStockInfo(ticker: string): Promise<StockInfo> {
  return this.http.get(`/v10/finance/quoteSummary/${ticker}`, {
    modules: 'price,summaryDetail,financialData'
  }, { costUsd: 0, cacheTTL: 86400 }); // 24hr cache
}

// Response Type
interface StockInfo {
  price: {
    regularMarketPrice: number;       // 254.50
    regularMarketChange: number;      // 2.50
    regularMarketChangePercent: number; // 0.0099 (0.99%)
    marketCap: number;                // 112500000000
  };
  summaryDetail: {
    trailingPE: number;               // 25.4
    forwardPE: number;                // 22.1
    fiftyTwoWeekHigh: number;         // 280.00
    fiftyTwoWeekLow: number;          // 210.00
  };
}
```

---

### 3.2 Financial Statements

#### Endpoint: `getFinancialStatements`

```typescript
/**
 * Get 3-year financial history (income statement)
 * Cache TTL: 7 days
 */
async getFinancialStatements(ticker: string): Promise<FinancialData> {
  return this.http.get(`/v10/finance/quoteSummary/${ticker}`, {
    modules: 'incomeStatementHistory,balanceSheetHistory'
  }, { costUsd: 0 });
}

// Response Type
interface FinancialData {
  incomeStatementHistory: {
    incomeStatementHistory: Array<{
      endDate: string;                // "2024-08-31"
      totalRevenue: number;           // 254500000000
      ebitda: number;                 // 12500000000
      netIncome: number;              // 6800000000
    }>;
  };
  balanceSheetHistory: {
    balanceSheetStatements: Array<{
      endDate: string;
      totalAssets: number;
      totalLiabilities: number;
    }>;
  };
}
```

---

### 3.3-3.5 Additional Endpoints (Summary)

| Method | Endpoint | Purpose | Cost |
|--------|----------|---------|------|
| `getRecommendations()` | `/v6/finance/recommendationsbysymbol` | Analyst ratings (buy/hold/sell) | Free |
| `getNews()` | `/v1/finance/search` | Recent company news | Free |
| `getHolders()` | `/v10/finance/quoteSummary/{ticker}?modules=institutionOwnership` | Institutional ownership | Free |

---

## 4. SEC Edgar Client (3 Endpoints)

### Base Configuration

```typescript
const SEC_EDGAR_CONFIG = {
  baseURL: 'https://www.sec.gov',
  apiKey: null, // Public API
  rateLimit: 1, // requests per second (SEC rate limit)
  costPerCall: 0, // Free
  userAgent: 'Algolia Search Audit Platform contact@algolia.com' // Required by SEC
};
```

---

### 4.1 Search Filings

#### Endpoint: `searchFilings`

```typescript
/**
 * Search for 10-K, 10-Q filings
 * Cache TTL: 7 days
 */
async searchFilings(cik: string, filingType: '10-K' | '10-Q'): Promise<FilingSearchResult> {
  return this.http.get('/cgi-bin/browse-edgar', {
    action: 'getcompany',
    CIK: cik,
    type: filingType,
    dateb: '', // All dates
    owner: 'exclude',
    count: 5, // Last 5 filings
    search_text: ''
  }, { costUsd: 0 });
}

// Response Type
interface FilingSearchResult {
  filings: Array<{
    filingDate: string;               // "2024-10-15"
    filingType: string;               // "10-K"
    accessionNumber: string;          // "0001193125-24-123456"
    documentUrl: string;              // URL to filing
  }>;
}
```

---

### 4.2 Get Filing Content

#### Endpoint: `getFilingContent`

```typescript
/**
 * Download full 10-K/10-Q filing (HTML or TXT)
 * Cache TTL: 7 days (filings never change)
 */
async getFilingContent(accessionNumber: string): Promise<string> {
  const url = `/Archives/edgar/data/${this.extractCIK(accessionNumber)}/${accessionNumber}.txt`;
  return this.http.get(url, {}, { costUsd: 0 });
}

// Response: Raw HTML/TXT content of filing
```

---

### 4.3 Extract Section

#### Endpoint: `extractSection`

```typescript
/**
 * Extract specific section from 10-K (e.g., "Risk Factors", "MD&A")
 * This is a custom parser (not an API call)
 * Cache TTL: 7 days
 */
extractSection(filingContent: string, sectionName: string): string {
  // Parse HTML, find section by heading
  // Return section text
  // Used for extracting executive quotes from MD&A section
}
```

---

## 5. JSearch Client (2 Endpoints)

### Base Configuration

```typescript
const JSEARCH_CONFIG = {
  baseURL: 'https://jsearch.p.rapidapi.com',
  apiKey: process.env.RAPIDAPI_KEY,
  rateLimit: 5, // requests per second
  costPerCall: 0.001 // $0.001 per call (RapidAPI pricing)
};
```

---

### 5.1 Search Jobs

#### Endpoint: `searchJobs`

```typescript
/**
 * Search job postings by company
 * Cache TTL: 24 hours (job postings change daily)
 */
async searchJobs(companyName: string): Promise<JobData> {
  return this.http.get('/search', {
    query: `${companyName} hiring`,
    page: 1,
    num_pages: 1,
    date_posted: 'month' // Last 30 days
  }, { costUsd: 0.001, cacheTTL: 86400 }); // 24hr cache
}

// Response Type
interface JobData {
  data: Array<{
    job_id: string;
    job_title: string;              // "Senior Software Engineer"
    employer_name: string;          // "Costco Wholesale"
    job_posted_at_datetime_utc: string; // "2025-12-15T10:00:00Z"
    job_employment_type: string;    // "FULLTIME"
    job_is_remote: boolean;
    job_city: string;
    job_state: string;
    job_description: string;        // Full text (use for keyword analysis)
  }>;
  meta: {
    total_results: number;          // 28
  };
}
```

---

### 5.2 Get Job Details

#### Endpoint: `getJobDetails`

```typescript
/**
 * Get full job posting details (including requirements, benefits)
 * Cache TTL: 24 hours
 */
async getJobDetails(jobId: string): Promise<JobDetails> {
  return this.http.get('/job-details', {
    job_id: jobId
  }, { costUsd: 0.001, cacheTTL: 86400 });
}

// Response Type
interface JobDetails {
  job_id: string;
  job_title: string;
  job_description: string;          // Full HTML
  job_highlights: {
    Qualifications: string[];       // ["5+ years experience", "BS in CS"]
    Responsibilities: string[];     // ["Lead team of 5 engineers"]
  };
  job_apply_link: string;
}
```

---

## Implementation Checklist

### Week 1-2: Core Infrastructure

- [ ] Set up Redis instance (AWS ElastiCache or Upstash)
- [ ] Configure 7-day default TTL
- [ ] Create `HttpClient` base class with retry/cache logic
- [ ] Create `RateLimiter` class (token bucket algorithm)
- [ ] Create `DatabaseClient` class (Supabase integration)
- [ ] Set up monitoring (Datadog or CloudWatch)

### Week 1-2: API Clients

- [ ] `SimilarWebClient` (14 methods)
- [ ] `BuiltWithClient` (7 methods)
- [ ] `YahooFinanceClient` (5 methods)
- [ ] `SecEdgarClient` (3 methods)
- [ ] `JSearchClient` (2 methods)

### Week 1-2: TypeScript Types

- [ ] Define all request/response interfaces
- [ ] Export types from `@/types/api.ts`
- [ ] Add JSDoc comments with examples

### Week 1-2: Testing

- [ ] Unit tests for each client (mock API responses)
- [ ] Integration tests (real API calls, rate limit testing)
- [ ] Cache hit/miss testing
- [ ] Error handling testing (retry logic, timeouts)

---

## Cost Tracking

| Service | Calls/Audit | Cost/Call | Cost/Audit | Annual Cost (500K audits) |
|---------|-------------|-----------|------------|---------------------------|
| SimilarWeb | 14 | $0.05 | $0.70 | $350K |
| BuiltWith | 7 | $0.10 | $0.70 | $350K |
| Yahoo Finance | 5 | $0 | $0 | $0 |
| SEC Edgar | 3 | $0 | $0 | $0 |
| JSearch | 2 | $0.001 | $0.002 | $1K |
| **Total** | **31** | - | **$1.40** | **$701K** |

**With 86% cache hit rate**: $701K × 14% = **$98K/year**

---

## Next Steps

1. **Week 0**: Review this spec, clarify any unclear endpoints
2. **Week 1**: Implement `HttpClient` + 1 client (SimilarWeb) + tests
3. **Week 2**: Implement remaining 4 clients + integration tests
4. **Week 3**: Move to service layer (EnrichmentService orchestration)

---

**Last Updated**: March 6, 2026
**Status**: Ready for implementation
**Owner**: Dashboard Builder Team
