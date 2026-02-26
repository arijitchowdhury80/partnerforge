"""
Wave 2 Intelligence Modules - Unit Tests
=========================================

Tests for the 3 Wave 2 deep intelligence modules:
- M05: Competitor Intelligence
- M06: Hiring Signals
- M07: Strategic Context

Test Categories:
1. Module Registration - Verify modules are properly registered
2. Execution - Test successful execution with mock data
3. Output Validation - Verify output schema compliance
4. Source Citation - Verify P0 requirement compliance
5. Wave 1 Integration - Test dependency handling
6. Data Quality - Test quality scoring
7. Error Handling - Test graceful degradation
8. Edge Cases - Test unusual inputs

Run with: pytest tests/unit/modules/test_wave2_modules.py -v
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from pipeline.models.source import (
    SourceCitation,
    SourceType,
    FreshnessStatus,
)
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    ModuleError,
    DependencyNotMetError,
    DataNotFoundError,
    get_all_modules,
    get_modules_by_wave,
    get_wave_order,
    get_module_class,
    instantiate_module,
)
from pipeline.modules import (
    # Wave 2 modules
    M05CompetitorIntelligence,
    M06HiringSignals,
    M07StrategicContext,
    CompetitorIntelligenceData,
    HiringSignalsData,
    StrategicContextData,
    Competitor,
    SearchLandscape,
    HiringSignals,
    HiringRole,
    StrategicInitiative,
    TriggerEvent,
    CautionSignal,
    TimingAssessment,
    # Wave 1 modules (for context testing)
    M01CompanyContext,
    M02TechnologyStack,
    M03TrafficAnalysis,
    M04FinancialProfile,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def m05_module() -> M05CompetitorIntelligence:
    """Create M05 Competitor Intelligence module instance."""
    return M05CompetitorIntelligence()


@pytest.fixture
def m06_module() -> M06HiringSignals:
    """Create M06 Hiring Signals module instance."""
    return M06HiringSignals()


@pytest.fixture
def m07_module() -> M07StrategicContext:
    """Create M07 Strategic Context module instance."""
    return M07StrategicContext()


@pytest.fixture
def known_public_domain() -> str:
    """Domain for a known public company with mock data."""
    return "costco.com"


@pytest.fixture
def known_beauty_domain() -> str:
    """Domain for Sally Beauty with mock data."""
    return "sallybeauty.com"


@pytest.fixture
def known_automotive_domain() -> str:
    """Domain for Mercedes-Benz with mock data."""
    return "mercedes-benz.com"


@pytest.fixture
def unknown_domain() -> str:
    """Domain without mock data."""
    return "unknown-company-12345.com"


async def create_wave1_context(domain: str) -> Dict[str, ModuleResult]:
    """Helper to create Wave 1 context with executed module results."""
    m01 = M01CompanyContext()
    m02 = M02TechnologyStack()
    m03 = M03TrafficAnalysis()
    m04 = M04FinancialProfile()

    context = {}
    context["m01_company_context"] = await m01.execute(domain)
    context["m02_technology_stack"] = await m02.execute(domain)
    context["m03_traffic_analysis"] = await m03.execute(domain)
    context["m04_financial_profile"] = await m04.execute(domain)

    return context


async def create_wave2_context(
    domain: str,
    wave1_context: Dict[str, ModuleResult],
) -> Dict[str, ModuleResult]:
    """Helper to create Wave 1 + Wave 2 (M05, M06) context."""
    m05 = M05CompetitorIntelligence()
    m06 = M06HiringSignals()

    context = wave1_context.copy()
    context["m05_competitor_intelligence"] = await m05.execute(domain, wave1_context)
    context["m06_hiring_signals"] = await m06.execute(domain, wave1_context)

    return context


# =============================================================================
# Module Registration Tests
# =============================================================================

class TestWave2ModuleRegistration:
    """Test that Wave 2 modules are properly registered in the registry."""

    def test_all_wave2_modules_registered(self):
        """Verify all 3 Wave 2 modules are registered."""
        all_modules = get_all_modules()

        assert "m05_competitor_intelligence" in all_modules
        assert "m06_hiring_signals" in all_modules
        assert "m07_strategic_context" in all_modules

    def test_wave2_modules_in_wave2(self):
        """Verify Wave 2 modules are assigned to Wave 2."""
        wave2_modules = get_modules_by_wave(2)

        module_ids = [m.MODULE_ID for m in wave2_modules]
        assert "m05_competitor_intelligence" in module_ids
        assert "m06_hiring_signals" in module_ids
        assert "m07_strategic_context" in module_ids

    def test_wave_order_includes_wave2(self):
        """Verify wave order includes Wave 2."""
        wave_order = get_wave_order()

        assert len(wave_order) >= 2  # At least Wave 1 and Wave 2
        # Wave 2 should have our 3 modules
        assert len(wave_order[1]) >= 3

    def test_get_module_class_by_id(self):
        """Verify we can retrieve module class by ID."""
        m05_cls = get_module_class("m05_competitor_intelligence")
        assert m05_cls is not None
        assert m05_cls.MODULE_ID == "m05_competitor_intelligence"

        m06_cls = get_module_class("m06_hiring_signals")
        assert m06_cls is not None
        assert m06_cls.MODULE_ID == "m06_hiring_signals"

        m07_cls = get_module_class("m07_strategic_context")
        assert m07_cls is not None
        assert m07_cls.MODULE_ID == "m07_strategic_context"

    def test_instantiate_wave2_modules(self):
        """Verify we can instantiate Wave 2 modules by ID."""
        m05 = instantiate_module("m05_competitor_intelligence")
        assert m05 is not None
        assert isinstance(m05, M05CompetitorIntelligence)

        m06 = instantiate_module("m06_hiring_signals")
        assert m06 is not None
        assert isinstance(m06, M06HiringSignals)

        m07 = instantiate_module("m07_strategic_context")
        assert m07 is not None
        assert isinstance(m07, M07StrategicContext)


# =============================================================================
# M05 Competitor Intelligence Tests
# =============================================================================

class TestM05CompetitorIntelligence:
    """Tests for M05 Competitor Intelligence module."""

    def test_module_attributes(self, m05_module: M05CompetitorIntelligence):
        """Verify module has correct attributes."""
        assert m05_module.MODULE_ID == "m05_competitor_intelligence"
        assert m05_module.MODULE_NAME == "Competitor Intelligence"
        assert m05_module.WAVE == 2
        assert m05_module.DEPENDS_ON == []  # Can run independently
        assert m05_module.OUTPUT_TABLE == "intel_competitor_intelligence"
        assert m05_module.PRIMARY_SOURCE_TYPE == SourceType.SIMILARWEB

    @pytest.mark.asyncio
    async def test_execute_known_domain(
        self,
        m05_module: M05CompetitorIntelligence,
        known_public_domain: str,
    ):
        """Test execution with known domain returns valid result."""
        result = await m05_module.execute(known_public_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == known_public_domain
        assert result.module_id == "m05_competitor_intelligence"
        assert result.data is not None

        # Check competitors exist
        assert "competitors" in result.data
        assert len(result.data["competitors"]) > 0

    @pytest.mark.asyncio
    async def test_competitor_data_structure(
        self,
        m05_module: M05CompetitorIntelligence,
        known_public_domain: str,
    ):
        """Test competitor data has correct structure."""
        result = await m05_module.execute(known_public_domain)

        competitors = result.data["competitors"]
        first_competitor = competitors[0]

        assert "domain" in first_competitor
        assert "similarity_score" in first_competitor
        assert "search_provider" in first_competitor
        assert "uses_algolia" in first_competitor
        assert "tech_overlap" in first_competitor

    @pytest.mark.asyncio
    async def test_search_landscape_analysis(
        self,
        m05_module: M05CompetitorIntelligence,
        known_public_domain: str,
    ):
        """Test search landscape analysis is generated."""
        result = await m05_module.execute(known_public_domain)

        landscape = result.data["competitor_search_landscape"]
        assert "algolia_users" in landscape
        assert "elasticsearch_users" in landscape
        assert "first_mover_opportunity" in landscape

        # Costco competitors don't use Algolia
        assert landscape["algolia_users"] == 0
        assert landscape["first_mover_opportunity"] is True

    @pytest.mark.asyncio
    async def test_first_mover_opportunity_detection(
        self,
        m05_module: M05CompetitorIntelligence,
        known_beauty_domain: str,
    ):
        """Test first-mover opportunity is correctly detected."""
        result = await m05_module.execute(known_beauty_domain)

        assert result.data["first_mover_opportunity"] is True
        assert result.data["lighthouse_potential"] is not None

    @pytest.mark.asyncio
    async def test_competitive_positioning_generated(
        self,
        m05_module: M05CompetitorIntelligence,
        known_public_domain: str,
    ):
        """Test competitive positioning statement is generated."""
        result = await m05_module.execute(known_public_domain)

        assert result.data["competitive_positioning"] is not None
        assert len(result.data["competitive_positioning"]) > 20

    @pytest.mark.asyncio
    async def test_with_wave1_context(
        self,
        m05_module: M05CompetitorIntelligence,
        known_public_domain: str,
    ):
        """Test execution with Wave 1 context enriches output."""
        wave1_context = await create_wave1_context(known_public_domain)
        result = await m05_module.execute(known_public_domain, wave1_context)

        assert result.status == ModuleStatus.SUCCESS
        # Should have used Wave 1 data
        assert len(result.data.get("wave1_data_used", [])) > 0

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m05_module: M05CompetitorIntelligence,
        known_public_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m05_module.execute(known_public_domain)

        assert result.primary_citation is not None
        assert result.primary_citation.source_type == SourceType.SIMILARWEB
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_unknown_domain_returns_empty_competitors(
        self,
        m05_module: M05CompetitorIntelligence,
        unknown_domain: str,
    ):
        """Test unknown domain returns success with empty competitors."""
        result = await m05_module.execute(unknown_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data["total_competitors_analyzed"] == 0


# =============================================================================
# M06 Hiring Signals Tests
# =============================================================================

class TestM06HiringSignals:
    """Tests for M06 Hiring Signals module."""

    def test_module_attributes(self, m06_module: M06HiringSignals):
        """Verify module has correct attributes."""
        assert m06_module.MODULE_ID == "m06_hiring_signals"
        assert m06_module.MODULE_NAME == "Hiring Signals"
        assert m06_module.WAVE == 2
        assert m06_module.DEPENDS_ON == []  # Can run independently
        assert m06_module.OUTPUT_TABLE == "intel_hiring_signals"
        assert m06_module.PRIMARY_SOURCE_TYPE == SourceType.LINKEDIN

    @pytest.mark.asyncio
    async def test_execute_known_domain(
        self,
        m06_module: M06HiringSignals,
        known_public_domain: str,
    ):
        """Test execution with known domain returns valid result."""
        result = await m06_module.execute(known_public_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == known_public_domain
        assert result.module_id == "m06_hiring_signals"
        assert result.data is not None

        # Check hiring data exists
        assert "total_open_roles" in result.data
        assert "hiring_signals" in result.data

    @pytest.mark.asyncio
    async def test_hiring_signals_tiered_structure(
        self,
        m06_module: M06HiringSignals,
        known_public_domain: str,
    ):
        """Test hiring signals are organized by tier."""
        result = await m06_module.execute(known_public_domain)

        signals = result.data["hiring_signals"]
        assert "tier_1_strong" in signals
        assert "tier_2_moderate" in signals
        assert "tier_3_technical" in signals

    @pytest.mark.asyncio
    async def test_leadership_vacancy_detection(
        self,
        m06_module: M06HiringSignals,
        known_beauty_domain: str,
    ):
        """Test leadership vacancies are detected."""
        result = await m06_module.execute(known_beauty_domain)

        # Sally Beauty has VP Ecommerce vacancy in mock data
        assert result.data["decision_window_open"] is True
        assert len(result.data["leadership_vacancies"]) > 0

    @pytest.mark.asyncio
    async def test_hiring_categories_calculated(
        self,
        m06_module: M06HiringSignals,
        known_public_domain: str,
    ):
        """Test hiring categories are calculated."""
        result = await m06_module.execute(known_public_domain)

        categories = result.data["hiring_categories"]
        assert isinstance(categories, dict)
        # Should have some categories
        assert len(categories) > 0

    @pytest.mark.asyncio
    async def test_ai_investment_signal_detection(
        self,
        m06_module: M06HiringSignals,
        known_public_domain: str,
    ):
        """Test AI investment signal is detected."""
        result = await m06_module.execute(known_public_domain)

        # Costco has ML Engineer in mock data
        assert result.data["ai_investment_signal"] is True

    @pytest.mark.asyncio
    async def test_platform_confirmation(
        self,
        m06_module: M06HiringSignals,
        known_beauty_domain: str,
    ):
        """Test platform is confirmed from job postings."""
        result = await m06_module.execute(known_beauty_domain)

        # Sally Beauty has SFCC engineer in mock data
        assert result.data["platform_confirmed"] == "Salesforce Commerce Cloud"

    @pytest.mark.asyncio
    async def test_hiring_intensity_calculation(
        self,
        m06_module: M06HiringSignals,
        known_public_domain: str,
    ):
        """Test hiring intensity is calculated."""
        result = await m06_module.execute(known_public_domain)

        intensity = result.data["overall_hiring_intensity"]
        assert intensity in ["HIGH", "MODERATE", "LOW"]

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m06_module: M06HiringSignals,
        known_public_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m06_module.execute(known_public_domain)

        assert result.primary_citation is not None
        assert result.primary_citation.source_type == SourceType.LINKEDIN
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_unknown_domain_returns_empty_signals(
        self,
        m06_module: M06HiringSignals,
        unknown_domain: str,
    ):
        """Test unknown domain returns success with empty signals."""
        result = await m06_module.execute(unknown_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data["total_open_roles"] == 0


# =============================================================================
# M07 Strategic Context Tests
# =============================================================================

class TestM07StrategicContext:
    """Tests for M07 Strategic Context module."""

    def test_module_attributes(self, m07_module: M07StrategicContext):
        """Verify module has correct attributes."""
        assert m07_module.MODULE_ID == "m07_strategic_context"
        assert m07_module.MODULE_NAME == "Strategic Context"
        assert m07_module.WAVE == 2
        assert "m05_competitor_intelligence" in m07_module.DEPENDS_ON
        assert "m06_hiring_signals" in m07_module.DEPENDS_ON
        assert m07_module.OUTPUT_TABLE == "intel_strategic_context"
        assert m07_module.PRIMARY_SOURCE_TYPE == SourceType.WEBSEARCH

    @pytest.mark.asyncio
    async def test_execute_known_domain_no_context(
        self,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """Test execution without context still succeeds."""
        result = await m07_module.execute(known_public_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == known_public_domain
        assert result.module_id == "m07_strategic_context"

    @pytest.mark.asyncio
    async def test_execute_with_full_context(
        self,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """Test execution with full Wave 1+2 context."""
        wave1_context = await create_wave1_context(known_public_domain)
        wave2_context = await create_wave2_context(known_public_domain, wave1_context)
        result = await m07_module.execute(known_public_domain, wave2_context)

        assert result.status == ModuleStatus.SUCCESS
        # Should have used Wave 1 and Wave 2 data
        assert len(result.data.get("wave1_modules_used", [])) > 0
        assert len(result.data.get("wave2_modules_used", [])) > 0

    @pytest.mark.asyncio
    async def test_strategic_initiatives_extracted(
        self,
        m07_module: M07StrategicContext,
        known_beauty_domain: str,
    ):
        """Test strategic initiatives are extracted."""
        result = await m07_module.execute(known_beauty_domain)

        initiatives = result.data["strategic_initiatives"]
        assert len(initiatives) > 0

        first_init = initiatives[0]
        assert "name" in first_init
        assert "initiative_type" in first_init
        assert "algolia_connection" in first_init

    @pytest.mark.asyncio
    async def test_trigger_events_identified(
        self,
        m07_module: M07StrategicContext,
        known_beauty_domain: str,
    ):
        """Test trigger events are identified."""
        result = await m07_module.execute(known_beauty_domain)

        events = result.data["trigger_events"]
        assert len(events) > 0

        first_event = events[0]
        assert "event" in first_event
        assert "relevance" in first_event

    @pytest.mark.asyncio
    async def test_caution_signals_detected(
        self,
        m07_module: M07StrategicContext,
        known_beauty_domain: str,
    ):
        """Test caution signals are detected."""
        result = await m07_module.execute(known_beauty_domain)

        signals = result.data["caution_signals"]
        assert len(signals) > 0

        first_signal = signals[0]
        assert "event" in first_signal
        assert "signal_type" in first_signal

    @pytest.mark.asyncio
    async def test_timing_assessment_generated(
        self,
        m07_module: M07StrategicContext,
        known_beauty_domain: str,
    ):
        """Test timing assessment is generated."""
        result = await m07_module.execute(known_beauty_domain)

        timing = result.data["timing_assessment"]
        assert timing["overall_timing"] in ["EXCELLENT", "GOOD", "NEUTRAL", "POOR"]
        assert timing["urgency_level"] in ["HIGH", "MEDIUM", "LOW"]
        assert timing["reasoning"] is not None

    @pytest.mark.asyncio
    async def test_algolia_connection_points_generated(
        self,
        m07_module: M07StrategicContext,
        known_beauty_domain: str,
    ):
        """Test Algolia connection points are generated."""
        result = await m07_module.execute(known_beauty_domain)

        points = result.data["algolia_connection_points"]
        assert len(points) > 0

    @pytest.mark.asyncio
    async def test_synthesis_summary_generated(
        self,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """Test synthesis summary (60-second story) is generated."""
        result = await m07_module.execute(known_public_domain)

        synthesis = result.data["synthesis_summary"]
        assert synthesis is not None
        assert len(synthesis) > 20

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m07_module.execute(known_public_domain)

        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_unknown_domain_returns_empty_data(
        self,
        m07_module: M07StrategicContext,
        unknown_domain: str,
    ):
        """Test unknown domain returns success with empty data."""
        result = await m07_module.execute(unknown_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data["total_initiatives"] == 0


# =============================================================================
# Source Citation Compliance Tests (P0 Requirement)
# =============================================================================

class TestWave2SourceCitationCompliance:
    """
    P0 REQUIREMENT: Every module output MUST have source citations.
    These tests verify the source citation mandate is enforced for Wave 2.
    """

    @pytest.mark.asyncio
    async def test_m05_citation_present(self, m05_module: M05CompetitorIntelligence):
        """M05 must have source citation."""
        result = await m05_module.execute("costco.com")
        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_m06_citation_present(self, m06_module: M06HiringSignals):
        """M06 must have source citation."""
        result = await m06_module.execute("costco.com")
        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_m07_citation_present(self, m07_module: M07StrategicContext):
        """M07 must have source citation."""
        result = await m07_module.execute("costco.com")
        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_citation_freshness_is_valid(self, m05_module: M05CompetitorIntelligence):
        """Citation should not be expired."""
        result = await m05_module.execute("costco.com")
        assert result.primary_citation.freshness_status != FreshnessStatus.EXPIRED

    @pytest.mark.asyncio
    async def test_result_to_db_dict_includes_source(self, m05_module: M05CompetitorIntelligence):
        """to_db_dict() should include source information."""
        result = await m05_module.execute("costco.com")
        db_dict = result.to_db_dict()

        assert "primary_source_url" in db_dict
        assert "primary_source_type" in db_dict
        assert "primary_source_at" in db_dict


# =============================================================================
# Wave 2 Dependency Tests
# =============================================================================

class TestWave2Dependencies:
    """Test Wave 2 module dependency handling."""

    def test_m05_m06_have_no_required_dependencies(
        self,
        m05_module: M05CompetitorIntelligence,
        m06_module: M06HiringSignals,
    ):
        """M05 and M06 should have empty DEPENDS_ON (can run independently)."""
        assert m05_module.DEPENDS_ON == []
        assert m06_module.DEPENDS_ON == []

    def test_m07_depends_on_m05_m06(self, m07_module: M07StrategicContext):
        """M07 should depend on M05 and M06."""
        assert "m05_competitor_intelligence" in m07_module.DEPENDS_ON
        assert "m06_hiring_signals" in m07_module.DEPENDS_ON

    @pytest.mark.asyncio
    async def test_m07_runs_without_dependencies(
        self,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """M07 should run even without M05/M06 context (graceful degradation)."""
        result = await m07_module.execute(known_public_domain, context=None)
        assert result.status == ModuleStatus.SUCCESS

    @pytest.mark.asyncio
    async def test_m07_uses_wave1_data_when_available(
        self,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """M07 should use Wave 1 data when provided."""
        wave1_context = await create_wave1_context(known_public_domain)
        result = await m07_module.execute(known_public_domain, wave1_context)

        assert result.status == ModuleStatus.SUCCESS
        # Should have extracted vertical from M01
        if result.data.get("wave1_modules_used"):
            assert "m01_company_context" in result.data["wave1_modules_used"]


# =============================================================================
# Parallel Execution Tests
# =============================================================================

class TestWave2ParallelExecution:
    """Test that M05 and M06 can run in parallel (no dependencies on each other)."""

    @pytest.mark.asyncio
    async def test_m05_m06_parallel_execution(
        self,
        m05_module: M05CompetitorIntelligence,
        m06_module: M06HiringSignals,
        known_public_domain: str,
    ):
        """M05 and M06 can execute in parallel successfully."""
        import asyncio

        # Run M05 and M06 concurrently
        results = await asyncio.gather(
            m05_module.execute(known_public_domain),
            m06_module.execute(known_public_domain),
        )

        # Both should succeed
        assert all(r.status == ModuleStatus.SUCCESS for r in results)

        # Verify each module returned correct data
        assert results[0].module_id == "m05_competitor_intelligence"
        assert results[1].module_id == "m06_hiring_signals"

    @pytest.mark.asyncio
    async def test_full_wave2_execution_sequence(
        self,
        m05_module: M05CompetitorIntelligence,
        m06_module: M06HiringSignals,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """Test full Wave 2 execution: M05/M06 parallel, then M07."""
        import asyncio

        # Create Wave 1 context first
        wave1_context = await create_wave1_context(known_public_domain)

        # Phase 1: M05 and M06 in parallel with Wave 1 context
        phase1_results = await asyncio.gather(
            m05_module.execute(known_public_domain, wave1_context),
            m06_module.execute(known_public_domain, wave1_context),
        )

        # Build full context
        full_context = wave1_context.copy()
        full_context["m05_competitor_intelligence"] = phase1_results[0]
        full_context["m06_hiring_signals"] = phase1_results[1]

        # Phase 2: M07 with full context
        m07_result = await m07_module.execute(known_public_domain, full_context)

        # All should succeed
        assert all(r.status == ModuleStatus.SUCCESS for r in phase1_results)
        assert m07_result.status == ModuleStatus.SUCCESS

        # M07 should have used Wave 2 data
        assert len(m07_result.data.get("wave2_modules_used", [])) >= 2


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestWave2ErrorHandling:
    """Test graceful error handling in Wave 2 modules."""

    @pytest.mark.asyncio
    async def test_m05_handles_empty_domain(self, m05_module: M05CompetitorIntelligence):
        """Module should handle empty domain gracefully."""
        result = await m05_module.execute("")
        assert result is not None

    @pytest.mark.asyncio
    async def test_m06_handles_malformed_domain(self, m06_module: M06HiringSignals):
        """Module should handle malformed domain gracefully."""
        result = await m06_module.execute("not-a-valid-domain")
        assert result.status == ModuleStatus.SUCCESS

    @pytest.mark.asyncio
    async def test_m07_handles_partial_context(
        self,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """M07 should handle partial context (missing some modules)."""
        # Only M01 in context
        m01 = M01CompanyContext()
        partial_context = {
            "m01_company_context": await m01.execute(known_public_domain)
        }

        result = await m07_module.execute(known_public_domain, partial_context)
        assert result.status == ModuleStatus.SUCCESS


# =============================================================================
# Data Quality Tests
# =============================================================================

class TestWave2DataQuality:
    """Test data quality scoring in Wave 2 modules."""

    @pytest.mark.asyncio
    async def test_m05_data_quality_score(
        self,
        m05_module: M05CompetitorIntelligence,
        known_public_domain: str,
    ):
        """M05 should calculate data quality score."""
        result = await m05_module.execute(known_public_domain)

        score = result.data["data_quality_score"]
        assert 0.0 <= score <= 1.0
        # Known domain with mock data should have decent quality
        assert score >= 0.5

    @pytest.mark.asyncio
    async def test_m06_data_quality_score(
        self,
        m06_module: M06HiringSignals,
        known_public_domain: str,
    ):
        """M06 should calculate data quality score."""
        result = await m06_module.execute(known_public_domain)

        score = result.data["data_quality_score"]
        assert 0.0 <= score <= 1.0
        assert score >= 0.5

    @pytest.mark.asyncio
    async def test_m07_data_quality_score(
        self,
        m07_module: M07StrategicContext,
        known_public_domain: str,
    ):
        """M07 should calculate data quality score."""
        result = await m07_module.execute(known_public_domain)

        score = result.data["data_quality_score"]
        assert 0.0 <= score <= 1.0


# =============================================================================
# Output Schema Validation Tests
# =============================================================================

class TestWave2OutputSchemas:
    """Test that Wave 2 module outputs match expected schemas."""

    @pytest.mark.asyncio
    async def test_m05_output_schema(self, m05_module: M05CompetitorIntelligence):
        """M05 output should match CompetitorIntelligenceData schema."""
        result = await m05_module.execute("costco.com")

        # Should be able to create data model from output
        data = CompetitorIntelligenceData(**result.data)
        assert data.domain == "costco.com"
        assert isinstance(data.competitors, list)
        assert isinstance(data.competitor_search_landscape, SearchLandscape)

    @pytest.mark.asyncio
    async def test_m06_output_schema(self, m06_module: M06HiringSignals):
        """M06 output should match HiringSignalsData schema."""
        result = await m06_module.execute("costco.com")

        data = HiringSignalsData(**result.data)
        assert data.domain == "costco.com"
        assert isinstance(data.hiring_signals, HiringSignals)
        assert isinstance(data.hiring_categories, dict)

    @pytest.mark.asyncio
    async def test_m07_output_schema(self, m07_module: M07StrategicContext):
        """M07 output should match StrategicContextData schema."""
        result = await m07_module.execute("costco.com")

        data = StrategicContextData(**result.data)
        assert data.domain == "costco.com"
        assert isinstance(data.strategic_initiatives, list)
        assert isinstance(data.timing_assessment, TimingAssessment)


# =============================================================================
# Metrics Tests
# =============================================================================

class TestWave2Metrics:
    """Test module metrics collection for Wave 2."""

    @pytest.mark.asyncio
    async def test_m05_metrics_tracking(self, m05_module: M05CompetitorIntelligence):
        """M05 should track execution metrics."""
        initial_count = m05_module.metrics.execution_count

        await m05_module.execute("costco.com")

        assert m05_module.metrics.execution_count == initial_count + 1
        assert m05_module.metrics.success_count >= 1
        assert m05_module.metrics.total_duration_ms > 0

    @pytest.mark.asyncio
    async def test_m06_metrics_tracking(self, m06_module: M06HiringSignals):
        """M06 should track execution metrics."""
        initial_count = m06_module.metrics.execution_count

        await m06_module.execute("costco.com")

        assert m06_module.metrics.execution_count == initial_count + 1
        assert m06_module.metrics.success_count >= 1

    @pytest.mark.asyncio
    async def test_m07_metrics_tracking(self, m07_module: M07StrategicContext):
        """M07 should track execution metrics."""
        initial_count = m07_module.metrics.execution_count

        await m07_module.execute("costco.com")

        assert m07_module.metrics.execution_count == initial_count + 1
        assert m07_module.metrics.success_count >= 1

    def test_get_metrics_returns_dict(self, m05_module: M05CompetitorIntelligence):
        """get_metrics() should return metrics dict."""
        metrics = m05_module.get_metrics()

        assert "module_id" in metrics
        assert "execution_count" in metrics
        assert "success_rate" in metrics
        assert "average_duration_ms" in metrics
