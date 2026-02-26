"""
Functional Test Routes - Real API Integration Tests

Tests the actual BuiltWith and SimilarWeb APIs with real data.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import httpx
import os

router = APIRouter(prefix="/test", tags=["functional-test"])

# API Keys from environment
BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY", "")
SIMILARWEB_API_KEY = os.getenv("SIMILARWEB_API_KEY", "")


@router.get("/status")
async def test_status():
    """Check API key configuration status."""
    return {
        "builtwith_configured": bool(BUILTWITH_API_KEY),
        "builtwith_key_prefix": BUILTWITH_API_KEY[:8] + "..." if BUILTWITH_API_KEY else None,
        "similarweb_configured": bool(SIMILARWEB_API_KEY),
        "similarweb_key_prefix": SIMILARWEB_API_KEY[:8] + "..." if SIMILARWEB_API_KEY else None,
        "ready_for_testing": bool(BUILTWITH_API_KEY and SIMILARWEB_API_KEY),
    }


@router.get("/builtwith/{domain}")
async def test_builtwith(domain: str):
    """
    Test BuiltWith API with a real domain.

    Returns technology stack data from BuiltWith.
    """
    if not BUILTWITH_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="BUILTWITH_API_KEY not configured. Add it to Railway environment variables."
        )

    url = "https://api.builtwith.com/v21/api.json"
    params = {
        "KEY": BUILTWITH_API_KEY,
        "LOOKUP": domain,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            # Parse technologies
            technologies = []
            if "Results" in data:
                for result in data["Results"]:
                    for path in result.get("Result", {}).get("Paths", []):
                        for tech in path.get("Technologies", []):
                            technologies.append({
                                "name": tech.get("Name"),
                                "tag": tech.get("Tag"),
                                "categories": tech.get("Categories", []),
                            })

            return {
                "status": "success",
                "domain": domain,
                "source": "BuiltWith",
                "api_response_time_ms": response.elapsed.total_seconds() * 1000,
                "technologies_found": len(technologies),
                "technologies": technologies[:20],  # First 20
                "raw_response_keys": list(data.keys()),
            }

        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "domain": domain,
                "error": str(e),
                "status_code": e.response.status_code,
            }
        except Exception as e:
            return {
                "status": "error",
                "domain": domain,
                "error": str(e),
            }


@router.get("/similarweb/{domain}")
async def test_similarweb(domain: str):
    """
    Test SimilarWeb API with a real domain.

    Returns traffic and technology data from SimilarWeb.
    """
    if not SIMILARWEB_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="SIMILARWEB_API_KEY not configured. Add it to Railway environment variables."
        )

    # Test traffic endpoint
    url = f"https://api.similarweb.com/v1/website/{domain}/total-traffic-and-engagement/visits"
    headers = {
        "api-key": SIMILARWEB_API_KEY,
    }
    params = {
        "api_key": SIMILARWEB_API_KEY,
        "country": "world",
        "granularity": "monthly",
        "main_domain_only": "false",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

            return {
                "status": "success",
                "domain": domain,
                "source": "SimilarWeb",
                "api_response_time_ms": response.elapsed.total_seconds() * 1000,
                "data": data,
            }

        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "domain": domain,
                "error": str(e),
                "status_code": e.response.status_code,
                "response_text": e.response.text[:500] if e.response.text else None,
            }
        except Exception as e:
            return {
                "status": "error",
                "domain": domain,
                "error": str(e),
            }


@router.post("/full/{domain}")
async def test_full_enrichment(domain: str):
    """
    Run a full enrichment test on a domain.

    Tests both BuiltWith and SimilarWeb APIs, then stores the result.
    """
    results = {
        "domain": domain,
        "timestamp": datetime.now().isoformat(),
        "builtwith": None,
        "similarweb": None,
        "success": False,
    }

    # Test BuiltWith
    try:
        results["builtwith"] = await test_builtwith(domain)
    except Exception as e:
        results["builtwith"] = {"status": "error", "error": str(e)}

    # Test SimilarWeb
    try:
        results["similarweb"] = await test_similarweb(domain)
    except Exception as e:
        results["similarweb"] = {"status": "error", "error": str(e)}

    # Check overall success
    builtwith_ok = results["builtwith"] and results["builtwith"].get("status") == "success"
    similarweb_ok = results["similarweb"] and results["similarweb"].get("status") == "success"

    results["success"] = builtwith_ok or similarweb_ok
    results["summary"] = {
        "builtwith_ok": builtwith_ok,
        "similarweb_ok": similarweb_ok,
        "technologies_found": results["builtwith"].get("technologies_found", 0) if builtwith_ok else 0,
    }

    return results
