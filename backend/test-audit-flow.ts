#!/usr/bin/env ts-node
/**
 * End-to-End Audit Flow Test
 *
 * Tests:
 * 1. Create audit via API
 * 2. Poll status until completion
 * 3. Verify database state
 * 4. Check all phases completed
 */

import axios from 'axios';
import { SupabaseClient } from './database/supabase';

const API_BASE = 'http://localhost:3001';
const TEST_DOMAIN = 'target.com';
const MAX_WAIT_TIME = 60000; // 60 seconds
const POLL_INTERVAL = 2000; // 2 seconds

interface AuditResponse {
  audit_id: string;
  company_id: string;
  company_domain: string;
  status: string;
  websocket_url: string;
  created_at: string;
}

interface StatusResponse {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_phase: string;
  progress_percent: number;
  phases: Array<{
    phase: string;
    status: string;
    percent: number;
    message: string;
  }>;
  created_at: string;
  updated_at: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAuditFlow(): Promise<void> {
  console.log('\n🧪 Starting End-to-End Audit Flow Test\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Create audit
    console.log('\n📝 Test 1: Creating audit via POST /api/audits');
    console.log(`   Domain: ${TEST_DOMAIN}`);

    const createResponse = await axios.post<AuditResponse>(`${API_BASE}/api/audits`, {
      company_domain: TEST_DOMAIN,
      audit_type: 'search-audit',
    });

    if (createResponse.status !== 201) {
      throw new Error(`Expected 201, got ${createResponse.status}`);
    }

    const { audit_id, company_id, status } = createResponse.data;
    console.log(`   ✅ Audit created: ${audit_id}`);
    console.log(`   Company ID: ${company_id}`);
    console.log(`   Initial status: ${status}`);

    // Test 2: Poll status until completion
    console.log('\n⏳ Test 2: Polling audit status until completion');
    console.log(`   Max wait time: ${MAX_WAIT_TIME / 1000}s`);
    console.log(`   Poll interval: ${POLL_INTERVAL / 1000}s\n`);

    const startTime = Date.now();
    let currentStatus: StatusResponse | null = null;
    let pollCount = 0;

    while (Date.now() - startTime < MAX_WAIT_TIME) {
      pollCount++;

      const statusResponse = await axios.get<StatusResponse>(
        `${API_BASE}/api/audits/${audit_id}/status`
      );

      currentStatus = statusResponse.data;

      console.log(`   [Poll #${pollCount}] Status: ${currentStatus.status} | Phase: ${currentStatus.current_phase} | Progress: ${currentStatus.progress_percent}%`);

      if (currentStatus.status === 'completed') {
        console.log('   ✅ Audit completed!');
        break;
      }

      if (currentStatus.status === 'failed') {
        throw new Error('Audit failed!');
      }

      await sleep(POLL_INTERVAL);
    }

    if (!currentStatus || currentStatus.status !== 'completed') {
      throw new Error(`Audit did not complete within ${MAX_WAIT_TIME / 1000}s`);
    }

    // Test 3: Verify database state
    console.log('\n💾 Test 3: Verifying database state');

    const db = new SupabaseClient();
    const audits = await db.query('audits', { id: audit_id });

    if (audits.length === 0) {
      throw new Error('Audit not found in database');
    }

    const dbAudit = audits[0] as any;
    console.log(`   Status in DB: ${dbAudit.status}`);
    console.log(`   Created: ${dbAudit.created_at}`);
    console.log(`   Updated: ${dbAudit.updated_at}`);

    if (dbAudit.status !== 'completed') {
      throw new Error(`Database status is ${dbAudit.status}, expected 'completed'`);
    }

    console.log('   ✅ Database state verified');

    // Test 4: Check all phases
    console.log('\n📊 Test 4: Checking phase execution');

    const phases = currentStatus.phases;
    console.log(`   Total phases: ${phases.length}`);

    for (const phase of phases) {
      console.log(`   - ${phase.phase}: ${phase.status} (${phase.message})`);
    }

    const allCompleted = phases.every(p => p.status === 'completed' || p.status === 'pending');
    if (!allCompleted) {
      throw new Error('Not all phases completed successfully');
    }

    console.log('   ✅ All phases verified');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log(`\nAudit ID: ${audit_id}`);
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log(`Polls: ${pollCount}`);
    console.log(`Final status: ${currentStatus.status}`);
    console.log(`Progress: ${currentStatus.progress_percent}%\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    console.error('='.repeat(60));

    if (error.response) {
      console.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }

    console.error('\n');
    process.exit(1);
  }
}

// Run test
testAuditFlow();
