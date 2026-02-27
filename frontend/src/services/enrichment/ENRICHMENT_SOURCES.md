# PartnerForge Enrichment Data Sources

This document describes all data sources used by the PartnerForge enrichment pipeline, including APIs, endpoints, and the specific data retrieved from each source.

---

## Overview

| Source | Purpose | API Type | Auth Required |
|--------|---------|----------|---------------|
| **Yahoo Finance** | Market data, financials, analyst sentiment | `yahoo-finance2` npm package | No (library handles) |
| **SEC EDGAR** | Official filings, risk factors, digital signals | REST API | No (free public API) |
| **SimilarWeb** | Traffic, engagement, keywords, competitors | REST API | Yes (API key) |
| **BuiltWith** | Tech stack, search providers, relationships | REST API | Yes (API key) |
| **WebSearch** | Hiring signals, exec quotes, context | Query builder | Backend dependent |

---

## 1. Yahoo Finance

**Library:** `yahoo-finance2` v3.x
**Auth:** Handled internally by the library (crumb/cookie auth)
**Rate Limit:** ~2,000 requests/hour

### Endpoints

| # | Method | Data Retrieved |
|---|--------|----------------|
| 1 | `quoteSummary()` | Company profile, sector, industry, employees, description |
| 2 | `quoteSummary(incomeStatementHistory)` | 3-year revenue, net income, EBITDA, operating income |
| 3 | `quoteSummary(balanceSheetHistory)` | Assets, liabilities, equity, debt, cash |
| 4 | `quoteSummary(cashflowStatementHistory)` | Operating CF, CapEx, free cash flow, dividends |
| 5 | `quoteSummary(earningsHistory)` | Quarterly EPS actual vs estimate, surprise |
| 6 | `quote()` | Current price, day change, 52-week range, volume |
| 7 | `quoteSummary(recommendationTrend)` | Analyst ratings (Buy/Hold/Sell counts) |
| 8 | `quoteSummary(institutionOwnership)` | Top institutional holders (Vanguard, BlackRock, etc.) |
| 9 | `search()` | Recent news articles |
| 10 | `chart()` | 1-year daily price history |

### Data Retrieved

| Category | Fields |
|----------|--------|
| **Profile** | `company_name`, `sector`, `industry`, `employees`, `description` |
| **Valuation** | `market_cap`, `enterprise_value`, `pe_ratio`, `peg_ratio`, `price_to_book` |
| **Financials** | `revenue_growth`, `profit_margins`, `operating_margins`, `return_on_equity` |
| **Income (3-yr)** | `total_revenue`, `gross_profit`, `operating_income`, `net_income`, `ebitda` |
| **Balance Sheet** | `total_assets`, `total_liabilities`, `total_equity`, `total_debt`, `cash` |
| **Cash Flow** | `operating_cash_flow`, `capital_expenditures`, `free_cash_flow`, `dividends_paid` |
| **Stock** | `current_price`, `day_change`, `52_week_high`, `52_week_low`, `volume` |
| **Analyst** | `strong_buy`, `buy`, `hold`, `sell`, `target_price` |
| **Holders** | `name`, `shares`, `percentage`, `value` |

### Ticker Resolution

Domains are mapped to tickers via internal lookup table:
- `costco.com` → `COST`
- `walmart.com` → `WMT`
- `therealreal.com` → `REAL`
- ~80 major retailers mapped

---

## 2. SEC EDGAR

**Base URL:** `https://data.sec.gov`
**Auth:** None required (free public API)
**Rate Limit:** 10 requests/second
**Required Header:** `User-Agent: AppName/Version (email@domain.com)`

### Endpoints

| # | Endpoint | Data Retrieved |
|---|----------|----------------|
| 1 | `/files/company_tickers.json` | Ticker → CIK mapping |
| 2 | `/submissions/CIK{cik}.json` | Company info, all filings list |
| 3 | `/Archives/edgar/data/{cik}/{accession}/{doc}` | Filing documents (10-K, 10-Q, 8-K) |

### Data Retrieved

