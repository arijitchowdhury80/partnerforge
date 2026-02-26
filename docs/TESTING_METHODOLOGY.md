# PartnerForge Testing Methodology

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Active

This document defines our testing strategy, validation framework, and self-correction mechanisms.

---

## 1. Core Principles

### 1.1 Test-Alongside Development

**Rule:** Every implementation MUST have corresponding tests written in the same session.

```
Implementation Flow:
┌─────────────────────┐
│  1. Write Tests     │ ← Define expected behavior FIRST
│     (Red)           │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  2. Implement       │ ← Write minimum code to pass
│     (Green)         │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  3. Validate        │ ← Run tests, check expected vs actual
│     (Verify)        │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  4. Self-Correct    │ ← Fix failures, iterate
│     (Fix)           │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  5. Refactor        │ ← Clean up while tests pass
│     (Clean)         │
└─────────────────────┘
```

### 1.2 Test Types

| Type | Scope | Speed | When to Run |
|------|-------|-------|-------------|
| **Unit** | Single function/class | Fast (<1s) | Every change |
| **Integration** | Multiple components | Medium (1-10s) | Before commit |
| **System** | Full workflow | Slow (10-60s) | Before merge |
| **Regression** | All tests | Variable | CI/CD pipeline |

### 1.3 Coverage Requirements

| Component | Minimum Coverage | Target |
|-----------|-----------------|--------|
| Models | 90% | 95% |
| Services | 85% | 90% |
| API Endpoints | 80% | 90% |
| Utilities | 95% | 100% |

---

## 2. Test Structure

### 2.1 Directory Layout

```
backend/
├── app/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/
    ├── conftest.py          # Shared fixtures
    ├── unit/
    │   ├── models/
    │   │   ├── test_core.py
    │   │   ├── test_intelligence.py
    │   │   ├── test_versioning.py
    │   │   ├── test_alerts.py
    │   │   └── test_platform.py
    │   ├── services/
    │   │   ├── test_versioning_service.py
    │   │   ├── test_change_detector.py
    │   │   └── test_alert_service.py
    │   └── utils/
    │       └── test_validation.py
    ├── integration/
    │   ├── test_enrichment_flow.py
    │   ├── test_alert_pipeline.py
    │   └── test_api_endpoints.py
    ├── system/
    │   ├── test_full_enrichment.py
    │   └── test_change_notification.py
    └── fixtures/
        ├── mock_responses/
        │   ├── builtwith/
        │   ├── similarweb/
        │   └── yahoo_finance/
        └── sample_data/
            ├── companies.json
            └── intelligence.json
```

### 2.2 Naming Conventions

```python
# Test file: test_{module_name}.py
# Test class: Test{ClassName}
# Test method: test_{method_name}_{scenario}_{expected_outcome}

# Examples:
test_intel_snapshot_creation_success
test_alert_rule_matching_with_scope_filter
test_change_detector_executive_change_high_significance
test_api_budget_exceeded_blocks_request
```

---

## 3. Validation Framework

### 3.1 Expected vs Actual Pattern

Every test MUST clearly define:
1. **Setup**: Initial state
2. **Action**: What we're testing
3. **Expected**: What should happen
4. **Actual**: What did happen
5. **Assertion**: Compare with clear message

```python
# Template for all tests
class TestFeature:
    """
    Tests for {Feature Name}.

    Validation Criteria:
    - {Criterion 1}
    - {Criterion 2}
    """

    def test_scenario_expected_outcome(self, fixture):
        """
        Test: {What we're testing}

        Setup:
            - {Initial state description}

        Expected:
            - {Expected outcome 1}
            - {Expected outcome 2}

        Validation:
            - Compare {X} equals {Y}
            - Verify {Z} is present
        """
        # SETUP
        initial_state = {...}

        # ACTION
        result = function_under_test(initial_state)

        # EXPECTED
        expected = {
            "field1": "value1",
            "field2": 42,
        }

        # ACTUAL
        actual = {
            "field1": result.field1,
            "field2": result.field2,
        }

        # ASSERTION with clear message
        assert actual == expected, f"""
        VALIDATION FAILED:

        Expected: {expected}
        Actual:   {actual}

        Difference: {set(expected.items()) ^ set(actual.items())}
        """
```

### 3.2 Validation Categories

```python
class ValidationResult:
    """Standard validation result structure."""

    status: Literal["PASS", "FAIL", "SKIP", "ERROR"]
    test_name: str
    expected: Any
    actual: Any
    difference: Optional[str]
    error_message: Optional[str]
    fix_suggestion: Optional[str]  # Self-correction hint
    execution_time_ms: float
```

