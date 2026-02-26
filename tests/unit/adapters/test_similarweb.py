"""
Unit Tests for SimilarWebAdapter
================================

Comprehensive tests for all 14 SimilarWeb API endpoints with:
- P0 source citation enforcement
- Response parsing validation
- Error handling
- Cache behavior
- Rate limiting
- Circuit breaker integration

Run:
    pytest tests/unit/adapters/test_similarweb.py -v

Run with coverage:
    pytest tests/unit/adapters/test_similarweb.py --cov=pipeline.adapters.similarweb -v
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
from typing import Dict, Any

from pipeline.adapters.similarweb import (
    SimilarWebAdapter,
    SimilarWebEndpoint,
    # Response Models
    TrafficMetrics,
    EngagementMetrics,
    TrafficSourceBreakdown,
    GeographyData,
    CountryTraffic,
    DemographicsData,
    AgeDistribution,
    GenderDistribution,
    KeywordsData,
    Keyword,
    AudienceInterests,
    InterestCategory,
    SimilarSitesData,
    SimilarSite,
    KeywordCompetitorsData,
    KeywordCompetitor,
    WebsiteRank,
    ReferralsData,
    ReferralSite,
    PopularPagesData,
    PopularPage,
    LeadingFoldersData,
    LeadingFolder,
    LandingPagesData,
    LandingPage,
)
from pipeline.adapters.base import (
    SourcedResponse,
    APIError,
    RateLimitError,
)
from pipeline.models.source import SourceCitation, SourceType
from pipeline.utils.circuit_breaker import CircuitBreaker, CircuitOpenError, CircuitState
from pipeline.utils.rate_limiter import TokenBucketRateLimiter


# =============================================================================
# Mock API Responses
# =============================================================================


MOCK_TRAFFIC_RESPONSE = {
    "visits": [
        {"date": "2024-01-01", "visits": 15000000, "unique_visitors": 8000000},
        {"date": "2024-02-01", "visits": 15500000, "unique_visitors": 8200000},
    ],
    "mobile_share": 0.68,
    "desktop_share": 0.32,
}

MOCK_ENGAGEMENT_RESPONSE = {
    "bounce_rate": 0.42,
    "pages_per_visit": 5.2,
    "average_visit_duration": 245.5,
    "page_views": 75000000,
}

MOCK_SOURCES_RESPONSE = {
    "direct": {"share": 0.38},
    "organic_search": {"share": 0.32},
    "paid_search": {"share": 0.12},
    "social": {"share": 0.08},
    "referrals": {"share": 0.06},
    "mail": {"share": 0.04},
    "display_ads": {"share": 0.00},
}

MOCK_GEOGRAPHY_RESPONSE = {
    "records": [
        {"country": "US", "country_name": "United States", "share": 0.85, "visits": 13000000},
        {"country": "CA", "country_name": "Canada", "share": 0.08, "visits": 1200000},
        {"country": "UK", "country_name": "United Kingdom", "share": 0.03, "visits": 450000},
    ]
}

MOCK_DEMOGRAPHICS_RESPONSE = {
    "age_distribution": {
        "18-24": 0.18,
        "25-34": 0.28,
        "35-44": 0.24,
        "45-54": 0.16,
        "55-64": 0.09,
        "65+": 0.05,
    },
    "gender_distribution": {
        "male": 0.45,
        "female": 0.55,
    },
}

MOCK_KEYWORDS_RESPONSE = {
    "organic": [
        {"search_term": "costco", "share": 0.15, "volume": 5000000, "cpc": 0.85, "position": 1},
        {"search_term": "costco membership", "share": 0.08, "volume": 300000, "cpc": 1.20, "position": 1},
    ],
    "paid": [
        {"search_term": "wholesale store", "share": 0.05, "volume": 50000, "cpc": 2.50, "position": 2},
    ],
    "total_organic": 15000,
    "total_paid": 500,
}

MOCK_AUDIENCE_INTERESTS_RESPONSE = {
    "categories": [
        {"name": "Shopping", "affinity": 0.85},
        {"name": "Food & Drink", "affinity": 0.72},
        {"name": "Travel", "affinity": 0.45},
    ]
}

MOCK_SIMILAR_SITES_RESPONSE = {
    "similar_sites": [
        {"site": "samsclub.com", "score": 0.78, "visits": 25000000, "category": "Retail"},
        {"site": "bjs.com", "score": 0.65, "visits": 8000000, "category": "Retail"},
    ]
}

MOCK_KEYWORDS_COMPETITORS_RESPONSE = {
    "data": [
        {"domain": "walmart.com", "overlap_score": 0.72, "common_keywords": 5000, "organic_score": 0.68, "paid_score": 0.55},
        {"domain": "target.com", "overlap_score": 0.58, "common_keywords": 3000, "organic_score": 0.52, "paid_score": 0.45},
    ]
}

MOCK_WEBSITE_RANK_RESPONSE = {
    "global_rank": 125,
    "country_rank": 45,
    "country": "US",
    "category_rank": 3,
    "category": "Shopping > Retail",
}

MOCK_REFERRALS_RESPONSE = {
    "referrals": [
        {"site": "google.com", "share": 0.25, "visits": 500000},
        {"site": "facebook.com", "share": 0.15, "visits": 300000},
    ],
    "total_share": 0.06,
}

MOCK_POPULAR_PAGES_RESPONSE = {
    "popular_pages": [
        {"page": "/", "share": 0.35, "page_views": 5000000},
        {"page": "/membership", "share": 0.12, "page_views": 1800000},
    ]
}

MOCK_LEADING_FOLDERS_RESPONSE = {
    "folders": [
        {"folder": "/product", "share": 0.45},
        {"folder": "/category", "share": 0.25},
    ]
}

MOCK_LANDING_PAGES_RESPONSE = {
    "landing_pages": [
        {"page": "/", "share": 0.55},
        {"page": "/membership", "share": 0.18},
    ]
}


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_api_key() -> str:
    """Test API key."""
    return "test-api-key-12345"


@pytest.fixture
def adapter(mock_api_key) -> SimilarWebAdapter:
    """Create SimilarWebAdapter with mock API key and high rate limits for testing."""
    adapter = SimilarWebAdapter(api_key=mock_api_key)
    # Use a permissive rate limiter for unit tests
    adapter.rate_limiter = TokenBucketRateLimiter(
        name="test_sw_permissive",
        tokens_per_second=1000.0,  # Very high for tests
        bucket_size=1000,
    )
    return adapter


@pytest.fixture
def adapter_with_rate_limiter(mock_api_key) -> SimilarWebAdapter:
    """Create SimilarWebAdapter with explicit rate limiter for testing."""
    adapter = SimilarWebAdapter(api_key=mock_api_key)
    adapter.rate_limiter = TokenBucketRateLimiter(
        name="test_sw_rl",
        tokens_per_second=1.0,
        bucket_size=2,
    )
    return adapter


@pytest.fixture
def adapter_with_circuit_breaker(mock_api_key) -> SimilarWebAdapter:
    """Create SimilarWebAdapter with explicit circuit breaker for testing."""
    adapter = SimilarWebAdapter(api_key=mock_api_key)
    adapter.circuit_breaker = CircuitBreaker(
        name="test_sw_cb",
        failure_threshold=3,
        recovery_time_ms=1000,
    )
    return adapter


@pytest.fixture
def mock_session():
    """Create mock aiohttp session."""
    session = MagicMock()
    session.closed = False
    return session


def create_mock_response(data: Dict[str, Any], status: int = 200):
    """Create a mock aiohttp response."""
    mock = AsyncMock()
    mock.status = status
    mock.json = AsyncMock(return_value=data)
    mock.text = AsyncMock(return_value=str(data))
    mock.__aenter__ = AsyncMock(return_value=mock)
    mock.__aexit__ = AsyncMock(return_value=None)
    return mock


# =============================================================================
# Model Tests
# =============================================================================


class TestTrafficMetrics:
    """Test TrafficMetrics model."""

    def test_traffic_metrics_defaults(self):
        """TrafficMetrics has sensible defaults."""
        metrics = TrafficMetrics()
        assert metrics.total_visits == 0
        assert metrics.unique_visitors == 0
        assert metrics.visits_mom_change is None

    def test_traffic_metrics_with_data(self):
        """TrafficMetrics accepts valid data."""
        metrics = TrafficMetrics(
            total_visits=15000000,
            unique_visitors=8000000,
            visits_mom_change=0.03,
            mobile_share=0.68,
        )
        assert metrics.total_visits == 15000000
        assert metrics.mobile_share == 0.68


class TestEngagementMetrics:
    """Test EngagementMetrics model."""

    def test_engagement_metrics_defaults(self):
        """EngagementMetrics has sensible defaults."""
        metrics = EngagementMetrics()
        assert metrics.bounce_rate == 0.0
        assert metrics.pages_per_visit == 0.0

    def test_engagement_metrics_validation(self):
        """EngagementMetrics validates bounds."""
        metrics = EngagementMetrics(
            bounce_rate=0.42,
            pages_per_visit=5.2,
            average_visit_duration=245.5,
        )
        assert 0 <= metrics.bounce_rate <= 1
        assert metrics.pages_per_visit >= 0


class TestTrafficSourceBreakdown:
    """Test TrafficSourceBreakdown model."""

    def test_source_breakdown_defaults(self):
        """TrafficSourceBreakdown has sensible defaults."""
        sources = TrafficSourceBreakdown()
        assert sources.direct == 0.0
        assert sources.organic_search == 0.0

    def test_source_breakdown_with_data(self):
        """TrafficSourceBreakdown accepts valid data."""
        sources = TrafficSourceBreakdown(
            direct=0.38,
            organic_search=0.32,
            paid_search=0.12,
            social=0.08,
            referral=0.06,
            email=0.04,
        )
        # Total should approximately sum to 1
        total = (
            sources.direct + sources.organic_search + sources.paid_search +
            sources.social + sources.referral + sources.email
        )
        assert 0.99 <= total <= 1.01


class TestGeographyData:
    """Test GeographyData model."""

    def test_geography_with_countries(self):
        """GeographyData contains country list."""
        geo = GeographyData(
            top_countries=[
                CountryTraffic(country_code="US", share=0.85),
                CountryTraffic(country_code="CA", share=0.08),
            ],
            primary_country="US",
        )
        assert len(geo.top_countries) == 2
        assert geo.primary_country == "US"


class TestDemographicsData:
    """Test DemographicsData model."""

    def test_demographics_with_age(self):
        """DemographicsData contains age distribution."""
        demo = DemographicsData(
            age_distribution=AgeDistribution(
                age_18_24=0.18,
                age_25_34=0.28,
            ),
        )
        assert demo.age_distribution.age_18_24 == 0.18

    def test_demographics_with_gender(self):
        """DemographicsData contains gender distribution."""
        demo = DemographicsData(
            gender_distribution=GenderDistribution(
                male=0.45,
                female=0.55,
            ),
        )
        assert demo.gender_distribution.male + demo.gender_distribution.female == 1.0


class TestKeywordsData:
    """Test KeywordsData model."""

    def test_keywords_with_organic(self):
        """KeywordsData contains organic keywords."""
        keywords = KeywordsData(
            organic_keywords=[
                Keyword(keyword="costco", share=0.15),
                Keyword(keyword="costco membership", share=0.08),
            ],
            total_organic_keywords=15000,
        )
        assert len(keywords.organic_keywords) == 2
        assert keywords.total_organic_keywords == 15000


class TestSimilarSitesData:
    """Test SimilarSitesData model."""

    def test_similar_sites_list(self):
        """SimilarSitesData contains competitor list."""
        data = SimilarSitesData(
            similar_sites=[
                SimilarSite(domain="samsclub.com", similarity_score=0.78),
                SimilarSite(domain="bjs.com", similarity_score=0.65),
            ]
        )
        assert len(data.similar_sites) == 2
        assert data.similar_sites[0].domain == "samsclub.com"


class TestWebsiteRank:
    """Test WebsiteRank model."""

    def test_website_rank_data(self):
        """WebsiteRank contains ranking data."""
        rank = WebsiteRank(
            global_rank=125,
            country_rank=45,
            category_rank=3,
            category="Shopping > Retail",
        )
        assert rank.global_rank == 125
        assert rank.category_rank == 3


# =============================================================================
# Adapter Initialization Tests
# =============================================================================


class TestSimilarWebAdapterInit:
    """Test SimilarWebAdapter initialization."""

    def test_adapter_with_api_key(self, mock_api_key):
        """Adapter initializes with provided API key."""
        adapter = SimilarWebAdapter(api_key=mock_api_key)
        assert adapter._api_key == mock_api_key
        assert adapter.name == "similarweb"
        assert adapter.source_type == SourceType.SIMILARWEB

    def test_adapter_from_env_var(self, monkeypatch):
        """Adapter reads API key from environment variable."""
        monkeypatch.setenv("SIMILARWEB_API_KEY", "env-api-key")
        adapter = SimilarWebAdapter()
        assert adapter._api_key == "env-api-key"

    def test_adapter_default_settings(self, mock_api_key):
        """Adapter has correct default settings."""
        adapter = SimilarWebAdapter(api_key=mock_api_key)
        assert adapter.BASE_URL == "https://api.similarweb.com/v1"
        assert adapter.API_VERSION == "v1"
        assert adapter.default_country == "ww"
        assert adapter.COST_PER_CALL == 0.08
        assert adapter.CACHE_TTL_SECONDS == 30 * 24 * 60 * 60

    def test_adapter_custom_country(self, mock_api_key):
        """Adapter accepts custom default country."""
        adapter = SimilarWebAdapter(api_key=mock_api_key, default_country="us")
        assert adapter.default_country == "us"

    def test_adapter_cache_disabled(self, mock_api_key):
        """Adapter can be initialized with cache disabled."""
        adapter = SimilarWebAdapter(api_key=mock_api_key, enable_cache=False)
        assert adapter.enable_cache is False


# =============================================================================
# Endpoint Configuration Tests
# =============================================================================


class TestEndpointConfiguration:
    """Test endpoint configuration."""

    def test_all_endpoints_registered(self, adapter):
        """All 14 endpoints are registered."""
        expected_endpoints = [
            "traffic", "engagement", "sources", "geography", "demographics",
            "keywords", "audience-interests", "similar-sites", "keywords-competitors",
            "website-rank", "referrals", "popular-pages", "leading-folders", "landing-pages",
        ]
        for endpoint in expected_endpoints:
            config = adapter.get_endpoint_config(endpoint)
            assert config.name == endpoint
            assert config.cost_per_call == 0.08
            assert config.cache_ttl_seconds == 30 * 24 * 60 * 60

    def test_endpoint_paths_contain_domain_placeholder(self, adapter):
        """Endpoint paths have domain placeholder."""
        for endpoint in SimilarWebEndpoint:
            path = adapter.ENDPOINT_PATHS[endpoint]
            assert "{domain}" in path


# =============================================================================
# Response Parsing Tests
# =============================================================================


class TestTrafficParsing:
    """Test traffic endpoint parsing."""

    def test_parse_traffic_response(self, adapter):
        """Traffic response is parsed correctly."""
        result = adapter._parse_traffic(MOCK_TRAFFIC_RESPONSE)

        assert isinstance(result, TrafficMetrics)
        assert result.total_visits == 15500000  # Latest month
        assert result.unique_visitors == 8200000
        assert result.mobile_share == 0.68
        assert result.desktop_share == 0.32
        # MoM change: (15500000 - 15000000) / 15000000 = 0.0333
        assert abs(result.visits_mom_change - 0.0333) < 0.01

    def test_parse_traffic_empty_visits(self, adapter):
        """Traffic parsing handles empty visits list."""
        result = adapter._parse_traffic({"visits": []})
        assert result.total_visits == 0


class TestEngagementParsing:
    """Test engagement endpoint parsing."""

    def test_parse_engagement_response(self, adapter):
        """Engagement response is parsed correctly."""
        result = adapter._parse_engagement(MOCK_ENGAGEMENT_RESPONSE)

        assert isinstance(result, EngagementMetrics)
        assert result.bounce_rate == 0.42
        assert result.pages_per_visit == 5.2
        assert result.average_visit_duration == 245.5
        assert result.page_views == 75000000

    def test_parse_engagement_list_response(self, adapter):
        """Engagement parsing handles list (time series) response."""
        time_series = [
            {"bounce_rate": 0.45, "pages_per_visit": 5.0, "average_visit_duration": 240},
            {"bounce_rate": 0.42, "pages_per_visit": 5.2, "average_visit_duration": 245.5},
        ]
        result = adapter._parse_engagement(time_series)
        # Should use latest entry
        assert result.bounce_rate == 0.42


class TestSourcesParsing:
    """Test traffic sources endpoint parsing."""

    def test_parse_sources_response(self, adapter):
        """Traffic sources response is parsed correctly."""
        result = adapter._parse_sources(MOCK_SOURCES_RESPONSE)

        assert isinstance(result, TrafficSourceBreakdown)
        assert result.direct == 0.38
        assert result.organic_search == 0.32
        assert result.paid_search == 0.12
        assert result.social == 0.08
        assert result.referral == 0.06
        assert result.email == 0.04


class TestGeographyParsing:
    """Test geography endpoint parsing."""

    def test_parse_geography_response(self, adapter):
        """Geography response is parsed correctly."""
        result = adapter._parse_geography(MOCK_GEOGRAPHY_RESPONSE)

        assert isinstance(result, GeographyData)
        assert len(result.top_countries) == 3
        assert result.primary_country == "US"
        assert result.top_countries[0].country_code == "US"
        assert result.top_countries[0].share == 0.85


class TestDemographicsParsing:
    """Test demographics endpoint parsing."""

    def test_parse_demographics_response(self, adapter):
        """Demographics response is parsed correctly."""
        result = adapter._parse_demographics(MOCK_DEMOGRAPHICS_RESPONSE)

        assert isinstance(result, DemographicsData)
        assert result.age_distribution is not None
        assert result.age_distribution.age_18_24 == 0.18
        assert result.gender_distribution is not None
        assert result.gender_distribution.female == 0.55


class TestKeywordsParsing:
    """Test keywords endpoint parsing."""

    def test_parse_keywords_response(self, adapter):
        """Keywords response is parsed correctly."""
        result = adapter._parse_keywords(MOCK_KEYWORDS_RESPONSE)

        assert isinstance(result, KeywordsData)
        assert len(result.organic_keywords) == 2
        assert len(result.paid_keywords) == 1
        assert result.organic_keywords[0].keyword == "costco"
        assert result.total_organic_keywords == 15000


class TestAudienceInterestsParsing:
    """Test audience interests endpoint parsing."""

    def test_parse_audience_interests_response(self, adapter):
        """Audience interests response is parsed correctly."""
        result = adapter._parse_audience_interests(MOCK_AUDIENCE_INTERESTS_RESPONSE)

        assert isinstance(result, AudienceInterests)
        assert len(result.categories) == 3
        assert result.categories[0].category == "Shopping"
        assert result.categories[0].affinity == 0.85


class TestSimilarSitesParsing:
    """Test similar sites endpoint parsing."""

    def test_parse_similar_sites_response(self, adapter):
        """Similar sites response is parsed correctly."""
        result = adapter._parse_similar_sites(MOCK_SIMILAR_SITES_RESPONSE)

        assert isinstance(result, SimilarSitesData)
        assert len(result.similar_sites) == 2
        assert result.similar_sites[0].domain == "samsclub.com"
        assert result.similar_sites[0].similarity_score == 0.78


class TestKeywordsCompetitorsParsing:
    """Test keyword competitors endpoint parsing."""

    def test_parse_keywords_competitors_response(self, adapter):
        """Keyword competitors response is parsed correctly."""
        result = adapter._parse_keywords_competitors(MOCK_KEYWORDS_COMPETITORS_RESPONSE)

        assert isinstance(result, KeywordCompetitorsData)
        assert len(result.competitors) == 2
        assert result.competitors[0].domain == "walmart.com"
        assert result.competitors[0].overlap_score == 0.72


class TestWebsiteRankParsing:
    """Test website rank endpoint parsing."""

    def test_parse_website_rank_response(self, adapter):
        """Website rank response is parsed correctly."""
        result = adapter._parse_website_rank(MOCK_WEBSITE_RANK_RESPONSE)

        assert isinstance(result, WebsiteRank)
        assert result.global_rank == 125
        assert result.country_rank == 45
        assert result.category_rank == 3


class TestReferralsParsing:
    """Test referrals endpoint parsing."""

    def test_parse_referrals_response(self, adapter):
        """Referrals response is parsed correctly."""
        result = adapter._parse_referrals(MOCK_REFERRALS_RESPONSE)

        assert isinstance(result, ReferralsData)
        assert len(result.referrers) == 2
        assert result.referrers[0].domain == "google.com"
        assert result.total_referral_share == 0.06


class TestPopularPagesParsing:
    """Test popular pages endpoint parsing."""

    def test_parse_popular_pages_response(self, adapter):
        """Popular pages response is parsed correctly."""
        result = adapter._parse_popular_pages(MOCK_POPULAR_PAGES_RESPONSE)

        assert isinstance(result, PopularPagesData)
        assert len(result.pages) == 2
        assert result.pages[0].url == "/"
        assert result.pages[0].share == 0.35


class TestLeadingFoldersParsing:
    """Test leading folders endpoint parsing."""

    def test_parse_leading_folders_response(self, adapter):
        """Leading folders response is parsed correctly."""
        result = adapter._parse_leading_folders(MOCK_LEADING_FOLDERS_RESPONSE)

        assert isinstance(result, LeadingFoldersData)
        assert len(result.folders) == 2
        assert result.folders[0].folder == "/product"


class TestLandingPagesParsing:
    """Test landing pages endpoint parsing."""

    def test_parse_landing_pages_response(self, adapter):
        """Landing pages response is parsed correctly."""
        result = adapter._parse_landing_pages(MOCK_LANDING_PAGES_RESPONSE)

        assert isinstance(result, LandingPagesData)
        assert len(result.landing_pages) == 2
        assert result.landing_pages[0].page == "/"


# =============================================================================
# Source URL Building Tests
# =============================================================================


class TestSourceUrlBuilding:
    """Test source URL building for citations."""

    def test_build_source_url_traffic(self, adapter):
        """Traffic endpoint URL is built correctly."""
        url = adapter._build_source_url(
            SimilarWebEndpoint.TRAFFIC.value,
            {"domain": "costco.com", "country": "us"},
        )
        assert "costco.com" in url
        assert "country=us" in url
        assert "api_key" not in url.lower()  # API key should not be in citation

    def test_build_source_url_keywords(self, adapter):
        """Keywords endpoint URL is built correctly."""
        url = adapter._build_source_url(
            SimilarWebEndpoint.KEYWORDS.value,
            {"domain": "costco.com"},
        )
        assert "keywords" in url.lower()
        assert "costco.com" in url


# =============================================================================
# P0 Source Citation Tests
# =============================================================================


class TestSourceCitationEnforcement:
    """Test P0 source citation enforcement."""

    @pytest.mark.asyncio
    async def test_response_has_citation(self, adapter):
        """P0: Every response MUST have a citation."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            response = await adapter.get_traffic("costco.com")

            assert response.citation is not None
            assert isinstance(response.citation, SourceCitation)

    @pytest.mark.asyncio
    async def test_citation_has_source_type(self, adapter):
        """P0: Citation has correct source type."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            response = await adapter.get_traffic("costco.com")

            assert response.citation.source_type == SourceType.SIMILARWEB

    @pytest.mark.asyncio
    async def test_citation_has_source_url(self, adapter):
        """P0: Citation has source URL."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            response = await adapter.get_traffic("costco.com")

            assert response.citation.source_url is not None
            assert "costco.com" in str(response.citation.source_url)

    @pytest.mark.asyncio
    async def test_citation_has_retrieved_at(self, adapter):
        """Citation has retrieval timestamp."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            response = await adapter.get_traffic("costco.com")

            assert response.citation.retrieved_at is not None
            # Should be very recent
            age_seconds = (datetime.utcnow() - response.citation.retrieved_at).total_seconds()
            assert age_seconds < 5

    @pytest.mark.asyncio
    async def test_cached_response_has_citation(self, adapter):
        """P0: Cached responses also have citations."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            # First call
            await adapter.get_traffic("costco.com")
            # Second call (cached)
            response = await adapter.get_traffic("costco.com")

            assert response.cached is True
            assert response.citation is not None
            assert response.citation.source_type == SourceType.CACHE


