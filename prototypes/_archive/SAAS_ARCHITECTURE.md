# Algolia Search Audit Platform - SaaS Architecture

**Status**: Architecture Design
**Date**: 2026-03-02
**Architect**: Claude Sonnet 4.5

---

## Executive Summary

Transform the `/algolia-search-audit` Claude Code skill into a self-service SaaS platform enabling any Algolia employee to run comprehensive search audits without technical knowledge. The platform orchestrates 5 phases, 14 MCP endpoints across 5 servers, 20+ browser tests, and generates 3 production-ready deliverables with full source citation and brand compliance.

**Target Users**: Sales (AEs, SEs), Marketing (PMM, ABM), Customer Success, Executive Leadership
**Core Value**: 40-hour manual audit → 35-minute automated execution with higher quality and consistency

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [UI/UX Design](#uiux-design)
3. [Screen-by-Screen Breakdown](#screen-by-screen-breakdown)
4. [Backend Architecture](#backend-architecture)
5. [Database Schema](#database-schema)
6. [API Design](#api-design)
7. [Technology Stack](#technology-stack)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Security & Access Control](#security--access-control)
10. [Cost & Scaling](#cost--scaling)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React SPA)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │  Audit Exec  │  │  Deliverables│          │
│  │  (Audit List)│  │  (Progress)  │  │  (Viewer)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API + WebSocket (real-time progress)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Express/FastAPI)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth Service │  │ Audit API    │  │ Deliverable  │          │
│  │ (Okta/Auth0) │  │ (REST)       │  │ Generator    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Audit Engine │  │ Agent Teams  │  │ Status Mgr   │          │
│  │ (State Mgmt) │  │ Coordinator  │  │ (WebSocket)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
        ┌─────────────┐ ┌──────────┐ ┌──────────┐
        │ MCP Proxies │ │ Browser  │ │ File     │
        │ (5 servers) │ │ Pool     │ │ Storage  │
        │             │ │ (Chrome) │ │ (S3/GCS) │
        └─────────────┘ └──────────┘ └──────────┘
                 │
    ┌────────────┼────────────┬────────────┬─────────────┐
    ▼            ▼            ▼            ▼             ▼
┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│BuiltWith│ │SimilarWeb│ │  Chrome  │ │  Yahoo   │ │WebSearch │
│  MCP    │ │   MCP    │ │   MCP    │ │ Finance  │ │   API    │
└────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PostgreSQL   │  │  Redis       │  │  Object      │          │
│  │ (audit data) │  │  (cache/     │  │  Storage     │          │
│  │              │  │   queue)     │  │  (assets)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. **Frontend (React SPA)**
- **Dashboard**: Audit list with status, filters, search
- **Audit Creation Wizard**: Domain entry, phase selection, settings
- **Execution Monitor**: Real-time progress with phase-by-phase status
- **Deliverable Viewer**: PDF viewer, markdown renderer, download

#### 2. **API Gateway**
- Authentication/Authorization (Okta SSO)
- Rate limiting per user/org
- Request validation
- WebSocket management (real-time status)

#### 3. **Orchestration Layer**
- **Audit Engine**: State machine managing 5 phases
- **Agent Teams Coordinator**: Parallel execution (Wave 1-4)
- **Status Manager**: Broadcasts progress via WebSocket

#### 4. **MCP Proxy Layer**
- Wraps 5 MCP servers with REST APIs
- Handles authentication, retries, rate limits
- Caches responses (Redis)

#### 5. **Browser Pool**
- Managed Chrome instances with remote debugging
- Screenshot capture and persistence
- WAF handling and CAPTCHA detection

#### 6. **Data Layer**
- **PostgreSQL**: Audit metadata, user data, permissions
- **Redis**: Job queue (Bull/BullMQ), result cache
- **S3/GCS**: Screenshots, PDFs, scratchpad files

---

## UI/UX Design

### Design Principles

1. **Progressive Disclosure**: Start simple (just enter domain), reveal complexity as needed (phase selection, custom queries)
2. **Real-Time Feedback**: WebSocket-driven progress updates, never block on long operations
3. **Transparency**: Show data sources, API calls, verification status
4. **Confidence Signals**: Data quality indicators ([FACT] / [ESTIMATE] / [OBSERVED])
5. **Mobile-Responsive**: Dashboard accessible on iPad for field sales

### Information Architecture

```
Home Dashboard
├── My Audits (list view with filters)
├── Create New Audit (wizard)
├── Audit Details (drill-down)
│   ├── Overview (status, metadata)
│   ├── Research Data (12 scratchpad tabs)
│   ├── Browser Findings (screenshots gallery)
│   ├── Deliverables (3 files + preview)
│   └── Settings (re-run phases, export)
├── Templates (saved phase configs)
└── Admin (usage stats, MCP health)
```

### Color System (Algolia Brand)

- **Primary**: Nebula Blue `#003DFF` (CTAs, progress)
- **Secondary**: Algolia Purple `#5468FF` (accents, charts)
- **Neutral**: Space Gray `#21243D` (text, borders)
- **Success**: `#36B37E` (completed phases)
- **Warning**: `#FFAB00` (estimates, caution signals)
- **Error**: `#E8513D` (failures, critical gaps)

---

## Screen-by-Screen Breakdown

### 1. Dashboard (Home)

**Purpose**: Central hub for all audits with filtering, search, and quick actions.

```
┌─────────────────────────────────────────────────────────────────┐
│  Algolia Search Audit Platform            [+ New Audit] [Admin] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  My Audits                                                        │
│  ┌──────┬──────┬────────┬─────────┐                             │
│  │ All  │ Mine │ Team   │ Starred │  [Search: _________] 🔍      │
│  └──────┴──────┴────────┴─────────┘                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Costco Wholesale                          🟢 COMPLETED   │    │
│  │ Created: Feb 21, 2026 by Alex Rivera                     │    │
│  │ Score: 4.4/10 | 47-page book | 6 deliverables           │    │
│  │ [View Report] [Download All] [⭐ Star]                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ The RealReal                              🟡 IN PROGRESS │    │
│  │ Created: Mar 2, 2026 by Jordan Kim                       │    │
│  │ Phase 2: Browser Testing (Step 12/20)    [View Live]    │    │
│  │ ████████████░░░░░░░░ 60%                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Boden                                     🔴 FAILED      │    │
│  │ Created: Mar 1, 2026 by Jordan Kim                       │    │
│  │ Error: MCP tools not loaded              [Retry] [Debug]│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Features**:
- **Status badges**: 🟢 Completed, 🟡 In Progress, 🔴 Failed, ⏸️ Paused
- **Quick filters**: All / Mine / Team / Starred
- **Search**: Full-text search on company name, domain, creator
- **Sorting**: By date, score, status
- **Actions**: View, Download, Star, Delete, Retry

---

### 2. Create New Audit (Wizard)

**Purpose**: Guided multi-step form to configure and launch an audit.

#### Step 1: Basic Info

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Audit                             [1] → 2 → 3 → 4   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Basic Information                                                │
│                                                                   │
│  Target Domain *                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ costco.com                                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│  💡 Enter the prospect's main e-commerce domain                  │
│                                                                   │
│  Company Name (optional)                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Costco Wholesale                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│  Will auto-detect if left blank                                  │
│                                                                   │
│  Industry Vertical (optional)                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [Select...]               ▼                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│  Options: Fashion, Sporting Goods, Auto Parts, Home Goods...    │
│                                                                   │
│                                    [Cancel]    [Next: Phases →] │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 2: Phase Selection

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Audit                             1 → [2] → 3 → 4   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Select Audit Phases                                              │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ ☑ Full Audit (Recommended)                            │      │
│  │   All phases end-to-end (~35 min)                     │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Or select individual phases:                                     │
│                                                                   │
│  Phase 1: Pre-Audit Research (~15 min)                           │
│  ☑ Company Context        ☑ Tech Stack         ☑ Traffic        │
│  ☑ Competitors            ☑ Financials         ☑ Hiring Signals │
│  ☑ Strategic Intel        ☑ Investor Intel     ☑ Buying Committee│
│                                                                   │
│  Phase 2: Browser Testing (~12 min)                              │
│  ☑ Search Audit (20 test steps)                                 │
│                                                                   │
│  Phase 3: Scoring (~2 min)                                       │
│  ☑ Analyze & Score (10 challenge areas)                         │
│                                                                   │
│  Phase 4-5: Deliverables (~6 min)                               │
│  ☑ PDF Book              ☑ AE Brief           ☑ Signal Brief    │
│                                                                   │
│  Estimated Runtime: 35 minutes                                    │
│                                                                   │
│                             [← Back]    [Next: Custom Queries →]│
└─────────────────────────────────────────────────────────────────┘
```

#### Step 3: Custom Queries (Optional)

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Audit                             1 → 2 → [3] → 4   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Custom Test Queries (Optional)                                   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ ○ Auto-generate from vertical                         │      │
│  │   System will select 14-18 queries based on industry  │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ ○ Custom queries                                       │      │
│  │   Add your own test queries (max 20)                  │      │
│  │                                                        │      │
│  │   1. [organic beef        ] 🔤 Broad                  │      │
│  │   2. [kirkland signature  ] 🏷️ Brand                  │      │
│  │   3. [orgnaic beef        ] ❌ Typo                   │      │
│  │   4. [return policy       ] 📄 Non-Product            │      │
│  │   5. [                    ]                           │      │
│  │   [+ Add Query]                                        │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│                             [← Back]    [Next: Review & Launch →]│
└─────────────────────────────────────────────────────────────────┘
```

#### Step 4: Review & Launch

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Audit                             1 → 2 → 3 → [4]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Review & Launch                                                  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ Domain:        costco.com                              │      │
│  │ Company:       Costco Wholesale                        │      │
│  │ Vertical:      General Retail                          │      │
│  │ Phases:        All (Full Audit)                        │      │
│  │ Test Queries:  14 auto-generated                       │      │
│  │ Runtime:       ~35 minutes                             │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ ⚠️ MCP Server Health Check                            │      │
│  │                                                        │      │
│  │ ✅ BuiltWith MCP        (7 endpoints)                 │      │
│  │ ✅ SimilarWeb MCP       (14 endpoints)                │      │
│  │ ✅ Chrome MCP           (browser pool)                │      │
│  │ ✅ Yahoo Finance MCP    (8 tools)                     │      │
│  │ ✅ WebSearch API        (Perplexity)                  │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Notifications                                                    │
│  ☑ Email me when complete                                        │
│  ☑ Slack alert on failure                                        │
│                                                                   │
│                             [← Back]    [🚀 Launch Audit]        │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Audit Execution Monitor (Real-Time)

**Purpose**: Live progress tracking with phase-by-phase breakdown and logs.

```
┌─────────────────────────────────────────────────────────────────┐
│  Costco Wholesale Audit                  🟡 Phase 2 In Progress │
│  Started: Mar 2, 2026 2:34 PM                Elapsed: 18m 32s   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Overall Progress                                                 │
│  ████████████████████████████░░░░░░░░ 72% (36/50 steps)         │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ Phase 1: Pre-Audit Research          ✅ COMPLETED     │      │
│  │ └─ Company Context                   ✅ 2m 15s        │      │
│  │ └─ Tech Stack                        ✅ 1m 42s        │      │
│  │ └─ Traffic Data (SimilarWeb)         ✅ 3m 08s        │      │
│  │ └─ Competitors                       ✅ 2m 31s        │      │
│  │ └─ Financials (Yahoo Finance)        ✅ 1m 54s        │      │
│  │ └─ Hiring Signals                    ✅ 1m 22s        │      │
│  │ └─ Investor Intelligence             ✅ 4m 11s        │      │
│  │ └─ Buying Committee                  ✅ 2m 47s        │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ Phase 2: Browser Testing             🔵 IN PROGRESS   │      │
│  │ ████████████████████████████░░░░░░░░ 14/20 steps      │      │
│  │                                                        │      │
│  │ ✅ 01. Homepage screenshot                             │      │
│  │ ✅ 02. Empty state test                                │      │
│  │ ✅ 03. SAYT test                                       │      │
│  │ ✅ 04. Full results                                    │      │
│  │ ✅ 05. Typo: "orgnaic beef"                            │      │
│  │ ✅ 06. Typo: "kirklan signature"                       │      │
│  │ ✅ 07. Synonym: "sofa" vs "couch"                      │      │
│  │ ✅ 08. No results: "asdfghjk"                          │      │
│  │ ✅ 09. Non-product: "return policy"                    │      │
│  │ ✅ 10. Intent: brand redirect                          │      │
│  │ ✅ 11. Merchandising consistency                       │      │
│  │ ✅ 12. Federated search                                │      │
│  │ ✅ 13. Mobile experience                               │      │
│  │ ✅ 14. NLP: "best tv under 1000"                       │      │
│  │ 🔵 15. Dynamic facets...                [Live]        │      │
│  │ ⏳ 16. Personalization                                 │      │
│  │ ⏳ 17. Recommendations                                 │      │
│  │ ⏳ 18. Merchandising rules                             │      │
│  │ ⏳ 19. Analytics signals                               │      │
│  │ ⏳ 20. Mobile checkout                                 │      │
│  │                                                        │      │
│  │ 📸 Screenshots: 14/20 captured                        │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  ⏳ Phase 3: Scoring (pending)                                   │
│  ⏳ Phase 4-5: Deliverables (pending)                            │
│                                                                   │
│  Live Logs                               [Filter: ▼] [Export]   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ 2:52 PM  [Browser] Typing query: "dynamic facets"     │      │
│  │ 2:52 PM  [Browser] Waiting for SAYT dropdown...       │      │
│  │ 2:52 PM  [Browser] Screenshot saved: 15-dynamic.png   │      │
│  │ 2:51 PM  [Chrome] ✅ Network: no Constructor API calls│      │
│  │ 2:51 PM  [Chrome] ℹ️ Search powered by native Shopify│      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│                            [⏸️ Pause]  [❌ Cancel]  [📊 View Data]│
└─────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Real-time progress bars** (WebSocket-driven)
- **Expandable phase sections** (click to see substeps)
- **Live logs** with filtering (Browser, API, Error)
- **Screenshot counter** (14/20 captured)
- **Pause/Cancel controls** (graceful shutdown)
- **"View Data" button** → opens Research Data tab

---

### 4. Audit Details (Drill-Down)

**Purpose**: Post-completion view with tabbed navigation to research data, findings, and deliverables.

#### Tab 1: Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Costco Wholesale Audit                         ✅ COMPLETED    │
│  Created: Feb 21, 2026 by Alex Rivera     Runtime: 34m 12s      │
├─────────────────────────────────────────────────────────────────┤
│  [Overview] [Research Data] [Findings] [Deliverables] [Settings]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Audit Summary                                                    │
│                                                                   │
│  ┌────────────────┬────────────────┬────────────────────────┐   │
│  │ Overall Score  │ Critical Gaps  │ Opportunity            │   │
│  │                │                │                        │   │
│  │    4.4/10      │       3        │  $15M-$30M             │   │
│  │   [Gauge SVG]  │  Zero NLP      │  Conservative-Moderate │   │
│  │                │  No Recs       │                        │   │
│  │                │  Weak Typo     │                        │   │
│  └────────────────┴────────────────┴────────────────────────┘   │
│                                                                   │
│  Company Context                                                  │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ Revenue:       $254.2B (FY2024) [FACT] 🔗             │      │
│  │ Employees:     316,000                                 │      │
│  │ Vertical:      Warehouse Retail                        │      │
│  │ Margin Zone:   🟢 GREEN (15.2% EBITDA)                │      │
│  │ Search Stack:  Native Shopify (no enterprise)         │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Deliverables                                                     │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ 📕 Search Audit Book (47 pages, 3.8 MB)               │      │
│  │ 📄 AE Pre-Call Brief (12 pages)                       │      │
│  │ 📊 Strategic Signal Brief (3 pages)                   │      │
│  │                                                        │      │
│  │ [📥 Download All] [📧 Email to Prospect]              │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Quick Actions                                                    │
│  [🔄 Re-run Phase]  [🧪 Run Fact-Check]  [⭐ Add to Templates]  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Tab 2: Research Data

```
┌─────────────────────────────────────────────────────────────────┐
│  Costco Wholesale Audit                         ✅ COMPLETED    │
├─────────────────────────────────────────────────────────────────┤
│  [Overview] [Research Data] [Findings] [Deliverables] [Settings]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Research Data (12 Scratchpad Files)                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [01-Company Context] [02-Tech Stack] [03-Traffic Data]   │   │
│  │ [04-Competitors] [05-Test Queries] [06-Strategic Context]│   │
│  │ [07-Hiring Signals] [08-Financial Profile] ...           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Selected: 01-Company Context                   [📥 Download]   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ # Company Context — Costco Wholesale                  │      │
│  │                                                        │      │
│  │ ## Overview                                            │      │
│  │ - **Founded**: 1976 (Price Club), 1983 (Costco)       │      │
│  │ - **Industry**: Warehouse Club / Membership Retail    │      │
│  │ - **Revenue**: $254.2B (FY2024) [FACT]                │      │
│  │   Source: https://finance.yahoo.com/quote/COST        │      │
│  │ - **Employees**: 316,000                               │      │
│  │ - **Locations**: 850+ warehouses (US, Canada, Japan)  │      │
│  │                                                        │      │
│  │ ## Strategic Leadership                                │      │
│  │ | Name | Title | Tenure | Background |                │      │
│  │ |------|-------|--------|------------|                │      │
│  │ | Ron Vachris | CEO | 2024 | 40yr Costco veteran |   │      │
│  │ | Richard Galanti | EVP CFO | 1984 | Ret. Sep 2024 |  │      │
│  │ ...                                                    │      │
│  │                                                        │      │
│  │ [Show Full Markdown] [Copy to Clipboard]              │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Data Quality Indicators                                          │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ ✅ Financial: 100% [FACT] (Yahoo Finance MCP)         │      │
│  │ ⚠️ Employee Count: [ESTIMATE] (BuiltWith)            │      │
│  │ ✅ Traffic: 100% [FACT] (SimilarWeb MCP)             │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Tab 3: Findings (Screenshot Gallery)

```
┌─────────────────────────────────────────────────────────────────┐
│  Costco Wholesale Audit                         ✅ COMPLETED    │
├─────────────────────────────────────────────────────────────────┤
│  [Overview] [Research Data] [Findings] [Deliverables] [Settings]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Browser Findings (20 Screenshots)                                │
│                                                                   │
│  Filter: [All ▼] [Critical Only] [NLP Tests] [Typo Tests]       │
│                                                                   │
│  ┌─────────────────────┬─────────────────────┬──────────────┐   │
│  │ [01-homepage.png]   │ [02-empty-state.png]│ [03-sayt.png]│   │
│  │ ✅ PASS             │ ⚠️ WARNING          │ ✅ PASS      │   │
│  │ Search bar visible  │ Blank empty state   │ Fast SAYT    │   │
│  └─────────────────────┴─────────────────────┴──────────────┘   │
│                                                                   │
│  ┌─────────────────────┬─────────────────────┬──────────────┐   │
│  │ [04-results.png]    │ [05-typo-orgnaic]   │ [06-typo-... │   │
│  │ ✅ PASS             │ 🔴 CRITICAL         │ 🔴 CRITICAL  │   │
│  │ 538 results         │ 0 results (no fix)  │ 0 results    │   │
│  └─────────────────────┴─────────────────────┴──────────────┘   │
│                                                                   │
│  Selected: 05-typo-orgnaic.png                                   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │                                                        │      │
│  │   [Full Screenshot Viewer — 1920x1080]                │      │
│  │                                                        │      │
│  │   Query: "orgnaic beef"                               │      │
│  │   Expected: Typo correction → "organic beef"          │      │
│  │   Found: Zero results                                  │      │
│  │   Severity: 🔴 CRITICAL                               │      │
│  │                                                        │      │
│  │   Industry Benchmark:                                  │      │
│  │   1 in 6 queries have typos (Baymard)                │      │
│  │                                                        │      │
│  │   Algolia Solution:                                    │      │
│  │   Algolia NeuralSearch with typo tolerance            │      │
│  │   Case Study: Lacoste +37% conversion                 │      │
│  │                                                        │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  [← Prev Screenshot]  [Download]  [Add to Deck]  [Next →]      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Tab 4: Deliverables

```
┌─────────────────────────────────────────────────────────────────┐
│  Costco Wholesale Audit                         ✅ COMPLETED    │
├─────────────────────────────────────────────────────────────────┤
│  [Overview] [Research Data] [Findings] [Deliverables] [Settings]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Deliverables (3 Files)                                           │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ 📕 Search Audit Book                                   │      │
│  │    costco-search-audit-book.pdf                        │      │
│  │    47 pages | 3.8 MB | Brand Score: 9.2/10            │      │
│  │                                                        │      │
│  │    [👁️ Preview in Browser] [📥 Download] [📧 Email]    │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ 📄 AE Pre-Call Brief                                   │      │
│  │    costco-ae-precall-brief.md                          │      │
│  │    12 pages | 42 KB | For internal use only           │      │
│  │                                                        │      │
│  │    [👁️ Preview] [📥 Download] [📋 Copy to Clipboard]   │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ 📊 Strategic Signal Brief                              │      │
│  │    costco-strategic-signal-brief.md                    │      │
│  │    3 pages | 18 KB | LLM-ready format                 │      │
│  │                                                        │      │
│  │    [👁️ Preview] [📥 Download] [🤖 Send to Slack Bot]   │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Bulk Actions                                                     │
│  [📥 Download All (ZIP)] [📧 Email Package] [🔗 Share Link]     │
│                                                                   │
│  Brand Validation                                                 │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ Last validated: Mar 2, 2026 3:08 PM                   │      │
│  │ Book Score: 9.2/10 ✅                                 │      │
│  │ Brief Score: 9.5/10 ✅                                │      │
│  │ [View Compliance Report] [Re-validate]                │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**PDF Preview** (embedded viewer):
```
┌─────────────────────────────────────────────────────────────────┐
│  costco-search-audit-book.pdf                  Page 1 of 47     │
├─────────────────────────────────────────────────────────────────┤
│  [Zoom: 100% ▼] [Fit to Width] [Fit to Height] [Download]      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │                                                        │      │
│  │         [Embedded PDF Viewer with Cover Page]         │      │
│  │                                                        │      │
│  │  COSTCO WHOLESALE CORPORATION                          │      │
│  │  Algolia Search Audit                                  │      │
│  │                                                        │      │
│  │  [Costco warehouse photo]                             │      │
│  │                                                        │      │
│  │  🟡 4.4/10 SCORE | $15M-$30M OPPORTUNITY              │      │
│  │                                                        │      │
│  │  [Algolia logo]          [Costco logo]                │      │
│  │                                                        │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  [◀ Prev] [▶ Next] [Jump to page: ___ Go]                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Tab 5: Settings

```
┌─────────────────────────────────────────────────────────────────┐
│  Costco Wholesale Audit                         ✅ COMPLETED    │
├─────────────────────────────────────────────────────────────────┤
│  [Overview] [Research Data] [Findings] [Deliverables] [Settings]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Audit Settings & Actions                                         │
│                                                                   │
│  Re-Run Phases                                                    │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ Selectively re-run phases with fresh data:            │      │
│  │                                                        │      │
│  │ ☐ Phase 1: Pre-Audit Research                         │      │
│  │ ☐ Phase 2: Browser Testing                            │      │
│  │ ☐ Phase 3: Scoring                                    │      │
│  │ ☐ Phase 4-5: Deliverables                             │      │
│  │                                                        │      │
│  │ [🔄 Re-Run Selected Phases]                            │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Quality Control                                                  │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ Run fact-check validation on deliverables:            │      │
│  │                                                        │      │
│  │ [🧪 Run Fact-Check] (~10 min, team mode)              │      │
│  │                                                        │      │
│  │ Last fact-check: Never                                 │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Export & Sharing                                                 │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ [📋 Copy Shareable Link]                               │      │
│  │ [📤 Export to Salesforce]                              │      │
│  │ [📧 Email to Team]                                     │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Template Management                                              │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ Save this audit's configuration as a template:        │      │
│  │                                                        │      │
│  │ Template Name: [General Retail Template ]             │      │
│  │ [⭐ Save as Template]                                  │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Danger Zone                                                      │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ ⚠️ These actions cannot be undone                     │      │
│  │                                                        │      │
│  │ [🗑️ Delete Audit]                                     │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5. Admin Dashboard

**Purpose**: System health, usage analytics, MCP server status, user management.

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin Dashboard                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Overview] [MCP Health] [Usage Stats] [User Management]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  System Health                                                    │
│                                                                   │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │ Total Audits │ Active Now   │ Avg Runtime  │ Success Rate │  │
│  │    247       │      3       │  34m 18s     │    94.3%     │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
│                                                                   │
│  MCP Server Status                                                │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ BuiltWith MCP           ✅ HEALTHY    Latency: 842ms  │      │
│  │   Last call: 2m ago     Credits: 2,134 / 5,000        │      │
│  │                                                        │      │
│  │ SimilarWeb MCP          ✅ HEALTHY    Latency: 1.2s   │      │
│  │   Last call: 5m ago     Credits: 847 / 10,000         │      │
│  │                                                        │      │
│  │ Chrome MCP (Browser)    🟡 DEGRADED   Pool: 7/10      │      │
│  │   3 instances stuck on CAPTCHA                         │      │
│  │   [View Details] [Restart Pool]                        │      │
│  │                                                        │      │
│  │ Yahoo Finance MCP       ✅ HEALTHY    Latency: 340ms  │      │
│  │   Last call: 12m ago    Rate: 8/10 req/sec            │      │
│  │                                                        │      │
│  │ WebSearch API           ✅ HEALTHY    Latency: 2.1s   │      │
│  │   Last call: 1m ago     Credits: 4,821 / 10,000       │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Usage by Team (Last 30 Days)                                    │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ [Bar Chart]                                            │      │
│  │ Sales:        124 audits ████████████████              │      │
│  │ Marketing:     78 audits ██████████                    │      │
│  │ CS:            32 audits ████                          │      │
│  │ Engineering:   13 audits ██                            │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                   │
│  Top Users                                                        │
│  | User            | Audits | Avg Score | Last Audit |          │
│  |-----------------|--------|-----------|------------|          │
│  | Alex Rivera     |   42   |   4.1     | 2 hours ago|          │
│  | Jordan Kim      |   38   |   3.8     | 5 mins ago |          │
│  | Taylor Chen     |   29   |   4.5     | Yesterday  |          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Technology Stack (Recommended)

#### Frontend
- **Framework**: React 18 + TypeScript
- **UI Library**: Material-UI (MUI) or Mantine UI (clean, modern)
- **State Management**: Zustand (lightweight) or Redux Toolkit
- **Real-Time**: Socket.IO client (WebSocket)
- **PDF Viewer**: react-pdf or PDF.js
- **Charts**: Recharts or Chart.js
- **Markdown**: react-markdown with syntax highlighting

#### Backend
- **Runtime**: Node.js 20 (TypeScript) OR Python 3.11 (FastAPI)
- **API Framework**: Express.js (Node) OR FastAPI (Python)
- **Job Queue**: BullMQ (Redis-backed)
- **WebSocket**: Socket.IO (Node) OR FastAPI WebSockets (Python)
- **Authentication**: Okta SDK OR Auth0
- **File Storage**: AWS S3 OR Google Cloud Storage
- **Browser Pool**: Playwright OR Puppeteer with pooling

#### Data Layer
- **Primary DB**: PostgreSQL 15 (audit metadata, users, permissions)
- **Cache/Queue**: Redis 7 (job queue, rate limiting, result cache)
- **Search**: PostgreSQL full-text OR Algolia (meta!)

#### MCP Integration
- **Strategy**: Wrap each MCP server with a REST API adapter
- **BuiltWith**: Direct HTTP API calls (no MCP needed)
- **SimilarWeb**: Direct HTTP API calls (no MCP needed)
- **Chrome**: Playwright browser pool (replaces Chrome MCP)
- **Yahoo Finance**: yfinance Python library OR Alpha Vantage API
- **WebSearch**: Perplexity API OR Tavily API

---

### Database Schema

```sql
-- Users table (Okta SSO synced)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okta_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  team VARCHAR(100), -- Sales, Marketing, CS, Engineering
  role VARCHAR(50) DEFAULT 'user', -- user, admin
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Audits table (main entity)
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  vertical VARCHAR(100),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL, -- pending, in_progress, completed, failed, cancelled
  phase VARCHAR(50), -- current phase: phase_1, phase_2, phase_3, phase_4_5
  progress_pct INT DEFAULT 0, -- 0-100
  overall_score DECIMAL(3,1), -- 0.0-10.0
  critical_gaps INT,
  opportunity_min BIGINT, -- in dollars
  opportunity_max BIGINT,
  error_message TEXT,
  config JSONB, -- audit configuration (phases, custom queries)
  metadata JSONB -- additional metadata
);

-- Scratchpad files (12 per audit)
CREATE TABLE scratchpad_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  file_name VARCHAR(100) NOT NULL, -- 01-company-context.md
  content TEXT NOT NULL,
  data_quality JSONB, -- {financial: 'FACT', employees: 'ESTIMATE'}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_id, file_name)
);

-- Screenshots (10-20 per audit)
CREATE TABLE screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL, -- 05-typo-orgnaic.png
  query VARCHAR(255), -- test query used
  severity VARCHAR(50), -- PASS, WARNING, CRITICAL
  storage_url TEXT NOT NULL, -- S3/GCS URL
  thumbnail_url TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_id, file_name)
);

-- Deliverables (3 per audit)
CREATE TABLE deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- book, ae_brief, signal_brief
  file_name VARCHAR(255) NOT NULL,
  storage_url TEXT NOT NULL, -- S3/GCS URL
  file_size_bytes BIGINT,
  page_count INT,
  brand_score DECIMAL(3,1), -- 0.0-10.0 from brand-check
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_id, type)
);

