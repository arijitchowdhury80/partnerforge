"""
M03 Traffic Analysis Intelligence Module

Quantifies digital footprint for ICP scoring and opportunity sizing.
This is a Wave 1 (Foundation) module with no dependencies.

Data Sources:
- SimilarWeb MCP (primary): traffic, engagement, sources, geography,
  demographics, keywords, website-rank

Output: Monthly visits, engagement metrics, traffic sources, geographic
distribution, and keyword insights.

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

class CountryShare(BaseModel):
    """Traffic share by country."""
    country: str
    country_code: str
    share: float  # 0.0 to 1.0


class TrafficSourceBreakdown(BaseModel):
    """Traffic source distribution."""
    direct: float = 0.0
    search: float = 0.0
    organic_search: float = 0.0
    paid_search: float = 0.0
    social: float = 0.0
    referral: float = 0.0
    email: float = 0.0
    display: float = 0.0


class TrafficAnalysisData(BaseModel):
    """
    Traffic Analysis data model - output of M03 module.

    Captures website traffic metrics and engagement data from SimilarWeb.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Traffic volume
    monthly_visits: Optional[int] = Field(None, description="Total monthly visits")
    monthly_visits_formatted: Optional[str] = Field(
        None, description="Human-readable visits (e.g., '15.2M')"
    )
    unique_visitors: Optional[int] = Field(None, description="Unique monthly visitors")
    monthly_visits_trend: Optional[float] = Field(
        None, description="Month-over-month change (%)"
    )
    yoy_trend: Optional[float] = Field(None, description="Year-over-year change (%)")

    # Rankings
    global_rank: Optional[int] = Field(None, description="Global website rank")
    country_rank: Optional[int] = Field(None, description="Rank in primary country")
    category_rank: Optional[int] = Field(None, description="Rank in category")

    # Engagement metrics
    pages_per_visit: Optional[float] = Field(None, description="Average pages per visit")
    avg_visit_duration: Optional[int] = Field(
        None, description="Average visit duration (seconds)"
    )
    avg_visit_duration_formatted: Optional[str] = Field(
        None, description="Human-readable duration (e.g., '3:45')"
    )
    bounce_rate: Optional[float] = Field(None, description="Bounce rate (0.0 to 1.0)")

    # Traffic sources
    traffic_sources: Optional[TrafficSourceBreakdown] = Field(
        None, description="Traffic source breakdown"
    )
    direct_traffic_pct: Optional[float] = Field(None, description="Direct traffic %")
    search_traffic_pct: Optional[float] = Field(None, description="Search traffic %")
    organic_search_pct: Optional[float] = Field(None, description="Organic search %")
    paid_search_pct: Optional[float] = Field(None, description="Paid search %")
    social_traffic_pct: Optional[float] = Field(None, description="Social traffic %")
    referral_traffic_pct: Optional[float] = Field(None, description="Referral traffic %")
    email_traffic_pct: Optional[float] = Field(None, description="Email traffic %")

    # Geographic distribution
    primary_country: Optional[str] = Field(None, description="Primary traffic country")
    primary_country_share: Optional[float] = Field(
        None, description="Primary country traffic share"
    )
    top_countries: List[CountryShare] = Field(
        default_factory=list, description="Top countries by traffic"
    )

    # Device breakdown
    desktop_pct: Optional[float] = Field(None, description="Desktop traffic %")
    mobile_pct: Optional[float] = Field(None, description="Mobile traffic %")

    # Keywords
    top_organic_keywords: List[str] = Field(
        default_factory=list, description="Top organic search keywords"
    )
    top_paid_keywords: List[str] = Field(
        default_factory=list, description="Top paid search keywords"
    )

    # Traffic score for ICP
    traffic_score: int = Field(0, description="Traffic score for ICP (0-30)")
    traffic_tier: Optional[str] = Field(None, description="Traffic tier (high/medium/low)")


# =============================================================================
# Module Implementation
# =============================================================================

