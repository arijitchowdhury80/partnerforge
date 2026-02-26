"""
Wave 3 Intelligence Modules - Unit Tests
=========================================

Tests for the 4 Wave 3 deep intelligence modules:
- M08: Investor Intelligence
- M09: Executive Intelligence
- M10: Buying Committee
- M11: Displacement Analysis

Test Categories:
1. Module Registration - Verify modules are properly registered
2. Execution - Test successful execution with mock data
3. Dependencies - Verify dependency validation
4. Output Validation - Verify output schema compliance
5. Source Citation - Verify P0 requirement compliance
6. Error Handling - Test graceful degradation
7. Business Logic - Test module-specific business rules
8. Integration - Test module chaining

Run with: pytest tests/unit/modules/test_wave3_modules.py -v
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
    get_module_class,
    instantiate_module,
)
from pipeline.modules.m08_investor_intelligence import (
    M08InvestorIntelligence,
    InvestorIntelligenceData,
    SECFilingData,
    EarningsCallData,
    EarningsCallQuote,
    GuidanceData,
    DigitalCommitment,
)
from pipeline.modules.m09_executive_intelligence import (
    M09ExecutiveIntelligence,
    ExecutiveIntelligenceData,
    ExecutiveProfile,
    BuyingCommitteeSummary,
    SpeakingLanguage,
    QuoteToProductMapping,
)
from pipeline.modules.m10_buying_committee import (
    M10BuyingCommittee,
    BuyingCommitteeData,
    CommitteeMember,
    CommitteeDynamics,
    EngagementStep,
)
from pipeline.modules.m11_displacement_analysis import (
    M11DisplacementAnalysis,
    DisplacementAnalysisData,
    DisplacementOpportunity,
    PartnerCoSellOpportunity,
    CompetitiveDisplacement,
    AlgoliaFitScore,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def m08_module() -> M08InvestorIntelligence:
    """Create M08 Investor Intelligence module instance."""
    return M08InvestorIntelligence()


@pytest.fixture
def m09_module() -> M09ExecutiveIntelligence:
    """Create M09 Executive Intelligence module instance."""
    return M09ExecutiveIntelligence()


@pytest.fixture
def m10_module() -> M10BuyingCommittee:
    """Create M10 Buying Committee module instance."""
    return M10BuyingCommittee()


@pytest.fixture
def m11_module() -> M11DisplacementAnalysis:
    """Create M11 Displacement Analysis module instance."""
    return M11DisplacementAnalysis()


@pytest.fixture
def known_public_domain() -> str:
    """Domain for a known public company with mock data."""
    return "sallybeauty.com"


@pytest.fixture
def known_costco_domain() -> str:
    """Domain for Costco with mock data."""
    return "costco.com"


@pytest.fixture
def unknown_domain() -> str:
    """Domain without mock data."""
    return "unknown-private-company.com"


@pytest.fixture
def mock_m01_context() -> Dict[str, ModuleResult]:
    """Mock M01 company context result."""
    citation = SourceCitation(
        source_type=SourceType.WEBSEARCH,
        source_url="https://www.google.com/search?q=sallybeauty.com",
        retrieved_at=datetime.utcnow(),
    )
    return {
        "m01_company_context": ModuleResult(
            module_id="m01_company_context",
            domain="sallybeauty.com",
            status=ModuleStatus.SUCCESS,
            data={
                "domain": "sallybeauty.com",
                "company_name": "Sally Beauty Holdings, Inc.",
                "ticker": "SBH",
                "is_public": True,
            },
            primary_citation=citation,
        )
    }


@pytest.fixture
def mock_m04_context() -> Dict[str, ModuleResult]:
    """Mock M04 financial profile result."""
    citation = SourceCitation(
        source_type=SourceType.YAHOO_FINANCE,
        source_url="https://finance.yahoo.com/quote/SBH/",
        retrieved_at=datetime.utcnow(),
    )
    return {
        "m04_financial_profile": ModuleResult(
            module_id="m04_financial_profile",
            domain="sallybeauty.com",
            status=ModuleStatus.SUCCESS,
            data={
                "domain": "sallybeauty.com",
                "ticker": "SBH",
                "is_public": True,
            },
            primary_citation=citation,
        )
    }


@pytest.fixture
def mock_m02_context() -> Dict[str, ModuleResult]:
    """Mock M02 technology stack result."""
    citation = SourceCitation(
        source_type=SourceType.BUILTWITH,
        source_url="https://builtwith.com/sallybeauty.com",
        retrieved_at=datetime.utcnow(),
    )
    return {
        "m02_technology_stack": ModuleResult(
            module_id="m02_technology_stack",
            domain="sallybeauty.com",
            status=ModuleStatus.SUCCESS,
            data={
                "domain": "sallybeauty.com",
                "search_provider": {
                    "current": "Salesforce Einstein",
                    "is_algolia": False,
                    "displacement_priority": "HIGH",
                },
                "partner_technologies": ["Salesforce Commerce Cloud"],
                "technologies": [
                    {"name": "Salesforce Commerce Cloud", "category": "ecommerce"},
                ],
                "technology_by_category": {"ecommerce": ["Salesforce Commerce Cloud"]},
            },
            primary_citation=citation,
        )
    }


@pytest.fixture
def mock_m09_context() -> Dict[str, ModuleResult]:
    """Mock M09 executive intelligence result."""
    citation = SourceCitation(
        source_type=SourceType.LINKEDIN,
        source_url="https://www.linkedin.com/company/sallybeauty/",
        retrieved_at=datetime.utcnow(),
    )
    return {
        "m09_executive_intelligence": ModuleResult(
            module_id="m09_executive_intelligence",
            domain="sallybeauty.com",
            status=ModuleStatus.SUCCESS,
            data={
                "domain": "sallybeauty.com",
                "executives": [
                    {
                        "name": "Denise Paulonis",
                        "title": "President & CEO",
                        "buyer_role": "Executive Sponsor",
                        "priority": "HIGH",
                        "linkedin_url": "https://www.linkedin.com/in/denisepaulonis/",
                        "entry_approach": "Executive briefing with ROI case",
                    },
                    {
                        "name": "Scott Lindblom",
                        "title": "SVP & CIO",
                        "buyer_role": "Technical Buyer",
                        "priority": "HIGH",
                        "is_new_to_role": True,
                    },
                    {
                        "name": "Chris Hansen",
                        "title": "VP, Digital Product",
                        "buyer_role": "Champion",
                        "priority": "HIGH",
                        "entry_approach": "LinkedIn connection, CommerceNext reference",
                    },
                ],
            },
            primary_citation=citation,
        )
    }


@pytest.fixture
def full_wave3_context(
    mock_m01_context,
    mock_m04_context,
    mock_m02_context,
    mock_m09_context,
) -> Dict[str, ModuleResult]:
    """Combined context with all Wave 1-2 dependencies."""
    context = {}
    context.update(mock_m01_context)
    context.update(mock_m04_context)
    context.update(mock_m02_context)
    context.update(mock_m09_context)
    return context


# =============================================================================
# Module Registration Tests
# =============================================================================

class TestModuleRegistration:
    """Test that Wave 3 modules are properly registered."""

    def test_all_wave3_modules_registered(self):
        """Verify all 4 Wave 3 modules are registered."""
        all_modules = get_all_modules()

        assert "m08_investor_intelligence" in all_modules
        assert "m09_executive_intelligence" in all_modules
        assert "m10_buying_committee" in all_modules
        assert "m11_displacement_analysis" in all_modules

    def test_wave3_modules_in_wave3(self):
        """Verify Wave 3 modules are assigned to Wave 3."""
        wave3_modules = get_modules_by_wave(3)

        module_ids = [m.MODULE_ID for m in wave3_modules]
        assert "m08_investor_intelligence" in module_ids
        assert "m09_executive_intelligence" in module_ids
        assert "m10_buying_committee" in module_ids
        assert "m11_displacement_analysis" in module_ids

    def test_get_module_class_by_id(self):
        """Verify we can retrieve module class by ID."""
        m08_cls = get_module_class("m08_investor_intelligence")
        assert m08_cls is not None
        assert m08_cls.MODULE_ID == "m08_investor_intelligence"

    def test_instantiate_module_by_id(self):
        """Verify we can instantiate modules by ID."""
        for module_id in [
            "m08_investor_intelligence",
            "m09_executive_intelligence",
            "m10_buying_committee",
            "m11_displacement_analysis",
        ]:
            module = instantiate_module(module_id)
            assert module is not None
            assert module.MODULE_ID == module_id


# =============================================================================
# M08 Investor Intelligence Tests
# =============================================================================

class TestM08InvestorIntelligence:
    """Tests for M08 Investor Intelligence module."""

    def test_module_attributes(self, m08_module: M08InvestorIntelligence):
        """Verify module has correct attributes."""
        assert m08_module.MODULE_ID == "m08_investor_intelligence"
        assert m08_module.MODULE_NAME == "Investor Intelligence"
        assert m08_module.WAVE == 3
        assert "m01_company_context" in m08_module.DEPENDS_ON
        assert "m04_financial_profile" in m08_module.DEPENDS_ON
        assert m08_module.OUTPUT_TABLE == "intel_investor_intelligence"

    @pytest.mark.asyncio
    async def test_execute_public_company(
        self,
        m08_module: M08InvestorIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """Test execution with public company returns investor data."""
        context = {**mock_m01_context, **mock_m04_context}
        result = await m08_module.execute(known_public_domain, context)

        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == known_public_domain
        assert result.data["is_public"] is True

        # Check SEC filings
        assert "sec_filings" in result.data
        assert "latest_10k" in result.data

        # Check earnings calls
        assert "earnings_calls" in result.data

    @pytest.mark.asyncio
    async def test_executive_quotes_extracted(
        self,
        m08_module: M08InvestorIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """Test that executive quotes are extracted with attribution."""
        context = {**mock_m01_context, **mock_m04_context}
        result = await m08_module.execute(known_public_domain, context)

        quotes = result.data.get("executive_quotes", [])
        assert len(quotes) > 0

        # Verify quote structure
        for quote in quotes:
            assert "quote" in quote
            assert "speaker_name" in quote
            assert "speaker_title" in quote
            assert "source_url" in quote or "source_type" in quote

    @pytest.mark.asyncio
    async def test_search_priority_level_calculated(
        self,
        m08_module: M08InvestorIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """Test search priority level is calculated."""
        context = {**mock_m01_context, **mock_m04_context}
        result = await m08_module.execute(known_public_domain, context)

        # Sally Beauty should have HIGH priority (explicit search mention)
        assert result.data["search_priority_level"] == "HIGH"

    @pytest.mark.asyncio
    async def test_digital_commitments_extracted(
        self,
        m08_module: M08InvestorIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """Test digital commitments are extracted."""
        context = {**mock_m01_context, **mock_m04_context}
        result = await m08_module.execute(known_public_domain, context)

        commitments = result.data.get("digital_commitments", [])
        assert len(commitments) > 0

        # Sally has explicit search mention
        search_mention = any(c.get("explicit_search_mention") for c in commitments)
        assert search_mention

    @pytest.mark.asyncio
    async def test_dependency_validation(
        self,
        m08_module: M08InvestorIntelligence,
        known_public_domain: str,
    ):
        """Test that missing dependencies raise error."""
        with pytest.raises(DependencyNotMetError) as exc_info:
            await m08_module.execute(known_public_domain, context={})

        assert "m01_company_context" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m08_module: M08InvestorIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        context = {**mock_m01_context, **mock_m04_context}
        result = await m08_module.execute(known_public_domain, context)

        assert result.primary_citation is not None
        assert result.primary_citation.source_url is not None

    @pytest.mark.asyncio
    async def test_private_company_handling(
        self,
        m08_module: M08InvestorIntelligence,
        unknown_domain: str,
    ):
        """Test private company returns limited data gracefully."""
        # Create context with is_public=False
        citation = SourceCitation(
            source_type=SourceType.WEBSEARCH,
            source_url=f"https://www.google.com/search?q={unknown_domain}",
            retrieved_at=datetime.utcnow(),
        )
        context = {
            "m01_company_context": ModuleResult(
                module_id="m01_company_context",
                domain=unknown_domain,
                status=ModuleStatus.SUCCESS,
                data={"domain": unknown_domain, "is_public": False},
                primary_citation=citation,
            ),
            "m04_financial_profile": ModuleResult(
                module_id="m04_financial_profile",
                domain=unknown_domain,
                status=ModuleStatus.SUCCESS,
                data={"domain": unknown_domain, "is_public": False},
                primary_citation=citation,
            ),
        }

        result = await m08_module.execute(unknown_domain, context)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data["is_public"] is False
        assert result.data["data_limitation_reason"] is not None


# =============================================================================
# M09 Executive Intelligence Tests
# =============================================================================

class TestM09ExecutiveIntelligence:
    """Tests for M09 Executive Intelligence module."""

    def test_module_attributes(self, m09_module: M09ExecutiveIntelligence):
        """Verify module has correct attributes."""
        assert m09_module.MODULE_ID == "m09_executive_intelligence"
        assert m09_module.MODULE_NAME == "Executive Intelligence"
        assert m09_module.WAVE == 3
        assert "m01_company_context" in m09_module.DEPENDS_ON
        assert m09_module.PRIMARY_SOURCE_TYPE == SourceType.LINKEDIN

    @pytest.mark.asyncio
    async def test_execute_known_company(
        self,
        m09_module: M09ExecutiveIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
    ):
        """Test execution with known company returns executives."""
        result = await m09_module.execute(known_public_domain, mock_m01_context)

        assert result.status == ModuleStatus.SUCCESS
        assert len(result.data["executives"]) > 0

    @pytest.mark.asyncio
    async def test_buyer_roles_classified(
        self,
        m09_module: M09ExecutiveIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
    ):
        """Test buyer roles are classified."""
        result = await m09_module.execute(known_public_domain, mock_m01_context)

        executives = result.data["executives"]
        roles = [e["buyer_role"] for e in executives]

        # Should have multiple roles
        assert len(set(roles)) > 1
        # Should have key roles
        assert "Executive Sponsor" in roles or "Champion" in roles

    @pytest.mark.asyncio
    async def test_buying_committee_summary_generated(
        self,
        m09_module: M09ExecutiveIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
    ):
        """Test buying committee summary is generated."""
        result = await m09_module.execute(known_public_domain, mock_m01_context)

        summary = result.data["buying_committee_summary"]
        assert summary is not None
        # Should have at least one role filled
        assert any([
            summary.get("executive_sponsor"),
            summary.get("economic_buyer"),
            summary.get("technical_buyer"),
            summary.get("champion"),
        ])

    @pytest.mark.asyncio
    async def test_entry_points_generated(
        self,
        m09_module: M09ExecutiveIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
    ):
        """Test recommended entry points are generated."""
        result = await m09_module.execute(known_public_domain, mock_m01_context)

        entry_points = result.data["recommended_entry_points"]
        assert len(entry_points) > 0

    @pytest.mark.asyncio
    async def test_speaking_language_extracted(
        self,
        m09_module: M09ExecutiveIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
    ):
        """Test speaking language is extracted for executives with quotes."""
        result = await m09_module.execute(known_public_domain, mock_m01_context)

        executives = result.data["executives"]
        execs_with_language = [
            e for e in executives
            if e.get("speaking_language") and
               e["speaking_language"].get("quote_to_product_mapping")
        ]

        # Denise Paulonis should have quotes
        assert len(execs_with_language) > 0

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m09_module: M09ExecutiveIntelligence,
        known_public_domain: str,
        mock_m01_context: Dict,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m09_module.execute(known_public_domain, mock_m01_context)

        assert result.primary_citation is not None
        assert result.primary_citation.source_type in [
            SourceType.LINKEDIN,
            SourceType.COMPANY_WEBSITE,
            SourceType.WEBSEARCH,
        ]


# =============================================================================
# M10 Buying Committee Tests
# =============================================================================

class TestM10BuyingCommittee:
    """Tests for M10 Buying Committee module."""

    def test_module_attributes(self, m10_module: M10BuyingCommittee):
        """Verify module has correct attributes."""
        assert m10_module.MODULE_ID == "m10_buying_committee"
        assert m10_module.MODULE_NAME == "Buying Committee"
        assert m10_module.WAVE == 3
        assert "m01_company_context" in m10_module.DEPENDS_ON
        assert "m09_executive_intelligence" in m10_module.DEPENDS_ON

    @pytest.mark.asyncio
    async def test_execute_with_executives(
        self,
        m10_module: M10BuyingCommittee,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m09_context: Dict,
    ):
        """Test execution with executives returns committee map."""
        context = {**mock_m01_context, **mock_m09_context}
        result = await m10_module.execute(known_public_domain, context)

        assert result.status == ModuleStatus.SUCCESS
        assert "buying_committee" in result.data

    @pytest.mark.asyncio
    async def test_committee_roles_mapped(
        self,
        m10_module: M10BuyingCommittee,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m09_context: Dict,
    ):
        """Test committee roles are properly mapped."""
        context = {**mock_m01_context, **mock_m09_context}
        result = await m10_module.execute(known_public_domain, context)

        committee = result.data["buying_committee"]
        assert "executive_sponsor" in committee
        assert "economic_buyer" in committee
        assert "technical_buyer" in committee
        assert "champion" in committee

    @pytest.mark.asyncio
    async def test_engagement_sequence_generated(
        self,
        m10_module: M10BuyingCommittee,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m09_context: Dict,
    ):
        """Test engagement sequence is generated."""
        context = {**mock_m01_context, **mock_m09_context}
        result = await m10_module.execute(known_public_domain, context)

        sequence = result.data["engagement_sequence"]
        assert len(sequence) > 0

        # Verify sequence structure
        for step in sequence:
            assert "step" in step
            assert "target" in step
            assert "approach" in step

    @pytest.mark.asyncio
    async def test_committee_dynamics_analyzed(
        self,
        m10_module: M10BuyingCommittee,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m09_context: Dict,
    ):
        """Test committee dynamics are analyzed."""
        context = {**mock_m01_context, **mock_m09_context}
        result = await m10_module.execute(known_public_domain, context)

        dynamics = result.data["committee_dynamics"]
        assert "total_decision_makers" in dynamics
        assert dynamics["total_decision_makers"] > 0

    @pytest.mark.asyncio
    async def test_completeness_score_calculated(
        self,
        m10_module: M10BuyingCommittee,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m09_context: Dict,
    ):
        """Test committee completeness score is calculated."""
        context = {**mock_m01_context, **mock_m09_context}
        result = await m10_module.execute(known_public_domain, context)

        assert "committee_completeness_score" in result.data
        assert 0.0 <= result.data["committee_completeness_score"] <= 1.0

    @pytest.mark.asyncio
    async def test_dependency_on_m09(
        self,
        m10_module: M10BuyingCommittee,
        known_public_domain: str,
        mock_m01_context: Dict,
    ):
        """Test that M10 requires M09."""
        with pytest.raises(DependencyNotMetError) as exc_info:
            await m10_module.execute(known_public_domain, mock_m01_context)

        assert "m09_executive_intelligence" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m10_module: M10BuyingCommittee,
        known_public_domain: str,
        mock_m01_context: Dict,
        mock_m09_context: Dict,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        context = {**mock_m01_context, **mock_m09_context}
        result = await m10_module.execute(known_public_domain, context)

        assert result.primary_citation is not None


# =============================================================================
# M11 Displacement Analysis Tests
# =============================================================================

class TestM11DisplacementAnalysis:
    """Tests for M11 Displacement Analysis module."""

    def test_module_attributes(self, m11_module: M11DisplacementAnalysis):
        """Verify module has correct attributes."""
        assert m11_module.MODULE_ID == "m11_displacement_analysis"
        assert m11_module.MODULE_NAME == "Displacement Analysis"
        assert m11_module.WAVE == 3
        assert "m02_technology_stack" in m11_module.DEPENDS_ON
        assert m11_module.PRIMARY_SOURCE_TYPE == SourceType.BUILTWITH

    @pytest.mark.asyncio
    async def test_execute_with_tech_stack(
        self,
        m11_module: M11DisplacementAnalysis,
        known_public_domain: str,
        mock_m02_context: Dict,
    ):
        """Test execution with tech stack returns analysis."""
        result = await m11_module.execute(known_public_domain, mock_m02_context)

        assert result.status == ModuleStatus.SUCCESS
        assert "displacement_opportunity" in result.data

    @pytest.mark.asyncio
    async def test_current_provider_detected(
        self,
        m11_module: M11DisplacementAnalysis,
        known_public_domain: str,
        mock_m02_context: Dict,
    ):
        """Test current search provider is detected."""
        result = await m11_module.execute(known_public_domain, mock_m02_context)

        displacement = result.data["displacement_opportunity"]
        assert displacement["current_search_provider"] is not None
        assert displacement["provider_type"] is not None

    @pytest.mark.asyncio
    async def test_displacement_difficulty_calculated(
        self,
        m11_module: M11DisplacementAnalysis,
        known_public_domain: str,
        mock_m02_context: Dict,
    ):
        """Test displacement difficulty is calculated."""
        result = await m11_module.execute(known_public_domain, mock_m02_context)

        displacement = result.data["displacement_opportunity"]
        assert displacement["displacement_difficulty"] in [
            "LOW", "MEDIUM", "HIGH", "VERY_HIGH", "UNKNOWN", "N/A"
        ]

    @pytest.mark.asyncio
    async def test_partner_opportunities_identified(
        self,
        m11_module: M11DisplacementAnalysis,
        known_public_domain: str,
        mock_m02_context: Dict,
    ):
        """Test partner co-sell opportunities are identified."""
        result = await m11_module.execute(known_public_domain, mock_m02_context)

        partners = result.data["partner_co_sell_opportunities"]
        # Sally Beauty uses SFCC - should have partner opportunity
        assert len(partners) > 0

        for partner in partners:
            assert "partner" in partner
            assert "motion" in partner

    @pytest.mark.asyncio
    async def test_algolia_fit_score_calculated(
        self,
        m11_module: M11DisplacementAnalysis,
        known_public_domain: str,
        mock_m02_context: Dict,
    ):
        """Test Algolia fit score is calculated."""
        result = await m11_module.execute(known_public_domain, mock_m02_context)

        fit = result.data["algolia_fit_score"]
        assert "technical_fit" in fit
        assert "business_fit" in fit
        assert "timing_fit" in fit
        assert "overall" in fit
        assert 0 <= fit["overall"] <= 10

    @pytest.mark.asyncio
    async def test_products_recommended(
        self,
        m11_module: M11DisplacementAnalysis,
        known_public_domain: str,
        mock_m02_context: Dict,
    ):
        """Test Algolia products are recommended."""
        result = await m11_module.execute(known_public_domain, mock_m02_context)

        products = result.data["recommended_products"]
        assert len(products) > 0
        assert "Algolia Search" in products

    @pytest.mark.asyncio
    async def test_priority_calculated(
        self,
        m11_module: M11DisplacementAnalysis,
        known_public_domain: str,
        mock_m02_context: Dict,
    ):
        """Test displacement priority is calculated."""
        result = await m11_module.execute(known_public_domain, mock_m02_context)

        assert result.data["displacement_priority"] in ["HIGH", "MEDIUM", "LOW", "N/A"]
        assert result.data["priority_reasoning"] is not None

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m11_module: M11DisplacementAnalysis,
        known_public_domain: str,
        mock_m02_context: Dict,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m11_module.execute(known_public_domain, mock_m02_context)

        assert result.primary_citation is not None
        assert result.primary_citation.source_type == SourceType.BUILTWITH


# =============================================================================
# Source Citation Compliance Tests (P0 Requirement)
# =============================================================================

class TestSourceCitationCompliance:
    """
    P0 REQUIREMENT: Every module output MUST have source citations.
    """

    @pytest.mark.asyncio
    async def test_m08_citation_present(
        self,
        m08_module: M08InvestorIntelligence,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """M08 must have source citation."""
        context = {**mock_m01_context, **mock_m04_context}
        result = await m08_module.execute("sallybeauty.com", context)

        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_m09_citation_present(
        self,
        m09_module: M09ExecutiveIntelligence,
        mock_m01_context: Dict,
    ):
        """M09 must have source citation."""
        result = await m09_module.execute("sallybeauty.com", mock_m01_context)

        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_m10_citation_present(
        self,
        m10_module: M10BuyingCommittee,
        mock_m01_context: Dict,
        mock_m09_context: Dict,
    ):
        """M10 must have source citation."""
        context = {**mock_m01_context, **mock_m09_context}
        result = await m10_module.execute("sallybeauty.com", context)

        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_m11_citation_present(
        self,
        m11_module: M11DisplacementAnalysis,
        mock_m02_context: Dict,
    ):
        """M11 must have source citation."""
        result = await m11_module.execute("sallybeauty.com", mock_m02_context)

        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")


# =============================================================================
# Dependency Validation Tests
# =============================================================================

class TestDependencyValidation:
    """Test that Wave 3 modules properly validate dependencies."""

    def test_m08_dependencies(self, m08_module: M08InvestorIntelligence):
        """M08 should depend on M01 and M04."""
        assert "m01_company_context" in m08_module.DEPENDS_ON
        assert "m04_financial_profile" in m08_module.DEPENDS_ON

    def test_m09_dependencies(self, m09_module: M09ExecutiveIntelligence):
        """M09 should depend on M01."""
        assert "m01_company_context" in m09_module.DEPENDS_ON

    def test_m10_dependencies(self, m10_module: M10BuyingCommittee):
        """M10 should depend on M01 and M09."""
        assert "m01_company_context" in m10_module.DEPENDS_ON
        assert "m09_executive_intelligence" in m10_module.DEPENDS_ON

    def test_m11_dependencies(self, m11_module: M11DisplacementAnalysis):
        """M11 should depend on M02."""
        assert "m02_technology_stack" in m11_module.DEPENDS_ON


# =============================================================================
# Integration Tests - Module Chaining
# =============================================================================

class TestModuleChaining:
    """Test that modules can be chained properly."""

    @pytest.mark.asyncio
    async def test_m08_to_m09_data_flow(
        self,
        m08_module: M08InvestorIntelligence,
        m09_module: M09ExecutiveIntelligence,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """Test that M08 data can inform M09."""
        # Run M08
        m08_context = {**mock_m01_context, **mock_m04_context}
        m08_result = await m08_module.execute("sallybeauty.com", m08_context)

        # Run M09 with M08 result
        m09_context = {
            **mock_m01_context,
            "m08_investor_intelligence": m08_result,
        }
        m09_result = await m09_module.execute("sallybeauty.com", m09_context)

        assert m09_result.status == ModuleStatus.SUCCESS

    @pytest.mark.asyncio
    async def test_m09_to_m10_data_flow(
        self,
        m09_module: M09ExecutiveIntelligence,
        m10_module: M10BuyingCommittee,
        mock_m01_context: Dict,
    ):
        """Test that M09 data feeds into M10."""
        # Run M09
        m09_result = await m09_module.execute("sallybeauty.com", mock_m01_context)

        # Run M10 with M09 result
        m10_context = {
            **mock_m01_context,
            "m09_executive_intelligence": m09_result,
        }
        m10_result = await m10_module.execute("sallybeauty.com", m10_context)

        assert m10_result.status == ModuleStatus.SUCCESS
        # Committee should be populated from M09 executives
        assert m10_result.data["committee_completeness_score"] > 0


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Test graceful error handling in Wave 3 modules."""

    @pytest.mark.asyncio
    async def test_m08_handles_missing_investor_data(
        self,
        m08_module: M08InvestorIntelligence,
    ):
        """M08 should handle companies without investor data."""
        citation = SourceCitation(
            source_type=SourceType.WEBSEARCH,
            source_url="https://google.com",
            retrieved_at=datetime.utcnow(),
        )
        context = {
            "m01_company_context": ModuleResult(
                module_id="m01_company_context",
                domain="unknown.com",
                status=ModuleStatus.SUCCESS,
                data={"domain": "unknown.com", "is_public": True},
                primary_citation=citation,
            ),
            "m04_financial_profile": ModuleResult(
                module_id="m04_financial_profile",
                domain="unknown.com",
                status=ModuleStatus.SUCCESS,
                data={"domain": "unknown.com", "is_public": True, "ticker": "UNK"},
                primary_citation=citation,
            ),
        }

        result = await m08_module.execute("unknown.com", context)
        assert result.status == ModuleStatus.SUCCESS
        # Should return empty but valid data

    @pytest.mark.asyncio
    async def test_m10_handles_no_executives(
        self,
        m10_module: M10BuyingCommittee,
    ):
        """M10 should handle when M09 returns no executives."""
        citation = SourceCitation(
            source_type=SourceType.WEBSEARCH,
            source_url="https://google.com",
            retrieved_at=datetime.utcnow(),
        )
        context = {
            "m01_company_context": ModuleResult(
                module_id="m01_company_context",
                domain="unknown.com",
                status=ModuleStatus.SUCCESS,
                data={"domain": "unknown.com"},
                primary_citation=citation,
            ),
            "m09_executive_intelligence": ModuleResult(
                module_id="m09_executive_intelligence",
                domain="unknown.com",
                status=ModuleStatus.SUCCESS,
                data={"domain": "unknown.com", "executives": []},
                primary_citation=citation,
            ),
        }

        result = await m10_module.execute("unknown.com", context)
        assert result.status == ModuleStatus.SUCCESS
        assert result.data["committee_completeness_score"] == 0.0


