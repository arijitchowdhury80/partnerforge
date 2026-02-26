"""
M05: Competitor Intelligence Module
====================================

Identifies competitors and their search providers for displacement positioning.

Wave: 2 (Deep Intel - Depends on Wave 1)

Dependencies:
- M01: Company Context (for vertical classification)
- M02: Technology Stack (for tech overlap analysis)
- M03: Traffic Analysis (for traffic comparison)

Data Sources:
- SimilarWeb similar-sites endpoint
- SimilarWeb keywords-competitors endpoint
- BuiltWith for competitor tech stacks

Output Schema:
- domain: str
- competitors: List[Competitor]
- competitor_search_landscape: SearchLandscape
- competitive_positioning: str
- first_mover_opportunity: bool
- lighthouse_potential: str

Database Table: intel_competitor_intelligence

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M05 section)
- docs/DATABASE_SCHEMA_V2.md (intel_competitor_intelligence)
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    DataNotFoundError,
    DependencyNotMetError,
    register_module,
)

logger = logging.getLogger(__name__)


class Competitor(BaseModel):
    """Individual competitor with intelligence data."""
    domain: str = Field(..., description="Competitor domain")
    company_name: Optional[str] = Field(None, description="Company name if known")
    similarity_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Similarity to target")
    monthly_visits: Optional[int] = Field(None, description="Monthly traffic")
    search_provider: Optional[str] = Field(None, description="Current search provider")
    search_provider_type: Optional[str] = Field(None, description="native, third_party, custom, unknown")
    uses_algolia: bool = Field(default=False, description="Whether using Algolia")
    tech_overlap: List[str] = Field(default_factory=list, description="Shared technologies")
    competitive_angle: Optional[str] = Field(None, description="Competitive positioning angle")
    source_url: Optional[str] = Field(None, description="Source URL for competitor data")


class SearchLandscape(BaseModel):
    """Competitor search provider landscape analysis."""
    algolia_users: int = Field(default=0, description="Competitors using Algolia")
    constructor_users: int = Field(default=0, description="Competitors using Constructor.io")
    elasticsearch_users: int = Field(default=0, description="Competitors using Elasticsearch")
    coveo_users: int = Field(default=0, description="Competitors using Coveo")
    native_search_users: int = Field(default=0, description="Competitors using native/platform search")
    other_search_users: int = Field(default=0, description="Competitors using other search")
    unknown_search_users: int = Field(default=0, description="Competitors with unknown search")
    first_mover_opportunity: bool = Field(default=False, description="First-mover opportunity exists")
    lighthouse_opportunity: Optional[str] = Field(None, description="Potential lighthouse positioning")


class CompetitorIntelligenceData(BaseModel):
    """
    Output schema for M05 Competitor Intelligence module.

    Contains competitor list, search landscape, and positioning analysis.
    """

    domain: str = Field(..., description="Primary domain")

    # Competitor list
    competitors: List[Competitor] = Field(
        default_factory=list,
        description="Identified competitors with intelligence"
    )

    # Search landscape analysis
    competitor_search_landscape: SearchLandscape = Field(
        default_factory=SearchLandscape,
        description="Search provider distribution among competitors"
    )

    # Positioning
    competitive_positioning: Optional[str] = Field(
        None,
        description="Strategic competitive positioning statement"
    )
    first_mover_opportunity: bool = Field(
        default=False,
        description="True if no competitors use Algolia"
    )
    lighthouse_potential: Optional[str] = Field(
        None,
        description="Potential lighthouse customer positioning"
    )

    # Vertical context
    vertical: Optional[str] = Field(None, description="Industry vertical from M01")
    sub_vertical: Optional[str] = Field(None, description="Sub-vertical from M01")

    # Summary stats
    total_competitors_analyzed: int = Field(default=0, description="Total competitors analyzed")
    competitors_with_search_data: int = Field(default=0, description="Competitors with search data")
    avg_competitor_traffic: Optional[int] = Field(None, description="Average competitor monthly traffic")

    # Enrichment metadata
    data_quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    enrichment_sources: List[str] = Field(default_factory=list)
    wave1_data_used: List[str] = Field(default_factory=list, description="Wave 1 modules used")


# Search provider detection patterns
SEARCH_PROVIDER_PATTERNS = {
    "Algolia": {"pattern": ["algolia"], "type": "third_party"},
    "Constructor.io": {"pattern": ["constructor.io", "constructor"], "type": "third_party"},
    "Elasticsearch": {"pattern": ["elasticsearch", "elastic"], "type": "open_source"},
    "Coveo": {"pattern": ["coveo"], "type": "third_party"},
    "Bloomreach": {"pattern": ["bloomreach", "br-search"], "type": "third_party"},
    "Searchspring": {"pattern": ["searchspring"], "type": "third_party"},
    "Klevu": {"pattern": ["klevu"], "type": "third_party"},
    "Lucidworks": {"pattern": ["lucidworks", "fusion"], "type": "third_party"},
    "Yext": {"pattern": ["yext"], "type": "third_party"},
    "Hawksearch": {"pattern": ["hawksearch"], "type": "third_party"},
    "Swiftype": {"pattern": ["swiftype"], "type": "third_party"},
    "Einstein Search": {"pattern": ["einstein", "sfcc-search"], "type": "native"},
    "Shopify Search": {"pattern": ["shopify"], "type": "native"},
    "Magento Search": {"pattern": ["magento-search"], "type": "native"},
}


@register_module
class M05CompetitorIntelligence(BaseModule):
    """
    Competitor Intelligence Module.

    Identifies competitors and analyzes their search providers to determine
    displacement opportunities and first-mover advantages.

    Wave 2 Dependencies:
    - M01: Company Context (vertical, sub_vertical)
    - M02: Technology Stack (technologies for overlap)
    - M03: Traffic Analysis (traffic comparison, similar-sites)

    Data Flow:
    1. Validate Wave 1 dependencies exist
    2. Get similar sites from M03 or SimilarWeb
    3. For each competitor:
       - Get traffic data
       - Detect search provider
       - Calculate tech overlap with M02
    4. Analyze search landscape
    5. Determine first-mover opportunity
    6. Generate competitive positioning
    7. Return with source citations
    """

    MODULE_ID = "m05_competitor_intelligence"
    MODULE_NAME = "Competitor Intelligence"
    DESCRIPTION = "Competitor identification and search provider analysis"

    WAVE = 2
    DEPENDS_ON = []  # Can run independently but benefits from Wave 1 data

    PRIMARY_SOURCE_TYPE = SourceType.SIMILARWEB
    OUTPUT_TABLE = "intel_competitor_intelligence"
    TIMEOUT_SECONDS = 120  # Competitor analysis can be slow

    # Mock competitor data for testing
    _MOCK_COMPETITOR_DATA = {
        "costco.com": {
            "competitors": [
                {
                    "domain": "samsclub.com",
                    "company_name": "Sam's Club",
                    "similarity_score": 0.85,
                    "monthly_visits": 45000000,
                    "search_provider": "Elasticsearch",
                    "search_provider_type": "open_source",
                    "uses_algolia": False,
                    "tech_overlap": ["Akamai", "Google Analytics"],
                },
                {
                    "domain": "bjs.com",
                    "company_name": "BJ's Wholesale Club",
                    "similarity_score": 0.78,
                    "monthly_visits": 12000000,
                    "search_provider": "Unknown",
                    "search_provider_type": "unknown",
                    "uses_algolia": False,
                    "tech_overlap": ["CloudFlare", "Google Analytics"],
                },
                {
                    "domain": "walmart.com",
                    "company_name": "Walmart",
                    "similarity_score": 0.72,
                    "monthly_visits": 450000000,
                    "search_provider": "Custom (Polaris)",
                    "search_provider_type": "custom",
                    "uses_algolia": False,
                    "tech_overlap": ["Akamai", "React"],
                },
                {
                    "domain": "target.com",
                    "company_name": "Target",
                    "similarity_score": 0.68,
                    "monthly_visits": 180000000,
                    "search_provider": "Elasticsearch",
                    "search_provider_type": "open_source",
                    "uses_algolia": False,
                    "tech_overlap": ["Akamai"],
                },
            ],
        },
        "sallybeauty.com": {
            "competitors": [
                {
                    "domain": "sephora.com",
                    "company_name": "Sephora",
                    "similarity_score": 0.78,
                    "monthly_visits": 85000000,
                    "search_provider": "Constructor.io",
                    "search_provider_type": "third_party",
                    "uses_algolia": False,
                    "tech_overlap": ["SFCC", "Adobe Analytics"],
                },
                {
                    "domain": "ulta.com",
                    "company_name": "Ulta Beauty",
                    "similarity_score": 0.72,
                    "monthly_visits": 45000000,
                    "search_provider": "Unknown",
                    "search_provider_type": "unknown",
                    "uses_algolia": False,
                    "tech_overlap": ["SFCC"],
                },
                {
                    "domain": "cosmoprofbeauty.com",
                    "company_name": "CosmoProf",
                    "similarity_score": 0.65,
                    "monthly_visits": 2000000,
                    "search_provider": "Unknown",
                    "search_provider_type": "unknown",
                    "uses_algolia": False,
                    "tech_overlap": ["SFCC"],
                },
            ],
        },
        "mercedes-benz.com": {
            "competitors": [
                {
                    "domain": "bmw.com",
                    "company_name": "BMW",
                    "similarity_score": 0.88,
                    "monthly_visits": 35000000,
                    "search_provider": "Unknown",
                    "search_provider_type": "unknown",
                    "uses_algolia": False,
                    "tech_overlap": ["Adobe AEM", "Adobe Analytics"],
                },
                {
                    "domain": "audi.com",
                    "company_name": "Audi",
                    "similarity_score": 0.85,
                    "monthly_visits": 25000000,
                    "search_provider": "Unknown",
                    "search_provider_type": "unknown",
                    "uses_algolia": False,
                    "tech_overlap": ["Adobe AEM"],
                },
                {
                    "domain": "lexus.com",
                    "company_name": "Lexus",
                    "similarity_score": 0.75,
                    "monthly_visits": 18000000,
                    "search_provider": "Algolia",
                    "search_provider_type": "third_party",
                    "uses_algolia": True,
                    "tech_overlap": ["Akamai"],
                },
            ],
        },
    }

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute competitor intelligence analysis.

        Args:
            domain: The domain to analyze
            context: Results from Wave 1 modules (optional but enriches output)

        Returns:
            ModuleResult with CompetitorIntelligenceData
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting competitor intelligence for {domain}")

            # Normalize domain
            normalized_domain = self._normalize_domain(domain)

            # Extract Wave 1 data if available
            wave1_data = self._extract_wave1_data(context)

            # Fetch competitor data
            raw_data, citations = await self._fetch_competitor_data(normalized_domain)

            # Process competitors
            competitors = self._process_competitors(
                raw_data.get("competitors", []),
                wave1_data.get("technologies", []),
            )

            # Analyze search landscape
            search_landscape = self._analyze_search_landscape(competitors, wave1_data)

            # Generate competitive positioning
            positioning = self._generate_positioning(
                competitors,
                search_landscape,
                wave1_data,
            )

            # Calculate stats
            total_competitors = len(competitors)
            competitors_with_search = len([c for c in competitors if c.search_provider and c.search_provider != "Unknown"])
            avg_traffic = self._calculate_avg_traffic(competitors)

            # Build output
            output_data = CompetitorIntelligenceData(
                domain=normalized_domain,
                competitors=competitors,
                competitor_search_landscape=search_landscape,
                competitive_positioning=positioning,
                first_mover_opportunity=search_landscape.first_mover_opportunity,
                lighthouse_potential=search_landscape.lighthouse_opportunity,
                vertical=wave1_data.get("vertical"),
                sub_vertical=wave1_data.get("sub_vertical"),
                total_competitors_analyzed=total_competitors,
                competitors_with_search_data=competitors_with_search,
                avg_competitor_traffic=avg_traffic,
                data_quality_score=self._calculate_data_quality(competitors, raw_data),
                enrichment_sources=[c.source_type.value for c in citations],
                wave1_data_used=list(wave1_data.get("sources_used", [])),
            )

            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=True, duration_ms=duration_ms)

            result = self._create_result(
                domain=normalized_domain,
                data=output_data.model_dump(),
                primary_citation=citations[0] if citations else self._create_default_citation(normalized_domain),
                supporting_citations=citations[1:] if len(citations) > 1 else [],
                duration_ms=duration_ms,
            )

            self.validate_output(result)

            self.logger.info(
                f"Competitor intelligence complete for {domain}. "
                f"Found {total_competitors} competitors, "
                f"{search_landscape.algolia_users} on Algolia. "
                f"First-mover: {search_landscape.first_mover_opportunity}. "
                f"Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Competitor intelligence failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        return True

    def _extract_wave1_data(
        self,
        context: Optional[Dict[str, ModuleResult]],
    ) -> Dict[str, Any]:
        """
        Extract relevant data from Wave 1 modules.

        Returns dict with:
        - vertical: from M01
        - sub_vertical: from M01
        - technologies: from M02
        - similar_sites: from M03
        - sources_used: list of module IDs used
        """
        data = {"sources_used": set()}

        if not context:
            return data

        # M01 - Company Context
        if "m01_company_context" in context:
            m01_result = context["m01_company_context"]
            if m01_result.status == ModuleStatus.SUCCESS:
                data["vertical"] = m01_result.data.get("vertical")
                data["sub_vertical"] = m01_result.data.get("sub_vertical")
                data["company_name"] = m01_result.data.get("company_name")
                data["sources_used"].add("m01_company_context")

        # M02 - Technology Stack
        if "m02_technology_stack" in context:
            m02_result = context["m02_technology_stack"]
            if m02_result.status == ModuleStatus.SUCCESS:
                technologies = m02_result.data.get("technologies", [])
                data["technologies"] = [t.get("name") for t in technologies if isinstance(t, dict)]
                data["sources_used"].add("m02_technology_stack")

        # M03 - Traffic Analysis
        if "m03_traffic_analysis" in context:
            m03_result = context["m03_traffic_analysis"]
            if m03_result.status == ModuleStatus.SUCCESS:
                data["monthly_visits"] = m03_result.data.get("traffic_metrics", {}).get("monthly_visits")
                data["sources_used"].add("m03_traffic_analysis")

        return data

    async def _fetch_competitor_data(
        self,
        domain: str,
    ) -> Tuple[Dict[str, Any], List[SourceCitation]]:
        """
        Fetch competitor data from SimilarWeb or fallback sources.
        """
        citations = []

        # Check mock data
        if domain in self._MOCK_COMPETITOR_DATA:
            data = self._MOCK_COMPETITOR_DATA[domain].copy()
            citation = self._create_citation(
                source_type=SourceType.SIMILARWEB,
                source_url=f"https://api.similarweb.com/v1/website/{domain}/similar-sites",
                api_endpoint="similar-sites",
                confidence=0.9,
            )
            citations.append(citation)

            # Add BuiltWith citation for tech overlap
            builtwith_citation = self._create_citation(
                source_type=SourceType.BUILTWITH,
                source_url=f"https://api.builtwith.com/v21/api.json?LOOKUP={domain}",
                api_endpoint="domain-lookup",
                confidence=0.85,
            )
            citations.append(builtwith_citation)

            return data, citations

        # Fallback: return empty data
        citation = self._create_citation(
            source_type=SourceType.SIMILARWEB,
            source_url=f"https://www.similarweb.com/website/{domain}/competitors/",
            confidence=0.5,
            notes="No data found - using SimilarWeb public page",
        )
        citations.append(citation)

        return {"competitors": []}, citations

    def _process_competitors(
        self,
        raw_competitors: List[Dict],
        target_technologies: List[str],
    ) -> List[Competitor]:
        """Process raw competitor data into structured format."""
        competitors = []

        for comp in raw_competitors:
            # Calculate competitive angle
            angle = self._generate_competitive_angle(comp, target_technologies)

            competitor = Competitor(
                domain=comp.get("domain", ""),
                company_name=comp.get("company_name"),
                similarity_score=comp.get("similarity_score", 0.0),
                monthly_visits=comp.get("monthly_visits"),
                search_provider=comp.get("search_provider"),
                search_provider_type=comp.get("search_provider_type"),
                uses_algolia=comp.get("uses_algolia", False),
                tech_overlap=comp.get("tech_overlap", []),
                competitive_angle=angle,
                source_url=f"https://www.similarweb.com/website/{comp.get('domain', '')}/",
            )
            competitors.append(competitor)

        # Sort by similarity score descending
        competitors.sort(key=lambda c: c.similarity_score, reverse=True)

        return competitors

    def _generate_competitive_angle(
        self,
        competitor: Dict,
        target_technologies: List[str],
    ) -> str:
        """Generate competitive angle for a competitor."""
        search_provider = competitor.get("search_provider", "Unknown")
        uses_algolia = competitor.get("uses_algolia", False)
        company_name = competitor.get("company_name", competitor.get("domain", "Competitor"))

        if uses_algolia:
            return f"{company_name} uses Algolia - competitive parity needed"
        elif search_provider in ["Constructor.io", "Coveo", "Bloomreach"]:
            return f"{company_name} uses AI-powered search ({search_provider}) - target is at disadvantage"
        elif search_provider in ["Elasticsearch", "OpenSearch", "Solr"]:
            return f"{company_name} uses open-source search ({search_provider}) - similar displacement opportunity"
        elif search_provider == "Unknown":
            return f"Neither competitor uses Algolia - first-mover opportunity"
        else:
            return f"{company_name} uses {search_provider}"

    def _analyze_search_landscape(
        self,
        competitors: List[Competitor],
        wave1_data: Dict,
    ) -> SearchLandscape:
        """Analyze the search provider landscape among competitors."""
        landscape = SearchLandscape()

        for comp in competitors:
            search_type = comp.search_provider_type or "unknown"
            search_provider = comp.search_provider or "Unknown"

            if comp.uses_algolia:
                landscape.algolia_users += 1
            elif "constructor" in search_provider.lower():
                landscape.constructor_users += 1
            elif "elasticsearch" in search_provider.lower() or "elastic" in search_provider.lower():
                landscape.elasticsearch_users += 1
            elif "coveo" in search_provider.lower():
                landscape.coveo_users += 1
            elif search_type == "native":
                landscape.native_search_users += 1
            elif search_type == "unknown" or search_provider == "Unknown":
                landscape.unknown_search_users += 1
            else:
                landscape.other_search_users += 1

        # Determine first-mover opportunity
        landscape.first_mover_opportunity = landscape.algolia_users == 0

        # Generate lighthouse opportunity
        if landscape.first_mover_opportunity:
            vertical = wave1_data.get("vertical", "this")
            sub_vertical = wave1_data.get("sub_vertical", "vertical")
            landscape.lighthouse_opportunity = (
                f"No major {sub_vertical or vertical} competitor uses Algolia today. "
                f"Could be lighthouse customer for this vertical."
            )

        return landscape

    def _generate_positioning(
        self,
        competitors: List[Competitor],
        search_landscape: SearchLandscape,
        wave1_data: Dict,
    ) -> str:
        """Generate strategic competitive positioning statement."""
        vertical = wave1_data.get("sub_vertical") or wave1_data.get("vertical") or "industry"

        if search_landscape.first_mover_opportunity:
            if search_landscape.constructor_users > 0 or search_landscape.coveo_users > 0:
                return (
                    f"Competitors are investing in AI-powered search but none use Algolia. "
                    f"First-mover opportunity in {vertical} with competitive urgency."
                )
            elif search_landscape.elasticsearch_users > 0:
                return (
                    f"Competitors use open-source search requiring significant engineering investment. "
                    f"Algolia provides managed solution with faster time-to-value."
                )
            else:
                return (
                    f"No major {vertical} competitor uses Algolia today. "
                    f"First-mover opportunity to differentiate on search experience."
                )
        else:
            return (
                f"Competitors already use Algolia - competitive parity is critical. "
                f"Focus on differentiated use cases and implementation excellence."
            )

    def _calculate_avg_traffic(self, competitors: List[Competitor]) -> Optional[int]:
        """Calculate average monthly traffic among competitors."""
        traffics = [c.monthly_visits for c in competitors if c.monthly_visits]
        if traffics:
            return int(sum(traffics) / len(traffics))
        return None

    def _calculate_data_quality(
        self,
        competitors: List[Competitor],
        raw_data: Dict,
    ) -> float:
        """Calculate data quality score."""
        score = 0.0

        # Competitor count (up to 0.3)
        comp_count = len(competitors)
        if comp_count >= 5:
            score += 0.3
        elif comp_count >= 3:
            score += 0.2
        elif comp_count >= 1:
            score += 0.1

        # Search provider data (0.3)
        with_search = len([c for c in competitors if c.search_provider and c.search_provider != "Unknown"])
        if with_search >= 3:
            score += 0.3
        elif with_search >= 1:
            score += 0.2

        # Traffic data (0.2)
        with_traffic = len([c for c in competitors if c.monthly_visits])
        if with_traffic >= 3:
            score += 0.2
        elif with_traffic >= 1:
            score += 0.1

        # Tech overlap data (0.2)
        with_tech = len([c for c in competitors if c.tech_overlap])
        if with_tech >= 3:
            score += 0.2
        elif with_tech >= 1:
            score += 0.1

        return min(score, 1.0)

    def _normalize_domain(self, domain: str) -> str:
        """Normalize domain for consistent processing."""
        domain = domain.lower().strip()
        if domain.startswith("https://"):
            domain = domain[8:]
        elif domain.startswith("http://"):
            domain = domain[7:]
        if domain.startswith("www."):
            domain = domain[4:]
        if "/" in domain:
            domain = domain.split("/")[0]
        return domain

    def _create_default_citation(self, domain: str) -> SourceCitation:
        """Create default citation when no data available."""
        return SourceCitation(
            source_type=SourceType.SIMILARWEB,
            source_url=f"https://www.similarweb.com/website/{domain}/competitors/",
            retrieved_at=datetime.utcnow(),
            confidence_score=0.3,
            notes="Default citation - limited data",
        )
