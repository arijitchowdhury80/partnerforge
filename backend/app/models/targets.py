"""
Target Models - Displacement Targets and Competitive Intelligence

Tables:
- displacement_targets: Companies using partner tech NOT using Algolia
- competitive_intel: SimilarWeb competitor analysis
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, Index
)
from datetime import datetime
from typing import Optional

from ..database import Base


class DisplacementTarget(Base):
    """
    Displacement target companies.

    Core formula: Companies Using Partner Tech − Existing Algolia Customers

    These are NON-Algolia companies using partner technologies (Adobe AEM, Shopify, etc.)
    that represent displacement opportunities.
    """
    __tablename__ = "displacement_targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), unique=True, index=True)
    company_name = Column(String(255))
    partner_tech = Column(String(255))  # Adobe AEM, Shopify, etc.
    vertical = Column(String(100), index=True)
    country = Column(String(100))
    city = Column(String(100))
    state = Column(String(100))
    tech_spend = Column(Integer)
    emails = Column(Text)  # JSON array
    phones = Column(Text)  # JSON array
    socials = Column(Text)  # JSON array
    exec_titles = Column(Text)  # JSON array

    # SimilarWeb data
    sw_monthly_visits = Column(Integer)
    sw_bounce_rate = Column(Float)
    sw_pages_per_visit = Column(Float)
    sw_avg_duration = Column(Integer)
    sw_search_traffic_pct = Column(Float)
    sw_rank_global = Column(Integer)

    # Case study matching
    matched_case_studies = Column(Text)  # JSON array
    lead_score = Column(Integer)

    # ICP Scoring
    icp_tier = Column(Integer)
    icp_score = Column(Integer, index=True)
    icp_tier_name = Column(String(50))  # hot, warm, cool, cold
    score_reasons = Column(Text)  # JSON array
    score_breakdown = Column(Text)  # JSON object

    # Financial data
    ticker = Column(String(20))
    is_public = Column(Boolean, default=False)
    revenue = Column(Float)
    gross_margin = Column(Float)
    traffic_growth = Column(Float)

    # Current search provider
    current_search = Column(String(255))

    # Intelligence fields
    trigger_events = Column(Text)  # JSON array
    exec_quote = Column(Text)
    exec_name = Column(String(255))
    exec_title = Column(String(255))
    quote_source = Column(String(500))  # Source URL for citation
    competitors_using_algolia = Column(Text)  # JSON array
    displacement_angle = Column(Text)

    # Enrichment JSON blobs
    financials_json = Column(Text)  # Full financial data
    hiring_signals = Column(Text)  # Job posting signals
    tech_stack_json = Column(Text)  # Full tech stack

    # Enrichment metadata
    enrichment_level = Column(String(50), default="basic")  # basic, standard, full
    last_enriched = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Indexes for common queries
    __table_args__ = (
        Index("idx_targets_icp_score", "icp_score"),
        Index("idx_targets_vertical", "vertical"),
        Index("idx_targets_partner", "partner_tech"),
        Index("idx_targets_public", "is_public"),
    )

    @property
    def status(self) -> str:
        """Get lead status based on ICP score."""
        if self.icp_score is None:
            return "unscored"
        if self.icp_score >= 80:
            return "hot"
        if self.icp_score >= 60:
            return "warm"
        if self.icp_score >= 40:
            return "cool"
        return "cold"


class CompetitiveIntel(Base):
    """
    Competitive intelligence from SimilarWeb.

    Tracks competitor relationships and their search providers.
    Used to identify Algolia displacement opportunities.
    """
    __tablename__ = "competitive_intel"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_domain = Column(String(255), nullable=False, index=True)
    competitor_domain = Column(String(255), nullable=False)
    similarity_score = Column(Float)
    search_provider = Column(String(255))  # Algolia, Elasticsearch, Coveo, etc.
    has_algolia = Column(Boolean)
    partner_techs = Column(Text)  # JSON array
    is_displacement_target = Column(Boolean)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_comp_intel_target", "target_domain"),
        Index("idx_comp_intel_competitor", "competitor_domain"),
        # Unique constraint on target-competitor pair
        {"sqlite_autoincrement": True},
    )
