/**
 * Yahoo Finance Source Module
 *
 * Provides: Financials, market data, analyst ratings
 * API: yahoo-finance2 library
 */

import type { SourceModule, SourceResult, YahooFinanceData, SourceOptions } from '../types';

// Domain to ticker mapping
const TICKER_MAP: Record<string, string> = {
  // Big Box Retail
  'walmart.com': 'WMT', 'target.com': 'TGT', 'costco.com': 'COST',
  // Home Improvement
  'homedepot.com': 'HD', 'lowes.com': 'LOW',
  // Electronics
  'bestbuy.com': 'BBY',
  // Department Stores
  'macys.com': 'M', 'nordstrom.com': 'JWN', 'kohls.com': 'KSS',
  // Fashion
  'gap.com': 'GPS', 'nike.com': 'NKE', 'lululemon.com': 'LULU',
  // Luxury
  'coach.com': 'TPR', 'tapestry.com': 'TPR', 'michaelkors.com': 'CPRI',
  // Home & Furniture
  'wayfair.com': 'W', 'williams-sonoma.com': 'WSM', 'rh.com': 'RH',
  // Beauty
  'ulta.com': 'ULTA', 'elfcosmetics.com': 'ELF',
  // Automotive
  'autozone.com': 'AZO', 'oreillyauto.com': 'ORLY', 'advanceautoparts.com': 'AAP',
  // Pet
  'chewy.com': 'CHWY', 'petco.com': 'WOOF',
  // Grocery
  'kroger.com': 'KR', 'albertsons.com': 'ACI',
  // Resale
  'therealreal.com': 'REAL', 'poshmark.com': 'POSH', 'thredup.com': 'TDUP',
  // Sporting Goods
  'dickssportinggoods.com': 'DKS', 'footlocker.com': 'FL',
  // Tech
  'amazon.com': 'AMZN', 'apple.com': 'AAPL', 'shopify.com': 'SHOP',
};

function resolveTicker(domain: string, providedTicker?: string): string | null {
  if (providedTicker) return providedTicker;
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  return TICKER_MAP[normalized] || null;
}

export const yahoofinance: SourceModule<YahooFinanceData> = {
  id: 'yahoofinance',
  name: 'Yahoo Finance',

  // Always available - no API key needed
  isAvailable: () => true,

  async enrich(domain: string, options?: SourceOptions): Promise<SourceResult<YahooFinanceData>> {
    const startTime = Date.now();

    const ticker = resolveTicker(domain, options?.ticker);
    if (!ticker) {
      return {
        source: 'yahoofinance',
        success: false,
        data: null,
        error: 'No ticker found for domain (private company)',
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }

    try {
      // Dynamic import yahoo-finance2 (only when needed)
      const YahooFinance = (await import('yahoo-finance2')).default;
      const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

      // Fetch quote summary with financials
      const result = await yf.quoteSummary(ticker, {
        modules: [
          'summaryProfile',
          'financialData',
          'defaultKeyStatistics',
          'price',
          'incomeStatementHistory',
          'recommendationTrend',
        ],
      });

      const profile = result.summaryProfile || {};
      const financial = result.financialData || {};
      const keyStats = result.defaultKeyStatistics || {};
      const price = result.price || {};
      const income = result.incomeStatementHistory?.incomeStatementHistory || [];
      const recommendations = result.recommendationTrend?.trend?.[0] || {};

      // Build revenue history from income statements
      const revenueHistory = income.slice(0, 3).map((stmt: any) => ({
        year: stmt.endDate ? new Date(stmt.endDate).getFullYear() : 0,
        value: stmt.totalRevenue || 0,
      }));

      const incomeHistory = income.slice(0, 3).map((stmt: any) => ({
        year: stmt.endDate ? new Date(stmt.endDate).getFullYear() : 0,
        value: stmt.netIncome || 0,
      }));

      const data: YahooFinanceData = {
        ticker,
        company_name: price.shortName || price.longName || ticker,
        sector: profile.sector || 'Unknown',
        industry: profile.industry || 'Unknown',
        market_cap: price.marketCap || 0,
        revenue: income[0]?.totalRevenue || 0,
        net_income: income[0]?.netIncome || 0,
        employees: profile.fullTimeEmployees || 0,
        pe_ratio: keyStats.forwardPE || keyStats.trailingPE || 0,
        revenue_growth: financial.revenueGrowth || 0,
        profit_margins: financial.profitMargins || 0,
        revenue_history: revenueHistory,
        income_history: incomeHistory,
        analyst_rating: (recommendations.strongBuy || recommendations.buy) ? {
          buy: (recommendations.strongBuy || 0) + (recommendations.buy || 0),
          hold: recommendations.hold || 0,
          sell: (recommendations.sell || 0) + (recommendations.strongSell || 0),
          target_price: financial.targetMeanPrice || 0,
        } : undefined,
      };

      console.log(`[YahooFinance] ${ticker}: $${(data.revenue / 1e9).toFixed(1)}B revenue (${Date.now() - startTime}ms)`);

      return {
        source: 'yahoofinance',
        success: true,
        data,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[YahooFinance] ${ticker}: ${error}`);

      return {
        source: 'yahoofinance',
        success: false,
        data: null,
        error,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }
  },
};

export default yahoofinance;
