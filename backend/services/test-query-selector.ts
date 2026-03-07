/**
 * Test Query Selector
 *
 * Generates vertical-calibrated test queries based on company industry.
 * Produces 12-15 queries spanning simple, multi-word, NLP, typo, synonym, and zero-results types.
 *
 * Verticals Supported:
 * - Retail (e-commerce, fashion, consumer goods)
 * - Marketplace (multi-vendor, B2C)
 * - B2B (enterprise software, SaaS)
 * - Publishing (media, content, news)
 * - Travel (hotels, flights, booking)
 * - Default (fallback for unknown industries)
 */

/**
 * Test query definition
 */
export interface TestQuery {
  query: string;
  type: 'simple' | 'multi-word' | 'nlp' | 'typo' | 'synonym' | 'zero-results' | 'brand' | 'filter';
  expectedMinResults?: number;
  expectedContains?: string[];
  expectedExcludes?: string[];
  vertical: string;
}

/**
 * Query template for vertical
 */
interface QueryTemplate {
  query: string;
  type: TestQuery['type'];
  expectedMinResults?: number;
  expectedContains?: string[];
  expectedExcludes?: string[];
}

/**
 * Company context (minimal data needed for query generation)
 */
interface CompanyContext {
  industry?: string;
  vertical?: string;
  products?: string[];
  categories?: string[];
}

/**
 * Detect vertical from industry string
 */
function detectVertical(industry?: string): string {
  if (!industry) return 'default';

  const normalized = industry.toLowerCase();

  // Retail patterns
  if (normalized.match(/retail|e-commerce|ecommerce|fashion|apparel|clothing|consumer goods|shopping/)) {
    return 'retail';
  }

  // Marketplace patterns
  if (normalized.match(/marketplace|multi-vendor|platform|aggregator/)) {
    return 'marketplace';
  }

  // B2B patterns
  if (normalized.match(/b2b|enterprise|saas|software|business services|professional services/)) {
    return 'b2b';
  }

  // Publishing patterns
  if (normalized.match(/publishing|media|news|content|magazine|journalism/)) {
    return 'publishing';
  }

  // Travel patterns
  if (normalized.match(/travel|tourism|hotel|flight|booking|hospitality/)) {
    return 'travel';
  }

  return 'default';
}

/**
 * Query templates by vertical
 */
