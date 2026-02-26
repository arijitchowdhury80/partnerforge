# PartnerForge - Project Memory

## Overview
Partner Intelligence Platform for Algolia Sales. Finds companies using partner technologies (Adobe AEM, Shopify, etc.) who are NOT using Algolia for search - displacement opportunities with deep intelligence enrichment.

## Core Logic
```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

## Architecture (v2.0 - Feb 2026)

```
┌─────────────────────────────────────────────────────────────┐
│                    PartnerForge 2.0                         │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: Discovery                                         │
│  • BuiltWith → AEM/Shopify users                           │
│  • SimilarWeb → Traffic + competitors                       │
│  • ICP Scoring → Prioritization (0-100)                     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: Intelligence                                      │
│  • Yahoo Finance → 3-year financials, margin zone           │
│  • Earnings Calls → Executive quotes, strategic priorities  │
│  • Careers Pages → Hiring signals, buying committee         │
│  • News/SEC → Trigger events, risk factors                  │
│  • Case Studies → Matched proof points                      │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: Action                                            │
│  • Export CSV (for Salesforce/Outreach)                     │
│  • Generate personalized email                              │
│  • Download dossier PDF                                     │
└─────────────────────────────────────────────────────────────┘
```

## Prioritization Framework

### The Core Principle
A company is **HOT** when three types of signals converge:
```
HOT = BUDGET SIGNAL + PAIN SIGNAL + TIMING SIGNAL
```

### Signal Taxonomy
| Category | Signal | Weight | Source |
|----------|--------|--------|--------|
| **BUDGET** | Hiring search/AI roles | +25 | Careers page |
| **BUDGET** | Revenue growing >10% YoY | +15 | Yahoo Finance |
| **BUDGET** | Margin zone = Green (>20%) | +10 | Yahoo Finance |
| **PAIN** | Search vendor REMOVED | +30 | BuiltWith |
| **PAIN** | Using competitor search | +15 | BuiltWith |
| **PAIN** | Executive quote re digital | +20 | Earnings call |
| **TIMING** | New CTO/CDO (<12mo) | +25 | LinkedIn |
| **TIMING** | Platform migration | +20 | 10-K/News |
| **TIMING** | Competitor uses Algolia | +20 | BuiltWith + Case |
| **NEGATIVE** | Layoffs announced | -25 | News |
| **NEGATIVE** | Added competitor search | -40 | BuiltWith |

### Priority Score Formula
```python
PRIORITY_SCORE = ICP_SCORE + SIGNAL_SCORE

