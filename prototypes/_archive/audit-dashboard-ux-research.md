# Algolia Search Audit Dashboard — UX Research & Design Recommendations

**Date**: March 2, 2026
**Prepared by**: Claude
**Purpose**: Convert CLI skill into self-service SaaS platform for Algolia team

---

## Executive Summary

The Algolia Search Audit skill is a sophisticated multi-phase system that orchestrates 5 MCP servers, executes 34+ research steps, performs 20 browser tests, and generates 3 deliverables with 25+ chapters in the primary PDF book output. Converting this to a SaaS dashboard requires careful UX design to balance power-user capabilities with approachability for non-technical users.

**Key Design Principles**:
1. **Progressive Disclosure** — Show simple interface first, advanced options on demand
2. **Status Transparency** — Real-time progress tracking across all phases
3. **Modular Execution** — Allow running individual phases independently
4. **Output Management** — Easy access to all generated artifacts
5. **Collaboration** — Share audits, assign tasks, comment on findings

---

## User Research

### Primary User Personas

#### 1. **Marketing Manager** (Primary)
- **Goal**: Generate polished audit reports for prospects without technical knowledge
- **Pain Points**: Doesn't understand MCP servers, CLI intimidating, needs "just works" experience
- **Success Metric**: Can start full audit in <2 clicks, receives PDF book via email when done

#### 2. **Sales Engineer/AE** (Secondary)
- **Goal**: Quick pre-call research, regenerate deliverables with updated data
- **Pain Points**: Needs fast turnaround, wants to customize test queries, needs AE brief format
- **Success Metric**: Can run research-only phase in 10 minutes, export AE brief instantly

#### 3. **Partner Marketing** (Secondary)
- **Goal**: Batch process multiple prospects, identify displacement opportunities
- **Pain Points**: CLI one-at-a-time is slow, needs pipeline view, wants CSV export
- **Success Metric**: Can queue 10 audits overnight, see aggregate insights across prospects

#### 4. **Product Marketing** (Advanced)
- **Goal**: Deep competitive intelligence, customize scoring, A/B test queries
- **Pain Points**: Needs control over phases, wants raw scratchpad data, edits findings
- **Success Metric**: Can pause after Phase 1, edit test queries, resume with custom parameters

---

## Information Architecture

### Site Map

```
┌─ Dashboard (Home)
│  ├─ Recent Audits (grid view)
│  ├─ Quick Start (+ New Audit button)
│  └─ Audit Queue (background tasks)
│
├─ New Audit Wizard
│  ├─ Step 1: Company Input (URL + metadata)
│  ├─ Step 2: Audit Mode Selection (Full / Research / Browser / Deliverables)
│  ├─ Step 3: Configuration (optional phases, test queries)
│  └─ Step 4: Launch & Monitor
│
├─ Audit Detail View
│  ├─ Overview Tab (status, progress, timeline)
│  ├─ Research Tab (scratchpad files 01-12)
│  ├─ Browser Tests Tab (20 steps + screenshots)
│  ├─ Scoring Tab (10-area matrix)
│  ├─ Deliverables Tab (PDF book, AE brief, signal brief)
│  └─ Actions Panel (regenerate, export, share)
│
├─ Library
│  ├─ All Audits (searchable, filterable)
│  ├─ Saved Templates (custom test queries, scoring weights)
│  └─ Shared Audits (team collaboration)
│
├─ Settings
│  ├─ MCP Server Status (health check)
│  ├─ API Credits (BuiltWith, SimilarWeb usage)
│  ├─ User Preferences (email notifications, default phases)
│  └─ Team Management (user roles, permissions)
│
└─ Help & Documentation
   ├─ Video Tutorials
   ├─ Phase Explanations
   └─ API Documentation (for power users)
```

---

## Screen-by-Screen Design

### 1. Dashboard (Home)

**Purpose**: Command center for all audit activity

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Algolia Search Audit Platform     [Profile] [Settings] [?] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  + New Audit                                             ││
│  │  Enter prospect URL to start                             ││
│  │  [____________________________] [Start Full Audit ▼]     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Recent Audits (3)                          [View All →]     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 🏢 Costco    │ │ 🏢 Tapestry  │ │ 🏢 AutoZone  │        │
│  │ ✅ Complete  │ │ ⏱️ Running   │ │ ✅ Complete  │        │
│  │ Score: 4.4   │ │ Phase 2/5    │ │ Score: 3.2   │        │
│  │ 2 days ago   │ │ 12m elapsed  │ │ 5 days ago   │        │
│  │              │ │              │ │              │        │
│  │ [View] [DL]  │ │ [Monitor]    │ │ [View] [DL]  │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                               │
│  Audit Queue (1)                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🕐 TheRealReal — Phase 1 (Step 8/14) — Est. 8m remaining ││
│  │ [████████░░░░░░] 56%                    [Pause] [Cancel] ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  System Status                                                │
│  ✅ Chrome MCP    ✅ SimilarWeb MCP    ✅ BuiltWith MCP       │
│  ✅ Yahoo Finance ✅ SEC EDGAR MCP     ⚠️ 1,247 BuiltWith   │
│                                           credits remaining   │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Quick Start**: Single input field + dropdown (Full Audit default, or select phase)
- **Status Cards**: Visual audit cards with company logo, progress, score, timestamp
- **Live Queue**: Real-time progress bars for running audits
- **System Health**: MCP server status + API credit warnings

**Interactions**:
- Click card → Navigate to Audit Detail View
- Hover card → Show quick actions (View, Download, Share, Delete)
- Click "Start Full Audit" dropdown → Show phase selection menu

---

### 2. New Audit Wizard — Step 1: Company Input

