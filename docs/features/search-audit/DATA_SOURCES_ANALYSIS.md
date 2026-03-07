# Data Sources Analysis & Recommendations

**Date**: March 6, 2026
**Status**: Evaluating Apify, Apollo.io, and alternatives
**Decision Required**: Which data sources to add?

---

## 1. Apify (Replace JSearch) ✅ RECOMMENDED

### Why Replace JSearch?

**JSearch limitations**:
- Basic job posting data only
- No LinkedIn social engagement
- No company follower metrics
- Limited to job boards (not LinkedIn)

**Apify advantages**:
- Direct LinkedIn scraping (richer data)
- Social engagement metrics
- Company follower growth
- Post engagement rates
- Hiring committee profiles

---

### Apify Actors We'll Use

#### Actor 1: LinkedIn Company Scraper
**Actor**: `apify/linkedin-company-scraper`

**What it provides**:
- Company follower count
- Employee count (real-time)
- Recent posts (last 10)
- Post engagement (likes, comments, shares)
- Company description
- Headquarters location

**Cost**: ~0.5 compute units per company = **$0.125 per company**

**Cache TTL**: 24 hours (social engagement changes daily)

```typescript
// Example output
{
  company_name: "Costco Wholesale",
  followers: 2500000,
  employee_count: 304000,
  recent_posts: [
    {
      date: "2025-12-15",
      text: "We're hiring 28 engineers...",
      likes: 1500,
      comments: 89,
      shares: 45
    }
  ]
}
```

---

#### Actor 2: LinkedIn Jobs Scraper
**Actor**: `apify/linkedin-jobs-scraper`

**What it provides**:
- Job postings by company
- Job titles, departments
- Seniority levels
- Remote/hybrid/onsite
- Posting dates
- Application counts

**Cost**: ~0.3 compute units per 100 jobs = **$0.075 per company** (avg 20 jobs)

**Cache TTL**: 24 hours

```typescript
// Example output
{
  jobs: [
    {
      title: "Senior Search Engineer",
      department: "Engineering",
      seniority: "Senior",
      location: "Seattle, WA",
      remote: "Hybrid",
      posted_date: "2025-12-10",
      applications: 142
    }
  ],
  total_jobs: 28
}
```

---

#### Actor 3: LinkedIn Profile Scraper (Executives)
**Actor**: `apify/linkedin-profile-scraper`

**What it provides**:
- Executive profiles (CEO, CTO, VP Eng)
- Current role + tenure
- Previous roles
- Education
- Skills
- Connections

**Cost**: ~0.2 compute units per profile = **$0.05 per profile** (scrape 3-5 execs)

**Cache TTL**: 7 days (executive data stable)

```typescript
// Example output
{
  name: "Ron Vachris",
  title: "CEO",
  company: "Costco Wholesale",
  tenure: "2 years",
  previous_roles: [
    { company: "Costco", title: "COO", duration: "5 years" }
  ],
  education: "University of Washington",
  connections: 5000
}
```

---

### Apify Pricing

**Subscription**:
- **Starter**: $49/month (includes 100 compute units = 200 company scrapes)
- **Team**: $499/month (includes 1000 compute units = 2000 company scrapes)

**Additional Compute**:
- **$0.25 per compute unit** (beyond included amount)

**Total per audit**:
- Actor 1 (Company): 0.5 units = $0.125
- Actor 2 (Jobs): 0.3 units = $0.075
- Actor 3 (Execs): 0.6 units (3 profiles) = $0.15
- **Total**: 1.4 units = **$0.35 per audit**

**Annual cost (500K audits)**:
- Without caching: $0.35 × 500K = **$175K/year**
- With 50% cache (social changes daily): $0.35 × 250K = **$87.5K/year**

---

### Apify MCP vs Direct API: Decision

**Option A: Apify MCP**
- Pros: Simple integration (like CLI skill)
- Cons: Not production-scale, black box, can't cache actor results

**Option B: Direct Apify API**
- Pros: Production-grade, caching possible, full observability
- Cons: More code to write (actor invocation, result polling)

**Recommendation**: **Direct Apify API** ✅

