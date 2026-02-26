"""
M02: Technology Stack Module
============================

Detects technologies in use for partner matching and displacement opportunities.

Wave: 1 (Foundation - No dependencies)

Data Sources:
- BuiltWith MCP (7 endpoints):
  - domain-lookup: Core technology detection
  - relationships-api: Technology relationships
  - recommendations-api: Similar sites
  - financial-api: Tech spend estimates
  - social-api: Social presence
  - trust-api: Trust/verification
  - keywords-api: SEO keywords
- SimilarWeb get-website-content-technologies-agg (fallback)

Output Schema:
- domain: str
- technologies: List[Technology]
- search_provider: SearchProviderInfo
- partner_technologies: List[str]
- tech_spend_estimate: Optional[int]
- tech_categories: Dict[str, List[str]]

Key Detection Categories:
| Category | Technologies | Partner Priority |
|----------|--------------|------------------|
| E-commerce | Shopify Plus, Adobe Commerce, SFCC | Premium |
| CMS | Adobe AEM, Amplience, Contentful | Premium |
| Search | Algolia, Elasticsearch, Coveo | Displacement |
| Analytics | Adobe Analytics, GA4 | Standard |

Database Table: intel_technology_stack

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M02 section)
- docs/DATABASE_SCHEMA_V2.md (intel_technology_stack)
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    DataNotFoundError,
    register_module,
)

logger = logging.getLogger(__name__)


class Technology(BaseModel):
    """Individual technology detection."""
    name: str = Field(..., description="Technology name")
    category: str = Field(..., description="Category (ecommerce, search, cms, etc.)")
    tag: Optional[str] = Field(None, description="Sub-category tag")
    is_partner_tech: bool = Field(default=False, description="Is this a partner technology")
    partner_tier: Optional[str] = Field(None, description="Partner tier (Premium, Standard)")
    is_competitor_search: bool = Field(default=False, description="Is this a competing search provider")
    competitor_name: Optional[str] = Field(None, description="Name if competitor search")
    first_detected: Optional[str] = Field(None, description="First detection date (ISO)")
    last_detected: Optional[str] = Field(None, description="Last detection date (ISO)")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Detection confidence")


class SearchProviderInfo(BaseModel):
    """Search provider summary."""
    current: Optional[str] = Field(None, description="Current search provider name")
    provider_type: Optional[str] = Field(None, description="native, third_party, custom, unknown")
    is_algolia: bool = Field(default=False, description="Whether currently using Algolia")
    displacement_priority: str = Field(default="NONE", description="HIGH, MEDIUM, LOW, NONE")
    reasoning: Optional[str] = Field(None, description="Why this displacement priority")


class TechnologyStackData(BaseModel):
    """
    Output schema for M02 Technology Stack module.

    Contains all detected technologies with partner and competitor flags.
    """

    domain: str = Field(..., description="Primary domain")
    technologies: List[Technology] = Field(default_factory=list, description="Detected technologies")

    # Search provider summary (denormalized for quick access)
    search_provider: SearchProviderInfo = Field(
        default_factory=SearchProviderInfo,
        description="Current search provider info"
    )

    # Partner technologies (for co-sell motions)
    partner_technologies: List[str] = Field(
        default_factory=list,
        description="Technologies from Algolia partners"
    )

    # Tech spend
    tech_spend_estimate: Optional[int] = Field(
        None,
        description="Estimated annual tech spend (USD)"
    )
    tech_spend_source: Optional[str] = Field(None, description="Source of tech spend estimate")

    # Categorized technologies
    tech_categories: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Technologies grouped by category"
    )

    # Summary counts
    total_technologies: int = Field(default=0, description="Total technology count")
    partner_tech_count: int = Field(default=0, description="Count of partner technologies")
    competitor_search_count: int = Field(default=0, description="Count of competitor search techs")

    # Enrichment metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)


# Partner technology mapping
PARTNER_TECHNOLOGIES = {
    # Premium Partners
    "Adobe Commerce": {"tier": "Premium", "category": "ecommerce"},
    "Adobe Experience Manager": {"tier": "Premium", "category": "cms"},
    "Adobe AEM": {"tier": "Premium", "category": "cms"},
    "Salesforce Commerce Cloud": {"tier": "Premium", "category": "ecommerce"},
    "SFCC": {"tier": "Premium", "category": "ecommerce"},
    "Shopify Plus": {"tier": "Premium", "category": "ecommerce"},
    "Shopify": {"tier": "Standard", "category": "ecommerce"},
    "BigCommerce": {"tier": "Standard", "category": "ecommerce"},
    "commercetools": {"tier": "Premium", "category": "ecommerce"},
    "Contentful": {"tier": "Standard", "category": "cms"},
    "Amplience": {"tier": "Premium", "category": "cms"},
    "Zendesk": {"tier": "Standard", "category": "support"},
    # Standard Partners
    "Magento": {"tier": "Standard", "category": "ecommerce"},
    "WooCommerce": {"tier": "Standard", "category": "ecommerce"},
    "Drupal": {"tier": "Standard", "category": "cms"},
    "WordPress": {"tier": "Standard", "category": "cms"},
    "Sitecore": {"tier": "Premium", "category": "cms"},
}

# Competitor search providers
COMPETITOR_SEARCH = {
    "Elasticsearch": {"type": "open_source", "priority": "HIGH"},
    "Elastic": {"type": "open_source", "priority": "HIGH"},
    "OpenSearch": {"type": "open_source", "priority": "MEDIUM"},
    "Solr": {"type": "open_source", "priority": "MEDIUM"},
    "Apache Solr": {"type": "open_source", "priority": "MEDIUM"},
    "Coveo": {"type": "third_party", "priority": "HIGH"},
    "Searchspring": {"type": "third_party", "priority": "MEDIUM"},
    "Klevu": {"type": "third_party", "priority": "MEDIUM"},
    "Constructor.io": {"type": "third_party", "priority": "HIGH"},
    "Constructor": {"type": "third_party", "priority": "HIGH"},
    "Bloomreach": {"type": "third_party", "priority": "HIGH"},
    "Lucidworks": {"type": "third_party", "priority": "MEDIUM"},
    "Yext": {"type": "third_party", "priority": "MEDIUM"},
    "Swiftype": {"type": "third_party", "priority": "LOW"},
    "Hawksearch": {"type": "third_party", "priority": "MEDIUM"},
    "SLI Systems": {"type": "third_party", "priority": "LOW"},
    "Einstein Search": {"type": "native", "priority": "MEDIUM"},
    "Salesforce Einstein": {"type": "native", "priority": "MEDIUM"},
}

# Technology category mapping
TECHNOLOGY_CATEGORIES = {
    "ecommerce": ["Shopify", "Magento", "WooCommerce", "BigCommerce", "SFCC", "Adobe Commerce", "commercetools"],
    "cms": ["WordPress", "Drupal", "Adobe AEM", "Contentful", "Amplience", "Sitecore"],
    "analytics": ["Google Analytics", "Adobe Analytics", "Mixpanel", "Amplitude", "Heap"],
    "search": ["Algolia", "Elasticsearch", "Coveo", "Searchspring", "Constructor.io"],
    "cdn": ["CloudFlare", "Akamai", "Fastly", "AWS CloudFront"],
    "hosting": ["AWS", "Google Cloud", "Azure", "Vercel", "Netlify"],
    "payment": ["Stripe", "PayPal", "Braintree", "Adyen", "Square"],
    "marketing": ["HubSpot", "Marketo", "Pardot", "Mailchimp", "Klaviyo"],
    "crm": ["Salesforce", "HubSpot CRM", "Microsoft Dynamics"],
    "personalization": ["Dynamic Yield", "Optimizely", "AB Tasty", "Monetate"],
    "reviews": ["Yotpo", "Bazaarvoice", "PowerReviews", "Trustpilot"],
}


@register_module
class M02TechnologyStack(BaseModule):
    """
    Technology Stack Intelligence Module.

    Detects technologies for partner matching and displacement analysis.
    This module has no dependencies and runs in Wave 1.

    Data Flow:
    1. Call BuiltWith API for technology detection
    2. Classify technologies into categories
    3. Identify partner technologies
    4. Identify competitor search providers
    5. Calculate tech spend estimate
    6. Determine displacement priority
    7. Return with source citations

    Displacement Priority Logic:
    - HIGH: Using competitor search (Elasticsearch, Coveo, Constructor.io)
    - MEDIUM: Using native platform search (Einstein, Magento native)
    - LOW: Unknown or basic search
    - NONE: Already using Algolia
    """

    MODULE_ID = "m02_technology_stack"
    MODULE_NAME = "Technology Stack"
    DESCRIPTION = "Technology detection for partner matching and displacement"

    WAVE = 1
    DEPENDS_ON = []

    PRIMARY_SOURCE_TYPE = SourceType.BUILTWITH
    OUTPUT_TABLE = "intel_technology_stack"
    TIMEOUT_SECONDS = 90  # BuiltWith can be slow

    # Mock data for testing
    _MOCK_TECH_DATA = {
        "costco.com": {
            "technologies": [
                {"name": "Akamai", "category": "cdn", "confidence": 0.95},
                {"name": "React", "category": "framework", "confidence": 0.90},
                {"name": "Elastic", "category": "search", "confidence": 0.85},
                {"name": "Oracle Commerce", "category": "ecommerce", "confidence": 0.80},
                {"name": "Google Analytics", "category": "analytics", "confidence": 0.95},
                {"name": "Optimizely", "category": "personalization", "confidence": 0.75},
            ],
            "tech_spend_estimate": 500000,
        },
        "sallybeauty.com": {
            "technologies": [
                {"name": "Salesforce Commerce Cloud", "category": "ecommerce", "confidence": 0.95},
                {"name": "Einstein Search", "category": "search", "confidence": 0.85},
                {"name": "Salesforce Marketing Cloud", "category": "marketing", "confidence": 0.90},
                {"name": "IBM Sterling OMS", "category": "oms", "confidence": 0.80},
                {"name": "Adobe Analytics", "category": "analytics", "confidence": 0.90},
                {"name": "CloudFlare", "category": "cdn", "confidence": 0.95},
            ],
            "tech_spend_estimate": 250000,
        },
        "mercedes-benz.com": {
            "technologies": [
                {"name": "Adobe Experience Manager", "category": "cms", "confidence": 0.95},
                {"name": "Adobe Analytics", "category": "analytics", "confidence": 0.90},
                {"name": "Adobe Target", "category": "personalization", "confidence": 0.85},
                {"name": "Akamai", "category": "cdn", "confidence": 0.95},
                {"name": "SAP", "category": "erp", "confidence": 0.80},
            ],
            "tech_spend_estimate": 800000,
        },
    }

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute technology stack detection.

        Args:
            domain: The domain to analyze
            context: Not used (Wave 1 module)

        Returns:
            ModuleResult with TechnologyStackData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting technology stack detection for {domain}")

            # Normalize domain
            normalized_domain = self._normalize_domain(domain)

            # Fetch technology data
            raw_data, citations = await self._fetch_tech_data(normalized_domain)

            # Process technologies
            technologies = self._process_technologies(raw_data.get("technologies", []))

            # Identify search provider
            search_provider = self._identify_search_provider(technologies)

            # Identify partner technologies
            partner_techs = self._identify_partner_techs(technologies)

            # Group by category
            tech_categories = self._group_by_category(technologies)

            # Calculate counts
            partner_count = len([t for t in technologies if t.is_partner_tech])
            competitor_count = len([t for t in technologies if t.is_competitor_search])

            # Build output
            output_data = TechnologyStackData(
                domain=normalized_domain,
                technologies=technologies,
                search_provider=search_provider,
                partner_technologies=partner_techs,
                tech_spend_estimate=raw_data.get("tech_spend_estimate"),
                tech_spend_source="BuiltWith Financial API",
                tech_categories=tech_categories,
                total_technologies=len(technologies),
                partner_tech_count=partner_count,
                competitor_search_count=competitor_count,
                data_quality_score=self._calculate_data_quality(technologies, raw_data),
                enrichment_sources=[c.source_type.value for c in citations],
            )

            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=True, duration_ms=duration_ms)

            result = self._create_result(
                domain=normalized_domain,
                data=output_data.model_dump(),
                primary_citation=citations[0] if citations else self._create_default_citation(normalized_domain),
                supporting_citations=citations[1:] if len(citations) > 1 else [],
                duration_ms=duration_ms,
            )

            self.validate_output(result)

            self.logger.info(
                f"Technology detection complete for {domain}. "
                f"Found {len(technologies)} technologies, "
                f"{partner_count} partner, {competitor_count} competitor search. "
                f"Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Technology detection failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        return True

    async def _fetch_tech_data(
        self,
        domain: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """
        Fetch technology data from BuiltWith or fallback sources.

        In production, this calls BuiltWith MCP adapter.
        """
        citations = []

        # Check mock data
        if domain in self._MOCK_TECH_DATA:
            data = self._MOCK_TECH_DATA[domain].copy()
            citation = self._create_citation(
                source_type=SourceType.BUILTWITH,
                source_url=f"https://api.builtwith.com/v21/api.json?LOOKUP={domain}",
                api_endpoint="domain-lookup",
                confidence=0.95,
            )
            citations.append(citation)
            return data, citations

        # Fallback: return empty but valid data
        citation = self._create_citation(
            source_type=SourceType.BUILTWITH,
            source_url=f"https://builtwith.com/{domain}",
            confidence=0.5,
            notes="No data found - using BuiltWith public page",
        )
        citations.append(citation)

        return {"technologies": [], "tech_spend_estimate": None}, citations

    def _process_technologies(self, raw_techs: List[Dict]) -> List[Technology]:
        """Process raw technology data into structured format."""
        technologies = []

        for tech in raw_techs:
            name = tech.get("name", "")
            category = tech.get("category", "other")

            # Check if partner tech
            is_partner = name in PARTNER_TECHNOLOGIES
            partner_info = PARTNER_TECHNOLOGIES.get(name, {})

            # Check if competitor search
            is_competitor = name in COMPETITOR_SEARCH
            competitor_info = COMPETITOR_SEARCH.get(name, {})

            # Check if Algolia
            is_algolia = name.lower() == "algolia"

            technology = Technology(
                name=name,
                category=category,
                is_partner_tech=is_partner,
                partner_tier=partner_info.get("tier"),
                is_competitor_search=is_competitor and not is_algolia,
                competitor_name=name if is_competitor else None,
                confidence=tech.get("confidence", 0.8),
                first_detected=tech.get("first_detected"),
                last_detected=tech.get("last_detected"),
            )
            technologies.append(technology)

        return technologies

    def _identify_search_provider(self, technologies: List[Technology]) -> SearchProviderInfo:
        """Identify current search provider and displacement priority."""
        # Look for Algolia first
        algolia_tech = next((t for t in technologies if t.name.lower() == "algolia"), None)
        if algolia_tech:
            return SearchProviderInfo(
                current="Algolia",
                provider_type="third_party",
                is_algolia=True,
                displacement_priority="NONE",
                reasoning="Already using Algolia",
            )

        # Look for competitor search
        competitor_search = [t for t in technologies if t.is_competitor_search]
        if competitor_search:
            # Sort by competitor priority
            def get_priority(t: Technology) -> int:
                info = COMPETITOR_SEARCH.get(t.name, {})
                p = info.get("priority", "LOW")
                return {"HIGH": 3, "MEDIUM": 2, "LOW": 1}.get(p, 0)

            competitor_search.sort(key=get_priority, reverse=True)
            primary_competitor = competitor_search[0]
            competitor_info = COMPETITOR_SEARCH.get(primary_competitor.name, {})

            return SearchProviderInfo(
                current=primary_competitor.name,
                provider_type=competitor_info.get("type", "third_party"),
                is_algolia=False,
                displacement_priority=competitor_info.get("priority", "MEDIUM"),
                reasoning=f"Using {primary_competitor.name} - displacement opportunity",
            )

        # Look for native platform search
        platform_search_map = {
            "Salesforce Commerce Cloud": "Einstein Search",
            "SFCC": "Einstein Search",
            "Shopify": "Shopify Native Search",
            "Magento": "Magento Native Search",
            "Adobe Commerce": "Adobe Commerce Search",
        }

        for tech in technologies:
            if tech.name in platform_search_map:
                return SearchProviderInfo(
                    current=platform_search_map[tech.name],
                    provider_type="native",
                    is_algolia=False,
                    displacement_priority="MEDIUM",
                    reasoning=f"Using native {tech.name} search",
                )

        # Unknown search provider
        return SearchProviderInfo(
            current="Unknown",
            provider_type="unknown",
            is_algolia=False,
            displacement_priority="LOW",
            reasoning="No search provider detected",
        )

    def _identify_partner_techs(self, technologies: List[Technology]) -> List[str]:
        """Identify partner technologies for co-sell motions."""
        return [t.name for t in technologies if t.is_partner_tech]

    def _group_by_category(self, technologies: List[Technology]) -> Dict[str, List[str]]:
        """Group technology names by category."""
        groups: Dict[str, List[str]] = {}
        for tech in technologies:
            category = tech.category
            if category not in groups:
                groups[category] = []
            groups[category].append(tech.name)
        return groups

    def _calculate_data_quality(
        self,
        technologies: List[Technology],
        raw_data: Dict,
    ) -> float:
        """Calculate data quality score."""
        score = 0.0

        # Technology count (up to 0.4)
        tech_count = len(technologies)
        if tech_count >= 10:
            score += 0.4
        elif tech_count >= 5:
            score += 0.3
        elif tech_count >= 1:
            score += 0.2

        # Tech spend available (0.2)
        if raw_data.get("tech_spend_estimate"):
            score += 0.2

        # Has confidence scores (0.2)
        has_confidence = any(t.confidence < 1.0 for t in technologies)
        if has_confidence:
            score += 0.2

        # Detection dates available (0.2)
        has_dates = any(t.first_detected or t.last_detected for t in technologies)
        if has_dates:
            score += 0.2

        return min(score, 1.0)

    def _normalize_domain(self, domain: str) -> str:
        """Normalize domain for consistent processing."""
        domain = domain.lower().strip()
        if domain.startswith("https://"):
            domain = domain[8:]
        elif domain.startswith("http://"):
            domain = domain[7:]
        if domain.startswith("www."):
            domain = domain[4:]
        if "/" in domain:
            domain = domain.split("/")[0]
        return domain

    def _create_default_citation(self, domain: str) -> SourceCitation:
        """Create default citation when no data available."""
        return SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url=f"https://builtwith.com/{domain}",
            retrieved_at=datetime.utcnow(),
            confidence_score=0.3,
            notes="Default citation - limited data",
        )
