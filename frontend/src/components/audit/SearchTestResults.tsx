/**
 * Search Test Results Component
 *
 * Displays all 20 browser test results grouped by 10 scoring dimensions.
 * Each dimension shows its weight, score, and constituent tests.
 *
 * Dimensions:
 * 1. Relevance (15%) - tests 2c, 2d, 2e
 * 2. Typo & Synonym (15%) - tests 2f, 2g
 * 3. Federated Search (10%) - test 2s
 * 4. SAYT (10%) - test 2m
 * 5. Facets & Filters (10%) - tests 2h, 2o
 * 6. Empty State (10%) - test 2k
 * 7. Semantic/NLP (10%) - test 2i
 * 8. Dynamic Facets (5%) - tests 2o, 2t
 * 9. Recommendations (10%) - test 2q
 * 10. Intelligence (5%) - tests 2r, 2t
 */

import React, { useState } from 'react';
import useSWR from 'swr';

interface SearchTest {
  test_name: string;
  test_category: string;
  test_query: string;
  passed: boolean;
  score: number;
  severity: 'high' | 'medium' | 'low';
  finding_summary: string;
  finding_details: {
    evidence?: string;
    metadata?: any;
  };
  screenshot_count: number;
  duration_ms: number;
  executed_at: string;
}

interface SearchTestsResponse {
  tests: SearchTest[];
  overallScore: number;
  dimensionScores: DimensionScore[];
}

interface DimensionScore {
  dimension: string;
  score: number;
  weight: number;
  weightedScore: number;
  testIds: string[];
  passed: boolean;
}

interface Props {
  auditId: string;
}

// Test ID to name mapping
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