**Why?**
1. **Consistent with architecture decision** (we chose Direct APIs over MCP)
2. **Caching**: Can cache actor results in Redis (50% hit rate = $87.5K savings)
3. **Observability**: Track actor run times, costs per company
4. **Reliability**: Retry failed actor runs, graceful degradation

**Implementation**:
```typescript
class ApifyClient {
  async runActor(actorId: string, input: any): Promise<any> {
    // 1. Check cache (24hr for social, 7d for profiles)
    const cacheKey = `apify:${actorId}:${JSON.stringify(input)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. Start actor run
    const run = await this.http.post('/v2/acts/{actorId}/runs', { input });

    // 3. Poll for completion (Apify async)
    const result = await this.pollForCompletion(run.id);

    // 4. Cache result
    await this.cache.set(cacheKey, JSON.stringify(result), cacheTTL);

    return result;
  }
}
```

---

## 2. Apollo.io ✅ STRONGLY RECOMMENDED

### What Apollo.io Provides

**Contact Data** (Primary Value):
- ✅ **Verified email addresses** (CEO, CTO, VP Eng)
- ✅ **Phone numbers** (direct dials)
- ✅ **Job titles + departments**
- ✅ **Reporting structure** (org chart)

**Company Intelligence** (Secondary Value):
- ✅ **Real-time employee count** (more accurate than Yahoo Finance)
- ✅ **Revenue estimates** (for private companies)
- ✅ **Technology stack** (overlaps with BuiltWith)
- ✅ **Funding information** (Series A/B/C rounds)

**Intent Signals** (High Value):
- ✅ **Hiring velocity** (rapid hiring = expansion)
- ✅ **Tech stack changes** (migrating from X to Y)
- ✅ **Funding announcements** ($50M Series B = growth mode)
- ✅ **Leadership changes** (new CTO = tech overhaul opportunity)

---

### What We GAIN with Apollo.io

#### 1. Buying Committee Identification 🎯

**Current problem**: We know Costco needs better search, but WHO do we contact?

**Apollo.io solution**:
```json
{
  "buying_committee": [
    {
      "name": "Richard Galanti",
      "title": "CFO",
      "email": "richard.galanti@costco.com",
      "phone": "+1-425-313-8100",
      "role": "Budget approver"
    },
    {
      "name": "Paul Moulton",
      "title": "EVP & CIO",
      "email": "paul.moulton@costco.com",
      "phone": "+1-425-313-8200",
      "role": "Technical decision maker"
    }
  ]
}
```

**Value**: AEs can reach out directly (no guessing email formats)

---

#### 2. Real-Time Hiring Signals 📈

**Current**: JSearch shows 28 open roles

**Apollo.io enhancement**:
```json
{
  "hiring_velocity": {
    "last_30_days": 28,
    "last_90_days": 85,
    "trend": "accelerating",
    "engineering_headcount_growth": "+15%"
  },
  "signal": "EXPANSION MODE - hiring spike indicates growth"
}
```

**Value**: Timing matters - catch them during expansion phase

---

#### 3. Intent Signals 🚨

**Example signals Apollo.io detects**:
- Costco raised $500M → Expansion capital available
- New CTO hired 3 months ago → Tech stack review likely
- 15 "search engineer" roles posted → Search pain point confirmed
- Migrated from Solr to Elastic → Still not satisfied (opportunity)

**Value**: Know WHEN to reach out (not just WHO)

---

#### 4. Private Company Data 💼

**Current problem**: Yahoo Finance only works for public companies

**Apollo.io solution**:
- Private company revenue estimates
- Employee count (real-time)
- Funding rounds (Crunchbase data integrated)

**Example**:
```json
{
  "company": "The RealReal",
  "status": "Private",
  "estimated_revenue": "$227M",
  "employee_count": 1850,
  "last_funding": "Series G, $115M, March 2021"
}
```

**Value**: Can audit private companies (not just Fortune 500)

---

### What We LOSE (Overlap)

Apollo.io overlaps with:
1. **BuiltWith**: Tech stack detection (Apollo has this too)
2. **Yahoo Finance**: Employee count (Apollo more accurate)
3. **LinkedIn/Apify**: Hiring signals (Apollo aggregates this)

**BUT**: Apollo provides **contact data** and **intent signals** that others don't.

**Recommendation**: **Keep all sources** because:
- BuiltWith = more detailed tech stack (install dates, versions)
- Yahoo Finance = 3-year financial history (Apollo only has estimates)
- Apify = LinkedIn social engagement (Apollo doesn't track posts/likes)

---

### Apollo.io Pricing

**Subscription Plans**:
| Plan | Cost/Month | Credits/Year | API Access |
|------|------------|--------------|------------|
| Basic | $49 | 1,200 | No |
| Professional | $99 | 12,000 | Yes |
| Organization | $149 | 24,000 | Yes |

**API Pricing**:
- Professional: $1,200/year ($100/month) + 10,000 API calls/month included
- Additional calls: $0.01 per API call

**Credits**:
- 1 credit = 1 contact email reveal (export)
- 0 credits = company data view (free)

---

### Cost Analysis (500K Audits/Year)

**Apollo.io API calls per audit**:
- 1 call: Get company data (employee count, revenue, tech stack) - FREE
- 1 call: Get buying committee (3-5 contacts) - 5 credits = $0.50
- **Total per audit**: $0.50 (if we export contact emails)

**Annual cost**:
- Without caching: $0.50 × 500K = $250K/year
- With 70% cache (companies stable): $0.50 × 150K = **$75K/year**

**BUT**: We don't need to export contacts for EVERY audit (only hot leads)

**Optimized strategy**:
- Phase 1: Get company data for ALL audits (free)
- Phase 5: Export contacts only for ICP score >80 (20% of audits)
- Cost: $0.50 × 100K = **$50K/year**

**Annual subscription**: $1,200/year (Professional plan)

**Total Apollo.io cost**: $1,200 + $50K = **$51.2K/year**

---

### Should We Add Apollo.io?

**YES** ✅ - Here's why:

| Feature | Value | Replaces? |
|---------|-------|-----------|
| **Verified emails** | Direct outreach capability | None |
| **Buying committee** | Know who to contact | None |
| **Intent signals** | Know when to reach out | None |
| **Private company data** | Audit non-public companies | Partial (Yahoo Finance) |
| **Real-time employee count** | More accurate than Yahoo Finance | Yes |

**ROI Calculation**:
- Cost: $51K/year
- Value: 100K hot leads with verified contact info
- If 1% convert → 1,000 deals
- If avg deal = $150K → $150M pipeline influenced
- **ROI**: 2,900x

**Decision**: **ADD Apollo.io** ✅

---

## 3. Other Data Sources to Consider

### 3.1 Crunchbase (Funding Data) ⚠️ MAYBE

**What it provides**:
- Funding rounds (Series A, B, C)
- Investors
- Acquisition history
- IPO status

**Cost**:
- Free tier (limited)
- Pro: $99/month
- API: $999/month (too expensive)

**Overlap with Apollo.io**: Apollo already includes funding data

**Recommendation**: **Skip - Apollo.io covers this**

---

### 3.2 G2 Crowd (Product Reviews) ✅ ADD (Web Scraping)

**What it provides**:
- Customer reviews of search platforms (Elastic, Bloomreach, Algolia)
- Feature comparisons
- Satisfaction scores
- Pain points

**Example value**:
```
"Elastic reviews (G2): 4.2/5"
Top complaint: "Query relevance requires constant tuning"
Top complaint: "Slow support response"

