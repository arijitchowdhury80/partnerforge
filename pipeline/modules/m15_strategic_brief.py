"""
M15: Strategic Signal Brief Module
==================================

Generates the final sales-ready strategic brief by synthesizing all
prior intelligence modules into a human-readable, action-oriented document.

Wave: 4 (Synthesis - Final module, depends on all prior modules)

Data Sources:
- All M01-M14 modules (complete synthesis)

Output Schema:
- domain: str
- sixty_second_story: str (elevator pitch)
- timing_signals: List[TimingSignal]
- in_their_own_words: List[ExecutiveQuote]
- people: List[KeyPerson]
- money: dict (revenue, ecommerce, addressable, lift potential)
- gaps: List[GapFinding]
- competitive_landscape: dict
- the_angle: str (strategic positioning)
- sources_bibliography: List[str]

Database Table: intel_strategic_signal_briefs

Design Principle:
- Signal density > Narrative flow
- Each line should be standalone with full context
- Optimized for downstream LLM consumption

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M15 section)
- docs/DATABASE_SCHEMA_V2.md (intel_strategic_signal_briefs)
"""

import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    ModuleError,
    DependencyNotMetError,
    register_module,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Output Schema Models
# =============================================================================

class TimingSignal(BaseModel):
    """A timing signal with source."""
    signal: str = Field(..., description="Signal description")
    date: Optional[str] = Field(None, description="Date or timeframe")
    source_url: Optional[str] = Field(None, description="Source URL")
    priority: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")


class ExecutiveQuote(BaseModel):
    """Executive quote for 'In Their Own Words' section."""
    quote: str = Field(..., description="The quote text")
    speaker: str = Field(..., description="Speaker name")
    title: str = Field(..., description="Speaker title")
    source_url: Optional[str] = Field(None, description="Source URL")
    maps_to_algolia: Optional[str] = Field(None, description="Algolia product mapping")


class KeyPerson(BaseModel):
    """Key person in the buying committee."""
    name: str = Field(..., description="Person name")
    title: str = Field(..., description="Job title")
    priority: str = Field(default="MEDIUM", description="Engagement priority")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn URL")
    role_in_deal: Optional[str] = Field(None, description="Role in buying decision")


class MoneyMetrics(BaseModel):
    """Financial metrics for the brief."""
    revenue: Optional[str] = Field(None, description="Total revenue formatted")
    ecommerce_revenue: Optional[str] = Field(None, description="E-commerce revenue formatted")
    addressable_search_revenue: Optional[str] = Field(None, description="Addressable by search")
    potential_annual_lift: Optional[str] = Field(None, description="Potential annual lift range")
    margin_zone: Optional[str] = Field(None, description="Margin zone (RED/YELLOW/GREEN)")


class GapFinding(BaseModel):
    """Search gap finding."""
    area: str = Field(..., description="Gap area")
    score: Optional[str] = Field(None, description="Score if available")
    severity: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")
    evidence: Optional[str] = Field(None, description="Evidence for this gap")


class CompetitiveLandscape(BaseModel):
    """Competitive landscape summary."""
    competitors: Dict[str, str] = Field(
        default_factory=dict,
        description="Competitor -> their search provider"
    )
    first_mover_opportunity: bool = Field(
        default=False,
        description="Whether no competitors use Algolia"
    )
    lighthouse_opportunity: Optional[str] = Field(
        None,
        description="Lighthouse customer potential"
    )


class StrategicSignalBriefData(BaseModel):
    """
    Output schema for M15 Strategic Signal Brief module.

    Designed for:
    - AE pre-call preparation
    - Downstream LLM consumption
    - Sales enablement automation
    """
    domain: str = Field(..., description="Target domain")
    company_name: str = Field(default="", description="Company name")

    sixty_second_story: str = Field(
        default="",
        description="60-second elevator pitch for the opportunity"
    )

    timing_signals: List[TimingSignal] = Field(
        default_factory=list,
        description="Key timing signals for engagement"
    )

    in_their_own_words: List[ExecutiveQuote] = Field(
        default_factory=list,
        description="Executive quotes mapped to Algolia products"
    )

    people: List[KeyPerson] = Field(
        default_factory=list,
        description="Key people in the buying committee"
    )

    money: MoneyMetrics = Field(
        default_factory=MoneyMetrics,
        description="Financial opportunity metrics"
    )

    gaps: List[GapFinding] = Field(
        default_factory=list,
        description="Search experience gaps"
    )

    competitive_landscape: CompetitiveLandscape = Field(
        default_factory=CompetitiveLandscape,
        description="Competitive analysis"
    )

    the_angle: str = Field(
        default="",
        description="Strategic positioning angle for this opportunity"
    )

    recommended_products: List[str] = Field(
        default_factory=list,
        description="Recommended Algolia products"
    )

    sources_bibliography: List[str] = Field(
        default_factory=list,
        description="All source URLs for citations"
    )

    priority_status: str = Field(
        default="COOL",
        description="Priority classification from M14"
    )

    icp_score: int = Field(
        default=0,
        description="ICP score from M13"
    )

    generated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Brief generation timestamp"
    )

    brief_version: str = Field(
        default="1.0",
        description="Brief format version"
    )


