# ICP Evidence Database Migration

## Current Status
The ICP Mind Map currently reads from the local JSON file (`frontend/src/data/customerEvidence.json`). This works perfectly for the interactive visualization.

## To Enable Database Storage

### Step 1: Run the Schema Migration

1. Go to: https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/sql
2. Copy the contents of: `supabase/migrations/20260227_icp_evidence_tables.sql`
3. Paste and run in the SQL editor

### Step 2: Import the Data

After tables are created, run the import script:

```bash
cd frontend
npm install  # ensure @supabase/supabase-js is available
npx tsx ../scripts/import-icp-evidence.ts
```

### Step 3: Update Frontend to Use Database

Update `frontend/src/data/customerEvidenceTypes.ts` to fetch from Supabase instead of JSON.

## Tables Created

| Table | Purpose |
|-------|---------|
| `icp_industries` | Normalized industry catalog (8 industries) |
| `icp_features` | Algolia product features (9 features) |
| `icp_companies` | Main company records (181 companies) |
| `icp_quotes` | Customer quotes with attribution (333 quotes) |
| `icp_company_features` | Many-to-many feature links |
| `icp_metrics` | Case study metrics |
| `icp_proofpoints` | Additional evidence (webinars, videos, etc.) |

## Evidence Tiers

| Tier | Criteria |
|------|----------|
| GOLD | Has story URL + 3+ quotes |
| SILVER | Has story URL OR 2+ quotes |
| BRONZE | Basic evidence |

## Summary View

After migration, query `icp_summary` for dashboard stats:

```sql
SELECT * FROM icp_summary;
```
