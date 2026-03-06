# Algolia Search Audit - Complete Feature Inventory

**Source**: `/algolia-search-audit` SKILL.md (2,358 lines)
**Date**: March 3, 2026
**Total Features**: 125 features across 5 phases (updated from 127 after removing file-based workspace features)

---

## 🏗️ Architectural Translation: CLI Skill → SaaS Application

**CRITICAL**: This inventory describes features from the CLI skill perspective, but the SaaS implementation differs in **storage mechanism**, not **core logic**.

### Storage Architecture Mapping

| CLI Skill (Disk-Based) | SaaS Application (Database + S3) |
|-------------------------|----------------------------------|
| `{company}-audit-workspace/` directory | `audits` table row (audit_id) |
| `01-company-context.md` | `audit_company_data` table (typed columns: revenue_usd, margin_zone, ticker, etc.) |
| `02-tech-stack.md` | `audit_tech_stack` table (search_provider, ecommerce_platform, analytics_provider, etc.) |
| `03-traffic-metrics.md` | `audit_traffic_metrics` table (monthly_visits, bounce_rate, avg_session_duration, etc.) |
| `04-competitors.md` | `audit_competitors` table (competitor rows with domain, search_provider, monthly_visits) |
| `05-test-queries.md` | `audit_test_queries` table (query rows with query_text, vertical_tag, priority) |
| `09-browser-findings.md` | `screenshots` table (one row per finding with query, severity, description) |
| `10-scoring-matrix.md` | `audit_scoring` table (10 area rows with area_name, score, severity, reasoning) |
| ... (12 total files) | 10 normalized tables (see DATABASE_SCHEMA_SAAS.md) |
| `screenshots/05-typo.png` | S3: `s3://bucket/audits/{id}/screenshots/05-typo.png` + `screenshots` table row (metadata) |
| `{company}-book.pdf` | S3: `s3://bucket/audits/{id}/deliverables/book.pdf` + `deliverables` table row |
| `_workspace-manifest.md` | `audits.status`, `audits.current_phase`, `audits.progress_pct` columns |
| CLI progress output | `execution_logs` table + WebSocket events |

### Feature Translation Rules

When reading this inventory, apply these translations for SaaS implementation:

1. **"Write company context to 01-company-context.md"** → `INSERT INTO audit_company_data (audit_id, revenue_usd, margin_zone, ticker, ...)`
2. **"Write tech stack to 02-tech-stack.md"** → `INSERT INTO audit_tech_stack (audit_id, search_provider, ecommerce_platform, ...)`
3. **"Write traffic data to 03-traffic-metrics.md"** → `INSERT INTO audit_traffic_metrics (audit_id, monthly_visits, bounce_rate, ...)`
4. **"Add competitor to 04-competitors.md"** → `INSERT INTO audit_competitors (audit_id, competitor_domain, search_provider, ...)`
5. **"Add test query to 05-test-queries.md"** → `INSERT INTO audit_test_queries (audit_id, query_text, vertical_tag, ...)`
6. **"Update manifest checklist"** → `UPDATE audits SET current_phase = ?, progress_pct = ? WHERE id = ?`
7. **"Save screenshot to disk"** → `s3.upload(file)` + `INSERT INTO screenshots (audit_id, file_name, storage_url, query, severity)`
8. **"Verify data exists"** → `SELECT COUNT(*) FROM audit_company_data WHERE audit_id = ?` (or specific table)

### Core Logic Remains Identical

✅ **These aspects don't change**:
- MCP service calls (BuiltWith, SimilarWeb, Yahoo Finance, SEC EDGAR, WebSearch)
- Data processing logic (scoring, ROI calculation, chart generation)
- Browser testing steps (search, screenshot, analyze)
- Verification gate checks (just query DB instead of disk)
- Deliverable generation (HTML → PDF, markdown formatting)

❌ **Only the I/O layer changes**:
- File system → PostgreSQL + S3
- Local paths → S3 URLs
- Markdown files → Database TEXT fields with JSONB metadata

---

## Feature Categorization

| Category | Feature Count | Complexity |
|----------|---------------|------------|
| **Phase 0: Audit Initialization** | 6 features | Low |
| **Phase 1: Pre-Audit Research** | 54 features | High |
| **Phase 2: Browser Testing** | 23 features | Very High |
| **Phase 3: Scoring** | 11 features | Medium |
| **Phase 4: Report Generation** | 8 features | Medium |
| **Phase 5: Deliverables** | 15 features | High |
| **Verification Gates** | 8 features | Medium |
| **Total** | **125 features** | - |

