# PartnerForge Testing & Quality Architecture

**Version:** 1.0
**Date:** 2026-02-25
**Status:** MANDATORY - Part of Fundamental Methodology
**Priority:** P0 - Every component MUST have corresponding tests

---

## Executive Summary

**Core Principle:** Every piece of code written MUST have corresponding tests written in parallel. No PR merges without tests. No exceptions.

```
┌─────────────────────────────────────────────────────────────────┐
│                    TESTING PYRAMID                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        ▲                                         │
│                       ╱ ╲       E2E Tests (5%)                  │
│                      ╱───╲      - Full enrichment flow           │
│                     ╱     ╲     - UI + API + DB                  │
│                    ╱───────╲                                     │
│                   ╱         ╲   Integration Tests (25%)          │
│                  ╱───────────╲  - Module interactions            │
│                 ╱             ╲ - API endpoints                  │
│                ╱───────────────╲                                 │
│               ╱                 ╲ Unit Tests (70%)               │
│              ╱───────────────────╲ - Functions, classes          │
│             ╱                     ╲ - Isolated, fast             │
│            ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Testing Philosophy

### 1.1 The Three Laws of Testing

1. **Every component has tests** - No code without corresponding tests
2. **Tests are written in parallel** - Not after, but DURING development
3. **Tests document behavior** - Tests ARE the specification

### 1.2 Test-Driven Development Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. WRITE TEST FIRST                                             │
│     Define expected behavior before implementation               │
│                           ↓                                      │
│  2. RUN TEST (expect FAIL)                                       │
│     Confirm test correctly detects missing functionality         │
│                           ↓                                      │
│  3. WRITE MINIMAL CODE                                           │
│     Just enough to make test pass                                │
│                           ↓                                      │
│  4. RUN TEST (expect PASS)                                       │
│     Verify implementation meets spec                             │
│                           ↓                                      │
│  5. REFACTOR                                                     │
│     Improve code quality while tests stay green                  │
│                           ↓                                      │
│  6. REPEAT                                                       │
│     For each new feature/behavior                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
tests/
├── __init__.py
├── conftest.py                    # Shared fixtures
├── factories/                     # Test data factories
│   ├── __init__.py
│   ├── company_factory.py         # Generate test companies
│   ├── snapshot_factory.py        # Generate test snapshots
│   └── api_response_factory.py    # Generate mock API responses
├── fixtures/                      # Static test data
│   ├── builtwith/
│   │   ├── costco.json
│   │   ├── sallybeauty.json
│   │   └── error_responses.json
│   ├── similarweb/
│   │   ├── costco_traffic.json
│   │   └── competitors.json
│   └── yahoo_finance/
│       ├── COST_financials.json
│       └── SBH_financials.json
├── unit/                          # Unit tests (70%)
│   ├── __init__.py
│   ├── utils/
│   │   ├── test_retry.py
│   │   ├── test_circuit_breaker.py
│   │   └── test_rate_limiter.py
│   ├── adapters/
│   │   ├── test_base_adapter.py
│   │   ├── test_builtwith.py
│   │   ├── test_similarweb.py
│   │   └── test_yahoo_finance.py
│   ├── models/
│   │   ├── test_source_citation.py
│   │   └── test_company_models.py
│   ├── modules/
│   │   ├── test_m01_company_context.py
│   │   ├── test_m02_technology_stack.py
│   │   └── ...
│   ├── validators/
│   │   ├── test_source_validator.py
│   │   └── test_freshness_validator.py
│   └── services/
│       ├── test_change_detector.py
│       ├── test_notification_service.py
│       └── test_cost_tracker.py
├── integration/                   # Integration tests (25%)
│   ├── __init__.py
│   ├── test_enrichment_flow.py
│   ├── test_wave_execution.py
│   ├── test_api_endpoints.py
│   └── test_database_operations.py
├── e2e/                           # End-to-end tests (5%)
│   ├── __init__.py
│   └── test_full_enrichment.py
└── performance/                   # Performance tests
    ├── __init__.py
    ├── test_batch_enrichment.py
    └── test_api_latency.py
```

---

## 3. Test Patterns & Standards

### 3.1 Unit Test Pattern

