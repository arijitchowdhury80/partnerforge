# Database Design - Complete Summary

**Date**: March 6, 2026
**Status**: ✅ Approved and Documented

---

## 🎯 What I Created

### **7 Migration Files** → `data/migrations/`

1. **001-create-core-tables.sql** - Companies, Users, Partner Technologies, Audits (4 tables)
2. **002-create-enrichment-tables.sql** - Traffic, Financials, Tech, Competitors, Executives, Social, Hiring (11 tables)
3. **003-create-partner-intel-tables.sql** - Displacement Opportunities, Engagement Log (2 tables)
4. **004-create-search-audit-tables.sql** - Browser Tests, Screenshots (2 tables)
5. **005-create-activity-tables.sql** - Logging: audit_log, api_call_log, api_error_log, data_freshness, enrichment_cache (5 tables)
6. **006-create-views.sql** - 12 views for "latest" data queries
7. **007-create-indexes.sql** - Performance indexes

### **3 Seed Files** → `data/seeds/`

1. **seed-partner-technologies.sql** - 15 technologies (Adobe AEM, Shopify Plus, etc.)
2. **seed-test-companies.sql** - 10 companies (Costco, Target, Walmart, etc.)
3. **seed-test-users.sql** - 8 users (Admin, Managers, Analysts, Viewers)

### **Documentation**

1. **[DATABASE_EXPLAINED.md](DATABASE_EXPLAINED.md)** - Complete explanation of database design
2. **[data/README.md](data/README.md)** - Database schema reference (updated)
3. **[README.md](README.md)** - Root README (updated with database info)
4. **[START_HERE.md](START_HERE.md)** - Quick start guide (updated)

---

## 📊 Final Database Schema

**24 Tables** organized in 5 tiers:

### **Tier 1: Master Entities** (3 tables)
- `companies` - Company definitions
- `partner_technologies` - 15 partner technologies
- `users` - Application users

### **Tier 2: Audits** (1 table)
- `audits` - Audit execution records (bridge table)

### **Tier 3: Enrichment Data** (11 tables with composite PK)
- `company_traffic` - SimilarWeb data
- `company_financials` - Yahoo Finance / SEC Edgar
- `company_technologies` - BuiltWith tech stack
- `company_competitors` - SimilarWeb competitors
- `company_executives` - Apollo.io / LinkedIn
- `executive_quotes` - SEC filings / earnings calls
- `company_social_profiles` - Apify LinkedIn scraper
- `company_social_posts` - Social media posts
- `buying_committee` - Apollo.io buying committee
- `intent_signals` - Apollo.io intent signals
- `company_hiring` - Apify LinkedIn jobs

### **Tier 4: Features** (4 tables with composite PK)
- `displacement_opportunities` - Partner Intelligence feature
- `partner_engagement_log` - Sales activity tracking
- `search_audit_tests` - Search Audit feature
- `search_audit_screenshots` - Test screenshots

### **Tier 5: Activity Logs** (5 tables, NOT audit-scoped)
- `audit_log` - Who did what when
- `api_call_log` - API cost tracking
- `api_error_log` - Error debugging
- `data_freshness` - Refresh tracking
- `enrichment_cache` - 7-day cache

**Plus**: 12 views for "latest" data queries

---

## 🔑 Key Design Decisions

### **1. Composite Primary Keys**

All enrichment data tables use: `PRIMARY KEY (company_id, audit_id, <domain_key>)`

**Example**:
```sql
-- Traffic data
CREATE TABLE company_traffic (
  company_id UUID,
  audit_id UUID,
  month DATE,
  monthly_visits BIGINT,
  ...
  PRIMARY KEY (company_id, audit_id, month),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);
```

**Why**: Automatic audit versioning. Each audit creates new rows without overwriting old data.

### **2. Point-in-Time Snapshots**

When you run Audit #2, you INSERT new rows, you DON'T UPDATE old data:

```sql
-- June 2025: Audit #1
INSERT INTO company_traffic VALUES ('costco-id', 'audit-1', '2025-06-01', 2500000);

-- Dec 2025: Audit #2 (NEW ROW)
INSERT INTO company_traffic VALUES ('costco-id', 'audit-2', '2025-06-01', 3100000);

-- Result: Full history preserved!
```

### **3. Automatic Cascade Deletion**

Delete audit → all data deleted automatically:

```sql
DELETE FROM audits WHERE id = 'audit-1';
-- CASCADE deletes from all 14 data tables automatically
```

### **4. Views for "Latest" Data**

Simplifies 90% of queries:

```sql
-- Without view (complex):
SELECT DISTINCT ON (t.company_id, t.month) t.*
FROM company_traffic t
JOIN audits a ON t.audit_id = a.id
ORDER BY t.company_id, t.month, a.created_at DESC;

-- With view (simple):
SELECT * FROM company_traffic_latest WHERE company_id = 'costco-id';
```

---

## 📋 File-by-File Explanation

### **Migration 003: Partner Intelligence**

**What**: Creates tables for Partner Intelligence feature (existing production feature)

**Why needed**: Without this, Partner Intelligence doesn't work! This is your core feature.

