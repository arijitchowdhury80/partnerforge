# PartnerForge Data Pipeline Flows

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Thread 2 Working Document
**Purpose:** Define the data flow between intelligence modules for the enrichment pipeline

---

## 1. Pipeline Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ENRICHMENT ORCHESTRATOR                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         WAVE 1: FOUNDATION                            │   │
│  │  (Parallel - No dependencies)                                        │   │
│  │                                                                       │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │   │
│  │  │   M01       │    │   M02       │    │   M03       │              │   │
│  │  │  Company    │    │  Tech Stack │    │  Traffic    │              │   │
│  │  │  Context    │    │             │    │  Metrics    │              │   │
│  │  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │   │
│  │         │                  │                  │                       │   │
│  │         └──────────────────┼──────────────────┘                       │   │
│  │                            ▼                                          │   │
│  │                    ┌───────────────┐                                  │   │
│  │                    │   VALIDATOR   │                                  │   │
│  │                    │ (domain, min  │                                  │   │
│  │                    │  fields)      │                                  │   │
│  │                    └───────┬───────┘                                  │   │
│  └────────────────────────────┼──────────────────────────────────────────┘   │
│                               ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         WAVE 2: DEEP INTELLIGENCE                     │   │
│  │  (Parallel - Depends on Wave 1)                                      │   │
│  │                                                                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │  M04    │ │  M05    │ │  M06    │ │  M07    │ │  M08    │        │   │
│  │  │Compete  │ │Queries  │ │Strategy │ │ Hiring  │ │Finance  │        │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │   │
│  │       └───────────┴───────────┴───────────┴───────────┘              │   │
│  │                               ▼                                       │   │
│  │                       ┌───────────────┐                              │   │
│  │                       │   VALIDATOR   │                              │   │
│  │                       └───────┬───────┘                              │   │
│  └───────────────────────────────┼───────────────────────────────────────┘   │
│                                  ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         WAVE 3: ANALYSIS                              │   │
│  │  (Sequential - Depends on Wave 2)                                    │   │
│  │                                                                       │   │
│  │  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐        │   │
│  │  │  M09    │ ──► │  M10    │ ──► │  M11    │ ──► │  M12    │        │   │
│  │  │Browser  │     │ Scoring │     │Investor │     │ICP Map  │        │   │
│  │  └─────────┘     └─────────┘     └─────────┘     └─────────┘        │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                  ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         WAVE 4: DELIVERABLES                          │   │
│  │  (Parallel - All modules complete)                                   │   │
│  │                                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │Strategic │  │AE Pre-   │  │Audit     │  │Book      │             │   │
│  │  │Brief     │  │Call Brief│  │Report    │  │PDF       │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                  ▼                                           │
│                          ┌───────────────┐                                   │
│                          │  AGGREGATOR   │                                   │
│                          │ (combine all  │                                   │
│                          │  results)     │                                   │
│                          └───────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Dependency Graph

```
M01 (Company)     ──┐
M02 (Tech)        ──┼──► M04 (Competitors) ──┐
M03 (Traffic)     ──┘                        │
                      ──► M05 (Queries)      │
                      ──► M06 (Strategic)    │
                      ──► M07 (Hiring)       ├──► M09 (Browser) ──► M10 (Scoring) ──► M11 (Investor) ──► M12 (ICP)
                      ──► M08 (Financial)  ──┘

Dependencies:
- M04 needs: M01 (company name for competitor search), M03 (traffic for comparison)
- M05 needs: M01 (vertical for query types), M02 (tech for feature testing)
- M06 needs: M01 (context), M08 (financials for strategic context)
- M07 needs: M01 (company name for LinkedIn search)
- M08 needs: M01 (ticker)
- M09 needs: M05 (test queries), M02 (current search provider)
- M10 needs: M09 (all findings)
- M11 needs: M01 (ticker), M08 (financials), M07 (executives)
- M12 needs: ALL modules
```

---

## 3. Module Input/Output Specifications

### Module 01: Company Context

**Inputs:**
```typescript
interface M01Input {
  domain: string;  // Required
}
```

**External APIs:**
- WebSearch: Company narrative, executives, news
- SEC EDGAR: 10-K filing metadata (if public)

**Outputs:**
```typescript
interface M01Output {
  company_name: string;
  domain: string;
  ticker?: string;
  headquarters?: string;
  founded_year?: number;
  industry: string;
  vertical: string;
  business_model: string;
  business_segments: BusinessSegment[];
  employee_count?: number;
  store_count?: number;
  countries: string[];
  recent_news: NewsItem[];
  executives: ExecutiveSummary[];
}
```

