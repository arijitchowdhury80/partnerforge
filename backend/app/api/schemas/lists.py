"""
Pydantic Schemas for List Operations

Request/Response models for CSV upload and list management endpoints.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, List
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class ListStatus(str, Enum):
    """Status of an uploaded list."""
    UPLOADED = "uploaded"
    PARSING = "parsing"
    PARSED = "parsed"
    VALIDATING = "validating"
    VALIDATED = "validated"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ListSource(str, Enum):
    """Source of the uploaded list."""
    SALESFORCE = "salesforce"
    DEMANDBASE = "demandbase"
    SIXSENSE = "6sense"
    HUBSPOT = "hubspot"
    MANUAL = "manual"
    EXCEL = "excel"


class ItemStatus(str, Enum):
    """Status of a list item."""
    PENDING = "pending"
    VALIDATING = "validating"
    VALID = "valid"
    INVALID = "invalid"
    DUPLICATE = "duplicate"
    QUEUED = "queued"
    ENRICHING = "enriching"
    ENRICHED = "enriched"
    FAILED = "failed"
    SKIPPED = "skipped"


class EnrichmentPriority(str, Enum):
    """Priority for enrichment processing."""
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class MappingConfidence(str, Enum):
    """Confidence level of auto-detected column mapping."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# =============================================================================
# Pagination
# =============================================================================

class PaginationMeta(BaseModel):
    """Pagination metadata for list responses."""
    page: int = Field(..., ge=1, description="Current page number")
    limit: int = Field(..., ge=1, le=100, description="Items per page")
    total: int = Field(..., ge=0, description="Total number of items")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    @classmethod
    def from_query(cls, page: int, limit: int, total: int) -> "PaginationMeta":
        """Create pagination meta from query parameters."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(page=page, limit=limit, total=total, total_pages=total_pages)


# =============================================================================
# Column Mapping Schemas
# =============================================================================

class ListColumnMapping(BaseModel):
    """
    Column mapping for CSV parsing.

    Maps standard field names to actual CSV column headers.
    """
    domain: Optional[str] = Field(None, description="Column containing domain/website")
    company_name: Optional[str] = Field(None, description="Column containing company name")
    salesforce_id: Optional[str] = Field(None, description="Column containing Salesforce ID")
    demandbase_id: Optional[str] = Field(None, description="Column containing Demandbase ID")
    hubspot_id: Optional[str] = Field(None, description="Column containing HubSpot ID")
    revenue: Optional[str] = Field(None, description="Column containing revenue")
    traffic: Optional[str] = Field(None, description="Column containing traffic")
    industry: Optional[str] = Field(None, description="Column containing industry")
    employee_count: Optional[str] = Field(None, description="Column containing employee count")
    owner: Optional[str] = Field(None, description="Column containing account owner")
    region: Optional[str] = Field(None, description="Column containing region")
    journey_stage: Optional[str] = Field(None, description="Column containing journey stage")
    engagement_score: Optional[str] = Field(None, description="Column containing engagement score")
    target_account: Optional[str] = Field(None, description="Column containing target account flag")
    ticker: Optional[str] = Field(None, description="Column containing stock ticker")

    def has_required(self) -> bool:
        """Check if required columns (domain) are mapped."""
        return self.domain is not None


class ListColumnMappingConfirm(BaseModel):
    """Request to confirm or update column mapping."""
    mapping: ListColumnMapping = Field(..., description="Confirmed column mapping")
    confirmed: bool = Field(True, description="User confirmed the mapping")


# =============================================================================
# List Create/Upload Schemas
# =============================================================================

class ListCreate(BaseModel):
    """Request to create a new list (metadata only, before file upload)."""
    name: str = Field(..., min_length=1, max_length=255, description="List name")
    description: Optional[str] = Field(None, max_length=2000, description="List description")
    source: ListSource = Field(ListSource.MANUAL, description="Source of the list")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Strip whitespace and validate name."""
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty or whitespace")
        return v


