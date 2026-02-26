"""
M13: ICP-Priority Mapping Module
================================

Scores target companies against Ideal Customer Profile (ICP) criteria
and assigns priority classification for sales engagement.

Wave: 4 (Synthesis - Depends on all prior waves)

Data Sources:
- M01 Company Context (for vertical/tier classification)
- M02 Technology Stack (for partner tech scoring)
- M03 Traffic Analysis (for traffic volume scoring)
- M04 Financial Profile (for tech spend estimation)

ICP Scoring Formula (0-100 points):
- Vertical/Tier: 40 pts (Commerce=40, Content=25, Support=15)
- Traffic Volume: 30 pts (50M+=30, 10M+=25, 1M+=15, 100K+=10)
- Tech Spend: 20 pts ($100K+=20, $50K+=15, $25K+=10)
- Partner Tech: 10 pts (Adobe=10, Shopify=7, SFCC=8, Other=5)

Output Schema:
- domain: str
- icp_classification: dict (tier, tier_name, description, confidence)
- lead_score: dict (total, breakdown, max_possible)
- priority_classification: dict (status: hot/warm/cool/cold, reasoning)
- algolia_product_mapping: List[ProductMapping]

Database Table: intel_icp_priority_mapping

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M13 section)
- docs/DATABASE_SCHEMA_V2.md (intel_icp_priority_mapping)
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

class ICPClassification(BaseModel):
    """ICP tier classification."""
    tier: int = Field(..., ge=1, le=3, description="ICP tier (1=Commerce, 2=Content, 3=Support)")
    tier_name: str = Field(..., description="Tier name (Commerce, Content, Support)")
    tier_description: str = Field("", description="Description of this tier")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Classification confidence")


class ScoreBreakdown(BaseModel):
    """Breakdown of ICP score components."""
    vertical_fit: int = Field(default=0, ge=0, le=40, description="Vertical fit score (max 40)")
    traffic_volume: int = Field(default=0, ge=0, le=30, description="Traffic volume score (max 30)")
    tech_spend: int = Field(default=0, ge=0, le=20, description="Tech spend score (max 20)")
    partner_tech_bonus: int = Field(default=0, ge=0, le=10, description="Partner tech bonus (max 10)")
    competitor_displacement_bonus: int = Field(default=0, ge=0, le=10, description="Displacement bonus")


class LeadScore(BaseModel):
    """Lead scoring result."""
    total: int = Field(..., ge=0, le=110, description="Total lead score")
    breakdown: ScoreBreakdown = Field(..., description="Score breakdown by component")
    max_possible: int = Field(default=110, description="Maximum possible score")
    percentile: float = Field(default=0.0, ge=0.0, le=100.0, description="Score percentile rank")


class PriorityClassification(BaseModel):
    """Priority classification for engagement."""
    priority_score: int = Field(..., ge=0, description="Combined priority score")
    status: str = Field(..., description="Priority status: HOT, WARM, COOL, COLD")
    status_color: str = Field(default="#888888", description="Color code for status")
    reasoning: str = Field("", description="Reasoning for this classification")
    engagement_urgency: str = Field("STANDARD", description="Engagement urgency level")


class ProductMapping(BaseModel):
    """Maps customer needs to Algolia products."""
    customer_need: str = Field(..., description="Identified customer need")
    algolia_product: str = Field(..., description="Recommended Algolia product")
    source_quote: Optional[str] = Field(None, description="Source quote if available")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="Mapping confidence")


class ICPPriorityMappingData(BaseModel):
    """
    Output schema for M13 ICP-Priority Mapping module.
    """
    domain: str = Field(..., description="Target domain")

    icp_classification: ICPClassification = Field(
        ...,
        description="ICP tier classification"
    )

    lead_score: LeadScore = Field(
        ...,
        description="Lead scoring with breakdown"
    )

    priority_classification: PriorityClassification = Field(
        ...,
        description="Priority classification for engagement"
    )

    algolia_product_mapping: List[ProductMapping] = Field(
        default_factory=list,
        description="Mapped Algolia products to customer needs"
    )

    scoring_inputs: Dict[str, Any] = Field(
        default_factory=dict,
        description="Raw inputs used for scoring"
    )

    data_quality_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Quality score of the scoring"
    )


# =============================================================================
# Scoring Configuration
# =============================================================================

# Vertical scoring (max 40 points)
VERTICAL_SCORES = {
    "Commerce": 40,
    "Content": 25,
    "Support": 15,
    "Unknown": 10,
}

# Traffic tier scoring (max 30 points)
TRAFFIC_TIERS = [
    (50_000_000, 30, "50M+"),      # 50M+ monthly visits
    (10_000_000, 25, "10M-50M"),   # 10M-50M
    (1_000_000, 15, "1M-10M"),     # 1M-10M
    (100_000, 10, "100K-1M"),      # 100K-1M
    (0, 5, "<100K"),               # Under 100K
]

# Tech spend scoring (max 20 points)
TECH_SPEND_TIERS = [
    (100_000, 20),  # $100K+
    (50_000, 15),   # $50K+
    (25_000, 10),   # $25K+
    (10_000, 5),    # $10K+
    (0, 2),         # Any
]

# Partner tech scoring (max 10 points)
PARTNER_TECH_SCORES = {
    "Adobe Commerce": 10,
    "Adobe AEM": 10,
    "Adobe Experience Manager": 10,
    "Shopify Plus": 8,
    "Shopify": 7,
    "Salesforce Commerce Cloud": 8,
    "commercetools": 8,
    "BigCommerce": 7,
    "Contentful": 8,
    "Amplience": 8,
}

# Priority thresholds
PRIORITY_THRESHOLDS = {
    "HOT": (80, "#FF4444", "URGENT"),       # 80+ = HOT
    "WARM": (60, "#FFAA44", "HIGH"),        # 60-79 = WARM
    "COOL": (40, "#44AAFF", "STANDARD"),    # 40-59 = COOL
    "COLD": (0, "#888888", "LOW"),          # <40 = COLD
}

# Default product mappings by vertical
DEFAULT_PRODUCT_MAPPINGS = {
    "Commerce": [
        ("E-commerce search optimization", "Algolia Search + InstantSearch"),
        ("Product discovery improvement", "Algolia AI Recommendations"),
        ("Search analytics and insights", "Algolia Analytics"),
        ("AI-powered search", "Algolia NeuralSearch"),
    ],
    "Content": [
        ("Content search optimization", "Algolia Search"),
        ("Documentation search", "Algolia DocSearch"),
        ("Knowledge base search", "Algolia Search + Analytics"),
    ],
    "Support": [
        ("Self-service search", "Algolia Search"),
        ("Help center optimization", "Algolia Search + Analytics"),
    ],
}


# =============================================================================
# M13 ICP-Priority Mapping Module
# =============================================================================

@register_module
class M13ICPPriorityMapping(BaseModule):
    """
    ICP-Priority Mapping Intelligence Module.

    Calculates ICP tier, lead score, and priority classification based on:
    1. Vertical fit (Commerce > Content > Support)
    2. Traffic volume (proxy for digital maturity)
    3. Technology spend (budget indicator)
    4. Partner technology presence (integration opportunity)
    5. Displacement opportunity (competitive displacement)

    Data Flow:
    1. Load target profile from Wave 1-4 context
    2. Calculate vertical score
    3. Calculate traffic score
    4. Calculate tech spend score
    5. Calculate partner tech bonus
    6. Aggregate into ICP score and priority

    Graceful Degradation:
    - Missing traffic data: Use minimum score
    - Missing tech spend: Estimate from company size
    - Missing vertical: Default to Commerce
    """

    MODULE_ID = "m13_icp_priority_mapping"
    MODULE_NAME = "ICP-Priority Mapping"
    DESCRIPTION = "Score against ICP criteria and assign priority"

    WAVE = 4
    DEPENDS_ON = [
        "m01_company_context",
        "m02_technology_stack",
        "m03_traffic_analysis",
        "m04_financial_profile",
    ]

    PRIMARY_SOURCE_TYPE = SourceType.MANUAL_ENTRY  # Internal scoring
    OUTPUT_TABLE = "intel_icp_priority_mapping"
    TIMEOUT_SECONDS = 30

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute ICP priority mapping for a domain.

        Args:
            domain: The target domain to score
            context: Results from Wave 1-3 modules

        Returns:
            ModuleResult with ICP score and priority classification
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting ICP priority mapping for {domain}")

            # Validate dependencies
            if context is None:
                context = {}

            # Extract scoring inputs from context
            scoring_inputs = self._extract_scoring_inputs(domain, context)

            # Calculate ICP classification
            icp_classification = self._calculate_icp_classification(scoring_inputs)

            # Calculate lead score
            lead_score = self._calculate_lead_score(scoring_inputs)

            # Calculate priority classification
            priority = self._calculate_priority(lead_score.total, scoring_inputs)

            # Generate product mappings
            product_mappings = self._generate_product_mappings(
                icp_classification.tier_name,
                scoring_inputs,
                context,
            )

            # Calculate data quality
            quality_score = self._calculate_quality_score(scoring_inputs)

            # Create output data
            output_data = ICPPriorityMappingData(
                domain=domain,
                icp_classification=icp_classification,
                lead_score=lead_score,
                priority_classification=priority,
                algolia_product_mapping=product_mappings,
                scoring_inputs=scoring_inputs,
                data_quality_score=quality_score,
            )

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Create citation - aggregate sources from context
            supporting_citations = self._collect_supporting_citations(context)
            primary_citation = self._create_citation(
                source_type=SourceType.MANUAL_ENTRY,
                source_url=f"https://partnerforge.internal/icp/{domain}",
                api_endpoint="icp_scoring",
                confidence=quality_score,
                notes=f"ICP Score: {lead_score.total}, Priority: {priority.status}",
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

            # Validate output
            self.validate_output(result)

            self.logger.info(
                f"ICP priority mapping complete for {domain}. "
                f"Score: {lead_score.total}, Priority: {priority.status}. "
                f"Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"ICP priority mapping failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        # Validate score ranges
        lead_score = result.data.get("lead_score", {})
        if lead_score.get("total", 0) > 110:
            raise ValueError(f"Lead score {lead_score['total']} exceeds maximum 110")

        return True

    def _extract_scoring_inputs(
        self,
        domain: str,
        context: Dict[str, ModuleResult],
    ) -> Dict[str, Any]:
        """
        Extract all inputs needed for scoring from context.
        """
        inputs = {"domain": domain}

        # From M01 Company Context
        if "m01_company_context" in context:
            m01_data = context["m01_company_context"].data
            inputs["company_name"] = m01_data.get("company_name")
            inputs["vertical"] = m01_data.get("vertical", "Commerce")
            inputs["sub_vertical"] = m01_data.get("sub_vertical")
            inputs["business_model"] = m01_data.get("business_model")
            inputs["employee_count"] = m01_data.get("employee_count")
            inputs["is_public"] = m01_data.get("is_public", False)

        # From M02 Technology Stack
        if "m02_technology_stack" in context:
            m02_data = context["m02_technology_stack"].data
            inputs["partner_technologies"] = m02_data.get("partner_technologies", [])
            inputs["tech_spend_estimate"] = m02_data.get("tech_spend_estimate", 0)
            inputs["technologies"] = [
                t.get("name") for t in m02_data.get("technologies", [])
            ]
            search_provider = m02_data.get("search_provider", {})
            inputs["current_search"] = search_provider.get("current")
            inputs["is_algolia"] = search_provider.get("is_algolia", False)
            inputs["displacement_priority"] = search_provider.get("displacement_priority")

        # From M03 Traffic Analysis
        if "m03_traffic_analysis" in context:
            m03_data = context["m03_traffic_analysis"].data
            metrics = m03_data.get("traffic_metrics", {})
            inputs["monthly_visits"] = metrics.get("monthly_visits", 0)
            inputs["traffic_tier"] = m03_data.get("traffic_tier")
            inputs["traffic_trend"] = m03_data.get("traffic_trend", {}).get("trend_direction")

        # From M04 Financial Profile
        if "m04_financial_profile" in context:
            m04_data = context["m04_financial_profile"].data
            financials = m04_data.get("financials", {})
            inputs["latest_revenue"] = financials.get("latest_revenue")
            inputs["revenue_trend"] = financials.get("revenue_trend")

            ecommerce = m04_data.get("ecommerce", {})
            inputs["ecommerce_revenue"] = ecommerce.get("ecommerce_revenue")
            inputs["ecommerce_share"] = ecommerce.get("ecommerce_share")
            inputs["addressable_search_revenue"] = ecommerce.get("addressable_search_revenue")

            margin_zone = m04_data.get("margin_zone", {})
            inputs["margin_zone"] = margin_zone.get("classification")

        return inputs

    def _calculate_icp_classification(
        self,
        inputs: Dict[str, Any],
    ) -> ICPClassification:
        """
        Calculate ICP tier classification.
        """
        vertical = inputs.get("vertical", "Commerce")

        tier_map = {
            "Commerce": (1, "Commerce", "Fashion & General Retail E-commerce"),
            "Content": (2, "Content", "Media, Publishing & Documentation"),
            "Support": (3, "Support", "Customer Service & Self-Service"),
        }

        tier, tier_name, description = tier_map.get(
            vertical,
            (1, "Commerce", "Default classification")
        )

        # Calculate confidence based on data availability
        confidence = 0.5  # Base confidence
        if inputs.get("sub_vertical"):
            confidence += 0.2
        if inputs.get("business_model"):
            confidence += 0.15
        if inputs.get("monthly_visits"):
            confidence += 0.15

        return ICPClassification(
            tier=tier,
            tier_name=tier_name,
            tier_description=description,
            confidence=min(confidence, 1.0),
        )

    def _calculate_lead_score(
        self,
        inputs: Dict[str, Any],
    ) -> LeadScore:
        """
        Calculate lead score with full breakdown.
        """
        breakdown = ScoreBreakdown()

        # 1. Vertical fit score (max 40)
        vertical = inputs.get("vertical", "Unknown")
        breakdown.vertical_fit = VERTICAL_SCORES.get(vertical, 10)

        # 2. Traffic volume score (max 30)
        monthly_visits = inputs.get("monthly_visits", 0)
        for threshold, score, _ in TRAFFIC_TIERS:
            if monthly_visits >= threshold:
                breakdown.traffic_volume = score
                break

        # 3. Tech spend score (max 20)
        tech_spend = inputs.get("tech_spend_estimate", 0)

        # If no tech spend data, estimate from company size/revenue
        if tech_spend == 0:
            if inputs.get("is_public"):
                tech_spend = 50000  # Assume $50K for public companies
            elif inputs.get("employee_count", 0) > 1000:
                tech_spend = 25000
            else:
                tech_spend = 10000

        for threshold, score in TECH_SPEND_TIERS:
            if tech_spend >= threshold:
                breakdown.tech_spend = score
                break

        # 4. Partner tech bonus (max 10)
        partner_techs = inputs.get("partner_technologies", [])
        max_partner_score = 0
        for tech in partner_techs:
            for partner_name, score in PARTNER_TECH_SCORES.items():
                if partner_name.lower() in tech.lower():
                    max_partner_score = max(max_partner_score, score)
        breakdown.partner_tech_bonus = max_partner_score

        # 5. Competitor displacement bonus (max 10)
        displacement = inputs.get("displacement_priority")
        if displacement == "HIGH":
            breakdown.competitor_displacement_bonus = 10
        elif displacement == "MEDIUM":
            breakdown.competitor_displacement_bonus = 5
        elif displacement == "LOW":
            breakdown.competitor_displacement_bonus = 2

        # Calculate total
        total = (
            breakdown.vertical_fit +
            breakdown.traffic_volume +
            breakdown.tech_spend +
            breakdown.partner_tech_bonus +
            breakdown.competitor_displacement_bonus
        )

        # Calculate percentile (simplified - would use actual distribution in production)
        percentile = min(100.0, (total / 110) * 100)

        return LeadScore(
            total=total,
            breakdown=breakdown,
            max_possible=110,
            percentile=round(percentile, 1),
        )

    def _calculate_priority(
        self,
        lead_score: int,
        inputs: Dict[str, Any],
    ) -> PriorityClassification:
        """
        Calculate priority classification based on lead score and signals.
        """
        # Determine base status from score
        status = "COLD"
        color = "#888888"
        urgency = "LOW"

        for priority_status, (threshold, priority_color, priority_urgency) in PRIORITY_THRESHOLDS.items():
            if lead_score >= threshold:
                status = priority_status
                color = priority_color
                urgency = priority_urgency
                break

        # Generate reasoning
        reasoning_parts = []

        # Score-based reasoning
        if lead_score >= 80:
            reasoning_parts.append(f"High ICP score ({lead_score}/110)")
        elif lead_score >= 60:
            reasoning_parts.append(f"Good ICP score ({lead_score}/110)")
        else:
            reasoning_parts.append(f"Moderate ICP score ({lead_score}/110)")

        # Vertical-based reasoning
        vertical = inputs.get("vertical", "Unknown")
        if vertical == "Commerce":
            reasoning_parts.append("Commerce vertical (highest priority)")
        elif vertical == "Content":
            reasoning_parts.append("Content vertical (medium priority)")

        # Traffic-based reasoning
        monthly_visits = inputs.get("monthly_visits", 0)
        if monthly_visits >= 50_000_000:
            reasoning_parts.append("Enterprise traffic (50M+)")
        elif monthly_visits >= 10_000_000:
            reasoning_parts.append("Large-scale traffic (10M+)")

        # Displacement reasoning
        if inputs.get("displacement_priority") == "HIGH":
            reasoning_parts.append("High displacement opportunity")

        # Partner tech reasoning
        if inputs.get("partner_technologies"):
            reasoning_parts.append("Partner tech integration opportunity")

        return PriorityClassification(
            priority_score=lead_score,
            status=status,
            status_color=color,
            reasoning=" | ".join(reasoning_parts),
            engagement_urgency=urgency,
        )

    def _generate_product_mappings(
        self,
        tier_name: str,
        inputs: Dict[str, Any],
        context: Dict[str, ModuleResult],
    ) -> List[ProductMapping]:
        """
        Generate Algolia product recommendations based on needs.
        """
        mappings = []

        # Get default mappings for this vertical
        default_mappings = DEFAULT_PRODUCT_MAPPINGS.get(tier_name, DEFAULT_PRODUCT_MAPPINGS["Commerce"])

        for need, product in default_mappings:
            mapping = ProductMapping(
                customer_need=need,
                algolia_product=product,
                confidence=0.7,
            )
            mappings.append(mapping)

        # Add personalization if e-commerce
        if tier_name == "Commerce" and inputs.get("ecommerce_share", 0) > 0.1:
            mappings.append(ProductMapping(
                customer_need="E-commerce personalization",
                algolia_product="Algolia Personalization",
                confidence=0.9,
            ))

        # Add NeuralSearch if they have high traffic
        if inputs.get("monthly_visits", 0) >= 10_000_000:
            mappings.append(ProductMapping(
                customer_need="AI-powered semantic search",
                algolia_product="Algolia NeuralSearch",
                confidence=0.85,
            ))

        # Add Merchandising if commerce with high revenue
        if tier_name == "Commerce" and inputs.get("addressable_search_revenue", 0) >= 1_000_000:
            mappings.append(ProductMapping(
                customer_need="Merchandising and ranking control",
                algolia_product="Algolia Merchandising Studio",
                confidence=0.85,
            ))

        return mappings

    def _collect_supporting_citations(
        self,
        context: Dict[str, ModuleResult],
    ) -> List[SourceCitation]:
        """
        Collect supporting citations from all context modules.
        """
        citations = []

        for module_id, result in context.items():
            if result.status == ModuleStatus.SUCCESS:
                citations.append(result.primary_citation)

        return citations[:5]  # Limit to 5 supporting citations

    def _calculate_quality_score(
        self,
        inputs: Dict[str, Any],
    ) -> float:
        """
        Calculate data quality score based on input completeness.
        """
        score = 0.0

        # Has vertical
        if inputs.get("vertical"):
            score += 0.15

        # Has traffic data
        if inputs.get("monthly_visits"):
            score += 0.2

        # Has tech spend data
        if inputs.get("tech_spend_estimate"):
            score += 0.15

        # Has partner technologies
        if inputs.get("partner_technologies"):
            score += 0.15

        # Has financial data
        if inputs.get("latest_revenue"):
            score += 0.15

        # Has displacement info
        if inputs.get("displacement_priority"):
            score += 0.1

        # Has e-commerce data
        if inputs.get("ecommerce_revenue"):
            score += 0.1

        return min(score, 1.0)
