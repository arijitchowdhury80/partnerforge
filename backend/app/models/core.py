"""
Core Models - Algolia Customers and Technologies

Tables:
- companies: Existing Algolia customers
- technologies: Technology catalog
- company_technologies: M2M relationship
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey,
    UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional, List

from ..database import Base


class Company(Base):
    """
    Algolia customer companies.

    These are EXISTING customers, used for:
    - Exclusion from displacement targets
    - Case study matching
    - Logo/consent tracking
    """
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), unique=True, index=True)
    name = Column(String(255))
    vertical = Column(String(100), index=True)
    sub_vertical = Column(String(100))
    country = Column(String(100))
    country_code = Column(String(10))

    # Algolia status
    is_algolia_customer = Column(Boolean, default=True)
    algolia_arr = Column(Float)
    algolia_products = Column(Text)  # JSON array
    algolia_cs_coverage = Column(String(100))

    # Consent tracking
    has_logo_rights = Column(Boolean, default=False)
    has_case_study_consent = Column(Boolean, default=False)
    has_reference_consent = Column(Boolean, default=False)

    # Partner info
    partner_populations = Column(Text)  # JSON array

    # Metadata
    signed_date = Column(String(50))
    competitor_displaced = Column(String(255))
    tech_platform = Column(String(255))
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    technologies = relationship(
        "CompanyTechnology",
        back_populates="company",
        cascade="all, delete-orphan"
    )
    customer_logos = relationship(
        "CustomerLogo",
        back_populates="company",
        cascade="all, delete-orphan"
    )
    case_studies = relationship(
        "CaseStudy",
        back_populates="company",
        cascade="all, delete-orphan"
    )
    quotes = relationship(
        "CustomerQuote",
        back_populates="company",
        cascade="all, delete-orphan"
    )


class Technology(Base):
    """
    Technology catalog for detection and classification.

    Used to categorize technologies as:
    - Partner (Adobe, Shopify) → opportunity
    - Competitor (Elasticsearch, Coveo) → displacement
    """
    __tablename__ = "technologies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False)
    category = Column(String(100))
    is_partner = Column(Boolean, default=False)
    is_competitor = Column(Boolean, default=False)
    builtwith_name = Column(String(255))  # Name as returned by BuiltWith API

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    company_technologies = relationship(
        "CompanyTechnology",
        back_populates="technology",
        cascade="all, delete-orphan"
    )


class CompanyTechnology(Base):
    """
    Many-to-many relationship between companies and technologies.

    Tracks which technologies each company uses, with source attribution.
    """
    __tablename__ = "company_technologies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    technology_id = Column(Integer, ForeignKey("technologies.id"), nullable=False)
    source = Column(String(100))  # e.g., "builtwith", "manual"
    is_live = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="technologies")
    technology = relationship("Technology", back_populates="company_technologies")

    __table_args__ = (
        UniqueConstraint("company_id", "technology_id", "source", name="uq_company_tech_source"),
    )


class CustomerLogo(Base):
    """
    Customer logo and consent tracking.

    Tracks permissions for using customer logos in marketing.
    """
    __tablename__ = "customer_logos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(255), nullable=False)
    company_domain = Column(String(255))
    company_id = Column(Integer, ForeignKey("companies.id"))

    signed_date = Column(String(50))
    vertical = Column(String(100))

    # Consent flags
    has_case_study_in_contract = Column(Boolean, default=False)
    has_logo_rights = Column(Boolean, default=False)
    social_completed = Column(Boolean, default=False)
    is_reference = Column(Boolean, default=False)
    has_press_release = Column(Boolean, default=False)

    # Additional info
    partner = Column(String(255))
    tech_platform = Column(String(255))
    competitor_displaced = Column(String(255))
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="customer_logos")