**Purpose**: Gather prospect information and set audit scope

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  New Audit                                  [Close X]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Step 1 of 4: Company Information                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 25%           │
│                                                               │
│  Company Website * (required)                                │
│  [_________________________________________]                 │
│   Example: costco.com or https://www.costco.com             │
│                                                               │
│  Company Name (optional)                                     │
│  [_________________________________________]                 │
│   Leave blank to auto-detect from website                    │
│                                                               │
│  Industry Vertical (optional)                                │
│  [Select vertical ▼___________________________]              │
│   • Fashion & Apparel        • Home & Garden                │
│   • Consumer Electronics     • Sporting Goods                │
│   • Grocery & CPG           • Healthcare                    │
│   • Auto Parts              • B2B Tech                      │
│   → Auto-detect from website if not selected                │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 💡 Tip: We'll use the vertical to select relevant test  ││
│  │    queries and industry benchmarks. You can customize    ││
│  │    these in Step 3.                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│                           [Cancel]  [Next: Audit Mode →]     │
└─────────────────────────────────────────────────────────────┘
```

**Validation**:
- URL format validation (auto-add https://)
- Check if domain already audited (show existing audit card, offer to re-run)
- BuiltWith API quick check: Is this an Algolia customer? (abort if yes)

---

### 3. New Audit Wizard — Step 2: Audit Mode Selection

**Purpose**: Choose execution scope (full vs. modular)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  New Audit                                  [Close X]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Step 2 of 4: Audit Mode                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░ 50%           │
│                                                               │
│  Select what you want to run:                                │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🎯 Full Audit (Recommended)                              ││
│  │                                                           ││
│  │ Complete end-to-end audit with all phases:               ││
│  │ • Phase 1: Pre-Audit Research (14 steps)                 ││
│  │ • Phase 2: Browser Testing (20 steps)                    ││
│  │ • Phase 3: Scoring (10 challenge areas)                  ││
│  │ • Phase 4: Generate Report                               ││
│  │ • Phase 5: Generate Deliverables (PDF Book + 2 briefs)   ││
│  │                                                           ││
│  │ ⏱️ Estimated time: 35-50 minutes                         ││
│  │ 🎁 Output: PDF book + AE brief + Signal brief            ││
│  │                                                           ││
│  │              [Select Full Audit] ← SELECTED              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Or choose individual phases:                                │
│                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 📊 Research  │ │ 🧪 Browser   │ │ 📄 Delivs    │        │
│  │ Only         │ │ Testing Only │ │ Only         │        │
│  │              │ │              │ │              │        │
│  │ Phase 1 only │ │ Phase 2+3    │ │ Phase 5 only │        │
│  │ No browser   │ │ Needs Phase 1│ │ Needs Ph 1-3 │        │
│  │              │ │              │ │              │        │
│  │ ~20-25 min   │ │ ~15-20 min   │ │ ~5-8 min     │        │
│  │              │ │              │ │              │        │
│  │ [Select]     │ │ [Select]     │ │ [Select]     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                               │
│  ┌─ Advanced: Custom Phase Selection ──────────────────────┐│
│  │ [Expand ▼]                                               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│                    [← Back]  [Next: Configuration →]         │
└─────────────────────────────────────────────────────────────┘
```

**Advanced Mode** (when expanded):
```
│  ┌─ Advanced: Custom Phase Selection ──────────────────────┐│
│  │ [Collapse ▲]                                             ││
│  │                                                           ││
│  │ Select specific phases to run:                           ││
│  │                                                           ││
│  │ Phase 1: Pre-Audit Research                              ││
│  │ ☑ Company Context & Financials                           ││
│  │ ☑ Technology Stack (BuiltWith)                           ││
│  │ ☑ Traffic & Engagement (SimilarWeb)                      ││
│  │ ☑ Competitor Analysis                                    ││
│  │ ☐ Hiring Signals                                         ││
│  │ ☑ Investor Intelligence (SEC filings)                    ││
│  │ ☐ Strategic Angles                                       ││
│  │                                                           ││
│  │ Phase 2-5:                                               ││
│  │ ☑ Browser Testing (Phase 2)                              ││
│  │ ☑ Scoring (Phase 3)                                      ││
│  │ ☐ Report Generation (Phase 4)                            ││
│  │ ☑ Deliverable Generation (Phase 5)                       ││
│  │                                                           ││
│  │ ⏱️ Estimated time: ~28 minutes                           ││
│  └─────────────────────────────────────────────────────────┘│
```

**Key Features**:
- **Visual cards** for common modes (Full / Research / Browser / Deliverables)
- **Dependency warnings**: "Browser Testing requires Phase 1 data. Run Research first?"
- **Time estimates** update dynamically based on phase selection
- **Resume detection**: If existing audit found, show "Resume from Phase X" option

---

### 4. New Audit Wizard — Step 3: Configuration (Optional)

**Purpose**: Advanced settings for power users

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  New Audit                                  [Close X]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Step 3 of 4: Configuration (Optional)                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  ████████████████████████████████░░░░░░░░░░░ 75%           │
│                                                               │
│  Test Queries                                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ Use vertical-calibrated queries (recommended)         ││
│  │    14-18 queries auto-generated based on Fashion vertical││
│  │                                                           ││
│  │ ☐ Add custom queries                                     ││
│  │   [+ Add Query]                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Scoring Weights (Default: Industry Standard)               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ☐ Customize scoring weights                              ││
│  │   [Configure →]                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Browser Settings                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Viewport: [Desktop (1440x900) ▼]                         ││
│  │ ☑ Test mobile experience                                 ││
│  │ ☑ Capture screenshots (required for findings)            ││
│  │ Wait time between tests: [2 seconds ▼]                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Output Preferences                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ☑ Generate PDF Book (primary deliverable)                ││
│  │ ☑ Generate AE Pre-Call Brief                             ││
│  │ ☑ Generate Strategic Signal Brief                        ││
│  │ ☐ Email deliverables when complete to:                   ││
│  │   [your-email@algolia.com]                               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  💡 Most users can skip this step and use defaults.          │
│                                                               │
│            [← Back]  [Skip]  [Next: Review & Launch →]       │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Smart defaults** — most users skip this entirely
- **Expandable sections** — only show complexity when requested
- **Test query preview** — show example queries based on vertical
- **Email notification opt-in** — especially useful for long-running audits

---

### 5. New Audit Wizard — Step 4: Review & Launch

