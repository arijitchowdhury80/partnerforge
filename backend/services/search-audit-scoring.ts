/**
 * Search Audit Scoring Engine
 *
 * Calculates 10-dimension search audit score (0-10 scale) from test results.
 *
 * Dimensions:
 * 1. Relevance (15%) - tests 2c,2d,2e
 * 2. Typo & Synonym Tolerance (15%) - tests 2f,2g
 * 3. Federated Search (10%) - test 2s
 * 4. SAYT / Autocomplete (10%) - test 2m
 * 5. Facets & Filters (10%) - tests 2h,2o
 * 6. Empty State Handling (10%) - test 2k
 * 7. Semantic / NLP (10%) - test 2i
 * 8. Dynamic Facets & Personalization (5%) - tests 2o,2t
 * 9. Recommendations & Merchandising (10%) - test 2q
 * 10. Search Intelligence (5%) - tests 2r,2t
 */

import { SearchTestResult } from './search-test-library';

/**
 * Scoring dimension definition
 */
export interface ScoringDimension {
  name: string;
  weight: number; // Percentage (sum = 100% = 1.0)
  tests: string[]; // Test IDs that contribute to this dimension
  calculate: (testResults: SearchTestResult[]) => number; // Returns 0-10 score
}

/**
 * Dimension score result
 */
export interface DimensionScore {
  dimension: string;
  score: number; // 0-10
  weight: number; // Percentage
  weightedScore: number; // score * weight
  testIds: string[];
  passed: boolean; // All tests in dimension passed
}

/**
 * Complete audit score
 */
export interface AuditScore {
  companyId: string;
  auditId: string;
  overallScore: number; // 0-10 (weighted average)
  dimensionScores: DimensionScore[];
  findings: Finding[];
  generatedAt: Date;
}

/**
 * Individual finding with severity
 */
export interface Finding {
  testId: string;
  testName: string;
  finding: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  evidence?: any;  // Can be Evidence[] or string
  screenshotPath?: string;
  businessImpact?: string;
  algoliaProduct?: string;
}

/**
 * Calculate average score of tests
 */
function averageScore(testResults: SearchTestResult[], testIds: string[]): number {
  const relevantTests = testResults.filter(r => testIds.includes(r.testId));

  if (relevantTests.length === 0) return 0;

  const sum = relevantTests.reduce((acc, r) => acc + r.score, 0);
  return sum / relevantTests.length;
}

/**
 * Check if all tests passed
 */
function allTestsPassed(testResults: SearchTestResult[], testIds: string[]): boolean {
  const relevantTests = testResults.filter(r => testIds.includes(r.testId));
  return relevantTests.every(r => r.status === 'passed');
}

/**
 * 10 Scoring Dimensions
 */
export const SCORING_DIMENSIONS: ScoringDimension[] = [
  {
    name: 'Relevance',
    weight: 0.15, // 15%
    tests: ['2c', '2d', '2e'],
    calculate: (results) => averageScore(results, ['2c', '2d', '2e']),
  },
  {
    name: 'Typo & Synonym Tolerance',
    weight: 0.15, // 15%
    tests: ['2f', '2g'],
    calculate: (results) => averageScore(results, ['2f', '2g']),
  },
  {
    name: 'Federated Search',
    weight: 0.10, // 10%
    tests: ['2s'],
    calculate: (results) => averageScore(results, ['2s']),
  },
  {
    name: 'SAYT / Autocomplete',
    weight: 0.10, // 10%
    tests: ['2m'],
    calculate: (results) => averageScore(results, ['2m']),
  },
  {
    name: 'Facets & Filters',
    weight: 0.10, // 10%
    tests: ['2h', '2o'],
    calculate: (results) => averageScore(results, ['2h', '2o']),
  },
  {
    name: 'Empty State Handling',
    weight: 0.10, // 10%
    tests: ['2k'],
    calculate: (results) => averageScore(results, ['2k']),
  },
  {
    name: 'Semantic / NLP',
    weight: 0.10, // 10%
    tests: ['2i'],
    calculate: (results) => averageScore(results, ['2i']),
  },
  {
    name: 'Dynamic Facets & Personalization',
    weight: 0.05, // 5%
    tests: ['2o', '2t'],
    calculate: (results) => averageScore(results, ['2o', '2t']),
  },
  {
    name: 'Recommendations & Merchandising',
    weight: 0.10, // 10%
    tests: ['2q'],
    calculate: (results) => averageScore(results, ['2q']),
  },
  {
    name: 'Search Intelligence',
    weight: 0.05, // 5%
    tests: ['2r', '2t'],
    calculate: (results) => averageScore(results, ['2r', '2t']),
  },
];

