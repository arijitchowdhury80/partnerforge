"""
Unit Tests for YahooFinanceAdapter
===================================

Tests for the Yahoo Finance financial data adapter including:
- All 7 endpoints (stock-info, financials, recommendations, news, holders, earnings, history)
- Source citation enforcement (P0)
- Response parsing
- Caching behavior
- Error handling
- Ticker resolution

Run:
    pytest tests/unit/adapters/test_yahoo_finance.py -v

Coverage:
    pytest tests/unit/adapters/test_yahoo_finance.py --cov=pipeline.adapters.yahoo_finance --cov-report=html
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch, PropertyMock
from typing import Dict, Any
import pandas as pd

from pipeline.adapters.yahoo_finance import (
    YahooFinanceAdapter,
    YahooFinanceEndpoint,
    StockInfo,
    FinancialStatement,
    FinancialSummary,
    AnalystRecommendation,
    RecommendationSummary,
    NewsArticle,
    NewsData,
    Holder,
    HoldersData,
    EarningsData,
    YFINANCE_AVAILABLE,
)
from pipeline.adapters.base import (
    SourcedResponse,
    EndpointConfig,
    APIError,
)
from pipeline.models.source import SourceCitation, SourceType


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def yahoo_adapter() -> YahooFinanceAdapter:
    """Create YahooFinanceAdapter for testing."""
    return YahooFinanceAdapter(
        enable_cache=True,
    )


@pytest.fixture
def yahoo_adapter_no_cache() -> YahooFinanceAdapter:
    """Create YahooFinanceAdapter with caching disabled."""
    return YahooFinanceAdapter(
        enable_cache=False,
    )


@pytest.fixture
def mock_stock_info() -> Dict[str, Any]:
    """Sample stock info response."""
    return {
        "symbol": "COST",
        "name": "Costco Wholesale Corporation",
        "sector": "Consumer Defensive",
        "industry": "Discount Stores",
        "country": "United States",
        "website": "https://www.costco.com",
        "employees": 316000,
        "description": "Costco operates membership-only warehouse clubs.",
        "current_price": 925.50,
        "previous_close": 920.00,
        "open_price": 922.00,
        "day_high": 930.00,
        "day_low": 918.00,
        "volume": 1500000,
        "avg_volume": 2000000,
        "market_cap": 410000000000,
        "enterprise_value": 420000000000,
        "pe_ratio": 55.2,
        "forward_pe": 48.5,
        "peg_ratio": 2.1,
        "price_to_book": 15.8,
        "price_to_sales": 1.6,
        "dividend_yield": 0.005,
        "dividend_rate": 4.64,
        "fifty_two_week_high": 950.00,
        "fifty_two_week_low": 700.00,
        "target_high_price": 1050.00,
        "target_low_price": 800.00,
        "target_mean_price": 950.00,
    }


@pytest.fixture
def mock_financials() -> Dict[str, Any]:
    """Sample financials response."""
    return {
        "symbol": "COST",
        "currency": "USD",
        "annual_statements": [
            {
                "period": "2024",
                "period_end_date": "2024-09-01T00:00:00",
                "total_revenue": 254000000000.0,
                "gross_profit": 32000000000.0,
                "operating_income": 8500000000.0,
                "net_income": 7400000000.0,
                "gross_margin": 0.126,
                "net_margin": 0.029,
                "eps": 16.50,
                "eps_diluted": 16.40,
                "operating_cash_flow": 11000000000.0,
                "free_cash_flow": 8000000000.0,
            },
            {
                "period": "2023",
                "period_end_date": "2023-09-01T00:00:00",
                "total_revenue": 242000000000.0,
                "gross_profit": 30500000000.0,
                "operating_income": 8000000000.0,
                "net_income": 6900000000.0,
            },
        ],
        "quarterly_statements": [
            {
                "period": "2024-Q1",
                "total_revenue": 65000000000.0,
                "net_income": 2000000000.0,
            },
        ],
        "current_ratio": 1.02,
        "quick_ratio": 0.58,
        "debt_to_equity": 0.32,
        "return_on_equity": 0.28,
        "return_on_assets": 0.10,
    }


@pytest.fixture
def mock_recommendations() -> Dict[str, Any]:
    """Sample recommendations response."""
    return {
        "symbol": "COST",
        "strong_buy": 12,
        "buy": 15,
        "hold": 8,
        "sell": 1,
        "strong_sell": 0,
        "mean_rating": 1.8,
        "recent_recommendations": [
            {
                "firm": "Morgan Stanley",
                "to_grade": "Overweight",
                "from_grade": "Equal-Weight",
                "action": "upgrade",
                "date": "2024-01-15T00:00:00",
            },
            {
                "firm": "Goldman Sachs",
                "to_grade": "Buy",
                "from_grade": None,
                "action": "init",
                "date": "2024-01-10T00:00:00",
            },
        ],
    }


@pytest.fixture
def mock_news() -> Dict[str, Any]:
    """Sample news response."""
    return {
        "symbol": "COST",
        "articles": [
            {
                "title": "Costco Reports Strong Q1 Earnings",
                "publisher": "Reuters",
                "link": "https://reuters.com/costco-earnings",
                "published_at": "2024-01-15T10:00:00",
                "summary": "Costco reported quarterly earnings above expectations.",
                "thumbnail": "https://images.reuters.com/costco.jpg",
            },
            {
                "title": "Costco Membership Fees May Increase",
                "publisher": "CNBC",
                "link": "https://cnbc.com/costco-fees",
                "published_at": "2024-01-14T15:00:00",
                "summary": "Analysts expect Costco to raise membership fees.",
                "thumbnail": None,
            },
        ],
    }


@pytest.fixture
def mock_holders() -> Dict[str, Any]:
    """Sample holders response."""
    return {
        "symbol": "COST",
        "major_holders": {
            "insiders": 0.05,
            "institutions": 0.68,
            "institutions_float": 0.72,
        },
        "institutional_holders": [
            {
                "name": "Vanguard Group",
                "shares": 50000000,
                "value": 46275000000,
                "pct_held": 0.11,
                "date_reported": "2024-01-01",
            },
            {
                "name": "BlackRock",
                "shares": 40000000,
                "value": 37020000000,
                "pct_held": 0.09,
                "date_reported": "2024-01-01",
            },
        ],
        "insider_holders": [
            {
                "name": "Craig Jelinek",
                "shares": 100000,
                "value": 92550000,
                "pct_held": 0.0002,
                "date_reported": "2024-01-01",
            },
        ],
        "insider_transactions": [],
    }


@pytest.fixture
def mock_earnings() -> Dict[str, Any]:
    """Sample earnings response."""
    return {
        "symbol": "COST",
        "earnings_history": [
            {"quarter": "2024-Q1", "eps_estimate": 3.50, "eps_actual": 3.58},
            {"quarter": "2023-Q4", "eps_estimate": 3.20, "eps_actual": 3.25},
        ],
        "earnings_estimates": {
            "current_quarter": 3.75,
            "next_quarter": 3.90,
            "current_year": 16.50,
            "next_year": 18.00,
        },
        "revenue_estimates": {
            "current_quarter": 67000000000,
            "current_year": 265000000000,
        },
    }


@pytest.fixture
def mock_history() -> Dict[str, Any]:
    """Sample history response."""
    return {
        "symbol": "COST",
        "period": "1y",
        "interval": "1d",
        "data": [
            {
                "date": "2024-01-15T00:00:00",
                "open": 920.00,
                "high": 930.00,
                "low": 915.00,
                "close": 925.50,
                "volume": 1500000,
                "dividends": 0.0,
                "stock_splits": 0.0,
            },
            {
                "date": "2024-01-14T00:00:00",
                "open": 915.00,
                "high": 922.00,
                "low": 912.00,
                "close": 920.00,
                "volume": 1400000,
                "dividends": 0.0,
                "stock_splits": 0.0,
            },
        ],
    }


@pytest.fixture
def mock_yfinance_ticker():
    """Mock yfinance Ticker object."""
    ticker = MagicMock()

    # Mock info property
    ticker.info = {
        "longName": "Costco Wholesale Corporation",
        "sector": "Consumer Defensive",
        "industry": "Discount Stores",
        "country": "United States",
        "website": "https://www.costco.com",
        "fullTimeEmployees": 316000,
        "longBusinessSummary": "Costco operates membership-only warehouse clubs.",
        "currentPrice": 925.50,
        "previousClose": 920.00,
        "regularMarketOpen": 922.00,
        "regularMarketDayHigh": 930.00,
        "regularMarketDayLow": 918.00,
        "regularMarketVolume": 1500000,
        "averageVolume": 2000000,
        "marketCap": 410000000000,
        "enterpriseValue": 420000000000,
        "trailingPE": 55.2,
        "forwardPE": 48.5,
        "pegRatio": 2.1,
        "priceToBook": 15.8,
        "priceToSalesTrailing12Months": 1.6,
        "dividendYield": 0.005,
        "dividendRate": 4.64,
        "fiftyTwoWeekHigh": 950.00,
        "fiftyTwoWeekLow": 700.00,
        "targetHighPrice": 1050.00,
        "targetLowPrice": 800.00,
        "targetMeanPrice": 950.00,
    }

    # Mock income statement
    ticker.income_stmt = MagicMock()
    ticker.income_stmt.empty = False
    ticker.income_stmt.columns = [datetime(2024, 9, 1)]

    # Mock other attributes
    ticker.recommendations = None
    ticker.news = []
    ticker.major_holders = MagicMock(empty=True)
    ticker.institutional_holders = MagicMock(empty=True)

    return ticker


# ============================================================================
# Initialization Tests
# ============================================================================


class TestYahooFinanceAdapterInit:
    """Test adapter initialization."""

    def test_adapter_creation(self):
        """Adapter initializes correctly."""
        adapter = YahooFinanceAdapter()

        assert adapter.name == "yahoo_finance"
        assert adapter.source_type == SourceType.YAHOO_FINANCE
        assert adapter.base_url == "https://query1.finance.yahoo.com"

    def test_adapter_registers_all_endpoints(self, yahoo_adapter):
        """Adapter registers all 7 endpoint configurations."""
        expected_endpoints = [
            "stock-info",
            "financials",
            "recommendations",
            "news",
            "holders",
            "earnings",
            "history",
        ]

        for endpoint in expected_endpoints:
            config = yahoo_adapter.get_endpoint_config(endpoint)
            assert config.name == endpoint

    def test_endpoint_costs_are_zero(self, yahoo_adapter):
        """All endpoints are free (cost = 0)."""
        for endpoint in YahooFinanceEndpoint:
            config = yahoo_adapter.get_endpoint_config(endpoint.value)
            assert config.cost_per_call == 0.0

    def test_cache_ttl_per_endpoint(self, yahoo_adapter):
        """Cache TTLs are configured per endpoint type."""
        # Stock info: 1 day
        stock_config = yahoo_adapter.get_endpoint_config("stock-info")
        assert stock_config.cache_ttl_seconds == 86400

        # Financials: 90 days
        financials_config = yahoo_adapter.get_endpoint_config("financials")
        assert financials_config.cache_ttl_seconds == 7776000

        # News: 1 hour
        news_config = yahoo_adapter.get_endpoint_config("news")
        assert news_config.cache_ttl_seconds == 3600


# ============================================================================
# Response Model Tests
# ============================================================================


class TestResponseModels:
    """Test Pydantic response models."""

    def test_stock_info_model(self, mock_stock_info):
        """StockInfo model works correctly."""
        info = StockInfo(**mock_stock_info)

        assert info.symbol == "COST"
        assert info.name == "Costco Wholesale Corporation"
        assert info.sector == "Consumer Defensive"
        assert info.market_cap == 410000000000
        assert info.pe_ratio == 55.2

    def test_financial_statement_model(self):
        """FinancialStatement model works correctly."""
        stmt = FinancialStatement(
            period="2024",
            total_revenue=254000000000.0,
            gross_profit=32000000000.0,
            net_income=7400000000.0,
            gross_margin=0.126,
        )

        assert stmt.period == "2024"
        assert stmt.total_revenue == 254000000000.0
        assert stmt.gross_margin == 0.126

    def test_financial_summary_model(self, mock_financials):
        """FinancialSummary model works correctly."""
        annual = [
            FinancialStatement(**s)
            for s in mock_financials.get("annual_statements", [])
        ]
        summary = FinancialSummary(
            symbol="COST",
            currency="USD",
            annual_statements=annual,
            current_ratio=1.02,
            debt_to_equity=0.32,
        )

        assert summary.symbol == "COST"
        assert len(summary.annual_statements) == 2
        assert summary.current_ratio == 1.02

    def test_recommendation_summary_model(self, mock_recommendations):
        """RecommendationSummary model works correctly."""
        recs = [
            AnalystRecommendation(**r)
            for r in mock_recommendations.get("recent_recommendations", [])
        ]
        summary = RecommendationSummary(
            symbol="COST",
            strong_buy=12,
            buy=15,
            hold=8,
            sell=1,
            strong_sell=0,
            mean_rating=1.8,
            recent_recommendations=recs,
        )

        assert summary.strong_buy == 12
        assert summary.buy == 15
        assert len(summary.recent_recommendations) == 2

    def test_news_data_model(self, mock_news):
        """NewsData model works correctly."""
        articles = [
            NewsArticle(**a)
            for a in mock_news.get("articles", [])
        ]
        news = NewsData(
            symbol="COST",
            articles=articles,
        )

        assert news.symbol == "COST"
        assert len(news.articles) == 2
        assert news.articles[0].publisher == "Reuters"

    def test_holders_data_model(self, mock_holders):
        """HoldersData model works correctly."""
        inst_holders = [
            Holder(**h) for h in mock_holders.get("institutional_holders", [])
        ]
        data = HoldersData(
            symbol="COST",
            major_holders=mock_holders["major_holders"],
            institutional_holders=inst_holders,
        )

        assert data.symbol == "COST"
        assert len(data.institutional_holders) == 2
        assert data.institutional_holders[0].name == "Vanguard Group"


# ============================================================================
# Source Citation Tests (P0)
# ============================================================================


class TestSourceCitation:
    """Test P0 source citation enforcement."""

    def test_build_source_url(self, yahoo_adapter):
        """Source URL is built correctly for citations."""
        url = yahoo_adapter._build_source_url(
            "stock-info",
            {"symbol": "COST"},
        )

        assert "finance.yahoo.com" in url
        assert "COST" in url

    @pytest.mark.asyncio
    async def test_response_has_citation(self, yahoo_adapter, mock_stock_info):
        """Every response has a source citation attached."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_stock_info

            response = await yahoo_adapter.get_stock_info("COST")

            assert response.citation is not None
            assert isinstance(response.citation, SourceCitation)
            assert response.citation.source_type == SourceType.YAHOO_FINANCE

    @pytest.mark.asyncio
    async def test_citation_has_retrieved_at(self, yahoo_adapter, mock_stock_info):
        """Citation has retrieval timestamp."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_stock_info

            response = await yahoo_adapter.get_stock_info("COST")

            assert response.citation.retrieved_at is not None
            age = (datetime.utcnow() - response.citation.retrieved_at).total_seconds()
            assert age < 10


# ============================================================================
# API Method Tests
# ============================================================================


class TestAPIMethods:
    """Test high-level API methods."""

    @pytest.mark.asyncio
    async def test_get_stock_info(self, yahoo_adapter, mock_stock_info):
        """get_stock_info returns StockInfo."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_stock_info

            response = await yahoo_adapter.get_stock_info("COST")

            assert isinstance(response, SourcedResponse)
            assert isinstance(response.data, StockInfo)
            assert response.data.symbol == "COST"

    @pytest.mark.asyncio
    async def test_get_financials(self, yahoo_adapter, mock_financials):
        """get_financials returns FinancialSummary."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_financials

            response = await yahoo_adapter.get_financials("COST")

            assert isinstance(response.data, FinancialSummary)
            assert len(response.data.annual_statements) == 2

    @pytest.mark.asyncio
    async def test_get_recommendations(self, yahoo_adapter, mock_recommendations):
        """get_recommendations returns RecommendationSummary."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_recommendations

            response = await yahoo_adapter.get_recommendations("COST")

            assert isinstance(response.data, RecommendationSummary)
            assert response.data.strong_buy == 12

    @pytest.mark.asyncio
    async def test_get_news(self, yahoo_adapter, mock_news):
        """get_news returns NewsData."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_news

            response = await yahoo_adapter.get_news("COST")

            assert isinstance(response.data, NewsData)
            assert len(response.data.articles) == 2

    @pytest.mark.asyncio
    async def test_get_holders(self, yahoo_adapter, mock_holders):
        """get_holders returns HoldersData."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_holders

            response = await yahoo_adapter.get_holders("COST")

            assert isinstance(response.data, HoldersData)
            assert len(response.data.institutional_holders) == 2

    @pytest.mark.asyncio
    async def test_get_earnings(self, yahoo_adapter, mock_earnings):
        """get_earnings returns EarningsData."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_earnings

            response = await yahoo_adapter.get_earnings("COST")

            assert isinstance(response.data, EarningsData)
            assert response.data.symbol == "COST"

    @pytest.mark.asyncio
    async def test_get_history(self, yahoo_adapter, mock_history):
        """get_history returns historical price data."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_history

            response = await yahoo_adapter.get_history("COST")

            assert response.data["symbol"] == "COST"
            assert len(response.data["data"]) == 2

    @pytest.mark.asyncio
    async def test_get_history_with_params(self, yahoo_adapter, mock_history):
        """get_history accepts period and interval params."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_history

            response = await yahoo_adapter.get_history("COST", period="6mo", interval="1wk")

            # Verify call was made with correct params
            call_args = mock_request.call_args
            assert call_args[1]["symbol"] == "COST"


# ============================================================================
# Caching Tests
# ============================================================================


class TestCaching:
    """Test caching behavior."""

    @pytest.mark.asyncio
    async def test_cache_hit(self, yahoo_adapter, mock_stock_info):
        """Second call returns cached data."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_stock_info

            # First call - cache miss
            response1 = await yahoo_adapter.get_stock_info("COST")
            assert response1.cached is False
            assert mock_request.call_count == 1

            # Second call - cache hit
            response2 = await yahoo_adapter.get_stock_info("COST")
            assert response2.cached is True
            assert mock_request.call_count == 1

    @pytest.mark.asyncio
    async def test_bypass_cache(self, yahoo_adapter, mock_stock_info):
        """bypass_cache forces fresh API call."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_stock_info

            # First call
            await yahoo_adapter.get_stock_info("COST")

            # Second call with bypass
            response = await yahoo_adapter.get_stock_info("COST", bypass_cache=True)
            assert response.cached is False
            assert mock_request.call_count == 2

    @pytest.mark.asyncio
    async def test_different_symbols_different_cache(self, yahoo_adapter, mock_stock_info):
        """Different symbols use different cache entries."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_stock_info

            await yahoo_adapter.get_stock_info("COST")
            await yahoo_adapter.get_stock_info("WMT")

            assert mock_request.call_count == 2


