# Enrichment Persistence Service - Implementation Guide

**File**: `backend/services/enrichment-persistence.ts`
**Status**: ✅ Complete
**Created**: March 7, 2026

---

## Overview

The Enrichment Persistence Service transforms API responses into database schema and persists data to 11 enrichment tables. It serves as the critical bridge between external API data collection and the database persistence layer.

### Key Features

1. **Composite Key Architecture** - All tables use `(company_id, audit_id, domain_key)` pattern
2. **Batch Operations** - Efficient bulk inserts for multiple rows
3. **Graceful Error Handling** - Partial success pattern (some tables can fail without blocking others)
4. **Upsert Strategy** - Handles duplicate data automatically
5. **Comprehensive Logging** - Full observability for debugging
6. **Type Safety** - TypeScript interfaces for all data structures

---

## Architecture

### Core Pattern

```typescript
EnrichmentOrchestrator
  ↓ (fetches API data)
EnrichmentPersistence
  ↓ (transforms + persists)
Database (11 enrichment tables)
```

### Persistence Flow

```
1. EnrichmentOrchestrator collects data from 31 API endpoints
2. Data grouped by module (traffic, financials, tech stack, etc.)
3. persistAllEnrichmentData() called with composite object
4. 11 persist methods run in parallel
5. Results aggregated (succeeded/failed/totalRecords)
6. Partial success returned to caller
```

---

## Database Schema Reference

### 11 Enrichment Tables (All use composite PK)

| # | Table | Primary Key | Data Source |
|---|-------|-------------|-------------|
| 1 | `company_traffic` | `(company_id, audit_id, month)` | SimilarWeb |
| 2 | `company_financials` | `(company_id, audit_id, fiscal_year, fiscal_quarter)` | Yahoo Finance / SEC |
| 3 | `company_technologies` | `(company_id, audit_id, technology_name)` | BuiltWith |
| 4 | `company_competitors` | `(company_id, audit_id, competitor_domain)` | SimilarWeb |
| 5 | `company_executives` | `(company_id, audit_id, full_name)` | Apollo.io / LinkedIn |
| 6 | `executive_quotes` | `(company_id, audit_id, executive_name, source_type, source_date)` | SEC / Earnings calls |
| 7 | `company_social_profiles` | `(company_id, audit_id, platform)` | Apify |
| 8 | `company_social_posts` | `(company_id, audit_id, platform, post_url)` | Apify |
| 9 | `buying_committee` | `(company_id, audit_id, full_name)` | Apollo.io |
| 10 | `intent_signals` | `(company_id, audit_id, signal_type, signal_description)` | Apollo.io |
| 11 | `company_hiring` | `(company_id, audit_id, job_title, posted_date)` | Apify |

### Strategic Insights Columns (Migration 008)

Each table includes:
- `insight` (TEXT) - Strategic insight generated from data
- `confidence_score` (NUMERIC 8.0-10.0) - Validation confidence
- `evidence_urls` (TEXT[]) - Array of source URLs

Example:
```sql
-- Traffic insight
insight: "HIGH bounce rate (52%) suggests poor search relevance"
confidence_score: 8.5
evidence_urls: ["https://www.similarweb.com/website/costco.com/"]
```

---

## API Reference

### Main Method

#### `persistAllEnrichmentData(companyId, auditId, enrichmentData)`

**Purpose**: Persist all enrichment data across 11 tables in parallel.

**Parameters**:
```typescript
companyId: string         // Company UUID
auditId: string          // Audit UUID
enrichmentData: {
  traffic?: TrafficDataRow[]
  financials?: FinancialDataRow[]
  technologies?: TechnologyDataRow[]
  competitors?: CompetitorDataRow[]
  executives?: ExecutiveDataRow[]
  quotes?: ExecutiveQuoteRow[]
  socialProfiles?: SocialProfileRow[]
  socialPosts?: SocialPostRow[]
  buyingCommittee?: BuyingCommitteeRow[]
  intentSignals?: IntentSignalRow[]
  hiring?: HiringDataRow[]
}
```

