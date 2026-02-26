"""
M10 Buying Committee Intelligence Module

Maps the buying committee for search technology decisions.
This is a Wave 3 module that depends on M09 (Executive Intelligence).

Data Sources:
- M09 Executive Intelligence (primary - synthesizes executive data)
- WebSearch (secondary - organizational research, LinkedIn)

Output: Decision maker, influencers, technical evaluators, champions,
blockers - each with engagement strategy and talking points.

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


class CommitteeMember(BaseModel):
    """Individual member of the buying committee."""

    name: str = Field(..., description="Full name of the committee member")
    title: str = Field(..., description="Job title")
    role_in_decision: str = Field(
        ...,
        description="Role in purchase decision (e.g., 'Budget Authority', 'Technical Evaluator', 'End User Champion')"
    )
    engagement_strategy: str = Field(
        ...,
        description="Recommended approach to engage this person"
    )
    talking_points: List[str] = Field(
        default_factory=list,
        description="Key points to emphasize when speaking with this person"
    )
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    email_pattern: Optional[str] = Field(None, description="Likely email pattern (e.g., 'first.last@company.com')")
    source_url: str = Field(..., description="Source URL for this person's info")
    source_date: str = Field(..., description="Date of source data")


class BuyingCommitteeData(BaseModel):
    """
    Buying Committee data model - output of M10 module.

    Maps the entire buying committee for search technology decisions,
    identifying key stakeholders and recommended engagement strategies.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'costco.com')")
    company_name: str = Field(..., description="Company name")

    # Decision Maker (primary budget owner)
    decision_maker: Optional[CommitteeMember] = Field(
        None,
        description="Primary decision maker with budget authority"
    )

    # Influencers (people who influence the decision)
    influencers: List[CommitteeMember] = Field(
        default_factory=list,
        description="People who influence the purchase decision"
    )

    # Technical Evaluators (people who will evaluate the technical aspects)
    technical_evaluators: List[CommitteeMember] = Field(
        default_factory=list,
        description="Technical staff who will evaluate the solution"
    )

    # Champions (potential internal advocates)
    champions: List[CommitteeMember] = Field(
        default_factory=list,
        description="Potential internal advocates for Algolia"
    )

    # Blockers (potential obstacles)
    blockers: List[CommitteeMember] = Field(
        default_factory=list,
        description="Potential obstacles or skeptics to address"
    )

    # Committee Summary
    committee_size: int = Field(0, description="Total number of identified committee members")
    decision_process: Optional[str] = Field(
        None,
        description="Estimated decision process (e.g., 'Consensus', 'Top-down', 'RFP-driven')"
    )
    estimated_timeline: Optional[str] = Field(
        None,
        description="Estimated timeline for decision (e.g., 'Q2 2026', '3-6 months')"
    )

    # Engagement Recommendations
    entry_point: Optional[str] = Field(
        None,
        description="Recommended entry point for initial engagement"
    )
    multi_thread_strategy: Optional[str] = Field(
        None,
        description="Strategy for engaging multiple stakeholders simultaneously"
    )

    # Algolia-specific insights
    algolia_familiarity: Optional[str] = Field(
        None,
        description="Estimated familiarity with Algolia (e.g., 'None', 'Aware', 'Evaluated', 'Former User')"
    )
    current_vendor_relationship: Optional[str] = Field(
        None,
        description="Known relationship with current search vendor"
    )

    # Confidence metrics
    data_completeness: float = Field(
        0.0,
        description="Completeness of committee mapping (0.0-1.0)"
    )
    confidence_score: float = Field(
        0.0,
        description="Confidence in the committee identification (0.0-1.0)"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M10BuyingCommitteeModule(BaseIntelligenceModule):
    """
    M10: Buying Committee - maps stakeholders for search technology decisions.

    Wave 3 module that depends on M09 (Executive Intelligence).
    Synthesizes executive data with organizational research to identify
    the complete buying committee.
    """

    MODULE_ID = "m10_buying_committee"
    MODULE_NAME = "Buying Committee"
    WAVE = 3
    DEPENDS_ON = ["m09_executive"]
    SOURCE_TYPE = "synthesized"
    CACHE_TTL = 604800  # 7 days

    async def enrich(
        self,
        domain: str,
        force: bool = False,
        m09_data: Optional[Dict[str, Any]] = None
    ) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "costco.com")
            force: If True, bypass cache and fetch fresh data
            m09_data: Optional M09 executive data (if available from orchestrator)

        Returns:
            ModuleResult with BuyingCommitteeData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching buying committee for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached result for: {domain}")
                return cached

        # Fetch raw data (synthesizes from M09 + additional research)
        raw_data = await self.fetch_data(domain, m09_data=m09_data)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        committee_data = await self._validate_and_create(domain, transformed)

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
            data=committee_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched buying committee for: {domain}")
        return result

    async def fetch_data(
        self,
        domain: str,
        m09_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Fetch raw data from M09 and organizational research.

        Synthesizes executive data from M09 with additional WebSearch
        research to map the buying committee.

        Args:
            domain: The domain to fetch data for
            m09_data: Optional M09 executive data

        Returns:
            dict with merged data from all sources
        """
        executive_data = {}
        org_research_data = {}
        errors = []

        # Get M09 data (primary source)
        try:
            if m09_data:
                executive_data = m09_data
                self.logger.debug(f"Using provided M09 data for: {domain}")
            else:
                executive_data = await self._fetch_m09_data(domain)
                self.logger.debug(f"Fetched M09 data for: {domain}")
        except Exception as e:
            self.logger.warning(f"M09 data fetch failed for {domain}: {e}")
            errors.append(f"M09: {e}")

        # Try organizational research (secondary)
        try:
            org_research_data = await self._fetch_org_research(domain)
            self.logger.debug(f"Org research returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"Org research failed for {domain}: {e}")
            errors.append(f"OrgResearch: {e}")

        # If both sources failed, raise error
        if not executive_data and not org_research_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        # Synthesize buying committee from both sources
        synthesized = await self._synthesize_committee(
            domain, executive_data, org_research_data
        )

        return synthesized

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw synthesized data into BuyingCommitteeData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching BuyingCommitteeData fields
        """
        # Calculate committee size
        committee_size = 0
        if raw_data.get("decision_maker"):
            committee_size += 1
        committee_size += len(raw_data.get("influencers", []))
        committee_size += len(raw_data.get("technical_evaluators", []))
        committee_size += len(raw_data.get("champions", []))
        committee_size += len(raw_data.get("blockers", []))

        # Calculate data completeness
        data_completeness = self._calculate_completeness(raw_data)

        return {
            "domain": raw_data.get("domain"),
            "company_name": raw_data.get("company_name"),
            "decision_maker": raw_data.get("decision_maker"),
            "influencers": raw_data.get("influencers", []),
            "technical_evaluators": raw_data.get("technical_evaluators", []),
            "champions": raw_data.get("champions", []),
            "blockers": raw_data.get("blockers", []),
            "committee_size": committee_size,
            "decision_process": raw_data.get("decision_process"),
            "estimated_timeline": raw_data.get("estimated_timeline"),
            "entry_point": raw_data.get("entry_point"),
            "multi_thread_strategy": raw_data.get("multi_thread_strategy"),
            "algolia_familiarity": raw_data.get("algolia_familiarity"),
            "current_vendor_relationship": raw_data.get("current_vendor_relationship"),
            "data_completeness": data_completeness,
            "confidence_score": raw_data.get("confidence_score", data_completeness * 0.8),
            # Preserve source info for result creation
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_m09_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch executive data from M09 module.

        In production, this retrieves cached M09 data or triggers M09 enrichment.
        For now, returns mock data.

        Args:
            domain: The domain to look up

        Returns:
            dict with M09 executive data
        """
        # TODO: Replace with actual M09 data retrieval
        return await self._get_mock_m09_data(domain)

    async def _get_mock_m09_data(self, domain: str) -> Dict[str, Any]:
        """
        Get mock M09 executive data.

        In production, this will retrieve real M09 data.
        """
        now = datetime.now()

        return {
            "domain": domain,
            "company_name": self._infer_company_name(domain),
            "executives": [
                {
                    "name": "John Smith",
                    "title": "Chief Technology Officer",
                    "linkedin_url": f"https://linkedin.com/in/johnsmith-{domain.split('.')[0]}",
                },
                {
                    "name": "Sarah Johnson",
                    "title": "VP of Engineering",
                    "linkedin_url": f"https://linkedin.com/in/sarahjohnson-{domain.split('.')[0]}",
                },
                {
                    "name": "Michael Chen",
                    "title": "Director of E-commerce",
                    "linkedin_url": f"https://linkedin.com/in/michaelchen-{domain.split('.')[0]}",
                },
                {
                    "name": "Emily Williams",
                    "title": "CFO",
                    "linkedin_url": f"https://linkedin.com/in/emilywilliams-{domain.split('.')[0]}",
                },
            ],
            "key_themes": ["digital_transformation", "customer_experience", "cost_efficiency"],
            "source_url": f"https://seekingalpha.com/{domain.split('.')[0]}-transcript",
            "source_date": now.isoformat(),
        }

    async def _fetch_org_research(self, domain: str) -> Dict[str, Any]:
        """
        Fetch organizational research from WebSearch.

        Searches for org charts, team structures, and additional
        stakeholder information.

        Args:
            domain: The domain to research

        Returns:
            dict with organizational research data
        """
        # TODO: Replace with actual WebSearch API call
        return await self._call_org_research_api(domain)

    async def _call_org_research_api(self, domain: str) -> Dict[str, Any]:
        """
        Call WebSearch API for organizational research (mock implementation).

        In production, this will search for org structure info.
        """
        now = datetime.now()
        company_name = self._infer_company_name(domain)

        return {
            "company_name": company_name,
            "org_structure": {
                "technology_team_size": 150,
                "has_search_team": True,
                "reports_to": "CTO",
            },
            "decision_indicators": {
                "typical_process": "RFP-driven",
                "typical_timeline": "4-6 months",
                "budget_cycle": "Annual",
            },
            "hiring_signals": [
                {
                    "role": "Search Engineer",
                    "posted_date": now.strftime("%Y-%m-%d"),
                    "url": f"https://careers.{domain}/search-engineer",
                }
            ],
            "source_url": f"https://www.{domain}/about/leadership/",
            "source_date": now.isoformat(),
        }

    async def _synthesize_committee(
        self,
        domain: str,
        executive_data: Dict[str, Any],
        org_research_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Synthesize buying committee from executive data and org research.

        Maps executives to buying committee roles based on title patterns
        and organizational structure.

        Args:
            domain: The domain
            executive_data: M09 executive data
            org_research_data: Organizational research data

        Returns:
            Synthesized buying committee data
        """
        now = datetime.now()
        company_name = executive_data.get("company_name") or org_research_data.get("company_name") or self._infer_company_name(domain)

        # Get source URL and date (prefer executive data as primary)
        source_url = executive_data.get("source_url") or org_research_data.get("source_url")
        source_date = executive_data.get("source_date") or org_research_data.get("source_date")

        # Extract executives from M09 data
        executives = executive_data.get("executives", [])

        # Categorize executives into buying committee roles
        decision_maker = None
        influencers = []
        technical_evaluators = []
        champions = []
        blockers = []

        for exec_info in executives:
            name = exec_info.get("name", "Unknown")
            title = exec_info.get("title", "").lower()
            linkedin_url = exec_info.get("linkedin_url")
            exec_source_url = exec_info.get("source_url", source_url)
            exec_source_date = exec_info.get("source_date", source_date)

            member = self._create_committee_member(
                name=name,
                title=exec_info.get("title", "Unknown"),
                linkedin_url=linkedin_url,
                source_url=exec_source_url,
                source_date=exec_source_date,
                company_name=company_name,
            )

            # Categorize based on title
            # Note: Use word boundary checks to avoid false matches
            # (e.g., "Director" contains "cto" substring)
            title_words = set(title.replace("-", " ").split())

            if "cto" in title_words or "chief technology" in title:
                if not decision_maker:
                    member.role_in_decision = "Technical Decision Maker"
                    member.engagement_strategy = "Executive briefing focused on strategic tech vision and competitive advantage"
                    member.talking_points = [
                        "Enterprise scalability and reliability",
                        "API-first architecture for developer velocity",
                        "AI/ML capabilities for personalization",
                        "Total cost of ownership vs. build-in-house",
                    ]
                    decision_maker = member
                else:
                    influencers.append(member)
            elif "cfo" in title_words or "chief financial" in title:
                member.role_in_decision = "Budget Authority"
                member.engagement_strategy = "ROI-focused discussion with clear cost-benefit analysis"
                member.talking_points = [
                    "Conversion rate improvements from better search",
                    "Revenue impact from improved discovery",
                    "Cost reduction vs. maintaining in-house solution",
                    "Time to value and implementation timeline",
                ]
                if not decision_maker:
                    decision_maker = member
                else:
                    influencers.append(member)
            elif ("vp" in title_words or "vice president" in title) and ("engineering" in title or "technology" in title):
                member.role_in_decision = "Technical Influencer"
                member.engagement_strategy = "Technical deep-dive with architecture discussion"
                member.talking_points = [
                    "Developer experience and documentation quality",
                    "Integration complexity and migration path",
                    "Performance benchmarks and SLAs",
                    "Customization capabilities",
                ]
                technical_evaluators.append(member)
            elif "director" in title and ("commerce" in title or "digital" in title or "product" in title):
                member.role_in_decision = "Business Champion"
                member.engagement_strategy = "Focus on business outcomes and user experience"
                member.talking_points = [
                    "Merchandising control and business user tools",
                    "Analytics and search performance insights",
                    "A/B testing capabilities",
                    "Time to market for new features",
                ]
                champions.append(member)
            elif "architect" in title or "lead" in title:
                member.role_in_decision = "Technical Evaluator"
                member.engagement_strategy = "Hands-on technical evaluation and POC discussion"
                member.talking_points = [
                    "API design and developer experience",
                    "Performance characteristics",
                    "Extensibility and customization",
                    "Security and compliance",
                ]
                technical_evaluators.append(member)
            else:
                # Default to influencer
                member.role_in_decision = "Stakeholder"
                member.engagement_strategy = "Discovery conversation to understand priorities"
                member.talking_points = [
                    "Current search pain points",
                    "Business objectives",
                    "Success criteria",
                ]
                influencers.append(member)

        # Determine entry point and multi-thread strategy
        entry_point = self._determine_entry_point(decision_maker, champions, technical_evaluators)
        multi_thread_strategy = self._determine_multi_thread_strategy(
            decision_maker, influencers, technical_evaluators, champions
        )

        # Estimate decision process and timeline from org research
        decision_indicators = org_research_data.get("decision_indicators", {})
        decision_process = decision_indicators.get("typical_process", "Unknown")
        estimated_timeline = decision_indicators.get("typical_timeline", "Unknown")

        return {
            "domain": domain,
            "company_name": company_name,
            "decision_maker": decision_maker.model_dump() if decision_maker else None,
            "influencers": [m.model_dump() for m in influencers],
            "technical_evaluators": [m.model_dump() for m in technical_evaluators],
            "champions": [m.model_dump() for m in champions],
            "blockers": [m.model_dump() for m in blockers],
            "decision_process": decision_process,
            "estimated_timeline": estimated_timeline,
            "entry_point": entry_point,
            "multi_thread_strategy": multi_thread_strategy,
            "algolia_familiarity": "Unknown",
            "current_vendor_relationship": "Unknown",
            "confidence_score": 0.6,  # Base confidence from mock data
            "source_url": source_url,
            "source_date": source_date,
        }

    def _create_committee_member(
        self,
        name: str,
        title: str,
        linkedin_url: Optional[str],
        source_url: str,
        source_date: str,
        company_name: str,
    ) -> CommitteeMember:
        """
        Create a CommitteeMember with default values.

        Args:
            name: Person's name
            title: Job title
            linkedin_url: LinkedIn profile URL
            source_url: Source URL
            source_date: Source date
            company_name: Company name for email pattern

        Returns:
            CommitteeMember instance
        """
        # Infer email pattern
        email_domain = company_name.lower().replace(" ", "").replace(",", "").replace(".", "")[:20]
        first_name = name.split()[0].lower() if name else "unknown"
        last_name = name.split()[-1].lower() if name and len(name.split()) > 1 else "unknown"
        email_pattern = f"{first_name}.{last_name}@{email_domain}.com"

        return CommitteeMember(
            name=name,
            title=title,
            role_in_decision="",  # Will be set by caller
            engagement_strategy="",  # Will be set by caller
            talking_points=[],  # Will be set by caller
            linkedin_url=linkedin_url,
            email_pattern=email_pattern,
            source_url=source_url,
            source_date=source_date if isinstance(source_date, str) else source_date.isoformat(),
        )

    def _determine_entry_point(
        self,
        decision_maker: Optional[CommitteeMember],
        champions: List[CommitteeMember],
        technical_evaluators: List[CommitteeMember],
    ) -> str:
        """
        Determine the recommended entry point for initial engagement.

        Args:
            decision_maker: Primary decision maker
            champions: Potential internal champions
            technical_evaluators: Technical evaluators

        Returns:
            Recommended entry point strategy
        """
        if champions:
            return f"Start with {champions[0].name} ({champions[0].title}) - likely champion for improved search experience"
        elif technical_evaluators:
            return f"Start with {technical_evaluators[0].name} ({technical_evaluators[0].title}) - technical evaluation path"
        elif decision_maker:
            return f"Executive approach via {decision_maker.name} ({decision_maker.title})"
        else:
            return "No clear entry point identified - recommend broad outreach"

    def _determine_multi_thread_strategy(
        self,
        decision_maker: Optional[CommitteeMember],
        influencers: List[CommitteeMember],
        technical_evaluators: List[CommitteeMember],
        champions: List[CommitteeMember],
    ) -> str:
        """
        Determine strategy for multi-threaded engagement.

        Args:
            decision_maker: Primary decision maker
            influencers: Influencers
            technical_evaluators: Technical evaluators
            champions: Champions

        Returns:
            Multi-thread engagement strategy
        """
        threads = []

        if decision_maker:
            threads.append(f"Executive thread: {decision_maker.name}")

        if technical_evaluators:
            tech_names = ", ".join([te.name for te in technical_evaluators[:2]])
            threads.append(f"Technical thread: {tech_names}")

        if champions:
            champion_names = ", ".join([c.name for c in champions[:2]])
            threads.append(f"Champion thread: {champion_names}")

        if not threads:
            return "Limited visibility into buying committee - recommend discovery call"

        return " | ".join(threads)

    def _calculate_completeness(self, data: Dict[str, Any]) -> float:
        """
        Calculate data completeness score (0.0 to 1.0).

        Args:
            data: Raw data dictionary

        Returns:
            Completeness score
        """
        score = 0.0

        # Decision maker identified (30%)
        if data.get("decision_maker"):
            score += 0.3

        # Influencers identified (15%)
        if data.get("influencers"):
            score += min(0.15, len(data["influencers"]) * 0.05)

        # Technical evaluators identified (20%)
        if data.get("technical_evaluators"):
            score += min(0.20, len(data["technical_evaluators"]) * 0.10)

        # Champions identified (15%)
        if data.get("champions"):
            score += min(0.15, len(data["champions"]) * 0.075)

        # Decision process known (10%)
        if data.get("decision_process") and data["decision_process"] != "Unknown":
            score += 0.10

        # Entry point identified (10%)
        if data.get("entry_point"):
            score += 0.10

        return min(1.0, score)

    async def _validate_and_create(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> BuyingCommitteeData:
        """
        Validate transformed data and create BuyingCommitteeData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data

        Returns:
            Validated BuyingCommitteeData model

        Raises:
            ValueError: If validation fails
        """
        # Validate domain matches
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert committee member dicts to CommitteeMember objects if needed
        decision_maker = None
        if transformed_data.get("decision_maker"):
            dm = transformed_data["decision_maker"]
            if isinstance(dm, dict):
                decision_maker = CommitteeMember(**dm)
            else:
                decision_maker = dm

        def to_member_list(items: List) -> List[CommitteeMember]:
            result = []
            for item in items:
                if isinstance(item, dict):
                    result.append(CommitteeMember(**item))
                else:
                    result.append(item)
            return result

        # Create data model (Pydantic validates the schema)
        return BuyingCommitteeData(
            domain=domain,
            company_name=transformed_data.get("company_name", "Unknown"),
            decision_maker=decision_maker,
            influencers=to_member_list(transformed_data.get("influencers", [])),
            technical_evaluators=to_member_list(transformed_data.get("technical_evaluators", [])),
            champions=to_member_list(transformed_data.get("champions", [])),
            blockers=to_member_list(transformed_data.get("blockers", [])),
            committee_size=transformed_data.get("committee_size", 0),
            decision_process=transformed_data.get("decision_process"),
            estimated_timeline=transformed_data.get("estimated_timeline"),
            entry_point=transformed_data.get("entry_point"),
            multi_thread_strategy=transformed_data.get("multi_thread_strategy"),
            algolia_familiarity=transformed_data.get("algolia_familiarity"),
            current_vendor_relationship=transformed_data.get("current_vendor_relationship"),
            data_completeness=transformed_data.get("data_completeness", 0.0),
            confidence_score=transformed_data.get("confidence_score", 0.0),
        )

    def _infer_company_name(self, domain: str) -> str:
        """
        Infer company name from domain.

        Used as fallback when API doesn't return company name.

        Args:
            domain: Domain like "costco.com"

        Returns:
            Inferred company name like "Costco Inc."
        """
        # Remove TLD
        name = domain.split(".")[0]

        # Split camelCase and add spaces
        import re
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)

        # Capitalize words
        name = " ".join(word.capitalize() for word in name.split())

        return f"{name} Inc."
