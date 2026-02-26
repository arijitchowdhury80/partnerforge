"""
Unit tests for M02_TechStack Intelligence Module.

Tests the technology stack module which detects technologies in use
for partner matching and displacement opportunities. Validates source
citation mandate compliance.
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
        """Mock BuiltWith API response with realistic technology data."""
        now = datetime.now()
        return {
            "domain": "sallybeauty.com",
            "technologies": [
                {
                    "name": "Salesforce Commerce Cloud",
                    "category": "ecommerce",
                    "tag": "SFCC",
                    "first_detected": "2019-03-15",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.95
                },
                {
                    "name": "Einstein Search",
                    "category": "search",
                    "tag": "SFCC",
                    "first_detected": "2021-06-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.85
                },
                {
                    "name": "Google Analytics",
                    "category": "analytics",
                    "first_detected": "2015-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.99
                },
                {
                    "name": "Cloudflare",
                    "category": "cdn",
                    "first_detected": "2020-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.98
                }
            ],
            "tech_spend_estimate": 125000,
            "tech_spend_source": "BuiltWith Financial API",
            "source_url": "https://builtwith.com/sallybeauty.com",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def valid_similarweb_response(self):
        """Mock SimilarWeb API response with additional technology data."""
        now = datetime.now()
        return {
            "domain": "sallybeauty.com",
            "technologies": [
                {
                    "name": "Google Tag Manager",
                    "category": "ad_tech",
                    "confidence": 0.90
                },
                {
                    "name": "Facebook Pixel",
                    "category": "ad_tech",
                    "confidence": 0.85
                },
                {
                    "name": "Stripe",
                    "category": "payment",
                    "confidence": 0.80
                }
            ],
            "source_url": "https://www.similarweb.com/website/sallybeauty.com/technologies/",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def algolia_customer_response(self):
        """Mock response for a domain already using Algolia."""
        now = datetime.now()
        return {
            "domain": "algolia-customer.com",
            "technologies": [
                {
                    "name": "Algolia",
                    "category": "search",
                    "first_detected": "2022-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.99
                },
                {
                    "name": "Shopify Plus",
                    "category": "ecommerce",
                    "first_detected": "2020-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.95
                }
            ],
            "source_url": "https://builtwith.com/algolia-customer.com",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def competitor_search_response(self):
        """Mock response for a domain using competitor search."""
        now = datetime.now()
        return {
            "domain": "competitor-user.com",
            "technologies": [
                {
                    "name": "Elasticsearch",
                    "category": "search",
                    "first_detected": "2020-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.92
                },
                {
                    "name": "Adobe Commerce",
                    "category": "ecommerce",
                    "first_detected": "2019-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.95
                }
            ],
            "source_url": "https://builtwith.com/competitor-user.com",
            "source_date": now.isoformat(),
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

    def test_module_cache_ttl(self, module):
        """Test module has appropriate cache TTL (7 days)."""
        assert module.CACHE_TTL == 604800

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
            assert "technologies" in result
            assert len(result["technologies"]) > 0
            assert "source_url" in result
            assert "source_date" in result

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
            assert "technologies" in result
            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_data_merges_sources(
        self, module, valid_builtwith_response, valid_similarweb_response
    ):
        """Test fetch_data properly merges BuiltWith and SimilarWeb data."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_bw.return_value = valid_builtwith_response
            mock_sw.return_value = valid_similarweb_response

            result = await module.fetch_data("sallybeauty.com")

            # Should have data from both sources
            assert "technologies" in result
            # BuiltWith has 4 techs, SimilarWeb has 3 = 7 total (no overlap)
            assert len(result["technologies"]) >= 4

    # =========================================================================
    # Source Merging Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_merge_sources_prioritizes_builtwith(self, module):
        """Test that BuiltWith data takes priority for overlapping fields."""
        builtwith_data = {
            "domain": "example.com",
            "technologies": [
                {"name": "Shopify", "category": "ecommerce", "confidence": 0.95}
            ],
            "tech_spend_estimate": 50000,
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }
        similarweb_data = {
            "domain": "example.com",
            "technologies": [
                {"name": "Shopify", "category": "ecommerce", "confidence": 0.80}
            ],
            "tech_spend_estimate": 40000,  # Lower estimate
            "source_url": "https://similarweb.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(builtwith_data, similarweb_data)

        # BuiltWith should win for overlapping fields
        assert result["tech_spend_estimate"] == 50000
        # BuiltWith source URL should be preserved
        assert "builtwith.com" in result["source_url"]

    @pytest.mark.asyncio
    async def test_merge_sources_combines_unique_technologies(self, module):
        """Test that unique technologies from both sources are included."""
        builtwith_data = {
            "domain": "example.com",
            "technologies": [
                {"name": "Shopify", "category": "ecommerce", "confidence": 0.95}
            ],
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }
        similarweb_data = {
            "domain": "example.com",
            "technologies": [
                {"name": "Stripe", "category": "payment", "confidence": 0.80}
            ],
            "source_url": "https://similarweb.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(builtwith_data, similarweb_data)

        tech_names = [t["name"] for t in result["technologies"]]
        assert "Shopify" in tech_names
        assert "Stripe" in tech_names

    # =========================================================================
    # Technology Processing Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_process_technologies_flags_partner_tech(self, module):
        """Test partner technology detection."""
        technologies = [
            {"name": "Salesforce Commerce Cloud", "category": "ecommerce"},
            {"name": "Adobe Commerce", "category": "ecommerce"},
            {"name": "Shopify Plus", "category": "ecommerce"},
        ]

        result = await module._process_technologies(technologies)

        # All should be flagged as partner technologies
        for tech in result:
            assert tech["is_partner_tech"] is True
            assert tech["partner_name"] is not None

    @pytest.mark.asyncio
    async def test_process_technologies_flags_competitor_search(self, module):
        """Test competitor search provider detection."""
        technologies = [
            {"name": "Elasticsearch", "category": "search"},
            {"name": "Coveo", "category": "search"},
            {"name": "Constructor.io", "category": "search"},
        ]

        result = await module._process_technologies(technologies)

        for tech in result:
            assert tech["is_competitor_search"] is True
            assert tech["competitor_name"] is not None

    @pytest.mark.asyncio
    async def test_process_technologies_does_not_flag_algolia_as_competitor(self, module):
        """Test that Algolia is not flagged as competitor."""
        technologies = [
            {"name": "Algolia", "category": "search"},
        ]

        result = await module._process_technologies(technologies)

        assert result[0]["is_competitor_search"] is False

    # =========================================================================
    # Search Provider Detection Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_identify_search_provider_detects_algolia(self, module):
        """Test Algolia detection."""
        technologies = [
            {"name": "Algolia", "category": "search"},
            {"name": "Shopify", "category": "ecommerce"},
        ]

        result = await module._identify_search_provider(technologies)

        assert result["current"] == "Algolia"
        assert result["is_algolia"] is True
        assert result["is_competitor"] is False
        assert result["displacement_priority"] == "NONE"

    @pytest.mark.asyncio
    async def test_identify_search_provider_detects_elasticsearch(self, module):
        """Test Elasticsearch detection with HIGH displacement priority."""
        technologies = [
            {"name": "Elasticsearch", "category": "search"},
            {"name": "Magento", "category": "ecommerce"},
        ]

        result = await module._identify_search_provider(technologies)

        assert result["current"] == "Elasticsearch"
        assert result["is_algolia"] is False
        assert result["is_competitor"] is True
        assert result["displacement_priority"] == "HIGH"

    @pytest.mark.asyncio
    async def test_identify_search_provider_detects_einstein(self, module):
        """Test Einstein Search detection with MEDIUM displacement priority."""
        technologies = [
            {"name": "Einstein Search", "category": "search"},
            {"name": "Salesforce Commerce Cloud", "category": "ecommerce"},
        ]

        result = await module._identify_search_provider(technologies)

        assert result["current"] == "Salesforce Einstein"
        assert result["native_platform_search"] is True
        assert result["displacement_priority"] == "MEDIUM"

    @pytest.mark.asyncio
    async def test_identify_search_provider_no_search_detected(self, module):
        """Test when no search provider is detected."""
        technologies = [
            {"name": "Shopify", "category": "ecommerce"},
            {"name": "Google Analytics", "category": "analytics"},
        ]

        result = await module._identify_search_provider(technologies)

        assert result["current"] is None
        assert result["is_algolia"] is False
        assert result["displacement_priority"] == "LOW"

    # =========================================================================
    # Partner Technology Detection Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_identify_partner_technologies(self, module):
        """Test partner technology identification."""
        technologies = [
            {
                "name": "Salesforce Commerce Cloud",
                "category": "ecommerce",
                "is_partner_tech": True,
                "partner_name": "Salesforce"
            },
            {
                "name": "Google Analytics",
                "category": "analytics",
                "is_partner_tech": False
            },
            {
                "name": "Adobe Commerce",
                "category": "ecommerce",
                "is_partner_tech": True,
                "partner_name": "Adobe"
            },
        ]

        result = await module._identify_partner_technologies(technologies)

        assert len(result) == 2
        assert "Salesforce Commerce Cloud" in result
        assert "Adobe Commerce" in result

    # =========================================================================
    # Technology Categorization Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_categorize_technologies(self, module):
        """Test technology categorization."""
        technologies = [
            {"name": "Salesforce Commerce Cloud", "category": "ecommerce"},
            {"name": "WordPress", "category": "cms"},
            {"name": "Google Analytics", "category": "analytics"},
            {"name": "Facebook Pixel", "category": "ad_tech"},
            {"name": "Stripe", "category": "payment"},
            {"name": "Cloudflare", "category": "cdn"},
        ]

        result = await module._categorize_technologies(technologies)

        assert result["ecommerce"] == "Salesforce Commerce Cloud"
        assert result["cms"] == "WordPress"
        assert "Google Analytics" in result["analytics"]
        assert "Facebook Pixel" in result["ad_tech"]
        assert "Stripe" in result["payment"]
        assert result["cdn"] == "Cloudflare"

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(self, module):
        """Test transform_data creates data matching TechStackData schema."""
        now = datetime.now()
        raw_data = {
            "domain": "sallybeauty.com",
            "technologies": [
                {
                    "name": "Salesforce Commerce Cloud",
                    "category": "ecommerce",
                    "confidence": 0.95
                },
                {
                    "name": "Einstein Search",
                    "category": "search",
                    "confidence": 0.85
                },
                {
                    "name": "Google Analytics",
                    "category": "analytics",
                    "confidence": 0.99
                }
            ],
            "tech_spend_estimate": 125000,
            "tech_spend_source": "BuiltWith Financial API",
            "source_url": "https://builtwith.com/sallybeauty.com",
            "source_date": now.isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "sallybeauty.com"
        assert len(result["technologies"]) == 3
        assert result["ecommerce_platform"] == "Salesforce Commerce Cloud"
        assert "Google Analytics" in result["analytics_tools"]
        assert result["tech_spend_estimate"] == 125000

    @pytest.mark.asyncio
    async def test_transform_data_handles_missing_fields(self, module):
        """Test transform_data handles missing optional fields gracefully."""
        raw_data = {
            "domain": "example.com",
            "technologies": [],
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "example.com"
        assert result["technologies"] == []
        assert result.get("cms") is None
        assert result.get("ecommerce_platform") is None
        assert result.get("analytics_tools") == []

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
            # Date should be within last minute (accounting for test execution time)
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            # Return data without source_url
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
        stale_date = datetime.now() - timedelta(days=400)  # 13+ months old

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
    # Validation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_validate_and_store_creates_model(self, module):
        """Test _validate_and_store creates a proper TechStackData model."""
        transformed_data = {
            "domain": "sallybeauty.com",
            "technologies": [
                {
                    "name": "Salesforce Commerce Cloud",
                    "category": "ecommerce",
                    "is_partner_tech": True,
                    "partner_name": "Salesforce",
                    "partner_tier": "Premium",
                    "is_competitor_search": False,
                    "competitor_name": None,
                    "confidence": 0.95
                }
            ],
            "search_provider": {
                "current": "Einstein Search",
                "is_algolia": False,
                "is_competitor": True,
                "displacement_priority": "MEDIUM",
                "native_platform_search": True
            },
            "partner_technologies": ["Salesforce Commerce Cloud"],
            "cms": None,
            "ecommerce_platform": "Salesforce Commerce Cloud",
            "analytics_tools": ["Google Analytics"],
            "ad_tech": [],
            "payment_providers": [],
            "cdn": "Cloudflare",
            "tech_spend_estimate": 125000,
            "tech_spend_source": "BuiltWith",
            "all_technologies": ["Salesforce Commerce Cloud", "Google Analytics", "Cloudflare"],
        }

        result = await module._validate_and_store("sallybeauty.com", transformed_data)

        assert isinstance(result, TechStackData)
        assert result.domain == "sallybeauty.com"
        assert result.ecommerce_platform == "Salesforce Commerce Cloud"
        assert len(result.technologies) == 1

    @pytest.mark.asyncio
    async def test_validate_and_store_validates_domain_match(self, module):
        """Test domain in data must match requested domain."""
        transformed_data = {
            "domain": "wrongdomain.com",  # Mismatch!
            "technologies": [],
            "search_provider": {},
            "partner_technologies": [],
            "all_technologies": [],
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_store("example.com", transformed_data)

        assert "domain" in str(exc_info.value).lower()

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module, valid_builtwith_response, valid_similarweb_response):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_bw.return_value = valid_builtwith_response
            mock_sw.return_value = valid_similarweb_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m02_tech_stack"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, TechStackData)
            assert result.data.ecommerce_platform == "Salesforce Commerce Cloud"
            assert "Google Analytics" in result.data.analytics_tools

            # Verify source citation
            assert result.source is not None
            assert "builtwith.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_detects_displacement_opportunity(
        self, module, competitor_search_response
    ):
        """Test enrichment correctly identifies displacement opportunity."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_bw.return_value = competitor_search_response
            mock_sw.return_value = {"technologies": []}

            result = await module.enrich("competitor-user.com")

            assert result.data.search_provider.current == "Elasticsearch"
            assert result.data.search_provider.is_competitor is True
            assert result.data.search_provider.displacement_priority == "HIGH"
            assert result.data.search_provider.is_algolia is False

    @pytest.mark.asyncio
    async def test_enrich_detects_algolia_customer(self, module, algolia_customer_response):
        """Test enrichment correctly identifies existing Algolia customer."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_bw.return_value = algolia_customer_response
            mock_sw.return_value = {"technologies": []}

            result = await module.enrich("algolia-customer.com")

            assert result.data.search_provider.current == "Algolia"
            assert result.data.search_provider.is_algolia is True
            assert result.data.search_provider.displacement_priority == "NONE"

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
                    "technologies": [],
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
    async def test_handles_builtwith_api_failure(self, module, valid_similarweb_response):
        """Test graceful handling when BuiltWith API fails."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            # BuiltWith fails
            mock_bw.side_effect = Exception("BuiltWith API timeout")

            # SimilarWeb succeeds
            mock_sw.return_value = {
                "domain": "example.com",
                "technologies": [
                    {"name": "Stripe", "category": "payment"}
                ],
                "source_url": "https://similarweb.com/example.com",
                "source_date": datetime.now().isoformat(),
            }

            # Should still work with SimilarWeb fallback
            result = await module.enrich("example.com")

            assert result.data.domain == "example.com"
            assert "Stripe" in result.data.all_technologies

    @pytest.mark.asyncio
    async def test_fails_when_all_sources_fail(self, module):
        """Test appropriate error when all data sources fail."""
        with patch.object(
            module, "_fetch_from_builtwith", new_callable=AsyncMock
        ) as mock_bw, patch.object(
            module, "_fetch_from_similarweb", new_callable=AsyncMock
        ) as mock_sw:
            mock_bw.side_effect = Exception("BuiltWith API timeout")
            mock_sw.side_effect = Exception("SimilarWeb API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("example.com")

            # Should indicate enrichment failure
            assert "enrich" in str(exc_info.value).lower() or "fail" in str(exc_info.value).lower()

    # =========================================================================
    # Data Model Tests
    # =========================================================================

    def test_technology_item_model_creation(self):
        """Test TechnologyItem pydantic model creation."""
        tech = TechnologyItem(
            name="Salesforce Commerce Cloud",
            category="ecommerce",
            tag="SFCC",
            is_partner_tech=True,
            partner_name="Salesforce",
            partner_tier="Premium",
            is_competitor_search=False,
            confidence=0.95
        )

        assert tech.name == "Salesforce Commerce Cloud"
        assert tech.category == "ecommerce"
        assert tech.is_partner_tech is True
        assert tech.partner_name == "Salesforce"

    def test_search_provider_info_model_creation(self):
        """Test SearchProviderInfo pydantic model creation."""
        info = SearchProviderInfo(
            current="Einstein Search",
            is_algolia=False,
            is_competitor=True,
            displacement_priority="MEDIUM",
            native_platform_search=True
        )

        assert info.current == "Einstein Search"
        assert info.is_algolia is False
        assert info.displacement_priority == "MEDIUM"

    def test_tech_stack_data_model_creation(self):
        """Test TechStackData pydantic model creation."""
        data = TechStackData(
            domain="example.com",
            technologies=[
                TechnologyItem(
                    name="Shopify",
                    category="ecommerce",
                    is_partner_tech=True,
                    partner_name="Shopify"
                )
            ],
            search_provider=SearchProviderInfo(
                current=None,
                is_algolia=False,
                displacement_priority="LOW"
            ),
            partner_technologies=["Shopify"],
            ecommerce_platform="Shopify",
            all_technologies=["Shopify"]
        )

        assert data.domain == "example.com"
        assert len(data.technologies) == 1
        assert data.ecommerce_platform == "Shopify"

    def test_tech_stack_data_with_minimal_fields(self):
        """Test TechStackData with only required fields."""
        data = TechStackData(domain="example.com")

        assert data.domain == "example.com"
        assert data.technologies == []
        assert data.search_provider.current is None
        assert data.partner_technologies == []
        assert data.all_technologies == []

    def test_tech_stack_data_model_dump(self):
        """Test TechStackData can be serialized."""
        data = TechStackData(
            domain="example.com",
            ecommerce_platform="Shopify",
            tech_spend_estimate=50000,
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["tech_spend_estimate"] == 50000


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


class TestSearchProviderConstants:
    """Test search provider and partner technology constants."""

    def test_search_providers_includes_key_competitors(self):
        """Test all major search competitors are included."""
        assert "elasticsearch" in SEARCH_PROVIDERS
        assert "coveo" in SEARCH_PROVIDERS
        assert "searchspring" in SEARCH_PROVIDERS
        assert "klevu" in SEARCH_PROVIDERS
        assert "constructor.io" in SEARCH_PROVIDERS
        assert "algolia" in SEARCH_PROVIDERS

    def test_algolia_not_flagged_as_competitor(self):
        """Test Algolia is not flagged as competitor."""
        assert SEARCH_PROVIDERS["algolia"]["is_algolia"] is True
        assert SEARCH_PROVIDERS["algolia"]["competitor"] is False

    def test_partner_technologies_includes_key_partners(self):
        """Test all major partner technologies are included."""
        assert "shopify plus" in PARTNER_TECHNOLOGIES
        assert "adobe commerce" in PARTNER_TECHNOLOGIES
        assert "salesforce commerce cloud" in PARTNER_TECHNOLOGIES
        assert "commercetools" in PARTNER_TECHNOLOGIES
        assert "contentful" in PARTNER_TECHNOLOGIES

    def test_partner_tier_assignments(self):
        """Test partner tier assignments are correct."""
        assert PARTNER_TECHNOLOGIES["shopify plus"]["tier"] == "Premium"
        assert PARTNER_TECHNOLOGIES["shopify"]["tier"] == "Standard"
        assert PARTNER_TECHNOLOGIES["adobe commerce"]["tier"] == "Premium"
