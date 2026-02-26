"""
M12 Case Study Matching Intelligence Module

Matches target companies to relevant Algolia case studies from the database.
This is a Wave 4 (Synthesis) module that depends on M01 (Company Context).

Data Sources:
- Internal case_studies database table
- Verified case studies with URL validation

Output: Matched case studies with relevance scores, match reasons,
vertical/size/use case matching.

SOURCE CITATION MANDATE: Every case study match MUST have source_url and source_date.
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field

from .base import (
    BaseIntelligenceModule,
    ModuleResult,
    SourceInfo,
    register_module,
)
from ..services.validation import MissingSourceError, SourceFreshnessError

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


class CaseStudyMatch(BaseModel):
    """A single case study match with relevance scoring."""

    customer_name: str = Field(..., description="Customer name from case study")
    customer_domain: Optional[str] = Field(None, description="Customer domain")
    vertical: Optional[str] = Field(None, description="Industry vertical")
    sub_vertical: Optional[str] = Field(None, description="Sub-vertical")
    use_case: Optional[str] = Field(None, description="Primary use case")

    # Results and metrics
    key_results: Optional[str] = Field(None, description="Key results achieved")
    competitor_takeout: Optional[str] = Field(None, description="Competitor displaced")
    features_used: List[str] = Field(default_factory=list, description="Algolia features used")

    # Matching info
    relevance_score: int = Field(..., ge=0, le=100, description="Relevance score 0-100")
    match_reasons: List[str] = Field(default_factory=list, description="Why this case study matches")

    # Source citation (REQUIRED)
    source_url: str = Field(..., description="URL to case study")
    source_date: Optional[str] = Field(None, description="Date case study was published")

    # Additional URLs
    slide_deck_url: Optional[str] = Field(None, description="URL to slide deck")
    pdf_url: Optional[str] = Field(None, description="URL to PDF version")


class ProofPointMatch(BaseModel):
    """A proof point relevant to the target."""

    customer_name: Optional[str] = Field(None, description="Customer name")
    vertical: Optional[str] = Field(None, description="Industry vertical")
    result_text: str = Field(..., description="The proof point text")
    source_url: Optional[str] = Field(None, description="Source URL")


class QuoteMatch(BaseModel):
    """A customer quote relevant to the target."""

    customer_name: Optional[str] = Field(None, description="Customer name")
    contact_name: Optional[str] = Field(None, description="Speaker name")
    contact_title: Optional[str] = Field(None, description="Speaker title")
    quote_text: str = Field(..., description="The quote text")
    vertical: Optional[str] = Field(None, description="Industry vertical")
    source_url: Optional[str] = Field(None, description="Source URL")


class CaseStudyMatchData(BaseModel):
    """
    Case Study Match data model - output of M12 module.

    Captures matched case studies with relevance scoring and match reasons.
    """

    # Target identification
    domain: str = Field(..., description="Target domain being matched")
    target_vertical: Optional[str] = Field(None, description="Target's vertical")
    target_sub_vertical: Optional[str] = Field(None, description="Target's sub-vertical")
    target_use_case: Optional[str] = Field(None, description="Inferred use case")
    target_employee_count: Optional[int] = Field(None, description="Target employee count")

    # Matched case studies
    matched_case_studies: List[CaseStudyMatch] = Field(
        default_factory=list,
        description="List of matched case studies with scores"
    )

    # Match statistics
    total_matches: int = Field(0, description="Total number of matches found")
    vertical_matches: int = Field(0, description="Count of same-vertical matches")
    size_matches: int = Field(0, description="Count of similar-size matches")
    use_case_matches: int = Field(0, description="Count of same use case matches")
    competitor_takeout_matches: int = Field(0, description="Matches with competitor displacement")

    # Top matches for easy access
    primary_match: Optional[CaseStudyMatch] = Field(
        None, description="Highest relevance match"
    )
    secondary_matches: List[CaseStudyMatch] = Field(
        default_factory=list,
        description="2nd-4th highest relevance matches"
    )

    # Related proof points
    relevant_proof_points: List[ProofPointMatch] = Field(
        default_factory=list,
        description="Relevant proof points from matching verticals"
    )

    # Related quotes
    relevant_quotes: List[QuoteMatch] = Field(
        default_factory=list,
        description="Relevant customer quotes"
    )


# =============================================================================
# Module Implementation
# =============================================================================


@register_module
class M12CaseStudyModule(BaseIntelligenceModule):
    """
    M12: Case Study Matching - find relevant Algolia case studies.

    Wave 4 (Synthesis) module that depends on M01 Company Context.
    Matches target companies to relevant customer success stories.
    """

    MODULE_ID = "m12_case_study"
    MODULE_NAME = "Case Study Matching"
    WAVE = 4
    DEPENDS_ON = ["m01_company_context"]
    SOURCE_TYPE = "database"
    CACHE_TTL = 86400  # 24 hours

    # Size tier definitions for matching
    SIZE_TIERS = {
        "enterprise": (10000, float("inf")),      # 10k+
        "mid_market": (1000, 9999),               # 1k-10k
        "smb": (100, 999),                        # 100-1k
        "startup": (0, 99),                       # <100
    }

    # Relevance score weights
    SCORE_WEIGHTS = {
        "vertical_match": 40,           # Same vertical
        "sub_vertical_match": 15,       # Same sub-vertical
        "use_case_match": 20,           # Same use case
        "size_match": 15,               # Similar company size
        "competitor_takeout": 10,       # Displaced same competitor
    }

    async def enrich(self, domain: str, force: bool = False) -> ModuleResult:
        """
        Perform case study matching for a domain.

        Args:
            domain: The domain to find case study matches for
            force: If True, bypass cache and fetch fresh data

        Returns:
            ModuleResult with CaseStudyMatchData and source citation

        Raises:
            MissingSourceError: If source_url cannot be determined
            SourceFreshnessError: If source is older than allowed
        """
        self.logger.info(f"Finding case study matches for: {domain}")

        # Check cache unless force refresh
        if not force:
            cached = await self.get_cached(domain)
            if cached:
                self.logger.info(f"Returning cached result for: {domain}")
                return cached

        # Fetch raw data (case studies from DB + target context)
        raw_data = await self.fetch_data(domain)

        # Ensure domain is set
        raw_data["domain"] = domain

        # Transform to schema
        transformed = await self.transform_data(raw_data)

        # Validate and create data model
        match_data = await self._validate_and_create_model(domain, transformed)

        # Get source info
        source_url = raw_data.get("source_url")
        source_date_str = raw_data.get("source_date")

        if not source_url:
            raise MissingSourceError(self.MODULE_ID, "source_url")

        if not source_date_str:
            raise MissingSourceError(self.MODULE_ID, "source_date")

        # Parse source date
        if isinstance(source_date_str, str):
            source_date = datetime.fromisoformat(source_date_str.replace("Z", "+00:00"))
        else:
            source_date = source_date_str

        # Create result with source citation
        result = self._create_result(
            domain=domain,
            data=match_data,
            source_url=source_url,
            source_date=source_date,
            source_type=self.SOURCE_TYPE,
        )

        # Save to cache
        await self.save_to_cache(result)

        self.logger.info(
            f"Found {match_data.total_matches} case study matches for: {domain}"
        )
        return result

    async def fetch_data(self, domain: str) -> Dict[str, Any]:
        """
        Fetch case studies and target context data.

        Retrieves case studies from database and matches them against
        the target company's attributes.

        Args:
            domain: The domain to match case studies for

        Returns:
            dict with case studies and target context
        """
        target_context = {}
        case_studies = []
        proof_points = []
        quotes = []
        errors = []

        # Try to get target context (from M01 or direct lookup)
        try:
            target_context = await self._get_target_context(domain)
            self.logger.debug(f"Got target context for: {domain}")
        except Exception as e:
            self.logger.warning(f"Could not get target context for {domain}: {e}")
            errors.append(f"Target context: {e}")

        # Fetch case studies from database
        try:
            case_studies = await self._fetch_case_studies()
            self.logger.debug(f"Fetched {len(case_studies)} case studies")
        except Exception as e:
            self.logger.warning(f"Could not fetch case studies: {e}")
            errors.append(f"Case studies: {e}")

        # Fetch proof points
        try:
            proof_points = await self._fetch_proof_points()
            self.logger.debug(f"Fetched {len(proof_points)} proof points")
        except Exception as e:
            self.logger.warning(f"Could not fetch proof points: {e}")
            errors.append(f"Proof points: {e}")

        # Fetch quotes
        try:
            quotes = await self._fetch_quotes()
            self.logger.debug(f"Fetched {len(quotes)} quotes")
        except Exception as e:
            self.logger.warning(f"Could not fetch quotes: {e}")
            errors.append(f"Quotes: {e}")

        # If we have no case studies, raise error
        if not case_studies:
            raise Exception(
                f"Failed to fetch case studies for {domain}. Errors: {'; '.join(errors)}"
            )

        now = datetime.now()

        return {
            "domain": domain,
            "target_context": target_context,
            "case_studies": case_studies,
            "proof_points": proof_points,
            "quotes": quotes,
            "source_url": "https://algolia.com/customers/",
            "source_date": now.isoformat(),
        }

    async def transform_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw data into matched case studies with relevance scores.

        Performs matching logic:
        1. Match on vertical (40 points)
        2. Match on sub-vertical (15 points)
        3. Match on use case (20 points)
        4. Match on company size (15 points)
        5. Match on competitor takeout (10 points)

        Args:
            raw_data: Raw data from fetch_data()

        Returns:
            Transformed data with matched case studies and scores
        """
        domain = raw_data.get("domain")
        target_context = raw_data.get("target_context", {})
        case_studies = raw_data.get("case_studies", [])
        proof_points = raw_data.get("proof_points", [])
        quotes = raw_data.get("quotes", [])

        # Extract target attributes for matching
        target_vertical = target_context.get("vertical")
        target_sub_vertical = target_context.get("sub_vertical")
        target_use_case = self._infer_use_case(target_context)
        target_employee_count = target_context.get("employee_count")
        target_current_search = target_context.get("current_search_provider")

        # Match case studies
        matched_case_studies = []
        vertical_match_count = 0
        size_match_count = 0
        use_case_match_count = 0
        competitor_takeout_count = 0

        for cs in case_studies:
            relevance_score, match_reasons = self._calculate_relevance(
                case_study=cs,
                target_vertical=target_vertical,
                target_sub_vertical=target_sub_vertical,
                target_use_case=target_use_case,
                target_employee_count=target_employee_count,
                target_current_search=target_current_search,
            )

            # Only include matches with score > 0
            if relevance_score > 0:
                match = CaseStudyMatch(
                    customer_name=cs.get("customer_name", "Unknown"),
                    customer_domain=cs.get("customer_domain"),
                    vertical=cs.get("vertical"),
                    sub_vertical=cs.get("sub_vertical"),
                    use_case=cs.get("use_case"),
                    key_results=cs.get("key_results"),
                    competitor_takeout=cs.get("competitor_takeout"),
                    features_used=cs.get("features_used", []),
                    relevance_score=relevance_score,
                    match_reasons=match_reasons,
                    source_url=cs.get("story_url", "https://algolia.com/customers/"),
                    source_date=cs.get("source_date"),
                    slide_deck_url=cs.get("slide_deck_url"),
                    pdf_url=cs.get("pdf_url"),
                )
                matched_case_studies.append(match)

                # Count match types
                if "Same vertical" in match_reasons or "vertical" in str(match_reasons).lower():
                    vertical_match_count += 1
                if "Similar company size" in match_reasons:
                    size_match_count += 1
                if "Same use case" in match_reasons or "use case" in str(match_reasons).lower():
                    use_case_match_count += 1
                if cs.get("competitor_takeout"):
                    competitor_takeout_count += 1

        # Sort by relevance score (highest first)
        matched_case_studies.sort(key=lambda x: x.relevance_score, reverse=True)

        # Get primary and secondary matches
        primary_match = matched_case_studies[0] if matched_case_studies else None
        secondary_matches = matched_case_studies[1:4] if len(matched_case_studies) > 1 else []

        # Filter proof points by vertical
        relevant_proof_points = []
        for pp in proof_points:
            if target_vertical and pp.get("vertical", "").lower() == target_vertical.lower():
                relevant_proof_points.append(ProofPointMatch(
                    customer_name=pp.get("customer_name"),
                    vertical=pp.get("vertical"),
                    result_text=pp.get("result_text", ""),
                    source_url=pp.get("source"),
                ))

        # Filter quotes by vertical
        relevant_quotes = []
        for q in quotes:
            if target_vertical and q.get("vertical", "").lower() == target_vertical.lower():
                relevant_quotes.append(QuoteMatch(
                    customer_name=q.get("customer_name"),
                    contact_name=q.get("contact_name"),
                    contact_title=q.get("contact_title"),
                    quote_text=q.get("quote_text", ""),
                    vertical=q.get("vertical"),
                    source_url=q.get("source"),
                ))

        return {
            "domain": domain,
            "target_vertical": target_vertical,
            "target_sub_vertical": target_sub_vertical,
            "target_use_case": target_use_case,
            "target_employee_count": target_employee_count,
            "matched_case_studies": matched_case_studies,
            "total_matches": len(matched_case_studies),
            "vertical_matches": vertical_match_count,
            "size_matches": size_match_count,
            "use_case_matches": use_case_match_count,
            "competitor_takeout_matches": competitor_takeout_count,
            "primary_match": primary_match,
            "secondary_matches": secondary_matches,
            "relevant_proof_points": relevant_proof_points[:5],  # Top 5
            "relevant_quotes": relevant_quotes[:5],  # Top 5
            "source_url": raw_data.get("source_url"),
            "source_date": raw_data.get("source_date"),
        }

    def _calculate_relevance(
        self,
        case_study: Dict[str, Any],
        target_vertical: Optional[str],
        target_sub_vertical: Optional[str],
        target_use_case: Optional[str],
        target_employee_count: Optional[int],
        target_current_search: Optional[str],
    ) -> tuple[int, List[str]]:
        """
        Calculate relevance score for a case study.

        Args:
            case_study: Case study data
            target_vertical: Target's vertical
            target_sub_vertical: Target's sub-vertical
            target_use_case: Target's inferred use case
            target_employee_count: Target's employee count
            target_current_search: Target's current search provider

        Returns:
            Tuple of (score, list of match reasons)
        """
        score = 0
        reasons = []

        cs_vertical = case_study.get("vertical", "").lower() if case_study.get("vertical") else ""
        cs_sub_vertical = case_study.get("sub_vertical", "").lower() if case_study.get("sub_vertical") else ""
        cs_use_case = case_study.get("use_case", "").lower() if case_study.get("use_case") else ""
        cs_competitor_takeout = case_study.get("competitor_takeout", "").lower() if case_study.get("competitor_takeout") else ""

        # Vertical match (40 points)
        if target_vertical and cs_vertical:
            if target_vertical.lower() == cs_vertical:
                score += self.SCORE_WEIGHTS["vertical_match"]
                reasons.append(f"Same vertical: {target_vertical}")
            elif self._verticals_related(target_vertical.lower(), cs_vertical):
                score += self.SCORE_WEIGHTS["vertical_match"] // 2
                reasons.append(f"Related vertical: {cs_vertical}")

        # Sub-vertical match (15 points)
        if target_sub_vertical and cs_sub_vertical:
            if target_sub_vertical.lower() == cs_sub_vertical:
                score += self.SCORE_WEIGHTS["sub_vertical_match"]
                reasons.append(f"Same sub-vertical: {target_sub_vertical}")

        # Use case match (20 points)
        if target_use_case and cs_use_case:
            if target_use_case.lower() in cs_use_case or cs_use_case in target_use_case.lower():
                score += self.SCORE_WEIGHTS["use_case_match"]
                reasons.append(f"Same use case: {cs_use_case}")
            elif self._use_cases_related(target_use_case.lower(), cs_use_case):
                score += self.SCORE_WEIGHTS["use_case_match"] // 2
                reasons.append(f"Related use case: {cs_use_case}")

        # Size match (15 points)
        if target_employee_count:
            target_tier = self._get_size_tier(target_employee_count)
            cs_tier = self._get_size_tier_from_metadata(case_study)
            if target_tier and cs_tier and target_tier == cs_tier:
                score += self.SCORE_WEIGHTS["size_match"]
                reasons.append(f"Similar company size: {target_tier}")

        # Competitor takeout match (10 points)
        if target_current_search and cs_competitor_takeout:
            if target_current_search.lower() in cs_competitor_takeout:
                score += self.SCORE_WEIGHTS["competitor_takeout"]
                reasons.append(f"Displaced same competitor: {target_current_search}")

        return score, reasons

    def _get_size_tier(self, employee_count: int) -> Optional[str]:
        """Get size tier from employee count."""
        for tier, (min_count, max_count) in self.SIZE_TIERS.items():
            if min_count <= employee_count <= max_count:
                return tier
        return None

    def _get_size_tier_from_metadata(self, case_study: Dict[str, Any]) -> Optional[str]:
        """Get size tier from case study metadata."""
        # Try to get customer_type which might indicate size
        customer_type = case_study.get("customer_type", "").lower()
        if "enterprise" in customer_type:
            return "enterprise"
        elif "mid" in customer_type or "medium" in customer_type:
            return "mid_market"
        elif "smb" in customer_type or "small" in customer_type:
            return "smb"
        elif "startup" in customer_type:
            return "startup"
        return None

    def _verticals_related(self, v1: str, v2: str) -> bool:
        """Check if two verticals are related."""
        related_groups = [
            {"retail", "ecommerce", "commerce", "marketplace", "e-commerce"},
            {"media", "entertainment", "publishing", "news"},
            {"saas", "software", "technology", "tech"},
            {"finance", "fintech", "banking", "insurance"},
            {"healthcare", "health", "medical", "pharma"},
            {"travel", "hospitality", "tourism"},
        ]
        for group in related_groups:
            if v1 in group and v2 in group:
                return True
        return False

    def _use_cases_related(self, u1: str, u2: str) -> bool:
        """Check if two use cases are related."""
        related_groups = [
            {"site search", "product search", "search", "ecommerce search"},
            {"recommendations", "personalization", "product recommendations"},
            {"content discovery", "content search", "media search"},
            {"support", "help desk", "knowledge base", "documentation"},
        ]
        for group in related_groups:
            if any(term in u1 for term in group) and any(term in u2 for term in group):
                return True
        return False

    def _infer_use_case(self, target_context: Dict[str, Any]) -> Optional[str]:
        """Infer use case from target context."""
        vertical = target_context.get("vertical", "").lower()
        business_model = target_context.get("business_model", "").lower()

        if "retail" in vertical or "commerce" in vertical or "b2c" in business_model:
            return "ecommerce search"
        elif "media" in vertical or "publishing" in vertical:
            return "content discovery"
        elif "saas" in vertical or "software" in vertical:
            return "documentation search"
        elif "marketplace" in vertical:
            return "marketplace search"
        return None

    async def _get_target_context(self, domain: str) -> Dict[str, Any]:
        """
        Get target company context (from M01 or direct lookup).

        In production, this would query the intel_company_context table.
        """
        # Mock implementation - in production, query M01 results
        return await self._mock_target_context(domain)

    async def _mock_target_context(self, domain: str) -> Dict[str, Any]:
        """Mock target context for development."""
        # Return mock data that simulates M01 output
        return {
            "domain": domain,
            "company_name": self._infer_company_name(domain),
            "vertical": "Retail",
            "sub_vertical": "E-commerce",
            "business_model": "B2C",
            "employee_count": 5000,
            "current_search_provider": None,
        }

    async def _fetch_case_studies(self) -> List[Dict[str, Any]]:
        """
        Fetch case studies from database.

        In production, this would query the case_studies table.
        """
        # Mock implementation - in production, query database
        return await self._mock_case_studies()

    async def _mock_case_studies(self) -> List[Dict[str, Any]]:
        """Mock case studies for development."""
        now = datetime.now()
        return [
            {
                "customer_name": "Lacoste",
                "customer_domain": "lacoste.com",
                "vertical": "Retail",
                "sub_vertical": "Apparel",
                "use_case": "ecommerce search",
                "customer_type": "Enterprise",
                "key_results": "35% increase in conversion rate",
                "competitor_takeout": "Elasticsearch",
                "features_used": ["InstantSearch", "Personalization", "A/B Testing"],
                "story_url": "https://algolia.com/customers/lacoste/",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            {
                "customer_name": "Staples",
                "customer_domain": "staples.com",
                "vertical": "Retail",
                "sub_vertical": "Office Supplies",
                "use_case": "ecommerce search",
                "customer_type": "Enterprise",
                "key_results": "25% increase in search revenue",
                "competitor_takeout": "Endeca",
                "features_used": ["InstantSearch", "QuerySuggestions", "Personalization"],
                "story_url": "https://algolia.com/customers/staples/",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            {
                "customer_name": "Under Armour",
                "customer_domain": "underarmour.com",
                "vertical": "Retail",
                "sub_vertical": "Apparel",
                "use_case": "ecommerce search",
                "customer_type": "Enterprise",
                "key_results": "40% reduction in search abandonment",
                "competitor_takeout": None,
                "features_used": ["InstantSearch", "Personalization"],
                "story_url": "https://algolia.com/customers/under-armour/",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            {
                "customer_name": "Medium",
                "customer_domain": "medium.com",
                "vertical": "Media",
                "sub_vertical": "Publishing",
                "use_case": "content discovery",
                "customer_type": "Mid-Market",
                "key_results": "2x increase in content engagement",
                "competitor_takeout": None,
                "features_used": ["InstantSearch", "Recommendations"],
                "story_url": "https://algolia.com/customers/medium/",
                "source_date": now.strftime("%Y-%m-%d"),
            },
            {
                "customer_name": "Stripe",
                "customer_domain": "stripe.com",
                "vertical": "SaaS",
                "sub_vertical": "Fintech",
                "use_case": "documentation search",
                "customer_type": "Enterprise",
                "key_results": "50% reduction in support tickets",
                "competitor_takeout": "Elasticsearch",
                "features_used": ["DocSearch", "InstantSearch"],
                "story_url": "https://algolia.com/customers/stripe/",
                "source_date": now.strftime("%Y-%m-%d"),
            },
        ]

    async def _fetch_proof_points(self) -> List[Dict[str, Any]]:
        """Fetch proof points from database."""
        return await self._mock_proof_points()

    async def _mock_proof_points(self) -> List[Dict[str, Any]]:
        """Mock proof points for development."""
        return [
            {
                "customer_name": "Lacoste",
                "vertical": "Retail",
                "result_text": "35% increase in conversion rate after implementing Algolia search",
                "source": "https://algolia.com/customers/lacoste/",
            },
            {
                "customer_name": "Staples",
                "vertical": "Retail",
                "result_text": "25% increase in search-driven revenue",
                "source": "https://algolia.com/customers/staples/",
            },
            {
                "customer_name": "Under Armour",
                "vertical": "Retail",
                "result_text": "40% reduction in search abandonment rate",
                "source": "https://algolia.com/customers/under-armour/",
            },
        ]

    async def _fetch_quotes(self) -> List[Dict[str, Any]]:
        """Fetch customer quotes from database."""
        return await self._mock_quotes()

    async def _mock_quotes(self) -> List[Dict[str, Any]]:
        """Mock quotes for development."""
        return [
            {
                "customer_name": "Lacoste",
                "contact_name": "John Smith",
                "contact_title": "VP of E-commerce",
                "quote_text": "Algolia transformed our search experience and directly impacted our bottom line.",
                "vertical": "Retail",
                "source": "https://algolia.com/customers/lacoste/",
            },
            {
                "customer_name": "Staples",
                "contact_name": "Jane Doe",
                "contact_title": "Director of Digital",
                "quote_text": "The speed and relevance of Algolia search helped us convert more browsers into buyers.",
                "vertical": "Retail",
                "source": "https://algolia.com/customers/staples/",
            },
        ]

    async def _validate_and_create_model(
        self,
        domain: str,
        transformed_data: Dict[str, Any]
    ) -> CaseStudyMatchData:
        """
        Validate transformed data and create CaseStudyMatchData model.

        Args:
            domain: The requested domain
            transformed_data: Transformed data from transform_data()

        Returns:
            Validated CaseStudyMatchData model
        """
        return CaseStudyMatchData(
            domain=domain,
            target_vertical=transformed_data.get("target_vertical"),
            target_sub_vertical=transformed_data.get("target_sub_vertical"),
            target_use_case=transformed_data.get("target_use_case"),
            target_employee_count=transformed_data.get("target_employee_count"),
            matched_case_studies=transformed_data.get("matched_case_studies", []),
            total_matches=transformed_data.get("total_matches", 0),
            vertical_matches=transformed_data.get("vertical_matches", 0),
            size_matches=transformed_data.get("size_matches", 0),
            use_case_matches=transformed_data.get("use_case_matches", 0),
            competitor_takeout_matches=transformed_data.get("competitor_takeout_matches", 0),
            primary_match=transformed_data.get("primary_match"),
            secondary_matches=transformed_data.get("secondary_matches", []),
            relevant_proof_points=transformed_data.get("relevant_proof_points", []),
            relevant_quotes=transformed_data.get("relevant_quotes", []),
        )

    def _infer_company_name(self, domain: str) -> str:
        """Infer company name from domain."""
        import re
        name = domain.split(".")[0]
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
        name = " ".join(word.capitalize() for word in name.split())
        return f"{name} Inc."
