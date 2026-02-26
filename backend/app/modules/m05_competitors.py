"""
M05 Competitor Intelligence Module

Identifies competitors and analyzes their search technology.
This is a Wave 2 module that depends on M02 (Tech Stack) and M03 (Traffic).

Data Sources:
- SimilarWeb similar-sites API (primary - competitor discovery)
- BuiltWith domain lookup (secondary - search provider detection)

Output: Similar sites, competitor search providers, Algolia users among competitors,
and first-mover opportunity flag.

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


class CompetitorSite(BaseModel):
    """Details about a competitor site."""

    domain: str = Field(..., description="Competitor domain")
    similarity_score: Optional[float] = Field(None, description="Similarity score (0-1)")
    rank: Optional[int] = Field(None, description="Global rank")
    category: Optional[str] = Field(None, description="Industry category")


class SearchProviderInfo(BaseModel):
    """Search provider information for a competitor."""

    domain: str = Field(..., description="Competitor domain")
    provider: str = Field(..., description="Search provider name (e.g., 'Algolia', 'Elasticsearch', 'Custom')")
    detected_at: str = Field(..., description="Detection date (ISO format)")
    confidence: float = Field(default=1.0, description="Detection confidence (0-1)")


class CompetitorIntelligenceData(BaseModel):
    """
    Competitor Intelligence data model - output of M05 module.

    Captures competitive landscape information for displacement analysis.
    """

    # Required fields
    domain: str = Field(..., description="Target company domain (e.g., 'sallybeauty.com')")

    # Similar sites from SimilarWeb
    similar_sites: List[CompetitorSite] = Field(
        default_factory=list,
        description="List of similar/competitor sites from SimilarWeb"
    )

    # Search provider detection from BuiltWith
    competitor_search_providers: Dict[str, str] = Field(
        default_factory=dict,
        description="Mapping of competitor domain to search provider"
    )

    # Algolia-specific analysis
    algolia_users: List[str] = Field(
        default_factory=list,
        description="Competitors already using Algolia"
    )

    non_algolia_users: List[str] = Field(
        default_factory=list,
        description="Competitors NOT using Algolia (displacement targets)"
    )

    # First-mover opportunity (TRUE if no competitors use Algolia)
    first_mover_opportunity: bool = Field(
        default=False,
        description="True if no competitors in the space use Algolia"
    )

    # Summary metrics
    total_competitors_analyzed: int = Field(default=0, description="Total competitors analyzed")
    algolia_penetration_rate: float = Field(
        default=0.0,
        description="Percentage of competitors using Algolia (0-100)"
    )

    # Provider breakdown
    search_provider_breakdown: Dict[str, int] = Field(
        default_factory=dict,
        description="Count of competitors by search provider"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M05CompetitorIntelligenceModule(BaseIntelligenceModule):
    """
    M05: Competitor Intelligence - competitive landscape analysis.

    Wave 2 module that depends on M02 (Tech Stack) and M03 (Traffic).
    Identifies competitors and analyzes their search technology.
    """

    MODULE_ID = "m05_competitors"
    MODULE_NAME = "Competitor Intelligence"
    WAVE = 2
    DEPENDS_ON = ["m02_tech_stack", "m03_traffic"]
    SOURCE_TYPE = "api"
    CACHE_TTL = 604800  # 7 days

    # Known search providers to detect
    KNOWN_SEARCH_PROVIDERS = [
        "Algolia",
        "Elasticsearch",
        "Solr",
        "Coveo",
        "Bloomreach",
        "SearchSpring",
        "Klevu",
        "Lucidworks",
        "Swiftype",
        "Typesense",
        "MeiliSearch",
        "Constructor.io",
        "Yext",
        "Google Custom Search",
    ]

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform competitor intelligence enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with CompetitorIntelligenceData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching competitor intelligence for: {domain}")

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
        Fetch raw data from SimilarWeb and BuiltWith.

        Attempts SimilarWeb first (primary source for similar sites),
        then BuiltWith to detect search providers.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged data from all sources
        """
        similarweb_data = {}
        builtwith_data = {}
        errors = []

        # Try SimilarWeb similar-sites (primary)
        try:
            similarweb_data = await self._fetch_similar_sites(domain)
            self.logger.debug(f"SimilarWeb returned similar sites for: {domain}")
        except Exception as e:
            self.logger.warning(f"SimilarWeb fetch failed for {domain}: {e}")
            errors.append(f"SimilarWeb: {e}")

        # Try BuiltWith for search provider detection on each competitor
        try:
            if similarweb_data.get("similar_sites"):
                competitor_domains = [
                    site.get("domain") for site in similarweb_data.get("similar_sites", [])
                    if site.get("domain")
                ]
                builtwith_data = await self._detect_search_providers(competitor_domains)
                self.logger.debug(f"BuiltWith returned tech data for {len(competitor_domains)} competitors")
        except Exception as e:
            self.logger.warning(f"BuiltWith fetch failed for {domain}: {e}")
            errors.append(f"BuiltWith: {e}")

        # If SimilarWeb failed, we have no competitor data
        if not similarweb_data:
            if errors:
                raise Exception(
                    f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
                )
            else:
                raise Exception(f"No competitor data available for {domain}")

        # Merge data from both sources
        merged = await self._merge_sources(similarweb_data, builtwith_data)

        return merged

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into CompetitorIntelligenceData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching CompetitorIntelligenceData fields
        """
        similar_sites = raw_data.get("similar_sites", [])
        search_providers = raw_data.get("competitor_search_providers", {})

        # Identify Algolia users
        algolia_users = [
            domain for domain, provider in search_providers.items()
            if provider.lower() == "algolia"
        ]

        # Identify non-Algolia users (displacement targets)
        non_algolia_users = [
            domain for domain, provider in search_providers.items()
            if provider.lower() != "algolia" and provider.lower() != "unknown"
        ]

        # Determine first-mover opportunity
        first_mover = len(algolia_users) == 0 and len(search_providers) > 0

        # Calculate Algolia penetration rate
        total_analyzed = len(search_providers)
        penetration_rate = (
            (len(algolia_users) / total_analyzed * 100)
            if total_analyzed > 0
            else 0.0
        )

        # Build provider breakdown
        provider_breakdown: Dict[str, int] = {}
        for provider in search_providers.values():
            provider_breakdown[provider] = provider_breakdown.get(provider, 0) + 1

        return {
            "domain": raw_data.get("domain"),
            "similar_sites": similar_sites,
            "competitor_search_providers": search_providers,
            "algolia_users": algolia_users,
            "non_algolia_users": non_algolia_users,
            "first_mover_opportunity": first_mover,
            "total_competitors_analyzed": total_analyzed,
            "algolia_penetration_rate": round(penetration_rate, 2),
            "search_provider_breakdown": provider_breakdown,
            # Preserve source info for result creation
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_similar_sites(self, domain: str) -> Dict[str, Any]:
        """
        Fetch similar sites from SimilarWeb API.

        In production, this calls the SimilarWeb MCP.
        For now, returns mock data.

        Args:
            domain: The domain to look up

        Returns:
            dict with SimilarWeb data and source citation
        """
        return await self._call_similarweb_api(domain)

    async def _call_similarweb_api(self, domain: str) -> Dict[str, Any]:
        """
        Call SimilarWeb similar-sites API (mock implementation).

        In production, this will use the SimilarWeb MCP server.
        """
        now = datetime.now()

        # Mock response matching expected SimilarWeb structure
        return {
            "domain": domain,
            "similar_sites": [
                {
                    "domain": "ulta.com",
                    "similarity_score": 0.89,
                    "rank": 1500,
                    "category": "Beauty & Cosmetics"
                },
                {
                    "domain": "sephora.com",
                    "similarity_score": 0.85,
                    "rank": 800,
                    "category": "Beauty & Cosmetics"
                },
                {
                    "domain": "dermstore.com",
                    "similarity_score": 0.72,
                    "rank": 5000,
                    "category": "Beauty & Cosmetics"
                },
                {
                    "domain": "beautybay.com",
                    "similarity_score": 0.68,
                    "rank": 8000,
                    "category": "Beauty & Cosmetics"
                },
                {
                    "domain": "lookfantastic.com",
                    "similarity_score": 0.65,
                    "rank": 6500,
                    "category": "Beauty & Cosmetics"
                },
            ],
            "source_url": f"https://api.similarweb.com/v1/website/{domain}/similar-sites",
            "source_date": now.isoformat(),
        }

    async def _detect_search_providers(self, competitor_domains: List[str]) -> Dict[str, Any]:
        """
        Detect search providers for a list of competitor domains.

        Uses BuiltWith to identify what search technology each competitor uses.

        Args:
            competitor_domains: List of domains to analyze

        Returns:
            dict with search provider mapping
        """
        search_providers = {}
        now = datetime.now()

        for domain in competitor_domains:
            try:
                provider = await self._detect_single_provider(domain)
                search_providers[domain] = provider
            except Exception as e:
                self.logger.warning(f"Failed to detect search provider for {domain}: {e}")
                search_providers[domain] = "Unknown"

        return {
            "competitor_search_providers": search_providers,
            "source_url": "https://api.builtwith.com/v21/api.json",
            "source_date": now.isoformat(),
        }

    async def _detect_single_provider(self, domain: str) -> str:
        """
        Detect search provider for a single domain using BuiltWith.

        In production, this calls the BuiltWith MCP.
        For now, returns mock data.

        Args:
            domain: The domain to analyze

        Returns:
            Search provider name
        """
        # Mock response - in production would call BuiltWith
        # Simulates realistic search provider distribution
        mock_providers = {
            "ulta.com": "Elasticsearch",
            "sephora.com": "Algolia",
            "dermstore.com": "SearchSpring",
            "beautybay.com": "Klevu",
            "lookfantastic.com": "Elasticsearch",
        }

        return mock_providers.get(domain, "Custom")

    async def _merge_sources(
        self,
        similarweb_data: Dict[str, Any],
        builtwith_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge data from SimilarWeb and BuiltWith sources.

        SimilarWeb provides competitor list.
        BuiltWith provides search provider detection.

        Args:
            similarweb_data: Data from SimilarWeb API
            builtwith_data: Data from BuiltWith API

        Returns:
            Merged data dictionary with source citation
        """
        merged = {}

        # Start with SimilarWeb data (competitor discovery)
        if similarweb_data:
            merged.update(similarweb_data)

        # Add BuiltWith search provider data
        if builtwith_data:
            merged["competitor_search_providers"] = builtwith_data.get(
                "competitor_search_providers", {}
            )

        # Ensure we have a source_url (prefer SimilarWeb)
        if similarweb_data.get("source_url"):
            merged["source_url"] = similarweb_data["source_url"]
            merged["source_date"] = similarweb_data.get("source_date")
        elif builtwith_data.get("source_url"):
            merged["source_url"] = builtwith_data["source_url"]
            merged["source_date"] = builtwith_data.get("source_date")

        return merged

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> CompetitorIntelligenceData:
        """
        Validate transformed data and create CompetitorIntelligenceData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated CompetitorIntelligenceData model

        Raises:
            ValueError: If domain mismatch or validation fails
        """
        # Validate domain matches
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert similar_sites list to CompetitorSite models
        similar_sites = [
            CompetitorSite(**site) if isinstance(site, dict) else site
            for site in transformed_data.get("similar_sites", [])
        ]

        # Create data model (Pydantic validates the schema)
        return CompetitorIntelligenceData(
            domain=domain,
            similar_sites=similar_sites,
            competitor_search_providers=transformed_data.get("competitor_search_providers", {}),
            algolia_users=transformed_data.get("algolia_users", []),
            non_algolia_users=transformed_data.get("non_algolia_users", []),
            first_mover_opportunity=transformed_data.get("first_mover_opportunity", False),
            total_competitors_analyzed=transformed_data.get("total_competitors_analyzed", 0),
            algolia_penetration_rate=transformed_data.get("algolia_penetration_rate", 0.0),
            search_provider_breakdown=transformed_data.get("search_provider_breakdown", {}),
        )
