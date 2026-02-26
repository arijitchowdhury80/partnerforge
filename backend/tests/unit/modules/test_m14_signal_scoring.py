"""
Unit tests for M14_SignalScoring Intelligence Module.

Tests the signal scoring module which scores and prioritizes all detected signals
to identify optimal engagement timing. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m14_signal_scoring import (
    M14SignalScoringModule,
    SignalScoringData,
    Signal,
    SignalCategorySummary,
    RecommendedTiming,
    SignalType,
    SignalUrgency,
    SignalCategory,
    SIGNAL_CONFIG,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM14SignalScoringModule:
    """Test suite for M14SignalScoringModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M14SignalScoringModule()

    @pytest.fixture
    def valid_signals_raw(self):
        """Mock raw signals data."""
        now = datetime.now()
        return [
            {
                "type": SignalType.EXECUTIVE_CHANGE.value,
                "description": "New CIO appointed in October 2025",
                "evidence": "Scott Lindblom joined as SVP & CIO",
                "detected_at": (now - timedelta(days=30)).isoformat(),
                "source_url": "https://linkedin.com/company/sallybeauty/",
                "source_date": (now - timedelta(days=30)).isoformat(),
            },
            {
                "type": SignalType.TECH_REMOVAL.value,
                "description": "Search provider removed from tech stack",
                "evidence": "Elasticsearch no longer detected",
                "detected_at": (now - timedelta(days=10)).isoformat(),
                "source_url": "https://builtwith.com/sallybeauty.com",
                "source_date": (now - timedelta(days=10)).isoformat(),
            },
            {
                "type": SignalType.HIRING_SPIKE.value,
                "description": "Active hiring for search-related roles",
                "evidence": "5 open positions mentioning search",
                "detected_at": (now - timedelta(days=5)).isoformat(),
                "source_url": "https://www.sallybeauty.com/careers/",
                "source_date": (now - timedelta(days=5)).isoformat(),
            },
        ]

    @pytest.fixture
    def valid_fetch_response(self, valid_signals_raw):
        """Mock fetch_data response."""
        now = datetime.now()
        return {
            "domain": "sallybeauty.com",
            "signals": valid_signals_raw,
            "source_urls": [
                "https://linkedin.com/company/sallybeauty/",
                "https://builtwith.com/sallybeauty.com",
                "https://www.sallybeauty.com/careers/",
            ],
            "source_url": "https://partnerforge.app/signals/sallybeauty.com",
            "source_date": now.isoformat(),
            "errors": [],
        }

    @pytest.fixture
    def mock_dependency_data(self):
        """Mock dependency data from previous modules."""
        now = datetime.now()
        return {
            "m06_hiring": {
                "search_roles_count": 5,
                "open_positions": ["VP Search Engineering", "Search Product Manager", "ML Engineer"],
                "source_url": "https://www.sallybeauty.com/careers/",
                "source_date": now.isoformat(),
            },
            "m09_executive": {
                "recent_changes": [
                    {
                        "name": "Scott Lindblom",
                        "title": "CIO",
                        "is_recent": True,
                        "date": (now - timedelta(days=60)).isoformat(),
                        "context": "Joined from Adobe",
                        "source_url": "https://linkedin.com/in/scottlindblom/",
                        "source_date": (now - timedelta(days=60)).isoformat(),
                    }
                ],
                "source_url": "https://seekingalpha.com/sallybeauty",
                "source_date": now.isoformat(),
            },
            "m02_tech_stack": {
                "removed_technologies": [
                    {
                        "name": "Elasticsearch",
                        "category": "search",
                        "last_detected": "2025-10-01",
                        "removal_date": (now - timedelta(days=30)).isoformat(),
                        "source_url": "https://builtwith.com/sallybeauty.com",
                        "source_date": (now - timedelta(days=30)).isoformat(),
                    }
                ],
                "source_url": "https://builtwith.com/sallybeauty.com",
                "source_date": now.isoformat(),
            },
            "m07_strategic": {
                "digital_initiatives": [
                    {
                        "name": "Search experience overhaul",
                        "details": "CEO mentioned 'more efficient search' in Q1 call",
                        "announced_date": (now - timedelta(days=20)).isoformat(),
                        "source_url": "https://seekingalpha.com/sallybeauty-earnings",
                        "source_date": (now - timedelta(days=20)).isoformat(),
                    }
                ],
                "source_url": "https://seekingalpha.com/sallybeauty",
                "source_date": now.isoformat(),
            },
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m14_signal_scoring"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Signal Scoring"

    def test_module_wave(self, module):
        """Test module is in Wave 4 (Synthesis)."""
        assert module.WAVE == 4

    def test_module_has_dependencies(self, module):
        """Test Wave 4 module has dependencies on all previous modules."""
        assert len(module.DEPENDS_ON) == 13
        assert "m01_company_context" in module.DEPENDS_ON
        assert "m13_icp_priority" in module.DEPENDS_ON

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "synthesis"

    # =========================================================================
    # Signal Configuration Tests
    # =========================================================================

    def test_signal_config_has_all_types(self):
        """Test SIGNAL_CONFIG covers all signal types."""
        for signal_type in SignalType:
            assert signal_type in SIGNAL_CONFIG, f"Missing config for {signal_type}"

    def test_signal_config_structure(self):
        """Test each signal config has required fields."""
        required_fields = ["base_score", "urgency", "category", "decay_days", "description"]
        for signal_type, config in SIGNAL_CONFIG.items():
            for field in required_fields:
                assert field in config, f"Missing {field} in config for {signal_type}"

    def test_critical_signals_have_high_base_score(self):
        """Test critical signals have appropriately high base scores."""
        for signal_type, config in SIGNAL_CONFIG.items():
            if config["urgency"] == SignalUrgency.CRITICAL:
                assert config["base_score"] >= 30, f"{signal_type} critical but low score"

    def test_negative_signals_have_negative_score(self):
        """Test negative category signals have negative base score."""
        for signal_type, config in SIGNAL_CONFIG.items():
            if config["category"] == SignalCategory.NEGATIVE:
                assert config["base_score"] < 0, f"{signal_type} negative category but positive score"

    # =========================================================================
    # Signal Processing Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_process_signal_calculates_decay(self, module):
        """Test signal processing applies decay based on age."""
        now = datetime.now()
        old_signal = {
            "type": SignalType.EXECUTIVE_CHANGE.value,
            "description": "Old executive change",
            "detected_at": (now - timedelta(days=60)).isoformat(),  # 60 days old
            "source_url": "https://example.com",
            "source_date": (now - timedelta(days=60)).isoformat(),
        }

        result = await module._process_signal(old_signal, now)

        # Executive change has 90-day decay, so at 60 days: 1 - (60/90) = 0.33
        assert result is not None
        assert result.decay_factor < 1.0
        assert result.decay_factor > 0.3
        assert result.effective_score < result.score

    @pytest.mark.asyncio
    async def test_process_signal_fresh_signal_no_decay(self, module):
        """Test fresh signals have minimal decay."""
        now = datetime.now()
        fresh_signal = {
            "type": SignalType.TECH_REMOVAL.value,
            "description": "Tech just removed",
            "detected_at": (now - timedelta(days=1)).isoformat(),  # 1 day old
            "source_url": "https://example.com",
            "source_date": (now - timedelta(days=1)).isoformat(),
        }

        result = await module._process_signal(fresh_signal, now)

        assert result is not None
        assert result.decay_factor > 0.95  # Almost no decay
        assert abs(result.effective_score - result.score) < 2  # Close to base score

    @pytest.mark.asyncio
    async def test_process_signal_preserves_source_citation(self, module):
        """Test signal processing preserves source URL and date."""
        now = datetime.now()
        signal_data = {
            "type": SignalType.HIRING_SPIKE.value,
            "description": "Hiring spike",
            "detected_at": now.isoformat(),
            "source_url": "https://specific-source.com/hiring",
            "source_date": now.isoformat(),
        }

        result = await module._process_signal(signal_data, now)

        assert result is not None
        assert result.source_url == "https://specific-source.com/hiring"
        assert result.source_date is not None

    @pytest.mark.asyncio
    async def test_process_signal_assigns_correct_category(self, module):
        """Test signals are assigned to correct categories."""
        now = datetime.now()

        # Budget signal
        budget_signal = {
            "type": SignalType.HIRING_SPIKE.value,
            "description": "Hiring",
            "detected_at": now.isoformat(),
            "source_url": "https://example.com",
            "source_date": now.isoformat(),
        }
        result = await module._process_signal(budget_signal, now)
        assert result.category == SignalCategory.BUDGET

        # Pain signal
        pain_signal = {
            "type": SignalType.TECH_REMOVAL.value,
            "description": "Tech removed",
            "detected_at": now.isoformat(),
            "source_url": "https://example.com",
            "source_date": now.isoformat(),
        }
        result = await module._process_signal(pain_signal, now)
        assert result.category == SignalCategory.PAIN

        # Timing signal
        timing_signal = {
            "type": SignalType.EXECUTIVE_CHANGE.value,
            "description": "New exec",
            "detected_at": now.isoformat(),
            "source_url": "https://example.com",
            "source_date": now.isoformat(),
        }
        result = await module._process_signal(timing_signal, now)
        assert result.category == SignalCategory.TIMING

    # =========================================================================
    # Category Summary Tests
    # =========================================================================

    def test_create_category_summary_empty(self, module):
        """Test category summary with no signals."""
        summary = module._create_category_summary(SignalCategory.BUDGET, [])

        assert summary.category == SignalCategory.BUDGET
        assert summary.signal_count == 0
        assert summary.total_score == 0
        assert summary.has_signals is False

    def test_create_category_summary_with_signals(self, module):
        """Test category summary with multiple signals."""
        now = datetime.now()
        signals = [
            Signal(
                type=SignalType.HIRING_SPIKE,
                description="Hiring spike",
                score=20,
                urgency=SignalUrgency.MEDIUM,
                category=SignalCategory.BUDGET,
                detected_at=now,
                decay_factor=1.0,
                effective_score=20.0,
                source_url="https://example.com/1",
                source_date=now,
            ),
            Signal(
                type=SignalType.FUNDING_ROUND,
                description="Series C funding",
                score=30,
                urgency=SignalUrgency.HIGH,
                category=SignalCategory.BUDGET,
                detected_at=now,
                decay_factor=0.8,
                effective_score=24.0,
                source_url="https://example.com/2",
                source_date=now,
            ),
        ]

        summary = module._create_category_summary(SignalCategory.BUDGET, signals)

        assert summary.signal_count == 2
        assert summary.total_score == 44.0
        assert summary.has_signals is True

    # =========================================================================
    # Urgency Score Calculation Tests
    # =========================================================================

    def test_calculate_urgency_score_weighted(self, module):
        """Test urgency score applies correct weights."""
        # Create category summaries with known scores
        budget = SignalCategorySummary(
            category=SignalCategory.BUDGET,
            total_score=100,
            signal_count=2,
            has_signals=True,
        )
        pain = SignalCategorySummary(
            category=SignalCategory.PAIN,
            total_score=100,
            signal_count=1,
            has_signals=True,
        )
        timing = SignalCategorySummary(
            category=SignalCategory.TIMING,
            total_score=100,
            signal_count=1,
            has_signals=True,
        )
        negative = SignalCategorySummary(
            category=SignalCategory.NEGATIVE,
            total_score=0,
            signal_count=0,
            has_signals=False,
        )

        score = module._calculate_urgency_score(budget, pain, timing, negative)

        # With all at 100: (100*0.4 + 100*0.3 + 100*0.3) = 100
        assert score == 100

    def test_calculate_urgency_score_with_negative(self, module):
        """Test urgency score applies negative penalty."""
        budget = SignalCategorySummary(
            category=SignalCategory.BUDGET,
            total_score=50,
            signal_count=1,
            has_signals=True,
        )
        pain = SignalCategorySummary(
            category=SignalCategory.PAIN,
            total_score=50,
            signal_count=1,
            has_signals=True,
        )
        timing = SignalCategorySummary(
            category=SignalCategory.TIMING,
            total_score=50,
            signal_count=1,
            has_signals=True,
        )
        negative = SignalCategorySummary(
            category=SignalCategory.NEGATIVE,
            total_score=-25,  # Layoffs signal
            signal_count=1,
            has_signals=True,
        )

        score = module._calculate_urgency_score(budget, pain, timing, negative)

        # Base: (50*0.4 + 50*0.3 + 50*0.3) = 50, minus penalty (25) = 25
        assert score == 25

    def test_calculate_urgency_score_bounds(self, module):
        """Test urgency score stays within 0-100 bounds."""
        # Test lower bound
        empty = SignalCategorySummary(category=SignalCategory.BUDGET, total_score=0)
        score = module._calculate_urgency_score(empty, empty, empty, empty)
        assert score >= 0

        # Test with large negative
        large_negative = SignalCategorySummary(
            category=SignalCategory.NEGATIVE,
            total_score=-200,  # Very negative
            signal_count=5,
            has_signals=True,
        )
        score = module._calculate_urgency_score(empty, empty, empty, large_negative)
        assert score >= 0

    # =========================================================================
    # Engagement Window Tests
    # =========================================================================

    def test_calculate_engagement_window_default(self, module):
        """Test default engagement window with no signals."""
        window = module._calculate_engagement_window([])
        assert window == 90

    def test_calculate_engagement_window_critical_signal(self, module):
        """Test engagement window shortens for critical signals."""
        now = datetime.now()
        critical_signal = Signal(
            type=SignalType.TECH_REMOVAL,
            description="Search removed",
            score=40,
            urgency=SignalUrgency.CRITICAL,
            category=SignalCategory.PAIN,
            detected_at=now - timedelta(days=10),
            decay_factor=0.9,
            effective_score=36.0,
            source_url="https://example.com",
            source_date=now,
        )

        window = module._calculate_engagement_window([critical_signal])

        # Tech removal has 30-day decay, at 10 days old: 30-10 = 20 days
        assert window <= 30
        assert window >= 14  # Minimum window

    # =========================================================================
    # Timing Recommendation Tests
    # =========================================================================

    def test_generate_timing_recommendation_high_urgency(self, module):
        """Test timing recommendation for high urgency score."""
        now = datetime.now()
        signals = [
            Signal(
                type=SignalType.TECH_REMOVAL,
                description="Search provider removed",
                score=40,
                urgency=SignalUrgency.CRITICAL,
                category=SignalCategory.PAIN,
                detected_at=now,
                decay_factor=1.0,
                effective_score=40.0,
                source_url="https://example.com",
                source_date=now,
            ),
        ]

        rec = module._generate_timing_recommendation(signals, urgency_score=85)

        assert rec is not None
        assert "immediate" in rec.recommended_action.lower()
        assert rec.window_days > 0

    def test_generate_timing_recommendation_medium_urgency(self, module):
        """Test timing recommendation for medium urgency score."""
        now = datetime.now()
        signals = [
            Signal(
                type=SignalType.HIRING_SPIKE,
                description="Active hiring",
                score=20,
                urgency=SignalUrgency.MEDIUM,
                category=SignalCategory.BUDGET,
                detected_at=now,
                decay_factor=1.0,
                effective_score=20.0,
                source_url="https://example.com",
                source_date=now,
            ),
        ]

        rec = module._generate_timing_recommendation(signals, urgency_score=50)

        assert rec is not None
        assert "active" in rec.recommended_action.lower() or "sequence" in rec.recommended_action.lower()

    def test_generate_timing_recommendation_low_urgency(self, module):
        """Test timing recommendation for low urgency score."""
        now = datetime.now()
        signals = [
            Signal(
                type=SignalType.REVENUE_GROWTH,
                description="Revenue growing",
                score=15,
                urgency=SignalUrgency.LOW,
                category=SignalCategory.BUDGET,
                detected_at=now,
                decay_factor=1.0,
                effective_score=15.0,
                source_url="https://example.com",
                source_date=now,
            ),
        ]

        rec = module._generate_timing_recommendation(signals, urgency_score=25)

        assert rec is not None
        assert "monitor" in rec.recommended_action.lower() or "nurture" in rec.recommended_action.lower()

    def test_generate_timing_recommendation_empty(self, module):
        """Test timing recommendation with no signals."""
        rec = module._generate_timing_recommendation([], urgency_score=0)
        assert rec is None

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fetch_data_with_mock_signals(self, module):
        """Test fetch_data returns expected structure."""
        result = await module.fetch_data("example.com")

        assert result["domain"] == "example.com"
        assert "signals" in result
        assert "source_url" in result
        assert "source_date" in result
        assert len(result["signals"]) > 0

    @pytest.mark.asyncio
    async def test_fetch_data_with_dependency_data(self, module, mock_dependency_data):
        """Test fetch_data extracts signals from dependency data."""
        result = await module.fetch_data("sallybeauty.com", mock_dependency_data)

        assert result["domain"] == "sallybeauty.com"
        assert len(result["signals"]) >= 3  # At least from hiring, exec, tech

        # Verify signals were extracted
        signal_types = [s["type"] for s in result["signals"]]
        assert SignalType.HIRING_SPIKE.value in signal_types
        assert SignalType.EXECUTIVE_CHANGE.value in signal_types
        assert SignalType.TECH_REMOVAL.value in signal_types

    @pytest.mark.asyncio
    async def test_extract_signals_from_dependencies_hiring(self, module, mock_dependency_data):
        """Test hiring signals are extracted from m06_hiring."""
        signals, urls = await module._extract_signals_from_dependencies(mock_dependency_data)

        hiring_signals = [s for s in signals if s["type"] == SignalType.HIRING_SPIKE.value]
        assert len(hiring_signals) >= 1
        assert "5" in hiring_signals[0]["description"] or "search" in hiring_signals[0]["description"].lower()

    @pytest.mark.asyncio
    async def test_extract_signals_from_dependencies_executive(self, module, mock_dependency_data):
        """Test executive change signals are extracted from m09_executive."""
        signals, urls = await module._extract_signals_from_dependencies(mock_dependency_data)

        exec_signals = [s for s in signals if s["type"] == SignalType.EXECUTIVE_CHANGE.value]
        assert len(exec_signals) >= 1
        assert "Scott Lindblom" in exec_signals[0]["description"]

    @pytest.mark.asyncio
    async def test_extract_signals_from_dependencies_tech_removal(self, module, mock_dependency_data):
        """Test tech removal signals are extracted from m02_tech_stack."""
        signals, urls = await module._extract_signals_from_dependencies(mock_dependency_data)

        tech_signals = [s for s in signals if s["type"] == SignalType.TECH_REMOVAL.value]
        assert len(tech_signals) >= 1
        assert "Elasticsearch" in tech_signals[0]["description"]

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(self, module, valid_fetch_response):
        """Test transform_data creates data matching SignalScoringData schema."""
        result = await module.transform_data(valid_fetch_response)

        assert result["domain"] == "sallybeauty.com"
        assert "signals" in result
        assert "top_signals" in result
        assert "budget_signals" in result
        assert "pain_signals" in result
        assert "timing_signals" in result
        assert "negative_signals" in result
        assert "urgency_score" in result
        assert "composite_score" in result
        assert "engagement_window_days" in result
        assert "recommended_timing" in result
        assert "signal_count" in result

    @pytest.mark.asyncio
    async def test_transform_data_sorts_by_effective_score(self, module, valid_fetch_response):
        """Test signals are sorted by effective score descending."""
        result = await module.transform_data(valid_fetch_response)

        signals = result["signals"]
        for i in range(len(signals) - 1):
            assert signals[i]["effective_score"] >= signals[i + 1]["effective_score"]

    @pytest.mark.asyncio
    async def test_transform_data_top_signals_limit(self, module, valid_fetch_response):
        """Test top_signals contains at most 5 signals."""
        result = await module.transform_data(valid_fetch_response)

        assert len(result["top_signals"]) <= 5

    @pytest.mark.asyncio
    async def test_transform_data_categorizes_signals(self, module, valid_fetch_response):
        """Test signals are properly categorized."""
        result = await module.transform_data(valid_fetch_response)

        # Budget signals should have hiring spike
        budget = result["budget_signals"]
        assert budget["signal_count"] >= 1

        # Pain signals should have tech removal
        pain = result["pain_signals"]
        assert pain["signal_count"] >= 1

        # Timing signals should have executive change
        timing = result["timing_signals"]
        assert timing["signal_count"] >= 1

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            now = datetime.now()
            mock_fetch.return_value = {
                "domain": "example.com",
                "signals": [{
                    "type": SignalType.HIRING_SPIKE.value,
                    "description": "Test signal",
                    "detected_at": now.isoformat(),
                    "source_url": "https://example.com/signal",
                    "source_date": now.isoformat(),
                }],
                "source_url": "https://partnerforge.app/signals/example.com",
                "source_date": now.isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "partnerforge.app" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "signals": [{
                    "type": SignalType.HIRING_SPIKE.value,
                    "description": "Test signal",
                    "detected_at": source_date.isoformat(),
                    "source_url": "https://example.com/signal",
                    "source_date": source_date.isoformat(),
                }],
                "source_url": "https://partnerforge.app/signals/example.com",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.source.date is not None
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "signals": [],
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
                "signals": [],
                "source_url": "https://partnerforge.app/signals/example.com",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_all_signals_have_source_citation(self, module, valid_fetch_response):
        """TEST SOURCE CITATION MANDATE: Every signal must have source_url and source_date."""
        result = await module.transform_data(valid_fetch_response)

        for signal in result["signals"]:
            assert "source_url" in signal, f"Signal missing source_url: {signal}"
            assert "source_date" in signal, f"Signal missing source_date: {signal}"
            assert signal["source_url"] != "", f"Signal has empty source_url: {signal}"

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_mock_signals", new_callable=AsyncMock
        ) as mock_signals:
            now = datetime.now()
            mock_signals.return_value = [
                {
                    "type": SignalType.EXECUTIVE_CHANGE.value,
                    "description": "New CIO",
                    "evidence": "John Smith joined",
                    "detected_at": now.isoformat(),
                    "source_url": "https://linkedin.com/company/example/",
                    "source_date": now.isoformat(),
                },
                {
                    "type": SignalType.TECH_REMOVAL.value,
                    "description": "Search removed",
                    "evidence": "Elasticsearch gone",
                    "detected_at": now.isoformat(),
                    "source_url": "https://builtwith.com/example.com",
                    "source_date": now.isoformat(),
                },
            ]

            result = await module.enrich("example.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m14_signal_scoring"
            assert result.domain == "example.com"

            # Verify data
            assert isinstance(result.data, SignalScoringData)
            assert result.data.signal_count == 2
            assert result.data.has_pain_signal is True
            assert result.data.has_timing_signal is True
            assert result.data.urgency_score > 0

            # Verify source citation
            assert result.source is not None

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and recalculates."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                now = datetime.now()
                mock_fetch.return_value = {
                    "domain": "example.com",
                    "signals": [{
                        "type": SignalType.HIRING_SPIKE.value,
                        "description": "Test",
                        "detected_at": now.isoformat(),
                        "source_url": "https://example.com",
                        "source_date": now.isoformat(),
                    }],
                    "source_url": "https://partnerforge.app/signals/example.com",
                    "source_date": now.isoformat(),
                }

                await module.enrich("example.com", force=True)

                mock_cache.assert_not_called()
                mock_fetch.assert_called_once()

    # =========================================================================
    # Edge Case Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_handles_empty_signals(self, module):
        """Test handling when no signals are detected."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            now = datetime.now()
            mock_fetch.return_value = {
                "domain": "example.com",
                "signals": [],
                "source_url": "https://partnerforge.app/signals/example.com",
                "source_date": now.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.data.signal_count == 0
            assert result.data.urgency_score == 0
            assert result.data.engagement_window_days == 90

    @pytest.mark.asyncio
    async def test_handles_invalid_signal_type(self, module):
        """Test graceful handling of invalid signal type."""
        now = datetime.now()
        invalid_signal = {
            "type": "invalid_type",
            "description": "Invalid",
            "detected_at": now.isoformat(),
            "source_url": "https://example.com",
            "source_date": now.isoformat(),
        }

        result = await module._process_signal(invalid_signal, now)
        assert result is None  # Should return None for invalid signal

    @pytest.mark.asyncio
    async def test_handles_missing_signal_fields(self, module):
        """Test handling signals with missing optional fields."""
        now = datetime.now()
        minimal_signal = {
            "type": SignalType.HIRING_SPIKE.value,
            "description": "Hiring",
            "detected_at": now.isoformat(),
            "source_url": "https://example.com",
            "source_date": now.isoformat(),
            # Missing: evidence
        }

        result = await module._process_signal(minimal_signal, now)
        assert result is not None
        assert result.evidence is None

    # =========================================================================
    # Model Tests
    # =========================================================================

    def test_signal_model_creation(self):
        """Test Signal pydantic model creation."""
        now = datetime.now()
        signal = Signal(
            type=SignalType.EXECUTIVE_CHANGE,
            description="New CIO appointed",
            score=25,
            urgency=SignalUrgency.HIGH,
            category=SignalCategory.TIMING,
            evidence="John Smith from Google",
            detected_at=now,
            decay_factor=0.9,
            effective_score=22.5,
            source_url="https://linkedin.com/company/example/",
            source_date=now,
        )

        assert signal.type == SignalType.EXECUTIVE_CHANGE
        assert signal.score == 25
        assert signal.effective_score == 22.5
        assert signal.source_url == "https://linkedin.com/company/example/"

    def test_signal_scoring_data_model_creation(self):
        """Test SignalScoringData pydantic model creation."""
        data = SignalScoringData(
            domain="example.com",
            signals=[],
            top_signals=[],
            urgency_score=75,
            composite_score=85.5,
            engagement_window_days=30,
            signal_count=5,
            positive_signal_count=4,
            negative_signal_count=1,
            has_critical_signal=True,
            has_budget_signal=True,
            has_pain_signal=True,
            has_timing_signal=True,
        )

        assert data.domain == "example.com"
        assert data.urgency_score == 75
        assert data.has_critical_signal is True

    def test_recommended_timing_model_creation(self):
        """Test RecommendedTiming pydantic model creation."""
        now = datetime.now()
        timing = RecommendedTiming(
            window_start=now,
            window_end=now + timedelta(days=30),
            window_days=30,
            urgency_reason="Tech stack change detected",
            recommended_action="Immediate outreach",
            best_approach="Lead with pain point",
        )

        assert timing.window_days == 30
        assert "immediate" in timing.recommended_action.lower()

    def test_signal_scoring_data_model_dump(self):
        """Test SignalScoringData can be serialized."""
        data = SignalScoringData(
            domain="example.com",
            urgency_score=50,
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["urgency_score"] == 50


class TestM14ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M14 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m14_signal_scoring")
        assert module_class is not None
        assert module_class.MODULE_ID == "m14_signal_scoring"

    def test_module_in_wave_4(self):
        """Test M14 module appears in Wave 4 modules."""
        from app.modules.base import get_modules_by_wave

        wave_4_modules = get_modules_by_wave(4)
        module_ids = [cls.MODULE_ID for cls in wave_4_modules]

        assert "m14_signal_scoring" in module_ids


class TestSignalEnums:
    """Test signal-related enums."""

    def test_signal_type_values(self):
        """Test SignalType enum has expected values."""
        assert SignalType.EXECUTIVE_CHANGE.value == "executive_change"
        assert SignalType.TECH_REMOVAL.value == "tech_removal"
        assert SignalType.HIRING_SPIKE.value == "hiring_spike"
        assert SignalType.COMPETITOR_LOSS.value == "competitor_loss"
        assert SignalType.EXPANSION_NEWS.value == "expansion_news"

    def test_signal_urgency_values(self):
        """Test SignalUrgency enum has expected values."""
        assert SignalUrgency.CRITICAL.value == "critical"
        assert SignalUrgency.HIGH.value == "high"
        assert SignalUrgency.MEDIUM.value == "medium"
        assert SignalUrgency.LOW.value == "low"

    def test_signal_category_values(self):
        """Test SignalCategory enum has expected values."""
        assert SignalCategory.BUDGET.value == "budget"
        assert SignalCategory.PAIN.value == "pain"
        assert SignalCategory.TIMING.value == "timing"
        assert SignalCategory.NEGATIVE.value == "negative"
