"""
PartnerForge Test Configuration

Shared fixtures for all tests.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from typing import AsyncGenerator
import json


# =============================================================================
# Database Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def test_engine():
    """Create test database engine (in-memory SQLite).

    Uses isolated metadata that only includes versioning tables
    to avoid pre-existing relationship issues in platform models.
    """
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import MetaData

    # Import ONLY versioning models (avoid platform models with relationship bugs)
    from app.models.versioning import IntelSnapshot, ChangeEvent, SnapshotComparison

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    # Create only the tables we need for versioning tests
    async with engine.begin() as conn:
        await conn.run_sync(IntelSnapshot.__table__.create)
        await conn.run_sync(ChangeEvent.__table__.create)
        await conn.run_sync(SnapshotComparison.__table__.create)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator:
    """Create test database session with rollback after each test."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


# =============================================================================
# Sample Data Fixtures - Companies
# =============================================================================

@pytest.fixture
def sample_company_data():
    """Sample company data for testing."""
    return {
        "domain": "costco.com",
        "company_name": "Costco Wholesale Corporation",
        "vertical": "Retail",
        "sub_vertical": "Warehouse Club",
        "country": "US",
        "country_code": "US",
        "is_algolia_customer": False,
        "icp_score": 85,
        "icp_tier_name": "hot",
    }


@pytest.fixture
def sample_displacement_target():
    """Sample displacement target data."""
    return {
        "domain": "costco.com",
        "company_name": "Costco Wholesale Corporation",
        "partner_tech": "Adobe AEM",
        "vertical": "Retail",
        "country": "US",
        "tech_spend": 150000,
        "sw_monthly_visits": 50000000,
        "icp_score": 85,
        "icp_tier_name": "hot",
        "current_search": "Elasticsearch",
    }


# =============================================================================
# Sample Data Fixtures - Intelligence
# =============================================================================

@pytest.fixture
def sample_intel_snapshot_v1():
    """First version of intelligence snapshot."""
    return {
        "module_type": "m09_executive",
        "domain": "costco.com",
        "version": 1,
        "snapshot_type": "auto",
        "data": {
            "executives": [
                {"name": "John Smith", "title": "CFO"},
                {"name": "Bob Johnson", "title": "CEO"},
            ],
            "key_themes": ["cost_efficiency", "member_experience"],
            "digital_transformation_mentions": 2,
        },
        "source_url": "https://seekingalpha.com/costco-q4-2025",
        "source_date": datetime(2026, 2, 1),
        "has_changes": False,
        "change_count": 0,
    }


@pytest.fixture
def sample_intel_snapshot_v2():
    """Second version with changes (CFO changed, new theme)."""
    return {
        "module_type": "m09_executive",
        "domain": "costco.com",
        "version": 2,
        "snapshot_type": "auto",
        "data": {
            "executives": [
                {"name": "Jane Doe", "title": "CFO"},  # CHANGED
                {"name": "Bob Johnson", "title": "CEO"},
            ],
            "key_themes": ["digital_transformation", "member_experience"],  # CHANGED
            "digital_transformation_mentions": 8,  # CHANGED
        },
        "source_url": "https://seekingalpha.com/costco-q1-2026",
        "source_date": datetime(2026, 5, 1),
        "has_changes": True,
        "change_count": 3,
        "highest_significance": "high",
    }


@pytest.fixture
def expected_diff_v1_to_v2():
    """Expected diff between v1 and v2."""
    return {
        "changed": {
            "executives": {
                "old": [
                    {"name": "John Smith", "title": "CFO"},
                    {"name": "Bob Johnson", "title": "CEO"},
                ],
                "new": [
                    {"name": "Jane Doe", "title": "CFO"},
                    {"name": "Bob Johnson", "title": "CEO"},
                ],
            },
            "key_themes": {
                "old": ["cost_efficiency", "member_experience"],
                "new": ["digital_transformation", "member_experience"],
            },
            "digital_transformation_mentions": {
                "old": 2,
                "new": 8,
            },
        },
        "added": {},
        "removed": {},
        "unchanged": [],
    }


# =============================================================================
# Sample Data Fixtures - Alerts
# =============================================================================

@pytest.fixture
def sample_alert_rule_executive():
    """Alert rule for executive changes."""
    return {
        "name": "Executive Changes - Hot Leads",
        "description": "Alert when executives change at hot lead accounts",
        "is_active": True,
        "conditions": {
            "scope": "my_territory",
            "change_categories": ["executive_change"],
            "min_significance": "high",
            "additional_filters": {
                "icp_score_gt": 70,
            },
        },
        "channels": ["in_app", "email"],
        "frequency": "immediate",
    }


@pytest.fixture
def sample_alert_rule_tech_stack():
    """Alert rule for tech stack changes."""
    return {
        "name": "Search Provider Removed",
        "description": "Critical alert when search provider is removed",
        "is_active": True,
        "conditions": {
            "scope": "all",
            "change_categories": ["tech_stack_change"],
            "min_significance": "critical",
        },
        "channels": ["in_app", "email", "slack"],
        "frequency": "immediate",
    }


# =============================================================================
# Sample Data Fixtures - Users & Teams
# =============================================================================

