"""
Wave 4 Intelligence Modules - Unit Tests
=========================================

Tests for the 4 Wave 4 synthesis modules:
- M12: Case Study Matching
- M13: ICP-Priority Mapping
- M14: Signal Scoring
- M15: Strategic Signal Brief

Test Categories:
1. Module Registration - Verify modules are properly registered
2. Dependency Validation - Verify Wave 4 dependencies on prior waves
3. Execution - Test successful execution with mock context
4. Output Validation - Verify output schema compliance
5. Source Citation - Verify P0 requirement compliance
6. Scoring Logic - Test scoring algorithms
7. Edge Cases - Test unusual inputs

Run with: pytest tests/unit/modules/test_wave4_modules.py -v
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from pathlib import Path

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
    get_all_modules,
    get_modules_by_wave,
    get_wave_order,
    get_module_class,
    instantiate_module,
)
from pipeline.modules.m12_case_study_matching import (
    M12CaseStudyMatching,
    CaseStudyMatchingData,
    MatchedCaseStudy,
    UseCaseCoverage,
)
from pipeline.modules.m13_icp_priority_mapping import (
    M13ICPPriorityMapping,
    ICPPriorityMappingData,
    ICPClassification,
    LeadScore,
    PriorityClassification,
    ProductMapping,
)
from pipeline.modules.m14_signal_scoring import (
    M14SignalScoring,
    SignalScoringData,
    SignalCategory,
    SignalInstance,
    CompositeScore,
    SignalQuality,
)
from pipeline.modules.m15_strategic_brief import (
    M15StrategicBrief,
    StrategicSignalBriefData,
    TimingSignal,
    ExecutiveQuote,
    KeyPerson,
    MoneyMetrics,
    GapFinding,
    CompetitiveLandscape,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def m12_module() -> M12CaseStudyMatching:
    """Create M12 Case Study Matching module instance."""
    return M12CaseStudyMatching()


@pytest.fixture
def m13_module() -> M13ICPPriorityMapping:
    """Create M13 ICP-Priority Mapping module instance."""
    return M13ICPPriorityMapping()


@pytest.fixture
def m14_module() -> M14SignalScoring:
    """Create M14 Signal Scoring module instance."""
    return M14SignalScoring()


@pytest.fixture
def m15_module() -> M15StrategicBrief:
    """Create M15 Strategic Signal Brief module instance."""
    return M15StrategicBrief()


@pytest.fixture
def test_domain() -> str:
    """Test domain for execution."""
    return "costco.com"


@pytest.fixture
def mock_wave1_context() -> Dict[str, ModuleResult]:
    """
    Mock context from Wave 1 modules.
    Simulates M01-M04 outputs for testing Wave 4 synthesis.
    """
    base_citation = SourceCitation(
        source_type=SourceType.WEBSEARCH,
        source_url="https://example.com/test",
        retrieved_at=datetime.utcnow(),
    )

    return {
        "m01_company_context": ModuleResult(
            module_id="m01_company_context",
            domain="costco.com",
            status=ModuleStatus.SUCCESS,
            data={
                "domain": "costco.com",
                "company_name": "Costco Wholesale Corporation",
                "ticker": "COST",
                "exchange": "NASDAQ",
                "is_public": True,
                "headquarters": {
                    "city": "Issaquah",
                    "state": "Washington",
                    "country": "USA",
                },
                "industry": "Warehouse Club Retail",
                "vertical": "Commerce",
                "sub_vertical": "Wholesale/Membership Retail",
                "business_model": "B2C",
                "employee_count": 316000,
            },
            primary_citation=base_citation,
        ),
        "m02_technology_stack": ModuleResult(
            module_id="m02_technology_stack",
            domain="costco.com",
            status=ModuleStatus.SUCCESS,
            data={
                "domain": "costco.com",
                "technologies": [
                    {"name": "Akamai", "category": "cdn"},
                    {"name": "Google Analytics", "category": "analytics"},
                ],
                "partner_technologies": ["Adobe Commerce"],
                "tech_spend_estimate": 75000,
                "search_provider": {
                    "current": "Elasticsearch",
                    "is_algolia": False,
                    "displacement_priority": "HIGH",
                },
                "total_technologies": 15,
            },
            primary_citation=base_citation,
        ),
        "m03_traffic_analysis": ModuleResult(
            module_id="m03_traffic_analysis",
            domain="costco.com",
            status=ModuleStatus.SUCCESS,
            data={
                "domain": "costco.com",
                "traffic_metrics": {
                    "monthly_visits": 152000000,
                    "bounce_rate": 0.35,
                    "pages_per_visit": 5.2,
                },
                "traffic_tier": "50M+",
                "traffic_score": 30,
                "traffic_trend": {
                    "trend_direction": "growing",
                    "yoy_change": 0.08,
                },
            },
            primary_citation=base_citation,
        ),
        "m04_financial_profile": ModuleResult(
            module_id="m04_financial_profile",
            domain="costco.com",
            status=ModuleStatus.SUCCESS,
            data={
                "domain": "costco.com",
                "ticker": "COST",
                "is_public": True,
                "financials": {
                    "latest_revenue": 242290000000,
                    "revenue_trend": "growing",
                    "revenue_3yr": [
                        {"fiscal_year": "FY2022", "revenue": 226954000000},
                        {"fiscal_year": "FY2023", "revenue": 237710000000},
                        {"fiscal_year": "FY2024", "revenue": 242290000000},
                    ],
                },
                "margin_zone": {
                    "classification": "YELLOW",
                    "ebitda_margin": 0.045,
                },
                "ecommerce": {
                    "ecommerce_revenue": 14500000000,
                    "ecommerce_share": 0.06,
                    "ecommerce_growth_yoy": 0.12,
                    "addressable_search_revenue": 2175000000,
                },
                "roi_scenarios": {
                    "conservative": {"lift_pct": 0.05, "annual_impact": 108750000},
                    "moderate": {"lift_pct": 0.10, "annual_impact": 217500000},
                    "aggressive": {"lift_pct": 0.15, "annual_impact": 326250000},
                },
            },
            primary_citation=base_citation,
        ),
    }


@pytest.fixture
def mock_full_context(mock_wave1_context) -> Dict[str, ModuleResult]:
    """
    Full mock context including M12, M13 results for M14/M15 tests.
    """
    base_citation = SourceCitation(
        source_type=SourceType.MANUAL_ENTRY,
        source_url="https://arian.internal/test",
        retrieved_at=datetime.utcnow(),
    )

    context = mock_wave1_context.copy()

    # Add M12 result
    context["m12_case_study_matching"] = ModuleResult(
        module_id="m12_case_study_matching",
        domain="costco.com",
        status=ModuleStatus.SUCCESS,
        data={
            "domain": "costco.com",
            "matched_case_studies": [
                {
                    "customer": "Lacoste",
                    "vertical": "Retail",
                    "relevance_score": 0.85,
                    "results": {"headline": "+37% conversion rate"},
                    "features_used": ["Search", "Personalization"],
                    "case_study_url": "https://algolia.com/case-study/lacoste",
                }
            ],
            "total_matches": 5,
            "vertical_match_score": 0.82,
        },
        primary_citation=base_citation,
    )

    # Add M13 result
    context["m13_icp_priority_mapping"] = ModuleResult(
        module_id="m13_icp_priority_mapping",
        domain="costco.com",
        status=ModuleStatus.SUCCESS,
        data={
            "domain": "costco.com",
            "icp_classification": {
                "tier": 1,
                "tier_name": "Commerce",
                "tier_description": "Fashion & General Retail E-commerce",
                "confidence": 0.92,
            },
            "lead_score": {
                "total": 85,
                "breakdown": {
                    "vertical_fit": 40,
                    "traffic_volume": 30,
                    "tech_spend": 10,
                    "partner_tech_bonus": 5,
                    "competitor_displacement_bonus": 0,
                },
                "max_possible": 110,
                "percentile": 77.3,
            },
            "priority_classification": {
                "priority_score": 85,
                "status": "HOT",
                "reasoning": "High ICP score + Commerce vertical",
            },
            "algolia_product_mapping": [
                {
                    "customer_need": "E-commerce search optimization",
                    "algolia_product": "Algolia Search + InstantSearch",
                    "confidence": 0.9,
                }
            ],
        },
        primary_citation=base_citation,
    )

    # Add M14 result
    context["m14_signal_scoring"] = ModuleResult(
        module_id="m14_signal_scoring",
        domain="costco.com",
        status=ModuleStatus.SUCCESS,
        data={
            "domain": "costco.com",
            "priority_status": "HOT",
            "composite_score": {
                "priority_score": 95,
            },
            "signal_quality": {
                "has_all_three_types": True,
                "has_budget_signal": True,
                "has_pain_signal": True,
                "has_timing_signal": True,
            },
        },
        primary_citation=base_citation,
    )

    return context


# =============================================================================
# Module Registration Tests
# =============================================================================

class TestModuleRegistration:
    """Test that Wave 4 modules are properly registered."""

    def test_all_wave4_modules_registered(self):
        """Verify all 4 Wave 4 modules are registered."""
        all_modules = get_all_modules()

        assert "m12_case_study_matching" in all_modules
        assert "m13_icp_priority_mapping" in all_modules
        assert "m14_signal_scoring" in all_modules
        assert "m15_strategic_brief" in all_modules

    def test_wave4_modules_in_wave4(self):
        """Verify Wave 4 modules are assigned to Wave 4."""
        wave4_modules = get_modules_by_wave(4)

        module_ids = [m.MODULE_ID for m in wave4_modules]
        assert "m12_case_study_matching" in module_ids
        assert "m13_icp_priority_mapping" in module_ids
        assert "m14_signal_scoring" in module_ids
        assert "m15_strategic_brief" in module_ids

    def test_get_module_class_by_id(self):
        """Verify we can retrieve module class by ID."""
        m12_cls = get_module_class("m12_case_study_matching")
        assert m12_cls is not None
        assert m12_cls.MODULE_ID == "m12_case_study_matching"

        m15_cls = get_module_class("m15_strategic_brief")
        assert m15_cls is not None
        assert m15_cls.MODULE_ID == "m15_strategic_brief"

    def test_instantiate_module_by_id(self):
        """Verify we can instantiate module by ID."""
        module = instantiate_module("m13_icp_priority_mapping")
        assert module is not None
        assert isinstance(module, M13ICPPriorityMapping)


# =============================================================================
# M12 Case Study Matching Tests
# =============================================================================

class TestM12CaseStudyMatching:
    """Tests for M12 Case Study Matching module."""

    def test_module_attributes(self, m12_module: M12CaseStudyMatching):
        """Verify module has correct attributes."""
        assert m12_module.MODULE_ID == "m12_case_study_matching"
        assert m12_module.MODULE_NAME == "Case Study Matching"
        assert m12_module.WAVE == 4
        assert "m01_company_context" in m12_module.DEPENDS_ON
        assert m12_module.OUTPUT_TABLE == "intel_case_study_matches"

    @pytest.mark.asyncio
    async def test_execute_with_context(
        self,
        m12_module: M12CaseStudyMatching,
        mock_wave1_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test execution with Wave 1 context."""
        result = await m12_module.execute(test_domain, mock_wave1_context)

        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == test_domain
        assert result.module_id == "m12_case_study_matching"

    @pytest.mark.asyncio
    async def test_execute_has_source_citation(
        self,
        m12_module: M12CaseStudyMatching,
        mock_wave1_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m12_module.execute(test_domain, mock_wave1_context)

        assert result.primary_citation is not None
        assert result.primary_citation.source_url is not None

    @pytest.mark.asyncio
    async def test_execute_without_context_succeeds(
        self,
        m12_module: M12CaseStudyMatching,
        test_domain: str,
    ):
        """Test execution without context still succeeds."""
        result = await m12_module.execute(test_domain, {})

        assert result.status == ModuleStatus.SUCCESS
        assert result.data.get("domain") == test_domain

    def test_vertical_score_matching(self, m12_module: M12CaseStudyMatching):
        """Test vertical matching scoring."""
        # Commerce should match e-commerce
        score = m12_module._score_vertical_match("commerce", "e-commerce")
        assert score >= 0.7

        # Different verticals should have lower score
        score = m12_module._score_vertical_match("commerce", "healthcare")
        assert score < 0.5

    def test_output_schema_compliance(self):
        """Test output schema can be instantiated."""
        data = CaseStudyMatchingData(
            domain="test.com",
            matched_case_studies=[],
            total_matches=0,
            vertical_match_score=0.5,
            use_case_coverage=UseCaseCoverage(),
        )
        assert data.domain == "test.com"


# =============================================================================
# M13 ICP-Priority Mapping Tests
# =============================================================================

class TestM13ICPPriorityMapping:
    """Tests for M13 ICP-Priority Mapping module."""

    def test_module_attributes(self, m13_module: M13ICPPriorityMapping):
        """Verify module has correct attributes."""
        assert m13_module.MODULE_ID == "m13_icp_priority_mapping"
        assert m13_module.MODULE_NAME == "ICP-Priority Mapping"
        assert m13_module.WAVE == 4
        assert "m01_company_context" in m13_module.DEPENDS_ON
        assert "m04_financial_profile" in m13_module.DEPENDS_ON

    @pytest.mark.asyncio
    async def test_execute_with_context(
        self,
        m13_module: M13ICPPriorityMapping,
        mock_wave1_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test execution with Wave 1 context."""
        result = await m13_module.execute(test_domain, mock_wave1_context)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data.get("icp_classification") is not None
        assert result.data.get("lead_score") is not None
        assert result.data.get("priority_classification") is not None

    @pytest.mark.asyncio
    async def test_icp_scoring_commerce_vertical(
        self,
        m13_module: M13ICPPriorityMapping,
        mock_wave1_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test ICP scoring gives high score to Commerce vertical."""
        result = await m13_module.execute(test_domain, mock_wave1_context)

        lead_score = result.data.get("lead_score", {})
        breakdown = lead_score.get("breakdown", {})

        # Commerce vertical should get 40 points
        assert breakdown.get("vertical_fit") == 40

    @pytest.mark.asyncio
    async def test_icp_scoring_high_traffic(
        self,
        m13_module: M13ICPPriorityMapping,
        mock_wave1_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test ICP scoring gives high score to 50M+ traffic."""
        result = await m13_module.execute(test_domain, mock_wave1_context)

        lead_score = result.data.get("lead_score", {})
        breakdown = lead_score.get("breakdown", {})

        # 50M+ traffic should get 30 points
        assert breakdown.get("traffic_volume") == 30

    @pytest.mark.asyncio
    async def test_priority_classification_hot(
        self,
        m13_module: M13ICPPriorityMapping,
        mock_wave1_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test priority classification for high score."""
        result = await m13_module.execute(test_domain, mock_wave1_context)

        priority = result.data.get("priority_classification", {})
        # With high traffic + commerce, should be HOT or WARM
        assert priority.get("status") in ["HOT", "WARM"]

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m13_module: M13ICPPriorityMapping,
        mock_wave1_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m13_module.execute(test_domain, mock_wave1_context)

        assert result.primary_citation is not None
        # Should also have supporting citations from context
        assert len(result.supporting_citations) > 0

    def test_lead_score_max_validation(self, m13_module: M13ICPPriorityMapping):
        """Test lead score does not exceed maximum."""
        inputs = {
            "vertical": "Commerce",  # 40 pts
            "monthly_visits": 100_000_000,  # 30 pts
            "tech_spend_estimate": 200_000,  # 20 pts
            "partner_technologies": ["Adobe Commerce"],  # 10 pts
            "displacement_priority": "HIGH",  # 10 pts
        }

        lead_score = m13_module._calculate_lead_score(inputs)
        assert lead_score.total <= 110


# =============================================================================
# M14 Signal Scoring Tests
# =============================================================================

class TestM14SignalScoring:
    """Tests for M14 Signal Scoring module."""

    def test_module_attributes(self, m14_module: M14SignalScoring):
        """Verify module has correct attributes."""
        assert m14_module.MODULE_ID == "m14_signal_scoring"
        assert m14_module.MODULE_NAME == "Signal Scoring"
        assert m14_module.WAVE == 4
        assert "m13_icp_priority_mapping" in m14_module.DEPENDS_ON

    @pytest.mark.asyncio
    async def test_execute_with_context(
        self,
        m14_module: M14SignalScoring,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test execution with full context."""
        result = await m14_module.execute(test_domain, mock_full_context)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data.get("signal_categories") is not None
        assert result.data.get("composite_score") is not None
        assert result.data.get("signal_quality") is not None
        assert result.data.get("priority_status") in ["HOT", "WARM", "COOL", "COLD"]

    @pytest.mark.asyncio
    async def test_signal_categories_present(
        self,
        m14_module: M14SignalScoring,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test all signal categories are present."""
        result = await m14_module.execute(test_domain, mock_full_context)

        categories = result.data.get("signal_categories", {})
        assert "budget_signals" in categories
        assert "pain_signals" in categories
        assert "timing_signals" in categories
        assert "negative_signals" in categories

    @pytest.mark.asyncio
    async def test_priority_status_valid(
        self,
        m14_module: M14SignalScoring,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test priority status is valid."""
        result = await m14_module.execute(test_domain, mock_full_context)

        valid_statuses = {"HOT", "WARM", "COOL", "COLD"}
        assert result.data.get("priority_status") in valid_statuses

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m14_module: M14SignalScoring,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m14_module.execute(test_domain, mock_full_context)

        assert result.primary_citation is not None

    def test_signal_quality_assessment(self, m14_module: M14SignalScoring):
        """Test signal quality assessment logic."""
        budget = SignalCategory(has_signal=True, total=20)
        pain = SignalCategory(has_signal=True, total=15)
        timing = SignalCategory(has_signal=True, total=25)

        quality = m14_module._assess_signal_quality(budget, pain, timing)

        assert quality.has_all_three_types is True
        assert quality.has_budget_signal is True
        assert quality.has_pain_signal is True
        assert quality.has_timing_signal is True
        assert quality.strongest_category == "timing"

    def test_composite_score_calculation(self, m14_module: M14SignalScoring):
        """Test composite score calculation."""
        budget = SignalCategory(total=30)
        pain = SignalCategory(total=25)
        timing = SignalCategory(total=20)
        negative = SignalCategory(total=-10)

        composite = m14_module._calculate_composite_score(
            budget, pain, timing, negative, icp_score=85
        )

        assert composite.raw_signal_score == 75  # 30 + 25 + 20
        assert composite.negative_adjustment == -10
        assert composite.adjusted_score == 65  # 75 - 10
        assert composite.icp_score == 85

    def test_priority_determination(self, m14_module: M14SignalScoring):
        """Test priority determination from score."""
        assert m14_module._determine_priority(150) == "HOT"
        assert m14_module._determine_priority(120) == "WARM"
        assert m14_module._determine_priority(80) == "COOL"
        assert m14_module._determine_priority(40) == "COLD"


# =============================================================================
# M15 Strategic Signal Brief Tests
# =============================================================================

class TestM15StrategicBrief:
    """Tests for M15 Strategic Signal Brief module."""

    def test_module_attributes(self, m15_module: M15StrategicBrief):
        """Verify module has correct attributes."""
        assert m15_module.MODULE_ID == "m15_strategic_brief"
        assert m15_module.MODULE_NAME == "Strategic Signal Brief"
        assert m15_module.WAVE == 4
        # Should depend on multiple prior modules
        assert len(m15_module.DEPENDS_ON) >= 5

    @pytest.mark.asyncio
    async def test_execute_with_context(
        self,
        m15_module: M15StrategicBrief,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test execution with full context."""
        result = await m15_module.execute(test_domain, mock_full_context)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data.get("sixty_second_story") is not None
        assert result.data.get("sources_bibliography") is not None

    @pytest.mark.asyncio
    async def test_sixty_second_story_generated(
        self,
        m15_module: M15StrategicBrief,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test 60-second story is generated."""
        result = await m15_module.execute(test_domain, mock_full_context)

        story = result.data.get("sixty_second_story", "")
        assert len(story) > 50  # Should be substantial
        assert "Costco" in story  # Should mention company name

    @pytest.mark.asyncio
    async def test_money_metrics_extracted(
        self,
        m15_module: M15StrategicBrief,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test money metrics are extracted."""
        result = await m15_module.execute(test_domain, mock_full_context)

        money = result.data.get("money", {})
        assert money.get("revenue") is not None
        # Costco has $242B revenue
        assert "B" in money.get("revenue", "")

    @pytest.mark.asyncio
    async def test_recommended_products_included(
        self,
        m15_module: M15StrategicBrief,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test recommended products are included."""
        result = await m15_module.execute(test_domain, mock_full_context)

        products = result.data.get("recommended_products", [])
        assert len(products) > 0
        # Should recommend Algolia products
        assert any("Algolia" in p or "algolia" in p.lower() for p in products)

    @pytest.mark.asyncio
    async def test_bibliography_collected(
        self,
        m15_module: M15StrategicBrief,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """Test bibliography is collected from all sources."""
        result = await m15_module.execute(test_domain, mock_full_context)

        bibliography = result.data.get("sources_bibliography", [])
        assert len(bibliography) > 0
        # All entries should be URLs
        assert all(url.startswith("http") for url in bibliography)

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m15_module: M15StrategicBrief,
        mock_full_context: Dict[str, ModuleResult],
        test_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m15_module.execute(test_domain, mock_full_context)

        assert result.primary_citation is not None
        # Should have many supporting citations
        assert len(result.supporting_citations) > 0

    def test_output_schema_compliance(self):
        """Test output schema can be instantiated."""
        data = StrategicSignalBriefData(
            domain="test.com",
            company_name="Test Company",
            sixty_second_story="Test story about the company.",
            money=MoneyMetrics(revenue="$1B"),
            competitive_landscape=CompetitiveLandscape(),
        )
        assert data.domain == "test.com"
        assert data.company_name == "Test Company"


# =============================================================================
# Source Citation Compliance Tests (P0 Requirement)
# =============================================================================

class TestSourceCitationCompliance:
    """
    P0 REQUIREMENT: Every module output MUST have source citations.
    """

    @pytest.mark.asyncio
    async def test_m12_citation_present(
        self,
        m12_module: M12CaseStudyMatching,
        mock_wave1_context: Dict[str, ModuleResult],
    ):
        """M12 must have source citation."""
        result = await m12_module.execute("costco.com", mock_wave1_context)
        assert result.primary_citation is not None

    @pytest.mark.asyncio
    async def test_m13_citation_present(
        self,
        m13_module: M13ICPPriorityMapping,
        mock_wave1_context: Dict[str, ModuleResult],
    ):
        """M13 must have source citation."""
        result = await m13_module.execute("costco.com", mock_wave1_context)
        assert result.primary_citation is not None

    @pytest.mark.asyncio
    async def test_m14_citation_present(
        self,
        m14_module: M14SignalScoring,
        mock_full_context: Dict[str, ModuleResult],
    ):
        """M14 must have source citation."""
        result = await m14_module.execute("costco.com", mock_full_context)
        assert result.primary_citation is not None

    @pytest.mark.asyncio
    async def test_m15_citation_present(
        self,
        m15_module: M15StrategicBrief,
        mock_full_context: Dict[str, ModuleResult],
    ):
        """M15 must have source citation."""
        result = await m15_module.execute("costco.com", mock_full_context)
        assert result.primary_citation is not None


# =============================================================================
# Dependency Validation Tests
# =============================================================================

class TestDependencyValidation:
    """Test that Wave 4 modules properly validate dependencies."""

    def test_m12_has_correct_dependencies(self, m12_module: M12CaseStudyMatching):
        """M12 should depend on Wave 1 modules."""
        deps = m12_module.DEPENDS_ON
        assert "m01_company_context" in deps
        assert "m02_technology_stack" in deps
        assert "m03_traffic_analysis" in deps
        assert "m04_financial_profile" in deps

    def test_m13_has_correct_dependencies(self, m13_module: M13ICPPriorityMapping):
        """M13 should depend on Wave 1 modules."""
        deps = m13_module.DEPENDS_ON
        assert "m01_company_context" in deps
        assert "m02_technology_stack" in deps
        assert "m03_traffic_analysis" in deps
        assert "m04_financial_profile" in deps

    def test_m14_has_correct_dependencies(self, m14_module: M14SignalScoring):
        """M14 should depend on M01-M04 and M13."""
        deps = m14_module.DEPENDS_ON
        assert "m01_company_context" in deps
        assert "m13_icp_priority_mapping" in deps

    def test_m15_has_most_dependencies(self, m15_module: M15StrategicBrief):
        """M15 should have the most dependencies as final synthesis."""
        deps = m15_module.DEPENDS_ON
        # Should depend on at least 5 modules
        assert len(deps) >= 5
        # Should include key synthesis modules
        assert "m12_case_study_matching" in deps
        assert "m13_icp_priority_mapping" in deps
        assert "m14_signal_scoring" in deps


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Test graceful error handling in Wave 4 modules."""

    @pytest.mark.asyncio
    async def test_m12_handles_empty_context(self, m12_module: M12CaseStudyMatching):
        """M12 should handle empty context gracefully."""
        result = await m12_module.execute("test.com", {})
        assert result.status == ModuleStatus.SUCCESS

    @pytest.mark.asyncio
    async def test_m13_handles_empty_context(self, m13_module: M13ICPPriorityMapping):
        """M13 should handle empty context gracefully."""
        result = await m13_module.execute("test.com", {})
        assert result.status == ModuleStatus.SUCCESS
        # Should have default scores
        assert result.data.get("lead_score", {}).get("total", 0) > 0

    @pytest.mark.asyncio
    async def test_m14_handles_minimal_context(
        self,
        m14_module: M14SignalScoring,
        mock_wave1_context: Dict[str, ModuleResult],
    ):
        """M14 should handle minimal context (no M13)."""
        # Remove M13 from context
        context = mock_wave1_context.copy()
        result = await m14_module.execute("costco.com", context)
        assert result.status == ModuleStatus.SUCCESS

    @pytest.mark.asyncio
    async def test_m15_handles_partial_context(
        self,
        m15_module: M15StrategicBrief,
        mock_wave1_context: Dict[str, ModuleResult],
    ):
        """M15 should handle partial context gracefully."""
        # Only Wave 1 context, no M12-M14
        result = await m15_module.execute("costco.com", mock_wave1_context)
        assert result.status == ModuleStatus.SUCCESS
        # Should still generate a story
        assert len(result.data.get("sixty_second_story", "")) > 0


# =============================================================================
# Metrics Tests
# =============================================================================

class TestModuleMetrics:
    """Test module metrics collection."""

    @pytest.mark.asyncio
    async def test_metrics_track_execution(self, m13_module: M13ICPPriorityMapping):
        """Metrics should track executions."""
        initial_count = m13_module.metrics.execution_count

        await m13_module.execute("test.com", {})

        assert m13_module.metrics.execution_count == initial_count + 1
        assert m13_module.metrics.success_count >= 1

    def test_get_metrics_returns_dict(self, m15_module: M15StrategicBrief):
        """get_metrics() should return metrics dict."""
        metrics = m15_module.get_metrics()

        assert "module_id" in metrics
        assert "wave" in metrics
        assert metrics["wave"] == 4