---

## Phase 0: Audit Initialization (6 Features)

**Architecture Note**: SaaS replaces file-based workspace with database operations.

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 0.1 | Audit Record Creation | `INSERT INTO audits` with domain, config, requested_by_id | None | Domain, user_id, config JSON | audit_id (UUID) | MUST | Low |
| 0.2 | Company Lookup/Creation | Check if company exists in `companies` table, create if not | None | Domain | company_id | MUST | Low |
| 0.3 | Job Queue Entry | Add audit job to BullMQ with priority, phase config | None | audit_id, config | job_id | MUST | Low |
| 0.4 | S3 Folder Structure | Create S3 folders: `audits/{audit_id}/screenshots/`, `/deliverables/` | AWS S3 SDK | audit_id | S3 paths | MUST | Low |
| 0.5 | Phase Configuration Parsing | Parse config JSON to determine which phases to run | None | config JSON | Phase execution plan | MUST | Low |
| 0.6 | Duplicate Detection | Check if domain already audited in last 7 days, offer resume | PostgreSQL | Domain, date range | Existing audit_id or NULL | SHOULD | Low |

---

## Phase 1: Pre-Audit Research (54 Features)

### Step 1: Company Context (8 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 1.1 | Company Overview Search | WebSearch for company founding, industry, business model | WebSearch | Domain | Overview text | MUST | Low |
| 1.2 | SEO Keywords Extraction | Extract meta keywords and page titles for brand positioning | BuiltWith (`keywords-api`) | Domain | Keywords array | SHOULD | Low |
| 1.3 | Ticker Symbol Resolution | WebSearch for stock ticker (NYSE/NASDAQ) | WebSearch | Company name | Ticker symbol or NULL | MUST | Low |
| 1.4 | Financial Data (3-Year) | Get revenue, net income, EBITDA for 3 fiscal years | Yahoo Finance MCP (8 tools) | Ticker | Financial table | MUST | High |
| 1.5 | Margin Zone Classification | Calculate EBITDA margin → Red/Yellow/Green zone | None | EBITDA, Revenue | Margin zone enum | MUST | Low |
| 1.6 | Executive Research | Identify CEO, CFO, COO, CTO, CDO with backgrounds | WebSearch | Company name | Executive list | MUST | High |
| 1.7 | Vertical Classification | Match company to vertical-query-library categories | None | Industry, products | Vertical enum | MUST | Medium |
| 1.8 | Private Company Fallback | If no ticker, estimate revenue from ecdb.com, PitchBook | WebSearch, WebFetch | Company name | Estimated financials | MUST | High |

### Step 2: Technology Stack (10 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 2.1 | Current Tech Detection | Detect search provider, ecommerce platform, analytics | BuiltWith (`domain-lookup`) | Domain | Tech list | MUST | Low |
| 2.2 | Removed Tech Detection | Detect technologies removed in last 12 months | BuiltWith (`domain-lookup`) | Domain | Removed tech list | SHOULD | Low |
| 2.3 | Added Tech Detection | Detect technologies added in last 6 months | BuiltWith (`domain-lookup`) | Domain | Added tech list | SHOULD | Low |
| 2.4 | Sister Sites Discovery | Find related domains owned by same company | BuiltWith (`relationships-api`) | Domain | Related domains | SHOULD | Low |
| 2.5 | Tech Gap Analysis | Identify missing technologies recommended for vertical | BuiltWith (`recommendations-api`) | Domain | Gap list | SHOULD | Medium |
| 2.6 | Financial Estimates | Get revenue/employee estimates from BuiltWith | BuiltWith (`financial-api`) | Domain | Estimates | SHOULD | Low |
| 2.7 | Social Profiles | Extract LinkedIn, Twitter, Facebook URLs | BuiltWith (`social-api`) | Domain | Social URLs | COULD | Low |
| 2.8 | Domain Trust Score | Get domain age, trust score | BuiltWith (`trust-api`) | Domain | Trust metrics | COULD | Low |
| 2.9 | **Search Vendor Cross-Check** | **MANDATORY**: Verify search vendor via SimilarWeb Technologies API | SimilarWeb (`get-website-content-technologies-agg`) | Domain | Active search vendor | MUST | Medium |
| 2.10 | Search Vendor Verification | During Phase 2, monitor network requests to confirm if vendor tag is active | Chrome MCP | Domain, vendor name | Active/Tag-Only status | MUST | High |

