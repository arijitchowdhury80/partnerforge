# Reusable Components from Algolia-Arian Project

**Date:** 2026-03-02
**Source Project:** `/AI/MarketingProject/algolia-arian/`
**Target Project:** Search Audit SaaS Platform

---

## 🎯 Executive Summary

**GOOD NEWS:** ~70% of the Search Audit SaaS architecture already exists in the `algolia-arian` project!

We can reuse:
- ✅ Database architecture (Supabase PostgreSQL)
- ✅ Enrichment services (SimilarWeb, BuiltWith, Yahoo Finance, WebSearch clients)
- ✅ API pattern (direct REST calls to Supabase)
- ✅ Frontend stack (React + TypeScript + Mantine UI)
- ✅ Deployment approach (Vercel + Supabase)
- ✅ Scoring algorithms
- ✅ Caching strategy

We need to add:
- ⚠️ Browser Testing Service (Playwright) - NEW
- ⚠️ Job Queue (BullMQ) - NEW
- ⚠️ Audit Orchestrator - NEW (different from enrichment orchestrator)
- ⚠️ PDF Generation - NEW
- ⚠️ WebSocket for real-time updates - NEW

---

## 📦 What Already Exists (Arian Project)

### 1. Database Architecture ✅

**Location:** `algolia-arian/supabase/`

#### Schema Pattern (Already Built)
```sql
-- Pattern we can reuse for Search Audits
CREATE TABLE displacement_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  company_name VARCHAR(255),

  -- Enrichment data (JSONB columns)
  tech_stack_json JSONB,
  traffic_data_json JSONB,
  financials_json JSONB,
  competitors_json JSONB,

  -- Scoring
  icp_score INTEGER,

  -- Metadata
  enrichment_level VARCHAR(20), -- basic, standard, deep, full
  fetched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Reusable Pattern:** Store enrichment data in JSONB columns, use Supabase auto-generated REST API

### 2. Enrichment Services ✅

**Location:** `algolia-arian/frontend/src/services/enrichment/`

#### Orchestrator Pattern (Fully Built!)
```typescript
// Already exists: enrichment/orchestrator.ts
class EnrichmentOrchestrator {
  // 3-phase parallel execution
  async enrich(domain: string, level: EnrichmentLevel): Promise<EnrichmentResult> {
    // Phase 1: Traffic + TechStack (parallel)
    await Promise.all([
      this.enrichTrafficWithProgress(...),
      this.enrichTechStackWithProgress(...)
    ]);

    // Phase 2: Competitors + Financials (parallel)
    await Promise.all([
      this.enrichCompetitorsWithProgress(...),
      this.enrichFinancialsWithProgress(...)
    ]);

    // Phase 3: Hiring + Executive + Investor (parallel)
    await Promise.all([
      this.enrichHiringWithProgress(...),
      this.enrichExecutiveWithProgress(...),
      this.enrichInvestorWithProgress(...)
    ]);

    return result;
  }

  // Progress callbacks for UI
  onProgress?: (progress: EnrichmentProgress) => void;

  // Built-in caching (24-hour TTL)
  private cache: Map<string, CacheEntry>;

  // Batch enrichment with concurrency
  async enrichBatch(domains: string[], options: BatchEnrichOptions): Promise<Map<string, EnrichmentResult>>;
}
```

#### API Clients (All Built!)
| Client | File | What It Does | Reusable? |
|--------|------|--------------|-----------|
| **SimilarWeb** | `clients/similarweb.ts` | Traffic, competitors, engagement | ✅ YES - Use as-is |
| **BuiltWith** | `clients/builtwith.ts` | Tech stack, search provider, CMS | ✅ YES - Use as-is |
| **Yahoo Finance** | `clients/yahoofinance.ts` | Financials, ticker resolution | ✅ YES - Use as-is |
| **WebSearch** | `clients/websearch.ts` | Executive quotes, hiring signals | ✅ YES - Use as-is |
| **SEC EDGAR** | `clients/secedgar.ts` | 10-K/10-Q filings, risk factors | ✅ YES - Use as-is |

**Key Feature:** All clients already implement:
- ✅ Rate limiting
- ✅ Error handling
- ✅ Response caching
- ✅ TypeScript types

### 3. API Service ✅

**Location:** `algolia-arian/frontend/src/services/api.ts`

#### Direct Supabase REST Pattern (Already Built!)
```typescript
// No backend server needed - direct REST calls
async function supabaseFetch<T>(endpoint: string): Promise<{ data: T | null }> {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const response = await fetch(url, { headers });
  return await response.json();
}

