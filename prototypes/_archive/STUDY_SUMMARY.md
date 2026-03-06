# Dashboard Builder - Study Summary & Next Steps

**Date**: March 6, 2026
**Prepared By**: Dashboard Builder Agent
**Status**: Research Complete, Ready for Implementation Planning

---

## Executive Summary

The **Algolia Search Audit Dashboard** is a SaaS platform that automates the entire search audit workflow - transforming the manual CLI-based `/algolia-search-audit` skill into a self-service web application.

**Key Transformation**:
- **Current**: CLI tool requiring technical expertise (5 users, 10-15 audits/year, 40 hours each)
- **Target**: Self-service SaaS platform (200+ users, 500+ audits/year, 35 minutes each)
- **Impact**: 33x more audits, 98% time reduction, 99% cost savings

---

## Project Architecture

### 1. Core Concept: Time-Series Snapshots

The database architecture (v5) treats **companies as the main entity** and **audits as point-in-time snapshots**:

```
Company: Costco (lightweight entity)
  ├─ Audit #1 (June 2025)      ← Snapshot at T1
  │   ├─ Traffic: 2.5M visits
  │   ├─ Revenue: $254B
  │   └─ Hiring: 12 roles
  │
  ├─ Audit #2 (Dec 2025)       ← Snapshot at T2
  │   ├─ Traffic: 3.1M (+24%)
  │   ├─ Revenue: $268B (+5.5%)
  │   └─ Hiring: 28 roles (+133%)
  │
  └─ Audit #3 (June 2026)      ← Snapshot at T3
      ├─ Traffic: 3.3M (+6.5%)
      ├─ Revenue: $275B (+2.6%)
      └─ Hiring: 8 roles (-71% 🚨 RED FLAG!)
```

**Benefit**: Track changes over time, identify buying signals (hiring spike = expansion signal)

---

### 2. Database Schema (v5 - Time-Series)

#### Core Tables
1. **`companies`** (lightweight) - Just name + domain + industry
2. **`audits`** (heavy) - Full snapshot with all research data
3. **`industries`** (existing) - 30 industries from algolia-arian project (REUSE)

#### Audit Data Structure
```sql
CREATE TABLE audits (
  id UUID PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  status VARCHAR(20),  -- pending, running, completed, failed, factchecking

  -- Phase 1 Research Data (JSONB columns)
  traffic_data JSONB,              -- SimilarWeb metrics
  tech_stack JSONB,                -- BuiltWith + Chrome detection
  financial_data JSONB,            -- Yahoo Finance 3-year history
  competitor_data JSONB,           -- Search competitors
  hiring_signals JSONB,            -- Job postings analysis
  executive_data JSONB,            -- C-suite profiles
  investor_intelligence JSONB,     -- Quotes from earnings/10-K

  -- 🔴 NEW: Mandatory source citations
  source_citations JSONB,          -- Every claim hyperlinked to source
  data_freshness JSONB,            -- Track staleness (12-month rule)

  -- Phase 2 Browser Testing
  browser_test_results JSONB,      -- 20 test steps with screenshots

  -- Phase 3 Scoring
  audit_score JSONB,               -- 10 scoring dimensions

  -- Phase 5 Deliverables
  report_url TEXT,                 -- Markdown report
  landing_page_url TEXT,           -- HTML landing page
  deck_url TEXT,                   -- Slide deck

  -- 🔴 NEW: Fact-check validation
  factcheck_score DECIMAL(4,2),   -- 0.00-10.00 confidence
  factcheck_report_url TEXT,       -- Validation report
  factcheck_corrections JSONB,     -- Fixes needed

  -- Metadata
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);
```

---

### 3. Reuse Strategy (70% from algolia-arian)

#### ✅ What We Reuse
| Component | Source | Savings |
|-----------|--------|---------|
| **Enrichment Services** | `frontend/src/services/enrichment.ts` | 3 weeks |
| **Database Pattern** | Supabase JSONB columns | 1 week |
| **API Clients** | SimilarWeb, BuiltWith, Yahoo Finance | 2 weeks |
| **Frontend Stack** | React + TypeScript + Mantine UI | 1 week |
| **Industry Taxonomy** | 30 industries already in DB | 3 days |
| **Scoring Logic** | ICP scoring patterns | 1 week |

**Total Savings**: 8.5 weeks → **47% time reduction**

#### 🔨 What We Build (30% new)
1. **Job Queue System** (BullMQ + Redis) - Handle 5 concurrent audits
2. **Browser Testing Module** - Chrome MCP integration for 20 test steps
3. **Audit Orchestrator** - 5-phase state machine with verification gates
4. **PDF Generator** - HTML → PDF (book, brief, signals)
5. **WebSocket Server** - Real-time progress updates
6. **Fact-Check Service** - 7-dimension validation (NEW requirement)