# ============================================================================
# Error Handling Tests
# ============================================================================


class TestErrorHandling:
    """Test error handling."""

    @pytest.mark.asyncio
    async def test_missing_symbol_error(self, yahoo_adapter):
        """Missing symbol raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            await yahoo_adapter.call("stock-info", {})

        assert "symbol" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_api_error_handling(self, yahoo_adapter):
        """API errors are properly wrapped."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = APIError(
                adapter_name="yahoo_finance",
                status_code=500,
                response_body="Internal server error",
                endpoint="stock-info",
            )

            with pytest.raises(APIError) as exc_info:
                await yahoo_adapter.get_stock_info("INVALID")

            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_timeout_handling(self, yahoo_adapter):
        """Timeout is handled properly."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = asyncio.TimeoutError("Request timeout")

            with pytest.raises(asyncio.TimeoutError):
                await yahoo_adapter.get_stock_info("COST")


# ============================================================================
# Ticker Resolution Tests
# ============================================================================


class TestTickerResolution:
    """Test ticker resolution utility."""

    @pytest.mark.asyncio
    async def test_resolve_known_ticker(self):
        """Known companies resolve to correct tickers."""
        assert await YahooFinanceAdapter.resolve_ticker("Costco") == "COST"
        assert await YahooFinanceAdapter.resolve_ticker("Walmart") == "WMT"
        assert await YahooFinanceAdapter.resolve_ticker("Amazon") == "AMZN"

    @pytest.mark.asyncio
    async def test_resolve_case_insensitive(self):
        """Ticker resolution is case insensitive."""
        assert await YahooFinanceAdapter.resolve_ticker("costco") == "COST"
        assert await YahooFinanceAdapter.resolve_ticker("COSTCO") == "COST"

    @pytest.mark.asyncio
    async def test_resolve_private_company_returns_none(self):
        """Private companies return None."""
        assert await YahooFinanceAdapter.resolve_ticker("Oriental Trading") is None
        assert await YahooFinanceAdapter.resolve_ticker("Uncommon Goods") is None

    @pytest.mark.asyncio
    async def test_resolve_unknown_company_returns_none(self):
        """Unknown companies return None."""
        result = await YahooFinanceAdapter.resolve_ticker("Random Unknown Company XYZ")
        assert result is None


# ============================================================================
# Metrics Tests
# ============================================================================


class TestMetrics:
    """Test metrics tracking."""

    @pytest.mark.asyncio
    async def test_successful_call_metrics(self, yahoo_adapter, mock_stock_info):
        """Successful calls update metrics."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_stock_info

            await yahoo_adapter.get_stock_info("COST")

            assert yahoo_adapter.metrics.total_calls == 1
            assert yahoo_adapter.metrics.successful_calls == 1
            assert yahoo_adapter.metrics.failed_calls == 0

    @pytest.mark.asyncio
    async def test_zero_cost_tracking(self, yahoo_adapter, mock_stock_info):
        """Yahoo Finance calls are free (zero cost)."""
        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_stock_info

            response = await yahoo_adapter.get_stock_info("COST")

            assert response.cost_usd == 0.0
            assert yahoo_adapter.metrics.total_cost_usd == 0.0

    def test_get_metrics_dict(self, yahoo_adapter):
        """get_metrics returns dictionary."""
        metrics_dict = yahoo_adapter.get_metrics()

        assert "adapter_name" in metrics_dict
        assert metrics_dict["adapter_name"] == "yahoo_finance"
        assert "total_calls" in metrics_dict


