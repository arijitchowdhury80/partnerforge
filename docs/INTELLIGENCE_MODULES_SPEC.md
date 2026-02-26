# PartnerForge Intelligence Modules Specification

**Version:** 1.0
**Date:** 2026-02-25
**Author:** Thread 1 - Backend Architecture
**Status:** Reference Specification for Enterprise Build

---

## Executive Summary

This document defines the complete specification for PartnerForge's 15 Intelligence Modules, derived from analysis of the Algolia Search Audit skill and its production outputs (Sally Beauty, Tapestry, Costco, Uncommon Goods, Oriental Trading). Each module is designed to collect, enrich, and deliver specific account intelligence data for ABM sales motions.

---

## Module Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA COLLECTION LAYER                            │
├────────────┬────────────┬────────────┬────────────┬────────────────────┤
│ BuiltWith  │ SimilarWeb │ Yahoo      │ SEC EDGAR  │ LinkedIn/          │
│ MCP        │ MCP        │ Finance    │ (10-K,10-Q)│ WebSearch          │
└────────────┴────────────┴────────────┴────────────┴────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      INTELLIGENCE MODULES (15)                          │
├─────────────────────────────────────────────────────────────────────────┤
│ Wave 1 (Parallel):                                                      │
│   ├── M01: Company Context                                              │
│   ├── M02: Technology Stack                                             │
│   ├── M03: Traffic Analysis                                             │
│   └── M04: Financial Profile                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Wave 2 (Depends on Wave 1):                                             │
│   ├── M05: Competitor Intelligence                                      │
│   ├── M06: Hiring Signals                                               │
│   └── M07: Strategic Context                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Wave 3 (Depends on Wave 2):                                             │
│   ├── M08: Investor Intelligence                                        │
│   ├── M09: Executive Intelligence                                       │
│   ├── M10: Buying Committee                                             │
│   └── M11: Displacement Analysis                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Wave 4 (Depends on Wave 3):                                             │
│   ├── M12: Case Study Matching                                          │
│   ├── M13: ICP-Priority Mapping                                         │
│   ├── M14: Signal Scoring                                               │
│   └── M15: Strategic Signal Brief                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DELIVERY LAYER                                  │
├────────────┬────────────┬────────────┬────────────┬────────────────────┤
│ Dashboard  │ API        │ Reports    │ Alerts     │ CRM Export         │
│ UI         │ Endpoints  │ (PDF/MD)   │ (Slack)    │ (Salesforce)       │
└────────────┴────────────┴────────────┴────────────┴────────────────────┘
```

---

## Module Specifications

### M01: Company Context

**Purpose:** Establish baseline company information for all downstream analysis.

**Data Sources:**
- WebSearch (company website, Wikipedia, Crunchbase)
- BuiltWith domain lookup
- SimilarWeb company overview

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "company_name": "Sally Beauty Holdings, Inc.",
  "ticker": "SBH",
  "exchange": "NYSE",
  "is_public": true,
  "headquarters": {
    "city": "Denton",
    "state": "Texas",
    "country": "USA"
  },
  "industry": "Specialty Beauty Retail & Distribution",
  "vertical": "Retail",
  "sub_vertical": "Beauty & Personal Care",
  "business_model": "B2C + B2B",
  "employee_count": 27000,
  "store_count": 4000,
  "fiscal_year_end": "September 30",
  "founded_year": 1964,
  "description": "Sally Beauty Holdings is a specialty retailer and distributor of professional beauty supplies.",
  "brands": ["Sally Beauty Supply", "Beauty Systems Group", "CosmoProf"],
  "source_urls": [
    {"type": "website", "url": "https://sallybeauty.com"},
    {"type": "investor_relations", "url": "https://www.sallybeautyholdings.com/investor-relations/"}
  ],
  "last_updated": "2026-02-25T10:30:00Z"
}
```

**Database Table:** `company_context`

---

### M02: Technology Stack

**Purpose:** Detect technologies in use for partner matching and displacement opportunities.