**Purpose**: Final confirmation before execution

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  New Audit                                  [Close X]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Step 4 of 4: Review & Launch                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  ████████████████████████████████████████████████ 100%      │
│                                                               │
│  Review your audit configuration:                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Company                                                   ││
│  │ • Website: costco.com                          [Edit]    ││
│  │ • Name: Costco Wholesale                                 ││
│  │ • Vertical: Grocery & CPG                                ││
│  │                                                           ││
│  │ Audit Mode                                               ││
│  │ • Type: Full Audit (Phases 1-5)                [Edit]    ││
│  │ • Estimated duration: 35-50 minutes                      ││
│  │                                                           ││
│  │ Configuration                                             ││
│  │ • Test queries: 16 vertical-calibrated       [Edit]     ││
│  │ • Scoring: Industry standard weights                     ││
│  │ • Browser: Desktop + Mobile                              ││
│  │ • Output: PDF Book + AE Brief + Signal Brief             ││
│  │ • Notifications: Email when complete                     ││
│  │                                                           ││
│  │ Resources Required                                        ││
│  │ • BuiltWith API: ~7 calls (~70 credits)                  ││
│  │ • SimilarWeb API: ~14 calls (~140 credits)               ││
│  │ • Yahoo Finance: ~6 calls (free)                         ││
│  │ • Chrome MCP: ~25 screenshots                            ││
│  │                                                           ││
│  │ ⚠️ Current balances:                                     ││
│  │   BuiltWith: 1,247 credits remaining (sufficient)        ││
│  │   SimilarWeb: 3,892 credits remaining (sufficient)       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ☑ I understand this audit will run in the background and    │
│     may take up to 50 minutes to complete.                   │
│                                                               │
│                    [← Back]  [Launch Audit 🚀]               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Configuration summary** with inline edit links
- **Credit cost preview** — prevents surprise API quota exhaustion
- **Confirmation checkbox** — user acknowledges time commitment
- **Large CTA button** — "Launch Audit 🚀"

**Post-Launch**:
- Redirect to Audit Detail View (monitoring tab)
- Show toast notification: "Audit started! We'll email you when complete."
- Add audit to queue on Dashboard

---

### 6. Audit Detail View — Overview Tab

**Purpose**: Real-time monitoring and status dashboard

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                         │
├─────────────────────────────────────────────────────────────┤
│  Costco Wholesale                                            │
│  costco.com • Started 18 minutes ago                         │
│                                                               │
│  [Overview] [Research] [Browser Tests] [Scoring]             │
│  [Deliverables] [Actions]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Status: ⏱️ Running — Phase 2 of 5 (Browser Testing)        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  ████████████████████████████░░░░░░░░░░░░░░░░ 68%          │
│  Estimated completion: 12 minutes                            │
│                                                               │
│  ┌─ Phase Progress ────────────────────────────────────────┐│
│  │                                                           ││
│  │ ✅ Phase 0: Workspace Setup                              ││
│  │    Completed in 2s                                       ││
│  │                                                           ││
│  │ ✅ Phase 1: Pre-Audit Research                           ││
│  │    Wave 1: Company, Tech, Traffic, Competitors ✅        ││
│  │    Wave 2: Queries, Strategic, Hiring, Financials ✅     ││
│  │    Wave 3: Investor Intel, Deep Hiring ✅                ││
│  │    Wave 4: ICP Mapping ✅                                ││
│  │    Completed in 16m 23s                                  ││
│  │                                                           ││
│  │ ⏱️ Phase 2: Browser Testing (ACTIVE)                     ││
│  │    Step 2a: Initial Observations ✅                       ││
│  │    Step 2b: Empty State Test ✅                          ││
│  │    Step 2c: SAYT Test ✅                                 ││
│  │    Step 2d: Full Search Results ✅                       ││
│  │    Step 2e: Typo Tolerance (4/6 queries) 🔄             ││
│  │    Step 2f-2t: Pending...                                ││
│  │    7/20 steps complete — 2m 18s elapsed                  ││
│  │                                                           ││
│  │ ⏳ Phase 3: Scoring & Analysis                           ││
│  │    Pending Phase 2 completion                            ││
│  │                                                           ││
│  │ ⏳ Phase 4: Report Generation                            ││
│  │    Pending Phase 3 completion                            ││
│  │                                                           ││
│  │ ⏳ Phase 5: Deliverable Generation                       ││
│  │    Pending Phase 4 completion                            ││
│  │                                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Live Activity Log                          [Expand ▼]       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 18:43:12 | Screenshot captured: 05-typo-headlite.png     ││
│  │ 18:43:09 | Typo query "headlite" — 0 results found      ││
│  │ 18:42:54 | Typo query "vaccuum" — 8 results found       ││
│  │ 18:42:38 | Screenshot captured: 04-full-results.png     ││
│  │ 18:42:35 | Full search for "laptop" — 347 results       ││
│  │ 18:42:18 | SAYT latency: 280ms (good)                   ││
│  │ ... [View Full Log]                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  [Pause Audit]  [Cancel Audit]  [Export Log]                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Real-time progress** — WebSocket updates, no refresh needed
- **Hierarchical phase view** — shows wave structure, step completion
- **Live activity log** — streaming events (screenshots captured, network requests, errors)
- **Action buttons** — Pause (resume later), Cancel (abort), Export Log (debugging)

**Error Handling UI**:
If an error occurs (e.g., CAPTCHA, WAF block):
```
│  ⚠️ Phase 2: Browser Testing (PAUSED — User Action Required) │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ CAPTCHA Detected                                         ││
│  │                                                           ││
│  │ The website presented a CAPTCHA challenge. Please solve  ││
│  │ it manually in the browser window to continue.           ││
│  │                                                           ││
│  │ [View Browser Window] [Mark as Solved] [Skip This Test]  ││
│  └─────────────────────────────────────────────────────────┘│
```

---

### 7. Audit Detail View — Research Tab

