# Algolia Arian - Week 1 Build Orchestration (Multi-Agent Autonomous)

**For**: Claude Code Opus 4.5+ with multi-agent capability
**Mode**: Fully autonomous - spawns and coordinates all sub-agents
**No human intervention required**

---

## Master Agent Directive

```
You are the Master Orchestrator for Algolia Arian Week 1 build. Your role:

1. **Database Fix** (Agent DB) - BLOCKING, must complete first
2. **Core Audit Engine** (Team 1: 4 agents in parallel)
3. **Deliverables** (Team 2: 2 agents in parallel)
4. **AI Copilot** (Team 3: 3 agents in parallel)

You will spawn ALL agents, coordinate execution, handle dependencies, and verify completion.

Reference Documentation:
- Project: /Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/algolia-arian/
- Backend specs: backend/README.md, backend/PHASE1*.md
- Database: data/README.md, data/migrations/001-008
- Features: docs/features/COPILOT_ARCHITECTURE.md, docs/GAP_ANALYSIS_SKILL_VS_PLATFORM.md
- Day 1 status: backend/PHASE1A_COMPLETE.md through PHASE1E_COMPLETE.md

Working directory: /Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/algolia-arian/
```

---

## Phase 1: Database Migration (BLOCKING)

**Agent**: general-purpose (needs file read + bash)
**Blocking**: All other agents wait for this to complete
**Task ID**: `db-migration`

**Agent Directive**:
```
Task: Fix database migration for Algolia Arian while preserving all existing data.

Context:
- Existing Supabase DB (project: xbitqeejsgqnwvxlnjra) has:
  - 14,000+ companies (in companies table)
  - ICP data (in various ICP tables)
  - Industry data (in industry-related tables)
  - Technology data (in technology tables)
- New schema: data/migrations/001-008-*.sql (7 migration files, 26 tables, 13 views)
- Last error: "ERROR: 42P07: relation 'idx_companies_search' already exists"
- Problem: Duplicate indexes/tables between old and new schema

Steps (execute autonomously):

1. READ MIGRATION FILES:
   - data/migrations/001-create-core-tables.sql
   - data/migrations/002-create-enrichment-tables.sql
   - data/migrations/003-create-partner-intel-tables.sql
   - data/migrations/004-create-search-audit-tables.sql (SKIP - removed)
   - data/migrations/005-create-activity-tables.sql
   - data/migrations/006-create-views.sql
   - data/migrations/007-create-indexes.sql
   - data/migrations/008-add-strategic-insights.sql

2. QUERY EXISTING SCHEMA:
   Use Bash with supabase CLI:
   ```bash
   cd /Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My\ Drive/AI/MarketingProject/algolia-arian
   supabase db execute --sql "SELECT tablename FROM pg_tables WHERE schemaname='public'" > /tmp/existing_tables.txt
   supabase db execute --sql "SELECT indexname FROM pg_indexes WHERE schemaname='public'" > /tmp/existing_indexes.txt
   supabase db execute --sql "SELECT table_name FROM information_schema.views WHERE table_schema='public'" > /tmp/existing_views.txt
   ```

3. CREATE SAFE MIGRATION (WORKING_MIGRATION.sql):
   Write to: data/migrations/999-safe-migration.sql

   Rules:
   - ALL CREATE TABLE statements: Use IF NOT EXISTS
   - ALL CREATE INDEX statements: DROP INDEX IF EXISTS first, then CREATE
   - ALL CREATE VIEW statements: Use CREATE OR REPLACE VIEW
   - Column additions: Use DO blocks with IF NOT EXISTS checks
   - NEVER use: DROP TABLE, TRUNCATE, DELETE
   - Skip migration 004 (conflicts with 009)

   Special handling for intent_signals table:
   - Already has confidence_score column (NUMERIC(5,2) for signal confidence 0-100)
   - Don't add duplicate confidence_score for insights
   - Only add: insight TEXT, evidence_urls TEXT[]

4. TEST MIGRATION:
   ```bash
   # Dry run
   supabase db execute --dry-run --file data/migrations/999-safe-migration.sql
   ```

5. APPLY MIGRATION:
   ```bash
   supabase db execute --file data/migrations/999-safe-migration.sql
   ```

6. VERIFY:
   ```bash
   # Count tables (expect 26+)
   supabase db execute --sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"

   # Count views (expect 13+)
   supabase db execute --sql "SELECT COUNT(*) FROM information_schema.views WHERE table_schema='public'"

   # Verify company count unchanged
   supabase db execute --sql "SELECT COUNT(*) FROM companies"
   # Expected: 14000+ (NO DATA LOSS)

   # Verify new tables exist
   supabase db execute --sql "SELECT COUNT(*) FROM search_audit_tests"
   # Expected: 0 rows (table exists but empty)
   ```

Success Criteria:
- ✅ 26+ tables exist
- ✅ 13+ views exist
- ✅ 14,000+ companies preserved
- ✅ search_audit_tests table queryable
- ✅ company_strategic_analysis table queryable

Output:
- data/migrations/999-safe-migration.sql (working migration)
- Verification report with table counts

If errors occur: Analyze error, fix migration file, retry. Do NOT proceed to Phase 2 until database is ready.
```

---

## Phase 2: Core Audit Engine (4 Parallel Agents)

