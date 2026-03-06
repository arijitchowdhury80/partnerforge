# Agent Handoff Instructions - March 6, 2026

**Project**: Algolia-Arian (ONE unified application)
**Status**: Planning complete, ready for Week 1 implementation
**Documentation**: 95% complete (48 .md files)

---

## 🎯 Critical Context

**Algolia-Arian is ONE application** with multiple features:
1. **Partner Intelligence** (existing, production at algolia-arian.vercel.app)
2. **Search Audit SaaS** (new, to be built starting Week 1)

**Not** two separate projects - "Dashboard" was just UI mockups for new features.

---

## 📂 For API Design Agent

### **Your Mission**: Design and implement 31 API endpoints across 6 data sources

### **Read These Files (In Order)**:

1. **[docs/features/search-audit/PROJECT_STATUS.md](docs/features/search-audit/PROJECT_STATUS.md)** ⭐ START HERE
   - Complete context and decisions made
   - **Read time**: 10-15 minutes
   - **Why**: Understand overall project before diving into APIs

2. **[docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md](docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md)** 🔌 PRIMARY SPEC
   - 31 API endpoints fully specified with TypeScript signatures
   - Request/response types
   - Cache TTL for each endpoint
   - Cost per API call
   - Code examples
   - **Read time**: 30-40 minutes
   - **Why**: This is your complete API specification document

3. **[docs/features/search-audit/ARCHITECTURE_APPROVED.md](docs/features/search-audit/ARCHITECTURE_APPROVED.md)** 🏗️
   - Architecture patterns (retry, cache, rate limit)
   - Data flow diagrams
   - Why Direct APIs (not MCP)
   - **Read time**: 10 minutes
   - **Why**: Understand architectural constraints and patterns

4. **[backend/README.md](backend/README.md)** 💻
   - Backend folder structure
   - HttpClient base class pattern
   - Service layer organization
   - Code examples
   - **Read time**: 15 minutes
   - **Why**: Understand where your code will live

5. **[docs/features/search-audit/SOURCE_CITATION_REQUIREMENTS.md](docs/features/search-audit/SOURCE_CITATION_REQUIREMENTS.md)** ⚠️ CRITICAL
   - **MANDATORY**: Every API response must include source metadata
   - `SourcedData<T>` wrapper pattern
   - **Read time**: 10 minutes
   - **Why**: Non-negotiable requirement - every data point needs provenance

### **Optional (If Time Permits)**:

- **[docs/features/search-audit/DATA_SOURCES_ANALYSIS.md](docs/features/search-audit/DATA_SOURCES_ANALYSIS.md)** - Why we chose each data source
- **[docs/features/search-audit/COST_MODEL_REALISTIC.md](docs/features/search-audit/COST_MODEL_REALISTIC.md)** - Cost per API call analysis

### **Your Deliverables**:

**Week 1-2**: Implement these API clients in `backend/services/`:

1. **HttpClient** (base class) - `services/http-client.ts`
   - Retry logic (exponential backoff)
   - Cache integration (Redis, 7-day TTL)
   - Rate limiting
   - Request/response logging
   - Error handling

2. **SimilarWebClient** - `services/similarweb.ts`
   - 14 endpoints (traffic, engagement, keywords, competitors, etc.)
   - Inherits from HttpClient
   - Method for each endpoint

3. **BuiltWithClient** - `services/builtwith.ts`
   - 7 endpoints (tech stack, relationships, financials, etc.)

4. **YahooFinanceClient** - `services/yahoo-finance.ts`
   - 5 endpoints (stock info, financials, recommendations, etc.)

5. **ApifyClient** - `services/apify.ts`
   - 3 actors (LinkedIn company, jobs, profile)

6. **ApolloClient** - `services/apollo.ts`
   - 2 endpoints (people search, intent signals)

### **Quick Start Code Template**:

See `API_CLIENT_SPECIFICATIONS.md` Section 2 for complete `HttpClient` implementation.

### **Testing Requirements**:

- Unit tests for each client
- Integration tests with actual API calls (using test accounts)
- Mock tests for CI/CD pipeline
- Error scenario testing (429, 500, timeout, etc.)

---

## 🏛️ For Architect Agent

### **Your Mission**: Review and approve system architecture, ensure scalability and maintainability

### **Read These Files (In Order)**:

1. **[docs/features/search-audit/ARCHITECTURE_APPROVED.md](docs/features/search-audit/ARCHITECTURE_APPROVED.md)** ⭐ START HERE
   - Complete architecture decision document
   - Why Direct APIs (not MCP)
   - Caching strategy (7-day Redis = 86% hit rate = $219K/year savings)
   - Data flow diagrams
   - **Read time**: 15 minutes
   - **Why**: This is THE architecture decision document

2. **[docs/features/search-audit/MASTER_PLAN.md](docs/features/search-audit/MASTER_PLAN.md)** 📖 COMPLETE GUIDE
   - **Chapter 3**: Architecture (Direct APIs + caching layer)
   - **Chapter 4**: Database (time-series design with JSONB)
   - **Chapter 6**: Implementation Roadmap (12 weeks)
   - **Read time**: Focus on Ch 3-4-6 = 20 minutes
   - **Why**: Comprehensive technical design

3. **[data/README.md](data/README.md)** 🗄️ DATABASE
   - Database schema (companies, audits, enrichment_cache)
   - Time-series architecture rationale
   - JSONB approach for flexible audit data
   - Migration strategy
   - **Read time**: 15 minutes
   - **Why**: Critical data model decisions

