# Company Sanitization Pipeline
**Status:** Future Implementation (Testing Phase)
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

---

## Problem Statement

When acquiring lists of companies (from BuiltWith, Crossbeam, ZoomInfo, CSV uploads, etc.), **90% of the data is garbage:**
- Invalid domains (test sites, spam, parking pages)
- No traffic (inactive or very low-traffic sites)
- Wrong company size (we need $100M+ revenue companies)
- Wrong industry (we target Retail/E-commerce/Fashion, not Energy/Finance/Manufacturing)

**Yesterday's mistake:** Spent 20,000 BuiltWith API credits on domain-lookup calls for 14,307 companies, got 90% garbage data.

**The Goal:** Build a systematic, reusable pipeline to filter ANY company list down to qualified Algolia targets at minimal cost.

---

## Current Test Case

**Input:** 14,614 companies from BuiltWith (partner tech users)
**Goal:** Filter to 3,000-5,000 qualified targets
**Max Budget:** $150 (vs $12,000 if using SimilarWeb for validation)

---

## Filtering Philosophy

### Order of Operations
1. **Traffic** (objective, FREE) - Tranco Top 1M matching
2. **Financials** (objective, CHEAP) - Yahoo Finance + SEC Edgar
3. **ICP** (subjective, FREE) - Industry/vertical filtering

**Why this order?**
Traffic and financials are FACTS that don't change. ICP preferences are OPINIONS that can change. Validate facts first, filter by preferences last.

---

## 4-Phase Sanitization Pipeline

### PHASE 1: Domain Quality Filter (FREE, 0 API calls)

**Purpose:** Remove obvious garbage domains

**Filters:**
1. **TLD Whitelist** - Keep only:
   - Generic: `.com`, `.co`, `.org`, `.edu`, `.gov`, `.io`, `.ai`, `.net`
   - Country codes: `.uk`, `.us`, `.ca`, `.au`, `.de`, `.fr`, `.nl`, `.es`, `.jp`, `.br`, etc.
   - DROP: `.xyz`, `.top`, `.online`, `.shop`, `.bet`, `.win`, etc.

2. **Spam Keywords** - Drop domains containing:
   - `bet`, `casino`, `poker`, `gambling`
   - `free`, `gift`, `win`, `prize`
   - `porn`, `xxx`, `adult`, `sex`
   - `forex`, `crypto`, `bitcoin`, `loan`

3. **Exclusion List** - Never-gonna-buy companies:
   - **Big Tech:** amazon.com, google.com, microsoft.com, facebook.com, meta.com, apple.com, netflix.com
   - **Tech Giants:** nvidia.com, salesforce.com, oracle.com, sap.com, adobe.com, ibm.com
   - **Search Competitors:** elastic.co, coveo.com, bloomreach.com, constructor.io, klevu.com, searchspring.com
   - **Mega Retailers:** walmart.com, target.com, costco.com (build their own tech)

4. **Invalid Patterns:**
   - Domain length >50 characters
   - Multiple hyphens (≥3)
   - All numbers
   - IP addresses

**Expected Result:** 14,614 → ~11,857 companies (remove ~19% garbage - spam, non-commercial TLDs, exclusions)

**Cost:** $0

---

### PHASE 2: Multi-Layer Traffic Validation (FREE, 0 API calls)

**Purpose:** Validate companies have real traffic = real business using 4 independent data sources with confidence scoring

**Method:** 4-Source Traffic Intersection with Confidence Scoring

**Data Sources (all FREE, all 1M domains):**
1. **Tranco Top 1M** - Combined ranking methodology (Alexa, Cisco Umbrella, Majestic, Quantcast)
   - URL: https://tranco-list.eu/top-1m.csv.zip
   - File: data/tranco-top-1m.csv (22MB)
   - Updated: Daily

2. **Majestic Million** - Backlink strength as traffic proxy
   - URL: https://downloads.majestic.com/majestic_million.csv
   - File: data/majestic-million.csv (77MB)
   - Updated: Daily

3. **Cisco Umbrella Top 1M** - 620B DNS requests/day analysis
   - URL: http://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip
   - File: data/umbrella-top-1m.csv (32MB)
   - Updated: Daily

