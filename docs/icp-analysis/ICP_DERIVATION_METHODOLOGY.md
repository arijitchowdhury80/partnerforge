# ICP Derivation Methodology

**Version:** 1.0
**Date:** 2026-02-27
**Status:** Active

---

## Core Principle

**Data-Driven ICP, Not Theoretical ICP**

Traditional ICP approaches start with assumptions ("we sell to e-commerce companies with $100M+ revenue"). This methodology INVERTS that: we derive ICP from actual customer evidence, then validate against assumptions.

```
Traditional:  Assumption → Targeting → Hope it works
Data-Driven:  Customer Evidence → Patterns → ICP → Targeting
```

---

## The Evidence Pyramid

Work BOTTOM-UP through the evidence pyramid:

```
                    ┌─────────────┐
                    │    ICP      │  ← Final Output
                    │  Definition │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Quotes    │  ← Voice of Customer
                    │  (N=379)    │     What they say about us
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Stories   │  ← Detailed Use Cases
                    │   (N=82)    │     How they use us
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Proof Points│  ← Quantified Results
                    │   (N=81)    │     What they achieved
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Logos     │  ← Full Customer Base
                    │  (N=1,306)  │     Who they are
                    └─────────────┘
```

---

## Phase 1: Pattern Extraction

### 1.1 Proof Points Analysis

Extract patterns from the 81 proof points:

| Pattern Type | What to Extract | Why It Matters |
|--------------|-----------------|----------------|
| **Metrics** | % improvements, latency, revenue lift | Quantifies value prop |
| **Use Cases** | Search, recommendations, browse | Identifies product-market fit |
| **Problems Solved** | Slow search, poor relevance, scaling | Pain points to target |
| **Industries** | Which verticals have proof points | High-confidence segments |

**Key Question:** Which industries/use cases have the STRONGEST quantified proof points?

### 1.2 Customer Stories Analysis

Extract patterns from the 82 stories:

| Pattern Type | What to Extract | Why It Matters |
|--------------|-----------------|----------------|
| **Tech Stack** | What they replaced, what they integrated | Tech cohort validation |
| **Company Stage** | Startup, growth, enterprise | Segment by maturity |
| **Decision Drivers** | Why they chose Algolia | Sales messaging |
| **Implementation** | How long, what resources | Deployment playbook |

**Key Question:** What tech stacks and company profiles have the most success stories?

### 1.3 Quotes Analysis

Extract patterns from the 379 quotes:

| Pattern Type | What to Extract | Why It Matters |
|--------------|-----------------|----------------|
| **Persona** | Who is speaking (title, role) | Buyer persona definition |
| **Language** | Keywords, phrases, pain descriptions | Sales enablement |
| **Outcomes** | What they celebrate | Value messaging |
| **Before/After** | What changed | Displacement narrative |

**Key Question:** Who are our champions internally? What do they say about us?

### 1.4 Logos Analysis

Extract patterns from the 1,306 logos:

| Pattern Type | What to Extract | Why It Matters |
|--------------|-----------------|----------------|
| **Industry Distribution** | Count by vertical | Market concentration |
| **Tech Partners** | Platform affiliations | Partner cohort validation |
| **Company Size** | Employee count, revenue tier | Size-based segmentation |
| **Geography** | HQ location, markets served | Regional targeting |

**Key Question:** Where is our customer base actually concentrated?

---

## Phase 2: Pattern Synthesis

### 2.1 Cross-Reference Patterns

Build a correlation matrix:

```
                 │ E-Commerce │ SaaS │ Media │ B2B │ Grocery │
─────────────────┼────────────┼──────┼───────┼─────┼─────────┤
Proof Points     │     ✓✓✓    │  ✓✓  │   ✓   │  ✓  │   ✓✓    │
Stories          │     ✓✓✓    │  ✓✓  │  ✓✓   │  ✓  │    ✓    │
Quotes           │     ✓✓✓    │  ✓✓  │   ✓   │ ✓✓  │   ✓✓    │
Logo Count       │     ✓✓✓    │  ✓✓  │  ✓✓   │  ✓  │    ✓    │
```

Where ✓✓✓ = strong signal, ✓✓ = moderate, ✓ = weak

