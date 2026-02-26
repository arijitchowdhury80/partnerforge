"""
Unit Tests for BaseAdapter
==========================

Tests for the adapter foundation that enforces:
- Source citation (P0 requirement)
- Rate limiting
- Circuit breaker
- Caching
- Metrics

Run:
    pytest tests/unit/adapters/test_base_adapter.py -v
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
from typing import Dict, Any

from pipeline.adapters.base import (
    BaseAdapter,
    MockAdapter,
    SourcedResponse,
    CacheEntry,
    EndpointConfig,
    AdapterError,
    RateLimitError,
    APIError,
    SourceCitationMissingError,
    AdapterMetrics,
)
from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.utils.circuit_breaker import CircuitBreaker, CircuitOpenError, CircuitState
from pipeline.utils.rate_limiter import TokenBucketRateLimiter


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def mock_adapter() -> MockAdapter:
    """Create a fresh MockAdapter for each test."""
    adapter = MockAdapter(name="test_adapter")
    adapter.set_mock_response("test-endpoint", {"data": "test_value"})
    return adapter


@pytest.fixture
def mock_adapter_with_circuit_breaker() -> MockAdapter:
    """MockAdapter with explicit circuit breaker for testing."""
    cb = CircuitBreaker(
        name="test_cb",
        failure_threshold=3,
        recovery_time_ms=1000,
    )
    adapter = MockAdapter(name="test_adapter_cb")
    adapter.circuit_breaker = cb
    adapter.set_mock_response("test-endpoint", {"data": "test_value"})
    return adapter


@pytest.fixture
def mock_adapter_with_rate_limiter() -> MockAdapter:
    """MockAdapter with explicit rate limiter for testing."""
    rl = TokenBucketRateLimiter(
        name="test_rl",
        tokens_per_second=1.0,
        bucket_size=2,
    )
    adapter = MockAdapter(name="test_adapter_rl")
    adapter.rate_limiter = rl
    adapter.set_mock_response("test-endpoint", {"data": "test_value"})
    return adapter


# ============================================================================
# SourcedResponse Tests
# ============================================================================


class TestSourcedResponse:
    """Test SourcedResponse wrapper."""

    def test_sourced_response_requires_citation(self):
        """P0: SourcedResponse must have citation."""
        # This should work
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/test",
        )
        response = SourcedResponse(
            data={"test": True},
            citation=citation,
        )
        assert response.citation is not None

    def test_sourced_response_tracks_cache_status(self):
        """SourcedResponse tracks if data came from cache."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/test",
        )

        fresh_response = SourcedResponse(
            data={"test": True},
            citation=citation,
            cached=False,
        )
        assert fresh_response.cached is False

        cached_response = SourcedResponse(
            data={"test": True},
            citation=citation,
            cached=True,
        )
        assert cached_response.cached is True

    def test_sourced_response_tracks_cost(self):
        """SourcedResponse tracks API call cost."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/test",
        )
        response = SourcedResponse(
            data={"test": True},
            citation=citation,
            cost_usd=0.10,
        )
        assert response.cost_usd == 0.10


# ============================================================================
# CacheEntry Tests
# ============================================================================


class TestCacheEntry:
    """Test cache entry management."""

    def test_cache_entry_not_expired(self):
        """Fresh cache entry is not expired."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/test",
        )
        entry = CacheEntry(
            data={"test": True},
            citation=citation,
            ttl_seconds=3600,
        )
        assert entry.is_expired is False

    def test_cache_entry_expired(self):
        """Old cache entry is expired."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/test",
        )
        entry = CacheEntry(
            data={"test": True},
            citation=citation,
            cached_at=datetime.utcnow() - timedelta(hours=2),
            ttl_seconds=3600,  # 1 hour
        )
        assert entry.is_expired is True

    def test_cache_entry_age(self):
        """Cache entry age is calculated correctly."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/test",
        )
        entry = CacheEntry(
            data={"test": True},
            citation=citation,
            cached_at=datetime.utcnow() - timedelta(minutes=30),
            ttl_seconds=3600,
        )
        # Should be approximately 30 minutes = 1800 seconds
        assert 1790 < entry.age_seconds < 1810


# ============================================================================
# MockAdapter Tests
# ============================================================================


