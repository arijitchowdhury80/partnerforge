"""
Unit tests for M11_Displacement Intelligence Module.

Tests the displacement analysis module which analyzes the opportunity to
displace current search provider with Algolia. Validates source citation
mandate compliance and synthesis from M02 dependency.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m11_displacement import (
    M11DisplacementModule,
    DisplacementAnalysisData,
    PROVIDER_WEAKNESSES,
    ALGOLIA_ADVANTAGES,
    MIGRATION_COMPLEXITY,
    DISPLACEMENT_DIFFICULTY,
)
from app.modules.base import ModuleResult
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM11DisplacementModule:
    """Test suite for M11DisplacementModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M11DisplacementModule()

    @pytest.fixture
    def mock_m02_elasticsearch_result(self):
        """Mock M02 result with Elasticsearch as search provider."""
        # Use MagicMock to simulate ModuleResult without Pydantic validation issues
        mock_result = MagicMock()
        mock_result.module_id = "m02_tech_stack"
        mock_result.domain = "costco.com"
        mock_result.data = {
            "domain": "costco.com",
            "current_search_provider": "Elasticsearch",
            "has_algolia": False,
            "displacement_priority": "HIGH",
            "ecommerce_platform": "Salesforce Commerce Cloud",
            "cms_platform": None,
            "tech_spend_estimate": 150000,
        }
        mock_result.source = MagicMock()
        mock_result.source.url = "https://builtwith.com/costco.com"
        mock_result.source.date = datetime.now()
        mock_result.source.type = "api"
        return mock_result

    @pytest.fixture
    def mock_m02_solr_result(self):
        """Mock M02 result with Solr as search provider."""
        # Use MagicMock to simulate ModuleResult without Pydantic validation issues
        mock_result = MagicMock()
        mock_result.module_id = "m02_tech_stack"
        mock_result.domain = "legacy-retailer.com"
        mock_result.data = {
            "domain": "legacy-retailer.com",
            "current_search_provider": "Apache Solr",
            "has_algolia": False,
            "displacement_priority": "MEDIUM",
            "ecommerce_platform": "Magento",
            "cms_platform": None,
            "tech_spend_estimate": 75000,
        }
        mock_result.source = MagicMock()
        mock_result.source.url = "https://builtwith.com/legacy-retailer.com"
        mock_result.source.date = datetime.now()
        mock_result.source.type = "api"
        return mock_result

    @pytest.fixture
    def mock_m02_native_result(self):
        """Mock M02 result with no search provider (native/none)."""
        # Use MagicMock to simulate ModuleResult without Pydantic validation issues
        mock_result = MagicMock()
        mock_result.module_id = "m02_tech_stack"
        mock_result.domain = "no-search.com"
        mock_result.data = {
            "domain": "no-search.com",
            "current_search_provider": None,
            "has_algolia": False,
            "displacement_priority": None,
            "ecommerce_platform": "Shopify",
            "cms_platform": None,
            "tech_spend_estimate": 25000,
        }
        mock_result.source = MagicMock()
        mock_result.source.url = "https://builtwith.com/no-search.com"
        mock_result.source.date = datetime.now()
        mock_result.source.type = "api"
        return mock_result

    @pytest.fixture
    def mock_m02_algolia_result(self):
        """Mock M02 result where company already uses Algolia."""
        # Use MagicMock to simulate ModuleResult without Pydantic validation issues
        mock_result = MagicMock()
        mock_result.module_id = "m02_tech_stack"
        mock_result.domain = "algolia-customer.com"
        mock_result.data = {
            "domain": "algolia-customer.com",
            "current_search_provider": "Algolia",
            "has_algolia": True,
            "displacement_priority": None,
            "ecommerce_platform": "Shopify Plus",
            "cms_platform": None,
            "tech_spend_estimate": 100000,
        }
        mock_result.source = MagicMock()
        mock_result.source.url = "https://builtwith.com/algolia-customer.com"
        mock_result.source.date = datetime.now()
        mock_result.source.type = "api"
        return mock_result

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m11_displacement"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Displacement Analysis"

    def test_module_wave(self, module):
        """Test module is in Wave 3."""
        assert module.WAVE == 3

    def test_module_depends_on_m02(self, module):
        """Test module depends on M02 Technology Stack."""
        assert "m02_tech_stack" in module.DEPENDS_ON

    def test_module_source_type(self, module):
        """Test module has synthesis source type."""
        assert module.SOURCE_TYPE == "synthesis"

    def test_module_cache_ttl(self, module):
        """Test module has 7-day cache TTL."""
        assert module.CACHE_TTL == 604800  # 7 days in seconds

    # =========================================================================
    # Provider Knowledge Base Tests
    # =========================================================================

    def test_provider_weaknesses_contains_elasticsearch(self):
        """Test Elasticsearch weaknesses are defined."""
        assert "Elasticsearch" in PROVIDER_WEAKNESSES
        assert len(PROVIDER_WEAKNESSES["Elasticsearch"]) >= 5

    def test_provider_weaknesses_contains_solr(self):
        """Test Solr weaknesses are defined."""
        assert "Solr" in PROVIDER_WEAKNESSES
        assert "Apache Solr" in PROVIDER_WEAKNESSES

    def test_provider_weaknesses_contains_native(self):
        """Test Native/None weaknesses are defined."""
        assert "Native" in PROVIDER_WEAKNESSES
        assert "None" in PROVIDER_WEAKNESSES

    def test_algolia_advantages_defined_for_all_providers(self):
        """Test Algolia advantages exist for all providers in weaknesses."""
        for provider in PROVIDER_WEAKNESSES:
            assert provider in ALGOLIA_ADVANTAGES, f"Missing advantages for {provider}"

    def test_migration_complexity_values(self):
        """Test migration complexity uses valid values."""
        valid_values = {"easy", "medium", "hard"}
        for provider, complexity in MIGRATION_COMPLEXITY.items():
            assert complexity in valid_values, f"Invalid complexity for {provider}: {complexity}"

    def test_displacement_difficulty_values(self):
        """Test displacement difficulty uses valid values."""
        valid_values = {"easy", "medium", "hard"}
        for provider, difficulty in DISPLACEMENT_DIFFICULTY.items():
            assert difficulty in valid_values, f"Invalid difficulty for {provider}: {difficulty}"

    # =========================================================================
    # Provider Normalization Tests
    # =========================================================================

    def test_normalize_elasticsearch_variations(self, module):
        """Test normalization handles Elasticsearch variations."""
        assert module._normalize_provider_name("Elasticsearch") == "Elasticsearch"
        assert module._normalize_provider_name("elasticsearch") == "Elasticsearch"
        assert module._normalize_provider_name("Elastic") == "Elasticsearch"
        assert module._normalize_provider_name("elastic search") == "Elasticsearch"

    def test_normalize_solr_variations(self, module):
        """Test normalization handles Solr variations."""
        assert module._normalize_provider_name("Solr") == "Solr"
        assert module._normalize_provider_name("Apache Solr") == "Solr"
        assert module._normalize_provider_name("apache solr") == "Solr"

    def test_normalize_constructor_variations(self, module):
        """Test normalization handles Constructor.io variations."""
        assert module._normalize_provider_name("Constructor.io") == "Constructor.io"
        assert module._normalize_provider_name("constructor") == "Constructor.io"
        assert module._normalize_provider_name("Constructor") == "Constructor.io"

    def test_normalize_unknown_provider(self, module):
        """Test normalization handles unknown providers."""
        assert module._normalize_provider_name("UnknownSearch") == "Native"

    def test_normalize_none_provider(self, module):
        """Test normalization handles None/empty."""
        assert module._normalize_provider_name(None) == "None"
        assert module._normalize_provider_name("") == "None"

    # =========================================================================
    # Dependency Extraction Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_extract_from_dependencies_elasticsearch(
        self, module, mock_m02_elasticsearch_result
    ):
        """Test extracting data from M02 Elasticsearch result."""
        result = await module._extract_from_dependencies(
            "costco.com", mock_m02_elasticsearch_result
        )

        assert result["domain"] == "costco.com"
        assert result["current_search_provider"] == "Elasticsearch"
        assert result["has_search"] is True
        assert result["tech_spend_estimate"] == 150000
        assert result["has_algolia"] is False
        assert "source_url" in result
        assert "source_date" in result

    @pytest.mark.asyncio
    async def test_extract_from_dependencies_no_search(
        self, module, mock_m02_native_result
    ):
        """Test extracting data when no search provider."""
        result = await module._extract_from_dependencies(
            "no-search.com", mock_m02_native_result
        )

        assert result["domain"] == "no-search.com"
        assert result["current_search_provider"] is None
        assert result["has_search"] is False

    # =========================================================================
    # Transform Data Tests - Elasticsearch
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_elasticsearch_provider(self, module):
        """Test transformation for Elasticsearch provider."""
        raw_data = {
            "domain": "costco.com",
            "current_search_provider": "Elasticsearch",
            "has_search": True,
            "tech_spend_estimate": 150000,
            "source_url": "https://builtwith.com/costco.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["current_search_provider"] == "Elasticsearch"
        assert len(result["provider_weaknesses"]) > 0
        assert len(result["algolia_advantages"]) > 0
        assert result["displacement_difficulty"] == "medium"
        assert result["migration_complexity"] == "medium"
        assert result["roi_potential"] == "high"
        assert "DevOps" in result["recommended_approach"]

    @pytest.mark.asyncio
    async def test_elasticsearch_weaknesses_in_output(self, module):
        """Test Elasticsearch-specific weaknesses appear in output."""
        raw_data = {
            "domain": "test.com",
            "current_search_provider": "Elasticsearch",
            "has_search": True,
            "source_url": "https://builtwith.com/test.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        weaknesses_text = " ".join(result["provider_weaknesses"])
        assert "DevOps" in weaknesses_text or "operational" in weaknesses_text.lower()

    # =========================================================================
    # Transform Data Tests - Solr
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_solr_provider(self, module):
        """Test transformation for Solr provider."""
        raw_data = {
            "domain": "legacy.com",
            "current_search_provider": "Solr",
            "has_search": True,
            "tech_spend_estimate": 50000,
            "source_url": "https://builtwith.com/legacy.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["displacement_difficulty"] == "easy"
        assert result["roi_potential"] == "high"
        assert "modernization" in result["recommended_approach"].lower()

    @pytest.mark.asyncio
    async def test_solr_conversion_lift(self, module):
        """Test Solr estimated conversion lift."""
        raw_data = {
            "domain": "test.com",
            "current_search_provider": "Apache Solr",
            "has_search": True,
            "source_url": "https://builtwith.com/test.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["estimated_conversion_lift"] == "10-20%"

    # =========================================================================
    # Transform Data Tests - Native/None
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_native_provider(self, module):
        """Test transformation for native/no search."""
        raw_data = {
            "domain": "no-search.com",
            "current_search_provider": None,
            "has_search": False,
            "tech_spend_estimate": 25000,
            "source_url": "https://builtwith.com/no-search.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["displacement_difficulty"] == "easy"
        assert result["roi_potential"] == "high"
        assert result["estimated_conversion_lift"] == "15-30%"
        assert "Greenfield" in result["recommended_approach"]

    @pytest.mark.asyncio
    async def test_native_talking_points(self, module):
        """Test talking points for native/no search."""
        raw_data = {
            "domain": "test.com",
            "current_search_provider": None,
            "has_search": False,
            "source_url": "https://builtwith.com/test.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        talking_points_text = " ".join(result["key_talking_points"])
        assert "15-30%" in talking_points_text or "conversion" in talking_points_text.lower()

    # =========================================================================
    # Transform Data Tests - Algolia Customer
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_algolia_customer(self, module):
        """Test transformation for existing Algolia customer."""
        raw_data = {
            "domain": "algolia-customer.com",
            "current_search_provider": "Algolia",
            "has_search": True,
            "has_algolia": True,
            "source_url": "https://builtwith.com/algolia-customer.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["current_search_provider"] == "Algolia"
        assert result["displacement_difficulty"] == "n/a"
        assert result["migration_complexity"] == "n/a"
        assert result["roi_potential"] == "n/a"
        assert "expansion" in result["recommended_approach"].lower() or "upsell" in result["recommended_approach"].lower()
        assert len(result["provider_weaknesses"]) == 0
        assert result["competitive_threat_level"] == "low"

    # =========================================================================
    # Transform Data Tests - High Threat Competitors
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_constructor_provider(self, module):
        """Test transformation for Constructor.io (high threat)."""
        raw_data = {
            "domain": "constructor-customer.com",
            "current_search_provider": "Constructor.io",
            "has_search": True,
            "tech_spend_estimate": 200000,
            "source_url": "https://builtwith.com/constructor-customer.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["displacement_difficulty"] == "hard"
        assert result["competitive_threat_level"] == "high"
        assert "incumbent" in " ".join(result["risk_factors"]).lower()

    @pytest.mark.asyncio
    async def test_transform_bloomreach_provider(self, module):
        """Test transformation for Bloomreach (high threat)."""
        raw_data = {
            "domain": "bloomreach-customer.com",
            "current_search_provider": "Bloomreach",
            "has_search": True,
            "source_url": "https://builtwith.com/bloomreach-customer.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["displacement_difficulty"] == "hard"
        assert result["migration_complexity"] == "hard"
        assert result["competitive_threat_level"] == "high"

    # =========================================================================
    # ROI Calculation Tests
    # =========================================================================

    def test_roi_potential_high_for_self_managed(self, module):
        """Test high ROI potential for self-managed search."""
        high_roi_providers = ["Elasticsearch", "OpenSearch", "Solr", "Native", "None"]

        for provider in high_roi_providers:
            roi = module._calculate_roi_potential(provider, 100000)
            assert roi == "high", f"Expected high ROI for {provider}"

    def test_roi_potential_medium_for_saas(self, module):
        """Test medium ROI potential for SaaS competitors."""
        medium_roi_providers = ["Searchspring", "Klevu", "Yext"]

        for provider in medium_roi_providers:
            roi = module._calculate_roi_potential(provider, 50000)
            assert roi == "medium", f"Expected medium ROI for {provider}"

    def test_roi_potential_considers_spend(self, module):
        """Test ROI potential considers tech spend for low-priority providers."""
        # Constructor with high spend should still be medium ROI
        roi = module._calculate_roi_potential("Constructor.io", 150000)
        assert roi == "medium"

        # Constructor with low spend should be low ROI
        roi = module._calculate_roi_potential("Constructor.io", 50000)
        assert roi == "low"

    # =========================================================================
    # Risk Factor Tests
    # =========================================================================

    def test_risk_factors_for_constructor(self, module):
        """Test risk factors for Constructor.io."""
        risks = module._identify_risk_factors("Constructor.io", 100000)

        assert any("incumbent" in r.lower() for r in risks)

    def test_risk_factors_for_elasticsearch(self, module):
        """Test risk factors for Elasticsearch."""
        risks = module._identify_risk_factors("Elasticsearch", 100000)

        assert any("expertise" in r.lower() for r in risks)

    def test_risk_factors_for_high_spend(self, module):
        """Test risk factors include switching cost for high spend."""
        risks = module._identify_risk_factors("Searchspring", 250000)

        assert any("switching" in r.lower() or "investment" in r.lower() for r in risks)

    def test_risk_factors_always_include_universal(self, module):
        """Test universal risk factors always included."""
        risks = module._identify_risk_factors("Native", 10000)

        assert any("budget" in r.lower() for r in risks)
        assert any("priorities" in r.lower() for r in risks)

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module, mock_m02_elasticsearch_result):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        result = await module.enrich(
            "costco.com",
            dependencies={"m02_tech_stack": mock_m02_elasticsearch_result}
        )

        assert isinstance(result, ModuleResult)
        assert result.source is not None
        assert "builtwith.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module, mock_m02_elasticsearch_result):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        result = await module.enrich(
            "costco.com",
            dependencies={"m02_tech_stack": mock_m02_elasticsearch_result}
        )

        assert result.source.date is not None
        # Date should be within last minute
        assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "test.com",
                "current_search_provider": "Elasticsearch",
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("test.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "test.com",
                "current_search_provider": "Elasticsearch",
                "source_url": "https://builtwith.com/test.com",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("test.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Full Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline_elasticsearch(
        self, module, mock_m02_elasticsearch_result
    ):
        """Test complete enrichment pipeline for Elasticsearch target."""
        result = await module.enrich(
            "costco.com",
            dependencies={"m02_tech_stack": mock_m02_elasticsearch_result}
        )

        # Verify result structure
        assert isinstance(result, ModuleResult)
        assert result.module_id == "m11_displacement"
        assert result.domain == "costco.com"

        # Verify data
        assert isinstance(result.data, DisplacementAnalysisData)
        assert result.data.current_search_provider == "Elasticsearch"
        assert result.data.displacement_difficulty == "medium"
        assert result.data.roi_potential == "high"
        assert len(result.data.provider_weaknesses) > 0
        assert len(result.data.algolia_advantages) > 0
        assert len(result.data.key_talking_points) > 0

        # Verify source citation
        assert result.source is not None
        assert result.source.type == "synthesis"

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline_solr(
        self, module, mock_m02_solr_result
    ):
        """Test complete enrichment pipeline for Solr target."""
        result = await module.enrich(
            "legacy-retailer.com",
            dependencies={"m02_tech_stack": mock_m02_solr_result}
        )

        assert result.data.current_search_provider == "Apache Solr"
        assert result.data.displacement_difficulty == "easy"
        assert "modernization" in result.data.recommended_approach.lower()

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline_native(
        self, module, mock_m02_native_result
    ):
        """Test complete enrichment pipeline for native/no search."""
        result = await module.enrich(
            "no-search.com",
            dependencies={"m02_tech_stack": mock_m02_native_result}
        )

        assert result.data.current_search_provider is None
        assert result.data.has_search is False
        assert result.data.displacement_difficulty == "easy"
        assert result.data.estimated_conversion_lift == "15-30%"

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline_algolia_customer(
        self, module, mock_m02_algolia_result
    ):
        """Test complete enrichment pipeline for existing Algolia customer."""
        result = await module.enrich(
            "algolia-customer.com",
            dependencies={"m02_tech_stack": mock_m02_algolia_result}
        )

        assert result.data.current_search_provider == "Algolia"
        assert result.data.displacement_difficulty == "n/a"
        assert "upsell" in result.data.recommended_approach.lower() or "expansion" in result.data.recommended_approach.lower()

    @pytest.mark.asyncio
    async def test_enrich_without_dependencies(self, module):
        """Test enrichment falls back to fetch_data when no dependencies."""
        result = await module.enrich("fallback-test.com")

        # Should still produce valid result using mock fetch
        assert isinstance(result, ModuleResult)
        assert result.data.domain == "fallback-test.com"
        assert result.source is not None

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(
        self, module, mock_m02_elasticsearch_result
    ):
        """Test force=True bypasses cache."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()  # Would return cached data

            result = await module.enrich(
                "costco.com",
                force=True,
                dependencies={"m02_tech_stack": mock_m02_elasticsearch_result}
            )

            # Cache should not be checked
            mock_cache.assert_not_called()

    # =========================================================================
    # Validation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_validate_and_store_creates_model(self, module):
        """Test _validate_and_store creates proper model."""
        transformed_data = {
            "domain": "test.com",
            "current_search_provider": "Elasticsearch",
            "has_search": True,
            "provider_weaknesses": ["High operational complexity"],
            "algolia_advantages": ["Zero DevOps overhead"],
            "displacement_difficulty": "medium",
            "migration_complexity": "medium",
            "roi_potential": "high",
            "estimated_conversion_lift": "5-15%",
            "recommended_approach": "Lead with TCO analysis",
            "key_talking_points": ["DevOps savings"],
            "risk_factors": ["Existing expertise"],
            "competitive_threat_level": "medium",
        }

        result = await module._validate_and_store("test.com", transformed_data)

        assert isinstance(result, DisplacementAnalysisData)
        assert result.domain == "test.com"
        assert result.displacement_difficulty == "medium"
        assert len(result.provider_weaknesses) == 1

    @pytest.mark.asyncio
    async def test_validate_and_store_domain_mismatch(self, module):
        """Test domain mismatch raises error."""
        transformed_data = {
            "domain": "wrong-domain.com",
            "current_search_provider": "Elasticsearch",
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_store("correct-domain.com", transformed_data)

        assert "domain" in str(exc_info.value).lower()

    # =========================================================================
    # DisplacementAnalysisData Model Tests
    # =========================================================================

    def test_displacement_data_model_creation(self):
        """Test DisplacementAnalysisData model creation."""
        data = DisplacementAnalysisData(
            domain="test.com",
            current_search_provider="Elasticsearch",
            has_search=True,
            provider_weaknesses=["High operational complexity"],
            algolia_advantages=["Zero DevOps overhead"],
            displacement_difficulty="medium",
            migration_complexity="medium",
            roi_potential="high",
            estimated_conversion_lift="5-15%",
            recommended_approach="Lead with TCO analysis",
            key_talking_points=["DevOps savings", "Faster queries"],
            risk_factors=["Existing expertise on team"],
            competitive_threat_level="medium",
        )

        assert data.domain == "test.com"
        assert data.displacement_difficulty == "medium"
        assert len(data.provider_weaknesses) == 1
        assert len(data.key_talking_points) == 2

    def test_displacement_data_with_minimal_fields(self):
        """Test DisplacementAnalysisData with only required fields."""
        data = DisplacementAnalysisData(domain="test.com")

        assert data.domain == "test.com"
        assert data.current_search_provider is None
        assert data.has_search is True
        assert data.provider_weaknesses == []
        assert data.displacement_difficulty == "medium"
        assert data.recommended_approach == ""

    def test_displacement_data_model_dump(self):
        """Test DisplacementAnalysisData can be serialized."""
        data = DisplacementAnalysisData(
            domain="test.com",
            current_search_provider="Solr",
            displacement_difficulty="easy",
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "test.com"
        assert dumped["displacement_difficulty"] == "easy"


class TestM11ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M11 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m11_displacement")
        assert module_class is not None
        assert module_class.MODULE_ID == "m11_displacement"

    def test_module_in_wave_3(self):
        """Test M11 module appears in Wave 3 modules."""
        from app.modules.base import get_modules_by_wave

        wave_3_modules = get_modules_by_wave(3)
        module_ids = [cls.MODULE_ID for cls in wave_3_modules]

        assert "m11_displacement" in module_ids


class TestProviderKnowledgeBaseCompleteness:
    """Test completeness of provider knowledge base."""

    def test_all_providers_have_weaknesses(self):
        """Test all expected providers have weaknesses defined."""
        expected_providers = [
            "Elasticsearch", "Solr", "OpenSearch", "Coveo",
            "Searchspring", "Klevu", "Constructor.io", "Bloomreach",
            "Lucidworks", "Yext", "Swiftype", "Doofinder", "Native", "None"
        ]

        for provider in expected_providers:
            assert provider in PROVIDER_WEAKNESSES, f"Missing weaknesses for {provider}"
            assert len(PROVIDER_WEAKNESSES[provider]) >= 3, f"Need at least 3 weaknesses for {provider}"

    def test_all_providers_have_advantages(self):
        """Test all expected providers have Algolia advantages defined."""
        expected_providers = [
            "Elasticsearch", "Solr", "OpenSearch", "Coveo",
            "Searchspring", "Klevu", "Constructor.io", "Bloomreach",
            "Native", "None"
        ]

        for provider in expected_providers:
            assert provider in ALGOLIA_ADVANTAGES, f"Missing advantages for {provider}"
            assert len(ALGOLIA_ADVANTAGES[provider]) >= 3, f"Need at least 3 advantages for {provider}"

    def test_migration_complexity_covers_all(self):
        """Test migration complexity defined for all providers."""
        for provider in PROVIDER_WEAKNESSES:
            assert provider in MIGRATION_COMPLEXITY, f"Missing migration complexity for {provider}"

    def test_displacement_difficulty_covers_all(self):
        """Test displacement difficulty defined for all providers."""
        for provider in PROVIDER_WEAKNESSES:
            assert provider in DISPLACEMENT_DIFFICULTY, f"Missing displacement difficulty for {provider}"