4. **AkaRank (Akamai)** - Akamai global DNS data
   - URL: (provided by user)
   - File: data/top1M.csv (34MB)
   - Updated: Periodic

**Confidence Scoring Logic:**
```typescript
Source Count → Confidence Level → Traffic Tier
4/4 sources  → VERY HIGH       → Massive/High
3/4 sources  → HIGH            → High/Medium
2/4 sources  → MEDIUM          → Medium/Low
1/4 sources  → LOW             → Low
0/4 sources  → NONE            → No traffic
```

**Traffic Tier Assignment (based on best rank across all sources):**
- Tier 1 (Massive): Rank 1-10,000
- Tier 2 (High): Rank 10,001-100,000
- Tier 3 (Medium): Rank 100,001-500,000
- Tier 4 (Low): Rank 500,001+
- None: Not found in any source

**Processing:**
1. Download all 4 lists (one-time, ~165MB total)
2. Load each into memory (Map<domain, rank>)
3. Match 11,857 domains against all 4 sources
4. For each company:
   - Count how many sources found it (0-4)
   - Record rank from each source
   - Calculate best_rank (lowest rank number)
   - Assign confidence level
   - Assign traffic tier
5. Companies with MEDIUM+ confidence proceed to Phase 3 (Industry Classification)

**Expected Result:** ~1,609 companies with verified traffic (MEDIUM+ confidence from 2+ sources)

**Actual Results (from test run):**
- VERY HIGH (4/4): 581 companies
- HIGH (3/4): 338 companies
- MEDIUM (2/4): 240 companies
- LOW (1/4): 450 companies
- NONE (0/4): 10,248 companies

**Cost:** $0

**Examples:**
- amazon.com: Found in all 4 sources (VERY HIGH confidence)
- shopify.com: Found in 3-4 sources (VERY HIGH/HIGH confidence)
- nike.com: Found in 3-4 sources (VERY HIGH/HIGH confidence)

---

### PHASE 3: Industry Classification (FREE, 0 API calls)

**Purpose:** Get authoritative industry/sector classification for accurate ICP filtering

**Why this phase?**
- Keyword-based classification (e.g., "fashion" in domain) only works for descriptive domains like `usfoods.com`, `wefashion.com`
- Fails completely for brand names like `macys.com` (department store), `bestbuy.com` (electronics), `nike.com` (sportswear)
- Yahoo Finance provides authoritative industry/sector data for all public companies

**Processing:**
1. **Ticker Resolution (WebSearch MCP)**
   - Search: `"{domain}" stock ticker symbol`
   - Extract ticker if found (e.g., `nike.com` → `NKE`)
   - Cost: FREE (WebSearch MCP)

2. **Industry Lookup (Yahoo Finance MCP)**
   - Input: Stock ticker
   - Get: `industry`, `sector` fields from company info
   - Example: `NKE` → Industry: "Footwear & Accessories", Sector: "Consumer Cyclical"
   - Cost: FREE (Yahoo Finance MCP)

3. **Store Industry Data:**
   - Add to company record: `ticker`, `yf_industry`, `yf_sector`
   - These fields used by Phase 4 for ICP matching

**Scope:**
- Run on MEDIUM+ confidence companies (1,159 companies from Phase 2)
- Since Yahoo Finance is FREE, no cost concern about running on full list
- Only basic industry classification - NOT deep financial analysis

**Deep financial analysis happens DOWNSTREAM:**
- 3-year revenue trends
- SEC Edgar 10-K/10-Q filings
- Executive quotes from earnings calls
- These run AFTER qualification, not during pipeline

**Expected Result:** ~1,159 companies with industry/sector classification

**Actual Results (from test run):**
- Input: 1,159 companies (MEDIUM+ confidence)
- Output: 1,159 companies classified (currently stubbed with null values)
- Implementation: Structure in place, Yahoo Finance integration pending

**Cost:** $0

---

### PHASE 4: ICP Filtering (FREE, 0 API calls)

**Purpose:** Filter by Algolia's target industries using database ICP data + Yahoo Finance classification

**Input:** Companies from Phase 3 with `yf_industry` and `yf_sector` fields populated