# =============================================================================
# API Method Tests
# =============================================================================


class TestApiMethods:
    """Test public API methods."""

    @pytest.mark.asyncio
    async def test_get_traffic(self, adapter):
        """get_traffic returns TrafficMetrics."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            response = await adapter.get_traffic("costco.com")

            assert isinstance(response.data, TrafficMetrics)
            assert response.data.total_visits == 15500000

    @pytest.mark.asyncio
    async def test_get_engagement(self, adapter):
        """get_engagement returns EngagementMetrics."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_ENGAGEMENT_RESPONSE

            response = await adapter.get_engagement("costco.com")

            assert isinstance(response.data, EngagementMetrics)
            assert response.data.bounce_rate == 0.42

    @pytest.mark.asyncio
    async def test_get_sources(self, adapter):
        """get_sources returns TrafficSourceBreakdown."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_SOURCES_RESPONSE

            response = await adapter.get_sources("costco.com")

            assert isinstance(response.data, TrafficSourceBreakdown)
            assert response.data.direct == 0.38

    @pytest.mark.asyncio
    async def test_get_geography(self, adapter):
        """get_geography returns GeographyData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_GEOGRAPHY_RESPONSE

            response = await adapter.get_geography("costco.com")

            assert isinstance(response.data, GeographyData)
            assert response.data.primary_country == "US"

    @pytest.mark.asyncio
    async def test_get_demographics(self, adapter):
        """get_demographics returns DemographicsData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_DEMOGRAPHICS_RESPONSE

            response = await adapter.get_demographics("costco.com")

            assert isinstance(response.data, DemographicsData)

    @pytest.mark.asyncio
    async def test_get_keywords(self, adapter):
        """get_keywords returns KeywordsData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_KEYWORDS_RESPONSE

            response = await adapter.get_keywords("costco.com")

            assert isinstance(response.data, KeywordsData)
            assert len(response.data.organic_keywords) > 0

    @pytest.mark.asyncio
    async def test_get_audience_interests(self, adapter):
        """get_audience_interests returns AudienceInterests."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_AUDIENCE_INTERESTS_RESPONSE

            response = await adapter.get_audience_interests("costco.com")

            assert isinstance(response.data, AudienceInterests)

    @pytest.mark.asyncio
    async def test_get_similar_sites(self, adapter):
        """get_similar_sites returns SimilarSitesData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_SIMILAR_SITES_RESPONSE

            response = await adapter.get_similar_sites("costco.com")

            assert isinstance(response.data, SimilarSitesData)

    @pytest.mark.asyncio
    async def test_get_keywords_competitors(self, adapter):
        """get_keywords_competitors returns KeywordCompetitorsData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_KEYWORDS_COMPETITORS_RESPONSE

            response = await adapter.get_keywords_competitors("costco.com")

            assert isinstance(response.data, KeywordCompetitorsData)

    @pytest.mark.asyncio
    async def test_get_website_rank(self, adapter):
        """get_website_rank returns WebsiteRank."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_WEBSITE_RANK_RESPONSE

            response = await adapter.get_website_rank("costco.com")

            assert isinstance(response.data, WebsiteRank)
            assert response.data.global_rank == 125

    @pytest.mark.asyncio
    async def test_get_referrals(self, adapter):
        """get_referrals returns ReferralsData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_REFERRALS_RESPONSE

            response = await adapter.get_referrals("costco.com")

            assert isinstance(response.data, ReferralsData)

    @pytest.mark.asyncio
    async def test_get_popular_pages(self, adapter):
        """get_popular_pages returns PopularPagesData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_POPULAR_PAGES_RESPONSE

            response = await adapter.get_popular_pages("costco.com")

            assert isinstance(response.data, PopularPagesData)

    @pytest.mark.asyncio
    async def test_get_leading_folders(self, adapter):
        """get_leading_folders returns LeadingFoldersData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_LEADING_FOLDERS_RESPONSE

            response = await adapter.get_leading_folders("costco.com")

            assert isinstance(response.data, LeadingFoldersData)

    @pytest.mark.asyncio
    async def test_get_landing_pages(self, adapter):
        """get_landing_pages returns LandingPagesData."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_LANDING_PAGES_RESPONSE

            response = await adapter.get_landing_pages("costco.com")

            assert isinstance(response.data, LandingPagesData)

    @pytest.mark.asyncio
    async def test_country_parameter_passed(self, adapter):
        """Country parameter is passed to request."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            await adapter.get_traffic("costco.com", country="us")

            # The call is made with (endpoint, params, timeout)
            call_args = mock_request.call_args
            params = call_args[0][1]  # Second positional argument
            assert params["country"] == "us"


# =============================================================================
# Caching Tests
# =============================================================================


class TestCaching:
    """Test caching behavior."""

    @pytest.mark.asyncio
    async def test_cache_hit(self, adapter):
        """Second call returns cached data."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            # First call - cache miss
            response1 = await adapter.get_traffic("costco.com")
            assert response1.cached is False

            # Second call - cache hit
            response2 = await adapter.get_traffic("costco.com")
            assert response2.cached is True

            # _make_request should only be called once
            assert mock_request.call_count == 1

    @pytest.mark.asyncio
    async def test_cache_bypass(self, adapter):
        """bypass_cache forces fresh call."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            await adapter.get_traffic("costco.com")
            await adapter.call(
                SimilarWebEndpoint.TRAFFIC.value,
                {"domain": "costco.com"},
                bypass_cache=True,
            )

            # Both calls should hit the API
            assert mock_request.call_count == 2

    @pytest.mark.asyncio
    async def test_different_domains_not_cached(self, adapter):
        """Different domains create separate cache entries."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            await adapter.get_traffic("costco.com")
            await adapter.get_traffic("walmart.com")

            assert mock_request.call_count == 2

    @pytest.mark.asyncio
    async def test_cache_disabled(self, mock_api_key):
        """Cache can be disabled."""
        adapter = SimilarWebAdapter(api_key=mock_api_key, enable_cache=False)

        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            await adapter.get_traffic("costco.com")
            await adapter.get_traffic("costco.com")

            # Both calls should hit the API
            assert mock_request.call_count == 2


