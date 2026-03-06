# Implementation Gaps & Critical Issues

**Date**: March 6, 2026
**Source**: Analysis of VALIDATION_REPORT.md + all research documents
**Status**: 🚨 MUST RESOLVE BEFORE IMPLEMENTATION

---

## Executive Summary

The research documentation is **75-80% accurate** but contains **5 CRITICAL errors** that will block successful implementation. These are not minor issues - they represent fundamental architectural misunderstandings.

### Risk Assessment

| Category | Risk Level | Impact if Not Fixed |
|----------|-----------|---------------------|
| **MCP Architecture** | 🔴 CRITICAL | Build a system that can't connect to data sources |
| **Browser Testing** | 🔴 CRITICAL | Get blocked by WAF on 80% of audits |
| **Verification Gates** | 🔴 CRITICAL | Ship incomplete/hallucinated audits |
| **Agent Teams** | 🟡 HIGH | Parallel execution fails, runtime 3x longer |
| **Phase 5 Sub-Phases** | 🟡 HIGH | Book generation produces 21 pages instead of 30+ |

**Bottom Line**: Cannot start implementation until these 5 issues are resolved.

---

## CRITICAL ISSUE #1: MCP Architecture Decision Not Made

### The Problem

**Existing docs assume** we'll replace MCP servers with direct API calls:
> "MCP Integration Strategy: Wrap each MCP server with a REST API adapter"
> "Production will call APIs directly, NOT through MCP servers"

**Reality from /algolia-search-audit skill**:
- The skill is **fundamentally built on MCP servers**
- They're not optional wrappers - they're the architecture
- Production MUST choose:
  - **Option A**: Keep MCP (server-side MCP adapters)
  - **Option B**: Rewrite to direct APIs (30+ endpoints, 4-6 weeks work)

### Why This is Critical

**If we choose Option B** (no MCP):
- Must rewrite integrations for:
  - 14 SimilarWeb endpoints
  - 7 BuiltWith endpoints
  - 5+ Yahoo Finance endpoints
  - SEC EDGAR file parsing
  - Chrome browser automation
  - WebSearch queries
- **Estimated effort**: 4-6 weeks of API integration work
- **Risk**: Lose resilience features built into MCP tools

**If we choose Option A** (keep MCP):
- Must build server-side MCP proxy/adapter
- **Estimated effort**: 2 weeks
- **Benefit**: Reuse all skill logic as-is

### Decision Required

**Question for stakeholder**: Which option do we choose?

