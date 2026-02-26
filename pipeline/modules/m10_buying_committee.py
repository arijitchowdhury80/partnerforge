"""
M10: Buying Committee Module
============================

Maps complete buying committee with roles, priorities, and engagement strategies.

Wave: 3 (Deep Intelligence - Depends on Wave 2)

Data Sources:
- M09: Executive Intelligence (primary source)
- LinkedIn (people search)
- Company management page
- Historical departure tracking

Dependencies:
- M01: Company Context
- M09: Executive Intelligence

Output Schema:
- buying_committee: Dict of roles to committee members
- committee_dynamics: Turnover, blockers, opportunities
- engagement_sequence: Step-by-step engagement plan

Database Table: intel_buying_committee

This module synthesizes executive data from M09 into an actionable
buying committee map with engagement strategy.

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M10 section)
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
    register_module,
)

logger = logging.getLogger(__name__)


class CommitteeMember(BaseModel):
    """Individual committee member with engagement details."""
    name: str = Field(..., description="Full name")
    title: str = Field(..., description="Current title")
    role: str = Field(..., description="Committee role (Executive Sponsor, etc.)")

    # Influence
    influence: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")
    budget_authority: bool = Field(default=False)
    veto_power: bool = Field(default=False)

    # Tenure
    tenure_months: Optional[int] = Field(None, description="Months in role")
    is_new_to_role: bool = Field(default=False)

    # Engagement
    engagement_strategy: Optional[str] = Field(None)
    use_case_interest: Optional[str] = Field(None)
    linkedin_url: Optional[str] = Field(None)

    # Internal advocate potential
    is_internal_advocate: bool = Field(default=False)


class TechnicalEvaluator(BaseModel):
    """Technical team member who will evaluate the solution."""
    name: str
    title: str
    role: str = Field(default="Technical evaluation")


class CommitteeDynamics(BaseModel):
    """Dynamics and patterns within the buying committee."""
    total_decision_makers: int = Field(default=0)
    primary_blockers: List[str] = Field(default_factory=list)
    recent_departures: List[str] = Field(
        default_factory=list,
        description="Recent departures that may impact deals"
    )
    turnover_insight: Optional[str] = Field(None)
    power_structure: Optional[str] = Field(
        None,
        description="Centralized, distributed, etc."
    )


class EngagementStep(BaseModel):
    """Single step in engagement sequence."""
    step: int
    target: str = Field(..., description="Name of target person")
    approach: str = Field(..., description="Engagement approach")
    timing: Optional[str] = Field(None, description="Recommended timing")
    success_criteria: Optional[str] = Field(None)


class BuyingCommitteeData(BaseModel):
    """
    Output schema for M10 Buying Committee module.

    Complete buying committee map with engagement strategy.
    """

    domain: str = Field(..., description="Primary domain")
    company_name: Optional[str] = Field(None)

    # Buying committee roles
    buying_committee: Dict[str, Optional[CommitteeMember]] = Field(
        default_factory=lambda: {
            "executive_sponsor": None,
            "economic_buyer": None,
            "technical_buyer": None,
            "champion": None,
        },
        description="Main buying committee roles"
    )

    # Additional members
    user_buyers: List[CommitteeMember] = Field(
        default_factory=list,
        description="User-level stakeholders"
    )
    technical_evaluators: List[TechnicalEvaluator] = Field(
        default_factory=list,
        description="Technical evaluation team"
    )

    # Committee dynamics
    committee_dynamics: CommitteeDynamics = Field(
        default_factory=CommitteeDynamics
    )

    # Engagement plan
    engagement_sequence: List[EngagementStep] = Field(
        default_factory=list,
        description="Recommended engagement order"
    )

    # Aggregated metrics
    committee_completeness_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="How complete is our committee mapping"
    )
    engagement_readiness_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Readiness for outreach"
    )

    # Metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)
    data_limitation_reason: Optional[str] = Field(None)


# Departure data for companies (mock)
DEPARTURE_DATA = {
    "sallybeauty.com": {
        "recent_departures": [
            "Ellery Fisher (GVP E-Commerce) -> McKesson",
            "Kevin Metz (VP E-Commerce)",
        ],
        "turnover_insight": "High digital leadership turnover creates opportunity for new vendor relationships",
    },
    "costco.com": {
        "recent_departures": [],
        "turnover_insight": "Stable leadership team - established vendor relationships",
    },
}


@register_module
class M10BuyingCommittee(BaseModule):
    """
    Buying Committee Module.

    Synthesizes executive intelligence into actionable buying committee
    mapping with engagement strategy.

    Wave 3 - Depends on M01 and M09

    Data Flow:
    1. Get executive data from M09
    2. Map executives to buying committee roles
    3. Analyze committee dynamics
    4. Generate engagement sequence
    5. Calculate readiness scores
    6. Return with source citations
    """

    MODULE_ID = "m10_buying_committee"
    MODULE_NAME = "Buying Committee"
    DESCRIPTION = "Buying committee mapping and engagement strategy"

    WAVE = 3
    DEPENDS_ON = ["m01_company_context", "m09_executive_intelligence"]

    PRIMARY_SOURCE_TYPE = SourceType.LINKEDIN
    OUTPUT_TABLE = "intel_buying_committee"
    TIMEOUT_SECONDS = 45

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute buying committee mapping.

        Args:
            domain: The domain to analyze
            context: Results from M01 and M09

        Returns:
            ModuleResult with BuyingCommitteeData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting buying committee mapping for {domain}")

            # Validate dependencies
            context = context or {}
            self.validate_dependencies(context)

            normalized_domain = self._normalize_domain(domain)

            # Get company name from M01
            m01_data = context.get("m01_company_context", {})
            if isinstance(m01_data, ModuleResult):
                m01_data = m01_data.data
            company_name = m01_data.get("company_name", "")

            # Get executives from M09
            m09_data = context.get("m09_executive_intelligence", {})
            if isinstance(m09_data, ModuleResult):
                m09_data = m09_data.data
            executives = m09_data.get("executives", [])

            if executives:
                # Map committee from executives
                buying_committee = self._map_buying_committee(executives)

                # Get user buyers
                user_buyers = self._extract_user_buyers(executives)

                # Get technical evaluators
                technical_evaluators = self._extract_technical_evaluators(executives)

                # Analyze dynamics
                dynamics = self._analyze_dynamics(
                    buying_committee,
                    user_buyers,
                    normalized_domain,
                )

                # Generate engagement sequence
                engagement_sequence = self._generate_engagement_sequence(
                    buying_committee,
                    user_buyers,
                )

                # Calculate scores
                completeness_score = self._calculate_completeness(buying_committee)
                readiness_score = self._calculate_readiness(
                    buying_committee,
                    engagement_sequence,
                )

                data_limitation = None

                # Create citation from M09
                citations = [
                    self._create_citation(
                        source_type=SourceType.LINKEDIN,
                        source_url=f"https://www.linkedin.com/company/{normalized_domain.replace('.com', '')}/people/",
                        confidence=0.85,
                        notes="Synthesized from M09 Executive Intelligence",
                    )
                ]
            else:
                # No executives found
                buying_committee = {
                    "executive_sponsor": None,
                    "economic_buyer": None,
                    "technical_buyer": None,
                    "champion": None,
                }
                user_buyers = []
                technical_evaluators = []
                dynamics = CommitteeDynamics()
                engagement_sequence = []
                completeness_score = 0.0
                readiness_score = 0.0
                data_limitation = "No executive data available from M09"

                citations = [
                    self._create_citation(
                        source_type=SourceType.WEBSEARCH,
                        source_url=f"https://www.google.com/search?q={normalized_domain}+leadership",
                        confidence=0.3,
                        notes=data_limitation,
                    )
                ]

            # Build output
            output_data = BuyingCommitteeData(
                domain=normalized_domain,
                company_name=company_name,
                buying_committee=buying_committee,
                user_buyers=user_buyers,
                technical_evaluators=technical_evaluators,
                committee_dynamics=dynamics,
                engagement_sequence=engagement_sequence,
                committee_completeness_score=completeness_score,
                engagement_readiness_score=readiness_score,
                data_quality_score=self._calculate_data_quality(
                    buying_committee, engagement_sequence
                ),
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
                f"Buying committee mapping complete for {domain}. "
                f"Completeness: {completeness_score:.0%}, "
                f"Readiness: {readiness_score:.0%}. "
                f"Duration: {duration_ms:.0f}ms"
            )

            return result

        except DependencyNotMetError:
            raise
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Buying committee mapping failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")
        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")
        return True

    def _map_buying_committee(
        self,
        executives: List[Dict[str, Any]],
    ) -> Dict[str, Optional[CommitteeMember]]:
        """Map executives to buying committee roles."""
        committee = {
            "executive_sponsor": None,
            "economic_buyer": None,
            "technical_buyer": None,
            "champion": None,
        }

        role_mapping = {
            "Executive Sponsor": "executive_sponsor",
            "Economic Buyer": "economic_buyer",
            "Technical Buyer": "technical_buyer",
            "Champion": "champion",
        }

        for exec_data in executives:
            buyer_role = exec_data.get("buyer_role", "Unknown")
            committee_key = role_mapping.get(buyer_role)

            if committee_key and committee[committee_key] is None:
                # Calculate tenure months
                tenure_months = None
                tenure_start = exec_data.get("tenure_start")
                if tenure_start:
                    try:
                        start = datetime.strptime(tenure_start, "%Y-%m")
                        tenure_months = (datetime.utcnow().year - start.year) * 12 + \
                                       (datetime.utcnow().month - start.month)
                    except ValueError:
                        pass

                member = CommitteeMember(
                    name=exec_data.get("name", "Unknown"),
                    title=exec_data.get("title", "Unknown"),
                    role=buyer_role,
                    influence=exec_data.get("influence_level", "MEDIUM"),
                    budget_authority=buyer_role in ["Economic Buyer", "Executive Sponsor"],
                    veto_power=buyer_role in ["Technical Buyer", "Executive Sponsor"],
                    tenure_months=tenure_months,
                    is_new_to_role=exec_data.get("is_new_to_role", False),
                    engagement_strategy=exec_data.get("entry_approach"),
                    linkedin_url=exec_data.get("linkedin_url"),
                    is_internal_advocate=buyer_role == "Champion",
                )
                committee[committee_key] = member

        return committee

    def _extract_user_buyers(
        self,
        executives: List[Dict[str, Any]],
    ) -> List[CommitteeMember]:
        """Extract user buyers from executives."""
        user_buyers = []

        for exec_data in executives:
            if exec_data.get("buyer_role") == "User Buyer":
                member = CommitteeMember(
                    name=exec_data.get("name", "Unknown"),
                    title=exec_data.get("title", "Unknown"),
                    role="User Buyer",
                    influence="MEDIUM",
                    engagement_strategy=exec_data.get("entry_approach"),
                    use_case_interest=self._infer_use_case(exec_data.get("title", "")),
                )
                user_buyers.append(member)

        return user_buyers

    def _extract_technical_evaluators(
        self,
        executives: List[Dict[str, Any]],
    ) -> List[TechnicalEvaluator]:
        """Extract potential technical evaluators."""
        evaluators = []

        # Look for architect/engineer titles
        tech_keywords = ["architect", "engineer", "developer", "technical"]

        for exec_data in executives:
            title = exec_data.get("title", "").lower()
            if any(kw in title for kw in tech_keywords):
                evaluator = TechnicalEvaluator(
                    name=exec_data.get("name", "Unknown"),
                    title=exec_data.get("title", "Unknown"),
                    role="Technical evaluation",
                )
                evaluators.append(evaluator)

        return evaluators

    def _analyze_dynamics(
        self,
        committee: Dict[str, Optional[CommitteeMember]],
        user_buyers: List[CommitteeMember],
        domain: str,
    ) -> CommitteeDynamics:
        """Analyze committee dynamics."""
        # Count decision makers
        decision_makers = sum(1 for m in committee.values() if m is not None)
        decision_makers += len(user_buyers)

        # Get departure data
        departures = DEPARTURE_DATA.get(domain, {})

        # Identify potential blockers (technical buyer often is)
        blockers = []
        tech_buyer = committee.get("technical_buyer")
        if tech_buyer and not tech_buyer.is_new_to_role:
            # Established technical buyer may have existing vendor relationships
            pass  # Not necessarily a blocker

        # Determine power structure
        if committee.get("executive_sponsor") and committee.get("economic_buyer"):
            power_structure = "Centralized - C-level aligned"
        elif committee.get("champion"):
            power_structure = "Distributed - needs champion to build consensus"
        else:
            power_structure = "Unknown"

        return CommitteeDynamics(
            total_decision_makers=decision_makers,
            primary_blockers=blockers,
            recent_departures=departures.get("recent_departures", []),
            turnover_insight=departures.get("turnover_insight"),
            power_structure=power_structure,
        )

    def _generate_engagement_sequence(
        self,
        committee: Dict[str, Optional[CommitteeMember]],
        user_buyers: List[CommitteeMember],
    ) -> List[EngagementStep]:
        """Generate recommended engagement sequence."""
        steps = []
        step_num = 1

        # Priority order: Champion -> Technical Buyer -> Economic Buyer -> Executive Sponsor
        engagement_order = [
            ("champion", "Build internal advocacy"),
            ("technical_buyer", "Technical validation and POC"),
            ("economic_buyer", "Business case and ROI"),
            ("executive_sponsor", "Executive alignment"),
        ]

        for role_key, purpose in engagement_order:
            member = committee.get(role_key)
            if member:
                approach = member.engagement_strategy or f"{purpose} discussion"
                step = EngagementStep(
                    step=step_num,
                    target=member.name,
                    approach=approach,
                    success_criteria=self._get_success_criteria(role_key),
                )
                steps.append(step)
                step_num += 1

        return steps

    def _get_success_criteria(self, role: str) -> str:
        """Get success criteria for engagement step."""
        criteria = {
            "champion": "Internal interest confirmed, willing to sponsor POC",
            "technical_buyer": "Technical fit validated, no blockers identified",
            "economic_buyer": "Budget alignment, ROI case accepted",
            "executive_sponsor": "Strategic alignment, deal sponsor identified",
        }
        return criteria.get(role, "Meeting completed")

    def _infer_use_case(self, title: str) -> str:
        """Infer use case interest from title."""
        title_lower = title.lower()

        if "merchandising" in title_lower:
            return "Merchandising Studio"
        elif "category" in title_lower:
            return "Category discovery"
        elif "marketing" in title_lower:
            return "Marketing campaigns"
        elif "content" in title_lower:
            return "Content search"
        else:
            return "General search improvement"

    def _calculate_completeness(
        self,
        committee: Dict[str, Optional[CommitteeMember]],
    ) -> float:
        """Calculate committee completeness score."""
        filled = sum(1 for m in committee.values() if m is not None)
        return filled / len(committee)

    def _calculate_readiness(
        self,
        committee: Dict[str, Optional[CommitteeMember]],
        sequence: List[EngagementStep],
    ) -> float:
        """Calculate engagement readiness score."""
        score = 0.0

        # Has champion (most important for readiness)
        if committee.get("champion"):
            score += 0.4

        # Has engagement sequence
        if len(sequence) >= 2:
            score += 0.3

        # Has technical buyer
        if committee.get("technical_buyer"):
            score += 0.2

        # Has economic buyer
        if committee.get("economic_buyer"):
            score += 0.1

        return min(score, 1.0)

    def _calculate_data_quality(
        self,
        committee: Dict[str, Optional[CommitteeMember]],
        sequence: List[EngagementStep],
    ) -> float:
        """Calculate data quality score."""
        score = 0.0

        # Committee coverage
        filled = sum(1 for m in committee.values() if m is not None)
        score += (filled / len(committee)) * 0.5

        # Engagement strategies
        with_strategy = sum(
            1 for m in committee.values()
            if m and m.engagement_strategy
        )
        score += min(0.3, with_strategy * 0.1)

        # Engagement sequence
        if sequence:
            score += 0.2

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
