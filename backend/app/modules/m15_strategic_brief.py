"""
M15 Strategic Signal Brief Intelligence Module

Final synthesis module that generates AE-ready strategic briefs for sales.
This is a Wave 4 (Synthesis) module that depends on all prior intelligence.

Data Sources:
- M01-M14 enrichment results (consolidated intelligence)
- Executive quotes from M09
- Case study matches from M12
- Signal scoring from M14

Output: Machine-readable strategic brief optimized for downstream LLM consumption.
Each line is standalone with full context.

SOURCE CITATION MANDATE: Every data point MUST have source_url and source_date.
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field

from .base import (
    BaseIntelligenceModule,
    ModuleResult,
    SourceInfo,
    register_module,
)
from ..services.validation import MissingSourceError, SourceFreshnessError

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


class TalkingPoint(BaseModel):
    """Single talking point with source attribution."""

    point: str = Field(..., description="The talking point text")
    category: str = Field(..., description="Category: pain_point, opportunity, competitive, value_prop")
    priority: int = Field(default=1, description="Priority 1-5 (1 is highest)")
    source_context: str = Field(..., description="Context for where this point came from")
    source_url: str = Field(..., description="Source URL for this talking point")


class DiscoveryQuestion(BaseModel):
    """Discovery question for AE to ask during call."""

    question: str = Field(..., description="The question text")
    intent: str = Field(..., description="What the AE is trying to learn")
    expected_response_type: str = Field(..., description="Type of response expected: yes_no, quantitative, qualitative")
    follow_up_trigger: Optional[str] = Field(None, description="What response should trigger follow-up")
    source_url: str = Field(..., description="Source URL that informed this question")


class ObjectionHandler(BaseModel):
    """Objection handling guidance."""

    objection: str = Field(..., description="The anticipated objection")
    response_strategy: str = Field(..., description="How to respond to this objection")
    proof_points: List[str] = Field(default_factory=list, description="Evidence to support response")
    relevant_case_study: Optional[str] = Field(None, description="Case study that addresses this")
    source_url: str = Field(..., description="Source URL for proof points")


class ExecutiveQuote(BaseModel):
    """Quote from company executive with full attribution."""

    quote: str = Field(..., description="The exact quote text")
    speaker: str = Field(..., description="Speaker name")
    title: str = Field(..., description="Speaker title")
    date: str = Field(..., description="Date of the quote")
    context: str = Field(..., description="Context where quote was made")
    maps_to_algolia: str = Field(..., description="How this maps to Algolia value prop")
    source_url: str = Field(..., description="Source URL for the quote")


class RecommendedCaseStudy(BaseModel):
    """Recommended case study with relevance explanation."""

    company_name: str = Field(..., description="Case study company name")
    vertical: str = Field(..., description="Vertical/industry")
    headline_metric: str = Field(..., description="Key metric achieved (e.g., '35% conversion lift')")
    relevance_score: float = Field(..., description="Relevance score 0-1")
    relevance_reason: str = Field(..., description="Why this case study is relevant")
    talking_point: str = Field(..., description="How to position this in conversation")
    source_url: str = Field(..., description="Link to case study")


class PilotStrategy(BaseModel):
    """Recommended pilot strategy."""

    recommended_scope: str = Field(..., description="Recommended scope for pilot")
    success_metrics: List[str] = Field(default_factory=list, description="How to measure pilot success")
    timeline_weeks: int = Field(..., description="Recommended pilot duration in weeks")
    risk_mitigations: List[str] = Field(default_factory=list, description="Risk mitigation strategies")
    quick_win_opportunities: List[str] = Field(default_factory=list, description="Quick wins to demonstrate value")
    source_url: str = Field(..., description="Source for recommendations")


class NextStep(BaseModel):
    """Recommended next step with context."""

    action: str = Field(..., description="The recommended action")
    owner: str = Field(..., description="Who should take this action: ae, se, customer")
    timeline: str = Field(..., description="When this should happen: immediate, this_week, this_month")
    success_criteria: str = Field(..., description="How to know this step succeeded")
    dependencies: List[str] = Field(default_factory=list, description="What must happen first")


class StrategicSignalBriefData(BaseModel):
    """
    Strategic Signal Brief data model - output of M15 module.

    This is the FINAL deliverable for sales. Machine-readable format
    optimized for downstream LLM consumption. Each field is standalone
    with full context.
    """

    # Required identifiers
    domain: str = Field(..., description="Target domain (e.g., 'costco.com')")
    company_name: str = Field(..., description="Target company name")
    brief_generated_at: datetime = Field(default_factory=datetime.now, description="When brief was generated")

    # Executive Summary (1-3 sentences, standalone)
    executive_summary: str = Field(
        ...,
        description="1-3 sentence summary of the opportunity. Standalone context."
    )

    # ICP and Scoring Context
    icp_score: int = Field(..., description="ICP score 0-100")
    icp_tier: str = Field(..., description="ICP tier: hot, warm, cool, cold")
    signal_score: float = Field(..., description="Composite signal score 0-100")
    displacement_opportunity: str = Field(
        ...,
        description="Current search provider and displacement rationale"
    )

    # Key Talking Points (ranked)
    key_talking_points: List[TalkingPoint] = Field(
        default_factory=list,
        description="Prioritized talking points for the call"
    )

    # Discovery Questions
    discovery_questions: List[DiscoveryQuestion] = Field(
        default_factory=list,
        description="Discovery questions to ask during call"
    )

    # Objection Handlers
    objection_handlers: List[ObjectionHandler] = Field(
        default_factory=list,
        description="Anticipated objections and how to handle them"
    )

    # Pilot Strategy
    pilot_strategy: Optional[PilotStrategy] = Field(
        None,
        description="Recommended pilot approach if conversation goes well"
    )

    # Competitive Positioning
    competitive_positioning: str = Field(
        ...,
        description="How to position against current/alternative solutions"
    )

    # Speaking Their Language (Executive Quotes)
    speaking_their_language: List[ExecutiveQuote] = Field(
        default_factory=list,
        description="Executive quotes to reference during conversation"
    )

    # Recommended Case Studies
    recommended_case_studies: List[RecommendedCaseStudy] = Field(
        default_factory=list,
        description="Case studies to reference, ranked by relevance"
    )

    # Next Steps
    next_steps: List[NextStep] = Field(
        default_factory=list,
        description="Recommended next steps after the call"
    )

    # Metadata
    confidence_score: float = Field(
        default=0.0,
        description="Confidence in brief quality 0-1 based on data completeness"
    )
    data_completeness: Dict[str, bool] = Field(
        default_factory=dict,
        description="Which upstream modules contributed data"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Any data quality warnings"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M15StrategicBriefModule(BaseIntelligenceModule):
    """
    M15: Strategic Signal Brief - final AE-ready deliverable.

    Wave 4 (Synthesis) module that consolidates all prior intelligence
    into an actionable brief for sales.

    This module synthesizes:
    - Company context (M01)
    - Tech stack and displacement opportunity (M02)
    - Traffic and scale (M03)
    - Financial health (M04)
    - Competitive landscape (M05)
    - Hiring signals (M06)
    - Strategic context (M07)
    - Investor intelligence (M08)
    - Executive intel (M09)
    - Buying committee (M10)
    - Displacement analysis (M11)
    - Case study matches (M12)
    - ICP priority mapping (M13)
    - Signal scoring (M14)
    """

    MODULE_ID = "m15_strategic_brief"
    MODULE_NAME = "Strategic Signal Brief"
    WAVE = 4
    DEPENDS_ON = [
        "m01_company_context",
        "m02_tech_stack",
        "m03_traffic",
        "m04_financials",
        "m05_competitors",
        "m06_hiring",
        "m07_strategic",
        "m08_investor",
        "m09_executive",
        "m10_buying_committee",
        "m11_displacement",
        "m12_case_study",
        "m13_icp_priority",
        "m14_signal_scoring",
    ]
    SOURCE_TYPE = "synthesis"
    CACHE_TTL = 86400  # 24 hours

    async def enrich(
        self,
        domain: str,
        force: bool = False,
        upstream_data: Optional[Dict[str, Any]] = None
    ) -> ModuleResult:
        """
        Generate strategic signal brief for a domain.

        Args:
            domain: The domain to generate brief for (e.g., "costco.com")
            force: If True, bypass cache and regenerate
            upstream_data: Pre-fetched data from upstream modules (M01-M14)

        Returns:
            ModuleResult with StrategicSignalBriefData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If upstream sources are too old
        """
        self.logger.info(f"Generating strategic brief for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached brief for: {domain}")
                return cached

        # Fetch or use provided upstream data
        if upstream_data:
            raw_data = upstream_data
        else:
            raw_data = await self.fetch_data(domain)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Get source info FIRST (validate before synthesis)
        source_url = raw_data.get("source_url")
        source_date_str = raw_data.get("source_date")

        if not source_url:
            raise MissingSourceError(self.MODULE_ID, "source_url")

        if not source_date_str:
            raise MissingSourceError(self.MODULE_ID, "source_date")

        # Transform to strategic brief schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        brief_data = await self._synthesize_brief(domain, transformed)

        # Parse source date
        if isinstance(source_date_str, str):
            source_date = datetime.fromisoformat(source_date_str.replace("Z", "+00:00"))
        else:
            source_date = source_date_str

        # Create result with source citation
        result = self._create_result(
            domain=domain,
            data=brief_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully generated strategic brief for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch upstream module data for synthesis.

        In production, this retrieves results from M01-M14.
        Currently returns mock data for development.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with upstream module data and source information
        """
        # TODO: In production, fetch from database/cache for each upstream module
        # For now, return mock consolidated data
        return await self._fetch_mock_upstream_data(domain)

    async def _fetch_mock_upstream_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch mock upstream data for development.

        This simulates what the orchestrator would provide after
        running M01-M14 modules.
        """
        now = datetime.now()
        company_name = self._infer_company_name(domain)

        return {
            "domain": domain,
            "company_name": company_name,
            # M01 Company Context
            "company_context": {
                "industry": "Retail",
                "sub_industry": "Warehouse Club",
                "employee_count": 300000,
                "headquarters_country": "USA",
                "revenue_estimate": 240000000000,
            },
            # M02 Tech Stack
            "tech_stack": {
                "current_search": "Elasticsearch",
                "cms": "Adobe Experience Manager",
                "ecommerce_platform": "Custom",
                "tech_spend_estimate": 150000,
            },
            # M03 Traffic
            "traffic": {
                "monthly_visits": 50000000,
                "unique_visitors": 35000000,
                "search_traffic_share": 0.35,
            },
            # M04 Financials
            "financials": {
                "revenue": 240000000000,
                "gross_margin": 0.13,
                "yoy_growth": 0.07,
                "digital_revenue_estimate": 15000000000,
            },
            # M05 Competitors
            "competitors": {
                "search_competitors": ["Walmart", "Sam's Club", "Target"],
                "competitor_search_providers": {
                    "Walmart": "Algolia",
                    "Target": "Bloomreach",
                },
            },
            # M09 Executive Intel
            "executive_intel": {
                "quotes": [
                    {
                        "quote": "We're investing heavily in digital capabilities to enhance member experience",
                        "speaker": "Ron Vachris",
                        "title": "CEO",
                        "date": "2025-12-15",
                        "context": "Q1 2026 Earnings Call",
                        "source_url": "https://seekingalpha.com/costco-q1-2026-transcript",
                    },
                    {
                        "quote": "Our e-commerce business grew 15% this quarter",
                        "speaker": "Gary Millerchip",
                        "title": "CFO",
                        "date": "2025-12-15",
                        "context": "Q1 2026 Earnings Call",
                        "source_url": "https://seekingalpha.com/costco-q1-2026-transcript",
                    },
                ],
            },
            # M12 Case Study Matches
            "case_studies": [
                {
                    "company_name": "Staples",
                    "vertical": "Retail",
                    "headline_metric": "35% search conversion lift",
                    "relevance_score": 0.85,
                    "source_url": "https://algolia.com/customers/staples",
                },
                {
                    "company_name": "Lacoste",
                    "vertical": "Retail",
                    "headline_metric": "150ms search response time",
                    "relevance_score": 0.72,
                    "source_url": "https://algolia.com/customers/lacoste",
                },
            ],
            # M13 ICP Priority
            "icp_priority": {
                "icp_score": 85,
                "icp_tier": "hot",
                "priority_factors": [
                    "High traffic volume",
                    "Using outdated search",
                    "Competitor using Algolia",
                ],
            },
            # M14 Signal Score
            "signal_scoring": {
                "composite_score": 78.5,
                "timing_signals": ["Digital investment mentioned", "E-commerce growth"],
                "risk_signals": ["Large enterprise = long sales cycle"],
            },
            # Source for the consolidated data
            "source_url": f"https://partnerforge.algolia.com/briefs/{domain}",
            "source_date": now.isoformat(),
        }

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform upstream module data into strategic brief format.

        Args:
            raw_data: Consolidated data from upstream modules

        Returns:
            Transformed data for brief synthesis
        """
        # Extract relevant sections
        company_context = raw_data.get("company_context", {})
        tech_stack = raw_data.get("tech_stack", {})
        traffic = raw_data.get("traffic", {})
        financials = raw_data.get("financials", {})
        competitors = raw_data.get("competitors", {})
        executive_intel = raw_data.get("executive_intel", {})
        case_studies = raw_data.get("case_studies", [])
        icp_priority = raw_data.get("icp_priority", {})
        signal_scoring = raw_data.get("signal_scoring", {})

        return {
            "domain": raw_data.get("domain"),
            "company_name": raw_data.get("company_name"),
            "company_context": company_context,
            "tech_stack": tech_stack,
            "traffic": traffic,
            "financials": financials,
            "competitors": competitors,
            "executive_intel": executive_intel,
            "case_studies": case_studies,
            "icp_priority": icp_priority,
            "signal_scoring": signal_scoring,
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _synthesize_brief(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> StrategicSignalBriefData:
        """
        Synthesize all transformed data into a strategic brief.

        This is the core synthesis logic that creates the final deliverable.

        Args:
            domain: Target domain
            transformed_data: Transformed upstream data

        Returns:
            Complete StrategicSignalBriefData model
        """
        company_name = transformed_data.get("company_name", "Unknown Company")
        company_context = transformed_data.get("company_context", {})
        tech_stack = transformed_data.get("tech_stack", {})
        traffic = transformed_data.get("traffic", {})
        financials = transformed_data.get("financials", {})
        competitors = transformed_data.get("competitors", {})
        executive_intel = transformed_data.get("executive_intel", {})
        case_studies_raw = transformed_data.get("case_studies", [])
        icp_priority = transformed_data.get("icp_priority", {})
        signal_scoring = transformed_data.get("signal_scoring", {})
        source_url = transformed_data.get("source_url", "")

        # Build executive summary
        executive_summary = self._build_executive_summary(
            company_name, company_context, tech_stack, icp_priority
        )

        # Build key talking points
        talking_points = self._build_talking_points(
            company_name, tech_stack, competitors, signal_scoring, source_url
        )

        # Build discovery questions
        discovery_questions = self._build_discovery_questions(
            tech_stack, traffic, financials, source_url
        )

        # Build objection handlers
        objection_handlers = self._build_objection_handlers(
            tech_stack, case_studies_raw, source_url
        )

        # Build pilot strategy
        pilot_strategy = self._build_pilot_strategy(
            traffic, financials, source_url
        )

        # Build competitive positioning
        competitive_positioning = self._build_competitive_positioning(
            tech_stack, competitors
        )

        # Build speaking their language (executive quotes)
        speaking_their_language = self._build_executive_quotes(executive_intel)

        # Build recommended case studies
        recommended_case_studies = self._build_case_studies(case_studies_raw)

        # Build next steps
        next_steps = self._build_next_steps(icp_priority)

        # Calculate confidence score based on data completeness
        data_completeness = {
            "m01_company_context": bool(company_context),
            "m02_tech_stack": bool(tech_stack),
            "m03_traffic": bool(traffic),
            "m04_financials": bool(financials),
            "m05_competitors": bool(competitors),
            "m09_executive": bool(executive_intel.get("quotes")),
            "m12_case_study": bool(case_studies_raw),
            "m13_icp_priority": bool(icp_priority),
            "m14_signal_scoring": bool(signal_scoring),
        }
        confidence_score = sum(data_completeness.values()) / len(data_completeness)

        # Generate warnings
        warnings = []
        if not executive_intel.get("quotes"):
            warnings.append("No executive quotes available - consider researching earnings calls")
        if not case_studies_raw:
            warnings.append("No matching case studies found - brief value limited")
        if confidence_score < 0.6:
            warnings.append("Low data completeness - brief may be incomplete")

        return StrategicSignalBriefData(
            domain=domain,
            company_name=company_name,
            brief_generated_at=datetime.now(),
            executive_summary=executive_summary,
            icp_score=icp_priority.get("icp_score", 0),
            icp_tier=icp_priority.get("icp_tier", "cold"),
            signal_score=signal_scoring.get("composite_score", 0.0),
            displacement_opportunity=f"Current: {tech_stack.get('current_search', 'Unknown')} - "
                                      f"Algolia can provide faster, more relevant search experience",
            key_talking_points=talking_points,
            discovery_questions=discovery_questions,
            objection_handlers=objection_handlers,
            pilot_strategy=pilot_strategy,
            competitive_positioning=competitive_positioning,
            speaking_their_language=speaking_their_language,
            recommended_case_studies=recommended_case_studies,
            next_steps=next_steps,
            confidence_score=confidence_score,
            data_completeness=data_completeness,
            warnings=warnings,
        )

    def _build_executive_summary(
        self,
        company_name: str,
        company_context: Dict,
        tech_stack: Dict,
        icp_priority: Dict
    ) -> str:
        """Build standalone executive summary."""
        industry = company_context.get("industry", "their industry")
        current_search = tech_stack.get("current_search", "existing search solution")
        icp_score = icp_priority.get("icp_score", 0)
        icp_tier = icp_priority.get("icp_tier", "")

        tier_text = f"{icp_tier.upper()} lead (ICP {icp_score})" if icp_tier else f"ICP score {icp_score}"

        return (
            f"{company_name} is a {tier_text} in {industry} currently using {current_search}. "
            f"Key displacement opportunity exists due to competitor adoption of Algolia and "
            f"executive signals indicating digital investment priorities."
        )

    def _build_talking_points(
        self,
        company_name: str,
        tech_stack: Dict,
        competitors: Dict,
        signal_scoring: Dict,
        source_url: str
    ) -> List[TalkingPoint]:
        """Build prioritized talking points."""
        points = []

        # Competitive pressure point
        competitor_providers = competitors.get("competitor_search_providers", {})
        algolia_competitors = [c for c, p in competitor_providers.items() if p == "Algolia"]
        if algolia_competitors:
            points.append(TalkingPoint(
                point=f"{', '.join(algolia_competitors)} already use Algolia - {company_name} risks falling behind on search experience",
                category="competitive",
                priority=1,
                source_context="Competitor technology analysis",
                source_url=source_url,
            ))

        # Technology gap point
        current_search = tech_stack.get("current_search", "")
        if current_search and current_search.lower() in ["elasticsearch", "solr", "endeca"]:
            points.append(TalkingPoint(
                point=f"Current {current_search} requires significant engineering maintenance vs Algolia's managed service",
                category="pain_point",
                priority=1,
                source_context="Technology stack analysis",
                source_url=source_url,
            ))

        # Digital investment timing
        timing_signals = signal_scoring.get("timing_signals", [])
        if timing_signals:
            points.append(TalkingPoint(
                point=f"Now is the right time: {timing_signals[0]}",
                category="opportunity",
                priority=2,
                source_context="Signal analysis",
                source_url=source_url,
            ))

        # Value proposition point
        points.append(TalkingPoint(
            point="Algolia typically delivers 30-50% improvement in search conversion rates within 90 days",
            category="value_prop",
            priority=2,
            source_context="Algolia benchmark data",
            source_url="https://algolia.com/customers",
        ))

        return points

    def _build_discovery_questions(
        self,
        tech_stack: Dict,
        traffic: Dict,
        financials: Dict,
        source_url: str
    ) -> List[DiscoveryQuestion]:
        """Build discovery questions for the call."""
        questions = []

        # Search infrastructure question
        current_search = tech_stack.get("current_search", "your current search")
        questions.append(DiscoveryQuestion(
            question=f"How is {current_search} performing against your search KPIs today?",
            intent="Understand pain points with current search",
            expected_response_type="qualitative",
            follow_up_trigger="Any mention of slow performance or poor relevance",
            source_url=source_url,
        ))

        # Engineering burden question
        questions.append(DiscoveryQuestion(
            question="How many engineers are currently dedicated to maintaining and improving search?",
            intent="Quantify TCO and opportunity cost",
            expected_response_type="quantitative",
            follow_up_trigger="More than 2 FTEs = significant TCO savings opportunity",
            source_url=source_url,
        ))

        # Conversion metrics question
        monthly_visits = traffic.get("monthly_visits", 0)
        if monthly_visits > 1000000:
            questions.append(DiscoveryQuestion(
                question="What is your current search-to-purchase conversion rate?",
                intent="Establish baseline for ROI calculation",
                expected_response_type="quantitative",
                follow_up_trigger="Any number - use for ROI model",
                source_url=source_url,
            ))

        # Digital strategy question
        questions.append(DiscoveryQuestion(
            question="What are your top 3 digital priorities for this year?",
            intent="Align Algolia value to strategic priorities",
            expected_response_type="qualitative",
            follow_up_trigger="Any mention of customer experience or conversion",
            source_url=source_url,
        ))

        return questions

    def _build_objection_handlers(
        self,
        tech_stack: Dict,
        case_studies: List[Dict],
        source_url: str
    ) -> List[ObjectionHandler]:
        """Build anticipated objection handlers."""
        handlers = []

        # "We built it ourselves" objection
        handlers.append(ObjectionHandler(
            objection="We've already built our own search solution",
            response_strategy="Acknowledge the investment, then pivot to TCO and opportunity cost. Ask about engineering resources dedicated to maintenance vs innovation.",
            proof_points=[
                "Average enterprise spends 3-5 FTEs maintaining homegrown search",
                "Algolia frees engineering to focus on core product",
                "Our API-first approach means gradual migration is possible",
            ],
            relevant_case_study=case_studies[0]["company_name"] if case_studies else None,
            source_url=source_url,
        ))

        # "Too expensive" objection
        handlers.append(ObjectionHandler(
            objection="Algolia is too expensive for our volume",
            response_strategy="Reframe from cost to value. Calculate ROI based on their conversion metrics.",
            proof_points=[
                "Typical ROI is 300-500% within first year",
                "Cost is offset by reduced engineering spend",
                "Flexible pricing tiers based on actual usage",
            ],
            relevant_case_study=None,
            source_url="https://algolia.com/pricing",
        ))

        # "Current solution works fine" objection
        current_search = tech_stack.get("current_search", "current solution")
        handlers.append(ObjectionHandler(
            objection=f"Our {current_search} works fine",
            response_strategy="Ask about their definition of 'fine'. Probe for hidden pain points around speed, relevance, or merchandising control.",
            proof_points=[
                "50ms vs 200ms response time has measurable conversion impact",
                "Business users can control merchandising without engineering",
                "Modern AI features like personalization out of the box",
            ],
            relevant_case_study=None,
            source_url=source_url,
        ))

        return handlers

    def _build_pilot_strategy(
        self,
        traffic: Dict,
        financials: Dict,
        source_url: str
    ) -> PilotStrategy:
        """Build recommended pilot strategy."""
        monthly_visits = traffic.get("monthly_visits", 0)
        digital_revenue = financials.get("digital_revenue_estimate", 0)

        # Adjust scope based on company size
        if monthly_visits > 10000000:
            scope = "Single high-traffic category or regional site"
            timeline = 8
        else:
            scope = "Full site search with A/B test against current solution"
            timeline = 6

        return PilotStrategy(
            recommended_scope=scope,
            success_metrics=[
                "Search conversion rate (target: 15-25% improvement)",
                "Search latency (target: <50ms p95)",
                "Zero-result rate (target: <5%)",
                "Revenue per search session",
            ],
            timeline_weeks=timeline,
            risk_mitigations=[
                "Run in parallel with existing search initially",
                "Start with non-critical traffic segment",
                "Weekly check-ins to address issues quickly",
            ],
            quick_win_opportunities=[
                "Typo tolerance - immediate UX improvement",
                "Synonym configuration for industry terms",
                "Faceted navigation for product discovery",
            ],
            source_url=source_url,
        )

    def _build_competitive_positioning(
        self,
        tech_stack: Dict,
        competitors: Dict
    ) -> str:
        """Build competitive positioning statement."""
        current_search = tech_stack.get("current_search", "existing solution")
        competitor_providers = competitors.get("competitor_search_providers", {})

        algolia_users = [c for c, p in competitor_providers.items() if p == "Algolia"]

        if algolia_users:
            return (
                f"Position against {current_search} by emphasizing: 1) {', '.join(algolia_users)} "
                f"already trust Algolia - proven in the industry, 2) Managed service vs DIY "
                f"infrastructure burden, 3) AI features like personalization and recommendations "
                f"available out of the box."
            )
        else:
            return (
                f"Position against {current_search} by emphasizing: 1) Speed - 50ms vs typical "
                f"200ms+ response times, 2) Relevance - AI-powered ranking that improves with usage, "
                f"3) Business control - merchandising and rules without engineering dependency."
            )

    def _build_executive_quotes(
        self,
        executive_intel: Dict
    ) -> List[ExecutiveQuote]:
        """Build executive quotes section."""
        quotes_raw = executive_intel.get("quotes", [])
        quotes = []

        for q in quotes_raw:
            # Determine how quote maps to Algolia
            quote_text = q.get("quote", "").lower()
            if "digital" in quote_text or "e-commerce" in quote_text:
                maps_to = "Digital investment = search investment. Position Algolia as foundational to digital experience."
            elif "customer" in quote_text or "member" in quote_text or "experience" in quote_text:
                maps_to = "Customer experience priority. Search is the #1 driver of digital CX."
            elif "growth" in quote_text:
                maps_to = "Growth focus. Algolia customers see 20-35% conversion lift."
            else:
                maps_to = "General strategic priority. Connect to search impact on business outcomes."

            quotes.append(ExecutiveQuote(
                quote=q.get("quote", ""),
                speaker=q.get("speaker", "Unknown"),
                title=q.get("title", "Executive"),
                date=q.get("date", ""),
                context=q.get("context", ""),
                maps_to_algolia=maps_to,
                source_url=q.get("source_url", ""),
            ))

        return quotes

    def _build_case_studies(
        self,
        case_studies_raw: List[Dict]
    ) -> List[RecommendedCaseStudy]:
        """Build recommended case studies list."""
        case_studies = []

        for cs in case_studies_raw:
            relevance_score = cs.get("relevance_score", 0.5)
            vertical = cs.get("vertical", "")

            # Build talking point based on metrics
            headline = cs.get("headline_metric", "")
            company = cs.get("company_name", "")

            talking_point = f"'{company} achieved {headline}' - similar vertical and use case"

            case_studies.append(RecommendedCaseStudy(
                company_name=company,
                vertical=vertical,
                headline_metric=headline,
                relevance_score=relevance_score,
                relevance_reason=f"Same {vertical} vertical with comparable scale",
                talking_point=talking_point,
                source_url=cs.get("source_url", ""),
            ))

        # Sort by relevance
        case_studies.sort(key=lambda x: x.relevance_score, reverse=True)

        return case_studies

    def _build_next_steps(
        self,
        icp_priority: Dict
    ) -> List[NextStep]:
        """Build recommended next steps."""
        icp_tier = icp_priority.get("icp_tier", "warm")

        steps = []

        # Always recommend follow-up
        steps.append(NextStep(
            action="Send meeting summary with relevant case studies and ROI calculator",
            owner="ae",
            timeline="immediate",
            success_criteria="Customer acknowledges receipt and expresses interest in specific case study",
            dependencies=[],
        ))

        # Technical validation for hot leads
        if icp_tier == "hot":
            steps.append(NextStep(
                action="Schedule technical deep-dive with SE and customer's engineering team",
                owner="ae",
                timeline="this_week",
                success_criteria="Technical call scheduled within 5 business days",
                dependencies=["Initial call completed"],
            ))

            steps.append(NextStep(
                action="Prepare custom POC proposal based on discovered requirements",
                owner="se",
                timeline="this_week",
                success_criteria="POC proposal reviewed by AE before sending",
                dependencies=["Technical deep-dive completed"],
            ))

        # Discovery for warm leads
        elif icp_tier == "warm":
            steps.append(NextStep(
                action="Send 2-3 discovery questions via email to expand understanding",
                owner="ae",
                timeline="this_week",
                success_criteria="Customer responds with additional context",
                dependencies=["Initial call completed"],
            ))

        # Nurture for cooler leads
        else:
            steps.append(NextStep(
                action="Add to nurture campaign with relevant content",
                owner="ae",
                timeline="this_week",
                success_criteria="Contact added to appropriate Marketo campaign",
                dependencies=[],
            ))

        return steps

    def _infer_company_name(self, domain: str) -> str:
        """Infer company name from domain."""
        import re
        name = domain.split(".")[0]
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
        name = " ".join(word.capitalize() for word in name.split())
        return name
