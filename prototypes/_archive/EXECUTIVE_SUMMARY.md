# Algolia Search Audit Platform - Executive Summary

**Date**: 2026-03-02
**Prepared For**: Algolia Leadership & Engineering
**Status**: Architecture Complete — Ready for Stakeholder Review

---

## The Opportunity

The `/algolia-search-audit` Claude Code skill has proven incredibly effective at producing high-quality, comprehensive search audits. However, it's currently **limited to technical users** who have Claude Code installed and understand command-line interfaces.

**This platform democratizes that capability**, making it accessible to:
- Sales (AEs, SEs) → Qualify prospects faster with data-driven audits
- Marketing (PMM, ABM) → Create competitive intelligence at scale
- Customer Success → Proactive health checks for existing customers
- Executive Leadership → Strategic insights on market opportunities

**The Impact**: 40-hour manual audit → **35-minute automated execution** with **higher quality and consistency**.

---

## What We're Building

### Platform Overview

A self-service SaaS dashboard where any Algolia employee can:

1. **Enter a domain** (e.g., `costco.com`)
2. **Click "Launch Audit"** (optionally customize phases/queries)
3. **Monitor real-time progress** (5 phases, WebSocket-driven)
4. **Receive 3 production-ready deliverables**:
   - 📕 **PDF Book** (~40-50 pages, brand-validated)
   - 📄 **AE Pre-Call Brief** (internal intelligence)
   - 📊 **Strategic Signal Brief** (LLM-ready format)

### Key Features

**For End Users**:
- ✅ No technical knowledge required (wizard-driven)
- ✅ Real-time progress tracking (live logs, phase-by-phase status)
- ✅ Screenshot gallery (20 browser tests with evidence)
- ✅ 12 scratchpad files (all research data, downloadable)
- ✅ Fact-check validation (7-dimension quality gate)
- ✅ Template library (save configs for repeated use)

**For Admins**:
- ✅ MCP server health monitoring (BuiltWith, SimilarWeb, Chrome, Yahoo Finance, WebSearch)
- ✅ Usage analytics (audits per team, success rate, avg runtime)
- ✅ User management (teams, permissions, credits)

---

## Architecture at a Glance

```
┌─────────────┐      REST API        ┌──────────────┐
│   React     │ ←─────────────────→  │  Express.js  │
│  Dashboard  │      WebSocket       │  Backend     │
└─────────────┘                      └──────────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                       ▼                       ▼
            ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
            │  PostgreSQL    │      │  Redis (Queue) │      │  S3 (Assets)   │
            │ (audit data)   │      │  (BullMQ)      │      │ (screenshots)  │
            └────────────────┘      └────────────────┘      └────────────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                       ▼                       ▼
            ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
            │  BuiltWith MCP │      │ SimilarWeb MCP │      │  Chrome MCP    │
            │  (tech stack)  │      │  (traffic)     │      │  (browser)     │
            └────────────────┘      └────────────────┘      └────────────────┘
```

**Core Components**:
1. **Frontend** (React + TypeScript): Dashboard, wizard, execution monitor, deliverable viewer
2. **Backend** (Node.js + Express): API gateway, audit engine, job queue, WebSocket server
3. **MCP Proxies**: Wrap 5 MCP servers (BuiltWith, SimilarWeb, Chrome, Yahoo Finance, WebSearch)
4. **Browser Pool** (Playwright): Managed Chrome instances for testing
5. **Data Layer** (PostgreSQL + Redis + S3): Audit metadata, job queue, assets

---

## Screen Flow

### 1. Dashboard (Home)

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Algolia Search Audit Platform         [+ New Audit]     │
├─────────────────────────────────────────────────────────────┤
│  My Audits                                [Search: ____] 🔍 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Costco Wholesale              ✅ COMPLETED            │  │
│  │ Score: 4.4/10 | $15M-$30M Opportunity                │  │
│  │ [View Report] [Download All]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ The RealReal                  🟡 IN PROGRESS (60%)    │  │
│  │ Phase 2: Browser Testing (12/20 steps)                │  │
│  │ [View Live]                                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2. Create Audit (4-Step Wizard)

**Step 1**: Enter domain (`costco.com`)
**Step 2**: Select phases (Full Audit vs. modular)
**Step 3**: Custom queries (optional)
**Step 4**: Review & Launch → MCP health check → Click [🚀 Launch Audit]

### 3. Execution Monitor (Real-Time)

