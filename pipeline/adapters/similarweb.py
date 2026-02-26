"""
SimilarWeb Adapter
==================

Production-ready adapter for SimilarWeb Digital Intelligence API.
Implements all 14 endpoints with P0 source citation enforcement.

Endpoints:
1. traffic - Total visits, unique visitors
2. engagement - Bounce rate, pages per visit, visit duration
3. sources - Traffic sources breakdown (direct, search, social, referral)
4. geography - Traffic by country
5. demographics - Age and gender distribution
6. keywords - Top organic and paid keywords
7. audience-interests - Interest categories
8. similar-sites - Competitor domains
9. keywords-competitors - Keyword competitors
10. website-rank - Global and category rank
11. referrals - Top referring domains
12. popular-pages - Most visited pages
13. leading-folders - Top URL paths
14. landing-pages - Entry pages

Rate Limits:
- 60 RPM (1.0 TPS)
- Bucket size: 10

Cost:
- $0.08 per call

Cache:
- 30 days TTL (traffic data changes slowly)

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M03: Traffic Analysis)
- docs/SOURCE_CITATION_MANDATE.md
"""

import os
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from enum import Enum

import aiohttp
from pydantic import BaseModel, Field

from pipeline.adapters.base import (
    BaseAdapter,
    EndpointConfig,
    APIError,
    SourcedResponse,
)
from pipeline.models.source import SourceCitation, SourceType


logger = logging.getLogger(__name__)


# =============================================================================
# Response Models
# =============================================================================


class TrafficMetrics(BaseModel):
    """Traffic volume metrics from SimilarWeb."""

    total_visits: int = Field(default=0, description="Total monthly visits")
    unique_visitors: int = Field(default=0, description="Unique monthly visitors")
    visits_mom_change: Optional[float] = Field(
        default=None, description="Month-over-month change"
    )
    visits_yoy_change: Optional[float] = Field(
        default=None, description="Year-over-year change"
    )
    mobile_share: Optional[float] = Field(
        default=None, description="Share of mobile traffic (0-1)"
    )
    desktop_share: Optional[float] = Field(
        default=None, description="Share of desktop traffic (0-1)"
    )


class EngagementMetrics(BaseModel):
    """User engagement metrics from SimilarWeb."""

    bounce_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Bounce rate (0-1)")
    pages_per_visit: float = Field(default=0.0, ge=0.0, description="Average pages per visit")
    average_visit_duration: float = Field(
        default=0.0, ge=0.0, description="Average visit duration in seconds"
    )
    page_views: Optional[int] = Field(default=None, description="Total page views")


class TrafficSourceBreakdown(BaseModel):
    """Traffic sources breakdown from SimilarWeb."""

    direct: float = Field(default=0.0, ge=0.0, le=1.0, description="Direct traffic share")
    organic_search: float = Field(default=0.0, ge=0.0, le=1.0, description="Organic search share")
    paid_search: float = Field(default=0.0, ge=0.0, le=1.0, description="Paid search share")
    social: float = Field(default=0.0, ge=0.0, le=1.0, description="Social traffic share")
    referral: float = Field(default=0.0, ge=0.0, le=1.0, description="Referral traffic share")
    email: float = Field(default=0.0, ge=0.0, le=1.0, description="Email traffic share")
    display_ads: float = Field(default=0.0, ge=0.0, le=1.0, description="Display ads share")


class CountryTraffic(BaseModel):
    """Traffic from a specific country."""

    country_code: str = Field(..., description="ISO 3166-1 alpha-2 country code")
    country_name: Optional[str] = Field(default=None, description="Country name")
    share: float = Field(..., ge=0.0, le=1.0, description="Share of total traffic")
    visits: Optional[int] = Field(default=None, description="Estimated visits")


class GeographyData(BaseModel):
    """Geographic distribution of traffic."""

    top_countries: List[CountryTraffic] = Field(
        default_factory=list, description="Top countries by traffic"
    )
    primary_country: Optional[str] = Field(
        default=None, description="Primary country code"
    )
    domestic_share: Optional[float] = Field(
        default=None, description="Domestic traffic share"
    )


class AgeDistribution(BaseModel):
    """Age distribution of visitors."""

    age_18_24: float = Field(default=0.0, alias="18-24")
    age_25_34: float = Field(default=0.0, alias="25-34")
    age_35_44: float = Field(default=0.0, alias="35-44")
    age_45_54: float = Field(default=0.0, alias="45-54")
    age_55_64: float = Field(default=0.0, alias="55-64")
    age_65_plus: float = Field(default=0.0, alias="65+")

    class Config:
        populate_by_name = True


