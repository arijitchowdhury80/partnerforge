"""
Unit tests for M08 Investor Intelligence Module.

Tests the investor intelligence module which extracts strategic insights
from SEC filings, earnings calls, and investor presentations.
Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m08_investor import (
    M08InvestorModule,
    InvestorIntelligenceData,
    SECFiling,
    EarningsTranscript,
    InvestorPresentation,
    ExecutiveQuote,
    ForwardGuidance,
    RiskFactor,
    DigitalCommitment,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM08InvestorModule:
    """Test suite for M08InvestorModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M08InvestorModule()

    @pytest.fixture
    def valid_sec_response(self):
        """Mock SEC EDGAR response."""
        now = datetime.now()
        return {
            "sec_filings": [
                {
                    "filing_type": "10-K",
                    "fiscal_year": "FY2025",
                    "filing_date": "2025-11-13",
                    "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SBH&type=10-K",
                    "ecommerce_mentioned": True,
                    "ecommerce_share": 0.107,
                    "digital_initiatives": [
                        "E-commerce platform enhancement",
                        "Mobile app redesign",
                    ],
                    "search_mentioned": True,
                    "ai_mentioned": True,
                },
            ],
            "risk_factors": [
                {
                    "category": "Competition",
                    "description": "Competitive factors in e-commerce include the look and feel of digital platforms.",
                    "algolia_relevance": "Algolia improves product discovery and search experience",
                    "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SBH&type=10-K",
                },
            ],
            "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SBH",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def valid_earnings_response(self):
        """Mock earnings transcript response."""
        now = datetime.now()
        return {
            "earnings_transcripts": [
                {
                    "quarter": "Q1 FY2026",
                    "date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://seekingalpha.com/symbol/SBH/earnings/transcripts",
                    "key_quotes": [
                        {
                            "speaker": "Denise Paulonis",
                            "title": "President & CEO",
                            "quote": "Notable enhancements include a more efficient search engine for easier product discovery.",
                            "source_url": "https://seekingalpha.com/symbol/SBH/earnings/transcripts",
                            "source_date": now.strftime("%Y-%m-%d"),
                            "maps_to_algolia_product": "InstantSearch, Dynamic Faceting",
                            "priority": "HIGH",
                        },
                    ],
                    "digital_transformation_mentions": 5,
                    "search_discovery_mentions": 3,
                    "customer_experience_mentions": 4,
                },
            ],
            "forward_guidance": {
                "fiscal_period": "FY2026",
                "revenue_low": 3710000000,
                "revenue_high": 3770000000,
                "eps_low": 2.00,
                "eps_high": 2.10,
                "capex": 100000000,
                "source_url": "https://seekingalpha.com/symbol/SBH/earnings/transcripts",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            "source_url": "https://seekingalpha.com/symbol/SBH/earnings/transcripts",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def valid_presentation_response(self):
        """Mock investor presentation response."""
        now = datetime.now()
        return {
            "investor_presentations": [
                {
                    "title": "Annual Investor Day 2025",
                    "date": "2025-10-15",
                    "event": "Investor Day",
                    "source_url": "https://sallybeauty.com/investor-relations/presentations",
                    "key_themes": [
                        "Digital transformation",
                        "Customer experience",
                    ],
                    "digital_priorities": [
                        "Enhanced search and discovery",
                        "Mobile-first design",
                    ],
                },
            ],
            "digital_commitments": [
                {
                    "initiative": "E-commerce Platform Upgrade",
                    "timeline": "FY2026",
                    "explicit_search_mention": True,
                    "ai_personalization_mention": True,
                    "source_url": "https://sallybeauty.com/investor-relations/presentations",
                },
            ],
            "source_url": "https://sallybeauty.com/investor-relations",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def valid_websearch_response(self):
        """Mock WebSearch response."""
        now = datetime.now()
        return {
            "key_quotes": [
                {
                    "speaker": "Industry Analyst",
                    "title": "Senior Research Analyst",
                    "quote": "The company's digital investments are positioning them well for future growth.",
                    "source_url": "https://www.google.com/search?q=sallybeauty.com+investor+news",
                    "source_date": now.strftime("%Y-%m-%d"),
                    "maps_to_algolia_product": None,
                    "priority": "LOW",
                },
            ],
            "source_url": "https://www.google.com/search?q=sallybeauty.com+investor+relations",
            "source_date": now.isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m08_investor"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Investor Intelligence"

    def test_module_wave(self, module):
        """Test module is in Wave 3."""
        assert module.WAVE == 3

    def test_module_has_no_direct_dependencies(self, module):
        """Test Wave 3 module runs in parallel (no direct dependencies)."""
        assert module.DEPENDS_ON == []

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "transcript"

    def test_module_cache_ttl(self, module):
        """Test module has 7-day cache TTL."""
        assert module.CACHE_TTL == 604800

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fetch_sec_filings_returns_valid_structure(
        self, module, valid_sec_response
    ):
        """Test SEC filings fetch returns expected structure."""
        with patch.object(
            module, "_fetch_sec_filings", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_sec_response

            result = await module._fetch_sec_filings("sallybeauty.com", "SBH")

            assert "sec_filings" in result
            assert "risk_factors" in result
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcripts_returns_valid_structure(
        self, module, valid_earnings_response
    ):
        """Test earnings transcript fetch returns expected structure."""
        with patch.object(
            module, "_fetch_earnings_transcripts", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_earnings_response

            result = await module._fetch_earnings_transcripts("sallybeauty.com", "SBH")

            assert "earnings_transcripts" in result
            assert "forward_guidance" in result
            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_investor_presentations_returns_valid_structure(
        self, module, valid_presentation_response
    ):
        """Test investor presentation fetch returns expected structure."""
        with patch.object(
            module, "_fetch_investor_presentations", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_presentation_response

            result = await module._fetch_investor_presentations("sallybeauty.com")

            assert "investor_presentations" in result
            assert "digital_commitments" in result
            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_data_merges_all_sources(
        self,
        module,
        valid_sec_response,
        valid_earnings_response,
        valid_presentation_response,
        valid_websearch_response,
    ):
        """Test fetch_data properly merges all investor sources."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_sec_filings", new_callable=AsyncMock
        ) as mock_sec, patch.object(
            module, "_fetch_earnings_transcripts", new_callable=AsyncMock
        ) as mock_earnings, patch.object(
            module, "_fetch_investor_presentations", new_callable=AsyncMock
        ) as mock_presentations, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = "SBH"
            mock_sec.return_value = valid_sec_response
            mock_earnings.return_value = valid_earnings_response
            mock_presentations.return_value = valid_presentation_response
            mock_ws.return_value = valid_websearch_response

            result = await module.fetch_data("sallybeauty.com")

            # Should have data from all sources
            assert "sec_filings" in result
            assert "earnings_transcripts" in result
            assert "investor_presentations" in result
            assert "key_quotes" in result

    # =========================================================================
    # Source Merging Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_merge_sources_prioritizes_sec(self, module):
        """Test that SEC data takes priority for source URL."""
        now = datetime.now()
        sec_data = {
            "sec_filings": [{"filing_type": "10-K"}],
            "source_url": "https://www.sec.gov/edgar",
            "source_date": now.isoformat(),
        }
        earnings_data = {
            "earnings_transcripts": [],
            "source_url": "https://seekingalpha.com",
            "source_date": now.isoformat(),
        }

        result = await module._merge_sources(sec_data, earnings_data, {}, {}, "SBH")

        # SEC should be primary source
        assert "sec.gov" in result["source_url"]

    @pytest.mark.asyncio
    async def test_merge_sources_falls_back_to_earnings(self, module):
        """Test fallback to earnings when SEC not available."""
        now = datetime.now()
        earnings_data = {
            "earnings_transcripts": [{"quarter": "Q1"}],
            "source_url": "https://seekingalpha.com/transcripts",
            "source_date": now.isoformat(),
        }

        result = await module._merge_sources({}, earnings_data, {}, {}, "SBH")

        assert "seekingalpha.com" in result["source_url"]

    @pytest.mark.asyncio
    async def test_merge_sources_includes_ticker(self, module):
        """Test that ticker is included in merged data."""
        now = datetime.now()
        websearch_data = {
            "key_quotes": [],
            "source_url": "https://google.com/search",
            "source_date": now.isoformat(),
        }

        result = await module._merge_sources({}, {}, {}, websearch_data, "COST")

        assert result["ticker"] == "COST"

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(self, module):
        """Test transform_data creates data matching InvestorIntelligenceData schema."""
        now = datetime.now()
        raw_data = {
            "domain": "sallybeauty.com",
            "ticker": "SBH",
            "sec_filings": [
                {
                    "filing_type": "10-K",
                    "fiscal_year": "FY2025",
                    "filing_date": "2025-11-13",
                    "source_url": "https://www.sec.gov/filing",
                    "ecommerce_mentioned": True,
                    "search_mentioned": True,
                    "ai_mentioned": False,
                },
            ],
            "earnings_transcripts": [
                {
                    "quarter": "Q1 FY2026",
                    "date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://seekingalpha.com/transcript",
                    "key_quotes": [],
                    "digital_transformation_mentions": 3,
                    "search_discovery_mentions": 2,
                    "customer_experience_mentions": 1,
                },
            ],
            "investor_presentations": [],
            "key_quotes": [],
            "forward_guidance": {
                "fiscal_period": "FY2026",
                "revenue_low": 3700000000,
                "revenue_high": 3800000000,
                "source_url": "https://seekingalpha.com",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            "risk_factors": [],
            "digital_commitments": [],
            "source_url": "https://www.sec.gov/edgar",
            "source_date": now.isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "sallybeauty.com"
        assert result["ticker"] == "SBH"
        assert len(result["sec_filings"]) == 1
        assert result["total_digital_transformation_mentions"] == 3
        assert result["total_search_discovery_mentions"] == 2
        assert result["has_recent_earnings_call"] is True

    @pytest.mark.asyncio
    async def test_transform_data_handles_missing_optional_fields(self, module):
        """Test transform_data handles missing optional fields gracefully."""
        now = datetime.now()
        raw_data = {
            "domain": "example.com",
            "ticker": None,
            "source_url": "https://google.com/search",
            "source_date": now.isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "example.com"
        assert result["ticker"] is None
        assert result["sec_filings"] == []
        assert result["earnings_transcripts"] == []
        assert result["total_digital_transformation_mentions"] == 0

    @pytest.mark.asyncio
    async def test_transform_data_consolidates_quotes(self, module):
        """Test that quotes from all sources are consolidated."""
        now = datetime.now()
        raw_data = {
            "domain": "sallybeauty.com",
            "ticker": "SBH",
            "earnings_transcripts": [
                {
                    "quarter": "Q1 FY2026",
                    "date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://seekingalpha.com",
                    "key_quotes": [
                        {
                            "speaker": "CEO",
                            "title": "CEO",
                            "quote": "Quote 1",
                            "source_url": "https://seekingalpha.com",
                            "source_date": now.strftime("%Y-%m-%d"),
                            "priority": "HIGH",
                        },
                    ],
                    "digital_transformation_mentions": 1,
                    "search_discovery_mentions": 0,
                    "customer_experience_mentions": 0,
                },
            ],
            "key_quotes": [
                {
                    "speaker": "Analyst",
                    "title": "Analyst",
                    "quote": "Quote 2",
                    "source_url": "https://google.com",
                    "source_date": now.strftime("%Y-%m-%d"),
                    "priority": "LOW",
                },
            ],
            "source_url": "https://www.sec.gov",
            "source_date": now.isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Should consolidate quotes from earnings_transcripts and key_quotes
        assert len(result["key_quotes"]) == 2

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        now = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "ticker": None,
                "sec_filings": [],
                "earnings_transcripts": [],
                "investor_presentations": [],
                "key_quotes": [],
                "risk_factors": [],
                "digital_commitments": [],
                "source_url": "https://www.sec.gov/edgar",
                "source_date": now.isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "sec.gov" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "ticker": None,
                "sec_filings": [],
                "earnings_transcripts": [],
                "investor_presentations": [],
                "key_quotes": [],
                "risk_factors": [],
                "digital_commitments": [],
                "source_url": "https://www.sec.gov/edgar",
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
                "ticker": None,
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
                "ticker": None,
                "source_url": "https://www.sec.gov/edgar",
                # source_date is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_date" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "ticker": None,
                "sec_filings": [],
                "earnings_transcripts": [],
                "investor_presentations": [],
                "key_quotes": [],
                "risk_factors": [],
                "digital_commitments": [],
                "source_url": "https://www.sec.gov/edgar",
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
        """Test _validate_and_store creates a proper InvestorIntelligenceData model."""
        now = datetime.now()
        transformed_data = {
            "domain": "sallybeauty.com",
            "ticker": "SBH",
            "sec_filings": [
                {
                    "filing_type": "10-K",
                    "fiscal_year": "FY2025",
                    "filing_date": "2025-11-13",
                    "source_url": "https://www.sec.gov/filing",
                    "ecommerce_mentioned": True,
                },
            ],
            "earnings_transcripts": [],
            "investor_presentations": [],
            "key_quotes": [],
            "forward_guidance": {
                "fiscal_period": "FY2026",
                "revenue_low": 3700000000,
                "revenue_high": 3800000000,
                "source_url": "https://seekingalpha.com",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            "risk_factors": [],
            "digital_commitments": [],
            "total_digital_transformation_mentions": 5,
            "total_search_discovery_mentions": 3,
            "total_customer_experience_mentions": 2,
            "has_recent_earnings_call": True,
            "has_investor_day": False,
            "source_url": "https://www.sec.gov/edgar",
            "source_date": now.isoformat(),
        }

        result = await module._validate_and_store("sallybeauty.com", transformed_data)

        assert isinstance(result, InvestorIntelligenceData)
        assert result.domain == "sallybeauty.com"
        assert result.ticker == "SBH"
        assert len(result.sec_filings) == 1
        assert result.forward_guidance is not None
        assert result.forward_guidance.fiscal_period == "FY2026"

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(
        self,
        module,
        valid_sec_response,
        valid_earnings_response,
        valid_presentation_response,
        valid_websearch_response,
    ):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_sec_filings", new_callable=AsyncMock
        ) as mock_sec, patch.object(
            module, "_fetch_earnings_transcripts", new_callable=AsyncMock
        ) as mock_earnings, patch.object(
            module, "_fetch_investor_presentations", new_callable=AsyncMock
        ) as mock_presentations, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = "SBH"
            mock_sec.return_value = valid_sec_response
            mock_earnings.return_value = valid_earnings_response
            mock_presentations.return_value = valid_presentation_response
            mock_ws.return_value = valid_websearch_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m08_investor"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, InvestorIntelligenceData)
            assert result.data.ticker == "SBH"
            assert len(result.data.sec_filings) == 1
            assert len(result.data.earnings_transcripts) == 1
            assert len(result.data.investor_presentations) == 1
            assert result.data.forward_guidance is not None

            # Verify source citation
            assert result.source is not None
            assert "sec.gov" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and fetches fresh data."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                now = datetime.now()
                mock_fetch.return_value = {
                    "domain": "example.com",
                    "ticker": None,
                    "sec_filings": [],
                    "earnings_transcripts": [],
                    "investor_presentations": [],
                    "key_quotes": [],
                    "risk_factors": [],
                    "digital_commitments": [],
                    "source_url": "https://www.sec.gov/edgar",
                    "source_date": now.isoformat(),
                }

                await module.enrich("example.com", force=True)

                mock_cache.assert_not_called()
                mock_fetch.assert_called_once_with("example.com")

    # =========================================================================
    # Error Handling Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_handles_sec_api_failure(self, module, valid_websearch_response):
        """Test graceful handling when SEC API fails."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_sec_filings", new_callable=AsyncMock
        ) as mock_sec, patch.object(
            module, "_fetch_earnings_transcripts", new_callable=AsyncMock
        ) as mock_earnings, patch.object(
            module, "_fetch_investor_presentations", new_callable=AsyncMock
        ) as mock_presentations, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = "SBH"
            mock_sec.side_effect = Exception("SEC API timeout")
            mock_earnings.side_effect = Exception("Earnings API timeout")
            mock_presentations.return_value = {}
            mock_ws.return_value = valid_websearch_response

            result = await module.enrich("example.com")

            # Should still work with WebSearch fallback
            assert result.data.domain == "example.com"

    @pytest.mark.asyncio
    async def test_fails_when_all_sources_fail(self, module):
        """Test appropriate error when all data sources fail."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_sec_filings", new_callable=AsyncMock
        ) as mock_sec, patch.object(
            module, "_fetch_earnings_transcripts", new_callable=AsyncMock
        ) as mock_earnings, patch.object(
            module, "_fetch_investor_presentations", new_callable=AsyncMock
        ) as mock_presentations, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = "SBH"
            mock_sec.side_effect = Exception("SEC API timeout")
            mock_earnings.side_effect = Exception("Earnings API timeout")
            mock_presentations.side_effect = Exception("Presentations API timeout")
            mock_ws.side_effect = Exception("WebSearch API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("example.com")

            assert "fail" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_handles_private_company(self, module, valid_websearch_response):
        """Test handling of private companies (no ticker)."""
        with patch.object(
            module, "_resolve_ticker", new_callable=AsyncMock
        ) as mock_ticker, patch.object(
            module, "_fetch_investor_presentations", new_callable=AsyncMock
        ) as mock_presentations, patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ticker.return_value = None  # Private company
            mock_presentations.return_value = {}
            mock_ws.return_value = valid_websearch_response

            result = await module.enrich("privatecompany.com")

            # Should work without SEC/earnings data
            assert result.data.ticker is None
            assert len(result.data.sec_filings) == 0
            assert len(result.data.earnings_transcripts) == 0

    # =========================================================================
    # Helper Method Tests
    # =========================================================================

    def test_has_recent_activity_returns_true_for_recent(self, module):
        """Test _has_recent_activity returns True for recent calls."""
        now = datetime.now()
        transcripts = [
            {"quarter": "Q1 FY2026", "date": now.strftime("%Y-%m-%d")},
        ]

        result = module._has_recent_activity(transcripts, days=90)

        assert result is True

    def test_has_recent_activity_returns_false_for_old(self, module):
        """Test _has_recent_activity returns False for old calls."""
        old_date = datetime.now() - timedelta(days=100)
        transcripts = [
            {"quarter": "Q4 FY2025", "date": old_date.strftime("%Y-%m-%d")},
        ]

        result = module._has_recent_activity(transcripts, days=90)

        assert result is False

    def test_has_recent_activity_returns_false_for_empty(self, module):
        """Test _has_recent_activity returns False for empty list."""
        result = module._has_recent_activity([], days=90)

        assert result is False

    def test_has_investor_day_returns_true(self, module):
        """Test _has_investor_day returns True for recent investor day."""
        now = datetime.now()
        presentations = [
            {
                "title": "Annual Meeting",
                "date": now.strftime("%Y-%m-%d"),
                "event": "Investor Day 2025",
            },
        ]

        result = module._has_investor_day(presentations)

        assert result is True

    def test_has_investor_day_returns_false_for_other_events(self, module):
        """Test _has_investor_day returns False for non-investor-day events."""
        now = datetime.now()
        presentations = [
            {
                "title": "Conference Presentation",
                "date": now.strftime("%Y-%m-%d"),
                "event": "Tech Conference 2026",
            },
        ]

        result = module._has_investor_day(presentations)

        assert result is False

    def test_map_to_algolia_product_returns_match(self, module):
        """Test _map_to_algolia_product correctly maps keywords."""
        text = "We are investing in search and personalization capabilities."

        result = module._map_to_algolia_product(text)

        assert "InstantSearch" in result
        assert "Personalization" in result

    def test_map_to_algolia_product_returns_none_for_no_match(self, module):
        """Test _map_to_algolia_product returns None when no keywords match."""
        text = "We are focusing on warehouse logistics and inventory management."

        result = module._map_to_algolia_product(text)

        assert result is None

    def test_count_pattern_mentions(self, module):
        """Test _count_pattern_mentions correctly counts patterns."""
        text = "Digital transformation is key. Our digital-first strategy drives digital growth."

        count = module._count_pattern_mentions(text, module.DIGITAL_PATTERNS)

        assert count >= 1  # Should find at least "digital" patterns

    # =========================================================================
    # Pydantic Model Tests
    # =========================================================================

    def test_investor_intelligence_data_model_creation(self):
        """Test InvestorIntelligenceData pydantic model creation."""
        now = datetime.now()
        data = InvestorIntelligenceData(
            domain="example.com",
            ticker="EXMP",
            sec_filings=[
                SECFiling(
                    filing_type="10-K",
                    fiscal_year="FY2025",
                    filing_date="2025-11-13",
                    source_url="https://sec.gov/filing",
                ),
            ],
            key_quotes=[
                ExecutiveQuote(
                    speaker="John Doe",
                    title="CEO",
                    quote="We are focused on digital growth.",
                    source_url="https://seekingalpha.com",
                    source_date=now.strftime("%Y-%m-%d"),
                ),
            ],
            total_digital_transformation_mentions=5,
        )

        assert data.domain == "example.com"
        assert data.ticker == "EXMP"
        assert len(data.sec_filings) == 1
        assert len(data.key_quotes) == 1
        assert data.total_digital_transformation_mentions == 5

    def test_investor_intelligence_data_with_minimal_fields(self):
        """Test InvestorIntelligenceData with only required fields."""
        data = InvestorIntelligenceData(domain="example.com")

        assert data.domain == "example.com"
        assert data.ticker is None
        assert data.sec_filings == []
        assert data.earnings_transcripts == []
        assert data.key_quotes == []
        assert data.forward_guidance is None

    def test_sec_filing_model(self):
        """Test SECFiling model creation."""
        filing = SECFiling(
            filing_type="10-K",
            fiscal_year="FY2025",
            filing_date="2025-11-13",
            source_url="https://sec.gov/filing",
            ecommerce_mentioned=True,
            ecommerce_share=0.15,
            digital_initiatives=["Platform upgrade", "Mobile app"],
            search_mentioned=True,
            ai_mentioned=False,
        )

        assert filing.filing_type == "10-K"
        assert filing.ecommerce_share == 0.15
        assert len(filing.digital_initiatives) == 2

    def test_executive_quote_model(self):
        """Test ExecutiveQuote model creation."""
        now = datetime.now()
        quote = ExecutiveQuote(
            speaker="Jane Smith",
            title="CFO",
            quote="Our digital investments are paying off.",
            source_url="https://seekingalpha.com/transcript",
            source_date=now.strftime("%Y-%m-%d"),
            maps_to_algolia_product="NeuralSearch",
            priority="HIGH",
            context="Q1 2026 earnings call",
        )

        assert quote.speaker == "Jane Smith"
        assert quote.priority == "HIGH"
        assert quote.maps_to_algolia_product == "NeuralSearch"

    def test_forward_guidance_model(self):
        """Test ForwardGuidance model creation."""
        now = datetime.now()
        guidance = ForwardGuidance(
            fiscal_period="FY2026",
            revenue_low=3700000000,
            revenue_high=3800000000,
            eps_low=2.00,
            eps_high=2.20,
            capex=100000000,
            free_cash_flow=200000000,
            ecommerce_growth_target=0.15,
            source_url="https://seekingalpha.com",
            source_date=now.strftime("%Y-%m-%d"),
        )

        assert guidance.fiscal_period == "FY2026"
        assert guidance.revenue_low == 3700000000
        assert guidance.ecommerce_growth_target == 0.15

    def test_risk_factor_model(self):
        """Test RiskFactor model creation."""
        risk = RiskFactor(
            category="Competition",
            description="E-commerce competition is intensifying.",
            algolia_relevance="Algolia provides competitive search advantage",
            source_url="https://sec.gov/10-K",
        )

        assert risk.category == "Competition"
        assert "Algolia" in risk.algolia_relevance

    def test_digital_commitment_model(self):
        """Test DigitalCommitment model creation."""
        commitment = DigitalCommitment(
            initiative="E-commerce Platform Upgrade",
            timeline="FY2026",
            investment_amount=50000000,
            explicit_search_mention=True,
            ai_personalization_mention=True,
            source_url="https://company.com/investor-day",
        )

        assert commitment.initiative == "E-commerce Platform Upgrade"
        assert commitment.explicit_search_mention is True
        assert commitment.investment_amount == 50000000


class TestM08ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M08 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m08_investor")
        assert module_class is not None
        assert module_class.MODULE_ID == "m08_investor"

    def test_module_in_wave_3(self):
        """Test M08 module appears in Wave 3 modules."""
        from app.modules.base import get_modules_by_wave

        wave_3_modules = get_modules_by_wave(3)
        module_ids = [cls.MODULE_ID for cls in wave_3_modules]

        assert "m08_investor" in module_ids
