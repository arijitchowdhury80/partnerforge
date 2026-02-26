"""
PartnerForge API Routes

FastAPI router modules for different API endpoints.
"""

from . import health
from . import lists
from . import targets

__all__ = ["health", "lists", "targets"]