### Step 3: Traffic & Engagement (14 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 3.1 | Traffic Volume | Get monthly visits, bounce rate, pages/visit, avg duration | SimilarWeb (`get-websites-traffic-and-engagement`) | Domain | Traffic metrics | MUST | Low |
| 3.2 | Traffic Sources | Get channel breakdown (organic, direct, paid, social, referral, mail) | SimilarWeb (`get-websites-traffic-sources`) | Domain | Source %s | MUST | Low |
| 3.3 | Geography Distribution | Get top countries by traffic share | SimilarWeb (`get-websites-geography-agg`) | Domain | Country %s | MUST | Low |
| 3.4 | Demographics | Get age and gender breakdown | SimilarWeb (`get-websites-demographics-agg`) | Domain | Age/gender %s | SHOULD | Low |
| 3.5 | Top Keywords | Get keywords driving search traffic (branded vs non-branded) | SimilarWeb (`get-website-analysis-keywords-agg`) | Domain | Keyword list | SHOULD | Low |
| 3.6 | Audience Interests | Get audience interest categories | SimilarWeb (`get-websites-audience-interests-agg`) | Domain | Interest categories | COULD | Low |
| 3.7 | Website Ranking | Get global rank + category rank | SimilarWeb (`get-websites-website-rank`) | Domain | Rank numbers | SHOULD | Low |
| 3.8 | Referral Sites | Get top incoming referral sites | SimilarWeb (`get-websites-referrals-agg`) | Domain | Referrer list | SHOULD | Low |
| 3.9 | Popular Pages | Get top pages by traffic share | SimilarWeb (`get-pages-popular-pages-agg`) | Domain | Page list | SHOULD | Low |
| 3.10 | Leading Folders | Get top URL folders (site architecture: /search/, /product/) | SimilarWeb (`get-pages-leading-folders-agg`) | Domain | Folder list | SHOULD | Low |
| 3.11 | Organic Landing Pages | Get top organic landing pages | SimilarWeb (`get-websites-landing-pages-agg`) | Domain, source="organic" | Landing page list | SHOULD | Low |
| 3.12 | API Parameter Logging | Log web_source, country, date range for reproducibility | None | API params | Metadata header | MUST | Low |
| 3.13 | Web Source Standardization | Use "total" (desktop+mobile) consistently, fallback to "desktop" | None | API response | Standardized data | MUST | Low |
| 3.14 | Data Confidence Tagging | Tag each metric as [FACT]/[ESTIMATE]/[OBSERVED] | None | Data point, source | Tagged data | MUST | Low |

### Step 4: Competitor Identification (3 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 4.1 | Similar Sites Discovery | Find top 3-5 competitors by audience overlap | SimilarWeb (`get-websites-similar-sites-agg`) | Domain | Competitor list | MUST | Low |
| 4.2 | Keyword Competitors | Find competitors ranking for same keywords | SimilarWeb (`get-websites-keywords-competitors-agg`) | Domain | Competitor list | MUST | Low |
| 4.3 | Competitor Prioritization | Cross-reference both lists, select top 3-5 | None | 2 competitor lists | Final 3-5 | MUST | Low |

### Step 5: Test Query Generation (2 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 5.1 | Vertical Query Lookup | Load queries from `vertical-query-library.md` | None | Vertical | 10-12 queries | MUST | Low |
| 5.2 | Company-Specific Queries | Add 4-6 custom queries (flagship products, brands) | None | Homepage inspection | 4-6 queries | MUST | Medium |

### Step 6: Competitor Search Analysis (4 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 6.1 | Competitor Tech Detection | BuiltWith for each competitor | BuiltWith (`domain-lookup`) | Competitor domain | Search provider | MUST | Low |
| 6.2 | Competitor Traffic | Quick traffic check for each competitor | SimilarWeb (`get-websites-traffic-and-engagement`) | Competitor domain | Monthly visits, bounce | SHOULD | Low |
| 6.3 | Golden Angle Check | Flag if ANY competitor uses Algolia | None | Tech detection results | Boolean flag | MUST | Low |
| 6.4 | Competitor Matrix | Create comparison table with search providers | None | All competitor data | Markdown table | MUST | Low |

