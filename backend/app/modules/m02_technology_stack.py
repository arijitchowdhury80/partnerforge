"""
M02 Technology Stack Intelligence Module

Detects technologies in use for partner matching and displacement opportunities.
This is a Wave 1 (Foundation) module with no dependencies.

Data Sources:
- BuiltWith MCP (primary): domain-lookup, relationships-api, financial-api
- SimilarWeb (fallback): get-website-content-technologies-agg

Output: Full technology stack with partner/competitor flags, search provider
detection, and tech spend estimates.

SOURCE CITATION MANDATE: Every data point MUST have source_url and source_date.
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field

from .base import (
    BaseIntelligenceModule,
    ModuleResult,
    SourceInfo,
    register_module,
)
from ..services.validation import MissingSourceError, SourceFreshnessError

logger = logging.getLogger(__name__)


# =============================================================================
# Partner/Competitor Technology Definitions
# =============================================================================

PARTNER_TECHNOLOGIES = {
    # E-commerce Platforms (Premium Partners)
    "Shopify Plus": {"category": "ecommerce", "tier": "Premium", "score": 10},
    "Shopify": {"category": "ecommerce", "tier": "Standard", "score": 7},
    "Adobe Commerce": {"category": "ecommerce", "tier": "Premium", "score": 10},
    "Magento": {"category": "ecommerce", "tier": "Premium", "score": 10},
    "Salesforce Commerce Cloud": {"category": "ecommerce", "tier": "Premium", "score": 10},
    "SFCC": {"category": "ecommerce", "tier": "Premium", "score": 10},
    "commercetools": {"category": "ecommerce", "tier": "Premium", "score": 10},
    "BigCommerce": {"category": "ecommerce", "tier": "Standard", "score": 7},

    # CMS Platforms (Premium Partners)
    "Adobe Experience Manager": {"category": "cms", "tier": "Premium", "score": 10},
    "Adobe AEM": {"category": "cms", "tier": "Premium", "score": 10},
    "Amplience": {"category": "cms", "tier": "Premium", "score": 8},
    "Contentful": {"category": "cms", "tier": "Premium", "score": 8},
    "Contentstack": {"category": "cms", "tier": "Standard", "score": 7},

    # CRM Platforms
    "Salesforce": {"category": "crm", "tier": "Standard", "score": 5},
    "HubSpot": {"category": "crm", "tier": "Standard", "score": 5},
}

COMPETITOR_SEARCH_PROVIDERS = {
    "Elasticsearch": {"category": "search", "displacement_priority": "HIGH"},
    "Elastic": {"category": "search", "displacement_priority": "HIGH"},
    "OpenSearch": {"category": "search", "displacement_priority": "HIGH"},
    "Coveo": {"category": "search", "displacement_priority": "MEDIUM"},
    "Searchspring": {"category": "search", "displacement_priority": "MEDIUM"},
    "Klevu": {"category": "search", "displacement_priority": "MEDIUM"},
    "Constructor.io": {"category": "search", "displacement_priority": "HIGH"},
    "Constructor": {"category": "search", "displacement_priority": "HIGH"},
    "Bloomreach": {"category": "search", "displacement_priority": "HIGH"},
    "Solr": {"category": "search", "displacement_priority": "MEDIUM"},
    "Apache Solr": {"category": "search", "displacement_priority": "MEDIUM"},
    "Yext": {"category": "search", "displacement_priority": "LOW"},
    "Swiftype": {"category": "search", "displacement_priority": "MEDIUM"},
    "Doofinder": {"category": "search", "displacement_priority": "LOW"},
    "Lucidworks": {"category": "search", "displacement_priority": "HIGH"},
    "Algolia": {"category": "search", "is_algolia": True, "displacement_priority": None},
}


# =============================================================================
# Data Models
# =============================================================================

class TechnologyItem(BaseModel):
    """Individual technology detected on the domain."""

    name: str
    category: str
    first_detected: Optional[str] = None
    last_detected: Optional[str] = None
    confidence: float = 1.0
    is_partner_tech: bool = False
    partner_tier: Optional[str] = None
    partner_score: int = 0
    is_competitor_search: bool = False
    displacement_priority: Optional[str] = None


class TechnologyStackData(BaseModel):
    """
    Technology Stack data model - output of M02 module.

    Captures the full technology stack with partner and competitor flags.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Technology counts
    total_technologies: int = Field(0, description="Total number of technologies detected")

    # Partner technologies
    partner_technologies: List[TechnologyItem] = Field(
        default_factory=list,
        description="Technologies from Algolia partners"
    )
    primary_partner: Optional[str] = Field(None, description="Primary partner technology")
    partner_score: int = Field(0, description="Aggregate partner score (0-100)")

    # Competitor search technologies
    competitor_technologies: List[TechnologyItem] = Field(
        default_factory=list,
        description="Competitor search technologies"
    )
    current_search_provider: Optional[str] = Field(
        None, description="Current search provider (if detected)"
    )
    has_algolia: bool = Field(False, description="Whether domain already uses Algolia")
    displacement_priority: Optional[str] = Field(
        None, description="Priority for displacement (HIGH/MEDIUM/LOW)"
    )

    # E-commerce stack
    ecommerce_platform: Optional[str] = Field(None, description="Primary e-commerce platform")
    cms_platform: Optional[str] = Field(None, description="Primary CMS platform")

    # Tech spend
    tech_spend_estimate: Optional[int] = Field(None, description="Annual tech spend (USD)")
    tech_spend_tier: Optional[str] = Field(None, description="Spend tier ($100K+, $50K-100K, etc.)")

    # Analytics and CDN
    analytics_tools: List[str] = Field(default_factory=list, description="Analytics tools")
    cdn_providers: List[str] = Field(default_factory=list, description="CDN providers")
    payment_providers: List[str] = Field(default_factory=list, description="Payment providers")

    # Full stack
    full_stack: List[TechnologyItem] = Field(
        default_factory=list,
        description="Complete technology list"
    )


