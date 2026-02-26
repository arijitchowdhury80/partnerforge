"""
Intelligence API Endpoints

Provides access to 15 intelligence modules (M01-M15) for domains.

Endpoints:
- GET /api/v1/intel/{domain}/company     - M01: Company Context
- GET /api/v1/intel/{domain}/techstack   - M02: Tech Stack
- GET /api/v1/intel/{domain}/traffic     - M03: Traffic Analysis
- GET /api/v1/intel/{domain}/financials  - M04: Financial Profile
- GET /api/v1/intel/{domain}/competitors - M05: Competitor Intelligence
- GET /api/v1/intel/{domain}/hiring      - M06: Hiring Signals
- GET /api/v1/intel/{domain}/strategic   - M07: Strategic Context
- GET /api/v1/intel/{domain}/investor    - M08: Investor Intelligence
- GET /api/v1/intel/{domain}/executives  - M09: Executive Intelligence
- GET /api/v1/intel/{domain}/buying-committee - M10: Buying Committee
- GET /api/v1/intel/{domain}/displacement - M11: Displacement Analysis
- GET /api/v1/intel/{domain}/case-studies - M12: Case Study Matches
- GET /api/v1/intel/{domain}/icp         - M13: ICP Priority Mapping
- GET /api/v1/intel/{domain}/signals     - M14: Signal Scoring
- GET /api/v1/intel/{domain}/brief       - M15: Strategic Signal Brief
- GET /api/v1/intel/{domain}/full        - All modules combined
- GET /api/v1/intel/{domain}             - Module overview

SOURCE CITATION MANDATE: All responses include source_url and source_date.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import logging

from ..deps import get_db, get_current_user, CurrentUser
from ..schemas.intelligence import (
    # Module response schemas
    IntelligenceOverview,
    ModuleStatus,
    ModuleFreshness,
    # M01-M04 Foundation
    CompanyContextResponse,
    TechStackResponse,
    TrafficAnalysisResponse,
    FinancialProfileResponse,
    # M05-M07 Competitive
    CompetitorIntelligenceResponse,
    HiringSignalsResponse,
    StrategicContextResponse,
    # M08-M11 Buying Signals
    InvestorIntelligenceResponse,
    ExecutiveIntelligenceResponse,
    BuyingCommitteeResponse,
    DisplacementAnalysisResponse,
    # M12-M15 Synthesis
    CaseStudyMatchesResponse,
    ICPPriorityResponse,
    SignalScoringResponse,
    StrategicBriefResponse,
    # Full intelligence
    FullIntelligenceResponse,
    # Source citation
    SourceCitation,
)
from ...models import (
    IntelCompanyContext,
    IntelTechnologyStack,
    IntelTrafficAnalysis,
    IntelFinancialProfile,
    IntelCompetitorIntelligence,
    IntelHiringSignals,
    IntelStrategicContext,
    IntelInvestorIntelligence,
    IntelExecutiveIntelligence,
    IntelBuyingCommittee,
    IntelDisplacementAnalysis,
    IntelCaseStudyMatches,
    IntelICPPriorityMapping,
    IntelSignalScoring,
    IntelStrategicSignalBrief,
    get_intel_model_by_module_id,
)
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intel", tags=["Intelligence"])
settings = get_settings()


# =============================================================================
# Module Definitions
# =============================================================================

MODULE_METADATA = {
    "m01_company_context": {
        "name": "Company Context",
        "wave": 1,
        "model": IntelCompanyContext,
        "freshness_days": 30,
        "description": "Basic company information and context",
    },
    "m02_tech_stack": {
        "name": "Tech Stack Analysis",
        "wave": 1,
        "model": IntelTechnologyStack,
        "freshness_days": 7,
        "description": "Technology stack including search provider",
    },
    "m03_traffic": {
        "name": "Traffic Intelligence",
        "wave": 1,
        "model": IntelTrafficAnalysis,
        "freshness_days": 7,
        "description": "Traffic metrics and sources",
    },
    "m04_financials": {
        "name": "Financial Profile",
        "wave": 1,
        "model": IntelFinancialProfile,
        "freshness_days": 1,
        "description": "Public financial information",
    },
    "m05_competitors": {
        "name": "Competitor Intelligence",
        "wave": 2,
        "model": IntelCompetitorIntelligence,
        "freshness_days": 30,
        "description": "Competitive landscape analysis",
    },
    "m06_hiring": {
        "name": "Hiring Signals",
        "wave": 2,
        "model": IntelHiringSignals,
        "freshness_days": 7,
        "description": "Job postings and hiring patterns",
    },
    "m07_strategic": {
        "name": "Strategic Context",
        "wave": 2,
        "model": IntelStrategicContext,
        "freshness_days": 30,
        "description": "Strategic initiatives and triggers",
    },
    "m08_investor": {
        "name": "Investor Intelligence",
        "wave": 3,
        "model": IntelInvestorIntelligence,
        "freshness_days": 30,
        "description": "SEC filings and investor presentations",
    },
    "m09_executive": {
        "name": "Executive Intelligence",
        "wave": 3,
        "model": IntelExecutiveIntelligence,
        "freshness_days": 30,
        "description": "Executive quotes and themes",
    },
    "m10_buying_committee": {
        "name": "Buying Committee",
        "wave": 3,
        "model": IntelBuyingCommittee,
        "freshness_days": 30,
        "description": "Key decision makers",
    },
    "m11_displacement": {
        "name": "Displacement Analysis",
        "wave": 3,
        "model": IntelDisplacementAnalysis,
        "freshness_days": 7,
        "description": "Competitive displacement opportunity",
    },
    "m12_case_study": {
        "name": "Case Study Matching",
        "wave": 4,
        "model": IntelCaseStudyMatches,
        "freshness_days": 90,
        "description": "Relevant Algolia case studies",
    },
    "m13_icp_priority": {
        "name": "ICP Priority Mapping",
        "wave": 4,
        "model": IntelICPPriorityMapping,
        "freshness_days": 30,
        "description": "ICP fit score calculation",
    },
    "m14_signal_scoring": {
        "name": "Signal Scoring",
        "wave": 4,
        "model": IntelSignalScoring,
        "freshness_days": 7,
        "description": "Aggregated signal score",
    },
    "m15_strategic_brief": {
        "name": "Strategic Signal Brief",
        "wave": 4,
        "model": IntelStrategicSignalBrief,
        "freshness_days": 7,
        "description": "Synthesized strategic brief",
    },
}


# =============================================================================
# Helper Functions
# =============================================================================

def _normalize_domain(domain: str) -> str:
    """Normalize domain format."""
    d = domain.strip().lower()
    d = d.replace("https://", "").replace("http://", "")
    d = d.replace("www.", "").rstrip("/")
    return d


def _calculate_freshness(enriched_at: Optional[datetime], freshness_days: int) -> ModuleFreshness:
    """Calculate data freshness status."""
    if enriched_at is None:
        return ModuleFreshness.EXPIRED

    now = datetime.utcnow()
    age = (now - enriched_at).days

    if age <= freshness_days:
        return ModuleFreshness.FRESH
    elif age <= freshness_days * 2:
        return ModuleFreshness.STALE
    else:
        return ModuleFreshness.EXPIRED


def _build_source_citation(record: Any, module_id: str) -> Optional[SourceCitation]:
    """Build source citation from record."""
    if record is None:
        return None

    return SourceCitation(
        url=getattr(record, "source_url", None),
        date=getattr(record, "source_date", None),
        type=getattr(record, "source_type", "api"),
        module=module_id,
        confidence=getattr(record, "confidence_score", 1.0),
    )


async def _get_module_data(
    db: AsyncSession,
    domain: str,
    module_id: str,
) -> Optional[Any]:
    """Get module data from database."""
    metadata = MODULE_METADATA.get(module_id)
    if not metadata:
        return None

    model = metadata["model"]
    result = await db.execute(
        select(model).where(model.domain == domain)
    )
    return result.scalar_one_or_none()


async def _get_module_status(
    db: AsyncSession,
    domain: str,
    module_id: str,
) -> ModuleStatus:
    """Get status of a single module."""
    metadata = MODULE_METADATA.get(module_id)
    if not metadata:
        return ModuleStatus(
            module_id=module_id,
            module_name="Unknown",
            status="unknown",
            wave=0,
        )

    record = await _get_module_data(db, domain, module_id)

    if record is None:
        return ModuleStatus(
            module_id=module_id,
            module_name=metadata["name"],
            status="not_enriched",
            wave=metadata["wave"],
            description=metadata["description"],
        )

    freshness = _calculate_freshness(
        getattr(record, "enriched_at", None),
        metadata["freshness_days"]
    )

    return ModuleStatus(
        module_id=module_id,
        module_name=metadata["name"],
        status="available",
        wave=metadata["wave"],
        freshness=freshness,
        last_updated=getattr(record, "enriched_at", None),
        is_stale=getattr(record, "is_stale", False),
        description=metadata["description"],
        source_citation=_build_source_citation(record, module_id),
    )


# =============================================================================
# Overview Endpoint
# =============================================================================

@router.get("/{domain}", response_model=IntelligenceOverview)
async def get_intelligence_overview(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get overview of all intelligence modules for a domain.

    Returns the status of each module including:
    - Whether data is available
    - Data freshness (fresh/stale/expired)
    - Last update timestamp
    - Source citations

    This endpoint is fast as it only checks metadata, not full data.
    """
    domain = _normalize_domain(domain)

    # Get status for all modules
    modules = []
    available_count = 0
    stale_count = 0

    for module_id in MODULE_METADATA.keys():
        status = await _get_module_status(db, domain, module_id)
        modules.append(status)

        if status.status == "available":
            available_count += 1
            if status.freshness in (ModuleFreshness.STALE, ModuleFreshness.EXPIRED):
                stale_count += 1

    # Calculate completeness
    total_modules = len(MODULE_METADATA)
    completeness = (available_count / total_modules * 100) if total_modules > 0 else 0

    # Get ICP score if available
    icp_record = await _get_module_data(db, domain, "m13_icp_priority")
    icp_score = getattr(icp_record, "icp_score", None) if icp_record else None

    return IntelligenceOverview(
        domain=domain,
        modules=modules,
        modules_available=available_count,
        modules_stale=stale_count,
        completeness_percent=round(completeness, 1),
        icp_score=icp_score,
        last_full_enrichment=None,  # TODO: Track from enrichment status
    )