```python
# tests/unit/utils/test_retry.py

import pytest
from unittest.mock import AsyncMock, patch
from pipeline.utils.retry import retry_with_backoff, RetryConfig, RetryExhaustedError

class TestRetryWithBackoff:
    """
    Tests for the retry_with_backoff decorator.

    Test Categories:
    - Success cases (no retry needed)
    - Retry cases (temporary failures)
    - Exhaustion cases (all retries fail)
    - Configuration cases (custom settings)
    """

    # ============ SUCCESS CASES ============

    @pytest.mark.asyncio
    async def test_success_on_first_attempt(self):
        """
        GIVEN: A function that succeeds immediately
        WHEN: Called with retry decorator
        THEN: Returns result without retry
        """
        # Arrange
        expected_result = {"data": "success"}
        mock_func = AsyncMock(return_value=expected_result)
        decorated = retry_with_backoff(max_retries=3)(mock_func)

        # Act
        result = await decorated()

        # Assert
        assert result == expected_result
        assert mock_func.call_count == 1, "Should only call once on success"

    # ============ RETRY CASES ============

    @pytest.mark.asyncio
    async def test_retry_on_transient_failure(self):
        """
        GIVEN: A function that fails twice then succeeds
        WHEN: Called with retry decorator
        THEN: Retries and eventually returns success
        """
        # Arrange
        expected_result = {"data": "success"}
        mock_func = AsyncMock(side_effect=[
            ConnectionError("Network error"),
            TimeoutError("Timeout"),
            expected_result
        ])
        decorated = retry_with_backoff(max_retries=3, base_delay_ms=10)(mock_func)

        # Act
        result = await decorated()

        # Assert
        assert result == expected_result
        assert mock_func.call_count == 3, "Should retry twice before success"

    @pytest.mark.asyncio
    async def test_exponential_backoff_timing(self):
        """
        GIVEN: A function that fails multiple times
        WHEN: Retry decorator applies backoff
        THEN: Delay increases exponentially
        """
        # Arrange
        delays_observed = []

        async def track_delay(delay):
            delays_observed.append(delay)

        config = RetryConfig(
            max_retries=4,
            base_delay_ms=100,
            exponential_base=2.0,
            jitter_factor=0.0  # No jitter for predictable test
        )

        # ... test implementation

        # Assert
        # Delays should be approximately: 100ms, 200ms, 400ms, 800ms
        assert delays_observed[0] == pytest.approx(0.1, rel=0.1)
        assert delays_observed[1] == pytest.approx(0.2, rel=0.1)
        assert delays_observed[2] == pytest.approx(0.4, rel=0.1)

    # ============ EXHAUSTION CASES ============

    @pytest.mark.asyncio
    async def test_raises_after_max_retries(self):
        """
        GIVEN: A function that always fails
        WHEN: All retry attempts exhausted
        THEN: Raises RetryExhaustedError with context
        """
        # Arrange
        mock_func = AsyncMock(side_effect=ConnectionError("Always fails"))
        decorated = retry_with_backoff(max_retries=3, base_delay_ms=10)(mock_func)

        # Act & Assert
        with pytest.raises(RetryExhaustedError) as exc_info:
            await decorated()

        error = exc_info.value
        assert error.attempts == 3
        assert isinstance(error.last_exception, ConnectionError)
        assert "Always fails" in str(error.last_exception)

    # ============ CONFIGURATION CASES ============

    @pytest.mark.asyncio
    async def test_custom_retry_config(self):
        """
        GIVEN: Custom RetryConfig
        WHEN: Applied to decorator
        THEN: Uses custom settings
        """
        # Arrange
        config = RetryConfig(
            max_retries=5,
            base_delay_ms=50,
            retryable_exceptions={ValueError}
        )

        mock_func = AsyncMock(side_effect=[
            ValueError("Retryable"),
            ValueError("Retryable"),
            {"success": True}
        ])
        decorated = retry_with_backoff(config=config)(mock_func)

        # Act
        result = await decorated()

        # Assert
        assert result == {"success": True}
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_non_retryable_exception_raises_immediately(self):
        """
        GIVEN: An exception not in retryable set
        WHEN: Function raises it
        THEN: Raises immediately without retry
        """
        # Arrange
        mock_func = AsyncMock(side_effect=KeyError("Not retryable"))
        decorated = retry_with_backoff(max_retries=3)(mock_func)

        # Act & Assert
        with pytest.raises(KeyError):
            await decorated()

        assert mock_func.call_count == 1, "Should not retry non-retryable exceptions"
```

### 3.2 Validation Pattern (Expected vs Actual)