-- Execution logs (for debugging)
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  phase VARCHAR(50),
  step VARCHAR(255),
  level VARCHAR(20), -- info, warning, error
  message TEXT,
  metadata JSONB
);

-- MCP call logs (for analytics & caching)
CREATE TABLE mcp_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  server_name VARCHAR(100), -- builtwith, similarweb, chrome, yahoo_finance, websearch
  endpoint VARCHAR(255), -- domain-lookup, traffic-and-engagement, etc.
  request_params JSONB,
  response_data JSONB, -- cached response
  latency_ms INT,
  status VARCHAR(20), -- success, error
  error_message TEXT,
  called_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates (saved configs)
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES users(id),
  config JSONB NOT NULL, -- phases, queries, settings
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage analytics (aggregated daily)
CREATE TABLE usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  team VARCHAR(100),
  audits_created INT DEFAULT 0,
  audits_completed INT DEFAULT 0,
  audits_failed INT DEFAULT 0,
  avg_runtime_seconds INT,
  total_mcp_calls INT,
  UNIQUE(date, team)
);

-- Indexes
CREATE INDEX idx_audits_created_by ON audits(created_by);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX idx_scratchpad_audit_id ON scratchpad_files(audit_id);
CREATE INDEX idx_screenshots_audit_id ON screenshots(audit_id);
CREATE INDEX idx_deliverables_audit_id ON deliverables(audit_id);
CREATE INDEX idx_logs_audit_id ON execution_logs(audit_id);
CREATE INDEX idx_mcp_calls_audit_id ON mcp_calls(audit_id);
```

---

## API Design

### REST Endpoints

```typescript
// Authentication (via Okta SDK)
POST   /api/auth/login               // Redirect to Okta
GET    /api/auth/callback            // Okta callback
POST   /api/auth/logout              // Clear session
GET    /api/auth/me                  // Current user info