**Wait for**: Phase 1 complete
**Agent Team**: Team 1 (4 agents)
**Execution**: All 4 agents run in parallel

### Agent 1.1: Audit Orchestration

**Agent**: general-purpose
**Task ID**: `audit-orchestration`

**Agent Directive**:
```
Task: Build audit orchestration system - the master controller for running audits.

Reference:
- backend/README.md (Phase 1A spec)
- backend/PHASE1A_COMPLETE.md (if exists, shows what's done)
- data/DATABASE_EXPLAINED.md (database schema)

Files to Create (5 backend, 3 frontend, 3 tests = 11 files):

BACKEND:
1. backend/services/audit-orchestrator.ts
   Class: AuditOrchestrator
   Methods:
   - createAudit(domain: string, type: 'partner-intel' | 'search-audit'): Promise<Audit>
     * Check if company exists in DB, create if not
     * Create audit record with status='pending'
     * Return audit object

   - startAudit(auditId: string): Promise<void>
     * Update status='running'
     * Queue enrichment job
     * Wait for enrichment complete
     * Queue search audit job
     * Wait for search audit complete
     * Queue strategic analysis job
     * Wait for strategic analysis complete
     * Queue deliverables job
     * Update status='completed'

   - runEnrichment(auditId: string): Promise<void>
     * Calls enrichment-orchestrator.ts (built by Agent 1.2)
     * Emits WebSocket progress events

   - runSearchAudit(auditId: string): Promise<void>
     * Calls search-audit-worker.ts (built by Agent 1.3)
     * Emits WebSocket progress events

   - runStrategicAnalysis(auditId: string): Promise<void>
     * Calls strategic-analysis-engine.ts (built by Agent 1.4)
     * Emits WebSocket progress events

   - generateDeliverables(auditId: string): Promise<void>
     * Calls export-generator.ts (to be built in Phase 3)
     * Emits WebSocket progress events

   - handleError(auditId: string, error: Error): Promise<void>
     * Log error to audit_log table
     * Update audit.error_message
     * Retry if retry_count < 3

   - updateProgress(auditId: string, phase: string, percent: number, message: string): Promise<void>
     * Emit WebSocket event via websocket-manager.ts (from Day 1)

2. backend/api/audits/create.ts
   POST /api/audits
   Request body: { company_domain: string, audit_type: string }
   Steps:
   - Validate domain (use validator library)
   - Call orchestrator.createAudit()
   - Queue audit job in BullMQ
   - Return: { audit_id, websocket_url: `ws://localhost:3000/api/audits/${id}/live` }

3. backend/api/audits/[id]/status.ts
   GET /api/audits/:id/status
   Query audit from DB
   Return: { id, status, overall_score, current_phase, progress_percent, error_message }

4. backend/api/audits/[id]/live.ts
   WebSocket endpoint
   Use WebSocketManager from backend/services/websocket-manager.ts (Day 1)
   On connect:
   - Join room `audit:${auditId}`
   - Stream events: { event: 'progress', phase, percent, message }
   - Stream events: { event: 'complete', audit_id }
   - Stream events: { event: 'error', error }

5. backend/workers/audit-orchestrator-worker.ts
   BullMQ worker
   Queue: 'audits'
   Process:
   ```typescript
   const worker = new Worker('audits', async (job: Job) => {
     const { auditId } = job.data;
     const orchestrator = new AuditOrchestrator();
     await orchestrator.startAudit(auditId);
   });
   ```

FRONTEND:
6. frontend/src/components/audit/AuditTrigger.tsx
   React component
   - Input field for company domain
   - Radio buttons for audit type (partner-intel | search-audit)
   - Submit button
   - POST to /api/audits
   - On success: navigate to /audits/:id
   - Show validation errors

7. frontend/src/components/audit/AuditProgress.tsx
   React component with WebSocket
   Props: { auditId: string }
   - Connect to ws://localhost:3000/api/audits/:id/live
   - Display 4 phase cards:
     * Phase 1: Enrichment (0-25%)
     * Phase 2: Search Tests (25-50%)
     * Phase 3: Strategic Analysis (50-75%)
     * Phase 4: Deliverables (75-100%)
   - Each phase shows:
     * Status badge (pending | running | completed | failed)
     * Progress bar
     * Current step message
   - When complete: Show "View Results" button

8. frontend/src/pages/audits/[id].tsx
   Next.js page
   - Fetch audit status on mount
   - If status is 'pending' or 'running': show <AuditProgress>
   - If status is 'completed': show tabs (Overview, Enrichment, Search Tests, Strategic, Deliverables)
   - If status is 'failed': show error message + retry button

TESTS:
9. backend/tests/services/audit-orchestrator.test.ts
   Test suite with 10+ tests:
   - createAudit with valid domain
   - createAudit with invalid domain (should throw)
   - startAudit runs all 4 phases
   - Error handling and retry logic
   - Progress events emitted
   - WebSocket disconnection handling

10. backend/tests/api/audits.test.ts
    API integration tests:
    - POST /api/audits with valid data
    - POST /api/audits with invalid data
    - GET /api/audits/:id/status
    - WebSocket connection and events