HOT = Score >= 150 OR (has Budget AND Pain AND Timing signals)
WARM = Score 100-149 OR (has 2 of 3 signal types)
COOL = Score 50-99
COLD = Score < 50 OR negative signals
```

## Database Schema (SQLite)
**Location:** `data/partnerforge.db`

### Core Tables
| Table | Records | Purpose |
|-------|---------|---------|
| `displacement_targets` | 2,687 | AEM users NOT on Algolia |
| `companies` | 400 | Existing Algolia customers |
| `competitive_intel` | 25 | SimilarWeb → BuiltWith analysis |
| `case_studies` | 161 | For matching to targets |

### Intelligence Tables (Added 2026-02-25)
| Table | Purpose |
|-------|---------|
| `company_financials` | 3-year financial trends, margin zone |
| `executive_quotes` | Quotes from earnings calls, 10-K filings |
| `hiring_signals` | Job postings indicating buying signals |
| `strategic_triggers` | Expansion, migration, competitive pressure |
| `buying_committee` | Named stakeholders with priority signals |
| `verified_case_studies` | Algolia case studies with verified URLs |
| `enrichment_status` | Track what's been enriched per company |

### Key Columns (displacement_targets)
- `domain`, `company_name`, `vertical`, `country`
- `icp_tier` - 1=Commerce, 2=Content, 3=Support
- `lead_score` - 0-100 ICP score
- `ticker` - Stock ticker (if public)
- `is_public` - 1=public company, 0=private
- `enrichment_level` - 'basic', 'partial', 'full'
- `last_enriched` - Timestamp

## ICP Scoring Model (0-100 points)

| Component | Max | Logic |
|-----------|-----|-------|
| Vertical/Tier | 40 | Commerce=40, Content=25, Support=15 |
| Traffic | 30 | 50M+=30, 10M+=25, 1M+=15 |
| Tech Spend | 20 | $100K+=20, $50K+=15 |
| Partner Tech | 10 | Adobe=10, Shopify=7 |

## Scripts (Updated Feb 25, 2026)

| Script | Purpose | Status |
|--------|---------|--------|
| `generate_dashboard.py` | Generate interactive dashboard from SQLite | ✅ Active |
| `enrich_company.py` | Enrich company with financials, signals | ✅ 54 ticker mappings |
| `migrate_intelligence_schema.py` | Create intelligence tables | ✅ Deployed |
| `seed_verified_case_studies.py` | Verify and seed Algolia case study URLs | ✅ 16 cases seeded |
| `icp_scoring.py` | Apply ICP scoring to targets | ✅ Active |
| `competitive_intelligence.py` | SimilarWeb → BuiltWith pipeline | ✅ Active |
| `import_customer_evidence.py` | Excel → SQLite import | ✅ Active |
| `fetch_partner_targets.py` | BuiltWith Lists API fetch | ✅ Active |

### enrich_company.py Details
- **Ticker mappings:** 54 public companies (AutoZone, Costco, Tapestry, etc.)
- **Yahoo Finance API:** Fetches 3-year financials (revenue, net income, margins)
- **API issues noted:** Some tickers timeout; fallback to WebSearch for recent data
- **Signal scoring weights:**
  - Budget signals: 25 (hiring) + 15 (revenue growth) + 10 (margin)
  - Pain signals: 30 (vendor removed) + 15 (competitor) + 20 (quote)
  - Timing signals: 25 (new exec) + 20 (migration) + 20 (competitive)

## Dashboard Features (v2.0 - Feb 25, 2026)

### List View
- Search bar with live filtering
- Sortable columns (click headers)
- Excel-style column filters (▼ icons, checkboxes per value)
- CSV export button
- Score breakdown tooltip on hover
- Visual score progress bars

### Detail View (Full-Page)
**Theme:** Dark (#1a1a2e background) with glassmorphism cards

**Above the Fold:**
- Priority status badge (HOT/WARM/COOL)
- Signal indicators (Budget ✅ Pain ✅ Timing ✅)
- Trigger events (news, migrations, competitive pressure)
- Competitive intelligence (search vendor details, Algolia in-market status)
- Key executive quote (with Speaker + Title attribution)
- Competitive advantage callout

**Tabbed Intelligence Sections:**
1. **Financials Tab**
   - 3-year revenue/net income charts
   - Margin zone indicator (Green/Yellow/Red)
   - YoY growth rate
   - Stock price (if public)
   - All citations linked to SEC 10-K or Yahoo Finance

2. **Quotes Tab**
   - All executive quotes from earnings calls
   - Speaker name + Title + Date
   - Context (strategic priorities, digital transformation themes)
   - Linked to transcript at SeekingAlpha

3. **Hiring Tab**
   - Job postings by category (search, AI, platform, data)
   - Titles extracted from careers page
   - Budget signal strength indicator
   - Career page URL

4. **Tech Stack Tab**
   - Full list of detected technologies
   - Partner tech (Adobe, Shopify, etc.) highlighted
   - Current search vendor (if any)
   - Aging tech indicators

5. **Full Tab**
   - All intelligence unified (for copying/export)

### UX Components
- **Glassmorphism cards** for signal indicators
- **Excel-style column filtering** with ▼ dropdown icons
- **Dark theme** (#1a1a2e) for reduced eye strain
- **Clickable citations** on every data point
- **3-year financial charts** with trend insights
- **Verified case study links** (no 404s)
- **Mobile responsive** design
- **Competitive advantage section** highlighting why Algolia wins

## Deployment (Live Feb 25, 2026)
- **GitHub:** https://github.com/arijitchowdhury80/partnerforge
- **Vercel:** https://partnerforge.vercel.app
- **Status:** ✅ Live, auto-deploys on git push
- **Dashboard:** Full-page detail view with dark theme + tabbed intelligence
- **Entry point:** `index.html` (static HTML + embedded JSON data)

## API Keys
- **BuiltWith:** Set via `BUILTWITH_API_KEY` environment variable
- **SimilarWeb:** Set via `SIMILARWEB_API_KEY` environment variable

## Key Findings (2026-02-25)

### AEM Displacement Analysis
- **2,687 targets** (AEM users not on Algolia)
- **5 hot leads** (score 80+): HUAWEI, NAB, Mercedes-Benz, CVS, S&P Global
- **149 warm leads** (score 60-79)
- **Estimated pipeline:** $63M

### Competitive Intel
- **Algolia users:** Walmart, eBay, Kohl's, Etsy, Mercari
- **Displacement targets:** Sam's Club, Macy's, Kmart, Sears (on Elasticsearch)

## Citation Requirements (Mandatory)

Every data point follows this pattern:
```html
<span class="value">$108.2B</span>
<a class="citation" href="URL">[Source ↗]</a>
```

| Data Type | Primary Source | Citation Format |
|-----------|---------------|-----------------|
| Revenue, Net Income | SEC 10-K | `[10-K FY20XX](sec.gov/...)` |
| Stock price | Yahoo Finance | `[Yahoo Finance](finance.yahoo.com/...)` |
| Traffic | SimilarWeb | `[SimilarWeb](similarweb.com/...)` |
| Tech stack | BuiltWith | `[BuiltWith](builtwith.com/...)` |
| Executive quotes | Earnings transcript | `[Q4 2025 Earnings](seekingalpha.com/...)` |
| Hiring signals | Careers page | `[Careers](careers.company.com/...)` |

## File Structure
```
PartnerForge/
├── README.md
├── MEMORY.md                     # This file
├── PRD.md
├── index.html                    # Main dashboard (Vercel entry)
├── vercel.json                   # Static site config
├── data/
│   └── partnerforge.db           # SQLite database
├── output/
│   └── *.csv                     # Exported reports
├── scripts/
│   ├── generate_dashboard.py     # Dashboard generator
│   ├── enrich_company.py         # Intelligence enrichment
│   ├── migrate_intelligence_schema.py
│   ├── seed_verified_case_studies.py
│   ├── icp_scoring.py
│   ├── competitive_intelligence.py
│   ├── import_customer_evidence.py
│   └── fetch_partner_targets.py
└── supabase/
    └── migrations/
