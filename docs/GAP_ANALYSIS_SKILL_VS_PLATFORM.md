# Gap Analysis: Algolia Search Audit Skill vs. Arian Platform

**Date**: March 7, 2026, 11:30 PM
**Purpose**: Identify what from the `/algolia-search-audit` skill is missing in Arian platform
**Status**: ✅ Analysis Complete - Implementation Plan Updated

---

## 📊 Executive Summary

**Finding**: Arian platform has ~75% of Search Audit skill's data collection capabilities but is **missing critical processing layers and deliverables system**.

**Key Gap**: The skill produces complete sales-ready artifacts. Arian collects intelligence but has no output layer.

**Critical Difference**: Skill is a CLI tool generating static files. Arian is a web app requiring **interactive dashboard + on-demand export system**.

**User Requirement Clarified**: ✅ ALL 6 deliverables (Deck, AE Brief, Executive Summary, PDF Book, Landing Page, Content Spec) are **REQUIRED for MVP**, not optional. UI-first approach with download buttons for each deliverable.

---

## 🔍 Detailed Gap Analysis

### ✅ COVERED: Phase 1 Research (14 steps)

**What the Skill Does:**
- Step 1: Company context + financials (Yahoo Finance, BuiltWith, WebSearch)
- Step 2: Tech stack deep dive (BuiltWith 6 endpoints)
- Step 3: Traffic & engagement (SimilarWeb 11 endpoints)
- Step 4: Competitor identification (SimilarWeb)
- Step 5: Test query generation
- Step 6: Competitor search analysis
- Step 7: Strategic angles
- Step 8: Hiring signals (WebSearch)
- Step 9: Financial synthesis + ROI
- Step 10: Trigger events
- Step 11: Vertical matching
- Step 12: Investor intelligence (SEC 10-K/10-Q, earnings calls)
- Step 13: Deep hiring analysis (Chrome MCP careers page)
- Step 14: ICP-to-Priority mapping

**Arian Platform Status:**
✅ **COVERED** - All API clients planned in Phase 2 (Week 2):
- SimilarWeb (14 endpoints) ✅
- BuiltWith (7 endpoints) ✅
- Yahoo Finance (5 endpoints) ✅
- SEC Edgar (3 endpoints) ✅
- Apify (3 actors - LinkedIn, jobs, profile) ✅
- Apollo.io (2 endpoints - people search, intent signals) ✅

**Gap**: None major, but note:
- ⚠️ Skill uses SEC EDGAR MCP for 10-K/10-Q parsing - Arian needs this too
- ⚠️ Skill parses earnings call transcripts (WebFetch) - Arian needs transcript analysis

---

### ⚠️ PARTIALLY COVERED: Phase 2 Browser Testing (20 steps)

**What the Skill Does (20 specific tests):**

| Test | Description | What It Checks |
|------|-------------|----------------|
| 2a | Navigate to homepage | Page loads, search visible |
| 2b | Empty search | Returns results or suggests |
| 2c | Simple single-word query | Basic relevance |
| 2d | Multi-word query | Query understanding |
| 2e | Product-specific query | Merchandising rules |
| 2f | Typo handling | Did-you-mean suggestions |
| 2g | Synonym handling | headlamp = headlight |
| 2h | Query with filters | Faceted search works |
| 2i | Complex NLP query | "best TV for gaming under $1000" |
| 2j | Brand-specific query | Brand recognition |
| 2k | Zero-results query | Empty state handling |
| 2l | Mobile view | Responsive design |
| 2m | SAYT (autocomplete) | As-you-type suggestions |
| 2n | Sort functionality | Price, relevance, rating |
| 2o | Facet interaction | Dynamic filtering |
| 2p | Pagination | Results beyond page 1 |
| 2q | PDP recommendations | "You might also like" |
| 2r | Recent searches | Search history |
| 2s | Federated search | Content/help articles in results |
| 2t | Search analytics | Click tracking, personalization |

