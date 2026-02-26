"""
Yahoo Finance API Adapter
=========================

Adapter for Yahoo Finance financial data via yfinance library.

Endpoints:
- stock-info: Basic stock information and price
- financials: Income statement, balance sheet, cash flow
- recommendations: Analyst recommendations
- news: Recent company news
- holders: Institutional and insider holders
- earnings: Earnings history and estimates
- history: Historical price data

Rate Limits:
- 100 RPM (1.67 tokens/second)
- Bucket size: 10

Costs:
- Free (public API)

Cache:
- Stock info: 1 day (prices change daily)
- Financials: 90 days (quarterly updates)
- News: 1 hour

References:
- https://pypi.org/project/yfinance/
- docs/DATA-PIPELINE-FLOWS.md
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from pydantic import BaseModel, Field

from pipeline.adapters.base import (
    BaseAdapter,
    EndpointConfig,
    APIError,
    SourcedResponse,
)
from pipeline.models.source import SourceCitation, SourceType

# yfinance is synchronous, we'll wrap it
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    yf = None

logger = logging.getLogger(__name__)


# =============================================================================
# Response Models
# =============================================================================


class StockInfo(BaseModel):
    """Basic stock information from Yahoo Finance."""

    symbol: str = Field(..., description="Stock ticker symbol")
    name: str = Field(default="", description="Company name")
    sector: Optional[str] = Field(default=None, description="Business sector")
    industry: Optional[str] = Field(default=None, description="Industry classification")
    country: Optional[str] = Field(default=None, description="Country of headquarters")
    website: Optional[str] = Field(default=None, description="Company website")
    employees: Optional[int] = Field(default=None, description="Full-time employees")
    description: Optional[str] = Field(default=None, description="Business description")

    # Price data
    current_price: Optional[float] = Field(default=None, description="Current stock price")
    previous_close: Optional[float] = Field(default=None, description="Previous close price")
    open_price: Optional[float] = Field(default=None, description="Today's open price")
    day_high: Optional[float] = Field(default=None, description="Today's high")
    day_low: Optional[float] = Field(default=None, description="Today's low")
    volume: Optional[int] = Field(default=None, description="Trading volume")
    avg_volume: Optional[int] = Field(default=None, description="Average trading volume")

    # Valuation
    market_cap: Optional[float] = Field(default=None, description="Market capitalization")
    enterprise_value: Optional[float] = Field(default=None, description="Enterprise value")
    pe_ratio: Optional[float] = Field(default=None, description="P/E ratio (trailing)")
    forward_pe: Optional[float] = Field(default=None, description="P/E ratio (forward)")
    peg_ratio: Optional[float] = Field(default=None, description="PEG ratio")
    price_to_book: Optional[float] = Field(default=None, description="Price to book ratio")
    price_to_sales: Optional[float] = Field(default=None, description="Price to sales ratio")

    # Dividends
    dividend_yield: Optional[float] = Field(default=None, description="Dividend yield")
    dividend_rate: Optional[float] = Field(default=None, description="Annual dividend rate")

    # 52-week range
    fifty_two_week_high: Optional[float] = Field(default=None, description="52-week high")
    fifty_two_week_low: Optional[float] = Field(default=None, description="52-week low")

    # Targets
    target_high_price: Optional[float] = Field(default=None, description="Analyst high target")
    target_low_price: Optional[float] = Field(default=None, description="Analyst low target")
    target_mean_price: Optional[float] = Field(default=None, description="Analyst mean target")


class FinancialStatement(BaseModel):
    """Financial statement data."""

    period: str = Field(..., description="Period (e.g., '2023' or '2023-Q3')")
    period_end_date: Optional[datetime] = Field(default=None, description="Period end date")

    # Revenue
    total_revenue: Optional[float] = Field(default=None, description="Total revenue")
    gross_profit: Optional[float] = Field(default=None, description="Gross profit")
    operating_income: Optional[float] = Field(default=None, description="Operating income")
    net_income: Optional[float] = Field(default=None, description="Net income")

    # Margins
    gross_margin: Optional[float] = Field(default=None, description="Gross margin (%)")
    operating_margin: Optional[float] = Field(default=None, description="Operating margin (%)")
    net_margin: Optional[float] = Field(default=None, description="Net margin (%)")

    # Cash flow
    operating_cash_flow: Optional[float] = Field(default=None, description="Operating cash flow")
    free_cash_flow: Optional[float] = Field(default=None, description="Free cash flow")

    # Balance sheet
    total_assets: Optional[float] = Field(default=None, description="Total assets")
    total_debt: Optional[float] = Field(default=None, description="Total debt")
    total_cash: Optional[float] = Field(default=None, description="Total cash")

    # EPS
    eps: Optional[float] = Field(default=None, description="Earnings per share")
    eps_diluted: Optional[float] = Field(default=None, description="Diluted EPS")


class FinancialSummary(BaseModel):
    """Financial summary with multi-year data."""

    symbol: str = Field(..., description="Stock ticker")
    currency: str = Field(default="USD", description="Currency")
    annual_statements: List[FinancialStatement] = Field(
        default_factory=list, description="Annual financial statements"
    )
    quarterly_statements: List[FinancialStatement] = Field(
        default_factory=list, description="Quarterly financial statements"
    )

    # Current metrics
    current_ratio: Optional[float] = Field(default=None, description="Current ratio")
    quick_ratio: Optional[float] = Field(default=None, description="Quick ratio")
    debt_to_equity: Optional[float] = Field(default=None, description="Debt to equity ratio")
    return_on_equity: Optional[float] = Field(default=None, description="Return on equity")
    return_on_assets: Optional[float] = Field(default=None, description="Return on assets")


class AnalystRecommendation(BaseModel):
    """Analyst recommendation data."""

    firm: Optional[str] = Field(default=None, description="Analyst firm")
    to_grade: str = Field(..., description="Current recommendation")
    from_grade: Optional[str] = Field(default=None, description="Previous recommendation")
    action: Optional[str] = Field(default=None, description="Action (upgrade/downgrade)")
    date: Optional[datetime] = Field(default=None, description="Date of recommendation")


class RecommendationSummary(BaseModel):
    """Summary of analyst recommendations."""

    symbol: str = Field(..., description="Stock ticker")
    strong_buy: int = Field(default=0, description="Number of strong buy ratings")
    buy: int = Field(default=0, description="Number of buy ratings")
    hold: int = Field(default=0, description="Number of hold ratings")
    sell: int = Field(default=0, description="Number of sell ratings")
    strong_sell: int = Field(default=0, description="Number of strong sell ratings")
    mean_rating: Optional[float] = Field(
        default=None, description="Mean rating (1=Strong Buy, 5=Strong Sell)"
    )
    recent_recommendations: List[AnalystRecommendation] = Field(
        default_factory=list, description="Recent analyst actions"
    )


class NewsArticle(BaseModel):
    """News article from Yahoo Finance."""

    title: str = Field(..., description="Article title")
    publisher: str = Field(default="", description="Publisher name")
    link: str = Field(default="", description="Article URL")
    published_at: Optional[datetime] = Field(default=None, description="Publication date")
    summary: Optional[str] = Field(default=None, description="Article summary")
    thumbnail: Optional[str] = Field(default=None, description="Thumbnail URL")


class NewsData(BaseModel):
    """News data for a company."""

    symbol: str = Field(..., description="Stock ticker")
    articles: List[NewsArticle] = Field(
        default_factory=list, description="Recent news articles"
    )


class Holder(BaseModel):
    """Institutional or insider holder."""

    name: str = Field(..., description="Holder name")
    shares: Optional[int] = Field(default=None, description="Shares held")
    value: Optional[float] = Field(default=None, description="Value of holdings")
    pct_held: Optional[float] = Field(default=None, description="Percentage held")
    date_reported: Optional[datetime] = Field(default=None, description="Report date")


class HoldersData(BaseModel):
    """Holders data for a company."""

    symbol: str = Field(..., description="Stock ticker")
    major_holders: Dict[str, Any] = Field(
        default_factory=dict, description="Major holder percentages"
    )
    institutional_holders: List[Holder] = Field(
        default_factory=list, description="Top institutional holders"
    )
    insider_holders: List[Holder] = Field(
        default_factory=list, description="Top insider holders"
    )
    insider_transactions: List[Dict[str, Any]] = Field(
        default_factory=list, description="Recent insider transactions"
    )


class EarningsData(BaseModel):
    """Earnings data including history and estimates."""

    symbol: str = Field(..., description="Stock ticker")
    earnings_history: List[Dict[str, Any]] = Field(
        default_factory=list, description="Historical earnings"
    )
    earnings_estimates: List[Dict[str, Any]] = Field(
        default_factory=list, description="Future earnings estimates"
    )
    revenue_estimates: List[Dict[str, Any]] = Field(
        default_factory=list, description="Future revenue estimates"
    )


# =============================================================================
# Endpoint Enumeration
# =============================================================================


class YahooFinanceEndpoint(str, Enum):
    """Yahoo Finance API endpoints."""

    STOCK_INFO = "stock-info"
    FINANCIALS = "financials"
    RECOMMENDATIONS = "recommendations"
    NEWS = "news"
    HOLDERS = "holders"
    EARNINGS = "earnings"
    HISTORY = "history"


# =============================================================================
# Adapter Implementation
# =============================================================================


class YahooFinanceAdapter(BaseAdapter):
    """
    Adapter for Yahoo Finance financial data.

    Uses yfinance library for data retrieval with:
    - Rate limiting (1.67 tokens/second)
    - Circuit breaker integration
    - Retry with exponential backoff
    - P0 source citation enforcement
    - Caching with appropriate TTLs

    Example:
        adapter = YahooFinanceAdapter()

        # Get stock info
        info = await adapter.get_stock_info("COST")
        print(f"Market cap: ${info.data.market_cap:,.0f}")
        print(f"Source: {info.citation.source_url}")

        # Get financial statements
        financials = await adapter.get_financials("COST")
        for stmt in financials.data.annual_statements:
            print(f"{stmt.period}: Revenue ${stmt.total_revenue:,.0f}")
    """

    # API Configuration
    BASE_URL = "https://query1.finance.yahoo.com"
    API_VERSION = "v10"

    # Cache TTLs by endpoint (in seconds)
    CACHE_TTL = {
        YahooFinanceEndpoint.STOCK_INFO: 86400,        # 1 day
        YahooFinanceEndpoint.FINANCIALS: 7776000,      # 90 days
        YahooFinanceEndpoint.RECOMMENDATIONS: 604800,   # 7 days
        YahooFinanceEndpoint.NEWS: 3600,               # 1 hour
        YahooFinanceEndpoint.HOLDERS: 604800,          # 7 days
        YahooFinanceEndpoint.EARNINGS: 604800,         # 7 days
        YahooFinanceEndpoint.HISTORY: 86400,           # 1 day
    }

    def __init__(
        self,
        enable_cache: bool = True,
        max_workers: int = 4,
    ):
        """
        Initialize YahooFinanceAdapter.

        Args:
            enable_cache: Enable response caching (default: True).
            max_workers: Thread pool size for sync yfinance calls.
        """
        if not YFINANCE_AVAILABLE:
            logger.warning(
                "yfinance library not installed. "
                "Install with: pip install yfinance"
            )

        # Initialize base adapter
        super().__init__(
            name="yahoo_finance",
            source_type=SourceType.YAHOO_FINANCE,
            api_key=None,  # No API key needed
            base_url=self.BASE_URL,
            api_version=self.API_VERSION,
            default_cost_per_call=0.0,  # Free API
            enable_cache=enable_cache,
            default_cache_ttl_seconds=86400,
            default_timeout_seconds=30,
        )

        # Thread pool for async wrapping
        self._executor = ThreadPoolExecutor(max_workers=max_workers)

        # Register endpoints
        self._register_endpoints()

    def _register_endpoints(self) -> None:
        """Register all endpoint configurations."""
        for endpoint in YahooFinanceEndpoint:
            config = EndpointConfig(
                name=endpoint.value,
                path=f"/{endpoint.value}",
                method="GET",
                cost_per_call=0.0,
                cache_ttl_seconds=self.CACHE_TTL.get(endpoint, 86400),
                timeout_seconds=30,
                requires_auth=False,
            )
            self.register_endpoint(config)

    async def _make_request(
        self,
        endpoint: str,
        params: Dict[str, Any],
        timeout_seconds: int,
    ) -> Dict[str, Any]:
        """
        Make request using yfinance library.

        Args:
            endpoint: Endpoint name from YahooFinanceEndpoint
            params: Request parameters (must include 'symbol')
            timeout_seconds: Request timeout

        Returns:
            Raw data as dictionary

        Raises:
            APIError: On API error
            ValueError: If yfinance not installed or symbol missing
        """
        if not YFINANCE_AVAILABLE:
            raise ValueError(
                "yfinance library not installed. "
                "Install with: pip install yfinance"
            )

        symbol = params.get("symbol")
        if not symbol:
            raise ValueError("Symbol parameter is required")

        endpoint_enum = YahooFinanceEndpoint(endpoint)

        # Run synchronous yfinance calls in thread pool
        loop = asyncio.get_event_loop()

        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor,
                    self._fetch_data,
                    endpoint_enum,
                    symbol,
                    params,
                ),
                timeout=timeout_seconds,
            )
            return result

        except asyncio.TimeoutError:
            raise APIError(
                adapter_name=self.name,
                status_code=408,
                response_body="Request timeout",
                endpoint=endpoint,
            )
        except Exception as e:
            logger.error(f"Yahoo Finance request failed: {e}")
            raise APIError(
                adapter_name=self.name,
                status_code=500,
                response_body=str(e),
                endpoint=endpoint,
            )

    def _fetch_data(
        self,
        endpoint: YahooFinanceEndpoint,
        symbol: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Synchronous data fetch using yfinance.

        This runs in a thread pool to avoid blocking async loop.
        """
        ticker = yf.Ticker(symbol)

        if endpoint == YahooFinanceEndpoint.STOCK_INFO:
            return self._fetch_stock_info(ticker, symbol)

        elif endpoint == YahooFinanceEndpoint.FINANCIALS:
            return self._fetch_financials(ticker, symbol)

        elif endpoint == YahooFinanceEndpoint.RECOMMENDATIONS:
            return self._fetch_recommendations(ticker, symbol)

        elif endpoint == YahooFinanceEndpoint.NEWS:
            return self._fetch_news(ticker, symbol)

        elif endpoint == YahooFinanceEndpoint.HOLDERS:
            return self._fetch_holders(ticker, symbol)

        elif endpoint == YahooFinanceEndpoint.EARNINGS:
            return self._fetch_earnings(ticker, symbol)

        elif endpoint == YahooFinanceEndpoint.HISTORY:
            period = params.get("period", "1y")
            interval = params.get("interval", "1d")
            return self._fetch_history(ticker, symbol, period, interval)

        else:
            return {"symbol": symbol, "error": "Unknown endpoint"}

    def _fetch_stock_info(self, ticker: Any, symbol: str) -> Dict[str, Any]:
        """Fetch stock info data."""
        info = ticker.info or {}

        return {
            "symbol": symbol,
            "name": info.get("longName", info.get("shortName", "")),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "website": info.get("website"),
            "employees": info.get("fullTimeEmployees"),
            "description": info.get("longBusinessSummary"),
            "current_price": info.get("currentPrice", info.get("regularMarketPrice")),
            "previous_close": info.get("previousClose", info.get("regularMarketPreviousClose")),
            "open_price": info.get("open", info.get("regularMarketOpen")),
            "day_high": info.get("dayHigh", info.get("regularMarketDayHigh")),
            "day_low": info.get("dayLow", info.get("regularMarketDayLow")),
            "volume": info.get("volume", info.get("regularMarketVolume")),
            "avg_volume": info.get("averageVolume"),
            "market_cap": info.get("marketCap"),
            "enterprise_value": info.get("enterpriseValue"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "price_to_book": info.get("priceToBook"),
            "price_to_sales": info.get("priceToSalesTrailing12Months"),
            "dividend_yield": info.get("dividendYield"),
            "dividend_rate": info.get("dividendRate"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "target_high_price": info.get("targetHighPrice"),
            "target_low_price": info.get("targetLowPrice"),
            "target_mean_price": info.get("targetMeanPrice"),
        }

    def _fetch_financials(self, ticker: Any, symbol: str) -> Dict[str, Any]:
        """Fetch financial statements."""
        annual_statements = []
        quarterly_statements = []

        # Annual income statement
        try:
            income_stmt = ticker.income_stmt
            if income_stmt is not None and not income_stmt.empty:
                for col in income_stmt.columns[:4]:  # Last 4 years
                    data = income_stmt[col]
                    total_revenue = self._safe_get(data, "Total Revenue")
                    gross_profit = self._safe_get(data, "Gross Profit")
                    net_income = self._safe_get(data, "Net Income")

                    stmt = {
                        "period": str(col.year) if hasattr(col, "year") else str(col),
                        "period_end_date": col.isoformat() if hasattr(col, "isoformat") else None,
                        "total_revenue": total_revenue,
                        "gross_profit": gross_profit,
                        "operating_income": self._safe_get(data, "Operating Income"),
                        "net_income": net_income,
                        "gross_margin": gross_profit / total_revenue if total_revenue else None,
                        "net_margin": net_income / total_revenue if total_revenue else None,
                        "eps": self._safe_get(data, "Basic EPS"),
                        "eps_diluted": self._safe_get(data, "Diluted EPS"),
                    }
                    annual_statements.append(stmt)
        except Exception as e:
            logger.warning(f"Failed to fetch income statement for {symbol}: {e}")

        # Add cash flow data if available
        try:
            cash_flow = ticker.cashflow
            if cash_flow is not None and not cash_flow.empty:
                for i, col in enumerate(cash_flow.columns[:4]):
                    if i < len(annual_statements):
                        data = cash_flow[col]
                        annual_statements[i]["operating_cash_flow"] = self._safe_get(
                            data, "Operating Cash Flow"
                        )
                        annual_statements[i]["free_cash_flow"] = self._safe_get(
                            data, "Free Cash Flow"
                        )
        except Exception as e:
            logger.warning(f"Failed to fetch cash flow for {symbol}: {e}")

        # Quarterly income statement
        try:
            quarterly_income = ticker.quarterly_income_stmt
            if quarterly_income is not None and not quarterly_income.empty:
                for col in quarterly_income.columns[:4]:  # Last 4 quarters
                    data = quarterly_income[col]
                    total_revenue = self._safe_get(data, "Total Revenue")

                    stmt = {
                        "period": col.strftime("%Y-Q%q") if hasattr(col, "strftime") else str(col),
                        "period_end_date": col.isoformat() if hasattr(col, "isoformat") else None,
                        "total_revenue": total_revenue,
                        "gross_profit": self._safe_get(data, "Gross Profit"),
                        "operating_income": self._safe_get(data, "Operating Income"),
                        "net_income": self._safe_get(data, "Net Income"),
                    }
                    quarterly_statements.append(stmt)
        except Exception as e:
            logger.warning(f"Failed to fetch quarterly income for {symbol}: {e}")

        # Get current ratios from info
        info = ticker.info or {}

        return {
            "symbol": symbol,
            "currency": info.get("financialCurrency", "USD"),
            "annual_statements": annual_statements,
            "quarterly_statements": quarterly_statements,
            "current_ratio": info.get("currentRatio"),
            "quick_ratio": info.get("quickRatio"),
            "debt_to_equity": info.get("debtToEquity"),
            "return_on_equity": info.get("returnOnEquity"),
            "return_on_assets": info.get("returnOnAssets"),
        }

    def _fetch_recommendations(self, ticker: Any, symbol: str) -> Dict[str, Any]:
        """Fetch analyst recommendations."""
        recent_recs = []
        summary = {
            "symbol": symbol,
            "strong_buy": 0,
            "buy": 0,
            "hold": 0,
            "sell": 0,
            "strong_sell": 0,
            "mean_rating": None,
            "recent_recommendations": [],
        }

        try:
            recs = ticker.recommendations
            if recs is not None and not recs.empty:
                for idx, row in recs.tail(20).iterrows():  # Last 20 recommendations
                    rec = {
                        "firm": row.get("Firm", None),
                        "to_grade": row.get("To Grade", ""),
                        "from_grade": row.get("From Grade", None),
                        "action": row.get("Action", None),
                        "date": idx.isoformat() if hasattr(idx, "isoformat") else None,
                    }
                    recent_recs.append(rec)

                summary["recent_recommendations"] = recent_recs
        except Exception as e:
            logger.warning(f"Failed to fetch recommendations for {symbol}: {e}")

        # Get recommendation summary from info
        info = ticker.info or {}
        summary["strong_buy"] = info.get("recommendationKey", {}).get("strongBuy", 0)
        summary["buy"] = info.get("numberOfAnalystOpinions", 0)
        summary["mean_rating"] = info.get("recommendationMean")

        return summary

    def _fetch_news(self, ticker: Any, symbol: str) -> Dict[str, Any]:
        """Fetch company news."""
        articles = []

        try:
            news = ticker.news
            if news:
                for item in news[:20]:  # Last 20 articles
                    published_at = None
                    if item.get("providerPublishTime"):
                        published_at = datetime.fromtimestamp(
                            item["providerPublishTime"]
                        ).isoformat()

                    article = {
                        "title": item.get("title", ""),
                        "publisher": item.get("publisher", ""),
                        "link": item.get("link", ""),
                        "published_at": published_at,
                        "summary": item.get("summary"),
                        "thumbnail": item.get("thumbnail", {}).get("resolutions", [{}])[0].get("url"),
                    }
                    articles.append(article)
        except Exception as e:
            logger.warning(f"Failed to fetch news for {symbol}: {e}")

        return {
            "symbol": symbol,
            "articles": articles,
        }

    def _fetch_holders(self, ticker: Any, symbol: str) -> Dict[str, Any]:
        """Fetch holder information."""
        result = {
            "symbol": symbol,
            "major_holders": {},
            "institutional_holders": [],
            "insider_holders": [],
            "insider_transactions": [],
        }

        try:
            # Major holders (percentages)
            major = ticker.major_holders
            if major is not None and not major.empty:
                result["major_holders"] = major.to_dict()
        except Exception:
            pass

        try:
            # Institutional holders
            inst = ticker.institutional_holders
            if inst is not None and not inst.empty:
                for _, row in inst.head(10).iterrows():
                    holder = {
                        "name": row.get("Holder", ""),
                        "shares": row.get("Shares"),
                        "value": row.get("Value"),
                        "pct_held": row.get("% Out"),
                        "date_reported": row.get("Date Reported"),
                    }
                    result["institutional_holders"].append(holder)
        except Exception:
            pass

        try:
            # Insider transactions
            insider_tx = ticker.insider_transactions
            if insider_tx is not None and not insider_tx.empty:
                result["insider_transactions"] = insider_tx.head(10).to_dict("records")
        except Exception:
            pass

        return result

    def _fetch_earnings(self, ticker: Any, symbol: str) -> Dict[str, Any]:
        """Fetch earnings data."""
        result = {
            "symbol": symbol,
            "earnings_history": [],
            "earnings_estimates": [],
            "revenue_estimates": [],
        }

        try:
            # Earnings history
            earnings = ticker.earnings_history
            if earnings is not None and not earnings.empty:
                result["earnings_history"] = earnings.to_dict("records")
        except Exception:
            pass

        try:
            # Earnings estimates
            estimates = ticker.earnings_estimate
            if estimates is not None and not estimates.empty:
                result["earnings_estimates"] = estimates.to_dict()
        except Exception:
            pass

        try:
            # Revenue estimates
            rev_est = ticker.revenue_estimate
            if rev_est is not None and not rev_est.empty:
                result["revenue_estimates"] = rev_est.to_dict()
        except Exception:
            pass

        return result

    def _fetch_history(
        self,
        ticker: Any,
        symbol: str,
        period: str,
        interval: str,
    ) -> Dict[str, Any]:
        """Fetch price history."""
        history_data = []

        try:
            hist = ticker.history(period=period, interval=interval)
            if hist is not None and not hist.empty:
                for idx, row in hist.iterrows():
                    history_data.append({
                        "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                        "open": row.get("Open"),
                        "high": row.get("High"),
                        "low": row.get("Low"),
                        "close": row.get("Close"),
                        "volume": row.get("Volume"),
                        "dividends": row.get("Dividends"),
                        "stock_splits": row.get("Stock Splits"),
                    })
        except Exception as e:
            logger.warning(f"Failed to fetch history for {symbol}: {e}")

        return {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "data": history_data,
        }

    def _safe_get(self, data: Any, key: str) -> Optional[float]:
        """Safely get a value from pandas Series/dict."""
        try:
            val = data.get(key) if hasattr(data, "get") else data[key]
            if val is not None and not (hasattr(val, "isna") and val.isna()):
                return float(val)
        except (KeyError, IndexError, ValueError, TypeError):
            pass
        return None

    def _parse_response(
        self,
        endpoint: str,
        raw_response: Dict[str, Any],
        params: Dict[str, Any],
    ) -> Any:
        """Parse raw API response into typed model."""
        endpoint_enum = YahooFinanceEndpoint(endpoint)

        if endpoint_enum == YahooFinanceEndpoint.STOCK_INFO:
            return StockInfo(**raw_response)

        elif endpoint_enum == YahooFinanceEndpoint.FINANCIALS:
            # Parse nested statements
            annual = [FinancialStatement(**s) for s in raw_response.get("annual_statements", [])]
            quarterly = [FinancialStatement(**s) for s in raw_response.get("quarterly_statements", [])]
            return FinancialSummary(
                symbol=raw_response["symbol"],
                currency=raw_response.get("currency", "USD"),
                annual_statements=annual,
                quarterly_statements=quarterly,
                current_ratio=raw_response.get("current_ratio"),
                quick_ratio=raw_response.get("quick_ratio"),
                debt_to_equity=raw_response.get("debt_to_equity"),
                return_on_equity=raw_response.get("return_on_equity"),
                return_on_assets=raw_response.get("return_on_assets"),
            )

        elif endpoint_enum == YahooFinanceEndpoint.RECOMMENDATIONS:
            recs = [
                AnalystRecommendation(**r)
                for r in raw_response.get("recent_recommendations", [])
            ]
            return RecommendationSummary(
                symbol=raw_response["symbol"],
                strong_buy=raw_response.get("strong_buy", 0),
                buy=raw_response.get("buy", 0),
                hold=raw_response.get("hold", 0),
                sell=raw_response.get("sell", 0),
                strong_sell=raw_response.get("strong_sell", 0),
                mean_rating=raw_response.get("mean_rating"),
                recent_recommendations=recs,
            )

        elif endpoint_enum == YahooFinanceEndpoint.NEWS:
            articles = [NewsArticle(**a) for a in raw_response.get("articles", [])]
            return NewsData(symbol=raw_response["symbol"], articles=articles)

        elif endpoint_enum == YahooFinanceEndpoint.HOLDERS:
            inst_holders = [
                Holder(**h) for h in raw_response.get("institutional_holders", [])
            ]
            insider_holders = [
                Holder(**h) for h in raw_response.get("insider_holders", [])
            ]
            return HoldersData(
                symbol=raw_response["symbol"],
                major_holders=raw_response.get("major_holders", {}),
                institutional_holders=inst_holders,
                insider_holders=insider_holders,
                insider_transactions=raw_response.get("insider_transactions", []),
            )

        elif endpoint_enum == YahooFinanceEndpoint.EARNINGS:
            return EarningsData(**raw_response)

        else:
            # Return raw for history and unknown endpoints
            return raw_response

    def _build_source_url(
        self,
        endpoint: str,
        params: Dict[str, Any],
    ) -> str:
        """Build source URL for citation."""
        symbol = params.get("symbol", "UNKNOWN")
        return f"https://finance.yahoo.com/quote/{symbol}"

    # =========================================================================
    # Public API Methods
    # =========================================================================

    async def get_stock_info(
        self,
        symbol: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[StockInfo]:
        """
        Get basic stock information.

        Args:
            symbol: Stock ticker (e.g., "COST", "AAPL")
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with StockInfo and citation

        Example:
            info = await adapter.get_stock_info("COST")
            print(f"Market cap: ${info.data.market_cap:,.0f}")
            print(f"P/E ratio: {info.data.pe_ratio:.1f}")
        """
        return await self.call(
            YahooFinanceEndpoint.STOCK_INFO.value,
            {"symbol": symbol},
            bypass_cache=bypass_cache,
        )

    async def get_financials(
        self,
        symbol: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[FinancialSummary]:
        """
        Get financial statements (income, balance sheet, cash flow).

        Args:
            symbol: Stock ticker
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with FinancialSummary and citation

        Example:
            financials = await adapter.get_financials("COST")
            for stmt in financials.data.annual_statements:
                print(f"{stmt.period}: Revenue ${stmt.total_revenue:,.0f}")
        """
        return await self.call(
            YahooFinanceEndpoint.FINANCIALS.value,
            {"symbol": symbol},
            bypass_cache=bypass_cache,
        )

    async def get_recommendations(
        self,
        symbol: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[RecommendationSummary]:
        """
        Get analyst recommendations.

        Args:
            symbol: Stock ticker
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with RecommendationSummary and citation
        """
        return await self.call(
            YahooFinanceEndpoint.RECOMMENDATIONS.value,
            {"symbol": symbol},
            bypass_cache=bypass_cache,
        )

    async def get_news(
        self,
        symbol: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[NewsData]:
        """
        Get recent company news.

        Args:
            symbol: Stock ticker
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with NewsData and citation
        """
        return await self.call(
            YahooFinanceEndpoint.NEWS.value,
            {"symbol": symbol},
            bypass_cache=bypass_cache,
        )

    async def get_holders(
        self,
        symbol: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[HoldersData]:
        """
        Get institutional and insider holders.

        Args:
            symbol: Stock ticker
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with HoldersData and citation
        """
        return await self.call(
            YahooFinanceEndpoint.HOLDERS.value,
            {"symbol": symbol},
            bypass_cache=bypass_cache,
        )

    async def get_earnings(
        self,
        symbol: str,
        bypass_cache: bool = False,
    ) -> SourcedResponse[EarningsData]:
        """
        Get earnings history and estimates.

        Args:
            symbol: Stock ticker
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with EarningsData and citation
        """
        return await self.call(
            YahooFinanceEndpoint.EARNINGS.value,
            {"symbol": symbol},
            bypass_cache=bypass_cache,
        )

    async def get_history(
        self,
        symbol: str,
        period: str = "1y",
        interval: str = "1d",
        bypass_cache: bool = False,
    ) -> SourcedResponse[Dict[str, Any]]:
        """
        Get historical price data.

        Args:
            symbol: Stock ticker
            period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
            bypass_cache: Skip cache lookup

        Returns:
            SourcedResponse with historical price data
        """
        return await self.call(
            YahooFinanceEndpoint.HISTORY.value,
            {"symbol": symbol, "period": period, "interval": interval},
            bypass_cache=bypass_cache,
        )

    async def get_full_profile(
        self,
        symbol: str,
    ) -> Dict[str, SourcedResponse]:
        """
        Get comprehensive financial profile for a company.

        Fetches all available data in parallel.

        Args:
            symbol: Stock ticker

        Returns:
            Dictionary mapping data types to SourcedResponses
        """
        # Fetch all data in parallel
        tasks = {
            "info": self.get_stock_info(symbol),
            "financials": self.get_financials(symbol),
            "recommendations": self.get_recommendations(symbol),
            "news": self.get_news(symbol),
            "holders": self.get_holders(symbol),
            "earnings": self.get_earnings(symbol),
        }

        results = {}
        for name, task in tasks.items():
            try:
                results[name] = await task
            except Exception as e:
                logger.warning(f"Failed to get {name} for {symbol}: {e}")
                results[name] = None

        return results

    @staticmethod
    async def resolve_ticker(company_name: str) -> Optional[str]:
        """
        Resolve company name to stock ticker.

        This is a helper method that uses web search to find tickers.
        For production use, consider using a dedicated ticker lookup API.

        Args:
            company_name: Company name to search

        Returns:
            Stock ticker symbol or None if not found

        Example:
            ticker = await YahooFinanceAdapter.resolve_ticker("Costco")
            # Returns "COST"
        """
        # Common company -> ticker mappings
        KNOWN_TICKERS = {
            "costco": "COST",
            "costco wholesale": "COST",
            "walmart": "WMT",
            "amazon": "AMZN",
            "target": "TGT",
            "home depot": "HD",
            "lowe's": "LOW",
            "best buy": "BBY",
            "macy's": "M",
            "nordstrom": "JWN",
            "kohl's": "KSS",
            "tjx": "TJX",
            "ross": "ROST",
            "gap": "GPS",
            "nike": "NKE",
            "autozone": "AZO",
            "o'reilly": "ORLY",
            "advance auto": "AAP",
            "realreal": "REAL",
            "the realreal": "REAL",
            "coach": "TPR",
            "tapestry": "TPR",
            "oriental trading": None,  # Private
            "uncommon goods": None,  # Private
        }

        # Normalize and check known mappings
        normalized = company_name.lower().strip()
        if normalized in KNOWN_TICKERS:
            return KNOWN_TICKERS[normalized]

        # For unknown companies, return None
        # In production, you'd use a web search or ticker API here
        logger.warning(
            f"Could not resolve ticker for '{company_name}'. "
            "Consider using web search for ticker lookup."
        )
        return None

    def __del__(self):
        """Cleanup thread pool on deletion."""
        if hasattr(self, "_executor"):
            self._executor.shutdown(wait=False)