```

## Enrichment Pipeline (Feb 25, 2026)

### Data Collection Strategy
**enrich_company.py** implements 3-layer enrichment with signal scoring:

```
Layer 1: Financial Intelligence
├─ Yahoo Finance API (revenue, net income, margin %)
├─ Stock price (if public)
├─ 3-year trend analysis
└─ Margin zone classification (Green >20%, Yellow 10-20%, Red <10%)

Layer 2: Executive Intelligence
├─ Earnings call transcripts (Q1-Q4 from 2 recent years)
├─ Executive quotes on digital transformation, search, AI
├─ Speaker name + Title extraction
└─ Strategic priority mapping

Layer 3: Operational Intelligence
├─ Careers page job postings
├─ Hiring signals by category (search, AI, platform, data)
├─ Buying committee estimation
└─ Tech stack changes
```

### Ticker Mapping (54 Companies)
Public companies with verified tickers:
- **Retail:** AutoZone (AZO), Costco (COST), Tapestry (TPH), The RealReal (REAL), Oriental Trading (private)
- **Media/Tech:** Amazon (AMZN), Microsoft (MSFT), Walmart (WMT)
- **B2B/Enterprise:** CVS (CVS), NAB, Mercedes-Benz (MBGYY), S&P Global (SPGI)
- Plus 43 additional mappings in `enrich_company.py`

### Yahoo Finance API Issues (Known)
- Some tickers timeout on first call (use exponential backoff)
- Fallback: WebSearch for latest quarterly earnings
- Cache responses locally to minimize API calls

### Signal Scoring Weights
```python
SIGNAL_WEIGHTS = {
    'budget_hiring': 25,           # Search/AI roles in career postings
    'budget_growth': 15,           # Revenue YoY >10%
    'budget_margin': 10,           # Margin zone = Green (>20%)
    'pain_vendor_removed': 30,     # Search provider disappeared
    'pain_competitor': 15,         # Using competitor search
    'pain_quote': 20,              # Exec quote on digital transformation
    'timing_exec_change': 25,      # New CTO/CDO <12mo
    'timing_migration': 20,        # Platform migration signal
    'timing_competitor_algolia': 20, # Competitor using Algolia
    'negative_layoffs': -25,       # Announced workforce reduction
    'negative_added_competitor': -40, # Switched to competitor search
}
```

### Enrichment Status Tracking
`enrichment_status` table tracks:
- `company_id`, `enrichment_level` (basic/partial/full)
- `financials_status` (✅/pending/failed)
- `quotes_status` (✅/pending/failed)
- `hiring_status` (✅/pending/failed)
- `last_enriched` timestamp
- Error logs for retry logic

---

## Case Studies (16 Verified, Feb 25, 2026)

### Database
**Table:** `verified_case_studies` (16 records)

### Verified Algolia Case Studies
| Company | Vertical | URL | Status |
|---------|----------|-----|--------|
| Algolia | SaaS | https://www.algolia.com/customers/ | ✅ Index page |
| Tokopedia | eCommerce | https://www.algolia.com/customers/tokopedia/ | ✅ Indonesian marketplace |
| Vestiaire Collective | Fashion | https://www.algolia.com/customers/vestiaire-collective/ | ✅ Peer-to-peer fashion |
| Medium | Content | https://www.algolia.com/customers/medium/ | ✅ Publishing platform |
| Twitch | Media | https://www.algolia.com/customers/twitch/ | ✅ Livestreaming |
| GitLab | DevOps | https://www.algolia.com/customers/gitlab/ | ✅ Open source DevOps |
| Stripe | Payments | https://www.algolia.com/customers/stripe/ | ✅ Payment processing |
| Typeform | SaaS | https://www.algolia.com/customers/typeform/ | ✅ Form builder |
| Vimeo | Video | https://www.algolia.com/customers/vimeo/ | ✅ Video platform |
| Shopify | eCommerce | https://www.algolia.com/customers/shopify/ | ✅ Commerce platform |
| Notion | Productivity | https://www.algolia.com/customers/notion/ | ✅ Workspace tool |
| Figma | Design | https://www.algolia.com/customers/figma/ | ✅ Design collaboration |
| + 4 additional | Various | [Verified] | ✅ |

### Vertical Breakdown
- **Retail/eCommerce:** 8 (Tokopedia, Vestiaire Collective, Shopify, + 5 more)
- **B2B SaaS:** 4 (GitLab, Stripe, Typeform, Notion)
- **Media/Publishing:** 2 (Medium, Twitch)
- **Documentation/Support:** 2 (Algolia docs, Vimeo support)

### Case Study Matching Logic
When enriching a displacement target:
1. **Vertical match** → Find case studies in same industry
2. **Tech stack match** → If target uses Shopify, highlight Shopify case study
3. **Size match** → Traffic/revenue comparison to case study company
4. **Quote relevance** → Match exec quote themes to case study themes

### seed_verified_case_studies.py
Runs validation on all 16 case studies:
- HTTP HEAD request to verify no 404s
- Extracts key metrics (if available in HTML meta)
- Updates `verified_case_studies` table with `last_verified` timestamp
- Flags broken links for manual review
- Caches results for 30 days

---

## Scripts Added (Feb 25, 2026)

### migrate_intelligence_schema.py
Creates intelligence-layer tables:
```sql
CREATE TABLE company_financials (
  id, company_id, fiscal_year, revenue, net_income,
  operating_margin, margin_zone, data_source, last_updated
);