**Tables**:
- `displacement_opportunities` - Companies using partner tech who could be displaced
- `partner_engagement_log` - Sales activity tracking

### **Migration 005: Activity Tables**

**What**: Creates logging and tracking tables (NOT the audits table - that's in 001)

**Why needed**: Without these, you have no visibility into:
- Who did what (security)
- API costs ($219K/year - how much spent?)
- Why audits fail (debugging)
- Cache optimization (wasting money?)

**Tables**:
- `audit_log` - User activity tracking
- `api_call_log` - API cost tracking
- `api_error_log` - Error debugging
- `data_freshness` - Refresh tracking
- `enrichment_cache` - 7-day API response cache

### **Seed: Partner Technologies** (Partner Intelligence Feature Only)

**What**: Pre-loads 15 partner technologies (Adobe AEM, Shopify Plus, etc.)

**Why needed**: Without this, `displacement_opportunities` has nothing to reference. **Partner Intelligence feature only!**

**Note**: Search Audit feature does NOT use this. Search Audit gets tech stack from BuiltWith API dynamically.

**This is from your Feb 28 decision**: 15 technologies (NOT search competitors).

---

### **No Test Data Seeded**

**Companies**: No test companies seeded. Real company audits will populate the database.

**Users**: No test users seeded. Real users from Supabase Auth will populate the database.

---

## 🚀 How to Deploy

### **Option 1: Supabase CLI** (Recommended)

```bash
# Run migrations
cd data/migrations
supabase db push --file 001-create-core-tables.sql
supabase db push --file 002-create-enrichment-tables.sql
supabase db push --file 003-create-partner-intel-tables.sql
supabase db push --file 004-create-search-audit-tables.sql
supabase db push --file 005-create-activity-tables.sql
supabase db push --file 006-create-views.sql
supabase db push --file 007-create-indexes.sql

# Run seed (Partner Intelligence feature only)
cd ../seeds
supabase db execute --file seed-partner-technologies.sql
```

### **Option 2: Supabase Dashboard** (Visual)

1. Go to https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/editor
2. Click "SQL Editor"
3. Copy/paste each file
4. Run in order (001 → 007, then seeds)

---

## ✅ Verification Checklist

After deployment, verify:

1. **All 24 tables created** - Check Supabase Table Editor
2. **All 12 views created** - Run `SELECT * FROM latest_audits`
3. **15 partner technologies** - `SELECT COUNT(*) FROM partner_technologies` = 15
4. **Composite FKs work** - Try inserting real company audit data
5. **Views return data** - `SELECT * FROM company_overview`

---

## 📖 Complete Documentation

| Document | Purpose |
|----------|---------|
| **[DATABASE_EXPLAINED.md](DATABASE_EXPLAINED.md)** | Complete database guide (migrations, seeds, design explained) |
| **[data/README.md](data/README.md)** | Database schema reference (24 tables, 12 views, query examples) |
| **[START_HERE.md](START_HERE.md)** | Quick start guide (updated with database info) |
| **[README.md](README.md)** | Root README (updated with database info) |
| **[docs-viewer.html](docs-viewer.html)** | HTML documentation viewer (will be updated next) |

---

## 🎯 Benefits of This Design

| Benefit | Description |
|---------|-------------|
| **Natural Versioning** | audit_id is part of PK → automatic versioning |
| **No Duplicates** | PK prevents duplicate rows per audit |
| **Clean Deletion** | DELETE audit → CASCADE deletes all data |
| **Query Clarity** | Schema self-documents audit-scoped data |
| **Historical Queries** | Easy to query "What was traffic 3 months ago?" |
| **JOIN Simplicity** | Composite FK ensures audit belongs to company |
| **Type Safety** | Database enforces relationships |
| **Performance** | Indexes optimize common queries |
| **Maintainability** | Clear separation of concerns |
| **Extensibility** | Add new data tables easily |

---

## 🚧 What's Next

**Your Questions Answered:**

1. ✅ **003-create-partner-intel-tables.sql** - Partner Intelligence feature (displacement opportunities)
2. ✅ **005-create-activity-tables.sql** - Logging tables (NOT the audits table)
3. ✅ **seed-partner-technologies.sql** - 15 technologies (Partner Intelligence feature only)
4. ❌ **seed-test-companies** - REMOVED (real company audits will populate database)
5. ❌ **seed-test-users** - REMOVED (real users from Supabase Auth)

**Documentation Updated:**

1. ✅ **[DATABASE_EXPLAINED.md](DATABASE_EXPLAINED.md)** - Created
2. ✅ **[data/README.md](data/README.md)** - Updated with composite key design
3. ✅ **[README.md](README.md)** - Updated with database section
4. ✅ **[START_HERE.md](START_HERE.md)** - Updated with database links
5. ⏭️ **[docs-viewer.html](docs-viewer.html)** - Need to add database section

**Next Steps:**

1. Should I update **docs-viewer.html** to include database documentation?
2. Ready to discuss **Implementation Roadmap** next?
3. Ready to discuss **Logging mechanism** next?
4. Ready to discuss **UI/UX** next?

---

**Status**: ✅ Database Design Complete and Documented
**Last Updated**: March 6, 2026
