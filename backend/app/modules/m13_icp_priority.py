"""
M13 ICP Priority Mapping Intelligence Module

Calculates final ICP (Ideal Customer Profile) score and priority tier
by synthesizing data from all prior modules (Wave 1-3).

This is a Wave 4 (Synthesis) module that depends on:
- M01: Company Context (vertical, business model)
- M03: Traffic Analysis (monthly visits)
- M02: Technology Stack (tech spend, partner tech)

Scoring Formula (100 points total):
- Vertical/Tier: 40 points (Commerce=40, Content=25, Support=15)
- Traffic: 30 points (50M+=30, 10M+=25, 1M+=15, 500K+=10)
- Tech Spend: 20 points ($100K+=20, $50K+=15, $25K+=10)
- Partner Tech: 10 points (Adobe=10, Shopify=7, Other=3)

Priority Tiers:
- Hot: 80-100 points (immediate outreach)
- Warm: 60-79 points (nurture campaign)
- Cool: 40-59 points (quarterly check-in)
- Cold: 0-39 points (passive monitoring)

SOURCE CITATION MANDATE: Every data point MUST have source_url and source_date.
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

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

# Vertical scoring (40 points max)
VERTICAL_SCORES = {
    "commerce": 40,
    "e-commerce": 40,
    "retail": 40,
    "marketplace": 40,
    "media": 30,
    "publishing": 30,
    "content": 25,
    "documentation": 25,
    "support": 15,
    "internal": 10,
    "other": 5,
}

# Traffic scoring thresholds (30 points max)
TRAFFIC_THRESHOLDS = [
    (50_000_000, 30),   # 50M+ visits
    (10_000_000, 25),   # 10M+ visits
    (1_000_000, 15),    # 1M+ visits
    (500_000, 10),      # 500K+ visits
    (100_000, 5),       # 100K+ visits
    (0, 0),             # Below 100K
]

# Tech spend scoring thresholds (20 points max)
TECH_SPEND_THRESHOLDS = [
    (100_000, 20),  # $100K+
    (50_000, 15),   # $50K+
    (25_000, 10),   # $25K+
    (10_000, 5),    # $10K+
    (0, 0),         # Below $10K
]

# Partner tech scoring (10 points max)
PARTNER_TECH_SCORES = {
    "adobe": 10,
    "adobe aem": 10,
    "adobe experience manager": 10,
    "shopify": 7,
    "shopify plus": 8,
    "salesforce": 6,
    "salesforce commerce cloud": 7,
    "bigcommerce": 5,
    "magento": 5,
    "commercetools": 6,
    "other": 3,
}

# Priority tier thresholds
TIER_THRESHOLDS = {
    "hot": (80, 100),
    "warm": (60, 79),
    "cool": (40, 59),
    "cold": (0, 39),
}

# Recommended actions by tier
TIER_ACTIONS = {
    "hot": "Immediate outreach by AE - schedule discovery call this week",
    "warm": "Add to nurture campaign - personalized email sequence",
    "cool": "Quarterly check-in - monitor for trigger events",
    "cold": "Passive monitoring - add to watch list",
}

# Next best actions by tier
TIER_NEXT_ACTIONS = {
    "hot": [
        "Research key stakeholders on LinkedIn",
        "Prepare custom demo tailored to their vertical",
        "Identify mutual connections for warm intro",
        "Review their current search implementation",
    ],
    "warm": [
        "Add to personalized email sequence",
        "Share relevant case study from same vertical",
        "Set alert for job postings indicating search project",
        "Monitor for trigger events (funding, expansion)",
    ],
    "cool": [
        "Add to general nurture campaign",
        "Set quarterly reminder to re-evaluate",
        "Monitor for ICP score changes",
        "Track competitive intel for displacement opportunities",
    ],
    "cold": [
        "Add to watch list",
        "Set annual review reminder",
        "Monitor for significant company changes",
        "Track if they become Algolia customer elsewhere",
    ],
}


# =============================================================================
# Enums
# =============================================================================

class ICPTier(str, Enum):
    """ICP priority tier."""
    HOT = "hot"
    WARM = "warm"
    COOL = "cool"
    COLD = "cold"


# =============================================================================
# Data Models
# =============================================================================

class ScoreBreakdown(BaseModel):
    """Detailed breakdown of ICP score components."""

    vertical_score: int = Field(0, ge=0, le=40, description="Vertical/tier score (0-40)")
    vertical_reason: str = Field("", description="Explanation for vertical score")

    traffic_score: int = Field(0, ge=0, le=30, description="Traffic score (0-30)")
    traffic_reason: str = Field("", description="Explanation for traffic score")

    tech_spend_score: int = Field(0, ge=0, le=20, description="Tech spend score (0-20)")
    tech_spend_reason: str = Field("", description="Explanation for tech spend score")

    partner_tech_score: int = Field(0, ge=0, le=10, description="Partner tech score (0-10)")
    partner_tech_reason: str = Field("", description="Explanation for partner tech score")

    total_score: int = Field(0, ge=0, le=100, description="Total ICP score (0-100)")


class ICPPriorityData(BaseModel):
    """
    ICP Priority Mapping data model - output of M13 module.

    Synthesizes data from all prior modules to calculate final ICP score
    and recommended actions.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'costco.com')")

    # ICP Score (0-100)
    icp_score: int = Field(..., ge=0, le=100, description="Final ICP score (0-100)")

    # Priority tier
    icp_tier: ICPTier = Field(..., description="Priority tier (hot/warm/cool/cold)")

    # Score breakdown
    score_breakdown: ScoreBreakdown = Field(..., description="Detailed score breakdown")

    # Ranking
    priority_rank: Optional[int] = Field(
        None,
        description="Rank within territory (1 = highest priority)"
    )

    # Input data used for scoring
    input_vertical: Optional[str] = Field(None, description="Vertical used for scoring")
    input_monthly_visits: Optional[int] = Field(None, description="Monthly visits used")
    input_tech_spend: Optional[float] = Field(None, description="Tech spend used")
    input_partner_tech: Optional[str] = Field(None, description="Partner tech used")

    # Actions
    recommended_action: str = Field(..., description="Primary recommended action")
    next_best_actions: List[str] = Field(
        default_factory=list,
        description="Prioritized list of next best actions"
    )

    # Signals that influenced scoring
    scoring_signals: List[str] = Field(
        default_factory=list,
        description="Key signals that influenced the score"
    )

    # Confidence
    confidence: float = Field(
        1.0,
        ge=0.0,
        le=1.0,
        description="Confidence in score (0-1, based on data completeness)"
    )

    # Metadata
    last_scored_at: datetime = Field(
        default_factory=datetime.now,
        description="When the score was last calculated"
    )

    # Previous score (for change detection)
    previous_score: Optional[int] = Field(
        None,
        description="Previous ICP score (for trend analysis)"
    )

    score_change: Optional[int] = Field(
        None,
        description="Change in score from previous (+ is improvement)"
    )