# =============================================================================
# Metrics Tests
# =============================================================================

class TestModuleMetrics:
    """Test module metrics collection for Wave 3."""

    @pytest.mark.asyncio
    async def test_m08_metrics_tracked(
        self,
        m08_module: M08InvestorIntelligence,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """Test M08 tracks execution metrics."""
        initial_count = m08_module.metrics.execution_count

        context = {**mock_m01_context, **mock_m04_context}
        await m08_module.execute("sallybeauty.com", context)

        assert m08_module.metrics.execution_count == initial_count + 1
        assert m08_module.metrics.success_count >= 1
        assert m08_module.metrics.total_duration_ms > 0

    def test_get_metrics_returns_dict(self, m08_module: M08InvestorIntelligence):
        """get_metrics() should return metrics dict."""
        metrics = m08_module.get_metrics()

        assert "module_id" in metrics
        assert "wave" in metrics
        assert metrics["wave"] == 3


# =============================================================================
# Output Schema Validation Tests
# =============================================================================

class TestOutputSchemas:
    """Test that module outputs match expected schemas."""

    @pytest.mark.asyncio
    async def test_m08_output_schema(
        self,
        m08_module: M08InvestorIntelligence,
        mock_m01_context: Dict,
        mock_m04_context: Dict,
    ):
        """M08 output should match InvestorIntelligenceData schema."""
        context = {**mock_m01_context, **mock_m04_context}
        result = await m08_module.execute("sallybeauty.com", context)

        data = InvestorIntelligenceData(**result.data)
        assert data.domain == "sallybeauty.com"

    @pytest.mark.asyncio
    async def test_m09_output_schema(
        self,
        m09_module: M09ExecutiveIntelligence,
        mock_m01_context: Dict,
    ):
        """M09 output should match ExecutiveIntelligenceData schema."""
        result = await m09_module.execute("sallybeauty.com", mock_m01_context)

        data = ExecutiveIntelligenceData(**result.data)
        assert data.domain == "sallybeauty.com"

    @pytest.mark.asyncio
    async def test_m10_output_schema(
        self,
        m10_module: M10BuyingCommittee,
        mock_m01_context: Dict,
        mock_m09_context: Dict,
    ):
        """M10 output should match BuyingCommitteeData schema."""
        context = {**mock_m01_context, **mock_m09_context}
        result = await m10_module.execute("sallybeauty.com", context)

        data = BuyingCommitteeData(**result.data)
        assert data.domain == "sallybeauty.com"

    @pytest.mark.asyncio
    async def test_m11_output_schema(
        self,
        m11_module: M11DisplacementAnalysis,
        mock_m02_context: Dict,
    ):
        """M11 output should match DisplacementAnalysisData schema."""
        result = await m11_module.execute("sallybeauty.com", mock_m02_context)

        data = DisplacementAnalysisData(**result.data)
        assert data.domain == "sallybeauty.com"