// Example: Get all audits
const { data } = await supabaseFetch<Audit[]>('audits?select=*&order=created_at.desc');
```

**Reusable Pattern:** No Express server needed, just Supabase REST API!

### 4. Frontend Stack ✅

**Location:** `algolia-arian/frontend/`

#### Tech Stack (Production-Ready)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "typescript": "^5.0.0",
    "@mantine/core": "^7.5.0",
    "@mantine/hooks": "^7.5.0",
    "zustand": "^4.5.0"
  }
}
```

**Reusable Components:**
- ✅ `TableFilters.tsx` - Filter/sort headers with dropdowns
- ✅ `constants.ts` - Color system, status definitions
- ✅ Mantine UI theme configuration
- ✅ Zustand store patterns

### 5. Scoring Service ✅

**Location:** `algolia-arian/frontend/src/services/scoring.ts`

#### Composite Scoring Pattern (Fully Built!)
```typescript
// 4-factor scoring: Fit (25%) + Intent (25%) + Value (25%) + Displacement (25%)
export function calculateCompositeScore(company: Company): CompositeScore {
  const fitScore = calculateFitScore(company);
  const intentScore = calculateIntentScore(company);
  const valueScore = calculateValueScore(company);
  const displacementScore = calculateDisplacementScore(company);

  const total = Math.round(
    fitScore.score * 0.25 +
    intentScore.score * 0.25 +
    valueScore.score * 0.25 +
    displacementScore.score * 0.25
  );

  return { total, factors, confidence, dataCompleteness };
}
```

**Reusable for Search Audit Scoring:**
- ✅ Same pattern for calculating audit scores
- ✅ Confidence calculation based on data completeness
- ✅ Factor-based scoring with weights

### 6. Deployment Pattern ✅

**Current Setup:**
```
Frontend (React)  →  Vercel (https://algolia-arian.vercel.app)
Database + API    →  Supabase (xbitqeejsgqnwvxlnjra.supabase.co)
```

**Deploy Process:**
1. Push to GitHub `main` branch
2. Vercel auto-deploys frontend
3. Supabase hosts database + auto-generates REST API
4. ✅ Zero server management

---

## ⚠️ What Needs to Be Built (New for Search Audit)

### 1. Browser Testing Service (Playwright)

**Status:** Not in Arian project

#### What We Need
```typescript
// NEW service: BrowserTestingService
class BrowserTestingService {
  private pool: BrowserPool; // Manage 10 Chrome instances

  async runTest(domain: string, testConfig: TestConfig): Promise<TestResult> {
    const browser = await this.pool.acquire();

    // Navigate
    await browser.navigate(domain);

    // Type query
    await browser.type('input[type="search"]', testConfig.query);

    // Screenshot
    const imageData = await browser.screenshot();
    await this.saveToS3(imageData);

    // Analyze results
    const results = await this.analyzeResults(browser);

    await this.pool.release(browser);
    return results;
  }
}
```

**Complexity:** Medium - Need to manage browser pool, handle WAF/CAPTCHA

### 2. Job Queue (BullMQ)

**Status:** Not in Arian project (uses real-time enrichment)

#### What We Need
```typescript
// NEW service: Job Queue
import Queue from 'bullmq';

const auditQueue = new Queue('audits', {
  connection: { host: 'redis-host', port: 6379 }
});

// Add job
await auditQueue.add('run-audit', {
  auditId: 'abc123',
  domain: 'costco.com'
});

// Worker
const worker = new Worker('audits', async (job) => {
  const { auditId, domain } = job.data;

  // Run 5-phase audit
  await runPhase1(auditId, domain);
  await runPhase2(auditId, domain);
  // ...

  return { status: 'completed' };
});
```

**Complexity:** Medium - Need Redis + BullMQ + worker process

### 3. Audit Orchestrator (Different from Enrichment)

