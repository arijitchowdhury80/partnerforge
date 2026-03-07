# Folder Cleanup Plan - March 6, 2026

**Status**: Ready for approval
**Impact**: Will delete ~8 folders and reorganize docs/

---

## 🚨 Critical Issue Found!

**Search Audit docs are in the WRONG location**:
- **Current**: `docs/archived/features/search-audit/`
- **Should be**: `docs/features/search-audit/`

The docs were accidentally archived instead of staying active. **Must fix first!**

---

## 📂 Current Folder Structure

```
algolia-arian/
├── frontend/          ✅ KEEP - Production React app
├── backend/           ✅ KEEP - NEW Week 1 structure
├── data/              ✅ KEEP - Migrations, seeds
├── docs/              ⚠️ NEEDS FIX - Wrong structure
├── prototypes/        ✅ KEEP - UI mockups
│
├── algolia-temp/      ❌ DELETE - Temporary test folder
├── images/            ❌ DELETE - 1 random image
├── logs/              ❌ DELETE - 1 old log file
├── output/            ⚠️ ARCHIVE - Old Feb 25 reports
├── pipeline/          ⚠️ REVIEW - Python pipeline (still used?)
├── scripts/           ⚠️ REVIEW - Python/TS scripts (still used?)
├── supabase/          ✅ KEEP - Database migrations
└── tests/             ⚠️ REVIEW - Python tests (still used?)
```

---

## 🔴 Priority 1: Fix docs/ Structure (CRITICAL)

### Current (WRONG):
```
docs/
├── archived/
│   └── features/
│       ├── partner-intelligence/
│       └── search-audit/          ❌ Should NOT be archived!
├── ARCHITECTURE.md
├── CODE_STANDARDS.md
└── (other scattered files)
```

### Should Be (CORRECT):
```
docs/
├── features/                      ✅ Active feature docs
│   ├── partner-intelligence/
│   └── search-audit/              ✅ Move from archived!
│       ├── PROJECT_STATUS.md
│       ├── MASTER_PLAN.md
│       ├── ARCHITECTURE_APPROVED.md
│       └── (4 more files)
├── architecture/                  ✅ Architecture docs
├── operations/                    ✅ Operational docs
└── archived/                      ✅ OLD versions only
```

**Actions**:
1. ❗ Move `docs/archived/features/` → `docs/features/`
2. ❗ Move active docs from `docs/archived/` subfolders to `docs/` proper
3. Keep only truly OLD versions in `docs/archived/`

---

## ❌ Folders to DELETE

### 1. `algolia-temp/` (Nested Git Repo)
- **Contents**: Test files, temporary code
- **Why delete**: Temporary testing folder, not part of main project
- **Risk**: LOW - appears to be experiments
```
algolia-temp/
├── CLAUDE.md
├── DECISIONS.md
├── README.md
├── api-client.js
└── dashboard.html
```

### 2. `images/` (1 Random Image)
- **Contents**: `Gemini_Generated_Image_hkpbqqhkpbqqhkpb.jpeg`
- **Why delete**: Single random image, not used in project
- **Risk**: LOW - likely accidentally added
```
images/
└── Gemini_Generated_Image_hkpbqqhkpbqqhkpb.jpeg
```

### 3. `logs/` (Old Log File)
- **Contents**: `1772080056222.log`
- **Why delete**: Single old log file, not needed
- **Risk**: LOW - logs are ephemeral
```
logs/
└── 1772080056222.log
```

---

## 🟡 Folders to ARCHIVE (Move to docs/archived/)

### 4. `output/` (Old Reports from Feb 25)
- **Contents**: Displacement reports, CSV files from Feb 25, 2026
- **Why archive**: Historical data, but might be useful for reference
- **Risk**: LOW - can regenerate if needed
```
output/
├── DISPLACEMENT_REPORT_20260225.md
├── aem_displacement_targets_20260225.csv
├── aem_high_value_targets_20260225.csv
├── aem_icp_scored_targets_20260225.csv
└── aem_top_100_leads_20260225.csv
```

**Action**: Move to `docs/archived/output-feb25/`

---

## ⚠️ Folders to REVIEW (Need User Decision)

### 5. `pipeline/` (Python Pipeline Code)
- **Contents**: Python modules, adapters, models
- **Question**: Is this still being used for data processing?
- **If YES**: Keep and document in README
- **If NO**: Archive or delete
```
pipeline/
├── __init__.py
├── adapters/
├── models/
└── modules/
```