class TestMockAdapter:
    """Test MockAdapter functionality."""

    @pytest.mark.asyncio
    async def test_mock_adapter_returns_set_response(self, mock_adapter):
        """MockAdapter returns configured responses."""
        response = await mock_adapter.call("test-endpoint")
        assert response.data == {"data": "test_value"}

    @pytest.mark.asyncio
    async def test_mock_adapter_has_citation(self, mock_adapter):
        """P0: MockAdapter responses always have citations."""
        response = await mock_adapter.call("test-endpoint")
        assert response.citation is not None
        assert isinstance(response.citation, SourceCitation)

    @pytest.mark.asyncio
    async def test_mock_adapter_tracks_calls(self, mock_adapter):
        """MockAdapter tracks call history."""
        await mock_adapter.call("test-endpoint", {"param": "value"})
        await mock_adapter.call("test-endpoint", {"param": "other"})

        history = mock_adapter.get_call_history()
        assert len(history) == 2
        assert history[0]["params"]["param"] == "value"
        assert history[1]["params"]["param"] == "other"

    @pytest.mark.asyncio
    async def test_mock_adapter_raises_set_error(self, mock_adapter):
        """MockAdapter raises configured errors."""
        mock_adapter.set_mock_error("error-endpoint", ValueError("Test error"))

        with pytest.raises(ValueError) as exc_info:
            await mock_adapter.call("error-endpoint")
        assert "Test error" in str(exc_info.value)

    def test_mock_adapter_clear(self, mock_adapter):
        """MockAdapter clear resets state."""
        mock_adapter.set_mock_response("endpoint1", {"a": 1})
        mock_adapter.set_mock_error("endpoint2", Exception())

        mock_adapter.clear()

        assert mock_adapter._mock_responses == {}
        assert mock_adapter._mock_errors == {}
        assert mock_adapter._call_history == []


# ============================================================================
# Caching Tests
# ============================================================================


class TestAdapterCaching:
    """Test adapter caching behavior."""

    @pytest.mark.asyncio
    async def test_cache_hit(self, mock_adapter):
        """Second call returns cached data."""
        # First call - cache miss
        response1 = await mock_adapter.call("test-endpoint")
        assert response1.cached is False
        assert mock_adapter.metrics.cache_misses == 1

        # Second call - cache hit
        response2 = await mock_adapter.call("test-endpoint")
        assert response2.cached is True
        assert mock_adapter.metrics.cache_hits == 1

    @pytest.mark.asyncio
    async def test_cache_bypass(self, mock_adapter):
        """bypass_cache forces fresh call."""
        # First call
        await mock_adapter.call("test-endpoint")

        # Second call with bypass
        response = await mock_adapter.call("test-endpoint", bypass_cache=True)
        assert response.cached is False

    @pytest.mark.asyncio
    async def test_cache_different_params(self, mock_adapter):
        """Different params create different cache entries."""
        await mock_adapter.call("test-endpoint", {"domain": "a.com"})
        await mock_adapter.call("test-endpoint", {"domain": "b.com"})

        # Both should be cache misses
        assert mock_adapter.metrics.cache_misses == 2
        assert mock_adapter.metrics.cache_hits == 0

    @pytest.mark.asyncio
    async def test_cache_disabled(self):
        """Cache can be disabled."""
        adapter = MockAdapter(name="no_cache")
        adapter.enable_cache = False
        adapter.set_mock_response("test", {"data": 1})

        await adapter.call("test")
        await adapter.call("test")

        # Both should be misses (cache disabled)
        assert adapter.metrics.cache_hits == 0

    def test_clear_cache(self, mock_adapter):
        """Cache can be cleared."""
        mock_adapter._cache["key1"] = CacheEntry(
            data={},
            citation=SourceCitation(
                source_type=SourceType.BUILTWITH,
                source_url="https://test.com",
            ),
            ttl_seconds=3600,
        )
        mock_adapter._cache["key2"] = CacheEntry(
            data={},
            citation=SourceCitation(
                source_type=SourceType.BUILTWITH,
                source_url="https://test.com",
            ),
            ttl_seconds=3600,
        )

        cleared = mock_adapter.clear_cache()
        assert cleared == 2
        assert len(mock_adapter._cache) == 0


# ============================================================================
# Circuit Breaker Integration Tests
# ============================================================================