**Data Sources:**
- BuiltWith MCP (7 endpoints): domain-lookup, relationships-api, recommendations-api, financial-api, social-api, trust-api, keywords-api
- SimilarWeb get-website-content-technologies-agg (fallback)

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "technologies": [
    {
      "name": "Salesforce Commerce Cloud",
      "category": "ecommerce",
      "tag": "SFCC",
      "is_partner_tech": true,
      "partner_tier": "Premium",
      "first_detected": "2019-03-15",
      "last_detected": "2026-02-25",
      "confidence": 0.95
    },
    {
      "name": "Einstein Search",
      "category": "search",
      "tag": "SFCC",
      "is_competitor_search": true,
      "competitor_name": "Salesforce Einstein",
      "first_detected": "2021-06-01",
      "last_detected": "2026-02-25",
      "confidence": 0.85
    }
  ],
  "search_provider": {
    "current": "Salesforce Einstein",
    "is_algolia": false,
    "displacement_priority": "HIGH"
  },
  "partner_technologies": [
    "Salesforce Commerce Cloud",
    "Salesforce Marketing Cloud",
    "IBM Sterling OMS"
  ],
  "tech_spend_estimate": 125000,
  "tech_spend_source": "BuiltWith Financial API",
  "source_urls": [
    {"type": "builtwith", "url": "https://builtwith.com/sallybeauty.com"}
  ],
  "last_updated": "2026-02-25T10:35:00Z"
}
```

**Database Table:** `technology_stack`

**Key Detection Categories:**
| Category | Technologies | Partner Priority |
|----------|--------------|------------------|
| E-commerce | Shopify Plus, Adobe Commerce, SFCC, commercetools, BigCommerce | Premium |
| CMS | Adobe AEM, Amplience, Contentful | Premium |
| Search | Algolia (existing), Elasticsearch, Coveo, Searchspring, Klevu, Constructor.io | Displacement |
| Analytics | Adobe Analytics, Google Analytics 4 | Standard |
| CRM | Salesforce, HubSpot | Standard |

---

### M03: Traffic Analysis

**Purpose:** Quantify digital footprint for ICP scoring and opportunity sizing.

**Data Sources:**
- SimilarWeb MCP (14 endpoints): traffic, engagement, sources, geography, demographics, keywords, audience-interests, similar-sites, keywords-competitors, website-rank, referrals, popular-pages, leading-folders, landing-pages

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "traffic_metrics": {
    "monthly_visits": 15200000,
    "avg_visit_duration_seconds": 245,
    "pages_per_visit": 4.2,
    "bounce_rate": 0.42,
    "mobile_share": 0.68
  },
  "traffic_trend": {
    "mom_change": 0.03,
    "yoy_change": 0.11,
    "trend_direction": "growing"
  },
  "traffic_sources": {
    "direct": 0.38,
    "organic_search": 0.32,
    "paid_search": 0.12,
    "social": 0.08,
    "referral": 0.06,
    "email": 0.04
  },
  "geography": {
    "primary_country": "US",
    "us_share": 0.85,
    "top_countries": [
      {"country": "US", "share": 0.85},
      {"country": "CA", "share": 0.08},
      {"country": "UK", "share": 0.03}
    ]
  },
  "demographics": {
    "gender_split": {"female": 0.72, "male": 0.28},
    "age_distribution": {
      "18-24": 0.18,
      "25-34": 0.28,
      "35-44": 0.24,
      "45-54": 0.16,
      "55+": 0.14
    }
  },
  "keywords": {
    "top_organic": ["sally beauty", "hair color", "hair dye", "nail supplies"],
    "top_paid": ["professional hair color", "beauty supply store", "hair bleach"]
  },
  "website_rank": {
    "global": 12500,
    "country": 4200,
    "category": 45
  },
  "source_urls": [
    {"type": "similarweb", "url": "https://www.similarweb.com/website/sallybeauty.com/"}
  ],
  "last_updated": "2026-02-25T10:40:00Z"
}
```

**Database Table:** `traffic_analysis`

---

### M04: Financial Profile

**Purpose:** 3-year financial trends, margin zone classification, and ROI modeling.

**Data Sources:**
- Yahoo Finance MCP (stock info, financials, balance sheet, cash flow)
- SEC EDGAR (10-K, 10-Q filings via WebFetch)
- WebSearch for press releases

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "ticker": "SBH",
  "fiscal_year_end": "September 30",
  "financials": {
    "revenue_3yr": [
      {"fiscal_year": "FY2022", "revenue": 3820000000, "yoy_change": null},
      {"fiscal_year": "FY2023", "revenue": 3730000000, "yoy_change": -0.024},
      {"fiscal_year": "FY2024", "revenue": 3720000000, "yoy_change": -0.003}
    ],
    "latest_revenue": 3720000000,
    "revenue_trend": "stable",
    "net_income_3yr": [
      {"fiscal_year": "FY2022", "net_income": 184600000, "margin": 0.048},
      {"fiscal_year": "FY2023", "net_income": 153400000, "margin": 0.041},
      {"fiscal_year": "FY2024", "net_income": 195900000, "margin": 0.053}
    ],
    "ebitda_margin": 0.126,
    "operating_margin": 0.094
  },
  "margin_zone": {
    "classification": "YELLOW",
    "ebitda_margin": 0.126,
    "threshold_red": 0.10,
    "threshold_green": 0.20,
    "implication": "Moderate margin pressure - efficiency gains valued"
  },
  "ecommerce": {
    "ecommerce_revenue": 446000000,
    "ecommerce_share": 0.12,
    "ecommerce_growth_yoy": 0.11,
    "addressable_search_revenue": 66900000
  },
  "stock_info": {
    "current_price": 17.05,
    "market_cap": 1800000000,
    "52_week_high": 19.50,
    "52_week_low": 12.80,
    "analyst_consensus": "HOLD"
  },
  "roi_scenarios": {
    "conservative": {"lift_pct": 0.05, "annual_impact": 3345000},
    "moderate": {"lift_pct": 0.10, "annual_impact": 6690000},
    "aggressive": {"lift_pct": 0.15, "annual_impact": 10035000}
  },
  "source_urls": [
    {"type": "yahoo_finance", "url": "https://finance.yahoo.com/quote/SBH/"},
    {"type": "sec_10k", "url": "https://www.sec.gov/Archives/edgar/data/1368458/..."},
    {"type": "press_release", "url": "https://www.businesswire.com/..."}
  ],
  "last_updated": "2026-02-25T10:45:00Z"
}
```

**Database Table:** `financial_profile`

**Margin Zone Classification:**
| Zone | EBITDA Margin | Pressure Level | Sales Implication |
|------|---------------|----------------|-------------------|
| RED | ≤10% | High | Need hard ROI proof |
| YELLOW | 10-20% | Moderate | Efficiency gains valued |
| GREEN | >20% | Healthy | Budget available |

---

### M05: Competitor Intelligence

**Purpose:** Identify competitors and their search providers for displacement positioning.

**Data Sources:**
- SimilarWeb similar-sites endpoint
- SimilarWeb keywords-competitors endpoint
- BuiltWith for competitor tech stacks

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "competitors": [
    {
      "domain": "sephora.com",
      "similarity_score": 0.78,
      "monthly_visits": 85000000,
      "search_provider": "Constructor.io",
      "uses_algolia": false,
      "tech_overlap": ["SFCC", "Adobe Analytics"],
      "competitive_angle": "Sephora uses AI-powered search from Constructor.io - Sally Beauty at disadvantage"
    },
    {
      "domain": "ulta.com",
      "similarity_score": 0.72,
      "monthly_visits": 45000000,
      "search_provider": "Unknown",
      "uses_algolia": false,
      "tech_overlap": ["SFCC"],
      "competitive_angle": "Neither competitor uses Algolia - first-mover opportunity"
    }
  ],
  "competitor_search_landscape": {
    "algolia_users": 0,
    "constructor_users": 1,
    "elasticsearch_users": 0,
    "native_search_users": 3,
    "first_mover_opportunity": true
  },
  "competitive_positioning": "No major professional beauty retailer uses Algolia today. Sally could be lighthouse customer for this vertical.",
  "source_urls": [
    {"type": "similarweb", "url": "https://www.similarweb.com/website/sallybeauty.com/competitors/"}
  ],
  "last_updated": "2026-02-25T10:50:00Z"
}
```

