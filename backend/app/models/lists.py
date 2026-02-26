"""
Uploaded List Models - CSV Import and Processing

Tables:
- uploaded_lists: Metadata for uploaded CSV files
- uploaded_list_items: Individual rows from uploaded CSVs
- list_processing_queue: Queue for enrichment jobs
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, JSON,
    ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from ..database import Base


class UploadedList(Base):
    """
    Metadata for an uploaded CSV file.

    Tracks the upload, parsing, validation, and enrichment progress
    of a list of target accounts.
    """
    __tablename__ = "uploaded_lists"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Who uploaded
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    team_id = Column(String(36), ForeignKey("teams.id"))

    # List metadata
    name = Column(String(255), nullable=False)
    description = Column(Text)
    source = Column(String(100), default="manual")
    # Options: "salesforce", "demandbase", "6sense", "hubspot", "manual", "excel"

    # File info
    original_filename = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer)
    file_path = Column(String(500))  # Local path or S3 URI
    file_hash = Column(String(64))  # SHA-256 for deduplication

    # Parsing results
    total_rows = Column(Integer, default=0)
    valid_rows = Column(Integer, default=0)
    invalid_rows = Column(Integer, default=0)
    duplicate_rows = Column(Integer, default=0)
    skipped_rows = Column(Integer, default=0)  # Already in system

    # Column mapping (user-confirmed or auto-detected)
    detected_columns = Column(JSON)  # List of column headers
    column_mapping = Column(JSON)
    # Schema: {"domain": "Domain", "company_name": "Account Name", ...}
    mapping_confidence = Column(String(20))  # "high", "medium", "low"
    mapping_confirmed = Column(Boolean, default=False)

    # Processing status
    status = Column(String(50), default="uploaded")
    # uploaded, parsing, parsed, validating, validated,
    # queued, processing, completed, failed, cancelled

    # Progress tracking
    processed_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)

    # Enrichment configuration
    enrichment_job_id = Column(String(36))
    enrichment_modules = Column(JSON)  # List of modules to run
    enrichment_priority = Column(String(20), default="normal")

    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    parsing_started_at = Column(DateTime)
    parsing_completed_at = Column(DateTime)
    validation_started_at = Column(DateTime)
    validation_completed_at = Column(DateTime)
    enrichment_started_at = Column(DateTime)
    enrichment_completed_at = Column(DateTime)

    # Error handling
    error_message = Column(Text)
    error_details = Column(JSON)

    # Relationships
    user = relationship("User", back_populates="uploaded_lists")
    team = relationship("Team")
    items = relationship("UploadedListItem", back_populates="list", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_lists_user", "user_id"),
        Index("idx_lists_team", "team_id"),
        Index("idx_lists_status", "status"),
        Index("idx_lists_created", "created_at"),
        Index("idx_lists_source", "source"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "name": self.name,
            "source": self.source,
            "status": self.status,
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "invalid_rows": self.invalid_rows,
            "processed_count": self.processed_count,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "column_mapping": self.column_mapping,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UploadedListItem(Base):
    """
    Individual row from an uploaded CSV.

    Stores parsed data and tracks enrichment status for each account.
    """
    __tablename__ = "uploaded_list_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    list_id = Column(String(36), ForeignKey("uploaded_lists.id", ondelete="CASCADE"), nullable=False)

    # Row reference
    row_number = Column(Integer, nullable=False)

    # Core data (parsed from CSV)
    domain = Column(String(255), nullable=False, index=True)
    company_name = Column(String(255))

    # External IDs (for CRM sync)
    salesforce_id = Column(String(50))
    demandbase_id = Column(String(50))
    hubspot_id = Column(String(50))

    # All original CSV columns (preserved)
    csv_data = Column(JSON)

    # Pre-existing data extracted from CSV
    pre_existing_revenue = Column(JSON)  # {"value": 1000000, "source": "csv"}
    pre_existing_traffic = Column(JSON)
    pre_existing_tech_stack = Column(JSON)
    pre_existing_industry = Column(JSON)

    # Processing status
    status = Column(String(50), default="pending")
    # pending, validating, valid, invalid, duplicate,
    # queued, enriching, enriched, failed, skipped

    # Validation
    validation_errors = Column(JSON)
    # [{"field": "domain", "error": "Invalid format"}, ...]
    validated_at = Column(DateTime)

    # Enrichment
    enrichment_job_id = Column(String(36))
    enrichment_started_at = Column(DateTime)
    enrichment_completed_at = Column(DateTime)

    # Results reference (links to intel tables)
    displacement_target_id = Column(Integer, ForeignKey("displacement_targets.id"))
    existing_target_id = Column(Integer)  # If domain already existed

    # Error handling
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    last_error_at = Column(DateTime)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    list = relationship("UploadedList", back_populates="items")
    displacement_target = relationship("DisplacementTarget")

    __table_args__ = (
        UniqueConstraint("list_id", "row_number", name="uq_item_row"),
        Index("idx_items_list", "list_id"),
        Index("idx_items_domain", "domain"),
        Index("idx_items_status", "status"),
        Index("idx_items_salesforce", "salesforce_id"),
    )


class ListProcessingQueue(Base):
    """
    Queue for enrichment jobs.

    Tracks which items need processing and their priority.
    Can be replaced by Redis for production.
    """
    __tablename__ = "list_processing_queue"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    list_id = Column(String(36), ForeignKey("uploaded_lists.id"))
    item_id = Column(String(36), ForeignKey("uploaded_list_items.id"))

    # Priority (1=highest, 10=lowest)
    priority = Column(Integer, default=5)

    # Status
    status = Column(String(50), default="queued")
    # queued, claimed, processing, completed, failed, cancelled

    # Worker assignment
    worker_id = Column(String(100))  # Which worker claimed this
    claimed_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Retry handling
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    next_retry_at = Column(DateTime)
    last_error = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_queue_status_priority", "status", "priority"),
        Index("idx_queue_list", "list_id"),
        Index("idx_queue_next_retry", "next_retry_at"),
    )


# Column mapping configuration
COLUMN_MAPPINGS = {
    # Domain (REQUIRED - one of these must match)
    "domain": [
        "domain", "website", "company_website", "url", "web",
        "company_domain", "site", "webpage"
    ],

    # Company name
    "company_name": [
        "account_name", "company", "company_name", "name", "account",
        "organization", "org", "business_name"
    ],

    # External IDs
    "salesforce_id": [
        "account_id", "18_digit_account_id", "sf_id", "salesforce_id",
        "sfdc_id", "id"
    ],
    "demandbase_id": [
        "abm_id", "demandbase_id", "db_id", "demandbase_company_id"
    ],
    "hubspot_id": [
        "hubspot_id", "hs_id", "hubspot_company_id"
    ],

    # Pre-existing data (preserved, not overwritten)
    "revenue": [
        "revenue", "annual_revenue", "arr", "expected_revenue",
        "company_revenue", "yearly_revenue"
    ],
    "traffic": [
        "traffic", "monthly_visits", "visits", "monthly_traffic",
        "web_traffic", "monthly_visitors"
    ],
    "industry": [
        "industry", "vertical", "demandbase_industry", "naics_description",
        "sector", "market", "demandbase_sub_industry"
    ],
    "employee_count": [
        "employees", "employee_count", "company_size", "headcount",
        "num_employees", "staff_count"
    ],

    # Assignment
    "owner": [
        "account_owner", "owner", "sales_rep", "ae",
        "demandbase_account_owner_name", "assigned_to", "rep"
    ],
    "region": [
        "sales_region", "region", "territory", "account_region",
        "geo", "geography"
    ],

    # ABM context
    "journey_stage": [
        "journey_stage", "stage", "abx_status", "buyer_stage",
        "funnel_stage", "sales_stage"
    ],
    "engagement_score": [
        "engagement_points", "engagement_score", "score",
        "intent_score", "abm_score", "engagement_points_3_mo"
    ],
    "target_account": [
        "target_account", "is_target", "named_account", "tier"
    ],

    # Ticker (for public companies)
    "ticker": [
        "ticker_symbol", "ticker", "stock_symbol", "symbol"
    ],
}


def detect_column_mapping(headers: list) -> dict:
    """
    Auto-detect column mappings from CSV headers.

    Args:
        headers: List of column header strings

    Returns:
        Dict mapping standard field names to CSV column names
    """
    mapping = {}
    headers_lower = {h.lower().replace(" ", "_").replace("-", "_"): h for h in headers}

    for field, candidates in COLUMN_MAPPINGS.items():
        for candidate in candidates:
            candidate_normalized = candidate.lower().replace(" ", "_").replace("-", "_")
            if candidate_normalized in headers_lower:
                mapping[field] = headers_lower[candidate_normalized]
                break

    return mapping


def has_required_columns(mapping: dict) -> bool:
    """Check if mapping has required columns (domain)."""
    return "domain" in mapping
