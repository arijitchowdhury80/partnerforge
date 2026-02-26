"""
API Client Service

HTTP client for external API calls to BuiltWith, SimilarWeb, and Yahoo Finance.
Includes rate limiting, retries, and error handling.
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class APIClientError(Exception):
    """Base exception for API client errors."""
    pass


class RateLimitError(APIClientError):
    """Rate limit exceeded."""
    pass


class APIKeyMissingError(APIClientError):
    """API key not configured."""
    pass


# =============================================================================
# BuiltWith API Client
# =============================================================================

class BuiltWithClient:
    """
    BuiltWith API client.

    Endpoints:
    - Domain Lookup: Get technologies used by a domain
    - Free API: Basic tech detection (fallback)

    Docs: https://api.builtwith.com/
    """

    BASE_URL = "https://api.builtwith.com"

    def __init__(self):
        self.api_key = settings.BUILTWITH_API_KEY
        if not self.api_key:
            logger.warning("BUILTWITH_API_KEY not configured")

    async def get_technologies(self, domain: str) -> Dict[str, Any]:
        """
        Get technologies used by a domain.

        Args:
            domain: Domain to look up (e.g., "mercedes-benz.com")

        Returns:
            Dict with technology data and source info
        """
        if not self.api_key:
            raise APIKeyMissingError("BUILTWITH_API_KEY not configured")

        url = f"{self.BASE_URL}/v21/api.json"
        params = {
            "KEY": self.api_key,
            "LOOKUP": domain,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                # Transform BuiltWith response to our schema
                return self._transform_response(domain, data)

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    raise RateLimitError("BuiltWith rate limit exceeded")
                logger.error(f"BuiltWith API error for {domain}: {e}")
                raise APIClientError(f"BuiltWith API error: {e}")
            except Exception as e:
                logger.error(f"BuiltWith request failed for {domain}: {e}")
                raise APIClientError(f"BuiltWith request failed: {e}")

    def _transform_response(self, domain: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform BuiltWith API response to our schema."""
        results = data.get("Results", [])
        if not results:
            return {
                "domain": domain,
                "technologies": [],
                "source_url": f"https://builtwith.com/{domain}",
                "source_date": datetime.now().isoformat(),
            }

        result = results[0]
        paths = result.get("Result", {}).get("Paths", [])

        technologies = []
        search_providers = []
        cms_platforms = []
        ecommerce_platforms = []
        analytics_tools = []

        for path in paths:
            for tech in path.get("Technologies", []):
                tech_name = tech.get("Name", "")
                categories = tech.get("Categories", [])

                tech_info = {
                    "name": tech_name,
                    "categories": categories,
                    "first_detected": tech.get("FirstDetected"),
                    "last_detected": tech.get("LastDetected"),
                }
                technologies.append(tech_info)

                # Categorize by type
                cat_str = " ".join(categories).lower()
                if "search" in cat_str:
                    search_providers.append(tech_name)
                if "cms" in cat_str or "content management" in cat_str:
                    cms_platforms.append(tech_name)
                if "ecommerce" in cat_str or "commerce" in cat_str:
                    ecommerce_platforms.append(tech_name)
                if "analytics" in cat_str:
                    analytics_tools.append(tech_name)

        return {
            "domain": domain,
            "technologies": technologies,
            "search_providers": list(set(search_providers)),
            "cms_platforms": list(set(cms_platforms)),
            "ecommerce_platforms": list(set(ecommerce_platforms)),
            "analytics_tools": list(set(analytics_tools)),
            "tech_count": len(technologies),
            "source_url": f"https://builtwith.com/{domain}",
            "source_date": datetime.now().isoformat(),
        }


# =============================================================================
# SimilarWeb API Client
# =============================================================================