**Database Table:** `competitor_intelligence`

---

### M06: Hiring Signals

**Purpose:** Detect hiring patterns that indicate technology investment and decision windows.

**Data Sources:**
- LinkedIn Jobs API (via WebSearch)
- Company careers page (via WebFetch)
- Glassdoor, Indeed (via WebSearch)

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "total_open_roles": 4100,
  "hiring_signals": {
    "tier_1_strong": [
      {
        "role": "VP, Ecommerce",
        "status": "Active Hiring",
        "location": "Denton, TX",
        "signal_strength": "STRONG",
        "implication": "Leadership vacancy creates decision window",
        "source_url": "https://www.linkedin.com/jobs/view/vp-ecommerce-at-sally-beauty-3986657147"
      },
      {
        "role": "Sr. Director, Customer Acquisition & Analytics",
        "status": "Active Hiring",
        "location": "Denton, TX",
        "signal_strength": "STRONG",
        "implication": "Investment in data-driven commerce",
        "source_url": "https://www.linkedin.com/jobs/view/sr-director-customer-acquisition-analytics..."
      }
    ],
    "tier_2_moderate": [
      {
        "role": "Data Analytics & AI Intern",
        "status": "Posted May 2025",
        "location": "Denton, TX",
        "signal_strength": "MODERATE",
        "implication": "Early-stage AI investment",
        "source_url": "https://www.linkedin.com/jobs/view/data-analytics-ai-intern..."
      }
    ],
    "tier_3_technical": [
      {
        "role": "Software Engineer - Salesforce Commerce Cloud",
        "status": "Active",
        "location": "Denton, TX",
        "signal_strength": "MODERATE",
        "implication": "Confirms SFCC as e-commerce platform",
        "source_url": "https://www.jobzmall.com/sally-beauty/job/software-engineer-sfcc"
      }
    ]
  },
  "hiring_categories": {
    "ecommerce": 5,
    "engineering": 12,
    "data_analytics": 3,
    "ai_ml": 1,
    "product": 2,
    "merchandising": 4
  },
  "ai_investment_signal": true,
  "leadership_vacancies": ["VP, Ecommerce"],
  "platform_confirmed": "Salesforce Commerce Cloud",
  "last_updated": "2026-02-25T10:55:00Z"
}
```

**Database Table:** `hiring_signals`

**Signal Tiers:**
| Tier | Role Level | Signal Strength | Decision Impact |
|------|------------|-----------------|-----------------|
| 1 | VP/Director | STRONG | New leadership = new decisions |
| 2 | Manager/Sr. IC | MODERATE | Technology investment signal |
| 3 | Engineer/Developer | MODERATE | Platform confirmation |

---

### M07: Strategic Context

**Purpose:** Capture strategic initiatives, news, and trigger events for timing alignment.

**Data Sources:**
- WebSearch (news, press releases)
- Company investor relations page
- Industry publications

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "strategic_initiatives": [
    {
      "name": "Sally Ignited",
      "type": "Digital Transformation",
      "description": "AI, technology, seamless customer journey transformation",
      "timeline": "FY2025-FY2027",
      "algolia_connection": "NeuralSearch aligns with AI ambitions",
      "source_url": "https://infotechlead.com/cio/sally-beauty-accelerates-ai..."
    },
    {
      "name": "Fuel for Growth",
      "type": "Cost Optimization",
      "description": "$120M cumulative cost savings by FY2026",
      "timeline": "FY2025-FY2026",
      "algolia_connection": "Search optimization is high-ROI, low-capex",
      "source_url": "https://seekingalpha.com/news/4522017..."
    }
  ],
  "trigger_events": [
    {
      "event": "Sally App Upgrade",
      "timing": "Q1-Q4 FY2026",
      "relevance": "HIGH",
      "quote": "More efficient search engine for easier product discovery",
      "source_url": "https://www.fool.com/earnings/call-transcripts/2026/02/09/..."
    },
    {
      "event": "BSG Platform Update",
      "timing": "Spring 2026",
      "relevance": "HIGH",
      "quote": "Enhanced capabilities around AI and personalization",
      "source_url": "https://www.cosmeticsdesign.com/Article/2026/02/11/..."
    }
  ],
  "caution_signals": [
    {
      "event": "HQ Layoffs",
      "type": "Negative",
      "description": "Creative marketing department cut",
      "implication": "Budget scrutiny - need strong ROI case",
      "source_url": "https://dentonrc.com/business/sally-beauty-preparing..."
    }
  ],
  "timing_assessment": {
    "overall_timing": "EXCELLENT",
    "decision_window": "Q2-Q3 FY2026",
    "urgency_level": "HIGH",
    "reasoning": "CEO explicitly calling for search improvement + BSG platform update in Spring 2026"
  },
  "last_updated": "2026-02-25T11:00:00Z"
}
```