### Step 7: Strategic Angle Mining (5 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 7.1 | Expansion Signals | Search for new stores, markets, product lines | WebSearch | Company name | Signal list | SHOULD | Medium |
| 7.2 | Digital Transformation | Search for e-commerce investment, mobile app, headless | WebSearch | Company name | Signal list | SHOULD | Medium |
| 7.3 | Competitive Pressure | Search for competitors gaining share | WebSearch | Company + competitors | Signal list | COULD | Medium |
| 7.4 | Industry Trends | Search for macro trends affecting vertical | WebSearch | Vertical | Trend list | COULD | Medium |
| 7.5 | Negative Signal Check | Search for layoffs, earnings miss, hiring freeze | WebSearch | Company name + year | Warning list | MUST | Medium |

### Step 8: Hiring Signal Detection (2 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 8.1 | Job Posting Search | Search for "search engineer", "relevance", "e-commerce" roles | WebSearch | Company name | Job list | MUST | Medium |
| 8.2 | Signal Interpretation | Match titles to Tier 1/2/3 taxonomy, assign signal strength | None | Job list | Prioritized signals | MUST | Medium |

### Step 9: Financial Synthesis + ROI (3 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 9.1 | 3-Year Trend Table | Calculate YoY growth, CAGR, trend direction | None | Financial data | Trend table | MUST | Medium |
| 9.2 | ROI Estimation | Calculate conservative/moderate improvement scenarios | None | Revenue, digital share | ROI range | MUST | Medium |
| 9.3 | Vertical Case Study Selection | Match vertical to relevant Algolia case studies | None | Vertical | 2 case studies | MUST | Low |

### Step 10: Trigger Event Synthesis (2 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 10.1 | Positive Trigger Identification | Cross-reference all signals for top 3 positive triggers | None | All Phase 1 data | 3 triggers | MUST | Medium |
| 10.2 | Article Date Verification | Extract publication date from news articles, flag stale sources | WebFetch | Article URLs | Date-verified list | MUST | Medium |

### Step 11: Vertical Matching (1 Feature)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 11.1 | Case Study Assignment | Select primary + secondary case studies from matrix | None | Vertical | 2 case study URLs | MUST | Low |

### Step 12: Investor Intelligence (6 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 12.1 | 10-K Filing Retrieval | Search and retrieve latest 10-K annual filing | SEC EDGAR MCP (`search_filings`, `get_section_text`) | Ticker | 10-K MD&A, Risk Factors | MUST | Medium |
| 12.2 | 10-Q Filing Retrieval | Search and retrieve latest 10-Q quarterly filing | SEC EDGAR MCP | Ticker | 10-Q MD&A | SHOULD | Medium |
| 12.3 | Earnings Call Transcripts | WebSearch + WebFetch last 3 quarters of earnings calls | WebSearch, WebFetch | Company name, ticker | Transcript text | MUST | High |
| 12.4 | Executive Quote Extraction | Extract 5-8 quotes from ANY named executive (not just CEO/CFO) | None | Transcripts, filings | Quote table | MUST | High |
| 12.5 | Analyst Estimates | Get consensus recommendations and rating changes | Yahoo Finance MCP (`get_recommendations`) | Ticker | Analyst data | SHOULD | Low |
| 12.6 | Private Company Intelligence | For private companies: CEO interviews, funding, investor press releases | WebSearch, WebFetch | Company name | Quote table | MUST | High |

### Step 13: Deep Hiring + Buying Committee (4 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 13.1 | Careers Page Visit | Navigate to careers page via Chrome MCP | Chrome MCP | Careers URL | Page content | MUST | Medium |
| 13.2 | Job Search on Careers | Search for keywords: "search", "AI", "e-commerce" | Chrome MCP | Keywords | Search results | MUST | Medium |
| 13.3 | Role Categorization | Count roles by category (Engineering, Product, Data, Merchandising) | None | Job list | Category counts | MUST | Medium |
| 13.4 | Buying Committee Mapping | LinkedIn search for Economic/Technical/User/Champion buyers | WebSearch | Company name, titles | Stakeholder table | MUST | High |

### Step 14: ICP-to-Priority Mapping (1 Feature)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 14.1 | Priority-to-Product Mapping | Match investor quotes to Algolia products, create discovery questions | None | Investor intelligence, gaps | Mapping table | MUST | High |

---

## Phase 2: Browser Testing (23 Features)

