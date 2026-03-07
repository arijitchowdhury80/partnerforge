# Architecture Decision - APPROVED

**Date**: March 6, 2026
**Decision Maker**: Product/Engineering Leadership
**Status**: ✅ FINAL

---

## Decision: Direct API Integration with Aggressive Caching

### Architecture Choice

**Selected**: **Option B - Direct APIs** (NOT MCP)

**Rationale**:
1. Scales to 1M+ audits/year (vs MCP ceiling at 10K/year)
2. 90%+ cost reduction via caching
3. Full observability and control
4. 99.9% uptime achievable
5. No vendor lock-in

---

## Caching Strategy

### Cache Tiers

| Data Type | Cache TTL | Rationale |
|-----------|-----------|-----------|
| **Traffic Data** | 7 days | Changes slowly, expensive API ($0.05/call) |
| **Tech Stack** | 7 days | Rarely changes, cheap to store |
| **Financial Data** | 7 days | Quarterly updates, stable |
| **Competitor Data** | 7 days | Market moves slowly |
| **Hiring Signals** | 24 hours | Job postings change daily |
| **Executive Data** | 7 days | C-suite profiles stable |
| **Investor Intel** | 7 days | Quarterly earnings, SEC filings |

### Cache Invalidation

**Manual Refresh**:
- User can click "Refresh Data" button
- Bypasses cache, fetches fresh data
- Updates cache with new TTL

**Auto-Refresh**:
- Run nightly job to pre-warm cache for top 500 companies
- Keeps popular domains fresh without user wait

---

## Database Persistence

### What Gets Persisted

**EVERYTHING gets saved to PostgreSQL** (via Supabase):

1. **Raw API Responses** → `api_calls` table
   - Full request/response for debugging
   - Enables replay without re-calling APIs
   - Cost tracking per endpoint

2. **Enriched Company Data** → `audits` table (JSONB columns)
   - `traffic_data` JSONB
   - `tech_stack` JSONB
   - `financial_data` JSONB
   - `competitor_data` JSONB
   - `hiring_signals` JSONB
   - `executive_data` JSONB
   - `investor_intelligence` JSONB

3. **Source Citations** → `audits.source_citations` JSONB
   - Every data point hyperlinked to source
   - API call timestamp
   - Data freshness tracking

4. **Browser Test Results** → `audits.browser_test_results` JSONB
   - All 20 test steps
   - Screenshot URLs (S3/Vercel Blob)

5. **Generated Deliverables** → File storage URLs
   - PDF book → S3/Vercel Blob → `audits.report_pdf_url`
   - AE brief → `audits.ae_brief_url`
   - Signal brief → `audits.signal_brief_url`

---

## Data Flow Architecture

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ POST /audits (domain)
       ▼
┌─────────────────────────────────────────────────┐
│            Node.js Backend (Express)             │
│  ┌──────────────────────────────────────────┐  │
│  │        BullMQ Job Queue (Redis)          │  │
│  │  - phase1-wave1-queue                     │  │
│  │  - phase1-wave2-queue                     │  │
│  │  - phase2-browser-queue                   │  │
│  │  - phase3-scoring-queue                   │  │
│  │  - phase4-report-queue                    │  │
│  │  - phase5-deliverables-queue             │  │
│  └──────────────────────────────────────────┘  │
└────────┬────────────────────────────────────────┘
         │
         │ Check Cache
         ▼
┌─────────────────────────────────────────────────┐
│           Redis Cache (7-day TTL)               │
│  Keys: traffic:{domain}, techstack:{domain}     │
└────────┬────────────────────────────────────────┘
         │
         │ Cache MISS?
         ▼
