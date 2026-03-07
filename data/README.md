# Algolia-Arian Database

**Purpose**: Database schema, migrations, and seeds
**Database**: PostgreSQL (Supabase)
**Architecture**: Composite key design with audit versioning
**Status**: ✅ Ready for Week 1 Implementation

---

## 📂 Structure

```
data/
├── migrations/          # SQL migration scripts (versioned)
│   ├── 001-create-core-tables.sql
│   ├── 002-create-enrichment-tables.sql
│   ├── 003-create-partner-intel-tables.sql
│   ├── 004-create-search-audit-tables.sql
│   ├── 005-create-activity-tables.sql
│   ├── 006-create-views.sql
│   ├── 007-create-indexes.sql
│   └── 008-add-strategic-insights.sql
│
├── seeds/               # Seed data
│   └── seed-partner-technologies.sql  # Partner Intelligence feature only (15 technologies)
│
├── DATABASE_DESIGN_SUMMARY.md   # Database design summary
├── DATABASE_EXPLAINED.md         # Complete database guide
└── DATABASE_UPDATES_MARCH6.md   # March 6 updates summary
```

---

## 🎯 Database Architecture: Composite Key Design

### **Core Principle**

```
companies (1) ←──→ (many) audits
                      ↓
              composite PK in all data tables
              (company_id + audit_id + domain_key)
                      ↓
              Point-in-time snapshots
```

**One company, many audits. Each audit creates new rows in data tables.**

---

## 🗄️ Table Categories

### **Tier 1: Master Entities** (NO composite key)

Tables that define core entities:

```sql
-- Companies (entity attributes only)
companies (id, domain, name, industry, revenue, ...)

-- Partner Technologies (master list)
partner_technologies (id, name, category, vendor, ...)

-- Users (application users)
users (id, email, full_name, role, ...)
```

### **Tier 2: Audits** (Bridge Table)

Links companies to data snapshots:

```sql
audits (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  audit_type VARCHAR(50), -- 'partner-intel' | 'search-audit'
  status VARCHAR(50),     -- 'pending' | 'running' | 'completed' | 'failed'
  overall_score NUMERIC(3,1),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  ...
  CONSTRAINT audits_company_id_unique UNIQUE (company_id, id) -- CRITICAL for composite FKs
)
```

### **Tier 3: Audit-Scoped Data** (WITH composite key)

All enrichment data uses composite PK:

```sql
-- Traffic Data
company_traffic (
  company_id UUID,
  audit_id UUID,
  month DATE,
  monthly_visits BIGINT,
  ...
  PRIMARY KEY (company_id, audit_id, month),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
)

-- Financials
company_financials (
  company_id UUID,
  audit_id UUID,
  fiscal_year INTEGER,
  fiscal_quarter INTEGER,
  revenue NUMERIC(15,2),
  ...
  PRIMARY KEY (company_id, audit_id, fiscal_year, fiscal_quarter)
)

-- Tech Stack
company_technologies (
  company_id UUID,
  audit_id UUID,
  technology_name VARCHAR(100),
  ...
  PRIMARY KEY (company_id, audit_id, technology_name)
)

-- ... and 11 more enrichment tables
```

**All use same pattern**: `(company_id, audit_id, <domain_key>)`

### **Tier 4: Activity Logs** (audit_id as regular FK)

Activity tables that are NOT audit-scoped:

```sql
-- Audit Log (who did what)
audit_log (id UUID PRIMARY KEY, actor_id, action_type, ...)

-- API Call Log (cost tracking)
api_call_log (id UUID PRIMARY KEY, provider, endpoint, cost_usd, audit_id, ...)

-- API Error Log (debugging)
api_error_log (id UUID PRIMARY KEY, provider, error_type, audit_id, ...)
```

---

## 🔄 Audit Versioning: How It Works

### **Example: Costco audited 3 times**

