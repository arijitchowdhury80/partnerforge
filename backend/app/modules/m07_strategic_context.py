"""
M07 Strategic Context Intelligence Module

Captures strategic initiatives, news, and trigger events for timing alignment.
This is a Wave 2 (Competitive) module that depends on Wave 1 modules.

Data Sources:
- WebSearch (news, press releases)
- Company investor relations page
- Industry publications

Dependencies:
- M01 Company Context (for company name)
- M04 Financial Profile (for fiscal year timing)

Output: Strategic initiatives, trigger events, timing assessment, and
caution signals.

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
# Trigger Event Classifications
# =============================================================================

POSITIVE_TRIGGERS = [
    "digital transformation",
    "platform migration",
    "e-commerce expansion",
    "website redesign",
    "app launch",
    "mobile first",
    "customer experience",
    "personalization initiative",
    "AI initiative",
    "technology investment",
    "search improvement",
    "discovery enhancement",
]

NEGATIVE_TRIGGERS = [
    "layoffs",
    "restructuring",
    "cost cutting",
    "hiring freeze",
    "revenue decline",
    "leadership departure",
    "bankruptcy",
    "acquisition announced",
]


# =============================================================================
# Data Models
# =============================================================================

class StrategicInitiative(BaseModel):
    """Strategic initiative being pursued."""
    name: str
    type: str  # Digital Transformation, Cost Optimization, Expansion, etc.
    description: Optional[str] = None
    timeline: Optional[str] = None
    algolia_connection: Optional[str] = None
    source_url: Optional[str] = None


class TriggerEvent(BaseModel):
    """Event that indicates buying window."""
    event: str
    timing: Optional[str] = None
    relevance: str = "MEDIUM"  # HIGH, MEDIUM, LOW
    quote: Optional[str] = None
    source_url: Optional[str] = None


class CautionSignal(BaseModel):
    """Negative signal to be aware of."""
    event: str
    type: str  # Negative, Warning
    description: Optional[str] = None
    implication: Optional[str] = None
    source_url: Optional[str] = None


class TimingAssessment(BaseModel):
    """Overall timing assessment for outreach."""
    overall_timing: str  # EXCELLENT, GOOD, MODERATE, POOR
    decision_window: Optional[str] = None
    urgency_level: str = "MEDIUM"  # HIGH, MEDIUM, LOW
    reasoning: Optional[str] = None


class StrategicContextData(BaseModel):
    """
    Strategic Context data model - output of M07 module.

    Captures strategic initiatives and trigger events for timing alignment.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Strategic initiatives
    strategic_initiatives: List[StrategicInitiative] = Field(
        default_factory=list, description="Active strategic initiatives"
    )
    digital_transformation: bool = Field(
        False, description="Whether digital transformation is underway"
    )
    platform_migration: bool = Field(
        False, description="Whether platform migration is planned"
    )

    # Trigger events
    trigger_events: List[TriggerEvent] = Field(
        default_factory=list, description="Events indicating buying window"
    )
    trigger_score: int = Field(0, description="Trigger event score (0-100)")

    # Recent news and announcements
    recent_announcements: List[Dict[str, Any]] = Field(
        default_factory=list, description="Recent company announcements"
    )
    press_releases: List[Dict[str, Any]] = Field(
        default_factory=list, description="Recent press releases"
    )

    # Leadership changes
    leadership_changes: List[Dict[str, Any]] = Field(
        default_factory=list, description="Recent leadership changes"
    )

    # Caution signals
    caution_signals: List[CautionSignal] = Field(
        default_factory=list, description="Negative signals to note"
    )

    # Market context
    industry_trends: List[str] = Field(
        default_factory=list, description="Relevant industry trends"
    )
    regulatory_factors: List[str] = Field(
        default_factory=list, description="Regulatory considerations"
    )

    # Timing signals
    fiscal_year_end: Optional[str] = Field(None, description="Fiscal year end")
    budget_cycle: Optional[str] = Field(None, description="Budget cycle timing")
    renewal_timing: Optional[str] = Field(
        None, description="Vendor renewal timing if known"
    )

    # Overall timing assessment
    timing_assessment: Optional[TimingAssessment] = Field(
        None, description="Overall timing assessment"
    )