# =============================================================================
# Cost Tracking Tests
# =============================================================================


class TestCostTracking:
    """Test cost tracking."""

    @pytest.mark.asyncio
    async def test_cost_per_call_tracked(self, adapter):
        """Cost is tracked per API call."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            response = await adapter.get_traffic("costco.com")

            assert response.cost_usd == 0.08

    @pytest.mark.asyncio
    async def test_cached_calls_are_free(self, adapter):
        """Cached responses have zero cost."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            await adapter.get_traffic("costco.com")
            response = await adapter.get_traffic("costco.com")

            assert response.cached is True
            assert response.cost_usd == 0.0

    @pytest.mark.asyncio
    async def test_total_cost_accumulated(self, adapter):
        """Total cost is accumulated in metrics."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            await adapter.get_traffic("costco.com")
            await adapter.get_engagement("costco.com")

            assert adapter.metrics.total_cost_usd == 0.16  # 2 x $0.08


# =============================================================================
# Error Handling Tests
# =============================================================================


class TestErrorHandling:
    """Test error handling."""

    @pytest.mark.asyncio
    async def test_missing_api_key_raises(self):
        """Missing API key raises ValueError."""
        adapter = SimilarWebAdapter(api_key=None)
        adapter._api_key = None  # Ensure it's None

        with pytest.raises(ValueError) as exc_info:
            await adapter._make_request(
                SimilarWebEndpoint.TRAFFIC.value,
                {"domain": "costco.com"},
                timeout_seconds=30,
            )
        assert "API key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_domain_raises(self, adapter):
        """Missing domain parameter raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            await adapter._make_request(
                SimilarWebEndpoint.TRAFFIC.value,
                {},  # No domain
                timeout_seconds=30,
            )
        assert "domain" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_api_error_raised(self, adapter):
        """API errors are raised as APIError."""
        # Create a properly mocked session with async context manager support
        mock_response = MagicMock()
        mock_response.status = 500
        mock_response.json = AsyncMock(return_value={})
        mock_response.text = AsyncMock(return_value="Internal Server Error")

        # Use async context manager properly
        mock_get_context = AsyncMock()
        mock_get_context.__aenter__ = AsyncMock(return_value=mock_response)
        mock_get_context.__aexit__ = AsyncMock(return_value=None)

        mock_session = MagicMock()
        mock_session.closed = False
        mock_session.get = MagicMock(return_value=mock_get_context)

        adapter._session = mock_session

        with pytest.raises(APIError) as exc_info:
            await adapter._make_request(
                SimilarWebEndpoint.TRAFFIC.value,
                {"domain": "costco.com"},
                timeout_seconds=30,
            )
        assert exc_info.value.status_code == 500


