# PartnerForge Testing Architecture & Quality Assurance

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Foundational Methodology
**Priority:** P0 - Core Development Practice

---

## Executive Summary

**Every module, service, and component MUST have corresponding tests written IN PARALLEL with the implementation.** This is not optional. Tests are not an afterthought - they are part of the deliverable.

This document defines:
1. **Test Pyramid** - Unit, Integration, System tests
2. **Test-Driven Development** - Write tests alongside code
3. **Self-Correction Mechanisms** - Automatic failure rectification
4. **Iterative Improvement** - Continuous quality enhancement
5. **Validation Framework** - Expected vs Actual comparison

---

## 1. Core Principle: Tests Are Part of the Deliverable

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEFINITION OF "DONE"                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  A module/feature is ONLY considered complete when:                      │
│                                                                          │
│  ✅ Code is implemented                                                  │
│  ✅ Unit tests written (≥80% coverage)                                   │
│  ✅ Integration tests written                                            │
│  ✅ All tests pass                                                       │
│  ✅ Test documentation updated                                           │
│  ✅ Self-correction handlers implemented                                 │
│                                                                          │
│  Missing tests = Incomplete work                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Test Pyramid

```
                           ┌───────────────┐
                          ╱                 ╲
                         ╱   E2E / System    ╲     ~10%
                        ╱     (Slow, Broad)   ╲
                       ╱───────────────────────╲
                      ╱                         ╲
                     ╱   Integration Tests       ╲   ~20%
                    ╱   (API, Database, MCP)      ╲
                   ╱───────────────────────────────╲
                  ╱                                 ╲
                 ╱        Unit Tests                 ╲  ~70%
                ╱    (Fast, Isolated, Focused)        ╲
               ╱───────────────────────────────────────╲
```

### 2.1 Unit Tests (70% of tests)

**Purpose:** Test individual functions, classes, and modules in isolation.

**Characteristics:**
- Fast (< 100ms per test)
- No external dependencies (mocked)
- Focused on single behavior
- Run on every save

**Coverage Requirements:**
| Component | Min Coverage |
|-----------|--------------|
| Services | 85% |
| Models | 80% |
| Utilities | 90% |
| Validators | 95% |

### 2.2 Integration Tests (20% of tests)

**Purpose:** Test interactions between components, database, and APIs.

**Characteristics:**
- Medium speed (< 5s per test)
- Uses test database
- Tests API contracts
- Run on every commit

**Coverage Areas:**
- API endpoint → Service → Database
- Module → Adapter → External API (mocked)
- Change Detection → Notification Engine

### 2.3 System/E2E Tests (10% of tests)

**Purpose:** Test complete user workflows end-to-end.

**Characteristics:**
- Slow (> 30s per test)
- Uses real or sandbox APIs
- Tests full enrichment pipeline
- Run on every PR

**Key Workflows:**
- Full company enrichment (15 modules)
- Change detection after re-enrichment
- Notification delivery
- Cost tracking accumulation

---

## 3. Directory Structure

```
partnerforge/
├── backend/
│   ├── app/
│   │   ├── modules/
│   │   │   ├── m01_company_context.py
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── change_detection.py
│   │   │   └── ...
│   │   └── ...
│   │
│   └── tests/
│       ├── conftest.py                    # Shared fixtures
│       ├── fixtures/                      # Test data
│       │   ├── companies/
│       │   │   ├── costco.json           # Known good data
│       │   │   └── acme.json             # Edge cases
│       │   ├── api_responses/
│       │   │   ├── builtwith/
│       │   │   └── similarweb/
│       │   └── snapshots/
│       │       └── expected_outputs/
│       │
│       ├── unit/                          # Unit tests
│       │   ├── modules/
│       │   │   ├── test_m01_company_context.py
│       │   │   ├── test_m02_tech_stack.py
│       │   │   └── ...
│       │   ├── services/
│       │   │   ├── test_change_detection.py
│       │   │   ├── test_notification_engine.py
│       │   │   └── test_cost_tracking.py
│       │   └── validators/
│       │       └── test_source_citation.py
│       │
│       ├── integration/                   # Integration tests
│       │   ├── test_api_endpoints.py
│       │   ├── test_database_operations.py
│       │   ├── test_adapter_contracts.py
│       │   └── test_module_pipeline.py
│       │
│       ├── system/                        # E2E tests
│       │   ├── test_full_enrichment.py
│       │   ├── test_change_detection_flow.py
│       │   └── test_notification_delivery.py
│       │
│       └── regression/                    # Regression tests
│           ├── test_known_issues.py       # Fixed bugs
│           └── golden_master/             # Snapshot tests
│               └── test_output_format.py
│
├── frontend/
│   └── src/
│       ├── __tests__/                     # Component tests
│       │   ├── Dashboard.test.tsx
│       │   ├── TargetTable.test.tsx
│       │   └── CompanyView.test.tsx
│       └── e2e/                           # Playwright tests
│           └── enrichment-flow.spec.ts
```

---

## 4. Test Template for Every Module