Algolia reviews (G2): 4.7/5
Top praise: "Works out of the box"
Top praise: "Fast support"

→ Use in audit: "Customers complain Elastic requires constant tuning.
   Algolia customers praise out-of-box relevance."
```

**Cost**: Free (web scraping via Apify or custom scraper)

**Recommendation**: **ADD via web scraping** ✅

---

### 3.3 Clearbit (Company Enrichment) ❌ SKIP

**What it provides**:
- Company firmographics (employee count, revenue)
- Tech stack
- Social profiles

**Cost**: $99/month (500 enrichments), $999/month (unlimited)

**Overlap**: 100% overlap with BuiltWith + Apollo.io

**Recommendation**: **SKIP - redundant**

---

### 3.4 ZoomInfo (Contact Database) ❌ SKIP

**What it provides**:
- Contact database (emails, phones)
- Org charts
- Intent data

**Cost**: $15,000/year minimum

**Overlap**: Apollo.io is cheaper and has similar data

**Recommendation**: **SKIP - Apollo.io is better value**

---

### 3.5 6sense (Intent Data) ❌ SKIP

**What it provides**:
- Anonymous web visitor tracking
- Intent signals (companies researching "search")

**Cost**: $30,000/year minimum

**Recommendation**: **SKIP - too expensive, Apollo.io has intent signals**

---

### 3.6 Owler (Company News) ❌ SKIP

**What it provides**:
- News mentions
- Competitor tracking

**Cost**: $35/month, API $199/month

**Alternative**: Google News API (free) or Perplexity API

**Recommendation**: **SKIP - use WebSearch instead**

---

### 3.7 PredictLeads (Buying Signals) ⚠️ CONSIDER

**What it provides**:
- Website technology changes (detected via web crawling)
- Hiring signals
- Funding announcements
- Leadership changes

**Cost**: $199/month (API access)

**Overlap**: Apollo.io has most of this

**Recommendation**: **Skip for now - Apollo.io covers 80% of this**

---

### 3.8 BuiltWith Trends (Tech Adoption) ⚠️ CONSIDER

**What it provides**:
- Market share trends (e.g., "Shopify growing 15%/year")
- Technology migration patterns (e.g., "50K sites migrated Magento → Shopify")
- Vertical benchmarks (e.g., "Retail average: 3.2 search vendors")

**Cost**: $295/month (separate from BuiltWith API)

**Value**: Industry context for audit ("Shopify merchants increasingly dissatisfied with native search")

**Recommendation**: **Consider for Phase 2** (not MVP)

---

### 3.9 SimilarTech ❌ SKIP

**What it provides**:
- Tech stack detection (competitor to BuiltWith)

**Cost**: $99/month

**Recommendation**: **SKIP - BuiltWith is better**

---

### 3.10 Datanyze ❌ SKIP

**What it provides**:
- Tech stack detection
- Contact database

**Cost**: $99/month

**Recommendation**: **SKIP - redundant with BuiltWith + Apollo**

---

## Final Recommendation: Approved Data Sources

### Tier 1: Must-Have (Approved)

| # | Service | Purpose | Annual Cost (cached) |
|---|---------|---------|----------------------|
| 1 | **SimilarWeb** | Traffic, engagement, competitors | $50K |
| 2 | **BuiltWith** | Tech stack detection | $50K |
| 3 | **Yahoo Finance** | Public company financials | $0 |
| 4 | **SEC Edgar** | 10-K/10-Q filings | $0 |
| 5 | **Apify** | LinkedIn jobs + social engagement | $87.5K |
| 6 | **Apollo.io** | Contact data + intent signals | $51.2K |
| 7 | **G2 Crowd** | Product reviews (web scraping) | $0 |

**Total Annual Cost**: **$238.7K/year** (with caching)
**Cost per Audit**: **$0.48** (cached) vs **$1.70** (uncached)
**Savings from Caching**: **$611K/year** (72% reduction)

---

### Tier 2: Consider for Phase 2 (Post-MVP)

| Service | Purpose | Cost | When to Add |
|---------|---------|------|-------------|
| BuiltWith Trends | Market trends, migration patterns | $295/month | Month 6 (after 100 audits) |
| PredictLeads | Real-time tech change signals | $199/month | Month 12 (if Apollo insufficient) |

---

### Tier 3: Skip (Not Worth Cost)

| Service | Why Skip |
|---------|----------|
| Crunchbase API | Apollo.io has funding data |
| Clearbit | 100% overlap with BuiltWith + Apollo |
| ZoomInfo | $15K/year, Apollo is cheaper |
| 6sense | $30K/year, too expensive |
| Owler | WebSearch is free alternative |
| PitchBook | $7K/year, Apollo covers private company data |

---

## Cost Comparison: Before vs After

### Before (Original Plan with JSearch)
| Service | Cost/Year |
|---------|-----------|
| SimilarWeb | $50K |
| BuiltWith | $50K |
| Yahoo Finance | $0 |
| SEC Edgar | $0 |
| JSearch | $500 |
| **Total** | **$100.5K** |

### After (With Apify + Apollo.io + G2)
| Service | Cost/Year |
|---------|-----------|
| SimilarWeb | $50K |
| BuiltWith | $50K |
| Yahoo Finance | $0 |
| SEC Edgar | $0 |
| **Apify** | **$87.5K** |
| **Apollo.io** | **$51.2K** |
| G2 Crowd | $0 (scraping) |
| **Total** | **$238.7K** |

**Cost increase**: $138.2K/year (+138%)

**BUT value gained**:
- ✅ LinkedIn social engagement (hiring signals, follower growth)
- ✅ Buying committee identification (verified emails/phones)
- ✅ Intent signals (funding, leadership changes, hiring velocity)
- ✅ Private company data (revenue estimates, employee count)
- ✅ Competitor reviews (pain points vs Algolia strengths)

**ROI on incremental cost**:
- $138K cost → 100K hot leads with contacts
- 1% conversion → 1,000 deals
- Avg deal $150K → $150M pipeline
- **ROI**: 1,086x

---

## Implementation Strategy

### Week 1-2: Add Apify Client

```typescript
// src/clients/apify/ApifyClient.ts
class ApifyClient {
  async getCompanyProfile(companyLinkedInUrl: string): Promise<CompanyProfile> {
    return this.runActor('apify/linkedin-company-scraper', {
      startUrls: [companyLinkedInUrl],
      maxResults: 1
    });
  }

