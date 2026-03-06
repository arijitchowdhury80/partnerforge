# Arian Security Remediation Plan

**Created:** 2026-02-26
**Status:** APPROVED WITH CHANGES - Incorporating Architect Feedback
**Total Issues:** 21 (4 Critical, 5 High, 12 Medium)
**Architect Review:** APPROVED WITH CHANGES

---

## Architect Review Summary

**Verdict:** APPROVED WITH CHANGES

**Required Changes Incorporated:**
1. Reordered CRITICAL-4 (RLS) BEFORE CRITICAL-2 (service key removal)
2. Added rollback SQL for all database migrations
3. Added specific key rotation documentation
4. Documented frontend authentication strategy (anon-only with RLS)
5. Changed MEDIUM-2 to backend proxy approach (APIs may not support headers)
6. Added security testing requirements

---

## Frontend Authentication Strategy

**Decision:** Frontend remains **anonymous-only** with Row Level Security (RLS).

**Rationale:**
- Arian is an internal sales tool, not a multi-tenant SaaS
- RLS policies provide data isolation at database level
- Supabase anon key is designed for browser use
- Backend API (when needed) uses separate JWT authentication

**Security Model:**
```
Browser → Supabase (anon key) → RLS policies filter data
Browser → Backend API → JWT auth → Database (service key, server-side only)
```

---

## Key Rotation Documentation

**IMPORTANT: Rotate these keys IMMEDIATELY after credentials are removed from git.**

| Key | Dashboard URL | Steps |
|-----|--------------|-------|
| Supabase anon key | https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/settings/api | Settings → API → Regenerate anon key |
| Supabase service key | https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/settings/api | Settings → API → Regenerate service_role key |
| SimilarWeb API key | https://account.similarweb.com/api-management | API Management → Regenerate |
| BuiltWith API key | https://builtwith.com/api | API → Regenerate Key |
| JSearch (RapidAPI) | https://rapidapi.com/developer/dashboard | Apps → Arian → Regenerate Key |

---

## Phase 1: CRITICAL Issues (4 issues) - Immediate

### CRITICAL-4: Fix Overly Permissive RLS Policies (DO FIRST!)

**Issue:** `USING (true)` allows anonymous access to all data
**File:** `supabase/migrations/20260301_final_cleanup.sql`

**IMPORTANT:** This MUST be done BEFORE CRITICAL-2 to prevent breaking partner fetching.

**Remediation Steps:**

1. **Create new migration** with proper RLS policies:

```sql
-- Migration: 20260226_fix_rls_security.sql

-- ============================================
-- ROLLBACK SECTION (run to undo this migration)
-- ============================================
-- DROP POLICY IF EXISTS "anon_read_public_targets" ON displacement_targets;
-- DROP POLICY IF EXISTS "authenticated_read_all_targets" ON displacement_targets;
-- DROP POLICY IF EXISTS "anon_read_partners" ON partners;
-- DROP POLICY IF EXISTS "anon_read_verticals" ON verticals;
-- CREATE POLICY "anon_select_only" ON displacement_targets FOR SELECT TO anon USING (true);
-- ============================================

-- Fix displacement_targets: require auth for full access, anon for public only
DROP POLICY IF EXISTS "anon_select_only" ON displacement_targets;

-- Anon can only read non-sensitive data (public companies)
CREATE POLICY "anon_read_public_targets" ON displacement_targets
  FOR SELECT TO anon
  USING (is_public IS NOT FALSE);  -- Default to public if column is null

-- Authenticated users can read all
CREATE POLICY "authenticated_read_all_targets" ON displacement_targets
  FOR SELECT TO authenticated USING (true);

-- Partners table: allow anon read (required for partner selector)
DROP POLICY IF EXISTS "anon_select_partners" ON partners;
CREATE POLICY "anon_read_partners" ON partners
  FOR SELECT TO anon USING (true);

-- Verticals table: allow anon read
DROP POLICY IF EXISTS "anon_select_verticals" ON verticals;
CREATE POLICY "anon_read_verticals" ON verticals
  FOR SELECT TO anon USING (true);

-- Data feedback: anon can insert, authenticated can read
DROP POLICY IF EXISTS "anon_insert_feedback" ON data_feedback;
CREATE POLICY "anon_insert_feedback" ON data_feedback
  FOR INSERT TO anon WITH CHECK (status = 'pending');

CREATE POLICY "authenticated_read_feedback" ON data_feedback
  FOR SELECT TO authenticated USING (true);
```

**Files to Create:**
- `supabase/migrations/20260226_fix_rls_security.sql`

---

### CRITICAL-1: Remove Exposed Credentials from Source Control

**Issue:** API keys committed to `.env` files in git repository
**Files Affected:**
- `/.env`
- `/frontend/.env`
- `/frontend/.env.production`

**Remediation Steps:**