**RULE:** When creating any module/service, create its test file simultaneously.

### 4.1 Module Test Template

```python
# tests/unit/modules/test_m02_tech_stack.py
"""
Test Suite: M02 Technology Stack Module

Module Under Test: backend/app/modules/m02_tech_stack.py
Author: [Thread Name]
Created: [Date]
Last Updated: [Date]

Test Categories:
1. Happy Path - Normal operation with valid inputs
2. Edge Cases - Boundary conditions, empty data, limits
3. Error Handling - Invalid inputs, API failures
4. Source Citation - Mandatory source URL validation
5. Self-Correction - Automatic recovery from failures
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from decimal import Decimal

from app.modules.m02_tech_stack import TechStackModule
from app.models.intel import TechStackResult
from app.services.validation import SourceCitationError
from tests.fixtures import load_fixture


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def module():
    """Create module instance with mocked dependencies."""
    return TechStackModule(
        builtwith_adapter=AsyncMock(),
        similarweb_adapter=AsyncMock(),
        cache=AsyncMock(),
    )


@pytest.fixture
def valid_builtwith_response():
    """Load known-good BuiltWith response."""
    return load_fixture("api_responses/builtwith/costco_domain.json")


@pytest.fixture
def valid_expected_output():
    """Load expected module output for comparison."""
    return load_fixture("snapshots/expected_outputs/m02_costco.json")


# ============================================================================
# HAPPY PATH TESTS
# ============================================================================

class TestHappyPath:
    """Tests for normal, expected operation."""

    @pytest.mark.asyncio
    async def test_enrich_returns_valid_tech_stack(
        self, module, valid_builtwith_response, valid_expected_output
    ):
        """
        GIVEN: A valid domain with technology data
        WHEN: enrich() is called
        THEN: Returns properly structured TechStackResult
        """
        # Arrange
        module.builtwith_adapter.get_technologies.return_value = valid_builtwith_response

        # Act
        result = await module.enrich("costco.com")

        # Assert
        assert isinstance(result, TechStackResult)
        assert result.domain == "costco.com"
        assert len(result.technologies) > 0
        assert result.source_url is not None  # Source citation mandatory

        # Validate against expected output
        self._validate_against_expected(result, valid_expected_output)

    @pytest.mark.asyncio
    async def test_identifies_search_provider(self, module, valid_builtwith_response):
        """
        GIVEN: Domain using a search solution
        WHEN: enrich() is called
        THEN: Correctly identifies the search provider
        """
        # Arrange
        module.builtwith_adapter.get_technologies.return_value = valid_builtwith_response

        # Act
        result = await module.enrich("costco.com")

        # Assert
        assert result.search_provider is not None
        assert result.search_provider.provider_name in [
            "Algolia", "Elasticsearch", "Constructor", "Coveo", "Bloomreach"
        ]
        assert result.search_provider.is_competitor is True or False

    @pytest.mark.asyncio
    async def test_calculates_tech_spend_estimate(self, module):
        """
        GIVEN: Domain with known technologies
        WHEN: enrich() is called
        THEN: Provides reasonable tech spend estimate
        """
        # Act
        result = await module.enrich("enterprise-site.com")

        # Assert
        assert result.estimated_tech_spend is not None
        assert result.estimated_tech_spend >= 0
        assert result.tech_spend_confidence in ["HIGH", "MEDIUM", "LOW"]

    def _validate_against_expected(self, actual, expected):
        """Compare actual result against golden master."""
        assert actual.domain == expected["domain"]
        assert len(actual.technologies) >= expected["min_technologies"]
        # Add more field validations...


# ============================================================================
# EDGE CASE TESTS
# ============================================================================

class TestEdgeCases:
    """Tests for boundary conditions and unusual inputs."""

    @pytest.mark.asyncio
    async def test_domain_with_no_technologies_detected(self, module):
        """
        GIVEN: A domain with no detected technologies
        WHEN: enrich() is called
        THEN: Returns empty list, not error
        """
        # Arrange
        module.builtwith_adapter.get_technologies.return_value = {"Technologies": []}

        # Act
        result = await module.enrich("minimal-site.com")

        # Assert
        assert result.technologies == []
        assert result.status == "COMPLETE"  # Not FAILED

    @pytest.mark.asyncio
    async def test_handles_very_long_domain(self, module):
        """
        GIVEN: An unusually long domain name
        WHEN: enrich() is called
        THEN: Handles without truncation errors
        """
        long_domain = "this-is-a-very-long-subdomain.with-many-parts.example.co.uk"

        # Act
        result = await module.enrich(long_domain)

        # Assert
        assert result.domain == long_domain

    @pytest.mark.asyncio
    async def test_handles_unicode_domain(self, module):
        """
        GIVEN: An internationalized domain name
        WHEN: enrich() is called
        THEN: Properly encodes and processes
        """
        # Arrange - punycode for münchen.de
        unicode_domain = "xn--mnchen-3ya.de"

        # Act
        result = await module.enrich(unicode_domain)

        # Assert
        assert result.domain is not None

    @pytest.mark.asyncio
    async def test_handles_rate_limit_boundary(self, module):
        """
        GIVEN: Near rate limit threshold
        WHEN: Multiple rapid enrichments
        THEN: Respects rate limits without crashing
        """
        # This tests the rate limiter integration
        domains = [f"domain{i}.com" for i in range(100)]

        # Act - should throttle, not crash
        results = []
        for domain in domains:
            try:
                result = await module.enrich(domain)
                results.append(result)
            except RateLimitExceeded:
                break  # Expected behavior

        # Assert
        assert len(results) <= module.rate_limit


# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

class TestErrorHandling:
    """Tests for error conditions and recovery."""

    @pytest.mark.asyncio
    async def test_handles_builtwith_api_failure(self, module):
        """
        GIVEN: BuiltWith API returns 500 error
        WHEN: enrich() is called
        THEN: Raises appropriate error with context
        """
        # Arrange
        module.builtwith_adapter.get_technologies.side_effect = APIError(
            status=500, message="Internal Server Error"
        )

        # Act & Assert
        with pytest.raises(ModuleExecutionError) as exc_info:
            await module.enrich("costco.com")

        assert exc_info.value.module_id == "M02"
        assert exc_info.value.recoverable is True  # Can retry
        assert "BuiltWith" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_handles_invalid_api_response(self, module):
        """
        GIVEN: BuiltWith returns malformed JSON
        WHEN: enrich() is called
        THEN: Handles gracefully with descriptive error
        """
        # Arrange
        module.builtwith_adapter.get_technologies.return_value = {"invalid": "structure"}

        # Act & Assert
        with pytest.raises(DataValidationError) as exc_info:
            await module.enrich("costco.com")

        assert "schema" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_handles_network_timeout(self, module):
        """
        GIVEN: Network timeout occurs
        WHEN: enrich() is called
        THEN: Retries with exponential backoff
        """
        # Arrange
        call_count = 0

        async def timeout_then_succeed(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise TimeoutError("Connection timed out")
            return {"Technologies": []}

        module.builtwith_adapter.get_technologies.side_effect = timeout_then_succeed

        # Act
        result = await module.enrich("costco.com")

        # Assert
        assert call_count == 3  # Retried twice
        assert result is not None


# ============================================================================
# SOURCE CITATION TESTS (MANDATORY)
# ============================================================================

class TestSourceCitation:
    """Tests for P0 source citation mandate compliance."""

    @pytest.mark.asyncio
    async def test_every_data_point_has_source(self, module, valid_builtwith_response):
        """
        GIVEN: Valid enrichment data
        WHEN: enrich() is called
        THEN: Every data point has source_url
        """
        # Arrange
        module.builtwith_adapter.get_technologies.return_value = valid_builtwith_response

        # Act
        result = await module.enrich("costco.com")

        # Assert - recursive source check
        self._assert_all_sources_present(result.model_dump())

    def _assert_all_sources_present(self, data, path=""):
        """Recursively check all data points have sources."""
        if isinstance(data, dict):
            # If this looks like a data point, check for source
            if "value" in data and "source_url" not in data:
                pytest.fail(f"Missing source_url at {path}")

            for key, value in data.items():
                self._assert_all_sources_present(value, f"{path}.{key}")

        elif isinstance(data, list):
            for i, item in enumerate(data):
                self._assert_all_sources_present(item, f"{path}[{i}]")

    @pytest.mark.asyncio
    async def test_rejects_data_without_source(self, module):
        """
        GIVEN: Data point missing source URL
        WHEN: Validation runs
        THEN: Raises SourceCitationError
        """
        # Arrange
        bad_data = {"technology": "Algolia"}  # No source_url

        # Act & Assert
        with pytest.raises(SourceCitationError):
            module._validate_source_citation(bad_data)

    @pytest.mark.asyncio
    async def test_rejects_stale_source(self, module):
        """
        GIVEN: Source older than freshness limit (12 months)
        WHEN: Validation runs
        THEN: Raises SourceFreshnessError
        """
        # Arrange
        old_date = datetime.utcnow() - timedelta(days=400)
        stale_data = {
            "technology": "Algolia",
            "source_url": "https://builtwith.com/...",
            "source_date": old_date.isoformat(),
        }

        # Act & Assert
        with pytest.raises(SourceFreshnessError):
            module._validate_source_freshness(stale_data)


# ============================================================================
# SELF-CORRECTION TESTS
# ============================================================================

class TestSelfCorrection:
    """Tests for automatic failure recovery and correction."""

    @pytest.mark.asyncio
    async def test_auto_retry_on_transient_failure(self, module):
        """
        GIVEN: Transient API failure (503)
        WHEN: enrich() is called
        THEN: Automatically retries and succeeds
        """
        # Arrange
        attempts = []

        async def fail_then_succeed(*args):
            attempts.append(1)
            if len(attempts) < 2:
                raise TransientError("Service temporarily unavailable")
            return {"Technologies": [{"Name": "Algolia"}]}

        module.builtwith_adapter.get_technologies.side_effect = fail_then_succeed

        # Act
        result = await module.enrich("costco.com")

        # Assert
        assert len(attempts) == 2
        assert result is not None

    @pytest.mark.asyncio
    async def test_fallback_to_cache_on_api_failure(self, module):
        """
        GIVEN: API failure with cached data available
        WHEN: enrich() is called with allow_stale=True
        THEN: Returns cached data with stale flag
        """
        # Arrange
        cached_data = {"technologies": [{"name": "Algolia"}], "cached_at": "..."}
        module.cache.get.return_value = cached_data
        module.builtwith_adapter.get_technologies.side_effect = APIError("Down")

        # Act
        result = await module.enrich("costco.com", allow_stale=True)

        # Assert
        assert result is not None
        assert result.is_stale is True
        assert result.stale_reason == "API_FAILURE"

    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_on_repeated_failures(self, module):
        """
        GIVEN: Multiple consecutive API failures
        WHEN: Threshold exceeded
        THEN: Circuit breaker opens, fails fast
        """
        # Arrange
        module.builtwith_adapter.get_technologies.side_effect = APIError("Down")

        # Act - trigger multiple failures
        failures = 0
        for _ in range(10):
            try:
                await module.enrich(f"domain{_}.com")
            except (APIError, CircuitBreakerOpen):
                failures += 1

        # Assert - should fail fast after threshold
        assert failures == 10
        assert module.circuit_breaker.state == "OPEN"

    @pytest.mark.asyncio
    async def test_records_failure_for_analysis(self, module):
        """
        GIVEN: Module execution fails
        WHEN: Error occurs
        THEN: Failure is recorded for later analysis
        """
        # Arrange
        module.builtwith_adapter.get_technologies.side_effect = APIError("Auth failed")

        # Act
        try:
            await module.enrich("costco.com")
        except ModuleExecutionError:
            pass

        # Assert
        assert module.failure_log.count() == 1
        failure = module.failure_log.latest()
        assert failure.module_id == "M02"
        assert failure.error_type == "APIError"
        assert failure.domain == "costco.com"


# ============================================================================
# VALIDATION HELPER
# ============================================================================

class ValidationHelper:
    """
    Helper to validate actual vs expected results.
    Used for both tests and self-correction.
    """

    @staticmethod
    def validate_module_output(
        actual: dict,
        expected: dict,
        strict: bool = False,
    ) -> tuple[bool, list[str]]:
        """
        Compare actual output against expected.

        Returns:
            (passed, list_of_differences)
        """
        differences = []

        # Required fields
        for field in expected.get("required_fields", []):
            if field not in actual:
                differences.append(f"Missing required field: {field}")

        # Value comparisons
        for field, expected_value in expected.get("expected_values", {}).items():
            actual_value = actual.get(field)
            if actual_value != expected_value:
                differences.append(
                    f"Field '{field}': expected {expected_value}, got {actual_value}"
                )

        # Type checks
        for field, expected_type in expected.get("expected_types", {}).items():
            actual_value = actual.get(field)
            if actual_value is not None and not isinstance(actual_value, expected_type):
                differences.append(
                    f"Field '{field}': expected type {expected_type}, got {type(actual_value)}"
                )

        # Range checks
        for field, (min_val, max_val) in expected.get("expected_ranges", {}).items():
            actual_value = actual.get(field)
            if actual_value is not None:
                if actual_value < min_val or actual_value > max_val:
                    differences.append(
                        f"Field '{field}': {actual_value} not in range [{min_val}, {max_val}]"
                    )

        passed = len(differences) == 0
        return passed, differences
```

