import { HttpClient } from './http-client';
import { config } from '../config';
import { APIResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * Yahoo Finance Client
 *
 * Provides access to financial data via Yahoo Finance API.
 *
 * Features:
 * - Stock quotes and market data
 * - Financial statements (3-year history)
 * - Analyst recommendations
 * - Institutional holdings
 * - Historical price data
 *
 * Rate Limiting: 10 req/s (configurable)
 * Caching: 7 days default, 24 hours for stock quotes
 * Cost: Free (unofficial API)
 */
export class YahooFinanceClient {
  private http: HttpClient;
  private readonly baseURL = 'https://query2.finance.yahoo.com';
  private readonly rateLimitKey = 'yahoo-finance';

  constructor() {
    this.http = new HttpClient(
      this.baseURL,
      config.redis.cacheTTL, // 7 days default
      30000 // 30s timeout
    );
    logger.info('YahooFinanceClient initialized');
  }

  /**
   * Get current stock information
   *
   * Returns current price, market cap, P/E ratio, and 52-week range.
   * Cache TTL: 24 hours (more dynamic than other financial data)
   *
   * @param ticker - Stock ticker symbol (e.g., "COST", "AAPL")
   * @returns Stock information including price, market cap, P/E ratios
   *
   * @example
   * ```typescript
   * const client = new YahooFinanceClient();
   * const stockInfo = await client.getStockInfo('COST');
   * console.log(`Current price: $${stockInfo.data.price.regularMarketPrice}`);
   * console.log(`Market cap: $${stockInfo.data.price.marketCap}`);
   * console.log(`P/E ratio: ${stockInfo.data.summaryDetail.trailingPE}`);
   * ```
   */
  async getStockInfo(ticker: string): Promise<APIResponse<StockInfo>> {
    logger.debug(`Fetching stock info for ${ticker}`);

    try {
      const response = await this.http.get<YahooQuoteSummaryResponse>(
        `/v10/finance/quoteSummary/${ticker}`,
        {
          modules: 'price,summaryDetail,financialData'
        },
        {
          rateLimitKey: this.rateLimitKey,
          cacheTTL: 86400 // 24 hours
        }
      );

      const result = response.data.quoteSummary?.result?.[0];
      if (!result) {
        throw new Error(`No data found for ticker ${ticker}`);
      }

      const stockInfo: StockInfo = {
        price: {
          regularMarketPrice: result.price?.regularMarketPrice?.raw || 0,
          regularMarketChange: result.price?.regularMarketChange?.raw || 0,
          regularMarketChangePercent: result.price?.regularMarketChangePercent?.raw || 0,
          marketCap: result.price?.marketCap?.raw || 0,
          currency: result.price?.currency || 'USD'
        },
        summaryDetail: {
          trailingPE: result.summaryDetail?.trailingPE?.raw || null,
          forwardPE: result.summaryDetail?.forwardPE?.raw || null,
          fiftyTwoWeekHigh: result.summaryDetail?.fiftyTwoWeekHigh?.raw || 0,
          fiftyTwoWeekLow: result.summaryDetail?.fiftyTwoWeekLow?.raw || 0,
          dividendYield: result.summaryDetail?.dividendYield?.raw || null,
          beta: result.summaryDetail?.beta?.raw || null
        },
        financialData: {
          currentPrice: result.financialData?.currentPrice?.raw || 0,
          targetHighPrice: result.financialData?.targetHighPrice?.raw || null,
          targetLowPrice: result.financialData?.targetLowPrice?.raw || null,
          targetMeanPrice: result.financialData?.targetMeanPrice?.raw || null,
          recommendationKey: result.financialData?.recommendationKey || null
        }
      };

      return {
        data: stockInfo,
        meta: {
          ...response.meta,
          cost_usd: 0 // Free API
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch stock info for ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Get financial statements
   *
   * Returns 3-year history of income statement, balance sheet, and cash flow.
   * Cache TTL: 7 days
   *
   * @param ticker - Stock ticker symbol
   * @returns Financial statements with 3-year history
   *
   * @example
   * ```typescript
   * const client = new YahooFinanceClient();
   * const financials = await client.getFinancialStatements('COST');
   * financials.data.incomeStatement.forEach(statement => {
   *   console.log(`${statement.endDate}: Revenue $${statement.totalRevenue}`);
   * });
   * ```
   */
  async getFinancialStatements(ticker: string): Promise<APIResponse<FinancialStatements>> {
    logger.debug(`Fetching financial statements for ${ticker}`);

    try {
      const response = await this.http.get<YahooQuoteSummaryResponse>(
        `/v10/finance/quoteSummary/${ticker}`,
        {
          modules: 'incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory'
        },
        {
          rateLimitKey: this.rateLimitKey
        }
      );

      const result = response.data.quoteSummary?.result?.[0];
      if (!result) {
        throw new Error(`No financial statements found for ticker ${ticker}`);
      }

      const statements: FinancialStatements = {
        incomeStatement: (result.incomeStatementHistory?.incomeStatementHistory || []).map(stmt => ({
          endDate: new Date(stmt.endDate?.raw * 1000).toISOString().split('T')[0],
          totalRevenue: stmt.totalRevenue?.raw || 0,
          costOfRevenue: stmt.costOfRevenue?.raw || null,
          grossProfit: stmt.grossProfit?.raw || null,
          operatingIncome: stmt.operatingIncome?.raw || null,
          ebitda: stmt.ebitda?.raw || null,
          netIncome: stmt.netIncome?.raw || 0,
          netIncomeApplicableToCommonShares: stmt.netIncomeApplicableToCommonShares?.raw || null
        })),
        balanceSheet: (result.balanceSheetHistory?.balanceSheetStatements || []).map(stmt => ({
          endDate: new Date(stmt.endDate?.raw * 1000).toISOString().split('T')[0],
          totalAssets: stmt.totalAssets?.raw || 0,
          totalLiabilities: stmt.totalLiab?.raw || 0,
          totalStockholderEquity: stmt.totalStockholderEquity?.raw || 0,
          cash: stmt.cash?.raw || null,
          totalCurrentAssets: stmt.totalCurrentAssets?.raw || null,
          totalCurrentLiabilities: stmt.totalCurrentLiabilities?.raw || null
        })),
        cashFlow: (result.cashflowStatementHistory?.cashflowStatements || []).map(stmt => ({
          endDate: new Date(stmt.endDate?.raw * 1000).toISOString().split('T')[0],
          totalCashFromOperatingActivities: stmt.totalCashFromOperatingActivities?.raw || 0,
          totalCashFromInvestingActivities: stmt.totalCashflowsFromInvestingActivities?.raw || null,
          totalCashFromFinancingActivities: stmt.totalCashFromFinancingActivities?.raw || null,
          changeInCash: stmt.changeInCash?.raw || null,
          capitalExpenditures: stmt.capitalExpenditures?.raw || null,
          freeCashFlow: stmt.freeCashFlow?.raw || null
        }))
      };

      return {
        data: statements,
        meta: {
          ...response.meta,
          cost_usd: 0
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch financial statements for ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Get analyst recommendations
   *
   * Returns current analyst ratings (buy/hold/sell) with historical trends.
   * Cache TTL: 7 days
   *
   * @param ticker - Stock ticker symbol
   * @returns Analyst recommendations with buy/hold/sell counts
   *
   * @example
   * ```typescript
   * const client = new YahooFinanceClient();
   * const recs = await client.getAnalystRecommendations('COST');
   * console.log(`Buy: ${recs.data.strongBuy + recs.data.buy}`);
   * console.log(`Hold: ${recs.data.hold}`);
   * console.log(`Sell: ${recs.data.sell + recs.data.strongSell}`);
   * ```
   */
  async getAnalystRecommendations(ticker: string): Promise<APIResponse<AnalystRecommendations>> {
    logger.debug(`Fetching analyst recommendations for ${ticker}`);

    try {
      const response = await this.http.get<YahooRecommendationResponse>(
        `/v6/finance/recommendationsbysymbol/${ticker}`,
        {},
        {
          rateLimitKey: this.rateLimitKey
        }
      );

      const finance = response.data.finance;
      if (!finance || !finance.result || finance.result.length === 0) {
        throw new Error(`No analyst recommendations found for ticker ${ticker}`);
      }

      const latest = finance.result[0]; // Most recent recommendation
      const recommendations: AnalystRecommendations = {
        period: latest.period || 'Unknown',
        strongBuy: latest.strongBuy || 0,
        buy: latest.buy || 0,
        hold: latest.hold || 0,
        sell: latest.sell || 0,
        strongSell: latest.strongSell || 0,
        totalAnalysts: (latest.strongBuy || 0) + (latest.buy || 0) + (latest.hold || 0) +
                      (latest.sell || 0) + (latest.strongSell || 0),
        consensus: this.calculateConsensus(latest)
      };

      return {
        data: recommendations,
        meta: {
          ...response.meta,
          cost_usd: 0
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch analyst recommendations for ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Get institutional and insider holdings
   *
   * Returns top institutional holders and insider ownership percentages.
   * Cache TTL: 7 days
   *
   * @param ticker - Stock ticker symbol
   * @returns Holder information including top institutional investors
   *
   * @example
   * ```typescript
   * const client = new YahooFinanceClient();
   * const holders = await client.getHolderInfo('COST');
   * console.log(`Top holder: ${holders.data.topInstitutions[0].name}`);
   * console.log(`Insider ownership: ${holders.data.insiderPercentHeld}%`);
   * ```
   */
  async getHolderInfo(ticker: string): Promise<APIResponse<HolderInfo>> {
    logger.debug(`Fetching holder info for ${ticker}`);

    try {
      const response = await this.http.get<YahooQuoteSummaryResponse>(
        `/v10/finance/quoteSummary/${ticker}`,
        {
          modules: 'institutionOwnership,insiderHolders,majorHoldersBreakdown'
        },
        {
          rateLimitKey: this.rateLimitKey
        }
      );

      const result = response.data.quoteSummary?.result?.[0];
      if (!result) {
        throw new Error(`No holder information found for ticker ${ticker}`);
      }

      const holderInfo: HolderInfo = {
        topInstitutions: (result.institutionOwnership?.ownershipList || [])
          .slice(0, 10)
          .map(holder => ({
            name: holder.organization || 'Unknown',
            position: holder.position?.raw || 0,
            value: holder.value?.raw || 0,
            percentHeld: holder.pctHeld?.raw || 0,
            reportDate: holder.reportDate?.fmt || null
          })),
        insiderPercentHeld: result.majorHoldersBreakdown?.insidersPercentHeld?.raw || null,
        institutionsPercentHeld: result.majorHoldersBreakdown?.institutionsPercentHeld?.raw || null,
        institutionsCount: result.majorHoldersBreakdown?.institutionsCount?.raw || null
      };

      return {
        data: holderInfo,
        meta: {
          ...response.meta,
          cost_usd: 0
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch holder info for ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Get historical stock prices
   *
   * Returns daily/weekly/monthly price history for specified date range.
   * Cache TTL: 7 days
   *
   * @param ticker - Stock ticker symbol
   * @param options - Date range and interval options
   * @returns Historical price data
   *
   * @example
   * ```typescript
   * const client = new YahooFinanceClient();
   * const history = await client.getHistoricalPrices('COST', {
   *   period1: '2023-01-01',
   *   period2: '2024-01-01',
   *   interval: '1d'
   * });
   * history.data.prices.forEach(price => {
   *   console.log(`${price.date}: $${price.close}`);
   * });
   * ```
   */
  async getHistoricalPrices(
    ticker: string,
    options: HistoricalPriceOptions
  ): Promise<APIResponse<HistoricalPrices>> {
    logger.debug(`Fetching historical prices for ${ticker}`, options);

    try {
      // Convert date strings to Unix timestamps
      const period1 = Math.floor(new Date(options.period1).getTime() / 1000);
      const period2 = Math.floor(new Date(options.period2).getTime() / 1000);

      const response = await this.http.get<YahooChartResponse>(
        `/v8/finance/chart/${ticker}`,
        {
          period1,
          period2,
          interval: options.interval || '1d',
          events: 'div,split'
        },
        {
          rateLimitKey: this.rateLimitKey
        }
      );

      const chart = response.data.chart?.result?.[0];
      if (!chart) {
        throw new Error(`No historical data found for ticker ${ticker}`);
      }

      const timestamps = chart.timestamp || [];
      const quotes = chart.indicators?.quote?.[0];

      if (!quotes) {
        throw new Error(`No quote data found for ticker ${ticker}`);
      }

      const prices: HistoricalPrices = {
        ticker,
        prices: timestamps.map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().split('T')[0],
          open: quotes.open?.[i] || null,
          high: quotes.high?.[i] || null,
          low: quotes.low?.[i] || null,
          close: quotes.close?.[i] || null,
          volume: quotes.volume?.[i] || null,
          adjClose: chart.indicators?.adjclose?.[0]?.adjclose?.[i] || null
        })).filter(p => p.close !== null) // Filter out null entries
      };

      return {
        data: prices,
        meta: {
          ...response.meta,
          cost_usd: 0
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch historical prices for ${ticker}`, error);
      throw error;
    }
  }

  /**
   * Calculate consensus recommendation from analyst ratings
   * @private
   */
  private calculateConsensus(rec: any): string {
    const strongBuy = rec.strongBuy || 0;
    const buy = rec.buy || 0;
    const hold = rec.hold || 0;
    const sell = rec.sell || 0;
    const strongSell = rec.strongSell || 0;

    const total = strongBuy + buy + hold + sell + strongSell;
    if (total === 0) return 'No consensus';

    // Calculate weighted score (1 = Strong Buy, 5 = Strong Sell)
    const score = (strongBuy * 1 + buy * 2 + hold * 3 + sell * 4 + strongSell * 5) / total;

    if (score <= 1.5) return 'Strong Buy';
    if (score <= 2.5) return 'Buy';
    if (score <= 3.5) return 'Hold';
    if (score <= 4.5) return 'Sell';
    return 'Strong Sell';
  }
}

// ===== Type Definitions =====

/**
 * Stock information response
 */
export interface StockInfo {
  price: {
    regularMarketPrice: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    marketCap: number;
    currency: string;
  };
  summaryDetail: {
    trailingPE: number | null;
    forwardPE: number | null;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    dividendYield: number | null;
    beta: number | null;
  };
  financialData: {
    currentPrice: number;
    targetHighPrice: number | null;
    targetLowPrice: number | null;
    targetMeanPrice: number | null;
    recommendationKey: string | null;
  };
}

/**
 * Financial statements (3-year history)
 */
export interface FinancialStatements {
  incomeStatement: Array<{
    endDate: string;
    totalRevenue: number;
    costOfRevenue: number | null;
    grossProfit: number | null;
    operatingIncome: number | null;
    ebitda: number | null;
    netIncome: number;
    netIncomeApplicableToCommonShares: number | null;
  }>;
  balanceSheet: Array<{
    endDate: string;
    totalAssets: number;
    totalLiabilities: number;
    totalStockholderEquity: number;
    cash: number | null;
    totalCurrentAssets: number | null;
    totalCurrentLiabilities: number | null;
  }>;
  cashFlow: Array<{
    endDate: string;
    totalCashFromOperatingActivities: number;
    totalCashFromInvestingActivities: number | null;
    totalCashFromFinancingActivities: number | null;
    changeInCash: number | null;
    capitalExpenditures: number | null;
    freeCashFlow: number | null;
  }>;
}

/**
 * Analyst recommendations
 */
export interface AnalystRecommendations {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
  consensus: string;
}

/**
 * Institutional and insider holdings
 */
export interface HolderInfo {
  topInstitutions: Array<{
    name: string;
    position: number;
    value: number;
    percentHeld: number;
    reportDate: string | null;
  }>;
  insiderPercentHeld: number | null;
  institutionsPercentHeld: number | null;
  institutionsCount: number | null;
}

/**
 * Historical price options
 */
export interface HistoricalPriceOptions {
  period1: string; // Start date (YYYY-MM-DD)
  period2: string; // End date (YYYY-MM-DD)
  interval?: '1d' | '1wk' | '1mo'; // Default: '1d'
}

/**
 * Historical price data
 */
export interface HistoricalPrices {
  ticker: string;
  prices: Array<{
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    adjClose: number | null;
  }>;
}

// ===== Yahoo Finance API Response Types =====

interface YahooQuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      price?: any;
      summaryDetail?: any;
      financialData?: any;
      incomeStatementHistory?: any;
      balanceSheetHistory?: any;
      cashflowStatementHistory?: any;
      institutionOwnership?: any;
      insiderHolders?: any;
      majorHoldersBreakdown?: any;
    }>;
    error?: any;
  };
}

interface YahooRecommendationResponse {
  finance: {
    result: Array<{
      symbol: string;
      period: string;
      strongBuy: number;
      buy: number;
      hold: number;
      sell: number;
      strongSell: number;
    }>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
        adjclose?: Array<{
          adjclose: (number | null)[];
        }>;
      };
    }>;
    error?: any;
  };
}
