"""
Unit Tests for Source Citation Models
=====================================

Tests for P0 source citation mandate enforcement.

Test Categories:
1. SourceCitation creation and validation
2. Freshness status calculation
3. SourcedDataPoint enforcement
4. Multi-source aggregation
5. Executive quote attribution
6. Validation utilities

Run:
    pytest tests/unit/models/test_source.py -v
"""

import pytest
from datetime import datetime, timedelta
from pydantic import ValidationError

from pipeline.models.source import (
    SourceCitation,
    SourcedDataPoint,
    SourcedString,
    SourcedFloat,
    SourcedInt,
    SourcedList,
    MultiSourcedDataPoint,
    ExecutiveQuote,
    ValidationResult,
    SourceType,
    FreshnessStatus,
    FRESHNESS_RULES,
    validate_citations,
)


class TestSourceCitationCreation:
    """Test SourceCitation object creation and validation."""

    def test_create_minimal_citation(self):
        """Citation can be created with just required fields."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json",
        )
        assert citation.source_type == SourceType.BUILTWITH
        assert str(citation.source_url) == "https://api.builtwith.com/v21/api.json"
        assert citation.retrieved_at is not None

    def test_create_full_citation(self):
        """Citation can be created with all fields."""
        now = datetime.utcnow()
        citation = SourceCitation(
            source_type=SourceType.SIMILARWEB,
            source_url="https://api.similarweb.com/v1/traffic",
            retrieved_at=now,
            api_endpoint="traffic-and-engagement",
            api_version="v1",
            confidence_score=0.95,
            notes="Monthly traffic data",
        )
        assert citation.api_endpoint == "traffic-and-engagement"
        assert citation.api_version == "v1"
        assert citation.confidence_score == 0.95
        assert citation.notes == "Monthly traffic data"

    def test_citation_requires_source_url(self):
        """Citation must have a source URL (P0 requirement)."""
        with pytest.raises(ValidationError) as exc_info:
            SourceCitation(source_type=SourceType.BUILTWITH)
        assert "source_url" in str(exc_info.value)

    def test_citation_requires_valid_url(self):
        """Citation URL must be valid HTTP/HTTPS."""
        with pytest.raises(ValidationError):
            SourceCitation(
                source_type=SourceType.BUILTWITH,
                source_url="not-a-valid-url",
            )

    def test_citation_confidence_bounds(self):
        """Confidence score must be between 0 and 1."""
        # Valid bounds
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json",
            confidence_score=0.0,
        )
        assert citation.confidence_score == 0.0

        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json",
            confidence_score=1.0,
        )
        assert citation.confidence_score == 1.0

        # Invalid bounds
        with pytest.raises(ValidationError):
            SourceCitation(
                source_type=SourceType.BUILTWITH,
                source_url="https://api.builtwith.com/v21/api.json",
                confidence_score=1.5,
            )

        with pytest.raises(ValidationError):
            SourceCitation(
                source_type=SourceType.BUILTWITH,
                source_url="https://api.builtwith.com/v21/api.json",
                confidence_score=-0.1,
            )


class TestSourceCitationFactoryMethods:
    """Test factory methods for creating citations."""

    def test_from_api_response(self):
        """Factory method creates citation from API response."""
        citation = SourceCitation.from_api_response(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json",
            api_endpoint="domain-lookup",
            api_version="v21",
            confidence=0.9,
        )
        assert citation.source_type == SourceType.BUILTWITH
        assert citation.api_endpoint == "domain-lookup"
        assert citation.confidence_score == 0.9
        # Retrieved at should be very recent
        assert (datetime.utcnow() - citation.retrieved_at).total_seconds() < 5

    def test_from_cache(self):
        """Factory method creates cache citation from original."""
        original = SourceCitation(
            source_type=SourceType.SIMILARWEB,
            source_url="https://api.similarweb.com/v1/traffic",
            retrieved_at=datetime.utcnow() - timedelta(hours=1),
            confidence_score=0.95,
        )

        cached = SourceCitation.from_cache(original, cache_key="sw:costco.com:traffic")

        assert cached.source_type == SourceType.CACHE
        assert cached.cache_key == "sw:costco.com:traffic"
        assert cached.original_citation == original
        assert cached.confidence_score == 0.95
        assert "Cached from similarweb" in cached.notes


class TestFreshnessCalculation:
    """Test freshness status calculation based on source type rules."""

    def test_fresh_builtwith_citation(self, fresh_builtwith_citation):
        """BuiltWith citation within 30 days is fresh."""
        assert fresh_builtwith_citation.freshness_status == FreshnessStatus.FRESH
        assert fresh_builtwith_citation.is_valid is True

    def test_stale_builtwith_citation(self, stale_builtwith_citation):
        """BuiltWith citation 31-90 days old is stale."""
        assert stale_builtwith_citation.freshness_status == FreshnessStatus.STALE
        assert stale_builtwith_citation.is_valid is True  # Still valid, just stale

    def test_expired_builtwith_citation(self, expired_builtwith_citation):
        """BuiltWith citation >180 days old is expired."""
        assert expired_builtwith_citation.freshness_status == FreshnessStatus.EXPIRED
        assert expired_builtwith_citation.is_valid is False

    def test_yahoo_finance_freshness_strict(self):
        """Yahoo Finance has strict 1-day freshness rule."""
        # 6 hours old - fresh
        citation_fresh = SourceCitation(
            source_type=SourceType.YAHOO_FINANCE,
            source_url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/COST",
            retrieved_at=datetime.utcnow() - timedelta(hours=6),
        )
        assert citation_fresh.freshness_status == FreshnessStatus.FRESH

        # 2 days old - stale
        citation_stale = SourceCitation(
            source_type=SourceType.YAHOO_FINANCE,
            source_url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/COST",
            retrieved_at=datetime.utcnow() - timedelta(days=2),
        )
        assert citation_stale.freshness_status == FreshnessStatus.STALE

        # 35 days old - expired
        citation_expired = SourceCitation(
            source_type=SourceType.YAHOO_FINANCE,
            source_url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/COST",
            retrieved_at=datetime.utcnow() - timedelta(days=35),
        )
        assert citation_expired.freshness_status == FreshnessStatus.EXPIRED

    def test_age_days_calculation(self):
        """Age in days is calculated correctly."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json",
            retrieved_at=datetime.utcnow() - timedelta(days=15, hours=12),
        )
        # Should be approximately 15.5 days
        assert 15 < citation.age_days < 16

    def test_days_until_stale(self, fresh_builtwith_citation):
        """Days until stale is calculated correctly."""
        days_remaining = fresh_builtwith_citation.days_until_stale()
        assert days_remaining is not None
        assert days_remaining > 0
        # Fresh rule for BuiltWith is 30 days, citation is 5 days old
        assert 24 < days_remaining < 26

    def test_days_until_expired(self, fresh_builtwith_citation):
        """Days until expired is calculated correctly."""
        days_remaining = fresh_builtwith_citation.days_until_expired()
        assert days_remaining is not None
        # Expired rule for BuiltWith is 180 days, citation is 5 days old
        assert 174 < days_remaining < 176