# =============================================================================
# Wave 1: Foundation Modules (M01-M04)
# =============================================================================

@router.get("/{domain}/company", response_model=CompanyContextResponse)
async def get_company_context(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M01: Company Context - baseline company information.

    Includes:
    - Company name, description, founding year
    - Industry and vertical classification
    - Geographic presence
    - Online presence (website, LinkedIn, Twitter)

    Source: WebSearch + BuiltWith
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m01_company_context")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No company context data for domain: {domain}. Run enrichment first.",
        )

    return CompanyContextResponse(
        domain=domain,
        module_id="m01_company_context",
        company_name=record.company_name,
        legal_name=record.legal_name,
        description=record.description,
        founded_year=record.founded_year,
        employee_count=record.employee_count,
        employee_range=record.employee_range,
        industry=record.industry,
        vertical=record.vertical,
        sub_vertical=record.sub_vertical,
        business_model=record.business_model,
        headquarters_city=record.headquarters_city,
        headquarters_state=record.headquarters_state,
        headquarters_country=record.headquarters_country,
        regions_active=record.regions_active,
        website_url=record.website_url,
        linkedin_url=record.linkedin_url,
        twitter_handle=record.twitter_handle,
        parent_company=record.parent_company,
        brands=record.brands,
        recent_news=record.recent_news,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 30),
        source_citation=_build_source_citation(record, "m01_company_context"),
    )