# =============================================================================
# Circuit Breaker Tests
# =============================================================================


class TestCircuitBreaker:
    """Test circuit breaker integration."""

    @pytest.mark.asyncio
    async def test_circuit_opens_after_failures(self, adapter_with_circuit_breaker):
        """Circuit opens after threshold failures."""
        adapter = adapter_with_circuit_breaker
        # Use permissive rate limiter for this test
        adapter.rate_limiter = TokenBucketRateLimiter(
            name="test_cb_rl",
            tokens_per_second=1000.0,
            bucket_size=1000,
        )
        # Disable retries for this test to hit circuit breaker faster
        adapter.retry_config.max_retries = 0

        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.side_effect = ConnectionError("Network error")

            # Make calls until circuit opens (threshold=3)
            for i in range(3):
                try:
                    await adapter.get_traffic("costco.com")
                except (ConnectionError, Exception):
                    pass

            # Circuit should now be open
            assert adapter.circuit_breaker.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_circuit_open_rejects_calls(self, adapter_with_circuit_breaker):
        """Open circuit rejects calls immediately."""
        adapter = adapter_with_circuit_breaker
        # Use permissive rate limiter for this test
        adapter.rate_limiter = TokenBucketRateLimiter(
            name="test_cb_rl2",
            tokens_per_second=1000.0,
            bucket_size=1000,
        )

        # Force circuit open
        adapter.circuit_breaker._state = CircuitState.OPEN
        adapter.circuit_breaker._last_failure_time = datetime.utcnow()

        with pytest.raises(CircuitOpenError):
            await adapter.get_traffic("costco.com")


