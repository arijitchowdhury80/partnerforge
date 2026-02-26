"""
M03 Traffic Analysis Intelligence Module

Analyzes website traffic metrics for ICP scoring and opportunity sizing.
This is a Wave 1 (Foundation) module with no dependencies.

Data Sources:
- SimilarWeb MCP (14 endpoints): traffic, engagement, sources, geography,
  demographics, keywords, audience-interests, similar-sites, keywords-competitors,
  website-rank, referrals, popular-pages, leading-folders, landing-pages

Output: Monthly visits, engagement metrics, traffic sources, geography,
demographics, keywords, website ranking, and estimated search revenue.

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
from ..services.api_client import similarweb_client, APIClientError, APIKeyMissingError
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# =============================================================================
# Data Models
# =============================================================================


class TrafficMetrics(BaseModel):
    """Core traffic metrics from SimilarWeb."""

    monthly_visits: int = Field(..., description="Total monthly visits")
    unique_visitors: Optional[int] = Field(None, description="Unique monthly visitors")
    avg_visit_duration_seconds: Optional[float] = Field(
        None, description="Average visit duration in seconds"
    )
    pages_per_visit: Optional[float] = Field(None, description="Pages per visit")
    bounce_rate: Optional[float] = Field(
        None, description="Bounce rate (0-1)", ge=0, le=1
    )
    mobile_share: Optional[float] = Field(
        None, description="Mobile traffic share (0-1)", ge=0, le=1
    )


class TrafficTrend(BaseModel):
    """Traffic trend analysis."""

    mom_change: Optional[float] = Field(
        None, description="Month-over-month change (-1 to +inf)"
    )
    yoy_change: Optional[float] = Field(
        None, description="Year-over-year change (-1 to +inf)"
    )
    trend_direction: Optional[str] = Field(
        None, description="Trend direction: growing, stable, declining"
    )


class TrafficSources(BaseModel):
    """Traffic source breakdown."""

    direct: Optional[float] = Field(None, description="Direct traffic share (0-1)")
    organic_search: Optional[float] = Field(
        None, description="Organic search share (0-1)"
    )
    paid_search: Optional[float] = Field(None, description="Paid search share (0-1)")
    social: Optional[float] = Field(None, description="Social traffic share (0-1)")
    referral: Optional[float] = Field(None, description="Referral traffic share (0-1)")
    email: Optional[float] = Field(None, description="Email traffic share (0-1)")
    display: Optional[float] = Field(None, description="Display ads traffic share (0-1)")


class CountryShare(BaseModel):
    """Country traffic share."""

    country: str = Field(..., description="Country code (e.g., 'US')")
    share: float = Field(..., description="Traffic share (0-1)", ge=0, le=1)


class Geography(BaseModel):
    """Geographic traffic distribution."""

    primary_country: Optional[str] = Field(None, description="Primary country code")
    primary_country_share: Optional[float] = Field(
        None, description="Primary country traffic share (0-1)"
    )
    top_countries: List[CountryShare] = Field(
        default_factory=list, description="Top countries by traffic"
    )


class Demographics(BaseModel):
    """Audience demographics."""

    gender_split: Optional[Dict[str, float]] = Field(
        None, description="Gender split (e.g., {'female': 0.72, 'male': 0.28})"
    )
    age_distribution: Optional[Dict[str, float]] = Field(
        None,
        description="Age distribution (e.g., {'18-24': 0.18, '25-34': 0.28, ...})",
    )


class Keywords(BaseModel):
    """Top keywords driving traffic."""

    top_organic: List[str] = Field(
        default_factory=list, description="Top organic keywords"
    )
    top_paid: List[str] = Field(default_factory=list, description="Top paid keywords")


class WebsiteRank(BaseModel):
    """Website ranking metrics."""

    global_rank: Optional[int] = Field(None, description="Global website rank")
    country_rank: Optional[int] = Field(None, description="Country-specific rank")
    category_rank: Optional[int] = Field(None, description="Category rank")
    category: Optional[str] = Field(None, description="Website category")


class SearchRevenueEstimate(BaseModel):
    """Estimated search-related revenue potential."""

    monthly_search_visits: int = Field(
        ..., description="Monthly visits from search (organic + paid)"
    )
    search_traffic_share: float = Field(
        ..., description="Total search traffic share (0-1)"
    )
    estimated_conversion_rate: float = Field(
        default=0.02, description="Assumed conversion rate (default 2%)"
    )
    assumed_aov: float = Field(
        default=75.0, description="Assumed average order value (USD)"
    )
    estimated_search_revenue: float = Field(
        ..., description="Estimated monthly search-driven revenue (USD)"
    )


class TrafficAnalysisData(BaseModel):
    """
    Traffic Analysis data model - output of M03 module.

    Captures comprehensive traffic metrics for ICP scoring and opportunity sizing.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Core metrics
    traffic_metrics: TrafficMetrics = Field(..., description="Core traffic metrics")

    # Trend analysis
    traffic_trend: Optional[TrafficTrend] = Field(
        None, description="Traffic trend analysis"
    )

    # Traffic sources
    traffic_sources: Optional[TrafficSources] = Field(
        None, description="Traffic source breakdown"
    )

    # Geography
    geography: Optional[Geography] = Field(
        None, description="Geographic traffic distribution"
    )

    # Demographics
    demographics: Optional[Demographics] = Field(None, description="Audience demographics")

    # Keywords
    keywords: Optional[Keywords] = Field(None, description="Top keywords")

    # Ranking
    website_rank: Optional[WebsiteRank] = Field(None, description="Website rankings")

    # Search revenue estimate
    search_revenue_estimate: Optional[SearchRevenueEstimate] = Field(
        None, description="Estimated search-driven revenue"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M03TrafficModule(BaseIntelligenceModule):
    """
    M03: Traffic Analysis - website traffic metrics and opportunity sizing.

    Wave 1 (Foundation) module with no dependencies.
    Collects traffic data from SimilarWeb API.
    """

    MODULE_ID = "m03_traffic"
    MODULE_NAME = "Traffic Analysis"
    WAVE = 1
    DEPENDS_ON = []
    SOURCE_TYPE = "api"
    CACHE_TTL = 86400  # 1 day (traffic data changes frequently)

    # Default assumptions for revenue estimation
    DEFAULT_CONVERSION_RATE = 0.02  # 2%
    DEFAULT_AOV = 75.0  # $75 USD

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform traffic enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with TrafficAnalysisData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching traffic analysis for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached traffic result for: {domain}")
                return cached

        # Fetch raw data
        raw_data = await self.fetch_data(domain)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        traffic_data = await self._validate_and_store(domain, transformed)

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
            data=traffic_data,
            source_url=source_url,
            source_date=source_date,
            source_type="traffic",  # Use traffic-specific type for 30-day freshness
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched traffic analysis for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch raw data from SimilarWeb API.

        Calls multiple SimilarWeb endpoints and merges the data.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged data from all SimilarWeb endpoints
        """
        similarweb_data = {}
        errors = []

        # Try SimilarWeb API (primary and only source for traffic)
        try:
            similarweb_data = await self._fetch_from_similarweb(domain)
            self.logger.debug(f"SimilarWeb returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"SimilarWeb fetch failed for {domain}: {e}")
            errors.append(f"SimilarWeb: {e}")

        # If SimilarWeb failed, raise error (no fallback for traffic data)
        if not similarweb_data:
            raise Exception(
                f"Failed to enrich traffic for {domain}. SimilarWeb failed: {'; '.join(errors)}"
            )

        return similarweb_data

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw SimilarWeb data into TrafficAnalysisData schema.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching TrafficAnalysisData fields
        """
        # Extract nested structures
        traffic_metrics_raw = raw_data.get("traffic_metrics", {})
        traffic_trend_raw = raw_data.get("traffic_trend", {})
        traffic_sources_raw = raw_data.get("traffic_sources", {})
        geography_raw = raw_data.get("geography", {})
        demographics_raw = raw_data.get("demographics", {})
        keywords_raw = raw_data.get("keywords", {})
        website_rank_raw = raw_data.get("website_rank", {})

        # Build traffic metrics
        traffic_metrics = {
            "monthly_visits": traffic_metrics_raw.get("monthly_visits", 0),
            "unique_visitors": traffic_metrics_raw.get("unique_visitors"),
            "avg_visit_duration_seconds": traffic_metrics_raw.get(
                "avg_visit_duration_seconds"
            ),
            "pages_per_visit": traffic_metrics_raw.get("pages_per_visit"),
            "bounce_rate": traffic_metrics_raw.get("bounce_rate"),
            "mobile_share": traffic_metrics_raw.get("mobile_share"),
        }

        # Build traffic trend
        traffic_trend = None
        if traffic_trend_raw:
            traffic_trend = {
                "mom_change": traffic_trend_raw.get("mom_change"),
                "yoy_change": traffic_trend_raw.get("yoy_change"),
                "trend_direction": traffic_trend_raw.get("trend_direction"),
            }

        # Build traffic sources
        traffic_sources = None
        if traffic_sources_raw:
            traffic_sources = {
                "direct": traffic_sources_raw.get("direct"),
                "organic_search": traffic_sources_raw.get("organic_search"),
                "paid_search": traffic_sources_raw.get("paid_search"),
                "social": traffic_sources_raw.get("social"),
                "referral": traffic_sources_raw.get("referral"),
                "email": traffic_sources_raw.get("email"),
                "display": traffic_sources_raw.get("display"),
            }

        # Build geography
        geography = None
        if geography_raw:
            top_countries = geography_raw.get("top_countries", [])
            geography = {
                "primary_country": geography_raw.get("primary_country"),
                "primary_country_share": geography_raw.get("primary_country_share"),
                "top_countries": top_countries,
            }

        # Build demographics
        demographics = None
        if demographics_raw:
            demographics = {
                "gender_split": demographics_raw.get("gender_split"),
                "age_distribution": demographics_raw.get("age_distribution"),
            }

        # Build keywords
        keywords = None
        if keywords_raw:
            keywords = {
                "top_organic": keywords_raw.get("top_organic", []),
                "top_paid": keywords_raw.get("top_paid", []),
            }

        # Build website rank
        website_rank = None
        if website_rank_raw:
            website_rank = {
                "global_rank": website_rank_raw.get("global_rank"),
                "country_rank": website_rank_raw.get("country_rank"),
                "category_rank": website_rank_raw.get("category_rank"),
                "category": website_rank_raw.get("category"),
            }

        # Calculate search revenue estimate
        search_revenue_estimate = self._calculate_search_revenue(
            traffic_metrics, traffic_sources
        )

        return {
            "domain": raw_data.get("domain"),
            "traffic_metrics": traffic_metrics,
            "traffic_trend": traffic_trend,
            "traffic_sources": traffic_sources,
            "geography": geography,
            "demographics": demographics,
            "keywords": keywords,
            "website_rank": website_rank,
            "search_revenue_estimate": search_revenue_estimate,
            # Preserve source info for result creation
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_from_similarweb(self, domain: str) -> Dict[str, Any]:
        """
        Fetch traffic data from SimilarWeb API.

        In production, this calls the SimilarWeb MCP with multiple endpoints.
        For now, returns mock data.

        Args:
            domain: The domain to look up

        Returns:
            dict with SimilarWeb data and source citation
        """
        # TODO: Replace with actual SimilarWeb API calls
        # In production, call these endpoints:
        # - traffic
        # - engagement
        # - sources
        # - geography
        # - demographics
        # - keywords
        # - website-rank
        return await self._call_similarweb_api(domain)

    async def _call_similarweb_api(self, domain: str) -> Dict[str, Any]:
        """
        Call SimilarWeb API to get traffic and engagement data.

        Uses the SimilarWebClient from api_client service which handles:
        - Multiple endpoint aggregation (traffic, engagement, sources, geo, rank)
        - Rate limiting and retries
        - Error handling

        Args:
            domain: The domain to look up

        Returns:
            Dict with traffic data and source citation

        Raises:
            APIKeyMissingError: If SIMILARWEB_API_KEY is not configured
            APIClientError: If API request fails
        """
        try:
            return await similarweb_client.get_traffic_and_engagement(domain)
        except APIKeyMissingError:
            self.logger.error("SimilarWeb API key not configured")
            raise
        except APIClientError as e:
            self.logger.error(f"SimilarWeb API error for {domain}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error calling SimilarWeb API for {domain}: {e}")
            raise APIClientError(f"SimilarWeb API call failed: {e}")

    def _calculate_search_revenue(
        self,
        traffic_metrics: Dict[str, Any],
        traffic_sources: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """
        Calculate estimated search-driven revenue.

        Formula: monthly_visits * search_traffic_share * conversion_rate * AOV

        Args:
            traffic_metrics: Core traffic metrics
            traffic_sources: Traffic source breakdown

        Returns:
            Dict with search revenue estimate or None
        """
        monthly_visits = traffic_metrics.get("monthly_visits", 0)
        if not monthly_visits or not traffic_sources:
            return None

        # Calculate total search traffic share
        organic_search = traffic_sources.get("organic_search", 0) or 0
        paid_search = traffic_sources.get("paid_search", 0) or 0
        search_traffic_share = organic_search + paid_search

        if search_traffic_share == 0:
            return None

        # Calculate monthly search visits
        monthly_search_visits = int(monthly_visits * search_traffic_share)

        # Calculate estimated revenue
        estimated_revenue = (
            monthly_search_visits
            * self.DEFAULT_CONVERSION_RATE
            * self.DEFAULT_AOV
        )

        return {
            "monthly_search_visits": monthly_search_visits,
            "search_traffic_share": search_traffic_share,
            "estimated_conversion_rate": self.DEFAULT_CONVERSION_RATE,
            "assumed_aov": self.DEFAULT_AOV,
            "estimated_search_revenue": round(estimated_revenue, 2),
        }

    async def _validate_and_store(
        self, domain: str, transformed_data: Dict[str, Any]
    ) -> TrafficAnalysisData:
        """
        Validate transformed data and create TrafficAnalysisData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated TrafficAnalysisData model

        Raises:
            ValueError: If domain mismatch or validation fails
        """
        # Validate domain matches
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Build nested models
        traffic_metrics = TrafficMetrics(**transformed_data.get("traffic_metrics", {}))

        traffic_trend = None
        if transformed_data.get("traffic_trend"):
            traffic_trend = TrafficTrend(**transformed_data["traffic_trend"])

        traffic_sources = None
        if transformed_data.get("traffic_sources"):
            traffic_sources = TrafficSources(**transformed_data["traffic_sources"])

        geography = None
        if transformed_data.get("geography"):
            geo_data = transformed_data["geography"]
            top_countries = [
                CountryShare(**c) for c in geo_data.get("top_countries", [])
            ]
            geography = Geography(
                primary_country=geo_data.get("primary_country"),
                primary_country_share=geo_data.get("primary_country_share"),
                top_countries=top_countries,
            )

        demographics = None
        if transformed_data.get("demographics"):
            demographics = Demographics(**transformed_data["demographics"])

        keywords = None
        if transformed_data.get("keywords"):
            keywords = Keywords(**transformed_data["keywords"])

        website_rank = None
        if transformed_data.get("website_rank"):
            website_rank = WebsiteRank(**transformed_data["website_rank"])

        search_revenue_estimate = None
        if transformed_data.get("search_revenue_estimate"):
            search_revenue_estimate = SearchRevenueEstimate(
                **transformed_data["search_revenue_estimate"]
            )

        # Create and return the data model
        return TrafficAnalysisData(
            domain=domain,
            traffic_metrics=traffic_metrics,
            traffic_trend=traffic_trend,
            traffic_sources=traffic_sources,
            geography=geography,
            demographics=demographics,
            keywords=keywords,
            website_rank=website_rank,
            search_revenue_estimate=search_revenue_estimate,
        )
