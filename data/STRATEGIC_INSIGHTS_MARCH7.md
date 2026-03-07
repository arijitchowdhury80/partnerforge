# Strategic Insights Architecture - March 7, 2026

## Summary

**Status**: ✅ Complete - Ready for Implementation
**Migration**: 008-add-strategic-insights.sql
**Tables Updated**: 12 enrichment tables + 1 new table + 1 new view

---

## Architecture Overview

### Two-Level Insight System

**Level 1: Module-Level Insights**
- Added `insight`, `confidence_score`, `evidence_urls` columns to 12 enrichment tables
- Each table stores insights from ITS data source only
- Example: `company_traffic` has insights about bounce rate, mobile traffic, etc.

**Level 2: Company-Level Strategic Analysis**
- New table: `company_strategic_analysis`
- Synthesizes ALL module insights into Algolia value prop mapping
- Composite PK: `(company_id, audit_id)` links to audits table

---

## Tables Updated (Level 1)

1. `company_traffic` - SimilarWeb insights
2. `company_financials` - Financial insights
3. `company_technologies` - Tech stack insights
4. `company_competitors` - Competitive insights
5. `company_executives` - Executive background insights
6. `executive_quotes` - Quote-based insights
7. `company_social_profiles` - Social presence insights
8. `company_social_posts` - Social content insights
9. `buying_committee` - Buyer persona insights
10. `intent_signals` - Intent-based insights
11. `company_hiring` - Hiring signal insights
12. `search_audit_tests` - Browser test insights

**Columns added to each**:
```sql
insight TEXT
confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0)
evidence_urls TEXT[]
```

---

## New Table (Level 2)

### `company_strategic_analysis`

```sql
CREATE TABLE company_strategic_analysis (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,

  -- Algolia Value Prop Mapping
  primary_value_prop VARCHAR(100) NOT NULL,
  secondary_value_props VARCHAR(100)[] NOT NULL DEFAULT '{}',

  -- Sales Intelligence
  sales_pitch TEXT NOT NULL,
  business_impact TEXT NOT NULL,
  strategic_recommendations TEXT NOT NULL,

  -- Timing Intelligence
  trigger_events TEXT[] NOT NULL DEFAULT '{}',
  timing_signals TEXT[] NOT NULL DEFAULT '{}',
  caution_signals TEXT[] NOT NULL DEFAULT '{}',

  -- Metadata
  overall_confidence_score NUMERIC(3,1) NOT NULL CHECK (overall_confidence_score >= 8.0),
  insights_synthesized_from TEXT[] NOT NULL,
  analysis_generated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (company_id, audit_id),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);
```

**View**: `latest_strategic_analysis` (most recent analysis per company)

---

## How Linking Works

### Example: Get Costco's March 2026 Strategic Analysis

```sql
-- Get company-level strategic analysis
SELECT * FROM company_strategic_analysis
WHERE company_id = 'costco-uuid' AND audit_id = 'march-2026-uuid';

-- Get ALL module insights for this audit
SELECT 'traffic' as module, insight, confidence_score, evidence_urls
FROM company_traffic
WHERE company_id = 'costco-uuid' AND audit_id = 'march-2026-uuid'
UNION ALL
SELECT 'financials', insight, confidence_score, evidence_urls
FROM company_financials
WHERE company_id = 'costco-uuid' AND audit_id = 'march-2026-uuid'
UNION ALL
SELECT 'hiring', insight, confidence_score, evidence_urls
FROM company_hiring
WHERE company_id = 'costco-uuid' AND audit_id = 'march-2026-uuid';
```

### Relationship Diagram

```
companies (Costco)
  ↓ (1:many)
audits (March 2026, Feb 2026, Jan 2026...)
  ↓ (1:many)                              ↓ (1:1)
company_traffic                           company_strategic_analysis
company_financials                        ├─ primary_value_prop
company_hiring                            ├─ sales_pitch
search_audit_tests                        ├─ business_impact
...all module tables                      ├─ strategic_recommendations
                                          ├─ trigger_events
                                          └─ timing_signals
```