```sql
-- June 2025: First audit
INSERT INTO audits VALUES ('audit-1', 'costco-id', ...);
INSERT INTO company_traffic VALUES ('costco-id', 'audit-1', '2025-06-01', 2500000);
INSERT INTO company_financials VALUES ('costco-id', 'audit-1', 2025, NULL, 254000000000);

-- December 2025: Second audit (NEW ROWS)
INSERT INTO audits VALUES ('audit-2', 'costco-id', ...);
INSERT INTO company_traffic VALUES ('costco-id', 'audit-2', '2025-06-01', 3100000); -- Same month, new audit
INSERT INTO company_financials VALUES ('costco-id', 'audit-2', 2025, 4, 268000000000); -- Q4 added

-- June 2026: Third audit (NEW ROWS)
INSERT INTO audits VALUES ('audit-3', 'costco-id', ...);
INSERT INTO company_traffic VALUES ('costco-id', 'audit-3', '2025-06-01', 3300000); -- Same month, 3rd audit
INSERT INTO company_financials VALUES ('costco-id', 'audit-3', 2026, NULL, 275000000000); -- 2026 annual
```

**Result**: Full history preserved. Each audit is a point-in-time snapshot.

---

## 📊 Views for "Latest" Data

Simplify queries for "current state" vs "historical state":

```sql
-- Latest audit per company
CREATE VIEW latest_audits AS
SELECT DISTINCT ON (company_id) *
FROM audits
WHERE deleted_at IS NULL
ORDER BY company_id, created_at DESC;

-- Latest traffic data
CREATE VIEW company_traffic_latest AS
SELECT DISTINCT ON (t.company_id, t.month)
  t.*, a.created_at as audit_date
FROM company_traffic t
JOIN audits a ON t.audit_id = a.id
ORDER BY t.company_id, t.month, a.created_at DESC;

-- ... 10 more views for other tables
```

**Usage**:
```sql
-- Get Costco's current traffic
SELECT * FROM company_traffic_latest WHERE company_id = 'costco-id';

-- Get Costco's traffic history across audits
SELECT a.created_at, t.monthly_visits
FROM company_traffic t
JOIN audits a ON t.audit_id = a.id
WHERE t.company_id = 'costco-id' AND t.month = '2025-06-01'
ORDER BY a.created_at;
```

---

## 📈 Complete Table List (21 Tables)

### **Master Entities (3)**
1. `companies` - Company definitions
2. `partner_technologies` - Partner tech master list
3. `users` - Application users

### **Audits (1)**
4. `audits` - Audit execution records

### **Enrichment Data (11)** - All use composite PK
5. `company_traffic` - SimilarWeb traffic data
6. `company_financials` - Yahoo Finance / SEC Edgar
7. `company_technologies` - BuiltWith tech stack
8. `company_competitors` - SimilarWeb competitors
9. `company_executives` - Apollo.io / LinkedIn execs
10. `executive_quotes` - SEC filings / earnings calls
11. `company_social_profiles` - Apify LinkedIn scraper
12. `company_social_posts` - Social media posts
13. `buying_committee` - Apollo.io buying committee
14. `intent_signals` - Apollo.io intent signals
15. `company_hiring` - Apify LinkedIn jobs

### **Partner Intelligence (2)** - Use composite PK
16. `displacement_opportunities` - Displacement scores per audit
17. `partner_engagement_log` - Sales activity (NOT audit-scoped)

### **Search Audit (2)** - Use composite PK
18. `search_audit_tests` - Browser test results
19. `search_audit_screenshots` - Test screenshots

### **Activity Logs (4)** - NOT audit-scoped
20. `audit_log` - Who did what when
21. `api_call_log` - API call tracking
22. `api_error_log` - Error tracking
23. `data_freshness` - Data refresh tracking
24. `enrichment_cache` - 7-day API response cache

---

## 🚀 Running Migrations

### **Using Supabase CLI** (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref xbitqeejsgqnwvxlnjra

# Run all migrations
cd data/migrations
for file in *.sql; do
  supabase db push --file $file
done

# Run seeds
cd ../seeds
for file in *.sql; do
  supabase db execute --file $file
done
```

### **Using psql** (Manual)

```bash
# Connect to Supabase
psql $DATABASE_URL