---

## 4. Self-Correction Framework

### 4.1 Failure Categories

| Category | Auto-Fix? | Action |
|----------|-----------|--------|
| **Schema Mismatch** | Yes | Regenerate model |
| **Missing Field** | Yes | Add field with default |
| **Type Error** | Yes | Cast or convert |
| **Validation Error** | Partial | Suggest fix, ask user |
| **Logic Error** | No | Report, manual fix |
| **External API Error** | Retry | Exponential backoff |

### 4.2 Self-Correction Pattern

```python
# backend/app/utils/self_correction.py

from dataclasses import dataclass
from typing import Callable, Any, Optional
from enum import Enum


class FixAction(Enum):
    AUTO_FIX = "auto_fix"
    SUGGEST = "suggest"
    MANUAL = "manual"
    RETRY = "retry"
    SKIP = "skip"


@dataclass
class FailureAnalysis:
    """Analysis of a test failure with correction suggestions."""

    test_name: str
    error_type: str
    error_message: str

    # Root cause analysis
    likely_cause: str
    affected_files: list[str]

    # Correction
    fix_action: FixAction
    fix_description: str
    fix_code: Optional[str]  # Auto-generated fix code

    # Confidence
    confidence: float  # 0.0 to 1.0


class SelfCorrector:
    """
    Analyzes test failures and suggests/applies corrections.
    """

    def analyze_failure(self, test_result: ValidationResult) -> FailureAnalysis:
        """Analyze a test failure and determine fix."""

        error_patterns = {
            "AttributeError": self._handle_attribute_error,
            "TypeError": self._handle_type_error,
            "ValidationError": self._handle_validation_error,
            "AssertionError": self._handle_assertion_error,
            "IntegrityError": self._handle_integrity_error,
        }

        error_type = type(test_result.error).__name__
        handler = error_patterns.get(error_type, self._handle_unknown_error)

        return handler(test_result)

    def _handle_attribute_error(self, result: ValidationResult) -> FailureAnalysis:
        """
        AttributeError usually means missing field on model.

        Auto-fix: Add field to model with appropriate type.
        """
        # Extract field name from error message
        # e.g., "'IntelSnapshot' object has no attribute 'new_field'"

        return FailureAnalysis(
            test_name=result.test_name,
            error_type="AttributeError",
            error_message=str(result.error),
            likely_cause="Model is missing a required field",
            affected_files=["backend/app/models/*.py"],
            fix_action=FixAction.SUGGEST,
            fix_description="Add missing field to model",
            fix_code=f"""
# Add to model class:
new_field = Column(String(255))  # Adjust type as needed
            """,
            confidence=0.8,
        )

    def _handle_assertion_error(self, result: ValidationResult) -> FailureAnalysis:
        """
        AssertionError means expected != actual.

        Analyze the difference to suggest fix.
        """
        return FailureAnalysis(
            test_name=result.test_name,
            error_type="AssertionError",
            error_message=result.error_message,
            likely_cause="Implementation doesn't match specification",
            affected_files=self._infer_affected_files(result),
            fix_action=FixAction.MANUAL,
            fix_description=f"""
Expected: {result.expected}
Actual:   {result.actual}

Review the implementation logic in the affected files.
            """,
            fix_code=None,
            confidence=0.5,
        )

    def apply_fix(self, analysis: FailureAnalysis) -> bool:
        """
        Apply an automatic fix if confidence is high enough.

        Returns True if fix was applied.
        """
        if analysis.fix_action != FixAction.AUTO_FIX:
            return False

        if analysis.confidence < 0.9:
            return False  # Too risky

        # Apply the fix
        # ... implementation ...

        return True
```

### 4.3 Iterative Improvement Loop

