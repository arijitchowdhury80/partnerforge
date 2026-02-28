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
  source: 'similarweb' | 'builtwith' | 'builtwith-lists' | 'jsearch';
  domain?: string;
  companyName?: string;
  endpoint?: string; // For BuiltWith: 'v21' (detailed) or 'free' (summary)
  // For builtwith-lists:
  tech?: string;     // Technology name (e.g., "Adobe-Experience-Manager")
  since?: string;    // Time range (e.g., "30" for 30 days ago)
  offset?: string;   // Pagination token from NextOffset
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

async function proxyBuiltWith(domain: string, endpoint: string = 'v21'): Promise<Response> {
  const apiKey = Deno.env.get('BUILTWITH_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'BuiltWith API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Use v21 Domain API for detailed tech names, fallback to free for summary
  const url = endpoint === 'free'
    ? `https://api.builtwith.com/free1/api.json?KEY=${apiKey}&LOOKUP=${domain}`
    : `https://api.builtwith.com/v21/api.json?KEY=${apiKey}&LOOKUP=${domain}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000), // 30s timeout for detailed API
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

async function proxyBuiltWithLists(tech: string, since: string = '90', offset?: string): Promise<Response> {
  const apiKey = Deno.env.get('BUILTWITH_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'BuiltWith API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // BuiltWith Lists API - returns domains using a specific technology
  // SINCE parameter: "X Days Ago" format
  // OFFSET parameter: pagination token from NextOffset
  const sinceParam = `${since} Days Ago`;
  let url = `https://api.builtwith.com/lists1/api.json?KEY=${apiKey}&TECH=${encodeURIComponent(tech)}&SINCE=${encodeURIComponent(sinceParam)}`;

  // Add offset for pagination if provided
  if (offset) {
    url += `&OFFSET=${encodeURIComponent(offset)}`;
  }

  try {
    console.log(`[BuiltWith Lists] Fetching: ${tech} (since ${since} days)${offset ? ' [PAGINATED]' : ''}`);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(120000), // 2 min timeout - lists can be large
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BuiltWith Lists] HTTP ${response.status}: ${errorText}`);
      return new Response(JSON.stringify({
        error: `BuiltWith API error: ${response.status}`,
        details: errorText.substring(0, 500)
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Log summary
    const resultCount = Array.isArray(data.Results) ? data.Results.length : 0;
    console.log(`[BuiltWith Lists] ${tech}: ${resultCount} results`);

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[BuiltWith Lists] Error:`, err.message);
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
    const { source, domain, companyName, endpoint, tech, since, offset } = body;

    // Validate required params based on source
    if (!source) {
      return new Response(JSON.stringify({ error: 'Missing source' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // builtwith-lists requires tech, not domain
    if (source === 'builtwith-lists') {
      if (!tech) {
        return new Response(JSON.stringify({ error: 'Missing tech parameter for builtwith-lists' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return proxyBuiltWithLists(tech, since || '90', offset);
    }

    // All other sources require domain
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Missing domain' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route to appropriate proxy handler
    switch (source) {
      case 'similarweb':
        return proxySimilarWeb(domain);
      case 'builtwith':
        return proxyBuiltWith(domain, endpoint);
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
