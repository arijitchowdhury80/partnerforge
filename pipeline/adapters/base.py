"""
Base Adapter Abstract Class
===========================

Foundation for all API adapters with mandatory:
- Source citation enforcement (P0)
- Rate limiting integration
- Circuit breaker integration
- Retry logic with exponential backoff
- Cost tracking
- Caching support
- Metrics/observability

All concrete adapters (BuiltWithAdapter, SimilarWebAdapter, etc.)
MUST inherit from BaseAdapter and implement the abstract methods.

References:
- docs/SOURCE_CITATION_MANDATE.md
- docs/API_COST_TRACKING.md
- docs/OBSERVABILITY_METRICS.md
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import (
    Any,
    Dict,
    Generic,
    List,
    Optional,
    Type,
    TypeVar,
    Callable,
    Awaitable,
)
import asyncio
import hashlib
import json
import logging
import time

from pydantic import BaseModel, Field

from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.utils.circuit_breaker import (
    CircuitBreaker,
    CircuitOpenError,
)
from pipeline.utils.rate_limiter import (
    TokenBucketRateLimiter,
    rate_limiter_registry,
    API_RATE_LIMITS,
)
from pipeline.utils.retry import RetryConfig, RetryExhaustedError


logger = logging.getLogger(__name__)

# Type variable for response data
T = TypeVar("T")


class AdapterError(Exception):
    """Base exception for adapter errors."""

    def __init__(self, message: str, adapter_name: str, endpoint: Optional[str] = None):
        self.message = message
        self.adapter_name = adapter_name
        self.endpoint = endpoint
        super().__init__(f"[{adapter_name}] {message}")


class RateLimitError(AdapterError):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        adapter_name: str,
        wait_time_seconds: float = None,
        endpoint: Optional[str] = None,
        wait_time_ms: float = None,
    ):
        # Support both seconds and milliseconds
        if wait_time_ms is not None:
            self.wait_time_ms = wait_time_ms
            self.wait_time_seconds = wait_time_ms / 1000.0
        elif wait_time_seconds is not None:
            self.wait_time_seconds = wait_time_seconds
            self.wait_time_ms = wait_time_seconds * 1000.0
        else:
            self.wait_time_seconds = 0.0
            self.wait_time_ms = 0.0

        super().__init__(
            f"Rate limit exceeded. Wait {self.wait_time_ms:.0f}ms ({self.wait_time_seconds:.1f}s)",
            adapter_name,
            endpoint,
        )


class APIError(AdapterError):
    """Raised when API returns an error response."""

    def __init__(
        self,
        adapter_name: str,
        status_code: int,
        response_body: str,
        endpoint: Optional[str] = None,
    ):
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(
            f"API error {status_code}: {response_body[:200]}",
            adapter_name,
            endpoint,
        )


class SourceCitationMissingError(AdapterError):
    """P0 VIOLATION: Raised when response lacks source citation."""

    def __init__(self, adapter_name: str, endpoint: Optional[str] = None):
        super().__init__(
            "P0 VIOLATION: Response returned without source citation",
            adapter_name,
            endpoint,
        )


@dataclass
class AdapterMetrics:
    """Metrics tracked for each adapter."""

    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    rate_limit_waits: int = 0
    circuit_breaker_rejects: int = 0
    total_latency_ms: float = 0.0
    total_cost_usd: float = 0.0
    last_call_at: Optional[datetime] = None
    last_error: Optional[str] = None
    last_error_at: Optional[datetime] = None

    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_calls == 0:
            return 100.0
        return (self.successful_calls / self.total_calls) * 100

    @property
    def average_latency_ms(self) -> float:
        """Calculate average latency per call."""
        if self.successful_calls == 0:
            return 0.0
        return self.total_latency_ms / self.successful_calls

    @property
    def cache_hit_rate(self) -> float:
        """Calculate cache hit rate as percentage."""
        total = self.cache_hits + self.cache_misses
        if total == 0:
            return 0.0
        return (self.cache_hits / total) * 100


@dataclass
class EndpointConfig:
    """Configuration for a specific API endpoint."""

    name: str
    path: str
    method: str = "GET"
    cost_per_call: float = 0.0
    cache_ttl_seconds: int = 3600
    timeout_seconds: int = 30
    requires_auth: bool = True
    rate_limit_weight: int = 1  # Some endpoints count as multiple calls


class SourcedResponse(BaseModel, Generic[T]):
    """
    Response wrapper that ENFORCES source citation (P0 requirement).

    Every API response MUST be wrapped in this class to ensure
    the source citation is attached.
    """

    data: Any = Field(..., description="The actual response data")
    citation: SourceCitation = Field(
        ..., description="Mandatory source citation (P0 requirement)"
    )
    cached: bool = Field(default=False, description="Whether this came from cache")
    latency_ms: float = Field(default=0.0, description="API call latency")
    cost_usd: float = Field(default=0.0, description="Cost of this API call")
    raw_response: Optional[Dict[str, Any]] = Field(
        default=None, description="Raw API response for debugging"
    )

    class Config:
        arbitrary_types_allowed = True


class CacheEntry(BaseModel):
    """Cache entry with metadata for expiration."""

    data: Any
    citation: SourceCitation
    cached_at: datetime = Field(default_factory=datetime.utcnow)
    ttl_seconds: int
    cost_usd: float = 0.0

    @property
    def is_expired(self) -> bool:
        """Check if cache entry has expired."""
        expiry = self.cached_at + timedelta(seconds=self.ttl_seconds)
        return datetime.utcnow() > expiry

    @property
    def age_seconds(self) -> float:
        """Age of cache entry in seconds."""
        return (datetime.utcnow() - self.cached_at).total_seconds()


class BaseAdapter(ABC):
    """
    Abstract base class for all API adapters.

    Provides:
    - Rate limiting (configurable per adapter)
    - Circuit breaking (prevents cascade failures)
    - Retry with exponential backoff
    - Mandatory source citation enforcement (P0)
    - Cost tracking per API call
    - In-memory caching with TTL
    - Metrics collection

    Subclasses MUST implement:
    - _make_request(): Actually call the API
    - _parse_response(): Parse API response into domain objects
    - _build_source_url(): Construct the source URL for citation

    Example:
        class BuiltWithAdapter(BaseAdapter):
            def __init__(self, api_key: str):
                super().__init__(
                    name="builtwith",
                    source_type=SourceType.BUILTWITH,
                    api_key=api_key,
                    base_url="https://api.builtwith.com",
                )
    """

    def __init__(
        self,
        name: str,
        source_type: SourceType,
        api_key: Optional[str] = None,
        base_url: str = "",
        api_version: Optional[str] = None,
        # Rate limiting
        rate_limiter: Optional[TokenBucketRateLimiter] = None,
        # Circuit breaker
        circuit_breaker: Optional[CircuitBreaker] = None,
        failure_threshold: int = 5,
        recovery_time_ms: int = 60000,
        # Retry
        retry_config: Optional[RetryConfig] = None,
        # Cost tracking
        default_cost_per_call: float = 0.0,
        # Caching
        enable_cache: bool = True,
        default_cache_ttl_seconds: int = 3600,
        # Timeouts
        default_timeout_seconds: int = 30,
    ):
        """Initialize base adapter with all integrations."""
        self.name = name
        self.source_type = source_type
        self.api_key = api_key
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.api_version = api_version

        # Rate limiting - get from global registry or use provided
        if rate_limiter:
            self.rate_limiter = rate_limiter
        elif name in API_RATE_LIMITS:
            # Use pre-configured limits
            self.rate_limiter = rate_limiter_registry.get_or_create(
                name, **API_RATE_LIMITS[name]
            )
        else:
            # Create default rate limiter
            self.rate_limiter = rate_limiter_registry.get_or_create(
                name, tokens_per_second=1.0, bucket_size=10
            )

        # Circuit breaker
        if circuit_breaker:
            self.circuit_breaker = circuit_breaker
        else:
            self.circuit_breaker = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                recovery_time_ms=recovery_time_ms,
            )

        # Retry configuration
        self.retry_config = retry_config or RetryConfig(
            max_retries=3,
            base_delay_ms=1000,
            max_delay_ms=30000,
            retryable_exceptions={
                ConnectionError,
                TimeoutError,
                asyncio.TimeoutError,
            },
        )

        # Cost tracking
        self.default_cost_per_call = default_cost_per_call

        # Caching
        self.enable_cache = enable_cache
        self.default_cache_ttl_seconds = default_cache_ttl_seconds
        self._cache: Dict[str, CacheEntry] = {}

        # Timeouts
        self.default_timeout_seconds = default_timeout_seconds

        # Metrics
        self.metrics = AdapterMetrics()

        # Endpoint configurations
        self._endpoints: Dict[str, EndpointConfig] = {}

    def register_endpoint(self, config: EndpointConfig) -> None:
        """Register an endpoint with its configuration."""
        self._endpoints[config.name] = config

    def get_endpoint_config(self, endpoint: str) -> EndpointConfig:
        """Get configuration for an endpoint."""
        if endpoint in self._endpoints:
            return self._endpoints[endpoint]
        # Return default config
        return EndpointConfig(
            name=endpoint,
            path=f"/{endpoint}",
            cost_per_call=self.default_cost_per_call,
            cache_ttl_seconds=self.default_cache_ttl_seconds,
            timeout_seconds=self.default_timeout_seconds,
        )

    def _generate_cache_key(
        self, endpoint: str, params: Dict[str, Any]
    ) -> str:
        """Generate a unique cache key for the request."""
        key_data = {
            "adapter": self.name,
            "endpoint": endpoint,
            "params": params,
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_str.encode()).hexdigest()[:32]

    def _get_from_cache(self, cache_key: str) -> Optional[CacheEntry]:
        """Get entry from cache if valid."""
        if not self.enable_cache:
            return None

        entry = self._cache.get(cache_key)
        if entry and not entry.is_expired:
            self.metrics.cache_hits += 1
            return entry

        if entry:
            # Expired, remove it
            del self._cache[cache_key]

        self.metrics.cache_misses += 1
        return None

    def _put_in_cache(
        self,
        cache_key: str,
        data: Any,
        citation: SourceCitation,
        ttl_seconds: int,
        cost_usd: float,
    ) -> None:
        """Put entry in cache."""
        if not self.enable_cache:
            return

        self._cache[cache_key] = CacheEntry(
            data=data,
            citation=citation,
            ttl_seconds=ttl_seconds,
            cost_usd=cost_usd,
        )

    def clear_cache(self) -> int:
        """Clear all cache entries. Returns number of entries cleared."""
        count = len(self._cache)
        self._cache.clear()
        return count

    def cleanup_expired_cache(self) -> int:
        """Remove expired cache entries. Returns number removed."""
        expired_keys = [
            key for key, entry in self._cache.items() if entry.is_expired
        ]
        for key in expired_keys:
            del self._cache[key]
        return len(expired_keys)

    @abstractmethod
    async def _make_request(
        self,
        endpoint: str,
        params: Dict[str, Any],
        timeout_seconds: int,
    ) -> Dict[str, Any]:
        """
        Make the actual API request.

        Subclasses MUST implement this method to perform the HTTP call.

        Args:
            endpoint: The API endpoint name
            params: Request parameters
            timeout_seconds: Request timeout

        Returns:
            Raw API response as dictionary

        Raises:
            APIError: On API error response
            ConnectionError: On network failure
            TimeoutError: On request timeout
        """
        pass

    @abstractmethod
    def _parse_response(
        self,
        endpoint: str,
        raw_response: Dict[str, Any],
        params: Dict[str, Any],
    ) -> Any:
        """
        Parse the raw API response into domain objects.

        Subclasses MUST implement this method to transform the
        API response into the appropriate data structure.

        Args:
            endpoint: The API endpoint name
            raw_response: Raw API response dictionary
            params: Original request parameters

        Returns:
            Parsed response data (type depends on endpoint)
        """
        pass

    @abstractmethod
    def _build_source_url(
        self,
        endpoint: str,
        params: Dict[str, Any],
    ) -> str:
        """
        Build the source URL for citation.

        Subclasses MUST implement this method to construct the
        URL that will be used in the source citation.

        Args:
            endpoint: The API endpoint name
            params: Request parameters

        Returns:
            Full URL string for the source citation
        """
        pass

    def _create_citation(
        self,
        endpoint: str,
        params: Dict[str, Any],
        confidence: float = 1.0,
    ) -> SourceCitation:
        """Create a source citation for the API response."""
        return SourceCitation.from_api_response(
            source_type=self.source_type,
            source_url=self._build_source_url(endpoint, params),
            api_endpoint=endpoint,
            api_version=self.api_version,
            confidence=confidence,
        )

    async def _execute_with_retry(
        self,
        endpoint: str,
        params: Dict[str, Any],
        timeout_seconds: int,
    ) -> Dict[str, Any]:
        """Execute request with retry logic."""
        last_exception: Optional[Exception] = None
        start_time = datetime.utcnow()

        for attempt in range(self.retry_config.max_retries + 1):
            try:
                return await self._make_request(endpoint, params, timeout_seconds)

            except Exception as e:
                last_exception = e

                # Check if exception is retryable
                is_retryable = isinstance(e, tuple(self.retry_config.retryable_exceptions))

                # If not retryable, raise immediately
                if not is_retryable:
                    raise

                # If this was the last attempt, raise
                if attempt >= self.retry_config.max_retries:
                    total_time = int(
                        (datetime.utcnow() - start_time).total_seconds() * 1000
                    )
                    raise RetryExhaustedError(
                        message=f"All {self.retry_config.max_retries} retries exhausted",
                        attempts=self.retry_config.max_retries,
                        last_exception=last_exception,
                        total_time_ms=total_time,
                    )

                # Calculate delay and wait
                delay = self.retry_config.calculate_delay(attempt)
                logger.warning(
                    f"[{self.name}] Retry {attempt + 1}/{self.retry_config.max_retries} "
                    f"for {endpoint} after {delay:.2f}s due to: {e}"
                )
                await asyncio.sleep(delay)

        # Should not reach here, but handle edge case
        raise last_exception

    async def call(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        bypass_cache: bool = False,
        bypass_rate_limit: bool = False,
    ) -> SourcedResponse:
        """
        Execute an API call with all protections and source citation.

        This is the main entry point for adapter calls. It handles:
        1. Cache check (if enabled)
        2. Rate limiting
        3. Circuit breaker check
        4. Retry logic
        5. Source citation attachment (P0 REQUIREMENT)
        6. Metrics collection

        Args:
            endpoint: API endpoint to call
            params: Request parameters
            bypass_cache: Skip cache lookup (still caches result)
            bypass_rate_limit: Skip rate limit check (use with caution)

        Returns:
            SourcedResponse with data and mandatory citation

        Raises:
            RateLimitError: If rate limit exceeded and not willing to wait
            CircuitOpenError: If circuit breaker is open
            RetryExhaustedError: If all retries failed
            APIError: If API returns error
        """
        params = params or {}
        endpoint_config = self.get_endpoint_config(endpoint)

        # Generate cache key
        cache_key = self._generate_cache_key(endpoint, params)

        # Check cache first
        if not bypass_cache:
            cached_entry = self._get_from_cache(cache_key)
            if cached_entry:
                logger.debug(f"[{self.name}] Cache hit for {endpoint}")

                # Create cache citation pointing to original
                cache_citation = SourceCitation.from_cache(
                    original=cached_entry.citation,
                    cache_key=cache_key,
                )

                return SourcedResponse(
                    data=cached_entry.data,
                    citation=cache_citation,
                    cached=True,
                    latency_ms=0.0,
                    cost_usd=0.0,  # Cache hits are free
                )

        # Check rate limit (non-blocking check)
        if not bypass_rate_limit:
            available = self.rate_limiter.available_tokens
            if available < endpoint_config.rate_limit_weight:
                # Calculate approximate wait time
                tokens_needed = endpoint_config.rate_limit_weight - available
                wait_time = tokens_needed / self.rate_limiter.tokens_per_second
                self.metrics.rate_limit_waits += 1
                logger.warning(
                    f"[{self.name}] Rate limit hit for {endpoint}, wait {wait_time:.1f}s"
                )
                raise RateLimitError(self.name, wait_time, endpoint)

        # Check circuit breaker
        if not self.circuit_breaker.allow_request():
            self.metrics.circuit_breaker_rejects += 1
            logger.warning(f"[{self.name}] Circuit breaker open for {endpoint}")
            # Calculate time until recovery
            time_until_recovery = 0.0
            if self.circuit_breaker._last_failure_time:
                recovery_time = self.circuit_breaker._last_failure_time + timedelta(
                    milliseconds=self.circuit_breaker.recovery_time_ms
                )
                time_until_recovery = max(
                    0.0,
                    (recovery_time - datetime.utcnow()).total_seconds()
                )
            raise CircuitOpenError(self.name, time_until_recovery)

        # Acquire rate limit token (blocking)
        if not bypass_rate_limit:
            await self.rate_limiter.acquire()

        # Execute with retry
        start_time = time.time()
        self.metrics.total_calls += 1
        self.metrics.last_call_at = datetime.utcnow()

        try:
            raw_response = await self._execute_with_retry(
                endpoint, params, endpoint_config.timeout_seconds
            )

            # Calculate latency
            latency_ms = (time.time() - start_time) * 1000

            # Parse the response
            parsed_data = self._parse_response(endpoint, raw_response, params)

            # Create source citation (P0 REQUIREMENT)
            citation = self._create_citation(endpoint, params)

            # Track success
            self.circuit_breaker.record_success()
            self.metrics.successful_calls += 1
            self.metrics.total_latency_ms += latency_ms
            self.metrics.total_cost_usd += endpoint_config.cost_per_call

            # Cache the result
            self._put_in_cache(
                cache_key,
                parsed_data,
                citation,
                endpoint_config.cache_ttl_seconds,
                endpoint_config.cost_per_call,
            )

            # Return sourced response with citation
            return SourcedResponse(
                data=parsed_data,
                citation=citation,
                cached=False,
                latency_ms=latency_ms,
                cost_usd=endpoint_config.cost_per_call,
                raw_response=raw_response,
            )

        except Exception as e:
            # Record failure
            self.circuit_breaker.record_failure()
            self.metrics.failed_calls += 1
            self.metrics.last_error = str(e)
            self.metrics.last_error_at = datetime.utcnow()

            logger.error(f"[{self.name}] API call failed for {endpoint}: {e}")
            raise

    async def call_with_wait(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        bypass_cache: bool = False,
    ) -> SourcedResponse:
        """
        Execute API call, waiting for rate limit if necessary.

        Unlike `call()`, this method will always wait for rate limit
        availability instead of raising RateLimitError.

        Args:
            endpoint: API endpoint to call
            params: Request parameters
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with data and mandatory citation
        """
        params = params or {}
        endpoint_config = self.get_endpoint_config(endpoint)

        # Check cache first
        if not bypass_cache:
            cache_key = self._generate_cache_key(endpoint, params)
            cached_entry = self._get_from_cache(cache_key)
            if cached_entry:
                cache_citation = SourceCitation.from_cache(
                    original=cached_entry.citation,
                    cache_key=cache_key,
                )
                return SourcedResponse(
                    data=cached_entry.data,
                    citation=cache_citation,
                    cached=True,
                    latency_ms=0.0,
                    cost_usd=0.0,
                )

        # Wait for rate limit token (blocking)
        await self.rate_limiter.acquire()
        self.metrics.rate_limit_waits += 1

        # Now call with rate limit bypassed (we already acquired)
        return await self.call(
            endpoint, params, bypass_cache=bypass_cache, bypass_rate_limit=True
        )

    def get_metrics(self) -> Dict[str, Any]:
        """Get current adapter metrics as dictionary."""
        return {
            "adapter_name": self.name,
            "total_calls": self.metrics.total_calls,
            "successful_calls": self.metrics.successful_calls,
            "failed_calls": self.metrics.failed_calls,
            "success_rate": self.metrics.success_rate,
            "cache_hits": self.metrics.cache_hits,
            "cache_misses": self.metrics.cache_misses,
            "cache_hit_rate": self.metrics.cache_hit_rate,
            "rate_limit_waits": self.metrics.rate_limit_waits,
            "circuit_breaker_rejects": self.metrics.circuit_breaker_rejects,
            "circuit_breaker_state": self.circuit_breaker.state.value,
            "average_latency_ms": self.metrics.average_latency_ms,
            "total_cost_usd": self.metrics.total_cost_usd,
            "last_call_at": (
                self.metrics.last_call_at.isoformat()
                if self.metrics.last_call_at
                else None
            ),
            "last_error": self.metrics.last_error,
            "last_error_at": (
                self.metrics.last_error_at.isoformat()
                if self.metrics.last_error_at
                else None
            ),
            "cache_size": len(self._cache),
        }

    def reset_metrics(self) -> None:
        """Reset all metrics to zero."""
        self.metrics = AdapterMetrics()

    def health_check(self) -> Dict[str, Any]:
        """Get adapter health status."""
        return {
            "name": self.name,
            "healthy": self.circuit_breaker.allow_request(),
            "circuit_breaker_state": self.circuit_breaker.state.value,
            "success_rate": self.metrics.success_rate,
            "rate_limiter_available_tokens": self.rate_limiter.available_tokens,
            "cache_size": len(self._cache),
            "last_error": self.metrics.last_error,
        }


class MockAdapter(BaseAdapter):
    """
    Mock adapter for testing without real API calls.

    Use this adapter in unit tests to avoid:
    - Real API calls
    - Rate limiting
    - Network dependencies

    Example:
        mock = MockAdapter("test")
        mock.set_mock_response("domain-lookup", {"technologies": [...]})
        response = await mock.call("domain-lookup", {"domain": "costco.com"})
    """

    def __init__(
        self,
        name: str = "mock",
        source_type: SourceType = SourceType.WEBSEARCH,
    ):
        # Create a permissive rate limiter for tests
        rate_limiter = TokenBucketRateLimiter(
            name=f"mock_{name}",
            tokens_per_second=1000.0,  # Very high for tests
            bucket_size=1000,
        )
        super().__init__(
            name=name,
            source_type=source_type,
            rate_limiter=rate_limiter,
            default_cost_per_call=0.0,
        )
        self._mock_responses: Dict[str, Any] = {}
        self._mock_errors: Dict[str, Exception] = {}
        self._call_history: List[Dict[str, Any]] = []

    def set_mock_response(self, endpoint: str, response: Any) -> None:
        """Set mock response for an endpoint."""
        self._mock_responses[endpoint] = response

    def set_mock_error(self, endpoint: str, error: Exception) -> None:
        """Set mock error for an endpoint."""
        self._mock_errors[endpoint] = error

    def get_call_history(self) -> List[Dict[str, Any]]:
        """Get history of all calls made."""
        return self._call_history

    def clear(self) -> None:
        """Clear all mock responses and history."""
        self._mock_responses.clear()
        self._mock_errors.clear()
        self._call_history.clear()

    async def _make_request(
        self,
        endpoint: str,
        params: Dict[str, Any],
        timeout_seconds: int,
    ) -> Dict[str, Any]:
        """Return mock response or raise mock error."""
        self._call_history.append({
            "endpoint": endpoint,
            "params": params,
            "timestamp": datetime.utcnow().isoformat(),
        })

        if endpoint in self._mock_errors:
            raise self._mock_errors[endpoint]

        if endpoint in self._mock_responses:
            return self._mock_responses[endpoint]

        return {"mock": True, "endpoint": endpoint}

    def _parse_response(
        self,
        endpoint: str,
        raw_response: Dict[str, Any],
        params: Dict[str, Any],
    ) -> Any:
        """Return raw response as-is for mocks."""
        return raw_response

    def _build_source_url(
        self,
        endpoint: str,
        params: Dict[str, Any],
    ) -> str:
        """Build mock source URL."""
        return f"https://mock.api/{endpoint}?mock=true"
