"""
M12: Case Study Matching Module
===============================

Matches target companies to relevant Algolia case studies for social proof
and ROI benchmarking in sales conversations.

Wave: 4 (Synthesis - Depends on all prior waves)

Data Sources:
- Internal case_studies table (161 records)
- M01 Company Context (for vertical/industry matching)
- M02 Technology Stack (for technology matching)
- M03 Traffic Analysis (for scale matching)
- M04 Financial Profile (for use case matching)

Output Schema:
- domain: str
- matched_case_studies: List[MatchedCaseStudy]
- vertical_match_score: float
- use_case_coverage: dict
- top_match_reasoning: str

Database Table: intel_case_study_matches

References:
- docs/INTELLIGENCE_MODULES_SPEC.md (M12 section)
- docs/DATABASE_SCHEMA_V2.md (intel_case_study_matches)
"""

import json
import logging
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from pipeline.models.source import SourceCitation, SourceType, FreshnessStatus
from pipeline.modules.base import (
    BaseModule,
    ModuleResult,
    ModuleStatus,
    ModuleError,
    DependencyNotMetError,
    DataNotFoundError,
    register_module,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Output Schema Models
# =============================================================================

class CaseStudyResult(BaseModel):
    """Result metrics from a case study."""
    headline: Optional[str] = Field(None, description="Primary result headline")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Specific metrics")
    additional: Optional[str] = Field(None, description="Additional context")


class MatchedCaseStudy(BaseModel):
    """A matched Algolia case study with relevance scoring."""
    customer: str = Field(..., description="Customer name")
    customer_domain: Optional[str] = Field(None, description="Customer domain")
    vertical: Optional[str] = Field(None, description="Customer vertical")
    sub_vertical: Optional[str] = Field(None, description="Sub-vertical classification")
    use_case: Optional[str] = Field(None, description="Primary use case")

    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Match relevance score")
    match_reasons: List[str] = Field(default_factory=list, description="Why this case study matches")

    results: CaseStudyResult = Field(default_factory=CaseStudyResult, description="Case study results")
    features_used: List[str] = Field(default_factory=list, description="Algolia features used")

    case_study_url: Optional[str] = Field(None, description="URL to full case study")
    use_in_pitch: str = Field("", description="How to use this in the sales pitch")


class UseCaseCoverage(BaseModel):
    """Case study coverage by use case."""
    search: List[str] = Field(default_factory=list, description="Search case studies")
    recommendations: List[str] = Field(default_factory=list, description="Recommendations case studies")
    personalization: List[str] = Field(default_factory=list, description="Personalization case studies")
    merchandising: List[str] = Field(default_factory=list, description="Merchandising case studies")
    browse: List[str] = Field(default_factory=list, description="Browse/category case studies")
    analytics: List[str] = Field(default_factory=list, description="Analytics case studies")


class CaseStudyMatchingData(BaseModel):
    """
    Output schema for M12 Case Study Matching module.
    """
    domain: str = Field(..., description="Target domain")

    matched_case_studies: List[MatchedCaseStudy] = Field(
        default_factory=list,
        description="Matched case studies ranked by relevance"
    )

    total_matches: int = Field(default=0, description="Total number of relevant matches")
    vertical_match_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="How well case studies match target's vertical"
    )

    use_case_coverage: UseCaseCoverage = Field(
        default_factory=UseCaseCoverage,
        description="Coverage of use cases by matched case studies"
    )

    top_match_reasoning: str = Field(
        default="",
        description="Why the top match is most relevant"
    )

    matching_criteria: Dict[str, Any] = Field(
        default_factory=dict,
        description="Criteria used for matching"
    )

    data_quality_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Quality score of the matching"
    )


# =============================================================================
# Vertical and Use Case Mappings
# =============================================================================

