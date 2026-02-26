"""
Source Citation Models (P0 Requirement)
=======================================

Every data point in PartnerForge MUST have a source citation.
This is a non-negotiable enterprise requirement for:
- Audit trails
- Data freshness validation
- Trust and verification
- Compliance

Source Freshness Rules:
- Stock price: 1 day max
- Traffic data: 30 days max
- Tech stack: 90 days max
- Financials: 12 months max
- Transcripts: 12 months max

References:
- docs/SOURCE_CITATION_MANDATE.md
- docs/ENTERPRISE-ARCHITECTURE.md
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Any, Dict, List, Generic, TypeVar
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator


class SourceType(str, Enum):
    """Type of data source for citation."""
    BUILTWITH = "builtwith"
    SIMILARWEB = "similarweb"
    YAHOO_FINANCE = "yahoo_finance"
    SEC_EDGAR = "sec_edgar"
    WEBSEARCH = "websearch"
    LINKEDIN = "linkedin"
    COMPANY_WEBSITE = "company_website"
    PRESS_RELEASE = "press_release"
    EARNINGS_CALL = "earnings_call"
    INVESTOR_PRESENTATION = "investor_presentation"
    NEWS_ARTICLE = "news_article"
    MANUAL_ENTRY = "manual_entry"
    CACHE = "cache"


class FreshnessStatus(str, Enum):
    """Data freshness classification."""
    FRESH = "fresh"       # Within recommended window
    STALE = "stale"       # Approaching expiry
    EXPIRED = "expired"   # Beyond maximum age
    UNKNOWN = "unknown"   # No timestamp available


# Freshness rules by source type (in days)
FRESHNESS_RULES: Dict[SourceType, Dict[str, int]] = {
    SourceType.YAHOO_FINANCE: {"fresh": 1, "stale": 7, "expired": 30},  # Stock data volatile
    SourceType.SIMILARWEB: {"fresh": 7, "stale": 30, "expired": 90},    # Traffic data
    SourceType.BUILTWITH: {"fresh": 30, "stale": 90, "expired": 180},   # Tech stack stable
    SourceType.SEC_EDGAR: {"fresh": 90, "stale": 180, "expired": 365},  # Quarterly filings
    SourceType.EARNINGS_CALL: {"fresh": 90, "stale": 180, "expired": 365},
    SourceType.INVESTOR_PRESENTATION: {"fresh": 90, "stale": 180, "expired": 365},
    SourceType.PRESS_RELEASE: {"fresh": 30, "stale": 90, "expired": 365},
    SourceType.NEWS_ARTICLE: {"fresh": 30, "stale": 90, "expired": 365},
    SourceType.LINKEDIN: {"fresh": 7, "stale": 30, "expired": 90},
    SourceType.COMPANY_WEBSITE: {"fresh": 30, "stale": 90, "expired": 365},
    SourceType.WEBSEARCH: {"fresh": 7, "stale": 30, "expired": 90},
    SourceType.MANUAL_ENTRY: {"fresh": 30, "stale": 90, "expired": 180},
    SourceType.CACHE: {"fresh": 1, "stale": 7, "expired": 30},
}


class SourceCitation(BaseModel):
    """
    Mandatory source citation for every data point.

    This is the P0 requirement - no data enters the system without
    a valid source citation.

    Example:
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json?KEY=xxx&LOOKUP=costco.com",
            retrieved_at=datetime.utcnow(),
            api_endpoint="domain-lookup"
        )
    """

    source_type: SourceType = Field(
        ...,
        description="Type of source (builtwith, similarweb, etc.)"
    )

    source_url: HttpUrl = Field(
        ...,
        description="Full URL where data was retrieved (required)"
    )

    retrieved_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp when data was retrieved"
    )

    api_endpoint: Optional[str] = Field(
        default=None,
        description="Specific API endpoint used (e.g., 'domain-lookup')"
    )

    api_version: Optional[str] = Field(
        default=None,
        description="API version used"
    )

    cache_key: Optional[str] = Field(
        default=None,
        description="Cache key if data came from cache"
    )

    original_citation: Optional["SourceCitation"] = Field(
        default=None,
        description="Original source if this is cached data"
    )

    confidence_score: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence in data accuracy (0.0-1.0)"
    )

    notes: Optional[str] = Field(
        default=None,
        description="Additional context about the source"
    )

    @property
    def age_days(self) -> float:
        """Days since data was retrieved."""
        delta = datetime.utcnow() - self.retrieved_at
        return delta.total_seconds() / 86400

    @property
    def freshness_status(self) -> FreshnessStatus:
        """Calculate freshness status based on source type rules."""
        rules = FRESHNESS_RULES.get(self.source_type)
        if not rules:
            return FreshnessStatus.UNKNOWN

        # Use a small tolerance (1 minute) to handle edge case timing drift
        # between citation creation and freshness check
        tolerance = 1 / (24 * 60)  # 1 minute in days
        age = self.age_days

        if age <= rules["fresh"] + tolerance:
            return FreshnessStatus.FRESH
        elif age <= rules["stale"]:
            return FreshnessStatus.STALE
        else:
            return FreshnessStatus.EXPIRED

    @property
    def is_valid(self) -> bool:
        """Check if citation is still valid (not expired)."""
        return self.freshness_status != FreshnessStatus.EXPIRED

    def days_until_stale(self) -> Optional[float]:
        """Days until this data becomes stale. None if already stale/expired."""
        rules = FRESHNESS_RULES.get(self.source_type)
        if not rules:
            return None
        remaining = rules["fresh"] - self.age_days
        return remaining if remaining > 0 else None

    def days_until_expired(self) -> Optional[float]:
        """Days until this data expires. None if already expired."""
        rules = FRESHNESS_RULES.get(self.source_type)
        if not rules:
            return None
        remaining = rules["expired"] - self.age_days
        return remaining if remaining > 0 else None

    @classmethod
    def from_api_response(
        cls,
        source_type: SourceType,
        source_url: str,
        api_endpoint: Optional[str] = None,
        api_version: Optional[str] = None,
        confidence: float = 1.0,
    ) -> "SourceCitation":
        """Factory method for creating citation from API response."""
        return cls(
            source_type=source_type,
            source_url=source_url,
            retrieved_at=datetime.utcnow(),
            api_endpoint=api_endpoint,
            api_version=api_version,
            confidence_score=confidence,
        )

    @classmethod
    def from_cache(
        cls,
        original: "SourceCitation",
        cache_key: str,
    ) -> "SourceCitation":
        """Factory method for creating citation for cached data."""
        return cls(
            source_type=SourceType.CACHE,
            source_url=original.source_url,
            retrieved_at=datetime.utcnow(),  # Cache hit timestamp
            cache_key=cache_key,
            original_citation=original,
            confidence_score=original.confidence_score,
            notes=f"Cached from {original.source_type.value} at {original.retrieved_at.isoformat()}",
        )

    def to_compact_dict(self) -> Dict[str, Any]:
        """Compact representation for embedding in responses."""
        return {
            "type": self.source_type.value,
            "url": str(self.source_url),
            "at": self.retrieved_at.isoformat(),
            "fresh": self.freshness_status.value,
        }


# Generic type for sourced data
T = TypeVar("T")


class SourcedDataPoint(BaseModel, Generic[T]):
    """
    Base class for all data points that must have source citations.

    Every piece of data in PartnerForge extends this class to ensure
    mandatory source tracking.

    Example:
        class CompanyRevenue(SourcedDataPoint[float]):
            pass

        revenue = CompanyRevenue(
            value=1500000000.0,
            citation=SourceCitation(...),
        )
    """

    value: T = Field(
        ...,
        description="The actual data value"
    )

    citation: SourceCitation = Field(
        ...,
        description="Mandatory source citation (P0 requirement)"
    )

    field_name: Optional[str] = Field(
        default=None,
        description="Name of the field this data represents"
    )

    unit: Optional[str] = Field(
        default=None,
        description="Unit of measurement (e.g., 'USD', 'visits/month')"
    )

    @property
    def is_fresh(self) -> bool:
        """Check if the data is still fresh."""
        return self.citation.freshness_status == FreshnessStatus.FRESH

    @property
    def is_valid(self) -> bool:
        """Check if the data is still valid (not expired)."""
        return self.citation.is_valid

    @model_validator(mode="after")
    def validate_citation_exists(self) -> "SourcedDataPoint":
        """Enforce that citation is always present."""
        if self.citation is None:
            raise ValueError("Source citation is mandatory (P0 requirement)")
        return self


class SourcedString(SourcedDataPoint[str]):
    """String data point with source citation."""
    pass


class SourcedFloat(SourcedDataPoint[float]):
    """Numeric data point with source citation."""
    pass


class SourcedInt(SourcedDataPoint[int]):
    """Integer data point with source citation."""
    pass


class SourcedBool(SourcedDataPoint[bool]):
    """Boolean data point with source citation."""
    pass


class SourcedList(SourcedDataPoint[List[Any]]):
    """List data point with source citation."""
    pass


class SourcedDict(SourcedDataPoint[Dict[str, Any]]):
    """Dictionary data point with source citation."""
    pass


class MultiSourcedDataPoint(BaseModel, Generic[T]):
    """
    Data point aggregated from multiple sources.

    Used when a single field value is derived from multiple API calls
    or sources (e.g., traffic data from SimilarWeb confirmed by another source).

    Example:
        traffic = MultiSourcedDataPoint(
            value=5000000,
            primary_citation=similarweb_citation,
            supporting_citations=[builtwith_citation],
            aggregation_method="primary_with_validation"
        )
    """

    value: T = Field(
        ...,
        description="The aggregated/derived value"
    )

    primary_citation: SourceCitation = Field(
        ...,
        description="Primary source citation"
    )

    supporting_citations: List[SourceCitation] = Field(
        default_factory=list,
        description="Additional supporting sources"
    )

    aggregation_method: str = Field(
        default="primary_with_validation",
        description="How the value was derived from sources"
    )

    confidence_score: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Overall confidence in the aggregated value"
    )

    @property
    def all_citations(self) -> List[SourceCitation]:
        """All citations including primary and supporting."""
        return [self.primary_citation] + self.supporting_citations

    @property
    def oldest_citation_age(self) -> float:
        """Age of the oldest citation in days."""
        return max(c.age_days for c in self.all_citations)

    @property
    def is_valid(self) -> bool:
        """Check if all citations are still valid."""
        return all(c.is_valid for c in self.all_citations)


class ExecutiveQuote(BaseModel):
    """
    Executive quote with full attribution - critical for "In Their Own Words" section.

    Every quote must have:
    - Speaker name
    - Speaker title
    - Source URL (earnings call, 10-K, interview, etc.)
    - Date of statement
    """

    quote: str = Field(
        ...,
        description="The exact quote text"
    )

    speaker_name: str = Field(
        ...,
        description="Full name of the speaker"
    )

    speaker_title: str = Field(
        ...,
        description="Title/role of the speaker"
    )

    citation: SourceCitation = Field(
        ...,
        description="Source citation (earnings call, 10-K, etc.)"
    )

    context: Optional[str] = Field(
        default=None,
        description="Context around the quote"
    )

    maps_to_algolia: Optional[str] = Field(
        default=None,
        description="How this quote maps to Algolia value props"
    )

    @field_validator("quote")
    @classmethod
    def validate_quote_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Quote cannot be empty")
        return v.strip()

    @field_validator("speaker_name")
    @classmethod
    def validate_speaker_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Speaker name is required")
        return v.strip()


class ValidationResult(BaseModel):
    """
    Result of source citation validation.

    Used by validators to report on citation quality and freshness.
    """

    is_valid: bool = Field(
        ...,
        description="Overall validation result"
    )

    errors: List[str] = Field(
        default_factory=list,
        description="List of validation errors"
    )

    warnings: List[str] = Field(
        default_factory=list,
        description="List of validation warnings"
    )

    freshness_summary: Dict[FreshnessStatus, int] = Field(
        default_factory=dict,
        description="Count of citations by freshness status"
    )

    citation_count: int = Field(
        default=0,
        description="Total number of citations validated"
    )

    expired_count: int = Field(
        default=0,
        description="Number of expired citations"
    )


def validate_citations(citations: List[SourceCitation]) -> ValidationResult:
    """
    Validate a list of citations and return a summary.

    Args:
        citations: List of SourceCitation objects to validate

    Returns:
        ValidationResult with validation status and details
    """
    errors: List[str] = []
    warnings: List[str] = []
    freshness_counts: Dict[FreshnessStatus, int] = {
        FreshnessStatus.FRESH: 0,
        FreshnessStatus.STALE: 0,
        FreshnessStatus.EXPIRED: 0,
        FreshnessStatus.UNKNOWN: 0,
    }

    for i, citation in enumerate(citations):
        status = citation.freshness_status
        freshness_counts[status] += 1

        if status == FreshnessStatus.EXPIRED:
            errors.append(
                f"Citation {i+1} ({citation.source_type.value}) expired "
                f"({citation.age_days:.1f} days old)"
            )
        elif status == FreshnessStatus.STALE:
            warnings.append(
                f"Citation {i+1} ({citation.source_type.value}) is stale "
                f"({citation.age_days:.1f} days old)"
            )

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        freshness_summary=freshness_counts,
        citation_count=len(citations),
        expired_count=freshness_counts[FreshnessStatus.EXPIRED],
    )