@router.get("/{domain}/techstack", response_model=TechStackResponse)
async def get_tech_stack(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M02: Technology Stack - detected technologies from BuiltWith.

    Includes:
    - Partner technologies (Adobe AEM, Shopify, etc.)
    - Current search provider (Elasticsearch, Coveo, etc.)
    - E-commerce platform
    - Full technology stack
    - Tech spend estimate

    Source: BuiltWith (7 endpoints)
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m02_tech_stack")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No tech stack data for domain: {domain}. Run enrichment first.",
        )

    return TechStackResponse(
        domain=domain,
        module_id="m02_tech_stack",
        tech_spend_estimate=record.tech_spend_estimate,
        tech_spend_tier=record.tech_spend_tier,
        total_technologies=record.total_technologies,
        partner_technologies=record.partner_technologies,
        primary_partner=record.primary_partner,
        partner_score=record.partner_score,
        competitor_technologies=record.competitor_technologies,
        current_search_provider=record.current_search_provider,
        has_algolia=record.has_algolia,
        ecommerce_platform=record.ecommerce_platform,
        payment_providers=record.payment_providers,
        analytics_tools=record.analytics_tools,
        full_stack=record.full_stack,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 7),
        source_citation=_build_source_citation(record, "m02_tech_stack"),
    )


