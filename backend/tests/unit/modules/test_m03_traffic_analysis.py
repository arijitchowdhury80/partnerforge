"""
Unit tests for M03_Traffic Intelligence Module.

Tests the traffic analysis module which quantifies digital footprint
for ICP scoring. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m03_traffic import (
    M03TrafficModule,
    TrafficAnalysisData,
    TrafficMetrics,
    TrafficSources,
    CountryShare,
    Geography,
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
                "unique_visitors": 10500000,
                "avg_visit_duration_seconds": 245,
                "pages_per_visit": 4.2,
                "bounce_rate": 0.42,
                "mobile_share": 0.68,
            },
            "traffic_sources": {
                "direct": 0.38,
                "organic_search": 0.32,
                "paid_search": 0.12,
                "social": 0.08,
                "referral": 0.06,
                "email": 0.04,
            },
            "geography": {
                "primary_country": "US",
                "primary_country_share": 0.85,
                "top_countries": [
                    {"country": "US", "share": 0.85},
                    {"country": "CA", "share": 0.08},
                ],
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

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "traffic_metrics": {
                    "monthly_visits": 1000000,
                },
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
                "traffic_metrics": {
                    "monthly_visits": 1000000,
                },
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
                "traffic_metrics": {
                    "monthly_visits": 1000000,
                },
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
            assert result.module_id == "m03_traffic"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, TrafficAnalysisData)

            # Verify source citation
            assert result.source is not None
            assert "similarweb.com" in str(result.source.url)

    # =========================================================================
    # TrafficAnalysisData Model Tests
    # =========================================================================

    def test_traffic_analysis_data_model_creation(self):
        """Test TrafficAnalysisData pydantic model creation."""
        metrics = TrafficMetrics(
            monthly_visits=15000000,
            bounce_rate=0.40,
        )
        data = TrafficAnalysisData(
            domain="example.com",
            traffic_metrics=metrics,
        )

        assert data.domain == "example.com"
        assert data.traffic_metrics.monthly_visits == 15000000

    def test_traffic_metrics_model(self):
        """Test TrafficMetrics model creation."""
        metrics = TrafficMetrics(
            monthly_visits=15000000,
            unique_visitors=10000000,
            bounce_rate=0.40,
            pages_per_visit=4.2,
        )

        assert metrics.monthly_visits == 15000000
        assert metrics.bounce_rate == 0.40


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
