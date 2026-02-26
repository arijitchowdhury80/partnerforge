"""
Test Runner with Self-Correction

Runs tests with automatic analysis and correction attempts.

Usage:
    python -m tests.run_with_correction
    python -m tests.run_with_correction --max-iterations 5
    python -m tests.run_with_correction --test-module models

Flow:
1. Run all tests (or specified module)
2. Collect failures
3. Analyze each failure with SelfCorrector
4. Apply auto-fixes where confidence is high
5. Report suggestions for manual fixes
6. Re-run failed tests
7. Repeat until all pass or max iterations reached
"""

import asyncio
import sys
import argparse
import subprocess
import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.utils.self_correction import (
    SelfCorrector,
    ValidationResult,
    FailureAnalysis,
    FixAction,
)


@dataclass
class TestRunResult:
    """Result of a test run."""

    total_tests: int = 0
    passed: int = 0
    failed: int = 0
    errors: int = 0
    skipped: int = 0

    failures: List[ValidationResult] = field(default_factory=list)
    duration_seconds: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @property
    def all_passed(self) -> bool:
        return self.failed == 0 and self.errors == 0


class CorrectionRunner:
    """
    Test runner with automatic correction.

    Combines pytest execution with SelfCorrector analysis.
    """

    def __init__(
        self,
        max_iterations: int = 3,
        test_path: str = "backend/tests/",
        verbose: bool = True,
    ):
        self.max_iterations = max_iterations
        self.test_path = test_path
        self.verbose = verbose
        self.corrector = SelfCorrector()

        # Track progress
        self.iteration_results: List[TestRunResult] = []
        self.applied_fixes: List[FailureAnalysis] = []
        self.suggested_fixes: List[FailureAnalysis] = []

    async def run(self, test_module: Optional[str] = None) -> bool:
        """
        Run tests with correction loop.

        Args:
            test_module: Optional specific module to test (e.g., "models")

        Returns:
            True if all tests eventually pass
        """
        iteration = 0

        while iteration < self.max_iterations:
            iteration += 1
            self._print_header(f"Test Run {iteration}/{self.max_iterations}")

            # Run tests
            result = await self._run_tests(test_module)
            self.iteration_results.append(result)

            # Print summary
            self._print_summary(result)

            if result.all_passed:
                self._print_success("All tests passed!")
                return True

            # Analyze failures
            self._print_header("Analyzing Failures")

            for failure in result.failures:
                analysis = self.corrector.analyze_failure(failure)
                self._print_analysis(analysis)

                # Try to apply fix
                if analysis.fix_action == FixAction.AUTO_FIX:
                    if self.corrector.apply_fix(analysis):
                        self.applied_fixes.append(analysis)
                        self._print_fix_applied(analysis)
                    else:
                        self.suggested_fixes.append(analysis)
                        self._print_fix_suggested(analysis)
                elif analysis.fix_action == FixAction.SUGGEST:
                    self.suggested_fixes.append(analysis)
                    self._print_fix_suggested(analysis)
                elif analysis.fix_action == FixAction.RETRY:
                    self._print_retry(analysis)
                else:
                    self._print_manual_required(analysis)

            # If no auto-fixes were applied, no point continuing
            if not any(
                f.fix_action == FixAction.AUTO_FIX
                for f in self.suggested_fixes[-len(result.failures):]
            ):
                self._print_warning(
                    "No automatic fixes available. Manual intervention required."
                )
                break

        # Final report
        self._print_final_report()

        return False

    async def _run_tests(
        self,
        test_module: Optional[str] = None
    ) -> TestRunResult:
        """
        Execute pytest and parse results.

        Uses pytest --json-report for structured output.
        """
        # Build pytest command
        cmd = [
            "python", "-m", "pytest",
            "-v",
            "--tb=short",
            "-q",
        ]

        # Add specific module if provided
        if test_module:
            test_path = f"backend/tests/{test_module}"
        else:
            test_path = self.test_path

        cmd.append(test_path)

        # Run pytest
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=Path(__file__).parent.parent.parent,
            )

            stdout, stderr = await process.communicate()
            output = stdout.decode() + stderr.decode()

        except Exception as e:
            return TestRunResult(
                failures=[
                    ValidationResult(
                        test_name="pytest_execution",
                        test_module="runner",
                        status="ERROR",
                        error=e,
                        error_message=str(e),
                    )
                ]
            )

        # Parse pytest output
        return self._parse_pytest_output(output)

    def _parse_pytest_output(self, output: str) -> TestRunResult:
        """
        Parse pytest output to extract results.

        Parses the summary line and failure details.
        """
        result = TestRunResult()
        lines = output.split("\n")

        # Parse summary line: "X passed, Y failed, Z error in Xs"
        for line in reversed(lines):
            if "passed" in line or "failed" in line or "error" in line:
                # Extract counts
                passed_match = re.search(r"(\d+) passed", line)
                failed_match = re.search(r"(\d+) failed", line)
                error_match = re.search(r"(\d+) error", line)
                skipped_match = re.search(r"(\d+) skipped", line)
                time_match = re.search(r"in ([\d.]+)s", line)

                result.passed = int(passed_match.group(1)) if passed_match else 0
                result.failed = int(failed_match.group(1)) if failed_match else 0
                result.errors = int(error_match.group(1)) if error_match else 0
                result.skipped = int(skipped_match.group(1)) if skipped_match else 0
                result.duration_seconds = float(time_match.group(1)) if time_match else 0

                result.total_tests = (
                    result.passed + result.failed + result.errors + result.skipped
                )
                break

        # Parse failure details
        in_failure = False
        current_failure: Dict[str, Any] = {}

        for line in lines:
            # Detect failure start
            if line.startswith("FAILED "):
                in_failure = True
                # Parse test name: "FAILED tests/unit/test_x.py::TestClass::test_method"
                match = re.search(r"FAILED (.+?)::(.+?)::(.+)", line)
                if match:
                    current_failure = {
                        "file": match.group(1),
                        "class": match.group(2),
                        "method": match.group(3),
                    }
            elif in_failure and line.strip().startswith("E "):
                # Error message line
                current_failure["error_message"] = line.strip()[2:]
            elif in_failure and (
                line.startswith("=") or line.startswith("_") or not line.strip()
            ):
                # End of failure block
                if current_failure:
                    result.failures.append(
                        ValidationResult(
                            test_name=f"{current_failure.get('class', '')}.{current_failure.get('method', '')}",
                            test_module=current_failure.get("file", ""),
                            status="FAIL",
                            error_message=current_failure.get("error_message", ""),
                        )
                    )
                in_failure = False
                current_failure = {}

        return result

    def _print_header(self, text: str):
        """Print section header."""
        if self.verbose:
            print(f"\n{'=' * 60}")
            print(f"  {text}")
            print(f"{'=' * 60}\n")

    def _print_summary(self, result: TestRunResult):
        """Print test run summary."""
        if self.verbose:
            status = "PASS" if result.all_passed else "FAIL"
            symbol = "✅" if result.all_passed else "❌"

            print(f"{symbol} {status}: {result.passed} passed, "
                  f"{result.failed} failed, {result.errors} errors, "
                  f"{result.skipped} skipped ({result.duration_seconds:.2f}s)")

    def _print_analysis(self, analysis: FailureAnalysis):
        """Print failure analysis."""
        if self.verbose:
            print(f"\n--- {analysis.test_name} ---")
            print(f"Error Type: {analysis.error_type}")
            print(f"Likely Cause: {analysis.likely_cause}")
            print(f"Confidence: {analysis.confidence:.0%}")
            print(f"Action: {analysis.fix_action.value}")

    def _print_fix_applied(self, analysis: FailureAnalysis):
        """Print when a fix is applied."""
        if self.verbose:
            print(f"🔧 Auto-fix applied for {analysis.test_name}")

    def _print_fix_suggested(self, analysis: FailureAnalysis):
        """Print fix suggestion."""
        if self.verbose:
            print(f"💡 Suggestion: {analysis.fix_description}")
            if analysis.fix_code:
                print(f"\n```python\n{analysis.fix_code}\n```")

    def _print_retry(self, analysis: FailureAnalysis):
        """Print retry suggestion."""
        if self.verbose:
            print(f"🔄 Retry recommended (delay: {analysis.retry_delay_seconds}s, "
                  f"max: {analysis.max_retries})")

    def _print_manual_required(self, analysis: FailureAnalysis):
        """Print manual intervention required."""
        if self.verbose:
            print(f"⚠️ Manual fix required")
            print(f"Affected files: {', '.join(analysis.affected_files)}")

    def _print_success(self, text: str):
        """Print success message."""
        if self.verbose:
            print(f"\n✅ {text}")

    def _print_warning(self, text: str):
        """Print warning message."""
        if self.verbose:
            print(f"\n⚠️ {text}")

    def _print_final_report(self):
        """Print final summary report."""
        if not self.verbose:
            return

        print(f"\n{'=' * 60}")
        print("  FINAL REPORT")
        print(f"{'=' * 60}\n")

        # Iteration summary
        print("Iterations:")
        for i, result in enumerate(self.iteration_results, 1):
            status = "✅" if result.all_passed else "❌"
            print(f"  {i}. {status} {result.passed}/{result.total_tests} passed")

        # Fixes summary
        print(f"\nFixes Applied: {len(self.applied_fixes)}")
        print(f"Suggestions Made: {len(self.suggested_fixes)}")

        # Corrector summary
        summary = self.corrector.get_summary()
        print(f"\nCorrector Summary:")
        print(f"  Total Analyzed: {summary['total_analyzed']}")
        print(f"  Auto-Fixed: {summary['auto_fixed']}")
        print(f"  Suggested: {summary['suggested']}")

        # Outstanding suggestions
        if self.suggested_fixes:
            print(f"\nOutstanding Suggestions:")
            for fix in self.suggested_fixes[-5:]:  # Last 5
                print(f"  - {fix.test_name}: {fix.fix_description[:60]}...")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run tests with automatic correction"
    )
    parser.add_argument(
        "--max-iterations", "-m",
        type=int,
        default=3,
        help="Maximum correction iterations (default: 3)"
    )
    parser.add_argument(
        "--test-module",
        type=str,
        help="Specific test module to run (e.g., 'unit/models')"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Reduce output verbosity"
    )

    args = parser.parse_args()

    runner = CorrectionRunner(
        max_iterations=args.max_iterations,
        verbose=not args.quiet,
    )

    success = await runner.run(test_module=args.test_module)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
