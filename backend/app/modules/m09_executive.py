"""
M09 Executive Intelligence Module

Profiles key executives for personalized outreach and "Speaking Their Language" mapping.
This is a Wave 3 module that depends on M01 (Company Context) and M07 (Strategic Context).

Data Sources:
- WebSearch (LinkedIn profiles, company management pages, press releases)
- Conference speaker databases
- Earnings call transcripts

Output: Executive profiles with tenure tracking, buyer role mapping,
and quote-to-product mapping for Algolia alignment.

SOURCE CITATION MANDATE: Every data point MUST have source_url and source_date.
"""

import logging
import re
from datetime import datetime, timedelta
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
# Data Models
# =============================================================================


class QuoteToProductMapping(BaseModel):
    """Maps executive quotes to Algolia products."""

    quote: str = Field(..., description="Direct quote from the executive")
    maps_to: str = Field(..., description="Algolia product(s) that address this need")
    source_url: str = Field(..., description="Source URL for the quote")
    source_date: Optional[str] = Field(None, description="Date of the quote")


class SpeakingLanguage(BaseModel):
    """Executive's terminology and how it maps to Algolia."""

    terms_used: List[str] = Field(
        default_factory=list,
        description="Terms/phrases the executive commonly uses"
    )
    quote_to_product_mapping: List[QuoteToProductMapping] = Field(
        default_factory=list,
        description="Quotes mapped to Algolia products"
    )


class Executive(BaseModel):
    """Individual executive profile."""

    name: str = Field(..., description="Full name")
    title: str = Field(..., description="Current title")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    tenure_start: Optional[str] = Field(None, description="When they started in role (YYYY-MM)")
    tenure_months: Optional[int] = Field(None, description="Months in current role")
    is_new_to_role: bool = Field(False, description="True if tenure < 18 months")
    background: Optional[str] = Field(None, description="Career background summary")
    buyer_role: Optional[str] = Field(
        None,
        description="Role in buying process: Executive Sponsor, Economic Buyer, Technical Buyer, Champion, User Buyer"
    )
    priority: str = Field(default="MEDIUM", description="Outreach priority: HIGH, MEDIUM, LOW")
    speaking_language: Optional[SpeakingLanguage] = Field(
        None,
        description="Executive's terminology mapped to Algolia"
    )
    is_active_on_linkedin: bool = Field(False, description="Active on LinkedIn")
    speaks_at_events: List[str] = Field(default_factory=list, description="Events they speak at")
    entry_approach: Optional[str] = Field(None, description="Recommended approach for outreach")
    source_url: str = Field(..., description="Primary source URL for this profile")
    source_date: Optional[str] = Field(None, description="Date of source")


class DigitalLeadershipQuote(BaseModel):
    """Quote from leadership about digital/search strategy."""

    speaker: str = Field(..., description="Name of the speaker")
    title: str = Field(..., description="Title of the speaker")
    quote: str = Field(..., description="The quote text")
    context: Optional[str] = Field(None, description="Context (earnings call, interview, etc.)")
    algolia_mapping: Optional[str] = Field(None, description="How this maps to Algolia products")
    source_url: str = Field(..., description="Source URL")
    source_date: Optional[str] = Field(None, description="Date of quote")