# =============================================================================
# Module Implementation
# =============================================================================

@register_module
class M13ICPPriorityModule(BaseIntelligenceModule):
    """
    M13: ICP Priority Mapping - calculates final ICP score and tier.

    Wave 4 (Synthesis) module that depends on Wave 1-3 modules.
    Synthesizes company context, traffic, and tech stack data into
    a single prioritization score.
    """

    MODULE_ID = "m13_icp_priority"
    MODULE_NAME = "ICP Priority Mapping"
    WAVE = 4
    DEPENDS_ON = ["m01_company_context", "m02_tech_stack", "m03_traffic"]
    SOURCE_TYPE = "computed"
    CACHE_TTL = 86400  # 24 hours

    async def enrich(
        self,
        domain: str,
        force: bool = False,
        dependency_data: Optional[Dict[str, Any]] = None
    ) -> ModuleResult:
        """
        Calculate ICP priority score for a domain.

        Args:
            domain: The domain to score (e.g., "costco.com")
            force: If True, bypass cache and recalculate
            dependency_data: Pre-fetched data from dependent modules

        Returns:
            ModuleResult with ICPPriorityData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            ValueError: If required dependency data is missing
        """
        self.logger.info(f"Calculating ICP priority for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached result for: {domain}")
                return cached

        # Fetch or use provided dependency data
        raw_data = await self.fetch_data(domain, dependency_data)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Transform and calculate score
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        icp_data = await self._validate_and_store(domain, transformed)

        # Get source info (computed from dependency sources)
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
            data=icp_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(
            f"ICP score for {domain}: {icp_data.icp_score} ({icp_data.icp_tier.value})"
        )
        return result

    async def fetch_data(
        self,
        domain: str,
        dependency_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Fetch data from dependent modules.

        If dependency_data is provided, uses that. Otherwise,
        fetches from each dependent module.

        Args:
            domain: The domain to fetch data for
            dependency_data: Pre-fetched dependency data (optional)

        Returns:
            dict with aggregated data from dependencies
        """
        if dependency_data:
            # Use provided data
            return self._aggregate_dependency_data(domain, dependency_data)

        # Fetch from each dependency (mock implementation)
        # In production, this would call the actual modules
        return await self._fetch_from_dependencies(domain)

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw dependency data into ICP score and tier.

        This is where the actual scoring calculation happens.

        Args:
            raw_data: Aggregated data from dependencies

        Returns:
            Transformed data with ICP score, tier, and breakdown
        """
        # Extract input values
        vertical = raw_data.get("vertical", "").lower()
        monthly_visits = raw_data.get("monthly_visits", 0) or 0
        tech_spend = raw_data.get("tech_spend", 0) or 0
        partner_tech = raw_data.get("partner_tech", "").lower()

        # Calculate component scores
        vertical_score, vertical_reason = self._calculate_vertical_score(vertical)
        traffic_score, traffic_reason = self._calculate_traffic_score(monthly_visits)
        tech_spend_score, tech_spend_reason = self._calculate_tech_spend_score(tech_spend)
        partner_tech_score, partner_tech_reason = self._calculate_partner_tech_score(partner_tech)

        # Total score
        total_score = (
            vertical_score +
            traffic_score +
            tech_spend_score +
            partner_tech_score
        )

        # Determine tier
        tier = self._determine_tier(total_score)

        # Calculate confidence based on data completeness
        confidence = self._calculate_confidence(raw_data)

        # Build scoring signals
        signals = self._build_scoring_signals(
            vertical, monthly_visits, tech_spend, partner_tech
        )

        # Get previous score for change detection
        previous_score = raw_data.get("previous_score")
        score_change = None
        if previous_score is not None:
            score_change = total_score - previous_score

        return {
            "domain": raw_data.get("domain"),
            "icp_score": total_score,
            "icp_tier": tier,
            "score_breakdown": {
                "vertical_score": vertical_score,
                "vertical_reason": vertical_reason,
                "traffic_score": traffic_score,
                "traffic_reason": traffic_reason,
                "tech_spend_score": tech_spend_score,
                "tech_spend_reason": tech_spend_reason,
                "partner_tech_score": partner_tech_score,
                "partner_tech_reason": partner_tech_reason,
                "total_score": total_score,
            },
            "input_vertical": vertical if vertical else None,
            "input_monthly_visits": monthly_visits if monthly_visits else None,
            "input_tech_spend": tech_spend if tech_spend else None,
            "input_partner_tech": partner_tech if partner_tech else None,
            "recommended_action": TIER_ACTIONS.get(tier.value, ""),
            "next_best_actions": TIER_NEXT_ACTIONS.get(tier.value, []),
            "scoring_signals": signals,
            "confidence": confidence,
            "previous_score": previous_score,
            "score_change": score_change,
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    def _calculate_vertical_score(self, vertical: str) -> tuple[int, str]:
        """Calculate vertical score (0-40 points)."""
        if not vertical:
            return 0, "No vertical data available"

        # Check for exact match first
        score = VERTICAL_SCORES.get(vertical)
        if score is not None:
            return score, f"Vertical '{vertical}' matches ICP ({score}/40 points)"

        # Check for partial matches
        for key, points in VERTICAL_SCORES.items():
            if key in vertical or vertical in key:
                return points, f"Vertical '{vertical}' partially matches '{key}' ({points}/40 points)"

        # Default to "other"
        return VERTICAL_SCORES["other"], f"Vertical '{vertical}' not in ICP priorities (5/40 points)"

    def _calculate_traffic_score(self, monthly_visits: int) -> tuple[int, str]:
        """Calculate traffic score (0-30 points)."""
        if not monthly_visits or monthly_visits <= 0:
            return 0, "No traffic data available"

        for threshold, points in TRAFFIC_THRESHOLDS:
            if monthly_visits >= threshold:
                if threshold >= 1_000_000:
                    visits_str = f"{monthly_visits / 1_000_000:.1f}M"
                elif threshold >= 1_000:
                    visits_str = f"{monthly_visits / 1_000:.0f}K"
                else:
                    visits_str = str(monthly_visits)
                return points, f"{visits_str} monthly visits ({points}/30 points)"

        return 0, f"{monthly_visits} monthly visits (below threshold)"

    def _calculate_tech_spend_score(self, tech_spend: float) -> tuple[int, str]:
        """Calculate tech spend score (0-20 points)."""
        if not tech_spend or tech_spend <= 0:
            return 0, "No tech spend data available"

        for threshold, points in TECH_SPEND_THRESHOLDS:
            if tech_spend >= threshold:
                spend_str = f"${tech_spend / 1000:.0f}K" if tech_spend >= 1000 else f"${tech_spend:.0f}"
                return points, f"{spend_str} tech spend ({points}/20 points)"

        return 0, f"${tech_spend:.0f} tech spend (below threshold)"

    def _calculate_partner_tech_score(self, partner_tech: str) -> tuple[int, str]:
        """Calculate partner tech score (0-10 points)."""
        if not partner_tech:
            return 0, "No partner tech detected"

        # Check for exact match first
        score = PARTNER_TECH_SCORES.get(partner_tech)
        if score is not None:
            return score, f"Using {partner_tech} ({score}/10 points)"

        # Check for partial matches
        for key, points in PARTNER_TECH_SCORES.items():
            if key in partner_tech or partner_tech in key:
                return points, f"Using {partner_tech} (matches {key}, {points}/10 points)"

        # Default to "other"
        return PARTNER_TECH_SCORES["other"], f"Using {partner_tech} (other partner, 3/10 points)"

    def _determine_tier(self, score: int) -> ICPTier:
        """Determine priority tier based on total score."""
        if score >= 80:
            return ICPTier.HOT
        elif score >= 60:
            return ICPTier.WARM
        elif score >= 40:
            return ICPTier.COOL
        else:
            return ICPTier.COLD

    def _calculate_confidence(self, raw_data: Dict[str, Any]) -> float:
        """
        Calculate confidence score based on data completeness.

        Full confidence (1.0) requires:
        - Vertical data
        - Traffic data
        - Tech spend data
        - Partner tech data
        """
        factors = [
            bool(raw_data.get("vertical")),
            bool(raw_data.get("monthly_visits")),
            bool(raw_data.get("tech_spend")),
            bool(raw_data.get("partner_tech")),
        ]
        return sum(factors) / len(factors)

    def _build_scoring_signals(
        self,
        vertical: str,
        monthly_visits: int,
        tech_spend: float,
        partner_tech: str
    ) -> List[str]:
        """Build list of key signals that influenced the score."""
        signals = []

        if vertical in ["commerce", "e-commerce", "retail", "marketplace"]:
            signals.append(f"High-value vertical: {vertical}")

        if monthly_visits and monthly_visits >= 10_000_000:
            signals.append(f"High traffic: {monthly_visits / 1_000_000:.1f}M monthly visits")

        if tech_spend and tech_spend >= 50_000:
            signals.append(f"Significant tech spend: ${tech_spend / 1000:.0f}K")

        if partner_tech and partner_tech.lower() in ["adobe", "adobe aem", "adobe experience manager"]:
            signals.append(f"Adobe partner: {partner_tech}")
        elif partner_tech and partner_tech.lower() in ["shopify", "shopify plus"]:
            signals.append(f"Shopify partner: {partner_tech}")

        return signals

    async def _fetch_from_dependencies(self, domain: str) -> Dict[str, Any]:
        """
        Fetch data from dependent modules (mock implementation).

        In production, this would call each dependent module's enrich method.
        For now, returns mock data structure.
        """
        now = datetime.now()

        return {
            "domain": domain,
            "vertical": "retail",
            "monthly_visits": 5_000_000,
            "tech_spend": 75_000,
            "partner_tech": "Adobe AEM",
            "source_url": f"https://partnerforge.algolia.com/computed/{domain}",
            "source_date": now.isoformat(),
        }

    def _aggregate_dependency_data(
        self,
        domain: str,
        dependency_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Aggregate data from pre-fetched dependency results.

        Args:
            domain: The domain
            dependency_data: Dict mapping module_id -> module result data

        Returns:
            Aggregated data dict with all fields needed for scoring
        """
        result = {"domain": domain}
        now = datetime.now()

        # Extract from M01 Company Context
        m01_data = dependency_data.get("m01_company_context", {})
        if isinstance(m01_data, dict):
            result["vertical"] = m01_data.get("vertical") or m01_data.get("industry", "")

        # Extract from M03 Traffic
        m03_data = dependency_data.get("m03_traffic", {})
        if isinstance(m03_data, dict):
            result["monthly_visits"] = m03_data.get("monthly_visits", 0)

        # Extract from M02 Tech Stack
        m02_data = dependency_data.get("m02_tech_stack", {})
        if isinstance(m02_data, dict):
            result["tech_spend"] = m02_data.get("tech_spend", 0)
            result["partner_tech"] = m02_data.get("partner_tech", "")

        # Use latest source from dependencies
        latest_source = None
        latest_date = None

        for module_id in ["m01_company_context", "m02_tech_stack", "m03_traffic"]:
            mod_data = dependency_data.get(module_id, {})
            if isinstance(mod_data, dict):
                source_url = mod_data.get("source_url")
                source_date = mod_data.get("source_date")

                if source_url and source_date:
                    if isinstance(source_date, str):
                        try:
                            source_date = datetime.fromisoformat(source_date.replace("Z", "+00:00"))
                        except ValueError:
                            continue

                    if latest_date is None or source_date > latest_date:
                        latest_source = source_url
                        latest_date = source_date

        # Set computed source if no dependency sources
        result["source_url"] = latest_source or f"https://partnerforge.algolia.com/computed/{domain}"
        result["source_date"] = (latest_date or now).isoformat() if latest_date else now.isoformat()

        return result

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> ICPPriorityData:
        """
        Validate transformed data and create ICPPriorityData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated ICPPriorityData model

        Raises:
            ValueError: If validation fails
        """
        # Create score breakdown model
        breakdown = ScoreBreakdown(**transformed_data.get("score_breakdown", {}))

        # Create main data model
        return ICPPriorityData(
            domain=domain,
            icp_score=transformed_data.get("icp_score", 0),
            icp_tier=transformed_data.get("icp_tier", ICPTier.COLD),
            score_breakdown=breakdown,
            input_vertical=transformed_data.get("input_vertical"),
            input_monthly_visits=transformed_data.get("input_monthly_visits"),
            input_tech_spend=transformed_data.get("input_tech_spend"),
            input_partner_tech=transformed_data.get("input_partner_tech"),
            recommended_action=transformed_data.get("recommended_action", ""),
            next_best_actions=transformed_data.get("next_best_actions", []),
            scoring_signals=transformed_data.get("scoring_signals", []),
            confidence=transformed_data.get("confidence", 1.0),
            previous_score=transformed_data.get("previous_score"),
            score_change=transformed_data.get("score_change"),
        )
