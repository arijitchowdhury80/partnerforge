"""
Integration Tests for Intelligence API Endpoints

Tests intelligence module endpoints (M01-M15), overview, and full intelligence retrieval.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime, timedelta
from typing import AsyncGenerator
import json

# Import app and dependencies
from app.main import app
from app.database import Base, get_session
from app.api.deps import get_current_user, CurrentUser
from app.models import DisplacementTarget
from app.models.intelligence import (
    IntelCompanyContext,
    IntelTechnologyStack,
    IntelTrafficAnalysis,
    IntelFinancialProfile,
    IntelCompetitorIntelligence,
    IntelHiringSignals,
    IntelStrategicContext,
    IntelInvestorIntelligence,
    IntelExecutiveIntelligence,
    IntelBuyingCommittee,
    IntelDisplacementAnalysis,
    IntelCaseStudyMatches,
    IntelICPPriority,
    IntelSignalScoring,
    IntelStrategicBrief,
)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh in-memory database for each test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def mock_user():
    """Create a mock current user."""
    return CurrentUser(
        user_id="test-user-001",
        email="test@partnerforge.local",
        name="Test User",
        role="ae",
        team_id="test-team-001",
        is_active=True,
        is_admin=False,
    )


@pytest.fixture
async def client(test_db, mock_user):
    """Create a test client with database and user overrides."""

    async def override_get_session():
        yield test_db

    async def override_get_user():
        return mock_user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def sample_target(test_db) -> DisplacementTarget:
    """Create a sample displacement target for testing."""
    target = DisplacementTarget(
        domain="costco.com",
        company_name="Costco Wholesale Corporation",
        partner_tech="Adobe AEM",
        vertical="Retail",
        country="US",
        icp_score=85,
        icp_tier_name="hot",
        icp_tier=1,
        sw_monthly_visits=50000000,
        revenue=240000000000,
        current_search="Elasticsearch",
        is_public=True,
        ticker="COST",
        enrichment_level="full",
        last_enriched=datetime.utcnow(),
    )
    test_db.add(target)
    await test_db.commit()
    await test_db.refresh(target)
    return target


@pytest.fixture
async def sample_intelligence(test_db, sample_target) -> dict:
    """Create sample intelligence data for all modules."""
    intel_data = {}

    # M01: Company Context
    company_context = IntelCompanyContext(
        domain="costco.com",
        company_name="Costco Wholesale Corporation",
        description="Wholesale warehouse club retailer",
        industry="Retail",
        sub_industry="Warehouse Clubs",
        founded_year=1983,
        headquarters_city="Issaquah",
        headquarters_state="WA",
        headquarters_country="US",
        employee_count=304000,
        employee_range="100K+",
        source_url="https://builtwith.com/costco.com",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(company_context)
    intel_data["m01_company_context"] = company_context

    # M02: Technology Stack
    tech_stack = IntelTechnologyStack(
        domain="costco.com",
        search_provider="Elasticsearch",
        cms_platform="Adobe Experience Manager",
        ecommerce_platform="Custom",
        analytics_tools=json.dumps(["Google Analytics", "Adobe Analytics"]),
        personalization_tools=json.dumps(["Adobe Target"]),
        total_technologies=45,
        tech_spend_estimate=150000,
        source_url="https://builtwith.com/costco.com",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(tech_stack)
    intel_data["m02_tech_stack"] = tech_stack

    # M03: Traffic Analysis
    traffic = IntelTrafficAnalysis(
        domain="costco.com",
        monthly_visits=50000000,
        unique_visitors=35000000,
        pages_per_visit=4.2,
        avg_visit_duration=180,
        bounce_rate=0.35,
        search_traffic_pct=0.35,
        global_rank=500,
        country_rank=200,
        source_url="https://similarweb.com/website/costco.com",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(traffic)
    intel_data["m03_traffic"] = traffic

    # M04: Financial Profile
    financials = IntelFinancialProfile(
        domain="costco.com",
        ticker="COST",
        is_public=True,
        revenue=240000000000,
        gross_margin=0.13,
        operating_margin=0.035,
        net_margin=0.027,
        revenue_growth_yoy=0.08,
        market_cap=257000000000,
        stock_price=580.50,
        source_url="https://finance.yahoo.com/quote/COST",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(financials)
    intel_data["m04_financials"] = financials

    # M05: Competitor Intelligence
    competitors = IntelCompetitorIntelligence(
        domain="costco.com",
        competitors=json.dumps([
            {"domain": "samsclub.com", "name": "Sam's Club"},
            {"domain": "bjs.com", "name": "BJ's Wholesale"}
        ]),
        competitor_count=5,
        competitors_using_algolia=json.dumps([]),
        algolia_competitor_count=0,
        source_url="https://similarweb.com/website/costco.com/competitors",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(competitors)
    intel_data["m05_competitors"] = competitors

    # M06: Hiring Signals
    hiring = IntelHiringSignals(
        domain="costco.com",
        total_job_openings=250,
        tech_job_openings=35,
        search_related_jobs=2,
        hiring_trend="growing",
        recent_postings=json.dumps([
            {"title": "Senior Software Engineer", "location": "Seattle, WA"}
        ]),
        source_url="https://careers.costco.com",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(hiring)
    intel_data["m06_hiring"] = hiring

    # M07: Strategic Context
    strategic = IntelStrategicContext(
        domain="costco.com",
        key_initiatives=json.dumps(["Digital transformation", "E-commerce expansion"]),
        market_position="Market leader in warehouse clubs",
        competitive_advantages=json.dumps(["Membership model", "Low prices"]),
        challenges=json.dumps(["E-commerce competition", "Supply chain"]),
        source_url="https://seekingalpha.com/costco",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(strategic)
    intel_data["m07_strategic"] = strategic

    # M08: Investor Intelligence
    investor = IntelInvestorIntelligence(
        domain="costco.com",
        latest_earnings_date=datetime(2026, 2, 1),
        earnings_highlights=json.dumps(["Strong membership growth", "Digital sales up 15%"]),
        sec_filings=json.dumps([
            {"type": "10-K", "date": "2025-10-15", "url": "https://sec.gov/..."}
        ]),
        analyst_ratings=json.dumps({"buy": 20, "hold": 5, "sell": 1}),
        price_target=650.00,
        source_url="https://seekingalpha.com/costco",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(investor)
    intel_data["m08_investor"] = investor

    # M09: Executive Intelligence
    executive = IntelExecutiveIntelligence(
        domain="costco.com",
        executives=json.dumps([
            {"name": "Ron Vachris", "title": "CEO"},
            {"name": "Gary Millerchip", "title": "CFO"}
        ]),
        exec_quotes=json.dumps([
            {
                "speaker": "Ron Vachris",
                "title": "CEO",
                "quote": "We continue to invest in our digital capabilities",
                "source": "Q4 2025 Earnings Call"
            }
        ]),
        key_themes=json.dumps(["digital transformation", "member experience"]),
        source_url="https://seekingalpha.com/costco/earnings",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(executive)
    intel_data["m09_executive"] = executive

    # M10: Buying Committee
    buying_committee = IntelBuyingCommittee(
        domain="costco.com",
        decision_makers=json.dumps([
            {"name": "Gary Millerchip", "title": "CFO", "role": "Economic Buyer"},
            {"name": "CTO Name", "title": "CTO", "role": "Technical Buyer"}
        ]),
        influencers=json.dumps([
            {"title": "VP Engineering", "department": "Technology"}
        ]),
        buying_stage="Awareness",
        source_url="https://linkedin.com",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(buying_committee)
    intel_data["m10_buying_committee"] = buying_committee

    # M11: Displacement Analysis
    displacement = IntelDisplacementAnalysis(
        domain="costco.com",
        current_search_provider="Elasticsearch",
        search_satisfaction="Medium",
        displacement_difficulty="Medium",
        displacement_angle="Performance and relevance improvements",
        pain_points=json.dumps(["Relevance tuning complexity", "Scaling challenges"]),
        trigger_events=json.dumps(["Digital transformation initiative"]),
        source_url="https://builtwith.com",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(displacement)
    intel_data["m11_displacement"] = displacement

    # M12: Case Study Matches
    case_studies = IntelCaseStudyMatches(
        domain="costco.com",
        matched_case_studies=json.dumps([
            {"company": "Walgreens", "vertical": "Retail", "score": 0.85}
        ]),
        match_count=3,
        top_match_score=0.85,
        match_reasons=json.dumps(["Same vertical", "Similar traffic"]),
        source_url="https://algolia.com/customers",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(case_studies)
    intel_data["m12_case_study"] = case_studies

    # M13: ICP Priority
    icp_priority = IntelICPPriority(
        domain="costco.com",
        icp_score=85,
        icp_tier="hot",
        score_breakdown=json.dumps({
            "vertical": 40,
            "traffic": 25,
            "tech_spend": 15,
            "partner_tech": 5
        }),
        score_reasons=json.dumps([
            "High-traffic retail site",
            "Public company with budget",
            "Adobe AEM partnership"
        ]),
        recommended_actions=json.dumps([
            "Schedule executive briefing",
            "Prepare ROI analysis"
        ]),
        source_url="https://partnerforge.local/scoring",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(icp_priority)
    intel_data["m13_icp_priority"] = icp_priority

    # M14: Signal Scoring
    signal_scoring = IntelSignalScoring(
        domain="costco.com",
        overall_signal_score=78,
        buying_intent_score=72,
        timing_score=80,
        fit_score=85,
        signal_breakdown=json.dumps({
            "hiring_signals": 15,
            "tech_changes": 20,
            "exec_changes": 10,
            "financial_health": 33
        }),
        top_signals=json.dumps([
            "Digital transformation initiative",
            "Search-related hiring",
            "Strong financial position"
        ]),
        source_url="https://partnerforge.local/signals",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(signal_scoring)
    intel_data["m14_signal_scoring"] = signal_scoring

    # M15: Strategic Brief
    strategic_brief = IntelStrategicBrief(
        domain="costco.com",
        executive_summary="High-priority retail target with strong fit for Algolia",
        key_talking_points=json.dumps([
            "Digital transformation investment aligns with Algolia value prop",
            "Search relevance improvements can drive conversion"
        ]),
        objection_handling=json.dumps({
            "We have Elasticsearch": "Algolia offers managed service with better relevance"
        }),
        next_steps=json.dumps([
            "Schedule discovery call with CTO",
            "Prepare demo with retail use cases"
        ]),
        competitive_positioning="Position against Elasticsearch limitations",
        source_url="https://partnerforge.local/brief",
        source_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    test_db.add(strategic_brief)
    intel_data["m15_strategic_brief"] = strategic_brief

    await test_db.commit()

    # Refresh all
    for key, intel in intel_data.items():
        await test_db.refresh(intel)

    return intel_data


# =============================================================================
# Intelligence Overview Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_intelligence_overview(client, sample_target, sample_intelligence):
    """Test getting intelligence overview for a domain."""
    response = await client.get("/api/v1/intel/costco.com")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    assert "modules" in data
    assert len(data["modules"]) == 15

    # Check module status
    for module_id, module_info in data["modules"].items():
        assert "status" in module_info
        assert "wave" in module_info
        assert "freshness" in module_info


@pytest.mark.asyncio
async def test_get_intelligence_overview_not_found(client):
    """Test 404 for non-existent domain."""
    response = await client.get("/api/v1/intel/nonexistent.com")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_intelligence_overview_normalizes_domain(client, sample_target, sample_intelligence):
    """Test domain normalization in overview."""
    response = await client.get("/api/v1/intel/https://www.costco.com/")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"


# =============================================================================
# Wave 1 Module Tests (Foundation)
# =============================================================================

@pytest.mark.asyncio
async def test_get_company_context(client, sample_target, sample_intelligence):
    """Test M01: Company Context endpoint."""
    response = await client.get("/api/v1/intel/costco.com/company")
    assert response.status_code == 200

    data = response.json()
    assert data["company_name"] == "Costco Wholesale Corporation"
    assert data["industry"] == "Retail"
    assert data["headquarters_country"] == "US"
    assert "source_url" in data
    assert "freshness" in data


@pytest.mark.asyncio
async def test_get_tech_stack(client, sample_target, sample_intelligence):
    """Test M02: Technology Stack endpoint."""
    response = await client.get("/api/v1/intel/costco.com/techstack")
    assert response.status_code == 200

    data = response.json()
    assert data["search_provider"] == "Elasticsearch"
    assert data["cms_platform"] == "Adobe Experience Manager"
    assert data["total_technologies"] == 45
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_traffic_analysis(client, sample_target, sample_intelligence):
    """Test M03: Traffic Analysis endpoint."""
    response = await client.get("/api/v1/intel/costco.com/traffic")
    assert response.status_code == 200

    data = response.json()
    assert data["monthly_visits"] == 50000000
    assert data["bounce_rate"] == 0.35
    assert data["global_rank"] == 500
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_financial_profile(client, sample_target, sample_intelligence):
    """Test M04: Financial Profile endpoint."""
    response = await client.get("/api/v1/intel/costco.com/financials")
    assert response.status_code == 200

    data = response.json()
    assert data["ticker"] == "COST"
    assert data["is_public"] is True
    assert data["revenue"] == 240000000000
    assert data["market_cap"] == 257000000000
    assert "source_url" in data


# =============================================================================
# Wave 2 Module Tests (Competitive)
# =============================================================================

@pytest.mark.asyncio
async def test_get_competitor_intelligence(client, sample_target, sample_intelligence):
    """Test M05: Competitor Intelligence endpoint."""
    response = await client.get("/api/v1/intel/costco.com/competitors")
    assert response.status_code == 200

    data = response.json()
    assert data["competitor_count"] == 5
    assert "competitors" in data
    assert data["algolia_competitor_count"] == 0
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_hiring_signals(client, sample_target, sample_intelligence):
    """Test M06: Hiring Signals endpoint."""
    response = await client.get("/api/v1/intel/costco.com/hiring")
    assert response.status_code == 200

    data = response.json()
    assert data["total_job_openings"] == 250
    assert data["tech_job_openings"] == 35
    assert data["hiring_trend"] == "growing"
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_strategic_context(client, sample_target, sample_intelligence):
    """Test M07: Strategic Context endpoint."""
    response = await client.get("/api/v1/intel/costco.com/strategic")
    assert response.status_code == 200

    data = response.json()
    assert "key_initiatives" in data
    assert data["market_position"] == "Market leader in warehouse clubs"
    assert "source_url" in data


# =============================================================================
# Wave 3 Module Tests (Buying Signals)
# =============================================================================

@pytest.mark.asyncio
async def test_get_investor_intelligence(client, sample_target, sample_intelligence):
    """Test M08: Investor Intelligence endpoint."""
    response = await client.get("/api/v1/intel/costco.com/investor")
    assert response.status_code == 200

    data = response.json()
    assert "earnings_highlights" in data
    assert "sec_filings" in data
    assert data["price_target"] == 650.00
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_executive_intelligence(client, sample_target, sample_intelligence):
    """Test M09: Executive Intelligence endpoint."""
    response = await client.get("/api/v1/intel/costco.com/executives")
    assert response.status_code == 200

    data = response.json()
    assert "executives" in data
    assert "exec_quotes" in data
    assert "key_themes" in data
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_buying_committee(client, sample_target, sample_intelligence):
    """Test M10: Buying Committee endpoint."""
    response = await client.get("/api/v1/intel/costco.com/buying-committee")
    assert response.status_code == 200

    data = response.json()
    assert "decision_makers" in data
    assert "influencers" in data
    assert data["buying_stage"] == "Awareness"
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_displacement_analysis(client, sample_target, sample_intelligence):
    """Test M11: Displacement Analysis endpoint."""
    response = await client.get("/api/v1/intel/costco.com/displacement")
    assert response.status_code == 200

    data = response.json()
    assert data["current_search_provider"] == "Elasticsearch"
    assert "pain_points" in data
    assert "trigger_events" in data
    assert "source_url" in data


# =============================================================================
# Wave 4 Module Tests (Synthesis)
# =============================================================================

@pytest.mark.asyncio
async def test_get_case_study_matches(client, sample_target, sample_intelligence):
    """Test M12: Case Study Matches endpoint."""
    response = await client.get("/api/v1/intel/costco.com/case-studies")
    assert response.status_code == 200

    data = response.json()
    assert data["match_count"] == 3
    assert data["top_match_score"] == 0.85
    assert "matched_case_studies" in data
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_icp_priority(client, sample_target, sample_intelligence):
    """Test M13: ICP Priority endpoint."""
    response = await client.get("/api/v1/intel/costco.com/icp")
    assert response.status_code == 200

    data = response.json()
    assert data["icp_score"] == 85
    assert data["icp_tier"] == "hot"
    assert "score_breakdown" in data
    assert "recommended_actions" in data
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_signal_scoring(client, sample_target, sample_intelligence):
    """Test M14: Signal Scoring endpoint."""
    response = await client.get("/api/v1/intel/costco.com/signals")
    assert response.status_code == 200

    data = response.json()
    assert data["overall_signal_score"] == 78
    assert data["buying_intent_score"] == 72
    assert "signal_breakdown" in data
    assert "top_signals" in data
    assert "source_url" in data


@pytest.mark.asyncio
async def test_get_strategic_brief(client, sample_target, sample_intelligence):
    """Test M15: Strategic Brief endpoint."""
    response = await client.get("/api/v1/intel/costco.com/brief")
    assert response.status_code == 200

    data = response.json()
    assert "executive_summary" in data
    assert "key_talking_points" in data
    assert "objection_handling" in data
    assert "next_steps" in data
    assert "source_url" in data


# =============================================================================
# Full Intelligence Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_full_intelligence(client, sample_target, sample_intelligence):
    """Test getting full intelligence for a domain."""
    response = await client.get("/api/v1/intel/costco.com/full")
    assert response.status_code == 200

    data = response.json()
    assert data["domain"] == "costco.com"
    assert "overview" in data

    # Check all waves are present
    assert "wave_1" in data or "company_context" in data
    assert "wave_2" in data or "competitors" in data
    assert "wave_3" in data or "investor" in data
    assert "wave_4" in data or "case_studies" in data


@pytest.mark.asyncio
async def test_get_full_intelligence_not_found(client):
    """Test 404 for non-existent domain."""
    response = await client.get("/api/v1/intel/nonexistent.com/full")
    assert response.status_code == 404


# =============================================================================
# Module Not Found Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_module_not_enriched(client, sample_target):
    """Test getting module that hasn't been enriched."""
    # sample_target exists but no intelligence data
    response = await client.get("/api/v1/intel/costco.com/company")
    # Should return 404 or empty response
    assert response.status_code in (200, 404)