const QUERY_TEMPLATES: Record<string, QueryTemplate[]> = {
  retail: [
    // Simple (product names, categories)
    { query: 'dress', type: 'simple', expectedMinResults: 10 },
    { query: 'shoes', type: 'simple', expectedMinResults: 10 },
    { query: 'jacket', type: 'simple', expectedMinResults: 5 },

    // Multi-word (with modifiers)
    { query: 'red dress', type: 'multi-word', expectedMinResults: 5, expectedContains: ['red', 'dress'] },
    { query: 'womens running shoes', type: 'multi-word', expectedMinResults: 5, expectedContains: ['shoes'] },
    { query: 'leather jacket black', type: 'multi-word', expectedMinResults: 3, expectedContains: ['leather', 'jacket'] },

    // NLP (natural language with intent)
    { query: 'best gift for mom under 100', type: 'nlp', expectedMinResults: 1, expectedContains: ['gift'] },
    { query: 'dress for wedding guest', type: 'nlp', expectedMinResults: 1, expectedContains: ['dress'] },
    { query: 'shoes for wide feet', type: 'nlp', expectedMinResults: 1, expectedContains: ['shoes'] },

    // Typo
    { query: 'sheos', type: 'typo', expectedMinResults: 1 }, // Should suggest "shoes"
    { query: 'jaket', type: 'typo', expectedMinResults: 1 }, // Should suggest "jacket"

    // Synonym
    { query: 'sneakers', type: 'synonym', expectedMinResults: 5 }, // vs "shoes"
    { query: 'blouse', type: 'synonym', expectedMinResults: 3 }, // vs "shirt"

    // Brand
    { query: 'nike', type: 'brand', expectedMinResults: 5, expectedContains: ['nike'] },

    // Zero-results
    { query: 'xyzabc123', type: 'zero-results', expectedMinResults: 0 },
  ],

  marketplace: [
    // Simple
    { query: 'laptop', type: 'simple', expectedMinResults: 10 },
    { query: 'furniture', type: 'simple', expectedMinResults: 10 },
    { query: 'phone', type: 'simple', expectedMinResults: 10 },

    // Multi-word
    { query: 'gaming laptop under 1500', type: 'multi-word', expectedMinResults: 3, expectedContains: ['laptop'] },
    { query: 'outdoor furniture set', type: 'multi-word', expectedMinResults: 3, expectedContains: ['furniture'] },
    { query: 'iphone 15 pro max', type: 'multi-word', expectedMinResults: 1, expectedContains: ['iphone'] },

    // NLP
    { query: 'best laptop for students', type: 'nlp', expectedMinResults: 1, expectedContains: ['laptop'] },
    { query: 'affordable furniture for small apartment', type: 'nlp', expectedMinResults: 1, expectedContains: ['furniture'] },
    { query: 'phone with best camera under 500', type: 'nlp', expectedMinResults: 1, expectedContains: ['phone', 'camera'] },

    // Typo
    { query: 'laptp', type: 'typo', expectedMinResults: 1 },
    { query: 'furnture', type: 'typo', expectedMinResults: 1 },

    // Synonym
    { query: 'sofa', type: 'synonym', expectedMinResults: 3 }, // vs "couch"
    { query: 'mobile', type: 'synonym', expectedMinResults: 5 }, // vs "phone"

    // Brand
    { query: 'apple', type: 'brand', expectedMinResults: 5, expectedContains: ['apple'] },

    // Zero-results
    { query: 'qwerty999', type: 'zero-results', expectedMinResults: 0 },
  ],

  b2b: [
    // Simple
    { query: 'crm', type: 'simple', expectedMinResults: 5 },
    { query: 'analytics', type: 'simple', expectedMinResults: 5 },
    { query: 'integration', type: 'simple', expectedMinResults: 5 },

    // Multi-word
    { query: 'customer data platform', type: 'multi-word', expectedMinResults: 2, expectedContains: ['customer', 'data'] },
    { query: 'email marketing automation', type: 'multi-word', expectedMinResults: 2, expectedContains: ['email', 'marketing'] },
    { query: 'api integration tools', type: 'multi-word', expectedMinResults: 2, expectedContains: ['api', 'integration'] },

    // NLP
    { query: 'best crm for small business', type: 'nlp', expectedMinResults: 1, expectedContains: ['crm'] },
    { query: 'how to integrate salesforce', type: 'nlp', expectedMinResults: 1, expectedContains: ['salesforce', 'integrate'] },
    { query: 'what is customer lifetime value', type: 'nlp', expectedMinResults: 1 },

    // Typo
    { query: 'analitycs', type: 'typo', expectedMinResults: 1 },
    { query: 'intergration', type: 'typo', expectedMinResults: 1 },

    // Synonym
    { query: 'dashboard', type: 'synonym', expectedMinResults: 3 }, // vs "analytics"
    { query: 'connector', type: 'synonym', expectedMinResults: 3 }, // vs "integration"

    // Brand
    { query: 'salesforce', type: 'brand', expectedMinResults: 2, expectedContains: ['salesforce'] },

    // Zero-results
    { query: 'xyz789enterprise', type: 'zero-results', expectedMinResults: 0 },
  ],

  publishing: [
    // Simple
    { query: 'politics', type: 'simple', expectedMinResults: 10 },
    { query: 'technology', type: 'simple', expectedMinResults: 10 },
    { query: 'sports', type: 'simple', expectedMinResults: 10 },

    // Multi-word
    { query: 'artificial intelligence news', type: 'multi-word', expectedMinResults: 5, expectedContains: ['intelligence'] },
    { query: 'climate change articles', type: 'multi-word', expectedMinResults: 5, expectedContains: ['climate'] },
    { query: 'nba playoffs schedule', type: 'multi-word', expectedMinResults: 3, expectedContains: ['nba', 'playoffs'] },

    // NLP
    { query: 'what happened in ukraine today', type: 'nlp', expectedMinResults: 1 },
    { query: 'how does ai work', type: 'nlp', expectedMinResults: 1, expectedContains: ['ai'] },
    { query: 'best articles about productivity', type: 'nlp', expectedMinResults: 1, expectedContains: ['productivity'] },

    // Typo
    { query: 'tecnology', type: 'typo', expectedMinResults: 1 },
    { query: 'articls', type: 'typo', expectedMinResults: 1 },

    // Synonym
    { query: 'soccer', type: 'synonym', expectedMinResults: 5 }, // vs "football"
    { query: 'AI', type: 'synonym', expectedMinResults: 5 }, // vs "artificial intelligence"

    // Author/Brand
    { query: 'john smith', type: 'brand', expectedMinResults: 1 },

    // Zero-results
    { query: 'xxyyzz999', type: 'zero-results', expectedMinResults: 0 },
  ],

  travel: [
    // Simple
    { query: 'hotels', type: 'simple', expectedMinResults: 10 },
    { query: 'flights', type: 'simple', expectedMinResults: 10 },
    { query: 'vacation', type: 'simple', expectedMinResults: 10 },

    // Multi-word
    { query: 'hotels in paris', type: 'multi-word', expectedMinResults: 5, expectedContains: ['hotel', 'paris'] },
    { query: 'flights to tokyo', type: 'multi-word', expectedMinResults: 3, expectedContains: ['flight', 'tokyo'] },
    { query: 'beach resorts caribbean', type: 'multi-word', expectedMinResults: 5, expectedContains: ['beach', 'resort'] },

    // NLP
    { query: 'best time to visit italy', type: 'nlp', expectedMinResults: 1, expectedContains: ['italy'] },
    { query: 'cheap hotels near times square', type: 'nlp', expectedMinResults: 1, expectedContains: ['hotel', 'times square'] },
    { query: 'family friendly resorts all inclusive', type: 'nlp', expectedMinResults: 1, expectedContains: ['family', 'resort'] },

    // Typo
    { query: 'hotles', type: 'typo', expectedMinResults: 1 },
    { query: 'flghts', type: 'typo', expectedMinResults: 1 },

    // Synonym
    { query: 'accommodation', type: 'synonym', expectedMinResults: 5 }, // vs "hotels"
    { query: 'trip', type: 'synonym', expectedMinResults: 5 }, // vs "vacation"

    // Brand
    { query: 'marriott', type: 'brand', expectedMinResults: 3, expectedContains: ['marriott'] },

    // Zero-results
    { query: 'xyz123destination', type: 'zero-results', expectedMinResults: 0 },
  ],

  default: [
    // Simple
    { query: 'search', type: 'simple', expectedMinResults: 5 },
    { query: 'product', type: 'simple', expectedMinResults: 5 },
    { query: 'service', type: 'simple', expectedMinResults: 5 },

    // Multi-word
    { query: 'search results page', type: 'multi-word', expectedMinResults: 2, expectedContains: ['search'] },
    { query: 'product features list', type: 'multi-word', expectedMinResults: 2, expectedContains: ['product', 'features'] },
    { query: 'customer service contact', type: 'multi-word', expectedMinResults: 2, expectedContains: ['service', 'contact'] },

    // NLP
    { query: 'how do I find products', type: 'nlp', expectedMinResults: 1 },
    { query: 'what are the best features', type: 'nlp', expectedMinResults: 1, expectedContains: ['features'] },
    { query: 'where is customer support', type: 'nlp', expectedMinResults: 1, expectedContains: ['support'] },

    // Typo
    { query: 'serach', type: 'typo', expectedMinResults: 1 },
    { query: 'prodcut', type: 'typo', expectedMinResults: 1 },

    // Synonym
    { query: 'item', type: 'synonym', expectedMinResults: 3 }, // vs "product"
    { query: 'help', type: 'synonym', expectedMinResults: 3 }, // vs "support"

    // Brand
    { query: 'company name', type: 'brand', expectedMinResults: 1 },

    // Zero-results
    { query: 'aabbccdd999', type: 'zero-results', expectedMinResults: 0 },
  ],
};