```
┌─────────────────────────────────────────────────────────────┐
│  Costco Wholesale Audit          🟡 Phase 2 In Progress     │
│  Elapsed: 18m 32s                                            │
├─────────────────────────────────────────────────────────────┤
│  Overall Progress                                            │
│  ████████████████████████████░░░░░░░░ 72% (36/50 steps)    │
│                                                              │
│  Phase 1: Pre-Audit Research    ✅ COMPLETED (15m 48s)     │
│  Phase 2: Browser Testing        🔵 IN PROGRESS (14/20)     │
│  Phase 3: Scoring                ⏳ PENDING                 │
│  Phase 4-5: Deliverables         ⏳ PENDING                 │
│                                                              │
│  Live Logs                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2:52 PM  [Browser] Typing query: "dynamic facets"   │   │
│  │ 2:52 PM  [Browser] Screenshot saved: 15-dynamic.png │   │
│  │ 2:51 PM  [Chrome] ✅ Network: no Constructor API    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4. Audit Details (5 Tabs)

**Tab 1: Overview** → KPIs, score gauge, quick summary
**Tab 2: Research Data** → 12 scratchpad files (company, tech, traffic, competitors, etc.)
**Tab 3: Findings** → Screenshot gallery (20 browser tests)
**Tab 4: Deliverables** → PDF book, AE brief, signal brief (preview + download)
**Tab 5: Settings** → Re-run phases, fact-check, export, delete

---

## Technical Specifications

### Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18 + TypeScript | Industry standard, mature ecosystem |
| | Mantine UI | Clean, modern component library |
| | Zustand | Lightweight state management |
| | Socket.IO | Real-time WebSocket updates |
| **Backend** | Node.js 20 + Express | Fast, scalable, TypeScript support |
| | BullMQ | Redis-backed job queue |
| | Playwright | Reliable browser automation |
| **Data** | PostgreSQL 15 | Relational data, JSONB support |
| | Redis 7 | Job queue + caching |
| | AWS S3 | Object storage (screenshots, PDFs) |
| **APIs** | BuiltWith API | Tech stack data |
| | SimilarWeb API | Traffic & engagement |
| | Yahoo Finance API | Financial data |
| | Perplexity API | Web search |

### Database Schema (Simplified)

```sql
-- Core tables
users (id, okta_id, email, name, team, role)
audits (id, domain, company_name, status, progress_pct, overall_score, config)
scratchpad_files (id, audit_id, file_name, content)
screenshots (id, audit_id, file_name, query, severity, storage_url)
deliverables (id, audit_id, type, storage_url, brand_score)
execution_logs (id, audit_id, timestamp, phase, message)
```

### API Endpoints (Simplified)

```
GET    /api/audits              # List audits (paginated, filterable)
POST   /api/audits              # Create new audit
GET    /api/audits/:id          # Get audit details
POST   /api/audits/:id/rerun    # Re-run phases
GET    /api/audits/:id/scratchpad/:file
GET    /api/audits/:id/screenshots/:file
GET    /api/audits/:id/deliverables/:type
POST   /api/audits/:id/fact-check