# =============================================================================
# Freshness Tests
# =============================================================================

@pytest.mark.asyncio
async def test_module_freshness_fresh(client, sample_target, sample_intelligence):
    """Test that recently enriched module shows as fresh."""
    response = await client.get("/api/v1/intel/costco.com/company")
    assert response.status_code == 200

    data = response.json()
    assert data["freshness"] == "fresh"


@pytest.mark.asyncio
async def test_module_freshness_calculation(client, sample_target, sample_intelligence):
    """Test module freshness is included in overview."""
    response = await client.get("/api/v1/intel/costco.com")
    assert response.status_code == 200

    data = response.json()
    for module_id, module_info in data["modules"].items():
        if module_info["status"] == "available":
            assert "freshness" in module_info
            assert module_info["freshness"] in ["fresh", "stale", "expired"]


# =============================================================================
# Source Citation Tests
# =============================================================================

@pytest.mark.asyncio
async def test_source_citation_present(client, sample_target, sample_intelligence):
    """Test that source citations are present in responses."""
    response = await client.get("/api/v1/intel/costco.com/company")
    assert response.status_code == 200

    data = response.json()
    assert "source_url" in data
    assert data["source_url"] is not None
    assert data["source_url"].startswith("http")


@pytest.mark.asyncio
async def test_source_date_present(client, sample_target, sample_intelligence):
    """Test that source dates are present in responses."""
    response = await client.get("/api/v1/intel/costco.com/company")
    assert response.status_code == 200

    data = response.json()
    assert "source_date" in data or "last_updated" in data


