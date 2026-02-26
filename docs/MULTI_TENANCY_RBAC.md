# PartnerForge Multi-Tenancy & Role-Based Access Control

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Architecture Design
**Priority:** P1 - Required for Enterprise Deployment

---

## 1. User Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                         ORGANIZATION                             │
│                        (Algolia Sales)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                       TEAM                                │   │
│  │                  (West Coast Enterprise)                  │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │   MANAGER   │  │     AE      │  │    SDR      │      │   │
│  │  │  (Team Mgr) │  │  (Account   │  │ (Prospecting│      │   │
│  │  │             │  │   Owner)    │  │   Support)  │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                       TEAM                                │   │
│  │                  (East Coast Mid-Market)                  │   │
│  │                         ...                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model

```sql
-- Organizations (for future multi-tenant SaaS)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Billing
    subscription_tier VARCHAR(50) DEFAULT 'enterprise',
    monthly_api_budget_usd DECIMAL(10,2),

    -- Feature flags
    features_enabled TEXT[] DEFAULT ARRAY['core']
);

-- Teams within organization
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    manager_id UUID,  -- References users(id)

    -- Territory definition
    territory_filters JSONB,  -- {"region": "US-West", "segment": "Enterprise"}

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(org_id, slug)
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,

    -- Role
    role VARCHAR(50) NOT NULL,  -- admin, manager, ae, sdr, viewer

    -- Team membership (can be in multiple teams)
    primary_team_id UUID REFERENCES teams(id),

    -- Auth
    auth_provider VARCHAR(50),  -- google, saml, local
    auth_provider_id VARCHAR(255),

    -- Preferences
    notification_settings JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team membership (many-to-many)
CREATE TABLE team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    role_in_team VARCHAR(50) DEFAULT 'member',  -- manager, member
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, team_id)
);

-- Account assignments
CREATE TABLE account_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,

    -- Assignment
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assignment_type VARCHAR(50) NOT NULL,  -- owner, team_member, viewer

    -- Assignment source
    assigned_by UUID REFERENCES users(id),
    assignment_reason VARCHAR(255),  -- 'territory_match', 'manual', 'crm_sync'

    -- Timestamps
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- For temporary access

    UNIQUE(domain, user_id)
);

CREATE INDEX idx_assignments_user ON account_assignments(user_id);
CREATE INDEX idx_assignments_domain ON account_assignments(domain);
```

---

## 3. Role Definitions

```python
# rbac/roles.py

from enum import Enum
from dataclasses import dataclass

class Role(Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    AE = "ae"
    SDR = "sdr"
    VIEWER = "viewer"

@dataclass
class Permission:
    resource: str
    action: str

class Permissions:
    # Account permissions
    ACCOUNT_VIEW = Permission("account", "view")
    ACCOUNT_ENRICH = Permission("account", "enrich")
    ACCOUNT_ASSIGN = Permission("account", "assign")
    ACCOUNT_DELETE = Permission("account", "delete")

    # Intelligence permissions
    INTEL_VIEW_BASIC = Permission("intel", "view_basic")
    INTEL_VIEW_FINANCIAL = Permission("intel", "view_financial")
    INTEL_VIEW_EXECUTIVE = Permission("intel", "view_executive")
    INTEL_EXPORT = Permission("intel", "export")

    # Brief permissions
    BRIEF_GENERATE = Permission("brief", "generate")
    BRIEF_VIEW = Permission("brief", "view")

    # Team permissions
    TEAM_VIEW = Permission("team", "view")
    TEAM_MANAGE = Permission("team", "manage")

    # Settings permissions
    SETTINGS_VIEW = Permission("settings", "view")
    SETTINGS_MANAGE = Permission("settings", "manage")

    # API permissions
    API_USE = Permission("api", "use")
    API_MANAGE_KEYS = Permission("api", "manage_keys")


# Role permission matrix
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.ADMIN: {
        # Full access to everything
        Permissions.ACCOUNT_VIEW,
        Permissions.ACCOUNT_ENRICH,
        Permissions.ACCOUNT_ASSIGN,
        Permissions.ACCOUNT_DELETE,
        Permissions.INTEL_VIEW_BASIC,
        Permissions.INTEL_VIEW_FINANCIAL,
        Permissions.INTEL_VIEW_EXECUTIVE,
        Permissions.INTEL_EXPORT,
        Permissions.BRIEF_GENERATE,
        Permissions.BRIEF_VIEW,
        Permissions.TEAM_VIEW,
        Permissions.TEAM_MANAGE,
        Permissions.SETTINGS_VIEW,
        Permissions.SETTINGS_MANAGE,
        Permissions.API_USE,
        Permissions.API_MANAGE_KEYS,
    },

    Role.MANAGER: {
        # Team management + full intel access
        Permissions.ACCOUNT_VIEW,
        Permissions.ACCOUNT_ENRICH,
        Permissions.ACCOUNT_ASSIGN,  # Can assign within team
        Permissions.INTEL_VIEW_BASIC,
        Permissions.INTEL_VIEW_FINANCIAL,
        Permissions.INTEL_VIEW_EXECUTIVE,
        Permissions.INTEL_EXPORT,
        Permissions.BRIEF_GENERATE,
        Permissions.BRIEF_VIEW,
        Permissions.TEAM_VIEW,
        Permissions.TEAM_MANAGE,  # Own team only
        Permissions.API_USE,
    },

    Role.AE: {
        # Full intel on assigned accounts
        Permissions.ACCOUNT_VIEW,
        Permissions.ACCOUNT_ENRICH,
        Permissions.INTEL_VIEW_BASIC,
        Permissions.INTEL_VIEW_FINANCIAL,
        Permissions.INTEL_VIEW_EXECUTIVE,
        Permissions.INTEL_EXPORT,
        Permissions.BRIEF_GENERATE,
        Permissions.BRIEF_VIEW,
        Permissions.TEAM_VIEW,
        Permissions.API_USE,
    },

    Role.SDR: {
        # Limited intel (no financials, limited executive)
        Permissions.ACCOUNT_VIEW,
        Permissions.ACCOUNT_ENRICH,
        Permissions.INTEL_VIEW_BASIC,
        # Permissions.INTEL_VIEW_FINANCIAL,  # NO
        Permissions.INTEL_VIEW_EXECUTIVE,  # Names only, no LinkedIn
        Permissions.BRIEF_VIEW,
        Permissions.TEAM_VIEW,
    },

    Role.VIEWER: {
        # Read-only access
        Permissions.ACCOUNT_VIEW,
        Permissions.INTEL_VIEW_BASIC,
        Permissions.BRIEF_VIEW,
    },
}
```