### Core Tests (12 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 2a | Initial Homepage Observation | Navigate to homepage, screenshot search bar | Chrome MCP | Domain | Screenshot 01 | MUST | Medium |
| 2a½ | Search Vendor Network Verification | Monitor network requests to verify if detected vendor is active | Chrome MCP | Domain, vendor name | Active/Tag-Only status | MUST | High |
| 2b | Empty State Test | Click search bar without typing, observe suggestions | Chrome MCP | Domain | Screenshot 02 | MUST | Medium |
| 2c | SAYT Test | Type query letter-by-letter, observe autocomplete | Chrome MCP | Test query | Screenshot 03 | MUST | High |
| 2d | Full Results Test | Submit query, observe results page | Chrome MCP | Test query | Screenshot 04 | MUST | Medium |
| 2e | Typo Tolerance Test | Search misspelled queries, check if results returned | Chrome MCP | Typo queries | Screenshots 05-N | MUST | High |
| 2f | Synonym Test | Search synonyms (couch/sofa), check understanding | Chrome MCP | Synonym queries | Screenshots | MUST | Medium |
| 2g | No Results Test | Search nonsense query, observe empty state | Chrome MCP | Nonsense query | Screenshot | MUST | Medium |
| 2h | Non-Product Content Test | Search "return policy", check if content pages returned | Chrome MCP | Help queries | Screenshot | MUST | Medium |
| 2i | Intent Detection Test | Test brand/category/attribute queries, check handling | Chrome MCP | Intent queries | Screenshots | MUST | High |
| 2j | Merchandising Consistency | Compare search results vs category browse | Chrome MCP | Category term | 2 screenshots | SHOULD | High |
| 2k | Federated Search Check | Check if SAYT shows products, categories, content | Chrome MCP | Query | Screenshot | MUST | Medium |
| 2l | Mobile Experience Test | Resize to mobile, quick search test | Chrome MCP | Query | Screenshot | SHOULD | Medium |

### Algolia Value-Prop Tests (8 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 2m | Semantic/NLP Search Test | Test conversational, multi-attribute queries | Chrome MCP | NLP queries | Screenshots | MUST | High |
| 2n | Dynamic Facets Test | Search different categories, observe filter changes | Chrome MCP | Category queries | Screenshots | SHOULD | Medium |
| 2o | Popular Searches Test | Check if popular/recent searches shown | Chrome MCP | - | Screenshot | SHOULD | Low |
| 2p | Dynamic Categories Test | Check if dynamic category suggestions appear | Chrome MCP | Query | Screenshot | COULD | Low |
| 2q | Personalization Test | Browse category, then search broad term, check personalization | Chrome MCP | - | Screenshot | SHOULD | High |
| 2r | Recommendations Test | Navigate to PDPs, check recommendation quality | Chrome MCP | - | Screenshots | MUST | Medium |
| 2s | Banners/Rules Test | Search seasonal/campaign terms, check banners | Chrome MCP | Campaign queries | Screenshots | SHOULD | Medium |
| 2t | Analytics Visibility Test | Look for trending/bestseller badges | Chrome MCP | - | Screenshot | COULD | Low |

### Browser Resilience (3 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| BR.1 | WAF Detection & Recovery | Detect Akamai/Cloudflare blocks, escalate recovery (5 steps) | Chrome MCP | Page content | Recovery result | MUST | Very High |
| BR.2 | CAPTCHA Handling | Detect CAPTCHA, request user intervention | Chrome MCP | Page content | User-solved | MUST | High |
| BR.3 | Screenshot Persistence | Persist Chrome MCP imageIds to disk immediately (3 methods) | Chrome MCP, Bash | imageId | .png file | MUST | High |

---

## Phase 3: Scoring (11 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 3.1 | Latency Scoring | Score search speed (HIGH: >500ms, MED: 300-500ms, LOW: <300ms) | None | Observations | Score + severity | MUST | Low |
| 3.2 | Typo Tolerance Scoring | Score typo handling (HIGH: none, MED: partial, LOW: good) | None | Typo test results | Score + severity | MUST | Low |
| 3.3 | Query Suggestions Scoring | Score empty state + no-results (HIGH: both bad, MED: one, LOW: both good) | None | Test results | Score + severity | MUST | Low |
| 3.4 | Intent Detection Scoring | Score category/brand/attribute detection | None | Intent tests | Score + severity | MUST | Medium |
| 3.5 | Merchandising Consistency Scoring | Score search vs browse differences | None | Comparison | Score + severity | MUST | Low |
| 3.6 | Content Commerce Scoring | Score federated search + UX | None | Federated test | Score + severity | MUST | Medium |
| 3.7 | Semantic/NLP Scoring | Score NLP query understanding | None | NLP tests | Score + severity | MUST | Medium |
| 3.8 | Dynamic Facets Scoring | Score filter context-awareness | None | Facet tests | Score + severity | SHOULD | Medium |
| 3.9 | Recommendations Scoring | Score rec relevance | None | Rec tests | Score + severity | MUST | Medium |
| 3.10 | Search Intelligence Scoring | Score trending/popular/analytics signals | None | Analytics test | Score + severity | COULD | Low |
| 3.11 | Weighted Overall Score Calculation | Calculate severity-weighted average (HIGH=2x, MED=1x, LOW=0.5x) | None | 10 area scores | Overall score | MUST | Medium |