11. frontend/src/components/audit/__tests__/AuditProgress.test.tsx
    React Testing Library tests:
    - WebSocket connection on mount
    - Progress updates render correctly
    - Phase transitions work
    - Error state displays
    - Complete state shows "View Results"

VERIFICATION (run autonomously):
```bash
# Start backend
cd backend && npm run dev &

# Create test audit
AUDIT_ID=$(curl -X POST http://localhost:3000/api/audits \
  -H "Content-Type: application/json" \
  -d '{"company_domain":"costco.com","audit_type":"search-audit"}' \
  | jq -r '.audit_id')

# Check status
curl http://localhost:3000/api/audits/$AUDIT_ID/status | jq

# Expected: { "status": "pending", ... }

# Verify database
supabase db execute --sql "SELECT id, status FROM audits WHERE id='$AUDIT_ID'"
# Expected: 1 row with status='pending'
```

Success Criteria:
- ✅ All 11 files created
- ✅ POST /api/audits returns audit_id
- ✅ WebSocket connection works
- ✅ Audit record in database
- ✅ Tests pass

Dependencies:
- Needs: websocket-manager.ts (from Day 1)
- Needed by: Agents 1.2, 1.3, 1.4 (will call orchestrator methods)
```

### Agent 1.2: Enrichment Pipeline

**Agent**: general-purpose
**Task ID**: `enrichment-pipeline`

**Agent Directive**:
```
Task: Build enrichment pipeline that runs 15 data collection modules in 4 waves.

Reference:
- backend/README.md (Phase 1C spec)
- backend/PHASE1C_COMPLETE.md
- backend/services/enrichment/ (6 services already built on Day 1)
- ~/.claude/skills/algolia-search-audit/memory/algolia-search-audit.md (module definitions)

Files to Create (2 backend, 2 frontend, 1 test = 5 files):

BACKEND:
1. backend/workers/enrichment-worker.ts
   BullMQ worker
   Queue: 'enrichment'
   Process function runs 15 modules in 4 waves (parallel within wave):

   Wave 1 (run in parallel):
   - M01: Company Context (WebSearch for founded year, HQ, employees)
   - M02: Technology Stack (BuiltWith domain-lookup)
   - M03: Traffic Analysis (SimilarWeb traffic-and-engagement)
   - M05: Competitor Intelligence (SimilarWeb similar-sites)

   Wave 2 (run in parallel):
   - M04: Financial Profile (Yahoo Finance stock info + financials)
   - M06: Hiring Signals (Apify LinkedIn jobs scraper)
   - M07: Strategic Context (WebSearch for recent news, press releases)

   Wave 3 (run in parallel):
   - M08: Investor Intelligence (WebSearch for 10-K, 10-Q, earnings transcripts)
   - M09: Executive Intelligence (Apollo.io or LinkedIn for executives)
   - M10: Buying Committee (Apollo.io for decision makers)

   Wave 4 (run in parallel):
   - M11: Displacement Analysis (check competitors' search providers)
   - M12: Case Study Matching (match industry vertical to Algolia case studies)
   - M13: ICP Priority Mapping (score against ICP criteria)
   - M14: Signal Scoring (calculate fit/intent/value/displacement scores)
   - M15: Strategic Brief (synthesize all data into insights)

   After each module:
   - Save data to respective DB table
   - Generate insight (save to insight column)
   - Emit progress: websocketManager.emit(`audit:${auditId}`, { event: 'progress', module, percent })

2. backend/services/enrichment-orchestrator.ts
   Class: EnrichmentOrchestrator

   Integrates existing services from backend/services/enrichment/:
   - TrafficEnrichmentService (Day 1)
   - FinancialEnrichmentService (Day 1)
   - TechStackEnrichmentService (Day 1)
   - CompetitorEnrichmentService (Day 1)
   - ExecutiveEnrichmentService (Day 1)
   - HiringEnrichmentService (Day 1)

   Methods:
   - runWave1(companyId, auditId): Promise<void>
     * Runs M01, M02, M03, M05 in parallel (Promise.all)
   - runWave2(companyId, auditId): Promise<void>
     * Runs M04, M06, M07 in parallel
   - runWave3(companyId, auditId): Promise<void>
     * Runs M08, M09, M10 in parallel
   - runWave4(companyId, auditId): Promise<void>
     * Runs M11, M12, M13, M14, M15 in parallel

   Each module implementation:
   - runM01_CompanyContext(): Fetch company data, enrich, save to companies table
   - runM02_TechnologyStack(): Call techService.getTechStack(), save to company_technologies
   - runM03_TrafficAnalysis(): Call trafficService.getTraffic(), save to company_traffic, generate insight if bounce_rate > 50%
   - runM04_FinancialProfile(): Call financeService.getFinancials(), save to company_financials
   - runM05_CompetitorIntelligence(): Call competitorService.getCompetitors(), save to company_competitors
   - runM06_HiringSignals(): Call hiringService.getJobs(), save to company_hiring
   - runM07_StrategicContext(): WebSearch for news, save to audit notes
   - runM08_InvestorIntelligence(): WebSearch for SEC filings, save to executive_quotes
   - runM09_ExecutiveIntelligence(): Call executiveService.getExecutives(), save to company_executives
   - runM10_BuyingCommittee(): Apollo.io or LinkedIn, save to buying_committee
   - runM11_DisplacementAnalysis(): Analyze competitors, save to displacement_opportunities
   - runM12_CaseStudyMatching(): Match vertical to case studies
   - runM13_ICPPriorityMapping(): Score against ICP criteria
   - runM14_SignalScoring(): Calculate composite scores
   - runM15_StrategicBrief(): Synthesize insights

FRONTEND:
3. frontend/src/components/audit/EnrichmentStatus.tsx
   React component
   Props: { auditId: string }

   WebSocket listener:
   ```typescript
   const [modules, setModules] = useState<Map<string, ModuleStatus>>();

   useEffect(() => {
     const ws = new WebSocket(`ws://localhost:3000/api/audits/${auditId}/live`);
     ws.onmessage = (event) => {
       const { module, status, insight } = JSON.parse(event.data);
       setModules(prev => new Map(prev).set(module, { status, insight }));
     };
   }, [auditId]);
   ```

   Render 4 wave sections, each with module cards:
   - Wave 1: M01-M03, M05 (4 cards)
   - Wave 2: M04, M06-M07 (3 cards)
   - Wave 3: M08-M10 (3 cards)
   - Wave 4: M11-M15 (5 cards)

   Each module card shows:
   - Module name (e.g., "M03: Traffic Analysis")
   - Status badge (pending/running/completed/failed)
   - Insight preview (first 100 chars)
   - "View Details" button

4. frontend/src/components/audit/EnrichmentDetails.tsx
   React component
   Props: { auditId: string, module: string }

   Fetch module data: useSWR(`/api/audits/${auditId}/enrichment/${module}`)

   Render based on module type:
   - M03 (Traffic): Table with monthly_visits, bounce_rate, traffic sources
   - M02 (Tech): Grid of detected technologies with categories
   - M04 (Financials): Charts for revenue, cash flow, P&L
   - M05 (Competitors): List of competitors with similarity scores
   - M06 (Hiring): Table of job postings with keywords highlighted
   - M09 (Executives): Cards for each executive with contact info
   - ... etc for all 15 modules

TESTS:
5. backend/tests/workers/enrichment-worker.test.ts
   Integration tests:
   - Test all 15 modules complete successfully
   - Test each module individually (M01-M15)
   - Test data saved to correct DB tables
   - Test insights generated (not NULL)
   - Test error handling for API failures
   - Test retry logic

VERIFICATION:
```bash
# Queue enrichment job
curl -X POST http://localhost:3000/api/audits \
  -d '{"company_domain":"costco.com","audit_type":"partner-intel"}' \
  | jq -r '.audit_id'

