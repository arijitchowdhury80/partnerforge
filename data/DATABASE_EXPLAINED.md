# Database Architecture Explained

**Date**: March 6, 2026
**Status**: ✅ Final Design Approved

---

## 🎯 Quick Summary

**One sentence**: We use **composite primary keys** (company_id + audit_id) for all data tables to create point-in-time snapshots with automatic audit versioning.

**Why this matters**: When you re-run an audit 3 months later, you get a NEW snapshot without overwriting old data. Full audit history preserved automatically.

---

## 📂 File Structure

```
data/
├── migrations/          # 7 SQL files
│   ├── 001-create-core-tables.sql        # Companies, Users, Partner Tech, Audits
│   ├── 002-create-enrichment-tables.sql  # Traffic, Financials, Tech, etc. (11 tables)
│   ├── 003-create-partner-intel-tables.sql   # Displacement Opportunities
│   ├── 004-create-search-audit-tables.sql    # Browser Tests, Screenshots
│   ├── 005-create-activity-tables.sql    # Logging (audit_log, api_call_log, etc.)
│   ├── 006-create-views.sql             # "Latest" data views (12 views)
│   └── 007-create-indexes.sql           # Performance indexes
│
└── seeds/               # 3 SQL files
    ├── seed-partner-technologies.sql     # 15 technologies (AEM, Shopify, etc.)
    ├── seed-test-companies.sql           # 10 companies (Costco, Target, etc.)
    └── seed-test-users.sql               # 8 users (Admin, Managers, etc.)
```

---

## 🗄️ What Each Migration Does

### **Migration 001: Core Tables** (Foundation)

**Creates 4 master entity tables:**

1. **`companies`** - Company definitions
   - domain, name, industry, revenue, employee_count, etc.
   - Lightweight: Just company attributes, NO audit data

2. **`users`** - Application users
   - email, full_name, role (admin/manager/analyst/viewer)
   - Synced with Supabase Auth

3. **`partner_technologies`** - Master list of 15 technologies
   - Adobe AEM, Shopify Plus, Contentful, etc.
   - The technologies we track for displacement opportunities

4. **`audits`** - Audit execution records (THE BRIDGE TABLE)
   - Links companies to data snapshots
   - audit_type: 'partner-intel' | 'search-audit'
   - status: 'pending' | 'running' | 'completed' | 'failed'
   - **CRITICAL**: Has `UNIQUE (company_id, id)` constraint for composite FKs

**Why needed**: These are the foundation. Everything else references these.

---

### **Migration 002: Enrichment Tables** (Data Snapshots)

**Creates 11 data tables, ALL using composite PK:**

1. **`company_traffic`** - SimilarWeb traffic data
   - `PRIMARY KEY (company_id, audit_id, month)`
   - monthly_visits, bounce_rate, traffic_sources, etc.

2. **`company_financials`** - Yahoo Finance / SEC Edgar
   - `PRIMARY KEY (company_id, audit_id, fiscal_year, fiscal_quarter)`
   - revenue, net_income, EBITDA, etc.

3. **`company_technologies`** - BuiltWith tech stack
   - `PRIMARY KEY (company_id, audit_id, technology_name)`
   - What technologies the company uses

4. **`company_competitors`** - SimilarWeb competitors
   - `PRIMARY KEY (company_id, audit_id, competitor_domain)`
   - Who competes with this company

5. **`company_executives`** - Apollo.io / LinkedIn execs
   - `PRIMARY KEY (company_id, audit_id, full_name)`
   - CEO, CFO, CTO, VP Data, etc.

6. **`executive_quotes`** - SEC filings / earnings calls
   - `PRIMARY KEY (company_id, audit_id, executive_name, source_type, source_date)`
   - "In Their Own Words" - investor intelligence

7. **`company_social_profiles`** - Apify LinkedIn scraper
   - `PRIMARY KEY (company_id, audit_id, platform)`
   - Follower count, engagement rate, post frequency

8. **`company_social_posts`** - Social media posts
   - `PRIMARY KEY (company_id, audit_id, platform, post_url)`
   - Individual posts for engagement analysis

9. **`buying_committee`** - Apollo.io buying committee
   - `PRIMARY KEY (company_id, audit_id, full_name)`
   - Decision makers, influencers, blockers

10. **`intent_signals`** - Apollo.io intent signals
    - `PRIMARY KEY (company_id, audit_id, signal_type, signal_description)`
    - Job postings, tech installs, funding rounds

11. **`company_hiring`** - Apify LinkedIn jobs scraper
    - `PRIMARY KEY (company_id, audit_id, job_title, posted_date)`
    - Open roles, hiring signals

