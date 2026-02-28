# Partner Tech Enrichment Task

**Purpose:** Build displacement target lists by partner technology using BuiltWith data.
**Copy this entire document to a new Claude thread to run enrichment in parallel.**

---

## IMPORTANT: Two-Phase Approach

### Phase 1: Data Collection (This Task)
Query BuiltWith **BY TECH** to get domain lists → populates company table as side effect.

```
Query: "Give me all companies using Adobe AEM"
Result: List of 2,700 domains → INSERT into displacement_targets
```

**Cost:** 1 API call per tech (7 calls total) = CHEAP

### Phase 2: Deep Enrichment (Separate Task, Later)
Query BuiltWith **BY DOMAIN** to get full tech stack → only for jackpots.

```
Query: "Give me full tech stack for costco.com"
Result: Full tech stack JSON → UPDATE existing row
```

**Cost:** 1 API call per domain = EXPENSIVE → Only do for high-priority accounts

---

## Objective

Find companies using specific partner technologies who are **NOT using Algolia** = displacement opportunities.

**Key Insight:** Companies using MULTIPLE partner products are highest value because:
1. Algolia integrates with all of them
2. Pitch to partner: "This customer uses 3 of your products, we integrate with all 3, we increase your stickiness"

---

## Partner Technologies to Fetch

### CMS Platforms
| Technology | BuiltWith Category | Notes |
|------------|-------------------|-------|
| **Adobe Experience Manager (AEM)** | CMS | Enterprise content management |

### Commerce Platforms
| Technology | BuiltWith Category | Notes |
|------------|-------------------|-------|
| **Adobe Commerce (Magento)** | eCommerce Platform | Enterprise commerce |
| **Salesforce Commerce Cloud** | eCommerce Platform | B2C commerce |
| **BigCommerce** | eCommerce Platform | Mid-market commerce |
| **Shopify** | eCommerce Platform | SMB to enterprise |

### CDP/Marketing
| Technology | BuiltWith Category | Notes |
|------------|-------------------|-------|
| **Adobe Experience Platform (AEP)** | CDP/Analytics | Customer data platform |
| **Salesforce Marketing Cloud** | Marketing Automation | Email, journeys |

### Cloud Hosting (Hyperscalers) - FILTER LAYER
| Technology | BuiltWith Category | GTM Play |
|------------|-------------------|----------|
| **Amazon Web Services (AWS)** | Hosting | AWS Marketplace, co-sell |
| **Microsoft Azure** | Hosting | Azure Marketplace, co-sell |
| **Google Cloud Platform (GCP)** | Hosting | GCP Marketplace, co-sell |

**Note:** Cloud is NOT a standalone cohort. It's a FILTER applied across all partner tech cohorts.

---

## Cohort Definitions (CROSS-PLATFORM)

### Architecture: Cohorts + Cloud Filter Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLOUD FILTER LAYER                               │
│         ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐       │
│         │   ALL   │    │   AWS   │    │  AZURE  │    │   GCP   │       │
│         └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘       │
│              │              │              │              │             │
│              └──────────────┴──────────────┴──────────────┘             │
│                              FILTERS ↓                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                         PARTNER TECH COHORTS                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   TRIPLE    │  │ CMS+COMMERCE│  │CMS+MARKETING│  │COMMERCE+    │   │
│  │   STACK     │  │             │  │             │  │  MARKETING  │   │
│  │  (Jackpot)  │  │ AEM + Any   │  │ AEM + SFMC  │  │ Shopify +   │   │
│  │             │  │ commerce    │  │ or AEP      │  │   SFMC      │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │MULTI-ADOBE  │  │ MULTI-SF    │  │  SINGLE     │  │  SINGLE     │   │
│  │  2+ Adobe   │  │ SFMC+SFCC   │  │  COMMERCE   │  │    CMS      │   │
│  │  products   │  │             │  │ (any one)   │  │  (AEM only) │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Point:** Cloud is NOT a cohort. Cloud is a FILTER applied to any cohort view.