---

## 5. Self-Correction Mechanisms

### 5.1 Automatic Correction Levels

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SELF-CORRECTION HIERARCHY                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Level 1: AUTOMATIC (no human intervention)                              │
│  ├── Retry on transient errors (503, timeout)                           │
│  ├── Use cached data on API failure                                     │
│  ├── Skip non-critical fields if unavailable                            │
│  └── Apply default values for optional fields                           │
│                                                                          │
│  Level 2: SEMI-AUTOMATIC (logged for review)                            │
│  ├── Data transformation fallbacks                                      │
│  ├── Alternative data source selection                                  │
│  └── Schema migration for version mismatches                            │
│                                                                          │
│  Level 3: MANUAL (requires human intervention)                          │
│  ├── Source citation cannot be determined                               │
│  ├── Data conflict between sources                                      │
│  └── Critical validation failure                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Self-Correction Service

```python
# backend/app/services/self_correction.py

from dataclasses import dataclass
from enum import Enum
from typing import Callable, Any
import logging

logger = logging.getLogger(__name__)


class CorrectionLevel(Enum):
    AUTOMATIC = "automatic"
    SEMI_AUTOMATIC = "semi_automatic"
    MANUAL = "manual"


@dataclass
class CorrectionAction:
    """A correction action that can be applied."""
    name: str
    level: CorrectionLevel
    condition: Callable[[Exception, dict], bool]
    action: Callable[[Exception, dict], Any]
    description: str


class SelfCorrectionService:
    """
    Automatically corrects failures where possible.
    Logs all corrections for analysis.
    """

    def __init__(self, db, notification_service):
        self.db = db
        self.notifications = notification_service
        self.corrections: list[CorrectionAction] = []
        self._register_default_corrections()

    def _register_default_corrections(self):
        """Register default correction actions."""

        # Level 1: Automatic corrections
        self.corrections.append(CorrectionAction(
            name="retry_transient_error",
            level=CorrectionLevel.AUTOMATIC,
            condition=lambda e, ctx: isinstance(e, (TransientError, TimeoutError)),
            action=self._retry_with_backoff,
            description="Retry operation with exponential backoff",
        ))

        self.corrections.append(CorrectionAction(
            name="use_cached_data",
            level=CorrectionLevel.AUTOMATIC,
            condition=lambda e, ctx: (
                isinstance(e, APIError) and ctx.get("cache_available", False)
            ),
            action=self._use_cached_data,
            description="Fall back to cached data when API fails",
        ))

        self.corrections.append(CorrectionAction(
            name="skip_optional_field",
            level=CorrectionLevel.AUTOMATIC,
            condition=lambda e, ctx: (
                isinstance(e, DataValidationError) and
                ctx.get("field_required", False) is False
            ),
            action=self._skip_optional_field,
            description="Skip optional field that failed validation",
        ))

        # Level 2: Semi-automatic corrections
        self.corrections.append(CorrectionAction(
            name="alternative_data_source",
            level=CorrectionLevel.SEMI_AUTOMATIC,
            condition=lambda e, ctx: ctx.get("has_alternative_source", False),
            action=self._try_alternative_source,
            description="Try alternative data source",
        ))

        self.corrections.append(CorrectionAction(
            name="schema_migration",
            level=CorrectionLevel.SEMI_AUTOMATIC,
            condition=lambda e, ctx: isinstance(e, SchemaVersionError),
            action=self._migrate_schema,
            description="Migrate data to current schema version",
        ))

    async def attempt_correction(
        self,
        error: Exception,
        context: dict,
        max_level: CorrectionLevel = CorrectionLevel.SEMI_AUTOMATIC,
    ) -> tuple[bool, Any]:
        """
        Attempt to correct an error.

        Returns:
            (corrected: bool, result: Any)
        """
        for correction in self.corrections:
            # Check if correction level is allowed
            if self._level_exceeds(correction.level, max_level):
                continue

            # Check if condition matches
            if not correction.condition(error, context):
                continue

            # Attempt correction
            try:
                logger.info(f"Attempting correction: {correction.name}")

                result = await correction.action(error, context)

                # Log successful correction
                await self._log_correction(
                    correction_name=correction.name,
                    error_type=type(error).__name__,
                    context=context,
                    success=True,
                )

                return True, result

            except Exception as correction_error:
                logger.warning(
                    f"Correction '{correction.name}' failed: {correction_error}"
                )
                continue

        # No correction worked
        return False, None

    async def _retry_with_backoff(self, error, context) -> Any:
        """Retry operation with exponential backoff."""
        operation = context["operation"]
        max_retries = context.get("max_retries", 3)
        base_delay = context.get("base_delay", 1.0)

        for attempt in range(max_retries):
            delay = base_delay * (2 ** attempt)
            await asyncio.sleep(delay)

            try:
                return await operation()
            except type(error):
                if attempt == max_retries - 1:
                    raise

        raise error

    async def _use_cached_data(self, error, context) -> Any:
        """Use cached data when API fails."""
        cache_key = context["cache_key"]
        cached_data = await self.cache.get(cache_key)

        if cached_data:
            # Mark as stale
            cached_data["_is_stale"] = True
            cached_data["_stale_reason"] = f"API failure: {error}"
            return cached_data

        raise error

    async def _skip_optional_field(self, error, context) -> Any:
        """Skip an optional field that failed validation."""
        field_name = context["field_name"]
        data = context["data"]

        # Remove the problematic field
        data.pop(field_name, None)

        # Log the skip
        logger.info(f"Skipped optional field '{field_name}' due to: {error}")

        return data

    async def _try_alternative_source(self, error, context) -> Any:
        """Try an alternative data source."""
        alternative_sources = context.get("alternative_sources", [])

        for source in alternative_sources:
            try:
                return await source.fetch(context["domain"])
            except Exception:
                continue

        raise error

    async def _log_correction(
        self,
        correction_name: str,
        error_type: str,
        context: dict,
        success: bool,
    ):
        """Log correction attempt for analysis."""
        await self.db.execute(
            insert(CorrectionLog).values(
                correction_name=correction_name,
                error_type=error_type,
                context=json.dumps(context, default=str),
                success=success,
                timestamp=datetime.utcnow(),
            )
        )

    @staticmethod
    def _level_exceeds(level: CorrectionLevel, max_level: CorrectionLevel) -> bool:
        """Check if level exceeds maximum allowed."""
        order = {
            CorrectionLevel.AUTOMATIC: 0,
            CorrectionLevel.SEMI_AUTOMATIC: 1,
            CorrectionLevel.MANUAL: 2,
        }
        return order[level] > order[max_level]
```

