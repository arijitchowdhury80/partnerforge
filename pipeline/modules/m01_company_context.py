"""
M01: Company Context Module
===========================

Establishes baseline company information for all downstream analysis.

Wave: 1 (Foundation - No dependencies)

Data Sources:
- WebSearch (company website, Wikipedia, Crunchbase)
- BuiltWith domain lookup (for company meta)
- SimilarWeb company overview (fallback)

Output Schema:
- domain: str
- company_name: str
- ticker: Optional[str]
- exchange: Optional[str]
- is_public: bool
- headquarters: dict (city, state, country)
- industry: str
- vertical: str
- sub_vertical: str
- business_model: str
- employee_count: Optional[int]
- store_count: Optional[int]
- fiscal_year_end: Optional[str]
- founded_year: Optional[int]
- description: str
- brands: List[str]
- source_urls: List[dict]

Database Table: intel_company_context

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M01 section)
- docs/DATABASE_SCHEMA_V2.md (intel_company_context)
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, HttpUrl

from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    ModuleError,
    DataNotFoundError,
    register_module,
)

logger = logging.getLogger(__name__)


class Headquarters(BaseModel):
    """Company headquarters location."""
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class CompanyContextData(BaseModel):
    """
    Output schema for M01 Company Context module.

    All fields should have source citations traceable through
    the ModuleResult's primary_citation and supporting_citations.
    """

    domain: str = Field(..., description="Primary domain")
    company_name: Optional[str] = Field(None, description="Official company name")
    ticker: Optional[str] = Field(None, description="Stock ticker symbol")
    exchange: Optional[str] = Field(None, description="Stock exchange (NYSE, NASDAQ, etc.)")
    is_public: bool = Field(default=False, description="Whether company is publicly traded")

    headquarters: Headquarters = Field(default_factory=Headquarters, description="HQ location")

    industry: Optional[str] = Field(None, description="Primary industry")
    vertical: Optional[str] = Field(None, description="Business vertical (Commerce, Content, Support)")
    sub_vertical: Optional[str] = Field(None, description="Sub-vertical classification")
    business_model: Optional[str] = Field(None, description="Business model (B2B, B2C, B2B2C)")

    employee_count: Optional[int] = Field(None, description="Estimated employee count")
    store_count: Optional[int] = Field(None, description="Number of physical stores")
    fiscal_year_end: Optional[str] = Field(None, description="Fiscal year end date")
    founded_year: Optional[int] = Field(None, description="Year company was founded")

    description: Optional[str] = Field(None, description="Company description")
    brands: List[str] = Field(default_factory=list, description="Sub-brands or product lines")

    website_url: Optional[str] = Field(None, description="Primary website URL")
    investor_relations_url: Optional[str] = Field(None, description="Investor relations page URL")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn company page URL")

    # Enrichment metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Data completeness score")
    enrichment_sources: List[str] = Field(default_factory=list, description="Sources used for enrichment")


# Vertical classification mapping
VERTICAL_KEYWORDS = {
    "Commerce": [
        "retail", "ecommerce", "e-commerce", "shopping", "store", "marketplace",
        "wholesale", "consumer goods", "fashion", "apparel", "beauty", "grocery",
        "automotive", "furniture", "electronics", "sporting goods", "luxury",
    ],
    "Content": [
        "media", "publishing", "news", "entertainment", "streaming", "education",
        "documentation", "knowledge base", "wiki", "blog", "magazine", "library",
    ],
    "Support": [
        "customer service", "help desk", "support portal", "self-service",
        "ticketing", "community", "forum", "faq", "troubleshooting",
    ],
}

# Business model detection
BUSINESS_MODEL_KEYWORDS = {
    "B2C": [
        "consumer", "retail", "direct-to-consumer", "d2c", "dtc", "shopping",
        "personal", "individual", "customer",
    ],
    "B2B": [
        "enterprise", "business", "professional", "wholesale", "b2b",
        "corporate", "commercial", "industrial",
    ],
    "B2B2C": [
        "marketplace", "platform", "multi-vendor", "distribution", "franchise",
    ],
}


@register_module
class M01CompanyContext(BaseModule):
    """
    Company Context Intelligence Module.

    Collects baseline company information from multiple sources.
    This module has no dependencies and runs in Wave 1.

    Data Flow:
    1. Attempt to get company info from WebSearch
    2. Enrich with BuiltWith domain meta (if available)
    3. Classify vertical and business model
    4. Calculate data quality score
    5. Return with source citations

    Graceful Degradation:
    - If WebSearch fails, try to extract from domain
    - If company is private, is_public=False, no ticker
    - Missing fields marked as None (not errors)
    """

    MODULE_ID = "m01_company_context"
    MODULE_NAME = "Company Context"
    DESCRIPTION = "Baseline company information for downstream analysis"

    WAVE = 1
    DEPENDS_ON = []  # No dependencies

    PRIMARY_SOURCE_TYPE = SourceType.WEBSEARCH
    OUTPUT_TABLE = "intel_company_context"
    TIMEOUT_SECONDS = 60

    # Mock data for testing (will be replaced by actual API calls)
    _MOCK_COMPANY_DATA = {
        "costco.com": {
            "company_name": "Costco Wholesale Corporation",
            "ticker": "COST",
            "exchange": "NASDAQ",
            "is_public": True,
            "headquarters": {"city": "Issaquah", "state": "Washington", "country": "USA"},
            "industry": "Warehouse Club Retail",
            "vertical": "Commerce",
            "sub_vertical": "Wholesale/Membership Retail",
            "business_model": "B2C",
            "employee_count": 316000,
            "store_count": 891,
            "fiscal_year_end": "September 1",
            "founded_year": 1983,
            "description": "Costco Wholesale Corporation operates membership warehouses and e-commerce websites offering a selection of branded merchandise.",
            "brands": ["Costco", "Kirkland Signature", "Costco Business Center"],
        },
        "sallybeauty.com": {
            "company_name": "Sally Beauty Holdings, Inc.",
            "ticker": "SBH",
            "exchange": "NYSE",
            "is_public": True,
            "headquarters": {"city": "Denton", "state": "Texas", "country": "USA"},
            "industry": "Specialty Beauty Retail & Distribution",
            "vertical": "Commerce",
            "sub_vertical": "Beauty & Personal Care",
            "business_model": "B2C",
            "employee_count": 27000,
            "store_count": 4000,
            "fiscal_year_end": "September 30",
            "founded_year": 1964,
            "description": "Sally Beauty Holdings is a specialty retailer and distributor of professional beauty supplies.",
            "brands": ["Sally Beauty Supply", "Beauty Systems Group", "CosmoProf"],
        },
        "mercedes-benz.com": {
            "company_name": "Mercedes-Benz Group AG",
            "ticker": "MBG",
            "exchange": "XETRA",
            "is_public": True,
            "headquarters": {"city": "Stuttgart", "state": "Baden-Wurttemberg", "country": "Germany"},
            "industry": "Automotive Manufacturing",
            "vertical": "Commerce",
            "sub_vertical": "Automotive",
            "business_model": "B2C",
            "employee_count": 168000,
            "founded_year": 1926,
            "description": "Mercedes-Benz Group AG is a German multinational automotive corporation and one of the world's leading automobile manufacturers.",
            "brands": ["Mercedes-Benz", "AMG", "Maybach", "EQ"],
        },
    }

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute company context enrichment.

        Args:
            domain: The domain to enrich
            context: Not used (Wave 1 module has no dependencies)

        Returns:
            ModuleResult with CompanyContextData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting company context enrichment for {domain}")

            # Normalize domain (remove protocol, www, trailing slash)
            normalized_domain = self._normalize_domain(domain)

            # Fetch company data from sources
            company_data, citations = await self._fetch_company_data(normalized_domain)

            # Classify vertical if not already set
            if not company_data.get("vertical"):
                company_data["vertical"] = self._classify_vertical(company_data)

            # Detect business model if not already set
            if not company_data.get("business_model"):
                company_data["business_model"] = self._detect_business_model(company_data)

            # Calculate data quality score
            data_quality = self._calculate_data_quality(company_data)
            company_data["data_quality_score"] = data_quality
            company_data["enrichment_sources"] = [c.source_type.value for c in citations]

            # Create output data model
            output_data = CompanyContextData(
                domain=normalized_domain,
                **company_data
            )

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Record success
            self._record_execution(success=True, duration_ms=duration_ms)

            # Create result with citations
            result = self._create_result(
                domain=normalized_domain,
                data=output_data.model_dump(),
                primary_citation=citations[0] if citations else self._create_default_citation(normalized_domain),
                supporting_citations=citations[1:] if len(citations) > 1 else [],
                duration_ms=duration_ms,
            )

            # Validate output
            self.validate_output(result)

            self.logger.info(
                f"Company context enrichment complete for {domain}. "
                f"Quality score: {data_quality:.2f}, Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Company context enrichment failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """
        Validate module output.

        Required fields:
        - domain (always present)
        - primary_citation (P0 requirement)

        Returns True if valid, raises ValueError otherwise.
        """
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        # Validate citation is not expired
        if result.primary_citation.freshness_status == FreshnessStatus.EXPIRED:
            self.logger.warning(
                f"Primary citation for {result.domain} is EXPIRED. "
                f"Age: {result.primary_citation.age_days:.1f} days"
            )

        return True

    async def _fetch_company_data(
        self,
        domain: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """
        Fetch company data from available sources.

        In production, this would call:
        1. WebSearch for company info
        2. BuiltWith for domain metadata
        3. Company website scraping

        For now, uses mock data or extracts basic info from domain.

        Args:
            domain: Normalized domain

        Returns:
            Tuple of (company_data dict, list of citations)
        """
        citations = []

        # Check for mock data (will be replaced with real API calls)
        if domain in self._MOCK_COMPANY_DATA:
            company_data = self._MOCK_COMPANY_DATA[domain].copy()

            # Create citation for mock data (simulating WebSearch)
            citation = self._create_citation(
                source_type=SourceType.WEBSEARCH,
                source_url=f"https://www.google.com/search?q={domain}+company+info",
                api_endpoint="websearch",
                confidence=0.9,
            )
            citations.append(citation)

            return company_data, citations

        # Fallback: extract basic info from domain
        company_data = self._extract_from_domain(domain)

        # Create citation for domain-extracted data
        citation = self._create_citation(
            source_type=SourceType.COMPANY_WEBSITE,
            source_url=f"https://{domain}",
            confidence=0.5,  # Lower confidence for inferred data
            notes="Data inferred from domain name",
        )
        citations.append(citation)

        return company_data, citations

    def _extract_from_domain(self, domain: str) -> Dict[str, Any]:
        """
        Extract basic company info from domain name.

        This is a fallback when no other data is available.
        """
        # Remove TLD and extract name
        parts = domain.split(".")
        name_part = parts[0] if parts else domain

        # Basic capitalization
        company_name = name_part.replace("-", " ").replace("_", " ").title()

        return {
            "company_name": company_name,
            "is_public": False,  # Assume private unless we find otherwise
            "description": f"Company operating at {domain}",
            "website_url": f"https://{domain}",
        }

    def _normalize_domain(self, domain: str) -> str:
        """
        Normalize domain for consistent processing.

        Removes:
        - Protocol (http://, https://)
        - www. prefix
        - Trailing slashes
        - Query parameters
        """
        domain = domain.lower().strip()

        # Remove protocol
        if domain.startswith("https://"):
            domain = domain[8:]
        elif domain.startswith("http://"):
            domain = domain[7:]

        # Remove www.
        if domain.startswith("www."):
            domain = domain[4:]

        # Remove trailing slash and path
        if "/" in domain:
            domain = domain.split("/")[0]

        # Remove query parameters
        if "?" in domain:
            domain = domain.split("?")[0]

        return domain

    def _classify_vertical(self, company_data: Dict[str, Any]) -> str:
        """
        Classify company into vertical (Commerce, Content, Support).

        Uses keyword matching on industry and description.
        """
        text_to_search = " ".join([
            company_data.get("industry", ""),
            company_data.get("description", ""),
        ]).lower()

        scores = {vertical: 0 for vertical in VERTICAL_KEYWORDS}

        for vertical, keywords in VERTICAL_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text_to_search:
                    scores[vertical] += 1

        # Return vertical with highest score, default to Commerce
        best_vertical = max(scores, key=scores.get)
        return best_vertical if scores[best_vertical] > 0 else "Commerce"

    def _detect_business_model(self, company_data: Dict[str, Any]) -> str:
        """
        Detect business model (B2B, B2C, B2B2C).

        Uses keyword matching on industry and description.
        """
        text_to_search = " ".join([
            company_data.get("industry", ""),
            company_data.get("description", ""),
        ]).lower()

        scores = {model: 0 for model in BUSINESS_MODEL_KEYWORDS}

        for model, keywords in BUSINESS_MODEL_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text_to_search:
                    scores[model] += 1

        # Return model with highest score, default to B2C
        best_model = max(scores, key=scores.get)
        return best_model if scores[best_model] > 0 else "B2C"

    def _calculate_data_quality(self, company_data: Dict[str, Any]) -> float:
        """
        Calculate data quality/completeness score (0.0 - 1.0).

        Weights:
        - company_name: 0.2
        - headquarters: 0.1
        - industry: 0.1
        - description: 0.15
        - employee_count: 0.1
        - ticker (if public): 0.15
        - brands: 0.1
        - founded_year: 0.1
        """
        score = 0.0

        if company_data.get("company_name"):
            score += 0.2

        hq = company_data.get("headquarters", {})
        if isinstance(hq, dict) and (hq.get("city") or hq.get("country")):
            score += 0.1

        if company_data.get("industry"):
            score += 0.1

        if company_data.get("description") and len(company_data["description"]) > 20:
            score += 0.15

        if company_data.get("employee_count"):
            score += 0.1

        if company_data.get("is_public"):
            if company_data.get("ticker"):
                score += 0.15
        else:
            # For private companies, give partial credit
            score += 0.075

        if company_data.get("brands") and len(company_data["brands"]) > 0:
            score += 0.1

        if company_data.get("founded_year"):
            score += 0.1

        return min(score, 1.0)

    def _create_default_citation(self, domain: str) -> SourceCitation:
        """Create a default citation when no other source available."""
        return SourceCitation(
            source_type=SourceType.COMPANY_WEBSITE,
            source_url=f"https://{domain}",
            retrieved_at=datetime.utcnow(),
            confidence_score=0.3,
            notes="Default citation - limited data available",
        )
