# Enrichment Persistence - Quick Reference

**File**: `backend/services/enrichment-persistence.ts`

---

## Quick Start

```typescript
import { EnrichmentPersistence } from './enrichment-persistence';
import { SupabaseClient } from '../database/supabase';

const db = new SupabaseClient();
const persistence = new EnrichmentPersistence(db);

// Persist all data
const result = await persistence.persistAllEnrichmentData(
  'company-uuid',
  'audit-uuid',
  {
    traffic: [...],
    financials: [...],
    technologies: [...],
    // ... 8 more data types
  }
);

console.log(result);
// {
//   succeeded: ['company_traffic', 'company_financials', ...],
//   failed: [],
//   totalRecords: 127
// }
```

---

## 11 Enrichment Tables

| Table | Primary Key | Required Fields |
|-------|-------------|-----------------|
| `company_traffic` | `(company_id, audit_id, month)` | `month` |
| `company_financials` | `(company_id, audit_id, fiscal_year, fiscal_quarter)` | `fiscal_year`, `fiscal_quarter` |
| `company_technologies` | `(company_id, audit_id, technology_name)` | `technology_name` |
| `company_competitors` | `(company_id, audit_id, competitor_domain)` | `competitor_domain` |
| `company_executives` | `(company_id, audit_id, full_name)` | `full_name` |
| `executive_quotes` | `(company_id, audit_id, executive_name, source_type, source_date)` | `executive_name`, `quote_text`, `source_type`, `source_date` |
| `company_social_profiles` | `(company_id, audit_id, platform)` | `platform`, `profile_url` |
| `company_social_posts` | `(company_id, audit_id, platform, post_url)` | `platform`, `post_url` |
| `buying_committee` | `(company_id, audit_id, full_name)` | `full_name` |
| `intent_signals` | `(company_id, audit_id, signal_type, signal_description)` | `signal_type`, `signal_description` |
| `company_hiring` | `(company_id, audit_id, job_title, posted_date)` | `job_title`, `posted_date` |

---

## Common Patterns

### Pattern 1: Persist Single Table

```typescript
const trafficData = [
  {
    company_id: 'uuid-1',
    audit_id: 'uuid-2',
    month: new Date('2026-02-01'),
    monthly_visits: 1500000,
    bounce_rate: 52.3
  }
];

await persistence.persistTrafficData('uuid-1', 'uuid-2', trafficData);
```

### Pattern 2: Persist All Tables

```typescript
const enrichmentData = {
  traffic: [...],
  financials: [...],
  technologies: [...]
};

const result = await persistence.persistAllEnrichmentData(
  'uuid-1',
  'uuid-2',
  enrichmentData
);
```

### Pattern 3: Handle Partial Failures

```typescript
const result = await persistence.persistAllEnrichmentData(companyId, auditId, data);

if (result.failed.length > 0) {
  logger.warn('Some tables failed', { failed: result.failed });
  // Continue - partial success is OK
}
```

### Pattern 4: Get Audit Stats

```typescript
const stats = await persistence.getAuditDataStats('uuid-1', 'uuid-2');
console.log(stats);
// {
//   company_traffic: 12,
//   company_financials: 8,
//   ...
// }
```

### Pattern 5: Delete Audit Data

```typescript
await persistence.deleteAuditData('uuid-1', 'uuid-2');
// All enrichment data for this audit deleted
```

---

## Strategic Insights (Migration 008)

Each row can include strategic insights:

```typescript
{
  // ... regular fields
  insight: 'HIGH bounce rate (52%) suggests poor search relevance',
  confidence_score: 8.5,
  evidence_urls: ['https://www.similarweb.com/...']
}
```

**Requirements**:
- `confidence_score`: Must be between 8.0 and 10.0
- `insight`: Free text strategic insight
- `evidence_urls`: Array of source URLs

---

## Error Handling Cheat Sheet

| Error | Cause | Solution |
|-------|-------|----------|
| Empty array → `{ count: 0 }` | No data to persist | Expected behavior |
| Duplicate key → Upsert | Same PK exists | Automatically handled |
| Missing required field → Error | `technology_name` missing | Add required field |
| Connection error → Throw | Database down | Retry with backoff |
| Partial failure → `result.failed` | 1 of 11 tables failed | Continue with succeeded tables |

---

## Performance Tips

1. **Batch inserts** - Pass arrays, not single rows
2. **Parallel execution** - Use `persistAllEnrichmentData()` instead of sequential calls
3. **Upsert vs Insert** - Upsert handles duplicates automatically (no pre-check needed)

---

## Minimal Example

```typescript
// 1. Create persistence service
const persistence = new EnrichmentPersistence(db);

// 2. Prepare data
const data = {
  traffic: [{
    company_id: 'uuid-1',
    audit_id: 'uuid-2',
    month: new Date('2026-02-01'),
    monthly_visits: 1500000
  }]
};

// 3. Persist
const result = await persistence.persistAllEnrichmentData(
  'uuid-1',
  'uuid-2',
  data
);

// 4. Check result
console.log(result.succeeded); // ['company_traffic']
console.log(result.totalRecords); // 1
```

---

## Logging

All operations logged with structured metadata:

```typescript
// Success
logger.info('Traffic data persisted', { companyId, auditId, rows: 12 });

// Failure
logger.error('Failed to persist traffic data', { companyId, auditId, error });
```

---

## Testing Example

```typescript
it('should persist traffic data', async () => {
  const result = await persistence.persistTrafficData(
    'test-uuid-1',
    'test-uuid-2',
    [{ month: new Date('2026-02-01'), monthly_visits: 1000000 }]
  );

  expect(result.count).toBe(1);
});
```

---

## Key Takeaways

1. **Composite keys** - All tables use `(company_id, audit_id, domain_key)`
2. **Partial success** - Some tables can fail without blocking others
3. **Upsert strategy** - Handles duplicates automatically
4. **Batch operations** - Efficient bulk inserts
5. **Comprehensive logging** - Full observability

---

## Related Docs

- Full guide: `ENRICHMENT_PERSISTENCE_GUIDE.md`
- Database schema: `data/README.md`
- Migration files: `data/migrations/002-*.sql`, `data/migrations/008-*.sql`

---

**Status**: ✅ Production-ready
**Last Updated**: March 7, 2026
