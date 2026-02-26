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
from pipeline.models.company import CompanyContext
from pipeline.models.technology import TechnologyStack, SearchProviderDetection
from pipeline.models.traffic import TrafficAnalysis, RevenueImpact
from pipeline.models.financial import FinancialProfile, MarginZone

__all__ = [
    "SourceCitation",
    "SourcedDataPoint",
    "SourceType",
    "FreshnessStatus",
    "CompanyContext",
    "TechnologyStack",
    "SearchProviderDetection",
    "TrafficAnalysis",
    "RevenueImpact",
    "FinancialProfile",
    "MarginZone",
]
