"""
Unit tests for M09_ExecutiveIntelligence Intelligence Module.

Tests the executive intelligence module which profiles key executives
for personalized outreach. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.m09_executive import (
    M09ExecutiveIntelligenceModule,
    ExecutiveIntelligenceData,
    Executive,
    DigitalLeadershipQuote,
    QuoteToProductMapping,
    SpeakingLanguage,
)
from app.modules.base import ModuleResult, SourceInfo
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM09ExecutiveIntelligenceModule:
    """Test suite for M09ExecutiveIntelligenceModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M09ExecutiveIntelligenceModule()

    @pytest.fixture
    def valid_linkedin_response(self):
        """Mock LinkedIn search response."""
        return {
            "executives": [
                {
                    "name": "Denise Paulonis",
                    "title": "President & CEO",
                    "linkedin_url": "https://www.linkedin.com/in/denisepaulonis/",
                    "tenure_start": "2022-01",
                    "background": "Former CFO at Sally Beauty; prior McDonald's, PepsiCo",
                    "is_active_on_linkedin": True,
                    "source_url": "https://www.linkedin.com/in/denisepaulonis/",
                    "source_date": datetime.now().isoformat(),
                },
                {
                    "name": "Scott Lindblom",
                    "title": "SVP & CIO",
                    "linkedin_url": "https://www.linkedin.com/in/scott-lindblom/",
                    "tenure_start": "2023-10",
                    "background": "Former digital transformation leader at Bed Bath & Beyond",
                    "is_active_on_linkedin": False,
                    "source_url": "https://www.linkedin.com/in/scott-lindblom/",
                    "source_date": datetime.now().isoformat(),
                },
                {
                    "name": "Chris Hansen",
                    "title": "VP, Digital Product",
                    "linkedin_url": "https://www.linkedin.com/in/chris-hansen-2809403/",
                    "tenure_start": "2020-05",
                    "background": "Digital product leader",
                    "is_active_on_linkedin": True,
                    "speaks_at_events": ["CommerceNext"],
                    "source_url": "https://www.linkedin.com/in/chris-hansen-2809403/",
                    "source_date": datetime.now().isoformat(),
                },
            ],
            "source_url": "https://www.linkedin.com/company/sallybeauty/people/",
            "source_date": datetime.now().isoformat(),
        }

    @pytest.fixture
    def valid_management_response(self):
        """Mock company management page response."""
        return {
            "recent_executive_changes": [
                {
                    "type": "arrival",
                    "name": "Scott Lindblom",
                    "title": "SVP & CIO",
                    "date": "2023-10",
                    "from_company": "Bed Bath & Beyond",
                    "source_url": "https://www.sallybeautyholdings.com/about/leadership/",
                }
            ],
            "leadership_turnover_insight": "New CIO hire creates opportunity for technology vendor relationships",
            "source_url": "https://www.sallybeautyholdings.com/about/leadership/",
            "source_date": datetime.now().isoformat(),
        }

    @pytest.fixture
    def valid_quotes_response(self):
        """Mock executive quotes response."""
        return {
            "digital_leadership_quotes": [
                {
                    "speaker": "Denise Paulonis",
                    "title": "President & CEO",
                    "quote": "More efficient search engine for easier product discovery",
                    "context": "Q4 2025 Earnings Call",
                    "algolia_mapping": "Algolia InstantSearch, Dynamic Faceting",
                    "source_url": "https://www.fool.com/earnings/call-transcripts/2026/02/09/",
                    "source_date": datetime.now().isoformat(),
                }
            ],
            "source_url": "https://seekingalpha.com/symbol/SBH",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m09_executive"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Executive Intelligence"

    def test_module_wave(self, module):
        """Test module is in Wave 3."""
        assert module.WAVE == 3

    def test_module_dependencies(self, module):
        """Test module depends on M01 and M07."""
        assert "m01_company_context" in module.DEPENDS_ON
        assert "m07_strategic" in module.DEPENDS_ON

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE == "webpage"

    def test_new_in_role_threshold(self, module):
        """Test new in role threshold is 18 months."""
        assert module.NEW_IN_ROLE_THRESHOLD_MONTHS == 18

    # =========================================================================
    # Data Fetching Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_fetch_linkedin_profiles_returns_valid_data(
        self, module, valid_linkedin_response
    ):
        """Test LinkedIn search returns expected structure."""
        with patch.object(
            module, "_call_linkedin_search", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_linkedin_response

            result = await module._fetch_linkedin_profiles("sallybeauty.com")

            assert "executives" in result
            assert len(result["executives"]) == 3
            assert result["executives"][0]["name"] == "Denise Paulonis"
            assert "source_url" in result
            assert "source_date" in result

    @pytest.mark.asyncio
    async def test_fetch_management_page_returns_valid_data(
        self, module, valid_management_response
    ):
        """Test management page fetch returns expected structure."""
        with patch.object(
            module, "_call_management_page", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_management_response

            result = await module._fetch_management_page("sallybeauty.com")

            assert "recent_executive_changes" in result
            assert "leadership_turnover_insight" in result
            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_executive_quotes_returns_valid_data(
        self, module, valid_quotes_response
    ):
        """Test quotes search returns expected structure."""
        with patch.object(
            module, "_call_quotes_search", new_callable=AsyncMock
        ) as mock_api:
            mock_api.return_value = valid_quotes_response

            result = await module._fetch_executive_quotes("sallybeauty.com")

            assert "digital_leadership_quotes" in result
            assert len(result["digital_leadership_quotes"]) == 1
            assert "source_url" in result

    @pytest.mark.asyncio
    async def test_fetch_data_merges_all_sources(
        self, module, valid_linkedin_response, valid_management_response, valid_quotes_response
    ):
        """Test fetch_data merges data from all three sources."""
        with patch.object(
            module, "_fetch_linkedin_profiles", new_callable=AsyncMock
        ) as mock_linkedin, patch.object(
            module, "_fetch_management_page", new_callable=AsyncMock
        ) as mock_mgmt, patch.object(
            module, "_fetch_executive_quotes", new_callable=AsyncMock
        ) as mock_quotes:
            mock_linkedin.return_value = valid_linkedin_response
            mock_mgmt.return_value = valid_management_response
            mock_quotes.return_value = valid_quotes_response

            result = await module.fetch_data("sallybeauty.com")

            # Should have data from all sources
            assert "executives" in result
            assert "recent_executive_changes" in result
            assert "digital_leadership_quotes" in result

    # =========================================================================
    # Source Merging Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_merge_sources_prioritizes_linkedin(self, module):
        """Test LinkedIn is primary source for executive profiles."""
        linkedin_data = {
            "executives": [
                {"name": "CEO", "title": "CEO", "source_url": "https://linkedin.com/ceo", "source_date": datetime.now().isoformat()}
            ],
            "source_url": "https://linkedin.com/company/test",
            "source_date": datetime.now().isoformat(),
        }
        management_data = {
            "recent_executive_changes": [{"type": "arrival", "name": "New Hire"}],
            "source_url": "https://company.com/about",
            "source_date": datetime.now().isoformat(),
        }
        quotes_data = {
            "digital_leadership_quotes": [{"speaker": "CEO", "quote": "Test", "title": "CEO", "source_url": "https://example.com", "source_date": datetime.now().isoformat()}],
            "source_url": "https://seekingalpha.com/test",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._merge_sources(linkedin_data, management_data, quotes_data)

        # LinkedIn source should be primary
        assert result["source_url"] == "https://linkedin.com/company/test"
        # But should have data from all sources
        assert len(result["executives"]) == 1
        assert len(result["recent_executive_changes"]) == 1
        assert len(result["digital_leadership_quotes"]) == 1

    @pytest.mark.asyncio
    async def test_merge_sources_falls_back_to_management(self, module):
        """Test management page is fallback source."""
        linkedin_data = {}  # LinkedIn failed
        management_data = {
            "recent_executive_changes": [{"type": "arrival", "name": "New Hire"}],
            "source_url": "https://company.com/about",
            "source_date": datetime.now().isoformat(),
        }
        quotes_data = {}  # Quotes failed

        result = await module._merge_sources(linkedin_data, management_data, quotes_data)

        # Management source should be used
        assert result["source_url"] == "https://company.com/about"

    # =========================================================================
    # Tenure Calculation Tests
    # =========================================================================

    def test_calculate_months_since(self, module):
        """Test months calculation between dates."""
        # 24 months ago
        start = datetime.now() - timedelta(days=730)
        start_str = start.strftime("%Y-%m")
        start_date = datetime.strptime(start_str, "%Y-%m")

        months = module._calculate_months_since(start_date)

        # Should be approximately 24 months
        assert 23 <= months <= 25

    def test_process_executive_calculates_tenure(self, module):
        """Test _process_executive adds tenure_months."""
        # Executive started 12 months ago
        start_date = datetime.now() - timedelta(days=365)
        exec_data = {
            "name": "Test Exec",
            "title": "CIO",
            "tenure_start": start_date.strftime("%Y-%m"),
            "source_url": "https://example.com",
        }

        result = module._process_executive(exec_data)

        assert "tenure_months" in result
        assert 11 <= result["tenure_months"] <= 13

    def test_process_executive_identifies_new_in_role(self, module):
        """Test executives with tenure < 18 months are flagged."""
        # Executive started 6 months ago (new in role)
        start_date = datetime.now() - timedelta(days=180)
        exec_data = {
            "name": "New CIO",
            "title": "CIO",
            "tenure_start": start_date.strftime("%Y-%m"),
            "source_url": "https://example.com",
        }

        result = module._process_executive(exec_data)

        assert result["is_new_to_role"] is True

    def test_process_executive_identifies_established(self, module):
        """Test executives with tenure >= 18 months are not flagged."""
        # Executive started 24 months ago (established)
        start_date = datetime.now() - timedelta(days=730)
        exec_data = {
            "name": "Established CEO",
            "title": "CEO",
            "tenure_start": start_date.strftime("%Y-%m"),
            "source_url": "https://example.com",
        }

        result = module._process_executive(exec_data)

        assert result["is_new_to_role"] is False

    # =========================================================================
    # Buyer Role Mapping Tests
    # =========================================================================

    def test_infer_buyer_role_ceo(self, module):
        """Test CEO maps to Executive Sponsor."""
        role = module._infer_buyer_role("President & CEO")
        assert role == "Executive Sponsor"

    def test_infer_buyer_role_cio(self, module):
        """Test CIO maps to Technical Buyer."""
        role = module._infer_buyer_role("SVP & CIO")
        assert role == "Technical Buyer"

    def test_infer_buyer_role_cto(self, module):
        """Test CTO maps to Technical Buyer."""
        role = module._infer_buyer_role("Chief Technology Officer")
        assert role == "Technical Buyer"

    def test_infer_buyer_role_vp_digital(self, module):
        """Test VP Digital maps to Champion."""
        role = module._infer_buyer_role("VP, Digital Product")
        assert role == "Champion"

    def test_infer_buyer_role_default(self, module):
        """Test unknown title maps to User Buyer."""
        role = module._infer_buyer_role("Senior Analyst")
        assert role == "User Buyer"

    def test_infer_priority_high(self, module):
        """Test high-priority buyer roles."""
        assert module._infer_priority("Executive Sponsor") == "HIGH"
        assert module._infer_priority("Technical Buyer") == "HIGH"
        assert module._infer_priority("Champion") == "HIGH"

    def test_infer_priority_medium(self, module):
        """Test medium-priority buyer roles."""
        assert module._infer_priority("User Buyer") == "MEDIUM"
        assert module._infer_priority(None) == "MEDIUM"

    # =========================================================================
    # C-Suite Extraction Tests
    # =========================================================================

    def test_find_executive_by_role_ceo(self, module):
        """Test finding CEO from executives list."""
        executives = [
            {"name": "John Smith", "title": "President & CEO"},
            {"name": "Jane Doe", "title": "CFO"},
        ]

        result = module._find_executive_by_role(executives, "ceo")

        assert result is not None
        assert result["name"] == "John Smith"

    def test_find_executive_by_role_cio(self, module):
        """Test finding CIO from executives list."""
        executives = [
            {"name": "John Smith", "title": "President & CEO"},
            {"name": "Sarah Johnson", "title": "SVP & CIO"},
        ]

        result = module._find_executive_by_role(executives, "cio")

        assert result is not None
        assert result["name"] == "Sarah Johnson"

    def test_find_executive_by_role_not_found(self, module):
        """Test returns None when role not found."""
        executives = [
            {"name": "John Smith", "title": "President & CEO"},
        ]

        result = module._find_executive_by_role(executives, "cdo")

        assert result is None

    # =========================================================================
    # Entry Point Generation Tests
    # =========================================================================

    def test_generate_entry_points_prioritizes_active_champions(self, module):
        """Test entry points prioritize active LinkedIn champions."""
        executives = [
            {
                "name": "Chris Hansen",
                "title": "VP, Digital Product",
                "buyer_role": "Champion",
                "is_active_on_linkedin": True,
            },
            {
                "name": "John Smith",
                "title": "CEO",
                "buyer_role": "Executive Sponsor",
                "is_active_on_linkedin": False,
            },
        ]

        entry_points = module._generate_entry_points(executives)

        # Champion should be first
        assert len(entry_points) > 0
        assert "Chris Hansen" in entry_points[0]

    def test_generate_entry_points_includes_technical_buyers(self, module):
        """Test entry points include technical buyers."""
        executives = [
            {
                "name": "Sarah Johnson",
                "title": "CIO",
                "buyer_role": "Technical Buyer",
                "is_new_to_role": True,
                "is_active_on_linkedin": False,
            },
        ]

        entry_points = module._generate_entry_points(executives)

        # Should include technical buyer
        assert any("Sarah Johnson" in ep for ep in entry_points)
        assert any("new in role" in ep for ep in entry_points)

    def test_generate_entry_points_limits_to_five(self, module):
        """Test entry points are limited to top 5."""
        executives = [
            {"name": f"Exec {i}", "title": "VP", "buyer_role": "Champion", "is_active_on_linkedin": True}
            for i in range(10)
        ]

        entry_points = module._generate_entry_points(executives)

        assert len(entry_points) <= 5

    # =========================================================================
    # Data Transformation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_transform_data_creates_valid_schema(self, module):
        """Test transform_data creates data matching ExecutiveIntelligenceData schema."""
        raw_data = {
            "domain": "sallybeauty.com",
            "executives": [
                {
                    "name": "John Smith",
                    "title": "President & CEO",
                    "tenure_start": "2021-03",
                    "source_url": "https://linkedin.com/in/johnsmith/",
                    "source_date": datetime.now().isoformat(),
                }
            ],
            "recent_executive_changes": [],
            "digital_leadership_quotes": [],
            "source_url": "https://linkedin.com/company/test",
            "source_date": datetime.now().isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["domain"] == "sallybeauty.com"
        assert len(result["executives"]) == 1
        assert result["ceo_profile"] is not None
        assert result["total_executives_profiled"] == 1

    @pytest.mark.asyncio
    async def test_transform_data_counts_new_in_role(self, module):
        """Test transform counts new-in-role executives."""
        # Create executives - 2 new in role, 1 established
        now = datetime.now()
        new_start = (now - timedelta(days=180)).strftime("%Y-%m")
        old_start = (now - timedelta(days=730)).strftime("%Y-%m")

        raw_data = {
            "domain": "example.com",
            "executives": [
                {"name": "New CIO", "title": "CIO", "tenure_start": new_start, "source_url": "https://example.com", "source_date": now.isoformat()},
                {"name": "New VP", "title": "VP Digital", "tenure_start": new_start, "source_url": "https://example.com", "source_date": now.isoformat()},
                {"name": "Old CEO", "title": "CEO", "tenure_start": old_start, "source_url": "https://example.com", "source_date": now.isoformat()},
            ],
            "source_url": "https://example.com",
            "source_date": now.isoformat(),
        }

        result = await module.transform_data(raw_data)

        assert result["new_in_role_count"] == 2

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "executives": [
                    {"name": "CEO", "title": "CEO", "source_url": "https://linkedin.com/ceo", "source_date": datetime.now().isoformat()}
                ],
                "source_url": "https://linkedin.com/company/example",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None
            assert "linkedin.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_returns_source_date(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_date."""
        source_date = datetime.now()
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "executives": [
                    {"name": "CEO", "title": "CEO", "source_url": "https://linkedin.com/ceo", "source_date": source_date.isoformat()}
                ],
                "source_url": "https://linkedin.com/company/example",
                "source_date": source_date.isoformat(),
            }

            result = await module.enrich("example.com")

            assert result.source.date is not None
            assert (datetime.now() - result.source.date).seconds < 60

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "executives": [],
                "source_date": datetime.now().isoformat(),
                # source_url is MISSING
            }

            with pytest.raises(MissingSourceError) as exc_info:
                await module.enrich("example.com")

            assert "source_url" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_enrich_rejects_stale_source(self, module):
        """TEST SOURCE CITATION MANDATE: Source older than 12 months MUST be rejected."""
        stale_date = datetime.now() - timedelta(days=400)

        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "executives": [],
                "source_url": "https://linkedin.com/company/example",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Validation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_validate_and_store_creates_model(self, module):
        """Test _validate_and_store creates a proper ExecutiveIntelligenceData model."""
        transformed_data = {
            "domain": "sallybeauty.com",
            "executives": [
                {
                    "name": "John Smith",
                    "title": "CEO",
                    "buyer_role": "Executive Sponsor",
                    "priority": "HIGH",
                    "source_url": "https://linkedin.com/in/johnsmith/",
                    "source_date": datetime.now().isoformat(),
                }
            ],
            "ceo_profile": {
                "name": "John Smith",
                "title": "CEO",
                "source_url": "https://linkedin.com/in/johnsmith/",
            },
            "cto_profile": None,
            "cio_profile": None,
            "cdo_profile": None,
            "cmo_profile": None,
            "recent_executive_changes": [],
            "leadership_turnover_insight": None,
            "digital_leadership_quotes": [],
            "recommended_entry_points": ["John Smith - Executive briefing"],
            "total_executives_profiled": 1,
            "new_in_role_count": 0,
            "source_url": "https://linkedin.com/company/sallybeauty",
            "source_date": datetime.now().isoformat(),
        }

        result = await module._validate_and_store("sallybeauty.com", transformed_data)

        assert isinstance(result, ExecutiveIntelligenceData)
        assert result.domain == "sallybeauty.com"
        assert len(result.executives) == 1
        assert result.ceo_profile is not None

    @pytest.mark.asyncio
    async def test_validate_and_store_validates_domain_match(self, module):
        """Test domain in data must match requested domain."""
        transformed_data = {
            "domain": "wrongdomain.com",
            "executives": [],
            "source_url": "https://linkedin.com/company/wrong",
            "source_date": datetime.now().isoformat(),
        }

        with pytest.raises(ValueError) as exc_info:
            await module._validate_and_store("example.com", transformed_data)

        assert "domain" in str(exc_info.value).lower()

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_linkedin_profiles", new_callable=AsyncMock
        ) as mock_linkedin, patch.object(
            module, "_fetch_management_page", new_callable=AsyncMock
        ) as mock_mgmt, patch.object(
            module, "_fetch_executive_quotes", new_callable=AsyncMock
        ) as mock_quotes:
            now = datetime.now()

            # Use recent dates so tenure calculation works properly
            # CIO is 6 months in role (new), CEO is 24 months (established)
            cio_start = (now - timedelta(days=180)).strftime("%Y-%m")
            ceo_start = (now - timedelta(days=730)).strftime("%Y-%m")

            mock_linkedin.return_value = {
                "executives": [
                    {
                        "name": "Denise Paulonis",
                        "title": "President & CEO",
                        "tenure_start": ceo_start,
                        "is_active_on_linkedin": True,
                        "source_url": "https://linkedin.com/in/denisepaulonis/",
                        "source_date": now.isoformat(),
                    },
                    {
                        "name": "Scott Lindblom",
                        "title": "SVP & CIO",
                        "tenure_start": cio_start,  # 6 months ago - new in role
                        "is_active_on_linkedin": False,
                        "source_url": "https://linkedin.com/in/scottlindblom/",
                        "source_date": now.isoformat(),
                    },
                ],
                "source_url": "https://linkedin.com/company/sallybeauty",
                "source_date": now.isoformat(),
            }
            mock_mgmt.return_value = {
                "recent_executive_changes": [
                    {"type": "arrival", "name": "Scott Lindblom", "date": "2023-10"}
                ],
                "leadership_turnover_insight": "New CIO creates opportunity",
                "source_url": "https://sallybeauty.com/about/leadership",
                "source_date": now.isoformat(),
            }
            mock_quotes.return_value = {
                "digital_leadership_quotes": [
                    {
                        "speaker": "Denise Paulonis",
                        "title": "CEO",
                        "quote": "We're investing in search",
                        "algolia_mapping": "Algolia InstantSearch",
                        "source_url": "https://seekingalpha.com/transcript",
                        "source_date": now.isoformat(),
                    }
                ],
                "source_url": "https://seekingalpha.com/symbol/SBH",
                "source_date": now.isoformat(),
            }

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m09_executive"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, ExecutiveIntelligenceData)
            assert result.data.total_executives_profiled == 2
            assert result.data.ceo_profile is not None
            assert result.data.cio_profile is not None

            # Verify new-in-role detection
            assert result.data.new_in_role_count >= 1

            # Verify source citation
            assert result.source is not None
            assert "linkedin.com" in str(result.source.url)

    @pytest.mark.asyncio
    async def test_enrich_with_force_bypasses_cache(self, module):
        """Test force=True bypasses cache and fetches fresh data."""
        with patch.object(module, "get_cached", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = MagicMock()

            with patch.object(
                module, "fetch_data", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = {
                    "domain": "example.com",
                    "executives": [
                        {"name": "CEO", "title": "CEO", "source_url": "https://example.com", "source_date": datetime.now().isoformat()}
                    ],
                    "source_url": "https://linkedin.com/company/example",
                    "source_date": datetime.now().isoformat(),
                }

                await module.enrich("example.com", force=True)

                mock_cache.assert_not_called()
                mock_fetch.assert_called_once_with("example.com")

    # =========================================================================
    # Error Handling Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_handles_linkedin_api_failure(self, module):
        """Test graceful handling when LinkedIn search fails."""
        with patch.object(
            module, "_fetch_linkedin_profiles", new_callable=AsyncMock
        ) as mock_linkedin, patch.object(
            module, "_fetch_management_page", new_callable=AsyncMock
        ) as mock_mgmt, patch.object(
            module, "_fetch_executive_quotes", new_callable=AsyncMock
        ) as mock_quotes:
            # LinkedIn fails
            mock_linkedin.side_effect = Exception("LinkedIn API timeout")

            # Management succeeds
            mock_mgmt.return_value = {
                "recent_executive_changes": [],
                "source_url": "https://company.com/about",
                "source_date": datetime.now().isoformat(),
            }

            # Quotes fails
            mock_quotes.side_effect = Exception("Quotes API timeout")

            # Should still work with management fallback
            result = await module.enrich("example.com")

            assert isinstance(result.data, ExecutiveIntelligenceData)

    @pytest.mark.asyncio
    async def test_fails_when_all_sources_fail(self, module):
        """Test appropriate error when all data sources fail."""
        with patch.object(
            module, "_fetch_linkedin_profiles", new_callable=AsyncMock
        ) as mock_linkedin, patch.object(
            module, "_fetch_management_page", new_callable=AsyncMock
        ) as mock_mgmt, patch.object(
            module, "_fetch_executive_quotes", new_callable=AsyncMock
        ) as mock_quotes:
            mock_linkedin.side_effect = Exception("LinkedIn API timeout")
            mock_mgmt.side_effect = Exception("Management page timeout")
            mock_quotes.side_effect = Exception("Quotes API timeout")

            with pytest.raises(Exception) as exc_info:
                await module.enrich("example.com")

            assert "fail" in str(exc_info.value).lower()

    # =========================================================================
    # Data Model Tests
    # =========================================================================

    def test_executive_model_creation(self):
        """Test Executive pydantic model creation."""
        exec_data = Executive(
            name="John Smith",
            title="CEO",
            linkedin_url="https://linkedin.com/in/johnsmith/",
            tenure_start="2022-01",
            tenure_months=24,
            is_new_to_role=False,
            background="Former CFO",
            buyer_role="Executive Sponsor",
            priority="HIGH",
            source_url="https://linkedin.com/in/johnsmith/",
        )

        assert exec_data.name == "John Smith"
        assert exec_data.is_new_to_role is False
        assert exec_data.buyer_role == "Executive Sponsor"

    def test_executive_model_with_minimal_fields(self):
        """Test Executive with only required fields."""
        exec_data = Executive(
            name="Jane Doe",
            title="Director",
            source_url="https://example.com",
        )

        assert exec_data.name == "Jane Doe"
        assert exec_data.linkedin_url is None
        assert exec_data.is_new_to_role is False
        assert exec_data.priority == "MEDIUM"

    def test_speaking_language_model(self):
        """Test SpeakingLanguage model creation."""
        quote_mapping = QuoteToProductMapping(
            quote="We need better search",
            maps_to="Algolia InstantSearch",
            source_url="https://example.com/quote",
        )

        speaking = SpeakingLanguage(
            terms_used=["digital transformation", "customer journey"],
            quote_to_product_mapping=[quote_mapping],
        )

        assert len(speaking.terms_used) == 2
        assert len(speaking.quote_to_product_mapping) == 1

    def test_digital_leadership_quote_model(self):
        """Test DigitalLeadershipQuote model creation."""
        quote = DigitalLeadershipQuote(
            speaker="CEO Name",
            title="President & CEO",
            quote="Search is key to our digital strategy",
            context="Q4 2025 Earnings Call",
            algolia_mapping="Algolia InstantSearch",
            source_url="https://seekingalpha.com/transcript",
            source_date="2026-02-01",
        )

        assert quote.speaker == "CEO Name"
        assert quote.algolia_mapping == "Algolia InstantSearch"

    def test_executive_intelligence_data_model_creation(self):
        """Test ExecutiveIntelligenceData pydantic model creation."""
        exec1 = Executive(
            name="CEO",
            title="CEO",
            buyer_role="Executive Sponsor",
            source_url="https://example.com",
        )

        data = ExecutiveIntelligenceData(
            domain="example.com",
            executives=[exec1],
            ceo_profile=exec1,
            total_executives_profiled=1,
            new_in_role_count=0,
        )

        assert data.domain == "example.com"
        assert len(data.executives) == 1
        assert data.ceo_profile is not None

    def test_executive_intelligence_data_with_minimal_fields(self):
        """Test ExecutiveIntelligenceData with only required fields."""
        data = ExecutiveIntelligenceData(
            domain="example.com",
        )

        assert data.domain == "example.com"
        assert data.executives == []
        assert data.ceo_profile is None
        assert data.total_executives_profiled == 0

    def test_executive_intelligence_data_model_dump(self):
        """Test ExecutiveIntelligenceData can be serialized."""
        data = ExecutiveIntelligenceData(
            domain="example.com",
            total_executives_profiled=5,
            new_in_role_count=2,
        )

        dumped = data.model_dump()

        assert isinstance(dumped, dict)
        assert dumped["domain"] == "example.com"
        assert dumped["total_executives_profiled"] == 5


class TestM09ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M09 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m09_executive")
        assert module_class is not None
        assert module_class.MODULE_ID == "m09_executive"

    def test_module_in_wave_3(self):
        """Test M09 module appears in Wave 3 modules."""
        from app.modules.base import get_modules_by_wave

        wave_3_modules = get_modules_by_wave(3)
        module_ids = [cls.MODULE_ID for cls in wave_3_modules]

        assert "m09_executive" in module_ids