---

## Phase 4: Report Generation (8 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 4.1 | Executive Summary | Generate 2-3 sentence overview | None | All data | Summary text | MUST | Medium |
| 4.2 | Strategic Intelligence Section | Generate timing signals, trigger events table | None | Phase 1 data | Section | MUST | Medium |
| 4.3 | "In Their Own Words" Section | Generate quote-to-finding pairs with speaker attribution | None | Investor intel + gaps | Section | MUST | High |
| 4.4 | Competitor Landscape | Generate competitor matrix with search providers | None | Competitor data | Table | MUST | Low |
| 4.5 | Audit Findings | Generate detailed finding per gap (tested/expected/found/solution) | None | Browser findings | Findings list | MUST | High |
| 4.6 | ICP Mapping | Generate priority-to-product discovery questions | None | Step 14 output | Section | MUST | Medium |
| 4.7 | Case Study Verification Gate | WebFetch each case study URL, extract EXACT metric | WebFetch | Case study URLs | Verified metrics | MUST | High |
| 4.8 | Link Verification Gate | WebFetch all URLs in report, replace dead links | WebFetch | All URLs | Verified URLs | MUST | Medium |

---

## Phase 5: Deliverables (15 Features)

### 5a: PDF Book Assembly (8 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 5a.1 | Template Copying | Copy `book-template.html` + `components.css` to workspace | Bash | Template paths | HTML + CSS files | MUST | Low |
| 5a.2 | Pre-Deliverable Data Refresh | Query ALL 10 Phase 1 research tables before populating | PostgreSQL | audit_id | Data in memory | MUST | High |
| 5a.3 | Sub-Phase 1: Act I | Populate cover + chapters 1-4 → save → verify | None | Database query results | 4 chapters | MUST | High |
| 5a.4 | Sub-Phase 2: Act II | Populate chapters 5-13 (findings) → save → verify | None | Browser findings | 9 chapters | MUST | Very High |
| 5a.5 | Sub-Phase 3: Act III | Populate chapters 14-18 (Why Now) → save → verify | None | Strategic data | 5 chapters | MUST | High |
| 5a.6 | Sub-Phase 4: Act IV | Populate chapters 19-22 (The Path) → save → verify | None | ICP mapping | 4 chapters | MUST | High |
| 5a.7 | Sub-Phase 5: Appendices | Populate Appendices A-F → save → verify | None | All database tables | 6 appendices | MUST | High |
| 5a.8 | SVG Chart Generation | Auto-generate 6 SVG charts (revenue, funnel, donut, bars, etc.) | None | Financial data | SVG code | MUST | Very High |

### 5b: AE Brief (2 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 5b.1 | AE Brief Generation | Generate 10-section markdown brief with hyperlinks | None | All data | Markdown file | MUST | High |
| 5b.2 | "Speaking Their Language" Section | Generate discovery questions using company's OWN language | None | ICP mapping | Section | MUST | High |

### 5c: Signal Brief (1 Feature)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 5c.1 | Signal Brief Generation | Generate 1-page LLM-ready brief with standalone insights | None | All data | Markdown file | MUST | Medium |

### Brand & PDF (4 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| 5d.1 | Brand Compliance Check | Run `/algolia-brand-check` on HTML, auto-fix if <8/10 | Skill | HTML file | Brand score | MUST | Medium |
| 5d.2 | PDF Generation | Chrome headless `--print-to-pdf` via localhost HTTP server | Bash | HTML file | PDF file | MUST | High |
| 5d.3 | PDF Verification | Check file size (500KB-5MB), page count via `mdls` | Bash | PDF path | Validation result | MUST | Low |
| 5d.4 | Deliverable Packaging | Collect all 3 files + HTML + CSS + screenshots into package | Bash | File paths | Complete package | SHOULD | Low |

