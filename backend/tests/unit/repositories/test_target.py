"""
Test Suite: Target Repository

Module Under Test: backend/app/repositories/target.py
Author: Thread 1 - Backend Architecture
Created: 2026-02-25

Test Categories:
1. Happy Path - Domain operations, ICP scoring, partner tech filtering
2. Edge Cases - Empty data, tier boundaries, pagination
3. Error Handling - Not found, invalid tiers, validation
4. Source Citation - exec_quote requires quote_source
5. Traffic and Financial Filtering
6. Competitive Intelligence
7. Enrichment Status Tracking
8. Statistics and Distributions
"""

import pytest
from datetime import datetime, timedelta
from typing import Any, Dict
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.targets import DisplacementTarget, CompetitiveIntel
from app.repositories.target import TargetRepository, CompetitiveIntelRepository
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
def target_repo(db_session):
    """Create target repository instance."""
    return TargetRepository(db_session)


@pytest.fixture
def comp_intel_repo(db_session):
    """Create competitive intel repository instance."""
    return CompetitiveIntelRepository(db_session)


@pytest.fixture
def sample_target_data():
    """Sample target data for creating test entities."""
    return {
        "domain": "target-company.com",
        "company_name": "Target Company Inc",
        "partner_tech": "Adobe AEM",
        "vertical": "Retail",
        "country": "United States",
        "city": "Seattle",
        "state": "WA",
        "tech_spend": 75000,
        "sw_monthly_visits": 5000000,
        "icp_score": 75,
        "icp_tier": 2,
        "icp_tier_name": "warm",
    }


@pytest.fixture
async def sample_target(target_repo, sample_target_data, db_session):
    """Create a sample target in the database."""
    target = await target_repo.create(sample_target_data, validate_source=False)
    await db_session.commit()
    return target


# =============================================================================
# HAPPY PATH TESTS - Domain Operations
# =============================================================================

