"""
Source Citation Module

CRITICAL DESIGN PRINCIPLE:
Every data point MUST have an inline citation with source URL.
No source older than 12 months is acceptable.

This module enforces source attribution throughout the system.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
import re


# =============================================================================
# Constants
# =============================================================================

MAX_SOURCE_AGE_DAYS = 365  # 12 months


class SourceType(str, Enum):
    """Types of data sources."""
    BUILTWITH = "builtwith"
    SIMILARWEB = "similarweb"
    YAHOO_FINANCE = "yahoo_finance"
    SEC_EDGAR = "sec_edgar"
    LINKEDIN_JOBS = "linkedin_jobs"
    WEB_SEARCH = "web_search"
    EARNINGS_CALL = "earnings_call"
    COMPANY_IR = "company_ir"
    NEWS = "news"
    ESTIMATE = "estimate"


class ConfidenceLevel(str, Enum):
    """Confidence levels for data points."""
    VERIFIED = "verified"    # Direct from authoritative source
    HIGH = "high"            # From reliable API
    MEDIUM = "medium"        # From web search
    LOW = "low"              # Inferred/calculated
    ESTIMATE = "estimate"    # Explicit estimate


# =============================================================================
# Source Citation Data Classes
# =============================================================================

@dataclass
class SourceCitation:
    """
    Represents a single source citation.

    Every data point in the system MUST have at least one SourceCitation.
    """

    url: str
    source_type: SourceType
    source_name: str
    retrieved_at: datetime
    confidence: ConfidenceLevel = ConfidenceLevel.VERIFIED

    # Optional metadata
    title: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[datetime] = None

    def __post_init__(self):
        """Validate source citation on creation."""
        self.validate()

    def validate(self) -> None:
        """Validate source citation."""

        # URL must be present and valid
        if not self.url:
            raise ValueError("Source URL is required")

        if not self._is_valid_url(self.url):
            raise ValueError(f"Invalid URL: {self.url}")

        # Source must not be older than 12 months
        if not self.is_fresh():
            raise ValueError(
                f"Source is older than {MAX_SOURCE_AGE_DAYS} days: {self.url}"
            )

    def is_fresh(self) -> bool:
        """Check if source is within 12-month freshness window."""
        cutoff = datetime.now() - timedelta(days=MAX_SOURCE_AGE_DAYS)
        return self.retrieved_at >= cutoff

    @property
    def age_days(self) -> int:
        """Get age of source in days."""
        return (datetime.now() - self.retrieved_at).days

    @staticmethod
    def _is_valid_url(url: str) -> bool:
        """Basic URL validation."""
        pattern = r'^https?://[^\s<>"{}|\\^`\[\]]+'
        return bool(re.match(pattern, url))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "url": self.url,
            "source_type": self.source_type.value,
            "source_name": self.source_name,
            "retrieved_at": self.retrieved_at.isoformat(),
            "confidence": self.confidence.value,
            "title": self.title,
            "author": self.author,
            "published_date": self.published_date.isoformat() if self.published_date else None,
        }

    def to_markdown(self) -> str:
        """Convert to markdown citation format."""
        return f"[{self.source_name}]({self.url})"


@dataclass
class CitedDataPoint:
    """
    A data point with mandatory source citation.

    This is the FUNDAMENTAL data unit in PartnerForge.
    Every fact must be wrapped in a CitedDataPoint.
    """

    value: Any
    citation: SourceCitation
    field_name: str
    additional_citations: List[SourceCitation] = field(default_factory=list)

    # Metadata
    extracted_at: datetime = field(default_factory=datetime.now)
    is_estimate: bool = False
    calculation_formula: Optional[str] = None

    def __post_init__(self):
        """Validate cited data point."""

        # Must have primary citation
        if not self.citation:
            raise ValueError(f"Citation required for field: {self.field_name}")

        # Mark estimates appropriately
        if self.citation.confidence == ConfidenceLevel.ESTIMATE:
            self.is_estimate = True

    def all_citations(self) -> List[SourceCitation]:
        """Get all citations for this data point."""
        return [self.citation] + self.additional_citations

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "value": self.value,
            "field_name": self.field_name,
            "citation": self.citation.to_dict(),
            "additional_citations": [c.to_dict() for c in self.additional_citations],
            "extracted_at": self.extracted_at.isoformat(),
            "is_estimate": self.is_estimate,
            "calculation_formula": self.calculation_formula,
        }


# =============================================================================
# Citation Validator
# =============================================================================

class CitationValidator:
    """
    Validates that all data points have proper citations.

    This is enforced at:
    1. Module output validation
    2. Deliverable generation
    3. API response serialization
    """

    def __init__(self, max_age_days: int = MAX_SOURCE_AGE_DAYS):
        self.max_age_days = max_age_days

    def validate_module_output(
        self,
        module_id: str,
        data: Dict[str, Any],
    ) -> List[str]:
        """
        Validate that all data points in module output have citations.

        Returns list of validation errors (empty = valid).
        """

        errors = []

        for field_name, value in data.items():
            # Skip metadata fields
            if field_name.startswith("_"):
                continue

            # Check for citation
            if isinstance(value, dict):
                if "citation" not in value and "source" not in value and "source_url" not in value:
                    errors.append(
                        f"Module {module_id}: Field '{field_name}' missing citation"
                    )
                elif "source_url" in value:
                    # Validate source URL
                    source_url = value.get("source_url")
                    if not source_url:
                        errors.append(
                            f"Module {module_id}: Field '{field_name}' has empty source_url"
                        )

            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        if "citation" not in item and "source" not in item and "source_url" not in item:
                            errors.append(
                                f"Module {module_id}: Field '{field_name}[{i}]' missing citation"
                            )

        return errors

    def validate_deliverable(
        self,
        deliverable_type: str,
        content: Dict[str, Any],
    ) -> List[str]:
        """
        Validate that deliverable has complete source attribution.

        Returns list of validation errors (empty = valid).
        """

        errors = []

        # Check for sources section
        if "sources" not in content:
            errors.append(f"{deliverable_type}: Missing 'sources' section")

        # Check for inline citations in text fields
        text_fields = self._extract_text_fields(content)
        for field_path, text in text_fields:
            if not self._has_inline_citation(text):
                # Only flag if text looks like a factual claim
                if self._is_factual_claim(text):
                    errors.append(
                        f"{deliverable_type}: Field '{field_path}' may need citation"
                    )

        return errors

    def _extract_text_fields(
        self,
        data: Dict[str, Any],
        prefix: str = "",
    ) -> List[tuple]:
        """Extract all text fields from nested dict."""

        results = []

        for key, value in data.items():
            path = f"{prefix}.{key}" if prefix else key

            if isinstance(value, str):
                results.append((path, value))
            elif isinstance(value, dict):
                results.extend(self._extract_text_fields(value, path))
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, str):
                        results.append((f"{path}[{i}]", item))
                    elif isinstance(item, dict):
                        results.extend(self._extract_text_fields(item, f"{path}[{i}]"))

        return results

    def _has_inline_citation(self, text: str) -> bool:
        """Check if text has an inline citation."""

        # Look for markdown links
        if re.search(r'\[.*?\]\(https?://.*?\)', text):
            return True

        # Look for SOURCE: pattern
        if "SOURCE:" in text or "Source:" in text:
            return True

        # Look for URL pattern
        if re.search(r'https?://[^\s]+', text):
            return True

        return False

    def _is_factual_claim(self, text: str) -> bool:
        """Check if text appears to be a factual claim needing citation."""

        # Skip short text
        if len(text) < 20:
            return False

        # Look for factual indicators
        factual_patterns = [
            r'\$\d+',           # Dollar amounts
            r'\d+%',            # Percentages
            r'revenue',         # Financial terms
            r'employees?',      # Company facts
            r'founded',         # Historical facts
            r'according to',    # Attribution phrases
            r'reported',
            r'announced',
        ]

        for pattern in factual_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True

        return False


# =============================================================================
# Citation Builder Helpers
# =============================================================================

def create_builtwith_citation(
    domain: str,
    endpoint: str,
) -> SourceCitation:
    """Create citation for BuiltWith API data."""

    return SourceCitation(
        url=f"https://builtwith.com/{domain}",
        source_type=SourceType.BUILTWITH,
        source_name=f"BuiltWith {endpoint}",
        retrieved_at=datetime.now(),
        confidence=ConfidenceLevel.VERIFIED,
    )


def create_similarweb_citation(
    domain: str,
    endpoint: str,
) -> SourceCitation:
    """Create citation for SimilarWeb API data."""

    return SourceCitation(
        url=f"https://www.similarweb.com/website/{domain}/",
        source_type=SourceType.SIMILARWEB,
        source_name=f"SimilarWeb {endpoint}",
        retrieved_at=datetime.now(),
        confidence=ConfidenceLevel.VERIFIED,
    )


def create_yahoo_finance_citation(
    ticker: str,
    data_type: str,
) -> SourceCitation:
    """Create citation for Yahoo Finance data."""

    return SourceCitation(
        url=f"https://finance.yahoo.com/quote/{ticker}/",
        source_type=SourceType.YAHOO_FINANCE,
        source_name=f"Yahoo Finance {data_type}",
        retrieved_at=datetime.now(),
        confidence=ConfidenceLevel.HIGH,
    )


def create_sec_citation(
    cik: str,
    filing_type: str,
    accession: str,
) -> SourceCitation:
    """Create citation for SEC EDGAR filing."""

    return SourceCitation(
        url=f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type={filing_type}",
        source_type=SourceType.SEC_EDGAR,
        source_name=f"SEC {filing_type} Filing",
        retrieved_at=datetime.now(),
        confidence=ConfidenceLevel.VERIFIED,
    )


def create_web_search_citation(
    url: str,
    title: str,
    published_date: Optional[datetime] = None,
) -> SourceCitation:
    """Create citation for web search result."""

    return SourceCitation(
        url=url,
        source_type=SourceType.WEB_SEARCH,
        source_name=title,
        retrieved_at=datetime.now(),
        confidence=ConfidenceLevel.MEDIUM,
        title=title,
        published_date=published_date,
    )


def create_estimate_citation(
    calculation: str,
    based_on: List[SourceCitation],
) -> SourceCitation:
    """Create citation for estimated/calculated values."""

    return SourceCitation(
        url=based_on[0].url if based_on else "calculation",
        source_type=SourceType.ESTIMATE,
        source_name=f"Estimate: {calculation}",
        retrieved_at=datetime.now(),
        confidence=ConfidenceLevel.ESTIMATE,
    )


# =============================================================================
# Module Output Wrapper
# =============================================================================

class CitedModuleOutput:
    """
    Wrapper for module output that enforces citations.

    Every module MUST return a CitedModuleOutput.
    """

    def __init__(self, module_id: str):
        self.module_id = module_id
        self.data_points: Dict[str, CitedDataPoint] = {}
        self.raw_data: Dict[str, Any] = {}

    def add_data_point(
        self,
        field_name: str,
        value: Any,
        citation: SourceCitation,
        additional_citations: List[SourceCitation] = None,
        is_estimate: bool = False,
        calculation_formula: str = None,
    ) -> None:
        """Add a cited data point."""

        self.data_points[field_name] = CitedDataPoint(
            value=value,
            citation=citation,
            field_name=field_name,
            additional_citations=additional_citations or [],
            is_estimate=is_estimate,
            calculation_formula=calculation_formula,
        )

    def add_raw_data(
        self,
        field_name: str,
        value: Any,
        source_url: str,
        source_name: str,
        source_type: SourceType = SourceType.WEB_SEARCH,
    ) -> None:
        """Add raw data with inline source (simpler API)."""

        self.raw_data[field_name] = {
            "value": value,
            "source_url": source_url,
            "source_name": source_name,
            "source_type": source_type.value,
            "retrieved_at": datetime.now().isoformat(),
        }

    def validate(self) -> List[str]:
        """Validate all data points have citations."""

        validator = CitationValidator()
        return validator.validate_module_output(self.module_id, self.to_dict())

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""

        result = {}

        # Add cited data points
        for field_name, dp in self.data_points.items():
            result[field_name] = dp.to_dict()

        # Add raw data
        for field_name, data in self.raw_data.items():
            result[field_name] = data

        # Add metadata
        result["_module_id"] = self.module_id
        result["_extracted_at"] = datetime.now().isoformat()
        result["_citation_count"] = len(self.data_points) + len(self.raw_data)

        return result
