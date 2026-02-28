/**
 * Upload Targets Edge Function
 *
 * Handles batch inserts to displacement_targets table.
 * Uses service_role key (server-side only) to bypass RLS.
 *
 * Usage:
 *   POST /functions/v1/upload-targets
 *   Body: { rows: Array<{ domain, company_name?, partner_tech?, icp_score? }> }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TargetRow {
  domain: string;
  company_name?: string | null;
  partner_tech?: string | null;
  icp_score?: number;
}

interface UploadRequest {
  rows: TargetRow[];
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
    const body: UploadRequest = await req.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or empty rows array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate rows have domain
    const invalidRows = rows.filter(r => !r.domain || typeof r.domain !== 'string');
    if (invalidRows.length > 0) {
      return new Response(JSON.stringify({
        error: `${invalidRows.length} rows missing domain`,
        invalidCount: invalidRows.length
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service_role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Insert rows with upsert (update existing records if partner_tech provided)
    const { data, error, count } = await supabase
      .from('displacement_targets')
      .upsert(
        rows.map(row => ({
          domain: row.domain.toLowerCase().trim(),
          company_name: row.company_name || null,
          partner_tech: row.partner_tech || null,
          icp_score: row.icp_score ?? 50,
        })),
        {
          onConflict: 'domain',
          ignoreDuplicates: false, // Update existing records
        }
      )
      .select('domain');

    if (error) {
      console.error('Insert error:', error);
      return new Response(JSON.stringify({
        error: error.message,
        code: error.code
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      inserted: data?.length || 0,
      message: `Inserted ${data?.length || 0} rows`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Request error:', err);
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
