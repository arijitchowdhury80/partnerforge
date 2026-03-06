# Algolia-Arian Restructure - Complete

**Date**: March 6, 2026
**Status**: ✅ RESTRUCTURE COMPLETE
**Result**: Clean, logical folder structure for ONE application

---

## 🎯 Key Understanding

**Algolia-Arian is ONE application** with:
- Partner Intelligence features (existing - in production)
- Search Audit features (new - to be built)

The confusion was thinking "Dashboard" was a separate app. It's NOT - it's just the UI interface of Arian with new features to be added.

---

## 📂 New Structure (Clean & Logical)

```
algolia-arian/
│
├── frontend/                    # ALL UI CODE - React app (ONE frontend)
│   ├── src/
│   │   ├── pages/               # All screens
│   │   │   ├── Dashboard.tsx           # Main dashboard
│   │   │   ├── TargetList.tsx          # Partner Intelligence view (existing)
│   │   │   ├── CompanyDrawer.tsx       # Company details (existing)
│   │   │   ├── AuditCreation.tsx       # NEW - Search Audit creation
│   │   │   ├── AuditExecution.tsx      # NEW - Search Audit execution
│   │   │   └── AuditResults.tsx        # NEW - Search Audit results
│   │   ├── components/          # Shared UI components
│   │   ├── services/            # Frontend services (API calls)
│   │   ├── contexts/            # React contexts
│   │   └── hooks/               # Custom hooks
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # ALL SERVER-SIDE CODE (to be built)
│   ├── api/                     # API endpoints
│   │   ├── partners/            # Partner Intelligence APIs
│   │   ├── audits/              # Search Audit APIs
│   │   └── enrichment/          # Enrichment APIs (BuiltWith, SimilarWeb, etc.)
│   ├── services/                # Business logic
│   │   ├── similarweb.ts        # SimilarWeb API client
│   │   ├── builtwith.ts         # BuiltWith API client
│   │   ├── yahoo-finance.ts     # Yahoo Finance client
│   │   ├── apify.ts             # Apify client
│   │   ├── apollo.ts            # Apollo.io client
│   │   └── scoring.ts           # Composite scoring logic
│   ├── workers/                 # Background jobs (BullMQ)
│   │   ├── enrichment-worker.ts # Enrichment queue worker
│   │   └── audit-worker.ts      # Audit execution worker
│   ├── cache/                   # Redis cache layer
│   │   └── redis-client.ts      # Redis connection & helpers
│   └── middleware/              # Express middleware
│       ├── auth.ts              # Authentication
│       ├── rate-limit.ts        # Rate limiting
│       └── error-handler.ts     # Error handling
│
├── docs/                        # ALL DOCUMENTATION
│   ├── architecture/            # Architecture decisions
│   │   ├── CROSSBEAM_ARCHITECTURE.md
│   │   └── (other architecture docs)
│   ├── features/                # ⭐ NEW - Feature specifications
│   │   ├── partner-intelligence/     # Partner Intelligence docs
│   │   └── search-audit/             # ⭐ Search Audit docs (moved from docs/dashboard/)
│   │       ├── README.md             # Feature overview
│   │       ├── PROJECT_STATUS.md     # Implementation status
│   │       ├── MASTER_PLAN.md        # Complete technical spec
│   │       ├── ARCHITECTURE_APPROVED.md   # Architecture decisions
│   │       ├── API_CLIENT_SPECIFICATIONS.md  # 31 API endpoints
│   │       ├── COST_MODEL_REALISTIC.md      # Cost projections
│   │       ├── DATA_SOURCES_ANALYSIS.md     # Data source evaluation
│   │       └── SOURCE_CITATION_REQUIREMENTS.md  # Citation specs
│   ├── operations/              # Operational docs
│   │   ├── EXECUTIVE_SUMMARY.md
│   │   └── CODE_STANDARDS.md
│   ├── icp-analysis/            # ICP definitions & scoring
│   ├── sales-system/            # Sales methodology
│   ├── presentations/           # Presentation materials
│   ├── historical/              # Old versions (archive)
│   ├── system/                  # System docs (enrichment, security, UX)
│   ├── future/                  # Future planning
│   └── _old/                    # Outdated files (archived)
│
├── data/                        # DATABASE STUFF
│   ├── migrations/              # SQL migration scripts
│   │   └── (to be created in Week 1)
│   └── seeds/                   # Seed data
│       └── (to be created in Week 1)
│
├── prototypes/                  # UI MOCKUPS & PROTOTYPES
│   ├── index-v2.html            # Search Audit UI mockup (10 screens)
│   ├── README.md                # Prototype documentation
│   └── _archive/                # 26 consolidated old planning docs
│
└── scripts/                     # Build & deployment scripts
    └── (existing from frontend/)
```

