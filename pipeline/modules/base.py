"""
Base Intelligence Module
========================

Abstract base class for all 15 intelligence modules in PartnerForge.

Key Requirements:
- Every module MUST return ModuleResult with SourceCitation attached (P0)
- Modules can run in parallel within their wave
- Modules validate dependencies before execution
- All data points traceable to source

Wave Organization:
- Wave 1: M01-M04 (Foundation) - No dependencies
- Wave 2: M05-M07 (Competitive) - Depends on Wave 1
- Wave 3: M08-M11 (Deep Intel) - Depends on Wave 2
- Wave 4: M12-M15 (Synthesis) - Depends on Wave 3

References:
- docs/INTELLIGENCE_MODULES_SPEC.md
- docs/SOURCE_CITATION_MANDATE.md
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import (
    Any,
    Dict,
    Generic,
    List,
    Optional,
    TypeVar,
    Union,
)
import logging

from pydantic import BaseModel, Field, HttpUrl

from pipeline.models.source import (
    SourceCitation,
    SourceType,
    FreshnessStatus,
    SourcedDataPoint,
)

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class ModuleStatus(str, Enum):
    """Status of module execution."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    TIMEOUT = "timeout"


class ModuleError(Exception):
    """Base exception for module errors."""

    def __init__(
        self,
        message: str,
        module_id: str,
        domain: Optional[str] = None,
        cause: Optional[Exception] = None,
    ):
        self.message = message
        self.module_id = module_id
        self.domain = domain
        self.cause = cause
        super().__init__(f"[{module_id}] {message}")


class DependencyNotMetError(ModuleError):
    """Raised when module dependencies are not satisfied."""

    def __init__(
        self,
        module_id: str,
        missing_dependencies: List[str],
        domain: Optional[str] = None,
    ):
        self.missing_dependencies = missing_dependencies
        super().__init__(
            f"Missing dependencies: {', '.join(missing_dependencies)}",
            module_id,
            domain,
        )


class SourceCitationMissingError(ModuleError):
    """P0 VIOLATION: Raised when module output lacks source citation."""

    def __init__(self, module_id: str, field_name: str, domain: Optional[str] = None):
        self.field_name = field_name
        super().__init__(
            f"P0 VIOLATION: Output field '{field_name}' has no source citation",
            module_id,
            domain,
        )


class DataNotFoundError(ModuleError):
    """Raised when required data cannot be found (e.g., private company financials)."""

    def __init__(
        self,
        module_id: str,
        data_type: str,
        domain: Optional[str] = None,
        reason: Optional[str] = None,
    ):
        self.data_type = data_type
        self.reason = reason
        msg = f"Data not found: {data_type}"
        if reason:
            msg += f" ({reason})"
        super().__init__(msg, module_id, domain)


@dataclass
class ModuleMetrics:
    """Metrics tracked for module execution."""

    execution_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    total_duration_ms: float = 0.0
    last_execution_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None
    last_error: Optional[str] = None

    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.execution_count == 0:
            return 100.0
        return (self.success_count / self.execution_count) * 100

    @property
    def average_duration_ms(self) -> float:
        """Calculate average execution duration."""
        if self.success_count == 0:
            return 0.0
        return self.total_duration_ms / self.success_count