```python
# tests/validation/base.py

from dataclasses import dataclass
from typing import Any, Optional
from enum import Enum

class ValidationStatus(Enum):
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class ValidationResult:
    """Captures expected vs actual comparison."""
    field: str
    expected: Any
    actual: Any
    status: ValidationStatus
    message: Optional[str] = None
    severity: str = "error"  # error, warning, info

    @property
    def passed(self) -> bool:
        return self.status == ValidationStatus.PASSED

    def __str__(self) -> str:
        if self.passed:
            return f"✅ {self.field}: {self.actual}"
        else:
            return f"❌ {self.field}: Expected {self.expected}, got {self.actual}"


class ValidationReport:
    """Aggregates validation results."""

    def __init__(self, test_name: str):
        self.test_name = test_name
        self.results: list[ValidationResult] = []

    def add(self, field: str, expected: Any, actual: Any, message: str = None):
        """Add a validation check."""
        if expected == actual:
            status = ValidationStatus.PASSED
        else:
            status = ValidationStatus.FAILED

        self.results.append(ValidationResult(
            field=field,
            expected=expected,
            actual=actual,
            status=status,
            message=message
        ))
        return self

    def add_range(self, field: str, actual: Any, min_val: Any, max_val: Any):
        """Validate value is within range."""
        if min_val <= actual <= max_val:
            status = ValidationStatus.PASSED
            expected = f"{min_val} <= x <= {max_val}"
        else:
            status = ValidationStatus.FAILED
            expected = f"{min_val} <= x <= {max_val}"

        self.results.append(ValidationResult(
            field=field,
            expected=expected,
            actual=actual,
            status=status
        ))
        return self

    def add_type(self, field: str, actual: Any, expected_type: type):
        """Validate value is of expected type."""
        if isinstance(actual, expected_type):
            status = ValidationStatus.PASSED
        else:
            status = ValidationStatus.FAILED

        self.results.append(ValidationResult(
            field=field,
            expected=expected_type.__name__,
            actual=type(actual).__name__,
            status=status
        ))
        return self

    def add_not_none(self, field: str, actual: Any):
        """Validate value is not None."""
        if actual is not None:
            status = ValidationStatus.PASSED
        else:
            status = ValidationStatus.FAILED

        self.results.append(ValidationResult(
            field=field,
            expected="not None",
            actual=actual,
            status=status
        ))
        return self

    def add_contains(self, field: str, actual: str, expected_substring: str):
        """Validate string contains substring."""
        if expected_substring in actual:
            status = ValidationStatus.PASSED
        else:
            status = ValidationStatus.FAILED

        self.results.append(ValidationResult(
            field=field,
            expected=f"contains '{expected_substring}'",
            actual=actual[:50] + "..." if len(actual) > 50 else actual,
            status=status
        ))
        return self

    @property
    def all_passed(self) -> bool:
        return all(r.passed for r in self.results)

    @property
    def passed_count(self) -> int:
        return sum(1 for r in self.results if r.passed)

    @property
    def failed_count(self) -> int:
        return sum(1 for r in self.results if not r.passed)

    def get_failures(self) -> list[ValidationResult]:
        return [r for r in self.results if not r.passed]

    def to_dict(self) -> dict:
        return {
            "test_name": self.test_name,
            "total": len(self.results),
            "passed": self.passed_count,
            "failed": self.failed_count,
            "results": [
                {
                    "field": r.field,
                    "expected": str(r.expected),
                    "actual": str(r.actual),
                    "status": r.status.value,
                    "message": r.message
                }
                for r in self.results
            ]
        }

    def __str__(self) -> str:
        lines = [
            f"\n{'='*60}",
            f"VALIDATION REPORT: {self.test_name}",
            f"{'='*60}",
            f"Total: {len(self.results)} | Passed: {self.passed_count} | Failed: {self.failed_count}",
            f"{'-'*60}"
        ]

        for result in self.results:
            lines.append(str(result))

        lines.append(f"{'='*60}\n")
        return "\n".join(lines)

    def assert_all_passed(self):
        """Raise AssertionError if any validation failed."""
        if not self.all_passed:
            failures = self.get_failures()
            failure_msg = "\n".join(str(f) for f in failures)
            raise AssertionError(
                f"Validation failed for {self.test_name}:\n{failure_msg}"
            )
```

### 3.3 Using Validation in Tests