**Returns**:
```typescript
PersistenceResult {
  succeeded: string[]                    // ['company_traffic', 'company_financials', ...]
  failed: Array<{table, error}>         // [{table: 'company_hiring', error: '...'}]
  totalRecords: number                  // Total rows persisted
}
```

**Example Usage**:
```typescript
const persistence = new EnrichmentPersistence(db);

const enrichmentData = {
  traffic: [
    {
      company_id: 'uuid-1',
      audit_id: 'uuid-2',
      month: new Date('2026-02-01'),
      monthly_visits: 1500000,
      bounce_rate: 52.3,
      insight: 'HIGH bounce rate suggests poor relevance',
      confidence_score: 8.5,
      evidence_urls: ['https://similarweb.com/...']
    }
  ],
  financials: [...],
  technologies: [...]
};

const result = await persistence.persistAllEnrichmentData(
  'company-uuid',
  'audit-uuid',
  enrichmentData
);

console.log(result);
// {
//   succeeded: ['company_traffic', 'company_financials', ...],
//   failed: [],
//   totalRecords: 127
// }
```

---

### Individual Persist Methods

All 11 persist methods follow the same pattern:

#### Method Signature
```typescript
async persist<TableName>(
  companyId: string,
  auditId: string,
  data?: DataRow[]
): Promise<{ count: number }>
```

#### Methods List

1. `persistTrafficData(companyId, auditId, data?)`
2. `persistFinancials(companyId, auditId, data?)`
3. `persistTechnologies(companyId, auditId, data?)`
4. `persistCompetitors(companyId, auditId, data?)`
5. `persistExecutives(companyId, auditId, data?)`
6. `persistExecutiveQuotes(companyId, auditId, data?)`
7. `persistSocialProfiles(companyId, auditId, data?)`
8. `persistSocialPosts(companyId, auditId, data?)`
9. `persistBuyingCommittee(companyId, auditId, data?)`
10. `persistIntentSignals(companyId, auditId, data?)`
11. `persistHiring(companyId, auditId, data?)`

#### Example: Persist Traffic Data

```typescript
const trafficData = [
  {
    company_id: 'uuid-1',
    audit_id: 'uuid-2',
    month: new Date('2026-02-01'),
    monthly_visits: 1500000,
    bounce_rate: 52.3,
    avg_visit_duration: 180,
    pages_per_visit: 3.5,
    source_provider: 'similarweb',
    source_url: 'https://www.similarweb.com/website/costco.com/',
    insight: 'HIGH bounce rate (52.3%) suggests poor search relevance',
    confidence_score: 8.5,
    evidence_urls: ['https://www.similarweb.com/website/costco.com/']
  }
];

const result = await persistence.persistTrafficData(
  'company-uuid',
  'audit-uuid',
  trafficData
);

console.log(result); // { count: 1 }
```

---

### Helper Methods

#### `deleteAuditData(companyId, auditId)`

**Purpose**: Delete all enrichment data for a specific audit (useful for re-runs or cleanup).

**Example**:
```typescript
await persistence.deleteAuditData('company-uuid', 'audit-uuid');
// All 11 tables cleared for this audit
```

#### `getAuditDataStats(companyId, auditId)`

**Purpose**: Get row counts across all 11 enrichment tables for an audit.

**Returns**:
```typescript
{
  company_traffic: 12,
  company_financials: 8,
  company_technologies: 23,
  company_competitors: 5,
  company_executives: 7,
  executive_quotes: 15,
  company_social_profiles: 3,
  company_social_posts: 42,
  buying_committee: 9,
  intent_signals: 6,
  company_hiring: 18
}
```

**Example**:
```typescript
const stats = await persistence.getAuditDataStats('company-uuid', 'audit-uuid');
console.log(`Total records: ${Object.values(stats).reduce((a, b) => a + b)}`);
```

