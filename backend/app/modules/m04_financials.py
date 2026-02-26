"""
M04 Financial Profile Intelligence Module

Analyzes company financials from Yahoo Finance and SEC filings.
This is a Wave 1 (Foundation) module with no dependencies.

Data Sources:
- Yahoo Finance MCP (primary)
- WebSearch (secondary, for private companies)

Output: 3-year financial trends, margin zone classification, ROI modeling,
stock info, e-commerce revenue estimates, and analyst sentiment.

SOURCE CITATION MANDATE: Every data point MUST have source_url and source_date.
"""

import logging
import re
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field, field_validator

from .base import (
    BaseIntelligenceModule,
    ModuleResult,
    SourceInfo,
    register_module,
)
from ..services.validation import MissingSourceError, SourceFreshnessError
from ..services.api_client import yahoo_finance_client, APIClientError

logger = logging.getLogger(__name__)


# =============================================================================
# Enums and Constants
# =============================================================================


class MarginZone(str, Enum):
    """
    Margin zone classification based on EBITDA margin.

    RED:    <=10% - High pressure, need hard ROI proof
    YELLOW: 10-20% - Moderate pressure, efficiency gains valued
    GREEN:  >20% - Healthy, budget available
    """
    RED = "RED"
    YELLOW = "YELLOW"
    GREEN = "GREEN"


class RevenueTrend(str, Enum):
    """Revenue trend classification based on YoY change."""
    DECLINING = "declining"
    STABLE = "stable"
    GROWING = "growing"


class AnalystConsensus(str, Enum):
    """Analyst rating consensus."""
    STRONG_BUY = "STRONG_BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG_SELL"


# Margin zone thresholds
MARGIN_THRESHOLD_RED = 0.10
MARGIN_THRESHOLD_GREEN = 0.20

# ROI scenario lift percentages
ROI_LIFT_CONSERVATIVE = 0.05
ROI_LIFT_MODERATE = 0.10
ROI_LIFT_AGGRESSIVE = 0.15

# Digital revenue to search addressable multiplier (15%)
SEARCH_ADDRESSABLE_MULTIPLIER = 0.15


# =============================================================================
# Data Models
# =============================================================================


class FiscalYearRevenue(BaseModel):
    """Revenue data for a single fiscal year."""

    fiscal_year: str = Field(..., description="Fiscal year label (e.g., 'FY2024')")
    revenue: float = Field(..., description="Revenue in USD")
    yoy_change: Optional[float] = Field(None, description="Year-over-year change (decimal)")


class FiscalYearNetIncome(BaseModel):
    """Net income data for a single fiscal year."""

    fiscal_year: str = Field(..., description="Fiscal year label (e.g., 'FY2024')")
    net_income: float = Field(..., description="Net income in USD")
    margin: float = Field(..., description="Net income margin (decimal)")


class FinancialsData(BaseModel):
    """3-year financial trends."""

    revenue_3yr: List[FiscalYearRevenue] = Field(
        default_factory=list,
        description="Revenue data for last 3 fiscal years"
    )
    latest_revenue: Optional[float] = Field(None, description="Most recent annual revenue")
    revenue_trend: Optional[RevenueTrend] = Field(None, description="Revenue trend direction")
    net_income_3yr: List[FiscalYearNetIncome] = Field(
        default_factory=list,
        description="Net income data for last 3 fiscal years"
    )
    ebitda_margin: Optional[float] = Field(None, description="EBITDA margin (decimal)")
    operating_margin: Optional[float] = Field(None, description="Operating margin (decimal)")
    gross_margin: Optional[float] = Field(None, description="Gross margin (decimal)")


class MarginZoneData(BaseModel):
    """Margin zone classification for sales positioning."""

    classification: MarginZone = Field(..., description="Zone classification (RED/YELLOW/GREEN)")
    ebitda_margin: Optional[float] = Field(None, description="EBITDA margin used for classification")
    threshold_red: float = Field(default=MARGIN_THRESHOLD_RED, description="Red zone threshold")
    threshold_green: float = Field(default=MARGIN_THRESHOLD_GREEN, description="Green zone threshold")
    implication: str = Field(..., description="Sales implication for this zone")


class EcommerceData(BaseModel):
    """E-commerce specific financial data."""

    ecommerce_revenue: Optional[float] = Field(None, description="E-commerce revenue in USD")
    ecommerce_share: Optional[float] = Field(None, description="E-commerce as % of total revenue")
    ecommerce_growth_yoy: Optional[float] = Field(None, description="E-commerce YoY growth")
    digital_revenue_estimate: Optional[float] = Field(None, description="Estimated digital revenue")
    addressable_search_revenue: Optional[float] = Field(
        None,
        description="Addressable search revenue = digital_revenue * 15%"
    )


