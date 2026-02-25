"""
PartnerForge Enrichment Module

Handles data enrichment from external APIs:
- BuiltWith: Technology stack detection
- SimilarWeb: Traffic and engagement metrics
- Yahoo Finance: Financial data (via yfinance library)
"""

import sqlite3
import json
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import logging

try:
    import yfinance as yf
except ImportError:
    yf = None

from .config import (
    DATABASE_PATH,
    BUILTWITH_API_KEY,
    SIMILARWEB_API_KEY,
    BUILTWITH_FREE_API_URL,
    SIMILARWEB_API_BASE,
    CACHE_TTL_DAYS,
)

logger = logging.getLogger(__name__)


def get_db_connection():
    """Get a SQLite database connection."""
    conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def is_enrichment_fresh(conn: sqlite3.Connection, domain: str) -> bool:
    """Check if the enrichment data is still fresh (within TTL)."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT last_enriched FROM displacement_targets
        WHERE domain = ?
        """,
        (domain,)
    )
    row = cursor.fetchone()

    if not row or not row["last_enriched"]:
        return False

    try:
        last_enriched = datetime.fromisoformat(row["last_enriched"])
        ttl_threshold = datetime.now() - timedelta(days=CACHE_TTL_DAYS)
        return last_enriched > ttl_threshold
    except (ValueError, TypeError):
        return False