class TestDomainOperations:
    """Tests for domain-based operations."""

    @pytest.mark.asyncio
    async def test_get_by_domain(self, target_repo, sample_target):
        """
        GIVEN: An existing target
        WHEN: get_by_domain() is called
        THEN: Returns the correct target
        """
        # Act
        result = await target_repo.get_by_domain("target-company.com")

        # Assert
        assert result is not None
        assert result.domain == "target-company.com"
        assert result.company_name == "Target Company Inc"

    @pytest.mark.asyncio
    async def test_get_by_domain_case_insensitive(self, target_repo, sample_target):
        """
        GIVEN: An existing target
        WHEN: get_by_domain() is called with different case
        THEN: Returns the correct target (case-insensitive)
        """
        # Act
        result = await target_repo.get_by_domain("TARGET-COMPANY.COM")

        # Assert
        assert result is not None
        assert result.domain == "target-company.com"

    @pytest.mark.asyncio
    async def test_get_by_domain_not_found(self, target_repo):
        """
        GIVEN: Non-existent domain
        WHEN: get_by_domain() is called
        THEN: Returns None
        """
        # Act
        result = await target_repo.get_by_domain("nonexistent.com")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_domain_or_raise(self, target_repo, sample_target):
        """
        GIVEN: An existing target
        WHEN: get_by_domain_or_raise() is called
        THEN: Returns the target
        """
        # Act
        result = await target_repo.get_by_domain_or_raise("target-company.com")

        # Assert
        assert result is not None
        assert result.domain == "target-company.com"

    @pytest.mark.asyncio
    async def test_get_by_domain_or_raise_not_found(self, target_repo):
        """
        GIVEN: Non-existent domain
        WHEN: get_by_domain_or_raise() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            await target_repo.get_by_domain_or_raise("nonexistent.com")

        assert "nonexistent.com" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_upsert_by_domain_create(self, target_repo, db_session):
        """
        GIVEN: New target data
        WHEN: upsert_by_domain() is called
        THEN: Creates new target
        """
        # Arrange
        data = {
            "company_name": "New Target Corp",
            "partner_tech": "Shopify",
            "vertical": "E-commerce",
        }

        # Act
        target, created = await target_repo.upsert_by_domain("newtarget.com", data)
        await db_session.commit()

        # Assert
        assert created is True
        assert target.domain == "newtarget.com"
        assert target.company_name == "New Target Corp"

    @pytest.mark.asyncio
    async def test_upsert_by_domain_update(
        self, target_repo, sample_target, db_session
    ):
        """
        GIVEN: Existing target
        WHEN: upsert_by_domain() is called with same domain
        THEN: Updates existing target
        """
        # Arrange
        data = {
            "company_name": "Updated Target Company",
            "vertical": "Technology",
        }

        # Act
        target, created = await target_repo.upsert_by_domain(
            "target-company.com", data
        )
        await db_session.commit()

        # Assert
        assert created is False
        assert target.company_name == "Updated Target Company"
        assert target.vertical == "Technology"


# =============================================================================
# HAPPY PATH TESTS - ICP Score & Tier Operations
# =============================================================================

class TestICPOperations:
    """Tests for ICP scoring and tier operations."""

    @pytest.fixture
    async def targets_by_tier(self, target_repo, db_session):
        """Create targets with different ICP scores."""
        targets = [
            # Hot leads (80+)
            ("hot1.com", "Hot Lead 1", 95, 1, "hot"),
            ("hot2.com", "Hot Lead 2", 85, 1, "hot"),
            # Warm leads (60-79)
            ("warm1.com", "Warm Lead 1", 75, 2, "warm"),
            ("warm2.com", "Warm Lead 2", 65, 2, "warm"),
            # Cool leads (40-59)
            ("cool1.com", "Cool Lead 1", 55, 3, "cool"),
            ("cool2.com", "Cool Lead 2", 45, 3, "cool"),
            # Cold leads (<40)
            ("cold1.com", "Cold Lead 1", 35, 4, "cold"),
            ("cold2.com", "Cold Lead 2", 25, 4, "cold"),
            # Unscored
            ("unscored.com", "Unscored", None, None, None),
        ]
        result = []
        for domain, name, score, tier, tier_name in targets:
            target = await target_repo.create({
                "domain": domain,
                "company_name": name,
                "icp_score": score,
                "icp_tier": tier,
                "icp_tier_name": tier_name,
                "partner_tech": "Adobe AEM",
            }, validate_source=False)
            result.append(target)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_list_hot_leads(self, target_repo, targets_by_tier):
        """
        GIVEN: Targets with different ICP scores
        WHEN: list_hot_leads() is called
        THEN: Returns only hot leads (score >= 80)
        """
        # Act
        hot_leads = await target_repo.list_hot_leads()

        # Assert
        assert len(hot_leads) == 2
        for lead in hot_leads:
            assert lead.icp_score >= 80

    @pytest.mark.asyncio
    async def test_list_warm_leads(self, target_repo, targets_by_tier):
        """
        GIVEN: Targets with different ICP scores
        WHEN: list_warm_leads() is called
        THEN: Returns only warm leads (score 60-79)
        """
        # Act
        warm_leads = await target_repo.list_warm_leads()

        # Assert
        assert len(warm_leads) == 2
        for lead in warm_leads:
            assert 60 <= lead.icp_score < 80

    @pytest.mark.asyncio
    async def test_list_by_icp_tier_hot(self, target_repo, targets_by_tier):
        """
        GIVEN: Targets with different tiers
        WHEN: list_by_icp_tier("hot") is called
        THEN: Returns hot tier targets
        """
        # Act
        hot_leads = await target_repo.list_by_icp_tier("hot")

        # Assert
        assert len(hot_leads) == 2
        for lead in hot_leads:
            assert lead.icp_tier_name == "hot"

    @pytest.mark.asyncio
    async def test_list_by_icp_tier_invalid(self, target_repo):
        """
        GIVEN: Invalid tier name
        WHEN: list_by_icp_tier() is called
        THEN: Raises ValidationError
        """
        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await target_repo.list_by_icp_tier("invalid")

        assert "invalid" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_list_hot_leads_ordered_by_score(
        self, target_repo, targets_by_tier
    ):
        """
        GIVEN: Hot leads
        WHEN: list_hot_leads() is called
        THEN: Returns leads ordered by score descending
        """
        # Act
        hot_leads = await target_repo.list_hot_leads()

        # Assert
        scores = [lead.icp_score for lead in hot_leads]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.asyncio
    async def test_update_icp_score(self, target_repo, sample_target, db_session):
        """
        GIVEN: An existing target
        WHEN: update_icp_score() is called with new score
        THEN: Updates score and tier correctly
        """
        # Act
        updated = await target_repo.update_icp_score(
            "target-company.com",
            85,
            breakdown={"traffic": 30, "tech_spend": 25, "vertical": 30},
            reasons=["High traffic", "Partner tech detected"],
        )
        await db_session.commit()

        # Assert
        assert updated.icp_score == 85
        assert updated.icp_tier == 1  # Hot
        assert updated.icp_tier_name == "hot"
        assert updated.score_breakdown is not None
        assert updated.score_reasons is not None

    @pytest.mark.asyncio
    async def test_update_icp_score_tier_boundaries(
        self, target_repo, db_session
    ):
        """
        GIVEN: Targets
        WHEN: update_icp_score() is called with boundary values
        THEN: Assigns correct tier
        """
        # Create test target
        target = await target_repo.create({
            "domain": "boundary.com",
            "company_name": "Boundary Test",
        }, validate_source=False)
        await db_session.commit()

        # Test hot threshold (80)
        await target_repo.update_icp_score("boundary.com", 80)
        result = await target_repo.get_by_domain("boundary.com")
        assert result.icp_tier_name == "hot"

        # Test warm threshold (60)
        await target_repo.update_icp_score("boundary.com", 79)
        result = await target_repo.get_by_domain("boundary.com")
        assert result.icp_tier_name == "warm"

        # Test cool threshold (40)
        await target_repo.update_icp_score("boundary.com", 59)
        result = await target_repo.get_by_domain("boundary.com")
        assert result.icp_tier_name == "cool"

        # Test cold
        await target_repo.update_icp_score("boundary.com", 39)
        result = await target_repo.get_by_domain("boundary.com")
        assert result.icp_tier_name == "cold"

    @pytest.mark.asyncio
    async def test_update_icp_score_invalid_score(self, target_repo, sample_target):
        """
        GIVEN: An existing target
        WHEN: update_icp_score() is called with invalid score
        THEN: Raises ValidationError
        """
        # Act & Assert - Score too high
        with pytest.raises(ValidationError):
            await target_repo.update_icp_score("target-company.com", 150)

        # Act & Assert - Score too low
        with pytest.raises(ValidationError):
            await target_repo.update_icp_score("target-company.com", -10)

    @pytest.mark.asyncio
    async def test_update_icp_score_not_found(self, target_repo):
        """
        GIVEN: Non-existent domain
        WHEN: update_icp_score() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError):
            await target_repo.update_icp_score("nonexistent.com", 75)


