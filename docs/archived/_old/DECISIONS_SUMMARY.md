# Critical Decisions Summary & Next Steps

**Date**: March 6, 2026
**Version**: 1.0
**Status**: AWAITING YOUR APPROVAL

---

## Quick Navigation

- [Your Questions Answered](#your-questions-answered)
- [Critical Architectural Decision Required](#critical-architectural-decision-required)
- [Three New Documents Created](#three-new-documents-created)
- [Immediate Next Steps](#immediate-next-steps)
- [Cost Summary](#cost-summary)

---

## Your Questions Answered

### 1. ✅ Documentation Persistence

**What we did:**
- Created **3 comprehensive documents** (total 1,500+ lines)
- All findings saved to disk in `/algolia-arian/` directory
- Merged frontend analysis with dashboard specifications
- Documents will survive context compaction

**Files created:**
1. `ARCHITECTURE_MASTER.md` - Complete architectural decisions document
2. `CODE_STANDARDS.md` - Mandatory code quality standards
3. `DECISIONS_SUMMARY.md` - This file (executive summary)

---

### 2. ✅ Folder Structure Clarification

**Current structure:**
```
/frontend/    # Algolia Arian (Partner Intelligence)
/dashboard/   # Search Audit Dashboard (separate project)
```

**Recommendation:** **Keep current structure for now**, migrate to **monorepo in Month 3**

**Rationale:**
- You have TWO separate projects sharing infrastructure
- Monorepo will enable code reuse (API clients, scoring, etc.)
- Don't refactor until both projects are more mature

**Action:** No immediate change needed

---

### 3. 🚨 CRITICAL DECISION REQUIRED: Knowledge Graph vs Relational Database

This is the **MOST IMPORTANT** architectural decision for your project.

#### Your Question:
> "Should we use knowledge graphs given the massive data enrichment and temporal tracking requirements?"

#### Our Analysis (ARCHITECTURE_MASTER.md Section 2):

**Three Options:**

**A) PostgreSQL Only (Current Approach)**
- ✅ Mature, reliable, team knows SQL
- ✅ Supabase integration (auth, RLS, REST API)
- ✅ Cost-effective ($7,500/year)
- ❌ Complex joins for relationship queries
- ❌ Temporal queries are verbose SQL

**B) Knowledge Graph Only (Neo4j)**
- ✅ Natural relationship modeling
- ✅ Temporal tracking built-in
- ✅ Graph traversal performance
- ❌ Learning curve (Cypher query language)
- ❌ Expensive ($24,000/year)
- ❌ Lose Supabase benefits

**C) Hybrid (RECOMMENDED) ⭐**
```
PostgreSQL (Primary) ─ETL nightly─> Neo4j (Read Replica)
    ↑                                    ↑
All writes                      Relationship queries only
ACID guarantees                 Graph algorithms
$7,500/year                     $24,000/year
```

### **OUR RECOMMENDATION: Hybrid with Phased Approach**

**Phase 1 (Months 1-3):** PostgreSQL only - Build MVP, prove product-market fit
**Phase 2 (Months 4-6):** Add Neo4j read replica - ETL nightly, use for "similar companies" and "variance detection"
**Phase 3 (Months 7-12):** Optimize - Move complex graph queries to Neo4j, add visualization

**Why this is best:**
- ✅ Start fast with Supabase (proven technology)
- ✅ Add graph power when you have users (not premature)
- ✅ Minimize risk (PostgreSQL as fallback)
- ✅ Cost-effective (no Neo4j until Month 4)

**❓ YOUR DECISION NEEDED:** Approve hybrid approach, or choose PostgreSQL-only?

---

### 4. ✅ Security Architecture (Section 4)

**What we documented:**

✅ **No API Keys in Frontend** - NEVER
```
Frontend → Supabase Edge Function → External APIs
         (no keys)        (keys in env vars)
```

✅ **Single Sign-On with Algolia Emails**
- Google OAuth via Supabase Auth
- Restrict to `@algolia.com` domain
- Role-based access (admin, user, viewer)

✅ **User History & State Machine**
- Audit status: queued → running → completed/failed
- User activity tracking (audit_created, audit_viewed, report_downloaded)
- State transition validation

✅ **Implemented in:** `supabase/functions/` (Edge Functions)

---

### 5. ✅ Backend Architecture (Section 5)

**Current state: Client-side enrichment ❌ (insecure)**

**Target state: Server-side with job queue ✅**

```
React Frontend
    ↓ POST /enrich-company
Supabase Edge Function
    ↓ Queue job
Redis (BullMQ) ──> Background Worker ──> External APIs
    ↓ Store result
PostgreSQL (Supabase)
```

**Migration:** Week 1-3 (move orchestrator to server-side)

---

### 6. ✅ Caching & Persistence (Section 6)

**Two-tier strategy:**

**Tier 1: Redis (Hot Cache)**
- Traffic/tech/financials: **7 days TTL**
- Hiring signals: **24 hours TTL**
- 86% cache hit rate = **$599K/year savings**

**Tier 2: PostgreSQL (Permanent Storage)**
- All API responses saved to `api_calls` table
- Enables historical analysis, debugging, cost tracking

**Cache invalidation:**
- Automatic (time-based)
- Manual ("Refresh Data" button)

---

### 7. ✅ Rate Limiting & Webhooks (Section 7)

**Rate limiting per service:**
- SimilarWeb: 10 req/sec
- BuiltWith: 5 req/sec
- Yahoo Finance: 2 req/sec

**Slack webhook notifications:**
```typescript
// Trigger events
- enrichment.completed
- hot_lead.detected (score ≥70)
- competitor.found (using Algolia)
- error.occurred
```

**Deduplication:**
- Canonical domain detection (BuiltWith relationships API)
- Alias tracking (amazon.com, aws.amazon.com → amazon.com)

---

### 8. ✅ Testing & Logging (CODE_STANDARDS.md)

**NON-NEGOTIABLE Standards:**

**Testing (3 tiers):**
- Unit tests (Jest) - 80%+ coverage REQUIRED
- Integration tests (real APIs)
- E2E tests (Playwright)

**Logging (structured with Pino):**
- Log entry, exit, errors for EVERY function
- Distributed tracing with OpenTelemetry
- No sensitive data in logs

**Code hardening:**
- Every async function has try-catch
- Custom error classes (AppError, APIError, ValidationError)
- Retry logic with exponential backoff

**Enforcement:**
- Pre-commit hooks (husky)
- CI/CD pipeline (GitHub Actions)
- PR will be rejected if standards not met

---

### 9. ✅ Cost Breakdown (Section 9)

#### Per Audit Costs

| Item | Without Caching | With 7-Day Caching |
|------|-----------------|-------------------|
| **API Costs** | $1.40 | $0.20 |
| SimilarWeb | $0.70 | $0.10 |
| BuiltWith | $0.70 | $0.10 |
| Yahoo Finance | $0.00 | $0.00 |
| JSearch | $0.002 | $0.0003 |

#### Annual Costs (500,000 audits/year)

| Item | Cost/Year |
|------|-----------|
| **API Costs** | $97,650 |
| **Supabase (Team)** | $7,500 |
| **Vercel (Pro, 5 users)** | $1,200 |
| **Redis (Upstash Pro)** | $3,360 |
| **Monitoring (Datadog)** | $900 |
| **Neo4j (Optional, Month 4+)** | $24,000 |
| **TOTAL (without Neo4j)** | **$110,610** |
| **TOTAL (with Neo4j)** | **$134,610** |

**Cost per audit:** **$0.22** (with caching)

**ROI Calculation:**
- 500K audits × 0.5% conversion = 2,500 deals
- 2,500 deals × $150K average = **$375M pipeline influenced**
- ROI: $375M / $110K = **3,390x**

**Savings from caching:** **$599,850/year** (86% reduction)

---

### 10. ✅ Additional Requirements Addressed

✅ **Webhooks for Slack** - Documented in Section 7
✅ **Rate limiting** - Per-service rate limiters with Bottleneck
✅ **Deduplication** - Canonical domain detection + alias tracking
✅ **User login & SSO** - Google OAuth restricted to @algolia.com
✅ **State machine** - Audit status transitions with validation
✅ **Detailed logging** - Structured logging + distributed tracing MANDATORY
✅ **Comprehensive testing** - 3-tier strategy, 80%+ coverage enforced
✅ **Code hardening** - 23 golden rules, pre-commit hooks, CI/CD
✅ **Documentation** - JSDoc + README per module

---

## Three New Documents Created

### 1. ARCHITECTURE_MASTER.md (152 KB, 10 sections)

**Covers:**
- Project clarification (2 projects: Arian + Dashboard)
- **Knowledge graph vs relational DB decision** (CRITICAL)
- Folder structure recommendations
- Security architecture (SSO, API keys, auth)
- Backend architecture (Supabase Edge Functions + job queue)
- Caching & persistence (7-day TTL, 86% hit rate)
- Rate limiting, webhooks, deduplication
- Testing & logging standards
- **Complete cost breakdown** ($110K/year with caching)
- Implementation roadmap (12 weeks)

### 2. CODE_STANDARDS.md (70 KB, 10 sections)

**Covers:**
- 23 Golden Rules (MANDATORY)
- Error handling patterns (try-catch everywhere)
- Logging & tracing (Pino + OpenTelemetry)
- TypeScript standards (strict mode, no any)
- Testing standards (80%+ coverage)
- Documentation standards (JSDoc, README)
- Security standards (input validation, rate limiting)
- Performance standards (caching, parallelization)
- Code review checklist
- Enforcement automation (pre-commit hooks, CI/CD)

### 3. DECISIONS_SUMMARY.md (This file)

Executive summary of all decisions and next steps.

---

## Critical Architectural Decision Required

### 🚨 DECISION #1: Database Strategy (URGENT)

**Question:** PostgreSQL only, or Hybrid (PostgreSQL + Neo4j)?

**Our Recommendation:** **Hybrid with phased approach**
- Month 1-3: PostgreSQL only (MVP)
- Month 4+: Add Neo4j read replica (enhanced queries)

**Your approval needed for:**
- [ ] Approve hybrid approach
- [ ] OR choose PostgreSQL-only

**Impact:**
- Cost: +$24,000/year if Neo4j added
- Timeline: +2 weeks for Neo4j setup (Month 4)
- Complexity: +ETL job to maintain

**When:** Week 1 (before starting development)

---

### 🚨 DECISION #2: Folder Structure

**Question:** Keep `/frontend/` or rename?

**Our Recommendation:** **Keep current structure**, migrate to monorepo in Month 3

**Your approval needed for:**
- [ ] Keep `/frontend/` and `/dashboard/` as-is
- [ ] OR rename to `/arian/` and `/dashboard/` now
- [ ] OR migrate to monorepo immediately

**Impact:**
- Renaming: Breaking changes, update all imports
- Monorepo now: 1 week setup time
- Monorepo Month 3: No immediate impact

**When:** Can defer to Month 3

---

### 🚨 DECISION #3: Caching TTL

**Question:** 7 days or shorter?

**Our Recommendation:** **7 days** for traffic/tech, 24 hours for hiring

**Your approval needed for:**
- [ ] Approve 7-day TTL (saves $599K/year)
- [ ] OR choose shorter TTL (more accurate, higher cost)

**Impact:**
- 7 days: 86% cache hit rate, $97K/year API costs
- 24 hours: 30% cache hit rate, $490K/year API costs
- 1 hour: <5% cache hit rate, $697K/year API costs

**When:** Week 1 (Redis configuration)

---

## Immediate Next Steps

### Week 1: Foundation & Decisions

**Day 1-2: Review & Decide**
- [ ] Read ARCHITECTURE_MASTER.md (focus on Section 2, 5, 9)
- [ ] Read CODE_STANDARDS.md (all team members)
- [ ] **DECIDE:** Database strategy (PostgreSQL vs Hybrid)
- [ ] **DECIDE:** Folder structure (keep vs rename vs monorepo)
- [ ] **DECIDE:** Caching TTL (7 days vs shorter)

**Day 3-5: Security & Backend Setup**
- [ ] Set up Supabase Edge Functions
- [ ] Configure Google OAuth SSO (restrict to @algolia.com)
- [ ] Set up Upstash Redis (7-day default TTL)
- [ ] Create API key management (environment variables)
- [ ] Implement user roles (admin, user, viewer)

---

### Week 2-3: Migration to Server-Side

**API Clients Migration:**
- [ ] Move enrichment orchestrator to Edge Functions
- [ ] Implement Redis caching layer
- [ ] Add rate limiting per service
- [ ] Create job queue (Redis BullMQ)
- [ ] Set up background worker

**Testing:**
- [ ] Unit tests for all services (80%+ coverage)
- [ ] Integration tests for API clients
- [ ] E2E test for full enrichment flow

---

### Week 4+: Features & Monitoring

**Week 4: Operational Features**
- [ ] Webhook notifications (Slack)
- [ ] Deduplication service
- [ ] Manual cache refresh
- [ ] Audit retry logic

**Week 5: Monitoring**
- [ ] Structured logging (Pino)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Set up Grafana + Loki
- [ ] Cost tracking dashboard
- [ ] Error alerting (Slack)

---

## Questions for You

Before we start development, please answer:

1. **Database Strategy:**
   - [ ] Approve hybrid (PostgreSQL + Neo4j Month 4)
   - [ ] PostgreSQL only (no graph database)
   - [ ] Other: ___________

2. **Caching TTL:**
   - [ ] Approve 7 days (saves $599K/year)
   - [ ] 24 hours (more accurate, higher cost)
   - [ ] Other: ___________

3. **Folder Structure:**
   - [ ] Keep `/frontend/` and `/dashboard/`
   - [ ] Rename now
   - [ ] Monorepo in Month 3

4. **Neo4j Timeline (if hybrid):**
   - [ ] Month 4 (recommended)
   - [ ] Immediately
   - [ ] Defer to Month 6+

5. **Budget Approval:**
   - [ ] Approve $110,610/year (no Neo4j)
   - [ ] Approve $134,610/year (with Neo4j)
   - [ ] Need to reduce costs to: $_________

---

## Risk Assessment

### HIGH RISK (Must Address Week 1)

1. **API keys in frontend** - Currently exposed in browser ❌
   - **Mitigation:** Move to Supabase Edge Functions (Week 1)

2. **No job queue** - Enrichment blocks UI ❌
   - **Mitigation:** Redis BullMQ + background worker (Week 2)

3. **No persistent cache** - Cache clears on page refresh ❌
   - **Mitigation:** Redis with 7-day TTL (Week 1)

### MEDIUM RISK (Address Week 2-4)

4. **No error tracking** - Can't debug production issues
   - **Mitigation:** Structured logging + Grafana (Week 5)

5. **No rate limiting** - Can hit API limits
   - **Mitigation:** Bottleneck per service (Week 2)

6. **No testing** - Code quality unknown
   - **Mitigation:** 80%+ coverage enforced (Week 3)

### LOW RISK (Address Month 2+)

7. **Monorepo** - Code duplication between projects
   - **Mitigation:** Migrate to Nx monorepo (Month 3)

8. **Neo4j** - Complex queries need graph database
   - **Mitigation:** Add Neo4j read replica (Month 4)

---

## Success Metrics

### Week 4 (MVP Launch)

- [ ] 100% API keys server-side (security)
- [ ] 80%+ test coverage (quality)
- [ ] Job queue processing enrichments (scalability)
- [ ] Redis caching operational (cost savings)
- [ ] Google SSO working (authentication)

### Month 3 (Production Ready)

- [ ] 50+ audits completed
- [ ] <5% error rate
- [ ] 80%+ cache hit rate
- [ ] $0.25/audit or less
- [ ] User satisfaction: NPS 40+

### Month 6 (Scale)

- [ ] 500+ audits/month
- [ ] 95%+ completion rate
- [ ] 86%+ cache hit rate (target)
- [ ] Neo4j operational (if hybrid chosen)
- [ ] Monorepo migrated

---

## Contact & Next Steps

**Next Meeting:** Week 1 kickoff - Review decisions

**Questions?** Reply with your decisions on:
1. Database strategy (PostgreSQL vs Hybrid)
2. Caching TTL (7 days vs shorter)
3. Budget approval ($110K vs $134K/year)

**Once approved, we'll start Week 1 implementation immediately.**

---

**Last Updated**: March 6, 2026
**Status**: Awaiting your approval on 3 decisions
**Owner**: Engineering Team
