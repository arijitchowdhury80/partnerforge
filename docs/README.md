# Algolia Arian - Documentation

**Last Updated:** March 6, 2026
**Status:** Production-ready
**Budget:** $1,066/year for 1,000 audits

---

## 📁 Structure

```
docs/
├── README.md (this file)         # START HERE
│
├── EXECUTIVE_SUMMARY.md          # Budget approval ($1,279 request)
├── ARCHITECTURE.md               # Technical decisions & implementation
├── CODE_STANDARDS.md             # Quality rules (23 golden rules)
├── ICP_DEFINITION.md             # Who to target (Fashion/Grocery Tier 1)
├── SALES_MACHINERY.md            # How to prioritize (4-layer funnel)
│
└── archived/                     # Old documentation (reference only)
```

**That's it. 5 core files.**

---

## 🎯 Where to Start?

### For Leadership (Budget Approval)

**Time:** 10 minutes
**Read:** [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)

**What you'll learn:**
- Bottom line: $1,066/year, $1.07 per audit
- ROI: 704x ($750K pipeline / $1,066 cost)
- 3 decisions needed
- Budget request: $1,279 (includes 20% contingency)

**Decision required:** Approve $1,279 budget?

---

### For Engineering Team

**Time:** 2 hours
**Read:** [ARCHITECTURE.md](ARCHITECTURE.md) → [CODE_STANDARDS.md](CODE_STANDARDS.md)

**What you'll learn:**

**[ARCHITECTURE.md](ARCHITECTURE.md) (40 pages):**
- Database strategy (PostgreSQL only for 1K audits)
- Backend architecture (Edge Functions + job queue)
- Security (SSO, API keys server-side)
- Caching (7-day TTL, 25% savings)
- Cost analysis ($1,066/year breakdown)
- Week 1-12 implementation roadmap

**[CODE_STANDARDS.md](CODE_STANDARDS.md) (30 pages):**
- 23 Golden Rules (NON-NEGOTIABLE)
- Testing standards (80%+ coverage enforced)
- Logging (Pino + OpenTelemetry)
- Error handling (try-catch everywhere)
- Security standards

**Next step:** Implement Week 1 roadmap (Supabase Edge Functions, SSO, Redis)

---

### For Sales & Marketing Team

**Time:** 40 minutes
**Read:** [ICP_DEFINITION.md](ICP_DEFINITION.md) → [SALES_MACHINERY.md](SALES_MACHINERY.md)

**What you'll learn:**

**[ICP_DEFINITION.md](ICP_DEFINITION.md) (20 pages):**
- **Tier 1 ICP:** Fashion (65% proof points), Grocery (35% proof points)
- **Tier 2 ICP:** General Retail, SaaS/Tech
- Company size (Enterprise = 100 score)
- Geography (US/UK/EMEA highest)
- Technology stack (Shopify, Adobe AEM, Magento)
- Displacement targets (Elasticsearch, Solr, SearchSpring)

**[SALES_MACHINERY.md](SALES_MACHINERY.md) (15 pages):**
- Four-layer cascading funnel (2,800 → 15 ABM targets)
- Three-play system (S1: Tech Partner, S2: Target List, S3: SI Connected)
- ABM campaign assignment (1:1, 1:Few, 1:Many)
- Priority scoring formula

**Next step:** Use Arian dashboard to find hot leads (Score 80+)

---

## 📊 Key Numbers

| Metric | Value |
|--------|-------|
| **Annual Cost** | $1,066 |
| **Cost per Audit** | $1.07 |
| **Audits/Year** | 1,000 |
| **API Costs** | $1,051 (99% of total) |
| **Hosting** | $15 (domain only, free tier) |
| **ROI** | 704x |
| **Expected Pipeline** | $750,000 |
| **Payback Period** | < 1 month |

---

## 🚀 Implementation Status

### Week 1-2: Foundation & Security
- [ ] Set up Supabase Edge Functions
- [ ] Configure Google OAuth SSO (@algolia.com only)
- [ ] Set up Redis (Upstash free tier)
- [ ] Move API keys to server-side
- [ ] Implement user roles (admin/user/viewer)

### Week 3-4: Backend & Enrichment
- [ ] Create job queue (Redis BullMQ)
- [ ] Move enrichment orchestrator to Edge Functions
- [ ] Add rate limiting per service
- [ ] Implement 7-day caching

### Week 5-6: Testing & Monitoring
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] Structured logging (Pino)
- [ ] Set up Grafana + Loki

