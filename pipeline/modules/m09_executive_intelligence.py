"""
M09: Executive Intelligence Module
==================================

Builds executive profiles with digital transformation focus for personalized outreach.

Wave: 3 (Deep Intelligence - Depends on Wave 2)

Data Sources:
- LinkedIn profiles (via WebSearch)
- Company management page
- Press releases, interviews
- Conference speaker bios
- Earnings call attribution (from M08)

Dependencies:
- M01: Company Context (for company_name, headquarters)
- M08: Investor Intelligence (for executive quotes with attribution)

Output Schema:
- executives: List of executive profiles
- buying_committee_summary: Quick reference for buying committee
- recommended_entry_points: Suggested first contacts
- speaking_language: Terms and phrases executives use

Database Table: intel_executive_intelligence

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M09 section)
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from pipeline.models.source import (
    SourceCitation,
    SourceType,
    FreshnessStatus,
)
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    DependencyNotMetError,
    DataNotFoundError,
    register_module,
)

logger = logging.getLogger(__name__)


class QuoteToProductMapping(BaseModel):
    """Maps executive quote to Algolia product."""
    quote: str = Field(..., description="The executive quote")
    maps_to: str = Field(..., description="Algolia product(s) this maps to")
    source_url: Optional[str] = Field(None, description="Source of the quote")


class SpeakingLanguage(BaseModel):
    """Executive's terminology and phrases for personalized outreach."""
    terms_used: List[str] = Field(
        default_factory=list,
        description="Terms/phrases the executive uses"
    )
    quote_to_product_mapping: List[QuoteToProductMapping] = Field(
        default_factory=list,
        description="Quotes mapped to Algolia products"
    )


class ExecutiveProfile(BaseModel):
    """Executive profile for buying committee mapping."""
    name: str = Field(..., description="Full name")
    title: str = Field(..., description="Current title/role")

    # Contact info
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    email: Optional[str] = Field(None, description="Email if available")

    # Background
    tenure_start: Optional[str] = Field(None, description="When they started in role (YYYY-MM)")
    background: Optional[str] = Field(None, description="Career background summary")
    previous_companies: List[str] = Field(default_factory=list, description="Previous employers")

    # Buying role
    buyer_role: str = Field(
        default="Unknown",
        description="Executive Sponsor, Economic Buyer, Technical Buyer, Champion, User Buyer"
    )
    priority: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")
    influence_level: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")

    # Engagement strategy
    is_new_to_role: bool = Field(default=False, description="New hire opportunity")
    is_active_on_linkedin: bool = Field(default=False)
    speaks_at_events: List[str] = Field(default_factory=list)
    entry_approach: Optional[str] = Field(None, description="Recommended entry strategy")

    # Speaking language (for personalized outreach)
    speaking_language: Optional[SpeakingLanguage] = Field(
        None,
        description="Terms and quotes for 'Speaking Their Language' section"
    )

    # Source citations
    source_urls: List[str] = Field(default_factory=list, description="Profile sources")


class BuyingCommitteeSummary(BaseModel):
    """Quick reference for buying committee roles."""
    executive_sponsor: Optional[str] = Field(None, description="Name (Title)")
    economic_buyer: Optional[str] = Field(None, description="Name (Title)")
    technical_buyer: Optional[str] = Field(None, description="Name (Title)")
    champion: Optional[str] = Field(None, description="Name (Title)")
    user_buyers: List[str] = Field(default_factory=list, description="Names (Titles)")


class ExecutiveIntelligenceData(BaseModel):
    """
    Output schema for M09 Executive Intelligence module.

    Contains executive profiles and buying committee mapping.
    """

    domain: str = Field(..., description="Primary domain")
    company_name: Optional[str] = Field(None)

    # Executive profiles
    executives: List[ExecutiveProfile] = Field(
        default_factory=list,
        description="Key executive profiles"
    )

    # Buying committee summary
    buying_committee_summary: BuyingCommitteeSummary = Field(
        default_factory=BuyingCommitteeSummary
    )

    # Entry strategy
    recommended_entry_points: List[str] = Field(
        default_factory=list,
        description="Recommended first contacts with approach"
    )

    # Aggregated data
    total_executives_mapped: int = Field(default=0)
    executives_with_quotes: int = Field(default=0)
    new_hires_count: int = Field(default=0)

    # Metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)
    data_limitation_reason: Optional[str] = Field(None)