# =============================================================================
# Rate Limiter Tests
# =============================================================================


class TestRateLimiter:
    """Test rate limiter integration."""

    @pytest.mark.asyncio
    async def test_rate_limit_reached(self, adapter_with_rate_limiter):
        """RateLimitError raised when limit exceeded."""
        adapter = adapter_with_rate_limiter

        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            # Exhaust tokens (bucket_size=2)
            await adapter.get_traffic("costco.com")
            await adapter.get_engagement("costco.com")

            # Third call should hit rate limit
            with pytest.raises(RateLimitError):
                await adapter.get_keywords("costco.com")


# =============================================================================
# Metrics Tests
# =============================================================================


class TestMetrics:
    """Test metrics tracking."""

    @pytest.mark.asyncio
    async def test_successful_call_updates_metrics(self, adapter):
        """Successful calls update metrics."""
        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.return_value = MOCK_TRAFFIC_RESPONSE

            await adapter.get_traffic("costco.com")

            assert adapter.metrics.total_calls == 1
            assert adapter.metrics.successful_calls == 1
            assert adapter.metrics.failed_calls == 0

    @pytest.mark.asyncio
    async def test_failed_call_updates_metrics(self, adapter):
        """Failed calls update metrics."""
        # Disable retries for this test
        adapter.retry_config.max_retries = 0

        with patch.object(adapter, "_make_request") as mock_request:
            mock_request.side_effect = ValueError("Non-retryable error")

            try:
                await adapter.get_traffic("costco.com")
            except ValueError:
                pass

            assert adapter.metrics.total_calls == 1
            assert adapter.metrics.failed_calls == 1

    def test_health_check(self, adapter):
        """Health check returns correct status."""
        health = adapter.health_check()

        assert health["name"] == "similarweb"
        assert health["healthy"] is True
        assert health["circuit_breaker_state"] == "closed"