**Downstream Consumers:** M04, M05, M06, M07, M08, M11, M12

---

### Module 02: Technology Stack

**Inputs:**
```typescript
interface M02Input {
  domain: string;
}
```

**External APIs:**
- BuiltWith: domain-lookup, relationships-api, tech-spending
- SimilarWeb: technographics (fallback)

**Outputs:**
```typescript
interface M02Output {
  ecommerce_platform: string;
  search_provider: SearchProviderDetection;
  technologies: Technology[];
  tech_spend_estimated?: number;
  recently_added: TechChange[];
  recently_removed: TechChange[];
  related_properties: RelatedProperty[];
  displacement_opportunities: DisplacementOpportunity[];
}

interface SearchProviderDetection {
  provider_name: string;
  detection_status: 'confirmed' | 'likely' | 'inferred' | 'not_detected';
  detection_method: string;
  api_patterns?: string[];
  is_algolia: boolean;
}
```

**Downstream Consumers:** M04, M05, M09, M12

---

### Module 03: Traffic Intelligence

**Inputs:**
```typescript
interface M03Input {
  domain: string;
  country?: string;  // default: 'ww' (worldwide)
}
```

**External APIs:**
- SimilarWeb: traffic, engagement, sources, geography, demographics, keywords

**Outputs:**
```typescript
interface M03Output {
  monthly_sessions: number;
  monthly_revenue?: number;
  conversion_rate?: number;
  average_order_value?: number;
  device_split: { desktop: number; mobile: number; tablet?: number };
  bounce_rate?: number;
  pages_per_visit?: number;
  avg_visit_duration_seconds?: number;
  global_rank?: number;
  country_rank?: number;
  category_rank?: { rank: number; category: string };
  traffic_sources: TrafficSources;
  geo_distribution: GeoDistribution[];
  demographics?: Demographics;
  revenue_impact_calculation: RevenueImpact;
}

interface RevenueImpact {
  addressable_search_revenue: number;
  potential_lift_conservative: number;
  potential_lift_moderate: number;
  potential_lift_aggressive: number;
}
```

**Downstream Consumers:** M04, M08, M12

---

### Module 04: Competitive Intelligence

**Inputs:**
```typescript
interface M04Input {
  domain: string;
  company_name: string;  // from M01
  monthly_visits: number;  // from M03
}
```

**External APIs:**
- SimilarWeb: similar-sites, competitors
- BuiltWith: domain-lookup (for each competitor)

**Outputs:**
```typescript
interface M04Output {
  competitors: Competitor[];
  competitive_landscape_summary: string;
  search_provider_analysis: SearchProviderAnalysis[];
  competitive_threats: CompetitiveThreat[];
  first_mover_opportunities: FirstMoverOpportunity[];
}

interface Competitor {
  domain: string;
  name?: string;
  monthly_visits: number;
  ecommerce_revenue?: number;
  why_competitor: string;
  search_provider?: string;
  search_provider_status?: 'confirmed' | 'likely' | 'unknown';
}
```

**Downstream Consumers:** M12

---

### Module 05: Test Queries

**Inputs:**
```typescript
interface M05Input {
  domain: string;
  vertical: string;  // from M01
  ecommerce_platform: string;  // from M02
  search_provider: string;  // from M02
}
```

**External APIs:** None (analysis module)

**Outputs:**
```typescript
interface M05Output {
  test_queries: TestQuery[];
  query_categories: string[];
}

interface TestQuery {
  query: string;
  category: 'product' | 'brand' | 'long_tail' | 'nlp' | 'misspell' | 'ambiguous';
  expected_outcome: string;
  rationale: string;
}
```

**Downstream Consumers:** M09

---

### Module 06: Strategic Context

**Inputs:**
```typescript
interface M06Input {
  domain: string;
  company_name: string;  // from M01
  ticker?: string;  // from M01
}
```

**External APIs:**
- WebSearch: Recent news, press releases, strategic initiatives

**Outputs:**
```typescript
interface M06Output {
  recent_news: NewsItem[];
  trigger_events: TriggerEvent[];
  strategic_initiatives: StrategicInitiative[];
  market_position?: string;
  growth_strategy?: string;
}

interface TriggerEvent {
  event: string;
  timing: string;
  opportunity: string;
  source_url?: string;
}
```

