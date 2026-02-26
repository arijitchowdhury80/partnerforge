# PartnerForge Intelligence Module Taxonomy

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Thread 2 Working Document
**Purpose:** Extracted from algolia-search-audit skill outputs for PartnerForge ABM platform design

---

## Overview

This document synthesizes learnings from analyzing production audit outputs (Sally Beauty, Tapestry, Uncommon Goods, Costco) to define the intelligence modules, data structures, and output formats required for the enterprise ABM platform.

---

## 1. Intelligence Module Inventory

Based on analysis of 12 scratchpad files per audit, the following modules are required:

### Module 01: Company Context (Foundation)
**Scratchpad:** `01-company-context.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| company_name | string | WebSearch, SEC | Yes |
| domain | string | Input | Yes |
| ticker | string | Yahoo Finance | No |
| headquarters | string | WebSearch | Yes |
| founded_year | integer | WebSearch | No |
| industry | string | Classification | Yes |
| business_model | string | Enrichment | Yes |
| store_count | integer | SEC/Company | No |
| countries | array[string] | Company Profile | No |
| employee_count | integer | LinkedIn/Company | Yes |
| product_sku_count | integer | Enrichment | No |
| revenue_annual | decimal | Yahoo Finance | Yes |
| fiscal_year_end | string | SEC | No |
| business_segments | array[{name, description}] | Enrichment | No |

**Key Insight:** Every data point must have a SOURCE attribute (URL or API reference).

---

### Module 02: Technology Stack
**Scratchpad:** `02-tech-stack.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| ecommerce_platform | string | BuiltWith | Yes |
| search_provider | string | BuiltWith/Network | Yes |
| search_provider_status | enum | Detection | Yes |
| analytics_tools | array[{name, category, status}] | BuiltWith | No |
| marketing_tools | array[{name, category, status}] | BuiltWith | No |
| infrastructure | array[{name, category, status}] | BuiltWith | No |
| tech_spend_estimated | decimal | BuiltWith | No |
| related_properties | array[{domain, relationship}] | BuiltWith | No |
| recently_added | array[{tech, date}] | BuiltWith | No |
| recently_removed | array[{tech, date}] | BuiltWith | No |
| displacement_opportunities | array[{current, proposed, rationale}] | Analysis | Yes |

**Detection Priority Order:**
1. Algolia (algolia.net, algolianet.com)
2. Constructor (cnstrc.com, constructor.io)
3. Bloomreach (brsrvr.com, bloomreach.com)
4. Coveo (coveo.com)
5. Klevu (klevu.com)
6. SFCC Einstein (demandware, salesforce)

---

### Module 03: Traffic Intelligence
**Scratchpad:** `03-traffic-data.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| monthly_sessions | integer | SimilarWeb | Yes |
| monthly_revenue | decimal | ECDB/Grips | No |
| conversion_rate | decimal | Grips | Yes |
| average_order_value | decimal | Grips | Yes |
| device_split | {desktop: %, mobile: %} | SimilarWeb | Yes |
| ecommerce_revenue | decimal | SEC/Grips | Yes |
| ecommerce_pct_of_total | decimal | Calculation | Yes |
| revenue_trend_3mo | decimal | ECDB | No |
| global_rank | integer | SimilarWeb | No |
| us_rank | integer | SimilarWeb | No |
| category_rank | {rank, category} | SimilarWeb | No |
| bounce_rate | decimal | SimilarWeb | No |
| pages_per_visit | decimal | SimilarWeb | No |
| avg_visit_duration | string | SimilarWeb | No |
| traffic_sources | {organic: %, direct: %, paid: %, referral: %, social: %, email: %} | SimilarWeb | Yes |
| geo_distribution | array[{country, share}] | SimilarWeb | No |
| demographics | {gender: {m: %, f: %}, age_groups: array} | SimilarWeb | No |

**Revenue Impact Formula:**
```
addressable_search_revenue = monthly_sessions × conversion_rate × aov × 12 × search_share(0.40)
potential_lift = addressable_search_revenue × improvement_pct(0.10-0.15)
```

---

### Module 04: Competitive Intelligence
**Scratchpad:** `04-competitors.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| competitors | array[Competitor] | SimilarWeb | Yes |
| competitive_landscape_summary | string | Analysis | Yes |
| search_provider_analysis | array[{competitor, provider, status, source}] | BuiltWith | Yes |
| competitive_threats | array[{competitor, threat, severity}] | Analysis | No |
| first_mover_opportunities | array[{opportunity, rationale}] | Analysis | No |

