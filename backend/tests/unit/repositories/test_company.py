"""
Test Suite: Company Repository

Module Under Test: backend/app/repositories/company.py
Author: Thread 1 - Backend Architecture
Created: 2026-02-25

Test Categories:
1. Happy Path - Domain operations, vertical filtering, consent tracking
2. Edge Cases - Empty data, missing relations, pagination
3. Error Handling - Not found, invalid consent types
4. Technology Stack Operations
5. Case Study Operations
6. Algolia Customer Status
7. Search and Competitor Displacement
"""

import pytest
from datetime import datetime
from typing import Any, Dict
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.core import Company, Technology, CompanyTechnology, CustomerLogo
from app.models.evidence import CaseStudy
from app.models.targets import DisplacementTarget
from app.repositories.company import CompanyRepository
from app.repositories.base import NotFoundError, ValidationError


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
def company_repo(db_session):
    """Create company repository instance."""
    return CompanyRepository(db_session)


@pytest.fixture
def sample_company_data():
    """Sample company data for creating test entities."""
    return {
        "domain": "acme.com",
        "name": "ACME Corporation",
        "vertical": "Retail",
        "sub_vertical": "E-commerce",
        "country": "United States",
        "country_code": "US",
        "is_algolia_customer": True,
        "algolia_arr": 50000.0,
        "algolia_products": '["Search", "Recommend"]',
        "has_logo_rights": False,
        "has_case_study_consent": False,
        "has_reference_consent": False,
    }


@pytest.fixture
async def sample_company(company_repo, sample_company_data, db_session):
    """Create a sample company in the database."""
    company = await company_repo.create(sample_company_data, validate_source=False)
    await db_session.commit()
    return company


@pytest.fixture
async def sample_technology(db_session):
    """Create a sample technology in the database."""
    tech = Technology(
        name="Adobe AEM",
        category="CMS",
        is_partner=True,
        is_competitor=False,
    )
    db_session.add(tech)
    await db_session.commit()
    return tech


# =============================================================================
# HAPPY PATH TESTS - Domain Operations
# =============================================================================