# =============================================================================
# PARTNER TECHNOLOGY TESTS
# =============================================================================

class TestPartnerTechOperations:
    """Tests for partner technology filtering."""

    @pytest.fixture
    async def targets_by_partner_tech(self, target_repo, db_session):
        """Create targets with different partner technologies."""
        targets = [
            ("aem1.com", "AEM Company 1", "Adobe AEM", 85),
            ("aem2.com", "AEM Company 2", "Adobe AEM", 75),
            ("aem3.com", "AEM Company 3", "Adobe AEM", 45),
            ("shopify1.com", "Shopify Company 1", "Shopify", 90),
            ("shopify2.com", "Shopify Company 2", "Shopify", 60),
            ("sitecore1.com", "Sitecore Company 1", "Sitecore", 70),
        ]
        result = []
        for domain, name, partner, score in targets:
            target = await target_repo.create({
                "domain": domain,
                "company_name": name,
                "partner_tech": partner,
                "icp_score": score,
            }, validate_source=False)
            result.append(target)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_list_by_partner_tech(
        self, target_repo, targets_by_partner_tech
    ):
        """
        GIVEN: Targets with different partner technologies
        WHEN: list_by_partner_tech() is called
        THEN: Returns targets using that partner tech
        """
        # Act
        aem_targets = await target_repo.list_by_partner_tech("Adobe AEM")

        # Assert
        assert len(aem_targets) == 3
        for target in aem_targets:
            assert target.partner_tech == "Adobe AEM"

    @pytest.mark.asyncio
    async def test_list_by_partner_tech_with_min_score(
        self, target_repo, targets_by_partner_tech
    ):
        """
        GIVEN: Targets with different scores
        WHEN: list_by_partner_tech() is called with min_icp_score
        THEN: Returns targets above score threshold
        """
        # Act
        aem_targets = await target_repo.list_by_partner_tech(
            "Adobe AEM",
            min_icp_score=70,
        )

        # Assert
        assert len(aem_targets) == 2
        for target in aem_targets:
            assert target.icp_score >= 70

    @pytest.mark.asyncio
    async def test_get_partner_tech_stats(
        self, target_repo, targets_by_partner_tech
    ):
        """
        GIVEN: Targets with different partner technologies
        WHEN: get_partner_tech_stats() is called
        THEN: Returns statistics by partner tech
        """
        # Act
        stats = await target_repo.get_partner_tech_stats()

        # Assert
        assert len(stats) == 3

        # Find Adobe AEM stats
        aem_stats = next(s for s in stats if s["partner_tech"] == "Adobe AEM")
        assert aem_stats["count"] == 3
        assert aem_stats["hot_count"] == 1  # Only score 85
        assert aem_stats["warm_count"] == 1  # Score 75

        # Find Shopify stats
        shopify_stats = next(s for s in stats if s["partner_tech"] == "Shopify")
        assert shopify_stats["count"] == 2
        assert shopify_stats["hot_count"] == 1  # Score 90