```python
# backend/tests/run_with_correction.py

async def run_tests_with_correction(max_iterations: int = 3):
    """
    Run tests with automatic correction attempts.

    Flow:
    1. Run all tests
    2. For failures, analyze and attempt fix
    3. Re-run failed tests
    4. Repeat until all pass or max iterations
    """

    corrector = SelfCorrector()
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        print(f"\n=== Test Run {iteration}/{max_iterations} ===\n")

        # Run tests
        results = await run_all_tests()

        failures = [r for r in results if r.status == "FAIL"]

        if not failures:
            print("✅ All tests passed!")
            return True

        print(f"❌ {len(failures)} failures. Analyzing...")

        # Analyze and attempt fixes
        for failure in failures:
            analysis = corrector.analyze_failure(failure)

            print(f"\n--- {failure.test_name} ---")
            print(f"Cause: {analysis.likely_cause}")
            print(f"Fix Action: {analysis.fix_action.value}")
            print(f"Confidence: {analysis.confidence:.0%}")

            if analysis.fix_action == FixAction.AUTO_FIX:
                if corrector.apply_fix(analysis):
                    print("🔧 Auto-fix applied")
                else:
                    print("⚠️ Auto-fix failed")
            elif analysis.fix_action == FixAction.SUGGEST:
                print(f"💡 Suggestion:\n{analysis.fix_description}")
                if analysis.fix_code:
                    print(f"```python\n{analysis.fix_code}\n```")

    print(f"\n⚠️ Max iterations reached. {len(failures)} failures remain.")
    return False
```

---

## 5. Test Fixtures

### 5.1 Shared Fixtures (conftest.py)

```python
# backend/tests/conftest.py

import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import *


# =============================================================================
# Database Fixtures
# =============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
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


# =============================================================================
# Sample Data Fixtures
# =============================================================================

@pytest.fixture
def sample_company():
    """Sample company data."""
    return {
        "domain": "costco.com",
        "company_name": "Costco Wholesale",
        "vertical": "Retail",
        "country": "US",
        "icp_score": 85,
    }


@pytest.fixture
def sample_intel_snapshot():
    """Sample intelligence snapshot."""
    return {
        "module_type": "m09_executive",
        "domain": "costco.com",
        "version": 1,
        "data": {
            "executives": [
                {"name": "John Smith", "title": "CFO"},
                {"name": "Bob Johnson", "title": "CEO"},
            ],
            "key_themes": ["cost_efficiency", "member_experience"],
        },
        "source_url": "https://example.com/source",
        "source_date": "2026-02-01T00:00:00Z",
    }


@pytest.fixture
def sample_snapshot_v2():
    """Second version of snapshot with changes."""
    return {
        "module_type": "m09_executive",
        "domain": "costco.com",
        "version": 2,
        "data": {
            "executives": [
                {"name": "Jane Doe", "title": "CFO"},  # CHANGED
                {"name": "Bob Johnson", "title": "CEO"},
            ],
            "key_themes": ["digital_transformation", "member_experience"],  # CHANGED
        },
        "source_url": "https://example.com/source2",
        "source_date": "2026-05-01T00:00:00Z",
    }


@pytest.fixture
def expected_diff():
    """Expected diff between v1 and v2 snapshots."""
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
        },
        "added": {},
        "removed": {},
        "unchanged": [],
    }


# =============================================================================
# Mock API Response Fixtures
# =============================================================================

@pytest.fixture
def mock_builtwith_response():
    """Mock BuiltWith API response."""
    return {
        "Results": [{
            "Technologies": [
                {"Name": "Elasticsearch", "Category": "Search"},
                {"Name": "Adobe Experience Manager", "Category": "CMS"},
            ],
            "Meta": {
                "CompanyName": "Costco Wholesale",
                "Vertical": "Retail",
            },
            "Spend": {"Estimated": 150000},
        }],
    }


@pytest.fixture
def mock_similarweb_response():
    """Mock SimilarWeb API response."""
    return {
        "visits": 50000000,
        "bounce_rate": 0.35,
        "pages_per_visit": 4.2,
        "avg_visit_duration": 180,
        "traffic_sources": {
            "direct": 0.40,
            "search": 0.35,
            "social": 0.10,
            "referral": 0.15,
        },
    }


# =============================================================================
# Alert Fixtures
# =============================================================================

@pytest.fixture
def sample_alert_rule():
    """Sample alert rule configuration."""
    return {
        "name": "Hot Lead Changes",
        "conditions": {
            "scope": "my_territory",
            "change_categories": ["EXECUTIVE_CHANGE", "TECH_STACK_CHANGE"],
            "min_significance": "HIGH",
        },
        "channels": ["in_app", "email"],
        "frequency": "immediate",
    }
```

---

## 6. Example Test Files

### 6.1 Model Tests