CREATE TABLE executive_quotes (
  id, company_id, speaker, title, quote, context,
  event_type (earnings_call/10k/investor_day), date, transcript_url
);

CREATE TABLE hiring_signals (
  id, company_id, job_title, category (search/ai/platform/data),
  date_posted, careers_url
);

CREATE TABLE strategic_triggers (
  id, company_id, trigger_type (migration/expansion/layoff/news),
  description, date, source_url
);
```

### enrich_company.py (Detailed)
**Entry:** Company domain or ticker
**Output:** Populates financial, quotes, hiring, strategic tables
**Workflow:**
1. Resolve ticker (if not provided) via WebSearch
2. Fetch 3-year financials from Yahoo Finance API
3. Search earnings call transcripts (latest 2 years)
4. Scrape careers page for hiring signals
5. Calculate signal scores
6. Update `enrichment_status` with completion status

**Error handling:**
- Yahoo Finance API timeout → Fallback to WebSearch
- Careers page blocked → Mark as 'pending_manual'
- Transcript not found → Partial enrichment (continue)

### seed_verified_case_studies.py (Detailed)
**Input:** Hardcoded array of 16 Algolia case study URLs
**Process:**
1. For each URL, send HTTP HEAD request
2. If 200 OK, extract title + meta description
3. Store `last_verified` timestamp
4. If 404/timeout, flag for manual review
5. Generate summary report

**Output:**
- Updated `verified_case_studies` table
- CSV report: `case_studies_verification_report.csv`

---

## v2.1 Architecture — On-Demand Enrichment (Feb 25, 2026)

### Problem Solved
Pre-populating intelligence data wasted API credits on companies that may never be viewed. v2.1 implements on-demand enrichment: data is fetched ONLY when a user clicks "View →" on a specific company.

### FastAPI Backend

**Location:** `api/` directory

**Files:**
| File | Purpose |
|------|---------|
| `api/main.py` | FastAPI application with endpoints |
| `api/enrichment.py` | BuiltWith/SimilarWeb/Yahoo Finance integration |
| `api/config.py` | CORS + API keys configuration |
| `api/__init__.py` | Package initialization |

**Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/company/{domain}` | GET | Get company data (cached or fresh) |
| `/api/enrich/{domain}` | POST | Trigger enrichment (with ?force=true option) |
| `/api/targets` | GET | List paginated targets with filtering |
| `/api/stats` | GET | Summary statistics |

