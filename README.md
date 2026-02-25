# PartnerForge

Partner Intelligence Platform for Algolia Sales. Finds companies using partner technologies (Adobe AEM, Shopify, etc.) who are NOT using Algolia — displacement opportunities for co-sell motions.

## Core Logic

```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

## Quick Start

```bash
# View the executive dashboard
open executive-dashboard.html

# Run ICP scoring on targets
python scripts/icp_scoring.py

# Analyze a company's competitors
python scripts/competitive_intelligence.py --domain costco.com --save
```

## Data Sources

| Source | Purpose |
|--------|---------|
| **BuiltWith** | Technology detection (AEM, Shopify, etc.) |
| **SimilarWeb** | Traffic metrics + competitor discovery |
| **Customer Evidence** | Existing Algolia customers (to exclude) |

## Database

SQLite database at `data/partnerforge.db` caches all API responses to save credits.

| Table | Records | Purpose |
|-------|---------|---------|
| `displacement_targets` | 2,687 | AEM users NOT on Algolia |
| `companies` | 400 | Existing Algolia customers |
| `competitive_intel` | 25 | Competitor tech stack analysis |
| `case_studies` | 161 | For matching to targets |

## ICP Scoring (0-100 points)

| Component | Weight | Logic |
|-----------|--------|-------|
| Vertical/Tier | 40 | Commerce=40, Content=25, Support=15 |
| Traffic | 30 | 50M+=30, 10M+=25, 1M+=15 |
| Tech Spend | 20 | $100K+=20, $50K+=15 |
| Partner Tech | 10 | Adobe=10, Shopify=7 |

## Dashboard

`executive-dashboard.html` provides a tabbed interface:

- **All Targets** — Full list sorted by ICP Tier → Score
- **🔥 Hot** — Score 80+ (immediate outreach)
- **🌡️ Warm** — Score 60-79 (nurture ready)
- **❄️ Cool** — Score 40-59 (qualify further)
- **Tier 1/2/3** — Filter by Commerce/Content/Support
- **By Vertical** — Expandable industry groups
- **Competitive Intel** — SimilarWeb → BuiltWith analysis

## Scripts

| Script | Purpose |
|--------|---------|
| `icp_scoring.py` | Apply ICP scoring to all targets |
| `competitive_intelligence.py` | Analyze competitors via SimilarWeb → BuiltWith |
| `import_customer_evidence.py` | Import Excel → SQLite |
| `fetch_partner_targets.py` | Fetch from BuiltWith Lists API |

## Project Structure

```
PartnerForge/
├── README.md
├── MEMORY.md                 # Project documentation
├── PRD.md                    # Product requirements
├── executive-dashboard.html  # Main dashboard (tabbed)
├── data/
│   └── partnerforge.db       # SQLite database
├── output/
│   └── *.csv                 # Exported reports
├── scripts/
│   ├── icp_scoring.py
│   ├── competitive_intelligence.py
│   ├── import_customer_evidence.py
│   └── fetch_partner_targets.py
└── supabase/
    └── migrations/           # For future Supabase migration
```

## Key Findings (2026-02-25)

- **2,687 AEM displacement targets**
- **5 hot leads** (score 80+)
- **149 warm leads** (score 60-79)
- **Est. pipeline**: $63M
- **Competitive intel**: Sam's Club, Macy's, Kmart, Sears use Elasticsearch (not Algolia)

## License

Internal Algolia use only.