**Full roadmap:** See [ARCHITECTURE.md](ARCHITECTURE.md) Section 7

---

## 📋 File Summaries

### [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) (9 KB)
Budget approval document for leadership.

**Key sections:**
- Bottom line up front ($1,066/year)
- 3 critical decisions needed
- ROI analysis (704x)
- Cost breakdown
- Comparison: Original estimate vs corrected (500K → 1K audits)

**Status:** Ready for approval

---

### [ARCHITECTURE.md](ARCHITECTURE.md) (10 KB)
Complete technical architecture decisions.

**Key sections:**
1. Overview (2 projects, shared infrastructure)
2. Database strategy (PostgreSQL only)
3. Backend architecture (Edge Functions + workers)
4. Security (SSO, API keys, RLS)
5. Caching (7-day TTL, 25% savings)
6. Cost analysis (detailed breakdown)
7. Implementation roadmap (Week 1-12)

**Decisions made:**
- PostgreSQL only (defer Neo4j to 5K+ audits)
- Free tier sufficient (using 0.5% of capacity)
- 7-day cache TTL (25% API savings)

---

### [CODE_STANDARDS.md](CODE_STANDARDS.md) (26 KB)
NON-NEGOTIABLE code quality standards.

**Key sections:**
- 23 Golden Rules
- Error handling (try-catch everywhere)
- Logging standards (Pino + OpenTelemetry)
- Testing requirements (80%+ coverage)
- TypeScript standards (strict mode)
- Security standards
- Pre-commit hooks + CI/CD enforcement

**Enforcement:** GitHub Actions will reject PRs that don't meet standards

---

### [ICP_DEFINITION.md](ICP_DEFINITION.md) (6 KB)
Data-validated ICP definition.

**Key sections:**
1. ICP tiers by vertical (Fashion/Grocery Tier 1)
2. Company size & traffic
3. Geographic distribution
4. Technology stack
5. Displacement targets
6. Composite scoring (4-factor model)
7. Cohort definitions (JACKPOT/HIGH/STANDARD)

**Source:** 1,306 logos, 379 quotes, 81 quantified proof points

---

### [SALES_MACHINERY.md](SALES_MACHINERY.md) (6 KB)
Sales prioritization & routing system.

**Key sections:**
1. Four-layer cascading funnel (2,800 → 15 targets)
2. Three-play system (S1/S2/S3 intersection)
3. ABM campaign assignment (1:1/1:Few/1:Many)
4. Scoring & prioritization formula

**Usage:** Reference for all account routing in Arian dashboard

---

## ❓ Frequently Asked Questions

### "Which document should I read first?"

**Leadership:** [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)
**Engineering:** [ARCHITECTURE.md](ARCHITECTURE.md)
**Sales/Marketing:** [ICP_DEFINITION.md](ICP_DEFINITION.md)

### "Where are the old docs?"

**Archived:** See `archived/` folder. Contains 30+ old files from previous structure. Preserved for reference but superseded by the 5 core files above.

### "What happened to Dashboard docs?"

**Separate project:** Dashboard documentation is in `/dashboard/` directory at project root (not in `/docs/`). Two distinct projects sharing infrastructure.

### "What's the budget request again?"

**$1,279 total:**
- Operating: $1,066/year
- Contingency (20%): $213

See [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) for full breakdown.

### "When do we start Week 1?"

**After 3 decisions approved:**
1. Database: PostgreSQL only (recommended) ✓ or Hybrid?
2. Infrastructure: Free tier (recommended) ✓ or Pro tier?
3. Budget: Approve $1,279? ✓

---

## 🔗 Quick Links

| Link | Description |
|------|-------------|
| [Arian Dashboard](https://algolia-arian.vercel.app) | Live production app |
| [Supabase Project](https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra) | Database console |
| [GitHub Repository](https://github.com/arijitchowdhury80/arian) | Source code |

---

## 📞 Support

**Questions about:**
- **Budget/ROI:** Read [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)
- **Technical implementation:** Read [ARCHITECTURE.md](ARCHITECTURE.md)
- **Code quality:** Read [CODE_STANDARDS.md](CODE_STANDARDS.md)
- **Target customers:** Read [ICP_DEFINITION.md](ICP_DEFINITION.md)
- **Sales prioritization:** Read [SALES_MACHINERY.md](SALES_MACHINERY.md)

---

**This is your single source of truth. 5 files. That's it.**