**Downstream Consumers:** M12

---

### Module 07: Hiring Signals

**Inputs:**
```typescript
interface M07Input {
  domain: string;
  company_name: string;  // from M01
}
```

**External APIs:**
- WebSearch: LinkedIn job postings, careers page

**Outputs:**
```typescript
interface M07Output {
  total_open_positions?: number;
  tier1_signals: HiringSignal[];
  tier2_signals: HiringSignal[];
  tier3_signals: HiringSignal[];
  ai_ml_investment_signal: boolean;
  buying_committee: Executive[];
  recommended_entry_points: EntryPoint[];
}

interface HiringSignal {
  role: string;
  status: 'active' | 'posted' | 'filled';
  location: string;
  salary_range?: string;
  signal_strength: 'STRONG' | 'MODERATE' | 'LOW';
  key_insight?: string;
  source_url: string;
}

interface Executive {
  name: string;
  title: string;
  linkedin_url?: string;
  buyer_role: 'executive_sponsor' | 'budget_authority' | 'technical_buyer' | 'economic_buyer' | 'champion' | 'user_buyer';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  tenure?: string;
  background?: string;
}
```

**Downstream Consumers:** M11, M12

---

### Module 08: Financial Profile

**Inputs:**
```typescript
interface M08Input {
  domain: string;
  company_name: string;  // from M01
  ticker?: string;  // from M01
  monthly_revenue?: number;  // from M03
}
```

**External APIs:**
- Yahoo Finance: financials, stock info, analyst ratings
- SEC EDGAR: 10-K, 10-Q filings

**Outputs:**
```typescript
interface M08Output {
  revenue_3yr: YearlyMetric[];
  net_income_3yr: YearlyMetric[];
  ebitda_3yr: YearlyMetric[];
  ecommerce_revenue_3yr?: YearlyMetric[];
  margin_zone: 'RED' | 'YELLOW' | 'GREEN';
  margin_zone_analysis: string;
  stock_info?: StockInfo;
  roi_estimate: ROIEstimate;
  case_study_benchmarks: CaseStudyBenchmark[];
}

interface ROIEstimate {
  addressable_revenue: number;
  search_driven_share: number;
  conservative: { lift_pct: number; annual_impact: number };
  moderate: { lift_pct: number; annual_impact: number };
  aggressive: { lift_pct: number; annual_impact: number };
}
```

**Downstream Consumers:** M11, M12

---

### Module 09: Browser Findings

**Inputs:**
```typescript
interface M09Input {
  domain: string;
  test_queries: TestQuery[];  // from M05
  search_provider: string;  // from M02
}
```

**External APIs:**
- Chrome MCP: Browser automation, screenshots

**Outputs:**
```typescript
interface M09Output {
  findings: AuditFinding[];
  screenshots: Screenshot[];
  overall_score: number;
  high_severity_gaps: string[];
}

interface AuditFinding {
  category: AuditCategory;
  score: number;  // 1-10
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  tested_query: string;
  expected_result: string;
  actual_result: string;
  screenshot_path?: string;
  industry_context?: string;
  recommended_solution: string;
}

type AuditCategory =
  | 'latency'
  | 'typo_tolerance'
  | 'query_suggestions'
  | 'intent_detection'
  | 'merchandising'
  | 'content_commerce'
  | 'semantic_nlp'
  | 'personalization'
  | 'recommendations'
  | 'search_intelligence';
```

**Downstream Consumers:** M10

---

### Module 10: Scoring Matrix

**Inputs:**
```typescript
interface M10Input {
  findings: AuditFinding[];  // from M09
}
```

**External APIs:** None (analysis module)

**Outputs:**
```typescript
interface M10Output {
  scores: CategoryScore[];
  overall_score: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
}

interface CategoryScore {
  category: AuditCategory;
  score: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}
```

**Downstream Consumers:** M12

---

### Module 11: Investor Intelligence

**Inputs:**
```typescript
interface M11Input {
  domain: string;
  company_name: string;  // from M01
  ticker?: string;  // from M01
  executives: Executive[];  // from M07
  financials: M08Output;  // from M08
}
```

**External APIs:**
- SEC EDGAR: 10-K, 10-Q full text
- WebSearch: Earnings transcripts, investor presentations