@router.get("/{domain}/traffic", response_model=TrafficAnalysisResponse)
async def get_traffic_analysis(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M03: Traffic Analysis - traffic data from SimilarWeb.

    Includes:
    - Monthly visits and trends
    - Engagement metrics (pages/visit, duration, bounce rate)
    - Traffic sources (direct, search, social, referral)
    - Geographic distribution
    - Device split
    - Top keywords

    Source: SimilarWeb (14 endpoints)
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m03_traffic")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No traffic data for domain: {domain}. Run enrichment first.",
        )

    return TrafficAnalysisResponse(
        domain=domain,
        module_id="m03_traffic",
        monthly_visits=record.monthly_visits,
        monthly_visits_trend=record.monthly_visits_trend,
        unique_visitors=record.unique_visitors,
        global_rank=record.global_rank,
        country_rank=record.country_rank,
        pages_per_visit=record.pages_per_visit,
        avg_visit_duration=record.avg_visit_duration,
        bounce_rate=record.bounce_rate,
        direct_traffic_pct=record.direct_traffic_pct,
        search_traffic_pct=record.search_traffic_pct,
        paid_search_pct=record.paid_search_pct,
        organic_search_pct=record.organic_search_pct,
        social_traffic_pct=record.social_traffic_pct,
        referral_traffic_pct=record.referral_traffic_pct,
        email_traffic_pct=record.email_traffic_pct,
        top_countries=record.top_countries,
        desktop_pct=record.desktop_pct,
        mobile_pct=record.mobile_pct,
        top_organic_keywords=record.top_organic_keywords,
        top_paid_keywords=record.top_paid_keywords,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 7),
        source_citation=_build_source_citation(record, "m03_traffic"),
    )


@router.get("/{domain}/financials", response_model=FinancialProfileResponse)
async def get_financial_profile(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M04: Financial Profile - revenue, margins, ROI estimates.

    Includes:
    - Revenue trends (3-year)
    - Profitability metrics (margins, EBITDA)
    - E-commerce/digital revenue breakdown
    - Stock metrics (if public)
    - Analyst sentiment
    - Algolia ROI estimates (2%, 5%, 10% lift scenarios)

    Source: Yahoo Finance
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m04_financials")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No financial data for domain: {domain}. Run enrichment first.",
        )

    return FinancialProfileResponse(
        domain=domain,
        module_id="m04_financials",
        ticker=record.ticker,
        is_public=record.is_public,
        revenue_current=record.revenue_current,
        revenue_prior_year=record.revenue_prior_year,
        revenue_2_years_ago=record.revenue_2_years_ago,
        revenue_cagr=record.revenue_cagr,
        fiscal_year_end=record.fiscal_year_end,
        gross_margin=record.gross_margin,
        operating_margin=record.operating_margin,
        net_margin=record.net_margin,
        ebitda=record.ebitda,
        ebitda_margin=record.ebitda_margin,
        margin_zone=record.margin_zone,
        margin_pressure=record.margin_pressure,
        ecommerce_revenue=record.ecommerce_revenue,
        ecommerce_percent=record.ecommerce_percent,
        digital_revenue=record.digital_revenue,
        digital_percent=record.digital_percent,
        market_cap=record.market_cap,
        stock_price=record.stock_price,
        price_change_ytd=record.price_change_ytd,
        price_change_1y=record.price_change_1y,
        analyst_rating=record.analyst_rating,
        analyst_target_price=record.analyst_target_price,
        analyst_count=record.analyst_count,
        addressable_revenue=record.addressable_revenue,
        roi_scenario_low=record.roi_scenario_low,
        roi_scenario_mid=record.roi_scenario_mid,
        roi_scenario_high=record.roi_scenario_high,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 1),
        source_citation=_build_source_citation(record, "m04_financials"),
    )