class ListUploadResponse(BaseModel):
    """Response after uploading a CSV file."""
    id: str = Field(..., description="Unique list ID")
    name: str = Field(..., description="List name")
    status: ListStatus = Field(..., description="Current status")
    original_filename: str = Field(..., description="Original filename")
    file_size_bytes: int = Field(..., description="File size in bytes")
    total_rows: int = Field(..., description="Total rows in file")
    detected_columns: List[str] = Field(..., description="Detected column headers")
    column_mapping: ListColumnMapping = Field(..., description="Auto-detected column mapping")
    mapping_confidence: MappingConfidence = Field(..., description="Confidence of auto-detection")
    mapping_confirmed: bool = Field(False, description="Whether mapping is confirmed")
    created_at: datetime = Field(..., description="Upload timestamp")

    class Config:
        from_attributes = True


# =============================================================================
# List Response Schemas
# =============================================================================

class ListSummaryResponse(BaseModel):
    """Summary view of a list for list endpoints."""
    id: str = Field(..., description="Unique list ID")
    name: str = Field(..., description="List name")
    source: ListSource = Field(..., description="Source of the list")
    status: ListStatus = Field(..., description="Current status")
    total_rows: int = Field(..., description="Total rows")
    valid_rows: int = Field(..., description="Valid rows")
    invalid_rows: int = Field(..., description="Invalid rows")
    processed_count: int = Field(..., description="Processed items")
    success_count: int = Field(..., description="Successfully enriched")
    error_count: int = Field(..., description="Failed items")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        from_attributes = True


class ListResponse(BaseModel):
    """Full list details (without items)."""
    id: str = Field(..., description="Unique list ID")
    user_id: str = Field(..., description="Owner user ID")
    team_id: Optional[str] = Field(None, description="Team ID")
    name: str = Field(..., description="List name")
    description: Optional[str] = Field(None, description="List description")
    source: ListSource = Field(..., description="Source of the list")

    # File info
    original_filename: str = Field(..., description="Original filename")
    file_size_bytes: Optional[int] = Field(None, description="File size in bytes")
    file_hash: Optional[str] = Field(None, description="File hash for deduplication")

    # Parsing results
    total_rows: int = Field(0, description="Total rows")
    valid_rows: int = Field(0, description="Valid rows")
    invalid_rows: int = Field(0, description="Invalid rows")
    duplicate_rows: int = Field(0, description="Duplicate rows")
    skipped_rows: int = Field(0, description="Skipped rows (already in system)")

    # Column mapping
    detected_columns: Optional[list[str]] = Field(None, description="Detected column headers")
    column_mapping: Optional[dict[str, str]] = Field(None, description="Column mapping")
    mapping_confidence: Optional[MappingConfidence] = Field(None, description="Mapping confidence")
    mapping_confirmed: bool = Field(False, description="Mapping confirmed by user")

    # Status
    status: ListStatus = Field(..., description="Current status")

    # Progress
    processed_count: int = Field(0, description="Processed items")
    success_count: int = Field(0, description="Successfully enriched")
    error_count: int = Field(0, description="Failed items")

    # Enrichment
    enrichment_job_id: Optional[str] = Field(None, description="Current enrichment job ID")
    enrichment_modules: Optional[list[str]] = Field(None, description="Modules to run")
    enrichment_priority: EnrichmentPriority = Field(EnrichmentPriority.NORMAL, description="Processing priority")

    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    parsing_started_at: Optional[datetime] = Field(None, description="Parsing start")
    parsing_completed_at: Optional[datetime] = Field(None, description="Parsing complete")
    validation_started_at: Optional[datetime] = Field(None, description="Validation start")
    validation_completed_at: Optional[datetime] = Field(None, description="Validation complete")
    enrichment_started_at: Optional[datetime] = Field(None, description="Enrichment start")
    enrichment_completed_at: Optional[datetime] = Field(None, description="Enrichment complete")

    # Errors
    error_message: Optional[str] = Field(None, description="Error message if failed")
    error_details: Optional[dict[str, Any]] = Field(None, description="Detailed error info")

    class Config:
        from_attributes = True