┌─────────────────────────────────────────────────┐
│        API Client Layer (TypeScript)             │
│  ┌──────────────────────────────────────────┐  │
│  │  SimilarWebClient (14 methods)           │  │
│  │  - getTrafficData()                       │  │
│  │  - getEngagementMetrics()                 │  │
│  │  - getTrafficSources()                    │  │
│  │  - getGeography()                         │  │
│  │  - ... (10 more)                          │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  BuiltWithClient (7 methods)             │  │
│  │  - getTechStack()                         │  │
│  │  - getRelationships()                     │  │
│  │  - ... (5 more)                           │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  YahooFinanceClient (5 methods)          │  │
│  │  SecEdgarClient (3 methods)              │  │
│  │  JSearchClient (2 methods)               │  │
│  └──────────────────────────────────────────┘  │
└────────┬────────────────────────────────────────┘
         │
         │ Direct HTTPS calls with retry
         ▼
┌─────────────────────────────────────────────────┐
│          External APIs                           │
│  - SimilarWeb API (api.similarweb.com)          │
│  - BuiltWith API (api.builtwith.com)            │
│  - Yahoo Finance API                             │
│  - SEC Edgar API (sec.gov)                      │
│  - JSearch API (job postings)                   │
└─────────────────────────────────────────────────┘
         │
         │ Response
         ▼
┌─────────────────────────────────────────────────┐
│  1. Cache response (Redis, 7-day TTL)           │
│  2. Save to database (PostgreSQL via Supabase)  │
│  3. Return to job worker                        │
└─────────────────────────────────────────────────┘
```

---

## Technology Stack (Final)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + TypeScript + Mantine UI | User interface |
| **Backend** | Node.js + Express | API server |
| **Job Queue** | BullMQ + Redis | Background job processing |
| **Cache** | Redis (7-day TTL) | API response caching |
| **Database** | PostgreSQL (Supabase) | Persistent storage |
| **File Storage** | Vercel Blob or S3 | PDFs, screenshots |
| **Real-Time** | Socket.IO | Live progress updates |
| **Browser** | Puppeteer + Chrome | Phase 2 testing |

---

## API Client Design Principles

### 1. Separation of Concerns

```typescript
// Low-level HTTP client (handles retries, rate limits)
class HttpClient {
  async get(url: string, options: RequestOptions): Promise<Response> {
    // Exponential backoff retry logic
    // Rate limiting (10 req/sec for SimilarWeb)
    // Error handling
  }
}

// Domain-specific API client
class SimilarWebClient {
  constructor(private http: HttpClient, private cache: RedisCache) {}

  async getTrafficData(domain: string): Promise<TrafficData> {
    // Check cache first
    // Call API if needed
    // Transform response to typed interface
  }
}

// High-level service (orchestrates multiple clients)
class EnrichmentService {
  constructor(
    private similarWeb: SimilarWebClient,
    private builtWith: BuiltWithClient
  ) {}

  async enrichCompany(domain: string): Promise<CompanyData> {
    // Parallel API calls
    // Combine results
    // Save to database
  }
}
```

---

### 2. Cache-First Strategy

```typescript
async getTrafficData(domain: string): Promise<TrafficData> {
  // 1. Check cache
  const cacheKey = `traffic:${domain}`;
  const cached = await this.cache.get(cacheKey);
  if (cached) {
    await this.metrics.incrementCounter('cache_hits', { service: 'similarweb' });
    return JSON.parse(cached);
  }

  // 2. Cache miss - call API
  await this.metrics.incrementCounter('cache_misses', { service: 'similarweb' });
  const data = await this.http.get('/total-traffic-and-engagement', {
    domain,
    start_date: '2025-12',
    end_date: '2025-12'
  });

  // 3. Save to cache (7-day TTL)
  await this.cache.set(cacheKey, JSON.stringify(data), 604800); // 7 days in seconds

  // 4. Save to database (for persistence)
  await this.db.saveAPICall({
    service: 'similarweb',
    endpoint: 'get-traffic-data',
    domain,
    response: data,
    cached: false,
    cost_usd: 0.05
  });

  return data;
}
```

---

### 3. Database Persistence Pattern

```typescript
// After every API call, save to database
async saveAPICall(call: APICall): Promise<void> {
  await supabase.from('api_calls').insert({
    audit_id: call.auditId,
    service: call.service,
    endpoint: call.endpoint,
    request_params: call.requestParams,
    response_data: call.responseData,
    cache_hit: call.cacheHit,
    latency_ms: call.latencyMs,
    cost_usd: call.costUsd,
    called_at: new Date()
  });
}