# =============================================================================
# Response Format Tests
# =============================================================================

@pytest.mark.asyncio
async def test_response_format_company_context(client, sample_target, sample_intelligence):
    """Test response format for company context."""
    response = await client.get("/api/v1/intel/costco.com/company")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "company_name", "industry", "headquarters_country",
        "source_url", "freshness"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_response_format_traffic(client, sample_target, sample_intelligence):
    """Test response format for traffic analysis."""
    response = await client.get("/api/v1/intel/costco.com/traffic")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "monthly_visits", "bounce_rate", "global_rank",
        "source_url", "freshness"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_response_format_icp(client, sample_target, sample_intelligence):
    """Test response format for ICP priority."""
    response = await client.get("/api/v1/intel/costco.com/icp")
    assert response.status_code == 200

    data = response.json()
    required_fields = [
        "icp_score", "icp_tier", "score_breakdown",
        "score_reasons", "source_url", "freshness"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


# =============================================================================
# Edge Cases
# =============================================================================

@pytest.mark.asyncio
async def test_domain_case_insensitive(client, sample_target, sample_intelligence):
    """Test that domain lookup is case insensitive."""
    response = await client.get("/api/v1/intel/COSTCO.COM")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_domain_with_trailing_slash(client, sample_target, sample_intelligence):
    """Test domain with trailing slash."""
    response = await client.get("/api/v1/intel/costco.com/")
    # Should either normalize or return valid response
    assert response.status_code in (200, 307)


@pytest.mark.asyncio
async def test_domain_with_subdomain(client, sample_target, sample_intelligence):
    """Test domain with www prefix."""
    response = await client.get("/api/v1/intel/www.costco.com")
    # Should normalize to costco.com
    assert response.status_code == 200
