"""
PartnerForge Base Intelligence Module

Abstract base class for all 15 intelligence modules.
Enforces source citation mandate and provides common functionality.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Any, TypeVar, Generic
from pydantic import BaseModel, HttpUrl, field_validator
import logging

from ..services.validation import (
    validate_enrichment_result,
    validate_source_freshness,
    SourceFreshnessError,
    MissingSourceError,
)
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

T = TypeVar("T", bound=BaseModel)


class SourceInfo(BaseModel):
    """Source information - REQUIRED for every data point."""

    url: HttpUrl
    date: datetime
    type: str  # api, webpage, document, transcript

    @field_validator("date")
    @classmethod
    def validate_freshness(cls, v: datetime) -> datetime:
        """Enforce 12-month freshness rule."""
        validate_source_freshness(v)
        return v


class ModuleResult(BaseModel, Generic[T]):
    """
    Standard result wrapper for all module outputs.

    Every module MUST return results in this format to ensure
    source citation compliance.
    """

    module_id: str
    domain: str
    data: T
    source: SourceInfo
    enriched_at: datetime = datetime.now()
    is_cached: bool = False
    cache_expires_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """Convert to dictionary with source validation."""
        result = {
            "module": self.module_id,
            "domain": self.domain,
            "data": self.data.model_dump() if hasattr(self.data, "model_dump") else self.data,
            "source_url": str(self.source.url),
            "source_date": self.source.date.isoformat(),
            "source_type": self.source.type,
            "enriched_at": self.enriched_at.isoformat(),
            "is_cached": self.is_cached,
        }
        # Final validation checkpoint
        validate_enrichment_result(result, self.module_id)
        return result


class BaseIntelligenceModule(ABC):
    """
    Abstract base class for all intelligence modules.

    All 15 modules inherit from this class to ensure:
    1. Source citation mandate compliance
    2. Consistent error handling
    3. Caching support
    4. Metrics collection

    Module IDs:
    - m01_company_context
    - m02_tech_stack
    - m03_traffic
    - m04_financials
    - m05_competitors
    - m06_hiring
    - m07_strategic
    - m08_investor
    - m09_executive
    - m10_buying_committee
    - m11_displacement
    - m12_case_study
    - m13_icp_priority
    - m14_signal_scoring
    - m15_strategic_brief
    """

    # Module identifier (override in subclass)
    MODULE_ID: str = "base"
    MODULE_NAME: str = "Base Module"

    # Wave assignment (1-4)
    WAVE: int = 1

    # Dependencies (list of module IDs)
    DEPENDS_ON: list[str] = []

    # Source type for this module
    SOURCE_TYPE: str = "default"

    # Cache TTL in seconds
    CACHE_TTL: int = 86400  # 24 hours default

    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.{self.MODULE_ID}")

    @abstractmethod
    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform enrichment for a domain.

        This is the main entry point for the module. Subclasses MUST
        implement this method.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with data and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        pass

    @abstractmethod
    async def fetch_data(self, domain: str) -> dict:
        """
        Fetch raw data from external sources.

        This method should call external APIs (BuiltWith, SimilarWeb, etc.)
        and return raw data. Source URL and date MUST be included.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with raw data AND source information
        """
        pass

    @abstractmethod
    async def transform_data(self, raw_data: dict) -> dict:
        """
        Transform raw data into module-specific schema.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching module schema
        """
        pass

    async def get_cached(self, domain: str) -> Optional[ModuleResult]:
        """
        Get cached result if available and fresh.

        Override this method to implement caching.

        Args:
            domain: The domain to look up

        Returns:
            Cached ModuleResult or None
        """
        # Default: no caching (override in subclass)
        return None

    async def save_to_cache(self, result: ModuleResult) -> None:
        """
        Save result to cache.

        Override this method to implement caching.

        Args:
            result: The result to cache
        """
        # Default: no caching (override in subclass)
        pass

    async def save_to_db(self, result: ModuleResult, db_session) -> None:
        """
        Save result to database.

        Override this method to implement persistence.

        Args:
            result: The result to save
            db_session: SQLAlchemy async session
        """
        # Default: no persistence (override in subclass)
        pass

    def validate_dependencies(self, available_data: dict) -> bool:
        """
        Validate that all dependencies are satisfied.

        Args:
            available_data: Dict of module_id -> ModuleResult

        Returns:
            True if all dependencies are available
        """
        for dep in self.DEPENDS_ON:
            if dep not in available_data:
                self.logger.warning(f"Missing dependency: {dep}")
                return False
        return True

    def _create_source_info(self, url: str, date: datetime, source_type: Optional[str] = None) -> SourceInfo:
        """
        Create a SourceInfo object with validation.

        Args:
            url: Source URL
            date: Source date
            source_type: Override default source type

        Returns:
            Validated SourceInfo

        Raises:
            SourceFreshnessError: If date is too old
        """
        return SourceInfo(
            url=url,
            date=date,
            type=source_type or self.SOURCE_TYPE,
        )

    def _create_result(
        self,
        domain: str,
        data: Any,
        source_url: str,
        source_date: datetime,
        source_type: Optional[str] = None,
        is_cached: bool = False,
    ) -> ModuleResult:
        """
        Create a ModuleResult with proper source citation.

        This is the recommended way to create results.

        Args:
            domain: The domain
            data: Module-specific data
            source_url: Primary source URL
            source_date: Source date
            source_type: Override default source type
            is_cached: Whether result is from cache

        Returns:
            Validated ModuleResult
        """
        source = self._create_source_info(source_url, source_date, source_type)

        return ModuleResult(
            module_id=self.MODULE_ID,
            domain=domain,
            data=data,
            source=source,
            is_cached=is_cached,
        )


# =============================================================================
# Module Registry
# =============================================================================

_MODULE_REGISTRY: dict[str, type[BaseIntelligenceModule]] = {}


def register_module(cls: type[BaseIntelligenceModule]) -> type[BaseIntelligenceModule]:
    """
    Decorator to register a module class.

    Usage:
        @register_module
        class M01CompanyContext(BaseIntelligenceModule):
            MODULE_ID = "m01_company_context"
            ...
    """
    _MODULE_REGISTRY[cls.MODULE_ID] = cls
    logger.info(f"Registered module: {cls.MODULE_ID} ({cls.MODULE_NAME})")
    return cls


def get_module_class(module_id: str) -> Optional[type[BaseIntelligenceModule]]:
    """Get a registered module class by ID."""
    return _MODULE_REGISTRY.get(module_id)


def get_all_modules() -> dict[str, type[BaseIntelligenceModule]]:
    """Get all registered modules."""
    return _MODULE_REGISTRY.copy()


def get_modules_by_wave(wave: int) -> list[type[BaseIntelligenceModule]]:
    """Get all modules in a specific wave."""
    return [cls for cls in _MODULE_REGISTRY.values() if cls.WAVE == wave]


def get_wave_order() -> list[list[str]]:
    """
    Get module IDs organized by wave execution order.

    Returns:
        List of lists, where each inner list is modules to run in parallel
    """
    waves = {1: [], 2: [], 3: [], 4: []}
    for module_id, cls in _MODULE_REGISTRY.items():
        if cls.WAVE in waves:
            waves[cls.WAVE].append(module_id)
    return [waves[i] for i in [1, 2, 3, 4]]