# =============================================================================
# Full Analysis Tests
# =============================================================================


class TestFullTrafficAnalysis:
    """Test full traffic analysis method."""

    @pytest.mark.asyncio
    async def test_get_full_traffic_analysis(self, adapter):
        """get_full_traffic_analysis calls all endpoints."""
        responses = {
            "traffic": MOCK_TRAFFIC_RESPONSE,
            "engagement": MOCK_ENGAGEMENT_RESPONSE,
            "sources": MOCK_SOURCES_RESPONSE,
            "geography": MOCK_GEOGRAPHY_RESPONSE,
            "demographics": MOCK_DEMOGRAPHICS_RESPONSE,
            "keywords": MOCK_KEYWORDS_RESPONSE,
            "audience-interests": MOCK_AUDIENCE_INTERESTS_RESPONSE,
            "similar-sites": MOCK_SIMILAR_SITES_RESPONSE,
            "keywords-competitors": MOCK_KEYWORDS_COMPETITORS_RESPONSE,
            "website-rank": MOCK_WEBSITE_RANK_RESPONSE,
            "referrals": MOCK_REFERRALS_RESPONSE,
            "popular-pages": MOCK_POPULAR_PAGES_RESPONSE,
            "leading-folders": MOCK_LEADING_FOLDERS_RESPONSE,
            "landing-pages": MOCK_LANDING_PAGES_RESPONSE,
        }

        def mock_make_request(endpoint, params, timeout):
            return responses.get(endpoint, {})

        with patch.object(adapter, "_make_request", side_effect=mock_make_request):
            results = await adapter.get_full_traffic_analysis("costco.com")

            assert "traffic" in results
            assert "engagement" in results
            assert "sources" in results
            assert "geography" in results
            assert "demographics" in results
            assert "keywords" in results
            assert "audience_interests" in results
            assert "similar_sites" in results
            assert "keywords_competitors" in results
            assert "website_rank" in results
            assert "referrals" in results
            assert "popular_pages" in results
            assert "leading_folders" in results
            assert "landing_pages" in results


