# Phase 3: Industry Classification - Implementation Guide

**Status:** Structure Complete, Yahoo Finance Integration Pending
**Created:** 2026-02-28
**Database Storage:** ✅ Schema Ready

---

## Overview

Phase 3 gets authoritative industry/sector classification from Yahoo Finance for accurate ICP filtering in Phase 4. Data is **permanently stored in the database** for reuse.

## Why Phase 3?

**Problem:** Keyword-based classification fails for brand names:
- ❌ `macys.com` → No retail keywords in domain
- ❌ `bestbuy.com` → No electronics keywords in domain
- ❌ `nike.com` → No sportswear keywords in domain

**Solution:** Yahoo Finance provides authoritative industry classification:
- ✅ `macys.com` → Ticker: M → Industry: "Department Stores" → Sector: "Consumer Cyclical"
- ✅ `bestbuy.com` → Ticker: BBY → Industry: "Electronics Retail" → Sector: "Consumer Cyclical"
- ✅ `nike.com` → Ticker: NKE → Industry: "Footwear & Accessories" → Sector: "Consumer Cyclical"

---

## Database Schema

Run this migration in Supabase SQL Editor:

```sql
-- Location: scripts/migrations/003-add-industry-classification.sql

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS ticker TEXT,
ADD COLUMN IF NOT EXISTS yf_industry TEXT,
ADD COLUMN IF NOT EXISTS yf_sector TEXT,
ADD COLUMN IF NOT EXISTS industry_updated_at TIMESTAMPTZ;

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_companies_yf_industry ON companies(yf_industry);
CREATE INDEX IF NOT EXISTS idx_companies_yf_sector ON companies(yf_sector);
CREATE INDEX IF NOT EXISTS idx_companies_ticker ON companies(ticker);
```

**New Fields:**
- `ticker` - Stock ticker symbol (e.g., "NKE" for nike.com)
- `yf_industry` - Yahoo Finance industry (e.g., "Footwear & Accessories")
- `yf_sector` - Yahoo Finance sector (e.g., "Consumer Cyclical")
- `industry_updated_at` - Timestamp when data was fetched

---

## Implementation Flow

### Step 1: Ticker Resolution (WebSearch MCP)

For each company domain:

```typescript
// Search query
const query = `"${domain}" stock ticker symbol`;

// Example searches:
// "nike.com" stock ticker symbol → NKE
// "macys.com" stock ticker symbol → M
// "bestbuy.com" stock ticker symbol → BBY
```

**Parse Result:**
- Look for ticker pattern: 1-5 uppercase letters
- Common formats: "NYSE: NKE", "Ticker: M", "(BBY)"
- Store ticker if found

### Step 2: Industry Lookup (Yahoo Finance MCP)

```typescript
// Yahoo Finance MCP call
const companyInfo = await yahooFinance.getCompanyInfo(ticker);

// Returns:
{
  ticker: "NKE",
  industry: "Footwear & Accessories",
  sector: "Consumer Cyclical",
  // ... other fields
}
```

### Step 3: Database Storage (Batch Updates)

```typescript
// Batch every 100 companies to avoid overwhelming database
const BATCH_SIZE = 100;

for (let i = 0; i < companies.length; i += BATCH_SIZE) {
  const batch = companies.slice(i, i + BATCH_SIZE);

  // Prepare batch update
  const updates = batch.map(company => ({
    domain: company.domain,
    ticker: company.ticker,
    yf_industry: company.yf_industry,
    yf_sector: company.yf_sector,
    industry_updated_at: new Date().toISOString(),
  }));

  // Execute batch update via Supabase
  for (const update of updates) {
    await supabase
      .from('companies')
      .update({
        ticker: update.ticker,
        yf_industry: update.yf_industry,
        yf_sector: update.yf_sector,
        industry_updated_at: update.industry_updated_at,
      })
      .eq('domain', update.domain);
  }

  console.log(`✓ Stored ${i + batch.length}/${companies.length} companies`);
}
```

### Step 4: Return Enriched Data

```typescript
// Phase 3 returns companies with industry data populated
const companiesWithIndustry: CompanyWithIndustry[] = [
  {
    domain: 'nike.com',
    ticker: 'NKE',
    yf_industry: 'Footwear & Accessories',
    yf_sector: 'Consumer Cyclical',
    // ... other fields from Phase 2
  },
  // ...
];
```

---

## Data Flow

