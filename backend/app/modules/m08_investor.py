"""
M08 Investor Intelligence Module

Mines SEC filings, earnings calls, and investor presentations for strategic insights.
Wave 3 module with no direct dependencies (runs parallel with M09-M11).

Data Sources:
- SEC EDGAR (10-K, 10-Q MD&A sections)
- Earnings call transcripts (Seeking Alpha, Motley Fool)
- Investor presentations
- WebSearch for additional investor communications

Output: SEC filings, earnings transcripts, key quotes, forward guidance,
risk factors, and digital transformation mentions.

SOURCE CITATION MANDATE: Every data point MUST have source_url and source_date.
"""

import logging
import re
from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field, HttpUrl

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


class SECFiling(BaseModel):
    """SEC filing reference with extracted insights."""

    filing_type: str = Field(..., description="Filing type (10-K, 10-Q, 8-K)")
    fiscal_year: Optional[str] = Field(None, description="Fiscal year (e.g., FY2025)")
    fiscal_quarter: Optional[str] = Field(None, description="Fiscal quarter if applicable")
    filing_date: str = Field(..., description="Filing date (YYYY-MM-DD)")
    source_url: str = Field(..., description="Direct link to SEC filing")
    ecommerce_mentioned: bool = Field(default=False, description="E-commerce mentioned in filing")
    ecommerce_share: Optional[float] = Field(None, description="E-commerce as % of revenue")
    digital_initiatives: List[str] = Field(default_factory=list, description="Digital initiatives mentioned")
    search_mentioned: bool = Field(default=False, description="Search/discovery mentioned")
    ai_mentioned: bool = Field(default=False, description="AI/ML mentioned in filing")


class ExecutiveQuote(BaseModel):
    """Quote from an executive with source attribution."""

    speaker: str = Field(..., description="Speaker name")
    title: str = Field(..., description="Speaker title/role")
    quote: str = Field(..., description="The actual quote")
    source_url: str = Field(..., description="URL of the source document/transcript")
    source_date: str = Field(..., description="Date of the quote (YYYY-MM-DD)")
    maps_to_algolia_product: Optional[str] = Field(
        None, description="Algolia product this maps to (e.g., 'NeuralSearch', 'Personalization')"
    )
    priority: str = Field(default="MEDIUM", description="Priority level: HIGH, MEDIUM, LOW")
    context: Optional[str] = Field(None, description="Additional context for the quote")


class EarningsTranscript(BaseModel):
    """Earnings call transcript with extracted quotes."""

    quarter: str = Field(..., description="Quarter (e.g., 'Q1 FY2026')")
    date: str = Field(..., description="Call date (YYYY-MM-DD)")
    source_url: str = Field(..., description="URL to transcript")
    key_quotes: List[ExecutiveQuote] = Field(
        default_factory=list, description="Key quotes extracted from call"
    )
    digital_transformation_mentions: int = Field(
        default=0, description="Count of digital transformation mentions"
    )
    search_discovery_mentions: int = Field(
        default=0, description="Count of search/discovery mentions"
    )
    customer_experience_mentions: int = Field(
        default=0, description="Count of customer experience mentions"
    )


class InvestorPresentation(BaseModel):
    """Investor presentation or investor day material."""

    title: str = Field(..., description="Presentation title")
    date: str = Field(..., description="Presentation date (YYYY-MM-DD)")
    event: Optional[str] = Field(None, description="Event name (e.g., 'Investor Day 2025')")
    source_url: str = Field(..., description="URL to presentation")
    key_themes: List[str] = Field(default_factory=list, description="Key themes discussed")
    digital_priorities: List[str] = Field(
        default_factory=list, description="Digital/tech priorities mentioned"
    )


class ForwardGuidance(BaseModel):
    """Financial guidance from investor communications."""

    fiscal_period: str = Field(..., description="Guidance period (e.g., 'FY2026')")
    revenue_low: Optional[float] = Field(None, description="Revenue guidance low (USD)")
    revenue_high: Optional[float] = Field(None, description="Revenue guidance high (USD)")
    eps_low: Optional[float] = Field(None, description="EPS guidance low")
    eps_high: Optional[float] = Field(None, description="EPS guidance high")
    capex: Optional[float] = Field(None, description="CapEx guidance (USD)")
    free_cash_flow: Optional[float] = Field(None, description="FCF guidance (USD)")
    ecommerce_growth_target: Optional[float] = Field(
        None, description="E-commerce growth target %"
    )
    source_url: str = Field(..., description="Source of guidance")
    source_date: str = Field(..., description="Date of guidance")