**Purpose**: View scratchpad files generated in Phase 1

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Costco Wholesale                                            │
│                                                               │
│  [Overview] [Research] [Browser Tests] [Scoring]             │
│  [Deliverables] [Actions]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 1: Pre-Audit Research                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  Status: ✅ Complete (16m 23s)                               │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Scratchpad Files (12)                                    ││
│  │                                                           ││
│  │ ┌─ 01-company-context.md ─────────────────── [View] [⬇]┐││
│  │ │ • Revenue: $254.2B (FY2024) [Yahoo Finance]          │││
│  │ │ • Employees: 316,000                                 │││
│  │ │ • Vertical: Grocery & CPG                            │││
│  │ │ • CEO: Ron Vachris (Jan 2024)                        │││
│  │ │ • CFO: Richard Galanti (retired Feb 2024)            │││
│  │ └─────────────────────────────────────────────────────┘││
│  │                                                           ││
│  │ ┌─ 02-tech-stack.md ──────────────────────── [View] [⬇]┐││
│  │ │ • Current Search: Native (no third-party vendor)     │││
│  │ │ • E-commerce: Custom platform                        │││
│  │ │ • Analytics: Google Analytics, Adobe Analytics       │││
│  │ │ • ⚠️ No enterprise search vendor detected            │││
│  │ │ • Opportunity: Greenfield deployment                 │││
│  │ └─────────────────────────────────────────────────────┘││
│  │                                                           ││
│  │ ┌─ 03-traffic-data.md ────────────────────── [View] [⬇]┐││
│  │ │ • Monthly Visits: 187M (SimilarWeb)                  │││
│  │ │ • Bounce Rate: 28.6%                                 │││
│  │ │ • Direct: 52.4% | Organic: 31.8% | Paid: 8.2%       │││
│  │ │ • Top Keywords: "costco", "costco near me", ...      │││
│  │ └─────────────────────────────────────────────────────┘││
│  │                                                           ││
│  │ [+ Expand All] [− Collapse All]                          ││
│  │                                                           ││
│  │ 04-competitors.md               [View] [Download]        ││
│  │ 05-test-queries.md              [View] [Download]        ││
│  │ 06-strategic-context.md         [View] [Download]        ││
│  │ 07-hiring-signals.md            [View] [Download]        ││
│  │ 08-financial-profile.md         [View] [Download]        ││
│  │ 09-browser-findings.md          [View] [Download]        ││
│  │ 10-scoring-matrix.md            [View] [Download]        ││
│  │ 11-investor-intelligence.md     [View] [Download]        ││
│  │ 12-icp-priority-mapping.md      [View] [Download]        ││
│  │                                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  [Download All Scratchpad Files (.zip)]                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Collapsible previews** — show key data points per file
- **Hyperlinked sources** — click financial data → opens Yahoo Finance URL
- **Bulk download** — export all 12 scratchpad files as ZIP
- **Edit capability** (power users) — edit test queries, financials, then re-run Phase 2+

---

### 8. Audit Detail View — Browser Tests Tab

**Purpose**: View screenshot gallery and test results

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Costco Wholesale                                            │
│                                                               │
│  [Overview] [Research] [Browser Tests] [Scoring]             │
│  [Deliverables] [Actions]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 2: Browser Testing                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  Status: ✅ Complete (18m 45s) — 20/20 steps passed          │
│                                                               │
│  Test Results Summary                                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ Passed: 14     ⚠️ Warning: 4     ❌ Failed: 2         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Screenshot Gallery (24)                [Grid View ⬛] [⬜]   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ [IMG]    │ │ [IMG]    │ │ [IMG]    │ │ [IMG]    │       │
│  │ 01-home  │ │ 02-empty │ │ 03-sayt  │ │ 04-full  │       │
│  │          │ │  state   │ │          │ │ results  │       │
│  │ [View]   │ │ [View]   │ │ [View]   │ │ [View]   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ [IMG]    │ │ [IMG]    │ │ [IMG]    │ │ [IMG]    │       │
│  │ 05-typo  │ │ 06-syno  │ │ 07-no-   │ │ 08-non-  │       │
│  │ headlite │ │ couch    │ │ results  │ │ product  │       │
│  │ ❌ FAIL  │ │ ⚠️ WARN  │ │ ✅ PASS  │ │ ❌ FAIL  │       │
│  │ [View]   │ │ [View]   │ │ [View]   │ │ [View]   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                               │
│  ... [Load More]                                             │
│                                                               │
│  Detailed Test Results                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ❌ Step 2e: Typo Tolerance — "headlite"                  ││
│  │    Query: "headlite" (should find "headlight")           ││
│  │    Result: 0 results found                               ││
│  │    Expected: >0 results OR "Did you mean headlight?"     ││
│  │    Screenshot: 05-typo-headlite.png                      ││
│  │    Severity: HIGH                                        ││
│  │    [View Screenshot] [View in Browser]                   ││
│  │                                                           ││
│  │ ⚠️ Step 2f: Synonym Test — "couch"                       ││
│  │    Query: "couch" (should find sofas)                    ││
│  │    Result: 8 results found (expected >50)                ││
│  │    Expected: Treat "couch" = "sofa"                      ││
│  │    Screenshot: 06-synonym-couch.png                      ││
│  │    Severity: MEDIUM                                      ││
│  │    [View Screenshot] [View in Browser]                   ││
│  │                                                           ││
│  │ ... [Show All 20 Tests]                                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  [Download All Screenshots (.zip)]                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Visual gallery** — thumbnail grid with pass/fail badges
- **Lightbox view** — click to enlarge screenshot with annotations
- **Filterable** — show only failed tests, only warnings, or all
- **Comparison view** (advanced) — side-by-side before/after if re-running audit

---

### 9. Audit Detail View — Scoring Tab

