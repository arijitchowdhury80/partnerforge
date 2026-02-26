"""
Unit tests for M04_FinancialProfile Intelligence Module.

Tests the financial profile module which provides revenue, margins, and
ROI calculations. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m04_financial_profile import (
    M04FinancialProfileModule,
    FinancialProfileData,
    RevenueYearData,
    ROIScenario,
    MARGIN_THRESHOLDS,
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
            "revenue_current": 3720000000,
            "revenue_prior_year": 3730000000,
            "revenue_2_years_ago": 3820000000,
            "fiscal_year_end": "September 30",
            "gross_margin": 0.51,
            "operating_margin": 0.094,
            "net_margin": 0.053,
            "ebitda": 468720000,
            "ebitda_margin": 0.126,
            "ecommerce_revenue": 446400000,
            "ecommerce_percent": 0.12,
            "market_cap": 1800000000,
            "stock_price": 17.05,
            "price_change_ytd": 0.05,
            "price_change_1y": -0.12,
            "analyst_rating": "Hold",
            "analyst_target_price": 18.50,
            "analyst_count": 12,
            "employee_count": 27000,
            "source_url": "https://finance.yahoo.com/quote/SBH/",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m04_financial_profile"

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

    def test_margin_zone_green(self, module):
        """Test green margin zone (>20%)."""
        zone, desc = module._classify_margin_zone(0.25)
        assert zone == "green"
        assert "healthy" in desc.lower()

    def test_margin_zone_yellow(self, module):
        """Test yellow margin zone (10-20%)."""
        zone, desc = module._classify_margin_zone(0.15)
        assert zone == "yellow"
        assert "moderate" in desc.lower() or "efficiency" in desc.lower()

    def test_margin_zone_red(self, module):
        """Test red margin zone (<10%)."""
        zone, desc = module._classify_margin_zone(0.08)
        assert zone == "red"
        assert "hard roi" in desc.lower() or "pressure" in desc.lower()

    def test_margin_zone_none(self, module):
        """Test margin zone with None input."""
        zone, desc = module._classify_margin_zone(None)
        assert zone is None
        assert desc is None

    # =========================================================================
    # Revenue Trend Tests
    # =========================================================================

    def test_trend_growing(self, module):
        """Test growing revenue trend."""
        trend = module._determine_trend(110, 100)
        assert trend == "growing"

    def test_trend_declining(self, module):
        """Test declining revenue trend."""
        trend = module._determine_trend(90, 100)
        assert trend == "declining"

    def test_trend_stable(self, module):
        """Test stable revenue trend."""
        trend = module._determine_trend(102, 100)
        assert trend == "stable"

    def test_trend_none(self, module):
        """Test trend with missing data."""
        assert module._determine_trend(None, 100) is None
        assert module._determine_trend(100, None) is None

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(
        self, module, valid_yahoo_finance_response
    ):
        """Test transform_data creates data matching FinancialProfileData schema."""
        result = await module.transform_data(valid_yahoo_finance_response)

        assert result["domain"] == "sallybeauty.com"
        assert result["ticker"] == "SBH"
        assert result["is_public"] is True
        assert result["revenue_current"] == 3720000000
        assert result["margin_zone"] == "yellow"  # 12.6% EBITDA margin

    @pytest.mark.asyncio
    async def test_transform_data_calculates_roi_scenarios(
        self, module, valid_yahoo_finance_response
    ):
        """Test ROI scenario calculations."""
        result = await module.transform_data(valid_yahoo_finance_response)

        # Addressable revenue = ecommerce_revenue * 0.15
        expected_addressable = 446400000 * 0.15
        assert result["addressable_revenue"] == expected_addressable

        # ROI scenarios
        assert result["roi_scenario_low"]["lift_pct"] == 0.02
        assert result["roi_scenario_mid"]["lift_pct"] == 0.05
        assert result["roi_scenario_high"]["lift_pct"] == 0.10

    @pytest.mark.asyncio
    async def test_transform_data_builds_revenue_3yr(
        self, module, valid_yahoo_finance_response
    ):
        """Test 3-year revenue trend construction."""
        result = await module.transform_data(valid_yahoo_finance_response)

        assert len(result["revenue_3yr"]) == 3
        assert result["revenue_3yr"][0]["fiscal_year"] == "FY-2"
        assert result["revenue_3yr"][1]["fiscal_year"] == "FY-1"
        assert result["revenue_3yr"][2]["fiscal_year"] == "FY"

    @pytest.mark.asyncio
    async def test_transform_data_calculates_financial_score(self, module):
        """Test financial score calculation."""
        raw_data = {
            "domain": "example.com",
            "revenue_current": 1500000000,  # $1.5B = 10 points
            "ebitda_margin": 0.25,  # green = 5 points
            "revenue_prior_year": 1400000000,  # growing = 5 points
            "source_url": "https://finance.yahoo.com/quote/TEST/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)
        assert result["financial_score"] == 20  # Max score

    # =========================================================================
    # Currency Formatting Tests
    # =========================================================================

    def test_format_currency_billions(self, module):
        """Test formatting billions."""
        assert module._format_currency(3720000000) == "$3.7B"

    def test_format_currency_millions(self, module):
        """Test formatting millions."""
        assert module._format_currency(446000000) == "$446M"

    def test_format_currency_thousands(self, module):
        """Test formatting thousands."""
        assert module._format_currency(500000) == "$500K"

    def test_format_currency_none(self, module):
        """Test formatting None."""
        assert module._format_currency(None) is None

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
            assert result.module_id == "m04_financial_profile"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, FinancialProfileData)
            assert result.data.ticker == "SBH"
            assert result.data.is_public is True
            assert result.data.margin_zone == "yellow"

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
            revenue_current=1000000000,
            margin_zone="green",
            financial_score=18,
        )

        assert data.domain == "example.com"
        assert data.ticker == "TEST"
        assert data.is_public is True
        assert data.financial_score == 18

    def test_financial_profile_data_with_minimal_fields(self):
        """Test FinancialProfileData with only required fields."""
        data = FinancialProfileData(domain="example.com")

        assert data.domain == "example.com"
        assert data.ticker is None
        assert data.is_public is False
        assert data.revenue_3yr == []


class TestM04ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M04 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m04_financial_profile")
        assert module_class is not None
        assert module_class.MODULE_ID == "m04_financial_profile"

    def test_module_in_wave_1(self):
        """Test M04 module appears in Wave 1 modules."""
        from app.modules.base import get_modules_by_wave

        wave_1_modules = get_modules_by_wave(1)
        module_ids = [cls.MODULE_ID for cls in wave_1_modules]

        assert "m04_financial_profile" in module_ids