// Audits
GET    /api/audits                   // List audits (paginated, filterable)
POST   /api/audits                   // Create new audit
GET    /api/audits/:id               // Get audit details
PATCH  /api/audits/:id               // Update audit (pause, cancel)
DELETE /api/audits/:id               // Delete audit
POST   /api/audits/:id/rerun         // Re-run phases

// Scratchpad Files
GET    /api/audits/:id/scratchpad    // List all scratchpad files
GET    /api/audits/:id/scratchpad/:file  // Get specific scratchpad file

// Screenshots
GET    /api/audits/:id/screenshots   // List all screenshots
GET    /api/audits/:id/screenshots/:file // Get screenshot (proxy to S3)

// Deliverables
GET    /api/audits/:id/deliverables  // List all deliverables
GET    /api/audits/:id/deliverables/:type // Download deliverable (PDF, MD)
POST   /api/audits/:id/deliverables/:type/email // Email deliverable

// Fact-Check
POST   /api/audits/:id/fact-check    // Run fact-check validation

// Templates
GET    /api/templates                // List templates
POST   /api/templates                // Create template
DELETE /api/templates/:id            // Delete template

// Admin
GET    /api/admin/health             // MCP server health status
GET    /api/admin/usage              // Usage analytics
GET    /api/admin/users              // User management
```

### WebSocket Events (Real-Time Progress)

```typescript
// Client → Server
socket.emit('subscribe', { auditId: 'uuid' });  // Subscribe to audit updates
socket.emit('unsubscribe', { auditId: 'uuid' });

