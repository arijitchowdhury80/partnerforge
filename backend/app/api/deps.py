"""
FastAPI Dependencies

Dependency injection utilities for API endpoints.
"""

from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from ..database import get_session
from ..models import User

logger = logging.getLogger(__name__)


# =============================================================================
# Database Dependencies
# =============================================================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Database session dependency.

    Yields an async SQLAlchemy session that auto-commits on success
    and rolls back on exception.

    Usage:
        @router.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async for session in get_session():
        yield session


# =============================================================================
# Authentication Dependencies
# =============================================================================

# Mock user for development (before real auth is implemented)
MOCK_USER_ID = "mock-user-001"
MOCK_USER_EMAIL = "dev@partnerforge.local"
MOCK_TEAM_ID = "mock-team-001"


class CurrentUser:
    """
    Current authenticated user.

    In production, this will be populated from JWT/OAuth token.
    In development, uses mock data.
    """

    def __init__(
        self,
        user_id: str,
        email: str,
        name: str = "Dev User",
        role: str = "ae",
        team_id: Optional[str] = None,
        is_active: bool = True,
        is_admin: bool = False,
    ):
        self.user_id = user_id
        self.email = email
        self.name = name
        self.role = role
        self.team_id = team_id
        self.is_active = is_active
        self.is_admin = is_admin

    def __repr__(self) -> str:
        return f"CurrentUser(user_id={self.user_id}, email={self.email}, role={self.role})"

    def can_access_team(self, team_id: str) -> bool:
        """Check if user can access a team's data."""
        if self.is_admin:
            return True
        return self.team_id == team_id

    def can_manage_team(self, team_id: str) -> bool:
        """Check if user can manage a team."""
        if self.is_admin:
            return True
        return self.team_id == team_id and self.role in ("admin", "manager")


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """
    Get current authenticated user.

    In production:
    - Validates JWT token from Authorization header
    - Loads user from database
    - Raises 401 if not authenticated

    In development (when no auth header):
    - Returns mock user for testing

    Headers:
    - Authorization: Bearer <token> (production)
    - X-User-ID: <user_id> (development override)
    """
    # Development mode: use mock user or override
    if authorization is None:
        # Allow override via X-User-ID header in development
        if x_user_id:
            logger.debug(f"Using X-User-ID override: {x_user_id}")
            return CurrentUser(
                user_id=x_user_id,
                email=f"{x_user_id}@partnerforge.local",
                name="Override User",
                team_id=MOCK_TEAM_ID,
            )

        # Default mock user
        logger.debug("No authorization header, using mock user")
        return CurrentUser(
            user_id=MOCK_USER_ID,
            email=MOCK_USER_EMAIL,
            name="Dev User",
            team_id=MOCK_TEAM_ID,
            is_admin=True,  # Admin in dev mode
        )

    # Production mode: validate token
    # TODO: Implement real JWT validation
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Use: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]  # Remove "Bearer " prefix

    # TODO: Validate JWT token and extract user info
    # For now, just return mock user
    logger.warning("JWT validation not implemented, using mock user")
    return CurrentUser(
        user_id=MOCK_USER_ID,
        email=MOCK_USER_EMAIL,
        name="Dev User",
        team_id=MOCK_TEAM_ID,
    )


async def get_current_active_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """
    Get current user, ensuring they are active.

    Raises 403 if user is deactivated.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    return current_user


async def get_admin_user(
    current_user: CurrentUser = Depends(get_current_active_user),
) -> CurrentUser:
    """
    Get current user, ensuring they have admin privileges.

    Raises 403 if user is not admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


# =============================================================================
# Optional Dependencies
# =============================================================================

async def get_optional_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> Optional[CurrentUser]:
    """
    Get current user if authenticated, None otherwise.

    Useful for endpoints that work differently for auth vs anon users.
    """
    if authorization is None:
        return None

    try:
        return await get_current_user(authorization=authorization, db=db)
    except HTTPException:
        return None


# =============================================================================
# Rate Limiting Dependencies
# =============================================================================

class RateLimitInfo:
    """Rate limit information for the current request."""

    def __init__(
        self,
        limit: int,
        remaining: int,
        reset_at: int,
    ):
        self.limit = limit
        self.remaining = remaining
        self.reset_at = reset_at


async def check_rate_limit(
    current_user: CurrentUser = Depends(get_current_user),
) -> RateLimitInfo:
    """
    Check rate limit for current user.

    TODO: Implement actual rate limiting with Redis.
    """
    # Mock rate limit for now
    return RateLimitInfo(
        limit=100,
        remaining=99,
        reset_at=0,
    )


# =============================================================================
# Pagination Dependencies
# =============================================================================

class PaginationParams:
    """Pagination parameters from query string."""

    def __init__(
        self,
        page: int = 1,
        limit: int = 50,
    ):
        self.page = max(1, page)
        self.limit = min(100, max(1, limit))
        self.offset = (self.page - 1) * self.limit


def get_pagination(
    page: int = 1,
    limit: int = 50,
) -> PaginationParams:
    """
    Get pagination parameters from query string.

    Usage:
        @router.get("/items")
        async def get_items(pagination: PaginationParams = Depends(get_pagination)):
            offset = pagination.offset
            limit = pagination.limit
    """
    return PaginationParams(page=page, limit=limit)
