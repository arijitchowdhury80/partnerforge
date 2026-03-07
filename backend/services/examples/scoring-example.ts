/**
 * Scoring Service - Example Usage
 *
 * Demonstrates how to use the composite scoring service.
 */

import { calculateCompositeScores, fetchEnrichmentData, EnrichmentData } from '../scoring';
import { logger } from '../../utils/logger';

// =============================================================================
// EXAMPLE 1: Score a company after enrichment
// =============================================================================

async function example1_scoreAfterEnrichment(companyId: string, auditId: string) {
  console.log('\n=== Example 1: Score After Enrichment ===\n');

  try {
    // Fetch all enrichment data from database
    const enrichmentData = await fetchEnrichmentData(companyId, auditId);

    // Calculate composite scores
    const scores = await calculateCompositeScores(companyId, auditId, enrichmentData);

    // Display results
    console.log('Company:', enrichmentData.company.name);
    console.log('Domain:', enrichmentData.company.domain);
    console.log('\nScores:');
    console.log(`  Fit:          ${scores.fitScore.toFixed(1)} / 100`);
    console.log(`  Intent:       ${scores.intentScore.toFixed(1)} / 100`);
    console.log(`  Value:        ${scores.valueScore.toFixed(1)} / 100`);
    console.log(`  Displacement: ${scores.displacementScore.toFixed(1)} / 100`);
    console.log(`  Overall:      ${scores.overallScore.toFixed(1)} / 100`);
    console.log(`\nStatus: ${scores.status.toUpperCase()}`);

    // Display fit breakdown
    console.log('\nFit Score Breakdown:');
    scores.breakdown.fit.forEach((item) => console.log(`  • ${item}`));

    // Display intent breakdown
    console.log('\nIntent Score Breakdown:');
    scores.breakdown.intent.forEach((item) => console.log(`  • ${item}`));

    // Display value breakdown
    console.log('\nValue Score Breakdown:');
    scores.breakdown.value.forEach((item) => console.log(`  • ${item}`));

    // Display displacement breakdown
    console.log('\nDisplacement Score Breakdown:');
    scores.breakdown.displacement.forEach((item) => console.log(`  • ${item}`));

    return scores;
  } catch (error) {
    logger.error('Failed to score company', { companyId, auditId, error });
    throw error;
  }
}

// =============================================================================
// EXAMPLE 2: Calculate scores with custom data (no database)
// =============================================================================

async function example2_scoreWithCustomData() {
  console.log('\n=== Example 2: Score With Custom Data ===\n');

  // Mock enrichment data (e.g., for testing or preview)
  const mockData: EnrichmentData = {
    company: {
      id: 'test-id',
      domain: 'example.com',
      name: 'Example Corp',
      industry: 'ecommerce',
      employee_count: 5000,
      headquarters_country: 'US',
      annual_revenue: 500_000_000,
      is_public: true,
      stock_ticker: 'EXMP',
    },
    traffic: {
      monthly_visits: 5_000_000,
      bounce_rate: 65,
      avg_visit_duration: 180,
      mobile_pct: 60,
      yoy_growth: 25,
    },
    financials: {
      revenue: 500_000_000,
      revenue_growth: 18,
      margin: 10,
      free_cash_flow: 40_000_000,
    },
    technologies: [
      { technology_name: 'Adobe Experience Manager', technology_category: 'cms' },
      { technology_name: 'Elasticsearch', technology_category: 'search' },
    ],
    competitors: [{ competitor_domain: 'competitor.com', competitor_search_provider: 'Algolia' }],
    executives: [
      { full_name: 'Jane CEO', title: 'CEO', role_category: 'ceo' },
      { full_name: 'John CTO', title: 'CTO', role_category: 'cto' },
    ],
    quotes: [
      {
        executive_name: 'Jane CEO',
        quote_text: 'We need to improve search',
        keywords: ['search', 'customer experience'],
        source_type: 'earnings_call',
      },
    ],
    hiring: [
      { job_title: 'Search Engineer', posted_date: new Date('2026-03-01') },
      { job_title: 'Platform Engineer', posted_date: new Date('2026-02-15') },
    ],
    intent_signals: [
      { signal_type: 'technology_research', signal_description: 'Researching search', confidence_score: 85 },
    ],
  };

  // Calculate scores (without database persistence)
  const { calculateFitScore, calculateIntentScore, calculateValueScore, calculateDisplacementScore, calculateOverallScore } =
    await import('../scoring');

  const fit = calculateFitScore(mockData);
  const intent = calculateIntentScore(mockData);
  const value = calculateValueScore(mockData);
  const displacement = calculateDisplacementScore(mockData);
  const overall = calculateOverallScore(fit.score, intent.score, value.score, displacement.score);

  console.log('Scores (no DB persistence):');
  console.log(`  Fit:          ${fit.score.toFixed(1)} / 100`);
  console.log(`  Intent:       ${intent.score.toFixed(1)} / 100`);
  console.log(`  Value:        ${value.score.toFixed(1)} / 100`);
  console.log(`  Displacement: ${displacement.score.toFixed(1)} / 100`);
  console.log(`  Overall:      ${overall.toFixed(1)} / 100`);

  return { fit, intent, value, displacement, overall };
}

