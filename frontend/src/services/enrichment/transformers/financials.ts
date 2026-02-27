/**
 * Financial Data Transformer
 *
 * Transforms Yahoo Finance API data into the FinancialData type
 * used throughout the PartnerForge application.
 */

import type { FinancialData, FinancialMetric, RoiEstimate } from '@/types';
import type {
  YahooFinanceFullData,
  YahooIncomeStatement,
  YahooQuoteSummary,
} from '../clients/yahoofinance';

// ============================================================================
// E-commerce Percentage Estimates by Vertical
// ============================================================================

const ECOMMERCE_PERCENTAGE_BY_VERTICAL: Record<string, number> = {
  // Pure-play e-commerce
  'internet retail': 0.95,
  'e-commerce': 0.95,
  'online retail': 0.95,

  // Omnichannel retail
  'retail': 0.20,
  'department stores': 0.15,
  'discount stores': 0.12,
  'warehouse clubs': 0.10,

  // Specialty retail
  'specialty retail': 0.25,
  'apparel retail': 0.30,
  'home improvement': 0.15,
  'auto parts': 0.20,
  'electronics retail': 0.35,
  'furniture': 0.25,

  // Consumer goods
  'consumer discretionary': 0.20,
  'consumer staples': 0.08,
  'food retail': 0.08,
  'grocery': 0.10,

  // Tech & Media
  'technology': 0.50,
  'software': 0.70,
  'media': 0.15,

  // B2B
  'industrial': 0.10,
  'business services': 0.15,
};

// Known pure e-commerce domains
const PURE_ECOMMERCE_DOMAINS = [
  'amazon.com',
  'chewy.com',
  'wayfair.com',
  'etsy.com',
  'ebay.com',
  'zappos.com',
  'overstock.com',
  'newegg.com',
  'wish.com',
  'shopify.com',
];

// Known omnichannel retailers (lower e-commerce percentage)
const OMNICHANNEL_DOMAINS = [
  'walmart.com',
  'target.com',
  'costco.com',
  'homedepot.com',
  'lowes.com',
  'bestbuy.com',
  'kroger.com',
  'macys.com',
  'nordstrom.com',
  'tjx.com',
];

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform Yahoo Finance API data into FinancialData type
 */
export function transformFinancialData(
  domain: string,
  yData: YahooFinanceFullData | null
): FinancialData | null {
  if (!yData) return null;

  const incomeStmts = yData.financials_3_year.income_statements;
  if (!incomeStmts || incomeStmts.length === 0) return null;

  const latestRevenue = incomeStmts[0]?.total_revenue;
  const profitMargin = yData.quote_summary.profit_margins;

  return {
    domain,
    ticker: yData.quote_summary.ticker,
    revenue: transformRevenueMetrics(incomeStmts),
    net_income: transformNetIncomeMetrics(incomeStmts),
    ebitda: transformEbitdaMetrics(incomeStmts),
    ebitda_margin: calculateEbitdaMargin(incomeStmts),
    margin_zone: determineMarginZone(profitMargin),
    ecommerce_revenue: estimateEcommerceRevenue(latestRevenue, domain, yData.quote_summary),
    ecommerce_percentage: estimateEcommercePercentage(domain, yData.quote_summary),
    stock_price: yData.stock_info.current_price,
    market_cap: yData.quote_summary.market_cap,
    roi_estimate: calculateRoiEstimate(latestRevenue, domain, yData.quote_summary),
  };
}

// ============================================================================
// Revenue Metrics
// ============================================================================

/**
 * Transform income statements into revenue metrics with YoY changes
 */
export function transformRevenueMetrics(statements: YahooIncomeStatement[]): FinancialMetric[] {
  return statements.map((stmt, idx, arr) => ({
    year: stmt.fiscal_year,
    value: stmt.total_revenue,
    yoy_change:
      idx < arr.length - 1 && arr[idx + 1].total_revenue > 0
        ? ((stmt.total_revenue - arr[idx + 1].total_revenue) / arr[idx + 1].total_revenue) * 100
        : undefined,
  }));
}