/**
 * Generate 12-15 vertical-calibrated test queries
 */
export async function generateTestQueries(
  companyId: string,
  auditId: string,
  companyContext: CompanyContext
): Promise<TestQuery[]> {
  // 1. Detect vertical from industry
  const vertical = detectVertical(companyContext.industry);

  // 2. Get query templates for vertical
  const templates = QUERY_TEMPLATES[vertical] || QUERY_TEMPLATES.default;

  // 3. Select diverse query mix (12-15 total)
  const queries: TestQuery[] = [];

  // Distribution:
  // - 3 simple queries
  // - 3 multi-word queries
  // - 3 NLP queries
  // - 2 typo queries
  // - 1 synonym query
  // - 1 brand query
  // - 1 zero-results query

  const typeDistribution: Record<string, number> = {
    simple: 3,
    'multi-word': 3,
    nlp: 3,
    typo: 2,
    synonym: 1,
    brand: 1,
    'zero-results': 1,
  };

  for (const [type, count] of Object.entries(typeDistribution)) {
    const templatesOfType = templates.filter(t => t.type === type);

    // Select 'count' random templates
    const selected = templatesOfType
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    for (const template of selected) {
      queries.push({
        query: template.query,
        type: template.type as TestQuery['type'],
        expectedMinResults: template.expectedMinResults,
        expectedContains: template.expectedContains,
        expectedExcludes: template.expectedExcludes,
        vertical,
      });
    }
  }

  return queries;
}