**Outputs:**
```typescript
interface M11Output {
  sec_filings: SECFiling[];
  digital_initiatives: DigitalInitiative[];
  risk_factors?: RiskFactor[];
  earnings_quotes: ExecutiveQuote[];
  forward_guidance: ForwardGuidance[];
  technology_roadmap?: TechRoadmapItem[];
  algolia_opportunity_mapping: AlgoliaMapping[];
}

interface ExecutiveQuote {
  quote: string;
  speaker_name: string;
  speaker_title: string;
  date: string;
  source_url: string;
  maps_to_algolia: string;
  relevance_score?: number;
}
```

**Downstream Consumers:** M12

---

### Module 12: ICP Priority Mapping

**Inputs:**
```typescript
interface M12Input {
  // All previous module outputs
  company: M01Output;
  tech_stack: M02Output;
  traffic: M03Output;
  competitors: M04Output;
  test_queries: M05Output;
  strategic: M06Output;
  hiring: M07Output;
  financial: M08Output;
  browser: M09Output;
  scoring: M10Output;
  investor: M11Output;
}
```

**External APIs:** None (synthesis module)

**Outputs:**
```typescript
interface M12Output {
  priority_matrix: PriorityMapping[];
  discovery_questions: DiscoveryQuestion[];
  financial_context: FinancialContext;
  search_revenue_lift_estimate: RevenueImpact;
  competitive_anchors: CompetitiveAnchor[];
  red_flags: RedFlag[];
  key_executives_to_engage: ExecutiveEngagement[];
}

interface PriorityMapping {
  priority_number: number;
  their_stated_priority: string;
  source_url: string;
  algolia_solution: string;
  discovery_question: string;
}

interface DiscoveryQuestion {
  category: 'opening' | 'current_state' | 'timing' | 'personalization' | 'federated' | 'roi';
  question: string;
  why_ask: string;
  uses_their_language: boolean;
}
```

**Downstream Consumers:** Deliverable generators

---

## 4. Adapter Specifications

### BaseAdapter

```typescript
abstract class BaseAdapter {
  protected rateLimiter: TokenBucketRateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected retryConfig: RetryConfig;

  abstract fetch(params: Record<string, any>): Promise<RawResponse>;
  abstract transform(raw: RawResponse): NormalizedData;
  abstract validate(data: NormalizedData): ValidationResult;
}

interface RetryConfig {
  maxRetries: number;  // default: 3
  baseDelayMs: number;  // default: 1000
  maxDelayMs: number;  // default: 30000
  exponentialBase: number;  // default: 2
  jitterFactor: number;  // default: 0.1
}

interface CircuitBreakerConfig {
  failureThreshold: number;  // default: 5
  recoveryTimeMs: number;  // default: 60000
  halfOpenRequests: number;  // default: 3
}

interface RateLimiterConfig {
  tokensPerSecond: number;
  bucketSize: number;
}
```

### BuiltWithAdapter

```typescript
class BuiltWithAdapter extends BaseAdapter {
  // Endpoints
  static ENDPOINTS = {
    DOMAIN_LOOKUP: '/domain-api/api.json',
    FREE_API: '/free1/api.json',
    RELATIONSHIPS: '/relationships-api/api.json',
    FINANCIAL: '/financial-api/api.json',
    SOCIAL: '/social-api/api.json',
    TRUST: '/trust-api/api.json',
    KEYWORDS: '/keywords-api/api.json',
  };

  // Rate limits per plan
  rateLimiter = new TokenBucketRateLimiter({
    tokensPerSecond: 1,
    bucketSize: 10,
  });
}
```

### SimilarWebAdapter

```typescript
class SimilarWebAdapter extends BaseAdapter {
  // Endpoints
  static ENDPOINTS = {
    TRAFFIC: '/website/{domain}/total-traffic-and-engagement/visits',
    ENGAGEMENT: '/website/{domain}/total-traffic-and-engagement/pages-per-visit',
    SOURCES: '/website/{domain}/traffic-sources/overview',
    GEOGRAPHY: '/website/{domain}/geo/traffic-by-country',
    DEMOGRAPHICS: '/website/{domain}/audience-demographics/gender',
    KEYWORDS: '/website/{domain}/search-keywords/organic',
    SIMILAR_SITES: '/website/{domain}/similar-sites/similarsites',
    COMPETITORS: '/website/{domain}/competitors/similarcompetitors',
    TECHNOGRAPHICS: '/website/{domain}/technographics',
    REFERRALS: '/website/{domain}/referral-traffic/referral-destinations',
    RANK: '/website/{domain}/global-rank/global-rank',
  };

  // Rate limits (SimilarWeb has strict limits)
  rateLimiter = new TokenBucketRateLimiter({
    tokensPerSecond: 0.5,
    bucketSize: 5,
  });
}
```

