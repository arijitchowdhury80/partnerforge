/**
 * Search Score Breakdown Component
 *
 * Visual breakdown of the 10-dimension scoring system showing weighted contributions
 * to the overall search audit score.
 *
 * Uses a horizontal stacked bar chart to visualize how each dimension contributes
 * to the final score based on its weight.
 */

import React from 'react';
import useSWR from 'swr';

interface DimensionScore {
  dimension: string;
  score: number; // 0-10
  weight: number; // 0-1 (percentage)
  weightedScore: number; // score * weight
  testIds: string[];
  passed: boolean;
}

interface ScoringMatrix {
  overallScore: number;
  dimensionScores: DimensionScore[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

interface Props {
  auditId: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Dimension colors (same as SearchTestResults for consistency)
const DIMENSION_COLORS: Record<string, string> = {
  'Relevance': 'bg-blue-500',
  'Typo & Synonym Tolerance': 'bg-purple-500',
  'Federated Search': 'bg-green-500',
  'SAYT / Autocomplete': 'bg-yellow-500',
  'Facets & Filters': 'bg-orange-500',
  'Empty State Handling': 'bg-red-500',
  'Semantic / NLP': 'bg-indigo-500',
  'Dynamic Facets & Personalization': 'bg-pink-500',
  'Recommendations & Merchandising': 'bg-teal-500',
  'Search Intelligence': 'bg-cyan-500',
};

export function SearchScoreBreakdown({ auditId }: Props) {
  const { data, error, isLoading } = useSWR<ScoringMatrix>(
    `/api/audits/${auditId}/scoring-matrix`,
    fetcher
  );

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
        <p className="text-red-800">Failed to load scoring matrix: {error.message}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Sort dimensions by weight (descending)
  const sortedDimensions = [...data.dimensionScores].sort((a, b) => b.weight - a.weight);

  // Calculate max possible score (10 * weight)
  const maxPossibleScores = sortedDimensions.map(d => 10 * d.weight);
  const maxTotal = maxPossibleScores.reduce((sum, score) => sum + score, 0);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Score Breakdown</h2>

        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Overall Score */}
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">
              {data.overallScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Overall Score</div>
          </div>

          {/* Test Results */}
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600">
              {data.passedTests}
            </div>
            <div className="text-sm text-gray-500 mt-1">Tests Passed</div>
          </div>

          <div className="text-center">
            <div className="text-4xl font-bold text-red-600">
              {data.failedTests}
            </div>
            <div className="text-sm text-gray-500 mt-1">Tests Failed</div>
          </div>
        </div>

        {/* Stacked Bar Chart */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Weighted Score Distribution</span>
            <span className="font-medium">{data.overallScore.toFixed(1)} / 10</span>
          </div>

          <div className="flex h-12 rounded-lg overflow-hidden border border-gray-200">
            {sortedDimensions.map((dimension, index) => {
              const percentage = (dimension.weightedScore / maxTotal) * 100;

              return (
                <div
                  key={dimension.dimension}
                  className={`${DIMENSION_COLORS[dimension.dimension] || 'bg-gray-400'} flex items-center justify-center text-white text-xs font-medium transition-all hover:opacity-80 cursor-pointer group relative`}
                  style={{ width: `${(dimension.weight * 100)}%` }}
                  title={`${dimension.dimension}: ${dimension.weightedScore.toFixed(2)} (${(dimension.weight * 100).toFixed(0)}%)`}
                >
                  {dimension.weight >= 0.1 && (
                    <span className="truncate px-2">
                      {(dimension.weight * 100).toFixed(0)}%
                    </span>
                  )}

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    <div className="font-semibold">{dimension.dimension}</div>
                    <div className="text-gray-300">
                      Score: {dimension.score.toFixed(1)}/10 · Weight: {(dimension.weight * 100).toFixed(0)}%
                    </div>
                    <div className="text-gray-300">
                      Contribution: {dimension.weightedScore.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {sortedDimensions.map(dimension => (
              <div key={dimension.dimension} className="flex items-center space-x-2 text-xs">
                <div className={`w-3 h-3 rounded-sm ${DIMENSION_COLORS[dimension.dimension] || 'bg-gray-400'}`} />
                <span className="text-gray-700">{dimension.dimension}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dimension Details Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Dimension Details</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dimension
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weighted Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDimensions.map((dimension) => (
                <tr key={dimension.dimension} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${DIMENSION_COLORS[dimension.dimension] || 'bg-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-900">
                        {dimension.dimension}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {dimension.score.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500">/ 10</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(dimension.weight * 100).toFixed(0)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {dimension.weightedScore.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {dimension.testIds.map(testId => (
                        <span
                          key={testId}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-mono rounded"
                        >
                          {testId}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {dimension.passed ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        Pass
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                        Fail
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">
                  TOTAL
                </td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900" colSpan={2}>
                  {data.overallScore.toFixed(1)} / 10
                </td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">
                  {sortedDimensions.reduce((sum, d) => sum + d.weightedScore, 0).toFixed(2)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Scoring Methodology Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">How Scoring Works</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            • Each dimension contains 1-3 tests that measure specific search capabilities
          </p>
          <p>
            • Each test scores 0-10 based on performance (10 = perfect)
          </p>
          <p>
            • Dimension score = average of constituent test scores
          </p>
          <p>
            • Overall score = weighted sum of dimension scores
          </p>
          <p className="font-medium mt-3">
            Formula: Overall Score = Σ (Dimension Score × Weight)
          </p>
        </div>
      </div>
    </div>
  );
}