### COHORTS (Partner Tech Combinations Only)

| Cohort | Definition | Value Prop |
|--------|------------|------------|
| **Triple Stack** | CMS + ANY commerce + ANY marketing | **JACKPOT** - Maximum integration |
| **CMS + Commerce** | AEM + ANY commerce (Shopify, SFCC, BigCommerce, Adobe Commerce) | Content + Commerce integration |
| **CMS + Marketing** | AEM + ANY marketing (SFMC, AEP) | Content + Marketing automation |
| **Commerce + Marketing** | ANY commerce + ANY marketing | Full funnel coverage |
| **Multi-Adobe** | 2+ Adobe products (AEM, Commerce, AEP) | Adobe stickiness |
| **Multi-Salesforce** | SFMC + SFCC | Salesforce stickiness |
| **Single Commerce** | Only 1 commerce platform | Commerce entry point |
| **Single CMS** | Only AEM | CMS entry point |
| **Single Marketing** | Only SFMC or AEP | Marketing entry point |

**Key Insight:** Cross-VENDOR combinations (e.g., AEM + Shopify) are MORE valuable than same-vendor (AEM + Adobe Commerce) because it proves vendor-agnostic buying behavior.

### CLOUD FILTER (Applies to ANY Cohort)

| Filter | What It Shows | GTM Play |
|--------|--------------|----------|
| **All** | All accounts in cohort | Base view |
| **AWS** | Cohort accounts hosted on AWS | AWS Marketplace co-sell |
| **Azure** | Cohort accounts hosted on Azure | Azure Marketplace co-sell |
| **GCP** | Cohort accounts hosted on GCP | GCP Marketplace co-sell |

**Example Usage:**
- View "CMS + Commerce" cohort → 5,000 accounts
- Apply "AWS" filter → 2,250 accounts (45% on AWS)
- These 2,250 are your AWS co-sell targets within the CMS + Commerce cohort

---

## Priority Ranking

### Cohort Priority (Highest to Lowest)

| Rank | Cohort | Why |
|------|--------|-----|
| 1 | **Triple Stack** | CMS + Commerce + Marketing = maximum integration surface |
| 2 | **CMS + Commerce (cross-vendor)** | AEM + Shopify/SFCC/BigCommerce = vendor-agnostic buyer |
| 3 | **CMS + Commerce (same vendor)** | AEM + Adobe Commerce = Adobe stickiness |
| 4 | **Commerce + Marketing** | Shopify + SFMC = full funnel |
| 5 | **CMS + Marketing** | AEM + SFMC/AEP = content + automation |
| 6 | **Multi-Adobe** | 2+ Adobe products |
| 7 | **Multi-Salesforce** | SFMC + SFCC |
| 8 | **Single Commerce** | Shopify only, BigCommerce only, etc. |
| 9 | **Single CMS** | AEM only |
| 10 | **Single Marketing** | SFMC only, AEP only |

### Cloud Filter Boost

Within ANY cohort, accounts with cloud hosting get priority boost:

| Cloud Status | Boost | Why |
|--------------|-------|-----|
| AWS | +15% | AWS Marketplace co-sell motion |
| Azure | +15% | Azure Marketplace co-sell motion |
| GCP | +10% | GCP Marketplace co-sell motion |
| Unknown/Other | +0% | No marketplace play |

**Example:**
- Triple Stack account on AWS → Priority 1 + 15% boost = TOP TARGET
- Triple Stack account (no cloud detected) → Priority 1, no boost
- Single Commerce account on AWS → Priority 8 + 15% boost

---

## Data Model

### For Each Account, Track:

```typescript
{
  domain: string;
  company_name: string;

  // CMS (1 type)
  has_adobe_aem: boolean;

  // Commerce (4 types - can have multiple!)
  has_adobe_commerce: boolean;
  has_salesforce_commerce_cloud: boolean;
  has_bigcommerce: boolean;
  has_shopify: boolean;

  // Marketing/CDP (2 types)
  has_adobe_aep: boolean;
  has_salesforce_marketing_cloud: boolean;

  // Cloud hosting (hyperscalers) - determined in Phase 2
  has_aws: boolean;
  has_azure: boolean;
  has_gcp: boolean;
  cloud_provider: string;      // Primary: 'aws' | 'azure' | 'gcp' | 'unknown'

  // Calculated (in app, not from API)
  partner_tech_count: number;  // How many partner products (0-7)
  partner_techs: string[];     // Array of detected techs

  // Cross-stack combinations (calculated)
  has_cms: boolean;           // has_adobe_aem
  has_commerce: boolean;      // any commerce platform
  has_marketing: boolean;     // AEP or SFMC
  is_triple_stack: boolean;   // CMS + Commerce + Marketing
  is_cross_vendor: boolean;   // Has products from 2+ vendors

  // Algolia status - determined in Phase 2 for jackpots
  has_algolia: boolean;        // If true, NOT a displacement target

  // Basic enrichment
  vertical: string;
  country: string;
}
```

### Priority Matrix

**Cohort Priority (base score):**

| Cohort | Base Priority | GTM Play |
|--------|---------------|----------|
| Triple Stack | 100 | Maximum integration surface |
| CMS + Commerce (cross-vendor) | 90 | Vendor-agnostic buyer |
| CMS + Commerce (same vendor) | 80 | Vendor stickiness |
| Commerce + Marketing | 75 | Full funnel |
| CMS + Marketing | 70 | Content + automation |
| Multi-Adobe / Multi-Salesforce | 65 | Single-vendor stickiness |
| Single product | 50 | Entry point |

**Cloud Filter Boost (added to base):**

| Cloud | Boost | Why |
|-------|-------|-----|
| AWS | +15 | AWS Marketplace |
| Azure | +15 | Azure Marketplace |
| GCP | +10 | GCP Marketplace |
| None/Unknown | +0 | No marketplace play |

**Final Priority = Cohort Base + Cloud Boost**

Example: Triple Stack (100) + AWS (+15) = 115 = TOP TARGET

---

## BuiltWith API: Query by TECH

### API Endpoint (Lists API)
```
https://api.builtwith.com/lists/v6/lookup.json
```

### Query Pattern - Get domains using a technology

```bash
# Adobe AEM - Get ALL domains using this tech
GET /lists/v6/lookup.json?KEY={key}&TECH=Adobe%20Experience%20Manager

# Response: Array of domains
[
  { "Domain": "costco.com", "Company": "Costco Wholesale" },
  { "Domain": "target.com", "Company": "Target Corporation" },
  ...
]
```

### All 7 Tech Queries

```bash
# 1. Adobe AEM (CMS)
GET /lists/v6/lookup.json?KEY={key}&TECH=Adobe%20Experience%20Manager

# 2. Adobe Commerce (Commerce)
GET /lists/v6/lookup.json?KEY={key}&TECH=Magento

# 3. Adobe AEP (CDP)
GET /lists/v6/lookup.json?KEY={key}&TECH=Adobe%20Experience%20Platform

# 4. Salesforce Marketing Cloud (Marketing)
GET /lists/v6/lookup.json?KEY={key}&TECH=Salesforce%20Marketing%20Cloud

# 5. Salesforce Commerce Cloud (Commerce)
GET /lists/v6/lookup.json?KEY={key}&TECH=Salesforce%20Commerce%20Cloud

# 6. BigCommerce (Commerce)
GET /lists/v6/lookup.json?KEY={key}&TECH=BigCommerce

# 7. Shopify (Commerce)
GET /lists/v6/lookup.json?KEY={key}&TECH=Shopify
```

### Processing Results

```
Query 1 (AEM): 2,700 domains → tag has_adobe_aem = true
Query 2 (Magento): 10,000 domains → tag has_adobe_commerce = true
Query 3 (AEP): 800 domains → tag has_adobe_aep = true
...

Dedupe by domain:
- costco.com appears in AEM + AEP → has_adobe_aem=true, has_adobe_aep=true
- target.com appears in AEM + Magento + AEP → all 3 Adobe flags true
```