class ListItemSummary(BaseModel):
    """Summary of a list item."""
    id: str = Field(..., description="Item ID")
    row_number: int = Field(..., description="Row number in CSV")
    domain: str = Field(..., description="Domain")
    company_name: Optional[str] = Field(None, description="Company name")
    status: ItemStatus = Field(..., description="Item status")
    validation_errors: Optional[list[dict[str, str]]] = Field(None, description="Validation errors")
    error_message: Optional[str] = Field(None, description="Error message")

    class Config:
        from_attributes = True


class ListItemResponse(BaseModel):
    """Full item details."""
    id: str = Field(..., description="Item ID")
    list_id: str = Field(..., description="Parent list ID")
    row_number: int = Field(..., description="Row number in CSV")

    # Core data
    domain: str = Field(..., description="Domain")
    company_name: Optional[str] = Field(None, description="Company name")

    # External IDs
    salesforce_id: Optional[str] = Field(None, description="Salesforce ID")
    demandbase_id: Optional[str] = Field(None, description="Demandbase ID")
    hubspot_id: Optional[str] = Field(None, description="HubSpot ID")

    # Original CSV data
    csv_data: Optional[dict[str, Any]] = Field(None, description="All CSV columns")

    # Pre-existing data
    pre_existing_revenue: Optional[dict[str, Any]] = Field(None, description="Revenue from CSV")
    pre_existing_traffic: Optional[dict[str, Any]] = Field(None, description="Traffic from CSV")
    pre_existing_tech_stack: Optional[dict[str, Any]] = Field(None, description="Tech stack from CSV")
    pre_existing_industry: Optional[dict[str, Any]] = Field(None, description="Industry from CSV")

    # Status
    status: ItemStatus = Field(..., description="Item status")
    validation_errors: Optional[list[dict[str, str]]] = Field(None, description="Validation errors")
    validated_at: Optional[datetime] = Field(None, description="Validation timestamp")

    # Enrichment
    enrichment_job_id: Optional[str] = Field(None, description="Enrichment job ID")
    enrichment_started_at: Optional[datetime] = Field(None, description="Enrichment start")
    enrichment_completed_at: Optional[datetime] = Field(None, description="Enrichment complete")

    # Results
    displacement_target_id: Optional[int] = Field(None, description="Linked target ID")
    existing_target_id: Optional[int] = Field(None, description="Existing target ID")

    # Errors
    error_message: Optional[str] = Field(None, description="Error message")
    retry_count: int = Field(0, description="Retry attempts")

    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update")

    class Config:
        from_attributes = True


class ListDetailResponse(BaseModel):
    """List with items (paginated)."""
    list_data: ListResponse = Field(..., description="List details", alias="list")
    items: List[ListItemSummary] = Field(..., description="List items (paginated)")
    pagination: PaginationMeta = Field(..., description="Pagination info")

    class Config:
        populate_by_name = True


class ListPaginatedResponse(BaseModel):
    """Paginated list of lists."""
    lists: List[ListSummaryResponse] = Field(..., description="Lists")
    pagination: PaginationMeta = Field(..., description="Pagination info")


# =============================================================================
# Validation Schemas
# =============================================================================

class ListValidationRequest(BaseModel):
    """Request to validate a list."""
    column_mapping: Optional[ListColumnMapping] = Field(
        None,
        description="Updated column mapping (if user modified)"
    )
    skip_duplicates: bool = Field(True, description="Skip rows that already exist")
    validate_domains: bool = Field(True, description="Validate domain format")


class ValidationError(BaseModel):
    """Single validation error."""
    row_number: int = Field(..., description="Row number with error")
    field: str = Field(..., description="Field with error")
    error: str = Field(..., description="Error message")
    value: Optional[str] = Field(None, description="Invalid value")


class ListValidationResponse(BaseModel):
    """Response from list validation."""
    id: str = Field(..., description="List ID")
    status: ListStatus = Field(..., description="New status")
    total_rows: int = Field(..., description="Total rows")
    valid_rows: int = Field(..., description="Valid rows")
    invalid_rows: int = Field(..., description="Invalid rows")
    duplicate_rows: int = Field(..., description="Duplicate rows")
    skipped_rows: int = Field(..., description="Skipped rows")
    errors: List[ValidationError] = Field(default_factory=list, description="Validation errors (first 100)")
    validation_started_at: datetime = Field(..., description="Start time")
    validation_completed_at: datetime = Field(..., description="End time")
    ready_for_enrichment: bool = Field(..., description="Whether list can be enriched")


