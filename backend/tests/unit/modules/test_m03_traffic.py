"""
Unit tests for M03_Traffic Intelligence Module.

Tests the traffic analysis module which provides website traffic metrics
for ICP scoring and opportunity sizing. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m03_traffic import (
    M03TrafficModule,
    TrafficAnalysisData,
    TrafficMetrics,
    TrafficTrend,
    TrafficSources,
    Geography,
    CountryShare,
    Demographics,
    Keywords,
    WebsiteRank,
    SearchRevenueEstimate,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM03TrafficModule:
    """Test suite for M03TrafficModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M03TrafficModule()

    @pytest.fixture
    def valid_similarweb_response(self):
        """Mock SimilarWeb API response."""
        return {
            "domain": "sallybeauty.com",
            "traffic_metrics": {
                "monthly_visits": 15200000,
                "unique_visitors": 8500000,
                "avg_visit_duration_seconds": 245,
                "pages_per_visit": 4.2,
                "bounce_rate": 0.42,
                "mobile_share": 0.68,
            },
            "traffic_trend": {
                "mom_change": 0.03,
                "yoy_change": 0.11,
                "trend_direction": "growing",
            },
            "traffic_sources": {
                "direct": 0.38,
                "organic_search": 0.32,
                "paid_search": 0.12,
                "social": 0.08,
                "referral": 0.06,
                "email": 0.04,
                "display": 0.00,
            },
            "geography": {
                "primary_country": "US",
                "primary_country_share": 0.85,
                "top_countries": [
                    {"country": "US", "share": 0.85},
                    {"country": "CA", "share": 0.08},
                    {"country": "UK", "share": 0.03},
                ],
            },
            "demographics": {
                "gender_split": {"female": 0.72, "male": 0.28},
                "age_distribution": {
                    "18-24": 0.18,
                    "25-34": 0.28,
                    "35-44": 0.24,
                    "45-54": 0.16,
                    "55+": 0.14,
                },
            },
            "keywords": {
                "top_organic": ["sally beauty", "hair color", "hair dye"],
                "top_paid": ["professional hair color", "beauty supply store"],
            },
            "website_rank": {
                "global_rank": 12500,
                "country_rank": 4200,
                "category_rank": 45,
                "category": "Beauty & Cosmetics",
            },
            "source_url": "https://www.similarweb.com/website/sallybeauty.com/",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m03_traffic"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Traffic Analysis"

    def test_module_wave(self, module):
        """Test module is in Wave 1 (Foundation)."""
        assert module.WAVE == 1

    def test_module_has_no_dependencies(self, module):
        """Test Wave 1 module has no dependencies."""
        assert module.DEPENDS_ON == []

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "api"

    def test_module_cache_ttl(self, module):
        """Test module has 1-day cache TTL for traffic data."""
        assert module.CACHE_TTL == 86400  # 1 day

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fetch_from_similarweb_returns_valid_data(
        self, module, valid_similarweb_response
    ):
        """Test SimilarWeb data fetching returns expected structure."""
        with patch.object(
            module, "_call_similarweb_api", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_similarweb_response

            result = await module._fetch_from_similarweb("sallybeauty.com")

            assert result["domain"] == "sallybeauty.com"
            assert "traffic_metrics" in result
            assert "traffic_sources" in result
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_fetch_data_returns_similarweb_data(
        self, module, valid_similarweb_response
    ):
        """Test fetch_data returns SimilarWeb data."""
        with patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_sw.return_value = valid_similarweb_response

            result = await module.fetch_data("sallybeauty.com")

            assert result["domain"] == "sallybeauty.com"
            assert result["traffic_metrics"]["monthly_visits"] == 15200000

    @pytest.mark.asyncio
    async def test_fetch_data_fails_when_similarweb_fails(self, module):
        """Test fetch_data raises error when SimilarWeb fails (no fallback)."""
        with patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_sw.side_effect = Exception("SimilarWeb API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.fetch_data("example.com")

            assert "SimilarWeb" in str(exc_info.value)

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(
        self, module, valid_similarweb_response
    ):
        """Test transform_data creates data matching TrafficAnalysisData schema."""
        result = await module.transform_data(valid_similarweb_response)

        assert result["domain"] == "sallybeauty.com"
        assert result["traffic_metrics"]["monthly_visits"] == 15200000
        assert result["traffic_metrics"]["bounce_rate"] == 0.42
        assert result["traffic_sources"]["organic_search"] == 0.32
        assert result["geography"]["primary_country"] == "US"
        assert len(result["geography"]["top_countries"]) == 3
        assert result["demographics"]["gender_split"]["female"] == 0.72
        assert "sally beauty" in result["keywords"]["top_organic"]
        assert result["website_rank"]["global_rank"] == 12500

    @pytest.mark.asyncio
    async def test_transform_data_calculates_search_revenue(
        self, module, valid_similarweb_response
    ):
        """Test transform_data calculates search revenue estimate."""
        result = await module.transform_data(valid_similarweb_response)

        assert result["search_revenue_estimate"] is not None
        estimate = result["search_revenue_estimate"]

        # Search traffic = organic (0.32) + paid (0.12) = 0.44
        assert estimate["search_traffic_share"] == 0.44
        # Monthly search visits = 15,200,000 * 0.44 = 6,688,000
        assert estimate["monthly_search_visits"] == 6688000
        # Revenue = 6,688,000 * 0.02 * 75 = 10,032,000
        assert estimate["estimated_search_revenue"] == 10032000.0

    @pytest.mark.asyncio
    async def test_transform_data_handles_missing_fields(self, module):
        """Test transform_data handles missing optional fields gracefully."""
        minimal_data = {
            "domain": "example.com",
            "traffic_metrics": {
                "monthly_visits": 100000,
            },
            "source_url": "https://www.similarweb.com/website/example.com/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(minimal_data)

        assert result["domain"] == "example.com"
        assert result["traffic_metrics"]["monthly_visits"] == 100000
        assert result.get("traffic_trend") is None
        assert result.get("traffic_sources") is None
        assert result.get("geography") is None
        assert result.get("demographics") is None
        assert result.get("keywords") is None
        assert result.get("website_rank") is None

    @pytest.mark.asyncio
    async def test_transform_data_no_search_revenue_without_sources(self, module):
        """Test transform_data returns None for search revenue without traffic sources."""
        data_without_sources = {
            "domain": "example.com",
            "traffic_metrics": {
                "monthly_visits": 100000,
            },
            "source_url": "https://www.similarweb.com/website/example.com/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(data_without_sources)

        assert result["search_revenue_estimate"] is None

    # =========================================================================
    # Search Revenue Calculation Tests
    # =========================================================================

    def test_calculate_search_revenue_basic(self, module):
        """Test basic search revenue calculation."""
        traffic_metrics = {"monthly_visits": 1000000}
        traffic_sources = {"organic_search": 0.30, "paid_search": 0.10}

        result = module._calculate_search_revenue(traffic_metrics, traffic_sources)

        assert result is not None
        assert result["search_traffic_share"] == 0.40
        assert result["monthly_search_visits"] == 400000
        # 400,000 * 0.02 * 75 = 600,000
        assert result["estimated_search_revenue"] == 600000.0

    def test_calculate_search_revenue_no_search_traffic(self, module):
        """Test search revenue returns None when no search traffic."""
        traffic_metrics = {"monthly_visits": 1000000}
        traffic_sources = {"organic_search": 0, "paid_search": 0}

        result = module._calculate_search_revenue(traffic_metrics, traffic_sources)

        assert result is None

    def test_calculate_search_revenue_no_visits(self, module):
        """Test search revenue returns None when no visits."""
        traffic_metrics = {"monthly_visits": 0}
        traffic_sources = {"organic_search": 0.30, "paid_search": 0.10}

        result = module._calculate_search_revenue(traffic_metrics, traffic_sources)

        assert result is None

    def test_calculate_search_revenue_none_sources(self, module):
        """Test search revenue returns None when traffic sources is None."""
        traffic_metrics = {"monthly_visits": 1000000}

        result = module._calculate_search_revenue(traffic_metrics, None)

        assert result is None

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module, valid_similarweb_response):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = valid_similarweb_response

            result = await module.enrich("sallybeauty.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "similarweb.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module, valid_similarweb_response):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = valid_similarweb_response

            result = await module.enrich("sallybeauty.com")

            assert result.source.date is not None
            # Date should be within last minute (accounting for test execution time)
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_uses_traffic_source_type(
        self, module, valid_similarweb_response
    ):
        """TEST SOURCE CITATION MANDATE: Traffic uses 'traffic' source type for 30-day freshness."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = valid_similarweb_response

            result = await module.enrich("sallybeauty.com")

            assert result.source.type == "traffic"

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            # Return data without source_url
            mock_fetch.return_value = {
                "domain": "example.com",
                "traffic_metrics": {"monthly_visits": 100000},
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_date MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "traffic_metrics": {"monthly_visits": 100000},
                "source_url": "https://www.similarweb.com/website/example.com/",
                # source_date is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_date" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_traffic_source(self, module):
        """TEST SOURCE CITATION MANDATE: Traffic source older than 12 months MUST be rejected."""
        # Source validation at SourceInfo creation uses 12-month default limit
        # The 30-day traffic-specific limit is enforced at to_dict() time
        stale_date = datetime.now() - timedelta(days=400)  # 13+ months old

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "traffic_metrics": {"monthly_visits": 100000},
                "source_url": "https://www.similarweb.com/website/example.com/",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Validation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_validate_and_store_creates_model(
        self, module, valid_similarweb_response
    ):
        """Test _validate_and_store creates a proper TrafficAnalysisData model."""
        transformed = await module.transform_data(valid_similarweb_response)

        result = await module._validate_and_store("sallybeauty.com", transformed)

        assert isinstance(result, TrafficAnalysisData)
        assert result.domain == "sallybeauty.com"
        assert result.traffic_metrics.monthly_visits == 15200000

    @pytest.mark.asyncio
    async def test_validate_and_store_validates_domain_match(self, module):
        """Test domain in data must match requested domain."""
        transformed_data = {
            "domain": "wrongdomain.com",  # Mismatch!
            "traffic_metrics": {"monthly_visits": 100000},
            "source_url": "https://www.similarweb.com/website/example.com/",
            "source_date": datetime.now().isoformat(),
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_store("example.com", transformed_data)

        assert "domain" in str(exc_info.value).lower()

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module, valid_similarweb_response):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_sw.return_value = valid_similarweb_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m03_traffic"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, TrafficAnalysisData)
            assert result.data.traffic_metrics.monthly_visits == 15200000
            assert result.data.traffic_metrics.bounce_rate == 0.42
            assert result.data.traffic_sources.organic_search == 0.32
            assert result.data.geography.primary_country == "US"
            assert len(result.data.geography.top_countries) == 3
            assert result.data.search_revenue_estimate is not None

            # Verify source citation
            assert result.source is not None
            assert "similarweb.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and fetches fresh data."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()  # Would return cached data

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = {
                    "domain": "example.com",
                    "traffic_metrics": {"monthly_visits": 100000},
                    "source_url": "https://www.similarweb.com/website/example.com/",
                    "source_date": datetime.now().isoformat(),
                }

                # With force=True, should NOT use cache
                await module.enrich("example.com", force=True)

                # Cache should not be checked
                mock_cache.assert_not_called()
                # Fresh fetch should be called
                mock_fetch.assert_called_once_with("example.com")

    # =========================================================================
    # Error Handling Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fails_when_similarweb_fails(self, module):
        """Test appropriate error when SimilarWeb API fails."""
        with patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_sw.side_effect = Exception("SimilarWeb API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("example.com")

            # Should indicate enrichment failure
            assert (
                "enrich" in str(exc_info.value).lower()
                or "fail" in str(exc_info.value).lower()
                or "similarweb" in str(exc_info.value).lower()
            )

    # =========================================================================
    # Data Model Tests
    # =========================================================================

    def test_traffic_metrics_model_creation(self):
        """Test TrafficMetrics pydantic model creation."""
        metrics = TrafficMetrics(
            monthly_visits=15200000,
            unique_visitors=8500000,
            avg_visit_duration_seconds=245,
            pages_per_visit=4.2,
            bounce_rate=0.42,
            mobile_share=0.68,
        )

        assert metrics.monthly_visits == 15200000
        assert metrics.bounce_rate == 0.42

    def test_traffic_metrics_with_minimal_fields(self):
        """Test TrafficMetrics with only required fields."""
        metrics = TrafficMetrics(monthly_visits=100000)

        assert metrics.monthly_visits == 100000
        assert metrics.unique_visitors is None
        assert metrics.bounce_rate is None

    def test_traffic_sources_model_creation(self):
        """Test TrafficSources pydantic model creation."""
        sources = TrafficSources(
            direct=0.38,
            organic_search=0.32,
            paid_search=0.12,
            social=0.08,
            referral=0.06,
            email=0.04,
        )

        assert sources.direct == 0.38
        assert sources.organic_search == 0.32

    def test_geography_model_with_countries(self):
        """Test Geography model with top countries."""
        geography = Geography(
            primary_country="US",
            primary_country_share=0.85,
            top_countries=[
                CountryShare(country="US", share=0.85),
                CountryShare(country="CA", share=0.08),
            ],
        )

        assert geography.primary_country == "US"
        assert len(geography.top_countries) == 2
        assert geography.top_countries[0].country == "US"

    def test_search_revenue_estimate_model(self):
        """Test SearchRevenueEstimate model creation."""
        estimate = SearchRevenueEstimate(
            monthly_search_visits=6688000,
            search_traffic_share=0.44,
            estimated_conversion_rate=0.02,
            assumed_aov=75.0,
            estimated_search_revenue=10032000.0,
        )

        assert estimate.monthly_search_visits == 6688000
        assert estimate.search_traffic_share == 0.44
        assert estimate.estimated_search_revenue == 10032000.0

    def test_traffic_analysis_data_full_model(self):
        """Test TrafficAnalysisData with all nested models."""
        data = TrafficAnalysisData(
            domain="sallybeauty.com",
            traffic_metrics=TrafficMetrics(monthly_visits=15200000, bounce_rate=0.42),
            traffic_trend=TrafficTrend(
                mom_change=0.03, yoy_change=0.11, trend_direction="growing"
            ),
            traffic_sources=TrafficSources(organic_search=0.32, paid_search=0.12),
            geography=Geography(
                primary_country="US",
                top_countries=[CountryShare(country="US", share=0.85)],
            ),
            demographics=Demographics(
                gender_split={"female": 0.72, "male": 0.28},
                age_distribution={"18-24": 0.18, "25-34": 0.28},
            ),
            keywords=Keywords(
                top_organic=["sally beauty", "hair color"],
                top_paid=["professional hair color"],
            ),
            website_rank=WebsiteRank(
                global_rank=12500, country_rank=4200, category="Beauty"
            ),
            search_revenue_estimate=SearchRevenueEstimate(
                monthly_search_visits=6688000,
                search_traffic_share=0.44,
                estimated_search_revenue=10032000.0,
            ),
        )

        assert data.domain == "sallybeauty.com"
        assert data.traffic_metrics.monthly_visits == 15200000
        assert data.traffic_trend.trend_direction == "growing"
        assert data.traffic_sources.organic_search == 0.32
        assert data.geography.primary_country == "US"
        assert data.search_revenue_estimate.estimated_search_revenue == 10032000.0

    def test_traffic_analysis_data_minimal(self):
        """Test TrafficAnalysisData with minimal required fields."""
        data = TrafficAnalysisData(
            domain="example.com",
            traffic_metrics=TrafficMetrics(monthly_visits=100000),
        )

        assert data.domain == "example.com"
        assert data.traffic_metrics.monthly_visits == 100000
        assert data.traffic_trend is None
        assert data.traffic_sources is None
        assert data.geography is None
        assert data.search_revenue_estimate is None

    def test_traffic_analysis_data_model_dump(self):
        """Test TrafficAnalysisData can be serialized."""
        data = TrafficAnalysisData(
            domain="example.com",
            traffic_metrics=TrafficMetrics(
                monthly_visits=100000, bounce_rate=0.45
            ),
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["traffic_metrics"]["monthly_visits"] == 100000


class TestM03ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M03 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m03_traffic")
        assert module_class is not None
        assert module_class.MODULE_ID == "m03_traffic"

    def test_module_in_wave_1(self):
        """Test M03 module appears in Wave 1 modules."""
        from app.modules.base import get_modules_by_wave

        wave_1_modules = get_modules_by_wave(1)
        module_ids = [cls.MODULE_ID for cls in wave_1_modules]

        assert "m03_traffic" in module_ids
