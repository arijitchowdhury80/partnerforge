"""
Evidence Models - Case Studies, Quotes, and Proof Points

Tables:
- case_studies: Algolia customer success stories
- customer_quotes: Attributed customer quotes
- proof_points: Result metrics and stats
- verified_case_studies: Verified case study URLs
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional

from ..database import Base


class CaseStudy(Base):
    """
    Algolia case studies for matching to targets.

    Contains customer success stories with metrics, used to:
    - Match relevant stories to displacement targets
    - Provide proof points for sales conversations
    """
    __tablename__ = "case_studies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_name = Column(String(255), nullable=False)
    customer_domain = Column(String(255))
    company_id = Column(Integer, ForeignKey("companies.id"))

    # Classification
    country = Column(String(100))
    region = Column(String(100))
    vertical = Column(String(100), index=True)
    sub_vertical = Column(String(100))
    use_case = Column(String(255))
    customer_type = Column(String(100))

    # URLs
    story_url = Column(String(500))
    slide_deck_url = Column(String(500))
    pdf_url = Column(String(500))
    status = Column(String(50), default="Complete")

    # Content
    features_used = Column(Text)  # JSON array
    partner_integrations = Column(Text)  # JSON array
    competitor_takeout = Column(String(255))
    key_results = Column(Text)

    # Localization
    localized_urls = Column(Text)  # JSON object

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="case_studies")

    __table_args__ = (
        Index("idx_case_studies_vertical", "vertical"),
    )


class CustomerQuote(Base):
    """
    Customer quotes with attribution.

    SOURCE CITATION MANDATE: Every quote MUST have:
    - contact_name and contact_title
    - source (URL or document reference)
    - source_date (within 12 months)
    """
    __tablename__ = "customer_quotes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_name = Column(String(255))
    customer_domain = Column(String(255))
    company_id = Column(Integer, ForeignKey("companies.id"))

    # Attribution (REQUIRED for Source Citation Mandate)
    contact_name = Column(String(255))
    contact_title = Column(String(255))
    vertical = Column(String(100), index=True)
    country = Column(String(100))

    # Quote content
    quote_text = Column(Text, nullable=False)
    evidence_type = Column(String(100))  # testimonial, review, interview, etc.

    # Source citation (REQUIRED)
    source = Column(String(500))  # URL or document reference
    source_date = Column(String(50))  # Date of quote

    # Metadata
    tags = Column(Text)  # JSON array
    is_approved = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="quotes")

    __table_args__ = (
        Index("idx_quotes_vertical", "vertical"),
    )


class ProofPoint(Base):
    """
    Result metrics and proof points.

    Statistical evidence of Algolia impact, used for:
    - Supporting sales conversations
    - Deck content
    - ROI calculations
    """
    __tablename__ = "proof_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vertical = Column(String(100))
    theme = Column(String(255))
    customer_name = Column(String(255))

    result_text = Column(Text, nullable=False)
    source = Column(String(500))  # Source URL for citation
    is_shareable = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class VerifiedCaseStudy(Base):
    """
    Verified case study URLs.

    Tracks case studies that have been verified to still be live.
    """
    __tablename__ = "verified_case_studies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(255), nullable=False, unique=True)
    vertical = Column(String(100))
    url = Column(String(500), nullable=False)
    headline = Column(String(500))
    result_metric = Column(String(255))
    is_verified = Column(Boolean, default=False)
    last_verified = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
