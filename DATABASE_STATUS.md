# Database Status

**Last Updated:** March 7, 2026, 4:20 AM
**Status:** ✅ **PRODUCTION READY**

---

## Current State

### Database
- **Platform:** Supabase PostgreSQL 15
- **Project ID:** xbitqeejsgqnwvxlnjra
- **Region:** us-east-2
- **Connection:** Pooler (port 6543)

### Data
- **Companies (Algolia Arian):** 0 (empty - will be populated when users run audits)
- **Companies (PartnerForge):** 14,614 (in `companies_old` table - separate application)
- **Tables:** 41 total (26 new schema + 15 legacy)
- **Indexes:** 135
- **Views:** 4

### Schema Version
- **Migrations Applied:** 001-008 (all complete)
- **Latest:** Migration 008 (Strategic Insights Architecture)

---

## Important: Two Separate Applications

### Algolia Arian (Search Audit SaaS)
- **Companies Table:** `companies` - **EMPTY** (correct state)
- **Purpose:** Search audit platform - companies created when audits are run
- **Schema:** Full unified schema (26 tables)

### PartnerForge (Partner Intelligence)
- **Companies Table:** `companies_old` - 14,614 companies (legacy data)
- **Purpose:** Partner displacement opportunities
- **Status:** Separate application, data preserved in old tables

**DO NOT MIX DATA BETWEEN APPLICATIONS**

---

## Schema Overview

### Core Tables (4)
1. `companies` - **EMPTY** (Algolia Arian - will be populated by audits)
2. `users` - Application users
3. `partner_technologies` - Partner tech catalog
4. `audits` - Audit execution records

### Enrichment Tables (11)
All have strategic insight columns (insight, confidence_score, evidence_urls):
1. `company_traffic` - SimilarWeb metrics
2. `company_financials` - Yahoo Finance data
3. `company_technologies` - BuiltWith tech stack
4. `company_competitors` - Competitive analysis
5. `company_executives` - Executive profiles
6. `executive_quotes` - SEC/earnings quotes
7. `company_social_profiles` - Social accounts
8. `company_social_posts` - Social content
9. `buying_committee` - Decision makers
10. `intent_signals` - Apollo intent data
11. `company_hiring` - Job postings

### Partner Intelligence Tables (2)
1. `displacement_opportunities` - Co-sell targets
2. `partner_engagement_log` - Activity tracking

### Search Audit Tables (3)
1. `search_audit_tests` - Browser test results (+ insights)
2. `search_test_queries` - Test query library
3. `audit_deliverables` - Generated reports

### Activity Tables (5)
1. `audit_log` - User activity
2. `api_call_log` - API cost tracking
3. `api_error_log` - Error monitoring
4. `data_freshness` - Cache tracking
5. `enrichment_cache` - 7-day API cache

### Strategic Analysis Table (1)
1. `company_strategic_analysis` - Company-level synthesis

### Views (4)
1. `latest_strategic_analysis` - Latest company analysis
2. (3 additional views from legacy migrations)

---

## Migration 008: Strategic Insights

### What Changed
- **12 tables modified** - Added insight columns to all enrichment tables
- **1 new table** - `company_strategic_analysis` created
- **1 new view** - `latest_strategic_analysis` created
- **1 column added** - `overall_search_score` in `audits` table

### Insight Columns (added to 12 tables)
- `insight` (TEXT) - Strategic insight from data module
- `confidence_score` (NUMERIC 8.0-10.0) - Validation confidence
- `evidence_urls` (TEXT[]) - Source URLs

---

## Connection Details

### REST API (Supabase Client)
```bash
SUPABASE_URL=https://xbitqeejsgqnwvxlnjra.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Direct Database (Pooler)
```bash
DATABASE_URL=postgresql://postgres.xbitqeejsgqnwvxlnjra:@lG)l!a2025@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```

---

## Health Status

### ✅ Healthy
- All migrations applied successfully
- Schema complete (41 tables, 135 indexes, 4 views)
- Companies table correctly EMPTY (will be populated by user audits)
- PartnerForge data preserved in `companies_old` (14,614 records)

### ⚠️ Warnings
- Legacy PartnerForge tables exist (`companies_old` and others)
- Keep separate - do NOT mix with Algolia Arian data

---

## Verification Queries

### Check Company Count (Should be 0)
```sql
SELECT COUNT(*) FROM companies;
-- Expected: 0
```

### Check PartnerForge Data (Should be 14,614)
```sql
SELECT COUNT(*) FROM companies_old;
-- Expected: 14614
```

### Check Tables
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
-- Expected: 41
```

---

**Status:** ✅ **PRODUCTION READY**
**Companies Table:** **EMPTY** (correct state for Algolia Arian)
**Next:** Start Phase 1 Backend Development
