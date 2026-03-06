# Search Audit Dashboard - Implementation Plan

**Status:** Ready to Build (UX Research Complete)
**Timeline:** 8 weeks (47% savings from reusing algolia-arian)
**Database Decision:** ✅ Reuse Supabase schema from algolia-arian with table adaptations
**🔴 NEW REQUIREMENTS:** Source citation tracking + fact-check validation (adds 1.5 weeks)

---

## Executive Summary

We will build on top of the existing `algolia-arian` project infrastructure:
- **Reuse 70%**: Enrichment services, database pattern, API clients, frontend stack
- **Build 30%**: Browser testing, job queue, audit orchestrator, PDF generator, WebSocket
- **Database**: Extend existing Supabase project with new `audits` table (keeps all enrichment logic)

---

## 1. Database Decision ✅

### Decision: Reuse Existing Supabase Schema

**Rationale:**
- ✅ All enrichment JSONB columns already defined (`traffic_data`, `tech_stack`, `financial_data`, etc.)
- ✅ Row-level security policies already set up
- ✅ REST API auto-generated and working
- ✅ No need to recreate 6-source enrichment schema from scratch

**Schema Adaptations Needed:**

```sql
-- NEW TABLE: audits (extends displacement_targets pattern)
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  company_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, running, completed, failed, factchecking

  -- Reuse existing enrichment columns (same as displacement_targets)
  traffic_data JSONB,
  tech_stack JSONB,
  financial_data JSONB,
  competitor_data JSONB,
  hiring_signals JSONB,
  executive_data JSONB,
  investor_intelligence JSONB,

  -- 🔴 NEW: Source citations (MANDATORY FOR EVERY DATA POINT)
  source_citations JSONB,       -- { "traffic_data": [{"claim": "100.9M visits", "source_url": "...", "fetched_at": "..."}], ... }
  data_freshness JSONB,         -- { "traffic_data": "2025-02-15", "tech_stack": "2025-02-15", ... } (12 month max except financials)

  -- NEW: Browser testing results
  browser_test_results JSONB,  -- 20 test steps with screenshots
  audit_score JSONB,            -- 10 scoring areas

  -- NEW: Generated deliverables
  report_url TEXT,              -- S3/Vercel Blob URL for markdown report
  landing_page_url TEXT,        -- URL for HTML landing page
  deck_url TEXT,                -- URL for deck markdown

  -- 🔴 NEW: Fact-check results
  factcheck_score DECIMAL(4,2), -- 0.00-10.00 confidence score
  factcheck_report_url TEXT,    -- URL to factcheck report
  factcheck_corrections JSONB,  -- Corrections that need to be applied
  factcheck_completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Index for status filtering
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX idx_audits_factcheck_score ON audits(factcheck_score DESC);
```

### ⚠️ CRITICAL: Source Citation Requirements

**Every data point MUST have an inline link to its source.**

```jsonb
// Example: source_citations JSONB structure
{
  "traffic_data": [
    {
      "claim": "100.9M monthly visits",
      "value": 100900000,
      "source": "SimilarWeb API",
      "source_url": "https://api.similarweb.com/v1/website/costco.com/total-traffic-and-engagement/desktop_mau_visits?start_date=2025-01&end_date=2025-01",
      "fetched_at": "2025-02-15T14:23:00Z",
      "api_response_hash": "a3f2b91c..." // For validation
    },
    {
      "claim": "37.2% bounce rate",
      "value": 37.2,
      "source": "SimilarWeb API",
      "source_url": "https://api.similarweb.com/v1/website/costco.com/total-traffic-and-engagement/bounce_rate?...",
      "fetched_at": "2025-02-15T14:23:00Z"
    }
  ],
  "financial_data": [
    {
      "claim": "$254.5B revenue (FY2024)",
      "value": 254500000000,
      "source": "Yahoo Finance",
      "source_url": "https://finance.yahoo.com/quote/COST/financials",
      "fetched_at": "2025-02-15T14:25:00Z",
      "fiscal_year": "2024"
    }
  ],
  "investor_quotes": [
    {
      "quote": "We're investing heavily in technology infrastructure",
      "speaker": "Richard Galanti",
      "title": "CFO",
      "source": "Q2 2024 Earnings Call",
      "source_url": "https://investors.costco.com/static-files/...",
      "date": "2024-03-07",
      "transcript_page": 3
    }
  ]
}
```

