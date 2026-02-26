"""
Unit tests for M07_StrategicContext Intelligence Module.

Tests the strategic context module which identifies strategic triggers
and initiatives that signal buying intent. Validates source citation
mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m07_strategic import (
    M07StrategicContextModule,
    StrategicContextData,
    TriggerEvent,
    ExpansionSignal,
    DigitalInitiative,
    NewsItem,
    TRIGGER_WEIGHTS,
    RECENCY_WEIGHTS,
    RELEVANCE_MULTIPLIERS,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM07StrategicContextModule:
    """Test suite for M07StrategicContextModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M07StrategicContextModule()

    @pytest.fixture
    def valid_news_response(self):
        """Mock news search response."""
        now = datetime.now()
        return {
            "recent_news": [
                {
                    "title": "Sally Beauty Reports Q1 2026 Earnings",
                    "date": now.strftime("%Y-%m-%d"),
                    "url": "https://businesswire.com/news/sally-beauty-q1-2026",
                    "summary": "Sally Beauty Holdings reported Q1 2026 earnings with e-commerce growth of 11%.",
                    "category": "financial",
                },
                {
                    "title": "Sally Beauty Launches New Mobile App",
                    "date": (now - timedelta(days=14)).strftime("%Y-%m-%d"),
                    "url": "https://businesswire.com/news/sally-beauty-mobile",
                    "summary": "Company launches redesigned mobile app with improved search functionality.",
                    "category": "product",
                },
            ],
            "source_url": "https://news.google.com/search?q=sallybeauty.com",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def valid_trigger_response(self):
        """Mock trigger events search response."""
        now = datetime.now()
        return {
            "trigger_events": [
                {
                    "type": "digital_initiative",
                    "title": "Sally Beauty Announces $50M Digital Investment",
                    "description": "Sally Beauty Holdings commits to major e-commerce and search platform overhaul.",
                    "date": (now - timedelta(days=7)).strftime("%Y-%m-%d"),
                    "source_url": "https://businesswire.com/news/sally-digital",
                    "algolia_relevance": "high",
                    "algolia_relevance_reason": "Direct investment in search capabilities.",
                },
                {
                    "type": "executive_change",
                    "title": "Sally Beauty Appoints New CTO",
                    "description": "New CTO brings experience from leading e-commerce companies.",
                    "date": (now - timedelta(days=30)).strftime("%Y-%m-%d"),
                    "source_url": "https://businesswire.com/news/sally-cto",
                    "algolia_relevance": "medium",
                    "algolia_relevance_reason": "Leadership change often drives technology decisions.",
                },
            ],
            "source_url": "https://news.google.com/search?q=sallybeauty.com+digital+transformation",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def valid_strategic_response(self):
        """Mock strategic initiatives search response."""
        now = datetime.now()
        return {
            "digital_transformation_initiatives": [
                {
                    "name": "Omnichannel Excellence Program",
                    "description": "Sally Beauty's multi-year program to unify online and in-store experiences.",
                    "announced_date": (now - timedelta(days=60)).strftime("%Y-%m-%d"),
                    "source_url": "https://sallybeautyholdings.com/investor-relations/strategy",
                    "investment_amount": 50000000,
                    "technologies_mentioned": ["e-commerce", "search", "personalization", "mobile"],
                    "search_relevance": "high",
                }
            ],
            "expansion_signals": [
                {
                    "type": "new_market",
                    "title": "Sally Beauty Expands to Canada",
                    "description": "Company launches e-commerce operations in Canadian market.",
                    "date": (now - timedelta(days=45)).strftime("%Y-%m-%d"),
                    "source_url": "https://businesswire.com/news/sally-canada",
                    "regions": ["Canada"],
                }
            ],
            "competitor_mentions": ["Ulta Beauty", "Sephora"],
            "source_url": "https://www.sallybeauty.com/about/strategy",
            "source_date": now.isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m07_strategic"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Strategic Context"

    def test_module_wave(self, module):
        """Test module is in Wave 2 (Competitive)."""
        assert module.WAVE == 2

    def test_module_has_no_dependencies(self, module):
        """Test module has no strict dependencies."""
        assert module.DEPENDS_ON == []

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "webpage"

    def test_module_cache_ttl(self, module):
        """Test module has 3-day cache TTL for timely strategic data."""
        assert module.CACHE_TTL == 259200  # 3 days in seconds

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_search_company_news_returns_valid_data(
        self, module, valid_news_response
    ):
        """Test news search returns expected structure."""
        with patch.object(
            module, "_call_websearch_news", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_news_response

            result = await module._search_company_news("sallybeauty.com", "Sally Beauty")

            assert "recent_news" in result
            assert len(result["recent_news"]) > 0
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_search_trigger_events_returns_valid_data(
        self, module, valid_trigger_response
    ):
        """Test trigger event search returns expected structure."""
        with patch.object(
            module, "_call_websearch_triggers", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_trigger_response

            result = await module._search_trigger_events("sallybeauty.com", "Sally Beauty")

            assert "trigger_events" in result
            assert len(result["trigger_events"]) > 0
            # Verify trigger event structure
            trigger = result["trigger_events"][0]
            assert "type" in trigger
            assert "title" in trigger
            assert "description" in trigger
            assert "date" in trigger
            assert "source_url" in trigger
            assert "algolia_relevance" in trigger

    @pytest.mark.asyncio
    async def test_search_strategic_initiatives_returns_valid_data(
        self, module, valid_strategic_response
    ):
        """Test strategic initiatives search returns expected structure."""
        with patch.object(
            module, "_call_websearch_strategic", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_strategic_response

            result = await module._search_strategic_initiatives(
                "sallybeauty.com", "Sally Beauty"
            )

            assert "digital_transformation_initiatives" in result
            assert "expansion_signals" in result
            assert len(result["digital_transformation_initiatives"]) > 0

    @pytest.mark.asyncio
    async def test_fetch_data_merges_sources(
        self, module, valid_news_response, valid_trigger_response, valid_strategic_response
    ):
        """Test fetch_data properly merges all search results."""
        with patch.object(
            module, "_search_company_news", new_callable=AsyncMock
        ) as mock_news, patch.object(
            module, "_search_trigger_events", new_callable=AsyncMock
        ) as mock_triggers, patch.object(
            module, "_search_strategic_initiatives", new_callable=AsyncMock
        ) as mock_strategic:
            mock_news.return_value = valid_news_response
            mock_triggers.return_value = valid_trigger_response
            mock_strategic.return_value = valid_strategic_response

            result = await module.fetch_data("sallybeauty.com")

            # Should have data from all sources
            assert "recent_news" in result
            assert "trigger_events" in result
            assert "digital_transformation_initiatives" in result
            assert "expansion_signals" in result
            assert "source_url" in result
            assert "source_date" in result

    # =========================================================================
    # Source Merging Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_merge_sources_combines_all_data(self, module):
        """Test that merge combines data from all search sources."""
        now = datetime.now()

        news_data = {
            "recent_news": [{"title": "News 1", "date": now.strftime("%Y-%m-%d")}],
            "source_url": "https://news.google.com/1",
            "source_date": now.isoformat(),
        }
        trigger_data = {
            "trigger_events": [{"type": "executive_change", "title": "Trigger 1"}],
            "source_url": "https://news.google.com/2",
            "source_date": now.isoformat(),
        }
        strategic_data = {
            "digital_transformation_initiatives": [{"name": "Initiative 1"}],
            "expansion_signals": [{"type": "new_market"}],
            "competitor_mentions": ["Competitor A"],
            "source_url": "https://company.com/strategy",
            "source_date": now.isoformat(),
        }

        result = await module._merge_sources(news_data, trigger_data, strategic_data)

        assert len(result["recent_news"]) == 1
        assert len(result["trigger_events"]) == 1
        assert len(result["digital_transformation_initiatives"]) == 1
        assert len(result["expansion_signals"]) == 1
        assert result["competitor_mentions"] == ["Competitor A"]

    @pytest.mark.asyncio
    async def test_merge_sources_handles_empty_sources(self, module):
        """Test merge handles some sources being empty."""
        now = datetime.now()

        news_data = {
            "recent_news": [{"title": "News 1"}],
            "source_url": "https://news.google.com",
            "source_date": now.isoformat(),
        }
        trigger_data = {}
        strategic_data = {}

        result = await module._merge_sources(news_data, trigger_data, strategic_data)

        assert len(result["recent_news"]) == 1
        assert result["trigger_events"] == []
        assert result["digital_transformation_initiatives"] == []

    # =========================================================================
    # Urgency Score Calculation Tests
    # =========================================================================

    def test_urgency_score_empty_triggers(self, module):
        """Test urgency score is 0 with no triggers."""
        score = module._calculate_urgency_score([])
        assert score == 0.0

    def test_urgency_score_single_high_relevance_recent_trigger(self, module):
        """Test urgency score calculation with ideal trigger."""
        now = datetime.now()
        triggers = [
            {
                "type": "digital_initiative",
                "date": now.strftime("%Y-%m-%d"),
                "algolia_relevance": "high",
            }
        ]

        score = module._calculate_urgency_score(triggers)

        # digital_initiative (30) * recency 1.0 * relevance 1.0 = 30
        assert score >= 25  # Allow some variance
        assert score <= 35

    def test_urgency_score_multiple_triggers_stack(self, module):
        """Test multiple triggers add to urgency score."""
        now = datetime.now()
        triggers = [
            {
                "type": "digital_initiative",
                "date": now.strftime("%Y-%m-%d"),
                "algolia_relevance": "high",
            },
            {
                "type": "executive_change",
                "date": now.strftime("%Y-%m-%d"),
                "algolia_relevance": "medium",
            },
        ]

        score = module._calculate_urgency_score(triggers)

        # Should be higher than single trigger
        assert score > 30

    def test_urgency_score_old_triggers_penalized(self, module):
        """Test older triggers have reduced impact."""
        now = datetime.now()
        old_date = (now - timedelta(days=200)).strftime("%Y-%m-%d")

        triggers = [
            {
                "type": "digital_initiative",
                "date": old_date,
                "algolia_relevance": "high",
            }
        ]

        score = module._calculate_urgency_score(triggers)

        # 200 days old = 0.2 multiplier, so 30 * 0.2 * 1.0 = 6
        assert score < 15

    def test_urgency_score_low_relevance_penalized(self, module):
        """Test low relevance triggers have reduced impact."""
        now = datetime.now()
        triggers = [
            {
                "type": "digital_initiative",
                "date": now.strftime("%Y-%m-%d"),
                "algolia_relevance": "low",
            }
        ]

        score = module._calculate_urgency_score(triggers)

        # 30 * 1.0 * 0.4 = 12
        assert score < 15

    def test_urgency_score_caps_at_100(self, module):
        """Test urgency score is capped at 100."""
        now = datetime.now()
        # Create many high-value triggers that would exceed 100
        triggers = [
            {
                "type": "digital_initiative",
                "date": now.strftime("%Y-%m-%d"),
                "algolia_relevance": "high",
            }
            for _ in range(10)  # 10 triggers at 30 points each = 300 before cap
        ]

        score = module._calculate_urgency_score(triggers)

        assert score == 100.0

    # =========================================================================
    # Recency Multiplier Tests
    # =========================================================================

    def test_recency_multiplier_recent(self, module):
        """Test recency multiplier for very recent events."""
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")

        multiplier = module._get_recency_multiplier(date_str, now)

        assert multiplier == 1.0

    def test_recency_multiplier_one_month(self, module):
        """Test recency multiplier for events ~30 days old."""
        now = datetime.now()
        date_str = (now - timedelta(days=20)).strftime("%Y-%m-%d")

        multiplier = module._get_recency_multiplier(date_str, now)

        assert multiplier == 0.8

    def test_recency_multiplier_old(self, module):
        """Test recency multiplier for very old events."""
        now = datetime.now()
        date_str = (now - timedelta(days=400)).strftime("%Y-%m-%d")

        multiplier = module._get_recency_multiplier(date_str, now)

        assert multiplier == 0.1

    def test_recency_multiplier_invalid_date(self, module):
        """Test recency multiplier with invalid date string."""
        now = datetime.now()

        multiplier = module._get_recency_multiplier("invalid-date", now)

        assert multiplier == 0.2  # Default for unknown

    def test_recency_multiplier_empty_date(self, module):
        """Test recency multiplier with empty date string."""
        now = datetime.now()

        multiplier = module._get_recency_multiplier("", now)

        assert multiplier == 0.2

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(self, module):
        """Test transform_data creates data matching StrategicContextData schema."""
        now = datetime.now()
        raw_data = {
            "domain": "sallybeauty.com",
            "recent_news": [
                {"title": "News Item", "date": now.strftime("%Y-%m-%d"), "url": "https://example.com/news"}
            ],
            "trigger_events": [
                {
                    "type": "digital_initiative",
                    "title": "Digital Investment",
                    "description": "Major investment in e-commerce.",
                    "date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://businesswire.com/news",
                    "algolia_relevance": "high",
                }
            ],
            "digital_transformation_initiatives": [
                {
                    "name": "Omnichannel Program",
                    "description": "Unify customer experience.",
                    "announced_date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://company.com/strategy",
                    "search_relevance": "high",
                }
            ],
            "expansion_signals": [
                {
                    "type": "new_market",
                    "title": "Canada Expansion",
                    "description": "Launch in Canada.",
                    "date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://businesswire.com/news",
                    "regions": ["Canada"],
                }
            ],
            "competitor_mentions": ["Ulta", "Sephora"],
            "source_url": "https://news.google.com/search",
            "source_date": now.isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "sallybeauty.com"
        assert len(result["recent_news"]) == 1
        assert len(result["trigger_events"]) == 1
        assert len(result["digital_transformation_initiatives"]) == 1
        assert len(result["expansion_signals"]) == 1
        assert result["urgency_score"] > 0
        assert result["strategic_summary"] is not None
        assert result["competitor_mentions"] == ["Ulta", "Sephora"]

    @pytest.mark.asyncio
    async def test_transform_data_handles_missing_fields(self, module):
        """Test transform_data handles missing optional fields gracefully."""
        now = datetime.now()
        raw_data = {
            "domain": "example.com",
            "source_url": "https://news.google.com/search",
            "source_date": now.isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "example.com"
        assert result["recent_news"] == []
        assert result["trigger_events"] == []
        assert result["digital_transformation_initiatives"] == []
        assert result["expansion_signals"] == []
        assert result["urgency_score"] == 0.0
        assert result["competitor_mentions"] == []

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
                "trigger_events": [],
                "recent_news": [],
                "digital_transformation_initiatives": [],
                "expansion_signals": [],
                "competitor_mentions": [],
                "source_url": "https://news.google.com/search?q=example.com",
                "source_date": now.isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "news.google.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "trigger_events": [],
                "recent_news": [],
                "digital_transformation_initiatives": [],
                "expansion_signals": [],
                "competitor_mentions": [],
                "source_url": "https://news.google.com/search?q=example.com",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.source.date is not None
            # Date should be within last minute (accounting for test execution time)
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        now = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            # Return data without source_url
            mock_fetch.return_value = {
                "domain": "example.com",
                "trigger_events": [],
                "source_date": now.isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_date MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            # Return data without source_date
            mock_fetch.return_value = {
                "domain": "example.com",
                "trigger_events": [],
                "source_url": "https://news.google.com/search",
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
                "trigger_events": [],
                "recent_news": [],
                "digital_transformation_initiatives": [],
                "expansion_signals": [],
                "competitor_mentions": [],
                "source_url": "https://news.google.com/search",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Strategic Summary Generation Tests
    # =========================================================================

    def test_strategic_summary_high_urgency(self, module):
        """Test summary generation for high urgency scenario."""
        now = datetime.now()
        data = {
            "trigger_events": [
                {
                    "type": "digital_initiative",
                    "date": now.strftime("%Y-%m-%d"),
                    "algolia_relevance": "high",
                }
            ],
            "digital_transformation_initiatives": [
                {"search_relevance": "high"}
            ],
            "expansion_signals": [],
        }

        summary = module._generate_strategic_summary(data, 75.0)

        assert "HIGH URGENCY" in summary
        assert "digital initiative" in summary.lower()

    def test_strategic_summary_moderate_urgency(self, module):
        """Test summary generation for moderate urgency scenario."""
        data = {
            "trigger_events": [],
            "digital_transformation_initiatives": [],
            "expansion_signals": [{"type": "new_market"}],
        }

        summary = module._generate_strategic_summary(data, 50.0)

        assert "MODERATE URGENCY" in summary

    def test_strategic_summary_low_urgency(self, module):
        """Test summary generation for low urgency scenario."""
        data = {
            "trigger_events": [],
            "digital_transformation_initiatives": [],
            "expansion_signals": [],
        }

        summary = module._generate_strategic_summary(data, 10.0)

        assert "LOW URGENCY" in summary

    # =========================================================================
    # Last Major Announcement Tests
    # =========================================================================

    def test_find_last_major_announcement_with_events(self, module):
        """Test finding most recent announcement date."""
        now = datetime.now()
        events = [
            {"date": (now - timedelta(days=30)).strftime("%Y-%m-%d")},
            {"date": (now - timedelta(days=7)).strftime("%Y-%m-%d")},  # Most recent
            {"announced_date": (now - timedelta(days=60)).strftime("%Y-%m-%d")},
        ]

        result = module._find_last_major_announcement(events)

        # Should return the most recent date
        expected = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        assert result == expected

    def test_find_last_major_announcement_empty(self, module):
        """Test with no events."""
        result = module._find_last_major_announcement([])

        assert result is None

    def test_find_last_major_announcement_no_dates(self, module):
        """Test with events that have no date fields."""
        events = [
            {"title": "Event without date"},
            {"description": "Another event without date"},
        ]

        result = module._find_last_major_announcement(events)

        assert result is None

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(
        self, module, valid_news_response, valid_trigger_response, valid_strategic_response
    ):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_search_company_news", new_callable=AsyncMock
        ) as mock_news, patch.object(
            module, "_search_trigger_events", new_callable=AsyncMock
        ) as mock_triggers, patch.object(
            module, "_search_strategic_initiatives", new_callable=AsyncMock
        ) as mock_strategic:
            mock_news.return_value = valid_news_response
            mock_triggers.return_value = valid_trigger_response
            mock_strategic.return_value = valid_strategic_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m07_strategic"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, StrategicContextData)
            assert len(result.data.recent_news) > 0
            assert len(result.data.trigger_events) > 0
            assert len(result.data.digital_transformation_initiatives) > 0
            assert result.data.urgency_score > 0

            # Verify source citation
            assert result.source is not None
            assert result.source.url is not None

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and fetches fresh data."""
        now = datetime.now()
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()  # Would return cached data

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = {
                    "domain": "example.com",
                    "trigger_events": [],
                    "recent_news": [],
                    "digital_transformation_initiatives": [],
                    "expansion_signals": [],
                    "competitor_mentions": [],
                    "source_url": "https://news.google.com/search",
                    "source_date": now.isoformat(),
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
    async def test_handles_news_search_failure(self, module):
        """Test graceful handling when news search fails."""
        now = datetime.now()
        with patch.object(
            module, "_search_company_news", new_callable=AsyncMock
        ) as mock_news, patch.object(
            module, "_search_trigger_events", new_callable=AsyncMock
        ) as mock_triggers, patch.object(
            module, "_search_strategic_initiatives", new_callable=AsyncMock
        ) as mock_strategic:
            # News search fails
            mock_news.side_effect = Exception("News API timeout")

            # Others succeed
            mock_triggers.return_value = {
                "trigger_events": [],
                "source_url": "https://news.google.com/triggers",
                "source_date": now.isoformat(),
            }
            mock_strategic.return_value = {
                "digital_transformation_initiatives": [],
                "expansion_signals": [],
                "competitor_mentions": [],
                "source_url": "https://company.com/strategy",
                "source_date": now.isoformat(),
            }

            # Should still work with fallback sources
            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)

    @pytest.mark.asyncio
    async def test_fails_when_all_sources_fail(self, module):
        """Test appropriate error when all data sources fail."""
        with patch.object(
            module, "_search_company_news", new_callable=AsyncMock
        ) as mock_news, patch.object(
            module, "_search_trigger_events", new_callable=AsyncMock
        ) as mock_triggers, patch.object(
            module, "_search_strategic_initiatives", new_callable=AsyncMock
        ) as mock_strategic:
            mock_news.side_effect = Exception("News API timeout")
            mock_triggers.side_effect = Exception("Trigger API timeout")
            mock_strategic.side_effect = Exception("Strategic API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("example.com")

            # Should indicate enrichment failure
            assert "fail" in str(exc_info.value).lower()

    # =========================================================================
    # StrategicContextData Model Tests
    # =========================================================================

    def test_strategic_context_data_model_creation(self):
        """Test StrategicContextData pydantic model creation."""
        now = datetime.now()
        data = StrategicContextData(
            domain="example.com",
            digital_transformation_initiatives=[
                {
                    "name": "Digital Program",
                    "description": "Transform digital experience.",
                    "announced_date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://example.com/strategy",
                    "search_relevance": "high",
                }
            ],
            expansion_signals=[
                {
                    "type": "new_market",
                    "title": "APAC Expansion",
                    "description": "Expanding to Asia Pacific.",
                    "date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://businesswire.com/news",
                    "regions": ["Japan", "Australia"],
                }
            ],
            recent_news=[
                {
                    "title": "Company News",
                    "date": now.strftime("%Y-%m-%d"),
                    "url": "https://businesswire.com/news",
                    "summary": "Summary",
                }
            ],
            trigger_events=[
                {
                    "type": "digital_initiative",
                    "title": "E-commerce Investment",
                    "description": "Major e-commerce investment.",
                    "date": now.strftime("%Y-%m-%d"),
                    "source_url": "https://businesswire.com/news",
                    "algolia_relevance": "high",
                }
            ],
            urgency_score=75.0,
            strategic_summary="HIGH URGENCY: Major investment in digital.",
            last_major_announcement=now.strftime("%Y-%m-%d"),
            competitor_mentions=["Competitor A", "Competitor B"],
        )

        assert data.domain == "example.com"
        assert len(data.digital_transformation_initiatives) == 1
        assert len(data.expansion_signals) == 1
        assert len(data.trigger_events) == 1
        assert data.urgency_score == 75.0

    def test_strategic_context_data_with_minimal_fields(self):
        """Test StrategicContextData with only required fields."""
        data = StrategicContextData(
            domain="example.com",
        )

        assert data.domain == "example.com"
        assert data.digital_transformation_initiatives == []
        assert data.expansion_signals == []
        assert data.recent_news == []
        assert data.trigger_events == []
        assert data.urgency_score == 0.0
        assert data.strategic_summary is None
        assert data.competitor_mentions == []

    def test_strategic_context_data_urgency_score_bounds(self):
        """Test urgency_score is bounded between 0 and 100."""
        # Valid score at boundary
        data = StrategicContextData(domain="example.com", urgency_score=100.0)
        assert data.urgency_score == 100.0

        data = StrategicContextData(domain="example.com", urgency_score=0.0)
        assert data.urgency_score == 0.0

        # Invalid scores should raise validation error
        with pytest.raises(Exception):
            StrategicContextData(domain="example.com", urgency_score=101.0)

        with pytest.raises(Exception):
            StrategicContextData(domain="example.com", urgency_score=-1.0)

    def test_strategic_context_data_model_dump(self):
        """Test StrategicContextData can be serialized."""
        data = StrategicContextData(
            domain="example.com",
            urgency_score=50.0,
            competitor_mentions=["Competitor A"],
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["urgency_score"] == 50.0

    # =========================================================================
    # Trigger Event Model Tests
    # =========================================================================

    def test_trigger_event_model_creation(self):
        """Test TriggerEvent pydantic model creation."""
        now = datetime.now()
        event = TriggerEvent(
            type="digital_initiative",
            title="E-commerce Platform Upgrade",
            description="Company announces major e-commerce platform upgrade.",
            date=now.strftime("%Y-%m-%d"),
            source_url="https://businesswire.com/news",
            algolia_relevance="high",
            algolia_relevance_reason="Direct investment in search capabilities.",
        )

        assert event.type == "digital_initiative"
        assert event.algolia_relevance == "high"

    def test_expansion_signal_model_creation(self):
        """Test ExpansionSignal pydantic model creation."""
        signal = ExpansionSignal(
            type="new_market",
            title="APAC Expansion",
            description="Company expands to APAC markets.",
            date="2026-02-01",
            source_url="https://businesswire.com/news",
            regions=["Japan", "Singapore"],
        )

        assert signal.type == "new_market"
        assert "Japan" in signal.regions

    def test_digital_initiative_model_creation(self):
        """Test DigitalInitiative pydantic model creation."""
        initiative = DigitalInitiative(
            name="Omnichannel Program",
            description="Transform customer experience across channels.",
            announced_date="2026-01-15",
            source_url="https://company.com/strategy",
            investment_amount=50000000,
            technologies_mentioned=["e-commerce", "search", "personalization"],
            search_relevance="high",
        )

        assert initiative.name == "Omnichannel Program"
        assert initiative.investment_amount == 50000000
        assert "search" in initiative.technologies_mentioned


class TestM07ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M07 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m07_strategic")
        assert module_class is not None
        assert module_class.MODULE_ID == "m07_strategic"

    def test_module_in_wave_2(self):
        """Test M07 module appears in Wave 2 modules."""
        from app.modules.base import get_modules_by_wave

        wave_2_modules = get_modules_by_wave(2)
        module_ids = [cls.MODULE_ID for cls in wave_2_modules]

        assert "m07_strategic" in module_ids


class TestTriggerWeights:
    """Test trigger type weight configuration."""

    def test_digital_initiative_highest_weight(self):
        """Test digital_initiative has highest weight (most relevant to Algolia)."""
        assert TRIGGER_WEIGHTS["digital_initiative"] >= max(
            w for k, w in TRIGGER_WEIGHTS.items() if k != "digital_initiative"
        )

    def test_tech_refresh_high_weight(self):
        """Test tech_refresh has high weight."""
        assert TRIGGER_WEIGHTS["tech_refresh"] >= 25

    def test_all_trigger_types_have_weights(self):
        """Test all expected trigger types have defined weights."""
        expected_types = [
            "executive_change",
            "acquisition",
            "new_market",
            "digital_initiative",
            "competitor_win",
            "tech_refresh",
        ]
        for trigger_type in expected_types:
            assert trigger_type in TRIGGER_WEIGHTS


class TestRecencyWeights:
    """Test recency weight configuration."""

    def test_recency_weights_decrease_over_time(self):
        """Test recency weights decrease as events get older."""
        sorted_weights = sorted(RECENCY_WEIGHTS.items())
        for i in range(len(sorted_weights) - 1):
            assert sorted_weights[i][1] > sorted_weights[i + 1][1]

    def test_most_recent_has_full_weight(self):
        """Test events within 7 days have full weight."""
        assert RECENCY_WEIGHTS[7] == 1.0


class TestRelevanceMultipliers:
    """Test Algolia relevance multiplier configuration."""

    def test_high_relevance_full_multiplier(self):
        """Test high relevance has full multiplier."""
        assert RELEVANCE_MULTIPLIERS["high"] == 1.0

    def test_low_relevance_reduced_multiplier(self):
        """Test low relevance has reduced multiplier."""
        assert RELEVANCE_MULTIPLIERS["low"] < RELEVANCE_MULTIPLIERS["medium"]
        assert RELEVANCE_MULTIPLIERS["medium"] < RELEVANCE_MULTIPLIERS["high"]
