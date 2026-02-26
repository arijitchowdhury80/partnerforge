"""
Unit tests for M10_BuyingCommittee Intelligence Module.

Tests the buying committee module which maps stakeholders for search
technology decisions. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m10_buying_committee import (
    M10BuyingCommitteeModule,
    BuyingCommitteeData,
    CommitteeMember,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM10BuyingCommitteeModule:
    """Test suite for M10BuyingCommitteeModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M10BuyingCommitteeModule()

    @pytest.fixture
    def valid_m09_executive_data(self):
        """Mock M09 Executive Intelligence response.

        Note: Order matters! The module processes executives in order,
        and the first eligible person for decision_maker wins.
        CTO is listed first to be identified as decision_maker,
        CFO will become an influencer.
        """
        return {
            "domain": "costco.com",
            "company_name": "Costco Wholesale Corporation",
            "executives": [
                {
                    "name": "Ron Vachris",
                    "title": "Chief Technology Officer",
                    "linkedin_url": "https://linkedin.com/in/ronvachris",
                    "source_url": "https://seekingalpha.com/costco-q4-2025",
                    "source_date": datetime.now().isoformat(),
                },
                {
                    "name": "Richard Galanti",
                    "title": "Chief Financial Officer",
                    "linkedin_url": "https://linkedin.com/in/richardgalanti",
                    "source_url": "https://seekingalpha.com/costco-q4-2025",
                    "source_date": datetime.now().isoformat(),
                },
                {
                    "name": "Maria Lopez",
                    "title": "VP of Engineering",
                    "linkedin_url": "https://linkedin.com/in/marialopez",
                    "source_url": "https://linkedin.com/in/marialopez",
                    "source_date": datetime.now().isoformat(),
                },
                {
                    "name": "James Chen",
                    "title": "Director of E-commerce",
                    "linkedin_url": "https://linkedin.com/in/jameschen",
                    "source_url": "https://linkedin.com/in/jameschen",
                    "source_date": datetime.now().isoformat(),
                },
            ],
            "key_themes": ["digital_transformation", "member_experience"],
            "source_url": "https://seekingalpha.com/costco-q4-2025",
            "source_date": datetime.now().isoformat(),
        }

    @pytest.fixture
    def valid_org_research_data(self):
        """Mock organizational research response."""
        return {
            "company_name": "Costco Wholesale Corporation",
            "org_structure": {
                "technology_team_size": 500,
                "has_search_team": True,
                "reports_to": "CTO",
            },
            "decision_indicators": {
                "typical_process": "RFP-driven",
                "typical_timeline": "4-6 months",
                "budget_cycle": "Annual",
            },
            "hiring_signals": [
                {
                    "role": "Search Engineer",
                    "posted_date": datetime.now().strftime("%Y-%m-%d"),
                    "url": "https://careers.costco.com/search-engineer",
                }
            ],
            "source_url": "https://www.costco.com/about/leadership/",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m10_buying_committee"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Buying Committee"

    def test_module_wave(self, module):
        """Test module is in Wave 3 (Buying Signals)."""
        assert module.WAVE == 3

    def test_module_depends_on_m09(self, module):
        """Test Wave 3 module depends on M09 Executive Intelligence."""
        assert "m09_executive" in module.DEPENDS_ON

    def test_module_source_type(self, module):
        """Test module has correct source type (synthesized)."""
        assert module.SOURCE_TYPE == "synthesized"

    def test_module_cache_ttl(self, module):
        """Test module has 7-day cache TTL."""
        assert module.CACHE_TTL == 604800  # 7 days

    # =========================================================================
    # Committee Member Model Tests
    # =========================================================================

    def test_committee_member_creation(self):
        """Test CommitteeMember pydantic model creation."""
        member = CommitteeMember(
            name="John Smith",
            title="Chief Technology Officer",
            role_in_decision="Technical Decision Maker",
            engagement_strategy="Executive briefing focused on strategic vision",
            talking_points=[
                "Enterprise scalability",
                "API-first architecture",
            ],
            linkedin_url="https://linkedin.com/in/johnsmith",
            email_pattern="john.smith@company.com",
            source_url="https://example.com/source",
            source_date=datetime.now().isoformat(),
        )

        assert member.name == "John Smith"
        assert member.title == "Chief Technology Officer"
        assert member.role_in_decision == "Technical Decision Maker"
        assert len(member.talking_points) == 2
        assert member.linkedin_url == "https://linkedin.com/in/johnsmith"

    def test_committee_member_required_fields(self):
        """Test CommitteeMember requires source citation fields."""
        with pytest.raises(Exception):  # Pydantic validation error
            CommitteeMember(
                name="John Smith",
                title="CTO",
                role_in_decision="Decision Maker",
                engagement_strategy="Strategy",
                # Missing source_url and source_date
            )

    def test_committee_member_serialization(self):
        """Test CommitteeMember can be serialized."""
        member = CommitteeMember(
            name="John Smith",
            title="CTO",
            role_in_decision="Decision Maker",
            engagement_strategy="Executive approach",
            talking_points=["Point 1", "Point 2"],
            source_url="https://example.com",
            source_date=datetime.now().isoformat(),
        )

        dumped = member.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["name"] == "John Smith"
        assert dumped["source_url"] == "https://example.com"

    # =========================================================================
    # Buying Committee Data Model Tests
    # =========================================================================

    def test_buying_committee_data_creation(self):
        """Test BuyingCommitteeData pydantic model creation."""
        decision_maker = CommitteeMember(
            name="John Smith",
            title="CTO",
            role_in_decision="Decision Maker",
            engagement_strategy="Executive approach",
            talking_points=["ROI", "Scalability"],
            source_url="https://example.com",
            source_date=datetime.now().isoformat(),
        )

        data = BuyingCommitteeData(
            domain="costco.com",
            company_name="Costco Wholesale Corporation",
            decision_maker=decision_maker,
            influencers=[],
            technical_evaluators=[],
            champions=[],
            blockers=[],
            committee_size=1,
            decision_process="RFP-driven",
            estimated_timeline="Q2 2026",
            entry_point="Start with John Smith (CTO)",
            multi_thread_strategy="Executive thread: John Smith",
            algolia_familiarity="Unknown",
            current_vendor_relationship="Elasticsearch",
            data_completeness=0.5,
            confidence_score=0.6,
        )

        assert data.domain == "costco.com"
        assert data.decision_maker.name == "John Smith"
        assert data.committee_size == 1
        assert data.decision_process == "RFP-driven"

    def test_buying_committee_data_minimal_fields(self):
        """Test BuyingCommitteeData with only required fields."""
        data = BuyingCommitteeData(
            domain="example.com",
            company_name="Example Corp",
        )

        assert data.domain == "example.com"
        assert data.decision_maker is None
        assert data.influencers == []
        assert data.technical_evaluators == []
        assert data.champions == []
        assert data.blockers == []
        assert data.committee_size == 0

    def test_buying_committee_data_serialization(self):
        """Test BuyingCommitteeData can be serialized."""
        data = BuyingCommitteeData(
            domain="example.com",
            company_name="Example Corp",
            committee_size=3,
            data_completeness=0.7,
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["committee_size"] == 3

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fetch_data_with_provided_m09(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test fetch_data uses provided M09 data when available."""
        with patch.object(
            module, "_fetch_org_research", new_callable=AsyncMock
        ) as mock_org:
            mock_org.return_value = valid_org_research_data

            result = await module.fetch_data(
                "costco.com", m09_data=valid_m09_executive_data
            )

            # Should have synthesized data
            assert result["domain"] == "costco.com"
            assert result["company_name"] == "Costco Wholesale Corporation"
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_fetch_data_fetches_m09_when_not_provided(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test fetch_data fetches M09 data when not provided."""
        with patch.object(
            module, "_fetch_m09_data", new_callable=AsyncMock
        ) as mock_m09, patch.object(
            module, "_fetch_org_research", new_callable=AsyncMock
        ) as mock_org:
            mock_m09.return_value = valid_m09_executive_data
            mock_org.return_value = valid_org_research_data

            result = await module.fetch_data("costco.com")

            mock_m09.assert_called_once_with("costco.com")
            assert result["domain"] == "costco.com"

    @pytest.mark.asyncio
    async def test_fetch_data_continues_with_m09_failure(
        self, module, valid_org_research_data
    ):
        """Test fetch_data continues when M09 fails but org research succeeds."""
        with patch.object(
            module, "_fetch_m09_data", new_callable=AsyncMock
        ) as mock_m09, patch.object(
            module, "_fetch_org_research", new_callable=AsyncMock
        ) as mock_org:
            mock_m09.side_effect = Exception("M09 unavailable")
            mock_org.return_value = valid_org_research_data

            # Should still work with org research fallback
            result = await module.fetch_data("costco.com")

            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_data_fails_when_all_sources_fail(self, module):
        """Test fetch_data raises error when all sources fail."""
        with patch.object(
            module, "_fetch_m09_data", new_callable=AsyncMock
        ) as mock_m09, patch.object(
            module, "_fetch_org_research", new_callable=AsyncMock
        ) as mock_org:
            mock_m09.side_effect = Exception("M09 unavailable")
            mock_org.side_effect = Exception("Org research unavailable")

            with pytest.raises(Exception) as exc_info:
                await module.fetch_data("costco.com")

            assert "fail" in str(exc_info.value).lower()

    # =========================================================================
    # Committee Synthesis Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_synthesize_committee_identifies_cto_as_decision_maker(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test CTO is identified as technical decision maker."""
        result = await module._synthesize_committee(
            "costco.com", valid_m09_executive_data, valid_org_research_data
        )

        assert result["decision_maker"] is not None
        assert "Ron Vachris" in result["decision_maker"]["name"]
        assert "Technical Decision Maker" in result["decision_maker"]["role_in_decision"]

    @pytest.mark.asyncio
    async def test_synthesize_committee_identifies_vp_as_technical_evaluator(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test VP of Engineering is identified as technical evaluator."""
        result = await module._synthesize_committee(
            "costco.com", valid_m09_executive_data, valid_org_research_data
        )

        tech_evaluator_names = [te["name"] for te in result["technical_evaluators"]]
        assert "Maria Lopez" in tech_evaluator_names

    @pytest.mark.asyncio
    async def test_synthesize_committee_identifies_director_as_champion(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test Director of E-commerce is identified as potential champion."""
        result = await module._synthesize_committee(
            "costco.com", valid_m09_executive_data, valid_org_research_data
        )

        champion_names = [c["name"] for c in result["champions"]]
        assert "James Chen" in champion_names

    @pytest.mark.asyncio
    async def test_synthesize_committee_includes_cfo_as_influencer(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test CFO is identified as influencer when CTO is decision maker."""
        result = await module._synthesize_committee(
            "costco.com", valid_m09_executive_data, valid_org_research_data
        )

        # CFO should be in influencers since CTO is decision maker
        influencer_names = [i["name"] for i in result["influencers"]]
        assert "Richard Galanti" in influencer_names

    @pytest.mark.asyncio
    async def test_synthesize_committee_generates_engagement_strategies(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test each committee member gets an engagement strategy."""
        result = await module._synthesize_committee(
            "costco.com", valid_m09_executive_data, valid_org_research_data
        )

        # Decision maker should have engagement strategy
        assert result["decision_maker"]["engagement_strategy"] != ""

        # All tech evaluators should have strategies
        for te in result["technical_evaluators"]:
            assert te["engagement_strategy"] != ""

    @pytest.mark.asyncio
    async def test_synthesize_committee_generates_talking_points(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test each committee member gets relevant talking points."""
        result = await module._synthesize_committee(
            "costco.com", valid_m09_executive_data, valid_org_research_data
        )

        # Decision maker should have talking points
        assert len(result["decision_maker"]["talking_points"]) > 0

        # Champions should have talking points
        for champion in result["champions"]:
            assert len(champion["talking_points"]) > 0

    # =========================================================================
    # Entry Point and Strategy Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_determine_entry_point_prefers_champions(self, module):
        """Test entry point recommendation prefers champions."""
        champion = CommitteeMember(
            name="James Chen",
            title="Director of E-commerce",
            role_in_decision="Business Champion",
            engagement_strategy="Focus on business outcomes",
            talking_points=["A/B testing"],
            source_url="https://example.com",
            source_date=datetime.now().isoformat(),
        )

        entry_point = module._determine_entry_point(
            decision_maker=None,
            champions=[champion],
            technical_evaluators=[],
        )

        assert "James Chen" in entry_point
        assert "champion" in entry_point.lower()

    @pytest.mark.asyncio
    async def test_determine_multi_thread_strategy(self, module):
        """Test multi-thread strategy includes all identified threads."""
        decision_maker = CommitteeMember(
            name="John Smith",
            title="CTO",
            role_in_decision="Decision Maker",
            engagement_strategy="Executive approach",
            talking_points=[],
            source_url="https://example.com",
            source_date=datetime.now().isoformat(),
        )
        tech_evaluator = CommitteeMember(
            name="Jane Doe",
            title="VP Engineering",
            role_in_decision="Technical Evaluator",
            engagement_strategy="Technical deep-dive",
            talking_points=[],
            source_url="https://example.com",
            source_date=datetime.now().isoformat(),
        )

        strategy = module._determine_multi_thread_strategy(
            decision_maker=decision_maker,
            influencers=[],
            technical_evaluators=[tech_evaluator],
            champions=[],
        )

        assert "Executive thread" in strategy
        assert "Technical thread" in strategy
        assert "John Smith" in strategy
        assert "Jane Doe" in strategy

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_calculates_committee_size(self, module):
        """Test transform_data correctly calculates committee size."""
        raw_data = {
            "domain": "costco.com",
            "company_name": "Costco",
            "decision_maker": {
                "name": "John",
                "title": "CTO",
                "role_in_decision": "DM",
                "engagement_strategy": "Exec",
                "source_url": "https://example.com",
                "source_date": datetime.now().isoformat(),
            },
            "influencers": [
                {
                    "name": "Jane",
                    "title": "CFO",
                    "role_in_decision": "Budget",
                    "engagement_strategy": "ROI",
                    "source_url": "https://example.com",
                    "source_date": datetime.now().isoformat(),
                },
            ],
            "technical_evaluators": [
                {
                    "name": "Bob",
                    "title": "VP Eng",
                    "role_in_decision": "Tech",
                    "engagement_strategy": "Deep dive",
                    "source_url": "https://example.com",
                    "source_date": datetime.now().isoformat(),
                },
            ],
            "champions": [],
            "blockers": [],
            "source_url": "https://example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # 1 decision maker + 1 influencer + 1 tech evaluator = 3
        assert result["committee_size"] == 3

    @pytest.mark.asyncio
    async def test_transform_data_calculates_completeness(self, module):
        """Test transform_data calculates data completeness score."""
        raw_data = {
            "domain": "costco.com",
            "company_name": "Costco",
            "decision_maker": {
                "name": "John",
                "title": "CTO",
                "role_in_decision": "DM",
                "engagement_strategy": "Exec",
                "source_url": "https://example.com",
                "source_date": datetime.now().isoformat(),
            },
            "influencers": [],
            "technical_evaluators": [
                {
                    "name": "Bob",
                    "title": "VP Eng",
                    "role_in_decision": "Tech",
                    "engagement_strategy": "Deep dive",
                    "source_url": "https://example.com",
                    "source_date": datetime.now().isoformat(),
                },
            ],
            "champions": [],
            "blockers": [],
            "decision_process": "RFP-driven",
            "entry_point": "Start with John",
            "source_url": "https://example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Should have non-zero completeness
        assert result["data_completeness"] > 0.0
        # With decision_maker (30%) + tech_evaluator (10%) + decision_process (10%) + entry_point (10%) = 60%
        assert result["data_completeness"] >= 0.5

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "costco.com",
                "company_name": "Costco",
                "decision_maker": None,
                "influencers": [],
                "technical_evaluators": [],
                "champions": [],
                "blockers": [],
                "source_url": "https://seekingalpha.com/costco",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("costco.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "seekingalpha.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "costco.com",
                "company_name": "Costco",
                "decision_maker": None,
                "influencers": [],
                "technical_evaluators": [],
                "champions": [],
                "blockers": [],
                "source_url": "https://seekingalpha.com/costco",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("costco.com")

            assert result.source.date is not None
            # Date should be within last minute
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "costco.com",
                "company_name": "Costco",
                "decision_maker": None,
                "influencers": [],
                "technical_evaluators": [],
                "champions": [],
                "blockers": [],
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("costco.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_date MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "costco.com",
                "company_name": "Costco",
                "decision_maker": None,
                "influencers": [],
                "technical_evaluators": [],
                "champions": [],
                "blockers": [],
                "source_url": "https://seekingalpha.com/costco",
                # source_date is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("costco.com")

            assert "source_date" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)  # 13+ months old

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "costco.com",
                "company_name": "Costco",
                "decision_maker": None,
                "influencers": [],
                "technical_evaluators": [],
                "champions": [],
                "blockers": [],
                "source_url": "https://seekingalpha.com/costco",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("costco.com")

            assert "older than" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_committee_members_have_source_citations(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """TEST SOURCE CITATION MANDATE: Each committee member MUST have source_url and source_date."""
        result = await module._synthesize_committee(
            "costco.com", valid_m09_executive_data, valid_org_research_data
        )

        # Decision maker must have source
        if result["decision_maker"]:
            assert "source_url" in result["decision_maker"]
            assert "source_date" in result["decision_maker"]

        # All influencers must have source
        for influencer in result["influencers"]:
            assert "source_url" in influencer
            assert "source_date" in influencer

        # All tech evaluators must have source
        for te in result["technical_evaluators"]:
            assert "source_url" in te
            assert "source_date" in te

        # All champions must have source
        for champion in result["champions"]:
            assert "source_url" in champion
            assert "source_date" in champion

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_m09_data", new_callable=AsyncMock
        ) as mock_m09, patch.object(
            module, "_fetch_org_research", new_callable=AsyncMock
        ) as mock_org:
            mock_m09.return_value = valid_m09_executive_data
            mock_org.return_value = valid_org_research_data

            result = await module.enrich("costco.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m10_buying_committee"
            assert result.domain == "costco.com"

            # Verify data
            assert isinstance(result.data, BuyingCommitteeData)
            assert result.data.company_name == "Costco Wholesale Corporation"
            assert result.data.decision_maker is not None
            assert len(result.data.technical_evaluators) > 0
            assert len(result.data.champions) > 0

            # Verify source citation
            assert result.source is not None
            assert result.source.url is not None

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and fetches fresh data."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()  # Would return cached data

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = {
                    "domain": "costco.com",
                    "company_name": "Costco",
                    "decision_maker": None,
                    "influencers": [],
                    "technical_evaluators": [],
                    "champions": [],
                    "blockers": [],
                    "source_url": "https://example.com",
                    "source_date": datetime.now().isoformat(),
                }

                # With force=True, should NOT use cache
                await module.enrich("costco.com", force=True)

                # Cache should not be checked
                mock_cache.assert_not_called()
                # Fresh fetch should be called
                mock_fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_enrich_with_provided_m09_data(
        self, module, valid_m09_executive_data, valid_org_research_data
    ):
        """Test enrichment with pre-provided M09 data from orchestrator."""
        with patch.object(
            module, "_fetch_m09_data", new_callable=AsyncMock
        ) as mock_m09, patch.object(
            module, "_fetch_org_research", new_callable=AsyncMock
        ) as mock_org:
            mock_org.return_value = valid_org_research_data

            result = await module.enrich(
                "costco.com", m09_data=valid_m09_executive_data
            )

            # M09 fetch should NOT be called when data is provided
            mock_m09.assert_not_called()

            # Result should still be valid
            assert result.data.company_name == "Costco Wholesale Corporation"

    # =========================================================================
    # Validation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_validate_and_create_validates_domain_match(self, module):
        """Test domain in data must match requested domain."""
        transformed_data = {
            "domain": "wrongdomain.com",  # Mismatch!
            "company_name": "Costco",
            "source_url": "https://example.com",
            "source_date": datetime.now().isoformat(),
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_create("costco.com", transformed_data)

        assert "domain" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_validate_and_create_creates_model(self, module):
        """Test _validate_and_create creates a proper BuyingCommitteeData model."""
        transformed_data = {
            "domain": "costco.com",
            "company_name": "Costco Wholesale Corporation",
            "decision_maker": {
                "name": "John Smith",
                "title": "CTO",
                "role_in_decision": "Decision Maker",
                "engagement_strategy": "Executive approach",
                "talking_points": ["ROI", "Scale"],
                "source_url": "https://example.com",
                "source_date": datetime.now().isoformat(),
            },
            "influencers": [],
            "technical_evaluators": [],
            "champions": [],
            "blockers": [],
            "committee_size": 1,
            "data_completeness": 0.3,
            "confidence_score": 0.5,
        }

        result = await module._validate_and_create("costco.com", transformed_data)

        assert isinstance(result, BuyingCommitteeData)
        assert result.domain == "costco.com"
        assert result.decision_maker.name == "John Smith"
        assert result.committee_size == 1

    # =========================================================================
    # Completeness Calculation Tests
    # =========================================================================

    def test_calculate_completeness_with_full_committee(self, module):
        """Test completeness calculation with fully mapped committee."""
        data = {
            "decision_maker": {"name": "John"},
            "influencers": [{"name": "Jane"}, {"name": "Bob"}],
            "technical_evaluators": [{"name": "Alice"}, {"name": "Charlie"}],
            "champions": [{"name": "Eve"}],
            "decision_process": "RFP-driven",
            "entry_point": "Start with Eve",
        }

        completeness = module._calculate_completeness(data)

        # Should be high completeness
        assert completeness >= 0.8

    def test_calculate_completeness_with_minimal_data(self, module):
        """Test completeness calculation with minimal data."""
        data = {
            "decision_maker": None,
            "influencers": [],
            "technical_evaluators": [],
            "champions": [],
        }

        completeness = module._calculate_completeness(data)

        # Should be low completeness
        assert completeness < 0.2

    def test_calculate_completeness_caps_at_100(self, module):
        """Test completeness never exceeds 1.0."""
        data = {
            "decision_maker": {"name": "John"},
            "influencers": [{"name": f"I{i}"} for i in range(10)],
            "technical_evaluators": [{"name": f"T{i}"} for i in range(10)],
            "champions": [{"name": f"C{i}"} for i in range(10)],
            "decision_process": "RFP-driven",
            "entry_point": "Start with champion",
        }

        completeness = module._calculate_completeness(data)

        assert completeness <= 1.0


class TestM10ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M10 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m10_buying_committee")
        assert module_class is not None
        assert module_class.MODULE_ID == "m10_buying_committee"

    def test_module_in_wave_3(self):
        """Test M10 module appears in Wave 3 modules."""
        from app.modules.base import get_modules_by_wave

        wave_3_modules = get_modules_by_wave(3)
        module_ids = [cls.MODULE_ID for cls in wave_3_modules]

        assert "m10_buying_committee" in module_ids