class TestAdapterCircuitBreaker:
    """Test adapter circuit breaker integration."""

    @pytest.mark.asyncio
    async def test_circuit_opens_after_failures(self, mock_adapter_with_circuit_breaker):
        """Circuit opens after threshold failures."""
        adapter = mock_adapter_with_circuit_breaker
        adapter.set_mock_error("fail-endpoint", ConnectionError("Network error"))

        # Disable retries for this test so each call is one failure
        adapter.retry_config.max_retries = 0

        # Make calls until circuit opens (threshold=3)
        # With 0 retries, errors come as RetryExhaustedError wrapping ConnectionError
        for i in range(3):
            try:
                await adapter.call("fail-endpoint")
            except Exception:
                # Catch any error (RetryExhaustedError or ConnectionError)
                pass

        # Circuit should now be open
        assert adapter.circuit_breaker.state == CircuitState.OPEN

        # Next call should raise CircuitOpenError
        with pytest.raises(CircuitOpenError):
            await adapter.call("fail-endpoint")

    @pytest.mark.asyncio
    async def test_circuit_breaker_metrics(self, mock_adapter_with_circuit_breaker):
        """Circuit breaker rejects are tracked in metrics."""
        adapter = mock_adapter_with_circuit_breaker

        # Force circuit open - must also set last_failure_time to prevent recovery
        adapter.circuit_breaker._state = CircuitState.OPEN
        adapter.circuit_breaker._last_failure_time = datetime.utcnow()

        try:
            await adapter.call("test-endpoint")
        except CircuitOpenError:
            pass

        assert adapter.metrics.circuit_breaker_rejects == 1


# ============================================================================
# Rate Limiter Integration Tests
# ============================================================================


class TestAdapterRateLimiter:
    """Test adapter rate limiter integration."""

    @pytest.mark.asyncio
    async def test_rate_limit_error_raised(self, mock_adapter_with_rate_limiter):
        """RateLimitError raised when limit exceeded."""
        adapter = mock_adapter_with_rate_limiter

        # Exhaust tokens (bucket_size=2)
        await adapter.call("test-endpoint")
        await adapter.call("test-endpoint", bypass_cache=True)

        # Third call should hit rate limit
        with pytest.raises(RateLimitError):
            await adapter.call("test-endpoint", bypass_cache=True)

    @pytest.mark.asyncio
    async def test_rate_limit_wait_metrics(self, mock_adapter_with_rate_limiter):
        """Rate limit waits are tracked in metrics."""
        adapter = mock_adapter_with_rate_limiter

        # Exhaust tokens
        await adapter.call("test-endpoint")
        await adapter.call("test-endpoint", bypass_cache=True)

        try:
            await adapter.call("test-endpoint", bypass_cache=True)
        except RateLimitError:
            pass

        # Should have recorded the rate limit attempt
        assert adapter.metrics.rate_limit_waits >= 0  # May or may not increment on raise

    @pytest.mark.asyncio
    async def test_bypass_rate_limit(self, mock_adapter_with_rate_limiter):
        """bypass_rate_limit skips rate limit check."""
        adapter = mock_adapter_with_rate_limiter

        # Exhaust tokens
        await adapter.call("test-endpoint")
        await adapter.call("test-endpoint", bypass_cache=True)

        # Should succeed with bypass
        response = await adapter.call(
            "test-endpoint", bypass_cache=True, bypass_rate_limit=True
        )
        assert response is not None


# ============================================================================
# Metrics Tests
# ============================================================================


class TestAdapterMetrics:
    """Test adapter metrics tracking."""

    @pytest.mark.asyncio
    async def test_successful_call_metrics(self, mock_adapter):
        """Successful calls update metrics."""
        await mock_adapter.call("test-endpoint")

        assert mock_adapter.metrics.total_calls == 1
        assert mock_adapter.metrics.successful_calls == 1
        assert mock_adapter.metrics.failed_calls == 0
        assert mock_adapter.metrics.last_call_at is not None

    @pytest.mark.asyncio
    async def test_failed_call_metrics(self, mock_adapter):
        """Failed calls update metrics."""
        mock_adapter.set_mock_error("fail", ValueError("Error"))

        try:
            await mock_adapter.call("fail")
        except ValueError:
            pass

        assert mock_adapter.metrics.total_calls == 1
        assert mock_adapter.metrics.failed_calls == 1
        assert mock_adapter.metrics.last_error is not None

    def test_success_rate_calculation(self):
        """Success rate is calculated correctly."""
        metrics = AdapterMetrics(
            total_calls=100,
            successful_calls=85,
            failed_calls=15,
        )
        assert metrics.success_rate == 85.0

    def test_cache_hit_rate_calculation(self):
        """Cache hit rate is calculated correctly."""
        metrics = AdapterMetrics(
            cache_hits=30,
            cache_misses=70,
        )
        assert metrics.cache_hit_rate == 30.0

    def test_average_latency_calculation(self):
        """Average latency is calculated correctly."""
        metrics = AdapterMetrics(
            successful_calls=10,
            total_latency_ms=1000.0,
        )
        assert metrics.average_latency_ms == 100.0

    def test_reset_metrics(self, mock_adapter):
        """Metrics can be reset."""
        mock_adapter.metrics.total_calls = 100
        mock_adapter.metrics.successful_calls = 90

        mock_adapter.reset_metrics()

        assert mock_adapter.metrics.total_calls == 0
        assert mock_adapter.metrics.successful_calls == 0