/**
 * Verify dimension weights sum to 100%
 */
function verifyWeights(): void {
  const totalWeight = SCORING_DIMENSIONS.reduce((sum, dim) => sum + dim.weight, 0);

  if (Math.abs(totalWeight - 1.0) > 0.01) {
    throw new Error(`Dimension weights must sum to 1.0, got ${totalWeight}`);
  }
}

// Verify on module load
verifyWeights();

/**
 * Test name mapping (for human-readable findings)
 */
const TEST_NAMES: Record<string, string> = {
  '2a': 'Homepage Navigation',
  '2b': 'Empty Search Handling',
  '2c': 'Simple Single-Word Query',
  '2d': 'Multi-Word Query',
  '2e': 'Product-Specific Query',
  '2f': 'Typo Handling',
  '2g': 'Synonym Handling',
  '2h': 'Query with Filters',
  '2i': 'Complex NLP Query',
  '2j': 'Brand-Specific Query',
  '2k': 'Zero-Results Handling',
  '2l': 'Mobile View',
  '2m': 'SAYT (Autocomplete)',
  '2n': 'Sort Functionality',
  '2o': 'Facet Interaction',
  '2p': 'Pagination',
  '2q': 'PDP Recommendations',
  '2r': 'Recent Searches',
  '2s': 'Federated Search',
  '2t': 'Search Analytics',
};

/**
 * Base severity mapping (before considering score)
 */
const TEST_BASE_SEVERITY: Record<string, 'HIGH' | 'MEDIUM' | 'LOW'> = {
  '2a': 'HIGH',
  '2b': 'MEDIUM',
  '2c': 'HIGH',
  '2d': 'HIGH',
  '2e': 'MEDIUM',
  '2f': 'HIGH',
  '2g': 'HIGH',
  '2h': 'MEDIUM',
  '2i': 'HIGH',
  '2j': 'MEDIUM',
  '2k': 'HIGH',
  '2l': 'MEDIUM',
  '2m': 'HIGH',
  '2n': 'LOW',
  '2o': 'MEDIUM',
  '2p': 'LOW',
  '2q': 'MEDIUM',
  '2r': 'LOW',
  '2s': 'HIGH',
  '2t': 'LOW',
};

/**
 * Determine severity based on test score and base severity
 *
 * Logic:
 * - score < 3 + HIGH base = CRITICAL
 * - score < 5 + HIGH base = HIGH
 * - score < 7 = MEDIUM
 * - score >= 7 = LOW
 */