All linked via `(company_id, audit_id)` composite keys.

---

## Backend Implementation (Phase 1)

### Strategic Analysis Engine Service

**File**: `backend/services/strategic-analysis-engine.ts`

**Main function**: `synthesizeCompanyAnalysis(companyId, auditId)`

**Process** (mirrors Algolia Search Audit skill):

1. **Gather All Insights**
   - Query ALL enrichment tables with `WHERE company_id = X AND audit_id = Y`
   - Collect insights from traffic, financials, hiring, search audit, etc.

2. **Identify Primary Value Prop**
   - Map insights to Algolia value props (search_relevance, scale_performance, etc.)
   - Calculate severity × confidence score
   - Pick highest-scoring value prop

3. **Calculate Business Impact**
   - Quantify business impact (e.g., "$2.3M monthly revenue at risk")
   - Use financial data + traffic data for calculations

4. **Generate Sales Pitch**
   - Synthesize narrative from high-confidence insights
   - Map to Algolia solutions and case studies

5. **Extract Timing Intelligence**
   - Trigger events (earnings calls, hirings, tech changes)
   - Timing signals (why now)
   - Caution signals (layoffs, hiring freezes)

6. **Save to Database**
   - Insert into `company_strategic_analysis` table
   - Overall confidence = weighted average of module confidences

---

## Deployment

### Run Migration 008

```bash
cd data/migrations
supabase db push --file 008-add-strategic-insights.sql
```

### Verify

```sql
-- Check new columns exist
\d company_traffic

-- Check new table exists
\d company_strategic_analysis

-- Check new view exists
SELECT * FROM latest_strategic_analysis LIMIT 1;
```

---

## Documentation Updated

| File | Status | Changes |
|------|--------|---------|
| `data/migrations/008-add-strategic-insights.sql` | ✅ CREATED | New migration |
| `data/README.md` | ✅ UPDATED | Added migration 008 to structure and deployment |
| `data/DATABASE_EXPLAINED.md` | ✅ UPDATED | Added strategic insights architecture section |
| `README.md` | ✅ UPDATED | Updated total to 25 tables + 13 views |
| `memory/MEMORY.md` | ✅ UPDATED | Added March 7 strategic insights completion |

---

## File Organization (Root Cleanup)

### Files Moved

**To data/:**
- DATABASE_DESIGN_SUMMARY.md
- DATABASE_EXPLAINED.md
- DATABASE_UPDATES_MARCH6.md

**To docs/archive/:**
- CLEANUP_COMPLETE.md
- CLEANUP_PLAN.md
- DOCUMENTATION_AUDIT.md
- DOCUMENTATION_CLEANUP_REPORT.md
- DOCUMENTATION_STATUS_MARCH6.md
- HOUSEKEEPING_SUMMARY.md
- RESTRUCTURE_COMPLETE.md

**To backend/:**
- UPDATES_MARCH6_BROWSER_COPILOT.md

**To dashboard/:**
- dashboard.html
- executive-dashboard.html

**Deleted:**
- api-client.js (orphaned file)

### Clean Root Directory

**Files remaining at root (proper):**
- AGENT_HANDOFF.md ✓
- CLAUDE.md ✓
- README.md ✓
- START_HERE.md ✓
- docs-viewer.html ✓
- index.html ✓
- package.json / package-lock.json ✓
- vercel.json ✓

---

## Next Steps

**Week 1 Implementation**:
1. Run migration 008
2. Build Strategic Analysis Engine service
3. Integrate with enrichment pipeline
4. Test with Costco example data

**Pattern to follow**: Algolia Search Audit skill synthesis (Phase 4: Generate Report)

---

**Status**: ✅ Architecture Complete - Ready for Implementation
**Last Updated**: March 7, 2026, 11:00 PM
**Total Schema**: 25 tables, 13 views, 8 migrations, 1 seed file
