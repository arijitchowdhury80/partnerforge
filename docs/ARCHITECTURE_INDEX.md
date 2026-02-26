# PartnerForge Architecture Documentation Index

**Version:** 2.0
**Last Updated:** 2026-02-25
**Status:** Canonical Reference
**Documents:** 23 architecture docs (~22,600 lines)

---

## Quick Navigation

| Need to understand... | Read this document |
|----------------------|-------------------|
| Overall system design | [ENTERPRISE-ARCHITECTURE.md](./ENTERPRISE-ARCHITECTURE.md) |
| 15 intelligence modules | [INTELLIGENCE_MODULES_SPEC.md](./INTELLIGENCE_MODULES_SPEC.md) |
| Database tables & schema | [DATABASE_SCHEMA_V2.md](./DATABASE_SCHEMA_V2.md) |
| Parallel execution model | [PARALLEL_EXECUTION_ARCHITECTURE.md](./PARALLEL_EXECUTION_ARCHITECTURE.md) |
| Source citation rules | [SOURCE_CITATION_MANDATE.md](./SOURCE_CITATION_MANDATE.md) |
| Orchestrator design | [ORCHESTRATOR_DESIGN.md](./ORCHESTRATOR_DESIGN.md) |
| Data pipeline flows | [DATA-PIPELINE-FLOWS.md](./DATA-PIPELINE-FLOWS.md) |
| UI/UX library choices | [UI-UX-LIBRARY-RESEARCH.md](./UI-UX-LIBRARY-RESEARCH.md) |
| **Premium UI specification** | [PREMIUM-UI-SPECIFICATION.md](./PREMIUM-UI-SPECIFICATION.md) |
| Design principles | [DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md) |
| Module taxonomy | [INTELLIGENCE-MODULE-TAXONOMY.md](./INTELLIGENCE-MODULE-TAXONOMY.md) |
| Data model patterns | [INTELLIGENCE_DATA_MODEL.md](./INTELLIGENCE_DATA_MODEL.md) |
| **Blind spots & extensibility** | [ARCHITECTURE_STRESS_TEST.md](./ARCHITECTURE_STRESS_TEST.md) |
| **Temporal data & change detection** | [CHANGE_DETECTION_ARCHITECTURE.md](./CHANGE_DETECTION_ARCHITECTURE.md) |
| **Multi-tenancy & RBAC** | [MULTI_TENANCY_RBAC.md](./MULTI_TENANCY_RBAC.md) |
| **API cost tracking & budgets** | [API_COST_TRACKING.md](./API_COST_TRACKING.md) |
| **Observability & metrics** | [OBSERVABILITY_METRICS.md](./OBSERVABILITY_METRICS.md) |
| **Testing & self-correction** | [TESTING_ARCHITECTURE.md](./TESTING_ARCHITECTURE.md) |
| **CSV upload & list import** | [CSV_UPLOAD_ARCHITECTURE.md](./CSV_UPLOAD_ARCHITECTURE.md) |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PARTNERFORGE PLATFORM                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         PRESENTATION LAYER                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │   React +   │  │   Mantine   │  │   Tremor    │  │    Magic UI     │ │ │
│  │  │   Vite +    │  │ Components  │  │   Charts    │  │   Animations    │ │ │
│  │  │ TypeScript  │  │   & Forms   │  │   & KPIs    │  │   & Polish      │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                           API LAYER (FastAPI)                            │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │ │
│  │  │  Company API     │  │  Intelligence    │  │   Jobs & Enrichment    │ │ │
│  │  │  /api/companies  │  │  /api/intel/*    │  │   /api/enrich/*        │ │ │
│  │  └──────────────────┘  └──────────────────┘  └────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      ORCHESTRATION LAYER (Celery)                        │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │ │
│  │  │  Wave 1    │  │  Wave 2    │  │  Wave 3    │  │     Wave 4         │ │ │
│  │  │ Foundation │  │ Compet.    │  │ Buying     │  │    Synthesis       │ │ │
│  │  │ M01-M04    │  │ M05-M07    │  │ M08-M11    │  │    M12-M15         │ │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    INTELLIGENCE MODULES (15 total)                       │ │
│  │                                                                          │ │
│  │  WAVE 1 - Foundation (Parallel)                                          │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────────┐│ │
│  │  │ M01        │ │ M02        │ │ M03        │ │ M04                    ││ │
│  │  │ Company    │ │ Tech       │ │ Traffic    │ │ Financial              ││ │
│  │  │ Context    │ │ Stack      │ │ Analysis   │ │ Profile                ││ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────────────────┘│ │
│  │                                                                          │ │
│  │  WAVE 2 - Competitive (Depends on W1)                                    │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────────────────────────┐│ │
│  │  │ M05        │ │ M06        │ │ M07                                    ││ │
│  │  │ Competitor │ │ Hiring     │ │ Strategic Context                      ││ │
│  │  │ Intel      │ │ Signals    │ │                                        ││ │
│  │  └────────────┘ └────────────┘ └────────────────────────────────────────┘│ │
│  │                                                                          │ │
│  │  WAVE 3 - Buying Signals (Depends on W2)                                 │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────────┐│ │
│  │  │ M08        │ │ M09        │ │ M10        │ │ M11                    ││ │
│  │  │ Investor   │ │ Executive  │ │ Buying     │ │ Displacement           ││ │
│  │  │ Intel      │ │ Intel      │ │ Committee  │ │ Analysis               ││ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────────────────┘│ │
│  │                                                                          │ │
│  │  WAVE 4 - Synthesis (Depends on W3)                                      │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────────┐│ │
│  │  │ M12        │ │ M13        │ │ M14        │ │ M15                    ││ │
│  │  │ Case Study │ │ ICP-       │ │ Signal     │ │ Strategic Signal       ││ │
│  │  │ Matching   │ │ Priority   │ │ Scoring    │ │ Brief                  ││ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                       DATA COLLECTION LAYER                              │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐│ │
│  │  │ BuiltWith  │ │ SimilarWeb │ │ Yahoo      │ │ SEC        │ │ Web    ││ │
│  │  │ MCP        │ │ MCP        │ │ Finance    │ │ EDGAR      │ │ Search ││ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────┘│ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      PERSISTENCE LAYER (PostgreSQL)                      │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐│ │
│  │  │ core_*     │ │ intel_*    │ │ jobs_*     │ │ users_*    │ │ audit_*││ │
│  │  │ Companies  │ │ Modules    │ │ Queue      │ │ Accounts   │ │ Logs   ││ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────┘│ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Document Details

### Core Architecture

| Document | Lines | Description |
|----------|-------|-------------|
| **ENTERPRISE-ARCHITECTURE.md** | ~1,340 | Master architecture document. System design, module boundaries, API contracts, deployment model. |
| **INTELLIGENCE_MODULES_SPEC.md** | ~1,100 | Complete specification for all 15 modules. JSON schemas, data sources, validation rules. |
| **DATABASE_SCHEMA_V2.md** | ~850 | PostgreSQL schema. 30+ tables across 5 namespaces. Includes migration scripts. |

### Execution & Orchestration

| Document | Lines | Description |
|----------|-------|-------------|
| **PARALLEL_EXECUTION_ARCHITECTURE.md** | ~900 | Wave-based parallel execution. Celery workers, Redis queues, circuit breakers. |
| **ORCHESTRATOR_DESIGN.md** | ~750 | Hybrid orchestrator (Human + System). State machine, job lifecycle, error handling. |
| **DATA-PIPELINE-FLOWS.md** | ~800 | Data flow diagrams. Module dependencies, cache invalidation, event propagation. |

### Design Principles

| Document | Lines | Description |
|----------|-------|-------------|
| **SOURCE_CITATION_MANDATE.md** | ~550 | HARD REQUIREMENT. Every data point needs source_url. 12-month freshness. Database enforcement. |
| **DESIGN_PRINCIPLES.md** | ~200 | Core design tenets. Module independence, plugin architecture, event-driven updates. |

### Enterprise Systems (P1 - Critical)

| Document | Lines | Description |
|----------|-------|-------------|
| **CHANGE_DETECTION_ARCHITECTURE.md** | ~1,400 | Temporal data versioning. Snapshot-based diff system. "Costco today vs 3 months ago" comparisons. Notification triggers for executive moves, search provider changes. |
| **MULTI_TENANCY_RBAC.md** | ~650 | Multi-tenant architecture with Row-Level Security. Role hierarchy (Admin, Manager, AE, SDR, Viewer). Territory management and account assignments. |
| **API_COST_TRACKING.md** | ~700 | Real-time cost tracking per API call. Budget alerts, hard limits, cache optimization. Cost allocation for enterprise billing. |
| **OBSERVABILITY_METRICS.md** | ~900 | Full observability stack (Prometheus + Grafana + Loki). 50+ metrics, alerting rules, runbook. SLOs and error budgets. |

### Frontend & UX

| Document | Lines | Description |
|----------|-------|-------------|
| **PREMIUM-UI-SPECIFICATION.md** | ~1,200 | Championship-level UI spec. Aceternity UI + Nivo + ECharts + Motion. Glassmorphism design system. Component code examples. |
| **UI-UX-LIBRARY-RESEARCH.md** | ~400 | UI library evaluation. 50+ libraries analyzed. Selection criteria and trade-offs. |

### Reference Materials

| Document | Lines | Description |
|----------|-------|-------------|
| **INTELLIGENCE-MODULE-TAXONOMY.md** | ~450 | Module categorization. 5-tier taxonomy, data source mapping. |
| **INTELLIGENCE_DATA_MODEL.md** | ~600 | Data model patterns. Executive quotes, ROI formulas, margin zones. |

### Testing & Quality (P0 - Foundational)

| Document | Lines | Description |
|----------|-------|-------------|
| **TESTING_ARCHITECTURE.md** | ~1,800 | **FOUNDATIONAL METHODOLOGY.** Test pyramid, self-correction, iterative improvement. Every module must have parallel tests. 80%+ coverage required. |

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
```
1. Set up PostgreSQL database with all schemas
2. Create FastAPI backend skeleton
3. Implement M01-M04 (Wave 1 modules)
4. Set up Celery + Redis for parallel execution
5. Create React + Vite + TypeScript scaffold
```

### Phase 2: Core Intelligence (Week 3-4)
```
1. Implement M05-M07 (Wave 2 modules)
2. Build dashboard data table (Mantine DataTable)
3. Create company detail view with tabs
4. Implement real-time enrichment progress
```

### Phase 3: Buying Signals (Week 5-6)
```
1. Implement M08-M11 (Wave 3 modules)
2. Build executive quotes component
3. Create hiring signals view
4. Implement investor intelligence display
```

### Phase 4: Synthesis & Polish (Week 7-8)
```
1. Implement M12-M15 (Wave 4 modules)
2. Build signal scoring dashboard
3. Create strategic brief generator
4. Add Magic UI animations and polish
5. Dark mode and accessibility
```

### Phase 5: Future Integrations (Week 9+)
```
1. ZoomInfo integration module
2. Crossbeam partner overlap
3. Demandbase intent signals
4. CRM export (Salesforce)
5. Slack/Teams alerts
```

---

## Key Design Decisions

### 1. Source Citation Mandate (P0)
**Decision:** Every data point MUST have a source URL no older than 12 months.
**Rationale:** Enterprise sales requires trusted, verifiable data.
**Enforcement:** Database NOT NULL constraints + validation layer + UI rendering.

### 2. Wave-Based Parallel Execution
**Decision:** 4 waves of parallel module execution (not sequential).
**Rationale:** 3-5x speedup (60s vs 180-300s sequential).
**Implementation:** Celery groups with dependency chains.

### 3. Premium UI Stack (Mantine + Tremor + Magic UI)
**Decision:** Use Mantine for core components, Tremor for charts, Magic UI for animations.
**Rationale:** All MIT/Apache licensed, Tailwind-compatible, TypeScript-first.
**Cost:** $0-$199 (vs $999+ for AG Grid Enterprise or MUI X Pro).

### 4. PostgreSQL with Namespaced Tables
**Decision:** Single PostgreSQL database with prefixed tables (core_, intel_, jobs_, users_, audit_).
**Rationale:** Simpler ops than microservice databases, still provides logical separation.
**Schema:** 30+ tables, 15 intel_* tables (one per module).

### 5. Hybrid Orchestration Model
**Decision:** Human triggers strategic decisions, System orchestrates tactical execution.
**Rationale:** Full automation risks errors; full manual is slow. Hybrid balances both.
**Implementation:** Human initiates enrichment, system handles all module coordination.

---

## File Structure (Proposed)

```
partnerforge/
├── docs/                           # Architecture documentation
│   ├── ARCHITECTURE_INDEX.md       # This file - navigation hub
│   ├── ENTERPRISE-ARCHITECTURE.md  # Master architecture
│   ├── INTELLIGENCE_MODULES_SPEC.md
│   ├── DATABASE_SCHEMA_V2.md
│   ├── PARALLEL_EXECUTION_ARCHITECTURE.md
│   ├── ORCHESTRATOR_DESIGN.md
│   ├── DATA-PIPELINE-FLOWS.md
│   ├── SOURCE_CITATION_MANDATE.md
│   ├── DESIGN_PRINCIPLES.md
│   └── UI-UX-LIBRARY-RESEARCH.md
│
├── backend/                        # FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app
│   │   ├── config.py               # Settings
│   │   ├── database.py             # PostgreSQL connection
│   │   ├── api/
│   │   │   ├── companies.py        # /api/companies
│   │   │   ├── intelligence.py     # /api/intel/*
│   │   │   └── enrichment.py       # /api/enrich/*
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── core.py             # core_* tables
│   │   │   ├── intel.py            # intel_* tables
│   │   │   └── jobs.py             # jobs_* tables
│   │   ├── modules/                # Intelligence modules
│   │   │   ├── base.py             # BaseModule class
│   │   │   ├── m01_company_context.py
│   │   │   ├── m02_tech_stack.py
│   │   │   ├── ...
│   │   │   └── m15_strategic_brief.py
│   │   ├── services/               # Business logic
│   │   │   ├── orchestrator.py     # Wave orchestration
│   │   │   ├── enrichment.py       # Enrichment service
│   │   │   └── validation.py       # Source validation
│   │   └── workers/                # Celery tasks
│   │       ├── celery_app.py
│   │       └── tasks.py
│   ├── migrations/                 # Alembic migrations
│   ├── tests/
│   └── requirements.txt
│
├── frontend/                       # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── TargetTable.tsx
│   │   │   │   ├── StatsCards.tsx
│   │   │   │   └── FilterBar.tsx
│   │   │   ├── company/
│   │   │   │   ├── CompanyView.tsx
│   │   │   │   ├── IntelligenceTabs.tsx
│   │   │   │   ├── FinancialChart.tsx
│   │   │   │   └── QuoteCard.tsx
│   │   │   └── common/
│   │   │       ├── SourceBadge.tsx
│   │   │       └── EnrichmentProgress.tsx
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── data/                           # Local data (SQLite legacy)
│   └── partnerforge.db
│
├── scripts/                        # Utility scripts
│
└── docker-compose.yml              # Local dev environment
```

---

## API Endpoints (Summary)

### Companies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies` | List companies (paginated, filterable) |
| GET | `/api/companies/{domain}` | Get company by domain |
| POST | `/api/companies` | Create company record |
| PUT | `/api/companies/{domain}` | Update company |

### Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/intel/{domain}/overview` | All modules summary |
| GET | `/api/intel/{domain}/m01` | Company context |
| GET | `/api/intel/{domain}/m02` | Tech stack |
| GET | `/api/intel/{domain}/m03` | Traffic analysis |
| GET | `/api/intel/{domain}/m04` | Financial profile |
| GET | `/api/intel/{domain}/m05` | Competitor intel |
| ... | ... | ... |
| GET | `/api/intel/{domain}/m15` | Strategic brief |

### Enrichment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/enrich/{domain}` | Trigger full enrichment |
| POST | `/api/enrich/{domain}/wave/{n}` | Trigger specific wave |
| POST | `/api/enrich/{domain}/module/{mid}` | Trigger single module |
| GET | `/api/enrich/{domain}/status` | Get enrichment status |
| GET | `/api/enrich/jobs` | List active jobs |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Platform statistics |
| GET | `/api/health` | Health check |
| GET | `/api/cache/status` | Cache freshness |

---

## Source Freshness Rules

| Data Type | Max Age | Enforcement |
|-----------|---------|-------------|
| Stock price | 1 day | API validation |
| Traffic data | 30 days | API validation |
| Tech stack | 90 days | API validation |
| Financials (quarterly) | 4 months | API validation |
| Financials (annual) | 12 months | DB CHECK constraint |
| Earnings transcripts | 12 months | DB CHECK constraint |
| Executive quotes | 12 months | DB CHECK constraint |

---

## Related Documents

- **MEMORY.md** - Project memory and quick reference
- **PRD.md** - Product requirements document
- **ARCHITECTURE.md** - High-level architecture (root level)

---

*Document Version: 2.0*
*Created: 2026-02-25*
*Updated: 2026-02-25*
*Thread: 3 (Enterprise Architecture)*

---

## Document Count Summary

| Category | Documents | Total Lines |
|----------|-----------|-------------|
| Core Architecture | 3 | ~3,290 |
| Execution & Orchestration | 3 | ~2,450 |
| Design Principles | 2 | ~750 |
| **Enterprise Systems** | 4 | ~3,650 |
| Frontend & UX | 2 | ~1,600 |
| Reference Materials | 3 | ~1,450 |
| **Testing & Quality (P0)** | 1 | ~1,800 |
| **Data Ingestion (P0)** | 1 | ~1,245 |
| **TOTAL** | **19 documents** | **~16,245 lines** |