```python
# backend/tests/unit/models/test_versioning.py

import pytest
from datetime import datetime
from app.models.versioning import IntelSnapshot, ChangeEvent


class TestIntelSnapshot:
    """
    Tests for IntelSnapshot model.

    Validation Criteria:
    - Snapshot stores full data as JSON
    - Version increments correctly
    - Diff is computed from previous version
    - Significance is determined from changes
    """

    def test_snapshot_creation_with_valid_data(self, db_session, sample_intel_snapshot):
        """
        Test: Creating a snapshot with valid data succeeds.

        Setup:
            - Valid snapshot data with all required fields

        Expected:
            - Snapshot is created with correct values
            - ID is generated
            - created_at is set
        """
        # SETUP
        data = sample_intel_snapshot

        # ACTION
        snapshot = IntelSnapshot(
            module_type=data["module_type"],
            domain=data["domain"],
            version=data["version"],
            data=data["data"],
            source_url=data["source_url"],
        )
        db_session.add(snapshot)
        await db_session.flush()

        # EXPECTED
        expected = {
            "module_type": "m09_executive",
            "domain": "costco.com",
            "version": 1,
            "has_changes": False,  # First version has no changes
        }

        # ACTUAL
        actual = {
            "module_type": snapshot.module_type,
            "domain": snapshot.domain,
            "version": snapshot.version,
            "has_changes": snapshot.has_changes,
        }

        # ASSERTION
        assert actual == expected, f"""
        VALIDATION FAILED: Snapshot creation

        Expected: {expected}
        Actual:   {actual}
        """
        assert snapshot.id is not None, "ID should be generated"
        assert snapshot.created_at is not None, "created_at should be set"

    def test_snapshot_diff_computation(
        self,
        db_session,
        sample_intel_snapshot,
        sample_snapshot_v2,
        expected_diff,
    ):
        """
        Test: Diff is correctly computed between versions.

        Setup:
            - V1 snapshot with original data
            - V2 snapshot with changed data

        Expected:
            - diff_from_previous contains correct changes
            - has_changes is True
            - Changed fields are identified
        """
        # SETUP
        v1 = IntelSnapshot(**sample_intel_snapshot)
        v2_data = sample_snapshot_v2
        v2_data["diff_from_previous"] = expected_diff
        v2_data["has_changes"] = True

        # ACTION
        v2 = IntelSnapshot(**v2_data)

        # EXPECTED
        expected_changed_fields = {"executives", "key_themes"}

        # ACTUAL
        actual_changed_fields = set(v2.diff_from_previous.get("changed", {}).keys())

        # ASSERTION
        assert v2.has_changes == True, "V2 should have changes"
        assert actual_changed_fields == expected_changed_fields, f"""
        VALIDATION FAILED: Diff computation

        Expected changed fields: {expected_changed_fields}
        Actual changed fields:   {actual_changed_fields}
        """


class TestChangeEvent:
    """
    Tests for ChangeEvent model.

    Validation Criteria:
    - Change category is valid enum
    - Significance is valid enum
    - Summary is human-readable
    - Algolia relevance is populated
    """

    def test_change_event_creation(self, db_session):
        """
        Test: Creating a change event with valid data.

        Expected:
            - Event is created with correct category
            - Significance is set
            - Summary is readable
        """
        # SETUP
        event_data = {
            "domain": "costco.com",
            "module_type": "m09_executive",
            "category": "executive_change",
            "significance": "high",
            "field": "executives",
            "old_value": {"name": "John Smith"},
            "new_value": {"name": "Jane Doe"},
            "summary": "CFO changed: John Smith → Jane Doe",
            "algolia_relevance": "New CFO may not have existing vendor relationships",
        }

        # ACTION
        event = ChangeEvent(**event_data)

        # EXPECTED
        expected = {
            "category": "executive_change",
            "significance": "high",
        }

        # ACTUAL
        actual = {
            "category": event.category,
            "significance": event.significance,
        }

        # ASSERTION
        assert actual == expected
        assert "CFO" in event.summary, "Summary should mention CFO"
        assert event.algolia_relevance is not None, "Algolia relevance required"
```

### 6.2 Service Tests