---

## Phase 1 Execution Steps

### Step 1: Query Each Tech
For each of the 7 partner technologies:
1. Call BuiltWith Lists API with TECH parameter
2. Collect all domains in response
3. Store in temporary list with tech flag

### Step 2: Deduplicate & Tag
1. Create unique domain list across all queries
2. For each domain, set boolean flags based on which tech lists it appeared in
3. Calculate derived fields:
   - `partner_tech_count` = count of true tech flags
   - `has_cms` = has_adobe_aem
   - `has_commerce` = has_adobe_commerce OR has_sfcc OR has_bigcommerce OR has_shopify
   - `has_marketing` = has_adobe_aep OR has_sfmc
   - `is_triple_stack` = has_cms AND has_commerce AND has_marketing
   - `is_cross_vendor` = (has Adobe product) AND (has Salesforce product OR has Shopify OR has BigCommerce)

### Step 3: Calculate Cohorts
For each domain, assign to cohorts:
```
IF is_triple_stack → "Triple Stack"
ELIF has_cms AND has_commerce → "CMS + Commerce"
ELIF has_cms AND has_marketing → "CMS + Marketing"
ELIF has_commerce AND has_marketing → "Commerce + Marketing"
ELIF has_adobe_aem AND has_adobe_commerce AND has_adobe_aep → "Adobe Full Stack"
... etc
```

### Step 4: Save to Supabase
```sql
INSERT INTO displacement_targets (
  domain,
  company_name,
  has_adobe_aem,
  has_adobe_commerce,
  has_adobe_aep,
  has_salesforce_marketing_cloud,
  has_salesforce_commerce_cloud,
  has_bigcommerce,
  has_shopify,
  partner_tech_count,
  is_s1_tech_partner,
  -- Cloud flags set to false/unknown until Phase 2
  has_aws,
  has_azure,
  has_gcp
)
VALUES (...)
ON CONFLICT (domain)
DO UPDATE SET
  has_adobe_aem = EXCLUDED.has_adobe_aem OR displacement_targets.has_adobe_aem,
  has_adobe_commerce = EXCLUDED.has_adobe_commerce OR displacement_targets.has_adobe_commerce,
  -- ... OR logic to accumulate tech flags
  is_s1_tech_partner = true;
```

### Step 5: Identify Jackpots for Phase 2
Query to find high-priority accounts for deep enrichment:
```sql
SELECT domain, partner_tech_count
FROM displacement_targets
WHERE partner_tech_count >= 3
   OR (has_adobe_aem AND (has_shopify OR has_sfcc OR has_bigcommerce))
ORDER BY partner_tech_count DESC
LIMIT 500;
```

---

## Phase 2: Deep Enrichment (ONLY for Jackpots)

### Domain Lookup API
```bash
GET /v21/api.json?KEY={key}&LOOKUP={domain}
```

Returns full tech stack including:
- Cloud hosting (AWS/Azure/GCP)
- Search provider (Algolia, Elasticsearch, etc.)
- All other technologies

### What to Extract
1. **Cloud Provider**: Look for AWS/Azure/GCP indicators
2. **Has Algolia**: If true, flag and deprioritize (not a displacement target)
3. **Current Search**: What search tech they use now (for displacement pitch)

### Update Jackpot Records
```sql
UPDATE displacement_targets
SET
  has_aws = true,
  has_azure = false,
  has_gcp = false,
  cloud_provider = 'aws',
  has_algolia = false,
  current_search = 'Elasticsearch',
  tech_stack_json = '{...}',
  enrichment_level = 'deep',
  last_enriched = NOW()
WHERE domain = 'costco.com';
```

---

## API Keys

```
BUILTWITH_API_KEY: 8fd992ef-88d0-4554-a20b-364e97b2d302
SUPABASE_URL: https://xbitqeejsgqnwvxlnjra.supabase.co
SUPABASE_SERVICE_KEY: [get from frontend/.env or Supabase dashboard]
```

