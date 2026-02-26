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
]
