"""
M06 Hiring Signals Intelligence Module

Detects search-related hiring signals that indicate company investment
in search infrastructure. Part of Wave 2 (no strict dependencies).

Data Sources:
- WebSearch (primary - careers pages, job postings)

Output: Total open roles, search-related roles, engineering/product roles,
hiring velocity, and search relevance score.

SOURCE CITATION MANDATE: Every data point MUST have source_url and source_date.
"""

import logging
import re
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

# Keywords that indicate search-related roles
SEARCH_KEYWORDS = [
    "search",
    "relevance",
    "nlp",
    "natural language",
    "discovery",
    "recommendations",
    "elasticsearch",
    "elastic search",
    "solr",
    "machine learning",
    "ml engineer",
    "information retrieval",
    "ranking",
    "personalization",
    "algolia",
    "lucene",
    "query",
    "indexing",
]

# Keywords that indicate engineering roles
ENGINEERING_KEYWORDS = [
    "engineer",
    "engineering",
    "developer",
    "development",
    "software",
    "swe",
    "backend",
    "frontend",
    "fullstack",
    "full-stack",
    "full stack",
    "devops",
    "sre",
    "infrastructure",
    "platform",
    "data engineer",
    "architect",
]

# Keywords that indicate product roles
PRODUCT_KEYWORDS = [
    "product manager",
    "product owner",
    "product lead",
    "product director",
    "product design",
    "product strategy",
    "pm ",
    "pmo",
    "ux",
    "user experience",
    "user research",
]


# =============================================================================
# Data Models
# =============================================================================


class JobPosting(BaseModel):
    """Individual job posting details."""

    title: str
    location: Optional[str] = None
    department: Optional[str] = None
    url: Optional[str] = None
    is_search_related: bool = False
    is_engineering: bool = False
    is_product: bool = False


