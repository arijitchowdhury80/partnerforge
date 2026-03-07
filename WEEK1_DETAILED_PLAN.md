# Week 1 Implementation Plan - Complete Slice-by-Slice Breakdown

**Reference Documents**:
- Architecture: `backend/README.md`, `backend/PHASE1D_PHASE1E_DETAILED.md`
- Database: `data/README.md`, `data/DATABASE_EXPLAINED.md`, `data/migrations/001-008`
- Features: `docs/features/COPILOT_ARCHITECTURE.md`, `docs/GAP_ANALYSIS_SKILL_VS_PLATFORM.md`
- Status: `backend/PHASE1A_COMPLETE.md`, `backend/PHASE1C_COMPLETE.md`, `backend/PHASE1D_COMPLETE.md`, `backend/PHASE1E_COMPLETE.md`

---

## SLICE 1: Audit Orchestration Engine

### Backend Implementation

**File 1: `backend/services/audit-orchestrator.ts` (~300 lines)**
```typescript
class AuditOrchestrator {
  // Create new audit
  async createAudit(companyDomain: string, auditType: 'partner-intel' | 'search-audit'): Promise<Audit>

  // Start audit execution
  async startAudit(auditId: string): Promise<void>

  // Phase 1: Enrichment (calls enrichment-orchestrator)
  async runEnrichment(auditId: string): Promise<void>

  // Phase 2: Browser tests (calls search-audit-worker)
  async runSearchAudit(auditId: string): Promise<void>

  // Phase 3: Strategic analysis (calls strategic-analysis-engine)
  async runStrategicAnalysis(auditId: string): Promise<void>

  // Phase 4: Generate deliverables (calls export-generator)
  async generateDeliverables(auditId: string): Promise<void>

  // Error handling & retry
  async handleError(auditId: string, error: Error): Promise<void>

  // Progress tracking
  async updateProgress(auditId: string, phase: string, percent: number): Promise<void>
}
```

**File 2: `backend/api/audits/create.ts` (~150 lines)**
```typescript
// POST /api/audits
export async function POST(req: Request) {
  // 1. Validate request body (company_domain, audit_type)
  // 2. Check if company exists, create if not
  // 3. Create audit record with status='pending'
  // 4. Queue audit job in BullMQ
  // 5. Return audit ID + WebSocket URL
}
```

**File 3: `backend/api/audits/[id]/status.ts` (~100 lines)**
```typescript
// GET /api/audits/:id/status
export async function GET(req: Request) {
  // 1. Fetch audit from DB
  // 2. Return status, progress, current phase, errors
}
```

**File 4: `backend/api/audits/[id]/live.ts` (~200 lines)**
```typescript
// WebSocket endpoint: ws://localhost:3000/api/audits/:id/live
// Uses websocket-manager.ts from Phase 1D
export async function GET(req: Request) {
  // 1. Upgrade to WebSocket
  // 2. Join audit room
  // 3. Stream progress events (phase, percent, message)
  // 4. Handle disconnect
}
```

**File 5: `backend/workers/audit-orchestrator-worker.ts` (~250 lines)**
```typescript
// BullMQ worker
import { Worker, Job } from 'bullmq';
import { AuditOrchestrator } from '../services/audit-orchestrator';

const worker = new Worker('audits', async (job: Job) => {
  const { auditId } = job.data;
  const orchestrator = new AuditOrchestrator();

  // Phase 1: Enrichment (14 steps)
  await orchestrator.runEnrichment(auditId);

  // Phase 2: Browser tests (20 tests)
  await orchestrator.runSearchAudit(auditId);

  // Phase 3: Strategic analysis
  await orchestrator.runStrategicAnalysis(auditId);

  // Phase 4: Deliverables (6 files)
  await orchestrator.generateDeliverables(auditId);
}, { connection: redis });
```

**Reference**: `backend/README.md` Phase 1A

### Frontend Implementation

**File 6: `frontend/src/components/audit/AuditTrigger.tsx` (~150 lines)**
```typescript
// Button to start new audit
export function AuditTrigger() {
  // 1. Input: company domain
  // 2. Select audit type (partner-intel | search-audit)
  // 3. POST /api/audits
  // 4. Navigate to /audits/:id on success
  // 5. Show error if validation fails
}
```

**File 7: `frontend/src/components/audit/AuditProgress.tsx` (~300 lines)**
```typescript
// Live progress tracker
export function AuditProgress({ auditId }: { auditId: string }) {
  // 1. Connect to WebSocket ws://localhost:3000/api/audits/:id/live
  // 2. Display 4 phases:
  //    - Phase 1: Enrichment (14 steps with individual progress)
  //    - Phase 2: Browser Tests (20 tests with pass/fail)
  //    - Phase 3: Strategic Analysis (synthesis)
  //    - Phase 4: Deliverables (6 files)
  // 3. Progress bar per phase
  // 4. Status indicators: pending → running → completed | failed
  // 5. Error messages if phase fails
  // 6. "View Results" button when complete
}
```