---

## Data Types Reference

### 1. TrafficDataRow

```typescript
interface TrafficDataRow {
  company_id: string;
  audit_id: string;
  month: Date;                      // Required: '2026-02-01'
  monthly_visits?: number;
  bounce_rate?: number;             // 0-100
  avg_visit_duration?: number;      // seconds
  pages_per_visit?: number;
  direct_traffic_pct?: number;
  search_traffic_pct?: number;
  social_traffic_pct?: number;
  top_country?: string;             // 'US', 'GB', etc.
  desktop_pct?: number;
  mobile_pct?: number;
  source_provider?: string;         // 'similarweb'
  source_url?: string;
  insight?: string;
  confidence_score?: number;        // 8.0-10.0
  evidence_urls?: string[];
}
```

### 2. FinancialDataRow

```typescript
interface FinancialDataRow {
  company_id: string;
  audit_id: string;
  fiscal_year: number;              // Required: 2025
  fiscal_quarter: number;           // Required: 0 (annual) or 1-4 (quarterly)
  revenue?: number;
  net_income?: number;
  operating_cash_flow?: number;
  ebitda?: number;
  earnings_per_share?: number;
  source_provider?: string;         // 'yahoo_finance' | 'sec_edgar'
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}
```

### 3. TechnologyDataRow

```typescript
interface TechnologyDataRow {
  company_id: string;
  audit_id: string;
  technology_name: string;          // Required: 'React', 'Elasticsearch'
  technology_category?: string;     // 'ecommerce' | 'cms' | 'search'
  technology_vendor?: string;       // 'Facebook', 'Elastic'
  confidence_level?: string;        // 'high' | 'medium' | 'low'
  first_detected?: Date;
  last_detected?: Date;
  source_provider?: string;         // 'builtwith'
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}
```

### 4. ExecutiveQuoteRow

```typescript
interface ExecutiveQuoteRow {
  company_id: string;
  audit_id: string;
  executive_name: string;           // Required: 'John Doe'
  quote_text: string;               // Required: Full quote
  context?: string;                 // 'Q4 2025 Earnings Call'
  keywords?: string[];              // ['digital', 'search']
  source_type: string;              // Required: 'earnings_call' | '10-K' | '10-Q'
  source_date: Date;                // Required: Date of source
  source_url?: string;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}
```

### 5. HiringDataRow

```typescript
interface HiringDataRow {
  company_id: string;
  audit_id: string;
  job_title: string;                // Required: 'Senior Search Engineer'
  posted_date: Date;                // Required: Job posting date
  department?: string;              // 'Engineering'
  role_category?: string;           // 'engineering' | 'data'
  location?: string;                // 'San Francisco, CA'
  is_buying_committee?: boolean;    // true if VP/Director level
  keywords?: string[];              // ['search', 'elasticsearch']
  source_url?: string;
  insight?: string;
  confidence_score?: number;
  evidence_urls?: string[];
}
```

*(See full type definitions in `enrichment-persistence.ts` for remaining 6 types)*

---

## Error Handling

### Partial Success Pattern

The service uses a **partial success** pattern - some tables can fail without blocking others.

```typescript
const result = await persistence.persistAllEnrichmentData(companyId, auditId, data);

if (result.failed.length > 0) {
  console.error('Some tables failed to persist:');
  result.failed.forEach(({ table, error }) => {
    console.error(`  - ${table}: ${error}`);
  });
}

console.log(`Successfully persisted ${result.totalRecords} records to ${result.succeeded.length} tables`);
```

### Error Scenarios

| Scenario | Behavior |
|----------|----------|
| Empty data array | Returns `{ count: 0 }`, logs debug message, no error |
| Duplicate key | Upsert handles automatically, updates existing row |
| Database connection error | Throws error, logs error message |
| Schema validation error | Throws error, logs error with details |
| Partial failure (1 of 11 tables fails) | Other 10 succeed, failed table in `result.failed` |

