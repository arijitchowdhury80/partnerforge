# Search Audit Dashboard - Documentation

**Project**: Algolia Search Audit Dashboard (SaaS Platform)
**Status**: ✅ Architecture Approved - Implementation Ready
**Decision**: Direct APIs with 7-day caching
**Last Updated**: March 6, 2026

---

## 📂 What is This?

This folder contains complete documentation for the **Search Audit Dashboard** project - a SaaS platform that automates Algolia Search Audits for GTM teams.

**Note**: This is a SEPARATE project from Arian (Partner Intelligence Platform). Arian docs are in other folders under `docs/`.

---

## 🎯 Quick Start

### For New Team Members

**Start here**: [PROJECT_STATUS.md](PROJECT_STATUS.md) ⭐

This handoff document contains:
- Critical decisions made
- Current state (what's done, what's not)
- Implementation timeline (12 weeks)
- Next steps for implementation
- Complete context for any agent/developer

**Read time**: 10-15 minutes

---

### For Engineers

**Read in this order**:
1. [PROJECT_STATUS.md](PROJECT_STATUS.md) - Understand context and decisions
2. [API_CLIENT_SPECIFICATIONS.md](API_CLIENT_SPECIFICATIONS.md) - Implement API clients
3. [ARCHITECTURE_APPROVED.md](ARCHITECTURE_APPROVED.md) - Architecture patterns
4. [MASTER_PLAN.md](MASTER_PLAN.md) Chapter 4 - Database schema

**Your first task**: Week 1 - Implement `HttpClient` + `SimilarWebClient`

---

### For Product/Business

**Read in this order**:
1. [PROJECT_STATUS.md](PROJECT_STATUS.md) - Current state and timeline
2. [MASTER_PLAN.md](MASTER_PLAN.md) Chapter 1 - Executive summary and business case
3. [COST_MODEL_REALISTIC.md](COST_MODEL_REALISTIC.md) - Budget and ROI projections
4. [MASTER_PLAN.md](MASTER_PLAN.md) Chapter 8 - Success metrics

---

## 📚 Complete Documentation Set

| File | Purpose | Read Time |
|------|---------|-----------|
| **[PROJECT_STATUS.md](PROJECT_STATUS.md)** | ⭐ Agent handoff document - START HERE | 10-15 min |
| **[MASTER_PLAN.md](MASTER_PLAN.md)** | Complete technical guide (8 chapters) | 30-40 min |
| **[ARCHITECTURE_APPROVED.md](ARCHITECTURE_APPROVED.md)** | Architecture decision rationale | 10 min |
| **[API_CLIENT_SPECIFICATIONS.md](API_CLIENT_SPECIFICATIONS.md)** | 31 API endpoints specifications | 20-30 min |
| **[COST_MODEL_REALISTIC.md](COST_MODEL_REALISTIC.md)** | Realistic cost projections (60/600/2,700 audits) | 15 min |
| **[DATA_SOURCES_ANALYSIS.md](DATA_SOURCES_ANALYSIS.md)** | Data source evaluation (Apify, Apollo, etc.) | 15 min |
| **[SOURCE_CITATION_REQUIREMENTS.md](SOURCE_CITATION_REQUIREMENTS.md)** | MANDATORY source citation specs | 10 min |

**Total**: 7 comprehensive documents

---

## 🏗️ Architecture Summary

**Decision**: Direct APIs (NOT MCP)

**Key components**:
- Frontend: React + TypeScript + Mantine UI
- Backend: Node.js + Express
- Job Queue: BullMQ + Redis
- Cache: Redis (7-day TTL = 86% hit rate = $219K/year savings)
- Database: PostgreSQL (Supabase)
- File Storage: S3 or Vercel Blob
- Real-Time: Socket.IO
- Browser: Puppeteer + Chrome

**Data sources**:
- SimilarWeb (14 endpoints) - Traffic, engagement, competitors
- BuiltWith (7 endpoints) - Tech stack
- Yahoo Finance (5 endpoints) - Financials
- SEC Edgar (3 endpoints) - 10-K/10-Q filings
- Apify (3 actors) - LinkedIn data, job postings, social engagement
- Apollo.io (2 endpoints) - Buying committee, intent signals

---

## 💰 Cost Overview

**Capital Investment**: $101,000 (one-time development + setup)

**Operating Costs**:
- Year 1 (60 audits): $11,648/year = $194/audit
- Year 2 (600 audits): $12,582/year = $21/audit
- Year 3 (2,700 audits): $19,611/year = $7.26/audit

**3-Year Total**: $144,800 for 3,360 audits

**ROI**: 69x over 3 years (revenue vs cost)

See [COST_MODEL_REALISTIC.md](COST_MODEL_REALISTIC.md) for full breakdown.

---

## 📋 Critical Decisions Made

1. **Architecture**: Direct APIs (NOT MCP) - for production control and observability
2. **Caching**: 7-day Redis TTL (stable data), 24hr (dynamic data) - 86% hit rate saves $219K/year
3. **Persistence**: Full PostgreSQL database - all API responses persisted
4. **Data Sources**: SimilarWeb, BuiltWith, Yahoo Finance, SEC Edgar, Apify, Apollo.io
5. **Source Citations**: MANDATORY for every single data point - nothing is unvalidated
6. **Timeline**: 12 weeks to production

All decisions documented in [ARCHITECTURE_APPROVED.md](ARCHITECTURE_APPROVED.md) and [PROJECT_STATUS.md](PROJECT_STATUS.md).

---

## 🎨 Visual Prototype

See [../../dashboard/index-v2.html](../../dashboard/index-v2.html) for interactive mockup with 10 fully-styled screens.

**How to view**:
```bash
open dashboard/index-v2.html
```

---

## 📞 Quick Questions?

- **What's the architecture?** → [ARCHITECTURE_APPROVED.md](ARCHITECTURE_APPROVED.md)
- **What should I build first?** → [PROJECT_STATUS.md](PROJECT_STATUS.md) "Next Steps"
- **How do APIs work?** → [API_CLIENT_SPECIFICATIONS.md](API_CLIENT_SPECIFICATIONS.md)
- **What's the cost?** → [COST_MODEL_REALISTIC.md](COST_MODEL_REALISTIC.md)
- **What's the timeline?** → [MASTER_PLAN.md](MASTER_PLAN.md) Chapter 6
- **Who are the users?** → [MASTER_PLAN.md](MASTER_PLAN.md) Chapter 2
- **How are sources tracked?** → [SOURCE_CITATION_REQUIREMENTS.md](SOURCE_CITATION_REQUIREMENTS.md)

---

## 🔄 Project Context

**This is a NEW project** being planned from scratch. The documentation here represents:
- ✅ Research and planning phase (COMPLETED)
- ✅ Architecture decisions (APPROVED)
- ✅ Product requirements (DOCUMENTED)
- ✅ Implementation roadmap (READY)
- ⏭️ Implementation phase (WEEK 1 ready to start)

**Next step**: Begin Week 1 implementation (see [PROJECT_STATUS.md](PROJECT_STATUS.md))

---

**Last Updated**: March 6, 2026
**Owner**: Dashboard Builder Team
**Status**: ✅ Ready for Week 1 implementation