**File 8: `frontend/src/pages/audits/[id].tsx` (~200 lines)**
```typescript
// Audit detail page
export default function AuditDetailPage() {
  // 1. Fetch audit status on load
  // 2. Show <AuditProgress> component
  // 3. When complete, show tabs:
  //    - Overview
  //    - Enrichment Data
  //    - Search Test Results
  //    - Strategic Insights
  //    - Deliverables
}
```

**Reference**: `docs/features/search-audit/FRONTEND_SPECS.md` (if exists)

### Testing

**File 9: `backend/tests/services/audit-orchestrator.test.ts` (~400 lines)**
```typescript
describe('AuditOrchestrator', () => {
  it('creates audit with valid domain', async () => {
    // Given: company domain 'costco.com'
    // When: createAudit('costco.com', 'search-audit')
    // Then: audit record created with status='pending'
  });

  it('starts audit and runs all phases', async () => {
    // Given: audit with id
    // When: startAudit(id)
    // Then:
    //   - Phase 1 complete (14 enrichment modules run)
    //   - Phase 2 complete (20 browser tests run)
    //   - Phase 3 complete (strategic analysis generated)
    //   - Phase 4 complete (6 deliverables generated)
    //   - Audit status='completed'
  });

  it('handles errors and retries', async () => {
    // Given: API error in enrichment phase
    // When: runEnrichment(id)
    // Then: error logged, retry attempted, status updated
  });

  it('emits WebSocket progress events', async () => {
    // Given: WebSocket client connected
    // When: startAudit(id)
    // Then: events emitted for each phase progress
  });
});
```

**File 10: `backend/tests/api/audits.test.ts` (~300 lines)**
```typescript
describe('POST /api/audits', () => {
  it('creates audit for valid domain', async () => {
    const res = await request(app)
      .post('/api/audits')
      .send({ company_domain: 'costco.com', audit_type: 'search-audit' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('audit_id');
    expect(res.body).toHaveProperty('websocket_url');
  });

  it('rejects invalid domain', async () => {
    const res = await request(app)
      .post('/api/audits')
      .send({ company_domain: 'not-a-domain', audit_type: 'search-audit' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/audits/:id/status', () => {
  it('returns audit status', async () => {
    const res = await request(app).get('/api/audits/123/status');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('progress');
  });
});
```

**File 11: `frontend/src/components/audit/__tests__/AuditProgress.test.tsx` (~250 lines)**
```typescript
describe('AuditProgress', () => {
  it('connects to WebSocket on mount', () => {
    render(<AuditProgress auditId="123" />);
    expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:3000/api/audits/123/live');
  });

  it('displays phase progress', () => {
    const { getByText } = render(<AuditProgress auditId="123" />);
    act(() => {
      mockWebSocket.emit('progress', { phase: 'enrichment', percent: 50, message: '7/14 modules complete' });
    });
    expect(getByText('Enrichment: 50%')).toBeInTheDocument();
  });

  it('shows completed state', () => {
    const { getByText } = render(<AuditProgress auditId="123" />);
    act(() => {
      mockWebSocket.emit('complete', { audit_id: '123' });
    });
    expect(getByText('View Results')).toBeInTheDocument();
  });
});
```

### Verification

**Manual Test Script**:
```bash
# 1. Start backend
cd backend && npm run dev

# 2. Create audit
curl -X POST http://localhost:3000/api/audits \
  -H "Content-Type: application/json" \
  -d '{"company_domain":"costco.com","audit_type":"search-audit"}' \
  | jq '.audit_id'

# 3. Connect to WebSocket (separate terminal)
wscat -c ws://localhost:3000/api/audits/AUDIT_ID/live

# 4. Check status
curl http://localhost:3000/api/audits/AUDIT_ID/status | jq

# Expected WebSocket events:
# { "event": "progress", "phase": "enrichment", "percent": 7, "message": "1/14 modules complete" }
# { "event": "progress", "phase": "enrichment", "percent": 14, "message": "2/14 modules complete" }
# ...
# { "event": "progress", "phase": "browser_tests", "percent": 5, "message": "1/20 tests complete" }
# ...
# { "event": "complete", "audit_id": "123" }

# 5. Verify database
psql $DATABASE_URL -c "SELECT id, status, overall_score FROM audits WHERE id='AUDIT_ID'"

# Expected: status='completed', overall_score between 0-10

# 6. Check frontend
# Navigate to http://localhost:5173/audits/AUDIT_ID
# Should see live progress bar updating
```

