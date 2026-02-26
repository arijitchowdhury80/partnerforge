# PartnerForge Intelligence Data Model

**Based on**: Analysis of algolia-search-audit skill outputs (Sally Beauty, Tapestry, Uncommon Goods)
**Created by**: Thread 4 (Infrastructure/DevOps)
**Date**: 2026-02-25

---

## Executive Summary

This document captures the intelligence data structures extracted from successful Algolia Search Audit outputs. These structures form the foundation for PartnerForge's enterprise-grade Account-Based Marketing platform.

---

## Part 1: Scratchpad Files (12 Intelligence Modules)

Each account research produces 12 scratchpad files that capture raw intelligence:

| File | Module | Primary Data Sources |
|------|--------|---------------------|
| `01-company-context.md` | Company Context | WebSearch, Wikipedia, Company IR page |
| `02-tech-stack.md` | Technology Stack | BuiltWith (7 endpoints) |
| `03-traffic-data.md` | Traffic & Engagement | SimilarWeb (14 endpoints) |
| `04-competitors.md` | Competitor Intelligence | SimilarWeb + BuiltWith per competitor |
| `05-test-queries.md` | Test Query Strategy | Domain research, product catalog |
| `06-strategic-context.md` | Strategic Context | News, trigger events, expansion signals |
| `07-hiring-signals.md` | Hiring Signals | LinkedIn Jobs, careers page (Chrome MCP) |
| `08-financial-profile.md` | Financial Intelligence | Yahoo Finance MCP, SEC filings |
| `09-browser-findings.md` | Browser Audit Results | Chrome MCP screenshots, search tests |
| `10-scoring-matrix.md` | Scoring Matrix | Aggregated assessment |
| `11-investor-intelligence.md` | Investor Intelligence | SEC 10-K/10-Q, earnings call transcripts |
| `12-icp-priority-mapping.md` | ICP-Priority Mapping | Cross-reference synthesis |

---

## Part 2: Data Structures by Module

### Module 1: Company Context (`01-company-context.md`)

```typescript
interface CompanyContext {
  // Basic Info
  company_name: string;
  domain: string;
  website_url: string;
  ticker?: string;
  exchange?: string;

  // Classification
  headquarters: {
    city: string;
    state: string;
    country: string;
  };
  founded_year: number;
  industry: string;
  business_model: string; // e.g., "B2C + B2B"

  // Scale
  store_count?: number;
  countries_present: string[];
  employee_count: number;
  product_skus: number;

  // Business Segments
  business_segments: Array<{
    name: string;
    description: string;
    brand_names: string[];
  }>;

  // Financial Summary (Quick)
  financial_summary: {
    fiscal_year: number;
    revenue: number;
    revenue_yoy_change: number; // percentage
    gross_margin: number;
    ebitda_margin: number;
    margin_zone: 'red' | 'yellow' | 'green';
  };

  // Stock Info
  stock_info?: {
    current_price: number;
    market_cap: number;
    analyst_consensus: string;
    avg_price_target: number;
  };

  // Executives (Quick List)
  executives: Array<{
    name: string;
    title: string;
    tenure: string;
    background: string;
  }>;

  // Vertical
  vertical: {
    primary: string;
    sub_verticals: string[];
    matched_case_studies: string[];
  };

  // Sources
  sources: Array<{
    name: string;
    url: string;
    type: 'fact' | 'estimate';
  }>;
}
```

### Module 2: Financial Intelligence (`08-financial-profile.md`)

```typescript
interface FinancialIntelligence {
  // Company Reference
  company_name: string;
  ticker: string;
  industry: string;
  fiscal_year_end: string;
  report_date: string;

  // 3-Year Trends
  revenue_trend: Array<{
    fiscal_year: string;
    revenue: number;
    yoy_change: number;
    source_url: string;
  }>;

  earnings_trend: Array<{
    fiscal_year: string;
    net_income: number;
    profit_margin: number;
    source_url: string;
  }>;

  ebitda_trend: Array<{
    fiscal_year: string;
    ebitda: number;
    ebitda_margin: number;
    operating_margin: number;
  }>;

  ecommerce_trend: Array<{
    fiscal_year: string;
    ecommerce_revenue: number;
    pct_of_total: number;
  }>;

  // Margin Zone Analysis
  margin_zone: {
    current_ebitda_margin: number;
    zone: 'red' | 'yellow' | 'green'; // red: ≤10%, yellow: 10-20%, green: >20%
    analysis: string;
    strategic_implication: string;
  };

  // ROI Estimate
  roi_estimate: {
    total_revenue: number;
    digital_share_pct: number;
    digital_revenue: number;
    search_driven_share_pct: number; // industry benchmark ~15%
    addressable_search_revenue: number;
    scenarios: Array<{
      name: 'conservative' | 'moderate' | 'aggressive';
      lift_pct: number;
      annual_impact: number;
    }>;
  };

  // Algolia Case Study Benchmarks
  case_study_benchmarks: Array<{
    customer_name: string;
    result: string;
    relevance: string;
    source_url: string;
  }>;

  // Data Sources
  data_sources: Array<{
    name: string;
    url: string;
    date_accessed: string;
  }>;
}
```

