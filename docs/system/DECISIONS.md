# Arian - Decision Log

This document captures all key technical and business decisions for the Arian project.

---

## 2026-02-27: Multi-Play Intersection Architecture

### Context
Originally designed Arian with three separate "plays" where each account belonged to ONE play.

### Decision
**Tag every account with ALL applicable plays using boolean flags, not a single enum.**

### Play Code Assignment
| Code | Play | Description |
|------|------|-------------|
| S1 | **Partner Tech** | Uses Adobe, Amplience, Spryker |
| S2 | **Target List** | On marketing ABM/named account list |
| S3 | **SI Connected** | Has EPAM, Isobar, Valtech relationship |

### Rationale
- An account can legitimately belong to multiple plays simultaneously
- A Target List account (S2) that ALSO uses partner tech (S1) is instantly validated
- Intersections represent the highest-value accounts:
  - S1+S2: "Marketing target that uses our partner tech" = **Partner Match**
  - S2+S3: "Marketing target that SI already knows" = **SI Warm Intro**
  - S1+S2+S3: "Jackpot" - validated from every angle

### Implementation
```sql
-- Three boolean columns instead of one enum
is_s1_tech_partner BOOLEAN DEFAULT false,    -- Uses partner tech
is_s2_target_list BOOLEAN DEFAULT false,     -- On marketing list
is_s3_si_connected BOOLEAN DEFAULT false,    -- Has SI relationship

-- Generated column for intersection count
play_intersection_count INTEGER GENERATED ALWAYS AS (...)
```

### Impact
- Dashboard shows intersection matrix as primary navigation
- Accounts with 2+ plays get priority boost (1.25x-1.5x multiplier)
- Play tags shown as badges on every account

---

## 2026-02-27: SI Partner Play Grouping

### Context
For S3 (SI Connected) play, needed to decide primary grouping: by SI partner (EPAM → accounts) or by competitor tech (Lucidworks → accounts).

### Decision
**Group by SI partner as primary, with competitor tech as secondary filter.**

### Rationale
- Sales teams are organized around partner relationships ("I own the EPAM relationship")
- The SI partner is the "go to market" partner who brings you in
- Competitor tech is important context but secondary
- Allows filtering within EPAM's book: "Show me EPAM accounts using Lucidworks"

### Implementation
```
EPAM (87 accounts) → [Competitor ▼] Lucidworks | Elasticsearch | All
```

---

## 2026-02-27: Orphan Accounts as a Cohort

### Context
Some accounts have competitor tech (Lucidworks, etc.) but NO SI partner relationship.

### Decision
**Treat "orphan accounts" as a distinct cohort, not as noise.**

### Rationale
- These are opportunities to pitch TO SI partners
- "We found 362 Lucidworks accounts you don't have relationships with yet"
- Could match orphans to SIs based on vertical/geography

### Implementation
- "Orphan Accounts" tile in S3 (SI Connected) view
- Option to assign orphans to SI partners

---

## 2026-02-27: Play-Specific Scoring Weights

### Context
The four-factor composite score (Fit/Intent/Value/Displacement) should weight differently based on play context.

### Decision
**Apply different weights by play type, with special handling for intersections.**

### Weights

| Factor | S1: Partner Tech | S2: Target List | S3: SI Connected | Intersection (2+) |
|--------|------------------|-----------------|------------------|-------------------|
| Fit | 20% | 30% | 15% | 20% |
| Intent | 25% | 25% | 20% | 25% |
| Value | 25% | 30% | 25% | 25% |
| Displacement | 30% | 15% | **40%** | 30% |

### Rationale
- **S1** emphasizes displacement (is their current search bad?)
- **S2** focuses on Fit + Value - pure ABM prioritization
- **S3 at 40% displacement**: The entire SI play is about ripping out competitors
- **Intersections use balanced weights**: Validation comes from multiple angles

---

## 2026-02-27: Crossbeam MVP via CSV

### Context
Crossbeam is a partner ecosystem platform showing overlaps. Could integrate via API or CSV import.

### Decision
**MVP uses CSV import; API integration planned for later.**