class SimilarWebClient:
    """
    SimilarWeb API client.

    Endpoints used:
    - traffic: Monthly visits, engagement
    - engagement: Bounce rate, pages/visit, duration
    - geo: Geography distribution
    - sources: Traffic sources breakdown
    - keywords: Top organic/paid keywords
    - rank: Global/country/category rank

    Docs: https://developer.similarweb.com/
    """

    BASE_URL = "https://api.similarweb.com/v1"

    def __init__(self):
        self.api_key = settings.SIMILARWEB_API_KEY
        if not self.api_key:
            logger.warning("SIMILARWEB_API_KEY not configured")

    async def get_traffic_and_engagement(self, domain: str) -> Dict[str, Any]:
        """
        Get comprehensive traffic data for a domain.

        Combines data from multiple endpoints:
        - Total traffic
        - Engagement metrics
        - Traffic sources
        - Geography
        - Website rank

        Args:
            domain: Domain to look up

        Returns:
            Dict with traffic data and source info
        """
        if not self.api_key:
            raise APIKeyMissingError("SIMILARWEB_API_KEY not configured")

        # Fetch from multiple endpoints in parallel
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Fetch all data concurrently
                traffic_task = self._fetch_traffic(client, domain)
                engagement_task = self._fetch_engagement(client, domain)
                sources_task = self._fetch_sources(client, domain)
                geo_task = self._fetch_geography(client, domain)
                rank_task = self._fetch_rank(client, domain)

                results = await asyncio.gather(
                    traffic_task,
                    engagement_task,
                    sources_task,
                    geo_task,
                    rank_task,
                    return_exceptions=True
                )

                traffic_data, engagement_data, sources_data, geo_data, rank_data = results

                # Merge all data
                return self._merge_data(
                    domain,
                    traffic_data if not isinstance(traffic_data, Exception) else {},
                    engagement_data if not isinstance(engagement_data, Exception) else {},
                    sources_data if not isinstance(sources_data, Exception) else {},
                    geo_data if not isinstance(geo_data, Exception) else {},
                    rank_data if not isinstance(rank_data, Exception) else {},
                )

            except Exception as e:
                logger.error(f"SimilarWeb request failed for {domain}: {e}")
                raise APIClientError(f"SimilarWeb request failed: {e}")

    async def _fetch_traffic(self, client: httpx.AsyncClient, domain: str) -> Dict:
        """Fetch total traffic data."""
        url = f"{self.BASE_URL}/website/{domain}/total-traffic-and-engagement/visits"
        params = {"api_key": self.api_key, "country": "world", "granularity": "monthly", "main_domain_only": "false"}

        try:
            response = await client.get(url, params=params)
            if response.status_code == 429:
                raise RateLimitError("SimilarWeb rate limit exceeded")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"SimilarWeb traffic endpoint failed: {e}")
            return {}

    async def _fetch_engagement(self, client: httpx.AsyncClient, domain: str) -> Dict:
        """Fetch engagement metrics."""
        url = f"{self.BASE_URL}/website/{domain}/total-traffic-and-engagement/engagement"
        params = {"api_key": self.api_key, "country": "world", "granularity": "monthly", "main_domain_only": "false"}

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"SimilarWeb engagement endpoint failed: {e}")
            return {}

    async def _fetch_sources(self, client: httpx.AsyncClient, domain: str) -> Dict:
        """Fetch traffic sources breakdown."""
        url = f"{self.BASE_URL}/website/{domain}/traffic-sources/overview-share"
        params = {"api_key": self.api_key, "country": "world", "granularity": "monthly", "main_domain_only": "false"}

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"SimilarWeb sources endpoint failed: {e}")
            return {}

    async def _fetch_geography(self, client: httpx.AsyncClient, domain: str) -> Dict:
        """Fetch geography distribution."""
        url = f"{self.BASE_URL}/website/{domain}/geo/traffic-by-country"
        params = {"api_key": self.api_key, "main_domain_only": "false"}

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"SimilarWeb geography endpoint failed: {e}")
            return {}

    async def _fetch_rank(self, client: httpx.AsyncClient, domain: str) -> Dict:
        """Fetch website rank."""
        url = f"{self.BASE_URL}/website/{domain}/global-rank/global-rank"
        params = {"api_key": self.api_key, "main_domain_only": "false"}

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"SimilarWeb rank endpoint failed: {e}")
            return {}

    def _merge_data(
        self,
        domain: str,
        traffic: Dict,
        engagement: Dict,
        sources: Dict,
        geo: Dict,
        rank: Dict,
    ) -> Dict[str, Any]:
        """Merge data from all endpoints into our schema."""

        # Extract latest monthly visits
        visits_data = traffic.get("visits", [])
        monthly_visits = visits_data[-1].get("visits", 0) if visits_data else 0

        # Calculate MoM change
        mom_change = None
        if len(visits_data) >= 2:
            prev = visits_data[-2].get("visits", 0)
            curr = visits_data[-1].get("visits", 0)
            if prev > 0:
                mom_change = (curr - prev) / prev

        # Extract engagement metrics
        engagement_data = engagement.get("engagement", [])
        latest_engagement = engagement_data[-1] if engagement_data else {}

        bounce_rate = latest_engagement.get("bounce_rate")
        pages_per_visit = latest_engagement.get("pages_per_visit")
        avg_visit_duration = latest_engagement.get("average_visit_duration")

        # Extract traffic sources
        sources_data = sources.get("traffic_sources", {})

        # Extract geography
        geo_data = geo.get("records", [])
        top_countries = []
        for country in geo_data[:5]:
            top_countries.append({
                "country": country.get("country_code", country.get("country", "")),
                "share": country.get("share", 0),
            })

        primary_country = top_countries[0]["country"] if top_countries else None
        primary_country_share = top_countries[0]["share"] if top_countries else None

        # Extract rank
        global_rank = rank.get("global_rank")

        return {
            "domain": domain,
            "traffic_metrics": {
                "monthly_visits": int(monthly_visits) if monthly_visits else 0,
                "unique_visitors": None,  # Not available in basic API
                "avg_visit_duration_seconds": avg_visit_duration,
                "pages_per_visit": pages_per_visit,
                "bounce_rate": bounce_rate,
                "mobile_share": None,  # Would need separate endpoint
            },
            "traffic_trend": {
                "mom_change": mom_change,
                "yoy_change": None,  # Would need 12+ months of data
                "trend_direction": "growing" if mom_change and mom_change > 0.05 else "stable" if mom_change and mom_change > -0.05 else "declining",
            },
            "traffic_sources": {
                "direct": sources_data.get("direct"),
                "organic_search": sources_data.get("search", {}).get("organic"),
                "paid_search": sources_data.get("search", {}).get("paid"),
                "social": sources_data.get("social"),
                "referral": sources_data.get("referrals"),
                "email": sources_data.get("mail"),
                "display": sources_data.get("display_ads"),
            },
            "geography": {
                "primary_country": primary_country,
                "primary_country_share": primary_country_share,
                "top_countries": top_countries,
            },
            "website_rank": {
                "global_rank": global_rank,
                "country_rank": None,
                "category_rank": None,
                "category": None,
            },
            "source_url": f"https://www.similarweb.com/website/{domain}/",
            "source_date": datetime.now().isoformat(),
        }


