"""
M14 Signal Scoring Intelligence Module

Scores and prioritizes all detected signals to identify optimal engagement timing.
This is a Wave 4 (Synthesis) module that depends on all previous modules.

Data Sources:
- M01-M13 module outputs (signal aggregation)
- Signal weights configuration

Output: Comprehensive signal scoring with urgency ranking, top signals,
engagement window recommendation, and timing guidance.

SOURCE CITATION MANDATE: Every signal MUST have source_url and source_date.
"""

import logging
from datetime import datetime, timedelta
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
# Enums and Constants
# =============================================================================


class SignalType(str, Enum):
    """Types of signals detected."""
    EXECUTIVE_CHANGE = "executive_change"
    TECH_REMOVAL = "tech_removal"
    HIRING_SPIKE = "hiring_spike"
    COMPETITOR_LOSS = "competitor_loss"
    EXPANSION_NEWS = "expansion_news"
    FUNDING_ROUND = "funding_round"
    PLATFORM_MIGRATION = "platform_migration"
    DIGITAL_INITIATIVE = "digital_initiative"
    REVENUE_GROWTH = "revenue_growth"
    LAYOFFS = "layoffs"


class SignalUrgency(str, Enum):
    """Urgency levels for signals."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SignalCategory(str, Enum):
    """Categories of signals for grouping."""
    BUDGET = "budget"
    PAIN = "pain"
    TIMING = "timing"
    NEGATIVE = "negative"


# Signal configuration: base scores and urgency levels
SIGNAL_CONFIG = {
    SignalType.EXECUTIVE_CHANGE: {
        "base_score": 25,
        "urgency": SignalUrgency.HIGH,
        "category": SignalCategory.TIMING,
        "decay_days": 90,  # Signal value decays after this many days
        "description": "New executive may not have existing vendor relationships"
    },
    SignalType.TECH_REMOVAL: {
        "base_score": 40,
        "urgency": SignalUrgency.CRITICAL,
        "category": SignalCategory.PAIN,
        "decay_days": 30,
        "description": "Technology removed - greenfield opportunity"
    },
    SignalType.HIRING_SPIKE: {
        "base_score": 20,
        "urgency": SignalUrgency.MEDIUM,
        "category": SignalCategory.BUDGET,
        "decay_days": 60,
        "description": "Active hiring indicates budget and growth"
    },
    SignalType.COMPETITOR_LOSS: {
        "base_score": 35,
        "urgency": SignalUrgency.HIGH,
        "category": SignalCategory.PAIN,
        "decay_days": 45,
        "description": "Competitor lost deal - timing opportunity"
    },
    SignalType.EXPANSION_NEWS: {
        "base_score": 15,
        "urgency": SignalUrgency.MEDIUM,
        "category": SignalCategory.TIMING,
        "decay_days": 90,
        "description": "Expansion indicates budget and new requirements"
    },
    SignalType.FUNDING_ROUND: {
        "base_score": 30,
        "urgency": SignalUrgency.HIGH,
        "category": SignalCategory.BUDGET,
        "decay_days": 120,
        "description": "Fresh capital for investments"
    },
    SignalType.PLATFORM_MIGRATION: {
        "base_score": 35,
        "urgency": SignalUrgency.HIGH,
        "category": SignalCategory.TIMING,
        "decay_days": 60,
        "description": "Platform change creates natural evaluation window"
    },
    SignalType.DIGITAL_INITIATIVE: {
        "base_score": 20,
        "urgency": SignalUrgency.MEDIUM,
        "category": SignalCategory.TIMING,
        "decay_days": 90,
        "description": "Digital transformation indicates search priority"
    },
    SignalType.REVENUE_GROWTH: {
        "base_score": 15,
        "urgency": SignalUrgency.LOW,
        "category": SignalCategory.BUDGET,
        "decay_days": 120,
        "description": "Growing revenue suggests budget availability"
    },
    SignalType.LAYOFFS: {
        "base_score": -25,
        "urgency": SignalUrgency.LOW,
        "category": SignalCategory.NEGATIVE,
        "decay_days": 90,
        "description": "Layoffs may indicate budget constraints"
    },
}


# =============================================================================
# Data Models
# =============================================================================


class Signal(BaseModel):
    """Individual signal with scoring and source citation."""

    type: SignalType = Field(..., description="Type of signal detected")
    description: str = Field(..., description="Human-readable description of the signal")
    score: int = Field(..., description="Signal score (can be negative)")
    urgency: SignalUrgency = Field(..., description="Urgency level of the signal")
    category: SignalCategory = Field(..., description="Signal category")
    evidence: Optional[str] = Field(None, description="Supporting evidence for the signal")
    detected_at: datetime = Field(..., description="When the signal was detected")
    decay_factor: float = Field(1.0, description="Decay multiplier based on age (0-1)")
    effective_score: float = Field(..., description="Score after decay adjustment")

    # SOURCE CITATION MANDATE
    source_url: str = Field(..., description="URL where signal was detected")
    source_date: datetime = Field(..., description="Date of source document")


class SignalCategorySummary(BaseModel):
    """Summary of signals within a category."""

    category: SignalCategory
    signals: List[Signal] = Field(default_factory=list)
    total_score: float = Field(0, description="Sum of effective scores in category")
    signal_count: int = Field(0, description="Number of signals in category")
    has_signals: bool = Field(False, description="Whether category has any signals")


class RecommendedTiming(BaseModel):
    """Recommended engagement timing."""

    window_start: datetime = Field(..., description="Recommended start of engagement window")
    window_end: datetime = Field(..., description="Recommended end of engagement window")
    window_days: int = Field(..., description="Length of engagement window in days")
    urgency_reason: str = Field(..., description="Primary reason for urgency")
    recommended_action: str = Field(..., description="Recommended next action")
    best_approach: str = Field(..., description="Suggested approach for outreach")


class SignalScoringData(BaseModel):
    """
    Signal Scoring data model - output of M14 module.

    Comprehensive signal scoring with urgency ranking and engagement recommendations.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain")

    # All detected signals
    signals: List[Signal] = Field(
        default_factory=list,
        description="All detected signals with source citations"
    )

    # Top signals by effective score
    top_signals: List[Signal] = Field(
        default_factory=list,
        description="Top 5 signals by effective score"
    )

    # Category summaries
    budget_signals: SignalCategorySummary = Field(
        default_factory=lambda: SignalCategorySummary(category=SignalCategory.BUDGET),
        description="Budget-related signals"
    )
    pain_signals: SignalCategorySummary = Field(
        default_factory=lambda: SignalCategorySummary(category=SignalCategory.PAIN),
        description="Pain-related signals"
    )
    timing_signals: SignalCategorySummary = Field(
        default_factory=lambda: SignalCategorySummary(category=SignalCategory.TIMING),
        description="Timing-related signals"
    )
    negative_signals: SignalCategorySummary = Field(
        default_factory=lambda: SignalCategorySummary(category=SignalCategory.NEGATIVE),
        description="Negative/warning signals"
    )

    # Composite scores
    urgency_score: int = Field(
        0,
        ge=0,
        le=100,
        description="Composite urgency score (0-100)"
    )
    composite_score: float = Field(
        0,
        description="Weighted composite of all signal categories"
    )

    # Engagement window
    engagement_window_days: int = Field(
        90,
        description="Recommended engagement window in days"
    )
    recommended_timing: Optional[RecommendedTiming] = Field(
        None,
        description="Detailed timing recommendation"
    )

    # Summary fields
    signal_count: int = Field(0, description="Total number of signals detected")
    positive_signal_count: int = Field(0, description="Count of positive signals")
    negative_signal_count: int = Field(0, description="Count of negative signals")
    has_critical_signal: bool = Field(False, description="Whether any critical signal exists")
    has_budget_signal: bool = Field(False, description="Whether any budget signal exists")
    has_pain_signal: bool = Field(False, description="Whether any pain signal exists")
    has_timing_signal: bool = Field(False, description="Whether any timing signal exists")


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M14SignalScoringModule(BaseIntelligenceModule):
    """
    M14: Signal Scoring - score and prioritize all detected signals.

    Wave 4 (Synthesis) module that aggregates signals from all previous modules
    and calculates composite urgency scores with engagement recommendations.
    """

    MODULE_ID = "m14_signal_scoring"
    MODULE_NAME = "Signal Scoring"
    WAVE = 4
    DEPENDS_ON = [
        "m01_company_context",
        "m02_tech_stack",
        "m03_traffic",
        "m04_financials",
        "m05_competitors",
        "m06_hiring",
        "m07_strategic",
        "m08_investor",
        "m09_executive",
        "m10_buying_committee",
        "m11_displacement",
        "m12_case_study",
        "m13_icp_priority",
    ]
    SOURCE_TYPE = "synthesis"
    CACHE_TTL = 86400  # 24 hours

    async def enrich(
        self,
        domain: str,
        force: bool = False,
        dependency_data: Optional[Dict[str, Any]] = None
    ) -> ModuleResult:
        """
        Perform signal scoring for a domain.

        Args:
            domain: The domain to score (e.g., "sallybeauty.com")
            force: If True, bypass cache and recalculate
            dependency_data: Optional pre-fetched data from dependent modules

        Returns:
            ModuleResult with SignalScoringData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Scoring signals for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached signal scoring for: {domain}")
                return cached

        # Fetch raw data
        raw_data = await self.fetch_data(domain, dependency_data)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        scoring_data = await self._validate_and_score(domain, transformed)

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
            data=scoring_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully scored signals for: {domain}")
        return result

    async def fetch_data(
        self,
        domain: str,
        dependency_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Fetch and aggregate signals from all dependent modules.

        Args:
            domain: The domain to fetch signals for
            dependency_data: Optional pre-fetched dependency data

        Returns:
            dict with aggregated signals and source information
        """
        signals = []
        source_urls = []
        errors = []
        now = datetime.now()

        # If dependency data provided, extract signals from it
        if dependency_data:
            signals, source_urls = await self._extract_signals_from_dependencies(
                dependency_data
            )
        else:
            # Fetch from each dependent module (mock for now)
            signals = await self._fetch_mock_signals(domain)

        if not signals:
            self.logger.warning(f"No signals detected for {domain}")

        # Determine primary source URL
        primary_source_url = f"https://partnerforge.app/signals/{domain}"
        if source_urls:
            primary_source_url = source_urls[0]

        return {
            "domain": domain,
            "signals": signals,
            "source_urls": source_urls,
            "source_url": primary_source_url,
            "source_date": now.isoformat(),
            "errors": errors,
        }

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw signal data into SignalScoringData schema.

        Calculates decay factors, effective scores, and category summaries.

        Args:
            raw_data: Raw aggregated signal data

        Returns:
            Transformed data matching SignalScoringData fields
        """
        now = datetime.now()
        signals = raw_data.get("signals", [])

        # Process each signal
        processed_signals = []
        for signal_data in signals:
            signal = await self._process_signal(signal_data, now)
            if signal:
                processed_signals.append(signal)

        # Sort by effective score descending
        processed_signals.sort(key=lambda s: s.effective_score, reverse=True)

        # Get top 5 signals
        top_signals = processed_signals[:5]

        # Categorize signals
        budget_signals = [s for s in processed_signals if s.category == SignalCategory.BUDGET]
        pain_signals = [s for s in processed_signals if s.category == SignalCategory.PAIN]
        timing_signals = [s for s in processed_signals if s.category == SignalCategory.TIMING]
        negative_signals = [s for s in processed_signals if s.category == SignalCategory.NEGATIVE]

        # Calculate category summaries
        budget_summary = self._create_category_summary(SignalCategory.BUDGET, budget_signals)
        pain_summary = self._create_category_summary(SignalCategory.PAIN, pain_signals)
        timing_summary = self._create_category_summary(SignalCategory.TIMING, timing_signals)
        negative_summary = self._create_category_summary(SignalCategory.NEGATIVE, negative_signals)

        # Calculate composite scores
        urgency_score = self._calculate_urgency_score(
            budget_summary, pain_summary, timing_summary, negative_summary
        )
        composite_score = self._calculate_composite_score(
            budget_summary, pain_summary, timing_summary, negative_summary
        )

        # Determine engagement window
        engagement_window = self._calculate_engagement_window(processed_signals)

        # Generate timing recommendation
        recommended_timing = self._generate_timing_recommendation(
            processed_signals, urgency_score
        )

        # Count signals
        positive_count = len([s for s in processed_signals if s.score > 0])
        negative_count = len([s for s in processed_signals if s.score < 0])
        has_critical = any(s.urgency == SignalUrgency.CRITICAL for s in processed_signals)

        return {
            "domain": raw_data.get("domain"),
            "signals": [s.model_dump() for s in processed_signals],
            "top_signals": [s.model_dump() for s in top_signals],
            "budget_signals": budget_summary.model_dump(),
            "pain_signals": pain_summary.model_dump(),
            "timing_signals": timing_summary.model_dump(),
            "negative_signals": negative_summary.model_dump(),
            "urgency_score": urgency_score,
            "composite_score": composite_score,
            "engagement_window_days": engagement_window,
            "recommended_timing": recommended_timing.model_dump() if recommended_timing else None,
            "signal_count": len(processed_signals),
            "positive_signal_count": positive_count,
            "negative_signal_count": negative_count,
            "has_critical_signal": has_critical,
            "has_budget_signal": budget_summary.has_signals,
            "has_pain_signal": pain_summary.has_signals,
            "has_timing_signal": timing_summary.has_signals,
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_mock_signals(self, domain: str) -> List[Dict[str, Any]]:
        """
        Fetch mock signals for testing.

        In production, this would aggregate from real module outputs.
        """
        now = datetime.now()

        return [
            {
                "type": SignalType.EXECUTIVE_CHANGE.value,
                "description": "New CIO appointed in October 2025",
                "evidence": "Scott Lindblom joined as SVP & CIO",
                "detected_at": (now - timedelta(days=30)).isoformat(),
                "source_url": f"https://www.linkedin.com/company/{domain.split('.')[0]}/",
                "source_date": (now - timedelta(days=30)).isoformat(),
            },
            {
                "type": SignalType.PLATFORM_MIGRATION.value,
                "description": "E-commerce platform upgrade announced",
                "evidence": "Spring 2026 platform update with AI features",
                "detected_at": (now - timedelta(days=15)).isoformat(),
                "source_url": f"https://businesswire.com/{domain}/news",
                "source_date": (now - timedelta(days=15)).isoformat(),
            },
            {
                "type": SignalType.DIGITAL_INITIATIVE.value,
                "description": "CEO announced digital transformation focus",
                "evidence": "Q1 2026 earnings call mentioned 'more efficient search'",
                "detected_at": (now - timedelta(days=10)).isoformat(),
                "source_url": f"https://seekingalpha.com/article/{domain.split('.')[0]}-earnings",
                "source_date": (now - timedelta(days=10)).isoformat(),
            },
            {
                "type": SignalType.HIRING_SPIKE.value,
                "description": "Active hiring for search-related roles",
                "evidence": "3 open positions mentioning search",
                "detected_at": (now - timedelta(days=5)).isoformat(),
                "source_url": f"https://www.{domain}/careers/",
                "source_date": (now - timedelta(days=5)).isoformat(),
            },
        ]

    async def _extract_signals_from_dependencies(
        self,
        dependency_data: Dict[str, Any]
    ) -> tuple[List[Dict[str, Any]], List[str]]:
        """
        Extract signals from dependency module outputs.

        Args:
            dependency_data: Dict of module_id -> ModuleResult

        Returns:
            Tuple of (signals list, source URLs list)
        """
        signals = []
        source_urls = []
        now = datetime.now()

        # Extract from M06 (Hiring Signals)
        if "m06_hiring" in dependency_data:
            hiring_data = dependency_data["m06_hiring"]
            if hiring_data.get("search_roles_count", 0) >= 3:
                signals.append({
                    "type": SignalType.HIRING_SPIKE.value,
                    "description": f"Hiring spike: {hiring_data.get('search_roles_count')} search-related roles",
                    "evidence": ", ".join(hiring_data.get("open_positions", [])[:3]),
                    "detected_at": now.isoformat(),
                    "source_url": hiring_data.get("source_url", ""),
                    "source_date": hiring_data.get("source_date", now.isoformat()),
                })
                source_urls.append(hiring_data.get("source_url", ""))

        # Extract from M09 (Executive Intelligence)
        if "m09_executive" in dependency_data:
            exec_data = dependency_data["m09_executive"]
            for change in exec_data.get("recent_changes", []):
                if change.get("is_recent"):
                    signals.append({
                        "type": SignalType.EXECUTIVE_CHANGE.value,
                        "description": f"New {change.get('title')}: {change.get('name')}",
                        "evidence": change.get("context", ""),
                        "detected_at": change.get("date", now.isoformat()),
                        "source_url": change.get("source_url", ""),
                        "source_date": change.get("source_date", now.isoformat()),
                    })
                    source_urls.append(change.get("source_url", ""))

        # Extract from M02 (Tech Stack)
        if "m02_tech_stack" in dependency_data:
            tech_data = dependency_data["m02_tech_stack"]
            for removal in tech_data.get("removed_technologies", []):
                if removal.get("category") == "search":
                    signals.append({
                        "type": SignalType.TECH_REMOVAL.value,
                        "description": f"Search technology removed: {removal.get('name')}",
                        "evidence": f"Last detected: {removal.get('last_detected')}",
                        "detected_at": removal.get("removal_date", now.isoformat()),
                        "source_url": removal.get("source_url", ""),
                        "source_date": removal.get("source_date", now.isoformat()),
                    })
                    source_urls.append(removal.get("source_url", ""))

        # Extract from M07 (Strategic Context)
        if "m07_strategic" in dependency_data:
            strategic_data = dependency_data["m07_strategic"]
            for initiative in strategic_data.get("digital_initiatives", []):
                signals.append({
                    "type": SignalType.DIGITAL_INITIATIVE.value,
                    "description": initiative.get("name", "Digital initiative announced"),
                    "evidence": initiative.get("details", ""),
                    "detected_at": initiative.get("announced_date", now.isoformat()),
                    "source_url": initiative.get("source_url", ""),
                    "source_date": initiative.get("source_date", now.isoformat()),
                })
                source_urls.append(initiative.get("source_url", ""))

        return signals, source_urls

    async def _process_signal(
        self,
        signal_data: Dict[str, Any],
        now: datetime
    ) -> Optional[Signal]:
        """
        Process a raw signal into a scored Signal object.

        Applies decay factor based on signal age.

        Args:
            signal_data: Raw signal dictionary
            now: Current datetime for decay calculation

        Returns:
            Processed Signal object or None if invalid
        """
        try:
            signal_type = SignalType(signal_data.get("type"))
            config = SIGNAL_CONFIG.get(signal_type, {})

            # Parse dates
            detected_at_str = signal_data.get("detected_at")
            if isinstance(detected_at_str, str):
                detected_at = datetime.fromisoformat(detected_at_str.replace("Z", "+00:00"))
            else:
                detected_at = detected_at_str or now

            source_date_str = signal_data.get("source_date")
            if isinstance(source_date_str, str):
                source_date = datetime.fromisoformat(source_date_str.replace("Z", "+00:00"))
            else:
                source_date = source_date_str or now

            # Calculate decay factor
            decay_days = config.get("decay_days", 90)
            age_days = (now - detected_at).days
            decay_factor = max(0, 1 - (age_days / decay_days)) if decay_days > 0 else 1.0

            # Calculate effective score
            base_score = config.get("base_score", 10)
            effective_score = base_score * decay_factor

            return Signal(
                type=signal_type,
                description=signal_data.get("description", config.get("description", "")),
                score=base_score,
                urgency=config.get("urgency", SignalUrgency.MEDIUM),
                category=config.get("category", SignalCategory.TIMING),
                evidence=signal_data.get("evidence"),
                detected_at=detected_at,
                decay_factor=round(decay_factor, 3),
                effective_score=round(effective_score, 2),
                source_url=signal_data.get("source_url", ""),
                source_date=source_date,
            )
        except Exception as e:
            self.logger.warning(f"Failed to process signal: {e}")
            return None

    def _create_category_summary(
        self,
        category: SignalCategory,
        signals: List[Signal]
    ) -> SignalCategorySummary:
        """Create a summary for a signal category."""
        total_score = sum(s.effective_score for s in signals)
        return SignalCategorySummary(
            category=category,
            signals=signals,
            total_score=round(total_score, 2),
            signal_count=len(signals),
            has_signals=len(signals) > 0,
        )

    def _calculate_urgency_score(
        self,
        budget: SignalCategorySummary,
        pain: SignalCategorySummary,
        timing: SignalCategorySummary,
        negative: SignalCategorySummary,
    ) -> int:
        """
        Calculate composite urgency score (0-100).

        Weights:
        - Pain signals: 40%
        - Timing signals: 30%
        - Budget signals: 30%
        - Negative signals: Reduce overall score
        """
        # Normalize scores (cap at 100 per category)
        pain_norm = min(pain.total_score, 100)
        timing_norm = min(timing.total_score, 100)
        budget_norm = min(budget.total_score, 100)
        negative_penalty = min(abs(negative.total_score), 30)  # Cap penalty

        # Weighted calculation
        raw_score = (
            pain_norm * 0.40 +
            timing_norm * 0.30 +
            budget_norm * 0.30
        )

        # Apply negative penalty
        final_score = max(0, raw_score - negative_penalty)

        return min(100, int(final_score))

    def _calculate_composite_score(
        self,
        budget: SignalCategorySummary,
        pain: SignalCategorySummary,
        timing: SignalCategorySummary,
        negative: SignalCategorySummary,
    ) -> float:
        """Calculate raw composite score without normalization."""
        return round(
            budget.total_score +
            pain.total_score +
            timing.total_score +
            negative.total_score,
            2
        )

    def _calculate_engagement_window(self, signals: List[Signal]) -> int:
        """
        Calculate recommended engagement window in days.

        Based on the soonest-decaying high-value signal.
        """
        if not signals:
            return 90  # Default 90-day window

        # Find critical/high urgency signals
        urgent_signals = [
            s for s in signals
            if s.urgency in [SignalUrgency.CRITICAL, SignalUrgency.HIGH]
            and s.effective_score > 0
        ]

        if not urgent_signals:
            return 90

        # Find minimum decay window
        min_window = 90
        now = datetime.now()

        for signal in urgent_signals:
            config = SIGNAL_CONFIG.get(signal.type, {})
            decay_days = config.get("decay_days", 90)
            age_days = (now - signal.detected_at).days
            remaining_days = max(14, decay_days - age_days)  # Minimum 14 days
            min_window = min(min_window, remaining_days)

        return min_window

    def _generate_timing_recommendation(
        self,
        signals: List[Signal],
        urgency_score: int
    ) -> Optional[RecommendedTiming]:
        """Generate detailed timing recommendation."""
        if not signals:
            return None

        now = datetime.now()
        engagement_window = self._calculate_engagement_window(signals)

        # Determine urgency reason from top signal
        top_signal = signals[0] if signals else None
        urgency_reason = "General opportunity window"
        if top_signal:
            urgency_reason = top_signal.description

        # Determine recommended action
        if urgency_score >= 80:
            action = "Immediate outreach - schedule discovery call this week"
            approach = "Lead with their specific pain point and timing signal"
        elif urgency_score >= 60:
            action = "High priority - initiate contact within 2 weeks"
            approach = "Reference their recent changes and digital initiatives"
        elif urgency_score >= 40:
            action = "Active pursuit - add to outreach sequence"
            approach = "Build relationship through valuable content sharing"
        else:
            action = "Monitor and nurture - add to long-term pipeline"
            approach = "Stay informed on company developments"

        return RecommendedTiming(
            window_start=now,
            window_end=now + timedelta(days=engagement_window),
            window_days=engagement_window,
            urgency_reason=urgency_reason,
            recommended_action=action,
            best_approach=approach,
        )

    async def _validate_and_score(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> SignalScoringData:
        """
        Validate transformed data and create SignalScoringData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated SignalScoringData model
        """
        # Reconstruct Signal objects from dicts
        signals = [
            Signal(**s) for s in transformed_data.get("signals", [])
        ]
        top_signals = [
            Signal(**s) for s in transformed_data.get("top_signals", [])
        ]

        # Reconstruct category summaries
        budget_data = transformed_data.get("budget_signals", {})
        pain_data = transformed_data.get("pain_signals", {})
        timing_data = transformed_data.get("timing_signals", {})
        negative_data = transformed_data.get("negative_signals", {})

        budget_signals = SignalCategorySummary(
            category=SignalCategory.BUDGET,
            signals=[Signal(**s) for s in budget_data.get("signals", [])],
            total_score=budget_data.get("total_score", 0),
            signal_count=budget_data.get("signal_count", 0),
            has_signals=budget_data.get("has_signals", False),
        )

        pain_signals = SignalCategorySummary(
            category=SignalCategory.PAIN,
            signals=[Signal(**s) for s in pain_data.get("signals", [])],
            total_score=pain_data.get("total_score", 0),
            signal_count=pain_data.get("signal_count", 0),
            has_signals=pain_data.get("has_signals", False),
        )

        timing_signals = SignalCategorySummary(
            category=SignalCategory.TIMING,
            signals=[Signal(**s) for s in timing_data.get("signals", [])],
            total_score=timing_data.get("total_score", 0),
            signal_count=timing_data.get("signal_count", 0),
            has_signals=timing_data.get("has_signals", False),
        )

        negative_signals_summary = SignalCategorySummary(
            category=SignalCategory.NEGATIVE,
            signals=[Signal(**s) for s in negative_data.get("signals", [])],
            total_score=negative_data.get("total_score", 0),
            signal_count=negative_data.get("signal_count", 0),
            has_signals=negative_data.get("has_signals", False),
        )

        # Reconstruct timing recommendation
        timing_rec_data = transformed_data.get("recommended_timing")
        recommended_timing = None
        if timing_rec_data:
            # Parse datetime strings if needed
            window_start = timing_rec_data.get("window_start")
            window_end = timing_rec_data.get("window_end")

            if isinstance(window_start, str):
                window_start = datetime.fromisoformat(window_start.replace("Z", "+00:00"))
            if isinstance(window_end, str):
                window_end = datetime.fromisoformat(window_end.replace("Z", "+00:00"))

            recommended_timing = RecommendedTiming(
                window_start=window_start,
                window_end=window_end,
                window_days=timing_rec_data.get("window_days", 90),
                urgency_reason=timing_rec_data.get("urgency_reason", ""),
                recommended_action=timing_rec_data.get("recommended_action", ""),
                best_approach=timing_rec_data.get("best_approach", ""),
            )

        return SignalScoringData(
            domain=domain,
            signals=signals,
            top_signals=top_signals,
            budget_signals=budget_signals,
            pain_signals=pain_signals,
            timing_signals=timing_signals,
            negative_signals=negative_signals_summary,
            urgency_score=transformed_data.get("urgency_score", 0),
            composite_score=transformed_data.get("composite_score", 0),
            engagement_window_days=transformed_data.get("engagement_window_days", 90),
            recommended_timing=recommended_timing,
            signal_count=transformed_data.get("signal_count", 0),
            positive_signal_count=transformed_data.get("positive_signal_count", 0),
            negative_signal_count=transformed_data.get("negative_signal_count", 0),
            has_critical_signal=transformed_data.get("has_critical_signal", False),
            has_budget_signal=transformed_data.get("has_budget_signal", False),
            has_pain_signal=transformed_data.get("has_pain_signal", False),
            has_timing_signal=transformed_data.get("has_timing_signal", False),
        )
