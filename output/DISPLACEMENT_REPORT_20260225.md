# Arian Displacement Report
**Generated:** 2026-02-25
**Partner Technology:** Adobe Experience Manager (AEM)

---

## Executive Summary

Arian analyzed **2,700 companies** using Adobe Experience Manager that are **NOT** currently using Algolia. These represent displacement opportunities for Algolia's sales team.

### Key Findings

| Metric | Value |
|--------|-------|
| **Total Targets** | 2,700 |
| **Hot Leads (80+)** | 10 |
| **Warm Leads (60-79)** | 157 |
| **Cool Leads (40-59)** | 1,472 |
| **High-Value Export (≥50)** | 1,614 |

### ICP Tier Distribution

| Tier | Name | Count | % | Priority |
|------|------|-------|---|----------|
| 1 | Commerce | 1,611 | 60% | ⭐⭐⭐ Highest |
| 2 | Content | 59 | 2% | ⭐⭐ Medium |
| 3 | Internal Support | 223 | 8% | ⭐ Lower |
| 0 | Unknown | 807 | 30% | Needs classification |

---

## Top 20 Hot Leads

| Rank | Company | Domain | Tier | Score | Monthly Visits |
|------|---------|--------|------|-------|----------------|
| 1 | HUAWEI | huawei.com | Commerce | 90 | 75.7M |
| 2 | TD Bank | td.com | Commerce | 90 | 43.2M |
| 3 | Kia Corporation | kia.com | Commerce | 90 | 25.5M |
| 4 | National Australia Bank | nab.com.au | Commerce | 90 | 11.5M |
| 5 | Mercedes-Benz Group AG | mercedes-benz.com | Commerce | 85 | 6.6M |
| 6 | Morgan Stanley | morganstanley.com | Commerce | 85 | 4.7M |
| 7 | CVS Caremark | caremark.com | Commerce | 80 | 4.5M |
| 8 | SP Global | spglobal.com | Commerce | 80 | 3.5M |
| 9 | Avalara Inc | avalara.com | Commerce | 80 | 2.0M |
| 10 | Volvo AB | volvo.com | Commerce | 80 | 1.2M |

---

## Vertical Distribution (Tier 1 Commerce)

| Vertical | Count | Notes |
|----------|-------|-------|
| Unknown | 638 | Needs manual classification |
| Business & Industrial | 308 | B2B commerce opportunity |
| Automotive & Vehicles | 200 | **Strong vertical - case studies available** |
| Health & Fitness | 109 | Growing e-commerce sector |
| Finance | 87 | Tier 3 overlap - review needed |
| Science | 39 | B2B/research portals |
| Food & Drink | 39 | Grocery/CPG opportunity |

---

## Geographic Distribution

| Country | Count | % |
|---------|-------|---|
| United States | 525 | 19% |
| Germany | 174 | 6% |
| Australia | 98 | 4% |
| United Kingdom | 74 | 3% |
| Italy | 48 | 2% |
| India | 44 | 2% |
| Japan | 42 | 2% |
| Canada | 38 | 1% |

**Note:** 1,197 targets (44%) have no country data - enrichment needed.

---

## ICP Scoring Model

Based on Algolia's official ICP Tier definitions:

### Tier 1: Commerce (Fashion & General Retail E-commerce)
- **Revenue Range:** $140M - $7.7B
- **Employees:** 229 - 58k
- **Primary KPI:** Conversion rate uplift
- **Key Platforms:** Shopify Plus, Adobe Commerce, Amplience, Adobe AEM
- **Buying Triggers:**
  - Headless/MACH re-platform launch
  - BOPIS rollout
  - New country storefront
  - Peak-season traffic planning

### Tier 2: Content (Digital Publishing & Media)
- **Revenue Range:** $35M - $81B
- **Employees:** 150 - 109k
- **Primary KPI:** Time-on-site / articles read
- **Key Platforms:** Adobe AEM, Adobe Analytics
- **Buying Triggers:**
  - Rapid content library growth
  - Plateauing ad/subscription revenue

### Tier 3: Internal Support (Knowledge & Support Portals)
- **Revenue Range:** $900M - $25B
- **Employees:** 2.5k - 99k
- **Primary KPI:** Ticket deflection / self-service rate
- **Key Platforms:** Zendesk Suite, SharePoint, Confluence
- **Buying Triggers:**
  - Support-volume spike
  - New product/API launch
  - CSAT improvement mandate

---

## Scoring Formula

| Component | Weight | Criteria |
|-----------|--------|----------|
| **Vertical/Tier** | 40 pts | Tier 1=40, Tier 2=25, Tier 3=15 |
| **Traffic** | 30 pts | 50M+=30, 10M+=25, 5M+=20, 1M+=15, 500K+=10, 100K+=5 |
| **Tech Spend** | 20 pts | $100K+=20, $50K+=15, $25K+=10, $10K+=5 |
| **Partner Tech** | 10 pts | Adobe/Salesforce=10, Shopify/CT=7, Others=3 |
| **Competitor Bonus** | +5 pts | If using competitor search tech |

---

## Recommended Next Steps

### Immediate Actions (This Week)
1. **Prioritize Hot Leads (10):** Assign to Enterprise AEs
2. **Export Warm Leads (157):** Add to outbound sequences
3. **Enrich Unknown Verticals (638):** Use BuiltWith/manual research

### Data Quality Improvements
1. Add country data for 1,197 targets missing geography
2. Classify 807 unknown tier targets
3. Enrich remaining targets with SimilarWeb traffic data (only 55 have data)

### Pipeline Expansion
1. Add Shopify displacement targets (Lists API credits needed)
2. Add Salesforce Commerce Cloud targets
3. Add commercetools targets

---

## Output Files

| File | Description |
|------|-------------|
| `aem_high_value_targets_20260225.csv` | 1,614 targets with score ≥ 50 |
| `aem_displacement_targets_20260225.csv` | All 2,700 targets |
| `aem_icp_scored_targets_20260225.csv` | Full ICP scoring details |
| `aem_top_100_leads_20260225.csv` | Top 100 by score |

---

## Technical Notes

- **Data Source:** BuiltWith Lists API (lists8)
- **Algolia Customer Filter:** 400 existing customers excluded
- **ICP Model:** Based on official Algolia ICP Tier PDFs (2025-2026)
- **Scoring:** Enhanced model with tier-specific weights

---

*Report generated by Arian v1.0*
*Database: arian.db (1.4MB)*
