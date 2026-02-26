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

# Wave 2: Competitive Modules (TODO)
# from .m05_competitors import M05CompetitorModule

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
]