| Category | Fields |
|----------|--------|
| **Company** | `cik`, `name`, `ticker`, `sic`, `sicDescription`, `stateOfIncorporation`, `fiscalYearEnd` |
| **Filings** | `accessionNumber`, `filingDate`, `reportDate`, `form`, `primaryDocument`, `url` |
| **10-K Analysis** | `businessDescription`, `riskFactors[]`, `mdaHighlights[]`, `financialHighlights` |
| **Risk Factors** | `title`, `summary`, `category`, `relevanceToAlgolia` (high/medium/low) |
| **Digital Signals** | `digitalMentions[]`, `searchMentions[]`, `digitalTransformationStage` |
| **10-Q Analysis** | `quarterlyHighlights`, `riskUpdates[]`, `digitalMentions[]` |
| **8-K Events** | `itemNumber`, `itemTitle`, `content` |

### Risk Factor Categories

| Category | Relevance to Algolia |
|----------|---------------------|
| `technology` | High - search/digital infrastructure |
| `competition` | High - competitive pressure on CX |
| `operational` | Medium - site performance |
| `regulatory` | Low |
| `financial` | Low |
| `market` | Low |

---

## 3. SimilarWeb

**Base URL:** `https://api.similarweb.com/v1/website`
**Auth:** API key required (`VITE_SIMILARWEB_API_KEY`)
**Rate Limit:** Varies by plan

### Endpoints

| # | Endpoint | Data Retrieved |
|---|----------|----------------|
| 1 | `/total-traffic-and-engagement/visits` | Monthly visits, bounce rate, pages/visit, duration |
| 2 | `/traffic-sources/overview` | Direct, search, referral, social, mail, paid % |
| 3 | `/geo/traffic-by-country` | Country breakdown with share % |
| 4 | `/audience-demographics/age-and-gender` | Age distribution, gender ratio |
| 5 | `/search-keywords/organic-search-overview` | Top organic keywords, volume, position |
| 6 | `/search-keywords/paid-search-overview` | Top paid keywords, CPC, volume |
| 7 | `/audience-interests/also-visited` | Audience interest categories, affinity |
| 8 | `/similar-sites/similarsites` | Similar sites by content/audience |
| 9 | `/search-competitors/organicsearchcompetitors` | SEO competitors, overlap score |
| 10 | `/global-rank/global-rank` | Global, country, category rank |
| 11 | `/traffic-sources/referrals` | Top referring domains |
| 12 | `/popular-pages` | Most visited pages |
| 13 | `/leading-folders` | Top URL folders by traffic |
| 14 | `/traffic-sources/landing-pages` | Entry pages from external sources |

### Data Retrieved

| Category | Fields |
|----------|--------|
| **Traffic** | `monthly_visits`, `monthly_visits_trend`, `bounce_rate`, `pages_per_visit`, `avg_visit_duration` |
| **Rank** | `global_rank`, `country_rank`, `category_rank`, `category` |
| **Sources** | `direct`, `search`, `referral`, `social`, `mail`, `paid` (all as %) |
| **Geography** | `country`, `country_code`, `share` for each country |
| **Demographics** | `age_distribution` (18-24, 25-34, etc.), `gender_distribution` (male/female) |
| **Keywords** | `keyword`, `volume`, `position`, `traffic_share`, `cpc` |
| **Competitors** | `domain`, `similarity_score`, `overlap_score` |
| **Referrals** | `domain`, `traffic_share` |
| **Pages** | `url`, `share` |
| **Interests** | `category`, `affinity` |

---

## 4. BuiltWith

**Base URLs:**
- Free: `https://api.builtwith.com/free1/api.json`
- Pro: `https://api.builtwith.com/v21/api.json`
- Relationships: `https://api.builtwith.com/rv1/api.json`
- Recommendations: `https://api.builtwith.com/rec1/api.json`
- Financial: `https://api.builtwith.com/fin1/api.json`
- Social: `https://api.builtwith.com/soc1/api.json`
- Trust: `https://api.builtwith.com/trust1/api.json`

**Auth:** API key required (`VITE_BUILTWITH_API_KEY`)

### Endpoints

