"""
Unit tests for M02_TechStack Intelligence Module.

Tests the technology stack module which detects technologies for partner matching
and displacement opportunities. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m02_tech_stack import (
    M02TechStackModule,
    TechStackData,
    TechnologyItem,
    SearchProviderInfo,
    SEARCH_PROVIDERS,
    PARTNER_TECHNOLOGIES,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM02TechStackModule:
    """Test suite for M02TechStackModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M02TechStackModule()

    @pytest.fixture
    def valid_builtwith_response(self):
        """Mock BuiltWith API response."""
        return {
            "domain": "sallybeauty.com",
            "technologies": [
                {
                    "name": "Salesforce Commerce Cloud",
                    "category": "ecommerce",
                    "first_detected": "2019-03-15",
                    "last_detected": datetime.now().strftime("%Y-%m-%d"),
                    "confidence": 0.95,
                },
                {
                    "name": "Elasticsearch",
                    "category": "search",
                    "first_detected": "2020-06-01",
                    "last_detected": datetime.now().strftime("%Y-%m-%d"),
                    "confidence": 0.90,
                },
                {
                    "name": "Google Analytics",
                    "category": "analytics",
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
        assert module.MODULE_ID == "m02_tech_stack"

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
    # Search Provider Detection Tests
    # =========================================================================

    def test_search_providers_defined(self):
        """Test search providers are properly defined."""
        assert "algolia" in SEARCH_PROVIDERS
        assert "elasticsearch" in SEARCH_PROVIDERS
        assert "coveo" in SEARCH_PROVIDERS
        assert "constructor.io" in SEARCH_PROVIDERS

    def test_algolia_marked_as_own_product(self):
        """Test Algolia is flagged as own product, not competitor."""
        algolia_info = SEARCH_PROVIDERS["algolia"]
        assert algolia_info.get("is_algolia") is True
        assert algolia_info.get("competitor") is False

    def test_elasticsearch_marked_as_competitor(self):
        """Test Elasticsearch is marked as competitor."""
        es_info = SEARCH_PROVIDERS["elasticsearch"]
        assert es_info.get("is_algolia") is False
        assert es_info.get("competitor") is True

    # =========================================================================
    # Partner Technology Detection Tests
    # =========================================================================

    def test_partner_technologies_defined(self):
        """Test partner technologies are properly defined."""
        assert "shopify plus" in PARTNER_TECHNOLOGIES
        assert "adobe commerce" in PARTNER_TECHNOLOGIES
        assert "salesforce commerce cloud" in PARTNER_TECHNOLOGIES

    def test_partner_technology_tiers(self):
        """Test partner technologies have tier information."""
        shopify_info = PARTNER_TECHNOLOGIES["shopify plus"]
        assert shopify_info.get("partner") == "Shopify"
        assert shopify_info.get("tier") == "Premium"

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
            assert result.module_id == "m02_tech_stack"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, TechStackData)

            # Verify source citation
            assert result.source is not None
            assert "builtwith.com" in str(result.source.url)

    # =========================================================================
    # TechStackData Model Tests
    # =========================================================================

    def test_tech_stack_data_model_creation(self):
        """Test TechStackData pydantic model creation."""
        data = TechStackData(
            domain="example.com",
        )

        assert data.domain == "example.com"
        assert data.technologies == []
        assert data.partner_technologies == []

    def test_technology_item_model(self):
        """Test TechnologyItem model creation."""
        item = TechnologyItem(
            name="Elasticsearch",
            category="search",
            is_competitor_search=True,
            confidence=0.95,
        )

        assert item.name == "Elasticsearch"
        assert item.category == "search"
        assert item.is_competitor_search is True
        assert item.confidence == 0.95


class TestM02ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M02 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m02_tech_stack")
        assert module_class is not None
        assert module_class.MODULE_ID == "m02_tech_stack"

    def test_module_in_wave_1(self):
        """Test M02 module appears in Wave 1 modules."""
        from app.modules.base import get_modules_by_wave

        wave_1_modules = get_modules_by_wave(1)
        module_ids = [cls.MODULE_ID for cls in wave_1_modules]

        assert "m02_tech_stack" in module_ids
