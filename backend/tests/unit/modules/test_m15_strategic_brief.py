"""
Unit tests for M15_StrategicBrief Intelligence Module.

Tests the strategic signal brief module which synthesizes all upstream
intelligence into an AE-ready deliverable. Validates source citation
mandate compliance and brief completeness.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m15_strategic_brief import (
    M15StrategicBriefModule,
    StrategicSignalBriefData,
    TalkingPoint,
    DiscoveryQuestion,
    ObjectionHandler,
    ExecutiveQuote,
    RecommendedCaseStudy,
    PilotStrategy,
    NextStep,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM15StrategicBriefModule:
    """Test suite for M15StrategicBriefModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M15StrategicBriefModule()

    @pytest.fixture
    def valid_upstream_data(self):
        """Mock consolidated upstream data from M01-M14."""
        now = datetime.now()
        return {
            "domain": "costco.com",
            "company_name": "Costco Wholesale Corporation",
            "company_context": {
                "industry": "Retail",
                "sub_industry": "Warehouse Club",
                "employee_count": 300000,
                "headquarters_country": "USA",
                "revenue_estimate": 240000000000,
            },
            "tech_stack": {
                "current_search": "Elasticsearch",
                "cms": "Adobe Experience Manager",
                "ecommerce_platform": "Custom",
                "tech_spend_estimate": 150000,
            },
            "traffic": {
                "monthly_visits": 50000000,
                "unique_visitors": 35000000,
                "search_traffic_share": 0.35,
            },
            "financials": {
                "revenue": 240000000000,
                "gross_margin": 0.13,
                "yoy_growth": 0.07,
                "digital_revenue_estimate": 15000000000,
            },
            "competitors": {
                "search_competitors": ["Walmart", "Sam's Club", "Target"],
                "competitor_search_providers": {
                    "Walmart": "Algolia",
                    "Target": "Bloomreach",
                },
            },
            "executive_intel": {
                "quotes": [
                    {
                        "quote": "We're investing heavily in digital capabilities to enhance member experience",
                        "speaker": "Ron Vachris",
                        "title": "CEO",
                        "date": "2025-12-15",
                        "context": "Q1 2026 Earnings Call",
                        "source_url": "https://seekingalpha.com/costco-q1-2026-transcript",
                    },
                ],
            },
            "case_studies": [
                {
                    "company_name": "Staples",
                    "vertical": "Retail",
                    "headline_metric": "35% search conversion lift",
                    "relevance_score": 0.85,
                    "source_url": "https://algolia.com/customers/staples",
                },
            ],
            "icp_priority": {
                "icp_score": 85,
                "icp_tier": "hot",
                "priority_factors": ["High traffic volume", "Using outdated search"],
            },
            "signal_scoring": {
                "composite_score": 78.5,
                "timing_signals": ["Digital investment mentioned", "E-commerce growth"],
                "risk_signals": ["Large enterprise = long sales cycle"],
            },
            "source_url": "https://partnerforge.algolia.com/briefs/costco.com",
            "source_date": now.isoformat(),
        }

    @pytest.fixture
    def minimal_upstream_data(self):
        """Mock minimal upstream data (sparse modules)."""
        now = datetime.now()
        return {
            "domain": "example.com",
            "company_name": "Example Corp",
            "company_context": {
                "industry": "Technology",
            },
            "tech_stack": {},
            "traffic": {},
            "financials": {},
            "competitors": {},
            "executive_intel": {},
            "case_studies": [],
            "icp_priority": {
                "icp_score": 45,
                "icp_tier": "cool",
            },
            "signal_scoring": {
                "composite_score": 35.0,
            },
            "source_url": "https://partnerforge.algolia.com/briefs/example.com",
            "source_date": now.isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m15_strategic_brief"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Strategic Signal Brief"

    def test_module_wave(self, module):
        """Test module is in Wave 4 (Synthesis)."""
        assert module.WAVE == 4

    def test_module_dependencies(self, module):
        """Test Wave 4 module has correct dependencies."""
        expected_deps = [
            "m01_company_context",
            "m02_tech_stack",
            "m03_traffic",
            "m04_financials",
            "m05_competitors",
            "m06_hiring",
            "m07_strategic",
            "m08_investor",
            "m09_executive",
            "m10_buying_committee",
            "m11_displacement",
            "m12_case_study",
            "m13_icp_priority",
            "m14_signal_scoring",
        ]
        assert module.DEPENDS_ON == expected_deps

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "synthesis"

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_extracts_all_sections(
        self, module, valid_upstream_data
    ):
        """Test transform_data extracts all upstream sections."""
        result = await module.transform_data(valid_upstream_data)

        assert result["domain"] == "costco.com"
        assert result["company_name"] == "Costco Wholesale Corporation"
        assert "company_context" in result
        assert "tech_stack" in result
        assert "traffic" in result
        assert "financials" in result
        assert "competitors" in result
        assert "executive_intel" in result
        assert "case_studies" in result
        assert "icp_priority" in result
        assert "signal_scoring" in result
        assert "source_url" in result
        assert "source_date" in result

    @pytest.mark.asyncio
    async def test_transform_data_handles_missing_sections(
        self, module, minimal_upstream_data
    ):
        """Test transform_data handles missing optional sections."""
        result = await module.transform_data(minimal_upstream_data)

        assert result["domain"] == "example.com"
        assert result["tech_stack"] == {}
        assert result["traffic"] == {}
        assert result["case_studies"] == []

    # =========================================================================
    # Brief Synthesis Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_synthesize_brief_creates_complete_brief(
        self, module, valid_upstream_data
    ):
        """Test _synthesize_brief creates a complete StrategicSignalBriefData."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert isinstance(brief, StrategicSignalBriefData)
        assert brief.domain == "costco.com"
        assert brief.company_name == "Costco Wholesale Corporation"
        assert brief.icp_score == 85
        assert brief.icp_tier == "hot"
        assert brief.signal_score == 78.5

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_executive_summary(
        self, module, valid_upstream_data
    ):
        """Test executive summary is built with full context."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert brief.executive_summary is not None
        assert len(brief.executive_summary) > 50  # Should be substantial
        assert "Costco" in brief.executive_summary
        assert "Retail" in brief.executive_summary or "85" in brief.executive_summary

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_talking_points(
        self, module, valid_upstream_data
    ):
        """Test key talking points are generated."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert len(brief.key_talking_points) > 0
        for point in brief.key_talking_points:
            assert isinstance(point, TalkingPoint)
            assert point.point  # Non-empty
            assert point.category in ["pain_point", "opportunity", "competitive", "value_prop"]
            assert point.priority in [1, 2, 3, 4, 5]
            assert point.source_url  # Source citation mandate

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_discovery_questions(
        self, module, valid_upstream_data
    ):
        """Test discovery questions are generated."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert len(brief.discovery_questions) > 0
        for question in brief.discovery_questions:
            assert isinstance(question, DiscoveryQuestion)
            assert question.question.endswith("?")  # Should be a question
            assert question.intent
            assert question.expected_response_type in ["yes_no", "quantitative", "qualitative"]
            assert question.source_url  # Source citation mandate

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_objection_handlers(
        self, module, valid_upstream_data
    ):
        """Test objection handlers are generated."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert len(brief.objection_handlers) > 0
        for handler in brief.objection_handlers:
            assert isinstance(handler, ObjectionHandler)
            assert handler.objection
            assert handler.response_strategy
            assert len(handler.proof_points) > 0
            assert handler.source_url  # Source citation mandate

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_pilot_strategy(
        self, module, valid_upstream_data
    ):
        """Test pilot strategy is generated."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert brief.pilot_strategy is not None
        assert isinstance(brief.pilot_strategy, PilotStrategy)
        assert brief.pilot_strategy.recommended_scope
        assert len(brief.pilot_strategy.success_metrics) > 0
        assert brief.pilot_strategy.timeline_weeks > 0
        assert brief.pilot_strategy.source_url  # Source citation mandate

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_competitive_positioning(
        self, module, valid_upstream_data
    ):
        """Test competitive positioning is generated."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert brief.competitive_positioning
        assert len(brief.competitive_positioning) > 50  # Should be substantial
        # Should mention the current search provider
        assert "Elasticsearch" in brief.competitive_positioning or "position" in brief.competitive_positioning.lower()

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_executive_quotes(
        self, module, valid_upstream_data
    ):
        """Test speaking their language section with executive quotes."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert len(brief.speaking_their_language) > 0
        quote = brief.speaking_their_language[0]
        assert isinstance(quote, ExecutiveQuote)
        assert quote.speaker == "Ron Vachris"
        assert quote.title == "CEO"
        assert quote.maps_to_algolia  # Should map to Algolia value prop
        assert quote.source_url  # Source citation mandate

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_case_studies(
        self, module, valid_upstream_data
    ):
        """Test recommended case studies are included."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert len(brief.recommended_case_studies) > 0
        case_study = brief.recommended_case_studies[0]
        assert isinstance(case_study, RecommendedCaseStudy)
        assert case_study.company_name == "Staples"
        assert case_study.relevance_score == 0.85
        assert case_study.talking_point
        assert case_study.source_url  # Source citation mandate

    @pytest.mark.asyncio
    async def test_synthesize_brief_builds_next_steps(
        self, module, valid_upstream_data
    ):
        """Test next steps are generated based on ICP tier."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert len(brief.next_steps) > 0
        for step in brief.next_steps:
            assert isinstance(step, NextStep)
            assert step.action
            assert step.owner in ["ae", "se", "customer"]
            assert step.timeline in ["immediate", "this_week", "this_month"]
            assert step.success_criteria

    @pytest.mark.asyncio
    async def test_synthesize_brief_calculates_confidence_score(
        self, module, valid_upstream_data
    ):
        """Test confidence score is calculated based on data completeness."""
        transformed = await module.transform_data(valid_upstream_data)
        brief = await module._synthesize_brief("costco.com", transformed)

        assert 0 <= brief.confidence_score <= 1
        # With full data, confidence should be high
        assert brief.confidence_score >= 0.8

    @pytest.mark.asyncio
    async def test_synthesize_brief_generates_warnings(
        self, module, minimal_upstream_data
    ):
        """Test warnings are generated for missing data."""
        transformed = await module.transform_data(minimal_upstream_data)
        brief = await module._synthesize_brief("example.com", transformed)

        assert len(brief.warnings) > 0
        # Should warn about missing executive quotes
        warning_text = " ".join(brief.warnings).lower()
        assert "quote" in warning_text or "case stud" in warning_text or "incomplete" in warning_text

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module, valid_upstream_data):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        assert isinstance(result, ModuleResult)
        assert result.source is not None
        assert "partnerforge" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module, valid_upstream_data):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        assert result.source.date is not None
        # Date should be within last minute
        assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        data_without_source = {
            "domain": "example.com",
            "company_name": "Example Corp",
            "company_context": {},
            "tech_stack": {},
            "traffic": {},
            "financials": {},
            "competitors": {},
            "executive_intel": {},
            "case_studies": [],
            "icp_priority": {"icp_score": 50, "icp_tier": "cool"},
            "signal_scoring": {"composite_score": 40.0},
            "source_date": datetime.now().isoformat(),
            # source_url is MISSING
        }

        with pytest.raises(MissingSourceError) as exc_info:
            await module.enrich("example.com", upstream_data=data_without_source)

        assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)

        data_with_stale_source = {
            "domain": "example.com",
            "company_name": "Example Corp",
            "company_context": {},
            "tech_stack": {},
            "traffic": {},
            "financials": {},
            "competitors": {},
            "executive_intel": {},
            "case_studies": [],
            "icp_priority": {"icp_score": 50, "icp_tier": "cool"},
            "signal_scoring": {"composite_score": 40.0},
            "source_url": "https://partnerforge.algolia.com/briefs/example.com",
            "source_date": stale_date.isoformat(),
        }

        with pytest.raises(SourceFreshnessError) as exc_info:
            await module.enrich("example.com", upstream_data=data_with_stale_source)

        assert "older than" in str(exc_info.value)

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module, valid_upstream_data):
        """Test complete enrichment pipeline from upstream data to ModuleResult."""
        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        # Verify result structure
        assert isinstance(result, ModuleResult)
        assert result.module_id == "m15_strategic_brief"
        assert result.domain == "costco.com"

        # Verify data
        assert isinstance(result.data, StrategicSignalBriefData)
        assert result.data.company_name == "Costco Wholesale Corporation"
        assert result.data.icp_score == 85
        assert result.data.icp_tier == "hot"

        # Verify brief components
        assert len(result.data.key_talking_points) > 0
        assert len(result.data.discovery_questions) > 0
        assert len(result.data.objection_handlers) > 0
        assert result.data.pilot_strategy is not None
        assert len(result.data.speaking_their_language) > 0
        assert len(result.data.recommended_case_studies) > 0
        assert len(result.data.next_steps) > 0

        # Verify source citation
        assert result.source is not None

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module, valid_upstream_data):
        """Test force=True bypasses cache."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()

            # With force=True, should NOT use cache
            await module.enrich("costco.com", force=True, upstream_data=valid_upstream_data)

            mock_cache.assert_not_called()

    @pytest.mark.asyncio
    async def test_enrich_uses_cache_when_available(self, module):
        """Test cached results are returned when available."""
        cached_result = MagicMock(spec=ModuleResult)

        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = cached_result

            result = await module.enrich("costco.com")

            mock_cache.assert_called_once_with("costco.com")
            assert result == cached_result

    # =========================================================================
    # ICP Tier Specific Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_hot_lead_gets_technical_next_steps(self, module, valid_upstream_data):
        """Test hot leads get technical deep-dive next steps."""
        # valid_upstream_data already has icp_tier: "hot"
        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        next_steps = result.data.next_steps
        next_step_actions = [s.action.lower() for s in next_steps]

        # Should have technical deep-dive step
        assert any("technical" in a or "se" in a or "poc" in a for a in next_step_actions)

    @pytest.mark.asyncio
    async def test_cool_lead_gets_nurture_next_steps(self, module, minimal_upstream_data):
        """Test cool leads get nurture campaign next steps."""
        result = await module.enrich("example.com", upstream_data=minimal_upstream_data)

        next_steps = result.data.next_steps
        next_step_actions = [s.action.lower() for s in next_steps]

        # Should have nurture step
        assert any("nurture" in a or "campaign" in a for a in next_step_actions)

    # =========================================================================
    # Edge Cases
    # =========================================================================

    @pytest.mark.asyncio
    async def test_handles_empty_executive_quotes(self, module, minimal_upstream_data):
        """Test brief handles missing executive quotes gracefully."""
        result = await module.enrich("example.com", upstream_data=minimal_upstream_data)

        assert result.data.speaking_their_language == []
        # Should have warning about missing quotes
        assert any("quote" in w.lower() for w in result.data.warnings)

    @pytest.mark.asyncio
    async def test_handles_empty_case_studies(self, module, minimal_upstream_data):
        """Test brief handles missing case studies gracefully."""
        result = await module.enrich("example.com", upstream_data=minimal_upstream_data)

        assert result.data.recommended_case_studies == []
        # Should have warning about missing case studies
        assert any("case stud" in w.lower() for w in result.data.warnings)

    @pytest.mark.asyncio
    async def test_handles_unknown_search_provider(self, module):
        """Test brief handles unknown current search provider."""
        data = {
            "domain": "example.com",
            "company_name": "Example Corp",
            "company_context": {"industry": "Technology"},
            "tech_stack": {},  # No current_search
            "traffic": {},
            "financials": {},
            "competitors": {},
            "executive_intel": {},
            "case_studies": [],
            "icp_priority": {"icp_score": 50, "icp_tier": "cool"},
            "signal_scoring": {"composite_score": 40.0},
            "source_url": "https://partnerforge.algolia.com/briefs/example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.enrich("example.com", upstream_data=data)

        # Should still generate a brief
        assert result.data.displacement_opportunity is not None
        assert "Unknown" in result.data.displacement_opportunity

    # =========================================================================
    # Data Model Tests
    # =========================================================================

    def test_talking_point_model_creation(self):
        """Test TalkingPoint pydantic model creation."""
        point = TalkingPoint(
            point="Walmart already uses Algolia",
            category="competitive",
            priority=1,
            source_context="Competitor analysis",
            source_url="https://builtwith.com/walmart.com",
        )

        assert point.point == "Walmart already uses Algolia"
        assert point.category == "competitive"
        assert point.priority == 1

    def test_discovery_question_model_creation(self):
        """Test DiscoveryQuestion pydantic model creation."""
        question = DiscoveryQuestion(
            question="How many engineers maintain your search?",
            intent="Understand TCO",
            expected_response_type="quantitative",
            follow_up_trigger="More than 2 FTEs",
            source_url="https://example.com/source",
        )

        assert question.question.endswith("?")
        assert question.expected_response_type == "quantitative"

    def test_executive_quote_model_creation(self):
        """Test ExecutiveQuote pydantic model creation."""
        quote = ExecutiveQuote(
            quote="We're investing in digital",
            speaker="John Smith",
            title="CEO",
            date="2025-12-15",
            context="Earnings Call",
            maps_to_algolia="Digital investment = search investment",
            source_url="https://seekingalpha.com/transcript",
        )

        assert quote.speaker == "John Smith"
        assert quote.maps_to_algolia is not None

    def test_strategic_signal_brief_data_model_creation(self):
        """Test StrategicSignalBriefData with required fields."""
        brief = StrategicSignalBriefData(
            domain="costco.com",
            company_name="Costco",
            executive_summary="Costco is a hot lead.",
            icp_score=85,
            icp_tier="hot",
            signal_score=78.5,
            displacement_opportunity="Current: Elasticsearch",
            competitive_positioning="Position against ES.",
        )

        assert brief.domain == "costco.com"
        assert brief.icp_score == 85
        assert brief.key_talking_points == []  # Default empty list

    def test_strategic_signal_brief_data_model_dump(self):
        """Test StrategicSignalBriefData can be serialized."""
        brief = StrategicSignalBriefData(
            domain="costco.com",
            company_name="Costco",
            executive_summary="Summary",
            icp_score=85,
            icp_tier="hot",
            signal_score=78.5,
            displacement_opportunity="ES",
            competitive_positioning="Position",
        )

        dumped = brief.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "costco.com"
        assert dumped["icp_score"] == 85


class TestM15ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M15 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m15_strategic_brief")
        assert module_class is not None
        assert module_class.MODULE_ID == "m15_strategic_brief"

    def test_module_in_wave_4(self):
        """Test M15 module appears in Wave 4 modules."""
        from app.modules.base import get_modules_by_wave

        wave_4_modules = get_modules_by_wave(4)
        module_ids = [cls.MODULE_ID for cls in wave_4_modules]

        assert "m15_strategic_brief" in module_ids


class TestM15OutputFormat:
    """Test that M15 output is suitable for downstream LLM consumption."""

    @pytest.fixture
    def module(self):
        return M15StrategicBriefModule()

    @pytest.fixture
    def valid_upstream_data(self):
        now = datetime.now()
        return {
            "domain": "costco.com",
            "company_name": "Costco Wholesale Corporation",
            "company_context": {"industry": "Retail"},
            "tech_stack": {"current_search": "Elasticsearch"},
            "traffic": {"monthly_visits": 50000000},
            "financials": {"revenue": 240000000000},
            "competitors": {
                "competitor_search_providers": {"Walmart": "Algolia"}
            },
            "executive_intel": {
                "quotes": [{
                    "quote": "Digital is key",
                    "speaker": "CEO",
                    "title": "CEO",
                    "date": "2025-12-15",
                    "context": "Earnings",
                    "source_url": "https://example.com",
                }]
            },
            "case_studies": [{
                "company_name": "Staples",
                "vertical": "Retail",
                "headline_metric": "35% lift",
                "relevance_score": 0.85,
                "source_url": "https://algolia.com/customers/staples",
            }],
            "icp_priority": {"icp_score": 85, "icp_tier": "hot"},
            "signal_scoring": {"composite_score": 78.5, "timing_signals": ["Digital"]},
            "source_url": "https://partnerforge.algolia.com/briefs/costco.com",
            "source_date": now.isoformat(),
        }

    @pytest.mark.asyncio
    async def test_each_talking_point_is_standalone(self, module, valid_upstream_data):
        """Test each talking point has full context (standalone)."""
        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        for point in result.data.key_talking_points:
            # Each point should have enough context to stand alone
            assert len(point.point) > 20  # Not too short
            assert point.source_context  # Context provided
            assert point.source_url  # Source provided

    @pytest.mark.asyncio
    async def test_executive_summary_is_self_contained(self, module, valid_upstream_data):
        """Test executive summary contains all needed context."""
        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        summary = result.data.executive_summary

        # Should mention company name
        assert "Costco" in summary
        # Should mention opportunity or ICP
        assert "lead" in summary.lower() or "opportunity" in summary.lower() or "85" in summary

    @pytest.mark.asyncio
    async def test_all_quotes_have_full_attribution(self, module, valid_upstream_data):
        """Test all executive quotes have speaker, title, and source."""
        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        for quote in result.data.speaking_their_language:
            assert quote.speaker
            assert quote.title
            assert quote.date
            assert quote.context
            assert quote.source_url  # Source citation mandate

    @pytest.mark.asyncio
    async def test_displacement_opportunity_is_explicit(self, module, valid_upstream_data):
        """Test displacement opportunity explicitly states current provider."""
        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        displacement = result.data.displacement_opportunity

        # Should explicitly state current search
        assert "Elasticsearch" in displacement or "Current" in displacement

    @pytest.mark.asyncio
    async def test_brief_serializes_to_json(self, module, valid_upstream_data):
        """Test entire brief can be serialized to JSON for LLM consumption."""
        import json

        result = await module.enrich("costco.com", upstream_data=valid_upstream_data)

        # Should serialize without error
        json_str = json.dumps(result.data.model_dump(), default=str)

        assert len(json_str) > 1000  # Should be substantial
        assert "costco.com" in json_str
