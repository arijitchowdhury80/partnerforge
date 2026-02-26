"""
Base Repository - Generic Async CRUD Operations

Provides a foundation for all domain-specific repositories with:
- Type-safe async CRUD operations
- Flexible filtering and pagination
- Source citation validation
- Soft delete support
- Audit logging hooks

Usage:
    class UserRepository(BaseRepository[User]):
        model = User

        def validate_source_citation(self, data: dict) -> bool:
            # Users don't require source citations
            return True

    repo = UserRepository(session)
    user = await repo.get_by_id(1)
    users = await repo.list(filters={"is_active": True}, limit=10)
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from enum import Enum
from typing import (
    Any,
    Dict,
    Generic,
    List,
    Optional,
    Sequence,
    Tuple,
    Type,
    TypeVar,
    Union,
)
import logging

from sqlalchemy import and_, or_, select, update, delete, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

# Type variable for the model class
ModelT = TypeVar("ModelT")


# =============================================================================
# Exceptions
# =============================================================================


class RepositoryError(Exception):
    """Base exception for repository operations."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(RepositoryError):
    """Raised when a requested entity is not found."""

    def __init__(self, model: str, identifier: Any):
        super().__init__(
            f"{model} not found: {identifier}",
            {"model": model, "identifier": identifier},
        )


class DuplicateError(RepositoryError):
    """Raised when attempting to create a duplicate entity."""

    def __init__(self, model: str, field: str, value: Any):
        super().__init__(
            f"Duplicate {model}: {field}={value}",
            {"model": model, "field": field, "value": value},
        )


class ValidationError(RepositoryError):
    """Raised when data validation fails."""

    def __init__(self, message: str, errors: Optional[List[Dict[str, str]]] = None):
        super().__init__(
            message,
            {"errors": errors or []},
        )


class SourceCitationError(ValidationError):
    """Raised when source citation requirements are not met."""

    def __init__(self, missing_fields: List[str], data_path: Optional[str] = None):
        super().__init__(
            f"Missing source citation: {', '.join(missing_fields)}",
            {"missing_fields": missing_fields, "data_path": data_path},
        )


# =============================================================================
# Filter Operators
# =============================================================================


class FilterOperator(Enum):
    """Operators for filtering queries."""

    EQ = "eq"  # Equal
    NE = "ne"  # Not equal
    GT = "gt"  # Greater than
    GTE = "gte"  # Greater than or equal
    LT = "lt"  # Less than
    LTE = "lte"  # Less than or equal
    IN = "in"  # In list
    NOT_IN = "not_in"  # Not in list
    LIKE = "like"  # SQL LIKE
    ILIKE = "ilike"  # Case-insensitive LIKE
    IS_NULL = "is_null"  # Is NULL
    IS_NOT_NULL = "is_not_null"  # Is not NULL
    BETWEEN = "between"  # Between two values


# =============================================================================
# Base Repository
# =============================================================================


