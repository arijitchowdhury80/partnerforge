"""
Enrichment Models - Financial, Hiring, Strategic, and Committee Data

Tables:
- company_financials: Yahoo Finance data
- executive_quotes: Earnings call quotes with attribution
- hiring_signals: Job posting signals
- strategic_triggers: Trigger events
- buying_committee: Key decision makers
- enrichment_status: Enrichment tracking
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, Index,
    UniqueConstraint
)
from datetime import datetime
from typing import Optional

from ..database import Base


class CompanyFinancials(Base):
    """
    Financial data from Yahoo Finance.

    SOURCE CITATION MANDATE: All data must have:
    - data_source (always "yahoo_finance")
    - last_updated (within freshness rules)
    - confidence level

    Freshness rules:
    - Stock price: 1 day max
    - Quarterly financials: 4 months max
    - Annual financials: 12 months max
    """
    __tablename__ = "company_financials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, unique=True, index=True)
    ticker = Column(String(20))
    company_name = Column(String(255))

    # Revenue (3 years)
    revenue_fy2023 = Column(Float)
    revenue_fy2024 = Column(Float)
    revenue_fy2025 = Column(Float)
    revenue_cagr = Column(Float)

    # Net Income (3 years)
    net_income_fy2023 = Column(Float)
    net_income_fy2024 = Column(Float)
    net_income_fy2025 = Column(Float)

    # EBITDA & Margins
    ebitda_fy2025 = Column(Float)
    ebitda_margin = Column(Float)
    margin_zone = Column(String(20))  # 'green' (>20%), 'yellow' (10-20%), 'red' (<=10%)

    # E-commerce metrics
    ecommerce_revenue = Column(Float)
    ecommerce_percent = Column(Float)
    ecommerce_growth = Column(Float)

    # Stock info
    market_cap = Column(Float)
    stock_price = Column(Float)
    price_change_1y = Column(Float)

    # Analyst data
    analyst_rating = Column(String(50))  # 'strong_buy', 'buy', 'hold', 'sell'
    analyst_target_price = Column(Float)

    # Source citation (REQUIRED)
    data_source = Column(String(100), default="yahoo_finance")
    confidence = Column(String(20), default="high")  # 'high', 'medium', 'low'
    last_updated = Column(DateTime, default=datetime.utcnow)


class ExecutiveQuote(Base):
    """
    Executive quotes from earnings calls and SEC filings.

    SOURCE CITATION MANDATE: Every quote MUST have:
    - speaker_name and speaker_title
    - source_type and source_name
    - source_url (hyperlink)
    - quote_date (within 12 months)
    """
    __tablename__ = "executive_quotes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, index=True)

    # Attribution (REQUIRED)
    speaker_name = Column(String(255), nullable=False)
    speaker_title = Column(String(255))

    # Quote content
    quote = Column(Text, nullable=False)

    # Source citation (REQUIRED)
    source_type = Column(String(100))  # 'earnings_call', '10-K', '10-Q', 'interview', 'investor_day'
    source_name = Column(String(255))  # 'Q4 2025 Earnings Call', 'FY2025 10-K'
    source_url = Column(String(500))
    quote_date = Column(String(50))

    # Algolia mapping
    maps_to_product = Column(String(100))  # 'NeuralSearch', 'Recommend', 'AI Search', etc.
    relevance_score = Column(Integer, default=0)  # 0-100

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("domain", "quote", name="uq_exec_quote"),
        Index("idx_exec_quotes_domain", "domain"),
    )


class HiringSignal(Base):
    """
    Job posting signals.

    Tracks hiring patterns that indicate buying readiness:
    - VP/Director of eCommerce → budget authority
    - Search Engineer → build vs buy decision
    - Digital Transformation roles → initiative underway
    """
    __tablename__ = "hiring_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, index=True)

    # Role details
    role_title = Column(String(255), nullable=False)
    team = Column(String(100))  # 'Engineering', 'Product', 'eCommerce', 'Data'
    seniority = Column(String(50))  # 'VP', 'Director', 'Manager', 'IC'

    # Signal classification
    signal_type = Column(String(50))  # 'hot', 'warm', 'technical', 'caution'
    signal_reason = Column(String(255))  # 'budget_allocated', 'team_building', 'build_vs_buy'
    keywords_found = Column(String(500))  # 'search, algolia, elasticsearch'

    # Source (REQUIRED)
    careers_url = Column(String(500))
    job_url = Column(String(500))
    last_seen = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("domain", "role_title", name="uq_hiring_role"),
        Index("idx_hiring_domain", "domain"),
    )


class StrategicTrigger(Base):
    """
    Strategic trigger events.

    Events that indicate buying opportunity:
    - Platform migrations
    - Leadership changes
    - Competitor pressure
    - Tech removal
    """
    __tablename__ = "strategic_triggers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, index=True)

    # Trigger classification
    trigger_type = Column(String(100), nullable=False)  # 'expansion', 'migration', 'competitor_pressure', 'tech_removal', 'leadership_change'
    trigger_category = Column(String(50))  # 'positive', 'negative', 'neutral'

    # Content
    title = Column(String(500), nullable=False)
    description = Column(Text)
    algolia_angle = Column(Text)  # How this connects to Algolia value

    # Source (REQUIRED)
    source_url = Column(String(500))
    source_date = Column(String(50))

    # Priority
    priority = Column(Integer, default=0)  # 1-5, higher = more urgent

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("domain", "title", name="uq_trigger_title"),
        Index("idx_triggers_domain", "domain"),
    )


class BuyingCommittee(Base):
    """
    Buying committee members.

    Key decision makers and influencers for the deal.
    """
    __tablename__ = "buying_committee"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, index=True)

    # Contact info
    name = Column(String(255), nullable=False)
    title = Column(String(255))
    linkedin_url = Column(String(500))
    email = Column(String(255))

    # Classification
    buyer_role = Column(String(50))  # 'economic', 'technical', 'user', 'champion'
    priority = Column(String(50))  # 'hot', 'warm', 'cold'
    priority_reason = Column(String(255))  # 'new_in_role', 'ex_algolia_user', 'search_background'

    # Background
    tenure = Column(String(100))
    previous_company = Column(String(255))
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("domain", "name", name="uq_committee_member"),
        Index("idx_committee_domain", "domain"),
    )


class EnrichmentStatus(Base):
    """
    Enrichment status tracking.

    Tracks which modules have been enriched for each domain.
    """
    __tablename__ = "enrichment_status"

    domain = Column(String(255), primary_key=True, index=True)

    # Module flags
    financials_enriched = Column(Boolean, default=False)
    quotes_enriched = Column(Boolean, default=False)
    hiring_enriched = Column(Boolean, default=False)
    triggers_enriched = Column(Boolean, default=False)
    committee_enriched = Column(Boolean, default=False)

    # Metadata
    last_enriched = Column(DateTime)
    enrichment_errors = Column(Text)  # JSON array of errors