**Algolia's ICP (from `industries` database table with actual customer proof points):**

**HIGH CONFIDENCE (203 total proof points):**
1. **Retail** (122 proof points)
   - Keywords: fashion, apparel, streetwear, luxury, grocery, food, ecommerce
   - Examples: Fashion retailers, luxury brands, online marketplaces, grocery chains
2. **Consumer Product Manufacturing** (53 proof points)
   - Keywords: fashion, apparel, clothing, footwear, accessories, sportswear
   - Examples: Apparel manufacturers, footwear brands, fashion accessories, sportswear companies
3. **Food and Beverage** (28 proof points)
   - Keywords: grocery, food, beverage, supermarket, restaurant, meal kit, delivery
   - Examples: Grocery stores, food delivery, meal kits, restaurant chains, CPG food brands

**MEDIUM CONFIDENCE (33 total proof points):**
1. **Leisure, Sports and Recreation** (15 proof points)
2. **Corporate Services** (10 proof points)
3. **Media** (7 proof points)
4. **Healthcare** (1 proof point)

**LOW CONFIDENCE (0 proof points, but customers exist):**
- **Computer Software** (SaaS) - No proof points yet, but valid ICP

**NEUTRAL / NOT TARGETS (0 proof points):**
- Computer Hardware
- Electronics
- Telecommunications
- Automotive
- Financial Services
- Energy
- Manufacturing (industrial)
- Defense/Aerospace
- Mining/Agriculture
- Real Estate
- Construction
- Insurance
- Transportation & Logistics
- Government
- Education
- Non-profit/NGO
- Agriculture
- Utilities
- Aerospace & Defense
- Chemicals
- Pharmaceuticals

**3-Priority Matching Logic:**

**PRIORITY 1: Yahoo Finance Industry Data (Most Authoritative)**
- Use `yf_industry` and `yf_sector` fields from Phase 3
- Match against database `industries` table with ICP confidence levels
- Example: `yf_industry="Footwear & Accessories"` → matches "Consumer Product Manufacturing" (HIGH ICP)
- Example: `yf_sector="Consumer Cyclical"` → matches "Retail" (HIGH ICP)

**PRIORITY 2: Keyword Matching (Fallback if no Yahoo Finance data)**
- Match domain name and company name against `icp_keywords` from database
- Only works for descriptive domains (e.g., `usfoods.com`, `wefashion.com`)
- Fails for brand names (e.g., `macys.com`, `bestbuy.com`)
- Limited utility, mainly for non-public companies

**PRIORITY 3: Tech-Stack Signals (Last Resort)**
- If company has `commerce_tech` → mark as LOW tier (needs manual review)
- Could be retail (target) OR manufacturer (not target)
- Example: Both nike.com (HIGH ICP) and amd.com (NEUTRAL) use Magento
- All tech-stack matches require manual validation

**Exclusion Logic:**
- Known non-commercial (dev platforms, CDN, infrastructure)
- Hardware/semiconductors (AMD, NVIDIA, Intel)
- Financial services (banks, trading, insurance)
- Telecom (Verizon, AT&T, Vodafone)
- Industrial manufacturing (Siemens, GE, Honeywell)

**ICP Tier Assignment:**
- HIGH: Retail, Consumer Product Mfg, Food & Beverage (203 proof points)
- MEDIUM: Leisure/Sports, Corporate Services, Media, Healthcare (33 proof points)
- LOW: SaaS/Software, unclear vertical, tech-stack fallback
- EXCLUDED: Non-commercial, wrong industry, neutral categories

**Expected Result:** ~3,000-4,500 ICP-qualified targets

**Cost:** $0 (use data from previous phases)

---

## Total Cost Breakdown

| Phase | Method | API Calls | Cost | Output |
|-------|--------|-----------|------|--------|
| 1. Domain Quality | Logic filters | 0 | $0 | 11,857 |
| 2. Traffic Validation | 4-source matching | 0 | $0 | 1,159 (MEDIUM+) |
| 3. Industry Classification | Yahoo Finance MCP | ~1,159 | $0 (FREE) | 1,159 classified |
| 4. ICP Filtering | Database matching | 0 | $0 | 458-578 qualified |
| **TOTAL** | | **~1,159** | **$0** | **458-578 qualified** |