# =============================================================================
# Wave 2: Competitive Modules (M05-M07)
# =============================================================================

@router.get("/{domain}/competitors", response_model=CompetitorIntelligenceResponse)
async def get_competitor_intelligence(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M05: Competitor Intelligence - competitive landscape.

    Includes:
    - Similar companies/competitors
    - Competitors' search providers
    - Competitors using Algolia (first-mover analysis)
    - Market position
    - Displacement opportunities

    Source: SimilarWeb + BuiltWith
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m05_competitors")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No competitor data for domain: {domain}. Run enrichment first.",
        )

    return CompetitorIntelligenceResponse(
        domain=domain,
        module_id="m05_competitors",
        competitors=record.competitors,
        competitor_count=record.competitor_count,
        competitors_with_algolia=record.competitors_with_algolia,
        competitors_with_elasticsearch=record.competitors_with_elasticsearch,
        competitors_with_coveo=record.competitors_with_coveo,
        competitors_with_other=record.competitors_with_other,
        market_position=record.market_position,
        market_share_estimate=record.market_share_estimate,
        first_mover_opportunity=record.first_mover_opportunity,
        competitive_pressure_score=record.competitive_pressure_score,
        displacement_angle=record.displacement_angle,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 30),
        source_citation=_build_source_citation(record, "m05_competitors"),
    )


@router.get("/{domain}/hiring", response_model=HiringSignalsResponse)
async def get_hiring_signals(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M06: Hiring Signals - job postings and talent acquisition.

    Includes:
    - Total open roles and signal classification
    - VP/Director/Technical role breakdown
    - Keywords found (search, Algolia, Elasticsearch)
    - Budget owner hiring indicators
    - Signal score (0-100)

    Source: Careers pages (Chrome MCP)
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m06_hiring")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No hiring data for domain: {domain}. Run enrichment first.",
        )

    return HiringSignalsResponse(
        domain=domain,
        module_id="m06_hiring",
        total_roles=record.total_roles,
        hot_signals=record.hot_signals,
        warm_signals=record.warm_signals,
        caution_signals=record.caution_signals,
        signals=record.signals,
        signal_score=record.signal_score,
        vp_roles=record.vp_roles,
        director_roles=record.director_roles,
        technical_roles=record.technical_roles,
        search_keywords_found=record.search_keywords_found,
        algolia_mentioned=record.algolia_mentioned,
        elasticsearch_mentioned=record.elasticsearch_mentioned,
        budget_owner_hiring=record.budget_owner_hiring,
        team_expansion=record.team_expansion,
        careers_url=record.careers_url,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 7),
        source_citation=_build_source_citation(record, "m06_hiring"),
    )


@router.get("/{domain}/strategic", response_model=StrategicContextResponse)
async def get_strategic_context(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M07: Strategic Context - market position and strategy.

    Includes:
    - Strategic priorities
    - Digital transformation initiatives
    - Trigger events (news, announcements)
    - Leadership changes
    - Industry trends
    - Budget/fiscal cycle timing

    Source: WebSearch
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m07_strategic")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No strategic data for domain: {domain}. Run enrichment first.",
        )

    return StrategicContextResponse(
        domain=domain,
        module_id="m07_strategic",
        strategic_priorities=record.strategic_priorities,
        digital_transformation=record.digital_transformation,
        platform_migration=record.platform_migration,
        trigger_events=record.trigger_events,
        trigger_score=record.trigger_score,
        recent_announcements=record.recent_announcements,
        press_releases=record.press_releases,
        leadership_changes=record.leadership_changes,
        industry_trends=record.industry_trends,
        regulatory_factors=record.regulatory_factors,
        fiscal_year_end=record.fiscal_year_end,
        budget_cycle=record.budget_cycle,
        renewal_timing=record.renewal_timing,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 30),
        source_citation=_build_source_citation(record, "m07_strategic"),
    )


