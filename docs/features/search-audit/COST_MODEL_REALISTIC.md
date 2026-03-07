# Cost Model - Realistic Projections

**Date**: March 6, 2026
**Status**: Revised with realistic scale assumptions
**Previous Error**: Assumed 500K audits/year (unrealistic)

---

## Critical Corrections

### ❌ Previous Assumption: 500K Audits/Year

**Why this was wrong**:
- 500K audits = 1,000 users × 500 audits each
- That's 10 audits/week per user (completely unrealistic)
- Most users run 1-2 audits/month maximum

---

### ✅ Realistic Scale Projections

| Year | Users | Audits/User/Month | Total Audits/Year |
|------|-------|-------------------|-------------------|
| **Year 1** | 10 (pilot) | 0.5 | **60 audits** |
| **Year 2** | 50 (rollout) | 1.0 | **600 audits** |
| **Year 3** | 150 (scale) | 1.5 | **2,700 audits** |

**Year 3 stretch goal**: 200 users × 2 audits/month = **4,800 audits/year**

---

## Cost Structure Breakdown

### 1. Capital Investment (One-Time)

**Development** (12 weeks):
| Item | Cost |
|------|------|
| Backend development (API clients, orchestrator, job queue) | $48,000 |
| Frontend development (React UI, WebSocket, dashboards) | $32,000 |
| Database design & migrations | $8,000 |
| Testing & QA | $8,000 |
| **Total Development** | **$96,000** |

**Infrastructure Setup** (One-Time):
| Item | Cost |
|------|------|
| AWS/Vercel account setup | $500 |
| Redis cluster provisioning | $1,000 |
| Monitoring setup (Datadog/CloudWatch) | $1,500 |
| CI/CD pipeline (GitHub Actions) | $1,000 |
| Documentation & training materials | $1,000 |
| **Total Setup** | **$5,000** |

**Total Capital Investment**: **$101,000**

---

### 2. Infrastructure Costs (Recurring Monthly)

**Year 1-2** (Small scale: <1,000 audits/year):

| Service | Monthly Cost | Annual Cost |
|---------|-------------|-------------|
| **Compute** (AWS EC2 t3.medium or Vercel Pro) | $100 | $1,200 |
| **Redis Cache** (AWS ElastiCache cache.t3.micro) | $15 | $180 |
| **PostgreSQL** (Supabase Pro) | $25 | $300 |
| **File Storage** (S3 for PDFs/screenshots, 100GB) | $23 | $276 |
| **Monitoring** (Datadog free tier or CloudWatch) | $0 | $0 |
| **CDN** (CloudFlare free tier) | $0 | $0 |
| **Total Year 1-2 Infrastructure** | **$163/month** | **$1,956/year** |

---

**Year 3** (Medium scale: 2,700-4,800 audits/year):

| Service | Monthly Cost | Annual Cost |
|---------|-------------|-------------|
| **Compute** (AWS EC2 t3.large or Vercel Enterprise) | $200 | $2,400 |
| **Redis Cache** (AWS ElastiCache cache.t3.small) | $30 | $360 |
| **PostgreSQL** (Supabase Pro with add-ons) | $50 | $600 |
| **File Storage** (S3 for PDFs/screenshots, 500GB) | $115 | $1,380 |
| **Monitoring** (Datadog Pro) | $31 | $372 |
| **CDN** (CloudFlare Pro) | $20 | $240 |
| **Total Year 3 Infrastructure** | **$446/month** | **$5,352/year** |

---

### 3. API Subscription Costs (Annual)

**Required Subscriptions**:

| Service | Plan | Annual Cost | Included Credits |
|---------|------|-------------|------------------|
| **SimilarWeb** | Business (required for API) | $2,400 | 500 API calls/month |
| **BuiltWith** | API access (pay-as-you-go) | $0 base | Pay per call |
| **Yahoo Finance** | Free (public API) | $0 | Unlimited |
| **SEC Edgar** | Free (public API) | $0 | Rate limited (10 req/sec) |
| **Apify** | Team plan | $5,988 | 1,000 compute units |
| **Apollo.io** | Professional (API access) | $1,200 | 10,000 API calls/month |
| **Total Subscriptions** | | **$9,588/year** | |

---

### 4. API Usage Costs (Per Audit)

**Calls per audit**:

| Service | Calls/Audit | Cost/Call | Cost/Audit (no cache) | Cost/Audit (cached 50%) |
|---------|-------------|-----------|----------------------|------------------------|
| **SimilarWeb** | 14 | $0.05 | $0.70 | **$0.35** |
| **BuiltWith** | 7 | $0.10 | $0.70 | **$0.35** |
| **Yahoo Finance** | 5 | $0 | $0 | **$0** |
| **SEC Edgar** | 3 | $0 | $0 | **$0** |
| **Apify** (3 actors) | 3 | $0.35 | $1.05 | **$0.53** |
| **Apollo.io** | 2 | $0.50 | $1.00 | **$0.50** |
| **Total Per Audit** | 34 | - | **$3.45** | **$1.73** |

**Caching assumptions**:
- SimilarWeb, BuiltWith: 7-day cache, 50% hit rate
- Yahoo Finance, SEC Edgar: 7-day cache, 70% hit rate (stable data)
- Apify: 24hr cache, 30% hit rate (social changes daily)
- Apollo.io: 7-day cache, 50% hit rate

**Conservative estimate**: **$1.73 per audit** (with caching)

---

### 5. Total Annual Cost Projections

#### Year 1: Pilot (60 Audits)

| Cost Category | Amount |
|---------------|--------|
| **Capital Investment** | $101,000 (one-time) |
| Infrastructure (compute, storage, database) | $1,956 |
| API Subscriptions (SimilarWeb, Apify, Apollo) | $9,588 |
| API Usage (60 audits × $1.73) | $104 |
| **Total Year 1** | **$112,648** |
| **Ongoing (Year 2+)** | **$11,648** |

---

#### Year 2: Rollout (600 Audits)

| Cost Category | Amount |
|---------------|--------|
| Infrastructure | $1,956 |
| API Subscriptions | $9,588 |
| API Usage (600 audits × $1.73) | $1,038 |
| **Total Year 2** | **$12,582** |

**Cost per audit**: $12,582 ÷ 600 = **$21/audit**

---

#### Year 3: Scale (2,700 Audits)

| Cost Category | Amount |
|---------------|--------|
| Infrastructure (scaled up) | $5,352 |
| API Subscriptions | $9,588 |
| API Usage (2,700 audits × $1.73) | $4,671 |
| **Total Year 3** | **$19,611** |

**Cost per audit**: $19,611 ÷ 2,700 = **$7.26/audit**

---

#### Year 3 Stretch (4,800 Audits)

| Cost Category | Amount |
|---------------|--------|
| Infrastructure (scaled up) | $5,352 |
| API Subscriptions | $9,588 |
| API Usage (4,800 audits × $1.73) | $8,304 |
| **Total Year 3** | **$23,244** |

**Cost per audit**: $23,244 ÷ 4,800 = **$4.84/audit**

---

## Cost Comparison: CLI vs SaaS

### Current State (CLI Skill)

| Metric | Value |
|--------|-------|
| Audits/year | 10-15 |
| Time per audit | 40 hours (manual) |
| Labor cost per audit | $2,000 (at $50/hour) |
| **Annual cost** | **$30,000** (15 audits × $2,000) |

---

### SaaS Platform (Year 2)

| Metric | Value |
|--------|-------|
| Audits/year | 600 |
| Time per audit | 35 minutes (automated) |
| Cost per audit | $21 |
| **Annual cost** | **$12,582** |

**ROI**: 40x more audits at 58% lower cost

---

### SaaS Platform (Year 3)

| Metric | Value |
|--------|-------|
| Audits/year | 2,700 |
| Time per audit | 35 minutes (automated) |
| Cost per audit | $7.26 |
| **Annual cost** | **$19,611** |

**ROI**: 180x more audits at 35% of CLI cost

---

## Cost Optimization Strategies

### 1. Aggressive Caching (Already Planned)

**Impact**: 50% cost reduction on API calls
- 7-day cache for stable data (traffic, tech stack, financials)
- 24hr cache for dynamic data (job postings, social engagement)

**Savings**: $1.73/audit (vs $3.45 without caching) = **50% reduction**

---

### 2. Batch Processing (Future Optimization)

**Opportunity**: Run overnight batch jobs for popular companies
- Pre-warm cache for Fortune 500 companies
- Run audits during off-peak hours (cheaper compute)

**Estimated savings**: 10-20% on compute costs

---

### 3. Tiered Pricing (Future)

**Different audit tiers**:
- **Quick Audit** (Phase 1 only): 10 minutes, $0.50 (skip browser testing)
- **Standard Audit** (Phases 1-4): 25 minutes, $1.20 (skip deliverables)
- **Full Audit** (All 5 phases): 35 minutes, $1.73

