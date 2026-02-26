"""
Wave 1 Intelligence Modules - Unit Tests
=========================================

Tests for the 4 Wave 1 foundation modules:
- M01: Company Context
- M02: Technology Stack
- M03: Traffic Analysis
- M04: Financial Profile

Test Categories:
1. Module Registration - Verify modules are properly registered
2. Execution - Test successful execution with mock data
3. Output Validation - Verify output schema compliance
4. Source Citation - Verify P0 requirement compliance
5. Error Handling - Test graceful degradation
6. Data Quality - Test quality scoring
7. Edge Cases - Test unusual inputs

Run with: pytest tests/unit/modules/test_wave1_modules.py -v
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
    M01CompanyContext,
    M02TechnologyStack,
    M03TrafficAnalysis,
    M04FinancialProfile,
    CompanyContextData,
    TechnologyStackData,
    TrafficAnalysisData,
    FinancialProfileData,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def m01_module() -> M01CompanyContext:
    """Create M01 Company Context module instance."""
    return M01CompanyContext()


@pytest.fixture
def m02_module() -> M02TechnologyStack:
    """Create M02 Technology Stack module instance."""
    return M02TechnologyStack()


@pytest.fixture
def m03_module() -> M03TrafficAnalysis:
    """Create M03 Traffic Analysis module instance."""
    return M03TrafficAnalysis()


@pytest.fixture
def m04_module() -> M04FinancialProfile:
    """Create M04 Financial Profile module instance."""
    return M04FinancialProfile()


@pytest.fixture
def known_public_domain() -> str:
    """Domain for a known public company with mock data."""
    return "costco.com"


@pytest.fixture
def known_beauty_domain() -> str:
    """Domain for Sally Beauty with mock data."""
    return "sallybeauty.com"


@pytest.fixture
def unknown_domain() -> str:
    """Domain without mock data."""
    return "unknown-company-12345.com"


# =============================================================================
# Module Registration Tests
# =============================================================================

class TestModuleRegistration:
    """Test that modules are properly registered in the registry."""

    def test_all_wave1_modules_registered(self):
        """Verify all 4 Wave 1 modules are registered."""
        all_modules = get_all_modules()

        assert "m01_company_context" in all_modules
        assert "m02_technology_stack" in all_modules
        assert "m03_traffic_analysis" in all_modules
        assert "m04_financial_profile" in all_modules

    def test_wave1_modules_in_wave1(self):
        """Verify Wave 1 modules are assigned to Wave 1."""
        wave1_modules = get_modules_by_wave(1)

        module_ids = [m.MODULE_ID for m in wave1_modules]
        assert "m01_company_context" in module_ids
        assert "m02_technology_stack" in module_ids
        assert "m03_traffic_analysis" in module_ids
        assert "m04_financial_profile" in module_ids

    def test_wave_order_structure(self):
        """Verify wave order returns correct structure."""
        wave_order = get_wave_order()

        assert len(wave_order) == 4  # 4 waves
        assert len(wave_order[0]) >= 4  # Wave 1 has at least 4 modules

    def test_get_module_class_by_id(self):
        """Verify we can retrieve module class by ID."""
        m01_cls = get_module_class("m01_company_context")
        assert m01_cls is not None
        assert m01_cls.MODULE_ID == "m01_company_context"

    def test_instantiate_module_by_id(self):
        """Verify we can instantiate module by ID."""
        module = instantiate_module("m01_company_context")
        assert module is not None
        assert isinstance(module, M01CompanyContext)

    def test_get_nonexistent_module_returns_none(self):
        """Verify getting non-existent module returns None."""
        module = get_module_class("nonexistent_module")
        assert module is None


# =============================================================================
# M01 Company Context Tests
# =============================================================================

class TestM01CompanyContext:
    """Tests for M01 Company Context module."""

    def test_module_attributes(self, m01_module: M01CompanyContext):
        """Verify module has correct attributes."""
        assert m01_module.MODULE_ID == "m01_company_context"
        assert m01_module.MODULE_NAME == "Company Context"
        assert m01_module.WAVE == 1
        assert m01_module.DEPENDS_ON == []
        assert m01_module.OUTPUT_TABLE == "intel_company_context"

    @pytest.mark.asyncio
    async def test_execute_known_domain(
        self,
        m01_module: M01CompanyContext,
        known_public_domain: str,
    ):
        """Test execution with known domain returns valid result."""
        result = await m01_module.execute(known_public_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == known_public_domain
        assert result.module_id == "m01_company_context"
        assert result.data is not None
        assert result.data["company_name"] == "Costco Wholesale Corporation"
        assert result.data["ticker"] == "COST"
        assert result.data["is_public"] is True

    @pytest.mark.asyncio
    async def test_execute_has_source_citation(
        self,
        m01_module: M01CompanyContext,
        known_public_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m01_module.execute(known_public_domain)

        assert result.primary_citation is not None
        assert result.primary_citation.source_url is not None
        assert result.primary_citation.source_type in [SourceType.WEBSEARCH, SourceType.COMPANY_WEBSITE]

    @pytest.mark.asyncio
    async def test_execute_unknown_domain_still_succeeds(
        self,
        m01_module: M01CompanyContext,
        unknown_domain: str,
    ):
        """Test unknown domain returns success with inferred data."""
        result = await m01_module.execute(unknown_domain)

        # Should succeed but with limited data
        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == unknown_domain
        assert result.data["is_public"] is False  # Assumed private

    @pytest.mark.asyncio
    async def test_domain_normalization(self, m01_module: M01CompanyContext):
        """Test domain normalization handles various formats."""
        test_cases = [
            ("https://www.costco.com", "costco.com"),
            ("http://costco.com/", "costco.com"),
            ("WWW.COSTCO.COM", "costco.com"),
            ("costco.com", "costco.com"),
        ]

        for input_domain, expected in test_cases:
            result = await m01_module.execute(input_domain)
            assert result.domain == expected, f"Failed for input: {input_domain}"

    def test_vertical_classification(self, m01_module: M01CompanyContext):
        """Test vertical classification logic."""
        # Commerce keywords
        company_data = {"industry": "retail", "description": "e-commerce store"}
        vertical = m01_module._classify_vertical(company_data)
        assert vertical == "Commerce"

        # Content keywords
        company_data = {"industry": "media", "description": "publishing company"}
        vertical = m01_module._classify_vertical(company_data)
        assert vertical == "Content"

    def test_data_quality_scoring(self, m01_module: M01CompanyContext):
        """Test data quality calculation."""
        # Full data
        full_data = {
            "company_name": "Test Company",
            "headquarters": {"city": "San Francisco", "country": "USA"},
            "industry": "Technology",
            "description": "A technology company that does things.",
            "employee_count": 1000,
            "is_public": True,
            "ticker": "TEST",
            "brands": ["Brand A", "Brand B"],
            "founded_year": 2010,
        }
        quality = m01_module._calculate_data_quality(full_data)
        assert quality >= 0.8, "Full data should have high quality score"

        # Minimal data
        minimal_data = {"company_name": "Test"}
        quality = m01_module._calculate_data_quality(minimal_data)
        assert quality < 0.5, "Minimal data should have low quality score"


# =============================================================================
# M02 Technology Stack Tests
# =============================================================================

class TestM02TechnologyStack:
    """Tests for M02 Technology Stack module."""

    def test_module_attributes(self, m02_module: M02TechnologyStack):
        """Verify module has correct attributes."""
        assert m02_module.MODULE_ID == "m02_technology_stack"
        assert m02_module.MODULE_NAME == "Technology Stack"
        assert m02_module.WAVE == 1
        assert m02_module.DEPENDS_ON == []
        assert m02_module.PRIMARY_SOURCE_TYPE == SourceType.BUILTWITH

    @pytest.mark.asyncio
    async def test_execute_known_domain(
        self,
        m02_module: M02TechnologyStack,
        known_public_domain: str,
    ):
        """Test execution with known domain returns valid result."""
        result = await m02_module.execute(known_public_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == known_public_domain
        assert len(result.data["technologies"]) > 0
        assert result.data["total_technologies"] > 0

    @pytest.mark.asyncio
    async def test_search_provider_detection_competitor(
        self,
        m02_module: M02TechnologyStack,
        known_public_domain: str,
    ):
        """Test search provider detection identifies competitor."""
        result = await m02_module.execute(known_public_domain)

        search_provider = result.data["search_provider"]
        # Costco uses Elastic in mock data
        assert search_provider["current"] == "Elastic"
        assert search_provider["is_algolia"] is False
        assert search_provider["displacement_priority"] == "HIGH"

    @pytest.mark.asyncio
    async def test_partner_tech_identification(
        self,
        m02_module: M02TechnologyStack,
        known_beauty_domain: str,
    ):
        """Test partner technology identification."""
        result = await m02_module.execute(known_beauty_domain)

        # Sally Beauty uses SFCC (partner tech)
        partner_techs = result.data["partner_technologies"]
        assert "Salesforce Commerce Cloud" in partner_techs
        assert result.data["partner_tech_count"] > 0

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m02_module: M02TechnologyStack,
        known_public_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m02_module.execute(known_public_domain)

        assert result.primary_citation is not None
        assert result.primary_citation.source_type == SourceType.BUILTWITH

    def test_technology_category_grouping(self, m02_module: M02TechnologyStack):
        """Test technologies are grouped by category."""
        from pipeline.modules.m02_technology_stack import Technology

        technologies = [
            Technology(name="Shopify", category="ecommerce", confidence=0.9),
            Technology(name="CloudFlare", category="cdn", confidence=0.95),
            Technology(name="Algolia", category="search", confidence=0.9),
        ]

        groups = m02_module._group_by_category(technologies)
        assert "ecommerce" in groups
        assert "cdn" in groups
        assert "search" in groups
        assert "Shopify" in groups["ecommerce"]


# =============================================================================
# M03 Traffic Analysis Tests
# =============================================================================

class TestM03TrafficAnalysis:
    """Tests for M03 Traffic Analysis module."""

    def test_module_attributes(self, m03_module: M03TrafficAnalysis):
        """Verify module has correct attributes."""
        assert m03_module.MODULE_ID == "m03_traffic_analysis"
        assert m03_module.MODULE_NAME == "Traffic Analysis"
        assert m03_module.WAVE == 1
        assert m03_module.PRIMARY_SOURCE_TYPE == SourceType.SIMILARWEB

    @pytest.mark.asyncio
    async def test_execute_known_domain(
        self,
        m03_module: M03TrafficAnalysis,
        known_public_domain: str,
    ):
        """Test execution with known domain returns valid result."""
        result = await m03_module.execute(known_public_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.domain == known_public_domain

        # Check traffic metrics
        metrics = result.data["traffic_metrics"]
        assert metrics["monthly_visits"] is not None
        assert metrics["monthly_visits"] > 0

    @pytest.mark.asyncio
    async def test_traffic_tier_calculation_enterprise(
        self,
        m03_module: M03TrafficAnalysis,
        known_public_domain: str,
    ):
        """Test traffic tier calculation for high-traffic site."""
        result = await m03_module.execute(known_public_domain)

        # Costco has 152M monthly visits - should be 50M+ tier
        assert result.data["traffic_tier"] == "50M+"
        assert result.data["traffic_score"] == 30

    @pytest.mark.asyncio
    async def test_traffic_tier_calculation_midmarket(
        self,
        m03_module: M03TrafficAnalysis,
        known_beauty_domain: str,
    ):
        """Test traffic tier calculation for mid-market site."""
        result = await m03_module.execute(known_beauty_domain)

        # Sally Beauty has 15.2M monthly visits - should be 10M-50M tier
        assert result.data["traffic_tier"] == "10M-50M"
        assert result.data["traffic_score"] == 25

    @pytest.mark.asyncio
    async def test_traffic_sources_extraction(
        self,
        m03_module: M03TrafficAnalysis,
        known_public_domain: str,
    ):
        """Test traffic sources are properly extracted."""
        result = await m03_module.execute(known_public_domain)

        sources = result.data["traffic_sources"]
        assert sources["direct"] is not None
        assert sources["organic_search"] is not None
        # Sources should sum to approximately 1.0
        total = sum(v for v in sources.values() if v is not None)
        assert 0.95 <= total <= 1.05

    @pytest.mark.asyncio
    async def test_geography_extraction(
        self,
        m03_module: M03TrafficAnalysis,
        known_public_domain: str,
    ):
        """Test geographic data extraction."""
        result = await m03_module.execute(known_public_domain)

        geography = result.data["geography"]
        assert geography["primary_country"] == "US"
        assert len(geography["top_countries"]) > 0

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m03_module: M03TrafficAnalysis,
        known_public_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m03_module.execute(known_public_domain)

        assert result.primary_citation is not None
        assert result.primary_citation.source_type == SourceType.SIMILARWEB

    def test_traffic_trend_calculation(self, m03_module: M03TrafficAnalysis):
        """Test traffic trend direction calculation."""
        # Growing trend
        raw_data = {"yoy_change": 0.10}
        trend = m03_module._extract_traffic_trend(raw_data)
        assert trend.trend_direction == "growing"

        # Declining trend
        raw_data = {"yoy_change": -0.10}
        trend = m03_module._extract_traffic_trend(raw_data)
        assert trend.trend_direction == "declining"

        # Stable trend
        raw_data = {"yoy_change": 0.02}
        trend = m03_module._extract_traffic_trend(raw_data)
        assert trend.trend_direction == "stable"


# =============================================================================
# M04 Financial Profile Tests
# =============================================================================

class TestM04FinancialProfile:
    """Tests for M04 Financial Profile module."""

    def test_module_attributes(self, m04_module: M04FinancialProfile):
        """Verify module has correct attributes."""
        assert m04_module.MODULE_ID == "m04_financial_profile"
        assert m04_module.MODULE_NAME == "Financial Profile"
        assert m04_module.WAVE == 1
        assert m04_module.PRIMARY_SOURCE_TYPE == SourceType.YAHOO_FINANCE

    @pytest.mark.asyncio
    async def test_execute_public_company(
        self,
        m04_module: M04FinancialProfile,
        known_public_domain: str,
    ):
        """Test execution with public company returns full data."""
        result = await m04_module.execute(known_public_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data["is_public"] is True
        assert result.data["ticker"] == "COST"
        assert result.data["exchange"] == "NASDAQ"

        # Check financials
        financials = result.data["financials"]
        assert financials["latest_revenue"] is not None
        assert len(financials["revenue_3yr"]) == 3

    @pytest.mark.asyncio
    async def test_execute_private_company(
        self,
        m04_module: M04FinancialProfile,
        unknown_domain: str,
    ):
        """Test execution with private company returns limited data."""
        result = await m04_module.execute(unknown_domain)

        assert result.status == ModuleStatus.SUCCESS
        assert result.data["is_public"] is False
        assert result.data["ticker"] is None
        assert result.data["data_limitation_reason"] is not None

    @pytest.mark.asyncio
    async def test_margin_zone_classification_yellow(
        self,
        m04_module: M04FinancialProfile,
        known_beauty_domain: str,
    ):
        """Test margin zone classification for YELLOW zone."""
        result = await m04_module.execute(known_beauty_domain)

        margin_zone = result.data["margin_zone"]
        # Sally Beauty has 12.6% EBITDA margin - YELLOW zone
        assert margin_zone["classification"] == "YELLOW"
        assert "efficiency" in margin_zone["implication"].lower()

    @pytest.mark.asyncio
    async def test_margin_zone_classification_red(
        self,
        m04_module: M04FinancialProfile,
        known_public_domain: str,
    ):
        """Test margin zone classification for RED zone."""
        result = await m04_module.execute(known_public_domain)

        margin_zone = result.data["margin_zone"]
        # Costco has 4.5% EBITDA margin - RED zone
        assert margin_zone["classification"] == "RED"
        assert "ROI" in margin_zone["implication"]

    @pytest.mark.asyncio
    async def test_roi_scenarios_calculation(
        self,
        m04_module: M04FinancialProfile,
        known_beauty_domain: str,
    ):
        """Test ROI scenarios are calculated."""
        result = await m04_module.execute(known_beauty_domain)

        roi = result.data["roi_scenarios"]
        assert roi["conservative"] is not None
        assert roi["moderate"] is not None
        assert roi["aggressive"] is not None

        # Verify lift percentages
        assert roi["conservative"]["lift_pct"] == 0.05
        assert roi["moderate"]["lift_pct"] == 0.10
        assert roi["aggressive"]["lift_pct"] == 0.15

    @pytest.mark.asyncio
    async def test_ecommerce_metrics_calculation(
        self,
        m04_module: M04FinancialProfile,
        known_beauty_domain: str,
    ):
        """Test e-commerce metrics are calculated."""
        result = await m04_module.execute(known_beauty_domain)

        ecommerce = result.data["ecommerce"]
        assert ecommerce["ecommerce_revenue"] is not None
        assert ecommerce["addressable_search_revenue"] is not None
        # Addressable should be 15% of e-commerce
        expected_addressable = int(ecommerce["ecommerce_revenue"] * 0.15)
        assert ecommerce["addressable_search_revenue"] == expected_addressable

    @pytest.mark.asyncio
    async def test_stock_info_extraction(
        self,
        m04_module: M04FinancialProfile,
        known_public_domain: str,
    ):
        """Test stock info is extracted for public companies."""
        result = await m04_module.execute(known_public_domain)

        stock = result.data["stock_info"]
        assert stock["current_price"] is not None
        assert stock["market_cap"] is not None
        assert stock["fifty_two_week_high"] is not None

    @pytest.mark.asyncio
    async def test_has_source_citation(
        self,
        m04_module: M04FinancialProfile,
        known_public_domain: str,
    ):
        """P0 REQUIREMENT: Verify result has source citation."""
        result = await m04_module.execute(known_public_domain)

        assert result.primary_citation is not None
        assert result.primary_citation.source_type == SourceType.YAHOO_FINANCE

    def test_revenue_trend_calculation(self, m04_module: M04FinancialProfile):
        """Test revenue trend determination."""
        # Growing trend
        raw_data = {
            "revenue_3yr": [
                {"fiscal_year": "FY2022", "revenue": 100, "yoy_change": None},
                {"fiscal_year": "FY2023", "revenue": 110, "yoy_change": 0.10},
                {"fiscal_year": "FY2024", "revenue": 120, "yoy_change": 0.09},
            ]
        }
        financials = m04_module._extract_financials(raw_data)
        assert financials.revenue_trend == "growing"

        # Declining trend
        raw_data = {
            "revenue_3yr": [
                {"fiscal_year": "FY2022", "revenue": 100, "yoy_change": None},
                {"fiscal_year": "FY2023", "revenue": 90, "yoy_change": -0.10},
                {"fiscal_year": "FY2024", "revenue": 80, "yoy_change": -0.11},
            ]
        }
        financials = m04_module._extract_financials(raw_data)
        assert financials.revenue_trend == "declining"


# =============================================================================
# Source Citation Compliance Tests (P0 Requirement)
# =============================================================================

class TestSourceCitationCompliance:
    """
    P0 REQUIREMENT: Every module output MUST have source citations.
    These tests verify the source citation mandate is enforced.
    """

    @pytest.mark.asyncio
    async def test_m01_citation_present(self, m01_module: M01CompanyContext):
        """M01 must have source citation."""
        result = await m01_module.execute("costco.com")
        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_m02_citation_present(self, m02_module: M02TechnologyStack):
        """M02 must have source citation."""
        result = await m02_module.execute("costco.com")
        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_m03_citation_present(self, m03_module: M03TrafficAnalysis):
        """M03 must have source citation."""
        result = await m03_module.execute("costco.com")
        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_m04_citation_present(self, m04_module: M04FinancialProfile):
        """M04 must have source citation."""
        result = await m04_module.execute("costco.com")
        assert result.primary_citation is not None
        assert str(result.primary_citation.source_url).startswith("http")

    @pytest.mark.asyncio
    async def test_citation_freshness_is_valid(self, m01_module: M01CompanyContext):
        """Citation should not be expired."""
        result = await m01_module.execute("costco.com")
        assert result.primary_citation.freshness_status != FreshnessStatus.EXPIRED

    @pytest.mark.asyncio
    async def test_result_to_db_dict_includes_source(self, m01_module: M01CompanyContext):
        """to_db_dict() should include source information."""
        result = await m01_module.execute("costco.com")
        db_dict = result.to_db_dict()

        assert "primary_source_url" in db_dict
        assert "primary_source_type" in db_dict
        assert "primary_source_at" in db_dict


# =============================================================================
# Parallel Execution Tests
# =============================================================================

class TestParallelExecution:
    """
    Test that Wave 1 modules can run in parallel.
    No inter-dependencies should exist between Wave 1 modules.
    """

    def test_wave1_modules_have_no_dependencies(
        self,
        m01_module: M01CompanyContext,
        m02_module: M02TechnologyStack,
        m03_module: M03TrafficAnalysis,
        m04_module: M04FinancialProfile,
    ):
        """All Wave 1 modules should have empty DEPENDS_ON."""
        assert m01_module.DEPENDS_ON == []
        assert m02_module.DEPENDS_ON == []
        assert m03_module.DEPENDS_ON == []
        assert m04_module.DEPENDS_ON == []

    @pytest.mark.asyncio
    async def test_parallel_execution_all_succeed(
        self,
        m01_module: M01CompanyContext,
        m02_module: M02TechnologyStack,
        m03_module: M03TrafficAnalysis,
        m04_module: M04FinancialProfile,
        known_public_domain: str,
    ):
        """All 4 modules can execute in parallel successfully."""
        import asyncio

        # Run all modules concurrently
        results = await asyncio.gather(
            m01_module.execute(known_public_domain),
            m02_module.execute(known_public_domain),
            m03_module.execute(known_public_domain),
            m04_module.execute(known_public_domain),
        )

        # All should succeed
        assert all(r.status == ModuleStatus.SUCCESS for r in results)

        # Verify each module returned correct data
        assert results[0].module_id == "m01_company_context"
        assert results[1].module_id == "m02_technology_stack"
        assert results[2].module_id == "m03_traffic_analysis"
        assert results[3].module_id == "m04_financial_profile"


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Test graceful error handling in modules."""

    @pytest.mark.asyncio
    async def test_m01_handles_empty_domain(self, m01_module: M01CompanyContext):
        """Module should handle empty domain gracefully."""
        result = await m01_module.execute("")
        # Should succeed with normalized empty domain
        assert result is not None

    @pytest.mark.asyncio
    async def test_m02_handles_unknown_domain(self, m02_module: M02TechnologyStack):
        """Module should handle unknown domain gracefully."""
        result = await m02_module.execute("this-domain-does-not-exist-12345.com")
        assert result.status == ModuleStatus.SUCCESS
        # Should return empty but valid data
        assert result.data["total_technologies"] == 0

    @pytest.mark.asyncio
    async def test_m04_handles_private_company(self, m04_module: M04FinancialProfile):
        """Module should handle private company gracefully."""
        result = await m04_module.execute("private-company-no-data.com")
        assert result.status == ModuleStatus.SUCCESS
        assert result.data["is_public"] is False
        assert result.data["data_limitation_reason"] is not None