**Arian Platform Status:**
⚠️ **PARTIALLY COVERED**:

✅ **What's Covered**:
- `backend/services/browser-automation.ts` - Generic Playwright wrapper
- `backend/services/websocket-manager.ts` - Live streaming
- Screenshot capture
- Basic test execution
- Annotation system

❌ **What's Missing**:
- **20 specific test implementations** - The skill has detailed test logic for each
- **Test query generation algorithm** - Vertical-calibrated queries
- **Expected results validation** - minResults, contains, excludes
- **Scoring logic per test** - How each test contributes to final score
- **Issue detection** - Automatic finding generation ("No NLP", "Zero recommendations")

**Recommendation**: Add Phase 1F - Test Library (Week 1 or Week 2)

---

### ❌ NOT COVERED: Phase 3 Scoring (10 dimensions)

**What the Skill Does:**

Scores search experience across 10 dimensions (0-10 scale):

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| 1. Relevance | 15% | Query understanding, result quality |
| 2. Typo/Synonym | 15% | Error tolerance, linguistic intelligence |
| 3. Federated Search | 10% | Content, help articles in results |
| 4. SAYT/Autocomplete | 10% | As-you-type suggestions quality |
| 5. Facets & Filters | 10% | Dynamic filtering, facet UX |
| 6. Empty State | 10% | Zero-results handling |
| 7. Semantic/NLP | 10% | Natural language query understanding |
| 8. Dynamic Facets | 5% | Context-aware facets |
| 9. Recommendations | 10% | PDP recommendations, merchandising |
| 10. Intelligence | 5% | Personalization, analytics |

**Outputs:**
- `10-scoring-matrix.md` - Dimension scores + evidence
- Overall search score (e.g., 3.2/10)
- Severity classification per finding (critical, high, medium, low)

**Arian Platform Status:**
❌ **NOT COVERED**:

`backend/services/scoring.ts` exists in plan but:
- No scoring algorithm defined
- No dimension weights
- No severity classification
- No evidence linking (finding → screenshot → score)

**Recommendation**: Add `backend/services/search-audit-scoring.ts` in Phase 2 (Week 2)

---

### ❌ NOT COVERED: Phase 4 Report Generation

**What the Skill Does:**

Generates `{company}-search-audit.md` with:

| Section | Content | Source |
|---------|---------|--------|
| Executive Summary | Score, key findings, opportunity | All scratchpad files |
| Company Snapshot | Industry, revenue, tech stack | `01-company-context.md`, `02-tech-stack.md` |
| Strategic Intelligence | Investor quotes, trigger events | `11-investor-intelligence.md`, `06-strategic-context.md` |
| "In Their Own Words" | Executive quotes with attribution | `11-investor-intelligence.md` |
| Competitor Landscape | Competitor matrix, search providers | `04-competitors.md` |
| Findings | 5-8 major gaps with screenshots | `09-browser-findings.md`, `10-scoring-matrix.md` |
| Opportunities | Algolia solutions mapped to gaps | Findings + solution mapping |
| ROI Estimate | Revenue funnel, 3-year projection | `08-financial-profile.md` |
| ICP Mapping | Which personas care about which findings | `12-icp-priority-mapping.md` |

**Arian Platform Status:**
❌ **NOT COVERED**:

No report generation service planned. Would need:
- `backend/services/report-generator.ts`
- Markdown templating system
- Scratchpad → Report synthesis logic
- Source citation linking

**Recommendation**: Add Phase 1G - Report Generation (Week 2)

---

### ✅ BETTER APPROACH: Web App with On-Demand PDF Export

**Your Design is Superior**:
```
┌──────────────────────────────────────────────────────────┐
│  Arian Dashboard                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Tabs: Overview | Strategic | Tech | Competitors  │  │
│  │       Traffic | Financials | Hiring | Audit      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────┐       │
│  │  [Current Section Content]                    │       │
│  │  • Interactive charts, filterable tables      │       │
│  │  • Real-time updates as enrichment completes  │       │
│  │  [ 📄 Download This Section as PDF ]         │       │
│  └───────────────────────────────────────────────┘       │
│                                                           │
│  [ 📕 Download Complete Binder (All Sections) ]         │
└──────────────────────────────────────────────────────────┘
```

