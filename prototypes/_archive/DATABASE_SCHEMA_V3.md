# Database Schema V3 - With Customer/User Relationships

## Missing Relationships (V2 → V3)

**V2 Problems:**
- ❌ No clear "who is being audited" (target company)
- ❌ No "who requested the audit" (Algolia user)
- ❌ No "why are we auditing" (opportunity context)
- ❌ No relationship tracking (prospect vs customer)

**V3 Fixes:**
- ✅ Reuse arian's `companies` table for target companies
- ✅ Add `users` table for Algolia employees
- ✅ Add `algolia_opportunities` table for sales context
- ✅ Clear FK relationships in `audits` table

---

## Core Tables (Updated)

### 1. `users` (Algolia Employees - NEW)

**Who can request audits?**
- Account Executives (AEs)
- Customer Success Managers (CSMs)
- Solutions Consultants (SCs)
- Product Marketing

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,

  -- Role
  role VARCHAR(50) NOT NULL,  -- 'ae', 'csm', 'sc', 'pmm', 'admin'
  team VARCHAR(100),          -- 'Enterprise Sales', 'Commercial', 'Customer Success'

  -- Algolia org
  okta_user_id VARCHAR(255) UNIQUE,  -- For SSO integration

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_okta_id ON users(okta_user_id);
```

---

### 2. `algolia_opportunities` (Sales Context - NEW)

**Why are we auditing this company?**
- Active sales opportunity
- Competitive research
- Customer health check
- Market research

```sql
CREATE TABLE algolia_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Opportunity details
  opportunity_name VARCHAR(255) NOT NULL,
  opportunity_type VARCHAR(50) NOT NULL,  -- 'new_business', 'upsell', 'renewal', 'competitive_intel', 'market_research'

  -- Salesforce integration (optional)
  sfdc_opportunity_id VARCHAR(18) UNIQUE,  -- Salesforce 18-char ID
  sfdc_account_id VARCHAR(18),

  -- Ownership
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- Primary AE/CSM

  -- Stage
  stage VARCHAR(50),              -- 'discovery', 'technical_evaluation', 'proposal', 'negotiation', 'closed_won', 'closed_lost'

  -- Value
  estimated_arr DECIMAL(12,2),
  close_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_owner_id ON algolia_opportunities(owner_id);