# =============================================================================
# Wave 3: Buying Signals Modules (M08-M11)
# =============================================================================

@router.get("/{domain}/investor", response_model=InvestorIntelligenceResponse)
async def get_investor_intelligence(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M08: Investor Intelligence - SEC filings and investor presentations.

    Includes:
    - Latest 10-K/10-Q filings
    - SEC risk factors (digital/technology related)
    - Earnings call themes
    - Analyst Q&A highlights
    - Investor day content
    - Executive quotes with attribution

    Source: SEC EDGAR + Earnings transcripts
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m08_investor")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No investor data for domain: {domain}. Run enrichment first.",
        )

    return InvestorIntelligenceResponse(
        domain=domain,
        module_id="m08_investor",
        latest_10k_date=record.latest_10k_date,
        latest_10q_date=record.latest_10q_date,
        sec_risk_factors=record.sec_risk_factors,
        sec_digital_mentions=record.sec_digital_mentions,
        latest_earnings_date=record.latest_earnings_date,
        earnings_themes=record.earnings_themes,
        analyst_questions=record.analyst_questions,
        investor_day_date=record.investor_day_date,
        strategic_initiatives=record.strategic_initiatives,
        executive_quotes=record.executive_quotes,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 30),
        source_citation=_build_source_citation(record, "m08_investor"),
    )


@router.get("/{domain}/executives", response_model=ExecutiveIntelligenceResponse)
async def get_executive_intelligence(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M09: Executive Intelligence - executive quotes and themes.

    Includes:
    - Executive roster
    - Quotes with full attribution (speaker, title, source URL, date)
    - Theme counts (digital transformation, search, personalization)
    - Algolia product mapping

    SOURCE CITATION MANDATE: Every quote includes source URL.

    Source: Earnings calls, interviews, press releases
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m09_executive")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No executive data for domain: {domain}. Run enrichment first.",
        )

    return ExecutiveIntelligenceResponse(
        domain=domain,
        module_id="m09_executive",
        executives=record.executives,
        quotes=record.quotes,
        digital_transformation_mentions=record.digital_transformation_mentions,
        customer_experience_mentions=record.customer_experience_mentions,
        search_mentions=record.search_mentions,
        conversion_mentions=record.conversion_mentions,
        personalization_mentions=record.personalization_mentions,
        key_themes=record.key_themes,
        algolia_mapping=record.algolia_mapping,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 30),
        source_citation=_build_source_citation(record, "m09_executive"),
    )


@router.get("/{domain}/buying-committee", response_model=BuyingCommitteeResponse)
async def get_buying_committee(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M10: Buying Committee - key decision makers.

    Includes:
    - Committee member profiles
    - Role classification (economic buyer, technical buyer, champion)
    - Contact prioritization (hot/warm/cold)
    - LinkedIn/email availability

    Source: LinkedIn + WebSearch
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m10_buying_committee")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No buying committee data for domain: {domain}. Run enrichment first.",
        )

    return BuyingCommitteeResponse(
        domain=domain,
        module_id="m10_buying_committee",
        members=record.members,
        economic_buyer=record.economic_buyer,
        technical_buyer=record.technical_buyer,
        user_buyer=record.user_buyer,
        champion=record.champion,
        hot_contacts=record.hot_contacts,
        warm_contacts=record.warm_contacts,
        cold_contacts=record.cold_contacts,
        total_contacts=record.total_contacts,
        contacts_with_linkedin=record.contacts_with_linkedin,
        contacts_with_email=record.contacts_with_email,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 30),
        source_citation=_build_source_citation(record, "m10_buying_committee"),
    )


