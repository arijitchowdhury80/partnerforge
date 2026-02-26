"""
PartnerForge API Package

FastAPI routers and dependencies for the REST API.

Modules:
- routes/: API route handlers
- schemas/: Pydantic request/response models
- deps.py: Dependency injection utilities
"""

from .deps import get_db, get_current_user
from .routes import health, lists

__all__ = [
    "get_db",
    "get_current_user",
    "health",
    "lists",
]
