"""
M06: Hiring Signals Module
===========================

Detects hiring patterns that indicate technology investment and decision windows.

Wave: 2 (Deep Intel - Depends on Wave 1)

Dependencies:
- M01: Company Context (for company name, headquarters)
- M02: Technology Stack (for platform confirmation)

Data Sources:
- LinkedIn Jobs API (via WebSearch)
- Company careers page (via WebFetch)
- Glassdoor, Indeed (via WebSearch)

Output Schema:
- domain: str
- total_open_roles: int
- hiring_signals: HiringSignals (tier_1_strong, tier_2_moderate, tier_3_technical)
- hiring_categories: Dict[str, int]
- ai_investment_signal: bool
- leadership_vacancies: List[str]
- platform_confirmed: Optional[str]

Signal Tiers:
| Tier | Role Level | Signal Strength | Decision Impact |
|------|------------|-----------------|-----------------|
| 1 | VP/Director | STRONG | New leadership = new decisions |
| 2 | Manager/Sr. IC | MODERATE | Technology investment signal |
| 3 | Engineer/Developer | MODERATE | Platform confirmation |

Database Table: intel_hiring_signals

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M06 section)
- docs/DATABASE_SCHEMA_V2.md (intel_hiring_signals)
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


class HiringRole(BaseModel):
    """Individual job posting with signal analysis."""
    role_title: str = Field(..., description="Job title")
    department: Optional[str] = Field(None, description="Department or team")
    location: Optional[str] = Field(None, description="Job location")
    status: str = Field(default="Active", description="Job status (Active, Posted X days ago)")
    signal_tier: int = Field(default=3, ge=1, le=3, description="Signal tier (1=strong, 2=moderate, 3=technical)")
    signal_strength: str = Field(default="MODERATE", description="STRONG, MODERATE, LOW")
    implication: Optional[str] = Field(None, description="Business implication of this hire")
    source_url: Optional[str] = Field(None, description="Link to job posting")
    posted_date: Optional[str] = Field(None, description="When the job was posted")


class HiringSignals(BaseModel):
    """Categorized hiring signals by tier."""
    tier_1_strong: List[HiringRole] = Field(
        default_factory=list,
        description="VP/Director level - strong buying signal"
    )
    tier_2_moderate: List[HiringRole] = Field(
        default_factory=list,
        description="Manager/Sr. IC level - investment signal"
    )
    tier_3_technical: List[HiringRole] = Field(
        default_factory=list,
        description="Engineer/Developer level - platform confirmation"
    )


class HiringSignalsData(BaseModel):
    """
    Output schema for M06 Hiring Signals module.

    Contains hiring analysis with tiered signals and category breakdowns.
    """

    domain: str = Field(..., description="Primary domain")
    company_name: Optional[str] = Field(None, description="Company name from M01")

    # Core metrics
    total_open_roles: int = Field(default=0, description="Total open positions")
    tech_roles_count: int = Field(default=0, description="Technology-related roles")
    search_related_roles: int = Field(default=0, description="Search/discovery-related roles")

    # Tiered signals
    hiring_signals: HiringSignals = Field(
        default_factory=HiringSignals,
        description="Hiring signals by tier"
    )

    # Category breakdown
    hiring_categories: Dict[str, int] = Field(
        default_factory=dict,
        description="Role counts by category"
    )

    # Key signals
    ai_investment_signal: bool = Field(
        default=False,
        description="Hiring for AI/ML roles indicates AI investment"
    )
    leadership_vacancies: List[str] = Field(
        default_factory=list,
        description="VP/Director level openings - decision window"
    )
    platform_confirmed: Optional[str] = Field(
        None,
        description="Technology platform confirmed from job postings"
    )

    # Digital transformation indicators
    digital_transformation_signal: bool = Field(
        default=False,
        description="Hiring indicates digital transformation"
    )
    ecommerce_investment_signal: bool = Field(
        default=False,
        description="Hiring indicates e-commerce investment"
    )

    # Summary
    overall_hiring_intensity: str = Field(
        default="LOW",
        description="HIGH, MODERATE, LOW based on role count and seniority"
    )
    decision_window_open: bool = Field(
        default=False,
        description="True if leadership vacancies suggest decision window"
    )

    # Enrichment metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)
    careers_page_url: Optional[str] = Field(None, description="Company careers page URL")


# Role classification patterns
TIER_1_PATTERNS = [
    "vp", "vice president", "svp", "senior vice president", "evp",
    "chief", "cto", "cio", "cmo", "cdo", "cpo",
    "head of", "director", "gvp", "group vice president",
]

TIER_2_PATTERNS = [
    "manager", "lead", "principal", "senior manager", "sr. manager",
    "staff", "senior director", "sr. director",
]

CATEGORY_KEYWORDS = {
    "ecommerce": ["ecommerce", "e-commerce", "commerce", "online store", "checkout", "cart"],
    "engineering": ["engineer", "developer", "programmer", "software", "swe", "full stack", "backend", "frontend"],
    "data_analytics": ["data", "analytics", "analyst", "bi ", "business intelligence", "insights"],
    "ai_ml": ["ai", "ml", "machine learning", "artificial intelligence", "deep learning", "nlp", "llm"],
    "product": ["product manager", "product owner", "product lead", "pm "],
    "merchandising": ["merchandiser", "merchandising", "category manager", "buyer"],
    "marketing": ["marketing", "growth", "acquisition", "brand", "content"],
    "search": ["search", "discovery", "recommendation", "personalization", "relevance"],
    "ux": ["ux", "user experience", "design", "ui", "interaction"],
    "infrastructure": ["devops", "sre", "infrastructure", "platform", "cloud"],
}

PLATFORM_KEYWORDS = {
    "Salesforce Commerce Cloud": ["sfcc", "salesforce commerce", "demandware", "commerce cloud"],
    "Shopify": ["shopify", "liquid template"],
    "Adobe Commerce": ["magento", "adobe commerce"],
    "Adobe AEM": ["aem", "adobe experience manager", "adobe experience"],
    "SAP Commerce": ["sap commerce", "hybris"],
    "BigCommerce": ["bigcommerce"],
    "commercetools": ["commercetools"],
    "Contentful": ["contentful"],
}


@register_module
class M06HiringSignals(BaseModule):
    """
    Hiring Signals Intelligence Module.

    Detects hiring patterns that indicate technology investment priorities
    and decision windows for outreach timing.

    Wave 2 Dependencies (optional, enriches output):
    - M01: Company Context (company_name, headquarters for location matching)
    - M02: Technology Stack (platform confirmation)

    Data Flow:
    1. Search for company job postings
    2. Classify roles into signal tiers
    3. Detect category distribution
    4. Identify leadership vacancies
    5. Detect platform from job requirements
    6. Calculate overall hiring intensity
    7. Return with source citations

    Signal Interpretation:
    - VP/Director ecommerce/digital = STRONG buying signal, new leadership makes new decisions
    - Manager/Sr. IC in tech = MODERATE signal, indicates tech investment
    - Engineer roles = Platform confirmation, hiring scale indicates priority
    """

    MODULE_ID = "m06_hiring_signals"
    MODULE_NAME = "Hiring Signals"
    DESCRIPTION = "Hiring pattern detection for decision timing"

    WAVE = 2
    DEPENDS_ON = []  # Can run independently but benefits from Wave 1 data

    PRIMARY_SOURCE_TYPE = SourceType.LINKEDIN
    OUTPUT_TABLE = "intel_hiring_signals"
    TIMEOUT_SECONDS = 90

    # Mock hiring data for testing
    _MOCK_HIRING_DATA = {
        "costco.com": {
            "total_open_roles": 15000,
            "careers_page_url": "https://www.costco.com/job-opportunities.html",
            "roles": [
                {
                    "role_title": "Director, E-commerce Technology",
                    "department": "Technology",
                    "location": "Issaquah, WA",
                    "status": "Active",
                    "signal_tier": 1,
                    "signal_strength": "STRONG",
                    "implication": "Leadership vacancy in e-commerce tech - decision window",
                },
                {
                    "role_title": "Senior Manager, Search & Discovery",
                    "department": "Product",
                    "location": "Issaquah, WA",
                    "status": "Active",
                    "signal_tier": 2,
                    "signal_strength": "STRONG",
                    "implication": "Direct search/discovery investment signal",
                },
                {
                    "role_title": "Staff Software Engineer - Search Platform",
                    "department": "Engineering",
                    "location": "Issaquah, WA",
                    "status": "Active",
                    "signal_tier": 3,
                    "signal_strength": "MODERATE",
                    "implication": "Building/enhancing search platform",
                },
                {
                    "role_title": "Machine Learning Engineer - Recommendations",
                    "department": "Engineering",
                    "location": "Issaquah, WA",
                    "status": "Active",
                    "signal_tier": 2,
                    "signal_strength": "MODERATE",
                    "implication": "AI/ML investment in recommendations",
                },
            ],
        },
        "sallybeauty.com": {
            "total_open_roles": 4100,
            "careers_page_url": "https://careers.sallybeautyholdings.com/",
            "roles": [
                {
                    "role_title": "VP, Ecommerce",
                    "department": "Digital",
                    "location": "Denton, TX",
                    "status": "Active Hiring",
                    "signal_tier": 1,
                    "signal_strength": "STRONG",
                    "implication": "Leadership vacancy creates decision window",
                },
                {
                    "role_title": "Sr. Director, Customer Acquisition & Analytics",
                    "department": "Marketing",
                    "location": "Denton, TX",
                    "status": "Active Hiring",
                    "signal_tier": 1,
                    "signal_strength": "STRONG",
                    "implication": "Investment in data-driven commerce",
                },
                {
                    "role_title": "Data Analytics & AI Intern",
                    "department": "Technology",
                    "location": "Denton, TX",
                    "status": "Posted May 2025",
                    "signal_tier": 3,
                    "signal_strength": "MODERATE",
                    "implication": "Early-stage AI investment",
                },
                {
                    "role_title": "Software Engineer - Salesforce Commerce Cloud",
                    "department": "Engineering",
                    "location": "Denton, TX",
                    "status": "Active",
                    "signal_tier": 3,
                    "signal_strength": "MODERATE",
                    "implication": "Confirms SFCC as e-commerce platform",
                },
            ],
        },
        "mercedes-benz.com": {
            "total_open_roles": 8500,
            "careers_page_url": "https://jobs.mercedes-benz.com/",
            "roles": [
                {
                    "role_title": "Head of Digital Experience",
                    "department": "Digital",
                    "location": "Stuttgart, Germany",
                    "status": "Active",
                    "signal_tier": 1,
                    "signal_strength": "STRONG",
                    "implication": "Digital experience leadership role",
                },
                {
                    "role_title": "Senior Manager, Website Personalization",
                    "department": "Marketing",
                    "location": "Atlanta, GA",
                    "status": "Active",
                    "signal_tier": 2,
                    "signal_strength": "MODERATE",
                    "implication": "Investing in personalization capabilities",
                },
                {
                    "role_title": "Adobe Experience Manager Developer",
                    "department": "Engineering",
                    "location": "Stuttgart, Germany",
                    "status": "Active",
                    "signal_tier": 3,
                    "signal_strength": "MODERATE",
                    "implication": "Confirms Adobe AEM as CMS platform",
                },
            ],
        },
    }

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute hiring signals analysis.

        Args:
            domain: The domain to analyze
            context: Results from Wave 1 modules (optional)

        Returns:
            ModuleResult with HiringSignalsData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting hiring signals analysis for {domain}")

            # Normalize domain
            normalized_domain = self._normalize_domain(domain)

            # Extract Wave 1 data if available
            wave1_data = self._extract_wave1_data(context)

            # Fetch hiring data
            raw_data, citations = await self._fetch_hiring_data(normalized_domain)

            # Process roles into tiered signals
            hiring_signals = self._process_roles(raw_data.get("roles", []))

            # Calculate category breakdown
            categories = self._calculate_categories(raw_data.get("roles", []))

            # Detect key signals
            ai_signal = self._detect_ai_investment(raw_data.get("roles", []))
            leadership_vacancies = self._detect_leadership_vacancies(hiring_signals.tier_1_strong)
            platform_confirmed = self._detect_platform(raw_data.get("roles", []), wave1_data)

            # Calculate counts
            tech_roles = sum([
                categories.get("engineering", 0),
                categories.get("data_analytics", 0),
                categories.get("ai_ml", 0),
                categories.get("infrastructure", 0),
            ])
            search_roles = categories.get("search", 0)

            # Determine overall intensity
            intensity = self._calculate_hiring_intensity(
                raw_data.get("total_open_roles", 0),
                len(hiring_signals.tier_1_strong),
                tech_roles,
            )

            # Decision window
            decision_window = len(leadership_vacancies) > 0

            # Build output
            output_data = HiringSignalsData(
                domain=normalized_domain,
                company_name=wave1_data.get("company_name"),
                total_open_roles=raw_data.get("total_open_roles", 0),
                tech_roles_count=tech_roles,
                search_related_roles=search_roles,
                hiring_signals=hiring_signals,
                hiring_categories=categories,
                ai_investment_signal=ai_signal,
                leadership_vacancies=leadership_vacancies,
                platform_confirmed=platform_confirmed,
                digital_transformation_signal=self._detect_digital_transformation(raw_data.get("roles", [])),
                ecommerce_investment_signal=categories.get("ecommerce", 0) > 0,
                overall_hiring_intensity=intensity,
                decision_window_open=decision_window,
                data_quality_score=self._calculate_data_quality(raw_data),
                enrichment_sources=[c.source_type.value for c in citations],
                careers_page_url=raw_data.get("careers_page_url"),
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
                f"Hiring signals analysis complete for {domain}. "
                f"Total roles: {output_data.total_open_roles}, "
                f"Tier 1 signals: {len(hiring_signals.tier_1_strong)}, "
                f"Intensity: {intensity}. "
                f"Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Hiring signals analysis failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        return True

    def _extract_wave1_data(
        self,
        context: Optional[Dict[str, ModuleResult]],
    ) -> Dict[str, Any]:
        """Extract relevant data from Wave 1 modules."""
        data = {}

        if not context:
            return data

        # M01 - Company Context
        if "m01_company_context" in context:
            m01_result = context["m01_company_context"]
            if m01_result.status == ModuleStatus.SUCCESS:
                data["company_name"] = m01_result.data.get("company_name")
                data["headquarters"] = m01_result.data.get("headquarters")

        # M02 - Technology Stack
        if "m02_technology_stack" in context:
            m02_result = context["m02_technology_stack"]
            if m02_result.status == ModuleStatus.SUCCESS:
                data["technologies"] = m02_result.data.get("technologies", [])
                data["search_provider"] = m02_result.data.get("search_provider", {})

        return data

    async def _fetch_hiring_data(
        self,
        domain: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """Fetch hiring data from LinkedIn/careers page."""
        citations = []

        # Check mock data
        if domain in self._MOCK_HIRING_DATA:
            data = self._MOCK_HIRING_DATA[domain].copy()

            # LinkedIn citation
            linkedin_citation = self._create_citation(
                source_type=SourceType.LINKEDIN,
                source_url=f"https://www.linkedin.com/jobs/search/?keywords={domain.replace('.', ' ')}",
                api_endpoint="jobs-search",
                confidence=0.85,
            )
            citations.append(linkedin_citation)

            # Careers page citation
            if data.get("careers_page_url"):
                careers_citation = self._create_citation(
                    source_type=SourceType.COMPANY_WEBSITE,
                    source_url=data["careers_page_url"],
                    confidence=0.9,
                )
                citations.append(careers_citation)

            return data, citations

        # Fallback: return empty data
        citation = self._create_citation(
            source_type=SourceType.LINKEDIN,
            source_url=f"https://www.linkedin.com/company/{domain.replace('.com', '').replace('.', '-')}/jobs/",
            confidence=0.5,
            notes="No data found - using LinkedIn company page",
        )
        citations.append(citation)

        return {"total_open_roles": 0, "roles": []}, citations

    def _process_roles(self, raw_roles: List[Dict]) -> HiringSignals:
        """Process raw role data into tiered signals."""
        signals = HiringSignals()

        for role_data in raw_roles:
            role = HiringRole(
                role_title=role_data.get("role_title", ""),
                department=role_data.get("department"),
                location=role_data.get("location"),
                status=role_data.get("status", "Active"),
                signal_tier=role_data.get("signal_tier", self._classify_tier(role_data.get("role_title", ""))),
                signal_strength=role_data.get("signal_strength", "MODERATE"),
                implication=role_data.get("implication"),
                source_url=role_data.get("source_url"),
                posted_date=role_data.get("posted_date"),
            )

            if role.signal_tier == 1:
                signals.tier_1_strong.append(role)
            elif role.signal_tier == 2:
                signals.tier_2_moderate.append(role)
            else:
                signals.tier_3_technical.append(role)

        return signals

    def _classify_tier(self, title: str) -> int:
        """Classify role into signal tier based on title."""
        title_lower = title.lower()

        # Check Tier 1 (VP/Director)
        for pattern in TIER_1_PATTERNS:
            if pattern in title_lower:
                return 1

        # Check Tier 2 (Manager/Lead)
        for pattern in TIER_2_PATTERNS:
            if pattern in title_lower:
                return 2

        # Default to Tier 3 (Technical)
        return 3

    def _calculate_categories(self, roles: List[Dict]) -> Dict[str, int]:
        """Calculate role count by category."""
        categories: Dict[str, int] = {cat: 0 for cat in CATEGORY_KEYWORDS}

        for role in roles:
            title_lower = role.get("role_title", "").lower()
            dept_lower = role.get("department", "").lower()
            combined = f"{title_lower} {dept_lower}"

            for category, keywords in CATEGORY_KEYWORDS.items():
                for keyword in keywords:
                    if keyword in combined:
                        categories[category] += 1
                        break

        return categories

    def _detect_ai_investment(self, roles: List[Dict]) -> bool:
        """Detect if company is investing in AI/ML."""
        ai_keywords = ["ai", "ml", "machine learning", "artificial intelligence", "deep learning", "nlp", "llm"]

        for role in roles:
            title_lower = role.get("role_title", "").lower()
            for keyword in ai_keywords:
                if keyword in title_lower:
                    return True

        return False

    def _detect_leadership_vacancies(self, tier_1_roles: List[HiringRole]) -> List[str]:
        """Identify leadership vacancies from tier 1 roles."""
        vacancies = []
        for role in tier_1_roles:
            # Focus on digital/ecommerce/product leadership
            title_lower = role.role_title.lower()
            if any(kw in title_lower for kw in ["ecommerce", "e-commerce", "digital", "product", "technology"]):
                vacancies.append(role.role_title)
        return vacancies

    def _detect_platform(
        self,
        roles: List[Dict],
        wave1_data: Dict,
    ) -> Optional[str]:
        """Detect platform from job postings or Wave 1 data."""
        # First check Wave 1 tech stack
        if wave1_data.get("technologies"):
            for tech in wave1_data["technologies"]:
                tech_name = tech.get("name") if isinstance(tech, dict) else tech
                for platform, keywords in PLATFORM_KEYWORDS.items():
                    if tech_name and any(kw in tech_name.lower() for kw in keywords):
                        return platform

        # Then check job postings
        for role in roles:
            title_lower = role.get("role_title", "").lower()
            for platform, keywords in PLATFORM_KEYWORDS.items():
                for keyword in keywords:
                    if keyword in title_lower:
                        return platform

        return None

    def _detect_digital_transformation(self, roles: List[Dict]) -> bool:
        """Detect if hiring indicates digital transformation."""
        digital_keywords = [
            "digital transformation", "digital strategy", "digital experience",
            "omnichannel", "digital commerce", "digital product",
        ]

        for role in roles:
            title_lower = role.get("role_title", "").lower()
            for keyword in digital_keywords:
                if keyword in title_lower:
                    return True

        return False

    def _calculate_hiring_intensity(
        self,
        total_roles: int,
        tier_1_count: int,
        tech_roles: int,
    ) -> str:
        """Calculate overall hiring intensity."""
        # Strong leadership hiring = HIGH
        if tier_1_count >= 2:
            return "HIGH"

        # Large tech hiring = HIGH
        if tech_roles >= 10:
            return "HIGH"

        # Some leadership or moderate tech = MODERATE
        if tier_1_count >= 1 or tech_roles >= 5:
            return "MODERATE"

        # Light hiring = LOW
        return "LOW"

    def _calculate_data_quality(self, raw_data: Dict) -> float:
        """Calculate data quality score."""
        score = 0.0

        # Has roles data (0.4)
        roles = raw_data.get("roles", [])
        if len(roles) >= 5:
            score += 0.4
        elif len(roles) >= 1:
            score += 0.2

        # Has total count (0.2)
        if raw_data.get("total_open_roles"):
            score += 0.2

        # Has careers page (0.2)
        if raw_data.get("careers_page_url"):
            score += 0.2

        # Roles have implications (0.2)
        roles_with_impl = len([r for r in roles if r.get("implication")])
        if roles_with_impl >= 3:
            score += 0.2
        elif roles_with_impl >= 1:
            score += 0.1

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
            source_type=SourceType.LINKEDIN,
            source_url=f"https://www.linkedin.com/company/{domain.replace('.com', '').replace('.', '-')}/jobs/",
            retrieved_at=datetime.utcnow(),
            confidence_score=0.3,
            notes="Default citation - limited data",
        )
