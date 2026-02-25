# PartnerForge - Project Memory

## Overview
Partner Intelligence Platform for Algolia Sales. Finds companies using partner technologies (Adobe AEM, Shopify, etc.) who are NOT using Algolia for search - displacement opportunities.

## Core Logic
```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

## Data Sources
| Source | Purpose | API |
|--------|---------|-----|
| BuiltWith | Technology detection | Lists API, Domain Lookup |
| SimilarWeb | Traffic + competitors | 14 endpoints |
| Customer Evidence Excel | Algolia customers to exclude | Local import |

## Database Schema (SQLite)
**Location:** `data/partnerforge.db` (1.6MB)

### Tables
| Table | Records | Purpose |
|-------|---------|---------|
| `companies` | 400 | Existing Algolia customers |
| `displacement_targets` | 2,687 | AEM users NOT on Algolia |
| `case_studies` | 161 | For matching to targets |
| `customer_quotes` | 379 | Sales enablement |
| `competitive_intel` | 25 | SimilarWeb → BuiltWith analysis |
| `technologies` | 60+ | Partner/competitor tech definitions |

### Key Columns (displacement_targets)
- `domain`, `company_name`, `vertical`, `country`
- `partner_tech` - Which partner tech they use (Adobe AEM, Shopify, etc.)
- `icp_tier` - 1=Commerce, 2=Content, 3=Support
- `lead_score` - 0-100 based on ICP fit
- `sw_monthly_visits` - Traffic from SimilarWeb
- `tech_spend` - Estimated tech spend from BuiltWith

## ICP Scoring Model (0-100 points)

### Component Weights
| Component | Max Points | Logic |
|-----------|------------|-------|
| Vertical/Tier | 40 | Commerce=40, Content=25, Support=15 |
| Traffic | 30 | 50M+=30, 10M+=25, 5M+=20, 1M+=15 |
| Tech Spend | 20 | $100K+=20, $50K+=15, $25K+=10 |
| Partner Tech | 10 | Adobe=10, Shopify=7, Other=3 |

### ICP Tiers (from Algolia ICP PDFs)
| Tier | Name | Primary KPI | Examples |
|------|------|-------------|----------|
| 1 | Commerce | Conversion rate | Retail, Fashion, E-commerce |
| 2 | Content | Time-on-site | Media, Publishing |
| 3 | Support | Ticket deflection | SaaS, Knowledge portals |

## Scripts

### `import_customer_evidence.py`
Imports Customer Evidence Excel → SQLite
```bash
python scripts/import_customer_evidence.py
```

### `icp_scoring.py`
Applies ICP scoring to all displacement_targets
```bash
python scripts/icp_scoring.py
```

### `competitive_intelligence.py`
SimilarWeb (competitors) → BuiltWith (tech) pipeline
```bash
python scripts/competitive_intelligence.py --domain costco.com --save
```

### `fetch_partner_targets.py`
Fetch targets from BuiltWith Lists API (requires credits)
```bash
python scripts/fetch_partner_targets.py --partner shopify --pages 3
```

## Dashboard
**Location:** `executive-dashboard.html`

### Tabs
- All Targets (sorted by ICP Tier → Score)
- 🔥 Hot (80+) - Immediate outreach
- 🌡️ Warm (60-79) - Nurture ready
- ❄️ Cool (40-59) - Qualify further
- Tier 1/2/3 filters
- By Vertical (expandable groups)
- Competitive Intel

## API Keys (Stored in Scripts)
- **BuiltWith:** `8fd992ef-88d0-4554-a20b-364e97b2d302`
- **SimilarWeb:** `483b77d48d254810b4caf3d376b28ce7`

## Key Findings (2026-02-25)

### AEM Displacement Analysis
- **2,687 targets** (AEM users not on Algolia)
- **5 hot leads** (score 80+)
- **149 warm leads** (score 60-79)
- **Estimated pipeline:** $63M

### Top Targets
| Company | Score | Traffic | Search Provider |
|---------|-------|---------|-----------------|
| HUAWEI | 90 | 75.7M | Unknown |
| NAB | 90 | 11.5M | Unknown |
| Mercedes-Benz | 85 | 6.6M | Unknown |
| CVS Caremark | 80 | 4.5M | Unknown |

### Competitive Intel (Costco/Target landscape)
- **Algolia users:** Walmart, eBay, Kohl's, Etsy, Mercari
- **Displacement targets:** Sam's Club, Macy's, Kmart, Sears (all on Elasticsearch)

## Data Freshness Issues
Some targets have since adopted Algolia (TD Bank, Kia, Morgan Stanley).
Run periodic cleanup:
```python
# In competitive_intelligence.py - checks live BuiltWith data
```

## Cleanup Log (2026-02-25)
Removed 13 companies that now use Algolia:
- td.com, kia.com, morganstanley.com, avalara.com, volvo.com
- changiairport.com, constellation.com, flinders.edu.au
- bostonpizza.com, radley.co.uk, nissan.nl, softwareag.com, boothehvac.com

## Next Steps
1. **Skill Creation:** `/partnerforge` for on-demand analysis
2. **Shopify Pipeline:** Need BuiltWith Lists API credits
3. **Supabase Migration:** For web UI and team access
4. **Weekly Refresh:** Cron job to re-verify targets

## File Structure
```
PartnerForge/
├── PRD.md                    # Product requirements
├── MEMORY.md                 # This file
├── dashboard.html            # Simple dashboard
├── executive-dashboard.html  # Full executive dashboard (tabbed)
├── data/
│   └── partnerforge.db       # SQLite database (1.6MB)
├── output/
│   ├── aem_high_value_targets_20260225.csv
│   ├── aem_displacement_targets_20260225.csv
│   ├── aem_icp_scored_targets_20260225.csv
│   ├── aem_top_100_leads_20260225.csv
│   └── DISPLACEMENT_REPORT_20260225.md
├── scripts/
│   ├── import_customer_evidence.py
│   ├── icp_scoring.py
│   ├── fetch_partner_targets.py
│   └── competitive_intelligence.py
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql
        └── 002_seed_technologies.sql
```