**Data Freshness Rules:**
- **Traffic data**: ≤12 months old
- **Tech stack**: ≤12 months old
- **Hiring signals**: ≤12 months old
- **Financial data**: Last 3 years (exception to 12-month rule)
- **Investor quotes**: ≤12 months old (unless historical context)

If data is >12 months old (except financials), flag in dashboard UI with ⚠️ "Data may be outdated"

**Migration Strategy:**
1. Keep `displacement_targets` table as-is (for partner intelligence)
2. Add new `audits` table with similar structure
3. Reuse all enrichment service code (just change table name in API calls)

---

## 2. Module Build Sequence

### Phase 1: Foundation (Week 1-1.5)
**Goal:** Project setup + copy reusable components

| Task | Effort | Priority | Dependency |
|------|--------|----------|------------|
| Create new Supabase project OR extend existing | 2h | P0 | None |
| Run database migration (add `audits` table) | 1h | P0 | Supabase ready |
| Copy `frontend/src/services/enrichment/` directory | 2h | P0 | None |
| Copy `frontend/src/services/api.ts` pattern | 1h | P0 | None |
| Set up React frontend boilerplate (Vite + Mantine) | 4h | P0 | None |
| Copy shared UI components (cards, drawers, stats) | 3h | P1 | Frontend ready |

**Deliverable:** Empty dashboard that can fetch from Supabase

---

### Phase 2: New Backend Services (Week 2-6)

#### Week 2-3: Browser Testing Service ⚠️ HARDEST PART
**Goal:** Playwright-based browser automation for Phase 2 (20 test steps)

**Architecture:**
```
Browser Testing Service (Node.js/Deno)
├── Playwright Pool (3 concurrent browsers)
├── Screenshot Storage (Vercel Blob Storage)
├── CAPTCHA Handling (pause + notify user)
└── Progress Streaming (WebSocket events)
```

**Files to Create:**
```
backend/services/browser-testing/
├── browser-pool.ts          # Manages 3 Playwright instances
├── test-executor.ts         # Runs 20 test steps sequentially
├── screenshot-manager.ts    # Uploads to Vercel Blob
├── captcha-handler.ts       # Pauses for user intervention
└── progress-emitter.ts      # Emits WebSocket events
```

**Key Decisions Needed:**
- [ ] **Q1:** Vercel Blob Storage vs S3 for screenshots? (Recommendation: Vercel Blob for simplicity)
- [ ] **Q2:** Run browser tests on Vercel Edge Functions or dedicated server? (Recommendation: Vercel Serverless Functions with 5min timeout)
- [ ] **Q3:** How to handle CAPTCHA? (Recommendation: Emit `captcha_detected` event → pause → user solves → resume)

**Integration Point:**
```typescript
// backend/services/browser-testing/test-executor.ts
import { EnrichmentOrchestrator } from '../../algolia-arian/frontend/src/services/enrichment/orchestrator';

async function runBrowserTests(domain: string, auditId: string) {
  // Step 1-12: Core tests (homepage → mobile)
  const results = await runCoreTests(domain);

  // Step 13-20: Algolia value-prop tests
  const valueTests = await runValueTests(domain);

  // Upload all screenshots
  const screenshotUrls = await uploadScreenshots(results.screenshots);

  return { results, screenshotUrls };
}
```

---

#### Week 4: Job Queue System
**Goal:** BullMQ + Redis for async audit execution

**Architecture:**
```
Job Queue (BullMQ + Upstash Redis)
├── Queue: audit-jobs
├── Worker: processes 1 audit at a time
└── Progress: emits to WebSocket
```

**Files to Create:**
```
backend/services/job-queue/
├── queue.ts            # BullMQ setup with Upstash Redis
├── worker.ts           # Job processor (calls orchestrator)
└── progress-reporter.ts  # Reports to WebSocket
```

**Key Decisions Needed:**
- [ ] **Q4:** Redis provider? (Recommendation: Upstash for serverless compatibility)
- [ ] **Q5:** Concurrency limit? (Recommendation: 1 audit at a time to avoid rate limits)

**Integration:**
```typescript
// backend/services/job-queue/worker.ts
import { AuditOrchestrator } from '../audit-orchestrator';

queue.process('audit-jobs', async (job) => {
  const { domain, auditId } = job.data;

  await AuditOrchestrator.run({
    domain,
    auditId,
    onProgress: (event) => emitToWebSocket(auditId, event)
  });
});
```

