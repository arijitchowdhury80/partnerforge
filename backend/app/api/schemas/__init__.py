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
]