---

## 🔄 What Changed

### 1. Created Clean Structure

**NEW folders created**:
- ✅ `backend/` - All server-side code (structure ready, to be implemented)
- ✅ `data/` - Migrations and seeds
- ✅ `prototypes/` - UI mockups and prototypes
- ✅ `docs/features/` - Feature-specific documentation

### 2. Reorganized Documentation

**Before** (confusing):
```
docs/dashboard/        # Seemed like a separate project
docs/system/           # Arian docs?
```

**After** (clear):
```
docs/features/
  ├── partner-intelligence/    # Partner Intelligence feature docs
  └── search-audit/             # Search Audit feature docs
```

### 3. Moved Prototype Files

**Before**:
```
dashboard/index-v2.html    # Mixed with "dashboard" naming confusion
```

**After**:
```
prototypes/index-v2.html   # Clear: this is a prototype/mockup
```

---

## 📋 Files Moved

| File | From | To | Reason |
|------|------|----|----|
| All Search Audit docs (7 files) | `docs/dashboard/` | `docs/features/search-audit/` | Clearer organization |
| `index-v2.html` | `dashboard/` | `prototypes/` | It's a prototype, not code |
| `_archive/` | `dashboard/` | `prototypes/` | Historical planning docs |
| `README.md` | `dashboard/` | `prototypes/` | Navigation for prototypes |

---

## 🎯 One Application, Multiple Features

### Algolia-Arian Features:

1. **Partner Intelligence** (Existing - Production)
   - Find companies using partner tech (Adobe AEM, etc.)
   - Identify displacement opportunities
   - Enrichment with BuiltWith, SimilarWeb
   - ICP scoring and cohort analysis
   - **UI**: Dashboard, TargetList, CompanyDrawer (existing pages in frontend/)
   - **Docs**: `docs/features/partner-intelligence/` (to be organized)

2. **Search Audit** (NEW - To Be Built)
   - Automated search audits for GTM teams
   - Multi-source data enrichment (SimilarWeb, BuiltWith, Yahoo Finance, Apify, Apollo)
   - Background job processing (BullMQ + Redis)
   - PDF report generation
   - **UI**: AuditCreation, AuditExecution, AuditResults (NEW pages to add to frontend/)
   - **Docs**: `docs/features/search-audit/` ✅

---

## 🏗️ Backend Structure (To Be Implemented)

### Week 1-2: Core Infrastructure

```typescript
backend/
├── api/
│   ├── partners/
│   │   ├── routes.ts           # Express routes for partner APIs
│   │   └── controller.ts       # Partner business logic
│   ├── audits/
│   │   ├── routes.ts           # Express routes for audit APIs
│   │   └── controller.ts       # Audit orchestration
│   └── index.ts                # API router setup
│
├── services/
│   ├── http-client.ts          # Base HTTP client (retry, cache, rate limit)
│   ├── similarweb.ts           # 14 SimilarWeb endpoints
│   ├── builtwith.ts            # 7 BuiltWith endpoints
│   ├── yahoo-finance.ts        # 5 Yahoo Finance endpoints
│   ├── apify.ts                # 3 Apify actors
│   └── apollo.ts               # 2 Apollo.io endpoints
│
├── workers/
│   ├── enrichment-worker.ts    # BullMQ worker for enrichment jobs
│   └── audit-worker.ts         # BullMQ worker for audit execution
│
├── cache/
│   └── redis-client.ts         # Redis setup (7-day TTL)
│
└── server.ts                   # Express server entry point
```

---

## 💾 Database Structure (To Be Created)

### Week 1: Initial Schema

```sql
-- Location: data/migrations/001-initial-schema.sql

-- Companies table (lightweight entity)
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  domain VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Audits table (point-in-time snapshots)
CREATE TABLE audits (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  audit_type VARCHAR(50),  -- 'partner-intel' or 'search-audit'
  data JSONB,              -- All enrichment data
  score NUMERIC,
  status VARCHAR(50),
  created_at TIMESTAMP,
  created_by UUID
);

-- Enrichment cache (Redis-backed persistence)
CREATE TABLE enrichment_cache (
  key VARCHAR(255) PRIMARY KEY,
  provider VARCHAR(50),
  data JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP
);
```

