"""
M02 Technology Stack Intelligence Module

Detects technologies in use for partner matching and displacement opportunities.
This is a Wave 1 (Foundation) module with no dependencies.

Data Sources:
- BuiltWith MCP (7 endpoints): domain-lookup, relationships-api, recommendations-api,
  financial-api, social-api, trust-api, keywords-api
- SimilarWeb get-website-content-technologies-agg (fallback)

Output: Current search provider, CMS, e-commerce platform, analytics tools,
ad tech, all technologies with partner matching and displacement opportunity detection.

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
# Constants
# =============================================================================

# Known search providers (for displacement detection)
SEARCH_PROVIDERS = {
    "algolia": {"name": "Algolia", "is_algolia": True, "competitor": False},
    "elasticsearch": {"name": "Elasticsearch", "is_algolia": False, "competitor": True},
    "coveo": {"name": "Coveo", "is_algolia": False, "competitor": True},
    "searchspring": {"name": "Searchspring", "is_algolia": False, "competitor": True},
    "klevu": {"name": "Klevu", "is_algolia": False, "competitor": True},
    "constructor.io": {"name": "Constructor.io", "is_algolia": False, "competitor": True},
    "constructor": {"name": "Constructor.io", "is_algolia": False, "competitor": True},
    "bloomreach": {"name": "Bloomreach", "is_algolia": False, "competitor": True},
    "sooqr": {"name": "Sooqr", "is_algolia": False, "competitor": True},
    "doofinder": {"name": "Doofinder", "is_algolia": False, "competitor": True},
    "yext": {"name": "Yext", "is_algolia": False, "competitor": True},
    "lucidworks": {"name": "Lucidworks", "is_algolia": False, "competitor": True},
    "swiftype": {"name": "Swiftype", "is_algolia": False, "competitor": True},
    "einstein search": {"name": "Salesforce Einstein", "is_algolia": False, "competitor": True},
    "salesforce einstein": {"name": "Salesforce Einstein", "is_algolia": False, "competitor": True},
}

# Partner technologies (for co-sell opportunities)
PARTNER_TECHNOLOGIES = {
    "shopify plus": {"partner": "Shopify", "tier": "Premium"},
    "shopify": {"partner": "Shopify", "tier": "Standard"},
    "adobe commerce": {"partner": "Adobe", "tier": "Premium"},
    "magento": {"partner": "Adobe", "tier": "Premium"},
    "adobe experience manager": {"partner": "Adobe", "tier": "Premium"},
    "aem": {"partner": "Adobe", "tier": "Premium"},
    "salesforce commerce cloud": {"partner": "Salesforce", "tier": "Premium"},
    "sfcc": {"partner": "Salesforce", "tier": "Premium"},
    "demandware": {"partner": "Salesforce", "tier": "Premium"},
    "commercetools": {"partner": "commercetools", "tier": "Premium"},
    "bigcommerce": {"partner": "BigCommerce", "tier": "Standard"},
    "contentful": {"partner": "Contentful", "tier": "Premium"},
    "amplience": {"partner": "Amplience", "tier": "Premium"},
    "sitecore": {"partner": "Sitecore", "tier": "Premium"},
    "vtex": {"partner": "VTEX", "tier": "Premium"},
}

# Technology categories
TECH_CATEGORIES = {
    "search": ["algolia", "elasticsearch", "coveo", "searchspring", "klevu",
               "constructor.io", "bloomreach", "swiftype", "doofinder", "yext",
               "lucidworks", "einstein search", "salesforce einstein"],
    "ecommerce": ["shopify", "shopify plus", "magento", "adobe commerce",
                  "salesforce commerce cloud", "sfcc", "demandware", "commercetools",
                  "bigcommerce", "woocommerce", "vtex", "prestashop", "opencart"],
    "cms": ["wordpress", "drupal", "contentful", "amplience", "adobe experience manager",
            "aem", "sitecore", "kentico", "episerver", "optimizely"],
    "analytics": ["google analytics", "adobe analytics", "segment", "mixpanel",
                  "amplitude", "heap", "hotjar", "fullstory", "pendo"],
    "ad_tech": ["google ads", "facebook pixel", "google tag manager", "tealium",
                "criteo", "tradedoubler", "pinterest tag", "snapchat pixel"],
    "crm": ["salesforce", "hubspot", "microsoft dynamics", "zoho crm", "pipedrive"],
    "payment": ["stripe", "braintree", "paypal", "adyen", "klarna", "afterpay"],
    "cdn": ["cloudflare", "akamai", "fastly", "cloudfront", "stackpath"],
}


# =============================================================================
# Data Models
# =============================================================================


class TechnologyItem(BaseModel):
    """Individual technology detected on a domain."""

    name: str = Field(..., description="Technology name")
    category: str = Field(..., description="Technology category")
    tag: Optional[str] = Field(None, description="Short tag/abbreviation")
    is_partner_tech: bool = Field(False, description="Is this an Algolia partner technology?")
    partner_name: Optional[str] = Field(None, description="Partner name if partner tech")
    partner_tier: Optional[str] = Field(None, description="Partner tier (Premium/Standard)")
    is_competitor_search: bool = Field(False, description="Is this a competitor search provider?")
    competitor_name: Optional[str] = Field(None, description="Competitor name if competitor search")
    first_detected: Optional[str] = Field(None, description="First detection date (ISO format)")
    last_detected: Optional[str] = Field(None, description="Last detection date (ISO format)")
    confidence: float = Field(0.95, description="Detection confidence (0-1)")


class SearchProviderInfo(BaseModel):
    """Information about the current search provider."""

    current: Optional[str] = Field(None, description="Current search provider name")
    is_algolia: bool = Field(False, description="Is the current provider Algolia?")
    is_competitor: bool = Field(False, description="Is using a competitor search provider?")
    displacement_priority: str = Field("MEDIUM", description="Displacement priority (HIGH/MEDIUM/LOW)")
    native_platform_search: bool = Field(False, description="Using native platform search")


class TechStackData(BaseModel):
    """
    Technology Stack data model - output of M02 module.

    Captures all detected technologies and identifies displacement opportunities.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Technology inventory
    technologies: List[TechnologyItem] = Field(
        default_factory=list,
        description="All detected technologies"
    )

    # Search provider analysis
    search_provider: SearchProviderInfo = Field(
        default_factory=SearchProviderInfo,
        description="Search provider information"
    )

    # Partner technologies
    partner_technologies: List[str] = Field(
        default_factory=list,
        description="Detected partner technologies"
    )

    # Category summaries
    cms: Optional[str] = Field(None, description="Primary CMS")
    ecommerce_platform: Optional[str] = Field(None, description="Primary e-commerce platform")
    analytics_tools: List[str] = Field(default_factory=list, description="Analytics tools")
    ad_tech: List[str] = Field(default_factory=list, description="Ad tech/marketing tools")
    payment_providers: List[str] = Field(default_factory=list, description="Payment providers")
    cdn: Optional[str] = Field(None, description="Primary CDN")

    # Financial estimate
    tech_spend_estimate: Optional[float] = Field(
        None, description="Estimated annual tech spend (USD)"
    )
    tech_spend_source: Optional[str] = Field(
        None, description="Source of tech spend estimate"
    )

    # All technologies (flat list)
    all_technologies: List[str] = Field(
        default_factory=list,
        description="Simple list of all technology names"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M02TechStackModule(BaseIntelligenceModule):
    """
    M02: Technology Stack - detect technologies and displacement opportunities.

    Wave 1 (Foundation) module with no dependencies.
    Collects technology data from BuiltWith and SimilarWeb.
    """

    MODULE_ID = "m02_tech_stack"
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
            ModuleResult with TechStackData and source citation

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
        Fetch raw data from BuiltWith and SimilarWeb.

        Attempts BuiltWith first (primary source), then SimilarWeb
        to fill in gaps.

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

        # Try SimilarWeb (secondary)
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

        # Merge data from both sources
        merged = await self._merge_sources(builtwith_data, similarweb_data)

        return merged

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into TechStackData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching TechStackData fields
        """
        # Process technologies list
        technologies = raw_data.get("technologies", [])
        processed_technologies = await self._process_technologies(technologies)

        # Identify search provider
        search_provider = await self._identify_search_provider(processed_technologies)

        # Identify partner technologies
        partner_techs = await self._identify_partner_technologies(processed_technologies)

        # Categorize technologies
        categorized = await self._categorize_technologies(processed_technologies)

        # Build all_technologies list
        all_tech_names = [t.get("name", "") for t in processed_technologies if t.get("name")]

        return {
            "domain": raw_data.get("domain"),
            "technologies": processed_technologies,
            "search_provider": search_provider,
            "partner_technologies": partner_techs,
            "cms": categorized.get("cms"),
            "ecommerce_platform": categorized.get("ecommerce"),
            "analytics_tools": categorized.get("analytics", []),
            "ad_tech": categorized.get("ad_tech", []),
            "payment_providers": categorized.get("payment", []),
            "cdn": categorized.get("cdn"),
            "tech_spend_estimate": raw_data.get("tech_spend_estimate"),
            "tech_spend_source": raw_data.get("tech_spend_source"),
            "all_technologies": all_tech_names,
            # Preserve source info for result creation
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
        # Mock response matching expected BuiltWith structure
        now = datetime.now()

        return {
            "domain": domain,
            "technologies": [
                {
                    "name": "Salesforce Commerce Cloud",
                    "category": "ecommerce",
                    "tag": "SFCC",
                    "first_detected": "2019-03-15",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.95
                },
                {
                    "name": "Einstein Search",
                    "category": "search",
                    "tag": "SFCC",
                    "first_detected": "2021-06-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.85
                },
                {
                    "name": "Google Analytics",
                    "category": "analytics",
                    "first_detected": "2015-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.99
                },
                {
                    "name": "Cloudflare",
                    "category": "cdn",
                    "first_detected": "2020-01-01",
                    "last_detected": now.strftime("%Y-%m-%d"),
                    "confidence": 0.98
                }
            ],
            "tech_spend_estimate": 125000,
            "tech_spend_source": "BuiltWith Financial API",
            "source_url": f"https://builtwith.com/{domain}",
            "source_date": now.isoformat(),
        }

    async def _fetch_from_similarweb(self, domain: str) -> Dict[str, Any]:
        """
        Fetch technology data from SimilarWeb.

        Uses the get-website-content-technologies-agg endpoint.

        Args:
            domain: The domain to research

        Returns:
            dict with SimilarWeb data and source citation
        """
        return await self._call_similarweb_api(domain)

    async def _call_similarweb_api(self, domain: str) -> Dict[str, Any]:
        """
        Call SimilarWeb API (mock implementation).

        In production, this will use the SimilarWeb MCP.
        """
        now = datetime.now()

        return {
            "domain": domain,
            "technologies": [
                {
                    "name": "Google Tag Manager",
                    "category": "ad_tech",
                    "confidence": 0.90
                },
                {
                    "name": "Facebook Pixel",
                    "category": "ad_tech",
                    "confidence": 0.85
                },
                {
                    "name": "Stripe",
                    "category": "payment",
                    "confidence": 0.80
                }
            ],
            "source_url": f"https://www.similarweb.com/website/{domain}/technologies/",
            "source_date": now.isoformat(),
        }

    async def _merge_sources(
        self,
        builtwith_data: Dict[str, Any],
        similarweb_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge data from BuiltWith and SimilarWeb sources.

        Priority: BuiltWith wins for overlapping fields.
        SimilarWeb fills in fields not present in BuiltWith.

        Args:
            builtwith_data: Data from BuiltWith API
            similarweb_data: Data from SimilarWeb

        Returns:
            Merged data dictionary with source citation
        """
        merged = {}

        # Start with SimilarWeb data as base (lower priority)
        if similarweb_data:
            merged.update(similarweb_data)

        # Override with BuiltWith data (higher priority)
        if builtwith_data:
            for key, value in builtwith_data.items():
                if key == "technologies" and value and merged.get("technologies"):
                    # Merge technology lists, deduplicating by name
                    existing_names = {t.get("name", "").lower() for t in merged["technologies"]}
                    for tech in value:
                        if tech.get("name", "").lower() not in existing_names:
                            merged["technologies"].append(tech)
                        else:
                            # Replace with BuiltWith version (higher confidence)
                            merged["technologies"] = [
                                t for t in merged["technologies"]
                                if t.get("name", "").lower() != tech.get("name", "").lower()
                            ]
                            merged["technologies"].append(tech)
                elif value is not None:
                    merged[key] = value

        # Ensure we have a source_url (prefer BuiltWith)
        if builtwith_data.get("source_url"):
            merged["source_url"] = builtwith_data["source_url"]
            merged["source_date"] = builtwith_data.get("source_date")
        elif similarweb_data.get("source_url"):
            merged["source_url"] = similarweb_data["source_url"]
            merged["source_date"] = similarweb_data.get("source_date")

        return merged

    async def _process_technologies(
        self, technologies: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Process raw technology list and add partner/competitor flags.

        Args:
            technologies: Raw technology list from API

        Returns:
            Processed list with is_partner_tech, is_competitor_search flags
        """
        processed = []

        for tech in technologies:
            name = tech.get("name", "")
            name_lower = name.lower()

            # Check if partner technology
            is_partner = False
            partner_name = None
            partner_tier = None
            for key, partner_info in PARTNER_TECHNOLOGIES.items():
                if key in name_lower:
                    is_partner = True
                    partner_name = partner_info["partner"]
                    partner_tier = partner_info["tier"]
                    break

            # Check if competitor search
            is_competitor_search = False
            competitor_name = None
            for key, search_info in SEARCH_PROVIDERS.items():
                if key in name_lower and not search_info.get("is_algolia", False):
                    is_competitor_search = search_info.get("competitor", False)
                    competitor_name = search_info.get("name")
                    break

            processed_tech = {
                "name": name,
                "category": tech.get("category", "other"),
                "tag": tech.get("tag"),
                "is_partner_tech": is_partner,
                "partner_name": partner_name,
                "partner_tier": partner_tier,
                "is_competitor_search": is_competitor_search,
                "competitor_name": competitor_name,
                "first_detected": tech.get("first_detected"),
                "last_detected": tech.get("last_detected"),
                "confidence": tech.get("confidence", 0.95),
            }
            processed.append(processed_tech)

        return processed

    async def _identify_search_provider(
        self, technologies: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Identify the current search provider from technology list.

        Args:
            technologies: Processed technology list

        Returns:
            SearchProviderInfo dict
        """
        current_provider = None
        is_algolia = False
        is_competitor = False
        native_platform_search = False

        for tech in technologies:
            name_lower = tech.get("name", "").lower()

            # Check for Algolia
            if "algolia" in name_lower:
                current_provider = "Algolia"
                is_algolia = True
                break

            # Check for competitor search providers
            for key, info in SEARCH_PROVIDERS.items():
                if key in name_lower:
                    current_provider = info["name"]
                    is_algolia = info.get("is_algolia", False)
                    is_competitor = info.get("competitor", False)

                    # Check if native platform search (Einstein, etc.)
                    if "einstein" in name_lower or "salesforce" in name_lower:
                        native_platform_search = True
                    break

            if current_provider:
                break

        # Determine displacement priority
        # Native platform search (Einstein, etc.) is MEDIUM priority - easier to replace
        # Dedicated competitor search (Elasticsearch, Coveo) is HIGH priority
        if is_algolia:
            displacement_priority = "NONE"
        elif native_platform_search:
            displacement_priority = "MEDIUM"
        elif is_competitor:
            displacement_priority = "HIGH"
        else:
            displacement_priority = "LOW"

        return {
            "current": current_provider,
            "is_algolia": is_algolia,
            "is_competitor": is_competitor,
            "displacement_priority": displacement_priority,
            "native_platform_search": native_platform_search,
        }

    async def _identify_partner_technologies(
        self, technologies: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Identify partner technologies from the tech list.

        Args:
            technologies: Processed technology list

        Returns:
            List of partner technology names
        """
        partner_techs = []
        for tech in technologies:
            if tech.get("is_partner_tech"):
                partner_techs.append(tech.get("name"))
        return partner_techs

    async def _categorize_technologies(
        self, technologies: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Categorize technologies into primary categories.

        Args:
            technologies: Processed technology list

        Returns:
            Dict with categorized technologies
        """
        result = {
            "cms": None,
            "ecommerce": None,
            "analytics": [],
            "ad_tech": [],
            "payment": [],
            "cdn": None,
        }

        for tech in technologies:
            name = tech.get("name", "")
            name_lower = name.lower()
            category = tech.get("category", "").lower()

            # CMS detection
            if category == "cms" or any(
                cms in name_lower for cms in TECH_CATEGORIES.get("cms", [])
            ):
                if result["cms"] is None:
                    result["cms"] = name

            # E-commerce detection
            if category == "ecommerce" or any(
                ec in name_lower for ec in TECH_CATEGORIES.get("ecommerce", [])
            ):
                if result["ecommerce"] is None:
                    result["ecommerce"] = name

            # Analytics detection
            if category == "analytics" or any(
                an in name_lower for an in TECH_CATEGORIES.get("analytics", [])
            ):
                if name not in result["analytics"]:
                    result["analytics"].append(name)

            # Ad tech detection
            if category == "ad_tech" or any(
                ad in name_lower for ad in TECH_CATEGORIES.get("ad_tech", [])
            ):
                if name not in result["ad_tech"]:
                    result["ad_tech"].append(name)

            # Payment detection
            if category == "payment" or any(
                pay in name_lower for pay in TECH_CATEGORIES.get("payment", [])
            ):
                if name not in result["payment"]:
                    result["payment"].append(name)

            # CDN detection
            if category == "cdn" or any(
                cdn in name_lower for cdn in TECH_CATEGORIES.get("cdn", [])
            ):
                if result["cdn"] is None:
                    result["cdn"] = name

        return result

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> TechStackData:
        """
        Validate transformed data and create TechStackData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated TechStackData model

        Raises:
            ValueError: If domain mismatch or validation fails
        """
        # Validate domain matches
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert technology dicts to TechnologyItem models
        tech_items = []
        for tech in transformed_data.get("technologies", []):
            tech_items.append(TechnologyItem(**tech))

        # Create SearchProviderInfo
        search_info = SearchProviderInfo(
            **transformed_data.get("search_provider", {})
        )

        # Create data model (Pydantic validates the schema)
        return TechStackData(
            domain=domain,
            technologies=tech_items,
            search_provider=search_info,
            partner_technologies=transformed_data.get("partner_technologies", []),
            cms=transformed_data.get("cms"),
            ecommerce_platform=transformed_data.get("ecommerce_platform"),
            analytics_tools=transformed_data.get("analytics_tools", []),
            ad_tech=transformed_data.get("ad_tech", []),
            payment_providers=transformed_data.get("payment_providers", []),
            cdn=transformed_data.get("cdn"),
            tech_spend_estimate=transformed_data.get("tech_spend_estimate"),
            tech_spend_source=transformed_data.get("tech_spend_source"),
            all_technologies=transformed_data.get("all_technologies", []),
        )

    def _infer_company_name(self, domain: str) -> str:
        """
        Infer company name from domain.

        Used as fallback when API doesn't return company name.

        Args:
            domain: Domain like "sallybeauty.com"

        Returns:
            Inferred company name like "Sally Beauty Inc."
        """
        import re
        # Remove TLD
        name = domain.split(".")[0]

        # Split camelCase and add spaces
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)

        # Capitalize words
        name = " ".join(word.capitalize() for word in name.split())

        return f"{name} Inc."