```python
# tests/unit/adapters/test_builtwith.py

import pytest
from tests.validation.base import ValidationReport
from tests.fixtures.builtwith import COSTCO_RESPONSE
from pipeline.adapters.builtwith import BuiltWithAdapter

class TestBuiltWithAdapter:
    """Tests for BuiltWith API adapter."""

    @pytest.mark.asyncio
    async def test_parse_technology_stack(self):
        """
        GIVEN: Raw BuiltWith API response for costco.com
        WHEN: Parsed by adapter
        THEN: Returns correctly structured TechnologyStack
        """
        # Arrange
        adapter = BuiltWithAdapter()
        raw_response = COSTCO_RESPONSE

        # Act
        result = adapter.transform(raw_response)

        # Validate with detailed report
        report = ValidationReport("BuiltWith TechnologyStack Parsing")

        report.add_not_none("domain", result.domain)
        report.add("domain", "costco.com", result.domain)

        report.add_not_none("ecommerce_platform", result.ecommerce_platform)
        report.add_contains("ecommerce_platform", result.ecommerce_platform.lower(), "aem")

        report.add_type("technologies", result.technologies, list)
        report.add_range("technology_count", len(result.technologies), 10, 200)

        report.add_not_none("search_provider", result.search_provider)
        report.add("search_provider.detection_status",
                   "confirmed",
                   result.search_provider.detection_status)

        report.add_not_none("source", result.source)
        report.add_contains("source.url", result.source.url, "builtwith.com")

        # Assert - prints detailed report on failure
        print(report)  # Always print for debugging
        report.assert_all_passed()

    @pytest.mark.asyncio
    async def test_source_citation_mandatory(self):
        """
        GIVEN: Any BuiltWith response
        WHEN: Transformed by adapter
        THEN: Source citation is ALWAYS present and valid
        """
        # Arrange
        adapter = BuiltWithAdapter()

        # Act
        result = adapter.transform(COSTCO_RESPONSE)

        # Validate source citation (P0 requirement)
        report = ValidationReport("Source Citation Validation")

        report.add_not_none("source", result.source)
        report.add_not_none("source.url", result.source.url)
        report.add("source.source_type", "builtwith_api", result.source.source_type)
        report.add_not_none("source.fetched_at", result.source.fetched_at)

        # Source must be fresh (within 1 day for this test)
        from datetime import datetime, timedelta
        max_age = datetime.utcnow() - timedelta(days=1)
        report.add(
            "source.fetched_at_fresh",
            True,
            result.source.fetched_at >= max_age,
            "Source should be fetched within last 24 hours"
        )

        report.assert_all_passed()
```

---

## 4. Mock Strategy (Expensive API Avoidance)

### 4.1 Mock Response Fixtures

```python
# tests/fixtures/builtwith/__init__.py

import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent

def load_fixture(filename: str) -> dict:
    """Load JSON fixture file."""
    with open(FIXTURES_DIR / filename) as f:
        return json.load(f)

# Pre-loaded fixtures for common test cases
COSTCO_RESPONSE = load_fixture("costco.json")
SALLYBEAUTY_RESPONSE = load_fixture("sallybeauty.json")
ERROR_RATE_LIMITED = load_fixture("error_rate_limited.json")
ERROR_NOT_FOUND = load_fixture("error_not_found.json")
ERROR_SERVER = load_fixture("error_server.json")


# tests/fixtures/builtwith/costco.json
{
    "Results": [
        {
            "Lookup": "costco.com",
            "Result": {
                "Paths": [
                    {
                        "Technologies": [
                            {
                                "Name": "Adobe Experience Manager",
                                "Categories": ["CMS"],
                                "FirstDetected": "2020-01-15",
                                "LastDetected": "2026-02-25"
                            },
                            {
                                "Name": "Elasticsearch",
                                "Categories": ["Search"],
                                "FirstDetected": "2019-03-01",
                                "LastDetected": "2026-02-25"
                            }
                        ]
                    }
                ],
                "Spend": 150000,
                "SpendProfile": "High"
            }
        }
    ]
}
```

### 4.2 Mock Adapter Pattern