class TestSourcedDataPoint:
    """Test SourcedDataPoint enforcement of P0 requirement."""

    def test_create_sourced_string(self, fresh_builtwith_citation):
        """SourcedString can be created with citation."""
        data = SourcedString(
            value="Algolia",
            citation=fresh_builtwith_citation,
            field_name="search_provider",
        )
        assert data.value == "Algolia"
        assert data.is_fresh is True

    def test_create_sourced_float(self, fresh_similarweb_citation):
        """SourcedFloat can be created with citation."""
        data = SourcedFloat(
            value=150000000.0,
            citation=fresh_similarweb_citation,
            field_name="monthly_visits",
            unit="visits/month",
        )
        assert data.value == 150000000.0
        assert data.unit == "visits/month"

    def test_create_sourced_int(self, fresh_yahoo_finance_citation):
        """SourcedInt can be created with citation."""
        data = SourcedInt(
            value=254000000000,
            citation=fresh_yahoo_finance_citation,
            field_name="annual_revenue",
            unit="USD",
        )
        assert data.value == 254000000000

    def test_create_sourced_list(self, fresh_builtwith_citation):
        """SourcedList can be created with citation."""
        data = SourcedList(
            value=["Algolia", "React", "CloudFlare"],
            citation=fresh_builtwith_citation,
            field_name="technologies",
        )
        assert len(data.value) == 3

    def test_sourced_data_requires_citation(self):
        """P0 REQUIREMENT: Data cannot be created without citation."""
        with pytest.raises(ValidationError) as exc_info:
            SourcedString(value="Algolia")
        assert "citation" in str(exc_info.value).lower()

    def test_is_valid_reflects_citation_status(
        self, fresh_builtwith_citation, expired_builtwith_citation
    ):
        """is_valid property reflects citation validity."""
        fresh_data = SourcedString(value="Algolia", citation=fresh_builtwith_citation)
        assert fresh_data.is_valid is True

        expired_data = SourcedString(
            value="Algolia", citation=expired_builtwith_citation
        )
        assert expired_data.is_valid is False