// Server → Client
socket.emit('audit:progress', {
  auditId: 'uuid',
  phase: 'phase_2',
  step: '15/20',
  progress_pct: 72,
  message: 'Testing dynamic facets...'
});

socket.emit('audit:phase_complete', {
  auditId: 'uuid',
  phase: 'phase_1',
  duration_seconds: 874
});

socket.emit('audit:complete', {
  auditId: 'uuid',
  overall_score: 4.4,
  deliverables: ['book', 'ae_brief', 'signal_brief']
});

socket.emit('audit:error', {
  auditId: 'uuid',
  phase: 'phase_2',
  error: 'Chrome browser pool exhausted'
});
```

---

## Implementation Modules

### Module 1: Audit Engine (State Machine)

**Responsibility**: Orchestrate the 5-phase audit process with state management.

```typescript
// audit-engine.ts
import { AuditState, AuditConfig } from './types';
import { Phase1Service } from './phases/phase1';
import { Phase2Service } from './phases/phase2';
import { Phase3Service } from './phases/phase3';
import { Phase45Service } from './phases/phase45';

export class AuditEngine {
  private state: AuditState;
  private config: AuditConfig;
  private statusCallback: (update: StatusUpdate) => void;

  constructor(config: AuditConfig, statusCallback: (update: StatusUpdate) => void) {
    this.config = config;
    this.statusCallback = statusCallback;
    this.state = { phase: 'pending', progress_pct: 0 };
  }

