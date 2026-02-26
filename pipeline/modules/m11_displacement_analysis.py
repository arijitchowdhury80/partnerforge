"""
M11: Displacement Analysis Module
=================================

Calculates displacement opportunity score and identifies co-sell partner motions.

Wave: 3 (Deep Intelligence - Depends on Wave 2)

Data Sources:
- M02: Technology Stack (for current search provider)
- M05: Competitor Intelligence (for competitor search providers)
- Algolia customer list (for exclusion)

Dependencies:
- M02: Technology Stack
- M05: Competitor Intelligence (if available)

Output Schema:
- displacement_opportunity: Current provider, difficulty, reasoning
- partner_co_sell_opportunities: Partner motions
- competitive_displacement: Competitor search landscape
- algolia_fit_score: Technical, business, timing fit
- recommended_products: Algolia products to pitch

Database Table: intel_displacement_analysis

This module synthesizes tech stack and competitor data to determine
displacement priority and co-sell opportunities.

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M11 section)
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from pipeline.models.source import (
    SourceCitation,
    SourceType,
    FreshnessStatus,
)
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    DependencyNotMetError,
    register_module,
)

logger = logging.getLogger(__name__)


class DisplacementOpportunity(BaseModel):
    """Analysis of current search provider displacement opportunity."""
    current_search_provider: Optional[str] = Field(None, description="Current search solution")
    provider_type: str = Field(
        default="Unknown",
        description="Native Platform, Third-Party, Competitor, None"
    )
    is_algolia: bool = Field(default=False, description="Already using Algolia")
    displacement_difficulty: str = Field(
        default="UNKNOWN",
        description="LOW, MEDIUM, HIGH, VERY_HIGH"
    )
    reasoning: Optional[str] = Field(None, description="Why this difficulty level")
    switching_cost_estimate: Optional[str] = Field(
        None,
        description="Estimated switching cost/effort"
    )
    contract_status: Optional[str] = Field(
        None,
        description="Known contract details if available"
    )


class PartnerCoSellOpportunity(BaseModel):
    """Partner co-sell opportunity."""
    partner: str = Field(..., description="Partner name")
    relationship: str = Field(..., description="Technical Partner, SI, Agency, etc.")
    partner_tier: Optional[str] = Field(None, description="Premium, Standard, etc.")
    motion: str = Field(..., description="Co-sell motion description")
    partner_contact: Optional[str] = Field(None, description="How to engage partner")
    co_sell_priority: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")


class CompetitiveDisplacement(BaseModel):
    """Competitive landscape for search providers."""
    competitors_on_algolia: int = Field(default=0)
    competitors_on_other_ai_search: int = Field(default=0)
    competitors_on_elasticsearch: int = Field(default=0)
    competitors_on_native: int = Field(default=0)
    first_mover_advantage: bool = Field(default=False)
    lighthouse_opportunity: Optional[str] = Field(
        None,
        description="Potential lighthouse customer positioning"
    )


class AlgoliaFitScore(BaseModel):
    """Algolia fit assessment."""
    technical_fit: int = Field(default=5, ge=0, le=10)
    business_fit: int = Field(default=5, ge=0, le=10)
    timing_fit: int = Field(default=5, ge=0, le=10)
    overall: float = Field(default=5.0, ge=0.0, le=10.0)

    technical_reasoning: Optional[str] = Field(None)
    business_reasoning: Optional[str] = Field(None)
    timing_reasoning: Optional[str] = Field(None)


class DisplacementAnalysisData(BaseModel):
    """
    Output schema for M11 Displacement Analysis module.

    Contains displacement opportunity assessment and partner motions.
    """

    domain: str = Field(..., description="Primary domain")

    # Displacement analysis
    displacement_opportunity: DisplacementOpportunity = Field(
        default_factory=DisplacementOpportunity
    )

    # Partner opportunities
    partner_co_sell_opportunities: List[PartnerCoSellOpportunity] = Field(
        default_factory=list
    )

    # Competitive landscape
    competitive_displacement: CompetitiveDisplacement = Field(
        default_factory=CompetitiveDisplacement
    )

    # Algolia fit
    algolia_fit_score: AlgoliaFitScore = Field(
        default_factory=AlgoliaFitScore
    )

    # Recommended products
    recommended_products: List[str] = Field(
        default_factory=list,
        description="Algolia products to pitch"
    )

    # Priority
    displacement_priority: str = Field(
        default="MEDIUM",
        description="HIGH, MEDIUM, LOW based on analysis"
    )
    priority_reasoning: Optional[str] = Field(None)

    # Metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)
    data_limitation_reason: Optional[str] = Field(None)


# Search provider classification
SEARCH_PROVIDERS = {
    # Competitors - HIGH displacement value
    "elasticsearch": {"type": "Competitor", "difficulty": "MEDIUM"},
    "elastic": {"type": "Competitor", "difficulty": "MEDIUM"},
    "solr": {"type": "Competitor", "difficulty": "MEDIUM"},
    "searchspring": {"type": "Competitor", "difficulty": "LOW"},
    "klevu": {"type": "Competitor", "difficulty": "LOW"},
    "constructor": {"type": "Competitor", "difficulty": "MEDIUM"},
    "constructor.io": {"type": "Competitor", "difficulty": "MEDIUM"},
    "coveo": {"type": "Competitor", "difficulty": "HIGH"},
    "bloomreach": {"type": "Competitor", "difficulty": "HIGH"},
    "lucidworks": {"type": "Competitor", "difficulty": "HIGH"},

    # Native platform - MEDIUM displacement
    "salesforce einstein": {"type": "Native Platform", "difficulty": "LOW"},
    "sfcc search": {"type": "Native Platform", "difficulty": "LOW"},
    "shopify search": {"type": "Native Platform", "difficulty": "LOW"},
    "magento search": {"type": "Native Platform", "difficulty": "LOW"},
    "bigcommerce search": {"type": "Native Platform", "difficulty": "LOW"},
    "woocommerce search": {"type": "Native Platform", "difficulty": "LOW"},

    # Algolia - already customer
    "algolia": {"type": "Algolia", "difficulty": "N/A"},
}

# Partner technology mappings
PARTNER_TECH_MAP = {
    "salesforce commerce cloud": {
        "partner": "Salesforce Commerce Cloud",
        "relationship": "Technical Partner",
        "tier": "Premium",
        "motion": "Algolia SFCC Cartridge - plug-and-play replacement",
        "contact": "Salesforce Account Team",
    },
    "shopify": {
        "partner": "Shopify",
        "relationship": "Technical Partner",
        "tier": "Premium",
        "motion": "Algolia Shopify Integration - native app",
        "contact": "Shopify Partner Team",
    },
    "adobe commerce": {
        "partner": "Adobe Commerce",
        "relationship": "Technical Partner",
        "tier": "Premium",
        "motion": "Algolia Magento Extension",
        "contact": "Adobe Account Team",
    },
    "adobe aem": {
        "partner": "Adobe Experience Manager",
        "relationship": "Technical Partner",
        "tier": "Premium",
        "motion": "Algolia AEM Integration",
        "contact": "Adobe Account Team",
    },
    "bigcommerce": {
        "partner": "BigCommerce",
        "relationship": "Technical Partner",
        "tier": "Standard",
        "motion": "Algolia BigCommerce Integration",
        "contact": "BigCommerce Partner Team",
    },
    "contentful": {
        "partner": "Contentful",
        "relationship": "Technical Partner",
        "tier": "Standard",
        "motion": "Algolia + Contentful headless search",
        "contact": "Contentful Partner Team",
    },
}

# Algolia products by use case
ALGOLIA_PRODUCTS = {
    "core_search": [
        "Algolia Search",
        "Algolia InstantSearch",
    ],
    "ai_features": [
        "Algolia NeuralSearch",
        "Algolia Query Suggestions",
        "Algolia Dynamic Re-Ranking",
    ],
    "personalization": [
        "Algolia Personalization",
        "Algolia AI Recommendations",
    ],
    "merchandising": [
        "Algolia Merchandising Studio",
        "Algolia Rules",
    ],
    "analytics": [
        "Algolia Analytics",
        "Algolia A/B Testing",
    ],
}


@register_module
class M11DisplacementAnalysis(BaseModule):
    """
    Displacement Analysis Module.

    Calculates displacement opportunity score and identifies co-sell motions.

    Wave 3 - Depends on M02 (required) and M05 (optional)

    Data Flow:
    1. Get tech stack from M02 (current search provider, partner tech)
    2. Get competitor data from M05 (competitor search providers)
    3. Classify current provider and displacement difficulty
    4. Identify partner co-sell opportunities
    5. Analyze competitive landscape
    6. Calculate Algolia fit score
    7. Recommend products
    8. Return with source citations
    """

    MODULE_ID = "m11_displacement_analysis"
    MODULE_NAME = "Displacement Analysis"
    DESCRIPTION = "Displacement opportunity and partner co-sell analysis"

    WAVE = 3
    DEPENDS_ON = ["m02_technology_stack"]  # M05 is optional

    PRIMARY_SOURCE_TYPE = SourceType.BUILTWITH
    OUTPUT_TABLE = "intel_displacement_analysis"
    TIMEOUT_SECONDS = 45

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute displacement analysis.

        Args:
            domain: The domain to analyze
            context: Results from M02 (required) and M05 (optional)

        Returns:
            ModuleResult with DisplacementAnalysisData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting displacement analysis for {domain}")

            # Validate dependencies
            context = context or {}
            self.validate_dependencies(context)

            normalized_domain = self._normalize_domain(domain)

            # Get tech stack from M02
            m02_data = context.get("m02_technology_stack", {})
            if isinstance(m02_data, ModuleResult):
                m02_data = m02_data.data

            # Get competitor data from M05 (optional)
            m05_data = context.get("m05_competitor_intelligence", {})
            if isinstance(m05_data, ModuleResult):
                m05_data = m05_data.data

            # Analyze displacement opportunity
            displacement = self._analyze_displacement(m02_data)

            # Identify partner opportunities
            partner_opportunities = self._identify_partner_opportunities(m02_data)

            # Analyze competitive landscape
            competitive = self._analyze_competitive_landscape(m05_data)

            # Calculate Algolia fit
            fit_score = self._calculate_algolia_fit(
                m02_data, displacement, competitive
            )

            # Recommend products
            recommended_products = self._recommend_products(m02_data, displacement)

            # Calculate overall priority
            priority, reasoning = self._calculate_priority(
                displacement, fit_score, competitive
            )

            # Create citations
            citations = [
                self._create_citation(
                    source_type=SourceType.BUILTWITH,
                    source_url=f"https://builtwith.com/{normalized_domain}",
                    confidence=0.9,
                    notes="Tech stack analysis from M02",
                )
            ]

            # Build output
            output_data = DisplacementAnalysisData(
                domain=normalized_domain,
                displacement_opportunity=displacement,
                partner_co_sell_opportunities=partner_opportunities,
                competitive_displacement=competitive,
                algolia_fit_score=fit_score,
                recommended_products=recommended_products,
                displacement_priority=priority,
                priority_reasoning=reasoning,
                data_quality_score=self._calculate_data_quality(
                    displacement, partner_opportunities, fit_score
                ),
                enrichment_sources=[c.source_type.value for c in citations],
            )

            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=True, duration_ms=duration_ms)

            result = self._create_result(
                domain=normalized_domain,
                data=output_data.model_dump(),
                primary_citation=citations[0],
                supporting_citations=citations[1:] if len(citations) > 1 else [],
                duration_ms=duration_ms,
            )

            self.validate_output(result)

            self.logger.info(
                f"Displacement analysis complete for {domain}. "
                f"Current: {displacement.current_search_provider}, "
                f"Difficulty: {displacement.displacement_difficulty}, "
                f"Priority: {priority}. Duration: {duration_ms:.0f}ms"
            )

            return result

        except DependencyNotMetError:
            raise
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Displacement analysis failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")
        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")
        return True

    def _analyze_displacement(
        self,
        tech_data: Dict[str, Any],
    ) -> DisplacementOpportunity:
        """Analyze current search provider for displacement."""
        search_info = tech_data.get("search_provider", {})
        current_provider = search_info.get("current", "")
        is_algolia = search_info.get("is_algolia", False)

        if is_algolia:
            return DisplacementOpportunity(
                current_search_provider="Algolia",
                provider_type="Algolia",
                is_algolia=True,
                displacement_difficulty="N/A",
                reasoning="Already an Algolia customer - upsell opportunity",
            )

        # Classify the provider
        provider_lower = current_provider.lower() if current_provider else ""
        provider_info = None

        for provider_key, info in SEARCH_PROVIDERS.items():
            if provider_key in provider_lower:
                provider_info = info
                break

        if provider_info:
            provider_type = provider_info["type"]
            difficulty = provider_info["difficulty"]
        elif current_provider:
            provider_type = "Unknown"
            difficulty = "MEDIUM"
        else:
            provider_type = "None Detected"
            difficulty = "LOW"

        # Generate reasoning
        reasoning = self._generate_displacement_reasoning(
            current_provider, provider_type, difficulty
        )

        return DisplacementOpportunity(
            current_search_provider=current_provider or "None detected",
            provider_type=provider_type,
            is_algolia=False,
            displacement_difficulty=difficulty,
            reasoning=reasoning,
        )

    def _generate_displacement_reasoning(
        self,
        provider: str,
        provider_type: str,
        difficulty: str,
    ) -> str:
        """Generate reasoning for displacement difficulty."""
        if not provider or provider_type == "None Detected":
            return "No third-party search detected - clean implementation opportunity"

        if provider_type == "Native Platform":
            return f"Native {provider} search - easy replacement with Algolia integration"

        if provider_type == "Competitor":
            if difficulty == "HIGH":
                return f"Enterprise {provider} deployment - significant migration effort but high value"
            elif difficulty == "MEDIUM":
                return f"{provider} in use - competitive displacement opportunity"
            else:
                return f"{provider} detected - relatively straightforward replacement"

        return f"{provider} detected - evaluate switching costs"

    def _identify_partner_opportunities(
        self,
        tech_data: Dict[str, Any],
    ) -> List[PartnerCoSellOpportunity]:
        """Identify partner co-sell opportunities from tech stack."""
        opportunities = []
        partner_techs = tech_data.get("partner_technologies", [])
        technologies = tech_data.get("technologies", [])

        # Check for partner technologies
        checked_partners = set()

        for tech in partner_techs + [t.get("name", "") for t in technologies if isinstance(t, dict)]:
            tech_lower = tech.lower() if isinstance(tech, str) else ""

            for partner_key, partner_info in PARTNER_TECH_MAP.items():
                if partner_key in tech_lower and partner_key not in checked_partners:
                    checked_partners.add(partner_key)
                    opportunity = PartnerCoSellOpportunity(
                        partner=partner_info["partner"],
                        relationship=partner_info["relationship"],
                        partner_tier=partner_info.get("tier"),
                        motion=partner_info["motion"],
                        partner_contact=partner_info.get("contact"),
                        co_sell_priority="HIGH" if partner_info.get("tier") == "Premium" else "MEDIUM",
                    )
                    opportunities.append(opportunity)

        return opportunities

    def _analyze_competitive_landscape(
        self,
        competitor_data: Dict[str, Any],
    ) -> CompetitiveDisplacement:
        """Analyze competitor search landscape."""
        if not competitor_data:
            return CompetitiveDisplacement()

        competitors = competitor_data.get("competitors", [])
        landscape = competitor_data.get("competitor_search_landscape", {})

        algolia_count = landscape.get("algolia_users", 0)
        other_ai_count = landscape.get("constructor_users", 0)
        elastic_count = landscape.get("elasticsearch_users", 0)
        native_count = landscape.get("native_search_users", 0)

        first_mover = algolia_count == 0

        # Determine lighthouse opportunity
        lighthouse = None
        if first_mover:
            positioning = competitor_data.get("competitive_positioning", "")
            if positioning:
                lighthouse = positioning

        return CompetitiveDisplacement(
            competitors_on_algolia=algolia_count,
            competitors_on_other_ai_search=other_ai_count,
            competitors_on_elasticsearch=elastic_count,
            competitors_on_native=native_count,
            first_mover_advantage=first_mover,
            lighthouse_opportunity=lighthouse,
        )

    def _calculate_algolia_fit(
        self,
        tech_data: Dict[str, Any],
        displacement: DisplacementOpportunity,
        competitive: CompetitiveDisplacement,
    ) -> AlgoliaFitScore:
        """Calculate Algolia fit score."""
        # Technical fit
        tech_fit = 5
        tech_reasoning = []

        # Partner tech bonus
        if tech_data.get("partner_technologies"):
            tech_fit += 2
            tech_reasoning.append("Partner technology integration available")

        # Easy displacement bonus
        if displacement.displacement_difficulty in ["LOW", "MEDIUM"]:
            tech_fit += 2
            tech_reasoning.append("Straightforward technical migration")

        # Already on competitor - knows the space
        if displacement.provider_type == "Competitor":
            tech_fit += 1
            tech_reasoning.append("Already using search technology - understands value")

        tech_fit = min(10, tech_fit)

        # Business fit
        biz_fit = 5
        biz_reasoning = []

        # First mover advantage
        if competitive.first_mover_advantage:
            biz_fit += 2
            biz_reasoning.append("First-mover advantage in vertical")

        # Lighthouse opportunity
        if competitive.lighthouse_opportunity:
            biz_fit += 2
            biz_reasoning.append("Potential lighthouse customer")

        # E-commerce detected
        categories = tech_data.get("technology_by_category", {})
        if categories.get("ecommerce"):
            biz_fit += 1
            biz_reasoning.append("E-commerce platform detected - high value use case")

        biz_fit = min(10, biz_fit)

        # Timing fit (would need M07 Strategic Context for full picture)
        timing_fit = 6
        timing_reasoning = ["Default timing assessment"]

        overall = (tech_fit + biz_fit + timing_fit) / 3

        return AlgoliaFitScore(
            technical_fit=tech_fit,
            business_fit=biz_fit,
            timing_fit=timing_fit,
            overall=round(overall, 1),
            technical_reasoning="; ".join(tech_reasoning) if tech_reasoning else None,
            business_reasoning="; ".join(biz_reasoning) if biz_reasoning else None,
            timing_reasoning="; ".join(timing_reasoning) if timing_reasoning else None,
        )

    def _recommend_products(
        self,
        tech_data: Dict[str, Any],
        displacement: DisplacementOpportunity,
    ) -> List[str]:
        """Recommend Algolia products based on analysis."""
        products = []

        # Core search always
        products.extend(ALGOLIA_PRODUCTS["core_search"])

        # AI features for competitive displacement
        if displacement.provider_type == "Competitor":
            products.extend(ALGOLIA_PRODUCTS["ai_features"])

        # Personalization for retail
        categories = tech_data.get("technology_by_category", {})
        if categories.get("ecommerce"):
            products.extend(ALGOLIA_PRODUCTS["personalization"])
            products.extend(ALGOLIA_PRODUCTS["merchandising"])

        # Analytics always useful
        products.append("Algolia Analytics")

        # Deduplicate
        return list(dict.fromkeys(products))

    def _calculate_priority(
        self,
        displacement: DisplacementOpportunity,
        fit_score: AlgoliaFitScore,
        competitive: CompetitiveDisplacement,
    ) -> Tuple[str, str]:
        """Calculate overall displacement priority."""
        score = 0
        reasons = []

        # Already Algolia - not a displacement target
        if displacement.is_algolia:
            return "N/A", "Already Algolia customer - upsell motion"

        # Displacement difficulty
        if displacement.displacement_difficulty == "LOW":
            score += 3
            reasons.append("Low switching cost")
        elif displacement.displacement_difficulty == "MEDIUM":
            score += 2
            reasons.append("Moderate switching effort")
        elif displacement.displacement_difficulty == "HIGH":
            score += 1
            reasons.append("High-value but complex displacement")

        # Fit score
        if fit_score.overall >= 8:
            score += 3
            reasons.append("Excellent Algolia fit")
        elif fit_score.overall >= 6:
            score += 2
            reasons.append("Good Algolia fit")

        # First mover
        if competitive.first_mover_advantage:
            score += 2
            reasons.append("First-mover advantage")

        # Lighthouse opportunity
        if competitive.lighthouse_opportunity:
            score += 1
            reasons.append("Lighthouse potential")

        # Determine priority
        if score >= 7:
            priority = "HIGH"
        elif score >= 4:
            priority = "MEDIUM"
        else:
            priority = "LOW"

        reasoning = "; ".join(reasons) if reasons else "Standard opportunity"
        return priority, reasoning

    def _calculate_data_quality(
        self,
        displacement: DisplacementOpportunity,
        partners: List[PartnerCoSellOpportunity],
        fit_score: AlgoliaFitScore,
    ) -> float:
        """Calculate data quality score."""
        score = 0.0

        # Displacement analysis
        if displacement.current_search_provider:
            score += 0.3
        if displacement.reasoning:
            score += 0.2

        # Partner opportunities
        if partners:
            score += 0.2

        # Fit score with reasoning
        if fit_score.technical_reasoning:
            score += 0.15
        if fit_score.business_reasoning:
            score += 0.15

        return min(score, 1.0)

    def _normalize_domain(self, domain: str) -> str:
        """Normalize domain."""
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