**Purpose**: View 10-area scoring matrix

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Costco Wholesale                                            │
│                                                               │
│  [Overview] [Research] [Browser Tests] [Scoring]             │
│  [Deliverables] [Actions]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 3: Scoring & Analysis                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  Status: ✅ Complete (3m 12s)                                │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                           ││
│  │            Overall Score: 4.4 / 10                        ││
│  │                                                           ││
│  │            🟢─────────────🔴                              ││
│  │            └──────────────^                               ││
│  │                           │                               ││
│  │                    Above Average                          ││
│  │                                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Scoring Matrix (10 Challenge Areas)                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Area                       | Score | Severity | Weight   ││
│  │─────────────────────────────┼───────┼──────────┼─────────││
│  │ 1. Latency                 │  8/10 │ LOW      │ 0.5x    ││
│  │ 2. Typo Tolerance          │  2/10 │ HIGH 🔴  │ 2.0x    ││
│  │ 3. Query Suggestions       │  6/10 │ MEDIUM   │ 1.0x    ││
│  │ 4. Intent Detection        │  4/10 │ MEDIUM   │ 1.0x    ││
│  │ 5. Merchandising           │  7/10 │ LOW      │ 0.5x    ││
│  │ 6. Content Commerce        │  3/10 │ HIGH 🔴  │ 2.0x    ││
│  │ 7. Semantic/NLP Search     │  2/10 │ HIGH 🔴  │ 2.0x    ││
│  │ 8. Dynamic Facets          │  5/10 │ MEDIUM   │ 1.0x    ││
│  │ 9. Recommendations         │  1/10 │ HIGH 🔴  │ 2.0x    ││
│  │ 10. Search Intelligence    │  4/10 │ MEDIUM   │ 1.0x    ││
│  │─────────────────────────────┴───────┴──────────┴─────────││
│  │ Weighted Average: 4.4 / 10                               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Top 3 Critical Gaps                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🔴 Recommendations (1/10)                                 ││
│  │    Zero product recommendations on PDPs                  ││
│  │    → Algolia Recommend                                   ││
│  │                                                           ││
│  │ 🔴 Typo Tolerance (2/10)                                  ││
│  │    "headlite" returns 0 results (should find headlight)  ││
│  │    → Algolia Typo Tolerance                              ││
│  │                                                           ││
│  │ 🔴 Semantic/NLP Search (2/10)                             ││
│  │    "best TV for gaming under $1000" returns insurance    ││
│  │    → Algolia NeuralSearch                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  [View Scoring Formula] [Export Matrix (.csv)]               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Visual score meter** — speedometer/gauge chart
- **Color-coded severity** — red for HIGH, yellow for MEDIUM, green for LOW
- **Weighted formula shown** — transparency in how overall score is calculated
- **Gap prioritization** — top 3 critical areas with Algolia product mapping

---

### 10. Audit Detail View — Deliverables Tab

**Purpose**: Download generated outputs

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Costco Wholesale                                            │
│                                                               │
│  [Overview] [Research] [Browser Tests] [Scoring]             │
│  [Deliverables] [Actions]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 5: Deliverables                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  Status: ✅ Complete (8m 34s) — 3 files generated            │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📕 Search Audit Book (PDF)                               ││
│  │    costco-search-audit-book.pdf                          ││
│  │    3.8 MB • 36 pages • Brand-validated                   ││
│  │    Generated 2 hours ago                                 ││
│  │                                                           ││
│  │    [Preview] [Download] [Email] [Share Link]             ││
│  │                                                           ││
│  │    Table of Contents:                                    ││
│  │    • Cover                                               ││
│  │    • Act I: The Verdict (Ch 1-4)                         ││
│  │    • Act II: The Proof (Ch 5-13) — 8 findings           ││
│  │    • Act III: Why Now (Ch 14-18)                         ││
│  │    • Act IV: The Path (Ch 19-22)                         ││
│  │    • Appendices (A-F)                                    ││
│  │                                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📄 AE Pre-Call Brief (Markdown)                          ││
│  │    costco-ae-precall-brief.md                            ││
│  │    42 KB • 8 sections • Hyperlinked sources              ││
│  │    Generated 2 hours ago                                 ││
│  │                                                           ││
│  │    [Preview] [Download] [Copy to Clipboard] [Share]      ││
│  │                                                           ││
│  │    Sections:                                             ││
│  │    • Company Snapshot                                    ││
│  │    • Strategic Intelligence                              ││
│  │    • In Their Own Words (5 exec quotes)                  ││
│  │    • Technology Stack                                    ││
│  │    • Buying Committee (6 stakeholders)                   ││
│  │    • Search Audit Findings (8 gaps)                      ││
│  │    • Revenue Impact ($3.2M conservative est.)            ││
│  │    • Discovery Questions                                 ││
│  │                                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📋 Strategic Signal Brief (Markdown)                     ││
│  │    costco-strategic-signal-brief.md                      ││
│  │    12 KB • 1 page • LLM-optimized                        ││
│  │    Generated 2 hours ago                                 ││
│  │                                                           ││
│  │    [Preview] [Download] [Send to CRM]                    ││
│  │                                                           ││
│  │    Purpose: Downstream LLM consumption                   ││
│  │    Format: Standalone facts with full context per line   ││
│  │    Use Case: Feed into ChatGPT/Claude for sales prep     ││
│  │                                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  [Download All Deliverables (.zip)]                          │
│  [Regenerate Deliverables] (re-runs Phase 5 only)           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **File cards** with metadata (size, page count, validation status)
- **Multiple export options** — Download, Email, Share Link, Copy to Clipboard
- **Preview mode** — view PDF inline without downloading
- **Regeneration** — re-run Phase 5 if user edits scratchpad files

**Share Link Modal** (when clicked):
```
┌─────────────────────────────────────────────────────────────┐
│  Share: Costco Search Audit Book                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Share Link (expires in 7 days)                             │
│  [https://audits.algolia.com/share/a7b9c...] [Copy 📋]      │
│                                                               │
│  Or share via email:                                         │
│  To: [_____________________________]                         │
│  Message (optional):                                         │
│  [_________________________________________________]         │
│  [_________________________________________________]         │
│                                                               │
│  [Cancel] [Send Email]                                       │
└─────────────────────────────────────────────────────────────┘
```

---

### 11. Library View — All Audits