/**
 * Transform income statements into net income metrics with YoY changes
 */
export function transformNetIncomeMetrics(statements: YahooIncomeStatement[]): FinancialMetric[] {
  return statements.map((stmt, idx, arr) => ({
    year: stmt.fiscal_year,
    value: stmt.net_income,
    yoy_change:
      idx < arr.length - 1 && arr[idx + 1].net_income !== 0
        ? ((stmt.net_income - arr[idx + 1].net_income) / Math.abs(arr[idx + 1].net_income)) * 100
        : undefined,
  }));
}

/**
 * Transform income statements into EBITDA metrics
 */
export function transformEbitdaMetrics(statements: YahooIncomeStatement[]): FinancialMetric[] {
  return statements.map((stmt) => ({
    year: stmt.fiscal_year,
    value: stmt.ebitda,
  }));
}

// ============================================================================
// Margin Calculations
// ============================================================================

/**
 * Calculate EBITDA margin from the latest income statement
 */
export function calculateEbitdaMargin(statements: YahooIncomeStatement[]): number | undefined {
  if (!statements.length || !statements[0].total_revenue || statements[0].total_revenue === 0) {
    return undefined;
  }
  return (statements[0].ebitda / statements[0].total_revenue) * 100;
}

/**
 * Determine margin zone based on profit margin
 * Green: >10% (healthy)
 * Yellow: 0-10% (moderate)
 * Red: <0% (unprofitable)
 */
export function determineMarginZone(profitMargin: number): 'green' | 'yellow' | 'red' {
  if (profitMargin >= 0.10) return 'green';
  if (profitMargin >= 0) return 'yellow';
  return 'red';
}

// ============================================================================
// E-commerce Revenue Estimation
// ============================================================================

/**
 * Estimate e-commerce percentage based on domain and industry
 */
export function estimateEcommercePercentage(
  domain: string,
  quoteSummary?: YahooQuoteSummary
): number | undefined {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  // Check known pure e-commerce domains
  if (PURE_ECOMMERCE_DOMAINS.some((d) => normalizedDomain.includes(d.replace('.com', '')))) {
    return 0.95;
  }

  // Check known omnichannel domains
  if (OMNICHANNEL_DOMAINS.some((d) => normalizedDomain.includes(d.replace('.com', '')))) {
    return 0.15;
  }

  // Use industry/sector from Yahoo Finance if available
  if (quoteSummary) {
    const industry = quoteSummary.industry.toLowerCase();
    const sector = quoteSummary.sector.toLowerCase();

    // Check industry mapping
    for (const [key, value] of Object.entries(ECOMMERCE_PERCENTAGE_BY_VERTICAL)) {
      if (industry.includes(key) || sector.includes(key)) {
        return value;
      }
    }
  }

  // Default estimate
  return 0.20;
}

/**
 * Estimate e-commerce revenue based on total revenue and e-commerce percentage
 */
export function estimateEcommerceRevenue(
  totalRevenue: number | undefined,
  domain: string,
  quoteSummary?: YahooQuoteSummary
): number | undefined {
  if (!totalRevenue || totalRevenue === 0) return undefined;

  const ecomPct = estimateEcommercePercentage(domain, quoteSummary);
  return ecomPct ? totalRevenue * ecomPct : undefined;
}

// ============================================================================
// ROI Estimation
// ============================================================================

/**
 * Calculate estimated ROI from implementing Algolia
 * Based on industry benchmarks: 10-30% conversion lift from improved search
 *
 * Key assumptions:
 * - 30-50% of e-commerce revenue is influenced by site search (using 40%)
 * - Conservative: 5% lift (well-documented minimum)
 * - Moderate: 15% lift (industry average)
 * - Aggressive: 30% lift (best-in-class implementations)
 */