---

## 6. Iterative Improvement Framework

### 6.1 Improvement Cycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ITERATIVE IMPROVEMENT CYCLE                           │
└─────────────────────────────────────────────────────────────────────────┘

    ┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
    │   TEST    │─────▶│  ANALYZE  │─────▶│   FIX     │─────▶│  VERIFY   │
    │           │      │           │      │           │      │           │
    │ Run tests │      │ Identify  │      │ Implement │      │ Re-run    │
    │ Collect   │      │ patterns  │      │ fix       │      │ tests     │
    │ failures  │      │ Root cause│      │ Add test  │      │ Confirm   │
    └───────────┘      └───────────┘      └───────────┘      └───────────┘
          │                                                        │
          │                                                        │
          └────────────────────────────────────────────────────────┘
                              REPEAT
```

### 6.2 Failure Analysis Service

```python
# backend/app/services/failure_analysis.py

class FailureAnalysisService:
    """
    Analyzes test failures and suggests improvements.
    """

    def __init__(self, db):
        self.db = db

    async def analyze_failures(
        self,
        time_range: timedelta = timedelta(days=7),
    ) -> FailureAnalysisReport:
        """
        Analyze recent failures and identify patterns.
        """
        failures = await self._get_recent_failures(time_range)

        return FailureAnalysisReport(
            total_failures=len(failures),
            by_module=self._group_by_module(failures),
            by_error_type=self._group_by_error_type(failures),
            patterns=self._identify_patterns(failures),
            recommendations=self._generate_recommendations(failures),
        )

    def _identify_patterns(self, failures: list[Failure]) -> list[FailurePattern]:
        """Identify recurring failure patterns."""
        patterns = []

        # Pattern: Same error across multiple domains
        by_error = defaultdict(list)
        for f in failures:
            by_error[f.error_type].append(f)

        for error_type, error_failures in by_error.items():
            if len(error_failures) >= 3:
                patterns.append(FailurePattern(
                    name="recurring_error",
                    error_type=error_type,
                    count=len(error_failures),
                    affected_domains=[f.domain for f in error_failures],
                    severity="HIGH" if len(error_failures) >= 5 else "MEDIUM",
                ))

        # Pattern: Same domain failing repeatedly
        by_domain = defaultdict(list)
        for f in failures:
            by_domain[f.domain].append(f)

        for domain, domain_failures in by_domain.items():
            if len(domain_failures) >= 3:
                patterns.append(FailurePattern(
                    name="problematic_domain",
                    domain=domain,
                    count=len(domain_failures),
                    error_types=list(set(f.error_type for f in domain_failures)),
                    severity="MEDIUM",
                ))

        # Pattern: Failures at specific times (rate limiting?)
        hourly_counts = self._count_by_hour(failures)
        spike_hours = [h for h, c in hourly_counts.items() if c > len(failures) / 12]
        if spike_hours:
            patterns.append(FailurePattern(
                name="temporal_spike",
                hours=spike_hours,
                severity="LOW",
            ))

        return patterns

    def _generate_recommendations(
        self,
        failures: list[Failure],
    ) -> list[Recommendation]:
        """Generate actionable recommendations."""
        recommendations = []

        patterns = self._identify_patterns(failures)

        for pattern in patterns:
            if pattern.name == "recurring_error":
                if "timeout" in pattern.error_type.lower():
                    recommendations.append(Recommendation(
                        priority="HIGH",
                        action="Increase timeout or add retry logic",
                        affected_module=pattern.error_type,
                        estimated_effort="LOW",
                    ))
                elif "rate" in pattern.error_type.lower():
                    recommendations.append(Recommendation(
                        priority="HIGH",
                        action="Reduce request rate or add caching",
                        affected_module=pattern.error_type,
                        estimated_effort="MEDIUM",
                    ))

            elif pattern.name == "problematic_domain":
                recommendations.append(Recommendation(
                    priority="MEDIUM",
                    action=f"Investigate domain-specific issue: {pattern.domain}",
                    affected_module="multiple",
                    estimated_effort="MEDIUM",
                ))

        return recommendations