// Dimension definitions
const DIMENSIONS = [
  { name: 'Relevance', weight: 15, tests: ['2c', '2d', '2e'], color: 'bg-blue-500' },
  { name: 'Typo & Synonym', weight: 15, tests: ['2f', '2g'], color: 'bg-purple-500' },
  { name: 'Federated Search', weight: 10, tests: ['2s'], color: 'bg-green-500' },
  { name: 'SAYT', weight: 10, tests: ['2m'], color: 'bg-yellow-500' },
  { name: 'Facets & Filters', weight: 10, tests: ['2h', '2o'], color: 'bg-orange-500' },
  { name: 'Empty State', weight: 10, tests: ['2k'], color: 'bg-red-500' },
  { name: 'Semantic/NLP', weight: 10, tests: ['2i'], color: 'bg-indigo-500' },
  { name: 'Dynamic Facets', weight: 5, tests: ['2o', '2t'], color: 'bg-pink-500' },
  { name: 'Recommendations', weight: 10, tests: ['2q'], color: 'bg-teal-500' },
  { name: 'Intelligence', weight: 5, tests: ['2r', '2t'], color: 'bg-cyan-500' },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function SearchTestResults({ auditId }: Props) {
  const { data, error, isLoading } = useSWR<SearchTestsResponse>(
    `/api/audits/${auditId}/search-tests`,
    fetcher,
    { refreshInterval: 5000 } // Poll every 5 seconds for live updates
  );

  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(
    new Set(DIMENSIONS.map(d => d.name)) // Start with all expanded
  );

  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">Failed to load test results: {error.message}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const toggleDimension = (dimensionName: string) => {
    const newSet = new Set(expandedDimensions);
    if (newSet.has(dimensionName)) {
      newSet.delete(dimensionName);
    } else {
      newSet.add(dimensionName);
    }
    setExpandedDimensions(newSet);
  };

  // Group tests by dimension
  const testsByDimension = DIMENSIONS.map(dimension => {
    const tests = data.tests.filter(test => dimension.tests.includes(test.test_name));
    const avgScore = tests.length > 0
      ? tests.reduce((sum, t) => sum + t.score, 0) / tests.length
      : 0;
    const allPassed = tests.every(t => t.passed);

    return {
      ...dimension,
      tests,
      avgScore,
      allPassed,
    };
  });

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Overall Search Score</h2>
            <p className="text-sm text-gray-500 mt-1">
              Based on 20 browser tests across 10 dimensions
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-blue-600">
              {data.overallScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">out of 10</div>
          </div>
        </div>

        {/* Score interpretation */}
        <div className="mt-4">
          {data.overallScore >= 8.0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-800 font-medium">Excellent - Well-optimized search experience</p>
            </div>
          )}
          {data.overallScore >= 6.0 && data.overallScore < 8.0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-800 font-medium">Good - Solid foundation with room for improvement</p>
            </div>
          )}
          {data.overallScore >= 4.0 && data.overallScore < 6.0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 font-medium">Fair - Significant gaps exist</p>
            </div>
          )}
          {data.overallScore < 4.0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 font-medium">Poor - Urgent improvements needed</p>
            </div>
          )}
        </div>
      </div>

      {/* Dimension Sections */}
      {testsByDimension.map(dimension => (
        <div key={dimension.name} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Dimension Header */}
          <button
            onClick={() => toggleDimension(dimension.name)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${dimension.color}`} />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900">
                  {dimension.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Weight: {dimension.weight}% · {dimension.tests.length} test{dimension.tests.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {dimension.avgScore.toFixed(1)}
                </div>
                <div className="text-sm text-gray-500">/ 10</div>
              </div>

              {/* Status badge */}
              {dimension.allPassed ? (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  Pass
                </span>
              ) : (
                <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                  Fail
                </span>
              )}

              {/* Expand/collapse icon */}
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedDimensions.has(dimension.name) ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* Progress bar */}
          <div className="px-6 pb-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${dimension.color}`}
                style={{ width: `${(dimension.avgScore / 10) * 100}%` }}
              />
            </div>
          </div>

          {/* Test Cards */}
          {expandedDimensions.has(dimension.name) && (
            <div className="px-6 pb-6 space-y-3">
              {dimension.tests.map(test => (
                <TestCard
                  key={test.test_name}
                  test={test}
                  onScreenshotClick={setSelectedScreenshot}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-6xl max-h-screen p-4">
            <img
              src={selectedScreenshot}
              alt="Screenshot"
              className="max-w-full max-h-full rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual test card component
 */
function TestCard({
  test,
  onScreenshotClick,
}: {
  test: SearchTest;
  onScreenshotClick: (path: string) => void;
}) {
  const severityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h4 className="font-medium text-gray-900">
              {TEST_NAMES[test.test_name] || test.test_name}
            </h4>

            {/* Pass/Fail badge */}
            {test.passed ? (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                Pass
              </span>
            ) : (
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                Fail
              </span>
            )}

            {/* Severity badge */}
            {!test.passed && (
              <span className={`px-2 py-1 text-xs font-medium rounded ${severityColors[test.severity]}`}>
                {test.severity.toUpperCase()}
              </span>
            )}
          </div>

          {/* Query */}
          {test.test_query && (
            <p className="text-sm text-gray-500 mt-1">
              Query: <span className="font-mono text-gray-700">"{test.test_query}"</span>
            </p>
          )}

          {/* Finding */}
          {test.finding_summary && (
            <p className="text-sm text-gray-700 mt-2">
              {test.finding_summary}
            </p>
          )}

          {/* Evidence */}
          {test.finding_details?.evidence && (
            <p className="text-xs text-gray-500 mt-1">
              {test.finding_details.evidence}
            </p>
          )}
        </div>

        {/* Score */}
        <div className="text-right ml-4">
          <div className="text-2xl font-bold text-gray-900">
            {test.score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">/ 10</div>
        </div>
      </div>

      {/* Screenshot thumbnail */}
      {test.screenshot_count > 0 && (
        <div className="mt-3">
          <button
            onClick={() => onScreenshotClick(`/screenshots/${test.test_name}.png`)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View Screenshot
          </button>
        </div>
      )}
    </div>
  );
}
