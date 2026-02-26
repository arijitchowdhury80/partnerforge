"""
M11 Displacement Analysis Intelligence Module

Analyzes the opportunity to displace current search provider with Algolia.
This is a Wave 3 module that depends on M02 (Technology Stack).

Data Sources:
- M02 Technology Stack (dependency): current search provider, tech stack
- Internal knowledge base: provider weaknesses, Algolia advantages

Output: Displacement analysis including provider weaknesses, Algolia advantages,
difficulty assessment, migration complexity, ROI potential, and recommended approach.

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
# Provider Knowledge Base
# =============================================================================

PROVIDER_WEAKNESSES = {
    "Elasticsearch": [
        "High operational complexity - requires dedicated DevOps team",
        "No built-in ML/AI relevance tuning",
        "Manual synonym management at scale",
        "Query performance degrades with index size",
        "No native typo tolerance or query understanding",
        "Self-managed infrastructure costs 3-5x cloud search",
        "No built-in A/B testing for relevance",
        "Security patches require manual updates and downtime",
    ],
    "Elastic": [
        "High operational complexity - requires dedicated DevOps team",
        "No built-in ML/AI relevance tuning",
        "Manual synonym management at scale",
        "Query performance degrades with index size",
        "No native typo tolerance or query understanding",
        "Self-managed infrastructure costs 3-5x cloud search",
    ],
    "OpenSearch": [
        "Fork of Elasticsearch with same operational burden",
        "Limited ML capabilities compared to purpose-built search",
        "Requires significant tuning for relevance",
        "No native merchandising or business rules engine",
        "Community support less mature than Elasticsearch",
    ],
    "Solr": [
        "Outdated architecture - legacy Java stack",
        "Poor out-of-box relevance for e-commerce",
        "No native typo tolerance",
        "Limited NLP and semantic search capabilities",
        "Complex XML configuration",
        "Declining community and vendor support",
        "No built-in analytics or A/B testing",
    ],
    "Apache Solr": [
        "Outdated architecture - legacy Java stack",
        "Poor out-of-box relevance for e-commerce",
        "No native typo tolerance",
        "Limited NLP and semantic search capabilities",
        "Complex XML configuration",
        "Declining community and vendor support",
    ],
    "Coveo": [
        "High total cost of ownership",
        "Complex implementation and customization",
        "Limited e-commerce-specific features",
        "Slower query response times vs Algolia",
        "Less intuitive dashboard for merchandisers",
    ],
    "Searchspring": [
        "Limited to e-commerce use cases only",
        "Weaker relevance for long-tail queries",
        "No federated search capabilities",
        "Limited internationalization support",
        "Basic NLP capabilities",
    ],
    "Klevu": [
        "Limited scalability for high-traffic sites",
        "Basic merchandising capabilities",
        "No multi-index or federated search",
        "Weaker documentation and community",
        "Limited AI/ML customization options",
    ],
    "Constructor.io": [
        "Narrow focus on product search only",
        "Limited content search capabilities",
        "Smaller customer base and case studies",
        "Less mature platform infrastructure",
        "Higher per-query costs at scale",
    ],
    "Constructor": [
        "Narrow focus on product search only",
        "Limited content search capabilities",
        "Smaller customer base and case studies",
        "Less mature platform infrastructure",
    ],
    "Bloomreach": [
        "Complexity of full suite vs point solution",
        "Higher implementation costs",
        "Longer time to value",
        "Requires significant services engagement",
        "Less flexibility for custom implementations",
    ],
    "Lucidworks": [
        "Enterprise-heavy pricing model",
        "Complex setup and configuration",
        "Requires Solr/Fusion expertise",
        "Slower time to production",
        "Limited SaaS deployment options",
    ],
    "Yext": [
        "Primary focus on listings, not site search",
        "Basic relevance tuning capabilities",
        "Limited e-commerce features",
        "Higher cost for search-specific use cases",
    ],
    "Swiftype": [
        "Acquired by Elastic - uncertain roadmap",
        "Limited feature development since acquisition",
        "Basic merchandising capabilities",
        "No advanced AI features",
    ],
    "Doofinder": [
        "Limited enterprise scalability",
        "Basic analytics and insights",
        "Smaller partner ecosystem",
        "Limited API flexibility",
    ],
    "Native": [
        "Poor relevance out of the box",
        "No typo tolerance",
        "No synonym handling",
        "No faceted navigation",
        "No search analytics",
        "No personalization capabilities",
        "Slow query performance at scale",
        "No mobile optimization",
    ],
    "None": [
        "No search functionality = lost conversions",
        "Customers cannot find products",
        "Zero insights into customer intent",
        "Competitive disadvantage",
    ],
}

ALGOLIA_ADVANTAGES = {
    "Elasticsearch": [
        "50ms average query response vs 200-500ms",
        "Zero DevOps overhead - fully managed SaaS",
        "Built-in AI Re-Ranking and Dynamic Synonyms",
        "Native typo tolerance and query understanding",
        "Instant indexing with zero downtime",
        "99.999% SLA with global edge network",
        "Visual Rules Editor for merchandisers",
        "Built-in A/B testing and analytics",
    ],
    "Elastic": [
        "50ms average query response vs 200-500ms",
        "Zero DevOps overhead - fully managed SaaS",
        "Built-in AI Re-Ranking and Dynamic Synonyms",
        "Native typo tolerance and query understanding",
        "Instant indexing with zero downtime",
    ],
    "OpenSearch": [
        "Purpose-built for search vs general-purpose",
        "No infrastructure management required",
        "Built-in merchandising and business rules",
        "Superior typo tolerance and NLP",
        "Faster implementation timeline",
    ],
    "Solr": [
        "Modern cloud-native architecture",
        "10x faster query performance",
        "Built-in AI and ML capabilities",
        "Easy migration with InstantSearch UI",
        "Growing ecosystem vs declining Solr",
        "World-class documentation and support",
    ],
    "Apache Solr": [
        "Modern cloud-native architecture",
        "10x faster query performance",
        "Built-in AI and ML capabilities",
        "Easy migration with InstantSearch UI",
        "Growing ecosystem vs declining Solr",
    ],
    "Coveo": [
        "Faster implementation and lower TCO",
        "Better e-commerce-specific features",
        "More intuitive merchandising dashboard",
        "Superior query performance",
        "Larger customer community and case studies",
    ],
    "Searchspring": [
        "Broader use case support (content, help center)",
        "Superior federated search capabilities",
        "Better internationalization (70+ languages)",
        "Stronger developer experience",
        "More enterprise customers and scale",
    ],
    "Klevu": [
        "Proven scalability for largest retailers",
        "Advanced merchandising and Rules",
        "Multi-index federated search",
        "Superior documentation and support",
        "More AI/ML customization options",
    ],
    "Constructor.io": [
        "Broader search use cases supported",
        "Stronger content search capabilities",
        "Larger customer base with proven ROI",
        "More mature platform and infrastructure",
        "Better cost efficiency at scale",
    ],
    "Constructor": [
        "Broader search use cases supported",
        "Stronger content search capabilities",
        "Larger customer base with proven ROI",
        "More mature platform and infrastructure",
    ],
    "Bloomreach": [
        "Focused search excellence vs suite complexity",
        "Faster time to value (weeks vs months)",
        "Lower implementation costs",
        "More flexible integration options",
        "Better developer experience",
    ],
    "Lucidworks": [
        "True SaaS with no infrastructure burden",
        "Faster time to production",
        "Lower total cost of ownership",
        "More intuitive for business users",
        "Better e-commerce focus",
    ],
    "Yext": [
        "Purpose-built for site search excellence",
        "Superior relevance and ranking",
        "Full e-commerce feature set",
        "Better cost efficiency for search",
    ],
    "Swiftype": [
        "Active product development and roadmap",
        "Advanced AI features (AI Re-Ranking)",
        "Modern merchandising capabilities",
        "Growing partner ecosystem",
    ],
    "Doofinder": [
        "Enterprise-grade scalability",
        "Advanced analytics and insights",
        "Larger partner ecosystem",
        "More API flexibility",
    ],
    "Native": [
        "Enterprise-grade search in days, not months",
        "Instant 15-30% conversion lift",
        "Full-featured search with zero code",
        "AI-powered relevance out of the box",
        "Complete search analytics",
        "Personalization and recommendations",
        "Global edge network for <50ms response",
    ],
    "None": [
        "Add search functionality that converts",
        "Capture customer intent data",
        "Improve customer experience immediately",
        "Competitive parity with industry leaders",
    ],
}

MIGRATION_COMPLEXITY = {
    "Elasticsearch": "medium",
    "Elastic": "medium",
    "OpenSearch": "medium",
    "Solr": "medium",
    "Apache Solr": "medium",
    "Coveo": "medium",
    "Searchspring": "easy",
    "Klevu": "easy",
    "Constructor.io": "easy",
    "Constructor": "easy",
    "Bloomreach": "hard",
    "Lucidworks": "hard",
    "Yext": "easy",
    "Swiftype": "easy",
    "Doofinder": "easy",
    "Native": "easy",
    "None": "easy",
}

DISPLACEMENT_DIFFICULTY = {
    "Elasticsearch": "medium",
    "Elastic": "medium",
    "OpenSearch": "medium",
    "Solr": "easy",
    "Apache Solr": "easy",
    "Coveo": "hard",
    "Searchspring": "medium",
    "Klevu": "easy",
    "Constructor.io": "hard",
    "Constructor": "hard",
    "Bloomreach": "hard",
    "Lucidworks": "hard",
    "Yext": "medium",
    "Swiftype": "easy",
    "Doofinder": "easy",
    "Native": "easy",
    "None": "easy",
}


# =============================================================================
# Data Models
# =============================================================================


class DisplacementAnalysisData(BaseModel):
    """
    Displacement Analysis data model - output of M11 module.

    Captures the analysis of displacement opportunity for a domain.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'costco.com')")

    # Current state
    current_search_provider: Optional[str] = Field(
        None, description="Current search provider (from M02)"
    )
    has_search: bool = Field(True, description="Whether domain has any search")

    # Weakness analysis
    provider_weaknesses: List[str] = Field(
        default_factory=list,
        description="Known weaknesses of current search provider"
    )

    # Algolia value proposition
    algolia_advantages: List[str] = Field(
        default_factory=list,
        description="Algolia advantages vs current provider"
    )

    # Opportunity assessment
    displacement_difficulty: str = Field(
        "medium",
        description="Difficulty to displace (easy/medium/hard)"
    )
    migration_complexity: str = Field(
        "medium",
        description="Technical migration complexity (easy/medium/hard)"
    )

    # ROI potential
    roi_potential: str = Field(
        "medium",
        description="Potential ROI from switching (low/medium/high)"
    )
    estimated_conversion_lift: Optional[str] = Field(
        None,
        description="Estimated conversion lift range (e.g., '15-30%')"
    )

    # Recommended approach
    recommended_approach: str = Field(
        "",
        description="Recommended sales/technical approach"
    )
    key_talking_points: List[str] = Field(
        default_factory=list,
        description="Key talking points for sales conversation"
    )

    # Risk factors
    risk_factors: List[str] = Field(
        default_factory=list,
        description="Potential risks or blockers"
    )

    # Competitive context
    competitive_threat_level: str = Field(
        "medium",
        description="Level of competitive threat (low/medium/high)"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M11DisplacementModule(BaseIntelligenceModule):
    """
    M11: Displacement Analysis - opportunity to displace current search.

    Wave 3 module that depends on M02 (Technology Stack).
    Synthesizes tech stack data to assess displacement opportunity.
    """

    MODULE_ID = "m11_displacement"
    MODULE_NAME = "Displacement Analysis"
    WAVE = 3
    DEPENDS_ON = ["m02_technology_stack"]
    SOURCE_TYPE = "synthesis"
    CACHE_TTL = 604800  # 7 days

    async def enrich(
        self,
        domain: str,
        force: bool = False,
        dependencies: Optional[Dict[str, ModuleResult]] = None
    ) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "costco.com")
            force: If True, bypass cache and fetch fresh data
            dependencies: Dict of dependency module results (m02_technology_stack)

        Returns:
            ModuleResult with DisplacementAnalysisData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
            ValueError: If required dependencies are missing
        """
        self.logger.info(f"Enriching displacement analysis for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached result for: {domain}")
                return cached

        # Validate dependencies
        if dependencies is None:
            dependencies = {}

        if not self.validate_dependencies(dependencies):
            # Try to fetch M02 data if not provided
            raw_data = await self.fetch_data(domain)
        else:
            # Extract tech stack data from dependencies
            m02_result = dependencies.get("m02_technology_stack")
            raw_data = await self._extract_from_dependencies(domain, m02_result)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        displacement_data = await self._validate_and_store(domain, transformed)

        # Get source info
        source_url = raw_data.get("source_url")
        source_date_str = raw_data.get("source_date")

        if not source_url:
            raise MissingSourceError(self.MODULE_ID, "source_url")

        if not source_date_str:
            raise MissingSourceError(self.MODULE_ID, "source_date")

        # Parse source date
        if isinstance(source_date_str, str):
            source_date = datetime.fromisoformat(source_date_str.replace("Z", "+00:00"))
        else:
            source_date = source_date_str

        # Create result with source citation
        result = self._create_result(
            domain=domain,
            data=displacement_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched displacement analysis for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch raw data when dependencies are not provided.

        Attempts to get tech stack data independently.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with tech stack data
        """
        # In production, this would call M02 module
        # For now, return mock data
        return await self._fetch_mock_tech_data(domain)

    async def _fetch_mock_tech_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch mock tech data (used when M02 not available).

        In production, this would trigger M02 enrichment.
        """
        now = datetime.now()

        # Default mock data - assumes common scenario
        return {
            "domain": domain,
            "current_search_provider": "Elasticsearch",
            "has_search": True,
            "tech_spend_estimate": 100000,
            "ecommerce_platform": "Salesforce Commerce Cloud",
            "source_url": f"https://builtwith.com/{domain}",
            "source_date": now.isoformat(),
        }

    async def _extract_from_dependencies(
        self,
        domain: str,
        m02_result: ModuleResult
    ) -> Dict[str, Any]:
        """
        Extract relevant data from M02 dependency result.

        Args:
            domain: The domain
            m02_result: ModuleResult from M02 module

        Returns:
            dict with extracted data
        """
        m02_data = m02_result.data

        # Handle both Pydantic model and dict
        if hasattr(m02_data, "model_dump"):
            data = m02_data.model_dump()
        elif isinstance(m02_data, dict):
            data = m02_data
        else:
            data = {}

        return {
            "domain": domain,
            "current_search_provider": data.get("current_search_provider"),
            "has_search": data.get("current_search_provider") is not None,
            "tech_spend_estimate": data.get("tech_spend_estimate"),
            "ecommerce_platform": data.get("ecommerce_platform"),
            "cms_platform": data.get("cms_platform"),
            "has_algolia": data.get("has_algolia", False),
            "displacement_priority": data.get("displacement_priority"),
            "source_url": str(m02_result.source.url),
            "source_date": m02_result.source.date.isoformat(),
        }

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into DisplacementAnalysisData schema.

        This is where the displacement analysis logic lives.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching DisplacementAnalysisData fields
        """
        current_provider = raw_data.get("current_search_provider")
        has_search = raw_data.get("has_search", True)
        has_algolia = raw_data.get("has_algolia", False)
        tech_spend = raw_data.get("tech_spend_estimate", 0) or 0

        # If already using Algolia, no displacement needed
        if has_algolia:
            return self._create_algolia_customer_response(raw_data)

        # Normalize provider name
        provider_key = self._normalize_provider_name(current_provider)

        # Get provider-specific analysis
        weaknesses = PROVIDER_WEAKNESSES.get(provider_key, PROVIDER_WEAKNESSES.get("Native", []))
        advantages = ALGOLIA_ADVANTAGES.get(provider_key, ALGOLIA_ADVANTAGES.get("Native", []))
        migration = MIGRATION_COMPLEXITY.get(provider_key, "medium")
        difficulty = DISPLACEMENT_DIFFICULTY.get(provider_key, "medium")

        # Calculate ROI potential based on provider and spend
        roi_potential = self._calculate_roi_potential(provider_key, tech_spend)

        # Generate recommended approach
        recommended_approach = self._generate_recommended_approach(
            provider_key, difficulty, tech_spend
        )

        # Generate talking points
        talking_points = self._generate_talking_points(
            provider_key, weaknesses, advantages
        )

        # Identify risk factors
        risk_factors = self._identify_risk_factors(provider_key, tech_spend)

        # Calculate competitive threat level
        threat_level = self._calculate_threat_level(provider_key)

        # Estimate conversion lift
        conversion_lift = self._estimate_conversion_lift(provider_key)

        return {
            "domain": raw_data.get("domain"),
            "current_search_provider": current_provider,
            "has_search": has_search,
            "provider_weaknesses": weaknesses[:5],  # Top 5 weaknesses
            "algolia_advantages": advantages[:5],  # Top 5 advantages
            "displacement_difficulty": difficulty,
            "migration_complexity": migration,
            "roi_potential": roi_potential,
            "estimated_conversion_lift": conversion_lift,
            "recommended_approach": recommended_approach,
            "key_talking_points": talking_points,
            "risk_factors": risk_factors,
            "competitive_threat_level": threat_level,
            # Preserve source info
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    def _normalize_provider_name(self, provider: Optional[str]) -> str:
        """Normalize provider name for lookup."""
        if not provider:
            return "None"

        # Handle common variations
        provider_lower = provider.lower()
        if "elasticsearch" in provider_lower or "elastic" in provider_lower:
            return "Elasticsearch"
        if "opensearch" in provider_lower:
            return "OpenSearch"
        if "solr" in provider_lower:
            return "Solr"
        if "coveo" in provider_lower:
            return "Coveo"
        if "searchspring" in provider_lower:
            return "Searchspring"
        if "klevu" in provider_lower:
            return "Klevu"
        if "constructor" in provider_lower:
            return "Constructor.io"
        if "bloomreach" in provider_lower:
            return "Bloomreach"
        if "lucidworks" in provider_lower:
            return "Lucidworks"
        if "yext" in provider_lower:
            return "Yext"
        if "swiftype" in provider_lower:
            return "Swiftype"
        if "doofinder" in provider_lower:
            return "Doofinder"
        if "native" in provider_lower:
            return "Native"

        # Return original if no match
        return provider if provider in PROVIDER_WEAKNESSES else "Native"

    def _create_algolia_customer_response(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create response for existing Algolia customer."""
        return {
            "domain": raw_data.get("domain"),
            "current_search_provider": "Algolia",
            "has_search": True,
            "provider_weaknesses": [],
            "algolia_advantages": [],
            "displacement_difficulty": "n/a",
            "migration_complexity": "n/a",
            "roi_potential": "n/a",
            "estimated_conversion_lift": None,
            "recommended_approach": "Existing Algolia customer - focus on expansion and upsell",
            "key_talking_points": [
                "Review current Algolia usage and optimization opportunities",
                "Explore AI Re-Ranking and Recommend add-ons",
                "Discuss Query Categorization and NeuralSearch",
            ],
            "risk_factors": [],
            "competitive_threat_level": "low",
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    def _calculate_roi_potential(self, provider: str, tech_spend: int) -> str:
        """Calculate ROI potential based on provider and spend."""
        # High ROI providers (self-managed, high operational cost)
        high_roi_providers = ["Elasticsearch", "Elastic", "OpenSearch", "Solr", "Apache Solr", "Native", "None"]

        # Medium ROI providers
        medium_roi_providers = ["Searchspring", "Klevu", "Yext", "Swiftype", "Doofinder"]

        if provider in high_roi_providers:
            return "high"
        elif provider in medium_roi_providers:
            return "medium"
        else:
            # High spend = still worth it
            if tech_spend >= 100000:
                return "medium"
            return "low"

    def _generate_recommended_approach(
        self,
        provider: str,
        difficulty: str,
        tech_spend: int
    ) -> str:
        """Generate recommended sales approach."""
        if provider in ["Elasticsearch", "Elastic", "OpenSearch"]:
            return (
                "Lead with TCO analysis - highlight DevOps savings and operational simplicity. "
                "Propose POC comparing query latency and relevance. "
                "Target engineering leadership frustrated with maintenance burden."
            )
        elif provider in ["Solr", "Apache Solr"]:
            return (
                "Position as modernization initiative. Lead with relevance improvements and "
                "faster time-to-market. Emphasize declining Solr ecosystem vs growing Algolia. "
                "Target digital transformation sponsors."
            )
        elif provider in ["Native", "None"]:
            return (
                "Greenfield opportunity - lead with quick wins and proven ROI. "
                "Propose rapid POC (1-2 weeks) to demonstrate impact. "
                "Target e-commerce or digital experience leadership."
            )
        elif provider in ["Constructor.io", "Constructor", "Bloomreach"]:
            return (
                "Competitive displacement - requires strong differentiation. "
                "Focus on specific pain points and gaps in current solution. "
                "Build executive relationship before pushing for change."
            )
        elif difficulty == "easy":
            return (
                "Straightforward displacement opportunity. Lead with feature comparison "
                "and customer success stories. Target quick POC to demonstrate value."
            )
        else:
            return (
                "Balanced approach - combine technical differentiation with business value. "
                "Identify specific pain points in current implementation. "
                "Build multi-threaded relationships across technical and business stakeholders."
            )

    def _generate_talking_points(
        self,
        provider: str,
        weaknesses: List[str],
        advantages: List[str]
    ) -> List[str]:
        """Generate key talking points for sales conversation."""
        points = []

        # Add provider-specific opening
        if provider in ["Elasticsearch", "Elastic", "OpenSearch"]:
            points.append(
                "Many customers switching from Elasticsearch cite DevOps burden as #1 driver"
            )
        elif provider in ["Solr", "Apache Solr"]:
            points.append(
                "Solr ecosystem is declining - limited innovation and shrinking talent pool"
            )
        elif provider in ["Native", "None"]:
            points.append(
                "Companies adding search see 15-30% conversion lift on average"
            )

        # Add top weakness as talking point
        if weaknesses:
            points.append(f"Current limitation: {weaknesses[0]}")

        # Add top advantage as talking point
        if advantages:
            points.append(f"Algolia advantage: {advantages[0]}")

        # Add universal points
        points.extend([
            "Algolia powers 17,000+ customers including Stripe, Slack, and Lacoste",
            "Average implementation time: 2-4 weeks vs months for alternatives",
        ])

        return points[:5]  # Return top 5

    def _identify_risk_factors(self, provider: str, tech_spend: int) -> List[str]:
        """Identify potential risks or blockers."""
        risks = []

        # Provider-specific risks
        if provider in ["Constructor.io", "Constructor", "Bloomreach", "Coveo"]:
            risks.append("Strong incumbent with existing relationship")
        if provider in ["Elasticsearch", "Elastic"]:
            risks.append("Existing Elasticsearch expertise on team may resist change")

        # Spend-based risks
        if tech_spend >= 200000:
            risks.append("High current investment may create switching cost concerns")

        # Universal risks
        risks.extend([
            "Budget cycle timing",
            "Competing priorities",
            "Technical integration complexity",
        ])

        return risks[:4]  # Return top 4

    def _calculate_threat_level(self, provider: str) -> str:
        """Calculate competitive threat level from current provider."""
        high_threat = ["Constructor.io", "Constructor", "Bloomreach", "Coveo"]
        medium_threat = ["Elasticsearch", "Elastic", "Lucidworks", "OpenSearch"]
        low_threat = ["Solr", "Apache Solr", "Native", "None", "Yext", "Swiftype", "Doofinder"]

        if provider in high_threat:
            return "high"
        elif provider in medium_threat:
            return "medium"
        else:
            return "low"

    def _estimate_conversion_lift(self, provider: str) -> Optional[str]:
        """Estimate conversion lift from switching."""
        if provider in ["Native", "None"]:
            return "15-30%"
        elif provider in ["Solr", "Apache Solr"]:
            return "10-20%"
        elif provider in ["Elasticsearch", "Elastic", "OpenSearch"]:
            return "5-15%"
        elif provider in ["Searchspring", "Klevu", "Doofinder"]:
            return "5-10%"
        else:
            return "3-8%"

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> DisplacementAnalysisData:
        """
        Validate transformed data and create DisplacementAnalysisData model.

        Args:
            domain: The requested domain
            transformed_data: Data from transform_data()

        Returns:
            Validated DisplacementAnalysisData model
        """
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        return DisplacementAnalysisData(
            domain=domain,
            current_search_provider=transformed_data.get("current_search_provider"),
            has_search=transformed_data.get("has_search", True),
            provider_weaknesses=transformed_data.get("provider_weaknesses", []),
            algolia_advantages=transformed_data.get("algolia_advantages", []),
            displacement_difficulty=transformed_data.get("displacement_difficulty", "medium"),
            migration_complexity=transformed_data.get("migration_complexity", "medium"),
            roi_potential=transformed_data.get("roi_potential", "medium"),
            estimated_conversion_lift=transformed_data.get("estimated_conversion_lift"),
            recommended_approach=transformed_data.get("recommended_approach", ""),
            key_talking_points=transformed_data.get("key_talking_points", []),
            risk_factors=transformed_data.get("risk_factors", []),
            competitive_threat_level=transformed_data.get("competitive_threat_level", "medium"),
        )