# Schedule regular analysis
@celery_app.task
async def run_failure_analysis():
    """Run failure analysis daily."""
    service = FailureAnalysisService(get_db())
    report = await service.analyze_failures()

    # Save report
    await save_analysis_report(report)

    # Notify if critical patterns found
    if any(p.severity == "HIGH" for p in report.patterns):
        await send_alert("Critical failure patterns detected", report)
```

### 6.3 Test Coverage Tracking

```python
# backend/app/services/coverage_tracking.py

class CoverageTrackingService:
    """
    Track test coverage and identify gaps.
    """

    REQUIRED_COVERAGE = {
        "unit": 80,       # 80% line coverage
        "integration": 60,
        "e2e": 40,
    }

    async def check_coverage(self) -> CoverageReport:
        """Check if coverage requirements are met."""
        coverage = await self._run_coverage_report()

        gaps = []
        for test_type, required in self.REQUIRED_COVERAGE.items():
            actual = coverage.get(test_type, 0)
            if actual < required:
                gaps.append(CoverageGap(
                    test_type=test_type,
                    required=required,
                    actual=actual,
                    deficit=required - actual,
                ))

        return CoverageReport(
            meets_requirements=len(gaps) == 0,
            coverage=coverage,
            gaps=gaps,
            untested_modules=self._find_untested_modules(),
        )

    def _find_untested_modules(self) -> list[str]:
        """Find modules without any test files."""
        module_files = glob.glob("app/modules/*.py")
        test_files = glob.glob("tests/unit/modules/*.py")

        module_names = {Path(f).stem for f in module_files if not f.startswith("_")}
        tested_names = {
            Path(f).stem.replace("test_", "") for f in test_files
        }

        return list(module_names - tested_names)
