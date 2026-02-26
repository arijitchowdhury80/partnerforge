"""
M01 Company Context Intelligence Module

Establishes baseline company information for all downstream analysis.
This is a Wave 1 (Foundation) module with no dependencies.

Data Sources:
- BuiltWith domain lookup (primary)
- WebSearch (secondary, fills gaps)

Output: Company name, description, headquarters, industry, employees,
regions, brands, and recent news.

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
# Data Models
# =============================================================================


class NewsItem(BaseModel):
    """News article/press release item."""

    title: str
    date: str
    url: str
    summary: Optional[str] = None


class CompanyContextData(BaseModel):
    """
    Company Context data model - output of M01 module.

    Captures baseline company information for all downstream analysis.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")
    company_name: str = Field(..., description="Official company name")

    # Company basics
    description: Optional[str] = Field(None, description="Company description")
    founded_year: Optional[int] = Field(None, description="Year company was founded")
    employee_count: Optional[int] = Field(None, description="Number of employees")
    employee_range: Optional[str] = Field(None, description="Employee range (e.g., '1000-5000')")

    # Financial estimate
    revenue_estimate: Optional[float] = Field(None, description="Estimated annual revenue (USD)")

    # Industry classification
    industry: Optional[str] = Field(None, description="Primary industry")
    sub_industry: Optional[str] = Field(None, description="Sub-industry classification")
    vertical: Optional[str] = Field(None, description="Business vertical")
    business_model: Optional[str] = Field(None, description="Business model (B2C, B2B, etc.)")

    # Geography
    headquarters_city: Optional[str] = Field(None, description="HQ city")
    headquarters_state: Optional[str] = Field(None, description="HQ state/province")
    headquarters_country: Optional[str] = Field(None, description="HQ country")
    regions_active: List[str] = Field(default_factory=list, description="Active regions")

    # Online presence
    website_url: Optional[str] = Field(None, description="Main website URL")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn company page")
    twitter_handle: Optional[str] = Field(None, description="Twitter/X handle")

    # Corporate structure
    parent_company: Optional[str] = Field(None, description="Parent company if subsidiary")
    brands: List[str] = Field(default_factory=list, description="Subsidiary brands")

    # Recent activity
    recent_news: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Recent news items with title, date, url, summary"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M01CompanyContextModule(BaseIntelligenceModule):
    """
    M01: Company Context - baseline company information.

    Wave 1 (Foundation) module with no dependencies.
    Collects foundational company data from BuiltWith and WebSearch.
    """

    MODULE_ID = "m01_company_context"
    MODULE_NAME = "Company Context"
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
            ModuleResult with CompanyContextData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching company context for: {domain}")

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
        company_data = await self._validate_and_store(domain, transformed)

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
            data=company_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched company context for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch raw data from BuiltWith and WebSearch.

        Attempts BuiltWith first (primary source), then WebSearch
        to fill in gaps.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged data from all sources
        """
        builtwith_data = {}
        websearch_data = {}
        errors = []

        # Try BuiltWith (primary)
        try:
            builtwith_data = await self._fetch_from_builtwith(domain)
            self.logger.debug(f"BuiltWith returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"BuiltWith fetch failed for {domain}: {e}")
            errors.append(f"BuiltWith: {e}")

        # Try WebSearch (secondary)
        try:
            websearch_data = await self._fetch_from_websearch(domain)
            self.logger.debug(f"WebSearch returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"WebSearch fetch failed for {domain}: {e}")
            errors.append(f"WebSearch: {e}")

        # If both sources failed, raise error
        if not builtwith_data and not websearch_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        # Merge data from both sources
        merged = await self._merge_sources(builtwith_data, websearch_data)

        return merged

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into CompanyContextData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching CompanyContextData fields
        """
        # Extract headquarters from nested structure
        headquarters = raw_data.get("headquarters", {})

        return {
            "domain": raw_data.get("domain"),
            "company_name": raw_data.get("company_name"),
            "description": raw_data.get("description"),
            "founded_year": raw_data.get("founded_year"),
            "employee_count": raw_data.get("employee_count"),
            "employee_range": raw_data.get("employee_range"),
            "revenue_estimate": raw_data.get("revenue_estimate"),
            "industry": raw_data.get("industry"),
            "sub_industry": raw_data.get("sub_industry"),
            "vertical": raw_data.get("vertical"),
            "business_model": raw_data.get("business_model"),
            "headquarters_city": headquarters.get("city") if headquarters else None,
            "headquarters_state": headquarters.get("state") if headquarters else None,
            "headquarters_country": headquarters.get("country") if headquarters else None,
            "regions_active": raw_data.get("regions_active", []),
            "website_url": raw_data.get("website_url"),
            "linkedin_url": raw_data.get("linkedin_url"),
            "twitter_handle": raw_data.get("twitter_handle"),
            "parent_company": raw_data.get("parent_company"),
            "brands": raw_data.get("brands", []),
            "recent_news": raw_data.get("recent_news", []),
            # Preserve source info for result creation
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_from_builtwith(self, domain: str) -> Dict[str, Any]:
        """
        Fetch company data from BuiltWith API.

        In production, this calls the BuiltWith MCP.
        For now, returns mock data.

        Args:
            domain: The domain to look up

        Returns:
            dict with BuiltWith data and source citation
        """
        # TODO: Replace with actual BuiltWith API call
        # For now, return mock data structure that matches real API
        return await self._call_builtwith_api(domain)

    async def _call_builtwith_api(self, domain: str) -> Dict[str, Any]:
        """
        Call BuiltWith API (mock implementation).

        In production, this will use the BuiltWith MCP server.
        """
        # Mock response matching expected BuiltWith structure
        # This simulates what the real API would return
        now = datetime.now()

        return {
            "domain": domain,
            "company_name": self._infer_company_name(domain),
            "industry": "Retail",
            "sub_industry": "E-commerce",
            "employee_count": 10000,
            "employee_range": "5000-10000",
            "headquarters": {
                "city": "San Francisco",
                "state": "California",
                "country": "USA"
            },
            "source_url": f"https://builtwith.com/{domain}",
            "source_date": now.isoformat(),
        }

    async def _fetch_from_websearch(self, domain: str) -> Dict[str, Any]:
        """
        Fetch company data from WebSearch.

        Searches for company information, Wikipedia entries,
        and recent news.

        Args:
            domain: The domain to research

        Returns:
            dict with WebSearch data and source citation
        """
        # TODO: Replace with actual WebSearch API call
        return await self._call_websearch_api(domain)

    async def _call_websearch_api(self, domain: str) -> Dict[str, Any]:
        """
        Call WebSearch API (mock implementation).

        In production, this will search for company info.
        """
        now = datetime.now()

        return {
            "company_name": self._infer_company_name(domain),
            "description": f"A leading company operating {domain}.",
            "founded_year": 2000,
            "revenue_estimate": 100000000,
            "regions_active": ["North America", "Europe"],
            "brands": [self._infer_company_name(domain).replace(" Inc.", "")],
            "recent_news": [
                {
                    "title": f"{self._infer_company_name(domain)} Announces Q1 Results",
                    "date": now.strftime("%Y-%m-%d"),
                    "url": f"https://businesswire.com/{domain}/news",
                    "summary": "Company reports strong quarterly performance."
                }
            ],
            "source_url": f"https://www.{domain}/about/",
            "source_date": now.isoformat(),
        }

    async def _merge_sources(
        self,
        builtwith_data: Dict[str, Any],
        websearch_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge data from BuiltWith and WebSearch sources.

        Priority: BuiltWith wins for overlapping fields.
        WebSearch fills in fields not present in BuiltWith.

        Args:
            builtwith_data: Data from BuiltWith API
            websearch_data: Data from WebSearch

        Returns:
            Merged data dictionary with source citation
        """
        merged = {}

        # Start with WebSearch data as base (lower priority)
        if websearch_data:
            merged.update(websearch_data)

        # Override with BuiltWith data (higher priority)
        if builtwith_data:
            for key, value in builtwith_data.items():
                if value is not None:
                    merged[key] = value

        # Ensure we have a source_url (prefer BuiltWith)
        if builtwith_data.get("source_url"):
            merged["source_url"] = builtwith_data["source_url"]
            merged["source_date"] = builtwith_data.get("source_date")
        elif websearch_data.get("source_url"):
            merged["source_url"] = websearch_data["source_url"]
            merged["source_date"] = websearch_data.get("source_date")

        return merged

    async def _validate_and_store(
        self,
        domain: str,
        merged_data: Dict[str, Any]
    ) -> CompanyContextData:
        """
        Validate merged data and create CompanyContextData model.

        Args:
            domain: The requested domain
            merged_data: Merged data from all sources

        Returns:
            Validated CompanyContextData model

        Raises:
            ValueError: If domain mismatch or validation fails
        """
        # Validate domain matches
        data_domain = merged_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Create data model (Pydantic validates the schema)
        return CompanyContextData(
            domain=domain,
            company_name=merged_data.get("company_name", "Unknown"),
            description=merged_data.get("description"),
            founded_year=merged_data.get("founded_year"),
            employee_count=merged_data.get("employee_count"),
            employee_range=merged_data.get("employee_range"),
            revenue_estimate=merged_data.get("revenue_estimate"),
            industry=merged_data.get("industry"),
            sub_industry=merged_data.get("sub_industry"),
            vertical=merged_data.get("vertical"),
            business_model=merged_data.get("business_model"),
            headquarters_city=merged_data.get("headquarters_city"),
            headquarters_state=merged_data.get("headquarters_state"),
            headquarters_country=merged_data.get("headquarters_country"),
            regions_active=merged_data.get("regions_active", []),
            website_url=merged_data.get("website_url"),
            linkedin_url=merged_data.get("linkedin_url"),
            twitter_handle=merged_data.get("twitter_handle"),
            parent_company=merged_data.get("parent_company"),
            brands=merged_data.get("brands", []),
            recent_news=merged_data.get("recent_news", []),
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
        import re
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)

        # Capitalize words
        name = " ".join(word.capitalize() for word in name.split())

        return f"{name} Inc."
