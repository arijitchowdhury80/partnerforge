# Arian Decision Log

## 2026-02-27: Sales Machinery & ICP Validation

### Decision 6: Four-Layer Cascading Funnel (THE SALES MACHINERY)
**Decision:** Implement a four-layer cascading funnel instead of flat scoring

**Layers:**
1. **Partner Tech Cohort** - Filter by tech stack (CMS + Commerce + Hyperscaler = JACKPOT)
2. **ICP Filter** - Score against data-derived ICP (Fashion/Grocery + Enterprise + Elastic displacement)
3. **Sales Play Intersection** - Apply play multipliers (Triple Play = 1.5x)
4. **GTM Campaign** - Assign ABM treatment (1:1, 1:Few, 1:Many)

**Rationale:**
- Traditional flat scoring treats all accounts equally
- Fashion has 65% of proof points, SaaS has 0% - they are NOT equal
- Cascade filters FIRST, then scores within filtered set
- Result: 2,800 → 200 → 60 → 15 → 10-15 ABM 1:1 targets

**Impact:** Created SALES_MACHINERY.md as definitive reference

---

### Decision 7: Data-Derived ICP (Not Theoretical)
**Decision:** Define ICP from actual customer evidence, not assumptions

**Data Source:** Customer Evidence - Algolia.xlsx
- 1,306 customer logos
- 379 customer quotes
- 82 customer stories
- 81 quantified proof points

**Key Findings:**
- Fashion: 65% of proof points (53/81)
- Grocery: 35% of proof points (28/81)
- SaaS: 0% proof points (despite 15% of quotes)
- Media: 0% proof points (only 5% of quotes)

**Impact:** Created ICP_ANALYSIS.md v2.0 (100% validated) and ICP_DEFINITION.md

---

### Decision 8: Fashion & Grocery = Tier 1 Verticals
**Decision:** Elevate Fashion and Grocery to Tier 1 ICP (above general "E-Commerce")

**Rationale:**
- Combined: 100% of ALL quantified proof points
- Traditional ICP says "E-Commerce" generically
- Data shows Fashion (65%) and Grocery (35%) are where Algolia wins

**Impact:** ICP scoring gives Fashion/Grocery score of 100, General Retail only 75

---

### Decision 9: Media Downgraded to Tier 3
**Decision:** Downgrade Media from Tier 2 (traditional ICP) to Tier 3

**Rationale:**
- Media has only 5.5% of logos, 4.7% of quotes
- 0 proof points
- Traditional ICP overvalues Media

**Impact:** Media ICP score = 40 (not 75)

---

### Decision 10: SaaS Needs Case Studies (Gap Identified)
**Decision:** Flag SaaS as needing urgent case study development

**Rationale:**
- SaaS has 14.8% of quotes (customers speak positively)
- But 0% of proof points (no quantified success)
- Cannot defend SaaS deals without proof points

**Impact:** Added to roadmap; SaaS ICP score = 70 (medium confidence)

---

### Decision 11: Traditional ICP Validated at 71%
**Decision:** Traditional Algolia ICP is directionally correct but lacks specificity

**Validated (71%):**
- E-Commerce is Tier 1 ✓
- Technical + Business buyers ✓
- Multi-threading matters ✓
- Expensive platforms = signal ✓

**Overstated (6%):**
- Media is NOT Tier 2

**Missing (23%):**
- Fashion = 65% of success
- Grocery = 35% of success
- Geographic guidance (US 33%, EMEA 41%)
- Company size guidance

**Impact:** Updated ICP documentation with data-backed recommendations

---

### Decision 12: Partner Tech Cohort Hierarchy
**Decision:** Define cohort hierarchy with JACKPOT at the top

| Cohort | Components | Score |
|--------|------------|-------|
| JACKPOT | CMS + Commerce + Hyperscaler | 100 |
| JACKPOT | CMS + Commerce + Marketing | 95 |
| HIGH | CMS + Commerce | 85 |
| STANDARD | Commerce Only | 60 |
| STANDARD | CMS Only | 50 |
| LOW | Marketing Only | 40 |

**Rationale:** Accounts with 3 partner tech categories signal enterprise-grade investment

**Impact:** Created COHORT_DEFINITION.md; Layer 1 filters to ~200 JACKPOT accounts

---

### Decision 13: ABM Treatment by Play Intersection
**Decision:** Assign ABM campaign type based on play intersection count

| Intersection | Campaign | Accounts |
|--------------|----------|----------|
| Triple Play (S1+S2+S3) | ABM 1:1 | 10-15 |
| Double Play | ABM 1:Few | 25-40 |
| Single Play | ABM 1:Many | 50-100 |

**Rationale:** Triple Play accounts are validated from every angle - highest conversion probability

**Impact:** Created campaign templates in SALES_MACHINERY.md

---

### Decision 14: Documentation for Leadership Approval
**Decision:** Create comprehensive visual documentation for leadership sign-off

**Deliverables:**
- SALES_MACHINERY.md - Technical reference
- sales-machinery-pitch.html - 10-page presentation with charts
- arian-interactive.html - Interactive scroll story
- ARIAN_STORY.md - 18-step narrative for NotebookLM

**Rationale:** Need leadership approval before building screens; visual story required

**Impact:** All documents created and ready for presentation

---

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