```python
# tests/mocks/adapters.py

from unittest.mock import AsyncMock
from typing import Dict, Any
from tests.fixtures import builtwith, similarweb, yahoo_finance

class MockBuiltWithAdapter:
    """
    Mock BuiltWith adapter that returns fixture data.
    Never makes real API calls.
    """

    DOMAIN_RESPONSES: Dict[str, dict] = {
        "costco.com": builtwith.COSTCO_RESPONSE,
        "sallybeauty.com": builtwith.SALLYBEAUTY_RESPONSE,
    }

    ERROR_DOMAINS = {
        "error.rate-limited.com": builtwith.ERROR_RATE_LIMITED,
        "error.not-found.com": builtwith.ERROR_NOT_FOUND,
    }

    def __init__(self):
        self.call_count = 0
        self.calls_log = []

    async def fetch(self, endpoint: str, domain: str = None, **kwargs) -> dict:
        """Mock fetch that returns fixture data."""
        self.call_count += 1
        self.calls_log.append({
            "endpoint": endpoint,
            "domain": domain,
            "kwargs": kwargs
        })

        # Check for error domains
        if domain in self.ERROR_DOMAINS:
            raise self._make_error(self.ERROR_DOMAINS[domain])

        # Return fixture or empty response
        return self.DOMAIN_RESPONSES.get(domain, {
            "Results": [{"Lookup": domain, "Result": {"Paths": []}}]
        })

    def _make_error(self, error_fixture: dict):
        """Create appropriate exception from error fixture."""
        error_type = error_fixture.get("error_type")
        if error_type == "rate_limit":
            from pipeline.utils.rate_limiter import RateLimitExceededError
            return RateLimitExceededError("builtwith", 60.0)
        elif error_type == "not_found":
            return ValueError(f"Domain not found: {error_fixture.get('domain')}")
        else:
            return Exception(error_fixture.get("message", "Unknown error"))


class MockSimilarWebAdapter:
    """Mock SimilarWeb adapter."""

    DOMAIN_RESPONSES: Dict[str, Dict[str, dict]] = {
        "costco.com": {
            "traffic": similarweb.COSTCO_TRAFFIC,
            "engagement": similarweb.COSTCO_ENGAGEMENT,
            "competitors": similarweb.COSTCO_COMPETITORS,
        }
    }

    async def fetch(self, endpoint: str, domain: str = None, **kwargs) -> dict:
        domain_data = self.DOMAIN_RESPONSES.get(domain, {})
        return domain_data.get(endpoint, {})


class MockYahooFinanceAdapter:
    """Mock Yahoo Finance adapter."""

    TICKER_RESPONSES: Dict[str, Dict[str, dict]] = {
        "COST": {
            "financials": yahoo_finance.COST_FINANCIALS,
            "stock_info": yahoo_finance.COST_STOCK_INFO,
        },
        "SBH": {
            "financials": yahoo_finance.SBH_FINANCIALS,
        }
    }

    async def fetch(self, endpoint: str, ticker: str = None, **kwargs) -> dict:
        ticker_data = self.TICKER_RESPONSES.get(ticker, {})
        return ticker_data.get(endpoint, {})
```

### 4.3 Pytest Fixtures for Mocks

```python
# tests/conftest.py

import pytest
from unittest.mock import AsyncMock, patch
from tests.mocks.adapters import (
    MockBuiltWithAdapter,
    MockSimilarWebAdapter,
    MockYahooFinanceAdapter
)

@pytest.fixture
def mock_builtwith():
    """Provide mock BuiltWith adapter."""
    return MockBuiltWithAdapter()

@pytest.fixture
def mock_similarweb():
    """Provide mock SimilarWeb adapter."""
    return MockSimilarWebAdapter()

@pytest.fixture
def mock_yahoo_finance():
    """Provide mock Yahoo Finance adapter."""
    return MockYahooFinanceAdapter()

@pytest.fixture
def mock_all_adapters(mock_builtwith, mock_similarweb, mock_yahoo_finance):
    """Patch all adapters globally for integration tests."""
    with patch('pipeline.adapters.builtwith.BuiltWithAdapter', return_value=mock_builtwith), \
         patch('pipeline.adapters.similarweb.SimilarWebAdapter', return_value=mock_similarweb), \
         patch('pipeline.adapters.yahoo_finance.YahooFinanceAdapter', return_value=mock_yahoo_finance):
        yield {
            "builtwith": mock_builtwith,
            "similarweb": mock_similarweb,
            "yahoo_finance": mock_yahoo_finance,
        }

@pytest.fixture
def test_db():
    """Provide test database session."""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    # Use SQLite for tests (fast, no external deps)
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False
    )

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    # Create tables
    # ... schema setup

    async def get_session():
        async with async_session() as session:
            yield session
            await session.rollback()  # Always rollback for isolation

    return get_session
```

---

## 5. Self-Correction & Iterative Improvement

### 5.1 Self-Correction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  SELF-CORRECTION WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TEST FAILS                                                   │
│     │                                                            │
│     ▼                                                            │
│  2. CAPTURE FAILURE CONTEXT                                      │
│     • Expected value                                             │
│     • Actual value                                               │
│     • Stack trace                                                │
│     • Input data                                                 │
│     │                                                            │
│     ▼                                                            │
│  3. ANALYZE FAILURE TYPE                                         │
│     ┌──────────────────┬────────────────────┐                   │
│     │ Type             │ Correction Action  │                   │
│     ├──────────────────┼────────────────────┤                   │
│     │ Assertion Error  │ Fix logic          │                   │
│     │ Timeout          │ Increase limit OR  │                   │
│     │                  │ optimize code      │                   │
│     │ Network Error    │ Add retry/mock     │                   │
│     │ Parse Error      │ Handle edge case   │                   │
│     │ Validation Error │ Update validator   │                   │
│     └──────────────────┴────────────────────┘                   │
│     │                                                            │
│     ▼                                                            │
│  4. APPLY CORRECTION                                             │
│     │                                                            │
│     ▼                                                            │
│  5. RE-RUN TEST                                                  │
│     │                                                            │
│     ├─── PASS ──► 6. LOG CORRECTION & CONTINUE                  │
│     │                                                            │
│     └─── FAIL ──► 2. (repeat with new context)                  │
│                                                                  │
│  Max iterations: 3 (then escalate to manual review)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Correction Registry