**Why composite PK**: Each audit creates a NEW snapshot. Same company, different audit = different row.

---

### **Migration 003: Partner Intelligence** (Existing Feature)

**Creates 2 tables for Partner Intelligence feature:**

1. **`displacement_opportunities`** - Displacement targets
   - `PRIMARY KEY (company_id, audit_id, partner_tech_id)`
   - **Scores per audit**: fit_score, intent_score, value_score, displacement_score
   - **Status**: hot/warm/cold/engaged/won/lost
   - **Sales fields**: assigned_to, estimated_annual_value, next_action

2. **`partner_engagement_log`** - Sales activity tracking
   - Regular PK (NOT audit-scoped)
   - engagement_type: 'email_sent' | 'call_made' | 'demo_scheduled' | 'contract_signed'
   - Tracks: who contacted company, when, outcome

**Why needed**: This is your **existing production feature**. Without this, Partner Intelligence doesn't work!

---

### **Migration 004: Search Audit** (New Feature)

**Creates 2 tables for Search Audit feature:**

1. **`search_audit_tests`** - Browser test results
   - `PRIMARY KEY (company_id, audit_id, test_name)`
   - test_name: 'homepage_search' | 'mobile_facets' | 'nlp_query'
   - passed, score (0-10), severity (high/medium/low)
   - finding_summary, finding_details (JSONB)

2. **`search_audit_screenshots`** - Test screenshots
   - `PRIMARY KEY (company_id, audit_id, test_name, sequence_number)`
   - file_path, width, height, caption

**Why needed**: This is the **new feature** you're building. Without this, Search Audit doesn't work!

---

### **Migration 005: Activity Tables** (Logging & Tracking)

**Creates 5 logging/tracking tables (NOT audit-scoped):**

1. **`audit_log`** - Who did what, when
   - Regular PK (NOT composite)
   - action_type: 'audit_created' | 'audit_deleted' | 'company_added'
   - Tracks: actor_id, old_value, new_value, IP address

2. **`api_call_log`** - API cost tracking + debugging
   - provider: 'similarweb' | 'builtwith' | 'apollo'
   - cost_usd, response_time_ms, was_cached
   - **Critical for cost monitoring**: "How much did we spend on SimilarWeb?"

3. **`api_error_log`** - API failures
   - error_type: 'rate_limit' | 'timeout' | 'auth_failed'
   - retry_count, will_retry, next_retry_at
   - **Critical for debugging**: "Why did that audit fail?"

4. **`data_freshness`** - When should we refresh data?
   - last_fetched_at, next_refresh_at, is_stale
   - **Critical for cost optimization**: Avoid redundant API calls

5. **`enrichment_cache`** - 7-day API response cache
   - Persistent storage for Redis cache
   - **Critical for cost savings**: 86% cache hit rate = $219K/year savings

**Why needed**: Without these:
- ❌ No security audit trail (who did what?)
- ❌ No cost visibility ($219K/year in API costs - how much spent?)
- ❌ No debugging (why did audit fail?)
- ❌ No cache optimization (wasting money)

---

### **Migration 006: Views** (Query Simplification)

**Creates 12 views for "latest" data:**

- `latest_audits` - Most recent audit per company
- `company_traffic_latest` - Latest traffic data
- `company_financials_latest` - Latest financials
- `company_technologies_latest` - Latest tech stack
- `company_competitors_latest` - Latest competitors
- `company_executives_latest` - Latest executives
- `company_social_profiles_latest` - Latest social profiles
- `buying_committee_latest` - Latest buying committee
- `company_hiring_latest` - Latest hiring data
- `displacement_opportunities_latest` - Latest opportunities (with company + partner tech details)
- `search_audit_tests_latest` - Latest test results
- `company_overview` - Dashboard summary (company + latest audit + key metrics)

**Why needed**: Simplifies 90% of queries from complex JOINs to simple SELECTs.

**Example**:
```sql
-- Without view (complex):
SELECT DISTINCT ON (t.company_id, t.month) t.*
FROM company_traffic t
JOIN audits a ON t.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY t.company_id, t.month, a.created_at DESC;

-- With view (simple):
SELECT * FROM company_traffic_latest WHERE company_id = 'costco-id';
```

---

### **Migration 007: Indexes** (Performance)

**Creates performance indexes:**

- Composite indexes for common query patterns
- GIN indexes for JSONB columns (fast search on finding_details)
- Partial indexes for common filters (failed audits, running audits, hot opportunities)
- Covering indexes to avoid table lookups

**Why needed**: Without indexes, queries on 10K+ audits will be slow (seconds vs milliseconds).

---

## 🌱 What Each Seed Does

### **Seed: Partner Technologies** 🤝

