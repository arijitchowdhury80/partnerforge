"""
Unit tests for M05_CompetitorIntelligence Module.

Tests the competitor intelligence module which analyzes competitive landscape
and identifies displacement opportunities. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m05_competitor_intelligence import (
    M05CompetitorIntelligenceModule,
    CompetitorIntelligenceData,
    CompetitorData,
    SearchProviderLandscape,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM05CompetitorIntelligenceModule:
    """Test suite for M05CompetitorIntelligenceModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M05CompetitorIntelligenceModule()

    @pytest.fixture
    def valid_similarweb_response(self):
        """Mock SimilarWeb competitors API response."""
        return {
            "domain": "sallybeauty.com",
            "competitors": [
                {
                    "domain": "sephora.com",
                    "company_name": "Sephora",
                    "similarity_score": 0.78,
                    "monthly_visits": 85000000,
                    "search_provider": "Constructor.io",
                    "tech_overlap": ["SFCC", "Adobe Analytics"],
                },
                {
                    "domain": "ulta.com",
                    "company_name": "Ulta Beauty",
                    "similarity_score": 0.72,
                    "monthly_visits": 45000000,
                    "search_provider": None,
                    "tech_overlap": ["SFCC"],
                },
                {
                    "domain": "competitor3.com",
                    "company_name": "Competitor Three",
                    "similarity_score": 0.65,
                    "monthly_visits": 20000000,
                    "search_provider": "Algolia",
                    "tech_overlap": [],
                },
            ],
            "source_url": "https://www.similarweb.com/website/sallybeauty.com/competitors/",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m05_competitor_intelligence"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Competitor Intelligence"

    def test_module_wave(self, module):
        """Test module is in Wave 2 (Competitive)."""
        assert module.WAVE == 2

    def test_module_has_dependencies(self, module):
        """Test Wave 2 module has correct dependencies."""
        assert "m02_technology_stack" in module.DEPENDS_ON
        assert "m03_traffic_analysis" in module.DEPENDS_ON

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "api"

    # =========================================================================
    # Search Provider Analysis Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_categorizes_search_providers(
        self, module, valid_similarweb_response
    ):
        """Test search provider categorization."""
        result = await module.transform_data(valid_similarweb_response)

        assert "sephora.com" in result["competitors_with_constructor"]
        assert "competitor3.com" in result["competitors_with_algolia"]

    @pytest.mark.asyncio
    async def test_transform_data_detects_first_mover_opportunity(self, module):
        """Test first-mover opportunity detection when no competitor uses Algolia."""
        raw_data = {
            "domain": "example.com",
            "competitors": [
                {"domain": "comp1.com", "search_provider": "Elasticsearch"},
                {"domain": "comp2.com", "search_provider": "Coveo"},
            ],
            "source_url": "https://similarweb.com/example.com/competitors/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["first_mover_opportunity"] is True
        assert len(result["competitors_with_algolia"]) == 0

    @pytest.mark.asyncio
    async def test_transform_data_no_first_mover_when_algolia_exists(self, module):
        """Test no first-mover when competitor uses Algolia."""
        raw_data = {
            "domain": "example.com",
            "competitors": [
                {"domain": "comp1.com", "search_provider": "Algolia"},
            ],
            "source_url": "https://similarweb.com/example.com/competitors/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["first_mover_opportunity"] is False
        assert len(result["competitors_with_algolia"]) == 1

    # =========================================================================
    # Search Landscape Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_builds_search_landscape(
        self, module, valid_similarweb_response
    ):
        """Test search landscape construction."""
        result = await module.transform_data(valid_similarweb_response)

        landscape = result["search_landscape"]
        assert landscape["constructor_users"] == 1
        assert landscape["algolia_users"] == 1
        assert landscape["unknown_users"] == 1  # ulta.com has no search provider

    # =========================================================================
    # Competitive Pressure Tests
    # =========================================================================

    def test_calculate_competitive_pressure_ai_search(self, module):
        """Test competitive pressure increases with AI search adoption."""
        landscape = SearchProviderLandscape(
            algolia_users=2,
            constructor_users=1,
            coveo_users=0,
        )
        competitors = []

        score = module._calculate_competitive_pressure(landscape, competitors)
        # 3 AI search users * 20 = 60 points
        assert score >= 60

    def test_calculate_competitive_pressure_high_traffic_algolia(self, module):
        """Test competitive pressure increases with high-traffic Algolia users."""
        landscape = SearchProviderLandscape(algolia_users=1)
        competitors = [
            CompetitorData(
                domain="comp.com",
                monthly_visits=50000000,
                uses_algolia=True,
            )
        ]

        score = module._calculate_competitive_pressure(landscape, competitors)
        # Algolia user + high traffic = higher pressure
        assert score >= 35

    # =========================================================================
    # Displacement Angle Tests
    # =========================================================================

    def test_determine_displacement_angle_first_mover(self, module):
        """Test displacement angle for first-mover opportunity."""
        landscape = SearchProviderLandscape()

        angle = module._determine_displacement_angle(True, landscape, [])

        assert "first-mover" in angle.lower()
        assert "leader" in angle.lower()

    def test_determine_displacement_angle_elasticsearch(self, module):
        """Test displacement angle when competitors use Elasticsearch."""
        landscape = SearchProviderLandscape(elasticsearch_users=2)

        angle = module._determine_displacement_angle(False, landscape, [])

        assert "elasticsearch" in angle.lower()

    def test_determine_displacement_angle_algolia_catch_up(self, module):
        """Test displacement angle when competitors use Algolia."""
        landscape = SearchProviderLandscape(algolia_users=2)

        angle = module._determine_displacement_angle(False, landscape, [])

        assert "catch-up" in angle.lower() or "competitor" in angle.lower()

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "competitors": [],
                "source_url": "https://similarweb.com/example.com/competitors/",
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
                "competitors": [],
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
                "competitors": [],
                "source_url": "https://similarweb.com/example.com/competitors/",
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
        ) as mock_sw, patch.object(
            module, "_fetch_competitor_tech", new_callable=AsyncMock
        ) as mock_tech:
            mock_sw.return_value = valid_similarweb_response
            mock_tech.return_value = {"search_provider": None, "tech_overlap": []}

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m05_competitor_intelligence"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, CompetitorIntelligenceData)
            assert result.data.competitor_count == 3

            # Verify source citation
            assert result.source is not None
            assert "similarweb.com" in str(result.source.url)

    # =========================================================================
    # CompetitorIntelligenceData Model Tests
    # =========================================================================

    def test_competitor_intelligence_data_model_creation(self):
        """Test CompetitorIntelligenceData pydantic model creation."""
        data = CompetitorIntelligenceData(
            domain="example.com",
            competitor_count=5,
            first_mover_opportunity=True,
            competitive_pressure_score=45,
        )

        assert data.domain == "example.com"
        assert data.competitor_count == 5
        assert data.first_mover_opportunity is True

    def test_competitor_intelligence_data_with_minimal_fields(self):
        """Test CompetitorIntelligenceData with only required fields."""
        data = CompetitorIntelligenceData(domain="example.com")

        assert data.domain == "example.com"
        assert data.competitors == []
        assert data.first_mover_opportunity is False


class TestM05ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M05 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m05_competitor_intelligence")
        assert module_class is not None
        assert module_class.MODULE_ID == "m05_competitor_intelligence"

    def test_module_in_wave_2(self):
        """Test M05 module appears in Wave 2 modules."""
        from app.modules.base import get_modules_by_wave

        wave_2_modules = get_modules_by_wave(2)
        module_ids = [cls.MODULE_ID for cls in wave_2_modules]

        assert "m05_competitor_intelligence" in module_ids
