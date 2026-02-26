"""
CSV Validation Service
======================

Validates uploaded list items before enrichment.

Features:
- Domain format validation
- Duplicate detection (within list and against existing targets)
- Required field validation
- Bulk validation with detailed reporting

All validation errors are tracked per-row for user review.
"""

import re
import logging
from typing import Dict, List, Set, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import tldextract
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class ValidationErrorType(str, Enum):
    """Types of validation errors."""
    INVALID_DOMAIN = "invalid_domain"
    EMPTY_DOMAIN = "empty_domain"
    DUPLICATE_IN_LIST = "duplicate_in_list"
    DUPLICATE_IN_SYSTEM = "duplicate_in_system"
    MISSING_REQUIRED = "missing_required"
    INVALID_FORMAT = "invalid_format"


class ValidationStatus(str, Enum):
    """Validation status for a row."""
    VALID = "valid"
    INVALID = "invalid"
    DUPLICATE = "duplicate"
    EXISTING = "existing"  # Already in system, can be updated


@dataclass
class ValidationError:
    """Represents a single validation error."""
    field: str
    error_type: ValidationErrorType
    message: str
    value: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "field": self.field,
            "error_type": self.error_type.value,
            "message": self.message,
            "value": self.value,
        }


@dataclass
class RowValidationResult:
    """Validation result for a single row."""
    row_number: int
    domain: Optional[str]
    normalized_domain: Optional[str]
    status: ValidationStatus
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    existing_target_id: Optional[int] = None  # If domain already exists

    @property
    def is_valid(self) -> bool:
        return self.status in (ValidationStatus.VALID, ValidationStatus.EXISTING)

    def to_dict(self) -> Dict:
        return {
            "row_number": self.row_number,
            "domain": self.domain,
            "normalized_domain": self.normalized_domain,
            "status": self.status.value,
            "is_valid": self.is_valid,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": self.warnings,
            "existing_target_id": self.existing_target_id,
        }


@dataclass
class ValidationReport:
    """Complete validation report for a list."""
    list_id: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    existing_rows: int
    row_results: List[RowValidationResult]
    validation_started_at: datetime
    validation_completed_at: Optional[datetime] = None
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "list_id": self.list_id,
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "invalid_rows": self.invalid_rows,
            "duplicate_rows": self.duplicate_rows,
            "existing_rows": self.existing_rows,
            "validation_started_at": self.validation_started_at.isoformat(),
            "validation_completed_at": self.validation_completed_at.isoformat() if self.validation_completed_at else None,
            "summary": self.summary,
            "error_breakdown": self._get_error_breakdown(),
        }

    def _get_error_breakdown(self) -> Dict[str, int]:
        """Get count of each error type."""
        breakdown: Dict[str, int] = {}
        for result in self.row_results:
            for error in result.errors:
                key = error.error_type.value
                breakdown[key] = breakdown.get(key, 0) + 1
        return breakdown


