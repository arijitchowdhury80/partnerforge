"""
Unit tests for M02_TechnologyStack Intelligence Module.

Tests the technology stack module which detects technologies for partner matching
and displacement opportunities. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m02_technology_stack import (
    M02TechnologyStackModule,
    TechnologyStackData,
    TechnologyItem,
    PARTNER_TECHNOLOGIES,
    COMPETITOR_SEARCH_PROVIDERS,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM02TechnologyStackModule:
    """Test suite for M02TechnologyStackModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M02TechnologyStackModule()

    @pytest.fixture
    def valid_builtwith_response(self):
        """Mock BuiltWith API response."""
        return {
            "domain": "sallybeauty.com",
            "technologies": [
                {
                    "name": "Salesforce Commerce Cloud",
                    "category": "E-commerce",
                    "first_detected": "2019-03-15",
                    "last_detected": datetime.now().strftime("%Y-%m-%d"),
                    "confidence": 0.95,
                },
                {
                    "name": "Elasticsearch",
                    "category": "Search",
                    "first_detected": "2020-06-01",
                    "last_detected": datetime.now().strftime("%Y-%m-%d"),
                    "confidence": 0.90,
                },
                {
                    "name": "Google Analytics",
                    "category": "Analytics",
                    "confidence": 0.99,
                },
            ],
            "tech_spend_estimate": 125000,
            "source_url": "https://builtwith.com/sallybeauty.com",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m02_technology_stack"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Technology Stack"

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
    # Partner/Competitor Detection Tests
    # =========================================================================

    def test_partner_technologies_defined(self):
        """Test partner technologies are properly defined."""
        assert "Salesforce Commerce Cloud" in PARTNER_TECHNOLOGIES
        assert "Adobe Experience Manager" in PARTNER_TECHNOLOGIES
        assert "Shopify Plus" in PARTNER_TECHNOLOGIES

    def test_competitor_search_providers_defined(self):
        """Test competitor search providers are properly defined."""
        assert "Elasticsearch" in COMPETITOR_SEARCH_PROVIDERS
        assert "Coveo" in COMPETITOR_SEARCH_PROVIDERS
        assert "Constructor.io" in COMPETITOR_SEARCH_PROVIDERS
        assert "Algolia" in COMPETITOR_SEARCH_PROVIDERS

    def test_algolia_marked_as_own_product(self):
        """Test Algolia is flagged as own product, not competitor."""
        algolia_info = COMPETITOR_SEARCH_PROVIDERS["Algolia"]
        assert algolia_info.get("is_algolia") is True
        assert algolia_info.get("displacement_priority") is None

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
            assert len(result["technologies"]) == 3
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_fetch_data_uses_builtwith_as_primary(
        self, module, valid_builtwith_response
    ):
        """Test fetch_data uses BuiltWith as primary source."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw:
            mock_bw.return_value = valid_builtwith_response

            result = await module.fetch_data("sallybeauty.com")

            mock_bw.assert_called_once_with("sallybeauty.com")
            assert "technologies" in result

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_identifies_partner_tech(self, module):
        """Test transform_data correctly identifies partner technologies."""
        raw_data = {
            "domain": "example.com",
            "technologies": [
                {
                    "name": "Salesforce Commerce Cloud",
                    "category": "E-commerce",
                    "confidence": 0.95,
                },
            ],
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert len(result["partner_technologies"]) == 1
        assert result["partner_technologies"][0]["name"] == "Salesforce Commerce Cloud"
        assert result["partner_technologies"][0]["is_partner_tech"] is True
        assert result["primary_partner"] == "Salesforce Commerce Cloud"
        assert result["ecommerce_platform"] == "Salesforce Commerce Cloud"

    @pytest.mark.asyncio
    async def test_transform_data_identifies_competitor_search(self, module):
        """Test transform_data correctly identifies competitor search providers."""
        raw_data = {
            "domain": "example.com",
            "technologies": [
                {
                    "name": "Elasticsearch",
                    "category": "Search",
                    "confidence": 0.90,
                },
            ],
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert len(result["competitor_technologies"]) == 1
        assert result["competitor_technologies"][0]["name"] == "Elasticsearch"
        assert result["competitor_technologies"][0]["is_competitor_search"] is True
        assert result["current_search_provider"] == "Elasticsearch"
        assert result["displacement_priority"] == "HIGH"

    @pytest.mark.asyncio
    async def test_transform_data_detects_algolia(self, module):
        """Test transform_data correctly detects Algolia usage."""
        raw_data = {
            "domain": "example.com",
            "technologies": [
                {
                    "name": "Algolia",
                    "category": "Search",
                    "confidence": 0.95,
                },
            ],
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["has_algolia"] is True
        # Algolia should NOT be in competitor list
        assert len(result["competitor_technologies"]) == 0

    @pytest.mark.asyncio
    async def test_transform_data_calculates_partner_score(self, module):
        """Test partner score calculation."""
        raw_data = {
            "domain": "example.com",
            "technologies": [
                {"name": "Salesforce Commerce Cloud", "category": "E-commerce"},
                {"name": "Adobe Experience Manager", "category": "CMS"},
            ],
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Both are premium partners with score 10
        assert result["partner_score"] == 20

    # =========================================================================
    # Tech Spend Tier Tests
    # =========================================================================

    def test_get_spend_tier_100k_plus(self, module):
        """Test spend tier for $100K+."""
        assert module._get_spend_tier(150000) == "$100K+"

    def test_get_spend_tier_50k_100k(self, module):
        """Test spend tier for $50K-100K."""
        assert module._get_spend_tier(75000) == "$50K-100K"

    def test_get_spend_tier_25k_50k(self, module):
        """Test spend tier for $25K-50K."""
        assert module._get_spend_tier(35000) == "$25K-50K"

    def test_get_spend_tier_10k_25k(self, module):
        """Test spend tier for $10K-25K."""
        assert module._get_spend_tier(15000) == "$10K-25K"

    def test_get_spend_tier_under_10k(self, module):
        """Test spend tier for under $10K."""
        assert module._get_spend_tier(5000) == "<$10K"

    def test_get_spend_tier_none(self, module):
        """Test spend tier for unknown spend."""
        assert module._get_spend_tier(None) is None

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "technologies": [],
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
                "technologies": [],
                "source_url": "https://builtwith.com/example.com",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.source.date is not None

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "technologies": [],
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
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
                "technologies": [],
                "source_url": "https://builtwith.com/example.com",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module, valid_builtwith_response):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw:
            mock_bw.return_value = valid_builtwith_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m02_technology_stack"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, TechnologyStackData)
            assert result.data.total_technologies == 3
            assert result.data.current_search_provider == "Elasticsearch"
            assert result.data.ecommerce_platform == "Salesforce Commerce Cloud"

            # Verify source citation
            assert result.source is not None
            assert "builtwith.com" in str(result.source.url)

    # =========================================================================
    # TechnologyStackData Model Tests
    # =========================================================================

    def test_technology_stack_data_model_creation(self):
        """Test TechnologyStackData pydantic model creation."""
        data = TechnologyStackData(
            domain="example.com",
            total_technologies=5,
            partner_score=20,
            current_search_provider="Elasticsearch",
            has_algolia=False,
            tech_spend_estimate=100000,
            tech_spend_tier="$100K+",
        )

        assert data.domain == "example.com"
        assert data.total_technologies == 5
        assert data.partner_score == 20
        assert data.current_search_provider == "Elasticsearch"
        assert data.has_algolia is False

    def test_technology_stack_data_with_minimal_fields(self):
        """Test TechnologyStackData with only required fields."""
        data = TechnologyStackData(domain="example.com")

        assert data.domain == "example.com"
        assert data.total_technologies == 0
        assert data.partner_technologies == []
        assert data.competitor_technologies == []
        assert data.has_algolia is False


class TestM02ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M02 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m02_technology_stack")
        assert module_class is not None
        assert module_class.MODULE_ID == "m02_technology_stack"

    def test_module_in_wave_1(self):
        """Test M02 module appears in Wave 1 modules."""
        from app.modules.base import get_modules_by_wave

        wave_1_modules = get_modules_by_wave(1)
        module_ids = [cls.MODULE_ID for cls in wave_1_modules]

        assert "m02_technology_stack" in module_ids