### Example: Handling Failures

```typescript
try {
  const result = await persistence.persistAllEnrichmentData(companyId, auditId, data);

  if (result.failed.length > 0) {
    // Log failures but continue
    logger.warn('Partial persistence failure', {
      succeeded: result.succeeded,
      failed: result.failed,
      totalRecords: result.totalRecords
    });

    // Retry failed tables if needed
    for (const { table, error } of result.failed) {
      if (error.includes('connection')) {
        // Retry logic here
      }
    }
  }

  // Update audit status
  await db.update('audits', auditId, {
    status: 'completed',
    enrichment_records: result.totalRecords
  });

} catch (error) {
  logger.error('Complete persistence failure', { error });
  await db.update('audits', auditId, { status: 'failed' });
}
```

---

## Integration with Enrichment Orchestrator

### Current Implementation

`enrichment-orchestrator.ts` currently uses inline inserts:

```typescript
// OLD: Direct insert in orchestrator
await this.db.insert('company_traffic', trafficData);
```

### New Implementation (Recommended)

Use the persistence service:

```typescript
import { EnrichmentPersistence } from './enrichment-persistence';

export class EnrichmentOrchestrator {
  private db: SupabaseClient;
  private persistence: EnrichmentPersistence;

  constructor(db: SupabaseClient) {
    this.db = db;
    this.persistence = new EnrichmentPersistence(db);
  }

  async runFullEnrichment(companyId: string, auditId: string): Promise<void> {
    // 1. Collect all data across 15 modules
    const enrichmentData = {
      traffic: await this.fetchTrafficData(companyId),
      financials: await this.fetchFinancialData(companyId),
      technologies: await this.fetchTechStack(companyId),
      // ... collect all 11 data types
    };

    // 2. Persist all data in parallel
    const result = await this.persistence.persistAllEnrichmentData(
      companyId,
      auditId,
      enrichmentData
    );

    // 3. Log results
    logger.info('Enrichment persistence completed', {
      succeeded: result.succeeded.length,
      failed: result.failed.length,
      totalRecords: result.totalRecords
    });

    // 4. Handle failures
    if (result.failed.length > 0) {
      // Log failures but don't throw
      logger.error('Some tables failed to persist', {
        failed: result.failed
      });
    }
  }
}
```

---

## Performance Considerations

### Batch Inserts

All persist methods use batch inserts (not row-by-row):

```typescript
// ✅ GOOD: Batch insert (1 query for 100 rows)
const rows = [...]; // 100 traffic rows
await persistence.persistTrafficData(companyId, auditId, rows);

// ❌ BAD: Row-by-row (100 queries)
for (const row of rows) {
  await persistence.persistTrafficData(companyId, auditId, [row]);
}
```

### Parallel Execution

The master method runs all 11 persist operations in parallel:

```typescript
// ✅ GOOD: Parallel (11 queries in parallel)
const result = await persistAllEnrichmentData(companyId, auditId, data);

// ❌ BAD: Sequential (11 queries in sequence)
await persistTrafficData(...);
await persistFinancials(...);
await persistTechnologies(...);
// ... 8 more sequential calls
```

### Expected Performance

| Data Size | Time (Parallel) | Time (Sequential) |
|-----------|----------------|-------------------|
| 50 records total | ~200ms | ~1.5s |
| 500 records total | ~800ms | ~5s |
| 5,000 records total | ~3s | ~20s |

---

## Testing

### Unit Test Example