---

#### Week 5: Audit Orchestrator ⭐ CORE LOGIC
**Goal:** Wrapper that calls enrichment (Phase 1) + browser testing (Phase 2) + scoring (Phase 3) + deliverables (Phase 4) + fact-check (Phase 5)

**Architecture:**
```
Audit Orchestrator (5 Phases)
├── Phase 1: Enrichment (REUSE EnrichmentOrchestrator from arian) WITH SOURCE TRACKING
├── Phase 2: Browser Testing (NEW) WITH SCREENSHOT PERSISTENCE
├── Phase 3: Scoring (PARTIAL REUSE from arian's scoring.ts)
├── Phase 4: Deliverables (NEW) WITH INLINE CITATIONS
└── Phase 5: Fact-Check (NEW) ← MANDATORY QUALITY GATE
    └── Progress: Emits 52 total events (14 + 20 + 10 + 8 + variable)
```

**Files to Create:**
```
backend/services/audit-orchestrator/
├── orchestrator.ts         # Main orchestrator
├── phase1-enrichment.ts    # Wrapper around arian's orchestrator + SOURCE TRACKING
├── phase2-browser.ts       # Calls browser testing service
├── phase3-scoring.ts       # 10 scoring areas (reuse + extend arian)
├── phase4-deliverables.ts  # Generate 3 files (report, landing, deck) + INLINE CITATIONS
└── phase5-factcheck.ts     # Fact-check service integration (7 dimensions)
```

**Key Logic:**
```typescript
// backend/services/audit-orchestrator/orchestrator.ts
export class AuditOrchestrator {
  async run({ domain, auditId, onProgress }) {
    // Phase 1: Enrichment (14 steps) - REUSE from arian + TRACK SOURCES
    const enrichmentData = await EnrichmentOrchestrator.enrich(domain, 'comprehensive', {
      captureSourceUrls: true,  // 🔴 NEW: Capture source URL for every API call
      validateFreshness: true   // 🔴 NEW: Reject data >12 months old
    });

    await supabase.from('audits').update({
      traffic_data: enrichmentData.traffic,
      tech_stack: enrichmentData.techStack,
      financial_data: enrichmentData.financial,
      // 🔴 NEW: Save source citations
      source_citations: enrichmentData.sourceCitations,
      data_freshness: enrichmentData.dataFreshness,
    }).eq('id', auditId);

    // Phase 2: Browser Testing (20 steps) - NEW
    const browserResults = await BrowserTestingService.run(domain);
    await supabase.from('audits').update({
      browser_test_results: browserResults
    }).eq('id', auditId);

    // Phase 3: Scoring (10 areas) - EXTEND arian's scoring
    const auditScore = await AuditScorer.score({
      enrichmentData,
      browserResults
    });
    await supabase.from('audits').update({
      audit_score: auditScore
    }).eq('id', auditId);

    // Phase 4: Generate Deliverables (3 files) - NEW WITH INLINE CITATIONS
    const deliverables = await DeliverableGenerator.generate({
      domain,
      enrichmentData,
      browserResults,
      auditScore,
      sourceCitations: enrichmentData.sourceCitations  // 🔴 Pass citations to templates
    });
    await supabase.from('audits').update({
      report_url: deliverables.reportUrl,
      landing_page_url: deliverables.landingPageUrl,
      deck_url: deliverables.deckUrl
    }).eq('id', auditId);

    // 🔴 Phase 5: Fact-Check (MANDATORY QUALITY GATE)
    onProgress({ phase: 5, step: 'factcheck', message: 'Validating all data points...' });

    await supabase.from('audits').update({ status: 'factchecking' }).eq('id', auditId);

    const factcheckResults = await FactCheckService.run({
      auditId,
      tier: 'full',  // Full external verification (re-call APIs, verify sources)
      deliverableUrls: {
        report: deliverables.reportUrl,
        landing: deliverables.landingPageUrl,
        deck: deliverables.deckUrl
      }
    });

    await supabase.from('audits').update({
      factcheck_score: factcheckResults.confidenceScore,  // 0-10
      factcheck_report_url: factcheckResults.reportUrl,
      factcheck_corrections: factcheckResults.corrections,
      factcheck_completed_at: new Date(),
      status: factcheckResults.confidenceScore >= 8.0 ? 'completed' : 'needs_review'
    }).eq('id', auditId);

    // If confidence < 8.0, halt and notify user
    if (factcheckResults.confidenceScore < 8.0) {
      throw new Error(`Fact-check failed with score ${factcheckResults.confidenceScore}. Review required.`);
    }
  }
}
```

