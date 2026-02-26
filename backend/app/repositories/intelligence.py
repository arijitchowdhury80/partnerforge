"""
Intelligence Repository - 15-Module Intelligence Data Access

Provides unified access to all 15 intelligence module tables with:
- Source citation enforcement (mandatory)
- Staleness detection (12-month max)
- Snapshot versioning integration
- Module-specific queries

Module Organization:
- Wave 1 (Foundation): M01-M04 (Company, Tech, Traffic, Financials)
- Wave 2 (Competitive): M05-M07 (Competitors, Hiring, Strategic)
- Wave 3 (Buying Signals): M08-M11 (Investor, Executive, Committee, Displacement)
- Wave 4 (Synthesis): M12-M15 (Case Study, ICP, Signals, Brief)

SOURCE CITATION MANDATE:
    Every intelligence record MUST have:
    - source_url: URL where data was obtained (REQUIRED)
    - source_date: Date of the source (REQUIRED, max 12 months old)
    - source_type: Type of source (api, webpage, document, transcript)

Usage:
    repo = IntelligenceRepository(session)

    # Get latest intelligence for a domain
    intel = await repo.get_module_data("costco.com", "m01_company_context")

    # Save with mandatory source citation
    await repo.save_module_data("costco.com", "m01_company_context", {
        "company_name": "Costco",
        "source_url": "https://builtwith.com/costco.com",
        "source_date": datetime(2026, 2, 1),
    })

    # Check staleness
    is_stale = await repo.is_stale("costco.com", "m02_tech_stack")
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Type, Union

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from .base import (
    BaseRepository,
    FilterOperator,
    NotFoundError,
    ValidationError,
    SourceCitationError,
)
from ..models.intelligence import (
    # Wave 1
    IntelCompanyContext,
    IntelTechnologyStack,
    IntelTrafficAnalysis,
    IntelFinancialProfile,
    # Wave 2
    IntelCompetitorIntelligence,
    IntelHiringSignals,
    IntelStrategicContext,
    # Wave 3
    IntelInvestorIntelligence,
    IntelExecutiveIntelligence,
    IntelBuyingCommittee,
    IntelDisplacementAnalysis,
    # Wave 4
    IntelCaseStudyMatches,
    IntelICPPriorityMapping,
    IntelSignalScoring,
    IntelStrategicSignalBrief,
)

# Type alias for any intelligence model
IntelModel = Union[
    IntelCompanyContext,
    IntelTechnologyStack,
    IntelTrafficAnalysis,
    IntelFinancialProfile,
    IntelCompetitorIntelligence,
    IntelHiringSignals,
    IntelStrategicContext,
    IntelInvestorIntelligence,
    IntelExecutiveIntelligence,
    IntelBuyingCommittee,
    IntelDisplacementAnalysis,
    IntelCaseStudyMatches,
    IntelICPPriorityMapping,
    IntelSignalScoring,
    IntelStrategicSignalBrief,
]

# Module ID to model class mapping
MODULE_MODELS: Dict[str, Type[IntelModel]] = {
    "m01_company_context": IntelCompanyContext,
    "m02_tech_stack": IntelTechnologyStack,
    "m03_traffic": IntelTrafficAnalysis,
    "m04_financials": IntelFinancialProfile,
    "m05_competitors": IntelCompetitorIntelligence,
    "m06_hiring": IntelHiringSignals,
    "m07_strategic": IntelStrategicContext,
    "m08_investor": IntelInvestorIntelligence,
    "m09_executive": IntelExecutiveIntelligence,
    "m10_buying_committee": IntelBuyingCommittee,
    "m11_displacement": IntelDisplacementAnalysis,
    "m12_case_study": IntelCaseStudyMatches,
    "m13_icp_priority": IntelICPPriorityMapping,
    "m14_signal_scoring": IntelSignalScoring,
    "m15_strategic_brief": IntelStrategicSignalBrief,
}

# Module staleness thresholds (in days)
MODULE_FRESHNESS: Dict[str, int] = {
    "m01_company_context": 90,  # Company info changes slowly
    "m02_tech_stack": 30,  # Tech stack can change
    "m03_traffic": 7,  # Traffic data should be fresh
    "m04_financials": 90,  # Quarterly updates
    "m05_competitors": 30,
    "m06_hiring": 14,  # Job postings change frequently
    "m07_strategic": 30,
    "m08_investor": 90,  # SEC filings are quarterly
    "m09_executive": 30,
    "m10_buying_committee": 30,
    "m11_displacement": 30,
    "m12_case_study": 180,  # Case studies don't change often
    "m13_icp_priority": 7,  # Scoring should be recalculated often
    "m14_signal_scoring": 7,
    "m15_strategic_brief": 30,
}

# Waves for parallel execution
WAVE_MODULES = {
    "wave_1": ["m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials"],
    "wave_2": ["m05_competitors", "m06_hiring", "m07_strategic"],
    "wave_3": ["m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement"],
    "wave_4": ["m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief"],
}


class IntelligenceRepository:
    """
    Unified repository for all 15 intelligence modules.

    Provides a single interface for accessing and managing intelligence data
    across all modules, with strict source citation enforcement.
    """

    # Maximum source age in days
    MAX_SOURCE_AGE_DAYS = 365  # 12 months - HARD REQUIREMENT

    def __init__(self, session: AsyncSession):
        """
        Initialize with database session.

        Args:
            session: AsyncSession from SQLAlchemy
        """
        self._session = session

    @property
    def session(self) -> AsyncSession:
        """Get the database session."""
        return self._session

    # =========================================================================
    # Module Registry
    # =========================================================================

    def get_model_for_module(self, module_id: str) -> Type[IntelModel]:
        """
        Get the model class for a module ID.

        Args:
            module_id: Module identifier (e.g., "m01_company_context")

        Returns:
            Model class

        Raises:
            ValidationError: If module_id is invalid
        """
        model = MODULE_MODELS.get(module_id)
        if model is None:
            raise ValidationError(
                f"Invalid module_id: {module_id}. "
                f"Valid modules: {list(MODULE_MODELS.keys())}"
            )
        return model

    def get_freshness_threshold(self, module_id: str) -> int:
        """
        Get the freshness threshold in days for a module.

        Args:
            module_id: Module identifier

        Returns:
            Number of days before data is considered stale
        """
        return MODULE_FRESHNESS.get(module_id, 30)

    # =========================================================================
    # Source Citation Validation
    # =========================================================================

    def validate_source_citation(
        self,
        data: Dict[str, Any],
        module_id: Optional[str] = None,
    ) -> bool:
        """
        Validate that data contains required source citation.

        SOURCE CITATION MANDATE:
        - source_url: REQUIRED
        - source_date: REQUIRED (max 12 months old)
        - source_type: OPTIONAL (defaults to "api")

        Args:
            data: Dictionary of field values to validate
            module_id: Optional module ID for context

        Returns:
            True if valid

        Raises:
            SourceCitationError: If source citation is missing or invalid
        """
        missing_fields = []

        # Check source_url (REQUIRED)
        if "source_url" not in data or not data["source_url"]:
            missing_fields.append("source_url")

        # Check source_date (REQUIRED)
        if "source_date" not in data or not data["source_date"]:
            missing_fields.append("source_date")

        if missing_fields:
            raise SourceCitationError(
                missing_fields,
                f"Module {module_id}" if module_id else None,
            )

        # Validate source freshness
        source_date = data["source_date"]
        if isinstance(source_date, str):
            try:
                source_date = datetime.fromisoformat(source_date.replace("Z", "+00:00"))
            except ValueError:
                raise SourceCitationError(
                    ["source_date"],
                    f"Invalid date format: {source_date}",
                )

        cutoff = datetime.utcnow() - timedelta(days=self.MAX_SOURCE_AGE_DAYS)
        if source_date < cutoff:
            raise SourceCitationError(
                ["source_date"],
                f"Source date {source_date.isoformat()} is older than {self.MAX_SOURCE_AGE_DAYS} days",
            )

        return True

    # =========================================================================
    # CRUD Operations
    # =========================================================================

    async def get_module_data(
        self,
        domain: str,
        module_id: str,
    ) -> Optional[IntelModel]:
        """
        Get intelligence data for a domain and module.

        Args:
            domain: Target domain
            module_id: Module identifier

        Returns:
            Intelligence record if found, None otherwise
        """
        model = self.get_model_for_module(module_id)
        query = select(model).where(model.domain == domain.lower().strip())
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def get_module_data_or_raise(
        self,
        domain: str,
        module_id: str,
    ) -> IntelModel:
        """
        Get intelligence data or raise NotFoundError.

        Args:
            domain: Target domain
            module_id: Module identifier

        Returns:
            Intelligence record

        Raises:
            NotFoundError: If data not found
        """
        data = await self.get_module_data(domain, module_id)
        if data is None:
            raise NotFoundError(f"Intel:{module_id}", domain)
        return data

    async def save_module_data(
        self,
        domain: str,
        module_id: str,
        data: Dict[str, Any],
        *,
        validate_source: bool = True,
    ) -> IntelModel:
        """
        Save intelligence data for a domain and module.

        Creates a new record if not exists, updates if exists (upsert).

        Args:
            domain: Target domain
            module_id: Module identifier
            data: Intelligence data to save
            validate_source: If True, validate source citation (default: True)

        Returns:
            Saved intelligence record

        Raises:
            SourceCitationError: If source citation validation fails
        """
        # Validate source citation (MANDATORY)
        if validate_source:
            self.validate_source_citation(data, module_id)

        model = self.get_model_for_module(module_id)
        data["domain"] = domain.lower().strip()

        # Set enrichment timestamp
        data["enriched_at"] = datetime.utcnow()
        data["is_stale"] = False

        # Check for existing record
        existing = await self.get_module_data(domain, module_id)

        now = datetime.utcnow()

        if existing:
            # Update existing
            data["updated_at"] = now
            for field, value in data.items():
                if hasattr(existing, field):
                    setattr(existing, field, value)
            await self._session.flush()
            return existing
        else:
            # Create new
            data["created_at"] = now
            data["updated_at"] = now
            entity = model(**data)
            self._session.add(entity)
            await self._session.flush()
            return entity

    async def delete_module_data(
        self,
        domain: str,
        module_id: str,
    ) -> bool:
        """
        Delete intelligence data for a domain and module.

        Args:
            domain: Target domain
            module_id: Module identifier

        Returns:
            True if deleted, False if not found
        """
        existing = await self.get_module_data(domain, module_id)
        if existing is None:
            return False

        await self._session.delete(existing)
        await self._session.flush()
        return True

    # =========================================================================
    # Bulk Operations
    # =========================================================================

    async def get_all_modules_for_domain(
        self,
        domain: str,
    ) -> Dict[str, Optional[IntelModel]]:
        """
        Get all intelligence modules for a domain.

        Args:
            domain: Target domain

        Returns:
            Dictionary mapping module_id to data (or None if not found)
        """
        result = {}
        for module_id in MODULE_MODELS.keys():
            result[module_id] = await self.get_module_data(domain, module_id)
        return result

    async def get_wave_data(
        self,
        domain: str,
        wave: str,
    ) -> Dict[str, Optional[IntelModel]]:
        """
        Get all modules for a specific wave.

        Args:
            domain: Target domain
            wave: Wave identifier ("wave_1", "wave_2", "wave_3", "wave_4")

        Returns:
            Dictionary mapping module_id to data

        Raises:
            ValidationError: If wave is invalid
        """
        if wave not in WAVE_MODULES:
            raise ValidationError(
                f"Invalid wave: {wave}. Valid waves: {list(WAVE_MODULES.keys())}"
            )

        result = {}
        for module_id in WAVE_MODULES[wave]:
            result[module_id] = await self.get_module_data(domain, module_id)
        return result

    async def save_wave_data(
        self,
        domain: str,
        wave: str,
        wave_data: Dict[str, Dict[str, Any]],
        *,
        validate_source: bool = True,
    ) -> Dict[str, IntelModel]:
        """
        Save all modules for a wave.

        Args:
            domain: Target domain
            wave: Wave identifier
            wave_data: Dictionary mapping module_id to data
            validate_source: If True, validate source citations

        Returns:
            Dictionary mapping module_id to saved entities

        Raises:
            ValidationError: If wave is invalid
            SourceCitationError: If any module fails source validation
        """
        if wave not in WAVE_MODULES:
            raise ValidationError(
                f"Invalid wave: {wave}. Valid waves: {list(WAVE_MODULES.keys())}"
            )

        result = {}
        for module_id, data in wave_data.items():
            if module_id not in WAVE_MODULES[wave]:
                raise ValidationError(
                    f"Module {module_id} is not part of {wave}"
                )
            result[module_id] = await self.save_module_data(
                domain, module_id, data, validate_source=validate_source
            )

        return result

    # =========================================================================
    # Staleness Detection
    # =========================================================================

    async def is_stale(
        self,
        domain: str,
        module_id: str,
    ) -> bool:
        """
        Check if intelligence data is stale.

        Data is considered stale if:
        1. It doesn't exist
        2. enriched_at is older than the module's freshness threshold
        3. is_stale flag is True
        4. source_date is older than 12 months

        Args:
            domain: Target domain
            module_id: Module identifier

        Returns:
            True if stale (needs refresh), False if fresh
        """
        data = await self.get_module_data(domain, module_id)

        if data is None:
            return True

        if data.is_stale:
            return True

        # Check enriched_at against module-specific threshold
        threshold_days = self.get_freshness_threshold(module_id)
        cutoff = datetime.utcnow() - timedelta(days=threshold_days)

        if data.enriched_at and data.enriched_at < cutoff:
            return True

        # Check source_date against hard limit
        source_cutoff = datetime.utcnow() - timedelta(days=self.MAX_SOURCE_AGE_DAYS)
        if data.source_date and data.source_date < source_cutoff:
            return True

        return False

    async def mark_as_stale(
        self,
        domain: str,
        module_id: str,
    ) -> Optional[IntelModel]:
        """
        Mark a module's data as stale.

        Args:
            domain: Target domain
            module_id: Module identifier

        Returns:
            Updated record or None if not found
        """
        data = await self.get_module_data(domain, module_id)
        if data is None:
            return None

        data.is_stale = True
        data.updated_at = datetime.utcnow()
        await self._session.flush()
        return data

    async def get_stale_modules_for_domain(
        self,
        domain: str,
    ) -> List[str]:
        """
        Get list of stale modules for a domain.

        Args:
            domain: Target domain

        Returns:
            List of module IDs that need refresh
        """
        stale = []
        for module_id in MODULE_MODELS.keys():
            if await self.is_stale(domain, module_id):
                stale.append(module_id)
        return stale

    async def list_domains_needing_refresh(
        self,
        module_id: str,
        *,
        limit: int = 100,
    ) -> List[str]:
        """
        List domains that need refresh for a specific module.

        Args:
            module_id: Module identifier
            limit: Maximum results

        Returns:
            List of domains needing refresh
        """
        model = self.get_model_for_module(module_id)
        threshold_days = self.get_freshness_threshold(module_id)
        cutoff = datetime.utcnow() - timedelta(days=threshold_days)

        query = (
            select(model.domain)
            .where(
                or_(
                    model.is_stale == True,  # noqa: E712
                    model.enriched_at < cutoff,
                    model.enriched_at.is_(None),
                )
            )
            .limit(limit)
        )

        result = await self._session.execute(query)
        return [row[0] for row in result.all()]

    # =========================================================================
    # Statistics
    # =========================================================================

    async def get_module_stats(self, module_id: str) -> Dict[str, Any]:
        """
        Get statistics for a specific module.

        Args:
            module_id: Module identifier

        Returns:
            Dictionary with module statistics
        """
        model = self.get_model_for_module(module_id)
        threshold_days = self.get_freshness_threshold(module_id)
        cutoff = datetime.utcnow() - timedelta(days=threshold_days)

        query = select(
            func.count().label("total"),
            func.count().filter(model.is_stale == True).label("stale_flagged"),  # noqa: E712
            func.count().filter(model.enriched_at < cutoff).label("stale_by_age"),
            func.avg(model.confidence_score).label("avg_confidence"),
            func.max(model.enriched_at).label("latest_enrichment"),
            func.min(model.enriched_at).label("oldest_enrichment"),
        )

        result = await self._session.execute(query)
        row = result.one()

        return {
            "module_id": module_id,
            "total_records": row.total or 0,
            "stale_flagged": row.stale_flagged or 0,
            "stale_by_age": row.stale_by_age or 0,
            "avg_confidence": round(float(row.avg_confidence or 0), 2),
            "latest_enrichment": row.latest_enrichment,
            "oldest_enrichment": row.oldest_enrichment,
            "freshness_threshold_days": threshold_days,
        }

    async def get_all_module_stats(self) -> List[Dict[str, Any]]:
        """
        Get statistics for all modules.

        Returns:
            List of module statistics
        """
        stats = []
        for module_id in MODULE_MODELS.keys():
            stats.append(await self.get_module_stats(module_id))
        return stats

    async def get_domain_completeness(self, domain: str) -> Dict[str, Any]:
        """
        Get completeness report for a domain.

        Shows which modules have data and their freshness status.

        Args:
            domain: Target domain

        Returns:
            Completeness report
        """
        all_data = await self.get_all_modules_for_domain(domain)

        complete = []
        missing = []
        stale = []

        for module_id, data in all_data.items():
            if data is None:
                missing.append(module_id)
            elif await self.is_stale(domain, module_id):
                stale.append(module_id)
            else:
                complete.append(module_id)

        total = len(MODULE_MODELS)
        completeness_pct = (len(complete) / total) * 100 if total > 0 else 0

        return {
            "domain": domain,
            "completeness_percent": round(completeness_pct, 1),
            "total_modules": total,
            "complete_count": len(complete),
            "missing_count": len(missing),
            "stale_count": len(stale),
            "complete_modules": complete,
            "missing_modules": missing,
            "stale_modules": stale,
        }

    # =========================================================================
    # Specific Module Queries
    # =========================================================================

    async def get_executive_quotes(
        self,
        domain: str,
    ) -> List[Dict[str, Any]]:
        """
        Get executive quotes for a domain.

        Args:
            domain: Target domain

        Returns:
            List of quotes with attribution
        """
        data = await self.get_module_data(domain, "m09_executive")
        if data is None or not data.quotes:
            return []

        return data.quotes if isinstance(data.quotes, list) else []

    async def get_strategic_brief(
        self,
        domain: str,
    ) -> Optional[IntelStrategicSignalBrief]:
        """
        Get the strategic signal brief for a domain.

        Args:
            domain: Target domain

        Returns:
            Strategic brief if exists
        """
        return await self.get_module_data(domain, "m15_strategic_brief")

    async def list_domains_with_brief(
        self,
        *,
        approved_only: bool = False,
        limit: int = 100,
    ) -> List[str]:
        """
        List domains that have strategic briefs.

        Args:
            approved_only: If True, only return approved briefs
            limit: Maximum results

        Returns:
            List of domains
        """
        query = select(IntelStrategicSignalBrief.domain)

        if approved_only:
            query = query.where(IntelStrategicSignalBrief.is_approved == True)  # noqa: E712

        query = query.order_by(desc(IntelStrategicSignalBrief.generated_at)).limit(limit)

        result = await self._session.execute(query)
        return [row[0] for row in result.all()]

    async def get_icp_ranking(
        self,
        *,
        tier: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get ICP priority ranking.

        Args:
            tier: Optional filter by tier ("hot", "warm", "cool", "cold")
            limit: Maximum results

        Returns:
            List of domains with ICP data, ranked by priority score
        """
        query = select(IntelICPPriorityMapping)

        if tier:
            query = query.where(IntelICPPriorityMapping.icp_tier == tier.lower())

        query = (
            query.order_by(
                desc(IntelICPPriorityMapping.priority_score),
                desc(IntelICPPriorityMapping.icp_score),
            )
            .limit(limit)
        )

        result = await self._session.execute(query)

        return [
            {
                "domain": row.domain,
                "icp_score": row.icp_score,
                "icp_tier": row.icp_tier,
                "priority_score": row.priority_score,
                "priority_rank": row.priority_rank,
                "score_breakdown": row.score_breakdown,
            }
            for row in result.scalars().all()
        ]