class TestMultiSourcedDataPoint:
    """Test MultiSourcedDataPoint for aggregated data."""

    def test_create_multi_sourced_data(
        self, fresh_similarweb_citation, fresh_builtwith_citation
    ):
        """MultiSourcedDataPoint aggregates multiple sources."""
        data = MultiSourcedDataPoint(
            value=150000000,
            primary_citation=fresh_similarweb_citation,
            supporting_citations=[fresh_builtwith_citation],
            aggregation_method="primary_with_validation",
            confidence_score=0.95,
        )
        assert data.value == 150000000
        assert len(data.all_citations) == 2
        assert data.primary_citation == fresh_similarweb_citation

    def test_oldest_citation_age(
        self, fresh_similarweb_citation, stale_builtwith_citation
    ):
        """Oldest citation age is tracked correctly."""
        data = MultiSourcedDataPoint(
            value=150000000,
            primary_citation=fresh_similarweb_citation,
            supporting_citations=[stale_builtwith_citation],
        )
        # Stale citation is 60 days old
        assert data.oldest_citation_age > 55

    def test_is_valid_all_citations(
        self, fresh_similarweb_citation, expired_builtwith_citation
    ):
        """is_valid requires ALL citations to be valid."""
        data = MultiSourcedDataPoint(
            value=150000000,
            primary_citation=fresh_similarweb_citation,
            supporting_citations=[expired_builtwith_citation],
        )
        # One expired citation makes the whole thing invalid
        assert data.is_valid is False


class TestExecutiveQuote:
    """Test ExecutiveQuote attribution enforcement."""

    def test_create_executive_quote(self, earnings_call_citation):
        """ExecutiveQuote requires full attribution."""
        quote = ExecutiveQuote(
            quote="We continue to invest in digital capabilities to enhance member experience.",
            speaker_name="Ron Vachris",
            speaker_title="CEO",
            citation=earnings_call_citation,
            context="Q1 2024 Earnings Call",
            maps_to_algolia="Search relevance, personalization",
        )
        assert quote.speaker_name == "Ron Vachris"
        assert quote.speaker_title == "CEO"
        assert "digital capabilities" in quote.quote

    def test_quote_requires_speaker_name(self, earnings_call_citation):
        """ExecutiveQuote must have speaker name."""
        with pytest.raises(ValidationError):
            ExecutiveQuote(
                quote="We continue to invest in digital capabilities.",
                speaker_name="",  # Empty not allowed
                speaker_title="CEO",
                citation=earnings_call_citation,
            )

    def test_quote_requires_non_empty_quote(self, earnings_call_citation):
        """ExecutiveQuote must have non-empty quote text."""
        with pytest.raises(ValidationError):
            ExecutiveQuote(
                quote="   ",  # Whitespace only not allowed
                speaker_name="Ron Vachris",
                speaker_title="CEO",
                citation=earnings_call_citation,
            )


