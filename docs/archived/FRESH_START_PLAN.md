# Fresh Start Plan - Partner Intelligence Platform

## Proposed Technology List

### COMMERCE (Priority: Highest - Primary ICP)
1. **Shopify Plus** - Enterprise Shopify (Priority: 95)
2. **Magento / Adobe Commerce** - Open source + enterprise (Priority: 90)
3. **Salesforce Commerce Cloud** - Enterprise B2C/B2B (Priority: 85)
4. **BigCommerce** - Mid-market to enterprise (Priority: 80)
5. **commercetools** - Headless commerce (Priority: 75)
6. **Spryker** - B2B/complex commerce (Priority: 70)

### CMS (Priority: High)
1. **Adobe Experience Manager** - Enterprise CMS (Priority: 90)
2. **Contentful** - Headless CMS (Priority: 85)
3. **Contentstack** - Headless CMS (Priority: 80)
4. **Amplience** - Content for commerce (Priority: 75)
5. **Sitecore** - Enterprise CMS (Priority: 70)

### MARTECH (Priority: Medium)
1. **Salesforce Marketing Cloud** - Enterprise automation (Priority: 85)
2. **Marketo** - Marketing automation (Priority: 80)
3. **HubSpot** - Inbound marketing (Priority: 75)
4. **Klaviyo** - E-commerce automation (Priority: 70)

~~### SEARCH - Competitors~~ ❌ REMOVED
**We will NOT query for search competitor customers.**
Search tech (Algolia, Coveo, Bloomreach, etc.) will be detected via **Domain API enrichment** after we have the target list.

~~### CLOUD~~ ❌ REMOVED
**We will NOT query for all AWS/Azure customers.**
Cloud provider (AWS, Azure, GCP, etc.) will be detected via **Domain API enrichment** after we have the target list.

**Total: 15 technologies** (Commerce + CMS + MarTech only)

---

## The Clean Restart Workflow

### Step 1: Create Technologies Table ✅
```sql
-- Run migration: 004-create-technologies-table.sql
-- Run seed: 005-seed-technologies.sql
```

### Step 2: Clear Companies Table
```sql
-- DELETE ALL existing data
TRUNCATE companies CASCADE;
```

### Step 3: Fetch Fresh Data from BuiltWith Lists API
For each active technology (Commerce, CMS, MarTech only):
- Call BuiltWith Lists API
- Get all domains using that technology
- Store in companies table with proper tech categorization
- **Expected: 15 API calls** (6 Commerce + 5 CMS + 4 MarTech)

### Step 4: Algolia Customer Exclusion ⚠️ NEED TO SOLVE
**Options:**
1. **Use BuiltWith search_tech field** - Query BuiltWith to detect Algolia usage
2. **Export from Salesforce** - Get list of active Algolia customers
3. **Manual exclusion list** - Maintain known_algolia_customers.json
4. **Combination** - Use all three sources

**Which approach do you want?**

### Step 5: Run 4-Phase Sanitization
1. Domain quality filter
2. Traffic validation (2-3 sources)
3. Industry classification
4. ICP filtering

---

## Questions Before We Execute:

### 1. Technology List - Approve or Modify?
- Are these the right 26 technologies?
- Any missing? (e.g., Adobe Target, specific MarTech tools?)
- Any to remove?

### 2. Algolia Customer Exclusion - How?
**I need a source of truth for existing Algolia customers.**

Options:
- A. I can query BuiltWith to detect Algolia (search_tech = "Algolia")
- B. You export a CSV from Salesforce with customer domains
- C. We use the small known_algolia_customers.json (only 10 domains)
- D. Combination of A + B

**Which one?**

### 3. ICP Definition - What IS Your ICP?
You said airlines, telecom, enterprise manufacturing are NOT ICP.

Is your ICP:
- ✅ Retail/E-commerce selling physical products (B2C)
- ✅ D2C brands (apparel, home goods, beauty, etc.)
- ✅ Marketplaces
- ❌ Airlines
- ❌ Telecom
- ❌ Enterprise manufacturing
- ❌ B2B SaaS platforms
- ? Media/Publishing (content discovery)?
- ? Travel/Hospitality?

**Define it clearly so Phase 4 ICP filtering works correctly.**

---

## Ready to Execute?

Once you approve:
1. Technologies list
2. Algolia customer exclusion method
3. ICP definition

I'll:
1. ✅ Run the migrations (create technologies table with 15 technologies)
2. ✅ Clear companies table
3. ✅ Fetch fresh data from BuiltWith Lists API (15 API calls)
4. ✅ Apply Algolia customer exclusion
5. ✅ Run 4-phase sanitization
6. ✅ For qualified targets: Enrich with Domain API (get search_tech, cloud_tech, full tech stack)
7. ✅ Give you a clean, qualified target list with displacement opportunities

**Approve to proceed?**