def get_company_by_domain(domain: str) -> Optional[Dict[str, Any]]:
    """
    Get company data from the database.
    Returns None if company not found.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Normalize domain
    domain = domain.lower().strip()

    cursor.execute(
        """
        SELECT
            id, domain, company_name, partner_tech, vertical, country, city, state,
            tech_spend, sw_monthly_visits, sw_bounce_rate, sw_pages_per_visit,
            sw_avg_duration, sw_search_traffic_pct, sw_rank_global,
            icp_tier, icp_tier_name, icp_score, score_breakdown,
            ticker, is_public, revenue, gross_margin, traffic_growth,
            current_search, trigger_events, exec_quote, exec_name, exec_title,
            competitors_using_algolia, displacement_angle, financials_json,
            hiring_signals, tech_stack_json, last_enriched, enrichment_level
        FROM displacement_targets
        WHERE domain = ?
        """,
        (domain,)
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    # Convert Row to dict
    data = dict(row)

    # Parse JSON fields
    json_fields = ["score_breakdown", "financials_json", "tech_stack_json"]
    for field in json_fields:
        if data.get(field):
            try:
                data[field] = json.loads(data[field])
            except (json.JSONDecodeError, TypeError):
                pass

    return data


def fetch_builtwith_data(domain: str) -> Optional[Dict[str, Any]]:
    """
    Fetch technology stack data from BuiltWith Free API.

    Returns dict with technologies or None on error.
    """
    if not BUILTWITH_API_KEY:
        logger.warning("BuiltWith API key not configured")
        return None

    try:
        url = f"{BUILTWITH_FREE_API_URL}?KEY={BUILTWITH_API_KEY}&LOOKUP={domain}"
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        data = response.json()

        # Extract technologies from response
        technologies = []
        if "Results" in data and len(data["Results"]) > 0:
            result = data["Results"][0]
            if "Result" in result and "Paths" in result["Result"]:
                for path in result["Result"]["Paths"]:
                    if "Technologies" in path:
                        for tech in path["Technologies"]:
                            technologies.append({
                                "name": tech.get("Name", ""),
                                "category": tech.get("Tag", ""),
                                "first_detected": tech.get("FirstDetected"),
                                "last_detected": tech.get("LastDetected"),
                            })

        return {
            "domain": domain,
            "technologies": technologies,
            "raw_response": data,
        }

    except requests.RequestException as e:
        logger.error(f"BuiltWith API error for {domain}: {e}")
        return None
    except (KeyError, json.JSONDecodeError) as e:
        logger.error(f"BuiltWith response parsing error for {domain}: {e}")
        return None


def fetch_similarweb_data(domain: str) -> Optional[Dict[str, Any]]:
    """
    Fetch traffic and engagement data from SimilarWeb API.

    Returns dict with metrics or None on error.
    """
    if not SIMILARWEB_API_KEY:
        logger.warning("SimilarWeb API key not configured")
        return None

    try:
        # Fetch total traffic and engagement
        url = f"{SIMILARWEB_API_BASE}/{domain}/total-traffic-and-engagement/visits"
        params = {
            "api_key": SIMILARWEB_API_KEY,
            "start_date": "2024-01",  # Last year of data
            "end_date": "2024-12",
            "country": "world",
            "granularity": "monthly",
            "main_domain_only": "false",
        }

        response = requests.get(url, params=params, timeout=30)

        # Handle 403/credit errors gracefully
        if response.status_code == 403:
            logger.warning(f"SimilarWeb API: Access denied for {domain}")
            return None

        response.raise_for_status()
        data = response.json()

        # Calculate average monthly visits from the response
        visits_data = data.get("visits", [])
        if visits_data:
            avg_visits = sum(v.get("visits", 0) for v in visits_data) / len(visits_data)
        else:
            avg_visits = 0

        return {
            "domain": domain,
            "monthly_visits": int(avg_visits),
            "visits_history": visits_data,
        }

    except requests.RequestException as e:
        logger.error(f"SimilarWeb API error for {domain}: {e}")
        return None
    except (KeyError, json.JSONDecodeError) as e:
        logger.error(f"SimilarWeb response parsing error for {domain}: {e}")
        return None


def fetch_yahoo_finance_data(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Fetch financial data from Yahoo Finance using yfinance library.

    Returns dict with financial metrics or None on error.
    """
    if not yf:
        logger.warning("yfinance library not installed")
        return None

    if not ticker:
        return None

    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        if not info or "symbol" not in info:
            logger.warning(f"Yahoo Finance: No data found for ticker {ticker}")
            return None

        # Extract relevant financial data
        financials = {
            "ticker": ticker,
            "company_name": info.get("longName", ""),
            "market_cap": info.get("marketCap"),
            "revenue": info.get("totalRevenue"),
            "gross_margin": info.get("grossMargins"),
            "operating_margin": info.get("operatingMargins"),
            "profit_margin": info.get("profitMargins"),
            "ebitda": info.get("ebitda"),
            "free_cash_flow": info.get("freeCashflow"),
            "total_debt": info.get("totalDebt"),
            "total_cash": info.get("totalCash"),
            "employees": info.get("fullTimeEmployees"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "website": info.get("website"),
            "current_price": info.get("currentPrice"),
            "target_mean_price": info.get("targetMeanPrice"),
            "recommendation": info.get("recommendationKey"),
        }

        return financials

    except Exception as e:
        logger.error(f"Yahoo Finance error for {ticker}: {e}")
        return None


def save_enrichment_data(
    domain: str,
    builtwith_data: Optional[Dict] = None,
    similarweb_data: Optional[Dict] = None,
    yahoo_data: Optional[Dict] = None,
) -> bool:
    """
    Save enrichment data to the database.

    Returns True on success, False on error.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        updates = []
        params = []

        # SimilarWeb data
        if similarweb_data:
            updates.append("sw_monthly_visits = ?")
            params.append(similarweb_data.get("monthly_visits"))

        # BuiltWith data
        if builtwith_data:
            updates.append("tech_stack_json = ?")
            params.append(json.dumps(builtwith_data.get("technologies", [])))

        # Yahoo Finance data
        if yahoo_data:
            updates.append("ticker = ?")
            params.append(yahoo_data.get("ticker"))
            updates.append("is_public = ?")
            params.append(1)
            updates.append("revenue = ?")
            params.append(yahoo_data.get("revenue"))
            updates.append("gross_margin = ?")
            params.append(yahoo_data.get("gross_margin"))
            updates.append("financials_json = ?")
            params.append(json.dumps(yahoo_data))

        # Always update timestamp and level
        updates.append("last_enriched = ?")
        params.append(datetime.now().isoformat())
        updates.append("enrichment_level = ?")
        params.append("full")

        # Add domain for WHERE clause
        params.append(domain)

        if updates:
            query = f"""
                UPDATE displacement_targets
                SET {', '.join(updates)}
                WHERE domain = ?
            """
            cursor.execute(query, params)
            conn.commit()

            return cursor.rowcount > 0

        return False

    except sqlite3.Error as e:
        logger.error(f"Database error saving enrichment for {domain}: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def enrich_company(domain: str, force: bool = False) -> Dict[str, Any]:
    """
    Full enrichment pipeline for a company.

    Args:
        domain: Company domain to enrich
        force: If True, refresh even if cached data is fresh

    Returns:
        Dict with enrichment results and status
    """
    result = {
        "domain": domain,
        "status": "pending",
        "builtwith": None,
        "similarweb": None,
        "yahoo_finance": None,
        "errors": [],
        "cached": False,
    }

    conn = get_db_connection()

    # Check if company exists
    company = get_company_by_domain(domain)
    if not company:
        result["status"] = "not_found"
        result["errors"].append(f"Company with domain {domain} not found in database")
        return result

    # Check if enrichment is fresh
    if not force and is_enrichment_fresh(conn, domain):
        result["status"] = "cached"
        result["cached"] = True
        result["company"] = company
        conn.close()
        return result

    conn.close()

    # Fetch from external APIs
    builtwith_data = fetch_builtwith_data(domain)
    if builtwith_data:
        result["builtwith"] = builtwith_data
    else:
        result["errors"].append("BuiltWith API failed or not configured")

    similarweb_data = fetch_similarweb_data(domain)
    if similarweb_data:
        result["similarweb"] = similarweb_data
    else:
        result["errors"].append("SimilarWeb API failed or not configured")

    # Fetch Yahoo Finance if we have a ticker
    ticker = company.get("ticker")
    if ticker:
        yahoo_data = fetch_yahoo_finance_data(ticker)
        if yahoo_data:
            result["yahoo_finance"] = yahoo_data
        else:
            result["errors"].append(f"Yahoo Finance failed for ticker {ticker}")

    # Save to database
    saved = save_enrichment_data(
        domain,
        builtwith_data=builtwith_data,
        similarweb_data=similarweb_data,
        yahoo_data=result.get("yahoo_finance"),
    )

    if saved:
        result["status"] = "success"
        # Fetch updated company data
        result["company"] = get_company_by_domain(domain)
    else:
        result["status"] = "partial"
        result["errors"].append("Failed to save some enrichment data")
        result["company"] = get_company_by_domain(domain)

    return result


def get_all_targets(
    page: int = 1,
    per_page: int = 50,
    tier_filter: Optional[int] = None,
    score_min: Optional[int] = None,
    score_max: Optional[int] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get paginated list of displacement targets with optional filters.

    Returns:
        Dict with targets list, pagination info, and totals
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Build WHERE clause
    where_clauses = []
    params = []

    if tier_filter is not None:
        where_clauses.append("icp_tier = ?")
        params.append(tier_filter)

    if score_min is not None:
        where_clauses.append("icp_score >= ?")
        params.append(score_min)

    if score_max is not None:
        where_clauses.append("icp_score <= ?")
        params.append(score_max)

    if search:
        where_clauses.append("(company_name LIKE ? OR domain LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Get total count
    count_query = f"SELECT COUNT(*) as total FROM displacement_targets WHERE {where_sql}"
    cursor.execute(count_query, params)
    total = cursor.fetchone()["total"]

    # Calculate pagination
    offset = (page - 1) * per_page
    total_pages = (total + per_page - 1) // per_page

    # Fetch targets
    query = f"""
        SELECT
            id, domain, company_name, partner_tech, vertical, country,
            sw_monthly_visits, icp_tier, icp_tier_name, icp_score,
            score_breakdown, last_enriched, enrichment_level
        FROM displacement_targets
        WHERE {where_sql}
        ORDER BY icp_score DESC, sw_monthly_visits DESC
        LIMIT ? OFFSET ?
    """
    params.extend([per_page, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    targets = []
    for row in rows:
        target = dict(row)
        # Parse score_breakdown JSON
        if target.get("score_breakdown"):
            try:
                target["score_breakdown"] = json.loads(target["score_breakdown"])
            except (json.JSONDecodeError, TypeError):
                pass
        targets.append(target)

    return {
        "targets": targets,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }
    }