class TestDomainOperations:
    """Tests for domain-based operations."""

    @pytest.mark.asyncio
    async def test_get_by_domain(self, company_repo, sample_company):
        """
        GIVEN: An existing company
        WHEN: get_by_domain() is called
        THEN: Returns the correct company
        """
        # Act
        result = await company_repo.get_by_domain("acme.com")

        # Assert
        assert result is not None
        assert result.domain == "acme.com"
        assert result.name == "ACME Corporation"

    @pytest.mark.asyncio
    async def test_get_by_domain_case_insensitive(self, company_repo, sample_company):
        """
        GIVEN: An existing company
        WHEN: get_by_domain() is called with different case
        THEN: Returns the correct company (case-insensitive)
        """
        # Act
        result = await company_repo.get_by_domain("ACME.COM")

        # Assert
        assert result is not None
        assert result.domain == "acme.com"

    @pytest.mark.asyncio
    async def test_get_by_domain_strips_whitespace(self, company_repo, sample_company):
        """
        GIVEN: An existing company
        WHEN: get_by_domain() is called with whitespace
        THEN: Returns the correct company (whitespace stripped)
        """
        # Act
        result = await company_repo.get_by_domain("  acme.com  ")

        # Assert
        assert result is not None
        assert result.domain == "acme.com"

    @pytest.mark.asyncio
    async def test_get_by_domain_not_found(self, company_repo):
        """
        GIVEN: Non-existent domain
        WHEN: get_by_domain() is called
        THEN: Returns None
        """
        # Act
        result = await company_repo.get_by_domain("nonexistent.com")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_domain_or_raise(self, company_repo, sample_company):
        """
        GIVEN: An existing company
        WHEN: get_by_domain_or_raise() is called
        THEN: Returns the company
        """
        # Act
        result = await company_repo.get_by_domain_or_raise("acme.com")

        # Assert
        assert result is not None
        assert result.domain == "acme.com"

    @pytest.mark.asyncio
    async def test_get_by_domain_or_raise_not_found(self, company_repo):
        """
        GIVEN: Non-existent domain
        WHEN: get_by_domain_or_raise() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            await company_repo.get_by_domain_or_raise("nonexistent.com")

        assert "nonexistent.com" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_domain_exists(self, company_repo, sample_company):
        """
        GIVEN: An existing company
        WHEN: domain_exists() is called
        THEN: Returns True
        """
        # Act
        result = await company_repo.domain_exists("acme.com")

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_domain_exists_not_found(self, company_repo):
        """
        GIVEN: Non-existent domain
        WHEN: domain_exists() is called
        THEN: Returns False
        """
        # Act
        result = await company_repo.domain_exists("nonexistent.com")

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_upsert_by_domain_create(self, company_repo, db_session):
        """
        GIVEN: New company data
        WHEN: upsert_by_domain() is called
        THEN: Creates new company
        """
        # Arrange
        data = {
            "name": "New Corp",
            "vertical": "Tech",
            "is_algolia_customer": True,
        }

        # Act
        company, created = await company_repo.upsert_by_domain("newcorp.com", data)
        await db_session.commit()

        # Assert
        assert created is True
        assert company.domain == "newcorp.com"
        assert company.name == "New Corp"

    @pytest.mark.asyncio
    async def test_upsert_by_domain_update(self, company_repo, sample_company, db_session):
        """
        GIVEN: Existing company
        WHEN: upsert_by_domain() is called with same domain
        THEN: Updates existing company
        """
        # Arrange
        data = {
            "name": "ACME Corporation Updated",
            "vertical": "Technology",
        }

        # Act
        company, created = await company_repo.upsert_by_domain("acme.com", data)
        await db_session.commit()

        # Assert
        assert created is False
        assert company.name == "ACME Corporation Updated"
        assert company.vertical == "Technology"


# =============================================================================
# HAPPY PATH TESTS - Vertical/Industry Filtering
# =============================================================================

class TestVerticalFiltering:
    """Tests for vertical/industry filtering operations."""

    @pytest.fixture
    async def companies_by_vertical(self, company_repo, db_session):
        """Create companies with different verticals."""
        verticals = [
            ("retail1.com", "Retailer 1", "Retail", "E-commerce"),
            ("retail2.com", "Retailer 2", "Retail", "E-commerce"),
            ("retail3.com", "Retailer 3", "Retail", "Brick and Mortar"),
            ("media1.com", "Media 1", "Media", "Streaming"),
            ("tech1.com", "Tech 1", "Technology", None),
        ]
        companies = []
        for domain, name, vertical, sub_vertical in verticals:
            company = await company_repo.create({
                "domain": domain,
                "name": name,
                "vertical": vertical,
                "sub_vertical": sub_vertical,
                "is_algolia_customer": True,
            }, validate_source=False)
            companies.append(company)
        await db_session.commit()
        return companies

    @pytest.mark.asyncio
    async def test_list_by_vertical(self, company_repo, companies_by_vertical):
        """
        GIVEN: Companies with different verticals
        WHEN: list_by_vertical() is called
        THEN: Returns only companies in that vertical
        """
        # Act
        retail_companies = await company_repo.list_by_vertical("Retail")

        # Assert
        assert len(retail_companies) == 3
        for company in retail_companies:
            assert company.vertical == "Retail"

    @pytest.mark.asyncio
    async def test_list_by_vertical_with_sub_vertical(
        self, company_repo, companies_by_vertical
    ):
        """
        GIVEN: Companies with different sub-verticals
        WHEN: list_by_vertical() is called with sub_vertical
        THEN: Returns only matching companies
        """
        # Act
        ecommerce_companies = await company_repo.list_by_vertical(
            "Retail", sub_vertical="E-commerce"
        )

        # Assert
        assert len(ecommerce_companies) == 2
        for company in ecommerce_companies:
            assert company.vertical == "Retail"
            assert company.sub_vertical == "E-commerce"

    @pytest.mark.asyncio
    async def test_list_by_vertical_with_pagination(
        self, company_repo, companies_by_vertical
    ):
        """
        GIVEN: Multiple companies in a vertical
        WHEN: list_by_vertical() is called with limit and offset
        THEN: Returns paginated results
        """
        # Act
        page1 = await company_repo.list_by_vertical("Retail", limit=2, offset=0)
        page2 = await company_repo.list_by_vertical("Retail", limit=2, offset=2)

        # Assert
        assert len(page1) == 2
        assert len(page2) == 1

    @pytest.mark.asyncio
    async def test_get_verticals(self, company_repo, companies_by_vertical):
        """
        GIVEN: Companies with different verticals
        WHEN: get_verticals() is called
        THEN: Returns unique verticals with counts
        """
        # Act
        verticals = await company_repo.get_verticals()

        # Assert
        assert len(verticals) == 3
        # Should be ordered by count desc
        vertical_dict = {v["vertical"]: v["count"] for v in verticals}
        assert vertical_dict["Retail"] == 3
        assert vertical_dict["Media"] == 1
        assert vertical_dict["Technology"] == 1

    @pytest.mark.asyncio
    async def test_get_sub_verticals(self, company_repo, companies_by_vertical):
        """
        GIVEN: Companies with different sub-verticals
        WHEN: get_sub_verticals() is called
        THEN: Returns sub-verticals for the vertical with counts
        """
        # Act
        sub_verticals = await company_repo.get_sub_verticals("Retail")

        # Assert
        assert len(sub_verticals) == 2
        sub_vertical_dict = {sv["sub_vertical"]: sv["count"] for sv in sub_verticals}
        assert sub_vertical_dict["E-commerce"] == 2
        assert sub_vertical_dict["Brick and Mortar"] == 1


# =============================================================================
# HAPPY PATH TESTS - Consent Operations
# =============================================================================

class TestConsentOperations:
    """Tests for consent/permission tracking."""

    @pytest.fixture
    async def companies_with_consent(self, company_repo, db_session):
        """Create companies with different consent flags."""
        companies_data = [
            {
                "domain": "logo1.com",
                "name": "Logo 1",
                "has_logo_rights": True,
                "has_case_study_consent": False,
                "has_reference_consent": False,
            },
            {
                "domain": "logo2.com",
                "name": "Logo 2",
                "has_logo_rights": True,
                "has_case_study_consent": True,
                "has_reference_consent": False,
            },
            {
                "domain": "case1.com",
                "name": "Case 1",
                "has_logo_rights": False,
                "has_case_study_consent": True,
                "has_reference_consent": False,
            },
            {
                "domain": "ref1.com",
                "name": "Ref 1",
                "has_logo_rights": False,
                "has_case_study_consent": False,
                "has_reference_consent": True,
            },
            {
                "domain": "none1.com",
                "name": "None 1",
                "has_logo_rights": False,
                "has_case_study_consent": False,
                "has_reference_consent": False,
            },
        ]
        companies = []
        for data in companies_data:
            data["is_algolia_customer"] = True
            company = await company_repo.create(data, validate_source=False)
            companies.append(company)
        await db_session.commit()
        return companies

    @pytest.mark.asyncio
    async def test_list_with_consent_logo(
        self, company_repo, companies_with_consent
    ):
        """
        GIVEN: Companies with different consent flags
        WHEN: list_with_consent("logo") is called
        THEN: Returns only companies with logo rights
        """
        # Act
        companies = await company_repo.list_with_consent("logo")

        # Assert
        assert len(companies) == 2
        for company in companies:
            assert company.has_logo_rights is True

    @pytest.mark.asyncio
    async def test_list_with_consent_case_study(
        self, company_repo, companies_with_consent
    ):
        """
        GIVEN: Companies with different consent flags
        WHEN: list_with_consent("case_study") is called
        THEN: Returns only companies with case study consent
        """
        # Act
        companies = await company_repo.list_with_consent("case_study")

        # Assert
        assert len(companies) == 2
        for company in companies:
            assert company.has_case_study_consent is True

    @pytest.mark.asyncio
    async def test_list_with_consent_reference(
        self, company_repo, companies_with_consent
    ):
        """
        GIVEN: Companies with different consent flags
        WHEN: list_with_consent("reference") is called
        THEN: Returns only companies with reference consent
        """
        # Act
        companies = await company_repo.list_with_consent("reference")

        # Assert
        assert len(companies) == 1
        assert companies[0].has_reference_consent is True

    @pytest.mark.asyncio
    async def test_list_with_consent_invalid_type(self, company_repo):
        """
        GIVEN: Invalid consent type
        WHEN: list_with_consent() is called
        THEN: Raises ValidationError
        """
        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await company_repo.list_with_consent("invalid_type")

        assert "invalid_type" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_update_consent(self, company_repo, sample_company, db_session):
        """
        GIVEN: An existing company
        WHEN: update_consent() is called
        THEN: Updates consent flags correctly
        """
        # Verify initial state
        assert sample_company.has_logo_rights is False
        assert sample_company.has_case_study_consent is False

        # Act
        updated = await company_repo.update_consent(
            "acme.com",
            has_logo_rights=True,
            has_case_study_consent=True,
        )
        await db_session.commit()

        # Assert
        assert updated.has_logo_rights is True
        assert updated.has_case_study_consent is True
        # Reference consent should remain unchanged
        assert updated.has_reference_consent is False

    @pytest.mark.asyncio
    async def test_update_consent_not_found(self, company_repo):
        """
        GIVEN: Non-existent domain
        WHEN: update_consent() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError):
            await company_repo.update_consent(
                "nonexistent.com",
                has_logo_rights=True,
            )

    @pytest.mark.asyncio
    async def test_update_consent_no_changes(
        self, company_repo, sample_company, db_session
    ):
        """
        GIVEN: An existing company
        WHEN: update_consent() is called with no changes
        THEN: Returns company unchanged
        """
        # Act
        result = await company_repo.update_consent("acme.com")

        # Assert
        assert result.id == sample_company.id


