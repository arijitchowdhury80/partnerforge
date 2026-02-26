"""
Token Bucket Rate Limiter
=========================

Implements rate limiting using the token bucket algorithm.
Supports both local (in-memory) and distributed (Redis) modes.

Usage:
    # Local rate limiter
    limiter = TokenBucketRateLimiter(
        tokens_per_second=1.0,
        bucket_size=10
    )

    async with limiter:
        await call_api()

    # Or as decorator
    @limiter
    async def call_api():
        ...
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from functools import wraps
from typing import Callable, Any, Optional
import threading

logger = logging.getLogger(__name__)


@dataclass
class RateLimiterConfig:
    """Configuration for rate limiter."""

    tokens_per_second: float = 1.0
    bucket_size: int = 10
    wait_on_limit: bool = True  # If False, raises immediately when limited
    timeout_ms: int = 30000  # Max time to wait for token


class RateLimitExceededError(Exception):
    """Raised when rate limit is exceeded and waiting is disabled."""

    def __init__(self, name: str, wait_time: float):
        self.name = name
        self.wait_time = wait_time
        super().__init__(
            f"Rate limit exceeded for '{name}'. "
            f"Retry in {wait_time:.2f}s"
        )


class TokenBucketRateLimiter:
    """
    Token bucket rate limiter implementation.

    Allows bursts up to bucket_size, then limits to tokens_per_second.

    Example:
        # BuiltWith: 30 RPM = 0.5 tokens/second
        builtwith_limiter = TokenBucketRateLimiter(
            name="builtwith",
            tokens_per_second=0.5,
            bucket_size=5
        )

        @builtwith_limiter
        async def fetch_tech_stack(domain: str):
            ...
    """

    def __init__(
        self,
        name: str = "default",
        tokens_per_second: float = 1.0,
        bucket_size: int = 10,
        wait_on_limit: bool = True,
        timeout_ms: int = 30000,
        config: RateLimiterConfig = None,
    ):
        self.name = name

        if config:
            self.tokens_per_second = config.tokens_per_second
            self.bucket_size = config.bucket_size
            self.wait_on_limit = config.wait_on_limit
            self.timeout_ms = config.timeout_ms
        else:
            self.tokens_per_second = tokens_per_second
            self.bucket_size = bucket_size
            self.wait_on_limit = wait_on_limit
            self.timeout_ms = timeout_ms

        self._tokens = float(bucket_size)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()
        self._sync_lock = threading.Lock()

        # Statistics
        self._total_requests = 0
        self._total_waits = 0
        self._total_wait_time_ms = 0

    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self._last_refill
        tokens_to_add = elapsed * self.tokens_per_second
        self._tokens = min(self.bucket_size, self._tokens + tokens_to_add)
        self._last_refill = now

    def _try_acquire_sync(self) -> tuple[bool, float]:
        """
        Try to acquire a token synchronously.

        Returns:
            (success, wait_time_if_failed)
        """
        with self._sync_lock:
            self._refill()

            if self._tokens >= 1:
                self._tokens -= 1
                return True, 0

            # Calculate wait time for next token
            wait_time = (1 - self._tokens) / self.tokens_per_second
            return False, wait_time

    async def acquire(self) -> bool:
        """
        Acquire a token, waiting if necessary.

        Returns:
            True if token acquired

        Raises:
            RateLimitExceededError: If waiting is disabled or timeout exceeded
        """
        start_time = time.monotonic()
        deadline = start_time + (self.timeout_ms / 1000)

        while True:
            async with self._lock:
                self._refill()
                self._total_requests += 1

                if self._tokens >= 1:
                    self._tokens -= 1
                    return True

                # Calculate wait time for next token
                wait_time = (1 - self._tokens) / self.tokens_per_second

                # Check if we've exceeded timeout
                if time.monotonic() + wait_time > deadline:
                    if not self.wait_on_limit:
                        raise RateLimitExceededError(self.name, wait_time)
                    logger.warning(
                        f"Rate limiter '{self.name}' timeout exceeded"
                    )
                    raise asyncio.TimeoutError(
                        f"Rate limit timeout after {self.timeout_ms}ms"
                    )

                if not self.wait_on_limit:
                    raise RateLimitExceededError(self.name, wait_time)

            # Wait outside the lock
            logger.debug(
                f"Rate limiter '{self.name}' waiting {wait_time:.2f}s for token"
            )
            self._total_waits += 1
            self._total_wait_time_ms += int(wait_time * 1000)
            await asyncio.sleep(wait_time)

    async def release(self):
        """Release is a no-op for token bucket (tokens don't return)."""
        pass

    def __call__(self, func: Callable) -> Callable:
        """
        Decorator to wrap function with rate limiting.

        Example:
            @limiter
            async def call_api():
                ...
        """
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            await self.acquire()
            return await func(*args, **kwargs)

        return wrapper

    async def __aenter__(self):
        """Async context manager entry."""
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.release()
        return False

    @property
    def available_tokens(self) -> float:
        """Get current available tokens."""
        with self._sync_lock:
            self._refill()
            return self._tokens

    @property
    def stats(self) -> dict:
        """Get rate limiter statistics."""
        return {
            "name": self.name,
            "tokens_per_second": self.tokens_per_second,
            "bucket_size": self.bucket_size,
            "available_tokens": self.available_tokens,
            "total_requests": self._total_requests,
            "total_waits": self._total_waits,
            "total_wait_time_ms": self._total_wait_time_ms,
            "avg_wait_time_ms": (
                self._total_wait_time_ms / self._total_waits
                if self._total_waits > 0 else 0
            ),
        }

    def reset(self):
        """Reset limiter to full bucket."""
        with self._sync_lock:
            self._tokens = float(self.bucket_size)
            self._last_refill = time.monotonic()
            logger.info(f"Rate limiter '{self.name}' reset")


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter for more accurate rate limiting.

    Tracks actual request timestamps instead of token bucket.
    Better for APIs with strict per-minute limits.

    Example:
        # SimilarWeb: 60 RPM
        limiter = SlidingWindowRateLimiter(
            name="similarweb",
            requests_per_window=60,
            window_size_ms=60000
        )
    """

    def __init__(
        self,
        name: str = "default",
        requests_per_window: int = 60,
        window_size_ms: int = 60000,
        wait_on_limit: bool = True,
    ):
        self.name = name
        self.requests_per_window = requests_per_window
        self.window_size_ms = window_size_ms
        self.wait_on_limit = wait_on_limit

        self._request_times: list[float] = []
        self._lock = asyncio.Lock()

    def _clean_old_requests(self, now: float):
        """Remove requests outside the current window."""
        cutoff = now - (self.window_size_ms / 1000)
        self._request_times = [t for t in self._request_times if t > cutoff]

    async def acquire(self) -> bool:
        """Acquire permission to make a request."""
        async with self._lock:
            now = time.monotonic()
            self._clean_old_requests(now)

            if len(self._request_times) < self.requests_per_window:
                self._request_times.append(now)
                return True

            # Calculate wait time until oldest request expires
            oldest = self._request_times[0]
            wait_time = (oldest + self.window_size_ms / 1000) - now

            if not self.wait_on_limit:
                raise RateLimitExceededError(self.name, wait_time)

        # Wait and retry
        if wait_time > 0:
            logger.debug(
                f"Sliding window '{self.name}' waiting {wait_time:.2f}s"
            )
            await asyncio.sleep(wait_time)

        return await self.acquire()

    def __call__(self, func: Callable) -> Callable:
        """Decorator to wrap function with rate limiting."""
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            await self.acquire()
            return await func(*args, **kwargs)

        return wrapper

    async def __aenter__(self):
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False


class RateLimiterRegistry:
    """
    Registry for managing multiple rate limiters.

    Usage:
        registry = RateLimiterRegistry()
        registry.register("builtwith", tokens_per_second=0.5, bucket_size=5)
        registry.register("similarweb", tokens_per_second=1.0, bucket_size=10)

        builtwith_limiter = registry.get("builtwith")
    """

    def __init__(self):
        self._limiters: dict[str, TokenBucketRateLimiter] = {}
        self._lock = threading.Lock()

    def register(
        self,
        name: str,
        tokens_per_second: float = 1.0,
        bucket_size: int = 10,
        **kwargs
    ) -> TokenBucketRateLimiter:
        """Register a new rate limiter."""
        with self._lock:
            if name in self._limiters:
                return self._limiters[name]

            limiter = TokenBucketRateLimiter(
                name=name,
                tokens_per_second=tokens_per_second,
                bucket_size=bucket_size,
                **kwargs
            )
            self._limiters[name] = limiter
            return limiter

    def get(self, name: str) -> Optional[TokenBucketRateLimiter]:
        """Get a rate limiter by name."""
        return self._limiters.get(name)

    def get_or_create(
        self,
        name: str,
        tokens_per_second: float = 1.0,
        bucket_size: int = 10,
        **kwargs
    ) -> TokenBucketRateLimiter:
        """Get existing or create new rate limiter."""
        if name not in self._limiters:
            return self.register(
                name,
                tokens_per_second=tokens_per_second,
                bucket_size=bucket_size,
                **kwargs
            )
        return self._limiters[name]

    @property
    def all_stats(self) -> dict:
        """Get stats for all rate limiters."""
        return {name: limiter.stats for name, limiter in self._limiters.items()}

    def reset_all(self):
        """Reset all rate limiters."""
        for limiter in self._limiters.values():
            limiter.reset()


# Global registry instance
rate_limiter_registry = RateLimiterRegistry()


# Pre-configured rate limiters for known APIs
# Based on PRD rate limits:
# | Provider | RPM | Concurrent |
# |----------|-----|------------|
# | BuiltWith | 30 | 5 |
# | SimilarWeb | 60 | 10 |
# | Yahoo Finance | 100 | 10 |
# | SEC EDGAR | 6 | 2 |
# | WebSearch | 300 | 20 |

API_RATE_LIMITS = {
    "builtwith": {"tokens_per_second": 0.5, "bucket_size": 5},
    "similarweb": {"tokens_per_second": 1.0, "bucket_size": 10},
    "yahoo_finance": {"tokens_per_second": 1.67, "bucket_size": 10},
    "sec_edgar": {"tokens_per_second": 0.1, "bucket_size": 2},
    "websearch": {"tokens_per_second": 5.0, "bucket_size": 20},
}


def get_api_rate_limiter(api_name: str) -> TokenBucketRateLimiter:
    """
    Get a pre-configured rate limiter for known APIs.

    Example:
        limiter = get_api_rate_limiter("builtwith")
    """
    if api_name not in API_RATE_LIMITS:
        raise ValueError(
            f"Unknown API: {api_name}. "
            f"Available: {list(API_RATE_LIMITS.keys())}"
        )

    config = API_RATE_LIMITS[api_name]
    return rate_limiter_registry.get_or_create(api_name, **config)
