# Crossbeam Integration Architecture

## Data Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CROSSBEAM LAYER (CRM-Validated)                      │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  Adobe AEM Customers + Algolia Prospects = 505 domains               │  │
│   │  • Partner-validated (Adobe confirms customer)                        │  │
│   │  • CRM-validated (Algolia CRM says "prospect")                       │  │
│   │  • Includes: owner, industry, geo, opportunity data                  │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BUILTWITH LAYER (Tech Detection)                      │
│                                                                              │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│   │    AEM     │ │  Magento   │ │    SFCC    │ │ Shopify+   │              │
│   │  43,491    │ │   97,879   │ │   17,092   │ │   84,855   │              │
│   └────────────┘ └────────────┘ └────────────┘ └────────────┘              │
│                                                                              │
│   Enrichment: Tech stack, search provider, CDN, analytics, etc.             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       HYPERSCALER LAYER (Enrichment)                         │
│                                                                              │
│   For each target domain, Domain API check:                                 │
│   • has_aws: boolean                                                        │
│   • has_azure: boolean                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Intersection Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            COHORT COMPUTATION                                │
│                                                                              │
│  TIER 1: JACKPOT (Triple Validated)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Crossbeam (partner-validated)                                       │    │
│  │  ∩ BuiltWith (tech-detected)                                        │    │
│  │  ∩ Hyperscaler (AWS or Azure)                                       │    │
│  │  - Algolia customers                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  TIER 2: HIGH PRIORITY (Double Validated)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Crossbeam ∩ BuiltWith (no hyperscaler)                             │    │
│  │  OR                                                                  │    │
│  │  Crossbeam ∩ Hyperscaler (no commerce detected)                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  TIER 3: CROSSBEAM ONLY                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  505 Crossbeam domains                                               │    │
│  │  Partner says "customer", Algolia says "prospect"                   │    │
│  │  Ready for co-sell motion                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  TIER 4: BUILTWITH ONLY                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CMS + Commerce intersection from BuiltWith                         │    │
│  │  NOT in Crossbeam (no partner relationship yet)                     │    │
│  │  Cold outbound targets                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why Crossbeam Changes Everything

| Signal | BuiltWith Only | Crossbeam |
|--------|---------------|-----------|
| They use AEM | Tech detection (may be stale) | Adobe confirms customer |
| Not Algolia customer | BuiltWith doesn't detect | Algolia CRM confirms |
| Partner intro available | No | Yes (Adobe AE named) |
| Account owner known | No | Yes (Algolia AE assigned) |
| Industry validated | Inferred from site | CRM-validated |

## Database Schema

```sql
-- Crossbeam overlaps (partner data)
crossbeam_overlaps
├── domain (PK with partner)
├── algolia_status ('Prospect', 'Customer')
├── partner_status ('Customer', 'Prospect')
├── partner_name ('Adobe')
├── partner_product ('AEM')
├── algolia_owner
├── partner_owner
├── industry, geo, billing_country
└── opportunities_amount, opportunities_count

-- BuiltWith targets (tech data)
displacement_targets
├── domain (PK)
├── partner_tech
├── current_search
├── icp_score
├── sw_monthly_visits
└── tech_stack_json

-- View: Combined intelligence
crossbeam_enriched = crossbeam_overlaps JOIN displacement_targets
```

## Visualization Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PARTNER INTELLIGENCE DASHBOARD                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    CROSSBEAM VALIDATED TARGETS                       │    │
│  │                                                                      │    │
│  │  [505 domains]  Adobe AEM Customers + Algolia Prospects             │    │
│  │                                                                      │    │
│  │  By Geo:        By Industry:           By Cohort Tier:              │    │
│  │  ┌──────────┐   ┌──────────────────┐   ┌──────────────────────┐     │    │
│  │  │ AMERICAS │   │ Pharma       24% │   │ JACKPOT (triple)  XX │     │    │
│  │  │   74%    │   │ FinServ      13% │   │ HIGH (double)    XXX │     │    │
│  │  │ EMEA     │   │ Mfg-Consumer 10% │   │ CROSSBEAM only   XXX │     │    │
│  │  │   20%    │   │ Tech SW       9% │   └──────────────────────┘     │    │
│  │  │ APAC     │   │ Mfg-Indust    9% │                                │    │
│  │  │    6%    │   └──────────────────┘                                │    │
│  │  └──────────┘                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         TARGET LIST                                  │    │
│  │                                                                      │    │
│  │  Domain          Company           Tier    Industry    Algolia AE   │    │
│  │  ─────────────── ──────────────── ─────── ─────────── ──────────── │    │
│  │  melitta-group   Melitta Group    JACKPOT Mfg-Consumer P. Geiger   │    │
│  │  crown.com       Crown Equipment  HIGH    Mfg-Indust   ENT Pool    │    │
│  │  ...                                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Next Steps

1. **Run migration:** Create `crossbeam_overlaps` table
2. **Ingest CSV:** Load 505 unique domains
3. **Cross-reference:** Match with BuiltWith data
4. **Enrich:** Add hyperscaler tags via Domain API
5. **Visualize:** Build dashboard component
