"""
Unit tests for M07_StrategicContext Intelligence Module.

Tests the strategic context module which captures strategic initiatives,
trigger events, and timing signals. Validates source citation mandate compliance.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from app.modules.m07_strategic import (
    M07StrategicContextModule,
    StrategicContextData,
    TriggerEvent,
    DigitalInitiative,
    TRIGGER_WEIGHTS,
)
from app.modules.base import ModuleResult
from app.services.validation import MissingSourceError, SourceFreshnessError


class TestM07StrategicContextModule:
    """Test suite for M07StrategicContextModule."""

    @pytest.fixture
    def module(self):
        """Create module instance for testing."""
        return M07StrategicContextModule()

    @pytest.fixture
    def valid_websearch_response(self):
        """Mock WebSearch API response."""
        return {
            "domain": "sallybeauty.com",
            "trigger_events": [
                {
                    "event": "Website Platform Upgrade",
                    "timing": "Q2-Q3 2026",
                    "relevance": "HIGH",
                    "source_url": "https://businesswire.com/sally-upgrade",
                },
                {
                    "event": "Mobile App Relaunch",
                    "timing": "Spring 2026",
                    "relevance": "HIGH",
                    "source_url": "https://sallybeauty.com/newsroom/",
                },
            ],
            "digital_initiatives": [
                {
                    "name": "Digital Transformation Initiative",
                    "description": "Multi-year digital modernization",
                    "timeline": "FY2025-FY2027",
                },
            ],
            "source_url": "https://google.com/search?q=sally+beauty+news",
            "source_date": datetime.now().isoformat(),
        }

    # =========================================================================
    # Module Metadata Tests
    # =========================================================================

    def test_module_id(self, module):
        """Test module has correct ID."""
        assert module.MODULE_ID == "m07_strategic_context"

    def test_module_name(self, module):
        """Test module has correct name."""
        assert module.MODULE_NAME == "Strategic Context"

    def test_module_wave(self, module):
        """Test module is in Wave 2 (Competitive)."""
        assert module.WAVE == 2

    def test_module_has_dependencies(self, module):
        """Test Wave 2 module has correct dependencies."""
        assert len(module.DEPENDS_ON) > 0

    def test_module_source_type(self, module):
        """Test module has correct source type."""
        assert module.SOURCE_TYPE in ["api", "webpage"]

    # =========================================================================
    # Trigger Weights Tests
    # =========================================================================

    def test_trigger_weights_defined(self):
        """Test trigger weights are properly defined."""
        assert len(TRIGGER_WEIGHTS) > 0
        # All weights should be positive
        for weight in TRIGGER_WEIGHTS.values():
            assert weight > 0

    # =========================================================================
    # Source Citation Mandate Tests (CRITICAL)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_returns_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Result must have source_url."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "trigger_events": [],
                "digital_initiatives": [],
                "source_url": "https://google.com/search?q=example+news",
                "source_date": datetime.now().isoformat(),
            }

            result = await module.enrich("example.com")

            assert isinstance(result, ModuleResult)
            assert result.source is not None

    @pytest.mark.asyncio
    async def test_enrich_rejects_missing_source_url(self, module):
        """TEST SOURCE CITATION MANDATE: Missing source_url MUST raise error."""
        with patch.object(module, "fetch_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "domain": "example.com",
                "trigger_events": [],
                "digital_initiatives": [],
                "source_date": datetime.now().isoformat(),
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
                "trigger_events": [],
                "digital_initiatives": [],
                "source_url": "https://google.com/search?q=example+news",
                "source_date": stale_date.isoformat(),
            }

            with pytest.raises(SourceFreshnessError) as exc_info:
                await module.enrich("example.com")

            assert "older than" in str(exc_info.value)

    # =========================================================================
    # Full Enrichment Pipeline Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_enrich_full_pipeline(self, module, valid_websearch_response):
        """Test complete enrichment pipeline from domain to ModuleResult."""
        with patch.object(
            module, "_fetch_from_websearch", new_callable=AsyncMock
        ) as mock_ws:
            mock_ws.return_value = valid_websearch_response

            result = await module.enrich("sallybeauty.com")

            # Verify result structure
            assert isinstance(result, ModuleResult)
            assert result.module_id == "m07_strategic_context"
            assert result.domain == "sallybeauty.com"

            # Verify data
            assert isinstance(result.data, StrategicContextData)

            # Verify source citation
            assert result.source is not None

    # =========================================================================
    # StrategicContextData Model Tests
    # =========================================================================

    def test_strategic_context_data_model_creation(self):
        """Test StrategicContextData pydantic model creation."""
        data = StrategicContextData(
            domain="example.com",
        )

        assert data.domain == "example.com"

    def test_trigger_event_model(self):
        """Test TriggerEvent model creation."""
        event = TriggerEvent(
            event_type="platform_migration",
            description="Website platform upgrade",
            timing="Q2 2026",
            source_url="https://businesswire.com/news",
        )

        assert event.event_type == "platform_migration"
        assert event.timing == "Q2 2026"

    def test_digital_initiative_model(self):
        """Test DigitalInitiative model creation."""
        initiative = DigitalInitiative(
            name="Digital Transformation",
            description="Multi-year digital modernization",
            timeline="FY2025-FY2027",
        )

        assert initiative.name == "Digital Transformation"


class TestM07ModuleRegistry:
    """Test module registration with the registry."""

    def test_module_is_registered(self):
        """Test M07 module is registered in the global registry."""
        from app.modules.base import get_module_class

        module_class = get_module_class("m07_strategic_context")
        assert module_class is not None
        assert module_class.MODULE_ID == "m07_strategic_context"

    def test_module_in_wave_2(self):
        """Test M07 module appears in Wave 2 modules."""
        from app.modules.base import get_modules_by_wave

        wave_2_modules = get_modules_by_wave(2)
        module_ids = [cls.MODULE_ID for cls in wave_2_modules]

        assert "m07_strategic_context" in module_ids