**Run locally:**
```bash
cd PartnerForge
pip3 install -r requirements.txt
uvicorn api.main:app --port 8000
```

**Cache TTL:** 7 days — data is only re-fetched when stale OR when user clicks "Refresh Data" button

### Dashboard v2.1 Features

**Sorting Fix:** Dashboard now sorted by `icp_score DESC` (Mercedes-Benz 95 pts first)

**Detail View Enhancements:**
- **"Refresh Data" button** — Triggers `/api/enrich/{domain}?force=true`
- **Enrichment status badge** — Shows "Data fresh" / "Updated Xd ago" / "Not enriched"
- **Loading spinner** — Displays during API calls with progress text
- **Live data updates** — Tech stack, financials, traffic updated in real-time

**API Client:**
`api-client.js` provides JavaScript functions for frontend integration:
- `fetchCompanyFromAPI(domain)` - Get cached company data
- `enrichCompanyFromAPI(domain, force)` - Trigger enrichment
- `showLoading(message)` / `hideLoading()` - Spinner control
- `updateEnrichmentStatus(lastEnriched, level)` - Badge updates

### Dependencies

**requirements.txt:**
```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
requests>=2.31.0
python-dotenv>=1.0.0
yfinance>=0.2.36
```

### CORS Configuration

Allowed origins in `api/config.py`:
- `http://localhost:3000`, `http://localhost:8000`
- `https://partnerforge.vercel.app`
- Additional via `CORS_EXTRA_ORIGINS` env var

### Backend Deployment Options

The FastAPI backend needs separate hosting from Vercel (which only serves static HTML):

| Option | Pros | Cons |
|--------|------|------|
| **Railway** | Easy deploy, free tier, auto-scaling | Limited free hours |
| **Render** | Free tier, auto-deploy from GitHub | Cold starts on free tier |
| **Fly.io** | Global edge, low latency | More complex setup |
| **Vercel Serverless** | Same platform as frontend | Requires function conversion |

---

## /partnerforge Skill (Created Feb 25, 2026)

**Location:** `~/.claude/skills/partnerforge/SKILL.md`

**Commands:**
| Command | Description |
|---------|-------------|
| `/partnerforge enrich <domain>` | Enrich single company |
| `/partnerforge batch <N>` | Enrich top N hot leads |
| `/partnerforge intel <domain>` | Deep competitive intelligence |
| `/partnerforge find <partner>` | Find displacement targets |
| `/partnerforge report <domain>` | Generate PDF report |
| `/partnerforge status` | Show enrichment stats |
| `/partnerforge dashboard` | Regenerate dashboard HTML |

---

## Next Steps (Updated Feb 25, 2026)
1. ✅ Build enhanced dashboard with detail view + glassmorphism (DONE)
2. ✅ Add Excel-style column filtering (DONE)
3. ✅ Create `/partnerforge` skill for on-demand analysis (DONE)
4. ✅ Build FastAPI backend for on-demand enrichment (DONE)
5. **NEXT: Deploy FastAPI backend** (Railway/Render/Fly.io)
6. Run batch enrichment on top 100 targets
7. Add Shopify pipeline (needs BuiltWith credits)
8. Implement predictive scoring (ML model for optimal timing)
9. Add Salesforce integration (direct lead sync)

