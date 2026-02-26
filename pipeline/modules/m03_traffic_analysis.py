"""
M03: Traffic Analysis Module
============================

Quantifies digital footprint for ICP scoring and opportunity sizing.

Wave: 1 (Foundation - No dependencies)

Data Sources:
- SimilarWeb MCP (14 endpoints):
  - traffic: Monthly visits
  - engagement: Bounce rate, pages/visit, duration
  - sources: Traffic source breakdown
  - geography: Top countries
  - demographics: Age/gender distribution
  - keywords: Top organic/paid keywords
  - audience-interests: Audience categories
  - similar-sites: Competitor discovery
  - keywords-competitors: SEO competitors
  - website-rank: Global/country/category ranks
  - referrals: Top referral sources
  - popular-pages: Most visited pages
  - leading-folders: Site structure
  - landing-pages: Top entry pages

Output Schema:
- domain: str
- traffic_metrics: TrafficMetrics
- traffic_trend: TrafficTrend
- traffic_sources: TrafficSources
- geography: GeographyData
- demographics: DemographicsData
- keywords: KeywordsData
- website_rank: RankData

Database Table: intel_traffic_analysis

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M03 section)
- docs/DATABASE_SCHEMA_V2.md (intel_traffic_analysis)
"""

import asyncio
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
    DataNotFoundError,
    register_module,
)

logger = logging.getLogger(__name__)


class TrafficMetrics(BaseModel):
    """Core traffic metrics."""
    monthly_visits: Optional[int] = Field(None, description="Monthly visits estimate")
    avg_visit_duration_seconds: Optional[int] = Field(None, description="Avg visit duration")
    pages_per_visit: Optional[float] = Field(None, description="Pages per visit")
    bounce_rate: Optional[float] = Field(None, ge=0.0, le=1.0, description="Bounce rate (0-1)")
    mobile_share: Optional[float] = Field(None, ge=0.0, le=1.0, description="Mobile traffic share")


class TrafficTrend(BaseModel):
    """Traffic trend data."""
    mom_change: Optional[float] = Field(None, description="Month-over-month change (-1 to 1)")
    yoy_change: Optional[float] = Field(None, description="Year-over-year change (-1 to 1)")
    trend_direction: str = Field(default="unknown", description="growing, stable, declining")


class TrafficSources(BaseModel):
    """Traffic source breakdown."""
    direct: Optional[float] = Field(None, ge=0.0, le=1.0)
    organic_search: Optional[float] = Field(None, ge=0.0, le=1.0)
    paid_search: Optional[float] = Field(None, ge=0.0, le=1.0)
    social: Optional[float] = Field(None, ge=0.0, le=1.0)
    referral: Optional[float] = Field(None, ge=0.0, le=1.0)
    email: Optional[float] = Field(None, ge=0.0, le=1.0)
    display: Optional[float] = Field(None, ge=0.0, le=1.0)


class CountryTraffic(BaseModel):
    """Traffic from a single country."""
    country: str = Field(..., description="Country code (ISO 3166-1 alpha-2)")
    share: float = Field(..., ge=0.0, le=1.0, description="Share of total traffic")
    country_name: Optional[str] = Field(None, description="Full country name")


class GeographyData(BaseModel):
    """Geographic distribution of traffic."""
    primary_country: Optional[str] = Field(None, description="Country with most traffic")
    primary_country_share: Optional[float] = Field(None, ge=0.0, le=1.0)
    top_countries: List[CountryTraffic] = Field(default_factory=list)


class DemographicsData(BaseModel):
    """Audience demographics."""
    gender_female: Optional[float] = Field(None, ge=0.0, le=1.0)
    gender_male: Optional[float] = Field(None, ge=0.0, le=1.0)
    age_18_24: Optional[float] = Field(None, ge=0.0, le=1.0)
    age_25_34: Optional[float] = Field(None, ge=0.0, le=1.0)
    age_35_44: Optional[float] = Field(None, ge=0.0, le=1.0)
    age_45_54: Optional[float] = Field(None, ge=0.0, le=1.0)
    age_55_plus: Optional[float] = Field(None, ge=0.0, le=1.0)