class GenderDistribution(BaseModel):
    """Gender distribution of visitors."""

    male: float = Field(default=0.0, ge=0.0, le=1.0)
    female: float = Field(default=0.0, ge=0.0, le=1.0)


class DemographicsData(BaseModel):
    """Demographic data for visitors."""

    age_distribution: Optional[AgeDistribution] = Field(default=None)
    gender_distribution: Optional[GenderDistribution] = Field(default=None)


class Keyword(BaseModel):
    """Keyword data from SimilarWeb."""

    keyword: str = Field(..., description="Search keyword")
    share: float = Field(..., ge=0.0, le=1.0, description="Share of traffic")
    volume: Optional[int] = Field(default=None, description="Search volume")
    cpc: Optional[float] = Field(default=None, description="Cost per click")
    position: Optional[int] = Field(default=None, description="Average ranking position")


class KeywordsData(BaseModel):
    """Keywords data from SimilarWeb."""

    organic_keywords: List[Keyword] = Field(
        default_factory=list, description="Top organic keywords"
    )
    paid_keywords: List[Keyword] = Field(
        default_factory=list, description="Top paid keywords"
    )
    total_organic_keywords: Optional[int] = Field(
        default=None, description="Total organic keywords count"
    )
    total_paid_keywords: Optional[int] = Field(
        default=None, description="Total paid keywords count"
    )


class InterestCategory(BaseModel):
    """Audience interest category."""

    category: str = Field(..., description="Interest category name")
    affinity: float = Field(..., description="Affinity score")


class AudienceInterests(BaseModel):
    """Audience interests from SimilarWeb."""

    categories: List[InterestCategory] = Field(
        default_factory=list, description="Interest categories"
    )


class SimilarSite(BaseModel):
    """Similar/competitor website."""

    domain: str = Field(..., description="Competitor domain")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Similarity score")
    monthly_visits: Optional[int] = Field(default=None, description="Estimated monthly visits")
    category: Optional[str] = Field(default=None, description="Website category")


class SimilarSitesData(BaseModel):
    """Similar sites/competitors data."""

    similar_sites: List[SimilarSite] = Field(
        default_factory=list, description="List of similar sites"
    )


class KeywordCompetitor(BaseModel):
    """Keyword competitor data."""

    domain: str = Field(..., description="Competitor domain")
    overlap_score: float = Field(..., ge=0.0, le=1.0, description="Keyword overlap score")
    common_keywords: Optional[int] = Field(
        default=None, description="Number of shared keywords"
    )
    organic_competition: Optional[float] = Field(
        default=None, description="Organic competition score"
    )
    paid_competition: Optional[float] = Field(
        default=None, description="Paid competition score"
    )


class KeywordCompetitorsData(BaseModel):
    """Keyword competitors data."""

    competitors: List[KeywordCompetitor] = Field(
        default_factory=list, description="Keyword competitors"
    )


class WebsiteRank(BaseModel):
    """Website ranking data."""

    global_rank: Optional[int] = Field(default=None, description="Global rank")
    country_rank: Optional[int] = Field(default=None, description="Country rank")
    country_code: Optional[str] = Field(default=None, description="Country for country rank")
    category_rank: Optional[int] = Field(default=None, description="Category rank")
    category: Optional[str] = Field(default=None, description="Primary category")


class ReferralSite(BaseModel):
    """Referring website data."""

    domain: str = Field(..., description="Referring domain")
    share: float = Field(..., ge=0.0, le=1.0, description="Share of referral traffic")
    visits: Optional[int] = Field(default=None, description="Estimated referral visits")


class ReferralsData(BaseModel):
    """Referral traffic data."""

    referrers: List[ReferralSite] = Field(
        default_factory=list, description="Top referring sites"
    )
    total_referral_share: Optional[float] = Field(
        default=None, description="Total referral traffic share"
    )


class PopularPage(BaseModel):
    """Popular page data."""

    url: str = Field(..., description="Page URL/path")
    share: float = Field(..., ge=0.0, le=1.0, description="Share of page views")
    page_views: Optional[int] = Field(default=None, description="Estimated page views")


