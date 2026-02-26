"""
Pydantic Schemas for Target Operations

Request/Response models for displacement target management endpoints.
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Any, List, Dict
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class TargetStatus(str, Enum):
    """Lead status based on ICP score."""
    HOT = "hot"
    WARM = "warm"
    COOL = "cool"
    COLD = "cold"
    UNSCORED = "unscored"


class EnrichmentLevel(str, Enum):
    """Level of enrichment completed."""
    BASIC = "basic"
    STANDARD = "standard"
    FULL = "full"


class SortField(str, Enum):
    """Valid sort fields for target listing."""
    ICP_SCORE = "icp_score"
    TRAFFIC = "sw_monthly_visits"
    REVENUE = "revenue"
    NAME = "company_name"
    CREATED = "created_at"
    ENRICHED = "last_enriched"


class SortOrder(str, Enum):
    """Sort order direction."""
    ASC = "asc"
    DESC = "desc"


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
# Target Create/Update Schemas
# =============================================================================

class TargetCreate(BaseModel):
    """Request to create a new target manually."""
    domain: str = Field(..., min_length=3, max_length=255, description="Company domain")
    company_name: Optional[str] = Field(None, max_length=255, description="Company name")
    partner_tech: Optional[str] = Field(None, max_length=255, description="Partner technology (e.g., Adobe AEM)")
    vertical: Optional[str] = Field(None, max_length=100, description="Industry vertical")
    country: Optional[str] = Field(None, max_length=100, description="Country")
    city: Optional[str] = Field(None, max_length=100, description="City")
    state: Optional[str] = Field(None, max_length=100, description="State/Region")

    # Financial data
    ticker: Optional[str] = Field(None, max_length=20, description="Stock ticker symbol")
    revenue: Optional[float] = Field(None, ge=0, description="Annual revenue")

    # Current search provider
    current_search: Optional[str] = Field(None, max_length=255, description="Current search provider")

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        """Normalize and validate domain."""
        v = v.strip().lower()
        # Remove protocol if present
        if v.startswith("http://"):
            v = v[7:]
        elif v.startswith("https://"):
            v = v[8:]
        # Remove trailing slash
        v = v.rstrip("/")
        # Remove www prefix
        if v.startswith("www."):
            v = v[4:]

        if not v or "." not in v:
            raise ValueError("Invalid domain format")
        return v


class TargetUpdate(BaseModel):
    """Request to update an existing target."""
    company_name: Optional[str] = Field(None, max_length=255, description="Company name")
    partner_tech: Optional[str] = Field(None, max_length=255, description="Partner technology")
    vertical: Optional[str] = Field(None, max_length=100, description="Industry vertical")
    country: Optional[str] = Field(None, max_length=100, description="Country")
    city: Optional[str] = Field(None, max_length=100, description="City")
    state: Optional[str] = Field(None, max_length=100, description="State/Region")

    # Financial data
    ticker: Optional[str] = Field(None, max_length=20, description="Stock ticker")
    is_public: Optional[bool] = Field(None, description="Is publicly traded")
    revenue: Optional[float] = Field(None, ge=0, description="Annual revenue")

    # Search provider
    current_search: Optional[str] = Field(None, max_length=255, description="Current search provider")

    # Intelligence fields
    displacement_angle: Optional[str] = Field(None, description="Displacement opportunity angle")

    # ICP scoring (normally computed but can be overridden)
    icp_score: Optional[int] = Field(None, ge=0, le=100, description="Manual ICP score override")


# =============================================================================
# Target Response Schemas
# =============================================================================

class TargetSummary(BaseModel):
    """Summary view of a target for list endpoints."""
    id: int = Field(..., description="Target ID")
    domain: str = Field(..., description="Company domain")
    company_name: Optional[str] = Field(None, description="Company name")
    partner_tech: Optional[str] = Field(None, description="Partner technology")
    vertical: Optional[str] = Field(None, description="Industry vertical")
    country: Optional[str] = Field(None, description="Country")

    # Key metrics
    icp_score: Optional[int] = Field(None, description="ICP score (0-100)")
    icp_tier_name: Optional[str] = Field(None, description="ICP tier (hot/warm/cool/cold)")
    sw_monthly_visits: Optional[int] = Field(None, description="Monthly traffic")
    revenue: Optional[float] = Field(None, description="Annual revenue")

    # Search intel
    current_search: Optional[str] = Field(None, description="Current search provider")

    # Enrichment status
    enrichment_level: Optional[str] = Field(None, description="Enrichment level")
    last_enriched: Optional[datetime] = Field(None, description="Last enrichment timestamp")

    created_at: datetime = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True


class TargetResponse(BaseModel):
    """Full target details."""
    id: int = Field(..., description="Target ID")
    domain: str = Field(..., description="Company domain")
    company_name: Optional[str] = Field(None, description="Company name")
    partner_tech: Optional[str] = Field(None, description="Partner technology")
    vertical: Optional[str] = Field(None, description="Industry vertical")
    country: Optional[str] = Field(None, description="Country")
    city: Optional[str] = Field(None, description="City")
    state: Optional[str] = Field(None, description="State/Region")

    # Tech spend
    tech_spend: Optional[int] = Field(None, description="Technology spend estimate")

    # Contact info (from BuiltWith)
    emails: Optional[List[str]] = Field(None, description="Contact emails")
    phones: Optional[List[str]] = Field(None, description="Contact phones")
    socials: Optional[List[str]] = Field(None, description="Social profiles")
    exec_titles: Optional[List[str]] = Field(None, description="Executive titles")

    # SimilarWeb data
    sw_monthly_visits: Optional[int] = Field(None, description="Monthly traffic")
    sw_bounce_rate: Optional[float] = Field(None, description="Bounce rate")
    sw_pages_per_visit: Optional[float] = Field(None, description="Pages per visit")
    sw_avg_duration: Optional[int] = Field(None, description="Avg visit duration (seconds)")
    sw_search_traffic_pct: Optional[float] = Field(None, description="Search traffic percentage")
    sw_rank_global: Optional[int] = Field(None, description="Global traffic rank")

    # ICP Scoring
    icp_tier: Optional[int] = Field(None, description="ICP tier (1-4)")
    icp_score: Optional[int] = Field(None, description="ICP score (0-100)")
    icp_tier_name: Optional[str] = Field(None, description="ICP tier name")
    score_reasons: Optional[List[str]] = Field(None, description="Score reasoning")
    score_breakdown: Optional[Dict[str, Any]] = Field(None, description="Score component breakdown")

    # Financial data
    ticker: Optional[str] = Field(None, description="Stock ticker")
    is_public: Optional[bool] = Field(None, description="Is publicly traded")
    revenue: Optional[float] = Field(None, description="Annual revenue")
    gross_margin: Optional[float] = Field(None, description="Gross margin")
    traffic_growth: Optional[float] = Field(None, description="Traffic growth rate")

    # Search intelligence
    current_search: Optional[str] = Field(None, description="Current search provider")

    # Case study matching
    matched_case_studies: Optional[List[str]] = Field(None, description="Matched case study IDs")
    lead_score: Optional[int] = Field(None, description="Lead score")

    # Strategic intelligence
    trigger_events: Optional[List[str]] = Field(None, description="Trigger events")
    exec_quote: Optional[str] = Field(None, description="Executive quote")
    exec_name: Optional[str] = Field(None, description="Executive name")
    exec_title: Optional[str] = Field(None, description="Executive title")
    quote_source: Optional[str] = Field(None, description="Quote source URL")
    competitors_using_algolia: Optional[List[str]] = Field(None, description="Competitors using Algolia")
    displacement_angle: Optional[str] = Field(None, description="Displacement opportunity")

    # Enrichment metadata
    enrichment_level: Optional[str] = Field(None, description="Enrichment level")
    last_enriched: Optional[datetime] = Field(None, description="Last enrichment timestamp")

    created_at: datetime = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def parse_json_fields(cls, data: Any) -> Any:
        """Parse JSON string fields into lists/dicts."""
        import json

        if isinstance(data, dict):
            json_list_fields = [
                "emails", "phones", "socials", "exec_titles",
                "matched_case_studies", "score_reasons", "trigger_events",
                "competitors_using_algolia"
            ]
            json_dict_fields = ["score_breakdown"]

            for field in json_list_fields:
                if field in data and isinstance(data[field], str):
                    try:
                        data[field] = json.loads(data[field])
                    except (json.JSONDecodeError, TypeError):
                        data[field] = None

            for field in json_dict_fields:
                if field in data and isinstance(data[field], str):
                    try:
                        data[field] = json.loads(data[field])
                    except (json.JSONDecodeError, TypeError):
                        data[field] = None

        return data


class TargetListResponse(BaseModel):
    """Paginated list of targets."""
    targets: List[TargetSummary] = Field(..., description="List of targets")
    pagination: PaginationMeta = Field(..., description="Pagination info")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Applied filters")


# =============================================================================
# Target Intelligence Response
# =============================================================================

class ModuleStatus(BaseModel):
    """Status of a single intelligence module."""
    module_id: str = Field(..., description="Module ID (e.g., m01)")
    module_name: str = Field(..., description="Module name")
    status: str = Field(..., description="Status (available/pending/enriching/failed)")
    last_updated: Optional[datetime] = Field(None, description="Last update timestamp")
    freshness: Optional[str] = Field(None, description="Data freshness (fresh/stale/expired)")
    data_summary: Optional[Dict[str, Any]] = Field(None, description="Summary of module data")


class TargetIntelligenceResponse(BaseModel):
    """All intelligence modules for a target."""
    domain: str = Field(..., description="Company domain")
    company_name: Optional[str] = Field(None, description="Company name")
    icp_score: Optional[int] = Field(None, description="ICP score")

    # Module statuses
    modules: List[ModuleStatus] = Field(..., description="Intelligence module statuses")

    # Overall status
    overall_completeness: float = Field(..., ge=0, le=100, description="Completeness percentage")
    last_full_enrichment: Optional[datetime] = Field(None, description="Last full enrichment")

    # Aggregated data
    key_insights: List[str] = Field(default_factory=list, description="Key insights from all modules")
    recommended_actions: List[str] = Field(default_factory=list, description="Recommended actions")


# =============================================================================
# Target Filter Schemas
# =============================================================================

class TargetFilter(BaseModel):
    """Filters for target listing."""
    status: Optional[TargetStatus] = Field(None, description="Filter by status")
    partner_tech: Optional[str] = Field(None, description="Filter by partner technology")
    vertical: Optional[str] = Field(None, description="Filter by vertical")
    country: Optional[str] = Field(None, description="Filter by country")
    min_score: Optional[int] = Field(None, ge=0, le=100, description="Minimum ICP score")
    max_score: Optional[int] = Field(None, ge=0, le=100, description="Maximum ICP score")
    min_traffic: Optional[int] = Field(None, ge=0, description="Minimum monthly traffic")
    has_current_search: Optional[bool] = Field(None, description="Has current search provider")
    enrichment_level: Optional[EnrichmentLevel] = Field(None, description="Filter by enrichment level")
    search_query: Optional[str] = Field(None, description="Search in domain/company name")


# =============================================================================
# Bulk Operation Schemas
# =============================================================================

class TargetBulkCreate(BaseModel):
    """Bulk create targets."""
    targets: List[TargetCreate] = Field(..., min_length=1, max_length=1000, description="Targets to create")
    skip_duplicates: bool = Field(True, description="Skip domains that already exist")


class TargetBulkCreateResponse(BaseModel):
    """Response from bulk create."""
    created: int = Field(..., description="Number of targets created")
    skipped: int = Field(..., description="Number of duplicates skipped")
    failed: int = Field(..., description="Number of failures")
    errors: List[Dict[str, str]] = Field(default_factory=list, description="Error details")
    created_ids: List[int] = Field(default_factory=list, description="Created target IDs")


class TargetBulkDelete(BaseModel):
    """Bulk delete targets."""
    domains: List[str] = Field(..., min_length=1, max_length=1000, description="Domains to delete")


class TargetBulkDeleteResponse(BaseModel):
    """Response from bulk delete."""
    deleted: int = Field(..., description="Number of targets deleted")
    not_found: int = Field(..., description="Number of domains not found")


# =============================================================================
# Search Schemas
# =============================================================================

class TargetSearchRequest(BaseModel):
    """Request to search targets by domain list."""
    domains: List[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of domains to search for"
    )

    @field_validator("domains")
    @classmethod
    def validate_domains(cls, v: List[str]) -> List[str]:
        """Clean and validate domains."""
        cleaned = []
        for domain in v:
            d = domain.strip().lower()
            # Remove protocol if present
            if d.startswith("http://"):
                d = d[7:]
            elif d.startswith("https://"):
                d = d[8:]
            # Remove trailing slash and www
            d = d.rstrip("/")
            if d.startswith("www."):
                d = d[4:]
            if d and "." in d:
                cleaned.append(d)
        if not cleaned:
            raise ValueError("At least one valid domain is required")
        return cleaned


class TargetSearchResponse(BaseModel):
    """Response from target search by domains."""
    found: List[TargetSummary] = Field(..., description="Targets found")
    not_found: List[str] = Field(..., description="Domains not in system")
    total_searched: int = Field(..., description="Total domains searched")
    total_found: int = Field(..., description="Total targets found")


# =============================================================================
# Status Update Schemas
# =============================================================================

class TargetStatusUpdate(BaseModel):
    """Request to update target status/ICP score."""
    icp_score: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="New ICP score (0-100)"
    )
    icp_tier_name: Optional[str] = Field(
        None,
        description="New tier name (hot/warm/cool/cold)"
    )
    score_reasons: Optional[List[str]] = Field(
        None,
        description="Updated score reasons"
    )

    @field_validator("icp_tier_name")
    @classmethod
    def validate_tier(cls, v: Optional[str]) -> Optional[str]:
        """Validate tier name."""
        if v is None:
            return v
        valid_tiers = ["hot", "warm", "cool", "cold"]
        if v.lower() not in valid_tiers:
            raise ValueError(f"Invalid tier. Must be one of: {valid_tiers}")
        return v.lower()


class TargetStatusUpdateResponse(BaseModel):
    """Response after updating target status."""
    id: int = Field(..., description="Target ID")
    domain: str = Field(..., description="Domain")
    icp_score: Optional[int] = Field(None, description="Updated ICP score")
    icp_tier_name: Optional[str] = Field(None, description="Updated tier name")
    status: TargetStatus = Field(..., description="New computed status")
    updated_at: datetime = Field(..., description="Update timestamp")
    message: str = Field(..., description="Status message")


# =============================================================================
# Statistics Schemas
# =============================================================================

class StatusBreakdown(BaseModel):
    """Count of targets by status."""
    hot: int = Field(0, description="Hot leads (ICP >= 80)")
    warm: int = Field(0, description="Warm leads (ICP 60-79)")
    cool: int = Field(0, description="Cool leads (ICP 40-59)")
    cold: int = Field(0, description="Cold leads (ICP < 40)")
    unscored: int = Field(0, description="Unscored leads")


class VerticalBreakdown(BaseModel):
    """Count of targets by vertical."""
    vertical: str = Field(..., description="Vertical name")
    count: int = Field(..., description="Number of targets")
    avg_icp_score: Optional[float] = Field(None, description="Average ICP score")


class PartnerTechBreakdown(BaseModel):
    """Count of targets by partner technology."""
    partner_tech: str = Field(..., description="Partner technology")
    count: int = Field(..., description="Number of targets")
    avg_icp_score: Optional[float] = Field(None, description="Average ICP score")


class TargetStats(BaseModel):
    """Aggregate statistics for displacement targets."""
    total: int = Field(..., description="Total number of targets")
    by_status: StatusBreakdown = Field(..., description="Breakdown by lead status")
    by_vertical: List[VerticalBreakdown] = Field(
        default_factory=list,
        description="Breakdown by vertical (top 10)"
    )
    by_partner_tech: List[PartnerTechBreakdown] = Field(
        default_factory=list,
        description="Breakdown by partner technology"
    )

    # Summary metrics
    avg_icp_score: Optional[float] = Field(None, description="Average ICP score")
    avg_monthly_visits: Optional[float] = Field(None, description="Average monthly visits")
    total_pipeline_value: Optional[float] = Field(None, description="Estimated pipeline value")

    # Enrichment stats
    enriched_count: int = Field(0, description="Targets with enrichment")
    public_count: int = Field(0, description="Publicly traded companies")

    # Time-based
    calculated_at: datetime = Field(..., description="Stats calculation timestamp")