**Automated Verification**:
```typescript
// backend/tests/integration/audit-flow.test.ts
describe('Full Audit Flow', () => {
  it('completes end-to-end audit', async () => {
    // 1. Create audit
    const audit = await createAudit('costco.com', 'search-audit');

    // 2. Wait for completion (with timeout)
    await waitFor(() => audit.status === 'completed', { timeout: 600000 }); // 10 min

    // 3. Verify enrichment data
    const traffic = await db.query('SELECT * FROM company_traffic WHERE company_id=? AND audit_id=?', [audit.company_id, audit.id]);
    expect(traffic.rows.length).toBeGreaterThan(0);

    // 4. Verify search tests
    const tests = await db.query('SELECT * FROM search_audit_tests WHERE audit_id=?', [audit.id]);
    expect(tests.rows.length).toBe(20); // 20 tests

    // 5. Verify strategic analysis
    const analysis = await db.query('SELECT * FROM company_strategic_analysis WHERE audit_id=?', [audit.id]);
    expect(analysis.rows.length).toBe(1);
    expect(analysis.rows[0].primary_value_prop).toBeTruthy();

    // 6. Verify deliverables
    const deliverables = await db.query('SELECT * FROM audit_deliverables WHERE audit_id=?', [audit.id]);
    expect(deliverables.rows.length).toBe(6); // 6 deliverables
  });
});
```

---

## SLICE 2: Enrichment Pipeline (15 Modules)

### Backend Implementation

**File 12: `backend/workers/enrichment-worker.ts` (~400 lines)**
```typescript
// BullMQ worker for enrichment
import { Worker, Job } from 'bullmq';
import { EnrichmentOrchestrator } from '../services/enrichment-orchestrator';

const worker = new Worker('enrichment', async (job: Job) => {
  const { companyId, auditId } = job.data;
  const orchestrator = new EnrichmentOrchestrator();

  // Run all 15 modules in 4 waves (parallel within wave)
  await orchestrator.runWave1([
    'company_context',      // M01
    'technology_stack',     // M02
    'traffic_analysis',     // M03
    'competitor_intelligence' // M05
  ]);

  await orchestrator.runWave2([
    'financial_profile',    // M04
    'hiring_signals',       // M06
    'strategic_context'     // M07
  ]);

  await orchestrator.runWave3([
    'investor_intelligence', // M08
    'executive_intelligence', // M09
    'buying_committee'       // M10
  ]);

  await orchestrator.runWave4([
    'displacement_analysis', // M11
    'case_study_matching',   // M12
    'icp_priority_mapping',  // M13
    'signal_scoring',        // M14
    'strategic_brief'        // M15
  ]);

  // Update audit status
  await db.update('audits', { id: auditId }, { status: 'enrichment_complete' });
}, { connection: redis, concurrency: 1 });
```

**File 13: `backend/services/enrichment-orchestrator.ts` (~500 lines)**
```typescript
// Orchestrates 15 enrichment modules
// Reference: backend/services/enrichment/ (already created in Day 1)

class EnrichmentOrchestrator {
  constructor(
    private trafficService: TrafficEnrichmentService,    // From Day 1
    private financeService: FinancialEnrichmentService,  // From Day 1
    private techService: TechStackEnrichmentService,     // From Day 1
    private competitorService: CompetitorEnrichmentService, // From Day 1
    private executiveService: ExecutiveEnrichmentService,   // From Day 1
    private hiringService: HiringEnrichmentService         // From Day 1
  ) {}

  async runWave1(modules: string[]): Promise<void> {
    // Run modules in parallel
    await Promise.all(modules.map(m => this.runModule(m)));
  }

  async runModule(moduleName: string): Promise<void> {
    switch(moduleName) {
      case 'company_context':
        return this.runM01_CompanyContext();
      case 'technology_stack':
        return this.runM02_TechnologyStack();
      case 'traffic_analysis':
        return this.runM03_TrafficAnalysis();
      // ... all 15 modules
    }
  }

  private async runM01_CompanyContext(): Promise<void> {
    // 1. Fetch company data from DB (already exists - 14K companies)
    // 2. Enrich with WebSearch (founded year, HQ, employee count)
    // 3. Save to companies table
    // 4. Emit progress event
  }

  private async runM02_TechnologyStack(): Promise<void> {
    // Uses techService from Day 1
    // 1. Call BuiltWith domain-lookup
    // 2. Parse tech stack
    // 3. Save to company_technologies table
    // 4. Generate insight (e.g., "Using legacy Elasticsearch")
    // 5. Emit progress event
  }

  private async runM03_TrafficAnalysis(): Promise<void> {
    // Uses trafficService from Day 1
    // 1. Call SimilarWeb traffic-and-engagement
    // 2. Parse metrics (visits, bounce rate, sources)
    // 3. Save to company_traffic table
    // 4. Generate insight (e.g., "52% bounce rate indicates poor search")
    // 5. Emit progress event
  }

  // ... M04-M15 implementations
}
```

**Reference**:
- `backend/services/enrichment/` (6 services from Day 1)
- `backend/README.md` Phase 1C
- `/algolia-search-audit` skill MEMORY.md for module definitions

