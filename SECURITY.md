# Security Model

## Architecture

Algolia Arian uses a **backend-only security model** where:

1. **Backend is the only Supabase consumer**
   - No client-side code has database credentials
   - All database access goes through Express API endpoints

2. **Security boundary at API layer**
   - Authentication/authorization enforced in `backend/server.ts`
   - Rate limiting, input validation, and access control at API level

3. **RLS disabled on backend tables**
   - Row Level Security is designed for client-side database access
   - With backend-only architecture, RLS is unnecessary overhead
   - Database security handled by API authentication

## Why This is Secure

### Traditional RLS Model (Client → Database)
```
Client Code → Supabase (with RLS policies) → PostgreSQL
❌ Problem: Untrusted clients need database-level protection
```

### Our Model (Backend → Database)
```
Client → Backend API (auth/validation) → Supabase → PostgreSQL
✅ Solution: Trusted backend enforces security at API layer
```

### Key Security Properties

1. **No direct client access**: Clients never receive database credentials
2. **API authentication**: All requests authenticated at backend
3. **Input validation**: Backend validates all data before database writes
4. **Rate limiting**: Backend enforces rate limits per client
5. **Audit logging**: Backend logs all database operations

## Database Credentials

| Key | Role | Usage | Exposed to Clients? |
|-----|------|-------|---------------------|
| `SUPABASE_KEY` (anon) | Limited read/write | Backend operations | ❌ No |
| `SUPABASE_SERVICE_ROLE_KEY` | Full admin access | Migrations only | ❌ No |

## Migration: 20260307012

On March 7, 2026, we disabled RLS on all backend tables:

```sql
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE audits DISABLE ROW LEVEL SECURITY;
-- ... (18 more tables)
```

**Rationale**: Moving security boundary from database (RLS) to API layer (Express middleware).

## Best Practices

1. **Never expose database keys to frontend**
2. **Authenticate all API requests**
3. **Validate input at API endpoints**
4. **Log security-relevant events**
5. **Use rate limiting on public endpoints**

## References

- [Supabase Backend-Only Applications](https://supabase.com/docs/guides/api#using-the-rest-api)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- Backend API: [backend/server.ts](backend/server.ts)
- Migration: [supabase/migrations/20260307012_disable_rls_existing_tables.sql](supabase/migrations/20260307012_disable_rls_existing_tables.sql)