class PopularPagesData(BaseModel):
    """Popular pages data."""

    pages: List[PopularPage] = Field(
        default_factory=list, description="Top pages by traffic"
    )


class LeadingFolder(BaseModel):
    """Leading folder/path data."""

    folder: str = Field(..., description="URL folder/path")
    share: float = Field(..., ge=0.0, le=1.0, description="Share of traffic")


class LeadingFoldersData(BaseModel):
    """Leading folders data."""

    folders: List[LeadingFolder] = Field(
        default_factory=list, description="Top URL folders"
    )


class LandingPage(BaseModel):
    """Landing page entry data."""

    page: str = Field(..., description="Landing page URL/path")
    share: float = Field(..., ge=0.0, le=1.0, description="Share of entry traffic")


class LandingPagesData(BaseModel):
    """Landing pages data."""

    landing_pages: List[LandingPage] = Field(
        default_factory=list, description="Top landing pages"
    )


# =============================================================================
# Endpoint Enumeration
# =============================================================================


class SimilarWebEndpoint(str, Enum):
    """SimilarWeb API endpoints."""

    TRAFFIC = "traffic"
    ENGAGEMENT = "engagement"
    SOURCES = "sources"
    GEOGRAPHY = "geography"
    DEMOGRAPHICS = "demographics"
    KEYWORDS = "keywords"
    AUDIENCE_INTERESTS = "audience-interests"
    SIMILAR_SITES = "similar-sites"
    KEYWORDS_COMPETITORS = "keywords-competitors"
    WEBSITE_RANK = "website-rank"
    REFERRALS = "referrals"
    POPULAR_PAGES = "popular-pages"
    LEADING_FOLDERS = "leading-folders"
    LANDING_PAGES = "landing-pages"


# =============================================================================
# Adapter Implementation
# =============================================================================


