# PartnerForge - Enterprise ABM Platform

**Version:** 3.0 FINAL
**Status:** 🚀 **DEPLOYED TO PRODUCTION**
**Last Updated:** 2026-02-26
**Repository:** https://github.com/arijitchowdhury80/partnerforge

---

## Executive Summary

PartnerForge is an enterprise-grade Account-Based Marketing (ABM) platform for Algolia Sales. Built using a **parallel agent architecture** with 4 concurrent development threads, the platform processes 15 intelligence modules in 4 execution waves.

### Core Formula
```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

---

## 📊 Final Build Statistics

| Metric | Value |
|--------|-------|
| **Total Lines of Code** | 43,729 |
| **Unit Tests** | 1,142 passing |
| **Test Pass Rate** | 100% |
| **Intelligence Modules** | 15 |
| **API Endpoints** | 6 route groups |
| **Architecture Docs** | 24 documents |
| **Database Tables** | 51+ |
| **Frontend Components** | 20+ |
| **Deployment** | Railway (Backend + Frontend) |

---

## 🏗️ Architecture Overview

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI + SQLAlchemy 2.0 + PostgreSQL |
| **Frontend** | React 18 + TypeScript + Vite + Mantine |
| **Queue** | Redis + Celery |
| **Testing** | pytest-asyncio (1,142 tests) |
| **Deployment** | Railway |

### Intelligence Module Waves

| Wave | Modules | Purpose |
|------|---------|---------|
| **Wave 1** | M01-M04 | Foundation (Company, Tech, Traffic, Financials) |
| **Wave 2** | M05-M07 | Competitive (Competitors, Hiring, Strategic) |
| **Wave 3** | M08-M11 | Buying Signals (Investor, Executive, Committee, Displacement) |
| **Wave 4** | M12-M15 | Synthesis (Case Study, ICP, Scoring, Brief) |

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/v1/health` | Health checks & system status |
| `/api/v1/lists` | CSV upload & list management |
| `/api/v1/targets` | Displacement target CRUD |
| `/api/v1/enrich` | Intelligence enrichment |
| `/api/v1/alerts` | Alert rules & notifications |
| `/api/v1/changes` | Change detection & history |

---

## 🚀 PARALLEL AGENT BUILDING STRATEGY (CRITICAL)

**THIS IS MANDATORY** - All build phases use parallel agents for maximum velocity.

### Thread-Based Parallelism Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARALLEL BUILD EXECUTION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │  THREAD 1    │  │  THREAD 2    │  │  THREAD 3    │  │  THREAD 4    │   │
│   │   Backend    │  │  Data        │  │  Frontend    │  │  Infra       │   │
│   │   Core       │  │  Pipeline    │  │  UI          │  │  DevOps      │   │
│   ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤   │
│   │ - Models     │  │ - Adapters   │  │ - Components │  │ - Migrations │   │
│   │ - Repos      │  │ - Modules    │  │ - Dashboard  │  │ - Deploy     │   │
│   │ - Services   │  │ - Orchestr.  │  │ - Views      │  │ - Monitoring │   │
│   │ - Tests      │  │ - Tests      │  │ - Tests      │  │ - Tests      │   │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│          │                 │                 │                 │            │
│          └─────────────────┴─────────────────┴─────────────────┘            │
│                                    ↓                                         │
│                           INTEGRATION PHASE                                  │
│                     (All threads merge & verify)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Wave-Based Module Parallelism

Within Thread 2 (Data Pipeline), modules execute in parallel waves:

```
WAVE 1: Foundation (Parallel)       WAVE 2: Competitive (Parallel)
┌────┐ ┌────┐ ┌────┐ ┌────┐        ┌────┐ ┌────┐ ┌────┐
│M01 │ │M02 │ │M03 │ │M04 │   →    │M05 │ │M06 │ │M07 │
└────┘ └────┘ └────┘ └────┘        └────┘ └────┘ └────┘
                    ↓                            ↓
WAVE 3: Buying Signals (Parallel)   WAVE 4: Synthesis (Parallel)
┌────┐ ┌────┐ ┌────┐ ┌────┐        ┌────┐ ┌────┐ ┌────┐ ┌────┐
│M08 │ │M09 │ │M10 │ │M11 │   →    │M12 │ │M13 │ │M14 │ │M15 │
└────┘ └────┘ └────┘ └────┘        └────┘ └────┘ └────┘ └────┘
```

### How to Invoke Parallel Agents

When building, ALWAYS use the Task tool with multiple parallel invocations:

