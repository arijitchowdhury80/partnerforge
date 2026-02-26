"""
PartnerForge Repository Layer

Provides async CRUD operations with source citation enforcement.

Repositories:
- BaseRepository: Generic async CRUD operations
- CompanyRepository: Algolia customer management
- TargetRepository: Displacement target operations
- IntelligenceRepository: Intelligence module data access

Usage:
    from app.repositories import CompanyRepository, TargetRepository

    async with get_db_context() as db:
        company_repo = CompanyRepository(db)
        companies = await company_repo.list(limit=10)

Source Citation Mandate:
    Every data point stored through repositories MUST have:
    - source_url: URL where data was obtained
    - source_date: Date of the source (max 12 months old)
"""

from .base import (
    BaseRepository,
    RepositoryError,
    NotFoundError,
    DuplicateError,
    ValidationError,
    SourceCitationError,
    FilterOperator,
)
from .company import CompanyRepository
from .target import TargetRepository
from .intelligence import IntelligenceRepository

__all__ = [
    # Base
    "BaseRepository",
    "RepositoryError",
    "NotFoundError",
    "DuplicateError",
    "ValidationError",
    "SourceCitationError",
    "FilterOperator",
    # Domain-specific
    "CompanyRepository",
    "TargetRepository",
    "IntelligenceRepository",
]