**Status:** Enrichment orchestrator exists, but audit orchestrator is different

#### Differences
| Feature | Enrichment Orchestrator | Audit Orchestrator |
|---------|------------------------|-------------------|
| Phases | 3 (parallel API calls) | 5 (sequential with browser) |
| Duration | ~30 seconds | ~40 minutes |
| Browser needed? | No | Yes (Phase 2) |
| Job queue? | No | Yes |
| PDF generation? | No | Yes (Phase 4-5) |

#### What We Need
```typescript
// NEW: AuditOrchestrator (wraps EnrichmentOrchestrator)
class AuditOrchestrator {
  private enrichmentOrchestrator: EnrichmentOrchestrator; // Reuse!
  private browserService: BrowserTestingService; // New
  private pdfGenerator: PDFGenerator; // New

  async runAudit(auditId: string, domain: string): Promise<void> {
    // Phase 1: Pre-Audit Research (REUSE EnrichmentOrchestrator!)
    const enrichmentData = await this.enrichmentOrchestrator.enrich(domain, 'full');
    await this.saveToDatabase(auditId, 'phase1_data', enrichmentData);

    // Phase 2: Browser Testing (NEW)
    const testResults = await this.browserService.runAllTests(domain);
    await this.saveToDatabase(auditId, 'phase2_data', testResults);

    // Phase 3: Scoring (NEW logic, reuse scoring pattern)
    const score = await this.calculateAuditScore(testResults);
    await this.saveToDatabase(auditId, 'overall_score', score);

    // Phase 4-5: Deliverables (NEW)
    const book = await this.pdfGenerator.generateBook(auditId);
    const brief = await this.generateBrief(auditId);
    await this.saveDeliverables(auditId, book, brief);
  }
}
```

### 4. PDF Generation Service

**Status:** Not in Arian project

#### What We Need
```typescript
// NEW: PDF Generator using Puppeteer
import puppeteer from 'puppeteer';

class PDFGenerator {
  async generateBook(auditId: string): Promise<Buffer> {
    // Fetch audit data from database
    const audit = await db.getAudit(auditId);

    // Render HTML template
    const html = await this.renderTemplate('book.html', audit);

    // Convert to PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'Letter' });
    await browser.close();

    return pdf;
  }
}
```

**Complexity:** Medium - HTML templates + Puppeteer PDF generation

### 5. WebSocket for Real-Time Updates

**Status:** Not in Arian project (uses polling)

#### What We Need
```typescript
// NEW: WebSocket Server (Socket.IO)
import { Server } from 'socket.io';

const io = new Server(3001, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('subscribe', (auditId) => {
    socket.join(`audit:${auditId}`);
  });
});

// Broadcast progress
function publishProgress(auditId: string, progress: AuditProgress) {
  io.to(`audit:${auditId}`).emit('progress', progress);
}
```

**Complexity:** Low - Socket.IO is straightforward

---

## 🔄 Reuse Strategy

### Phase 1: Copy & Adapt (Week 1-2)

1. **Copy Enrichment Services** (✅ 100% reusable)
   ```bash
   cp -r algolia-arian/frontend/src/services/enrichment/ \
         search-audit/frontend/src/services/enrichment/
   ```

2. **Copy API Pattern** (✅ 95% reusable)
   ```bash
   cp algolia-arian/frontend/src/services/api.ts \
      search-audit/frontend/src/services/api.ts
   ```
   - Change table name from `displacement_targets` to `audits`
   - Keep Supabase REST pattern

3. **Copy Scoring Pattern** (⚠️ 70% reusable)
   ```bash
   cp algolia-arian/frontend/src/services/scoring.ts \
      search-audit/frontend/src/services/auditScoring.ts
   ```
   - Adapt factors: Fit/Intent/Value/Displacement → SAYT/QueryUnderstanding/Results/etc.

### Phase 2: Build New Services (Week 3-6)

4. **Browser Testing Service** (⚠️ NEW)
   - Location: `search-audit/frontend/src/services/browserTesting.ts`
   - Playwright pool management
   - Screenshot persistence to S3

5. **Job Queue** (⚠️ NEW)
   - Redis + BullMQ
   - Worker process for audit execution

