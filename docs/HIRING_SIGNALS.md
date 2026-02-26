# Hiring Signals Enrichment

## Overview

PartnerForge now includes **hiring signal enrichment** - the ability to analyze what job roles a company is actively hiring for and match them against target personas relevant to Algolia sales.

## Architecture

```
Company Domain (e.g., costco.com)
    ↓
JobSpy (Python) → Indeed + LinkedIn
    ↓
Job Postings: ["Director of E-Commerce", "Search Engineer", ...]
    ↓
Match against target_job_profiles table
    ↓
Hiring Signal Score: 0-100
```

## Components

### 1. Backend Service
**Location:** `backend/hiring/hiring_service.py`

```bash
# CLI Usage
python hiring_service.py --company "Costco" --location "USA"

# API Server
python hiring_service.py --serve --port 8001
# GET /hiring?company=Costco&location=USA
```

### 2. Database Tables

#### `target_job_profiles`
Stores job titles/roles relevant for Algolia sales prospecting.

| Column | Type | Description |
|--------|------|-------------|
| title | VARCHAR | Original job title |
| normalized_title | VARCHAR | Lowercase, trimmed |
| category | VARCHAR | c-suite, product, engineering, e-commerce, merchandising, search, digital-cx, data |
| tier | INTEGER | 1=Decision Maker, 2=Influencer, 3=Implementer |
| relevance_score | INTEGER | 0-100 |
| is_from_customer_evidence | BOOLEAN | From Algolia customer quotes |
| evidence_count | INTEGER | How many quotes from this role |

#### `displacement_targets` (new columns)
| Column | Type | Description |
|--------|------|-------------|
| hiring_signal_score | INTEGER | 0-100 composite score |
| hiring_signal_strength | VARCHAR | strong, moderate, weak, none |
| hiring_tier_breakdown | JSONB | {tier_1: N, tier_2: N, tier_3: N} |
| hiring_category_breakdown | JSONB | {search: N, e-commerce: N, ...} |
| hiring_top_jobs | JSONB | Array of top 20 relevant jobs |
| hiring_fetched_at | TIMESTAMPTZ | Last enrichment time |

## Scoring Algorithm

### Tier Scoring
| Tier | Points Each | Max |
|------|-------------|-----|
| Tier 1 (Decision Makers) | 30 | 60 |
| Tier 2 (Influencers) | 15 | 45 |
| Tier 3 (Implementers) | 5 | 20 |

### Category Bonuses
| Category | Bonus |
|----------|-------|
| Search-related roles | +25 |
| E-commerce roles | +15 |
| Merchandising roles | +10 |

### Signal Strength
| Score | Strength |
|-------|----------|
| 70-100 | **STRONG** 🔥 |
| 40-69 | **MODERATE** ⚡ |
| 15-39 | **WEAK** |
| 0-14 | **NONE** |

## Target Personas

### Tier 1 - Decision Makers
Patterns: VP, Vice President, Chief, CTO, CIO, CDO, CMO, COO, CEO, Head of, Director, Principal, SVP, Co-Founder

### Tier 2 - Influencers
Patterns: Senior Manager, Manager, Lead, Architect, Senior Product, Product Manager, Product Owner

### Tier 3 - Implementers
Default tier for relevant roles not matching Tier 1 or 2.

### Relevant Categories
| Category | Keywords |
|----------|----------|
| **search** | search, discovery, relevance, findability, browse, catalog, autocomplete, typeahead, query |
| **e-commerce** | ecommerce, e-commerce, commerce, merchandis, online store, digital commerce |
| **product** | product manager, product owner, product lead, product director |
| **engineering** | engineer, developer, architect, devops, software, sre, platform |
| **data** | data scientist, data engineer, analytics, ai, ml, machine learning, nlp, personalization |
| **digital-cx** | customer experience, cx, ux, user experience, digital experience, conversion |
| **merchandising** | merchandis, category manager, assortment, pricing, site merchandis |

## Data Sources

### JobSpy (Free, Open Source)
- **Sites**: Indeed, LinkedIn, Glassdoor, ZipRecruiter
- **Cost**: $0
- **Rate Limits**: Reasonable for batch enrichment
- **Installation**: `pip install python-jobspy`

### Alternative: Fantastic.jobs (Paid)
- **Sites**: 175K+ career sites, 42 ATS platforms
- **Cost**: $1-12 per 1,000 jobs
- **Features**: AI-enriched, LinkedIn company matching
- **When to use**: Higher accuracy, direct ATS access needed

## Usage Examples

### CLI Test
```bash
cd backend/hiring
python hiring_service.py --company "Target" --location "USA"
```

### API Call
```bash
curl "http://localhost:8001/hiring?company=Costco&location=USA"
```

### Response
```json
{
  "company_name": "Costco",
  "signal_score": 95,
  "signal_strength": "strong",
  "total_jobs_found": 31,
  "relevant_jobs": 21,
  "tier_breakdown": {
    "tier_1": 5,
    "tier_2": 1,
    "tier_3": 15
  },
  "category_breakdown": {
    "engineering": 19,
    "data": 7
  },
  "top_jobs": [
    {"title": "Director - Enterprise Architecture", "tier": 1, "categories": ["engineering"]},
    {"title": "Principal Engineer - AI", "tier": 1, "categories": ["engineering", "data"]}
  ]
}
```

## Sales Insights

### Strong Signal (70+)
> "Company is actively building tech/digital teams. Decision makers are being hired. Good timing for Algolia pitch."

### Search-Related Hiring
> "Company is hiring Search Engineers or Discovery roles. They're investing in search - perfect Algolia fit."

### AI/ML Hiring
> "Company is scaling AI capabilities. Position Algolia AI Search as the solution."

### E-Commerce Hiring
> "Company is growing their e-commerce team. Algolia Commerce use cases are relevant."

## Migration

Run this SQL in Supabase:
```
supabase/RUN_THIS_MIGRATION.sql
```

Or manually at: https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/sql/new