1. **Create `.env.example` files (safe templates)** with placeholder values

2. **Update `.gitignore`** to ensure all env files are excluded:
   ```gitignore
   # Environment files - NEVER commit secrets
   .env
   .env.local
   .env.*.local
   .env.production
   .env.staging
   .env.development
   !.env.example
   ```

3. **Remove .env files from git tracking:**
   ```bash
   git rm --cached .env frontend/.env frontend/.env.production 2>/dev/null || true
   ```

4. **After this remediation, user must manually:**
   - Rotate all keys (see Key Rotation Documentation above)
   - Remove from git history: `git filter-repo --path .env --path frontend/.env --invert-paths`

**Files to Create/Modify:**
- `/.env.example` (new)
- `/frontend/.env.example` (new)
- `/.gitignore` (modify)
- `/frontend/.gitignore` (modify)

---

### CRITICAL-2: Remove Service Role Key from Frontend

**Issue:** `VITE_SUPABASE_SERVICE_KEY` exposed in browser code
**File:** `frontend/src/services/supabase.ts`

**PREREQUISITE:** CRITICAL-4 must be complete (RLS policies allow anon to read partners)

**Remediation Steps:**

1. **Remove service key import and usage** from supabase.ts:
   - Delete `const SUPABASE_SERVICE_KEY = ...`
   - Delete entire `supabaseServiceRequest()` function
   - Update `getPartners()` and `getPartnerProducts()` to use `supabaseRequest()` instead

2. **Verify anon access works** after RLS changes

**Files to Modify:**
- `frontend/src/services/supabase.ts`

---

### CRITICAL-3: Implement Proper Authentication (Backend Only)

**Issue:** Backend accepts any X-User-ID header, mock auth always enabled
**File:** `backend/app/api/deps.py`

**Remediation Steps:**

1. **Add environment-based guard** to disable mock auth:
   ```python
   ALLOW_MOCK_AUTH = os.getenv("ALLOW_MOCK_AUTH", "false").lower() == "true"
   ENV = os.getenv("ENV", "production")
   ```

2. **Remove X-User-ID bypass** in production

3. **Add Supabase JWT validation** using python-jose

4. **Keep mock auth for development ONLY:**
   ```python
   if ENV == "development" and ALLOW_MOCK_AUTH:
       # Allow mock auth
   else:
       # Require valid JWT
   ```

**Files to Modify:**
- `backend/app/api/deps.py`
- `backend/requirements.txt` (add python-jose)

---

## Phase 2: HIGH Issues (5 issues) - This Week

### HIGH-1: Implement Rate Limiting

**Issue:** No rate limiting implemented, DoS vulnerability
**File:** `backend/app/api/deps.py`

**Remediation Steps:**

1. **Install slowapi** for FastAPI rate limiting:
   ```
   pip install slowapi
   ```

2. **Create rate limiter configuration:**
   ```python
   from slowapi import Limiter
   from slowapi.util import get_remote_address

   limiter = Limiter(key_func=get_remote_address)
   ```

3. **Apply to enrichment endpoints:**
   - `/api/v1/enrich/{domain}`: 10 requests/minute
   - `/api/v1/enrich/batch`: 2 requests/minute
   - General endpoints: 100 requests/minute

**Files to Create/Modify:**
- `backend/app/middleware/rate_limit.py` (new)
- `backend/app/main.py`
- `backend/requirements.txt` (add slowapi)

---

### HIGH-2: Fix CORS Configuration

**Issue:** CORS allows all origins (`*`)
**Files:** `backend/app/config.py`, `backend/app/main.py`

**Remediation Steps:**

1. **Update config.py** default:
   ```python
   CORS_ORIGINS: str = "https://algolia-arian.vercel.app"
   ```

2. **Add development origins via environment:**
   ```
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://algolia-arian.vercel.app
   ```

**Files to Modify:**
- `backend/app/config.py`

---

### HIGH-3: Remove Customer List from Frontend

**Issue:** Hardcoded Algolia customer list exposed
**File:** `frontend/src/services/enrichment.ts`

**Remediation Steps:**

1. **Delete `KNOWN_ALGOLIA_CUSTOMERS` Set**

2. **Replace `checkIfAlgoliaCustomer()` with async stub:**
   ```typescript
   // TODO: Move to backend API when needed
   async function checkIfAlgoliaCustomer(domain: string): Promise<boolean> {
     // For now, return false - tech stack detection handles this
     return false;
   }
   ```

3. **Remove from `detectSearchProvider()`** - rely on BuiltWith detection instead

**Files to Modify:**
- `frontend/src/services/enrichment.ts`

---

### HIGH-4: Secure Hiring Service

**Issue:** Runtime pip install, HTTP server on 0.0.0.0 with no auth
**File:** `backend/hiring/hiring_service.py`