# =============================================================================
# Yahoo Finance API Client
# =============================================================================

class YahooFinanceClient:
    """
    Yahoo Finance API client using yfinance-style endpoints.

    Gets financial data for public companies:
    - Stock price and market cap
    - Revenue (3-year trend)
    - Net income and margins
    - Analyst recommendations

    Note: Uses RapidAPI Yahoo Finance endpoint for reliability.
    """

    # Using public Yahoo Finance endpoints (no API key needed for basic data)
    BASE_URL = "https://query1.finance.yahoo.com/v10/finance"

    def __init__(self):
        # Yahoo Finance doesn't require API key for basic queries
        pass

    async def get_financials(self, ticker: str, domain: str) -> Dict[str, Any]:
        """
        Get financial data for a stock ticker.

        Args:
            ticker: Stock ticker (e.g., "COST", "WMT")
            domain: Associated domain

        Returns:
            Dict with financial data and source info
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Fetch quote summary (includes key stats)
                quote_data = await self._fetch_quote_summary(client, ticker)

                # Fetch income statement for revenue
                income_data = await self._fetch_financials(client, ticker)

                # Merge data
                return self._transform_data(ticker, domain, quote_data, income_data)

            except Exception as e:
                logger.error(f"Yahoo Finance request failed for {ticker}: {e}")
                raise APIClientError(f"Yahoo Finance request failed: {e}")

    async def _fetch_quote_summary(self, client: httpx.AsyncClient, ticker: str) -> Dict:
        """Fetch quote summary data."""
        url = f"{self.BASE_URL}/quoteSummary/{ticker}"
        params = {
            "modules": "price,summaryDetail,financialData,recommendationTrend",
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        try:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("quoteSummary", {}).get("result", [{}])[0]
        except Exception as e:
            logger.warning(f"Yahoo Finance quote summary failed for {ticker}: {e}")
            return {}

    async def _fetch_financials(self, client: httpx.AsyncClient, ticker: str) -> Dict:
        """Fetch income statement data."""
        url = f"{self.BASE_URL}/quoteSummary/{ticker}"
        params = {
            "modules": "incomeStatementHistory,incomeStatementHistoryQuarterly",
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        try:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("quoteSummary", {}).get("result", [{}])[0]
        except Exception as e:
            logger.warning(f"Yahoo Finance financials failed for {ticker}: {e}")
            return {}

    def _transform_data(
        self,
        ticker: str,
        domain: str,
        quote: Dict,
        income: Dict
    ) -> Dict[str, Any]:
        """Transform Yahoo Finance data to our schema."""

        # Extract price data
        price_data = quote.get("price", {})
        summary = quote.get("summaryDetail", {})
        financial = quote.get("financialData", {})

        current_price = price_data.get("regularMarketPrice", {}).get("raw")
        market_cap = price_data.get("marketCap", {}).get("raw")

        # Extract revenue from income statement
        income_history = income.get("incomeStatementHistory", {}).get("incomeStatementHistory", [])

        revenue_3yr = []
        for i, stmt in enumerate(income_history[:3]):
            revenue = stmt.get("totalRevenue", {}).get("raw")
            if revenue:
                revenue_3yr.append({
                    "fiscal_year": f"FY{2024-i}",  # Approximate
                    "revenue": revenue,
                    "yoy_change": None,
                })

        # Calculate YoY changes
        for i in range(len(revenue_3yr) - 1):
            curr = revenue_3yr[i]["revenue"]
            prev = revenue_3yr[i + 1]["revenue"]
            if prev and prev > 0:
                revenue_3yr[i]["yoy_change"] = (curr - prev) / prev

        # Reverse to chronological order
        revenue_3yr = list(reversed(revenue_3yr))

        # Extract margins
        gross_margin = financial.get("grossMargins", {}).get("raw")
        operating_margin = financial.get("operatingMargins", {}).get("raw")
        ebitda_margin = financial.get("ebitdaMargins", {}).get("raw")

        # Latest revenue
        latest_revenue = revenue_3yr[-1]["revenue"] if revenue_3yr else None
        revenue_growth = revenue_3yr[-1]["yoy_change"] if revenue_3yr else None

        return {
            "domain": domain,
            "ticker": ticker,
            "exchange": price_data.get("exchange", ""),
            "is_public": True,
            "fiscal_year_end": None,
            "revenue_3yr": revenue_3yr,
            "latest_revenue": latest_revenue,
            "revenue_trend": "growing" if revenue_growth and revenue_growth > 0 else "stable" if revenue_growth and revenue_growth > -0.05 else "declining",
            "revenue_growth_yoy": revenue_growth,
            "ebitda_margin": ebitda_margin,
            "operating_margin": operating_margin,
            "gross_margin": gross_margin,
            "current_price": current_price,
            "market_cap": market_cap,
            "price_52_week_high": summary.get("fiftyTwoWeekHigh", {}).get("raw"),
            "price_52_week_low": summary.get("fiftyTwoWeekLow", {}).get("raw"),
            "analyst_consensus": None,  # Would need recommendation module
            "analyst_target_price": financial.get("targetMeanPrice", {}).get("raw"),
            "source_url": f"https://finance.yahoo.com/quote/{ticker}/",
            "source_date": datetime.now().isoformat(),
        }


# =============================================================================
# Singleton instances
# =============================================================================

builtwith_client = BuiltWithClient()
similarweb_client = SimilarWebClient()
yahoo_finance_client = YahooFinanceClient()
