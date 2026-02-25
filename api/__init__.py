"""
PartnerForge API Package

FastAPI backend for the Partner Intelligence Platform.
"""

from .main import app
from .enrichment import (
    get_company_by_domain,
    enrich_company,
    get_all_targets,
)
from .config import (
    DATABASE_PATH,
    BUILTWITH_API_KEY,
    SIMILARWEB_API_KEY,
)

__all__ = [
    "app",
    "get_company_by_domain",
    "enrich_company",
    "get_all_targets",
    "DATABASE_PATH",
    "BUILTWITH_API_KEY",
    "SIMILARWEB_API_KEY",
]