CREATE INDEX idx_opportunities_sfdc_id ON algolia_opportunities(sfdc_opportunity_id);
CREATE INDEX idx_opportunities_stage ON algolia_opportunities(stage);
```

---

### 3. `audits` (Updated with Relationships)

```sql
CREATE TABLE audits (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_number VARCHAR(20) UNIQUE,  -- Human-readable: AUD-2024-001234

  -- 🔴 WHO IS BEING AUDITED? (Target company)
  target_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  domain VARCHAR(255) NOT NULL,     -- Fallback if not in companies table
  company_name VARCHAR(255),        -- Fallback if not in companies table

  -- 🔴 WHO REQUESTED THIS? (Algolia user)
  requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- 🔴 WHY ARE WE AUDITING? (Optional sales context)
  opportunity_id UUID REFERENCES algolia_opportunities(id) ON DELETE SET NULL,
  audit_purpose VARCHAR(50),        -- 'sales_opportunity', 'customer_health', 'competitive_intel', 'market_research'

  -- 🔴 RELATIONSHIP TO ALGOLIA
  target_relationship VARCHAR(50),  -- 'prospect', 'customer', 'competitor', 'partner', 'unknown'

  -- Status workflow
  status VARCHAR(20) DEFAULT 'pending',
  -- pending → enriching → testing → scoring → generating → factchecking → completed/failed/needs_review

  -- Overall scores (denormalized for dashboard filtering)
  overall_audit_score DECIMAL(3,1),
  factcheck_score DECIMAL(4,2),

  -- Progress tracking
  current_phase INTEGER DEFAULT 1,
  progress_pct DECIMAL(5,2) DEFAULT 0.00,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Performance
  duration_seconds INTEGER,

  -- Errors
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_audits_target_company_id ON audits(target_company_id);
CREATE INDEX idx_audits_requested_by_id ON audits(requested_by_id);
CREATE INDEX idx_audits_opportunity_id ON audits(opportunity_id);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_domain ON audits(domain);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX idx_audits_target_relationship ON audits(target_relationship);
```

---

### 4. Link to Existing Arian `companies` Table

**Reuse from arian (already exists):**

```sql
-- This table already exists in arian project
-- We're just documenting how audits link to it

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  vertical VARCHAR(100),
  sub_vertical VARCHAR(100),

  -- SimilarWeb data
  sw_monthly_visits BIGINT,
  sw_bounce_rate DECIMAL(5,2),

  -- Algolia relationship
  is_algolia_customer BOOLEAN DEFAULT FALSE,
  algolia_customer_since DATE,

  -- ... many other fields already defined in arian

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audits link to companies via target_company_id
```

---

## Workflow: Creating an Audit

### Scenario 1: Prospect Company (Not in Arian)

```typescript
// Step 1: User starts audit
const user = await getUserByEmail('jane.doe@algolia.com');

// Step 2: Check if company exists in arian
let targetCompany = await supabase
  .from('companies')
  .select('*')
  .eq('domain', 'example.com')
  .single();

// Step 3: If not exists, create stub
if (!targetCompany) {
  targetCompany = await supabase
    .from('companies')
    .insert({
      domain: 'example.com',
      name: 'Example Corp',
      vertical: 'E-Commerce'
    })
    .select()
    .single();
}

// Step 4: Create opportunity (if sales context)
const opportunity = await supabase
  .from('algolia_opportunities')
  .insert({
    opportunity_name: 'Example Corp - New Business',
    opportunity_type: 'new_business',
    owner_id: user.id,
    stage: 'technical_evaluation',
    estimated_arr: 150000
  })
  .select()
  .single();

// Step 5: Create audit
const audit = await supabase
  .from('audits')
  .insert({
    target_company_id: targetCompany.id,
    domain: 'example.com',
    company_name: 'Example Corp',
    requested_by_id: user.id,
    opportunity_id: opportunity.id,
    audit_purpose: 'sales_opportunity',
    target_relationship: 'prospect',
    status: 'pending'
  })
  .select()
  .single();
```

### Scenario 2: Existing Algolia Customer (Already in Arian)

```typescript
// Company already exists
const targetCompany = await supabase
  .from('companies')
  .select('*')
  .eq('domain', 'costco.com')
  .single();

// Create audit for customer health check
const audit = await supabase
  .from('audits')
  .insert({
    target_company_id: targetCompany.id,
    domain: 'costco.com',
    company_name: targetCompany.name,
    requested_by_id: user.id,
    opportunity_id: null,  // No sales opportunity
    audit_purpose: 'customer_health',
    target_relationship: 'customer',
    status: 'pending'
  })
  .select()
  .single();
```

---

## Key Queries Enabled

### Find all audits for a company

```sql
SELECT a.*, u.name as requested_by_name, o.opportunity_name
FROM audits a
JOIN companies c ON a.target_company_id = c.id
LEFT JOIN users u ON a.requested_by_id = u.id
LEFT JOIN algolia_opportunities o ON a.opportunity_id = o.id
WHERE c.domain = 'costco.com'
ORDER BY a.created_at DESC;
```

### Find all audits requested by a user

```sql
SELECT a.*, c.name as company_name
FROM audits a
LEFT JOIN companies c ON a.target_company_id = c.id
WHERE a.requested_by_id = '...'
ORDER BY a.created_at DESC;
```

### Find all audits for active opportunities

```sql
SELECT a.*, c.name as company_name, o.opportunity_name, o.estimated_arr
FROM audits a
JOIN algolia_opportunities o ON a.opportunity_id = o.id
LEFT JOIN companies c ON a.target_company_id = c.id
WHERE o.stage NOT IN ('closed_won', 'closed_lost')
ORDER BY o.estimated_arr DESC;
```

### Dashboard: My Audits

```sql
SELECT
  a.id,
  a.audit_number,
  c.name as company_name,
  a.status,
  a.overall_audit_score,
  a.created_at
FROM audits a
LEFT JOIN companies c ON a.target_company_id = c.id
WHERE a.requested_by_id = $currentUserId
ORDER BY a.created_at DESC
LIMIT 10;
```

---

## Updated ERD (Entity Relationship Diagram)

```
┌─────────────────┐
│     users       │
│  (Algolia)      │
│─────────────────│
│ id              │◄──────┐
│ email           │       │
│ name            │       │
│ role            │       │
└─────────────────┘       │
                          │
                          │ requested_by_id
┌─────────────────┐       │
│   companies     │       │
│  (Target)       │       │
│─────────────────│       │
│ id              │◄──┐   │
│ domain          │   │   │
│ name            │   │   │
│ is_algolia_cust │   │   │
└─────────────────┘   │   │
        ▲             │   │
        │             │   │
        │ target_company_id
        │             │   │
        │             │   │
┌─────────────────────────┴───┐
│         audits              │
│─────────────────────────────│
│ id                          │
│ audit_number                │
│ target_company_id      ─────┘
│ requested_by_id        ─────┘
│ opportunity_id         ─────┐
│ domain                      │
│ status                      │
│ overall_audit_score         │
└─────────────────────────────┘
                              │
                              │
                              │ opportunity_id
                        ┌─────┴───────────────┐
                        │  algolia_opportunities│
                        │─────────────────────│
                        │ id                  │
                        │ opportunity_name    │
                        │ opportunity_type    │
                        │ owner_id       ─────┘  (→ users.id)
                        │ stage               │
                        │ estimated_arr       │
                        └─────────────────────┘
```

---

## Benefits of V3

### ✅ Clear Relationships
- Know **who** is being audited (target company)
- Know **who** requested it (Algolia user)
- Know **why** we're auditing (opportunity context)

### ✅ Historical Tracking
- Can track all audits for a company over time
- Can compare scores: "Q1 2024 vs Q4 2024"

### ✅ Sales Integration
- Link audits to Salesforce opportunities
- Track which audits led to closed deals

### ✅ User Attribution
- See all audits requested by Jane Doe
- Leaderboard: "Who runs the most audits?"

### ✅ Customer vs Prospect Segmentation
- Filter: "Show me all prospect audits"
- Filter: "Show me customer health checks"

---

## Migration Path

### Week 1 Tasks (Updated)

1. **Create users table**
   - Seed with Algolia employee list
   - Set up Okta SSO integration later

2. **Create algolia_opportunities table**
   - Optional for MVP, can add later

3. **Update audits table**
   - Add `target_company_id`, `requested_by_id`, `opportunity_id` FKs
   - Add `audit_purpose`, `target_relationship` fields

4. **Link to arian's companies table**
   - No changes needed, just reference it

---

## Summary: V2 vs V3

| Aspect | V2 | V3 |
|--------|----|----|
| **Target company** | ❌ Just `domain` string | ✅ FK to `companies` table |
| **Requester** | ❌ Just `requested_by` string | ✅ FK to `users` table |
| **Sales context** | ❌ None | ✅ FK to `algolia_opportunities` |
| **Relationship** | ❌ Unknown | ✅ `target_relationship` enum |
| **Can query "my audits"?** | ❌ Hard | ✅ Easy: WHERE requested_by_id = $userId |
| **Can link to CRM?** | ❌ No | ✅ Yes: `sfdc_opportunity_id` |
| **Can track company over time?** | ❌ Hard (domain string) | ✅ Easy: WHERE target_company_id = $id |

---

**Is V3 better?** Does this properly model the customer/user relationships?
