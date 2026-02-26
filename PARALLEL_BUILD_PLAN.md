# PartnerForge Parallel Build Plan

**Version:** 1.0
**Date:** 2026-02-25
**Status:** APPROVED - Ready for Execution

---

## Overview

This document defines the parallel agent execution strategy for building PartnerForge. **4 parallel threads** will work simultaneously, each owning a specific domain.

---

## Thread Assignments

### Thread 1: Backend Services & Core Infrastructure
**Agent Type:** general-purpose
**Focus:** Service layer, database operations, core utilities

**Deliverables:**
1. `backend/app/services/versioning.py` - Snapshot CRUD, diff computation
2. `backend/app/services/change_detection.py` - Change events, significance scoring
3. `backend/app/services/alerts.py` - Rule matching, notification dispatch
4. `backend/app/services/budget.py` - Cost tracking, budget enforcement
5. `backend/app/services/orchestrator.py` - Wave execution, job management
6. `backend/tests/unit/services/test_*.py` - All service tests

**Dependencies:** None (builds on existing models)

---

### Thread 2: Intelligence Modules (M01-M15)
**Agent Type:** general-purpose
**Focus:** 15 intelligence module implementations

**Wave 1 (Parallel within wave):**
- `backend/app/modules/m01_company_context.py`
- `backend/app/modules/m02_tech_stack.py`
- `backend/app/modules/m03_traffic.py`
- `backend/app/modules/m04_financials.py`

**Wave 2:**
- `backend/app/modules/m05_competitors.py`
- `backend/app/modules/m06_hiring.py`
- `backend/app/modules/m07_strategic.py`

**Wave 3:**
- `backend/app/modules/m08_investor.py`
- `backend/app/modules/m09_executive.py`
- `backend/app/modules/m10_buying_committee.py`
- `backend/app/modules/m11_displacement.py`

**Wave 4:**
- `backend/app/modules/m12_case_study.py`
- `backend/app/modules/m13_icp_priority.py`
- `backend/app/modules/m14_signal_scoring.py`
- `backend/app/modules/m15_strategic_brief.py`

**Plus tests:** `backend/tests/unit/modules/test_m*.py`

**Dependencies:** Requires base.py module (exists)

---

### Thread 3: API Endpoints
**Agent Type:** general-purpose
**Focus:** FastAPI routes, request/response schemas

**Deliverables:**
1. `backend/app/api/routes/enrich.py` - Enrichment endpoints
2. `backend/app/api/routes/targets.py` - Target CRUD
3. `backend/app/api/routes/alerts.py` - Alert management
4. `backend/app/api/routes/changes.py` - Change history
5. `backend/app/api/routes/health.py` - Health checks
6. `backend/app/api/schemas/` - Pydantic schemas
7. `backend/tests/integration/test_api_*.py` - API tests

**Dependencies:** Requires services from Thread 1 (can mock initially)

---

### Thread 4: Frontend Components
**Agent Type:** general-purpose
**Focus:** React/TypeScript UI components

**Deliverables:**
1. `frontend/src/components/dashboard/Dashboard.tsx`
2. `frontend/src/components/dashboard/TargetTable.tsx`
3. `frontend/src/components/dashboard/PipelineChart.tsx`
4. `frontend/src/components/company/CompanyView.tsx`
5. `frontend/src/components/company/IntelligencePanel.tsx`
6. `frontend/src/components/company/ChangeTimeline.tsx`
7. `frontend/src/components/alerts/AlertCenter.tsx`
8. `frontend/src/services/api.ts` (updated)

**Dependencies:** API endpoints from Thread 3 (can mock initially)

---

## Execution Strategy

### Phase 1: Bootstrap (All threads parallel)

| Thread | Task |
|--------|------|
| 1 | Create services/ directory structure |
| 2 | Create modules/ directory, implement m01 as template |
| 3 | Create api/routes/ structure, implement health endpoint |
| 4 | Create component directories, implement AppShell |

### Phase 2: Core Implementation (All threads parallel)

| Thread | Task |
|--------|------|
| 1 | VersioningService, ChangeDetectionService |
| 2 | Wave 1 modules (m01, m02, m03, m04) |
| 3 | /enrich and /targets endpoints |
| 4 | Dashboard, TargetTable components |

### Phase 3: Extended Implementation (All threads parallel)

| Thread | Task |
|--------|------|
| 1 | AlertService, BudgetService |
| 2 | Wave 2 + Wave 3 modules |
| 3 | /alerts and /changes endpoints |
| 4 | CompanyView, AlertCenter components |