---

## Verification Gates (8 Features)

| ID | Feature Name | Description | MCP Services | Inputs | Outputs | Priority | Complexity |
|----|--------------|-------------|--------------|--------|---------|----------|------------|
| G1 | Gate 1: Phase 1 Completion | Verify 14 steps done, all MCP calls made, sources captured | Bash | Workspace | Pass/Fail | MUST | Medium |
| G2 | Gate 2: Screenshot Persistence | Verify ≥10 .png files on disk, all >50KB (not error pages) | Bash | screenshots/ | Pass/Fail | MUST | High |
| G3 | Gate 3: Scoring Completion | Verify 10 areas scored in matrix | Bash | Scoring file | Pass/Fail | MUST | Low |
| G4 | Gate 4: Report Sections | Verify 18 required sections present in report | Bash | Report file | Pass/Fail | MUST | Medium |
| G4.5 | Gate 4.5: Data Verification | Re-fetch revenue, verify sources fresh (<12mo), cross-reference | WebFetch | Primary sources | Pass/Fail | MUST | Very High |
| G5 | Gate 5: Chapter Count | Verify ≥25 chapters in HTML, ≥28 pages in PDF, ≥15 citations | Bash | HTML + PDF | Pass/Fail | MUST | Medium |
| G6 | Gate 6: Statistic Verification | WebFetch all cited stats, verify exact numbers appear at source | WebFetch | All stat URLs | Pass/Fail | MUST | Very High |
| G7 | Manifest Checklist Validation | Verify all items in manifest marked `[x] done` | Bash | Manifest file | Pass/Fail | MUST | Low |

---

## Summary Statistics

### By Priority
- **MUST HAVE**: 108 features (86%)
- **SHOULD HAVE**: 14 features (11%)
- **COULD HAVE**: 3 features (2%)

### By Complexity
- **Low**: 49 features (39%)
- **Medium**: 39 features (31%)
- **High**: 29 features (23%)
- **Very High**: 8 features (6%)

### By MCP Service
- **Chrome MCP**: 26 features
- **SimilarWeb MCP**: 14 features
- **BuiltWith MCP**: 9 features
- **Yahoo Finance MCP**: 5 features
- **SEC EDGAR MCP**: 2 features
- **WebSearch**: 15 features
- **WebFetch**: 8 features
- **None (Logic)**: 48 features

### Estimated Development Effort
- **Total Story Points**: ~475 (assuming 3-5 points per feature average)
- **Team Size**: 6 engineers (2 frontend, 2 backend, 1 DevOps, 1 QA)
- **Timeline**: 16-20 weeks to MVP

### Data Storage Architecture (SaaS vs CLI)

| Data Type | CLI Skill | SaaS Application |
|-----------|-----------|------------------|
| **Phase 1 Research Data** | 12 .md files on disk | 10 normalized tables (audit_company_data, audit_executives, audit_tech_stack, audit_traffic_metrics, audit_competitors, audit_test_queries, audit_financial_data, audit_roi_estimates, audit_investor_quotes, audit_hiring_signals) |
| **Phase 2 Browser Data** | `09-browser-findings.md` | `screenshots` table (one row per finding with typed columns) |
| **Phase 3 Scoring Data** | `10-scoring-matrix.md` | `audit_scoring` table (10 rows per audit, one per area) |
| **Screenshots** | `screenshots/*.png` on disk | S3 bucket + `screenshots` table (metadata) |
| **Deliverables** | 3 files in workspace | S3 bucket + `deliverables` table (metadata) |
| **Progress Tracking** | `_workspace-manifest.md` | `audits.status`, `audits.current_phase`, `audits.progress_pct` |
| **Execution Logs** | None (CLI output) | `execution_logs` table |
| **MCP Call History** | None | `mcp_calls` table (for caching + analytics) |

---

## Feature Dependencies

### Critical Path (Must Be Sequential)
1. Phase 0 → Phase 1 → Gate 1
2. Phase 1 → Phase 2 → Gate 2
3. Phase 2 → Phase 3 → Gate 3
4. Phase 3 → Phase 4 → Gates 4 & 4.5
5. Phase 4 → Phase 5 → Gates 5 & 6