**Loads 15 partner technologies:**

**Commerce (6):**
- Shopify Plus, Adobe Commerce (Magento), Salesforce Commerce Cloud
- BigCommerce, commercetools, Spryker

**CMS (5):**
- Adobe Experience Manager (AEM), Contentful, Contentstack
- Amplience, Sitecore

**MarTech (4):**
- Salesforce Marketing Cloud, Marketo, HubSpot, Klaviyo

**Why needed**: Without this, `displacement_opportunities` table has nothing to reference. **Partner Intelligence feature only!**

**This is from your Feb 28 decision**: 15 technologies (NOT search competitors like Coveo).

**Note**: Search Audit feature does NOT use this table. Search Audit gets tech stack from BuiltWith API dynamically and stores in `company_technologies` table.

---

## 📝 No Test Data Seeded

**Companies**: No test companies seeded. Real company audits will populate the database.

**Users**: No test users seeded. Real users from Supabase Auth will populate the database.

---

## 🔑 Key Concepts

### **1. Composite Primary Key Pattern**

Every data table uses: `PRIMARY KEY (company_id, audit_id, <domain_key>)`

**Example**:
```sql
-- Traffic data
PRIMARY KEY (company_id, audit_id, month)

-- Tech stack
PRIMARY KEY (company_id, audit_id, technology_name)

-- Search tests
PRIMARY KEY (company_id, audit_id, test_name)
```

### **2. Point-in-Time Snapshots**

When you run Audit #2, you DON'T UPDATE old data. You INSERT new rows:

```sql
-- June 2025: Audit #1
INSERT INTO company_traffic VALUES ('costco', 'audit-1', '2025-06', 2.5M);

-- Dec 2025: Audit #2 (NEW ROW, not UPDATE)
INSERT INTO company_traffic VALUES ('costco', 'audit-2', '2025-06', 3.1M);

-- Result: Full history preserved!
```

### **3. Automatic Cascade Deletion**

Delete an audit → all data deleted automatically:

```sql
DELETE FROM audits WHERE id = 'audit-1';
-- CASCADE deletes from:
-- - company_traffic
-- - company_financials
-- - company_technologies
-- - displacement_opportunities
-- - search_audit_tests
-- ... all 14 data tables
```

---

## 📊 Total Schema Size

- **25 tables** (24 original + 1 strategic analysis)
- **13 views** (12 original + 1 latest strategic analysis)
- **~55 indexes**
- **Seeded data**: 15 partner technologies (Partner Intelligence feature only)

---

## 🚀 Deployment

See [data/README.md](data/README.md) for complete deployment instructions.

---

## 💡 Strategic Insights Architecture (Migration 008)

### **Two-Level Insight System**

**Level 1: Module-Level Insights** (in enrichment tables)
- Each enrichment table (company_traffic, company_financials, etc.) has insight columns
- Stores insights from THAT specific data source only
- Columns added: `insight`, `confidence_score`, `evidence_urls`

**Level 2: Company-Level Analysis** (synthesized)
- New table: `company_strategic_analysis`
- Reads ALL module insights and synthesizes Algolia value prop mapping
- Composite PK: `(company_id, audit_id)` links to audits table

### **How Linking Works**

```sql
-- Get Costco's March 2026 strategic analysis
SELECT * FROM company_strategic_analysis
WHERE company_id = 'costco-uuid' AND audit_id = 'march-2026-uuid';

-- Get ALL module insights for same audit
SELECT 'traffic' as module, insight FROM company_traffic
WHERE company_id = 'costco-uuid' AND audit_id = 'march-2026-uuid'
UNION ALL
SELECT 'financials', insight FROM company_financials
WHERE company_id = 'costco-uuid' AND audit_id = 'march-2026-uuid';
```

**Relationship**:
```
companies (Costco)
  ↓ (1:many)
audits (March 2026, Feb 2026...)
  ↓ (1:many)                    ↓ (1:1)
company_traffic                 company_strategic_analysis
company_financials              (synthesized from ALL modules)
company_hiring
search_audit_tests
```

All linked via `(company_id, audit_id)` composite keys.

### **Synthesis Pattern (Like Algolia Search Audit Skill)**

1. **Data Collection** → Module insights populated during enrichment
2. **Synthesis** → Strategic Analysis Engine reads all modules and generates:
   - Primary Algolia value prop (search_relevance, scale_performance, etc.)
   - Sales pitch with quantified business impact
   - Strategic recommendations ("How Algolia Can Help")
   - Trigger events and timing signals

**Backend Service**: `backend/services/strategic-analysis-engine.ts`

---

**Last Updated**: March 7, 2026
**Owner**: Backend Team