  async getJobs(companyName: string): Promise<JobData> {
    return this.runActor('apify/linkedin-jobs-scraper', {
      companyName,
      maxResults: 100
    });
  }

  async getExecutiveProfiles(linkedInUrls: string[]): Promise<Profile[]> {
    return this.runActor('apify/linkedin-profile-scraper', {
      startUrls: linkedInUrls,
      maxResults: linkedInUrls.length
    });
  }
}
```

---

### Week 1-2: Add Apollo.io Client

```typescript
// src/clients/apollo/ApolloClient.ts
class ApolloClient {
  async getCompanyData(domain: string): Promise<CompanyData> {
    return this.http.get('/v1/organizations/search', {
      domain,
      reveal_emails: false // Free company data
    });
  }

  async getBuyingCommittee(domain: string, exportContacts: boolean = false): Promise<BuyingCommittee> {
    return this.http.get('/v1/people/search', {
      organization_domains: [domain],
      person_titles: ['CTO', 'VP Engineering', 'Head of Product', 'CEO'],
      reveal_emails: exportContacts // Costs credits only if true
    });
  }
}
```

---

### Week 3: Add G2 Scraper

```typescript
// src/services/G2ScraperService.ts
class G2ScraperService {
  async getCompetitorReviews(productName: string): Promise<ReviewData> {
    // Use Apify web-scraper or custom Puppeteer
    const url = `https://www.g2.com/products/${productName}/reviews`;
    return this.scrapeReviews(url);
  }
}
```

---

## Decision Summary

### ✅ Approved to Add

1. **Apify** (replace JSearch) - $87.5K/year
   - LinkedIn company scraper
   - LinkedIn jobs scraper
   - LinkedIn profile scraper
   - **Architecture**: Direct Apify API (NOT MCP)

2. **Apollo.io** - $51.2K/year
   - Contact data (emails, phones)
   - Buying committee identification
   - Intent signals (funding, hiring, tech changes)
   - Real-time employee count

3. **G2 Crowd** - $0 (web scraping)
   - Competitor product reviews
   - Pain point identification

### ❌ Not Adding (For Now)

- Crunchbase API (Apollo has funding data)
- Clearbit (redundant)
- ZoomInfo (too expensive)
- All others (low value or overlapping)

### Total Cost Impact

**Before**: $100.5K/year
**After**: $238.7K/year
**Increase**: +$138.2K/year (+138%)

**But**:
- Without caching: Would be $849K/year
- With caching: $238.7K/year
- **Savings**: $611K/year (72% reduction)

---

**Next Step**: Update API_CLIENT_SPECIFICATIONS.md with Apify + Apollo.io endpoints

**Status**: ✅ Ready for approval
**Owner**: Dashboard Builder Team
**Last Updated**: March 6, 2026