# =============================================================================
# Module Implementation
# =============================================================================

@register_module
class M07StrategicContextModule(BaseIntelligenceModule):
    """
    M07: Strategic Context - strategic initiatives and trigger events.

    Wave 2 (Competitive) module that depends on M01 and M04.
    Captures strategic context for timing alignment.
    """

    MODULE_ID = "m07_strategic_context"
    MODULE_NAME = "Strategic Context"
    WAVE = 2
    DEPENDS_ON = ["m01_company_context", "m04_financial_profile"]
    SOURCE_TYPE = "webpage"
    CACHE_TTL = 259200  # 3 days (news changes frequently)

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
            dependencies: Results from dependent modules (M01, M04)

        Returns:
            ModuleResult with StrategicContextData and source citation
        """
        self.logger.info(f"Enriching strategic context for: {domain}")

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

        # Add dependency data if available
        if dependencies:
            if "m04_financial_profile" in dependencies:
                fin_data = dependencies["m04_financial_profile"].data
                raw_data["fiscal_year_end"] = getattr(fin_data, "fiscal_year_end", None)

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        strategic_data = await self._validate_and_store(domain, transformed)

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
            data=strategic_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched strategic context for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch strategic context from news and web sources.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with strategic data and source citation
        """
        websearch_data = {}
        errors = []

        # Try WebSearch for news and press releases
        try:
            websearch_data = await self._fetch_from_websearch(domain)
            self.logger.debug(f"WebSearch returned strategic data for: {domain}")
        except Exception as e:
            self.logger.warning(f"WebSearch fetch failed for {domain}: {e}")
            errors.append(f"WebSearch: {e}")

        # If WebSearch failed, raise error
        if not websearch_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        return websearch_data

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw strategic data into StrategicContextData schema.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching StrategicContextData fields
        """
        # Extract strategic initiatives
        initiatives_raw = raw_data.get("strategic_initiatives", [])
        initiatives = []
        digital_transformation = False
        platform_migration = False

        for init_raw in initiatives_raw:
            initiative = StrategicInitiative(
                name=init_raw.get("name", ""),
                type=init_raw.get("type", "General"),
                description=init_raw.get("description"),
                timeline=init_raw.get("timeline"),
                algolia_connection=init_raw.get("algolia_connection"),
                source_url=init_raw.get("source_url"),
            )
            initiatives.append(initiative)

            # Check for specific initiative types
            name_lower = initiative.name.lower()
            type_lower = initiative.type.lower()
            if "digital" in name_lower or "digital" in type_lower:
                digital_transformation = True
            if "migration" in name_lower or "platform" in name_lower:
                platform_migration = True

        # Extract trigger events
        triggers_raw = raw_data.get("trigger_events", [])
        triggers = []
        for trigger_raw in triggers_raw:
            trigger = TriggerEvent(
                event=trigger_raw.get("event", ""),
                timing=trigger_raw.get("timing"),
                relevance=trigger_raw.get("relevance", "MEDIUM"),
                quote=trigger_raw.get("quote"),
                source_url=trigger_raw.get("source_url"),
            )
            triggers.append(trigger)

        # Extract caution signals
        cautions_raw = raw_data.get("caution_signals", [])
        cautions = []
        for caution_raw in cautions_raw:
            caution = CautionSignal(
                event=caution_raw.get("event", ""),
                type=caution_raw.get("type", "Warning"),
                description=caution_raw.get("description"),
                implication=caution_raw.get("implication"),
                source_url=caution_raw.get("source_url"),
            )
            cautions.append(caution)

        # Calculate trigger score
        trigger_score = self._calculate_trigger_score(triggers, cautions)

        # Generate timing assessment
        timing_assessment = self._assess_timing(
            triggers, cautions, digital_transformation, platform_migration
        )

        return {
            "domain": raw_data.get("domain"),
            "strategic_initiatives": [i.model_dump() for i in initiatives],
            "digital_transformation": digital_transformation,
            "platform_migration": platform_migration,
            "trigger_events": [t.model_dump() for t in triggers],
            "trigger_score": trigger_score,
            "recent_announcements": raw_data.get("recent_announcements", []),
            "press_releases": raw_data.get("press_releases", []),
            "leadership_changes": raw_data.get("leadership_changes", []),
            "caution_signals": [c.model_dump() for c in cautions],
            "industry_trends": raw_data.get("industry_trends", []),
            "regulatory_factors": raw_data.get("regulatory_factors", []),
            "fiscal_year_end": raw_data.get("fiscal_year_end"),
            "budget_cycle": raw_data.get("budget_cycle"),
            "renewal_timing": raw_data.get("renewal_timing"),
            "timing_assessment": timing_assessment.model_dump() if timing_assessment else None,
            # Preserve source info
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _fetch_from_websearch(self, domain: str) -> Dict[str, Any]:
        """
        Fetch strategic context from WebSearch.

        In production, this uses WebSearch to find news and press releases.
        """
        return await self._call_websearch_api(domain)

    async def _call_websearch_api(self, domain: str) -> Dict[str, Any]:
        """
        Search for strategic context (mock implementation).
        """
        now = datetime.now()
        company_name = domain.split(".")[0].replace("-", " ").title()

        # Mock response with strategic data
        return {
            "domain": domain,
            "strategic_initiatives": [
                {
                    "name": "Digital Transformation Initiative",
                    "type": "Digital Transformation",
                    "description": "Multi-year initiative to modernize digital customer experience",
                    "timeline": "FY2025-FY2027",
                    "algolia_connection": "Search modernization aligns with this initiative",
                    "source_url": f"https://www.{domain}/investor-relations/",
                },
                {
                    "name": "Cost Optimization Program",
                    "type": "Cost Optimization",
                    "description": "Target $100M in cost savings through technology efficiency",
                    "timeline": "FY2026",
                    "algolia_connection": "Search optimization is high-ROI, low-capex",
                    "source_url": f"https://seekingalpha.com/{company_name.lower()}-cost-program",
                },
            ],
            "trigger_events": [
                {
                    "event": "Website Platform Upgrade",
                    "timing": "Q2-Q3 2026",
                    "relevance": "HIGH",
                    "quote": "We are investing in a more efficient search experience",
                    "source_url": f"https://www.businesswire.com/{company_name.lower()}-platform",
                },
                {
                    "event": "Mobile App Relaunch",
                    "timing": "Spring 2026",
                    "relevance": "HIGH",
                    "quote": "Enhanced discovery and personalization capabilities",
                    "source_url": f"https://www.{domain}/newsroom/app-relaunch",
                },
            ],
            "caution_signals": [
                {
                    "event": "Q4 Restructuring",
                    "type": "Warning",
                    "description": "Some headquarters positions eliminated",
                    "implication": "Budget scrutiny - need strong ROI case",
                    "source_url": f"https://www.reuters.com/{company_name.lower()}-restructuring",
                },
            ],
            "recent_announcements": [
                {
                    "title": f"{company_name} Announces Q1 2026 Results",
                    "date": "2026-02-09",
                    "url": f"https://www.businesswire.com/{company_name.lower()}-q1-2026",
                    "summary": "Revenue stable, e-commerce growing double digits",
                },
            ],
            "press_releases": [
                {
                    "title": f"{company_name} Unveils Customer Experience Strategy",
                    "date": "2026-01-15",
                    "url": f"https://www.prnewswire.com/{company_name.lower()}-cx-strategy",
                    "summary": "Focus on personalization and seamless omnichannel experience",
                },
            ],
            "leadership_changes": [
                {
                    "name": "New CIO Appointed",
                    "date": "2025-10-01",
                    "person": "John Smith",
                    "title": "Chief Information Officer",
                    "implication": "New technology leadership may bring new vendor preferences",
                },
            ],
            "industry_trends": [
                "AI-powered search becoming table stakes in retail",
                "Mobile commerce exceeding desktop",
                "Personalization driving conversion improvements",
            ],
            "source_url": f"https://www.google.com/search?q={company_name}+news",
            "source_date": now.isoformat(),
        }

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> StrategicContextData:
        """
        Validate transformed data and create StrategicContextData model.
        """
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert nested dicts back to models
        initiatives = [
            StrategicInitiative(**i)
            for i in transformed_data.get("strategic_initiatives", [])
        ]
        triggers = [
            TriggerEvent(**t)
            for t in transformed_data.get("trigger_events", [])
        ]
        cautions = [
            CautionSignal(**c)
            for c in transformed_data.get("caution_signals", [])
        ]

        timing_assessment = None
        if transformed_data.get("timing_assessment"):
            timing_assessment = TimingAssessment(
                **transformed_data["timing_assessment"]
            )

        return StrategicContextData(
            domain=domain,
            strategic_initiatives=initiatives,
            digital_transformation=transformed_data.get("digital_transformation", False),
            platform_migration=transformed_data.get("platform_migration", False),
            trigger_events=triggers,
            trigger_score=transformed_data.get("trigger_score", 0),
            recent_announcements=transformed_data.get("recent_announcements", []),
            press_releases=transformed_data.get("press_releases", []),
            leadership_changes=transformed_data.get("leadership_changes", []),
            caution_signals=cautions,
            industry_trends=transformed_data.get("industry_trends", []),
            regulatory_factors=transformed_data.get("regulatory_factors", []),
            fiscal_year_end=transformed_data.get("fiscal_year_end"),
            budget_cycle=transformed_data.get("budget_cycle"),
            renewal_timing=transformed_data.get("renewal_timing"),
            timing_assessment=timing_assessment,
        )

    def _calculate_trigger_score(
        self,
        triggers: List[TriggerEvent],
        cautions: List[CautionSignal]
    ) -> int:
        """
        Calculate trigger event score (0-100).
        """
        score = 0

        # Positive triggers
        for trigger in triggers:
            if trigger.relevance == "HIGH":
                score += 25
            elif trigger.relevance == "MEDIUM":
                score += 15
            else:
                score += 5

        # Negative adjustments for caution signals
        for caution in cautions:
            if caution.type == "Negative":
                score -= 15
            else:
                score -= 5

        return max(0, min(score, 100))

    def _assess_timing(
        self,
        triggers: List[TriggerEvent],
        cautions: List[CautionSignal],
        digital_transformation: bool,
        platform_migration: bool
    ) -> TimingAssessment:
        """
        Assess overall timing for outreach.
        """
        # Count high-relevance triggers
        high_triggers = sum(1 for t in triggers if t.relevance == "HIGH")
        total_triggers = len(triggers)

        # Determine timing
        if high_triggers >= 2 or (digital_transformation and platform_migration):
            overall_timing = "EXCELLENT"
            urgency = "HIGH"
        elif high_triggers >= 1 or digital_transformation or platform_migration:
            overall_timing = "GOOD"
            urgency = "MEDIUM"
        elif total_triggers >= 1:
            overall_timing = "MODERATE"
            urgency = "MEDIUM"
        else:
            overall_timing = "POOR"
            urgency = "LOW"

        # Adjust for cautions
        if len(cautions) >= 2:
            if overall_timing == "EXCELLENT":
                overall_timing = "GOOD"
            elif overall_timing == "GOOD":
                overall_timing = "MODERATE"

        # Generate reasoning
        reasons = []
        if digital_transformation:
            reasons.append("Digital transformation underway")
        if platform_migration:
            reasons.append("Platform migration planned")
        if high_triggers > 0:
            reasons.append(f"{high_triggers} high-priority trigger event(s)")
        if cautions:
            reasons.append(f"{len(cautions)} caution signal(s) to address")

        # Determine decision window
        decision_window = None
        for trigger in triggers:
            if trigger.timing and trigger.relevance == "HIGH":
                decision_window = trigger.timing
                break

        return TimingAssessment(
            overall_timing=overall_timing,
            decision_window=decision_window,
            urgency_level=urgency,
            reasoning=" + ".join(reasons) if reasons else "Limited timing signals detected",
        )
