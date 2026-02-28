# Arian Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                             │
│             algolia-arian.vercel.app                       │
│              React 18 + TypeScript + Mantine                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Direct REST API Calls
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (Database + API)                     │
│              xbitqeejsgqnwvxlnjra.supabase.co                    │
│            PostgreSQL + PostgREST + Row Level Security           │
├─────────────────────────────────────────────────────────────────┤
│                    Data: 2,737 displacement targets              │
│                    Auto-generated REST API                       │
└─────────────────────────────────────────────────────────────────┘
```

> **Note:** Railway backend has been removed. The frontend now communicates directly with Supabase REST API via `frontend/src/services/api.ts`. No separate backend server is required.

---

## Frontend Deploy (Vercel)

### Step 1: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import `arijitchowdhury80/arian`
4. Set **Root Directory** to: `frontend`

### Step 2: Configure Environment

No environment variables required. The Supabase URL and anon key are configured directly in `frontend/src/services/api.ts`.

### Step 3: Deploy

Vercel auto-deploys on push to `main`.

---

## Environment Variables Reference

### Frontend (Vercel)

No environment variables required. Supabase configuration is embedded in `api.ts`:

```typescript
const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Supabase (Database)

| Setting | Value |
|---------|-------|
| Project URL | `https://xbitqeejsgqnwvxlnjra.supabase.co` |
| Anon Key | Embedded in `api.ts` |
| Table | `displacement_targets` (2,737 records) |

---

## Troubleshooting

### Frontend Build Fails (Vercel)

Check the Vercel build logs. Common issues:
- TypeScript errors → Fix type issues in `frontend/src/`
- Missing dependencies → Run `npm install` locally first

### Supabase Connection Issues

1. Verify the Supabase project is active at [supabase.com](https://supabase.com)
2. Check the anon key in `api.ts` matches the project settings
3. Verify Row Level Security (RLS) policies allow public read access

### Data Not Loading

1. Check browser console for CORS errors
2. Verify `displacement_targets` table exists in Supabase
3. Test the REST API directly: `https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?limit=10`

---

## API Access (Supabase REST)

The frontend uses Supabase's auto-generated REST API (PostgREST):

| Operation | Example |
|-----------|---------|
| List targets | `GET /rest/v1/displacement_targets?limit=100` |
| Filter by score | `GET /rest/v1/displacement_targets?lead_score=gte.80` |
| Search by domain | `GET /rest/v1/displacement_targets?domain=eq.example.com` |
| Count records | `GET /rest/v1/displacement_targets?select=count` |

Headers required:
```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
```

---

## Data Migration (Completed)

Migration from SQLite to Supabase was completed on 2026-02-26:

```bash
# Migration script used:
python scripts/migrate_to_supabase.py
```

**Result:** 2,737 records successfully migrated to Supabase.

---

## Costs

### Supabase
- **Free Tier**: 500MB database, 2GB bandwidth (sufficient for this project)
- **Pro Plan**: $25/month (if scaling needed)

### Vercel
- **Hobby**: Free (sufficient for this project)
- **Pro**: $20/month (custom domains, analytics)

**Current Setup**: Supabase Free + Vercel Hobby = **$0/month**

---

## URLs

| Environment | Database | Frontend |
|-------------|----------|----------|
| Production | `xbitqeejsgqnwvxlnjra.supabase.co` | `algolia-arian.vercel.app` |
| Local | Supabase (same) | `localhost:5173` |

---

*Last updated: 2026-02-26*
