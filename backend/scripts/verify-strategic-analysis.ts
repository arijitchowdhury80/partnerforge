#!/usr/bin/env ts-node
/**
 * Strategic Analysis Verification Script
 *
 * Usage:
 *   ts-node backend/scripts/verify-strategic-analysis.ts <audit_id>
 *
 * Example:
 *   ts-node backend/scripts/verify-strategic-analysis.ts audit_costco_march2026
 *
 * This script:
 * 1. Runs strategic analysis synthesis for an audit
 * 2. Verifies the results against success criteria
 * 3. Outputs verification report
 */

import { StrategicAnalysisEngine } from '../services/strategic-analysis-engine';
import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';

interface VerificationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    details?: string;
  }[];
}

async function verifyStrategicAnalysis(auditId: string): Promise<VerificationResult> {
  const checks: VerificationResult['checks'] = [];
  let passed = true;

  try {
    console.log(`\n🔍 Verifying Strategic Analysis for audit: ${auditId}\n`);
    console.log('=' .repeat(70));

    // Get audit details
    const supabase = new SupabaseClient();
    const audits = await supabase.query('audits', { id: auditId, limit: 1 });

    if (audits.length === 0) {
      console.error(`❌ Audit not found: ${auditId}`);
      return {
        passed: false,
        checks: [{
          name: 'Audit Exists',
          passed: false,
          details: `Audit ${auditId} not found in database`
        }]
      };
    }

    const audit = audits[0];
    const companyId = audit.company_id;

    console.log(`✓ Found audit for company: ${companyId}`);
    console.log(`  Audit type: ${audit.audit_type}`);
    console.log(`  Status: ${audit.status}\n`);

    // Check 1: Verify strategic analysis exists
    console.log('Check 1: Strategic analysis exists in database');
    const analyses = await supabase.query('company_strategic_analysis', {
      company_id: companyId,
      audit_id: auditId,
      limit: 1
    });

    if (analyses.length === 0) {
      console.log('  ⚠️  No strategic analysis found. Running synthesis...\n');

      const engine = new StrategicAnalysisEngine();
      await engine.synthesize(companyId, auditId);

      console.log('  ✓ Strategic analysis synthesis complete\n');
    } else {
      console.log('  ✓ Strategic analysis found\n');
    }

    // Fetch the analysis
    const finalAnalyses = await supabase.query('company_strategic_analysis', {
      company_id: companyId,
      audit_id: auditId,
      limit: 1
    });

    const analysis = finalAnalyses[0];

    checks.push({
      name: 'Strategic analysis exists',
      passed: true,
      details: `Found analysis with primary value prop: ${analysis.primary_value_prop}`
    });

    // Check 2: Primary value prop is valid
    console.log('Check 2: Primary value proposition');
    const validValueProps = [
      'search_relevance',
      'scale_performance',
      'mobile_experience',
      'conversion_optimization',
      'personalization',
      'time_to_market',
      'operational_efficiency'
    ];

    const primaryValid = validValueProps.includes(analysis.primary_value_prop);
    console.log(`  Primary: ${analysis.primary_value_prop}`);
    console.log(`  ${primaryValid ? '✓' : '❌'} Valid value prop\n`);

    checks.push({
      name: 'Primary value prop is valid',
      passed: primaryValid,
      details: `Value prop: ${analysis.primary_value_prop}`
    });

    if (!primaryValid) passed = false;

    // Check 3: Secondary value props
    console.log('Check 3: Secondary value propositions');
    const secondariesValid = analysis.secondary_value_props.every((prop: string) =>
      validValueProps.includes(prop)
    );
    console.log(`  Count: ${analysis.secondary_value_props.length}`);
    console.log(`  ${secondariesValid ? '✓' : '❌'} All valid\n`);

    checks.push({
      name: 'Secondary value props are valid',
      passed: secondariesValid,
      details: `Found ${analysis.secondary_value_props.length} secondary props`
    });

    if (!secondariesValid) passed = false;

    // Check 4: Sales pitch is substantial
    console.log('Check 4: Sales pitch quality');
    const pitchLength = analysis.sales_pitch?.length || 0;
    const pitchValid = pitchLength >= 200;
    console.log(`  Length: ${pitchLength} characters`);
    console.log(`  ${pitchValid ? '✓' : '❌'} Substantial content (>= 200 chars)\n`);

    checks.push({
      name: 'Sales pitch is substantial',
      passed: pitchValid,
      details: `${pitchLength} characters`
    });

    if (!pitchValid) passed = false;

    // Check 5: Business impact quantified
    console.log('Check 5: Business impact quantification');
    const impactHasDollar = analysis.business_impact?.includes('$') || false;
    const impactHasNumber = /\d+\.\d+/.test(analysis.business_impact || '');
    const impactValid = impactHasDollar && impactHasNumber;
    console.log(`  Has $ symbol: ${impactHasDollar ? '✓' : '❌'}`);
    console.log(`  Has numbers: ${impactHasNumber ? '✓' : '❌'}`);
    console.log(`  Impact: ${analysis.business_impact}\n`);

    checks.push({
      name: 'Business impact is quantified',
      passed: impactValid,
      details: analysis.business_impact
    });

    if (!impactValid) passed = false;

    // Check 6: Strategic recommendations present
    console.log('Check 6: Strategic recommendations');
    const recsLength = analysis.strategic_recommendations?.length || 0;
    const recsValid = recsLength >= 100;
    console.log(`  Length: ${recsLength} characters`);
    console.log(`  ${recsValid ? '✓' : '❌'} Substantial content (>= 100 chars)\n`);

    checks.push({
      name: 'Strategic recommendations present',
      passed: recsValid,
      details: `${recsLength} characters`
    });

    if (!recsValid) passed = false;

    // Check 7: Timing intelligence
    console.log('Check 7: Timing intelligence');
    const triggerCount = analysis.trigger_events?.length || 0;
    const signalCount = analysis.timing_signals?.length || 0;
    const cautionCount = analysis.caution_signals?.length || 0;
    const timingValid = (triggerCount + signalCount + cautionCount) > 0;

    console.log(`  Trigger events: ${triggerCount}`);
    console.log(`  Timing signals: ${signalCount}`);
    console.log(`  Caution signals: ${cautionCount}`);
    console.log(`  ${timingValid ? '✓' : '❌'} At least one timing indicator\n`);

    checks.push({
      name: 'Timing intelligence present',
      passed: timingValid,
      details: `${triggerCount} triggers, ${signalCount} signals, ${cautionCount} cautions`
    });

    if (!timingValid) passed = false;

    // Check 8: Confidence score
    console.log('Check 8: Confidence score');
    const confidence = analysis.overall_confidence_score;
    const confidenceValid = confidence >= 8.0 && confidence <= 10.0;
    console.log(`  Score: ${confidence}/10`);
    console.log(`  ${confidenceValid ? '✓' : '❌'} Within valid range (8.0-10.0)\n`);

    checks.push({
      name: 'Confidence score is valid',
      passed: confidenceValid,
      details: `${confidence}/10`
    });

    if (!confidenceValid) passed = false;

    // Check 9: Module coverage
    console.log('Check 9: Module coverage');
    const moduleCount = analysis.insights_synthesized_from?.length || 0;
    const moduleValid = moduleCount >= 3; // At least 3 modules
    console.log(`  Modules: ${moduleCount}`);
    console.log(`  ${moduleValid ? '✓' : '❌'} Sufficient coverage (>= 3 modules)\n`);

    if (analysis.insights_synthesized_from) {
      console.log('  Sources:');
      analysis.insights_synthesized_from.forEach((module: string) => {
        console.log(`    - ${module}`);
      });
      console.log('');
    }

    checks.push({
      name: 'Module coverage is sufficient',
      passed: moduleValid,
      details: `${moduleCount} modules`
    });

    if (!moduleValid) passed = false;

    // Summary
    console.log('=' .repeat(70));
    console.log(`\n${passed ? '✅' : '❌'} Overall: ${passed ? 'PASSED' : 'FAILED'}`);
    console.log(`\nResults: ${checks.filter(c => c.passed).length}/${checks.length} checks passed\n`);

    if (!passed) {
      console.log('Failed checks:');
      checks.filter(c => !c.passed).forEach(check => {
        console.log(`  ❌ ${check.name}: ${check.details}`);
      });
      console.log('');
    }

    return { passed, checks };

  } catch (error) {
    console.error('\n❌ Verification failed with error:');
    console.error(error);

    return {
      passed: false,
      checks: [{
        name: 'Execution',
        passed: false,
        details: error instanceof Error ? error.message : String(error)
      }]
    };
  }
}

// Main execution
if (require.main === module) {
  const auditId = process.argv[2];

  if (!auditId) {
    console.error('Usage: ts-node verify-strategic-analysis.ts <audit_id>');
    console.error('Example: ts-node verify-strategic-analysis.ts audit_costco_march2026');
    process.exit(1);
  }

  verifyStrategicAnalysis(auditId)
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { verifyStrategicAnalysis };