### Module 3: Investor Intelligence (`11-investor-intelligence.md`)

```typescript
interface InvestorIntelligence {
  // Company Reference
  company_name: string;
  ticker: string;
  fiscal_year_end: string;

  // SEC Filings Analysis
  sec_filings: {
    latest_10k: {
      accession_number: string;
      filing_date: string;
      fiscal_year: string;
      source_url: string;
    };
    latest_10q?: {
      accession_number: string;
      filing_date: string;
      quarter: string;
      source_url: string;
    };

    // Extracted Data Points
    ecommerce_performance: {
      global_ecommerce_pct: number;
      trend_years: string[];
      trend_values: number[];
    };
    digital_initiatives: string[];
    risk_factors: string[]; // Technology/digital-related
  };

  // Executive Quotes (CRITICAL)
  executive_quotes: Array<{
    speaker_name: string;
    speaker_title: string;
    quote_text: string;
    context: 'earnings_call' | 'interview' | 'investor_day' | '10k_mda';
    date: string;
    source_name: string;
    source_url: string;
    maps_to_algolia_product: string; // e.g., "Algolia NeuralSearch"
  }>;

  // Forward Guidance
  forward_guidance: {
    net_sales_target: string;
    comparable_sales_target: string;
    eps_target: string;
    ecommerce_targets: Array<{
      metric: string;
      current: string;
      trajectory: string;
    }>;
  };

  // Digital Investment Commitments
  digital_investments: Array<{
    initiative: string;
    timeline: string;
    details: string;
    algolia_mapping: string;
  }>;

  // Algolia Opportunity Mapping
  opportunity_mapping: Array<{
    priority: number;
    category: string;
    alignment: 'high' | 'medium' | 'low';
    evidence: string[];
  }>;

  // Sources Bibliography
  sources: Array<{
    category: 'sec_filings' | 'earnings_calls' | 'interviews' | 'press';
    name: string;
    url: string;
    date: string;
  }>;
}
```

### Module 4: Hiring Signals (`07-hiring-signals.md`)

```typescript
interface HiringSignals {
  // Aggregate Metrics
  total_open_roles: number;
  roles_by_department: Record<string, number>;
  growth_rate_yoy: number;

  // Search-Relevant Roles
  search_roles: Array<{
    title: string;
    department: string;
    location: string;
    seniority: 'entry' | 'mid' | 'senior' | 'executive';
    posted_date: string;
    linkedin_url: string;
    relevance: 'high' | 'medium' | 'low';
    signal: string;
  }>;

  // Signal Interpretation
  signal_strength: 'strong' | 'moderate' | 'technical' | 'caution';
  signal_interpretation: string;

  // Notable Roles
  notable_roles: Array<{
    title: string;
    why_notable: string;
    algolia_connection: string;
    url: string;
  }>;

  // AI/Tech Signals
  ai_tech_signals: Array<{
    signal: string;
    source: string;
    source_url: string;
  }>;

  // Sources
  careers_page_url: string;
  linkedin_jobs_url: string;
  last_checked: string;
}
```

### Module 5: Competitor Intelligence (`04-competitors.md`)