class TestValidateCitations:
    """Test the validate_citations utility function."""

    def test_validate_all_fresh(
        self, fresh_builtwith_citation, fresh_similarweb_citation
    ):
        """All fresh citations pass validation."""
        result = validate_citations(
            [fresh_builtwith_citation, fresh_similarweb_citation]
        )
        assert result.is_valid is True
        assert len(result.errors) == 0
        assert result.citation_count == 2
        assert result.freshness_summary[FreshnessStatus.FRESH] == 2

    def test_validate_with_stale(
        self, fresh_builtwith_citation, stale_builtwith_citation
    ):
        """Stale citations generate warnings but pass."""
        result = validate_citations(
            [fresh_builtwith_citation, stale_builtwith_citation]
        )
        assert result.is_valid is True
        assert len(result.warnings) == 1
        assert "stale" in result.warnings[0].lower()

    def test_validate_with_expired(
        self, fresh_builtwith_citation, expired_builtwith_citation
    ):
        """Expired citations generate errors and fail."""
        result = validate_citations(
            [fresh_builtwith_citation, expired_builtwith_citation]
        )
        assert result.is_valid is False
        assert len(result.errors) == 1
        assert result.expired_count == 1
        assert "expired" in result.errors[0].lower()

    def test_validate_empty_list(self):
        """Empty citation list passes validation."""
        result = validate_citations([])
        assert result.is_valid is True
        assert result.citation_count == 0


class TestFreshnessRules:
    """Test that freshness rules are configured correctly."""

    def test_all_source_types_have_rules(self):
        """Every source type should have freshness rules defined."""
        for source_type in SourceType:
            # Cache and some special types might not have explicit rules
            if source_type in FRESHNESS_RULES:
                rules = FRESHNESS_RULES[source_type]
                assert "fresh" in rules
                assert "stale" in rules
                assert "expired" in rules
                # Rules should be increasing: fresh < stale < expired
                assert rules["fresh"] < rules["stale"] < rules["expired"]

    def test_financial_data_has_strict_rules(self):
        """Financial data (Yahoo Finance) should have strict freshness."""
        rules = FRESHNESS_RULES[SourceType.YAHOO_FINANCE]
        assert rules["fresh"] <= 1  # 1 day max for fresh

    def test_tech_stack_has_relaxed_rules(self):
        """Tech stack (BuiltWith) can be older since it changes slowly."""
        rules = FRESHNESS_RULES[SourceType.BUILTWITH]
        assert rules["fresh"] >= 7  # At least a week


class TestToCompactDict:
    """Test compact dictionary representation for embedding."""

    def test_to_compact_dict(self, fresh_builtwith_citation):
        """Compact dict has minimal required fields."""
        compact = fresh_builtwith_citation.to_compact_dict()
        assert "type" in compact
        assert "url" in compact
        assert "at" in compact
        assert "fresh" in compact
        assert compact["type"] == "builtwith"
        assert compact["fresh"] == "fresh"


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_citation_at_exact_freshness_boundary(self):
        """Citation exactly at freshness boundary."""
        # BuiltWith fresh boundary is 30 days
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json",
            retrieved_at=datetime.utcnow() - timedelta(days=30),
        )
        # At exactly 30 days, should still be fresh (<=)
        assert citation.freshness_status == FreshnessStatus.FRESH

    def test_citation_one_second_past_boundary(self):
        """Citation one second past freshness boundary."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json",
            retrieved_at=datetime.utcnow() - timedelta(days=30, seconds=1),
        )
        # Just past 30 days, should be stale
        assert citation.freshness_status == FreshnessStatus.STALE

    def test_future_retrieved_at(self):
        """Citation with future timestamp (clock skew)."""
        citation = SourceCitation(
            source_type=SourceType.BUILTWITH,
            source_url="https://api.builtwith.com/v21/api.json",
            retrieved_at=datetime.utcnow() + timedelta(hours=1),
        )
        # Negative age should still be considered fresh
        assert citation.age_days < 0
        assert citation.freshness_status == FreshnessStatus.FRESH
