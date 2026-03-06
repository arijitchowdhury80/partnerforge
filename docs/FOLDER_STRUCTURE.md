# Documentation Folder Structure

**Last Updated**: March 6, 2026
**Status**: Organized and Clean

---

## 📂 Complete Structure

```
algolia-arian/
│
├── frontend/                           # Arian (Partner Intelligence) - React app
│   └── src/
│
├── dashboard/                          # Dashboard prototypes & archive
│   ├── README.md                       # Navigation (points to docs/dashboard/)
│   ├── index-v2.html                   # Interactive prototype (10 screens)
│   └── _archive/                       # 26 consolidated old files
│
└── docs/                               # All project documentation
    │
    ├── dashboard/                      # ⭐ NEW - Dashboard (Search Audit SaaS) docs
    │   ├── README.md                   # Entry point - START HERE
    │   ├── PROJECT_STATUS.md           # Agent handoff doc
    │   ├── MASTER_PLAN.md              # Complete guide (8 chapters)
    │   ├── ARCHITECTURE_APPROVED.md    # Architecture decision
    │   ├── API_CLIENT_SPECIFICATIONS.md# 31 API endpoints
    │   ├── COST_MODEL_REALISTIC.md     # Cost projections
    │   ├── DATA_SOURCES_ANALYSIS.md    # Data source evaluation
    │   └── SOURCE_CITATION_REQUIREMENTS.md # Citation specs
    │
    ├── system/                         # Arian system docs
    │   ├── README.md                   # System docs index
    │   ├── PRD.md                      # Arian PRD
    │   ├── ARCHITECTURE.md             # Arian architecture
    │   ├── DEPLOYMENT.md               # Deployment guide
    │   └── (other Arian system docs)
    │
    ├── architecture/                   # Architectural decisions
    │   └── CROSSBEAM_ARCHITECTURE.md   # Arian's Crossbeam integration
    │
    ├── icp-analysis/                   # Arian ICP analysis
    │   ├── ICP_DEFINITION.md
    │   ├── COHORT_DEFINITION.md
    │   ├── COMPOSITE_SCORING.md
    │   └── (other ICP docs)
    │
    ├── operations/                     # Operational docs
    │   ├── EXECUTIVE_SUMMARY.md
    │   └── CODE_STANDARDS.md
    │
    ├── sales-system/                   # Sales methodology
    │   ├── PLAY-SYSTEM.md
    │   ├── FIVE_LAYER_FUNNEL.md
    │   └── SALES_MACHINERY.md
    │
    ├── presentations/                  # Presentation materials
    │   └── ARIAN_STORY.md
    │
    ├── historical/                     # Historical context
    │   ├── FRESH_START_PLAN.md
    │   ├── DECISIONS.md
    │   └── (old versions)
    │
    ├── future/                         # Future planning
    │
    └── _old/                           # ⭐ NEW - Archived outdated files
        ├── COST_ANALYSIS_1000_AUDITS.md    # OLD cost model
        ├── ARCHITECTURE_MASTER.md          # OLD planning doc
        └── DECISIONS_SUMMARY.md            # OLD decision doc
```

---

## 🎯 Two Projects, Two Doc Sets

### Arian (Partner Intelligence Platform)
- **Purpose**: Find displacement opportunities (companies using partner tech but not Algolia)
- **Status**: Production (https://algolia-arian.vercel.app)
- **Code**: `frontend/`
- **Docs**: `docs/system/`, `docs/architecture/`, `docs/icp-analysis/`, `docs/operations/`, `docs/sales-system/`

### Dashboard (Search Audit SaaS)
- **Purpose**: Automated search audit platform for GTM teams
- **Status**: Planning complete, ready for implementation (Week 1)
- **Prototype**: `dashboard/index-v2.html`
- **Docs**: `docs/dashboard/` ⭐

---

## 📖 Reading Guides

### For Dashboard (Search Audit SaaS)

**Start here**: [`docs/dashboard/README.md`](dashboard/README.md)

**Or go directly to**: [`docs/dashboard/PROJECT_STATUS.md`](dashboard/PROJECT_STATUS.md)

### For Arian (Partner Intelligence)

**Start here**: [`docs/system/README.md`](system/README.md)

---

## 🗑️ Archived Files

**Location**: `docs/_old/`

These files were outdated/superseded and moved to archive:
- `COST_ANALYSIS_1000_AUDITS.md` - Superseded by `docs/dashboard/COST_MODEL_REALISTIC.md`
- `ARCHITECTURE_MASTER.md` - Planning doc asking for decisions (now finalized)
- `DECISIONS_SUMMARY.md` - Old decision summary (decisions now made)

**Not deleted** - preserved for historical reference

---

## ✅ Quality Standards

- **No broken links** - All navigation updated
- **Clear separation** - Arian vs Dashboard docs clearly separated
- **Role-based guides** - Engineer, Designer, PM, Stakeholder paths
- **Single source of truth** - No conflicting documents
- **Future-proof** - Easy to add more docs

---

**Last Updated**: March 6, 2026