```typescript
interface CompetitorIntelligence {
  // Target Account Reference
  target_domain: string;

  // Competitors
  competitors: Array<{
    domain: string;
    company_name: string;
    similarity_score: number;
    similarity_source: 'audience' | 'keywords' | 'both';

    // Traffic
    monthly_visits: number;
    bounce_rate: number;
    pages_per_visit: number;

    // Technology Stack
    search_vendor: string | null;
    has_algolia: boolean;
    ecommerce_platform: string;
    technologies: string[];

    // Algolia Angle
    algolia_angle: string; // e.g., "They've invested in AI search. Are you comfortable being behind?"

    source_url: string;
  }>;

  // Algolia Penetration
  algolia_adoption: {
    total_competitors_checked: number;
    competitors_using_algolia: number;
    competitors_using_algolia_list: string[];
    first_mover_opportunity: boolean;
    first_mover_pitch: string;
  };

  // Current Tech Stack
  current_tech_stack: Array<{
    technology: string;
    status: 'active' | 'tag-only' | 'removed';
    source: string;
  }>;
}
```

---

## Part 3: Final Deliverable Structures

### Deliverable 1: Strategic Signal Brief

```typescript
interface StrategicSignalBrief {
  // Header
  company_name: string;
  generated_date: string;

  // 60-Second Story (1 paragraph summary)
  sixty_second_story: string;

  // Timing Signals
  timing_signals: Array<{
    signal: string;
    source_url: string;
  }>;

  // In Their Own Words (Executive Quotes)
  in_their_own_words: Array<{
    quote: string;
    speaker: string;
    title: string;
    source_url: string;
  }>;

  // People (Buying Committee)
  people: Array<{
    name: string;
    title: string;
    buyer_role: 'executive_sponsor' | 'budget_authority' | 'technical_buyer' | 'economic_buyer' | 'champion' | 'user_buyer';
    priority: 'high' | 'medium' | 'low';
  }>;

  // Money
  money: {
    revenue: string;
    revenue_source: string;
    ecommerce_revenue: string;
    ecommerce_source: string;
    addressable_search_revenue: string;
    potential_annual_lift: string;
  };

  // Gaps (from audit)
  gaps: Array<{
    area: string;
    score: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;

  // Hiring Intelligence
  hiring_intelligence: Array<{
    signal: string;
    source_url: string;
  }>;

  // Competitive Landscape
  competitive_landscape: Array<{
    competitor: string;
    search_provider: string;
    status: string;
    algolia_angle: string;
    source_url: string;
  }>;

  // ICP Mapping
  icp_mapping: Array<{
    stated_priority: string;
    algolia_solution: string;
  }>;

  // The Angle (Positioning Statement)
  the_angle: string;

  // Sources
  sources: string[];
}
```

### Deliverable 2: AE Pre-Call Brief

```typescript
interface AEPreCallBrief {
  // Header
  company_name: string;
  ticker: string;
  website: string;
  audit_date: string;
  audit_score: string;

  // 1. Executive Cheat Sheet
  executive_cheat_sheet: {
    revenue: string;
    business_model: string;
    digital: string;
    top_gap: string;
    opportunity: string;
  };

  // 2. Financial Profile
  financial_profile: {
    revenue_trend: Array<{
      fiscal_year: string;
      revenue: string;
      yoy_change: string;
      source: string;
    }>;
    key_metrics: Array<{
      metric: string;
      value: string;
      source: string;
    }>;
    margin_zone: {
      zone: 'red' | 'yellow' | 'green';
      analysis: string;
      pitch_implication: string;
    };
    stock_performance: Array<{
      metric: string;
      value: string;
      source: string;
    }>;
  };

  // 3. Key Executives
  key_executives: {
    c_suite: Array<{
      name: string;
      title: string;
      background: string;
      linkedin_url: string;
    }>;
    digital_leadership: Array<{
      name: string;
      title: string;
      buyer_role: string;
      linkedin_url: string;
    }>;
    recommended_entry_points: string[];
  };

  // 4. Recent News & Trigger Events
  trigger_events: {
    positive_signals: Array<{
      event: string;
      details: string;
      algolia_connection: string;
      source: string;
    }>;
    caution_signals: Array<{
      signal: string;
      details: string;
      implication: string;
      source: string;
    }>;
  };

  // 5. Audit Highlights (Top 3 Findings)
  audit_highlights: Array<{
    finding_number: number;
    title: string;
    score: string;
    tested: string;
    expected: string;
    found: string;
    screenshot: string;
    industry_context: string;
    industry_context_source: string;
    solution: string;
  }>;

  // Score Summary
  score_summary: Array<{
    area: string;
    score: string;
    severity: 'high' | 'medium' | 'low';
  }>;

  // 6. Discovery Questions
  discovery_questions: {
    opening_mirror_language: string;
    current_state_questions: Array<{
      question: string;
      why_ask: string;
    }>;
    timing_questions: Array<{
      question: string;
      why_ask: string;
    }>;
    roi_sensitivity_questions: Array<{
      question: string;
      why_ask: string;
    }>;
  };

  // 7. Stakeholder Targets
  stakeholder_targets: Array<{
    role_type: string;
    name: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    entry_approach: string;
  }>;
  buying_committee_notes: string[];

  // 8. Pilot Strategy
  pilot_strategy: {
    recommended_scope: Array<{
      pilot_type: string;
      scope: string;
      timeline: string;
      budget_range: string;
    }>;
    kpis: Array<{
      kpi: string;
      baseline: string;
      target: string;
      measurement: string;
    }>;
    roi_projections: Array<{
      scenario: string;
      lift_pct: string;
      annual_impact: string;
      calculation: string;
    }>;
    supporting_case_studies: Array<{
      customer: string;
      result: string;
      relevance: string;
      source: string;
    }>;
  };

  // 9. Competitive Context
  competitive_context: {
    competitor_search_providers: Array<{
      competitor: string;
      search_provider: string;
      status: string;
      algolia_angle: string;
    }>;
    first_mover_positioning: string;
    current_tech_stack: Array<{
      technology: string;
      status: string;
      source: string;
    }>;
    integration_note: string;
  };

  // 10. Speaking Their Language
  speaking_their_language: {
    quote_to_product_mapping: Array<{
      quote: string;
      source: string;
      maps_to: string;
    }>;
    strategic_language: Array<{
      their_word: string;
      use_in_pitch: string;
    }>;
  };

  // Appendix: Sources
  sources: {
    company_financial: string[];
    earnings_transcripts: string[];
    strategy_news: string[];
    hiring_linkedin: string[];
  };
}
```