### Frontend Implementation

**File 14: `frontend/src/components/audit/EnrichmentStatus.tsx` (~400 lines)**
```typescript
// Displays 15 module cards with status
export function EnrichmentStatus({ auditId }: { auditId: string }) {
  // State: module status map (pending | running | completed | failed)
  const [modules, setModules] = useState<Map<string, ModuleStatus>>();

  // WebSocket listener
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000/api/audits/${auditId}/live`);
    ws.onmessage = (event) => {
      const { module, status, insight } = JSON.parse(event.data);
      setModules(prev => prev.set(module, { status, insight }));
    };
  }, [auditId]);

  // Render: 15 cards in 4 waves
  return (
    <div className="enrichment-grid">
      <WaveSection title="Wave 1: Core Data" modules={['M01', 'M02', 'M03', 'M05']} />
      <WaveSection title="Wave 2: Deep Dive" modules={['M04', 'M06', 'M07']} />
      <WaveSection title="Wave 3: Buying Intel" modules={['M08', 'M09', 'M10']} />
      <WaveSection title="Wave 4: Analysis" modules={['M11', 'M12', 'M13', 'M14', 'M15']} />
    </div>
  );
}

function ModuleCard({ module, status, insight }: ModuleCardProps) {
  // Card with:
  // - Module name (M01: Company Context)
  // - Status badge (pending/running/completed/failed)
  // - Insight preview (truncated)
  // - "View Details" button
  return (
    <Card>
      <h3>{module.name}</h3>
      <StatusBadge status={status} />
      {insight && <p className="insight">{insight.substring(0, 100)}...</p>}
      <Button onClick={() => viewDetails(module)}>View Details</Button>
    </Card>
  );
}
```

**File 15: `frontend/src/components/audit/EnrichmentDetails.tsx` (~300 lines)**
```typescript
// Detailed view for a single enrichment module
export function EnrichmentDetails({ auditId, module }: EnrichmentDetailsProps) {
  // Fetch module data from API
  const { data } = useSWR(`/api/audits/${auditId}/enrichment/${module}`);

  // Render based on module type
  switch(module) {
    case 'M03_traffic_analysis':
      return <TrafficDetails data={data} />; // Table with monthly visits, bounce rate, etc.
    case 'M02_technology_stack':
      return <TechStackDetails data={data} />; // Grid of detected technologies
    case 'M04_financial_profile':
      return <FinancialDetails data={data} />; // Charts for revenue, cash flow
    // ... all 15 modules
  }
}
```

**Reference**: Figma mockups (if exist)

### Testing

**File 16: `backend/tests/workers/enrichment-worker.test.ts` (~500 lines)**
```typescript
describe('EnrichmentWorker', () => {
  it('runs all 15 modules in 4 waves', async () => {
    // Given: company 'costco.com' with audit
    // When: enrichment job queued
    // Then:
    //   - Wave 1 completes (M01-M03, M05)
    //   - Wave 2 completes (M04, M06-M07)
    //   - Wave 3 completes (M08-M10)
    //   - Wave 4 completes (M11-M15)
    //   - All 15 modules have data in DB
  });

  it('M02: Technology Stack', async () => {
    // When: runM02_TechnologyStack()
    // Then:
    //   - BuiltWith API called
    //   - company_technologies table populated
    //   - Insight generated (e.g., "Using Elasticsearch 7.x")
  });

  it('M03: Traffic Analysis', async () => {
    // When: runM03_TrafficAnalysis()
    // Then:
    //   - SimilarWeb API called
    //   - company_traffic table populated (last 12 months)
    //   - Insight generated if bounce rate > 50%
  });

  // ... tests for all 15 modules
});
```

### Verification

```bash
# 1. Run enrichment for test company
curl -X POST http://localhost:3000/api/audits \
  -d '{"company_domain":"costco.com","audit_type":"partner-intel"}' \
  | jq '.audit_id'

# 2. Wait for enrichment complete
wscat -c ws://localhost:3000/api/audits/AUDIT_ID/live

# 3. Verify each module's data
psql $DATABASE_URL << EOF
-- M03: Traffic data
SELECT COUNT(*) FROM company_traffic WHERE audit_id='AUDIT_ID';
-- Expected: 12 rows (12 months)

-- M02: Tech stack
SELECT technology_name FROM company_technologies WHERE audit_id='AUDIT_ID';
-- Expected: 10-20 technologies

-- M04: Financials
SELECT revenue FROM company_financials WHERE audit_id='AUDIT_ID' ORDER BY fiscal_year DESC LIMIT 1;
-- Expected: Latest revenue number

-- M06: Hiring
SELECT COUNT(*) FROM company_hiring WHERE audit_id='AUDIT_ID';
-- Expected: 10-50 job postings

-- M09: Executives
SELECT full_name, title FROM company_executives WHERE audit_id='AUDIT_ID';
-- Expected: 5-15 executives
EOF