**Key Decisions Needed:**
- [ ] **Q6:** Where to store generated markdown/HTML files? (Recommendation: Vercel Blob Storage with public URLs)

---

#### Week 6.5: Fact-Check Service 🔴 MANDATORY QUALITY GATE
**Goal:** Automated validation of every data point across all deliverables

**Architecture:**
```
Fact-Check Service (7 Dimensions)
├── Dimension 1: Cross-File Consistency (15%) - Scratchpad vs deliverables
├── Dimension 2: Math & Logic (10%) - ROI calculations, scoring arithmetic
├── Dimension 3: Reference Data (10%) - SAIM stats, Algolia approved numbers
├── Dimension 4: API Data Accuracy (20%) - Re-call SimilarWeb/BuiltWith/Yahoo Finance
├── Dimension 5: Source Citation Integrity (15%) - Verify every link works
├── Dimension 6: Investor Quote Verification (15%) - Verify quotes at source
└── Dimension 7: Browser Observation Fidelity (15%) - Screenshot refs exist, queries match
```

**Files to Create:**
```
backend/services/factcheck/
├── factcheck-service.ts         # Main orchestrator (spawns 5 parallel agents)
├── claim-registry-builder.ts    # Extracts all data points from deliverables
├── dimension-1-3-validator.ts   # Read-only dimensions (consistency, math, SAIM)
├── dimension-4-validator.ts     # Re-calls all APIs for independent verification
├── dimension-5-6-validator.ts   # WebFetch all source URLs, verify quotes
├── dimension-7-validator.ts     # Verify screenshots exist, queries tested
└── scoring.ts                   # Weighted scoring: 0-10 confidence score
```

**Fact-Check Process:**
1. **Phase 1 (Sequential)**: Build master claim registry from all files
2. **Phase 2 (Parallel)**: 4 agents validate dimensions 1-7 simultaneously
3. **Phase 3 (Sequential)**: Score results, generate 3 output files

**Output Files:**
1. `{company}-factcheck-report.md` — Human-readable scored report
2. `{company}-correction-manifest.md` — Machine-readable fixes (file + line)
3. `{company}-skill-feedback.md` — Methodology improvements for SKILL.md

**Integration:**
```typescript
// backend/services/factcheck/factcheck-service.ts
export class FactCheckService {
  async run({ auditId, tier, deliverableUrls }) {
    // Step 1: Fetch deliverables from Vercel Blob
    const deliverables = await fetchDeliverables(deliverableUrls);

    // Step 2: Build claim registry (sequential)
    const claimRegistry = await ClaimRegistryBuilder.build({
      report: deliverables.report,
      landing: deliverables.landing,
      deck: deliverables.deck
    });

    // Step 3: Run 7 dimensions in parallel (if tier = 'full')
    const results = await Promise.all([
      validateDimensions1to3(claimRegistry),           // Agent 1
      validateDimension4ApiData(claimRegistry, tier),  // Agent 2: Re-call APIs
      validateDimensions5and6Citations(claimRegistry, tier), // Agent 3: WebFetch sources
      validateDimension7Browser(claimRegistry)         // Agent 4
    ]);

    // Step 4: Score results (weighted)
    const confidenceScore = calculateConfidenceScore(results);

    // Step 5: Generate 3 output files
    const reportUrl = await generateFactCheckReport(results, confidenceScore);
    const corrections = extractCorrections(results);

    return {
      confidenceScore,  // 0-10
      reportUrl,
      corrections
    };
  }
}
```

**Source Citation Validation (Dimension 5):**
- **For every data point**: WebFetch the source URL
- **Verify**: The specific claim appears on that page
- **Check**: URL is not 404, not hallucinated
- **Validate freshness**: Data is ≤12 months old (except 3-year financials)

**Example validation:**
```typescript
// Claim: "100.9M monthly visits"
// Source URL: https://api.similarweb.com/v1/website/costco.com/...?start_date=2025-01
// Action: Re-call API with same params → Verify response matches claim
// If mismatch: Flag as [STALE] or [INACCURATE]
```

**Confidence Score Thresholds:**
- **8.0-10.0**: HIGH CONFIDENCE — Safe to share with prospects
- **6.0-7.9**: MODERATE — Review flagged issues before sharing
- **<6.0**: LOW CONFIDENCE — Fix required, do not share

