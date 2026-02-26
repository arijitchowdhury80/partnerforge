"""
PartnerForge API Schemas

Pydantic models for API request/response validation.
"""

from .lists import (
    # Upload schemas
    ListUploadResponse,
    ListColumnMapping,
    ListColumnMappingConfirm,

    # List schemas
    ListCreate,
    ListResponse,
    ListSummaryResponse,
    ListDetailResponse,
    ListPaginatedResponse,

    # Item schemas
    ListItemResponse,
    ListItemSummary,

    # Processing schemas
    ListValidationRequest,
    ListValidationResponse,
    ListEnrichmentRequest,
    ListEnrichmentResponse,
    ListProcessingStatus,

    # Pagination
    PaginationMeta,
)

from .targets import (
    # Enums
    TargetStatus,
    SortField,
    SortOrder,
    EnrichmentLevel,

    # Response schemas
    TargetSummary,
    TargetResponse,
    TargetListResponse,

    # Search schemas
    TargetSearchRequest,
    TargetSearchResponse,

    # Status update schemas
    TargetStatusUpdate,
    TargetStatusUpdateResponse,

    # Stats schemas
    TargetStats,
    StatusBreakdown,
    VerticalBreakdown,
    PartnerTechBreakdown,
)

from .enrich import (
    # Enums
    EnrichmentStatus,
    EnrichmentPriority,
    WaveStatus,

    # Request schemas
    EnrichRequest,
    BatchEnrichRequest,
    EnrichRetryRequest,

    # Response schemas
    EnrichResponse,
    BatchEnrichResponse,
    EnrichStatusResponse,
    EnrichmentResultsResponse,
    EnrichCancelResponse,
    EnrichJobSummary,
    EnrichJobListResponse,

    # Module schemas
    ModuleResult,
    WaveResult,
    ModuleStatusDetail,

    # Cache schemas
    ModuleCacheStatus,
    DomainCacheStatus,

    # Constants
    VALID_MODULES,
    WAVE_MODULES,
)

from .intelligence import (
    # Enums
    ModuleFreshness,
    ModuleWave,

    # Source citation
    SourceCitation,

    # Overview
    ModuleStatus,
    IntelligenceOverview,

    # Wave 1 responses
    CompanyContextResponse,
    TechStackResponse,
    TrafficAnalysisResponse,
    FinancialProfileResponse,

    # Wave 2 responses
    CompetitorIntelligenceResponse,
    HiringSignalsResponse,
    StrategicContextResponse,

    # Wave 3 responses
    InvestorIntelligenceResponse,
    ExecutiveIntelligenceResponse,
    BuyingCommitteeResponse,
    DisplacementAnalysisResponse,

    # Wave 4 responses
    CaseStudyMatchesResponse,
    ICPPriorityResponse,
    SignalScoringResponse,
    StrategicBriefResponse,

    # Full intelligence
    FullIntelligenceResponse,
)

from .jobs import (
    # Enums
    JobStatus,
    JobType,
    LogLevel,

    # Progress schemas
    JobModuleProgress,
    JobWaveProgress,

    # Response schemas
    JobResponse,
    JobProgressResponse,
    JobListResponse,
    JobCancelResponse,
    JobLogsResponse,
    JobStatsResponse,

    # Log entry
    JobLogEntry,
)

__all__ = [
    # Upload
    "ListUploadResponse",
    "ListColumnMapping",
    "ListColumnMappingConfirm",

    # Lists
    "ListCreate",
    "ListResponse",
    "ListSummaryResponse",
    "ListDetailResponse",
    "ListPaginatedResponse",

    # Items
    "ListItemResponse",
    "ListItemSummary",

    # Processing
    "ListValidationRequest",
    "ListValidationResponse",
    "ListEnrichmentRequest",
    "ListEnrichmentResponse",
    "ListProcessingStatus",

    # Pagination
    "PaginationMeta",

    # Target Enums
    "TargetStatus",
    "SortField",
    "SortOrder",
    "EnrichmentLevel",

    # Target Response
    "TargetSummary",
    "TargetResponse",
    "TargetListResponse",

    # Target Search
    "TargetSearchRequest",
    "TargetSearchResponse",

    # Target Status
    "TargetStatusUpdate",
    "TargetStatusUpdateResponse",

    # Target Stats
    "TargetStats",
    "StatusBreakdown",
    "VerticalBreakdown",
    "PartnerTechBreakdown",

    # Enrichment Enums
    "EnrichmentStatus",
    "EnrichmentPriority",
    "WaveStatus",

    # Enrichment Request
    "EnrichRequest",
    "BatchEnrichRequest",
    "EnrichRetryRequest",

    # Enrichment Response
    "EnrichResponse",
    "BatchEnrichResponse",
    "EnrichStatusResponse",
    "EnrichmentResultsResponse",
    "EnrichCancelResponse",
    "EnrichJobSummary",
    "EnrichJobListResponse",

    # Enrichment Module
    "ModuleResult",
    "WaveResult",
    "ModuleStatusDetail",

    # Enrichment Cache
    "ModuleCacheStatus",
    "DomainCacheStatus",

    # Enrichment Constants
    "VALID_MODULES",
    "WAVE_MODULES",

    # Intelligence Enums
    "ModuleFreshness",
    "ModuleWave",

    # Intelligence Source Citation
    "SourceCitation",

    # Intelligence Overview
    "ModuleStatus",
    "IntelligenceOverview",

    # Intelligence Wave 1
    "CompanyContextResponse",
    "TechStackResponse",
    "TrafficAnalysisResponse",
    "FinancialProfileResponse",

    # Intelligence Wave 2
    "CompetitorIntelligenceResponse",
    "HiringSignalsResponse",
    "StrategicContextResponse",

    # Intelligence Wave 3
    "InvestorIntelligenceResponse",
    "ExecutiveIntelligenceResponse",
    "BuyingCommitteeResponse",
    "DisplacementAnalysisResponse",

    # Intelligence Wave 4
    "CaseStudyMatchesResponse",
    "ICPPriorityResponse",
    "SignalScoringResponse",
    "StrategicBriefResponse",

    # Intelligence Full
    "FullIntelligenceResponse",

    # Job Enums
    "JobStatus",
    "JobType",
    "LogLevel",

    # Job Progress
    "JobModuleProgress",
    "JobWaveProgress",

    # Job Response
    "JobResponse",
    "JobProgressResponse",
    "JobListResponse",
    "JobCancelResponse",
    "JobLogsResponse",
    "JobStatsResponse",

    # Job Log Entry
    "JobLogEntry",
]