---

## 4. Access Control Service

```python
# rbac/service.py

class AccessControlService:
    """
    Central access control service.
    All data access goes through this service.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def can_access_account(
        self,
        user: User,
        domain: str,
        permission: Permission,
    ) -> bool:
        """Check if user can access an account with given permission."""

        # Admin can access everything
        if user.role == Role.ADMIN:
            return True

        # Check role has permission
        if permission not in ROLE_PERMISSIONS.get(user.role, set()):
            return False

        # Check account assignment
        assignment = await self._get_assignment(user.id, domain)

        if assignment:
            return True

        # Check team territory match
        if await self._is_in_team_territory(user, domain):
            return True

        return False

    async def filter_accounts_for_user(
        self,
        user: User,
        accounts: list[str],
    ) -> list[str]:
        """Filter list of accounts to only those user can access."""

        if user.role == Role.ADMIN:
            return accounts

        # Get user's assigned accounts
        assigned = await self._get_user_assigned_accounts(user.id)

        # Get team territory accounts
        territory = await self._get_team_territory_accounts(user)

        accessible = assigned | territory
        return [a for a in accounts if a in accessible]

    async def get_visible_intel_fields(
        self,
        user: User,
    ) -> set[str]:
        """Get which intelligence fields user can see."""

        visible = {"company_context", "technology_stack", "traffic_analysis"}

        if Permissions.INTEL_VIEW_FINANCIAL in ROLE_PERMISSIONS[user.role]:
            visible.add("financial_profile")

        if Permissions.INTEL_VIEW_EXECUTIVE in ROLE_PERMISSIONS[user.role]:
            visible.add("executive_intel")
            visible.add("buying_committee")

        return visible

    async def redact_intel_for_user(
        self,
        user: User,
        intel: dict,
    ) -> dict:
        """Remove fields user shouldn't see."""

        visible_fields = await self.get_visible_intel_fields(user)

        redacted = {}
        for field, value in intel.items():
            if field in visible_fields:
                redacted[field] = value
            else:
                redacted[field] = {"_redacted": True, "reason": "insufficient_permissions"}

        # Additional redaction for SDR role
        if user.role == Role.SDR:
            # Remove LinkedIn URLs from executive data
            if "executive_intel" in redacted and not redacted["executive_intel"].get("_redacted"):
                for exec in redacted["executive_intel"].get("executives", []):
                    exec.pop("linkedin_url", None)
                    exec.pop("email", None)

        return redacted
```

---

## 5. Territory Management