**Remediation Steps:**

1. **Remove runtime package installation:**
   - Delete subprocess.check_call for pip install
   - Add `python-jobspy>=1.1.0` to requirements.txt

2. **Bind to localhost only:**
   ```python
   server = HTTPServer(('127.0.0.1', port), HiringHandler)
   ```

3. **Add API key validation:**
   ```python
   API_KEY = os.getenv("HIRING_API_KEY", "")

   def do_GET(self):
       if self.headers.get("X-API-Key") != API_KEY:
           self.send_error(401, "Unauthorized")
           return
   ```

**Files to Modify:**
- `backend/hiring/hiring_service.py`
- `backend/requirements.txt`

---

### HIGH-5: Add Feedback Endpoint Validation

**Issue:** Unvalidated feedback submission allows spam/injection
**File:** `frontend/src/services/supabase.ts`

**Remediation Steps:**

1. **Add validation to `submitFeedback()`:**
   ```typescript
   const ALLOWED_FEEDBACK_TYPES = ['is_algolia_customer', 'wrong_company_name', 'missing_data', 'incorrect_data'];
   const MAX_NOTES_LENGTH = 5000;

   if (!ALLOWED_FEEDBACK_TYPES.includes(feedback.feedback_type)) {
     return { success: false, error: 'Invalid feedback type' };
   }
   if (feedback.notes && feedback.notes.length > MAX_NOTES_LENGTH) {
     return { success: false, error: 'Notes too long' };
   }
   ```

2. **Add domain format validation**

**Files to Modify:**
- `frontend/src/services/supabase.ts`

---

## Phase 3: MEDIUM Issues (12 issues) - Next Sprint

### MEDIUM-1: Disable Source Maps in Production

**File:** `frontend/vite.config.ts`

**Fix:**
```typescript
build: {
  outDir: 'dist',
  sourcemap: process.env.NODE_ENV !== 'production',
},
```

---

### MEDIUM-2: Backend Proxy for External API Keys

**Issue:** API keys in URL query parameters
**Architect Decision:** Use backend proxy instead of headers (APIs may not support header auth)

**Remediation:**
- Create `/api/v1/proxy/similarweb/{domain}` endpoint
- Create `/api/v1/proxy/builtwith/{domain}` endpoint
- Backend adds API keys server-side
- Frontend calls backend proxy, not external APIs directly

**Files to Create:**
- `backend/app/api/routes/proxy.py` (new)

**Files to Modify:**
- `frontend/src/services/enrichment/v3/sources/similarweb.ts`
- `frontend/src/services/enrichment/v3/sources/builtwith.ts`

---

### MEDIUM-3: Add Domain Input Validation

**Create:** `frontend/src/lib/validation.ts`

```typescript
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  return DOMAIN_REGEX.test(domain);
}

export function sanitizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
}
```

---

### MEDIUM-4: Add JSON Schema Validation

**Add zod to package.json and create schemas:**
```typescript
import { z } from 'zod';

const SimilarWebResponseSchema = z.object({
  global_rank: z.number().optional(),
  monthly_visits: z.number().optional(),
  // ... other fields
});
```

---

### MEDIUM-5: Fix In-Memory Job Storage

**File:** `backend/app/api/routes/enrich.py`

**Add cleanup mechanism:**
```python
MAX_JOBS = 1000
JOB_TTL_HOURS = 24

def cleanup_old_jobs():
    cutoff = datetime.utcnow() - timedelta(hours=JOB_TTL_HOURS)
    for job_id, job in list(_enrichment_jobs.items()):
        if job["created_at"] < cutoff:
            del _enrichment_jobs[job_id]
    # Also limit total jobs
    if len(_enrichment_jobs) > MAX_JOBS:
        # Remove oldest jobs
        sorted_jobs = sorted(_enrichment_jobs.items(), key=lambda x: x[1]["created_at"])
        for job_id, _ in sorted_jobs[:len(_enrichment_jobs) - MAX_JOBS]:
            del _enrichment_jobs[job_id]
```

---

### MEDIUM-6: Sanitize Error Messages

**File:** `frontend/src/services/supabase.ts`

```typescript
const ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request',
  401: 'Please log in to continue',
  403: 'You do not have permission for this action',
  404: 'Resource not found',
  429: 'Too many requests - please try again later',
  500: 'Something went wrong - please try again',
};

function getSafeErrorMessage(status: number, rawError?: string): string {
  if (process.env.NODE_ENV === 'development') {
    return rawError || ERROR_MESSAGES[status] || 'Unknown error';
  }
  return ERROR_MESSAGES[status] || 'An error occurred';
}
```

---

### MEDIUM-7: Fix Race Condition in Updates

**File:** `frontend/src/services/enrichment/v3/index.ts`

Add version checking before PATCH:
```typescript
// Add If-Match header with ETag for optimistic locking
headers['If-Match'] = company.updated_at || '*';
```