function getSeverity(testId: string, score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const baseSeverity = TEST_BASE_SEVERITY[testId] || 'MEDIUM';

  if (score < 3 && baseSeverity === 'HIGH') {
    return 'CRITICAL';
  }

  if (score < 5 && baseSeverity === 'HIGH') {
    return 'HIGH';
  }

  if (score < 7) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Map findings to Algolia products
 */
function getAlgoliaProduct(testId: string): string {
  const productMap: Record<string, string> = {
    '2c': 'Algolia Search',
    '2d': 'Algolia NLP',
    '2e': 'Algolia Relevance',
    '2f': 'Algolia Typo Tolerance',
    '2g': 'Algolia Synonyms',
    '2h': 'Algolia Facets',
    '2i': 'Algolia NLP',
    '2j': 'Algolia Merchandising',
    '2k': 'Algolia Query Suggestions',
    '2l': 'Algolia Mobile SDK',
    '2m': 'Algolia Autocomplete',
    '2n': 'Algolia Sorting',
    '2o': 'Algolia Dynamic Facets',
    '2p': 'Algolia Pagination',
    '2q': 'Algolia Recommend',
    '2r': 'Algolia Insights',
    '2s': 'Algolia Federated Search',
    '2t': 'Algolia Analytics',
  };

  return productMap[testId] || 'Algolia Search';
}

/**
 * Get business impact description
 */
function getBusinessImpact(testId: string, score: number): string {
  const impactMap: Record<string, string> = {
    '2c': 'Poor relevance leads to user frustration and abandoned searches (25-40% revenue loss)',
    '2d': 'Multi-word queries failing means users can\'t refine searches, reducing conversion rates',
    '2e': 'Product-specific queries missing reduces direct purchase intent conversion',
    '2f': 'No typo tolerance means 10-15% of searches fail unnecessarily',
    '2g': 'Missing synonym handling loses 15-20% of potential matches',
    '2h': 'No facets means users can\'t narrow results, increasing time-to-purchase',
    '2i': 'NLP queries failing means natural language searches return poor results',
    '2j': 'Brand queries failing loses high-intent brand shoppers',
    '2k': 'Poor empty state increases bounce rate by 30-50%',
    '2l': 'Broken mobile search loses 50-60% of mobile traffic',
    '2m': 'No autocomplete increases search friction and time-to-result',
    '2n': 'Missing sort reduces user control and increases abandonment',
    '2o': 'Non-functional facets frustrate users trying to filter results',
    '2p': 'Poor pagination makes it hard to browse large result sets',
    '2q': 'No recommendations loses upsell and cross-sell opportunities (10-30% of revenue)',
    '2r': 'No recent searches means users repeat searches, increasing friction',
    '2s': 'Federated search missing means informational queries return only products',
    '2t': 'No analytics means no visibility into search performance',
  };

  return impactMap[testId] || 'Suboptimal search experience reduces user satisfaction and conversion';
}

/**
 * Calculate complete audit score from test results
 */
export async function calculateAuditScore(
  companyId: string,
  auditId: string,
  testResults: SearchTestResult[]
): Promise<AuditScore> {
  // 1. Calculate dimension scores
  const dimensionScores: DimensionScore[] = SCORING_DIMENSIONS.map(dim => {
    const score = dim.calculate(testResults);
    const weightedScore = score * dim.weight;
    const passed = allTestsPassed(testResults, dim.tests);

    return {
      dimension: dim.name,
      score: Math.round(score * 10) / 10, // 1 decimal
      weight: dim.weight,
      weightedScore,
      testIds: dim.tests,
      passed,
    };
  });

  // 2. Calculate overall score (weighted average)
  const overallScore = dimensionScores.reduce((sum, d) => sum + d.weightedScore, 0);

  // 3. Generate findings from failed tests
  const findings: Finding[] = testResults
    .filter(r => r.status !== 'passed')
    .map(r => ({
      testId: r.testId,
      testName: TEST_NAMES[r.testId] || r.testId,
      finding: r.findings[0] || 'Test failed',
      severity: getSeverity(r.testId, r.score),
      evidence: r.evidence,
      screenshotPath: r.screenshots[0]?.filePath,
      businessImpact: getBusinessImpact(r.testId, r.score),
      algoliaProduct: getAlgoliaProduct(r.testId),
    }))
    .sort((a, b) => {
      // Sort by severity: CRITICAL > HIGH > MEDIUM > LOW
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

  return {
    companyId,
    auditId,
    overallScore: Math.round(overallScore * 10) / 10, // 1 decimal
    dimensionScores,
    findings,
    generatedAt: new Date(),
  };
}

/**
 * Get summary statistics from audit score
 */
export function getScoreStats(auditScore: AuditScore): {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  passRate: number;
} {
  const findings = auditScore.findings;

  return {
    totalTests: 20, // We always run 20 tests
    passedTests: 20 - findings.length,
    failedTests: findings.length,
    criticalCount: findings.filter(f => f.severity === 'CRITICAL').length,
    highCount: findings.filter(f => f.severity === 'HIGH').length,
    mediumCount: findings.filter(f => f.severity === 'MEDIUM').length,
    lowCount: findings.filter(f => f.severity === 'LOW').length,
    passRate: ((20 - findings.length) / 20) * 100,
  };
}

/**
 * Get score interpretation
 */
export function getScoreInterpretation(score: number): {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  description: string;
  action: string;
} {
  if (score >= 8.0) {
    return {
      grade: 'A',
      label: 'Excellent',
      description: 'Search experience is well-optimized with minimal gaps.',
      action: 'Focus on incremental improvements and personalization.',
    };
  }

  if (score >= 6.0) {
    return {
      grade: 'B',
      label: 'Good',
      description: 'Solid search foundation with some areas for improvement.',
      action: 'Address medium-priority gaps to reach excellence.',
    };
  }

  if (score >= 4.0) {
    return {
      grade: 'C',
      label: 'Fair',
      description: 'Basic search functionality present but significant gaps exist.',
      action: 'Prioritize high-impact improvements (typo tolerance, NLP, SAYT).',
    };
  }

  if (score >= 2.0) {
    return {
      grade: 'D',
      label: 'Poor',
      description: 'Search experience has major deficiencies affecting user satisfaction.',
      action: 'Urgent overhaul needed - focus on core relevance and intelligence features.',
    };
  }

  return {
    grade: 'F',
    label: 'Critical',
    description: 'Search is broken or severely lacking in essential features.',
    action: 'Immediate action required - search is likely driving significant revenue loss.',
  };
}

/**
 * Format dimension scores for display
 */
export function formatDimensionScores(dimensionScores: DimensionScore[]): string {
  let output = '## Dimension Scores\n\n';
  output += '| Dimension | Score | Weight | Weighted | Status |\n';
  output += '|-----------|-------|--------|----------|--------|\n';

  for (const dim of dimensionScores) {
    const status = dim.score >= 7 ? '✅ Pass' : '❌ Fail';
    output += `| ${dim.dimension} | ${dim.score.toFixed(1)}/10 | ${(dim.weight * 100).toFixed(0)}% | ${dim.weightedScore.toFixed(2)} | ${status} |\n`;
  }

  return output;
}

/**
 * Format findings for display
 */
export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return '✅ **No critical findings** - All tests passed!\n';
  }

  let output = '## Findings\n\n';

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    output += `### ${i + 1}. ${f.finding} (${f.severity})\n\n`;
    output += `**Test**: ${f.testName} (${f.testId})\n\n`;

    if (f.evidence) {
      output += `**Evidence**: ${f.evidence}\n\n`;
    }

    if (f.screenshotPath) {
      output += `![Screenshot](${f.screenshotPath})\n\n`;
    }

    if (f.businessImpact) {
      output += `**Impact**: ${f.businessImpact}\n\n`;
    }

    if (f.algoliaProduct) {
      output += `**Algolia Solution**: ${f.algoliaProduct}\n\n`;
    }

    output += '---\n\n';
  }

  return output;
}

