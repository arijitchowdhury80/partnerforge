"""
PartnerForge Models Package

Exports all SQLAlchemy models for the platform.

Tables by category:
- Core: companies, technologies, company_technologies, customer_logos
- Targets: displacement_targets, competitive_intel
- Evidence: case_studies, customer_quotes, proof_points, verified_case_studies
- Enrichment: company_financials, executive_quotes, hiring_signals, strategic_triggers, buying_committee, enrichment_status
- Intelligence (15 modules): intel_* tables
- Versioning: intel_snapshots, change_events, snapshot_comparisons
- Alerts: alert_rules, alerts, alert_digests, alert_preferences
- Platform: users, teams, territories, account_assignments, api_usage, api_budgets, audit_log
"""

# Core models
from .core import (
    Company,
    Technology,
    CompanyTechnology,
    CustomerLogo,
)

# Target models
from .targets import (
    DisplacementTarget,
    CompetitiveIntel,
)

# Evidence models
from .evidence import (
    CaseStudy,
    CustomerQuote,
    ProofPoint,
    VerifiedCaseStudy,
)

# Enrichment models
from .enrichment import (
    CompanyFinancials,
    ExecutiveQuote,
    HiringSignal,
    StrategicTrigger,
    BuyingCommittee,
    EnrichmentStatus,
)

# Intelligence module models (15 modules)
from .intelligence import (
    # Wave 1: Foundation
    IntelCompanyContext,
    IntelTechnologyStack,
    IntelTrafficAnalysis,
    IntelFinancialProfile,
    # Wave 2: Competitive
    IntelCompetitorIntelligence,
    IntelHiringSignals,
    IntelStrategicContext,
    # Wave 3: Buying Signals
    IntelInvestorIntelligence,
    IntelExecutiveIntelligence,
    IntelBuyingCommittee,
    IntelDisplacementAnalysis,
    # Wave 4: Synthesis
    IntelCaseStudyMatches,
    IntelICPPriorityMapping,
    IntelSignalScoring,
    IntelStrategicSignalBrief,
)

# Versioning models
from .versioning import (
    IntelSnapshot,
    ChangeEvent,
    SnapshotComparison,
)

# Alert models
from .alerts import (
    AlertRule,
    Alert,
    AlertDigest,
    AlertPreference,
)

# Platform models
from .platform import (
    UserRole,
    AccountRole,
    User,
    Team,
    Territory,
    AccountAssignment,
    APIUsage,
    APIBudget,
    APICostConfig,
    AuditLog,
    SystemMetric,
    JobExecution,
)

# All models for easy access
__all__ = [
    # Core
    "Company",
    "Technology",
    "CompanyTechnology",
    "CustomerLogo",
    # Targets
    "DisplacementTarget",
    "CompetitiveIntel",
    # Evidence
    "CaseStudy",
    "CustomerQuote",
    "ProofPoint",
    "VerifiedCaseStudy",
    # Enrichment
    "CompanyFinancials",
    "ExecutiveQuote",
    "HiringSignal",
    "StrategicTrigger",
    "BuyingCommittee",
    "EnrichmentStatus",
    # Intelligence - Wave 1
    "IntelCompanyContext",
    "IntelTechnologyStack",
    "IntelTrafficAnalysis",
    "IntelFinancialProfile",
    # Intelligence - Wave 2
    "IntelCompetitorIntelligence",
    "IntelHiringSignals",
    "IntelStrategicContext",
    # Intelligence - Wave 3
    "IntelInvestorIntelligence",
    "IntelExecutiveIntelligence",
    "IntelBuyingCommittee",
    "IntelDisplacementAnalysis",
    # Intelligence - Wave 4
    "IntelCaseStudyMatches",
    "IntelICPPriorityMapping",
    "IntelSignalScoring",
    "IntelStrategicSignalBrief",
    # Versioning
    "IntelSnapshot",
    "ChangeEvent",
    "SnapshotComparison",
    # Alerts
    "AlertRule",
    "Alert",
    "AlertDigest",
    "AlertPreference",
    # Platform
    "UserRole",
    "AccountRole",
    "User",
    "Team",
    "Territory",
    "AccountAssignment",
    "APIUsage",
    "APIBudget",
    "APICostConfig",
    "AuditLog",
    "SystemMetric",
    "JobExecution",
]

# Model registry by category
CORE_MODELS = [Company, Technology, CompanyTechnology, CustomerLogo]
TARGET_MODELS = [DisplacementTarget, CompetitiveIntel]
EVIDENCE_MODELS = [CaseStudy, CustomerQuote, ProofPoint, VerifiedCaseStudy]
ENRICHMENT_MODELS = [CompanyFinancials, ExecutiveQuote, HiringSignal, StrategicTrigger, BuyingCommittee, EnrichmentStatus]

INTEL_WAVE_1 = [IntelCompanyContext, IntelTechnologyStack, IntelTrafficAnalysis, IntelFinancialProfile]
INTEL_WAVE_2 = [IntelCompetitorIntelligence, IntelHiringSignals, IntelStrategicContext]
INTEL_WAVE_3 = [IntelInvestorIntelligence, IntelExecutiveIntelligence, IntelBuyingCommittee, IntelDisplacementAnalysis]
INTEL_WAVE_4 = [IntelCaseStudyMatches, IntelICPPriorityMapping, IntelSignalScoring, IntelStrategicSignalBrief]

INTELLIGENCE_MODELS = INTEL_WAVE_1 + INTEL_WAVE_2 + INTEL_WAVE_3 + INTEL_WAVE_4

# Versioning & Alerts
VERSIONING_MODELS = [IntelSnapshot, ChangeEvent, SnapshotComparison]
ALERT_MODELS = [AlertRule, Alert, AlertDigest, AlertPreference]

# Platform
PLATFORM_MODELS = [User, Team, Territory, AccountAssignment, APIUsage, APIBudget, APICostConfig, AuditLog, SystemMetric, JobExecution]

ALL_MODELS = (
    CORE_MODELS +
    TARGET_MODELS +
    EVIDENCE_MODELS +
    ENRICHMENT_MODELS +
    INTELLIGENCE_MODELS +
    VERSIONING_MODELS +
    ALERT_MODELS +
    PLATFORM_MODELS
)


def get_model_by_table_name(table_name: str):
    """Get model class by table name."""
    for model in ALL_MODELS:
        if model.__tablename__ == table_name:
            return model
    return None


def get_intel_model_by_module_id(module_id: str):
    """
    Get intelligence model class by module ID.

    Example: get_intel_model_by_module_id("m01_company_context") -> IntelCompanyContext
    """
    mapping = {
        "m01_company_context": IntelCompanyContext,
        "m02_tech_stack": IntelTechnologyStack,
        "m03_traffic": IntelTrafficAnalysis,
        "m04_financials": IntelFinancialProfile,
        "m05_competitors": IntelCompetitorIntelligence,
        "m06_hiring": IntelHiringSignals,
        "m07_strategic": IntelStrategicContext,
        "m08_investor": IntelInvestorIntelligence,
        "m09_executive": IntelExecutiveIntelligence,
        "m10_buying_committee": IntelBuyingCommittee,
        "m11_displacement": IntelDisplacementAnalysis,
        "m12_case_study": IntelCaseStudyMatches,
        "m13_icp_priority": IntelICPPriorityMapping,
        "m14_signal_scoring": IntelSignalScoring,
        "m15_strategic_brief": IntelStrategicSignalBrief,
    }
    return mapping.get(module_id)