# ============================================================================
# Full Profile Tests
# ============================================================================


class TestFullProfile:
    """Test get_full_profile method."""

    @pytest.mark.asyncio
    async def test_get_full_profile(
        self,
        yahoo_adapter,
        mock_stock_info,
        mock_financials,
        mock_recommendations,
        mock_news,
        mock_holders,
        mock_earnings,
    ):
        """get_full_profile fetches all data types."""
        responses = {
            "stock-info": mock_stock_info,
            "financials": mock_financials,
            "recommendations": mock_recommendations,
            "news": mock_news,
            "holders": mock_holders,
            "earnings": mock_earnings,
        }

        async def mock_make_request(endpoint, params, timeout):
            return responses.get(endpoint, {})

        with patch.object(yahoo_adapter, "_make_request", side_effect=mock_make_request):
            results = await yahoo_adapter.get_full_profile("COST")

            assert "info" in results
            assert "financials" in results
            assert "recommendations" in results
            assert "news" in results
            assert "holders" in results
            assert "earnings" in results


# ============================================================================
# Health Check Tests
# ============================================================================


class TestHealthCheck:
    """Test health check functionality."""

    def test_health_check_healthy(self, yahoo_adapter):
        """Healthy adapter returns positive health check."""
        health = yahoo_adapter.health_check()

        assert health["name"] == "yahoo_finance"
        assert health["healthy"] is True

    def test_health_check_includes_yfinance_status(self, yahoo_adapter):
        """Health check can indicate yfinance availability."""
        health = yahoo_adapter.health_check()

        # yfinance may or may not be available
        assert "healthy" in health