```markdown
EXAMPLE: Building Wave 1 modules in parallel

User: "Build Wave 1 modules"
Claude: Uses Task tool with 4 PARALLEL agents:
  - Agent 1: "Implement M01 Company Context + tests"
  - Agent 2: "Implement M02 Technology Stack + tests"
  - Agent 3: "Implement M03 Traffic Analysis + tests"
  - Agent 4: "Implement M04 Financial Profile + tests"
```

### Parallel Build Rules

| Rule | Description |
|------|-------------|
| **No dependencies = parallel** | If tasks don't depend on each other, run in parallel |
| **Tests with code** | Every module implementation includes its test file in SAME agent |
| **Wave boundaries** | Wait for all Wave N agents before starting Wave N+1 |
| **Atomic checkpoints** | Each agent saves progress to disk before completion |
| **Merge carefully** | Integration phase runs AFTER all parallel agents complete |

---

## 📋 MANDATORY: Testing Methodology (P0)

**Reference:** `docs/TESTING_ARCHITECTURE.md`

### Core Principles

| Principle | Requirement |
|-----------|-------------|
| **Parallel Test Development** | Every module/service MUST have corresponding test file written in the SAME agent session |
| **Unit Test Coverage** | 80% minimum, 90% target |
| **Test Pyramid** | Unit (70%) → Integration (20%) → E2E (10%) |
| **Validation Pattern** | Every test defines: Setup → Action → Expected → Actual → Assert |
| **Self-Correction** | 3 levels: Automatic (retry), Semi-Auto (logged), Manual (human) |
| **Iterative Improvement** | Run → Analyze → Fix → Re-run cycle until all pass |
| **Progress Persistence** | All work persisted to disk via `ProgressPersistence` class |

### Quality Gates (CI/CD)

| Gate | Requirement | Blocks PR? |
|------|-------------|------------|
| Baseline Tests | All import, exist, happy path | YES |
| Unit Tests | All pass | YES |
| Coverage | ≥80% | YES |
| Type Check | No mypy errors | YES |
| Lint | No ruff errors | NO (warning) |

### Test Distribution

```
✅ Unit Tests: 1,142 passing (100%)

By Category:
├── Intelligence Modules: 642 tests
│   ├── Wave 1 (M01-M04): 147 tests
│   ├── Wave 2 (M05-M07): 130 tests
│   ├── Wave 3 (M08-M11): 180 tests
│   └── Wave 4 (M12-M15): 185 tests
├── Repository Tests: 200+ tests
├── Services Tests: 150+ tests
└── Model Tests: ~70 tests
```

---

## 🔐 SOURCE CITATION MANDATE (P0)

**Non-negotiable requirement for every data point.**

### Requirements

| Field | Requirement |
|-------|-------------|
| `source_url` | REQUIRED - URL where data was obtained |
| `source_date` | REQUIRED - Max 12 months old |
| `source_type` | OPTIONAL - api, webpage, document, transcript |

### Freshness Rules

| Source Type | Max Age |
|-------------|---------|
| Stock price | 1 day |
| Traffic data | 30 days |
| Tech stack | 90 days |
| Financials | 12 months |
| Transcripts | 12 months |

### Enforcement Points

- Database: NOT NULL constraints on `source_url`, `source_date`
- Model: Pydantic validators in `SourceCitationMixin`
- Service: `validate_source_citation()` method
- Repository: Pre-save validation

---

## 📁 Project Structure

```
PartnerForge/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/          # 6 route modules
│   │   │   └── schemas/         # Pydantic schemas
│   │   ├── models/              # 48 SQLAlchemy models
│   │   ├── modules/             # 15 intelligence modules
│   │   ├── repositories/        # Data access layer
│   │   ├── services/            # Business logic
│   │   └── utils/               # Helpers, self-correction
│   ├── tests/
│   │   └── unit/                # 1,142 tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # 20+ React components
│   │   ├── services/            # API client
│   │   └── types/               # TypeScript definitions
│   └── package.json
├── docs/                        # 24 architecture documents
├── railway.toml                 # Railway deployment
└── PROJECT_TRACKER.md           # This file
```

---

## 📚 Architecture Documents

