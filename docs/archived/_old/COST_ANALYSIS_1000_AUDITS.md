# Cost Analysis: 1,000 Audits per Year

**Date**: March 6, 2026
**Scenario**: Small-scale deployment (1,000 audits/year)
**Status**: Realistic budget for approval

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Capital Investment (One-Time)](#capital-investment-one-time)
3. [Annual Operating Costs](#annual-operating-costs)
4. [Cost per Audit Breakdown](#cost-per-audit-breakdown)
5. [Scaling Economics](#scaling-economics)
6. [Cost Optimization Strategies](#cost-optimization-strategies)
7. [Budget Scenarios](#budget-scenarios)

---

## Executive Summary

### Total Cost Ownership (Year 1)

| Category | Amount |
|----------|--------|
| **Capital Investment (One-Time)** | $0 - $5,000 |
| **Annual Operating Costs** | $1,800 - $2,400 |
| **API Costs (1,000 audits)** | $1,050 - $1,400 |
| **Total Year 1** | **$2,850 - $8,800** |

### Cost per Audit

| Scenario | Cost per Audit |
|----------|----------------|
| **Minimum (Free tiers)** | $1.05 |
| **Typical (Pro tiers)** | $2.25 |
| **Maximum (Paid tiers)** | $3.80 |

**Bottom Line:** At 1,000 audits/year, you can operate for **$2,000-$3,000/year total** on free/hobby tiers.

---

## Capital Investment (One-Time)

### Option A: Zero Capital Investment ✅ RECOMMENDED

**Use existing team, free/hobby tiers, no external hires**

| Item | Cost | Notes |
|------|------|-------|
| Development | $0 | Internal team (opportunity cost only) |
| Infrastructure Setup | $0 | Supabase free tier, Vercel hobby tier |
| Testing Tools | $0 | Jest, Vitest, Playwright (open source) |
| Documentation | $0 | Markdown, GitHub |
| **Total** | **$0** | |

**Timeline:** 6-8 weeks with 1 full-time engineer

---

### Option B: Accelerated Build ($5,000)

**If you need faster time-to-market (4 weeks instead of 8)**

| Item | Cost | Notes |
|------|------|-------|
| External Contractor | $4,000 | 2 weeks @ $2,000/week (part-time expert) |
| Premium Tools | $500 | Datadog trial, premium testing tools |
| Buffer | $500 | Unexpected costs |
| **Total** | **$5,000** | |

**Timeline:** 4 weeks with 1 FTE + 1 contractor

---

### Option C: Enterprise Build ($20,000) - NOT RECOMMENDED for 1,000 audits

Only if you need enterprise features day 1 (not necessary)

---

## Annual Operating Costs

### Hosting & Infrastructure (Annual)

#### Scenario 1: Free Tier (RECOMMENDED for 1,000 audits) ✅

| Service | Tier | Cost/Month | Cost/Year | What You Get |
|---------|------|------------|-----------|--------------|
| **Supabase** | Free | $0 | $0 | 500MB DB, 2GB bandwidth, 500K Edge Function invocations |
| **Vercel** | Hobby | $0 | $0 | 100GB bandwidth, unlimited deployments |
| **Redis (Upstash)** | Free | $0 | $0 | 10K commands/day, 256MB storage |
| **Monitoring** | Free | $0 | $0 | Grafana Cloud free tier, Upstash dashboard |
| **Domain** | - | $1.25 | $15 | .app domain (optional) |
| **SSL** | - | $0 | $0 | Let's Encrypt (free) |
| **Total** | | **$1.25** | **$15** | |

**Capacity:** Supports up to 5,000 audits/year on free tiers

---

#### Scenario 2: Pro Tier (If you grow past 1,000 audits)

| Service | Tier | Cost/Month | Cost/Year | What You Get |
|---------|------|------------|-----------|--------------|
| **Supabase** | Pro | $25 | $300 | 8GB DB, 250GB bandwidth, 2M Edge Function invocations |
| **Vercel** | Pro (1 seat) | $20 | $240 | 1TB bandwidth, advanced analytics |
| **Redis (Upstash)** | Pay-as-go | $5 | $60 | ~30K commands/day, 1GB storage |
| **Monitoring** | Grafana Cloud | $0 | $0 | Still free tier |
| **Domain** | - | $1.25 | $15 | |
| **Total** | | **$51.25** | **$615** | |

**Capacity:** Supports up to 50,000 audits/year

---

### API Costs (Per Audit)

#### API Cost Breakdown

| Service | Endpoints | Cost/Call | Calls/Audit | Cost/Audit |
|---------|-----------|-----------|-------------|------------|
| **SimilarWeb** | 14 | $0.05 | 14 | $0.70 |
| **BuiltWith** | 7 | $0.10 | 7 | $0.70 |
| **Yahoo Finance** | 5 | $0.00 | 5 | $0.00 |
| **SEC Edgar** | 3 | $0.00 | 3 | $0.00 |
| **JSearch** | 2 | $0.001 | 2 | $0.002 |
| **Total** | **31** | - | **31** | **$1.402** |

---

#### Annual API Costs (1,000 audits)

**Without Caching:**
```
1,000 audits × $1.402 = $1,402/year
```

**With 7-Day Caching:**

At 1,000 audits/year on mostly unique companies:
- **Cache hit rate:** ~25% (not 86% like high-volume scenario)
- **Fresh API calls needed:** 1,000 × 75% = 750 audits
- **API cost:** 750 × $1.402 = **$1,051.50/year**

**Savings from caching:** $350/year (25% reduction)

---

**IMPORTANT:** At low volume, caching helps less because you're not auditing the same companies repeatedly.

---

## Cost per Audit Breakdown

### Minimum Cost per Audit (Free Tiers) ✅

| Item | Cost | Calculation |
|------|------|-------------|
| **API calls** | $1.05 | $1.402 × 75% (with caching) |
| **Hosting (allocated)** | $0.015 | $15/year ÷ 1,000 audits |
| **Total** | **$1.07** | |

---

### Typical Cost per Audit (Pro Tiers)

| Item | Cost | Calculation |
|------|------|-------------|
| **API calls** | $1.05 | $1.402 × 75% (with caching) |
| **Hosting (allocated)** | $0.615 | $615/year ÷ 1,000 audits |
| **Monitoring** | $0.00 | Free tier |
| **Total** | **$1.67** | |

---

### Maximum Cost per Audit (No Caching)

| Item | Cost | Calculation |
|------|------|-------------|
| **API calls** | $1.40 | Full API cost, no cache |
| **Hosting (allocated)** | $0.615 | $615/year ÷ 1,000 audits |
| **Neo4j (if added)** | $2.00 | $2,000/year ÷ 1,000 audits |
| **Total** | **$4.02** | |

---

## Annual Cost Summary (1,000 Audits)

### Year 1 Budget (RECOMMENDED) ✅

| Category | Amount | Notes |
|----------|--------|-------|
| **Capital Investment** | $0 | Use internal team, free tools |
| **Hosting (Free Tier)** | $15 | Domain only |
| **API Costs (with caching)** | $1,051 | 750 audits × $1.402 |
| **Monitoring** | $0 | Grafana free tier |
| **Total Year 1** | **$1,066** | |

**Cost per audit:** $1.07

---

### Year 1 Budget (With Pro Tiers)

| Category | Amount | Notes |
|----------|--------|-------|
| **Capital Investment** | $0 | Internal team |
| **Hosting (Pro Tier)** | $615 | Supabase Pro + Vercel Pro + Upstash |
| **API Costs (with caching)** | $1,051 | 750 audits × $1.402 |
| **Monitoring** | $0 | Free tier |
| **Total Year 1** | **$1,666** | |

**Cost per audit:** $1.67

---

### Year 1 Budget (Maximum, with Neo4j)

| Category | Amount | Notes |
|----------|--------|-------|
| **Capital Investment** | $5,000 | External contractor for speed |
| **Hosting (Pro Tier)** | $615 | |
| **API Costs (no caching)** | $1,402 | Worst case |
| **Neo4j (Starter)** | $65/mo × 12 | $780 | AuraDB Professional tier |
| **Monitoring (Datadog)** | $75/mo × 12 | $900 | If needed |
| **Total Year 1** | **$8,697** | |

**Cost per audit:** $8.70 (inflated by one-time $5K capital)

---

## Scaling Economics

### Cost at Different Volumes

| Annual Audits | API Cost | Hosting | Total/Year | Cost/Audit |
|---------------|----------|---------|------------|------------|
| **100** | $105 | $15 | $120 | $1.20 |
| **500** | $526 | $15 | $541 | $1.08 |
| **1,000** ✅ | $1,051 | $15 | $1,066 | $1.07 |
| **5,000** | $5,256 | $615 | $5,871 | $1.17 |
| **10,000** | $10,512 | $615 | $11,127 | $1.11 |
| **50,000** | $52,560 | $7,500 | $60,060 | $1.20 |
| **100,000** | $105,120 | $7,500 | $112,620 | $1.13 |

**Insight:** Cost per audit is remarkably consistent ($1.07-$1.20) across volumes due to:
- Linear API costs (no volume discounts at this scale)
- Fixed hosting costs get amortized

---

### Break-Even Analysis

**When does caching pay for itself?**

- Cache infrastructure: $0/year (Upstash free tier)
- Savings per cached audit: $1.402 × 25% = $0.35
- Break-even: Immediate (no upfront cost)

**When does Pro tier pay for itself?**

- Pro tier upgrade: $600/year
- Capacity: 2M Edge Function invocations (vs 500K free)
- Break-even: ~1,500 audits/year (when free tier limit hit)

**Recommendation:** Start on free tier, upgrade when you hit 1,500 audits/year

---

## Cost Optimization Strategies

### 1. Minimize API Calls ✅

**Current:** 31 API calls per audit

**Optimization:** Make some API calls optional

```typescript
// Standard enrichment (20 calls)
- SimilarWeb: 8 core endpoints (not all 14)
- BuiltWith: 5 core endpoints (not all 7)
- Yahoo Finance: 5 endpoints
- JSearch: 2 endpoints

// Deep enrichment (31 calls)
- All endpoints
```

**Savings:** $0.55 per standard audit (39% reduction)

---

### 2. Aggressive Caching ✅

**Current:** 25% cache hit rate (1,000 unique companies/year)

**Optimization:** Audit high-value companies quarterly

```
If you audit top 100 companies 4x/year:
- 100 companies × 4 audits = 400 audits
- First audit: 100 fresh API calls
- Subsequent 3 audits: 300 cached (if within 7 days)
- Remaining 600 audits: mostly unique (low cache hit)

Total fresh API calls: 100 + (300 × 0%) + (600 × 75%) = 550
API cost: 550 × $1.402 = $771/year
Savings: $280/year (27% reduction)
```

---

### 3. Use Free APIs Where Possible ✅

**Already doing:**
- ✅ Yahoo Finance (free)
- ✅ SEC Edgar (free)

**Could add:**
- Clearbit (free tier: 50 calls/month)
- HunterIO (free tier: 50 emails/month)
- LinkedIn scraping (free, but rate-limited)

---

### 4. Batch Processing ✅

**Optimization:** Queue audits, process in batches

```typescript
// Instead of: Real-time audit (31 API calls immediately)
// Do: Batch audit (31 API calls spread over 1 hour)

Benefits:
- Better rate limit management
- Fewer 429 errors (rate limit)
- No performance benefit at 1,000 audits/year
```

**Savings:** $0 (no cost savings, but better reliability)

---

### 5. Negotiate Volume Discounts (Not Applicable Yet)

**SimilarWeb volume pricing:**
- < 10K calls/month: $0.05/call
- 10K-100K calls/month: $0.04/call (20% discount)
- \> 100K calls/month: $0.03/call (40% discount)

**At 1,000 audits/year:**
- 1,000 × 14 SimilarWeb calls = 14,000 calls/year = 1,167 calls/month
- Below volume discount threshold

**Break-even:** 10,000 audits/year (120K calls/year = 10K/month)

---

## Budget Scenarios

### Scenario A: Minimal Budget (FREE TIER) ✅ RECOMMENDED

**Who:** Small team, proof-of-concept, low volume

| Category | Annual Cost |
|----------|-------------|
| **Hosting** | $15 (domain only) |
| **API Costs** | $1,051 (1,000 audits with caching) |
| **Total** | **$1,066** |

**Cost per audit:** $1.07

**What you get:**
- ✅ 1,000 audits/year capacity
- ✅ 7-day caching
- ✅ Supabase auth + database
- ✅ Vercel hosting
- ✅ Redis caching

**What you don't get:**
- ❌ Advanced analytics
- ❌ Priority support
- ❌ SLA guarantees

---

### Scenario B: Professional ($1,700/year)

**Who:** Production use, moderate volume, need reliability

| Category | Annual Cost |
|----------|-------------|
| **Hosting (Pro)** | $615 |
| **API Costs** | $1,051 |
| **Monitoring** | $0 (free tier) |
| **Total** | **$1,666** |

**Cost per audit:** $1.67

**What you get:**
- ✅ 5,000 audits/year capacity
- ✅ SLA guarantees (99.9% uptime)
- ✅ Advanced analytics
- ✅ Priority support

---

### Scenario C: Enterprise ($3,500/year) - NOT RECOMMENDED

**Who:** High volume (5K+ audits/year), need graph database

| Category | Annual Cost |
|----------|-------------|
| **Hosting (Team)** | $7,500/year ÷ 5 = $1,500 (allocated) |
| **API Costs** | $1,051 |
| **Neo4j (Professional)** | $780 |
| **Monitoring (Datadog)** | $900 |
| **Total** | **$4,231** |

**Cost per audit:** $4.23

**Not recommended for 1,000 audits/year** - only makes sense at 10K+ audits

---

## Total Cost of Ownership (3-Year View)

### Scenario A: Free Tier

| Year | Capital | Operating | API | Total/Year | Cumulative |
|------|---------|-----------|-----|------------|------------|
| **Year 1** | $0 | $15 | $1,051 | $1,066 | $1,066 |
| **Year 2** | $0 | $15 | $1,051 | $1,066 | $2,132 |
| **Year 3** | $0 | $15 | $1,051 | $1,066 | $3,198 |

**3-year TCO:** $3,198 (at 1,000 audits/year)

---

### Scenario B: Pro Tier

| Year | Capital | Operating | API | Total/Year | Cumulative |
|------|---------|-----------|-----|------------|------------|
| **Year 1** | $0 | $615 | $1,051 | $1,666 | $1,666 |
| **Year 2** | $0 | $615 | $1,051 | $1,666 | $3,332 |
| **Year 3** | $0 | $615 | $1,051 | $1,666 | $4,998 |

**3-year TCO:** $4,998 (at 1,000 audits/year)

---

## ROI Analysis (1,000 Audits)

### Investment

**Year 1 (Free Tier):** $1,066

**Year 1 (Pro Tier):** $1,666

---

### Returns

**Assumptions:**
- 1,000 audits/year
- 0.5% conversion rate (5 deals from 1,000 audits)
- $150K average deal size

**Pipeline influenced:**
```
1,000 audits × 0.5% conversion = 5 deals
5 deals × $150K = $750,000 pipeline
```

**ROI:**
```
Free Tier: $750K / $1,066 = 704x ROI
Pro Tier: $750K / $1,666 = 450x ROI
```

**Payback period:** < 1 month (after first deal closes)

---

## Hidden Costs to Consider

### 1. Development Time (Opportunity Cost)

**If internal team:**
- 6-8 weeks @ 1 FTE
- Opportunity cost: ~$10K-$15K (salary allocated)
- Not a cash cost, but real cost

**Recommendation:** Track as capital investment if approved

---

### 2. Maintenance (Ongoing)

**Annual maintenance effort:**
- Dependency updates: 2 hours/month = 24 hours/year
- Bug fixes: 4 hours/month = 48 hours/year
- Feature requests: 8 hours/month = 96 hours/year
- **Total:** 168 hours/year = ~$25K/year at $150/hour

**Recommendation:** Allocate 20% of 1 FTE for maintenance

---

### 3. Support & Training

**One-time:**
- User training: 4 hours
- Documentation: 8 hours
- **Total:** 12 hours = ~$1,800

**Ongoing:**
- User support: 2 hours/month = 24 hours/year = ~$3,600/year

---

### 4. Data Storage Growth

**Storage needs:**
- 1,000 audits/year × 150 KB/audit = 150 MB/year
- 3 years = 450 MB
- **Free tier:** 500 MB (sufficient for 3 years)

**Cost:** $0 for 3 years on free tier

---

## Final Recommendations

### For 1,000 Audits/Year ✅

**Recommended Configuration:**

| Component | Choice | Annual Cost |
|-----------|--------|-------------|
| **Infrastructure** | Free tier (Supabase + Vercel + Upstash) | $15 |
| **API Strategy** | 7-day caching | $1,051 |
| **Monitoring** | Grafana free tier | $0 |
| **Database** | PostgreSQL only (no Neo4j) | $0 |
| **Total** | | **$1,066** |

**Cost per audit:** $1.07

---

### When to Upgrade

**Upgrade to Pro tier when:**
- ✅ Exceeding 1,500 audits/year
- ✅ Need SLA guarantees
- ✅ Running out of Edge Function invocations (500K free tier limit)

**Add Neo4j when:**
- ✅ Exceeding 5,000 audits/year
- ✅ Need temporal variance queries ("what changed in 6 months?")
- ✅ Building graph visualization features

---

### Budget Approval Request

**Year 1 Budget Request:**

| Category | Amount | Justification |
|----------|--------|---------------|
| **Operating Costs** | $1,066 | API calls + hosting (1,000 audits) |
| **Contingency (20%)** | $213 | Buffer for overages |
| **Total Request** | **$1,279** | |

**Expected ROI:** 585x ($750K pipeline / $1,279 cost)

**Payback period:** < 1 month

---

## Summary Table: All Scenarios

| Scenario | Year 1 Cost | Cost/Audit | Capacity | When to Use |
|----------|-------------|------------|----------|-------------|
| **Free Tier** ✅ | $1,066 | $1.07 | 5,000 audits/year | Proof-of-concept, low volume |
| **Pro Tier** | $1,666 | $1.67 | 50,000 audits/year | Production, need SLA |
| **Enterprise** | $4,231 | $4.23 | 100K+ audits/year | High volume, graph DB |

**Recommendation for 1,000 audits/year:** **Free Tier** ($1,066 total)

---

**Last Updated:** March 6, 2026
**Status:** Realistic budget for approval
**Next Step:** Get approval for $1,279 (includes 20% contingency)
