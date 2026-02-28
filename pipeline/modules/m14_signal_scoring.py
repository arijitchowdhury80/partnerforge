"""
M14: Signal Scoring Module
==========================

Computes comprehensive signal score combining budget, pain, and timing
signals to determine displacement priority classification.

Wave: 4 (Synthesis - Depends on all prior modules)

Data Sources:
- M01-M04: Foundation signals
- M05-M07: Competitive and strategic signals (when available)
- M08-M11: Deep intelligence signals (when available)
- M13: ICP score for final composite

Signal Categories:
- Budget Signals: Indicators of available budget
- Pain Signals: Indicators of search/discovery pain
- Timing Signals: Indicators of favorable decision timing
- Negative Signals: Factors that reduce priority

Output Schema:
- domain: str
- signal_categories: dict (budget, pain, timing, negative)
- composite_score: dict (raw, adjusted, final)
- signal_quality: dict (has_all_three, strongest, density)
- priority_status: str (HOT/WARM/COOL/COLD)

Database Table: intel_signal_scoring

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M14 section)
- docs/DATABASE_SCHEMA_V2.md (intel_signal_scoring)
"""

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
    ModuleError,
    DependencyNotMetError,
    register_module,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Output Schema Models
# =============================================================================

class SignalInstance(BaseModel):
    """Individual signal detection."""
    name: str = Field(..., description="Signal name")
    weight: int = Field(..., description="Signal weight (positive or negative)")
    present: bool = Field(default=False, description="Whether signal is present")
    evidence: Optional[str] = Field(None, description="Evidence for this signal")
    source: Optional[str] = Field(None, description="Source of this signal")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="Detection confidence")


class SignalCategory(BaseModel):
    """Category of signals (budget, pain, timing, negative)."""
    signals: List[SignalInstance] = Field(default_factory=list, description="Signals in this category")
    total: int = Field(default=0, description="Total score for this category")
    has_signal: bool = Field(default=False, description="Whether any signal present")
    strongest_signal: Optional[str] = Field(None, description="Name of strongest signal")


class CompositeScore(BaseModel):
    """Composite signal score calculation."""
    raw_signal_score: int = Field(default=0, description="Raw sum of all signal scores")
    negative_adjustment: int = Field(default=0, description="Negative signal deduction")
    adjusted_score: int = Field(default=0, description="Signal score after negatives")
    icp_score: int = Field(default=0, description="ICP score from M13")
    priority_score: int = Field(default=0, description="Final combined priority score")


class SignalQuality(BaseModel):
    """Quality assessment of signal detection."""
    has_all_three_types: bool = Field(default=False, description="Has budget, pain, and timing")
    has_budget_signal: bool = Field(default=False, description="Has budget signal")
    has_pain_signal: bool = Field(default=False, description="Has pain signal")
    has_timing_signal: bool = Field(default=False, description="Has timing signal")
    strongest_category: Optional[str] = Field(None, description="Strongest signal category")
    weakest_category: Optional[str] = Field(None, description="Weakest signal category")
    signal_density: str = Field(default="LOW", description="Signal density: HIGH/MEDIUM/LOW")
    total_signals_present: int = Field(default=0, description="Count of present signals")


class SignalScoringData(BaseModel):
    """
    Output schema for M14 Signal Scoring module.
    """
    domain: str = Field(..., description="Target domain")

    signal_categories: Dict[str, SignalCategory] = Field(
        default_factory=dict,
        description="Signal categories with detected signals"
    )

    composite_score: CompositeScore = Field(
        default_factory=CompositeScore,
        description="Composite score calculation"
    )

    signal_quality: SignalQuality = Field(
        default_factory=SignalQuality,
        description="Quality assessment of signals"
    )

    priority_status: str = Field(
        default="COLD",
        description="Priority status: HOT, WARM, COOL, COLD"
    )

    priority_reasoning: str = Field(
        default="",
        description="Reasoning for priority classification"
    )

    recommended_actions: List[str] = Field(
        default_factory=list,
        description="Recommended next actions based on signals"
    )

    data_quality_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Quality score of signal detection"
    )


# =============================================================================
# Signal Definitions
# =============================================================================