**Actual Results (from test run):**
- Option A (CONSERVATIVE - 3-4 sources): **458 qualified targets**
- Option B (BALANCED - 2-4 sources): **578 qualified targets**

**vs Original Approach (SimilarWeb validation): $12,000+**

**Savings: 100%** 🎉

**Note:** Deep financial analysis (3-year trends, Edgar, exec quotes) happens DOWNSTREAM on qualified targets only, not in this pipeline.

---

## Modular Architecture (Future Build)

### File Structure
```
scripts/sanitize/
├── index.ts              # CLI entry point
├── config.ts             # Configuration (editable)
├── filters/
│   ├── domain-quality.ts # Phase 1
│   ├── traffic.ts        # Phase 2
│   ├── financial.ts      # Phase 3
│   └── icp.ts            # Phase 4
├── sources/
│   ├── csv.ts            # Load from CSV
│   ├── database.ts       # Load from Supabase
│   ├── builtwith.ts      # Load from BuiltWith API
│   └── manual.ts         # Manual domain list
├── outputs/
│   ├── database.ts       # Save to Supabase
│   ├── csv.ts            # Export to CSV
│   └── report.ts         # Generate JSON report
└── utils/
    ├── tranco.ts         # Tranco list loader
    ├── ticker.ts         # Ticker resolution
    └── logger.ts         # Progress logging
```

### CLI Usage (Future)
```bash
# Sanitize current database
npm run sanitize

# Sanitize uploaded CSV
npm run sanitize --source csv --file data/new-targets.csv

# Sanitize BuiltWith query
npm run sanitize --source builtwith --tech "Adobe AEM"

# Custom thresholds
npm run sanitize --traffic-rank 100000 --revenue 50000000

# Skip phases
npm run sanitize --skip-financials --skip-icp

# Output format
npm run sanitize --output qualified-targets.csv
```

---

## UI Integration (Future - Arian App)

### New Page: `/sanitize`

**Features:**
1. **CSV Upload**
   - Drag-and-drop or file picker
   - Required columns: `domain` (or `company_name` + fuzzy match)
   - Optional columns: `industry`, `revenue`, etc.

2. **Configuration Panel**
   - Traffic threshold slider (Tranco rank)
   - Revenue threshold input ($100M default)
   - ICP industry checkboxes
   - Exclusion list editor

3. **Progress View**
   - Real-time progress bars for each phase
   - Live stats: X of Y processed, Z qualified
   - Cost tracker: $X spent, $Y remaining budget

4. **Results View**
   - Summary stats (qualified count, pass rate, etc.)
   - Filterable table of qualified companies
   - Download buttons (CSV, JSON, Excel)
   - "Save to Database" button

5. **Report View**
   - Sankey diagram: Input → Filters → Output
   - Charts: Traffic distribution, revenue distribution, ICP breakdown
   - Rejection reasons (why companies were filtered out)

### Technical Flow
```
User uploads CSV
      ↓
Frontend sends to Supabase Edge Function
      ↓
Edge Function calls sanitization module
      ↓
Module processes in batches (1,000 at a time)
      ↓
Real-time progress updates via WebSocket/SSE
      ↓
Results stored in temp table
      ↓
User reviews results in UI
      ↓
User clicks "Save" → moved to qualified_targets table
```

---

## Current Test Case Plan

### Input
- **Source:** Supabase `companies` table
- **Count:** 14,614 companies
- **Data:** domains + partner tech (cms_tech, commerce_tech, martech_tech, search_tech)

### Test Execution Steps

1. **Phase 1: Domain Quality** ✅ COMPLETED
   - Removed non-commercial TLDs (.org, .edu, .gov) upfront
   - Applied spam keywords, exclusion list, invalid patterns
   - Result: 11,857 quality domains (81.1% pass rate)
   - Cost: $0