### Rationale
- Faster to ship and validate the intersection model
- Crossbeam API requires OAuth setup and rate limit handling
- CSV export is already a standard Crossbeam workflow
- Can iterate on data model before committing to API schema

### Implementation
1. User exports "Account Overlaps" from Crossbeam
2. Uploads CSV to Arian
3. System parses, matches by domain, tags plays (S1 and S3)
4. Intersection counts update automatically

---

## 2026-02-27: Intersection Priority Multiplier

### Context
Need to surface high-value intersection accounts in scoring/sorting.

### Decision
**Apply multiplier to composite score based on intersection count.**

### Formula
```
Final Priority = Composite Score × Intersection Multiplier

Multipliers:
- 3 plays (Jackpot): 1.5x
- 2 plays: 1.25x
- 1 play: 1.0x
```

### Rationale
- An 80-score account with 3 plays (80 × 1.5 = 120) should rank higher than a 90-score account with 1 play
- Multiplier is applied AFTER composite score so base signals still matter
- Caps at 100 for display but preserves sort order

---

## 2026-02-27: User-Facing Terminology

### Context
Internal codes S1, S2, S3 are convenient for documentation but confusing for users.

### Decision
**Use human-readable labels in UI, not internal codes.**

### Terminology Mapping

| Internal | User Label | Icon |
|----------|------------|------|
| S1 | **Partner Tech** | 🤝 |
| S2 | **Target List** | 📋 |
| S3 | **SI Connected** | 🔗 |

**Intersection Labels:**

| Internal | User Label |
|----------|------------|
| S1+S2+S3 | **⭐ Jackpot** |
| S1+S2 | **🤝 Partner Match** |
| S2+S3 | **🔗 SI Warm Intro** |
| S1+S3 | **🤝🔗 Co-Sell Ready** |

### Account Badges Show Context, Not Codes

```
❌ Wrong: [S1] [S2] [S3]
✅ Right: [🤝 Adobe] [📋 ABM List] [🔗 EPAM]
```

### Rationale
- Users don't need to learn internal terminology
- Badges show the actual partner/list name
- Self-explanatory at a glance

---

## 2026-02-27: Dashboard Entry Point

### Context
Original dashboard showed partner selection first. With three plays, needed new entry point.

### Decision
**Dashboard shows intersection matrix as primary view with human-readable labels.**

### Layout
```
┌────────────────────────────────────────────────────────────┐
│ High-Value Matches                                         │
│ ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │
│ │ JACKPOT  │ │ PARTNER    │ │ SI WARM    │ │ CO-SELL   │ │
│ │          │ │ MATCH      │ │ INTRO      │ │ READY     │ │
│ └──────────┘ └────────────┘ └────────────┘ └───────────┘ │
│                                                            │
│ Single-Signal Accounts                                     │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│ │Partner Tech│ │Target List │ │SI Connected│             │
│ └────────────┘ └────────────┘ └────────────┘             │
└────────────────────────────────────────────────────────────┘
```

### Rationale
- Immediately surfaces highest-value accounts
- Human-readable labels, not codes
- Shows the power of the intersection model upfront

---

## 2026-02-27: S1 Partner Tech Play - Deep Dive

### Context
The S1 (Partner Tech) play needs detailed specification: which partners, what data to collect, how to prioritize.

### Decision
**Track 7 partner technologies + 3 hyperscalers. Prioritize accounts with multiple partner techs and cloud hosting.**