**Competitor Object:**
```json
{
  "domain": "string",
  "monthly_visits": "integer",
  "ecommerce_revenue": "decimal",
  "why_competitor": "string",
  "search_provider": "string",
  "source_urls": ["string"]
}
```

---

### Module 05: Test Queries
**Scratchpad:** `05-test-queries.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| test_queries | array[TestQuery] | Analysis | Yes |
| query_categories | array[string] | Classification | Yes |

**TestQuery Object:**
```json
{
  "query": "string",
  "category": "enum(product, brand, long_tail, nlp, misspell, ambiguous)",
  "expected_outcome": "string",
  "rationale": "string"
}
```

---

### Module 06: Strategic Context
**Scratchpad:** `06-strategic-context.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| recent_news | array[{headline, date, source_url, algolia_connection}] | WebSearch | Yes |
| trigger_events | array[{event, timing, opportunity}] | Analysis | Yes |
| strategic_initiatives | array[{name, description, timeline}] | SEC/News | No |
| market_position | string | Analysis | No |
| growth_strategy | string | SEC/Earnings | No |

---

### Module 07: Hiring Signals
**Scratchpad:** `07-hiring-signals.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| total_open_positions | integer | LinkedIn/Careers | No |
| tier1_signals | array[HiringSignal] | LinkedIn | Yes |
| tier2_signals | array[HiringSignal] | LinkedIn | No |
| tier3_signals | array[HiringSignal] | LinkedIn | No |
| ai_ml_investment_signal | boolean | Analysis | No |
| buying_committee | array[Executive] | LinkedIn/Company | Yes |
| entry_points | array[{name, title, rationale, priority}] | Analysis | Yes |

**HiringSignal Object:**
```json
{
  "role": "string",
  "status": "enum(active, posted, filled)",
  "location": "string",
  "salary_range": "string",
  "signal_strength": "enum(STRONG, MODERATE, LOW)",
  "source_url": "string"
}
```

**Executive Object:**
```json
{
  "name": "string",
  "title": "string",
  "linkedin_url": "string",
  "buyer_role": "enum(Executive Sponsor, Budget Authority, Technical Buyer, Economic Buyer, Champion, User Buyer)",
  "tenure": "string",
  "background": "string",
  "priority": "enum(HIGH, MEDIUM, LOW)"
}
```

**Signal Strength Tiers:**
- **Tier 1 (STRONG):** VP/Director level, leadership turnover
- **Tier 2 (MODERATE):** Manager/Senior IC, architecture roles
- **Tier 3 (LOW):** Engineering/Developer roles

---

### Module 08: Financial Profile
**Scratchpad:** `08-financial-profile.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| revenue_3yr | array[{year, revenue, yoy_change}] | Yahoo Finance | Yes |
| net_income_3yr | array[{year, income, margin}] | Yahoo Finance | Yes |
| ebitda_3yr | array[{year, ebitda, margin}] | Yahoo Finance | Yes |
| ecommerce_revenue_3yr | array[{year, revenue, pct_of_total}] | SEC/Analysis | No |
| margin_zone | enum(RED, YELLOW, GREEN) | Calculation | Yes |
| margin_zone_analysis | string | Analysis | Yes |
| stock_info | {ticker, price, range_52wk, market_cap, analyst_consensus, price_target} | Yahoo Finance | No |
| roi_estimate | {conservative, moderate, aggressive} | Calculation | Yes |
| case_study_benchmarks | array[{company, result, source_url}] | Algolia Resources | No |

**Margin Zone Classification:**
- **RED (≤10%):** High pressure, urgent efficiency needs
- **YELLOW (10-20%):** Moderate pressure, efficiency improvements needed
- **GREEN (>20%):** Healthy, strong operating leverage

