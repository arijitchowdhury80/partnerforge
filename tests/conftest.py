"""
Pytest Configuration and Shared Fixtures
=========================================

This file contains fixtures available to all test files.
Fixtures here can be used by any test without explicit import.
"""

import pytest
from datetime import datetime, timedelta
from typing import Generator, Dict, Any
from unittest.mock import MagicMock, AsyncMock

from pipeline.models.source import (
    SourceCitation,
    SourcedDataPoint,
    SourceType,
    FreshnessStatus,
)


# ============================================================================
# Source Citation Fixtures
# ============================================================================

@pytest.fixture
def fresh_builtwith_citation() -> SourceCitation:
    """Fresh BuiltWith citation (within 30 days)."""
    return SourceCitation(
        source_type=SourceType.BUILTWITH,
        source_url="https://api.builtwith.com/v21/api.json?KEY=xxx&LOOKUP=costco.com",
        retrieved_at=datetime.utcnow() - timedelta(days=5),
        api_endpoint="domain-lookup",
        api_version="v21",
    )


@pytest.fixture
def stale_builtwith_citation() -> SourceCitation:
    """Stale BuiltWith citation (31-90 days old)."""
    return SourceCitation(
        source_type=SourceType.BUILTWITH,
        source_url="https://api.builtwith.com/v21/api.json?KEY=xxx&LOOKUP=costco.com",
        retrieved_at=datetime.utcnow() - timedelta(days=60),
        api_endpoint="domain-lookup",
        api_version="v21",
    )


@pytest.fixture
def expired_builtwith_citation() -> SourceCitation:
    """Expired BuiltWith citation (>180 days old)."""
    return SourceCitation(
        source_type=SourceType.BUILTWITH,
        source_url="https://api.builtwith.com/v21/api.json?KEY=xxx&LOOKUP=costco.com",
        retrieved_at=datetime.utcnow() - timedelta(days=200),
        api_endpoint="domain-lookup",
        api_version="v21",
    )


@pytest.fixture
def fresh_similarweb_citation() -> SourceCitation:
    """Fresh SimilarWeb citation (within 7 days)."""
    return SourceCitation(
        source_type=SourceType.SIMILARWEB,
        source_url="https://api.similarweb.com/v1/website/costco.com/traffic-and-engagement/visits",
        retrieved_at=datetime.utcnow() - timedelta(days=3),
        api_endpoint="traffic-and-engagement",
        api_version="v1",
    )


@pytest.fixture
def fresh_yahoo_finance_citation() -> SourceCitation:
    """Fresh Yahoo Finance citation (within 1 day)."""
    return SourceCitation(
        source_type=SourceType.YAHOO_FINANCE,
        source_url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/COST",
        retrieved_at=datetime.utcnow() - timedelta(hours=6),
        api_endpoint="quoteSummary",
        api_version="v10",
    )


@pytest.fixture
def earnings_call_citation() -> SourceCitation:
    """Citation from earnings call transcript."""
    return SourceCitation(
        source_type=SourceType.EARNINGS_CALL,
        source_url="https://www.fool.com/earnings/call-transcripts/2024/01/15/costco-wholesale-cost-q1-2024-earnings-call-transc/",
        retrieved_at=datetime.utcnow() - timedelta(days=30),
        notes="Q1 2024 Earnings Call",
    )


@pytest.fixture
def sec_filing_citation() -> SourceCitation:
    """Citation from SEC 10-K filing."""
    return SourceCitation(
        source_type=SourceType.SEC_EDGAR,
        source_url="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000909832&type=10-K",
        retrieved_at=datetime.utcnow() - timedelta(days=45),
        api_endpoint="10-K",
    )


# ============================================================================
# Mock API Response Fixtures
# ============================================================================

@pytest.fixture
def mock_builtwith_response() -> Dict[str, Any]:
    """Sample BuiltWith API response."""
    return {
        "Results": [{
            "Lookup": "costco.com",
            "Technologies": [
                {"Name": "Algolia", "Tag": "search", "FirstDetected": 1609459200000},
                {"Name": "React", "Tag": "framework", "FirstDetected": 1609459200000},
                {"Name": "CloudFlare", "Tag": "cdn", "FirstDetected": 1609459200000},
            ],
            "Meta": {
                "Vertical": "Retail",
                "CompanyName": "Costco Wholesale Corporation",
            }
        }]
    }


@pytest.fixture
def mock_similarweb_response() -> Dict[str, Any]:
    """Sample SimilarWeb API response."""
    return {
        "visits": 150000000,
        "pages_per_visit": 5.2,
        "average_visit_duration": 245.5,
        "bounce_rate": 0.42,
        "traffic_sources": {
            "direct": 0.45,
            "search": 0.35,
            "referral": 0.12,
            "social": 0.05,
            "paid": 0.03,
        },
        "top_keywords": [
            {"keyword": "costco", "share": 0.15},
            {"keyword": "costco membership", "share": 0.08},
        ],
    }


@pytest.fixture
def mock_yahoo_finance_response() -> Dict[str, Any]:
    """Sample Yahoo Finance API response."""
    return {
        "quoteSummary": {
            "result": [{
                "financialData": {
                    "totalRevenue": {"raw": 254000000000},
                    "grossMargins": {"raw": 0.126},
                    "operatingMargins": {"raw": 0.034},
                },
                "summaryDetail": {
                    "marketCap": {"raw": 400000000000},
                    "trailingPE": {"raw": 55.2},
                },
                "price": {
                    "regularMarketPrice": {"raw": 925.50},
                },
            }]
        }
    }


# ============================================================================
# Mock Adapter Fixtures
# ============================================================================

@pytest.fixture
def mock_http_client() -> MagicMock:
    """Mock HTTP client for testing adapters without network calls."""
    client = MagicMock()
    client.get = AsyncMock()
    client.post = AsyncMock()
    return client


# ============================================================================
# Validation Report Fixtures
# ============================================================================

@pytest.fixture
def sample_validation_report() -> Dict[str, Any]:
    """Sample validation report structure."""
    return {
        "module": "M02_TechnologyStack",
        "domain": "costco.com",
        "timestamp": datetime.utcnow().isoformat(),
        "status": "PASS",
        "expected": {
            "has_search_provider": True,
            "technology_count": "> 0",
        },
        "actual": {
            "has_search_provider": True,
            "technology_count": 45,
        },
        "citations_validated": 5,
        "freshness_check": "PASS",
    }


# ============================================================================
# Test Configuration
# ============================================================================

@pytest.fixture(scope="session")
def test_config() -> Dict[str, Any]:
    """Test configuration."""
    return {
        "use_mock_apis": True,
        "cache_ttl_seconds": 3600,
        "max_retries": 3,
        "timeout_seconds": 30,
    }


# ============================================================================
# Database Fixtures (for integration tests)
# ============================================================================

@pytest.fixture
def mock_db_session() -> MagicMock:
    """Mock database session for unit tests."""
    session = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session