**Database Table:** `strategic_context`

---

### M08: Investor Intelligence

**Purpose:** Mine SEC filings and earnings calls for executive quotes and digital priorities.

**Data Sources:**
- SEC EDGAR (10-K, 10-Q MD&A sections)
- Earnings call transcripts (Motley Fool, Seeking Alpha, Globe and Mail)
- Investor presentations

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "ticker": "SBH",
  "sec_filings": {
    "latest_10k": {
      "fiscal_year": "FY2025",
      "filing_date": "2025-11-13",
      "ecommerce_mentioned": true,
      "ecommerce_share": 0.107,
      "digital_initiatives": [
        "Licensed Colorist on Demand (LCOD)",
        "Digital Marketplace Expansion"
      ],
      "risk_factors": [
        "Competitive factors in e-commerce include the look and feel of digital platforms, ease and security of the checkout process",
        "The beauty products retail and distribution industry is highly competitive"
      ],
      "source_url": "https://www.sec.gov/Archives/edgar/data/1368458/..."
    }
  },
  "earnings_calls": [
    {
      "quarter": "Q1 FY2026",
      "date": "2026-02-09",
      "transcript_url": "https://www.fool.com/earnings/call-transcripts/2026/02/09/...",
      "key_quotes": [
        {
          "speaker": "Denise Paulonis",
          "title": "President & CEO",
          "quote": "Notable enhancements include a more efficient search engine for easier product discovery.",
          "maps_to": "Algolia InstantSearch, Dynamic Faceting",
          "priority": "HIGH"
        },
        {
          "speaker": "Denise Paulonis",
          "title": "President & CEO",
          "quote": "Enhanced capabilities around education, AI, and personalization.",
          "maps_to": "Algolia NeuralSearch, Personalization",
          "priority": "HIGH"
        },
        {
          "speaker": "Marlo Cormier",
          "title": "SVP & CFO",
          "quote": "Global ecommerce sales increased 11% to $111 million.",
          "maps_to": "Enterprise scale opportunity",
          "priority": "MEDIUM"
        }
      ]
    }
  ],
  "guidance": {
    "fy2026_revenue": {"low": 3710000000, "high": 3770000000},
    "fy2026_eps": {"low": 2.00, "high": 2.10},
    "capex": 100000000,
    "free_cash_flow": 200000000
  },
  "digital_commitments": [
    {
      "initiative": "Sally App Upgrade",
      "timeline": "Rolling through FY2026",
      "explicit_search_mention": true
    },
    {
      "initiative": "BSG App & Platform Update",
      "timeline": "Spring 2026",
      "ai_personalization_mention": true
    }
  ],
  "last_updated": "2026-02-25T11:05:00Z"
}
```

**Database Table:** `investor_intelligence`

---

### M09: Executive Intelligence

**Purpose:** Build executive profiles for personalized outreach and "Speaking Their Language" mapping.

**Data Sources:**
- LinkedIn profiles
- Company management page
- Press releases, interviews
- Conference speaker bios

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "executives": [
    {
      "name": "Denise Paulonis",
      "title": "President & CEO",
      "linkedin_url": "https://www.linkedin.com/in/denisepaulonis/",
      "tenure_start": "2022-01",
      "background": "Former CFO at Sally Beauty; prior McDonald's, PepsiCo",
      "buyer_role": "Executive Sponsor",
      "priority": "HIGH",
      "speaking_language": {
        "terms_used": ["Sally Ignited", "seamless customer journey", "personalization"],
        "quote_to_product_mapping": [
          {
            "quote": "More efficient search engine for easier product discovery",
            "maps_to": "Algolia InstantSearch, Dynamic Faceting",
            "source_url": "https://www.fool.com/earnings/call-transcripts/..."
          },
          {
            "quote": "Help me make the right choice",
            "maps_to": "Algolia AI Recommendations, Query Suggestions",
            "source_url": "https://www.beautyindependent.com/..."
          }
        ]
      }
    },
    {
      "name": "Scott Lindblom",
      "title": "SVP & CIO",
      "linkedin_url": "https://www.linkedin.com/in/scott-lindblom/",
      "tenure_start": "2023-10",
      "background": "Former digital transformation leader at Bed Bath & Beyond",
      "buyer_role": "Technical Buyer",
      "priority": "HIGH",
      "is_new_to_role": true,
      "entry_approach": "Fresh perspective on technology investments, past learning curve"
    },
    {
      "name": "Chris Hansen",
      "title": "VP, Digital Product",
      "linkedin_url": "https://www.linkedin.com/in/chris-hansen-2809403/",
      "buyer_role": "Champion",
      "priority": "HIGH",
      "is_active_on_linkedin": true,
      "speaks_at_events": ["CommerceNext"],
      "entry_approach": "Most active on LinkedIn, speaks at events - ideal first conversation"
    }
  ],
  "buying_committee_summary": {
    "economic_buyer": "Natalie Lockhart (GVP, Strategy & Digital Experience)",
    "technical_buyer": "Scott Lindblom (SVP & CIO)",
    "champion": "Chris Hansen (VP, Digital Product)",
    "user_buyers": ["Bryan DeYoung", "Maryann Herskowitz"]
  },
  "recommended_entry_points": [
    "Chris Hansen - LinkedIn, CommerceNext reference",
    "Scott Lindblom - Technical deep-dive, SFCC integration",
    "Natalie Lockhart - Executive briefing, ROI case"
  ],
  "last_updated": "2026-02-25T11:10:00Z"
}
```

