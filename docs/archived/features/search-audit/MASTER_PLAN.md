# Algolia Search Audit Dashboard - Master Plan

**Version**: 2.1
**Date**: March 6, 2026
**Status**: ✅ Architecture Approved - Ready for Implementation
**Owner**: Dashboard Builder Team
**Architecture**: Direct APIs with aggressive caching (7-day TTL)

---

## Quick Navigation

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Architecture: Direct APIs + Caching](#3-architecture-direct-apis--caching) ✅ **APPROVED**
4. [Database Architecture](#4-database-architecture)
5. [User Interface](#5-user-interface)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Critical Issues to Resolve](#7-critical-issues-to-resolve)
8. [Success Metrics](#8-success-metrics)

---

## 1. Executive Summary

### The Transformation

**From**: CLI tool requiring technical expertise
- 5 users (technical)
- 10-15 audits/year
- 40 hours per audit (manual work)
- $2,000 cost per audit (labor)

**To**: Self-service SaaS platform
- 200+ users (all GTM roles)
- 500+ audits/year
- 35 minutes per audit (automated)
- $12 cost per audit (compute)

**Impact**: **33x more audits**, **98% time reduction**, **99% cost savings**

---

### What It Does

**Input**: Prospect domain (e.g., `costco.com`)

**Processing**: 5-phase automated pipeline
1. **Phase 1**: Pre-audit research (14 steps, 12 agents in 4 waves) - SimilarWeb, BuiltWith, Yahoo Finance, SEC filings
2. **Phase 2**: Browser testing (20 UX tests with screenshots)
3. **Phase 3**: Scoring (10 dimensions, severity-weighted)
4. **Phase 4**: Report generation (strategic intelligence, findings, ROI)
5. **Phase 5**: Deliverables (PDF book, AE brief, signal brief)

**Output**: 3 production-ready deliverables in 35 minutes

---

### Business Case

| Metric | Current | Target | ROI |
|--------|---------|--------|-----|
| Audits/Year | 10-15 | 500+ | 33x increase |
| User Base | 5 technical | 200+ GTM | 40x expansion |
| Pipeline Value | $2M/year | $75M/year | 37x increase |
| Cost per Audit | $2,000 | $12 | 99% reduction |

**Payback Period**: 4 months (assumes 50 audits in Month 1, ramp to 500/year)

---

## 2. Product Vision

### The 4 User Personas

#### 1. Marketing Manager (Primary) - "Sarah"
**Goal**: Generate polished audit PDFs for ABM campaigns without CLI knowledge

**Journey**:
1. Click "+ New Audit" → enter `costco.com`
2. Select "Full Audit" (default)
3. Click "Launch"
4. Receive email 35 minutes later: "Your Costco audit is ready"
5. Download 47-page PDF book, share with AE

**Success Metric**: 2-click audit start, email delivery, brand-compliant PDF

---

#### 2. Account Executive (Secondary) - "Marcus"
**Goal**: Quick pre-call research, customize test queries, get AE brief

**Journey**:
1. Before discovery call: Run "Research Only" mode (Phase 1 only)
2. 10 minutes later: View company profile, tech stack, traffic trends
3. Edit test queries to match prospect's product catalog
4. Run full audit after call
5. Download AE brief (5 pages, talking points)

**Success Metric**: Phase 1 in 10 minutes, editable queries, AE brief format

---

#### 3. Partner Marketing (Advanced) - "Priya"
**Goal**: Batch process 10+ prospects, identify displacement opportunities, aggregate insights

**Journey**:
1. Upload CSV of 50 target domains (Adobe AEM customers)
2. Queue batch overnight
3. Morning: View "Library" with 50 completed audits
4. Filter by "Competitor = Elastic" (displacement opportunities)
5. Export competitor matrix for partner enablement deck

**Success Metric**: Batch mode, filtering, CSV export

---

#### 4. Sales Engineer (Power User) - "Jordan"
**Goal**: Deep competitive intel, customize scoring, debug failures

**Journey**:
1. Run Phase 1, pause before Phase 2
2. View research data (10 modules)
3. Edit test queries table (add 5 custom queries)
4. Override scoring weights for retail vertical
5. Resume audit from Phase 2
6. View execution logs if something fails

**Success Metric**: Pause/edit/resume, execution logs access

---

### Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Audit Creation Wizard** | 4-step flow (domain → phases → queries → launch) | MUST |
| **Real-Time Execution Monitor** | Live progress bars, log streaming, screenshot gallery | MUST |
| **Audit Details View** | 5 tabs (Overview, Research, Tests, Deliverables, Settings) | MUST |
| **Dashboard & Library** | Recent audits, status filters, search | MUST |
| **Batch Mode** | CSV upload for 10+ domains | SHOULD |
| **Fact-Check Validation** | 7-dimension quality verification | SHOULD |
| **Pause/Edit/Resume** | Mid-audit editing and phase retry | COULD |

---

## 3. Architecture Decision: APIs vs MCP 🚨

### The Critical Question

**Current CLI skill uses MCP servers** (Model Context Protocol):
- One "SimilarWeb MCP call" → bundles 14 individual API requests
- MCP handles retry logic, rate limiting, error handling
- Works great for CLI (single user, occasional use)

**For enterprise SaaS with 1000 users, which backend?**

---

### Option A: Keep MCP Architecture

**How it works**:
```
Frontend → Node.js Backend → MCP Adapter Layer → MCP Servers → APIs
          (BullMQ jobs)      (server-side)        (SimilarWeb MCP,
                                                   BuiltWith MCP,
                                                   Chrome MCP, etc.)
```

**Pros**:
- ✅ Reuse battle-tested CLI skill logic (2 weeks to implement)
- ✅ MCP handles complexity (retries, rate limits, error bundling)
- ✅ Faster time to market (MVP in 8 weeks)

**Cons**:
- ❌ MCP servers **NOT designed for production scale** (1000 users)
- ❌ Black box - can't optimize individual API calls
- ❌ No caching layer (every audit = 17 fresh SimilarWeb calls)
- ❌ Single point of failure (MCP server down = all audits blocked)
- ❌ Poor observability (can't track latency per endpoint)
- ❌ Vendor lock-in to MCP infrastructure
- ❌ Connection pooling unclear (can we sustain 50 concurrent MCP connections?)

**Scale Analysis**:
- 1000 users × 500 audits/year = 500,000 audits/year
- 500K audits × 17 SimilarWeb calls = **8.5M API calls/year**
- MCP not built for this volume

---

### Option B: Direct API Integration (RECOMMENDED)

**How it works**:
```
Frontend → Node.js Backend → API Client Layer → Direct APIs
          (BullMQ jobs)      (custom clients)    (SimilarWeb API,
                                                  BuiltWith API,
                                                  Yahoo Finance, etc.)
```

**Pros**:
- ✅ **Production-grade**: Full control over every API call
- ✅ **Caching**: Cache SimilarWeb data 24hr (95% hit rate for popular companies)
- ✅ **Performance**: Parallel calls, batching, optimization
- ✅ **Reliability**: Graceful degradation (one API down ≠ full audit failure)
- ✅ **Observability**: Track latency/errors per endpoint (Datadog/CloudWatch)
- ✅ **Cost optimization**: Skip redundant calls, aggressive caching
- ✅ **Scalability**: Horizontal scaling, load balancing
- ✅ **No vendor lock-in**: Own the integrations

**Cons**:
- ❌ More upfront work (4-6 weeks to build API clients)
- ❌ Must implement retry/rate-limit logic ourselves
- ❌ More code to maintain

**Scale Analysis**:
- With caching: 8.5M calls → **850K actual API calls** (10x reduction)
- Cost savings: SimilarWeb charges per call (huge savings)
- Reliability: 99.9% uptime achievable (vs MCP unknown SLA)

---

### Recommendation: **Option B (Direct APIs)**

**Why**:

1. **Scale**: 500K audits/year requires production infrastructure
2. **Cost**: Caching reduces API costs by 90%
3. **Reliability**: 99.9% uptime SLA (MCP can't guarantee this)
4. **Observability**: Enterprise monitoring requirements
5. **Future-proofing**: Can swap vendors (SimilarWeb → Semrush)

**Investment**: 6 weeks vs 2 weeks (4-week delta)
**ROI**: System scales to 1M+ audits/year vs MCP ceiling at ~10K/year

---

### Implementation Strategy (Option B)

**Week 1-2: API Client Layer**
```typescript
// Professional API clients with retry, caching, rate limiting
class SimilarWebClient {
  private cache: RedisCache;
  private rateLimiter: RateLimiter;

  async getTrafficData(domain: string, dates: DateRange): Promise<TrafficData> {
    // Check cache first (24hr TTL)
    const cached = await this.cache.get(`traffic:${domain}`);
    if (cached) return cached;

    // Rate limit: 10 req/sec
    await this.rateLimiter.acquire();

    // Direct API call with retry (exponential backoff)
    const data = await this.httpClient.get('/total-traffic-and-engagement', {
      domain,
      start_date: dates.start,
      end_date: dates.end,
      retry: { attempts: 3, backoff: 'exponential' }
    });

    // Cache result
    await this.cache.set(`traffic:${domain}`, data, 86400);
    return data;
  }

  // ... 13 more methods for other SimilarWeb endpoints
}

class BuiltWithClient { ... }
class YahooFinanceClient { ... }
class SecEdgarClient { ... }
```

**Week 3-4: Service Layer**
```typescript
class EnrichmentService {
  constructor(
    private similarWeb: SimilarWebClient,
    private builtWith: BuiltWithClient,
    private yahooFinance: YahooFinanceClient
  ) {}

  async enrichCompany(domain: string): Promise<CompanyData> {
    // Orchestrate 30+ API calls with smart parallelization
    const [traffic, techStack, financial] = await Promise.all([
      this.similarWeb.getTrafficData(domain),
      this.builtWith.getTechStack(domain),
      this.yahooFinance.getFinancials(await this.resolveTicker(domain))
    ]);

    // Track API usage for cost monitoring
    await this.metrics.incrementCounter('similarweb_api_calls', 14);
    await this.metrics.incrementCounter('builtwith_api_calls', 7);

    return { traffic, techStack, financial };
  }
}
```

**Week 5-6: Testing & Optimization**
- Load testing (100 concurrent audits)
- Cache tuning (find optimal TTLs)
- Rate limit calibration
- Error handling scenarios

---

### Hybrid Approach (Compromise)

If 6 weeks is too long:

**Phase 1 (MVP)**: Use MCP for speed (2 weeks)
- Deploy MVP with MCP in 8 weeks total
- Support 50-100 audits (early adopters)

**Phase 2 (Scale)**: Migrate to direct APIs (4 weeks, parallel with MVP testing)
- Migrate one service at a time (SimilarWeb first, then BuiltWith, etc.)
- A/B test performance (MCP vs direct)
- Roll out to 1000 users once direct APIs proven

**Timeline**: MVP at Week 8, Scale at Week 12

---

## 4. Database Architecture

### Core Principle: Time-Series Snapshots

**Companies** are lightweight entities (name, domain, industry)
**Audits** are point-in-time snapshots (all data lives here)

```
Company: Costco
  ├─ Audit #1 (June 2025)      ← Snapshot T1
  │   ├─ Traffic: 2.5M visits
  │   ├─ Revenue: $254B
  │   └─ Score: 4.2/10
  │
  ├─ Audit #2 (Dec 2025)       ← Snapshot T2
  │   ├─ Traffic: 3.1M (+24% 📈 BUYING SIGNAL)
  │   ├─ Revenue: $268B (+5.5%)
  │   └─ Score: 4.4/10
  │
  └─ Audit #3 (June 2026)      ← Snapshot T3
      ├─ Traffic: 3.3M (+6.5%)
      ├─ Revenue: $275B (+2.6%)
      └─ Hiring: 8 roles (-71% 🚨 CONTRACTION)
```

**Benefit**: Track changes over time, identify buying signals

---

### Database Schema

#### Core Tables (3)

**1. companies**
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  industry_id INTEGER REFERENCES industries(id),  -- 30 industries (reused from algolia-arian)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. audits** (the heavy table - stores everything)
```sql
CREATE TABLE audits (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  status VARCHAR(20),  -- pending, running, completed, failed, factchecking

  -- Phase 1 Research Data (JSONB for flexibility)
  traffic_data JSONB,              -- SimilarWeb: visits, bounce rate, sources, geo
  tech_stack JSONB,                -- BuiltWith: search provider, ecommerce, CMS, analytics
  financial_data JSONB,            -- Yahoo Finance: 3-year revenue, EBITDA, margins
  competitor_data JSONB,           -- Competitors list with domains, search providers
  hiring_signals JSONB,            -- Job postings, open roles, buying committee
  executive_data JSONB,            -- C-suite profiles (CEO, CFO, CTO)
  investor_intelligence JSONB,     -- Quotes from earnings calls, 10-K/10-Q

  -- 🔴 NEW: Source citations (every data point hyperlinked)
  source_citations JSONB,          -- { "traffic_data": [{"claim": "100M visits", "source_url": "...", "fetched_at": "..."}] }
  data_freshness JSONB,            -- { "traffic_data": "2025-02-15", "tech_stack": "2025-02-15" } (12-month max)

  -- Phase 2 Browser Testing
  browser_test_results JSONB,      -- 20 test steps with findings
  screenshots JSONB,               -- Array of { filename, s3_url, test_step, description }

  -- Phase 3 Scoring
  audit_score JSONB,               -- { "overall": 4.4, "areas": [{"name": "Search UX", "score": 3.2, "severity": "HIGH"}] }

  -- Phase 4-5 Deliverables
  report_markdown TEXT,            -- Full report markdown
  report_pdf_url TEXT,             -- S3/Vercel Blob URL for PDF book
  ae_brief_url TEXT,               -- AE brief (5 pages)
  signal_brief_url TEXT,           -- Strategic signals (1 page)

  -- 🔴 NEW: Fact-check validation
  factcheck_score DECIMAL(4,2),   -- 0.00-10.00 confidence
  factcheck_report_url TEXT,
  factcheck_completed_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  runtime_seconds INTEGER,
  error_message TEXT,

  -- Enrichment fields
  ticker VARCHAR(10),              -- Stock ticker (for Yahoo Finance)
  margin_zone VARCHAR(10),         -- red/yellow/green
  vertical_matched VARCHAR(50)     -- retail, saas, healthcare, etc.
);

CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_company ON audits(company_id);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX idx_audits_score ON audits((audit_score->>'overall'));
```

**3. users** (already exists in algolia-arian)
```sql
-- Reuse existing users table
-- No changes needed
```

---

#### Supporting Tables (3)

**4. execution_logs** (for debugging)
```sql
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  phase VARCHAR(20),               -- 'phase_1', 'phase_2', etc.
  step_number INTEGER,
  step_name VARCHAR(100),
  status VARCHAR(20),              -- 'started', 'completed', 'failed'
  message TEXT,
  duration_ms INTEGER,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);
```

**5. api_calls** (for cost tracking & observability)
```sql
CREATE TABLE api_calls (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  service VARCHAR(50),             -- 'similarweb', 'builtwith', 'yahoo_finance', 'sec_edgar'
  endpoint VARCHAR(100),           -- 'get-traffic-data', 'domain-api', etc.
  request_params JSONB,
  response_status INTEGER,         -- 200, 429 (rate limit), 500, etc.
  response_data JSONB,             -- Cache for replay
  cache_hit BOOLEAN,               -- Did we serve from cache?
  latency_ms INTEGER,
  cost_usd DECIMAL(10,4),          -- Track cost per call
  called_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_calls_audit ON api_calls(audit_id);
CREATE INDEX idx_api_calls_service ON api_calls(service, called_at);
```

**6. verification_gates** (quality assurance)
```sql
CREATE TABLE verification_gates (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  gate_number INTEGER,             -- 1-6
  gate_name VARCHAR(50),           -- 'Phase 1 Complete', 'Screenshots Persisted', etc.
  passed BOOLEAN,
  errors JSONB,                    -- [{"check": "screenshot_count", "expected": 10, "actual": 7}]
  checked_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Data Reuse Strategy

**From algolia-arian project** (no need to recreate):
- ✅ `users` table (authentication, roles)
- ✅ `industries` table (30 industries with slugs)
- ✅ `sub_industries` table (hierarchical taxonomy)
- ✅ Row-level security policies
- ✅ REST API auto-generation (Supabase)

**New for Search Audit Dashboard**:
- `companies` table (lightweight)
- `audits` table (heavy, JSONB for flexibility)
- `execution_logs`, `api_calls`, `verification_gates` (supporting)

---

## 5. User Interface

### Screen Hierarchy

```
┌─ Main Navigation ─────────────────────────────────────┐
│  Dashboard │ Library │ Documentation │ Settings       │
└───────────────────────────────────────────────────────┘

1. Dashboard (Home)
   ├─ Recent Audits (grid view)
   ├─ Quick Stats (total, completed, running, failed)
   ├─ "+ New Audit" button (primary CTA)
   └─ Filters (status, team, date)

2. Audit Creation Wizard (Modal - 4 steps)
   ├─ Step 1: Enter Domain
   ├─ Step 2: Select Phases (Full / Research Only / Browser Only)
   ├─ Step 3: Custom Test Queries (optional)
   └─ Step 4: Review & Launch

3. Execution Monitor (Real-Time)
   ├─ Phase Progress Bars (Phase 1: 67% - 8/12 steps)
   ├─ Live Log Stream (scrolling)
   ├─ Screenshot Gallery (as they're captured)
   └─ ETA Countdown

4. Audit Details (5 Tabs)
   ├─ Tab 1: Overview
   │   ├─ Overall Score: 4.4/10
   │   ├─ Critical Gaps: 3
   │   ├─ Opportunity Size: $15M-$30M
   │   └─ Key Findings (top 5)
   │
   ├─ Tab 2: Research Data
   │   ├─ Company Context (revenue, employees, industry)
   │   ├─ Tech Stack (search provider, ecommerce, CMS)
   │   ├─ Traffic Metrics (100M visits, bounce rate, sources)
   │   ├─ Competitors (Elastic, Bloomreach, Constructor)
   │   ├─ Hiring Signals (28 open roles, buying committee)
   │   └─ ... (10 modules total, collapsible)
   │
   ├─ Tab 3: Browser Tests
   │   ├─ Screenshot Gallery (20 images)
   │   ├─ Findings (grouped by severity: HIGH, MEDIUM, LOW)
   │   └─ Filter by test category (Search UX, Facets, Mobile, etc.)
   │
   ├─ Tab 4: Deliverables
   │   ├─ PDF Book (47 pages, 3.8 MB) [Download] [Preview]
   │   ├─ AE Brief (5 pages) [Download]
   │   └─ Signal Brief (1 page) [Download]
   │
   └─ Tab 5: Settings
       ├─ Re-Run Phases (checkboxes: Phase 1, 2, 3, 4, 5)
       ├─ Fact-Check (button: "Run Validation")
       └─ Execution Logs (view full logs)

5. Library (All Audits)
   ├─ Filters (status, company, date range, score, team)
   ├─ Sort (newest, oldest, highest score, lowest score)
   ├─ Bulk Actions (export CSV, delete)
   └─ Grid/List Toggle

6. Admin Dashboard (Power Users)
   ├─ System Health (API status, queue depth, MCP health)
   ├─ Usage Stats (audits/week, API calls, cache hit rate)
   ├─ Cost Tracking (SimilarWeb spend, BuiltWith spend)
   └─ User Activity (who's running audits, team breakdown)
```

---

### Key UI Components (Reusable)

**From algolia-arian** (copy & adapt):
- ✅ `<CompanyCard>` - Display company info with industry badge
- ✅ `<StatusBadge>` - Color-coded status (running, completed, failed)
- ✅ `<FilterHeader>` - Dropdown filters with canonical order
- ✅ `<SortHeader>` - Sortable table headers

**New for Search Audit Dashboard**:
- `<AuditCard>` - Shows audit summary (score, runtime, deliverables)
- `<ProgressBar>` - Real-time phase progress
- `<LogStream>` - Live log viewer with auto-scroll
- `<ScreenshotGallery>` - Thumbnail grid with lightbox
- `<ScoreCard>` - Displays score with color (red <4, yellow 4-6, green >6)

---

### Interactive Prototype

**File**: `dashboard/index-v2.html` (already created)

**What it shows**:
- ✅ 10 fully-styled screens with Algolia branding
- ✅ Navigation between Dashboard → Library → Documentation → Settings
- ✅ Audit creation wizard (4 steps)
- ✅ Execution monitor with progress bars
- ✅ Audit details with 5 tabs

**To view**:
```bash
open "dashboard/index-v2.html"
```

---

## 6. Implementation Roadmap

### Timeline Overview

**Option B (Direct APIs)**: 14 weeks total
- Week 0: Documentation fixes (5 days)
- Week 1-2: API client layer (6 weeks start here)
- Week 3-4: Service layer
- Week 5-6: Testing & optimization
- Week 7-8: Phase 1 orchestrator
- Week 9-10: Phase 2-3 (browser + scoring)
- Week 11-12: Phase 4-5 (deliverables)
- Week 13-14: Testing & polish

**Hybrid Approach**: 12 weeks total
- Week 0: Documentation fixes
- Week 1-8: MVP with MCP
- Week 4-12: Parallel migration to direct APIs (overlap)

---

### Phase-by-Phase Breakdown

#### Week 0: Documentation Fixes (CRITICAL)

**Must create 4 new docs**:
1. `VERIFICATION_GATES.md` - 6 gate specifications
2. `BROWSER_TESTING_RESILIENCE.md` - WAF recovery protocol
3. `AGENT_TEAMS_WAVES.md` - 4-wave orchestration
4. `API_CLIENT_SPECIFICATIONS.md` - 30+ endpoint specs

**Must update 2 docs**:
1. Update this doc (`MASTER_PLAN.md`) with architecture decision
2. Create migration plan from MCP (if hybrid approach)

**Deliverable**: All 5 critical issues from `IMPLEMENTATION_GAPS.md` resolved

---

#### Week 1-2: Foundation

**Database**:
- Create `audits` table migration
- Create `execution_logs`, `api_calls`, `verification_gates` tables
- Set up Supabase REST API endpoints
- Test insert/query performance

**Job Queue**:
- Set up BullMQ + Redis
- Create queue definitions (phase1-wave1, phase1-wave2, etc.)
- Implement job retry logic
- Add job progress tracking

**API Clients** (if Option B):
- SimilarWeb client (14 methods)
- BuiltWith client (7 methods)
- Yahoo Finance client (5 methods)
- SEC EDGAR client (3 methods)

**Deliverable**: Can insert audit, queue job, query status

---

#### Week 3-4: Phase 1 Orchestrator

**Wave Coordinator**:
```typescript
class Phase1Orchestrator {
  async execute(auditId: string) {
    // Wave 1: 4 agents parallel
    await this.runWave1(auditId);  // Company, Tech, Traffic, Competitors
    await this.verifyWave1Complete(auditId);

    // Wave 2: 5 agents parallel
    await this.runWave2(auditId);  // Queries, Competitor Search, Angles, Hiring, Financial
    await this.verifyWave2Complete(auditId);

    // Wave 3: 2 agents parallel
    await this.runWave3(auditId);  // Investor Intel, Deep Hiring
    await this.verifyWave3Complete(auditId);

    // Wave 4: Sequential
    await this.runWave4(auditId);  // ICP Mapping

    // Gate 1: Verify Phase 1 complete
    const gate1 = await this.verifyGate1(auditId);
    if (!gate1.passed) throw new Error('Gate 1 failed');
  }
}
```

**Enrichment Services**:
- Orchestrate 30+ API calls
- Cache responses (24hr TTL)
- Handle API errors gracefully
- Track API usage for cost monitoring

**Deliverable**: Phase 1 completes in 14 minutes, Gate 1 passes

---

#### Week 5-6: Phase 2 (Browser Testing)

**Chrome Integration**:
- Connect to Chrome via Puppeteer
- Implement WAF detection
- Add human-like delays
- CAPTCHA user intervention flow

**20 Test Steps**:
- Homepage search test
- Typo tolerance
- Semantic search
- Federated search
- Mobile UX
- Facets & filters
- Empty state
- Product recommendations
- (12 more tests)

**Screenshot Persistence**:
- Capture screenshots
- Upload to S3/Vercel Blob
- Save URLs to `audits.screenshots` JSONB
- Gate 2: Verify ≥10 screenshots

**Deliverable**: Phase 2 completes in 15 minutes, screenshots persisted

---

#### Week 7-8: Phase 3-4 (Scoring + Report)

**Phase 3: Scoring**:
- 10 scoring dimensions (Search UX, Facets, Mobile, etc.)
- Severity weighting (HIGH=2x, MEDIUM=1x, LOW=0.5x)
- Overall score calculation
- Gate 3: Verify all 10 areas scored

**Phase 4: Report Generation**:
- Assemble markdown report (18 sections)
- Strategic intelligence
- Executive quotes ("In Their Own Words")
- Findings with screenshot references
- ROI estimates
- Gate 4: Verify report complete (no placeholders)
- Gate 4.5: Data freshness verification

**Deliverable**: Phase 3-4 complete in 5 minutes, report generated

---

#### Week 9-10: Phase 5 (Deliverables)

**6 Sub-Phases** (incremental HTML generation):
- 5a-1: Cover + Act I (chapters 1-4)
- 5a-2: Act II (chapters 5-13)
- 5a-3: Act III (chapters 14-18)
- 5a-4: Act IV (chapters 19-22)
- 5a-5: Appendices A-F
- 5a-6: Final verification (Gate 5)

**PDF Generation**:
- HTML → PDF via Puppeteer
- 30-50 pages, Algolia-branded
- Upload to S3/Vercel Blob

**AE Brief + Signal Brief**:
- Generate markdown versions
- Save to storage

**Deliverable**: Phase 5 complete in 10 minutes, 3 deliverables ready

---

#### Week 11-12: Frontend

**Dashboard Page**:
- Recent audits grid
- Status filters
- "+ New Audit" modal wizard

**Execution Monitor**:
- Real-time progress (WebSocket)
- Live log stream
- Screenshot gallery updates

**Audit Details**:
- 5-tab layout
- PDF viewer (Tab 4)
- Re-run phases (Tab 5)

**Deliverable**: Full UI functional, end-to-end audit works

---

#### Week 13-14: Testing & Polish

**Load Testing**:
- 50 concurrent audits
- Measure: API latency, cache hit rate, queue depth

**Bug Fixes**:
- Fix edge cases
- Improve error messages
- Add retry logic

**Documentation**:
- User guide
- Admin guide
- API documentation

**Deliverable**: Production-ready system

---

## 7. Critical Issues to Resolve

### 🔴 BLOCKER #1: Architecture Decision (APIs vs MCP)

**Status**: Awaiting stakeholder decision

**Options**:
- **A**: Direct APIs (6 weeks, scales to 1M audits/year) - **RECOMMENDED**
- **B**: MCP (2 weeks, ceiling at 10K audits/year)
- **C**: Hybrid (8 weeks MVP + 4 weeks migration = 12 weeks total)

**Decision needed by**: End of Week 0

---

### 🔴 BLOCKER #2: Browser Testing with Chrome MCP

**Status**: Technical requirement confirmed

**Decision**: Use Chrome MCP with real browser (not headless Playwright)

**Reason**: 80% of enterprise e-commerce sites use WAF (Cloudflare, Akamai). Headless browsers get blocked.

**Implementation**: Week 5-6 (Phase 2)

---

### 🔴 BLOCKER #3: Verification Gates

**Status**: Must document before building orchestrator

**Requirements**:
- Create `VERIFICATION_GATES.md` with 6 gate specifications
- Implement gate checks in orchestrator
- Add `verification_gates` table to database

**Implementation**: Week 3-4 (Phase 1 orchestrator)

---

### 🟡 HIGH #4: Agent Teams Wave Structure

**Status**: Needs architecture design

**Question**: Can we use Claude Agent Teams in production API?

**Options**:
- **A**: Use Agent Teams (14-min Phase 1 runtime)
- **B**: Sequential agents (40-min Phase 1 runtime but simpler)

**Decision needed by**: Week 3 (before Phase 1 orchestrator)

---

### 🟡 HIGH #5: Phase 5 Incremental Generation

**Status**: Documented, needs implementation

**Requirements**:
- 6 sub-phases with incremental HTML saves
- Chapter count verification after each sub-phase
- Gate 5 final verification

**Implementation**: Week 9-10 (Phase 5)

---

### 🟢 MEDIUM: Missing Database Fields

**Status**: Easy fix

**Action**: Add 5 fields to `audits` table:
- `ticker` (VARCHAR)
- `margin_zone` (VARCHAR)
- `vertical_matched` (VARCHAR)
- `case_study_primary` (VARCHAR)
- `data_quality_metadata` (JSONB)

**Implementation**: Week 1 (database migrations)

---

## 8. Success Metrics

### MVP Success (Month 4)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Audits Completed** | 50 | Database count |
| **Completion Rate** | 90% | (completed / total) × 100 |
| **Avg. Runtime** | <40 min | p50 from `audits.runtime_seconds` |
| **Error Rate** | <5% | (failed / total) × 100 |
| **User Satisfaction** | NPS 40+ | Post-audit survey |
| **Brand Compliance** | 8.0/10 avg | Manual review of PDFs |

---

### Scale Success (Month 8)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Audits/Month** | 42+ | (500/year ÷ 12) |
| **Active Users** | 50+ | Unique users running audits |
| **Completion Rate** | 95% | (completed / total) × 100 |
| **Avg. Runtime** | <35 min | p50 runtime |
| **API Cache Hit Rate** | 85%+ | (cached / total_calls) × 100 |
| **Cost per Audit** | <$15 | Total API costs ÷ audits |
| **User Satisfaction** | NPS 50+ | Quarterly survey |

---

### Business Impact (Year 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Pipeline Influenced** | $50M+ | CRM attribution |
| **Deals Closed** | 25+ | Audits → closed-won |
| **Average Deal Size** | $150K | Revenue from audit-influenced deals |
| **ROI** | 10x | (Pipeline value ÷ development cost) |

---

## Appendix A: Files Reference

### Keep These (Essential)

1. **`MASTER_PLAN.md`** (this file) - Central source of truth
2. **`index-v2.html`** - Interactive prototype
3. **`IMPLEMENTATION_GAPS.md`** - Critical issues (archive after resolution)

### Archive These (Outdated/Redundant)

Move to `_archive/` folder:
- `PRD_CONSOLIDATED.md` (consolidated into MASTER_PLAN)
- `DATABASE_SCHEMA_V2.md` (obsolete, V5 is current)
- `DATABASE_SCHEMA_V3.md` (obsolete)
- `DATABASE_SCHEMA_SAAS.md` (consolidated into MASTER_PLAN)
- `IMPLEMENTATION_PLAN.md` (consolidated into MASTER_PLAN)
- `IMPLEMENTATION_GUIDE.md` (redundant)
- `FEATURE_INVENTORY.md` (too granular, consolidated)
- `SAAS_ARCHITECTURE.md` (outdated MCP assumptions)
- `UPDATE_SUMMARY.md` (historical, no longer needed)
- `VALIDATION_REPORT.md` (issues captured in IMPLEMENTATION_GAPS)
- `EXECUTIVE_SUMMARY.md` (consolidated into MASTER_PLAN)
- `STUDY_SUMMARY.md` (temporary, superseded by MASTER_PLAN)
- `audit-dashboard-ux-research.md` (consolidated)
- `architecture-diagram.md` (can keep if Mermaid diagrams useful)
- `ux-flow-diagrams.md` (can keep if Mermaid diagrams useful)

### Create These (Week 0)

1. **`VERIFICATION_GATES.md`** - 6 gate specifications
2. **`BROWSER_TESTING_RESILIENCE.md`** - WAF recovery protocol
3. **`AGENT_TEAMS_WAVES.md`** - 4-wave orchestration
4. **`API_CLIENT_SPECIFICATIONS.md`** - 30+ endpoint specs (if Option B)

---

## Appendix B: Decision Log

| Date | Decision | Rationale | Owner |
|------|----------|-----------|-------|
| 2026-03-06 | Consolidated documentation into MASTER_PLAN.md | Too many scattered docs (20+ files) | Dashboard Builder |
| 2026-03-06 | Recommended Option B (Direct APIs) | Scales to 1M audits/year, 90% cost reduction via caching | Dashboard Builder |
| TBD | Final architecture decision | Awaiting stakeholder input | Product Team |
| TBD | Agent Teams production usage | Awaiting Claude API capability confirmation | Engineering |
| TBD | Chrome MCP vs Playwright | Technical requirement (WAF resilience) | Engineering |

---

**Last Updated**: March 6, 2026
**Next Review**: After architecture decision meeting
**Owner**: Dashboard Builder Team