2. **Phase 2: Multi-Layer Traffic Validation** ✅ COMPLETED
   - Downloaded all 4 traffic sources (Tranco, Majestic, Umbrella, AkaRank) ✅ DONE
   - Matched 11,857 domains against all 4 sources
   - Implemented confidence scoring (4/4 = VERY HIGH, 3/4 = HIGH, 2/4 = MEDIUM, 1/4 = LOW, 0/4 = NONE)
   - Results by confidence:
     - VERY HIGH (4/4 sources): 581 companies
     - HIGH (3/4 sources): 338 companies
     - MEDIUM (2/4 sources): 240 companies
     - **Total with MEDIUM+ confidence: 1,159 companies**
     - LOW (1/4 sources): 450 companies
     - NONE (0/4 sources): 10,248 companies
   - Cost: $0

3. **Phase 3: Financial Validation** ⏳ DEFERRED
   - For companies with LOW/NONE traffic confidence (10,698 companies):
     - Resolve ticker symbols via WebSearch
     - Get revenue from Yahoo Finance API
     - Validate with SEC Edgar
   - Expected: ~500-1,000 with $100M+ revenue
   - Cost: ~$50 (ticker resolution)
   - **Status:** Deferred until after Phase 4 validation

4. **Phase 4: ICP Filtering** ⏳ IN PROGRESS
   - Apply actual database ICP classifications:
     - HIGH: Retail (122 proof points), Consumer Product Manufacturing (53), Food & Beverage (28)
     - MEDIUM: Leisure/Sports (15), Corporate Services (10), Media (7), Healthcare (1)
     - LOW: Computer Software (SaaS, 0 proof points but valid)
     - NEUTRAL: Hardware, Electronics, Telecom, etc. (DROP)
   - Data sources for industry classification:
     - Yahoo Finance API (if ticker available)
     - Fortune/Forbes lists
     - Domain analysis (.edu/.gov/.org already excluded)
     - WebSearch (fallback)
   - Expected: ~800-1,200 ICP-qualified targets from 1,159 companies with traffic
   - Cost: $0 (using data from previous phases)

5. **Results Analysis** ⏳ PENDING
   - Total qualified: TBD (~800-1,200 expected)
   - Total cost: $0 so far (Phase 3 deferred)
   - Pass rate: ~5-8% of original 14,614
   - Savings: $12,000+ (vs SimilarWeb approach)

6. **Database Update**
   - Add new table: `qualified_targets`
   - Schema:
     ```sql
     CREATE TABLE qualified_targets (
       domain TEXT PRIMARY KEY,
       company_name TEXT,
       cms_tech TEXT,
       commerce_tech TEXT,
       martech_tech TEXT,
       search_tech TEXT,

       -- Phase 2: Traffic
       tranco_rank INTEGER,
       traffic_tier TEXT, -- 'massive', 'high', 'medium', 'low'

       -- Phase 3: Financial
       ticker TEXT,
       revenue BIGINT,
       market_cap BIGINT,

       -- Phase 4: ICP
       industry TEXT,
       icp_priority TEXT, -- 'HIGH', 'MEDIUM', 'LOW'

       -- Metadata
       qualified_at TIMESTAMP DEFAULT NOW(),
       qualification_reason TEXT -- why this company passed
     );
     ```

---

## Learnings from Test Case

**To be updated as we execute the test...**

### What Worked
- TBD

### What Didn't Work
- TBD

### Cost Actuals vs Estimates
- TBD

### Adjustments Needed
- TBD

---

## Next Steps

1. ✅ Document the approach (this file)
2. ⏳ Execute Phase 2: Tranco matching on 12,483 companies
3. ⏳ Analyze Phase 2 results, group by traffic tiers
4. ⏳ Execute Phase 3: Financial validation on Tier 4 companies
5. ⏳ Execute Phase 4: ICP filtering
6. ⏳ Analyze final results, update learnings
7. ⏳ Build modular sanitization pipeline (if test succeeds)
8. ⏳ Build UI page in Arian app (if module works)

---

## References

- **Tranco List:** https://tranco-list.eu/
- **Yahoo Finance API:** (MCP or direct API)
- **SEC Edgar:** https://www.sec.gov/edgar/searchedgar/companysearch.html
- **Fortune 500:** https://fortune.com/ranking/fortune500/
- **Forbes Global 2000:** https://www.forbes.com/lists/global2000/

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-28 | 1.0 | Initial documentation - approach planning |