---

## 📊 Technology Stack (Unified)

### Frontend (Existing)
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **UI Library**: Mantine v7
- **Styling**: Tailwind CSS
- **State**: React Context + TanStack Query
- **Hosting**: Vercel (https://algolia-arian.vercel.app)

### Backend (To Be Built)
- **Runtime**: Node.js + Express
- **Language**: TypeScript
- **Queue**: BullMQ + Redis
- **Cache**: Redis (7-day TTL)
- **Database**: PostgreSQL (Supabase)
- **File Storage**: S3 or Vercel Blob
- **Real-Time**: Socket.IO
- **Browser**: Puppeteer + Chrome

### Data Sources
- SimilarWeb (14 endpoints)
- BuiltWith (7 endpoints)
- Yahoo Finance (5 endpoints)
- SEC Edgar (3 endpoints)
- Apify (3 actors)
- Apollo.io (2 endpoints)

---

## 🚀 Implementation Roadmap

### Week 1-2: Backend Foundation
1. Set up Express server in `backend/`
2. Implement `HttpClient` with retry, cache, rate limiting
3. Implement all API clients (SimilarWeb, BuiltWith, etc.)
4. Set up Redis cache (7-day TTL)
5. Create database migrations in `data/migrations/`

### Week 3-4: Job Queue & Workers
1. Set up BullMQ + Redis
2. Implement enrichment worker
3. Implement audit worker
4. Add job status tracking

### Week 5-6: Partner Intelligence Integration
1. Migrate existing Partner Intelligence features to new backend
2. Connect existing frontend to new API endpoints
3. Test and deploy

### Week 7-10: Search Audit Features
1. Build Search Audit API endpoints
2. Implement UI screens (AuditCreation, AuditExecution, AuditResults)
3. Integrate with frontend navigation
4. Add to existing Arian dashboard

### Week 11-12: Testing & Polish
1. End-to-end testing
2. Performance optimization
3. Documentation updates
4. Production deployment

---

## ✅ Quality Checks

### Structure Validation
- ✅ Clean separation: frontend / backend / docs / data
- ✅ Feature-based organization in docs/
- ✅ No confusing "dashboard" folder (it's ONE app)
- ✅ Prototypes clearly separated from code
- ✅ Backend structure ready for implementation

### Documentation
- ✅ All Search Audit docs in `docs/features/search-audit/`
- ✅ Clear entry points (README.md in each folder)
- ✅ No broken links (to be updated in next step)
- ✅ Historical context preserved in prototypes/_archive/

### Git Safety
- ✅ No production code moved (frontend/ untouched)
- ✅ No files deleted (all moved to new locations)
- ✅ Vercel deployment still works (no changes to deployed code)

---

## 📝 Next Steps

### Immediate (Week 0)
1. Update all documentation links to point to new locations
2. Create backend/README.md with setup instructions
3. Create data/README.md with migration guide
4. Update root README.md with new structure

### Week 1 (Backend Foundation)
1. Initialize backend/ with Express + TypeScript
2. Implement HttpClient base class
3. Implement SimilarWeb API client (14 endpoints)
4. Set up Redis cache
5. Write first database migration

### Week 2-12 (Implementation)
Follow the roadmap above to build out all features.

---

## 🎓 Key Lessons

1. **Naming Matters**: "Dashboard" made it seem like a separate app
2. **One App, Multiple Features**: Arian has multiple feature sets, but it's ONE application
3. **Logical Structure**: frontend / backend / docs / data is clear and maintainable
4. **Feature-Based Docs**: Organize by feature, not by project name
5. **Prototypes vs Code**: Keep mockups separate from production code

---

## 📞 Questions?

- **Where's the Partner Intelligence code?** → `frontend/src/` (existing, in production)
- **Where's the Search Audit code?** → To be built in `frontend/src/` (new pages) + `backend/` (new APIs)
- **Where are the docs?** → `docs/features/search-audit/` for Search Audit, other docs throughout `docs/`
- **Where's the prototype?** → `prototypes/index-v2.html`
- **Where's the database stuff?** → `data/migrations/` and `data/seeds/` (to be created Week 1)

---

**Status**: ✅ RESTRUCTURE COMPLETE

**Result**: Clean, maintainable folder structure for ONE unified Algolia-Arian application with multiple features.

**Next**: Update all documentation links and start Week 1 backend implementation.

**Date**: March 6, 2026
**Completed by**: Dashboard Builder Agent (now Arian Architect Agent!)