**Purpose**: Browse, search, and manage all past audits

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Audit Library                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [🔍 Search audits...]                                       │
│                                                               │
│  Filter by:                                                  │
│  Status: [All ▼] Vertical: [All ▼] Score: [All ▼]           │
│  Date: [Last 30 days ▼]                                      │
│                                                               │
│  Sort: [Most Recent ▼]                                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ Costco Wholesale                      Score: 4.4/10   ││
│  │    costco.com • Grocery & CPG                            ││
│  │    Completed 2 hours ago • 36-page PDF                   ││
│  │    [View] [Download] [Share] [Delete]                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ Tapestry (Coach)                      Score: 4.2/10   ││
│  │    coach.com • Fashion & Apparel                         ││
│  │    Completed 3 days ago • 38-page PDF                    ││
│  │    [View] [Download] [Share] [Delete]                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ⏱️ TheRealReal                           Phase 2/5       ││
│  │    therealreal.com • Fashion & Apparel                   ││
│  │    Running for 18 minutes                                ││
│  │    [Monitor] [Pause] [Cancel]                            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ❌ AutoZone                               Failed         ││
│  │    autozone.com • Auto Parts                             ││
│  │    Failed 5 days ago (WAF block) • Partial data available││
│  │    [Retry] [View Partial Data] [Delete]                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ... [Load More]                                             │
│                                                               │
│  Bulk Actions:                                               │
│  [☐ Select All] [Export Selected] [Delete Selected]         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Advanced filtering** — by status, vertical, score, date range
- **Search** — by company name, domain, or keyword
- **Bulk operations** — select multiple audits, export CSV, delete
- **Failed audit handling** — show partial data, offer retry

---

### 12. Settings — MCP Server Status

**Purpose**: Monitor health of required MCP servers

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Settings                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [MCP Servers] [API Credits] [Preferences] [Team]           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  MCP Server Status                                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ Chrome MCP                                            ││
│  │    Status: Connected                                     ││
│  │    Version: 1.2.4                                        ││
│  │    Last health check: 2 minutes ago                      ││
│  │    [Test Connection]                                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ SimilarWeb MCP                                        ││
│  │    Status: Connected                                     ││
│  │    API Key: ••••••••••••3a7f                             ││
│  │    Credits Remaining: 3,892 (updated 1 hour ago)         ││
│  │    [Test Connection] [Update API Key]                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ BuiltWith MCP                                         ││
│  │    Status: Connected                                     ││
│  │    API Key: ••••••••••••9b2c                             ││
│  │    Credits Remaining: 1,247 (updated 30 min ago)         ││
│  │    ⚠️ Low balance — each audit uses ~70 credits         ││
│  │    [Test Connection] [Top Up Credits] [Update API Key]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ Yahoo Finance MCP                                     ││
│  │    Status: Connected                                     ││
│  │    Free tier (no credits required)                       ││
│  │    [Test Connection]                                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ⚠️ SEC EDGAR MCP                                         ││
│  │    Status: Disconnected                                  ││
│  │    Last error: Connection timeout (2 min ago)            ││
│  │    Impact: Investor intelligence (Phase 1 Step 12) will  ││
│  │            fall back to web search                       ││
│  │    [Retry Connection] [Troubleshoot]                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  [Test All Connections]                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Health dashboard** — visual status per MCP server
- **Credit monitoring** — real-time balance with low-balance warnings
- **Fallback explanations** — if a server is down, show what happens
- **Troubleshooting links** — contextual help per server

---

## Mobile Considerations

### Mobile-First Screens

For **Marketing Managers on-the-go**, provide a lightweight mobile UI for:
1. **Starting audits** — simplified wizard (URL input only, defaults for everything else)
2. **Monitoring progress** — push notifications when phases complete
3. **Viewing deliverables** — PDF preview, download to Files app

Mobile screens NOT needed for:
- Editing scratchpad files (desktop-only power user feature)
- Customizing scoring weights (advanced, desktop-only)
- Bulk operations (better on desktop)

---

## Key User Flows

### Flow 1: Marketing Manager — First Time User

1. **Dashboard** → Click "+ New Audit"
2. **Wizard Step 1** → Enter `costco.com`, auto-detect vertical
3. **Wizard Step 2** → Select "Full Audit" (default)
4. **Wizard Step 3** → Skip (defaults are fine)
5. **Wizard Step 4** → Review, click "Launch Audit 🚀"
6. **Redirected to Audit Detail** → Overview tab, see live progress
7. **Receive email notification** → "Your Costco audit is complete!"
8. **Return to platform** → Deliverables tab, download PDF book
9. **Share with AE** → Click "Share Link", send URL via Slack

**Success**: User completes full audit without technical knowledge in 3 clicks + 1 URL input.

---

### Flow 2: Sales Engineer — Quick Pre-Call Research

1. **Dashboard** → Click "+ New Audit"
2. **Wizard Step 1** → Enter `therealreal.com`
3. **Wizard Step 2** → Select "Research Only" (Phase 1 only)
4. **Wizard Step 3** → Skip
5. **Launch** → Wait 20 minutes (or close tab, get notification)
6. **Return** → Research tab, expand scratchpad files
7. **Quick scan**: Company context, financials, investor quotes, hiring signals
8. **Deliverables tab** → Generate "AE Brief" only (skip PDF book for speed)
9. **Download AE brief** → Markdown file, paste into call prep doc

**Success**: User gets strategic intelligence in 20 minutes without browser testing.

---

### Flow 3: Product Marketing — Advanced Custom Audit

1. **Dashboard** → Click "+ New Audit"
2. **Wizard Step 1** → Enter `lacoste.com`, set vertical to "Fashion & Apparel"
3. **Wizard Step 2** → Click "Advanced: Custom Phase Selection"
4. **Select phases**: Company, Tech, Traffic, Competitors, Browser Testing, Scoring
5. **Skip**: Hiring, Investor Intel (not needed for this use case)
6. **Wizard Step 3** → Configure:
   - Add 8 custom test queries (French luxury brand terms)
   - Customize scoring weights (2x weight on Semantic Search for luxury vertical)