**Recommendation**: **Option A (Keep MCP)** because:
1. 50% faster implementation (2 weeks vs 6 weeks)
2. Reuse battle-tested skill logic
3. Future CLI skill improvements automatically flow to SaaS
4. Lower maintenance burden (don't duplicate API clients)

### What Needs to Be Documented

If Option A chosen:
- Server-side MCP adapter architecture
- Connection pooling strategy
- Error handling and retries
- Health monitoring

If Option B chosen:
- API mapping table (30+ endpoints)
- Custom client implementations
- Rate limit handling
- Fallback strategies

**Status**: 🚨 BLOCKING - Cannot start backend development without this decision

---

## CRITICAL ISSUE #2: Browser Testing Will Fail (WAF Blocks)

### The Problem

**Existing docs say**:
> "Browser Pool: Playwright OR Puppeteer with pooling"

**Reality from skill**:
- Skill uses **Chrome MCP with real Chrome** (not headless)
- Headless Playwright/Puppeteer **triggers WAF** (Akamai, Cloudflare, PerimeterX)
- Example: Tapestry audit required real Chrome to bypass Akamai

### Why This is Critical

**80% of enterprise e-commerce sites use WAF:**
- Shopify Plus → Cloudflare
- SFCC → Akamai
- BigCommerce → Cloudflare
- Custom builds → PerimeterX, DataDome

**If we use headless Playwright**:
- Phase 2 browser tests will fail with "Access Denied" pages
- No screenshots captured
- Audit marked as "failed" after 25 minutes of Phase 1 work
- User experience: "Why does it fail on every major retailer?"

### What Skill Actually Does (3 layers of resilience)

1. **Real Chrome with Remote Debugging**
   ```typescript
   await puppeteer.connect({
     browserWSEndpoint: 'ws://localhost:9222'  // NOT .launch()
   })
   ```

2. **WAF Recovery Protocol** (5 steps)
   - Detect WAF block (check for challenge HTML)
   - Switch to real Chrome (not headless)
   - Add human-like delays (1-3 sec between actions)
   - Randomize viewport size
   - If still blocked → pause and notify user (CAPTCHA intervention)

3. **Search Input Selector Resilience** (12 fallback selectors)
   ```javascript
   const SEARCH_SELECTORS = [
     'input[type="search"]',
     'input[aria-label*="search" i]',
     'input[placeholder*="search" i]',
     // ... 9 more fallbacks
   ];
   ```

### What Needs to Be Built

1. **Chrome MCP Integration**
   - Connect to Chrome MCP server
   - Launch Chrome with debugging enabled
   - Handle connection failures

2. **WAF Detection Module**
   ```typescript
   async function isWAFBlocked(page: Page): Promise<boolean> {
     const content = await page.content();
     const wafSignatures = [
       'Access Denied',
       'Request blocked',
       'cf-challenge-running',  // Cloudflare
       'akamai-access-denied',  // Akamai
       '_px3' // PerimeterX
     ];
     return wafSignatures.some(sig => content.includes(sig));
   }
   ```

3. **CAPTCHA User Intervention UI**
   - Pause audit when CAPTCHA detected
   - Show notification: "Manual CAPTCHA solving required"
   - Resume button after user solves it

### Decision Required

**Question for stakeholder**: Are we OK with Chrome MCP dependency?

**Recommendation**: **Yes, use Chrome MCP** because:
1. Without it, 80% of audits will fail
2. Alternative is manual CAPTCHA solving on EVERY audit
3. Chrome MCP is already proven (Tapestry audit worked)

**Status**: 🚨 BLOCKING - Cannot implement Phase 2 without Chrome MCP architecture

---

## CRITICAL ISSUE #3: Verification Gates Not Documented

### The Problem

**Existing docs**: Mention "validation" generically but don't document the **6 mandatory gates**.

**Reality from skill**: The skill has 6 BLOCKING verification gates. If any gate fails, the audit STOPS and shows an error.

### The 6 Gates (From Skill)

| Gate | When | What It Checks | Pass Criteria | Failure Action |
|------|------|----------------|---------------|----------------|
| **Gate 1** | After Phase 1 (Step 14) | All research completed | 14 scratchpad files exist, all >1KB | STOP audit, show "Phase 1 incomplete" |
| **Gate 2** | After Phase 2 (Step 20) | Screenshots persisted | ≥10 .png files, all >50KB | STOP audit, show "Screenshots missing" |
| **Gate 3** | After Phase 3 | All 10 areas scored | `10-scoring-matrix.md` complete | STOP audit, show "Scoring incomplete" |
| **Gate 4** | After Phase 4 (Report) | Report has all sections | 18 sections present, no `[PLACEHOLDER]` | STOP audit, show "Report incomplete" |
| **Gate 4.5** | Before Phase 5 (Book) | Data freshness + cross-reference | Revenue matches Yahoo Finance, traffic <12mo old | STOP audit, show "Stale data detected" |
| **Gate 5** | After Phase 5 (Book) | Chapter count + PDF size | ≥25 chapters, ≥28 PDF pages, ≥15 citations | STOP audit, show "Book incomplete" |

### Why This is Critical

**Without these gates**:
- Audit shows "✅ COMPLETED" but deliverables are broken
- Missing chapters in PDF book (e.g., 21 pages instead of 35)
- No screenshots (just text "See screenshot 03")
- Hallucinated data (revenue from wrong year)
- User downloads PDF, shares with exec, gets called out for errors

**With these gates**:
- Audit stops BEFORE generating broken deliverables
- Error message tells user exactly what went wrong
- User can fix (e.g., re-run Phase 2 for screenshots)
- Only "✅ COMPLETED" audits are guaranteed high quality

### What Needs to Be Documented

1. **Gate Specifications** (new doc: `VERIFICATION_GATES.md`)
   - Gate ID, name, phase, pass criteria, failure message
   - SQL queries to check gate conditions
   - UI states (how to show gate failures)

2. **API Endpoints for Gates**
   ```typescript
   // After each phase completes
   POST /audits/:id/verify-gate/:gateNumber
   // Returns: { passed: boolean, errors: string[], can_proceed: boolean }
   ```

3. **Database Schema Updates**
   ```sql
   ALTER TABLE audits ADD COLUMN gate_1_passed BOOLEAN DEFAULT FALSE;
   ALTER TABLE audits ADD COLUMN gate_2_passed BOOLEAN DEFAULT FALSE;
   -- ... up to gate_5_passed
   ALTER TABLE audits ADD COLUMN gate_failures JSONB; -- Store error details
   ```

4. **Worker Logic**
   ```typescript
   async function runPhase1(auditId: string) {
     // ... run 14 research steps
     const gate1Result = await verifyGate1(auditId);
     if (!gate1Result.passed) {
       throw new Error(`Gate 1 failed: ${gate1Result.errors.join(', ')}`);
     }
     // Proceed to Phase 2
   }
   ```

### Decision Required

**Question for stakeholder**: Should gates be configurable (e.g., skip Gate 4.5 for testing)?

**Recommendation**: **NO - Gates are mandatory** because:
1. Without gates, we ship broken audits
2. Gates are the quality assurance mechanism
3. Testing can use separate "dev mode" with gates disabled

**Status**: 🚨 BLOCKING - Must document gates before building worker logic

---

## CRITICAL ISSUE #4: MCP Services - 5 Major Inaccuracies

### The 5 Errors

#### Error 1: SimilarWeb Endpoint Count Wrong
- **Docs say**: 11 endpoints
- **Reality**: **14 endpoints**
- **Missing from docs**:
  1. `get-websites-similar-sites-agg` (competitor discovery)
  2. `get-websites-keywords-competitors-agg` (SEO keywords)
  3. `get-website-content-technologies-agg` (⛔ MANDATORY - tech stack validation)

**Impact**: Architecture underestimates SimilarWeb integration by 27%.

---

#### Error 2: SEC EDGAR MCP Missing Entirely
- **Docs**: Don't mention SEC EDGAR MCP at all
- **Reality**: Phase 1 Step 12 uses **SEC EDGAR MCP** for 10-K/10-Q filings
- **Tools used**: `search_filings()`, `get_section_text()`, `get_filing_metadata()`
- **Purpose**: Investor intelligence (requires 5-8 executive quotes from SEC filings)

**Impact**: Missing an entire MCP server from architecture. DB schema has no `mcp_calls` tracking for SEC EDGAR.

---

#### Error 3: Chrome MCP vs Playwright (Already covered in Issue #2)
- **Docs**: Say Playwright OR Puppeteer
- **Reality**: Chrome MCP with real Chrome (see Issue #2)

---

#### Error 4: WebSearch Oversimplified
- **Docs say**: "WebSearch: Perplexity API OR Tavily API"
- **Reality**: WebSearch MCP with **10+ distinct query patterns**:
  1. Executive bio search (CEO/CFO backgrounds)
  2. Hiring signal search (job postings)
  3. Earnings transcript search (investor quotes)
  4. Ticker symbol resolution (company name → stock ticker)
  5. Negative signal search (lawsuits, scandals, layoffs)
  6. Vertical context (industry-specific pain points)
  7. Competitor research (who else uses Algolia?)
  8. Case study validation (does case study company match ICP?)
  9. Strategic trigger events (M&A, funding rounds)
  10. Tech vendor partnerships (Adobe + Algolia examples)

**Impact**: Underestimates WebSearch scope. It's not just "Perplexity API" — requires 10 different prompt templates.

---

#### Error 5: BuiltWith Endpoint Count
- **Docs**: Don't specify count
- **Reality**: **7 endpoints** used:
  1. `domain-api` (primary tech stack)
  2. `relationships-api` (tech combinations)
  3. `recommendations-api` (suggested tech)
  4. `financial-api` (company size estimate)
  5. `social-api` (social media presence)
  6. `trust-api` (SSL, security)
  7. `keywords-api` (SEO keywords)

**Impact**: Need to design for 7 concurrent BuiltWith API calls per audit.

---

### What Needs to Be Documented

1. **MCP Service Inventory** (comprehensive table)
   | MCP Server | Endpoint Count | Phase Used | Purpose | Rate Limits |
   |------------|----------------|------------|---------|-------------|
   | SimilarWeb | 14 | Phase 1 | Traffic, engagement, keywords | 10 req/sec |
   | BuiltWith | 7 | Phase 1 | Tech stack | Unknown |
   | Yahoo Finance | 5 | Phase 1 | Financial data | Unknown |
   | SEC EDGAR | 3 | Phase 1 | 10-K/10-Q filings | Unknown |
   | Chrome | 20+ | Phase 2 | Browser testing | N/A (local) |
   | WebSearch | 1 (10 patterns) | Phase 1 | Narrative research | Unknown |

2. **MCP Call Tracking**
   ```sql
   CREATE TABLE mcp_calls (
     id UUID PRIMARY KEY,
     audit_id UUID REFERENCES audits(id),
     mcp_server VARCHAR(50),      -- 'similarweb', 'builtwith', 'sec_edgar', etc.
     endpoint VARCHAR(100),        -- 'get-websites-traffic', 'domain-api', etc.
     request_params JSONB,
     response_data JSONB,
     status VARCHAR(20),           -- 'success', 'error', 'rate_limited'
     error_message TEXT,
     latency_ms INTEGER,
     called_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Rate Limit Handling**
   - SimilarWeb: 10 req/sec → space out 14 calls over 2 seconds
   - BuiltWith: Unknown → implement exponential backoff
   - SEC EDGAR: Unknown → assume 1 req/sec to be safe

**Status**: 🟡 HIGH PRIORITY - Must complete before Phase 1 implementation

---

## CRITICAL ISSUE #5: Agent Teams Wave Structure Wrong

### The Problem

**Existing docs say**:
> "Agent Teams Coordinator: Parallel execution (Wave 1-4)"

**Reality from skill**: The 4 waves have **specific agent assignments** with **specific tools**:

### Actual Wave Structure (From Skill)

#### Wave 1 (4 agents parallel - ~3 minutes)
| Agent | Task | Tools Used | Output |
|-------|------|------------|--------|
| **A** | Company Context | WebSearch, Yahoo Finance | `01-company-context.md` |
| **B** | Tech Stack | BuiltWith (7 endpoints) | `02-tech-stack.md` |
| **C** | Traffic Metrics | SimilarWeb (14 endpoints) | `03-traffic-metrics.md` |
| **D** | Competitors | WebSearch, BuiltWith | `04-competitors.md` |

#### Wave 2 (5 agents parallel - ~4 minutes)
| Agent | Task | Tools Used | Output |
|-------|------|------------|--------|
| **E** | Test Queries | Read `01-company-context.md` | `05-test-queries.md` |
| **F** | Competitor Search Analysis | Chrome MCP (visit 3-5 competitor sites) | `06-competitor-search.md` |
| **G** | Strategic Angles | Read `01-04`, WebSearch | `07-strategic-angles.md` |
| **H** | Hiring Signals | WebSearch, Chrome MCP (careers page) | `09-hiring-signals.md` |
| **I** | Financial + ROI | Yahoo Finance, Read `01-03` | `08-financial-profile.md` + `11-roi-estimates.md` |

#### Wave 3 (2 agents parallel - ~5 minutes)
| Agent | Task | Tools Used | Output |
|-------|------|------------|--------|
| **J** | Investor Intelligence | WebSearch, SEC EDGAR MCP | `10-investor-intelligence.md` |
| **K** | Deep Hiring | Chrome MCP (full careers page scrape) | `12-hiring-deep-dive.md` |

#### Wave 4 (1 agent sequential - ~2 minutes)
| Agent | Task | Tools Used | Output |
|-------|------|------------|--------|
| **L** | ICP-to-Priority Mapping | Read `01-12`, scoring logic | Updates `audits.priority_score` |

**Total Phase 1 Runtime**: ~14 minutes (3+4+5+2)

### Why This is Critical

**If we implement a generic job queue** (just "parallelize Phase 1"):
- Wave dependencies are broken (Wave 2 needs Wave 1 outputs)
- Agent J tries to read files before Agent A writes them
- Chrome MCP gets 7 concurrent connections (overload)
- Race conditions everywhere

**With proper wave orchestration**:
- Wave 1 completes → THEN Wave 2 starts
- Each wave has specific concurrency limits
- Agent dependencies are respected
- Runtime stays at 14 minutes (not 40+ minutes sequential)

### What Needs to Be Built

1. **Wave Coordinator**
   ```typescript
   interface Wave {
     id: number;
     agents: Agent[];
     dependencies: number[];  // Wave IDs that must complete first
   }

   async function executePhase1(auditId: string) {
     for (const wave of WAVES) {
       // Wait for dependencies
       await waitForWaves(wave.dependencies);

       // Run all agents in this wave concurrently
       const results = await Promise.all(
         wave.agents.map(agent => runAgent(agent, auditId))
       );

       // Mark wave complete
       await markWaveComplete(auditId, wave.id);
     }
   }
   ```

2. **Agent Definition Schema**
   ```typescript
   interface Agent {
     id: string;                    // 'A', 'B', 'C', etc.
     name: string;                  // 'Company Context'
     wave: number;                  // 1, 2, 3, or 4
     tools_required: string[];      // ['WebSearch', 'YahooFinance']
     reads_files: string[];         // ['01-company-context.md']
     writes_files: string[];        // ['05-test-queries.md']
     estimated_minutes: number;     // 3
   }
   ```

3. **Job Queue with Wave Awareness**
   - BullMQ with wave-specific queues: `phase1-wave1`, `phase1-wave2`, etc.
   - Wave 2 queue only processes jobs AFTER Wave 1 completes
   - Retry logic per agent (not per wave)

### Decision Required

**Question for stakeholder**: Can we use Agent Teams parallel execution in production?

**Note**: This requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable. If this feature is not available in production Claude API, we need to rewrite to sequential agents.

**Recommendation**: **Test Agent Teams in staging first**. If it works, keep the wave structure (14-min runtime). If not, fall back to sequential (40-min runtime but simpler).

**Status**: 🟡 HIGH PRIORITY - Must decide before building Phase 1 orchestrator

---

## HIGH PRIORITY ISSUE: Phase 5 Sub-Phases Missing

### The Problem

**Existing docs say**:
> "Phase 5a: Assemble the book"

**Reality from skill**: Phase 5a is **6 incremental sub-phases** (not 1 step).

### Why This Matters

**Without incremental saves**:
- Context compaction causes chapter skipping
- LLM "forgets" to write chapters 8-13
- Book has 21 pages instead of 30+
- User sees "✅ COMPLETE" but PDF is broken

**With incremental saves** (current skill approach):
- Generate 4-5 chapters → save to disk → verify chapter count
- Next sub-phase reads saved HTML → continues from there
- Context stays fresh, no chapters skipped
- Gate 5 catches any missing chapters

### The 6 Sub-Phases (From Skill)

| Sub-Phase | Chapters Generated | Save to Disk | Verify |
|-----------|-------------------|--------------|--------|
| **5a-1** | Cover + Act I (Ch 1-4) | `{company}-book.html` | 4 chapters present |
| **5a-2** | Act II (Ch 5-13) | Append to HTML | +9 chapters (total 13) |
| **5a-3** | Act III (Ch 14-18) | Append to HTML | +5 chapters (total 18) |
| **5a-4** | Act IV (Ch 19-22) | Append to HTML | +4 chapters (total 22) |
| **5a-5** | Appendices A-F | Append to HTML | +6 sections (total 28) |
| **5a-6** | Final verification | Read HTML | ≥25 chapters, ≥15 citations |

**Total Phase 5 Runtime**: ~8-10 minutes (2 min per sub-phase)

### What Needs to Be Built

1. **Incremental HTML Builder**
   ```typescript
   async function buildBookIncremental(auditId: string) {
     let htmlBuffer = '';

     // Sub-phase 1: Cover + Act I
     htmlBuffer += await generateCoverAndActI(auditId);
     await saveToStorage(auditId, 'book-draft.html', htmlBuffer);
     await verifyChapterCount(htmlBuffer, 4);

     // Sub-phase 2: Act II
     htmlBuffer += await generateActII(auditId);
     await saveToStorage(auditId, 'book-draft.html', htmlBuffer);
     await verifyChapterCount(htmlBuffer, 13);

     // ... sub-phases 3-5

     // Sub-phase 6: Final verification (Gate 5)
     const gate5Result = await verifyGate5(auditId, htmlBuffer);
     if (!gate5Result.passed) {
       throw new Error('Gate 5 failed: Book incomplete');
     }

     // Convert HTML → PDF
     await htmlToPdf(htmlBuffer, `${company}-book.pdf`);
   }
   ```

2. **Chapter Count Verification**
   ```typescript
   function verifyChapterCount(html: string, expectedMin: number): void {
     const chapterMatches = html.match(/<h2[^>]*class="chapter-title"/g);
     const actualCount = chapterMatches?.length || 0;
     if (actualCount < expectedMin) {
       throw new Error(`Expected ≥${expectedMin} chapters, found ${actualCount}`);
     }
   }
   ```

3. **Storage Strategy**
   - Save draft HTML after each sub-phase to Vercel Blob or S3
   - If sub-phase fails, can resume from last saved draft
   - Final PDF replaces draft HTML

**Status**: 🟡 HIGH PRIORITY - Must implement before Phase 5

---

## MEDIUM PRIORITY GAPS

### Gap 1: Database Schema Missing 5 Fields

| Missing Field | Table | Type | Purpose |
|---------------|-------|------|---------|
| `ticker` | `audits` | VARCHAR(10) | Stock ticker for Yahoo Finance |
| `margin_zone` | `audits` | VARCHAR(10) | Red/Yellow/Green classification |
| `vertical_matched` | `audits` | VARCHAR(50) | Which vertical library was used |
| `case_study_primary` | `audits` | VARCHAR(100) | Which Algolia case study cited |
| `data_quality_metadata` | `scratchpad_files` | JSONB | [FACT]/[ESTIMATE] tags per claim |

**Fix**: Add these 5 columns to `audits` table in migration.

---

### Gap 2: API Endpoints Missing (9 endpoints)

**Existing docs show ~10 endpoints. Skill requires 19 endpoints.**

Missing endpoints:
1. `POST /audits/:id/pause` - Pause running audit
2. `POST /audits/:id/resume` - Resume paused audit
3. `POST /audits/:id/retry-phase` - Re-run specific phase
4. `GET /audits/:id/scratchpad/:file` - View research file
5. `PUT /audits/:id/scratchpad/:file` - Edit research data
6. `GET /audits/:id/screenshots/:file` - View screenshot
7. `POST /audits/:id/factcheck` - Run fact-check validation
8. `PUT /audits/:id/edit-query` - Edit test queries mid-audit
9. `GET /audits/:id/logs` - View execution logs

**Fix**: Add these 9 endpoints to API specification.

---

### Gap 3: Overall Score Calculation Not Documented

**Skill uses severity-weighted average**:
```typescript
function calculateOverallScore(areas: ScoringArea[]): number {
  const weights = { HIGH: 2.0, MEDIUM: 1.0, LOW: 0.5 };
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const area of areas) {
    const weight = weights[area.severity];
    totalWeightedScore += area.score * weight;
    totalWeight += weight;
  }

  return totalWeightedScore / totalWeight;
}
```

**Without this formula**: Scoring will be wrong.

**Fix**: Add weighted scoring formula to `audit_scoring` table design.

---

### Gap 4: Storage Requirements Underestimated

**Docs say**: 3 files per audit (PDF book, AE brief, signal brief)

**Reality**: **18-25 files per audit**:
- 3 deliverables (PDF, 2 markdown)
- 1 book HTML (intermediate)
- 1 CSS file
- 12 scratchpad markdown files
- 1 workspace manifest
- 10-20 screenshots

**Impact**: Storage cost estimates are 6x too low.

**Fix**: Update cost calculation to ~100-150 MB per audit (not 15 MB).

---

### Gap 5: WAF Recovery Protocol Not Documented

**Skill has 5-step escalation protocol**:
1. Detect WAF (check HTML for challenge signatures)
2. Switch to real Chrome (not headless)
3. Add human-like delays (1-3 sec randomized)
4. Randomize viewport size (not always 1920x1080)
5. If still blocked → pause audit, notify user (CAPTCHA intervention)

**Without this protocol**: 80% of audits fail at Phase 2.

**Fix**: Document WAF recovery in browser testing architecture section.

---

## Summary Table: Issue Priority

| # | Issue | Risk Level | Blocks Development | Est. Fix Time | Owner |
|---|-------|-----------|-------------------|---------------|-------|
| 1 | MCP Architecture Decision | 🔴 CRITICAL | Backend | 1 week (if Option A) | Architect |
| 2 | Browser Testing (WAF) | 🔴 CRITICAL | Phase 2 | 2 weeks | Backend Dev |
| 3 | Verification Gates | 🔴 CRITICAL | All phases | 1 week | Backend Dev |
| 4 | MCP Services (5 errors) | 🟡 HIGH | Phase 1 | 3 days | Architect |
| 5 | Agent Teams Waves | 🟡 HIGH | Phase 1 | 1 week | Backend Dev |
| 6 | Phase 5 Sub-Phases | 🟡 HIGH | Phase 5 | 3 days | Backend Dev |
| 7 | Database Schema (5 fields) | 🟢 MEDIUM | None | 1 hour | Backend Dev |
| 8 | API Endpoints (9 missing) | 🟢 MEDIUM | None | 2 days | Backend Dev |
| 9 | Scoring Formula | 🟢 MEDIUM | Phase 3 | 2 hours | Backend Dev |
| 10 | Storage Requirements | 🟢 LOW | None | 1 hour | DevOps |
| 11 | WAF Recovery | 🟢 MEDIUM | Phase 2 | 3 days | Backend Dev |

**Total Fix Time**: 4-5 weeks (if all done sequentially)
**Recommended Approach**: Fix Critical issues first (3 weeks), then High/Medium issues in parallel with development

---

## Recommended Next Steps

### Before Starting Implementation (Week 0)

1. **🚨 DECISION MEETING** (2 hours)
   - **Attendees**: Product, Engineering Lead, Architect
   - **Decisions needed**:
     - MCP Architecture: Option A (keep MCP) vs Option B (direct APIs)?
     - Agent Teams: Use in production or fall back to sequential?
     - Verification Gates: All mandatory or configurable?
   - **Outcome**: Document decisions in `ARCHITECTURE_DECISIONS.md`

2. **📝 CREATE MISSING DOCS** (3 days)
   - `VERIFICATION_GATES.md` - Full gate specifications
   - `MCP_ARCHITECTURE_V2.md` - Correct MCP integration strategy
   - `BROWSER_TESTING_RESILIENCE.md` - WAF recovery, CAPTCHA handling
   - `AGENT_TEAMS_WAVES.md` - 4-wave orchestration logic

3. **🔧 FIX EXISTING DOCS** (2 days)
   - Update `SAAS_ARCHITECTURE.md` with MCP decision
   - Add 9 missing API endpoints to API spec
   - Add 5 missing database fields to schema
   - Correct MCP service counts (14 SimilarWeb, not 11)

### Week 1 (Foundation)

1. **✅ Document review complete** (should be done by now)
2. Set up project structure (copy from algolia-arian)
3. Create `audits` table migration with all 5 missing fields
4. Set up job queue (BullMQ + Redis)
5. Implement MCP adapter (if Option A chosen)

### Week 2-3 (Phase 1)

1. Build Phase 1 orchestrator with wave coordination
2. Implement 6 verification gates
3. Add MCP call tracking to database
4. Build scratchpad file storage

### Week 4-6 (Phase 2-3)

1. Integrate Chrome MCP with WAF recovery
2. Implement Phase 2 browser testing (20 steps)
3. Build Phase 3 scoring with weighted formula
4. Add screenshot persistence

### Week 7-8 (Phase 4-5)

1. Build report generator (Phase 4)
2. Implement Phase 5 incremental book assembly (6 sub-phases)
3. Add PDF generation
4. Implement fact-check service (if time permits)

---

## Conclusion

The research documentation is **solid but incomplete**. We have:
- ✅ Great UI/UX design
- ✅ Clear user personas
- ✅ Good database schema (with minor gaps)
- ❌ Critical architectural gaps (MCP, browser, gates)
- ❌ Missing implementation details (waves, sub-phases)

**Cannot start implementation** until the 5 CRITICAL issues are resolved. Estimated fix time: **3-4 weeks** if done properly.

**Recommendation**: Spend Week 0 fixing documentation gaps, THEN start implementation. Rushing ahead will result in:
- 80% audit failure rate (WAF blocks)
- Incomplete deliverables (no gates)
- 3x longer runtime (no wave parallelization)
- Architecture refactor mid-project (MCP decision deferred)

**Better approach**: Fix the gaps now, smooth implementation later.

---

**Status**: 🚨 DOCUMENTATION GAPS IDENTIFIED - RESOLUTION REQUIRED BEFORE BUILD
**Next Action**: Schedule decision meeting with stakeholders
**Owner**: Dashboard Builder Agent (that's me!)
**Last Updated**: March 6, 2026