### Partner Tech Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        S1: PARTNER TECH ECOSYSTEM                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────┐     ┌─────────────────────┐                   │
│   │      ADOBE          │     │     SALESFORCE      │                   │
│   │  ┌─────────────┐    │     │  ┌─────────────┐    │                   │
│   │  │ AEM (CMS)   │    │     │  │ Marketing   │    │                   │
│   │  └─────────────┘    │     │  │ Cloud       │    │                   │
│   │  ┌─────────────┐    │     │  └─────────────┘    │                   │
│   │  │ Commerce    │    │     │  ┌─────────────┐    │                   │
│   │  │ (Magento)   │    │     │  │ Commerce    │    │                   │
│   │  └─────────────┘    │     │  │ Cloud       │    │                   │
│   │  ┌─────────────┐    │     │  └─────────────┘    │                   │
│   │  │ Experience  │    │     │                     │                   │
│   │  │ Platform    │    │     │                     │                   │
│   │  └─────────────┘    │     │                     │                   │
│   └─────────────────────┘     └─────────────────────┘                   │
│                                                                          │
│   ┌─────────────────────┐     ┌─────────────────────┐                   │
│   │   OTHER PARTNERS    │     │    HYPERSCALERS     │                   │
│   │  ┌─────────────┐    │     │  ┌─────────────┐    │                   │
│   │  │ BigCommerce │    │     │  │    AWS      │ ←── Marketplace       │
│   │  └─────────────┘    │     │  └─────────────┘    │                   │
│   │  ┌─────────────┐    │     │  ┌─────────────┐    │                   │
│   │  │  Shopify    │    │     │  │   Azure     │ ←── Marketplace       │
│   │  └─────────────┘    │     │  └─────────────┘    │                   │
│   │                     │     │  ┌─────────────┐    │                   │
│   │                     │     │  │    GCP      │ ←── Marketplace       │
│   │                     │     │  └─────────────┘    │                   │
│   └─────────────────────┘     └─────────────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cross-Stack Intersection Model

```
              ADOBE                           SALESFORCE
         ┌─────────────┐                  ┌─────────────┐
         │ AEM+Commerce│                  │ SFMC+SFCC   │
         │   +AEP      │                  │             │
         │             │                  │             │
         │    MULTI-   │                  │   MULTI-    │
         │    ADOBE    │◄─────────────────│  SALESFORCE │
         │             │   JOINT          │             │
         │ "Stickiness"│   CUSTOMER       │ "Stickiness"│
         │   Pitch     │                  │   Pitch     │
         └──────┬──────┘                  └──────┬──────┘
                │                                │
                │    ┌──────────────────┐       │
                └───►│  ADOBE + SFMC    │◄──────┘
                     │  JOINT CUSTOMER  │
                     │                  │
                     │ "Cross-ecosystem │
                     │    co-sell"      │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  + HYPERSCALER   │
                     │   (AWS/Azure)    │
                     │                  │
                     │  "TRIPLE PLAY"   │
                     │  Partner + Cloud │
                     │   + Algolia      │
                     └──────────────────┘
```

### Priority Matrix

| Priority | Condition | GTM Play | Pitch |
|----------|-----------|----------|-------|
| **HIGHEST** | Multi-partner + Hyperscaler | Triple co-sell | "Adobe customer on AWS, we're in both marketplaces" |
| **VERY HIGH** | Adobe + Salesforce joint | Cross-ecosystem | "Joint Adobe-Salesforce customer" |
| **HIGH** | 3+ partner techs | Max stickiness | "Uses 3 of your products, we integrate with all" |
| **HIGH** | Partner tech + AWS | AWS co-sell | "We're in AWS Marketplace" |
| **HIGH** | Partner tech + Azure | Azure co-sell | "We're in Azure Marketplace" |
| **MEDIUM** | 2 partner techs | Cross-sell | "Uses both Commerce + Marketing" |
| **STANDARD** | 1 partner tech | Single path | "Uses your CMS, needs search" |

