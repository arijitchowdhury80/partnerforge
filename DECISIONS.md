# PartnerForge Decision Log

## 2026-02-27: Crossbeam Integration & JACKPOT Analysis

### Decision 1: Multi-Layer Data Architecture
**Decision:** Build data layers: Whale → ZoomInfo → Crossbeam → JACKPOT intersection

**Rationale:**
- Whale accounts (772) are Demandbase-qualified, but not all are Adobe customers
- Crossbeam overlaps (489) are Adobe AEM customers who are Algolia prospects
- Intersection (41) is validated from multiple angles = highest priority

**Impact:** Created `jackpot_accounts` view for easy querying

---

### Decision 2: Industry Mapping Strategy
**Decision:** Create translation table from Crossbeam industries to unified Demandbase taxonomy

**Rationale:**
- Crossbeam uses different industry names (e.g., "Manufacturing - Consumer Goods")
- Unified taxonomy uses Demandbase names (e.g., "Consumer Product Manufacturing")
- Without mapping, only 35% exact match; with mapping, 100% aligned

**Impact:** Created `industry_mapping` table with 28 mappings

---

### Decision 3: Hyperscaler as Overlay (Not Primary List)
**Decision:** Do NOT fetch AWS/Azure as separate lists; use as overlay filter on cohorts

**Rationale:**
- AWS has millions of customers - too broad
- We care about OUR cohorts that ALSO use hyperscalers
- Question is "which of our targets use AWS?" not "who uses AWS?"

**Impact:** Cohort query structure: `(CMS + Commerce) WHERE hyperscaler = 'AWS'`

---

### Decision 4: JACKPOT Priority (Engaged + Adobe)
**Decision:** Accounts already in "Engagement" stage with Adobe AEM are top priority

**Rationale:**
- 13 of 41 JACKPOT accounts are already engaged with Algolia
- These are warm leads with partner validation
- Combined: $1.0T revenue, pre-qualified buyers

**Impact:** Hot 13 list for immediate outreach

---

### Decision 5: Commerce Platform as Displacement Signal
**Decision:** Track has_shopify_plus, has_salesforce_commerce_cloud, has_magento as priority signals

**Rationale:**
- Commerce platforms need search
- 10/41 JACKPOT accounts have commerce platforms
- Higher displacement potential than non-commerce

**Impact:** Added commerce_platform flag to jackpot_accounts view

---

## Earlier Decisions (2026-02-27)

### Three Plays Model (S1, S2, S3)
- **S1 Tech Partner:** Uses partner tech (Adobe, Amplience)
- **S2 Target List:** On marketing list
- **S3 SI Connected:** Has SI relationship (EPAM, Isobar)

**Key insight:** Accounts with MULTIPLE plays are highest priority (intersection model)

### Boolean Play Columns
**Decision:** Use 3 boolean columns, NOT single enum

**Rationale:** Accounts can be in multiple plays simultaneously

```sql
is_s1_tech_partner BOOLEAN DEFAULT false,
is_s2_target_list BOOLEAN DEFAULT false,
is_s3_si_connected BOOLEAN DEFAULT false,
```

### Crossbeam MVP via CSV
**Decision:** Start with CSV import, not API integration

**Rationale:** Faster to ship; Crossbeam API access TBD

### Priority Multiplier
**Decision:** Apply multiplier based on play intersections

```
3 plays: 1.5x
2 plays: 1.25x
1 play: 1.0x
```