# Run migrations in order
\i data/migrations/001-create-core-tables.sql
\i data/migrations/002-create-enrichment-tables.sql
\i data/migrations/003-create-partner-intel-tables.sql
\i data/migrations/004-create-search-audit-tables.sql
\i data/migrations/005-create-activity-tables.sql
\i data/migrations/006-create-views.sql
\i data/migrations/007-create-indexes.sql
\i data/migrations/008-add-strategic-insights.sql

# Run seed (Partner Intelligence feature only)
\i data/seeds/seed-partner-technologies.sql
```

---

## ✅ Benefits of Composite Key Design

| Benefit | Description |
|---------|-------------|
| **Natural Versioning** | Audit ID is part of PK → automatic versioning |
| **No Duplicates** | PK prevents duplicate rows per audit |
| **Clean Deletion** | DELETE audit → CASCADE deletes all data automatically |
| **Query Clarity** | Schema self-documents that data is audit-scoped |
| **Historical Queries** | Easy to query "What was traffic 3 months ago?" |
| **JOIN Simplicity** | Composite FK ensures audit belongs to company |

---

## 🔐 Security

### **Row-Level Security (RLS)**

```sql
-- Enable RLS on audits
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Users can only see audits they created
CREATE POLICY "Users can view own audits"
  ON audits FOR SELECT
  USING (created_by = auth.uid());

-- Admins can see all
CREATE POLICY "Admins can view all audits"
  ON audits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 📊 Performance Optimization

### **Indexes**

- Composite indexes for common queries
- GIN indexes for JSONB columns
- Partial indexes for common filters (e.g., `WHERE status = 'failed'`)
- Covering indexes to avoid table lookups

See `007-create-indexes.sql` for complete list.

### **Partitioning** (Future, at scale)

```sql
-- Partition audits by month (when >1M audits)
CREATE TABLE audits_2026_03 PARTITION OF audits
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

---

## 📝 Example Queries

### **Get Latest Data**

```sql
-- Costco's current traffic
SELECT * FROM company_traffic_latest
WHERE company_id = (SELECT id FROM companies WHERE domain = 'costco.com');

-- All hot leads (score >= 8.0)
SELECT * FROM displacement_opportunities_latest
WHERE overall_score >= 8.0;
```

### **Get Historical Data**

```sql
-- Costco's traffic over time
SELECT
  a.created_at as audit_date,
  t.monthly_visits
FROM company_traffic t
JOIN audits a ON t.audit_id = a.id
JOIN companies c ON t.company_id = c.id
WHERE c.domain = 'costco.com'
  AND t.month = '2025-06-01'
ORDER BY a.created_at;
```

### **Compare Audits**

```sql
-- Compare Audit #1 vs Audit #2
SELECT
  'audit-1' as audit,
  monthly_visits as visits
FROM company_traffic
WHERE company_id = 'costco-id' AND audit_id = 'audit-1' AND month = '2025-06-01'

UNION ALL

SELECT
  'audit-2' as audit,
  monthly_visits as visits
FROM company_traffic
WHERE company_id = 'costco-id' AND audit_id = 'audit-2' AND month = '2025-06-01';
```

---

## 🔗 Related Documentation

- [Backend README](../backend/README.md) - Server setup and API layer
- [Architecture Approved](../docs/features/search-audit/ARCHITECTURE_APPROVED.md) - Why composite keys?
- [Master Plan](../docs/features/search-audit/MASTER_PLAN.md) Ch 4 - Database chapter

---

## 📦 Seeded Data

After running seeds, you'll have:

- **15 partner technologies** (Commerce, CMS, MarTech) - **Partner Intelligence feature only**

**Note**: No test companies or test users seeded. Real company audits will populate the database.

---

**Status**: ✅ Ready for Week 1 Implementation
**Owner**: Backend Team
**Last Updated**: March 6, 2026

---

## 🎯 Next Steps

**Week 1**:
1. Run migrations (7 files)
2. Run seed (1 file: partner-technologies only)
3. Verify schema in Supabase dashboard
4. Test basic CRUD operations with real company audits
5. Set up RLS policies

**Week 2**:
1. Implement backend API endpoints
2. Test audit versioning workflow
3. Validate composite FK constraints
4. Load test with realistic data