/**
 * Store queries in database
 */
export async function storeTestQueries(
  companyId: string,
  auditId: string,
  queries: TestQuery[]
): Promise<void> {
  // NOTE: This would use a database client (Supabase, Postgres, etc.)
  // For now, this is a placeholder showing the expected interface

  /*
  const client = getDBClient();

  for (const query of queries) {
    await client.from('search_test_queries').insert({
      company_id: companyId,
      audit_id: auditId,
      query: query.query,
      query_type: query.type,
      expected_min_results: query.expectedMinResults,
      expected_contains: query.expectedContains,
      expected_excludes: query.expectedExcludes,
      vertical: query.vertical,
    });
  }
  */

  console.log(`Would store ${queries.length} queries for audit ${auditId}`);
}

/**
 * Get stored queries for an audit
 */
export async function getTestQueries(
  companyId: string,
  auditId: string
): Promise<TestQuery[]> {
  // NOTE: This would fetch from database
  // For now, return empty array

  /*
  const client = getDBClient();
  const { data, error } = await client
    .from('search_test_queries')
    .select('*')
    .eq('company_id', companyId)
    .eq('audit_id', auditId);

  if (error) throw error;

  return data.map(row => ({
    query: row.query,
    type: row.query_type,
    expectedMinResults: row.expected_min_results,
    expectedContains: row.expected_contains,
    expectedExcludes: row.expected_excludes,
    vertical: row.vertical,
  }));
  */

  return [];
}

/**
 * Generate queries for a specific test
 * Maps test IDs to appropriate query types
 */
export function getQueriesForTest(testId: string, allQueries: TestQuery[]): string[] {
  const queryTypeMap: Record<string, TestQuery['type'][]> = {
    '2a': [], // Homepage - no query
    '2b': [], // Empty search - no query
    '2c': ['simple'],
    '2d': ['multi-word'],
    '2e': ['simple', 'brand'],
    '2f': ['typo'],
    '2g': ['synonym'],
    '2h': ['multi-word', 'filter'],
    '2i': ['nlp'],
    '2j': ['brand'],
    '2k': ['zero-results'],
    '2l': ['simple'], // Mobile - simple query
    '2m': ['simple'], // SAYT - partial query
    '2n': ['simple', 'multi-word'],
    '2o': ['multi-word'],
    '2p': ['simple'],
    '2q': [], // PDP recommendations - no query
    '2r': [], // Recent searches - no query
    '2s': ['nlp'], // Federated search - informational query
    '2t': ['simple'], // Analytics - any query
  };

  const types = queryTypeMap[testId] || ['simple'];
  if (types.length === 0) return [];

  // Return first matching query for each type
  const queries: string[] = [];
  for (const type of types) {
    const query = allQueries.find(q => q.type === type);
    if (query) {
      queries.push(query.query);
    }
  }

  return queries;
}