7. **Launch** → Monitor on Overview tab
8. **After Phase 1**: Research tab, edit `05-test-queries.md` to refine queries
9. **Actions panel** → "Resume Audit" (re-runs Phase 2 with updated queries)
10. **After Phase 3**: Scoring tab, export scoring matrix CSV
11. **Deliverables**: Generate PDF book + AE brief

**Success**: Power user has full control over audit parameters and iterates on findings.

---

### Flow 4: Partner Marketing — Batch Processing

1. **Dashboard** → Click "+ New Audit"
2. **Wizard** → Choose "Batch Mode" (NEW feature for this persona)
3. **Upload CSV** with columns: `domain, company_name, vertical`
4. **Configure once**: Full Audit, default settings
5. **Launch batch** → Queue 10 audits
6. **Dashboard** → View queue (10 audits running sequentially or parallel if resources allow)
7. **Receive email** → "Your batch of 10 audits is complete"
8. **Library** → Filter by batch ID, view all results
9. **Export** → "Download All Deliverables (.zip)" — 10 PDF books + 20 briefs

**Success**: User processes 10 prospects overnight without manual intervention.

---

## Technical Architecture Recommendations

### Backend

**Stack**: Node.js + Express (or Python + FastAPI)

**Key Services**:
1. **Audit Orchestrator** — manages Phase 1-5 execution, Agent Teams coordination
2. **MCP Proxy Layer** — routes calls to Chrome, SimilarWeb, BuiltWith, Yahoo Finance, SEC EDGAR
3. **Task Queue** — Redis/Bull for background job processing
4. **WebSocket Server** — real-time progress updates to frontend
5. **File Storage** — S3 for PDFs, screenshots, scratchpad files
6. **Database** — PostgreSQL for audit metadata, user accounts

**Data Model**:
```
audits
  - id (uuid)
  - domain (string)
  - company_name (string)
  - vertical (string)
  - status (enum: queued, running, paused, completed, failed)
  - current_phase (int 0-5)
  - current_step (string)
  - progress_pct (int 0-100)
  - overall_score (float, nullable)
  - created_at, updated_at
  - user_id (fk to users)

audit_phases
  - audit_id (fk)
  - phase_num (int 0-5)
  - status (enum: pending, running, completed, failed)
  - started_at, completed_at
  - duration_seconds (int)
  - error_message (text, nullable)

audit_scratchpad_files
  - audit_id (fk)
  - file_name (string, e.g., "01-company-context.md")
  - content (text)
  - created_at, updated_at

audit_screenshots
  - audit_id (fk)
  - file_name (string, e.g., "05-typo-headlite.png")
  - s3_url (string)
  - step_name (string, e.g., "Step 2e: Typo Tolerance")
  - created_at

audit_deliverables
  - audit_id (fk)
  - deliverable_type (enum: pdf_book, ae_brief, signal_brief)
  - s3_url (string)
  - file_size_bytes (int)
  - page_count (int, nullable)
  - created_at

users
  - id (uuid)
  - email (string)
  - name (string)
  - role (enum: viewer, editor, admin)
  - created_at
```

---

### Frontend

**Stack**: React + TypeScript + Tailwind CSS + shadcn/ui

**Key Libraries**:
- **React Router** — page navigation
- **TanStack Query** (React Query) — API data fetching, caching
- **Socket.IO Client** — WebSocket real-time updates
- **Zustand** — global state (user auth, audit queue)
- **React Hook Form** — wizard form handling
- **Zod** — form validation
- **React PDF** — PDF preview/rendering
- **Recharts** — data visualizations (score meters, progress charts)

**State Management**:
- **Server state** (audits, MCP status) → React Query
- **Client state** (wizard form, UI toggles) → React Hook Form + local state
- **Global state** (current user, queue notifications) → Zustand

---

### Real-Time Architecture

**WebSocket Events** (server → client):
```javascript
// Audit started
{ event: "audit.started", audit_id, timestamp }

// Phase progress
{ event: "phase.progress", audit_id, phase: 2, step: "2e", progress_pct: 68 }

// Phase complete
{ event: "phase.complete", audit_id, phase: 1, duration_seconds: 983 }

// Activity log
{ event: "activity.log", audit_id, message: "Screenshot captured: 05-typo.png" }

// Error occurred
{ event: "audit.error", audit_id, phase: 2, error_message: "CAPTCHA detected" }

// Audit complete
{ event: "audit.complete", audit_id, overall_score: 4.4, deliverables: [...] }
```

**Frontend subscription**:
```typescript
useEffect(() => {
  const socket = io('wss://api.audits.algolia.com');

  socket.on('connect', () => {
    socket.emit('subscribe', { audit_id });
  });

  socket.on('phase.progress', (data) => {
    setProgress(data.progress_pct);
    setCurrentStep(data.step);
  });

  socket.on('audit.complete', (data) => {
    showNotification('Audit complete!');
    queryClient.invalidateQueries(['audit', audit_id]);
  });

  return () => socket.disconnect();
}, [audit_id]);
```

---

## Design System & Branding

### Color Palette

Based on Algolia brand:

```
Primary:
  - Nebula Blue: #003DFF (CTAs, links)
  - Space Gray: #21243D (headings, body text)
  - Algolia Purple: #5468FF (accents, progress bars)

Secondary:
  - Cloud White: #FFFFFF (backgrounds)
  - Mist Gray: #F5F7FA (card backgrounds)
  - Steel Gray: #6B7280 (secondary text)

Status:
  - Success Green: #10B981 (✅ passed tests, completed phases)
  - Warning Yellow: #F59E0B (⚠️ warnings, medium severity)
  - Error Red: #EF4444 (❌ failed tests, high severity)
  - Info Blue: #3B82F6 (ℹ️ info badges)
```

### Typography

```
Headings: Inter (Google Fonts)
  - H1: 32px, 700 weight
  - H2: 24px, 600 weight
  - H3: 18px, 600 weight

Body: Inter
  - Body: 16px, 400 weight
  - Small: 14px, 400 weight
  - Tiny: 12px, 400 weight

Mono (for code/logs): JetBrains Mono
  - 14px, 400 weight
```

