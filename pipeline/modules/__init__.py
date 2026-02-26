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

# Wave 2 Modules
from pipeline.modules.m05_competitor_intelligence import (
    M05CompetitorIntelligence,
    CompetitorIntelligenceData,
    Competitor,
    SearchLandscape,
)
from pipeline.modules.m06_hiring_signals import (
    M06HiringSignals,
    HiringSignalsData,
    HiringSignals,
    HiringRole,
)
from pipeline.modules.m07_strategic_context import (
    M07StrategicContext,
    StrategicContextData,
    StrategicInitiative,
    TriggerEvent,
    CautionSignal,
    TimingAssessment,
)

# Wave 3 Modules
from pipeline.modules.m08_investor_intelligence import (
    M08InvestorIntelligence,
    InvestorIntelligenceData,
    SECFilingData,
    SECFilingRisk,
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
    TechnicalEvaluator,
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

# Wave 4 Modules
from pipeline.modules.m12_case_study_matching import (
    M12CaseStudyMatching,
    CaseStudyMatchingData,
    MatchedCaseStudy,
    CaseStudyResult,
    UseCaseCoverage,
)
from pipeline.modules.m13_icp_priority_mapping import (
    M13ICPPriorityMapping,
    ICPPriorityMappingData,
    ICPClassification,
    LeadScore,
    ScoreBreakdown,
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
    # Wave 2 - M05 Competitor Intelligence
    "M05CompetitorIntelligence",
    "CompetitorIntelligenceData",
    "Competitor",
    "SearchLandscape",
    # Wave 2 - M06 Hiring Signals
    "M06HiringSignals",
    "HiringSignalsData",
    "HiringSignals",
    "HiringRole",
    # Wave 2 - M07 Strategic Context
    "M07StrategicContext",
    "StrategicContextData",
    "StrategicInitiative",
    "TriggerEvent",
    "CautionSignal",
    "TimingAssessment",
    # Wave 3 - M08 Investor Intelligence
    "M08InvestorIntelligence",
    "InvestorIntelligenceData",
    "SECFilingData",
    "SECFilingRisk",
    "EarningsCallData",
    "EarningsCallQuote",
    "GuidanceData",
    "DigitalCommitment",
    # Wave 3 - M09 Executive Intelligence
    "M09ExecutiveIntelligence",
    "ExecutiveIntelligenceData",
    "ExecutiveProfile",
    "BuyingCommitteeSummary",
    "SpeakingLanguage",
    "QuoteToProductMapping",
    # Wave 3 - M10 Buying Committee
    "M10BuyingCommittee",
    "BuyingCommitteeData",
    "CommitteeMember",
    "TechnicalEvaluator",
    "CommitteeDynamics",
    "EngagementStep",
    # Wave 3 - M11 Displacement Analysis
    "M11DisplacementAnalysis",
    "DisplacementAnalysisData",
    "DisplacementOpportunity",
    "PartnerCoSellOpportunity",
    "CompetitiveDisplacement",
    "AlgoliaFitScore",
    # Wave 4 - M12 Case Study Matching
    "M12CaseStudyMatching",
    "CaseStudyMatchingData",
    "MatchedCaseStudy",
    "CaseStudyResult",
    "UseCaseCoverage",
    # Wave 4 - M13 ICP-Priority Mapping
    "M13ICPPriorityMapping",
    "ICPPriorityMappingData",
    "ICPClassification",
    "LeadScore",
    "ScoreBreakdown",
    "PriorityClassification",
    "ProductMapping",
    # Wave 4 - M14 Signal Scoring
    "M14SignalScoring",
    "SignalScoringData",
    "SignalCategory",
    "SignalInstance",
    "CompositeScore",
    "SignalQuality",
    # Wave 4 - M15 Strategic Signal Brief
    "M15StrategicBrief",
    "StrategicSignalBriefData",
    "TimingSignal",
    "ExecutiveQuote",
    "KeyPerson",
    "MoneyMetrics",
    "GapFinding",
    "CompetitiveLandscape",
]