# =============================================================================
# TRAFFIC AND FINANCIAL FILTERING TESTS
# =============================================================================

class TestTrafficAndFinancialFiltering:
    """Tests for traffic and financial filtering operations."""

    @pytest.fixture
    async def targets_with_traffic(self, target_repo, db_session):
        """Create targets with different traffic and financial data."""
        targets = [
            ("high.com", "High Traffic", 50000000, True, 1000000000),
            ("medium.com", "Medium Traffic", 5000000, True, 100000000),
            ("low.com", "Low Traffic", 500000, False, None),
            ("tiny.com", "Tiny Traffic", 50000, False, None),
        ]
        result = []
        for domain, name, traffic, is_public, revenue in targets:
            target = await target_repo.create({
                "domain": domain,
                "company_name": name,
                "sw_monthly_visits": traffic,
                "is_public": is_public,
                "revenue": revenue,
            }, validate_source=False)
            result.append(target)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_list_by_traffic(self, target_repo, targets_with_traffic):
        """
        GIVEN: Targets with different traffic
        WHEN: list_by_traffic() is called
        THEN: Returns targets in traffic range
        """
        # Act
        targets = await target_repo.list_by_traffic(min_monthly_visits=1000000)

        # Assert
        assert len(targets) == 2  # high and medium
        for target in targets:
            assert target.sw_monthly_visits >= 1000000

    @pytest.mark.asyncio
    async def test_list_by_traffic_with_max(self, target_repo, targets_with_traffic):
        """
        GIVEN: Targets with different traffic
        WHEN: list_by_traffic() is called with max
        THEN: Returns targets in traffic range
        """
        # Fixture traffic values:
        # - high.com: 50M (excluded - above max)
        # - medium.com: 5M (included)
        # - low.com: 500K (included)
        # - tiny.com: 50K (excluded - below min)
        # Act
        targets = await target_repo.list_by_traffic(
            min_monthly_visits=100000,
            max_monthly_visits=10000000,
        )

        # Assert
        assert len(targets) == 2  # medium and low only
        for target in targets:
            assert 100000 <= target.sw_monthly_visits <= 10000000

    @pytest.mark.asyncio
    async def test_list_public_companies(self, target_repo, targets_with_traffic):
        """
        GIVEN: Mix of public and private targets
        WHEN: list_public_companies() is called
        THEN: Returns only public companies
        """
        # Act
        public = await target_repo.list_public_companies()

        # Assert
        assert len(public) == 2
        for target in public:
            assert target.is_public is True

    @pytest.mark.asyncio
    async def test_list_public_companies_with_min_revenue(
        self, target_repo, targets_with_traffic
    ):
        """
        GIVEN: Public companies with different revenue
        WHEN: list_public_companies() is called with min_revenue
        THEN: Returns companies above revenue threshold
        """
        # Act
        public = await target_repo.list_public_companies(min_revenue=500000000)

        # Assert
        assert len(public) == 1
        assert public[0].revenue >= 500000000