---

### MEDIUM-8: Add Batch Size Validation

**File:** `frontend/src/services/enrichment/v3/index.ts`

```typescript
const MAX_BATCH_SIZE = 100;
const MAX_CONCURRENT = 3;

export async function enrichBatch(domains: string[], options = {}): Promise<...> {
  if (!Array.isArray(domains) || domains.length === 0) {
    throw new Error('Invalid domains array');
  }
  if (domains.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size limited to ${MAX_BATCH_SIZE} domains`);
  }
  // Process with concurrency limit...
}
```

---

### MEDIUM-9: Sanitize CSV Exports

**File:** `frontend/src/services/exportService.ts`

```typescript
function escapeCSVValue(value: string): string {
  if (!value) return '';

  // Escape formula injection
  const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
  let escaped = value;
  if (DANGEROUS_PREFIXES.some(p => escaped.startsWith(p))) {
    escaped = "'" + escaped;
  }

  // Standard CSV escaping
  if (escaped.includes('"') || escaped.includes(',') || escaped.includes('\n')) {
    escaped = '"' + escaped.replace(/"/g, '""') + '"';
  }

  return escaped;
}
```

---

### MEDIUM-10: Enhanced File Upload Validation

**File:** `frontend/src/components/upload/CSVUploader.tsx`

Add additional client-side checks (backend validation still needed):
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['text/csv', 'application/vnd.ms-excel'];

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return 'File too large (max 10MB)';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Invalid file type';
  return null;
}
```

---

### MEDIUM-11: Fix Open Redirect via Domain

**File:** `frontend/src/lib/validation.ts`

```typescript
export function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    // Block javascript:, data:, file:
    return true;
  } catch {
    return false;
  }
}
```

Apply in CompanyDrawer and IntelligenceAccordions.

---

### MEDIUM-12: Fix Inconsistent Score Thresholds

**Files:** Already using consistent 70/40 thresholds - architect confirmed this may be resolved.

**Verify:** Check that all files import from `lib/constants.ts`:
```typescript
import { getStatusFromScore, SCORE_THRESHOLDS } from '@/lib/constants';
```

---

## Revised Implementation Order (Architect Approved)

```
Day 1 (MUST be sequential):
├── 1. CRITICAL-4: Fix RLS policies FIRST
├── 2. CRITICAL-2: Remove service role key (safe now)
├── 3. CRITICAL-1: Remove credentials from source control
└── 4. CRITICAL-3: Implement backend authentication

Day 2:
├── HIGH-2: Fix CORS (quick win)
├── HIGH-1: Implement rate limiting
└── HIGH-3: Remove customer list

Day 3:
├── HIGH-4: Secure hiring service
└── HIGH-5: Add feedback validation

Day 4-5 (MEDIUM - group by file):
├── supabase.ts changes: MEDIUM-3, MEDIUM-6
├── enrichment/v3 changes: MEDIUM-2 (proxy), MEDIUM-7, MEDIUM-8
├── exportService.ts: MEDIUM-9
├── vite.config.ts: MEDIUM-1
├── validation.ts: MEDIUM-3, MEDIUM-11
└── Other: MEDIUM-4, MEDIUM-5, MEDIUM-10, MEDIUM-12
```

---

## Verification Checklist

After all fixes, verify:

- [ ] No secrets in git history
- [ ] Service role key not in frontend bundle
- [ ] RLS policies properly restrict data
- [ ] Backend auth rejects invalid tokens
- [ ] Rate limiting blocks excessive requests
- [ ] CORS rejects unauthorized origins
- [ ] All domain inputs validated
- [ ] Error messages sanitized
- [ ] CSV exports safe from injection
- [ ] File uploads validated
- [ ] External URLs validated
- [ ] Run `npm audit` - no high/critical vulnerabilities
- [ ] Run security tests

---

## Rollback Procedures

### Database Rollback
Each migration includes rollback SQL in comments. To rollback:
```sql
-- Run the ROLLBACK SECTION from the migration file
```

### Code Rollback
Each fix is in a separate commit. To rollback specific fix:
```bash
git revert <commit-hash>
```

### Feature Flags
For authentication changes:
```
ENV=development
ALLOW_MOCK_AUTH=true
```

---

## Security Testing Requirements (New)

After remediation, run:

1. **Dependency audit:**
   ```bash
   cd frontend && npm audit
   cd backend && pip-audit  # or safety check
   ```

2. **Secret scanning:**
   ```bash
   # Add to CI/CD
   gitleaks detect --source . --verbose
   ```

3. **Manual verification:**
   - Try accessing API without auth
   - Try submitting malformed domains
   - Try CSV injection in exports
   - Verify CORS blocks unauthorized origins

---

**Plan Status:** APPROVED - Ready for Implementation