| # | Endpoint | Data Retrieved |
|---|----------|----------------|
| 1 | Free API | Basic tech stack |
| 2 | Pro/v21 API | Full tech stack with dates, spend estimates |
| 3 | Relationships API | Related domains, corporate parent, subsidiaries |
| 4 | Recommendations API | Similar sites by tech overlap |
| 5 | Financial API | Tech spend estimates by category |
| 6 | Social API | Social profiles (Facebook, Twitter, LinkedIn) |
| 7 | Trust API | SSL certificate, trust badges, security headers |

### Data Retrieved

| Category | Fields |
|----------|--------|
| **Tech Stack** | `name`, `tag`, `categories[]`, `first_detected`, `last_detected`, `spend_estimate` |
| **Categorized Tech** | `cms[]`, `ecommerce[]`, `analytics[]`, `search[]`, `cdn[]`, `payment[]`, `marketing[]`, `frameworks[]`, `hosting[]`, `security[]` |
| **Relationships** | `related_domains[]`, `corporate_parent`, `subsidiaries[]` |
| **Recommendations** | `similar_tech_sites[]` with `tech_overlap_score`, `shared_technologies[]` |
| **Financials** | `estimated_annual_tech_spend`, `spend_by_category`, `primary_vendors[]` |
| **Social** | `facebook_app_id`, `twitter_handle`, `linkedin_company_id`, `social_profiles[]` |
| **Trust** | `ssl_certificate` (issuer, grade), `trust_badges[]`, `compliance_certifications[]`, `security_headers[]` |

### Search Provider Detection

BuiltWith categorizes search technologies:
- **Algolia** → Already a customer
- **Elasticsearch** → Self-hosted search
- **Coveo** → Enterprise competitor
- **Constructor.io** → E-commerce competitor
- **SearchSpring** → E-commerce competitor
- **Klevu** → E-commerce competitor
- **None detected** → Likely using native platform search

---

## 5. WebSearch (Query Builder)

**Type:** Query builder / parser service
**Purpose:** Generate queries for backend execution

### Signal Categories

| # | Category | Queries Generated |
|---|----------|-------------------|
| 1 | Hiring Signals | `"{company}" careers site search`, `"{company}" hiring engineers` |
| 2 | Executive Quotes | `"{company}" CEO earnings call transcript`, `"{company}" investor day` |
| 3 | Strategic Context | `"{company}" digital transformation`, `"{company}" e-commerce strategy` |
| 4 | Trigger Events | `"{company}" acquisition`, `"{company}" leadership change` |

### Data Retrieved

| Category | Fields |
|----------|--------|
| **Hiring** | `total_relevant_openings`, `tier_breakdown` (VP/Director/IC), `relevant_jobs[]`, `tech_keywords_detected[]` |
| **Exec Quotes** | `speaker`, `title`, `quote`, `topic_tags[]`, `maps_to_algolia_value`, `source_type` |
| **Strategic** | `themes[]`, `key_executives[]`, `digital_mentions[]` |

---

## Data Source Selection by Use Case

| Use Case | Primary Source | Secondary Source |
|----------|---------------|------------------|
| Is this a hot lead? | Yahoo Finance (market cap, growth) | SimilarWeb (traffic) |
| What search problems exist? | SEC EDGAR (risk factors) | BuiltWith (tech stack) |
| Are they investing in digital? | SEC EDGAR (10-K mentions) | WebSearch (strategy articles) |
| What's their tech stack? | BuiltWith | SimilarWeb (tech check) |
| Who are their competitors? | SimilarWeb | BuiltWith (recommendations) |
| What do analysts think? | Yahoo Finance | - |
| Is this a public company? | Yahoo Finance (ticker lookup) | SEC EDGAR (CIK lookup) |

---

## Environment Variables

```bash
# frontend/.env
VITE_SIMILARWEB_API_KEY=your_key_here
VITE_BUILTWITH_API_KEY=your_key_here
# Yahoo Finance - no key needed (yahoo-finance2 handles auth)
# SEC EDGAR - no key needed (free public API)
```

---

## Rate Limits Summary

| Source | Limit | Notes |
|--------|-------|-------|
| Yahoo Finance | ~2,000/hr | Library handles auth |
| SEC EDGAR | 10/sec | Must include User-Agent |
| SimilarWeb | Plan-dependent | 429 on rate limit |
| BuiltWith | Plan-dependent | Credits-based |

---

*Last Updated: 2026-02-26*
