/**
 * Enrich Proxy Edge Function
 *
 * Securely proxies API calls to SimilarWeb, BuiltWith, and JSearch.
 * API keys are stored in Supabase Secrets (server-side only).
 *
 * Usage:
 *   POST /functions/v1/enrich-proxy
 *   Body: { source: "similarweb" | "builtwith" | "jsearch", domain: string, companyName?: string }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProxyRequest {
  source: 'similarweb' | 'builtwith' | 'jsearch';
  domain: string;
  companyName?: string;
}

// Proxy handlers for each source
async function proxySimilarWeb(domain: string): Promise<Response> {
  const apiKey = Deno.env.get('SIMILARWEB_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'SimilarWeb API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = `https://api.similarweb.com/v1/SimilarWebAddon/${domain}/all?api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function proxyBuiltWith(domain: string): Promise<Response> {
  const apiKey = Deno.env.get('BUILTWITH_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'BuiltWith API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = `https://api.builtwith.com/free1/api.json?KEY=${apiKey}&LOOKUP=${domain}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function proxyJSearch(domain: string, companyName?: string): Promise<Response> {
  const apiKey = Deno.env.get('JSEARCH_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'JSearch API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Extract company name from domain if not provided
  const name = companyName || domain
    .replace(/^www\./, '')
    .split('.')[0]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const query = encodeURIComponent(`${name} jobs`);
  const url = `https://jsearch.p.rapidapi.com/search?query=${query}&num_pages=2`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: ProxyRequest = await req.json();
    const { source, domain, companyName } = body;

    if (!source || !domain) {
      return new Response(JSON.stringify({ error: 'Missing source or domain' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route to appropriate proxy handler
    switch (source) {
      case 'similarweb':
        return proxySimilarWeb(domain);
      case 'builtwith':
        return proxyBuiltWith(domain);
      case 'jsearch':
        return proxyJSearch(domain, companyName);
      default:
        return new Response(JSON.stringify({ error: `Unknown source: ${source}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