@pytest.fixture
def sample_user_ae():
    """Sample Account Executive user."""
    return {
        "email": "john.doe@algolia.com",
        "name": "John Doe",
        "role": "ae",
        "is_active": True,
        "timezone": "America/Los_Angeles",
    }


@pytest.fixture
def sample_user_manager():
    """Sample Manager user."""
    return {
        "email": "jane.smith@algolia.com",
        "name": "Jane Smith",
        "role": "manager",
        "is_active": True,
        "timezone": "America/New_York",
    }


@pytest.fixture
def sample_team():
    """Sample sales team."""
    return {
        "name": "West Coast Enterprise",
        "description": "Enterprise accounts in US West",
        "monthly_api_budget_usd": 1000.0,
        "current_month_spend_usd": 0.0,
    }


@pytest.fixture
def sample_territory():
    """Sample territory definition."""
    return {
        "name": "US West - Retail",
        "description": "Retail accounts in Western US",
        "filters": {
            "regions": ["US-West"],
            "verticals": ["Retail", "Marketplace"],
            "min_icp_score": 60,
        },
        "account_count": 0,
        "hot_lead_count": 0,
    }


# =============================================================================
# Mock API Response Fixtures
# =============================================================================

@pytest.fixture
def mock_builtwith_response():
    """Mock BuiltWith API response for Costco."""
    return {
        "Results": [{
            "Technologies": [
                {
                    "Name": "Elasticsearch",
                    "Category": "Search",
                    "FirstDetected": "2020-01-15",
                    "LastDetected": "2026-02-01",
                },
                {
                    "Name": "Adobe Experience Manager",
                    "Category": "Content Management System",
                    "FirstDetected": "2018-06-01",
                    "LastDetected": "2026-02-01",
                },
            ],
            "Meta": {
                "CompanyName": "Costco Wholesale Corporation",
                "Vertical": "Retail",
                "Country": "United States",
            },
            "Spend": {
                "Estimated": 150000,
                "Currency": "USD",
            },
        }],
    }


@pytest.fixture
def mock_similarweb_traffic_response():
    """Mock SimilarWeb traffic API response."""
    return {
        "visits": 50000000,
        "unique_visitors": 35000000,
        "pages_per_visit": 4.2,
        "avg_visit_duration": 180,
        "bounce_rate": 0.35,
        "traffic_sources": {
            "direct": 0.40,
            "search": 0.35,
            "social": 0.10,
            "referral": 0.15,
        },
        "top_countries": [
            {"country": "US", "share": 0.85},
            {"country": "CA", "share": 0.10},
            {"country": "MX", "share": 0.05},
        ],
    }


@pytest.fixture
def mock_yahoo_finance_response():
    """Mock Yahoo Finance API response."""
    return {
        "ticker": "COST",
        "company_name": "Costco Wholesale Corporation",
        "revenue": {
            "current": 240000000000,
            "prior_year": 225000000000,
            "two_years_ago": 200000000000,
        },
        "margins": {
            "gross": 0.13,
            "operating": 0.035,
            "net": 0.027,
        },
        "stock": {
            "price": 580.50,
            "market_cap": 257000000000,
            "change_1y": 0.25,
        },
        "analyst": {
            "rating": "buy",
            "target_price": 650.00,
            "count": 28,
        },
    }


# =============================================================================
# Expected Change Detection Fixtures
# =============================================================================

@pytest.fixture
def expected_executive_change():
    """Expected change event for executive change."""
    return {
        "category": "executive_change",
        "significance": "high",
        "field": "executives",
        "summary": "CFO changed: John Smith → Jane Doe",
        "algolia_relevance": "New CFO may not have existing vendor relationships",
    }


@pytest.fixture
def expected_tech_stack_change():
    """Expected change event for tech stack removal."""
    return {
        "category": "tech_stack_change",
        "significance": "critical",
        "field": "current_search_provider",
        "summary": "Search provider removed: Elasticsearch",
        "algolia_relevance": "No current search provider = greenfield opportunity",
    }


# =============================================================================
# Validation Helpers
# =============================================================================

@pytest.fixture
def validation_helper():
    """Helper for detailed validation assertions."""

    class ValidationHelper:
        @staticmethod
        def assert_equal_with_details(actual, expected, context: str = ""):
            """Assert equality with detailed diff on failure."""
            if actual != expected:
                diff = {
                    "only_in_expected": {k: v for k, v in expected.items() if k not in actual or actual[k] != v},
                    "only_in_actual": {k: v for k, v in actual.items() if k not in expected or expected[k] != v},
                }
                pytest.fail(f"""
VALIDATION FAILED: {context}

Expected:
{json.dumps(expected, indent=2, default=str)}

Actual:
{json.dumps(actual, indent=2, default=str)}

Difference:
{json.dumps(diff, indent=2, default=str)}
                """)

        @staticmethod
        def assert_contains_keys(obj, required_keys: list, context: str = ""):
            """Assert object contains all required keys."""
            missing = [k for k in required_keys if k not in obj]
            if missing:
                pytest.fail(f"""
VALIDATION FAILED: {context}

Missing required keys: {missing}
Object keys: {list(obj.keys())}
                """)

    return ValidationHelper()