class HiringSignalsData(BaseModel):
    """
    Hiring Signals data model - output of M06 module.

    Captures hiring patterns that indicate search infrastructure investment.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Role counts
    total_open_roles: int = Field(0, description="Total number of open positions")
    search_related_roles: List[str] = Field(
        default_factory=list,
        description="List of search-related job titles"
    )
    search_related_count: int = Field(0, description="Count of search-related roles")
    engineering_roles: int = Field(0, description="Count of engineering roles")
    product_roles: int = Field(0, description="Count of product roles")

    # Velocity and scoring
    hiring_velocity: str = Field(
        "low",
        description="Hiring velocity: high (50+), medium (20-49), low (<20)"
    )
    search_relevance_score: float = Field(
        0.0,
        description="0-100 score based on search-related hiring signals"
    )
    signal_strength: str = Field(
        "weak",
        description="Overall signal strength: strong, moderate, weak"
    )

    # Detailed data
    job_postings: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of job posting details"
    )

    # Career page info
    careers_page_url: Optional[str] = Field(None, description="Company careers page URL")
    job_board_url: Optional[str] = Field(None, description="External job board URL")

    # Insights
    hiring_insights: List[str] = Field(
        default_factory=list,
        description="Key insights from hiring analysis"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M06HiringSignalsModule(BaseIntelligenceModule):
    """
    M06: Hiring Signals - detect search-related hiring patterns.

    Wave 2 module with no strict dependencies.
    Analyzes job postings to identify search infrastructure investment signals.
    """

    MODULE_ID = "m06_hiring"
    MODULE_NAME = "Hiring Signals"
    WAVE = 2
    DEPENDS_ON = []
    SOURCE_TYPE = "webpage"
    CACHE_TTL = 259200  # 3 days (hiring data changes frequently)

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with HiringSignalsData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching hiring signals for: {domain}")

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
        hiring_data = await self._validate_and_store(domain, transformed)

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
            data=hiring_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched hiring signals for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch raw hiring data from WebSearch.

        Searches for careers page, job postings, and hiring announcements.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged job data from all sources
        """
        websearch_data = {}
        errors = []

        # Try WebSearch for careers page and job postings
        try:
            websearch_data = await self._fetch_from_websearch(domain)
            self.logger.debug(f"WebSearch returned hiring data for: {domain}")
        except Exception as e:
            self.logger.warning(f"WebSearch fetch failed for {domain}: {e}")
            errors.append(f"WebSearch: {e}")

        # If WebSearch failed, raise error
        if not websearch_data:
            raise Exception(
                f"Failed to enrich hiring signals for {domain}. "
                f"All sources failed: {'; '.join(errors)}"
            )

        return websearch_data

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into HiringSignalsData schema.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching HiringSignalsData fields
        """
        job_postings = raw_data.get("job_postings", [])

        # Classify jobs
        search_related_roles = []
        engineering_count = 0
        product_count = 0

        for job in job_postings:
            title = job.get("title", "").lower()

            # Check if search-related
            is_search = self._is_search_related(title)
            if is_search:
                search_related_roles.append(job.get("title", ""))

            # Check if engineering
            if self._is_engineering_role(title):
                engineering_count += 1

            # Check if product
            if self._is_product_role(title):
                product_count += 1

        total_roles = raw_data.get("total_open_roles", len(job_postings))

        # Calculate hiring velocity
        velocity = self._calculate_velocity(total_roles)

        # Calculate search relevance score
        relevance_score = self._calculate_search_relevance(
            total_roles,
            len(search_related_roles),
            engineering_count,
        )

        # Determine signal strength
        signal_strength = self._determine_signal_strength(
            relevance_score,
            len(search_related_roles),
        )

        # Generate insights
        insights = self._generate_insights(
            total_roles,
            len(search_related_roles),
            engineering_count,
            product_count,
            velocity,
        )

        return {
            "domain": raw_data.get("domain"),
            "total_open_roles": total_roles,
            "search_related_roles": search_related_roles,
            "search_related_count": len(search_related_roles),
            "engineering_roles": engineering_count,
            "product_roles": product_count,
            "hiring_velocity": velocity,
            "search_relevance_score": relevance_score,
            "signal_strength": signal_strength,
            "job_postings": job_postings,
            "careers_page_url": raw_data.get("careers_page_url"),
            "job_board_url": raw_data.get("job_board_url"),
            "hiring_insights": insights,
            # Preserve source info for result creation
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_from_websearch(self, domain: str) -> Dict[str, Any]:
        """
        Fetch hiring data from WebSearch.

        Searches for careers page and job postings.

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

        In production, this will search for company careers info.
        """
        now = datetime.now()
        company_name = self._infer_company_name(domain)

        # Mock response matching expected structure
        return {
            "domain": domain,
            "total_open_roles": 45,
            "careers_page_url": f"https://www.{domain}/careers",
            "job_board_url": f"https://jobs.lever.co/{domain.split('.')[0]}",
            "job_postings": [
                {
                    "title": "Senior Search Engineer",
                    "location": "Remote",
                    "department": "Engineering",
                    "url": f"https://jobs.lever.co/{domain.split('.')[0]}/search-engineer"
                },
                {
                    "title": "Machine Learning Engineer - Recommendations",
                    "location": "San Francisco, CA",
                    "department": "Engineering",
                    "url": f"https://jobs.lever.co/{domain.split('.')[0]}/ml-engineer"
                },
                {
                    "title": "Product Manager - Discovery",
                    "location": "New York, NY",
                    "department": "Product",
                    "url": f"https://jobs.lever.co/{domain.split('.')[0]}/pm-discovery"
                },
                {
                    "title": "Backend Software Engineer",
                    "location": "Austin, TX",
                    "department": "Engineering",
                    "url": f"https://jobs.lever.co/{domain.split('.')[0]}/backend-swe"
                },
                {
                    "title": "Frontend Developer",
                    "location": "Remote",
                    "department": "Engineering",
                    "url": f"https://jobs.lever.co/{domain.split('.')[0]}/frontend-dev"
                },
                {
                    "title": "Data Engineer",
                    "location": "Seattle, WA",
                    "department": "Data",
                    "url": f"https://jobs.lever.co/{domain.split('.')[0]}/data-engineer"
                },
                {
                    "title": "NLP Engineer",
                    "location": "Remote",
                    "department": "Engineering",
                    "url": f"https://jobs.lever.co/{domain.split('.')[0]}/nlp-engineer"
                },
            ],
            "source_url": f"https://www.{domain}/careers",
            "source_date": now.isoformat(),
        }

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> HiringSignalsData:
        """
        Validate transformed data and create HiringSignalsData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated HiringSignalsData model

        Raises:
            ValueError: If domain mismatch or validation fails
        """
        # Validate domain matches
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Create data model (Pydantic validates the schema)
        return HiringSignalsData(
            domain=domain,
            total_open_roles=transformed_data.get("total_open_roles", 0),
            search_related_roles=transformed_data.get("search_related_roles", []),
            search_related_count=transformed_data.get("search_related_count", 0),
            engineering_roles=transformed_data.get("engineering_roles", 0),
            product_roles=transformed_data.get("product_roles", 0),
            hiring_velocity=transformed_data.get("hiring_velocity", "low"),
            search_relevance_score=transformed_data.get("search_relevance_score", 0.0),
            signal_strength=transformed_data.get("signal_strength", "weak"),
            job_postings=transformed_data.get("job_postings", []),
            careers_page_url=transformed_data.get("careers_page_url"),
            job_board_url=transformed_data.get("job_board_url"),
            hiring_insights=transformed_data.get("hiring_insights", []),
        )

    def _is_search_related(self, title: str) -> bool:
        """
        Check if a job title indicates a search-related role.

        Args:
            title: Job title (lowercased)

        Returns:
            True if the role is search-related
        """
        title_lower = title.lower()
        return any(keyword in title_lower for keyword in SEARCH_KEYWORDS)

    def _is_engineering_role(self, title: str) -> bool:
        """
        Check if a job title indicates an engineering role.

        Args:
            title: Job title (lowercased)

        Returns:
            True if the role is engineering
        """
        title_lower = title.lower()
        return any(keyword in title_lower for keyword in ENGINEERING_KEYWORDS)

    def _is_product_role(self, title: str) -> bool:
        """
        Check if a job title indicates a product role.

        Args:
            title: Job title (lowercased)

        Returns:
            True if the role is product-related
        """
        title_lower = title.lower()
        return any(keyword in title_lower for keyword in PRODUCT_KEYWORDS)

    def _calculate_velocity(self, total_roles: int) -> str:
        """
        Calculate hiring velocity based on total open roles.

        Args:
            total_roles: Total number of open positions

        Returns:
            "high" (50+), "medium" (20-49), or "low" (<20)
        """
        if total_roles >= 50:
            return "high"
        elif total_roles >= 20:
            return "medium"
        else:
            return "low"

    def _calculate_search_relevance(
        self,
        total_roles: int,
        search_roles: int,
        engineering_roles: int,
    ) -> float:
        """
        Calculate search relevance score (0-100).

        Score is based on:
        - Number of search-related roles (50% weight)
        - Ratio of search roles to engineering roles (30% weight)
        - Total hiring volume (20% weight)

        Args:
            total_roles: Total open positions
            search_roles: Number of search-related roles
            engineering_roles: Number of engineering roles

        Returns:
            Score from 0-100
        """
        if total_roles == 0:
            return 0.0

        # Search role count score (50% weight, max 50 points)
        # 5+ search roles = 50 points, scaled down from there
        search_count_score = min(search_roles * 10, 50)

        # Search/engineering ratio score (30% weight, max 30 points)
        if engineering_roles > 0:
            ratio = search_roles / engineering_roles
            ratio_score = min(ratio * 30, 30)
        else:
            ratio_score = 15 if search_roles > 0 else 0

        # Volume score (20% weight, max 20 points)
        # 100+ roles = 20 points, scaled down from there
        volume_score = min(total_roles / 5, 20)

        return round(search_count_score + ratio_score + volume_score, 1)

    def _determine_signal_strength(
        self,
        relevance_score: float,
        search_role_count: int,
    ) -> str:
        """
        Determine overall signal strength.

        Args:
            relevance_score: The search relevance score (0-100)
            search_role_count: Number of search-related roles

        Returns:
            "strong", "moderate", or "weak"
        """
        if relevance_score >= 60 or search_role_count >= 3:
            return "strong"
        elif relevance_score >= 30 or search_role_count >= 1:
            return "moderate"
        else:
            return "weak"

    def _generate_insights(
        self,
        total_roles: int,
        search_roles: int,
        engineering_roles: int,
        product_roles: int,
        velocity: str,
    ) -> List[str]:
        """
        Generate hiring insights from the analysis.

        Args:
            total_roles: Total open positions
            search_roles: Number of search-related roles
            engineering_roles: Number of engineering roles
            product_roles: Number of product roles
            velocity: Hiring velocity (high/medium/low)

        Returns:
            List of insight strings
        """
        insights = []

        # Velocity insight
        if velocity == "high":
            insights.append(f"High hiring velocity with {total_roles} open positions indicates rapid growth.")
        elif velocity == "medium":
            insights.append(f"Moderate hiring activity with {total_roles} open positions.")

        # Search-related insight
        if search_roles >= 3:
            insights.append(
                f"Strong search investment signal: {search_roles} search-related roles "
                f"(search, NLP, relevance, recommendations)."
            )
        elif search_roles >= 1:
            insights.append(
                f"Search investment indicator: {search_roles} search-related role(s) detected."
            )

        # Engineering vs product balance
        if engineering_roles > 0 and product_roles > 0:
            ratio = engineering_roles / product_roles if product_roles > 0 else 0
            if ratio > 5:
                insights.append("Engineering-heavy hiring suggests technical build-out phase.")
            elif ratio < 2:
                insights.append("Balanced engineering/product hiring indicates mature product organization.")

        # No search roles
        if search_roles == 0 and engineering_roles > 5:
            insights.append("No explicit search roles despite engineering hiring - potential opportunity.")

        return insights

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
