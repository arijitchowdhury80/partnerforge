"""
Unit tests for M12_CaseStudy Intelligence Module.

Tests the case study matching module which finds relevant Algolia case studies
for target companies. Validates source citation mandate compliance and
relevance scoring accuracy.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m12_case_study import (
    M12CaseStudyModule,
    CaseStudyMatchData,
    CaseStudyMatch,
    ProofPointMatch,
    QuoteMatch,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM12CaseStudyModule:
    """Test suite for M12CaseStudyModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M12CaseStudyModule()

    @pytest.fixture
    def sample_target_context(self):
        """Sample target company context (M01 output)."""
        return {
            "domain": "costco.com",
            "company_name": "Costco Wholesale Corporation",
            "vertical": "Retail",
            "sub_vertical": "Warehouse Club",
            "business_model": "B2C",
            "employee_count": 300000,
            "current_search_provider": "Elasticsearch",
        }

    @pytest.fixture
    def sample_case_studies(self):
        """Sample case studies from database."""
        now = datetime.now()
        return [
            {
                "customer_name": "Lacoste",
                "customer_domain": "lacoste.com",
                "vertical": "Retail",
                "sub_vertical": "Apparel",
                "use_case": "ecommerce search",
                "customer_type": "Enterprise",
                "key_results": "35% increase in conversion rate",
                "competitor_takeout": "Elasticsearch",
                "features_used": ["InstantSearch", "Personalization"],
                "story_url": "https://algolia.com/customers/lacoste/",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            {
                "customer_name": "Medium",
                "customer_domain": "medium.com",
                "vertical": "Media",
                "sub_vertical": "Publishing",
                "use_case": "content discovery",
                "customer_type": "Mid-Market",
                "key_results": "2x engagement",
                "competitor_takeout": None,
                "features_used": ["InstantSearch"],
                "story_url": "https://algolia.com/customers/medium/",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            {
                "customer_name": "Staples",
                "customer_domain": "staples.com",
                "vertical": "Retail",
                "sub_vertical": "Office Supplies",
                "use_case": "ecommerce search",
                "customer_type": "Enterprise",
                "key_results": "25% revenue increase",
                "competitor_takeout": "Endeca",
                "features_used": ["InstantSearch", "QuerySuggestions"],
                "story_url": "https://algolia.com/customers/staples/",
                "source_date": now.strftime("%Y-%m-%d"),
            },
        ]

    @pytest.fixture
    def sample_proof_points(self):
        """Sample proof points."""
        return [
            {
                "customer_name": "Lacoste",
                "vertical": "Retail",
                "result_text": "35% conversion increase",
                "source": "https://algolia.com/customers/lacoste/",
            },
            {
                "customer_name": "Medium",
                "vertical": "Media",
                "result_text": "2x engagement",
                "source": "https://algolia.com/customers/medium/",
            },
        ]

    @pytest.fixture
    def sample_quotes(self):
        """Sample customer quotes."""
        return [
            {
                "customer_name": "Lacoste",
                "contact_name": "John Smith",
                "contact_title": "VP E-commerce",
                "quote_text": "Algolia transformed our search.",
                "vertical": "Retail",
                "source": "https://algolia.com/customers/lacoste/",
            },
        ]

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m12_case_study"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Case Study Matching"

    def test_module_wave(self, module):
        """Test module is in Wave 4 (Synthesis)."""
        assert module.WAVE == 4

    def test_module_dependencies(self, module):
        """Test module depends on M01 Company Context."""
        assert "m01_company_context" in module.DEPENDS_ON

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "database"

    # =========================================================================
    # Relevance Scoring Tests
    # =========================================================================

    def test_calculate_relevance_vertical_match(self, module):
        """Test vertical match scoring (40 points)."""
        case_study = {"vertical": "Retail", "use_case": "search"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical="Retail",
            target_sub_vertical=None,
            target_use_case=None,
            target_employee_count=None,
            target_current_search=None,
        )

        assert score >= 40  # Vertical match = 40 points
        assert any("vertical" in r.lower() for r in reasons)

    def test_calculate_relevance_sub_vertical_match(self, module):
        """Test sub-vertical match scoring (15 points)."""
        case_study = {"vertical": "Retail", "sub_vertical": "Apparel"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical="Retail",
            target_sub_vertical="Apparel",
            target_use_case=None,
            target_employee_count=None,
            target_current_search=None,
        )

        assert score >= 55  # Vertical (40) + Sub-vertical (15)
        assert any("sub-vertical" in r.lower() for r in reasons)

    def test_calculate_relevance_use_case_match(self, module):
        """Test use case match scoring (20 points)."""
        case_study = {"use_case": "ecommerce search"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical=None,
            target_sub_vertical=None,
            target_use_case="ecommerce search",
            target_employee_count=None,
            target_current_search=None,
        )

        assert score >= 20  # Use case match = 20 points
        assert any("use case" in r.lower() for r in reasons)

    def test_calculate_relevance_size_match(self, module):
        """Test company size match scoring (15 points)."""
        case_study = {"customer_type": "Enterprise"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical=None,
            target_sub_vertical=None,
            target_use_case=None,
            target_employee_count=50000,  # Enterprise tier
            target_current_search=None,
        )

        assert score >= 15  # Size match = 15 points
        assert any("size" in r.lower() for r in reasons)

    def test_calculate_relevance_competitor_takeout(self, module):
        """Test competitor takeout match scoring (10 points)."""
        case_study = {"competitor_takeout": "Elasticsearch"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical=None,
            target_sub_vertical=None,
            target_use_case=None,
            target_employee_count=None,
            target_current_search="Elasticsearch",
        )

        assert score >= 10  # Competitor takeout = 10 points
        assert any("competitor" in r.lower() for r in reasons)

    def test_calculate_relevance_full_match(self, module):
        """Test full match with all criteria (100 points max)."""
        case_study = {
            "vertical": "Retail",
            "sub_vertical": "E-commerce",
            "use_case": "ecommerce search",
            "customer_type": "Enterprise",
            "competitor_takeout": "Elasticsearch",
        }
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical="Retail",
            target_sub_vertical="E-commerce",
            target_use_case="ecommerce search",
            target_employee_count=50000,
            target_current_search="Elasticsearch",
        )

        assert score == 100  # Full match
        assert len(reasons) == 5  # All 5 criteria matched

    def test_calculate_relevance_no_match(self, module):
        """Test no match returns zero score."""
        case_study = {
            "vertical": "Healthcare",
            "use_case": "clinical trials",
        }
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical="Retail",
            target_sub_vertical="E-commerce",
            target_use_case="ecommerce search",
            target_employee_count=5000,
            target_current_search="Coveo",
        )

        assert score == 0
        assert len(reasons) == 0

    def test_calculate_relevance_related_verticals(self, module):
        """Test related verticals get partial score."""
        case_study = {"vertical": "ecommerce"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical="retail",  # Related to ecommerce
            target_sub_vertical=None,
            target_use_case=None,
            target_employee_count=None,
            target_current_search=None,
        )

        assert score == 20  # Half of vertical match (40/2)
        assert any("related vertical" in r.lower() for r in reasons)

    # =========================================================================
    # Size Tier Tests
    # =========================================================================

    def test_get_size_tier_enterprise(self, module):
        """Test enterprise tier classification."""
        assert module._get_size_tier(50000) == "enterprise"
        assert module._get_size_tier(10000) == "enterprise"

    def test_get_size_tier_mid_market(self, module):
        """Test mid-market tier classification."""
        assert module._get_size_tier(5000) == "mid_market"
        assert module._get_size_tier(1000) == "mid_market"

    def test_get_size_tier_smb(self, module):
        """Test SMB tier classification."""
        assert module._get_size_tier(500) == "smb"
        assert module._get_size_tier(100) == "smb"

    def test_get_size_tier_startup(self, module):
        """Test startup tier classification."""
        assert module._get_size_tier(50) == "startup"
        assert module._get_size_tier(10) == "startup"

    def test_get_size_tier_from_metadata(self, module):
        """Test extracting size tier from case study metadata."""
        assert module._get_size_tier_from_metadata({"customer_type": "Enterprise"}) == "enterprise"
        assert module._get_size_tier_from_metadata({"customer_type": "Mid-Market"}) == "mid_market"
        assert module._get_size_tier_from_metadata({"customer_type": "SMB"}) == "smb"
        assert module._get_size_tier_from_metadata({"customer_type": "Startup"}) == "startup"

    # =========================================================================
    # Vertical/Use Case Relationship Tests
    # =========================================================================

    def test_verticals_related_retail_ecommerce(self, module):
        """Test retail and ecommerce are related."""
        assert module._verticals_related("retail", "ecommerce")
        assert module._verticals_related("commerce", "marketplace")

    def test_verticals_related_media_entertainment(self, module):
        """Test media and entertainment are related."""
        assert module._verticals_related("media", "entertainment")
        assert module._verticals_related("publishing", "news")

    def test_verticals_not_related(self, module):
        """Test unrelated verticals."""
        assert not module._verticals_related("retail", "healthcare")
        assert not module._verticals_related("fintech", "travel")

    def test_use_cases_related_search(self, module):
        """Test search-related use cases."""
        assert module._use_cases_related("site search", "ecommerce search")
        assert module._use_cases_related("product search", "search")

    def test_use_cases_related_recommendations(self, module):
        """Test recommendation-related use cases."""
        assert module._use_cases_related("recommendations", "personalization")
        assert module._use_cases_related("product recommendations", "personalization")

    def test_use_cases_not_related(self, module):
        """Test unrelated use cases."""
        assert not module._use_cases_related("site search", "support")

    # =========================================================================
    # Use Case Inference Tests
    # =========================================================================

    def test_infer_use_case_retail(self, module):
        """Test use case inference for retail."""
        context = {"vertical": "Retail", "business_model": "B2C"}
        assert module._infer_use_case(context) == "ecommerce search"

    def test_infer_use_case_media(self, module):
        """Test use case inference for media."""
        context = {"vertical": "Media"}
        assert module._infer_use_case(context) == "content discovery"

    def test_infer_use_case_saas(self, module):
        """Test use case inference for SaaS."""
        context = {"vertical": "SaaS"}
        assert module._infer_use_case(context) == "documentation search"

    def test_infer_use_case_marketplace(self, module):
        """Test use case inference for marketplace."""
        context = {"vertical": "Marketplace"}
        assert module._infer_use_case(context) == "marketplace search"

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fetch_data_returns_required_fields(
        self, module, sample_target_context, sample_case_studies
    ):
        """Test fetch_data returns all required fields."""
        with patch.object(
            module, "_get_target_context", new_callable=AsyncMock
        ) as mock_context, patch.object(
            module, "_fetch_case_studies", new_callable=AsyncMock
        ) as mock_cs, patch.object(
            module, "_fetch_proof_points", new_callable=AsyncMock
        ) as mock_pp, patch.object(
            module, "_fetch_quotes", new_callable=AsyncMock
        ) as mock_q:
            mock_context.return_value = sample_target_context
            mock_cs.return_value = sample_case_studies
            mock_pp.return_value = []
            mock_q.return_value = []

            result = await module.fetch_data("costco.com")

            assert "domain" in result
            assert "target_context" in result
            assert "case_studies" in result
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_fetch_data_handles_context_failure(
        self, module, sample_case_studies
    ):
        """Test fetch_data continues when context fails."""
        with patch.object(
            module, "_get_target_context", new_callable=AsyncMock
        ) as mock_context, patch.object(
            module, "_fetch_case_studies", new_callable=AsyncMock
        ) as mock_cs, patch.object(
            module, "_fetch_proof_points", new_callable=AsyncMock
        ) as mock_pp, patch.object(
            module, "_fetch_quotes", new_callable=AsyncMock
        ) as mock_q:
            mock_context.side_effect = Exception("Context not available")
            mock_cs.return_value = sample_case_studies
            mock_pp.return_value = []
            mock_q.return_value = []

            # Should not raise - continues without context
            result = await module.fetch_data("example.com")

            assert result["target_context"] == {}
            assert len(result["case_studies"]) > 0

    @pytest.mark.asyncio
    async def test_fetch_data_fails_without_case_studies(self, module):
        """Test fetch_data fails when no case studies available."""
        with patch.object(
            module, "_get_target_context", new_callable=AsyncMock
        ) as mock_context, patch.object(
            module, "_fetch_case_studies", new_callable=AsyncMock
        ) as mock_cs, patch.object(
            module, "_fetch_proof_points", new_callable=AsyncMock
        ) as mock_pp, patch.object(
            module, "_fetch_quotes", new_callable=AsyncMock
        ) as mock_q:
            mock_context.return_value = {}
            mock_cs.return_value = []  # No case studies
            mock_pp.return_value = []
            mock_q.return_value = []

            with pytest.raises(Exception) as exc_info:
                await module.fetch_data("example.com")

            assert "case studies" in str(exc_info.value).lower()

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_matches_case_studies(
        self, module, sample_target_context, sample_case_studies
    ):
        """Test transform_data matches and scores case studies."""
        raw_data = {
            "domain": "costco.com",
            "target_context": sample_target_context,
            "case_studies": sample_case_studies,
            "proof_points": [],
            "quotes": [],
            "source_url": "https://algolia.com/customers/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Should have matches for Retail case studies
        assert result["total_matches"] >= 2  # Lacoste and Staples are Retail
        assert len(result["matched_case_studies"]) >= 2

        # Matches should be sorted by score (highest first)
        scores = [m.relevance_score for m in result["matched_case_studies"]]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.asyncio
    async def test_transform_data_sets_primary_match(
        self, module, sample_target_context, sample_case_studies
    ):
        """Test transform_data sets primary match correctly."""
        raw_data = {
            "domain": "costco.com",
            "target_context": sample_target_context,
            "case_studies": sample_case_studies,
            "proof_points": [],
            "quotes": [],
            "source_url": "https://algolia.com/customers/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["primary_match"] is not None
        # Primary match should have highest score
        if result["secondary_matches"]:
            assert result["primary_match"].relevance_score >= result["secondary_matches"][0].relevance_score

    @pytest.mark.asyncio
    async def test_transform_data_filters_proof_points(
        self, module, sample_target_context, sample_case_studies, sample_proof_points
    ):
        """Test transform_data filters proof points by vertical."""
        raw_data = {
            "domain": "costco.com",
            "target_context": sample_target_context,
            "case_studies": sample_case_studies,
            "proof_points": sample_proof_points,
            "quotes": [],
            "source_url": "https://algolia.com/customers/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Should only include Retail proof points (not Media)
        for pp in result["relevant_proof_points"]:
            assert pp.vertical.lower() == "retail"

    @pytest.mark.asyncio
    async def test_transform_data_filters_quotes(
        self, module, sample_target_context, sample_case_studies, sample_quotes
    ):
        """Test transform_data filters quotes by vertical."""
        raw_data = {
            "domain": "costco.com",
            "target_context": sample_target_context,
            "case_studies": sample_case_studies,
            "proof_points": [],
            "quotes": sample_quotes,
            "source_url": "https://algolia.com/customers/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Should only include Retail quotes
        for q in result["relevant_quotes"]:
            assert q.vertical.lower() == "retail"

    @pytest.mark.asyncio
    async def test_transform_data_counts_match_types(
        self, module, sample_target_context, sample_case_studies
    ):
        """Test transform_data correctly counts match types."""
        raw_data = {
            "domain": "costco.com",
            "target_context": sample_target_context,
            "case_studies": sample_case_studies,
            "proof_points": [],
            "quotes": [],
            "source_url": "https://algolia.com/customers/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Should have vertical matches for Retail case studies
        assert result["vertical_matches"] >= 2
        # Should have competitor takeout matches (Lacoste has Elasticsearch)
        assert result["competitor_takeout_matches"] >= 1

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module, sample_case_studies):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "target_context": {"vertical": "Retail"},
                "case_studies": sample_case_studies,
                "proof_points": [],
                "quotes": [],
                "source_url": "https://algolia.com/customers/",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "algolia.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module, sample_case_studies):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "target_context": {},
                "case_studies": sample_case_studies,
                "proof_points": [],
                "quotes": [],
                "source_url": "https://algolia.com/customers/",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.source.date is not None

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module, sample_case_studies):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "target_context": {},
                "case_studies": sample_case_studies,
                "proof_points": [],
                "quotes": [],
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_date(self, module, sample_case_studies):
        """TEST SOURCE CITATION MANDATE: Missing source_date MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "target_context": {},
                "case_studies": sample_case_studies,
                "proof_points": [],
                "quotes": [],
                "source_url": "https://algolia.com/customers/",
                # source_date is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_date" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module, sample_case_studies):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "target_context": {},
                "case_studies": sample_case_studies,
                "proof_points": [],
                "quotes": [],
                "source_url": "https://algolia.com/customers/",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_case_study_match_has_source_url(self, module, sample_case_studies):
        """TEST SOURCE CITATION MANDATE: Each case study match must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "target_context": {"vertical": "Retail"},
                "case_studies": sample_case_studies,
                "proof_points": [],
                "quotes": [],
                "source_url": "https://algolia.com/customers/",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            # Every matched case study must have source_url
            for match in result.data.matched_case_studies:
                assert match.source_url is not None
                assert match.source_url.startswith("http")

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(
        self, module, sample_target_context, sample_case_studies
    ):
        """Test complete enrichment pipeline."""
        with patch.object(
            module, "_get_target_context", new_callable=AsyncMock
        ) as mock_context, patch.object(
            module, "_fetch_case_studies", new_callable=AsyncMock
        ) as mock_cs, patch.object(
            module, "_fetch_proof_points", new_callable=AsyncMock
        ) as mock_pp, patch.object(
            module, "_fetch_quotes", new_callable=AsyncMock
        ) as mock_q:
            mock_context.return_value = sample_target_context
            mock_cs.return_value = sample_case_studies
            mock_pp.return_value = []
            mock_q.return_value = []

            result = await module.enrich("costco.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m12_case_study"
            assert result.domain == "costco.com"

            # Verify data
            assert isinstance(result.data, CaseStudyMatchData)
            assert result.data.total_matches >= 2  # At least Lacoste and Staples

            # Verify primary match
            assert result.data.primary_match is not None
            assert result.data.primary_match.vertical == "Retail"

            # Verify source citation
            assert result.source is not None

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module, sample_case_studies):
        """Test force=True bypasses cache."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = {
                    "domain": "example.com",
                    "target_context": {},
                    "case_studies": sample_case_studies,
                    "proof_points": [],
                    "quotes": [],
                    "source_url": "https://algolia.com/customers/",
                    "source_date": datetime.now().isoformat(),
                }

                await module.enrich("example.com", force=True)

                mock_cache.assert_not_called()
                mock_fetch.assert_called_once()

    # =========================================================================
    # CaseStudyMatchData Model Tests
    # =========================================================================

    def test_case_study_match_data_creation(self):
        """Test CaseStudyMatchData pydantic model creation."""
        match = CaseStudyMatch(
            customer_name="Lacoste",
            vertical="Retail",
            use_case="ecommerce search",
            relevance_score=80,
            match_reasons=["Same vertical", "Same use case"],
            source_url="https://algolia.com/customers/lacoste/",
        )

        data = CaseStudyMatchData(
            domain="example.com",
            target_vertical="Retail",
            matched_case_studies=[match],
            total_matches=1,
            vertical_matches=1,
            primary_match=match,
        )

        assert data.domain == "example.com"
        assert data.total_matches == 1
        assert data.primary_match.customer_name == "Lacoste"

    def test_case_study_match_data_with_minimal_fields(self):
        """Test CaseStudyMatchData with only required fields."""
        data = CaseStudyMatchData(domain="example.com")

        assert data.domain == "example.com"
        assert data.matched_case_studies == []
        assert data.total_matches == 0
        assert data.primary_match is None

    def test_case_study_match_relevance_score_validation(self):
        """Test relevance_score must be 0-100."""
        # Valid scores
        match = CaseStudyMatch(
            customer_name="Test",
            relevance_score=50,
            source_url="https://example.com/",
        )
        assert match.relevance_score == 50

        # Invalid scores should raise
        with pytest.raises(ValueError):
            CaseStudyMatch(
                customer_name="Test",
                relevance_score=150,  # > 100
                source_url="https://example.com/",
            )

        with pytest.raises(ValueError):
            CaseStudyMatch(
                customer_name="Test",
                relevance_score=-10,  # < 0
                source_url="https://example.com/",
            )

    def test_case_study_match_data_model_dump(self):
        """Test CaseStudyMatchData can be serialized."""
        match = CaseStudyMatch(
            customer_name="Lacoste",
            relevance_score=80,
            source_url="https://algolia.com/customers/lacoste/",
        )
        data = CaseStudyMatchData(
            domain="example.com",
            matched_case_studies=[match],
            total_matches=1,
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["total_matches"] == 1
        assert len(dumped["matched_case_studies"]) == 1

    # =========================================================================
    # ProofPointMatch and QuoteMatch Model Tests
    # =========================================================================

    def test_proof_point_match_creation(self):
        """Test ProofPointMatch model creation."""
        pp = ProofPointMatch(
            customer_name="Lacoste",
            vertical="Retail",
            result_text="35% conversion increase",
            source_url="https://algolia.com/customers/lacoste/",
        )

        assert pp.customer_name == "Lacoste"
        assert pp.result_text == "35% conversion increase"

    def test_quote_match_creation(self):
        """Test QuoteMatch model creation."""
        q = QuoteMatch(
            customer_name="Lacoste",
            contact_name="John Smith",
            contact_title="VP E-commerce",
            quote_text="Algolia transformed our search.",
            vertical="Retail",
            source_url="https://algolia.com/customers/lacoste/",
        )

        assert q.contact_name == "John Smith"
        assert q.contact_title == "VP E-commerce"


class TestM12ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M12 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m12_case_study")
        assert module_class is not None
        assert module_class.MODULE_ID == "m12_case_study"

    def test_module_in_wave_4(self):
        """Test M12 module appears in Wave 4 modules."""
        from app.modules.base import get_modules_by_wave

        wave_4_modules = get_modules_by_wave(4)
        module_ids = [cls.MODULE_ID for cls in wave_4_modules]

        assert "m12_case_study" in module_ids


class TestM12EdgeCases:
    """Test edge cases and boundary conditions."""

    @pytest.fixture
    def module(self):
        return M12CaseStudyModule()

    def test_empty_vertical_handling(self, module):
        """Test handling of empty/None verticals."""
        case_study = {"vertical": None, "use_case": "search"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical="Retail",
            target_sub_vertical=None,
            target_use_case=None,
            target_employee_count=None,
            target_current_search=None,
        )

        assert score == 0  # No match when vertical is None

    def test_case_insensitive_matching(self, module):
        """Test vertical matching is case-insensitive."""
        case_study = {"vertical": "RETAIL"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical="retail",
            target_sub_vertical=None,
            target_use_case=None,
            target_employee_count=None,
            target_current_search=None,
        )

        assert score >= 40  # Should match despite case difference

    def test_partial_use_case_matching(self, module):
        """Test partial use case matching."""
        case_study = {"use_case": "ecommerce search optimization"}
        score, reasons = module._calculate_relevance(
            case_study=case_study,
            target_vertical=None,
            target_sub_vertical=None,
            target_use_case="ecommerce search",
            target_employee_count=None,
            target_current_search=None,
        )

        assert score >= 20  # Should match on partial use case

    @pytest.mark.asyncio
    async def test_large_case_study_list(self, module):
        """Test handling of large case study lists."""
        # Generate 100 case studies
        case_studies = [
            {
                "customer_name": f"Company {i}",
                "vertical": "Retail" if i % 2 == 0 else "Media",
                "use_case": "search",
                "story_url": f"https://algolia.com/customers/company-{i}/",
                "source_date": datetime.now().strftime("%Y-%m-%d"),
            }
            for i in range(100)
        ]

        raw_data = {
            "domain": "example.com",
            "target_context": {"vertical": "Retail"},
            "case_studies": case_studies,
            "proof_points": [],
            "quotes": [],
            "source_url": "https://algolia.com/customers/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Should match ~50 Retail case studies
        assert result["total_matches"] >= 40
        # Should be sorted by score
        scores = [m.relevance_score for m in result["matched_case_studies"]]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.asyncio
    async def test_no_matching_case_studies(self, module):
        """Test when no case studies match."""
        case_studies = [
            {
                "customer_name": "HealthCo",
                "vertical": "Healthcare",
                "use_case": "clinical trials",
                "story_url": "https://algolia.com/customers/healthco/",
                "source_date": datetime.now().strftime("%Y-%m-%d"),
            }
        ]

        raw_data = {
            "domain": "example.com",
            "target_context": {"vertical": "Automotive"},
            "case_studies": case_studies,
            "proof_points": [],
            "quotes": [],
            "source_url": "https://algolia.com/customers/",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["total_matches"] == 0
        assert result["primary_match"] is None
        assert result["secondary_matches"] == []