```python
# tests/corrections/registry.py

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional
import json
from pathlib import Path

class FailureType(Enum):
    ASSERTION = "assertion"
    TIMEOUT = "timeout"
    NETWORK = "network"
    PARSE = "parse"
    VALIDATION = "validation"
    PERMISSION = "permission"
    RESOURCE = "resource"

@dataclass
class Correction:
    """Record of a correction made to fix a test."""
    test_name: str
    failure_type: FailureType
    original_error: str
    correction_applied: str
    corrected_at: datetime
    iterations: int
    success: bool

    def to_dict(self) -> dict:
        return {
            "test_name": self.test_name,
            "failure_type": self.failure_type.value,
            "original_error": self.original_error,
            "correction_applied": self.correction_applied,
            "corrected_at": self.corrected_at.isoformat(),
            "iterations": self.iterations,
            "success": self.success
        }

class CorrectionRegistry:
    """
    Tracks all corrections made during test runs.
    Enables pattern detection and learning from failures.
    """

    def __init__(self, registry_path: Path = None):
        self.registry_path = registry_path or Path("tests/corrections/history.json")
        self.corrections: list[Correction] = []
        self._load()

    def _load(self):
        """Load correction history from disk."""
        if self.registry_path.exists():
            with open(self.registry_path) as f:
                data = json.load(f)
                # Deserialize corrections
                self.corrections = [
                    Correction(
                        test_name=c["test_name"],
                        failure_type=FailureType(c["failure_type"]),
                        original_error=c["original_error"],
                        correction_applied=c["correction_applied"],
                        corrected_at=datetime.fromisoformat(c["corrected_at"]),
                        iterations=c["iterations"],
                        success=c["success"]
                    )
                    for c in data.get("corrections", [])
                ]

    def save(self):
        """Persist correction history to disk."""
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.registry_path, "w") as f:
            json.dump({
                "last_updated": datetime.utcnow().isoformat(),
                "total_corrections": len(self.corrections),
                "corrections": [c.to_dict() for c in self.corrections]
            }, f, indent=2)

    def record(self, correction: Correction):
        """Record a new correction."""
        self.corrections.append(correction)
        self.save()

    def get_patterns(self) -> dict:
        """Analyze correction patterns for insights."""
        by_type = {}
        by_test = {}

        for c in self.corrections:
            # Count by failure type
            type_key = c.failure_type.value
            by_type[type_key] = by_type.get(type_key, 0) + 1

            # Count by test (flaky test detection)
            if c.test_name not in by_test:
                by_test[c.test_name] = {"count": 0, "types": set()}
            by_test[c.test_name]["count"] += 1
            by_test[c.test_name]["types"].add(type_key)

        # Find flaky tests (>2 corrections)
        flaky_tests = [
            test for test, data in by_test.items()
            if data["count"] > 2
        ]

        return {
            "total_corrections": len(self.corrections),
            "by_failure_type": by_type,
            "flaky_tests": flaky_tests,
            "most_common_failure": max(by_type, key=by_type.get) if by_type else None
        }


# Global registry instance
correction_registry = CorrectionRegistry()
```

### 5.3 Self-Correcting Test Runner