# =============================================================================
# COMPETITIVE INTELLIGENCE TESTS
# =============================================================================

class TestCompetitiveIntelligence:
    """Tests for competitive intelligence operations."""

    @pytest.fixture
    async def targets_with_search(self, target_repo, db_session):
        """Create targets with current search provider info."""
        targets = [
            ("elastic1.com", "Elastic 1", "Elasticsearch", None),
            ("elastic2.com", "Elastic 2", "Elasticsearch", '["competitor1.com"]'),
            ("coveo1.com", "Coveo 1", "Coveo", '["algolia-user.com"]'),
            ("algolia1.com", "Algolia 1", "Algolia", None),  # Already using Algolia
        ]
        result = []
        for domain, name, search, competitors_algolia in targets:
            target = await target_repo.create({
                "domain": domain,
                "company_name": name,
                "current_search": search,
                "competitors_using_algolia": competitors_algolia,
            }, validate_source=False)
            result.append(target)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_list_by_current_search(
        self, target_repo, targets_with_search
    ):
        """
        GIVEN: Targets with different search providers
        WHEN: list_by_current_search() is called
        THEN: Returns targets using that search provider
        """
        # Act
        elastic_targets = await target_repo.list_by_current_search("Elasticsearch")

        # Assert
        assert len(elastic_targets) == 2
        for target in elastic_targets:
            assert "elasticsearch" in target.current_search.lower()

    @pytest.mark.asyncio
    async def test_list_by_current_search_case_insensitive(
        self, target_repo, targets_with_search
    ):
        """
        GIVEN: Targets
        WHEN: list_by_current_search() is called with different case
        THEN: Returns matches case-insensitively
        """
        # Act
        elastic_targets = await target_repo.list_by_current_search("ELASTICSEARCH")

        # Assert
        assert len(elastic_targets) == 2

    @pytest.mark.asyncio
    async def test_list_with_competitors_using_algolia(
        self, target_repo, targets_with_search
    ):
        """
        GIVEN: Targets with competitor info
        WHEN: list_with_competitors_using_algolia() is called
        THEN: Returns targets whose competitors use Algolia
        """
        # Act
        targets = await target_repo.list_with_competitors_using_algolia()

        # Assert
        assert len(targets) == 2  # elastic2 and coveo1
        for target in targets:
            assert target.competitors_using_algolia is not None
            assert target.competitors_using_algolia != "[]"


# =============================================================================
# ENRICHMENT STATUS TESTS
# =============================================================================

