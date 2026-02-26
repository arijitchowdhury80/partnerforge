"""
BuiltWith API Adapter
=====================

Production-ready adapter for BuiltWith technology detection API.

Implements all 7 BuiltWith API endpoints:
1. domain-api - Full technology lookup for a domain
2. free-api - Basic technology lookup (fallback)
3. relationships-api - Related domains and companies
4. recommendations-api - Similar technology recommendations
5. financial-api - Estimated technology spend
6. social-api - Social presence and links
7. trust-api - Trust signals and verification

Features:
- P0 Source Citation Mandate: Every response includes SourceCitation
- Rate limiting: 30 RPM (0.5 TPS), bucket size 5
- Circuit breaker: Opens after 5 consecutive failures
- Retry with exponential backoff
- Response caching: 30-day TTL (tech stack is stable)
- Cost tracking: $0.10 per call
- Typed response models with Pydantic

References:
- docs/INTELLIGENCE_MODULES_SPEC.md
- docs/SOURCE_CITATION_MANDATE.md
- https://api.builtwith.com/

Usage:
    from pipeline.adapters.builtwith import BuiltWithAdapter

    adapter = BuiltWithAdapter(api_key="your_key")

    # Full technology lookup
    response = await adapter.domain_lookup("costco.com")
    print(response.data.technologies)
    print(response.citation)  # Always present (P0)

    # Get relationships
    response = await adapter.get_relationships("costco.com")
    print(response.data.connected_domains)
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from enum import Enum

import aiohttp
from pydantic import BaseModel, Field

from pipeline.adapters.base import (
    BaseAdapter,
    EndpointConfig,
    SourcedResponse,
    APIError,
)
from pipeline.models.source import SourceCitation, SourceType


logger = logging.getLogger(__name__)


# ============================================================================
# Response Models
# ============================================================================


class TechnologyCategory(str, Enum):
    """Technology category classifications."""
    ANALYTICS = "analytics"
    ECOMMERCE = "ecommerce"
    FRAMEWORK = "framework"
    HOSTING = "hosting"
    CDN = "cdn"
    SEARCH = "search"
    CMS = "cms"
    JAVASCRIPT = "javascript"
    ADVERTISING = "advertising"
    PAYMENT = "payment"
    SECURITY = "security"
    EMAIL = "email"
    SOCIAL = "social"
    WIDGET = "widget"
    OTHER = "other"


class Technology(BaseModel):
    """Individual technology detected on a domain."""

    name: str = Field(..., description="Technology name")
    tag: Optional[str] = Field(None, description="Technology tag/category")
    category: Optional[str] = Field(None, description="Normalized category")
    first_detected: Optional[datetime] = Field(
        None, description="When technology was first detected"
    )
    last_detected: Optional[datetime] = Field(
        None, description="When technology was last detected"
    )
    description: Optional[str] = Field(None, description="Technology description")
    link: Optional[str] = Field(None, description="Technology website")
    is_search_technology: bool = Field(
        default=False, description="Is this a search technology?"
    )
    is_partner_technology: bool = Field(
        default=False, description="Is this a partner technology (Adobe, Shopify, etc.)?"
    )

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class DomainMeta(BaseModel):
    """Domain metadata from BuiltWith."""

    domain: str = Field(..., description="The domain analyzed")
    vertical: Optional[str] = Field(None, description="Industry vertical")
    company_name: Optional[str] = Field(None, description="Company name if detected")
    quantcast: Optional[int] = Field(None, description="Quantcast ranking")
    alexa: Optional[int] = Field(None, description="Alexa ranking (deprecated)")
    majestic: Optional[int] = Field(None, description="Majestic ranking")
    umbrella: Optional[int] = Field(None, description="Cisco Umbrella ranking")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class DomainLookupResponse(BaseModel):
    """Response from domain-api endpoint."""

    domain: str = Field(..., description="The queried domain")
    technologies: List[Technology] = Field(
        default_factory=list, description="Technologies detected"
    )
    meta: Optional[DomainMeta] = Field(None, description="Domain metadata")
    technology_count: int = Field(default=0, description="Total technologies found")
    search_technologies: List[Technology] = Field(
        default_factory=list, description="Search technologies detected"
    )
    partner_technologies: List[Technology] = Field(
        default_factory=list, description="Partner technologies detected"
    )
    error: Optional[str] = Field(None, description="Error message if any")

    class Config:
        """Pydantic configuration."""
        extra = "allow"

    @property
    def has_algolia(self) -> bool:
        """Check if domain uses Algolia."""
        for tech in self.technologies:
            if "algolia" in tech.name.lower():
                return True
        return False

    @property
    def search_provider(self) -> Optional[Technology]:
        """Get the primary search technology if present."""
        return self.search_technologies[0] if self.search_technologies else None

    def get_technologies_by_category(self, category: str) -> List[Technology]:
        """Get technologies by category."""
        return [t for t in self.technologies if t.category == category]


class RelatedDomain(BaseModel):
    """Related domain from relationships endpoint."""

    domain: str = Field(..., description="Related domain name")
    relationship_type: str = Field(default="related", description="Type of relationship")
    technologies_shared: List[str] = Field(
        default_factory=list, description="Shared technologies"
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class RelationshipsResponse(BaseModel):
    """Response from relationships-api endpoint."""

    domain: str = Field(..., description="The queried domain")
    connected_domains: List[RelatedDomain] = Field(
        default_factory=list, description="Related domains"
    )
    total_relationships: int = Field(default=0, description="Total relationships found")
    analytics_ids: List[str] = Field(
        default_factory=list, description="Shared analytics IDs"
    )
    tag_ids: List[str] = Field(
        default_factory=list, description="Shared tag container IDs"
    )

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class TechnologyRecommendation(BaseModel):
    """Recommended technology from recommendations endpoint."""

    name: str = Field(..., description="Technology name")
    category: str = Field(default="", description="Technology category")
    adoption_rate: float = Field(
        default=0.0, description="Adoption rate among similar sites"
    )
    description: Optional[str] = Field(None, description="Why this is recommended")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class RecommendationsResponse(BaseModel):
    """Response from recommendations-api endpoint."""

    domain: str = Field(..., description="The queried domain")
    current_technologies: List[str] = Field(
        default_factory=list, description="Current tech stack"
    )
    recommendations: List[TechnologyRecommendation] = Field(
        default_factory=list, description="Recommended technologies"
    )
    total_recommendations: int = Field(default=0, description="Total recommendations")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class TechnologySpend(BaseModel):
    """Technology spending estimate."""

    technology: str = Field(default="", description="Technology name")
    estimated_spend_usd: float = Field(default=0.0, description="Estimated monthly spend")
    confidence: str = Field(default="medium", description="Confidence level")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class FinancialResponse(BaseModel):
    """Response from financial-api endpoint."""

    domain: str = Field(..., description="The queried domain")
    total_tech_spend_estimate_usd: float = Field(
        default=0.0, description="Total estimated technology spend"
    )
    spend_breakdown: List[TechnologySpend] = Field(
        default_factory=list, description="Spend by technology"
    )
    confidence: str = Field(default="medium", description="Overall confidence")
    data_date: Optional[datetime] = Field(None, description="When data was collected")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class SocialProfile(BaseModel):
    """Social media profile."""

    platform: str = Field(..., description="Social platform name")
    url: str = Field(default="", description="Profile URL")
    followers: Optional[int] = Field(None, description="Follower count if available")
    verified: bool = Field(default=False, description="Is profile verified?")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class SocialResponse(BaseModel):
    """Response from social-api endpoint."""

    domain: str = Field(..., description="The queried domain")
    profiles: List[SocialProfile] = Field(
        default_factory=list, description="Social media profiles"
    )
    total_profiles: int = Field(default=0, description="Total profiles found")
    has_linkedin: bool = Field(default=False)
    has_twitter: bool = Field(default=False)
    has_facebook: bool = Field(default=False)

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class TrustSignal(BaseModel):
    """Trust signal for a domain."""

    signal_type: str = Field(default="", description="Type of trust signal")
    value: Any = Field(default=None, description="Signal value")
    positive: bool = Field(default=True, description="Is this a positive signal?")
    source: Optional[str] = Field(None, description="Source of this signal")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class TrustResponse(BaseModel):
    """Response from trust-api endpoint."""

    domain: str = Field(..., description="The queried domain")
    trust_score: float = Field(default=0.0, ge=0.0, le=100.0, description="Trust score 0-100")
    signals: List[TrustSignal] = Field(
        default_factory=list, description="Trust signals"
    )
    ssl_valid: bool = Field(default=False, description="Has valid SSL certificate")
    domain_age_years: Optional[float] = Field(None, description="Domain age in years")
    blacklisted: bool = Field(default=False, description="Is domain blacklisted?")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


# ============================================================================
# Search & Partner Technology Detection
# ============================================================================

# Technologies that indicate search capabilities
SEARCH_TECHNOLOGIES: Set[str] = {
    "Algolia",
    "Elasticsearch",
    "Searchspring",
    "Klevu",
    "Constructor.io",
    "Constructor",
    "Coveo",
    "Bloomreach",
    "Lucidworks",
    "Yext",
    "Swiftype",
    "Apache Solr",
    "Solr",
    "SearchIQ",
    "Doofinder",
    "Sooqr",
    "Findify",
    "Nosto",
    "Clerk.io",
    "Loop54",
    "Unbxd",
    "GroupBy",
    "Reflektion",
    "RichRelevance",
    "Certona",
    "Salesforce Commerce Cloud",  # Has built-in search
    "Einstein",
    "Einstein Search",
    "Magento",  # Has built-in search
    "Shopify",  # Has built-in search
}

# Partner technologies for co-sell motions
PARTNER_TECHNOLOGIES: Set[str] = {
    # Adobe
    "Adobe Experience Manager",
    "Adobe AEM",
    "AEM",
    "Adobe Commerce",
    "Magento",
    "Adobe Analytics",
    "Adobe Target",
    "Adobe Campaign",
    "Adobe Audience Manager",
    # Salesforce
    "Salesforce Commerce Cloud",
    "SFCC",
    "Demandware",
    "Salesforce Marketing Cloud",
    "Salesforce Service Cloud",
    "Salesforce CRM",
    # Shopify
    "Shopify",
    "Shopify Plus",
    # commercetools
    "commercetools",
    # BigCommerce
    "BigCommerce",
    # SAP
    "SAP Commerce Cloud",
    "SAP Hybris",
    "Hybris",
    # Other
    "Contentful",
    "Amplience",
    "Contentstack",
    "Sitecore",
}


def is_search_technology(name: str) -> bool:
    """Check if technology name indicates a search product."""
    name_lower = name.lower()
    for search_tech in SEARCH_TECHNOLOGIES:
        if search_tech.lower() in name_lower:
            return True
    return False


def is_partner_technology(name: str) -> bool:
    """Check if technology name is a partner technology."""
    name_lower = name.lower()
    for partner_tech in PARTNER_TECHNOLOGIES:
        if partner_tech.lower() in name_lower:
            return True
    return False


def categorize_technology(tag: Optional[str]) -> str:
    """Map BuiltWith tag to normalized category."""
    if not tag:
        return TechnologyCategory.OTHER.value

    tag_lower = tag.lower()

    if "analytics" in tag_lower or "tracking" in tag_lower:
        return TechnologyCategory.ANALYTICS.value
    elif "ecommerce" in tag_lower or "cart" in tag_lower or "payment" in tag_lower:
        return TechnologyCategory.ECOMMERCE.value
    elif "framework" in tag_lower or "library" in tag_lower:
        return TechnologyCategory.FRAMEWORK.value
    elif "hosting" in tag_lower or "server" in tag_lower:
        return TechnologyCategory.HOSTING.value
    elif "cdn" in tag_lower:
        return TechnologyCategory.CDN.value
    elif "search" in tag_lower:
        return TechnologyCategory.SEARCH.value
    elif "cms" in tag_lower or "content" in tag_lower:
        return TechnologyCategory.CMS.value
    elif "javascript" in tag_lower or "js" in tag_lower:
        return TechnologyCategory.JAVASCRIPT.value
    elif "advertising" in tag_lower or "ad" in tag_lower:
        return TechnologyCategory.ADVERTISING.value
    elif "security" in tag_lower or "ssl" in tag_lower:
        return TechnologyCategory.SECURITY.value
    elif "email" in tag_lower:
        return TechnologyCategory.EMAIL.value
    elif "social" in tag_lower:
        return TechnologyCategory.SOCIAL.value
    elif "widget" in tag_lower:
        return TechnologyCategory.WIDGET.value
    else:
        return TechnologyCategory.OTHER.value


# ============================================================================
# BuiltWith Adapter
# ============================================================================


class BuiltWithAdapter(BaseAdapter):
    """
    Production-ready adapter for BuiltWith API.

    Implements all 7 BuiltWith endpoints with:
    - P0 Source Citation Mandate enforcement
    - Rate limiting (30 RPM = 0.5 TPS)
    - Circuit breaker protection
    - Response caching (30-day TTL)
    - Cost tracking ($0.10 per call)
    - Typed response models

    Example:
        adapter = BuiltWithAdapter(api_key="your_key")

        # Technology lookup
        response = await adapter.domain_lookup("costco.com")
        for tech in response.data.technologies:
            print(f"{tech.name} ({tech.category})")

        # Citation is always present (P0 requirement)
        print(f"Source: {response.citation.source_url}")
    """

    # API Constants
    BASE_URL = "https://api.builtwith.com"
    API_VERSION = "v21"
    DEFAULT_COST_PER_CALL = 0.10  # $0.10 per API call
    CACHE_TTL_SECONDS = 30 * 24 * 60 * 60  # 30 days (tech stack is stable)

    # Endpoint paths
    ENDPOINTS = {
        "domain-api": {
            "path": "/v21/api.json",
            "cost": 0.10,
            "description": "Full technology lookup",
        },
        "free-api": {
            "path": "/free1/api.json",
            "cost": 0.00,
            "description": "Basic lookup (limited data)",
        },
        "relationships-api": {
            "path": "/rv1/api.json",
            "cost": 0.10,
            "description": "Related domains and companies",
        },
        "recommendations-api": {
            "path": "/recapi/api.json",
            "cost": 0.10,
            "description": "Technology recommendations",
        },
        "financial-api": {
            "path": "/fapi1/api.json",
            "cost": 0.10,
            "description": "Technology spend estimates",
        },
        "social-api": {
            "path": "/srapi1/api.json",
            "cost": 0.10,
            "description": "Social media presence",
        },
        "trust-api": {
            "path": "/trust1/api.json",
            "cost": 0.10,
            "description": "Trust signals and verification",
        },
    }

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        enable_cache: bool = True,
        session: Optional[aiohttp.ClientSession] = None,
    ):
        """
        Initialize BuiltWith adapter.

        Args:
            api_key: BuiltWith API key. Falls back to BUILTWITH_API_KEY env var.
            base_url: Override base URL (for testing).
            enable_cache: Enable response caching (default True).
            session: Optional aiohttp session to reuse.
        """
        # Get API key from param or environment
        self.api_key = api_key or os.environ.get("BUILTWITH_API_KEY")
        if not self.api_key:
            logger.warning(
                "No BuiltWith API key provided. Set BUILTWITH_API_KEY env var or pass api_key parameter."
            )

        super().__init__(
            name="builtwith",
            source_type=SourceType.BUILTWITH,
            api_key=self.api_key,
            base_url=base_url or self.BASE_URL,
            api_version=self.API_VERSION,
            default_cost_per_call=self.DEFAULT_COST_PER_CALL,
            default_cache_ttl_seconds=self.CACHE_TTL_SECONDS,
            enable_cache=enable_cache,
            # Rate limiting: 30 RPM = 0.5 TPS, burst up to 5
            # Will be auto-configured from API_RATE_LIMITS registry
        )

        # Register all endpoints with their configurations
        for endpoint_name, config in self.ENDPOINTS.items():
            self.register_endpoint(
                EndpointConfig(
                    name=endpoint_name,
                    path=config["path"],
                    cost_per_call=config["cost"],
                    cache_ttl_seconds=self.CACHE_TTL_SECONDS,
                    timeout_seconds=30,
                )
            )

        # Optional shared session
        self._session = session
        self._owns_session = session is None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
            self._owns_session = True
        return self._session

    async def close(self) -> None:
        """Close the HTTP session if we own it."""
        if self._session and self._owns_session and not self._session.closed:
            await self._session.close()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
        return False

    async def _make_request(
        self,
        endpoint: str,
        params: Dict[str, Any],
        timeout_seconds: int,
    ) -> Dict[str, Any]:
        """
        Make HTTP request to BuiltWith API.

        Args:
            endpoint: Endpoint name (e.g., "domain-api")
            params: Request parameters (must include "domain")
            timeout_seconds: Request timeout

        Returns:
            Raw API response as dictionary

        Raises:
            APIError: On HTTP error
            ConnectionError: On network failure
            TimeoutError: On request timeout
        """
        if not self.api_key:
            raise APIError(
                adapter_name=self.name,
                status_code=401,
                response_body="No API key configured",
                endpoint=endpoint,
            )

        endpoint_config = self.get_endpoint_config(endpoint)
        url = f"{self.base_url}{endpoint_config.path}"

        # Build request params
        domain = params.get("domain", params.get("LOOKUP", ""))
        request_params = {
            "KEY": self.api_key,
            "LOOKUP": domain,
        }
        # Add any additional params (excluding 'domain' and 'LOOKUP')
        for k, v in params.items():
            if k not in ("domain", "LOOKUP"):
                request_params[k] = v

        session = await self._get_session()
        timeout = aiohttp.ClientTimeout(total=timeout_seconds)

        logger.debug(f"[BuiltWith] Requesting {endpoint}: {domain}")

        try:
            async with session.get(
                url,
                params=request_params,
                timeout=timeout,
            ) as response:
                response_text = await response.text()

                if response.status == 429:
                    raise APIError(
                        adapter_name=self.name,
                        status_code=429,
                        response_body="Rate limit exceeded",
                        endpoint=endpoint,
                    )

                if response.status == 401 or response.status == 403:
                    raise APIError(
                        adapter_name=self.name,
                        status_code=response.status,
                        response_body="Authentication failed - check API key",
                        endpoint=endpoint,
                    )

                if response.status >= 400:
                    raise APIError(
                        adapter_name=self.name,
                        status_code=response.status,
                        response_body=response_text[:500],
                        endpoint=endpoint,
                    )

                # Parse JSON response
                try:
                    return await response.json()
                except Exception as e:
                    logger.error(f"Failed to parse JSON response: {e}")
                    raise APIError(
                        adapter_name=self.name,
                        status_code=response.status,
                        response_body=f"Invalid JSON: {response_text[:200]}",
                        endpoint=endpoint,
                    )

        except asyncio.TimeoutError:
            logger.error(f"Request timeout for {endpoint}")
            raise TimeoutError(f"Request to {endpoint} timed out after {timeout_seconds}s")

        except aiohttp.ClientError as e:
            logger.error(f"Connection error for {endpoint}: {e}")
            raise ConnectionError(f"Connection failed: {e}")

    def _parse_response(
        self,
        endpoint: str,
        raw_response: Dict[str, Any],
        params: Dict[str, Any],
    ) -> Any:
        """
        Parse raw API response into typed response model.

        Args:
            endpoint: Endpoint name
            raw_response: Raw JSON response
            params: Original request parameters

        Returns:
            Typed response model
        """
        domain = params.get("domain", params.get("LOOKUP", "unknown"))

        if endpoint in ("domain-api", "free-api"):
            return self._parse_domain_lookup(raw_response, domain)
        elif endpoint == "relationships-api":
            return self._parse_relationships(raw_response, domain)
        elif endpoint == "recommendations-api":
            return self._parse_recommendations(raw_response, domain)
        elif endpoint == "financial-api":
            return self._parse_financial(raw_response, domain)
        elif endpoint == "social-api":
            return self._parse_social(raw_response, domain)
        elif endpoint == "trust-api":
            return self._parse_trust(raw_response, domain)
        else:
            # Return raw for unknown endpoints
            return raw_response

    def _parse_domain_lookup(
        self, raw: Dict[str, Any], domain: str
    ) -> DomainLookupResponse:
        """Parse domain-api or free-api response."""
        technologies: List[Technology] = []
        search_techs: List[Technology] = []
        partner_techs: List[Technology] = []
        meta: Optional[DomainMeta] = None

        # Handle BuiltWith response format
        results = raw.get("Results", [])
        if results:
            result = results[0]

            # Parse technologies from various possible locations
            tech_list = result.get("Technologies", []) or result.get("technologies", [])
            for tech_data in tech_list:
                tech = self._parse_technology(tech_data)
                technologies.append(tech)

                if tech.is_search_technology:
                    search_techs.append(tech)
                if tech.is_partner_technology:
                    partner_techs.append(tech)

            # Parse meta
            meta_data = result.get("Meta", {})
            if meta_data:
                meta = DomainMeta(
                    domain=result.get("Lookup", domain),
                    vertical=meta_data.get("Vertical"),
                    company_name=meta_data.get("CompanyName"),
                    quantcast=meta_data.get("QCast"),
                    alexa=meta_data.get("ARank"),
                    majestic=meta_data.get("Majestic"),
                    umbrella=meta_data.get("Umbrella"),
                )

        # Check for error in response
        errors = raw.get("Errors", [])
        error_msg = None
        if errors and isinstance(errors, list) and len(errors) > 0:
            error_msg = errors[0].get("Message") if isinstance(errors[0], dict) else str(errors[0])

        return DomainLookupResponse(
            domain=domain,
            technologies=technologies,
            meta=meta,
            technology_count=len(technologies),
            search_technologies=search_techs,
            partner_technologies=partner_techs,
            error=error_msg,
        )

    def _parse_technology(self, tech_data: Dict[str, Any]) -> Technology:
        """Parse individual technology from response."""
        name = tech_data.get("Name", tech_data.get("name", tech_data.get("Technology", "Unknown")))
        tag = tech_data.get("Tag", tech_data.get("tag", tech_data.get("Category")))

        # Parse timestamps (BuiltWith returns milliseconds)
        first_detected = None
        last_detected = None

        if tech_data.get("FirstDetected"):
            try:
                first_detected = datetime.fromtimestamp(
                    tech_data["FirstDetected"] / 1000
                )
            except (ValueError, TypeError, OSError):
                pass

        if tech_data.get("LastDetected"):
            try:
                last_detected = datetime.fromtimestamp(
                    tech_data["LastDetected"] / 1000
                )
            except (ValueError, TypeError, OSError):
                pass

        return Technology(
            name=name,
            tag=tag,
            category=categorize_technology(tag),
            first_detected=first_detected,
            last_detected=last_detected,
            description=tech_data.get("Description"),
            link=tech_data.get("Link"),
            is_search_technology=is_search_technology(name),
            is_partner_technology=is_partner_technology(name),
        )

    def _parse_relationships(
        self, raw: Dict[str, Any], domain: str
    ) -> RelationshipsResponse:
        """Parse relationships-api response."""
        connected: List[RelatedDomain] = []
        analytics_ids: List[str] = []
        tag_ids: List[str] = []

        results = raw.get("Results", [])
        if results:
            result = results[0]

            # Parse identifiers (shared analytics/tags)
            identifiers = result.get("Identifiers", [])
            for ident in identifiers:
                ident_type = ident.get("Type", "")
                if "analytics" in ident_type.lower():
                    analytics_ids.append(ident.get("Value", ""))
                elif "tag" in ident_type.lower():
                    tag_ids.append(ident.get("Value", ""))

            # Parse related domains
            relationships = result.get("Relationships", [])
            for rel in relationships:
                connected.append(
                    RelatedDomain(
                        domain=rel.get("Domain", ""),
                        relationship_type=rel.get("Type", "related"),
                        technologies_shared=rel.get("Technologies", []),
                        confidence=rel.get("Confidence", 1.0),
                    )
                )

        return RelationshipsResponse(
            domain=domain,
            connected_domains=connected,
            total_relationships=len(connected),
            analytics_ids=analytics_ids,
            tag_ids=tag_ids,
        )

    def _parse_recommendations(
        self, raw: Dict[str, Any], domain: str
    ) -> RecommendationsResponse:
        """Parse recommendations-api response."""
        recommendations: List[TechnologyRecommendation] = []
        current_techs: List[str] = []

        results = raw.get("Results", [])
        if results:
            result = results[0]

            current_techs = [
                t.get("Name", "") for t in result.get("Technologies", [])
            ]

            for rec in result.get("Recommendations", []):
                recommendations.append(
                    TechnologyRecommendation(
                        name=rec.get("Name", ""),
                        category=rec.get("Category", ""),
                        adoption_rate=rec.get("AdoptionRate", 0.0),
                        description=rec.get("Reason"),
                    )
                )

        return RecommendationsResponse(
            domain=domain,
            current_technologies=current_techs,
            recommendations=recommendations,
            total_recommendations=len(recommendations),
        )

    def _parse_financial(
        self, raw: Dict[str, Any], domain: str
    ) -> FinancialResponse:
        """Parse financial-api response."""
        spend_breakdown: List[TechnologySpend] = []
        total_spend = 0.0

        results = raw.get("Results", [])
        if results:
            result = results[0]

            for spend in result.get("Spend", []):
                tech_spend = TechnologySpend(
                    technology=spend.get("Technology", ""),
                    estimated_spend_usd=spend.get("Spend", 0.0),
                    confidence=spend.get("Confidence", "medium"),
                )
                spend_breakdown.append(tech_spend)
                total_spend += tech_spend.estimated_spend_usd

        return FinancialResponse(
            domain=domain,
            total_tech_spend_estimate_usd=total_spend,
            spend_breakdown=spend_breakdown,
            confidence=raw.get("Confidence", "medium"),
            data_date=datetime.utcnow(),
        )

    def _parse_social(self, raw: Dict[str, Any], domain: str) -> SocialResponse:
        """Parse social-api response."""
        profiles: List[SocialProfile] = []
        has_linkedin = False
        has_twitter = False
        has_facebook = False

        results = raw.get("Results", [])
        if results:
            result = results[0]

            for social in result.get("Social", []):
                platform = social.get("Platform", "").lower()
                profile = SocialProfile(
                    platform=social.get("Platform", ""),
                    url=social.get("URL", ""),
                    followers=social.get("Followers"),
                    verified=social.get("Verified", False),
                )
                profiles.append(profile)

                if "linkedin" in platform:
                    has_linkedin = True
                elif "twitter" in platform or "x.com" in platform:
                    has_twitter = True
                elif "facebook" in platform:
                    has_facebook = True

        return SocialResponse(
            domain=domain,
            profiles=profiles,
            total_profiles=len(profiles),
            has_linkedin=has_linkedin,
            has_twitter=has_twitter,
            has_facebook=has_facebook,
        )

    def _parse_trust(self, raw: Dict[str, Any], domain: str) -> TrustResponse:
        """Parse trust-api response."""
        signals: List[TrustSignal] = []
        trust_score = 0.0
        ssl_valid = False
        domain_age: Optional[float] = None
        blacklisted = False

        results = raw.get("Results", [])
        if results:
            result = results[0]

            trust_score = result.get("TrustScore", 0.0)
            ssl_valid = result.get("SSL", {}).get("Valid", False)
            domain_age = result.get("DomainAge")
            blacklisted = result.get("Blacklisted", False)

            for signal_data in result.get("Signals", []):
                signals.append(
                    TrustSignal(
                        signal_type=signal_data.get("Type", ""),
                        value=signal_data.get("Value"),
                        positive=signal_data.get("Positive", True),
                        source=signal_data.get("Source"),
                    )
                )

        return TrustResponse(
            domain=domain,
            trust_score=trust_score,
            signals=signals,
            ssl_valid=ssl_valid,
            domain_age_years=domain_age,
            blacklisted=blacklisted,
        )

    def _build_source_url(
        self,
        endpoint: str,
        params: Dict[str, Any],
    ) -> str:
        """
        Build source URL for citation.

        P0 Requirement: Every response must have a source URL.
        """
        endpoint_config = self.get_endpoint_config(endpoint)
        domain = params.get("domain", params.get("LOOKUP", "unknown"))

        # Build URL without exposing API key
        return f"{self.base_url}{endpoint_config.path}?LOOKUP={domain}"

    # ========================================================================
    # Public API Methods
    # ========================================================================

    async def domain_lookup(
        self, domain: str, bypass_cache: bool = False
    ) -> SourcedResponse[DomainLookupResponse]:
        """
        Full technology lookup for a domain.

        This is the primary endpoint for technology detection.

        Args:
            domain: Domain to analyze (e.g., "costco.com")
            bypass_cache: Skip cache lookup if True

        Returns:
            SourcedResponse containing:
            - data: DomainLookupResponse with technologies
            - citation: SourceCitation (P0 requirement)
            - cached: Whether response came from cache
            - cost_usd: Cost of this API call

        Example:
            response = await adapter.domain_lookup("costco.com")
            print(f"Found {response.data.technology_count} technologies")
            for tech in response.data.search_technologies:
                print(f"  Search: {tech.name}")
        """
        return await self.call(
            endpoint="domain-api",
            params={"domain": domain},
            bypass_cache=bypass_cache,
        )

    async def free_lookup(
        self, domain: str, bypass_cache: bool = False
    ) -> SourcedResponse[DomainLookupResponse]:
        """
        Basic technology lookup (free tier, limited data).

        Use this as fallback when credits are exhausted.

        Args:
            domain: Domain to analyze
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with limited technology data
        """
        return await self.call(
            endpoint="free-api",
            params={"domain": domain},
            bypass_cache=bypass_cache,
        )

    async def get_relationships(
        self, domain: str, bypass_cache: bool = False
    ) -> SourcedResponse[RelationshipsResponse]:
        """
        Get related domains and companies.

        Useful for:
        - Discovering parent/subsidiary relationships
        - Finding shared infrastructure
        - Identifying technology patterns

        Args:
            domain: Domain to analyze
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with related domains

        Example:
            response = await adapter.get_relationships("costco.com")
            for related in response.data.connected_domains:
                print(f"Related: {related.domain} ({related.relationship_type})")
        """
        return await self.call(
            endpoint="relationships-api",
            params={"domain": domain},
            bypass_cache=bypass_cache,
        )

    async def get_recommendations(
        self, domain: str, bypass_cache: bool = False
    ) -> SourcedResponse[RecommendationsResponse]:
        """
        Get technology recommendations for a domain.

        Based on similar sites and industry patterns.

        Args:
            domain: Domain to analyze
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with technology recommendations
        """
        return await self.call(
            endpoint="recommendations-api",
            params={"domain": domain},
            bypass_cache=bypass_cache,
        )

    async def get_financial(
        self, domain: str, bypass_cache: bool = False
    ) -> SourcedResponse[FinancialResponse]:
        """
        Get estimated technology spend.

        Provides estimates of technology budget allocation.

        Args:
            domain: Domain to analyze
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with spend estimates

        Example:
            response = await adapter.get_financial("costco.com")
            print(f"Est. tech spend: ${response.data.total_tech_spend_estimate_usd:,.0f}")
        """
        return await self.call(
            endpoint="financial-api",
            params={"domain": domain},
            bypass_cache=bypass_cache,
        )

    async def get_social(
        self, domain: str, bypass_cache: bool = False
    ) -> SourcedResponse[SocialResponse]:
        """
        Get social media presence.

        Detects social profiles linked to the domain.

        Args:
            domain: Domain to analyze
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with social profiles
        """
        return await self.call(
            endpoint="social-api",
            params={"domain": domain},
            bypass_cache=bypass_cache,
        )

    async def get_trust(
        self, domain: str, bypass_cache: bool = False
    ) -> SourcedResponse[TrustResponse]:
        """
        Get trust signals and verification.

        Useful for assessing domain legitimacy.

        Args:
            domain: Domain to analyze
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with trust signals

        Example:
            response = await adapter.get_trust("costco.com")
            print(f"Trust score: {response.data.trust_score}/100")
            print(f"SSL valid: {response.data.ssl_valid}")
        """
        return await self.call(
            endpoint="trust-api",
            params={"domain": domain},
            bypass_cache=bypass_cache,
        )

    async def get_full_profile(
        self, domain: str, bypass_cache: bool = False
    ) -> Dict[str, Optional[SourcedResponse]]:
        """
        Get comprehensive profile using all endpoints.

        Calls all 7 endpoints in parallel for complete intelligence.
        Note: This consumes 6 API calls ($0.60 total, free-api is $0).

        Args:
            domain: Domain to analyze
            bypass_cache: Skip cache lookup

        Returns:
            Dictionary with results from all endpoints:
            {
                "domain": SourcedResponse[DomainLookupResponse],
                "relationships": SourcedResponse[RelationshipsResponse],
                "recommendations": SourcedResponse[RecommendationsResponse],
                "financial": SourcedResponse[FinancialResponse],
                "social": SourcedResponse[SocialResponse],
                "trust": SourcedResponse[TrustResponse],
            }
        """
        results = await asyncio.gather(
            self.domain_lookup(domain, bypass_cache),
            self.get_relationships(domain, bypass_cache),
            self.get_recommendations(domain, bypass_cache),
            self.get_financial(domain, bypass_cache),
            self.get_social(domain, bypass_cache),
            self.get_trust(domain, bypass_cache),
            return_exceptions=True,
        )

        return {
            "domain": results[0] if not isinstance(results[0], Exception) else None,
            "relationships": results[1] if not isinstance(results[1], Exception) else None,
            "recommendations": results[2] if not isinstance(results[2], Exception) else None,
            "financial": results[3] if not isinstance(results[3], Exception) else None,
            "social": results[4] if not isinstance(results[4], Exception) else None,
            "trust": results[5] if not isinstance(results[5], Exception) else None,
        }

    # ========================================================================
    # Utility Methods
    # ========================================================================

    def get_search_technologies(
        self, response: DomainLookupResponse
    ) -> List[Technology]:
        """
        Extract search technologies from a domain lookup response.

        Convenience method to filter search-related technologies.

        Args:
            response: DomainLookupResponse from domain_lookup()

        Returns:
            List of search technology objects
        """
        return response.search_technologies

    def get_partner_technologies(
        self, response: DomainLookupResponse
    ) -> List[Technology]:
        """
        Extract partner technologies from a domain lookup response.

        Convenience method to filter partner technologies (Adobe, Shopify, etc.)

        Args:
            response: DomainLookupResponse from domain_lookup()

        Returns:
            List of partner technology objects
        """
        return response.partner_technologies

    def is_using_algolia(self, response: DomainLookupResponse) -> bool:
        """
        Check if domain is using Algolia.

        Args:
            response: DomainLookupResponse from domain_lookup()

        Returns:
            True if Algolia is detected
        """
        return response.has_algolia

    def is_displacement_target(self, response: DomainLookupResponse) -> bool:
        """
        Check if domain is a displacement target.

        A domain is a displacement target if it:
        1. Uses partner technology (Adobe, Shopify, etc.)
        2. Does NOT use Algolia

        Args:
            response: DomainLookupResponse from domain_lookup()

        Returns:
            True if domain is a displacement target
        """
        has_partner = len(response.partner_technologies) > 0
        uses_algolia = self.is_using_algolia(response)

        return has_partner and not uses_algolia

    # Legacy method compatibility
    async def get_domain_profile(
        self,
        domain: str,
        use_free_api: bool = False,
        bypass_cache: bool = False,
    ) -> SourcedResponse[DomainLookupResponse]:
        """
        Get full technology profile for a domain.

        This is an alias for domain_lookup() with free-api option.

        Args:
            domain: Domain to lookup (e.g., "costco.com")
            use_free_api: Use free API tier (limited data)
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse containing DomainLookupResponse
        """
        if use_free_api:
            return await self.free_lookup(domain, bypass_cache)
        return await self.domain_lookup(domain, bypass_cache)

    async def get_tech_spend(
        self,
        domain: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[FinancialResponse]:
        """
        Get estimated technology spending for a domain.

        This is an alias for get_financial().

        Args:
            domain: Domain to lookup
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse containing FinancialResponse
        """
        return await self.get_financial(domain, bypass_cache)

    async def get_social_presence(
        self,
        domain: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[SocialResponse]:
        """
        Get social media presence for a domain.

        This is an alias for get_social().

        Args:
            domain: Domain to lookup
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse containing SocialResponse
        """
        return await self.get_social(domain, bypass_cache)

    async def get_trust_metrics(
        self,
        domain: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[TrustResponse]:
        """
        Get trust/security metrics for a domain.

        This is an alias for get_trust().

        Args:
            domain: Domain to lookup
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse containing TrustResponse
        """
        return await self.get_trust(domain, bypass_cache)

    async def check_if_algolia_customer(
        self,
        domain: str,
    ) -> SourcedResponse[bool]:
        """
        Check if a domain uses Algolia.

        Convenience method for displacement target filtering.

        Args:
            domain: Domain to check

        Returns:
            SourcedResponse with boolean value
        """
        profile_response = await self.free_lookup(domain)

        # Create a new SourcedResponse with the boolean result
        return SourcedResponse(
            data=profile_response.data.has_algolia,
            citation=profile_response.citation,
            cached=profile_response.cached,
            latency_ms=profile_response.latency_ms,
            cost_usd=profile_response.cost_usd,
        )

    async def get_search_provider(
        self,
        domain: str,
    ) -> SourcedResponse[Optional[Technology]]:
        """
        Get the search provider for a domain.

        Args:
            domain: Domain to check

        Returns:
            SourcedResponse with search provider Technology or None
        """
        profile_response = await self.domain_lookup(domain)

        return SourcedResponse(
            data=profile_response.data.search_provider,
            citation=profile_response.citation,
            cached=profile_response.cached,
            latency_ms=profile_response.latency_ms,
            cost_usd=profile_response.cost_usd,
        )


# ============================================================================
# Convenience Functions
# ============================================================================


async def create_builtwith_adapter(
    api_key: Optional[str] = None,
) -> BuiltWithAdapter:
    """
    Factory function to create BuiltWithAdapter.

    Args:
        api_key: Optional API key (falls back to env var)

    Returns:
        Configured BuiltWithAdapter instance

    Example:
        async with create_builtwith_adapter() as adapter:
            response = await adapter.domain_lookup("costco.com")
    """
    return BuiltWithAdapter(api_key=api_key)