class RiskFactor(BaseModel):
    """Risk factor from SEC filings relevant to Algolia value prop."""

    category: str = Field(..., description="Risk category")
    description: str = Field(..., description="Risk description")
    algolia_relevance: str = Field(
        ..., description="How Algolia addresses this risk"
    )
    source_url: str = Field(..., description="Source filing URL")


class DigitalCommitment(BaseModel):
    """Digital initiative commitment from investor communications."""

    initiative: str = Field(..., description="Initiative name")
    timeline: Optional[str] = Field(None, description="Timeline mentioned")
    investment_amount: Optional[float] = Field(None, description="Investment amount if disclosed")
    explicit_search_mention: bool = Field(default=False, description="Search explicitly mentioned")
    ai_personalization_mention: bool = Field(default=False, description="AI/personalization mentioned")
    source_url: str = Field(..., description="Source URL")


class InvestorIntelligenceData(BaseModel):
    """
    Investor Intelligence data model - output of M08 module.

    Captures strategic insights from investor communications.
    """

    # Required fields
    domain: str = Field(..., description="Company domain")
    ticker: Optional[str] = Field(None, description="Stock ticker if public")

    # SEC Filings
    sec_filings: List[SECFiling] = Field(
        default_factory=list, description="Relevant SEC filings"
    )

    # Earnings Transcripts
    earnings_transcripts: List[EarningsTranscript] = Field(
        default_factory=list, description="Recent earnings call transcripts"
    )

    # Investor Presentations
    investor_presentations: List[InvestorPresentation] = Field(
        default_factory=list, description="Investor presentations and materials"
    )

    # Key Quotes (consolidated from all sources)
    key_quotes: List[ExecutiveQuote] = Field(
        default_factory=list, description="Key executive quotes relevant to Algolia"
    )

    # Forward Guidance
    forward_guidance: Optional[ForwardGuidance] = Field(
        None, description="Latest financial guidance"
    )

    # Risk Factors
    risk_factors: List[RiskFactor] = Field(
        default_factory=list, description="Risk factors relevant to search/digital"
    )

    # Digital Commitments
    digital_commitments: List[DigitalCommitment] = Field(
        default_factory=list, description="Digital transformation commitments"
    )

    # Summary metrics
    total_digital_transformation_mentions: int = Field(
        default=0, description="Total mentions across all sources"
    )
    total_search_discovery_mentions: int = Field(
        default=0, description="Total search/discovery mentions"
    )
    total_customer_experience_mentions: int = Field(
        default=0, description="Total CX mentions"
    )

    # Intelligence quality
    has_recent_earnings_call: bool = Field(
        default=False, description="Has earnings call within 90 days"
    )
    has_investor_day: bool = Field(
        default=False, description="Has investor day within 12 months"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M08InvestorModule(BaseIntelligenceModule):
    """
    M08: Investor Intelligence - strategic insights from investor communications.

    Wave 3 module that mines SEC filings, earnings calls, and investor
    presentations for executive quotes and digital priorities.
    """

    MODULE_ID = "m08_investor"
    MODULE_NAME = "Investor Intelligence"
    WAVE = 3
    DEPENDS_ON = []  # No direct dependencies, runs parallel with Wave 3
    SOURCE_TYPE = "transcript"
    CACHE_TTL = 604800  # 7 days

    # Search patterns for digital transformation signals
    DIGITAL_PATTERNS = [
        r"digital\s+transformation",
        r"e-?commerce",
        r"online\s+sales",
        r"digital\s+experience",
        r"customer\s+experience",
        r"omnichannel",
        r"digital\s+first",
    ]

    SEARCH_PATTERNS = [
        r"search\s+engine",
        r"search\s+experience",
        r"product\s+discovery",
        r"site\s+search",
        r"findability",
        r"browse\s+and\s+search",
    ]

    AI_PATTERNS = [
        r"artificial\s+intelligence",
        r"\bAI\b",
        r"machine\s+learning",
        r"personalization",
        r"recommendation",
        r"neural",
    ]

    # Algolia product mappings for quotes
    ALGOLIA_PRODUCT_MAPPINGS = {
        "search": "InstantSearch",
        "discovery": "Dynamic Faceting",
        "personalization": "Personalization",
        "recommendation": "Recommend",
        "ai": "NeuralSearch",
        "neural": "NeuralSearch",
        "relevance": "Query Rules",
        "analytics": "Search Analytics",
        "mobile": "Mobile SDKs",
    }

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with InvestorIntelligenceData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching investor intelligence for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached result for: {domain}")
                return cached

        # Fetch raw data from all investor sources
        raw_data = await self.fetch_data(domain)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        investor_data = await self._validate_and_store(domain, transformed)

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
            data=investor_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched investor intelligence for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch investor intelligence data from multiple sources.

        Attempts:
        1. SEC EDGAR (for public companies)
        2. Earnings transcripts (Seeking Alpha, Motley Fool)
        3. Investor presentations
        4. WebSearch for additional context

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged data from all sources
        """
        sec_data = {}
        earnings_data = {}
        presentation_data = {}
        websearch_data = {}
        errors = []

        # Try to get company ticker first
        ticker = await self._resolve_ticker(domain)

        # Try SEC EDGAR (for public companies)
        if ticker:
            try:
                sec_data = await self._fetch_sec_filings(domain, ticker)
                self.logger.debug(f"SEC EDGAR returned data for: {domain}")
            except Exception as e:
                self.logger.warning(f"SEC fetch failed for {domain}: {e}")
                errors.append(f"SEC: {e}")

            # Try earnings transcripts
            try:
                earnings_data = await self._fetch_earnings_transcripts(domain, ticker)
                self.logger.debug(f"Earnings transcripts returned for: {domain}")
            except Exception as e:
                self.logger.warning(f"Earnings fetch failed for {domain}: {e}")
                errors.append(f"Earnings: {e}")

        # Try investor presentations (WebSearch)
        try:
            presentation_data = await self._fetch_investor_presentations(domain)
            self.logger.debug(f"Investor presentations returned for: {domain}")
        except Exception as e:
            self.logger.warning(f"Presentations fetch failed for {domain}: {e}")
            errors.append(f"Presentations: {e}")

        # WebSearch for additional context
        try:
            websearch_data = await self._fetch_from_websearch(domain)
            self.logger.debug(f"WebSearch returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"WebSearch fetch failed for {domain}: {e}")
            errors.append(f"WebSearch: {e}")

        # If all sources failed, raise error
        if not sec_data and not earnings_data and not presentation_data and not websearch_data:
            raise Exception(
                f"Failed to enrich investor intelligence for {domain}. "
                f"All sources failed: {'; '.join(errors)}"
            )

        # Merge data from all sources
        merged = await self._merge_sources(
            sec_data, earnings_data, presentation_data, websearch_data, ticker
        )

        return merged

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into InvestorIntelligenceData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching InvestorIntelligenceData fields
        """
        # Extract and consolidate key quotes from all sources
        all_quotes = []
        all_quotes.extend(raw_data.get("key_quotes", []))

        # Extract quotes from earnings transcripts
        for transcript in raw_data.get("earnings_transcripts", []):
            all_quotes.extend(transcript.get("key_quotes", []))

        # Calculate summary metrics
        total_digital_mentions = sum(
            t.get("digital_transformation_mentions", 0)
            for t in raw_data.get("earnings_transcripts", [])
        )
        total_search_mentions = sum(
            t.get("search_discovery_mentions", 0)
            for t in raw_data.get("earnings_transcripts", [])
        )
        total_cx_mentions = sum(
            t.get("customer_experience_mentions", 0)
            for t in raw_data.get("earnings_transcripts", [])
        )

        # Check for recent investor activities
        has_recent_earnings = self._has_recent_activity(
            raw_data.get("earnings_transcripts", []), days=90
        )
        has_investor_day = self._has_investor_day(
            raw_data.get("investor_presentations", [])
        )

        return {
            "domain": raw_data.get("domain"),
            "ticker": raw_data.get("ticker"),
            "sec_filings": raw_data.get("sec_filings", []),
            "earnings_transcripts": raw_data.get("earnings_transcripts", []),
            "investor_presentations": raw_data.get("investor_presentations", []),
            "key_quotes": all_quotes,
            "forward_guidance": raw_data.get("forward_guidance"),
            "risk_factors": raw_data.get("risk_factors", []),
            "digital_commitments": raw_data.get("digital_commitments", []),
            "total_digital_transformation_mentions": total_digital_mentions,
            "total_search_discovery_mentions": total_search_mentions,
            "total_customer_experience_mentions": total_cx_mentions,
            "has_recent_earnings_call": has_recent_earnings,
            "has_investor_day": has_investor_day,
            # Preserve source info for result creation
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _resolve_ticker(self, domain: str) -> Optional[str]:
        """
        Resolve stock ticker from domain.

        Uses cached mappings and WebSearch as fallback.
        """
        # Common ticker mappings (would be fetched from DB in production)
        # This is a mock implementation
        ticker_map = {
            "costco.com": "COST",
            "sallybeauty.com": "SBH",
            "walmart.com": "WMT",
            "target.com": "TGT",
            "homedepot.com": "HD",
            "lowes.com": "LOW",
        }

        if domain in ticker_map:
            return ticker_map[domain]

        # In production, would call WebSearch or Yahoo Finance
        return None

    async def _fetch_sec_filings(
        self, domain: str, ticker: str
    ) -> Dict[str, Any]:
        """
        Fetch SEC filings from EDGAR.

        In production, this would call the SEC EDGAR API.
        """
        # Mock implementation - returns realistic structure
        now = datetime.now()

        return {
            "sec_filings": [
                {
                    "filing_type": "10-K",
                    "fiscal_year": "FY2025",
                    "filing_date": "2025-11-13",
                    "source_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type=10-K",
                    "ecommerce_mentioned": True,
                    "ecommerce_share": 0.107,
                    "digital_initiatives": [
                        "E-commerce platform enhancement",
                        "Mobile app redesign",
                    ],
                    "search_mentioned": True,
                    "ai_mentioned": True,
                },
            ],
            "risk_factors": [
                {
                    "category": "Competition",
                    "description": "Competitive factors in e-commerce include the look and feel of digital platforms, ease and security of the checkout process, and the ability to discover products easily.",
                    "algolia_relevance": "Algolia improves product discovery and search experience",
                    "source_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type=10-K",
                },
            ],
            "source_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}",
            "source_date": now.isoformat(),
        }

    async def _fetch_earnings_transcripts(
        self, domain: str, ticker: str
    ) -> Dict[str, Any]:
        """
        Fetch earnings call transcripts.

        In production, this would search Seeking Alpha, Motley Fool, etc.
        """
        now = datetime.now()

        return {
            "earnings_transcripts": [
                {
                    "quarter": "Q1 FY2026",
                    "date": "2026-02-09",
                    "source_url": f"https://seekingalpha.com/symbol/{ticker}/earnings/transcripts",
                    "key_quotes": [
                        {
                            "speaker": "Executive Leader",
                            "title": "President & CEO",
                            "quote": "Notable enhancements include a more efficient search engine for easier product discovery.",
                            "source_url": f"https://seekingalpha.com/symbol/{ticker}/earnings/transcripts",
                            "source_date": now.strftime("%Y-%m-%d"),
                            "maps_to_algolia_product": "InstantSearch, Dynamic Faceting",
                            "priority": "HIGH",
                        },
                    ],
                    "digital_transformation_mentions": 5,
                    "search_discovery_mentions": 3,
                    "customer_experience_mentions": 4,
                },
            ],
            "forward_guidance": {
                "fiscal_period": "FY2026",
                "revenue_low": 3710000000,
                "revenue_high": 3770000000,
                "eps_low": 2.00,
                "eps_high": 2.10,
                "capex": 100000000,
                "source_url": f"https://seekingalpha.com/symbol/{ticker}/earnings/transcripts",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            "source_url": f"https://seekingalpha.com/symbol/{ticker}/earnings/transcripts",
            "source_date": now.isoformat(),
        }

    async def _fetch_investor_presentations(self, domain: str) -> Dict[str, Any]:
        """
        Fetch investor presentations.

        In production, this would search company IR pages.
        """
        now = datetime.now()

        return {
            "investor_presentations": [
                {
                    "title": "Annual Investor Day 2025",
                    "date": "2025-10-15",
                    "event": "Investor Day",
                    "source_url": f"https://{domain}/investor-relations/presentations",
                    "key_themes": [
                        "Digital transformation",
                        "Customer experience",
                        "Omnichannel strategy",
                    ],
                    "digital_priorities": [
                        "Enhanced search and discovery",
                        "Mobile-first design",
                        "AI-powered recommendations",
                    ],
                },
            ],
            "digital_commitments": [
                {
                    "initiative": "E-commerce Platform Upgrade",
                    "timeline": "FY2026",
                    "explicit_search_mention": True,
                    "ai_personalization_mention": True,
                    "source_url": f"https://{domain}/investor-relations/presentations",
                },
            ],
            "source_url": f"https://{domain}/investor-relations",
            "source_date": now.isoformat(),
        }

    async def _fetch_from_websearch(self, domain: str) -> Dict[str, Any]:
        """
        Fetch additional investor context from WebSearch.

        Searches for recent investor news, analyst coverage.
        """
        now = datetime.now()

        # Mock implementation
        return {
            "key_quotes": [
                {
                    "speaker": "Industry Analyst",
                    "title": "Senior Research Analyst",
                    "quote": "The company's digital investments are positioning them well for future growth.",
                    "source_url": f"https://www.google.com/search?q={domain}+investor+news",
                    "source_date": now.strftime("%Y-%m-%d"),
                    "maps_to_algolia_product": None,
                    "priority": "LOW",
                },
            ],
            "source_url": f"https://www.google.com/search?q={domain}+investor+relations",
            "source_date": now.isoformat(),
        }

    async def _merge_sources(
        self,
        sec_data: Dict[str, Any],
        earnings_data: Dict[str, Any],
        presentation_data: Dict[str, Any],
        websearch_data: Dict[str, Any],
        ticker: Optional[str],
    ) -> Dict[str, Any]:
        """
        Merge data from all investor sources.

        Priority:
        1. SEC filings (official)
        2. Earnings transcripts (primary quotes)
        3. Investor presentations
        4. WebSearch (supplementary)

        Args:
            sec_data: Data from SEC EDGAR
            earnings_data: Data from earnings transcripts
            presentation_data: Data from investor presentations
            websearch_data: Data from WebSearch

        Returns:
            Merged data dictionary with source citation
        """
        merged = {"ticker": ticker}

        # Merge SEC filings
        if sec_data:
            merged["sec_filings"] = sec_data.get("sec_filings", [])
            merged["risk_factors"] = sec_data.get("risk_factors", [])

        # Merge earnings data
        if earnings_data:
            merged["earnings_transcripts"] = earnings_data.get("earnings_transcripts", [])
            merged["forward_guidance"] = earnings_data.get("forward_guidance")

        # Merge presentation data
        if presentation_data:
            merged["investor_presentations"] = presentation_data.get(
                "investor_presentations", []
            )
            merged["digital_commitments"] = presentation_data.get(
                "digital_commitments", []
            )

        # Merge key quotes from websearch
        if websearch_data:
            merged["key_quotes"] = websearch_data.get("key_quotes", [])

        # Determine primary source URL (prefer SEC if available)
        if sec_data and sec_data.get("source_url"):
            merged["source_url"] = sec_data["source_url"]
            merged["source_date"] = sec_data.get("source_date")
        elif earnings_data and earnings_data.get("source_url"):
            merged["source_url"] = earnings_data["source_url"]
            merged["source_date"] = earnings_data.get("source_date")
        elif presentation_data and presentation_data.get("source_url"):
            merged["source_url"] = presentation_data["source_url"]
            merged["source_date"] = presentation_data.get("source_date")
        elif websearch_data and websearch_data.get("source_url"):
            merged["source_url"] = websearch_data["source_url"]
            merged["source_date"] = websearch_data.get("source_date")

        return merged

    async def _validate_and_store(
        self, domain: str, transformed_data: Dict[str, Any]
    ) -> InvestorIntelligenceData:
        """
        Validate transformed data and create InvestorIntelligenceData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated InvestorIntelligenceData model
        """
        # Convert nested dicts to Pydantic models
        sec_filings = [
            SECFiling(**f) for f in transformed_data.get("sec_filings", [])
        ]

        # Convert earnings transcripts
        earnings_transcripts = []
        for t in transformed_data.get("earnings_transcripts", []):
            # Convert nested quotes
            quotes = [ExecutiveQuote(**q) for q in t.get("key_quotes", [])]
            transcript = EarningsTranscript(
                quarter=t["quarter"],
                date=t["date"],
                source_url=t["source_url"],
                key_quotes=quotes,
                digital_transformation_mentions=t.get("digital_transformation_mentions", 0),
                search_discovery_mentions=t.get("search_discovery_mentions", 0),
                customer_experience_mentions=t.get("customer_experience_mentions", 0),
            )
            earnings_transcripts.append(transcript)

        # Convert investor presentations
        investor_presentations = [
            InvestorPresentation(**p)
            for p in transformed_data.get("investor_presentations", [])
        ]

        # Convert key quotes
        key_quotes = [
            ExecutiveQuote(**q) for q in transformed_data.get("key_quotes", [])
        ]

        # Convert forward guidance
        forward_guidance = None
        if transformed_data.get("forward_guidance"):
            forward_guidance = ForwardGuidance(**transformed_data["forward_guidance"])

        # Convert risk factors
        risk_factors = [
            RiskFactor(**r) for r in transformed_data.get("risk_factors", [])
        ]

        # Convert digital commitments
        digital_commitments = [
            DigitalCommitment(**c)
            for c in transformed_data.get("digital_commitments", [])
        ]

        return InvestorIntelligenceData(
            domain=domain,
            ticker=transformed_data.get("ticker"),
            sec_filings=sec_filings,
            earnings_transcripts=earnings_transcripts,
            investor_presentations=investor_presentations,
            key_quotes=key_quotes,
            forward_guidance=forward_guidance,
            risk_factors=risk_factors,
            digital_commitments=digital_commitments,
            total_digital_transformation_mentions=transformed_data.get(
                "total_digital_transformation_mentions", 0
            ),
            total_search_discovery_mentions=transformed_data.get(
                "total_search_discovery_mentions", 0
            ),
            total_customer_experience_mentions=transformed_data.get(
                "total_customer_experience_mentions", 0
            ),
            has_recent_earnings_call=transformed_data.get("has_recent_earnings_call", False),
            has_investor_day=transformed_data.get("has_investor_day", False),
        )

    def _has_recent_activity(
        self, transcripts: List[Dict], days: int = 90
    ) -> bool:
        """Check if there's recent earnings activity within specified days."""
        if not transcripts:
            return False

        cutoff = datetime.now()
        for t in transcripts:
            try:
                date_str = t.get("date", "")
                call_date = datetime.strptime(date_str, "%Y-%m-%d")
                if (cutoff - call_date).days <= days:
                    return True
            except (ValueError, TypeError):
                continue
        return False

    def _has_investor_day(self, presentations: List[Dict]) -> bool:
        """Check if there's an investor day within the last 12 months."""
        if not presentations:
            return False

        cutoff = datetime.now()
        for p in presentations:
            event = p.get("event", "").lower()
            if "investor day" in event or "investor meeting" in event:
                try:
                    date_str = p.get("date", "")
                    event_date = datetime.strptime(date_str, "%Y-%m-%d")
                    if (cutoff - event_date).days <= 365:
                        return True
                except (ValueError, TypeError):
                    continue
        return False

    def _map_to_algolia_product(self, text: str) -> Optional[str]:
        """Map quote content to Algolia product."""
        text_lower = text.lower()
        matches = []

        for keyword, product in self.ALGOLIA_PRODUCT_MAPPINGS.items():
            if keyword in text_lower:
                matches.append(product)

        return ", ".join(set(matches)) if matches else None

    def _count_pattern_mentions(self, text: str, patterns: List[str]) -> int:
        """Count mentions of patterns in text."""
        count = 0
        for pattern in patterns:
            count += len(re.findall(pattern, text, re.IGNORECASE))
        return count