# Map target verticals to case study verticals (for fuzzy matching)
VERTICAL_SYNONYMS = {
    "Commerce": [
        "e-commerce", "ecommerce", "retail", "fashion", "beauty", "grocery",
        "sporting goods", "home goods", "marketplace", "wholesale", "b2c",
        "consumer electronics", "automotive parts", "footwear", "apparel",
        "general merchandise", "office supplies", "pet retail", "wine",
    ],
    "Content": [
        "media", "publishing", "digital publishing", "news", "education",
        "edtech", "e-learning", "documentation", "knowledge management",
        "gaming", "saas",
    ],
    "Support": [
        "healthcare", "non-profit", "travel", "workspace", "real estate",
        "logistics", "industrial", "fundraising",
    ],
}

# Feature keywords to detect in features_used
FEATURE_KEYWORDS = {
    "search": ["search", "autocomplete", "query suggestions", "instant search"],
    "recommendations": ["recommend", "drr", "personalized recommendations"],
    "personalization": ["personalization", "personalized", "ab testing"],
    "merchandising": ["rules", "visual editor", "merchandising", "query categorization"],
    "browse": ["browse", "facets", "filters", "facets and filters"],
    "analytics": ["analytics", "insights", "a/b testing"],
}


# =============================================================================
# M12 Case Study Matching Module
# =============================================================================