**Database Table:** `executive_intelligence`

---

### M10: Buying Committee

**Purpose:** Map complete buying committee with roles, priorities, and entry strategies.

**Data Sources:**
- LinkedIn (people search)
- Company management page
- ZoomInfo/Clearbit (if available)
- Historical departure tracking

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "buying_committee": {
    "executive_sponsor": {
      "name": "Denise Paulonis",
      "title": "President & CEO",
      "influence": "HIGH",
      "engagement_strategy": "Executive briefing with ROI case"
    },
    "economic_buyer": {
      "name": "Natalie Lockhart",
      "title": "GVP, Strategy, Customer Insights & Digital Experience",
      "influence": "HIGH",
      "budget_authority": true,
      "engagement_strategy": "Digital strategy alignment, ROI modeling"
    },
    "technical_buyer": {
      "name": "Scott Lindblom",
      "title": "SVP & CIO",
      "influence": "HIGH",
      "tenure_months": 16,
      "engagement_strategy": "Technical deep-dive, SFCC cartridge demo"
    },
    "champion": {
      "name": "Chris Hansen",
      "title": "VP, Digital Product",
      "influence": "HIGH",
      "is_internal_advocate": true,
      "engagement_strategy": "First conversation - builds internal case"
    },
    "user_buyers": [
      {
        "name": "Bryan DeYoung",
        "title": "SVP, Merchandising Operations",
        "influence": "MEDIUM",
        "use_case_interest": "Merchandising Studio"
      },
      {
        "name": "Maryann Herskowitz",
        "title": "GVP, Merchandising",
        "influence": "MEDIUM",
        "use_case_interest": "Category discovery"
      }
    ],
    "technical_evaluators": [
      {
        "name": "Venkata Saripella",
        "title": "Enterprise Architect",
        "role": "Technical evaluation"
      }
    ]
  },
  "committee_dynamics": {
    "total_decision_makers": 6,
    "primary_blockers": [],
    "recent_departures": ["Ellery Fisher (GVP E-Commerce → McKesson)", "Kevin Metz (VP E-Commerce)"],
    "turnover_insight": "High digital leadership turnover creates opportunity for new vendor relationships"
  },
  "engagement_sequence": [
    {"step": 1, "target": "Chris Hansen", "approach": "LinkedIn connection, CommerceNext reference"},
    {"step": 2, "target": "Scott Lindblom", "approach": "Technical POC discussion"},
    {"step": 3, "target": "Natalie Lockhart", "approach": "Executive briefing with ROI"},
    {"step": 4, "target": "Denise Paulonis", "approach": "C-level alignment if deal progresses"}
  ],
  "last_updated": "2026-02-25T11:15:00Z"
}
```

**Database Table:** `buying_committee`

---

### M11: Displacement Analysis

**Purpose:** Calculate displacement opportunity score and identify co-sell partner motions.

**Data Sources:**
- Technology Stack (M02)
- Competitor Intelligence (M05)
- Algolia customer list (exclusion)

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "displacement_opportunity": {
    "current_search_provider": "Salesforce Einstein",
    "provider_type": "Native Platform",
    "displacement_difficulty": "MEDIUM",
    "reasoning": "Native SFCC search, no third-party investment - clean replacement"
  },
  "partner_co_sell_opportunities": [
    {
      "partner": "Salesforce Commerce Cloud",
      "relationship": "Technical Partner",
      "motion": "Algolia SFCC Cartridge - plug-and-play replacement",
      "partner_contact": "Salesforce Account Team",
      "co_sell_priority": "HIGH"
    }
  ],
  "competitive_displacement": {
    "competitors_on_algolia": 0,
    "competitors_on_other_ai_search": 1,
    "first_mover_advantage": true,
    "lighthouse_opportunity": "Could be Algolia's flagship customer in professional beauty retail"
  },
  "algolia_fit_score": {
    "technical_fit": 9,
    "business_fit": 9,
    "timing_fit": 10,
    "overall": 9.3
  },
  "recommended_products": [
    "Algolia Search",
    "Algolia InstantSearch",
    "Algolia NeuralSearch",
    "Algolia Personalization",
    "Algolia AI Recommendations",
    "Algolia Analytics"
  ],
  "last_updated": "2026-02-25T11:20:00Z"
}
```

