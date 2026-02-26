"""
Column Mapping Service
======================

Auto-detect column mappings from CSV headers to standard PartnerForge fields.

Supports common export formats:
- Salesforce
- Demandbase
- 6sense
- HubSpot
- Custom Excel

Key Features:
- Fuzzy matching of column names
- Source system detection from column patterns
- Confidence scoring for mappings
- Manual override support
"""

import re
import logging
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class SourceSystem(str, Enum):
    """Detected source system for the uploaded file."""
    SALESFORCE = "salesforce"
    DEMANDBASE = "demandbase"
    SIXSENSE = "6sense"
    HUBSPOT = "hubspot"
    ZOOMINFO = "zoominfo"
    CLEARBIT = "clearbit"
    MANUAL = "manual"
    UNKNOWN = "unknown"


class MappingConfidence(str, Enum):
    """Confidence level of column mapping."""
    HIGH = "high"      # Exact match or very close
    MEDIUM = "medium"  # Fuzzy match with reasonable confidence
    LOW = "low"        # Best guess, needs confirmation


@dataclass
class ColumnMapping:
    """Represents a mapping from CSV column to standard field."""
    csv_column: str
    standard_field: str
    confidence: MappingConfidence
    match_reason: str


@dataclass
class MappingResult:
    """Result of column mapping operation."""
    mappings: Dict[str, str]  # standard_field -> csv_column
    detected_source: SourceSystem
    overall_confidence: MappingConfidence
    has_domain_column: bool
    unmapped_columns: List[str]
    all_mappings: List[ColumnMapping]  # Detailed mapping info
    suggestions: Dict[str, List[str]]  # For ambiguous mappings
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        """Convert to dictionary for API response."""
        return {
            "mappings": self.mappings,
            "detected_source": self.detected_source.value,
            "overall_confidence": self.overall_confidence.value,
            "has_domain_column": self.has_domain_column,
            "unmapped_columns": self.unmapped_columns,
            "suggestions": self.suggestions,
            "warnings": self.warnings,
        }


# Standard column mapping configuration
# Format: standard_field -> [list of possible CSV column names]
COLUMN_MAPPINGS: Dict[str, List[str]] = {
    # Domain (REQUIRED - one of these must match)
    "domain": [
        "domain", "website", "company_website", "url", "web",
        "company_domain", "site", "webpage", "website_url",
        "company_url", "web_address", "domain_name",
    ],

    # Company name
    "company_name": [
        "account_name", "company", "company_name", "name", "account",
        "organization", "org", "business_name", "company_legal_name",
        "legal_name", "business", "account_name",
    ],

    # External IDs
    "salesforce_id": [
        "account_id", "18_digit_account_id", "sf_id", "salesforce_id",
        "sfdc_id", "id", "salesforce_account_id", "sf_account_id",
        "18_digit_id", "account_id__c",
    ],
    "demandbase_id": [
        "abm_id", "demandbase_id", "db_id", "demandbase_company_id",
        "demandbase_account_id", "db_company_id",
    ],
    "hubspot_id": [
        "hubspot_id", "hs_id", "hubspot_company_id", "hs_company_id",
        "hubspot_object_id", "hs_object_id",
    ],
    "sixsense_id": [
        "6sense_id", "sixsense_id", "6s_id", "six_sense_id",
    ],

    # Pre-existing data (preserved, not overwritten)
    "revenue": [
        "revenue", "annual_revenue", "arr", "expected_revenue",
        "company_revenue", "yearly_revenue", "total_revenue",
        "annualrevenue", "annual_revenue__c",
    ],
    "traffic": [
        "traffic", "monthly_visits", "visits", "monthly_traffic",
        "web_traffic", "monthly_visitors", "website_traffic",
        "site_traffic", "estimated_visits",
    ],
    "industry": [
        "industry", "vertical", "demandbase_industry", "naics_description",
        "sector", "market", "demandbase_sub_industry", "sic_description",
        "industry_category", "primary_industry",
    ],
    "employee_count": [
        "employees", "employee_count", "company_size", "headcount",
        "num_employees", "staff_count", "employee_range",
        "number_of_employees", "employeecount", "numberofemployees",
    ],

    # Assignment
    "owner": [
        "account_owner", "owner", "sales_rep", "ae",
        "demandbase_account_owner_name", "assigned_to", "rep",
        "owner_name", "sales_owner", "account_executive",
    ],
    "region": [
        "sales_region", "region", "territory", "account_region",
        "geo", "geography", "sales_territory", "area",
    ],

    # Location
    "country": [
        "country", "country_name", "hq_country", "headquarters_country",
        "billing_country", "company_country",
    ],
    "state": [
        "state", "state_province", "hq_state", "billing_state",
        "province", "state_region",
    ],
    "city": [
        "city", "hq_city", "billing_city", "headquarters_city",
    ],

    # ABM context
    "journey_stage": [
        "journey_stage", "stage", "abx_status", "buyer_stage",
        "funnel_stage", "sales_stage", "buying_stage",
    ],
    "engagement_score": [
        "engagement_points", "engagement_score", "score",
        "intent_score", "abm_score", "engagement_points_3_mo",
        "engagement_minutes", "account_score",
    ],
    "target_account": [
        "target_account", "is_target", "named_account", "tier",
        "account_tier", "target_tier", "priority_tier",
    ],
    "intent_topics": [
        "intent_topics", "trending_topics", "surge_topics",
        "intent_keywords", "active_topics",
    ],

    # Ticker (for public companies)
    "ticker": [
        "ticker_symbol", "ticker", "stock_symbol", "symbol",
        "stock_ticker", "trading_symbol",
    ],

    # Technology indicators (from Demandbase/ZoomInfo)
    "tech_stack": [
        "technologies", "tech_stack", "technology_stack",
        "installed_technologies", "tech_tools",
    ],
}