### Phase 4: Synthesis (All threads parallel)

| Thread | Task |
|--------|------|
| 1 | Orchestrator, integration tests |
| 2 | Wave 4 modules |
| 3 | Full API integration tests |
| 4 | ChangeTimeline, final polish |

---

## Agent Invocation Pattern

When user says "START BUILDING", invoke 4 parallel Task agents in a single message:

**Agent 1 Prompt (Thread 1 - Services):**
```
You are Thread 1 of 4 for PartnerForge parallel build.

YOUR DOMAIN: Backend Services
YOUR FILES:
- backend/app/services/versioning.py
- backend/app/services/change_detection.py
- backend/app/services/alerts.py
- backend/app/services/budget.py
- backend/tests/unit/services/test_*.py

EXISTING RESOURCES:
- Models in backend/app/models/ (48 models)
- Database in backend/app/database.py
- Config in backend/app/config.py

METHODOLOGY:
1. Write tests FIRST (test-driven)
2. Implement service
3. Run tests with self-correction
4. Commit when tests pass

START WITH: VersioningService (snapshot CRUD, diff computation)
```

**Agent 2 Prompt (Thread 2 - Modules):**
```
You are Thread 2 of 4 for PartnerForge parallel build.

YOUR DOMAIN: Intelligence Modules M01-M15
YOUR FILES:
- backend/app/modules/m01_company_context.py through m15_strategic_brief.py
- backend/tests/unit/modules/test_m*.py

EXISTING RESOURCES:
- BaseIntelligenceModule in backend/app/modules/base.py
- Models in backend/app/models/intelligence.py (15 Intel* models)
- INTELLIGENCE_MODULES_SPEC.md for JSON schemas

METHODOLOGY:
1. Follow BaseIntelligenceModule interface
2. Write tests alongside implementation
3. Each module must have source_url, source_date
4. Use asyncio for parallel API calls within module

START WITH: M01_CompanyContext (BuiltWith + WebSearch)
```

**Agent 3 Prompt (Thread 3 - API):**
```
You are Thread 3 of 4 for PartnerForge parallel build.

YOUR DOMAIN: FastAPI Endpoints
YOUR FILES:
- backend/app/api/routes/*.py
- backend/app/api/schemas/*.py
- backend/tests/integration/test_api_*.py

EXISTING RESOURCES:
- FastAPI app in backend/app/main.py
- Models in backend/app/models/
- Services (being built by Thread 1)

METHODOLOGY:
1. Create Pydantic schemas first
2. Implement routes with proper error handling
3. Write integration tests
4. Mock services until Thread 1 delivers

START WITH: Health endpoint, then /api/v1/targets
```

**Agent 4 Prompt (Thread 4 - Frontend):**
```
You are Thread 4 of 4 for PartnerForge parallel build.

YOUR DOMAIN: React/TypeScript Frontend
YOUR FILES:
- frontend/src/components/**/*.tsx
- frontend/src/services/api.ts
- frontend/src/types/index.ts

EXISTING RESOURCES:
- Types in frontend/src/types/index.ts
- API client in frontend/src/services/api.ts
- Vite + Tailwind configured

METHODOLOGY:
1. Use TypeScript strictly
2. Follow Aceternity UI patterns
3. Implement glassmorphism dark theme
4. Mock API until Thread 3 delivers

START WITH: AppShell with navigation, then Dashboard
```

---

## Synchronization Points

### Checkpoint 1: After Bootstrap Phase
- All directory structures created
- At least one file per thread implemented
- Tests running (may be failing)

### Checkpoint 2: After Core Phase
- Thread 1: VersioningService complete
- Thread 2: Wave 1 modules complete
- Thread 3: /enrich endpoint complete
- Thread 4: Dashboard rendering

### Checkpoint 3: After Extended Phase
- Thread 1: All 4 services complete
- Thread 2: Waves 1-3 complete
- Thread 3: All endpoints complete
- Thread 4: All components rendering

### Checkpoint 4: Integration
- All threads merge to develop branch
- Full integration tests pass
- E2E enrichment test passes

---

## Quality Gates (All Threads)

Every commit must pass:
- [ ] Unit tests pass
- [ ] Coverage >= 80%
- [ ] No type errors
- [ ] No lint errors
- [ ] Source citation enforced (backend)

---

## Git Workflow

1. Main branch stays clean
2. Each thread works on feature/thread-N-*
3. Merge to develop for integration
4. Merge to main for release

---

*Document Version: 1.0*
*Ready for parallel execution*