# Wait for completion (WebSocket will show progress)

# Verify data in DB
supabase db execute --sql "
  SELECT
    (SELECT COUNT(*) FROM company_traffic WHERE audit_id='AUDIT_ID') as traffic_rows,
    (SELECT COUNT(*) FROM company_technologies WHERE audit_id='AUDIT_ID') as tech_rows,
    (SELECT COUNT(*) FROM company_financials WHERE audit_id='AUDIT_ID') as finance_rows,
    (SELECT COUNT(*) FROM company_competitors WHERE audit_id='AUDIT_ID') as competitor_rows,
    (SELECT COUNT(*) FROM company_executives WHERE audit_id='AUDIT_ID') as exec_rows,
    (SELECT COUNT(*) FROM company_hiring WHERE audit_id='AUDIT_ID') as hiring_rows
"
# Expected: All counts > 0

# Check insights
supabase db execute --sql "
  SELECT insight FROM company_traffic WHERE audit_id='AUDIT_ID' AND insight IS NOT NULL LIMIT 1
"
# Expected: Non-empty insight text
```

Success Criteria:
- ✅ All 5 files created
- ✅ All 15 modules execute
- ✅ Data in 11 enrichment tables
- ✅ Insights generated (not NULL)
- ✅ Tests pass

Dependencies:
- Needs: enrichment services from Day 1 (backend/services/enrichment/)
- Needed by: Agent 1.4 (strategic analysis reads enrichment data)
```

### Agent 1.3: Search Audit Tests

**Agent**: general-purpose
**Task ID**: `search-audit-tests`