# =============================================================================
# Enrichment Schemas
# =============================================================================

class ListEnrichmentRequest(BaseModel):
    """Request to start enrichment on a list."""
    modules: Optional[list[str]] = Field(
        None,
        description="Specific modules to run (None = all)"
    )
    waves: Optional[list[int]] = Field(
        None,
        description="Specific waves to run (1-4, None = all)"
    )
    priority: EnrichmentPriority = Field(
        EnrichmentPriority.NORMAL,
        description="Processing priority"
    )
    force: bool = Field(False, description="Force re-enrichment even if cached")
    batch_size: int = Field(10, ge=1, le=100, description="Items per batch")

    @field_validator("modules")
    @classmethod
    def validate_modules(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        """Validate module IDs."""
        if v is None:
            return v
        valid_modules = [
            "m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials",
            "m05_competitors", "m06_hiring", "m07_strategic",
            "m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement",
            "m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief",
        ]
        invalid = [m for m in v if m not in valid_modules]
        if invalid:
            raise ValueError(f"Invalid module IDs: {invalid}")
        return v

    @field_validator("waves")
    @classmethod
    def validate_waves(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        """Validate wave numbers."""
        if v is None:
            return v
        invalid = [w for w in v if w < 1 or w > 4]
        if invalid:
            raise ValueError(f"Invalid wave numbers: {invalid}. Must be 1-4.")
        return v


class ListEnrichmentResponse(BaseModel):
    """Response from starting enrichment."""
    id: str = Field(..., description="List ID")
    status: ListStatus = Field(..., description="New status")
    enrichment_job_id: str = Field(..., description="Job ID for tracking")
    modules: List[str] = Field(..., description="Modules to be run")
    priority: EnrichmentPriority = Field(..., description="Processing priority")
    items_queued: int = Field(..., description="Number of items queued")
    estimated_time_seconds: int = Field(..., description="Estimated processing time")
    enrichment_started_at: datetime = Field(..., description="Start time")


class ListProcessingStatus(BaseModel):
    """Current processing status of a list."""
    id: str = Field(..., description="List ID")
    status: ListStatus = Field(..., description="Current status")

    # Progress
    total_items: int = Field(..., description="Total items to process")
    processed_count: int = Field(..., description="Items processed")
    success_count: int = Field(..., description="Successfully enriched")
    error_count: int = Field(..., description="Failed items")
    progress_percent: float = Field(..., ge=0, le=100, description="Progress percentage")

    # Current operation
    current_wave: Optional[int] = Field(None, description="Current wave (1-4)")
    current_module: Optional[str] = Field(None, description="Current module")
    current_item: Optional[str] = Field(None, description="Current item domain")

    # Job info
    enrichment_job_id: Optional[str] = Field(None, description="Job ID")
    started_at: Optional[datetime] = Field(None, description="Start time")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion")

    # Errors
    recent_errors: List[dict[str, Any]] = Field(
        default_factory=list,
        description="Recent errors (last 10)"
    )

    @classmethod
    def from_list(cls, uploaded_list: Any) -> "ListProcessingStatus":
        """Create status from UploadedList model."""
        total = uploaded_list.valid_rows or 0
        processed = uploaded_list.processed_count or 0
        progress = (processed / total * 100) if total > 0 else 0

        return cls(
            id=uploaded_list.id,
            status=uploaded_list.status,
            total_items=total,
            processed_count=processed,
            success_count=uploaded_list.success_count or 0,
            error_count=uploaded_list.error_count or 0,
            progress_percent=round(progress, 2),
            current_wave=None,
            current_module=None,
            current_item=None,
            enrichment_job_id=uploaded_list.enrichment_job_id,
            started_at=uploaded_list.enrichment_started_at,
            estimated_completion=None,
            recent_errors=[],
        )
