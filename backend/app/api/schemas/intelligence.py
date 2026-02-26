"""
Pydantic Schemas for Intelligence Module Operations

Request/Response models for the 15 intelligence modules (M01-M15).

SOURCE CITATION MANDATE: Every response includes source_url and source_date.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any, List, Dict
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class ModuleFreshness(str, Enum):
    """Data freshness status."""
    FRESH = "fresh"
    STALE = "stale"
    EXPIRED = "expired"


class ModuleWave(int, Enum):
    """Enrichment wave number."""
    FOUNDATION = 1
    COMPETITIVE = 2
    BUYING_SIGNALS = 3
    SYNTHESIS = 4


# =============================================================================
# Source Citation (MANDATORY)
# =============================================================================

class SourceCitation(BaseModel):
    """
    Source citation for data provenance.

    HARD REQUIREMENT: Every data point must have a source.
    """
    url: Optional[str] = Field(None, description="Source URL (hyperlinked)")
    date: Optional[datetime] = Field(None, description="Source date (max 12 months old)")
    type: str = Field("api", description="Source type (api/webpage/document/transcript)")
    module: str = Field(..., description="Module that produced this data")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence score")


# =============================================================================
# Module Status
# =============================================================================

class ModuleStatus(BaseModel):
    """Status of a single intelligence module."""
    module_id: str = Field(..., description="Module ID (e.g., m01_company_context)")
    module_name: str = Field(..., description="Human-readable module name")
    status: str = Field(..., description="Status (available/not_enriched/unknown)")
    wave: int = Field(..., ge=1, le=4, description="Enrichment wave (1-4)")
    freshness: Optional[ModuleFreshness] = Field(None, description="Data freshness")
    last_updated: Optional[datetime] = Field(None, description="Last update timestamp")
    is_stale: bool = Field(False, description="Whether data is marked stale")
    description: Optional[str] = Field(None, description="Module description")
    source_citation: Optional[SourceCitation] = Field(None, description="Primary source")


class IntelligenceOverview(BaseModel):
    """Overview of all intelligence modules for a domain."""
    domain: str = Field(..., description="Company domain")
    modules: List[ModuleStatus] = Field(..., description="Status of all modules")
    modules_available: int = Field(..., description="Modules with data")
    modules_stale: int = Field(..., description="Modules with stale data")
    completeness_percent: float = Field(..., ge=0, le=100, description="Enrichment completeness")
    icp_score: Optional[int] = Field(None, description="ICP score if available")
    last_full_enrichment: Optional[datetime] = Field(None, description="Last full enrichment")


# =============================================================================
# Base Module Response
# =============================================================================

class BaseModuleResponse(BaseModel):
    """Base class for all module responses."""
    domain: str = Field(..., description="Company domain")
    module_id: str = Field(..., description="Module identifier")
    enriched_at: Optional[datetime] = Field(None, description="Enrichment timestamp")
    freshness: ModuleFreshness = Field(..., description="Data freshness status")
    source_citation: Optional[SourceCitation] = Field(None, description="Source citation")

    class Config:
        from_attributes = True


# =============================================================================
# Wave 1: Foundation Modules (M01-M04)
# =============================================================================

class CompanyContextResponse(BaseModuleResponse):
    """M01: Company Context response."""
    company_name: Optional[str] = Field(None, description="Company name")
    legal_name: Optional[str] = Field(None, description="Legal entity name")
    description: Optional[str] = Field(None, description="Company description")
    founded_year: Optional[int] = Field(None, description="Year founded")
    employee_count: Optional[int] = Field(None, description="Employee count")
    employee_range: Optional[str] = Field(None, description="Employee range (e.g., 1000-5000)")
    industry: Optional[str] = Field(None, description="Primary industry")
    vertical: Optional[str] = Field(None, description="Business vertical")
    sub_vertical: Optional[str] = Field(None, description="Sub-vertical")
    business_model: Optional[str] = Field(None, description="Business model (B2C/B2B/Marketplace)")
    headquarters_city: Optional[str] = Field(None, description="HQ city")
    headquarters_state: Optional[str] = Field(None, description="HQ state/region")
    headquarters_country: Optional[str] = Field(None, description="HQ country")
    regions_active: Optional[List[str]] = Field(None, description="Active regions")
    website_url: Optional[str] = Field(None, description="Website URL")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn URL")
    twitter_handle: Optional[str] = Field(None, description="Twitter handle")
    parent_company: Optional[str] = Field(None, description="Parent company name")
    brands: Optional[List[str]] = Field(None, description="Subsidiary brands")
    recent_news: Optional[List[Dict[str, Any]]] = Field(None, description="Recent news items")


class TechStackResponse(BaseModuleResponse):
    """M02: Technology Stack response."""
    tech_spend_estimate: Optional[int] = Field(None, description="Annual tech spend estimate")
    tech_spend_tier: Optional[str] = Field(None, description="Tech spend tier")
    total_technologies: Optional[int] = Field(None, description="Total technologies detected")
    partner_technologies: Optional[List[Dict[str, Any]]] = Field(None, description="Partner technologies")
    primary_partner: Optional[str] = Field(None, description="Primary partner technology")
    partner_score: Optional[int] = Field(None, ge=0, le=100, description="Partner tech score")
    competitor_technologies: Optional[List[Dict[str, Any]]] = Field(None, description="Competitor technologies")
    current_search_provider: Optional[str] = Field(None, description="Current search provider")
    has_algolia: bool = Field(False, description="Whether using Algolia")
    ecommerce_platform: Optional[str] = Field(None, description="E-commerce platform")
    payment_providers: Optional[List[str]] = Field(None, description="Payment providers")
    analytics_tools: Optional[List[str]] = Field(None, description="Analytics tools")
    full_stack: Optional[List[Dict[str, Any]]] = Field(None, description="Complete tech stack")


class TrafficAnalysisResponse(BaseModuleResponse):
    """M03: Traffic Analysis response."""
    monthly_visits: Optional[int] = Field(None, description="Monthly visits")
    monthly_visits_trend: Optional[float] = Field(None, description="Monthly visits trend (%)")
    unique_visitors: Optional[int] = Field(None, description="Unique visitors")
    global_rank: Optional[int] = Field(None, description="Global traffic rank")
    country_rank: Optional[int] = Field(None, description="Country traffic rank")
    pages_per_visit: Optional[float] = Field(None, description="Pages per visit")
    avg_visit_duration: Optional[int] = Field(None, description="Avg visit duration (seconds)")
    bounce_rate: Optional[float] = Field(None, description="Bounce rate")
    direct_traffic_pct: Optional[float] = Field(None, description="Direct traffic %")
    search_traffic_pct: Optional[float] = Field(None, description="Search traffic %")
    paid_search_pct: Optional[float] = Field(None, description="Paid search %")
    organic_search_pct: Optional[float] = Field(None, description="Organic search %")
    social_traffic_pct: Optional[float] = Field(None, description="Social traffic %")
    referral_traffic_pct: Optional[float] = Field(None, description="Referral traffic %")
    email_traffic_pct: Optional[float] = Field(None, description="Email traffic %")
    top_countries: Optional[List[Dict[str, Any]]] = Field(None, description="Top countries")
    desktop_pct: Optional[float] = Field(None, description="Desktop traffic %")
    mobile_pct: Optional[float] = Field(None, description="Mobile traffic %")
    top_organic_keywords: Optional[List[Dict[str, Any]]] = Field(None, description="Top organic keywords")
    top_paid_keywords: Optional[List[Dict[str, Any]]] = Field(None, description="Top paid keywords")


class FinancialProfileResponse(BaseModuleResponse):
    """M04: Financial Profile response."""
    ticker: Optional[str] = Field(None, description="Stock ticker")
    is_public: bool = Field(False, description="Is publicly traded")
    revenue_current: Optional[float] = Field(None, description="Current year revenue")
    revenue_prior_year: Optional[float] = Field(None, description="Prior year revenue")
    revenue_2_years_ago: Optional[float] = Field(None, description="Revenue 2 years ago")
    revenue_cagr: Optional[float] = Field(None, description="Revenue CAGR")
    fiscal_year_end: Optional[str] = Field(None, description="Fiscal year end")
    gross_margin: Optional[float] = Field(None, description="Gross margin %")
    operating_margin: Optional[float] = Field(None, description="Operating margin %")
    net_margin: Optional[float] = Field(None, description="Net margin %")
    ebitda: Optional[float] = Field(None, description="EBITDA")
    ebitda_margin: Optional[float] = Field(None, description="EBITDA margin %")
    margin_zone: Optional[str] = Field(None, description="Margin zone (green/yellow/red)")
    margin_pressure: bool = Field(False, description="Under margin pressure")
    ecommerce_revenue: Optional[float] = Field(None, description="E-commerce revenue")
    ecommerce_percent: Optional[float] = Field(None, description="E-commerce % of total")
    digital_revenue: Optional[float] = Field(None, description="Digital revenue")
    digital_percent: Optional[float] = Field(None, description="Digital % of total")
    market_cap: Optional[float] = Field(None, description="Market cap")
    stock_price: Optional[float] = Field(None, description="Current stock price")
    price_change_ytd: Optional[float] = Field(None, description="YTD price change %")
    price_change_1y: Optional[float] = Field(None, description="1-year price change %")
    analyst_rating: Optional[str] = Field(None, description="Analyst rating")
    analyst_target_price: Optional[float] = Field(None, description="Analyst target price")
    analyst_count: Optional[int] = Field(None, description="Number of analysts")
    addressable_revenue: Optional[float] = Field(None, description="Addressable revenue for Algolia")
    roi_scenario_low: Optional[float] = Field(None, description="ROI at 2% lift")
    roi_scenario_mid: Optional[float] = Field(None, description="ROI at 5% lift")
    roi_scenario_high: Optional[float] = Field(None, description="ROI at 10% lift")


# =============================================================================
# Wave 2: Competitive Modules (M05-M07)
# =============================================================================

class CompetitorIntelligenceResponse(BaseModuleResponse):
    """M05: Competitor Intelligence response."""
    competitors: Optional[List[Dict[str, Any]]] = Field(None, description="Competitor list")
    competitor_count: Optional[int] = Field(None, description="Number of competitors")
    competitors_with_algolia: Optional[List[Dict[str, Any]]] = Field(None, description="Competitors using Algolia")
    competitors_with_elasticsearch: Optional[List[Dict[str, Any]]] = Field(None, description="Competitors using Elasticsearch")
    competitors_with_coveo: Optional[List[Dict[str, Any]]] = Field(None, description="Competitors using Coveo")
    competitors_with_other: Optional[List[Dict[str, Any]]] = Field(None, description="Competitors using other search")
    market_position: Optional[str] = Field(None, description="Market position (leader/challenger/follower)")
    market_share_estimate: Optional[float] = Field(None, description="Market share estimate %")
    first_mover_opportunity: bool = Field(False, description="First-mover opportunity exists")
    competitive_pressure_score: Optional[int] = Field(None, ge=0, le=100, description="Competitive pressure score")
    displacement_angle: Optional[str] = Field(None, description="Displacement angle")


class HiringSignalsResponse(BaseModuleResponse):
    """M06: Hiring Signals response."""
    total_roles: Optional[int] = Field(None, description="Total open roles")
    hot_signals: Optional[int] = Field(None, description="Hot signal count")
    warm_signals: Optional[int] = Field(None, description="Warm signal count")
    caution_signals: Optional[int] = Field(None, description="Caution signal count")
    signals: Optional[List[Dict[str, Any]]] = Field(None, description="Detailed signals")
    signal_score: Optional[int] = Field(None, ge=0, le=100, description="Hiring signal score")
    vp_roles: Optional[List[Dict[str, Any]]] = Field(None, description="VP-level roles")
    director_roles: Optional[List[Dict[str, Any]]] = Field(None, description="Director-level roles")
    technical_roles: Optional[List[Dict[str, Any]]] = Field(None, description="Technical roles")
    search_keywords_found: bool = Field(False, description="Search-related keywords found")
    algolia_mentioned: bool = Field(False, description="Algolia mentioned in postings")
    elasticsearch_mentioned: bool = Field(False, description="Elasticsearch mentioned")
    budget_owner_hiring: bool = Field(False, description="Budget owner being hired")
    team_expansion: bool = Field(False, description="Team expansion indicated")
    careers_url: Optional[str] = Field(None, description="Careers page URL")


class StrategicContextResponse(BaseModuleResponse):
    """M07: Strategic Context response."""
    strategic_priorities: Optional[List[Dict[str, Any]]] = Field(None, description="Strategic priorities")
    digital_transformation: bool = Field(False, description="Digital transformation underway")
    platform_migration: bool = Field(False, description="Platform migration planned")
    trigger_events: Optional[List[Dict[str, Any]]] = Field(None, description="Trigger events")
    trigger_score: Optional[int] = Field(None, ge=0, le=100, description="Trigger event score")
    recent_announcements: Optional[List[Dict[str, Any]]] = Field(None, description="Recent announcements")
    press_releases: Optional[List[Dict[str, Any]]] = Field(None, description="Press releases")
    leadership_changes: Optional[List[Dict[str, Any]]] = Field(None, description="Leadership changes")
    industry_trends: Optional[List[Dict[str, Any]]] = Field(None, description="Industry trends")
    regulatory_factors: Optional[List[Dict[str, Any]]] = Field(None, description="Regulatory factors")
    fiscal_year_end: Optional[str] = Field(None, description="Fiscal year end")
    budget_cycle: Optional[str] = Field(None, description="Budget cycle timing")
    renewal_timing: Optional[str] = Field(None, description="Potential renewal timing")


# =============================================================================
# Wave 3: Buying Signals Modules (M08-M11)
# =============================================================================

class InvestorIntelligenceResponse(BaseModuleResponse):
    """M08: Investor Intelligence response."""
    latest_10k_date: Optional[datetime] = Field(None, description="Latest 10-K filing date")
    latest_10q_date: Optional[datetime] = Field(None, description="Latest 10-Q filing date")
    sec_risk_factors: Optional[List[Dict[str, Any]]] = Field(None, description="SEC risk factors")
    sec_digital_mentions: Optional[List[Dict[str, Any]]] = Field(None, description="Digital mentions in filings")
    latest_earnings_date: Optional[datetime] = Field(None, description="Latest earnings call date")
    earnings_themes: Optional[List[Dict[str, Any]]] = Field(None, description="Earnings call themes")
    analyst_questions: Optional[List[Dict[str, Any]]] = Field(None, description="Analyst Q&A highlights")
    investor_day_date: Optional[datetime] = Field(None, description="Investor day date")
    strategic_initiatives: Optional[List[Dict[str, Any]]] = Field(None, description="Strategic initiatives")
    executive_quotes: Optional[List[Dict[str, Any]]] = Field(None, description="Executive quotes")


class ExecutiveIntelligenceResponse(BaseModuleResponse):
    """M09: Executive Intelligence response."""
    executives: Optional[List[Dict[str, Any]]] = Field(None, description="Executive roster")
    quotes: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Quotes with attribution (speaker, title, source_url, date, maps_to)"
    )
    digital_transformation_mentions: int = Field(0, description="Digital transformation mention count")
    customer_experience_mentions: int = Field(0, description="Customer experience mention count")
    search_mentions: int = Field(0, description="Search mention count")
    conversion_mentions: int = Field(0, description="Conversion mention count")
    personalization_mentions: int = Field(0, description="Personalization mention count")
    key_themes: Optional[List[str]] = Field(None, description="Key themes identified")
    algolia_mapping: Optional[Dict[str, Any]] = Field(None, description="Mapping to Algolia products")


class BuyingCommitteeResponse(BaseModuleResponse):
    """M10: Buying Committee response."""
    members: Optional[List[Dict[str, Any]]] = Field(None, description="Committee members")
    economic_buyer: Optional[Dict[str, Any]] = Field(None, description="Economic buyer")
    technical_buyer: Optional[Dict[str, Any]] = Field(None, description="Technical buyer")
    user_buyer: Optional[Dict[str, Any]] = Field(None, description="User buyer")
    champion: Optional[Dict[str, Any]] = Field(None, description="Internal champion")
    hot_contacts: Optional[List[Dict[str, Any]]] = Field(None, description="Hot contacts")
    warm_contacts: Optional[List[Dict[str, Any]]] = Field(None, description="Warm contacts")
    cold_contacts: Optional[List[Dict[str, Any]]] = Field(None, description="Cold contacts")
    total_contacts: Optional[int] = Field(None, description="Total contacts found")
    contacts_with_linkedin: Optional[int] = Field(None, description="Contacts with LinkedIn")
    contacts_with_email: Optional[int] = Field(None, description="Contacts with email")


class DisplacementAnalysisResponse(BaseModuleResponse):
    """M11: Displacement Analysis response."""
    current_search_provider: Optional[str] = Field(None, description="Current search provider")
    current_search_stack: Optional[List[Dict[str, Any]]] = Field(None, description="Current search stack")
    estimated_current_spend: Optional[float] = Field(None, description="Estimated current spend")
    displacement_score: Optional[int] = Field(None, ge=0, le=100, description="Displacement opportunity score")
    displacement_difficulty: Optional[str] = Field(None, description="Displacement difficulty (easy/medium/hard)")
    displacement_timeline: Optional[str] = Field(None, description="Displacement timeline")
    primary_angle: Optional[str] = Field(None, description="Primary displacement angle")
    secondary_angles: Optional[List[str]] = Field(None, description="Secondary angles")
    algolia_advantages: Optional[List[str]] = Field(None, description="Algolia advantages")
    competitor_weaknesses: Optional[List[str]] = Field(None, description="Competitor weaknesses")
    switching_barriers: Optional[List[str]] = Field(None, description="Switching barriers")
    risk_factors: Optional[List[str]] = Field(None, description="Risk factors")


# =============================================================================
# Wave 4: Synthesis Modules (M12-M15)
# =============================================================================

class CaseStudyMatchesResponse(BaseModuleResponse):
    """M12: Case Study Matches response."""
    matches: Optional[List[Dict[str, Any]]] = Field(None, description="Matched case studies")
    total_matches: Optional[int] = Field(None, description="Total matches")
    vertical_matches: Optional[int] = Field(None, description="Vertical matches")
    use_case_matches: Optional[int] = Field(None, description="Use case matches")
    competitor_takeout_matches: Optional[int] = Field(None, description="Competitor takeout matches")
    primary_match: Optional[Dict[str, Any]] = Field(None, description="Primary match")
    secondary_matches: Optional[List[Dict[str, Any]]] = Field(None, description="Secondary matches")
    relevant_proof_points: Optional[List[Dict[str, Any]]] = Field(None, description="Relevant proof points")
    relevant_quotes: Optional[List[Dict[str, Any]]] = Field(None, description="Relevant quotes")


class ICPPriorityResponse(BaseModuleResponse):
    """M13: ICP Priority Mapping response."""
    icp_score: Optional[int] = Field(None, ge=0, le=100, description="ICP score")
    icp_tier: Optional[str] = Field(None, description="ICP tier (hot/warm/cool/cold)")
    vertical_score: Optional[int] = Field(None, description="Vertical component score")
    traffic_score: Optional[int] = Field(None, description="Traffic component score")
    tech_spend_score: Optional[int] = Field(None, description="Tech spend component score")
    partner_tech_score: Optional[int] = Field(None, description="Partner tech component score")
    score_breakdown: Optional[Dict[str, Any]] = Field(None, description="Detailed score breakdown")
    score_reasons: Optional[List[str]] = Field(None, description="Score reasoning")
    timing_factor: Optional[float] = Field(None, description="Timing multiplier")
    competitive_factor: Optional[float] = Field(None, description="Competitive multiplier")
    budget_factor: Optional[float] = Field(None, description="Budget multiplier")
    priority_score: Optional[int] = Field(None, description="Final priority score")
    priority_rank: Optional[int] = Field(None, description="Priority rank")


class SignalScoringResponse(BaseModuleResponse):
    """M14: Signal Scoring response."""
    signal_score: Optional[int] = Field(None, ge=0, le=100, description="Overall signal score")
    signal_tier: Optional[str] = Field(None, description="Signal tier")
    hiring_signal_score: Optional[int] = Field(None, description="Hiring signal component")
    executive_signal_score: Optional[int] = Field(None, description="Executive signal component")
    financial_signal_score: Optional[int] = Field(None, description="Financial signal component")
    competitive_signal_score: Optional[int] = Field(None, description="Competitive signal component")
    trigger_signal_score: Optional[int] = Field(None, description="Trigger signal component")
    top_signals: Optional[List[Dict[str, Any]]] = Field(None, description="Top signals")
    signal_summary: Optional[str] = Field(None, description="Signal summary")
    urgency_score: Optional[int] = Field(None, description="Urgency score")
    optimal_timing: Optional[str] = Field(None, description="Optimal timing")
    recommended_actions: Optional[List[str]] = Field(None, description="Recommended actions")


class StrategicBriefResponse(BaseModuleResponse):
    """M15: Strategic Signal Brief response."""
    brief_version: int = Field(1, description="Brief version number")
    generated_at: Optional[datetime] = Field(None, description="Generation timestamp")
    sixty_second_story: Optional[str] = Field(None, description="60-second story")
    company_snapshot: Optional[Dict[str, Any]] = Field(None, description="Company snapshot")
    timing_signals: Optional[Dict[str, Any]] = Field(None, description="Timing signals")
    in_their_own_words: Optional[List[Dict[str, Any]]] = Field(None, description="Executive quotes section")
    people: Optional[Dict[str, Any]] = Field(None, description="Buying committee")
    money: Optional[Dict[str, Any]] = Field(None, description="Financial context")
    gaps: Optional[Dict[str, Any]] = Field(None, description="Current state gaps")
    competitive_landscape: Optional[Dict[str, Any]] = Field(None, description="Competitive landscape")
    recommended_approach: Optional[str] = Field(None, description="Recommended approach")
    discovery_questions: Optional[List[str]] = Field(None, description="Discovery questions")
    objection_handling: Optional[List[Dict[str, Any]]] = Field(None, description="Objection handling")
    case_study_matches: Optional[List[Dict[str, Any]]] = Field(None, description="Case study matches")
    full_brief_markdown: Optional[str] = Field(None, description="Full brief in markdown")
    is_approved: bool = Field(False, description="Whether brief is approved")
    approved_by: Optional[str] = Field(None, description="Approver name")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")


# =============================================================================
# Full Intelligence Response
# =============================================================================

class FullIntelligenceResponse(BaseModel):
    """All intelligence modules for a domain."""
    domain: str = Field(..., description="Company domain")
    company_name: Optional[str] = Field(None, description="Company name")
    icp_score: Optional[int] = Field(None, description="ICP score")
    icp_tier: Optional[str] = Field(None, description="ICP tier")
    modules: Dict[str, Dict[str, Any]] = Field(..., description="Module data keyed by module_id")
    modules_available: int = Field(..., description="Number of modules with data")
    modules_total: int = Field(..., description="Total number of modules")
    completeness_percent: float = Field(..., ge=0, le=100, description="Enrichment completeness")
    source_citations: List[SourceCitation] = Field(
        default_factory=list,
        description="Source citations for all modules"
    )

    class Config:
        from_attributes = True