### 6. `scripts/` (Python & TypeScript Scripts)
- **Contents**: Various enrichment and analysis scripts
- **Question**: Are these still being used?
- **If YES**: Keep and document which ones are active
- **If NO**: Archive or delete
```
scripts/
├── adobe-icp-distribution.ts
├── analyze-verticals.ts
├── batch_enrich_supabase.py
├── batch_update_spryker.py
└── (more scripts)
```

### 7. `tests/` (Python Tests)
- **Contents**: Python unit tests
- **Question**: Are these tests still relevant?
- **If YES**: Keep
- **If NO**: Delete (tests should be in backend/ going forward)
```
tests/
├── __init__.py
├── conftest.py
└── unit/
```

---

## ✅ Folders to KEEP (No Changes)

### `frontend/` - Production React App
- **Status**: In production at algolia-arian.vercel.app
- **Action**: NO CHANGES

### `backend/` - Week 1 Implementation
- **Status**: Ready for implementation
- **Action**: NO CHANGES

### `data/` - Database Files
- **Status**: Active migrations, seeds, data files
- **Action**: NO CHANGES

### `prototypes/` - UI Mockups
- **Status**: index-v2.html + _archive/ (26 old planning docs)
- **Action**: NO CHANGES

### `supabase/` - Database Setup
- **Contents**: Supabase functions, migrations
- **Status**: Active database infrastructure
- **Action**: NO CHANGES

---

## 📋 Cleanup Checklist

### **CRITICAL (Do First):**
- [ ] Move `docs/archived/features/` → `docs/features/`
- [ ] Verify search-audit docs are accessible at `docs/features/search-audit/`
- [ ] Move active content out of `docs/archived/` subdirectories
- [ ] Update all documentation links

### **Safe Deletions:**
- [ ] Delete `algolia-temp/` (nested git repo)
- [ ] Delete `images/` (1 random image)
- [ ] Delete `logs/` (old log file)

### **Archive:**
- [ ] Move `output/` → `docs/archived/output-feb25/`

### **Need Decisions:**
- [ ] `pipeline/` - Still used? (If no, delete)
- [ ] `scripts/` - Which scripts are still needed? (Archive the rest)
- [ ] `tests/` - Still relevant? (If no, delete - tests should be in backend/)

---

## 🎯 After Cleanup

### Clean Structure:
```
algolia-arian/
├── frontend/              # Production React app
├── backend/               # Week 1 implementation
├── data/                  # Migrations, seeds, CSV files
├── docs/                  # Documentation
│   ├── features/          # Feature docs (FIXED!)
│   │   ├── partner-intelligence/
│   │   └── search-audit/
│   ├── architecture/
│   ├── operations/
│   └── archived/          # OLD versions only
├── prototypes/            # UI mockups
├── supabase/              # Database setup
├── scripts/ (if kept)     # Active scripts only
└── docs-viewer.html       # HTML documentation
```

### Files Removed:
- `algolia-temp/` - deleted
- `images/` - deleted
- `logs/` - deleted
- `output/` - archived
- `pipeline/` - (pending decision)
- `scripts/` - (pending decision)
- `tests/` - (pending decision)

---

## 💾 Estimated Savings

- **Folders to delete**: 3
- **Folders to archive**: 1
- **Folders to review**: 3
- **Total cleanup**: ~7 folders
- **Space saved**: ~10-50 MB (mostly CSV files in output/)

---

## ⚠️ Risks

**LOW RISK:**
- Deleting algolia-temp/, images/, logs/ - clearly not used

**MEDIUM RISK:**
- Archiving output/ - old reports, can regenerate

**HIGH RISK (Need Confirmation):**
- pipeline/ - might be actively used for data processing
- scripts/ - some scripts might still be needed
- tests/ - tests might be relevant

---

## 🚀 Recommended Action

1. **IMMEDIATE**: Fix docs/ structure (move features/ out of archived/)
2. **SAFE**: Delete algolia-temp/, images/, logs/
3. **REVIEW**: Ask user about pipeline/, scripts/, tests/
4. **THEN**: Archive output/ to docs/archived/

---

**Status**: Ready for your approval
**Next**: Tell me which folders to delete/keep, then I'll execute the cleanup

**Last Updated**: March 6, 2026
