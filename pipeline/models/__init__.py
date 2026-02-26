"""
Data Models
===========

Pydantic models with mandatory source citation enforcement.

Core Models:
- SourceCitation: Mandatory source metadata
- SourcedDataPoint: Base class for all data points

Intelligence Models (M01-M15):
- CompanyContext (M01)
- TechnologyStack (M02)
- TrafficAnalysis (M03)
- FinancialProfile (M04)
- CompetitorIntelligence (M05)
- HiringSignals (M06)
- StrategicContext (M07)
- InvestorIntelligence (M08)
- ExecutiveIntelligence (M09)
- BuyingCommittee (M10)
- DisplacementAnalysis (M11)
- CaseStudyMatches (M12)
- ICPPriorityMapping (M13)
- SignalScoring (M14)
- StrategicSignalBrief (M15)
"""

from pipeline.models.source import (
    SourceCitation,
    SourcedDataPoint,
    SourceType,
    FreshnessStatus,
)

# Optional imports for modules that may not exist yet
try:
    from pipeline.models.company import CompanyContext
except ImportError:
    CompanyContext = None

try:
    from pipeline.models.technology import TechnologyStack, SearchProviderDetection
except ImportError:
    TechnologyStack = None
    SearchProviderDetection = None

try:
    from pipeline.models.traffic import TrafficAnalysis, RevenueImpact
except ImportError:
    TrafficAnalysis = None
    RevenueImpact = None

try:
    from pipeline.models.financial import FinancialProfile, MarginZone
except ImportError:
    FinancialProfile = None
    MarginZone = None

__all__ = [
    "SourceCitation",
    "SourcedDataPoint",
    "SourceType",
    "FreshnessStatus",
]

# Add optional exports if they exist
if CompanyContext is not None:
    __all__.append("CompanyContext")
if TechnologyStack is not None:
    __all__.extend(["TechnologyStack", "SearchProviderDetection"])
if TrafficAnalysis is not None:
    __all__.extend(["TrafficAnalysis", "RevenueImpact"])
if FinancialProfile is not None:
    __all__.extend(["FinancialProfile", "MarginZone"])