# =============================================================================
# Context Manager Tests
# =============================================================================


class TestContextManager:
    """Test async context manager."""

    @pytest.mark.asyncio
    async def test_context_manager_closes_session(self, mock_api_key):
        """Context manager closes session on exit."""
        async with SimilarWebAdapter(api_key=mock_api_key) as adapter:
            assert adapter._session is None or adapter._session.closed is False

        # After exit, any session should be closed
        assert adapter._session is None or adapter._session.closed


# =============================================================================
# Integration-Style Tests (Still Mocked)
# =============================================================================


class TestIntegrationScenarios:
    """Integration-style tests for common use cases."""

    @pytest.mark.asyncio
    async def test_traffic_analysis_workflow(self, adapter):
        """Simulate a typical traffic analysis workflow."""
        with patch.object(adapter, "_make_request") as mock_request:
            # Setup responses for different endpoints
            responses = {
                "traffic": MOCK_TRAFFIC_RESPONSE,
                "engagement": MOCK_ENGAGEMENT_RESPONSE,
                "sources": MOCK_SOURCES_RESPONSE,
            }
            mock_request.side_effect = lambda e, p, t: responses.get(e, {})

            # Get traffic data
            traffic = await adapter.get_traffic("costco.com")
            assert traffic.data.total_visits > 0
            assert traffic.citation.source_type == SourceType.SIMILARWEB

            # Get engagement data
            engagement = await adapter.get_engagement("costco.com")
            assert 0 <= engagement.data.bounce_rate <= 1
            assert engagement.citation is not None

            # Get traffic sources
            sources = await adapter.get_sources("costco.com")
            assert sources.data.direct > 0
            assert sources.citation is not None

    @pytest.mark.asyncio
    async def test_competitor_analysis_workflow(self, adapter):
        """Simulate a competitor analysis workflow."""
        with patch.object(adapter, "_make_request") as mock_request:
            responses = {
                "similar-sites": MOCK_SIMILAR_SITES_RESPONSE,
                "keywords-competitors": MOCK_KEYWORDS_COMPETITORS_RESPONSE,
            }
            mock_request.side_effect = lambda e, p, t: responses.get(e, {})

            # Get similar sites
            similar = await adapter.get_similar_sites("costco.com")
            assert len(similar.data.similar_sites) > 0
            assert similar.citation is not None

            # Get keyword competitors
            keyword_comp = await adapter.get_keywords_competitors("costco.com")
            assert len(keyword_comp.data.competitors) > 0
            assert keyword_comp.citation is not None