@router.get("/{domain}/displacement", response_model=DisplacementAnalysisResponse)
async def get_displacement_analysis(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M11: Displacement Analysis - competitive displacement opportunity.

    Includes:
    - Current search provider and stack
    - Estimated current spend
    - Displacement score and difficulty
    - Primary/secondary displacement angles
    - Algolia advantages vs competitor weaknesses
    - Switching barriers and risk factors

    Source: BuiltWith + competitive analysis
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m11_displacement")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No displacement data for domain: {domain}. Run enrichment first.",
        )

    return DisplacementAnalysisResponse(
        domain=domain,
        module_id="m11_displacement",
        current_search_provider=record.current_search_provider,
        current_search_stack=record.current_search_stack,
        estimated_current_spend=record.estimated_current_spend,
        displacement_score=record.displacement_score,
        displacement_difficulty=record.displacement_difficulty,
        displacement_timeline=record.displacement_timeline,
        primary_angle=record.primary_angle,
        secondary_angles=record.secondary_angles,
        algolia_advantages=record.algolia_advantages,
        competitor_weaknesses=record.competitor_weaknesses,
        switching_barriers=record.switching_barriers,
        risk_factors=record.risk_factors,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 7),
        source_citation=_build_source_citation(record, "m11_displacement"),
    )


# =============================================================================
# Wave 4: Synthesis Modules (M12-M15)
# =============================================================================

@router.get("/{domain}/case-studies", response_model=CaseStudyMatchesResponse)
async def get_case_study_matches(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M12: Case Study Matching - relevant Algolia case studies.

    Includes:
    - Matched case studies with relevance scores
    - Vertical/use-case/competitor matches
    - Primary and secondary matches
    - Relevant proof points and quotes

    Source: Algolia case study database
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m12_case_study")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No case study data for domain: {domain}. Run enrichment first.",
        )

    return CaseStudyMatchesResponse(
        domain=domain,
        module_id="m12_case_study",
        matches=record.matches,
        total_matches=record.total_matches,
        vertical_matches=record.vertical_matches,
        use_case_matches=record.use_case_matches,
        competitor_takeout_matches=record.competitor_takeout_matches,
        primary_match=record.primary_match,
        secondary_matches=record.secondary_matches,
        relevant_proof_points=record.relevant_proof_points,
        relevant_quotes=record.relevant_quotes,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 90),
        source_citation=_build_source_citation(record, "m12_case_study"),
    )


@router.get("/{domain}/icp", response_model=ICPPriorityResponse)
async def get_icp_priority(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M13: ICP Priority Mapping - ICP fit score and breakdown.

    Includes:
    - ICP score (0-100) and tier (hot/warm/cool/cold)
    - Score breakdown (vertical, traffic, tech spend, partner tech)
    - Priority factors (timing, competitive, budget)
    - Final priority score and rank

    Source: Calculated from M01-M04
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m13_icp_priority")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No ICP data for domain: {domain}. Run enrichment first.",
        )

    return ICPPriorityResponse(
        domain=domain,
        module_id="m13_icp_priority",
        icp_score=record.icp_score,
        icp_tier=record.icp_tier,
        vertical_score=record.vertical_score,
        traffic_score=record.traffic_score,
        tech_spend_score=record.tech_spend_score,
        partner_tech_score=record.partner_tech_score,
        score_breakdown=record.score_breakdown,
        score_reasons=record.score_reasons,
        timing_factor=record.timing_factor,
        competitive_factor=record.competitive_factor,
        budget_factor=record.budget_factor,
        priority_score=record.priority_score,
        priority_rank=record.priority_rank,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 30),
        source_citation=_build_source_citation(record, "m13_icp_priority"),
    )


@router.get("/{domain}/signals", response_model=SignalScoringResponse)
async def get_signal_scoring(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M14: Signal Scoring - aggregated signal score.

    Includes:
    - Overall signal score and tier
    - Component scores (hiring, executive, financial, competitive, trigger)
    - Top signals with evidence
    - Urgency score and optimal timing
    - Recommended actions

    Source: Calculated from M05-M11
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m14_signal_scoring")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No signal data for domain: {domain}. Run enrichment first.",
        )

    return SignalScoringResponse(
        domain=domain,
        module_id="m14_signal_scoring",
        signal_score=record.signal_score,
        signal_tier=record.signal_tier,
        hiring_signal_score=record.hiring_signal_score,
        executive_signal_score=record.executive_signal_score,
        financial_signal_score=record.financial_signal_score,
        competitive_signal_score=record.competitive_signal_score,
        trigger_signal_score=record.trigger_signal_score,
        top_signals=record.top_signals,
        signal_summary=record.signal_summary,
        urgency_score=record.urgency_score,
        optimal_timing=record.optimal_timing,
        recommended_actions=record.recommended_actions,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 7),
        source_citation=_build_source_citation(record, "m14_signal_scoring"),
    )


