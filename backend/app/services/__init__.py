"""
PartnerForge Services

Business logic services for intelligence processing and management.
"""

from .validation import (
    SourceCitation,
    SourceFreshnessError,
    MissingSourceError,
    validate_source_freshness,
    validate_enrichment_result,
    validate_data_point,
    get_freshness_status,
)
from .versioning import VersioningService

# CSV Upload Services
from .csv_parser import (
    CSVParserService,
    CSVParseError,
    EncodingDetectionError,
    FileTooLargeError,
    TooManyRowsError,
    InvalidCSVError,
    ParseResult,
    ParsedRow,
)
from .column_mapping import (
    ColumnMappingService,
    SourceSystem,
    MappingConfidence,
    MappingResult,
    ColumnMapping,
    COLUMN_MAPPINGS,
)
from .csv_validation import (
    CSVValidationService,
    ValidationErrorType,
    ValidationStatus,
    ValidationError,
    RowValidationResult,
    ValidationReport,
)
from .list_enrichment import (
    ListEnrichmentService,
    EnrichmentPriority,
    EnrichmentStatus,
    EnrichmentModule,
    EnrichmentJob,
    EnrichmentItem,
    EnrichmentProgress,
    DEFAULT_MODULES,
    ALL_MODULES,
)

# Phase 2 Services - Backend Infrastructure
from .change_detection import (
    ChangeDetectionService,
    CHANGE_CATEGORIES,
    SIGNIFICANCE_LEVELS,
)
from .alerts import (
    AlertService,
    SIGNIFICANCE_HIERARCHY,
)
from .budget import (
    BudgetService,
    DEFAULT_API_COSTS,
)
from .orchestrator import (
    EnrichmentOrchestrator,
    MODULE_DEFINITIONS,
    get_module_info,
    get_all_modules,
    get_modules_by_wave,
)

# Domain Enrichment (Real API Calls)
from .enrichment import (
    EnrichmentService,
    get_enrichment_service,
)

__all__ = [
    # Source Validation
    "SourceCitation",
    "SourceFreshnessError",
    "MissingSourceError",
    "validate_source_freshness",
    "validate_enrichment_result",
    "validate_data_point",
    "get_freshness_status",
    # Versioning
    "VersioningService",
    # CSV Parser
    "CSVParserService",
    "CSVParseError",
    "EncodingDetectionError",
    "FileTooLargeError",
    "TooManyRowsError",
    "InvalidCSVError",
    "ParseResult",
    "ParsedRow",
    # Column Mapping
    "ColumnMappingService",
    "SourceSystem",
    "MappingConfidence",
    "MappingResult",
    "ColumnMapping",
    "COLUMN_MAPPINGS",
    # CSV Validation
    "CSVValidationService",
    "ValidationErrorType",
    "ValidationStatus",
    "ValidationError",
    "RowValidationResult",
    "ValidationReport",
    # List Enrichment
    "ListEnrichmentService",
    "EnrichmentPriority",
    "EnrichmentStatus",
    "EnrichmentModule",
    "EnrichmentJob",
    "EnrichmentItem",
    "EnrichmentProgress",
    "DEFAULT_MODULES",
    "ALL_MODULES",
    # Change Detection
    "ChangeDetectionService",
    "CHANGE_CATEGORIES",
    "SIGNIFICANCE_LEVELS",
    # Alerts
    "AlertService",
    "SIGNIFICANCE_HIERARCHY",
    # Budget
    "BudgetService",
    "DEFAULT_API_COSTS",
    # Orchestrator
    "EnrichmentOrchestrator",
    "MODULE_DEFINITIONS",
    "get_module_info",
    "get_all_modules",
    "get_modules_by_wave",
    # Domain Enrichment
    "EnrichmentService",
    "get_enrichment_service",
]