@register_module
class M12CaseStudyMatching(BaseModule):
    """
    Case Study Matching Intelligence Module.

    Matches target companies to relevant Algolia case studies based on:
    1. Vertical alignment (Commerce, Content, Support)
    2. Sub-vertical similarity
    3. Technology stack overlap
    4. Traffic scale similarity
    5. Feature/use case alignment

    Data Flow:
    1. Load target company profile from Wave 1-3 context
    2. Query case_studies table from SQLite database
    3. Score each case study for relevance
    4. Return top matches with reasoning

    Graceful Degradation:
    - If no exact vertical match, falls back to similar verticals
    - If database unavailable, returns empty matches with warning
    """

    MODULE_ID = "m12_case_study_matching"
    MODULE_NAME = "Case Study Matching"
    DESCRIPTION = "Match relevant Algolia case studies for social proof"

    WAVE = 4
    DEPENDS_ON = [
        "m01_company_context",
        "m02_technology_stack",
        "m03_traffic_analysis",
        "m04_financial_profile",
    ]

    PRIMARY_SOURCE_TYPE = SourceType.MANUAL_ENTRY  # Internal database
    OUTPUT_TABLE = "intel_case_study_matches"
    TIMEOUT_SECONDS = 30

    # Database path (relative to project root)
    DB_PATH = Path(__file__).parent.parent.parent / "data" / "partnerforge.db"

    def __init__(self):
        """Initialize module with database connection."""
        super().__init__()
        self._db_conn: Optional[sqlite3.Connection] = None

    def _get_db_connection(self) -> sqlite3.Connection:
        """Get or create database connection."""
        if self._db_conn is None:
            if not self.DB_PATH.exists():
                raise DataNotFoundError(
                    self.MODULE_ID,
                    "case_studies",
                    reason=f"Database not found at {self.DB_PATH}"
                )
            self._db_conn = sqlite3.connect(str(self.DB_PATH))
            self._db_conn.row_factory = sqlite3.Row
        return self._db_conn

    async def execute(
        self,
        domain: str,
        context: Optional[Dict[str, ModuleResult]] = None,
    ) -> ModuleResult:
        """
        Execute case study matching for a domain.

        Args:
            domain: The target domain to match
            context: Results from Wave 1-3 modules

        Returns:
            ModuleResult with matched case studies
        """
        start_time = time.time()

        try:
            self.logger.info(f"Starting case study matching for {domain}")

            # Validate dependencies
            if context is None:
                context = {}

            # Extract target profile from context
            target_profile = self._extract_target_profile(domain, context)

            # Load case studies from database
            case_studies = self._load_case_studies()

            if not case_studies:
                self.logger.warning(f"No case studies found in database for {domain}")
                return self._create_empty_result(domain, start_time, "No case studies in database")

            # Score and match case studies
            matched_studies = self._match_case_studies(target_profile, case_studies)

            # Calculate use case coverage
            use_case_coverage = self._calculate_use_case_coverage(matched_studies)

            # Calculate vertical match score
            vertical_score = self._calculate_vertical_score(target_profile, matched_studies)

            # Generate top match reasoning
            top_reasoning = self._generate_top_match_reasoning(target_profile, matched_studies)

            # Create output data
            output_data = CaseStudyMatchingData(
                domain=domain,
                matched_case_studies=matched_studies[:10],  # Top 10
                total_matches=len(matched_studies),
                vertical_match_score=vertical_score,
                use_case_coverage=use_case_coverage,
                top_match_reasoning=top_reasoning,
                matching_criteria={
                    "target_vertical": target_profile.get("vertical", "Unknown"),
                    "target_sub_vertical": target_profile.get("sub_vertical", "Unknown"),
                    "monthly_visits": target_profile.get("monthly_visits", 0),
                    "technologies": target_profile.get("partner_technologies", []),
                },
                data_quality_score=self._calculate_quality_score(matched_studies, target_profile),
            )

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Create citation - use a canonical URL for the internal database
            citation = self._create_citation(
                source_type=SourceType.MANUAL_ENTRY,
                source_url="https://partnerforge.local/data/case_studies",
                api_endpoint="case_studies",
                confidence=0.9,
                notes=f"Matched {len(matched_studies)} case studies from internal database",
            )

            # Record success
            self._record_execution(success=True, duration_ms=duration_ms)

            # Create result
            result = self._create_result(
                domain=domain,
                data=output_data.model_dump(),
                primary_citation=citation,
                duration_ms=duration_ms,
            )

            # Validate output
            self.validate_output(result)

            self.logger.info(
                f"Case study matching complete for {domain}. "
                f"Matched {len(matched_studies)} studies. Duration: {duration_ms:.0f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_execution(success=False, duration_ms=duration_ms, error=str(e))
            self.logger.error(f"Case study matching failed for {domain}: {e}")
            return self._create_error_result(domain, e, duration_ms)

    def validate_output(self, result: ModuleResult) -> bool:
        """Validate module output."""
        if not result.data.get("domain"):
            raise ValueError("Output missing required field: domain")

        if not result.primary_citation:
            raise ValueError("P0 VIOLATION: Output missing primary_citation")

        return True

    def _extract_target_profile(
        self,
        domain: str,
        context: Dict[str, ModuleResult],
    ) -> Dict[str, Any]:
        """
        Extract target company profile from Wave 1-3 context.

        Args:
            domain: Target domain
            context: Results from prior modules

        Returns:
            Target profile dict with relevant attributes
        """
        profile = {"domain": domain}

        # Extract from M01 Company Context
        if "m01_company_context" in context:
            m01_data = context["m01_company_context"].data
            profile["company_name"] = m01_data.get("company_name")
            profile["vertical"] = m01_data.get("vertical", "Commerce")
            profile["sub_vertical"] = m01_data.get("sub_vertical")
            profile["industry"] = m01_data.get("industry")
            profile["business_model"] = m01_data.get("business_model")

        # Extract from M02 Technology Stack
        if "m02_technology_stack" in context:
            m02_data = context["m02_technology_stack"].data
            profile["technologies"] = [t.get("name") for t in m02_data.get("technologies", [])]
            profile["partner_technologies"] = m02_data.get("partner_technologies", [])
            profile["search_provider"] = m02_data.get("search_provider", {}).get("current")

        # Extract from M03 Traffic Analysis
        if "m03_traffic_analysis" in context:
            m03_data = context["m03_traffic_analysis"].data
            metrics = m03_data.get("traffic_metrics", {})
            profile["monthly_visits"] = metrics.get("monthly_visits", 0)
            profile["traffic_tier"] = m03_data.get("traffic_tier")

        # Extract from M04 Financial Profile
        if "m04_financial_profile" in context:
            m04_data = context["m04_financial_profile"].data
            financials = m04_data.get("financials", {})
            profile["revenue"] = financials.get("latest_revenue")
            profile["is_public"] = m04_data.get("is_public", False)
            ecommerce = m04_data.get("ecommerce", {})
            profile["ecommerce_share"] = ecommerce.get("ecommerce_share")

        return profile

    def _load_case_studies(self) -> List[Dict[str, Any]]:
        """Load all case studies from database."""
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    customer_name,
                    customer_domain,
                    vertical,
                    sub_vertical,
                    use_case,
                    story_url,
                    features_used,
                    key_results,
                    partner_integrations,
                    competitor_takeout
                FROM case_studies
                WHERE status = 'Complete' OR status IS NULL
            """)

            rows = cursor.fetchall()

            case_studies = []
            for row in rows:
                study = dict(row)
                # Parse JSON fields
                for json_field in ["features_used", "partner_integrations"]:
                    if study.get(json_field):
                        try:
                            study[json_field] = json.loads(study[json_field])
                        except (json.JSONDecodeError, TypeError):
                            study[json_field] = []
                    else:
                        study[json_field] = []
                case_studies.append(study)

            self.logger.debug(f"Loaded {len(case_studies)} case studies from database")
            return case_studies

        except Exception as e:
            self.logger.error(f"Error loading case studies: {e}")
            return []

    def _match_case_studies(
        self,
        target_profile: Dict[str, Any],
        case_studies: List[Dict[str, Any]],
    ) -> List[MatchedCaseStudy]:
        """
        Score and match case studies to target profile.

        Scoring weights:
        - Vertical match: 40%
        - Sub-vertical match: 20%
        - Scale similarity: 15%
        - Technology overlap: 15%
        - Use case relevance: 10%
        """
        matched = []
        target_vertical = target_profile.get("vertical", "Commerce").lower()
        target_sub_vertical = (target_profile.get("sub_vertical") or "").lower()

        for study in case_studies:
            score = 0.0
            reasons = []

            study_vertical = (study.get("vertical") or "").lower()
            study_sub_vertical = (study.get("sub_vertical") or "").lower()

            # Vertical match (40%)
            vertical_score = self._score_vertical_match(target_vertical, study_vertical)
            score += vertical_score * 0.4
            if vertical_score > 0.7:
                reasons.append(f"Same vertical: {study.get('vertical')}")

            # Sub-vertical match (20%)
            sub_vertical_score = self._score_sub_vertical_match(
                target_sub_vertical, study_sub_vertical, target_profile
            )
            score += sub_vertical_score * 0.2
            if sub_vertical_score > 0.5:
                reasons.append(f"Similar sub-vertical: {study.get('sub_vertical')}")

            # Scale similarity (15%)
            scale_score = self._score_scale_similarity(target_profile, study)
            score += scale_score * 0.15

            # Technology overlap (15%)
            tech_score = self._score_technology_overlap(target_profile, study)
            score += tech_score * 0.15
            if tech_score > 0.5:
                reasons.append("Shared technology stack")

            # Use case relevance (10%)
            use_case_score = self._score_use_case_relevance(target_profile, study)
            score += use_case_score * 0.1

            if score >= 0.3:  # Minimum threshold
                matched_study = MatchedCaseStudy(
                    customer=study.get("customer_name", "Unknown"),
                    customer_domain=study.get("customer_domain"),
                    vertical=study.get("vertical"),
                    sub_vertical=study.get("sub_vertical"),
                    use_case=study.get("use_case"),
                    relevance_score=round(score, 3),
                    match_reasons=reasons,
                    results=CaseStudyResult(
                        headline=study.get("key_results"),
                        metrics={},
                    ),
                    features_used=study.get("features_used", []),
                    case_study_url=study.get("story_url"),
                    use_in_pitch=self._generate_pitch_usage(study, target_profile),
                )
                matched.append(matched_study)

        # Sort by relevance score descending
        matched.sort(key=lambda x: x.relevance_score, reverse=True)
        return matched

    def _score_vertical_match(self, target_vertical: str, study_vertical: str) -> float:
        """Score vertical alignment."""
        if not target_vertical or not study_vertical:
            return 0.3

        # Direct match
        if target_vertical in study_vertical or study_vertical in target_vertical:
            return 1.0

        # Check synonyms
        for vertical_key, synonyms in VERTICAL_SYNONYMS.items():
            target_matches = any(s in target_vertical for s in synonyms) or target_vertical == vertical_key.lower()
            study_matches = any(s in study_vertical for s in synonyms)

            if target_matches and study_matches:
                return 0.8

        return 0.2

    def _score_sub_vertical_match(
        self,
        target_sub_vertical: str,
        study_sub_vertical: str,
        target_profile: Dict[str, Any],
    ) -> float:
        """Score sub-vertical alignment."""
        if not target_sub_vertical and not study_sub_vertical:
            return 0.5  # Neither has sub-vertical, neutral

        if not target_sub_vertical or not study_sub_vertical:
            return 0.3

        # Direct match
        if target_sub_vertical in study_sub_vertical or study_sub_vertical in target_sub_vertical:
            return 1.0

        # Keyword overlap
        target_words = set(target_sub_vertical.split())
        study_words = set(study_sub_vertical.split())

        if target_words & study_words:
            return 0.7

        return 0.2

    def _score_scale_similarity(
        self,
        target_profile: Dict[str, Any],
        study: Dict[str, Any],
    ) -> float:
        """Score based on company scale similarity."""
        # This would ideally compare traffic/revenue, but case studies
        # don't have this data. Use heuristics based on company names.
        target_public = target_profile.get("is_public", False)
        target_visits = target_profile.get("monthly_visits", 0)

        # Enterprise targets (50M+ visits) should match with known enterprises
        enterprise_customers = [
            "lacoste", "decathlon", "gymshark", "nbcuniversal", "lacoste",
            "arcteryx", "ticketmaster", "sephora", "staples", "costco",
        ]

        customer_name = (study.get("customer_name") or "").lower()
        is_enterprise_case = any(e in customer_name for e in enterprise_customers)

        if target_visits >= 50000000 and is_enterprise_case:
            return 1.0
        elif target_visits >= 10000000 and is_enterprise_case:
            return 0.8
        elif target_visits >= 1000000:
            return 0.6
        else:
            return 0.4

    def _score_technology_overlap(
        self,
        target_profile: Dict[str, Any],
        study: Dict[str, Any],
    ) -> float:
        """Score based on technology stack overlap."""
        target_techs = set(t.lower() for t in target_profile.get("partner_technologies", []))
        study_integrations = set(
            i.lower() for i in study.get("partner_integrations", [])
        )

        if not target_techs or not study_integrations:
            return 0.5  # No data, neutral

        overlap = target_techs & study_integrations

        if overlap:
            return min(1.0, 0.5 + len(overlap) * 0.25)

        return 0.3

    def _score_use_case_relevance(
        self,
        target_profile: Dict[str, Any],
        study: Dict[str, Any],
    ) -> float:
        """Score based on use case alignment."""
        # All e-commerce targets benefit from search case studies
        target_vertical = target_profile.get("vertical", "Commerce")
        study_use_case = (study.get("use_case") or "").lower()

        if target_vertical == "Commerce":
            if "e-commerce" in study_use_case or "ecommerce" in study_use_case:
                return 1.0
            elif "search" in study_use_case:
                return 0.8
        elif target_vertical == "Content":
            if "media" in study_use_case or "publishing" in study_use_case:
                return 1.0

        return 0.5

    def _generate_pitch_usage(
        self,
        study: Dict[str, Any],
        target_profile: Dict[str, Any],
    ) -> str:
        """Generate how to use this case study in the pitch."""
        features = study.get("features_used", [])
        results = study.get("key_results") or ""

        pitch_parts = []

        if results:
            # Extract any percentages or numbers
            if "%" in results:
                pitch_parts.append(f"Proves ROI: {results[:100]}...")
            else:
                pitch_parts.append("Demonstrates successful implementation")

        if "Personalization" in features:
            pitch_parts.append("Shows personalization value")
        if "Recommend" in features or "DRR" in features:
            pitch_parts.append("Demonstrates recommendations impact")
        if "Analytics" in features:
            pitch_parts.append("Highlights analytics capabilities")

        return " | ".join(pitch_parts) if pitch_parts else "General social proof"

    def _calculate_use_case_coverage(
        self,
        matched_studies: List[MatchedCaseStudy],
    ) -> UseCaseCoverage:
        """Calculate which use cases are covered by matched case studies."""
        coverage = UseCaseCoverage()

        for study in matched_studies[:10]:  # Top 10 only
            features_lower = [f.lower() for f in study.features_used]

            for feature_category, keywords in FEATURE_KEYWORDS.items():
                if any(k in " ".join(features_lower) for k in keywords):
                    category_list = getattr(coverage, feature_category)
                    if study.customer not in category_list:
                        category_list.append(study.customer)

        return coverage

    def _calculate_vertical_score(
        self,
        target_profile: Dict[str, Any],
        matched_studies: List[MatchedCaseStudy],
    ) -> float:
        """Calculate overall vertical match score."""
        if not matched_studies:
            return 0.0

        # Average of top 5 relevance scores
        top_5 = matched_studies[:5]
        return sum(s.relevance_score for s in top_5) / len(top_5)

    def _generate_top_match_reasoning(
        self,
        target_profile: Dict[str, Any],
        matched_studies: List[MatchedCaseStudy],
    ) -> str:
        """Generate reasoning for why the top match is most relevant."""
        if not matched_studies:
            return "No matching case studies found."

        top = matched_studies[0]
        target_name = target_profile.get("company_name", target_profile["domain"])

        reasons = top.match_reasons if top.match_reasons else ["General relevance"]

        return (
            f"{top.customer} is the best match for {target_name} because: "
            f"{'; '.join(reasons)}. "
            f"Relevance score: {top.relevance_score:.0%}"
        )

    def _calculate_quality_score(
        self,
        matched_studies: List[MatchedCaseStudy],
        target_profile: Dict[str, Any],
    ) -> float:
        """Calculate data quality score."""
        if not matched_studies:
            return 0.0

        score = 0.0

        # Has matches
        if len(matched_studies) >= 3:
            score += 0.3
        elif len(matched_studies) >= 1:
            score += 0.15

        # Top match is strong
        if matched_studies[0].relevance_score >= 0.7:
            score += 0.3
        elif matched_studies[0].relevance_score >= 0.5:
            score += 0.15

        # Has case study URLs
        if any(s.case_study_url for s in matched_studies[:5]):
            score += 0.2

        # Has key results
        if any(s.results.headline for s in matched_studies[:5]):
            score += 0.2

        return min(score, 1.0)

    def _create_empty_result(
        self,
        domain: str,
        start_time: float,
        reason: str,
    ) -> ModuleResult:
        """Create an empty but successful result."""
        duration_ms = (time.time() - start_time) * 1000

        output_data = CaseStudyMatchingData(
            domain=domain,
            matched_case_studies=[],
            total_matches=0,
            vertical_match_score=0.0,
            use_case_coverage=UseCaseCoverage(),
            top_match_reasoning=reason,
            matching_criteria={},
            data_quality_score=0.0,
        )

        citation = self._create_citation(
            source_type=SourceType.MANUAL_ENTRY,
            source_url=f"file://{self.DB_PATH}",
            api_endpoint="case_studies",
            confidence=0.5,
            notes=reason,
        )

        self._record_execution(success=True, duration_ms=duration_ms)

        return self._create_result(
            domain=domain,
            data=output_data.model_dump(),
            primary_citation=citation,
            duration_ms=duration_ms,
        )

    def __del__(self):
        """Clean up database connection."""
        if self._db_conn:
            self._db_conn.close()
