"""
PartnerForge Intelligence Modules Package

This package contains all 15 intelligence modules organized by wave:

Wave 1 (Foundation):
- M01: Company Context
- M02: Technology Stack
- M03: Traffic Analysis
- M04: Financial Profile

Wave 2 (Competitive):
- M05: Competitor Intelligence
- M06: Hiring Signals
- M07: Strategic Context

Wave 3 (Buying Signals):
- M08: Investor Intelligence
- M09: Executive Intelligence
- M10: Buying Committee
- M11: Displacement Analysis

Wave 4 (Synthesis):
- M12: Case Study Matching
- M13: ICP-Priority Mapping
- M14: Signal Scoring
- M15: Strategic Signal Brief

Usage:
    from app.modules import M01CompanyContextModule
    from app.modules import get_module_class, get_all_modules, get_modules_by_wave

    # Instantiate a module
    module = M01CompanyContextModule()
    result = await module.enrich("sallybeauty.com")

    # Get module by ID
    ModuleClass = get_module_class("m01_company_context")
    module = ModuleClass()

    # Get all modules in a wave
    wave_1_modules = get_modules_by_wave(1)
"""

# Base module and registry
from .base import (
    BaseIntelligenceModule,
    ModuleResult,
    SourceInfo,
    register_module,
    get_module_class,
    get_all_modules,
    get_modules_by_wave,
    get_wave_order,
)

# Wave 1: Foundation Modules
from .m01_company_context import M01CompanyContextModule, CompanyContextData
from .m02_tech_stack import (
    M02TechStackModule,
    TechStackData,
    TechnologyItem,
    SearchProviderInfo as TechStackSearchProviderInfo,
)
from .m03_traffic import (
    M03TrafficModule,
    TrafficAnalysisData,
    TrafficMetrics,
    TrafficTrend,
    TrafficSources,
    Geography,
    CountryShare,
    Demographics,
    Keywords,
    WebsiteRank,
    SearchRevenueEstimate,
)

# Wave 2: Competitive Modules
from .m05_competitors import (
    M05CompetitorIntelligenceModule,
    CompetitorIntelligenceData,
    CompetitorSite,
    SearchProviderInfo,
)
from .m06_hiring import (
    M06HiringSignalsModule,
    HiringSignalsData,
    JobPosting,
    SEARCH_KEYWORDS,
    ENGINEERING_KEYWORDS,
    PRODUCT_KEYWORDS,
)

# Wave 3: Buying Signals Modules (TODO)
# from .m08_investor import M08InvestorModule

# Wave 4: Synthesis Modules (TODO)
# from .m15_strategic_brief import M15StrategicBriefModule


__all__ = [
    # Base classes
    "BaseIntelligenceModule",
    "ModuleResult",
    "SourceInfo",
    # Registry functions
    "register_module",
    "get_module_class",
    "get_all_modules",
    "get_modules_by_wave",
    "get_wave_order",
    # Wave 1 Modules
    "M01CompanyContextModule",
    "CompanyContextData",
    "M02TechStackModule",
    "TechStackData",
    "TechnologyItem",
    "TechStackSearchProviderInfo",
    "M03TrafficModule",
    "TrafficAnalysisData",
    "TrafficMetrics",
    "TrafficTrend",
    "TrafficSources",
    "Geography",
    "CountryShare",
    "Demographics",
    "Keywords",
    "WebsiteRank",
    "SearchRevenueEstimate",
    # Wave 2 Modules
    "M05CompetitorIntelligenceModule",
    "CompetitorIntelligenceData",
    "CompetitorSite",
    "SearchProviderInfo",
    "M06HiringSignalsModule",
    "HiringSignalsData",
    "JobPosting",
    "SEARCH_KEYWORDS",
    "ENGINEERING_KEYWORDS",
    "PRODUCT_KEYWORDS",
]