```python
# tests/runner/self_correcting.py

import asyncio
from typing import Callable, TypeVar, Any
from tests.corrections.registry import (
    correction_registry,
    Correction,
    FailureType
)
from datetime import datetime

T = TypeVar("T")

class SelfCorrectingRunner:
    """
    Runs tests with automatic retry and correction attempts.
    """

    MAX_ITERATIONS = 3

    def __init__(self):
        self.corrections_applied = []

    async def run_with_correction(
        self,
        test_func: Callable[..., T],
        *args,
        **kwargs
    ) -> T:
        """
        Run test with self-correction loop.
        """
        iterations = 0
        last_error = None

        while iterations < self.MAX_ITERATIONS:
            iterations += 1

            try:
                result = await test_func(*args, **kwargs)

                # If we corrected something, record success
                if last_error:
                    correction_registry.record(Correction(
                        test_name=test_func.__name__,
                        failure_type=self._classify_error(last_error),
                        original_error=str(last_error),
                        correction_applied=self._get_correction_description(),
                        corrected_at=datetime.utcnow(),
                        iterations=iterations,
                        success=True
                    ))

                return result

            except AssertionError as e:
                last_error = e
                # Try to apply correction
                correction = await self._attempt_correction(e, "assertion")
                if not correction:
                    raise

            except TimeoutError as e:
                last_error = e
                # Increase timeout
                kwargs["timeout"] = kwargs.get("timeout", 30) * 2

            except Exception as e:
                last_error = e
                correction = await self._attempt_correction(e, "other")
                if not correction:
                    raise

        # All iterations exhausted
        correction_registry.record(Correction(
            test_name=test_func.__name__,
            failure_type=self._classify_error(last_error),
            original_error=str(last_error),
            correction_applied="MAX_ITERATIONS_REACHED",
            corrected_at=datetime.utcnow(),
            iterations=iterations,
            success=False
        ))
        raise last_error

    def _classify_error(self, error: Exception) -> FailureType:
        """Classify error type."""
        if isinstance(error, AssertionError):
            return FailureType.ASSERTION
        elif isinstance(error, TimeoutError):
            return FailureType.TIMEOUT
        elif isinstance(error, ConnectionError):
            return FailureType.NETWORK
        elif isinstance(error, (KeyError, ValueError, TypeError)):
            return FailureType.PARSE
        else:
            return FailureType.VALIDATION

    async def _attempt_correction(
        self,
        error: Exception,
        error_type: str
    ) -> bool:
        """
        Attempt to apply automatic correction.
        Returns True if correction applied.
        """
        # Log the attempt
        print(f"🔧 Attempting correction for {error_type}: {error}")

        # Correction strategies based on error type
        if error_type == "assertion":
            # For assertion errors, we can't auto-correct logic
            # but we can log detailed context
            self._log_assertion_context(error)
            return False

        return False

    def _log_assertion_context(self, error: AssertionError):
        """Log detailed context for assertion failures."""
        print(f"""
        ╔══════════════════════════════════════════════════════════════╗
        ║ ASSERTION FAILURE - MANUAL CORRECTION REQUIRED               ║
        ╠══════════════════════════════════════════════════════════════╣
        ║ Error: {str(error)[:50]}...
        ║
        ║ Suggested Actions:
        ║ 1. Review expected vs actual values
        ║ 2. Check if test fixture is up to date
        ║ 3. Verify business logic hasn't changed
        ║ 4. Update test if requirements changed
        ╚══════════════════════════════════════════════════════════════╝
        """)

    def _get_correction_description(self) -> str:
        """Get description of corrections applied."""
        if self.corrections_applied:
            return "; ".join(self.corrections_applied)
        return "No corrections needed"
```

---

## 6. CI/CD Integration

