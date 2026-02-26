"""
M06 Hiring Signals Intelligence Module

Detects hiring patterns that indicate technology investment and decision windows.
This is a Wave 2 (Competitive) module that depends on Wave 1 modules.

Data Sources:
- LinkedIn Jobs API (via WebSearch)
- Company careers page (via WebFetch)
- Glassdoor, Indeed (via WebSearch)

Dependencies:
- M01 Company Context (for company name and location)

Output: Hiring signals organized by tier, role categories, and buying
committee indicators.

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
# Signal Tiers
# =============================================================================

TIER_1_ROLES = [
    "VP E-commerce",
    "VP Ecommerce",
    "VP Digital",
    "VP Engineering",
    "VP Product",
    "VP Technology",
    "Chief Digital Officer",
    "CDO",
    "Chief Technology Officer",
    "CTO",
    "Chief Information Officer",
    "CIO",
    "SVP E-commerce",
    "SVP Digital",
    "Director E-commerce",
    "Director Digital",
    "Director Engineering",
    "Director Product",
]

TIER_2_ROLES = [
    "Sr. Director",
    "Senior Director",
    "Head of Search",
    "Head of E-commerce",
    "Head of Digital",
    "Search Lead",
    "Product Manager, Search",
    "Product Manager, Discovery",
    "Data Analytics",
    "Customer Acquisition",
]

TIER_3_ROLES = [
    "Software Engineer",
    "Frontend Engineer",
    "Backend Engineer",
    "Full Stack Engineer",
    "Search Engineer",
    "Data Engineer",
    "Platform Engineer",
]

SEARCH_KEYWORDS = [
    "search",
    "algolia",
    "elasticsearch",
    "discovery",
    "findability",
    "relevance",
    "personalization",
    "recommendations",
]


# =============================================================================
# Data Models
# =============================================================================

class HiringRole(BaseModel):
    """Individual job posting/role."""
    title: str
    status: str = "Active"  # Active, Posted X days ago
    location: Optional[str] = None
    signal_tier: int = 3  # 1=VP/Director, 2=Manager/Sr, 3=IC
    signal_strength: str = "MODERATE"  # STRONG, MODERATE, LOW
    implication: Optional[str] = None
    source_url: Optional[str] = None
    posted_date: Optional[str] = None


class HiringSignalsData(BaseModel):
    """
    Hiring Signals data model - output of M06 module.

    Captures hiring patterns that indicate buying readiness.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Summary metrics
    total_roles: int = Field(0, description="Total open roles")
    hot_signals: int = Field(0, description="Tier 1 (VP/Director) signals")
    warm_signals: int = Field(0, description="Tier 2 (Manager/Sr) signals")
    moderate_signals: int = Field(0, description="Tier 3 (IC) signals")

    # Signal breakdown by tier
    tier_1_roles: List[HiringRole] = Field(
        default_factory=list, description="VP/Director level roles"
    )
    tier_2_roles: List[HiringRole] = Field(
        default_factory=list, description="Manager/Sr level roles"
    )
    tier_3_roles: List[HiringRole] = Field(
        default_factory=list, description="IC level roles"
    )

    # Role categories
    hiring_categories: Dict[str, int] = Field(
        default_factory=dict, description="Roles by category"
    )
    ecommerce_roles: int = Field(0, description="E-commerce related roles")
    engineering_roles: int = Field(0, description="Engineering roles")
    data_roles: int = Field(0, description="Data/Analytics roles")
    product_roles: int = Field(0, description="Product roles")
    search_roles: int = Field(0, description="Search-specific roles")

    # Keyword signals
    search_keywords_found: bool = Field(
        False, description="Whether search-related keywords found"
    )
    algolia_mentioned: bool = Field(
        False, description="Whether Algolia is mentioned"
    )
    elasticsearch_mentioned: bool = Field(
        False, description="Whether Elasticsearch is mentioned"
    )

    # Buying committee indicators
    budget_owner_hiring: bool = Field(
        False, description="Whether hiring for budget authority role"
    )
    team_expansion: bool = Field(
        False, description="Whether team expansion is indicated"
    )

    # Platform confirmation
    platform_confirmed: Optional[str] = Field(
        None, description="E-commerce platform confirmed from job postings"
    )

    # Leadership vacancies
    leadership_vacancies: List[str] = Field(
        default_factory=list, description="VP/Director level vacancies"
    )
    ai_investment_signal: bool = Field(
        False, description="Whether AI/ML investment is indicated"
    )

    # Overall signal score
    signal_score: int = Field(0, description="Hiring signal score (0-100)")

    # Source
    careers_url: Optional[str] = Field(None, description="Company careers page URL")