class TestEnrichmentStatus:
    """Tests for enrichment status tracking."""

    @pytest.fixture
    async def targets_with_enrichment(self, target_repo, db_session):
        """Create targets with different enrichment statuses."""
        now = datetime.utcnow()
        targets = [
            ("fresh.com", "Fresh", now - timedelta(days=1), "full"),
            ("stale.com", "Stale", now - timedelta(days=45), "full"),
            ("basic.com", "Basic", now - timedelta(days=5), "basic"),
            ("never.com", "Never Enriched", None, None),
        ]
        result = []
        for domain, name, last_enriched, level in targets:
            target = await target_repo.create({
                "domain": domain,
                "company_name": name,
                "last_enriched": last_enriched,
                "enrichment_level": level,
            }, validate_source=False)
            result.append(target)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_list_needs_enrichment(
        self, target_repo, targets_with_enrichment
    ):
        """
        GIVEN: Targets with different enrichment status
        WHEN: list_needs_enrichment() is called
        THEN: Returns targets needing enrichment
        """
        # Act
        needs_enrichment = await target_repo.list_needs_enrichment(max_age_days=30)

        # Assert
        assert len(needs_enrichment) == 2  # stale and never
        domains = [t.domain for t in needs_enrichment]
        assert "stale.com" in domains
        assert "never.com" in domains

    @pytest.mark.asyncio
    async def test_list_needs_enrichment_by_level(
        self, target_repo, targets_with_enrichment
    ):
        """
        GIVEN: Targets with different enrichment levels
        WHEN: list_needs_enrichment() is called with level filter
        THEN: Returns targets matching level
        """
        # Act
        basic_needs = await target_repo.list_needs_enrichment(
            max_age_days=30,
            enrichment_level="basic",
        )

        # Assert
        # basic.com was enriched 5 days ago, which is < 30 days
        # So this should return targets that need enrichment AND have basic level
        # But basic.com doesn't need enrichment yet (only 5 days)
        # This filter returns targets that ARE at basic level AND need enrichment
        for target in basic_needs:
            assert target.enrichment_level == "basic"

    @pytest.mark.asyncio
    async def test_mark_enriched(self, target_repo, sample_target, db_session):
        """
        GIVEN: An existing target
        WHEN: mark_enriched() is called
        THEN: Updates enrichment status
        """
        # Verify initial state
        assert sample_target.enrichment_level is None or sample_target.enrichment_level != "full"

        # Act
        updated = await target_repo.mark_enriched(
            "target-company.com",
            enrichment_level="full",
        )
        await db_session.commit()

        # Assert
        assert updated.enrichment_level == "full"
        assert updated.last_enriched is not None

    @pytest.mark.asyncio
    async def test_mark_enriched_not_found(self, target_repo):
        """
        GIVEN: Non-existent domain
        WHEN: mark_enriched() is called
        THEN: Raises NotFoundError
        """
        # Act & Assert
        with pytest.raises(NotFoundError):
            await target_repo.mark_enriched("nonexistent.com")


# =============================================================================
# STATISTICS TESTS
# =============================================================================

