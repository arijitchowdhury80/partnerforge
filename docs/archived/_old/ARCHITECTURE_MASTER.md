# Algolia Arian - Master Architecture Document

**Version**: 3.0
**Date**: March 6, 2026
**Status**: ARCHITECTURAL DECISIONS REQUIRED
**Owner**: Engineering Leadership

---

## Executive Summary

**Critical Architectural Decision Required**: **Knowledge Graph vs Relational Database**

This document consolidates all architectural findings from codebase analysis with existing dashboard specifications and addresses critical architectural decisions that will determine the scalability, maintainability, and cost structure of both:

1. **Algolia Arian** - Partner Intelligence Platform
2. **Search Audit Dashboard** - SaaS audit platform

**IMPORTANT**: The user has requested a fundamental architectural decision regarding data storage strategy that will impact both projects.

---

## Table of Contents

1. [Project Clarification](#1-project-clarification)
2. [Critical Architectural Decision: Graph vs Relational](#2-critical-architectural-decision-graph-vs-relational)
3. [Folder Structure Decision](#3-folder-structure-decision)
4. [Security Architecture](#4-security-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Caching & Persistence Strategy](#6-caching--persistence-strategy)
7. [Rate Limiting & Operational Strategies](#7-rate-limiting--operational-strategies)
8. [Testing & Logging Standards](#8-testing--logging-standards)
9. [Cost Breakdown](#9-cost-breakdown)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Project Clarification

### Two Distinct Projects in This Repository

#### **Project A: Algolia Arian** (Partner Intelligence Platform)
- **Location**: `/frontend/` directory
- **Purpose**: Partner displacement intelligence - find companies using partner tech who aren't using Algolia
- **Current State**: React frontend + Supabase backend + enrichment services (partially built)
- **URL**: https://algolia-arian.vercel.app

#### **Project B: Search Audit Dashboard** (SaaS Platform)
- **Location**: `/dashboard/` directory
- **Purpose**: Automated search audit platform for GTM teams
- **Current State**: Planning phase with approved architecture
- **Target**: 500,000 audits/year for 1000 users

### Shared Infrastructure Opportunities

Both projects share similar needs:
- ✅ Multi-source API enrichment (SimilarWeb, BuiltWith, Yahoo Finance)
- ✅ Heavy data aggregation and temporal tracking
- ✅ Composite scoring algorithms
- ✅ Export/reporting capabilities
- ✅ User authentication and team management

**Recommendation**: Unified backend services with project-specific frontends

---

## 2. Critical Architectural Decision: Graph vs Relational

### The Question

> "Should we use knowledge graphs instead of relational databases given the massive data enrichment and temporal tracking requirements?"

### Option A: Relational Database (PostgreSQL via Supabase) - CURRENT APPROACH

**What we have now:**
```sql
-- Current relational approach
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  domain VARCHAR(255),
  company_name VARCHAR(255),
  -- ... 50+ columns
);

CREATE TABLE audits (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  traffic_data JSONB,  -- SimilarWeb data
  tech_stack JSONB,    -- BuiltWith data
  -- ... JSONB for flexibility
);
```

#### ✅ Pros: Relational DB
1. **Mature ecosystem** - PostgreSQL 30+ years battle-tested
2. **SQL expertise** - Team knows SQL, hiring easier
3. **ACID guarantees** - Transactions, consistency, reliability
4. **Supabase integration** - Auto-generated REST API, RLS, Auth
5. **Cost-effective** - Supabase scales to millions of rows cheaply
6. **Query performance** - Indexes, query planner, extensive optimization
7. **JSON flexibility** - JSONB gives semi-structured data benefits
8. **Backup/restore** - Point-in-time recovery, pg_dump mature tools

#### ❌ Cons: Relational DB
1. **Complex joins** - 5-table joins for enrichment queries
2. **Schema rigidity** - Adding new enrichment sources requires migrations
3. **Relationship modeling** - Competitors, similar companies = join tables
4. **Temporal queries** - "Show me all changes for Costco in 6 months" = complex SQL
5. **Graph traversal** - "Find all companies using Shopify competing with Algolia customers" = inefficient

---

### Option B: Knowledge Graph (Neo4j or AWS Neptune)

**Proposed graph schema:**
```cypher
// Nodes
(:Company {domain, name, industry})
(:Technology {name, category})
(:Audit {id, date, score})
(:Executive {name, title})
(:Competitor {domain, similarity_score})

// Relationships (with temporal properties)
(:Company)-[:USES_TECH {detected_at, last_seen}]->(:Technology)
(:Company)-[:AUDITED_ON {date}]->(:Audit)
(:Company)-[:COMPETES_WITH {similarity, market_overlap}]->(:Company)
(:Company)-[:EMPLOYS]->(:Executive)
(:Company)-[:HAS_TRAFFIC {monthly_visits, date}]->(:TrafficSnapshot)
(:Company)-[:HAS_FINANCIAL {revenue, date}]->(:FinancialSnapshot)
```

**Example: Temporal Query Power**
```cypher
// "Show me companies that switched FROM Elasticsearch TO Algolia in 2025"
MATCH (c:Company)-[old:USES_TECH]->(elastic:Technology {name: 'Elasticsearch'})
WHERE old.last_seen >= date('2025-01-01') AND old.last_seen <= date('2025-12-31')
MATCH (c)-[new:USES_TECH]->(algolia:Technology {name: 'Algolia'})
WHERE new.detected_at > old.last_seen
RETURN c.name, old.last_seen AS switched_from, new.detected_at AS switched_to
```

In relational DB, this requires 3+ table joins with complex date filtering.

#### ✅ Pros: Knowledge Graph
1. **Natural relationship modeling** - Companies, competitors, technologies as nodes
2. **Temporal tracking built-in** - Relationships have `detected_at`, `last_seen` properties
3. **Graph traversal performance** - "Find all competitors of competitors" = O(1) hop
4. **Schema flexibility** - Add new node types without breaking existing queries
5. **Pattern matching** - Cypher queries express business logic naturally
6. **Variance detection** - "What changed?" queries are native graph operations
7. **Recommendation engine** - "Similar companies based on tech stack" = graph algorithm
8. **Visualization** - Neo4j Bloom, GraphQL API for UI graph visualization

#### ❌ Cons: Knowledge Graph
1. **Learning curve** - Team must learn Cypher query language
2. **Tooling immaturity** - Fewer ORMs, admin tools vs PostgreSQL
3. **Cost** - Neo4j Aura or AWS Neptune more expensive than Supabase
4. **No Supabase integration** - Lose auto-generated REST API, RLS
5. **Backup complexity** - Graph databases harder to backup/restore
6. **Aggregations** - SUM/AVG queries less performant than SQL
7. **Hosting** - Need separate graph DB service (Neo4j Aura, Neptune)
8. **Migration risk** - Moving from relational to graph = rewrite queries

---

### Option C: Hybrid Approach (RECOMMENDED)

**Best of both worlds:**

```
┌─────────────────────────────────────────────────────────┐
│                  PostgreSQL (Supabase)                   │
│                                                          │
│  - Companies (core entity)                              │
│  - Audits (time-series snapshots)                       │
│  - Users, auth, permissions                             │
│  - API cache (api_calls table)                          │
│  - JSONB for raw enrichment data                        │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Sync nightly via ETL
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Neo4j Knowledge Graph (Read-Only)          │
│                                                          │
│  - Relationship queries ("find similar companies")      │
│  - Temporal variance ("what changed in 6 months?")     │
│  - Graph algorithms (PageRank for influence)            │
│  - Visualization (UI graph explorer)                    │
└─────────────────────────────────────────────────────────┘
```

**How it works:**

1. **Write path** (PostgreSQL):
   ```typescript
   // All writes go to PostgreSQL (ACID, reliable)
   await supabase.from('companies').insert({...});
   await supabase.from('audits').insert({...});
   ```

2. **Nightly sync** (ETL):
   ```typescript
   // Every night at 2am, sync PostgreSQL → Neo4j
   const newAudits = await supabase
     .from('audits')
     .select('*')
     .gte('created_at', yesterday);

   for (const audit of newAudits) {
     await neo4j.run(`
       MERGE (c:Company {domain: $domain})
       MERGE (a:Audit {id: $auditId})
       MERGE (c)-[:AUDITED_ON {date: $date, score: $score}]->(a)
     `, audit);
   }
   ```

3. **Read path** (Choose based on query):
   ```typescript
   // Simple queries → PostgreSQL (faster)
   const company = await supabase
     .from('companies')
     .select('*')
     .eq('domain', 'costco.com');

   // Relationship queries → Neo4j (more expressive)
   const competitors = await neo4j.run(`
     MATCH (c:Company {domain: $domain})-[:COMPETES_WITH]->(comp)
     RETURN comp
   `);
   ```

#### ✅ Why Hybrid is Best

1. **✅ Keep Supabase benefits** - Auth, RLS, REST API, backups
2. **✅ Get graph power** - Temporal queries, relationship traversal
3. **✅ Risk mitigation** - PostgreSQL is primary, graph is enhancement
4. **✅ Gradual adoption** - Start with PostgreSQL, add graph later
5. **✅ Cost control** - Graph DB only for read queries (cheaper tier)
6. **✅ Team ramp-up** - Learn Cypher gradually, no big-bang migration

#### ⚠️ Trade-offs

1. **Eventual consistency** - Graph is 1 day behind PostgreSQL
2. **ETL complexity** - Need nightly sync job
3. **Two databases** - More infrastructure to manage
4. **Cost** - Paying for both PostgreSQL + Neo4j

---

### 🎯 RECOMMENDATION: Hybrid with PostgreSQL Primary

**Phase 1 (Months 1-3)**: PostgreSQL only
- Build MVP with Supabase
- Use JSONB for relationships
- Prove product-market fit

**Phase 2 (Months 4-6)**: Add Neo4j read replica
- ETL from PostgreSQL → Neo4j nightly
- Use for "similar companies" and "variance detection"
- Keep writes in PostgreSQL

**Phase 3 (Months 7-12)**: Optimize
- Move complex graph queries to Neo4j
- Add graph visualization to UI
- Tune ETL for real-time (15-min lag)

**Why this is best:**
- ✅ Start fast with Supabase (proven)
- ✅ Add graph power when you have users
- ✅ Minimize risk (PostgreSQL as fallback)
- ✅ Cost-effective (no Neo4j until needed)

---

## 3. Folder Structure Decision

### Current Structure
```
/frontend/          # Algolia Arian (Partner Intelligence)
/dashboard/         # Search Audit Dashboard
```

### Question: Should we rename `/frontend/` to `/arian/` or keep it?

#### Option A: Keep `/frontend/` and `/dashboard/`

**Pros:**
- ✅ Semantic clarity (frontend = React code)
- ✅ Common convention
- ✅ No breaking changes

**Cons:**
- ❌ Implies single frontend (but we have 2 projects)
- ❌ "frontend" is ambiguous when 2 frontends exist

#### Option B: Rename to `/arian/` and `/dashboard/`

**Pros:**
- ✅ Clear project names
- ✅ Symmetric structure
- ✅ Future-proof (if we add more projects)

**Cons:**
- ❌ Breaking change (update all imports)
- ❌ "arian" doesn't indicate it's a frontend

#### Option C: Monorepo Structure (RECOMMENDED)

```
/packages/
  /arian-frontend/          # Arian React app
  /audit-dashboard/         # Dashboard React app
  /shared-ui/               # Common components
  /api-clients/             # SimilarWeb, BuiltWith, etc.
  /enrichment-service/      # Shared enrichment logic
  /scoring-engine/          # Shared scoring algorithms
```

**Why monorepo:**
- ✅ Share code between projects (DRY)
- ✅ Single `node_modules` (faster installs)
- ✅ Unified TypeScript configs
- ✅ Atomic commits across projects
- ✅ Tools: Nx, Turbo repo, Lerna

**Migration:**
```bash
# Week 1: Set up Nx monorepo
npx create-nx-workspace@latest algolia-intelligence \
  --preset=react-monorepo

# Week 2: Move existing code
mv frontend/ packages/arian-frontend/
mv dashboard/ packages/audit-dashboard/

# Week 3: Extract shared code
mkdir packages/shared-ui
mkdir packages/api-clients
```

### 🎯 RECOMMENDATION: Monorepo with Nx

**Immediate (Week 1):**
- Keep current structure
- Focus on building features

**Month 3 (when 2+ projects mature):**
- Migrate to monorepo
- Extract shared libraries
- Set up unified build/deploy

---

## 4. Security Architecture

### NON-NEGOTIABLE: No API Keys in Frontend

**Current Risk:** Some code may expose API keys in browser

**Solution: Environment-based API Key Management**

```typescript
// ❌ NEVER DO THIS
const SIMILARWEB_API_KEY = 'sk_live_abc123'; // Exposed in bundle!

// ✅ CORRECT: Server-side only
// .env.local (NEVER commit to Git)
SIMILARWEB_API_KEY=sk_live_abc123
BUILTWITH_API_KEY=sk_live_def456

// backend/src/config/api-keys.ts
export const API_KEYS = {
  similarweb: process.env.SIMILARWEB_API_KEY!,
  builtwith: process.env.BUILTWITH_API_KEY!,
  yahooFinance: null, // Public API
};

// frontend NEVER sees these keys
```

### Supabase Edge Functions (Server-Side API Calls)

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ POST /enrich-company
       │ {domain: "costco.com"}
       ▼
┌─────────────────────────────────────────┐
│   Supabase Edge Function (Deno)         │
│                                         │
│  import { API_KEYS } from './env.ts';  │
│                                         │
│  const traffic = await fetch(          │
│    'https://api.similarweb.com/...',  │
│    {                                    │
│      headers: {                         │
│        Authorization: API_KEYS.similarweb  // SAFE
│      }                                  │
│    }                                    │
│  );                                     │
└─────────────────────────────────────────┘
```

**Implementation:**
```typescript
// supabase/functions/enrich-company/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  const { domain } = await req.json();

  // API keys in Supabase environment vars (not in code)
  const similarwebKey = Deno.env.get('SIMILARWEB_API_KEY')!;

  const traffic = await fetch(
    `https://api.similarweb.com/v1/website/${domain}/traffic`,
    {
      headers: { Authorization: `Bearer ${similarwebKey}` }
    }
  );

  const data = await traffic.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

### Single Sign-On (SSO) with Algolia Emails

**Requirements:**
1. Only `@algolia.com` emails can sign in
2. Google Workspace SSO
3. Role-based access (admin, user, viewer)

**Implementation: Supabase Auth + Google OAuth**

```typescript
// 1. Configure Supabase Auth (Dashboard UI)
// - Enable Google OAuth provider
// - Add authorized domains: algolia.com

// 2. Frontend: Google Sign-In
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: {
        hd: 'algolia.com', // Restrict to Algolia domain
      },
      redirectTo: 'https://algolia-arian.vercel.app/auth/callback'
    }
  });
}

// 3. Email domain validation (Supabase RLS policy)
CREATE POLICY "Only Algolia emails can access"
ON companies
FOR ALL
USING (
  auth.jwt()->>'email' LIKE '%@algolia.com'
);

// 4. Role-based access
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id),
  role VARCHAR(20) CHECK (role IN ('admin', 'user', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

// 5. Frontend: Check role
const { data: { user } } = await supabase.auth.getUser();
const { data: role } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .single();

if (role.role === 'admin') {
  // Show admin features
}
```

---

### User History & State Machine

**State Machine for Audits:**
```typescript
type AuditStatus =
  | 'queued'          // Just created
  | 'running_phase1'  // Enrichment in progress
  | 'running_phase2'  // Browser testing
  | 'running_phase3'  // Scoring
  | 'running_phase4'  // Report generation
  | 'completed'       // Success
  | 'failed'          // Error occurred
  | 'cancelled';      // User cancelled

// Database
CREATE TABLE audits (
  id UUID PRIMARY KEY,
  status audit_status_enum NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ...
);

// State transitions
const VALID_TRANSITIONS = {
  queued: ['running_phase1', 'cancelled'],
  running_phase1: ['running_phase2', 'failed', 'cancelled'],
  running_phase2: ['running_phase3', 'failed', 'cancelled'],
  running_phase3: ['running_phase4', 'failed', 'cancelled'],
  running_phase4: ['completed', 'failed'],
  completed: [],
  failed: ['queued'], // Allow retry
  cancelled: []
};

// Validate transition
function canTransition(from: AuditStatus, to: AuditStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
```

**User Activity Tracking:**
```sql
CREATE TABLE user_activity (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50), -- 'audit_created', 'audit_viewed', 'report_downloaded'
  resource_type VARCHAR(50), -- 'audit', 'company', 'report'
  resource_id UUID,
  metadata JSONB, -- { domain: 'costco.com', audit_score: 4.2 }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query: User's audit history
SELECT
  a.id,
  a.status,
  c.domain,
  a.created_at,
  a.completed_at,
  EXTRACT(EPOCH FROM (a.completed_at - a.created_at)) AS duration_seconds
FROM audits a
JOIN companies c ON a.company_id = c.id
WHERE a.created_by = $user_id
ORDER BY a.created_at DESC;
```

---

## 5. Backend Architecture

### Current State Analysis

**What EXISTS (partially built):**
- ✅ `frontend/src/services/enrichment/orchestrator.ts` - Client-side orchestration
- ✅ `frontend/src/services/enrichment/clients/` - API clients (SimilarWeb, BuiltWith, etc.)
- ✅ `frontend/src/services/scoring.ts` - Composite scoring

**What's MISSING (critical):**
- ❌ Server-side enrichment (running in browser = insecure)
- ❌ Job queue (no background processing)
- ❌ Persistent cache (in-memory only)
- ❌ Webhook notifications
- ❌ Rate limiting per service

### Target Architecture: Supabase Edge Functions + Job Queue

```
┌──────────────────────────────────────────────────────────┐
│                     React Frontend                        │
│  (Algolia Arian + Dashboard)                            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ HTTPS (authenticated)
                         ▼
┌──────────────────────────────────────────────────────────┐
│              Supabase Edge Functions (Deno)              │
│                                                          │
│  /enrich-company      - Trigger enrichment               │
│  /get-company         - Fetch company data               │
│  /webhook             - Receive webhooks                 │
└────────┬─────────────────────────────┬───────────────────┘
         │                             │
         │ Queue job                   │ Store result
         ▼                             ▼
┌─────────────────────┐       ┌──────────────────────────┐
│  Redis (Upstash)    │       │  PostgreSQL (Supabase)   │
│                     │       │                          │
│  - Job queue        │       │  - companies             │
│  - Cache (7-day)    │       │  - audits                │
└─────────┬───────────┘       │  - api_calls             │
          │                   │  - users                 │
          │                   └──────────────────────────┘
          │
          │ Process jobs
          ▼
┌─────────────────────────────────────────────────────────┐
│             Background Worker (Deno Deploy)              │
│                                                          │
│  while (true) {                                          │
│    const job = await redis.brpop('enrichment_queue');   │
│    await processEnrichment(job);                        │
│  }                                                       │
└────────┬────────────────────────────────────────────────┘
         │
         │ External API calls
         ▼
┌─────────────────────────────────────────────────────────┐
│              External APIs                               │
│  - SimilarWeb (14 endpoints)                            │
│  - BuiltWith (7 endpoints)                              │
│  - Yahoo Finance (5 endpoints)                          │
│  - SEC Edgar (3 endpoints)                              │
│  - JSearch (2 endpoints)                                │
└─────────────────────────────────────────────────────────┘
```

### Migration Plan: Move from Client-Side to Server-Side

**Week 1: Supabase Edge Function Skeleton**
```typescript
// supabase/functions/enrich-company/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'https://deno.land/x/upstash_redis@v1.22.0/mod.ts';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_TOKEN')!,
});

serve(async (req) => {
  try {
    const { domain, level } = await req.json();

    // Create audit record
    const { data: audit } = await supabase
      .from('audits')
      .insert({ company_domain: domain, status: 'queued' })
      .select()
      .single();

    // Queue job
    await redis.lpush('enrichment_queue', JSON.stringify({
      auditId: audit.id,
      domain,
      level,
    }));

    return new Response(JSON.stringify({ auditId: audit.id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

**Week 2-3: Background Worker**
```typescript
// workers/enrichment-worker.ts
import { Redis } from '@upstash/redis';
import { enrichmentOrchestrator } from '../frontend/src/services/enrichment/orchestrator.ts';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

async function processJob() {
  while (true) {
    try {
      // Blocking pop (waits for job)
      const job = await redis.brpop('enrichment_queue', 0);
      if (!job) continue;

      const { auditId, domain, level } = JSON.parse(job[1]);

      // Update status
      await supabase
        .from('audits')
        .update({ status: 'running_phase1' })
        .eq('id', auditId);

      // Run enrichment (REUSE existing orchestrator code!)
      const result = await enrichmentOrchestrator.enrich(domain, level, {
        onProgress: async (progress) => {
          // Save progress to database
          await supabase
            .from('execution_logs')
            .insert({
              audit_id: auditId,
              phase: progress.stage,
              status: progress.status,
              message: progress.message
            });
        }
      });

      // Save result
      await supabase
        .from('audits')
        .update({
          status: 'completed',
          traffic_data: result.traffic,
          tech_stack_data: result.techStack,
          // ... other fields
          completed_at: new Date()
        })
        .eq('id', auditId);

      // Send webhook notification (if configured)
      await sendWebhook('enrichment.completed', { auditId, domain });

    } catch (error) {
      console.error('[Worker] Error:', error);
      // Update audit status to failed
    }
  }
}

processJob();
```

---

## 6. Caching & Persistence Strategy

### Two-Tier Caching

**Tier 1: Redis (Hot Cache) - 7 days**
```typescript
// Fast, volatile cache for API responses
const cacheKey = `traffic:${domain}:${dateRange}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached); // Sub-50ms response
}

// Cache miss - fetch from API
const data = await similarWebClient.getTrafficData(domain, dateRange);

// Save to Redis (7-day TTL = 604800 seconds)
await redis.setex(cacheKey, 604800, JSON.stringify(data));
```

**Tier 2: PostgreSQL (Cold Storage) - Permanent**
```typescript
// After API call, ALSO save to database for historical analysis
await supabase.from('api_calls').insert({
  audit_id: auditId,
  service: 'similarweb',
  endpoint: 'get-traffic-data',
  request_params: { domain, dateRange },
  response_data: data,
  cache_hit: false,
  latency_ms: latencyMs,
  cost_usd: 0.05,
  called_at: new Date()
});
```

### Cache Invalidation Strategy

**Automatic (Time-based):**
- Traffic/tech/financials: 7 days (quarterly data)
- Hiring signals: 24 hours (daily job postings)
- Stock prices: 1 hour (real-time)

**Manual (User-triggered):**
```typescript
// "Refresh Data" button
async function refreshCompany(domain: string) {
  // Clear Redis cache
  const keys = await redis.keys(`*:${domain}:*`);
  await Promise.all(keys.map(key => redis.del(key)));

  // Re-fetch from APIs
  return enrichmentOrchestrator.enrich(domain, 'standard', {
    forceRefresh: true
  });
}
```

---

## 7. Rate Limiting & Operational Strategies

### Rate Limiting per API Service

```typescript
// services/rate-limiter.ts
import Bottleneck from 'bottleneck';

// SimilarWeb: 10 req/sec
const similarWebLimiter = new Bottleneck({
  minTime: 100, // 100ms between requests = 10 req/sec
  maxConcurrent: 5
});

// BuiltWith: 5 req/sec (conservative)
const builtWithLimiter = new Bottleneck({
  minTime: 200, // 200ms = 5 req/sec
  maxConcurrent: 3
});

// Yahoo Finance: No documented limit (use 2 req/sec)
const yahooFinanceLimiter = new Bottleneck({
  minTime: 500,
  maxConcurrent: 1
});

// Usage
export async function fetchWithRateLimit(
  service: 'similarweb' | 'builtwith' | 'yahooFinance',
  fn: () => Promise<any>
): Promise<any> {
  const limiter = {
    similarweb: similarWebLimiter,
    builtwith: builtWithLimiter,
    yahooFinance: yahooFinanceLimiter
  }[service];

  return limiter.schedule(fn);
}
```

### Webhook Notifications (Slack Integration)

```typescript
// services/webhooks.ts
interface WebhookConfig {
  event: string;
  url: string;
  enabled: boolean;
}

// Database
CREATE TABLE webhook_configs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event VARCHAR(50), -- 'enrichment.completed', 'hot_lead.detected'
  url TEXT NOT NULL,  -- Slack webhook URL
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

// Trigger webhook
async function sendWebhook(event: string, payload: any) {
  const configs = await supabase
    .from('webhook_configs')
    .select('*')
    .eq('event', event)
    .eq('enabled', true);

  for (const config of configs) {
    try {
      await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          data: payload
        })
      });
    } catch (error) {
      console.error(`[Webhook] Failed to send to ${config.url}:`, error);
    }
  }
}

// Slack message format
// POST https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
{
  "text": "🔥 New hot lead detected!",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Costco Wholesale* just scored 85/100!\n\n• ICP Fit: 90/100\n• Intent Score: 80/100\n• Using Elasticsearch (displacement opportunity)\n\n<https://algolia-arian.vercel.app/companies/costco.com|View Company>"
      }
    }
  ]
}
```

### Deduplication Strategy

**Problem:** Same company multiple domains
- `amazon.com`
- `aws.amazon.com`
- `amazon.co.uk`

**Solution: Canonical Domain Detection**
```typescript
// services/deduplication.ts
import { similarWebClient } from './enrichment/clients/similarweb';

async function getCanonicalDomain(domain: string): Promise<string> {
  // 1. Check BuiltWith relationships API
  const relationships = await builtWithClient.getRelationships(domain);
  if (relationships.corporate_parent) {
    return relationships.corporate_parent;
  }

  // 2. Check SimilarWeb for main domain
  const mainDomain = await similarWebClient.getMainDomain(domain);
  if (mainDomain) {
    return mainDomain;
  }

  // 3. Normalize (remove subdomain)
  const normalized = domain.replace(/^(www\.|m\.)/, '');
  return normalized;
}

// Database: Store aliases
CREATE TABLE company_aliases (
  canonical_domain VARCHAR(255) REFERENCES companies(domain),
  alias_domain VARCHAR(255) UNIQUE NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

// Before enriching, check if alias exists
const canonical = await getCanonicalDomain(inputDomain);
const existing = await supabase
  .from('companies')
  .select('*')
  .eq('domain', canonical)
  .single();

if (existing) {
  // Use existing company, add alias
  await supabase.from('company_aliases').insert({
    canonical_domain: canonical,
    alias_domain: inputDomain
  });
  return existing;
}
```

---

## 8. Testing & Logging Standards

### NON-NEGOTIABLE: Comprehensive Testing

**3-Tier Test Strategy:**

#### Tier 1: Unit Tests (Jest + Vitest)
```typescript
// __tests__/scoring.test.ts
import { calculateCompositeScore } from '@/services/scoring';

describe('Scoring Engine', () => {
  it('should score high for enterprise + high traffic + hiring', () => {
    const company = {
      domain: 'test.com',
      revenue: 1_000_000_000, // $1B
      sw_monthly_visits: 50_000_000, // 50M
      hiring_signal_score: 80,
      current_search: 'elasticsearch'
    };

    const score = calculateCompositeScore(company);

    expect(score.total).toBeGreaterThan(70); // HOT lead
    expect(score.factors.value).toBeGreaterThan(30);
  });

  it('should handle missing data gracefully', () => {
    const company = { domain: 'test.com' };
    const score = calculateCompositeScore(company);

    expect(score.total).toBe(0);
    expect(score.confidence).toBe('low');
  });
});
```

**Coverage Target: 80%+ for core services**

```bash
# Run tests with coverage
npm test -- --coverage

# Enforce coverage in CI
if [ $(coverage_percent) -lt 80 ]; then
  echo "Coverage below 80%!"
  exit 1
fi
```

#### Tier 2: Integration Tests (Real APIs, Test Environment)
```typescript
// __tests__/integration/enrichment.test.ts
import { enrichmentOrchestrator } from '@/services/enrichment/orchestrator';

describe('Enrichment Integration', () => {
  it('should enrich a known company end-to-end', async () => {
    // Use a stable test domain
    const result = await enrichmentOrchestrator.enrich(
      'example.com',
      'standard',
      { forceRefresh: true }
    );

    expect(result.traffic).toBeDefined();
    expect(result.traffic.monthly_visits).toBeGreaterThan(0);
    expect(result.techStack).toBeDefined();
    expect(result.errors).toHaveLength(0);
  }, 30000); // 30 sec timeout

  it('should handle API errors gracefully', async () => {
    // Mock API to return 500 error
    const result = await enrichmentOrchestrator.enrich(
      'invalid-domain-xyz.com',
      'standard'
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.data_completeness).toBeLessThan(100);
  });
});
```

#### Tier 3: End-to-End Tests (Playwright)
```typescript
// e2e/enrichment-flow.spec.ts
import { test, expect } from '@playwright/test';

test('user can enrich a company and view results', async ({ page }) => {
  await page.goto('https://algolia-arian.vercel.app');

  // Login
  await page.click('text=Sign in with Google');
  await page.fill('input[type=email]', 'test@algolia.com');
  // ... complete OAuth flow

  // Create new enrichment
  await page.click('text=New Enrichment');
  await page.fill('input[name=domain]', 'costco.com');
  await page.click('text=Enrich');

  // Wait for completion (max 5 min)
  await page.waitForSelector('text=Enrichment Complete', { timeout: 300000 });

  // Verify results
  const score = await page.textContent('[data-testid=icp-score]');
  expect(parseInt(score)).toBeGreaterThan(0);
});
```

---

### MANDATORY: Detailed Logging & Tracing

**Structured Logging with Pino**

```typescript
// services/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

// Usage in enrichment
logger.info({
  module: 'enrichment',
  action: 'start',
  domain: 'costco.com',
  level: 'standard',
  user_id: userId
}, 'Starting enrichment');

logger.error({
  module: 'enrichment',
  action: 'api_call_failed',
  service: 'similarweb',
  endpoint: 'get-traffic-data',
  domain: 'costco.com',
  error: error.message,
  stack: error.stack
}, 'API call failed');
```

**Distributed Tracing with OpenTelemetry**

```typescript
// services/tracing.ts
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('enrichment-service');

// Create span for entire enrichment
export async function enrichWithTracing(domain: string) {
  return tracer.startActiveSpan('enrich-company', async (span) => {
    span.setAttribute('domain', domain);
    span.setAttribute('user_id', userId);

    try {
      // Phase 1: Traffic
      await tracer.startActiveSpan('phase-1-traffic', async (childSpan) => {
        const traffic = await similarWebClient.getTrafficData(domain);
        childSpan.setAttribute('monthly_visits', traffic.monthly_visits);
        childSpan.end();
      });

      // Phase 2: Tech Stack
      await tracer.startActiveSpan('phase-2-techstack', async (childSpan) => {
        const techStack = await builtWithClient.getTechStack(domain);
        childSpan.setAttribute('tech_count', techStack.technologies.length);
        childSpan.end();
      });

      span.setStatus({ code: trace.SpanStatusCode.OK });
      span.end();
    } catch (error) {
      span.setStatus({
        code: trace.SpanStatusCode.ERROR,
        message: error.message
      });
      span.recordException(error);
      span.end();
      throw error;
    }
  });
}
```

**Log Aggregation: Datadog or Grafana Loki**

```yaml
# docker-compose.yml
services:
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yaml:/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yaml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:10.0.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

### Code Hardening Standards

**Global Error Handling Pattern:**

```typescript
// utils/error-handler.ts
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Wrapper for async functions
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: any[]) => {
    try {
      logger.info({ context, action: 'start', args }, `Starting ${context}`);
      const result = await fn(...args);
      logger.info({ context, action: 'success' }, `Completed ${context}`);
      return result;
    } catch (error) {
      logger.error({
        context,
        action: 'error',
        error: error.message,
        stack: error.stack
      }, `Error in ${context}`);

      // Don't expose internal errors to user
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'An unexpected error occurred',
        'INTERNAL_ERROR',
        500
      );
    }
  }) as T;
}

// Usage
export const enrichCompany = withErrorHandling(
  async (domain: string) => {
    // Business logic here
  },
  'enrichCompany'
);
```

**Try-Catch Everywhere:**

```typescript
// ✅ CORRECT
async function fetchData(url: string) {
  let response;
  try {
    response = await fetch(url);
  } catch (networkError) {
    logger.error({ error: networkError, url }, 'Network request failed');
    throw new AppError('Failed to fetch data', 'NETWORK_ERROR', 503);
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    logger.error({ error: parseError, url }, 'Failed to parse JSON');
    throw new AppError('Invalid response format', 'PARSE_ERROR', 502);
  }

  return data;
}

// ❌ WRONG
async function fetchData(url: string) {
  const response = await fetch(url); // Can throw!
  const data = await response.json(); // Can throw!
  return data;
}
```

---

## 9. Cost Breakdown

### API Costs (Per Full Enrichment)

| Service | Endpoints | Cost/Call | Calls/Audit | Cost/Audit |
|---------|-----------|-----------|-------------|------------|
| **SimilarWeb** | 14 | $0.05 | 14 | $0.70 |
| **BuiltWith** | 7 | $0.10 | 7 | $0.70 |
| **Yahoo Finance** | 5 | $0.00 | 5 | $0.00 |
| **SEC Edgar** | 3 | $0.00 | 3 | $0.00 |
| **JSearch** | 2 | $0.001 | 2 | $0.002 |
| **Total** | **31** | - | **31** | **$1.40** |

### Annual Cost Projection

**Scenario: 500,000 audits/year**

**Without caching:**
- 500K audits × 31 calls × avg $0.045/call = **$697,500/year**

**With 7-day caching (86% hit rate):**
- 500K audits × 31 calls × 14% × $0.045 = **$97,650/year**
- **Savings: $599,850/year (86% reduction)**

---

### Hosting Costs

#### Supabase (Database + Auth + Edge Functions)

| Tier | Price/Month | Includes |
|------|-------------|----------|
| Free | $0 | 500MB DB, 2GB bandwidth, 500K Edge Function invocations |
| Pro | $25 | 8GB DB, 250GB bandwidth, 2M Edge Function invocations |
| Team | $599 | Dedicated CPU, 50GB DB, 1TB bandwidth |

**Projection for 500K audits/year:**
- **Pro tier** ($25/mo = $300/year) for first 50K audits
- **Team tier** ($599/mo = $7,188/year) for 500K audits
- **Estimated: $7,500/year**

---

#### Vercel (Frontend Hosting)

| Tier | Price/Month | Includes |
|------|-------------|----------|
| Hobby | $0 | 100GB bandwidth, serverless functions |
| Pro | $20/user | 1TB bandwidth, advanced analytics |
| Enterprise | Custom | Unlimited |

**Projection:**
- **Pro tier** for 5 users = $100/mo = **$1,200/year**

---

#### Redis (Upstash)

| Tier | Price/Month | Includes |
|------|-------------|----------|
| Free | $0 | 10K commands/day |
| Pay-as-you-go | $0.20/100K commands | + $0.20/GB storage |
| Pro | $280 | 10M commands/day, 10GB storage |

**Projection for 500K audits/year:**
- 500K audits × 31 API calls × 2 cache operations (get + set) = 31M cache operations/year
- 31M / 365 days = 85K operations/day
- **Pro tier**: $280/mo = **$3,360/year**

---

#### Neo4j (If Hybrid Approach)

| Tier | Price/Month | Includes |
|------|-------------|----------|
| AuraDB Free | $0 | 50K nodes, 175K relationships |
| Professional | $65 | 200K nodes, 400K relationships, 8GB RAM |
| Enterprise | Custom | Unlimited |

**Projection for 500K audits:**
- 500K companies × 10 entities/company = 5M nodes
- 5M nodes × 5 relationships = 25M relationships
- **Enterprise tier**: ~$2,000/mo = **$24,000/year**

**Note:** Only if hybrid approach chosen

---

### Total Annual Cost Breakdown

| Category | Without Caching | With 7-Day Caching |
|----------|-----------------|-------------------|
| **API Costs** | $697,500 | $97,650 |
| **Supabase** | $7,500 | $7,500 |
| **Vercel** | $1,200 | $1,200 |
| **Redis (Upstash)** | $3,360 | $3,360 |
| **Neo4j (Optional)** | $24,000 | $24,000 |
| **Monitoring (Datadog)** | $900 | $900 |
| **Total (without Neo4j)** | **$710,460** | **$110,610** |
| **Total (with Neo4j)** | **$734,460** | **$134,610** |

**Savings from caching: $599,850/year (86%)**

---

### Cost per Audit

**With caching:**
- $110,610 / 500,000 audits = **$0.22 per audit**

**Revenue potential:**
- If audits generate $150K average deal size
- 500K audits × 0.5% conversion = 2,500 deals
- 2,500 deals × $150K = **$375M pipeline influenced**
- ROI: $375M / $110K = **3,390x**

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Week 1-2: Security & Backend Setup**
- ✅ Set up Supabase Edge Functions
- ✅ Configure Google OAuth SSO
- ✅ Set up Upstash Redis
- ✅ Create API key management system
- ✅ Implement user roles & permissions

**Week 3-4: API Clients Migration**
- ✅ Move enrichment orchestrator to Edge Functions
- ✅ Implement Redis caching layer
- ✅ Add rate limiting per service
- ✅ Create job queue (Redis)
- ✅ Set up background worker

---

### Phase 2: Testing & Monitoring (Weeks 5-6)

**Week 5: Testing Infrastructure**
- ✅ Unit tests for all services (80%+ coverage)
- ✅ Integration tests for API clients
- ✅ E2E tests with Playwright
- ✅ Load testing (100 concurrent audits)

**Week 6: Logging & Monitoring**
- ✅ Structured logging with Pino
- ✅ Distributed tracing with OpenTelemetry
- ✅ Set up Grafana + Loki
- ✅ Cost tracking dashboard
- ✅ Error alerting (Slack webhooks)

---

### Phase 3: Features (Weeks 7-12)

**Week 7-8: Operational Features**
- ✅ Webhook notifications (Slack)
- ✅ Deduplication service
- ✅ Manual cache refresh
- ✅ Audit retry logic

**Week 9-10: User Experience**
- ✅ Real-time progress updates (WebSocket)
- ✅ User activity dashboard
- ✅ Cost attribution per team
- ✅ Audit history & filtering

**Week 11-12: Advanced Features**
- ✅ Batch enrichment (CSV upload)
- ✅ Export to CSV/PDF
- ✅ Scheduled audits (cron)
- ✅ API rate limit dashboard

---

### Phase 4: Scale & Optimize (Month 4+)

**Optional: Knowledge Graph (If Hybrid Chosen)**
- Month 4: Set up Neo4j Aura
- Month 5: Build ETL pipeline (PostgreSQL → Neo4j)
- Month 6: Add graph queries to UI

**Performance Tuning:**
- Week 13: Query optimization (add indexes)
- Week 14: Cache tuning (find optimal TTLs)
- Week 15: Load balancing & horizontal scaling

---

## Decision Matrix

### URGENT DECISIONS REQUIRED

| # | Decision | Options | Recommendation | By When |
|---|----------|---------|----------------|---------|
| 1 | **Database Strategy** | A) PostgreSQL only<br>B) Knowledge graph only<br>C) Hybrid | **C) Hybrid (PostgreSQL primary, Neo4j read replica)** | Week 1 |
| 2 | **Folder Structure** | A) Keep /frontend/<br>B) Rename to /arian/<br>C) Monorepo | **C) Monorepo (Month 3)** | Month 3 |
| 3 | **Caching Duration** | A) 24 hours<br>B) 7 days<br>C) 30 days | **B) 7 days** | Week 1 |
| 4 | **Neo4j Tier** | A) Don't use<br>B) Start Month 4<br>C) Start now | **B) Start Month 4** | Month 4 |

---

## Next Steps

### Immediate (This Week)

1. **Review this document** with engineering team
2. **Decide**: PostgreSQL only or Hybrid with Neo4j
3. **Set up**: Supabase Edge Functions + Redis
4. **Migrate**: Move API keys to server-side
5. **Implement**: Google OAuth SSO

### Week 1 Deliverables

- [ ] Supabase Edge Function skeleton deployed
- [ ] Redis cache operational
- [ ] API keys secured (not in frontend)
- [ ] Google SSO working
- [ ] Job queue processing first enrichment

---

**Last Updated**: March 6, 2026
**Status**: Awaiting architectural decisions
**Owner**: Engineering Leadership
**Next Review**: Week 1 kickoff meeting