  async run() {
    try {
      // Phase 1: Pre-Audit Research
      if (this.config.phases.includes('phase_1')) {
        await this.runPhase1();
      }

      // Phase 2: Browser Testing
      if (this.config.phases.includes('phase_2')) {
        await this.runPhase2();
      }

      // Phase 3: Scoring
      if (this.config.phases.includes('phase_3')) {
        await this.runPhase3();
      }

      // Phase 4-5: Deliverables
      if (this.config.phases.includes('phase_4_5')) {
        await this.runPhase45();
      }

      this.statusCallback({ status: 'completed', progress_pct: 100 });
    } catch (error) {
      this.statusCallback({ status: 'failed', error: error.message });
      throw error;
    }
  }

  private async runPhase1() {
    this.state.phase = 'phase_1';
    this.statusCallback({ phase: 'phase_1', message: 'Starting research...' });

    const phase1 = new Phase1Service(this.config, this.statusCallback);
    const results = await phase1.execute();

    // Save scratchpad files to DB
    await this.saveScratchpadFiles(results);
  }

  private async runPhase2() {
    this.state.phase = 'phase_2';
    this.statusCallback({ phase: 'phase_2', message: 'Starting browser tests...' });

    const phase2 = new Phase2Service(this.config, this.statusCallback);
    const results = await phase2.execute();

    // Save screenshots to S3
    await this.saveScreenshots(results.screenshots);
  }