**Database Table:** `displacement_analysis`

---

### M12: Case Study Matching

**Purpose:** Match relevant Algolia case studies for social proof and ROI benchmarking.

**Data Sources:**
- Algolia Case Studies database (internal)
- Vertical/Industry matching
- Use case matching

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "matched_case_studies": [
    {
      "customer": "Lacoste",
      "vertical": "Retail - Fashion/Apparel",
      "relevance_score": 0.85,
      "results": {
        "headline": "+37% conversion rate, +150% search sales contribution",
        "mobile_impact": "+62% conversion on mobile, -88% bounce rate"
      },
      "relevance_reasoning": "Global multi-channel retailer with SKU complexity",
      "case_study_url": "https://resources.algolia.com/customer-stories/casestudy-lacoste-en",
      "use_in_pitch": "Proves multi-channel conversion uplift"
    },
    {
      "customer": "Decathlon Singapore",
      "vertical": "Retail - Sporting Goods",
      "relevance_score": 0.82,
      "results": {
        "headline": "+50% conversion rate with personalization",
        "additional": "+44% search traffic, +34% search revenue"
      },
      "relevance_reasoning": "Omnichannel retail with SKU complexity similar to beauty",
      "case_study_url": "https://resources.algolia.com/customer-stories/casestudy-decathlon-singapore",
      "use_in_pitch": "Demonstrates personalization ROI"
    },
    {
      "customer": "Gymshark",
      "vertical": "Retail - D2C Apparel",
      "relevance_score": 0.78,
      "results": {
        "headline": "+150% order rate for new users",
        "mobile_impact": "+150% mobile order rates"
      },
      "relevance_reasoning": "D2C brand targeting Gen Z - aligns with Sally's Gen Z growth strategy",
      "case_study_url": "https://www.algolia.com/customers/gymshark-recommend",
      "use_in_pitch": "Proves recommendations ROI for younger demographics"
    }
  ],
  "vertical_match_score": 0.82,
  "use_case_coverage": {
    "search": ["Lacoste", "Decathlon Singapore"],
    "personalization": ["Decathlon Singapore"],
    "recommendations": ["Gymshark"],
    "merchandising": ["Lacoste"]
  },
  "last_updated": "2026-02-25T11:25:00Z"
}
```

**Database Table:** `case_study_matches`

---

### M13: ICP-Priority Mapping

**Purpose:** Calculate ICP tier, lead score, and priority classification.

**Data Sources:**
- All previous modules (aggregation)
- ICP Tier definitions
- Signal weights

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "icp_classification": {
    "tier": 1,
    "tier_name": "Commerce",
    "tier_description": "Fashion & General Retail E-commerce",
    "confidence": 0.92
  },
  "lead_score": {
    "total": 85,
    "breakdown": {
      "vertical_fit": 40,
      "traffic_volume": 25,
      "tech_spend": 15,
      "partner_tech_bonus": 10,
      "competitor_displacement_bonus": 5
    },
    "max_possible": 105
  },
  "signal_score": {
    "total": 65,
    "active_signals": [
      {"signal": "hiring_search_roles", "weight": 25, "present": true},
      {"signal": "executive_quote_digital", "weight": 20, "present": true},
      {"signal": "platform_migration", "weight": 20, "present": true}
    ],
    "signal_types": {
      "budget": true,
      "pain": true,
      "timing": true
    }
  },
  "priority_classification": {
    "priority_score": 150,
    "status": "HOT",
    "reasoning": "All three signal types present (budget, pain, timing) + high ICP fit"
  },
  "algolia_product_mapping": [
    {
      "customer_need": "More efficient search engine for easier product discovery",
      "algolia_product": "Algolia InstantSearch + Query Suggestions",
      "source_quote": "Denise Paulonis, Q1 2026 Earnings"
    },
    {
      "customer_need": "AI and personalization capabilities",
      "algolia_product": "Algolia NeuralSearch + Personalization",
      "source_quote": "Denise Paulonis, Q1 2026 Earnings"
    },
    {
      "customer_need": "Help me make the right choice",
      "algolia_product": "Algolia AI Recommendations",
      "source_quote": "Denise Paulonis, Beauty Independent Interview"
    }
  ],
  "last_updated": "2026-02-25T11:30:00Z"
}
```

**Database Table:** `icp_priority_mapping`

---

### M14: Signal Scoring

**Purpose:** Calculate composite signal score with budget, pain, and timing signals.