**Data Freshness Enforcement:**
```typescript
// backend/services/enrichment/base-enricher.ts
export abstract class BaseEnricher {
  async fetchWithFreshnessCheck(url: string, maxAgeMonths: number = 12) {
    const response = await fetch(url);
    const data = await response.json();

    // Check data date
    const dataDate = extractDataDate(data);
    const monthsOld = differenceInMonths(new Date(), dataDate);

    if (monthsOld > maxAgeMonths) {
      throw new Error(`Data is ${monthsOld} months old (max: ${maxAgeMonths})`);
    }

    // Store source citation
    this.addSourceCitation({
      claim: extractClaim(data),
      sourceUrl: url,
      fetchedAt: new Date(),
      dataDate: dataDate
    });

    return data;
  }
}
```

---

#### Week 6: PDF Generator & Deliverable Templates
**Goal:** Convert markdown → PDF book (Puppeteer) + generate 3 deliverable files

**Files to Create:**
```
backend/services/deliverables/
├── templates/
│   ├── report-template.md       # Markdown template for report
│   ├── landing-page.html        # HTML template for landing page
│   └── deck-template.md         # Markdown template for deck
├── generator.ts                 # Fills templates with data
└── pdf-converter.ts             # Puppeteer: HTML → PDF
```

**Key Logic:**
```typescript
// backend/services/deliverables/generator.ts
export async function generateDeliverables(data) {
  // 1. Generate markdown report
  const reportMd = fillTemplate('report-template.md', data);
  const reportUrl = await uploadToBlob(reportMd, 'report.md');

  // 2. Generate HTML landing page
  const landingHtml = fillTemplate('landing-page.html', data);
  const landingUrl = await uploadToBlob(landingHtml, 'landing.html');

  // 3. Generate deck markdown
  const deckMd = fillTemplate('deck-template.md', data);
  const deckUrl = await uploadToBlob(deckMd, 'deck.md');

  // 4. Convert landing page → PDF book
  const pdfBuffer = await convertToPdf(landingHtml);
  const pdfUrl = await uploadToBlob(pdfBuffer, 'book.pdf');

  return { reportUrl, landingUrl, deckUrl, pdfUrl };
}
```

---

### Phase 3: Frontend (Week 7-7.5)

#### Week 7: Core Pages
**Goal:** Build 4 main pages (Dashboard, Start Audit, Execution Monitor, Audit Details)

**Files to Create:**
```
frontend/src/pages/
├── Dashboard.tsx               # Recent audits grid (REUSE from arian)
├── StartAudit.tsx              # URL input form
├── ExecutionMonitor.tsx        # Real-time progress (NEW)
└── AuditDetails.tsx            # Results viewer (EXTEND from arian)
```

**Reuse from arian:**
- `DistributionGrid.tsx` → Adapt for audits grid
- `CompanyDrawer.tsx` → Extend with browser test results tab
- `StatsCards.tsx` → Show audit counts by status

**New Components:**
```typescript
// frontend/src/components/ExecutionMonitor.tsx
export function ExecutionMonitor({ auditId }) {
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(`wss://api.example.com/audits/${auditId}`);
    ws.onmessage = (event) => {
      const progressEvent = JSON.parse(event.data);
      setProgress(prev => [...prev, progressEvent]);
    };
  }, [auditId]);

  return (
    <Timeline>
      {progress.map(event => (
        <TimelineItem key={event.step} status={event.status}>
          {event.message}
        </TimelineItem>
      ))}
    </Timeline>
  );
}
```

---

#### Week 7.5: WebSocket Integration & Testing
**Goal:** Connect frontend to real-time progress updates

**Files to Create:**
```
backend/websocket/
├── server.ts               # Socket.IO server
└── emitter.ts              # Emits progress events from orchestrator