---

## Part 4: Database Schema Mapping

### PostgreSQL Tables for Intelligence Storage

```sql
-- =============================================================================
-- Intelligence Module Tables (maps to scratchpad files)
-- =============================================================================

-- Company Context
CREATE TABLE intel.company_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    -- Basic Info
    company_name VARCHAR(500),
    website_url TEXT,
    ticker VARCHAR(20),
    exchange VARCHAR(20),

    -- Location
    hq_city VARCHAR(100),
    hq_state VARCHAR(100),
    hq_country VARCHAR(100),
    founded_year INTEGER,

    -- Scale
    industry VARCHAR(200),
    business_model VARCHAR(200),
    store_count INTEGER,
    countries_present TEXT[],
    employee_count INTEGER,
    product_skus INTEGER,

    -- Business Segments
    business_segments JSONB, -- Array of segment objects

    -- Financial Summary (quick)
    fiscal_year INTEGER,
    revenue BIGINT,
    revenue_yoy_change DECIMAL(5,2),
    gross_margin DECIMAL(5,2),
    ebitda_margin DECIMAL(5,2),
    margin_zone VARCHAR(10),

    -- Stock Info
    current_price DECIMAL(12,4),
    market_cap BIGINT,
    analyst_consensus VARCHAR(50),
    avg_price_target DECIMAL(12,4),

    -- Executives (quick list)
    executives JSONB,

    -- Vertical
    vertical_primary VARCHAR(100),
    vertical_sub TEXT[],
    matched_case_studies TEXT[],

    -- Sources
    sources JSONB,

    fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id)
);

-- Executive Quotes (separate table for many-to-one)
CREATE TABLE intel.executive_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    speaker_name VARCHAR(255) NOT NULL,
    speaker_title VARCHAR(255),
    quote_text TEXT NOT NULL,
    context VARCHAR(50), -- 'earnings_call', 'interview', 'investor_day', '10k_mda'
    quote_date DATE,
    source_name VARCHAR(255),
    source_url TEXT,
    maps_to_algolia_product VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    INDEX idx_exec_quotes_account (account_id)
);

-- Hiring Signals
CREATE TABLE intel.hiring_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    total_open_roles INTEGER,
    roles_by_department JSONB,
    growth_rate_yoy DECIMAL(5,2),

    search_roles JSONB, -- Array of role objects
    search_roles_count INTEGER,

    signal_strength VARCHAR(20),
    signal_interpretation TEXT,

    notable_roles JSONB,
    ai_tech_signals JSONB,

    careers_page_url TEXT,
    linkedin_jobs_url TEXT,
    last_checked TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id)
);

-- Strategic Signal Brief (final deliverable)
CREATE TABLE intel.strategic_signal_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    generated_date DATE,
    sixty_second_story TEXT,

    timing_signals JSONB,
    in_their_own_words JSONB,
    people JSONB,
    money JSONB,
    gaps JSONB,
    hiring_intelligence JSONB,
    competitive_landscape JSONB,
    icp_mapping JSONB,
    the_angle TEXT,
    sources TEXT[],

    -- Markdown output
    markdown_content TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id)
);

-- AE Pre-Call Brief (final deliverable)
CREATE TABLE intel.ae_precall_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES core.accounts(id) ON DELETE CASCADE,

    generated_date DATE,
    audit_score VARCHAR(20),

    executive_cheat_sheet JSONB,
    financial_profile JSONB,
    key_executives JSONB,
    trigger_events JSONB,
    audit_highlights JSONB,
    score_summary JSONB,
    discovery_questions JSONB,
    stakeholder_targets JSONB,
    pilot_strategy JSONB,
    competitive_context JSONB,
    speaking_their_language JSONB,
    sources JSONB,

    -- Markdown output
    markdown_content TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id)
);
```