**Why Your Approach Wins**:
- ✅ Progressive disclosure (not overwhelming)
- ✅ Selective sharing (download only what's relevant)
- ✅ Real-time updates (sections update as enrichment completes)
- ✅ Interactive exploration (charts, filters, search)
- ✅ Flexibility (customize view, then export)

**What to Build**:
1. **8 Section Tabs** (Overview, Strategic, Tech, Competitors, Traffic, Financials, Hiring, Audit)
2. **Per-Section PDF Export** - Click "Download" on any tab → instant PDF
3. **Complete Binder Export** - Assembles all sections into one 40-50 page PDF with TOC
4. **PDF Export Engine** - `backend/services/pdf-export-engine.ts`

**Recommendation**: Add **Phase 1H: PDF Export Engine** (Week 1, 3-4 hours)

---

## 🎯 Critical Missing Components

### 1. Scratchpad Workspace System

**What the Skill Has:**
```
{company}-audit-workspace/
├── 01-company-context.md        [Company overview + financials]
├── 02-tech-stack.md             [BuiltWith deep dive]
├── 03-traffic-data.md           [SimilarWeb 11 endpoints]
├── 04-competitors.md            [Competitor analysis]
├── 05-test-queries.md           [Vertical-calibrated queries]
├── 06-strategic-context.md      [Trigger events, angles]
├── 07-hiring-signals.md         [Job postings, careers page]
├── 08-financial-profile.md      [3-year financials, ROI]
├── 09-browser-findings.md       [20 test results]
├── 10-scoring-matrix.md         [10 dimensions scored]
├── 11-investor-intelligence.md  [10-K, earnings calls]
├── 12-icp-priority-mapping.md   [Persona mapping]
├── screenshots/                 [All test screenshots]
└── _workspace-manifest.md       [Progress tracking]
```

**Arian Platform:**
- ❌ No scratchpad concept
- ❌ No intermediate file structure
- ❌ All data in database JSONB (harder to template)

**Recommendation**: Add scratchpad system as temporary working directory during audit execution

---

### 2. Test Query Generation Algorithm

**What the Skill Does:**
- Analyzes company vertical (retail, marketplace, B2B, publishing, travel)
- Generates 12-15 vertical-calibrated test queries:
  - 3-4 simple queries (product names, categories)
  - 3-4 complex queries (multi-word, filters)
  - 2-3 NLP queries ("best X for Y under $Z")
  - 2-3 edge cases (typos, synonyms, zero-results)
- Validates queries against product catalog
- Stores in `05-test-queries.md`

**Arian Platform:**
- ❌ No test query generation
- ❌ User must manually enter queries

**Recommendation**: Add `backend/services/test-query-generator.ts` in Phase 2

---

### 3. Screenshot Annotation Engine

**What the Skill Does:**
- Auto-detects issue location in screenshot:
  - Empty results area → box around "No results" message
  - Typo input → box around search input
  - Poor relevance → box around first 3 irrelevant results
- Adds annotations: boxes, arrows, labels
- Saves annotated screenshots

**Arian Platform:**
- ✅ Basic annotation interface planned (frontend)
- ❌ No auto-detection algorithm

**Recommendation**: Add `backend/services/annotation-engine.ts` in Phase 1D

---

### 4. Source Citation System

**What the Skill Does:**
- EVERY data point hyperlinked:
  - Financial → Yahoo Finance URL
  - Traffic → SimilarWeb URL
  - Tech → BuiltWith URL
  - Hiring → Careers page URL
  - Investor quotes → Transcript/10-K URL with page number
- `SourcedData<T>` wrapper pattern
- Bibliography generation

**Arian Platform:**
- ✅ `backend/utils/source-citation.ts` planned
- ❌ No automatic citation linking in reports
- ❌ No bibliography generation

**Recommendation**: Enhance source citation system to support bibliography

---

### 5. Brand Validation System

**What the Skill Does:**
- Validates all deliverables against Algolia brand standards:
  - Colors (Nebula Blue #003DFF, Space Gray #21243D, Purple #5468FF)
  - Fonts (Source Sans Pro, 16px base)
  - Logo placement and sizing
  - Spacing (60px margins, 40px section gaps)
  - Screenshot layout (60/40 split)
  - Status badges (Hot/Warm/Cold)
- 11 editorial standards enforced
- Pre-delivery validation gates

**Arian Platform:**
- ❌ No brand validation system
- ❌ No editorial standards enforcement

**Recommendation**: Add `backend/services/brand-validator.ts` in Phase 3

---

### 6. Multi-Agent Orchestration (Agent Teams)

**What the Skill Does:**
- Spawns 12+ agents in 4 parallel waves
- Agent A, B, C, D run Wave 1 (research) in parallel
- Agent E-I run Wave 2 (synthesis) after Wave 1
- Agent J-K run Wave 3 (deep intel) after Wave 2
- Sequential synthesis in Wave 4
- Parallel deliverable generation in Phase 5

**Arian Platform:**
- ✅ BullMQ queue for background jobs
- ⚠️ No agent orchestration system
- ⚠️ Workers run jobs, but not coordinated agents

**Recommendation**: Add `backend/services/agent-orchestrator.ts` for coordinated audit execution

---

## 🏗️ Recommended Architecture Updates

### Phase 1F: Test Library & Scoring (Week 1)

**New Files** (3 files, ~800 lines):
1. `backend/services/search-test-library.ts` - 20 test implementations
2. `backend/services/test-query-generator.ts` - Vertical-calibrated query generation
3. `backend/services/search-audit-scoring.ts` - 10-dimension scoring algorithm

---

### Phase 1G: Report Generation (Week 2)

**New Files** (2 files, ~600 lines):
1. `backend/services/report-generator.ts` - Scratchpad → Report synthesis
2. `backend/templates/report-template.md` - Report markdown template

---

### Phase 2: Enhanced API Clients (Week 2)

**Update Existing**:
- Add SEC EDGAR 10-K/10-Q section parsing
- Add earnings call transcript fetching (WebFetch)
- Add executive quote extraction

---

### Phase 3: Deliverable Generation (Week 5-6)

**New Files** (6 files, ~2,000 lines):
1. `backend/services/deliverable-generator.ts` - Master deliverable orchestrator
2. `backend/services/pdf-generator.ts` - HTML → PDF (Playwright headless)
3. `backend/services/brand-validator.ts` - Algolia brand compliance
4. `backend/templates/book-template.html` - Search Audit Book HTML
5. `backend/templates/landing-page-template.html` - Landing page HTML
6. `backend/templates/deck-template.md` - Presentation deck markdown

---

### Database Schema Updates

**New Tables** (3 tables):

```sql
-- Store scratchpad files during audit execution
CREATE TABLE audit_scratchpad (
  audit_id UUID REFERENCES audits(id),
  file_name TEXT NOT NULL,  -- 01-company-context.md, etc.
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (audit_id, file_name)
);

-- Store test query results
CREATE TABLE audit_test_results (
  audit_id UUID REFERENCES audits(id),
  test_id TEXT NOT NULL,  -- 2a, 2b, etc.
  test_name TEXT NOT NULL,
  query TEXT,
  passed BOOLEAN NOT NULL,
  finding TEXT,
  severity TEXT,  -- critical, high, medium, low
  screenshot_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (audit_id, test_id)
);

-- Store generated deliverables
CREATE TABLE audit_deliverables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID REFERENCES audits(id),
  deliverable_type TEXT NOT NULL,  -- book, landing_page, deck, ae_brief, signal_brief
  file_path TEXT NOT NULL,  -- S3 or Vercel Blob URL
  file_size_bytes INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 Updated Phase 1 Summary

### Before (Current Plan)

| Phase | Files | Lines | Status |
|-------|-------|-------|--------|
| 1A: Infrastructure | 9 | ~750 | Planned |
| 1B: Data Services | 6 | ~850 | Planned |
| 1C: Production | 8 | ~740 | Planned |
| 1D: Browser | 4 | ~700 | Planned |
| 1E: Copilot | 6 | ~1,150 | Planned |
| **Total** | **33** | **~4,190** | |

### After (With Gaps Filled)

| Phase | Files | Lines | Status |
|-------|-------|-------|--------|
| 1A: Infrastructure | 9 | ~750 | Planned |
| 1B: Data Services | 6 | ~850 | Planned |
| 1C: Production | 8 | ~740 | Planned |
| 1D: Browser | 4 | ~700 | Planned |
| 1E: Copilot | 6 | ~1,150 | Planned |
| **1F: Test Library** | 3 | ~800 | **NEW** |
| **1G: Report Gen** | 2 | ~600 | **NEW** |
| **Total** | **38** | **~5,590** | |

**Impact**: +5 files, +1,400 lines, +2-3 hours

---

## 🎯 Critical Decisions Needed

### Decision 1: When to Add Missing Components?

**Option A: Add to Phase 1 (Week 1)**
- ✅ Complete foundation from day 1
- ✅ No technical debt
- ❌ Longer Phase 1 (9-12 hours instead of 7-9)
- ❌ More agents needed (7 instead of 5)

**Option B: Add in Phase 2-3 (Week 2-6)**
- ✅ Smaller Phase 1
- ✅ Can validate core architecture first
- ❌ Technical debt
- ❌ May need refactoring

**Recommendation**: **Option B** - Add progressively
- Phase 1: Core + Browser + Copilot (as planned)
- Phase 2: Test Library + Scoring + Enhanced API clients
- Phase 3: Report Generation + Deliverables

---

### Decision 2: Scratchpad vs. Database-Only?

**Option A: Scratchpad System (Like Skill)**
- ✅ Easy templating (scratchpad → report)
- ✅ Human-readable intermediate artifacts
- ✅ Can resume from any point
- ❌ More file I/O
- ❌ Cleanup needed after audit

**Option B: Database-Only (Current Plan)**
- ✅ All data in one place
- ✅ No file cleanup
- ❌ Harder to template
- ❌ Less human-readable

**Recommendation**: **Hybrid**
- Store enrichment data in database (companies, audits tables)
- Generate scratchpad files during audit execution (temp directory)
- Use scratchpad for report/deliverable generation
- Archive scratchpad to S3 after completion

---

### Decision 3: Agent Teams or BullMQ Workers?

**Option A: Agent Teams (Like Skill)**
- ✅ Coordinated parallel execution
- ✅ Can spawn 12+ agents
- ✅ Wave-based dependencies
- ❌ More complex orchestration
- ❌ Requires agent SDK

**Option B: BullMQ Workers (Current Plan)**
- ✅ Proven job queue system
- ✅ Retry logic built-in
- ✅ Monitoring tools available
- ❌ No agent coordination
- ❌ Sequential execution per worker

**Recommendation**: **Option B (BullMQ)** for MVP
- BullMQ workers can handle parallelization via job prioritization
- Add agent orchestration later if needed (Phase 4+)

---

## 🚨 Critical Gaps Prioritized

| Priority | Gap | Impact | Recommendation |
|----------|-----|--------|----------------|
| **P0** | 20 browser tests | Without these, can't score audits | Add Phase 1F (Week 1) |
| **P0** | Scoring algorithm | Without scoring, no audit value | Add Phase 1F (Week 1) |
| **P1** | Report generation | Without report, no deliverable | Add Phase 1G (Week 2) |
| **P1** | Test query generation | Manual queries = poor UX | Add Phase 2 (Week 2) |
| **P1** | **Complete Deliverables System** | **ALL REQUIRED for MVP** | **Add Phase 2B (Week 3-4)** |
| | - Presentation Deck (30-33 slides) | Sales teams need formatted decks | Markdown + brand templates |
| | - AE Pre-Call Brief (5 pages) | Sales engineers need prep docs | Structured markdown export |
| | - Executive Summary (1 page) | Executives need 1-page overview | Part of deck or standalone |
| | - PDF Book (36-47 pages) | PRIMARY deliverable, executive presentation | HTML→PDF conversion |
| | - Landing Page (HTML) | Marketing asset, dual-view | Brand-validated HTML template |
| | - Content Spec (Markdown) | Landing page content source | Structured markdown |
| **P2** | Per-screen exports | Good UX, not blocking | Add Phase 2B (Week 3-4) |
| **P2** | Brand validation | Quality check, not blocker | Add Phase 3 (Week 5-6) |
| **P3** | Agent orchestration | Optimization, not required | Add Phase 4+ (post-MVP) |

---

## ✅ Recommendations Summary

### Immediate (Week 1):
1. ✅ Keep Phase 1A-1E as planned (Infrastructure, Data, Production, Browser, Copilot)
2. ⚠️ Add Phase 1F: Test Library & Scoring (3 files, ~800 lines, +2 hours)
3. ⚠️ Add Phase 1G: Report Generation (2 files, ~600 lines, +1 hour)

**Updated Phase 1**: 38 files, ~5,590 lines, 10-12 hours (7 agents)

### Week 2:
1. Build API clients (as planned)
2. Enhance with SEC EDGAR parsing, transcript analysis
3. Add test query generation algorithm

### Week 3-4 (Phase 2B): Complete Deliverables System
**ALL 6 DELIVERABLES REQUIRED FOR MVP**

1. **Per-Screen Export System**:
   - Per-screen exports (JSON, CSV, PDF from UI screens)
   - Full audit export (comprehensive JSON with all data)

2. **Complete Deliverables System** (ALL REQUIRED):
   - **Presentation Deck** (30-33 slides, Markdown + brand templates)
   - **AE Pre-Call Brief** (5 pages, structured markdown)
   - **Executive Summary** (1 page, standalone or part of deck)
   - **PDF Book** (36-47 pages, HTML→PDF - PRIMARY deliverable)
   - **Landing Page** (HTML, marketing asset, dual-view)
   - **Content Spec** (Markdown, landing page content source)

3. **Export Infrastructure**:
   - `backend/services/export-generator.ts` - Master export orchestrator
   - `backend/services/deck-generator.ts` - McKinsey Pyramid deck with speaker notes
   - `backend/services/ae-brief-generator.ts` - AE pre-call prep document
   - `backend/services/pdf-book-generator.ts` - HTML→PDF book generator (PRIMARY)
   - `backend/services/landing-page-generator.ts` - Marketing landing page
   - `backend/services/content-spec-generator.ts` - Content spec markdown
   - `backend/templates/` - Brand-validated templates for all 6 deliverables
     - `book-template.html` - PDF Book template with 11 editorial standards
     - `deck-template.md` - Presentation deck template
     - `ae-brief-template.md` - AE brief template
     - `landing-page-template.html` - Landing page template
     - `content-spec-template.md` - Content spec template

### Week 5-6 (Phase 3):
1. Add brand validation system (quality gates)
2. Add annotation engine enhancements (auto-detection)
3. Enhanced UI features (live preview, annotation interface)

### Post-MVP (Phase 4+):
1. Agent orchestration for parallel Wave execution
2. Advanced personalization (recommendations, merchandising)
3. A/B testing framework for audit variations
4. Additional export formats (Google Slides, PowerPoint, etc.)

---

**Status**: 🔴 **CRITICAL GAPS IDENTIFIED** - Recommend expanding Phase 1 to include Test Library + Scoring
**Next Step**: User decision on which gaps to address when
**Owner**: Architecture Team
**Last Updated**: March 7, 2026
