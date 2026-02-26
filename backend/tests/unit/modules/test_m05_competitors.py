"""
Unit tests for M05_CompetitorIntelligence Module.

Tests the competitor intelligence module which identifies competitors
and analyzes their search technology. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m05_competitors import (
    M05CompetitorIntelligenceModule,
    CompetitorIntelligenceData,
    CompetitorSite,
    SearchProviderInfo,
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
        """Mock SimilarWeb similar-sites API response."""
        return {
            "domain": "sallybeauty.com",
            "similar_sites": [
                {
                    "domain": "ulta.com",
                    "similarity_score": 0.89,
                    "rank": 1500,
                    "category": "Beauty & Cosmetics"
                },
                {
                    "domain": "sephora.com",
                    "similarity_score": 0.85,
                    "rank": 800,
                    "category": "Beauty & Cosmetics"
                },
                {
                    "domain": "dermstore.com",
                    "similarity_score": 0.72,
                    "rank": 5000,
                    "category": "Beauty & Cosmetics"
                },
            ],
            "source_url": "https://api.similarweb.com/v1/website/sallybeauty.com/similar-sites",
            "source_date": datetime.now().isoformat(),
        }

    @pytest.fixture
    def valid_builtwith_response(self):
        """Mock BuiltWith response with search provider detection."""
        return {
            "competitor_search_providers": {
                "ulta.com": "Elasticsearch",
                "sephora.com": "Algolia",
                "dermstore.com": "SearchSpring",
            },
            "source_url": "https://api.builtwith.com/v21/api.json",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m05_competitors"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Competitor Intelligence"

    def test_module_wave(self, module):
        """Test module is in Wave 2 (Competitive)."""
        assert module.WAVE == 2

    def test_module_has_dependencies(self, module):
        """Test Wave 2 module depends on M02 and M03."""
        assert "m02_tech_stack" in module.DEPENDS_ON
        assert "m03_traffic" in module.DEPENDS_ON

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "api"

    def test_known_search_providers(self, module):
        """Test module knows about common search providers."""
        assert "Algolia" in module.KNOWN_SEARCH_PROVIDERS
        assert "Elasticsearch" in module.KNOWN_SEARCH_PROVIDERS
        assert "Solr" in module.KNOWN_SEARCH_PROVIDERS
        assert "Coveo" in module.KNOWN_SEARCH_PROVIDERS

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fetch_similar_sites_returns_valid_data(
        self, module, valid_similarweb_response
    ):
        """Test SimilarWeb data fetching returns expected structure."""
        with patch.object(
            module, "_call_similarweb_api", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_similarweb_response

            result = await module._fetch_similar_sites("sallybeauty.com")

            assert result["domain"] == "sallybeauty.com"
            assert "similar_sites" in result
            assert len(result["similar_sites"]) == 3
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_detect_search_providers_returns_valid_data(self, module):
        """Test search provider detection returns expected structure."""
        competitor_domains = ["ulta.com", "sephora.com", "dermstore.com"]

        with patch.object(
            module, "_detect_single_provider", new_callable=AsyncMock
        ) as mock_detect:
            mock_detect.side_effect = ["Elasticsearch", "Algolia", "SearchSpring"]

            result = await module._detect_search_providers(competitor_domains)

            assert "competitor_search_providers" in result
            assert result["competitor_search_providers"]["ulta.com"] == "Elasticsearch"
            assert result["competitor_search_providers"]["sephora.com"] == "Algolia"
            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_data_merges_sources(
        self, module, valid_similarweb_response, valid_builtwith_response
    ):
        """Test fetch_data properly merges SimilarWeb and BuiltWith data."""
        with patch.object(
            module, "_fetch_similar_sites", new_callable=AsyncMock
        ) as mock_sw, patch.object(
            module, "_detect_search_providers", new_callable=AsyncMock
        ) as mock_bw:
            mock_sw.return_value = valid_similarweb_response
            mock_bw.return_value = valid_builtwith_response

            result = await module.fetch_data("sallybeauty.com")

            # Should have data from both sources
            assert "similar_sites" in result
            assert "competitor_search_providers" in result

    # =========================================================================
    # Source Merging Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_merge_sources_combines_data(self, module):
        """Test that merge combines SimilarWeb and BuiltWith data."""
        similarweb_data = {
            "domain": "example.com",
            "similar_sites": [
                {"domain": "competitor1.com", "similarity_score": 0.9}
            ],
            "source_url": "https://api.similarweb.com/v1/similar-sites",
            "source_date": datetime.now().isoformat(),
        }
        builtwith_data = {
            "competitor_search_providers": {
                "competitor1.com": "Elasticsearch"
            },
            "source_url": "https://api.builtwith.com/v21/api.json",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(similarweb_data, builtwith_data)

        assert "similar_sites" in result
        assert "competitor_search_providers" in result
        assert result["competitor_search_providers"]["competitor1.com"] == "Elasticsearch"

    @pytest.mark.asyncio
    async def test_merge_sources_prioritizes_similarweb_source(self, module):
        """Test that SimilarWeb source URL takes priority."""
        similarweb_data = {
            "domain": "example.com",
            "similar_sites": [],
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }
        builtwith_data = {
            "competitor_search_providers": {},
            "source_url": "https://api.builtwith.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(similarweb_data, builtwith_data)

        assert "similarweb" in result["source_url"]

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_identifies_algolia_users(self, module):
        """Test transform_data correctly identifies Algolia users."""
        raw_data = {
            "domain": "sallybeauty.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "competitor1.com": "Algolia",
                "competitor2.com": "Elasticsearch",
                "competitor3.com": "Algolia",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert "competitor1.com" in result["algolia_users"]
        assert "competitor3.com" in result["algolia_users"]
        assert len(result["algolia_users"]) == 2

    @pytest.mark.asyncio
    async def test_transform_data_identifies_non_algolia_users(self, module):
        """Test transform_data correctly identifies non-Algolia users."""
        raw_data = {
            "domain": "sallybeauty.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "competitor1.com": "Algolia",
                "competitor2.com": "Elasticsearch",
                "competitor3.com": "Solr",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert "competitor2.com" in result["non_algolia_users"]
        assert "competitor3.com" in result["non_algolia_users"]
        assert len(result["non_algolia_users"]) == 2

    @pytest.mark.asyncio
    async def test_transform_data_detects_first_mover_opportunity(self, module):
        """Test transform_data correctly detects first-mover opportunity."""
        raw_data = {
            "domain": "sallybeauty.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "competitor1.com": "Elasticsearch",
                "competitor2.com": "Solr",
                "competitor3.com": "Custom",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # No Algolia users = first-mover opportunity
        assert result["first_mover_opportunity"] is True

    @pytest.mark.asyncio
    async def test_transform_data_no_first_mover_when_algolia_present(self, module):
        """Test transform_data correctly identifies when NOT a first-mover."""
        raw_data = {
            "domain": "sallybeauty.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "competitor1.com": "Algolia",
                "competitor2.com": "Elasticsearch",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Algolia is present = NOT first-mover
        assert result["first_mover_opportunity"] is False

    @pytest.mark.asyncio
    async def test_transform_data_calculates_penetration_rate(self, module):
        """Test transform_data correctly calculates Algolia penetration rate."""
        raw_data = {
            "domain": "sallybeauty.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "competitor1.com": "Algolia",
                "competitor2.com": "Algolia",
                "competitor3.com": "Elasticsearch",
                "competitor4.com": "Solr",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # 2 out of 4 = 50%
        assert result["algolia_penetration_rate"] == 50.0

    @pytest.mark.asyncio
    async def test_transform_data_builds_provider_breakdown(self, module):
        """Test transform_data correctly builds search provider breakdown."""
        raw_data = {
            "domain": "sallybeauty.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "competitor1.com": "Elasticsearch",
                "competitor2.com": "Elasticsearch",
                "competitor3.com": "Algolia",
                "competitor4.com": "Solr",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["search_provider_breakdown"]["Elasticsearch"] == 2
        assert result["search_provider_breakdown"]["Algolia"] == 1
        assert result["search_provider_breakdown"]["Solr"] == 1

    @pytest.mark.asyncio
    async def test_transform_data_handles_empty_providers(self, module):
        """Test transform_data handles case with no search providers."""
        raw_data = {
            "domain": "sallybeauty.com",
            "similar_sites": [],
            "competitor_search_providers": {},
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["algolia_users"] == []
        assert result["non_algolia_users"] == []
        assert result["first_mover_opportunity"] is False  # No data, no opportunity
        assert result["algolia_penetration_rate"] == 0.0

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "similar_sites": [],
                "competitor_search_providers": {},
                "source_url": "https://api.similarweb.com/v1/similar-sites",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "similarweb" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "similar_sites": [],
                "competitor_search_providers": {},
                "source_url": "https://api.similarweb.com/v1/similar-sites",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.source.date is not None
            # Date should be within last minute
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "similar_sites": [],
                "competitor_search_providers": {},
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
                "similar_sites": [],
                "competitor_search_providers": {},
                "source_url": "https://api.similarweb.com/v1/similar-sites",
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
        """Test _validate_and_store creates a proper CompetitorIntelligenceData model."""
        transformed_data = {
            "domain": "sallybeauty.com",
            "similar_sites": [
                {"domain": "ulta.com", "similarity_score": 0.89, "rank": 1500, "category": "Beauty"}
            ],
            "competitor_search_providers": {"ulta.com": "Elasticsearch"},
            "algolia_users": [],
            "non_algolia_users": ["ulta.com"],
            "first_mover_opportunity": True,
            "total_competitors_analyzed": 1,
            "algolia_penetration_rate": 0.0,
            "search_provider_breakdown": {"Elasticsearch": 1},
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._validate_and_store("sallybeauty.com", transformed_data)

        assert isinstance(result, CompetitorIntelligenceData)
        assert result.domain == "sallybeauty.com"
        assert len(result.similar_sites) == 1
        assert result.first_mover_opportunity is True

    @pytest.mark.asyncio
    async def test_validate_and_store_validates_domain_match(self, module):
        """Test domain in data must match requested domain."""
        transformed_data = {
            "domain": "wrongdomain.com",  # Mismatch!
            "similar_sites": [],
            "competitor_search_providers": {},
            "algolia_users": [],
            "non_algolia_users": [],
            "first_mover_opportunity": False,
            "total_competitors_analyzed": 0,
            "algolia_penetration_rate": 0.0,
            "search_provider_breakdown": {},
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_store("example.com", transformed_data)

        assert "domain" in str(exc_info.value).lower()

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_similar_sites", new_callable=AsyncMock
        ) as mock_sw, patch.object(
            module, "_detect_search_providers", new_callable=AsyncMock
        ) as mock_bw:
            mock_sw.return_value = {
                "domain": "sallybeauty.com",
                "similar_sites": [
                    {"domain": "ulta.com", "similarity_score": 0.89},
                    {"domain": "sephora.com", "similarity_score": 0.85},
                ],
                "source_url": "https://api.similarweb.com/v1/similar-sites",
                "source_date": datetime.now().isoformat(),
            }
            mock_bw.return_value = {
                "competitor_search_providers": {
                    "ulta.com": "Elasticsearch",
                    "sephora.com": "Algolia",
                },
                "source_url": "https://api.builtwith.com/v21/api.json",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m05_competitors"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, CompetitorIntelligenceData)
            assert len(result.data.similar_sites) == 2
            assert "sephora.com" in result.data.algolia_users
            assert "ulta.com" in result.data.non_algolia_users
            assert result.data.first_mover_opportunity is False  # Algolia user exists

            # Verify source citation
            assert result.source is not None
            assert "similarweb" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and fetches fresh data."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = {
                    "domain": "example.com",
                    "similar_sites": [],
                    "competitor_search_providers": {},
                    "source_url": "https://api.similarweb.com/source",
                    "source_date": datetime.now().isoformat(),
                }

                await module.enrich("example.com", force=True)

                mock_cache.assert_not_called()
                mock_fetch.assert_called_once_with("example.com")

    # =========================================================================
    # Error Handling Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_handles_similarweb_api_failure(self, module):
        """Test appropriate error when SimilarWeb API fails."""
        with patch.object(
            module, "_fetch_similar_sites", new_callable=AsyncMock
        ) as mock_sw:
            mock_sw.side_effect = Exception("SimilarWeb API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("example.com")

            assert "SimilarWeb" in str(exc_info.value) or "fail" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_handles_builtwith_failure_gracefully(self, module):
        """Test graceful handling when BuiltWith fails but SimilarWeb succeeds."""
        with patch.object(
            module, "_fetch_similar_sites", new_callable=AsyncMock
        ) as mock_sw, patch.object(
            module, "_detect_search_providers", new_callable=AsyncMock
        ) as mock_bw:
            mock_sw.return_value = {
                "domain": "example.com",
                "similar_sites": [{"domain": "competitor1.com"}],
                "source_url": "https://api.similarweb.com/source",
                "source_date": datetime.now().isoformat(),
            }
            mock_bw.side_effect = Exception("BuiltWith API timeout")

            # Should still work, just without search provider data
            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.data.competitor_search_providers == {}

    # =========================================================================
    # CompetitorIntelligenceData Model Tests
    # =========================================================================

    def test_competitor_intelligence_data_model_creation(self):
        """Test CompetitorIntelligenceData pydantic model creation."""
        data = CompetitorIntelligenceData(
            domain="example.com",
            similar_sites=[
                CompetitorSite(domain="competitor1.com", similarity_score=0.9, rank=1000)
            ],
            competitor_search_providers={"competitor1.com": "Elasticsearch"},
            algolia_users=[],
            non_algolia_users=["competitor1.com"],
            first_mover_opportunity=True,
            total_competitors_analyzed=1,
            algolia_penetration_rate=0.0,
            search_provider_breakdown={"Elasticsearch": 1},
        )

        assert data.domain == "example.com"
        assert len(data.similar_sites) == 1
        assert data.first_mover_opportunity is True
        assert data.algolia_penetration_rate == 0.0

    def test_competitor_intelligence_data_with_minimal_fields(self):
        """Test CompetitorIntelligenceData with only required fields."""
        data = CompetitorIntelligenceData(domain="example.com")

        assert data.domain == "example.com"
        assert data.similar_sites == []
        assert data.competitor_search_providers == {}
        assert data.algolia_users == []
        assert data.first_mover_opportunity is False

    def test_competitor_intelligence_data_model_dump(self):
        """Test CompetitorIntelligenceData can be serialized."""
        data = CompetitorIntelligenceData(
            domain="example.com",
            first_mover_opportunity=True,
            algolia_penetration_rate=25.5,
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["first_mover_opportunity"] is True
        assert dumped["algolia_penetration_rate"] == 25.5

    def test_competitor_site_model(self):
        """Test CompetitorSite pydantic model."""
        site = CompetitorSite(
            domain="competitor.com",
            similarity_score=0.85,
            rank=1500,
            category="E-commerce",
        )

        assert site.domain == "competitor.com"
        assert site.similarity_score == 0.85
        assert site.rank == 1500


class TestM05ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M05 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m05_competitors")
        assert module_class is not None
        assert module_class.MODULE_ID == "m05_competitors"

    def test_module_in_wave_2(self):
        """Test M05 module appears in Wave 2 modules."""
        from app.modules.base import get_modules_by_wave

        wave_2_modules = get_modules_by_wave(2)
        module_ids = [cls.MODULE_ID for cls in wave_2_modules]

        assert "m05_competitors" in module_ids


class TestFirstMoverAnalysis:
    """Test first-mover opportunity detection scenarios."""

    @pytest.fixture
    def module(self):
        return M05CompetitorIntelligenceModule()

    @pytest.mark.asyncio
    async def test_first_mover_all_elasticsearch(self, module):
        """Test first-mover when all competitors use Elasticsearch."""
        raw_data = {
            "domain": "target.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "comp1.com": "Elasticsearch",
                "comp2.com": "Elasticsearch",
                "comp3.com": "Elasticsearch",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["first_mover_opportunity"] is True
        assert result["algolia_penetration_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_no_first_mover_single_algolia_user(self, module):
        """Test no first-mover when even one competitor uses Algolia."""
        raw_data = {
            "domain": "target.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "comp1.com": "Elasticsearch",
                "comp2.com": "Algolia",  # Single Algolia user
                "comp3.com": "Solr",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["first_mover_opportunity"] is False
        assert result["algolia_penetration_rate"] == pytest.approx(33.33, rel=0.1)

    @pytest.mark.asyncio
    async def test_mixed_providers_breakdown(self, module):
        """Test provider breakdown with mixed search technologies."""
        raw_data = {
            "domain": "target.com",
            "similar_sites": [],
            "competitor_search_providers": {
                "comp1.com": "Algolia",
                "comp2.com": "Algolia",
                "comp3.com": "Elasticsearch",
                "comp4.com": "Elasticsearch",
                "comp5.com": "Elasticsearch",
                "comp6.com": "Solr",
                "comp7.com": "Coveo",
            },
            "source_url": "https://api.similarweb.com/source",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["search_provider_breakdown"]["Algolia"] == 2
        assert result["search_provider_breakdown"]["Elasticsearch"] == 3
        assert result["search_provider_breakdown"]["Solr"] == 1
        assert result["search_provider_breakdown"]["Coveo"] == 1
        assert result["total_competitors_analyzed"] == 7
        assert result["algolia_penetration_rate"] == pytest.approx(28.57, rel=0.1)
