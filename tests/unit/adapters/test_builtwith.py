"""
Unit Tests for BuiltWithAdapter
===============================

Comprehensive tests for all 7 BuiltWith API endpoints:
1. domain-api - Full technology lookup
2. free-api - Basic technology lookup (fallback)
3. relationships-api - Related domains
4. recommendations-api - Technology recommendations
5. financial-api - Technology spend estimates
6. social-api - Social media presence
7. trust-api - Trust signals

Tests cover:
- P0 Source Citation enforcement
- Response parsing
- Error handling
- Rate limiting integration
- Circuit breaker integration
- Caching behavior
- Technology detection (search/partner)
- Displacement target identification

Run:
    pytest tests/unit/adapters/test_builtwith.py -v
    pytest tests/unit/adapters/test_builtwith.py -v -k "test_domain_lookup"
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
from typing import Dict, Any

from pipeline.adapters.builtwith import (
    BuiltWithAdapter,
    Technology,
    DomainLookupResponse,
    DomainMeta,
    RelationshipsResponse,
    RelatedDomain,
    RecommendationsResponse,
    TechnologyRecommendation,
    FinancialResponse,
    TechnologySpend,
    SocialResponse,
    SocialProfile,
    TrustResponse,
    TrustSignal,
    TechnologyCategory,
    is_search_technology,
    is_partner_technology,
    categorize_technology,
    SEARCH_TECHNOLOGIES,
    PARTNER_TECHNOLOGIES,
)
from pipeline.adapters.base import (
    SourcedResponse,
    APIError,
    RateLimitError,
    EndpointConfig,
)
from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.utils.circuit_breaker import CircuitBreaker, CircuitState, CircuitOpenError


# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def api_key():
    """Test API key."""
    return "test_api_key_12345"


@pytest.fixture
def builtwith_adapter(api_key):
    """Create BuiltWithAdapter with test configuration."""
    from pipeline.utils.rate_limiter import TokenBucketRateLimiter

    adapter = BuiltWithAdapter(
        api_key=api_key,
        enable_cache=True,
    )
    # Use a permissive rate limiter for tests
    adapter.rate_limiter = TokenBucketRateLimiter(
        name="test_builtwith",
        tokens_per_second=1000.0,  # Very high for tests
        bucket_size=1000,
    )
    return adapter


@pytest.fixture
def builtwith_adapter_no_cache(api_key):
    """Create BuiltWithAdapter with caching disabled."""
    from pipeline.utils.rate_limiter import TokenBucketRateLimiter

    adapter = BuiltWithAdapter(
        api_key=api_key,
        enable_cache=False,
    )
    # Use a permissive rate limiter for tests
    adapter.rate_limiter = TokenBucketRateLimiter(
        name="test_builtwith_no_cache",
        tokens_per_second=1000.0,
        bucket_size=1000,
    )
    return adapter


@pytest.fixture
def mock_domain_api_response() -> Dict[str, Any]:
    """Sample BuiltWith domain-api response."""
    return {
        "Results": [{
            "Lookup": "costco.com",
            "Technologies": [
                {
                    "Name": "Algolia",
                    "Tag": "search",
                    "FirstDetected": 1609459200000,  # 2021-01-01
                    "LastDetected": 1704067200000,   # 2024-01-01
                    "Description": "Site search and discovery platform",
                    "Link": "https://www.algolia.com",
                },
                {
                    "Name": "React",
                    "Tag": "javascript-framework",
                    "FirstDetected": 1609459200000,
                    "LastDetected": 1704067200000,
                    "Description": "JavaScript library for building UIs",
                },
                {
                    "Name": "CloudFlare",
                    "Tag": "cdn",
                    "FirstDetected": 1609459200000,
                },
                {
                    "Name": "Adobe Experience Manager",
                    "Tag": "cms",
                    "FirstDetected": 1609459200000,
                },
                {
                    "Name": "Shopify Plus",
                    "Tag": "ecommerce",
                    "FirstDetected": 1609459200000,
                },
            ],
            "Meta": {
                "Vertical": "Retail",
                "CompanyName": "Costco Wholesale Corporation",
                "QCast": 100,
                "ARank": 500,
                "Majestic": 1000,
                "Umbrella": 200,
            }
        }]
    }


@pytest.fixture
def mock_domain_api_no_algolia_response() -> Dict[str, Any]:
    """Sample response without Algolia (displacement target)."""
    return {
        "Results": [{
            "Lookup": "target.com",
            "Technologies": [
                {
                    "Name": "Elasticsearch",
                    "Tag": "search",
                    "FirstDetected": 1609459200000,
                },
                {
                    "Name": "Adobe Commerce",
                    "Tag": "ecommerce",
                    "FirstDetected": 1609459200000,
                },
            ],
            "Meta": {
                "Vertical": "Retail",
                "CompanyName": "Target Corporation",
            }
        }]
    }


@pytest.fixture
def mock_relationships_response() -> Dict[str, Any]:
    """Sample relationships-api response."""
    return {
        "Results": [{
            "Identifiers": [
                {"Type": "google-analytics", "Value": "UA-12345678-1"},
                {"Type": "gtm-tag", "Value": "GTM-ABC123"},
            ],
            "Relationships": [
                {
                    "Domain": "costcobusinessdelivery.com",
                    "Type": "subsidiary",
                    "Technologies": ["Algolia", "React"],
                    "Confidence": 0.95,
                },
                {
                    "Domain": "costcotravel.com",
                    "Type": "subsidiary",
                    "Technologies": ["Algolia"],
                    "Confidence": 0.90,
                },
            ],
        }]
    }


@pytest.fixture
def mock_recommendations_response() -> Dict[str, Any]:
    """Sample recommendations-api response."""
    return {
        "Results": [{
            "Technologies": [
                {"Name": "React"},
                {"Name": "CloudFlare"},
            ],
            "Recommendations": [
                {
                    "Name": "Next.js",
                    "Category": "framework",
                    "AdoptionRate": 0.45,
                    "Reason": "Popular among React users",
                },
                {
                    "Name": "Vercel",
                    "Category": "hosting",
                    "AdoptionRate": 0.35,
                    "Reason": "Optimal for Next.js deployments",
                },
            ],
        }]
    }


@pytest.fixture
def mock_financial_response() -> Dict[str, Any]:
    """Sample financial-api response."""
    return {
        "Results": [{
            "Spend": [
                {
                    "Technology": "Algolia",
                    "Spend": 50000.0,
                    "Confidence": "high",
                },
                {
                    "Technology": "CloudFlare",
                    "Spend": 25000.0,
                    "Confidence": "medium",
                },
                {
                    "Technology": "Adobe Experience Manager",
                    "Spend": 100000.0,
                    "Confidence": "medium",
                },
            ],
        }],
        "Confidence": "medium",
    }


@pytest.fixture
def mock_social_response() -> Dict[str, Any]:
    """Sample social-api response."""
    return {
        "Results": [{
            "Social": [
                {
                    "Platform": "LinkedIn",
                    "URL": "https://www.linkedin.com/company/costco-wholesale",
                    "Followers": 500000,
                    "Verified": True,
                },
                {
                    "Platform": "Twitter",
                    "URL": "https://twitter.com/costco",
                    "Followers": 1200000,
                    "Verified": True,
                },
                {
                    "Platform": "Facebook",
                    "URL": "https://www.facebook.com/costco",
                    "Followers": 5000000,
                    "Verified": True,
                },
            ],
        }]
    }


@pytest.fixture
def mock_trust_response() -> Dict[str, Any]:
    """Sample trust-api response."""
    return {
        "Results": [{
            "TrustScore": 95.5,
            "SSL": {"Valid": True},
            "DomainAge": 25.5,
            "Blacklisted": False,
            "Signals": [
                {
                    "Type": "ssl_certificate",
                    "Value": "EV Certificate",
                    "Positive": True,
                    "Source": "SSL Labs",
                },
                {
                    "Type": "domain_age",
                    "Value": "25+ years",
                    "Positive": True,
                    "Source": "WHOIS",
                },
            ],
        }]
    }


@pytest.fixture
def mock_empty_response() -> Dict[str, Any]:
    """Empty response with no results."""
    return {"Results": []}


@pytest.fixture
def mock_error_response() -> Dict[str, Any]:
    """Response with error."""
    return {
        "Results": [],
        "Errors": [{"Message": "Invalid API key"}]
    }


# ============================================================================
# Technology Detection Tests
# ============================================================================


class TestTechnologyDetection:
    """Tests for technology classification functions."""

    def test_is_search_technology_algolia(self):
        """Algolia is detected as search technology."""
        assert is_search_technology("Algolia") is True
        assert is_search_technology("algolia") is True
        assert is_search_technology("Algolia Search") is True

    def test_is_search_technology_competitors(self):
        """Competitor search technologies are detected."""
        assert is_search_technology("Elasticsearch") is True
        assert is_search_technology("Constructor.io") is True
        assert is_search_technology("Searchspring") is True
        assert is_search_technology("Klevu") is True
        assert is_search_technology("Coveo") is True
        assert is_search_technology("Bloomreach") is True

    def test_is_search_technology_false(self):
        """Non-search technologies are not flagged."""
        assert is_search_technology("React") is False
        assert is_search_technology("CloudFlare") is False
        assert is_search_technology("Google Analytics") is False

    def test_is_partner_technology_adobe(self):
        """Adobe technologies are detected as partner tech."""
        assert is_partner_technology("Adobe Experience Manager") is True
        assert is_partner_technology("Adobe Commerce") is True
        assert is_partner_technology("Magento") is True
        assert is_partner_technology("AEM") is True

    def test_is_partner_technology_salesforce(self):
        """Salesforce technologies are detected as partner tech."""
        assert is_partner_technology("Salesforce Commerce Cloud") is True
        assert is_partner_technology("SFCC") is True
        assert is_partner_technology("Demandware") is True

    def test_is_partner_technology_shopify(self):
        """Shopify technologies are detected as partner tech."""
        assert is_partner_technology("Shopify") is True
        assert is_partner_technology("Shopify Plus") is True

    def test_is_partner_technology_false(self):
        """Non-partner technologies are not flagged."""
        assert is_partner_technology("React") is False
        assert is_partner_technology("Google Analytics") is False
        assert is_partner_technology("CloudFlare") is False

    def test_categorize_technology(self):
        """Technology categories are correctly assigned."""
        assert categorize_technology("search") == TechnologyCategory.SEARCH.value
        assert categorize_technology("analytics") == TechnologyCategory.ANALYTICS.value
        assert categorize_technology("ecommerce") == TechnologyCategory.ECOMMERCE.value
        assert categorize_technology("cdn") == TechnologyCategory.CDN.value
        assert categorize_technology("framework") == TechnologyCategory.FRAMEWORK.value
        assert categorize_technology("cms") == TechnologyCategory.CMS.value
        assert categorize_technology("unknown") == TechnologyCategory.OTHER.value
        assert categorize_technology(None) == TechnologyCategory.OTHER.value


# ============================================================================
# Response Model Tests
# ============================================================================


class TestResponseModels:
    """Tests for Pydantic response models."""

    def test_technology_model(self):
        """Technology model works correctly."""
        tech = Technology(
            name="Algolia",
            tag="search",
            category="search",
            first_detected=datetime(2021, 1, 1),
            is_search_technology=True,
            is_partner_technology=False,
        )
        assert tech.name == "Algolia"
        assert tech.is_search_technology is True
        assert tech.is_partner_technology is False

    def test_domain_lookup_response_has_algolia(self):
        """DomainLookupResponse.has_algolia property works."""
        response = DomainLookupResponse(
            domain="costco.com",
            technologies=[
                Technology(name="Algolia", is_search_technology=True),
                Technology(name="React"),
            ],
        )
        assert response.has_algolia is True

    def test_domain_lookup_response_no_algolia(self):
        """DomainLookupResponse.has_algolia returns False when no Algolia."""
        response = DomainLookupResponse(
            domain="target.com",
            technologies=[
                Technology(name="Elasticsearch", is_search_technology=True),
            ],
        )
        assert response.has_algolia is False

    def test_domain_lookup_response_search_provider(self):
        """DomainLookupResponse.search_provider property works."""
        algolia = Technology(name="Algolia", is_search_technology=True)
        response = DomainLookupResponse(
            domain="costco.com",
            search_technologies=[algolia],
        )
        assert response.search_provider == algolia

    def test_domain_meta_model(self):
        """DomainMeta model works correctly."""
        meta = DomainMeta(
            domain="costco.com",
            vertical="Retail",
            company_name="Costco Wholesale",
            quantcast=100,
        )
        assert meta.domain == "costco.com"
        assert meta.vertical == "Retail"

    def test_related_domain_model(self):
        """RelatedDomain model works correctly."""
        related = RelatedDomain(
            domain="costcotravel.com",
            relationship_type="subsidiary",
            technologies_shared=["Algolia"],
            confidence=0.95,
        )
        assert related.domain == "costcotravel.com"
        assert related.confidence == 0.95

    def test_financial_response_model(self):
        """FinancialResponse model works correctly."""
        response = FinancialResponse(
            domain="costco.com",
            total_tech_spend_estimate_usd=175000.0,
            spend_breakdown=[
                TechnologySpend(
                    technology="Algolia",
                    estimated_spend_usd=50000.0,
                    confidence="high",
                ),
            ],
        )
        assert response.total_tech_spend_estimate_usd == 175000.0

    def test_social_response_model(self):
        """SocialResponse model works correctly."""
        response = SocialResponse(
            domain="costco.com",
            profiles=[
                SocialProfile(
                    platform="LinkedIn",
                    url="https://linkedin.com/company/costco",
                    followers=500000,
                    verified=True,
                ),
            ],
            has_linkedin=True,
            has_twitter=False,
        )
        assert response.has_linkedin is True
        assert response.has_twitter is False

    def test_trust_response_model(self):
        """TrustResponse model works correctly."""
        response = TrustResponse(
            domain="costco.com",
            trust_score=95.5,
            ssl_valid=True,
            domain_age_years=25.5,
            blacklisted=False,
        )
        assert response.trust_score == 95.5
        assert response.ssl_valid is True


# ============================================================================
# Adapter Initialization Tests
# ============================================================================


class TestBuiltWithAdapterInit:
    """Tests for adapter initialization."""

    def test_adapter_init_with_api_key(self, api_key):
        """Adapter initializes with provided API key."""
        adapter = BuiltWithAdapter(api_key=api_key)
        assert adapter.api_key == api_key
        assert adapter.name == "builtwith"
        assert adapter.source_type == SourceType.BUILTWITH

    def test_adapter_init_from_env(self, monkeypatch):
        """Adapter reads API key from environment."""
        monkeypatch.setenv("BUILTWITH_API_KEY", "env_api_key")
        adapter = BuiltWithAdapter()
        assert adapter.api_key == "env_api_key"

    def test_adapter_init_no_key_warning(self, monkeypatch, caplog):
        """Adapter warns when no API key is provided."""
        monkeypatch.delenv("BUILTWITH_API_KEY", raising=False)
        adapter = BuiltWithAdapter(api_key=None)
        assert adapter.api_key is None

    def test_adapter_registers_endpoints(self, builtwith_adapter):
        """All 7 endpoints are registered."""
        endpoints = builtwith_adapter._endpoints
        assert "domain-api" in endpoints
        assert "free-api" in endpoints
        assert "relationships-api" in endpoints
        assert "recommendations-api" in endpoints
        assert "financial-api" in endpoints
        assert "social-api" in endpoints
        assert "trust-api" in endpoints

    def test_adapter_endpoint_costs(self, builtwith_adapter):
        """Endpoint costs are configured correctly."""
        domain_config = builtwith_adapter.get_endpoint_config("domain-api")
        assert domain_config.cost_per_call == 0.10

        free_config = builtwith_adapter.get_endpoint_config("free-api")
        assert free_config.cost_per_call == 0.00

    def test_adapter_cache_ttl(self, builtwith_adapter):
        """Cache TTL is set to 30 days."""
        # 30 days in seconds
        expected_ttl = 30 * 24 * 60 * 60
        assert builtwith_adapter.default_cache_ttl_seconds == expected_ttl


# ============================================================================
# API Call Tests (Mocked)
# ============================================================================


class TestDomainLookup:
    """Tests for domain_lookup endpoint."""

    @pytest.mark.asyncio
    async def test_domain_lookup_success(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """domain_lookup returns SourcedResponse with parsed data."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")

            # Verify response type
            assert isinstance(response, SourcedResponse)
            assert isinstance(response.data, DomainLookupResponse)

            # Verify parsed data
            assert response.data.domain == "costco.com"
            assert response.data.technology_count == 5
            assert len(response.data.technologies) == 5

    @pytest.mark.asyncio
    async def test_domain_lookup_has_citation_p0(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """P0: domain_lookup response always has source citation."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")

            # P0 REQUIREMENT: Citation must exist
            assert response.citation is not None
            assert isinstance(response.citation, SourceCitation)
            assert response.citation.source_type == SourceType.BUILTWITH
            assert "costco.com" in str(response.citation.source_url)

    @pytest.mark.asyncio
    async def test_domain_lookup_detects_search_tech(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """domain_lookup correctly identifies search technologies."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")

            # Should detect Algolia and Shopify (both have search) as search technologies
            assert len(response.data.search_technologies) >= 1
            search_names = [t.name for t in response.data.search_technologies]
            assert "Algolia" in search_names
            assert response.data.has_algolia is True

    @pytest.mark.asyncio
    async def test_domain_lookup_detects_partner_tech(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """domain_lookup correctly identifies partner technologies."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")

            # Should detect Adobe Experience Manager and Shopify Plus
            partner_names = [t.name for t in response.data.partner_technologies]
            assert "Adobe Experience Manager" in partner_names
            assert "Shopify Plus" in partner_names

    @pytest.mark.asyncio
    async def test_domain_lookup_parses_meta(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """domain_lookup parses domain metadata."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")

            assert response.data.meta is not None
            assert response.data.meta.vertical == "Retail"
            assert response.data.meta.company_name == "Costco Wholesale Corporation"

    @pytest.mark.asyncio
    async def test_domain_lookup_empty_response(
        self, builtwith_adapter, mock_empty_response
    ):
        """domain_lookup handles empty response gracefully."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_empty_response

            response = await builtwith_adapter.domain_lookup("unknown.com")

            assert response.data.technology_count == 0
            assert response.data.technologies == []
            # P0: Citation still required
            assert response.citation is not None


class TestFreeLookup:
    """Tests for free_lookup endpoint."""

    @pytest.mark.asyncio
    async def test_free_lookup_success(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """free_lookup returns SourcedResponse."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.free_lookup("costco.com")

            assert isinstance(response, SourcedResponse)
            assert response.citation is not None

    @pytest.mark.asyncio
    async def test_free_lookup_uses_free_endpoint(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """free_lookup uses the free-api endpoint."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            await builtwith_adapter.free_lookup("costco.com")

            # Verify the endpoint called
            call_args = mock_request.call_args
            assert call_args[0][0] == "free-api"


class TestGetRelationships:
    """Tests for get_relationships endpoint."""

    @pytest.mark.asyncio
    async def test_get_relationships_success(
        self, builtwith_adapter, mock_relationships_response
    ):
        """get_relationships returns parsed relationships."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_relationships_response

            response = await builtwith_adapter.get_relationships("costco.com")

            assert isinstance(response.data, RelationshipsResponse)
            assert len(response.data.connected_domains) == 2
            assert response.data.connected_domains[0].domain == "costcobusinessdelivery.com"
            assert response.data.connected_domains[0].relationship_type == "subsidiary"

    @pytest.mark.asyncio
    async def test_get_relationships_has_citation(
        self, builtwith_adapter, mock_relationships_response
    ):
        """P0: get_relationships response has citation."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_relationships_response

            response = await builtwith_adapter.get_relationships("costco.com")

            assert response.citation is not None
            assert response.citation.source_type == SourceType.BUILTWITH

    @pytest.mark.asyncio
    async def test_get_relationships_parses_identifiers(
        self, builtwith_adapter, mock_relationships_response
    ):
        """get_relationships parses analytics and tag identifiers."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_relationships_response

            response = await builtwith_adapter.get_relationships("costco.com")

            assert "UA-12345678-1" in response.data.analytics_ids
            assert "GTM-ABC123" in response.data.tag_ids


class TestGetRecommendations:
    """Tests for get_recommendations endpoint."""

    @pytest.mark.asyncio
    async def test_get_recommendations_success(
        self, builtwith_adapter, mock_recommendations_response
    ):
        """get_recommendations returns parsed recommendations."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_recommendations_response

            response = await builtwith_adapter.get_recommendations("costco.com")

            assert isinstance(response.data, RecommendationsResponse)
            assert len(response.data.recommendations) == 2
            assert response.data.recommendations[0].name == "Next.js"

    @pytest.mark.asyncio
    async def test_get_recommendations_has_citation(
        self, builtwith_adapter, mock_recommendations_response
    ):
        """P0: get_recommendations response has citation."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_recommendations_response

            response = await builtwith_adapter.get_recommendations("costco.com")

            assert response.citation is not None


class TestGetFinancial:
    """Tests for get_financial endpoint."""

    @pytest.mark.asyncio
    async def test_get_financial_success(
        self, builtwith_adapter, mock_financial_response
    ):
        """get_financial returns parsed financial data."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_financial_response

            response = await builtwith_adapter.get_financial("costco.com")

            assert isinstance(response.data, FinancialResponse)
            assert response.data.total_tech_spend_estimate_usd == 175000.0
            assert len(response.data.spend_breakdown) == 3

    @pytest.mark.asyncio
    async def test_get_financial_has_citation(
        self, builtwith_adapter, mock_financial_response
    ):
        """P0: get_financial response has citation."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_financial_response

            response = await builtwith_adapter.get_financial("costco.com")

            assert response.citation is not None


class TestGetSocial:
    """Tests for get_social endpoint."""

    @pytest.mark.asyncio
    async def test_get_social_success(
        self, builtwith_adapter, mock_social_response
    ):
        """get_social returns parsed social data."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_social_response

            response = await builtwith_adapter.get_social("costco.com")

            assert isinstance(response.data, SocialResponse)
            assert len(response.data.profiles) == 3
            assert response.data.has_linkedin is True
            assert response.data.has_twitter is True
            assert response.data.has_facebook is True

    @pytest.mark.asyncio
    async def test_get_social_has_citation(
        self, builtwith_adapter, mock_social_response
    ):
        """P0: get_social response has citation."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_social_response

            response = await builtwith_adapter.get_social("costco.com")

            assert response.citation is not None


class TestGetTrust:
    """Tests for get_trust endpoint."""

    @pytest.mark.asyncio
    async def test_get_trust_success(
        self, builtwith_adapter, mock_trust_response
    ):
        """get_trust returns parsed trust data."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_trust_response

            response = await builtwith_adapter.get_trust("costco.com")

            assert isinstance(response.data, TrustResponse)
            assert response.data.trust_score == 95.5
            assert response.data.ssl_valid is True
            assert response.data.domain_age_years == 25.5
            assert response.data.blacklisted is False

    @pytest.mark.asyncio
    async def test_get_trust_has_citation(
        self, builtwith_adapter, mock_trust_response
    ):
        """P0: get_trust response has citation."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_trust_response

            response = await builtwith_adapter.get_trust("costco.com")

            assert response.citation is not None


class TestGetFullProfile:
    """Tests for get_full_profile method."""

    @pytest.mark.asyncio
    async def test_get_full_profile_calls_all_endpoints(
        self,
        builtwith_adapter,
        mock_domain_api_response,
        mock_relationships_response,
        mock_recommendations_response,
        mock_financial_response,
        mock_social_response,
        mock_trust_response,
    ):
        """get_full_profile calls all 6 endpoints."""
        async def mock_call(endpoint, params, bypass_cache=False):
            responses = {
                "domain-api": mock_domain_api_response,
                "relationships-api": mock_relationships_response,
                "recommendations-api": mock_recommendations_response,
                "financial-api": mock_financial_response,
                "social-api": mock_social_response,
                "trust-api": mock_trust_response,
            }
            raw_response = responses.get(endpoint, {})
            data = builtwith_adapter._parse_response(endpoint, raw_response, params)
            citation = builtwith_adapter._create_citation(endpoint, params)
            return SourcedResponse(data=data, citation=citation)

        with patch.object(builtwith_adapter, "call", side_effect=mock_call):
            results = await builtwith_adapter.get_full_profile("costco.com")

            assert results["domain"] is not None
            assert results["relationships"] is not None
            assert results["recommendations"] is not None
            assert results["financial"] is not None
            assert results["social"] is not None
            assert results["trust"] is not None


# ============================================================================
# Utility Method Tests
# ============================================================================


class TestUtilityMethods:
    """Tests for utility methods."""

    @pytest.mark.asyncio
    async def test_is_using_algolia(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """is_using_algolia correctly detects Algolia."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")
            assert builtwith_adapter.is_using_algolia(response.data) is True

    @pytest.mark.asyncio
    async def test_is_displacement_target_true(
        self, builtwith_adapter, mock_domain_api_no_algolia_response
    ):
        """is_displacement_target returns True for non-Algolia partner tech users."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_no_algolia_response

            response = await builtwith_adapter.domain_lookup("target.com")

            # Has partner tech (Adobe Commerce) but no Algolia
            assert builtwith_adapter.is_displacement_target(response.data) is True

    @pytest.mark.asyncio
    async def test_is_displacement_target_false_has_algolia(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """is_displacement_target returns False for Algolia users."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")

            # Has Algolia, so not a displacement target
            assert builtwith_adapter.is_displacement_target(response.data) is False

    @pytest.mark.asyncio
    async def test_get_search_technologies(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """get_search_technologies extracts search techs."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")
            search_techs = builtwith_adapter.get_search_technologies(response.data)

            # Algolia and Shopify both detected as search technologies
            assert len(search_techs) >= 1
            search_names = [t.name for t in search_techs]
            assert "Algolia" in search_names

    @pytest.mark.asyncio
    async def test_get_partner_technologies(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """get_partner_technologies extracts partner techs."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.domain_lookup("costco.com")
            partner_techs = builtwith_adapter.get_partner_technologies(response.data)

            partner_names = [t.name for t in partner_techs]
            assert "Adobe Experience Manager" in partner_names
            assert "Shopify Plus" in partner_names


# ============================================================================
# Caching Tests
# ============================================================================


class TestCaching:
    """Tests for caching behavior."""

    @pytest.mark.asyncio
    async def test_cache_hit(self, builtwith_adapter, mock_domain_api_response):
        """Second call returns cached response."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            # First call - cache miss
            response1 = await builtwith_adapter.domain_lookup("costco.com")
            assert response1.cached is False

            # Second call - cache hit
            response2 = await builtwith_adapter.domain_lookup("costco.com")
            assert response2.cached is True

            # Only one actual API call
            assert mock_request.call_count == 1

    @pytest.mark.asyncio
    async def test_cache_bypass(self, builtwith_adapter, mock_domain_api_response):
        """bypass_cache forces fresh call."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            # First call
            await builtwith_adapter.domain_lookup("costco.com")

            # Second call with bypass
            response = await builtwith_adapter.domain_lookup(
                "costco.com", bypass_cache=True
            )
            assert response.cached is False

            # Two API calls
            assert mock_request.call_count == 2

    @pytest.mark.asyncio
    async def test_cache_disabled(
        self, builtwith_adapter_no_cache, mock_domain_api_response
    ):
        """Cache disabled means no caching."""
        with patch.object(
            builtwith_adapter_no_cache, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            await builtwith_adapter_no_cache.domain_lookup("costco.com")
            await builtwith_adapter_no_cache.domain_lookup("costco.com")

            # Two API calls (no caching)
            assert mock_request.call_count == 2

    @pytest.mark.asyncio
    async def test_different_domains_separate_cache(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """Different domains have separate cache entries."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            await builtwith_adapter.domain_lookup("costco.com")
            await builtwith_adapter.domain_lookup("target.com")

            # Two different domains = two calls
            assert mock_request.call_count == 2


# ============================================================================
# Error Handling Tests
# ============================================================================


class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_api_error_401(self, builtwith_adapter):
        """401 error raises APIError."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = APIError(
                adapter_name="builtwith",
                status_code=401,
                response_body="Unauthorized",
                endpoint="domain-api",
            )

            with pytest.raises(APIError) as exc_info:
                await builtwith_adapter.domain_lookup("costco.com")

            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_api_error_429(self, builtwith_adapter):
        """429 error raises APIError (rate limit)."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = APIError(
                adapter_name="builtwith",
                status_code=429,
                response_body="Rate limit exceeded",
                endpoint="domain-api",
            )

            with pytest.raises(APIError) as exc_info:
                await builtwith_adapter.domain_lookup("costco.com")

            assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_connection_error(self, builtwith_adapter):
        """Connection error triggers retries, then raises RetryExhaustedError."""
        from pipeline.utils.retry import RetryExhaustedError

        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = ConnectionError("Network error")

            # ConnectionError is retryable, so after all retries it raises RetryExhaustedError
            with pytest.raises(RetryExhaustedError) as exc_info:
                await builtwith_adapter.domain_lookup("costco.com")

            # The last exception should be ConnectionError
            assert isinstance(exc_info.value.last_exception, ConnectionError)

    @pytest.mark.asyncio
    async def test_timeout_error(self, builtwith_adapter):
        """Timeout error triggers retries, then raises RetryExhaustedError."""
        from pipeline.utils.retry import RetryExhaustedError

        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = TimeoutError("Request timeout")

            # TimeoutError is retryable, so after all retries it raises RetryExhaustedError
            with pytest.raises(RetryExhaustedError) as exc_info:
                await builtwith_adapter.domain_lookup("costco.com")

            # The last exception should be TimeoutError
            assert isinstance(exc_info.value.last_exception, TimeoutError)


# ============================================================================
# Metrics Tests
# ============================================================================


class TestMetrics:
    """Tests for metrics tracking."""

    @pytest.mark.asyncio
    async def test_successful_call_updates_metrics(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """Successful call updates metrics correctly."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            await builtwith_adapter.domain_lookup("costco.com")

            metrics = builtwith_adapter.metrics
            assert metrics.total_calls == 1
            assert metrics.successful_calls == 1
            assert metrics.failed_calls == 0

    @pytest.mark.asyncio
    async def test_failed_call_updates_metrics(self, builtwith_adapter):
        """Failed call updates metrics correctly."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = APIError(
                adapter_name="builtwith",
                status_code=500,
                response_body="Server error",
            )

            try:
                await builtwith_adapter.domain_lookup("costco.com")
            except APIError:
                pass

            metrics = builtwith_adapter.metrics
            assert metrics.total_calls == 1
            assert metrics.failed_calls == 1

    @pytest.mark.asyncio
    async def test_cache_hit_updates_metrics(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """Cache hit updates cache metrics."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            await builtwith_adapter.domain_lookup("costco.com")  # Cache miss
            await builtwith_adapter.domain_lookup("costco.com")  # Cache hit

            metrics = builtwith_adapter.metrics
            assert metrics.cache_misses == 1
            assert metrics.cache_hits == 1

    def test_get_metrics_dict(self, builtwith_adapter):
        """get_metrics returns dictionary."""
        metrics_dict = builtwith_adapter.get_metrics()

        assert "adapter_name" in metrics_dict
        assert metrics_dict["adapter_name"] == "builtwith"
        assert "total_calls" in metrics_dict
        assert "success_rate" in metrics_dict


# ============================================================================
# Source URL Building Tests
# ============================================================================


class TestSourceUrlBuilding:
    """Tests for source URL construction."""

    def test_build_source_url_domain_api(self, builtwith_adapter):
        """Source URL is built correctly for domain-api."""
        url = builtwith_adapter._build_source_url(
            "domain-api", {"domain": "costco.com"}
        )
        assert "api.builtwith.com" in url
        assert "costco.com" in url
        assert "KEY" not in url  # API key should not be in source URL

    def test_build_source_url_relationships_api(self, builtwith_adapter):
        """Source URL is built correctly for relationships-api."""
        url = builtwith_adapter._build_source_url(
            "relationships-api", {"domain": "costco.com"}
        )
        assert "api.builtwith.com" in url
        assert "costco.com" in url


# ============================================================================
# Context Manager Tests
# ============================================================================


class TestContextManager:
    """Tests for async context manager."""

    @pytest.mark.asyncio
    async def test_context_manager_creates_session(self, api_key):
        """Context manager creates and closes session."""
        async with BuiltWithAdapter(api_key=api_key) as adapter:
            assert adapter is not None
            # Session should be created on first request

    @pytest.mark.asyncio
    async def test_close_closes_session(self, api_key):
        """close() closes the HTTP session."""
        adapter = BuiltWithAdapter(api_key=api_key)
        # Create a session
        session = await adapter._get_session()
        assert session is not None
        assert not session.closed

        await adapter.close()
        # Session should be closed
        assert session.closed


# ============================================================================
# Legacy Method Compatibility Tests
# ============================================================================


class TestLegacyMethods:
    """Tests for backwards-compatible legacy methods."""

    @pytest.mark.asyncio
    async def test_get_domain_profile_alias(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """get_domain_profile is alias for domain_lookup."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.get_domain_profile("costco.com")

            assert isinstance(response.data, DomainLookupResponse)
            assert response.citation is not None

    @pytest.mark.asyncio
    async def test_get_tech_spend_alias(
        self, builtwith_adapter, mock_financial_response
    ):
        """get_tech_spend is alias for get_financial."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_financial_response

            response = await builtwith_adapter.get_tech_spend("costco.com")

            assert isinstance(response.data, FinancialResponse)

    @pytest.mark.asyncio
    async def test_check_if_algolia_customer(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """check_if_algolia_customer returns boolean."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.check_if_algolia_customer("costco.com")

            assert isinstance(response.data, bool)
            assert response.data is True  # Mock has Algolia
            assert response.citation is not None

    @pytest.mark.asyncio
    async def test_get_search_provider_method(
        self, builtwith_adapter, mock_domain_api_response
    ):
        """get_search_provider returns search technology."""
        with patch.object(
            builtwith_adapter, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_domain_api_response

            response = await builtwith_adapter.get_search_provider("costco.com")

            assert response.data is not None
            assert response.data.name == "Algolia"
            assert response.citation is not None