**ROI Calculation:**
```
addressable_revenue = total_revenue × digital_share × search_driven_share(0.15)
conservative_lift = addressable_revenue × 0.05
moderate_lift = addressable_revenue × 0.10
aggressive_lift = addressable_revenue × 0.15
```

---

### Module 09: Browser Findings (Search Audit Specific)
**Scratchpad:** `09-browser-findings.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| findings | array[Finding] | Browser Test | Yes |
| screenshots | array[{id, query, path}] | Chrome MCP | Yes |
| overall_score | decimal | Calculation | Yes |
| high_severity_gaps | array[string] | Analysis | Yes |

**Finding Object:**
```json
{
  "category": "enum(latency, typo_tolerance, query_suggestions, intent_detection, merchandising, content_commerce, semantic_nlp, personalization, recommendations, search_intelligence)",
  "score": "integer(1-10)",
  "severity": "enum(HIGH, MEDIUM, LOW)",
  "tested_query": "string",
  "expected": "string",
  "found": "string",
  "screenshot_path": "string",
  "industry_context": "string",
  "solution": "string"
}
```

---

### Module 10: Scoring Matrix
**Scratchpad:** `10-scoring-matrix.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| scores | array[{area, score, severity}] | Browser Test | Yes |
| overall_score | decimal | Calculation | Yes |
| high_severity_count | integer | Calculation | Yes |
| medium_severity_count | integer | Calculation | Yes |
| low_severity_count | integer | Calculation | Yes |

**10 Scoring Areas:**
1. Latency (target: <200ms)
2. Typo Tolerance
3. Query Suggestions (SAYT)
4. Intent Detection
5. Merchandising
6. Content Commerce (Federated)
7. Semantic/NLP
8. Personalization
9. Recommendations
10. Search Intelligence (Analytics)

---