**Agent Directive**:
```
Task: Build search audit test worker that runs 20 browser-based tests using Playwright.

Reference:
- backend/README.md (Phase 1D spec)
- backend/PHASE1D_COMPLETE.md
- backend/services/search-test-library.ts (20 tests already implemented on Day 1)
- backend/services/search-audit-scoring.ts (10-dimension scoring already implemented)
- backend/services/browser-automation.ts (Playwright wrapper from Day 1)

Files to Create (1 backend, 2 frontend, 1 test = 4 files):

BACKEND:
1. backend/workers/search-audit-worker.ts
   BullMQ worker
   Queue: 'search-audit'

   Process function:
   ```typescript
   import { SearchTestLibrary } from '../services/search-test-library';
   import { BrowserAutomation } from '../services/browser-automation';
   import { SearchAuditScoringService } from '../services/search-audit-scoring';

   const worker = new Worker('search-audit', async (job: Job) => {
     const { companyId, auditId, companyDomain } = job.data;

     const browser = new BrowserAutomation();
     const testLibrary = new SearchTestLibrary(browser);
     const scoring = new SearchAuditScoringService();

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
       { id: '2r', name: 'Analytics', fn: () => testLibrary.test_2r_analytics_tracking() },
       { id: '2s', name: 'Federated Search', fn: () => testLibrary.test_2s_federated_search() },
       { id: '2t', name: 'Personalization', fn: () => testLibrary.test_2t_personalization() }
     ];

     for (const test of tests) {
       try {
         const result = await test.fn();

         await db.insert('search_audit_tests', {
           company_id: companyId,
           audit_id: auditId,
           test_id: test.id,
           test_name: test.name,
           query: result.query,
           passed: result.passed,
           score: result.score,
           finding: result.finding,
           severity: result.severity,
           evidence: result.evidence,
           screenshot_path: result.screenshotPath,
           metadata: result.metadata
         });

         const progress = (tests.indexOf(test) + 1) / tests.length * 100;
         await websocketManager.emit(`audit:${auditId}`, {
           event: 'progress',
           phase: 'browser_tests',
           percent: progress,
           message: `${test.name} complete`
         });

       } catch (error) {
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

     // Calculate overall score
     const overallScore = await scoring.calculateScore(auditId);
     await db.update('audits', { id: auditId }, { overall_search_score: overallScore });
   });
   ```

FRONTEND:
2. frontend/src/components/audit/SearchTestResults.tsx
   React component
   Props: { auditId: string }

   Fetch: useSWR(`/api/audits/${auditId}/search-tests`)

   Group tests by 10 dimensions (from scoring algorithm):
   - Relevance (tests 2c, 2d, 2e)
   - Typo & Synonym (tests 2f, 2g)
   - Federated Search (test 2s)
   - SAYT (test 2m)
   - Facets & Filters (tests 2h, 2o)
   - Empty State (test 2k)
   - Semantic/NLP (test 2i)
   - Dynamic Facets (tests 2o, 2t)
   - Recommendations (test 2q)
   - Intelligence (tests 2r, 2t)

   Render:
   - Overall score card (0-10)
   - 10 dimension sections, each with:
     * Dimension name + weight (e.g., "Relevance - 15%")
     * Dimension score (0-10)
     * Progress bar
     * Test cards for that dimension

   Test card shows:
   - Test name
   - Pass/fail badge
   - Score (0-10)
   - Finding text
   - Severity badge (CRITICAL/HIGH/MEDIUM/LOW)
   - Screenshot thumbnail (click to enlarge)

3. frontend/src/components/audit/SearchScoreBreakdown.tsx
   React component
   Props: { auditId: string }

   Fetch: useSWR(`/api/audits/${auditId}/scoring-matrix`)

   Display 10 dimensions with visual breakdown:
   - Relevance: 15% weight, score X/10
   - Typo & Synonym: 15% weight, score X/10
   - Federated Search: 10% weight, score X/10
   - SAYT: 10% weight, score X/10
   - Facets & Filters: 10% weight, score X/10
   - Empty State: 10% weight, score X/10
   - Semantic/NLP: 10% weight, score X/10
   - Dynamic Facets: 5% weight, score X/10
   - Recommendations: 10% weight, score X/10
   - Intelligence: 5% weight, score X/10

   Visual: Horizontal stacked bar chart showing weighted contribution to overall score

TESTS:
4. backend/tests/workers/search-audit-worker.test.ts
   Integration tests:
   - All 20 tests execute
   - Test results saved to search_audit_tests table
   - Screenshots captured for failures
   - Overall score calculated
   - Each individual test (2a-2t) works correctly

VERIFICATION:
```bash
# Run search audit
AUDIT_ID=$(curl -X POST http://localhost:3000/api/audits \
  -d '{"company_domain":"costco.com","audit_type":"search-audit"}' \
  | jq -r '.audit_id')

# Wait for completion

# Check test results
supabase db execute --sql "
  SELECT test_id, test_name, passed, score, severity
  FROM search_audit_tests
  WHERE audit_id='$AUDIT_ID'
  ORDER BY test_id
"
# Expected: 20 rows

# Check scoring
supabase db execute --sql "
  SELECT * FROM search_audit_scoring_matrix WHERE audit_id='$AUDIT_ID'
"
# Expected: overall_score + 10 dimension scores

# Check screenshots
ls backend/screenshots/$AUDIT_ID/
# Expected: 10-20 PNG files
```

Success Criteria:
- ✅ All 4 files created
- ✅ 20 tests execute
- ✅ search_audit_tests table has 20 rows
- ✅ Overall score calculated (0-10)
- ✅ Screenshots captured
- ✅ Tests pass

Dependencies:
- Needs: search-test-library.ts, search-audit-scoring.ts, browser-automation.ts (from Day 1)
```

### Agent 1.4: Strategic Analysis

**Agent**: general-purpose
**Task ID**: `strategic-analysis`

**Agent Directive**:
```
Task: Build strategic analysis engine that synthesizes all enrichment data into strategic insights.

Reference:
- data/migrations/008-add-strategic-insights.sql (schema)
- data/STRATEGIC_INSIGHTS_MARCH7.md (architecture)

Files to Create (2 backend, 1 frontend, 1 test = 4 files):

BACKEND:
1. backend/services/strategic-analysis-engine.ts
   Class: StrategicAnalysisEngine

   Method: synthesize(companyId: string, auditId: string): Promise<StrategicAnalysis>

   Steps:
   1. Read ALL enrichment data:
      - company_traffic (insight + data)
      - company_financials (insight + data)
      - company_technologies (insight + data)
      - company_competitors (insight + data)
      - company_executives (insight + data)
      - executive_quotes (insight + quotes)
      - company_hiring (insight + job postings)
      - intent_signals (insights)
      - buying_committee (personas)

   2. Analyze patterns:
      - Identify primary Algolia value prop (search_relevance | scale_performance | mobile_experience | conversion_optimization | personalization | time_to_market | operational_efficiency)
      - Extract trigger events (earnings calls, hiring signals, tech changes)
      - Identify timing signals (why now?)
      - Flag caution signals (layoffs, hiring freeze)

   3. Generate strategic outputs:
      - sales_pitch: Synthesized narrative with quantified business impact
      - business_impact: "$X.XM revenue at risk from poor search" (use traffic + revenue data)
      - strategic_recommendations: How Algolia can help (3-5 bullet points)
      - trigger_events: Array of notable events
      - timing_signals: Array of "why now" signals
      - caution_signals: Array of risk factors
      - overall_confidence_score: 8.0-10.0 (based on data completeness)

   4. Save to company_strategic_analysis table:
      ```sql
      INSERT INTO company_strategic_analysis (
        company_id, audit_id,
        primary_value_prop, secondary_value_props,
        sales_pitch, business_impact, strategic_recommendations,
        trigger_events, timing_signals, caution_signals,
        overall_confidence_score, insights_synthesized_from
      ) VALUES (...)
      ```

FRONTEND:
2. frontend/src/components/audit/StrategicInsights.tsx
   React component
   Props: { auditId: string }

   Fetch: useSWR(`/api/audits/${auditId}/strategic-analysis`)

   Render sections:
   - Primary Value Prop badge (large, prominent)
   - Secondary Value Props (smaller badges)
   - Sales Pitch (2-3 paragraphs with business impact highlighted)
   - Strategic Recommendations (bulleted list with Algolia solutions)
   - Timing Intelligence:
     * Trigger Events (timeline view)
     * Why Now Signals (green badges)
     * Caution Signals (yellow/red badges)
   - Confidence Score (0-10 gauge)
   - Data Sources (which modules contributed)

TESTS:
3. backend/tests/services/strategic-analysis-engine.test.ts
   Unit tests:
   - Synthesize with complete data (all modules)
   - Synthesize with partial data (some modules missing)
   - Primary value prop selection logic
   - Business impact calculation
   - Confidence score calculation
   - Database insert

VERIFICATION:
```bash
# After enrichment completes, run strategic analysis
supabase db execute --sql "
  SELECT
    primary_value_prop,
    overall_confidence_score,
    array_length(trigger_events, 1) as trigger_count,
    array_length(insights_synthesized_from, 1) as module_count
  FROM company_strategic_analysis
  WHERE audit_id='$AUDIT_ID'
"
# Expected: 1 row with confidence >= 8.0, module_count >= 10
```

Success Criteria:
- ✅ All 4 files created
- ✅ Strategic analysis synthesizes all enrichment data
- ✅ company_strategic_analysis table populated
- ✅ Confidence score >= 8.0
- ✅ Tests pass

Dependencies:
- Needs: Agent 1.2 complete (enrichment data)
```

---

## Phase 3: Deliverables Generation (2 Parallel Agents)

**Wait for**: Phase 2 complete
**Agent Team**: Team 2 (2 agents)
**Execution**: Both agents run in parallel

### Agent 2.1: Report Generators

**Agent**: general-purpose
**Task ID**: `report-generators`

**Agent Directive**:
```
Task: Build 6 deliverable generators (report, deck, AE brief, PDF book, landing page, content spec).

Reference:
- backend/services/report-generator.ts (from Day 1)
- backend/templates/ (6 templates from Day 1)
- docs/GAP_ANALYSIS_SKILL_VS_PLATFORM.md (deliverables spec)

Files to Create (7 backend, 1 frontend, 2 tests = 10 files):

BACKEND:
1. backend/services/export-generator.ts
   Master orchestrator for all 6 deliverables

   Method: generateAll(auditId: string): Promise<void>
   - Call all 6 generators in parallel
   - Save file paths to audit_deliverables table

2. backend/services/deck-generator.ts
   Generate McKinsey Pyramid deck (30-33 slides)
   - Read strategic analysis + enrichment data
   - Use backend/templates/deck-template.md
   - Generate slides with speaker notes
   - Save as Markdown + optionally convert to PPTX

3. backend/services/ae-brief-generator.ts
   Generate AE pre-call brief (5 pages)
   - Use backend/templates/ae-brief-template.md
   - Include: company overview, tech stack, search findings, talking points

4. backend/services/pdf-book-generator.ts
   Generate PDF book (36-47 pages) - PRIMARY deliverable
   - Use backend/templates/book-template.html
   - Render HTML with 11 editorial standards
   - Convert to PDF via Playwright headless print

5. backend/services/landing-page-generator.ts
   Generate landing page (HTML)
   - Use backend/templates/landing-page-template.html
   - Dual view: executive summary + technical details
   - Source citations as badges

6. backend/services/content-spec-generator.ts
   Generate content spec (Markdown)
   - Use backend/templates/content-spec-template.md
   - Content source for landing page

7. backend/api/audits/[id]/deliverables.ts
   GET /api/audits/:id/deliverables
   - Fetch from audit_deliverables table
   - Return array of { type, file_path, file_size, generated_at }

FRONTEND:
8. frontend/src/components/audit/DeliverablesList.tsx
   React component
   Props: { auditId: string }

   Fetch: useSWR(`/api/audits/${auditId}/deliverables`)

   Render 6 deliverable cards:
   - Presentation Deck (.md or .pptx)
   - AE Pre-Call Brief (.pdf)
   - Executive Summary (.pdf)
   - PDF Book (.pdf) - marked as PRIMARY
   - Landing Page (.html)
   - Content Spec (.md)

   Each card:
   - Icon for file type
   - File size
   - Generated timestamp
   - Download button
   - Preview button (for HTML/MD)

TESTS:
9. backend/tests/services/export-generator.test.ts
   - Test all 6 generators execute
   - Test files saved to audit_deliverables
   - Test file paths valid

10. backend/tests/services/deck-generator.test.ts
    - Test deck generation with sample data
    - Verify 30+ slides
    - Verify speaker notes included

VERIFICATION:
```bash
# After audit complete, check deliverables
supabase db execute --sql "
  SELECT deliverable_type, file_path, file_size_bytes
  FROM audit_deliverables
  WHERE audit_id='$AUDIT_ID'
"
# Expected: 6 rows

# Check files exist
ls backend/deliverables/$AUDIT_ID/
# Expected: 6 files
```

Success Criteria:
- ✅ All 10 files created
- ✅ 6 deliverables generated
- ✅ audit_deliverables table has 6 rows
- ✅ Files downloadable
- ✅ Tests pass

Dependencies:
- Needs: report-generator.ts and templates from Day 1
```

### Agent 2.2: Data Exports

**Agent**: general-purpose
**Task ID**: `data-exports`

**Agent Directive**:
```
Task: Add JSON/CSV/PDF export functionality to all data tables.

Reference:
- docs/GAP_ANALYSIS_SKILL_VS_PLATFORM.md (P2 requirements)

Files to Create (3 backend, 1 frontend, 1 test = 5 files):

BACKEND:
1. backend/api/exports/traffic.ts
   GET /api/exports/traffic/:auditId?format=json|csv|pdf
   - Query company_traffic table
   - Return in requested format

2. backend/api/exports/financials.ts
   GET /api/exports/financials/:auditId?format=json|csv|pdf

3. backend/api/exports/search-tests.ts
   GET /api/exports/search-tests/:auditId?format=json|csv|pdf

FRONTEND:
4. frontend/src/components/common/ExportButton.tsx
   Reusable export button component
   Props: { auditId: string, dataType: string }
   - Dropdown with JSON/CSV/PDF options
   - Click triggers download

TESTS:
5. backend/tests/api/exports.test.ts
   - Test JSON export
   - Test CSV export
   - Test PDF export

Success Criteria:
- ✅ All 5 files created
- ✅ Exports work for all formats
- ✅ Download triggers correctly
```

---

## Phase 4: AI Copilot Integration (3 Parallel Agents)

**Wait for**: Phase 2 complete (can run parallel with Phase 3)
**Agent Team**: Team 3 (3 agents)
**Execution**: All 3 agents run in parallel

### Agent 3.1: Chat UI

**Agent**: general-purpose
**Task ID**: `chat-ui`

**Agent Directive**:
```
Task: Build chat UI for AI copilot.

Reference:
- docs/features/COPILOT_ARCHITECTURE.md
- backend/api/copilot/chat.ts (from Day 1)
- backend/services/copilot.ts (from Day 1)

Files to Create (3 frontend, 1 test = 4 files):

FRONTEND:
1. frontend/src/components/copilot/ChatPanel.tsx
   Main chat interface
   - Message history
   - SSE streaming for responses
   - Typing indicator
   - Error handling

2. frontend/src/components/copilot/ChatMessage.tsx
   Message bubble component
   - User vs assistant styling
   - Markdown rendering
   - Code syntax highlighting

3. frontend/src/components/copilot/ChatInput.tsx
   Input field with suggestions
   - Autocomplete
   - Keyboard shortcuts
   - File upload (optional)

TESTS:
4. frontend/src/components/copilot/__tests__/ChatPanel.test.tsx
   - Test SSE connection
   - Test message rendering
   - Test streaming responses

Success Criteria:
- ✅ All 4 files created
- ✅ Chat UI functional
- ✅ SSE streaming works
- ✅ Tests pass

Dependencies:
- Needs: backend/api/copilot/chat.ts (from Day 1)
```

### Agent 3.2: Inline Help

**Agent**: general-purpose
**Task ID**: `inline-help`

**Agent Directive**:
```
Task: Add inline copilot help buttons to all sections with proactive insights.

Files to Create (2 frontend, 1 test = 3 files):

FRONTEND:
1. frontend/src/components/copilot/InlineHelp.tsx
   Help button component
   Props: { context: string }
   - Click opens copilot with pre-filled context
   - Positioned relative to section

2. frontend/src/components/copilot/ProactiveInsights.tsx
   Auto-popup insights when issues detected
   Props: { trigger: string, message: string }
   - Shows when bounce rate > 50%
   - Shows when search score < 5
   - Suggests copilot questions

TESTS:
3. frontend/src/components/copilot/__tests__/InlineHelp.test.tsx

Success Criteria:
- ✅ All 3 files created
- ✅ Help buttons on every section
- ✅ Proactive insights trigger correctly
```

### Agent 3.3: RAG Documentation

**Agent**: general-purpose
**Task ID**: `rag-documentation`

**Agent Directive**:
```
Task: Seed copilot RAG with Algolia documentation and skill docs.

Reference:
- backend/services/copilot-rag.ts (from Day 1)
- ~/.claude/skills/algolia-search-audit/ (skill documentation)

Files to Create (1 backend script, 1 test = 2 files):

BACKEND:
1. backend/scripts/seed-rag.ts
   Script to index documentation:
   - Algolia docs (fetch from algolia.com/docs)
   - Skill documentation (read from ~/.claude/skills/algolia-search-audit/)
   - Save to pgvector
   - Create embeddings via OpenAI API

TESTS:
2. backend/tests/services/copilot-rag.test.ts
   - Test document indexing
   - Test similarity search
   - Test retrieval accuracy

VERIFICATION:
```bash
# Run seed script
npm run seed-rag

# Test RAG retrieval
curl -X POST http://localhost:3000/api/copilot/chat \
  -d '{"message":"How does Algolia handle typos?"}' \
  | jq

# Expected: Response cites Algolia docs
```

Success Criteria:
- ✅ All 2 files created
- ✅ Documentation indexed
- ✅ RAG retrieval works
```

---

## Final Verification (Master Agent)

After all agents complete, Master Agent runs final verification:

```bash
# 1. Database check
supabase db execute --sql "
  SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') as tables,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema='public') as views,
    (SELECT COUNT(*) FROM companies) as companies
"
# Expected: 26+ tables, 13+ views, 14000+ companies

# 2. End-to-end audit test
AUDIT_ID=$(curl -X POST http://localhost:3000/api/audits \
  -d '{"company_domain":"costco.com","audit_type":"search-audit"}' \
  | jq -r '.audit_id')

# Wait for completion (10-15 minutes)
while true; do
  STATUS=$(curl http://localhost:3000/api/audits/$AUDIT_ID/status | jq -r '.status')
  echo "Status: $STATUS"
  if [ "$STATUS" = "completed" ]; then break; fi
  sleep 30
done

# 3. Verify all data populated
supabase db execute --sql "
  SELECT
    (SELECT COUNT(*) FROM company_traffic WHERE audit_id='$AUDIT_ID') as traffic,
    (SELECT COUNT(*) FROM search_audit_tests WHERE audit_id='$AUDIT_ID') as tests,
    (SELECT COUNT(*) FROM audit_deliverables WHERE audit_id='$AUDIT_ID') as deliverables,
    (SELECT overall_search_score FROM audits WHERE id='$AUDIT_ID') as score
"
# Expected: traffic=12, tests=20, deliverables=6, score=0-10

# 4. Test copilot
curl -X POST http://localhost:3000/api/copilot/chat \
  -d "{\"message\":\"What is Costco's bounce rate?\",\"audit_id\":\"$AUDIT_ID\"}" \
  | jq -r '.response'
# Expected: Response with actual bounce rate from data

# 5. Download deliverable
curl http://localhost:3000/api/audits/$AUDIT_ID/deliverables \
  | jq -r '.[0].file_path' \
  | xargs curl -O
# Expected: File downloaded
```

---

## Success Criteria (Week 1 Complete)

Master Agent verifies ALL criteria met:

- ✅ Database: 26+ tables, 13+ views, 14K companies preserved
- ✅ Audit creation: POST /api/audits works
- ✅ Enrichment: 15 modules execute, data in 11 tables
- ✅ Search tests: 20 tests execute, scoring works
- ✅ Strategic analysis: Synthesizes data, insights generated
- ✅ Deliverables: 6 files generated per audit
- ✅ Exports: JSON/CSV/PDF exports work
- ✅ Copilot: Chat responds to queries about audit data
- ✅ End-to-end: costco.com audit completes with all deliverables
- ✅ Tests: All test suites pass

**Deliverables**: ~70 files, ~25,000 lines of code, fully autonomous execution

---

## How to Execute This Plan

**Copy-paste this single command**:

```bash
cd /Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My\ Drive/AI/MarketingProject/algolia-arian && claude-code "You are the Master Orchestrator for Algolia Arian Week 1 build. Execute the complete multi-agent orchestration plan from ORCHESTRATION_MASTER.md. Spawn all agents, coordinate execution, verify completion. No human intervention required."
```

That's it. The Master Agent will:
1. Read this file
2. Spawn Agent DB (Phase 1) - wait for complete
3. Spawn Team 1 (Phase 2) - 4 agents in parallel
4. Spawn Team 2 (Phase 3) - 2 agents in parallel
5. Spawn Team 3 (Phase 4) - 3 agents in parallel
6. Run final verification
7. Report results

**Total execution time**: 6-8 hours autonomous
