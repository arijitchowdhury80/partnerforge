# PartnerForge Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                             │
│                 partnerforge.vercel.app                          │
│              React 18 + TypeScript + Mantine                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ API Calls
┌─────────────────────────────────────────────────────────────────┐
│                    Railway (Backend)                             │
│              partnerforge-api.railway.app                        │
│            FastAPI + SQLAlchemy + 15 Intel Modules               │
├─────────────────────────────────────────────────────────────────┤
│                    Railway PostgreSQL                            │
│                   30+ tables, async driver                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Deploy (Railway)

### Step 1: Create New Project in Railway

1. Go to [railway.app](https://railway.app) (you're already logged in)
2. Click **"Create a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose **`arijitchowdhury80/partnerforge`**
5. Railway will auto-detect the Python app

### Step 2: Configure Root Directory

Since the backend is in the `backend/` folder:

1. Click on your new service
2. Go to **Settings** tab
3. Under **Source**, set **Root Directory** to: `backend`
4. Click **Save**

### Step 3: Add PostgreSQL

1. In your project, click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway auto-provisions and injects `DATABASE_URL`

### Step 4: Set Environment Variables

Go to **Variables** tab and add:

| Variable | Value | Required |
|----------|-------|----------|
| `BUILTWITH_API_KEY` | `your_builtwith_api_key` | Yes |
| `SIMILARWEB_API_KEY` | `your_similarweb_api_key` | Yes |
| `DEBUG` | `false` | No |

> **Note:** `DATABASE_URL` is auto-injected by Railway PostgreSQL

### Step 5: Deploy

1. Railway will auto-deploy when you push to GitHub
2. Or click **"Deploy"** button manually
3. Wait ~2-3 minutes for build

### Step 6: Verify

Check your deployment URL:
```
https://partnerforge-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "database": "connected"
}
```

---

## Frontend Deploy (Vercel)

### Step 1: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import `arijitchowdhury80/partnerforge`
4. Set **Root Directory** to: `frontend`

### Step 2: Configure Environment

Add these variables in Vercel:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://partnerforge-production.up.railway.app` |

### Step 3: Deploy

Vercel auto-deploys on push to `main`.

---

## Environment Variables Reference

### Backend (Railway)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | Auto-provisioned |
| `BUILTWITH_API_KEY` | BuiltWith API key | Required |
| `SIMILARWEB_API_KEY` | SimilarWeb API key | Required |
| `REDIS_URL` | Redis connection (optional) | None |
| `DEBUG` | Enable debug logging | `false` |
| `APP_NAME` | Application name | `PartnerForge` |
| `APP_VERSION` | Version string | `2.0.0` |

### Frontend (Vercel)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (Railway) |

---

## Troubleshooting

### Build Fails

Check the Railway build logs. Common issues:
- Missing dependencies → Add to `requirements.txt`
- Wrong Python version → Check `runtime.txt`

### Database Connection Errors

1. Verify PostgreSQL is provisioned in Railway
2. Check `DATABASE_URL` is injected (visible in Variables)
3. Ensure app handles `postgres://` → `postgresql+asyncpg://` conversion

### Health Check Fails

The app exposes `/health` endpoint. If it fails:
1. Check logs for startup errors
2. Verify database migrations ran
3. Check port binding (`$PORT` env var)

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /ready` | Readiness (DB + Redis) |
| `GET /api/stats` | Platform statistics |
| `GET /api/companies` | List companies |
| `POST /api/enrich/{domain}` | Trigger enrichment |
| `GET /api/v1/targets` | Displacement targets |
| `GET /api/v1/alerts` | Alert management |

Full API docs at: `https://your-app.railway.app/docs`

---

## Data Migration (SQLite → PostgreSQL)

To migrate your existing 2,687 displacement targets:

```bash
# Export from SQLite
cd PartnerForge
sqlite3 data/partnerforge.db ".dump" > backup.sql

# Connect to Railway PostgreSQL
railway connect postgres

# Import (may need SQL adjustments for PostgreSQL syntax)
psql $DATABASE_URL < backup.sql
```

Or use a migration script (coming soon).

---

## Costs

### Railway
- **Hobby Plan**: $5/month (includes PostgreSQL)
- **Pro Plan**: $20/month (better performance, more resources)

### Vercel
- **Hobby**: Free (sufficient for this project)
- **Pro**: $20/month (custom domains, analytics)

**Recommended**: Railway Hobby ($5) + Vercel Hobby (Free) = **$5/month**

---

## URLs

| Environment | Backend | Frontend |
|-------------|---------|----------|
| Production | `partnerforge-production.up.railway.app` | `partnerforge.vercel.app` |
| Local | `localhost:8000` | `localhost:5173` |

---

*Last updated: 2026-02-25*
