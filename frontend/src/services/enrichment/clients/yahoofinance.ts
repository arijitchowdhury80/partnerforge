/**
 * Yahoo Finance API Client
 *
 * Fetches financial data for public companies using yahoo-finance2 library.
 * Handles authentication automatically.
 *
 * 10 Endpoints:
 * 1. Quote Summary - Company overview, market cap, PE ratio
 * 2. Income Statement - 3-year revenue, profit, net income
 * 3. Balance Sheet - Assets, liabilities, equity
 * 4. Cash Flow - Operating cash flow, capex, free cash flow
 * 5. Quarterly Results - Last 4 quarters with EPS surprise
 * 6. Stock Info - Current price, 52-week range, volume
 * 7. Recommendations - Analyst ratings and price targets
 * 8. Insider Holdings - Institutional and insider ownership
 * 9. News - Recent news articles
 * 10. Historical Prices - 1-year daily price history
 */

import YahooFinance from 'yahoo-finance2';

// v3 requires instantiation with options
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ============================================================================
// Types
// ============================================================================

export interface YahooQuoteSummary {
  ticker: string;
  company_name: string;
  sector: string;
  industry: string;
  employees: number;
  market_cap: number;
  enterprise_value: number;
  pe_ratio: number;
  peg_ratio: number;
  price_to_book: number;
  revenue_growth: number;
  profit_margins: number;
  operating_margins: number;
  return_on_equity: number;
  description: string;
}

export interface YahooIncomeStatement {
  fiscal_year: number;
  fiscal_date: string;
  total_revenue: number;
  cost_of_revenue: number;
  gross_profit: number;
  operating_income: number;
  net_income: number;
  ebitda: number;
  eps_basic: number;
  eps_diluted: number;
}

export interface YahooBalanceSheet {
  fiscal_year: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_debt: number;
  cash_and_equivalents: number;
  current_assets: number;
  current_liabilities: number;
}

export interface YahooCashFlow {
  fiscal_year: number;
  operating_cash_flow: number;
  capital_expenditures: number;
  free_cash_flow: number;
  dividends_paid: number;
}

export interface YahooQuarterlyResult {
  quarter: string; // "Q1 2024"
  revenue: number;
  revenue_yoy_change: number;
  eps_actual: number;
  eps_estimate: number;
  eps_surprise: number;
}

export interface YahooStockInfo {
  ticker: string;
  current_price: number;
  previous_close: number;
  day_change: number;
  day_change_percent: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  volume: number;
  avg_volume: number;
  dividend_yield: number;
  ex_dividend_date: string;
}

export interface YahooAnalystRating {
  firm: string;
  rating: 'Buy' | 'Hold' | 'Sell' | 'Strong Buy' | 'Strong Sell';
  price_target: number;
  date: string;
}

export interface YahooRecommendations {
  strong_buy: number;
  buy: number;
  hold: number;
  sell: number;
  strong_sell: number;
  mean_rating: number;
  target_mean_price: number;
  target_high_price: number;
  target_low_price: number;
  recent_changes: YahooAnalystRating[];
}

export interface YahooHolder {
  name: string;
  shares: number;
  percentage: number;
  value: number;
  date_reported: string;
}

export interface YahooNews {
  title: string;
  publisher: string;
  link: string;
  published_at: string;
  thumbnail?: string;
}

