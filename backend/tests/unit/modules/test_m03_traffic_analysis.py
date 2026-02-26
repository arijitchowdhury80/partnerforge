"""
Unit tests for M03_TrafficAnalysis Intelligence Module.

Tests the traffic analysis module which quantifies digital footprint
for ICP scoring. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m03_traffic_analysis import (
    M03TrafficAnalysisModule,
    TrafficAnalysisData,
    TrafficSourceBreakdown,
    CountryShare,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM03TrafficAnalysisModule:
    """Test suite for M03TrafficAnalysisModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M03TrafficAnalysisModule()

    @pytest.fixture
    def valid_similarweb_response(self):
        """Mock SimilarWeb API response."""
        return {
            "domain": "sallybeauty.com",
            "monthly_visits": 15200000,
            "unique_visitors": 10500000,
            "monthly_visits_trend": 0.03,
            "yoy_trend": 0.11,
            "global_rank": 12500,
            "country_rank": 4200,
            "category_rank": 45,
            "pages_per_visit": 4.2,
            "avg_visit_duration": 245,
            "bounce_rate": 0.42,
            "traffic_sources": {
                "direct": 0.38,
                "search": 0.44,
                "organic_search": 0.32,
                "paid_search": 0.12,
                "social": 0.08,
                "referral": 0.06,
                "email": 0.04,
            },
            "top_countries": [
                {"country": "United States", "country_code": "US", "share": 0.85},
                {"country": "Canada", "country_code": "CA", "share": 0.08},
            ],
            "desktop_pct": 0.32,
            "mobile_pct": 0.68,
            "top_organic_keywords": ["sally beauty", "hair color"],
            "top_paid_keywords": ["professional hair color"],
            "source_url": "https://www.similarweb.com/website/sallybeauty.com/",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m03_traffic_analysis"

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
            assert result["monthly_visits"] == 15200000
            assert "source_url" in result
            assert "source_date" in result

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
        assert result["monthly_visits"] == 15200000
        assert result["monthly_visits_formatted"] == "15.2M"
        assert result["bounce_rate"] == 0.42
        assert result["primary_country"] == "United States"
        assert result["primary_country_share"] == 0.85

    @pytest.mark.asyncio
    async def test_transform_data_calculates_traffic_score(self, module):
        """Test traffic score calculation for various traffic levels."""
        # 50M+ = very high (30 points)
        raw_data = {
            "domain": "example.com",
            "monthly_visits": 50000000,
            "traffic_sources": {},
            "top_countries": [],
            "source_url": "https://similarweb.com/example.com",
            "source_date": datetime.now().isoformat(),
        }
        result = await module.transform_data(raw_data)
        assert result["traffic_score"] == 30
        assert result["traffic_tier"] == "very_high"

        # 10M+ = high (25 points)
        raw_data["monthly_visits"] = 15000000
        result = await module.transform_data(raw_data)
        assert result["traffic_score"] == 25
        assert result["traffic_tier"] == "high"

        # 1M+ = medium (15 points)
        raw_data["monthly_visits"] = 5000000
        result = await module.transform_data(raw_data)
        assert result["traffic_score"] == 15
        assert result["traffic_tier"] == "medium"

    @pytest.mark.asyncio
    async def test_transform_data_handles_missing_fields(self, module):
        """Test transform_data handles missing optional fields gracefully."""
        raw_data = {
            "domain": "example.com",
            "traffic_sources": {},
            "top_countries": [],
            "source_url": "https://similarweb.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "example.com"
        assert result.get("monthly_visits") is None
        assert result.get("global_rank") is None
        assert result["top_organic_keywords"] == []

    # =========================================================================
    # Formatting Tests
    # =========================================================================

    def test_format_number_billions(self, module):
        """Test formatting billions."""
        assert module._format_number(1500000000) == "1.5B"

    def test_format_number_millions(self, module):
        """Test formatting millions."""
        assert module._format_number(15200000) == "15.2M"

    def test_format_number_thousands(self, module):
        """Test formatting thousands."""
        assert module._format_number(5000) == "5.0K"

    def test_format_number_none(self, module):
        """Test formatting None."""
        assert module._format_number(None) is None

    def test_format_duration(self, module):
        """Test duration formatting."""
        assert module._format_duration(245) == "4:05"
        assert module._format_duration(60) == "1:00"
        assert module._format_duration(None) is None

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "traffic_sources": {},
                "top_countries": [],
                "source_url": "https://similarweb.com/example.com",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "similarweb.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "traffic_sources": {},
                "top_countries": [],
                "source_date": datetime.now().isoformat(),
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "traffic_sources": {},
                "top_countries": [],
                "source_url": "https://similarweb.com/example.com",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

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
            assert result.module_id == "m03_traffic_analysis"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, TrafficAnalysisData)
            assert result.data.monthly_visits == 15200000
            assert result.data.bounce_rate == 0.42
            assert result.data.desktop_pct == 0.32
            assert result.data.mobile_pct == 0.68

            # Verify source citation
            assert result.source is not None
            assert "similarweb.com" in str(result.source.url)

    # =========================================================================
    # TrafficAnalysisData Model Tests
    # =========================================================================

    def test_traffic_analysis_data_model_creation(self):
        """Test TrafficAnalysisData pydantic model creation."""
        data = TrafficAnalysisData(
            domain="example.com",
            monthly_visits=15000000,
            monthly_visits_formatted="15M",
            bounce_rate=0.40,
            traffic_score=25,
            traffic_tier="high",
        )

        assert data.domain == "example.com"
        assert data.monthly_visits == 15000000
        assert data.traffic_score == 25

    def test_traffic_analysis_data_with_minimal_fields(self):
        """Test TrafficAnalysisData with only required fields."""
        data = TrafficAnalysisData(domain="example.com")

        assert data.domain == "example.com"
        assert data.monthly_visits is None
        assert data.top_countries == []
        assert data.traffic_score == 0


class TestM03ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M03 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m03_traffic_analysis")
        assert module_class is not None
        assert module_class.MODULE_ID == "m03_traffic_analysis"

    def test_module_in_wave_1(self):
        """Test M03 module appears in Wave 1 modules."""
        from app.modules.base import get_modules_by_wave

        wave_1_modules = get_modules_by_wave(1)
        module_ids = [cls.MODULE_ID for cls in wave_1_modules]

        assert "m03_traffic_analysis" in module_ids