# Source system detection patterns
# These are column patterns unique to each source
SOURCE_PATTERNS: Dict[SourceSystem, List[str]] = {
    SourceSystem.SALESFORCE: [
        "18_digit_account_id", "account_id", "sf_id", "salesforce_id",
        "owner_id", "billing_", "shipping_", "__c",  # Custom field suffix
    ],
    SourceSystem.DEMANDBASE: [
        "abm_id", "demandbase_", "db_", "journey_stage",
        "engagement_points", "intent_", "_technology",
        "demandbase_account_owner", "pipeline_predict",
    ],
    SourceSystem.SIXSENSE: [
        "6sense_", "sixsense_", "6s_", "buying_stage",
        "profile_score", "intent_score", "segment_",
    ],
    SourceSystem.HUBSPOT: [
        "hubspot_", "hs_", "hubspot_company_id",
        "hs_object_id", "hs_analytics_",
    ],
    SourceSystem.ZOOMINFO: [
        "zoominfo_", "zi_", "zoominfo_company_id",
        "company_hq_", "sic_code", "naics_code",
    ],
    SourceSystem.CLEARBIT: [
        "clearbit_", "cb_", "company_domain",
        "company_legal_name", "company_tags",
    ],
}


class ColumnMappingService:
    """
    Auto-detect and manage column mappings for CSV uploads.

    Features:
    - Intelligent column name matching
    - Source system detection
    - Confidence scoring
    - Support for custom mappings

    Usage:
        service = ColumnMappingService()
        result = service.detect_mappings(headers)

        if result.has_domain_column:
            # Ready to proceed
            print(f"Domain column: {result.mappings['domain']}")
        else:
            # Need user to specify domain column
            print("Please select the domain column")
    """

    def __init__(
        self,
        custom_mappings: Optional[Dict[str, List[str]]] = None,
    ):
        """
        Initialize with optional custom mappings.

        Args:
            custom_mappings: Additional field -> column name mappings
        """
        self.mappings = COLUMN_MAPPINGS.copy()
        if custom_mappings:
            for field, columns in custom_mappings.items():
                if field in self.mappings:
                    self.mappings[field] = columns + self.mappings[field]
                else:
                    self.mappings[field] = columns

    def detect_mappings(self, headers: List[str]) -> MappingResult:
        """
        Auto-detect column mappings from CSV headers.

        Args:
            headers: List of CSV column header strings

        Returns:
            MappingResult with detected mappings and confidence
        """
        logger.info(f"Detecting mappings for {len(headers)} columns")

        # Normalize headers for matching
        normalized_map = self._normalize_headers(headers)

        # Detect source system first
        detected_source = self._detect_source_system(headers)
        logger.debug(f"Detected source system: {detected_source.value}")

        # Find mappings
        mappings: Dict[str, str] = {}
        all_mappings: List[ColumnMapping] = []
        mapped_columns: Set[str] = set()
        suggestions: Dict[str, List[str]] = {}

        for standard_field, candidates in self.mappings.items():
            mapping = self._find_best_match(
                standard_field,
                candidates,
                normalized_map,
                mapped_columns,
            )

            if mapping:
                mappings[standard_field] = mapping.csv_column
                mapped_columns.add(mapping.csv_column)
                all_mappings.append(mapping)

                # Track alternative matches for suggestions
                alternatives = self._find_alternative_matches(
                    candidates,
                    normalized_map,
                    mapped_columns,
                )
                if alternatives:
                    suggestions[standard_field] = alternatives

        # Calculate unmapped columns
        unmapped = [h for h in headers if h not in mapped_columns]

        # Determine overall confidence
        overall_confidence = self._calculate_overall_confidence(all_mappings)

        # Check for domain column
        has_domain = "domain" in mappings

        # Generate warnings
        warnings = []
        if not has_domain:
            warnings.append("No domain column detected. Please specify the domain column manually.")
        if len(unmapped) > len(headers) * 0.5:
            warnings.append(f"{len(unmapped)} columns could not be automatically mapped.")

        result = MappingResult(
            mappings=mappings,
            detected_source=detected_source,
            overall_confidence=overall_confidence,
            has_domain_column=has_domain,
            unmapped_columns=unmapped,
            all_mappings=all_mappings,
            suggestions=suggestions,
            warnings=warnings,
        )

        logger.info(
            f"Mapping complete: {len(mappings)} mapped, {len(unmapped)} unmapped, "
            f"confidence={overall_confidence.value}, has_domain={has_domain}"
        )

        return result

    def update_mapping(
        self,
        current_result: MappingResult,
        field: str,
        csv_column: str,
    ) -> MappingResult:
        """
        Update a specific mapping manually.

        Args:
            current_result: Current mapping result
            field: Standard field name to update
            csv_column: CSV column to map to

        Returns:
            Updated MappingResult
        """
        new_mappings = current_result.mappings.copy()
        new_mappings[field] = csv_column

        # Update unmapped columns
        new_unmapped = [c for c in current_result.unmapped_columns if c != csv_column]

        # Recalculate domain status
        has_domain = "domain" in new_mappings

        return MappingResult(
            mappings=new_mappings,
            detected_source=current_result.detected_source,
            overall_confidence=MappingConfidence.HIGH,  # User confirmed
            has_domain_column=has_domain,
            unmapped_columns=new_unmapped,
            all_mappings=current_result.all_mappings,
            suggestions=current_result.suggestions,
            warnings=[w for w in current_result.warnings if "domain" not in w.lower()] if has_domain else current_result.warnings,
        )

    def _normalize_headers(self, headers: List[str]) -> Dict[str, str]:
        """
        Create normalized header map for matching.

        Normalizes by:
        - Lowercasing
        - Replacing spaces/hyphens with underscores
        - Removing special characters

        Returns:
            Dict mapping normalized name to original header
        """
        normalized: Dict[str, str] = {}

        for header in headers:
            # Original
            normalized[header.lower()] = header

            # Normalized version
            norm = header.lower()
            norm = re.sub(r'[\s\-\.]+', '_', norm)  # Replace spaces, hyphens, dots
            norm = re.sub(r'[^\w_]', '', norm)  # Remove other special chars
            norm = re.sub(r'_+', '_', norm)  # Collapse multiple underscores
            norm = norm.strip('_')

            if norm and norm != header.lower():
                normalized[norm] = header

        return normalized

    def _detect_source_system(self, headers: List[str]) -> SourceSystem:
        """
        Detect the source system based on column name patterns.

        Args:
            headers: List of CSV column headers

        Returns:
            Detected SourceSystem enum
        """
        headers_lower = [h.lower() for h in headers]
        headers_text = ' '.join(headers_lower)

        scores: Dict[SourceSystem, int] = {source: 0 for source in SOURCE_PATTERNS}

        for source, patterns in SOURCE_PATTERNS.items():
            for pattern in patterns:
                pattern_lower = pattern.lower()
                # Check for exact column match or substring
                if any(pattern_lower in h for h in headers_lower):
                    scores[source] += 2
                elif pattern_lower in headers_text:
                    scores[source] += 1

        # Find best match
        best_source = max(scores.items(), key=lambda x: x[1])

        if best_source[1] >= 2:
            return best_source[0]

        return SourceSystem.UNKNOWN

    def _find_best_match(
        self,
        standard_field: str,
        candidates: List[str],
        normalized_map: Dict[str, str],
        already_mapped: Set[str],
    ) -> Optional[ColumnMapping]:
        """
        Find the best matching column for a standard field.

        Args:
            standard_field: Standard field name
            candidates: List of possible column names
            normalized_map: Normalized header -> original header map
            already_mapped: Set of columns already mapped

        Returns:
            ColumnMapping if match found, None otherwise
        """
        for candidate in candidates:
            candidate_norm = candidate.lower().replace(' ', '_').replace('-', '_')

            # Check exact normalized match
            if candidate_norm in normalized_map:
                original = normalized_map[candidate_norm]
                if original not in already_mapped:
                    return ColumnMapping(
                        csv_column=original,
                        standard_field=standard_field,
                        confidence=MappingConfidence.HIGH,
                        match_reason=f"Exact match: '{candidate}'",
                    )

            # Check partial match (candidate is substring of header)
            for norm_header, original in normalized_map.items():
                if original in already_mapped:
                    continue

                if candidate_norm in norm_header or norm_header in candidate_norm:
                    return ColumnMapping(
                        csv_column=original,
                        standard_field=standard_field,
                        confidence=MappingConfidence.MEDIUM,
                        match_reason=f"Partial match: '{candidate}' ~ '{original}'",
                    )

        # Try fuzzy matching as last resort
        for norm_header, original in normalized_map.items():
            if original in already_mapped:
                continue

            for candidate in candidates:
                candidate_norm = candidate.lower().replace(' ', '_').replace('-', '_')

                # Check if they share significant words
                candidate_words = set(candidate_norm.split('_'))
                header_words = set(norm_header.split('_'))
                common_words = candidate_words & header_words

                # Need at least one meaningful common word
                meaningful_words = {w for w in common_words if len(w) > 2}
                if meaningful_words:
                    return ColumnMapping(
                        csv_column=original,
                        standard_field=standard_field,
                        confidence=MappingConfidence.LOW,
                        match_reason=f"Fuzzy match: common words {meaningful_words}",
                    )

        return None

    def _find_alternative_matches(
        self,
        candidates: List[str],
        normalized_map: Dict[str, str],
        already_mapped: Set[str],
    ) -> List[str]:
        """Find alternative column matches for suggestions."""
        alternatives = []

        for candidate in candidates[1:]:  # Skip first (best) match
            candidate_norm = candidate.lower().replace(' ', '_').replace('-', '_')

            for norm_header, original in normalized_map.items():
                if original in already_mapped:
                    continue
                if candidate_norm in norm_header and original not in alternatives:
                    alternatives.append(original)
                    if len(alternatives) >= 3:
                        return alternatives

        return alternatives

    def _calculate_overall_confidence(
        self,
        mappings: List[ColumnMapping],
    ) -> MappingConfidence:
        """Calculate overall mapping confidence."""
        if not mappings:
            return MappingConfidence.LOW

        # Check for domain mapping first (critical)
        domain_mapping = next(
            (m for m in mappings if m.standard_field == "domain"),
            None
        )
        if not domain_mapping:
            return MappingConfidence.LOW

        # Count confidence levels
        high_count = sum(1 for m in mappings if m.confidence == MappingConfidence.HIGH)
        total = len(mappings)

        if high_count >= total * 0.7:
            return MappingConfidence.HIGH
        elif high_count >= total * 0.4:
            return MappingConfidence.MEDIUM
        else:
            return MappingConfidence.LOW

    def get_required_fields(self) -> List[str]:
        """Get list of required fields."""
        return ["domain"]

    def get_recommended_fields(self) -> List[str]:
        """Get list of recommended (but optional) fields."""
        return [
            "company_name",
            "salesforce_id",
            "revenue",
            "industry",
            "employee_count",
        ]

    def validate_mapping(
        self,
        mappings: Dict[str, str],
        headers: List[str],
    ) -> Tuple[bool, List[str]]:
        """
        Validate a mapping configuration.

        Args:
            mappings: Proposed field -> column mappings
            headers: Original CSV headers

        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []

        # Check required fields
        if "domain" not in mappings:
            errors.append("Domain column is required")
        elif mappings["domain"] not in headers:
            errors.append(f"Domain column '{mappings['domain']}' not found in CSV headers")

        # Check for duplicate mappings
        used_columns = list(mappings.values())
        duplicates = [col for col in set(used_columns) if used_columns.count(col) > 1]
        if duplicates:
            errors.append(f"Columns mapped to multiple fields: {', '.join(duplicates)}")

        # Check all mapped columns exist
        for field, column in mappings.items():
            if column not in headers:
                errors.append(f"Column '{column}' for field '{field}' not found in CSV")

        return len(errors) == 0, errors