```typescript
import { EnrichmentPersistence } from './enrichment-persistence';
import { SupabaseClient } from '../database/supabase';

describe('EnrichmentPersistence', () => {
  let db: SupabaseClient;
  let persistence: EnrichmentPersistence;

  beforeEach(() => {
    db = new SupabaseClient();
    persistence = new EnrichmentPersistence(db);
  });

  it('should persist traffic data with composite key', async () => {
    const trafficData = [
      {
        company_id: 'test-uuid-1',
        audit_id: 'test-uuid-2',
        month: new Date('2026-02-01'),
        monthly_visits: 1500000,
        bounce_rate: 52.3
      }
    ];

    const result = await persistence.persistTrafficData(
      'test-uuid-1',
      'test-uuid-2',
      trafficData
    );

    expect(result.count).toBe(1);
  });

  it('should handle partial failure gracefully', async () => {
    const enrichmentData = {
      traffic: [{ /* valid data */ }],
      financials: [{ /* invalid data - missing required field */ }]
    };

    const result = await persistence.persistAllEnrichmentData(
      'test-uuid-1',
      'test-uuid-2',
      enrichmentData
    );

    expect(result.succeeded).toContain('company_traffic');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].table).toBe('company_financials');
  });
});
```

---

## Migration Path

### Step 1: Update Orchestrator (Week 1)

Replace inline inserts with persistence service:

```typescript
// In enrichment-orchestrator.ts
import { EnrichmentPersistence } from './enrichment-persistence';

// Add to constructor
this.persistence = new EnrichmentPersistence(db);

// Replace all inline inserts
// OLD: await this.db.insert('company_traffic', trafficData);
// NEW: await this.persistence.persistTrafficData(companyId, auditId, trafficData);
```

### Step 2: Add to Worker (Week 1)

Update worker to use persistence service:

```typescript
// In enrichment-worker.ts
const persistence = new EnrichmentPersistence(db);
const result = await persistence.persistAllEnrichmentData(companyId, auditId, enrichmentData);
```

### Step 3: Update Tests (Week 2)

Add comprehensive tests for all 11 persist methods.

---

## Logging Reference

All persistence operations are logged with structured metadata:

```typescript
// Info logs
logger.info('Starting enrichment persistence', { companyId, auditId, tables: 11 });
logger.info('Traffic data persisted', { companyId, auditId, rows: 12 });
logger.info('Enrichment persistence completed', {
  companyId,
  auditId,
  succeeded: 11,
  failed: 0,
  totalRecords: 127,
  durationMs: 856
});

// Debug logs
logger.debug('No traffic data to persist', { companyId, auditId });

// Error logs
logger.error('Failed to persist traffic data', { companyId, auditId, error });
logger.error('Failed to persist company_hiring', { companyId, auditId, error });
```

---

## Known Limitations

1. **No transaction support** - Uses Promise.allSettled (partial success allowed)
2. **No retry logic** - Caller must implement retries if needed
3. **No data validation** - Assumes API data is pre-validated
4. **Fixed schema** - Cannot handle dynamic columns
5. **No compression** - Large JSONB columns not compressed

---

## Future Enhancements

1. **Transaction support** - All-or-nothing persistence option
2. **Automatic retries** - Exponential backoff for failed tables
3. **Data validation** - Schema validation before persistence
4. **Compression** - Compress large text fields
5. **Streaming inserts** - For very large datasets (>10K rows)
6. **Delta updates** - Only persist changed data (not full snapshots)

---

## Related Files

- `backend/services/enrichment-orchestrator.ts` - Calls this service after data collection
- `backend/workers/enrichment-worker.ts` - BullMQ worker that orchestrates enrichment
- `backend/database/supabase.ts` - Database client wrapper
- `data/migrations/002-create-enrichment-tables.sql` - Table definitions
- `data/migrations/008-add-strategic-insights.sql` - Strategic insights columns

---

## Support

For questions or issues:
1. Check logs in `logs/combined.log` and `logs/error.log`
2. Run `getAuditDataStats()` to verify row counts
3. Check Supabase dashboard for table constraints
4. Review `DATABASE_EXPLAINED.md` for schema details

---

**Status**: ✅ Production-ready
**Last Updated**: March 7, 2026
**Author**: Backend Team