```python
# backend/tests/unit/services/test_versioning_service.py

import pytest
from app.services.versioning import VersioningService


class TestVersioningService:
    """
    Tests for VersioningService.

    Validation Criteria:
    - Snapshots are created with correct versions
    - Diffs are computed accurately
    - Latest snapshot is retrievable
    - History is returned in correct order
    """

    @pytest.fixture
    def service(self):
        return VersioningService()

    async def test_create_first_snapshot(
        self,
        db_session,
        service,
        sample_intel_snapshot,
    ):
        """
        Test: First snapshot has version 1 and no diff.

        Setup:
            - Empty database
            - Valid snapshot data

        Expected:
            - Version is 1
            - diff_from_previous is None
            - has_changes is False
        """
        # SETUP
        data = sample_intel_snapshot

        # ACTION
        snapshot = await service.create_snapshot(
            db=db_session,
            module_type=data["module_type"],
            domain=data["domain"],
            data=data["data"],
            source_url=data["source_url"],
            source_date=data["source_date"],
        )

        # EXPECTED
        expected = {
            "version": 1,
            "diff_from_previous": None,
            "has_changes": False,
        }

        # ACTUAL
        actual = {
            "version": snapshot.version,
            "diff_from_previous": snapshot.diff_from_previous,
            "has_changes": snapshot.has_changes,
        }

        # ASSERTION
        assert actual == expected, f"""
        VALIDATION FAILED: First snapshot

        Expected: {expected}
        Actual:   {actual}

        Fix: Check VersioningService.create_snapshot() logic
        """

    async def test_create_second_snapshot_with_diff(
        self,
        db_session,
        service,
        sample_intel_snapshot,
        sample_snapshot_v2,
    ):
        """
        Test: Second snapshot has version 2 and computed diff.

        Setup:
            - First snapshot created
            - Different data for second snapshot

        Expected:
            - Version is 2
            - diff_from_previous contains changes
            - has_changes is True
        """
        # SETUP - Create first snapshot
        v1_data = sample_intel_snapshot
        await service.create_snapshot(
            db=db_session,
            module_type=v1_data["module_type"],
            domain=v1_data["domain"],
            data=v1_data["data"],
            source_url=v1_data["source_url"],
            source_date=v1_data["source_date"],
        )

        # ACTION - Create second snapshot
        v2_data = sample_snapshot_v2
        snapshot = await service.create_snapshot(
            db=db_session,
            module_type=v2_data["module_type"],
            domain=v2_data["domain"],
            data=v2_data["data"],
            source_url=v2_data["source_url"],
            source_date=v2_data["source_date"],
        )

        # EXPECTED
        assert snapshot.version == 2, "Should be version 2"
        assert snapshot.has_changes == True, "Should have changes"
        assert snapshot.diff_from_previous is not None, "Should have diff"
        assert "executives" in snapshot.diff_from_previous.get("changed", {}), \
            "Should detect executive change"

    def test_compute_diff_changed_field(self, service):
        """
        Test: Diff correctly identifies changed fields.

        Setup:
            - Old data with field value A
            - New data with field value B

        Expected:
            - Field appears in "changed"
            - Old and new values are correct
        """
        # SETUP
        old_data = {"name": "John", "age": 30}
        new_data = {"name": "Jane", "age": 30}

        # ACTION
        diff = service._compute_diff(old_data, new_data)

        # EXPECTED
        expected = {
            "changed": {
                "name": {"old": "John", "new": "Jane"},
            },
            "added": {},
            "removed": {},
            "unchanged": ["age"],
        }

        # ASSERTION
        assert diff == expected, f"""
        VALIDATION FAILED: Diff computation

        Expected: {expected}
        Actual:   {diff}
        """

    def test_compute_diff_added_field(self, service):
        """
        Test: Diff correctly identifies added fields.
        """
        old_data = {"name": "John"}
        new_data = {"name": "John", "age": 30}

        diff = service._compute_diff(old_data, new_data)

        assert "age" in diff["added"], "Should detect added field"
        assert diff["added"]["age"] == 30

    def test_compute_diff_removed_field(self, service):
        """
        Test: Diff correctly identifies removed fields.
        """
        old_data = {"name": "John", "age": 30}
        new_data = {"name": "John"}

        diff = service._compute_diff(old_data, new_data)

        assert "age" in diff["removed"], "Should detect removed field"
        assert diff["removed"]["age"] == 30
```

---

## 7. Running Tests

### 7.1 Commands

```bash
# Run all tests
pytest backend/tests/ -v

# Run with coverage
pytest backend/tests/ --cov=backend/app --cov-report=html

# Run specific test file
pytest backend/tests/unit/models/test_versioning.py -v

# Run specific test
pytest backend/tests/unit/models/test_versioning.py::TestIntelSnapshot::test_snapshot_creation_with_valid_data -v

# Run with self-correction
python backend/tests/run_with_correction.py

# Run and generate validation report
pytest backend/tests/ --validation-report=reports/validation.json
```

