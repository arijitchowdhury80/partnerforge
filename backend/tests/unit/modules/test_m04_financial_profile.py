"""
Unit tests for M04_FinancialProfile Intelligence Module.

Tests the financial profile module which provides revenue, margins, and
ROI calculations. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m04_financials import (
    M04FinancialProfileModule,
    FinancialProfileData,
    FinancialsData,
    MarginZoneData,
    ROIScenarios,
    ROIScenario,
    MarginZone,
    MARGIN_THRESHOLD_RED,
    MARGIN_THRESHOLD_GREEN,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM04FinancialProfileModule:
    """Test suite for M04FinancialProfileModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M04FinancialProfileModule()

    @pytest.fixture
    def valid_yahoo_finance_response(self):
        """Mock Yahoo Finance API response."""
        return {
            "domain": "sallybeauty.com",
            "ticker": "SBH",
            "exchange": "NYSE",
            "is_public": True,
            "financials": {
                "revenue_3yr": [
                    {"fiscal_year": "FY2022", "revenue": 3820000000},
                    {"fiscal_year": "FY2023", "revenue": 3730000000, "yoy_change": -0.024},
                    {"fiscal_year": "FY2024", "revenue": 3720000000, "yoy_change": -0.003},
                ],
                "latest_revenue": 3720000000,
                "ebitda_margin": 0.126,
                "operating_margin": 0.094,
            },
            "ecommerce": {
                "ecommerce_revenue": 446400000,
                "ecommerce_share": 0.12,
            },
            "source_url": "https://finance.yahoo.com/quote/SBH/",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m04_financials"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Financial Profile"

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
    # Margin Zone Classification Tests
    # =========================================================================

    def test_margin_zone_thresholds(self):
        """Test margin zone thresholds are correctly defined."""
        assert MARGIN_THRESHOLD_RED == 0.10
        assert MARGIN_THRESHOLD_GREEN == 0.20

    def test_margin_zone_enum_values(self):
        """Test margin zone enum values."""
        assert MarginZone.GREEN.value == "GREEN"
        assert MarginZone.YELLOW.value == "YELLOW"
        assert MarginZone.RED.value == "RED"

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "is_public": False,
                "source_url": "https://finance.yahoo.com/quote/TEST/",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "finance.yahoo.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "is_public": False,
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
                "is_public": False,
                "source_url": "https://finance.yahoo.com/quote/TEST/",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module, valid_yahoo_finance_response):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_from_yahoo_finance", new_callable=AsyncMock
        ) as mock_yf:
            mock_ticker.return_value = "SBH"
            mock_yf.return_value = valid_yahoo_finance_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m04_financials"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, FinancialProfileData)

            # Verify source citation
            assert result.source is not None
            assert "yahoo" in str(result.source.url).lower()

    # =========================================================================
    # FinancialProfileData Model Tests
    # =========================================================================

    def test_financial_profile_data_model_creation(self):
        """Test FinancialProfileData pydantic model creation."""
        data = FinancialProfileData(
            domain="example.com",
            ticker="TEST",
            is_public=True,
        )

        assert data.domain == "example.com"
        assert data.ticker == "TEST"
        assert data.is_public is True

    def test_financial_profile_data_with_minimal_fields(self):
        """Test FinancialProfileData with only required fields."""
        data = FinancialProfileData(domain="example.com")

        assert data.domain == "example.com"
        assert data.ticker is None
        assert data.is_public is False

    def test_roi_scenario_model(self):
        """Test ROIScenario model creation."""
        scenario = ROIScenario(
            lift_pct=0.05,
            annual_impact=1000000,
        )

        assert scenario.lift_pct == 0.05
        assert scenario.annual_impact == 1000000


class TestM04ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M04 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m04_financials")
        assert module_class is not None
        assert module_class.MODULE_ID == "m04_financials"

    def test_module_in_wave_1(self):
        """Test M04 module appears in Wave 1 modules."""
        from app.modules.base import get_modules_by_wave

        wave_1_modules = get_modules_by_wave(1)
        module_ids = [cls.MODULE_ID for cls in wave_1_modules]

        assert "m04_financials" in module_ids