---

## User Personas (4 types)

### 1. Marketing Manager (Primary) - "Sarah Chen"
**Goal**: Generate polished audit PDFs for ABM campaigns without CLI knowledge
**Key Need**: 2-click audit start, email PDF when done, brand compliance guaranteed

### 2. Account Executive (Secondary) - "Marcus Thompson"
**Goal**: Quick pre-call research, customize test queries, AE brief format
**Key Need**: Phase 1 only (10 min), edit test queries, re-run phases when needed

### 3. Partner Marketing (Advanced) - "Priya Desai"
**Goal**: Batch process 10+ prospects, aggregate insights, displacement opportunities
**Key Need**: CSV upload, overnight batch, competitor matrix export

### 4. Sales Engineer (Power User) - "Jordan Lee"
**Goal**: Deep competitive intel, customize scoring, debug failures
**Key Need**: Pause/edit/resume, execution logs, override scoring weights

---

## Core Features (What the Dashboard Does)

### F1: Audit Lifecycle Management
1. **Create New Audit** (4-step wizard)
   - Step 1: Enter domain
   - Step 2: Select phases (Full / Research Only / Browser Only)
   - Step 3: Custom test queries (optional)
   - Step 4: Review & launch

2. **Real-Time Execution Monitor**
   - Phase progress bars (e.g., "Phase 1: 67% - 8/12 steps")
   - Live log streaming
   - Screenshot gallery as tests complete
   - ETA updates

3. **Audit Details View** (5 tabs)
   - Tab 1: Overview (score, gaps, opportunity size)
   - Tab 2: Research Data (10 research modules)
   - Tab 3: Browser Tests (20 findings with screenshots)
   - Tab 4: Deliverables (PDF viewer + downloads)
   - Tab 5: Settings (re-run phases, fact-check, edit)

### F2: Dashboard & Library
- **Dashboard**: Recent audits, status filters, search
- **Library**: All audits with advanced filters (status, team, date, score)
- **Batch Mode**: CSV upload for 10+ domains

### F3: Quality Control 🔴 NEW
1. **Source Citation Mandate**
   - Every data point → hyperlinked source
   - Display format: "100.9M visits ([source](url))"
   - Validation: fact-check verifies all links work

2. **Fact-Check Service** (3 tiers)
   - **Full** (40 min): Re-call all APIs, WebFetch all sources, verify quotes
   - **Standard** (15 min): Re-call APIs + WebFetch sources
   - **Quick** (5 min): Read-only consistency checks

3. **Data Freshness Tracking**
   - 12-month rule: Traffic/tech/hiring ≤12 months old
   - Exception: Financial data (3-year history allowed)
   - UI warning: ⚠️ "Data may be outdated" if stale

---

## Deliverables (3 files per audit)

1. **PDF Book** (30-50 pages, Algolia-branded)
   - Cover with company photo + logo
   - Executive summary
   - Strategic intelligence
   - "In Their Own Words" (executive quotes)
   - Findings with screenshots
   - Opportunities with ROI estimates

2. **AE Pre-Call Brief** (5 pages)
   - "Speaking Their Language" (ICP mapping)
   - Tech stack snapshot
   - Top 3 gaps
   - Talking points

3. **Strategic Signal Brief** (1 page)
   - Downstream LLM consumption format
   - Dense signals (not narrative)
   - Standalone lines with full context

---

## Current State of Research

### ✅ Completed
1. **PRD** (`PRD_CONSOLIDATED.md`) - 1,700 lines, complete product spec
2. **Database Schema v5** (`DATABASE_SCHEMA_V5_TIMESERIES.md`) - Time-series architecture
3. **Screen Mockups** (`SCREEN_MOCKUPS.md`) - 12 screens with ASCII wireframes
4. **Interactive Prototype** (`index-v2.html`) - 10 clickable screens with real Algolia branding
5. **Implementation Plan** (`IMPLEMENTATION_PLAN.md`) - 8-week roadmap
6. **Architecture Diagrams** (`architecture-diagram.md`) - System design, data flow, deployment
7. **UX Flow Diagrams** (`ux-flow-diagrams.md`) - User journeys, navigation maps
8. **Feature Inventory** (`FEATURE_INVENTORY.md`) - All features mapped to storage
9. **Documentation Update** (`UPDATE_SUMMARY.md`) - Migration from scratchpad to normalized DB

### 📊 Documentation Maturity
- **PRD**: 95% complete (open questions remain)
- **Database Schema**: 90% complete (need indexes + RLS policies)
- **UI Mockups**: 80% complete (ASCII wireframes, needs Figma)
- **Implementation Plan**: 85% complete (need resource allocation)
- **API Specification**: 70% complete (endpoints defined, need full OpenAPI spec)