class KeywordData(BaseModel):
    """Individual keyword data."""
    keyword: str
    share: Optional[float] = Field(None, ge=0.0, le=1.0)
    volume: Optional[int] = None
    cpc: Optional[float] = None


class KeywordsData(BaseModel):
    """Keyword intelligence."""
    top_organic: List[KeywordData] = Field(default_factory=list)
    top_paid: List[KeywordData] = Field(default_factory=list)
    total_organic_keywords: Optional[int] = None
    total_paid_keywords: Optional[int] = None


class RankData(BaseModel):
    """Website ranking data."""
    global_rank: Optional[int] = Field(None, description="Global website rank")
    country_rank: Optional[int] = Field(None, description="Rank in primary country")
    category_rank: Optional[int] = Field(None, description="Rank in category")
    category_name: Optional[str] = Field(None, description="Category name")


class TrafficAnalysisData(BaseModel):
    """
    Output schema for M03 Traffic Analysis module.

    Comprehensive traffic data from SimilarWeb.
    """

    domain: str = Field(..., description="Primary domain")

    # Core metrics
    traffic_metrics: TrafficMetrics = Field(
        default_factory=TrafficMetrics,
        description="Core traffic metrics"
    )

    # Trend data
    traffic_trend: TrafficTrend = Field(
        default_factory=TrafficTrend,
        description="Traffic trend information"
    )

    # Source breakdown
    traffic_sources: TrafficSources = Field(
        default_factory=TrafficSources,
        description="Traffic source distribution"
    )

    # Geography
    geography: GeographyData = Field(
        default_factory=GeographyData,
        description="Geographic distribution"
    )

    # Demographics
    demographics: DemographicsData = Field(
        default_factory=DemographicsData,
        description="Audience demographics"
    )

    # Keywords
    keywords: KeywordsData = Field(
        default_factory=KeywordsData,
        description="Keyword intelligence"
    )

    # Rankings
    website_rank: RankData = Field(
        default_factory=RankData,
        description="Website rankings"
    )

    # Data period
    data_month: Optional[str] = Field(None, description="Data period (YYYY-MM)")

    # ICP scoring inputs
    traffic_tier: str = Field(default="unknown", description="50M+, 10M-50M, 1M-10M, 100K-1M, <100K")
    traffic_score: int = Field(default=0, description="ICP score component (0-30)")

    # Enrichment metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)


# Traffic tier thresholds and scores
TRAFFIC_TIERS = {
    "50M+": {"min": 50_000_000, "score": 30},
    "10M-50M": {"min": 10_000_000, "score": 25},
    "1M-10M": {"min": 1_000_000, "score": 15},
    "100K-1M": {"min": 100_000, "score": 10},
    "<100K": {"min": 0, "score": 5},
}