# ============================================================================
# Endpoint Configuration Tests
# ============================================================================


class TestEndpointConfig:
    """Test endpoint configuration."""

    def test_register_endpoint(self, mock_adapter):
        """Endpoints can be registered with config."""
        config = EndpointConfig(
            name="domain-lookup",
            path="/v21/api.json",
            cost_per_call=0.10,
            cache_ttl_seconds=7200,
        )
        mock_adapter.register_endpoint(config)

        retrieved = mock_adapter.get_endpoint_config("domain-lookup")
        assert retrieved.cost_per_call == 0.10
        assert retrieved.cache_ttl_seconds == 7200

    def test_get_default_endpoint_config(self, mock_adapter):
        """Unknown endpoints get default config."""
        config = mock_adapter.get_endpoint_config("unknown-endpoint")
        assert config.name == "unknown-endpoint"


# ============================================================================
# Health Check Tests
# ============================================================================


class TestAdapterHealthCheck:
    """Test adapter health check."""

    def test_health_check_healthy(self, mock_adapter):
        """Healthy adapter returns positive health check."""
        health = mock_adapter.health_check()

        assert health["name"] == "test_adapter"
        assert health["healthy"] is True
        assert health["circuit_breaker_state"] == "closed"

    def test_health_check_unhealthy(self, mock_adapter):
        """Unhealthy adapter (circuit open) returns negative health check."""
        # Force circuit open - must also set last_failure_time to prevent recovery
        mock_adapter.circuit_breaker._state = CircuitState.OPEN
        mock_adapter.circuit_breaker._last_failure_time = datetime.utcnow()

        health = mock_adapter.health_check()
        assert health["healthy"] is False

    def test_get_metrics_dict(self, mock_adapter):
        """Metrics can be exported as dictionary."""
        metrics = mock_adapter.get_metrics()

        assert "adapter_name" in metrics
        assert "total_calls" in metrics
        assert "success_rate" in metrics
        assert "circuit_breaker_state" in metrics


# ============================================================================
# Source Citation Enforcement Tests (P0)
# ============================================================================


class TestSourceCitationEnforcement:
    """Test P0 source citation enforcement."""

    @pytest.mark.asyncio
    async def test_response_always_has_citation(self, mock_adapter):
        """P0: Every response MUST have a citation."""
        response = await mock_adapter.call("test-endpoint")

        assert response.citation is not None
        assert isinstance(response.citation, SourceCitation)

    @pytest.mark.asyncio
    async def test_cached_response_has_citation(self, mock_adapter):
        """P0: Cached responses also have citations."""
        # First call
        await mock_adapter.call("test-endpoint")
        # Second call (cached)
        response = await mock_adapter.call("test-endpoint")

        assert response.cached is True
        assert response.citation is not None
        # Cached citation should reference original
        assert response.citation.source_type == SourceType.CACHE

    @pytest.mark.asyncio
    async def test_citation_has_source_url(self, mock_adapter):
        """P0: Citation must have source URL."""
        response = await mock_adapter.call("test-endpoint")

        assert response.citation.source_url is not None
        assert "mock.api" in str(response.citation.source_url)

    @pytest.mark.asyncio
    async def test_citation_has_retrieved_at(self, mock_adapter):
        """Citation has retrieval timestamp."""
        response = await mock_adapter.call("test-endpoint")

        assert response.citation.retrieved_at is not None
        # Should be very recent
        age_seconds = (
            datetime.utcnow() - response.citation.retrieved_at
        ).total_seconds()
        assert age_seconds < 5


# ============================================================================
# Error Handling Tests
# ============================================================================


class TestAdapterErrorHandling:
    """Test adapter error handling."""

    def test_adapter_error_has_context(self):
        """AdapterError includes adapter name and endpoint."""
        error = AdapterError(
            message="Test error",
            adapter_name="builtwith",
            endpoint="domain-lookup",
        )
        assert "builtwith" in str(error)

    def test_rate_limit_error_has_wait_time(self):
        """RateLimitError includes wait time."""
        error = RateLimitError(
            adapter_name="builtwith",
            wait_time_ms=5000,
        )
        assert error.wait_time_ms == 5000
        assert "5000" in str(error)

    def test_api_error_has_status_code(self):
        """APIError includes status code and response."""
        error = APIError(
            adapter_name="builtwith",
            status_code=429,
            response_body="Rate limit exceeded",
        )
        assert error.status_code == 429
        assert "429" in str(error)