# =============================================================================
# Module Implementation
# =============================================================================

@register_module
class M06HiringSignalsModule(BaseIntelligenceModule):
    """
    M06: Hiring Signals - job posting analysis for buying readiness.

    Wave 2 (Competitive) module that depends on M01.
    Analyzes hiring patterns to identify decision windows.
    """

    MODULE_ID = "m06_hiring_signals"
    MODULE_NAME = "Hiring Signals"
    WAVE = 2
    DEPENDS_ON = ["m01_company_context"]
    SOURCE_TYPE = "webpage"
    CACHE_TTL = 259200  # 3 days (job postings change frequently)

    async def enrich(
        self,
        domain: str,
        force: bool = False,
        dependencies: Optional[Dict[str, ModuleResult]] = None
    ) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data
            dependencies: Results from dependent modules (M01)

        Returns:
            ModuleResult with HiringSignalsData and source citation
        """
        self.logger.info(f"Enriching hiring signals for: {domain}")

        # Validate dependencies if provided
        if dependencies and not self.validate_dependencies(dependencies):
            self.logger.warning(f"Missing dependencies for: {domain}")

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
        Fetch job posting data from various sources.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with hiring data and source citation
        """
        linkedin_data = {}
        careers_data = {}
        errors = []

        # Try LinkedIn Jobs (primary)
        try:
            linkedin_data = await self._fetch_from_linkedin(domain)
            self.logger.debug(f"LinkedIn returned job data for: {domain}")
        except Exception as e:
            self.logger.warning(f"LinkedIn fetch failed for {domain}: {e}")
            errors.append(f"LinkedIn: {e}")

        # Try company careers page (secondary)
        try:
            careers_data = await self._fetch_from_careers_page(domain)
            self.logger.debug(f"Careers page returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"Careers page fetch failed for {domain}: {e}")
            errors.append(f"Careers page: {e}")

        # If both fail, raise error
        if not linkedin_data and not careers_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        # Merge data
        merged = await self._merge_sources(linkedin_data, careers_data)
        return merged

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw job posting data into HiringSignalsData schema.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching HiringSignalsData fields
        """
        roles_raw = raw_data.get("roles", [])

        # Categorize roles by tier
        tier_1_roles = []
        tier_2_roles = []
        tier_3_roles = []
        leadership_vacancies = []

        # Category counts
        ecommerce_roles = 0
        engineering_roles = 0
        data_roles = 0
        product_roles = 0
        search_roles = 0

        # Keyword flags
        search_keywords_found = False
        algolia_mentioned = False
        elasticsearch_mentioned = False
        ai_investment_signal = False

        for role_raw in roles_raw:
            title = role_raw.get("title", "")
            title_lower = title.lower()

            # Determine tier
            tier, signal_strength, implication = self._classify_role(title)

            role = HiringRole(
                title=title,
                status=role_raw.get("status", "Active"),
                location=role_raw.get("location"),
                signal_tier=tier,
                signal_strength=signal_strength,
                implication=implication,
                source_url=role_raw.get("source_url"),
                posted_date=role_raw.get("posted_date"),
            )

            if tier == 1:
                tier_1_roles.append(role)
                leadership_vacancies.append(title)
            elif tier == 2:
                tier_2_roles.append(role)
            else:
                tier_3_roles.append(role)

            # Categorize by function
            if "ecommerce" in title_lower or "e-commerce" in title_lower:
                ecommerce_roles += 1
            if "engineer" in title_lower or "developer" in title_lower:
                engineering_roles += 1
            if "data" in title_lower or "analytics" in title_lower:
                data_roles += 1
            if "product" in title_lower:
                product_roles += 1
            if "search" in title_lower:
                search_roles += 1
                search_keywords_found = True

            # Check for keywords in description
            description = role_raw.get("description", "").lower()
            if "algolia" in description:
                algolia_mentioned = True
            if "elasticsearch" in description or "elastic" in description:
                elasticsearch_mentioned = True
            if any(kw in title_lower or kw in description for kw in ["ai", "machine learning", "ml"]):
                ai_investment_signal = True

        # Calculate signal score
        signal_score = self._calculate_signal_score(
            len(tier_1_roles), len(tier_2_roles), len(tier_3_roles),
            search_keywords_found, leadership_vacancies
        )

        # Determine hiring categories
        hiring_categories = {
            "ecommerce": ecommerce_roles,
            "engineering": engineering_roles,
            "data_analytics": data_roles,
            "product": product_roles,
            "search": search_roles,
        }

        # Budget owner hiring
        budget_owner_hiring = len(tier_1_roles) > 0

        # Team expansion
        team_expansion = len(tier_3_roles) >= 3

        return {
            "domain": raw_data.get("domain"),
            "total_roles": len(roles_raw),
            "hot_signals": len(tier_1_roles),
            "warm_signals": len(tier_2_roles),
            "moderate_signals": len(tier_3_roles),
            "tier_1_roles": [r.model_dump() for r in tier_1_roles],
            "tier_2_roles": [r.model_dump() for r in tier_2_roles],
            "tier_3_roles": [r.model_dump() for r in tier_3_roles],
            "hiring_categories": hiring_categories,
            "ecommerce_roles": ecommerce_roles,
            "engineering_roles": engineering_roles,
            "data_roles": data_roles,
            "product_roles": product_roles,
            "search_roles": search_roles,
            "search_keywords_found": search_keywords_found,
            "algolia_mentioned": algolia_mentioned,
            "elasticsearch_mentioned": elasticsearch_mentioned,
            "budget_owner_hiring": budget_owner_hiring,
            "team_expansion": team_expansion,
            "platform_confirmed": raw_data.get("platform_confirmed"),
            "leadership_vacancies": leadership_vacancies,
            "ai_investment_signal": ai_investment_signal,
            "signal_score": signal_score,
            "careers_url": raw_data.get("careers_url"),
            # Preserve source info
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_from_linkedin(self, domain: str) -> Dict[str, Any]:
        """
        Fetch job postings from LinkedIn Jobs.

        In production, this uses WebSearch to query LinkedIn Jobs.
        """
        return await self._call_linkedin_api(domain)

    async def _call_linkedin_api(self, domain: str) -> Dict[str, Any]:
        """
        Search LinkedIn Jobs (mock implementation).
        """
        now = datetime.now()
        company_name = domain.split(".")[0].replace("-", " ").title()

        # Mock response with job postings
        return {
            "domain": domain,
            "roles": [
                {
                    "title": "VP, E-commerce",
                    "status": "Active",
                    "location": "San Francisco, CA",
                    "source_url": f"https://www.linkedin.com/jobs/view/vp-ecommerce-{company_name.lower()}-1234567",
                    "posted_date": "2026-02-15",
                },
                {
                    "title": "Sr. Director, Customer Analytics",
                    "status": "Active",
                    "location": "San Francisco, CA",
                    "source_url": f"https://www.linkedin.com/jobs/view/sr-director-analytics-{company_name.lower()}-1234568",
                    "posted_date": "2026-02-10",
                },
                {
                    "title": "Software Engineer - Search",
                    "status": "Active",
                    "location": "Remote",
                    "description": "Experience with Elasticsearch or similar search technologies.",
                    "source_url": f"https://www.linkedin.com/jobs/view/search-engineer-{company_name.lower()}-1234569",
                    "posted_date": "2026-02-20",
                },
                {
                    "title": "Product Manager, Discovery",
                    "status": "Active",
                    "location": "San Francisco, CA",
                    "source_url": f"https://www.linkedin.com/jobs/view/pm-discovery-{company_name.lower()}-1234570",
                    "posted_date": "2026-02-18",
                },
                {
                    "title": "Data Engineer",
                    "status": "Active",
                    "location": "Remote",
                    "source_url": f"https://www.linkedin.com/jobs/view/data-engineer-{company_name.lower()}-1234571",
                    "posted_date": "2026-02-22",
                },
            ],
            "source_url": f"https://www.linkedin.com/company/{company_name.lower()}/jobs/",
            "source_date": now.isoformat(),
        }

    async def _fetch_from_careers_page(self, domain: str) -> Dict[str, Any]:
        """
        Fetch job postings from company careers page.

        In production, this uses Chrome MCP to scrape the careers page.
        """
        now = datetime.now()

        return {
            "domain": domain,
            "careers_url": f"https://www.{domain}/careers/",
            "roles": [],  # Would be populated from scraping
            "source_url": f"https://www.{domain}/careers/",
            "source_date": now.isoformat(),
        }

    async def _merge_sources(
        self,
        linkedin_data: Dict[str, Any],
        careers_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge job data from LinkedIn and careers page.
        """
        merged = {}

        # Start with LinkedIn (primary)
        if linkedin_data:
            merged.update(linkedin_data)

        # Add careers URL from careers page
        if careers_data.get("careers_url"):
            merged["careers_url"] = careers_data["careers_url"]

        # Merge roles (deduplicate by title)
        seen_titles = set()
        merged_roles = []
        for role in merged.get("roles", []):
            if role.get("title") not in seen_titles:
                merged_roles.append(role)
                seen_titles.add(role.get("title"))

        for role in careers_data.get("roles", []):
            if role.get("title") not in seen_titles:
                merged_roles.append(role)
                seen_titles.add(role.get("title"))

        merged["roles"] = merged_roles
        return merged

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> HiringSignalsData:
        """
        Validate transformed data and create HiringSignalsData model.
        """
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert nested dicts back to models
        tier_1_roles = [
            HiringRole(**r) for r in transformed_data.get("tier_1_roles", [])
        ]
        tier_2_roles = [
            HiringRole(**r) for r in transformed_data.get("tier_2_roles", [])
        ]
        tier_3_roles = [
            HiringRole(**r) for r in transformed_data.get("tier_3_roles", [])
        ]

        return HiringSignalsData(
            domain=domain,
            total_roles=transformed_data.get("total_roles", 0),
            hot_signals=transformed_data.get("hot_signals", 0),
            warm_signals=transformed_data.get("warm_signals", 0),
            moderate_signals=transformed_data.get("moderate_signals", 0),
            tier_1_roles=tier_1_roles,
            tier_2_roles=tier_2_roles,
            tier_3_roles=tier_3_roles,
            hiring_categories=transformed_data.get("hiring_categories", {}),
            ecommerce_roles=transformed_data.get("ecommerce_roles", 0),
            engineering_roles=transformed_data.get("engineering_roles", 0),
            data_roles=transformed_data.get("data_roles", 0),
            product_roles=transformed_data.get("product_roles", 0),
            search_roles=transformed_data.get("search_roles", 0),
            search_keywords_found=transformed_data.get("search_keywords_found", False),
            algolia_mentioned=transformed_data.get("algolia_mentioned", False),
            elasticsearch_mentioned=transformed_data.get("elasticsearch_mentioned", False),
            budget_owner_hiring=transformed_data.get("budget_owner_hiring", False),
            team_expansion=transformed_data.get("team_expansion", False),
            platform_confirmed=transformed_data.get("platform_confirmed"),
            leadership_vacancies=transformed_data.get("leadership_vacancies", []),
            ai_investment_signal=transformed_data.get("ai_investment_signal", False),
            signal_score=transformed_data.get("signal_score", 0),
            careers_url=transformed_data.get("careers_url"),
        )

    def _classify_role(self, title: str) -> tuple[int, str, Optional[str]]:
        """
        Classify a role by tier, signal strength, and implication.

        Returns:
            Tuple of (tier, signal_strength, implication)
        """
        title_lower = title.lower()

        # Check Tier 1 (VP/Director level)
        for role in TIER_1_ROLES:
            if role.lower() in title_lower:
                return (
                    1,
                    "STRONG",
                    "Leadership vacancy creates decision window"
                )

        # Check Tier 2 (Manager/Sr level)
        for role in TIER_2_ROLES:
            if role.lower() in title_lower:
                return (
                    2,
                    "MODERATE",
                    "Technology investment signal"
                )

        # Check Tier 3 (IC level)
        for role in TIER_3_ROLES:
            if role.lower() in title_lower:
                return (
                    3,
                    "MODERATE",
                    "Team expansion / platform confirmation"
                )

        # Default to Tier 3
        return (3, "LOW", None)

    def _calculate_signal_score(
        self,
        tier_1_count: int,
        tier_2_count: int,
        tier_3_count: int,
        search_keywords: bool,
        leadership_vacancies: List[str]
    ) -> int:
        """
        Calculate hiring signal score (0-100).
        """
        score = 0

        # Tier 1 roles (25 points each, max 50)
        score += min(tier_1_count * 25, 50)

        # Tier 2 roles (10 points each, max 30)
        score += min(tier_2_count * 10, 30)

        # Tier 3 roles (3 points each, max 15)
        score += min(tier_3_count * 3, 15)

        # Search keywords bonus
        if search_keywords:
            score += 15

        # Leadership vacancy bonus
        if leadership_vacancies:
            score += 10

        return min(score, 100)