# 4. Check insights
psql $DATABASE_URL -c "
  SELECT
    (SELECT insight FROM company_traffic WHERE audit_id='AUDIT_ID' LIMIT 1) as traffic_insight,
    (SELECT insight FROM company_technologies WHERE audit_id='AUDIT_ID' LIMIT 1) as tech_insight,
    (SELECT insight FROM company_financials WHERE audit_id='AUDIT_ID' LIMIT 1) as finance_insight
"
# Expected: All insights populated (TEXT, not NULL)
```

---

## SLICE 3: Search Audit Tests (20 Browser Tests)

### Backend Implementation

**File 17: `backend/workers/search-audit-worker.ts` (~350 lines)**
```typescript
// BullMQ worker for browser tests
// Uses search-test-library.ts from Day 1 (Agent 6)

import { Worker, Job } from 'bullmq';
import { SearchTestLibrary } from '../services/search-test-library';
import { BrowserAutomation } from '../services/browser-automation'; // From Day 1

const worker = new Worker('search-audit', async (job: Job) => {
  const { companyId, auditId, companyDomain } = job.data;

  const browser = new BrowserAutomation();
  const testLibrary = new SearchTestLibrary(browser);

  await browser.launch();

  // Run all 20 tests (2a-2t)
  const tests = [
    { id: '2a', name: 'Homepage Load', fn: () => testLibrary.test_2a_homepage_load(companyDomain) },
    { id: '2b', name: 'Search Box Visible', fn: () => testLibrary.test_2b_search_box_visible() },
    { id: '2c', name: 'Simple Query', fn: () => testLibrary.test_2c_simple_query() },
    { id: '2d', name: 'Multi-word Query', fn: () => testLibrary.test_2d_multiword_query() },
    { id: '2e', name: 'Result Relevance', fn: () => testLibrary.test_2e_result_relevance() },
    { id: '2f', name: 'Typo Tolerance', fn: () => testLibrary.test_2f_typo_tolerance() },
    { id: '2g', name: 'Synonym Support', fn: () => testLibrary.test_2g_synonym_support() },
    { id: '2h', name: 'Facets/Filters', fn: () => testLibrary.test_2h_facets_filters() },
    { id: '2i', name: 'NLP Query', fn: () => testLibrary.test_2i_nlp_query() },
    { id: '2j', name: 'Mobile Search', fn: () => testLibrary.test_2j_mobile_search() },
    { id: '2k', name: 'Empty State', fn: () => testLibrary.test_2k_empty_state() },
    { id: '2l', name: 'Sort Options', fn: () => testLibrary.test_2l_sort_options() },
    { id: '2m', name: 'SAYT/Autocomplete', fn: () => testLibrary.test_2m_sayt_autocomplete() },
    { id: '2n', name: 'Category Search', fn: () => testLibrary.test_2n_category_search() },
    { id: '2o', name: 'Dynamic Facets', fn: () => testLibrary.test_2o_dynamic_facets() },
    { id: '2p', name: 'Search Speed', fn: () => testLibrary.test_2p_search_speed() },
    { id: '2q', name: 'Recommendations', fn: () => testLibrary.test_2q_recommendations() },
    { id: '2r', name: 'Analytics Tracking', fn: () => testLibrary.test_2r_analytics_tracking() },
    { id: '2s', name: 'Federated Search', fn: () => testLibrary.test_2s_federated_search() },
    { id: '2t', name: 'Personalization', fn: () => testLibrary.test_2t_personalization() }
  ];

  for (const test of tests) {
    try {
      const result = await test.fn();

      // Save to search_audit_tests table
      await db.insert('search_audit_tests', {
        company_id: companyId,
        audit_id: auditId,
        test_id: test.id,
        test_name: test.name,
        query: result.query,
        passed: result.passed,
        score: result.score, // 0-10
        finding: result.finding,
        severity: result.severity, // CRITICAL | HIGH | MEDIUM | LOW
        evidence: result.evidence,
        screenshot_path: result.screenshotPath,
        metadata: result.metadata
      });

      // Emit progress
      await emitProgress(auditId, 'browser_tests', (tests.indexOf(test) + 1) / tests.length * 100);

    } catch (error) {
      // Log error, continue with next test
      await db.insert('search_audit_tests', {
        company_id: companyId,
        audit_id: auditId,
        test_id: test.id,
        test_name: test.name,
        passed: false,
        score: 0,
        finding: `Test failed: ${error.message}`,
        severity: 'CRITICAL'
      });
    }
  }

  await browser.close();

  // Calculate overall score using search-audit-scoring.ts (Day 1)
  const scoringService = new SearchAuditScoringService();
  const overallScore = await scoringService.calculateScore(auditId);

  // Update audit
  await db.update('audits', { id: auditId }, { overall_search_score: overallScore });

}, { connection: redis, concurrency: 1 });
```

**Reference**:
- `backend/services/search-test-library.ts` (Agent 6, Day 1)
- `backend/services/search-audit-scoring.ts` (Agent 6, Day 1)
- `backend/services/browser-automation.ts` (Agent 4, Day 1)

### Frontend Implementation

**File 18: `frontend/src/components/audit/SearchTestResults.tsx` (~400 lines)**
```typescript
// Grid of 20 test results
export function SearchTestResults({ auditId }: { auditId: string }) {
  const { data: tests } = useSWR(`/api/audits/${auditId}/search-tests`);

  // Group by dimension (10 dimensions from scoring algorithm)
  const groupedTests = groupByDimension(tests);

  return (
    <div className="search-test-results">
      <ScoreCard overallScore={calculateOverallScore(tests)} />

      {Object.entries(groupedTests).map(([dimension, tests]) => (
        <DimensionSection
          key={dimension}
          dimension={dimension}
          tests={tests}
          score={calculateDimensionScore(tests)}
        />
      ))}
    </div>
  );
}

