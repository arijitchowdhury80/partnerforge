# Health API

> **Status: DEPRECATED (February 2026)**
>
> With the migration from Railway to Supabase, there is no separate backend server. Traditional health check endpoints are no longer applicable.

---

## Architecture Change

**Before:** Railway-hosted FastAPI backend with health endpoints
**After:** Frontend communicates directly with Supabase REST API

---

## No Server-Side Health Endpoints

The following endpoints from the old Railway API are **no longer available**:

| Old Endpoint | Status |
|--------------|--------|
| `GET /health` | Removed |
| `GET /ready` | Removed |
| `GET /health/ready` | Removed |
| `GET /health/live` | Removed |
| `GET /health/detailed` | Removed |
| `GET /version` | Removed |
| `GET /metrics` | Removed |

---

## Monitoring Supabase Health

### Supabase Status Page

Check Supabase service status at: [status.supabase.com](https://status.supabase.com)

### Simple Connectivity Test

Verify the API is reachable by making a simple query:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=count" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg" \
  -H "Prefer: count=exact"
```

**Success Response:**
```json
[{"count": 2737}]
```

**Headers:**
```http
Content-Range: 0-0/2737
```

### Uptime Monitoring

For automated monitoring, set up a simple HTTP check:

**URL:** `https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain&limit=1`
**Headers:** `apikey: <anon_key>`
**Expected:** HTTP 200 with JSON array

---

## Vercel Frontend Health

The frontend is hosted on Vercel. Check status at: [vercel.com/status](https://vercel.com/status)

### Frontend URL

**Production:** https://partnerforge.vercel.app

---

## What Replaces Health Metrics?

| Old Metric | New Approach |
|------------|--------------|
| Database connectivity | Supabase Dashboard |
| Request counts | Supabase Dashboard > API Logs |
| Error rates | Supabase Dashboard > Logs |
| Response times | Browser DevTools / Supabase Dashboard |
| Memory/CPU | Not applicable (serverless) |

---

## Supabase Dashboard

Access detailed metrics at: https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra

- **API Logs:** Real-time request logs
- **Database:** Connection pool, query performance
- **Storage:** Usage statistics
- **Auth:** User activity (if enabled)

---

## Alerting

Set up alerts in Supabase Dashboard:
1. Go to Project Settings > Alerts
2. Configure alerts for:
   - Database connection issues
   - High API error rates
   - Storage quota warnings
