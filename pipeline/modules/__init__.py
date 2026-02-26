"""
Intelligence Modules
====================

15 intelligence modules organized in 4 waves:

Wave 1 - Foundation (Parallel):
- M01: Company Context
- M02: Technology Stack
- M03: Traffic Analysis
- M04: Financial Profile

Wave 2 - Deep Intel (Parallel):
- M05: Competitor Intelligence
- M06: Hiring Signals
- M07: Strategic Context

Wave 3 - Analysis (Mixed):
- M08: Investor Intelligence
- M09: Executive Intelligence
- M10: Buying Committee
- M11: Displacement Analysis

Wave 4 - Synthesis (Parallel):
- M12: Case Study Matching
- M13: ICP Priority Mapping
- M14: Signal Scoring
- M15: Strategic Signal Brief
"""

from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    ModuleError,
    ModuleMetrics,
    DependencyNotMetError,
    SourceCitationMissingError,
    DataNotFoundError,
    register_module,
    get_module_class,
    get_all_modules,
    get_modules_by_wave,
    get_wave_order,
    instantiate_module,
)

# Wave 1 Modules
from pipeline.modules.m01_company_context import (
    M01CompanyContext,
    CompanyContextData,
    Headquarters,
)
from pipeline.modules.m02_technology_stack import (
    M02TechnologyStack,
    TechnologyStackData,
    Technology,
    SearchProviderInfo,
)
from pipeline.modules.m03_traffic_analysis import (
    M03TrafficAnalysis,
    TrafficAnalysisData,
    TrafficMetrics,
    TrafficTrend,
    TrafficSources,
    GeographyData,
    DemographicsData,
    KeywordsData,
    RankData,
)
from pipeline.modules.m04_financial_profile import (
    M04FinancialProfile,
    FinancialProfileData,
    FinancialsData,
    MarginZone,
    EcommerceData,
    StockInfo,
    ROIScenarios,
)

__all__ = [
    # Base classes and utilities
    "BaseModule",
    "ModuleResult",
    "ModuleStatus",
    "ModuleError",
    "ModuleMetrics",
    "DependencyNotMetError",
    "SourceCitationMissingError",
    "DataNotFoundError",
    "register_module",
    "get_module_class",
    "get_all_modules",
    "get_modules_by_wave",
    "get_wave_order",
    "instantiate_module",
    # Wave 1 - M01 Company Context
    "M01CompanyContext",
    "CompanyContextData",
    "Headquarters",
    # Wave 1 - M02 Technology Stack
    "M02TechnologyStack",
    "TechnologyStackData",
    "Technology",
    "SearchProviderInfo",
    # Wave 1 - M03 Traffic Analysis
    "M03TrafficAnalysis",
    "TrafficAnalysisData",
    "TrafficMetrics",
    "TrafficTrend",
    "TrafficSources",
    "GeographyData",
    "DemographicsData",
    "KeywordsData",
    "RankData",
    # Wave 1 - M04 Financial Profile
    "M04FinancialProfile",
    "FinancialProfileData",
    "FinancialsData",
    "MarginZone",
    "EcommerceData",
    "StockInfo",
    "ROIScenarios",
]