---

## Critical Decisions Already Made

### 1. ✅ Architecture: Time-Series Snapshots
- Companies are lightweight entities
- Audits are heavy point-in-time snapshots
- Enables version comparison and trend analysis

### 2. ✅ Database: Reuse algolia-arian Supabase Schema
- Don't recreate enrichment JSONB columns
- Add new `audits` table alongside `companies`
- Reuse 30 industries taxonomy

### 3. ✅ Frontend Stack: React + Mantine UI
- Same stack as algolia-arian (reuse components)
- Mantine for UI library (modern, accessible)
- TypeScript for type safety

### 4. ✅ Backend: Node.js + BullMQ + Redis
- Job queue for concurrent audits
- Worker processes for long-running tasks
- WebSocket for real-time updates

### 5. 🔴 NEW: Source Citation + Fact-Check Mandatory
- Every data point must have inline source link
- Fact-check service validates all claims
- Data freshness tracking (12-month rule)

---

## What Needs to Be Done Next

### Immediate (Study/Planning Phase - Current)
1. ✅ Study all research documents (COMPLETE)
2. ⏭️ **Review interactive prototype** (`index-v2.html`) in browser
3. ⏭️ **Identify implementation gaps** (what's missing from research?)
4. ⏭️ **Create detailed build plan** (sprint breakdown, task list)
5. ⏭️ **Finalize database indexes** (performance optimization)
6. ⏭️ **Design API specification** (full OpenAPI schema)

### Short-Term (Weeks 1-2)
1. Set up project structure (copy from algolia-arian)
2. Create `audits` table migration
3. Build job queue system (BullMQ setup)
4. Implement Phase 1 orchestrator (research agent waves)
5. Add source citation tracking to enrichment services

### Medium-Term (Weeks 3-6)
1. Build browser testing module (Chrome MCP)
2. Implement audit execution monitor (WebSocket)
3. Build frontend Dashboard and Library pages
4. Create PDF generator (HTML → PDF book)
5. Implement fact-check service (7 dimensions)

### Long-Term (Weeks 7-8)
1. Build deliverables generator (3 file types)
2. Add batch mode (CSV upload)
3. Implement re-run phases capability
4. Create admin dashboard (system health)
5. User testing and iteration

---

## Open Questions (From PRD)

### Technical
1. **MCP Connection Pooling**: How many concurrent MCP connections can we sustain? (5? 10?)
2. **Screenshot Storage**: S3 vs Vercel Blob? (Cost vs latency trade-off)
3. **PDF Generation**: Puppeteer vs Playwright vs Chrome MCP? (Performance benchmarking needed)
4. **Job Retry Strategy**: Exponential backoff for MCP failures? (Define retry limits)

### Product
1. **User Access Control**: Who can see all audits vs team-only? (RBAC design)
2. **Batch Mode Priority**: FIFO vs priority queue? (Do VIP users get faster processing?)
3. **Fact-Check Tier Default**: Auto-run "Standard" tier on every audit? (Or user-triggered only?)
4. **Data Freshness Alerts**: Email user if data is >12 months old before starting audit? (Proactive vs reactive)

### Business
1. **Pricing Model**: Per-audit credits? Unlimited for certain tiers? (Determine cost structure)
2. **External Sharing**: Can users share PDF links externally? (Security implications)
3. **SLA Guarantees**: Promise 35-minute completion or show ETA? (Manage expectations)

---

## Next Action: Review Interactive Prototype

**File**: `dashboard/index-v2.html`

**How to view**:
```bash
open "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/algolia-arian/dashboard/index-v2.html"
```

**What to look for**:
1. 10 fully-styled screens with real Algolia branding
2. Navigation between Dashboard → Library → Documentation → Settings
3. Audit creation wizard (4 steps)
4. Execution monitor with live progress
5. Audit details view with 5 tabs
6. Deliverables section with PDF viewer

**After review**: Document any UI/UX gaps, missing interactions, or design inconsistencies.

---

## Summary

The Algolia Search Audit Dashboard has **comprehensive research and planning documentation**:
- ✅ Clear product vision and business case (33x more audits, 98% time savings)
- ✅ Detailed user personas (4 types) with JTBD
- ✅ Complete database architecture (v5 time-series)
- ✅ Interactive prototype with 10 screens
- ✅ 8-week implementation roadmap with 47% time savings from reuse
- 🔴 NEW critical requirements (source citations + fact-check)

**Status**: Research phase is COMPLETE. Ready to transition to **detailed implementation planning** after prototype review.

**Recommended Next Step**: Review the interactive prototype (`index-v2.html`) to identify any missing features or UX gaps before starting implementation.

---

**Last Updated**: March 6, 2026
