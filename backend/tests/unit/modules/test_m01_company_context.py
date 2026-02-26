"""
Unit tests for M01_CompanyContext Intelligence Module.

Tests the company context module which provides baseline company information
for all downstream analysis. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m01_company_context import (
    M01CompanyContextModule,
    CompanyContextData,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM01CompanyContextModule:
    """Test suite for M01CompanyContextModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M01CompanyContextModule()

    @pytest.fixture
    def valid_builtwith_response(self):
        """Mock BuiltWith API response."""
        return {
            "domain": "sallybeauty.com",
            "company_name": "Sally Beauty Holdings, Inc.",
            "description": "Sally Beauty Holdings is a specialty retailer and distributor of professional beauty supplies.",
            "headquarters": {
                "city": "Denton",
                "state": "Texas",
                "country": "USA"
            },
            "founded_year": 1964,
            "employee_count": 27000,
            "industry": "Retail",
            "sub_industry": "Beauty & Personal Care",
            "source_url": "https://builtwith.com/sallybeauty.com",
            "source_date": datetime.now().isoformat(),
        }

    @pytest.fixture
    def valid_websearch_response(self):
        """Mock WebSearch response with additional data."""
        return {
            "company_name": "Sally Beauty Holdings, Inc.",
            "description": "Sally Beauty Holdings, Inc. is an international specialty retailer and distributor of professional beauty supplies.",
            "headquarters": {
                "city": "Denton",
                "state": "Texas",
                "country": "United States"
            },
            "founded_year": 1964,
            "revenue_estimate": 3720000000,
            "regions_active": ["North America", "Europe", "Latin America"],
            "brands": ["Sally Beauty Supply", "Beauty Systems Group", "CosmoProf"],
            "recent_news": [
                {
                    "title": "Sally Beauty Reports Q1 2026 Earnings",
                    "date": "2026-02-09",
                    "url": "https://businesswire.com/news/sally-beauty-q1-2026",
                    "summary": "Sally Beauty Holdings reported Q1 2026 earnings with e-commerce growth of 11%."
                }
            ],
            "source_url": "https://www.sallybeautyholdings.com/about/",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m01_company_context"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Company Context"

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
    async def test_fetch_from_builtwith_returns_valid_data(
        self, module, valid_builtwith_response
    ):
        """Test BuiltWith data fetching returns expected structure."""
        with patch.object(
            module, "_call_builtwith_api", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_builtwith_response

            result = await module._fetch_from_builtwith("sallybeauty.com")

            assert result["domain"] == "sallybeauty.com"
            assert result["company_name"] == "Sally Beauty Holdings, Inc."
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

            assert result["company_name"] == "Sally Beauty Holdings, Inc."
            assert "brands" in result
            assert "recent_news" in result
            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_data_merges_sources(
        self, module, valid_builtwith_response, valid_websearch_response
    ):
        """Test fetch_data properly merges BuiltWith and WebSearch data."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_bw.return_value = valid_builtwith_response
            mock_ws.return_value = valid_websearch_response

            result = await module.fetch_data("sallybeauty.com")

            # Should have data from both sources
            assert result["company_name"] == "Sally Beauty Holdings, Inc."
            assert "brands" in result  # From WebSearch
            assert "headquarters" in result  # From both

    # =========================================================================
    # Source Merging Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_merge_sources_prioritizes_builtwith(self, module):
        """Test that BuiltWith data takes priority for overlapping fields."""
        builtwith_data = {
            "company_name": "Sally Beauty Holdings, Inc.",
            "industry": "Retail",
            "employee_count": 27000,
            "source_url": "https://builtwith.com/sallybeauty.com",
            "source_date": datetime.now().isoformat(),
        }
        websearch_data = {
            "company_name": "Sally Beauty",  # Different name
            "industry": "Beauty Retail",  # Different classification
            "employee_count": 25000,  # Different count
            "brands": ["Sally Beauty Supply"],  # Unique to websearch
            "source_url": "https://websearch.com/result",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(builtwith_data, websearch_data)

        # BuiltWith should win for overlapping fields
        assert result["company_name"] == "Sally Beauty Holdings, Inc."
        assert result["industry"] == "Retail"
        assert result["employee_count"] == 27000
        # WebSearch data should fill in missing fields
        assert result["brands"] == ["Sally Beauty Supply"]

    @pytest.mark.asyncio
    async def test_merge_sources_fills_gaps_from_websearch(self, module):
        """Test that WebSearch fills in fields missing from BuiltWith."""
        builtwith_data = {
            "company_name": "Sally Beauty Holdings, Inc.",
            "source_url": "https://builtwith.com/sallybeauty.com",
            "source_date": datetime.now().isoformat(),
        }
        websearch_data = {
            "company_name": "Sally Beauty",
            "description": "A specialty retailer of beauty products.",
            "founded_year": 1964,
            "revenue_estimate": 3720000000,
            "regions_active": ["NA", "EMEA"],
            "source_url": "https://websearch.com/result",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(builtwith_data, websearch_data)

        # Should have BuiltWith company name
        assert result["company_name"] == "Sally Beauty Holdings, Inc."
        # Should have WebSearch-only fields
        assert result["description"] == "A specialty retailer of beauty products."
        assert result["founded_year"] == 1964
        assert result["revenue_estimate"] == 3720000000
        assert result["regions_active"] == ["NA", "EMEA"]

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(self, module):
        """Test transform_data creates data matching CompanyContextData schema."""
        raw_data = {
            "domain": "sallybeauty.com",
            "company_name": "Sally Beauty Holdings, Inc.",
            "description": "Sally Beauty Holdings is a specialty retailer.",
            "headquarters": {
                "city": "Denton",
                "state": "Texas",
                "country": "USA"
            },
            "founded_year": 1964,
            "employee_count": 27000,
            "revenue_estimate": 3720000000,
            "industry": "Retail",
            "sub_industry": "Beauty & Personal Care",
            "regions_active": ["NA", "EMEA", "LATAM"],
            "brands": ["Sally Beauty Supply", "CosmoProf"],
            "recent_news": [
                {
                    "title": "Q1 2026 Earnings",
                    "date": "2026-02-09",
                    "url": "https://businesswire.com/news",
                    "summary": "Strong e-commerce growth."
                }
            ],
            "source_url": "https://builtwith.com/sallybeauty.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "sallybeauty.com"
        assert result["company_name"] == "Sally Beauty Holdings, Inc."
        assert result["headquarters_city"] == "Denton"
        assert result["headquarters_state"] == "Texas"
        assert result["headquarters_country"] == "USA"
        assert result["founded_year"] == 1964
        assert result["employee_count"] == 27000
        assert result["industry"] == "Retail"
        assert result["sub_industry"] == "Beauty & Personal Care"
        assert result["regions_active"] == ["NA", "EMEA", "LATAM"]
        assert len(result["brands"]) == 2
        assert len(result["recent_news"]) == 1

    @pytest.mark.asyncio
    async def test_transform_data_handles_missing_fields(self, module):
        """Test transform_data handles missing optional fields gracefully."""
        raw_data = {
            "domain": "example.com",
            "company_name": "Example Corp",
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "example.com"
        assert result["company_name"] == "Example Corp"
        assert result.get("description") is None
        assert result.get("founded_year") is None
        assert result.get("employee_count") is None
        assert result.get("regions_active") == []
        assert result.get("brands") == []
        assert result.get("recent_news") == []

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "company_name": "Example Corp",
                "source_url": "https://builtwith.com/example.com",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert str(result.source.url) == "https://builtwith.com/example.com"

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "company_name": "Example Corp",
                "source_url": "https://builtwith.com/example.com",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.source.date is not None
            # Date should be within last minute (accounting for test execution time)
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            # Return data without source_url
            mock_fetch.return_value = {
                "domain": "example.com",
                "company_name": "Example Corp",
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)  # 13+ months old

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "company_name": "Example Corp",
                "source_url": "https://builtwith.com/example.com",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Validation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_validate_and_store_creates_model(self, module):
        """Test _validate_and_store creates a proper CompanyContextData model."""
        merged_data = {
            "domain": "sallybeauty.com",
            "company_name": "Sally Beauty Holdings, Inc.",
            "description": "Sally Beauty Holdings is a specialty retailer.",
            "headquarters": {
                "city": "Denton",
                "state": "Texas",
                "country": "USA"
            },
            "founded_year": 1964,
            "employee_count": 27000,
            "industry": "Retail",
            "sub_industry": "Beauty & Personal Care",
            "regions_active": ["NA"],
            "brands": ["Sally Beauty"],
            "recent_news": [],
            "source_url": "https://builtwith.com/sallybeauty.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._validate_and_store("sallybeauty.com", merged_data)

        assert isinstance(result, CompanyContextData)
        assert result.domain == "sallybeauty.com"
        assert result.company_name == "Sally Beauty Holdings, Inc."
        assert result.founded_year == 1964

    @pytest.mark.asyncio
    async def test_validate_and_store_validates_domain_match(self, module):
        """Test domain in data must match requested domain."""
        merged_data = {
            "domain": "wrongdomain.com",  # Mismatch!
            "company_name": "Example Corp",
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_store("example.com", merged_data)

        assert "domain" in str(exc_info.value).lower()

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_bw.return_value = {
                "domain": "sallybeauty.com",
                "company_name": "Sally Beauty Holdings, Inc.",
                "industry": "Retail",
                "employee_count": 27000,
                "source_url": "https://builtwith.com/sallybeauty.com",
                "source_date": datetime.now().isoformat(),
            }
            mock_ws.return_value = {
                "description": "Sally Beauty Holdings is a specialty retailer.",
                "founded_year": 1964,
                "brands": ["Sally Beauty Supply", "CosmoProf"],
                "regions_active": ["North America", "Europe"],
                "recent_news": [],
                "source_url": "https://websearch.com/result",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m01_company_context"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, CompanyContextData)
            assert result.data.company_name == "Sally Beauty Holdings, Inc."
            assert result.data.industry == "Retail"
            assert result.data.employee_count == 27000
            assert result.data.founded_year == 1964
            assert "Sally Beauty Supply" in result.data.brands

            # Verify source citation
            assert result.source is not None
            assert "builtwith.com" in str(result.source.url)

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
                    "company_name": "Example Corp",
                    "source_url": "https://builtwith.com/example.com",
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
    async def test_handles_builtwith_api_failure(self, module):
        """Test graceful handling when BuiltWith API fails."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            # BuiltWith fails
            mock_bw.side_effect = Exception("BuiltWith API timeout")

            # WebSearch succeeds
            mock_ws.return_value = {
                "domain": "example.com",
                "company_name": "Example Corp",
                "description": "A company.",
                "source_url": "https://websearch.com/result",
                "source_date": datetime.now().isoformat(),
            }

            # Should still work with WebSearch fallback
            result = await module.enrich("example.com")

            assert result.data.company_name == "Example Corp"

    @pytest.mark.asyncio
    async def test_fails_when_all_sources_fail(self, module):
        """Test appropriate error when all data sources fail."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_bw.side_effect = Exception("BuiltWith API timeout")
            mock_ws.side_effect = Exception("WebSearch API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("example.com")

            # Should indicate enrichment failure
            assert "enrich" in str(exc_info.value).lower() or "fail" in str(exc_info.value).lower()

    # =========================================================================
    # CompanyContextData Model Tests
    # =========================================================================

    def test_company_context_data_model_creation(self):
        """Test CompanyContextData pydantic model creation."""
        data = CompanyContextData(
            domain="example.com",
            company_name="Example Corp",
            description="A company.",
            headquarters_city="New York",
            headquarters_state="NY",
            headquarters_country="USA",
            founded_year=2010,
            employee_count=500,
            revenue_estimate=50000000,
            industry="Technology",
            sub_industry="SaaS",
            regions_active=["NA", "EMEA"],
            brands=["Example Brand"],
            recent_news=[
                {
                    "title": "Example News",
                    "date": "2026-02-01",
                    "url": "https://example.com/news",
                    "summary": "Summary"
                }
            ],
        )

        assert data.domain == "example.com"
        assert data.company_name == "Example Corp"
        assert data.employee_count == 500
        assert len(data.brands) == 1

    def test_company_context_data_with_minimal_fields(self):
        """Test CompanyContextData with only required fields."""
        data = CompanyContextData(
            domain="example.com",
            company_name="Example Corp",
        )

        assert data.domain == "example.com"
        assert data.description is None
        assert data.employee_count is None
        assert data.regions_active == []
        assert data.brands == []
        assert data.recent_news == []

    def test_company_context_data_model_dump(self):
        """Test CompanyContextData can be serialized."""
        data = CompanyContextData(
            domain="example.com",
            company_name="Example Corp",
            employee_count=500,
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["employee_count"] == 500


class TestM01ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M01 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m01_company_context")
        assert module_class is not None
        assert module_class.MODULE_ID == "m01_company_context"

    def test_module_in_wave_1(self):
        """Test M01 module appears in Wave 1 modules."""
        from app.modules.base import get_modules_by_wave

        wave_1_modules = get_modules_by_wave(1)
        module_ids = [cls.MODULE_ID for cls in wave_1_modules]

        assert "m01_company_context" in module_ids