# =============================================================================
# Metrics Tests
# =============================================================================

class TestModuleMetrics:
    """Test module metrics collection."""

    @pytest.mark.asyncio
    async def test_metrics_track_successful_execution(self, m01_module: M01CompanyContext):
        """Metrics should track successful executions."""
        initial_count = m01_module.metrics.execution_count

        await m01_module.execute("costco.com")

        assert m01_module.metrics.execution_count == initial_count + 1
        assert m01_module.metrics.success_count >= 1
        assert m01_module.metrics.total_duration_ms > 0

    def test_get_metrics_returns_dict(self, m01_module: M01CompanyContext):
        """get_metrics() should return metrics dict."""
        metrics = m01_module.get_metrics()

        assert "module_id" in metrics
        assert "execution_count" in metrics
        assert "success_rate" in metrics
        assert "average_duration_ms" in metrics


# =============================================================================
# Output Schema Validation Tests
# =============================================================================

class TestOutputSchemas:
    """Test that module outputs match expected schemas."""

    @pytest.mark.asyncio
    async def test_m01_output_schema(self, m01_module: M01CompanyContext):
        """M01 output should match CompanyContextData schema."""
        result = await m01_module.execute("costco.com")

        # Should be able to create data model from output
        data = CompanyContextData(**result.data)
        assert data.domain == "costco.com"
        assert data.company_name is not None

    @pytest.mark.asyncio
    async def test_m02_output_schema(self, m02_module: M02TechnologyStack):
        """M02 output should match TechnologyStackData schema."""
        result = await m02_module.execute("costco.com")

        data = TechnologyStackData(**result.data)
        assert data.domain == "costco.com"
        assert isinstance(data.technologies, list)

    @pytest.mark.asyncio
    async def test_m03_output_schema(self, m03_module: M03TrafficAnalysis):
        """M03 output should match TrafficAnalysisData schema."""
        result = await m03_module.execute("costco.com")

        data = TrafficAnalysisData(**result.data)
        assert data.domain == "costco.com"
        assert data.traffic_metrics is not None

    @pytest.mark.asyncio
    async def test_m04_output_schema(self, m04_module: M04FinancialProfile):
        """M04 output should match FinancialProfileData schema."""
        result = await m04_module.execute("costco.com")

        data = FinancialProfileData(**result.data)
        assert data.domain == "costco.com"
        assert data.is_public is True