### Components

Use **shadcn/ui** for consistency with Algolia design system:
- Button, Input, Select, Checkbox, RadioGroup
- Card, Badge, Alert, Toast
- Dialog, Drawer, Tooltip
- Progress, Skeleton (loading states)
- Tabs, Accordion, Collapsible
- Table, DataTable (for scoring matrix)

---

## Implementation Roadmap

### Phase 1: MVP (8-10 weeks)

**Week 1-2**: Backend foundation
- Set up Node.js/Express API
- PostgreSQL database schema
- MCP proxy layer (Chrome, SimilarWeb, BuiltWith)
- Task queue (Redis/Bull)
- WebSocket server

**Week 3-4**: Core audit engine
- Phase 0-1 implementation (research steps)
- Agent Teams orchestration
- Scratchpad file generation
- Error handling (CAPTCHA, WAF)

**Week 5-6**: Browser testing & scoring
- Phase 2 implementation (Chrome MCP integration)
- Phase 3 implementation (scoring matrix)
- Screenshot persistence (S3)

**Week 7-8**: Deliverable generation
- Phase 4-5 implementation (PDF book, briefs)
- HTML template system
- Chrome headless PDF generation

**Week 9-10**: Frontend MVP
- Dashboard (home, audit cards)
- New Audit Wizard (4 steps)
- Audit Detail View (5 tabs)
- Real-time progress updates (WebSocket)
- Authentication (email/password)

**MVP Scope**:
- Full Audit mode only (no modular phases yet)
- Desktop-only (no mobile)
- Single-user (no team collaboration)
- Manual CSV export (no CRM integration)

---

### Phase 2: Power User Features (4-6 weeks)

**Week 11-12**: Modular execution
- Phase selection UI (Advanced mode in wizard)
- Resume/pause capability
- Scratchpad file editing
- Regenerate deliverables

**Week 13-14**: Library & management
- Library view (all audits)
- Advanced filtering/search
- Bulk operations (export, delete)
- Failed audit handling

**Week 15-16**: Settings & monitoring
- MCP server health dashboard
- API credit monitoring
- User preferences
- Email notifications

---

### Phase 3: Collaboration & Scale (4-6 weeks)

**Week 17-18**: Team features
- Multi-user accounts
- Role-based access (viewer, editor, admin)
- Audit sharing (via link)
- Comments on findings

**Week 19-20**: Batch processing
- CSV upload for bulk audits
- Batch queue management
- Aggregate insights (cross-audit analytics)

**Week 21-22**: Integrations
- Salesforce integration (push audits to CRM)
- Slack notifications
- Zapier webhooks
- API documentation for external consumption

---

### Phase 4: Intelligence Layer (Future)

**Advanced features** (6+ months out):
- **AI-powered insights** — GPT-4 summarizes findings, suggests next steps
- **Competitive benchmarking** — compare scores across verticals
- **Trend analysis** — track score improvements over time (re-audit same prospect)
- **Custom templates** — save audit configs as templates
- **White-label mode** — rebrand for partner use
- **Mobile app** — native iOS/Android for monitoring

---

## Success Metrics

### Product Metrics

1. **Audit Completion Rate**: % of started audits that finish successfully
   - Target: >85%
2. **Time to First Audit**: Minutes from signup to launching first audit
   - Target: <5 minutes
3. **Monthly Active Audits**: Number of audits run per month
   - Target: 50+ audits/month by Month 3
4. **Deliverable Download Rate**: % of completed audits where PDF is downloaded
   - Target: >90%
5. **User Retention**: % of users who run 2+ audits
   - Target: >60%

### Business Metrics

1. **Sales Cycle Impact**: Days from audit delivery to first AE call
   - Target: <7 days
2. **Pipeline Influence**: % of opportunities where audit was used in sales process
   - Target: Track via Salesforce integration
3. **Win Rate**: Close rate for deals with audit vs. without
   - Target: 1.5x improvement
4. **User Satisfaction**: NPS score
   - Target: >50

---

## Appendix: Wireframe Gallery

(Include Figma/Sketch mockups here once design phase begins)

**Screens to mock up**:
1. Dashboard (home)
2. New Audit Wizard (4 steps)
3. Audit Detail — Overview tab (live progress)
4. Audit Detail — Research tab (scratchpad files)
5. Audit Detail — Browser Tests tab (screenshot gallery)
6. Audit Detail — Scoring tab (matrix + score meter)
7. Audit Detail — Deliverables tab (PDF preview)
8. Library view (all audits)
9. Settings — MCP health dashboard
10. Mobile: Dashboard (simplified)
11. Mobile: New Audit (quick start)
12. Mobile: Audit monitoring (live progress)

---

## Conclusion

Converting the Algolia Search Audit CLI skill into a SaaS dashboard requires careful UX design to serve multiple personas:
- **Marketing Managers** need simplicity (3-click full audit)
- **Sales Engineers** need speed (research-only mode)
- **Product Marketers** need control (advanced phase selection)
- **Partner Marketing** needs scale (batch processing)

The proposed IA follows a **progressive disclosure** pattern: simple by default, powerful when needed. The real-time monitoring UI builds trust by showing exactly what's happening during the 35-50 minute audit process. The deliverables tab provides multiple export formats to fit different workflows.

**Next steps**:
1. User testing with 5-10 Algolia employees (one per persona)
2. High-fidelity Figma mockups
3. Technical architecture review with engineering team
4. API design for MCP proxy layer
5. Spike: Agent Teams orchestration in backend
6. Build MVP (Phase 1 roadmap)

---

**Questions for stakeholders**:
1. Which persona is the #1 priority? (Recommendation: Marketing Manager for MVP)
2. What's the expected audit volume? (impacts infrastructure scaling)
3. Should audits be shareable publicly (marketing collateral) or internal-only?
4. Is there budget for premium MCP API tiers (higher rate limits)?
5. What's the appetite for mobile app vs. responsive web?
