# Algolia-Arian Data

**Purpose**: Database migrations, seeds, and schema definitions
**Database**: PostgreSQL (Supabase)
**Status**: 🏗️ TO BE CREATED (Week 1)

---

## 📂 Structure

```
data/
├── migrations/         # SQL migration scripts (versioned)
│   ├── 001-initial-schema.sql
│   ├── 002-add-audits-table.sql
│   └── 003-add-cache-table.sql
│
└── seeds/              # Seed data for development/testing
    ├── companies.sql
    └── test-audits.sql
```

---

## 🗄️ Database Schema

### Companies Table (Lightweight Entity)

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  CONSTRAINT companies_domain_unique UNIQUE (domain)
);

CREATE INDEX idx_companies_domain ON companies(domain);
```

**Purpose**: Lightweight entity table - just domain + name. All enrichment data stored in audits table.

---

### Audits Table (Point-in-Time Snapshots)

```sql
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Audit metadata
  audit_type VARCHAR(50) NOT NULL,  -- 'partner-intel' or 'search-audit'
  status VARCHAR(50) NOT NULL,      -- 'pending', 'running', 'completed', 'failed'

  -- Enrichment data (all API responses stored here)
  data JSONB NOT NULL,

  -- Scoring
  score NUMERIC(5,2),
  score_breakdown JSONB,

  -- Audit metadata
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  completed_at TIMESTAMP,

  -- Indexes
  CONSTRAINT audits_company_fk FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_audits_company_id ON audits(company_id);
CREATE INDEX idx_audits_audit_type ON audits(audit_type);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
```

**Purpose**: Store all audit data as point-in-time snapshots. Each audit captures:
- All enrichment data from APIs (SimilarWeb, BuiltWith, Yahoo Finance, etc.)
- Calculated scores (Fit, Intent, Value, Displacement)
- Audit status and metadata

**Why JSONB?**:
- Flexible schema (different audit types have different data)
- Fast queries with GIN indexes
- No need for separate tables per data source

---

### Enrichment Cache Table (Redis-Backed Persistence)

```sql
CREATE TABLE enrichment_cache (
  key VARCHAR(255) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,

  -- Cached data
  data JSONB NOT NULL,

  -- Cache metadata
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,

  -- Source metadata
  source_url TEXT,
  http_status INTEGER
);

CREATE INDEX idx_cache_provider ON enrichment_cache(provider);
CREATE INDEX idx_cache_expires_at ON enrichment_cache(expires_at);
```

**Purpose**: Persist API responses beyond Redis memory:
- Backup for Redis cache
- Historical API response tracking
- Audit trail for compliance
- Cost optimization (reduce duplicate API calls)

**Cache Key Format**: `api:{provider}:{endpoint}:{params_hash}`

---

## 📝 Migration Files

### 001-initial-schema.sql

```sql
-- Create companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_domain ON companies(domain);

-- Create audits table
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  audit_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  score NUMERIC(5,2),
  score_breakdown JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  completed_at TIMESTAMP
);

CREATE INDEX idx_audits_company_id ON audits(company_id);
CREATE INDEX idx_audits_audit_type ON audits(audit_type);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);

-- Create enrichment_cache table
CREATE TABLE enrichment_cache (
  key VARCHAR(255) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  source_url TEXT,
  http_status INTEGER
);

CREATE INDEX idx_cache_provider ON enrichment_cache(provider);
CREATE INDEX idx_cache_expires_at ON enrichment_cache(expires_at);
```

---

## 🌱 Seed Files

### seeds/companies.sql

```sql
-- Test companies for development
INSERT INTO companies (domain, name) VALUES
  ('costco.com', 'Costco Wholesale'),
  ('target.com', 'Target Corporation'),
  ('walmart.com', 'Walmart Inc.'),
  ('bestbuy.com', 'Best Buy'),
  ('homedepot.com', 'The Home Depot');
```

### seeds/test-audits.sql

```sql
-- Sample audit data
INSERT INTO audits (company_id, audit_type, status, data, score)
SELECT
  c.id,
  'partner-intel',
  'completed',
  '{
    "similarweb": {"monthlyVisits": 100000000},
    "builtwith": {"technologies": ["Adobe AEM", "Coveo"]},
    "score": {"fit": 85, "intent": 70, "value": 90}
  }'::jsonb,
  85.00
FROM companies c WHERE c.domain = 'costco.com';
```

---

## 🚀 Running Migrations

### Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref xbitqeejsgqnwvxlnjra

# Run migrations
supabase db push
```

### Using Prisma

```bash
# Initialize Prisma
npx prisma init

# Create migration
npx prisma migrate dev --name initial-schema

# Apply migration
npx prisma migrate deploy
```

### Manual (SQL)

```bash
# Connect to Supabase
psql $DATABASE_URL

# Run migration
\i data/migrations/001-initial-schema.sql

# Run seed
\i data/seeds/companies.sql
```

---

## 📊 Data Model: Time-Series Architecture

### Why This Design?

**Companies are lightweight entities**:
- Just domain + name
- No enrichment data stored here
- Fast lookups, minimal storage

**Audits are point-in-time snapshots**:
- All enrichment data stored in JSONB
- Track changes over time
- Query: "What was Costco's traffic 3 months ago?"

### Example Queries

**Get latest audit for a company**:
```sql
SELECT * FROM audits
WHERE company_id = '...'
ORDER BY created_at DESC
LIMIT 1;
```

**Get audit history**:
```sql
SELECT
  created_at,
  score,
  data->'similarweb'->>'monthlyVisits' as visits
FROM audits
WHERE company_id = '...'
ORDER BY created_at DESC;
```

**Find hot leads (score > 80)**:
```sql
SELECT
  c.domain,
  a.score,
  a.data->'builtwith'->'technologies' as tech_stack
FROM audits a
JOIN companies c ON a.company_id = c.id
WHERE a.audit_type = 'partner-intel'
  AND a.score > 80
  AND a.created_at > NOW() - INTERVAL '30 days'
ORDER BY a.score DESC;
```

---

## 🔐 Database Security

### Row-Level Security (RLS)

```sql
-- Enable RLS on audits table
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see audits they created
CREATE POLICY "Users can view own audits"
  ON audits FOR SELECT
  USING (created_by = auth.uid());

-- Policy: Admins can see all audits
CREATE POLICY "Admins can view all audits"
  ON audits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
```

---

## 📈 Performance Optimization

### Indexes

```sql
-- GIN index for JSONB queries
CREATE INDEX idx_audits_data_gin ON audits USING GIN (data);

-- Example query using GIN index:
-- SELECT * FROM audits WHERE data @> '{"similarweb": {"monthlyVisits": 100000000}}';
```

### Partitioning (Future)

```sql
-- Partition audits by created_at (monthly)
CREATE TABLE audits_2026_03 PARTITION OF audits
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

---

## 🔗 Related Documentation

- [Backend README](../backend/README.md) - Server setup
- [Architecture](../docs/features/search-audit/ARCHITECTURE_APPROVED.md) - Why time-series design?
- [Master Plan](../docs/features/search-audit/MASTER_PLAN.md) - Database chapter

---

**Status**: 🏗️ Ready for Week 1 implementation
**Owner**: Backend Team
**Last Updated**: March 6, 2026