**High-confidence ICP segments** = strong signals across ALL four levels

### 2.2 Identify Gaps

Look for mismatches:

| Gap Type | Example | Action |
|----------|---------|--------|
| **Many logos, few proof points** | SaaS segment | Need more case studies |
| **Strong proof points, few logos** | Grocery segment | Expand targeting |
| **Quotes but no stories** | B2B segment | Develop full narratives |

---

## Phase 3: ICP Definition

### 3.1 Primary ICP Segments

Define 3-5 primary segments with EVIDENCE:

```yaml
Segment: E-Commerce/Fashion
Evidence:
  - Logos: 59+ customers
  - Proof Points: [list specific metrics]
  - Stories: [list company names]
  - Quotes: [list personas who spoke]
Characteristics:
  - Revenue: $X-$Y
  - Tech Stack: [derived from data]
  - Geography: [derived from data]
Confidence: HIGH (evidence across all levels)
```

### 3.2 Secondary ICP Segments

Segments with partial evidence that warrant exploration.

### 3.3 Anti-ICP

Explicitly define who is NOT a fit:
- Industries with no success evidence
- Tech stacks with integration friction
- Company sizes that don't convert

---

## Phase 4: Validation

### 4.1 Compare to Traditional ICP

| Attribute | Traditional ICP | Data-Derived ICP | Match? |
|-----------|-----------------|------------------|--------|
| Industry | E-commerce, Media | E-commerce, SaaS, Grocery | Partial |
| Size | Enterprise ($100M+) | Growth + Enterprise | Expand |
| Tech Stack | Generic | Shopify, Magento, Contentful | Specific |
| Geography | US, EU | [from data] | TBD |

### 4.2 Identify Blind Spots

- What does traditional ICP include that data DOESN'T support?
- What does data reveal that traditional ICP IGNORES?

---

## Phase 5: Persona Definition

### 5.1 Derive Personas from Quotes

Extract speaker titles from 379 quotes:

| Persona | Count | Sample Titles | Key Themes |
|---------|-------|---------------|------------|
| Technical Leader | N | CTO, VP Engineering, Head of Platform | Performance, scale |
| Product Leader | N | VP Product, Director PM | User experience |
| Business Leader | N | CEO, COO, CMO | Revenue impact |
| Practitioner | N | Developer, Search Engineer | Implementation |

### 5.2 Micro-Personas

Within each segment, identify sub-personas:

```
E-Commerce Technical Leader:
├── The Migrator: Coming from Elastic/Solr, values stability
├── The Builder: Greenfield, values speed to market
└── The Optimizer: Existing search, values incremental gains
```

---

## Application to Arian

### Qualification Layer

Apply ICP as a filter to all plays:

```
Partner Tech Targets (S1)
    │
    ▼
ICP Filter
    │
    ├── Primary ICP ──► Tier 1 Priority
    ├── Secondary ICP ──► Tier 2 Priority
    └── Anti-ICP ──► Exclude or Deprioritize
```

### Scoring Integration

ICP match becomes a factor in composite scoring:

| ICP Match | Score Boost |
|-----------|-------------|
| Primary segment | +20 points |
| Secondary segment | +10 points |
| Unknown | +0 points |
| Anti-ICP | -20 points |

---

## Data Sources

| Source | Location | Records |
|--------|----------|---------|
| Customer Logos | Customer Evidence - Algolia.xlsx, Tab: Cust.Logos | 1,306 |
| Customer Quotes | Customer Evidence - Algolia.xlsx, Tab: Cust.Quotes | 379 |
| Customer Stories | Customer Evidence - Algolia.xlsx, Tab: Cust. Stories | 82 |
| Customer Proof Points | Customer Evidence - Algolia.xlsx, Tab: Cust. Proofpoints | 81 |

**File Path:** `/Users/arijitchowdhury/.../AI/Customer Evidence - Algolia.xlsx`

---

## Key Insight

> "This is a basis of everything that we are doing."

ICP derivation is NOT a one-time exercise. As new proof points and stories are added, the ICP should be re-validated. Data-driven ICP is a living artifact.

---

*Last updated: 2026-02-27*