export function calculateRoiEstimate(
  revenue: number | undefined,
  domain: string,
  quoteSummary?: YahooQuoteSummary
): RoiEstimate | undefined {
  if (!revenue || revenue === 0) return undefined;

  const ecomPct = estimateEcommercePercentage(domain, quoteSummary) || 0.20;
  const addressableRevenue = revenue * ecomPct;

  // Search-influenced revenue is typically 30-50% of e-commerce
  const searchInfluenced = addressableRevenue * 0.40;

  return {
    addressable_revenue: searchInfluenced,
    conservative: searchInfluenced * 0.05, // 5% lift
    moderate: searchInfluenced * 0.15, // 15% lift
    aggressive: searchInfluenced * 0.30, // 30% lift
  };
}

// ============================================================================
// Financial Health Scoring
// ============================================================================

/**
 * Get financial health score for composite scoring (0-100)
 *
 * Factors:
 * - Revenue growth: up to 30 points
 * - Margin zone: up to 30 points
 * - Market cap (budget indicator): up to 40 points
 */
export function getFinancialHealthScore(data: FinancialData): number {
  let score = 0;

  // Revenue growth (30 points max)
  if (data.revenue.length >= 2 && data.revenue[0].yoy_change !== undefined) {
    const growth = data.revenue[0].yoy_change;
    if (growth > 20) score += 30;
    else if (growth > 10) score += 25;
    else if (growth > 5) score += 20;
    else if (growth > 0) score += 15;
    else if (growth > -5) score += 10;
    else score += 5;
  }

  // Margin zone (30 points max)
  if (data.margin_zone === 'green') score += 30;
  else if (data.margin_zone === 'yellow') score += 15;
  else score += 5;

  // Market cap - larger = more budget (40 points max)
  if (data.market_cap) {
    if (data.market_cap >= 100_000_000_000) score += 40; // $100B+
    else if (data.market_cap >= 50_000_000_000) score += 35; // $50B+
    else if (data.market_cap >= 10_000_000_000) score += 30; // $10B+
    else if (data.market_cap >= 5_000_000_000) score += 25; // $5B+
    else if (data.market_cap >= 1_000_000_000) score += 20; // $1B+
    else if (data.market_cap >= 500_000_000) score += 15; // $500M+
    else if (data.market_cap >= 100_000_000) score += 10; // $100M+
    else score += 5;
  }

  return Math.min(100, score);
}

/**
 * Classify financial health level
 */
export function getFinancialHealthLevel(
  data: FinancialData
): 'excellent' | 'good' | 'moderate' | 'weak' {
  const score = getFinancialHealthScore(data);
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'moderate';
  return 'weak';
}

// ============================================================================
// Revenue Trend Analysis
// ============================================================================

/**
 * Calculate revenue CAGR (Compound Annual Growth Rate)
 */