### Parallelizable Features
- **Phase 1**: Steps 1-4 can run in parallel (Wave 1)
- **Phase 1**: Steps 5-9 can run in parallel after Wave 1 (Wave 2)
- **Phase 2**: All tests sequential (browser state)
- **Phase 5**: Book sub-phases sequential, but AE/Signal briefs can run in parallel

---

## SaaS Implementation Notes

### Phase 1-5 Output Destinations

| Phase | CLI Skill Output | SaaS Application Output |
|-------|------------------|-------------------------|
| **Phase 1** (Research) | 12 markdown files in workspace | 10 normalized tables populated + `audits.ticker`, `audits.margin_zone`, `audits.vertical_matched` columns |
| **Phase 2** (Browser) | `09-browser-findings.md` + `screenshots/*.png` (10-20 files) | 10-20 rows in `screenshots` table (typed columns: query, severity, description, expected, found, solution, storage_url) + S3 files |
| **Phase 3** (Scoring) | `10-scoring-matrix.md` | 10 rows in `audit_scoring` table (one per area) + `audits.overall_audit_score` column |
| **Phase 4** (Report) | `{company}-search-audit.md` | Not stored (intermediate, regenerated on-demand from normalized tables) |
| **Phase 5** (Deliverables) | 3 files (PDF, AE brief, signal brief) + HTML/CSS | 3 rows in `deliverables` table + S3 files |

### Verification Gates in SaaS

| Gate | CLI Check | SaaS Check |
|------|-----------|------------|
| **Gate 1** | `ls *.md | wc -l` = 14 files? | Verify all 10 Phase 1 tables have data: `SELECT COUNT(*) FROM audit_company_data WHERE audit_id = ?`, etc. |
| **Gate 2** | `ls screenshots/*.png | wc -l` ≥ 10? | `SELECT COUNT(*) FROM screenshots WHERE audit_id = ?` ≥ 10? |
| **Gate 2** | File size check (`stat -f%z`) | `SELECT file_size_bytes FROM screenshots WHERE audit_id = ?` all >50KB? |
| **Gate 3** | Scoring file has 10 areas | `SELECT COUNT(*) FROM audit_scoring WHERE audit_id = ?` = 10? |
| **Gate 5** | `grep -c 'class="chapter"'` in HTML | Parse HTML from deliverables.content, count chapters |
| **Gate 5** | `mdls -name kMDItemNumberOfPages` | Use pdfinfo or store `deliverables.page_count` during generation |

### Agent Teams in SaaS

CLI skill spawns agent subprocesses (via `claude-sneakpeek` Agent Teams). SaaS replicates this with **BullMQ parallel jobs**:

```typescript
// Wave 1: 4 parallel jobs
await Promise.all([
  bullQueue.add('phase1-company-context', { audit_id }),
  bullQueue.add('phase1-tech-stack', { audit_id }),
  bullQueue.add('phase1-traffic', { audit_id }),
  bullQueue.add('phase1-competitors', { audit_id })
]);

// Wait for Wave 1 completion, then Wave 2
await Promise.all([
  bullQueue.add('phase1-test-queries', { audit_id }),
  bullQueue.add('phase1-competitor-search', { audit_id }),
  bullQueue.add('phase1-strategic-angles', { audit_id }),
  bullQueue.add('phase1-hiring-signals', { audit_id }),
  bullQueue.add('phase1-financial-roi', { audit_id })
]);

// ... Wave 3, 4
```

Each job writes its output to the appropriate normalized table upon completion (e.g., `audit_company_data`, `audit_tech_stack`, `audit_traffic_metrics`).

### Real-Time Progress Tracking

CLI skill prints progress to stdout. SaaS broadcasts via WebSocket:

```typescript
// Inside each job/step
await db.executionLogs.insert({
  audit_id,
  phase: 'phase_1',
  step: 'Company Context',
  level: 'info',
  message: 'Fetched stock data for ticker COST',
  metadata: { ticker: 'COST', revenue: 254200000000 }
});

// Update audit progress
await db.audits.update(audit_id, {
  progress_pct: 15.0,
  current_phase: 1
});

// Broadcast WebSocket event
io.to(audit_id).emit('progress_update', {
  audit_id,
  phase: 1,
  step: 'Company Context',
  progress_pct: 15.0,
  message: 'Fetched stock data for ticker COST'
});
```

---

**Feature Inventory Complete** ✅
125 features documented with full MCP service mapping, complexity estimates, and SaaS architectural translation.