// =============================================================================
// EXAMPLE 3: Batch scoring multiple companies
// =============================================================================

async function example3_batchScoring(companyIds: string[], auditId: string) {
  console.log('\n=== Example 3: Batch Scoring ===\n');

  const results: Array<{ companyId: string; name: string; overallScore: number; status: string }> = [];

  for (const companyId of companyIds) {
    try {
      const data = await fetchEnrichmentData(companyId, auditId);
      const scores = await calculateCompositeScores(companyId, auditId, data);

      results.push({
        companyId,
        name: data.company.name,
        overallScore: scores.overallScore,
        status: scores.status,
      });

      console.log(`✓ ${data.company.name}: ${scores.overallScore.toFixed(1)} (${scores.status.toUpperCase()})`);
    } catch (error) {
      console.error(`✗ ${companyId}: Failed to score`, error);
    }
  }

  // Sort by overall score (descending)
  results.sort((a, b) => b.overallScore - a.overallScore);

  console.log('\nTop Companies:');
  results.slice(0, 5).forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.name} - ${result.overallScore.toFixed(1)} (${result.status.toUpperCase()})`);
  });

  return results;
}

// =============================================================================
// EXAMPLE 4: Score trending (compare audits over time)
// =============================================================================

async function example4_scoreTrending(companyId: string, auditIds: string[]) {
  console.log('\n=== Example 4: Score Trending ===\n');

  const history: Array<{ auditId: string; date: Date; overallScore: number; status: string }> = [];

  for (const auditId of auditIds) {
    try {
      const data = await fetchEnrichmentData(companyId, auditId);
      const scores = await calculateCompositeScores(companyId, auditId, data);

      history.push({
        auditId,
        date: new Date(), // In practice, get from audits.created_at
        overallScore: scores.overallScore,
        status: scores.status,
      });
    } catch (error) {
      console.error(`Failed to score audit ${auditId}:`, error);
    }
  }

  console.log('Score History:');
  history.forEach((entry) => {
    console.log(`  ${entry.date.toISOString().split('T')[0]}: ${entry.overallScore.toFixed(1)} (${entry.status.toUpperCase()})`);
  });

  // Calculate trend
  if (history.length >= 2) {
    const first = history[0].overallScore;
    const last = history[history.length - 1].overallScore;
    const change = last - first;
    const trend = change > 0 ? '↑' : change < 0 ? '↓' : '→';

    console.log(`\nTrend: ${trend} ${Math.abs(change).toFixed(1)} points`);
  }

  return history;
}

// =============================================================================
// EXAMPLE 5: Identify hottest leads (query database)
// =============================================================================

async function example5_findHotLeads() {
  console.log('\n=== Example 5: Find Hot Leads ===\n');

  const { SupabaseClient } = await import('../../database/supabase');
  const db = new SupabaseClient();

  // Query audits with overall_score >= 70 (HOT)
  const hotLeads = await db.query<any>(
    'audits',
    { status: 'completed', order: 'overall_score', limit: 10 }
  );

  console.log('Top 10 Hot Leads:');
  hotLeads.forEach((audit, index) => {
    console.log(
      `  ${index + 1}. Audit ${audit.id.substring(0, 8)} - ${audit.overall_score.toFixed(1)} (Fit: ${audit.fit_score.toFixed(1)}, Intent: ${audit.intent_score.toFixed(1)}, Value: ${audit.value_score.toFixed(1)}, Displacement: ${audit.displacement_score.toFixed(1)})`
    );
  });

  return hotLeads;
}

// =============================================================================
// EXAMPLE 6: Score breakdown analysis
// =============================================================================

async function example6_scoreBreakdownAnalysis(companyId: string, auditId: string) {
  console.log('\n=== Example 6: Score Breakdown Analysis ===\n');

  const data = await fetchEnrichmentData(companyId, auditId);
  const scores = await calculateCompositeScores(companyId, auditId, data);

  // Find strongest dimension
  const dimensions = [
    { name: 'Fit', score: scores.fitScore },
    { name: 'Intent', score: scores.intentScore },
    { name: 'Value', score: scores.valueScore },
    { name: 'Displacement', score: scores.displacementScore },
  ];
  dimensions.sort((a, b) => b.score - a.score);

  console.log('Company:', data.company.name);
  console.log(`Overall Score: ${scores.overallScore.toFixed(1)} (${scores.status.toUpperCase()})`);
  console.log('\nDimension Ranking:');
  dimensions.forEach((dim, index) => {
    console.log(`  ${index + 1}. ${dim.name}: ${dim.score.toFixed(1)} / 100`);
  });

  console.log('\nRecommendation:');
  if (scores.status === 'hot') {
    console.log('  ✅ HIGH PRIORITY: Ready for outreach');
    console.log(`  Lead with: ${dimensions[0].name.toLowerCase()} (${dimensions[0].score.toFixed(1)} / 100)`);
  } else if (scores.status === 'warm') {
    console.log('  ⚠️  MEDIUM PRIORITY: Nurture pipeline');
    console.log(`  Focus on improving: ${dimensions[dimensions.length - 1].name.toLowerCase()} (${dimensions[dimensions.length - 1].score.toFixed(1)} / 100)`);
  } else {
    console.log('  ❌ LOW PRIORITY: Not ready for outreach');
    console.log(`  Major gaps in: ${dimensions.slice(-2).map((d) => d.name.toLowerCase()).join(' and ')}`);
  }

  return { dimensions, recommendation: scores.status };
}

// =============================================================================
// MAIN: Run all examples
// =============================================================================

async function main() {
  console.log('\n========================================');
  console.log('Scoring Service - Usage Examples');
  console.log('========================================');

  // Example 1: Score a single company
  // await example1_scoreAfterEnrichment('company-id', 'audit-id');

  // Example 2: Score with custom data (no DB)
  await example2_scoreWithCustomData();

  // Example 3: Batch scoring
  // await example3_batchScoring(['id1', 'id2', 'id3'], 'audit-id');

  // Example 4: Score trending
  // await example4_scoreTrending('company-id', ['audit-1', 'audit-2', 'audit-3']);

  // Example 5: Find hot leads
  // await example5_findHotLeads();

  // Example 6: Breakdown analysis
  // await example6_scoreBreakdownAnalysis('company-id', 'audit-id');

  console.log('\n========================================');
  console.log('Examples Complete');
  console.log('========================================\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Error running examples:', error);
    process.exit(1);
  });
}

export {
  example1_scoreAfterEnrichment,
  example2_scoreWithCustomData,
  example3_batchScoring,
  example4_scoreTrending,
  example5_findHotLeads,
  example6_scoreBreakdownAnalysis,
};