function TestCard({ test }: { test: SearchAuditTest }) {
  return (
    <Card className={test.passed ? 'passed' : 'failed'}>
      <div className="test-header">
        <h4>{test.test_name}</h4>
        <StatusBadge passed={test.passed} score={test.score} />
      </div>

      {test.query && <p className="query">Query: "{test.query}"</p>}

      <p className="finding">{test.finding}</p>

      {test.screenshot_path && (
        <img
          src={test.screenshot_path}
          alt={test.test_name}
          className="screenshot-thumb"
          onClick={() => openScreenshot(test.screenshot_path)}
        />
      )}

      <SeverityBadge severity={test.severity} />
    </Card>
  );
}
```

**File 19: `frontend/src/components/audit/SearchScoreBreakdown.tsx` (~300 lines)**
```typescript
// 10-dimension scoring breakdown
// Reference: backend/services/search-audit-scoring.ts

export function SearchScoreBreakdown({ auditId }: { auditId: string }) {
  const { data: scoring } = useSWR(`/api/audits/${auditId}/scoring-matrix`);

  // Display 10 dimensions with weights
  const dimensions = [
    { name: 'Relevance', weight: 15, score: scoring.relevance_score },
    { name: 'Typo & Synonym Tolerance', weight: 15, score: scoring.typo_synonym_score },
    { name: 'Federated Search', weight: 10, score: scoring.federated_search_score },
    { name: 'SAYT / Autocomplete', weight: 10, score: scoring.sayt_score },
    { name: 'Facets & Filters', weight: 10, score: scoring.facets_filters_score },
    { name: 'Empty State Handling', weight: 10, score: scoring.empty_state_score },
    { name: 'Semantic / NLP', weight: 10, score: scoring.semantic_nlp_score },
    { name: 'Dynamic Facets & Personalization', weight: 5, score: scoring.dynamic_facets_score },
    { name: 'Recommendations & Merchandising', weight: 10, score: scoring.recommendations_score },
    { name: 'Search Intelligence', weight: 5, score: scoring.intelligence_score }
  ];

  return (
    <div className="scoring-breakdown">
      <h2>Overall Score: {scoring.overall_score} / 10</h2>

      {dimensions.map(dim => (
        <DimensionRow
          key={dim.name}
          name={dim.name}
          weight={dim.weight}
          score={dim.score}
        />
      ))}
    </div>
  );
}
```

### Testing

**File 20: `backend/tests/workers/search-audit-worker.test.ts` (~600 lines)**
```typescript
describe('SearchAuditWorker', () => {
  it('runs all 20 browser tests', async () => {
    // Given: company 'costco.com' with audit
    // When: search-audit job queued
    // Then:
    //   - All 20 tests executed
    //   - search_audit_tests table has 20 rows
    //   - Each test has: passed, score, finding, severity
    //   - Screenshots captured for failed tests
  });

  it('Test 2c: Simple Query', async () => {
    // When: test_2c_simple_query('costco.com')
    // Then:
    //   - Query: "kirkland signature"
    //   - Result: Product results shown
    //   - Score: 8-10 if passed, 0-5 if failed
  });

  it('Test 2f: Typo Tolerance', async () => {
    // When: test_2f_typo_tolerance()
    // Then:
    //   - Query: "kirland signatur" (typo)
    //   - Result: Same results as correct spelling
    //   - Score: 8-10 if corrected, 0-3 if not
  });

  it('Test 2i: NLP Query', async () => {
    // When: test_2i_nlp_query()
    // Then:
    //   - Query: "tv for gaming under 500"
    //   - Result: TVs in correct price range
    //   - Score: 8-10 if NLP works, 0-3 if not
  });

  // ... tests for all 20 tests
});
```

### Verification

```bash
# 1. Run search audit
curl -X POST http://localhost:3000/api/audits \
  -d '{"company_domain":"costco.com","audit_type":"search-audit"}' \
  | jq '.audit_id'

