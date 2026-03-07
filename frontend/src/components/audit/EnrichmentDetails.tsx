/**
 * Enrichment Details Component
 *
 * Displays detailed data for a specific enrichment module.
 * Fetches module data from backend API and renders based on module type.
 *
 * Props:
 * - auditId: string - The audit ID
 * - module: string - Module name (e.g., "M03: Traffic Analysis")
 *
 * Supported Modules:
 * - M01: Company Context
 * - M02: Technology Stack
 * - M03: Traffic Analysis
 * - M04: Financial Profile
 * - M05: Competitor Intelligence
 * - M06: Hiring Signals
 * - M09: Executive Intelligence
 */

import React, { useState, useEffect } from 'react';

interface EnrichmentDetailsProps {
  auditId: string;
  module: string;
}

interface TrafficData {
  month: string;
  monthly_visits: number;
  bounce_rate: number;
  avg_visit_duration: number;
  pages_per_visit: number;
  direct_traffic_pct: number;
  search_traffic_pct: number;
  social_traffic_pct: number;
  referral_traffic_pct: number;
  paid_traffic_pct: number;
  top_country: string;
  top_country_pct: number;
  desktop_pct: number;
  mobile_pct: number;
  tablet_pct: number;
}

interface TechnologyData {
  technology_name: string;
  technology_category: string;
  technology_vendor: string;
  confidence_level: string;
  first_detected: string;
  last_detected: string;
}

interface FinancialData {
  fiscal_year: number;
  fiscal_quarter: number | null;
  revenue: number;
  net_income: number;
  operating_cash_flow: number;
  free_cash_flow: number;
}

interface CompetitorData {
  competitor_domain: string;
  competitor_name: string;
  similarity_score: number;
  competitor_monthly_visits: number;
  traffic_ratio: number;
}

interface HiringData {
  job_title: string;
  job_location: string;
  job_department: string;
  posted_date: string;
  keywords: string[];
  is_remote: boolean;
}

interface ExecutiveData {
  full_name: string;
  title: string;
  role_category: string;
  department: string;
  linkedin_url: string;
  start_date: string;
  is_current: boolean;
}

