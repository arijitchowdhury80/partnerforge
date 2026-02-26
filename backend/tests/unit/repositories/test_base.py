"""
Test Suite: Base Repository

Module Under Test: backend/app/repositories/base.py
Author: Thread 1 - Backend Architecture
Created: 2026-02-25

Test Categories:
1. Happy Path - Normal CRUD operations
2. Edge Cases - Empty data, limits, pagination
3. Error Handling - Not found, duplicates, validation
4. Source Citation - Mandatory source URL validation
5. Filtering - Advanced filter operators
"""

import pytest
from datetime import datetime, timedelta
from typing import Any, Dict
from unittest.mock import AsyncMock, patch

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base
from app.repositories.base import (
    BaseRepository,
    RepositoryError,
    NotFoundError,
    DuplicateError,
    ValidationError,
    SourceCitationError,
    FilterOperator,
)


# =============================================================================
# Test Model (for testing base repository)
# =============================================================================

class TestModel(Base):
    """Test model for repository tests."""
    __tablename__ = "test_model"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False)
    value = Column(Integer)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    score = Column(Float)
    source_url = Column(String(500))
    source_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class TestRepository(BaseRepository[TestModel]):
    """Test repository implementation."""
    model = TestModel

    def validate_source_citation(self, data: Dict[str, Any]) -> bool:
        """Test validation - requires source for certain fields."""
        if "score" in data and data["score"] is not None:
            if not data.get("source_url"):
                raise SourceCitationError(["source_url"], "score requires source_url")
        return True


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
async def test_engine():
    """Create test database engine with test model."""
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest.fixture
async def db_session(test_engine):
    """Create test database session."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker

    async_session = sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def repository(db_session):
    """Create test repository instance."""
    return TestRepository(db_session)


@pytest.fixture
def sample_data():
    """Sample data for creating test entities."""
    return {
        "name": "test_entity",
        "value": 42,
        "is_active": True,
        "score": None,
    }


@pytest.fixture
def sample_data_with_source():
    """Sample data with source citation."""
    return {
        "name": "sourced_entity",
        "value": 100,
        "is_active": True,
        "score": 85.5,
        "source_url": "https://example.com/data",
        "source_date": datetime(2026, 2, 1),
    }


# =============================================================================
# HAPPY PATH TESTS
# =============================================================================

class TestHappyPath:
    """Tests for normal, expected operations."""

    @pytest.mark.asyncio
    async def test_create_entity(self, repository, sample_data, db_session):
        """
        GIVEN: Valid entity data
        WHEN: create() is called
        THEN: Entity is created with correct values
        """
        # Act
        entity = await repository.create(sample_data, validate_source=False)
        await db_session.commit()

        # Assert
        assert entity is not None
        assert entity.id is not None
        assert entity.name == sample_data["name"]
        assert entity.value == sample_data["value"]
        assert entity.is_active == sample_data["is_active"]
        assert entity.created_at is not None

    @pytest.mark.asyncio
    async def test_get_by_id(self, repository, sample_data, db_session):
        """
        GIVEN: An existing entity
        WHEN: get_by_id() is called
        THEN: Returns the correct entity
        """
        # Arrange
        created = await repository.create(sample_data, validate_source=False)
        await db_session.commit()

        # Act
        retrieved = await repository.get_by_id(created.id)

        # Assert
        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.name == sample_data["name"]

    @pytest.mark.asyncio
    async def test_get_by_field(self, repository, sample_data, db_session):
        """
        GIVEN: An existing entity
        WHEN: get_by_field() is called with correct field/value
        THEN: Returns the correct entity
        """
        # Arrange
        created = await repository.create(sample_data, validate_source=False)
        await db_session.commit()

        # Act
        retrieved = await repository.get_by_field("name", sample_data["name"])

        # Assert
        assert retrieved is not None
        assert retrieved.id == created.id

    @pytest.mark.asyncio
    async def test_list_entities(self, repository, db_session):
        """
        GIVEN: Multiple entities
        WHEN: list() is called
        THEN: Returns all matching entities
        """
        # Arrange
        for i in range(5):
            await repository.create(
                {"name": f"entity_{i}", "value": i * 10, "is_active": True},
                validate_source=False,
            )
        await db_session.commit()

        # Act
        entities = await repository.list()

        # Assert
        assert len(entities) == 5

    @pytest.mark.asyncio
    async def test_list_with_filters(self, repository, db_session):
        """
        GIVEN: Multiple entities with different values
        WHEN: list() is called with filters
        THEN: Returns only matching entities
        """
        # Arrange
        await repository.create(
            {"name": "active", "value": 10, "is_active": True},
            validate_source=False,
        )
        await repository.create(
            {"name": "inactive", "value": 20, "is_active": False},
            validate_source=False,
        )
        await db_session.commit()

        # Act
        active_entities = await repository.list(filters={"is_active": True})

        # Assert
        assert len(active_entities) == 1
        assert active_entities[0].name == "active"

    @pytest.mark.asyncio
    async def test_update_entity(self, repository, sample_data, db_session):
        """
        GIVEN: An existing entity
        WHEN: update() is called with new values
        THEN: Entity is updated correctly
        """
        # Arrange
        created = await repository.create(sample_data, validate_source=False)
        await db_session.commit()

        # Act
        updated = await repository.update(
            created.id,
            {"value": 999},
            validate_source=False,
        )
        await db_session.commit()

        # Assert
        assert updated.value == 999
        assert updated.updated_at is not None

    @pytest.mark.asyncio
    async def test_delete_entity(self, repository, sample_data, db_session):
        """
        GIVEN: An existing entity
        WHEN: delete() is called
        THEN: Entity is soft-deleted
        """
        # Arrange
        created = await repository.create(sample_data, validate_source=False)
        await db_session.commit()

        # Act
        result = await repository.delete(created.id, soft=True)
        await db_session.commit()

        # Assert
        assert result is True

        # Verify soft delete
        deleted = await repository.get_by_id(created.id, include_deleted=True)
        assert deleted is not None
        assert deleted.is_deleted is True

    @pytest.mark.asyncio
    async def test_count_entities(self, repository, db_session):
        """
        GIVEN: Multiple entities
        WHEN: count() is called
        THEN: Returns correct count
        """
        # Arrange
        for i in range(3):
            await repository.create(
                {"name": f"entity_{i}", "value": i, "is_active": True},
                validate_source=False,
            )
        await db_session.commit()

        # Act
        count = await repository.count()

        # Assert
        assert count == 3

    @pytest.mark.asyncio
    async def test_exists(self, repository, sample_data, db_session):
        """
        GIVEN: An existing entity
        WHEN: exists() is called
        THEN: Returns True
        """
        # Arrange
        await repository.create(sample_data, validate_source=False)
        await db_session.commit()

        # Act
        result = await repository.exists("name", sample_data["name"])

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_upsert_create(self, repository, db_session):
        """
        GIVEN: No existing entity
        WHEN: upsert() is called
        THEN: Creates new entity
        """
        # Act
        entity, created = await repository.upsert(
            "name",
            "new_entity",
            {"value": 50, "is_active": True},
            validate_source=False,
        )
        await db_session.commit()

        # Assert
        assert created is True
        assert entity.name == "new_entity"
        assert entity.value == 50

    @pytest.mark.asyncio
    async def test_upsert_update(self, repository, sample_data, db_session):
        """
        GIVEN: An existing entity
        WHEN: upsert() is called with same unique value
        THEN: Updates existing entity
        """
        # Arrange
        await repository.create(sample_data, validate_source=False)
        await db_session.commit()

        # Act
        entity, created = await repository.upsert(
            "name",
            sample_data["name"],
            {"value": 999},
            validate_source=False,
        )
        await db_session.commit()

        # Assert
        assert created is False
        assert entity.value == 999


# =============================================================================
# EDGE CASE TESTS
# =============================================================================

class TestEdgeCases:
    """Tests for boundary conditions and unusual inputs."""

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, repository):
        """
        GIVEN: Non-existent ID
        WHEN: get_by_id() is called
        THEN: Returns None (not error)
        """
        # Act
        result = await repository.get_by_id(99999)

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_list_empty_database(self, repository):
        """
        GIVEN: Empty database
        WHEN: list() is called
        THEN: Returns empty list
        """
        # Act
        entities = await repository.list()

        # Assert
        assert entities == []

    @pytest.mark.asyncio
    async def test_list_with_pagination(self, repository, db_session):
        """
        GIVEN: Many entities
        WHEN: list() is called with limit and offset
        THEN: Returns correct subset
        """
        # Arrange
        for i in range(10):
            await repository.create(
                {"name": f"entity_{i:02d}", "value": i, "is_active": True},
                validate_source=False,
            )
        await db_session.commit()

        # Act
        page1 = await repository.list(limit=3, offset=0)
        page2 = await repository.list(limit=3, offset=3)

        # Assert
        assert len(page1) == 3
        assert len(page2) == 3
        # Ensure different entities
        page1_ids = {e.id for e in page1}
        page2_ids = {e.id for e in page2}
        assert page1_ids.isdisjoint(page2_ids)

    @pytest.mark.asyncio
    async def test_list_respects_max_limit(self, repository, db_session):
        """
        GIVEN: Request for more than max_limit
        WHEN: list() is called
        THEN: Respects max_limit setting
        """
        # Arrange - create more than default limit
        for i in range(5):
            await repository.create(
                {"name": f"entity_{i}", "value": i, "is_active": True},
                validate_source=False,
            )
        await db_session.commit()

        # Save original and set test limit
        original_max = repository.max_limit
        repository.max_limit = 3

        # Act
        entities = await repository.list(limit=100)

        # Assert
        assert len(entities) <= 3

        # Restore
        repository.max_limit = original_max

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, repository):
        """
        GIVEN: Non-existent ID
        WHEN: delete() is called
        THEN: Returns False
        """
        # Act
        result = await repository.delete(99999)

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_count_with_filters(self, repository, db_session):
        """
        GIVEN: Mixed entities
        WHEN: count() is called with filters
        THEN: Returns filtered count
        """
        # Arrange
        await repository.create(
            {"name": "active1", "value": 10, "is_active": True},
            validate_source=False,
        )
        await repository.create(
            {"name": "active2", "value": 20, "is_active": True},
            validate_source=False,
        )
        await repository.create(
            {"name": "inactive", "value": 30, "is_active": False},
            validate_source=False,
        )
        await db_session.commit()

        # Act
        active_count = await repository.count(filters={"is_active": True})
        inactive_count = await repository.count(filters={"is_active": False})

        # Assert
        assert active_count == 2
        assert inactive_count == 1


# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================

class TestErrorHandling:
    """Tests for error conditions."""

    @pytest.mark.asyncio
    async def test_get_by_id_or_raise_not_found(self, repository):
        """
        GIVEN: Non-existent ID
        WHEN: get_by_id_or_raise() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            await repository.get_by_id_or_raise(99999)

        assert "99999" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_duplicate(self, repository, sample_data, db_session):
        """
        GIVEN: Existing entity with unique field
        WHEN: create() is called with same unique value
        THEN: Raises DuplicateError
        """
        # Arrange
        await repository.create(sample_data, validate_source=False)
        await db_session.commit()

        # Act & Assert
        with pytest.raises(DuplicateError) as exc_info:
            await repository.create(sample_data, validate_source=False)

        assert "name" in str(exc_info.value).lower() or "duplicate" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_update_not_found(self, repository):
        """
        GIVEN: Non-existent ID
        WHEN: update() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError):
            await repository.update(99999, {"value": 100}, validate_source=False)

    @pytest.mark.asyncio
    async def test_list_invalid_filter_field(self, repository):
        """
        GIVEN: Invalid filter field
        WHEN: list() is called
        THEN: Raises ValidationError
        """
        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await repository.list(filters={"nonexistent_field": "value"})

        assert "invalid" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_list_invalid_order_by_field(self, repository):
        """
        GIVEN: Invalid order_by field
        WHEN: list() is called
        THEN: Raises ValidationError
        """
        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await repository.list(order_by=[("nonexistent", "asc")])

        assert "invalid" in str(exc_info.value).lower()


# =============================================================================
# SOURCE CITATION TESTS
# =============================================================================

class TestSourceCitation:
    """Tests for source citation validation."""

    @pytest.mark.asyncio
    async def test_create_with_source_when_required(
        self, repository, sample_data_with_source, db_session
    ):
        """
        GIVEN: Data with score (requires source)
        WHEN: create() is called with source citation
        THEN: Entity is created successfully
        """
        # Act
        entity = await repository.create(sample_data_with_source, validate_source=True)
        await db_session.commit()

        # Assert
        assert entity is not None
        assert entity.score == sample_data_with_source["score"]
        assert entity.source_url == sample_data_with_source["source_url"]

    @pytest.mark.asyncio
    async def test_create_without_source_when_required_fails(self, repository):
        """
        GIVEN: Data with score (requires source) but no source_url
        WHEN: create() is called with validation
        THEN: Raises SourceCitationError
        """
        # Arrange
        data = {"name": "missing_source", "value": 10, "score": 50.0}

        # Act & Assert
        with pytest.raises(SourceCitationError) as exc_info:
            await repository.create(data, validate_source=True)

        assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_without_validation_skips_source_check(
        self, repository, db_session
    ):
        """
        GIVEN: Data missing source citation
        WHEN: create() is called with validate_source=False
        THEN: Entity is created (no validation)
        """
        # Arrange
        data = {"name": "no_validation", "value": 10, "score": 50.0}

        # Act
        entity = await repository.create(data, validate_source=False)
        await db_session.commit()

        # Assert
        assert entity is not None
        assert entity.score == 50.0

    @pytest.mark.asyncio
    async def test_validate_source_freshness_valid(self, repository):
        """
        GIVEN: Source date within acceptable range
        WHEN: validate_source_freshness() is called
        THEN: Returns True
        """
        # Arrange
        recent_date = datetime.utcnow() - timedelta(days=30)

        # Act
        result = repository.validate_source_freshness(recent_date)

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_validate_source_freshness_stale(self, repository):
        """
        GIVEN: Source date older than max age
        WHEN: validate_source_freshness() is called
        THEN: Raises SourceCitationError
        """
        # Arrange
        old_date = datetime.utcnow() - timedelta(days=400)

        # Act & Assert
        with pytest.raises(SourceCitationError):
            repository.validate_source_freshness(old_date)


# =============================================================================
# FILTER OPERATOR TESTS
# =============================================================================

class TestFilterOperators:
    """Tests for advanced filter operators."""

    @pytest.mark.asyncio
    async def test_filter_gte(self, repository, db_session):
        """
        GIVEN: Entities with different values
        WHEN: list() with GTE filter
        THEN: Returns matching entities
        """
        # Arrange
        for i in range(5):
            await repository.create(
                {"name": f"entity_{i}", "value": i * 10, "is_active": True},
                validate_source=False,
            )
        await db_session.commit()

        # Act
        result = await repository.list(
            advanced_filters=[("value", FilterOperator.GTE, 30)]
        )

        # Assert
        assert len(result) == 2  # value 30 and 40

    @pytest.mark.asyncio
    async def test_filter_lt(self, repository, db_session):
        """
        GIVEN: Entities with different values
        WHEN: list() with LT filter
        THEN: Returns matching entities
        """
        # Arrange
        for i in range(5):
            await repository.create(
                {"name": f"entity_{i}", "value": i * 10, "is_active": True},
                validate_source=False,
            )
        await db_session.commit()

        # Act
        result = await repository.list(
            advanced_filters=[("value", FilterOperator.LT, 30)]
        )

        # Assert
        assert len(result) == 3  # value 0, 10, 20

    @pytest.mark.asyncio
    async def test_filter_in_list(self, repository, db_session):
        """
        GIVEN: Entities with different values
        WHEN: list() with IN filter
        THEN: Returns matching entities
        """
        # Arrange
        for i in range(5):
            await repository.create(
                {"name": f"entity_{i}", "value": i * 10, "is_active": True},
                validate_source=False,
            )
        await db_session.commit()

        # Act
        result = await repository.list(
            advanced_filters=[("value", FilterOperator.IN, [10, 30])]
        )

        # Assert
        assert len(result) == 2
        values = {e.value for e in result}
        assert values == {10, 30}

    @pytest.mark.asyncio
    async def test_filter_ilike(self, repository, db_session):
        """
        GIVEN: Entities with different names
        WHEN: list() with ILIKE filter
        THEN: Returns matching entities (case-insensitive)
        """
        # Arrange
        await repository.create(
            {"name": "Test_Entity", "value": 10, "is_active": True},
            validate_source=False,
        )
        await repository.create(
            {"name": "other_thing", "value": 20, "is_active": True},
            validate_source=False,
        )
        await db_session.commit()

        # Act
        result = await repository.list(
            advanced_filters=[("name", FilterOperator.ILIKE, "%test%")]
        )

        # Assert
        assert len(result) == 1
        assert "test" in result[0].name.lower()

    @pytest.mark.asyncio
    async def test_filter_between(self, repository, db_session):
        """
        GIVEN: Entities with different values
        WHEN: list() with BETWEEN filter
        THEN: Returns matching entities
        """
        # Arrange
        for i in range(10):
            await repository.create(
                {"name": f"entity_{i}", "value": i * 10, "is_active": True},
                validate_source=False,
            )
        await db_session.commit()

        # Act
        result = await repository.list(
            advanced_filters=[("value", FilterOperator.BETWEEN, (20, 50))]
        )

        # Assert
        assert len(result) == 4  # 20, 30, 40, 50
        for entity in result:
            assert 20 <= entity.value <= 50


# =============================================================================
# BATCH OPERATIONS TESTS
# =============================================================================

class TestBatchOperations:
    """Tests for batch create/delete operations."""

    @pytest.mark.asyncio
    async def test_create_many(self, repository, db_session):
        """
        GIVEN: Multiple items to create
        WHEN: create_many() is called
        THEN: All entities are created
        """
        # Arrange
        items = [
            {"name": f"batch_{i}", "value": i, "is_active": True}
            for i in range(5)
        ]

        # Act
        entities = await repository.create_many(items, validate_source=False)
        await db_session.commit()

        # Assert
        assert len(entities) == 5
        for i, entity in enumerate(entities):
            assert entity.name == f"batch_{i}"

    @pytest.mark.asyncio
    async def test_delete_many(self, repository, db_session):
        """
        GIVEN: Multiple entities matching criteria
        WHEN: delete_many() is called
        THEN: All matching entities are deleted
        """
        # Arrange
        for i in range(5):
            await repository.create(
                {"name": f"delete_{i}", "value": 100, "is_active": True},
                validate_source=False,
            )
        await repository.create(
            {"name": "keep_this", "value": 200, "is_active": True},
            validate_source=False,
        )
        await db_session.commit()

        # Act
        deleted_count = await repository.delete_many({"value": 100}, soft=False)
        await db_session.commit()

        # Assert
        assert deleted_count == 5
        remaining = await repository.list()
        assert len(remaining) == 1
        assert remaining[0].name == "keep_this"