### YahooFinanceAdapter

```typescript
class YahooFinanceAdapter extends BaseAdapter {
  // Endpoints (via MCP)
  static ENDPOINTS = {
    FINANCIALS: 'get_financials',
    STOCK_INFO: 'get_stock_info',
    ANALYST_RATINGS: 'get_analyst_ratings',
    NEWS: 'get_news',
    HOLDERS: 'get_holders',
  };

  // Ticker resolution (needed before API calls)
  async resolveTickerFromCompanyName(companyName: string): Promise<string | null>;
}
```

### SECEdgarAdapter

```typescript
class SECEdgarAdapter extends BaseAdapter {
  // Endpoints
  static ENDPOINTS = {
    COMPANY_FILINGS: '/cgi-bin/browse-edgar',
    FULL_TEXT_SEARCH: '/cgi-bin/srch-ia',
    FILING_CONTENT: '/Archives/edgar/data/',
  };

  // Methods
  async getFilingsList(cik: string, filingType: '10-K' | '10-Q'): Promise<FilingReference[]>;
  async getFilingContent(accessionNumber: string): Promise<string>;
  async extractDigitalInitiatives(content: string): Promise<DigitalInitiative[]>;
  async extractRiskFactors(content: string): Promise<RiskFactor[]>;
}
```

### WebSearchAdapter

```typescript
class WebSearchAdapter extends BaseAdapter {
  // Used as fallback when MCP servers unavailable
  // Also used for:
  // - Executive bios
  // - Earnings transcripts
  // - Industry context
  // - News

  async searchCompanyInfo(companyName: string): Promise<CompanyInfo>;
  async searchExecutives(companyName: string): Promise<Executive[]>;
  async searchEarningsTranscript(ticker: string, quarter: string): Promise<EarningsTranscript>;
  async searchNews(companyName: string, dateRange?: DateRange): Promise<NewsItem[]>;
}
```

---

## 5. Orchestrator Design

```typescript
class EnrichmentOrchestrator {
  private adapters: Map<string, BaseAdapter>;
  private moduleExecutors: Map<string, ModuleExecutor>;

  constructor(config: OrchestratorConfig) {
    this.initializeAdapters(config);
    this.initializeModules(config);
  }

  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const { domain, modules, forceRefresh } = request;

    // Create job record
    const job = await this.createJob(domain, modules);

    try {
      // Wave 1: Foundation (parallel)
      const wave1Results = await Promise.allSettled([
        this.executeModule('M01', { domain }),
        this.executeModule('M02', { domain }),
        this.executeModule('M03', { domain }),
      ]);

      // Validate Wave 1
      const wave1Data = this.aggregateResults(wave1Results);
      if (!this.validateWave1(wave1Data)) {
        return this.partialResult(job, wave1Data);
      }

      // Wave 2: Deep Intelligence (parallel)
      const wave2Results = await Promise.allSettled([
        this.executeModule('M04', { ...wave1Data }),
        this.executeModule('M05', { ...wave1Data }),
        this.executeModule('M06', { ...wave1Data }),
        this.executeModule('M07', { ...wave1Data }),
        this.executeModule('M08', { ...wave1Data }),
      ]);

      const wave2Data = this.aggregateResults(wave2Results);

      // Wave 3: Analysis (sequential)
      const m09 = await this.executeModule('M09', { ...wave1Data, ...wave2Data });
      const m10 = await this.executeModule('M10', { findings: m09.findings });
      const m11 = await this.executeModule('M11', { ...wave1Data, ...wave2Data });
      const m12 = await this.executeModule('M12', {
        ...wave1Data,
        ...wave2Data,
        browser: m09,
        scoring: m10,
        investor: m11,
      });

      // Complete job
      return this.completeJob(job, {
        ...wave1Data,
        ...wave2Data,
        browser: m09,
        scoring: m10,
        investor: m11,
        icp_mapping: m12,
      });

    } catch (error) {
      return this.failJob(job, error);
    }
  }

  private async executeModule(
    moduleId: string,
    input: Record<string, any>
  ): Promise<ModuleOutput> {
    const executor = this.moduleExecutors.get(moduleId);
    const startTime = Date.now();

    try {
      const result = await executor.execute(input);
      await this.logModuleSuccess(moduleId, Date.now() - startTime);
      return result;
    } catch (error) {
      await this.logModuleFailure(moduleId, error);
      throw error;
    }
  }
}
```

