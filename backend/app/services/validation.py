"""
PartnerForge Source Validation Service

CRITICAL: Enforces the Source Citation Mandate (P0 requirement).
Every data point MUST have a source URL no older than 12 months.
"""

from datetime import datetime, timedelta
from typing import Optional, Any
from pydantic import BaseModel, HttpUrl, field_validator
import logging

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SourceFreshnessError(Exception):
    """Raised when source is older than allowed maximum age."""

    def __init__(self, source_date: datetime, max_age_days: int, source_type: str = "default"):
        self.source_date = source_date
        self.max_age_days = max_age_days
        self.source_type = source_type
        cutoff = datetime.now() - timedelta(days=max_age_days)
        super().__init__(
            f"Source date {source_date.isoformat()} is older than {max_age_days} days. "
            f"Cutoff: {cutoff.isoformat()}. Source type: {source_type}"
        )


class MissingSourceError(Exception):
    """Raised when required source_url is missing."""

    def __init__(self, module: str, field: str):
        self.module = module
        self.field = field
        super().__init__(
            f"Module '{module}' returned no source_url for field '{field}'. "
            f"SOURCE CITATION MANDATE VIOLATION. Data BLOCKED."
        )


class SourceCitation(BaseModel):
    """
    Source citation model - REQUIRED for every data point.

    This model enforces the Source Citation Mandate at the data layer.
    """

    source_url: HttpUrl
    source_date: datetime
    source_type: str  # api, webpage, document, transcript

    @field_validator("source_date")
    @classmethod
    def validate_freshness(cls, v: datetime) -> datetime:
        """Validate that source is not older than 12 months."""
        cutoff = datetime.now() - timedelta(days=settings.MAX_SOURCE_AGE_DAYS)
        if v < cutoff:
            raise ValueError(
                f"Source date {v.isoformat()} exceeds 12-month limit. "
                f"Cutoff: {cutoff.isoformat()}"
            )
        return v


def validate_source_freshness(
    source_date: Optional[datetime],
    source_type: str = "default",
    max_age_days: Optional[int] = None
) -> bool:
    """
    HARD VALIDATION: Source must be within allowed age.

    Args:
        source_date: The date of the source
        source_type: Type of source (for type-specific limits)
        max_age_days: Override max age (defaults based on type)

    Returns:
        True if valid

    Raises:
        SourceFreshnessError if source is too old
        ValueError if source_date is None
    """
    if source_date is None:
        raise ValueError("Source date is required (SOURCE CITATION MANDATE)")

    # Determine max age based on source type if not specified
    if max_age_days is None:
        max_age_days = _get_max_age_for_type(source_type)

    cutoff = datetime.now() - timedelta(days=max_age_days)

    if source_date < cutoff:
        raise SourceFreshnessError(source_date, max_age_days, source_type)

    return True


def _get_max_age_for_type(source_type: str) -> int:
    """Get maximum source age based on source type."""
    type_limits = {
        "stock_price": settings.STOCK_PRICE_MAX_AGE_DAYS,
        "traffic": settings.TRAFFIC_MAX_AGE_DAYS,
        "tech_stack": settings.TECH_STACK_MAX_AGE_DAYS,
        "quarterly_financials": settings.QUARTERLY_FINANCIALS_MAX_AGE_DAYS,
        "annual_financials": settings.MAX_SOURCE_AGE_DAYS,
        "earnings_transcript": settings.MAX_SOURCE_AGE_DAYS,
        "executive_quote": settings.MAX_SOURCE_AGE_DAYS,
        "sec_filing": settings.MAX_SOURCE_AGE_DAYS,
        "default": settings.MAX_SOURCE_AGE_DAYS,
    }
    return type_limits.get(source_type, settings.MAX_SOURCE_AGE_DAYS)


def validate_enrichment_result(result: dict, module: str) -> dict:
    """
    Gate that BLOCKS any enrichment result without valid source.

    Called after EVERY module enrichment. This is the final checkpoint
    before data enters the database.

    Args:
        result: The enrichment result dictionary
        module: The module identifier (e.g., "m01_company_context")

    Returns:
        The validated result if valid

    Raises:
        MissingSourceError if source_url is missing
        SourceFreshnessError if source is too old
    """
    # HARD REQUIREMENT: source_url must exist
    if not result.get("source_url"):
        raise MissingSourceError(module, "source_url")

    # HARD REQUIREMENT: source_date must exist and be < 12 months
    source_date = result.get("source_date")
    if source_date is None:
        raise MissingSourceError(module, "source_date")

    # Parse date if string
    if isinstance(source_date, str):
        try:
            source_date = datetime.fromisoformat(source_date.replace("Z", "+00:00"))
        except ValueError as e:
            raise ValueError(f"Invalid source_date format in module '{module}': {e}")

    # Validate freshness
    source_type = result.get("source_type", "default")
    validate_source_freshness(source_date, source_type)

    logger.debug(
        f"Module '{module}' passed source validation. "
        f"Source: {result.get('source_url')}, Date: {source_date.isoformat()}"
    )

    return result


def validate_data_point(
    value: Any,
    source_url: Optional[str],
    source_date: Optional[datetime],
    field_name: str,
    module: str
) -> dict:
    """
    Validate a single data point with its source.

    Every data point must have an associated source. This function
    packages the value with its source citation.

    Args:
        value: The data value
        source_url: URL of the source
        source_date: Date of the source
        field_name: Name of the field
        module: Module identifier

    Returns:
        dict with value and source citation

    Raises:
        MissingSourceError if source is missing
        SourceFreshnessError if source is too old
    """
    if source_url is None:
        raise MissingSourceError(module, field_name)

    if source_date is None:
        raise MissingSourceError(module, f"{field_name}_date")

    validate_source_freshness(source_date)

    return {
        "value": value,
        "source_url": source_url,
        "source_date": source_date.isoformat(),
        "validated_at": datetime.now().isoformat(),
    }


def get_freshness_status(source_date: Optional[datetime], source_type: str = "default") -> str:
    """
    Get the freshness status of a source.

    Returns:
        "fresh" - Within recommended freshness
        "stale" - Approaching limit but still valid
        "expired" - Past the limit (BLOCKED)
    """
    if source_date is None:
        return "expired"

    max_age = _get_max_age_for_type(source_type)
    age = (datetime.now() - source_date).days

    if age > max_age:
        return "expired"
    elif age > max_age * 0.75:  # Within 75-100% of limit
        return "stale"
    else:
        return "fresh"