# =============================================================================
# M15 Strategic Signal Brief Module
# =============================================================================

@register_module
class M15StrategicBrief(BaseModule):
    """
    Strategic Signal Brief Intelligence Module.

    Synthesizes all prior intelligence into a sales-ready brief that includes:
    1. 60-second story (elevator pitch)
    2. Timing signals for engagement
    3. Executive quotes ("In Their Own Words")
    4. Key people/buying committee
    5. Money metrics (revenue, addressable, lift)
    6. Search gaps/opportunities
    7. Competitive landscape
    8. The strategic angle

    Design Principles:
    - Signal density over narrative flow
    - Each line standalone with full context
    - Hyperlinks for every data point
    - Optimized for downstream LLM consumption
    """

    MODULE_ID = "m15_strategic_brief"
    MODULE_NAME = "Strategic Signal Brief"
    DESCRIPTION = "Generate sales-ready strategic brief"

    WAVE = 4
    DEPENDS_ON = [
        "m01_company_context",
        "m02_technology_stack",
        "m03_traffic_analysis",
        "m04_financial_profile",
        "m12_case_study_matching",
        "m13_icp_priority_mapping",
        "m14_signal_scoring",
    ]

    PRIMARY_SOURCE_TYPE = SourceType.MANUAL_ENTRY
    OUTPUT_TABLE = "intel_strategic_signal_briefs"
    TIMEOUT_SECONDS = 60

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute strategic brief generation.

        Args:
            domain: The target domain
            context: Results from all prior modules

        Returns:
            ModuleResult with strategic brief
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting strategic brief generation for {domain}")

            if context is None:
                context = {}

            # Collect all source URLs for bibliography
            bibliography = self._collect_bibliography(context)

            # Extract company basics
            company_name = self._get_company_name(context, domain)

            # Generate 60-second story
            sixty_second_story = self._generate_sixty_second_story(domain, context)

            # Extract timing signals
            timing_signals = self._extract_timing_signals(context)

            # Extract executive quotes
            quotes = self._extract_executive_quotes(context)

            # Extract key people
            people = self._extract_key_people(context)

            # Extract money metrics
            money = self._extract_money_metrics(context)

            # Extract gaps
            gaps = self._extract_gaps(context)

            # Build competitive landscape
            competitive = self._build_competitive_landscape(context)

            # Generate "the angle"
            the_angle = self._generate_the_angle(context, competitive)

            # Get recommended products from M13
            products = self._get_recommended_products(context)

            # Get priority/score from M13/M14
            priority_status, icp_score = self._get_priority_info(context)

            # Create output
            output_data = StrategicSignalBriefData(
                domain=domain,
                company_name=company_name,
                sixty_second_story=sixty_second_story,
                timing_signals=timing_signals,
                in_their_own_words=quotes,
                people=people,
                money=money,
                gaps=gaps,
                competitive_landscape=competitive,
                the_angle=the_angle,
                recommended_products=products,
                sources_bibliography=bibliography,
                priority_status=priority_status,
                icp_score=icp_score,
                generated_at=datetime.utcnow(),
            )

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Collect supporting citations
            supporting = self._collect_supporting_citations(context)

            # Create primary citation
            primary_citation = self._create_citation(
                source_type=SourceType.MANUAL_ENTRY,
                source_url=f"https://arian.internal/brief/{domain}",
                api_endpoint="strategic_brief",
                confidence=0.9,
                notes=f"Strategic brief for {company_name}, Priority: {priority_status}",
            )

            # Record success
            self._record_execution(success=True, duration_ms=duration_ms)

            # Create result
            result = self._create_result(
                domain=domain,
                data=output_data.model_dump(mode="json"),
                primary_citation=primary_citation,
                supporting_citations=supporting,
                duration_ms=duration_ms,
            )

            # Validate
            self.validate_output(result)

            self.logger.info(
                f"Strategic brief complete for {domain}. "
                f"Priority: {priority_status}, Sources: {len(bibliography)}. "
                f"Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Strategic brief generation failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        if not result.data.get("sixty_second_story"):
            self.logger.warning("Brief has empty sixty_second_story")

        return True

    def _get_company_name(
        self,
        context: Dict[str, ModuleResult],
        domain: str,
    ) -> str:
        """Get company name from M01."""
        if "m01_company_context" in context:
            return context["m01_company_context"].data.get("company_name", domain)
        return domain

    def _generate_sixty_second_story(
        self,
        domain: str,
        context: Dict[str, ModuleResult],
    ) -> str:
        """
        Generate a 60-second elevator pitch story.

        Structure:
        1. Who they are (company + ticker + size)
        2. What they're doing (transformation/initiative)
        3. Why now (timing signal)
        4. Why Algolia (product fit)
        """
        parts = []

        # 1. Who they are
        if "m01_company_context" in context:
            m01 = context["m01_company_context"].data
            company_name = m01.get("company_name", domain)
            ticker = m01.get("ticker")
            exchange = m01.get("exchange")

            if ticker and exchange:
                parts.append(f"{company_name} ({exchange}: {ticker})")
            else:
                parts.append(company_name)

            # Add revenue if available
            if "m04_financial_profile" in context:
                m04 = context["m04_financial_profile"].data
                revenue = m04.get("financials", {}).get("latest_revenue")
                if revenue:
                    parts.append(f"is a ${revenue/1e9:.2f}B {m01.get('industry', 'company')}")
                else:
                    parts.append(f"is a {m01.get('industry', 'company')}")
        else:
            parts.append(f"{domain}")

        # 2. What they're doing
        transformation_text = ""
        if "m07_strategic_context" in context:
            m07 = context["m07_strategic_context"].data
            initiatives = m07.get("strategic_initiatives", [])
            if initiatives:
                first_init = initiatives[0]
                if isinstance(first_init, dict):
                    transformation_text = first_init.get("name", "")
                else:
                    transformation_text = str(first_init)

        if transformation_text:
            parts.append(f"executing a digital transformation ({transformation_text})")

        # 3. E-commerce context
        if "m04_financial_profile" in context:
            m04 = context["m04_financial_profile"].data
            ecom = m04.get("ecommerce", {})
            ecom_share = ecom.get("ecommerce_share", 0)
            ecom_growth = ecom.get("ecommerce_growth_yoy", 0)

            if ecom_share and ecom_growth:
                parts.append(
                    f"with e-commerce at {ecom_share*100:.0f}% of revenue "
                    f"and growing {ecom_growth*100:.0f}% YoY"
                )
            elif ecom_share:
                parts.append(f"with e-commerce at {ecom_share*100:.0f}% of revenue")

        # 4. Why Algolia
        if "m02_technology_stack" in context:
            m02 = context["m02_technology_stack"].data
            search = m02.get("search_provider", {})
            current = search.get("current")
            is_algolia = search.get("is_algolia", False)

            if is_algolia:
                parts.append("Already an Algolia customer.")
            elif current:
                parts.append(f"Currently using {current} for search.")
            else:
                parts.append("Currently using native/platform search.")

        # 5. Opportunity
        if "m14_signal_scoring" in context:
            m14 = context["m14_signal_scoring"].data
            quality = m14.get("signal_quality", {})
            if quality.get("has_all_three_types"):
                parts.append(
                    "All three signal types present (budget, pain, timing) - "
                    "qualified opportunity for Algolia's commerce suite."
                )
            elif quality.get("has_pain_signal") and quality.get("has_timing_signal"):
                parts.append("Strong pain and timing signals indicate readiness for search investment.")

        return " ".join(parts)

    def _extract_timing_signals(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[TimingSignal]:
        """Extract timing signals from M14 and strategic context."""
        signals = []

        # From M14 Signal Scoring
        if "m14_signal_scoring" in context:
            m14 = context["m14_signal_scoring"].data
            timing_cat = m14.get("signal_categories", {}).get("timing_signals", {})
            for signal in timing_cat.get("signals", []):
                if signal.get("present"):
                    signals.append(TimingSignal(
                        signal=signal.get("name", "").replace("_", " ").title(),
                        date=None,
                        source_url=None,
                        priority="HIGH" if signal.get("weight", 0) >= 20 else "MEDIUM",
                    ))

        # From M07 Strategic Context (if available)
        if "m07_strategic_context" in context:
            m07 = context["m07_strategic_context"].data
            for trigger in m07.get("trigger_events", []):
                if isinstance(trigger, dict):
                    signals.append(TimingSignal(
                        signal=trigger.get("event", "Unknown trigger"),
                        date=trigger.get("timing"),
                        source_url=trigger.get("source_url"),
                        priority=trigger.get("relevance", "MEDIUM"),
                    ))

        return signals[:5]  # Top 5 signals

    def _extract_executive_quotes(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[ExecutiveQuote]:
        """Extract executive quotes from M08 Investor Intelligence."""
        quotes = []

        # From M08 Investor Intelligence (if available)
        if "m08_investor_intelligence" in context:
            m08 = context["m08_investor_intelligence"].data
            for call in m08.get("earnings_calls", []):
                for quote in call.get("key_quotes", []):
                    quotes.append(ExecutiveQuote(
                        quote=quote.get("quote", ""),
                        speaker=quote.get("speaker", "Unknown"),
                        title=quote.get("title", "Executive"),
                        source_url=call.get("transcript_url"),
                        maps_to_algolia=quote.get("maps_to"),
                    ))

        return quotes[:5]  # Top 5 quotes

    def _extract_key_people(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[KeyPerson]:
        """Extract key people from M09/M10."""
        people = []

        # From M09 Executive Intelligence (if available)
        if "m09_executive_intelligence" in context:
            m09 = context["m09_executive_intelligence"].data
            for exec_data in m09.get("executives", []):
                people.append(KeyPerson(
                    name=exec_data.get("name", "Unknown"),
                    title=exec_data.get("title", ""),
                    priority=exec_data.get("priority", "MEDIUM"),
                    linkedin_url=exec_data.get("linkedin_url"),
                    role_in_deal=exec_data.get("buyer_role"),
                ))

        # From M10 Buying Committee (if available)
        if "m10_buying_committee" in context:
            m10 = context["m10_buying_committee"].data
            committee = m10.get("buying_committee", {})

            for role in ["champion", "technical_buyer", "economic_buyer"]:
                person_data = committee.get(role, {})
                if person_data.get("name"):
                    # Avoid duplicates
                    if not any(p.name == person_data["name"] for p in people):
                        people.append(KeyPerson(
                            name=person_data.get("name"),
                            title=person_data.get("title", ""),
                            priority="HIGH",
                            role_in_deal=role.replace("_", " ").title(),
                        ))

        return people[:5]  # Top 5 people

    def _extract_money_metrics(
        self,
        context: Dict[str, ModuleResult],
    ) -> MoneyMetrics:
        """Extract money metrics from M04."""
        if "m04_financial_profile" not in context:
            return MoneyMetrics()

        m04 = context["m04_financial_profile"].data
        financials = m04.get("financials", {})
        ecom = m04.get("ecommerce", {})
        margin = m04.get("margin_zone", {})
        roi = m04.get("roi_scenarios", {})

        revenue = financials.get("latest_revenue")
        ecom_rev = ecom.get("ecommerce_revenue")
        addressable = ecom.get("addressable_search_revenue")

        # Format values
        def format_money(val):
            if not val:
                return None
            if val >= 1e9:
                return f"${val/1e9:.2f}B"
            elif val >= 1e6:
                return f"${val/1e6:.0f}M"
            else:
                return f"${val:,.0f}"

        # Calculate lift range
        lift_range = None
        if roi.get("moderate") and roi.get("aggressive"):
            low = roi["moderate"].get("annual_impact", 0)
            high = roi["aggressive"].get("annual_impact", 0)
            if low and high:
                lift_range = f"{format_money(low)}-{format_money(high)}/year"

        return MoneyMetrics(
            revenue=format_money(revenue),
            ecommerce_revenue=format_money(ecom_rev),
            addressable_search_revenue=format_money(addressable),
            potential_annual_lift=lift_range,
            margin_zone=margin.get("classification"),
        )

    def _extract_gaps(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[GapFinding]:
        """Extract search gaps from M11 or infer from M02."""
        gaps = []

        # From M11 Displacement Analysis (if available)
        if "m11_displacement_analysis" in context:
            m11 = context["m11_displacement_analysis"].data
            for gap_data in m11.get("gaps", []):
                gaps.append(GapFinding(
                    area=gap_data.get("area", "Unknown"),
                    score=gap_data.get("score"),
                    severity=gap_data.get("severity", "MEDIUM"),
                    evidence=gap_data.get("evidence"),
                ))
        else:
            # Infer gaps from M02 search provider
            if "m02_technology_stack" in context:
                m02 = context["m02_technology_stack"].data
                search = m02.get("search_provider", {})

                if not search.get("is_algolia"):
                    gaps.append(GapFinding(
                        area="AI-Powered Search",
                        severity="HIGH",
                        evidence=f"Using {search.get('current', 'native search')} - no NeuralSearch",
                    ))
                    gaps.append(GapFinding(
                        area="Personalization",
                        severity="HIGH",
                        evidence="No evidence of search personalization",
                    ))
                    gaps.append(GapFinding(
                        area="Merchandising Control",
                        severity="MEDIUM",
                        evidence="Limited merchandising capabilities",
                    ))

        return gaps[:5]  # Top 5 gaps

    def _build_competitive_landscape(
        self,
        context: Dict[str, ModuleResult],
    ) -> CompetitiveLandscape:
        """Build competitive landscape from M05."""
        landscape = CompetitiveLandscape()

        # From M05 Competitor Intelligence (if available)
        if "m05_competitor_intelligence" in context:
            m05 = context["m05_competitor_intelligence"].data

            for comp in m05.get("competitors", []):
                domain = comp.get("domain", "")
                provider = comp.get("search_provider", "Unknown")
                landscape.competitors[domain] = provider

            comp_landscape = m05.get("competitor_search_landscape", {})
            landscape.first_mover_opportunity = comp_landscape.get("first_mover_opportunity", False)
            landscape.lighthouse_opportunity = m05.get("competitive_positioning")

        return landscape

    def _generate_the_angle(
        self,
        context: Dict[str, ModuleResult],
        competitive: CompetitiveLandscape,
    ) -> str:
        """Generate strategic positioning angle."""
        parts = []

        # Company context
        company_name = "This company"
        if "m01_company_context" in context:
            company_name = context["m01_company_context"].data.get("company_name", "This company")

        # Strategic initiative mention
        if "m07_strategic_context" in context:
            m07 = context["m07_strategic_context"].data
            initiatives = m07.get("strategic_initiatives", [])
            if initiatives:
                init_name = initiatives[0].get("name") if isinstance(initiatives[0], dict) else str(initiatives[0])
                parts.append(
                    f"{company_name}'s '{init_name}' transformation "
                    "creates an ideal entry point for Algolia."
                )

        # Product fit
        if "m13_icp_priority_mapping" in context:
            m13 = context["m13_icp_priority_mapping"].data
            mappings = m13.get("algolia_product_mapping", [])
            if mappings:
                products = [m.get("algolia_product") for m in mappings[:2] if m.get("algolia_product")]
                if products:
                    parts.append(f"{', '.join(products)} directly address their stated needs.")

        # Competitive angle
        if competitive.first_mover_opportunity:
            parts.append(
                f"With no competitors using Algolia, {company_name} can establish "
                "first-mover advantage in their vertical."
            )

        if competitive.lighthouse_opportunity:
            parts.append(competitive.lighthouse_opportunity)

        return " ".join(parts) if parts else f"Displacement opportunity for {company_name}."

    def _get_recommended_products(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[str]:
        """Get recommended products from M13."""
        if "m13_icp_priority_mapping" in context:
            m13 = context["m13_icp_priority_mapping"].data
            mappings = m13.get("algolia_product_mapping", [])
            products = []
            for m in mappings:
                prod = m.get("algolia_product")
                if prod and prod not in products:
                    products.append(prod)
            return products

        # Default recommendations
        return [
            "Algolia Search",
            "Algolia InstantSearch",
            "Algolia Analytics",
        ]

    def _get_priority_info(
        self,
        context: Dict[str, ModuleResult],
    ) -> tuple:
        """Get priority status and ICP score."""
        priority = "COOL"
        score = 50

        if "m14_signal_scoring" in context:
            m14 = context["m14_signal_scoring"].data
            priority = m14.get("priority_status", "COOL")

        if "m13_icp_priority_mapping" in context:
            m13 = context["m13_icp_priority_mapping"].data
            score = m13.get("lead_score", {}).get("total", 50)

        return priority, score

    def _collect_bibliography(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[str]:
        """Collect all source URLs for bibliography."""
        urls = set()

        for module_id, result in context.items():
            if result.status == ModuleStatus.SUCCESS:
                # Primary citation
                if result.primary_citation:
                    urls.add(str(result.primary_citation.source_url))

                # Supporting citations
                for cit in result.supporting_citations:
                    urls.add(str(cit.source_url))

        return sorted(list(urls))

    def _collect_supporting_citations(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[SourceCitation]:
        """Collect supporting citations from context."""
        citations = []
        for module_id, result in context.items():
            if result.status == ModuleStatus.SUCCESS:
                citations.append(result.primary_citation)
        return citations[:10]  # Limit