# Buyer role classification by title keywords
ROLE_CLASSIFICATION = {
    "Executive Sponsor": [
        "ceo", "president", "chief executive", "managing director",
        "general manager", "country manager",
    ],
    "Economic Buyer": [
        "cmo", "cdo", "chief digital", "chief marketing", "chief revenue",
        "svp strategy", "evp digital", "gvp digital", "vp digital experience",
    ],
    "Technical Buyer": [
        "cio", "cto", "chief information", "chief technology",
        "svp engineering", "vp engineering", "head of engineering",
        "svp it", "vp it", "director of it",
    ],
    "Champion": [
        "vp digital product", "vp ecommerce", "director ecommerce",
        "head of digital", "digital product manager", "product lead",
    ],
    "User Buyer": [
        "merchandising", "marketing manager", "content manager",
        "category manager", "search manager", "seo manager",
    ],
}


@register_module
class M09ExecutiveIntelligence(BaseModule):
    """
    Executive Intelligence Module.

    Builds executive profiles with digital transformation focus
    for personalized outreach and buying committee mapping.

    Wave 3 - Depends on M01 and M08

    Data Flow:
    1. Get company context from M01
    2. Get executive quotes from M08 (if available)
    3. Fetch executive profiles via WebSearch
    4. Classify buyer roles
    5. Build speaking language mapping
    6. Generate entry point recommendations
    7. Return with source citations
    """

    MODULE_ID = "m09_executive_intelligence"
    MODULE_NAME = "Executive Intelligence"
    DESCRIPTION = "Executive profiles and buying committee mapping"

    WAVE = 3
    DEPENDS_ON = ["m01_company_context"]  # M08 is optional dependency

    PRIMARY_SOURCE_TYPE = SourceType.LINKEDIN
    OUTPUT_TABLE = "intel_executive_intelligence"
    TIMEOUT_SECONDS = 60

    # Mock executive data
    _MOCK_EXECUTIVE_DATA = {
        "costco.com": {
            "company_name": "Costco Wholesale Corporation",
            "executives": [
                {
                    "name": "Ron Vachris",
                    "title": "President & CEO",
                    "linkedin_url": "https://www.linkedin.com/in/ron-vachris/",
                    "tenure_start": "2024-01",
                    "background": "Former COO at Costco; 40+ years with company",
                    "buyer_role": "Executive Sponsor",
                    "priority": "HIGH",
                    "is_new_to_role": True,
                    "entry_approach": "New CEO brings fresh perspective on technology investments",
                },
                {
                    "name": "Gary Millerchip",
                    "title": "EVP & CFO",
                    "linkedin_url": "https://www.linkedin.com/in/gary-millerchip/",
                    "tenure_start": "2022-03",
                    "background": "Former CFO at Kroger",
                    "buyer_role": "Economic Buyer",
                    "priority": "HIGH",
                    "is_new_to_role": False,
                },
                {
                    "name": "Craig Jelinek",
                    "title": "Former CEO, Board Member",
                    "background": "CEO 2012-2024, now Board Member",
                    "buyer_role": "Executive Sponsor",
                    "priority": "MEDIUM",
                },
            ],
        },
        "sallybeauty.com": {
            "company_name": "Sally Beauty Holdings, Inc.",
            "executives": [
                {
                    "name": "Denise Paulonis",
                    "title": "President & CEO",
                    "linkedin_url": "https://www.linkedin.com/in/denisepaulonis/",
                    "tenure_start": "2022-01",
                    "background": "Former CFO at Sally Beauty; prior McDonald's, PepsiCo",
                    "buyer_role": "Executive Sponsor",
                    "priority": "HIGH",
                    "is_new_to_role": False,
                    "speaking_language": {
                        "terms_used": [
                            "Sally Ignited",
                            "seamless customer journey",
                            "personalization",
                            "product discovery",
                        ],
                        "quote_to_product_mapping": [
                            {
                                "quote": "More efficient search engine for easier product discovery",
                                "maps_to": "Algolia InstantSearch, Dynamic Faceting",
                                "source_url": "https://www.fool.com/earnings/call-transcripts/2026/02/09/sally-beauty-sbh-q1-2026-earnings-call-transcript/",
                            },
                            {
                                "quote": "Help me make the right choice",
                                "maps_to": "Algolia AI Recommendations, Query Suggestions",
                                "source_url": "https://www.beautyindependent.com/sally-beauty-denise-paulonis-interview/",
                            },
                        ],
                    },
                },
                {
                    "name": "Scott Lindblom",
                    "title": "SVP & CIO",
                    "linkedin_url": "https://www.linkedin.com/in/scott-lindblom/",
                    "tenure_start": "2023-10",
                    "background": "Former digital transformation leader at Bed Bath & Beyond",
                    "buyer_role": "Technical Buyer",
                    "priority": "HIGH",
                    "is_new_to_role": True,
                    "entry_approach": "Fresh perspective on technology investments, past learning curve from BBB",
                },
                {
                    "name": "Chris Hansen",
                    "title": "VP, Digital Product",
                    "linkedin_url": "https://www.linkedin.com/in/chris-hansen-2809403/",
                    "buyer_role": "Champion",
                    "priority": "HIGH",
                    "is_active_on_linkedin": True,
                    "speaks_at_events": ["CommerceNext"],
                    "entry_approach": "Most active on LinkedIn, speaks at events - ideal first conversation",
                },
                {
                    "name": "Natalie Lockhart",
                    "title": "GVP, Strategy, Customer Insights & Digital Experience",
                    "linkedin_url": "https://www.linkedin.com/in/natalielockhart/",
                    "buyer_role": "Economic Buyer",
                    "priority": "HIGH",
                    "entry_approach": "Digital strategy alignment, ROI modeling",
                },
                {
                    "name": "Marlo Cormier",
                    "title": "SVP & CFO",
                    "linkedin_url": "https://www.linkedin.com/in/marlocormier/",
                    "buyer_role": "Economic Buyer",
                    "priority": "MEDIUM",
                },
                {
                    "name": "Bryan DeYoung",
                    "title": "SVP, Merchandising Operations",
                    "buyer_role": "User Buyer",
                    "priority": "MEDIUM",
                },
                {
                    "name": "Maryann Herskowitz",
                    "title": "GVP, Merchandising",
                    "buyer_role": "User Buyer",
                    "priority": "MEDIUM",
                },
            ],
        },
        "mercedes-benz.com": {
            "company_name": "Mercedes-Benz Group AG",
            "executives": [
                {
                    "name": "Ola Kallenius",
                    "title": "CEO",
                    "linkedin_url": "https://www.linkedin.com/in/olakallenius/",
                    "tenure_start": "2019-05",
                    "background": "Former Head of Group Research and Mercedes-Benz Cars Development",
                    "buyer_role": "Executive Sponsor",
                    "priority": "HIGH",
                },
                {
                    "name": "Harald Wilhelm",
                    "title": "CFO",
                    "linkedin_url": "https://www.linkedin.com/in/haraldwilhelm/",
                    "buyer_role": "Economic Buyer",
                    "priority": "MEDIUM",
                },
                {
                    "name": "Sabine Scheunert",
                    "title": "VP Digital & IT Sales/Marketing",
                    "buyer_role": "Champion",
                    "priority": "HIGH",
                    "is_active_on_linkedin": True,
                    "entry_approach": "Direct owner of digital sales experience",
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
        Execute executive intelligence enrichment.

        Args:
            domain: The domain to analyze
            context: Results from M01 (required) and M08 (optional)

        Returns:
            ModuleResult with ExecutiveIntelligenceData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting executive intelligence for {domain}")

            # Validate dependencies
            context = context or {}
            self.validate_dependencies(context)

            normalized_domain = self._normalize_domain(domain)

            # Get company name from M01
            m01_data = context.get("m01_company_context", {})
            if isinstance(m01_data, ModuleResult):
                m01_data = m01_data.data
            company_name = m01_data.get("company_name", "")

            # Get executive quotes from M08 (optional)
            m08_data = context.get("m08_investor_intelligence", {})
            if isinstance(m08_data, ModuleResult):
                m08_data = m08_data.data
            investor_quotes = m08_data.get("executive_quotes", [])

            if normalized_domain in self._MOCK_EXECUTIVE_DATA:
                # Fetch executive data
                raw_data, citations = await self._fetch_executive_data(normalized_domain)

                # Process executives
                executives = self._process_executives(raw_data, investor_quotes)

                # Build buying committee summary
                committee_summary = self._build_committee_summary(executives)

                # Generate entry point recommendations
                entry_points = self._generate_entry_points(executives)

                data_limitation = None
            else:
                # Unknown domain - limited data
                executives = []
                committee_summary = BuyingCommitteeSummary()
                entry_points = []
                data_limitation = "No executive data available for this domain"

                citations = [
                    self._create_citation(
                        source_type=SourceType.WEBSEARCH,
                        source_url=f"https://www.google.com/search?q={normalized_domain}+executives+leadership",
                        confidence=0.3,
                        notes=data_limitation,
                    )
                ]

            # Calculate stats
            total_execs = len(executives)
            execs_with_quotes = sum(
                1 for e in executives
                if e.speaking_language and e.speaking_language.quote_to_product_mapping
            )
            new_hires = sum(1 for e in executives if e.is_new_to_role)

            # Build output
            output_data = ExecutiveIntelligenceData(
                domain=normalized_domain,
                company_name=company_name or raw_data.get("company_name") if normalized_domain in self._MOCK_EXECUTIVE_DATA else None,
                executives=executives,
                buying_committee_summary=committee_summary,
                recommended_entry_points=entry_points,
                total_executives_mapped=total_execs,
                executives_with_quotes=execs_with_quotes,
                new_hires_count=new_hires,
                data_quality_score=self._calculate_data_quality(executives),
                enrichment_sources=[c.source_type.value for c in citations],
                data_limitation_reason=data_limitation,
            )

            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=True, duration_ms=duration_ms)

            result = self._create_result(
                domain=normalized_domain,
                data=output_data.model_dump(),
                primary_citation=citations[0],
                supporting_citations=citations[1:] if len(citations) > 1 else [],
                duration_ms=duration_ms,
            )

            self.validate_output(result)

            self.logger.info(
                f"Executive intelligence complete for {domain}. "
                f"Executives: {total_execs}, With quotes: {execs_with_quotes}, "
                f"New hires: {new_hires}. Duration: {duration_ms:.0f}ms"
            )

            return result

        except DependencyNotMetError:
            raise
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Executive intelligence failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")
        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")
        return True

    async def _fetch_executive_data(
        self,
        domain: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """Fetch executive data from sources."""
        citations = []

        if domain in self._MOCK_EXECUTIVE_DATA:
            data = self._MOCK_EXECUTIVE_DATA[domain].copy()

            # Create LinkedIn citation
            linkedin_citation = self._create_citation(
                source_type=SourceType.LINKEDIN,
                source_url=f"https://www.linkedin.com/company/{domain.replace('.com', '')}/people/",
                confidence=0.85,
            )
            citations.append(linkedin_citation)

            # Create company website citation
            website_citation = self._create_citation(
                source_type=SourceType.COMPANY_WEBSITE,
                source_url=f"https://{domain}/about/leadership",
                confidence=0.9,
            )
            citations.append(website_citation)

            return data, citations

        # Fallback
        citation = self._create_citation(
            source_type=SourceType.WEBSEARCH,
            source_url=f"https://www.google.com/search?q={domain}+leadership+executives",
            confidence=0.4,
        )
        citations.append(citation)
        return {}, citations

    def _process_executives(
        self,
        raw_data: Dict[str, Any],
        investor_quotes: List[Dict[str, Any]],
    ) -> List[ExecutiveProfile]:
        """Process and enrich executive profiles."""
        executives = []

        for exec_data in raw_data.get("executives", []):
            # Create speaking language from quotes if not present
            speaking_language = None
            if exec_data.get("speaking_language"):
                sl_data = exec_data["speaking_language"]
                mappings = [
                    QuoteToProductMapping(**m) if isinstance(m, dict) else m
                    for m in sl_data.get("quote_to_product_mapping", [])
                ]
                speaking_language = SpeakingLanguage(
                    terms_used=sl_data.get("terms_used", []),
                    quote_to_product_mapping=mappings,
                )
            else:
                # Try to find quotes from investor intel
                exec_name = exec_data.get("name", "")
                exec_quotes = [
                    q for q in investor_quotes
                    if exec_name.lower() in q.get("speaker_name", "").lower()
                ]
                if exec_quotes:
                    mappings = [
                        QuoteToProductMapping(
                            quote=q.get("quote", ""),
                            maps_to=q.get("maps_to_algolia", ""),
                            source_url=q.get("source_url"),
                        )
                        for q in exec_quotes
                    ]
                    speaking_language = SpeakingLanguage(
                        terms_used=[],
                        quote_to_product_mapping=mappings,
                    )

            # Classify buyer role if not specified
            buyer_role = exec_data.get("buyer_role", "Unknown")
            if buyer_role == "Unknown":
                buyer_role = self._classify_buyer_role(exec_data.get("title", ""))

            executive = ExecutiveProfile(
                name=exec_data.get("name", "Unknown"),
                title=exec_data.get("title", "Unknown"),
                linkedin_url=exec_data.get("linkedin_url"),
                tenure_start=exec_data.get("tenure_start"),
                background=exec_data.get("background"),
                previous_companies=exec_data.get("previous_companies", []),
                buyer_role=buyer_role,
                priority=exec_data.get("priority", "MEDIUM"),
                influence_level=self._infer_influence_level(buyer_role),
                is_new_to_role=exec_data.get("is_new_to_role", False),
                is_active_on_linkedin=exec_data.get("is_active_on_linkedin", False),
                speaks_at_events=exec_data.get("speaks_at_events", []),
                entry_approach=exec_data.get("entry_approach"),
                speaking_language=speaking_language,
                source_urls=exec_data.get("source_urls", []),
            )
            executives.append(executive)

        return executives

    def _classify_buyer_role(self, title: str) -> str:
        """Classify buyer role based on title."""
        title_lower = title.lower()

        for role, keywords in ROLE_CLASSIFICATION.items():
            for keyword in keywords:
                if keyword in title_lower:
                    return role

        return "Unknown"

    def _infer_influence_level(self, buyer_role: str) -> str:
        """Infer influence level from buyer role."""
        high_influence = ["Executive Sponsor", "Economic Buyer", "Technical Buyer"]
        medium_influence = ["Champion"]

        if buyer_role in high_influence:
            return "HIGH"
        elif buyer_role in medium_influence:
            return "MEDIUM"
        else:
            return "LOW"

    def _build_committee_summary(
        self,
        executives: List[ExecutiveProfile],
    ) -> BuyingCommitteeSummary:
        """Build buying committee summary."""
        summary = BuyingCommitteeSummary()
        user_buyers = []

        for exec in executives:
            name_title = f"{exec.name} ({exec.title})"

            if exec.buyer_role == "Executive Sponsor" and not summary.executive_sponsor:
                summary.executive_sponsor = name_title
            elif exec.buyer_role == "Economic Buyer" and not summary.economic_buyer:
                summary.economic_buyer = name_title
            elif exec.buyer_role == "Technical Buyer" and not summary.technical_buyer:
                summary.technical_buyer = name_title
            elif exec.buyer_role == "Champion" and not summary.champion:
                summary.champion = name_title
            elif exec.buyer_role == "User Buyer":
                user_buyers.append(name_title)

        summary.user_buyers = user_buyers
        return summary

    def _generate_entry_points(
        self,
        executives: List[ExecutiveProfile],
    ) -> List[str]:
        """Generate recommended entry point strategies."""
        entry_points = []

        # Sort by priority and whether they have entry approach
        prioritized = sorted(
            executives,
            key=lambda e: (
                0 if e.priority == "HIGH" else (1 if e.priority == "MEDIUM" else 2),
                0 if e.entry_approach else 1,
            ),
        )

        for exec in prioritized[:3]:  # Top 3 entry points
            if exec.entry_approach:
                entry_points.append(f"{exec.name} - {exec.entry_approach}")
            elif exec.is_active_on_linkedin:
                entry_points.append(f"{exec.name} - Active on LinkedIn, direct outreach")
            elif exec.speaks_at_events:
                entry_points.append(f"{exec.name} - Speaks at {', '.join(exec.speaks_at_events[:2])}")
            elif exec.is_new_to_role:
                entry_points.append(f"{exec.name} - New to role, open to vendor discussions")
            else:
                entry_points.append(f"{exec.name} - {exec.buyer_role}")

        return entry_points

    def _calculate_data_quality(self, executives: List[ExecutiveProfile]) -> float:
        """Calculate data quality score."""
        if not executives:
            return 0.0

        score = 0.0

        # Base score for having executives
        score += 0.2

        # LinkedIn URLs
        linked_in_count = sum(1 for e in executives if e.linkedin_url)
        score += min(0.2, linked_in_count * 0.05)

        # Speaking language / quotes
        quotes_count = sum(
            1 for e in executives
            if e.speaking_language and e.speaking_language.quote_to_product_mapping
        )
        score += min(0.3, quotes_count * 0.1)

        # Diverse buyer roles
        roles = set(e.buyer_role for e in executives if e.buyer_role != "Unknown")
        score += min(0.2, len(roles) * 0.05)

        # Entry approaches
        entry_count = sum(1 for e in executives if e.entry_approach)
        score += min(0.1, entry_count * 0.02)

        return min(score, 1.0)

    def _normalize_domain(self, domain: str) -> str:
        """Normalize domain."""
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
