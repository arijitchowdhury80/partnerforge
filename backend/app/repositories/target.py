"""
Target Repository - Displacement Target Operations

Provides operations for managing displacement targets with:
- ICP scoring and tier filtering
- Partner technology matching
- Competitive intelligence
- Enrichment status tracking

Core Formula:
    Displacement Targets = Companies Using Partner Tech - Existing Algolia Customers

Usage:
    repo = TargetRepository(session)

    # Get hot leads (score >= 80)
    hot = await repo.list_hot_leads(limit=50)

    # Find targets by partner tech
    aem_targets = await repo.list_by_partner_tech("Adobe AEM")

    # Get competitive intelligence
    intel = await repo.get_competitive_intel("costco.com")
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from .base import (
    BaseRepository,
    FilterOperator,
    NotFoundError,
    ValidationError,
    SourceCitationError,
)
from ..models.targets import DisplacementTarget, CompetitiveIntel


class TargetRepository(BaseRepository[DisplacementTarget]):
    """
    Repository for displacement targets.

    Displacement targets are companies using partner technologies
    (Adobe AEM, Shopify, etc.) who are NOT using Algolia - representing
    displacement opportunities for co-sell motions.

    ICP Tiers:
    - HOT: score >= 80
    - WARM: score >= 60
    - COOL: score >= 40
    - COLD: score < 40
    """

    model = DisplacementTarget

    # ICP tier thresholds
    ICP_HOT_THRESHOLD = 80
    ICP_WARM_THRESHOLD = 60
    ICP_COOL_THRESHOLD = 40

    def validate_source_citation(self, data: Dict[str, Any]) -> bool:
        """
        Validate source citation for enriched target data.

        Required when updating intelligence fields:
        - quote_source for exec_quote
        - source fields in financials_json, tech_stack_json

        Args:
            data: Dictionary of field values

        Returns:
            True if valid

        Raises:
            SourceCitationError: If required source citation is missing
        """
        # Check if exec_quote is provided without source
        if "exec_quote" in data and data["exec_quote"]:
            if not data.get("quote_source"):
                raise SourceCitationError(
                    ["quote_source"],
                    "exec_quote requires quote_source URL",
                )

        # For basic target creation, source citation not required
        return True

    # =========================================================================
    # Domain-Based Operations
    # =========================================================================

    async def get_by_domain(
        self,
        domain: str,
        *,
        load_relations: Optional[List[str]] = None,
    ) -> Optional[DisplacementTarget]:
        """
        Get a target by its domain.

        Args:
            domain: Target domain (e.g., "costco.com")
            load_relations: Relationships to eagerly load

        Returns:
            Target if found, None otherwise
        """
        return await self.get_by_field(
            "domain",
            domain.lower().strip(),
            load_relations=load_relations,
        )

    async def get_by_domain_or_raise(
        self,
        domain: str,
    ) -> DisplacementTarget:
        """
        Get a target by domain or raise NotFoundError.

        Args:
            domain: Target domain

        Returns:
            DisplacementTarget

        Raises:
            NotFoundError: If target not found
        """
        target = await self.get_by_domain(domain)
        if target is None:
            raise NotFoundError("DisplacementTarget", domain)
        return target

    async def upsert_by_domain(
        self,
        domain: str,
        data: Dict[str, Any],
    ) -> Tuple[DisplacementTarget, bool]:
        """
        Create or update a target by domain.

        Args:
            domain: Target domain
            data: Target data

        Returns:
            Tuple of (target, created)
        """
        data["domain"] = domain.lower().strip()
        return await self.upsert("domain", data["domain"], data)

    # =========================================================================
    # ICP Score & Tier Operations
    # =========================================================================

    async def list_hot_leads(
        self,
        *,
        vertical: Optional[str] = None,
        partner_tech: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[DisplacementTarget]:
        """
        List hot leads (ICP score >= 80).

        Args:
            vertical: Optional vertical filter
            partner_tech: Optional partner technology filter
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of hot lead targets ordered by score desc
        """
        return await self._list_by_tier(
            min_score=self.ICP_HOT_THRESHOLD,
            vertical=vertical,
            partner_tech=partner_tech,
            limit=limit,
            offset=offset,
        )

    async def list_warm_leads(
        self,
        *,
        vertical: Optional[str] = None,
        partner_tech: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[DisplacementTarget]:
        """
        List warm leads (ICP score 60-79).

        Args:
            vertical: Optional vertical filter
            partner_tech: Optional partner technology filter
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of warm lead targets
        """
        return await self._list_by_tier(
            min_score=self.ICP_WARM_THRESHOLD,
            max_score=self.ICP_HOT_THRESHOLD - 1,
            vertical=vertical,
            partner_tech=partner_tech,
            limit=limit,
            offset=offset,
        )

    async def list_by_icp_tier(
        self,
        tier: str,
        *,
        vertical: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[DisplacementTarget]:
        """
        List targets by ICP tier name.

        Args:
            tier: Tier name ("hot", "warm", "cool", "cold")
            vertical: Optional vertical filter
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of targets in the tier

        Raises:
            ValidationError: If tier name is invalid
        """
        tier_lower = tier.lower()
        if tier_lower not in ("hot", "warm", "cool", "cold"):
            raise ValidationError(f"Invalid ICP tier: {tier}")

        filters = {"icp_tier_name": tier_lower}
        if vertical:
            filters["vertical"] = vertical

        return await self.list(
            filters=filters,
            order_by=[("icp_score", "desc")],
            limit=limit,
            offset=offset,
        )

    async def _list_by_tier(
        self,
        min_score: int,
        max_score: Optional[int] = None,
        vertical: Optional[str] = None,
        partner_tech: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[DisplacementTarget]:
        """Internal method to list targets by score range."""
        advanced_filters = [
            ("icp_score", FilterOperator.GTE, min_score),
        ]

        if max_score is not None:
            advanced_filters.append(
                ("icp_score", FilterOperator.LTE, max_score)
            )

        filters = {}
        if vertical:
            filters["vertical"] = vertical
        if partner_tech:
            filters["partner_tech"] = partner_tech

        return await self.list(
            filters=filters if filters else None,
            advanced_filters=advanced_filters,
            order_by=[("icp_score", "desc")],
            limit=limit,
            offset=offset,
        )

    async def update_icp_score(
        self,
        domain: str,
        icp_score: int,
        *,
        breakdown: Optional[Dict[str, Any]] = None,
        reasons: Optional[List[str]] = None,
    ) -> DisplacementTarget:
        """
        Update ICP score and tier for a target.

        Args:
            domain: Target domain
            icp_score: New ICP score (0-100)
            breakdown: Optional score breakdown
            reasons: Optional list of scoring reasons

        Returns:
            Updated target

        Raises:
            NotFoundError: If target not found
            ValidationError: If score is invalid
        """
        if not 0 <= icp_score <= 100:
            raise ValidationError("ICP score must be between 0 and 100")

        target = await self.get_by_domain_or_raise(domain)

        # Determine tier name
        if icp_score >= self.ICP_HOT_THRESHOLD:
            tier_name = "hot"
            tier = 1
        elif icp_score >= self.ICP_WARM_THRESHOLD:
            tier_name = "warm"
            tier = 2
        elif icp_score >= self.ICP_COOL_THRESHOLD:
            tier_name = "cool"
            tier = 3
        else:
            tier_name = "cold"
            tier = 4

        import json

        update_data = {
            "icp_score": icp_score,
            "icp_tier": tier,
            "icp_tier_name": tier_name,
        }

        if breakdown:
            update_data["score_breakdown"] = json.dumps(breakdown)
        if reasons:
            update_data["score_reasons"] = json.dumps(reasons)

        return await self.update(target.id, update_data, validate_source=False)

    # =========================================================================
    # Partner Technology Operations
    # =========================================================================

    async def list_by_partner_tech(
        self,
        partner_tech: str,
        *,
        min_icp_score: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[DisplacementTarget]:
        """
        List targets using a specific partner technology.

        Args:
            partner_tech: Partner technology name (e.g., "Adobe AEM", "Shopify")
            min_icp_score: Optional minimum ICP score filter
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of targets using the partner tech
        """
        filters = {"partner_tech": partner_tech}
        advanced_filters = []

        if min_icp_score is not None:
            advanced_filters.append(
                ("icp_score", FilterOperator.GTE, min_icp_score)
            )

        return await self.list(
            filters=filters,
            advanced_filters=advanced_filters if advanced_filters else None,
            order_by=[("icp_score", "desc")],
            limit=limit,
            offset=offset,
        )

    async def get_partner_tech_stats(self) -> List[Dict[str, Any]]:
        """
        Get statistics by partner technology.

        Returns:
            List of partner tech stats with counts and avg scores
        """
        query = (
            select(
                DisplacementTarget.partner_tech,
                func.count().label("count"),
                func.avg(DisplacementTarget.icp_score).label("avg_score"),
                func.count()
                .filter(DisplacementTarget.icp_score >= self.ICP_HOT_THRESHOLD)
                .label("hot_count"),
                func.count()
                .filter(
                    and_(
                        DisplacementTarget.icp_score >= self.ICP_WARM_THRESHOLD,
                        DisplacementTarget.icp_score < self.ICP_HOT_THRESHOLD,
                    )
                )
                .label("warm_count"),
            )
            .where(DisplacementTarget.partner_tech.isnot(None))
            .group_by(DisplacementTarget.partner_tech)
            .order_by(desc("count"))
        )

        result = await self._session.execute(query)
        return [
            {
                "partner_tech": row.partner_tech,
                "count": row.count,
                "avg_score": round(float(row.avg_score or 0), 1),
                "hot_count": row.hot_count,
                "warm_count": row.warm_count,
            }
            for row in result.all()
        ]

    # =========================================================================
    # Traffic & Financial Filtering
    # =========================================================================

    async def list_by_traffic(
        self,
        min_monthly_visits: int,
        *,
        max_monthly_visits: Optional[int] = None,
        limit: int = 100,
    ) -> List[DisplacementTarget]:
        """
        List targets by monthly traffic range.

        Args:
            min_monthly_visits: Minimum monthly visits
            max_monthly_visits: Optional maximum monthly visits
            limit: Maximum results

        Returns:
            List of targets in traffic range
        """
        advanced_filters = [
            ("sw_monthly_visits", FilterOperator.GTE, min_monthly_visits),
        ]

        if max_monthly_visits:
            advanced_filters.append(
                ("sw_monthly_visits", FilterOperator.LTE, max_monthly_visits)
            )

        return await self.list(
            advanced_filters=advanced_filters,
            order_by=[("sw_monthly_visits", "desc")],
            limit=limit,
        )

    async def list_public_companies(
        self,
        *,
        min_revenue: Optional[float] = None,
        limit: int = 100,
    ) -> List[DisplacementTarget]:
        """
        List public company targets.

        Args:
            min_revenue: Optional minimum revenue filter
            limit: Maximum results

        Returns:
            List of public company targets
        """
        filters = {"is_public": True}
        advanced_filters = []

        if min_revenue:
            advanced_filters.append(
                ("revenue", FilterOperator.GTE, min_revenue)
            )

        return await self.list(
            filters=filters,
            advanced_filters=advanced_filters if advanced_filters else None,
            order_by=[("revenue", "desc")],
            limit=limit,
        )

    # =========================================================================
    # Competitive Intelligence
    # =========================================================================

    async def list_by_current_search(
        self,
        search_provider: str,
        *,
        limit: int = 100,
    ) -> List[DisplacementTarget]:
        """
        List targets using a specific search provider.

        Args:
            search_provider: Current search provider (e.g., "Elasticsearch", "Coveo")
            limit: Maximum results

        Returns:
            List of targets using that search provider
        """
        query = (
            select(DisplacementTarget)
            .where(DisplacementTarget.current_search.ilike(f"%{search_provider}%"))
            .order_by(desc(DisplacementTarget.icp_score))
            .limit(limit)
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def list_with_competitors_using_algolia(
        self,
        *,
        limit: int = 100,
    ) -> List[DisplacementTarget]:
        """
        List targets whose competitors are using Algolia.

        These are high-priority displacement opportunities.

        Args:
            limit: Maximum results

        Returns:
            List of targets with Algolia-using competitors
        """
        query = (
            select(DisplacementTarget)
            .where(DisplacementTarget.competitors_using_algolia.isnot(None))
            .where(DisplacementTarget.competitors_using_algolia != "[]")
            .order_by(desc(DisplacementTarget.icp_score))
            .limit(limit)
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())

    # =========================================================================
    # Enrichment Status
    # =========================================================================

    async def list_needs_enrichment(
        self,
        *,
        max_age_days: int = 30,
        enrichment_level: Optional[str] = None,
        limit: int = 100,
    ) -> List[DisplacementTarget]:
        """
        List targets that need enrichment.

        Args:
            max_age_days: Consider stale if not enriched in this many days
            enrichment_level: Optional filter by current enrichment level
            limit: Maximum results

        Returns:
            List of targets needing enrichment
        """
        cutoff_date = datetime.utcnow() - timedelta(days=max_age_days)

        conditions = [
            or_(
                DisplacementTarget.last_enriched.is_(None),
                DisplacementTarget.last_enriched < cutoff_date,
            )
        ]

        if enrichment_level:
            conditions.append(
                DisplacementTarget.enrichment_level == enrichment_level
            )

        query = (
            select(DisplacementTarget)
            .where(and_(*conditions))
            .order_by(desc(DisplacementTarget.icp_score))
            .limit(limit)
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def mark_enriched(
        self,
        domain: str,
        *,
        enrichment_level: str = "full",
    ) -> DisplacementTarget:
        """
        Mark a target as enriched.

        Args:
            domain: Target domain
            enrichment_level: Level of enrichment ("basic", "standard", "full")

        Returns:
            Updated target

        Raises:
            NotFoundError: If target not found
        """
        target = await self.get_by_domain_or_raise(domain)
        return await self.update(
            target.id,
            {
                "enrichment_level": enrichment_level,
                "last_enriched": datetime.utcnow(),
            },
            validate_source=False,
        )

    # =========================================================================
    # Statistics
    # =========================================================================

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get aggregate statistics for displacement targets.

        Returns:
            Dictionary with target statistics
        """
        query = select(
            func.count().label("total"),
            func.count()
            .filter(DisplacementTarget.icp_score >= self.ICP_HOT_THRESHOLD)
            .label("hot"),
            func.count()
            .filter(
                and_(
                    DisplacementTarget.icp_score >= self.ICP_WARM_THRESHOLD,
                    DisplacementTarget.icp_score < self.ICP_HOT_THRESHOLD,
                )
            )
            .label("warm"),
            func.count()
            .filter(
                and_(
                    DisplacementTarget.icp_score >= self.ICP_COOL_THRESHOLD,
                    DisplacementTarget.icp_score < self.ICP_WARM_THRESHOLD,
                )
            )
            .label("cool"),
            func.count()
            .filter(DisplacementTarget.icp_score < self.ICP_COOL_THRESHOLD)
            .label("cold"),
            func.count()
            .filter(DisplacementTarget.icp_score.is_(None))
            .label("unscored"),
            func.avg(DisplacementTarget.icp_score).label("avg_score"),
            func.sum(DisplacementTarget.sw_monthly_visits).label("total_traffic"),
            func.count().filter(DisplacementTarget.is_public == True).label("public_companies"),  # noqa: E712
        )

        result = await self._session.execute(query)
        row = result.one()

        return {
            "total": row.total or 0,
            "by_tier": {
                "hot": row.hot or 0,
                "warm": row.warm or 0,
                "cool": row.cool or 0,
                "cold": row.cold or 0,
                "unscored": row.unscored or 0,
            },
            "avg_icp_score": round(float(row.avg_score or 0), 1),
            "total_monthly_traffic": row.total_traffic or 0,
            "public_companies": row.public_companies or 0,
        }

    async def get_vertical_distribution(self) -> List[Dict[str, Any]]:
        """
        Get target distribution by vertical.

        Returns:
            List of verticals with counts and avg scores
        """
        query = (
            select(
                DisplacementTarget.vertical,
                func.count().label("count"),
                func.avg(DisplacementTarget.icp_score).label("avg_score"),
                func.count()
                .filter(DisplacementTarget.icp_score >= self.ICP_HOT_THRESHOLD)
                .label("hot_count"),
            )
            .where(DisplacementTarget.vertical.isnot(None))
            .group_by(DisplacementTarget.vertical)
            .order_by(desc("count"))
        )

        result = await self._session.execute(query)
        return [
            {
                "vertical": row.vertical,
                "count": row.count,
                "avg_score": round(float(row.avg_score or 0), 1),
                "hot_count": row.hot_count,
            }
            for row in result.all()
        ]

    # =========================================================================
    # Search
    # =========================================================================

    async def search(
        self,
        query: str,
        *,
        fields: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[DisplacementTarget]:
        """
        Search targets by name or domain.

        Args:
            query: Search query
            fields: Fields to search (default: company_name, domain)
            limit: Maximum results

        Returns:
            List of matching targets
        """
        search_fields = fields or ["company_name", "domain"]
        search_term = f"%{query}%"

        conditions = []
        for field in search_fields:
            if hasattr(DisplacementTarget, field):
                conditions.append(
                    getattr(DisplacementTarget, field).ilike(search_term)
                )

        if not conditions:
            return []

        stmt = (
            select(DisplacementTarget)
            .where(or_(*conditions))
            .order_by(desc(DisplacementTarget.icp_score))
            .limit(limit)
        )

        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class CompetitiveIntelRepository(BaseRepository[CompetitiveIntel]):
    """
    Repository for competitive intelligence data.

    Tracks competitor relationships and their search providers
    to identify Algolia displacement opportunities.
    """

    model = CompetitiveIntel

    def validate_source_citation(self, data: Dict[str, Any]) -> bool:
        """
        Competitive intel data should have source attribution.

        Currently not strictly enforced but recommended.
        """
        return True

    async def get_competitors_for_target(
        self,
        target_domain: str,
    ) -> List[CompetitiveIntel]:
        """
        Get all competitor records for a target domain.

        Args:
            target_domain: Domain of the target company

        Returns:
            List of competitive intelligence records
        """
        query = (
            select(CompetitiveIntel)
            .where(
                CompetitiveIntel.target_domain == target_domain.lower().strip()
            )
            .order_by(desc(CompetitiveIntel.similarity_score))
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_competitors_using_algolia(
        self,
        target_domain: str,
    ) -> List[CompetitiveIntel]:
        """
        Get competitors of a target that are using Algolia.

        Args:
            target_domain: Domain of the target company

        Returns:
            List of competitors using Algolia
        """
        query = (
            select(CompetitiveIntel)
            .where(
                and_(
                    CompetitiveIntel.target_domain == target_domain.lower().strip(),
                    CompetitiveIntel.has_algolia == True,  # noqa: E712
                )
            )
            .order_by(desc(CompetitiveIntel.similarity_score))
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def upsert_competitor(
        self,
        target_domain: str,
        competitor_domain: str,
        data: Dict[str, Any],
    ) -> CompetitiveIntel:
        """
        Create or update a competitor record.

        Args:
            target_domain: Target company domain
            competitor_domain: Competitor company domain
            data: Competitor intelligence data

        Returns:
            Created or updated record
        """
        existing = await self.get_by_field("target_domain", target_domain)

        # Find if this specific competitor already exists
        query = select(CompetitiveIntel).where(
            and_(
                CompetitiveIntel.target_domain == target_domain.lower().strip(),
                CompetitiveIntel.competitor_domain == competitor_domain.lower().strip(),
            )
        )
        result = await self._session.execute(query)
        existing = result.scalar_one_or_none()

        data["target_domain"] = target_domain.lower().strip()
        data["competitor_domain"] = competitor_domain.lower().strip()

        if existing:
            return await self.update(existing.id, data, validate_source=False)
        else:
            return await self.create(data, validate_source=False)