### Module 11: Investor Intelligence
**Scratchpad:** `11-investor-intelligence.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| sec_filings | {ten_k: string, ten_q: string} | SEC EDGAR | No |
| ecommerce_from_filings | array[{period, value, pct}] | SEC | No |
| digital_initiatives | array[{name, description, source_url}] | SEC/Earnings | Yes |
| risk_factors | array[{risk, algolia_connection}] | SEC 10-K | No |
| earnings_quotes | array[ExecutiveQuote] | Earnings Transcripts | Yes |
| forward_guidance | array[{metric, target, source}] | Earnings | No |
| technology_roadmap | array[{initiative, timeline, details}] | Earnings | No |
| algolia_opportunity_mapping | array[{priority, alignment, description}] | Analysis | Yes |

**ExecutiveQuote Object:**
```json
{
  "quote": "string",
  "speaker_name": "string",
  "speaker_title": "string",
  "date": "string",
  "source_url": "string",
  "maps_to_algolia": "string"
}
```

---

### Module 12: ICP Priority Mapping
**Scratchpad:** `12-icp-priority-mapping.md`

| Field | Type | Source | Required |
|-------|------|--------|----------|
| priority_matrix | array[PriorityMapping] | Analysis | Yes |
| discovery_conversation_anchors | {opening, probes: array[string]} | Analysis | Yes |
| financial_context | {annual_ecommerce, conversion_rate, ebitda_margin} | Calculation | Yes |
| search_revenue_lift_estimate | {conservative, moderate, aggressive} | Calculation | Yes |
| competitive_anchors | array[{competitor, provider, angle}] | Analysis | No |
| red_flags | array[{concern, evidence, reframe}] | Analysis | No |
| key_executives | array[{role, name, relevance}] | Module 07 | Yes |

**PriorityMapping Object:**
```json
{
  "priority_number": "integer",
  "their_stated_priority": "string",
  "source_url": "string",
  "algolia_solution": "string",
  "discovery_question": "string"
}
```

---

## 2. Output Deliverables

### Deliverable 1: Strategic Signal Brief
**File:** `{company}-strategic-signal-brief.md`
**Purpose:** 1-page LLM-consumable signal density document

**Sections:**
- 60-Second Story (narrative summary)
- Timing Signals (with SOURCE URLs)
- In Their Own Words (executive quotes with attribution)
- People (buying committee, HIGH/MEDIUM priority)
- Money (revenue, addressable, lift estimate)
- Gaps (from audit, score + severity)
- Hiring Intelligence (signals with source URLs)
- Competitive Landscape (provider analysis)
- ICP Mapping (priority → solution)
- The Angle (1-paragraph pitch)
- Sources (all URLs referenced)

---

### Deliverable 2: AE Pre-Call Brief
**File:** `{company}-ae-precall-brief.md`
**Purpose:** Sales-ready preparation document

**Sections:**
1. Executive Cheat Sheet (1-table summary)
2. Financial Profile (3-year trends, margin zone)
3. Key Executives (C-suite + digital leadership, entry points)
4. Recent News & Trigger Events (positive + caution signals)
5. Audit Highlights (top 3 findings with screenshots)
6. Discovery Questions (opening, current state, timing, ROI)
7. Objection Handling (common objections + reframes)
8. Speaking Their Language (their words → our solutions)

---

### Deliverable 3: Search Audit Report
**File:** `{company}-search-audit.md`
**Purpose:** Full technical audit documentation

**Sections:**
- Executive Summary
- Strategic Intelligence (from Module 11)
- Company Profile (from Module 01)
- Technology Stack (from Module 02)
- Traffic & Engagement (from Module 03)
- Competitive Landscape (from Module 04)
- Browser Testing Methodology
- Findings by Category (10 areas)
- Screenshots Gallery
- Scoring Matrix
- ROI Analysis
- Recommendations
- Appendix (all sources)

---

### Deliverable 4: Search Audit Book (PDF)
**File:** `{company}-search-audit-book.pdf`
**Purpose:** Premium deliverable, print-ready

**Structure:**
- Cover page (company photo + logo + status badge)
- Executive Summary Act
- Intelligence Act (strategic, financial, competitive)
- Audit Act (findings, screenshots, scoring)
- Opportunity Act (ROI, recommendations)
- Appendix (sources, methodology)

---

## 3. Data Pipeline Design

### Wave 1: Foundation (Parallel)
```
M01 (Company) ──┐
M02 (Tech)     ──┼──► Validation ──► Wave 2
M03 (Traffic)  ──┘
```

### Wave 2: Deep Intelligence (Parallel)
```
M04 (Competitors) ──┐
M05 (Queries)      ──┤
M06 (Strategic)    ──┼──► Validation ──► Wave 3
M07 (Hiring)       ──┤
M08 (Financial)    ──┘
```

### Wave 3: Analysis & Synthesis (Sequential)
```
M09 (Browser) ──► M10 (Scoring) ──► M11 (Investor) ──► M12 (ICP)
```

### Wave 4: Deliverables (Parallel)
```
All Modules ──► Strategic Brief
           ──► AE Brief
           ──► Audit Report
           ──► Book PDF
```

---

## 4. Source Citation Requirements

**CRITICAL:** Every data point across all deliverables MUST have a source attribution.

### Source Types:
- `[FACT]` - Verified from official source
- `[SOURCE: url]` - Linked to external source
- `[ESTIMATE]` - Calculated or estimated, requires warning flag
- `[API: endpoint]` - Retrieved from MCP server

### Validation Rules:
1. Financial data MUST link to Yahoo Finance, SEC, or company IR
2. Traffic data MUST link to SimilarWeb or equivalent
3. Tech stack MUST link to BuiltWith or network detection
4. Executive quotes MUST link to transcript URL
5. Hiring signals MUST link to LinkedIn job posting

---

## 5. Next Steps for Thread 2

1. **Create PostgreSQL Schema** - Tables for all 12 modules
2. **Design API Endpoints** - CRUD for each module
3. **Build Adapters** - BaseAdapter + BuiltWith + SimilarWeb + YahooFinance
4. **Create Transformers** - Raw API response → normalized schema
5. **Build Orchestrator** - Wave-based parallel execution
6. **Build Aggregator** - Combine module outputs into deliverables

---

*Document created: 2026-02-25*
*Thread: 2 - Data Pipeline*
*Purpose: Architecture design reference for PartnerForge ABM platform*
