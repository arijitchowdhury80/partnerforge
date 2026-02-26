# PartnerForge - Product Requirements Document

**Version:** 4.0
**Date:** 2026-02-26
**Status:** Production + Vision Planning

---

## Executive Summary

**PartnerForge** is a Partner Intelligence Platform for Algolia Sales that identifies displacement opportunities by finding companies using partner technologies who are NOT using Algolia.

**Core Formula:**
```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

---

## Current State (Production)

### What's Live Today

| Component | Status |
|-----------|--------|
| **Frontend** | React dashboard at partnerforge.vercel.app |
| **Database** | Supabase PostgreSQL with 2,737 targets |
| **Partners** | Adobe AEM (2,687), Commerce (18), Amplience (20), Spryker (12) |
| **Data Sources** | BuiltWith (tech), SimilarWeb (traffic) |

### Target Users

| Role | Primary Use Case |
|------|------------------|
| Account Executives | Pre-call research, identify displacement opportunities |
| Partner Managers | Co-sell list building, partner campaign targeting |
| Sales Leadership | Territory planning, pipeline prioritization |

---

## Problem Statement

Sales teams spend significant time manually researching:
- Which prospects use a partner technology (Adobe, Shopify, etc.)?
- Which of those prospects DON'T yet use Algolia?
- What's the company's traffic, financial health, and ICP fit?

| Pain Point | Current State | PartnerForge Solution |
|------------|---------------|----------------------|
| Manual research | 2-4 hours per account | 2 minutes per account |
| Inconsistent data | Different reps use different sources | Single source of truth |
| No prioritization | All leads look the same | ICP + Signal scoring |

---

## ICP Scoring Model

| Component | Weight | Logic |
|-----------|--------|-------|
| Vertical/Tier | 40 | Commerce=40, Content=25, Support=15 |
| Traffic | 30 | 50M+=30, 10M+=25, 1M+=15 |
| Tech Spend | 20 | $100K+=20, $50K+=15 |
| Partner Tech | 10 | Adobe=10, Shopify=7 |

### Priority Classification

| Score | Priority | Action |
|-------|----------|--------|
| 80-100 | HOT | Immediate outreach |
| 60-79 | WARM | Queue for enrichment |
| 40-59 | COOL | Background refresh |
| 0-39 | COLD | Deprioritize |

---

## Feature Roadmap

### Phase 1: Current (Completed)
- [x] Partner technology detection (BuiltWith)
- [x] Traffic metrics (SimilarWeb)
- [x] ICP scoring algorithm
- [x] Excel-style filtering dashboard
- [x] Company detail view

### Phase 2: Enrichment (In Progress)
- [ ] Batch enrichment for top targets
- [ ] Financial data integration (Yahoo Finance)
- [ ] Case study matching
- [ ] Export to CSV/Salesforce

### Phase 3: Advanced Intelligence (Planned)
- [ ] Hiring signals detection
- [ ] Executive intelligence
- [ ] Competitive landscape mapping
- [ ] Trigger event detection

---

## Detailed Vision

For the full v3.0 vision including:
- 34 data sources across 8 signal categories
- Normalized database schema
- Gap-to-feature mapping
- Trigger event taxonomy
- Data decay model

See: **[docs/prd/PRD-PartnerForge-v3.md](./docs/prd/PRD-PartnerForge-v3.md)**

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to research account | < 2 minutes |
| Hot lead identification | > 85% accuracy |
| Partner co-sell meetings | 5/month |
| Pipeline attributed | $500K (Phase 1) |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment guide |
| [docs/prd/PRD-PartnerForge-v3.md](./docs/prd/PRD-PartnerForge-v3.md) | Detailed v3.0 vision |

---

*Last updated: 2026-02-26*