```
Phase 2 Output (1,159 companies)
    ↓
Phase 3: Industry Classification
    ├─ Resolve ticker (WebSearch MCP)
    ├─ Get industry (Yahoo Finance MCP)
    ├─ Store in database (Supabase)
    └─ Return enriched data
    ↓
Phase 4 Input (1,159 companies with industry data)
```

---

## Benefits of Database Storage

1. **No API Waste**
   - Fetch once, reuse forever
   - Re-running Phase 4 with different filters = $0 cost

2. **Downstream Usage**
   - Enrichment pipeline can use industry data
   - Scoring algorithms can weight by industry
   - UI can display "Retail" badge without refetching

3. **Queryable**
   - `SELECT * FROM companies WHERE yf_industry = 'Footwear & Accessories'`
   - `SELECT * FROM companies WHERE yf_sector = 'Consumer Cyclical'`

4. **Incremental Updates**
   - Only fetch industry data for new companies
   - Check `industry_updated_at` to skip already-classified domains

---

## Phase 4 Integration

Phase 4 now has 3-priority matching:

**PRIORITY 1: Yahoo Finance Industry (Most Authoritative)**
```typescript
if (company.yf_industry || company.yf_sector) {
  // Match against database ICP industries
  const match = industries.find(ind =>
    company.yf_industry?.includes(ind.name) ||
    company.yf_sector?.includes(ind.name)
  );

  if (match) {
    return match.icp_confidence; // HIGH/MEDIUM/LOW/NEUTRAL
  }
}
```

**PRIORITY 2: Keyword Matching (Fallback)**
- Only for non-public companies without tickers
- Limited utility (usfoods.com ✅, macys.com ❌)

**PRIORITY 3: Tech-Stack Signals (Last Resort)**
- Marks as LOW tier, requires manual review

---

## Current Status

✅ **Complete:**
- Database schema defined (003-add-industry-classification.sql)
- Phase 3 structure in place (phase3_industryClassification function)
- Phase 4 updated to use Yahoo Finance data (PRIORITY 1)
- Main pipeline wired: Phase 2 → Phase 3 → Phase 4
- Documentation updated

⏳ **Pending:**
- Yahoo Finance MCP integration (ticker resolution + industry lookup)
- Database update logic (batch storage)
- Rate limiting / error handling

---

## Test Execution

**Without Yahoo Finance (current):**
```
Phase 3 → 1,159 companies → All null industry data
Phase 4 → Falls back to keyword + tech-stack matching
Result → 14 HIGH ICP, 578 qualified total
```

**With Yahoo Finance (future):**
```
Phase 3 → 1,159 companies → ~800-1000 with industry data (public companies)
Phase 4 → Authoritative industry matching
Expected → 150-250 HIGH ICP, 600-800 qualified total (much higher quality)
```

---

## Example Results (Projected)

| Domain | Ticker | YF Industry | YF Sector | ICP Tier |
|--------|--------|-------------|-----------|----------|
| nike.com | NKE | Footwear & Accessories | Consumer Cyclical | HIGH |
| macys.com | M | Department Stores | Consumer Cyclical | HIGH |
| bestbuy.com | BBY | Electronics Retail | Consumer Cyclical | HIGH |
| target.com | TGT | Discount Stores | Consumer Cyclical | HIGH |
| costco.com | COST | Discount Stores | Consumer Cyclical | HIGH |
| walmart.com | WMT | Discount Stores | Consumer Cyclical | HIGH |
| nordstrom.com | JWN | Department Stores | Consumer Cyclical | HIGH |
| tjx.com | TJX | Apparel Retail | Consumer Cyclical | HIGH |
| kohls.com | KSS | Department Stores | Consumer Cyclical | HIGH |
| gap.com | GPS | Apparel Retail | Consumer Cyclical | HIGH |

All of these would be **missed by keyword matching** but **caught by Yahoo Finance classification**.

---

## Cost Analysis

- **WebSearch MCP:** FREE (included in Claude Code)
- **Yahoo Finance MCP:** FREE (public API)
- **Database Storage:** FREE (within Supabase limits)

**Total Cost: $0** 🎉

Compare to BuiltWith domain-lookup approach: $12,000+ for same 14K companies.

---

## Next Steps

1. Run migration: `scripts/migrations/003-add-industry-classification.sql`
2. Verify columns exist: Check Supabase table schema
3. Integrate Yahoo Finance MCP when available
4. Test on small batch (100 companies) first
5. Roll out to full 1,159 companies