```

---

## 7. CI/CD Integration

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  PYTHON_VERSION: "3.11"
  NODE_VERSION: "20"

jobs:
  # ============================================================
  # UNIT TESTS - Fast, run first
  # ============================================================
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio

      - name: Run unit tests
        run: |
          cd backend
          pytest tests/unit \
            --cov=app \
            --cov-report=xml \
            --cov-report=term-missing \
            --cov-fail-under=80 \
            -v \
            --tb=short

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: backend/coverage.xml

  # ============================================================
  # INTEGRATION TESTS - Medium speed
  # ============================================================
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests  # Only run if unit tests pass

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: partnerforge_test
          POSTGRES_USER: test
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

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio

      - name: Run migrations
        run: |
          cd backend
          alembic upgrade head
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/partnerforge_test

      - name: Run integration tests
        run: |
          cd backend
          pytest tests/integration \
            -v \
            --tb=short \
            --timeout=60
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/partnerforge_test
          REDIS_URL: redis://localhost:6379

  # ============================================================
  # E2E TESTS - Slow, run last
  # ============================================================
  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install backend
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Install frontend
        run: |
          cd frontend
          npm ci

      - name: Install Playwright
        run: |
          cd frontend
          npx playwright install --with-deps

      - name: Start services
        run: |
          cd backend
          uvicorn app.main:app --host 0.0.0.0 --port 8000 &
          cd ../frontend
          npm run dev &
          sleep 10  # Wait for services

      - name: Run E2E tests
        run: |
          cd frontend
          npx playwright test
        env:
          API_URL: http://localhost:8000

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/

  # ============================================================
  # QUALITY GATES
  # ============================================================
  quality-gate:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, e2e-tests]

    steps:
      - uses: actions/checkout@v4

      - name: Check coverage thresholds
        run: |
          # Verify coverage meets requirements
          python scripts/check_coverage.py

      - name: Run failure analysis
        run: |
          # Analyze any failures and generate report
          python scripts/analyze_failures.py

      - name: Post summary
        run: |
          echo "## Test Summary" >> $GITHUB_STEP_SUMMARY
          cat test-summary.md >> $GITHUB_STEP_SUMMARY
```

