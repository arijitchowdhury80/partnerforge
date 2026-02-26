"""
Tests for Self-Correction Framework

Tests the SelfCorrector, FailureAnalysis, and ValidationResult classes.

Validation Criteria:
- Error type detection is correct
- Fix suggestions are appropriate
- Confidence scores are reasonable
- Auto-fix threshold is respected
"""

import pytest
from datetime import datetime

from app.utils.self_correction import (
    SelfCorrector,
    ValidationResult,
    FailureAnalysis,
    FixAction,
)


class TestValidationResult:
    """Tests for ValidationResult dataclass."""

    def test_validation_result_creation(self):
        """
        Test: Creating a ValidationResult with valid data.

        Expected:
            - All fields are set correctly
            - Default values are applied
        """
        # SETUP
        result = ValidationResult(
            test_name="test_example",
            test_module="unit.models",
            status="PASS",
        )

        # VALIDATION
        assert result.test_name == "test_example"
        assert result.test_module == "unit.models"
        assert result.status == "PASS"
        assert result.is_passed() == True
        assert result.is_failed() == False

    def test_failed_result(self):
        """
        Test: ValidationResult for a failed test.

        Expected:
            - is_passed() returns False
            - is_failed() returns True
        """
        # SETUP
        result = ValidationResult(
            test_name="test_fail",
            test_module="unit.models",
            status="FAIL",
            error_message="Expected 1, got 2",
        )

        # VALIDATION
        assert result.is_passed() == False
        assert result.is_failed() == True

    def test_error_result(self):
        """
        Test: ValidationResult for an error (not assertion failure).

        Expected:
            - ERROR status is treated as failed
        """
        # SETUP
        result = ValidationResult(
            test_name="test_error",
            test_module="unit.models",
            status="ERROR",
            error=RuntimeError("Something broke"),
        )

        # VALIDATION
        assert result.is_failed() == True


class TestFailureAnalysis:
    """Tests for FailureAnalysis dataclass."""

    def test_failure_analysis_creation(self):
        """
        Test: Creating a FailureAnalysis with valid data.

        Expected:
            - All fields are set correctly
            - to_dict() returns serializable format
        """
        # SETUP
        analysis = FailureAnalysis(
            test_name="test_example",
            test_module="unit.models",
            error_type="AttributeError",
            error_message="'Model' object has no attribute 'field'",
            likely_cause="Missing field",
            affected_files=["models.py"],
            fix_action=FixAction.SUGGEST,
            fix_description="Add field to model",
            confidence=0.8,
        )

        # VALIDATION
        assert analysis.test_name == "test_example"
        assert analysis.error_type == "AttributeError"
        assert analysis.fix_action == FixAction.SUGGEST
        assert analysis.confidence == 0.8

        # Test serialization
        data = analysis.to_dict()
        assert data["test_name"] == "test_example"
        assert data["fix_action"] == "suggest"
        assert "timestamp" in data


