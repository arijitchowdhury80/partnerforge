"""
M04 Financial Profile Intelligence Module

3-year financial trends, margin zone classification, and ROI modeling.
This is a Wave 1 (Foundation) module with no dependencies.

Data Sources:
- Yahoo Finance MCP (primary): stock info, financials, balance sheet, cash flow
- SEC EDGAR (10-K, 10-Q filings via WebFetch)
- WebSearch for press releases (private companies)

Output: Revenue trends, profitability metrics, margin zone classification,
and Algolia ROI potential calculations.

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
# Margin Zone Thresholds
# =============================================================================

MARGIN_THRESHOLDS = {
    "green": 0.20,  # >20% EBITDA margin = healthy
    "yellow": 0.10,  # 10-20% = moderate pressure
    "red": 0.10,  # <10% = high pressure
}


# =============================================================================
# Data Models
# =============================================================================

class RevenueYearData(BaseModel):
    """Revenue data for a single fiscal year."""
    fiscal_year: str
    revenue: float
    yoy_change: Optional[float] = None


class ROIScenario(BaseModel):
    """ROI scenario calculation."""
    lift_pct: float
    annual_impact: float


class FinancialProfileData(BaseModel):
    """
    Financial Profile data model - output of M04 module.

    Captures 3-year financial trends and ROI potential.
    """

    # Required fields
    domain: str = Field(..., description="Primary domain (e.g., 'sallybeauty.com')")

    # Company identification
    ticker: Optional[str] = Field(None, description="Stock ticker symbol")
    exchange: Optional[str] = Field(None, description="Stock exchange (NYSE, NASDAQ)")
    is_public: bool = Field(False, description="Whether company is publicly traded")

    # Revenue (3-year trend)
    revenue_current: Optional[float] = Field(None, description="Current year revenue (USD)")
    revenue_current_formatted: Optional[str] = Field(None, description="Human-readable revenue")
    revenue_prior_year: Optional[float] = Field(None, description="Prior year revenue")
    revenue_2_years_ago: Optional[float] = Field(None, description="2 years ago revenue")
    revenue_cagr: Optional[float] = Field(None, description="3-year revenue CAGR")
    revenue_3yr: List[RevenueYearData] = Field(
        default_factory=list, description="3-year revenue trend"
    )
    revenue_trend: Optional[str] = Field(
        None, description="Trend direction (growing/stable/declining)"
    )
    fiscal_year_end: Optional[str] = Field(None, description="Fiscal year end date")

    # Profitability
    gross_margin: Optional[float] = Field(None, description="Gross margin (0.0-1.0)")
    operating_margin: Optional[float] = Field(None, description="Operating margin")
    net_margin: Optional[float] = Field(None, description="Net margin")
    ebitda: Optional[float] = Field(None, description="EBITDA (USD)")
    ebitda_margin: Optional[float] = Field(None, description="EBITDA margin")

    # Margin zone analysis
    margin_zone: Optional[str] = Field(
        None, description="Margin zone (green/yellow/red)"
    )
    margin_zone_description: Optional[str] = Field(
        None, description="Margin zone sales implication"
    )
    margin_pressure: bool = Field(False, description="Whether margin pressure exists")

    # E-commerce specific
    ecommerce_revenue: Optional[float] = Field(None, description="E-commerce revenue")
    ecommerce_percent: Optional[float] = Field(None, description="E-commerce % of total")
    digital_revenue: Optional[float] = Field(None, description="Digital revenue")
    digital_percent: Optional[float] = Field(None, description="Digital % of total")

    # Stock metrics (if public)
    market_cap: Optional[float] = Field(None, description="Market capitalization")
    market_cap_formatted: Optional[str] = Field(None, description="Human-readable market cap")
    stock_price: Optional[float] = Field(None, description="Current stock price")
    price_change_ytd: Optional[float] = Field(None, description="YTD price change %")
    price_change_1y: Optional[float] = Field(None, description="1-year price change %")

    # Analyst sentiment
    analyst_rating: Optional[str] = Field(None, description="Analyst consensus rating")
    analyst_target_price: Optional[float] = Field(None, description="Analyst target price")
    analyst_count: Optional[int] = Field(None, description="Number of analysts covering")

    # Employee data
    employee_count: Optional[int] = Field(None, description="Number of employees")

    # ROI calculation
    addressable_revenue: Optional[float] = Field(
        None, description="Addressable search revenue (Digital Revenue x 15%)"
    )
    addressable_revenue_formatted: Optional[str] = Field(None)
    roi_scenario_low: Optional[ROIScenario] = Field(
        None, description="Conservative ROI (2% lift)"
    )
    roi_scenario_mid: Optional[ROIScenario] = Field(
        None, description="Moderate ROI (5% lift)"
    )
    roi_scenario_high: Optional[ROIScenario] = Field(
        None, description="Aggressive ROI (10% lift)"
    )

    # Financial score for ICP
    financial_score: int = Field(0, description="Financial score for ICP (0-20)")


# =============================================================================
# Module Implementation
# =============================================================================

@register_module
class M04FinancialProfileModule(BaseIntelligenceModule):
    """
    M04: Financial Profile - revenue, margins, and ROI estimates.

    Wave 1 (Foundation) module with no dependencies.
    Collects financial data from Yahoo Finance API.
    """

    MODULE_ID = "m04_financial_profile"
    MODULE_NAME = "Financial Profile"
    WAVE = 1
    DEPENDS_ON = []
    SOURCE_TYPE = "api"
    CACHE_TTL = 86400  # 1 day (financial data changes frequently)

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
        Fetch raw data from Yahoo Finance API.

        First attempts to resolve ticker from domain, then fetches financials.

        Args:
            domain: The domain to fetch data for

        Returns:
            dict with financial data and source citation
        """
        yahoo_data = {}
        websearch_data = {}
        errors = []

        # Try to resolve ticker and fetch from Yahoo Finance
        try:
            ticker = await self._resolve_ticker(domain)
            if ticker:
                yahoo_data = await self._fetch_from_yahoo_finance(ticker, domain)
                self.logger.debug(f"Yahoo Finance returned data for: {domain}")
        except Exception as e:
            self.logger.warning(f"Yahoo Finance fetch failed for {domain}: {e}")
            errors.append(f"Yahoo Finance: {e}")

        # If Yahoo Finance fails (private company), try WebSearch
        if not yahoo_data:
            try:
                websearch_data = await self._fetch_from_websearch(domain)
                self.logger.debug(f"WebSearch returned data for: {domain}")
            except Exception as e:
                self.logger.warning(f"WebSearch fetch failed for {domain}: {e}")
                errors.append(f"WebSearch: {e}")

        # If both fail, raise error
        if not yahoo_data and not websearch_data:
            raise Exception(
                f"Failed to enrich {domain}. All sources failed: {'; '.join(errors)}"
            )

        return yahoo_data if yahoo_data else websearch_data

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw API data into FinancialProfileData schema.

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data matching FinancialProfileData fields
        """
        # Extract revenue data
        revenue_current = raw_data.get("revenue_current")
        revenue_prior = raw_data.get("revenue_prior_year")
        revenue_2y_ago = raw_data.get("revenue_2_years_ago")

        # Calculate CAGR if we have 3 years of data
        revenue_cagr = None
        if revenue_current and revenue_2y_ago and revenue_2y_ago > 0:
            revenue_cagr = ((revenue_current / revenue_2y_ago) ** (1 / 2)) - 1

        # Determine revenue trend
        revenue_trend = self._determine_trend(revenue_current, revenue_prior)

        # Build 3-year revenue list
        revenue_3yr = []
        if revenue_2y_ago:
            revenue_3yr.append(RevenueYearData(
                fiscal_year="FY-2",
                revenue=revenue_2y_ago,
                yoy_change=None,
            ))
        if revenue_prior:
            yoy = None
            if revenue_2y_ago and revenue_2y_ago > 0:
                yoy = (revenue_prior - revenue_2y_ago) / revenue_2y_ago
            revenue_3yr.append(RevenueYearData(
                fiscal_year="FY-1",
                revenue=revenue_prior,
                yoy_change=yoy,
            ))
        if revenue_current:
            yoy = None
            if revenue_prior and revenue_prior > 0:
                yoy = (revenue_current - revenue_prior) / revenue_prior
            revenue_3yr.append(RevenueYearData(
                fiscal_year="FY",
                revenue=revenue_current,
                yoy_change=yoy,
            ))

        # Calculate margin zone
        ebitda_margin = raw_data.get("ebitda_margin")
        margin_zone, margin_zone_description = self._classify_margin_zone(ebitda_margin)
        margin_pressure = margin_zone in ["red", "yellow"]

        # Calculate e-commerce/addressable revenue
        ecommerce_revenue = raw_data.get("ecommerce_revenue")
        ecommerce_percent = raw_data.get("ecommerce_percent")

        # If no explicit e-commerce data, estimate as 15% of revenue
        if not ecommerce_revenue and revenue_current:
            ecommerce_revenue = revenue_current * 0.15
            ecommerce_percent = 0.15

        # Addressable revenue = e-commerce revenue * 15% (search attribution)
        addressable_revenue = None
        if ecommerce_revenue:
            addressable_revenue = ecommerce_revenue * 0.15

        # Calculate ROI scenarios
        roi_low = roi_mid = roi_high = None
        if addressable_revenue:
            roi_low = ROIScenario(lift_pct=0.02, annual_impact=addressable_revenue * 0.02)
            roi_mid = ROIScenario(lift_pct=0.05, annual_impact=addressable_revenue * 0.05)
            roi_high = ROIScenario(lift_pct=0.10, annual_impact=addressable_revenue * 0.10)

        # Calculate financial score for ICP
        financial_score = self._calculate_financial_score(
            revenue_current, margin_zone, revenue_trend
        )

        # Format large numbers
        revenue_formatted = self._format_currency(revenue_current)
        market_cap_formatted = self._format_currency(raw_data.get("market_cap"))
        addressable_formatted = self._format_currency(addressable_revenue)

        return {
            "domain": raw_data.get("domain"),
            "ticker": raw_data.get("ticker"),
            "exchange": raw_data.get("exchange"),
            "is_public": raw_data.get("is_public", False),
            "revenue_current": revenue_current,
            "revenue_current_formatted": revenue_formatted,
            "revenue_prior_year": revenue_prior,
            "revenue_2_years_ago": revenue_2y_ago,
            "revenue_cagr": revenue_cagr,
            "revenue_3yr": [r.model_dump() for r in revenue_3yr],
            "revenue_trend": revenue_trend,
            "fiscal_year_end": raw_data.get("fiscal_year_end"),
            "gross_margin": raw_data.get("gross_margin"),
            "operating_margin": raw_data.get("operating_margin"),
            "net_margin": raw_data.get("net_margin"),
            "ebitda": raw_data.get("ebitda"),
            "ebitda_margin": ebitda_margin,
            "margin_zone": margin_zone,
            "margin_zone_description": margin_zone_description,
            "margin_pressure": margin_pressure,
            "ecommerce_revenue": ecommerce_revenue,
            "ecommerce_percent": ecommerce_percent,
            "digital_revenue": raw_data.get("digital_revenue"),
            "digital_percent": raw_data.get("digital_percent"),
            "market_cap": raw_data.get("market_cap"),
            "market_cap_formatted": market_cap_formatted,
            "stock_price": raw_data.get("stock_price"),
            "price_change_ytd": raw_data.get("price_change_ytd"),
            "price_change_1y": raw_data.get("price_change_1y"),
            "analyst_rating": raw_data.get("analyst_rating"),
            "analyst_target_price": raw_data.get("analyst_target_price"),
            "analyst_count": raw_data.get("analyst_count"),
            "employee_count": raw_data.get("employee_count"),
            "addressable_revenue": addressable_revenue,
            "addressable_revenue_formatted": addressable_formatted,
            "roi_scenario_low": roi_low.model_dump() if roi_low else None,
            "roi_scenario_mid": roi_mid.model_dump() if roi_mid else None,
            "roi_scenario_high": roi_high.model_dump() if roi_high else None,
            "financial_score": financial_score,
            # Preserve source info
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    async def _resolve_ticker(self, domain: str) -> Optional[str]:
        """
        Resolve stock ticker from domain.

        In production, this uses WebSearch to find the ticker.
        """
        # Mock ticker resolution based on common domains
        ticker_map = {
            "costco.com": "COST",
            "sallybeauty.com": "SBH",
            "walmart.com": "WMT",
            "target.com": "TGT",
            "amazon.com": "AMZN",
            "bestbuy.com": "BBY",
            "homedepot.com": "HD",
            "lowes.com": "LOW",
        }
        return ticker_map.get(domain)

    async def _fetch_from_yahoo_finance(
        self, ticker: str, domain: str
    ) -> Dict[str, Any]:
        """
        Fetch financial data from Yahoo Finance API.

        In production, this calls the Yahoo Finance MCP.
        For now, returns mock data.
        """
        return await self._call_yahoo_finance_api(ticker, domain)

    async def _call_yahoo_finance_api(
        self, ticker: str, domain: str
    ) -> Dict[str, Any]:
        """
        Call Yahoo Finance API (mock implementation).

        In production, this will use the Yahoo Finance MCP server.
        """
        now = datetime.now()

        # Mock response matching expected Yahoo Finance structure
        return {
            "domain": domain,
            "ticker": ticker,
            "exchange": "NYSE",
            "is_public": True,
            "revenue_current": 3720000000,
            "revenue_prior_year": 3730000000,
            "revenue_2_years_ago": 3820000000,
            "fiscal_year_end": "September 30",
            "gross_margin": 0.51,
            "operating_margin": 0.094,
            "net_margin": 0.053,
            "ebitda": 468720000,
            "ebitda_margin": 0.126,
            "ecommerce_revenue": 446400000,
            "ecommerce_percent": 0.12,
            "market_cap": 1800000000,
            "stock_price": 17.05,
            "price_change_ytd": 0.05,
            "price_change_1y": -0.12,
            "analyst_rating": "Hold",
            "analyst_target_price": 18.50,
            "analyst_count": 12,
            "employee_count": 27000,
            "source_url": f"https://finance.yahoo.com/quote/{ticker}/",
            "source_date": now.isoformat(),
        }

    async def _fetch_from_websearch(self, domain: str) -> Dict[str, Any]:
        """
        Fetch financial estimates for private companies via WebSearch.
        """
        now = datetime.now()

        # Mock response for private companies
        return {
            "domain": domain,
            "is_public": False,
            "revenue_current": 100000000,  # Estimate
            "gross_margin": 0.40,
            "operating_margin": 0.10,
            "ebitda_margin": 0.12,
            "source_url": f"https://www.{domain}/about/",
            "source_date": now.isoformat(),
        }

    async def _validate_and_store(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> FinancialProfileData:
        """
        Validate transformed data and create FinancialProfileData model.
        """
        data_domain = transformed_data.get("domain")
        if data_domain and data_domain != domain:
            raise ValueError(
                f"Domain mismatch: requested '{domain}' but got '{data_domain}'"
            )

        # Convert nested dicts back to models
        revenue_3yr = [
            RevenueYearData(**r) for r in transformed_data.get("revenue_3yr", [])
        ]

        roi_low = roi_mid = roi_high = None
        if transformed_data.get("roi_scenario_low"):
            roi_low = ROIScenario(**transformed_data["roi_scenario_low"])
        if transformed_data.get("roi_scenario_mid"):
            roi_mid = ROIScenario(**transformed_data["roi_scenario_mid"])
        if transformed_data.get("roi_scenario_high"):
            roi_high = ROIScenario(**transformed_data["roi_scenario_high"])

        return FinancialProfileData(
            domain=domain,
            ticker=transformed_data.get("ticker"),
            exchange=transformed_data.get("exchange"),
            is_public=transformed_data.get("is_public", False),
            revenue_current=transformed_data.get("revenue_current"),
            revenue_current_formatted=transformed_data.get("revenue_current_formatted"),
            revenue_prior_year=transformed_data.get("revenue_prior_year"),
            revenue_2_years_ago=transformed_data.get("revenue_2_years_ago"),
            revenue_cagr=transformed_data.get("revenue_cagr"),
            revenue_3yr=revenue_3yr,
            revenue_trend=transformed_data.get("revenue_trend"),
            fiscal_year_end=transformed_data.get("fiscal_year_end"),
            gross_margin=transformed_data.get("gross_margin"),
            operating_margin=transformed_data.get("operating_margin"),
            net_margin=transformed_data.get("net_margin"),
            ebitda=transformed_data.get("ebitda"),
            ebitda_margin=transformed_data.get("ebitda_margin"),
            margin_zone=transformed_data.get("margin_zone"),
            margin_zone_description=transformed_data.get("margin_zone_description"),
            margin_pressure=transformed_data.get("margin_pressure", False),
            ecommerce_revenue=transformed_data.get("ecommerce_revenue"),
            ecommerce_percent=transformed_data.get("ecommerce_percent"),
            digital_revenue=transformed_data.get("digital_revenue"),
            digital_percent=transformed_data.get("digital_percent"),
            market_cap=transformed_data.get("market_cap"),
            market_cap_formatted=transformed_data.get("market_cap_formatted"),
            stock_price=transformed_data.get("stock_price"),
            price_change_ytd=transformed_data.get("price_change_ytd"),
            price_change_1y=transformed_data.get("price_change_1y"),
            analyst_rating=transformed_data.get("analyst_rating"),
            analyst_target_price=transformed_data.get("analyst_target_price"),
            analyst_count=transformed_data.get("analyst_count"),
            employee_count=transformed_data.get("employee_count"),
            addressable_revenue=transformed_data.get("addressable_revenue"),
            addressable_revenue_formatted=transformed_data.get("addressable_revenue_formatted"),
            roi_scenario_low=roi_low,
            roi_scenario_mid=roi_mid,
            roi_scenario_high=roi_high,
            financial_score=transformed_data.get("financial_score", 0),
        )

    def _classify_margin_zone(
        self, ebitda_margin: Optional[float]
    ) -> tuple[Optional[str], Optional[str]]:
        """Classify EBITDA margin into zone with sales implication."""
        if ebitda_margin is None:
            return None, None

        if ebitda_margin > MARGIN_THRESHOLDS["green"]:
            return "green", "Healthy margins - budget available"
        elif ebitda_margin > MARGIN_THRESHOLDS["yellow"]:
            return "yellow", "Moderate margin pressure - efficiency gains valued"
        else:
            return "red", "High margin pressure - need hard ROI proof"

    def _determine_trend(
        self,
        current: Optional[float],
        prior: Optional[float]
    ) -> Optional[str]:
        """Determine revenue trend direction."""
        if current is None or prior is None:
            return None
        if current > prior * 1.05:
            return "growing"
        elif current < prior * 0.95:
            return "declining"
        else:
            return "stable"

    def _calculate_financial_score(
        self,
        revenue: Optional[float],
        margin_zone: Optional[str],
        revenue_trend: Optional[str]
    ) -> int:
        """Calculate financial score for ICP scoring (0-20)."""
        score = 0

        # Revenue size component (0-10)
        if revenue:
            if revenue >= 1_000_000_000:  # $1B+
                score += 10
            elif revenue >= 500_000_000:  # $500M+
                score += 8
            elif revenue >= 100_000_000:  # $100M+
                score += 6
            elif revenue >= 50_000_000:  # $50M+
                score += 4
            else:
                score += 2

        # Margin zone component (0-5)
        if margin_zone == "green":
            score += 5
        elif margin_zone == "yellow":
            score += 3
        elif margin_zone == "red":
            score += 1

        # Revenue trend component (0-5)
        if revenue_trend == "growing":
            score += 5
        elif revenue_trend == "stable":
            score += 3
        elif revenue_trend == "declining":
            score += 1

        return min(score, 20)  # Cap at 20

    def _format_currency(self, amount: Optional[float]) -> Optional[str]:
        """Format currency amounts for human readability."""
        if amount is None:
            return None
        if amount >= 1_000_000_000:
            return f"${amount / 1_000_000_000:.1f}B"
        elif amount >= 1_000_000:
            return f"${amount / 1_000_000:.0f}M"
        elif amount >= 1_000:
            return f"${amount / 1_000:.0f}K"
        return f"${amount:.0f}"