---

## Part 5: Signal Weights for ICP Scoring

Based on analysis of the audit outputs, here are the signal weights:

```typescript
const SIGNAL_WEIGHTS = {
  // Budget Signals (30%)
  revenue_over_1b: 10,
  revenue_over_500m: 7,
  revenue_over_100m: 4,
  margin_zone_green: 10,
  margin_zone_yellow: 5,
  margin_zone_red: 2,
  ecommerce_pct_over_15: 10,
  ecommerce_pct_over_10: 7,
  ecommerce_pct_over_5: 4,

  // Pain Signals (40%)
  search_audit_score_below_5: 15,
  nlp_gap_high: 10,
  personalization_gap_high: 10,
  recommendations_gap_high: 8,
  federated_search_gap_high: 8,
  competitor_using_algolia: 12,
  competitor_using_constructor: 10,
  ceo_mentions_search: 15,
  ceo_mentions_personalization: 12,
  ceo_mentions_ai: 10,

  // Timing Signals (30%)
  hiring_vp_ecommerce: 15,
  hiring_search_roles: 10,
  platform_replatform: 15,
  app_upgrade_announced: 12,
  digital_transformation_announced: 10,
  new_cio_hired: 8,
  recent_layoffs: -5, // caution signal
  store_closures: -3,
};
```

---

## Part 6: API Endpoints for Intelligence

```yaml
# Intelligence Module APIs

# Company Context
GET /api/v1/accounts/{domain}/company-context
POST /api/v1/accounts/{domain}/company-context/refresh

# Financial Intelligence
GET /api/v1/accounts/{domain}/financial
POST /api/v1/accounts/{domain}/financial/refresh

# Investor Intelligence
GET /api/v1/accounts/{domain}/investor-intel
GET /api/v1/accounts/{domain}/investor-intel/quotes

# Hiring Signals
GET /api/v1/accounts/{domain}/hiring
POST /api/v1/accounts/{domain}/hiring/refresh

# Competitors
GET /api/v1/accounts/{domain}/competitors
POST /api/v1/accounts/{domain}/competitors/refresh

# Strategic Context
GET /api/v1/accounts/{domain}/strategic
GET /api/v1/accounts/{domain}/strategic/trigger-events

# Final Deliverables
GET /api/v1/accounts/{domain}/signal-brief
POST /api/v1/accounts/{domain}/signal-brief/generate

GET /api/v1/accounts/{domain}/ae-brief
POST /api/v1/accounts/{domain}/ae-brief/generate
```

---

## Summary

This document captures the complete intelligence data model based on real audit outputs:

1. **12 Scratchpad Files** = 12 Intelligence Modules
2. **6+ Final Deliverables** = Actionable Sales Intelligence
3. **3 Priority Outputs**:
   - Strategic Signal Brief (for downstream LLMs)
   - AE Pre-Call Brief (for sales reps)
   - Full Audit Report (for detailed reference)

All data structures include:
- **Source Attribution** (every fact has a URL)
- **Executive Quotes** (speaker + title + source)
- **Algolia Product Mapping** (what solution addresses each pain point)
- **Competitive Context** (who uses what search vendor)

---

*Document Version: 1.0*
*Created: 2026-02-25*
*Source: Analysis of Sally Beauty, Tapestry, Uncommon Goods search audit outputs*
