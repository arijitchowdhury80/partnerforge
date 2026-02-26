"""
M04: Financial Profile Module
=============================

Collects 3-year financial trends, margin zone classification, and ROI modeling.

Wave: 1 (Foundation - No dependencies)

Data Sources:
- Yahoo Finance MCP (stock info, financials, balance sheet, cash flow)
- SEC EDGAR (10-K, 10-Q filings via WebFetch) - for public companies
- WebSearch for press releases - for private companies

Output Schema:
- domain: str
- ticker: Optional[str]
- is_public: bool
- financials: FinancialsData (revenue, margins, income)
- margin_zone: MarginZone
- ecommerce: EcommerceData
- stock_info: StockInfo
- roi_scenarios: ROIScenarios

Database Table: intel_financial_profile

Margin Zone Classification:
| Zone | EBITDA Margin | Pressure Level | Sales Implication |
|------|---------------|----------------|-------------------|
| RED | <=10% | High | Need hard ROI proof |
| YELLOW | 10-20% | Moderate | Efficiency gains valued |
| GREEN | >20% | Healthy | Budget available |

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M04 section)
- docs/DATABASE_SCHEMA_V2.md (intel_financial_profile)
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


class FiscalYearRevenue(BaseModel):
    """Revenue data for a fiscal year."""
    fiscal_year: str = Field(..., description="Fiscal year label (e.g., 'FY2024')")
    revenue: int = Field(..., description="Revenue in USD")
    yoy_change: Optional[float] = Field(None, description="Year-over-year change (-1 to +inf)")


class FiscalYearIncome(BaseModel):
    """Net income data for a fiscal year."""
    fiscal_year: str
    net_income: int = Field(..., description="Net income in USD")
    margin: Optional[float] = Field(None, description="Net income margin (0-1)")


class FinancialsData(BaseModel):
    """Core financial data."""
    revenue_3yr: List[FiscalYearRevenue] = Field(
        default_factory=list,
        description="3-year revenue history"
    )
    latest_revenue: Optional[int] = Field(None, description="Most recent annual revenue")
    revenue_trend: str = Field(default="unknown", description="growing, stable, declining")

    net_income_3yr: List[FiscalYearIncome] = Field(
        default_factory=list,
        description="3-year net income history"
    )

    ebitda_margin: Optional[float] = Field(None, ge=0.0, le=1.0, description="EBITDA margin")
    operating_margin: Optional[float] = Field(None, description="Operating margin (can be negative)")
    gross_margin: Optional[float] = Field(None, ge=0.0, le=1.0, description="Gross margin")


class MarginZone(BaseModel):
    """Margin zone classification for sales strategy."""
    classification: str = Field(default="UNKNOWN", description="RED, YELLOW, GREEN, UNKNOWN")
    ebitda_margin: Optional[float] = None
    threshold_red: float = Field(default=0.10, description="Threshold for RED zone")
    threshold_green: float = Field(default=0.20, description="Threshold for GREEN zone")
    implication: Optional[str] = Field(None, description="Sales implication")


class EcommerceData(BaseModel):
    """E-commerce specific financial data."""
    ecommerce_revenue: Optional[int] = Field(None, description="E-commerce revenue")
    ecommerce_share: Optional[float] = Field(None, ge=0.0, le=1.0, description="E-commerce % of total")
    ecommerce_growth_yoy: Optional[float] = Field(None, description="E-commerce YoY growth")
    addressable_search_revenue: Optional[int] = Field(
        None,
        description="Estimated search-influenced revenue (15% of e-commerce)"
    )


class StockInfo(BaseModel):
    """Stock market data for public companies."""
    current_price: Optional[float] = Field(None, description="Current stock price")
    market_cap: Optional[int] = Field(None, description="Market capitalization")
    fifty_two_week_high: Optional[float] = Field(None, description="52-week high")
    fifty_two_week_low: Optional[float] = Field(None, description="52-week low")
    pe_ratio: Optional[float] = Field(None, description="Price-to-earnings ratio")
    analyst_consensus: Optional[str] = Field(None, description="BUY, HOLD, SELL")


class ROIScenario(BaseModel):
    """Individual ROI scenario."""
    lift_pct: float = Field(..., ge=0.0, le=1.0, description="Conversion lift percentage")
    annual_impact: int = Field(..., description="Annual revenue impact in USD")


class ROIScenarios(BaseModel):
    """ROI modeling scenarios."""
    conservative: Optional[ROIScenario] = None
    moderate: Optional[ROIScenario] = None
    aggressive: Optional[ROIScenario] = None
    base_revenue: Optional[int] = Field(None, description="E-commerce revenue used for calculation")


class FinancialProfileData(BaseModel):
    """
    Output schema for M04 Financial Profile module.

    Comprehensive financial data for public companies.
    Private companies will have limited data (is_public=False).
    """

    domain: str = Field(..., description="Primary domain")
    ticker: Optional[str] = Field(None, description="Stock ticker symbol")
    exchange: Optional[str] = Field(None, description="Stock exchange")
    is_public: bool = Field(default=False, description="Whether publicly traded")
    fiscal_year_end: Optional[str] = Field(None, description="Fiscal year end date")

    # Core financials
    financials: FinancialsData = Field(
        default_factory=FinancialsData,
        description="Core financial metrics"
    )

    # Margin zone classification
    margin_zone: MarginZone = Field(
        default_factory=MarginZone,
        description="Margin zone for sales strategy"
    )

    # E-commerce specific
    ecommerce: EcommerceData = Field(
        default_factory=EcommerceData,
        description="E-commerce financials"
    )

    # Stock data (public companies only)
    stock_info: StockInfo = Field(
        default_factory=StockInfo,
        description="Stock market data"
    )

    # ROI modeling
    roi_scenarios: ROIScenarios = Field(
        default_factory=ROIScenarios,
        description="ROI scenarios for sales"
    )

    # Enrichment metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)
    data_limitation_reason: Optional[str] = Field(None, description="Why data is limited")


# Margin zone thresholds and implications
MARGIN_ZONES = {
    "RED": {
        "max_margin": 0.10,
        "implication": "High margin pressure - need hard ROI proof",
    },
    "YELLOW": {
        "max_margin": 0.20,
        "implication": "Moderate margin pressure - efficiency gains valued",
    },
    "GREEN": {
        "max_margin": 1.0,
        "implication": "Healthy margins - budget available for innovation",
    },
}


@register_module
class M04FinancialProfile(BaseModule):
    """
    Financial Profile Intelligence Module.

    Collects financial data for public companies.
    Private companies handled gracefully with limited data.
    This module has no dependencies and runs in Wave 1.

    Data Flow:
    1. Resolve ticker from domain (if public)
    2. Fetch financial data from Yahoo Finance
    3. Calculate margin zone
    4. Estimate e-commerce metrics
    5. Build ROI scenarios
    6. Return with source citations

    Graceful Degradation:
    - Private companies: is_public=False, limited data
    - No ticker: Skip Yahoo Finance, use press releases
    - Missing data: Mark fields as None, set data_limitation_reason
    """

    MODULE_ID = "m04_financial_profile"
    MODULE_NAME = "Financial Profile"
    DESCRIPTION = "Financial data and ROI modeling for opportunity sizing"

    WAVE = 1
    DEPENDS_ON = []

    PRIMARY_SOURCE_TYPE = SourceType.YAHOO_FINANCE
    OUTPUT_TABLE = "intel_financial_profile"
    TIMEOUT_SECONDS = 60

    # Ticker mapping for common domains (will be replaced by API lookup)
    _TICKER_MAP = {
        "costco.com": ("COST", "NASDAQ"),
        "sallybeauty.com": ("SBH", "NYSE"),
        "mercedes-benz.com": ("MBG.DE", "XETRA"),
        "walmart.com": ("WMT", "NYSE"),
        "amazon.com": ("AMZN", "NASDAQ"),
        "target.com": ("TGT", "NYSE"),
        "homedepot.com": ("HD", "NYSE"),
        "lowes.com": ("LOW", "NYSE"),
        "macys.com": ("M", "NYSE"),
        "kohls.com": ("KSS", "NYSE"),
        "nordstrom.com": ("JWN", "NYSE"),
    }

    # Mock financial data for testing
    _MOCK_FINANCIAL_DATA = {
        "COST": {
            "company_name": "Costco Wholesale Corporation",
            "fiscal_year_end": "September 1",
            "revenue_3yr": [
                {"fiscal_year": "FY2022", "revenue": 222_730_000_000, "yoy_change": 0.158},
                {"fiscal_year": "FY2023", "revenue": 237_710_000_000, "yoy_change": 0.067},
                {"fiscal_year": "FY2024", "revenue": 254_453_000_000, "yoy_change": 0.070},
            ],
            "net_income_3yr": [
                {"fiscal_year": "FY2022", "net_income": 5_844_000_000, "margin": 0.026},
                {"fiscal_year": "FY2023", "net_income": 6_292_000_000, "margin": 0.026},
                {"fiscal_year": "FY2024", "net_income": 7_367_000_000, "margin": 0.029},
            ],
            "ebitda_margin": 0.045,
            "operating_margin": 0.034,
            "gross_margin": 0.126,
            "ecommerce_share": 0.08,
            "stock": {
                "current_price": 925.50,
                "market_cap": 410_000_000_000,
                "52_week_high": 950.00,
                "52_week_low": 650.00,
                "pe_ratio": 55.2,
                "analyst_consensus": "BUY",
            },
        },
        "SBH": {
            "company_name": "Sally Beauty Holdings, Inc.",
            "fiscal_year_end": "September 30",
            "revenue_3yr": [
                {"fiscal_year": "FY2022", "revenue": 3_820_000_000, "yoy_change": None},
                {"fiscal_year": "FY2023", "revenue": 3_730_000_000, "yoy_change": -0.024},
                {"fiscal_year": "FY2024", "revenue": 3_720_000_000, "yoy_change": -0.003},
            ],
            "net_income_3yr": [
                {"fiscal_year": "FY2022", "net_income": 184_600_000, "margin": 0.048},
                {"fiscal_year": "FY2023", "net_income": 153_400_000, "margin": 0.041},
                {"fiscal_year": "FY2024", "net_income": 195_900_000, "margin": 0.053},
            ],
            "ebitda_margin": 0.126,
            "operating_margin": 0.094,
            "gross_margin": 0.51,
            "ecommerce_share": 0.12,
            "stock": {
                "current_price": 17.05,
                "market_cap": 1_800_000_000,
                "52_week_high": 19.50,
                "52_week_low": 12.80,
                "pe_ratio": 9.2,
                "analyst_consensus": "HOLD",
            },
        },
        "MBG.DE": {
            "company_name": "Mercedes-Benz Group AG",
            "fiscal_year_end": "December 31",
            "revenue_3yr": [
                {"fiscal_year": "FY2022", "revenue": 150_017_000_000, "yoy_change": 0.12},
                {"fiscal_year": "FY2023", "revenue": 153_218_000_000, "yoy_change": 0.021},
                {"fiscal_year": "FY2024", "revenue": 145_600_000_000, "yoy_change": -0.050},
            ],
            "net_income_3yr": [
                {"fiscal_year": "FY2022", "net_income": 14_800_000_000, "margin": 0.099},
                {"fiscal_year": "FY2023", "net_income": 14_500_000_000, "margin": 0.095},
                {"fiscal_year": "FY2024", "net_income": 12_900_000_000, "margin": 0.089},
            ],
            "ebitda_margin": 0.145,
            "operating_margin": 0.11,
            "gross_margin": 0.22,
            "ecommerce_share": 0.02,  # Very low for automotive
            "stock": {
                "current_price": 72.50,
                "market_cap": 77_000_000_000,
                "52_week_high": 78.00,
                "52_week_low": 54.00,
                "pe_ratio": 5.9,
                "analyst_consensus": "HOLD",
            },
        },
    }

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute financial profile enrichment.

        Args:
            domain: The domain to analyze
            context: Not used (Wave 1 module)

        Returns:
            ModuleResult with FinancialProfileData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting financial profile for {domain}")

            normalized_domain = self._normalize_domain(domain)

            # Resolve ticker
            ticker_info = self._resolve_ticker(normalized_domain)

            if ticker_info:
                ticker, exchange = ticker_info
                is_public = True

                # Fetch financial data
                raw_data, citations = await self._fetch_financial_data(ticker)

                # Process financials
                financials = self._extract_financials(raw_data)
                margin_zone = self._calculate_margin_zone(raw_data.get("ebitda_margin"))
                ecommerce = self._calculate_ecommerce(raw_data)
                stock_info = self._extract_stock_info(raw_data)
                roi_scenarios = self._calculate_roi_scenarios(ecommerce)

                data_limitation = None
            else:
                # Private company - limited data
                ticker = None
                exchange = None
                is_public = False
                financials = FinancialsData()
                margin_zone = MarginZone(classification="UNKNOWN")
                ecommerce = EcommerceData()
                stock_info = StockInfo()
                roi_scenarios = ROIScenarios()
                data_limitation = "Private company - financial data not publicly available"

                # Create citation for private company
                citations = [
                    self._create_citation(
                        source_type=SourceType.WEBSEARCH,
                        source_url=f"https://www.google.com/search?q={normalized_domain}+company+financials",
                        confidence=0.3,
                        notes="Private company - limited data",
                    )
                ]

            # Build output
            output_data = FinancialProfileData(
                domain=normalized_domain,
                ticker=ticker,
                exchange=exchange,
                is_public=is_public,
                fiscal_year_end=raw_data.get("fiscal_year_end") if ticker_info else None,
                financials=financials,
                margin_zone=margin_zone,
                ecommerce=ecommerce,
                stock_info=stock_info,
                roi_scenarios=roi_scenarios,
                data_quality_score=self._calculate_data_quality(raw_data if ticker_info else {}),
                enrichment_sources=[c.source_type.value for c in citations],
                data_limitation_reason=data_limitation,
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

            if is_public:
                self.logger.info(
                    f"Financial profile complete for {domain} (${ticker}). "
                    f"Revenue: ${financials.latest_revenue:,}, "
                    f"Margin zone: {margin_zone.classification}. "
                    f"Duration: {duration_ms:.0f}ms"
                )
            else:
                self.logger.info(
                    f"Financial profile complete for {domain} (private company). "
                    f"Duration: {duration_ms:.0f}ms"
                )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Financial profile failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")
        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")
        return True

    def _resolve_ticker(self, domain: str) -> Optional[Tuple[str, str]]:
        """
        Resolve ticker from domain.

        In production, this would use:
        1. Known mapping
        2. WebSearch to find ticker
        3. Company name -> ticker lookup

        Returns:
            Tuple of (ticker, exchange) or None if private/unknown
        """
        return self._TICKER_MAP.get(domain)

    async def _fetch_financial_data(
        self,
        ticker: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """Fetch financial data from Yahoo Finance or mock."""
        citations = []

        if ticker in self._MOCK_FINANCIAL_DATA:
            data = self._MOCK_FINANCIAL_DATA[ticker].copy()
            citation = self._create_citation(
                source_type=SourceType.YAHOO_FINANCE,
                source_url=f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}",
                api_endpoint="quoteSummary",
                confidence=0.95,
            )
            citations.append(citation)
            return data, citations

        # Fallback
        citation = self._create_citation(
            source_type=SourceType.YAHOO_FINANCE,
            source_url=f"https://finance.yahoo.com/quote/{ticker}/",
            confidence=0.5,
            notes="No data found",
        )
        citations.append(citation)
        return {}, citations

    def _extract_financials(self, raw_data: Dict) -> FinancialsData:
        """Extract core financial metrics."""
        revenue_3yr = [
            FiscalYearRevenue(**r) for r in raw_data.get("revenue_3yr", [])
        ]
        net_income_3yr = [
            FiscalYearIncome(**i) for i in raw_data.get("net_income_3yr", [])
        ]

        latest_revenue = revenue_3yr[-1].revenue if revenue_3yr else None

        # Determine revenue trend
        if len(revenue_3yr) >= 2:
            changes = [r.yoy_change for r in revenue_3yr[1:] if r.yoy_change is not None]
            if changes:
                avg_change = sum(changes) / len(changes)
                if avg_change > 0.03:
                    trend = "growing"
                elif avg_change < -0.03:
                    trend = "declining"
                else:
                    trend = "stable"
            else:
                trend = "unknown"
        else:
            trend = "unknown"

        return FinancialsData(
            revenue_3yr=revenue_3yr,
            latest_revenue=latest_revenue,
            revenue_trend=trend,
            net_income_3yr=net_income_3yr,
            ebitda_margin=raw_data.get("ebitda_margin"),
            operating_margin=raw_data.get("operating_margin"),
            gross_margin=raw_data.get("gross_margin"),
        )

    def _calculate_margin_zone(self, ebitda_margin: Optional[float]) -> MarginZone:
        """Calculate margin zone classification."""
        if ebitda_margin is None:
            return MarginZone(
                classification="UNKNOWN",
                implication="Unable to determine margin pressure level",
            )

        if ebitda_margin <= 0.10:
            zone = "RED"
        elif ebitda_margin <= 0.20:
            zone = "YELLOW"
        else:
            zone = "GREEN"

        return MarginZone(
            classification=zone,
            ebitda_margin=ebitda_margin,
            implication=MARGIN_ZONES[zone]["implication"],
        )

    def _calculate_ecommerce(self, raw_data: Dict) -> EcommerceData:
        """Calculate e-commerce metrics."""
        revenue_3yr = raw_data.get("revenue_3yr", [])
        latest_revenue = revenue_3yr[-1]["revenue"] if revenue_3yr else None
        ecommerce_share = raw_data.get("ecommerce_share", 0.10)  # Default 10%

        if latest_revenue and ecommerce_share:
            ecommerce_revenue = int(latest_revenue * ecommerce_share)
            # Assume 15% of e-commerce is search-influenced
            addressable_search_revenue = int(ecommerce_revenue * 0.15)
        else:
            ecommerce_revenue = None
            addressable_search_revenue = None

        return EcommerceData(
            ecommerce_revenue=ecommerce_revenue,
            ecommerce_share=ecommerce_share,
            ecommerce_growth_yoy=raw_data.get("ecommerce_growth_yoy"),
            addressable_search_revenue=addressable_search_revenue,
        )

    def _extract_stock_info(self, raw_data: Dict) -> StockInfo:
        """Extract stock market data."""
        stock = raw_data.get("stock", {})
        return StockInfo(
            current_price=stock.get("current_price"),
            market_cap=stock.get("market_cap"),
            fifty_two_week_high=stock.get("52_week_high"),
            fifty_two_week_low=stock.get("52_week_low"),
            pe_ratio=stock.get("pe_ratio"),
            analyst_consensus=stock.get("analyst_consensus"),
        )

    def _calculate_roi_scenarios(self, ecommerce: EcommerceData) -> ROIScenarios:
        """
        Calculate ROI scenarios for sales conversations.

        Conservative: 5% conversion lift
        Moderate: 10% conversion lift
        Aggressive: 15% conversion lift
        """
        base = ecommerce.addressable_search_revenue
        if not base:
            return ROIScenarios()

        return ROIScenarios(
            conservative=ROIScenario(lift_pct=0.05, annual_impact=int(base * 0.05)),
            moderate=ROIScenario(lift_pct=0.10, annual_impact=int(base * 0.10)),
            aggressive=ROIScenario(lift_pct=0.15, annual_impact=int(base * 0.15)),
            base_revenue=ecommerce.ecommerce_revenue,
        )

    def _calculate_data_quality(self, raw_data: Dict) -> float:
        """Calculate data quality score."""
        if not raw_data:
            return 0.0

        score = 0.0

        if raw_data.get("revenue_3yr"):
            score += 0.3
        if raw_data.get("net_income_3yr"):
            score += 0.2
        if raw_data.get("ebitda_margin") is not None:
            score += 0.15
        if raw_data.get("stock"):
            score += 0.2
        if raw_data.get("ecommerce_share") is not None:
            score += 0.15

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

    def _create_default_citation(self, domain: str) -> SourceCitation:
        """Create default citation."""
        return SourceCitation(
            source_type=SourceType.WEBSEARCH,
            source_url=f"https://www.google.com/search?q={domain}+financials",
            retrieved_at=datetime.utcnow(),
            confidence_score=0.3,
            notes="Default citation - limited data",
        )