# =============================================================================
# Module Implementation
# =============================================================================

@register_module
class M02TechnologyStackModule(BaseIntelligenceModule):
    """
    M02: Technology Stack - detected technologies and partner matching.

    Wave 1 (Foundation) module with no dependencies.
    Collects technology stack data from BuiltWith API.
    """

    MODULE_ID = "m02_technology_stack"
    MODULE_NAME = "Technology Stack"
    WAVE = 1
    DEPENDS_ON = []
    SOURCE_TYPE = "api"
    CACHE_TTL = 604800  # 7 days

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with TechnologyStackData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching technology stack for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached result for: {domain}")
                return cached

        # Fetch raw data
        raw_data = await self.fetch_data(domain)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        tech_data = await self._validate_and_store(domain, transformed)

        # Get source info
        source_url = raw_data.get("source_url")
        source_date_str = raw_data.get("source_date")

        if not source_url:
            raise MissingSourceError(self.MODULE_ID, "source_url")

        if not source_date_str:
            raise MissingSourceError(self.MODULE_ID, "source_date")

        # Parse source date
        if isinstance(source_date_str, str):
            source_date = datetime.fromisoformat(source_date_str.replace("Z", "+00:00"))
        else:
            source_date = source_date_str

        # Create result with source citation
        result = self._create_result(
            domain=domain,
            data=tech_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched technology stack for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch raw data from BuiltWith API.

        Attempts BuiltWith first (primary source), then SimilarWeb
        as fallback.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged data from all sources
        """
        builtwith_data = {}
        similarweb_data = {}
        errors = []

        # Try BuiltWith (primary)
        try:
            builtwith_data = await self._fetch_from_builtwith(domain)
            self.logger.debug(f"BuiltWith returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"BuiltWith fetch failed for {domain}: {e}")
            errors.append(f"BuiltWith: {e}")

        # Try SimilarWeb as fallback if BuiltWith fails
        if not builtwith_data:
            try:
                similarweb_data = await self._fetch_from_similarweb(domain)
                self.logger.debug(f"SimilarWeb returned data for: {domain}")
            except Exception as e:
                self.logger.warning(f"SimilarWeb fetch failed for {domain}: {e}")
                errors.append(f"SimilarWeb: {e}")

        # If both sources failed, raise error
        if not builtwith_data and not similarweb_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        # Use whichever source succeeded
        return builtwith_data if builtwith_data else similarweb_data

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into TechnologyStackData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching TechnologyStackData fields
        """
        technologies = raw_data.get("technologies", [])

        # Categorize technologies
        partner_techs = []
        competitor_techs = []
        full_stack = []
        analytics_tools = []
        cdn_providers = []
        payment_providers = []

        ecommerce_platform = None
        cms_platform = None
        current_search = None
        has_algolia = False
        partner_score = 0
        displacement_priority = None

        for tech in technologies:
            tech_name = tech.get("name", "")
            tech_category = tech.get("category", "").lower()

            # Create tech item
            tech_item = TechnologyItem(
                name=tech_name,
                category=tech_category,
                first_detected=tech.get("first_detected"),
                last_detected=tech.get("last_detected"),
                confidence=tech.get("confidence", 1.0),
            )

            # Check if partner technology
            if tech_name in PARTNER_TECHNOLOGIES:
                partner_info = PARTNER_TECHNOLOGIES[tech_name]
                tech_item.is_partner_tech = True
                tech_item.partner_tier = partner_info["tier"]
                tech_item.partner_score = partner_info["score"]
                partner_techs.append(tech_item)
                partner_score += partner_info["score"]

                # Track primary platforms
                if partner_info["category"] == "ecommerce" and not ecommerce_platform:
                    ecommerce_platform = tech_name
                elif partner_info["category"] == "cms" and not cms_platform:
                    cms_platform = tech_name

            # Check if competitor search
            if tech_name in COMPETITOR_SEARCH_PROVIDERS:
                search_info = COMPETITOR_SEARCH_PROVIDERS[tech_name]
                if search_info.get("is_algolia"):
                    has_algolia = True
                else:
                    tech_item.is_competitor_search = True
                    tech_item.displacement_priority = search_info["displacement_priority"]
                    competitor_techs.append(tech_item)

                    # First competitor search found is the current provider
                    if not current_search:
                        current_search = tech_name
                        displacement_priority = search_info["displacement_priority"]

            # Categorize other technologies
            if "analytics" in tech_category:
                analytics_tools.append(tech_name)
            elif "cdn" in tech_category:
                cdn_providers.append(tech_name)
            elif "payment" in tech_category:
                payment_providers.append(tech_name)

            full_stack.append(tech_item)

        # Determine primary partner
        primary_partner = None
        if partner_techs:
            sorted_partners = sorted(partner_techs, key=lambda x: x.partner_score, reverse=True)
            primary_partner = sorted_partners[0].name

        # Cap partner score at 100
        partner_score = min(partner_score, 100)

        # Determine tech spend tier
        tech_spend = raw_data.get("tech_spend_estimate")
        tech_spend_tier = self._get_spend_tier(tech_spend)

        return {
            "domain": raw_data.get("domain"),
            "total_technologies": len(full_stack),
            "partner_technologies": [t.model_dump() for t in partner_techs],
            "primary_partner": primary_partner,
            "partner_score": partner_score,
            "competitor_technologies": [t.model_dump() for t in competitor_techs],
            "current_search_provider": current_search,
            "has_algolia": has_algolia,
            "displacement_priority": displacement_priority,
            "ecommerce_platform": ecommerce_platform,
            "cms_platform": cms_platform,
            "tech_spend_estimate": tech_spend,
            "tech_spend_tier": tech_spend_tier,
            "analytics_tools": analytics_tools,
            "cdn_providers": cdn_providers,
            "payment_providers": payment_providers,
            "full_stack": [t.model_dump() for t in full_stack],
            # Preserve source info
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_from_builtwith(self, domain: str) -> Dict[str, Any]:
        """
        Fetch technology data from BuiltWith API.

        In production, this calls the BuiltWith MCP.
        For now, returns mock data.

        Args:
            domain: The domain to look up

        Returns:
            dict with BuiltWith data and source citation
        """
        return await self._call_builtwith_api(domain)

    async def _call_builtwith_api(self, domain: str) -> Dict[str, Any]:
        """
        Call BuiltWith API (mock implementation).

        In production, this will use the BuiltWith MCP server.
        """
        now = datetime.now()

        # Mock response matching expected BuiltWith structure
        return {
            "domain": domain,
            "technologies": [
                {
                    "name": "Salesforce Commerce Cloud",
                    "category": "E-commerce",
                    "first_detected": "2019-03-15",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.95,
                },
                {
                    "name": "Elasticsearch",
                    "category": "Search",
                    "first_detected": "2020-06-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.90,
                },
                {
                    "name": "Google Analytics",
                    "category": "Analytics",
                    "first_detected": "2018-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.99,
                },
                {
                    "name": "Cloudflare",
                    "category": "CDN",
                    "first_detected": "2019-06-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.95,
                },
                {
                    "name": "Stripe",
                    "category": "Payment",
                    "first_detected": "2020-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.85,
                },
            ],
            "tech_spend_estimate": 125000,
            "source_url": f"https://builtwith.com/{domain}",
            "source_date": now.isoformat(),
        }

    async def _fetch_from_similarweb(self, domain: str) -> Dict[str, Any]:
        """
        Fetch technology data from SimilarWeb (fallback).

        Args:
            domain: The domain to look up

        Returns:
            dict with SimilarWeb data and source citation
        """
        now = datetime.now()

        # Mock SimilarWeb fallback response
        return {
            "domain": domain,
            "technologies": [
                {
                    "name": "Generic E-commerce",
                    "category": "E-commerce",
                    "confidence": 0.70,
                },
            ],
            "tech_spend_estimate": None,
            "source_url": f"https://www.similarweb.com/website/{domain}/technologies/",
            "source_date": now.isoformat(),
        }

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> TechnologyStackData:
        """
        Validate transformed data and create TechnologyStackData model.

        Args:
            domain: The requested domain
            transformed_data: Data from transform_data()

        Returns:
            Validated TechnologyStackData model
        """
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert nested dicts back to TechnologyItem models
        partner_techs = [
            TechnologyItem(**t) for t in transformed_data.get("partner_technologies", [])
        ]
        competitor_techs = [
            TechnologyItem(**t) for t in transformed_data.get("competitor_technologies", [])
        ]
        full_stack = [
            TechnologyItem(**t) for t in transformed_data.get("full_stack", [])
        ]

        return TechnologyStackData(
            domain=domain,
            total_technologies=transformed_data.get("total_technologies", 0),
            partner_technologies=partner_techs,
            primary_partner=transformed_data.get("primary_partner"),
            partner_score=transformed_data.get("partner_score", 0),
            competitor_technologies=competitor_techs,
            current_search_provider=transformed_data.get("current_search_provider"),
            has_algolia=transformed_data.get("has_algolia", False),
            displacement_priority=transformed_data.get("displacement_priority"),
            ecommerce_platform=transformed_data.get("ecommerce_platform"),
            cms_platform=transformed_data.get("cms_platform"),
            tech_spend_estimate=transformed_data.get("tech_spend_estimate"),
            tech_spend_tier=transformed_data.get("tech_spend_tier"),
            analytics_tools=transformed_data.get("analytics_tools", []),
            cdn_providers=transformed_data.get("cdn_providers", []),
            payment_providers=transformed_data.get("payment_providers", []),
            full_stack=full_stack,
        )

    def _get_spend_tier(self, spend: Optional[int]) -> Optional[str]:
        """Categorize tech spend into tiers."""
        if spend is None:
            return None
        if spend >= 100000:
            return "$100K+"
        elif spend >= 50000:
            return "$50K-100K"
        elif spend >= 25000:
            return "$25K-50K"
        elif spend >= 10000:
            return "$10K-25K"
        else:
            return "<$10K"