export function calculateRevenueCAGR(metrics: FinancialMetric[]): number | undefined {
  if (metrics.length < 2) return undefined;

  // Metrics are ordered from most recent to oldest
  const endValue = metrics[0].value;
  const startValue = metrics[metrics.length - 1].value;
  const years = metrics.length - 1;

  if (startValue <= 0 || endValue <= 0) return undefined;

  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

/**
 * Determine revenue trend direction
 */
export function getRevenueTrend(
  metrics: FinancialMetric[]
): 'accelerating' | 'stable' | 'decelerating' | 'declining' {
  if (metrics.length < 2) return 'stable';

  const recentGrowth = metrics[0].yoy_change;
  const olderGrowth = metrics.length >= 2 ? metrics[1].yoy_change : undefined;

  if (recentGrowth === undefined) return 'stable';

  // Check for declining revenue
  if (recentGrowth < -5) return 'declining';

  // Check for acceleration/deceleration
  if (olderGrowth !== undefined) {
    if (recentGrowth > olderGrowth + 5) return 'accelerating';
    if (recentGrowth < olderGrowth - 5) return 'decelerating';
  }

  return 'stable';
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format financial number for display (e.g., "$1.23B", "$456M")
 */
export function formatFinancialNumber(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e12) return `${sign}$${(absValue / 1e12).toFixed(2)}T`;
  if (absValue >= 1e9) return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
  if (absValue >= 1e6) return `${sign}$${(absValue / 1e6).toFixed(2)}M`;
  if (absValue >= 1e3) return `${sign}$${(absValue / 1e3).toFixed(2)}K`;
  return `${sign}$${absValue.toFixed(2)}`;
}

/**
 * Format percentage for display
 */
export function formatGrowthPercentage(value: number | undefined): string {
  if (value === undefined) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format ROI estimate for display
 */
export function formatRoiEstimate(estimate: RoiEstimate): {
  conservative: string;
  moderate: string;
  aggressive: string;
} {
  return {
    conservative: formatFinancialNumber(estimate.conservative),
    moderate: formatFinancialNumber(estimate.moderate),
    aggressive: formatFinancialNumber(estimate.aggressive),
  };
}

// ============================================================================
// Extended Financial Data Type (for richer transformations)
// ============================================================================

export interface ExtendedFinancialData {
  // Current metrics
  market_cap: number | null;
  revenue: number | null;
  revenue_growth_yoy: number | null;  // Percentage
  gross_profit: number | null;
  gross_margin: number | null;  // Percentage
  operating_income: number | null;
  operating_margin: number | null;  // Percentage
  net_income: number | null;
  net_margin: number | null;  // Percentage
  ebitda: number | null;

  // Per share
  eps: number | null;
  eps_growth_yoy: number | null;

  // Valuation
  pe_ratio: number | null;
  ps_ratio: number | null;
  ev_to_revenue: number | null;

  // Balance sheet
  total_cash: number | null;
  total_debt: number | null;
  debt_to_equity: number | null;

  // Historical (3 years)
  historical: Array<{
    year: number;
    quarter?: number;
    revenue: number;
    gross_profit: number;
    operating_income: number;
    net_income: number;
  }>;

  // Analyst data
  analyst_rating: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' | null;
  price_target_mean: number | null;
  price_target_high: number | null;
  price_target_low: number | null;

  // Stock info
  ticker: string;
  exchange: string;
  currency: string;
  current_price: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;

  // Company status
  is_public: boolean;

  fetched_at: string;
}

// ============================================================================
// Extended Transformers for Yahoo Finance Data
// ============================================================================

/**
 * Transform stock info from Yahoo Finance into partial ExtendedFinancialData
 */
export function transformStockInfo(raw: any): Partial<ExtendedFinancialData> {
  if (!raw) return {};

  return {
    ticker: raw.ticker || '',
    current_price: raw.current_price ?? null,
    fifty_two_week_high: raw.fifty_two_week_high ?? null,
    fifty_two_week_low: raw.fifty_two_week_low ?? null,
  };
}

/**
 * Transform income statement data
 */
export function transformIncomeStatement(raw: any): Pick<ExtendedFinancialData, 'revenue' | 'gross_profit' | 'operating_income' | 'net_income' | 'ebitda'> {
  if (!raw) {
    return {
      revenue: null,
      gross_profit: null,
      operating_income: null,
      net_income: null,
      ebitda: null,
    };
  }

  return {
    revenue: raw.total_revenue ?? raw.totalRevenue ?? null,
    gross_profit: raw.gross_profit ?? raw.grossProfit ?? null,
    operating_income: raw.operating_income ?? raw.operatingIncome ?? null,
    net_income: raw.net_income ?? raw.netIncome ?? null,
    ebitda: raw.ebitda ?? null,
  };
}

/**
 * Transform balance sheet data
 */
export function transformBalanceSheet(raw: any): Pick<ExtendedFinancialData, 'total_cash' | 'total_debt' | 'debt_to_equity'> {
  if (!raw) {
    return {
      total_cash: null,
      total_debt: null,
      debt_to_equity: null,
    };
  }

  const totalCash = raw.cash_and_equivalents ?? raw.cash ?? null;
  const totalDebt = raw.total_debt ?? null;
  const totalEquity = raw.total_equity ?? raw.totalStockholderEquity ?? null;

  let debtToEquity: number | null = null;
  if (totalDebt !== null && totalEquity !== null && totalEquity > 0) {
    debtToEquity = totalDebt / totalEquity;
  }

  return {
    total_cash: totalCash,
    total_debt: totalDebt,
    debt_to_equity: debtToEquity,
  };
}

/**
 * Transform historical financials from income statements
 */
export function transformHistoricalFinancials(
  income: any[],
  quarters?: any[]
): ExtendedFinancialData['historical'] {
  if (!income || income.length === 0) return [];

  const historical = income.map((stmt) => ({
    year: stmt.fiscal_year ?? new Date(stmt.fiscal_date).getFullYear(),
    revenue: stmt.total_revenue ?? 0,
    gross_profit: stmt.gross_profit ?? 0,
    operating_income: stmt.operating_income ?? 0,
    net_income: stmt.net_income ?? 0,
  }));

  // Sort by year descending (most recent first)
  return historical.sort((a, b) => b.year - a.year);
}

/**
 * Transform analyst ratings
 */
export function transformAnalystRatings(raw: any): Pick<ExtendedFinancialData, 'analyst_rating' | 'price_target_mean' | 'price_target_high' | 'price_target_low'> {
  if (!raw) {
    return {
      analyst_rating: null,
      price_target_mean: null,
      price_target_high: null,
      price_target_low: null,
    };
  }

  // Map mean rating to category
  // Yahoo Finance scale: 1 = Strong Buy, 5 = Strong Sell
  let analyst_rating: ExtendedFinancialData['analyst_rating'] = null;
  const meanRating = raw.mean_rating ?? raw.recommendationMean;

  if (meanRating !== undefined && meanRating !== null) {
    if (meanRating <= 1.5) analyst_rating = 'strong_buy';
    else if (meanRating <= 2.5) analyst_rating = 'buy';
    else if (meanRating <= 3.5) analyst_rating = 'hold';
    else if (meanRating <= 4.5) analyst_rating = 'sell';
    else analyst_rating = 'strong_sell';
  }

  return {
    analyst_rating,
    price_target_mean: raw.target_mean_price ?? raw.targetMeanPrice ?? null,
    price_target_high: raw.target_high_price ?? raw.targetHighPrice ?? null,
    price_target_low: raw.target_low_price ?? raw.targetLowPrice ?? null,
  };
}

/**
 * Calculate YoY growth rates from historical data
 */
export function calculateGrowthRates(historical: ExtendedFinancialData['historical']): {
  revenue_growth_yoy: number | null;
  eps_growth_yoy: number | null;
} {
  if (!historical || historical.length < 2) {
    return { revenue_growth_yoy: null, eps_growth_yoy: null };
  }

  // Historical is sorted descending, so [0] is most recent, [1] is previous year
  const current = historical[0];
  const previous = historical[1];

  let revenue_growth_yoy: number | null = null;
  if (previous.revenue > 0) {
    revenue_growth_yoy = ((current.revenue - previous.revenue) / previous.revenue) * 100;
  }

  // EPS growth would need EPS data - return null for now
  return { revenue_growth_yoy, eps_growth_yoy: null };
}

/**
 * Calculate margins from financial data
 */
export function calculateMargins(
  revenue: number | null,
  grossProfit: number | null,
  operatingIncome: number | null,
  netIncome: number | null
): Pick<ExtendedFinancialData, 'gross_margin' | 'operating_margin' | 'net_margin'> {
  if (!revenue || revenue <= 0) {
    return { gross_margin: null, operating_margin: null, net_margin: null };
  }

  return {
    gross_margin: grossProfit !== null ? (grossProfit / revenue) * 100 : null,
    operating_margin: operatingIncome !== null ? (operatingIncome / revenue) * 100 : null,
    net_margin: netIncome !== null ? (netIncome / revenue) * 100 : null,
  };
}

/**
 * Transform full Yahoo Finance data into ExtendedFinancialData
 */
export function transformFullFinancialData(
  stockInfo: any,
  incomeStatement: any,
  balanceSheet: any,
  recommendations: any,
  quoteSummary?: any
): ExtendedFinancialData {
  const stock = transformStockInfo(stockInfo);
  const income = transformIncomeStatement(incomeStatement);
  const balance = transformBalanceSheet(balanceSheet);
  const analyst = transformAnalystRatings(recommendations);
  const margins = calculateMargins(income.revenue, income.gross_profit, income.operating_income, income.net_income);

  // Extract historical from income statements array if available
  const incomeStatements = quoteSummary?.financials_3_year?.income_statements || [];
  const historical = transformHistoricalFinancials(incomeStatements);
  const growthRates = calculateGrowthRates(historical);

  // Calculate valuation ratios
  let ps_ratio: number | null = null;
  let ev_to_revenue: number | null = null;

  const marketCap = quoteSummary?.quote_summary?.market_cap ?? null;
  const enterpriseValue = quoteSummary?.quote_summary?.enterprise_value ?? null;

  if (marketCap && income.revenue && income.revenue > 0) {
    ps_ratio = marketCap / income.revenue;
  }
  if (enterpriseValue && income.revenue && income.revenue > 0) {
    ev_to_revenue = enterpriseValue / income.revenue;
  }

  return {
    // Stock info
    ticker: stock.ticker || '',
    exchange: quoteSummary?.quote_summary?.exchange || 'NYSE',
    currency: 'USD',
    current_price: stock.current_price ?? null,
    fifty_two_week_high: stock.fifty_two_week_high ?? null,
    fifty_two_week_low: stock.fifty_two_week_low ?? null,
    is_public: true,

    // Income statement
    market_cap: marketCap,
    revenue: income.revenue,
    revenue_growth_yoy: growthRates.revenue_growth_yoy,
    gross_profit: income.gross_profit,
    gross_margin: margins.gross_margin,
    operating_income: income.operating_income,
    operating_margin: margins.operating_margin,
    net_income: income.net_income,
    net_margin: margins.net_margin,
    ebitda: income.ebitda,

    // Per share
    eps: incomeStatement?.eps_diluted ?? null,
    eps_growth_yoy: growthRates.eps_growth_yoy,

    // Valuation
    pe_ratio: quoteSummary?.quote_summary?.pe_ratio ?? null,
    ps_ratio,
    ev_to_revenue,

    // Balance sheet
    total_cash: balance.total_cash,
    total_debt: balance.total_debt,
    debt_to_equity: balance.debt_to_equity,

    // Historical
    historical,

    // Analyst
    analyst_rating: analyst.analyst_rating,
    price_target_mean: analyst.price_target_mean,
    price_target_high: analyst.price_target_high,
    price_target_low: analyst.price_target_low,

    fetched_at: new Date().toISOString(),
  };
}

// ============================================================================
// Private Company Financial Estimation
// ============================================================================

/**
 * Revenue per employee estimates by industry
 * Source: Industry benchmarks and public company data
 */
const REVENUE_PER_EMPLOYEE_BY_INDUSTRY: Record<string, number> = {
  'technology': 350000,
  'software': 400000,
  'saas': 450000,
  'ecommerce': 500000,
  'retail': 200000,
  'wholesale': 600000,
  'manufacturing': 250000,
  'financial services': 500000,
  'healthcare': 200000,
  'media': 300000,
  'consumer goods': 400000,
  'professional services': 150000,
  'default': 250000,
};

/**
 * Funding round to revenue multiplier estimates
 */
const FUNDING_ROUND_MULTIPLIERS: Record<string, { min: number; max: number }> = {
  'pre-seed': { min: 0.5, max: 2 },
  'seed': { min: 1, max: 3 },
  'series a': { min: 2, max: 5 },
  'series b': { min: 4, max: 10 },
  'series c': { min: 8, max: 20 },
  'series d': { min: 15, max: 30 },
  'series e': { min: 25, max: 50 },
  'late stage': { min: 30, max: 60 },
};

/**
 * Estimate financial data for private companies based on available signals
 */
export function estimatePrivateCompanyFinancials(signals: {
  employee_count?: number;
  funding_total?: number;
  last_funding_round?: string;
  industry?: string;
}): Partial<ExtendedFinancialData> {
  const result: Partial<ExtendedFinancialData> = {
    is_public: false,
    fetched_at: new Date().toISOString(),
  };

  // Method 1: Estimate from employee count
  if (signals.employee_count && signals.employee_count > 0) {
    const industry = (signals.industry || 'default').toLowerCase();
    let revenuePerEmployee = REVENUE_PER_EMPLOYEE_BY_INDUSTRY['default'];

    for (const [key, value] of Object.entries(REVENUE_PER_EMPLOYEE_BY_INDUSTRY)) {
      if (industry.includes(key)) {
        revenuePerEmployee = value;
        break;
      }
    }

    result.revenue = signals.employee_count * revenuePerEmployee;
  }

  // Method 2: Estimate from funding
  if (signals.funding_total && signals.funding_total > 0) {
    const round = (signals.last_funding_round || 'series a').toLowerCase();
    let multiplier = FUNDING_ROUND_MULTIPLIERS['series a'];

    for (const [key, value] of Object.entries(FUNDING_ROUND_MULTIPLIERS)) {
      if (round.includes(key)) {
        multiplier = value;
        break;
      }
    }

    // Estimate revenue as funding * multiplier (use midpoint)
    const fundingEstimate = signals.funding_total * ((multiplier.min + multiplier.max) / 2);

    // If we already have an employee-based estimate, average them
    if (result.revenue) {
      result.revenue = (result.revenue + fundingEstimate) / 2;
    } else {
      result.revenue = fundingEstimate;
    }

    // Estimate market cap from funding (typical 3-5x last round valuation)
    // Assuming funding represents ~20% dilution on average
    result.market_cap = signals.funding_total * 5;
  }

  // Estimate margins based on industry
  if (result.revenue) {
    const industry = (signals.industry || 'default').toLowerCase();

    if (industry.includes('software') || industry.includes('saas')) {
      result.gross_margin = 75; // SaaS typically 70-80%
      result.operating_margin = 15; // Growth stage typically 10-20%
    } else if (industry.includes('ecommerce') || industry.includes('retail')) {
      result.gross_margin = 35; // Retail typically 30-40%
      result.operating_margin = 5;
    } else {
      result.gross_margin = 40;
      result.operating_margin = 10;
    }

    result.gross_profit = result.revenue * (result.gross_margin / 100);
    result.operating_income = result.revenue * (result.operating_margin / 100);
  }

  return result;
}

/**
 * Get confidence level for private company estimates
 */
export function getPrivateCompanyEstimateConfidence(signals: {
  employee_count?: number;
  funding_total?: number;
  last_funding_round?: string;
  industry?: string;
}): 'high' | 'medium' | 'low' {
  let dataPoints = 0;

  if (signals.employee_count && signals.employee_count > 0) dataPoints++;
  if (signals.funding_total && signals.funding_total > 0) dataPoints++;
  if (signals.last_funding_round) dataPoints++;
  if (signals.industry) dataPoints++;

  if (dataPoints >= 3) return 'high';
  if (dataPoints >= 2) return 'medium';
  return 'low';
}