class ExecutiveIntelligenceData(BaseModel):
    """
    Executive Intelligence data model - output of M09 module.

    Profiles key executives for personalized outreach and
    "Speaking Their Language" alignment.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain")

    # Executive profiles
    executives: List[Executive] = Field(
        default_factory=list,
        description="List of executive profiles"
    )

    # Key role profiles (quick access)
    ceo_profile: Optional[Executive] = Field(None, description="CEO profile")
    cto_profile: Optional[Executive] = Field(None, description="CTO profile")
    cio_profile: Optional[Executive] = Field(None, description="CIO profile")
    cdo_profile: Optional[Executive] = Field(None, description="CDO (Chief Digital Officer) profile")
    cmo_profile: Optional[Executive] = Field(None, description="CMO profile")

    # Executive changes
    recent_executive_changes: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Recent departures, arrivals, promotions"
    )
    leadership_turnover_insight: Optional[str] = Field(
        None,
        description="Analysis of leadership changes and implications"
    )

    # Digital leadership quotes
    digital_leadership_quotes: List[DigitalLeadershipQuote] = Field(
        default_factory=list,
        description="Quotes about digital/search strategy"
    )

    # Entry strategy
    recommended_entry_points: List[str] = Field(
        default_factory=list,
        description="Recommended first contacts and approach"
    )

    # Summary stats
    total_executives_profiled: int = Field(default=0)
    new_in_role_count: int = Field(default=0, description="Executives with tenure < 18 months")


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M09ExecutiveIntelligenceModule(BaseIntelligenceModule):
    """
    M09: Executive Intelligence - profiles key executives for outreach.

    Wave 3 module that depends on M01 (Company Context) and M07 (Strategic Context).
    Uses WebSearch to find executive profiles, LinkedIn data, and recent quotes.
    """

    MODULE_ID = "m09_executive"
    MODULE_NAME = "Executive Intelligence"
    WAVE = 3
    DEPENDS_ON = ["m01_company_context", "m07_strategic"]
    SOURCE_TYPE = "webpage"
    CACHE_TTL = 604800  # 7 days

    # Tenure threshold for "new in role" (18 months)
    NEW_IN_ROLE_THRESHOLD_MONTHS = 18

    # Key C-suite titles to prioritize
    KEY_TITLES = {
        "ceo": ["CEO", "Chief Executive Officer", "President & CEO", "President and CEO"],
        "cto": ["CTO", "Chief Technology Officer", "SVP Technology", "EVP Technology"],
        "cio": ["CIO", "Chief Information Officer", "SVP IT", "SVP & CIO"],
        "cdo": ["CDO", "Chief Digital Officer", "Chief Data Officer", "SVP Digital"],
        "cmo": ["CMO", "Chief Marketing Officer", "SVP Marketing"],
    }

    # Buyer role mapping based on title
    BUYER_ROLE_MAP = {
        "CEO": "Executive Sponsor",
        "President": "Executive Sponsor",
        "CFO": "Economic Buyer",
        "CTO": "Technical Buyer",
        "CIO": "Technical Buyer",
        "CDO": "Technical Buyer",
        "CMO": "Economic Buyer",
        "VP, Digital": "Champion",
        "VP, E-commerce": "Champion",
        "VP, Product": "Champion",
        "Director": "User Buyer",
        "Manager": "User Buyer",
    }

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with ExecutiveIntelligenceData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching executive intelligence for: {domain}")

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
        executive_data = await self._validate_and_store(domain, transformed)

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
            data=executive_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched executive intelligence for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch raw data from WebSearch for executive profiles.

        Searches for:
        1. Company leadership/management page
        2. LinkedIn profiles of executives
        3. Recent press releases and interviews
        4. Conference speaker bios

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged data from all sources
        """
        linkedin_data = {}
        management_data = {}
        quotes_data = {}
        errors = []

        # Try LinkedIn search (primary)
        try:
            linkedin_data = await self._fetch_linkedin_profiles(domain)
            self.logger.debug(f"LinkedIn search returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"LinkedIn search failed for {domain}: {e}")
            errors.append(f"LinkedIn: {e}")

        # Try company management page
        try:
            management_data = await self._fetch_management_page(domain)
            self.logger.debug(f"Management page returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"Management page fetch failed for {domain}: {e}")
            errors.append(f"Management: {e}")

        # Try executive quotes
        try:
            quotes_data = await self._fetch_executive_quotes(domain)
            self.logger.debug(f"Quotes search returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"Quotes search failed for {domain}: {e}")
            errors.append(f"Quotes: {e}")

        # If all sources failed, raise error
        if not linkedin_data and not management_data and not quotes_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        # Merge data from all sources
        merged = await self._merge_sources(linkedin_data, management_data, quotes_data)

        return merged

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into ExecutiveIntelligenceData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching ExecutiveIntelligenceData fields
        """
        executives = raw_data.get("executives", [])

        # Process executives to add derived fields
        processed_executives = []
        for exec_data in executives:
            processed = self._process_executive(exec_data)
            processed_executives.append(processed)

        # Extract C-suite profiles
        ceo_profile = self._find_executive_by_role(processed_executives, "ceo")
        cto_profile = self._find_executive_by_role(processed_executives, "cto")
        cio_profile = self._find_executive_by_role(processed_executives, "cio")
        cdo_profile = self._find_executive_by_role(processed_executives, "cdo")
        cmo_profile = self._find_executive_by_role(processed_executives, "cmo")

        # Count new-in-role executives
        new_in_role_count = sum(1 for e in processed_executives if e.get("is_new_to_role", False))

        # Generate recommended entry points
        entry_points = self._generate_entry_points(processed_executives)

        return {
            "domain": raw_data.get("domain"),
            "executives": processed_executives,
            "ceo_profile": ceo_profile,
            "cto_profile": cto_profile,
            "cio_profile": cio_profile,
            "cdo_profile": cdo_profile,
            "cmo_profile": cmo_profile,
            "recent_executive_changes": raw_data.get("recent_executive_changes", []),
            "leadership_turnover_insight": raw_data.get("leadership_turnover_insight"),
            "digital_leadership_quotes": raw_data.get("digital_leadership_quotes", []),
            "recommended_entry_points": entry_points,
            "total_executives_profiled": len(processed_executives),
            "new_in_role_count": new_in_role_count,
            # Preserve source info
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    def _process_executive(self, exec_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process an executive record to add derived fields."""
        processed = exec_data.copy()

        # Calculate tenure months if tenure_start provided
        tenure_start = processed.get("tenure_start")
        if tenure_start:
            try:
                start_date = datetime.strptime(tenure_start, "%Y-%m")
                months = self._calculate_months_since(start_date)
                processed["tenure_months"] = months
                processed["is_new_to_role"] = months < self.NEW_IN_ROLE_THRESHOLD_MONTHS
            except ValueError:
                pass

        # Infer buyer role from title
        if not processed.get("buyer_role"):
            processed["buyer_role"] = self._infer_buyer_role(processed.get("title", ""))

        # Set priority based on buyer role
        if not processed.get("priority") or processed.get("priority") == "MEDIUM":
            processed["priority"] = self._infer_priority(processed.get("buyer_role"))

        # Generate entry approach if not provided
        if not processed.get("entry_approach"):
            processed["entry_approach"] = self._generate_entry_approach(processed)

        return processed

    def _calculate_months_since(self, start_date: datetime) -> int:
        """Calculate months between start_date and now."""
        now = datetime.now()
        months = (now.year - start_date.year) * 12 + (now.month - start_date.month)
        return max(0, months)

    def _infer_buyer_role(self, title: str) -> str:
        """Infer buyer role from executive title."""
        title_upper = title.upper()

        for pattern, role in self.BUYER_ROLE_MAP.items():
            if pattern.upper() in title_upper:
                return role

        return "User Buyer"  # Default

    def _infer_priority(self, buyer_role: Optional[str]) -> str:
        """Infer priority from buyer role."""
        high_priority_roles = ["Executive Sponsor", "Economic Buyer", "Technical Buyer", "Champion"]
        if buyer_role in high_priority_roles:
            return "HIGH"
        return "MEDIUM"

    def _generate_entry_approach(self, exec_data: Dict[str, Any]) -> str:
        """Generate recommended entry approach for an executive."""
        approaches = []

        if exec_data.get("is_new_to_role"):
            approaches.append("New in role - fresh perspective on technology investments")

        if exec_data.get("is_active_on_linkedin"):
            approaches.append("Active on LinkedIn - good for initial outreach")

        if exec_data.get("speaks_at_events"):
            events = exec_data["speaks_at_events"]
            approaches.append(f"Speaks at {', '.join(events[:2])} - reference for conversation")

        buyer_role = exec_data.get("buyer_role")
        if buyer_role == "Technical Buyer":
            approaches.append("Technical deep-dive, integration discussion")
        elif buyer_role == "Economic Buyer":
            approaches.append("ROI case, business value focus")
        elif buyer_role == "Champion":
            approaches.append("First conversation, builds internal case")

        return "; ".join(approaches) if approaches else "Standard executive outreach"

    def _find_executive_by_role(
        self, executives: List[Dict[str, Any]], role_key: str
    ) -> Optional[Dict[str, Any]]:
        """Find executive matching a C-suite role."""
        titles = self.KEY_TITLES.get(role_key, [])

        for exec_data in executives:
            title = exec_data.get("title", "")
            for key_title in titles:
                if key_title.upper() in title.upper():
                    return exec_data

        return None

    def _generate_entry_points(self, executives: List[Dict[str, Any]]) -> List[str]:
        """Generate recommended entry points based on executive profiles."""
        entry_points = []

        # Prioritize champions who are active on LinkedIn
        for exec_data in executives:
            if exec_data.get("buyer_role") == "Champion" and exec_data.get("is_active_on_linkedin"):
                entry_points.append(
                    f"{exec_data['name']} - LinkedIn, {exec_data.get('title', 'Champion')}"
                )

        # Add technical buyers (new in role preferred)
        for exec_data in executives:
            if exec_data.get("buyer_role") == "Technical Buyer":
                note = "new in role" if exec_data.get("is_new_to_role") else "established"
                entry_points.append(
                    f"{exec_data['name']} - Technical deep-dive ({note})"
                )

        # Add economic buyers
        for exec_data in executives:
            if exec_data.get("buyer_role") == "Economic Buyer":
                entry_points.append(
                    f"{exec_data['name']} - Executive briefing, ROI case"
                )

        return entry_points[:5]  # Top 5

    async def _fetch_linkedin_profiles(self, domain: str) -> Dict[str, Any]:
        """
        Fetch executive profiles from LinkedIn via WebSearch.

        In production, this calls WebSearch API.
        For now, returns mock data.
        """
        return await self._call_linkedin_search(domain)

    async def _call_linkedin_search(self, domain: str) -> Dict[str, Any]:
        """Call LinkedIn search (mock implementation)."""
        now = datetime.now()
        company_name = self._infer_company_name(domain)

        return {
            "executives": [
                {
                    "name": "John Smith",
                    "title": "President & CEO",
                    "linkedin_url": f"https://www.linkedin.com/in/johnsmith-{domain.split('.')[0]}/",
                    "tenure_start": "2021-03",
                    "background": "Former COO, 20+ years in industry",
                    "is_active_on_linkedin": True,
                    "source_url": f"https://www.linkedin.com/in/johnsmith-{domain.split('.')[0]}/",
                    "source_date": now.isoformat(),
                },
                {
                    "name": "Sarah Johnson",
                    "title": "SVP & CIO",
                    "linkedin_url": f"https://www.linkedin.com/in/sarahjohnson-{domain.split('.')[0]}/",
                    "tenure_start": "2024-06",  # New in role
                    "background": "Former VP IT at major retailer",
                    "is_active_on_linkedin": False,
                    "source_url": f"https://www.linkedin.com/in/sarahjohnson-{domain.split('.')[0]}/",
                    "source_date": now.isoformat(),
                },
                {
                    "name": "Michael Chen",
                    "title": "VP, Digital Product",
                    "linkedin_url": f"https://www.linkedin.com/in/michaelchen-{domain.split('.')[0]}/",
                    "tenure_start": "2022-01",
                    "background": "Digital transformation leader",
                    "is_active_on_linkedin": True,
                    "speaks_at_events": ["CommerceNext", "Shoptalk"],
                    "source_url": f"https://www.linkedin.com/in/michaelchen-{domain.split('.')[0]}/",
                    "source_date": now.isoformat(),
                },
            ],
            "source_url": f"https://www.linkedin.com/company/{domain.split('.')[0]}/people/",
            "source_date": now.isoformat(),
        }

    async def _fetch_management_page(self, domain: str) -> Dict[str, Any]:
        """
        Fetch executive data from company management page.

        In production, this fetches the company's about/leadership page.
        """
        return await self._call_management_page(domain)

    async def _call_management_page(self, domain: str) -> Dict[str, Any]:
        """Call management page fetch (mock implementation)."""
        now = datetime.now()

        return {
            "recent_executive_changes": [
                {
                    "type": "arrival",
                    "name": "Sarah Johnson",
                    "title": "SVP & CIO",
                    "date": "2024-06",
                    "from_company": "Target Corporation",
                    "source_url": f"https://www.{domain}/about/leadership/",
                }
            ],
            "leadership_turnover_insight": "Recent CIO hire creates opportunity for new technology relationships",
            "source_url": f"https://www.{domain}/about/leadership/",
            "source_date": now.isoformat(),
        }

    async def _fetch_executive_quotes(self, domain: str) -> Dict[str, Any]:
        """
        Fetch executive quotes from earnings calls, interviews, press releases.

        In production, this searches for executive quotes via WebSearch.
        """
        return await self._call_quotes_search(domain)

    async def _call_quotes_search(self, domain: str) -> Dict[str, Any]:
        """Call quotes search (mock implementation)."""
        now = datetime.now()
        company_name = self._infer_company_name(domain)

        return {
            "digital_leadership_quotes": [
                {
                    "speaker": "John Smith",
                    "title": "President & CEO",
                    "quote": "We're investing in more efficient search to help customers find products faster",
                    "context": "Q4 2025 Earnings Call",
                    "algolia_mapping": "Algolia InstantSearch, Dynamic Faceting",
                    "source_url": f"https://seekingalpha.com/article/{domain.split('.')[0]}-q4-2025-earnings",
                    "source_date": now.isoformat(),
                },
                {
                    "speaker": "Sarah Johnson",
                    "title": "SVP & CIO",
                    "quote": "Personalization is key to our digital transformation strategy",
                    "context": "Industry Conference",
                    "algolia_mapping": "Algolia Personalization, AI Recommendations",
                    "source_url": f"https://www.retaildive.com/{domain.split('.')[0]}-digital-strategy",
                    "source_date": now.isoformat(),
                },
            ],
            "source_url": f"https://seekingalpha.com/symbol/{domain.split('.')[0].upper()}",
            "source_date": now.isoformat(),
        }

    async def _merge_sources(
        self,
        linkedin_data: Dict[str, Any],
        management_data: Dict[str, Any],
        quotes_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge data from LinkedIn, management page, and quotes sources.

        Priority: LinkedIn for profiles, Management for changes, Quotes for quotes.
        """
        merged = {}

        # Start with LinkedIn data (primary for executive profiles)
        if linkedin_data:
            merged.update(linkedin_data)

        # Add management data
        if management_data:
            merged["recent_executive_changes"] = management_data.get("recent_executive_changes", [])
            merged["leadership_turnover_insight"] = management_data.get("leadership_turnover_insight")

        # Add quotes data
        if quotes_data:
            merged["digital_leadership_quotes"] = quotes_data.get("digital_leadership_quotes", [])

        # Ensure we have a source_url (prefer LinkedIn)
        if linkedin_data.get("source_url"):
            merged["source_url"] = linkedin_data["source_url"]
            merged["source_date"] = linkedin_data.get("source_date")
        elif management_data.get("source_url"):
            merged["source_url"] = management_data["source_url"]
            merged["source_date"] = management_data.get("source_date")
        elif quotes_data.get("source_url"):
            merged["source_url"] = quotes_data["source_url"]
            merged["source_date"] = quotes_data.get("source_date")

        return merged

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> ExecutiveIntelligenceData:
        """
        Validate transformed data and create ExecutiveIntelligenceData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated ExecutiveIntelligenceData model

        Raises:
            ValueError: If domain mismatch or validation fails
        """
        # Validate domain matches
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert executive dicts to Executive models
        executives = []
        for exec_dict in transformed_data.get("executives", []):
            # Convert speaking_language if present
            if exec_dict.get("speaking_language"):
                sl_data = exec_dict["speaking_language"]
                if isinstance(sl_data, dict):
                    # Convert quote mappings
                    quote_mappings = []
                    for qm in sl_data.get("quote_to_product_mapping", []):
                        quote_mappings.append(QuoteToProductMapping(**qm))
                    exec_dict["speaking_language"] = SpeakingLanguage(
                        terms_used=sl_data.get("terms_used", []),
                        quote_to_product_mapping=quote_mappings
                    )
            executives.append(Executive(**exec_dict))

        # Convert C-suite profiles
        def convert_executive(data: Optional[Dict]) -> Optional[Executive]:
            if data is None:
                return None
            if isinstance(data, Executive):
                return data
            return Executive(**data)

        # Convert digital leadership quotes
        quotes = []
        for quote_dict in transformed_data.get("digital_leadership_quotes", []):
            quotes.append(DigitalLeadershipQuote(**quote_dict))

        return ExecutiveIntelligenceData(
            domain=domain,
            executives=executives,
            ceo_profile=convert_executive(transformed_data.get("ceo_profile")),
            cto_profile=convert_executive(transformed_data.get("cto_profile")),
            cio_profile=convert_executive(transformed_data.get("cio_profile")),
            cdo_profile=convert_executive(transformed_data.get("cdo_profile")),
            cmo_profile=convert_executive(transformed_data.get("cmo_profile")),
            recent_executive_changes=transformed_data.get("recent_executive_changes", []),
            leadership_turnover_insight=transformed_data.get("leadership_turnover_insight"),
            digital_leadership_quotes=quotes,
            recommended_entry_points=transformed_data.get("recommended_entry_points", []),
            total_executives_profiled=transformed_data.get("total_executives_profiled", 0),
            new_in_role_count=transformed_data.get("new_in_role_count", 0),
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
        # Remove TLD
        name = domain.split(".")[0]

        # Split camelCase and add spaces
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)

        # Capitalize words
        name = " ".join(word.capitalize() for word in name.split())

        return f"{name} Inc."