/**
 * Store audit score in database
 */
export async function storeAuditScore(auditScore: AuditScore): Promise<void> {
  // NOTE: This would use a database client
  // For now, this is a placeholder

  /*
  const client = getDBClient();

  // Update audit with overall score
  await client.from('audits')
    .update({ score: auditScore.overallScore })
    .eq('company_id', auditScore.companyId)
    .eq('id', auditScore.auditId);

  // Store dimension scores (could be JSONB or separate table)
  await client.from('audit_dimension_scores')
    .insert(auditScore.dimensionScores.map(d => ({
      company_id: auditScore.companyId,
      audit_id: auditScore.auditId,
      dimension: d.dimension,
      score: d.score,
      weight: d.weight,
      weighted_score: d.weightedScore,
      test_ids: d.testIds,
      passed: d.passed,
    })));
  */

  console.log(`Would store audit score ${auditScore.overallScore} for audit ${auditScore.auditId}`);
}

/**
 * Get stored audit score from database
 */
export async function getAuditScore(
  companyId: string,
  auditId: string
): Promise<AuditScore | null> {
  // NOTE: This would fetch from database
  // For now, return null

  /*
  const client = getDBClient();

  const { data: audit } = await client
    .from('audits')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', auditId)
    .single();

  if (!audit) return null;

  const { data: dimensionScores } = await client
    .from('audit_dimension_scores')
    .select('*')
    .eq('company_id', companyId)
    .eq('audit_id', auditId);

  const { data: testResults } = await client
    .from('search_audit_tests')
    .select('*')
    .eq('company_id', companyId)
    .eq('audit_id', auditId);

  // Reconstruct findings from failed tests
  const findings = testResults
    .filter(r => r.status !== 'passed')
    .map(r => ({
      testId: r.test_id,
      testName: r.test_name,
      finding: r.findings[0] || 'Test issue',
      severity: r.severity,
      evidence: r.evidence,
      screenshotPath: r.screenshot_path,
      businessImpact: getBusinessImpact(r.test_id, r.score),
      algoliaProduct: getAlgoliaProduct(r.test_id),
    }));

  return {
    companyId,
    auditId,
    overallScore: audit.score,
    dimensionScores,
    findings,
    generatedAt: new Date(audit.updated_at),
  };
  */

  return null;
}