WebSocket Events:
- audit:progress         # Real-time progress updates
- audit:phase_complete   # Phase completion
- audit:complete         # Audit completion
- audit:error            # Error handling
```

---

## Cost & ROI

### Operating Costs (Monthly, 100 audits/month)

| Item | Cost | Notes |
|------|------|-------|
| **MCP APIs** | $1,040 | BuiltWith ($140), SimilarWeb ($700), Perplexity ($200) |
| **Infrastructure** | $145 | AWS EC2, RDS, S3, Redis |
| **Total** | **$1,185** | **$11.85/audit** |

At **1,000 audits/month**: ~$11,000/month = **$11/audit** (economies of scale)

### ROI Calculation

**Manual Process** (Current):
- 40 hours per audit (SE/AE time)
- $100/hour blended rate
- **$4,000 per audit** in labor

**Automated Process** (Platform):
- 35 minutes (zero human time after launch)
- $11.85 in API/infrastructure costs
- **$11.85 per audit**

**Savings**: **$3,988 per audit** (99.7% reduction)

**Break-even**: At **300 audits** (~3 months at 100/month scale), the platform pays for itself.

---

## Implementation Roadmap

### Phase 1: MVP (8 weeks)
**Goal**: Core audit flow with manual orchestration (no agent teams yet)

- **Week 1-2**: Infrastructure (DB, Redis, S3, Express API, React boilerplate)
- **Week 3-4**: Phase 1 Research (MCP proxies, scratchpad storage, WebSocket progress)
- **Week 5-6**: Phase 2 Browser Testing (Playwright pool, 20-step suite, screenshots)
- **Week 7**: Phase 3-5 (Scoring, deliverable generation, PDF rendering)
- **Week 8**: UI Polish (dashboard, wizard, execution monitor, deliverable viewer)

**Deliverable**: Working platform with sequential audit execution (no parallel agents)

### Phase 2: Agent Teams (4 weeks)
**Goal**: Parallel execution for 2x speed improvement

- **Week 9-10**: Agent Teams Coordinator (Wave 1-4 orchestration)
- **Week 11-12**: Optimization (MCP caching, browser pool scaling)

**Deliverable**: 35-minute runtime (down from 60+ minutes in MVP)

### Phase 3: Polish & Scale (4 weeks)
**Goal**: Production-ready with enterprise features

- **Week 13-14**: Fact-Check Integration (7-dimension validation)
- **Week 15-16**: Enterprise Features (templates, admin dashboard, Salesforce integration)

**Deliverable**: Production launch ready

**Total Timeline**: **16 weeks (4 months)** from kickoff to production

---

## Success Metrics

### User Adoption
- **Target**: 80% of AEs run ≥1 audit per quarter (within 6 months)
- **Target**: 50% of PMMs run ≥2 audits per month (within 6 months)

### Quality
- **Target**: Fact-check score ≥8.0/10 on 95% of audits
- **Target**: Brand compliance score ≥9.0/10 on 95% of audits
- **Target**: User satisfaction ≥4.5/5 (post-audit survey)

### Performance
- **Target**: Average runtime ≤35 minutes (P50)
- **Target**: Success rate ≥95% (no failures)
- **Target**: MCP latency P95 ≤3 seconds

### Business Impact
- **Target**: 3x increase in audit volume (more prospects qualified)
- **Target**: 40-hour manual audit → 35-minute automated = 98.5% time savings
- **Target**: Cost per audit ≤$15 at scale

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **MCP API Rate Limits** | Audits fail during high usage | Implement queue with exponential backoff, cache responses 24 hours |
| **Browser WAF Blocks** | Phase 2 screenshots incomplete | Real Chrome with user profiles, CAPTCHA user-handoff, retry logic |
| **PDF Generation Fails** | Book deliverable missing | Validate HTML locally first, fallback to simple markdown if Chrome headless fails |
| **WebSocket Disconnects** | Users miss progress updates | Persist progress to DB, replay on reconnect |
| **MCP Cost Overruns** | Budget exceeded | Credit monitoring per user, daily spend caps, alert at 80% threshold |

---

## Next Steps

### Week 1: Stakeholder Review (This Week)
- [ ] Share architecture docs with Sales Ops, Marketing Ops, Engineering Leadership
- [ ] Gather feedback on UI mockups and feature prioritization
- [ ] Align on budget approval ($1,185/month operating costs)

### Week 2: Technical Spike (Next Week)
- [ ] Prototype MCP Proxy Service (BuiltWith + SimilarWeb)
- [ ] Prototype Playwright browser pool with screenshot capture
- [ ] Validate PDF generation from HTML template
- [ ] Confirm Okta SSO integration approach

### Week 3-4: Finalize Spec & Kickoff (Weeks 3-4)
- [ ] Incorporate stakeholder feedback
- [ ] Finalize database schema and API contracts
- [ ] Assign engineering team (2 backend, 1 frontend, 1 DevOps)
- [ ] Setup GitHub repo, CI/CD, development environment

### Week 5: Sprint 1 Kickoff (Week 5)
- [ ] Begin Phase 1 MVP development (8-week sprint)
- [ ] Weekly demos to stakeholders
- [ ] Beta testing with 5 AEs in Week 12

---

## Appendix: Documentation Files

This executive summary is part of a 4-document package:

1. **EXECUTIVE_SUMMARY.md** (this file) — High-level overview for leadership
2. **SAAS_ARCHITECTURE.md** — Detailed system architecture, database schema, API design, cost estimates
3. **SCREEN_MOCKUPS.md** — UI/UX designs, user flows, component library, interaction patterns
4. **IMPLEMENTATION_GUIDE.md** — Engineering specification with code examples, testing strategy, deployment

**Location**: `/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/Algolia Search Audit/`

---

## Contact

For questions or to discuss this proposal:

- **Architecture Design**: Claude Sonnet 4.5 (via Jordan Kim)
- **Business Owner**: [Your Name], [Your Title]
- **Engineering Lead**: [TBD]
- **Product Manager**: [TBD]

---

**Document Version**: 1.0
**Last Updated**: 2026-03-02
**Status**: Ready for Stakeholder Review
**Next Review Date**: 2026-03-09 (1 week)