**Impact**: Let users choose depth vs cost

---

### 4. Annual Commit Discounts

**Negotiate with vendors**:
- SimilarWeb: Pre-pay for 5,000 calls → 20% discount
- Apify: Annual plan → 15% discount
- Apollo.io: Annual commit → 25% discount

**Estimated savings**: $2,000-$3,000/year at Year 3 scale

---

## Break-Even Analysis

### When does SaaS pay for itself?

**Capital investment**: $101K
**Annual savings vs CLI**:
- Year 1: $30K (CLI) - $12.6K (SaaS) = $17.4K savings
- Year 2: $30K - $12.6K = $17.4K savings
- Year 3: $30K - $19.6K = $10.4K savings

**Payback period**: $101K ÷ $17.4K/year = **5.8 years**

**BUT**: Real ROI is NOT cost savings, it's **pipeline impact**:
- 600 audits/year (Year 2) → 120 hot leads → 12 closed deals (10% close rate)
- 12 deals × $150K ACV = **$1.8M new revenue**
- **ROI**: $1.8M revenue ÷ $12.6K cost = **143x ROI**

---

## Budget Approval Recommendation

### Present as 3-Year Investment

**Year 1** (Pilot + Build):
- Capital: $101K (one-time)
- Operating: $11.6K
- **Total Year 1**: $112.6K

**Year 2** (Rollout):
- Operating: $12.6K
- **Total Year 2**: $12.6K

**Year 3** (Scale):
- Operating: $19.6K
- **Total Year 3**: $19.6K

**3-Year Total**: $144.8K

**3-Year Output**: 3,360 audits (60 + 600 + 2,700)
**Average cost per audit over 3 years**: $43

---

### Business Case Summary

**Investment**: $144.8K over 3 years

**Returns**:
- 3,360 audits produced (vs 45 with CLI)
- **75x more audits**
- 672 hot leads identified (20% of audits)
- 67 closed deals (10% close rate) × $150K = **$10M new revenue**
- **ROI**: 69x

**Payback**: 1.5 months (if first 10 audits lead to 1 deal)

---

## Risk Mitigation

### If Audits < Projected

**Worst case**: Only 50% of projected audits run

| Scenario | Year 2 Audits | Cost | Cost/Audit |
|----------|---------------|------|------------|
| **Projected** | 600 | $12.6K | $21 |
| **50% adoption** | 300 | $11.5K | $38 |
| **25% adoption** | 150 | $11.1K | $74 |

**Even at 25% adoption**: Still 10x more audits than CLI, and cost is manageable ($11K/year)

---

### If API Costs Increase

**Worst case**: API vendors raise prices 50%

| Scenario | Year 3 Cost | Impact |
|----------|-------------|--------|
| **Current pricing** | $19.6K | $7.26/audit |
| **+50% API costs** | $24.0K | $8.89/audit |

**Mitigation**: Still 4x cheaper than CLI labor cost ($2,000/audit)

---

## Summary: Cost Structure

### One-Time Capital Investment
**$101,000** (development + setup)

### Recurring Annual Costs

| Year | Infrastructure | Subscriptions | API Usage | Total | Cost/Audit |
|------|----------------|---------------|-----------|-------|------------|
| **Year 1** | $1,956 | $9,588 | $104 | **$11,648** | $194 |
| **Year 2** | $1,956 | $9,588 | $1,038 | **$12,582** | **$21** |
| **Year 3** | $5,352 | $9,588 | $4,671 | **$19,611** | **$7.26** |

### Business Value

**Year 3**: 2,700 audits → 540 hot leads → 54 deals → **$8.1M revenue**

**ROI**: 413x (revenue ÷ annual cost)

---

## Decision Point: Approve $112.6K Year 1 Budget?

**Includes**:
- ✅ $101K development (12 weeks)
- ✅ $1.9K infrastructure (Year 1)
- ✅ $9.6K API subscriptions (SimilarWeb, Apify, Apollo)
- ✅ $104 API usage (60 pilot audits)

**Delivers**:
- ✅ Production-ready SaaS platform
- ✅ 60 audits in Year 1 (4x more than CLI)
- ✅ Scales to 2,700+ audits by Year 3

**Expected ROI**: 69x over 3 years

---

**Next Step**: Approve budget and start Week 1 implementation?

**Last Updated**: March 6, 2026
