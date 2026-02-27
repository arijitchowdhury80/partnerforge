/**
 * Yahoo Finance API Client Tests
 *
 * Tests all 10 endpoints + ticker resolution + helper functions
 * Uses vi.mock to mock the yahoo-finance2 library (v3 API)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create hoisted mocks that can be accessed inside vi.mock
const { mockQuoteSummary, mockQuote, mockSearch, mockChart } = vi.hoisted(() => ({
  mockQuoteSummary: vi.fn(),
  mockQuote: vi.fn(),
  mockSearch: vi.fn(),
  mockChart: vi.fn(),
}));

// Mock the yahoo-finance2 module
vi.mock('yahoo-finance2', () => ({
  default: class YahooFinance {
    quoteSummary = mockQuoteSummary;
    quote = mockQuote;
    search = mockSearch;
    chart = mockChart;
  },
}));

// Import the client after mocking
import {
  YahooFinanceClient,
  yahooFinanceClient,
  YahooQuoteSummary,
  YahooIncomeStatement,
  YahooBalanceSheet,
  YahooCashFlow,
  YahooQuarterlyResult,
  YahooStockInfo,
  YahooRecommendations,
  YahooHolder,
  YahooNews,
  YahooPriceHistory,
} from '../clients/yahoofinance';

// ============================================================================
// Mock Data - Matching yahoo-finance2 v3 response format
// ============================================================================

const mockQuoteSummaryData = {
  summaryProfile: {
    sector: 'Consumer Defensive',
    industry: 'Discount Stores',
    fullTimeEmployees: 316000,
    longBusinessSummary: 'Costco Wholesale Corporation operates membership warehouses...',
  },
  financialData: {
    revenueGrowth: 0.12,
    profitMargins: 0.025,
    operatingMargins: 0.035,
    returnOnEquity: 0.28,
    targetMeanPrice: 950.00,
    targetHighPrice: 1050.00,
    targetLowPrice: 850.00,
  },
  defaultKeyStatistics: {
    enterpriseValue: 400000000000,
    forwardPE: 48.5,
    trailingPE: 52.3,
    pegRatio: 4.2,
    priceToBook: 14.5,
  },
  price: {
    shortName: 'Costco Wholesale Corporation',
    longName: 'Costco Wholesale Corporation',
    marketCap: 395000000000,
  },
};

const mockIncomeStatementData = {
  incomeStatementHistory: {
    incomeStatementHistory: [
      {
        endDate: new Date('2024-08-31'),
        totalRevenue: 242290000000,
        costOfRevenue: 210990000000,
        grossProfit: 31300000000,
        operatingIncome: 8500000000,
        netIncome: 6292000000,
        ebitda: 12000000000,
      },
      {
        endDate: new Date('2023-08-31'),
        totalRevenue: 226954000000,
        costOfRevenue: 197527000000,
        grossProfit: 29427000000,
        operatingIncome: 7800000000,
        netIncome: 5844000000,
        ebitda: 11200000000,
      },
      {
        endDate: new Date('2022-08-31'),
        totalRevenue: 222730000000,
        costOfRevenue: 193963000000,
        grossProfit: 28767000000,
        operatingIncome: 7410000000,
        netIncome: 5007000000,
        ebitda: 10500000000,
      },
    ],
  },
};

const mockBalanceSheetData = {
  balanceSheetHistory: {
    balanceSheetStatements: [
      {
        endDate: new Date('2024-08-31'),
        totalAssets: 68994000000,
        totalLiab: 44689000000,
        totalStockholderEquity: 24305000000,
        longTermDebt: 6472000000,
        shortLongTermDebt: 1000000000,
        cash: 13700000000,
        totalCurrentAssets: 30200000000,
        totalCurrentLiabilities: 32022000000,
      },
    ],
  },
};

const mockCashFlowData = {
  cashflowStatementHistory: {
    cashflowStatements: [
      {
        endDate: new Date('2024-08-31'),
        totalCashFromOperatingActivities: 11068000000,
        capitalExpenditures: -4710000000,
        dividendsPaid: -1750000000,
      },
    ],
  },
};

const mockEarningsData = {
  earningsHistory: {
    history: [
      { quarter: new Date('2024-06-30'), epsActual: 3.78, epsEstimate: 3.65, epsDifference: 0.13 },
      { quarter: new Date('2024-03-31'), epsActual: 3.43, epsEstimate: 3.30, epsDifference: 0.13 },
      { quarter: new Date('2023-12-31'), epsActual: 3.35, epsEstimate: 3.20, epsDifference: 0.15 },
      { quarter: new Date('2023-09-30'), epsActual: 3.58, epsEstimate: 3.40, epsDifference: 0.18 },
    ],
  },
};

const mockRecommendationData = {
  recommendationTrend: {
    trend: [{ strongBuy: 8, buy: 15, hold: 5, sell: 1, strongSell: 0 }],
  },
  financialData: {
    targetMeanPrice: 950.00,
    targetHighPrice: 1050.00,
    targetLowPrice: 850.00,
  },
};

const mockHoldersData = {
  institutionOwnership: {
    ownershipList: [
      { organization: 'Vanguard Group Inc', position: 35000000, pctHeld: 0.079, value: 31150000000 },
      { organization: 'BlackRock Inc', position: 30000000, pctHeld: 0.068, value: 26700000000 },
    ],
  },
  insiderHolders: {
    holders: [
      { name: 'Craig Jelinek', positionDirect: 50000 },
    ],
  },
};

const mockQuoteData = {
  regularMarketPrice: 890.50,
  regularMarketPreviousClose: 885.20,
  regularMarketChange: 5.30,
  regularMarketChangePercent: 0.60,
  fiftyTwoWeekHigh: 920.00,
  fiftyTwoWeekLow: 650.00,
  regularMarketVolume: 1500000,
  averageDailyVolume10Day: 1800000,
  dividendYield: 0.0052,
};

const mockSearchData = {
  news: [
    { title: 'Costco Beats Q4 Earnings', publisher: 'Reuters', link: 'https://example.com/1' },
    { title: 'Costco Plans Expansion', publisher: 'Bloomberg', link: 'https://example.com/2' },
  ],
};

const mockChartData = {
  quotes: [
    { date: new Date('2024-01-01'), open: 885, high: 892, low: 880, close: 890, volume: 1500000 },
    { date: new Date('2024-01-02'), open: 890, high: 895, low: 885, close: 892, volume: 1600000 },
    { date: new Date('2024-01-03'), open: 888, high: 893, low: 882, close: 890.5, volume: 1450000 },
  ],
};

// ============================================================================
// Tests
// ============================================================================

describe('YahooFinanceClient', () => {
  let client: YahooFinanceClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new YahooFinanceClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Ticker Resolution
  // ==========================================================================

  describe('resolveTicker', () => {
    it('should resolve costco.com to COST', async () => {
      const ticker = await client.resolveTicker('costco.com');
      expect(ticker).toBe('COST');
    });

    it('should resolve www.costco.com to COST', async () => {
      const ticker = await client.resolveTicker('www.costco.com');
      expect(ticker).toBe('COST');
    });

    it('should resolve https://costco.com to COST', async () => {
      const ticker = await client.resolveTicker('https://costco.com');
      expect(ticker).toBe('COST');
    });

    it('should resolve walmart.com to WMT', async () => {
      const ticker = await client.resolveTicker('walmart.com');
      expect(ticker).toBe('WMT');
    });

    it('should return null for unknown domains', async () => {
      const ticker = await client.resolveTicker('unknown-company.com');
      expect(ticker).toBeNull();
    });

    it('should handle URLs with paths', async () => {
      const ticker = await client.resolveTicker('https://costco.com/products/electronics');
      expect(ticker).toBe('COST');
    });
  });

  // ==========================================================================
  // Quote Summary
  // ==========================================================================

  describe('getQuoteSummary', () => {
    it('should return company profile data', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockQuoteSummaryData);

      const result = await client.getQuoteSummary('COST');

      expect(result).not.toBeNull();
      expect(result?.company_name).toBe('Costco Wholesale Corporation');
      expect(result?.sector).toBe('Consumer Defensive');
      expect(result?.industry).toBe('Discount Stores');
    });

    it('should include employee count', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockQuoteSummaryData);

      const result = await client.getQuoteSummary('COST');

      expect(result?.employees).toBe(316000);
    });

    it('should include market cap and enterprise value', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockQuoteSummaryData);

      const result = await client.getQuoteSummary('COST');

      expect(result?.market_cap).toBe(395000000000);
      expect(result?.enterprise_value).toBe(400000000000);
    });

    it('should include valuation ratios', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockQuoteSummaryData);

      const result = await client.getQuoteSummary('COST');

      expect(result?.pe_ratio).toBe(48.5);
      expect(result?.peg_ratio).toBe(4.2);
      expect(result?.price_to_book).toBe(14.5);
    });

    it('should include financial metrics', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockQuoteSummaryData);

      const result = await client.getQuoteSummary('COST');

      expect(result?.revenue_growth).toBe(0.12);
      expect(result?.profit_margins).toBe(0.025);
      expect(result?.operating_margins).toBe(0.035);
      expect(result?.return_on_equity).toBe(0.28);
    });

    it('should return null on error', async () => {
      mockQuoteSummary.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getQuoteSummary('INVALID');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Income Statements
  // ==========================================================================

  describe('getIncomeStatements', () => {
    it('should return 3 years of income data', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockIncomeStatementData);

      const result = await client.getIncomeStatements('COST', 3);

      expect(result).toHaveLength(3);
    });

    it('should include revenue, gross profit, and net income', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockIncomeStatementData);

      const result = await client.getIncomeStatements('COST');
      const latest = result[0];

      expect(latest.total_revenue).toBe(242290000000);
      expect(latest.gross_profit).toBe(31300000000);
      expect(latest.net_income).toBe(6292000000);
    });

    it('should include fiscal year and date', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockIncomeStatementData);

      const result = await client.getIncomeStatements('COST');
      const latest = result[0];

      expect(latest.fiscal_year).toBe(2024);
      expect(latest.fiscal_date).toContain('2024');
    });

    it('should include operating income and EBITDA', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockIncomeStatementData);

      const result = await client.getIncomeStatements('COST');
      const latest = result[0];

      expect(latest.operating_income).toBe(8500000000);
      expect(latest.ebitda).toBe(12000000000);
    });

    it('should include EPS', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockIncomeStatementData);

      const result = await client.getIncomeStatements('COST');
      const latest = result[0];

      // EPS is 0 since the mock data doesn't include it
      expect(latest.eps_basic).toBeDefined();
      expect(latest.eps_diluted).toBeDefined();
    });

    it('should return empty array on error', async () => {
      mockQuoteSummary.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getIncomeStatements('INVALID');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Balance Sheets
  // ==========================================================================

  describe('getBalanceSheets', () => {
    it('should return assets, liabilities, equity', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockBalanceSheetData);

      const result = await client.getBalanceSheets('COST');
      const latest = result[0];

      expect(latest.total_assets).toBe(68994000000);
      expect(latest.total_liabilities).toBe(44689000000);
      expect(latest.total_equity).toBe(24305000000);
    });

    it('should include debt and cash', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockBalanceSheetData);

      const result = await client.getBalanceSheets('COST');
      const latest = result[0];

      expect(latest.total_debt).toBe(7472000000); // long-term + short-term
      expect(latest.cash_and_equivalents).toBe(13700000000);
    });

    it('should include current assets and liabilities', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockBalanceSheetData);

      const result = await client.getBalanceSheets('COST');
      const latest = result[0];

      expect(latest.current_assets).toBe(30200000000);
      expect(latest.current_liabilities).toBe(32022000000);
    });

    it('should return empty array on error', async () => {
      mockQuoteSummary.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getBalanceSheets('INVALID');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Cash Flows
  // ==========================================================================

  describe('getCashFlows', () => {
    it('should return operating cash flow', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockCashFlowData);

      const result = await client.getCashFlows('COST');
      const latest = result[0];

      expect(latest.operating_cash_flow).toBe(11068000000);
    });

    it('should calculate free cash flow', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockCashFlowData);

      const result = await client.getCashFlows('COST');
      const latest = result[0];

      // FCF = Operating CF - CapEx
      expect(latest.free_cash_flow).toBe(11068000000 - 4710000000);
    });

    it('should include capital expenditures as positive number', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockCashFlowData);

      const result = await client.getCashFlows('COST');
      const latest = result[0];

      expect(latest.capital_expenditures).toBe(4710000000);
    });

    it('should include dividends paid', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockCashFlowData);

      const result = await client.getCashFlows('COST');
      const latest = result[0];

      expect(latest.dividends_paid).toBe(1750000000);
    });
  });

  // ==========================================================================
  // Quarterly Results
  // ==========================================================================

  describe('getQuarterlyResults', () => {
    it('should return up to 4 quarters', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockEarningsData);

      const result = await client.getQuarterlyResults('COST');

      expect(result.length).toBeLessThanOrEqual(4);
    });

    it('should include EPS actual and estimate', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockEarningsData);

      const result = await client.getQuarterlyResults('COST');
      const latest = result[0];

      expect(latest.eps_actual).toBe(3.78);
      expect(latest.eps_estimate).toBe(3.65);
    });

    it('should include EPS surprise', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockEarningsData);

      const result = await client.getQuarterlyResults('COST');
      const latest = result[0];

      expect(latest.eps_surprise).toBe(0.13);
    });

    it('should format quarter label', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockEarningsData);

      const result = await client.getQuarterlyResults('COST');
      const latest = result[0];

      expect(latest.quarter).toMatch(/Q[1-4] \d{4}/);
    });
  });

  // ==========================================================================
  // Stock Info
  // ==========================================================================

  describe('getStockInfo', () => {
    it('should return current price', async () => {
      mockQuote.mockResolvedValueOnce(mockQuoteData);

      const result = await client.getStockInfo('COST');

      expect(result?.current_price).toBe(890.50);
    });

    it('should include day change', async () => {
      mockQuote.mockResolvedValueOnce(mockQuoteData);

      const result = await client.getStockInfo('COST');

      expect(result?.day_change).toBe(5.30);
      expect(result?.day_change_percent).toBe(0.60);
    });

    it('should include 52-week range', async () => {
      mockQuote.mockResolvedValueOnce(mockQuoteData);

      const result = await client.getStockInfo('COST');

      expect(result?.fifty_two_week_high).toBe(920.00);
      expect(result?.fifty_two_week_low).toBe(650.00);
    });

    it('should include volume', async () => {
      mockQuote.mockResolvedValueOnce(mockQuoteData);

      const result = await client.getStockInfo('COST');

      expect(result?.volume).toBe(1500000);
      expect(result?.avg_volume).toBe(1800000);
    });

    it('should return null on error', async () => {
      mockQuote.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getStockInfo('INVALID');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Recommendations
  // ==========================================================================

  describe('getRecommendations', () => {
    it('should return analyst rating counts', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockRecommendationData);

      const result = await client.getRecommendations('COST');

      expect(result?.strong_buy).toBe(8);
      expect(result?.buy).toBe(15);
      expect(result?.hold).toBe(5);
      expect(result?.sell).toBe(1);
      expect(result?.strong_sell).toBe(0);
    });

    it('should include price targets', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockRecommendationData);

      const result = await client.getRecommendations('COST');

      expect(result?.target_mean_price).toBe(950.00);
      expect(result?.target_high_price).toBe(1050.00);
      expect(result?.target_low_price).toBe(850.00);
    });

    it('should return null on error', async () => {
      mockQuoteSummary.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getRecommendations('INVALID');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Holders
  // ==========================================================================

  describe('getHolders', () => {
    it('should return institutional holders', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockHoldersData);

      const result = await client.getHolders('COST');

      expect(result.institutional.length).toBeGreaterThan(0);
      expect(result.institutional[0].name).toBe('Vanguard Group Inc');
    });

    it('should return insider holders', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockHoldersData);

      const result = await client.getHolders('COST');

      expect(result.insider.length).toBeGreaterThan(0);
      expect(result.insider[0].name).toBe('Craig Jelinek');
    });

    it('should include holder details', async () => {
      mockQuoteSummary.mockResolvedValueOnce(mockHoldersData);

      const result = await client.getHolders('COST');
      const vanguard = result.institutional[0];

      expect(vanguard.shares).toBe(35000000);
      expect(vanguard.percentage).toBe(0.079);
      expect(vanguard.value).toBe(31150000000);
    });

    it('should return empty arrays on error', async () => {
      mockQuoteSummary.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getHolders('INVALID');

      expect(result.institutional).toEqual([]);
      expect(result.insider).toEqual([]);
    });
  });

  // ==========================================================================
  // News
  // ==========================================================================

  describe('getNews', () => {
    it('should return news articles', async () => {
      mockSearch.mockResolvedValueOnce(mockSearchData);

      const result = await client.getNews('COST');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should include article details', async () => {
      mockSearch.mockResolvedValueOnce(mockSearchData);

      const result = await client.getNews('COST');
      const article = result[0];

      expect(article.title).toBe('Costco Beats Q4 Earnings');
      expect(article.publisher).toBe('Reuters');
      expect(article.link).toBe('https://example.com/1');
    });

    it('should return empty array on error', async () => {
      mockSearch.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getNews('INVALID');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Price History
  // ==========================================================================

  describe('getPriceHistory', () => {
    it('should return price history', async () => {
      mockChart.mockResolvedValueOnce(mockChartData);

      const result = await client.getPriceHistory('COST');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should include OHLCV data', async () => {
      mockChart.mockResolvedValueOnce(mockChartData);

      const result = await client.getPriceHistory('COST');
      const day = result[0];

      expect(day.open).toBe(885);
      expect(day.high).toBe(892);
      expect(day.low).toBe(880);
      expect(day.close).toBe(890);
      expect(day.volume).toBe(1500000);
    });

    it('should return empty array on error', async () => {
      mockChart.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getPriceHistory('INVALID');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Financials 3 Year
  // ==========================================================================

  describe('getFinancials3Year', () => {
    it('should aggregate 3 years of financial data', async () => {
      mockQuoteSummary
        .mockResolvedValueOnce(mockIncomeStatementData)
        .mockResolvedValueOnce(mockBalanceSheetData)
        .mockResolvedValueOnce(mockCashFlowData)
        .mockResolvedValueOnce(mockEarningsData);

      const result = await client.getFinancials3Year('COST');

      expect(result).not.toBeNull();
      expect(result?.income_statements.length).toBe(3);
    });

    it('should calculate revenue CAGR', async () => {
      mockQuoteSummary
        .mockResolvedValueOnce(mockIncomeStatementData)
        .mockResolvedValueOnce(mockBalanceSheetData)
        .mockResolvedValueOnce(mockCashFlowData)
        .mockResolvedValueOnce(mockEarningsData);

      const result = await client.getFinancials3Year('COST');

      expect(result?.revenue_cagr).toBeGreaterThan(0);
    });

    it('should calculate profit CAGR', async () => {
      mockQuoteSummary
        .mockResolvedValueOnce(mockIncomeStatementData)
        .mockResolvedValueOnce(mockBalanceSheetData)
        .mockResolvedValueOnce(mockCashFlowData)
        .mockResolvedValueOnce(mockEarningsData);

      const result = await client.getFinancials3Year('COST');

      expect(result?.profit_cagr).toBeGreaterThan(0);
    });

    it('should determine margin trend', async () => {
      mockQuoteSummary
        .mockResolvedValueOnce(mockIncomeStatementData)
        .mockResolvedValueOnce(mockBalanceSheetData)
        .mockResolvedValueOnce(mockCashFlowData)
        .mockResolvedValueOnce(mockEarningsData);

      const result = await client.getFinancials3Year('COST');

      expect(['improving', 'stable', 'declining']).toContain(result?.margin_trend);
    });

    it('should return null on error', async () => {
      mockQuoteSummary.mockRejectedValueOnce(new Error('API error'));

      const result = await client.getFinancials3Year('INVALID');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Full Data by Domain
  // ==========================================================================

  describe('getFullDataByDomain', () => {
    it('should return null for unknown domain', async () => {
      const result = await client.getFullDataByDomain('unknown-company.com');

      expect(result).toBeNull();
    });

    it('should return full data for known domain', async () => {
      mockQuoteSummary
        .mockResolvedValue(mockQuoteSummaryData);
      mockQuote.mockResolvedValue(mockQuoteData);
      mockSearch.mockResolvedValue(mockSearchData);
      mockChart.mockResolvedValue(mockChartData);

      // Override for specific modules
      mockQuoteSummary
        .mockResolvedValueOnce(mockQuoteSummaryData) // quoteSummary
        .mockResolvedValueOnce(mockIncomeStatementData) // getFinancials3Year - income
        .mockResolvedValueOnce(mockBalanceSheetData) // getFinancials3Year - balance
        .mockResolvedValueOnce(mockCashFlowData) // getFinancials3Year - cash
        .mockResolvedValueOnce(mockEarningsData) // getFinancials3Year - earnings
        .mockResolvedValueOnce(mockRecommendationData) // recommendations
        .mockResolvedValueOnce(mockHoldersData); // holders

      const result = await client.getFullDataByDomain('costco.com');

      expect(result).not.toBeNull();
      expect(result?.quote_summary).toBeDefined();
      expect(result?.stock_info).toBeDefined();
      expect(result?.fetched_at).toBeDefined();
    });
  });
});

// ==========================================================================
// Singleton Export
// ==========================================================================

describe('yahooFinanceClient singleton', () => {
  it('should be an instance of YahooFinanceClient', () => {
    expect(yahooFinanceClient).toBeInstanceOf(YahooFinanceClient);
  });
});