class StockInfo(BaseModel):
    """Stock information for public companies."""

    current_price: Optional[float] = Field(None, description="Current stock price")
    market_cap: Optional[float] = Field(None, description="Market capitalization")
    price_52_week_high: Optional[float] = Field(None, description="52-week high")
    price_52_week_low: Optional[float] = Field(None, description="52-week low")
    analyst_consensus: Optional[AnalystConsensus] = Field(None, description="Analyst consensus rating")
    analyst_target_price: Optional[float] = Field(None, description="Analyst target price")


class ROIScenario(BaseModel):
    """ROI scenario calculation."""

    lift_pct: float = Field(..., description="Conversion lift percentage")
    annual_impact: float = Field(..., description="Annual revenue impact in USD")


class ROIScenarios(BaseModel):
    """Conservative, moderate, and aggressive ROI scenarios."""

    conservative: ROIScenario
    moderate: ROIScenario
    aggressive: ROIScenario


class FinancialProfileData(BaseModel):
    """
    Financial Profile data model - output of M04 module.

    Captures 3-year financial trends, margin zone classification,
    and ROI modeling for sales positioning.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Company identifiers
    ticker: Optional[str] = Field(None, description="Stock ticker symbol")
    exchange: Optional[str] = Field(None, description="Stock exchange (NYSE, NASDAQ, etc.)")
    is_public: bool = Field(default=False, description="Is publicly traded company")
    fiscal_year_end: Optional[str] = Field(None, description="Fiscal year end date")

    # Financial data
    financials: Optional[FinancialsData] = Field(None, description="3-year financial trends")

    # Margin zone classification
    margin_zone: Optional[MarginZoneData] = Field(None, description="Margin zone for sales positioning")

    # E-commerce specifics
    ecommerce: Optional[EcommerceData] = Field(None, description="E-commerce financial data")

    # Stock information
    stock_info: Optional[StockInfo] = Field(None, description="Stock information (public companies)")

    # ROI scenarios
    roi_scenarios: Optional[ROIScenarios] = Field(None, description="ROI scenario calculations")

    # Revenue metrics (top-level for easy access)
    revenue_current: Optional[float] = Field(None, description="Current annual revenue")
    revenue_growth_yoy: Optional[float] = Field(None, description="Revenue growth YoY")

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: Optional[str]) -> Optional[str]:
        """Normalize ticker to uppercase."""
        if v is not None:
            return v.upper()
        return v


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M04FinancialProfileModule(BaseIntelligenceModule):
    """
    M04: Financial Profile - 3-year financial trends and ROI modeling.

    Wave 1 (Foundation) module with no dependencies.
    Collects financial data from Yahoo Finance and SEC filings.
    """

    MODULE_ID = "m04_financials"
    MODULE_NAME = "Financial Profile"
    WAVE = 1
    DEPENDS_ON = []
    SOURCE_TYPE = "api"
    CACHE_TTL = 86400  # 24 hours for financial data

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform enrichment for a domain.

        Args:
            domain: The domain to enrich (e.g., "sallybeauty.com")
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with FinancialProfileData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Enriching financial profile for: {domain}")

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
        financial_data = await self._validate_and_store(domain, transformed)

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
            data=financial_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(f"Successfully enriched financial profile for: {domain}")
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch raw data from Yahoo Finance and WebSearch.

        Attempts Yahoo Finance first (primary source), then WebSearch
        for private companies or to fill gaps.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with merged data from all sources
        """
        yahoo_data = {}
        websearch_data = {}
        errors = []

        # Resolve ticker from domain
        ticker = await self._resolve_ticker(domain)

        # Try Yahoo Finance (primary) if ticker found
        if ticker:
            try:
                yahoo_data = await self._fetch_from_yahoo_finance(ticker, domain)
                self.logger.debug(f"Yahoo Finance returned data for: {ticker}")
            except Exception as e:
                self.logger.warning(f"Yahoo Finance fetch failed for {ticker}: {e}")
                errors.append(f"Yahoo Finance: {e}")

        # Try WebSearch (secondary/fallback for private companies)
        try:
            websearch_data = await self._fetch_from_websearch(domain)
            self.logger.debug(f"WebSearch returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"WebSearch fetch failed for {domain}: {e}")
            errors.append(f"WebSearch: {e}")

        # If both sources failed, raise error
        if not yahoo_data and not websearch_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        # Merge data from both sources
        merged = await self._merge_sources(yahoo_data, websearch_data)

        return merged

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into FinancialProfileData schema.

        Args:
            raw_data: Raw merged data from fetch_data()

        Returns:
            Transformed data matching FinancialProfileData fields
        """
        # Calculate margin zone
        ebitda_margin = raw_data.get("ebitda_margin")
        margin_zone = self._calculate_margin_zone(ebitda_margin)

        # Calculate ROI scenarios
        addressable_search_revenue = raw_data.get("addressable_search_revenue")
        roi_scenarios = self._calculate_roi_scenarios(addressable_search_revenue)

        # Build financials nested object
        financials = {
            "revenue_3yr": raw_data.get("revenue_3yr", []),
            "latest_revenue": raw_data.get("latest_revenue"),
            "revenue_trend": raw_data.get("revenue_trend"),
            "net_income_3yr": raw_data.get("net_income_3yr", []),
            "ebitda_margin": ebitda_margin,
            "operating_margin": raw_data.get("operating_margin"),
            "gross_margin": raw_data.get("gross_margin"),
        }

        # Build ecommerce nested object
        ecommerce = {
            "ecommerce_revenue": raw_data.get("ecommerce_revenue"),
            "ecommerce_share": raw_data.get("ecommerce_share"),
            "ecommerce_growth_yoy": raw_data.get("ecommerce_growth_yoy"),
            "digital_revenue_estimate": raw_data.get("digital_revenue_estimate"),
            "addressable_search_revenue": addressable_search_revenue,
        }

        # Build stock_info nested object
        stock_info = {
            "current_price": raw_data.get("current_price"),
            "market_cap": raw_data.get("market_cap"),
            "price_52_week_high": raw_data.get("price_52_week_high"),
            "price_52_week_low": raw_data.get("price_52_week_low"),
            "analyst_consensus": raw_data.get("analyst_consensus"),
            "analyst_target_price": raw_data.get("analyst_target_price"),
        }

        return {
            "domain": raw_data.get("domain"),
            "ticker": raw_data.get("ticker"),
            "exchange": raw_data.get("exchange"),
            "is_public": raw_data.get("is_public", False),
            "fiscal_year_end": raw_data.get("fiscal_year_end"),
            "financials": financials,
            "margin_zone": margin_zone,
            "ecommerce": ecommerce,
            "stock_info": stock_info,
            "roi_scenarios": roi_scenarios,
            "revenue_current": raw_data.get("latest_revenue"),
            "revenue_growth_yoy": raw_data.get("revenue_growth_yoy"),
            # Preserve source info for result creation
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _resolve_ticker(self, domain: str) -> Optional[str]:
        """
        Resolve stock ticker from domain name.

        In production, this uses WebSearch to find the ticker.

        Args:
            domain: Domain like "sallybeauty.com"

        Returns:
            Ticker symbol or None if not found/private company
        """
        # Known ticker mappings (would come from database in production)
        ticker_mappings = {
            "sallybeauty.com": "SBH",
            "costco.com": "COST",
            "therealreal.com": "REAL",
            "coach.com": "TPR",  # Tapestry
            "tapestry.com": "TPR",
            "walmart.com": "WMT",
            "target.com": "TGT",
            "amazon.com": "AMZN",
            "apple.com": "AAPL",
            "google.com": "GOOGL",
            "microsoft.com": "MSFT",
            "sephora.com": None,  # LVMH subsidiary, not direct ticker
            "ulta.com": "ULTA",
        }

        # Try direct mapping
        if domain in ticker_mappings:
            return ticker_mappings[domain]

        # Try WebSearch for unknown domains
        try:
            company_name = self._infer_company_name(domain)
            # In production: WebSearch for "{company_name} stock ticker"
            return None
        except Exception:
            return None

    async def _fetch_from_yahoo_finance(
        self,
        ticker: str,
        domain: str
    ) -> Dict[str, Any]:
        """
        Fetch financial data from Yahoo Finance API.

        In production, this calls the Yahoo Finance MCP.
        For now, returns mock data.

        Args:
            ticker: Stock ticker symbol
            domain: Company domain

        Returns:
            dict with Yahoo Finance data and source citation
        """
        return await self._call_yahoo_finance_api(ticker, domain)

    async def _call_yahoo_finance_api(
        self,
        ticker: str,
        domain: str
    ) -> Dict[str, Any]:
        """
        Call Yahoo Finance API via the API client.

        Uses the YahooFinanceClient from services/api_client.py
        to fetch real financial data.

        Args:
            ticker: Stock ticker symbol (e.g., "COST")
            domain: Company domain for source attribution

        Returns:
            Dict with financial data and source citation

        Raises:
            APIClientError: If the API request fails
        """
        try:
            return await yahoo_finance_client.get_financials(ticker, domain)
        except APIClientError as e:
            self.logger.error(f"Yahoo Finance API failed for {ticker}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error calling Yahoo Finance for {ticker}: {e}")
            raise APIClientError(f"Yahoo Finance request failed: {e}")

    async def _fetch_from_websearch(self, domain: str) -> Dict[str, Any]:
        """
        Fetch financial data from WebSearch.

        Used for private companies or to supplement Yahoo Finance data.

        Args:
            domain: The domain to research

        Returns:
            dict with WebSearch data and source citation
        """
        return await self._call_websearch_api(domain)

    async def _call_websearch_api(self, domain: str) -> Dict[str, Any]:
        """
        Call WebSearch API (mock implementation).

        In production, this will search for company financial info.
        """
        now = datetime.now()

        return {
            "ecommerce_revenue": 446000000,
            "ecommerce_share": 0.12,
            "ecommerce_growth_yoy": 0.11,
            "digital_revenue_estimate": 446000000,
            "addressable_search_revenue": 66900000,  # 446M * 0.15
            "source_url": f"https://www.{domain}/investor-relations/",
            "source_date": now.isoformat(),
        }

    async def _merge_sources(
        self,
        yahoo_data: Dict[str, Any],
        websearch_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge data from Yahoo Finance and WebSearch sources.

        Priority: Yahoo Finance wins for overlapping fields.
        WebSearch fills in fields not present in Yahoo Finance.

        Args:
            yahoo_data: Data from Yahoo Finance API
            websearch_data: Data from WebSearch

        Returns:
            Merged data dictionary with source citation
        """
        merged = {}

        # Start with WebSearch data as base (lower priority)
        if websearch_data:
            merged.update(websearch_data)

        # Override with Yahoo Finance data (higher priority)
        if yahoo_data:
            for key, value in yahoo_data.items():
                if value is not None:
                    merged[key] = value

        # Calculate addressable search revenue if not present
        if not merged.get("addressable_search_revenue"):
            digital_revenue = merged.get("digital_revenue_estimate") or merged.get("ecommerce_revenue")
            if digital_revenue:
                merged["addressable_search_revenue"] = digital_revenue * SEARCH_ADDRESSABLE_MULTIPLIER

        # Ensure we have a source_url (prefer Yahoo Finance)
        if yahoo_data.get("source_url"):
            merged["source_url"] = yahoo_data["source_url"]
            merged["source_date"] = yahoo_data.get("source_date")
        elif websearch_data.get("source_url"):
            merged["source_url"] = websearch_data["source_url"]
            merged["source_date"] = websearch_data.get("source_date")

        return merged

    def _calculate_margin_zone(
        self,
        ebitda_margin: Optional[float]
    ) -> Optional[Dict[str, Any]]:
        """
        Calculate margin zone classification.

        RED:    <=10% - High pressure, need hard ROI proof
        YELLOW: 10-20% - Moderate pressure, efficiency gains valued
        GREEN:  >20% - Healthy, budget available

        Args:
            ebitda_margin: EBITDA margin as decimal

        Returns:
            MarginZoneData dict or None
        """
        if ebitda_margin is None:
            return None

        if ebitda_margin <= MARGIN_THRESHOLD_RED:
            classification = MarginZone.RED
            implication = "High margin pressure - need hard ROI proof"
        elif ebitda_margin <= MARGIN_THRESHOLD_GREEN:
            classification = MarginZone.YELLOW
            implication = "Moderate margin pressure - efficiency gains valued"
        else:
            classification = MarginZone.GREEN
            implication = "Healthy margins - budget available for investment"

        return {
            "classification": classification.value,
            "ebitda_margin": ebitda_margin,
            "threshold_red": MARGIN_THRESHOLD_RED,
            "threshold_green": MARGIN_THRESHOLD_GREEN,
            "implication": implication,
        }

    def _calculate_roi_scenarios(
        self,
        addressable_search_revenue: Optional[float]
    ) -> Optional[Dict[str, Any]]:
        """
        Calculate ROI scenarios based on addressable search revenue.

        Args:
            addressable_search_revenue: Addressable search revenue in USD

        Returns:
            ROIScenarios dict or None
        """
        if addressable_search_revenue is None:
            return None

        return {
            "conservative": {
                "lift_pct": ROI_LIFT_CONSERVATIVE,
                "annual_impact": addressable_search_revenue * ROI_LIFT_CONSERVATIVE,
            },
            "moderate": {
                "lift_pct": ROI_LIFT_MODERATE,
                "annual_impact": addressable_search_revenue * ROI_LIFT_MODERATE,
            },
            "aggressive": {
                "lift_pct": ROI_LIFT_AGGRESSIVE,
                "annual_impact": addressable_search_revenue * ROI_LIFT_AGGRESSIVE,
            },
        }

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> FinancialProfileData:
        """
        Validate transformed data and create FinancialProfileData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated FinancialProfileData model

        Raises:
            ValueError: If domain mismatch or validation fails
        """
        # Validate domain matches
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Build nested models
        financials = None
        if transformed_data.get("financials"):
            fin_data = transformed_data["financials"]
            financials = FinancialsData(
                revenue_3yr=[FiscalYearRevenue(**r) for r in fin_data.get("revenue_3yr", [])],
                latest_revenue=fin_data.get("latest_revenue"),
                revenue_trend=fin_data.get("revenue_trend"),
                net_income_3yr=[FiscalYearNetIncome(**n) for n in fin_data.get("net_income_3yr", [])],
                ebitda_margin=fin_data.get("ebitda_margin"),
                operating_margin=fin_data.get("operating_margin"),
                gross_margin=fin_data.get("gross_margin"),
            )

        margin_zone = None
        if transformed_data.get("margin_zone"):
            mz_data = transformed_data["margin_zone"]
            margin_zone = MarginZoneData(
                classification=MarginZone(mz_data["classification"]),
                ebitda_margin=mz_data.get("ebitda_margin"),
                threshold_red=mz_data.get("threshold_red", MARGIN_THRESHOLD_RED),
                threshold_green=mz_data.get("threshold_green", MARGIN_THRESHOLD_GREEN),
                implication=mz_data["implication"],
            )

        ecommerce = None
        if transformed_data.get("ecommerce"):
            ec_data = transformed_data["ecommerce"]
            ecommerce = EcommerceData(
                ecommerce_revenue=ec_data.get("ecommerce_revenue"),
                ecommerce_share=ec_data.get("ecommerce_share"),
                ecommerce_growth_yoy=ec_data.get("ecommerce_growth_yoy"),
                digital_revenue_estimate=ec_data.get("digital_revenue_estimate"),
                addressable_search_revenue=ec_data.get("addressable_search_revenue"),
            )

        stock_info = None
        if transformed_data.get("stock_info"):
            si_data = transformed_data["stock_info"]
            analyst_consensus = None
            if si_data.get("analyst_consensus"):
                try:
                    analyst_consensus = AnalystConsensus(si_data["analyst_consensus"])
                except ValueError:
                    # Handle non-standard consensus values
                    pass
            stock_info = StockInfo(
                current_price=si_data.get("current_price"),
                market_cap=si_data.get("market_cap"),
                price_52_week_high=si_data.get("price_52_week_high"),
                price_52_week_low=si_data.get("price_52_week_low"),
                analyst_consensus=analyst_consensus,
                analyst_target_price=si_data.get("analyst_target_price"),
            )

        roi_scenarios = None
        if transformed_data.get("roi_scenarios"):
            roi_data = transformed_data["roi_scenarios"]
            roi_scenarios = ROIScenarios(
                conservative=ROIScenario(**roi_data["conservative"]),
                moderate=ROIScenario(**roi_data["moderate"]),
                aggressive=ROIScenario(**roi_data["aggressive"]),
            )

        # Create data model (Pydantic validates the schema)
        return FinancialProfileData(
            domain=domain,
            ticker=transformed_data.get("ticker"),
            exchange=transformed_data.get("exchange"),
            is_public=transformed_data.get("is_public", False),
            fiscal_year_end=transformed_data.get("fiscal_year_end"),
            financials=financials,
            margin_zone=margin_zone,
            ecommerce=ecommerce,
            stock_info=stock_info,
            roi_scenarios=roi_scenarios,
            revenue_current=transformed_data.get("revenue_current"),
            revenue_growth_yoy=transformed_data.get("revenue_growth_yoy"),
        )

    def _infer_company_name(self, domain: str) -> str:
        """
        Infer company name from domain.

        Used as fallback when API doesn't return company name.

        Args:
            domain: Domain like "sallybeauty.com"

        Returns:
            Inferred company name like "Sally Beauty Inc."
        """
        # Remove TLD
        name = domain.split(".")[0]

        # Split camelCase and add spaces
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)

        # Capitalize words
        name = " ".join(word.capitalize() for word in name.split())

        return f"{name} Inc."