# Budget Signals (indicates available budget)
BUDGET_SIGNALS = [
    ("hiring_search_roles", 25, "Hiring for search/e-commerce roles"),
    ("hiring_leadership", 20, "Hiring VP/Director level"),
    ("revenue_growing", 15, "Revenue growing YoY"),
    ("margin_green", 10, "Healthy margins (>20%)"),
    ("margin_yellow", 5, "Moderate margins (10-20%)"),
    ("recent_funding", 20, "Recent funding round (private)"),
    ("tech_investment_announced", 15, "Announced technology investment"),
    ("ecommerce_growing", 15, "E-commerce revenue growing"),
    ("public_company", 10, "Publicly traded company"),
    ("capex_increasing", 10, "CapEx increasing"),
]

# Pain Signals (indicates search/discovery pain)
PAIN_SIGNALS = [
    ("search_vendor_removed", 30, "Removed search vendor (RichRelevance, etc.)"),
    ("using_competitor_search", 15, "Using competitor search (Elasticsearch, etc.)"),
    ("using_native_search", 10, "Using native/basic platform search"),
    ("executive_quote_search", 20, "Executive quote about search needs"),
    ("executive_quote_digital", 15, "Executive quote about digital transformation"),
    ("risk_factor_tech", 15, "10-K mentions technology risk factors"),
    ("poor_search_experience", 20, "Evidence of poor search UX"),
    ("high_bounce_rate", 10, "High bounce rate (>50%)"),
    ("competitor_has_algolia", 15, "Competitor uses Algolia"),
    ("low_search_conversion", 15, "Low search-to-conversion ratio"),
]

# Timing Signals (indicates favorable timing)
TIMING_SIGNALS = [
    ("new_executive", 25, "New CIO/CDO/VP Digital in last 18 months"),
    ("platform_migration", 20, "Platform migration announced"),
    ("replatform_complete", 15, "Recently completed replatforming"),
    ("competitor_uses_algolia", 15, "Competitor already using Algolia"),  # Also pain signal
    ("ecommerce_growing_fast", 15, "E-commerce growing >20% YoY"),
    ("digital_transformation", 20, "Active digital transformation initiative"),
    ("fiscal_year_planning", 10, "In fiscal year planning cycle"),
    ("contract_renewal_window", 25, "Search contract renewal window"),
    ("rfi_rfp_active", 30, "Active RFI/RFP for search"),
    ("strategic_initiative", 15, "Announced strategic e-commerce initiative"),
]

# Negative Signals (reduces priority)
NEGATIVE_SIGNALS = [
    ("layoffs_announced", -20, "Recent layoffs announced"),
    ("revenue_declining", -15, "Revenue declining"),
    ("margin_red", -10, "Margin pressure (<10%)"),
    ("added_competitor_search", -30, "Recently added competitor search"),
    ("long_term_contract", -25, "Long-term contract with competitor"),
    ("recent_search_implementation", -40, "Recent search implementation (<12 months)"),
    ("budget_freeze", -30, "Announced budget freeze"),
    ("hiring_freeze", -15, "Hiring freeze announced"),
    ("already_algolia", -100, "Already using Algolia"),
]

# Priority thresholds (combined with ICP score)
PRIORITY_THRESHOLDS = [
    (140, "HOT"),    # 140+ total = HOT
    (100, "WARM"),   # 100-139 = WARM
    (60, "COOL"),    # 60-99 = COOL
    (0, "COLD"),     # <60 = COLD
]


# =============================================================================
# M14 Signal Scoring Module
# =============================================================================