class CSVValidationService:
    """
    Validates uploaded list items before enrichment.

    Features:
    - Domain format validation (TLD extraction, URL parsing)
    - Duplicate detection within the upload
    - Duplicate detection against existing targets
    - Detailed error reporting per row

    Usage:
        validator = CSVValidationService()

        # Single domain validation
        is_valid, normalized = validator.validate_domain("www.example.com")

        # Bulk validation
        report = await validator.validate_list(
            list_id="abc123",
            rows=parsed_rows,
            domain_column="domain",
            existing_domains={"example.com": 1}
        )
    """

    # Domain validation patterns
    DOMAIN_PATTERN = re.compile(
        r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
    )

    # Common test/invalid domains to reject
    BLOCKED_DOMAINS = {
        "example.com", "example.org", "example.net",
        "test.com", "test.org", "localhost",
        "invalid.com", "invalid.domain",
        "your-domain.com", "yourdomain.com",
        "domain.com", "company.com",
        "n/a", "na", "none", "-", "unknown",
    }

    # Common URL prefixes to strip
    URL_PREFIXES = [
        "https://www.", "http://www.",
        "https://", "http://",
        "www.",
    ]

    def __init__(
        self,
        allow_blocked_domains: bool = False,
        strict_tld_validation: bool = True,
    ):
        """
        Initialize validation service.

        Args:
            allow_blocked_domains: Allow test domains like example.com
            strict_tld_validation: Require valid TLD
        """
        self.allow_blocked_domains = allow_blocked_domains
        self.strict_tld_validation = strict_tld_validation

    def validate_domain(
        self,
        domain: Optional[str],
    ) -> Tuple[bool, Optional[str], List[str]]:
        """
        Validate and normalize a single domain.

        Args:
            domain: Domain string to validate (can be URL or bare domain)

        Returns:
            Tuple of (is_valid, normalized_domain, error_messages)
        """
        errors: List[str] = []

        if not domain:
            return False, None, ["Domain is empty or missing"]

        domain = domain.strip()

        if not domain:
            return False, None, ["Domain is empty after trimming"]

        # Check for obviously invalid values
        if domain.lower() in self.BLOCKED_DOMAINS and not self.allow_blocked_domains:
            return False, None, [f"'{domain}' is a blocked/test domain"]

        # Normalize the domain
        normalized = self._normalize_domain(domain)

        if not normalized:
            return False, None, [f"Could not extract valid domain from '{domain}'"]

        # Check blocked domains again after normalization
        if normalized.lower() in self.BLOCKED_DOMAINS and not self.allow_blocked_domains:
            return False, None, [f"'{normalized}' is a blocked/test domain"]

        # Validate domain format
        if not self._is_valid_domain_format(normalized):
            return False, None, [f"'{normalized}' is not a valid domain format"]

        # Validate TLD
        if self.strict_tld_validation:
            extracted = tldextract.extract(normalized)
            if not extracted.suffix:
                errors.append(f"'{normalized}' has no valid TLD")
                return False, normalized, errors

        return True, normalized, []

    def _normalize_domain(self, value: str) -> Optional[str]:
        """
        Normalize a domain value.

        Handles:
        - Full URLs (https://www.example.com/path)
        - Domains with www prefix
        - Trailing slashes and paths
        - Whitespace

        Returns:
            Normalized domain or None if extraction fails
        """
        value = value.strip().lower()

        # Try to extract from URL first
        if '://' in value or value.startswith('www.'):
            try:
                # Add scheme if missing for urlparse
                url = value if '://' in value else f'https://{value}'
                parsed = urlparse(url)
                hostname = parsed.hostname

                if hostname:
                    # Remove www prefix
                    if hostname.startswith('www.'):
                        hostname = hostname[4:]
                    return hostname
            except Exception:
                pass

        # Strip common prefixes manually
        for prefix in self.URL_PREFIXES:
            if value.lower().startswith(prefix.lower()):
                value = value[len(prefix):]
                break

        # Remove path/query string
        value = value.split('/')[0]
        value = value.split('?')[0]
        value = value.split('#')[0]

        # Use tldextract for robust extraction
        try:
            extracted = tldextract.extract(value)
            if extracted.domain and extracted.suffix:
                # Rebuild domain (may include subdomain)
                parts = [p for p in [extracted.subdomain, extracted.domain, extracted.suffix] if p]
                # Skip www subdomain
                if parts and parts[0] == 'www':
                    parts = parts[1:]
                # For most cases, we want just domain.tld
                if extracted.subdomain and extracted.subdomain != 'www':
                    return f"{extracted.subdomain}.{extracted.domain}.{extracted.suffix}"
                return f"{extracted.domain}.{extracted.suffix}"
        except Exception:
            pass

        # Final cleanup
        value = value.strip()
        if value and '.' in value:
            return value

        return None

    def _is_valid_domain_format(self, domain: str) -> bool:
        """Check if domain matches valid format."""
        if not domain or len(domain) > 253:
            return False

        # Check for invalid characters
        if any(c in domain for c in [' ', '\t', '\n', '\\', '/']):
            return False

        # Must have at least one dot
        if '.' not in domain:
            return False

        # Check each label
        labels = domain.split('.')
        for label in labels:
            if not label or len(label) > 63:
                return False
            # Must not start or end with hyphen
            if label.startswith('-') or label.endswith('-'):
                return False
            # Must be alphanumeric with hyphens
            if not re.match(r'^[a-zA-Z0-9-]+$', label):
                return False

        return True

    async def validate_list(
        self,
        list_id: str,
        rows: List[Dict[str, Any]],
        domain_column: str,
        existing_domains: Optional[Dict[str, int]] = None,
        company_name_column: Optional[str] = None,
    ) -> ValidationReport:
        """
        Validate all rows in an uploaded list.

        Args:
            list_id: ID of the uploaded list
            rows: List of parsed row dictionaries
            domain_column: Name of the domain column
            existing_domains: Dict mapping domain -> target_id for existing records
            company_name_column: Optional company name column

        Returns:
            ValidationReport with per-row results
        """
        logger.info(f"Validating list {list_id} with {len(rows)} rows")

        started_at = datetime.utcnow()
        existing_domains = existing_domains or {}

        row_results: List[RowValidationResult] = []
        seen_domains: Dict[str, int] = {}  # domain -> first row number

        valid_count = 0
        invalid_count = 0
        duplicate_count = 0
        existing_count = 0

        for i, row in enumerate(rows):
            row_number = row.get("row_number", i + 1)
            domain_value = row.get(domain_column, "")

            result = self._validate_row(
                row_number=row_number,
                domain_value=domain_value,
                seen_domains=seen_domains,
                existing_domains=existing_domains,
            )

            # Track for duplicate detection
            if result.normalized_domain and result.status != ValidationStatus.INVALID:
                if result.normalized_domain not in seen_domains:
                    seen_domains[result.normalized_domain] = row_number

            # Update counts
            if result.status == ValidationStatus.VALID:
                valid_count += 1
            elif result.status == ValidationStatus.INVALID:
                invalid_count += 1
            elif result.status == ValidationStatus.DUPLICATE:
                duplicate_count += 1
            elif result.status == ValidationStatus.EXISTING:
                existing_count += 1

            row_results.append(result)

        completed_at = datetime.utcnow()

        # Build summary
        summary = {
            "unique_domains": len(seen_domains),
            "ready_for_enrichment": valid_count + existing_count,
            "needs_review": invalid_count + duplicate_count,
            "processing_time_seconds": (completed_at - started_at).total_seconds(),
        }

        report = ValidationReport(
            list_id=list_id,
            total_rows=len(rows),
            valid_rows=valid_count,
            invalid_rows=invalid_count,
            duplicate_rows=duplicate_count,
            existing_rows=existing_count,
            row_results=row_results,
            validation_started_at=started_at,
            validation_completed_at=completed_at,
            summary=summary,
        )

        logger.info(
            f"Validation complete for {list_id}: "
            f"valid={valid_count}, invalid={invalid_count}, "
            f"duplicates={duplicate_count}, existing={existing_count}"
        )

        return report

    def _validate_row(
        self,
        row_number: int,
        domain_value: Optional[str],
        seen_domains: Dict[str, int],
        existing_domains: Dict[str, int],
    ) -> RowValidationResult:
        """
        Validate a single row.

        Args:
            row_number: Row number in the CSV
            domain_value: Raw domain value from CSV
            seen_domains: Domains already seen in this upload
            existing_domains: Domains already in the system

        Returns:
            RowValidationResult with validation status and errors
        """
        errors: List[ValidationError] = []
        warnings: List[str] = []

        # Validate domain
        is_valid, normalized_domain, domain_errors = self.validate_domain(domain_value)

        if not is_valid:
            for error_msg in domain_errors:
                error_type = (
                    ValidationErrorType.EMPTY_DOMAIN
                    if "empty" in error_msg.lower()
                    else ValidationErrorType.INVALID_DOMAIN
                )
                errors.append(ValidationError(
                    field="domain",
                    error_type=error_type,
                    message=error_msg,
                    value=domain_value,
                ))

            return RowValidationResult(
                row_number=row_number,
                domain=domain_value,
                normalized_domain=normalized_domain,
                status=ValidationStatus.INVALID,
                errors=errors,
            )

        # Check for duplicate within this list
        if normalized_domain in seen_domains:
            first_row = seen_domains[normalized_domain]
            errors.append(ValidationError(
                field="domain",
                error_type=ValidationErrorType.DUPLICATE_IN_LIST,
                message=f"Duplicate of row {first_row}",
                value=normalized_domain,
            ))

            return RowValidationResult(
                row_number=row_number,
                domain=domain_value,
                normalized_domain=normalized_domain,
                status=ValidationStatus.DUPLICATE,
                errors=errors,
            )

        # Check if already exists in system
        if normalized_domain in existing_domains:
            existing_id = existing_domains[normalized_domain]
            warnings.append(f"Domain already exists in system (ID: {existing_id})")

            return RowValidationResult(
                row_number=row_number,
                domain=domain_value,
                normalized_domain=normalized_domain,
                status=ValidationStatus.EXISTING,
                warnings=warnings,
                existing_target_id=existing_id,
            )

        # All validations passed
        return RowValidationResult(
            row_number=row_number,
            domain=domain_value,
            normalized_domain=normalized_domain,
            status=ValidationStatus.VALID,
        )

    def get_valid_rows(
        self,
        report: ValidationReport,
        include_existing: bool = True,
    ) -> List[RowValidationResult]:
        """
        Get valid rows from a validation report.

        Args:
            report: ValidationReport to filter
            include_existing: Include rows for domains already in system

        Returns:
            List of valid row results
        """
        valid_statuses = {ValidationStatus.VALID}
        if include_existing:
            valid_statuses.add(ValidationStatus.EXISTING)

        return [r for r in report.row_results if r.status in valid_statuses]

    def get_invalid_rows(
        self,
        report: ValidationReport,
    ) -> List[RowValidationResult]:
        """Get invalid rows from a validation report."""
        return [r for r in report.row_results if r.status == ValidationStatus.INVALID]

    def get_duplicate_rows(
        self,
        report: ValidationReport,
    ) -> List[RowValidationResult]:
        """Get duplicate rows from a validation report."""
        return [r for r in report.row_results if r.status == ValidationStatus.DUPLICATE]

    async def check_existing_domains(
        self,
        domains: List[str],
        db_session: Any,
    ) -> Dict[str, int]:
        """
        Check which domains already exist in the database.

        Args:
            domains: List of normalized domains to check
            db_session: Database session

        Returns:
            Dict mapping domain -> existing target_id
        """
        from sqlalchemy import select
        from ..models.targets import DisplacementTarget

        if not domains:
            return {}

        # Query existing domains
        stmt = select(
            DisplacementTarget.domain,
            DisplacementTarget.id
        ).where(
            DisplacementTarget.domain.in_(domains)
        )

        result = await db_session.execute(stmt)
        rows = result.fetchall()

        return {row[0]: row[1] for row in rows}