// When audit completes, aggregate all data into audits table
async saveAuditData(auditId: string): Promise<void> {
  // Get all API responses for this audit
  const apiCalls = await supabase
    .from('api_calls')
    .select('*')
    .eq('audit_id', auditId);

  // Aggregate into structured JSONB
  const trafficData = apiCalls
    .filter(c => c.service === 'similarweb')
    .map(c => c.response_data);

  const techStack = apiCalls
    .filter(c => c.service === 'builtwith')
    .map(c => c.response_data);

  // Save to audits table
  await supabase
    .from('audits')
    .update({
      traffic_data: aggregateTrafficData(trafficData),
      tech_stack: aggregateTechStack(techStack),
      updated_at: new Date()
    })
    .eq('id', auditId);
}
```

---

## Cost Analysis (with 7-Day Caching)

### Assumptions
- 500,000 audits/year
- 17 API calls per audit (SimilarWeb, BuiltWith, Yahoo Finance)
- 7-day cache TTL
- Top 500 companies = 80% of audits (Pareto principle)

### Without Caching
- Total API calls: 500K audits × 17 calls = **8.5M calls/year**
- Cost: 8.5M × $0.03 avg = **$255K/year**

### With 7-Day Caching
- Cache hit rate for popular companies: 95% (500 companies audited multiple times/week)
- Cache hit rate for long-tail companies: 50% (audited once, cache expires)
- Weighted cache hit rate: (80% × 95%) + (20% × 50%) = **86% overall**
- Actual API calls: 8.5M × 14% = **1.19M calls/year**
- Cost: 1.19M × $0.03 = **$35.7K/year**

**Savings**: $255K - $35.7K = **$219.3K/year** (86% reduction)

---

## Implementation Timeline

**With Direct APIs + Caching**: 12 weeks total

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1-2 | API Client Layer | SimilarWeb, BuiltWith, Yahoo Finance clients with caching |
| 3-4 | Service Layer | Enrichment service, database persistence |
| 5-6 | Phase 1 Orchestrator | 4-wave agent coordination |
| 7-8 | Phase 2 Browser Testing | Puppeteer integration, screenshot capture |
| 9-10 | Phase 3-4 Scoring + Report | Scoring engine, report generator |
| 11-12 | Phase 5 + Frontend | PDF generation, React UI, WebSocket |

---

## Next Steps (Week 1)

### Immediate Actions

1. **Set up Redis** (for caching)
   - Provision Redis instance (AWS ElastiCache or Upstash)
   - Configure 7-day TTL default
   - Test cache read/write

2. **Create API client specs** (detailed)
   - SimilarWeb: 14 endpoints
   - BuiltWith: 7 endpoints
   - Yahoo Finance: 5 endpoints
   - SEC Edgar: 3 endpoints

3. **Database migrations**
   - Create `api_calls` table (for persistence)
   - Update `audits` table with JSONB columns
   - Add indexes for performance

4. **Set up monitoring**
   - Cache hit rate dashboard
   - API cost tracking
   - Latency metrics per endpoint

---

## Decision Rationale Summary

**Why Direct APIs?**
- Scales to 1M+ audits/year (MCP ceiling ~10K)
- Full control over caching and optimization
- 99.9% uptime achievable (vs MCP unknown SLA)
- No vendor lock-in

**Why 7-Day Cache?**
- Traffic/tech/financial data changes slowly (quarterly)
- 86% cache hit rate = $219K/year savings
- Manual refresh available for time-sensitive audits
- Nightly pre-warm for top 500 companies

**Why Full Database Persistence?**
- Enables historical analysis (trend tracking)
- Audit replay without re-calling APIs
- Cost attribution per team/user
- Debugging (see exact API responses)

---

**Status**: ✅ APPROVED - Ready for implementation
**Next**: Create detailed API client specifications
**Owner**: Dashboard Builder Team
**Last Updated**: March 6, 2026