# =============================================================================
# TECHNOLOGY STACK TESTS
# =============================================================================

class TestTechnologyOperations:
    """Tests for technology stack operations."""

    @pytest.mark.asyncio
    async def test_add_technology(
        self, company_repo, sample_company, sample_technology, db_session
    ):
        """
        GIVEN: Company and technology exist
        WHEN: add_technology() is called
        THEN: Creates association correctly
        """
        # Act
        assoc = await company_repo.add_technology(
            "acme.com",
            "Adobe AEM",
            source="builtwith",
        )
        await db_session.commit()

        # Assert
        assert assoc is not None
        assert assoc.company_id == sample_company.id
        assert assoc.technology_id == sample_technology.id
        assert assoc.source == "builtwith"
        assert assoc.is_live is True

    @pytest.mark.asyncio
    async def test_add_technology_company_not_found(
        self, company_repo, sample_technology
    ):
        """
        GIVEN: Technology exists but company doesn't
        WHEN: add_technology() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError):
            await company_repo.add_technology("nonexistent.com", "Adobe AEM")

    @pytest.mark.asyncio
    async def test_add_technology_tech_not_found(
        self, company_repo, sample_company
    ):
        """
        GIVEN: Company exists but technology doesn't
        WHEN: add_technology() is called
        THEN: Raises ValidationError
        """
        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await company_repo.add_technology("acme.com", "Nonexistent Tech")

        assert "nonexistent tech" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_technologies_for_company(
        self, company_repo, sample_company, sample_technology, db_session
    ):
        """
        GIVEN: Company with technologies
        WHEN: get_technologies_for_company() is called
        THEN: Returns technology details
        """
        # Arrange - Add technology
        await company_repo.add_technology("acme.com", "Adobe AEM", source="builtwith")
        await db_session.commit()

        # Act
        technologies = await company_repo.get_technologies_for_company("acme.com")

        # Assert
        assert len(technologies) == 1
        assert technologies[0]["name"] == "Adobe AEM"
        assert technologies[0]["category"] == "CMS"
        assert technologies[0]["is_partner"] is True
        assert technologies[0]["source"] == "builtwith"

    @pytest.mark.asyncio
    async def test_get_technologies_for_company_empty(
        self, company_repo, sample_company
    ):
        """
        GIVEN: Company with no technologies
        WHEN: get_technologies_for_company() is called
        THEN: Returns empty list
        """
        # Act
        technologies = await company_repo.get_technologies_for_company("acme.com")

        # Assert
        assert technologies == []


# =============================================================================
# ALGOLIA CUSTOMER STATUS TESTS
# =============================================================================

class TestAlgoliaCustomerStatus:
    """Tests for Algolia customer status operations."""

    @pytest.fixture
    async def algolia_customers(self, company_repo, db_session):
        """Create Algolia customers with different ARR values."""
        customers = [
            {
                "domain": "big.com",
                "name": "Big Corp",
                "is_algolia_customer": True,
                "algolia_arr": 100000.0,
                "algolia_products": '["Search"]',
                "has_logo_rights": True,
                "has_case_study_consent": True,
                "has_reference_consent": True,
            },
            {
                "domain": "medium.com",
                "name": "Medium Corp",
                "is_algolia_customer": True,
                "algolia_arr": 50000.0,
                "algolia_products": '["Search", "Recommend"]',
                "has_logo_rights": True,
                "has_case_study_consent": False,
                "has_reference_consent": False,
            },
            {
                "domain": "small.com",
                "name": "Small Corp",
                "is_algolia_customer": True,
                "algolia_arr": 10000.0,
                "algolia_products": '["Search"]',
                "has_logo_rights": False,
                "has_case_study_consent": False,
                "has_reference_consent": False,
            },
            {
                "domain": "noncustomer.com",
                "name": "Non Customer",
                "is_algolia_customer": False,
                "algolia_arr": None,
            },
        ]
        result = []
        for data in customers:
            company = await company_repo.create(data, validate_source=False)
            result.append(company)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_list_algolia_customers(self, company_repo, algolia_customers):
        """
        GIVEN: Mix of Algolia customers and non-customers
        WHEN: list_algolia_customers() is called
        THEN: Returns only Algolia customers
        """
        # Act
        customers = await company_repo.list_algolia_customers()

        # Assert
        assert len(customers) == 3
        for customer in customers:
            assert customer.is_algolia_customer is True

    @pytest.mark.asyncio
    async def test_list_algolia_customers_with_min_arr(
        self, company_repo, algolia_customers
    ):
        """
        GIVEN: Algolia customers with different ARR
        WHEN: list_algolia_customers() is called with min_arr
        THEN: Returns customers above ARR threshold
        """
        # Act
        customers = await company_repo.list_algolia_customers(min_arr=50000)

        # Assert
        assert len(customers) == 2
        for customer in customers:
            assert customer.algolia_arr >= 50000

    @pytest.mark.asyncio
    async def test_list_algolia_customers_ordered_by_arr(
        self, company_repo, algolia_customers
    ):
        """
        GIVEN: Algolia customers
        WHEN: list_algolia_customers() is called
        THEN: Returns customers ordered by ARR descending
        """
        # Act
        customers = await company_repo.list_algolia_customers()

        # Assert
        arr_values = [c.algolia_arr for c in customers]
        assert arr_values == sorted(arr_values, reverse=True)

    @pytest.mark.asyncio
    async def test_get_customer_stats(self, company_repo, algolia_customers):
        """
        GIVEN: Algolia customers
        WHEN: get_customer_stats() is called
        THEN: Returns correct aggregate statistics
        """
        # Act
        stats = await company_repo.get_customer_stats()

        # Assert
        assert stats["total_customers"] == 3
        assert stats["total_arr"] == 160000.0  # 100k + 50k + 10k
        assert stats["avg_arr"] == pytest.approx(53333.33, rel=0.01)
        assert stats["with_logo_rights"] == 2
        assert stats["with_case_study_consent"] == 1
        assert stats["with_reference_consent"] == 1


# =============================================================================
# SEARCH OPERATIONS TESTS
# =============================================================================

class TestSearchOperations:
    """Tests for search operations."""

    @pytest.fixture
    async def searchable_companies(self, company_repo, db_session):
        """Create companies for search testing."""
        companies = [
            {"domain": "costco.com", "name": "Costco Wholesale"},
            {"domain": "walmart.com", "name": "Walmart Inc"},
            {"domain": "target.com", "name": "Target Corporation"},
            {"domain": "acme-costco.com", "name": "ACME Cost-co"},
        ]
        result = []
        for data in companies:
            data["is_algolia_customer"] = True
            company = await company_repo.create(data, validate_source=False)
            result.append(company)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_search_by_name(self, company_repo, searchable_companies):
        """
        GIVEN: Multiple companies
        WHEN: search() is called with name query
        THEN: Returns matching companies
        """
        # Act
        results = await company_repo.search("costco")

        # Assert
        assert len(results) == 2  # costco.com and acme-costco.com
        names = [r.name.lower() for r in results]
        for name in names:
            assert "cost" in name

    @pytest.mark.asyncio
    async def test_search_by_domain(self, company_repo, searchable_companies):
        """
        GIVEN: Multiple companies
        WHEN: search() is called with domain query
        THEN: Returns matching companies
        """
        # Act
        results = await company_repo.search("walmart")

        # Assert
        assert len(results) == 1
        assert results[0].domain == "walmart.com"

    @pytest.mark.asyncio
    async def test_search_case_insensitive(self, company_repo, searchable_companies):
        """
        GIVEN: Companies
        WHEN: search() is called with different case
        THEN: Returns matches case-insensitively
        """
        # Act
        results = await company_repo.search("COSTCO")

        # Assert
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_search_no_results(self, company_repo, searchable_companies):
        """
        GIVEN: Companies
        WHEN: search() is called with no matches
        THEN: Returns empty list
        """
        # Act
        results = await company_repo.search("nonexistent")

        # Assert
        assert results == []

    @pytest.mark.asyncio
    async def test_search_with_limit(self, company_repo, searchable_companies):
        """
        GIVEN: Companies
        WHEN: search() is called with limit
        THEN: Returns limited results
        """
        # Act
        results = await company_repo.search("co", limit=2)

        # Assert
        assert len(results) <= 2


# =============================================================================
# COMPETITOR DISPLACEMENT TESTS
# =============================================================================

class TestCompetitorDisplacement:
    """Tests for competitor displacement operations."""

    @pytest.fixture
    async def companies_with_displacement(self, company_repo, db_session):
        """Create companies with competitor displacement info."""
        companies = [
            {
                "domain": "displaced1.com",
                "name": "Displaced 1",
                "is_algolia_customer": True,
                "competitor_displaced": "Elasticsearch",
            },
            {
                "domain": "displaced2.com",
                "name": "Displaced 2",
                "is_algolia_customer": True,
                "competitor_displaced": "Elasticsearch, Solr",
            },
            {
                "domain": "displaced3.com",
                "name": "Displaced 3",
                "is_algolia_customer": True,
                "competitor_displaced": "Coveo",
            },
            {
                "domain": "nodisplace.com",
                "name": "No Displace",
                "is_algolia_customer": True,
                "competitor_displaced": None,
            },
        ]
        result = []
        for data in companies:
            company = await company_repo.create(data, validate_source=False)
            result.append(company)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_list_customers_by_competitor_displaced(
        self, company_repo, companies_with_displacement
    ):
        """
        GIVEN: Companies with competitor displacement info
        WHEN: list_customers_by_competitor_displaced() is called
        THEN: Returns companies that displaced the competitor
        """
        # Act
        results = await company_repo.list_customers_by_competitor_displaced("Elasticsearch")

        # Assert
        assert len(results) == 2
        for result in results:
            assert "elasticsearch" in result.competitor_displaced.lower()

    @pytest.mark.asyncio
    async def test_list_customers_by_competitor_displaced_case_insensitive(
        self, company_repo, companies_with_displacement
    ):
        """
        GIVEN: Companies with competitor displacement info
        WHEN: list_customers_by_competitor_displaced() is called with different case
        THEN: Returns matches case-insensitively
        """
        # Act
        results = await company_repo.list_customers_by_competitor_displaced("COVEO")

        # Assert
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_list_customers_by_competitor_displaced_no_results(
        self, company_repo, companies_with_displacement
    ):
        """
        GIVEN: Companies
        WHEN: list_customers_by_competitor_displaced() with no matches
        THEN: Returns empty list
        """
        # Act
        results = await company_repo.list_customers_by_competitor_displaced("MongoDB")

        # Assert
        assert results == []


# =============================================================================
# SOURCE CITATION TESTS
# =============================================================================

class TestSourceCitation:
    """Tests for source citation validation."""

    @pytest.mark.asyncio
    async def test_validate_source_citation_always_passes(self, company_repo):
        """
        GIVEN: Any company data
        WHEN: validate_source_citation() is called
        THEN: Always returns True (companies don't require strict source citation)
        """
        # Arrange
        data = {
            "domain": "test.com",
            "name": "Test Corp",
            "algolia_arr": 50000.0,  # Even with ARR, should pass
        }

        # Act
        result = company_repo.validate_source_citation(data)

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_create_without_source(self, company_repo, db_session):
        """
        GIVEN: Company data without source citation
        WHEN: create() is called
        THEN: Succeeds (companies are internal records)
        """
        # Arrange
        data = {
            "domain": "nosource.com",
            "name": "No Source Corp",
            "is_algolia_customer": True,
        }

        # Act
        company = await company_repo.create(data, validate_source=True)
        await db_session.commit()

        # Assert
        assert company is not None
        assert company.domain == "nosource.com"


# =============================================================================
# INTELLIGENCE OPERATIONS TESTS
# =============================================================================

class TestIntelligenceOperations:
    """Tests for intelligence-related operations."""

    @pytest.fixture
    async def company_with_target(self, company_repo, db_session):
        """Create a company that also exists as a displacement target."""
        # Create the company
        company = await company_repo.create({
            "domain": "targetco.com",
            "name": "Target Co",
            "vertical": "Retail",
            "is_algolia_customer": False,
        }, validate_source=False)

        # Create displacement target with intelligence data
        target = DisplacementTarget(
            domain="targetco.com",
            company_name="Target Co",
            icp_score=85,
            icp_tier=1,  # Integer representing tier level
            icp_tier_name="hot",
            vertical="Retail",
            partner_tech="Adobe AEM",
            financials_json='{"revenue": 1000000}',
            hiring_signals="Hiring engineers",
            tech_stack_json='["Adobe AEM", "React"]',
            exec_quote="We need better search",
            trigger_events="Recent funding round",
            competitors_using_algolia="Competitor A uses Algolia",
            displacement_angle="Better performance",
        )
        db_session.add(target)
        await db_session.commit()
        return company, target

    @pytest.fixture
    async def company_without_target(self, company_repo, db_session):
        """Create a company without displacement target data."""
        company = await company_repo.create({
            "domain": "nocampaign.com",
            "name": "No Campaign Co",
            "vertical": "Technology",
            "is_algolia_customer": True,
        }, validate_source=False)
        await db_session.commit()
        return company

    @pytest.fixture
    async def target_with_partial_intel(self, company_repo, db_session):
        """Create a target with only partial intelligence data."""
        company = await company_repo.create({
            "domain": "partial.com",
            "name": "Partial Intel Co",
            "vertical": "Marketplace",
            "is_algolia_customer": False,
        }, validate_source=False)

        target = DisplacementTarget(
            domain="partial.com",
            company_name="Partial Intel Co",
            icp_score=65,
            icp_tier=2,  # Integer representing tier level
            icp_tier_name="warm",
            vertical="Marketplace",
            partner_tech="Shopify",
            financials_json='{"revenue": 500000}',
            hiring_signals=None,  # Missing
            tech_stack_json='["Shopify"]',
            exec_quote=None,  # Missing
            trigger_events=None,  # Missing
            competitors_using_algolia=None,  # Missing
            displacement_angle=None,  # Missing
        )
        db_session.add(target)
        await db_session.commit()
        return company, target

    # -------------------------------------------------------------------------
    # get_with_intelligence() tests
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_get_with_intelligence_found(
        self, company_repo, company_with_target
    ):
        """
        GIVEN: Company with associated displacement target
        WHEN: get_with_intelligence() is called
        THEN: Returns company with target data and intelligence metrics
        """
        company, target = company_with_target

        # Act
        result = await company_repo.get_with_intelligence("targetco.com")

        # Assert
        assert result is not None
        assert result["company"].domain == "targetco.com"
        assert result["target"] is not None
        assert result["target"].icp_score == 85
        assert result["has_intelligence"] is True
        # All 7 intel fields are filled: 7/7 = 100%
        assert result["intelligence_completeness"] == 100.0

    @pytest.mark.asyncio
    async def test_get_with_intelligence_partial(
        self, company_repo, target_with_partial_intel
    ):
        """
        GIVEN: Company with partial intelligence data
        WHEN: get_with_intelligence() is called
        THEN: Returns company with correct completeness percentage
        """
        company, target = target_with_partial_intel

        # Act
        result = await company_repo.get_with_intelligence("partial.com")

        # Assert
        assert result is not None
        assert result["has_intelligence"] is True
        # Only 2 of 7 fields filled: financials_json, tech_stack_json
        # 2/7 = ~28.57%
        assert result["intelligence_completeness"] == pytest.approx(28.57, rel=0.1)

    @pytest.mark.asyncio
    async def test_get_with_intelligence_no_target(
        self, company_repo, company_without_target
    ):
        """
        GIVEN: Company without displacement target
        WHEN: get_with_intelligence() is called
        THEN: Returns company with no target data
        """
        # Act
        result = await company_repo.get_with_intelligence("nocampaign.com")

        # Assert
        assert result is not None
        assert result["company"].domain == "nocampaign.com"
        assert result["target"] is None
        assert result["has_intelligence"] is False
        assert result["intelligence_completeness"] == 0.0

    @pytest.mark.asyncio
    async def test_get_with_intelligence_not_found(self, company_repo):
        """
        GIVEN: Non-existent domain
        WHEN: get_with_intelligence() is called
        THEN: Returns None
        """
        # Act
        result = await company_repo.get_with_intelligence("nonexistent.com")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_with_intelligence_case_insensitive(
        self, company_repo, company_with_target
    ):
        """
        GIVEN: Company with target
        WHEN: get_with_intelligence() is called with different case
        THEN: Returns correct result (case-insensitive)
        """
        # Act
        result = await company_repo.get_with_intelligence("TARGETCO.COM")

        # Assert
        assert result is not None
        assert result["company"].domain == "targetco.com"

    @pytest.mark.asyncio
    async def test_get_with_intelligence_strips_whitespace(
        self, company_repo, company_with_target
    ):
        """
        GIVEN: Company with target
        WHEN: get_with_intelligence() is called with whitespace
        THEN: Returns correct result (whitespace stripped)
        """
        # Act
        result = await company_repo.get_with_intelligence("  targetco.com  ")

        # Assert
        assert result is not None
        assert result["company"].domain == "targetco.com"

    # -------------------------------------------------------------------------
    # search_companies() tests
    # -------------------------------------------------------------------------

    @pytest.fixture
    async def searchable_companies_with_targets(self, company_repo, db_session):
        """Create companies for search testing, some with targets."""
        # Companies
        companies = []
        for data in [
            {"domain": "retailer.com", "name": "Retail Corp", "vertical": "Retail"},
            {"domain": "techfirm.com", "name": "Tech Firm", "vertical": "Technology"},
            {"domain": "retailstore.com", "name": "Retail Store Inc", "vertical": "Retail"},
            {"domain": "marketplace.com", "name": "Marketplace Co", "vertical": "Marketplace"},
        ]:
            data["is_algolia_customer"] = False
            company = await company_repo.create(data, validate_source=False)
            companies.append(company)

        # Create targets for some companies
        targets = [
            DisplacementTarget(
                domain="retailer.com",
                company_name="Retail Corp",
                icp_score=90,
                icp_tier=1,
                icp_tier_name="hot",
                vertical="Retail",
                partner_tech="Adobe AEM",
            ),
            DisplacementTarget(
                domain="retailstore.com",
                company_name="Retail Store Inc",
                icp_score=55,
                icp_tier=3,
                icp_tier_name="cool",
                vertical="Retail",
                partner_tech="Adobe AEM",
            ),
            DisplacementTarget(
                domain="marketplace.com",
                company_name="Marketplace Co",
                icp_score=75,
                icp_tier=2,
                icp_tier_name="warm",
                vertical="Marketplace",
                partner_tech="Shopify",
            ),
        ]
        for target in targets:
            db_session.add(target)

        await db_session.commit()
        return companies

    @pytest.mark.asyncio
    async def test_search_companies_basic(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Companies in database
        WHEN: search_companies() is called with query
        THEN: Returns matching companies
        """
        # Act
        results = await company_repo.search_companies("retail")

        # Assert
        assert len(results) == 2
        for result in results:
            assert "retail" in result["company"].name.lower() or \
                   "retail" in result["company"].domain.lower()

    @pytest.mark.asyncio
    async def test_search_companies_with_targets(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Companies with displacement targets
        WHEN: search_companies() is called with include_targets=True
        THEN: Returns companies with target data
        """
        # Act
        results = await company_repo.search_companies("retail", include_targets=True)

        # Assert
        assert len(results) == 2
        # retailer.com has a target, retailstore.com has a target
        for result in results:
            assert result["target"] is not None

    @pytest.mark.asyncio
    async def test_search_companies_without_targets(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Companies in database
        WHEN: search_companies() is called with include_targets=False (default)
        THEN: Returns companies without target data
        """
        # Act
        results = await company_repo.search_companies("retail", include_targets=False)

        # Assert
        assert len(results) == 2
        for result in results:
            assert result["target"] is None

    @pytest.mark.asyncio
    async def test_search_companies_with_min_icp_score(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Companies with different ICP scores
        WHEN: search_companies() is called with min_icp_score
        THEN: Returns only companies meeting ICP threshold
        """
        # Act - retail has 90 and 55 scores
        results = await company_repo.search_companies(
            "retail",
            include_targets=True,
            min_icp_score=60
        )

        # Assert - only retailer.com (score 90) meets threshold
        assert len(results) == 2  # Both companies returned
        # But only one has a target meeting the threshold
        targets_with_high_score = [r for r in results if r["target"] is not None]
        assert len(targets_with_high_score) == 1
        assert targets_with_high_score[0]["target"].icp_score == 90

    @pytest.mark.asyncio
    async def test_search_companies_by_vertical(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Companies with different verticals
        WHEN: search_companies() is called with vertical filter
        THEN: Returns only companies in that vertical
        """
        # Act
        results = await company_repo.search_companies(
            "co",  # Matches multiple
            vertical="Retail"
        )

        # Assert
        for result in results:
            assert result["company"].vertical == "Retail"

    @pytest.mark.asyncio
    async def test_search_companies_with_limit(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Multiple companies
        WHEN: search_companies() is called with limit
        THEN: Returns limited results
        """
        # Act
        results = await company_repo.search_companies("co", limit=2)

        # Assert
        assert len(results) <= 2

    @pytest.mark.asyncio
    async def test_search_companies_no_results(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Companies in database
        WHEN: search_companies() is called with no matches
        THEN: Returns empty list
        """
        # Act
        results = await company_repo.search_companies("nonexistent")

        # Assert
        assert results == []

    @pytest.mark.asyncio
    async def test_search_companies_case_insensitive(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Companies in database
        WHEN: search_companies() is called with different case
        THEN: Returns matches case-insensitively
        """
        # Act
        results = await company_repo.search_companies("RETAIL")

        # Assert
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_search_companies_combined_filters(
        self, company_repo, searchable_companies_with_targets
    ):
        """
        GIVEN: Companies with targets
        WHEN: search_companies() is called with multiple filters
        THEN: Returns results matching all criteria
        """
        # Act
        results = await company_repo.search_companies(
            "retail",
            include_targets=True,
            min_icp_score=80,
            vertical="Retail",
            limit=10
        )

        # Assert
        assert len(results) == 2  # Two retail companies found
        # Only retailer.com has target with score >= 80
        high_score_targets = [
            r for r in results
            if r["target"] is not None and r["target"].icp_score >= 80
        ]
        assert len(high_score_targets) == 1
        assert high_score_targets[0]["company"].domain == "retailer.com"