6. **Audit Orchestrator** (⚠️ NEW, wraps existing enrichment)
   - Location: `search-audit/frontend/src/services/auditOrchestrator.ts`
   - Calls `enrichmentOrchestrator.enrich()` for Phase 1

7. **PDF Generator** (⚠️ NEW)
   - Location: `search-audit/frontend/src/services/pdfGenerator.ts`
   - Puppeteer + HTML templates

### Phase 3: Frontend (Week 7-8)

8. **Copy UI Components** (✅ 80% reusable)
   ```bash
   cp -r algolia-arian/frontend/src/components/common/ \
         search-audit/frontend/src/components/common/
   ```
   - `TableFilters.tsx` - Reuse as-is
   - `constants.ts` - Reuse colors, adapt status definitions

9. **Build Audit-Specific Pages** (⚠️ NEW)
   - Dashboard (list audits)
   - Execution Monitor (real-time progress)
   - Audit Details (deliverables view)

---

## 📊 Comparison: What's the Same, What's Different

| Component | Arian | Search Audit | Reusable? |
|-----------|-------|--------------|-----------|
| **Database** | Supabase PostgreSQL | Supabase PostgreSQL | ✅ 100% |
| **API Pattern** | Direct REST to Supabase | Direct REST to Supabase | ✅ 100% |
| **Enrichment (Phase 1)** | EnrichmentOrchestrator | Same | ✅ 100% |
| **Browser Testing** | N/A | Playwright | ⚠️ NEW |
| **Job Queue** | N/A | BullMQ | ⚠️ NEW |
| **Real-time Updates** | Polling | WebSocket | ⚠️ NEW |
| **Deliverables** | CSV export | PDF Book + Markdown briefs | ⚠️ NEW |
| **Frontend Stack** | React + Mantine | React + Mantine | ✅ 90% |
| **Deployment** | Vercel + Supabase | Vercel + Supabase | ✅ 100% |

**Overall Reusability: ~70%**

---

## 💰 Cost Savings from Reuse

### Estimated Development Time

| Task | From Scratch | With Reuse | Savings |
|------|--------------|------------|---------|
| Database design | 1 week | 1 day | 4 days |
| Enrichment services | 4 weeks | 0 days | 20 days |
| API layer | 2 weeks | 1 day | 9 days |
| Frontend setup | 1 week | 1 day | 4 days |
| Scoring logic | 1 week | 2 days | 3 days |
| **Subtotal** | **9 weeks** | **1.5 weeks** | **40 days** |
| **New services** | - | 6 weeks | - |
| **TOTAL** | **15 weeks** | **7.5 weeks** | **50% faster** |

---

## 🎯 Action Items

### Immediate (This Week)
1. ✅ Create new Supabase project for Search Audits
2. ✅ Copy enrichment services from Arian → Search Audit repo
3. ✅ Test SimilarWeb + BuiltWith clients work as-is
4. ✅ Design audit-specific database schema

### Short-term (Weeks 2-4)
5. ⚠️ Build Browser Testing Service (Playwright)
6. ⚠️ Set up Redis + BullMQ job queue
7. ⚠️ Build Audit Orchestrator (wraps enrichment)
8. ⚠️ Add WebSocket server for real-time updates

### Medium-term (Weeks 5-8)
9. ⚠️ Build PDF Generator service
10. ⚠️ Build frontend pages (Dashboard, Monitor, Details)
11. ⚠️ Deploy to Vercel + Supabase
12. ✅ Migration plan for moving audits from CLI to SaaS

---

## 📝 Conclusion

**KEY INSIGHT:** We're not starting from scratch! The Arian project gives us:
- ✅ Database architecture
- ✅ All enrichment services (SimilarWeb, BuiltWith, Yahoo Finance)
- ✅ API pattern (Supabase REST)
- ✅ Frontend stack
- ✅ Deployment approach

We only need to build:
- ⚠️ Browser testing (Playwright)
- ⚠️ Job queue (BullMQ)
- ⚠️ Audit orchestrator (wraps existing enrichment)
- ⚠️ PDF generation
- ⚠️ WebSocket

**Result:** 50% faster development (7.5 weeks vs 15 weeks)