class BaseRepository(ABC, Generic[ModelT]):
    """
    Abstract base repository with async CRUD operations.

    Subclasses must:
    1. Set the `model` class attribute to the SQLAlchemy model
    2. Implement `validate_source_citation()` method

    Features:
    - Type-safe operations using generics
    - Flexible filtering with multiple operators
    - Pagination support
    - Soft delete support (if model has is_deleted field)
    - Source citation validation for data integrity
    """

    # Subclasses must set this to the SQLAlchemy model class
    model: Type[ModelT]

    # Configuration
    default_limit: int = 100
    max_limit: int = 1000
    source_freshness_days: int = 365  # 12 months max

    def __init__(self, session: AsyncSession):
        """
        Initialize repository with database session.

        Args:
            session: AsyncSession from SQLAlchemy
        """
        self._session = session

    @property
    def session(self) -> AsyncSession:
        """Get the database session."""
        return self._session

    # =========================================================================
    # Abstract Methods
    # =========================================================================

    @abstractmethod
    def validate_source_citation(self, data: Dict[str, Any]) -> bool:
        """
        Validate that data contains required source citation.

        Source Citation Mandate:
        - source_url: REQUIRED - URL where data was obtained
        - source_date: REQUIRED - Date of the source (max 12 months old)
        - source_type: OPTIONAL - Type of source (api, webpage, document)

        Args:
            data: Dictionary of field values to validate

        Returns:
            True if valid, raises SourceCitationError if not

        Raises:
            SourceCitationError: If source citation is missing or invalid
        """
        pass

    # =========================================================================
    # CRUD Operations
    # =========================================================================

    async def get_by_id(
        self,
        id: Any,
        *,
        load_relations: Optional[List[str]] = None,
        include_deleted: bool = False,
    ) -> Optional[ModelT]:
        """
        Get an entity by its primary key.

        Args:
            id: Primary key value
            load_relations: List of relationship names to eagerly load
            include_deleted: If True, include soft-deleted records

        Returns:
            Entity if found, None otherwise
        """
        query = select(self.model).where(self.model.id == id)

        # Exclude soft-deleted records if applicable
        if not include_deleted and hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)  # noqa: E712

        # Eagerly load relationships
        if load_relations:
            for relation in load_relations:
                if hasattr(self.model, relation):
                    query = query.options(selectinload(getattr(self.model, relation)))

        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_id_or_raise(
        self,
        id: Any,
        *,
        load_relations: Optional[List[str]] = None,
        include_deleted: bool = False,
    ) -> ModelT:
        """
        Get an entity by ID or raise NotFoundError.

        Args:
            id: Primary key value
            load_relations: List of relationship names to eagerly load
            include_deleted: If True, include soft-deleted records

        Returns:
            Entity

        Raises:
            NotFoundError: If entity not found
        """
        entity = await self.get_by_id(
            id,
            load_relations=load_relations,
            include_deleted=include_deleted,
        )
        if entity is None:
            raise NotFoundError(self.model.__name__, id)
        return entity

    async def get_by_field(
        self,
        field: str,
        value: Any,
        *,
        load_relations: Optional[List[str]] = None,
        include_deleted: bool = False,
    ) -> Optional[ModelT]:
        """
        Get an entity by a specific field value.

        Args:
            field: Field name (e.g., "domain", "email")
            value: Field value to match
            load_relations: List of relationship names to eagerly load
            include_deleted: If True, include soft-deleted records

        Returns:
            Entity if found, None otherwise
        """
        if not hasattr(self.model, field):
            raise ValidationError(f"Invalid field: {field}")

        query = select(self.model).where(getattr(self.model, field) == value)

        if not include_deleted and hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)  # noqa: E712

        if load_relations:
            for relation in load_relations:
                if hasattr(self.model, relation):
                    query = query.options(selectinload(getattr(self.model, relation)))

        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        filters: Optional[Dict[str, Any]] = None,
        advanced_filters: Optional[List[Tuple[str, FilterOperator, Any]]] = None,
        order_by: Optional[List[Tuple[str, str]]] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        load_relations: Optional[List[str]] = None,
        include_deleted: bool = False,
    ) -> List[ModelT]:
        """
        List entities with filtering, ordering, and pagination.

        Args:
            filters: Simple equality filters {field: value}
            advanced_filters: Complex filters [(field, operator, value)]
            order_by: List of (field, direction) tuples, e.g., [("created_at", "desc")]
            limit: Maximum number of results (default: 100, max: 1000)
            offset: Number of records to skip
            load_relations: List of relationship names to eagerly load
            include_deleted: If True, include soft-deleted records

        Returns:
            List of entities

        Example:
            # Simple filters
            await repo.list(filters={"vertical": "Retail", "is_public": True})

            # Advanced filters
            await repo.list(advanced_filters=[
                ("icp_score", FilterOperator.GTE, 80),
                ("created_at", FilterOperator.GT, datetime(2026, 1, 1)),
                ("vertical", FilterOperator.IN, ["Retail", "Marketplace"]),
            ])
        """
        query = select(self.model)

        # Apply soft delete filter
        if not include_deleted and hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)  # noqa: E712

        # Apply simple equality filters
        if filters:
            for field, value in filters.items():
                if not hasattr(self.model, field):
                    raise ValidationError(f"Invalid filter field: {field}")
                query = query.where(getattr(self.model, field) == value)

        # Apply advanced filters
        if advanced_filters:
            for field, operator, value in advanced_filters:
                if not hasattr(self.model, field):
                    raise ValidationError(f"Invalid filter field: {field}")
                column = getattr(self.model, field)
                query = query.where(self._apply_operator(column, operator, value))

        # Apply ordering
        if order_by:
            for field, direction in order_by:
                if not hasattr(self.model, field):
                    raise ValidationError(f"Invalid order_by field: {field}")
                column = getattr(self.model, field)
                query = query.order_by(desc(column) if direction.lower() == "desc" else asc(column))
        elif hasattr(self.model, "created_at"):
            # Default ordering by created_at desc
            query = query.order_by(desc(self.model.created_at))

        # Apply pagination
        effective_limit = min(limit or self.default_limit, self.max_limit)
        query = query.limit(effective_limit).offset(offset)

        # Eagerly load relationships
        if load_relations:
            for relation in load_relations:
                if hasattr(self.model, relation):
                    query = query.options(selectinload(getattr(self.model, relation)))

        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def count(
        self,
        *,
        filters: Optional[Dict[str, Any]] = None,
        advanced_filters: Optional[List[Tuple[str, FilterOperator, Any]]] = None,
        include_deleted: bool = False,
    ) -> int:
        """
        Count entities matching filters.

        Args:
            filters: Simple equality filters
            advanced_filters: Complex filters
            include_deleted: If True, include soft-deleted records

        Returns:
            Count of matching entities
        """
        query = select(func.count()).select_from(self.model)

        if not include_deleted and hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)  # noqa: E712

        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

        if advanced_filters:
            for field, operator, value in advanced_filters:
                if hasattr(self.model, field):
                    column = getattr(self.model, field)
                    query = query.where(self._apply_operator(column, operator, value))

        result = await self._session.execute(query)
        return result.scalar_one()

    async def create(
        self,
        data: Dict[str, Any],
        *,
        validate_source: bool = True,
        flush: bool = True,
    ) -> ModelT:
        """
        Create a new entity.

        Args:
            data: Dictionary of field values
            validate_source: If True, validate source citation
            flush: If True, flush the session to get the ID

        Returns:
            Created entity

        Raises:
            SourceCitationError: If source citation validation fails
            DuplicateError: If unique constraint violated
            ValidationError: If data validation fails
        """
        # Validate source citation
        if validate_source:
            self.validate_source_citation(data)

        # Set timestamps
        now = datetime.utcnow()
        if hasattr(self.model, "created_at") and "created_at" not in data:
            data["created_at"] = now
        if hasattr(self.model, "updated_at") and "updated_at" not in data:
            data["updated_at"] = now

        try:
            entity = self.model(**data)
            self._session.add(entity)
            if flush:
                await self._session.flush()
            return entity
        except IntegrityError as e:
            await self._session.rollback()
            # Parse the error to provide better feedback
            error_str = str(e.orig)
            if "UNIQUE constraint failed" in error_str or "duplicate key" in error_str:
                raise DuplicateError(
                    self.model.__name__,
                    self._extract_constraint_field(error_str),
                    self._extract_constraint_value(data, error_str),
                )
            raise ValidationError(f"Database constraint violated: {error_str}")

    async def create_many(
        self,
        items: List[Dict[str, Any]],
        *,
        validate_source: bool = True,
        flush: bool = True,
    ) -> List[ModelT]:
        """
        Create multiple entities in a batch.

        Args:
            items: List of dictionaries with field values
            validate_source: If True, validate source citation for each item
            flush: If True, flush the session after all inserts

        Returns:
            List of created entities

        Raises:
            SourceCitationError: If any item fails source citation validation
            DuplicateError: If unique constraint violated
        """
        now = datetime.utcnow()
        entities = []

        for data in items:
            # Validate source citation
            if validate_source:
                self.validate_source_citation(data)

            # Set timestamps
            if hasattr(self.model, "created_at") and "created_at" not in data:
                data["created_at"] = now
            if hasattr(self.model, "updated_at") and "updated_at" not in data:
                data["updated_at"] = now

            entity = self.model(**data)
            entities.append(entity)

        try:
            self._session.add_all(entities)
            if flush:
                await self._session.flush()
            return entities
        except IntegrityError as e:
            await self._session.rollback()
            raise DuplicateError(
                self.model.__name__,
                "batch",
                f"Constraint violated: {e.orig}",
            )

    async def update(
        self,
        id: Any,
        data: Dict[str, Any],
        *,
        validate_source: bool = True,
        partial: bool = True,
    ) -> ModelT:
        """
        Update an existing entity.

        Args:
            id: Primary key of entity to update
            data: Dictionary of field values to update
            validate_source: If True, validate source citation
            partial: If True, only update provided fields (default)

        Returns:
            Updated entity

        Raises:
            NotFoundError: If entity not found
            SourceCitationError: If source citation validation fails
        """
        entity = await self.get_by_id_or_raise(id)

        # Validate source citation if data contains source-related fields
        if validate_source and any(
            k in data for k in ("source_url", "source_date", "source_type")
        ):
            self.validate_source_citation(data)

        # Update timestamp
        if hasattr(self.model, "updated_at"):
            data["updated_at"] = datetime.utcnow()

        # Update fields
        for field, value in data.items():
            if hasattr(entity, field):
                setattr(entity, field, value)

        await self._session.flush()
        return entity

    async def update_by_field(
        self,
        field: str,
        value: Any,
        data: Dict[str, Any],
        *,
        validate_source: bool = True,
    ) -> Optional[ModelT]:
        """
        Update an entity by a specific field (e.g., domain).

        Args:
            field: Field name to match
            value: Field value to match
            data: Dictionary of field values to update
            validate_source: If True, validate source citation

        Returns:
            Updated entity or None if not found
        """
        entity = await self.get_by_field(field, value)
        if entity is None:
            return None

        return await self.update(entity.id, data, validate_source=validate_source)

    async def upsert(
        self,
        unique_field: str,
        unique_value: Any,
        data: Dict[str, Any],
        *,
        validate_source: bool = True,
    ) -> Tuple[ModelT, bool]:
        """
        Update if exists, create if not (upsert).

        Args:
            unique_field: Field to check for existence (e.g., "domain")
            unique_value: Value to check
            data: Dictionary of field values
            validate_source: If True, validate source citation

        Returns:
            Tuple of (entity, created) where created is True if new entity

        Example:
            target, created = await repo.upsert(
                "domain", "costco.com",
                {"company_name": "Costco", "icp_score": 85}
            )
        """
        existing = await self.get_by_field(unique_field, unique_value)

        if existing:
            # Update existing
            updated = await self.update(
                existing.id, data, validate_source=validate_source
            )
            return updated, False
        else:
            # Create new
            data[unique_field] = unique_value
            created = await self.create(data, validate_source=validate_source)
            return created, True

    async def delete(
        self,
        id: Any,
        *,
        soft: bool = True,
    ) -> bool:
        """
        Delete an entity.

        Args:
            id: Primary key of entity to delete
            soft: If True and model has is_deleted field, soft delete

        Returns:
            True if deleted, False if not found
        """
        entity = await self.get_by_id(id)
        if entity is None:
            return False

        if soft and hasattr(self.model, "is_deleted"):
            # Soft delete
            entity.is_deleted = True
            if hasattr(entity, "deleted_at"):
                entity.deleted_at = datetime.utcnow()
            await self._session.flush()
        else:
            # Hard delete
            await self._session.delete(entity)
            await self._session.flush()

        return True

    async def delete_many(
        self,
        filters: Dict[str, Any],
        *,
        soft: bool = True,
    ) -> int:
        """
        Delete multiple entities matching filters.

        Args:
            filters: Dictionary of field filters
            soft: If True and model has is_deleted, soft delete

        Returns:
            Number of deleted entities
        """
        if soft and hasattr(self.model, "is_deleted"):
            # Soft delete via UPDATE
            stmt = (
                update(self.model)
                .where(
                    and_(
                        *[
                            getattr(self.model, k) == v
                            for k, v in filters.items()
                            if hasattr(self.model, k)
                        ]
                    )
                )
                .values(is_deleted=True, deleted_at=datetime.utcnow())
            )
        else:
            # Hard delete
            stmt = delete(self.model).where(
                and_(
                    *[
                        getattr(self.model, k) == v
                        for k, v in filters.items()
                        if hasattr(self.model, k)
                    ]
                )
            )

        result = await self._session.execute(stmt)
        return result.rowcount

    async def exists(
        self,
        field: str,
        value: Any,
        *,
        exclude_id: Optional[Any] = None,
    ) -> bool:
        """
        Check if an entity exists with the given field value.

        Args:
            field: Field name to check
            value: Value to check for
            exclude_id: If provided, exclude this ID from the check

        Returns:
            True if exists, False otherwise
        """
        query = select(func.count()).select_from(self.model).where(
            getattr(self.model, field) == value
        )

        if exclude_id is not None:
            query = query.where(self.model.id != exclude_id)

        if hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)  # noqa: E712

        result = await self._session.execute(query)
        return result.scalar_one() > 0

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _apply_operator(
        self, column: Any, operator: FilterOperator, value: Any
    ) -> Any:
        """Apply a filter operator to a column."""
        if operator == FilterOperator.EQ:
            return column == value
        elif operator == FilterOperator.NE:
            return column != value
        elif operator == FilterOperator.GT:
            return column > value
        elif operator == FilterOperator.GTE:
            return column >= value
        elif operator == FilterOperator.LT:
            return column < value
        elif operator == FilterOperator.LTE:
            return column <= value
        elif operator == FilterOperator.IN:
            return column.in_(value)
        elif operator == FilterOperator.NOT_IN:
            return ~column.in_(value)
        elif operator == FilterOperator.LIKE:
            return column.like(value)
        elif operator == FilterOperator.ILIKE:
            return column.ilike(value)
        elif operator == FilterOperator.IS_NULL:
            return column.is_(None)
        elif operator == FilterOperator.IS_NOT_NULL:
            return column.isnot(None)
        elif operator == FilterOperator.BETWEEN:
            return column.between(value[0], value[1])
        else:
            raise ValidationError(f"Unknown operator: {operator}")

    def _extract_constraint_field(self, error_str: str) -> str:
        """Extract the field name from a constraint error."""
        # Try to parse SQLite format: "UNIQUE constraint failed: table.field"
        if "UNIQUE constraint failed:" in error_str:
            parts = error_str.split(":")[-1].strip().split(".")
            if len(parts) > 1:
                return parts[-1]
        # Try PostgreSQL format
        if "Key (" in error_str:
            import re
            match = re.search(r"Key \((\w+)\)", error_str)
            if match:
                return match.group(1)
        return "unknown"

    def _extract_constraint_value(
        self, data: Dict[str, Any], error_str: str
    ) -> Any:
        """Extract the conflicting value from data based on constraint error."""
        field = self._extract_constraint_field(error_str)
        return data.get(field, "unknown")

    def validate_source_freshness(
        self, source_date: datetime, max_age_days: Optional[int] = None
    ) -> bool:
        """
        Validate that a source date is within acceptable freshness.

        Args:
            source_date: Date of the source
            max_age_days: Maximum age in days (default: 365)

        Returns:
            True if fresh, raises SourceCitationError if stale

        Raises:
            SourceCitationError: If source is too old
        """
        max_days = max_age_days or self.source_freshness_days
        cutoff = datetime.utcnow() - timedelta(days=max_days)

        if source_date < cutoff:
            raise SourceCitationError(
                ["source_date"],
                f"Source date {source_date.isoformat()} is older than {max_days} days",
            )

        return True

    async def refresh(self, entity: ModelT) -> ModelT:
        """
        Refresh an entity from the database.

        Args:
            entity: Entity to refresh

        Returns:
            Refreshed entity
        """
        await self._session.refresh(entity)
        return entity