### 6.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.11', '3.12']

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-test.txt

      - name: Run unit tests
        run: |
          pytest tests/unit \
            --cov=pipeline \
            --cov-report=xml \
            --cov-report=html \
            --cov-fail-under=80 \
            --junitxml=reports/unit-tests.xml \
            -v

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: coverage.xml
          fail_ci_if_error: true

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.python-version }}
          path: reports/

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: partnerforge_test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Run integration tests
        run: |
          pytest tests/integration \
            --junitxml=reports/integration-tests.xml \
            -v
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/partnerforge_test
          REDIS_URL: redis://localhost:6379

  validation-report:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: always()

    steps:
      - name: Download all test results
        uses: actions/download-artifact@v4

      - name: Generate validation report
        run: |
          python scripts/generate_validation_report.py \
            --input reports/ \
            --output validation-report.md

      - name: Comment PR with report
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('validation-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```

### 6.2 Test Coverage Requirements

```ini
# pytest.ini

[pytest]
minversion = 7.0
addopts = -ra -q --strict-markers
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

markers =
    unit: Unit tests (fast, isolated)
    integration: Integration tests (slower, requires services)
    e2e: End-to-end tests (full system)
    slow: Slow-running tests
    api: Tests that call external APIs (use with caution)

# Coverage requirements
[coverage:run]
source = pipeline
branch = true
omit =
    */tests/*
    */__init__.py

[coverage:report]
fail_under = 80
show_missing = true
exclude_lines =
    pragma: no cover
    def __repr__
    raise NotImplementedError
```

---

## 7. Test Documentation Template

Every test file must follow this documentation pattern:

```python
"""
Tests for [Component Name]
==========================

Test Coverage:
- [Feature 1]: test_xxx, test_yyy
- [Feature 2]: test_zzz

Prerequisites:
- [Any required fixtures or setup]

External Dependencies:
- [List any mocked services]

Author: [Name]
Date: [YYYY-MM-DD]
"""

import pytest
from tests.validation.base import ValidationReport

class TestComponentName:
    """
    Test suite for [Component Name].

    Covers:
    1. Happy path scenarios
    2. Edge cases
    3. Error handling
    4. Validation enforcement
    """

    # ============ HAPPY PATH ============

    @pytest.mark.unit
    async def test_basic_functionality(self):
        """
        GIVEN: [preconditions]
        WHEN: [action taken]
        THEN: [expected outcome]
        """
        pass

    # ============ EDGE CASES ============

    @pytest.mark.unit
    async def test_empty_input(self):
        """
        GIVEN: Empty input
        WHEN: Processed
        THEN: Handles gracefully
        """
        pass

    # ============ ERROR HANDLING ============

    @pytest.mark.unit
    async def test_invalid_input_raises(self):
        """
        GIVEN: Invalid input
        WHEN: Processed
        THEN: Raises appropriate exception
        """
        pass

    # ============ VALIDATION ============

    @pytest.mark.unit
    async def test_source_citation_required(self):
        """
        GIVEN: Any output
        WHEN: Validated
        THEN: Source citation is present (P0)
        """
        pass
```

---

## 8. Module Test Checklist

When implementing any module, these tests are MANDATORY:

### 8.1 Checklist Template

```markdown
## Module: M0X - [Module Name]

### Unit Tests Required
- [ ] `test_parse_response` - Correctly parse API response
- [ ] `test_parse_empty_response` - Handle empty response
- [ ] `test_parse_malformed_response` - Handle malformed data
- [ ] `test_source_citation_present` - Source citation on all fields
- [ ] `test_source_citation_fresh` - Source date within limit
- [ ] `test_transform_output` - Output matches schema
- [ ] `test_validation_errors` - Proper validation messages

### Integration Tests Required
- [ ] `test_full_module_flow` - Input → Output complete flow
- [ ] `test_error_propagation` - Errors bubble up correctly
- [ ] `test_partial_data` - Handles missing fields gracefully

### Validation Points
| Field | Type | Source Required | Freshness Limit |
|-------|------|-----------------|-----------------|
| [field_name] | [type] | [yes/no] | [days] |

### Expected vs Actual Checks
- [ ] Output schema matches `M0XOutput` type
- [ ] All required fields present
- [ ] No None values for required fields
- [ ] Source URLs are valid HTTP(S)
- [ ] Source dates within freshness limit

### Self-Correction Scenarios
- [ ] Timeout → Retry with increased limit
- [ ] Rate limit → Wait and retry
- [ ] Parse error → Log and return partial
- [ ] Validation fail → Log details, reject
```

---

## 9. Running Tests

### 9.1 Commands

```bash
# Run all tests
pytest

# Run unit tests only
pytest tests/unit -v

# Run integration tests only
pytest tests/integration -v

# Run with coverage
pytest --cov=pipeline --cov-report=html

# Run specific test file
pytest tests/unit/utils/test_retry.py -v

# Run tests matching pattern
pytest -k "retry" -v

# Run with validation report
pytest --tb=short --junitxml=report.xml

# Run in parallel (faster)
pytest -n auto

# Run with self-correction logging
pytest --capture=no -v
```

### 9.2 Pre-commit Hook

```yaml
# .pre-commit-config.yaml

repos:
  - repo: local
    hooks:
      - id: pytest-check
        name: pytest
        entry: pytest tests/unit -v --tb=short
        language: system
        pass_filenames: false
        always_run: true
```

---

## 10. Summary

### Testing Principles

| Principle | Enforcement |
|-----------|-------------|
| Every component has tests | PR blocked without tests |
| Tests written in parallel | Same commit as implementation |
| Expected vs Actual validation | ValidationReport class |
| Mock expensive APIs | Fixture-based mocks |
| Self-correction tracking | CorrectionRegistry |
| 80% coverage minimum | CI fails below threshold |
| Tests document behavior | GIVEN/WHEN/THEN format |

### File Persistence

All test artifacts are persisted:
- `tests/corrections/history.json` - Correction history
- `reports/*.xml` - JUnit test reports
- `coverage/` - Coverage HTML reports
- `tests/fixtures/**/*.json` - Mock response data

---

*Document created: 2026-02-25*
*Author: Thread 2 - Data Pipeline*
*Status: MANDATORY - Part of Fundamental Methodology*
*Priority: P0*