### 7.2 CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r backend/requirements.txt
          pip install pytest pytest-asyncio pytest-cov

      - name: Run tests
        run: |
          pytest backend/tests/ \
            --cov=backend/app \
            --cov-report=xml \
            --cov-fail-under=80 \
            -v

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 8. Validation Report Format

```json
{
  "run_id": "test-2026-02-25-001",
  "timestamp": "2026-02-25T19:45:00Z",
  "summary": {
    "total": 50,
    "passed": 48,
    "failed": 2,
    "skipped": 0,
    "coverage": 87.5
  },
  "failures": [
    {
      "test_name": "test_alert_rule_matching",
      "file": "tests/unit/services/test_alert_service.py",
      "line": 45,
      "error_type": "AssertionError",
      "expected": {"matched": true},
      "actual": {"matched": false},
      "analysis": {
        "likely_cause": "Scope filter not checking territory correctly",
        "affected_files": ["app/services/alerts.py"],
        "fix_action": "manual",
        "fix_suggestion": "Check _rule_matches() scope handling"
      }
    }
  ],
  "coverage_by_file": {
    "app/models/versioning.py": 95.0,
    "app/services/versioning.py": 88.0,
    "app/services/alerts.py": 72.0
  }
}
```

---

## 9. Build Instructions Template

Every implementation task MUST include:

```markdown
## Task: {Task Name}

### Implementation
- File: `{file_path}`
- Function/Class: `{name}`
- Description: {what it does}

### Test Cases

#### Unit Tests
| Test | Input | Expected | Validation |
|------|-------|----------|------------|
| test_happy_path | {input} | {expected} | Assert equals |
| test_edge_case_1 | {input} | {expected} | Assert raises |
| test_error_handling | {input} | {expected} | Assert error msg |

#### Integration Tests
| Test | Setup | Action | Expected |
|------|-------|--------|----------|
| test_full_flow | {setup} | {action} | {expected} |

### Validation Criteria
- [ ] All unit tests pass
- [ ] Coverage > 85%
- [ ] No type errors
- [ ] Performance < 100ms

### Self-Correction
If test fails:
1. Check: {common issue 1}
2. Check: {common issue 2}
3. Fix: {fix suggestion}

### Rollback
If implementation fails:
```bash
git checkout -- {file_path}
```
```

---

---

## 10. Progress Persistence

### 10.1 Mandatory Checkpoint Saves

Every significant work item MUST be persisted to disk immediately:

