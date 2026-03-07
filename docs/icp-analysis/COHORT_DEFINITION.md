# Partner Tech Cohort Definition

**Version:** 1.0
**Date:** 2026-02-27
**Purpose:** Define partner tech cohorts for cascading ICP filter

---

## 1. PARTNER TECH CATEGORIES

### CMS (Content Management Systems)

| Platform | Code | Tier |
|----------|------|------|
| Adobe AEM | CMS-AEM | Enterprise |
| Contentful | CMS-CONTENTFUL | Mid-Market |
| Amplience | CMS-AMPLIENCE | Mid-Market |
| Contentstack | CMS-CSTACK | Mid-Market |
| Sitecore | CMS-SITECORE | Enterprise |
| Drupal | CMS-DRUPAL | Growth |

### Commerce (E-Commerce Platforms)

| Platform | Code | Tier |
|----------|------|------|
| Salesforce Commerce Cloud (SFCC) | COM-SFCC | Enterprise |
| SAP Commerce (Hybris) | COM-SAP | Enterprise |
| Adobe Commerce (Magento) | COM-MAGENTO | Mid-Market/Enterprise |
| Shopify Plus | COM-SHOPIFY | Mid-Market |
| Commercetools | COM-CTOOLS | Mid-Market |
| BigCommerce | COM-BIGC | Growth |

### Marketing (Marketing Automation / Personalization)

| Platform | Code | Tier |
|----------|------|------|
| Salesforce Marketing Cloud | MKT-SFMC | Enterprise |
| Adobe Target | MKT-TARGET | Enterprise |
| Dynamic Yield | MKT-DY | Mid-Market |
| Braze | MKT-BRAZE | Mid-Market |
| Klaviyo | MKT-KLAVIYO | Growth/Mid-Market |

### Hyperscaler (Cloud Infrastructure)

| Platform | Code | Tier |
|----------|------|------|
| AWS | CLOUD-AWS | All |
| Azure | CLOUD-AZURE | All |
| Google Cloud | CLOUD-GCP | All |

---

## 2. PARTNER TECH COHORT HIERARCHY

### Cohort Scoring

| Cohort | Components | Cohort Score | Priority |
|--------|------------|--------------|----------|
| **CMS + Commerce + Hyperscaler** | All 3 | **100** | JACKPOT |
| **CMS + Commerce + Marketing** | 3 categories | **95** | JACKPOT |
| **CMS + Commerce** | 2 categories | **85** | HIGH |
| **Commerce + Marketing** | 2 categories | **80** | HIGH |
| **CMS + Marketing** | 2 categories | **75** | MEDIUM |
| **Commerce + Hyperscaler** | 2 categories | **75** | MEDIUM |
| **CMS + Hyperscaler** | 2 categories | **70** | MEDIUM |
| **Commerce Only** | 1 category | **60** | STANDARD |
| **CMS Only** | 1 category | **50** | STANDARD |
| **Marketing Only** | 1 category | **40** | LOW |
| **Hyperscaler Only** | 1 category | **30** | LOW |

---

## 3. COHORT EXAMPLES

### JACKPOT: CMS + Commerce + Hyperscaler (Score: 100)

| Company | CMS | Commerce | Hyperscaler |
|---------|-----|----------|-------------|
| Costco | Adobe AEM | SFCC | AWS |
| Under Armour | Contentful | SFCC | AWS |
| Gap Inc | Adobe AEM | SFCC | Azure |

**Why JACKPOT:**
- Enterprise-grade stack = large deal size
- Complex integration = stickiness
- Multiple decision-makers = multi-threading opportunity
- High investment in digital = values search

### HIGH: CMS + Commerce (Score: 85)

| Company | CMS | Commerce |
|---------|-----|----------|
| Fashion Brand X | Amplience | Shopify Plus |
| Retailer Y | Contentful | Commercetools |

**Why HIGH:**
- Modern headless stack = technical sophistication
- Commerce platform = sells products (Tier 1 ICP)
- CMS = content-rich experience

### STANDARD: Commerce Only (Score: 60)

| Company | Commerce |
|---------|----------|
| DTC Brand Z | Shopify |
| B2B Distributor | SAP Commerce |

**Why STANDARD:**
- Good fit but less complex
- Smaller deal size typically
- Faster sales cycle but lower ACV

---

## 4. COHORT DETECTION LOGIC

### From BuiltWith Data

```javascript
function detectCohort(builtWithTechs) {
  const hasCMS = techs.some(t => CMS_PLATFORMS.includes(t));
  const hasCommerce = techs.some(t => COMMERCE_PLATFORMS.includes(t));
  const hasMarketing = techs.some(t => MARKETING_PLATFORMS.includes(t));
  const hasHyperscaler = techs.some(t => HYPERSCALER_PLATFORMS.includes(t));

  // Count categories
  const categoryCount = [hasCMS, hasCommerce, hasMarketing, hasHyperscaler]
    .filter(Boolean).length;

  // Determine cohort
  if (hasCMS && hasCommerce && hasHyperscaler) return 'JACKPOT_CMS_COM_HYPER';
  if (hasCMS && hasCommerce && hasMarketing) return 'JACKPOT_CMS_COM_MKT';
  if (hasCMS && hasCommerce) return 'HIGH_CMS_COM';
  if (hasCommerce && hasMarketing) return 'HIGH_COM_MKT';
  if (hasCMS && hasMarketing) return 'MEDIUM_CMS_MKT';
  if (hasCommerce && hasHyperscaler) return 'MEDIUM_COM_HYPER';
  if (hasCommerce) return 'STANDARD_COM';
  if (hasCMS) return 'STANDARD_CMS';
  if (hasMarketing) return 'LOW_MKT';
  if (hasHyperscaler) return 'LOW_HYPER';

  return 'UNKNOWN';
}
```

