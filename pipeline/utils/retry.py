"""
Retry Utility with Exponential Backoff
======================================

Provides resilient API calls with:
- Configurable max retries
- Exponential backoff with jitter
- Specific exception handling
- Logging of retry attempts

Usage:
    @retry_with_backoff(max_retries=3, base_delay_ms=1000)
    async def fetch_data():
        ...

    # Or with config object
    config = RetryConfig(max_retries=5, base_delay_ms=500)
    @retry_with_backoff(config=config)
    async def fetch_data():
        ...
"""

import asyncio
import logging
import random
from dataclasses import dataclass, field
from functools import wraps
from typing import Callable, Set, Type, TypeVar, Any
from datetime import datetime

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""

    max_retries: int = 3
    base_delay_ms: int = 1000
    max_delay_ms: int = 30000
    exponential_base: float = 2.0
    jitter_factor: float = 0.1
    retryable_exceptions: Set[Type[Exception]] = field(
        default_factory=lambda: {
            ConnectionError,
            TimeoutError,
            asyncio.TimeoutError,
        }
    )
    retryable_status_codes: Set[int] = field(
        default_factory=lambda: {429, 500, 502, 503, 504}
    )

    def calculate_delay(self, attempt: int) -> float:
        """
        Calculate delay for given attempt number.

        Uses exponential backoff with jitter:
        delay = min(base * (exp_base ^ attempt) + jitter, max_delay)
        """
        base_delay = self.base_delay_ms * (self.exponential_base ** attempt)
        jitter = random.uniform(0, self.jitter_factor * base_delay)
        delay = min(base_delay + jitter, self.max_delay_ms)
        return delay / 1000  # Convert to seconds


class RetryExhaustedError(Exception):
    """Raised when all retry attempts are exhausted."""

    def __init__(
        self,
        message: str,
        attempts: int,
        last_exception: Exception,
        total_time_ms: int
    ):
        self.attempts = attempts
        self.last_exception = last_exception
        self.total_time_ms = total_time_ms
        super().__init__(message)


class HTTPError(Exception):
    """HTTP error with status code."""

    def __init__(self, status_code: int, message: str = ""):
        self.status_code = status_code
        super().__init__(f"HTTP {status_code}: {message}")


def retry_with_backoff(
    max_retries: int = None,
    base_delay_ms: int = None,
    config: RetryConfig = None,
    on_retry: Callable[[int, Exception], None] = None,
):
    """
    Decorator for retrying async functions with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay_ms: Base delay in milliseconds
        config: RetryConfig object (overrides individual params)
        on_retry: Optional callback called on each retry

    Returns:
        Decorated function with retry logic

    Example:
        @retry_with_backoff(max_retries=3)
        async def fetch_api():
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    return await response.json()
    """
    # Build config from params or use provided
    if config is None:
        config = RetryConfig(
            max_retries=max_retries or 3,
            base_delay_ms=base_delay_ms or 1000,
        )

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            start_time = datetime.utcnow()
            last_exception = None

            for attempt in range(config.max_retries + 1):
                try:
                    return await func(*args, **kwargs)

                except Exception as e:
                    last_exception = e

                    # Check if exception is retryable
                    is_retryable = isinstance(e, tuple(config.retryable_exceptions))

                    # Check for HTTP errors with retryable status codes
                    if isinstance(e, HTTPError):
                        is_retryable = e.status_code in config.retryable_status_codes

                    # If not retryable, raise immediately
                    if not is_retryable:
                        logger.debug(
                            f"Non-retryable exception in {func.__name__}: {e}"
                        )
                        raise

                    # If this was the last attempt, raise
                    if attempt >= config.max_retries:
                        total_time = int(
                            (datetime.utcnow() - start_time).total_seconds() * 1000
                        )
                        raise RetryExhaustedError(
                            message=f"All {config.max_retries} retries exhausted for {func.__name__}",
                            attempts=config.max_retries,
                            last_exception=last_exception,
                            total_time_ms=total_time,
                        )

                    # Calculate delay and wait
                    delay = config.calculate_delay(attempt)

                    logger.warning(
                        f"Retry {attempt + 1}/{config.max_retries} for {func.__name__} "
                        f"after {delay:.2f}s due to: {e}"
                    )

                    # Call retry callback if provided
                    if on_retry:
                        on_retry(attempt + 1, e)

                    await asyncio.sleep(delay)

            # Should not reach here, but handle edge case
            raise last_exception

        return wrapper

    return decorator


class RetryTracker:
    """
    Tracks retry statistics for monitoring.

    Usage:
        tracker = RetryTracker()

        @retry_with_backoff(on_retry=tracker.on_retry)
        async def fetch_data():
            ...

        # Later
        print(tracker.stats)
    """

    def __init__(self):
        self.total_retries = 0
        self.retries_by_function: dict[str, int] = {}
        self.exceptions_seen: dict[str, int] = {}

    def on_retry(self, attempt: int, exception: Exception):
        """Callback for tracking retry events."""
        self.total_retries += 1

        exc_name = type(exception).__name__
        self.exceptions_seen[exc_name] = self.exceptions_seen.get(exc_name, 0) + 1

    @property
    def stats(self) -> dict:
        """Get retry statistics."""
        return {
            "total_retries": self.total_retries,
            "by_function": self.retries_by_function,
            "by_exception": self.exceptions_seen,
        }