  // ... phase 3, 4, 5
}
```

### Module 2: MCP Proxy Service

**Responsibility**: Wrap MCP servers with REST APIs, handle retries, caching.

```typescript
// mcp-proxy.ts
import axios from 'axios';
import { RedisClient } from './redis';

export class MCPProxyService {
  private redis: RedisClient;

  constructor() {
    this.redis = new RedisClient();
  }

  async callBuiltWith(endpoint: string, params: any): Promise<any> {
    const cacheKey = `builtwith:${endpoint}:${JSON.stringify(params)}`;

    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Call BuiltWith API
    const response = await axios.post(`https://api.builtwith.com/${endpoint}`, params, {
      headers: { 'Authorization': `Bearer ${process.env.BUILTWITH_API_KEY}` }
    });

    // Cache for 24 hours
    await this.redis.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  }

  async callSimilarWeb(endpoint: string, params: any): Promise<any> {
    const cacheKey = `similarweb:${endpoint}:${JSON.stringify(params)}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await axios.get(`https://api.similarweb.com/v1/${endpoint}`, {
      params,
      headers: { 'Authorization': `Bearer ${process.env.SIMILARWEB_API_KEY}` }
    });

    await this.redis.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  }

  // Similar for Yahoo Finance, WebSearch, Chrome (Playwright)
}
```

### Module 3: Browser Pool Service

**Responsibility**: Manage Chrome instances, screenshot capture, WAF handling.

```typescript
// browser-pool.ts
import { chromium, Browser, Page } from 'playwright';