---

## 5. COHORT → ICP MAPPING

### Which ICP dimensions apply to which cohorts?

| Cohort | Primary ICP Filters | Secondary Filters |
|--------|---------------------|-------------------|
| **JACKPOT** | Vertical + Size + Competitor | Geography + Persona |
| **HIGH** | Vertical + Competitor | Size + Geography |
| **MEDIUM** | Vertical | Size |
| **STANDARD** | Vertical | - |
| **LOW** | - | - |

**Logic:** Higher cohorts get more ICP filters applied because we can afford to be selective. Lower cohorts get fewer filters because the pool is smaller.

---

## 6. CASCADING FILTER FUNNEL

```
ALL PARTNER TECH TARGETS
│
├─ Step 1: Cohort Classification
│  └─ JACKPOT (CMS+Commerce+Hyper) ──────────────────────┐
│  └─ HIGH (CMS+Commerce, Commerce+Marketing) ───────────┤
│  └─ MEDIUM (CMS+Marketing, etc.) ──────────────────────┤
│  └─ STANDARD (Commerce Only, CMS Only) ────────────────┤
│  └─ LOW (Marketing Only, Hyperscaler Only) ────────────┤
│                                                        │
├─ Step 2: ICP Filter (on JACKPOT first)                 │
│  └─ JACKPOT accounts                                   │
│      ├─ ICP Tier 1 (Fashion/Grocery + Enterprise) ─────┼──→ PRIORITY 1
│      ├─ ICP Tier 2 (Retail + Mid-Market) ──────────────┼──→ PRIORITY 2
│      └─ ICP Tier 3 (SaaS/B2B) ─────────────────────────┼──→ PRIORITY 3
│                                                        │
├─ Step 3: Play Intersection (on Priority 1)             │
│  └─ PRIORITY 1 accounts                                │
│      ├─ S1+S2+S3 (Triple Play) ────────────────────────┼──→ CAMPAIGN A
│      ├─ S1+S2 (Tech + Target List) ────────────────────┼──→ CAMPAIGN B
│      └─ S1 Only (Tech Partner) ────────────────────────┼──→ CAMPAIGN C
│                                                        │
└─ Step 4: GTM Campaign Assignment                       │
   └─ CAMPAIGN A: ABM 1:1 (Hyper-personalized)           │
   └─ CAMPAIGN B: ABM 1:Few (Segment-based)              │
   └─ CAMPAIGN C: ABM 1:Many (Programmatic)              │
```

---

## 7. EXPECTED ACCOUNT DISTRIBUTION

### Based on Current Arian Data (~2,800 accounts)

| Cohort | Expected % | Est. Count | ICP Tier 1 | Final Targets |
|--------|------------|------------|------------|---------------|
| **JACKPOT** | 5-10% | 140-280 | 30-40% | **42-112** |
| **HIGH** | 15-20% | 420-560 | 25-35% | 105-196 |
| **MEDIUM** | 20-25% | 560-700 | 20-30% | 112-210 |
| **STANDARD** | 30-35% | 840-980 | 15-25% | 126-245 |
| **LOW** | 15-20% | 420-560 | 10-15% | 42-84 |

**Key Insight:** JACKPOT cohort is small (5-10% of total) but highest value. After ICP filter, we're talking **42-112 accounts** that are true JACKPOT + ICP Tier 1.

---

## 8. GTM CAMPAIGN TEMPLATES BY COHORT × ICP

### JACKPOT + ICP Tier 1 + S1+S2+S3 (Triple Play)

| Element | Value |
|---------|-------|
| **Campaign Type** | ABM 1:1 |
| **Target Personas** | CTO, COO, Director Digital Experience |
| **Primary Message** | "Your stack is ready for AI Search" |
| **Proof Points** | Fashion: 65% of customers, 3-8% CVR lift |
| **SI Leverage** | Warm intro via SI partner |
| **Channels** | Direct outreach, LinkedIn, Executive dinner |
| **Sequence** | 8-touch, 45 days |

### JACKPOT + ICP Tier 1 + S1+S2 (Tech + Target List)

| Element | Value |
|---------|-------|
| **Campaign Type** | ABM 1:Few |
| **Target Personas** | CTO, VP Engineering, Director E-Commerce |
| **Primary Message** | "Join [similar company] in displacing [competitor]" |
| **Proof Points** | Competitor displacement stories |
| **SI Leverage** | N/A (no SI connection) |
| **Channels** | LinkedIn, Email, Paid social |
| **Sequence** | 6-touch, 30 days |

### HIGH + ICP Tier 2 (CMS+Commerce, Retail)

| Element | Value |
|---------|-------|
| **Campaign Type** | ABM 1:Many |
| **Target Personas** | Engineering Manager, Sr Manager Merchandising |
| **Primary Message** | "AI search that works out of the box" |
| **Proof Points** | Speed to implement, time-to-value |
| **Channels** | Email nurture, Content syndication |
| **Sequence** | 5-touch, 21 days |

---

*Version 1.0 - Partner Tech Cohort Definition*
*Last Updated: 2026-02-27*
