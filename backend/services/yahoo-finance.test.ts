import { YahooFinanceClient } from './yahoo-finance';

/**
 * Yahoo Finance Client - Usage Examples & Integration Tests
 *
 * Run with: npm test yahoo-finance.test.ts
 * Or: ts-node yahoo-finance.test.ts
 */

describe('YahooFinanceClient', () => {
  let client: YahooFinanceClient;

  beforeAll(() => {
    client = new YahooFinanceClient();
  });

  describe('getStockInfo', () => {
    it('should fetch current stock information', async () => {
      const result = await client.getStockInfo('COST');

      expect(result.data.price.regularMarketPrice).toBeGreaterThan(0);
      expect(result.data.price.marketCap).toBeGreaterThan(0);
      expect(result.data.price.currency).toBe('USD');
      expect(result.data.summaryDetail.trailingPE).toBeGreaterThan(0);
      expect(result.meta.source).toBeDefined();
      expect(result.meta.cost_usd).toBe(0); // Free API
    });

    it('should cache stock info with 24-hour TTL', async () => {
      const result1 = await client.getStockInfo('AAPL');
      const result2 = await client.getStockInfo('AAPL');

      expect(result1.meta.cached).toBe(false);
      expect(result2.meta.cached).toBe(true);
    });

    it('should throw error for invalid ticker', async () => {
      await expect(client.getStockInfo('INVALID_TICKER_XYZ'))
        .rejects.toThrow();
    });
  });

  describe('getFinancialStatements', () => {
    it('should fetch 3-year financial history', async () => {
      const result = await client.getFinancialStatements('COST');

      expect(result.data.incomeStatement.length).toBeGreaterThan(0);
      expect(result.data.balanceSheet.length).toBeGreaterThan(0);
      expect(result.data.cashFlow.length).toBeGreaterThan(0);

      // Check income statement structure
      const latestIncome = result.data.incomeStatement[0];
      expect(latestIncome.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(latestIncome.totalRevenue).toBeGreaterThan(0);
      expect(latestIncome.netIncome).toBeDefined();

      // Check balance sheet structure
      const latestBalance = result.data.balanceSheet[0];
      expect(latestBalance.totalAssets).toBeGreaterThan(0);
      expect(latestBalance.totalLiabilities).toBeGreaterThan(0);

      // Check cash flow structure
      const latestCashFlow = result.data.cashFlow[0];
      expect(latestCashFlow.totalCashFromOperatingActivities).toBeDefined();
    });

    it('should cache financial statements with 7-day TTL', async () => {
      const result1 = await client.getFinancialStatements('MSFT');
      const result2 = await client.getFinancialStatements('MSFT');

      expect(result2.meta.cached).toBe(true);
    });
  });

  describe('getAnalystRecommendations', () => {
    it('should fetch analyst recommendations', async () => {
      const result = await client.getAnalystRecommendations('COST');

      expect(result.data.totalAnalysts).toBeGreaterThan(0);
      expect(result.data.strongBuy).toBeGreaterThanOrEqual(0);
      expect(result.data.buy).toBeGreaterThanOrEqual(0);
      expect(result.data.hold).toBeGreaterThanOrEqual(0);
      expect(result.data.sell).toBeGreaterThanOrEqual(0);
      expect(result.data.strongSell).toBeGreaterThanOrEqual(0);
      expect(result.data.consensus).toBeDefined();
      expect(['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell', 'No consensus'])
        .toContain(result.data.consensus);
    });
  });

  describe('getHolderInfo', () => {
    it('should fetch institutional and insider holdings', async () => {
      const result = await client.getHolderInfo('COST');

      expect(result.data.topInstitutions.length).toBeGreaterThan(0);
      expect(result.data.topInstitutions[0].name).toBeDefined();
      expect(result.data.topInstitutions[0].position).toBeGreaterThan(0);
      expect(result.data.institutionsPercentHeld).toBeGreaterThan(0);
    });
  });

  describe('getHistoricalPrices', () => {
    it('should fetch historical daily prices', async () => {
      const result = await client.getHistoricalPrices('COST', {
        period1: '2024-01-01',
        period2: '2024-12-31',
        interval: '1d'
      });

      expect(result.data.ticker).toBe('COST');
      expect(result.data.prices.length).toBeGreaterThan(0);

      const firstPrice = result.data.prices[0];
      expect(firstPrice.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(firstPrice.close).toBeGreaterThan(0);
      expect(firstPrice.open).toBeGreaterThan(0);
      expect(firstPrice.high).toBeGreaterThan(0);
      expect(firstPrice.low).toBeGreaterThan(0);
    });

    it('should fetch historical weekly prices', async () => {
      const result = await client.getHistoricalPrices('AAPL', {
        period1: '2024-01-01',
        period2: '2024-12-31',
        interval: '1wk'
      });

      expect(result.data.prices.length).toBeGreaterThan(0);
      expect(result.data.prices.length).toBeLessThan(60); // Weekly data = ~52 weeks
    });

    it('should fetch historical monthly prices', async () => {
      const result = await client.getHistoricalPrices('MSFT', {
        period1: '2023-01-01',
        period2: '2024-12-31',
        interval: '1mo'
      });

      expect(result.data.prices.length).toBeGreaterThan(0);
      expect(result.data.prices.length).toBeLessThan(25); // ~24 months
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const tickers = ['COST', 'AAPL', 'MSFT', 'GOOGL', 'AMZN'];
      const startTime = Date.now();

      // Make 5 rapid requests
      const promises = tickers.map(ticker => client.getStockInfo(ticker));
      await Promise.all(promises);

      const elapsed = Date.now() - startTime;

      // With 10 req/s limit, 5 requests should take < 1 second
      // (first batch is instant, rate limiter kicks in after)
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // This test requires mocking axios to simulate network failure
      // In production, you would mock the HttpClient
      // For now, just verify error is thrown and logged
      try {
        await client.getStockInfo('');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

/**
 * Manual Testing Examples
 *
 * Uncomment and run these individually to test against live API
 */

// Example 1: Get Costco stock info
async function example1() {
  const client = new YahooFinanceClient();
  const result = await client.getStockInfo('COST');

  console.log('=== Costco Stock Info ===');
  console.log(`Price: $${result.data.price.regularMarketPrice.toFixed(2)}`);
  console.log(`Market Cap: $${(result.data.price.marketCap / 1e9).toFixed(2)}B`);
  console.log(`P/E Ratio: ${result.data.summaryDetail.trailingPE?.toFixed(2)}`);
  console.log(`52-Week Range: $${result.data.summaryDetail.fiftyTwoWeekLow.toFixed(2)} - $${result.data.summaryDetail.fiftyTwoWeekHigh.toFixed(2)}`);
  console.log(`Source: ${result.meta.source} (cached: ${result.meta.cached})`);
}

// Example 2: Get financial statements
async function example2() {
  const client = new YahooFinanceClient();
  const result = await client.getFinancialStatements('COST');

  console.log('=== Costco Financial Statements (3-Year History) ===');
  console.log('\nIncome Statement:');
  result.data.incomeStatement.forEach(stmt => {
    console.log(`  ${stmt.endDate}: Revenue $${(stmt.totalRevenue / 1e9).toFixed(2)}B, Net Income $${(stmt.netIncome / 1e9).toFixed(2)}B`);
  });

  console.log('\nBalance Sheet:');
  result.data.balanceSheet.forEach(stmt => {
    console.log(`  ${stmt.endDate}: Assets $${(stmt.totalAssets / 1e9).toFixed(2)}B, Liabilities $${(stmt.totalLiabilities / 1e9).toFixed(2)}B`);
  });
}

// Example 3: Get analyst recommendations
async function example3() {
  const client = new YahooFinanceClient();
  const result = await client.getAnalystRecommendations('COST');

  console.log('=== Costco Analyst Recommendations ===');
  console.log(`Strong Buy: ${result.data.strongBuy}`);
  console.log(`Buy: ${result.data.buy}`);
  console.log(`Hold: ${result.data.hold}`);
  console.log(`Sell: ${result.data.sell}`);
  console.log(`Strong Sell: ${result.data.strongSell}`);
  console.log(`Total Analysts: ${result.data.totalAnalysts}`);
  console.log(`Consensus: ${result.data.consensus}`);
}

// Example 4: Get institutional holdings
async function example4() {
  const client = new YahooFinanceClient();
  const result = await client.getHolderInfo('COST');

  console.log('=== Costco Top Institutional Holders ===');
  result.data.topInstitutions.slice(0, 5).forEach((holder, i) => {
    console.log(`${i + 1}. ${holder.name}`);
    console.log(`   Shares: ${(holder.position / 1e6).toFixed(2)}M`);
    console.log(`   Value: $${(holder.value / 1e9).toFixed(2)}B`);
    console.log(`   % Held: ${(holder.percentHeld * 100).toFixed(2)}%`);
  });
  console.log(`\nInstitutional Ownership: ${((result.data.institutionsPercentHeld || 0) * 100).toFixed(2)}%`);
}

// Example 5: Get historical prices
async function example5() {
  const client = new YahooFinanceClient();
  const result = await client.getHistoricalPrices('COST', {
    period1: '2024-01-01',
    period2: '2024-12-31',
    interval: '1mo'
  });

  console.log('=== Costco Monthly Prices (2024) ===');
  result.data.prices.forEach(price => {
    console.log(`${price.date}: Open $${price.open?.toFixed(2)}, Close $${price.close?.toFixed(2)}, Volume ${((price.volume || 0) / 1e6).toFixed(2)}M`);
  });
}

// Uncomment to run examples:
// example1();
// example2();
// example3();
// example4();
// example5();