@router.get("/{domain}/brief", response_model=StrategicBriefResponse)
async def get_strategic_brief(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    M15: Strategic Signal Brief - final brief for sales.

    The capstone output combining all intelligence:
    - 60-second story
    - Company snapshot
    - Timing signals
    - "In Their Own Words" (executive quotes)
    - Buying committee
    - Financial context
    - Current state gaps
    - Competitive landscape
    - Recommended approach
    - Discovery questions
    - Case study matches

    Source: Synthesized from M01-M14
    """
    domain = _normalize_domain(domain)
    record = await _get_module_data(db, domain, "m15_strategic_brief")

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No strategic brief for domain: {domain}. Run enrichment first.",
        )

    return StrategicBriefResponse(
        domain=domain,
        module_id="m15_strategic_brief",
        brief_version=record.brief_version,
        generated_at=record.generated_at,
        sixty_second_story=record.sixty_second_story,
        company_snapshot=record.company_snapshot,
        timing_signals=record.timing_signals,
        in_their_own_words=record.in_their_own_words,
        people=record.people,
        money=record.money,
        gaps=record.gaps,
        competitive_landscape=record.competitive_landscape,
        recommended_approach=record.recommended_approach,
        discovery_questions=record.discovery_questions,
        objection_handling=record.objection_handling,
        case_study_matches=record.case_study_matches,
        full_brief_markdown=record.full_brief_markdown,
        is_approved=record.is_approved,
        approved_by=record.approved_by,
        approved_at=record.approved_at,
        enriched_at=record.enriched_at,
        freshness=_calculate_freshness(record.enriched_at, 7),
        source_citation=_build_source_citation(record, "m15_strategic_brief"),
    )


# =============================================================================
# Full Intelligence Endpoint
# =============================================================================

@router.get("/{domain}/full", response_model=FullIntelligenceResponse)
async def get_full_intelligence(
    domain: str,
    include_stale: bool = Query(True, description="Include stale modules"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get all available intelligence modules for a domain.

    Returns data from all 15 modules in a single response.
    Useful for pre-loading the full company view.

    Query Parameters:
    - include_stale: Include modules with stale data (default: true)

    Note: This endpoint may be slow for domains with complete enrichment.
    Use the overview endpoint first to check availability.
    """
    domain = _normalize_domain(domain)

    # Get all module data
    modules_data: Dict[str, Any] = {}
    source_citations: List[SourceCitation] = []

    for module_id, metadata in MODULE_METADATA.items():
        record = await _get_module_data(db, domain, module_id)

        if record is None:
            continue

        freshness = _calculate_freshness(
            getattr(record, "enriched_at", None),
            metadata["freshness_days"]
        )

        # Skip stale if requested
        if not include_stale and freshness in (ModuleFreshness.STALE, ModuleFreshness.EXPIRED):
            continue

        # Convert record to dict
        record_dict = {
            c.name: getattr(record, c.name)
            for c in record.__table__.columns
            if not c.name.startswith("_")
        }
        record_dict["freshness"] = freshness.value

        modules_data[module_id] = record_dict

        # Collect source citation
        citation = _build_source_citation(record, module_id)
        if citation:
            source_citations.append(citation)

    # Get ICP score
    icp_data = modules_data.get("m13_icp_priority", {})
    icp_score = icp_data.get("icp_score")
    icp_tier = icp_data.get("icp_tier")

    # Get company name
    company_data = modules_data.get("m01_company_context", {})
    company_name = company_data.get("company_name")

    return FullIntelligenceResponse(
        domain=domain,
        company_name=company_name,
        icp_score=icp_score,
        icp_tier=icp_tier,
        modules=modules_data,
        modules_available=len(modules_data),
        modules_total=len(MODULE_METADATA),
        completeness_percent=round(len(modules_data) / len(MODULE_METADATA) * 100, 1),
        source_citations=source_citations,
    )
