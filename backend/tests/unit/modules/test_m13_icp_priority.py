"""
Unit tests for M13 ICP Priority Mapping Intelligence Module.

Tests the ICP priority mapping module which calculates final ICP score
and priority tier by synthesizing data from all prior modules.
Validates source citation mandate compliance and scoring accuracy.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m13_icp_priority import (
    M13ICPPriorityModule,
    ICPPriorityData,
    ICPTier,
    ScoreBreakdown,
    TIER_ACTIONS,
    TIER_NEXT_ACTIONS,
)
from app.modules.base import ModuleResult
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM13ICPPriorityModule:
    """Test suite for M13ICPPriorityModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M13ICPPriorityModule()

    @pytest.fixture
    def complete_dependency_data(self):
        """Complete dependency data from Wave 1-3 modules."""
        return {
            "m01_company_context": {
                "domain": "costco.com",
                "company_name": "Costco Wholesale Corporation",
                "vertical": "retail",
                "industry": "Retail",
                "source_url": "https://builtwith.com/costco.com",
                "source_date": datetime.now().isoformat(),
            },
            "m02_tech_stack": {
                "domain": "costco.com",
                "tech_spend": 150000,
                "partner_tech": "Adobe AEM",
                "source_url": "https://builtwith.com/costco.com",
                "source_date": datetime.now().isoformat(),
            },
            "m03_traffic": {
                "domain": "costco.com",
                "monthly_visits": 50000000,
                "source_url": "https://api.similarweb.com/costco.com",
                "source_date": datetime.now().isoformat(),
            },
        }

    @pytest.fixture
    def minimal_dependency_data(self):
        """Minimal dependency data (only required fields)."""
        return {
            "m01_company_context": {
                "domain": "example.com",
                "company_name": "Example Corp",
                "source_url": "https://builtwith.com/example.com",
                "source_date": datetime.now().isoformat(),
            },
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m13_icp_priority"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "ICP Priority Mapping"

    def test_module_wave(self, module):
        """Test module is in Wave 4 (Synthesis)."""
        assert module.WAVE == 4

    def test_module_dependencies(self, module):
        """Test Wave 4 module depends on correct prior modules."""
        assert "m01_company_context" in module.DEPENDS_ON
        assert "m02_tech_stack" in module.DEPENDS_ON
        assert "m03_traffic" in module.DEPENDS_ON
        assert len(module.DEPENDS_ON) == 3

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "computed"

    # =========================================================================
    # Vertical Scoring Tests (40 points max)
    # =========================================================================

    def test_vertical_score_commerce(self, module):
        """Test commerce vertical gets max score (40 pts)."""
        score, reason = module._calculate_vertical_score("commerce")
        assert score == 40
        assert "40/40" in reason

    def test_vertical_score_ecommerce(self, module):
        """Test e-commerce vertical gets max score (40 pts)."""
        score, reason = module._calculate_vertical_score("e-commerce")
        assert score == 40

    def test_vertical_score_retail(self, module):
        """Test retail vertical gets max score (40 pts)."""
        score, reason = module._calculate_vertical_score("retail")
        assert score == 40

    def test_vertical_score_marketplace(self, module):
        """Test marketplace vertical gets max score (40 pts)."""
        score, reason = module._calculate_vertical_score("marketplace")
        assert score == 40

    def test_vertical_score_media(self, module):
        """Test media vertical gets 30 points."""
        score, reason = module._calculate_vertical_score("media")
        assert score == 30

    def test_vertical_score_content(self, module):
        """Test content vertical gets 25 points."""
        score, reason = module._calculate_vertical_score("content")
        assert score == 25

    def test_vertical_score_support(self, module):
        """Test support vertical gets 15 points."""
        score, reason = module._calculate_vertical_score("support")
        assert score == 15

    def test_vertical_score_unknown(self, module):
        """Test unknown vertical gets minimum score (5 pts)."""
        score, reason = module._calculate_vertical_score("unknown_vertical")
        assert score == 5
        assert "not in ICP" in reason

    def test_vertical_score_empty(self, module):
        """Test empty vertical returns 0."""
        score, reason = module._calculate_vertical_score("")
        assert score == 0
        assert "No vertical data" in reason

    def test_vertical_score_partial_match(self, module):
        """Test partial match for vertical (e.g., 'retail sales')."""
        score, reason = module._calculate_vertical_score("retail sales")
        assert score == 40  # Should match 'retail'

    # =========================================================================
    # Traffic Scoring Tests (30 points max)
    # =========================================================================

    def test_traffic_score_50m_plus(self, module):
        """Test 50M+ visits gets max score (30 pts)."""
        score, reason = module._calculate_traffic_score(50_000_000)
        assert score == 30
        assert "30/30" in reason

    def test_traffic_score_100m(self, module):
        """Test 100M visits still gets max score."""
        score, reason = module._calculate_traffic_score(100_000_000)
        assert score == 30

    def test_traffic_score_10m_plus(self, module):
        """Test 10M+ visits gets 25 points."""
        score, reason = module._calculate_traffic_score(10_000_000)
        assert score == 25

    def test_traffic_score_1m_plus(self, module):
        """Test 1M+ visits gets 15 points."""
        score, reason = module._calculate_traffic_score(1_000_000)
        assert score == 15

    def test_traffic_score_500k_plus(self, module):
        """Test 500K+ visits gets 10 points."""
        score, reason = module._calculate_traffic_score(500_000)
        assert score == 10

    def test_traffic_score_100k_plus(self, module):
        """Test 100K+ visits gets 5 points."""
        score, reason = module._calculate_traffic_score(100_000)
        assert score == 5

    def test_traffic_score_below_threshold(self, module):
        """Test below 100K visits gets 0 points."""
        score, reason = module._calculate_traffic_score(50_000)
        assert score == 0

    def test_traffic_score_zero(self, module):
        """Test zero visits returns 0."""
        score, reason = module._calculate_traffic_score(0)
        assert score == 0
        assert "No traffic data" in reason

    def test_traffic_score_none(self, module):
        """Test None visits returns 0."""
        score, reason = module._calculate_traffic_score(None)
        assert score == 0

    # =========================================================================
    # Tech Spend Scoring Tests (20 points max)
    # =========================================================================

    def test_tech_spend_score_100k_plus(self, module):
        """Test $100K+ tech spend gets max score (20 pts)."""
        score, reason = module._calculate_tech_spend_score(100_000)
        assert score == 20
        assert "20/20" in reason

    def test_tech_spend_score_50k_plus(self, module):
        """Test $50K+ tech spend gets 15 points."""
        score, reason = module._calculate_tech_spend_score(50_000)
        assert score == 15

    def test_tech_spend_score_25k_plus(self, module):
        """Test $25K+ tech spend gets 10 points."""
        score, reason = module._calculate_tech_spend_score(25_000)
        assert score == 10

    def test_tech_spend_score_10k_plus(self, module):
        """Test $10K+ tech spend gets 5 points."""
        score, reason = module._calculate_tech_spend_score(10_000)
        assert score == 5

    def test_tech_spend_score_below_threshold(self, module):
        """Test below $10K gets 0 points."""
        score, reason = module._calculate_tech_spend_score(5_000)
        assert score == 0

    def test_tech_spend_score_zero(self, module):
        """Test zero tech spend returns 0."""
        score, reason = module._calculate_tech_spend_score(0)
        assert score == 0
        assert "No tech spend data" in reason

    # =========================================================================
    # Partner Tech Scoring Tests (10 points max)
    # =========================================================================

    def test_partner_tech_score_adobe(self, module):
        """Test Adobe gets max score (10 pts)."""
        score, reason = module._calculate_partner_tech_score("adobe")
        assert score == 10
        assert "10/10" in reason

    def test_partner_tech_score_adobe_aem(self, module):
        """Test Adobe AEM gets max score (10 pts)."""
        score, reason = module._calculate_partner_tech_score("adobe aem")
        assert score == 10

    def test_partner_tech_score_shopify_plus(self, module):
        """Test Shopify Plus gets 8 points."""
        score, reason = module._calculate_partner_tech_score("shopify plus")
        assert score == 8

    def test_partner_tech_score_shopify(self, module):
        """Test Shopify gets 7 points."""
        score, reason = module._calculate_partner_tech_score("shopify")
        assert score == 7

    def test_partner_tech_score_salesforce(self, module):
        """Test Salesforce gets 6 points."""
        score, reason = module._calculate_partner_tech_score("salesforce")
        assert score == 6

    def test_partner_tech_score_other(self, module):
        """Test other/unknown partner tech gets 3 points."""
        score, reason = module._calculate_partner_tech_score("some_other_tech")
        assert score == 3
        assert "3/10" in reason or "other" in reason

    def test_partner_tech_score_empty(self, module):
        """Test empty partner tech returns 0."""
        score, reason = module._calculate_partner_tech_score("")
        assert score == 0
        assert "No partner tech" in reason

    # =========================================================================
    # Tier Determination Tests
    # =========================================================================

    def test_tier_hot(self, module):
        """Test 80-100 points = HOT tier."""
        assert module._determine_tier(80) == ICPTier.HOT
        assert module._determine_tier(90) == ICPTier.HOT
        assert module._determine_tier(100) == ICPTier.HOT

    def test_tier_warm(self, module):
        """Test 60-79 points = WARM tier."""
        assert module._determine_tier(60) == ICPTier.WARM
        assert module._determine_tier(70) == ICPTier.WARM
        assert module._determine_tier(79) == ICPTier.WARM

    def test_tier_cool(self, module):
        """Test 40-59 points = COOL tier."""
        assert module._determine_tier(40) == ICPTier.COOL
        assert module._determine_tier(50) == ICPTier.COOL
        assert module._determine_tier(59) == ICPTier.COOL

    def test_tier_cold(self, module):
        """Test 0-39 points = COLD tier."""
        assert module._determine_tier(0) == ICPTier.COLD
        assert module._determine_tier(20) == ICPTier.COLD
        assert module._determine_tier(39) == ICPTier.COLD

    def test_tier_boundary_79_80(self, module):
        """Test boundary between WARM (79) and HOT (80)."""
        assert module._determine_tier(79) == ICPTier.WARM
        assert module._determine_tier(80) == ICPTier.HOT

    def test_tier_boundary_59_60(self, module):
        """Test boundary between COOL (59) and WARM (60)."""
        assert module._determine_tier(59) == ICPTier.COOL
        assert module._determine_tier(60) == ICPTier.WARM

    def test_tier_boundary_39_40(self, module):
        """Test boundary between COLD (39) and COOL (40)."""
        assert module._determine_tier(39) == ICPTier.COLD
        assert module._determine_tier(40) == ICPTier.COOL

    # =========================================================================
    # Confidence Calculation Tests
    # =========================================================================

    def test_confidence_full_data(self, module):
        """Test full confidence (1.0) with all data."""
        raw_data = {
            "vertical": "retail",
            "monthly_visits": 1000000,
            "tech_spend": 50000,
            "partner_tech": "adobe",
        }
        confidence = module._calculate_confidence(raw_data)
        assert confidence == 1.0

    def test_confidence_partial_data(self, module):
        """Test partial confidence with missing fields."""
        raw_data = {
            "vertical": "retail",
            "monthly_visits": 1000000,
            # missing tech_spend and partner_tech
        }
        confidence = module._calculate_confidence(raw_data)
        assert confidence == 0.5

    def test_confidence_minimal_data(self, module):
        """Test minimal confidence with only vertical."""
        raw_data = {
            "vertical": "retail",
        }
        confidence = module._calculate_confidence(raw_data)
        assert confidence == 0.25

    def test_confidence_no_data(self, module):
        """Test zero confidence with no data."""
        raw_data = {}
        confidence = module._calculate_confidence(raw_data)
        assert confidence == 0.0

    # =========================================================================
    # Scoring Signals Tests
    # =========================================================================

    def test_signals_high_value_vertical(self, module):
        """Test signal for high-value vertical."""
        signals = module._build_scoring_signals("retail", 0, 0, "")
        assert any("High-value vertical" in s for s in signals)

    def test_signals_high_traffic(self, module):
        """Test signal for high traffic."""
        signals = module._build_scoring_signals("", 50_000_000, 0, "")
        assert any("High traffic" in s for s in signals)

    def test_signals_significant_tech_spend(self, module):
        """Test signal for significant tech spend."""
        signals = module._build_scoring_signals("", 0, 100_000, "")
        assert any("Significant tech spend" in s for s in signals)

    def test_signals_adobe_partner(self, module):
        """Test signal for Adobe partner."""
        signals = module._build_scoring_signals("", 0, 0, "adobe aem")
        assert any("Adobe partner" in s for s in signals)

    def test_signals_shopify_partner(self, module):
        """Test signal for Shopify partner."""
        signals = module._build_scoring_signals("", 0, 0, "shopify")
        assert any("Shopify partner" in s for s in signals)

    # =========================================================================
    # Data Aggregation Tests
    # =========================================================================

    def test_aggregate_dependency_data(self, module, complete_dependency_data):
        """Test aggregation of dependency data."""
        result = module._aggregate_dependency_data("costco.com", complete_dependency_data)

        assert result["domain"] == "costco.com"
        assert result["vertical"] == "retail"
        assert result["monthly_visits"] == 50000000
        assert result["tech_spend"] == 150000
        assert result["partner_tech"] == "Adobe AEM"
        assert "source_url" in result
        assert "source_date" in result

    def test_aggregate_uses_latest_source(self, module):
        """Test that aggregation uses latest source date."""
        now = datetime.now()
        old_date = (now - timedelta(days=30)).isoformat()
        new_date = now.isoformat()

        dependency_data = {
            "m01_company_context": {
                "vertical": "retail",
                "source_url": "https://old-source.com",
                "source_date": old_date,
            },
            "m03_traffic": {
                "monthly_visits": 1000000,
                "source_url": "https://new-source.com",
                "source_date": new_date,
            },
        }

        result = module._aggregate_dependency_data("test.com", dependency_data)
        assert result["source_url"] == "https://new-source.com"

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_complete(self, module):
        """Test transform_data with complete data produces valid output."""
        raw_data = {
            "domain": "costco.com",
            "vertical": "retail",
            "monthly_visits": 50_000_000,
            "tech_spend": 150_000,
            "partner_tech": "Adobe AEM",
            "source_url": "https://builtwith.com/costco.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # Should get max score for all components
        assert result["icp_score"] == 100  # 40+30+20+10
        assert result["icp_tier"] == ICPTier.HOT
        assert result["score_breakdown"]["vertical_score"] == 40
        assert result["score_breakdown"]["traffic_score"] == 30
        assert result["score_breakdown"]["tech_spend_score"] == 20
        assert result["score_breakdown"]["partner_tech_score"] == 10

    @pytest.mark.asyncio
    async def test_transform_data_minimal(self, module):
        """Test transform_data with minimal data."""
        raw_data = {
            "domain": "example.com",
            "source_url": "https://example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["icp_score"] == 0
        assert result["icp_tier"] == ICPTier.COLD
        assert result["confidence"] == 0.0

    @pytest.mark.asyncio
    async def test_transform_includes_recommended_actions(self, module):
        """Test transform includes recommended actions based on tier."""
        raw_data = {
            "domain": "test.com",
            "vertical": "retail",
            "monthly_visits": 50_000_000,
            "tech_spend": 150_000,
            "partner_tech": "Adobe AEM",
            "source_url": "https://example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["recommended_action"] == TIER_ACTIONS["hot"]
        assert result["next_best_actions"] == TIER_NEXT_ACTIONS["hot"]

    @pytest.mark.asyncio
    async def test_transform_handles_score_change(self, module):
        """Test transform calculates score change from previous."""
        raw_data = {
            "domain": "test.com",
            "vertical": "retail",  # 40 pts
            "monthly_visits": 500_000,  # 10 pts
            "previous_score": 30,
            "source_url": "https://example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        expected_score = 50  # 40 + 10
        assert result["icp_score"] == expected_score
        assert result["score_change"] == expected_score - 30  # 20

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module, complete_dependency_data):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "costco.com",
                "vertical": "retail",
                "monthly_visits": 50_000_000,
                "tech_spend": 150_000,
                "partner_tech": "Adobe AEM",
                "source_url": "https://partnerforge.algolia.com/computed/costco.com",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("costco.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "partnerforge" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()

        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "vertical": "retail",
                "source_url": "https://example.com",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.source.date is not None
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "vertical": "retail",
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_date MUST raise error."""
        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "vertical": "retail",
                "source_url": "https://example.com",
                # source_date is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_date" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)

        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "vertical": "retail",
                "source_url": "https://example.com",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline_hot_lead(self, module, complete_dependency_data):
        """Test complete enrichment pipeline for a hot lead (max score)."""
        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "costco.com",
                "vertical": "retail",
                "monthly_visits": 50_000_000,
                "tech_spend": 150_000,
                "partner_tech": "Adobe AEM",
                "source_url": "https://partnerforge.algolia.com/computed/costco.com",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("costco.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m13_icp_priority"
            assert result.domain == "costco.com"

            # Verify data
            assert isinstance(result.data, ICPPriorityData)
            assert result.data.icp_score == 100
            assert result.data.icp_tier == ICPTier.HOT
            assert "Immediate outreach" in result.data.recommended_action

            # Verify score breakdown
            assert result.data.score_breakdown.vertical_score == 40
            assert result.data.score_breakdown.traffic_score == 30
            assert result.data.score_breakdown.tech_spend_score == 20
            assert result.data.score_breakdown.partner_tech_score == 10

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline_warm_lead(self, module):
        """Test complete enrichment pipeline for a warm lead."""
        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "vertical": "media",  # 30 pts
                "monthly_visits": 10_000_000,  # 25 pts
                "tech_spend": 10_000,  # 5 pts
                "partner_tech": "",  # 0 pts
                "source_url": "https://example.com",
                "source_date": datetime.now().isoformat(),
            }  # Total: 60 pts = WARM

            result = await module.enrich("example.com")

            assert result.data.icp_score == 60
            assert result.data.icp_tier == ICPTier.WARM
            assert "nurture" in result.data.recommended_action.lower()

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline_cool_lead(self, module):
        """Test complete enrichment pipeline for a cool lead."""
        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "vertical": "content",  # 25 pts
                "monthly_visits": 1_000_000,  # 15 pts
                "tech_spend": 0,  # 0 pts
                "partner_tech": "",  # 0 pts
                "source_url": "https://example.com",
                "source_date": datetime.now().isoformat(),
            }  # Total: 40 pts = COOL

            result = await module.enrich("example.com")

            assert result.data.icp_score == 40
            assert result.data.icp_tier == ICPTier.COOL
            assert "quarterly" in result.data.recommended_action.lower()

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline_cold_lead(self, module):
        """Test complete enrichment pipeline for a cold lead."""
        with patch.object(
            module, "fetch_data", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "vertical": "support",  # 15 pts
                "monthly_visits": 50_000,  # 0 pts
                "tech_spend": 0,  # 0 pts
                "partner_tech": "",  # 0 pts
                "source_url": "https://example.com",
                "source_date": datetime.now().isoformat(),
            }  # Total: 15 pts = COLD

            result = await module.enrich("example.com")

            assert result.data.icp_score == 15
            assert result.data.icp_tier == ICPTier.COLD
            assert "Passive monitoring" in result.data.recommended_action

    @pytest.mark.asyncio
    async def test_enrich_with_dependency_data(self, module, complete_dependency_data):
        """Test enrichment with pre-fetched dependency data."""
        result = await module.enrich(
            "costco.com",
            dependency_data=complete_dependency_data
        )

        assert result.data.icp_score == 100
        assert result.data.icp_tier == ICPTier.HOT
        assert result.data.input_vertical == "retail"
        assert result.data.input_monthly_visits == 50_000_000
        assert result.data.input_tech_spend == 150_000
        assert result.data.input_partner_tech == "adobe aem"

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and recalculates."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = {
                    "domain": "example.com",
                    "vertical": "retail",
                    "source_url": "https://example.com",
                    "source_date": datetime.now().isoformat(),
                }

                await module.enrich("example.com", force=True)

                mock_cache.assert_not_called()
                mock_fetch.assert_called_once()

    # =========================================================================
    # ICPPriorityData Model Tests
    # =========================================================================

    def test_icp_priority_data_model_creation(self):
        """Test ICPPriorityData pydantic model creation."""
        breakdown = ScoreBreakdown(
            vertical_score=40,
            vertical_reason="Retail vertical",
            traffic_score=30,
            traffic_reason="50M visits",
            tech_spend_score=20,
            tech_spend_reason="$150K spend",
            partner_tech_score=10,
            partner_tech_reason="Adobe AEM",
            total_score=100,
        )

        data = ICPPriorityData(
            domain="costco.com",
            icp_score=100,
            icp_tier=ICPTier.HOT,
            score_breakdown=breakdown,
            recommended_action="Immediate outreach",
            next_best_actions=["Schedule call", "Prepare demo"],
            scoring_signals=["High-value vertical: retail"],
            confidence=1.0,
        )

        assert data.domain == "costco.com"
        assert data.icp_score == 100
        assert data.icp_tier == ICPTier.HOT
        assert data.score_breakdown.total_score == 100
        assert len(data.next_best_actions) == 2

    def test_icp_priority_data_with_minimal_fields(self):
        """Test ICPPriorityData with only required fields."""
        breakdown = ScoreBreakdown(total_score=0)

        data = ICPPriorityData(
            domain="example.com",
            icp_score=0,
            icp_tier=ICPTier.COLD,
            score_breakdown=breakdown,
            recommended_action="",
        )

        assert data.domain == "example.com"
        assert data.icp_score == 0
        assert data.next_best_actions == []
        assert data.scoring_signals == []
        assert data.priority_rank is None

    def test_icp_priority_data_model_dump(self):
        """Test ICPPriorityData can be serialized."""
        breakdown = ScoreBreakdown(total_score=50)

        data = ICPPriorityData(
            domain="example.com",
            icp_score=50,
            icp_tier=ICPTier.COOL,
            score_breakdown=breakdown,
            recommended_action="Quarterly check-in",
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["icp_score"] == 50
        assert dumped["icp_tier"] == "cool"

    def test_score_breakdown_validation(self):
        """Test ScoreBreakdown validates score ranges."""
        # Valid breakdown
        breakdown = ScoreBreakdown(
            vertical_score=40,
            traffic_score=30,
            tech_spend_score=20,
            partner_tech_score=10,
            total_score=100,
        )
        assert breakdown.total_score == 100

        # Invalid vertical score (>40) should raise
        with pytest.raises(ValueError):
            ScoreBreakdown(vertical_score=50)

        # Invalid traffic score (>30) should raise
        with pytest.raises(ValueError):
            ScoreBreakdown(traffic_score=35)

    def test_icp_tier_enum_values(self):
        """Test ICPTier enum has correct values."""
        assert ICPTier.HOT.value == "hot"
        assert ICPTier.WARM.value == "warm"
        assert ICPTier.COOL.value == "cool"
        assert ICPTier.COLD.value == "cold"


class TestM13ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M13 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m13_icp_priority")
        assert module_class is not None
        assert module_class.MODULE_ID == "m13_icp_priority"

    def test_module_in_wave_4(self):
        """Test M13 module appears in Wave 4 modules."""
        from app.modules.base import get_modules_by_wave

        wave_4_modules = get_modules_by_wave(4)
        module_ids = [cls.MODULE_ID for cls in wave_4_modules]

        assert "m13_icp_priority" in module_ids


class TestICPScoringIntegration:
    """Integration tests for ICP scoring scenarios."""

    @pytest.fixture
    def module(self):
        return M13ICPPriorityModule()

    @pytest.mark.asyncio
    async def test_scoring_mercedes_hot_lead(self, module):
        """Test scoring for Mercedes-Benz (known hot lead, 95 pts)."""
        # Mercedes-Benz profile based on project data
        raw_data = {
            "domain": "mercedes-benz.com",
            "vertical": "retail",  # 40 pts (auto retail)
            "monthly_visits": 80_000_000,  # 30 pts
            "tech_spend": 100_000,  # 20 pts (matches threshold exactly)
            "partner_tech": "other",  # 3 pts
            "source_url": "https://builtwith.com/mercedes-benz.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        # 40 + 30 + 20 + 3 = 93
        assert result["icp_score"] >= 90
        assert result["icp_tier"] == ICPTier.HOT

    @pytest.mark.asyncio
    async def test_scoring_costco_hot_lead(self, module):
        """Test scoring for Costco (from project data)."""
        raw_data = {
            "domain": "costco.com",
            "vertical": "retail",  # 40 pts
            "monthly_visits": 50_000_000,  # 30 pts
            "tech_spend": 150_000,  # 20 pts
            "partner_tech": "adobe aem",  # 10 pts
            "source_url": "https://builtwith.com/costco.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["icp_score"] == 100
        assert result["icp_tier"] == ICPTier.HOT
        assert result["confidence"] == 1.0

    @pytest.mark.asyncio
    async def test_scoring_small_saas_cold_lead(self, module):
        """Test scoring for small SaaS company (cold lead)."""
        raw_data = {
            "domain": "small-saas.com",
            "vertical": "internal",  # 10 pts (low value)
            "monthly_visits": 50_000,  # 0 pts (below threshold)
            "tech_spend": 5_000,  # 0 pts (below threshold)
            "partner_tech": "",  # 0 pts
            "source_url": "https://example.com",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["icp_score"] == 10
        assert result["icp_tier"] == ICPTier.COLD
        assert "Passive monitoring" in result["recommended_action"]