### 7.2 Pre-commit Hooks

```yaml
# .pre-commit-config.yaml

repos:
  - repo: local
    hooks:
      - id: run-unit-tests
        name: Run Unit Tests
        entry: pytest tests/unit -x -q --tb=line
        language: system
        pass_filenames: false
        stages: [push]

      - id: check-test-exists
        name: Check Test Exists
        entry: python scripts/check_test_exists.py
        language: system
        files: ^backend/app/(modules|services)/.*\.py$
        stages: [push]

      - id: lint
        name: Lint
        entry: ruff check
        language: system
        types: [python]
```

---

## 8. Test Data Management

### 8.1 Fixture Organization

```python
# tests/fixtures/__init__.py

import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent


def load_fixture(path: str) -> dict:
    """Load a JSON fixture file."""
    full_path = FIXTURES_DIR / path
    with open(full_path) as f:
        return json.load(f)


def load_company_fixture(domain: str) -> dict:
    """Load company fixture by domain."""
    return load_fixture(f"companies/{domain.replace('.', '_')}.json")


def load_api_response(provider: str, endpoint: str) -> dict:
    """Load mocked API response."""
    return load_fixture(f"api_responses/{provider}/{endpoint}.json")


def load_expected_output(module_id: str, domain: str) -> dict:
    """Load expected output for validation."""
    return load_fixture(f"expected_outputs/{module_id}_{domain.replace('.', '_')}.json")
```

### 8.2 Golden Master Tests