---

## 6. Result Aggregator

```typescript
class ResultAggregator {
  aggregate(moduleOutputs: Map<string, ModuleOutput>): AggregatedResult {
    return {
      domain: this.getDomain(moduleOutputs),
      status: this.calculateStatus(moduleOutputs),
      company: moduleOutputs.get('M01'),
      technologies: moduleOutputs.get('M02'),
      traffic: moduleOutputs.get('M03'),
      competitors: moduleOutputs.get('M04'),
      testQueries: moduleOutputs.get('M05'),
      strategic: moduleOutputs.get('M06'),
      hiring: moduleOutputs.get('M07'),
      financials: moduleOutputs.get('M08'),
      browser: moduleOutputs.get('M09'),
      scoring: moduleOutputs.get('M10'),
      investor: moduleOutputs.get('M11'),
      icpMapping: moduleOutputs.get('M12'),
      errors: this.collectErrors(moduleOutputs),
      duration_ms: this.calculateDuration(moduleOutputs),
    };
  }

  calculateStatus(outputs: Map<string, ModuleOutput>): EnrichmentStatus {
    const total = outputs.size;
    const successful = Array.from(outputs.values()).filter(o => o.success).length;

    if (successful === total) return 'completed';
    if (successful === 0) return 'failed';
    return 'partial';
  }

  collectErrors(outputs: Map<string, ModuleOutput>): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const [key, output] of outputs) {
      if (!output.success && output.error) {
        errors[key] = output.error.message;
      }
    }
    return errors;
  }
}
```

---

## 7. Error Handling Strategy

### Partial Success

The pipeline MUST support partial success. If M08 (Financial) fails because no ticker was found, the rest of the pipeline should continue.

```typescript
interface PartialResult {
  status: 'partial';
  completed_modules: string[];
  failed_modules: string[];
  errors: Record<string, ErrorDetail>;
  data: Partial<AggregatedResult>;
}
```

### Fallback Chain

```
BuiltWith domain-api → BuiltWith free-api → SimilarWeb technographics
SimilarWeb traffic → ECDB → Grips Intelligence
Yahoo Finance → SEC EDGAR → WebSearch estimates
```

### Circuit Breaker States

```
CLOSED (normal) → after 5 failures → OPEN (reject all)
OPEN → after 60s → HALF_OPEN (allow 3 test requests)
HALF_OPEN → if 3 succeed → CLOSED
HALF_OPEN → if any fail → OPEN
```

---

## 8. Caching Strategy

### TTL by Data Type

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Company Context | 30 days | Rarely changes |
| Tech Stack | 7 days | Technologies can change |
| Traffic | 7 days | Monthly refresh typical |
| Financials | 1 day | Stock prices change daily |
| Hiring | 1 day | Job postings change frequently |
| Competitors | 7 days | Landscape is stable |
| Browser Audit | 14 days | Site changes infrequently |

### Cache Keys

```
builtwith:{domain}:{endpoint}
similarweb:{domain}:{endpoint}:{country}
yahoofinance:{ticker}:{endpoint}
secedgar:{cik}:{filing_type}
```

---

## 9. Next Steps for Implementation

1. **Create `pipeline/__init__.py`** - Package initialization
2. **Create `pipeline/utils/retry.py`** - Retry decorator with exponential backoff
3. **Create `pipeline/utils/circuit_breaker.py`** - CircuitBreaker class
4. **Create `pipeline/utils/rate_limiter.py`** - TokenBucketRateLimiter
5. **Create `pipeline/adapters/base.py`** - BaseAdapter abstract class
6. **Create `pipeline/adapters/builtwith.py`** - BuiltWithAdapter
7. **Create `pipeline/adapters/similarweb.py`** - SimilarWebAdapter
8. **Create `pipeline/adapters/yahoo_finance.py`** - YahooFinanceAdapter
9. **Create `pipeline/orchestrator.py`** - EnrichmentOrchestrator
10. **Create `pipeline/aggregator.py`** - ResultAggregator
11. **Create `pipeline/validators/schemas.py`** - Pydantic models

---

*Document created: 2026-02-25*
*Thread: 2 - Data Pipeline*
*Purpose: Data flow specifications for PartnerForge enrichment pipeline*
