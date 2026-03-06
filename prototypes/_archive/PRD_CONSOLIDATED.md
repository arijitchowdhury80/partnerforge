# Product Requirements Document
# Algolia Search Audit Platform (SaaS)

**Document Version**: 1.0
**Date**: March 3, 2026
**Status**: Draft for Review
**Author**: Product Team
**Stakeholders**: Engineering, Sales, Marketing, Customer Success

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Vision & Goals](#product-vision--goals)
3. [User Personas](#user-personas)
4. [Core Features](#core-features)
5. [User Stories](#user-stories)
6. [System Architecture](#system-architecture)
7. [Data Model](#data-model)
8. [API Specification](#api-specification)
9. [UI/UX Requirements](#uiux-requirements)
10. [Non-Functional Requirements](#non-functional-requirements)
11. [Success Metrics](#success-metrics)
12. [Implementation Roadmap](#implementation-roadmap)
13. [Risks & Mitigation](#risks--mitigation)
14. [Open Questions](#open-questions)

---

## Executive Summary

### Problem Statement

Algolia's sales and marketing teams currently run search audits manually using a CLI-based Claude Code skill (`/algolia-search-audit`). This process requires:
- Technical knowledge of CLI tools and MCP servers
- 40+ hours of manual research and data collection per audit
- Expert knowledge of search UX best practices and Algolia products
- Manual quality control and fact-checking

**Result**: Only ~10-15 audits/year produced, limited to technical users, inconsistent quality.

### Solution

Build a **self-service SaaS platform** that automates the entire search audit workflow:
- **Input**: Prospect domain (e.g., `costco.com`)
- **Processing**: 5-phase automated pipeline (research → browser testing → scoring → report → deliverables)
- **Output**: 3 production-ready deliverables (PDF book, AE brief, signal brief)
- **Time**: 35 minutes end-to-end (vs 40 hours manual)
- **Quality**: Built-in verification gates and fact-checking

### Business Impact

| Metric | Current (CLI) | Target (SaaS) | Improvement |
|--------|---------------|---------------|-------------|
| **Audits/Year** | 10-15 | 500+ | **33x increase** |
| **Time per Audit** | 40 hours | 35 minutes | **98% reduction** |
| **Quality Score** | Variable | 8.5/10 avg | **Consistent** |
| **User Access** | 5 technical users | 200+ all GTM | **40x expansion** |
| **Cost per Audit** | ~$2,000 (labor) | ~$12 (compute) | **99% savings** |

### Success Criteria

**Phase 1 (MVP - Month 4)**:
- ✅ 50 audits run successfully
- ✅ 90%+ completion rate (Gate 5 passing)
- ✅ 8.0+ average brand compliance score
- ✅ <5% error rate

**Phase 2 (Scale - Month 8)**:
- ✅ 500+ audits/year run rate
- ✅ 95%+ user satisfaction (NPS 50+)
- ✅ 35-minute p50 runtime
- ✅ 5 concurrent audits supported

---

## Product Vision & Goals

### Vision Statement

"Enable every Algolia GTM team member to produce world-class search audit reports on-demand, with zero technical knowledge required."

### Strategic Goals

1. **Democratize Audit Access**: From 5 CLI experts → 200+ sales/marketing users
2. **Accelerate Deal Velocity**: Deliver audits in first call (35 min) vs days later
3. **Increase Pipeline Quality**: 500+ audits/year = better targeting and qualification
4. **Standardize Quality**: Automated gates ensure consistent, fact-checked output
5. **Scale Best Practices**: Codify expert knowledge (Baymard UX, SAIM stats, case studies)

### Anti-Goals (Out of Scope for v1.0)

- ❌ Customer-facing self-service (internal tool only)
- ❌ API for 3rd party integrations
- ❌ White-label / reseller capabilities
- ❌ Competitive intelligence on Algolia's own search
- ❌ Post-audit CRM workflow automation (Phase 2)

---

## User Personas

### Persona 1: Marketing Manager (Primary)
**Name**: Sarah Chen
**Role**: Senior Product Marketing Manager
**Goal**: Generate polished audit reports for ABM campaigns without technical knowledge

**Pain Points**:
- Doesn't know how to use CLI/MCP servers
- Needs high-quality PDFs ready for executive presentations
- Requires fast turnaround (same-day delivery)
- Must ensure brand compliance (Algolia guidelines)

**Success Metric**: Can start full audit in <2 clicks, receives PDF book via email when done

**Key Jobs to Be Done**:
- JTBD-1: Create audit report for target account list (10-20 companies)
- JTBD-2: Download PDF and share with AE for upcoming meeting
- JTBD-3: Verify all data sources are cited (execs will fact-check)

---

### Persona 2: Account Executive (Secondary)
**Name**: Marcus Thompson
**Role**: Enterprise AE
**Goal**: Quick pre-call research, customize test queries for demo, generate AE brief format

**Pain Points**:
- Needs ultra-fast turnaround (audit during prospecting call)
- Wants to edit test queries to match prospect's product catalog
- Requires internal-only "AE brief" format (not customer-facing PDF)
- Needs to re-run phases when data changes

**Success Metric**: Can run research-only phase in 10 minutes, export AE brief instantly

**Key Jobs to Be Done**:
- JTBD-1: Run Phase 1 (research) before discovery call
- JTBD-2: Generate "Speaking Their Language" section (ICP mapping)
- JTBD-3: Re-run browser tests after prospect launches new site

---

### Persona 3: Partner Marketing (Advanced)
**Name**: Priya Desai
**Role**: Partner Marketing Manager
**Goal**: Batch process multiple prospects, identify displacement opportunities, aggregate insights

**Pain Points**:
- Needs to run 10+ audits overnight (batch mode)
- Wants pipeline view of all audits with filtering
- Requires CSV export for analysis in Excel/Tableau
- Needs to identify "golden angle" (competitor using Algolia)

**Success Metric**: Can queue 10 audits overnight, see aggregate insights across prospects

**Key Jobs to Be Done**:
- JTBD-1: Upload CSV of 50 domains, queue batch audit
- JTBD-2: Filter audits by "competitor uses Algolia = true"
- JTBD-3: Export competitor matrix for partner enablement deck

---

### Persona 4: Sales Engineer (Power User)
**Name**: Jordan Lee
**Role**: Principal Solutions Consultant
**Goal**: Deep competitive intelligence, customize scoring, edit findings, debug failures

**Pain Points**:
- Needs full control over phases and parameters
- Wants to edit research data (fix errors in Phase 1 data)
- Requires access to execution logs for debugging
- Needs to override scoring weights for specific verticals

**Success Metric**: Can pause after Phase 1, edit test queries, resume with custom parameters

**Key Jobs to Be Done**:
- JTBD-1: Run Phase 1 only, inspect research data in database, then continue
- JTBD-2: Edit test queries table to add 5 custom queries
- JTBD-3: Debug why browser test failed (view execution logs)

---

## Core Features

### F1: Audit Lifecycle Management

#### F1.1: Create New Audit (Wizard)
**Priority**: MUST
**Complexity**: High
**Story Points**: 13

**Description**: 4-step guided wizard to configure and launch an audit.

**User Flow**:
1. **Step 1**: Enter domain (e.g., `costco.com`), optional company name, vertical
2. **Step 2**: Select audit mode (Full / Research Only / Browser Only / Deliverables Only)
3. **Step 3**: Optional custom test queries (or auto-generate from vertical)
4. **Step 4**: Review config, click "Start Audit"

**Validation Rules**:
- Domain must be valid URL format
- Check if domain already audited (show existing audit, offer re-run)
- If domain is Algolia customer (BuiltWith quick check), block audit with warning

**Technical Requirements**:
- Call `POST /api/audits/create` with config JSON
- Return `audit_id` and redirect to Execution Monitor

---

#### F1.2: Real-Time Execution Monitor
**Priority**: MUST
**Complexity**: Very High
**Story Points**: 21

**Description**: Live progress tracking with phase-by-phase status updates via WebSocket.

**Components**:
- **Progress Bar**: 0-100% with current phase label
- **Phase Cards**: 5 cards showing phase status (pending/running/complete/failed)
- **Current Step**: "Phase 2: Browser Testing (Step 12/20)" with substep detail
- **Estimated Time**: Remaining time based on historical averages
- **Live Logs**: Scrolling log window with timestamped events (info/warning/error)
- **Actions**: Pause, Cancel, View Full Logs

**WebSocket Events**:
```typescript
// Server → Client events
{
  "event": "progress_update",
  "audit_id": "uuid",
  "phase": 2,
  "phase_name": "Browser Testing",
  "step": 12,
  "step_total": 20,
  "progress_pct": 55.0,
  "message": "Testing typo tolerance: 'orgnic vegetabls' → 538 results",
  "level": "info"
}

{
  "event": "screenshot_captured",
  "audit_id": "uuid",
  "file_name": "05-typo-organic.png",
  "query": "orgnic vegetabls",
  "thumbnail_url": "https://s3.../thumb.png"
}

{
  "event": "phase_complete",
  "audit_id": "uuid",
  "phase": 2,
  "phase_name": "Browser Testing",
  "duration_sec": 720,
  "screenshots_captured": 15
}

{
  "event": "audit_complete",
  "audit_id": "uuid",
  "overall_score": 4.4,
  "deliverables": [
    {"type": "book", "url": "https://s3.../book.pdf"},
    {"type": "ae_brief", "url": "https://s3.../brief.md"},
    {"type": "signal_brief", "url": "https://s3.../signal.md"}
  ]
}

{
  "event": "error",
  "audit_id": "uuid",
  "phase": 2,
  "step": 8,
  "error_code": "WAF_BLOCKED",
  "message": "Site blocked by Akamai WAF - user intervention required",
  "actions": ["retry", "skip_browser_tests", "cancel"]
}
```

**Technical Requirements**:
- WebSocket connection per audit (Socket.IO)
- Reconnection handling (auto-reconnect on disconnect)
- Event persistence (catch-up on reconnect)

---

#### F1.3: Audit Detail View (5 Tabs)
**Priority**: MUST
**Complexity**: High
**Story Points**: 21

**Description**: Deep-dive view with 5 tabs for completed audits.

**Tab 1: Overview**
- Status badge (Completed/Failed/Needs Review)
- Overall score meter (speedometer gauge)
- Key metrics (runtime, critical gaps, opportunity range)
- Timeline visualization (phase durations)
- Quick actions (Re-run, Download All, Share, Delete)

**Tab 2: Research Data**
- 10 collapsible sections (one per Phase 1 research module)
- Each section: module name, data table, queryable fields, edit capability
- Sections: Company Data, Executives, Tech Stack, Traffic Metrics, Competitors, Test Queries, Financial Data, ROI Estimates, Investor Quotes, Hiring Signals
- Source URLs clickable

**Tab 3: Browser Findings**
- Screenshot gallery (grid view with hover zoom)
- Each screenshot: query, severity, observation, timestamp
- Filter by severity (All/Critical/Warning/Pass)
- Download individual or batch

**Tab 4: Deliverables**
- 3 cards: PDF Book, AE Brief, Signal Brief
- Each card: filename, file size, page count, brand score, preview/download/copy
- Embedded PDF viewer (react-pdf)
- Brand compliance report (from `/algolia-brand-check`)

**Tab 5: Settings**
- Re-run selected phases (checkboxes for Phase 1-5)
- Quality control: Run fact-check (`/algolia-audit-factcheck`)
- Export & sharing: Copy link, export to Salesforce, email to team
- Template management: Save config as template
- Danger zone: Delete audit

**Technical Requirements**:
- Lazy-load tabs (fetch data on tab click)
- PDF viewer with zoom/fit controls
- Screenshot thumbnails with full-size modal

---

### F2: Data Collection & Enrichment

#### F2.1: Phase 1 Orchestrator (14 Steps)
**Priority**: MUST
**Complexity**: Very High
**Story Points**: 34

**Description**: Orchestrate 14 research steps with Agent Teams parallel execution.

**Wave Structure**:
- **Wave 1** (4 agents parallel): Company Context, Tech Stack, Traffic, Competitors
- **Wave 2** (5 agents parallel): Test Queries, Competitor Search, Strategic Angles, Hiring, Financial ROI
- **Wave 3** (2 agents parallel): Investor Intelligence, Deep Hiring
- **Wave 4** (sequential): ICP-to-Priority Mapping

**Implementation**:
```typescript
interface Wave {
  agents: Agent[];
  dependencies: string[]; // Wait for these waves to complete
}

interface Agent {
  id: string;
  name: string;
  steps: number[];
  tools: MCPTool[];
  output_table: string;
}

const PHASE_1_WAVES: Wave[] = [
  {
    agents: [
      { id: "A", name: "Company Context", steps: [1], tools: [WebSearch, YahooFinance, BuiltWith_Keywords], output_table: "audit_company_data" },
      { id: "B", name: "Tech Stack", steps: [2], tools: [BuiltWith_All, SimilarWeb_Technologies], output_table: "audit_tech_stack" },
      { id: "C", name: "Traffic", steps: [3], tools: [SimilarWeb_Traffic_11_Endpoints], output_table: "audit_traffic_metrics" },
      { id: "D", name: "Competitors", steps: [4], tools: [SimilarWeb_Competitors], output_table: "audit_competitors" }
    ],
    dependencies: []
  },
  // ... Wave 2-4
];
```

**Technical Requirements**:
- Job queue system (BullMQ) for agent coordination
- Wave-level barrier synchronization
- Error handling: If any agent in wave fails, retry 3x, then fail entire phase
- Output verification: Each agent must write to its assigned normalized table before wave completes

---

#### F2.2: MCP Service Proxy Layer
**Priority**: MUST
**Complexity**: Very High
**Story Points**: 34

**Description**: REST API wrappers for 5 MCP servers with caching, retries, rate limiting.

**MCP Servers**:
1. **BuiltWith** (7 endpoints): `domain-lookup`, `relationships-api`, `recommendations-api`, `financial-api`, `social-api`, `trust-api`, `keywords-api`
2. **SimilarWeb** (14 endpoints): All traffic/engagement/demographics endpoints
3. **Yahoo Finance** (8 tools): Stock info, financial statements, recommendations, news, holders
4. **SEC EDGAR** (2 tools): `search_filings`, `get_section_text`
5. **WebSearch** (custom): Perplexity API or Google Search API

**Architecture**:
```
┌─────────────────────────────────────────────────┐
│         Phase 1 Orchestrator                    │
└─────────────────┬───────────────────────────────┘
                  │
    ┌─────────────┼─────────────┬────────────┐
    │             │             │            │
    ▼             ▼             ▼            ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│BuiltWith│  │SimilarWeb│  │  Yahoo   │  │   SEC    │
│ Proxy   │  │  Proxy   │  │ Finance  │  │  EDGAR   │
│         │  │          │  │  Proxy   │  │  Proxy   │
└────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │            │             │             │
     │            │             │             │
     ▼            ▼             ▼             ▼
┌──────────────────────────────────────────────────┐
│              Redis Cache (24hr TTL)              │
└──────────────────────────────────────────────────┘
     │            │             │             │
     │            │             │             │
     ▼            ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│BuiltWith│  │SimilarWeb│  │  Yahoo   │  │   SEC    │
│   API   │  │   API    │  │ Finance  │  │  EDGAR   │
│ (HTTP)  │  │  (HTTP)  │  │   API    │  │   API    │
└─────────┘  └──────────┘  └──────────┘  └──────────┘
```

**Caching Strategy**:
- Cache hits reduce cost by ~80% (1,247 BuiltWith credits/month → 250)
- Redis key format: `mcp:{server}:{endpoint}:{hash(params)}`
- TTL: 24 hours (financial data), 7 days (tech stack), 30 days (company context)

**Rate Limiting**:
- BuiltWith: 10 req/sec (per API docs)
- SimilarWeb: 10 req/sec
- Yahoo Finance: 10 req/sec
- SEC EDGAR: 10 req/sec

**Error Handling**:
- 3 retry attempts with exponential backoff (1s, 2s, 4s)
- Circuit breaker: After 5 consecutive failures, pause 60s before next attempt
- Fallback: If API fails, mark data as `[UNAVAILABLE]` in database table, continue audit

---

#### F2.3: Browser Testing Service
**Priority**: MUST
**Complexity**: Very High
**Story Points**: 34

**Description**: Playwright-based browser pool with WAF recovery and screenshot persistence.

**Browser Pool Management**:
- Pool size: 10 concurrent Chrome instances
- Each instance: Dedicated profile with cookies disabled
- Anti-detection: Real Chrome (not headless), human-like typing (50-150ms delays)
- Resource limits: 2GB RAM per instance, 5min timeout per test

**WAF Recovery Protocol** (5 escalating steps):
1. **Retry with delay**: Wait 10s, retry navigation
2. **Homepage-first approach**: Navigate to homepage, wait 5s, then navigate to search
3. **Switch to real Chrome**: Connect to Chrome with remote debugging (`--remote-debugging-port=9222`)
4. **User intervention**: Detect CAPTCHA, request user to solve in browser window
5. **Document limitation**: If still blocked after 3 attempts, mark in findings

**CAPTCHA Detection**:
```typescript
function detectCAPTCHA(page: Page): boolean {
  const indicators = [
    page.title().includes("Just a moment"),
    page.title().includes("Access Denied"),
    page.url().includes("captcha"),
    page.locator("iframe[src*='recaptcha']").count() > 0,
    page.locator("iframe[src*='hcaptcha']").count() > 0
  ];
  return indicators.some(x => x);
}
```

**Screenshot Persistence**:
Method 1: `page.screenshot({ path: 'screenshots/05-typo.png' })`
Method 2: Upload to S3 immediately after capture
Method 3: Base64 encode, store in DB as fallback

**Technical Requirements**:
- Playwright 1.40+ with Chromium
- Screenshot quality: PNG, 1920x1080, 80% quality
- File naming: `{nn}-{query-slug}.png` (e.g., `05-typo-organic.png`)
- Metadata: Query, severity, timestamp stored in DB

---

### F3: Scoring & Analysis

#### F3.1: Weighted Severity Scoring Engine
**Priority**: MUST
**Complexity**: Medium
**Story Points**: 8

**Description**: Calculate overall score using severity-weighted average.

**Formula**:
```
For each of 10 challenge areas:
  weight = 2.0 if severity == HIGH
  weight = 1.0 if severity == MEDIUM
  weight = 0.5 if severity == LOW

overall_score = sum(score_i × weight_i) / sum(weight_i)
```

**Example**:
- Scores: [8, 8, 4, 4, 9, 2, 2, 5, 2, 4]
- Severities: [LOW, LOW, HIGH, MED, LOW, HIGH, HIGH, MED, HIGH, MED]
- Numerator: 8(0.5) + 8(0.5) + 4(2) + 4(1) + 9(0.5) + 2(2) + 2(2) + 5(1) + 2(2) + 4(1) = 45.5
- Denominator: 0.5 + 0.5 + 2 + 1 + 0.5 + 2 + 2 + 1 + 2 + 1 = 12.5
- **Score**: 45.5 / 12.5 = **3.6/10**

**Technical Requirements**:
- Store formula inputs in DB for reproducibility
- Expose formula via API (`GET /api/audits/:id/scoring`)
- Frontend renders formula breakdown in Scoring tab

---

### F4: Deliverable Generation

#### F4.1: PDF Book Assembly (21 Chapters + 6 Appendices)
**Priority**: MUST
**Complexity**: Very High
**Story Points**: 34

**Description**: HTML-to-PDF converter with 6 sub-phases and incremental saves.

**Sub-Phase Structure**:
```
5a-1: Cover + Act I (Ch 1-4) → save HTML → verify 4 chapters exist
5a-2: Act II (Ch 5-13) → save HTML → verify 9 chapters added
5a-3: Act III (Ch 14-18) → save HTML → verify 5 chapters added
5a-4: Act IV (Ch 19-22) → save HTML → verify 4 chapters added
5a-5: Appendices A-F → save HTML → verify 6 appendices added
5a-6: Final verification → count chapters (≥25) → convert to PDF → verify page count (≥28)
```

**Chapter-to-Data Mapping**:
| Chapter | Database Source | Placeholders |
|---------|-----------------|--------------|
| Cover | `audit_company_data` | `{{COMPANY_NAME}}`, `{{COVER_PHOTO_URL}}`, `{{STATUS_HEADLINE}}` |
| Ch 1: Bottom Line | `audit_scoring` + `audits` | `{{OVERALL_SCORE}}`, `{{CRITICAL_GAP_LABEL}}`, `{{REVENUE_RISK}}` |
| Ch 3: Opportunity | `audit_financial_data` + `audit_roi_estimates` | Revenue funnel SVG, 3-year trend chart SVG |
| Ch 6-12: Findings | `screenshots` table (query for all findings) | `{{FINDINGS_SECTIONS}}` (5-8 finding blocks) |
| Ch 13: In Their Words | `audit_investor_quotes` + `screenshots` | `{{STRATEGY_EXECUTION_PAIRS}}` (2-3 pairs) |
| Appendix F: Bibliography | `mcp_calls` table + `screenshots.observations` | Grouped citations by source type |

**SVG Chart Generation** (6 charts):
1. **Revenue Trend Line**: 3-year indexed line chart
2. **Revenue Funnel**: 3-tier tapered funnel (MUST be ≥100px bottom width)
3. **Traffic Donut**: Multi-segment donut for traffic sources
4. **Competitor Bars**: Horizontal bar chart for competitor traffic
5. **Hiring Bar Chart**: Vertical bars for role categories
6. **Score Meter**: Speedometer gauge with rotating needle

**PDF Generation**:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf-no-header \
  --print-to-pdf="{company}-search-audit-book.pdf" \
  "http://localhost:8788/book.html"
```

**Technical Requirements**:
- Serve HTML via HTTP (NOT `file://` URLs)
- Chrome headless with `--no-pdf-header-footer` flag
- Verify PDF page count: `mdls -name kMDItemNumberOfPages {pdf-path}` (macOS) or `pdfinfo` (Linux)

---

#### F4.2: Brand Compliance Validation
**Priority**: MUST
**Complexity**: Medium
**Story Points**: 8

**Description**: Run `/algolia-brand-check` skill on HTML, auto-fix if score <8/10.

**7 Compliance Dimensions**:
1. **Color Palette**: Nebula Blue `#003DFF`, Space Gray `#21243D`, Algolia Purple `#5468FF`
2. **Typography**: Source Sans Pro, 16px base, 1.6 line-height
3. **Logo Usage**: Algolia logo on every page header, correct size/placement
4. **Terminology**: "Algolia Search", "NeuralSearch", "Recommend" (not "AI Search", "ML Recs")
5. **Tone & Voice**: Confident but not arrogant, data-driven, solution-focused
6. **Citations**: Every data point sourced, no unverifiable claims
7. **Visual Consistency**: Consistent spacing, alignment, hierarchy

**Scoring**:
- Each dimension: 0-10 points
- Overall: Average of 7 dimensions
- Pass threshold: ≥8.0/10

**Auto-Fix Capability**:
- Replace hex codes (if wrong blue, change to `#003DFF`)
- Fix terminology (search/replace "AI Search" → "Algolia NeuralSearch")
- Add missing logo `<img>` tags

**Technical Requirements**:
- Call `/algolia-brand-check` skill via API
- Store brand score in `deliverables` table
- Display compliance report in Deliverables tab

---

### F5: Verification Gates

#### F5.1: Gate 2 - Screenshot Persistence Check
**Priority**: MUST
**Complexity**: High
**Story Points**: 5

**Description**: BLOCKING gate after Phase 2 - verify ≥10 screenshots on disk, all >50KB.

**Checks**:
```bash
# 1. Count screenshots
screenshot_count=$(ls screenshots/ | wc -l)
if [ "$screenshot_count" -lt 10 ]; then
  echo "⛔ GATE 2 FAILED: Only $screenshot_count screenshots. Required: 10+"
  exit 1
fi

# 2. Check file sizes (detect WAF error pages)
for f in screenshots/*.png; do
  size=$(stat -f%z "$f")
  if [ "$size" -lt 50000 ]; then
    echo "⚠️  WARNING: $f is only ${size} bytes — likely WAF error page"
  fi
done

# 3. Zero-byte check
zero_count=$(find screenshots/ -empty | wc -l)
if [ "$zero_count" -gt 0 ]; then
  echo "⛔ GATE 2 FAILED: $zero_count zero-byte files detected"
  exit 1
fi
```

**Technical Requirements**:
- Run as part of Phase 2 completion
- If fails: Mark audit as `needs_review`, notify user, offer retry
- Store gate result in `execution_logs` table

---

#### F5.2: Gate 4.5 - Data Verification
**Priority**: MUST
**Complexity**: Very High
**Story Points**: 13

**Description**: BLOCKING gate before Phase 5 - verify revenue data, source freshness, cross-references.

**Checks**:
1. **Revenue Verification**: Re-fetch primary source (ecdb.com, SEC filing), compare to database value. If >5% discrepancy, FAIL.
2. **Source Freshness**: All financial/employee data sources must be <12 months old.
3. **Cross-Reference**: Revenue must be verified by 2+ independent sources.
4. **Article Date Check**: All news citations must have publication date extracted, flagged if >18 months old.

**Implementation**:
```typescript
async function gate45_dataVerification(audit: Audit): Promise<GateResult> {
  // 1. Re-fetch revenue
  const scrapedRevenue = await reFetchRevenue(audit.domain);
  const dbRevenue = await db.query(
    'SELECT revenue_usd FROM audit_financial_data WHERE audit_id = $1 ORDER BY fiscal_year DESC LIMIT 1',
    [audit.id]
  );
  const discrepancy = Math.abs(scrapedRevenue - dbRevenue) / scrapedRevenue;

  if (discrepancy > 0.05) {
    return { pass: false, error: `Revenue discrepancy: ${discrepancy*100}% (scraped: ${scrapedRevenue}, db: ${dbRevenue})` };
  }

  // 2. Check source freshness
  const staleSources = checkSourceFreshness(audit);
  if (staleSources.length > 0) {
    return { pass: false, error: `${staleSources.length} stale sources (>12mo): ${staleSources.join(", ")}` };
  }

  // ... checks 3-4

  return { pass: true };
}
```

**Technical Requirements**:
- WebFetch primary sources (ecdb.com, SEC EDGAR)
- Parse dates from article HTML (OpenGraph tags, JSON-LD, text parsing)
- Store verification metadata in `data_quality` JSONB column

---

### F6: Admin & Monitoring

#### F6.1: Admin Dashboard
**Priority**: SHOULD
**Complexity**: Medium
**Story Points**: 13

**Description**: System health monitoring, usage analytics, MCP server status, user management.

**Sections**:

**1. System Health KPIs**:
- Total audits: 247
- Active now: 3
- Avg runtime: 34m 18s
- Success rate: 94.3%

**2. MCP Server Status** (real-time):
```
BuiltWith MCP      ✅ HEALTHY    Latency: 842ms    Credits: 2,134 / 5,000
SimilarWeb MCP     ✅ HEALTHY    Latency: 1.2s     Credits: 847 / 10,000
Chrome MCP         🟡 DEGRADED   Pool: 7/10        3 instances stuck on CAPTCHA
Yahoo Finance MCP  ✅ HEALTHY    Latency: 340ms
SEC EDGAR MCP      ✅ HEALTHY    Latency: 1.8s
WebSearch API      ✅ HEALTHY    Latency: 2.1s     Credits: 4,821 / 10,000
```

**3. Usage by Team** (last 30 days):
- Sales: 124 audits
- Marketing: 78 audits
- Customer Success: 32 audits
- Engineering: 13 audits

**4. Top Users**:
| User | Audits | Avg Score | Last Audit |
|------|--------|-----------|------------|
| Alex Rivera | 42 | 4.1 | 2 hours ago |
| Jordan Kim | 38 | 3.8 | 5 mins ago |
| Taylor Chen | 29 | 4.5 | Yesterday |

**5. Error Analytics**:
- Most common error: `WAF_BLOCKED` (18 occurrences)
- Most failed phase: Phase 2 (Browser Testing) - 12 failures
- Most retried audit: `therealreal.com` (4 retries)

**Technical Requirements**:
- Query `execution_logs` table for error aggregation
- Query `mcp_calls` table for latency/credits
- WebSocket for live status updates

---

## User Stories

### Epic 1: Audit Creation & Execution

**US-1.1**: As a Marketing Manager, I want to start a full audit by entering only a domain, so I can generate a report without technical knowledge.
- **Acceptance Criteria**:
  - Enter `costco.com` in wizard Step 1
  - Click "Start Full Audit"
  - Redirected to Execution Monitor with live progress
  - Receive email when complete (~35 min)
- **Priority**: MUST
- **Story Points**: 8

**US-1.2**: As an AE, I want to run only Phase 1 (research) without browser tests, so I can get pre-call intel in 10 minutes.
- **Acceptance Criteria**:
  - Select "Research Only" in wizard Step 2
  - Audit completes in <15 minutes
  - Can view all 10 research modules in Research Data tab
  - Can download AE brief immediately
- **Priority**: MUST
- **Story Points**: 5

**US-1.3**: As a Sales Engineer, I want to pause after Phase 1 and edit test queries, so I can customize browser tests.
- **Acceptance Criteria**:
  - Select "Full Audit" but check "Pause after Phase 1"
  - After Phase 1 completes, audit status = `paused_at_phase_1`
  - Click "Edit Test Queries" → Opens modal showing `audit_test_queries` table data
  - Edit 5 queries, save (updates database), click "Resume"
  - Phase 2 uses edited queries from database
- **Priority**: SHOULD
- **Story Points**: 13

---

### Epic 2: Data Quality & Verification

**US-2.1**: As a Product Marketer, I want all data points to have clickable source citations, so I can fact-check before presenting to executives.
- **Acceptance Criteria**:
  - Every financial figure in PDF book has inline `[N]` citation
  - Click citation → Opens source URL in new tab
  - Appendix F has full bibliography grouped by source type
  - At least 15 unique sources cited per audit
- **Priority**: MUST
- **Story Points**: 8

**US-2.2**: As an Admin, I want the system to automatically verify revenue data against primary sources, so I can trust audit accuracy.
- **Acceptance Criteria**:
  - Gate 4.5 re-fetches revenue from ecdb.com before Phase 5
  - If discrepancy >5%, audit marked `needs_review`
  - User sees warning: "Revenue data mismatch: $227M (database) vs $254M (ecdb.com)"
  - Can choose to proceed or update database
- **Priority**: MUST
- **Story Points**: 13

**US-2.3**: As a Marketing Manager, I want screenshots to show the actual search query I tested, so findings are visually verifiable.
- **Acceptance Criteria**:
  - Screenshot file naming includes query slug (e.g., `05-typo-organic.png`)
  - Screenshot metadata stores full query text
  - In findings PDF, each screenshot shows query in caption
  - Search bar in screenshot has visible text (not empty)
- **Priority**: MUST
- **Story Points**: 5

---

### Epic 3: Deliverables & Sharing

**US-3.1**: As an AE, I want to download all 3 deliverables as a ZIP file, so I can easily share with my team.
- **Acceptance Criteria**:
  - Click "Download All" button in Deliverables tab
  - Downloads `costco-audit-package.zip` containing:
    - `costco-search-audit-book.pdf` (40-50 pages)
    - `costco-ae-precall-brief.md` (10-15 pages)
    - `costco-strategic-signal-brief.md` (3 pages)
    - `screenshots/` directory (10-20 files)
  - ZIP file size <50MB
- **Priority**: MUST
- **Story Points**: 5

**US-3.2**: As a Product Marketer, I want to email the audit package to my team, so they can review before a meeting.
- **Acceptance Criteria**:
  - Click "Email to Team" in Settings tab
  - Modal with recipient field (autocomplete from user table)
  - Send email with subject: "[Algolia] Search Audit: Costco Wholesale"
  - Email body: Audit summary + download links (S3 presigned URLs, 7-day expiry)
- **Priority**: SHOULD
- **Story Points**: 8

**US-3.3**: As a Partner Marketer, I want to export a CSV of all audits with key metrics, so I can analyze in Excel.
- **Acceptance Criteria**:
  - Click "Export CSV" in Dashboard
  - Downloads `algolia-audits-{date}.csv` with columns:
    - Domain, Company, Vertical, Score, Critical Gaps, Opportunity Min/Max, Competitor Uses Algolia, Created Date, Created By
  - Can filter audits before export (by date range, team, status)
- **Priority**: SHOULD
- **Story Points**: 8

---

### Epic 4: Error Handling & Recovery

**US-4.1**: As a user, I want to be notified when a site blocks browser tests, so I can decide whether to retry or skip.
- **Acceptance Criteria**:
  - During Phase 2, WAF block detected after 3 attempts
  - Audit paused, status = `blocked_by_waf`
  - Email sent: "Action Required: Costco audit blocked by Akamai WAF"
  - Modal in UI with 3 options: [Retry], [Skip Browser Tests], [Cancel Audit]
  - If skip, Phase 3-5 proceed with "Browser testing unavailable - see limitation note"
- **Priority**: MUST
- **Story Points**: 13

**US-4.2**: As an Admin, I want to see execution logs for failed audits, so I can debug and resolve issues.
- **Acceptance Criteria**:
  - Failed audit shows "View Logs" button in Dashboard card
  - Logs page shows timestamped events with level (info/warning/error)
  - Can filter by phase/level
  - Can download logs as JSON
- **Priority**: SHOULD
- **Story Points**: 8

**US-4.3**: As a user, I want to retry a failed phase without re-running the entire audit, so I can save time.
- **Acceptance Criteria**:
  - Audit status = `failed_phase_2`
  - In Settings tab, select "Phase 2: Browser Testing"
  - Click "Retry Phase"
  - Audit re-runs Phase 2 only (using existing Phase 1 data from database)
  - If succeeds, audit continues to Phase 3
- **Priority**: MUST
- **Story Points**: 13

---

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                          │
│  Dashboard | Wizard | Execution Monitor | Audit Details | Admin │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            │ REST API + WebSocket
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Node.js/Express)                 │
│  Rate Limiting | Request Validation | CORS                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│ Audit Orchestrator│ │ Status Manager│ │ Browser Pool Mgr │
│ (State Machine)  │ │ (WebSocket)   │ │ (Playwright)     │
└──────────────────┘ └──────────────┘ └──────────────────┘
          │                 │                 │
          │                 │                 │
          ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    MCP PROXY LAYER                               │
│  BuiltWith | SimilarWeb | Yahoo Finance | SEC EDGAR | WebSearch │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                    │
│  PostgreSQL (audits) | Redis (queue/cache) | S3 (files)         │
└──────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend**:
- React 18 + TypeScript
- Mantine UI (component library)
- Zustand (state management)
- Socket.IO client (WebSocket)
- react-pdf (PDF viewer)
- Recharts (data visualization)

**Backend**:
- Node.js 20 + TypeScript
- Express.js (REST API)
- Socket.IO (WebSocket server)
- BullMQ (job queue via Redis)
- Playwright (browser automation)

**Data**:
- PostgreSQL 15 (primary database)
- Redis 7 (job queue + cache)
- AWS S3 (file storage)

**Infrastructure**:
- AWS ECS Fargate (containerized services)
- AWS RDS PostgreSQL
- AWS ElastiCache Redis
- AWS S3
- AWS CloudFront (CDN for frontend)

---

## Data Model

See `DATABASE_SCHEMA_SAAS.md` for complete SQL schema with all 19 normalized tables.

### Core Tables

**1. audits**:
- `id` (UUID, PK)
- `audit_number` (VARCHAR, unique) - Human-readable: AUD-2024-001234
- `target_company_id` (UUID, FK to companies)
- `domain` (VARCHAR, NOT NULL)
- `company_name` (VARCHAR)
- `opportunity_id` (UUID, FK to algolia_opportunities)
- `status` (VARCHAR: pending | enriching | testing | scoring | generating | completed | failed | needs_review)
- `overall_audit_score` (DECIMAL 3,1)
- `factcheck_score` (DECIMAL 4,2)
- `current_phase` (INT: 1-5)
- `progress_pct` (DECIMAL 5,2)
- `ticker` (VARCHAR) - Stock ticker symbol
- `margin_zone` (VARCHAR) - Red/Yellow/Green classification
- `vertical_matched` (VARCHAR) - Vertical from library
- `created_at`, `started_at`, `completed_at` (TIMESTAMPTZ)
- `duration_seconds` (INT)
- `error_message` (TEXT)
- `config` (JSONB) - Phase selection, custom queries, settings

**3. Phase 1 Research Data** (10 normalized tables):
- `audit_company_data` - Company overview, revenue, employees, industry
- `audit_executives` - Executive team with names, titles, backgrounds
- `audit_tech_stack` - Search provider, ecommerce platform, analytics, etc.
- `audit_traffic_metrics` - Monthly visits, bounce rate, session duration, traffic sources
- `audit_competitors` - Competitor list with domains, search providers, traffic
- `audit_test_queries` - Test query list with vertical tags and priorities
- `audit_financial_data` - 3-year financial history with revenue, EBITDA, trends
- `audit_roi_estimates` - ROI calculation data with conservative/moderate scenarios
- `audit_investor_quotes` - Executive quotes from earnings calls, 10-K/10-Q
- `audit_hiring_signals` - Job postings, buying committee, hiring trends

**4. screenshots** (Phase 2 Browser Testing):
- `id` (UUID, PK)
- `audit_id` (UUID, FK)
- `file_name` (VARCHAR)
- `query` (VARCHAR) - Test query used
- `test_category` (VARCHAR) - e.g., 'typo_tolerance', 'synonym_handling'
- `severity` (VARCHAR: PASS | WARNING | CRITICAL)
- `description` (TEXT) - Gap description
- `expected` (TEXT) - Expected behavior
- `found` (TEXT) - Observed behavior
- `solution` (TEXT) - How Algolia solves this
- `storage_url` (TEXT) - S3 URL
- `thumbnail_url` (TEXT)
- `file_size_bytes` (INT)
- `created_at` (TIMESTAMPTZ)

**5. audit_scoring** (Phase 3 Scoring):
- `id` (UUID, PK)
- `audit_id` (UUID, FK)
- `area_name` (VARCHAR) - e.g., 'SAYT', 'Query Understanding', 'Results Quality'
- `score` (DECIMAL) - 0-10 scale
- `severity` (VARCHAR) - HIGH, MEDIUM, LOW
- `reasoning` (TEXT) - Justification for score
- `algolia_solution` (TEXT) - How Algolia addresses this
- `created_at` (TIMESTAMPTZ)

**7. deliverables** (Phase 5 Outputs):
- `id` (UUID, PK)
- `audit_id` (UUID, FK)
- `type` (VARCHAR: book | ae_brief | signal_brief)
- `file_name` (VARCHAR)
- `storage_url` (TEXT) - S3 URL
- `file_size_bytes` (BIGINT)
- `page_count` (INT)
- `brand_score` (DECIMAL 3,1)
- `created_at` (TIMESTAMPTZ)

**8. execution_logs** (Real-time monitoring):
- `id` (UUID, PK)
- `audit_id` (UUID, FK)
- `timestamp` (TIMESTAMPTZ)
- `phase` (VARCHAR)
- `step` (VARCHAR)
- `level` (VARCHAR: info | warning | error)
- `message` (TEXT)
- `metadata` (JSONB)

**9. mcp_calls** (API call tracking & caching):
- `id` (UUID, PK)
- `audit_id` (UUID, FK)
- `server` (VARCHAR: builtwith | similarweb | yahoo_finance | sec_edgar | websearch)
- `endpoint` (VARCHAR)
- `params_hash` (VARCHAR) - Hash of params for cache key
- `response_cached` (BOOLEAN)
- `latency_ms` (INT)
- `credits_used` (INT)
- `error` (TEXT)
- `timestamp` (TIMESTAMPTZ)

---

## API Specification

### Base URL
`https://api.algolia-search-audit.com/v1`

**Note**: Authentication/authorization will be added in a future phase. Current MVP has no auth.

---

### Audits

#### `POST /audits`
Create a new audit.

**Request**:
```json
{
  "domain": "costco.com",
  "company_name": "Costco Wholesale", // optional
  "vertical": "general_retail", // optional
  "config": {
    "mode": "full", // full | research_only | browser_only | deliverables_only
    "phases": [1, 2, 3, 4, 5], // if mode=custom
    "custom_queries": [ // optional
      "organic vegetables",
      "kirkland signature protein powder"
    ],
    "pause_after_phase": null // 1-4 to pause, or null
  }
}
```

**Response**:
```json
{
  "audit_id": "uuid",
  "audit_number": "AUD-2026-001234",
  "status": "pending",
  "estimated_duration_sec": 2100,
  "websocket_url": "wss://api.algolia-search-audit.com/ws/audits/{audit_id}"
}
```

---

#### `GET /audits/:id`
Get audit details.

**Response**:
```json
{
  "id": "uuid",
  "audit_number": "AUD-2026-001234",
  "domain": "costco.com",
  "company_name": "Costco Wholesale",
  "status": "completed",
  "overall_score": 4.4,
  "factcheck_score": 9.2,
  "current_phase": 5,
  "progress_pct": 100.0,
  "created_at": "2026-02-21T10:30:00Z",
  "started_at": "2026-02-21T10:31:00Z",
  "completed_at": "2026-02-21T11:06:00Z",
  "duration_seconds": 2100,
  "deliverables": [
    {
      "type": "book",
      "url": "https://s3.../costco-search-audit-book.pdf",
      "file_size_bytes": 3840000,
      "page_count": 47,
      "brand_score": 9.2
    },
    // ... ae_brief, signal_brief
  ]
}
```

---

#### `POST /audits/:id/pause`
Pause a running audit.

**Response**:
```json
{
  "status": "paused_at_phase_2",
  "current_step": "Phase 2: Browser Testing (Step 8/20)"
}
```

---

#### `POST /audits/:id/resume`
Resume a paused audit.

**Request**:
```json
{
  "continue_from_phase": 2 // optional - if not provided, continues from current_phase
}
```

**Response**:
```json
{
  "status": "in_progress",
  "resuming_from": "phase_2_step_9"
}
```

---

#### `POST /audits/:id/retry-phase`
Retry a failed phase.

**Request**:
```json
{
  "phase": 2
}
```

**Response**:
```json
{
  "status": "in_progress",
  "retrying_phase": 2,
  "attempt": 2
}
```

---

#### `GET /audits/:id/research/:module`
Get Phase 1 research data for a specific module.

**Example**: `GET /audits/{id}/research/company-data`

**Modules**: `company-data`, `executives`, `tech-stack`, `traffic-metrics`, `competitors`, `test-queries`, `financial-data`, `roi-estimates`, `investor-quotes`, `hiring-signals`

**Response**:
```json
{
  "module": "company-data",
  "data": {
    "company_name": "Costco Wholesale Corporation",
    "industry": "Warehouse Clubs & Supercenters",
    "revenue_usd": 254200000000,
    "employees": 316000,
    "ticker": "COST",
    "margin_zone": "green"
  },
  "updated_at": "2026-02-21T10:45:00Z"
}
```

---

#### `PUT /audits/:id/research/:module`
Update Phase 1 research data (for editing).

**Request**:
```json
{
  "content": "# Updated content here"
}
```

**Response**:
```json
{
  "success": true,
  "updated_at": "2026-02-21T10:50:00Z"
}
```

---

#### `GET /audits/:id/screenshots`
List all screenshots.

**Response**:
```json
{
  "screenshots": [
    {
      "file_name": "05-typo-organic.png",
      "query": "orgnic vegetabls",
      "severity": "CRITICAL",
      "url": "https://s3.../05-typo-organic.png",
      "thumbnail_url": "https://s3.../thumb-05-typo-organic.png",
      "observations": "Search returned 0 results - no typo tolerance"
    },
    // ...
  ]
}
```

---

#### `GET /audits/:id/logs`
Get execution logs.

**Query Params**:
- `phase` (optional): Filter by phase (1-5)
- `level` (optional): Filter by level (info|warning|error)
- `limit` (default: 100)

**Response**:
```json
{
  "logs": [
    {
      "timestamp": "2026-02-21T10:35:22Z",
      "phase": "phase_2",
      "step": "Browser Testing: Typo Tolerance",
      "level": "error",
      "message": "WAF block detected after 3 retry attempts",
      "metadata": {
        "query": "orgnic vegetabls",
        "url": "https://costco.com/search?q=orgnic+vegetabls",
        "error_code": "WAF_BLOCKED"
      }
    },
    // ...
  ]
}
```

---

#### `POST /audits/:id/factcheck`
Run fact-check validation.

**Response**:
```json
{
  "factcheck_id": "uuid",
  "status": "in_progress",
  "estimated_duration_sec": 600
}
```

---

#### `DELETE /audits/:id`
Delete an audit (soft delete).

**Response**:
```json
{
  "success": true,
  "audit_id": "uuid",
  "deleted_at": "2026-02-21T11:10:00Z"
}
```

---

### WebSocket Events

**Connection**: `wss://api.algolia-search-audit.com/ws/audits/{audit_id}?token={jwt}`

**Server → Client Events**:
- `progress_update`
- `screenshot_captured`
- `phase_complete`
- `audit_complete`
- `error`
- `gate_failed`
- `user_action_required` (for CAPTCHA)

See [F1.2: Real-Time Execution Monitor](#f12-real-time-execution-monitor) for event schemas.

---

## UI/UX Requirements

### Design System

**Color Palette**:
- Primary: Nebula Blue `#003DFF`
- Secondary: Algolia Purple `#5468FF`
- Neutral: Space Gray `#21243D`
- Success: `#36B37E`
- Warning: `#FFAB00`
- Error: `#E8513D`

**Typography**:
- Font Family: Source Sans Pro
- Base Size: 16px
- Line Height: 1.6
- Headings: 700 weight
- Body: 400 weight

**Spacing**:
- Base unit: 8px
- Grid: 8px increments (8, 16, 24, 32, 40, 48)

**Breakpoints**:
- Mobile: <768px
- Tablet: 768px - 1024px
- Desktop: >1024px

---

### Screen Requirements

See existing docs for full screen mockups:
- `SAAS_ARCHITECTURE.md` (Section 3: Screen-by-Screen Breakdown)
- `audit-dashboard-ux-research.md` (Section 4: Screen-by-Screen Design)
- `full-interactive-prototype.html` (Interactive mockups)

**5 Core Screens**:
1. Dashboard (Home)
2. Create New Audit (Wizard - 4 steps)
3. Execution Monitor (Real-time progress)
4. Audit Details (5 tabs)
5. Admin Dashboard

---

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Audit Runtime (p50)** | 35 minutes | End-to-end for full audit |
| **Audit Runtime (p95)** | 50 minutes | Including retries |
| **API Response Time (p95)** | <500ms | All REST endpoints |
| **WebSocket Latency** | <100ms | Event delivery |
| **PDF Generation** | <60 seconds | HTML → PDF conversion |
| **Concurrent Audits** | 5 | Simultaneous full audits |
| **Browser Pool Size** | 10 instances | Chrome pool |

---

### Reliability

| Metric | Target |
|--------|--------|
| **Uptime** | 99.5% (43.8 hours downtime/year) |
| **Audit Success Rate** | 90%+ (Gate 5 passing) |
| **Data Durability** | 99.999% (S3 standard) |
| **Backup Frequency** | Daily (PostgreSQL) |
| **Disaster Recovery** | RPO: 24 hours, RTO: 4 hours |

---

### Security

| Requirement | Implementation |
|-------------|----------------|
| **Authentication** | Not implemented in MVP (future phase) |
| **Authorization** | Not implemented in MVP (future phase) |
| **API Security** | Rate limiting (100 req/min per IP), CORS |
| **Data Encryption** | At-rest (RDS encrypted), in-transit (TLS 1.3) |
| **Secret Management** | AWS Secrets Manager (API keys, DB credentials) |
| **Audit Logging** | All mutations logged (timestamp, action, audit_id) |
| **Data Retention** | Audits: 2 years, logs: 90 days, backups: 30 days |

---

### Scalability

| Dimension | Current (MVP) | Target (Year 1) | Strategy |
|-----------|---------------|-----------------|----------|
| **Users** | 50 | 200 | Horizontal scaling (ECS tasks) |
| **Audits/Month** | 40 | 500 | BullMQ job queue |
| **DB Size** | 5 GB | 50 GB | PostgreSQL vertical scaling |
| **Storage** | 100 GB | 1 TB | S3 lifecycle policies (archive after 6 months) |
| **API Calls/Day** | 10K | 100K | Redis caching (80% hit rate) |

---

### Cost Model

**Monthly Operating Cost** (at 50 audits/month):

| Service | Cost/Month |
|---------|-----------|
| **AWS ECS Fargate** (2 tasks, 2 vCPU, 4GB RAM) | $150 |
| **AWS RDS PostgreSQL** (db.t3.medium) | $80 |
| **AWS ElastiCache Redis** (cache.t3.medium) | $60 |
| **AWS S3** (100 GB storage + 500 GB transfer) | $25 |
| **AWS CloudFront** (CDN for frontend) | $20 |
| **MCP API Credits** (BuiltWith, SimilarWeb, Yahoo Finance) | $600 |
| **Total** | **$935/month** |

**Cost per Audit**: $935 / 50 = **$18.70/audit**

**At Scale** (500 audits/month):
- Infrastructure: $500/month (3x capacity)
- API Credits: $6,000/month
- **Total**: $6,500/month
- **Cost per Audit**: $6,500 / 500 = **$13/audit**

---

## Success Metrics

### Product Metrics

| Metric | Baseline (CLI) | Target (SaaS v1.0) | Measurement |
|--------|----------------|-------------------|-------------|
| **Audits Created** | 10-15/year | 500/year | Count of audits with status=completed |
| **User Adoption** | 5 users | 50 active users | Monthly active users (MAU) |
| **Completion Rate** | N/A | 90% | audits_completed / audits_started |
| **Time to First Audit** | N/A | <5 minutes | signup → first audit delivered |
| **Repeat Usage** | N/A | 60% | Users who run 2+ audits/month |

---

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Brand Compliance Score** | 8.5/10 avg | `/algolia-brand-check` score |
| **Fact-Check Score** | 9.0/10 avg | `/algolia-audit-factcheck` score |
| **Screenshot Capture Rate** | 95% | audits with ≥10 screenshots |
| **Source Citation Density** | 20+ per audit | Count of unique source URLs |
| **Data Verification Pass Rate** | 95% | Gate 4.5 pass rate |

---

### User Satisfaction

| Metric | Target | Measurement |
|--------|--------|-------------|
| **NPS (Net Promoter Score)** | 50+ | Quarterly survey |
| **User Satisfaction** | 4.5/5 | Post-audit survey |
| **Feature Adoption** | 80% | % using custom queries, phase selection |
| **Support Tickets** | <10/month | Zendesk ticket count |

---

### Business Impact

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Sales Cycle Acceleration** | -10% | Compare deal velocity for accounts with audit vs without |
| **Pipeline Quality** | +15% | Win rate for audited prospects |
| **ACV (Average Contract Value)** | +5% | Compare ACV for deals with audit |
| **Cost Savings** | $100K/year | Labor cost reduction (vs manual audits) |

---

## Implementation Roadmap

### Phase 1: MVP (Weeks 1-16)

**Goal**: Basic audit creation, sequential execution, 3 deliverables generated.

**Milestones**:

| Week | Milestone | Deliverables |
|------|-----------|-------------|
| 1-2 | **Frontend Foundation** | Dashboard, Wizard (Steps 1-2), basic routing |
| 3-4 | **Backend Foundation** | API Gateway, PostgreSQL schema, S3 setup |
| 5-6 | **Phase 1 Orchestrator** | 14-step research pipeline (sequential), MCP proxy layer |
| 7-8 | **Browser Testing Service** | Playwright pool, 20 test steps, screenshot persistence |
| 9-10 | **Scoring & Report Gen** | Weighted scoring engine, report markdown generation |
| 11-12 | **Deliverable Generation** | HTML template, SVG charts, PDF conversion, brand check |
| 13-14 | **WebSocket & Monitoring** | Real-time progress, Execution Monitor screen, logs |
| 15-16 | **Testing & Launch** | End-to-end tests, load testing, production deployment |

**Success Criteria**:
- ✅ 10 test audits run successfully end-to-end
- ✅ 80%+ completion rate
- ✅ <60 min average runtime (sequential)
- ✅ All 6 verification gates implemented

---

### Phase 2: Agent Teams Parallelization (Weeks 17-20)

**Goal**: Implement Agent Teams for Phase 1 (4 waves), reduce runtime from 60m → 35m.

**Features**:
- BullMQ wave coordination
- 4-wave parallel execution (Wave 1: 4 agents, Wave 2: 5 agents, Wave 3: 2 agents, Wave 4: sequential)
- Error handling for agent failures
- Wave-level retry logic

**Success Criteria**:
- ✅ Phase 1 runtime <15 minutes (vs 30 min sequential)
- ✅ Overall audit runtime <40 minutes
- ✅ 90%+ wave completion rate

---

### Phase 3: Polish & Scale (Weeks 21-24)

**Goal**: Advanced features, templates, batch mode, admin dashboard.

**Features**:
- Save/load audit templates (custom query sets, phase configs)
- Batch audit creation (CSV upload)
- Admin Dashboard (MCP health, usage analytics, user management)
- Fact-check integration (`/algolia-audit-factcheck` skill)
- Edit research data mid-audit (database table updates)
- Retry failed phases

**Success Criteria**:
- ✅ 100+ audits run in production
- ✅ 95%+ user satisfaction
- ✅ 5 concurrent audits supported

---

### Phase 4: Enterprise Features (Future)

**Out of scope for v1.0, planned for 2027**:

- Salesforce integration (auto-attach audits to opportunities)
- Custom branding (white-label for partners)
- API for 3rd party integrations
- Multi-tenancy (separate data per region/team)
- Advanced analytics (audit trends, competitive intelligence dashboard)
- Mobile app (iOS/Android)

---

## Risks & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **WAF blocks browser tests** | High (can't complete Phase 2) | Medium (30%) | Implement 5-step recovery protocol, user intervention for CAPTCHA |
| **MCP API rate limits** | Medium (slow audits) | Low (10%) | Redis caching (80% hit rate), exponential backoff retries |
| **Context compaction in book gen** | High (incomplete PDFs) | Medium (20%) | 6 sub-phases with incremental saves, verification after each |
| **PostgreSQL storage growth** | Medium (cost increase) | High (80%) | S3 lifecycle policies (archive to Glacier after 6 months), index optimization on normalized tables |
| **WebSocket connection drops** | Medium (lost progress updates) | Medium (30%) | Auto-reconnect, event catch-up on reconnect, persist events in DB |

---

### Product Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Low user adoption** | High (failed product) | Medium (30%) | Early beta with 10 champions, weekly feedback sessions, iterate on UX |
| **Data quality issues** | High (loss of trust) | Medium (40%) | 6 verification gates (blocking), fact-check integration, source citation mandate |
| **Performance doesn't meet 35m target** | Medium (user frustration) | Medium (30%) | Agent Teams parallelization (Phase 2 roadmap), browser pool optimization |
| **Cost overruns (MCP APIs)** | Medium (budget exceeded) | Low (20%) | Redis caching (reduce API calls by 80%), monitor credits daily, alert at 80% threshold |

---

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Cannibalization of expert services** | Medium (internal conflict) | Low (10%) | Position as enabler (experts can run 10x more audits), focus on scale not replacement |
| **Competitive parity (others build similar)** | Medium (lost differentiation) | Medium (40%) | Speed to market (16 weeks), invest in quality (gates), build brand trust |
| **Regulatory/compliance issues** | High (legal risk) | Low (5%) | Terms of service (audit for internal use only), respect ToS of scraped sites, GDPR compliance for EU prospects |

---

## Open Questions

### Technical

1. **MCP Architecture Decision** (CRITICAL):
   - **Option A**: Keep MCP servers, run server-side MCP adapters in Node.js → Reuse existing integrations
   - **Option B**: Replace with direct API calls (BuiltWith HTTP, SimilarWeb HTTP, etc.) → More control, no MCP dependency
   - **Recommendation**: Option B (direct APIs) for production reliability, but requires rewriting 30+ integrations
   - **Decision needed by**: Week 2

2. **Chrome vs Playwright**:
   - Skill uses Chrome MCP with remote debugging
   - Do we replicate exact Chrome setup (harder) or use Playwright with WAF mitigations (easier but different behavior)?
   - **Decision needed by**: Week 4

3. **SEC EDGAR MCP Availability**:
   - Skill requires SEC EDGAR MCP for 10-K/10-Q filings
   - Is this MCP server available for production use? Or do we need to build SEC EDGAR API integration?
   - **Decision needed by**: Week 3

---

### Product

4. **Customer-Facing vs Internal Tool**:
   - v1.0 is internal-only (Algolia employees)
   - Do we eventually make it customer-facing (prospects run their own audits)?
   - **Decision needed by**: Phase 3 planning

5. **Pricing Model** (if customer-facing):
   - Free tier (1 audit/month)?
   - Paid tier ($99/audit)?
   - Enterprise tier (unlimited, white-label)?
   - **Decision needed by**: Phase 4 planning

6. **Batch Mode Priority**:
   - Partner Marketing wants batch upload (50 domains at once)
   - Do we prioritize this for Phase 2 or defer to Phase 3?
   - **Decision needed by**: Week 8

---

### Business

7. **Legal/Compliance Review**:
   - Browser scraping at scale may violate some sites' ToS
   - Do we need legal review before production launch?
   - **Action**: Schedule legal review by Week 10

8. **Go-to-Market Strategy**:
   - Soft launch to 10 beta users (Weeks 15-16)?
   - Hard launch to all 200 GTM users (Week 17)?
   - Or phased rollout (50 users/month)?
   - **Decision needed by**: Week 12

---

## Appendices

### Appendix A: Feature Inventory
See `FEATURE_INVENTORY.md` for complete 127-feature breakdown.

### Appendix B: Validation Report
See `VALIDATION_REPORT.md` for existing docs audit.

### Appendix C: Database Schema
See `DATABASE_SCHEMA_V3.md` for full SQL schema.

### Appendix D: Screen Mockups
See `SCREEN_MOCKUPS.md` and `full-interactive-prototype.html` for UI designs.

### Appendix E: Architecture Diagrams
See `architecture-diagram.md` for Mermaid diagrams.

---

**END OF PRD**

**Document Status**: Draft for Review
**Next Steps**:
1. Review with Engineering (architecture decisions)
2. Review with Product (feature prioritization)
3. Review with Sales/Marketing (user stories validation)
4. Finalize scope and approve for development
5. Kickoff Week 1 (Frontend Foundation)