class ModuleResult(BaseModel):
    """
    Standard result wrapper for all module outputs.

    CRITICAL: Every ModuleResult MUST include:
    - primary_citation: The main source for this data (P0 REQUIREMENT)
    - supporting_citations: Additional sources that contributed

    This ensures complete audit trail and data freshness tracking.
    """

    module_id: str = Field(..., description="Module identifier (e.g., 'm01_company_context')")
    domain: str = Field(..., description="Domain that was enriched")
    status: ModuleStatus = Field(default=ModuleStatus.SUCCESS, description="Execution status")

    # Data payload
    data: Dict[str, Any] = Field(default_factory=dict, description="Module-specific output data")

    # Source citations (P0 REQUIREMENT)
    primary_citation: SourceCitation = Field(
        ...,
        description="Primary source citation (REQUIRED - P0 mandate)"
    )
    supporting_citations: List[SourceCitation] = Field(
        default_factory=list,
        description="Additional supporting sources"
    )

    # Metadata
    executed_at: datetime = Field(default_factory=datetime.utcnow, description="Execution timestamp")
    duration_ms: float = Field(default=0.0, description="Execution duration in milliseconds")
    cached: bool = Field(default=False, description="Whether result came from cache")

    # Error handling
    error_message: Optional[str] = Field(default=None, description="Error message if failed")
    error_type: Optional[str] = Field(default=None, description="Error type if failed")

    @property
    def all_citations(self) -> List[SourceCitation]:
        """Get all citations (primary + supporting)."""
        return [self.primary_citation] + self.supporting_citations

    @property
    def is_fresh(self) -> bool:
        """Check if primary citation is still fresh."""
        return self.primary_citation.freshness_status == FreshnessStatus.FRESH

    @property
    def freshness_status(self) -> FreshnessStatus:
        """Get the worst freshness status across all citations."""
        statuses = [c.freshness_status for c in self.all_citations]
        # Return worst status (EXPIRED > STALE > FRESH)
        if FreshnessStatus.EXPIRED in statuses:
            return FreshnessStatus.EXPIRED
        if FreshnessStatus.STALE in statuses:
            return FreshnessStatus.STALE
        return FreshnessStatus.FRESH

    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage."""
        return {
            "module_id": self.module_id,
            "domain": self.domain,
            "status": self.status.value,
            "data": self.data,
            "primary_source_url": str(self.primary_citation.source_url),
            "primary_source_type": self.primary_citation.source_type.value,
            "primary_source_at": self.primary_citation.retrieved_at.isoformat(),
            "supporting_sources": [
                {
                    "url": str(c.source_url),
                    "type": c.source_type.value,
                    "at": c.retrieved_at.isoformat(),
                }
                for c in self.supporting_citations
            ],
            "executed_at": self.executed_at.isoformat(),
            "duration_ms": self.duration_ms,
            "cached": self.cached,
            "error_message": self.error_message,
        }

    @classmethod
    def create_error_result(
        cls,
        module_id: str,
        domain: str,
        error: Exception,
        duration_ms: float = 0.0,
    ) -> "ModuleResult":
        """Create a result for failed execution."""
        # Create a placeholder citation for error results
        placeholder_citation = SourceCitation(
            source_type=SourceType.MANUAL_ENTRY,
            source_url=f"https://partnerforge.internal/error/{module_id}/{domain}",
            retrieved_at=datetime.utcnow(),
            notes=f"Error placeholder: {str(error)[:200]}",
            confidence_score=0.0,
        )

        return cls(
            module_id=module_id,
            domain=domain,
            status=ModuleStatus.FAILED,
            data={},
            primary_citation=placeholder_citation,
            duration_ms=duration_ms,
            error_message=str(error),
            error_type=type(error).__name__,
        )


class BaseModule(ABC):
    """
    Abstract base class for all intelligence modules.

    Provides:
    - Dependency validation
    - Source citation enforcement (P0)
    - Metrics collection
    - Error handling
    - Caching support

    Subclasses MUST implement:
    - execute(): Main enrichment logic
    - validate_output(): Validate module-specific output

    Module IDs follow pattern: m{NN}_{name}
    - m01_company_context
    - m02_technology_stack
    - m03_traffic_analysis
    - m04_financial_profile
    - ... etc.

    Example:
        class M01CompanyContext(BaseModule):
            MODULE_ID = "m01_company_context"
            MODULE_NAME = "Company Context"
            WAVE = 1

            async def execute(self, domain: str, context: dict = None) -> ModuleResult:
                # Fetch data from sources
                # Transform to output schema
                # Return with citation
                pass
    """

    # Module identification (override in subclass)
    MODULE_ID: str = "base"
    MODULE_NAME: str = "Base Module"
    DESCRIPTION: str = "Abstract base module"

    # Wave assignment (1-4)
    WAVE: int = 1

    # Dependencies (list of module IDs that must complete first)
    DEPENDS_ON: List[str] = []

    # Primary data source for this module
    PRIMARY_SOURCE_TYPE: SourceType = SourceType.WEBSEARCH

    # Database table for output
    OUTPUT_TABLE: str = ""

    # Timeout for execution (seconds)
    TIMEOUT_SECONDS: int = 60

    def __init__(self):
        """Initialize the module."""
        self.logger = logging.getLogger(f"{__name__}.{self.MODULE_ID}")
        self.metrics = ModuleMetrics()

    def validate_dependencies(self, context: Dict[str, ModuleResult]) -> bool:
        """
        Validate that all required dependencies are present and successful.

        Args:
            context: Dict mapping module_id -> ModuleResult for completed modules

        Returns:
            True if all dependencies are met

        Raises:
            DependencyNotMetError if any dependency is missing or failed
        """
        missing = []
        failed = []

        for dep_id in self.DEPENDS_ON:
            if dep_id not in context:
                missing.append(dep_id)
            elif context[dep_id].status != ModuleStatus.SUCCESS:
                failed.append(dep_id)

        if missing:
            raise DependencyNotMetError(self.MODULE_ID, missing)

        if failed:
            raise DependencyNotMetError(
                self.MODULE_ID,
                [f"{d} (failed)" for d in failed],
            )

        return True

    @abstractmethod
    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute the module enrichment for a domain.

        This is the main entry point. Subclasses MUST implement this method.

        Args:
            domain: The domain to enrich (e.g., "costco.com")
            context: Results from previous modules (for dependencies)

        Returns:
            ModuleResult with data and source citations

        Raises:
            DependencyNotMetError: If required dependencies missing
            SourceCitationMissingError: If output lacks required citations
            DataNotFoundError: If required data cannot be found
        """
        pass

    @abstractmethod
    def validate_output(self, result: ModuleResult) -> bool:
        """
        Validate module-specific output schema and required fields.

        Subclasses MUST implement this to ensure output integrity.

        Args:
            result: The ModuleResult to validate

        Returns:
            True if valid

        Raises:
            ValueError if validation fails
        """
        pass

    def _create_citation(
        self,
        source_type: SourceType,
        source_url: str,
        api_endpoint: Optional[str] = None,
        confidence: float = 1.0,
        notes: Optional[str] = None,
    ) -> SourceCitation:
        """
        Helper to create a source citation.

        Args:
            source_type: Type of source
            source_url: URL of the source
            api_endpoint: API endpoint if applicable
            confidence: Confidence score (0.0-1.0)
            notes: Additional notes

        Returns:
            SourceCitation instance
        """
        return SourceCitation.from_api_response(
            source_type=source_type,
            source_url=source_url,
            api_endpoint=api_endpoint,
            confidence=confidence,
        )

    def _create_result(
        self,
        domain: str,
        data: Dict[str, Any],
        primary_citation: SourceCitation,
        supporting_citations: Optional[List[SourceCitation]] = None,
        duration_ms: float = 0.0,
        cached: bool = False,
    ) -> ModuleResult:
        """
        Helper to create a successful ModuleResult.

        Args:
            domain: The domain that was enriched
            data: Module-specific output data
            primary_citation: Main source citation (REQUIRED)
            supporting_citations: Additional supporting sources
            duration_ms: Execution duration
            cached: Whether from cache

        Returns:
            ModuleResult instance
        """
        return ModuleResult(
            module_id=self.MODULE_ID,
            domain=domain,
            status=ModuleStatus.SUCCESS,
            data=data,
            primary_citation=primary_citation,
            supporting_citations=supporting_citations or [],
            duration_ms=duration_ms,
            cached=cached,
        )

    def _create_error_result(
        self,
        domain: str,
        error: Exception,
        duration_ms: float = 0.0,
    ) -> ModuleResult:
        """
        Helper to create an error ModuleResult.

        Args:
            domain: The domain that was being enriched
            error: The exception that occurred
            duration_ms: Execution duration before failure

        Returns:
            ModuleResult with error details
        """
        return ModuleResult.create_error_result(
            module_id=self.MODULE_ID,
            domain=domain,
            error=error,
            duration_ms=duration_ms,
        )

    def _record_execution(
        self,
        success: bool,
        duration_ms: float,
        error: Optional[str] = None,
    ) -> None:
        """Record execution metrics."""
        self.metrics.execution_count += 1
        self.metrics.last_execution_at = datetime.utcnow()

        if success:
            self.metrics.success_count += 1
            self.metrics.total_duration_ms += duration_ms
            self.metrics.last_success_at = datetime.utcnow()
        else:
            self.metrics.failure_count += 1
            self.metrics.last_failure_at = datetime.utcnow()
            self.metrics.last_error = error

    def get_metrics(self) -> Dict[str, Any]:
        """Get current module metrics."""
        return {
            "module_id": self.MODULE_ID,
            "module_name": self.MODULE_NAME,
            "wave": self.WAVE,
            "execution_count": self.metrics.execution_count,
            "success_count": self.metrics.success_count,
            "failure_count": self.metrics.failure_count,
            "success_rate": self.metrics.success_rate,
            "average_duration_ms": self.metrics.average_duration_ms,
            "last_execution_at": (
                self.metrics.last_execution_at.isoformat()
                if self.metrics.last_execution_at
                else None
            ),
            "last_error": self.metrics.last_error,
        }

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.MODULE_ID}, wave={self.WAVE})>"


