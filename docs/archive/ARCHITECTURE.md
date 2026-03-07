# Algolia Arian - Architecture

**Version:** 4.0  
**Date:** March 6, 2026  
**Status:** Ready for Implementation  
**Scope:** 1,000 audits/year, $1,066 annual cost

---

## Table of Contents

1. [Overview](#overview)
2. [Database Strategy](#database-strategy)
3. [Backend Architecture](#backend-architecture)
4. [Security](#security)
5. [Caching Strategy](#caching-strategy)
6. [Cost Analysis](#cost-analysis)
7. [Implementation Roadmap](#implementation-roadmap)

---

## Overview

### Two Projects, Shared Infrastructure

**Algolia Arian** (Partner Intelligence Platform):
- Location: `/frontend/`
- Purpose: Find companies using partner tech who aren't using Algolia
- URL: https://algolia-arian.vercel.app

**Search Audit Dashboard** (SaaS Platform):
- Location: `/dashboard/`  
- Purpose: Automated search audit platform
- Status: Planning phase

Both projects share:
- Multi-source API enrichment (SimilarWeb, BuiltWith, Yahoo Finance)
- Composite scoring algorithms
- User authentication and team management

---

## Database Strategy

### Recommendation: PostgreSQL Only (for 1,000 audits/year)

**Why PostgreSQL:**
- ✅ Mature, reliable, team knows SQL
- ✅ Supabase integration (auth, RLS, REST API)
- ✅ Cost-effective ($0 on free tier for 1K audits/year)
- ✅ JSONB for flexible enrichment data
- ✅ Sufficient for current scale

**Future: Add Neo4j at 5K+ audits/year**
- Use hybrid approach when relationship queries become critical
- ETL from PostgreSQL → Neo4j nightly
- Keep PostgreSQL as primary, Neo4j as read replica

### Schema Overview

\`\`\`sql
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  domain VARCHAR(255) UNIQUE NOT NULL,
  company_name VARCHAR(255),
  
  -- Enrichment data (JSONB for flexibility)
  traffic_data JSONB,
  tech_stack JSONB,
  financial_data JSONB,
  hiring_signals JSONB,
  
  -- Computed scores
  icp_score INTEGER,
  composite_score JSONB,
  
  -- Metadata
  last_enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audits (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  status VARCHAR(50),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
\`\`\`

---

## Backend Architecture

### Current State → Target State

**Current (Insecure):**
```
React Frontend → External APIs (API keys exposed!)
```

**Target (Secure):**
```
React Frontend
    ↓ POST /enrich-company
Supabase Edge Function (Deno)
    ↓ Queue job
Redis (BullMQ)
    ↓ Process job
Background Worker → External APIs (keys secure)
    ↓ Store result
PostgreSQL (Supabase)
```

### Edge Functions Implementation

\`\`\`typescript
// supabase/functions/enrich-company/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_KEY')!
);

serve(async (req) => {
  const { domain } = await req.json();
  
  // Create audit record
  const { data: audit } = await supabase
    .from('audits')
    .insert({ company_domain: domain, status: 'queued' })
    .select()
    .single();
  
  // Queue job in Redis
  await redis.lpush('enrichment_queue', JSON.stringify({
    auditId: audit.id,
    domain
  }));
  
  return new Response(JSON.stringify({ auditId: audit.id }));
});
\`\`\`

### Background Worker

\`\`\`typescript
// workers/enrichment-worker.ts
async function processJob() {
  while (true) {
    const job = await redis.brpop('enrichment_queue', 0);
    const { auditId, domain } = JSON.parse(job[1]);
    
    // Run enrichment (reuse existing orchestrator)
    const result = await enrichmentOrchestrator.enrich(domain, 'standard');
    
    // Save result
    await supabase
      .from('audits')
      .update({ 
        status: 'completed',
        traffic_data: result.traffic,
        tech_stack_data: result.techStack
      })
      .eq('id', auditId);
  }
}
\`\`\`

---

## Security

### NON-NEGOTIABLE: No API Keys in Frontend

**NEVER:**
\`\`\`typescript
// ❌ WRONG - Exposed in browser bundle
const SIMILARWEB_API_KEY = 'sk_live_abc123';
\`\`\`

**ALWAYS:**
\`\`\`typescript
// ✅ CORRECT - Server-side only
// .env.local (NEVER commit)
SIMILARWEB_API_KEY=sk_live_abc123

// Edge Function
const apiKey = Deno.env.get('SIMILARWEB_API_KEY')!;
\`\`\`

### Single Sign-On (Google OAuth)

**Implementation:**

1. Configure Supabase Auth (Dashboard)
   - Enable Google OAuth provider
   - Add authorized domain: `algolia.com`

2. Frontend Sign-In
\`\`\`typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: {
        hd: 'algolia.com' // Restrict to Algolia domain
      }
    }
  });
}
\`\`\`

3. Row Level Security (RLS)
\`\`\`sql
CREATE POLICY "Only Algolia emails can access"
ON companies
FOR ALL
USING (
  auth.jwt()->>'email' LIKE '%@algolia.com'
);
\`\`\`

### User Roles

\`\`\`sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id),
  role VARCHAR(20) CHECK (role IN ('admin', 'user', 'viewer'))
);
\`\`\`

---

## Caching Strategy

### Two-Tier Caching

**Tier 1: Redis (Hot Cache) - 7 days**
\`\`\`typescript
const cacheKey = \`traffic:\${domain}:\${dateRange}\`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached); // Sub-50ms
}

// Cache miss - fetch from API
const data = await similarWebClient.getTrafficData(domain);

// Save to Redis (7-day TTL)
await redis.setex(cacheKey, 604800, JSON.stringify(data));
\`\`\`

**Tier 2: PostgreSQL (Permanent Storage)**
\`\`\`typescript
// Also save to database for historical analysis
await supabase.from('api_calls').insert({
  service: 'similarweb',
  endpoint: 'get-traffic-data',
  request_params: { domain },
  response_data: data,
  cost_usd: 0.05,
  called_at: new Date()
});
\`\`\`

### Cache Hit Rate at 1,000 Audits/Year

- **With 7-day TTL**: ~25% hit rate
- **API cost savings**: $350/year (25% of $1,400)
- **Net API cost**: $1,051/year

---

## Cost Analysis

### Per Audit Cost Breakdown

| Service | Endpoints | Cost/Call | Calls/Audit | Cost/Audit |
|---------|-----------|-----------|-------------|------------|
| SimilarWeb | 14 | $0.05 | 14 | $0.70 |
| BuiltWith | 7 | $0.10 | 7 | $0.70 |
| Yahoo Finance | 5 | $0.00 | 5 | $0.00 |
| JSearch | 2 | $0.001 | 2 | $0.002 |
| **Total** | **31** | - | **31** | **$1.40** |

**With 25% cache hit rate**: $1.40 × 75% = **$1.05 per audit**

### Annual Cost (1,000 Audits/Year)

| Category | Annual Cost |
|----------|-------------|
| **API Costs** | $1,051 |
| **Hosting (Free Tier)** | $15 (domain only) |
| **Monitoring** | $0 (Grafana free tier) |
| **Total** | **$1,066** |

**Cost per audit**: $1,066 / 1,000 = **$1.07**

### ROI Calculation

**Conservative estimate:**
- 1,000 audits/year
- 0.5% conversion = 5 deals
- $150K average deal size

**Pipeline influenced**: 5 × $150K = **$750,000**  
**ROI**: $750,000 / $1,066 = **704x**

### Free Tier Capacity

- Supabase free tier: 500K Edge Function invocations/month
- 1,000 audits/year × 31 API calls = 31K invocations/year
- **Using 0.5% of free tier capacity** ✅

**No paid hosting needed until 5,000+ audits/year**

---

## Implementation Roadmap

### Week 1-2: Foundation & Security

**Day 1-5: Backend Setup**
- [ ] Set up Supabase Edge Functions
- [ ] Configure Google OAuth SSO (restrict to @algolia.com)
- [ ] Set up Redis (Upstash free tier)
- [ ] Create environment variable management
- [ ] Implement user roles (admin, user, viewer)

**Day 6-10: Security Migration**
- [ ] Move API keys to Edge Functions
- [ ] Remove all API keys from frontend code
- [ ] Test SSO flow end-to-end
- [ ] Verify RLS policies

### Week 3-4: Job Queue & Enrichment

**Day 11-15: Job Queue**
- [ ] Implement Redis job queue (BullMQ)
- [ ] Create background worker
- [ ] Move enrichment orchestrator to server-side
- [ ] Add progress tracking

**Day 16-20: Rate Limiting & Caching**
- [ ] Implement rate limiting per service (Bottleneck)
- [ ] Add Redis caching layer (7-day TTL)
- [ ] Test cache hit rates
- [ ] Monitor API costs

### Week 5-6: Testing & Monitoring

**Day 21-25: Testing**
- [ ] Unit tests (80%+ coverage required)
- [ ] Integration tests (real API calls)
- [ ] E2E tests (Playwright)
- [ ] Load testing (100 concurrent audits)

**Day 26-30: Monitoring**
- [ ] Structured logging (Pino)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Set up Grafana + Loki
- [ ] Cost tracking dashboard
- [ ] Error alerting (Slack)

### Week 7-12: Features & Polish

**Week 7-8: Operational Features**
- [ ] Webhook notifications (Slack)
- [ ] Deduplication service
- [ ] Manual cache refresh
- [ ] Audit retry logic

**Week 9-10: User Experience**
- [ ] Real-time progress (WebSocket)
- [ ] User activity dashboard
- [ ] Audit history & filtering
- [ ] Export to CSV/PDF

**Week 11-12: Advanced Features**
- [ ] Batch enrichment (CSV upload)
- [ ] Scheduled audits (cron)
- [ ] API rate limit dashboard
- [ ] Cost attribution per team

---

## Key Technologies

| Component | Technology | Why |
|-----------|------------|-----|
| **Frontend** | React + TypeScript + Vite | Team expertise, fast development |
| **Database** | PostgreSQL (Supabase) | Mature, cost-effective, JSONB flexibility |
| **API** | Supabase REST API + Edge Functions | Auto-generated, serverless |
| **Cache** | Redis (Upstash) | Fast, serverless, free tier |
| **Queue** | BullMQ | Reliable, feature-rich |
| **Logging** | Pino + OpenTelemetry | Structured, distributed tracing |
| **Monitoring** | Grafana + Loki | Free, powerful |
| **Hosting** | Vercel | Auto-deploy, free tier |

---

## Critical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | PostgreSQL only | Sufficient for 1K audits, free tier |
| **Graph DB** | Defer to 5K+ audits | Not needed at current scale |
| **Caching TTL** | 7 days | 25% savings, acceptable freshness |
| **Infrastructure** | Free tier | Using 0.5% of capacity |
| **Backend** | Edge Functions + Workers | Serverless, secure, cost-effective |

---

**Last Updated**: March 6, 2026  
**Status**: Ready for Week 1 implementation  
**Budget**: $1,066/year approved