frontend/src/hooks/
└── useAuditProgress.ts     # React hook for WebSocket connection
```

**Integration:**
```typescript
// frontend/src/hooks/useAuditProgress.ts
export function useAuditProgress(auditId: string) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);

  useEffect(() => {
    const socket = io(WEBSOCKET_URL);
    socket.emit('join', auditId);
    socket.on('progress', (event) => {
      setEvents(prev => [...prev, event]);
    });
    return () => socket.disconnect();
  }, [auditId]);

  return { events };
}
```

---

## 3. Week-by-Week Execution Plan

### Week 1: Foundation & Setup
**Mon-Tue:**
- [ ] Extend Supabase project with `audits` table
- [ ] Copy enrichment services from arian
- [ ] Set up React frontend boilerplate

**Wed-Fri:**
- [ ] Copy shared UI components
- [ ] Test Supabase connection
- [ ] Create empty Dashboard page that lists audits

**Deliverable:** Dashboard skeleton that can create audit records

---

### Week 2-3: Browser Testing Service ⚠️
**Week 2:**
- [ ] Set up Playwright browser pool
- [ ] Implement core tests (steps 1-12)
- [ ] Set up Vercel Blob Storage for screenshots
- [ ] Test screenshot capture + upload

**Week 3:**
- [ ] Implement value-prop tests (steps 13-20)
- [ ] Add CAPTCHA detection + pause logic
- [ ] Add progress event emission
- [ ] End-to-end test on 3 sample sites

**Deliverable:** Standalone browser testing service that can run 20 tests

---

### Week 4: Job Queue
- [ ] Set up Upstash Redis
- [ ] Implement BullMQ queue + worker
- [ ] Connect worker to browser testing service
- [ ] Test job scheduling + progress reporting

**Deliverable:** Working job queue that processes audits async

---

### Week 5: Audit Orchestrator + Source Citation Tracking
- [ ] Create orchestrator wrapper (5 phases)
- [ ] 🔴 Update enrichment services to capture source URLs
- [ ] 🔴 Add data freshness validation (reject >12 months)
- [ ] Integrate Phase 1 (enrichment from arian + source tracking)
- [ ] Integrate Phase 2 (browser testing)
- [ ] Integrate Phase 3 (scoring - extend arian)
- [ ] Test full pipeline on 2 sample sites

**Deliverable:** Complete orchestrator (Phases 1-3) with source citation tracking

---

### Week 6: Deliverables with Inline Citations
- [ ] Create markdown report template with inline citation syntax
- [ ] Create HTML landing page template with source badges
- [ ] Create deck template with source footnotes
- [ ] 🔴 Implement inline citation rendering (every data point → link)
- [ ] Set up Puppeteer for PDF generation
- [ ] Test deliverable generation with real citations

**Deliverable:** 3 output files with inline links to sources

---

### Week 6.5: Fact-Check Service 🔴 CRITICAL
- [ ] Implement claim registry builder
- [ ] Implement Dimension 1-3 validators (consistency, math, SAIM)
- [ ] Implement Dimension 4 validator (re-call APIs)
- [ ] Implement Dimension 5-6 validators (WebFetch sources, verify quotes)
- [ ] Implement Dimension 7 validator (browser fidelity)
- [ ] Implement scoring logic (weighted 0-10 score)
- [ ] Integrate into orchestrator as Phase 5
- [ ] Test with completed audit → verify confidence score ≥8.0

**Deliverable:** Fact-check service that validates all data points

---

### Week 7: Frontend Pages + Fact-Check UI
- [ ] Build Dashboard page (reuse arian grid)
- [ ] Build Start Audit form
- [ ] Build Execution Monitor with timeline (5 phases shown)
- [ ] Build Audit Details page (extend arian drawer)
- [ ] 🔴 Build Fact-Check Report Viewer (show 7 dimensions, confidence score)
- [ ] Test navigation flow

**Deliverable:** 5 working pages with mock data

---

### Week 8: WebSocket & Final Testing
- [ ] Set up Socket.IO server
- [ ] Connect frontend to WebSocket
- [ ] 🔴 End-to-end test: Start audit → Watch 5 phases → View fact-check report → Download deliverables
- [ ] Test fact-check integration (confidence <8.0 → audit stays in 'needs_review' status)
- [ ] Bug fixes + polish

**Deliverable:** 🚀 Fully working MVP with fact-check quality gate

---

## 4. Missing Components & Discussion Points

### Must Discuss Before Starting:

#### Storage & Infrastructure
- [ ] **Q1:** Vercel Blob Storage vs AWS S3 for screenshots/deliverables?
  - **Recommendation:** Vercel Blob (simpler, same ecosystem)

- [ ] **Q2:** Where to run browser tests? Vercel Serverless vs dedicated server?
  - **Recommendation:** Vercel Serverless Functions with 5min timeout (Playwright supported)

- [ ] **Q3:** Redis provider for job queue?
  - **Recommendation:** Upstash Redis (serverless, free tier)

#### User Experience
- [ ] **Q4:** How to handle CAPTCHAs during browser testing?
  - **Recommendation:** Pause audit → Emit event → User solves in browser window → Resume

- [ ] **Q5:** Should users see real-time logs or just high-level progress?
  - **Recommendation:** High-level progress (14 steps) + expandable detailed logs

#### API Rate Limits
- [ ] **Q6:** SimilarWeb/BuiltWith rate limits per account?
  - **Need:** Confirm limits to set job concurrency (1 audit at a time = safe)

- [ ] **Q7:** Should we cache enrichment data like arian does?
  - **Recommendation:** Yes, check if domain was enriched in last 30 days

#### Access Control
- [ ] **Q8:** Authentication? (Internal tool = Algolia SSO?)
  - **Recommendation:** Start with no auth (internal network), add SSO later

- [ ] **Q9:** Who can start audits? (Sales team only? Everyone?)
  - **Recommendation:** Start open, add role-based access later

---

## 5. What's Already Done ✅

From `algolia-arian` project (70% reuse):

| Component | Status | Files to Copy |
|-----------|--------|---------------|
| **Database Schema** | ✅ Ready | `supabase/RUN_THIS_MIGRATION.sql` (adapt table name) |
| **Enrichment Orchestrator** | ✅ Ready | `frontend/src/services/enrichment/orchestrator.ts` |
| **API Clients** | ✅ Ready | `frontend/src/services/enrichment/*.ts` (6 sources) |
| **Supabase API Pattern** | ✅ Ready | `frontend/src/services/api.ts` |
| **Scoring Logic** | ✅ Partial | `frontend/src/services/scoring.ts` (extend to 10 areas) |
| **UI Components** | ✅ Ready | `frontend/src/components/*` (cards, grids, drawers) |
| **Frontend Stack** | ✅ Ready | `frontend/package.json` (React 18 + Mantine + Zustand) |

---

## 6. What Needs Building (35% + Source Citation Tracking)

New components with no equivalent in arian:

| Component | Complexity | Effort | Critical Path? | Source Citation Required? |
|-----------|------------|--------|----------------|--------------------------|
| **Browser Testing Service** | High | 2 weeks | YES ⚠️ | Yes (screenshot URLs) |
| **Job Queue** | Medium | 1 week | YES | No |
| **Audit Orchestrator** | Medium | 1 week | YES | Yes (orchestrate source tracking) |
| **PDF Generator** | Low | 1 week | No | No |
| **WebSocket Server** | Low | 0.5 week | No | No |
| **Execution Monitor UI** | Medium | 1 week | No | No |
| **🔴 Fact-Check Service** | High | 1.5 weeks | YES ⚠️ | Yes (validate all sources) |
| **🔴 Source Citation Tracking** | Medium | 1 week | YES | **CRITICAL** (every data point) |

**Critical Path:** Browser Testing → Job Queue → Orchestrator → Fact-Check (5.5 weeks)

**🔴 MANDATORY Additions:**
- **Enrichment services MUST capture source URLs** for every API call
- **All deliverables MUST include inline links** to sources
- **Data freshness validation** (reject >12 month old data except 3-year financials)
- **Fact-check MUST run before marking audit as 'completed'**

---

## 7. Immediate Next Steps (This Week)

### Step 1: Database Setup (2 hours)
```bash
# Option A: Extend existing arian Supabase project
# - Add audits table to same project
# - Benefit: Reuse all API clients without changes

# Option B: Create new Supabase project
# - Clean separation, but need to update API URLs
```

**Action:** Decide A or B, then run migration

---

### Step 2: Copy Enrichment Services (3 hours)
```bash
# Create new project directory
mkdir -p search-audit-dashboard/frontend/src/services/enrichment

# Copy all enrichment modules from arian
cp -r algolia-arian/frontend/src/services/enrichment/* \
      search-audit-dashboard/frontend/src/services/enrichment/

# Copy API client
cp algolia-arian/frontend/src/services/api.ts \
   search-audit-dashboard/frontend/src/services/
```

**Action:** Execute copy, test API connection

---

### Step 3: Set Up Frontend Boilerplate (4 hours)
```bash
# Create new React project
npm create vite@latest search-audit-dashboard -- --template react-ts

# Install dependencies (same as arian)
cd search-audit-dashboard/frontend
npm install @mantine/core @mantine/hooks @mantine/notifications
npm install zustand
npm install @supabase/supabase-js
```

**Action:** Create empty shell with routing

---

### Step 4: Create First API Endpoint (2 hours)
```typescript
// frontend/src/services/api.ts (copied from arian)
export async function createAudit(domain: string) {
  const { data, error } = await supabase
    .from('audits')
    .insert({
      domain,
      status: 'pending',
      company_name: null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAudits() {
  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

**Action:** Test create + list audits from frontend

---

## 8. Success Criteria

### Week 1 Success:
- [ ] Can create audit record in Supabase via frontend form
- [ ] Can list audits in dashboard grid
- [ ] Enrichment services copied and importable

### Week 4 Success:
- [ ] Can start audit → Goes to job queue
- [ ] Can watch browser testing progress in real-time
- [ ] Screenshots saved to Vercel Blob Storage

### Week 6.5 Success (Fact-Check):
- [ ] Fact-check service can build claim registry from deliverables
- [ ] All 7 dimensions validate correctly
- [ ] Re-calling APIs works (SimilarWeb, BuiltWith, Yahoo Finance)
- [ ] WebFetch verifies source URLs
- [ ] Confidence score calculated correctly (0-10 scale)
- [ ] Audit with score <8.0 goes to 'needs_review' status

### Week 8 Success (Full MVP):
- [ ] Full audit completes end-to-end (5 phases: 14 + 20 + 10 + 3 deliverables + fact-check)
- [ ] 🔴 Every data point has inline link to source
- [ ] 🔴 Source citations stored in database
- [ ] 🔴 Fact-check runs automatically after deliverables generated
- [ ] 🔴 Confidence score ≥8.0 required to mark audit 'completed'
- [ ] 3 deliverable files generated with citations + fact-check report
- [ ] User can download report/landing page/deck + fact-check results
- [ ] Dashboard shows fact-check score badge for each audit

---

## 9. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Browser testing too slow** | High | Run 3 parallel instances, optimize waits |
| **CAPTCHA blocks** | Medium | Pause + notify user, fallback to manual |
| **API rate limits hit** | High | Queue 1 audit at a time, add 30-day cache |
| **Serverless timeout (5min)** | Medium | Split long audits into separate functions |
| **Screenshot storage costs** | Low | Compress images, expire after 90 days |
| **🔴 Stale data (>12 months)** | High | Reject at API level, flag in UI with ⚠️ |
| **🔴 Fact-check fails (<8.0 score)** | High | Block completion, require manual review |
| **🔴 Missing source citations** | Critical | Fail at template generation, require all citations |

---

## 10. Post-MVP Enhancements

Features to add after Week 8:

- [ ] **Authentication:** Algolia SSO integration
- [ ] **Scheduling:** Run audits on cadence (weekly/monthly)
- [ ] **Alerts:** Email when audit completes
- [ ] **Export:** Bulk export to CSV/Excel
- [ ] **Comparison:** Compare 2 audits side-by-side
- [ ] **API:** Public API for triggering audits
- [ ] **Analytics:** Dashboard showing audit trends over time
- [ ] **🔴 Auto-correction:** Apply fact-check corrections automatically
- [ ] **🔴 Citation health dashboard:** Track % of data with valid sources

---

## Summary Table

| Question | Answer |
|----------|--------|
| **Database?** | ✅ Reuse algolia-arian Supabase (add `audits` table + source_citations + factcheck fields) |
| **Build sequence?** | Week 1-1.5: Setup → Week 2-6.5: Backend + Fact-Check → Week 7-8: Frontend |
| **First module?** | Database migration + copy enrichment services + add source tracking |
| **Hardest part?** | Browser Testing Service (Week 2-3) + Fact-Check Service (Week 6.5) |
| **Timeline?** | 8 weeks to MVP (was 7.5 weeks, +1.5 weeks for fact-check + source citations) |
| **Missing?** | Need to decide: Vercel Blob vs S3, Serverless vs dedicated browser server |
| **🔴 NEW Requirements?** | (1) Every data point MUST have inline link to source<br>(2) Data ≤12 months old (except 3-year financials)<br>(3) Fact-check MUST pass (≥8.0) before marking 'completed' |
| **Ready to start?** | ✅ Yes - start with database migration + source citation schema this week |

---

**Next Action:** Review this plan → Answer Q1-Q9 → Execute Week 1 tasks with source citation requirements