export const EnrichmentDetails: React.FC<EnrichmentDetailsProps> = ({ auditId, module }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch module data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const moduleKey = module.split(':')[0]; // Extract "M03" from "M03: Traffic Analysis"
        const response = await fetch(`${apiUrl}/api/audits/${auditId}/enrichment/${moduleKey}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [auditId, module]);

  // Render loading state
  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-4/6" />
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold">Error loading module data</p>
          <p className="text-red-600 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <p className="text-gray-500">No data available for this module</p>
      </div>
    );
  }

  // Render based on module type
  const renderContent = () => {
    if (module.startsWith('M03')) {
      return renderTrafficAnalysis(data);
    } else if (module.startsWith('M02')) {
      return renderTechnologyStack(data);
    } else if (module.startsWith('M04')) {
      return renderFinancialProfile(data);
    } else if (module.startsWith('M05')) {
      return renderCompetitorIntelligence(data);
    } else if (module.startsWith('M06')) {
      return renderHiringSignals(data);
    } else if (module.startsWith('M09')) {
      return renderExecutiveIntelligence(data);
    } else {
      return <p className="text-gray-500">Details view not implemented for this module</p>;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">{module}</h2>
      {renderContent()}
    </div>
  );
};

// =============================================================================
// MODULE-SPECIFIC RENDERERS
// =============================================================================

/**
 * M03: Traffic Analysis
 */
function renderTrafficAnalysis(data: TrafficData[]) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">Monthly Visits</p>
          <p className="text-2xl font-bold text-blue-700">
            {(data[0].monthly_visits / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">Bounce Rate</p>
          <p className="text-2xl font-bold text-orange-700">{data[0].bounce_rate}%</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">Pages per Visit</p>
          <p className="text-2xl font-bold text-green-700">{data[0].pages_per_visit}</p>
        </div>
      </div>

      {/* Traffic Sources */}
      <div>
        <h3 className="text-lg font-bold mb-3">Traffic Sources</h3>
        <div className="space-y-2">
          {[
            { label: 'Search', value: data[0].search_traffic_pct, color: 'bg-blue-500' },
            { label: 'Direct', value: data[0].direct_traffic_pct, color: 'bg-green-500' },
            { label: 'Referral', value: data[0].referral_traffic_pct, color: 'bg-yellow-500' },
            { label: 'Social', value: data[0].social_traffic_pct, color: 'bg-purple-500' },
            { label: 'Paid', value: data[0].paid_traffic_pct, color: 'bg-red-500' },
          ].map((source) => (
            <div key={source.label} className="flex items-center gap-3">
              <span className="text-sm font-medium w-20">{source.label}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-6">
                <div
                  className={`${source.color} h-6 rounded-full flex items-center justify-end pr-2`}
                  style={{ width: `${source.value}%` }}
                >
                  <span className="text-xs font-semibold text-white">{source.value}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Device Breakdown */}
      <div>
        <h3 className="text-lg font-bold mb-3">Device Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-gray-700">{data[0].desktop_pct}%</p>
            <p className="text-sm text-gray-600 mt-1">Desktop</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-gray-700">{data[0].mobile_pct}%</p>
            <p className="text-sm text-gray-600 mt-1">Mobile</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-gray-700">{data[0].tablet_pct}%</p>
            <p className="text-sm text-gray-600 mt-1">Tablet</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * M02: Technology Stack
 */
function renderTechnologyStack(data: TechnologyData[]) {
  const groupedByCategory = data.reduce((acc, tech) => {
    if (!acc[tech.technology_category]) {
      acc[tech.technology_category] = [];
    }
    acc[tech.technology_category].push(tech);
    return acc;
  }, {} as Record<string, TechnologyData[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedByCategory).map(([category, technologies]) => (
        <div key={category}>
          <h3 className="text-lg font-bold mb-3 capitalize">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technologies.map((tech) => (
              <div key={tech.technology_name} className="p-4 border-2 border-gray-200 rounded-lg">
                <p className="font-semibold">{tech.technology_name}</p>
                <p className="text-sm text-gray-600">{tech.technology_vendor}</p>
                <span className={`mt-2 inline-block px-2 py-1 rounded text-xs font-medium ${
                  tech.confidence_level === 'high' ? 'bg-green-100 text-green-700' :
                  tech.confidence_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {tech.confidence_level} confidence
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * M04: Financial Profile
 */
function renderFinancialProfile(data: FinancialData[]) {
  const formatCurrency = (amount: number) => {
    return `$${(amount / 1000000000).toFixed(1)}B`;
  };

  return (
    <div className="space-y-6">
      {data.map((finance) => (
        <div key={`${finance.fiscal_year}-${finance.fiscal_quarter}`} className="border-2 border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">
            FY{finance.fiscal_year} {finance.fiscal_quarter ? `Q${finance.fiscal_quarter}` : '(Annual)'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Revenue</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(finance.revenue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Net Income</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(finance.net_income)}</p>
            </div>
            {finance.operating_cash_flow && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Operating Cash Flow</p>
                <p className="text-xl font-bold text-purple-700">{formatCurrency(finance.operating_cash_flow)}</p>
              </div>
            )}
            {finance.free_cash_flow && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Free Cash Flow</p>
                <p className="text-xl font-bold text-orange-700">{formatCurrency(finance.free_cash_flow)}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * M05: Competitor Intelligence
 */
function renderCompetitorIntelligence(data: CompetitorData[]) {
  return (
    <div className="space-y-4">
      {data.map((competitor) => (
        <div key={competitor.competitor_domain} className="p-4 border-2 border-gray-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold">{competitor.competitor_name}</h3>
              <p className="text-sm text-gray-600">{competitor.competitor_domain}</p>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded font-semibold text-sm">
              {competitor.similarity_score}% similar
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Monthly Visits</p>
              <p className="text-lg font-bold">{(competitor.competitor_monthly_visits / 1000000).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Traffic Ratio</p>
              <p className="text-lg font-bold">{competitor.traffic_ratio.toFixed(2)}x</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * M06: Hiring Signals
 */
function renderHiringSignals(data: HiringData[]) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-4">
        {data.length} active job posting{data.length !== 1 ? 's' : ''} found
      </p>
      {data.map((job, index) => (
        <div key={index} className="p-4 border-2 border-gray-200 rounded-lg">
          <h3 className="text-lg font-bold">{job.job_title}</h3>
          <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-600">
            <span>📍 {job.job_location}</span>
            <span>•</span>
            <span>🏢 {job.job_department}</span>
            {job.is_remote && (
              <>
                <span>•</span>
                <span>🌐 Remote</span>
              </>
            )}
          </div>
          {job.keywords && job.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {job.keywords.map((keyword) => (
                <span key={keyword} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * M09: Executive Intelligence
 */
function renderExecutiveIntelligence(data: ExecutiveData[]) {
  return (
    <div className="space-y-4">
      {data.map((exec) => (
        <div key={exec.full_name} className="p-4 border-2 border-gray-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold">{exec.full_name}</h3>
              <p className="text-sm text-gray-600">{exec.title}</p>
              <p className="text-xs text-gray-500 mt-1">{exec.department}</p>
            </div>
            {exec.is_current && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                Current
              </span>
            )}
          </div>
          {exec.linkedin_url && (
            <a
              href={exec.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              View LinkedIn Profile →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