export interface YahooPriceHistory {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooFinancials3Year {
  income_statements: YahooIncomeStatement[];
  balance_sheets: YahooBalanceSheet[];
  cash_flows: YahooCashFlow[];
  quarterly_results: YahooQuarterlyResult[];
  revenue_cagr: number;
  profit_cagr: number;
  margin_trend: 'improving' | 'stable' | 'declining';
}

export interface YahooFinanceFullData {
  quote_summary: YahooQuoteSummary;
  financials_3_year: YahooFinancials3Year;
  stock_info: YahooStockInfo;
  recommendations: YahooRecommendations | null;
  holders: { institutional: YahooHolder[]; insider: YahooHolder[] };
  news: YahooNews[];
  price_history: YahooPriceHistory[];
  fetched_at: string;
}

// ============================================================================
// Domain to Ticker Mapping
// ============================================================================

const DOMAIN_TICKER_MAP: Record<string, string> = {
  // Big Box Retail
  'walmart.com': 'WMT',
  'target.com': 'TGT',
  'costco.com': 'COST',
  'samsclub.com': 'WMT',

  // Home Improvement
  'homedepot.com': 'HD',
  'lowes.com': 'LOW',

  // Electronics
  'bestbuy.com': 'BBY',

  // Department Stores
  'macys.com': 'M',
  'nordstrom.com': 'JWN',
  'kohls.com': 'KSS',
  'dillards.com': 'DDS',

  // Fashion & Apparel
  'gap.com': 'GPS',
  'oldnavy.com': 'GPS',
  'bananarepublic.com': 'GPS',
  'nike.com': 'NKE',
  'underarmour.com': 'UAA',
  'lululemon.com': 'LULU',

  // Luxury
  'coach.com': 'TPR',
  'tapestry.com': 'TPR',
  'katespade.com': 'TPR',
  'stuartweitzman.com': 'TPR',
  'michaelkors.com': 'CPRI',
  'versace.com': 'CPRI',
  'jimmychoo.com': 'CPRI',

  // Home & Furniture
  'wayfair.com': 'W',
  'williams-sonoma.com': 'WSM',
  'potterybarn.com': 'WSM',
  'westelm.com': 'WSM',
  'restorationhardware.com': 'RH',
  'rh.com': 'RH',

  // Beauty & Personal Care
  'ulta.com': 'ULTA',
  'elfcosmetics.com': 'ELF',
  'esteelauder.com': 'EL',
  'sallybeauty.com': 'SBH',

  // Automotive
  'autozone.com': 'AZO',
  'oreillyauto.com': 'ORLY',
  'advanceautoparts.com': 'AAP',
  'carmax.com': 'KMX',
  'autonation.com': 'AN',
  'carvana.com': 'CVNA',

  // Pet & Specialty
  'chewy.com': 'CHWY',
  'petco.com': 'WOOF',

  // Grocery & Food
  'kroger.com': 'KR',
  'albertsons.com': 'ACI',
  'sprouts.com': 'SFM',

  // Electronics & Tech Retail
  'gamestop.com': 'GME',
  'newegg.com': 'NEGG',

  // Luxury Resale
  'therealreal.com': 'REAL',
  'realreal.com': 'REAL',
  'poshmark.com': 'POSH',
  'thredup.com': 'TDUP',

  // Sporting Goods
  'dickssportinggoods.com': 'DKS',
  'academy.com': 'ASO',
  'footlocker.com': 'FL',
  'hibbett.com': 'HIBB',

  // Office & Craft
  'staples.com': 'SPLS',
  'officedepot.com': 'ODP',
  'michaels.com': 'MIK',

  // Big Tech
  'amazon.com': 'AMZN',
  'apple.com': 'AAPL',
  'google.com': 'GOOGL',
  'microsoft.com': 'MSFT',
  'meta.com': 'META',
  'salesforce.com': 'CRM',
  'adobe.com': 'ADBE',
  'shopify.com': 'SHOP',

  // Drugstores
  'cvs.com': 'CVS',
  'walgreens.com': 'WBA',

  // Dollar Stores
  'dollartree.com': 'DLTR',
  'dollargeneral.com': 'DG',
  'fivebelow.com': 'FIVE',

  // Warehouse
  'bjs.com': 'BJ',

  // Fashion
  'abercrombie.com': 'ANF',
  'hollisterco.com': 'ANF',
  'americaneagle.com': 'AEO',
  'aerie.com': 'AEO',
  'urbanoutfitters.com': 'URBN',
  'anthropologie.com': 'URBN',
  'freepeople.com': 'URBN',
};

// ============================================================================
// Yahoo Finance Client Class
// ============================================================================

export class YahooFinanceClient {
  // -------------------------------------------------------------------------
  // Ticker Resolution
  // -------------------------------------------------------------------------

  async resolveTicker(domain: string): Promise<string | null> {
    const normalized = this.normalizeDomain(domain);

    if (DOMAIN_TICKER_MAP[normalized]) {
      return DOMAIN_TICKER_MAP[normalized];
    }

    return null;
  }

  private normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .split('/')[0];
  }

  // -------------------------------------------------------------------------
  // 1. Quote Summary
  // -------------------------------------------------------------------------

