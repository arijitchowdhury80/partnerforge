# PartnerForge Enrichment Pipeline

Quick reference for all data sources powering the enrichment pipeline.

---

## Data Sources Overview

| Source | # Endpoints | Purpose | Auth |
|--------|-------------|---------|------|
| Yahoo Finance | 10 | Market data, financials, analyst sentiment | None (library) |
| SEC EDGAR | 3 | Official filings, risk factors | None (free) |
| SimilarWeb | 14 | Traffic, engagement, keywords | API Key |
| BuiltWith | 7 | Tech stack, search providers | API Key |
| WebSearch | 4 | Hiring, exec quotes, context | Backend |

---

## Quick Reference: What Data From Where

### Yahoo Finance (10 endpoints)

| Endpoint | What You Get |
|----------|-------------|
| Quote Summary | Company name, sector, industry, employees, market cap |
| Income Statement | Revenue, net income, EBITDA (3 years) |
| Balance Sheet | Assets, liabilities, equity, debt, cash |
| Cash Flow | Operating CF, CapEx, free cash flow |
| Quarterly Results | EPS actual vs estimate, surprise % |
| Stock Info | Price, day change, 52-week range, volume |
| Recommendations | Buy/Hold/Sell counts, price targets |
| Holders | Top institutional holders with % |
| News | Recent headlines |
| Price History | 1-year daily OHLCV |

### SEC EDGAR (3 endpoints)

| Endpoint | What You Get |
|----------|-------------|
| Ticker Lookup | Ticker → CIK mapping |
| Company Submissions | All filings list, company info |
| Filing Documents | 10-K/10-Q/8-K full text |

**Parsed from 10-K:**
- Business description
- Risk factors (categorized, Algolia-relevance scored)
- MD&A highlights
- Digital/search mentions
- Digital transformation stage

### SimilarWeb (14 endpoints)

| Endpoint | What You Get |
|----------|-------------|
| Traffic & Engagement | Monthly visits, bounce rate, pages/visit |
| Traffic Sources | Direct/search/referral/social/mail/paid % |
| Geography | Country breakdown |
| Demographics | Age distribution, gender ratio |
| Organic Keywords | Top keywords, volume, position |
| Paid Keywords | PPC keywords, CPC |
| Audience Interests | Category affinities |
| Similar Sites | Audience/content similarity |
| Search Competitors | SEO competitors, overlap |
| Global Rank | Global, country, category rank |
| Referrals | Top referring domains |
| Popular Pages | Most visited pages |
| Leading Folders | Top URL paths |
| Landing Pages | Entry pages from external |

### BuiltWith (7 endpoints)

| Endpoint | What You Get |
|----------|-------------|
| Free Tech | Basic tech stack |
| Pro Tech | Full stack with dates, spend estimates |
| Relationships | Corporate parent, subsidiaries, related domains |
| Recommendations | Similar sites by tech overlap |
| Financial | Tech spend estimates by category |
| Social | Facebook, Twitter, LinkedIn profiles |
| Trust | SSL cert, trust badges, security headers |

**Categorized Tech Stack:**
- CMS: WordPress, Adobe AEM, Contentful, etc.
- E-commerce: Shopify, Magento, Salesforce Commerce
- Search: **Algolia**, Elasticsearch, Coveo, Constructor.io
- Analytics: Google Analytics, Mixpanel, Amplitude
- CDN: Cloudflare, Fastly, Akamai

### WebSearch (4 signal categories)

| Category | Queries |
|----------|---------|
| Hiring | Careers page, job postings |
| Exec Quotes | Earnings calls, investor days |
| Strategic | Digital transformation articles |
| Trigger Events | Acquisitions, leadership changes |

---

## Use Case → Source Mapping

| Question | Best Source |
|----------|-------------|
| "Is this company worth pursuing?" | Yahoo Finance (market cap, growth) + SimilarWeb (traffic) |
| "What search solution do they use?" | BuiltWith (tech stack → search category) |
| "What problems might they have?" | SEC EDGAR (risk factors) |
| "Are they investing in digital?" | SEC EDGAR (10-K digital mentions) |
| "Who competes with them?" | SimilarWeb (competitors) |
| "What do analysts think?" | Yahoo Finance (recommendations) |
| "Are they hiring for search?" | WebSearch (hiring signals) |
| "What did the CEO say?" | WebSearch (earnings call transcripts) |

---

## Files

| File | Description |
|------|-------------|
| `services/enrichment/clients/yahoofinance.ts` | Yahoo Finance client (10 endpoints) |
| `services/enrichment/clients/secedgar.ts` | SEC EDGAR client (3 endpoints) |
| `services/enrichment/clients/similarweb.ts` | SimilarWeb client (14 endpoints) |
| `services/enrichment/clients/builtwith.ts` | BuiltWith client (7 endpoints) |
| `services/enrichment/clients/websearch.ts` | WebSearch query builder |
| `services/enrichment/orchestrator.ts` | Coordinates all clients |
| `services/enrichment/ENRICHMENT_SOURCES.md` | Full API documentation |

---

## Environment Variables

```bash
VITE_SIMILARWEB_API_KEY=xxx
VITE_BUILTWITH_API_KEY=xxx
# Yahoo Finance - no key needed
# SEC EDGAR - no key needed (free public API)
```

---

*Last Updated: 2026-02-26*
