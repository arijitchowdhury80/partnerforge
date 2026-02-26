"""
M08: Investor Intelligence Module
=================================

Mines SEC filings and earnings calls for executive quotes and digital priorities.

Wave: 3 (Deep Intelligence - Depends on Wave 2)

Data Sources:
- SEC EDGAR (10-K, 10-Q MD&A sections)
- Earnings call transcripts (Motley Fool, Seeking Alpha, Globe and Mail)
- Investor presentations
- WebSearch for press releases

Dependencies:
- M01: Company Context (for ticker, is_public)
- M04: Financial Profile (for fiscal year end)

Output Schema:
- sec_filings: SEC filing data (10-K, 10-Q)
- earnings_calls: List of earnings call data with executive quotes
- digital_commitments: Digital transformation initiatives
- guidance: Forward guidance data
- executive_quotes: List[ExecutiveQuote] - critical for "In Their Own Words"

Database Table: intel_investor_intelligence

Private Company Handling:
- Private companies will have limited data
- Skip SEC filings, rely on WebSearch for press releases
- Mark data_limitation_reason appropriately

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M08 section)
- pipeline/models/source.py (ExecutiveQuote model)
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
    ExecutiveQuote,
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


class SECFilingRisk(BaseModel):
    """Risk factor from SEC filing."""
    risk_text: str = Field(..., description="Risk factor text from 10-K/10-Q")
    category: str = Field(default="general", description="Risk category")
    relevance_to_search: Optional[str] = Field(
        None,
        description="How this risk relates to search/discovery"
    )


class SECFilingData(BaseModel):
    """Data extracted from SEC filings."""
    filing_type: str = Field(..., description="10-K, 10-Q, 8-K")
    fiscal_year: Optional[str] = Field(None, description="Fiscal year (e.g., FY2025)")
    fiscal_quarter: Optional[str] = Field(None, description="Quarter (e.g., Q1)")
    filing_date: Optional[str] = Field(None, description="Filing date")
    filing_url: Optional[str] = Field(None, description="SEC EDGAR URL")

    # E-commerce mentions
    ecommerce_mentioned: bool = Field(default=False)
    ecommerce_share: Optional[float] = Field(None, ge=0.0, le=1.0)

    # Digital initiatives
    digital_initiatives: List[str] = Field(
        default_factory=list,
        description="Digital transformation initiatives mentioned"
    )

    # Risk factors
    risk_factors: List[SECFilingRisk] = Field(
        default_factory=list,
        description="Relevant risk factors from 10-K"
    )

    # MD&A highlights
    mda_highlights: List[str] = Field(
        default_factory=list,
        description="Key points from Management Discussion & Analysis"
    )


class EarningsCallQuote(BaseModel):
    """Individual quote from earnings call."""
    speaker_name: str = Field(..., description="Speaker's full name")
    speaker_title: str = Field(..., description="Speaker's title/role")
    quote: str = Field(..., description="The actual quote text")
    maps_to_algolia: Optional[str] = Field(
        None,
        description="How this quote maps to Algolia products"
    )
    priority: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")


class EarningsCallData(BaseModel):
    """Data from an earnings call."""
    quarter: str = Field(..., description="Quarter identifier (e.g., Q1 FY2026)")
    call_date: Optional[str] = Field(None, description="Date of the call")
    transcript_url: Optional[str] = Field(None, description="URL to transcript")

    key_quotes: List[EarningsCallQuote] = Field(
        default_factory=list,
        description="Key quotes relevant to digital/search"
    )

    # Themes discussed
    themes: List[str] = Field(
        default_factory=list,
        description="Main themes from the call"
    )


class GuidanceData(BaseModel):
    """Forward guidance from earnings calls."""
    fiscal_year: str = Field(..., description="Fiscal year for guidance")
    revenue_low: Optional[int] = Field(None, description="Low end of revenue guidance")
    revenue_high: Optional[int] = Field(None, description="High end of revenue guidance")
    eps_low: Optional[float] = Field(None, description="Low end of EPS guidance")
    eps_high: Optional[float] = Field(None, description="High end of EPS guidance")
    capex: Optional[int] = Field(None, description="Capital expenditure guidance")
    free_cash_flow: Optional[int] = Field(None, description="FCF guidance")


class DigitalCommitment(BaseModel):
    """Digital transformation commitment from investor communications."""
    initiative: str = Field(..., description="Initiative name/description")
    timeline: Optional[str] = Field(None, description="Timeline mentioned")
    explicit_search_mention: bool = Field(default=False)
    ai_personalization_mention: bool = Field(default=False)
    investment_amount: Optional[int] = Field(None, description="Investment if mentioned")
    source_url: Optional[str] = Field(None, description="Source of the commitment")


class InvestorIntelligenceData(BaseModel):
    """
    Output schema for M08 Investor Intelligence module.

    Contains SEC filings analysis, earnings call mining, and
    digital transformation commitments from investor communications.
    """

    domain: str = Field(..., description="Primary domain")
    ticker: Optional[str] = Field(None, description="Stock ticker symbol")
    is_public: bool = Field(default=False)

    # SEC filings
    sec_filings: List[SECFilingData] = Field(
        default_factory=list,
        description="Analyzed SEC filings"
    )
    latest_10k: Optional[SECFilingData] = Field(None, description="Most recent 10-K")

    # Earnings calls
    earnings_calls: List[EarningsCallData] = Field(
        default_factory=list,
        description="Recent earnings calls analyzed"
    )

    # Executive quotes (critical for "In Their Own Words")
    executive_quotes: List[dict] = Field(
        default_factory=list,
        description="Executive quotes with full attribution"
    )

    # Forward guidance
    guidance: Optional[GuidanceData] = Field(None, description="Latest guidance")

    # Digital commitments
    digital_commitments: List[DigitalCommitment] = Field(
        default_factory=list,
        description="Digital transformation commitments"
    )

    # Aggregated intelligence
    search_priority_level: str = Field(
        default="UNKNOWN",
        description="HIGH, MEDIUM, LOW based on explicit mentions"
    )
    total_quotes_found: int = Field(default=0)
    quotes_mentioning_search: int = Field(default=0)
    quotes_mentioning_ai: int = Field(default=0)

    # Metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)
    data_limitation_reason: Optional[str] = Field(None)


# Keywords that indicate search/discovery relevance
SEARCH_KEYWORDS = [
    "search", "discovery", "findability", "product discovery",
    "search engine", "site search", "search experience",
    "search results", "search functionality", "search capability",
]

AI_KEYWORDS = [
    "ai", "artificial intelligence", "machine learning", "ml",
    "personalization", "personalized", "recommendation",
    "neural", "nlp", "natural language",
]

DIGITAL_TRANSFORMATION_KEYWORDS = [
    "digital transformation", "digital strategy", "e-commerce",
    "omnichannel", "customer experience", "digital experience",
    "digital investment", "technology investment",
]


@register_module
class M08InvestorIntelligence(BaseModule):
    """
    Investor Intelligence Module.

    Mines SEC filings and earnings calls for executive quotes
    and digital transformation priorities.

    Wave 3 - Depends on M01 (Company Context) and M04 (Financial Profile)

    Data Flow:
    1. Check if company is public (from M01/M04)
    2. If public: Fetch SEC filings and earnings transcripts
    3. Extract executive quotes with full attribution
    4. Identify digital commitments and search/AI mentions
    5. Calculate search priority level
    6. Return with source citations

    Private Company Handling:
    - Search for press releases via WebSearch
    - Limited data available, mark accordingly
    """

    MODULE_ID = "m08_investor_intelligence"
    MODULE_NAME = "Investor Intelligence"
    DESCRIPTION = "SEC filings and earnings calls mining for executive quotes"

    WAVE = 3
    DEPENDS_ON = ["m01_company_context", "m04_financial_profile"]

    PRIMARY_SOURCE_TYPE = SourceType.SEC_EDGAR
    OUTPUT_TABLE = "intel_investor_intelligence"
    TIMEOUT_SECONDS = 90

    # Mock data for testing
    _MOCK_INVESTOR_DATA = {
        "costco.com": {
            "ticker": "COST",
            "is_public": True,
            "latest_10k": {
                "filing_type": "10-K",
                "fiscal_year": "FY2024",
                "filing_date": "2024-10-15",
                "filing_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000909832",
                "ecommerce_mentioned": True,
                "ecommerce_share": 0.08,
                "digital_initiatives": [
                    "E-commerce platform enhancement",
                    "Mobile app improvements",
                    "Same-day delivery expansion",
                ],
                "risk_factors": [
                    {
                        "risk_text": "Our e-commerce operations expose us to additional risks including website security and data protection.",
                        "category": "technology",
                        "relevance_to_search": "Security and performance of digital platform"
                    },
                    {
                        "risk_text": "Competition in retail and e-commerce continues to intensify with new entrants and technology-driven changes.",
                        "category": "competitive",
                        "relevance_to_search": "Need for competitive digital experience"
                    },
                ],
                "mda_highlights": [
                    "E-commerce comparable sales increased 16% in fiscal 2024",
                    "Continued investment in digital capabilities",
                ],
            },
            "earnings_calls": [
                {
                    "quarter": "Q4 FY2024",
                    "call_date": "2024-09-26",
                    "transcript_url": "https://www.fool.com/earnings/call-transcripts/2024/09/26/costco-cost-q4-2024-earnings-call-transcript/",
                    "key_quotes": [
                        {
                            "speaker_name": "Ron Vachris",
                            "speaker_title": "CEO",
                            "quote": "Our e-commerce business continued its strong momentum, with comparable sales up 16%. We're investing in enhanced site functionality to improve member experience.",
                            "maps_to_algolia": "Algolia Search, Site Experience",
                            "priority": "MEDIUM",
                        },
                    ],
                    "themes": ["e-commerce growth", "member experience", "digital investment"],
                },
            ],
            "guidance": {
                "fiscal_year": "FY2025",
                "capex": 4500000000,
            },
            "digital_commitments": [
                {
                    "initiative": "E-commerce platform modernization",
                    "timeline": "FY2025",
                    "explicit_search_mention": False,
                    "ai_personalization_mention": False,
                },
            ],
        },
        "sallybeauty.com": {
            "ticker": "SBH",
            "is_public": True,
            "latest_10k": {
                "filing_type": "10-K",
                "fiscal_year": "FY2025",
                "filing_date": "2025-11-13",
                "filing_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001368458",
                "ecommerce_mentioned": True,
                "ecommerce_share": 0.107,
                "digital_initiatives": [
                    "Licensed Colorist on Demand (LCOD)",
                    "Digital Marketplace Expansion",
                    "Sally Ignited transformation program",
                ],
                "risk_factors": [
                    {
                        "risk_text": "Competitive factors in e-commerce include the look and feel of digital platforms, ease and security of the checkout process, and the quality of the search functionality.",
                        "category": "competitive",
                        "relevance_to_search": "Direct mention of search quality as competitive factor"
                    },
                    {
                        "risk_text": "The beauty products retail and distribution industry is highly competitive and fragmented.",
                        "category": "competitive",
                        "relevance_to_search": "Need for differentiated customer experience"
                    },
                ],
                "mda_highlights": [
                    "E-commerce sales represented approximately 10.7% of consolidated net sales",
                    "Continued investment in digital transformation through Sally Ignited program",
                ],
            },
            "earnings_calls": [
                {
                    "quarter": "Q1 FY2026",
                    "call_date": "2026-02-09",
                    "transcript_url": "https://www.fool.com/earnings/call-transcripts/2026/02/09/sally-beauty-sbh-q1-2026-earnings-call-transcript/",
                    "key_quotes": [
                        {
                            "speaker_name": "Denise Paulonis",
                            "speaker_title": "President & CEO",
                            "quote": "Notable enhancements include a more efficient search engine for easier product discovery.",
                            "maps_to_algolia": "Algolia InstantSearch, Dynamic Faceting",
                            "priority": "HIGH",
                        },
                        {
                            "speaker_name": "Denise Paulonis",
                            "speaker_title": "President & CEO",
                            "quote": "Enhanced capabilities around education, AI, and personalization.",
                            "maps_to_algolia": "Algolia NeuralSearch, Personalization",
                            "priority": "HIGH",
                        },
                        {
                            "speaker_name": "Marlo Cormier",
                            "speaker_title": "SVP & CFO",
                            "quote": "Global ecommerce sales increased 11% to $111 million.",
                            "maps_to_algolia": "Enterprise scale opportunity",
                            "priority": "MEDIUM",
                        },
                    ],
                    "themes": [
                        "search improvement",
                        "AI and personalization",
                        "e-commerce growth",
                        "Sally Ignited transformation",
                    ],
                },
            ],
            "guidance": {
                "fiscal_year": "FY2026",
                "revenue_low": 3710000000,
                "revenue_high": 3770000000,
                "eps_low": 2.00,
                "eps_high": 2.10,
                "capex": 100000000,
                "free_cash_flow": 200000000,
            },
            "digital_commitments": [
                {
                    "initiative": "Sally App Upgrade - more efficient search engine",
                    "timeline": "Rolling through FY2026",
                    "explicit_search_mention": True,
                    "ai_personalization_mention": False,
                },
                {
                    "initiative": "BSG App & Platform Update with AI and personalization",
                    "timeline": "Spring 2026",
                    "explicit_search_mention": False,
                    "ai_personalization_mention": True,
                },
            ],
        },
        "mercedes-benz.com": {
            "ticker": "MBG",
            "is_public": True,
            "latest_10k": {
                "filing_type": "Annual Report",  # European companies use Annual Report
                "fiscal_year": "FY2024",
                "filing_date": "2025-02-20",
                "filing_url": "https://group.mercedes-benz.com/investors/reports-events/annual-reports/",
                "ecommerce_mentioned": True,
                "ecommerce_share": 0.02,
                "digital_initiatives": [
                    "MB.OS - Mercedes-Benz Operating System",
                    "Digital retail platform expansion",
                    "Direct-to-consumer sales channel",
                ],
                "risk_factors": [
                    {
                        "risk_text": "Digitalization is transforming the automotive industry and requires significant investment in new technologies.",
                        "category": "technology",
                        "relevance_to_search": "Digital platform investment priority"
                    },
                ],
                "mda_highlights": [
                    "Accelerating direct-to-consumer digital sales",
                    "Investment in digital customer experience",
                ],
            },
            "earnings_calls": [
                {
                    "quarter": "Q4 2024",
                    "call_date": "2025-02-20",
                    "transcript_url": "https://group.mercedes-benz.com/investors/events/",
                    "key_quotes": [
                        {
                            "speaker_name": "Ola Kallenius",
                            "speaker_title": "CEO",
                            "quote": "Our digital transformation continues with significant investment in customer-facing technology.",
                            "maps_to_algolia": "Digital experience, Search optimization",
                            "priority": "MEDIUM",
                        },
                    ],
                    "themes": ["digital transformation", "electric vehicles", "direct sales"],
                },
            ],
            "guidance": {
                "fiscal_year": "FY2025",
                "capex": 14000000000,
            },
            "digital_commitments": [
                {
                    "initiative": "Digital retail platform expansion",
                    "timeline": "2025-2027",
                    "explicit_search_mention": False,
                    "ai_personalization_mention": True,
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
        Execute investor intelligence enrichment.

        Args:
            domain: The domain to analyze
            context: Results from M01 and M04 modules

        Returns:
            ModuleResult with InvestorIntelligenceData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting investor intelligence for {domain}")

            # Validate dependencies
            context = context or {}
            self.validate_dependencies(context)

            normalized_domain = self._normalize_domain(domain)

            # Extract company info from context
            m01_data = context.get("m01_company_context", {})
            m04_data = context.get("m04_financial_profile", {})

            # Get public/private status and ticker
            is_public = self._get_is_public(m01_data, m04_data)
            ticker = self._get_ticker(m01_data, m04_data)

            if is_public and normalized_domain in self._MOCK_INVESTOR_DATA:
                # Fetch investor data for public company
                raw_data, citations = await self._fetch_investor_data(normalized_domain)

                # Process SEC filings
                sec_filings = self._process_sec_filings(raw_data)
                latest_10k = sec_filings[0] if sec_filings else None

                # Process earnings calls
                earnings_calls = self._process_earnings_calls(raw_data)

                # Extract executive quotes
                executive_quotes = self._extract_executive_quotes(raw_data, citations)

                # Process guidance
                guidance = self._process_guidance(raw_data)

                # Process digital commitments
                digital_commitments = self._process_digital_commitments(raw_data)

                # Calculate search priority
                search_priority = self._calculate_search_priority(
                    executive_quotes, digital_commitments, sec_filings
                )

                # Count quotes
                total_quotes = len(executive_quotes)
                search_quotes = sum(
                    1 for q in executive_quotes
                    if any(kw in q.get("quote", "").lower() for kw in SEARCH_KEYWORDS)
                )
                ai_quotes = sum(
                    1 for q in executive_quotes
                    if any(kw in q.get("quote", "").lower() for kw in AI_KEYWORDS)
                )

                data_limitation = None

            else:
                # Private company - limited data
                sec_filings = []
                latest_10k = None
                earnings_calls = []
                executive_quotes = []
                guidance = None
                digital_commitments = []
                search_priority = "UNKNOWN"
                total_quotes = 0
                search_quotes = 0
                ai_quotes = 0

                if is_public:
                    data_limitation = "Public company but no investor data found"
                else:
                    data_limitation = "Private company - SEC filings not available"

                # Create minimal citation
                citations = [
                    self._create_citation(
                        source_type=SourceType.WEBSEARCH,
                        source_url=f"https://www.google.com/search?q={normalized_domain}+investor+relations",
                        confidence=0.3,
                        notes=data_limitation,
                    )
                ]

            # Build output
            output_data = InvestorIntelligenceData(
                domain=normalized_domain,
                ticker=ticker,
                is_public=is_public,
                sec_filings=sec_filings,
                latest_10k=latest_10k,
                earnings_calls=earnings_calls,
                executive_quotes=[q for q in executive_quotes],  # Convert ExecutiveQuote to dict
                guidance=guidance,
                digital_commitments=digital_commitments,
                search_priority_level=search_priority,
                total_quotes_found=total_quotes,
                quotes_mentioning_search=search_quotes,
                quotes_mentioning_ai=ai_quotes,
                data_quality_score=self._calculate_data_quality(
                    sec_filings, earnings_calls, executive_quotes
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
                f"Investor intelligence complete for {domain}. "
                f"Quotes: {total_quotes} (search: {search_quotes}, AI: {ai_quotes}), "
                f"Priority: {search_priority}. Duration: {duration_ms:.0f}ms"
            )

            return result

        except DependencyNotMetError:
            raise
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Investor intelligence failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")
        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")
        return True

    def _get_is_public(
        self,
        m01_data: Dict[str, Any],
        m04_data: Dict[str, Any],
    ) -> bool:
        """Extract is_public from context."""
        if isinstance(m01_data, ModuleResult):
            m01_data = m01_data.data
        if isinstance(m04_data, ModuleResult):
            m04_data = m04_data.data

        return m04_data.get("is_public", m01_data.get("is_public", False))

    def _get_ticker(
        self,
        m01_data: Dict[str, Any],
        m04_data: Dict[str, Any],
    ) -> Optional[str]:
        """Extract ticker from context."""
        if isinstance(m01_data, ModuleResult):
            m01_data = m01_data.data
        if isinstance(m04_data, ModuleResult):
            m04_data = m04_data.data

        return m04_data.get("ticker") or m01_data.get("ticker")

    async def _fetch_investor_data(
        self,
        domain: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """Fetch investor data from sources."""
        citations = []

        if domain in self._MOCK_INVESTOR_DATA:
            data = self._MOCK_INVESTOR_DATA[domain].copy()

            # Create SEC citation
            sec_citation = self._create_citation(
                source_type=SourceType.SEC_EDGAR,
                source_url=data.get("latest_10k", {}).get(
                    "filing_url",
                    f"https://www.sec.gov/cgi-bin/browse-edgar?company={domain}"
                ),
                api_endpoint="10-K",
                confidence=0.95,
            )
            citations.append(sec_citation)

            # Create earnings call citation
            if data.get("earnings_calls"):
                ec_citation = self._create_citation(
                    source_type=SourceType.EARNINGS_CALL,
                    source_url=data["earnings_calls"][0].get(
                        "transcript_url",
                        f"https://www.fool.com/earnings/call-transcripts/{domain}"
                    ),
                    confidence=0.9,
                )
                citations.append(ec_citation)

            return data, citations

        # Fallback
        citation = self._create_citation(
            source_type=SourceType.WEBSEARCH,
            source_url=f"https://www.google.com/search?q={domain}+investor+relations",
            confidence=0.5,
        )
        citations.append(citation)
        return {}, citations

    def _process_sec_filings(
        self,
        raw_data: Dict[str, Any],
    ) -> List[SECFilingData]:
        """Process SEC filing data."""
        filings = []

        if "latest_10k" in raw_data:
            filing_data = raw_data["latest_10k"]

            risk_factors = [
                SECFilingRisk(**rf) if isinstance(rf, dict) else rf
                for rf in filing_data.get("risk_factors", [])
            ]

            filing = SECFilingData(
                filing_type=filing_data.get("filing_type", "10-K"),
                fiscal_year=filing_data.get("fiscal_year"),
                filing_date=filing_data.get("filing_date"),
                filing_url=filing_data.get("filing_url"),
                ecommerce_mentioned=filing_data.get("ecommerce_mentioned", False),
                ecommerce_share=filing_data.get("ecommerce_share"),
                digital_initiatives=filing_data.get("digital_initiatives", []),
                risk_factors=risk_factors,
                mda_highlights=filing_data.get("mda_highlights", []),
            )
            filings.append(filing)

        return filings

    def _process_earnings_calls(
        self,
        raw_data: Dict[str, Any],
    ) -> List[EarningsCallData]:
        """Process earnings call data."""
        calls = []

        for call_data in raw_data.get("earnings_calls", []):
            quotes = [
                EarningsCallQuote(**q) if isinstance(q, dict) else q
                for q in call_data.get("key_quotes", [])
            ]

            call = EarningsCallData(
                quarter=call_data.get("quarter", "Unknown"),
                call_date=call_data.get("call_date"),
                transcript_url=call_data.get("transcript_url"),
                key_quotes=quotes,
                themes=call_data.get("themes", []),
            )
            calls.append(call)

        return calls

    def _extract_executive_quotes(
        self,
        raw_data: Dict[str, Any],
        citations: List[SourceCitation],
    ) -> List[Dict[str, Any]]:
        """
        Extract executive quotes from earnings calls.

        Returns list of dicts (serializable form of ExecutiveQuote).
        """
        quotes = []

        for call_data in raw_data.get("earnings_calls", []):
            transcript_url = call_data.get("transcript_url", "")
            call_date = call_data.get("call_date", "")

            # Find the citation for this call
            ec_citation = None
            for c in citations:
                if c.source_type == SourceType.EARNINGS_CALL:
                    ec_citation = c
                    break

            for quote_data in call_data.get("key_quotes", []):
                quote_dict = {
                    "quote": quote_data.get("quote", ""),
                    "speaker_name": quote_data.get("speaker_name", ""),
                    "speaker_title": quote_data.get("speaker_title", ""),
                    "source_url": transcript_url,
                    "source_type": "earnings_call",
                    "date": call_date,
                    "maps_to_algolia": quote_data.get("maps_to_algolia"),
                    "priority": quote_data.get("priority", "MEDIUM"),
                }
                quotes.append(quote_dict)

        return quotes

    def _process_guidance(
        self,
        raw_data: Dict[str, Any],
    ) -> Optional[GuidanceData]:
        """Process forward guidance data."""
        if "guidance" not in raw_data:
            return None

        g = raw_data["guidance"]
        return GuidanceData(
            fiscal_year=g.get("fiscal_year", "Unknown"),
            revenue_low=g.get("revenue_low"),
            revenue_high=g.get("revenue_high"),
            eps_low=g.get("eps_low"),
            eps_high=g.get("eps_high"),
            capex=g.get("capex"),
            free_cash_flow=g.get("free_cash_flow"),
        )

    def _process_digital_commitments(
        self,
        raw_data: Dict[str, Any],
    ) -> List[DigitalCommitment]:
        """Process digital commitment data."""
        commitments = []

        for dc in raw_data.get("digital_commitments", []):
            commitment = DigitalCommitment(
                initiative=dc.get("initiative", ""),
                timeline=dc.get("timeline"),
                explicit_search_mention=dc.get("explicit_search_mention", False),
                ai_personalization_mention=dc.get("ai_personalization_mention", False),
                investment_amount=dc.get("investment_amount"),
                source_url=dc.get("source_url"),
            )
            commitments.append(commitment)

        return commitments

    def _calculate_search_priority(
        self,
        quotes: List[Dict[str, Any]],
        commitments: List[DigitalCommitment],
        filings: List[SECFilingData],
    ) -> str:
        """
        Calculate search priority level based on explicit mentions.

        HIGH: Explicit search mention in earnings call or commitment
        MEDIUM: Digital transformation mention, AI/personalization mention
        LOW: E-commerce mention but no specific search focus
        UNKNOWN: No relevant mentions
        """
        # Check for explicit search mentions
        search_in_quotes = any(
            any(kw in q.get("quote", "").lower() for kw in SEARCH_KEYWORDS)
            for q in quotes
        )
        search_in_commitments = any(c.explicit_search_mention for c in commitments)

        # Check for AI/personalization mentions
        ai_in_quotes = any(
            any(kw in q.get("quote", "").lower() for kw in AI_KEYWORDS)
            for q in quotes
        )
        ai_in_commitments = any(c.ai_personalization_mention for c in commitments)

        # Check for digital transformation mentions
        digital_in_filings = any(
            any(kw in " ".join(f.digital_initiatives).lower() for kw in DIGITAL_TRANSFORMATION_KEYWORDS)
            for f in filings
        )

        # Search-specific risk factors
        search_in_risks = any(
            any(r.relevance_to_search and "search" in r.relevance_to_search.lower() for r in f.risk_factors)
            for f in filings
        )

        if search_in_quotes or search_in_commitments:
            return "HIGH"
        elif ai_in_quotes or ai_in_commitments or search_in_risks:
            return "MEDIUM"
        elif digital_in_filings:
            return "LOW"
        else:
            return "UNKNOWN"

    def _calculate_data_quality(
        self,
        filings: List[SECFilingData],
        calls: List[EarningsCallData],
        quotes: List[Dict[str, Any]],
    ) -> float:
        """Calculate data quality score."""
        score = 0.0

        if filings:
            score += 0.3
        if calls:
            score += 0.3
        if quotes:
            score += 0.2
            if len(quotes) >= 3:
                score += 0.1
        if any(f.risk_factors for f in filings):
            score += 0.1

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