  async getQuoteSummary(ticker: string): Promise<YahooQuoteSummary | null> {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics', 'price'],
      });

      const profile = (result.summaryProfile || {}) as any;
      const financial = (result.financialData || {}) as any;
      const keyStats = (result.defaultKeyStatistics || {}) as any;
      const price = (result.price || {}) as any;

      return {
        ticker,
        company_name: price.shortName || price.longName || ticker,
        sector: profile.sector || 'Unknown',
        industry: profile.industry || 'Unknown',
        employees: profile.fullTimeEmployees || 0,
        market_cap: price.marketCap || 0,
        enterprise_value: keyStats.enterpriseValue || 0,
        pe_ratio: keyStats.forwardPE || keyStats.trailingPE || 0,
        peg_ratio: keyStats.pegRatio || 0,
        price_to_book: keyStats.priceToBook || 0,
        revenue_growth: financial.revenueGrowth || 0,
        profit_margins: financial.profitMargins || 0,
        operating_margins: financial.operatingMargins || 0,
        return_on_equity: financial.returnOnEquity || 0,
        description: profile.longBusinessSummary || '',
      };
    } catch (error) {
      console.error(`Quote summary error for ${ticker}:`, error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 2. Income Statements
  // -------------------------------------------------------------------------

  async getIncomeStatements(ticker: string, years: number = 3): Promise<YahooIncomeStatement[]> {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['incomeStatementHistory'],
      });

      const statements = result.incomeStatementHistory?.incomeStatementHistory || [];

      return statements.slice(0, years).map((stmt: any) => ({
        fiscal_year: stmt.endDate ? new Date(stmt.endDate).getFullYear() : 0,
        fiscal_date: stmt.endDate?.toISOString?.() || String(stmt.endDate) || '',
        total_revenue: stmt.totalRevenue || 0,
        cost_of_revenue: stmt.costOfRevenue || 0,
        gross_profit: stmt.grossProfit || 0,
        operating_income: stmt.operatingIncome || 0,
        net_income: stmt.netIncome || 0,
        ebitda: stmt.ebitda || 0,
        eps_basic: 0,
        eps_diluted: 0,
      }));
    } catch (error) {
      console.error(`Income statement error for ${ticker}:`, error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 3. Balance Sheets
  // -------------------------------------------------------------------------

  async getBalanceSheets(ticker: string, years: number = 3): Promise<YahooBalanceSheet[]> {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['balanceSheetHistory'],
      });

      const sheets = result.balanceSheetHistory?.balanceSheetStatements || [];

      return sheets.slice(0, years).map((sheet: any) => ({
        fiscal_year: sheet.endDate ? new Date(sheet.endDate).getFullYear() : 0,
        total_assets: sheet.totalAssets || 0,
        total_liabilities: sheet.totalLiab || 0,
        total_equity: sheet.totalStockholderEquity || 0,
        total_debt: (sheet.longTermDebt || 0) + (sheet.shortLongTermDebt || 0),
        cash_and_equivalents: sheet.cash || 0,
        current_assets: sheet.totalCurrentAssets || 0,
        current_liabilities: sheet.totalCurrentLiabilities || 0,
      }));
    } catch (error) {
      console.error(`Balance sheet error for ${ticker}:`, error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 4. Cash Flows
  // -------------------------------------------------------------------------

  async getCashFlows(ticker: string, years: number = 3): Promise<YahooCashFlow[]> {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['cashflowStatementHistory'],
      });

      const flows = result.cashflowStatementHistory?.cashflowStatements || [];

      return flows.slice(0, years).map((flow: any) => ({
        fiscal_year: flow.endDate ? new Date(flow.endDate).getFullYear() : 0,
        operating_cash_flow: flow.totalCashFromOperatingActivities || 0,
        capital_expenditures: Math.abs(flow.capitalExpenditures || 0),
        free_cash_flow: (flow.totalCashFromOperatingActivities || 0) - Math.abs(flow.capitalExpenditures || 0),
        dividends_paid: Math.abs(flow.dividendsPaid || 0),
      }));
    } catch (error) {
      console.error(`Cash flow error for ${ticker}:`, error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 5. Quarterly Results
  // -------------------------------------------------------------------------

  async getQuarterlyResults(ticker: string): Promise<YahooQuarterlyResult[]> {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['earningsHistory', 'earnings'],
      });

      const history = result.earningsHistory?.history || [];

      const results: YahooQuarterlyResult[] = [];

      for (let i = 0; i < Math.min(history.length, 4); i++) {
        const h = history[i];
        const date = h.quarter ? new Date(h.quarter) : new Date();
        const quarterNum = Math.ceil((date.getMonth() + 1) / 3);

        results.push({
          quarter: `Q${quarterNum} ${date.getFullYear()}`,
          revenue: 0,
          revenue_yoy_change: 0,
          eps_actual: h.epsActual || 0,
          eps_estimate: h.epsEstimate || 0,
          eps_surprise: h.epsDifference || 0,
        });
      }

      return results;
    } catch (error) {
      console.error(`Quarterly results error for ${ticker}:`, error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 6. Stock Info
  // -------------------------------------------------------------------------

  async getStockInfo(ticker: string): Promise<YahooStockInfo | null> {
    try {
      const quote = await yahooFinance.quote(ticker);

      return {
        ticker,
        current_price: quote.regularMarketPrice || 0,
        previous_close: quote.regularMarketPreviousClose || 0,
        day_change: quote.regularMarketChange || 0,
        day_change_percent: quote.regularMarketChangePercent || 0,
        fifty_two_week_high: quote.fiftyTwoWeekHigh || 0,
        fifty_two_week_low: quote.fiftyTwoWeekLow || 0,
        volume: quote.regularMarketVolume || 0,
        avg_volume: quote.averageDailyVolume10Day || 0,
        dividend_yield: quote.dividendYield || 0,
        ex_dividend_date: '',
      };
    } catch (error) {
      console.error(`Stock info error for ${ticker}:`, error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 7. Recommendations
  // -------------------------------------------------------------------------

  async getRecommendations(ticker: string): Promise<YahooRecommendations | null> {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['recommendationTrend', 'financialData'],
      });

      const trend = (result.recommendationTrend?.trend?.[0] || {}) as any;
      const financialData = (result.financialData || {}) as any;

      return {
        strong_buy: trend.strongBuy || 0,
        buy: trend.buy || 0,
        hold: trend.hold || 0,
        sell: trend.sell || 0,
        strong_sell: trend.strongSell || 0,
        mean_rating: 0,
        target_mean_price: financialData.targetMeanPrice || 0,
        target_high_price: financialData.targetHighPrice || 0,
        target_low_price: financialData.targetLowPrice || 0,
        recent_changes: [],
      };
    } catch (error) {
      console.error(`Recommendations error for ${ticker}:`, error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 8. Holders
  // -------------------------------------------------------------------------

  async getHolders(ticker: string): Promise<{ institutional: YahooHolder[]; insider: YahooHolder[] }> {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['institutionOwnership', 'insiderHolders'],
      });

      const institutional = (result.institutionOwnership?.ownershipList || []).map((h: any) => ({
        name: h.organization || '',
        shares: h.position || 0,
        percentage: h.pctHeld || 0,
        value: h.value || 0,
        date_reported: '',
      }));

      const insider = (result.insiderHolders?.holders || []).map((h: any) => ({
        name: h.name || '',
        shares: h.positionDirect || 0,
        percentage: 0,
        value: 0,
        date_reported: '',
      }));

      return { institutional, insider };
    } catch (error) {
      console.error(`Holders error for ${ticker}:`, error);
      return { institutional: [], insider: [] };
    }
  }

  // -------------------------------------------------------------------------
  // 9. News
  // -------------------------------------------------------------------------

  async getNews(ticker: string, limit: number = 10): Promise<YahooNews[]> {
    try {
      const result = await yahooFinance.search(ticker, { newsCount: limit });

      return (result.news || []).map((n: any) => ({
        title: n.title || '',
        publisher: n.publisher || '',
        link: n.link || '',
        published_at: '',
        thumbnail: n.thumbnail?.resolutions?.[0]?.url,
      }));
    } catch (error) {
      console.error(`News error for ${ticker}:`, error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 10. Price History
  // -------------------------------------------------------------------------

  async getPriceHistory(
    ticker: string,
    range: '1m' | '3m' | '6m' | '1y' | '5y' = '1y'
  ): Promise<YahooPriceHistory[]> {
    try {
      const period1 = new Date();
      switch (range) {
        case '1m': period1.setMonth(period1.getMonth() - 1); break;
        case '3m': period1.setMonth(period1.getMonth() - 3); break;
        case '6m': period1.setMonth(period1.getMonth() - 6); break;
        case '1y': period1.setFullYear(period1.getFullYear() - 1); break;
        case '5y': period1.setFullYear(period1.getFullYear() - 5); break;
      }

      const result = await yahooFinance.chart(ticker, {
        period1,
        interval: '1d',
      });

      const quotes = result.quotes || [];

      return quotes.map((q: any) => ({
        date: q.date?.toISOString?.() || '',
        open: q.open || 0,
        high: q.high || 0,
        low: q.low || 0,
        close: q.close || 0,
        volume: q.volume || 0,
      }));
    } catch (error) {
      console.error(`Price history error for ${ticker}:`, error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Aggregated: 3-Year Financials
  // -------------------------------------------------------------------------

  async getFinancials3Year(ticker: string): Promise<YahooFinancials3Year | null> {
    try {
      const [incomeStatements, balanceSheets, cashFlows, quarterlyResults] = await Promise.all([
        this.getIncomeStatements(ticker, 3),
        this.getBalanceSheets(ticker, 3),
        this.getCashFlows(ticker, 3),
        this.getQuarterlyResults(ticker),
      ]);

      if (incomeStatements.length === 0) return null;

      // Calculate revenue CAGR
      const revenues = incomeStatements.map(s => s.total_revenue).filter(r => r > 0);
      const revenueCAGR = this.calculateCAGR(revenues);

      // Calculate profit CAGR
      const profits = incomeStatements.map(s => s.net_income).filter(p => p > 0);
      const profitCAGR = this.calculateCAGR(profits);

      // Determine margin trend
      const margins = incomeStatements.map(s =>
        s.total_revenue > 0 ? s.operating_income / s.total_revenue : 0
      ).filter(m => m !== 0);
      const marginTrend = this.determineTrend(margins);

      return {
        income_statements: incomeStatements,
        balance_sheets: balanceSheets,
        cash_flows: cashFlows,
        quarterly_results: quarterlyResults,
        revenue_cagr: revenueCAGR,
        profit_cagr: profitCAGR,
        margin_trend: marginTrend,
      };
    } catch (error) {
      console.error('Error fetching 3-year financials:', error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Full Data by Domain
  // -------------------------------------------------------------------------

  async getFullDataByDomain(domain: string): Promise<YahooFinanceFullData | null> {
    const ticker = await this.resolveTicker(domain);
    if (!ticker) {
      console.log(`No ticker found for domain: ${domain}`);
      return null;
    }

    try {
      const [
        quoteSummary,
        financials3Year,
        stockInfo,
        recommendations,
        holders,
        news,
        priceHistory,
      ] = await Promise.all([
        this.getQuoteSummary(ticker),
        this.getFinancials3Year(ticker),
        this.getStockInfo(ticker),
        this.getRecommendations(ticker),
        this.getHolders(ticker),
        this.getNews(ticker, 5),
        this.getPriceHistory(ticker, '1y'),
      ]);

      if (!quoteSummary || !financials3Year || !stockInfo) {
        console.log(`Incomplete data for ticker: ${ticker}`);
        return null;
      }

      return {
        quote_summary: quoteSummary,
        financials_3_year: financials3Year,
        stock_info: stockInfo,
        recommendations,
        holders,
        news,
        price_history: priceHistory,
        fetched_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching full data:', error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private calculateCAGR(values: number[]): number {
    if (values.length < 2) return 0;
    const first = values[values.length - 1];
    const last = values[0];
    const years = values.length - 1;
    if (first <= 0 || last <= 0) return 0;
    return Math.pow(last / first, 1 / years) - 1;
  }

  private determineTrend(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable';
    const first = values[values.length - 1];
    const last = values[0];
    const change = (last - first) / Math.abs(first);
    if (change > 0.05) return 'improving';
    if (change < -0.05) return 'declining';
    return 'stable';
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const yahooFinanceClient = new YahooFinanceClient();