class SimilarWebAdapter(BaseAdapter):
    """
    Production adapter for SimilarWeb Digital Intelligence API.

    Features:
    - All 14 endpoints implemented
    - P0 source citation on every response
    - Rate limiting (1.0 TPS, bucket 10)
    - Circuit breaker integration
    - Retry with exponential backoff
    - Cost tracking ($0.08/call)
    - 30-day cache TTL
    - Country fallback (us -> ww)

    Example:
        adapter = SimilarWebAdapter(api_key="your-api-key")

        # Get traffic metrics
        traffic = await adapter.get_traffic("costco.com")
        print(f"Monthly visits: {traffic.data.total_visits}")
        print(f"Source: {traffic.citation.source_url}")

        # Get all engagement data
        engagement = await adapter.get_engagement("costco.com")
        print(f"Bounce rate: {engagement.data.bounce_rate}")
    """

    # API Configuration
    BASE_URL = "https://api.similarweb.com/v1"
    API_VERSION = "v1"
    DEFAULT_COUNTRY = "ww"  # Worldwide - fallback from "us" if it fails
    DEFAULT_GRANULARITY = "monthly"
    DEFAULT_MAIN_DOMAIN_ONLY = "true"

    # Cost per API call
    COST_PER_CALL = 0.08

    # Cache TTL: 30 days (traffic data is relatively stable)
    CACHE_TTL_SECONDS = 30 * 24 * 60 * 60  # 2,592,000 seconds

    # Endpoint path mappings
    ENDPOINT_PATHS = {
        SimilarWebEndpoint.TRAFFIC: "/website/{domain}/total-traffic-and-engagement/visits",
        SimilarWebEndpoint.ENGAGEMENT: "/website/{domain}/total-traffic-and-engagement/engagement",
        SimilarWebEndpoint.SOURCES: "/website/{domain}/traffic-sources/overview",
        SimilarWebEndpoint.GEOGRAPHY: "/website/{domain}/geo/traffic-by-country",
        SimilarWebEndpoint.DEMOGRAPHICS: "/website/{domain}/audience/demographics",
        SimilarWebEndpoint.KEYWORDS: "/website/{domain}/search/keywords",
        SimilarWebEndpoint.AUDIENCE_INTERESTS: "/website/{domain}/audience/interests",
        SimilarWebEndpoint.SIMILAR_SITES: "/website/{domain}/similar-sites/similar-sites",
        SimilarWebEndpoint.KEYWORDS_COMPETITORS: "/website/{domain}/search/competitors",
        SimilarWebEndpoint.WEBSITE_RANK: "/website/{domain}/global-rank/global-rank",
        SimilarWebEndpoint.REFERRALS: "/website/{domain}/traffic-sources/referrals",
        SimilarWebEndpoint.POPULAR_PAGES: "/website/{domain}/popular-pages/popular-pages",
        SimilarWebEndpoint.LEADING_FOLDERS: "/website/{domain}/leading-folders/leading-folders",
        SimilarWebEndpoint.LANDING_PAGES: "/website/{domain}/traffic-sources/landing-pages",
    }

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_country: str = DEFAULT_COUNTRY,
        enable_cache: bool = True,
    ):
        """
        Initialize SimilarWebAdapter.

        Args:
            api_key: SimilarWeb API key. If not provided, reads from SIMILARWEB_API_KEY env var.
            default_country: Default country code for queries (default: "ww" for worldwide).
            enable_cache: Enable response caching (default: True).
        """
        # Get API key from env if not provided
        self._api_key = api_key or os.environ.get("SIMILARWEB_API_KEY")
        if not self._api_key:
            logger.warning(
                "SimilarWebAdapter initialized without API key. "
                "Set SIMILARWEB_API_KEY environment variable or pass api_key parameter."
            )

        self.default_country = default_country

        # Initialize base adapter with SimilarWeb-specific settings
        super().__init__(
            name="similarweb",
            source_type=SourceType.SIMILARWEB,
            api_key=self._api_key,
            base_url=self.BASE_URL,
            api_version=self.API_VERSION,
            default_cost_per_call=self.COST_PER_CALL,
            enable_cache=enable_cache,
            default_cache_ttl_seconds=self.CACHE_TTL_SECONDS,
            default_timeout_seconds=30,
        )

        # Register all endpoints with their configurations
        self._register_endpoints()

        # HTTP session (created lazily)
        self._session: Optional[aiohttp.ClientSession] = None

    def _register_endpoints(self) -> None:
        """Register all endpoint configurations."""
        for endpoint in SimilarWebEndpoint:
            config = EndpointConfig(
                name=endpoint.value,
                path=self.ENDPOINT_PATHS[endpoint],
                method="GET",
                cost_per_call=self.COST_PER_CALL,
                cache_ttl_seconds=self.CACHE_TTL_SECONDS,
                timeout_seconds=30,
                requires_auth=True,
                rate_limit_weight=1,
            )
            self.register_endpoint(config)

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                headers={"Accept": "application/json"}
            )
        return self._session

    async def close(self) -> None:
        """Close HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
        return False

    async def _make_request(
        self,
        endpoint: str,
        params: Dict[str, Any],
        timeout_seconds: int,
    ) -> Dict[str, Any]:
        """
        Make HTTP request to SimilarWeb API.

        Args:
            endpoint: Endpoint name from SimilarWebEndpoint
            params: Request parameters (must include 'domain')
            timeout_seconds: Request timeout

        Returns:
            Raw API response as dictionary

        Raises:
            APIError: On API error response
            ValueError: If API key not configured
        """
        if not self._api_key:
            raise ValueError(
                "SimilarWeb API key not configured. "
                "Set SIMILARWEB_API_KEY environment variable."
            )

        # Extract domain from params
        domain = params.get("domain")
        if not domain:
            raise ValueError("Domain parameter is required")

        # Get endpoint path and build URL
        endpoint_enum = SimilarWebEndpoint(endpoint)
        path = self.ENDPOINT_PATHS[endpoint_enum].format(domain=domain)
        url = f"{self.BASE_URL}{path}"

        # Build query parameters
        query_params = {
            "api_key": self._api_key,
            "country": params.get("country", self.default_country),
            "granularity": params.get("granularity", self.DEFAULT_GRANULARITY),
            "main_domain_only": params.get(
                "main_domain_only", self.DEFAULT_MAIN_DOMAIN_ONLY
            ),
        }

        # Add optional parameters
        if "start_date" in params:
            query_params["start_date"] = params["start_date"]
        if "end_date" in params:
            query_params["end_date"] = params["end_date"]
        if "limit" in params:
            query_params["limit"] = params["limit"]

        session = await self._get_session()

        try:
            async with session.get(
                url,
                params=query_params,
                timeout=aiohttp.ClientTimeout(total=timeout_seconds),
            ) as response:
                response_text = await response.text()

                if response.status == 200:
                    return await response.json()

                # Handle country fallback for US-specific errors
                if response.status in (400, 404) and params.get("country") == "us":
                    logger.warning(
                        f"SimilarWeb returned {response.status} for country=us, "
                        f"retrying with country=ww"
                    )
                    query_params["country"] = "ww"
                    async with session.get(
                        url,
                        params=query_params,
                        timeout=aiohttp.ClientTimeout(total=timeout_seconds),
                    ) as fallback_response:
                        if fallback_response.status == 200:
                            return await fallback_response.json()
                        raise APIError(
                            adapter_name=self.name,
                            status_code=fallback_response.status,
                            response_body=await fallback_response.text(),
                            endpoint=endpoint,
                        )

                raise APIError(
                    adapter_name=self.name,
                    status_code=response.status,
                    response_body=response_text,
                    endpoint=endpoint,
                )

        except aiohttp.ClientError as e:
            logger.error(f"SimilarWeb API request failed: {e}")
            raise ConnectionError(f"SimilarWeb API connection error: {e}")

    def _parse_response(
        self,
        endpoint: str,
        raw_response: Dict[str, Any],
        params: Dict[str, Any],
    ) -> Any:
        """
        Parse raw API response into typed model.

        Args:
            endpoint: Endpoint name
            raw_response: Raw API response
            params: Original request parameters

        Returns:
            Parsed response model
        """
        endpoint_enum = SimilarWebEndpoint(endpoint)

        # Route to appropriate parser
        parsers = {
            SimilarWebEndpoint.TRAFFIC: self._parse_traffic,
            SimilarWebEndpoint.ENGAGEMENT: self._parse_engagement,
            SimilarWebEndpoint.SOURCES: self._parse_sources,
            SimilarWebEndpoint.GEOGRAPHY: self._parse_geography,
            SimilarWebEndpoint.DEMOGRAPHICS: self._parse_demographics,
            SimilarWebEndpoint.KEYWORDS: self._parse_keywords,
            SimilarWebEndpoint.AUDIENCE_INTERESTS: self._parse_audience_interests,
            SimilarWebEndpoint.SIMILAR_SITES: self._parse_similar_sites,
            SimilarWebEndpoint.KEYWORDS_COMPETITORS: self._parse_keywords_competitors,
            SimilarWebEndpoint.WEBSITE_RANK: self._parse_website_rank,
            SimilarWebEndpoint.REFERRALS: self._parse_referrals,
            SimilarWebEndpoint.POPULAR_PAGES: self._parse_popular_pages,
            SimilarWebEndpoint.LEADING_FOLDERS: self._parse_leading_folders,
            SimilarWebEndpoint.LANDING_PAGES: self._parse_landing_pages,
        }

        parser = parsers.get(endpoint_enum)
        if parser:
            return parser(raw_response)

        # Fallback: return raw response
        return raw_response

    def _build_source_url(
        self,
        endpoint: str,
        params: Dict[str, Any],
    ) -> str:
        """
        Build source URL for citation.

        Args:
            endpoint: Endpoint name
            params: Request parameters

        Returns:
            Full URL string for citation
        """
        domain = params.get("domain", "unknown")
        country = params.get("country", self.default_country)

        endpoint_enum = SimilarWebEndpoint(endpoint)
        path = self.ENDPOINT_PATHS[endpoint_enum].format(domain=domain)

        # Build citation URL without API key for security
        return f"{self.BASE_URL}{path}?country={country}"

    # =========================================================================
    # Response Parsers
    # =========================================================================

    def _parse_traffic(self, raw: Dict[str, Any]) -> TrafficMetrics:
        """Parse traffic endpoint response."""
        visits = raw.get("visits", [])
        latest = visits[-1] if visits else {}

        # Calculate MoM change if we have enough data
        mom_change = None
        if len(visits) >= 2:
            current = visits[-1].get("visits", 0)
            previous = visits[-2].get("visits", 1)
            if previous > 0:
                mom_change = (current - previous) / previous

        return TrafficMetrics(
            total_visits=latest.get("visits", 0),
            unique_visitors=latest.get("unique_visitors", 0),
            visits_mom_change=mom_change,
            mobile_share=raw.get("mobile_share"),
            desktop_share=raw.get("desktop_share"),
        )

    def _parse_engagement(self, raw: Dict[str, Any]) -> EngagementMetrics:
        """Parse engagement endpoint response."""
        # Handle both single value and time series responses
        if isinstance(raw, list) and len(raw) > 0:
            latest = raw[-1]
        else:
            latest = raw

        return EngagementMetrics(
            bounce_rate=latest.get("bounce_rate", 0.0),
            pages_per_visit=latest.get("pages_per_visit", 0.0),
            average_visit_duration=latest.get("average_visit_duration", 0.0),
            page_views=latest.get("page_views"),
        )

    def _parse_sources(self, raw: Dict[str, Any]) -> TrafficSourceBreakdown:
        """Parse traffic sources endpoint response."""
        return TrafficSourceBreakdown(
            direct=raw.get("direct", {}).get("share", 0.0),
            organic_search=raw.get("organic_search", {}).get("share", 0.0),
            paid_search=raw.get("paid_search", {}).get("share", 0.0),
            social=raw.get("social", {}).get("share", 0.0),
            referral=raw.get("referrals", {}).get("share", 0.0),
            email=raw.get("mail", {}).get("share", 0.0),
            display_ads=raw.get("display_ads", {}).get("share", 0.0),
        )

    def _parse_geography(self, raw: Dict[str, Any]) -> GeographyData:
        """Parse geography endpoint response."""
        countries = raw.get("records", [])

        top_countries = [
            CountryTraffic(
                country_code=c.get("country", ""),
                country_name=c.get("country_name"),
                share=c.get("share", 0.0),
                visits=c.get("visits"),
            )
            for c in countries[:10]  # Top 10
        ]

        primary = top_countries[0].country_code if top_countries else None

        return GeographyData(
            top_countries=top_countries,
            primary_country=primary,
        )

    def _parse_demographics(self, raw: Dict[str, Any]) -> DemographicsData:
        """Parse demographics endpoint response."""
        age_data = raw.get("age_distribution", {})
        gender_data = raw.get("gender_distribution", {})

        age_dist = None
        if age_data:
            age_dist = AgeDistribution(
                age_18_24=age_data.get("18-24", 0.0),
                age_25_34=age_data.get("25-34", 0.0),
                age_35_44=age_data.get("35-44", 0.0),
                age_45_54=age_data.get("45-54", 0.0),
                age_55_64=age_data.get("55-64", 0.0),
                age_65_plus=age_data.get("65+", 0.0),
            )

        gender_dist = None
        if gender_data:
            gender_dist = GenderDistribution(
                male=gender_data.get("male", 0.0),
                female=gender_data.get("female", 0.0),
            )

        return DemographicsData(
            age_distribution=age_dist,
            gender_distribution=gender_dist,
        )

    def _parse_keywords(self, raw: Dict[str, Any]) -> KeywordsData:
        """Parse keywords endpoint response."""
        organic = [
            Keyword(
                keyword=k.get("search_term", ""),
                share=k.get("share", 0.0),
                volume=k.get("volume"),
                cpc=k.get("cpc"),
                position=k.get("position"),
            )
            for k in raw.get("organic", [])[:20]
        ]

        paid = [
            Keyword(
                keyword=k.get("search_term", ""),
                share=k.get("share", 0.0),
                volume=k.get("volume"),
                cpc=k.get("cpc"),
                position=k.get("position"),
            )
            for k in raw.get("paid", [])[:20]
        ]

        return KeywordsData(
            organic_keywords=organic,
            paid_keywords=paid,
            total_organic_keywords=raw.get("total_organic"),
            total_paid_keywords=raw.get("total_paid"),
        )

    def _parse_audience_interests(self, raw: Dict[str, Any]) -> AudienceInterests:
        """Parse audience interests endpoint response."""
        categories = [
            InterestCategory(
                category=c.get("name", ""),
                affinity=c.get("affinity", 0.0),
            )
            for c in raw.get("categories", raw.get("records", []))[:20]
        ]

        return AudienceInterests(categories=categories)

    def _parse_similar_sites(self, raw: Dict[str, Any]) -> SimilarSitesData:
        """Parse similar sites endpoint response."""
        sites = [
            SimilarSite(
                domain=s.get("site", s.get("domain", "")),
                similarity_score=s.get("score", s.get("similarity_score", 0.0)),
                monthly_visits=s.get("visits"),
                category=s.get("category"),
            )
            for s in raw.get("similar_sites", raw.get("records", []))[:20]
        ]

        return SimilarSitesData(similar_sites=sites)

    def _parse_keywords_competitors(self, raw: Dict[str, Any]) -> KeywordCompetitorsData:
        """Parse keyword competitors endpoint response."""
        competitors = [
            KeywordCompetitor(
                domain=c.get("domain", ""),
                overlap_score=c.get("overlap_score", c.get("score", 0.0)),
                common_keywords=c.get("common_keywords"),
                organic_competition=c.get("organic_score"),
                paid_competition=c.get("paid_score"),
            )
            for c in raw.get("data", raw.get("records", []))[:20]
        ]

        return KeywordCompetitorsData(competitors=competitors)

    def _parse_website_rank(self, raw: Dict[str, Any]) -> WebsiteRank:
        """Parse website rank endpoint response."""
        return WebsiteRank(
            global_rank=raw.get("global_rank"),
            country_rank=raw.get("country_rank"),
            country_code=raw.get("country"),
            category_rank=raw.get("category_rank"),
            category=raw.get("category"),
        )

    def _parse_referrals(self, raw: Dict[str, Any]) -> ReferralsData:
        """Parse referrals endpoint response."""
        referrers = [
            ReferralSite(
                domain=r.get("site", r.get("domain", "")),
                share=r.get("share", 0.0),
                visits=r.get("visits"),
            )
            for r in raw.get("referrals", raw.get("records", []))[:20]
        ]

        return ReferralsData(
            referrers=referrers,
            total_referral_share=raw.get("total_share"),
        )

    def _parse_popular_pages(self, raw: Dict[str, Any]) -> PopularPagesData:
        """Parse popular pages endpoint response."""
        pages = [
            PopularPage(
                url=p.get("page", p.get("url", "")),
                share=p.get("share", 0.0),
                page_views=p.get("page_views"),
            )
            for p in raw.get("popular_pages", raw.get("records", []))[:20]
        ]

        return PopularPagesData(pages=pages)

    def _parse_leading_folders(self, raw: Dict[str, Any]) -> LeadingFoldersData:
        """Parse leading folders endpoint response."""
        folders = [
            LeadingFolder(
                folder=f.get("folder", f.get("path", "")),
                share=f.get("share", 0.0),
            )
            for f in raw.get("folders", raw.get("records", []))[:20]
        ]

        return LeadingFoldersData(folders=folders)

    def _parse_landing_pages(self, raw: Dict[str, Any]) -> LandingPagesData:
        """Parse landing pages endpoint response."""
        pages = [
            LandingPage(
                page=p.get("page", p.get("url", "")),
                share=p.get("share", 0.0),
            )
            for p in raw.get("landing_pages", raw.get("records", []))[:20]
        ]

        return LandingPagesData(landing_pages=pages)

    # =========================================================================
    # Public API Methods
    # =========================================================================

    async def get_traffic(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[TrafficMetrics]:
        """
        Get traffic metrics for a domain.

        Args:
            domain: Website domain (e.g., "costco.com")
            country: Country code (default: "ww" for worldwide)
            **kwargs: Additional parameters (start_date, end_date)

        Returns:
            SourcedResponse with TrafficMetrics and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.TRAFFIC.value, params)

    async def get_engagement(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[EngagementMetrics]:
        """
        Get engagement metrics for a domain.

        Args:
            domain: Website domain
            country: Country code
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with EngagementMetrics and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.ENGAGEMENT.value, params)

    async def get_sources(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[TrafficSourceBreakdown]:
        """
        Get traffic sources breakdown for a domain.

        Args:
            domain: Website domain
            country: Country code
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with TrafficSourceBreakdown and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.SOURCES.value, params)

    async def get_geography(
        self,
        domain: str,
        **kwargs,
    ) -> SourcedResponse[GeographyData]:
        """
        Get geographic traffic distribution for a domain.

        Args:
            domain: Website domain
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with GeographyData and citation
        """
        params = {"domain": domain, **kwargs}
        return await self.call(SimilarWebEndpoint.GEOGRAPHY.value, params)

    async def get_demographics(
        self,
        domain: str,
        **kwargs,
    ) -> SourcedResponse[DemographicsData]:
        """
        Get demographics data for a domain.

        Args:
            domain: Website domain
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with DemographicsData and citation
        """
        params = {"domain": domain, **kwargs}
        return await self.call(SimilarWebEndpoint.DEMOGRAPHICS.value, params)

    async def get_keywords(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[KeywordsData]:
        """
        Get top keywords for a domain.

        Args:
            domain: Website domain
            country: Country code
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with KeywordsData and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.KEYWORDS.value, params)

    async def get_audience_interests(
        self,
        domain: str,
        **kwargs,
    ) -> SourcedResponse[AudienceInterests]:
        """
        Get audience interest categories for a domain.

        Args:
            domain: Website domain
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with AudienceInterests and citation
        """
        params = {"domain": domain, **kwargs}
        return await self.call(SimilarWebEndpoint.AUDIENCE_INTERESTS.value, params)

    async def get_similar_sites(
        self,
        domain: str,
        **kwargs,
    ) -> SourcedResponse[SimilarSitesData]:
        """
        Get similar/competitor sites for a domain.

        Args:
            domain: Website domain
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with SimilarSitesData and citation
        """
        params = {"domain": domain, **kwargs}
        return await self.call(SimilarWebEndpoint.SIMILAR_SITES.value, params)

    async def get_keywords_competitors(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[KeywordCompetitorsData]:
        """
        Get keyword competitors for a domain.

        Args:
            domain: Website domain
            country: Country code
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with KeywordCompetitorsData and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.KEYWORDS_COMPETITORS.value, params)

    async def get_website_rank(
        self,
        domain: str,
        **kwargs,
    ) -> SourcedResponse[WebsiteRank]:
        """
        Get website ranking data for a domain.

        Args:
            domain: Website domain
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with WebsiteRank and citation
        """
        params = {"domain": domain, **kwargs}
        return await self.call(SimilarWebEndpoint.WEBSITE_RANK.value, params)

    async def get_referrals(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[ReferralsData]:
        """
        Get referral traffic data for a domain.

        Args:
            domain: Website domain
            country: Country code
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with ReferralsData and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.REFERRALS.value, params)

    async def get_popular_pages(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[PopularPagesData]:
        """
        Get popular pages for a domain.

        Args:
            domain: Website domain
            country: Country code
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with PopularPagesData and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.POPULAR_PAGES.value, params)

    async def get_leading_folders(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[LeadingFoldersData]:
        """
        Get leading URL folders for a domain.

        Args:
            domain: Website domain
            country: Country code
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with LeadingFoldersData and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.LEADING_FOLDERS.value, params)

    async def get_landing_pages(
        self,
        domain: str,
        country: Optional[str] = None,
        **kwargs,
    ) -> SourcedResponse[LandingPagesData]:
        """
        Get landing pages for a domain.

        Args:
            domain: Website domain
            country: Country code
            **kwargs: Additional parameters

        Returns:
            SourcedResponse with LandingPagesData and citation
        """
        params = {"domain": domain, "country": country or self.default_country, **kwargs}
        return await self.call(SimilarWebEndpoint.LANDING_PAGES.value, params)

    async def get_full_traffic_analysis(
        self,
        domain: str,
        country: Optional[str] = None,
    ) -> Dict[str, SourcedResponse]:
        """
        Get comprehensive traffic analysis (all endpoints) for a domain.

        This is a convenience method that calls all 14 endpoints in parallel
        and returns a dictionary with all results.

        Args:
            domain: Website domain
            country: Country code

        Returns:
            Dictionary mapping endpoint names to SourcedResponses
        """
        import asyncio

        country = country or self.default_country

        # Call all endpoints in parallel
        tasks = {
            "traffic": self.get_traffic(domain, country),
            "engagement": self.get_engagement(domain, country),
            "sources": self.get_sources(domain, country),
            "geography": self.get_geography(domain),
            "demographics": self.get_demographics(domain),
            "keywords": self.get_keywords(domain, country),
            "audience_interests": self.get_audience_interests(domain),
            "similar_sites": self.get_similar_sites(domain),
            "keywords_competitors": self.get_keywords_competitors(domain, country),
            "website_rank": self.get_website_rank(domain),
            "referrals": self.get_referrals(domain, country),
            "popular_pages": self.get_popular_pages(domain, country),
            "leading_folders": self.get_leading_folders(domain, country),
            "landing_pages": self.get_landing_pages(domain, country),
        }

        # Gather results
        results = {}
        for name, task in tasks.items():
            try:
                results[name] = await task
            except Exception as e:
                logger.warning(f"Failed to get {name} for {domain}: {e}")
                results[name] = None

        return results