### UI Mock: Partner Tech Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🤝 Partner Tech Play                                    [Filters ▼] [Export]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CROSS-STACK OPPORTUNITIES (Highest Priority)                         │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │ │🔥 TRIPLE    │ │⚡ ADOBE+    │ │📦 MULTI-    │ │☁️ CLOUD      │    │   │
│  │ │   PLAY      │ │ SALESFORCE  │ │   ADOBE     │ │  CO-SELL    │    │   │
│  │ │             │ │             │ │             │ │             │    │   │
│  │ │   127       │ │    892      │ │   2,341     │ │   4,567     │    │   │
│  │ │  accounts   │ │  accounts   │ │  accounts   │ │  accounts   │    │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ BY PARTNER                                                           │   │
│  │ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐ │   │
│  │ │  ADOBE    │ │SALESFORCE │ │BIGCOMMERCE│ │  SHOPIFY  │ │ OTHER  │ │   │
│  │ │           │ │           │ │           │ │           │ │        │ │   │
│  │ │  5,234    │ │  3,892    │ │  12,456   │ │  28,901   │ │  1,234 │ │   │
│  │ └───────────┘ └───────────┘ └───────────┘ └───────────┘ └────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ BY CLOUD HOSTING                                                     │   │
│  │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐              │   │
│  │ │     AWS       │ │    AZURE      │ │     GCP       │              │   │
│  │ │   18,234      │ │    8,901      │ │    4,567      │              │   │
│  │ │ (45% of total)│ │ (22% of total)│ │ (11% of total)│              │   │
│  │ └───────────────┘ └───────────────┘ └───────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### UI Mock: Account Row with Partner Badges

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Domain        Company       Partner Tech                Cloud    Score     │
├─────────────────────────────────────────────────────────────────────────────┤
│ costco.com    Costco       [🤝 AEM] [🤝 AEP] [🤝 SFMC]  [☁️ AWS]   92 🔥  │
│                            └── TRIPLE PLAY ──┘                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ target.com    Target       [🤝 AEM] [🤝 Commerce] [🤝 AEP]  [☁️ Azure] 88 🔥│
│                            └── MULTI-ADOBE ──┘                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ gap.com       Gap          [🤝 SFCC]                    [☁️ AWS]   76 🔥  │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ allbirds.com  Allbirds     [🤝 Shopify]                 [☁️ AWS]   71 🔥  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
// Partner tech flags
has_adobe_aem: boolean;
has_adobe_commerce: boolean;
has_adobe_aep: boolean;
has_salesforce_marketing_cloud: boolean;
has_salesforce_commerce_cloud: boolean;
has_bigcommerce: boolean;
has_shopify: boolean;

// Cloud hosting
has_aws: boolean;
has_azure: boolean;
has_gcp: boolean;
cloud_provider: 'aws' | 'azure' | 'gcp' | 'other';

// Cross-stack flags
is_multi_adobe: boolean;           // 2+ Adobe products
is_multi_salesforce: boolean;      // 2+ Salesforce products
is_adobe_salesforce_joint: boolean; // Both ecosystems
partner_tech_count: number;        // 0-7
```

### Implementation

1. **Data Source:** BuiltWith API
2. **Detection:** Domain lookup returns full tech stack
3. **Tagging:** Parse for all 7 partner techs + 3 clouds
4. **Filtering:** Exclude accounts already using Algolia
5. **Storage:** Supabase `displacement_targets` table

---

## 2026-02-26: Secure Upload via Edge Function

### Context
Frontend was calling Supabase REST API directly with anon key, which failed on INSERT due to RLS.

### Decision
**Use Supabase Edge Function with service_role key for uploads.**

### Rationale
- service_role key must stay server-side (never in frontend)
- Edge Function provides secure server-side execution
- Allows upsert logic without exposing credentials

### Implementation
- Edge Function: `supabase/functions/upload-targets/index.ts`
- Uses `SUPABASE_SERVICE_ROLE_KEY` from environment
- Frontend calls Edge Function, not REST API directly

---

## 2026-02-26: Upsert for Re-uploads

### Context
What happens when user uploads same data twice? Or wants to fix bad data?

### Decision
**Always upsert on domain conflict, update existing records.**

### Implementation
```typescript
.upsert(rows, {
  onConflict: 'domain',
  ignoreDuplicates: false, // Update existing records
})
```

### Rationale
- Users can fix data by re-uploading corrected CSV
- Domain is natural unique key for accounts
- Better than requiring manual cleanup of duplicates

---

## Earlier Decisions

### Composite Scoring (2026-02-26)
- Four factors: Fit, Intent, Value, Displacement
- Each factor 25% weight (adjusted by play type)
- Score thresholds: 70+ Hot, 40-69 Warm, 0-39 Cold

### Enrichment Architecture (2026-02-26)
- v3 umbrella pattern: one module per source
- Sources: SimilarWeb, BuiltWith, Yahoo Finance, SEC EDGAR, WebSearch, JSearch
- `enrichAndSave()` calculates composite score and persists

### Shared Libraries (2026-02-26)
- Colors defined in `@/lib/constants` (never inline)
- Status order sacred: Hot → Warm → Cold
- FilterHeader component for all filter UIs

---

*Last updated: 2026-02-27*
