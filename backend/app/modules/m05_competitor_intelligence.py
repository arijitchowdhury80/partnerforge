"""
M05 Competitor Intelligence Module

Identifies competitors and their search providers for displacement positioning.
This is a Wave 2 (Competitive) module that depends on Wave 1 modules.

Data Sources:
- SimilarWeb MCP: similar-sites, keywords-competitors
- BuiltWith MCP: competitor tech stack lookups

Dependencies:
- M02 Technology Stack (for target's current search provider)
- M03 Traffic Analysis (for traffic comparison)

Output: Competitor list with tech stacks, traffic comparison, and
displacement opportunities.

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

class CompetitorData(BaseModel):
    """Individual competitor profile."""
    domain: str
    company_name: Optional[str] = None
    similarity_score: float = 0.0
    monthly_visits: Optional[int] = None
    search_provider: Optional[str] = None
    uses_algolia: bool = False
    tech_overlap: List[str] = Field(default_factory=list)
    competitive_angle: Optional[str] = None


class SearchProviderLandscape(BaseModel):
    """Competitor search provider landscape."""
    algolia_users: int = 0
    elasticsearch_users: int = 0
    coveo_users: int = 0
    constructor_users: int = 0
    searchspring_users: int = 0
    native_search_users: int = 0
    other_users: int = 0
    unknown_users: int = 0


class CompetitorIntelligenceData(BaseModel):
    """
    Competitor Intelligence data model - output of M05 module.

    Analyzes competitors' search providers and identifies displacement angles.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Competitor list
    competitors: List[CompetitorData] = Field(
        default_factory=list, description="Competitor profiles"
    )
    competitor_count: int = Field(0, description="Total competitors analyzed")

    # Search provider analysis
    search_landscape: Optional[SearchProviderLandscape] = Field(
        None, description="Competitor search provider breakdown"
    )
    competitors_with_algolia: List[str] = Field(
        default_factory=list, description="Competitors using Algolia"
    )
    competitors_with_elasticsearch: List[str] = Field(
        default_factory=list, description="Competitors using Elasticsearch"
    )
    competitors_with_coveo: List[str] = Field(
        default_factory=list, description="Competitors using Coveo"
    )
    competitors_with_constructor: List[str] = Field(
        default_factory=list, description="Competitors using Constructor.io"
    )
    competitors_with_other: List[str] = Field(
        default_factory=list, description="Competitors using other search"
    )

    # Market position
    market_position: Optional[str] = Field(
        None, description="Market position (leader/challenger/follower)"
    )
    market_share_estimate: Optional[float] = Field(
        None, description="Estimated market share"
    )

    # Displacement opportunities
    first_mover_opportunity: bool = Field(
        False, description="Whether first-mover opportunity exists"
    )
    competitive_pressure_score: int = Field(
        0, description="Competitive pressure score (0-100)"
    )
    displacement_angle: Optional[str] = Field(
        None, description="Primary displacement positioning"
    )

    # Competitive summary
    competitive_summary: Optional[str] = Field(
        None, description="Summary of competitive landscape"
    )


# =============================================================================
# Module Implementation
# =============================================================================