# 2. Wait for browser tests complete
wscat -c ws://localhost:3000/api/audits/AUDIT_ID/live

# 3. Check test results
psql $DATABASE_URL << EOF
-- All 20 tests
SELECT test_id, test_name, passed, score, severity
FROM search_audit_tests
WHERE audit_id='AUDIT_ID'
ORDER BY test_id;
-- Expected: 20 rows

-- Failed tests
SELECT test_id, test_name, finding
FROM search_audit_tests
WHERE audit_id='AUDIT_ID' AND passed=false;

-- Score breakdown
SELECT * FROM search_audit_scoring_matrix WHERE audit_id='AUDIT_ID';
-- Expected: overall_score, 10 dimension scores

-- Screenshots
SELECT test_id, screenshot_path
FROM search_audit_tests
WHERE audit_id='AUDIT_ID' AND screenshot_path IS NOT NULL;
EOF

# 4. View screenshots
ls backend/screenshots/AUDIT_ID/
# Expected: 10-20 PNG files

# 5. Check overall score
curl http://localhost:3000/api/audits/AUDIT_ID/status | jq '.overall_search_score'
# Expected: 0-10 score
```

---

## SLICE 4: Strategic Analysis Engine

[... Continue with same detailed format for Slices 4-9 ...]

---

## Agent Assignment Commands (Copy-Paste)

### Database Fix (URGENT - P0)
```bash
claude-code "You are a database migration expert. Task: Fix Algolia Arian database migration.

Context:
- Existing DB has 14K companies + ICP data + industry data + technology data
- Migration files: data/migrations/001-008-*.sql (7 files)
- Last error: duplicate index idx_companies_search
- Must preserve ALL existing data

Steps:
1. Read data/migrations/001-008-*.sql to understand new schema
2. Query existing Supabase schema (project: xbitqeejsgqnwvxlnjra)
3. Identify conflicts (duplicate tables/indexes/columns)
4. Create WORKING_MIGRATION.sql that:
   - Uses CREATE TABLE IF NOT EXISTS
   - Uses CREATE OR REPLACE VIEW
   - Uses DO blocks for adding columns (IF NOT EXISTS checks)
   - Drops ONLY conflicting indexes before recreating
5. Test on database copy first
6. Output: Single SQL file + verification commands

Expected schema after migration:
- 26 tables (companies, audits, 11 enrichment, 2 partner, 3 search audit, 5 activity, 1 strategic)
- 13 views (latest_audits, company_overview, search_audit_scoring_matrix, etc.)

Deliverable: WORKING_MIGRATION.sql + commands to verify"
```

### Slice 1: Audit Orchestration (Agent Team 1.1)
```bash
claude-code "Build Audit Orchestration for Algolia Arian.

Reference Docs:
- backend/README.md (Phase 1A)
- backend/PHASE1A_COMPLETE.md
- data/DATABASE_EXPLAINED.md

Backend Files (5 files):
1. backend/services/audit-orchestrator.ts (300 lines)
   - createAudit(domain, type)
   - startAudit(id)
   - runEnrichment(id) → calls enrichment-orchestrator
   - runSearchAudit(id) → calls search-audit-worker
   - runStrategicAnalysis(id) → calls strategic-analysis-engine
   - generateDeliverables(id) → calls export-generator
   - Error handling & retry
   - Progress tracking via WebSocket

2. backend/api/audits/create.ts (150 lines)
   - POST /api/audits
   - Validate domain, create company if not exists
   - Create audit record (status='pending')
   - Queue BullMQ job
   - Return audit_id + websocket_url

3. backend/api/audits/[id]/status.ts (100 lines)
   - GET /api/audits/:id/status
   - Return audit status, progress, current_phase, errors

4. backend/api/audits/[id]/live.ts (200 lines)
   - WebSocket endpoint
   - Use websocket-manager.ts from backend/services/
   - Stream progress events

5. backend/workers/audit-orchestrator-worker.ts (250 lines)
   - BullMQ worker
   - Run 4 phases: enrichment → browser tests → strategic analysis → deliverables

Frontend Files (3 files):
6. frontend/src/components/audit/AuditTrigger.tsx (150 lines)
   - Input: company domain
   - Select audit type
   - POST /api/audits
   - Navigate to /audits/:id

7. frontend/src/components/audit/AuditProgress.tsx (300 lines)
   - Connect to WebSocket
   - Show 4 phases with progress bars
   - Display current step message
   - Error handling

8. frontend/src/pages/audits/[id].tsx (200 lines)
   - Audit detail page
   - Show <AuditProgress> while running
   - Show results tabs when complete

Tests (3 files):
9. backend/tests/services/audit-orchestrator.test.ts (400 lines)
10. backend/tests/api/audits.test.ts (300 lines)
11. frontend/src/components/audit/__tests__/AuditProgress.test.tsx (250 lines)