export class BrowserPoolService {
  private pool: Browser[] = [];
  private maxInstances = 10;

  async initialize() {
    // Launch 5 initial browsers
    for (let i = 0; i < 5; i++) {
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.pool.push(browser);
    }
  }

  async getPage(): Promise<Page> {
    if (this.pool.length === 0 && this.pool.length < this.maxInstances) {
      const browser = await chromium.launch({ headless: true });
      this.pool.push(browser);
    }

    const browser = this.pool[Math.floor(Math.random() * this.pool.length)];
    return await browser.newPage();
  }

  async captureScreenshot(page: Page, fileName: string): Promise<string> {
    const buffer = await page.screenshot({ fullPage: false });
    const s3Url = await this.uploadToS3(buffer, fileName);
    return s3Url;
  }

  async handleWAF(page: Page): Promise<boolean> {
    const title = await page.title();
    if (title.includes('Access Denied') || title.includes('Just a moment')) {
      // WAF detected - wait and retry
      await page.waitForTimeout(10000);
      return false; // retry needed
    }
    return true; // success
  }
}
```

### Module 4: Job Queue (BullMQ)

**Responsibility**: Manage long-running audit jobs, retry failed steps.

```typescript
// job-queue.ts
import { Queue, Worker } from 'bullmq';
import { AuditEngine } from './audit-engine';
import IORedis from 'ioredis';

const connection = new IORedis({ host: 'localhost', port: 6379 });

export const auditQueue = new Queue('audits', { connection });

export const auditWorker = new Worker('audits', async (job) => {
  const { auditId, config } = job.data;

  // Status callback broadcasts via WebSocket
  const statusCallback = (update) => {
    io.to(auditId).emit('audit:progress', { auditId, ...update });
  };

  const engine = new AuditEngine(config, statusCallback);
  await engine.run();

  return { auditId, status: 'completed' };
}, { connection });

// Add job to queue
export async function enqueueAudit(auditId: string, config: any) {
  await auditQueue.add('run-audit', { auditId, config }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 }
  });
}
```

---

## Technology Stack Summary

```yaml
Frontend:
  Framework: React 18 + TypeScript
  UI Library: Mantine UI
  State: Zustand
  Real-Time: Socket.IO client
  PDF Viewer: react-pdf
  Charts: Recharts
  Markdown: react-markdown

Backend:
  Runtime: Node.js 20 + TypeScript
  Framework: Express.js
  Auth: Okta SDK
  Job Queue: BullMQ (Redis)
  WebSocket: Socket.IO
  Browser: Playwright
  File Upload: multer + AWS SDK

Data:
  Primary DB: PostgreSQL 15
  Cache/Queue: Redis 7
  Object Storage: AWS S3

APIs:
  BuiltWith: Direct HTTP
  SimilarWeb: Direct HTTP
  Yahoo Finance: yfinance OR Alpha Vantage
  WebSearch: Perplexity OR Tavily
  Browser: Playwright (replaces Chrome MCP)

Infrastructure:
  Hosting: AWS (EC2 + RDS + S3) OR Vercel (Frontend) + Railway (Backend)
  CDN: CloudFlare
  Monitoring: Sentry (errors) + DataDog (metrics)
  CI/CD: GitHub Actions