---

## Enterprise Architecture v3.0 (Feb 25, 2026)

### Architecture Documents (17 total)

| Document | Purpose | Lines |
|----------|---------|-------|
| `docs/ARCHITECTURE_INDEX.md` | Navigation hub | ~100 |
| `docs/ENTERPRISE-ARCHITECTURE.md` | Master architecture | ~1,400 |
| `docs/INTELLIGENCE_MODULES_SPEC.md` | 15 modules with JSON schemas | ~600 |
| `docs/DATABASE_SCHEMA_V2.md` | 30+ PostgreSQL tables | ~700 |
| `docs/DATA-PIPELINE-FLOWS.md` | Module I/O specs | ~700 |
| `docs/PARALLEL_EXECUTION_ARCHITECTURE.md` | 4-wave execution | ~500 |
| `docs/ORCHESTRATOR_DESIGN.md` | Hybrid orchestrator | ~400 |
| `docs/SOURCE_CITATION_MANDATE.md` | P0 source requirements | ~400 |
| `docs/DESIGN_PRINCIPLES.md` | 7 mandatory principles | ~200 |
| `docs/UI-UX-LIBRARY-RESEARCH.md` | 50+ UI libraries evaluated | ~300 |
| `docs/PREMIUM-UI-SPECIFICATION.md` | Championship UI spec | ~1,200 |
| `docs/ARCHITECTURE_PRESSURE_TEST.md` | Blind spots & gaps | ~500 |
| `docs/CHANGE_DETECTION_ARCHITECTURE.md` | **NEW** Versioning & notifications | ~700 |
| `docs/MULTI_TENANCY_RBAC.md` | **NEW** Access control | ~400 |
| `docs/API_COST_TRACKING.md` | **NEW** Budget management | ~500 |
| `docs/OBSERVABILITY_METRICS.md` | **NEW** Metrics & alerting | ~600 |

### P1 Enterprise Capabilities (NEW)

| Capability | Architecture Doc | Key Features |
|------------|------------------|--------------|
| **Change Detection** | CHANGE_DETECTION_ARCHITECTURE.md | Snapshot versioning, change significance, opportunity signals, Slack notifications |
| **Multi-Tenancy/RBAC** | MULTI_TENANCY_RBAC.md | User roles, territories, account ownership, data redaction |
| **API Cost Tracking** | API_COST_TRACKING.md | Per-call costs, budget limits, alerts at 80%, cost estimation |
| **Observability** | OBSERVABILITY_METRICS.md | Prometheus metrics, structured logs, Grafana dashboards, alerting |

### Pipeline Implementation (Started)

```
pipeline/
├── __init__.py                    ✅ Created
├── utils/
│   ├── __init__.py                ✅ Created
│   ├── retry.py                   ✅ Created (exponential backoff)
│   ├── circuit_breaker.py         ✅ Created (3 states)
│   └── rate_limiter.py            ✅ Created (token bucket)
├── adapters/
│   ├── __init__.py                ✅ Created
│   ├── base.py                    ⚪ Pending
│   ├── builtwith.py               ⚪ Pending
│   ├── similarweb.py              ⚪ Pending
│   └── yahoo_finance.py           ⚪ Pending
├── models/
│   ├── __init__.py                ✅ Created
│   └── source.py                  ⚪ Pending (SourceCitation)
├── modules/
│   └── __init__.py                ✅ Created
└── validators/
    └── __init__.py                ✅ Created
```

### Key Design Decisions (v3.0)

| Decision | Rationale |
|----------|-----------|
| Snapshot-based versioning | Never overwrite data - append snapshots, detect changes |
| Significance-based notifications | CRITICAL → immediate, LOW → weekly digest |
| Role-based data redaction | SDR can't see financials, only names (no LinkedIn) |
| Per-call cost tracking | Budget alerts before $5K surprise bills |
| Prometheus + Grafana | Industry standard observability stack |
| Circuit breaker per adapter | Prevent cascade failures when APIs go down |
| Token bucket rate limiting | Respect API rate limits, queue requests |
