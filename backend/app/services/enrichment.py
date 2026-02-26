"""
Enrichment Service - Real API Integration

Calls BuiltWith, SimilarWeb, and Yahoo Finance APIs to enrich company data.
"""

import httpx
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import get_settings
from ..models.targets import DisplacementTarget

logger = logging.getLogger(__name__)
settings = get_settings()


class EnrichmentService:
    """Service for enriching company data from external APIs."""

    def __init__(self):
        self.builtwith_key = settings.BUILTWITH_API_KEY
        self.similarweb_key = settings.SIMILARWEB_API_KEY
        self.timeout = 30.0

    async def enrich_domain(
        self,
        domain: str,
        db: AsyncSession,
        force: bool = False,
    ) -> Dict[str, Any]:
        """
        Enrich a domain with data from all available sources.

        Args:
            domain: Domain to enrich (e.g., "nissan.com")
            db: Database session
            force: If True, re-enrich even if recent data exists

        Returns:
            Dict with enrichment results and status
        """
        domain = self._normalize_domain(domain)
        logger.info(f"Starting enrichment for {domain}")

        results = {
            "domain": domain,
            "started_at": datetime.utcnow().isoformat(),
            "builtwith": None,
            "similarweb": None,
            "modules_completed": [],
            "modules_failed": [],
            "errors": [],
        }

        # Get or create target record
        target = await self._get_or_create_target(domain, db)

        # Check if recently enriched (skip if within 24 hours and not forced)
        if not force and target.last_enriched:
            age_hours = (datetime.utcnow() - target.last_enriched).total_seconds() / 3600
            if age_hours < 24:
                logger.info(f"Skipping {domain} - enriched {age_hours:.1f}h ago (use force=true)")
                results["skipped"] = True
                results["reason"] = f"Recently enriched ({age_hours:.1f}h ago)"
                return results

        # Run enrichments
        try:
            builtwith_data = await self._fetch_builtwith(domain)
            results["builtwith"] = builtwith_data
            if builtwith_data.get("status") == "success":
                results["modules_completed"].append("tech_stack")
                await self._update_tech_stack(target, builtwith_data, db)
            else:
                results["modules_failed"].append("tech_stack")
                results["errors"].append(f"BuiltWith: {builtwith_data.get('error')}")
        except Exception as e:
            logger.error(f"BuiltWith error for {domain}: {e}")
            results["modules_failed"].append("tech_stack")
            results["errors"].append(f"BuiltWith exception: {str(e)}")

        try:
            similarweb_data = await self._fetch_similarweb(domain)
            results["similarweb"] = similarweb_data
            if similarweb_data.get("status") == "success":
                results["modules_completed"].append("traffic")
                await self._update_traffic(target, similarweb_data, db)
            else:
                results["modules_failed"].append("traffic")
                results["errors"].append(f"SimilarWeb: {similarweb_data.get('error')}")
        except Exception as e:
            logger.error(f"SimilarWeb error for {domain}: {e}")
            results["modules_failed"].append("traffic")
            results["errors"].append(f"SimilarWeb exception: {str(e)}")

        # Update enrichment metadata
        target.last_enriched = datetime.utcnow()
        if len(results["modules_completed"]) >= 2:
            target.enrichment_level = "full"
        elif len(results["modules_completed"]) >= 1:
            target.enrichment_level = "standard"
        else:
            target.enrichment_level = "basic"

        await db.commit()

        results["completed_at"] = datetime.utcnow().isoformat()
        results["success"] = len(results["modules_completed"]) > 0

        logger.info(
            f"Enrichment complete for {domain}: "
            f"{len(results['modules_completed'])} succeeded, "
            f"{len(results['modules_failed'])} failed"
        )

        return results

    def _normalize_domain(self, domain: str) -> str:
        """Normalize domain format."""
        d = domain.strip().lower()
        d = d.replace("https://", "").replace("http://", "")
        d = d.replace("www.", "").rstrip("/")
        return d

    async def _get_or_create_target(
        self,
        domain: str,
        db: AsyncSession,
    ) -> DisplacementTarget:
        """Get existing target or create new one."""
        stmt = select(DisplacementTarget).where(DisplacementTarget.domain == domain)
        result = await db.execute(stmt)
        target = result.scalar_one_or_none()

        if not target:
            logger.info(f"Creating new target record for {domain}")
            target = DisplacementTarget(
                domain=domain,
                company_name=domain.split(".")[0].title(),
                created_at=datetime.utcnow(),
            )
            db.add(target)
            await db.flush()

        return target

    async def _fetch_builtwith(self, domain: str) -> Dict[str, Any]:
        """Fetch technology stack from BuiltWith API."""
        if not self.builtwith_key:
            return {"status": "error", "error": "BUILTWITH_API_KEY not configured"}

        url = "https://api.builtwith.com/v21/api.json"
        params = {
            "KEY": self.builtwith_key,
            "LOOKUP": domain,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                # Parse technologies
                technologies = []
                categories = set()
                partner_tech = None

                if "Results" in data:
                    for result in data["Results"]:
                        for path in result.get("Result", {}).get("Paths", []):
                            for tech in path.get("Technologies", []):
                                tech_name = tech.get("Name", "")
                                tech_cats = tech.get("Categories", [])
                                technologies.append({
                                    "name": tech_name,
                                    "tag": tech.get("Tag"),
                                    "categories": tech_cats,
                                })
                                categories.update(tech_cats)

                                # Identify partner tech
                                if "Adobe" in tech_name or "AEM" in tech_name:
                                    partner_tech = "Adobe AEM"
                                elif "Shopify" in tech_name:
                                    partner_tech = "Shopify"
                                elif "Salesforce Commerce" in tech_name:
                                    partner_tech = "Salesforce Commerce"

                                # Identify search provider
                                search_providers = ["Algolia", "Elasticsearch", "Coveo", "Searchspring", "Constructor"]
                                for sp in search_providers:
                                    if sp.lower() in tech_name.lower():
                                        # Store this for later
                                        pass

                return {
                    "status": "success",
                    "domain": domain,
                    "source": "BuiltWith",
                    "source_url": f"https://builtwith.com/{domain}",
                    "technologies": technologies,
                    "technologies_count": len(technologies),
                    "categories": list(categories),
                    "partner_tech": partner_tech,
                    "fetched_at": datetime.utcnow().isoformat(),
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

    async def _fetch_similarweb(self, domain: str) -> Dict[str, Any]:
        """Fetch traffic data from SimilarWeb API."""
        if not self.similarweb_key:
            return {"status": "error", "error": "SIMILARWEB_API_KEY not configured"}

        # Get total visits
        url = f"https://api.similarweb.com/v1/website/{domain}/total-traffic-and-engagement/visits"
        headers = {"api-key": self.similarweb_key}
        params = {
            "api_key": self.similarweb_key,
            "country": "world",
            "granularity": "monthly",
            "main_domain_only": "false",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                visits_data = response.json()

                # Calculate monthly visits (average of last 3 months)
                visits = visits_data.get("visits", [])
                monthly_visits = 0
                if visits:
                    recent_visits = [v.get("visits", 0) for v in visits[-3:]]
                    monthly_visits = int(sum(recent_visits) / len(recent_visits)) if recent_visits else 0

                # Try to get engagement data
                engagement_data = {}
                try:
                    eng_url = f"https://api.similarweb.com/v1/website/{domain}/total-traffic-and-engagement/engagement-metrics"
                    eng_response = await client.get(eng_url, headers=headers, params=params)
                    if eng_response.status_code == 200:
                        engagement_data = eng_response.json()
                except Exception:
                    pass

                # Try to get rank
                rank_data = {}
                try:
                    rank_url = f"https://api.similarweb.com/v1/website/{domain}/global-rank/global-rank"
                    rank_response = await client.get(rank_url, headers=headers, params=params)
                    if rank_response.status_code == 200:
                        rank_data = rank_response.json()
                except Exception:
                    pass

                return {
                    "status": "success",
                    "domain": domain,
                    "source": "SimilarWeb",
                    "source_url": f"https://www.similarweb.com/website/{domain}/",
                    "monthly_visits": monthly_visits,
                    "visits_history": visits,
                    "bounce_rate": engagement_data.get("bounce_rate"),
                    "pages_per_visit": engagement_data.get("pages_per_visit"),
                    "avg_visit_duration": engagement_data.get("average_visit_duration"),
                    "global_rank": rank_data.get("global_rank"),
                    "fetched_at": datetime.utcnow().isoformat(),
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

    async def _update_tech_stack(
        self,
        target: DisplacementTarget,
        data: Dict[str, Any],
        db: AsyncSession,
    ) -> None:
        """Update target with BuiltWith data."""
        if data.get("partner_tech"):
            target.partner_tech = data["partner_tech"]

        # Store full tech stack as JSON
        target.tech_stack_json = json.dumps({
            "technologies": data.get("technologies", []),
            "categories": data.get("categories", []),
            "source_url": data.get("source_url"),
            "fetched_at": data.get("fetched_at"),
        })

        # Detect search provider from technologies
        for tech in data.get("technologies", []):
            tech_name = tech.get("name", "").lower()
            if "algolia" in tech_name:
                target.current_search = "Algolia"
            elif "elasticsearch" in tech_name:
                target.current_search = "Elasticsearch"
            elif "coveo" in tech_name:
                target.current_search = "Coveo"
            elif "searchspring" in tech_name:
                target.current_search = "Searchspring"
            elif "constructor" in tech_name:
                target.current_search = "Constructor.io"

        logger.info(f"Updated tech stack for {target.domain}")

    async def _update_traffic(
        self,
        target: DisplacementTarget,
        data: Dict[str, Any],
        db: AsyncSession,
    ) -> None:
        """Update target with SimilarWeb data."""
        if data.get("monthly_visits"):
            target.sw_monthly_visits = data["monthly_visits"]

        if data.get("bounce_rate") is not None:
            target.sw_bounce_rate = data["bounce_rate"]

        if data.get("pages_per_visit") is not None:
            target.sw_pages_per_visit = data["pages_per_visit"]

        if data.get("avg_visit_duration") is not None:
            target.sw_avg_duration = int(data["avg_visit_duration"])

        if data.get("global_rank") is not None:
            target.sw_rank_global = data["global_rank"]

        # Calculate traffic growth if we have history
        visits_history = data.get("visits_history", [])
        if len(visits_history) >= 2:
            old_visits = visits_history[-2].get("visits", 0)
            new_visits = visits_history[-1].get("visits", 0)
            if old_visits > 0:
                target.traffic_growth = round((new_visits - old_visits) / old_visits * 100, 2)

        logger.info(f"Updated traffic for {target.domain}: {target.sw_monthly_visits:,} monthly visits")


# Singleton instance
_enrichment_service: Optional[EnrichmentService] = None


def get_enrichment_service() -> EnrichmentService:
    """Get or create enrichment service instance."""
    global _enrichment_service
    if _enrichment_service is None:
        _enrichment_service = EnrichmentService()
    return _enrichment_service
