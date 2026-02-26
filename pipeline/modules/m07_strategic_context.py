"""
M07: Strategic Context Module
==============================

Synthesizes strategic insights from all Wave 1+2 data for timing alignment.

Wave: 2 (Deep Intel - Depends on M05 and M06)

Dependencies:
- M01: Company Context (company info, vertical)
- M02: Technology Stack (tech investments)
- M03: Traffic Analysis (growth trends)
- M04: Financial Profile (financial health, margin zone)
- M05: Competitor Intelligence (competitive landscape)
- M06: Hiring Signals (investment signals)

Data Sources:
- WebSearch (news, press releases)
- Company investor relations page
- Industry publications
- Aggregation of M01-M06 results

Output Schema:
- domain: str
- strategic_initiatives: List[StrategicInitiative]
- trigger_events: List[TriggerEvent]
- caution_signals: List[CautionSignal]
- timing_assessment: TimingAssessment
- algolia_connection_points: List[str]

Database Table: intel_strategic_context

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M07 section)
- docs/DATABASE_SCHEMA_V2.md (intel_strategic_context)
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    DataNotFoundError,
    DependencyNotMetError,
    register_module,
)

logger = logging.getLogger(__name__)


class StrategicInitiative(BaseModel):
    """Strategic initiative or transformation program."""
    name: str = Field(..., description="Initiative name")
    initiative_type: str = Field(..., description="Digital Transformation, Cost Optimization, Growth, etc.")
    description: Optional[str] = Field(None, description="Initiative description")
    timeline: Optional[str] = Field(None, description="Expected timeline (e.g., FY2025-FY2027)")
    investment_amount: Optional[str] = Field(None, description="Investment amount if disclosed")
    algolia_connection: Optional[str] = Field(None, description="How Algolia maps to this initiative")
    source_url: Optional[str] = Field(None, description="Source URL")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


class TriggerEvent(BaseModel):
    """Trigger event indicating buying window."""
    event: str = Field(..., description="Event description")
    event_type: str = Field(..., description="Platform Update, Leadership Change, Funding, etc.")
    timing: Optional[str] = Field(None, description="When the event occurs")
    relevance: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")
    quote: Optional[str] = Field(None, description="Relevant quote if available")
    algolia_opportunity: Optional[str] = Field(None, description="How Algolia can capitalize")
    source_url: Optional[str] = Field(None, description="Source URL")


class CautionSignal(BaseModel):
    """Caution signal that may impact deal."""
    event: str = Field(..., description="Event description")
    signal_type: str = Field(..., description="Layoffs, Budget Cuts, Leadership Turnover, etc.")
    description: Optional[str] = Field(None, description="Additional context")
    implication: Optional[str] = Field(None, description="Sales implication")
    mitigation: Optional[str] = Field(None, description="How to address in sales motion")
    source_url: Optional[str] = Field(None, description="Source URL")


class TimingAssessment(BaseModel):
    """Overall timing assessment for outreach."""
    overall_timing: str = Field(default="NEUTRAL", description="EXCELLENT, GOOD, NEUTRAL, POOR")
    decision_window: Optional[str] = Field(None, description="Expected decision window (e.g., Q2-Q3 FY2026)")
    urgency_level: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")
    reasoning: Optional[str] = Field(None, description="Why this timing assessment")
    best_entry_point: Optional[str] = Field(None, description="Recommended entry approach")
    avoid_timing: Optional[str] = Field(None, description="Timing to avoid if any")


class StrategicContextData(BaseModel):
    """
    Output schema for M07 Strategic Context module.

    Synthesizes all Wave 1+2 data into strategic insights for sales timing.
    """

    domain: str = Field(..., description="Primary domain")
    company_name: Optional[str] = Field(None, description="Company name from M01")

    # Strategic initiatives
    strategic_initiatives: List[StrategicInitiative] = Field(
        default_factory=list,
        description="Current strategic programs and transformations"
    )

    # Trigger events (buying signals)
    trigger_events: List[TriggerEvent] = Field(
        default_factory=list,
        description="Events indicating buying window"
    )

    # Caution signals
    caution_signals: List[CautionSignal] = Field(
        default_factory=list,
        description="Signals that may impact deal"
    )

    # Timing assessment
    timing_assessment: TimingAssessment = Field(
        default_factory=TimingAssessment,
        description="Overall timing recommendation"
    )

    # Algolia connection points
    algolia_connection_points: List[str] = Field(
        default_factory=list,
        description="How Algolia connects to strategic priorities"
    )

    # Key themes extracted
    key_themes: List[str] = Field(
        default_factory=list,
        description="Key strategic themes (AI, personalization, efficiency, etc.)"
    )

    # Wave data synthesis
    synthesis_summary: Optional[str] = Field(
        None,
        description="60-second story synthesizing all intelligence"
    )

    # Financial context from M04
    margin_zone: Optional[str] = Field(None, description="RED, YELLOW, GREEN from M04")
    financial_implication: Optional[str] = Field(None, description="Sales implication of financial state")

    # Competitive context from M05
    competitive_urgency: Optional[str] = Field(None, description="Urgency based on competitor landscape")
    first_mover_opportunity: bool = Field(default=False, description="First-mover in vertical")

    # Hiring context from M06
    hiring_intensity: Optional[str] = Field(None, description="HIGH, MODERATE, LOW from M06")
    decision_window_from_hiring: bool = Field(default=False, description="Leadership vacancy = decision window")

    # Summary counts
    total_initiatives: int = Field(default=0)
    total_trigger_events: int = Field(default=0)
    total_caution_signals: int = Field(default=0)

    # Enrichment metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)
    wave1_modules_used: List[str] = Field(default_factory=list)
    wave2_modules_used: List[str] = Field(default_factory=list)


# Initiative type keywords
INITIATIVE_KEYWORDS = {
    "Digital Transformation": ["digital transformation", "digital-first", "digitalization", "modernization"],
    "Cost Optimization": ["cost savings", "efficiency", "cost reduction", "optimization", "streamline"],
    "E-commerce Growth": ["e-commerce expansion", "online growth", "omnichannel", "digital commerce"],
    "Customer Experience": ["customer experience", "cx transformation", "personalization", "customer journey"],
    "AI Investment": ["ai", "artificial intelligence", "machine learning", "automation"],
    "Platform Migration": ["platform migration", "replatforming", "technology upgrade", "tech refresh"],
}

# Algolia value prop mapping
ALGOLIA_VALUE_PROPS = {
    "search": "Algolia Search + InstantSearch",
    "ai": "Algolia NeuralSearch",
    "personalization": "Algolia Personalization",
    "discovery": "Algolia Browse + Dynamic Faceting",
    "recommendations": "Algolia AI Recommendations",
    "analytics": "Algolia Analytics + A/B Testing",
    "efficiency": "Algolia Merchandising Studio (no-code)",
    "mobile": "Algolia Mobile SDK",
}


@register_module
class M07StrategicContext(BaseModule):
    """
    Strategic Context Intelligence Module.

    Synthesizes data from all Wave 1 and Wave 2 modules to generate
    strategic insights and timing recommendations.

    Wave 2 Dependencies:
    - M05: Competitor Intelligence (competitive urgency)
    - M06: Hiring Signals (decision windows)

    Also uses (if available):
    - M01: Company Context
    - M02: Technology Stack
    - M03: Traffic Analysis
    - M04: Financial Profile

    Data Flow:
    1. Validate M05 and M06 are available (or run standalone)
    2. Extract insights from all Wave 1+2 modules
    3. Fetch news/press releases for strategic initiatives
    4. Identify trigger events
    5. Detect caution signals
    6. Synthesize timing assessment
    7. Generate Algolia connection points
    8. Return with source citations
    """

    MODULE_ID = "m07_strategic_context"
    MODULE_NAME = "Strategic Context"
    DESCRIPTION = "Strategic synthesis and timing assessment"

    WAVE = 2
    DEPENDS_ON = ["m05_competitor_intelligence", "m06_hiring_signals"]

    PRIMARY_SOURCE_TYPE = SourceType.WEBSEARCH
    OUTPUT_TABLE = "intel_strategic_context"
    TIMEOUT_SECONDS = 120

    # Mock strategic data for testing
    _MOCK_STRATEGIC_DATA = {
        "costco.com": {
            "strategic_initiatives": [
                {
                    "name": "Digital Membership Experience",
                    "initiative_type": "Digital Transformation",
                    "description": "Enhanced digital experience for Costco members",
                    "timeline": "FY2025-FY2026",
                    "algolia_connection": "Search and discovery for 4000+ SKUs",
                },
                {
                    "name": "E-commerce Expansion",
                    "initiative_type": "E-commerce Growth",
                    "description": "Growing e-commerce from 8% to 15% of revenue",
                    "timeline": "FY2024-FY2027",
                    "algolia_connection": "NeuralSearch for product discovery",
                },
            ],
            "trigger_events": [
                {
                    "event": "Search Platform Modernization",
                    "event_type": "Platform Update",
                    "timing": "H2 2025",
                    "relevance": "HIGH",
                    "quote": "Enhancing our search capabilities to improve member experience",
                    "algolia_opportunity": "Algolia as managed replacement for Elasticsearch",
                },
            ],
            "caution_signals": [
                {
                    "event": "Conservative Tech Spend",
                    "signal_type": "Budget Constraint",
                    "description": "Historically conservative on technology investments",
                    "implication": "Need strong ROI case",
                    "mitigation": "Focus on measurable conversion lift",
                },
            ],
        },
        "sallybeauty.com": {
            "strategic_initiatives": [
                {
                    "name": "Sally Ignited",
                    "initiative_type": "Digital Transformation",
                    "description": "AI, technology, seamless customer journey transformation",
                    "timeline": "FY2025-FY2027",
                    "investment_amount": "$100M capex",
                    "algolia_connection": "NeuralSearch aligns with AI ambitions",
                },
                {
                    "name": "Fuel for Growth",
                    "initiative_type": "Cost Optimization",
                    "description": "$120M cumulative cost savings by FY2026",
                    "timeline": "FY2025-FY2026",
                    "algolia_connection": "Search optimization is high-ROI, low-capex",
                },
            ],
            "trigger_events": [
                {
                    "event": "Sally App Upgrade",
                    "event_type": "Platform Update",
                    "timing": "Q1-Q4 FY2026",
                    "relevance": "HIGH",
                    "quote": "More efficient search engine for easier product discovery",
                    "algolia_opportunity": "InstantSearch + Query Suggestions for app",
                },
                {
                    "event": "BSG Platform Update",
                    "event_type": "Platform Update",
                    "timing": "Spring 2026",
                    "relevance": "HIGH",
                    "quote": "Enhanced capabilities around AI and personalization",
                    "algolia_opportunity": "NeuralSearch + Personalization for B2B platform",
                },
            ],
            "caution_signals": [
                {
                    "event": "HQ Layoffs",
                    "signal_type": "Budget Pressure",
                    "description": "Creative marketing department cut",
                    "implication": "Budget scrutiny - need strong ROI case",
                    "mitigation": "Lead with efficiency and conversion metrics",
                },
            ],
        },
        "mercedes-benz.com": {
            "strategic_initiatives": [
                {
                    "name": "MB.OS Digital Ecosystem",
                    "initiative_type": "Digital Transformation",
                    "description": "Unified digital operating system across all touchpoints",
                    "timeline": "2024-2027",
                    "algolia_connection": "Search across vehicle configurator and parts catalog",
                },
                {
                    "name": "Direct Sales Model",
                    "initiative_type": "E-commerce Growth",
                    "description": "Shift to direct-to-consumer digital sales",
                    "timeline": "2024-2026",
                    "algolia_connection": "Vehicle search and discovery in online showroom",
                },
            ],
            "trigger_events": [
                {
                    "event": "Global Website Redesign",
                    "event_type": "Platform Update",
                    "timing": "2025",
                    "relevance": "HIGH",
                    "algolia_opportunity": "Algolia as search layer for new AEM implementation",
                },
            ],
            "caution_signals": [
                {
                    "event": "EV Transition Costs",
                    "signal_type": "Budget Pressure",
                    "description": "Heavy investment in EV development",
                    "implication": "Discretionary tech spend may be scrutinized",
                    "mitigation": "Position as revenue enabler, not cost center",
                },
            ],
        },
    }

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute strategic context synthesis.

        Args:
            domain: The domain to analyze
            context: Results from Wave 1 and Wave 2 modules

        Returns:
            ModuleResult with StrategicContextData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting strategic context synthesis for {domain}")

            # Normalize domain
            normalized_domain = self._normalize_domain(domain)

            # Check dependencies if context provided
            if context:
                try:
                    self.validate_dependencies(context)
                except DependencyNotMetError as e:
                    self.logger.warning(f"Dependencies not fully met: {e}. Proceeding with available data.")

            # Extract all wave data
            wave_data = self._extract_all_wave_data(context)

            # Fetch strategic data
            raw_data, citations = await self._fetch_strategic_data(normalized_domain)

            # Process strategic initiatives
            initiatives = self._process_initiatives(
                raw_data.get("strategic_initiatives", []),
                wave_data,
            )

            # Process trigger events
            trigger_events = self._process_trigger_events(
                raw_data.get("trigger_events", []),
                wave_data,
            )

            # Process caution signals
            caution_signals = self._process_caution_signals(
                raw_data.get("caution_signals", []),
                wave_data,
            )

            # Generate timing assessment
            timing = self._generate_timing_assessment(
                initiatives,
                trigger_events,
                caution_signals,
                wave_data,
            )

            # Generate Algolia connection points
            algolia_points = self._generate_algolia_connections(
                initiatives,
                trigger_events,
                wave_data,
            )

            # Extract key themes
            key_themes = self._extract_key_themes(initiatives, trigger_events)

            # Generate synthesis summary
            synthesis = self._generate_synthesis(
                normalized_domain,
                wave_data,
                initiatives,
                trigger_events,
                timing,
            )

            # Build output
            output_data = StrategicContextData(
                domain=normalized_domain,
                company_name=wave_data.get("company_name"),
                strategic_initiatives=initiatives,
                trigger_events=trigger_events,
                caution_signals=caution_signals,
                timing_assessment=timing,
                algolia_connection_points=algolia_points,
                key_themes=key_themes,
                synthesis_summary=synthesis,
                margin_zone=wave_data.get("margin_zone"),
                financial_implication=wave_data.get("financial_implication"),
                competitive_urgency=wave_data.get("competitive_urgency"),
                first_mover_opportunity=wave_data.get("first_mover_opportunity", False),
                hiring_intensity=wave_data.get("hiring_intensity"),
                decision_window_from_hiring=wave_data.get("decision_window_open", False),
                total_initiatives=len(initiatives),
                total_trigger_events=len(trigger_events),
                total_caution_signals=len(caution_signals),
                data_quality_score=self._calculate_data_quality(initiatives, trigger_events, wave_data),
                enrichment_sources=[c.source_type.value for c in citations],
                wave1_modules_used=wave_data.get("wave1_used", []),
                wave2_modules_used=wave_data.get("wave2_used", []),
            )

            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=True, duration_ms=duration_ms)

            result = self._create_result(
                domain=normalized_domain,
                data=output_data.model_dump(),
                primary_citation=citations[0] if citations else self._create_default_citation(normalized_domain),
                supporting_citations=citations[1:] if len(citations) > 1 else [],
                duration_ms=duration_ms,
            )

            self.validate_output(result)

            self.logger.info(
                f"Strategic context synthesis complete for {domain}. "
                f"Initiatives: {len(initiatives)}, Triggers: {len(trigger_events)}, "
                f"Timing: {timing.overall_timing}. Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Strategic context synthesis failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        return True

    def _extract_all_wave_data(
        self,
        context: Optional[Dict[str, ModuleResult]],
    ) -> Dict[str, Any]:
        """Extract relevant data from all Wave 1 and Wave 2 modules."""
        data = {
            "wave1_used": [],
            "wave2_used": [],
        }

        if not context:
            return data

        # M01 - Company Context (Wave 1)
        if "m01_company_context" in context:
            m01 = context["m01_company_context"]
            if m01.status == ModuleStatus.SUCCESS:
                data["company_name"] = m01.data.get("company_name")
                data["vertical"] = m01.data.get("vertical")
                data["sub_vertical"] = m01.data.get("sub_vertical")
                data["is_public"] = m01.data.get("is_public")
                data["wave1_used"].append("m01_company_context")

        # M02 - Technology Stack (Wave 1)
        if "m02_technology_stack" in context:
            m02 = context["m02_technology_stack"]
            if m02.status == ModuleStatus.SUCCESS:
                data["search_provider"] = m02.data.get("search_provider", {})
                data["partner_technologies"] = m02.data.get("partner_technologies", [])
                data["wave1_used"].append("m02_technology_stack")

        # M03 - Traffic Analysis (Wave 1)
        if "m03_traffic_analysis" in context:
            m03 = context["m03_traffic_analysis"]
            if m03.status == ModuleStatus.SUCCESS:
                traffic_trend = m03.data.get("traffic_trend", {})
                data["traffic_trend"] = traffic_trend.get("trend_direction")
                data["wave1_used"].append("m03_traffic_analysis")

        # M04 - Financial Profile (Wave 1)
        if "m04_financial_profile" in context:
            m04 = context["m04_financial_profile"]
            if m04.status == ModuleStatus.SUCCESS:
                margin_zone = m04.data.get("margin_zone", {})
                data["margin_zone"] = margin_zone.get("classification")
                data["financial_implication"] = margin_zone.get("implication")
                data["revenue_trend"] = m04.data.get("financials", {}).get("revenue_trend")
                data["wave1_used"].append("m04_financial_profile")

        # M05 - Competitor Intelligence (Wave 2)
        if "m05_competitor_intelligence" in context:
            m05 = context["m05_competitor_intelligence"]
            if m05.status == ModuleStatus.SUCCESS:
                landscape = m05.data.get("competitor_search_landscape", {})
                data["first_mover_opportunity"] = landscape.get("first_mover_opportunity", False)
                data["algolia_competitors"] = landscape.get("algolia_users", 0)

                # Determine competitive urgency
                constructor_users = landscape.get("constructor_users", 0)
                coveo_users = landscape.get("coveo_users", 0)
                if constructor_users > 0 or coveo_users > 0:
                    data["competitive_urgency"] = "HIGH - Competitors using AI search"
                elif data["first_mover_opportunity"]:
                    data["competitive_urgency"] = "MODERATE - First-mover opportunity"
                else:
                    data["competitive_urgency"] = "LOW"

                data["wave2_used"].append("m05_competitor_intelligence")

        # M06 - Hiring Signals (Wave 2)
        if "m06_hiring_signals" in context:
            m06 = context["m06_hiring_signals"]
            if m06.status == ModuleStatus.SUCCESS:
                data["hiring_intensity"] = m06.data.get("overall_hiring_intensity")
                data["decision_window_open"] = m06.data.get("decision_window_open", False)
                data["leadership_vacancies"] = m06.data.get("leadership_vacancies", [])
                data["ai_investment_signal"] = m06.data.get("ai_investment_signal", False)
                data["wave2_used"].append("m06_hiring_signals")

        return data

    async def _fetch_strategic_data(
        self,
        domain: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """Fetch strategic data from news and company sources."""
        citations = []

        # Check mock data
        if domain in self._MOCK_STRATEGIC_DATA:
            data = self._MOCK_STRATEGIC_DATA[domain].copy()

            # WebSearch citation for news
            websearch_citation = self._create_citation(
                source_type=SourceType.WEBSEARCH,
                source_url=f"https://www.google.com/search?q={domain}+strategic+initiatives+digital+transformation",
                api_endpoint="news-search",
                confidence=0.85,
            )
            citations.append(websearch_citation)

            # Press release citation
            press_citation = self._create_citation(
                source_type=SourceType.PRESS_RELEASE,
                source_url=f"https://www.businesswire.com/search?q={domain.replace('.com', '')}",
                confidence=0.9,
            )
            citations.append(press_citation)

            return data, citations

        # Fallback: return empty data
        citation = self._create_citation(
            source_type=SourceType.WEBSEARCH,
            source_url=f"https://www.google.com/search?q={domain}+news+strategy",
            confidence=0.5,
            notes="No specific strategic data found",
        )
        citations.append(citation)

        return {"strategic_initiatives": [], "trigger_events": [], "caution_signals": []}, citations

    def _process_initiatives(
        self,
        raw_initiatives: List[Dict],
        wave_data: Dict,
    ) -> List[StrategicInitiative]:
        """Process raw initiative data into structured format."""
        initiatives = []

        for init_data in raw_initiatives:
            # Enhance Algolia connection if not provided
            algolia_conn = init_data.get("algolia_connection")
            if not algolia_conn:
                algolia_conn = self._infer_algolia_connection(init_data, wave_data)

            initiative = StrategicInitiative(
                name=init_data.get("name", ""),
                initiative_type=init_data.get("initiative_type", "Other"),
                description=init_data.get("description"),
                timeline=init_data.get("timeline"),
                investment_amount=init_data.get("investment_amount"),
                algolia_connection=algolia_conn,
                source_url=init_data.get("source_url"),
                confidence=init_data.get("confidence", 0.8),
            )
            initiatives.append(initiative)

        return initiatives

    def _infer_algolia_connection(
        self,
        initiative: Dict,
        wave_data: Dict,
    ) -> str:
        """Infer Algolia connection based on initiative type."""
        init_type = initiative.get("initiative_type", "").lower()
        desc = initiative.get("description", "").lower()
        combined = f"{init_type} {desc}"

        if "ai" in combined or "machine learning" in combined:
            return "Algolia NeuralSearch for AI-powered search and discovery"
        elif "personalization" in combined:
            return "Algolia Personalization for tailored experiences"
        elif "e-commerce" in combined or "commerce" in combined:
            return "Algolia Search + Recommendations for commerce"
        elif "customer experience" in combined:
            return "Algolia InstantSearch for fast, relevant experiences"
        elif "efficiency" in combined or "cost" in combined:
            return "Algolia Merchandising Studio for no-code optimization"
        else:
            return "Algolia Search for improved discovery"

    def _process_trigger_events(
        self,
        raw_events: List[Dict],
        wave_data: Dict,
    ) -> List[TriggerEvent]:
        """Process raw trigger events."""
        events = []

        for event_data in raw_events:
            event = TriggerEvent(
                event=event_data.get("event", ""),
                event_type=event_data.get("event_type", "Other"),
                timing=event_data.get("timing"),
                relevance=event_data.get("relevance", "MEDIUM"),
                quote=event_data.get("quote"),
                algolia_opportunity=event_data.get("algolia_opportunity"),
                source_url=event_data.get("source_url"),
            )
            events.append(event)

        # Add trigger events from Wave 2 data
        if wave_data.get("decision_window_open"):
            vacancies = wave_data.get("leadership_vacancies", [])
            if vacancies:
                event = TriggerEvent(
                    event=f"Leadership vacancy: {', '.join(vacancies[:2])}",
                    event_type="Leadership Change",
                    relevance="HIGH",
                    algolia_opportunity="New leadership evaluates new technology options",
                )
                events.append(event)

        return events

    def _process_caution_signals(
        self,
        raw_signals: List[Dict],
        wave_data: Dict,
    ) -> List[CautionSignal]:
        """Process raw caution signals."""
        signals = []

        for signal_data in raw_signals:
            signal = CautionSignal(
                event=signal_data.get("event", ""),
                signal_type=signal_data.get("signal_type", "Other"),
                description=signal_data.get("description"),
                implication=signal_data.get("implication"),
                mitigation=signal_data.get("mitigation"),
                source_url=signal_data.get("source_url"),
            )
            signals.append(signal)

        # Add caution signals from financial data
        margin_zone = wave_data.get("margin_zone")
        if margin_zone == "RED":
            signal = CautionSignal(
                event="Tight margins (RED zone)",
                signal_type="Financial Pressure",
                description="EBITDA margin under 10%",
                implication="Budget scrutiny - need strong ROI justification",
                mitigation="Lead with hard ROI metrics and quick time-to-value",
            )
            signals.append(signal)

        return signals

    def _generate_timing_assessment(
        self,
        initiatives: List[StrategicInitiative],
        trigger_events: List[TriggerEvent],
        caution_signals: List[CautionSignal],
        wave_data: Dict,
    ) -> TimingAssessment:
        """Generate overall timing assessment."""
        # Score timing factors
        score = 50  # Neutral baseline

        # Positive factors
        high_triggers = len([e for e in trigger_events if e.relevance == "HIGH"])
        score += high_triggers * 15

        if wave_data.get("first_mover_opportunity"):
            score += 10

        if wave_data.get("decision_window_open"):
            score += 15

        if wave_data.get("ai_investment_signal"):
            score += 10

        if len(initiatives) >= 2:
            score += 10

        # Negative factors
        score -= len(caution_signals) * 10

        if wave_data.get("margin_zone") == "RED":
            score -= 10

        # Determine overall timing
        if score >= 80:
            overall = "EXCELLENT"
            urgency = "HIGH"
        elif score >= 60:
            overall = "GOOD"
            urgency = "HIGH"
        elif score >= 40:
            overall = "NEUTRAL"
            urgency = "MEDIUM"
        else:
            overall = "POOR"
            urgency = "LOW"

        # Generate reasoning
        reasons = []
        if high_triggers > 0:
            reasons.append(f"{high_triggers} high-relevance trigger event(s)")
        if wave_data.get("decision_window_open"):
            reasons.append("leadership vacancy creates decision window")
        if wave_data.get("first_mover_opportunity"):
            reasons.append("first-mover opportunity in vertical")
        if wave_data.get("ai_investment_signal"):
            reasons.append("AI investment signals")

        reasoning = " + ".join(reasons) if reasons else "Standard timing indicators"

        # Determine decision window
        decision_window = None
        for event in trigger_events:
            if event.relevance == "HIGH" and event.timing:
                decision_window = event.timing
                break

        return TimingAssessment(
            overall_timing=overall,
            decision_window=decision_window,
            urgency_level=urgency,
            reasoning=reasoning,
            best_entry_point=self._determine_best_entry(wave_data),
        )

    def _determine_best_entry(self, wave_data: Dict) -> str:
        """Determine best entry point for outreach."""
        if wave_data.get("decision_window_open"):
            vacancies = wave_data.get("leadership_vacancies", [])
            if vacancies:
                return f"Target new leadership ({vacancies[0]}) with fresh perspective"

        if wave_data.get("ai_investment_signal"):
            return "Lead with NeuralSearch and AI capabilities"

        if wave_data.get("first_mover_opportunity"):
            return "Emphasize first-mover advantage and lighthouse opportunity"

        return "Start with technical team to build internal champion"

    def _generate_algolia_connections(
        self,
        initiatives: List[StrategicInitiative],
        trigger_events: List[TriggerEvent],
        wave_data: Dict,
    ) -> List[str]:
        """Generate list of Algolia connection points."""
        connections = set()

        for init in initiatives:
            if init.algolia_connection:
                connections.add(init.algolia_connection)

        for event in trigger_events:
            if event.algolia_opportunity:
                connections.add(event.algolia_opportunity)

        # Add from wave data
        if wave_data.get("ai_investment_signal"):
            connections.add("NeuralSearch for AI-powered search and discovery")

        if wave_data.get("partner_technologies"):
            partners = wave_data["partner_technologies"]
            if any("salesforce" in p.lower() or "sfcc" in p.lower() for p in partners):
                connections.add("Algolia SFCC Cartridge for seamless integration")
            if any("adobe" in p.lower() or "aem" in p.lower() for p in partners):
                connections.add("Algolia Adobe AEM integration")
            if any("shopify" in p.lower() for p in partners):
                connections.add("Algolia Shopify integration")

        return list(connections)

    def _extract_key_themes(
        self,
        initiatives: List[StrategicInitiative],
        trigger_events: List[TriggerEvent],
    ) -> List[str]:
        """Extract key strategic themes."""
        themes = set()

        for init in initiatives:
            init_type = init.initiative_type
            if init_type:
                themes.add(init_type)

            desc = (init.description or "").lower()
            if "ai" in desc or "artificial intelligence" in desc:
                themes.add("AI Investment")
            if "personalization" in desc:
                themes.add("Personalization")
            if "customer experience" in desc or "cx" in desc:
                themes.add("Customer Experience")
            if "efficiency" in desc or "cost" in desc:
                themes.add("Operational Efficiency")

        return list(themes)[:5]  # Limit to top 5 themes

    def _generate_synthesis(
        self,
        domain: str,
        wave_data: Dict,
        initiatives: List[StrategicInitiative],
        trigger_events: List[TriggerEvent],
        timing: TimingAssessment,
    ) -> str:
        """Generate 60-second synthesis summary."""
        company_name = wave_data.get("company_name", domain)
        vertical = wave_data.get("sub_vertical") or wave_data.get("vertical") or "company"

        # Build synthesis
        parts = [f"{company_name} is a {vertical}"]

        # Add strategic context
        if initiatives:
            init_names = [i.name for i in initiatives[:2]]
            parts.append(f"executing strategic initiatives ({', '.join(init_names)})")

        # Add timing context
        if timing.overall_timing in ["EXCELLENT", "GOOD"]:
            parts.append(f"with {timing.overall_timing.lower()} timing indicators")

        # Add trigger context
        high_triggers = [e for e in trigger_events if e.relevance == "HIGH"]
        if high_triggers:
            parts.append(f"including {high_triggers[0].event}")

        # Add competitive context
        if wave_data.get("first_mover_opportunity"):
            parts.append("presenting a first-mover opportunity for Algolia")

        return ". ".join(parts) + "."

    def _calculate_data_quality(
        self,
        initiatives: List[StrategicInitiative],
        trigger_events: List[TriggerEvent],
        wave_data: Dict,
    ) -> float:
        """Calculate data quality score."""
        score = 0.0

        # Initiatives (0.25)
        if len(initiatives) >= 2:
            score += 0.25
        elif len(initiatives) >= 1:
            score += 0.15

        # Trigger events (0.25)
        if len(trigger_events) >= 2:
            score += 0.25
        elif len(trigger_events) >= 1:
            score += 0.15

        # Wave 1 data (0.25)
        wave1_count = len(wave_data.get("wave1_used", []))
        if wave1_count >= 4:
            score += 0.25
        elif wave1_count >= 2:
            score += 0.15

        # Wave 2 data (0.25)
        wave2_count = len(wave_data.get("wave2_used", []))
        if wave2_count >= 2:
            score += 0.25
        elif wave2_count >= 1:
            score += 0.15

        return min(score, 1.0)

    def _normalize_domain(self, domain: str) -> str:
        """Normalize domain for consistent processing."""
        domain = domain.lower().strip()
        if domain.startswith("https://"):
            domain = domain[8:]
        elif domain.startswith("http://"):
            domain = domain[7:]
        if domain.startswith("www."):
            domain = domain[4:]
        if "/" in domain:
            domain = domain.split("/")[0]
        return domain

    def _create_default_citation(self, domain: str) -> SourceCitation:
        """Create default citation when no data available."""
        return SourceCitation(
            source_type=SourceType.WEBSEARCH,
            source_url=f"https://www.google.com/search?q={domain}+strategic+news",
            retrieved_at=datetime.utcnow(),
            confidence_score=0.3,
            notes="Default citation - limited data",
        )