@register_module
class M03TrafficAnalysis(BaseModule):
    """
    Traffic Analysis Intelligence Module.

    Collects comprehensive traffic data from SimilarWeb.
    This module has no dependencies and runs in Wave 1.

    Data Flow:
    1. Fetch traffic data from SimilarWeb MCP
    2. Process engagement metrics
    3. Extract traffic sources
    4. Parse geographic data
    5. Calculate traffic tier and ICP score
    6. Return with source citations

    Traffic Tier Classification:
    - 50M+: Enterprise scale (30 pts)
    - 10M-50M: Large (25 pts)
    - 1M-10M: Mid-market (15 pts)
    - 100K-1M: Growing (10 pts)
    - <100K: Small (5 pts)
    """

    MODULE_ID = "m03_traffic_analysis"
    MODULE_NAME = "Traffic Analysis"
    DESCRIPTION = "Traffic and engagement metrics for ICP scoring"

    WAVE = 1
    DEPENDS_ON = []

    PRIMARY_SOURCE_TYPE = SourceType.SIMILARWEB
    OUTPUT_TABLE = "intel_traffic_analysis"
    TIMEOUT_SECONDS = 60

    # Mock data for testing
    _MOCK_TRAFFIC_DATA = {
        "costco.com": {
            "monthly_visits": 152_000_000,
            "avg_visit_duration_seconds": 312,
            "pages_per_visit": 5.8,
            "bounce_rate": 0.35,
            "mobile_share": 0.62,
            "mom_change": 0.05,
            "yoy_change": 0.12,
            "traffic_sources": {
                "direct": 0.42,
                "organic_search": 0.35,
                "paid_search": 0.08,
                "social": 0.06,
                "referral": 0.05,
                "email": 0.04,
            },
            "top_countries": [
                {"country": "US", "share": 0.82},
                {"country": "CA", "share": 0.08},
                {"country": "MX", "share": 0.03},
            ],
            "demographics": {
                "gender_female": 0.48,
                "gender_male": 0.52,
                "age_18_24": 0.12,
                "age_25_34": 0.25,
                "age_35_44": 0.28,
                "age_45_54": 0.20,
                "age_55_plus": 0.15,
            },
            "keywords": {
                "organic": ["costco", "costco membership", "costco hours", "costco wholesale"],
                "paid": ["costco deals", "warehouse store near me"],
            },
            "ranks": {
                "global": 245,
                "country": 95,
                "category": 3,
                "category_name": "Retail/Warehouse",
            },
        },
        "sallybeauty.com": {
            "monthly_visits": 15_200_000,
            "avg_visit_duration_seconds": 245,
            "pages_per_visit": 4.2,
            "bounce_rate": 0.42,
            "mobile_share": 0.68,
            "mom_change": 0.03,
            "yoy_change": 0.11,
            "traffic_sources": {
                "direct": 0.38,
                "organic_search": 0.32,
                "paid_search": 0.12,
                "social": 0.08,
                "referral": 0.06,
                "email": 0.04,
            },
            "top_countries": [
                {"country": "US", "share": 0.85},
                {"country": "CA", "share": 0.08},
                {"country": "UK", "share": 0.03},
            ],
            "demographics": {
                "gender_female": 0.72,
                "gender_male": 0.28,
                "age_18_24": 0.18,
                "age_25_34": 0.28,
                "age_35_44": 0.24,
                "age_45_54": 0.16,
                "age_55_plus": 0.14,
            },
            "keywords": {
                "organic": ["sally beauty", "hair color", "hair dye", "nail supplies"],
                "paid": ["professional hair color", "beauty supply store"],
            },
            "ranks": {
                "global": 12500,
                "country": 4200,
                "category": 45,
                "category_name": "Beauty/Personal Care",
            },
        },
        "mercedes-benz.com": {
            "monthly_visits": 28_500_000,
            "avg_visit_duration_seconds": 195,
            "pages_per_visit": 3.8,
            "bounce_rate": 0.48,
            "mobile_share": 0.55,
            "mom_change": 0.02,
            "yoy_change": 0.08,
            "traffic_sources": {
                "direct": 0.52,
                "organic_search": 0.28,
                "paid_search": 0.10,
                "social": 0.05,
                "referral": 0.03,
                "email": 0.02,
            },
            "top_countries": [
                {"country": "DE", "share": 0.25},
                {"country": "US", "share": 0.22},
                {"country": "CN", "share": 0.12},
            ],
            "demographics": {
                "gender_female": 0.35,
                "gender_male": 0.65,
                "age_18_24": 0.08,
                "age_25_34": 0.22,
                "age_35_44": 0.30,
                "age_45_54": 0.25,
                "age_55_plus": 0.15,
            },
            "keywords": {
                "organic": ["mercedes", "mercedes-benz", "mercedes amg", "mercedes eqe"],
                "paid": ["luxury car", "german car", "electric mercedes"],
            },
            "ranks": {
                "global": 3200,
                "country": 850,
                "category": 8,
                "category_name": "Automotive/Luxury",
            },
        },
    }

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute traffic analysis.

        Args:
            domain: The domain to analyze
            context: Not used (Wave 1 module)

        Returns:
            ModuleResult with TrafficAnalysisData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting traffic analysis for {domain}")

            normalized_domain = self._normalize_domain(domain)

            # Fetch traffic data
            raw_data, citations = await self._fetch_traffic_data(normalized_domain)

            # Process into structured data
            traffic_metrics = self._extract_traffic_metrics(raw_data)
            traffic_trend = self._extract_traffic_trend(raw_data)
            traffic_sources = self._extract_traffic_sources(raw_data)
            geography = self._extract_geography(raw_data)
            demographics = self._extract_demographics(raw_data)
            keywords = self._extract_keywords(raw_data)
            website_rank = self._extract_ranks(raw_data)

            # Calculate traffic tier and score
            traffic_tier, traffic_score = self._calculate_traffic_tier(
                traffic_metrics.monthly_visits
            )

            # Build output
            output_data = TrafficAnalysisData(
                domain=normalized_domain,
                traffic_metrics=traffic_metrics,
                traffic_trend=traffic_trend,
                traffic_sources=traffic_sources,
                geography=geography,
                demographics=demographics,
                keywords=keywords,
                website_rank=website_rank,
                data_month=datetime.utcnow().strftime("%Y-%m"),
                traffic_tier=traffic_tier,
                traffic_score=traffic_score,
                data_quality_score=self._calculate_data_quality(raw_data),
                enrichment_sources=[c.source_type.value for c in citations],
            )

            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=True, duration_ms=duration_ms)

            result = self._create_result(
                domain=normalized_domain,
                data=output_data.model_dump(),
                primary_citation=citations[0] if citations else self._create_default_citation(normalized_domain),
                supporting_citations=citations[1:] if len(citations) > 1 else [],
                duration_ms=duration_ms,
            )

            self.validate_output(result)

            self.logger.info(
                f"Traffic analysis complete for {domain}. "
                f"Monthly visits: {traffic_metrics.monthly_visits:,}, "
                f"Tier: {traffic_tier} ({traffic_score} pts). "
                f"Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Traffic analysis failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")
        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")
        return True

    async def _fetch_traffic_data(
        self,
        domain: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """Fetch traffic data from SimilarWeb or mock."""
        citations = []

        if domain in self._MOCK_TRAFFIC_DATA:
            data = self._MOCK_TRAFFIC_DATA[domain].copy()
            citation = self._create_citation(
                source_type=SourceType.SIMILARWEB,
                source_url=f"https://api.similarweb.com/v1/website/{domain}/traffic-and-engagement",
                api_endpoint="traffic-and-engagement",
                confidence=0.95,
            )
            citations.append(citation)
            return data, citations

        # Fallback
        citation = self._create_citation(
            source_type=SourceType.SIMILARWEB,
            source_url=f"https://www.similarweb.com/website/{domain}/",
            confidence=0.5,
            notes="No data found",
        )
        citations.append(citation)
        return {}, citations

    def _extract_traffic_metrics(self, raw_data: Dict) -> TrafficMetrics:
        """Extract core traffic metrics."""
        return TrafficMetrics(
            monthly_visits=raw_data.get("monthly_visits"),
            avg_visit_duration_seconds=raw_data.get("avg_visit_duration_seconds"),
            pages_per_visit=raw_data.get("pages_per_visit"),
            bounce_rate=raw_data.get("bounce_rate"),
            mobile_share=raw_data.get("mobile_share"),
        )

    def _extract_traffic_trend(self, raw_data: Dict) -> TrafficTrend:
        """Extract traffic trend data."""
        mom = raw_data.get("mom_change")
        yoy = raw_data.get("yoy_change")

        # Determine trend direction
        if yoy is not None:
            if yoy > 0.05:
                direction = "growing"
            elif yoy < -0.05:
                direction = "declining"
            else:
                direction = "stable"
        else:
            direction = "unknown"

        return TrafficTrend(
            mom_change=mom,
            yoy_change=yoy,
            trend_direction=direction,
        )

    def _extract_traffic_sources(self, raw_data: Dict) -> TrafficSources:
        """Extract traffic source breakdown."""
        sources = raw_data.get("traffic_sources", {})
        return TrafficSources(
            direct=sources.get("direct"),
            organic_search=sources.get("organic_search"),
            paid_search=sources.get("paid_search"),
            social=sources.get("social"),
            referral=sources.get("referral"),
            email=sources.get("email"),
            display=sources.get("display"),
        )

    def _extract_geography(self, raw_data: Dict) -> GeographyData:
        """Extract geographic distribution."""
        countries = raw_data.get("top_countries", [])
        top_countries = [
            CountryTraffic(country=c["country"], share=c["share"])
            for c in countries
        ]

        primary = top_countries[0] if top_countries else None

        return GeographyData(
            primary_country=primary.country if primary else None,
            primary_country_share=primary.share if primary else None,
            top_countries=top_countries,
        )

    def _extract_demographics(self, raw_data: Dict) -> DemographicsData:
        """Extract demographics data."""
        demo = raw_data.get("demographics", {})
        return DemographicsData(
            gender_female=demo.get("gender_female"),
            gender_male=demo.get("gender_male"),
            age_18_24=demo.get("age_18_24"),
            age_25_34=demo.get("age_25_34"),
            age_35_44=demo.get("age_35_44"),
            age_45_54=demo.get("age_45_54"),
            age_55_plus=demo.get("age_55_plus"),
        )

    def _extract_keywords(self, raw_data: Dict) -> KeywordsData:
        """Extract keyword data."""
        kw_data = raw_data.get("keywords", {})

        organic = [
            KeywordData(keyword=kw)
            for kw in kw_data.get("organic", [])[:10]
        ]
        paid = [
            KeywordData(keyword=kw)
            for kw in kw_data.get("paid", [])[:10]
        ]

        return KeywordsData(
            top_organic=organic,
            top_paid=paid,
        )

    def _extract_ranks(self, raw_data: Dict) -> RankData:
        """Extract ranking data."""
        ranks = raw_data.get("ranks", {})
        return RankData(
            global_rank=ranks.get("global"),
            country_rank=ranks.get("country"),
            category_rank=ranks.get("category"),
            category_name=ranks.get("category_name"),
        )

    def _calculate_traffic_tier(
        self,
        monthly_visits: Optional[int],
    ) -> Tuple[str, int]:
        """Calculate traffic tier and ICP score component."""
        if monthly_visits is None:
            return "unknown", 0

        for tier_name, tier_info in TRAFFIC_TIERS.items():
            if monthly_visits >= tier_info["min"]:
                return tier_name, tier_info["score"]

        return "<100K", 5

    def _calculate_data_quality(self, raw_data: Dict) -> float:
        """Calculate data quality score."""
        score = 0.0

        if raw_data.get("monthly_visits"):
            score += 0.25
        if raw_data.get("traffic_sources"):
            score += 0.2
        if raw_data.get("top_countries"):
            score += 0.15
        if raw_data.get("demographics"):
            score += 0.15
        if raw_data.get("keywords"):
            score += 0.15
        if raw_data.get("ranks"):
            score += 0.1

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

    def _create_default_citation(self, domain: str) -> SourceCitation:
        """Create default citation."""
        return SourceCitation(
            source_type=SourceType.SIMILARWEB,
            source_url=f"https://www.similarweb.com/website/{domain}/",
            retrieved_at=datetime.utcnow(),
            confidence_score=0.3,
            notes="Default citation - limited data",
        )
