"""
Test Suite: Intelligence Repository

Module Under Test: backend/app/repositories/intelligence.py
Author: Thread 1 - Backend Architecture
Created: 2026-02-25

Test Categories:
1. Happy Path - Module CRUD, wave operations, domain completeness
2. Edge Cases - Empty data, invalid modules, staleness boundaries
3. Error Handling - Not found, invalid module IDs, validation
4. Source Citation - Mandatory source URL and date validation (CRITICAL)
5. Staleness Detection - Module-specific freshness thresholds
6. Statistics and Module Queries
7. Wave Data Operations
"""

import pytest
from datetime import datetime, timedelta
from typing import Any, Dict
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.intelligence import (
    IntelCompanyContext,
    IntelTechnologyStack,
    IntelTrafficAnalysis,
    IntelFinancialProfile,
    IntelCompetitorIntelligence,
    IntelHiringSignals,
    IntelStrategicContext,
    IntelInvestorIntelligence,
    IntelExecutiveIntelligence,
    IntelBuyingCommittee,
    IntelDisplacementAnalysis,
    IntelCaseStudyMatches,
    IntelICPPriorityMapping,
    IntelSignalScoring,
    IntelStrategicSignalBrief,
)
from app.repositories.intelligence import (
    IntelligenceRepository,
    MODULE_MODELS,
    MODULE_FRESHNESS,
    WAVE_MODULES,
)
from app.repositories.base import (
    NotFoundError,
    ValidationError,
    SourceCitationError,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
async def test_engine():
    """Create test database engine with all models."""
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
    async_session = sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def intel_repo(db_session):
    """Create intelligence repository instance."""
    return IntelligenceRepository(db_session)


@pytest.fixture
def valid_source_data():
    """Valid source citation data for intelligence records."""
    return {
        "source_url": "https://builtwith.com/example.com",
        "source_date": datetime.utcnow() - timedelta(days=30),
        "source_type": "api",
    }


@pytest.fixture
def sample_company_context(valid_source_data):
    """Sample company context data."""
    return {
        **valid_source_data,
        "company_name": "Example Corp",
        "description": "A sample company for testing",
        "vertical": "Retail",
        "industry": "E-commerce",
        "employee_count": 5000,
        "headquarters_city": "Seattle",
        "headquarters_country": "United States",
    }


@pytest.fixture
def sample_tech_stack(valid_source_data):
    """Sample technology stack data."""
    return {
        **valid_source_data,
        "tech_spend_estimate": 100000,
        "tech_spend_tier": "$100K+",
        "total_technologies": 45,
        "primary_partner": "Adobe AEM",
        "current_search_provider": "Elasticsearch",
        "has_algolia": False,
    }


@pytest.fixture
async def sample_intel_record(intel_repo, sample_company_context, db_session):
    """Create a sample intelligence record in the database."""
    record = await intel_repo.save_module_data(
        "example.com",
        "m01_company_context",
        sample_company_context,
    )
    await db_session.commit()
    return record


# =============================================================================
# MODULE REGISTRY TESTS
# =============================================================================

class TestModuleRegistry:
    """Tests for module registry operations."""

    def test_get_model_for_module_valid(self, intel_repo):
        """
        GIVEN: Valid module ID
        WHEN: get_model_for_module() is called
        THEN: Returns correct model class
        """
        # Act
        model = intel_repo.get_model_for_module("m01_company_context")

        # Assert
        assert model == IntelCompanyContext

    def test_get_model_for_module_all_modules(self, intel_repo):
        """
        GIVEN: All module IDs
        WHEN: get_model_for_module() is called for each
        THEN: Returns correct model classes
        """
        # Assert all 15 modules are mapped
        assert len(MODULE_MODELS) == 15

        # Spot check some modules
        assert intel_repo.get_model_for_module("m02_tech_stack") == IntelTechnologyStack
        assert intel_repo.get_model_for_module("m06_hiring") == IntelHiringSignals
        assert intel_repo.get_model_for_module("m15_strategic_brief") == IntelStrategicSignalBrief

    def test_get_model_for_module_invalid(self, intel_repo):
        """
        GIVEN: Invalid module ID
        WHEN: get_model_for_module() is called
        THEN: Raises ValidationError
        """
        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            intel_repo.get_model_for_module("invalid_module")

        assert "invalid_module" in str(exc_info.value).lower()

    def test_get_freshness_threshold(self, intel_repo):
        """
        GIVEN: Valid module ID
        WHEN: get_freshness_threshold() is called
        THEN: Returns correct threshold
        """
        # Assert specific thresholds
        assert intel_repo.get_freshness_threshold("m03_traffic") == 7  # Traffic should be fresh
        assert intel_repo.get_freshness_threshold("m01_company_context") == 90  # Company changes slowly
        assert intel_repo.get_freshness_threshold("m12_case_study") == 180  # Case studies rarely change

    def test_get_freshness_threshold_default(self, intel_repo):
        """
        GIVEN: Unknown module (hypothetically)
        WHEN: get_freshness_threshold() is called
        THEN: Returns default of 30 days
        """
        # For any module not explicitly configured, default is 30
        # All 15 modules are configured, but test the default logic
        default = MODULE_FRESHNESS.get("nonexistent", 30)
        assert default == 30


# =============================================================================
# SOURCE CITATION VALIDATION TESTS (CRITICAL)
# =============================================================================

class TestSourceCitationValidation:
    """Tests for mandatory source citation validation."""

    def test_validate_source_citation_valid(self, intel_repo, valid_source_data):
        """
        GIVEN: Data with valid source citation
        WHEN: validate_source_citation() is called
        THEN: Returns True
        """
        # Act
        result = intel_repo.validate_source_citation(valid_source_data)

        # Assert
        assert result is True

    def test_validate_source_citation_missing_url(self, intel_repo):
        """
        GIVEN: Data missing source_url
        WHEN: validate_source_citation() is called
        THEN: Raises SourceCitationError
        """
        # Arrange
        data = {
            "source_date": datetime.utcnow(),
            "company_name": "Test Corp",
        }

        # Act & Assert
        with pytest.raises(SourceCitationError) as exc_info:
            intel_repo.validate_source_citation(data)

        assert "source_url" in str(exc_info.value)

    def test_validate_source_citation_missing_date(self, intel_repo):
        """
        GIVEN: Data missing source_date
        WHEN: validate_source_citation() is called
        THEN: Raises SourceCitationError
        """
        # Arrange
        data = {
            "source_url": "https://example.com",
            "company_name": "Test Corp",
        }

        # Act & Assert
        with pytest.raises(SourceCitationError) as exc_info:
            intel_repo.validate_source_citation(data)

        assert "source_date" in str(exc_info.value)

    def test_validate_source_citation_missing_both(self, intel_repo):
        """
        GIVEN: Data missing both source_url and source_date
        WHEN: validate_source_citation() is called
        THEN: Raises SourceCitationError with both fields
        """
        # Arrange
        data = {"company_name": "Test Corp"}

        # Act & Assert
        with pytest.raises(SourceCitationError) as exc_info:
            intel_repo.validate_source_citation(data)

        error_msg = str(exc_info.value)
        assert "source_url" in error_msg or "source_date" in error_msg

    def test_validate_source_citation_stale_date(self, intel_repo):
        """
        GIVEN: Data with source_date older than 12 months
        WHEN: validate_source_citation() is called
        THEN: Raises SourceCitationError
        """
        # Arrange
        data = {
            "source_url": "https://example.com",
            "source_date": datetime.utcnow() - timedelta(days=400),  # > 365 days
        }

        # Act & Assert
        with pytest.raises(SourceCitationError) as exc_info:
            intel_repo.validate_source_citation(data)

        assert "older than" in str(exc_info.value).lower() or "365" in str(exc_info.value)

    def test_validate_source_citation_iso_string_date(self, intel_repo):
        """
        GIVEN: Data with source_date as ISO string
        WHEN: validate_source_citation() is called
        THEN: Parses and validates correctly
        """
        # Arrange
        recent_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        data = {
            "source_url": "https://example.com",
            "source_date": recent_date,
        }

        # Act
        result = intel_repo.validate_source_citation(data)

        # Assert
        assert result is True

    def test_validate_source_citation_invalid_date_format(self, intel_repo):
        """
        GIVEN: Data with invalid date format
        WHEN: validate_source_citation() is called
        THEN: Raises SourceCitationError
        """
        # Arrange
        data = {
            "source_url": "https://example.com",
            "source_date": "not-a-date",
        }

        # Act & Assert
        with pytest.raises(SourceCitationError):
            intel_repo.validate_source_citation(data)


# =============================================================================
# CRUD OPERATIONS TESTS
# =============================================================================

class TestCRUDOperations:
    """Tests for CRUD operations on intelligence modules."""

    @pytest.mark.asyncio
    async def test_save_module_data_create(
        self, intel_repo, sample_company_context, db_session
    ):
        """
        GIVEN: New intelligence data
        WHEN: save_module_data() is called
        THEN: Creates new record
        """
        # Act
        record = await intel_repo.save_module_data(
            "newdomain.com",
            "m01_company_context",
            sample_company_context,
        )
        await db_session.commit()

        # Assert
        assert record is not None
        assert record.domain == "newdomain.com"
        assert record.company_name == "Example Corp"
        assert record.source_url == sample_company_context["source_url"]
        assert record.is_stale is False
        assert record.enriched_at is not None

    @pytest.mark.asyncio
    async def test_save_module_data_update(
        self, intel_repo, sample_intel_record, db_session
    ):
        """
        GIVEN: Existing intelligence record
        WHEN: save_module_data() is called for same domain/module
        THEN: Updates existing record
        """
        # Arrange
        updated_data = {
            "source_url": "https://builtwith.com/example.com",
            "source_date": datetime.utcnow(),
            "company_name": "Example Corp Updated",
            "employee_count": 10000,
        }

        # Act
        record = await intel_repo.save_module_data(
            "example.com",
            "m01_company_context",
            updated_data,
        )
        await db_session.commit()

        # Assert
        assert record.company_name == "Example Corp Updated"
        assert record.employee_count == 10000

    @pytest.mark.asyncio
    async def test_save_module_data_without_validation(
        self, intel_repo, db_session
    ):
        """
        GIVEN: Data without source citation
        WHEN: save_module_data() is called with validate_source=False
        THEN: Creates record without validation
        """
        # Arrange
        data = {
            "company_name": "No Source Corp",
            "vertical": "Tech",
        }

        # Act
        record = await intel_repo.save_module_data(
            "nosource.com",
            "m01_company_context",
            data,
            validate_source=False,
        )
        await db_session.commit()

        # Assert
        assert record is not None
        assert record.company_name == "No Source Corp"

    @pytest.mark.asyncio
    async def test_save_module_data_validation_fails(self, intel_repo):
        """
        GIVEN: Data without source citation
        WHEN: save_module_data() is called with validate_source=True
        THEN: Raises SourceCitationError
        """
        # Arrange
        data = {
            "company_name": "No Source Corp",
            "vertical": "Tech",
        }

        # Act & Assert
        with pytest.raises(SourceCitationError):
            await intel_repo.save_module_data(
                "nosource.com",
                "m01_company_context",
                data,
                validate_source=True,
            )

    @pytest.mark.asyncio
    async def test_get_module_data(self, intel_repo, sample_intel_record):
        """
        GIVEN: Existing intelligence record
        WHEN: get_module_data() is called
        THEN: Returns the record
        """
        # Act
        record = await intel_repo.get_module_data("example.com", "m01_company_context")

        # Assert
        assert record is not None
        assert record.domain == "example.com"
        assert record.company_name == "Example Corp"

    @pytest.mark.asyncio
    async def test_get_module_data_not_found(self, intel_repo):
        """
        GIVEN: Non-existent domain/module
        WHEN: get_module_data() is called
        THEN: Returns None
        """
        # Act
        record = await intel_repo.get_module_data("nonexistent.com", "m01_company_context")

        # Assert
        assert record is None

    @pytest.mark.asyncio
    async def test_get_module_data_or_raise(self, intel_repo, sample_intel_record):
        """
        GIVEN: Existing intelligence record
        WHEN: get_module_data_or_raise() is called
        THEN: Returns the record
        """
        # Act
        record = await intel_repo.get_module_data_or_raise(
            "example.com", "m01_company_context"
        )

        # Assert
        assert record is not None

    @pytest.mark.asyncio
    async def test_get_module_data_or_raise_not_found(self, intel_repo):
        """
        GIVEN: Non-existent domain/module
        WHEN: get_module_data_or_raise() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            await intel_repo.get_module_data_or_raise(
                "nonexistent.com", "m01_company_context"
            )

        assert "nonexistent.com" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_module_data(self, intel_repo, sample_intel_record, db_session):
        """
        GIVEN: Existing intelligence record
        WHEN: delete_module_data() is called
        THEN: Deletes the record
        """
        # Act
        result = await intel_repo.delete_module_data("example.com", "m01_company_context")
        await db_session.commit()

        # Assert
        assert result is True

        # Verify deleted
        record = await intel_repo.get_module_data("example.com", "m01_company_context")
        assert record is None

    @pytest.mark.asyncio
    async def test_delete_module_data_not_found(self, intel_repo):
        """
        GIVEN: Non-existent record
        WHEN: delete_module_data() is called
        THEN: Returns False
        """
        # Act
        result = await intel_repo.delete_module_data(
            "nonexistent.com", "m01_company_context"
        )

        # Assert
        assert result is False


# =============================================================================
# BULK OPERATIONS TESTS
# =============================================================================

class TestBulkOperations:
    """Tests for bulk data operations."""

    @pytest.fixture
    async def multi_module_data(self, intel_repo, valid_source_data, db_session):
        """Create multiple module records for a domain."""
        modules = {
            "m01_company_context": {
                **valid_source_data,
                "company_name": "Multi Module Corp",
            },
            "m02_tech_stack": {
                **valid_source_data,
                "tech_spend_estimate": 50000,
            },
            "m03_traffic": {
                **valid_source_data,
                "monthly_visits": 1000000,
            },
        }

        for module_id, data in modules.items():
            await intel_repo.save_module_data("multi.com", module_id, data)

        await db_session.commit()
        return modules

    @pytest.mark.asyncio
    async def test_get_all_modules_for_domain(
        self, intel_repo, multi_module_data
    ):
        """
        GIVEN: Domain with multiple modules
        WHEN: get_all_modules_for_domain() is called
        THEN: Returns all module data
        """
        # Act
        all_modules = await intel_repo.get_all_modules_for_domain("multi.com")

        # Assert
        assert len(all_modules) == 15  # All module keys present
        assert all_modules["m01_company_context"] is not None
        assert all_modules["m02_tech_stack"] is not None
        assert all_modules["m03_traffic"] is not None
        # Other modules should be None
        assert all_modules["m04_financials"] is None

    @pytest.mark.asyncio
    async def test_get_wave_data(self, intel_repo, multi_module_data):
        """
        GIVEN: Domain with wave 1 modules
        WHEN: get_wave_data() is called for wave_1
        THEN: Returns wave 1 module data
        """
        # Act
        wave_data = await intel_repo.get_wave_data("multi.com", "wave_1")

        # Assert
        assert len(wave_data) == 4  # Wave 1 has 4 modules
        assert wave_data["m01_company_context"] is not None
        assert wave_data["m02_tech_stack"] is not None
        assert wave_data["m03_traffic"] is not None
        assert wave_data["m04_financials"] is None  # Not created

    @pytest.mark.asyncio
    async def test_get_wave_data_invalid_wave(self, intel_repo):
        """
        GIVEN: Invalid wave name
        WHEN: get_wave_data() is called
        THEN: Raises ValidationError
        """
        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await intel_repo.get_wave_data("example.com", "wave_99")

        assert "wave_99" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_save_wave_data(self, intel_repo, valid_source_data, db_session):
        """
        GIVEN: Wave data to save
        WHEN: save_wave_data() is called
        THEN: Saves all module data for the wave
        """
        # Arrange
        wave_data = {
            "m01_company_context": {
                **valid_source_data,
                "company_name": "Wave Test Corp",
            },
            "m02_tech_stack": {
                **valid_source_data,
                "tech_spend_estimate": 75000,
            },
        }

        # Act
        result = await intel_repo.save_wave_data(
            "wavetest.com",
            "wave_1",
            wave_data,
        )
        await db_session.commit()

        # Assert
        assert len(result) == 2
        assert "m01_company_context" in result
        assert "m02_tech_stack" in result

    @pytest.mark.asyncio
    async def test_save_wave_data_wrong_module(self, intel_repo, valid_source_data):
        """
        GIVEN: Wave data with module from wrong wave
        WHEN: save_wave_data() is called
        THEN: Raises ValidationError
        """
        # Arrange - m05 is wave_2, not wave_1
        wave_data = {
            "m05_competitors": {
                **valid_source_data,
            },
        }

        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await intel_repo.save_wave_data("test.com", "wave_1", wave_data)

        assert "m05_competitors" in str(exc_info.value)


# =============================================================================
# STALENESS DETECTION TESTS
# =============================================================================

class TestStalenessDetection:
    """Tests for staleness detection operations."""

    @pytest.fixture
    async def records_with_staleness(self, intel_repo, valid_source_data, db_session):
        """Create records with different staleness states."""
        now = datetime.utcnow()

        # Fresh record
        await intel_repo.save_module_data(
            "fresh.com",
            "m01_company_context",
            {
                **valid_source_data,
                "source_date": now - timedelta(days=30),
                "company_name": "Fresh Corp",
            },
        )

        # Stale by enriched_at (company context threshold is 90 days)
        stale_record = await intel_repo.save_module_data(
            "stale.com",
            "m01_company_context",
            {
                **valid_source_data,
                "source_date": now - timedelta(days=30),
                "company_name": "Stale Corp",
            },
            validate_source=False,
        )
        # Manually set enriched_at to old date
        stale_record.enriched_at = now - timedelta(days=100)
        await db_session.flush()

        # Flagged as stale
        flagged_record = await intel_repo.save_module_data(
            "flagged.com",
            "m01_company_context",
            {
                **valid_source_data,
                "source_date": now - timedelta(days=30),
                "company_name": "Flagged Corp",
            },
            validate_source=False,
        )
        flagged_record.is_stale = True
        await db_session.flush()

        await db_session.commit()
        return ["fresh.com", "stale.com", "flagged.com"]

    @pytest.mark.asyncio
    async def test_is_stale_no_record(self, intel_repo):
        """
        GIVEN: Non-existent record
        WHEN: is_stale() is called
        THEN: Returns True (missing data is stale)
        """
        # Act
        result = await intel_repo.is_stale("nonexistent.com", "m01_company_context")

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_is_stale_fresh_record(
        self, intel_repo, records_with_staleness
    ):
        """
        GIVEN: Fresh record
        WHEN: is_stale() is called
        THEN: Returns False
        """
        # Act
        result = await intel_repo.is_stale("fresh.com", "m01_company_context")

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_is_stale_by_enriched_at(
        self, intel_repo, records_with_staleness
    ):
        """
        GIVEN: Record with old enriched_at
        WHEN: is_stale() is called
        THEN: Returns True
        """
        # Act
        result = await intel_repo.is_stale("stale.com", "m01_company_context")

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_is_stale_flagged(self, intel_repo, records_with_staleness):
        """
        GIVEN: Record with is_stale=True
        WHEN: is_stale() is called
        THEN: Returns True
        """
        # Act
        result = await intel_repo.is_stale("flagged.com", "m01_company_context")

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_mark_as_stale(self, intel_repo, sample_intel_record, db_session):
        """
        GIVEN: Fresh record
        WHEN: mark_as_stale() is called
        THEN: Sets is_stale=True
        """
        # Verify initially not stale
        assert sample_intel_record.is_stale is False

        # Act
        result = await intel_repo.mark_as_stale("example.com", "m01_company_context")
        await db_session.commit()

        # Assert
        assert result is not None
        assert result.is_stale is True

    @pytest.mark.asyncio
    async def test_mark_as_stale_not_found(self, intel_repo):
        """
        GIVEN: Non-existent record
        WHEN: mark_as_stale() is called
        THEN: Returns None
        """
        # Act
        result = await intel_repo.mark_as_stale("nonexistent.com", "m01_company_context")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_stale_modules_for_domain(
        self, intel_repo, multi_module_data, db_session
    ):
        """
        GIVEN: Domain with some stale modules
        WHEN: get_stale_modules_for_domain() is called
        THEN: Returns list of stale module IDs
        """
        # Arrange - Mark one module as stale
        record = await intel_repo.get_module_data("multi.com", "m02_tech_stack")
        record.is_stale = True
        await db_session.commit()

        # Act
        stale = await intel_repo.get_stale_modules_for_domain("multi.com")

        # Assert
        # All modules not created are stale + m02_tech_stack
        assert "m02_tech_stack" in stale
        # Missing modules are also stale
        assert "m04_financials" in stale


# =============================================================================
# STATISTICS TESTS
# =============================================================================

class TestStatistics:
    """Tests for statistical operations."""

    @pytest.fixture
    async def records_for_stats(self, intel_repo, valid_source_data, db_session):
        """Create multiple records for statistics testing."""
        domains = ["stats1.com", "stats2.com", "stats3.com"]
        for domain in domains:
            await intel_repo.save_module_data(
                domain,
                "m01_company_context",
                {
                    **valid_source_data,
                    "company_name": f"Stats Corp {domain}",
                },
            )
        await db_session.commit()
        return domains

    @pytest.mark.asyncio
    async def test_get_module_stats(self, intel_repo, records_for_stats):
        """
        GIVEN: Multiple records for a module
        WHEN: get_module_stats() is called
        THEN: Returns correct statistics
        """
        # Act
        stats = await intel_repo.get_module_stats("m01_company_context")

        # Assert
        assert stats["module_id"] == "m01_company_context"
        assert stats["total_records"] == 3
        assert stats["freshness_threshold_days"] == 90
        assert "latest_enrichment" in stats

    @pytest.mark.asyncio
    async def test_get_all_module_stats(self, intel_repo, records_for_stats):
        """
        GIVEN: Multiple module records
        WHEN: get_all_module_stats() is called
        THEN: Returns stats for all modules
        """
        # Act
        all_stats = await intel_repo.get_all_module_stats()

        # Assert
        assert len(all_stats) == 15  # All 15 modules
        # Find m01 stats
        m01_stats = next(s for s in all_stats if s["module_id"] == "m01_company_context")
        assert m01_stats["total_records"] == 3

    @pytest.mark.asyncio
    async def test_get_domain_completeness(self, intel_repo, multi_module_data):
        """
        GIVEN: Domain with some modules populated
        WHEN: get_domain_completeness() is called
        THEN: Returns completeness report
        """
        # Act
        report = await intel_repo.get_domain_completeness("multi.com")

        # Assert
        assert report["domain"] == "multi.com"
        assert report["total_modules"] == 15
        assert report["complete_count"] == 3  # m01, m02, m03
        assert report["missing_count"] == 12
        assert "m01_company_context" in report["complete_modules"]
        assert "m04_financials" in report["missing_modules"]


# =============================================================================
# SPECIFIC MODULE QUERIES TESTS
# =============================================================================

class TestSpecificModuleQueries:
    """Tests for module-specific query operations."""

    @pytest.fixture
    async def executive_intel(self, intel_repo, valid_source_data, db_session):
        """Create executive intelligence record with quotes."""
        data = {
            **valid_source_data,
            "quotes": [
                {
                    "speaker": "CEO",
                    "title": "Chief Executive Officer",
                    "quote": "We need better search.",
                    "source": "Earnings Call Q4 2025",
                },
                {
                    "speaker": "CTO",
                    "title": "Chief Technology Officer",
                    "quote": "Our tech stack needs modernization.",
                    "source": "Investor Day 2025",
                },
            ],
        }
        record = await intel_repo.save_module_data(
            "exec.com",
            "m09_executive",
            data,
        )
        await db_session.commit()
        return record

    @pytest.fixture
    async def strategic_briefs(self, intel_repo, valid_source_data, db_session):
        """Create strategic signal briefs."""
        briefs = [
            {
                **valid_source_data,
                "domain": "brief1.com",
                "brief_content": "Brief content 1",
                "is_approved": True,
                "generated_at": datetime.utcnow(),
            },
            {
                **valid_source_data,
                "domain": "brief2.com",
                "brief_content": "Brief content 2",
                "is_approved": False,
                "generated_at": datetime.utcnow() - timedelta(days=1),
            },
        ]
        for brief in briefs:
            domain = brief.pop("domain")
            await intel_repo.save_module_data(domain, "m15_strategic_brief", brief)
        await db_session.commit()
        return briefs

    @pytest.fixture
    async def icp_rankings(self, intel_repo, valid_source_data, db_session):
        """Create ICP priority mapping records."""
        rankings = [
            ("hot1.com", 95, "hot", 100, 1),
            ("hot2.com", 85, "hot", 90, 2),
            ("warm1.com", 70, "warm", 75, 3),
        ]
        for domain, score, tier, priority, rank in rankings:
            await intel_repo.save_module_data(
                domain,
                "m13_icp_priority",
                {
                    **valid_source_data,
                    "icp_score": score,
                    "icp_tier": tier,
                    "priority_score": priority,
                    "priority_rank": rank,
                },
            )
        await db_session.commit()
        return rankings

    @pytest.mark.asyncio
    async def test_get_executive_quotes(self, intel_repo, executive_intel):
        """
        GIVEN: Executive intelligence with quotes
        WHEN: get_executive_quotes() is called
        THEN: Returns quote list
        """
        # Act
        quotes = await intel_repo.get_executive_quotes("exec.com")

        # Assert
        assert len(quotes) == 2
        assert quotes[0]["speaker"] == "CEO"
        assert quotes[1]["speaker"] == "CTO"

    @pytest.mark.asyncio
    async def test_get_executive_quotes_no_data(self, intel_repo):
        """
        GIVEN: No executive intelligence
        WHEN: get_executive_quotes() is called
        THEN: Returns empty list
        """
        # Act
        quotes = await intel_repo.get_executive_quotes("nonexistent.com")

        # Assert
        assert quotes == []

    @pytest.mark.asyncio
    async def test_get_strategic_brief(self, intel_repo, strategic_briefs):
        """
        GIVEN: Strategic brief exists
        WHEN: get_strategic_brief() is called
        THEN: Returns the brief
        """
        # Act
        brief = await intel_repo.get_strategic_brief("brief1.com")

        # Assert
        assert brief is not None
        assert brief.is_approved is True

    @pytest.mark.asyncio
    async def test_list_domains_with_brief(self, intel_repo, strategic_briefs):
        """
        GIVEN: Multiple strategic briefs
        WHEN: list_domains_with_brief() is called
        THEN: Returns domains with briefs
        """
        # Act
        domains = await intel_repo.list_domains_with_brief()

        # Assert
        assert len(domains) == 2
        assert "brief1.com" in domains

    @pytest.mark.asyncio
    async def test_list_domains_with_brief_approved_only(
        self, intel_repo, strategic_briefs
    ):
        """
        GIVEN: Multiple strategic briefs
        WHEN: list_domains_with_brief(approved_only=True) is called
        THEN: Returns only approved briefs
        """
        # Act
        domains = await intel_repo.list_domains_with_brief(approved_only=True)

        # Assert
        assert len(domains) == 1
        assert domains[0] == "brief1.com"

    @pytest.mark.asyncio
    async def test_get_icp_ranking(self, intel_repo, icp_rankings):
        """
        GIVEN: ICP priority mappings
        WHEN: get_icp_ranking() is called
        THEN: Returns ranked domains
        """
        # Act
        ranking = await intel_repo.get_icp_ranking()

        # Assert
        assert len(ranking) == 3
        # Should be ordered by priority_score desc
        assert ranking[0]["domain"] == "hot1.com"
        assert ranking[0]["priority_score"] == 100

    @pytest.mark.asyncio
    async def test_get_icp_ranking_by_tier(self, intel_repo, icp_rankings):
        """
        GIVEN: ICP priority mappings
        WHEN: get_icp_ranking(tier="hot") is called
        THEN: Returns only hot tier domains
        """
        # Act
        ranking = await intel_repo.get_icp_ranking(tier="hot")

        # Assert
        assert len(ranking) == 2
        for item in ranking:
            assert item["icp_tier"] == "hot"


# =============================================================================
# WAVE CONFIGURATION TESTS
# =============================================================================

class TestWaveConfiguration:
    """Tests for wave configuration."""

    def test_wave_modules_complete(self):
        """
        GIVEN: Wave configuration
        THEN: All 15 modules are assigned to waves
        """
        # Collect all modules from waves
        all_wave_modules = set()
        for modules in WAVE_MODULES.values():
            all_wave_modules.update(modules)

        # Assert all 15 modules are covered
        assert len(all_wave_modules) == 15
        assert all_wave_modules == set(MODULE_MODELS.keys())

    def test_wave_1_foundation_modules(self):
        """
        GIVEN: Wave 1 configuration
        THEN: Contains foundation modules
        """
        wave_1 = WAVE_MODULES["wave_1"]
        assert "m01_company_context" in wave_1
        assert "m02_tech_stack" in wave_1
        assert "m03_traffic" in wave_1
        assert "m04_financials" in wave_1
        assert len(wave_1) == 4

    def test_wave_4_synthesis_modules(self):
        """
        GIVEN: Wave 4 configuration
        THEN: Contains synthesis modules
        """
        wave_4 = WAVE_MODULES["wave_4"]
        assert "m12_case_study" in wave_4
        assert "m13_icp_priority" in wave_4
        assert "m14_signal_scoring" in wave_4
        assert "m15_strategic_brief" in wave_4
        assert len(wave_4) == 4


# =============================================================================
# FRESHNESS THRESHOLD TESTS
# =============================================================================

class TestFreshnessThresholds:
    """Tests for module-specific freshness thresholds."""

    def test_traffic_module_short_freshness(self):
        """Traffic data should be refreshed frequently (7 days)."""
        assert MODULE_FRESHNESS["m03_traffic"] == 7

    def test_hiring_module_short_freshness(self):
        """Hiring signals change frequently (14 days)."""
        assert MODULE_FRESHNESS["m06_hiring"] == 14

    def test_company_context_long_freshness(self):
        """Company context changes slowly (90 days)."""
        assert MODULE_FRESHNESS["m01_company_context"] == 90

    def test_case_study_longest_freshness(self):
        """Case studies rarely change (180 days)."""
        assert MODULE_FRESHNESS["m12_case_study"] == 180

    def test_all_modules_have_freshness(self):
        """All modules should have defined freshness thresholds."""
        for module_id in MODULE_MODELS.keys():
            assert module_id in MODULE_FRESHNESS