class TestStatistics:
    """Tests for statistical operations."""

    @pytest.fixture
    async def targets_for_stats(self, target_repo, db_session):
        """Create targets for statistics testing."""
        targets = [
            ("hot1.com", "Hot 1", 90, "Retail", 5000000, True),
            ("hot2.com", "Hot 2", 85, "Retail", 3000000, True),
            ("warm1.com", "Warm 1", 70, "Tech", 1000000, False),
            ("cool1.com", "Cool 1", 50, "Retail", 500000, False),
            ("cold1.com", "Cold 1", 30, "Media", 100000, False),
            ("unscored.com", "Unscored", None, "Retail", 50000, False),
        ]
        result = []
        for domain, name, score, vertical, traffic, is_public in targets:
            target = await target_repo.create({
                "domain": domain,
                "company_name": name,
                "icp_score": score,
                "vertical": vertical,
                "sw_monthly_visits": traffic,
                "is_public": is_public,
            }, validate_source=False)
            result.append(target)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_get_stats(self, target_repo, targets_for_stats):
        """
        GIVEN: Targets with different attributes
        WHEN: get_stats() is called
        THEN: Returns correct aggregate statistics
        """
        # Act
        stats = await target_repo.get_stats()

        # Assert
        assert stats["total"] == 6
        assert stats["by_tier"]["hot"] == 2
        assert stats["by_tier"]["warm"] == 1
        assert stats["by_tier"]["cool"] == 1
        assert stats["by_tier"]["cold"] == 1
        assert stats["by_tier"]["unscored"] == 1
        assert stats["public_companies"] == 2
        assert stats["total_monthly_traffic"] == 9650000

    @pytest.mark.asyncio
    async def test_get_vertical_distribution(self, target_repo, targets_for_stats):
        """
        GIVEN: Targets in different verticals
        WHEN: get_vertical_distribution() is called
        THEN: Returns distribution by vertical
        """
        # Act
        distribution = await target_repo.get_vertical_distribution()

        # Assert
        assert len(distribution) == 3  # Retail, Tech, Media

        # Find Retail
        retail = next(d for d in distribution if d["vertical"] == "Retail")
        assert retail["count"] == 4
        assert retail["hot_count"] == 2


# =============================================================================
# SEARCH TESTS
# =============================================================================

class TestSearchOperations:
    """Tests for search operations."""

    @pytest.fixture
    async def searchable_targets(self, target_repo, db_session):
        """Create targets for search testing."""
        targets = [
            ("costco.com", "Costco Wholesale"),
            ("walmart.com", "Walmart Inc"),
            ("target.com", "Target Corporation"),
        ]
        result = []
        for domain, name in targets:
            target = await target_repo.create({
                "domain": domain,
                "company_name": name,
                "icp_score": 75,
            }, validate_source=False)
            result.append(target)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_search_by_name(self, target_repo, searchable_targets):
        """
        GIVEN: Multiple targets
        WHEN: search() is called with name query
        THEN: Returns matching targets
        """
        # Act
        results = await target_repo.search("costco")

        # Assert
        assert len(results) == 1
        assert results[0].company_name == "Costco Wholesale"

    @pytest.mark.asyncio
    async def test_search_by_domain(self, target_repo, searchable_targets):
        """
        GIVEN: Multiple targets
        WHEN: search() is called with domain query
        THEN: Returns matching targets
        """
        # Act
        results = await target_repo.search("walmart")

        # Assert
        assert len(results) == 1
        assert results[0].domain == "walmart.com"


# =============================================================================
# SOURCE CITATION TESTS
# =============================================================================

class TestSourceCitation:
    """Tests for source citation validation."""

    @pytest.mark.asyncio
    async def test_validate_source_citation_with_exec_quote(self, target_repo):
        """
        GIVEN: Data with exec_quote
        WHEN: validate_source_citation() is called without quote_source
        THEN: Raises SourceCitationError
        """
        # Arrange
        data = {
            "exec_quote": "We need better search.",
            "quote_source": None,
        }

        # Act & Assert
        with pytest.raises(SourceCitationError) as exc_info:
            target_repo.validate_source_citation(data)

        assert "quote_source" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_validate_source_citation_with_quote_source(self, target_repo):
        """
        GIVEN: Data with exec_quote and quote_source
        WHEN: validate_source_citation() is called
        THEN: Returns True
        """
        # Arrange
        data = {
            "exec_quote": "We need better search.",
            "quote_source": "https://earnings.com/transcript",
        }

        # Act
        result = target_repo.validate_source_citation(data)

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_validate_source_citation_no_quote(self, target_repo):
        """
        GIVEN: Data without exec_quote
        WHEN: validate_source_citation() is called
        THEN: Returns True (no validation needed)
        """
        # Arrange
        data = {
            "company_name": "Test Corp",
            "vertical": "Retail",
        }

        # Act
        result = target_repo.validate_source_citation(data)

        # Assert
        assert result is True