@register_module
class M14SignalScoring(BaseModule):
    """
    Signal Scoring Intelligence Module.

    Detects and scores signals across three categories:
    1. Budget Signals - Indicators of budget availability
    2. Pain Signals - Indicators of search/discovery pain
    3. Timing Signals - Indicators of favorable decision timing

    Also detects negative signals that reduce priority.

    Data Flow:
    1. Extract potential signals from all context modules
    2. Score each signal category
    3. Calculate composite score with ICP
    4. Determine priority classification
    5. Generate recommended actions

    Key Principle:
    Having all three signal types (budget + pain + timing) is a strong
    indicator of an opportunity ready to close.
    """

    MODULE_ID = "m14_signal_scoring"
    MODULE_NAME = "Signal Scoring"
    DESCRIPTION = "Compute displacement priority signal score"

    WAVE = 4
    DEPENDS_ON = [
        "m01_company_context",
        "m02_technology_stack",
        "m03_traffic_analysis",
        "m04_financial_profile",
        "m13_icp_priority_mapping",
    ]

    PRIMARY_SOURCE_TYPE = SourceType.MANUAL_ENTRY  # Internal scoring
    OUTPUT_TABLE = "intel_signal_scoring"
    TIMEOUT_SECONDS = 30

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute signal scoring for a domain.

        Args:
            domain: The target domain to score
            context: Results from prior modules

        Returns:
            ModuleResult with signal scores
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting signal scoring for {domain}")

            if context is None:
                context = {}

            # Extract all potential signal indicators
            indicators = self._extract_signal_indicators(domain, context)

            # Detect signals in each category
            budget_category = self._detect_budget_signals(indicators)
            pain_category = self._detect_pain_signals(indicators)
            timing_category = self._detect_timing_signals(indicators)
            negative_category = self._detect_negative_signals(indicators)

            # Get ICP score from M13
            icp_score = self._get_icp_score(context)

            # Calculate composite score
            composite = self._calculate_composite_score(
                budget_category,
                pain_category,
                timing_category,
                negative_category,
                icp_score,
            )

            # Assess signal quality
            signal_quality = self._assess_signal_quality(
                budget_category,
                pain_category,
                timing_category,
            )

            # Determine priority
            priority_status = self._determine_priority(composite.priority_score)

            # Generate reasoning
            reasoning = self._generate_reasoning(
                budget_category,
                pain_category,
                timing_category,
                negative_category,
                composite,
                signal_quality,
            )

            # Generate recommended actions
            actions = self._generate_recommended_actions(
                priority_status,
                signal_quality,
                indicators,
            )

            # Calculate data quality
            quality_score = self._calculate_quality_score(indicators, signal_quality)

            # Create output
            output_data = SignalScoringData(
                domain=domain,
                signal_categories={
                    "budget_signals": budget_category,
                    "pain_signals": pain_category,
                    "timing_signals": timing_category,
                    "negative_signals": negative_category,
                },
                composite_score=composite,
                signal_quality=signal_quality,
                priority_status=priority_status,
                priority_reasoning=reasoning,
                recommended_actions=actions,
                data_quality_score=quality_score,
            )

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Create citation
            supporting_citations = self._collect_supporting_citations(context)
            primary_citation = self._create_citation(
                source_type=SourceType.MANUAL_ENTRY,
                source_url=f"https://arian.internal/signals/{domain}",
                api_endpoint="signal_scoring",
                confidence=quality_score,
                notes=f"Signal Score: {composite.priority_score}, Priority: {priority_status}",
            )

            # Record success
            self._record_execution(success=True, duration_ms=duration_ms)

            # Create result
            result = self._create_result(
                domain=domain,
                data=output_data.model_dump(),
                primary_citation=primary_citation,
                supporting_citations=supporting_citations,
                duration_ms=duration_ms,
            )

            # Validate
            self.validate_output(result)

            self.logger.info(
                f"Signal scoring complete for {domain}. "
                f"Priority: {priority_status}, Score: {composite.priority_score}. "
                f"Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Signal scoring failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        valid_statuses = {"HOT", "WARM", "COOL", "COLD"}
        if result.data.get("priority_status") not in valid_statuses:
            raise ValueError(f"Invalid priority_status: {result.data.get('priority_status')}")

        return True

    def _extract_signal_indicators(
        self,
        domain: str,
        context: Dict[str, ModuleResult],
    ) -> Dict[str, Any]:
        """
        Extract all potential signal indicators from context.
        """
        indicators = {"domain": domain}

        # M01 - Company Context
        if "m01_company_context" in context:
            m01 = context["m01_company_context"].data
            indicators["is_public"] = m01.get("is_public", False)
            indicators["employee_count"] = m01.get("employee_count")
            indicators["vertical"] = m01.get("vertical")

        # M02 - Technology Stack
        if "m02_technology_stack" in context:
            m02 = context["m02_technology_stack"].data
            search_provider = m02.get("search_provider", {})
            indicators["current_search"] = search_provider.get("current")
            indicators["is_algolia"] = search_provider.get("is_algolia", False)
            indicators["displacement_priority"] = search_provider.get("displacement_priority")
            indicators["technologies"] = [t.get("name") for t in m02.get("technologies", [])]
            indicators["partner_technologies"] = m02.get("partner_technologies", [])

        # M03 - Traffic Analysis
        if "m03_traffic_analysis" in context:
            m03 = context["m03_traffic_analysis"].data
            metrics = m03.get("traffic_metrics", {})
            indicators["monthly_visits"] = metrics.get("monthly_visits", 0)
            indicators["bounce_rate"] = metrics.get("bounce_rate", 0)
            trend = m03.get("traffic_trend", {})
            indicators["traffic_trend"] = trend.get("trend_direction")
            indicators["traffic_yoy"] = trend.get("yoy_change", 0)

        # M04 - Financial Profile
        if "m04_financial_profile" in context:
            m04 = context["m04_financial_profile"].data
            financials = m04.get("financials", {})
            indicators["revenue_trend"] = financials.get("revenue_trend")

            margin_zone = m04.get("margin_zone", {})
            indicators["margin_zone"] = margin_zone.get("classification")
            indicators["ebitda_margin"] = margin_zone.get("ebitda_margin", 0)

            ecommerce = m04.get("ecommerce", {})
            indicators["ecommerce_growth"] = ecommerce.get("ecommerce_growth_yoy", 0)
            indicators["ecommerce_share"] = ecommerce.get("ecommerce_share", 0)

        # M13 - ICP Priority (for reference)
        if "m13_icp_priority_mapping" in context:
            m13 = context["m13_icp_priority_mapping"].data
            indicators["icp_score"] = m13.get("lead_score", {}).get("total", 0)

        # Hiring signals (would come from M06 if available)
        if "m06_hiring_signals" in context:
            m06 = context["m06_hiring_signals"].data
            indicators["hiring_signals"] = m06.get("hiring_signals", {})
            indicators["leadership_vacancies"] = m06.get("leadership_vacancies", [])
            indicators["ai_investment_signal"] = m06.get("ai_investment_signal", False)

        # Strategic context (would come from M07 if available)
        if "m07_strategic_context" in context:
            m07 = context["m07_strategic_context"].data
            indicators["strategic_initiatives"] = m07.get("strategic_initiatives", [])
            indicators["trigger_events"] = m07.get("trigger_events", [])
            indicators["caution_signals"] = m07.get("caution_signals", [])

        # Investor intelligence (would come from M08 if available)
        if "m08_investor_intelligence" in context:
            m08 = context["m08_investor_intelligence"].data
            indicators["exec_quotes"] = m08.get("earnings_calls", [])
            indicators["digital_commitments"] = m08.get("digital_commitments", [])

        return indicators

    def _detect_budget_signals(
        self,
        indicators: Dict[str, Any],
    ) -> SignalCategory:
        """Detect budget-related signals."""
        signals = []
        total = 0
        has_signal = False
        strongest = None
        strongest_weight = 0

        for name, weight, description in BUDGET_SIGNALS:
            present = False
            evidence = None

            # Detection logic
            if name == "hiring_search_roles":
                hiring = indicators.get("hiring_signals", {})
                if hiring.get("tier_1_strong") or hiring.get("tier_2_moderate"):
                    present = True
                    evidence = "Search/digital roles being hired"

            elif name == "hiring_leadership":
                vacancies = indicators.get("leadership_vacancies", [])
                if vacancies:
                    present = True
                    evidence = f"Leadership hiring: {', '.join(vacancies[:2])}"

            elif name == "revenue_growing":
                if indicators.get("revenue_trend") == "growing":
                    present = True
                    evidence = "Revenue trending upward"

            elif name == "margin_green":
                if indicators.get("margin_zone") == "GREEN":
                    present = True
                    evidence = f"EBITDA margin: {indicators.get('ebitda_margin', 0)*100:.1f}%"

            elif name == "margin_yellow":
                if indicators.get("margin_zone") == "YELLOW":
                    present = True
                    evidence = f"EBITDA margin: {indicators.get('ebitda_margin', 0)*100:.1f}%"

            elif name == "tech_investment_announced":
                initiatives = indicators.get("strategic_initiatives", [])
                if any("digital" in str(i).lower() or "tech" in str(i).lower() for i in initiatives):
                    present = True
                    evidence = "Digital/tech investment announced"

            elif name == "ecommerce_growing":
                ecom_growth = indicators.get("ecommerce_growth", 0)
                if ecom_growth and ecom_growth > 0.1:
                    present = True
                    evidence = f"E-commerce growing {ecom_growth*100:.0f}% YoY"

            elif name == "public_company":
                if indicators.get("is_public"):
                    present = True
                    evidence = "Publicly traded company"

            signal = SignalInstance(
                name=name,
                weight=weight,
                present=present,
                evidence=evidence,
            )
            signals.append(signal)

            if present:
                total += weight
                has_signal = True
                if weight > strongest_weight:
                    strongest = name
                    strongest_weight = weight

        return SignalCategory(
            signals=signals,
            total=total,
            has_signal=has_signal,
            strongest_signal=strongest,
        )

    def _detect_pain_signals(
        self,
        indicators: Dict[str, Any],
    ) -> SignalCategory:
        """Detect pain-related signals."""
        signals = []
        total = 0
        has_signal = False
        strongest = None
        strongest_weight = 0

        for name, weight, description in PAIN_SIGNALS:
            present = False
            evidence = None

            if name == "using_competitor_search":
                current = indicators.get("current_search", "").lower()
                competitors = ["elasticsearch", "elastic", "coveo", "searchspring", "klevu", "constructor"]
                if any(c in current for c in competitors):
                    present = True
                    evidence = f"Using competitor: {indicators.get('current_search')}"

            elif name == "using_native_search":
                current = indicators.get("current_search", "").lower()
                native = ["native", "platform", "einstein", "magento", "shopify"]
                if any(n in current for n in native) or not current:
                    present = True
                    evidence = "Using native/platform search"

            elif name == "executive_quote_search":
                quotes = indicators.get("exec_quotes", [])
                for q in quotes:
                    if "search" in str(q).lower():
                        present = True
                        evidence = "Executive mentioned search needs"
                        break

            elif name == "executive_quote_digital":
                commitments = indicators.get("digital_commitments", [])
                if commitments:
                    present = True
                    evidence = "Digital transformation commitment"

            elif name == "high_bounce_rate":
                bounce = indicators.get("bounce_rate", 0)
                if bounce and bounce > 0.5:
                    present = True
                    evidence = f"Bounce rate: {bounce*100:.1f}%"

            elif name == "competitor_has_algolia":
                # Would need M05 competitor data
                pass

            signal = SignalInstance(
                name=name,
                weight=weight,
                present=present,
                evidence=evidence,
            )
            signals.append(signal)

            if present:
                total += weight
                has_signal = True
                if weight > strongest_weight:
                    strongest = name
                    strongest_weight = weight

        return SignalCategory(
            signals=signals,
            total=total,
            has_signal=has_signal,
            strongest_signal=strongest,
        )

    def _detect_timing_signals(
        self,
        indicators: Dict[str, Any],
    ) -> SignalCategory:
        """Detect timing-related signals."""
        signals = []
        total = 0
        has_signal = False
        strongest = None
        strongest_weight = 0

        for name, weight, description in TIMING_SIGNALS:
            present = False
            evidence = None

            if name == "new_executive":
                # Would need executive tenure data from M09
                pass

            elif name == "platform_migration":
                triggers = indicators.get("trigger_events", [])
                if any("platform" in str(t).lower() or "migration" in str(t).lower() for t in triggers):
                    present = True
                    evidence = "Platform migration in progress"

            elif name == "ecommerce_growing_fast":
                growth = indicators.get("ecommerce_growth", 0)
                if growth and growth > 0.2:
                    present = True
                    evidence = f"E-commerce growing {growth*100:.0f}% YoY"

            elif name == "digital_transformation":
                initiatives = indicators.get("strategic_initiatives", [])
                for init in initiatives:
                    if "digital" in str(init).lower() or "transformation" in str(init).lower():
                        present = True
                        evidence = "Active digital transformation"
                        break

            elif name == "strategic_initiative":
                initiatives = indicators.get("strategic_initiatives", [])
                if initiatives:
                    present = True
                    evidence = f"Strategic initiative: {str(initiatives[0])[:50]}..."

            signal = SignalInstance(
                name=name,
                weight=weight,
                present=present,
                evidence=evidence,
            )
            signals.append(signal)

            if present:
                total += weight
                has_signal = True
                if weight > strongest_weight:
                    strongest = name
                    strongest_weight = weight

        return SignalCategory(
            signals=signals,
            total=total,
            has_signal=has_signal,
            strongest_signal=strongest,
        )

    def _detect_negative_signals(
        self,
        indicators: Dict[str, Any],
    ) -> SignalCategory:
        """Detect negative/risk signals."""
        signals = []
        total = 0
        has_signal = False
        strongest = None
        strongest_weight = 0

        for name, weight, description in NEGATIVE_SIGNALS:
            present = False
            evidence = None

            if name == "layoffs_announced":
                cautions = indicators.get("caution_signals", [])
                if any("layoff" in str(c).lower() for c in cautions):
                    present = True
                    evidence = "Recent layoffs reported"

            elif name == "revenue_declining":
                if indicators.get("revenue_trend") == "declining":
                    present = True
                    evidence = "Revenue declining YoY"

            elif name == "margin_red":
                if indicators.get("margin_zone") == "RED":
                    present = True
                    evidence = f"Margin pressure: {indicators.get('ebitda_margin', 0)*100:.1f}%"

            elif name == "added_competitor_search":
                # Would need historical tech data
                pass

            elif name == "already_algolia":
                if indicators.get("is_algolia"):
                    present = True
                    evidence = "Already using Algolia"

            signal = SignalInstance(
                name=name,
                weight=weight,
                present=present,
                evidence=evidence,
            )
            signals.append(signal)

            if present:
                total += weight  # Weight is negative
                has_signal = True
                if abs(weight) > abs(strongest_weight):
                    strongest = name
                    strongest_weight = weight

        return SignalCategory(
            signals=signals,
            total=total,
            has_signal=has_signal,
            strongest_signal=strongest,
        )

    def _get_icp_score(self, context: Dict[str, ModuleResult]) -> int:
        """Get ICP score from M13."""
        if "m13_icp_priority_mapping" in context:
            m13_data = context["m13_icp_priority_mapping"].data
            return m13_data.get("lead_score", {}).get("total", 50)
        return 50  # Default score

    def _calculate_composite_score(
        self,
        budget: SignalCategory,
        pain: SignalCategory,
        timing: SignalCategory,
        negative: SignalCategory,
        icp_score: int,
    ) -> CompositeScore:
        """Calculate composite signal score."""
        # Raw signal score (positive signals only)
        raw_score = budget.total + pain.total + timing.total

        # Negative adjustment
        negative_adj = negative.total  # Already negative

        # Adjusted score
        adjusted = max(0, raw_score + negative_adj)

        # Final priority score combines signal score with ICP score
        # Weight: 40% ICP, 60% Signals
        priority_score = int((icp_score * 0.4) + (adjusted * 0.6))

        return CompositeScore(
            raw_signal_score=raw_score,
            negative_adjustment=negative_adj,
            adjusted_score=adjusted,
            icp_score=icp_score,
            priority_score=priority_score,
        )

    def _assess_signal_quality(
        self,
        budget: SignalCategory,
        pain: SignalCategory,
        timing: SignalCategory,
    ) -> SignalQuality:
        """Assess quality and completeness of signals."""
        has_budget = budget.has_signal
        has_pain = pain.has_signal
        has_timing = timing.has_signal

        # Count total signals present
        total_present = (
            sum(1 for s in budget.signals if s.present) +
            sum(1 for s in pain.signals if s.present) +
            sum(1 for s in timing.signals if s.present)
        )

        # Determine strongest and weakest
        category_scores = {
            "budget": budget.total,
            "pain": pain.total,
            "timing": timing.total,
        }
        strongest = max(category_scores, key=category_scores.get)
        weakest = min(category_scores, key=category_scores.get)

        # Determine density
        if total_present >= 6:
            density = "HIGH"
        elif total_present >= 3:
            density = "MEDIUM"
        else:
            density = "LOW"

        return SignalQuality(
            has_all_three_types=has_budget and has_pain and has_timing,
            has_budget_signal=has_budget,
            has_pain_signal=has_pain,
            has_timing_signal=has_timing,
            strongest_category=strongest if category_scores[strongest] > 0 else None,
            weakest_category=weakest if category_scores[weakest] == 0 else None,
            signal_density=density,
            total_signals_present=total_present,
        )

    def _determine_priority(self, priority_score: int) -> str:
        """Determine priority status from score."""
        for threshold, status in PRIORITY_THRESHOLDS:
            if priority_score >= threshold:
                return status
        return "COLD"

    def _generate_reasoning(
        self,
        budget: SignalCategory,
        pain: SignalCategory,
        timing: SignalCategory,
        negative: SignalCategory,
        composite: CompositeScore,
        quality: SignalQuality,
    ) -> str:
        """Generate human-readable reasoning."""
        parts = []

        # Signal type coverage
        if quality.has_all_three_types:
            parts.append("All three signal types present (budget, pain, timing)")
        else:
            missing = []
            if not quality.has_budget_signal:
                missing.append("budget")
            if not quality.has_pain_signal:
                missing.append("pain")
            if not quality.has_timing_signal:
                missing.append("timing")
            if missing:
                parts.append(f"Missing signal types: {', '.join(missing)}")

        # Strongest signal
        if quality.strongest_category:
            parts.append(f"Strongest category: {quality.strongest_category}")

        # Notable signals
        for cat, label in [(budget, "Budget"), (pain, "Pain"), (timing, "Timing")]:
            if cat.strongest_signal:
                parts.append(f"{label}: {cat.strongest_signal.replace('_', ' ')}")

        # Negative signals
        if negative.has_signal:
            parts.append(f"Caution: {negative.strongest_signal.replace('_', ' ')}")

        return " | ".join(parts)

    def _generate_recommended_actions(
        self,
        priority: str,
        quality: SignalQuality,
        indicators: Dict[str, Any],
    ) -> List[str]:
        """Generate recommended actions based on signals."""
        actions = []

        if priority == "HOT":
            actions.append("Prioritize immediate outreach")
            if quality.has_all_three_types:
                actions.append("All signals aligned - fast-track opportunity")
        elif priority == "WARM":
            actions.append("Schedule discovery call within 2 weeks")
            if not quality.has_pain_signal:
                actions.append("Investigate pain points during discovery")
        elif priority == "COOL":
            actions.append("Add to nurture campaign")
            if not quality.has_budget_signal:
                actions.append("Monitor for budget signals")
        else:  # COLD
            actions.append("Monitor for future signals")
            actions.append("Add to long-term tracking list")

        # Tech-specific actions
        if indicators.get("partner_technologies"):
            actions.append(f"Partner co-sell: {indicators['partner_technologies'][0]}")

        return actions

    def _collect_supporting_citations(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[SourceCitation]:
        """Collect supporting citations from context."""
        citations = []
        for module_id, result in context.items():
            if result.status == ModuleStatus.SUCCESS:
                citations.append(result.primary_citation)
        return citations[:6]

    def _calculate_quality_score(
        self,
        indicators: Dict[str, Any],
        quality: SignalQuality,
    ) -> float:
        """Calculate data quality score."""
        score = 0.0

        # Base data availability
        if indicators.get("monthly_visits"):
            score += 0.15
        if indicators.get("margin_zone"):
            score += 0.15
        if indicators.get("current_search"):
            score += 0.15
        if indicators.get("revenue_trend"):
            score += 0.1

        # Signal detection quality
        if quality.total_signals_present >= 3:
            score += 0.2
        elif quality.total_signals_present >= 1:
            score += 0.1

        if quality.has_all_three_types:
            score += 0.25

        return min(score, 1.0)