4. **[backend/README.md](backend/README.md)** 💻 BACKEND
   - Backend folder structure
   - API layer organization
   - Worker architecture (BullMQ)
   - Cache layer (Redis)
   - **Read time**: 15 minutes
   - **Why**: Implementation structure

5. **[RESTRUCTURE_COMPLETE.md](RESTRUCTURE_COMPLETE.md)** 📂 ORGANIZATION
   - Complete folder structure
   - Why we organized it this way
   - Feature-based organization rationale
   - **Read time**: 10 minutes
   - **Why**: Understand overall project organization

### **Optional (If Time Permits)**:

- **[docs/features/search-audit/COST_MODEL_REALISTIC.md](docs/features/search-audit/COST_MODEL_REALISTIC.md)** - Infrastructure costs and scaling
- **[DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md)** - What's documented (95% coverage)

### **Your Review Checklist**:

**Architecture Patterns**:
- ✅ Separation of concerns (frontend, backend, data)
- ✅ API client abstraction (HttpClient base class)
- ✅ Caching strategy (7-day TTL for stable data)
- ✅ Job queue for background processing (BullMQ)
- ✅ Time-series database design (audits as snapshots)

**Scalability**:
- ✅ Redis cache reduces API costs by 86%
- ✅ JSONB allows flexible audit data without schema migrations
- ✅ BullMQ handles concurrent job processing
- ✅ PostgreSQL indexes for performance

**Maintainability**:
- ✅ Feature-based documentation (`docs/features/`)
- ✅ Clear separation (frontend, backend, docs, data)
- ✅ TypeScript for type safety
- ✅ Comprehensive API specifications

**Security** (Review):
- API keys in environment variables (not hardcoded)
- Rate limiting on all external APIs
- Row-level security (RLS) on database
- Authentication via Supabase Auth

**Cost Optimization**:
- 7-day cache = 86% hit rate = $219K/year savings
- API usage: $1.73/audit (with caching)
- Infrastructure: $1.9K-$5.3K/year (scales with volume)

### **Your Deliverables**:

1. **Architecture Review** - Approve or suggest changes
2. **Scalability Assessment** - Can it handle 2,700+ audits/year?
3. **Security Audit** - Any vulnerabilities?
4. **Cost Validation** - Are projections realistic?
5. **Alternative Approaches** - Should we consider anything else?

---

## 🚀 For Implementation Agent (Backend Engineer)

### **Your Mission**: Build the backend (Week 1-2)

### **Read These Files (In Order)**:

1. **[docs/features/search-audit/PROJECT_STATUS.md](docs/features/search-audit/PROJECT_STATUS.md)** ⭐ START HERE
2. **[backend/README.md](backend/README.md)** - Your implementation guide
3. **[data/README.md](data/README.md)** - Database setup
4. **[docs/features/search-audit/MASTER_PLAN.md](docs/features/search-audit/MASTER_PLAN.md)** Ch 6 - Week-by-week roadmap

### **Week 1 Tasks**:
1. Set up Express + TypeScript in `backend/`
2. Implement `HttpClient` base class
3. Implement `SimilarWebClient` (14 methods)
4. Set up Redis cache (7-day TTL)
5. Write unit tests

---

## 📊 Quick Reference

### Project Stats
- **Documentation**: 48 .md files, 95% coverage
- **Folder Structure**: frontend, backend, docs, data, prototypes
- **Key Docs**: 7 files in `docs/features/search-audit/`, 125 KB total

### Technology Stack
- **Frontend**: React + TypeScript + Mantine (existing, production)
- **Backend**: Node.js + Express + TypeScript (to be built)
- **Queue**: BullMQ + Redis
- **Cache**: Redis (7-day TTL)
- **Database**: PostgreSQL (Supabase)
- **Real-Time**: Socket.IO

### Data Sources (31 Endpoints)
1. SimilarWeb (14 endpoints)
2. BuiltWith (7 endpoints)
3. Yahoo Finance (5 endpoints)
4. SEC Edgar (3 endpoints)
5. Apify (3 actors)
6. Apollo.io (2 endpoints)

### Cost Model
- **Capital**: $101K (one-time)
- **Year 1**: 60 audits, $11.6K = $194/audit
- **Year 2**: 600 audits, $12.6K = $21/audit
- **Year 3**: 2,700 audits, $19.6K = $7.26/audit

---

## 🎯 Don't Read (Outdated)

Skip these folders/files:
- `docs/historical/` - Old versions
- `docs/_old/` - Archived outdated files
- `prototypes/_archive/` - 26 old planning docs
- Any file with "OLD" or "V2" in the name

---

## 📞 Questions?

- **What's the architecture?** → `docs/features/search-audit/ARCHITECTURE_APPROVED.md`
- **What APIs do I build?** → `docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md`
- **What's the database?** → `data/README.md`
- **What's the timeline?** → `docs/features/search-audit/MASTER_PLAN.md` Ch 6
- **What's the cost?** → `docs/features/search-audit/COST_MODEL_REALISTIC.md`

---

## 🌐 Visual Documentation

**HTML Viewer**: Open `docs-viewer.html` in browser for navigable documentation with 11 sections.

---

**Status**: ✅ Ready for Week 1 implementation
**Last Updated**: March 6, 2026
**Next**: API Design Agent + Architect Agent review, then Backend Engineer starts Week 1
