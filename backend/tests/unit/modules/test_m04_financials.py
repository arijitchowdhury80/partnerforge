"""
Unit tests for M04_FinancialProfile Intelligence Module.

Tests the financial profile module which provides 3-year financial trends,
margin zone classification, and ROI modeling for sales positioning.
Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m04_financials import (
    M04FinancialProfileModule,
    FinancialProfileData,
    FinancialsData,
    MarginZoneData,
    EcommerceData,
    StockInfo,
    ROIScenarios,
    ROIScenario,
    FiscalYearRevenue,
    FiscalYearNetIncome,
    MarginZone,
    RevenueTrend,
    AnalystConsensus,
    MARGIN_THRESHOLD_RED,
    MARGIN_THRESHOLD_GREEN,
    ROI_LIFT_CONSERVATIVE,
    ROI_LIFT_MODERATE,
    ROI_LIFT_AGGRESSIVE,
    SEARCH_ADDRESSABLE_MULTIPLIER,
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
            "fiscal_year_end": "September 30",
            "revenue_3yr": [
                {"fiscal_year": "FY2022", "revenue": 3820000000, "yoy_change": None},
                {"fiscal_year": "FY2023", "revenue": 3730000000, "yoy_change": -0.024},
                {"fiscal_year": "FY2024", "revenue": 3720000000, "yoy_change": -0.003},
            ],
            "latest_revenue": 3720000000,
            "revenue_trend": "stable",
            "revenue_growth_yoy": -0.003,
            "net_income_3yr": [
                {"fiscal_year": "FY2022", "net_income": 184600000, "margin": 0.048},
                {"fiscal_year": "FY2023", "net_income": 153400000, "margin": 0.041},
                {"fiscal_year": "FY2024", "net_income": 195900000, "margin": 0.053},
            ],
            "ebitda_margin": 0.126,
            "operating_margin": 0.094,
            "gross_margin": 0.51,
            "current_price": 17.05,
            "market_cap": 1800000000,
            "price_52_week_high": 19.50,
            "price_52_week_low": 12.80,
            "analyst_consensus": "HOLD",
            "analyst_target_price": 18.50,
            "source_url": "https://finance.yahoo.com/quote/SBH/",
            "source_date": datetime.now().isoformat(),
        }

    @pytest.fixture
    def valid_websearch_response(self):
        """Mock WebSearch response with e-commerce data."""
        return {
            "ecommerce_revenue": 446000000,
            "ecommerce_share": 0.12,
            "ecommerce_growth_yoy": 0.11,
            "digital_revenue_estimate": 446000000,
            "addressable_search_revenue": 66900000,
            "source_url": "https://www.sallybeauty.com/investor-relations/",
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

    def test_module_cache_ttl(self, module):
        """Test module has 24-hour cache TTL for financial data."""
        assert module.CACHE_TTL == 86400

    # =========================================================================
    # Ticker Resolution Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_resolve_ticker_known_domain(self, module):
        """Test ticker resolution for known domains."""
        ticker = await module._resolve_ticker("sallybeauty.com")
        assert ticker == "SBH"

    @pytest.mark.asyncio
    async def test_resolve_ticker_costco(self, module):
        """Test ticker resolution for Costco."""
        ticker = await module._resolve_ticker("costco.com")
        assert ticker == "COST"

    @pytest.mark.asyncio
    async def test_resolve_ticker_unknown_domain(self, module):
        """Test ticker resolution returns None for unknown domains."""
        ticker = await module._resolve_ticker("unknowncompany.com")
        assert ticker is None

    @pytest.mark.asyncio
    async def test_resolve_ticker_private_company(self, module):
        """Test ticker resolution returns None for private companies."""
        ticker = await module._resolve_ticker("sephora.com")  # LVMH subsidiary
        assert ticker is None

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fetch_from_yahoo_finance_returns_valid_data(
        self, module, valid_yahoo_finance_response
    ):
        """Test Yahoo Finance data fetching returns expected structure."""
        with patch.object(
            module, "_call_yahoo_finance_api", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_yahoo_finance_response

            result = await module._fetch_from_yahoo_finance("SBH", "sallybeauty.com")

            assert result["ticker"] == "SBH"
            assert result["is_public"] is True
            assert result["ebitda_margin"] == 0.126
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_fetch_from_websearch_returns_valid_data(
        self, module, valid_websearch_response
    ):
        """Test WebSearch data fetching returns expected structure."""
        with patch.object(
            module, "_call_websearch_api", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_websearch_response

            result = await module._fetch_from_websearch("sallybeauty.com")

            assert result["ecommerce_revenue"] == 446000000
            assert result["ecommerce_share"] == 0.12
            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_data_merges_sources(
        self, module, valid_yahoo_finance_response, valid_websearch_response
    ):
        """Test fetch_data properly merges Yahoo Finance and WebSearch data."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_from_yahoo_finance", new_callable=AsyncMock
        ) as mock_yf, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = "SBH"
            mock_yf.return_value = valid_yahoo_finance_response
            mock_ws.return_value = valid_websearch_response

            result = await module.fetch_data("sallybeauty.com")

            # Should have data from both sources
            assert result["ticker"] == "SBH"  # From Yahoo Finance
            assert result["ecommerce_revenue"] == 446000000  # From WebSearch
            assert result["ebitda_margin"] == 0.126  # From Yahoo Finance

    # =========================================================================
    # Source Merging Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_merge_sources_prioritizes_yahoo_finance(self, module):
        """Test that Yahoo Finance data takes priority for overlapping fields."""
        yahoo_data = {
            "ticker": "SBH",
            "ebitda_margin": 0.126,
            "latest_revenue": 3720000000,
            "source_url": "https://finance.yahoo.com/quote/SBH/",
            "source_date": datetime.now().isoformat(),
        }
        websearch_data = {
            "ebitda_margin": 0.12,  # Different value
            "latest_revenue": 3700000000,  # Different value
            "ecommerce_revenue": 446000000,  # Unique to websearch
            "source_url": "https://websearch.com/result",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(yahoo_data, websearch_data)

        # Yahoo Finance should win for overlapping fields
        assert result["ticker"] == "SBH"
        assert result["ebitda_margin"] == 0.126
        assert result["latest_revenue"] == 3720000000
        # WebSearch data should fill in missing fields
        assert result["ecommerce_revenue"] == 446000000

    @pytest.mark.asyncio
    async def test_merge_sources_calculates_addressable_revenue(self, module):
        """Test addressable_search_revenue calculation when not present."""
        yahoo_data = {
            "ticker": "SBH",
            "source_url": "https://finance.yahoo.com/quote/SBH/",
            "source_date": datetime.now().isoformat(),
        }
        websearch_data = {
            "digital_revenue_estimate": 1000000000,  # $1B
            "source_url": "https://websearch.com/result",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(yahoo_data, websearch_data)

        # Should calculate addressable search revenue as 15% of digital
        assert result["addressable_search_revenue"] == 150000000  # $150M

    # =========================================================================
    # Margin Zone Classification Tests
    # =========================================================================

    def test_margin_zone_red(self, module):
        """Test RED zone classification for margin <= 10%."""
        result = module._calculate_margin_zone(0.08)  # 8%

        assert result["classification"] == "RED"
        assert "hard roi" in result["implication"].lower()

    def test_margin_zone_red_at_threshold(self, module):
        """Test RED zone at exactly 10%."""
        result = module._calculate_margin_zone(0.10)

        assert result["classification"] == "RED"

    def test_margin_zone_yellow(self, module):
        """Test YELLOW zone classification for 10% < margin <= 20%."""
        result = module._calculate_margin_zone(0.15)  # 15%

        assert result["classification"] == "YELLOW"
        assert "efficiency" in result["implication"].lower()

    def test_margin_zone_green(self, module):
        """Test GREEN zone classification for margin > 20%."""
        result = module._calculate_margin_zone(0.25)  # 25%

        assert result["classification"] == "GREEN"
        assert "budget" in result["implication"].lower() or "healthy" in result["implication"].lower()

    def test_margin_zone_none_when_no_margin(self, module):
        """Test margin zone returns None when no EBITDA margin."""
        result = module._calculate_margin_zone(None)

        assert result is None

    # =========================================================================
    # ROI Scenarios Tests
    # =========================================================================

    def test_roi_scenarios_calculation(self, module):
        """Test ROI scenarios are calculated correctly."""
        addressable_revenue = 66900000  # $66.9M

        result = module._calculate_roi_scenarios(addressable_revenue)

        assert result["conservative"]["lift_pct"] == ROI_LIFT_CONSERVATIVE
        assert result["conservative"]["annual_impact"] == addressable_revenue * 0.05

        assert result["moderate"]["lift_pct"] == ROI_LIFT_MODERATE
        assert result["moderate"]["annual_impact"] == addressable_revenue * 0.10

        assert result["aggressive"]["lift_pct"] == ROI_LIFT_AGGRESSIVE
        assert result["aggressive"]["annual_impact"] == addressable_revenue * 0.15

    def test_roi_scenarios_none_when_no_revenue(self, module):
        """Test ROI scenarios returns None when no addressable revenue."""
        result = module._calculate_roi_scenarios(None)

        assert result is None

    def test_roi_scenarios_concrete_values(self, module):
        """Test ROI scenarios with concrete Sally Beauty values."""
        addressable_revenue = 66900000  # $66.9M

        result = module._calculate_roi_scenarios(addressable_revenue)

        # Conservative: 5% lift = $3.345M
        assert result["conservative"]["annual_impact"] == 3345000

        # Moderate: 10% lift = $6.69M
        assert result["moderate"]["annual_impact"] == 6690000

        # Aggressive: 15% lift = $10.035M
        assert result["aggressive"]["annual_impact"] == 10035000

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(self, module):
        """Test transform_data creates data matching FinancialProfileData schema."""
        raw_data = {
            "domain": "sallybeauty.com",
            "ticker": "SBH",
            "exchange": "NYSE",
            "is_public": True,
            "fiscal_year_end": "September 30",
            "revenue_3yr": [
                {"fiscal_year": "FY2024", "revenue": 3720000000, "yoy_change": -0.003},
            ],
            "latest_revenue": 3720000000,
            "revenue_trend": "stable",
            "revenue_growth_yoy": -0.003,
            "net_income_3yr": [
                {"fiscal_year": "FY2024", "net_income": 195900000, "margin": 0.053},
            ],
            "ebitda_margin": 0.126,
            "operating_margin": 0.094,
            "gross_margin": 0.51,
            "ecommerce_revenue": 446000000,
            "ecommerce_share": 0.12,
            "addressable_search_revenue": 66900000,
            "current_price": 17.05,
            "market_cap": 1800000000,
            "analyst_consensus": "HOLD",
            "source_url": "https://finance.yahoo.com/quote/SBH/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "sallybeauty.com"
        assert result["ticker"] == "SBH"
        assert result["is_public"] is True
        assert result["margin_zone"]["classification"] == "YELLOW"  # 12.6%
        assert result["roi_scenarios"]["moderate"]["lift_pct"] == 0.10

    @pytest.mark.asyncio
    async def test_transform_data_handles_missing_fields(self, module):
        """Test transform_data handles missing optional fields gracefully."""
        raw_data = {
            "domain": "privatecompany.com",
            "is_public": False,
            "source_url": "https://privatecompany.com/about/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "privatecompany.com"
        assert result["ticker"] is None
        assert result["is_public"] is False
        assert result["margin_zone"] is None  # No EBITDA margin
        assert result["roi_scenarios"] is None  # No addressable revenue

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "sallybeauty.com",
                "ticker": "SBH",
                "is_public": True,
                "source_url": "https://finance.yahoo.com/quote/SBH/",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("sallybeauty.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "yahoo.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "sallybeauty.com",
                "ticker": "SBH",
                "is_public": True,
                "source_url": "https://finance.yahoo.com/quote/SBH/",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("sallybeauty.com")

            assert result.source.date is not None
            # Date should be within last minute
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "sallybeauty.com",
                "ticker": "SBH",
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("sallybeauty.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)  # 13+ months old

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "sallybeauty.com",
                "ticker": "SBH",
                "source_url": "https://finance.yahoo.com/quote/SBH/",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("sallybeauty.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Validation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_validate_and_store_creates_model(self, module):
        """Test _validate_and_store creates a proper FinancialProfileData model."""
        transformed_data = {
            "domain": "sallybeauty.com",
            "ticker": "SBH",
            "exchange": "NYSE",
            "is_public": True,
            "fiscal_year_end": "September 30",
            "financials": {
                "revenue_3yr": [
                    {"fiscal_year": "FY2024", "revenue": 3720000000, "yoy_change": -0.003},
                ],
                "latest_revenue": 3720000000,
                "revenue_trend": "stable",
                "net_income_3yr": [],
                "ebitda_margin": 0.126,
                "operating_margin": 0.094,
                "gross_margin": 0.51,
            },
            "margin_zone": {
                "classification": "YELLOW",
                "ebitda_margin": 0.126,
                "threshold_red": 0.10,
                "threshold_green": 0.20,
                "implication": "Moderate margin pressure - efficiency gains valued",
            },
            "ecommerce": {
                "ecommerce_revenue": 446000000,
                "ecommerce_share": 0.12,
                "addressable_search_revenue": 66900000,
            },
            "stock_info": {
                "current_price": 17.05,
                "market_cap": 1800000000,
                "analyst_consensus": "HOLD",
            },
            "roi_scenarios": {
                "conservative": {"lift_pct": 0.05, "annual_impact": 3345000},
                "moderate": {"lift_pct": 0.10, "annual_impact": 6690000},
                "aggressive": {"lift_pct": 0.15, "annual_impact": 10035000},
            },
            "revenue_current": 3720000000,
            "revenue_growth_yoy": -0.003,
            "source_url": "https://finance.yahoo.com/quote/SBH/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._validate_and_store("sallybeauty.com", transformed_data)

        assert isinstance(result, FinancialProfileData)
        assert result.domain == "sallybeauty.com"
        assert result.ticker == "SBH"
        assert result.is_public is True
        assert result.margin_zone.classification == MarginZone.YELLOW
        assert result.roi_scenarios.moderate.annual_impact == 6690000

    @pytest.mark.asyncio
    async def test_validate_and_store_validates_domain_match(self, module):
        """Test domain in data must match requested domain."""
        transformed_data = {
            "domain": "wrongdomain.com",  # Mismatch!
            "ticker": "SBH",
            "source_url": "https://finance.yahoo.com/quote/SBH/",
            "source_date": datetime.now().isoformat(),
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_store("sallybeauty.com", transformed_data)

        assert "domain" in str(exc_info.value).lower()

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_from_yahoo_finance", new_callable=AsyncMock
        ) as mock_yf, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = "SBH"
            mock_yf.return_value = {
                "domain": "sallybeauty.com",
                "ticker": "SBH",
                "exchange": "NYSE",
                "is_public": True,
                "ebitda_margin": 0.126,
                "latest_revenue": 3720000000,
                "revenue_growth_yoy": -0.003,
                "current_price": 17.05,
                "market_cap": 1800000000,
                "source_url": "https://finance.yahoo.com/quote/SBH/",
                "source_date": datetime.now().isoformat(),
            }
            mock_ws.return_value = {
                "ecommerce_revenue": 446000000,
                "addressable_search_revenue": 66900000,
                "source_url": "https://www.sallybeauty.com/investor-relations/",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m04_financials"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, FinancialProfileData)
            assert result.data.ticker == "SBH"
            assert result.data.is_public is True
            assert result.data.margin_zone.classification == MarginZone.YELLOW
            assert result.data.ecommerce.addressable_search_revenue == 66900000

            # Verify source citation
            assert result.source is not None
            assert "yahoo.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and fetches fresh data."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = {
                    "domain": "sallybeauty.com",
                    "is_public": False,
                    "source_url": "https://sallybeauty.com/about/",
                    "source_date": datetime.now().isoformat(),
                }

                await module.enrich("sallybeauty.com", force=True)

                mock_cache.assert_not_called()
                mock_fetch.assert_called_once_with("sallybeauty.com")

    @pytest.mark.asyncio
    async def test_enrich_private_company(self, module):
        """Test enrichment for private company (no Yahoo Finance data)."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = None  # No ticker for private company

            mock_ws.return_value = {
                "domain": "uncommongoods.com",
                "ecommerce_revenue": 227000000,
                "digital_revenue_estimate": 227000000,
                "addressable_search_revenue": 34050000,  # $227M * 0.15
                "source_url": "https://www.uncommongoods.com/about/",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("uncommongoods.com")

            assert result.data.is_public is False
            assert result.data.ticker is None
            assert result.data.ecommerce.addressable_search_revenue == 34050000

    # =========================================================================
    # Error Handling Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_handles_yahoo_finance_api_failure(self, module):
        """Test graceful handling when Yahoo Finance API fails."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_from_yahoo_finance", new_callable=AsyncMock
        ) as mock_yf, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = "SBH"
            mock_yf.side_effect = Exception("Yahoo Finance API timeout")

            mock_ws.return_value = {
                "domain": "sallybeauty.com",
                "ecommerce_revenue": 446000000,
                "source_url": "https://www.sallybeauty.com/investor-relations/",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("sallybeauty.com")

            assert result.data.ecommerce.ecommerce_revenue == 446000000

    @pytest.mark.asyncio
    async def test_fails_when_all_sources_fail(self, module):
        """Test appropriate error when all data sources fail."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_from_yahoo_finance", new_callable=AsyncMock
        ) as mock_yf, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = "SBH"
            mock_yf.side_effect = Exception("Yahoo Finance API timeout")
            mock_ws.side_effect = Exception("WebSearch API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("sallybeauty.com")

            assert "fail" in str(exc_info.value).lower()

    # =========================================================================
    # Data Model Tests
    # =========================================================================

    def test_financial_profile_data_model_creation(self):
        """Test FinancialProfileData pydantic model creation."""
        data = FinancialProfileData(
            domain="sallybeauty.com",
            ticker="SBH",
            exchange="NYSE",
            is_public=True,
            fiscal_year_end="September 30",
            financials=FinancialsData(
                revenue_3yr=[
                    FiscalYearRevenue(fiscal_year="FY2024", revenue=3720000000, yoy_change=-0.003)
                ],
                latest_revenue=3720000000,
                ebitda_margin=0.126,
            ),
            margin_zone=MarginZoneData(
                classification=MarginZone.YELLOW,
                ebitda_margin=0.126,
                implication="Moderate margin pressure",
            ),
            ecommerce=EcommerceData(
                ecommerce_revenue=446000000,
                addressable_search_revenue=66900000,
            ),
            stock_info=StockInfo(
                current_price=17.05,
                market_cap=1800000000,
            ),
            roi_scenarios=ROIScenarios(
                conservative=ROIScenario(lift_pct=0.05, annual_impact=3345000),
                moderate=ROIScenario(lift_pct=0.10, annual_impact=6690000),
                aggressive=ROIScenario(lift_pct=0.15, annual_impact=10035000),
            ),
        )

        assert data.domain == "sallybeauty.com"
        assert data.ticker == "SBH"
        assert data.margin_zone.classification == MarginZone.YELLOW
        assert data.roi_scenarios.moderate.annual_impact == 6690000

    def test_financial_profile_data_with_minimal_fields(self):
        """Test FinancialProfileData with only required fields."""
        data = FinancialProfileData(
            domain="privatecompany.com",
        )

        assert data.domain == "privatecompany.com"
        assert data.ticker is None
        assert data.is_public is False
        assert data.financials is None
        assert data.margin_zone is None
        assert data.roi_scenarios is None

    def test_ticker_normalization(self):
        """Test ticker is normalized to uppercase."""
        data = FinancialProfileData(
            domain="example.com",
            ticker="sbh",  # lowercase
        )

        assert data.ticker == "SBH"

    def test_margin_zone_enum_values(self):
        """Test MarginZone enum values."""
        assert MarginZone.RED.value == "RED"
        assert MarginZone.YELLOW.value == "YELLOW"
        assert MarginZone.GREEN.value == "GREEN"

    def test_analyst_consensus_enum_values(self):
        """Test AnalystConsensus enum values."""
        assert AnalystConsensus.STRONG_BUY.value == "STRONG_BUY"
        assert AnalystConsensus.BUY.value == "BUY"
        assert AnalystConsensus.HOLD.value == "HOLD"
        assert AnalystConsensus.SELL.value == "SELL"
        assert AnalystConsensus.STRONG_SELL.value == "STRONG_SELL"

    def test_financial_profile_data_model_dump(self):
        """Test FinancialProfileData can be serialized."""
        data = FinancialProfileData(
            domain="sallybeauty.com",
            ticker="SBH",
            is_public=True,
            revenue_current=3720000000,
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "sallybeauty.com"
        assert dumped["ticker"] == "SBH"
        assert dumped["revenue_current"] == 3720000000

    # =========================================================================
    # Constants Tests
    # =========================================================================

    def test_margin_thresholds(self):
        """Test margin threshold constants are correct."""
        assert MARGIN_THRESHOLD_RED == 0.10
        assert MARGIN_THRESHOLD_GREEN == 0.20

    def test_roi_lift_constants(self):
        """Test ROI lift constants are correct."""
        assert ROI_LIFT_CONSERVATIVE == 0.05
        assert ROI_LIFT_MODERATE == 0.10
        assert ROI_LIFT_AGGRESSIVE == 0.15

    def test_search_addressable_multiplier(self):
        """Test search addressable revenue multiplier is 15%."""
        assert SEARCH_ADDRESSABLE_MULTIPLIER == 0.15


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
