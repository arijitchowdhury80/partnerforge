"""
Unit tests for M06_HiringSignals Intelligence Module.

Tests the hiring signals module which detects hiring patterns that indicate
technology investment and decision windows. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from app.modules.m06_hiring import (
    M06HiringSignalsModule,
    HiringSignalsData,
    JobPosting,
    SEARCH_KEYWORDS,
    ENGINEERING_KEYWORDS,
)
from app.modules.base import ModuleResult
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM06HiringSignalsModule:
    """Test suite for M06HiringSignalsModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M06HiringSignalsModule()

    @pytest.fixture
    def valid_hiring_response(self):
        """Mock hiring signals API response."""
        return {
            "domain": "sallybeauty.com",
            "job_postings": [
                {
                    "title": "VP, E-commerce",
                    "location": "Denton, TX",
                    "posted_date": "2026-02-15",
                    "source_url": "https://linkedin.com/jobs/view/1234567",
                },
                {
                    "title": "Sr. Director, Customer Analytics",
                    "location": "Denton, TX",
                    "posted_date": "2026-02-10",
                    "source_url": "https://linkedin.com/jobs/view/1234568",
                },
                {
                    "title": "Software Engineer - Search",
                    "location": "Remote",
                    "posted_date": "2026-02-20",
                    "source_url": "https://linkedin.com/jobs/view/1234569",
                },
            ],
            "source_url": "https://www.linkedin.com/company/sally-beauty/jobs/",
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
        """Test module is in Wave 2 (Competitive)."""
        assert module.WAVE == 2

    def test_module_has_no_strict_dependencies(self, module):
        """Test Wave 2 module has no strict dependencies (optional Wave 2)."""
        # M06 is Wave 2 but has no strict dependencies
        assert module.DEPENDS_ON == []

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE in ["api", "webpage"]

    # =========================================================================
    # Keyword Detection Tests
    # =========================================================================

    def test_search_keywords_defined(self):
        """Test search keywords are properly defined."""
        assert len(SEARCH_KEYWORDS) > 0
        # Common search-related keywords should be present
        search_related = ["search", "discovery", "findability", "relevance"]
        has_any = any(kw in SEARCH_KEYWORDS for kw in search_related)
        assert has_any

    def test_engineering_keywords_defined(self):
        """Test engineering keywords are properly defined."""
        assert len(ENGINEERING_KEYWORDS) > 0

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "job_postings": [],
                "source_url": "https://linkedin.com/company/example/jobs/",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "linkedin.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "job_postings": [],
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
                "job_postings": [],
                "source_url": "https://linkedin.com/company/example/jobs/",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module, valid_hiring_response):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ws.return_value = valid_hiring_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m06_hiring"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, HiringSignalsData)

            # Verify source citation
            assert result.source is not None

    # =========================================================================
    # HiringSignalsData Model Tests
    # =========================================================================

    def test_hiring_signals_data_model_creation(self):
        """Test HiringSignalsData pydantic model creation."""
        data = HiringSignalsData(
            domain="example.com",
        )

        assert data.domain == "example.com"

    def test_job_posting_model(self):
        """Test JobPosting model creation."""
        posting = JobPosting(
            title="VP, E-commerce",
            location="San Francisco, CA",
            posted_date="2026-02-15",
        )

        assert posting.title == "VP, E-commerce"
        assert posting.location == "San Francisco, CA"


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