```python
# backend/tests/helpers/persistence.py

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List


class ProgressPersistence:
    """
    Persist all work progress to disk to prevent loss.

    Usage:
        progress = ProgressPersistence("thread_4_session_2")
        progress.save_checkpoint("created_model", {"file": "models/versioning.py"})
        progress.save_checkpoint("wrote_tests", {"file": "tests/unit/test_versioning.py"})
        progress.save_final("completed", summary)
    """

    def __init__(self, session_id: str, base_dir: str = "progress"):
        self.session_id = session_id
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)
        self.session_dir = self.base_dir / session_id
        self.session_dir.mkdir(exist_ok=True)

        # Initialize session log
        self.log_file = self.session_dir / "progress.jsonl"
        self._init_session()

    def _init_session(self):
        """Initialize session with metadata."""
        self._append({
            "type": "session_start",
            "session_id": self.session_id,
            "timestamp": datetime.now().isoformat(),
        })

    def save_checkpoint(self, checkpoint_name: str, data: Dict[str, Any]):
        """Save a checkpoint with associated data."""
        self._append({
            "type": "checkpoint",
            "name": checkpoint_name,
            "timestamp": datetime.now().isoformat(),
            "data": data,
        })

        # Also save the actual data to a file
        checkpoint_file = self.session_dir / f"{checkpoint_name}.json"
        with open(checkpoint_file, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def save_test_result(self, test_name: str, passed: bool, details: Dict = None):
        """Save a test result."""
        self._append({
            "type": "test_result",
            "test_name": test_name,
            "passed": passed,
            "timestamp": datetime.now().isoformat(),
            "details": details or {},
        })

    def save_failure_analysis(self, test_name: str, analysis: Dict):
        """Save failure analysis for self-correction."""
        self._append({
            "type": "failure_analysis",
            "test_name": test_name,
            "timestamp": datetime.now().isoformat(),
            "analysis": analysis,
        })

        # Save to separate file for easy access
        failures_file = self.session_dir / "failures.jsonl"
        with open(failures_file, "a") as f:
            f.write(json.dumps({
                "test_name": test_name,
                "timestamp": datetime.now().isoformat(),
                **analysis
            }) + "\n")

    def save_fix_applied(self, test_name: str, fix_description: str, success: bool):
        """Record a fix that was applied."""
        self._append({
            "type": "fix_applied",
            "test_name": test_name,
            "fix_description": fix_description,
            "success": success,
            "timestamp": datetime.now().isoformat(),
        })

    def save_final(self, status: str, summary: Dict):
        """Save final session summary."""
        self._append({
            "type": "session_end",
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "summary": summary,
        })

        # Save complete summary
        summary_file = self.session_dir / "SUMMARY.json"
        with open(summary_file, "w") as f:
            json.dump({
                "session_id": self.session_id,
                "status": status,
                "completed_at": datetime.now().isoformat(),
                "summary": summary,
                "log_file": str(self.log_file),
            }, f, indent=2)

    def get_progress(self) -> List[Dict]:
        """Read all progress entries."""
        entries = []
        with open(self.log_file) as f:
            for line in f:
                entries.append(json.loads(line))
        return entries

    def _append(self, entry: Dict):
        """Append entry to log file."""
        with open(self.log_file, "a") as f:
            f.write(json.dumps(entry) + "\n")


# Usage example in test runner
async def run_with_persistence():
    """Run tests with full progress persistence."""

    session_id = f"test_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    progress = ProgressPersistence(session_id)

    progress.save_checkpoint("started", {
        "total_tests": 50,
        "test_files": ["test_versioning.py", "test_alerts.py", "..."],
    })

    results = []
    for test_file in test_files:
        for test in discover_tests(test_file):
            try:
                result = await run_test(test)
                passed = result.status == "PASS"

                progress.save_test_result(
                    test_name=test.name,
                    passed=passed,
                    details={"duration_ms": result.duration, "output": result.output}
                )

                if not passed:
                    analysis = self_corrector.analyze(result)
                    progress.save_failure_analysis(test.name, analysis.to_dict())

                    if analysis.auto_fixable:
                        fixed = self_corrector.apply_fix(analysis)
                        progress.save_fix_applied(test.name, analysis.fix_description, fixed)

                results.append(result)

            except Exception as e:
                progress.save_checkpoint("error", {
                    "test": test.name,
                    "error": str(e),
                })

    # Final summary
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed

    progress.save_final("completed", {
        "total": len(results),
        "passed": passed,
        "failed": failed,
        "coverage": calculate_coverage(),
    })

    return results
```

### 10.2 Directory Structure for Persistence

```
progress/
├── test_run_20260225_143000/
│   ├── progress.jsonl           # Line-by-line log of all events
│   ├── failures.jsonl           # Failed tests with analysis
│   ├── SUMMARY.json             # Final session summary
│   ├── started.json             # Initial checkpoint
│   ├── model_created.json       # After model implementation
│   ├── tests_written.json       # After test implementation
│   └── validation_passed.json   # After all tests pass
│
├── test_run_20260225_150000/
│   └── ...
│
└── latest -> test_run_20260225_150000/  # Symlink to most recent
```

### 10.3 Recovery from Interrupted Session

```python
# backend/tests/helpers/recovery.py

def recover_session(session_id: str) -> Dict:
    """
    Recover progress from an interrupted session.

    Returns:
        Dict with last checkpoint and remaining work
    """
    progress_dir = Path("progress") / session_id

    if not progress_dir.exists():
        raise ValueError(f"Session {session_id} not found")

    # Read progress log
    entries = []
    with open(progress_dir / "progress.jsonl") as f:
        for line in f:
            entries.append(json.loads(line))

    # Find last checkpoint
    checkpoints = [e for e in entries if e["type"] == "checkpoint"]
    last_checkpoint = checkpoints[-1] if checkpoints else None

    # Find completed tests
    completed_tests = {
        e["test_name"] for e in entries
        if e["type"] == "test_result" and e["passed"]
    }

    # Find pending fixes
    pending_fixes = [
        e for e in entries
        if e["type"] == "failure_analysis"
        and e["test_name"] not in completed_tests
    ]

    return {
        "session_id": session_id,
        "last_checkpoint": last_checkpoint,
        "completed_tests": list(completed_tests),
        "pending_fixes": pending_fixes,
        "can_resume": last_checkpoint is not None,
    }


async def resume_session(session_id: str):
    """Resume an interrupted test session."""

    recovery_info = recover_session(session_id)

    if not recovery_info["can_resume"]:
        print("Cannot resume - no checkpoint found")
        return

    print(f"Resuming from: {recovery_info['last_checkpoint']['name']}")
    print(f"Completed tests: {len(recovery_info['completed_tests'])}")
    print(f"Pending fixes: {len(recovery_info['pending_fixes'])}")

    # Continue with remaining work
    progress = ProgressPersistence(session_id)  # Appends to existing

    # Skip already-completed tests
    skip_tests = set(recovery_info["completed_tests"])

    # Run remaining tests
    for test in discover_all_tests():
        if test.name in skip_tests:
            continue

        result = await run_test(test)
        progress.save_test_result(test.name, result.passed, result.to_dict())
```