| Document | Purpose | Lines |
|----------|---------|-------|
| `ARCHITECTURE_INDEX.md` | Navigation hub | ~200 |
| `ENTERPRISE-ARCHITECTURE.md` | Master architecture | ~1,340 |
| `INTELLIGENCE_MODULES_SPEC.md` | 15 modules with JSON schemas | ~1,500 |
| `DATABASE_SCHEMA_V2.md` | 51+ PostgreSQL tables | ~700 |
| `PARALLEL_EXECUTION_ARCHITECTURE.md` | 4-wave parallel execution | ~500 |
| `SOURCE_CITATION_MANDATE.md` | Citation enforcement | ~400 |
| `TESTING_ARCHITECTURE.md` | Test methodology | ~1,800 |
| `CHANGE_DETECTION_ARCHITECTURE.md` | Temporal versioning | ~700 |
| `MULTI_TENANCY_RBAC.md` | Multi-tenant RBAC | ~400 |
| `API_COST_TRACKING.md` | Cost tracking & budgets | ~500 |
| `OBSERVABILITY_METRICS.md` | Prometheus metrics | ~600 |
| `CSV_UPLOAD_ARCHITECTURE.md` | CSV import flow | ~1,245 |
| `PREMIUM-UI-SPECIFICATION.md` | Championship UI spec | ~1,200 |

**Total Architecture Documentation:** ~23,000 lines

---

## 🧪 Intelligence Modules (15 Complete)

| ID | Module | Wave | Tests | Status |
|----|--------|------|-------|--------|
| M01 | Company Context | 1 | 35 | ✅ |
| M02 | Technology Stack | 1 | 38 | ✅ |
| M03 | Traffic Analysis | 1 | 36 | ✅ |
| M04 | Financial Profile | 1 | 38 | ✅ |
| M05 | Competitor Intelligence | 2 | 42 | ✅ |
| M06 | Hiring Signals | 2 | 44 | ✅ |
| M07 | Strategic Context | 2 | 44 | ✅ |
| M08 | Investor Intelligence | 3 | 45 | ✅ |
| M09 | Executive Intelligence | 3 | 45 | ✅ |
| M10 | Buying Committee | 3 | 45 | ✅ |
| M11 | Displacement Analysis | 3 | 45 | ✅ |
| M12 | Case Study Matching | 4 | 46 | ✅ |
| M13 | ICP-Priority Mapping | 4 | 46 | ✅ |
| M14 | Signal Scoring | 4 | 46 | ✅ |
| M15 | Strategic Signal Brief | 4 | 47 | ✅ |

---

## 🔄 Thread Execution Summary

### Thread 1: Backend Core
| Deliverable | Status | Tests |
|-------------|--------|-------|
| VersioningService | ✅ | 26 |
| ChangeDetectionService | ✅ | 23 |
| AlertService | ✅ | 26 |
| BudgetService | ✅ | 17 |
| OrchestratorService | ✅ | 25 |
| Repository Layer | ✅ | 200+ |

### Thread 2: Data Pipeline
| Deliverable | Status | Tests |
|-------------|--------|-------|
| Wave 1 Modules (M01-M04) | ✅ | 147 |
| Wave 2 Modules (M05-M07) | ✅ | 130 |
| Wave 3 Modules (M08-M11) | ✅ | 180 |
| Wave 4 Modules (M12-M15) | ✅ | 185 |
| BaseAdapter | ✅ | 38 |

### Thread 3: API Endpoints
| Deliverable | Status | Tests |
|-------------|--------|-------|
| /health routes | ✅ | 10 |
| /lists routes | ✅ | 15 |
| /targets routes | ✅ | 20 |
| /enrich routes | ✅ | 25 |
| /alerts routes | ✅ | 20 |
| /changes routes | ✅ | 15 |

### Thread 4: Frontend + Infra
| Deliverable | Status |
|-------------|--------|
| Dashboard | ✅ |
| TargetTable | ✅ |
| CompanyView | ✅ |
| AlertCenter | ✅ |
| ChangeTimeline | ✅ |
| Railway Deploy | ✅ |

---

## 🚀 Quick Start

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev

# Run Tests
cd backend && python3 -m pytest tests/unit/ -v
```

---

## 📈 Git History

| Commit | Description |
|--------|-------------|
| `9536d50` | fix: SourceCitationError custom messages |
| `8243bea` | feat: Railway deployment configuration |
| `54d2297` | feat: Phase 2 Complete - All 15 modules |
| `8bf0ad5` | feat: CSV upload architecture |
| `d19f3f5` | feat: P0 source citation models |

---

## 🎯 Design Principles

1. **Source Citation Mandate** - Every data point must have source_url + source_date
2. **Parallel Execution** - 4 threads, 4 waves, asyncio.gather
3. **Test-Driven** - Tests written in same session as implementation
4. **Self-Correction** - Automatic retry, failure analysis, auto-fix
5. **Progress Persistence** - All work saved to disk
6. **Wave Dependencies** - Wait for Wave N before starting Wave N+1
7. **Atomic Checkpoints** - Each agent saves state before completion

---

*Final Version: 3.0*
*Status: PRODUCTION DEPLOYED*
*Total: 43,729 lines of code*
*Tests: 1,142 passing*