---

## Expected Output

### Phase 1 Results (After 7 Queries)

| Partner Tech | Est. Domains | Notes |
|--------------|--------------|-------|
| Adobe AEM | 2,000-5,000 | Already have ~2,700 |
| Adobe Commerce | 10,000+ | Very popular |
| Adobe AEP | 500-1,000 | Enterprise only |
| Salesforce Marketing Cloud | 5,000+ | Common in enterprise |
| Salesforce Commerce Cloud | 3,000+ | B2C focused |
| BigCommerce | 50,000+ | Mid-market heavy |
| Shopify | 100,000+ | SMB to enterprise |

### After Deduplication

| Cohort | Est. Count | Priority |
|--------|------------|----------|
| Triple Stack (CMS + Commerce + Marketing) | 500-1,500 | **JACKPOT** |
| CMS + Commerce (cross-vendor) | 2,000-5,000 | Very High |
| CMS + Commerce (same vendor) | 1,000-3,000 | High |
| Adobe Full Stack | 500-1,000 | High |
| Adobe-Salesforce Joint | 500-2,000 | High |
| Single product only | 100,000+ | Standard |

### Phase 2 Results (After Jackpot Enrichment)

**Cloud Distribution Across Jackpots:**

| Cohort | Total | AWS | Azure | GCP | Unknown |
|--------|-------|-----|-------|-----|---------|
| Triple Stack | 500 | 225 (45%) | 100 (20%) | 50 (10%) | 125 (25%) |
| CMS + Commerce | 2,000 | 900 (45%) | 400 (20%) | 200 (10%) | 500 (25%) |

**Algolia Filter (Exclusions):**

| Condition | Est. Count |
|-----------|------------|
| Jackpots with Algolia (exclude) | 50-150 |
| **Final high-priority targets** | **400-800** |

---

## Success Criteria

### Phase 1 Complete When:
1. All 7 partner tech lists fetched from BuiltWith
2. Domains deduplicated across all queries
3. Tech flags set for each domain (multiple flags per domain OK)
4. Data saved to Supabase `displacement_targets` table
5. `is_s1_tech_partner = true` for all
6. `partner_tech_count` calculated
7. Cohorts identified (Triple Stack, CMS+Commerce, etc.)
8. Jackpot list generated (top 500 for Phase 2)

### Phase 2 Complete When:
9. Cloud hosting detected for all jackpots
10. Algolia users identified and flagged
11. Current search provider detected
12. Full tech stack stored in `tech_stack_json`

---

## GTM Plays Unlocked

### Cohort-Based Plays

| Cohort | Pitch |
|--------|-------|
| **Triple Stack** | "Uses AEM, Shopify, and SFMC - we integrate with all three" |
| **CMS + Commerce** | "AEM + Shopify - we bridge content and commerce search" |
| **Commerce + Marketing** | "Shopify + SFMC - unified search across storefront and campaigns" |
| **Cross-Vendor** | "Uses both Adobe and Salesforce - we're vendor-agnostic like you" |
| **Displacement** | "Currently using {X} for search, we can do better" |

### Cloud Filter Plays (Applied to Any Cohort)

| Cloud | Pitch Addition |
|-------|----------------|
| **AWS** | "...and you're on AWS - we're in AWS Marketplace, easy procurement" |
| **Azure** | "...and you're on Azure - we're in Azure Marketplace, easy procurement" |
| **GCP** | "...and you're on GCP - we're in GCP Marketplace" |

**Combined Example:**
- Account: Triple Stack + AWS
- Pitch: "Uses AEM, Shopify, and SFMC - we integrate with all three. And you're on AWS - we're in AWS Marketplace, easy procurement."

---

*Created: 2026-02-27*
*Updated: 2026-02-27 (corrected two-phase approach and cross-platform cohorts)*
*For: Arian parallel enrichment thread*