Verification:
- Create audit for costco.com
- WebSocket shows live progress
- All 4 phases complete
- audit.status='completed'
- overall_score populated

Deliverables: 11 files + verification commands"
```

### Slice 2: Enrichment Pipeline (Agent Team 1.2)
```bash
claude-code "Build Enrichment Pipeline for Algolia Arian.

Reference Docs:
- backend/README.md (Phase 1C)
- backend/PHASE1C_COMPLETE.md
- backend/services/enrichment/ (6 services already created)
- ~/.claude/skills/algolia-search-audit/memory/algolia-search-audit.md (module definitions)

Backend Files (2 files):
1. backend/workers/enrichment-worker.ts (400 lines)
   - BullMQ worker
   - Run 15 modules in 4 waves (parallel within wave)
   - Wave 1: M01-M03, M05 (company context, tech, traffic, competitors)
   - Wave 2: M04, M06-M07 (financials, hiring, strategic)
   - Wave 3: M08-M10 (investor intel, executives, buying committee)
   - Wave 4: M11-M15 (displacement, case studies, ICP, scoring, brief)
   - Emit progress after each module

2. backend/services/enrichment-orchestrator.ts (500 lines)
   - Integrate existing services from backend/services/enrichment/:
     - TrafficEnrichmentService
     - FinancialEnrichmentService
     - TechStackEnrichmentService
     - CompetitorEnrichmentService
     - ExecutiveEnrichmentService
     - HiringEnrichmentService
   - Implement all 15 module runners
   - Each module:
     - Fetches data via API clients
     - Saves to DB table
     - Generates insight
     - Emits progress

Frontend Files (2 files):
3. frontend/src/components/audit/EnrichmentStatus.tsx (400 lines)
   - Display 15 module cards in 4 waves
   - WebSocket listener for progress
   - Status badges: pending/running/completed/failed
   - Insight preview (truncated)
   - Click to view details

4. frontend/src/components/audit/EnrichmentDetails.tsx (300 lines)
   - Detailed view per module type
   - M03: Traffic table + chart
   - M02: Tech stack grid
   - M04: Financial charts
   - etc. for all 15 modules

Tests (1 file):
5. backend/tests/workers/enrichment-worker.test.ts (500 lines)
   - Test all 15 modules complete
   - Test each module individually
   - Verify data in DB tables
   - Verify insights generated

Verification:
- Run enrichment for costco.com
- All 15 modules complete
- Data in 11 enrichment tables
- All insights populated (not NULL)

Deliverables: 5 files + verification commands"
```

### Slice 3: Search Audit Tests (Agent Team 1.3)
```bash
claude-code "Build Search Audit Test Worker for Algolia Arian.

Reference Docs:
- backend/README.md (Phase 1D)
- backend/PHASE1D_COMPLETE.md
- backend/services/search-test-library.ts (20 tests already implemented)
- backend/services/search-audit-scoring.ts (10-dimension scoring)
- backend/services/browser-automation.ts (Playwright wrapper)

Backend Files (1 file):
1. backend/workers/search-audit-worker.ts (350 lines)
   - BullMQ worker
   - Use SearchTestLibrary (already exists)
   - Run all 20 tests (2a-2t)
   - Save results to search_audit_tests table
   - Capture screenshots for failed tests
   - Calculate overall score using SearchAuditScoringService
   - Update audits.overall_search_score

Frontend Files (2 files):
2. frontend/src/components/audit/SearchTestResults.tsx (400 lines)
   - Grid of 20 test cards
   - Group by 10 dimensions
   - Show passed/failed status
   - Show screenshots (click to enlarge)
   - Severity badges

3. frontend/src/components/audit/SearchScoreBreakdown.tsx (300 lines)
   - Display 10-dimension scoring breakdown
   - Show weights (Relevance 15%, Typo 15%, etc.)
   - Visual progress bars per dimension
   - Overall score at top

Tests (1 file):
4. backend/tests/workers/search-audit-worker.test.ts (600 lines)
   - Test all 20 tests run
   - Test each test individually (2a-2t)
   - Verify scoring calculation
   - Verify screenshots captured

Verification:
- Run search audit for costco.com
- 20 rows in search_audit_tests table
- search_audit_scoring_matrix view populated
- audits.overall_search_score = 0-10
- 10-20 screenshots in backend/screenshots/

Deliverables: 4 files + verification commands"
```

[... Continue with Slices 4-9 in same detailed format ...]

---

**Total Deliverables Week 1**:
- ~63 files (11 + 5 + 4 + ... per slice)
- ~20,000 lines of code
- Complete audit flow: create → enrichment (15 modules) → browser tests (20 tests) → strategic analysis → deliverables (6 files) → AI copilot
- End-to-end tested with costco.com

**Estimated Time**: 20-26 hours across 9 parallel agents
