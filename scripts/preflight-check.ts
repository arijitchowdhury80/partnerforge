/**
 * Pre-Flight Check for Comprehensive Enrichment
 *
 * Run this BEFORE starting the 2-hour enrichment process to validate:
 * 1. Database schema is correct
 * 2. Edge Function is deployed and working
 * 3. BuiltWith API is accessible
 * 4. All required tables/columns exist
 * 5. Test enrichment on 1 domain
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

const results: CheckResult[] = [];

function log(check: CheckResult) {
  const emoji = check.status === 'PASS' ? '✓' : check.status === 'FAIL' ? '✗' : '⚠';
  console.log(`${emoji} ${check.name.padEnd(40)} | ${check.status.padEnd(4)} | ${check.message}`);
  results.push(check);
}

async function checkCompaniesTable() {
  // Check count
  const { count, error } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  if (error) {
    log({ name: 'Companies table exists', status: 'FAIL', message: error.message });
    return;
  }

  log({ name: 'Companies table exists', status: 'PASS', message: `${count} rows` });

  // Check new columns exist
  const { data, error: colError } = await supabase
    .from('companies')
    .select('domain, monthly_tech_spend, vertical, linkedin_url, city, country')
    .limit(1);

  if (colError) {
    log({ name: 'New columns exist (spend, vertical, etc)', status: 'FAIL', message: colError.message });
  } else {
    log({ name: 'New columns exist (spend, vertical, etc)', status: 'PASS', message: 'All columns accessible' });
  }
}

async function checkTechnologiesTable() {
  const { count, error } = await supabase
    .from('technologies')
    .select('*', { count: 'exact', head: true });

  if (error) {
    log({ name: 'Technologies reference table', status: 'FAIL', message: error.message });
    return;
  }

  if (count === 0) {
    log({ name: 'Technologies reference table', status: 'FAIL', message: '0 rows - seed data not loaded!' });
  } else if (count && count < 40) {
    log({ name: 'Technologies reference table', status: 'WARN', message: `Only ${count} rows - expected 48` });
  } else {
    log({ name: 'Technologies reference table', status: 'PASS', message: `${count} tech mappings` });
  }
}

async function checkCompanyTechnologiesTable() {
  const { count, error } = await supabase
    .from('company_technologies')
    .select('*', { count: 'exact', head: true });

  if (error) {
    log({ name: 'Company_technologies table', status: 'FAIL', message: error.message });
    return;
  }

  log({ name: 'Company_technologies table', status: 'PASS', message: `${count} rows (will be populated)` });
}

async function checkBuiltWithRawTable() {
  const { count, error } = await supabase
    .from('builtwith_raw')
    .select('*', { count: 'exact', head: true });

  if (error) {
    log({ name: 'Builtwith_raw table', status: 'FAIL', message: error.message });
    return;
  }

  log({ name: 'Builtwith_raw table', status: 'PASS', message: `${count} rows (will store raw responses)` });
}

async function checkEdgeFunction() {
  try {
    // Test the edge function with a simple health check (invalid domain)
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/enrich-proxy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'builtwith',
          domain: 'test-health-check.invalid',
          endpoint: 'v21',
        }),
      }
    );

    if (response.status === 200 || response.status === 400 || response.status === 404) {
      // Any response means the function is deployed and responding
      log({ name: 'Edge Function (enrich-proxy) deployed', status: 'PASS', message: `HTTP ${response.status}` });
    } else if (response.status === 401) {
      log({ name: 'Edge Function (enrich-proxy) deployed', status: 'FAIL', message: 'Auth error - check API key' });
    } else {
      log({ name: 'Edge Function (enrich-proxy) deployed', status: 'WARN', message: `HTTP ${response.status}` });
    }
  } catch (err) {
    log({ name: 'Edge Function (enrich-proxy) deployed', status: 'FAIL', message: err instanceof Error ? err.message : 'Network error' });
  }
}

async function testSingleDomainEnrichment() {
  // Get first domain from companies table
  const { data: companies } = await supabase
    .from('companies')
    .select('domain')
    .limit(1);

  if (!companies || companies.length === 0) {
    log({ name: 'Test enrichment (1 domain)', status: 'FAIL', message: 'No companies found' });
    return;
  }

  const testDomain = companies[0].domain;
  console.log(`\n   Testing enrichment on: ${testDomain}`);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/enrich-proxy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'builtwith',
          domain: testDomain,
          endpoint: 'v21',
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      log({ name: 'Test enrichment (1 domain)', status: 'FAIL', message: `HTTP ${response.status}: ${text.substring(0, 50)}` });
      return;
    }

    const data = await response.json() as {
      Errors?: Array<{ Message: string }>;
      Results?: Array<{
        Meta?: { Country?: string; Vertical?: string };
        Spend?: { MonthlyTechnologySpend?: number; SalesRevenue?: string };
        Result?: { Paths?: Array<{ Technologies?: unknown[] }> };
        Paths?: Array<{ Technologies?: unknown[] }>;
      }>;
    };

    if (data.Errors && data.Errors.length > 0) {
      log({ name: 'Test enrichment (1 domain)', status: 'FAIL', message: `API Error: ${data.Errors[0].Message}` });
      return;
    }

    // Count technologies
    let techCount = 0;
    if (data.Results && data.Results[0]) {
      const result = data.Results[0];
      const paths = result.Result?.Paths || result.Paths || [];
      for (const path of paths) {
        techCount += path.Technologies?.length || 0;
      }

      // Check if we got firmographics
      const hasMeta = !!result.Meta;
      const hasSpend = !!result.Spend;

      log({
        name: 'Test enrichment (1 domain)',
        status: 'PASS',
        message: `${techCount} techs, Meta: ${hasMeta ? 'YES' : 'NO'}, Spend: ${hasSpend ? 'YES' : 'NO'}`
      });

      // Show sample data
      if (result.Meta) {
        console.log(`   Sample Meta: Country=${result.Meta.Country || 'N/A'}, Vertical=${result.Meta.Vertical || 'N/A'}`);
      }
      if (result.Spend) {
        console.log(`   Sample Spend: $${result.Spend.MonthlyTechnologySpend || 'N/A'}/mo, Revenue=${result.Spend.SalesRevenue || 'N/A'}`);
      }
    } else {
      log({ name: 'Test enrichment (1 domain)', status: 'WARN', message: 'No Results in response' });
    }

  } catch (err) {
    log({ name: 'Test enrichment (1 domain)', status: 'FAIL', message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

async function checkWhaleComposite() {
  const { count, error } = await supabase
    .from('whale_composite')
    .select('*', { count: 'exact', head: true });

  if (error) {
    log({ name: 'Whale_composite (Layer 2)', status: 'FAIL', message: error.message });
    return;
  }

  if (count === 0) {
    log({ name: 'Whale_composite (Layer 2)', status: 'WARN', message: '0 rows - was this imported?' });
  } else {
    log({ name: 'Whale_composite (Layer 2)', status: 'PASS', message: `${count} rows` });
  }
}

async function checkCrossbeamOverlaps() {
  const { count, error } = await supabase
    .from('crossbeam_overlaps')
    .select('*', { count: 'exact', head: true });

  if (error) {
    log({ name: 'Crossbeam_overlaps (Layer 3)', status: 'FAIL', message: error.message });
    return;
  }

  log({ name: 'Crossbeam_overlaps (Layer 3)', status: 'PASS', message: `${count} rows` });
}

async function estimateTime() {
  const { count } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  const totalDomains = count || 0;
  const delayPerRequest = 2; // seconds
  const numAgents = 5;

  const sequentialTime = (totalDomains * delayPerRequest) / 60; // minutes
  const parallelTime = sequentialTime / numAgents;

  console.log(`\n   Enrichment Time Estimate:`);
  console.log(`   - Total domains: ${totalDomains}`);
  console.log(`   - Delay per request: ${delayPerRequest}s`);
  console.log(`   - With 5 parallel agents: ~${Math.round(parallelTime)} minutes (~${(parallelTime / 60).toFixed(1)} hours)`);
  console.log(`   - Sequential (1 agent): ~${Math.round(sequentialTime)} minutes (~${(sequentialTime / 60).toFixed(1)} hours)`);
}

async function main() {
  console.log("=".repeat(80));
  console.log("PRE-FLIGHT CHECK FOR COMPREHENSIVE ENRICHMENT");
  console.log("=".repeat(80));
  console.log("");

  // Database checks
  console.log("DATABASE CHECKS:");
  console.log("-".repeat(80));
  await checkCompaniesTable();
  await checkTechnologiesTable();
  await checkCompanyTechnologiesTable();
  await checkBuiltWithRawTable();
  await checkWhaleComposite();
  await checkCrossbeamOverlaps();

  console.log("");
  console.log("API CHECKS:");
  console.log("-".repeat(80));
  await checkEdgeFunction();
  await testSingleDomainEnrichment();

  // Time estimate
  await estimateTime();

  // Summary
  console.log("");
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Warnings: ${warned}`);

  if (failed > 0) {
    console.log("\n⛔ DO NOT RUN ENRICHMENT - Fix failures first!");
    console.log("\nFailures:");
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`   - ${r.name}: ${r.message}`));
  } else if (warned > 0) {
    console.log("\n⚠️  PROCEED WITH CAUTION - Review warnings");
    console.log("\nWarnings:");
    results.filter(r => r.status === 'WARN').forEach(r => console.log(`   - ${r.name}: ${r.message}`));
  } else {
    console.log("\n✅ ALL CHECKS PASSED - Ready to run enrichment!");
  }

  console.log("");
  console.log("NEXT COMMAND:");
  console.log("-".repeat(80));
  console.log("./scripts/run-comprehensive-batch.sh 0 5");
  console.log("");
}

main().catch(console.error);