```

---

## Implementation Roadmap

### Phase 1: MVP (8 weeks)
**Goal**: Core audit flow with manual MCP calls (no agent teams yet)

**Week 1-2: Infrastructure**
- [ ] Setup PostgreSQL + Redis
- [ ] Setup S3 bucket for assets
- [ ] Basic Express API with Okta auth
- [ ] React dashboard boilerplate

**Week 3-4: Phase 1 Research**
- [ ] MCP Proxy Service (BuiltWith, SimilarWeb, Yahoo Finance)
- [ ] Phase 1 orchestration (sequential, no agent teams)
- [ ] Scratchpad file storage
- [ ] Real-time progress WebSocket

**Week 5-6: Phase 2 Browser Testing**
- [ ] Playwright browser pool
- [ ] 20-step test suite
- [ ] Screenshot capture + S3 upload
- [ ] WAF handling

**Week 7: Phase 3 Scoring + Phase 4-5 Deliverables**
- [ ] Scoring engine
- [ ] PDF generation (HTML → Chrome headless)
- [ ] AE brief + signal brief generation

**Week 8: UI Polish**
- [ ] Dashboard list view
- [ ] Audit creation wizard
- [ ] Execution monitor
- [ ] Deliverable viewer

### Phase 2: Agent Teams (4 weeks)
**Goal**: Parallel execution with Wave 1-4 orchestration

**Week 9-10: Agent Teams Coordinator**
- [ ] Wave-based parallel execution
- [ ] Agent spawn + message passing
- [ ] Result aggregation

**Week 11-12: Optimization**
- [ ] MCP call caching
- [ ] Result deduplication
- [ ] Browser pool scaling

### Phase 3: Polish & Scale (4 weeks)
**Goal**: Production-ready with fact-check, templates, admin

**Week 13-14: Fact-Check Integration**
- [ ] Fact-check service (7 dimensions)
- [ ] Verification gates
- [ ] Correction manifest generation

**Week 15-16: Enterprise Features**
- [ ] Templates (saved configs)
- [ ] Admin dashboard
- [ ] Usage analytics
- [ ] Team permissions
- [ ] Salesforce integration

---

## Security & Access Control

### Authentication
- **SSO via Okta**: All users authenticate via Okta
- **JWT tokens**: API uses JWT tokens with 1-hour expiry
- **Role-based access**: `user` (read/write own audits) vs `admin` (read/write all)

### Authorization
```typescript
// Middleware
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findByOktaId(decoded.sub);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Ownership check
async function requireOwnership(req, res, next) {
  const audit = await Audit.findById(req.params.id);
  if (audit.created_by !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

### Data Isolation
- Users can only see their own audits + team audits (if same team)
- Admins can see all audits
- MCP API keys stored in environment variables (not DB)

---

## Cost & Scaling

### Cost Estimates (Monthly, 100 audits/month)

```
MCP API Calls:
- BuiltWith: 7 endpoints × 100 audits = 700 calls → $140 ($0.20/call)
- SimilarWeb: 14 endpoints × 100 audits = 1,400 calls → $700 ($0.50/call)
- Yahoo Finance: Free (yfinance library) → $0
- WebSearch (Perplexity): 200 queries × 100 audits = 20,000 queries → $200 ($0.01/query)

Infrastructure:
- AWS EC2 (t3.large): $70/month
- AWS RDS PostgreSQL (db.t3.medium): $50/month
- AWS S3 storage (50 GB): $1.15/month
- AWS S3 data transfer (100 GB): $9/month
- Redis (ElastiCache t3.micro): $15/month

Total: ~$1,185/month for 100 audits = $11.85/audit

At 1,000 audits/month: ~$11,000/month = $11/audit (economies of scale)
```

### Scaling Considerations

**Horizontal Scaling**:
- Worker nodes scale independently (BullMQ workers)
- Browser pool scales with Kubernetes (1 pod = 5 browsers)
- PostgreSQL read replicas for dashboard queries

**Caching Strategy**:
- MCP responses cached 24 hours (Redis)
- Screenshot thumbnails cached 7 days (CloudFront CDN)
- Deliverable PDFs cached 30 days (S3 + CloudFront)

**Rate Limiting**:
- Per user: 10 audits/day
- Per org: 100 audits/day
- MCP calls: Respect vendor rate limits (queue with exponential backoff)

---

## Success Metrics

**User Adoption**:
- Target: 80% of AEs run ≥1 audit per quarter
- Target: 50% of PMMs run ≥2 audits per month

**Quality**:
- Fact-check score ≥8.0/10 on 95% of audits
- Brand compliance score ≥9.0/10 on 95% of audits
- User satisfaction ≥4.5/5 (post-audit survey)

**Performance**:
- Average runtime ≤35 minutes (P50)
- Success rate ≥95% (no failures)
- MCP latency P95 ≤3 seconds

**Business Impact**:
- 40-hour manual audit → 35-minute automated = 98.5% time savings
- Cost per audit ≤$15 at scale
- 3x increase in audit volume (more prospects qualified)

---

## Next Steps

1. **Stakeholder Review** (1 week)
   - Share with Sales Ops, Marketing Ops, Engineering leadership
   - Gather feedback on UI mockups and feature prioritization

2. **Technical Spike** (2 weeks)
   - Prototype MCP Proxy Service (BuiltWith + SimilarWeb)
   - Prototype Playwright browser pool with screenshot capture
   - Validate PDF generation from HTML template

3. **MVP Development** (8 weeks)
   - Follow Phase 1 roadmap
   - Weekly demos to stakeholders
   - Beta testing with 5 AEs in Week 7-8

4. **Production Launch** (Week 16)
   - Internal launch to all Sales + Marketing
   - Documentation + training videos
   - Support channel (Slack #audit-platform-help)

---

**Document Version**: 1.0
**Last Updated**: 2026-03-02
**Author**: Claude Sonnet 4.5
**Status**: Architecture Design — Ready for Review