# =============================================================================
# COMPETITIVE INTEL REPOSITORY TESTS
# =============================================================================

class TestCompetitiveIntelRepository:
    """Tests for CompetitiveIntelRepository."""

    @pytest.fixture
    async def comp_intel_records(self, comp_intel_repo, db_session):
        """Create competitive intel records."""
        records = [
            {
                "target_domain": "target1.com",
                "competitor_domain": "comp1.com",
                "similarity_score": 0.85,
                "has_algolia": True,
                "search_provider": "Algolia",
            },
            {
                "target_domain": "target1.com",
                "competitor_domain": "comp2.com",
                "similarity_score": 0.75,
                "has_algolia": False,
                "search_provider": "Elasticsearch",
            },
            {
                "target_domain": "target2.com",
                "competitor_domain": "comp3.com",
                "similarity_score": 0.90,
                "has_algolia": True,
                "search_provider": "Algolia",
            },
        ]
        result = []
        for data in records:
            record = await comp_intel_repo.create(data, validate_source=False)
            result.append(record)
        await db_session.commit()
        return result

    @pytest.mark.asyncio
    async def test_get_competitors_for_target(
        self, comp_intel_repo, comp_intel_records
    ):
        """
        GIVEN: Competitive intel records
        WHEN: get_competitors_for_target() is called
        THEN: Returns competitors for that target
        """
        # Act
        competitors = await comp_intel_repo.get_competitors_for_target("target1.com")

        # Assert
        assert len(competitors) == 2
        # Should be ordered by similarity_score desc
        assert competitors[0].similarity_score >= competitors[1].similarity_score

    @pytest.mark.asyncio
    async def test_get_competitors_using_algolia(
        self, comp_intel_repo, comp_intel_records
    ):
        """
        GIVEN: Competitive intel records
        WHEN: get_competitors_using_algolia() is called
        THEN: Returns only competitors using Algolia
        """
        # Act
        competitors = await comp_intel_repo.get_competitors_using_algolia("target1.com")

        # Assert
        assert len(competitors) == 1
        assert competitors[0].has_algolia is True

    @pytest.mark.asyncio
    async def test_upsert_competitor_create(self, comp_intel_repo, db_session):
        """
        GIVEN: New competitor data
        WHEN: upsert_competitor() is called
        THEN: Creates new record
        """
        # Act
        record = await comp_intel_repo.upsert_competitor(
            "newtarget.com",
            "newcomp.com",
            {
                "similarity_score": 0.80,
                "has_algolia": True,
            },
        )
        await db_session.commit()

        # Assert
        assert record is not None
        assert record.target_domain == "newtarget.com"
        assert record.competitor_domain == "newcomp.com"

    @pytest.mark.asyncio
    async def test_upsert_competitor_update(
        self, comp_intel_repo, comp_intel_records, db_session
    ):
        """
        GIVEN: Existing competitor record
        WHEN: upsert_competitor() is called with same domains
        THEN: Updates existing record
        """
        # Act
        record = await comp_intel_repo.upsert_competitor(
            "target1.com",
            "comp1.com",
            {
                "similarity_score": 0.95,  # Updated
                "has_algolia": True,
            },
        )
        await db_session.commit()

        # Assert
        assert record.similarity_score == 0.95

    @pytest.mark.asyncio
    async def test_get_competitors_for_target_case_insensitive(
        self, comp_intel_repo, comp_intel_records
    ):
        """
        GIVEN: Competitive intel records
        WHEN: get_competitors_for_target() is called with different case
        THEN: Returns competitors (case-insensitive)
        """
        # Act
        competitors = await comp_intel_repo.get_competitors_for_target("TARGET1.COM")

        # Assert
        assert len(competitors) == 2
