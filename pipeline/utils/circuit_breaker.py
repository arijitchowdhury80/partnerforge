"""
Circuit Breaker Pattern Implementation
======================================

Prevents cascade failures by tracking failure rates and
temporarily blocking calls to failing services.

States:
- CLOSED: Normal operation, all calls pass through
- OPEN: Service failing, all calls rejected immediately
- HALF_OPEN: Testing recovery, limited calls allowed

Usage:
    breaker = CircuitBreaker(failure_threshold=5, recovery_time_ms=60000)

    @breaker
    async def call_api():
        ...

    # Or use as context manager
    async with breaker:
        result = await call_api()
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
from typing import Callable, Any, Optional
import threading

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states."""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Blocking calls
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker behavior."""

    failure_threshold: int = 5
    recovery_time_ms: int = 60000
    half_open_requests: int = 3
    success_threshold: int = 2  # Successes needed to close from half-open


class CircuitOpenError(Exception):
    """Raised when circuit is open and call is rejected."""

    def __init__(self, name: str, time_until_recovery: float):
        self.name = name
        self.time_until_recovery = time_until_recovery
        super().__init__(
            f"Circuit '{name}' is OPEN. "
            f"Recovery in {time_until_recovery:.1f}s"
        )


class CircuitBreaker:
    """
    Circuit breaker implementation for resilient API calls.

    Tracks failures and prevents cascade failures by temporarily
    blocking calls to failing services.

    Example:
        breaker = CircuitBreaker(
            name="builtwith",
            failure_threshold=5,
            recovery_time_ms=60000
        )

        @breaker
        async def fetch_tech_stack(domain: str):
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_URL}/{domain}") as response:
                    return await response.json()
    """

    def __init__(
        self,
        name: str = "default",
        failure_threshold: int = 5,
        recovery_time_ms: int = 60000,
        half_open_requests: int = 3,
        success_threshold: int = 2,
        config: CircuitBreakerConfig = None,
    ):
        self.name = name

        if config:
            self.failure_threshold = config.failure_threshold
            self.recovery_time_ms = config.recovery_time_ms
            self.half_open_requests = config.half_open_requests
            self.success_threshold = config.success_threshold
        else:
            self.failure_threshold = failure_threshold
            self.recovery_time_ms = recovery_time_ms
            self.half_open_requests = half_open_requests
            self.success_threshold = success_threshold

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._half_open_calls = 0
        self._last_failure_time: Optional[datetime] = None
        self._lock = threading.Lock()

    @property
    def state(self) -> CircuitState:
        """Get current circuit state, updating if recovery time has passed."""
        with self._lock:
            if self._state == CircuitState.OPEN:
                if self._should_attempt_recovery():
                    self._transition_to_half_open()
            return self._state

    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (normal operation)."""
        return self.state == CircuitState.CLOSED

    @property
    def is_open(self) -> bool:
        """Check if circuit is open (blocking calls)."""
        return self.state == CircuitState.OPEN

    def _should_attempt_recovery(self) -> bool:
        """Check if enough time has passed to attempt recovery."""
        if self._last_failure_time is None:
            return True

        recovery_delta = timedelta(milliseconds=self.recovery_time_ms)
        return datetime.utcnow() >= self._last_failure_time + recovery_delta

    def _transition_to_half_open(self):
        """Transition from OPEN to HALF_OPEN state."""
        self._state = CircuitState.HALF_OPEN
        self._half_open_calls = 0
        self._success_count = 0
        logger.info(f"Circuit '{self.name}' transitioned to HALF_OPEN")

    def _transition_to_open(self):
        """Transition to OPEN state."""
        self._state = CircuitState.OPEN
        self._last_failure_time = datetime.utcnow()
        logger.warning(
            f"Circuit '{self.name}' OPENED after {self._failure_count} failures. "
            f"Recovery in {self.recovery_time_ms/1000:.1f}s"
        )

    def _transition_to_closed(self):
        """Transition to CLOSED state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._half_open_calls = 0
        logger.info(f"Circuit '{self.name}' CLOSED - service recovered")

    def record_success(self):
        """Record a successful call."""
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.success_threshold:
                    self._transition_to_closed()
            elif self._state == CircuitState.CLOSED:
                # Reset failure count on success
                self._failure_count = max(0, self._failure_count - 1)

    def record_failure(self):
        """Record a failed call."""
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = datetime.utcnow()

            if self._state == CircuitState.HALF_OPEN:
                # Any failure in half-open immediately opens
                self._transition_to_open()
            elif self._state == CircuitState.CLOSED:
                if self._failure_count >= self.failure_threshold:
                    self._transition_to_open()

    def allow_request(self) -> bool:
        """
        Check if a request should be allowed through.

        Returns:
            True if request is allowed, False if circuit is open
        """
        state = self.state  # This updates state if needed

        if state == CircuitState.CLOSED:
            return True

        if state == CircuitState.OPEN:
            return False

        # HALF_OPEN: Allow limited requests
        with self._lock:
            if self._half_open_calls < self.half_open_requests:
                self._half_open_calls += 1
                return True
            return False

    def __call__(self, func: Callable) -> Callable:
        """
        Decorator to wrap function with circuit breaker.

        Example:
            @breaker
            async def call_api():
                ...
        """
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            if not self.allow_request():
                time_until_recovery = 0
                if self._last_failure_time:
                    recovery_time = self._last_failure_time + timedelta(
                        milliseconds=self.recovery_time_ms
                    )
                    time_until_recovery = max(
                        0,
                        (recovery_time - datetime.utcnow()).total_seconds()
                    )
                raise CircuitOpenError(self.name, time_until_recovery)

            try:
                result = await func(*args, **kwargs)
                self.record_success()
                return result
            except Exception as e:
                self.record_failure()
                raise

        return wrapper

    async def __aenter__(self):
        """Async context manager entry."""
        if not self.allow_request():
            time_until_recovery = 0
            if self._last_failure_time:
                recovery_time = self._last_failure_time + timedelta(
                    milliseconds=self.recovery_time_ms
                )
                time_until_recovery = max(
                    0,
                    (recovery_time - datetime.utcnow()).total_seconds()
                )
            raise CircuitOpenError(self.name, time_until_recovery)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if exc_type is None:
            self.record_success()
        else:
            self.record_failure()
        return False  # Don't suppress exceptions

    def reset(self):
        """Reset circuit breaker to initial state."""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._half_open_calls = 0
            self._last_failure_time = None
            logger.info(f"Circuit '{self.name}' manually reset")

    @property
    def stats(self) -> dict:
        """Get circuit breaker statistics."""
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "half_open_calls": self._half_open_calls,
            "last_failure_time": (
                self._last_failure_time.isoformat()
                if self._last_failure_time else None
            ),
        }


class CircuitBreakerRegistry:
    """
    Registry for managing multiple circuit breakers.

    Usage:
        registry = CircuitBreakerRegistry()
        registry.register("builtwith", failure_threshold=5)
        registry.register("similarweb", failure_threshold=3)

        builtwith_breaker = registry.get("builtwith")
    """

    def __init__(self):
        self._breakers: dict[str, CircuitBreaker] = {}
        self._lock = threading.Lock()

    def register(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_time_ms: int = 60000,
        **kwargs
    ) -> CircuitBreaker:
        """Register a new circuit breaker."""
        with self._lock:
            if name in self._breakers:
                return self._breakers[name]

            breaker = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                recovery_time_ms=recovery_time_ms,
                **kwargs
            )
            self._breakers[name] = breaker
            return breaker

    def get(self, name: str) -> Optional[CircuitBreaker]:
        """Get a circuit breaker by name."""
        return self._breakers.get(name)

    def get_or_create(self, name: str, **kwargs) -> CircuitBreaker:
        """Get existing or create new circuit breaker."""
        if name not in self._breakers:
            return self.register(name, **kwargs)
        return self._breakers[name]

    @property
    def all_stats(self) -> dict:
        """Get stats for all circuit breakers."""
        return {name: breaker.stats for name, breaker in self._breakers.items()}

    def reset_all(self):
        """Reset all circuit breakers."""
        for breaker in self._breakers.values():
            breaker.reset()


# Global registry instance
circuit_registry = CircuitBreakerRegistry()
