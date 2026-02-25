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

## Scripts

| Script | Purpose |
|--------|---------|
| `generate_dashboard.py` | Generate interactive dashboard from SQLite |
| `enrich_company.py` | Enrich company with financials, signals |
| `migrate_intelligence_schema.py` | Create intelligence tables |
| `seed_verified_case_studies.py` | Verify and seed Algolia case study URLs |
| `icp_scoring.py` | Apply ICP scoring to targets |
| `competitive_intelligence.py` | SimilarWeb → BuiltWith pipeline |
| `import_customer_evidence.py` | Excel → SQLite import |
| `fetch_partner_targets.py` | BuiltWith Lists API fetch |

## Dashboard Features (v2.0)

### List View
- Search bar with live filtering
- Sortable columns (click headers)
- Excel-style column filters (checkboxes per value)
- CSV export button
- Score breakdown tooltip on hover
- Visual score progress bars

### Detail View (click on company)
- Priority status badge (HOT/WARM/COOL)
- Signal checkmarks (Budget ✅ Pain ✅ Timing ✅)
- Trigger events (above the fold)
- Competitive intelligence (above the fold)
- Executive quote (key one visible immediately)
- Tabbed sections: Financials, All Quotes, Hiring, Tech Stack

### UX Requirements
- Glassmorphism for key signal cards
- Every data point has clickable citation
- 3-year financial charts with insights
- Case study links verified (no 404s)
- Mobile responsive

## Deployment
- **GitHub:** https://github.com/arijitchowdhury80/partnerforge
- **Vercel:** https://partnerforge.vercel.app
- Auto-deploys on git push

## API Keys (in scripts)
- **BuiltWith:** `8fd992ef-88d0-4554-a20b-364e97b2d302`
- **SimilarWeb:** `483b77d48d254810b4caf3d376b28ce7`

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

## Next Steps
1. Build enhanced dashboard with detail view + glassmorphism
2. Add Excel-style column filtering
3. Run batch enrichment on top 50 targets
4. Create `/partnerforge` skill for on-demand analysis
5. Add Shopify pipeline (needs BuiltWith credits)
