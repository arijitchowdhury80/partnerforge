"""
M07 Strategic Context Intelligence Module

Identifies strategic triggers and initiatives that signal buying intent.
This is a Wave 2 module with no strict dependencies.

Data Sources:
- WebSearch (primary - news, press releases, strategic announcements)

Output: Digital transformation initiatives, expansion signals, recent news,
trigger events with type, description, date, and Algolia relevance scoring.

Trigger Types:
- executive_change: C-level or VP-level leadership changes
- acquisition: M&A activity, strategic partnerships
- new_market: Geographic or vertical expansion
- digital_initiative: Digital transformation, e-commerce investments
- competitor_win: Competitor wins deal or launches competing feature
- tech_refresh: Platform migration, replatforming announcements

SOURCE CITATION MANDATE: Every data point MUST have source_url and source_date.
"""

import logging
import re
from datetime import datetime, timedelta
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


class TriggerEvent(BaseModel):
    """
    Strategic trigger event that signals potential buying intent.

    Trigger events are key indicators that a company may be in-market
    for a search/discovery solution.
    """

    type: str = Field(
        ...,
        description="Trigger type: executive_change, acquisition, new_market, digital_initiative, competitor_win, tech_refresh"
    )
    title: str = Field(..., description="Event title/headline")
    description: str = Field(..., description="Detailed description of the event")
    date: str = Field(..., description="Date of the event (ISO format)")
    source_url: str = Field(..., description="URL of the source")
    algolia_relevance: str = Field(
        ...,
        description="How this trigger relates to Algolia: high, medium, low"
    )
    algolia_relevance_reason: Optional[str] = Field(
        None,
        description="Explanation of why this is relevant to Algolia"
    )


class ExpansionSignal(BaseModel):
    """Signal indicating company expansion activity."""

    type: str = Field(
        ...,
        description="Expansion type: new_market, acquisition, partnership, product_launch"
    )
    title: str = Field(..., description="Expansion headline")
    description: str = Field(..., description="Details of the expansion")
    date: str = Field(..., description="Date announced (ISO format)")
    source_url: str = Field(..., description="Source URL")
    regions: List[str] = Field(
        default_factory=list,
        description="Geographic regions involved"
    )


class DigitalInitiative(BaseModel):
    """Digital transformation initiative."""

    name: str = Field(..., description="Initiative name")
    description: str = Field(..., description="Initiative description")
    announced_date: str = Field(..., description="Date announced (ISO format)")
    source_url: str = Field(..., description="Source URL")
    investment_amount: Optional[float] = Field(
        None,
        description="Investment amount if disclosed (USD)"
    )
    technologies_mentioned: List[str] = Field(
        default_factory=list,
        description="Technologies mentioned in the initiative"
    )
    search_relevance: Optional[str] = Field(
        None,
        description="Relevance to search/discovery: high, medium, low, none"
    )


class NewsItem(BaseModel):
    """Recent news item about the company."""

    title: str = Field(..., description="News headline")
    date: str = Field(..., description="Publication date (ISO format)")
    url: str = Field(..., description="Article URL")
    summary: Optional[str] = Field(None, description="Brief summary")
    category: Optional[str] = Field(
        None,
        description="Category: financial, strategic, product, leadership, other"
    )