# =============================================================================
# Module Registry
# =============================================================================

_MODULE_REGISTRY: Dict[str, type] = {}


def register_module(cls: type) -> type:
    """
    Decorator to register a module class.

    Usage:
        @register_module
        class M01CompanyContext(BaseModule):
            MODULE_ID = "m01_company_context"
            ...
    """
    _MODULE_REGISTRY[cls.MODULE_ID] = cls
    logger.info(f"Registered module: {cls.MODULE_ID} ({cls.MODULE_NAME})")
    return cls


def get_module_class(module_id: str) -> Optional[type]:
    """Get a registered module class by ID."""
    return _MODULE_REGISTRY.get(module_id)


def get_all_modules() -> Dict[str, type]:
    """Get all registered modules."""
    return _MODULE_REGISTRY.copy()


def get_modules_by_wave(wave: int) -> List[type]:
    """Get all modules in a specific wave."""
    return [cls for cls in _MODULE_REGISTRY.values() if cls.WAVE == wave]


def get_wave_order() -> List[List[str]]:
    """
    Get module IDs organized by wave execution order.

    Returns:
        List of lists, where each inner list is modules to run in parallel
    """
    waves: Dict[int, List[str]] = {1: [], 2: [], 3: [], 4: []}
    for module_id, cls in _MODULE_REGISTRY.items():
        if cls.WAVE in waves:
            waves[cls.WAVE].append(module_id)
    return [waves[i] for i in [1, 2, 3, 4]]


def instantiate_module(module_id: str) -> Optional[BaseModule]:
    """Instantiate a module by ID."""
    cls = get_module_class(module_id)
    if cls:
        return cls()
    return None
