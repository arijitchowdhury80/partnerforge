"""
Company Repository - Algolia Customer Management

Provides operations for managing Algolia customer companies with:
- Domain-based lookups (primary identifier)
- Vertical/industry filtering
- Customer consent tracking
- Case study matching
- Technology stack associations

Usage:
    repo = CompanyRepository(session)

    # Get by domain
    company = await repo.get_by_domain("costco.com")

    # List by vertical
    retail = await repo.list_by_vertical("Retail", limit=50)

    # Find companies with case study consent
    consentable = await repo.list_with_consent("case_study")
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .base import (
    BaseRepository,
    FilterOperator,
    NotFoundError,
    ValidationError,
    SourceCitationError,
)
from ..models.core import Company, Technology, CompanyTechnology, CustomerLogo
from ..models.evidence import CaseStudy
from ..models.targets import DisplacementTarget


class CompanyRepository(BaseRepository[Company]):
    """
    Repository for Algolia customer companies.

    Companies represent EXISTING Algolia customers used for:
    - Exclusion from displacement targets
    - Case study matching
    - Logo/consent tracking
    - Reference customer identification
    """

    model = Company

    def validate_source_citation(self, data: Dict[str, Any]) -> bool:
        """
        Companies don't require source citation for most fields.

        Source citation is only required for:
        - algolia_arr (if provided, needs data_source)
        - External data imports
        """
        # Companies are internal records, source citation not strictly required
        # But if financial data is provided, we recommend source tracking
        if "algolia_arr" in data and data["algolia_arr"] is not None:
            # Log a warning but don't fail - this is internal data
            pass
        return True

    # =========================================================================
    # Domain-Based Operations
    # =========================================================================

    async def get_by_domain(
        self,
        domain: str,
        *,
        load_relations: Optional[List[str]] = None,
    ) -> Optional[Company]:
        """
        Get a company by its domain (primary identifier).

        Args:
            domain: Company domain (e.g., "costco.com")
            load_relations: Relationships to eagerly load

        Returns:
            Company if found, None otherwise
        """
        return await self.get_by_field(
            "domain",
            domain.lower().strip(),
            load_relations=load_relations,
        )

    async def get_by_domain_or_raise(
        self,
        domain: str,
        *,
        load_relations: Optional[List[str]] = None,
    ) -> Company:
        """
        Get a company by domain or raise NotFoundError.

        Args:
            domain: Company domain
            load_relations: Relationships to eagerly load

        Returns:
            Company

        Raises:
            NotFoundError: If company not found
        """
        company = await self.get_by_domain(domain, load_relations=load_relations)
        if company is None:
            raise NotFoundError("Company", domain)
        return company

    async def domain_exists(self, domain: str) -> bool:
        """
        Check if a domain already exists in the database.

        Args:
            domain: Domain to check

        Returns:
            True if exists
        """
        return await self.exists("domain", domain.lower().strip())

    async def upsert_by_domain(
        self,
        domain: str,
        data: Dict[str, Any],
    ) -> Tuple[Company, bool]:
        """
        Create or update a company by domain.

        Args:
            domain: Company domain
            data: Company data to upsert

        Returns:
            Tuple of (company, created) where created is True if new
        """
        data["domain"] = domain.lower().strip()
        return await self.upsert("domain", data["domain"], data, validate_source=False)

    # =========================================================================
    # Vertical/Industry Filtering
    # =========================================================================

    async def list_by_vertical(
        self,
        vertical: str,
        *,
        sub_vertical: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Company]:
        """
        List companies by vertical (and optionally sub-vertical).

        Args:
            vertical: Industry vertical (e.g., "Retail", "Marketplace")
            sub_vertical: Optional sub-vertical filter
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of companies
        """
        filters = {"vertical": vertical}
        if sub_vertical:
            filters["sub_vertical"] = sub_vertical

        return await self.list(
            filters=filters,
            limit=limit,
            offset=offset,
            order_by=[("name", "asc")],
        )

    async def get_verticals(self) -> List[Dict[str, Any]]:
        """
        Get all unique verticals with counts.

        Returns:
            List of {"vertical": str, "count": int}
        """
        query = (
            select(Company.vertical, func.count().label("count"))
            .where(Company.vertical.isnot(None))
            .group_by(Company.vertical)
            .order_by(desc("count"))
        )

        result = await self._session.execute(query)
        return [{"vertical": row[0], "count": row[1]} for row in result.all()]

    async def get_sub_verticals(self, vertical: str) -> List[Dict[str, Any]]:
        """
        Get sub-verticals for a given vertical with counts.

        Args:
            vertical: Parent vertical

        Returns:
            List of {"sub_vertical": str, "count": int}
        """
        query = (
            select(Company.sub_vertical, func.count().label("count"))
            .where(
                and_(
                    Company.vertical == vertical,
                    Company.sub_vertical.isnot(None),
                )
            )
            .group_by(Company.sub_vertical)
            .order_by(desc("count"))
        )

        result = await self._session.execute(query)
        return [{"sub_vertical": row[0], "count": row[1]} for row in result.all()]

    # =========================================================================
    # Consent/Permission Operations
    # =========================================================================

    async def list_with_consent(
        self,
        consent_type: str,
        *,
        vertical: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Company]:
        """
        List companies with specific consent/permission.

        Args:
            consent_type: Type of consent:
                - "logo" -> has_logo_rights = True
                - "case_study" -> has_case_study_consent = True
                - "reference" -> has_reference_consent = True
            vertical: Optional vertical filter
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of companies with the consent

        Raises:
            ValidationError: If consent_type is invalid
        """
        consent_fields = {
            "logo": "has_logo_rights",
            "case_study": "has_case_study_consent",
            "reference": "has_reference_consent",
        }

        if consent_type not in consent_fields:
            raise ValidationError(
                f"Invalid consent_type: {consent_type}. "
                f"Must be one of: {list(consent_fields.keys())}"
            )

        filters = {consent_fields[consent_type]: True}
        if vertical:
            filters["vertical"] = vertical

        return await self.list(
            filters=filters,
            limit=limit,
            offset=offset,
        )

    async def update_consent(
        self,
        domain: str,
        *,
        has_logo_rights: Optional[bool] = None,
        has_case_study_consent: Optional[bool] = None,
        has_reference_consent: Optional[bool] = None,
    ) -> Company:
        """
        Update consent flags for a company.

        Args:
            domain: Company domain
            has_logo_rights: Logo usage permission
            has_case_study_consent: Case study permission
            has_reference_consent: Reference customer permission

        Returns:
            Updated company

        Raises:
            NotFoundError: If company not found
        """
        company = await self.get_by_domain_or_raise(domain)

        update_data = {}
        if has_logo_rights is not None:
            update_data["has_logo_rights"] = has_logo_rights
        if has_case_study_consent is not None:
            update_data["has_case_study_consent"] = has_case_study_consent
        if has_reference_consent is not None:
            update_data["has_reference_consent"] = has_reference_consent

        if update_data:
            return await self.update(company.id, update_data, validate_source=False)

        return company

    # =========================================================================
    # Technology Stack Operations
    # =========================================================================

    async def get_with_technologies(self, domain: str) -> Optional[Company]:
        """
        Get a company with its technology stack loaded.

        Args:
            domain: Company domain

        Returns:
            Company with technologies relationship loaded
        """
        query = (
            select(Company)
            .where(Company.domain == domain.lower().strip())
            .options(
                selectinload(Company.technologies).selectinload(
                    CompanyTechnology.technology
                )
            )
        )

        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def add_technology(
        self,
        domain: str,
        technology_name: str,
        *,
        source: str = "manual",
    ) -> CompanyTechnology:
        """
        Add a technology to a company's stack.

        Args:
            domain: Company domain
            technology_name: Name of technology to add
            source: Source of this data (e.g., "builtwith", "manual")

        Returns:
            Created CompanyTechnology association

        Raises:
            NotFoundError: If company not found
            ValidationError: If technology not found
        """
        company = await self.get_by_domain_or_raise(domain)

        # Get or validate technology
        tech_query = select(Technology).where(Technology.name == technology_name)
        result = await self._session.execute(tech_query)
        technology = result.scalar_one_or_none()

        if technology is None:
            raise ValidationError(f"Technology not found: {technology_name}")

        # Create association
        assoc = CompanyTechnology(
            company_id=company.id,
            technology_id=technology.id,
            source=source,
            is_live=True,
            created_at=datetime.utcnow(),
        )

        self._session.add(assoc)
        await self._session.flush()
        return assoc

    async def get_technologies_for_company(
        self, domain: str
    ) -> List[Dict[str, Any]]:
        """
        Get all technologies for a company.

        Args:
            domain: Company domain

        Returns:
            List of technology details
        """
        query = (
            select(Technology, CompanyTechnology)
            .join(CompanyTechnology, Technology.id == CompanyTechnology.technology_id)
            .join(Company, Company.id == CompanyTechnology.company_id)
            .where(Company.domain == domain.lower().strip())
        )

        result = await self._session.execute(query)
        return [
            {
                "name": row.Technology.name,
                "category": row.Technology.category,
                "is_partner": row.Technology.is_partner,
                "is_competitor": row.Technology.is_competitor,
                "source": row.CompanyTechnology.source,
                "is_live": row.CompanyTechnology.is_live,
            }
            for row in result.all()
        ]

    # =========================================================================
    # Case Study Operations
    # =========================================================================

    async def get_with_case_studies(self, domain: str) -> Optional[Company]:
        """
        Get a company with its case studies loaded.

        Args:
            domain: Company domain

        Returns:
            Company with case_studies relationship loaded
        """
        query = (
            select(Company)
            .where(Company.domain == domain.lower().strip())
            .options(selectinload(Company.case_studies))
        )

        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def list_with_case_studies(
        self,
        *,
        vertical: Optional[str] = None,
        limit: int = 100,
    ) -> List[Company]:
        """
        List companies that have case studies.

        Args:
            vertical: Optional vertical filter
            limit: Maximum results

        Returns:
            List of companies with case studies
        """
        query = (
            select(Company)
            .join(CaseStudy, CaseStudy.company_id == Company.id)
            .options(selectinload(Company.case_studies))
        )

        if vertical:
            query = query.where(Company.vertical == vertical)

        query = query.distinct().limit(limit)

        result = await self._session.execute(query)
        return list(result.scalars().all())

    # =========================================================================
    # Algolia Customer Status
    # =========================================================================

    async def list_algolia_customers(
        self,
        *,
        min_arr: Optional[float] = None,
        products: Optional[List[str]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Company]:
        """
        List active Algolia customers with optional filters.

        Args:
            min_arr: Minimum ARR filter
            products: Filter by Algolia products used
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of Algolia customers
        """
        query = select(Company).where(Company.is_algolia_customer == True)  # noqa: E712

        if min_arr is not None:
            query = query.where(Company.algolia_arr >= min_arr)

        if products:
            # Filter by products (stored as JSON array string)
            for product in products:
                query = query.where(Company.algolia_products.contains(product))

        query = (
            query.order_by(desc(Company.algolia_arr))
            .limit(limit)
            .offset(offset)
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_customer_stats(self) -> Dict[str, Any]:
        """
        Get aggregate statistics for Algolia customers.

        Returns:
            Dictionary with customer statistics
        """
        query = select(
            func.count().label("total_customers"),
            func.sum(Company.algolia_arr).label("total_arr"),
            func.avg(Company.algolia_arr).label("avg_arr"),
            func.count().filter(Company.has_logo_rights == True).label("with_logo"),  # noqa: E712
            func.count().filter(Company.has_case_study_consent == True).label("with_case_study"),  # noqa: E712
            func.count().filter(Company.has_reference_consent == True).label("with_reference"),  # noqa: E712
        ).where(Company.is_algolia_customer == True)  # noqa: E712

        result = await self._session.execute(query)
        row = result.one()

        return {
            "total_customers": row.total_customers or 0,
            "total_arr": float(row.total_arr or 0),
            "avg_arr": float(row.avg_arr or 0),
            "with_logo_rights": row.with_logo or 0,
            "with_case_study_consent": row.with_case_study or 0,
            "with_reference_consent": row.with_reference or 0,
        }

    # =========================================================================
    # Search Operations
    # =========================================================================

    async def search(
        self,
        query: str,
        *,
        fields: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[Company]:
        """
        Search companies by name or domain.

        Args:
            query: Search query
            fields: Fields to search (default: name, domain)
            limit: Maximum results

        Returns:
            List of matching companies
        """
        search_fields = fields or ["name", "domain"]
        search_term = f"%{query}%"

        conditions = []
        for field in search_fields:
            if hasattr(Company, field):
                conditions.append(getattr(Company, field).ilike(search_term))

        if not conditions:
            return []

        stmt = (
            select(Company)
            .where(or_(*conditions))
            .order_by(Company.name)
            .limit(limit)
        )

        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    # =========================================================================
    # Competitor Displacement Check
    # =========================================================================

    async def list_customers_by_competitor_displaced(
        self,
        competitor: str,
        *,
        limit: int = 100,
    ) -> List[Company]:
        """
        List customers who displaced a specific competitor.

        Useful for finding references when targeting similar prospects.

        Args:
            competitor: Competitor name (e.g., "Elasticsearch", "Coveo")
            limit: Maximum results

        Returns:
            List of companies that displaced this competitor
        """
        query = (
            select(Company)
            .where(
                and_(
                    Company.is_algolia_customer == True,  # noqa: E712
                    Company.competitor_displaced.ilike(f"%{competitor}%"),
                )
            )
            .limit(limit)
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())

    # =========================================================================
    # Intelligence Operations
    # =========================================================================

    async def get_with_intelligence(
        self,
        domain: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Get a company with its associated intelligence data.

        Retrieves company information along with displacement target data
        and intelligence module data (if available).

        Args:
            domain: Company domain

        Returns:
            Dictionary with company data and intelligence, or None if not found:
            {
                "company": Company,
                "target": DisplacementTarget | None,
                "intelligence_completeness": float,
                "has_intelligence": bool,
            }
        """
        # Get the company
        company = await self.get_by_domain(domain)
        if company is None:
            return None

        # Get displacement target data (if this domain is a target)
        target_query = select(DisplacementTarget).where(
            DisplacementTarget.domain == domain.lower().strip()
        )
        target_result = await self._session.execute(target_query)
        target = target_result.scalar_one_or_none()

        # Build response
        result = {
            "company": company,
            "target": target,
            "has_intelligence": target is not None,
            "intelligence_completeness": 0.0,
        }

        # If target exists, calculate basic intelligence completeness
        if target:
            # Count non-null intelligence fields
            intel_fields = [
                target.financials_json,
                target.hiring_signals,
                target.tech_stack_json,
                target.exec_quote,
                target.trigger_events,
                target.competitors_using_algolia,
                target.displacement_angle,
            ]
            filled_count = sum(1 for f in intel_fields if f is not None)
            result["intelligence_completeness"] = (filled_count / len(intel_fields)) * 100

        return result

    async def search_companies(
        self,
        query: str,
        *,
        include_targets: bool = False,
        min_icp_score: Optional[int] = None,
        vertical: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search companies with optional target intelligence matching.

        Extended search that can include displacement target data for
        companies that are both customers and potential targets.

        Args:
            query: Search query (matches name or domain)
            include_targets: If True, include displacement target data
            min_icp_score: Filter targets by minimum ICP score
            vertical: Filter by vertical
            limit: Maximum results

        Returns:
            List of dictionaries with company and optional target data
        """
        search_term = f"%{query}%"

        # Build company search
        company_conditions = [
            or_(
                Company.name.ilike(search_term),
                Company.domain.ilike(search_term),
            )
        ]

        if vertical:
            company_conditions.append(Company.vertical == vertical)

        company_query = (
            select(Company)
            .where(and_(*company_conditions))
            .order_by(Company.name)
            .limit(limit)
        )

        company_result = await self._session.execute(company_query)
        companies = list(company_result.scalars().all())

        if not include_targets:
            return [{"company": c, "target": None} for c in companies]

        # Get matching targets
        results = []
        for company in companies:
            target_query = select(DisplacementTarget).where(
                DisplacementTarget.domain == company.domain
            )

            if min_icp_score is not None:
                target_query = target_query.where(
                    DisplacementTarget.icp_score >= min_icp_score
                )

            target_result = await self._session.execute(target_query)
            target = target_result.scalar_one_or_none()

            results.append({
                "company": company,
                "target": target,
            })

        return results