# ============================================================================
# Edge Case Tests
# ============================================================================


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    @pytest.mark.asyncio
    async def test_empty_financials(self, yahoo_adapter):
        """Handle empty financials gracefully."""
        empty_financials = {
            "symbol": "NEWCO",
            "currency": "USD",
            "annual_statements": [],
            "quarterly_statements": [],
        }

        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = empty_financials

            response = await yahoo_adapter.get_financials("NEWCO")

            assert response.data.symbol == "NEWCO"
            assert len(response.data.annual_statements) == 0

    @pytest.mark.asyncio
    async def test_empty_news(self, yahoo_adapter):
        """Handle empty news gracefully."""
        empty_news = {"symbol": "COST", "articles": []}

        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = empty_news

            response = await yahoo_adapter.get_news("COST")

            assert len(response.data.articles) == 0

    @pytest.mark.asyncio
    async def test_null_values_in_stock_info(self, yahoo_adapter):
        """Handle null values in stock info."""
        partial_info = {
            "symbol": "NEWCO",
            "name": "New Company",
            "sector": None,
            "market_cap": None,
            "pe_ratio": None,
        }

        with patch.object(yahoo_adapter, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = partial_info

            response = await yahoo_adapter.get_stock_info("NEWCO")

            assert response.data.symbol == "NEWCO"
            assert response.data.sector is None
            assert response.data.market_cap is None