**Data Sources:**
- All previous modules (signal extraction)
- Signal weights configuration

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "signal_categories": {
    "budget_signals": {
      "signals": [
        {"name": "hiring_search_roles", "weight": 25, "present": true, "evidence": "VP Ecommerce open"},
        {"name": "revenue_growing", "weight": 15, "present": false, "evidence": "Revenue flat"},
        {"name": "margin_green", "weight": 10, "present": false, "evidence": "Yellow zone"},
        {"name": "recent_funding", "weight": 20, "present": false, "evidence": "Public company"},
        {"name": "tech_investment_up", "weight": 10, "present": true, "evidence": "Sally Ignited $100M capex"}
      ],
      "total": 35,
      "has_budget_signal": true
    },
    "pain_signals": {
      "signals": [
        {"name": "search_vendor_removed", "weight": 30, "present": false},
        {"name": "using_competitor_search", "weight": 15, "present": false, "evidence": "Native SFCC"},
        {"name": "executive_quote_digital", "weight": 20, "present": true, "evidence": "CEO quote on search"},
        {"name": "risk_factor_tech", "weight": 15, "present": true, "evidence": "10-K competitive risk"}
      ],
      "total": 35,
      "has_pain_signal": true
    },
    "timing_signals": {
      "signals": [
        {"name": "new_executive", "weight": 25, "present": true, "evidence": "CIO Oct 2023"},
        {"name": "platform_migration", "weight": 20, "present": true, "evidence": "BSG update Spring 2026"},
        {"name": "competitor_uses_algolia", "weight": 20, "present": false, "evidence": "0 competitors on Algolia"},
        {"name": "ecommerce_growing", "weight": 15, "present": true, "evidence": "+20% YoY e-commerce"}
      ],
      "total": 60,
      "has_timing_signal": true
    },
    "negative_signals": {
      "signals": [
        {"name": "layoffs", "weight": -25, "present": true, "evidence": "HQ creative marketing layoffs"},
        {"name": "added_competitor_search", "weight": -40, "present": false},
        {"name": "revenue_declining", "weight": -20, "present": false},
        {"name": "margin_red", "weight": -15, "present": false}
      ],
      "total": -25
    }
  },
  "composite_score": {
    "raw_signal_score": 105,
    "adjusted_score": 80,
    "icp_score": 85,
    "priority_score": 165
  },
  "signal_quality": {
    "has_all_three_types": true,
    "strongest_category": "timing",
    "weakest_category": "budget",
    "signal_density": "HIGH"
  },
  "last_updated": "2026-02-25T11:35:00Z"
}
```

**Database Table:** `signal_scoring`

---

### M15: Strategic Signal Brief

**Purpose:** Generate executive summary for AE pre-call preparation and downstream LLM consumption.

**Data Sources:**
- All previous modules (synthesis)

**Output Schema:**
```json
{
  "domain": "sallybeauty.com",
  "sixty_second_story": "Sally Beauty Holdings (NYSE: SBH) is a $3.72B beauty retailer executing a major digital transformation called 'Sally Ignited' that explicitly prioritizes AI, search efficiency, and personalization. CEO Denise Paulonis stated on the Q1 2026 earnings call that the company is building 'a more efficient search engine for easier product discovery' — a direct Algolia use case. With e-commerce growing 20% YoY to 12% of revenue, 5 HIGH-severity search gaps, and competitor Sephora already using Constructor.io, Sally Beauty is a qualified opportunity for Algolia's full commerce suite.",
  "timing_signals": [
    {
      "signal": "Sally Beauty CEO announced Sally App upgrade with 'more efficient search engine'",
      "date": "Q1 2026",
      "source_url": "https://www.fool.com/earnings/call-transcripts/2026/02/09/..."
    },
    {
      "signal": "BSG platform update with AI and personalization planned for Spring 2026",
      "date": "Spring 2026",
      "source_url": "https://www.cosmeticsdesign.com/..."
    }
  ],
  "in_their_own_words": [
    {
      "quote": "More efficient search engine for easier product discovery",
      "speaker": "Denise Paulonis",
      "title": "President & CEO",
      "source_url": "https://www.theglobeandmail.com/..."
    },
    {
      "quote": "The customer right now says, 'I'm overwhelmed by choices. Help me make the right choice.'",
      "speaker": "Denise Paulonis",
      "title": "President & CEO",
      "source_url": "https://www.beautyindependent.com/..."
    }
  ],
  "people": [
    {"name": "Denise Paulonis", "title": "President & CEO", "priority": "HIGH"},
    {"name": "Scott Lindblom", "title": "SVP & CIO", "priority": "HIGH"},
    {"name": "Chris Hansen", "title": "VP, Digital Product", "priority": "HIGH"}
  ],
  "money": {
    "revenue": "$3.72B",
    "ecommerce_revenue": "$446M (12% of revenue)",
    "addressable_search_revenue": "$67M",
    "potential_annual_lift": "$6.7M-$10M/year"
  },
  "gaps": [
    {"area": "NLP/Semantic Search", "score": "3/10", "severity": "HIGH"},
    {"area": "Federated Search", "score": "4/10", "severity": "HIGH"},
    {"area": "Personalization", "score": "4/10", "severity": "HIGH"}
  ],
  "competitive_landscape": {
    "sephora": "Constructor.io (confirmed)",
    "ulta": "NOT Algolia",
    "first_mover_opportunity": true
  },
  "the_angle": "Sally Beauty's 'Sally Ignited' transformation explicitly calls for 'a more efficient search engine' and 'AI and personalization capabilities' — Algolia NeuralSearch is the exact solution they are describing. With Sephora already on Constructor.io and Ulta NOT on Algolia, Sally Beauty can leapfrog both competitors by becoming Algolia's lighthouse customer in professional beauty retail.",
  "sources_bibliography": [
    "https://www.businesswire.com/...",
    "https://finance.yahoo.com/...",
    "https://www.fool.com/earnings/call-transcripts/..."
  ],
  "generated_at": "2026-02-25T11:40:00Z"
}
```

**Database Table:** `strategic_signal_briefs`

---

## Data Pipeline Implementation

### Pipeline Stages

```
COLLECT → VALIDATE → TRANSFORM → ENRICH → SCORE → DELIVER
```

### Stage 1: COLLECT
- **Input:** Domain
- **Output:** Raw API responses
- **Adapters:** BuiltWith, SimilarWeb, Yahoo Finance, SEC EDGAR, LinkedIn/WebSearch
- **Error Handling:** Retry with exponential backoff (3 attempts, 1s/2s/4s delays)
- **Circuit Breaker:** Open after 5 consecutive failures, half-open after 60s

### Stage 2: VALIDATE
- **Input:** Raw API responses
- **Output:** Validated data with confidence scores
- **Validation Rules:**
  - Schema validation (required fields, types)
  - Data freshness check (reject if >30 days old)
  - Source URL verification
  - Duplicate detection

### Stage 3: TRANSFORM
- **Input:** Validated raw data
- **Output:** Normalized module schemas
- **Transformations:**
  - Field mapping (API → internal schema)
  - Currency normalization (USD)
  - Date standardization (ISO 8601)
  - Technology name normalization

### Stage 4: ENRICH
- **Input:** Normalized data
- **Output:** Cross-referenced enriched data
- **Enrichments:**
  - Technology → Partner matching
  - Competitor → Search provider detection
  - Executive → LinkedIn profile resolution
  - Ticker → Financial data linkage

### Stage 5: SCORE
- **Input:** Enriched data
- **Output:** Scored and classified leads
- **Scoring:**
  - ICP tier classification
  - Lead score calculation (0-100)
  - Signal score calculation
  - Priority classification (hot/warm/cool/cold)

### Stage 6: DELIVER
- **Input:** Scored leads
- **Output:** Deliverables
- **Formats:**
  - Dashboard JSON
  - PDF/Markdown reports
  - CRM export (Salesforce)
  - Slack alerts
  - Strategic Signal Brief

---

## Database Schema

### Tables by Namespace

#### Core Namespace (`core_`)
```sql
core_companies
core_domains
core_enrichment_jobs
core_api_cache
```

#### Intelligence Namespace (`intel_`)
```sql
intel_company_context
intel_technology_stack
intel_traffic_analysis
intel_financial_profile
intel_competitor_intelligence
intel_hiring_signals
intel_strategic_context
intel_investor_intelligence
intel_executive_intelligence
intel_buying_committee
intel_displacement_analysis
intel_case_study_matches
intel_icp_priority_mapping
intel_signal_scoring
intel_strategic_signal_briefs
```

#### Jobs Namespace (`jobs_`)
```sql
jobs_enrichment_queue
jobs_enrichment_history
jobs_scheduled_tasks
```

#### Users Namespace (`users_`)
```sql
users_accounts
users_api_keys
users_rate_limits
users_preferences
```

#### Audit Namespace (`audit_`)
```sql
audit_api_calls
audit_data_changes
audit_user_actions
```

---

## API Endpoints

### Company Endpoints
```
GET  /api/v1/companies/{domain}
POST /api/v1/companies/{domain}/enrich
GET  /api/v1/companies/{domain}/intelligence/{module}
GET  /api/v1/companies/{domain}/brief
```

### List Endpoints
```
GET  /api/v1/targets?tier={1,2,3}&status={hot,warm,cool}&limit=50&offset=0
GET  /api/v1/targets/export?format={csv,json,salesforce}
```

### Intelligence Endpoints
```
GET  /api/v1/intelligence/technology-stack/{domain}
GET  /api/v1/intelligence/financial-profile/{domain}
GET  /api/v1/intelligence/hiring-signals/{domain}
GET  /api/v1/intelligence/investor-intelligence/{domain}
GET  /api/v1/intelligence/buying-committee/{domain}
GET  /api/v1/intelligence/displacement-analysis/{domain}
```

### Batch Endpoints
```
POST /api/v1/batch/enrich
GET  /api/v1/batch/jobs/{job_id}
POST /api/v1/batch/score
```

### Admin Endpoints
```
GET  /api/v1/admin/stats
GET  /api/v1/admin/jobs
GET  /api/v1/admin/cache/status
POST /api/v1/admin/cache/invalidate
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1-2)
- PostgreSQL migration with SQLAlchemy
- API key authentication
- Rate limiting
- Base module infrastructure (M01, M02, M03, M04)

### Phase 2: Core Intelligence (Week 3-4)
- Competitor Intelligence (M05)
- Hiring Signals (M06)
- Strategic Context (M07)
- Async enrichment with Redis Queue

### Phase 3: Deep Intelligence (Week 5-6)
- Investor Intelligence (M08)
- Executive Intelligence (M09)
- Buying Committee (M10)
- Displacement Analysis (M11)

### Phase 4: Scoring & Delivery (Week 7-8)
- Case Study Matching (M12)
- ICP-Priority Mapping (M13)
- Signal Scoring (M14)
- Strategic Signal Brief (M15)
- Dashboard v2.0

---

## Source Citation Mandate

**CRITICAL:** Every data point across all 15 modules MUST include:
1. `source_url` - Direct link to original data source
2. `source_type` - API name or document type
3. `fetched_at` - Timestamp of data retrieval

A module output without source citations is INCOMPLETE.

---

*Document Version: 1.0*
*Last Updated: 2026-02-25*
*Author: Thread 1 - Backend Architecture*
