"""
Intelligence Module Models - 15 Module Tables

These tables store outputs from the 15 intelligence modules,
organized by execution wave.

Wave 1 (Foundation):
- intel_company_context (M01)
- intel_technology_stack (M02)
- intel_traffic_analysis (M03)
- intel_financial_profile (M04)

Wave 2 (Competitive):
- intel_competitor_intelligence (M05)
- intel_hiring_signals (M06)
- intel_strategic_context (M07)

Wave 3 (Buying Signals):
- intel_investor_intelligence (M08)
- intel_executive_intelligence (M09)
- intel_buying_committee (M10)
- intel_displacement_analysis (M11)

Wave 4 (Synthesis):
- intel_case_study_matches (M12)
- intel_icp_priority_mapping (M13)
- intel_signal_scoring (M14)
- intel_strategic_signal_briefs (M15)

SOURCE CITATION MANDATE: Every table has:
- source_url: Primary source URL (REQUIRED)
- source_date: Date of source (REQUIRED, max 12 months old)
- source_type: Type of source (api, webpage, document, transcript)
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, JSON, Index,
    CheckConstraint
)
from datetime import datetime
from typing import Optional, Dict, Any

from ..database import Base


# =============================================================================
# Base mixin for source citation
# =============================================================================

class SourceCitationMixin:
    """
    Mixin for source citation fields.

    Every intelligence table MUST include these fields.
    """
    source_url = Column(String(1000), nullable=False)  # REQUIRED
    source_date = Column(DateTime, nullable=False)  # REQUIRED, max 12 months old
    source_type = Column(String(50), default="api")  # api, webpage, document, transcript

    enriched_at = Column(DateTime, default=datetime.utcnow)
    is_stale = Column(Boolean, default=False)
    confidence_score = Column(Float, default=1.0)  # 0.0 to 1.0


# =============================================================================
# Wave 1: Foundation Modules
# =============================================================================

class IntelCompanyContext(Base, SourceCitationMixin):
    """
    M01: Company Context - baseline company information.

    Captures foundational company data including industry, size,
    geography, and business model.
    """
    __tablename__ = "intel_company_context"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Company basics
    company_name = Column(String(255))
    legal_name = Column(String(255))
    description = Column(Text)
    founded_year = Column(Integer)
    employee_count = Column(Integer)
    employee_range = Column(String(50))  # "1000-5000"

    # Classification
    industry = Column(String(100))
    vertical = Column(String(100))
    sub_vertical = Column(String(100))
    business_model = Column(String(100))  # B2C, B2B, Marketplace

    # Geography
    headquarters_city = Column(String(100))
    headquarters_state = Column(String(100))
    headquarters_country = Column(String(100))
    regions_active = Column(JSON)  # ["NA", "EMEA", "APAC"]

    # Online presence
    website_url = Column(String(500))
    linkedin_url = Column(String(500))
    twitter_handle = Column(String(100))

    # Additional context
    parent_company = Column(String(255))
    brands = Column(JSON)  # Subsidiary brands
    recent_news = Column(JSON)  # Array of news items

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelTechnologyStack(Base, SourceCitationMixin):
    """
    M02: Technology Stack - detected technologies from BuiltWith.

    Captures the full technology stack with partner and competitor flags.
    """
    __tablename__ = "intel_technology_stack"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Technology summary
    tech_spend_estimate = Column(Integer)  # Annual tech spend
    tech_spend_tier = Column(String(50))  # "$100K+", "$50K-100K"
    total_technologies = Column(Integer)

    # Partner technologies (opportunity)
    partner_technologies = Column(JSON)  # [{"name": "Adobe AEM", "category": "CMS"}]
    primary_partner = Column(String(100))
    partner_score = Column(Integer)  # 0-100

    # Competitor technologies (displacement)
    competitor_technologies = Column(JSON)  # [{"name": "Elasticsearch", "category": "Search"}]
    current_search_provider = Column(String(100))
    has_algolia = Column(Boolean, default=False)

    # E-commerce stack
    ecommerce_platform = Column(String(100))
    payment_providers = Column(JSON)
    analytics_tools = Column(JSON)

    # Full tech stack
    full_stack = Column(JSON)  # Complete technology list

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelTrafficAnalysis(Base, SourceCitationMixin):
    """
    M03: Traffic Analysis - traffic data from SimilarWeb.

    Captures website traffic metrics and trends.
    """
    __tablename__ = "intel_traffic_analysis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Traffic volume
    monthly_visits = Column(Integer)
    monthly_visits_trend = Column(Float)  # % change
    unique_visitors = Column(Integer)
    global_rank = Column(Integer)
    country_rank = Column(Integer)

    # Engagement
    pages_per_visit = Column(Float)
    avg_visit_duration = Column(Integer)  # seconds
    bounce_rate = Column(Float)

    # Traffic sources
    direct_traffic_pct = Column(Float)
    search_traffic_pct = Column(Float)
    paid_search_pct = Column(Float)
    organic_search_pct = Column(Float)
    social_traffic_pct = Column(Float)
    referral_traffic_pct = Column(Float)
    email_traffic_pct = Column(Float)

    # Geographic distribution
    top_countries = Column(JSON)  # [{"country": "US", "pct": 45.2}]

    # Device split
    desktop_pct = Column(Float)
    mobile_pct = Column(Float)

    # Search keywords
    top_organic_keywords = Column(JSON)
    top_paid_keywords = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelFinancialProfile(Base, SourceCitationMixin):
    """
    M04: Financial Profile - revenue, margins, ROI estimates.

    Captures financial data and calculates Algolia ROI potential.
    """
    __tablename__ = "intel_financial_profile"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Company identification
    ticker = Column(String(20))
    is_public = Column(Boolean, default=False)

    # Revenue (3-year trend)
    revenue_current = Column(Float)
    revenue_prior_year = Column(Float)
    revenue_2_years_ago = Column(Float)
    revenue_cagr = Column(Float)
    fiscal_year_end = Column(String(20))

    # Profitability
    gross_margin = Column(Float)
    operating_margin = Column(Float)
    net_margin = Column(Float)
    ebitda = Column(Float)
    ebitda_margin = Column(Float)

    # Margin zone analysis
    margin_zone = Column(String(20))  # 'green' (>20%), 'yellow' (10-20%), 'red' (<=10%)
    margin_pressure = Column(Boolean, default=False)

    # E-commerce specific
    ecommerce_revenue = Column(Float)
    ecommerce_percent = Column(Float)
    digital_revenue = Column(Float)
    digital_percent = Column(Float)

    # Stock metrics (if public)
    market_cap = Column(Float)
    stock_price = Column(Float)
    price_change_ytd = Column(Float)
    price_change_1y = Column(Float)

    # Analyst sentiment
    analyst_rating = Column(String(50))
    analyst_target_price = Column(Float)
    analyst_count = Column(Integer)

    # ROI calculation
    addressable_revenue = Column(Float)  # Digital Revenue × 15%
    roi_scenario_low = Column(Float)  # 2% lift
    roi_scenario_mid = Column(Float)  # 5% lift
    roi_scenario_high = Column(Float)  # 10% lift

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Wave 2: Competitive Modules
# =============================================================================

class IntelCompetitorIntelligence(Base, SourceCitationMixin):
    """
    M05: Competitor Intelligence - competitive landscape.

    Analyzes competitors' search providers and identifies displacement angles.
    """
    __tablename__ = "intel_competitor_intelligence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Competitor list
    competitors = Column(JSON)  # [{"domain": "...", "similarity": 0.85}]
    competitor_count = Column(Integer)

    # Search provider analysis
    competitors_with_algolia = Column(JSON)  # Competitors using Algolia
    competitors_with_elasticsearch = Column(JSON)
    competitors_with_coveo = Column(JSON)
    competitors_with_other = Column(JSON)

    # Market position
    market_position = Column(String(50))  # leader, challenger, follower
    market_share_estimate = Column(Float)

    # Displacement opportunities
    first_mover_opportunity = Column(Boolean, default=False)
    competitive_pressure_score = Column(Integer)  # 0-100
    displacement_angle = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelHiringSignals(Base, SourceCitationMixin):
    """
    M06: Hiring Signals - job postings and talent acquisition.

    Captures hiring patterns that indicate buying readiness.
    """
    __tablename__ = "intel_hiring_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Summary metrics
    total_roles = Column(Integer)
    hot_signals = Column(Integer)
    warm_signals = Column(Integer)
    caution_signals = Column(Integer)

    # Signal breakdown
    signals = Column(JSON)  # Array of detailed signals
    signal_score = Column(Integer)  # 0-100

    # Key roles
    vp_roles = Column(JSON)
    director_roles = Column(JSON)
    technical_roles = Column(JSON)

    # Keywords found
    search_keywords_found = Column(Boolean, default=False)
    algolia_mentioned = Column(Boolean, default=False)
    elasticsearch_mentioned = Column(Boolean, default=False)

    # Buying committee indicators
    budget_owner_hiring = Column(Boolean, default=False)
    team_expansion = Column(Boolean, default=False)

    # Source
    careers_url = Column(String(500))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelStrategicContext(Base, SourceCitationMixin):
    """
    M07: Strategic Context - market position and strategy.

    Captures strategic initiatives and trigger events.
    """
    __tablename__ = "intel_strategic_context"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Strategic priorities
    strategic_priorities = Column(JSON)  # Array of priorities
    digital_transformation = Column(Boolean, default=False)
    platform_migration = Column(Boolean, default=False)

    # Trigger events
    trigger_events = Column(JSON)  # Array of events
    trigger_score = Column(Integer)  # 0-100

    # Recent news
    recent_announcements = Column(JSON)
    press_releases = Column(JSON)

    # Leadership changes
    leadership_changes = Column(JSON)

    # Market context
    industry_trends = Column(JSON)
    regulatory_factors = Column(JSON)

    # Timing signals
    fiscal_year_end = Column(String(20))
    budget_cycle = Column(String(50))
    renewal_timing = Column(String(100))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Wave 3: Buying Signals Modules
# =============================================================================

class IntelInvestorIntelligence(Base, SourceCitationMixin):
    """
    M08: Investor Intelligence - SEC filings and investor presentations.

    Captures investor-focused intelligence including SEC filings,
    earnings call themes, and investor day content.
    """
    __tablename__ = "intel_investor_intelligence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # SEC filings
    latest_10k_date = Column(DateTime)
    latest_10q_date = Column(DateTime)
    sec_risk_factors = Column(JSON)  # Relevant risk factors
    sec_digital_mentions = Column(JSON)  # Digital/search mentions in filings

    # Earnings calls
    latest_earnings_date = Column(DateTime)
    earnings_themes = Column(JSON)  # Key themes discussed
    analyst_questions = Column(JSON)  # Relevant analyst Q&A

    # Investor presentations
    investor_day_date = Column(DateTime)
    strategic_initiatives = Column(JSON)

    # Key quotes
    executive_quotes = Column(JSON)  # Array of attributed quotes

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelExecutiveIntelligence(Base, SourceCitationMixin):
    """
    M09: Executive Intelligence - executive quotes and themes.

    SOURCE CITATION MANDATE: Every quote MUST have:
    - Speaker name and title
    - Source type, name, and URL
    - Date (within 12 months)
    """
    __tablename__ = "intel_executive_intelligence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Executive roster
    executives = Column(JSON)  # Array of executives with titles

    # Quotes with full attribution
    quotes = Column(JSON)  # Array of {speaker, title, quote, source_type, source_url, date, maps_to}

    # Themes
    digital_transformation_mentions = Column(Integer, default=0)
    customer_experience_mentions = Column(Integer, default=0)
    search_mentions = Column(Integer, default=0)
    conversion_mentions = Column(Integer, default=0)
    personalization_mentions = Column(Integer, default=0)

    # Summary
    key_themes = Column(JSON)
    algolia_mapping = Column(JSON)  # How quotes map to Algolia products

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelBuyingCommittee(Base, SourceCitationMixin):
    """
    M10: Buying Committee - key decision makers.

    Identifies and profiles buying committee members.
    """
    __tablename__ = "intel_buying_committee"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Committee members
    members = Column(JSON)  # Array of member profiles

    # Role classification
    economic_buyer = Column(JSON)  # Budget authority
    technical_buyer = Column(JSON)  # Technical evaluator
    user_buyer = Column(JSON)  # End user
    champion = Column(JSON)  # Internal champion

    # Prioritization
    hot_contacts = Column(JSON)
    warm_contacts = Column(JSON)
    cold_contacts = Column(JSON)

    # Contact stats
    total_contacts = Column(Integer)
    contacts_with_linkedin = Column(Integer)
    contacts_with_email = Column(Integer)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelDisplacementAnalysis(Base, SourceCitationMixin):
    """
    M11: Displacement Analysis - competitive displacement opportunity.

    Synthesizes competitive data into displacement strategy.
    """
    __tablename__ = "intel_displacement_analysis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Current state
    current_search_provider = Column(String(100))
    current_search_stack = Column(JSON)
    estimated_current_spend = Column(Float)

    # Displacement opportunity
    displacement_score = Column(Integer)  # 0-100
    displacement_difficulty = Column(String(50))  # easy, medium, hard
    displacement_timeline = Column(String(50))  # immediate, 3-6mo, 6-12mo

    # Displacement angles
    primary_angle = Column(Text)
    secondary_angles = Column(JSON)

    # Competitive advantages
    algolia_advantages = Column(JSON)
    competitor_weaknesses = Column(JSON)

    # Risk factors
    switching_barriers = Column(JSON)
    risk_factors = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Wave 4: Synthesis Modules
# =============================================================================

class IntelCaseStudyMatches(Base, SourceCitationMixin):
    """
    M12: Case Study Matching - relevant Algolia case studies.

    Matches target to relevant customer success stories.
    """
    __tablename__ = "intel_case_study_matches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Matched case studies
    matches = Column(JSON)  # Array of {company, url, relevance_score, match_reasons}

    # Match statistics
    total_matches = Column(Integer)
    vertical_matches = Column(Integer)
    use_case_matches = Column(Integer)
    competitor_takeout_matches = Column(Integer)

    # Top matches
    primary_match = Column(JSON)
    secondary_matches = Column(JSON)

    # Proof points
    relevant_proof_points = Column(JSON)
    relevant_quotes = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelICPPriorityMapping(Base, SourceCitationMixin):
    """
    M13: ICP-Priority Mapping - ICP fit score and breakdown.

    Calculates ICP fit and priority tier.
    """
    __tablename__ = "intel_icp_priority_mapping"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # ICP Score
    icp_score = Column(Integer)  # 0-100
    icp_tier = Column(String(20))  # hot, warm, cool, cold

    # Score breakdown
    vertical_score = Column(Integer)
    traffic_score = Column(Integer)
    tech_spend_score = Column(Integer)
    partner_tech_score = Column(Integer)

    # Detailed breakdown
    score_breakdown = Column(JSON)
    score_reasons = Column(JSON)

    # Priority factors
    timing_factor = Column(Float)  # Multiplier based on triggers
    competitive_factor = Column(Float)  # Multiplier based on competition
    budget_factor = Column(Float)  # Multiplier based on financials

    # Final priority
    priority_score = Column(Integer)  # Adjusted score
    priority_rank = Column(Integer)  # Rank among all targets

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelSignalScoring(Base, SourceCitationMixin):
    """
    M14: Signal Scoring - aggregated signal score.

    Aggregates all signals into a single score.
    """
    __tablename__ = "intel_signal_scoring"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Overall score
    signal_score = Column(Integer)  # 0-100
    signal_tier = Column(String(20))  # hot, warm, cool, cold

    # Component scores
    hiring_signal_score = Column(Integer)
    executive_signal_score = Column(Integer)
    financial_signal_score = Column(Integer)
    competitive_signal_score = Column(Integer)
    trigger_signal_score = Column(Integer)

    # Top signals
    top_signals = Column(JSON)  # Array of strongest signals
    signal_summary = Column(Text)

    # Timing
    urgency_score = Column(Integer)  # How urgent is outreach
    optimal_timing = Column(String(100))

    # Recommended actions
    recommended_actions = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntelStrategicSignalBrief(Base, SourceCitationMixin):
    """
    M15: Strategic Signal Brief - final brief for sales.

    The capstone output combining all intelligence into
    an actionable sales brief.
    """
    __tablename__ = "intel_strategic_signal_briefs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)

    # Brief metadata
    brief_version = Column(Integer, default=1)
    generated_at = Column(DateTime, default=datetime.utcnow)

    # 60-second story
    sixty_second_story = Column(Text)

    # Key sections
    company_snapshot = Column(JSON)
    timing_signals = Column(JSON)
    in_their_own_words = Column(JSON)  # Executive quotes
    people = Column(JSON)  # Buying committee
    money = Column(JSON)  # Financial context
    gaps = Column(JSON)  # Current state gaps
    competitive_landscape = Column(JSON)

    # Recommendations
    recommended_approach = Column(Text)
    discovery_questions = Column(JSON)
    objection_handling = Column(JSON)

    # Case study matches
    case_study_matches = Column(JSON)

    # Full brief (markdown)
    full_brief_markdown = Column(Text)

    # Status
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String(255))
    approved_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
