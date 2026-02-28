# Enrich Proxy Edge Function

Securely proxies API calls to external enrichment services. API keys are stored in Supabase Secrets (server-side only), preventing exposure in the frontend bundle.

## Supported Sources

| Source | Secret Name | API |
|--------|-------------|-----|
| SimilarWeb | `SIMILARWEB_API_KEY` | Traffic, engagement, similar sites |
| BuiltWith | `BUILTWITH_API_KEY` | Tech stack detection |
| JSearch | `JSEARCH_API_KEY` | Job postings (hiring signals) |

## Setup

### 1. Configure Supabase Secrets

```bash
# Using Supabase CLI
supabase secrets set SIMILARWEB_API_KEY=your_key_here
supabase secrets set BUILTWITH_API_KEY=your_key_here
supabase secrets set JSEARCH_API_KEY=your_key_here
```

Or via Supabase Dashboard:
1. Go to **Settings** > **Edge Functions** > **Secrets**
2. Add each secret with the exact names above

### 2. Deploy the Edge Function

```bash
cd /path/to/Arian
supabase functions deploy enrich-proxy
```

### 3. Verify Deployment

```bash
# Test the function
curl -X POST https://xbitqeejsgqnwvxlnjra.supabase.co/functions/v1/enrich-proxy \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "similarweb", "domain": "example.com"}'
```

## Usage from Frontend

```typescript
import { callEnrichProxy } from '@/services/supabase';

// Fetch SimilarWeb data
const { data, error } = await callEnrichProxy({
  source: 'similarweb',
  domain: 'costco.com',
});

// Fetch BuiltWith tech stack
const { data, error } = await callEnrichProxy({
  source: 'builtwith',
  domain: 'costco.com',
});

// Fetch JSearch hiring signals
const { data, error } = await callEnrichProxy({
  source: 'jsearch',
  domain: 'costco.com',
  companyName: 'Costco', // Optional, derived from domain if not provided
});
```

## Security

- API keys are **never** exposed to the frontend
- Keys are accessed via `Deno.env.get()` at runtime
- CORS headers allow requests from any origin (adjust if needed)
- Anon key authentication required for all requests

## Local Development

For local Edge Function development:

```bash
# Start Supabase locally
supabase start

# Set secrets for local development
supabase secrets set SIMILARWEB_API_KEY=your_key_here --env-file .env.local

# Serve the function locally
supabase functions serve enrich-proxy
```