```python
# rbac/territory.py

@dataclass
class TerritoryFilter:
    """Defines which accounts belong to a territory."""
    region: str | None = None           # US-West, EMEA, APAC
    segment: str | None = None          # Enterprise, Mid-Market, SMB
    vertical: str | None = None         # Retail, Finance, Tech
    revenue_min: int | None = None      # Minimum revenue
    revenue_max: int | None = None      # Maximum revenue
    partner_tech: list[str] | None = None  # Adobe, Shopify
    custom_sql: str | None = None       # Advanced filter

class TerritoryService:
    """Manages territory-based account access."""

    async def get_accounts_in_territory(
        self,
        territory_filter: TerritoryFilter,
    ) -> set[str]:
        """Get all accounts matching territory filter."""

        query = select(CoreCompany.domain)

        if territory_filter.region:
            query = query.where(CoreCompany.region == territory_filter.region)

        if territory_filter.segment:
            query = query.where(CoreCompany.segment == territory_filter.segment)

        if territory_filter.vertical:
            query = query.where(CoreCompany.vertical == territory_filter.vertical)

        if territory_filter.revenue_min:
            query = query.where(CoreCompany.revenue >= territory_filter.revenue_min)

        if territory_filter.revenue_max:
            query = query.where(CoreCompany.revenue <= territory_filter.revenue_max)

        if territory_filter.partner_tech:
            query = query.where(
                CoreCompany.partner_technologies.overlap(territory_filter.partner_tech)
            )

        result = await self.db.execute(query)
        return {row.domain for row in result.scalars()}

    async def assign_territory_accounts(
        self,
        team_id: UUID,
        territory_filter: TerritoryFilter,
    ):
        """Bulk assign accounts matching territory to team members."""

        accounts = await self.get_accounts_in_territory(territory_filter)
        team_members = await self._get_team_members(team_id)

        # Round-robin assignment
        for i, domain in enumerate(accounts):
            assignee = team_members[i % len(team_members)]
            await self._assign_account(
                domain=domain,
                user_id=assignee.id,
                assignment_type="team_member",
                reason="territory_match",
            )
```

---

## 6. API Middleware

```python
# middleware/auth.py

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate current user from JWT."""

    token = credentials.credentials
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(401, "Invalid or inactive user")

    return user


def require_permission(permission: Permission):
    """Dependency to require specific permission."""

    async def check_permission(
        user: User = Depends(get_current_user),
    ):
        if permission not in ROLE_PERMISSIONS.get(user.role, set()):
            raise HTTPException(
                403,
                f"Permission denied: {permission.resource}.{permission.action}"
            )
        return user

    return check_permission


def require_account_access(permission: Permission):
    """Dependency to require access to specific account."""

    async def check_access(
        domain: str,
        user: User = Depends(get_current_user),
        access_control: AccessControlService = Depends(get_access_control),
    ):
        if not await access_control.can_access_account(user, domain, permission):
            raise HTTPException(
                403,
                f"You don't have access to account: {domain}"
            )
        return user

    return check_access


# Usage in routes
@router.get("/company/{domain}")
async def get_company(
    domain: str,
    user: User = Depends(require_account_access(Permissions.ACCOUNT_VIEW)),
    access_control: AccessControlService = Depends(get_access_control),
):
    """Get company intelligence (filtered by user's permissions)."""

    intel = await get_company_intel(domain)

    # Redact fields user can't see
    intel = await access_control.redact_intel_for_user(user, intel)

    return intel


@router.post("/company/{domain}/enrich")
async def enrich_company(
    domain: str,
    user: User = Depends(require_account_access(Permissions.ACCOUNT_ENRICH)),
):
    """Enrich company (requires enrich permission)."""
    ...
```

---

## 7. Audit Logging

```python
# audit/logger.py

class AuditLogger:
    """Log all access for compliance and debugging."""

    async def log_access(
        self,
        user: User,
        resource_type: str,
        resource_id: str,
        action: str,
        granted: bool,
        reason: str | None = None,
    ):
        """Log an access attempt."""

        await self.db.execute(
            insert(AuditLog).values(
                user_id=user.id,
                user_email=user.email,
                user_role=user.role.value,
                resource_type=resource_type,
                resource_id=resource_id,
                action=action,
                granted=granted,
                denied_reason=reason if not granted else None,
                ip_address=self._get_ip(),
                user_agent=self._get_user_agent(),
                timestamp=datetime.utcnow(),
            )
        )

    async def get_access_report(
        self,
        domain: str,
        days: int = 30,
    ) -> list[AuditEntry]:
        """Get who accessed an account and when."""

        return await self.db.execute(
            select(AuditLog)
            .where(AuditLog.resource_type == "account")
            .where(AuditLog.resource_id == domain)
            .where(AuditLog.timestamp > datetime.utcnow() - timedelta(days=days))
            .order_by(AuditLog.timestamp.desc())
        )
```

---

## 8. UI Integration

```typescript
// frontend/src/contexts/AuthContext.tsx

interface AuthContextValue {
  user: User | null;
  permissions: Set<string>;
  hasPermission: (permission: string) => boolean;
  canAccessAccount: (domain: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be within AuthProvider");
  return context;
};

// Permission-based component visibility
export const RequirePermission: FC<{
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}> = ({ permission, fallback = null, children }) => {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Usage in components
const CompanyFinancials: FC<{ domain: string }> = ({ domain }) => {
  return (
    <RequirePermission
      permission="intel.view_financial"
      fallback={<LockedModule message="Financial data requires AE access" />}
    >
      <FinancialsChart domain={domain} />
    </RequirePermission>
  );
};
```

---

*Document created: 2026-02-25*
*Author: Thread 2 - Data Pipeline*
*Status: Architecture Design*
*Priority: P1*