@register_module
class M05CompetitorIntelligenceModule(BaseIntelligenceModule):
    """
    M05: Competitor Intelligence - competitive landscape analysis.

    Wave 2 (Competitive) module that depends on M02 and M03.
    Analyzes competitors' search providers and identifies displacement angles.
    """

    MODULE_ID = "m05_competitor_intelligence"
    MODULE_NAME = "Competitor Intelligence"
    WAVE = 2
    DEPENDS_ON = ["m02_technology_stack", "m03_traffic_analysis"]
    SOURCE_TYPE = "api"
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
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data
            dependencies: Results from dependent modules (M02, M03)

        Returns:
            ModuleResult with CompetitorIntelligenceData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching competitor intelligence for: {domain}")

        # Validate dependencies if provided
        if dependencies and not self.validate_dependencies(dependencies):
            self.logger.warning(f"Missing dependencies for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached result for: {domain}")
                return cached

        # Fetch raw data
        raw_data = await self.fetch_data(domain)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Add dependency data if available
        if dependencies:
            raw_data["tech_stack_data"] = dependencies.get("m02_technology_stack")
            raw_data["traffic_data"] = dependencies.get("m03_traffic_analysis")

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        competitor_data = await self._validate_and_store(domain, transformed)

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
            data=competitor_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched competitor intelligence for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch competitor data from SimilarWeb and BuiltWith.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with competitor data and source citation
        """
        similarweb_data = {}
        errors = []

        # Try SimilarWeb similar-sites
        try:
            similarweb_data = await self._fetch_from_similarweb(domain)
            self.logger.debug(f"SimilarWeb returned competitor data for: {domain}")
        except Exception as e:
            self.logger.warning(f"SimilarWeb fetch failed for {domain}: {e}")
            errors.append(f"SimilarWeb: {e}")

        # If SimilarWeb failed, raise error
        if not similarweb_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        # Enrich competitors with tech stack data
        competitors = similarweb_data.get("competitors", [])
        enriched_competitors = []

        for competitor in competitors[:10]:  # Limit to top 10
            try:
                tech_data = await self._fetch_competitor_tech(competitor["domain"])
                competitor.update(tech_data)
            except Exception as e:
                self.logger.warning(
                    f"Failed to get tech stack for {competitor['domain']}: {e}"
                )
            enriched_competitors.append(competitor)

        similarweb_data["competitors"] = enriched_competitors
        return similarweb_data

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into CompetitorIntelligenceData schema.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching CompetitorIntelligenceData fields
        """
        competitors_raw = raw_data.get("competitors", [])

        # Build competitor profiles
        competitors = []
        algolia_users = []
        elasticsearch_users = []
        coveo_users = []
        constructor_users = []
        other_users = []

        for comp in competitors_raw:
            search_provider = comp.get("search_provider")
            uses_algolia = search_provider and "algolia" in search_provider.lower()

            competitor = CompetitorData(
                domain=comp.get("domain", ""),
                company_name=comp.get("company_name"),
                similarity_score=comp.get("similarity_score", 0.0),
                monthly_visits=comp.get("monthly_visits"),
                search_provider=search_provider,
                uses_algolia=uses_algolia,
                tech_overlap=comp.get("tech_overlap", []),
                competitive_angle=comp.get("competitive_angle"),
            )
            competitors.append(competitor)

            # Categorize by search provider
            if search_provider:
                provider_lower = search_provider.lower()
                if "algolia" in provider_lower:
                    algolia_users.append(comp.get("domain"))
                elif "elasticsearch" in provider_lower or "elastic" in provider_lower:
                    elasticsearch_users.append(comp.get("domain"))
                elif "coveo" in provider_lower:
                    coveo_users.append(comp.get("domain"))
                elif "constructor" in provider_lower:
                    constructor_users.append(comp.get("domain"))
                else:
                    other_users.append(comp.get("domain"))

        # Build search landscape
        search_landscape = SearchProviderLandscape(
            algolia_users=len(algolia_users),
            elasticsearch_users=len(elasticsearch_users),
            coveo_users=len(coveo_users),
            constructor_users=len(constructor_users),
            other_users=len(other_users),
            unknown_users=len([c for c in competitors if not c.search_provider]),
        )

        # Determine first-mover opportunity
        first_mover = len(algolia_users) == 0

        # Calculate competitive pressure
        competitive_pressure = self._calculate_competitive_pressure(
            search_landscape, competitors
        )

        # Determine displacement angle
        displacement_angle = self._determine_displacement_angle(
            first_mover, search_landscape, competitors
        )

        # Generate competitive summary
        competitive_summary = self._generate_competitive_summary(
            first_mover, search_landscape, len(competitors)
        )

        return {
            "domain": raw_data.get("domain"),
            "competitors": [c.model_dump() for c in competitors],
            "competitor_count": len(competitors),
            "search_landscape": search_landscape.model_dump(),
            "competitors_with_algolia": algolia_users,
            "competitors_with_elasticsearch": elasticsearch_users,
            "competitors_with_coveo": coveo_users,
            "competitors_with_constructor": constructor_users,
            "competitors_with_other": other_users,
            "market_position": raw_data.get("market_position"),
            "market_share_estimate": raw_data.get("market_share_estimate"),
            "first_mover_opportunity": first_mover,
            "competitive_pressure_score": competitive_pressure,
            "displacement_angle": displacement_angle,
            "competitive_summary": competitive_summary,
            # Preserve source info
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_from_similarweb(self, domain: str) -> Dict[str, Any]:
        """
        Fetch competitor data from SimilarWeb API.

        In production, this calls the SimilarWeb MCP.
        """
        return await self._call_similarweb_api(domain)

    async def _call_similarweb_api(self, domain: str) -> Dict[str, Any]:
        """
        Call SimilarWeb API (mock implementation).
        """
        now = datetime.now()

        # Mock response with competitor data
        return {
            "domain": domain,
            "competitors": [
                {
                    "domain": "competitor1.com",
                    "company_name": "Competitor One Inc.",
                    "similarity_score": 0.85,
                    "monthly_visits": 45000000,
                },
                {
                    "domain": "competitor2.com",
                    "company_name": "Competitor Two Corp.",
                    "similarity_score": 0.78,
                    "monthly_visits": 32000000,
                },
                {
                    "domain": "competitor3.com",
                    "company_name": "Competitor Three LLC",
                    "similarity_score": 0.72,
                    "monthly_visits": 28000000,
                },
                {
                    "domain": "competitor4.com",
                    "company_name": "Competitor Four Inc.",
                    "similarity_score": 0.68,
                    "monthly_visits": 15000000,
                },
                {
                    "domain": "competitor5.com",
                    "company_name": "Competitor Five Co.",
                    "similarity_score": 0.62,
                    "monthly_visits": 12000000,
                },
            ],
            "source_url": f"https://www.similarweb.com/website/{domain}/competitors/",
            "source_date": now.isoformat(),
        }

    async def _fetch_competitor_tech(self, domain: str) -> Dict[str, Any]:
        """
        Fetch tech stack for a competitor domain.

        In production, this calls the BuiltWith MCP.
        """
        # Mock tech stack response
        search_providers = [
            "Elasticsearch",
            "Constructor.io",
            None,  # Native/unknown
            "Coveo",
            "Algolia",
        ]
        import random
        search_provider = random.choice(search_providers)

        return {
            "search_provider": search_provider,
            "tech_overlap": ["Salesforce Commerce Cloud", "Google Analytics"],
            "competitive_angle": self._generate_competitive_angle(search_provider),
        }

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> CompetitorIntelligenceData:
        """
        Validate transformed data and create CompetitorIntelligenceData model.
        """
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert nested dicts back to models
        competitors = [
            CompetitorData(**c) for c in transformed_data.get("competitors", [])
        ]

        search_landscape = None
        if transformed_data.get("search_landscape"):
            search_landscape = SearchProviderLandscape(
                **transformed_data["search_landscape"]
            )

        return CompetitorIntelligenceData(
            domain=domain,
            competitors=competitors,
            competitor_count=transformed_data.get("competitor_count", 0),
            search_landscape=search_landscape,
            competitors_with_algolia=transformed_data.get("competitors_with_algolia", []),
            competitors_with_elasticsearch=transformed_data.get("competitors_with_elasticsearch", []),
            competitors_with_coveo=transformed_data.get("competitors_with_coveo", []),
            competitors_with_constructor=transformed_data.get("competitors_with_constructor", []),
            competitors_with_other=transformed_data.get("competitors_with_other", []),
            market_position=transformed_data.get("market_position"),
            market_share_estimate=transformed_data.get("market_share_estimate"),
            first_mover_opportunity=transformed_data.get("first_mover_opportunity", False),
            competitive_pressure_score=transformed_data.get("competitive_pressure_score", 0),
            displacement_angle=transformed_data.get("displacement_angle"),
            competitive_summary=transformed_data.get("competitive_summary"),
        )

    def _calculate_competitive_pressure(
        self,
        landscape: SearchProviderLandscape,
        competitors: List[CompetitorData]
    ) -> int:
        """Calculate competitive pressure score (0-100)."""
        score = 0

        # More competitors with AI search = higher pressure
        ai_search_count = (
            landscape.algolia_users +
            landscape.constructor_users +
            landscape.coveo_users
        )

        score += min(ai_search_count * 20, 60)  # Cap at 60

        # High-traffic competitors with modern search = more pressure
        for comp in competitors[:5]:
            if comp.monthly_visits and comp.monthly_visits > 10_000_000:
                if comp.uses_algolia:
                    score += 15
                elif comp.search_provider in ["Constructor.io", "Coveo"]:
                    score += 10

        return min(score, 100)

    def _determine_displacement_angle(
        self,
        first_mover: bool,
        landscape: SearchProviderLandscape,
        competitors: List[CompetitorData]
    ) -> str:
        """Determine the best displacement angle."""
        if first_mover:
            return "First-mover advantage: No major competitor uses Algolia. Position as industry leader."

        if landscape.elasticsearch_users > 0:
            return "Elasticsearch displacement: Highlight Algolia's easier implementation and better relevance."

        if landscape.constructor_users > 0:
            return "AI search parity: Match Constructor.io capabilities while offering better support."

        if landscape.algolia_users > 0:
            return "Competitive catch-up: Competitors already benefiting from Algolia. Don't fall behind."

        return "Search modernization: Replace legacy native search with AI-powered discovery."

    def _generate_competitive_angle(self, search_provider: Optional[str]) -> Optional[str]:
        """Generate competitive angle based on search provider."""
        if not search_provider:
            return "Unknown search - potential displacement opportunity"
        if "algolia" in search_provider.lower():
            return "Already on Algolia - competitive parity"
        if "elasticsearch" in search_provider.lower():
            return "Using Elasticsearch - Algolia offers easier scaling"
        if "constructor" in search_provider.lower():
            return "Using Constructor.io - competitive AI search"
        return f"Using {search_provider} - evaluate displacement opportunity"

    def _generate_competitive_summary(
        self,
        first_mover: bool,
        landscape: SearchProviderLandscape,
        total_competitors: int
    ) -> str:
        """Generate a summary of the competitive landscape."""
        if first_mover:
            return (
                f"First-mover opportunity: None of the top {total_competitors} competitors "
                f"use Algolia. This company could be a lighthouse customer for their vertical."
            )

        parts = []
        if landscape.algolia_users > 0:
            parts.append(f"{landscape.algolia_users} competitor(s) already use Algolia")
        if landscape.constructor_users > 0:
            parts.append(f"{landscape.constructor_users} use Constructor.io")
        if landscape.elasticsearch_users > 0:
            parts.append(f"{landscape.elasticsearch_users} use Elasticsearch")

        if parts:
            return f"Competitive landscape: {', '.join(parts)}."
        return f"Mixed search landscape across {total_competitors} competitors."