---

## 11. Build Task Template with Testing

Every implementation task MUST follow this template:

```markdown
## Task: {Task Name}

### 1. Implementation

**File:** `{file_path}`
**Component:** `{class/function name}`

### 2. Test Cases (WRITE FIRST)

#### Unit Tests
| ID | Test | Input | Expected Output | Validation |
|----|------|-------|-----------------|------------|
| U1 | test_happy_path | `{input}` | `{expected}` | Assert equals |
| U2 | test_edge_case_empty | `{}` | `ValidationError` | Assert raises |
| U3 | test_error_handling | `{bad_input}` | `{error_response}` | Check error code |

#### Integration Tests
| ID | Test | Setup | Action | Expected |
|----|------|-------|--------|----------|
| I1 | test_end_to_end | Create DB records | Call API | Data persisted |
| I2 | test_with_external | Mock API | Process | Transforms data |

### 3. Implementation Code

```python
# Write implementation after tests are defined
```

### 4. Validation Criteria

- [ ] All unit tests pass (`pytest tests/unit/test_{module}.py`)
- [ ] All integration tests pass (`pytest tests/integration/test_{module}.py`)
- [ ] Test coverage ≥ 85%
- [ ] No type errors (`mypy {file_path}`)
- [ ] No lint errors (`ruff check {file_path}`)
- [ ] Performance < 100ms for unit tests

### 5. Self-Correction Plan

If tests fail:

| Failure Type | Check | Fix |
|--------------|-------|-----|
| AssertionError | Compare expected vs actual | Adjust logic |
| TypeError | Check input types | Add validation |
| AttributeError | Check model fields | Add missing field |
| Timeout | Check async/await | Add timeout handling |

### 6. Persistence Checkpoints

- [ ] `tests_written` - After writing test file
- [ ] `implementation_complete` - After writing implementation
- [ ] `tests_passing` - After all tests pass
- [ ] `coverage_met` - After coverage ≥ 85%

### 7. Rollback

If implementation fails completely:
```bash
git checkout -- {file_path}
git checkout -- tests/unit/test_{module}.py
```
```

---

## 12. Regression Prevention

### 12.1 Baseline Tests

Every module has baseline tests that MUST pass:

```python
# backend/tests/baseline/test_baseline_{module}.py

"""
BASELINE TESTS - These tests define minimum acceptable behavior.
If any baseline test fails, the build is BLOCKED.
"""

class TestBaseline{Module}:
    """
    Baseline tests for {Module}.

    These tests verify:
    1. Module can be imported
    2. Core functions exist
    3. Basic happy path works
    4. Error handling is present
    """

    def test_module_imports(self):
        """Module can be imported without error."""
        from app.services import {module}
        assert {module} is not None

    def test_core_function_exists(self):
        """Core functions are defined."""
        from app.services.{module} import core_function
        assert callable(core_function)

    def test_happy_path(self, db_session):
        """Basic usage works."""
        # Minimal test of primary use case
        result = core_function(valid_input)
        assert result is not None

    def test_error_handling(self):
        """Errors are handled gracefully."""
        with pytest.raises(ValidationError):
            core_function(invalid_input)
```

### 12.2 CI/CD Gate

```yaml
# .github/workflows/ci.yml

jobs:
  baseline:
    name: Baseline Tests (BLOCKING)
    runs-on: ubuntu-latest
    steps:
      - name: Run baseline tests
        run: pytest backend/tests/baseline/ -v --tb=short
        # If this fails, nothing else runs

  full:
    name: Full Test Suite
    needs: baseline  # Only runs if baseline passes
    runs-on: ubuntu-latest
    steps:
      - name: Run all tests
        run: pytest backend/tests/ -v --cov=backend/app
```

---

*Document Version: 1.1*
*Last Updated: 2026-02-25 (Thread 4 Session 2)*
*Status: MANDATORY - All implementations must follow this methodology*
