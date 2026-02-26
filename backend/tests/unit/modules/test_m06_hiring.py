"""
Unit tests for M06_HiringSignals Intelligence Module.

Tests the hiring signals module which detects search-related hiring patterns
that indicate company investment in search infrastructure.
Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m06_hiring import (
    M06HiringSignalsModule,
    HiringSignalsData,
    SEARCH_KEYWORDS,
    ENGINEERING_KEYWORDS,
    PRODUCT_KEYWORDS,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM06HiringSignalsModule:
    """Test suite for M06HiringSignalsModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M06HiringSignalsModule()

    @pytest.fixture
    def valid_websearch_response(self):
        """Mock WebSearch API response with job postings."""
        return {
            "domain": "sallybeauty.com",
            "total_open_roles": 45,
            "careers_page_url": "https://www.sallybeauty.com/careers",
            "job_board_url": "https://jobs.lever.co/sallybeauty",
            "job_postings": [
                {
                    "title": "Senior Search Engineer",
                    "location": "Remote",
                    "department": "Engineering",
                    "url": "https://jobs.lever.co/sallybeauty/search-engineer"
                },
                {
                    "title": "Machine Learning Engineer - Recommendations",
                    "location": "San Francisco, CA",
                    "department": "Engineering",
                    "url": "https://jobs.lever.co/sallybeauty/ml-engineer"
                },
                {
                    "title": "Product Manager - Discovery",
                    "location": "New York, NY",
                    "department": "Product",
                    "url": "https://jobs.lever.co/sallybeauty/pm-discovery"
                },
                {
                    "title": "Backend Software Engineer",
                    "location": "Austin, TX",
                    "department": "Engineering",
                    "url": "https://jobs.lever.co/sallybeauty/backend-swe"
                },
                {
                    "title": "NLP Engineer",
                    "location": "Remote",
                    "department": "Engineering",
                    "url": "https://jobs.lever.co/sallybeauty/nlp-engineer"
                },
            ],
            "source_url": "https://www.sallybeauty.com/careers",
            "source_date": datetime.now().isoformat(),
        }

    @pytest.fixture
    def minimal_websearch_response(self):
        """Mock WebSearch response with minimal data."""
        return {
            "domain": "example.com",
            "total_open_roles": 5,
            "careers_page_url": "https://www.example.com/careers",
            "job_postings": [
                {
                    "title": "Marketing Manager",
                    "location": "Remote",
                    "department": "Marketing",
                },
                {
                    "title": "Sales Representative",
                    "location": "Chicago, IL",
                    "department": "Sales",
                },
            ],
            "source_url": "https://www.example.com/careers",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m06_hiring"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Hiring Signals"

    def test_module_wave(self, module):
        """Test module is in Wave 2."""
        assert module.WAVE == 2

    def test_module_has_no_dependencies(self, module):
        """Test Wave 2 module has no dependencies."""
        assert module.DEPENDS_ON == []

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "webpage"

    def test_module_cache_ttl(self, module):
        """Test module has 3-day cache TTL (hiring data changes frequently)."""
        assert module.CACHE_TTL == 259200  # 3 days in seconds

    # =========================================================================
    # Keyword Classification Tests
    # =========================================================================

    def test_search_keywords_list(self):
        """Test search keywords list contains expected terms."""
        assert "search" in SEARCH_KEYWORDS
        assert "relevance" in SEARCH_KEYWORDS
        assert "nlp" in SEARCH_KEYWORDS
        assert "discovery" in SEARCH_KEYWORDS
        assert "recommendations" in SEARCH_KEYWORDS
        assert "elasticsearch" in SEARCH_KEYWORDS
        assert "solr" in SEARCH_KEYWORDS
        assert "machine learning" in SEARCH_KEYWORDS

    def test_is_search_related_detects_search_engineer(self, module):
        """Test search engineer role is classified as search-related."""
        assert module._is_search_related("Senior Search Engineer") is True
        assert module._is_search_related("search engineer") is True

    def test_is_search_related_detects_nlp_role(self, module):
        """Test NLP roles are classified as search-related."""
        assert module._is_search_related("NLP Engineer") is True
        assert module._is_search_related("Natural Language Processing Specialist") is True

    def test_is_search_related_detects_recommendations_role(self, module):
        """Test recommendations roles are classified as search-related."""
        assert module._is_search_related("ML Engineer - Recommendations") is True
        assert module._is_search_related("Recommendations Engineer") is True

    def test_is_search_related_detects_discovery_role(self, module):
        """Test discovery roles are classified as search-related."""
        assert module._is_search_related("Product Manager - Discovery") is True
        assert module._is_search_related("Discovery Team Lead") is True

    def test_is_search_related_detects_elasticsearch_role(self, module):
        """Test Elasticsearch roles are classified as search-related."""
        assert module._is_search_related("Elasticsearch Engineer") is True
        assert module._is_search_related("Elastic Search Developer") is True

    def test_is_search_related_returns_false_for_unrelated(self, module):
        """Test non-search roles return False."""
        assert module._is_search_related("Marketing Manager") is False
        assert module._is_search_related("Sales Representative") is False
        assert module._is_search_related("HR Specialist") is False

    def test_is_engineering_role_detection(self, module):
        """Test engineering role classification."""
        assert module._is_engineering_role("Software Engineer") is True
        assert module._is_engineering_role("Backend Developer") is True
        assert module._is_engineering_role("Frontend Developer") is True
        assert module._is_engineering_role("DevOps Engineer") is True
        assert module._is_engineering_role("SRE") is True
        assert module._is_engineering_role("Marketing Manager") is False

    def test_is_product_role_detection(self, module):
        """Test product role classification."""
        assert module._is_product_role("Product Manager") is True
        assert module._is_product_role("Product Owner") is True
        assert module._is_product_role("UX Designer") is True
        assert module._is_product_role("Software Engineer") is False

    # =========================================================================
    # Velocity Calculation Tests
    # =========================================================================

    def test_calculate_velocity_high(self, module):
        """Test high velocity threshold (50+ roles)."""
        assert module._calculate_velocity(50) == "high"
        assert module._calculate_velocity(100) == "high"
        assert module._calculate_velocity(500) == "high"

    def test_calculate_velocity_medium(self, module):
        """Test medium velocity threshold (20-49 roles)."""
        assert module._calculate_velocity(20) == "medium"
        assert module._calculate_velocity(35) == "medium"
        assert module._calculate_velocity(49) == "medium"

    def test_calculate_velocity_low(self, module):
        """Test low velocity threshold (<20 roles)."""
        assert module._calculate_velocity(0) == "low"
        assert module._calculate_velocity(10) == "low"
        assert module._calculate_velocity(19) == "low"

    # =========================================================================
    # Search Relevance Score Tests
    # =========================================================================

    def test_calculate_search_relevance_with_search_roles(self, module):
        """Test relevance score with search-related roles."""
        # 5 search roles should get max search_count_score (50)
        score = module._calculate_search_relevance(
            total_roles=50,
            search_roles=5,
            engineering_roles=10,
        )
        # search_count_score = min(5*10, 50) = 50
        # ratio = 5/10 = 0.5, ratio_score = min(0.5*30, 30) = 15
        # volume_score = min(50/5, 20) = 10
        # total = 50 + 15 + 10 = 75
        assert score == 75.0

    def test_calculate_search_relevance_no_search_roles(self, module):
        """Test relevance score with no search-related roles."""
        score = module._calculate_search_relevance(
            total_roles=50,
            search_roles=0,
            engineering_roles=10,
        )
        # search_count_score = 0
        # ratio_score = 0
        # volume_score = 10
        assert score == 10.0

    def test_calculate_search_relevance_zero_total_roles(self, module):
        """Test relevance score with zero total roles."""
        score = module._calculate_search_relevance(
            total_roles=0,
            search_roles=0,
            engineering_roles=0,
        )
        assert score == 0.0

    def test_calculate_search_relevance_no_engineering_but_search(self, module):
        """Test relevance score with search roles but no engineering."""
        score = module._calculate_search_relevance(
            total_roles=10,
            search_roles=2,
            engineering_roles=0,
        )
        # search_count_score = 20
        # ratio_score = 15 (search roles exist but no engineering)
        # volume_score = 2
        assert score == 37.0

    # =========================================================================
    # Signal Strength Tests
    # =========================================================================

    def test_determine_signal_strength_strong(self, module):
        """Test strong signal determination."""
        assert module._determine_signal_strength(60, 2) == "strong"
        assert module._determine_signal_strength(50, 3) == "strong"
        assert module._determine_signal_strength(80, 5) == "strong"

    def test_determine_signal_strength_moderate(self, module):
        """Test moderate signal determination."""
        assert module._determine_signal_strength(30, 0) == "moderate"
        assert module._determine_signal_strength(25, 1) == "moderate"
        assert module._determine_signal_strength(40, 2) == "moderate"

    def test_determine_signal_strength_weak(self, module):
        """Test weak signal determination."""
        assert module._determine_signal_strength(10, 0) == "weak"
        assert module._determine_signal_strength(0, 0) == "weak"
        assert module._determine_signal_strength(29, 0) == "weak"

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(
        self, module, valid_websearch_response
    ):
        """Test transform_data creates data matching HiringSignalsData schema."""
        result = await module.transform_data(valid_websearch_response)

        assert result["domain"] == "sallybeauty.com"
        assert result["total_open_roles"] == 45
        assert isinstance(result["search_related_roles"], list)
        assert result["search_related_count"] >= 0
        assert result["engineering_roles"] >= 0
        assert result["product_roles"] >= 0
        assert result["hiring_velocity"] in ["high", "medium", "low"]
        assert isinstance(result["search_relevance_score"], float)
        assert result["signal_strength"] in ["strong", "moderate", "weak"]
        assert "source_url" in result
        assert "source_date" in result

    @pytest.mark.asyncio
    async def test_transform_data_classifies_search_roles(
        self, module, valid_websearch_response
    ):
        """Test that search-related roles are properly identified."""
        result = await module.transform_data(valid_websearch_response)

        # Should find: Senior Search Engineer, ML Engineer - Recommendations,
        # Product Manager - Discovery, NLP Engineer
        assert result["search_related_count"] >= 3
        assert any("Search" in role for role in result["search_related_roles"])

    @pytest.mark.asyncio
    async def test_transform_data_handles_minimal_data(
        self, module, minimal_websearch_response
    ):
        """Test transform_data handles minimal job posting data."""
        result = await module.transform_data(minimal_websearch_response)

        assert result["domain"] == "example.com"
        assert result["total_open_roles"] == 5
        assert result["search_related_count"] == 0
        assert result["search_related_roles"] == []
        assert result["hiring_velocity"] == "low"

    # =========================================================================
    # Insights Generation Tests
    # =========================================================================

    def test_generate_insights_high_velocity(self, module):
        """Test insights for high hiring velocity."""
        insights = module._generate_insights(
            total_roles=100,
            search_roles=5,
            engineering_roles=30,
            product_roles=10,
            velocity="high",
        )

        assert any("High hiring velocity" in i for i in insights)

    def test_generate_insights_search_investment(self, module):
        """Test insights for search-related hiring."""
        insights = module._generate_insights(
            total_roles=50,
            search_roles=4,
            engineering_roles=20,
            product_roles=5,
            velocity="medium",
        )

        assert any("search" in i.lower() for i in insights)

    def test_generate_insights_no_search_roles(self, module):
        """Test insights when no search roles but high engineering."""
        insights = module._generate_insights(
            total_roles=30,
            search_roles=0,
            engineering_roles=15,
            product_roles=3,
            velocity="medium",
        )

        assert any("potential opportunity" in i.lower() for i in insights)

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "total_open_roles": 10,
                "job_postings": [],
                "source_url": "https://www.example.com/careers",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert str(result.source.url) == "https://www.example.com/careers"

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "total_open_roles": 10,
                "job_postings": [],
                "source_url": "https://www.example.com/careers",
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
                "total_open_roles": 10,
                "job_postings": [],
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_date MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "total_open_roles": 10,
                "job_postings": [],
                "source_url": "https://www.example.com/careers",
                # source_date is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_date" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)  # 13+ months old

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "total_open_roles": 10,
                "job_postings": [],
                "source_url": "https://www.example.com/careers",
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
        """Test _validate_and_store creates a proper HiringSignalsData model."""
        transformed_data = {
            "domain": "sallybeauty.com",
            "total_open_roles": 45,
            "search_related_roles": ["Senior Search Engineer", "NLP Engineer"],
            "search_related_count": 2,
            "engineering_roles": 5,
            "product_roles": 2,
            "hiring_velocity": "medium",
            "search_relevance_score": 65.5,
            "signal_strength": "strong",
            "job_postings": [],
            "careers_page_url": "https://www.sallybeauty.com/careers",
            "hiring_insights": ["High hiring velocity"],
            "source_url": "https://www.sallybeauty.com/careers",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._validate_and_store("sallybeauty.com", transformed_data)

        assert isinstance(result, HiringSignalsData)
        assert result.domain == "sallybeauty.com"
        assert result.total_open_roles == 45
        assert result.search_related_count == 2
        assert result.signal_strength == "strong"

    @pytest.mark.asyncio
    async def test_validate_and_store_validates_domain_match(self, module):
        """Test domain in data must match requested domain."""
        transformed_data = {
            "domain": "wrongdomain.com",  # Mismatch!
            "total_open_roles": 10,
            "source_url": "https://example.com/careers",
            "source_date": datetime.now().isoformat(),
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_store("example.com", transformed_data)

        assert "domain" in str(exc_info.value).lower()

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module, valid_websearch_response):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ws.return_value = valid_websearch_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m06_hiring"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, HiringSignalsData)
            assert result.data.total_open_roles == 45
            assert result.data.careers_page_url == "https://www.sallybeauty.com/careers"
            assert len(result.data.search_related_roles) >= 3

            # Verify source citation
            assert result.source is not None
            assert "sallybeauty.com" in str(result.source.url)

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
                    "total_open_roles": 10,
                    "job_postings": [],
                    "source_url": "https://www.example.com/careers",
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
    async def test_handles_websearch_api_failure(self, module):
        """Test appropriate error when WebSearch API fails."""
        with patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ws.side_effect = Exception("WebSearch API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("example.com")

            # Should indicate enrichment failure
            assert "fail" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_handles_empty_job_postings(self, module):
        """Test handling of response with no job postings."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "total_open_roles": 0,
                "job_postings": [],
                "source_url": "https://www.example.com/careers",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.data.total_open_roles == 0
            assert result.data.search_related_count == 0
            assert result.data.hiring_velocity == "low"
            assert result.data.search_relevance_score == 0.0
            assert result.data.signal_strength == "weak"

    # =========================================================================
    # HiringSignalsData Model Tests
    # =========================================================================

    def test_hiring_signals_data_model_creation(self):
        """Test HiringSignalsData pydantic model creation."""
        data = HiringSignalsData(
            domain="example.com",
            total_open_roles=50,
            search_related_roles=["Search Engineer", "NLP Engineer"],
            search_related_count=2,
            engineering_roles=10,
            product_roles=5,
            hiring_velocity="medium",
            search_relevance_score=65.5,
            signal_strength="strong",
            job_postings=[
                {"title": "Search Engineer", "location": "Remote"}
            ],
            careers_page_url="https://example.com/careers",
            hiring_insights=["High search investment detected"],
        )

        assert data.domain == "example.com"
        assert data.total_open_roles == 50
        assert data.search_related_count == 2
        assert len(data.search_related_roles) == 2
        assert data.signal_strength == "strong"

    def test_hiring_signals_data_with_minimal_fields(self):
        """Test HiringSignalsData with only required fields."""
        data = HiringSignalsData(domain="example.com")

        assert data.domain == "example.com"
        assert data.total_open_roles == 0
        assert data.search_related_roles == []
        assert data.search_related_count == 0
        assert data.hiring_velocity == "low"
        assert data.search_relevance_score == 0.0
        assert data.signal_strength == "weak"

    def test_hiring_signals_data_model_dump(self):
        """Test HiringSignalsData can be serialized."""
        data = HiringSignalsData(
            domain="example.com",
            total_open_roles=50,
            search_related_count=3,
            signal_strength="strong",
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["total_open_roles"] == 50
        assert dumped["signal_strength"] == "strong"


class TestM06ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M06 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m06_hiring")
        assert module_class is not None
        assert module_class.MODULE_ID == "m06_hiring"

    def test_module_in_wave_2(self):
        """Test M06 module appears in Wave 2 modules."""
        from app.modules.base import get_modules_by_wave

        wave_2_modules = get_modules_by_wave(2)
        module_ids = [cls.MODULE_ID for cls in wave_2_modules]

        assert "m06_hiring" in module_ids


class TestJobPostingClassification:
    """Test job posting classification edge cases."""

    @pytest.fixture
    def module(self):
        return M06HiringSignalsModule()

    def test_case_insensitive_search_detection(self, module):
        """Test search detection is case-insensitive."""
        assert module._is_search_related("SEARCH ENGINEER") is True
        assert module._is_search_related("Search Engineer") is True
        assert module._is_search_related("search engineer") is True

    def test_partial_keyword_match(self, module):
        """Test partial keyword matching."""
        # 'searchability' contains 'search'
        assert module._is_search_related("Searchability Specialist") is True

    def test_compound_titles(self, module):
        """Test compound job titles with multiple keywords."""
        title = "Senior Machine Learning Engineer - Search & Recommendations"
        assert module._is_search_related(title) is True
        assert module._is_engineering_role(title) is True

    def test_product_engineering_hybrid(self, module):
        """Test roles that span product and engineering."""
        title = "Product Engineer"
        assert module._is_engineering_role(title) is True
        # Note: 'product engineer' contains 'engineer' but not product keywords
        assert module._is_product_role(title) is False

    def test_relevance_keyword(self, module):
        """Test relevance keyword detection."""
        assert module._is_search_related("Relevance Engineer") is True
        assert module._is_search_related("Search Relevance Specialist") is True