class TestSelfCorrector:
    """Tests for SelfCorrector class."""

    @pytest.fixture
    def corrector(self):
        """Create a SelfCorrector instance."""
        return SelfCorrector()

    def test_analyze_attribute_error(self, corrector):
        """
        Test: Analyzing AttributeError produces correct analysis.

        Setup:
            - ValidationResult with AttributeError

        Expected:
            - Extracts field name from message
            - Suggests adding field to model
            - Confidence is reasonably high
        """
        # SETUP
        result = ValidationResult(
            test_name="test_snapshot",
            test_module="unit.models.test_versioning",
            status="FAIL",
            error=AttributeError("'IntelSnapshot' object has no attribute 'new_field'"),
            error_message="'IntelSnapshot' object has no attribute 'new_field'",
        )

        # ACTION
        analysis = corrector.analyze_failure(result)

        # VALIDATION
        assert analysis.error_type == "AttributeError"
        assert "new_field" in analysis.likely_cause
        assert "IntelSnapshot" in analysis.likely_cause
        assert analysis.fix_action == FixAction.SUGGEST
        assert analysis.confidence >= 0.7
        assert "Column" in analysis.fix_code

    def test_analyze_type_error_missing_argument(self, corrector):
        """
        Test: Analyzing TypeError for missing argument.

        Expected:
            - Detects missing argument pattern
            - Suggests adding argument
        """
        # SETUP
        result = ValidationResult(
            test_name="test_function",
            test_module="unit.services",
            status="FAIL",
            error=TypeError("function() missing 1 required positional argument: 'data'"),
            error_message="function() missing 1 required positional argument: 'data'",
        )

        # ACTION
        analysis = corrector.analyze_failure(result)

        # VALIDATION
        assert analysis.error_type == "TypeError"
        assert "data" in analysis.likely_cause
        assert analysis.fix_action == FixAction.SUGGEST

    def test_analyze_assertion_error(self, corrector):
        """
        Test: Analyzing AssertionError requires manual intervention.

        Expected:
            - Fix action is MANUAL
            - Expected/actual values in description
        """
        # SETUP
        result = ValidationResult(
            test_name="test_value",
            test_module="unit.models",
            status="FAIL",
            error=AssertionError("Expected 1, got 2"),
            error_message="assert 1 == 2",
            expected=1,
            actual=2,
        )

        # ACTION
        analysis = corrector.analyze_failure(result)

        # VALIDATION
        assert analysis.error_type == "AssertionError"
        assert analysis.fix_action == FixAction.MANUAL
        assert "Expected" in analysis.fix_description
        assert "Actual" in analysis.fix_description
        assert analysis.confidence <= 0.5  # Low confidence for logic errors

    def test_analyze_integrity_error_unique(self, corrector):
        """
        Test: Analyzing IntegrityError for unique constraint.

        Expected:
            - Detects unique constraint violation
            - Suggests using unique value
        """
        # SETUP
        from sqlalchemy.exc import IntegrityError

        result = ValidationResult(
            test_name="test_duplicate",
            test_module="unit.models",
            status="ERROR",
            error=IntegrityError("UNIQUE constraint failed", None, None),
            error_message="UNIQUE constraint failed: table.column",
        )

        # ACTION
        analysis = corrector.analyze_failure(result)

        # VALIDATION
        assert analysis.error_type == "IntegrityError"
        assert "unique" in analysis.likely_cause.lower() or "duplicate" in analysis.likely_cause.lower()
        assert analysis.fix_action == FixAction.SUGGEST

    def test_analyze_key_error(self, corrector):
        """
        Test: Analyzing KeyError extracts key name.

        Expected:
            - Extracts missing key from message
            - Suggests using .get()
        """
        # SETUP
        result = ValidationResult(
            test_name="test_dict",
            test_module="unit.services",
            status="ERROR",
            error=KeyError("missing_key"),
            error_message="'missing_key'",
        )

        # ACTION
        analysis = corrector.analyze_failure(result)

        # VALIDATION
        assert analysis.error_type == "KeyError"
        assert "missing_key" in analysis.likely_cause
        assert ".get(" in analysis.fix_code
        assert analysis.confidence >= 0.7

    def test_analyze_timeout_error(self, corrector):
        """
        Test: Analyzing TimeoutError suggests retry.

        Expected:
            - Fix action is RETRY
            - Retry parameters are set
        """
        # SETUP
        result = ValidationResult(
            test_name="test_slow",
            test_module="unit.services",
            status="ERROR",
            error=TimeoutError("Operation timed out"),
            error_message="Operation timed out after 30s",
        )

        # ACTION
        analysis = corrector.analyze_failure(result)

        # VALIDATION
        assert analysis.error_type == "TimeoutError"
        assert analysis.fix_action == FixAction.RETRY
        assert analysis.retry_delay_seconds > 0
        assert analysis.max_retries > 0

    def test_analyze_import_error(self, corrector):
        """
        Test: Analyzing ImportError suggests installation.

        Expected:
            - Extracts module name
            - Suggests pip install
            - High confidence
        """
        # SETUP
        result = ValidationResult(
            test_name="test_import",
            test_module="unit.services",
            status="ERROR",
            error=ImportError("No module named 'missing_module'"),
            error_message="No module named 'missing_module'",
        )

        # ACTION
        analysis = corrector.analyze_failure(result)

        # VALIDATION
        assert analysis.error_type == "ImportError"
        assert "missing_module" in analysis.likely_cause
        assert "pip install" in analysis.fix_code
        assert analysis.confidence >= 0.8

    def test_analyze_unknown_error(self, corrector):
        """
        Test: Unknown errors require manual intervention.

        Expected:
            - Fix action is MANUAL
            - Low confidence
        """
        # SETUP
        class CustomError(Exception):
            pass

        result = ValidationResult(
            test_name="test_custom",
            test_module="unit.services",
            status="ERROR",
            error=CustomError("Something happened"),
            error_message="Something happened",
        )

        # ACTION
        analysis = corrector.analyze_failure(result)

        # VALIDATION
        assert analysis.fix_action == FixAction.MANUAL
        assert analysis.confidence < 0.5

    def test_apply_fix_requires_auto_fix_action(self, corrector):
        """
        Test: apply_fix() only works for AUTO_FIX action.

        Expected:
            - Returns False for non-AUTO_FIX actions
        """
        # SETUP
        analysis = FailureAnalysis(
            test_name="test_example",
            test_module="unit",
            error_type="AssertionError",
            error_message="test",
            likely_cause="test",
            affected_files=[],
            fix_action=FixAction.SUGGEST,  # Not AUTO_FIX
            fix_description="test",
            confidence=0.95,
            fix_code="# some code",
        )

        # ACTION
        result = corrector.apply_fix(analysis)

        # VALIDATION
        assert result == False

    def test_apply_fix_requires_high_confidence(self, corrector):
        """
        Test: apply_fix() requires confidence >= 0.9.

        Expected:
            - Returns False for low confidence
        """
        # SETUP
        analysis = FailureAnalysis(
            test_name="test_example",
            test_module="unit",
            error_type="AttributeError",
            error_message="test",
            likely_cause="test",
            affected_files=[],
            fix_action=FixAction.AUTO_FIX,
            fix_description="test",
            confidence=0.7,  # Below threshold
            fix_code="# some code",
        )

        # ACTION
        result = corrector.apply_fix(analysis)

        # VALIDATION
        assert result == False

    def test_infer_model_file(self, corrector):
        """
        Test: Model file inference from class name.

        Expected:
            - Correct file paths for known patterns
        """
        # VALIDATION
        assert "versioning" in corrector._infer_model_file("IntelSnapshot")
        assert "versioning" in corrector._infer_model_file("ChangeEvent")
        assert "alerts" in corrector._infer_model_file("AlertRule")
        assert "platform" in corrector._infer_model_file("User")
        assert "intelligence" in corrector._infer_model_file("IntelCompanyContext")

    def test_cannot_analyze_passing_test(self, corrector):
        """
        Test: analyze_failure() rejects passing tests.

        Expected:
            - Raises ValueError for passing tests
        """
        # SETUP
        result = ValidationResult(
            test_name="test_pass",
            test_module="unit",
            status="PASS",
        )

        # VALIDATION
        with pytest.raises(ValueError, match="passing test"):
            corrector.analyze_failure(result)

    def test_get_summary_empty(self, corrector):
        """
        Test: Summary for new corrector with no activity.

        Expected:
            - All counts are zero
        """
        # ACTION
        summary = corrector.get_summary()

        # VALIDATION
        assert summary["total_analyzed"] == 0
        assert summary["auto_fixed"] == 0
        assert summary["suggested"] == 0

    def test_fix_history_tracking(self, corrector):
        """
        Test: Fix attempts are recorded in history.

        Expected:
            - apply_fix() records attempt in fix_history
        """
        # SETUP
        analysis = FailureAnalysis(
            test_name="test_example",
            test_module="unit",
            error_type="AttributeError",
            error_message="test",
            likely_cause="test",
            affected_files=[],
            fix_action=FixAction.AUTO_FIX,
            fix_description="test",
            confidence=0.95,
            fix_code="# some code",
        )

        # ACTION
        corrector.apply_fix(analysis)

        # VALIDATION
        assert len(corrector.fix_history) == 1
        assert corrector.fix_history[0]["test_name"] == "test_example"