```python
# tests/regression/golden_master/test_output_format.py

"""
Golden Master Tests

These tests ensure output format doesn't regress.
Expected outputs are stored in fixtures/expected_outputs/
"""

import pytest
from deepdiff import DeepDiff
from tests.fixtures import load_expected_output


class TestGoldenMaster:
    """Test against known-good outputs."""

    @pytest.mark.parametrize("module_id,domain", [
        ("M01", "costco.com"),
        ("M02", "costco.com"),
        ("M03", "costco.com"),
        # Add more golden master cases
    ])
    @pytest.mark.asyncio
    async def test_output_matches_golden_master(self, module_id, domain):
        """
        GIVEN: A module and domain with known-good output
        WHEN: Module is executed
        THEN: Output structure matches golden master
        """
        # Arrange
        expected = load_expected_output(module_id, domain)
        module = get_module(module_id)

        # Act
        actual = await module.enrich(domain)

        # Assert structure (not values, which may change)
        diff = DeepDiff(
            expected,
            actual.model_dump(),
            ignore_order=True,
            exclude_paths=[
                "root['timestamp']",
                "root['source_url']",  # URLs may change
            ],
        )

        # Allow only expected differences
        allowed_diff_types = {"values_changed"}
        unexpected_diffs = {
            k: v for k, v in diff.items()
            if k not in allowed_diff_types
        }

        assert not unexpected_diffs, f"Unexpected structural changes: {unexpected_diffs}"
```

---

## 9. Metrics & Quality Gates

### 9.1 Quality Metrics

```python
# backend/app/services/quality_metrics.py

class QualityMetrics:
    """Track and report quality metrics."""

    @dataclass
    class Metrics:
        test_pass_rate: float           # % of tests passing
        unit_coverage: float            # % code covered
        integration_coverage: float
        avg_test_duration: float        # seconds
        flaky_test_count: int           # tests that intermittently fail
        regression_count: int           # regressions in last 30 days
        self_corrections_count: int     # automatic corrections applied
        manual_interventions: int       # manual fixes required

    @staticmethod
    def quality_gate_passed(metrics: Metrics) -> tuple[bool, list[str]]:
        """Check if quality gates are passed."""
        failures = []

        if metrics.test_pass_rate < 99.0:
            failures.append(f"Test pass rate {metrics.test_pass_rate}% < 99%")

        if metrics.unit_coverage < 80.0:
            failures.append(f"Unit coverage {metrics.unit_coverage}% < 80%")

        if metrics.flaky_test_count > 0:
            failures.append(f"{metrics.flaky_test_count} flaky tests detected")

        if metrics.regression_count > 0:
            failures.append(f"{metrics.regression_count} regressions detected")

        return len(failures) == 0, failures
```

### 9.2 Quality Dashboard

```typescript
// frontend/src/components/quality/QualityDashboard.tsx

export const QualityDashboard: FC = () => {
  const { data: metrics } = useQuery({
    queryKey: ['quality-metrics'],
    queryFn: () => api.getQualityMetrics(),
  });

  return (
    <div className="quality-dashboard">
      <h2>Quality Metrics</h2>

      <div className="metrics-grid">
        <MetricCard
          title="Test Pass Rate"
          value={`${metrics?.testPassRate}%`}
          target="99%"
          status={metrics?.testPassRate >= 99 ? 'good' : 'bad'}
        />

        <MetricCard
          title="Unit Coverage"
          value={`${metrics?.unitCoverage}%`}
          target="80%"
          status={metrics?.unitCoverage >= 80 ? 'good' : 'bad'}
        />

        <MetricCard
          title="Self-Corrections"
          value={metrics?.selfCorrections}
          subtitle="Automatic fixes applied"
        />

        <MetricCard
          title="Manual Interventions"
          value={metrics?.manualInterventions}
          subtitle="Required human fixes"
          status={metrics?.manualInterventions === 0 ? 'good' : 'warning'}
        />
      </div>

      <RecentFailures failures={metrics?.recentFailures} />
      <ImprovementRecommendations recommendations={metrics?.recommendations} />
    </div>
  );
};
```

---

## 10. Module Development Checklist

**MANDATORY for every module:**

```markdown
## Module Development Checklist: M[XX] - [Module Name]

### Before Starting
- [ ] Read existing test template
- [ ] Create test file: `tests/unit/modules/test_m[xx]_[name].py`
- [ ] Create fixtures in `tests/fixtures/`
- [ ] Define expected outputs

### Implementation
- [ ] Implement module class
- [ ] Add source citation validation
- [ ] Add error handling
- [ ] Add self-correction hooks
- [ ] Add logging

### Testing (PARALLEL with implementation)
- [ ] Happy path tests (≥3)
- [ ] Edge case tests (≥5)
- [ ] Error handling tests (≥3)
- [ ] Source citation tests (≥2)
- [ ] Self-correction tests (≥2)

### Validation
- [ ] All tests pass
- [ ] Coverage ≥80%
- [ ] No lint errors
- [ ] Expected vs actual outputs match
- [ ] Self-correction mechanisms work

### Documentation
- [ ] Module docstring complete
- [ ] Test docstrings complete
- [ ] README updated if needed
```

---

*Document created: 2026-02-25*
*Author: Thread 3 - Implementation Scaffold*
*Status: Foundational Methodology*
*Priority: P0 - Every module must follow this*