@register_module
class M03TrafficAnalysisModule(BaseIntelligenceModule):
    """
    M03: Traffic Analysis - website traffic metrics and engagement.

    Wave 1 (Foundation) module with no dependencies.
    Collects traffic data from SimilarWeb API.
    """

    MODULE_ID = "m03_traffic_analysis"
    MODULE_NAME = "Traffic Analysis"
    WAVE = 1
    DEPENDS_ON = []
    SOURCE_TYPE = "api"
    CACHE_TTL = 259200  # 3 days (traffic data is more dynamic)

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform enrichment for a domain.

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
                self.logger.info(f"Returning cached result for: {domain}")
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
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched traffic analysis for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch raw data from SimilarWeb API.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with traffic data and source citation
        """
        similarweb_data = {}
        errors = []

        # Try SimilarWeb
        try:
            similarweb_data = await self._fetch_from_similarweb(domain)
            self.logger.debug(f"SimilarWeb returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"SimilarWeb fetch failed for {domain}: {e}")
            errors.append(f"SimilarWeb: {e}")

        # If SimilarWeb failed, raise error
        if not similarweb_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        return similarweb_data

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into TrafficAnalysisData schema.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching TrafficAnalysisData fields
        """
        # Extract traffic sources
        sources = raw_data.get("traffic_sources", {})
        traffic_sources = TrafficSourceBreakdown(
            direct=sources.get("direct", 0.0),
            search=sources.get("search", 0.0),
            organic_search=sources.get("organic_search", 0.0),
            paid_search=sources.get("paid_search", 0.0),
            social=sources.get("social", 0.0),
            referral=sources.get("referral", 0.0),
            email=sources.get("email", 0.0),
            display=sources.get("display", 0.0),
        )

        # Extract top countries
        top_countries = []
        for country_data in raw_data.get("top_countries", []):
            top_countries.append(CountryShare(
                country=country_data.get("country", "Unknown"),
                country_code=country_data.get("country_code", "XX"),
                share=country_data.get("share", 0.0),
            ))

        # Determine primary country
        primary_country = None
        primary_country_share = None
        if top_countries:
            primary_country = top_countries[0].country
            primary_country_share = top_countries[0].share

        # Format monthly visits
        monthly_visits = raw_data.get("monthly_visits")
        monthly_visits_formatted = self._format_number(monthly_visits)

        # Format visit duration
        avg_visit_duration = raw_data.get("avg_visit_duration")
        avg_visit_duration_formatted = self._format_duration(avg_visit_duration)

        # Calculate traffic score for ICP
        traffic_score, traffic_tier = self._calculate_traffic_score(monthly_visits)

        return {
            "domain": raw_data.get("domain"),
            "monthly_visits": monthly_visits,
            "monthly_visits_formatted": monthly_visits_formatted,
            "unique_visitors": raw_data.get("unique_visitors"),
            "monthly_visits_trend": raw_data.get("monthly_visits_trend"),
            "yoy_trend": raw_data.get("yoy_trend"),
            "global_rank": raw_data.get("global_rank"),
            "country_rank": raw_data.get("country_rank"),
            "category_rank": raw_data.get("category_rank"),
            "pages_per_visit": raw_data.get("pages_per_visit"),
            "avg_visit_duration": avg_visit_duration,
            "avg_visit_duration_formatted": avg_visit_duration_formatted,
            "bounce_rate": raw_data.get("bounce_rate"),
            "traffic_sources": traffic_sources.model_dump(),
            "direct_traffic_pct": sources.get("direct"),
            "search_traffic_pct": sources.get("search"),
            "organic_search_pct": sources.get("organic_search"),
            "paid_search_pct": sources.get("paid_search"),
            "social_traffic_pct": sources.get("social"),
            "referral_traffic_pct": sources.get("referral"),
            "email_traffic_pct": sources.get("email"),
            "primary_country": primary_country,
            "primary_country_share": primary_country_share,
            "top_countries": [c.model_dump() for c in top_countries],
            "desktop_pct": raw_data.get("desktop_pct"),
            "mobile_pct": raw_data.get("mobile_pct"),
            "top_organic_keywords": raw_data.get("top_organic_keywords", []),
            "top_paid_keywords": raw_data.get("top_paid_keywords", []),
            "traffic_score": traffic_score,
            "traffic_tier": traffic_tier,
            # Preserve source info
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_from_similarweb(self, domain: str) -> Dict[str, Any]:
        """
        Fetch traffic data from SimilarWeb API.

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
        Call SimilarWeb API (mock implementation).

        In production, this will use the SimilarWeb MCP server.
        """
        now = datetime.now()

        # Mock response matching expected SimilarWeb structure
        return {
            "domain": domain,
            "monthly_visits": 15200000,
            "unique_visitors": 10500000,
            "monthly_visits_trend": 0.03,
            "yoy_trend": 0.11,
            "global_rank": 12500,
            "country_rank": 4200,
            "category_rank": 45,
            "pages_per_visit": 4.2,
            "avg_visit_duration": 245,  # seconds
            "bounce_rate": 0.42,
            "traffic_sources": {
                "direct": 0.38,
                "search": 0.44,
                "organic_search": 0.32,
                "paid_search": 0.12,
                "social": 0.08,
                "referral": 0.06,
                "email": 0.04,
                "display": 0.0,
            },
            "top_countries": [
                {"country": "United States", "country_code": "US", "share": 0.85},
                {"country": "Canada", "country_code": "CA", "share": 0.08},
                {"country": "United Kingdom", "country_code": "UK", "share": 0.03},
                {"country": "Mexico", "country_code": "MX", "share": 0.02},
                {"country": "Australia", "country_code": "AU", "share": 0.02},
            ],
            "desktop_pct": 0.32,
            "mobile_pct": 0.68,
            "top_organic_keywords": [
                "company name",
                "product category",
                "brand name",
                "product type",
            ],
            "top_paid_keywords": [
                "buy product",
                "product store",
                "best product",
            ],
            "source_url": f"https://www.similarweb.com/website/{domain}/",
            "source_date": now.isoformat(),
        }

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> TrafficAnalysisData:
        """
        Validate transformed data and create TrafficAnalysisData model.

        Args:
            domain: The requested domain
            transformed_data: Data from transform_data()

        Returns:
            Validated TrafficAnalysisData model
        """
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert nested dicts back to models
        traffic_sources = None
        if transformed_data.get("traffic_sources"):
            traffic_sources = TrafficSourceBreakdown(**transformed_data["traffic_sources"])

        top_countries = [
            CountryShare(**c) for c in transformed_data.get("top_countries", [])
        ]

        return TrafficAnalysisData(
            domain=domain,
            monthly_visits=transformed_data.get("monthly_visits"),
            monthly_visits_formatted=transformed_data.get("monthly_visits_formatted"),
            unique_visitors=transformed_data.get("unique_visitors"),
            monthly_visits_trend=transformed_data.get("monthly_visits_trend"),
            yoy_trend=transformed_data.get("yoy_trend"),
            global_rank=transformed_data.get("global_rank"),
            country_rank=transformed_data.get("country_rank"),
            category_rank=transformed_data.get("category_rank"),
            pages_per_visit=transformed_data.get("pages_per_visit"),
            avg_visit_duration=transformed_data.get("avg_visit_duration"),
            avg_visit_duration_formatted=transformed_data.get("avg_visit_duration_formatted"),
            bounce_rate=transformed_data.get("bounce_rate"),
            traffic_sources=traffic_sources,
            direct_traffic_pct=transformed_data.get("direct_traffic_pct"),
            search_traffic_pct=transformed_data.get("search_traffic_pct"),
            organic_search_pct=transformed_data.get("organic_search_pct"),
            paid_search_pct=transformed_data.get("paid_search_pct"),
            social_traffic_pct=transformed_data.get("social_traffic_pct"),
            referral_traffic_pct=transformed_data.get("referral_traffic_pct"),
            email_traffic_pct=transformed_data.get("email_traffic_pct"),
            primary_country=transformed_data.get("primary_country"),
            primary_country_share=transformed_data.get("primary_country_share"),
            top_countries=top_countries,
            desktop_pct=transformed_data.get("desktop_pct"),
            mobile_pct=transformed_data.get("mobile_pct"),
            top_organic_keywords=transformed_data.get("top_organic_keywords", []),
            top_paid_keywords=transformed_data.get("top_paid_keywords", []),
            traffic_score=transformed_data.get("traffic_score", 0),
            traffic_tier=transformed_data.get("traffic_tier"),
        )

    def _format_number(self, num: Optional[int]) -> Optional[str]:
        """Format large numbers for human readability."""
        if num is None:
            return None
        if num >= 1_000_000_000:
            return f"{num / 1_000_000_000:.1f}B"
        elif num >= 1_000_000:
            return f"{num / 1_000_000:.1f}M"
        elif num >= 1_000:
            return f"{num / 1_000:.1f}K"
        return str(num)

    def _format_duration(self, seconds: Optional[int]) -> Optional[str]:
        """Format duration in seconds to MM:SS format."""
        if seconds is None:
            return None
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"

    def _calculate_traffic_score(self, monthly_visits: Optional[int]) -> tuple[int, Optional[str]]:
        """
        Calculate traffic score for ICP scoring.

        Returns:
            Tuple of (score, tier)
        """
        if monthly_visits is None:
            return 0, None

        # Traffic scoring tiers
        if monthly_visits >= 50_000_000:
            return 30, "very_high"
        elif monthly_visits >= 10_000_000:
            return 25, "high"
        elif monthly_visits >= 1_000_000:
            return 15, "medium"
        elif monthly_visits >= 100_000:
            return 10, "low"
        else:
            return 5, "very_low"