class StrategicContextData(BaseModel):
    """
    Strategic Context data model - output of M07 module.

    Captures strategic triggers, initiatives, and signals that indicate
    potential buying intent for Algolia solutions.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain")

    # Digital transformation
    digital_transformation_initiatives: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Active digital transformation initiatives"
    )

    # Expansion signals
    expansion_signals: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Expansion activity (new markets, acquisitions)"
    )

    # Recent news
    recent_news: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Recent company news items"
    )

    # Trigger events (most important for sales)
    trigger_events: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Strategic trigger events with Algolia relevance"
    )

    # Scoring
    urgency_score: float = Field(
        0.0,
        ge=0.0,
        le=100.0,
        description="Urgency score based on trigger recency and type (0-100)"
    )

    # Strategic summary
    strategic_summary: Optional[str] = Field(
        None,
        description="AI-generated summary of strategic posture"
    )

    # Key dates
    last_major_announcement: Optional[str] = Field(
        None,
        description="Date of most recent major strategic announcement"
    )

    # Competitor context
    competitor_mentions: List[str] = Field(
        default_factory=list,
        description="Competitors mentioned in strategic context"
    )


# =============================================================================
# Trigger Scoring Configuration
# =============================================================================

# Trigger type weights for urgency scoring
TRIGGER_WEIGHTS = {
    "executive_change": 25,      # High priority - new leadership often brings change
    "digital_initiative": 30,    # Highest - direct signal for search investment
    "tech_refresh": 28,          # Very high - platform change = opportunity
    "acquisition": 20,           # Medium-high - integration needs
    "new_market": 18,            # Medium - localization/scaling needs
    "competitor_win": 15,        # Medium - competitive pressure
}

# Recency weights (days since event)
RECENCY_WEIGHTS = {
    7: 1.0,      # Within 1 week - full weight
    30: 0.8,     # Within 1 month - 80%
    90: 0.6,     # Within 3 months - 60%
    180: 0.4,    # Within 6 months - 40%
    365: 0.2,    # Within 1 year - 20%
}

# Algolia relevance multipliers
RELEVANCE_MULTIPLIERS = {
    "high": 1.0,
    "medium": 0.7,
    "low": 0.4,
}


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M07StrategicContextModule(BaseIntelligenceModule):
    """
    M07: Strategic Context - strategic triggers and initiatives.

    Wave 2 module with no strict dependencies.
    Collects strategic intelligence from news and press releases.
    """

    MODULE_ID = "m07_strategic"
    MODULE_NAME = "Strategic Context"
    WAVE = 2
    DEPENDS_ON = []  # No strict dependencies
    SOURCE_TYPE = "webpage"
    CACHE_TTL = 259200  # 3 days (strategic news changes frequently)

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with StrategicContextData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching strategic context for: {domain}")

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
        Fetch raw data from WebSearch.

        Searches for:
        - Company news and press releases
        - Digital transformation announcements
        - Expansion/acquisition news
        - Executive changes
        - Technology refresh announcements

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged data from all searches
        """
        company_name = self._infer_company_name(domain)

        # Collect data from multiple WebSearch queries
        news_data = {}
        trigger_data = {}
        strategic_data = {}
        errors = []

        # Search for recent news
        try:
            news_data = await self._search_company_news(domain, company_name)
            self.logger.debug(f"News search returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"News search failed for {domain}: {e}")
            errors.append(f"News search: {e}")

        # Search for trigger events
        try:
            trigger_data = await self._search_trigger_events(domain, company_name)
            self.logger.debug(f"Trigger search returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"Trigger search failed for {domain}: {e}")
            errors.append(f"Trigger search: {e}")

        # Search for strategic initiatives
        try:
            strategic_data = await self._search_strategic_initiatives(domain, company_name)
            self.logger.debug(f"Strategic search returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"Strategic search failed for {domain}: {e}")
            errors.append(f"Strategic search: {e}")

        # If all sources failed, raise error
        if not news_data and not trigger_data and not strategic_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        # Merge data from all sources
        merged = await self._merge_sources(news_data, trigger_data, strategic_data)

        return merged

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw search data into StrategicContextData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching StrategicContextData fields
        """
        # Extract and structure trigger events
        trigger_events = raw_data.get("trigger_events", [])

        # Calculate urgency score based on triggers
        urgency_score = self._calculate_urgency_score(trigger_events)

        # Extract digital initiatives
        digital_initiatives = raw_data.get("digital_transformation_initiatives", [])

        # Extract expansion signals
        expansion_signals = raw_data.get("expansion_signals", [])

        # Find most recent major announcement
        last_major = self._find_last_major_announcement(
            trigger_events + digital_initiatives + expansion_signals
        )

        # Generate strategic summary
        strategic_summary = self._generate_strategic_summary(
            raw_data, urgency_score
        )

        return {
            "domain": raw_data.get("domain"),
            "digital_transformation_initiatives": digital_initiatives,
            "expansion_signals": expansion_signals,
            "recent_news": raw_data.get("recent_news", []),
            "trigger_events": trigger_events,
            "urgency_score": urgency_score,
            "strategic_summary": strategic_summary,
            "last_major_announcement": last_major,
            "competitor_mentions": raw_data.get("competitor_mentions", []),
            # Preserve source info for result creation
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _search_company_news(
        self, domain: str, company_name: str
    ) -> Dict[str, Any]:
        """
        Search for recent company news.

        Args:
            domain: Company domain
            company_name: Inferred company name

        Returns:
            dict with news items and source citation
        """
        # TODO: Replace with actual WebSearch API call
        return await self._call_websearch_news(domain, company_name)

    async def _call_websearch_news(
        self, domain: str, company_name: str
    ) -> Dict[str, Any]:
        """
        Call WebSearch for company news (mock implementation).

        In production, this will use the WebSearch tool to find
        recent news articles about the company.
        """
        now = datetime.now()

        return {
            "recent_news": [
                {
                    "title": f"{company_name} Announces Digital Strategy Update",
                    "date": now.strftime("%Y-%m-%d"),
                    "url": f"https://businesswire.com/news/{domain.split('.')[0]}/digital-strategy",
                    "summary": f"{company_name} outlines plans for enhanced digital customer experience.",
                    "category": "strategic",
                }
            ],
            "source_url": f"https://news.google.com/search?q={domain}",
            "source_date": now.isoformat(),
        }

    async def _search_trigger_events(
        self, domain: str, company_name: str
    ) -> Dict[str, Any]:
        """
        Search for trigger events (exec changes, acquisitions, etc.).

        Args:
            domain: Company domain
            company_name: Inferred company name

        Returns:
            dict with trigger events and source citation
        """
        # TODO: Replace with actual WebSearch API call
        return await self._call_websearch_triggers(domain, company_name)

    async def _call_websearch_triggers(
        self, domain: str, company_name: str
    ) -> Dict[str, Any]:
        """
        Call WebSearch for trigger events (mock implementation).

        In production, this will search for:
        - Executive changes
        - Acquisitions and partnerships
        - Technology refresh announcements
        """
        now = datetime.now()
        recent_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")

        return {
            "trigger_events": [
                {
                    "type": "digital_initiative",
                    "title": f"{company_name} Invests in E-commerce Platform",
                    "description": f"{company_name} announces major investment in digital commerce capabilities including search and personalization.",
                    "date": recent_date,
                    "source_url": f"https://businesswire.com/news/{domain.split('.')[0]}/ecommerce",
                    "algolia_relevance": "high",
                    "algolia_relevance_reason": "Direct investment in search and discovery capabilities.",
                }
            ],
            "source_url": f"https://news.google.com/search?q={domain}+digital+transformation",
            "source_date": now.isoformat(),
        }

    async def _search_strategic_initiatives(
        self, domain: str, company_name: str
    ) -> Dict[str, Any]:
        """
        Search for strategic initiatives (digital transformation, expansion).

        Args:
            domain: Company domain
            company_name: Inferred company name

        Returns:
            dict with strategic initiatives and source citation
        """
        # TODO: Replace with actual WebSearch API call
        return await self._call_websearch_strategic(domain, company_name)

    async def _call_websearch_strategic(
        self, domain: str, company_name: str
    ) -> Dict[str, Any]:
        """
        Call WebSearch for strategic initiatives (mock implementation).

        In production, this will search for:
        - Digital transformation programs
        - Geographic expansion
        - Technology investments
        """
        now = datetime.now()
        recent_date = (now - timedelta(days=60)).strftime("%Y-%m-%d")

        return {
            "digital_transformation_initiatives": [
                {
                    "name": "Digital Customer Experience Initiative",
                    "description": f"{company_name} is investing in improving digital touchpoints including website search, mobile app, and personalization.",
                    "announced_date": recent_date,
                    "source_url": f"https://www.{domain}/investor-relations/strategy",
                    "investment_amount": None,
                    "technologies_mentioned": ["e-commerce", "personalization", "search"],
                    "search_relevance": "high",
                }
            ],
            "expansion_signals": [
                {
                    "type": "new_market",
                    "title": f"{company_name} Expands International Presence",
                    "description": "Company announces expansion into new markets with localized digital experiences.",
                    "date": recent_date,
                    "source_url": f"https://businesswire.com/news/{domain.split('.')[0]}/expansion",
                    "regions": ["EMEA", "APAC"],
                }
            ],
            "competitor_mentions": [],
            "source_url": f"https://www.{domain}/about/strategy",
            "source_date": now.isoformat(),
        }

    async def _merge_sources(
        self,
        news_data: Dict[str, Any],
        trigger_data: Dict[str, Any],
        strategic_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Merge data from multiple WebSearch queries.

        Args:
            news_data: News search results
            trigger_data: Trigger event search results
            strategic_data: Strategic initiative search results

        Returns:
            Merged data dictionary with source citation
        """
        merged = {}

        # Merge news items
        merged["recent_news"] = news_data.get("recent_news", [])

        # Merge trigger events
        merged["trigger_events"] = trigger_data.get("trigger_events", [])

        # Merge digital initiatives
        merged["digital_transformation_initiatives"] = strategic_data.get(
            "digital_transformation_initiatives", []
        )

        # Merge expansion signals
        merged["expansion_signals"] = strategic_data.get("expansion_signals", [])

        # Merge competitor mentions
        merged["competitor_mentions"] = strategic_data.get("competitor_mentions", [])

        # Use the most recent source for citation
        sources = [
            (news_data.get("source_url"), news_data.get("source_date")),
            (trigger_data.get("source_url"), trigger_data.get("source_date")),
            (strategic_data.get("source_url"), strategic_data.get("source_date")),
        ]

        # Find the most recent valid source
        for url, date in sources:
            if url and date:
                merged["source_url"] = url
                merged["source_date"] = date
                break

        return merged

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> StrategicContextData:
        """
        Validate transformed data and create StrategicContextData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated StrategicContextData model
        """
        return StrategicContextData(
            domain=domain,
            digital_transformation_initiatives=transformed_data.get(
                "digital_transformation_initiatives", []
            ),
            expansion_signals=transformed_data.get("expansion_signals", []),
            recent_news=transformed_data.get("recent_news", []),
            trigger_events=transformed_data.get("trigger_events", []),
            urgency_score=transformed_data.get("urgency_score", 0.0),
            strategic_summary=transformed_data.get("strategic_summary"),
            last_major_announcement=transformed_data.get("last_major_announcement"),
            competitor_mentions=transformed_data.get("competitor_mentions", []),
        )

    def _calculate_urgency_score(self, trigger_events: List[Dict[str, Any]]) -> float:
        """
        Calculate urgency score based on trigger events.

        The urgency score indicates how "hot" a prospect is based on:
        - Type of trigger event (digital_initiative = highest)
        - Recency of the event (more recent = higher)
        - Algolia relevance of the event

        Args:
            trigger_events: List of trigger events

        Returns:
            Urgency score between 0 and 100
        """
        if not trigger_events:
            return 0.0

        total_score = 0.0
        now = datetime.now()

        for event in trigger_events:
            # Get base weight from trigger type
            trigger_type = event.get("type", "other")
            base_weight = TRIGGER_WEIGHTS.get(trigger_type, 10)

            # Calculate recency multiplier
            event_date_str = event.get("date", "")
            recency_multiplier = self._get_recency_multiplier(event_date_str, now)

            # Get relevance multiplier
            relevance = event.get("algolia_relevance", "medium")
            relevance_multiplier = RELEVANCE_MULTIPLIERS.get(relevance, 0.5)

            # Calculate event score
            event_score = base_weight * recency_multiplier * relevance_multiplier
            total_score += event_score

        # Normalize to 0-100 scale (cap at 100)
        # With multiple triggers, score can exceed 100 before capping
        return min(total_score, 100.0)

    def _get_recency_multiplier(self, date_str: str, now: datetime) -> float:
        """
        Get recency multiplier based on event date.

        Args:
            date_str: Event date as ISO string
            now: Current datetime

        Returns:
            Multiplier between 0.2 and 1.0
        """
        if not date_str:
            return 0.2  # Unknown date = assume old

        try:
            event_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            # Handle timezone-aware vs naive comparison
            if event_date.tzinfo is not None:
                event_date = event_date.replace(tzinfo=None)
            days_ago = (now - event_date).days
        except (ValueError, TypeError):
            return 0.2

        # Find appropriate weight based on recency
        for max_days, weight in sorted(RECENCY_WEIGHTS.items()):
            if days_ago <= max_days:
                return weight

        return 0.1  # Older than 1 year

    def _find_last_major_announcement(
        self, events: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Find the date of the most recent major announcement.

        Args:
            events: Combined list of trigger events and initiatives

        Returns:
            ISO date string of most recent event, or None
        """
        if not events:
            return None

        dates = []
        for event in events:
            date_str = event.get("date") or event.get("announced_date")
            if date_str:
                try:
                    # Parse and store the date
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    dates.append(date_str)
                except (ValueError, TypeError):
                    continue

        if not dates:
            return None

        # Return most recent date
        return max(dates)

    def _generate_strategic_summary(
        self, data: Dict[str, Any], urgency_score: float
    ) -> str:
        """
        Generate a brief strategic summary.

        Args:
            data: All collected strategic data
            urgency_score: Calculated urgency score

        Returns:
            Strategic summary string
        """
        triggers = data.get("trigger_events", [])
        initiatives = data.get("digital_transformation_initiatives", [])
        expansions = data.get("expansion_signals", [])

        parts = []

        # Urgency assessment
        if urgency_score >= 70:
            parts.append("HIGH URGENCY: Multiple active buying signals detected.")
        elif urgency_score >= 40:
            parts.append("MODERATE URGENCY: Some strategic activity indicates potential interest.")
        else:
            parts.append("LOW URGENCY: Limited recent strategic signals.")

        # Digital initiatives
        if initiatives:
            search_relevant = [
                i for i in initiatives
                if i.get("search_relevance") in ["high", "medium"]
            ]
            if search_relevant:
                parts.append(
                    f"{len(search_relevant)} digital initiative(s) with search relevance."
                )

        # Trigger events
        high_relevance_triggers = [
            t for t in triggers if t.get("algolia_relevance") == "high"
        ]
        if high_relevance_triggers:
            parts.append(
                f"{len(high_relevance_triggers)} high-relevance trigger event(s) identified."
            )

        # Expansion
        if expansions:
            parts.append(f"Active expansion into {len(expansions)} new area(s).")

        return " ".join(parts)

    def _infer_company_name(self, domain: str) -> str:
        """
        Infer company name from domain.

        Used as fallback when company name is not provided.

        Args:
            domain: Domain like "sallybeauty.com"

        Returns:
            Inferred company name like "Sally Beauty"
        """
        # Remove TLD
        name = domain.split(".")[0]

        # Split camelCase and add spaces
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)

        # Capitalize words
        name = " ".join(word.capitalize() for word in name.split())

        return name
