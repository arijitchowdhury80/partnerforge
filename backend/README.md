# Algolia-Arian Backend

**Status**: ✅ Phase 2 COMPLETE (March 8, 2026, 4:45 AM)
**Purpose**: All server-side code for Algolia-Arian application
**Language**: TypeScript + Node.js
**Progress**: 70% Complete (55 files, 14,266 lines)

---

## 📂 Structure

```
backend/
├── server.ts               # Express server entry point
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript configuration
├── .env.example            # Environment template
│
├── config/
│   ├── index.ts            # Configuration loader
│   └── api-keys.ts         # API key management
│
├── database/
│   ├── supabase.ts         # Supabase client
│   └── migrate.ts          # Migration runner
│
├── services/
│   ├── http-client.ts               # Base HTTP client (retry, cache, rate limit)
│   ├── cost-tracker.ts              # Cost tracking service
│   ├── metrics.ts                   # Metrics collection
│   ├── similarweb.ts                # SimilarWeb API client (14 endpoints)
│   ├── builtwith.ts                 # BuiltWith API client (7 endpoints)
│   ├── yahoo-finance.ts             # Yahoo Finance client (5 endpoints)
│   ├── apify.ts                     # Apify client (3 actors)
│   ├── apollo.ts                    # Apollo.io client (2 endpoints)
│   ├── scoring.ts                   # Composite scoring logic
│   ├── strategic-analysis-engine.ts # Strategic insights synthesis (Migration 008)
│   ├── browser-automation.ts        # Playwright wrapper for search audits
│   ├── websocket-manager.ts         # Socket.IO for live audit streaming
│   ├── copilot.ts                   # Anthropic Agent SDK integration
│   ├── copilot-tools.ts             # MCP tools for database queries
│   ├── copilot-context.ts           # Context-aware chat tracking
│   └── copilot-rag.ts               # Documentation RAG system
│
├── cache/
│   └── redis-client.ts     # Redis connection & helpers
│
├── queue/
│   └── setup.ts            # BullMQ queue setup
│
├── workers/
│   ├── enrichment-worker.ts    # Enrichment queue worker
│   ├── audit-worker.ts         # Audit execution worker
│   └── audit-browser-worker.ts # Browser-based search audit worker
│
├── middleware/
│   ├── auth.ts                 # Authentication
│   ├── rate-limit.ts           # Rate limiting
│   ├── error-handler.ts        # Error handling
│   ├── request-id.ts           # Request ID tracking
│   └── copilot-context.ts      # User context tracking for chat
│
├── utils/
│   ├── logger.ts           # Winston logger
│   ├── errors.ts           # Custom error classes
│   └── source-citation.ts  # Source citation builder
│
├── types/
│   └── index.ts            # TypeScript type definitions
│
├── api/                    # API endpoints (Express routes)
│   ├── partners/           # Partner Intelligence APIs
│   ├── audits/             # Search Audit APIs
│   │   └── live-stream.ts  # WebSocket endpoint for live audit preview
│   ├── enrichment/         # Enrichment APIs
│   └── copilot/            # AI Copilot APIs
│       └── chat.ts         # Chat endpoint
│
└── tests/
    ├── setup.ts            # Test configuration
    └── *.test.ts           # Unit & integration tests
```

---

## 🎯 Purpose

This backend serves **both** Algolia-Arian features:

### 1. Partner Intelligence APIs
- Find companies using partner technologies
- Enrich company data with BuiltWith, SimilarWeb
- Calculate ICP scores and cohort rankings
- Identify displacement opportunities

### 2. Search Audit APIs
- Execute automated search audits
- Orchestrate multi-source data enrichment
- Process background jobs (BullMQ + Redis)
- Generate audit reports and deliverables

---

## 🔧 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js | JavaScript runtime |
| Language | TypeScript | Type safety |
| Framework | Express | REST API server |
| Queue | BullMQ + Redis | Background job processing |
| Cache | Redis | 7-day TTL caching |
| Database | PostgreSQL (Supabase) | Data persistence |
| ORM | Prisma (optional) | Database access |
| File Storage | S3 or Vercel Blob | PDF reports, screenshots |
| Real-Time | Socket.IO | Live audit streaming, real-time updates |
| Browser | Playwright | Browser automation for search audits |
| AI Agent | Anthropic Agent SDK | Contextual copilot, database queries |
| RAG | Supabase pgvector | Documentation embeddings |

---

## 📋 Phase 1: Foundation (Week 1)

**Total Scope**: 33 files, ~3,200 lines, 20-28 hours (parallelizable to 5-7 hours with 5 agents)

See [PHASE1_DETAILED.md](./PHASE1_DETAILED.md) for complete specifications.

**NEW**: Phase 1 now includes Browser Automation and AI Copilot as core components.

### Phase 1A: Core Infrastructure (4-6 hours)

**Goal**: Basic project setup + HTTP client + Redis

**Files** (9 files):
1. `package.json` - Dependencies
2. `tsconfig.json` - TypeScript config
3. `.env.example` - Environment template
4. `config/index.ts` - Configuration loader
5. `services/http-client.ts` - Base HTTP client (250 lines)
6. `cache/redis-client.ts` - Redis wrapper (150 lines)
7. `utils/logger.ts` - Winston logger (50 lines)
8. `utils/errors.ts` - Custom error classes (100 lines)
9. `types/index.ts` - Type definitions (200 lines)

**Dependencies**:
```bash
npm install express typescript ts-node @types/node @types/express
npm install axios axios-retry ioredis
npm install dotenv cors helmet compression winston
npm install -D @types/cors nodemon vitest
```

---

### Phase 1B: Critical Services (4-6 hours)

**Goal**: Database + Cost tracking + Source citations

**Files** (6 files):
1. `database/supabase.ts` - Supabase client (200 lines)
2. `database/migrate.ts` - Migration runner (100 lines)
3. `services/cost-tracker.ts` - Cost tracking (150 lines)
4. `services/metrics.ts` - Metrics collection (150 lines)
5. `utils/source-citation.ts` - Citation builder (100 lines)
6. `server.ts` - Express server + health checks (150 lines)

**Additional Dependencies**:
```bash
npm install @supabase/supabase-js
npm install -D @types/node
```

**Environment Variables**:
```bash
# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Database (Supabase)
SUPABASE_URL=https://xbitqeejsgqnwvxlnjra.supabase.co
SUPABASE_KEY=...
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=...
CACHE_TTL_DEFAULT=604800        # 7 days

# API Keys (Phase 2)
SIMILARWEB_API_KEY=...
BUILTWITH_API_KEY=...
YAHOO_FINANCE_API_KEY=...
APIFY_API_KEY=...
APOLLO_API_KEY=...

# Rate Limits (requests per second)
RATE_LIMIT_SIMILARWEB=2
RATE_LIMIT_BUILTWITH=5
RATE_LIMIT_YAHOO=10

# Cost Tracking
COST_SIMILARWEB_PER_CALL=0.03
COST_BUILTWITH_PER_CALL=0.02
COST_YAHOO_PER_CALL=0.01
```

---

### Phase 1C: Production Readiness (2-4 hours)

**Goal**: Queue setup + Middleware + Testing

**Files** (5 files):
1. `queue/setup.ts` - BullMQ queue config (100 lines)
2. `middleware/auth.ts` - API key auth (80 lines)
3. `middleware/rate-limit.ts` - Rate limiting (80 lines)
4. `middleware/error-handler.ts` - Global error handler (100 lines)
5. `middleware/request-id.ts` - Request tracking (50 lines)
6. `config/api-keys.ts` - Key management (80 lines)
7. `tests/setup.ts` - Test config (100 lines)
8. `tests/http-client.test.ts` - HTTP client tests (150 lines)

**Additional Dependencies**:
```bash
npm install bullmq express-rate-limit uuid
npm install -D vitest @vitest/ui
```

---

### Phase 1D: Browser Automation (2-3 hours)

**Goal**: Playwright integration + WebSocket live streaming

**Files** (4 files):
1. `services/browser-automation.ts` - Playwright wrapper (250 lines)
2. `services/websocket-manager.ts` - Socket.IO setup (150 lines)
3. `workers/audit-browser-worker.ts` - Browser audit worker (200 lines)
4. `api/audits/live-stream.ts` - WebSocket endpoint (100 lines)

**Additional Dependencies**:
```bash
npm install playwright socket.io
npm install -D @types/socket.io
```

**Environment Variables**:
```bash
# Browser Automation
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=30000          # 30 seconds per test
SCREENSHOT_PATH=./screenshots
MAX_CONCURRENT_BROWSERS=3

# WebSocket
WEBSOCKET_PORT=3002            # Separate port for WebSocket
WEBSOCKET_CORS_ORIGIN=http://localhost:5173
```

**Purpose**:
- Run browser-based search audits using Playwright
- Stream live screenshots and progress to frontend via WebSocket
- Enable real-time audit monitoring for users
- Auto-annotate screenshots with findings

---

### Phase 1E: AI Copilot (3-4 hours)

**Goal**: Anthropic Agent SDK integration + contextual chat

**Files** (6 files):
1. `services/copilot.ts` - Anthropic Agent SDK integration (300 lines)
2. `services/copilot-tools.ts` - MCP tools for DB queries (250 lines)
3. `services/copilot-context.ts` - Context tracking (150 lines)
4. `services/copilot-rag.ts` - Documentation RAG (200 lines)
5. `api/copilot/chat.ts` - Chat endpoint (150 lines)
6. `middleware/copilot-context.ts` - User context middleware (100 lines)

**Additional Dependencies**:
```bash
npm install @anthropic-ai/sdk
npm install @supabase/pgvector-js    # For RAG embeddings
npm install openai                   # For embeddings (text-embedding-3-small)
```

**Environment Variables**:
```bash
# Anthropic Agent SDK
ANTHROPIC_API_KEY=...
COPILOT_MODEL=claude-sonnet-4-5-20250929
COPILOT_MAX_TOKENS=2048

# RAG Configuration
OPENAI_API_KEY=...              # For embeddings
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_MATCH_THRESHOLD=0.78
RAG_MATCH_COUNT=3

# Copilot Features
COPILOT_RATE_LIMIT=20           # 20 messages per user per day
COPILOT_CACHE_TTL=3600          # 1 hour cache for common queries
```

**Purpose**:
- Contextual AI assistant embedded throughout the platform
- Answer questions about companies, audits, and data
- Guide users through the interface (no manual onboarding needed)
- Explain metrics, suggest actions, surface insights
- Tool-first architecture (always grounds in database, never hallucinates)

---

## 📊 Phase 2: API Clients (Week 2)

**After Phase 1 completion**, build API client implementations.

See [API_CLIENT_SPECIFICATIONS.md](../docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md) for complete specs.

**Clients to Build** (31 endpoints total):
1. **SimilarWeb** (14 endpoints) - Traffic, engagement, keywords
2. **BuiltWith** (7 endpoints) - Tech stack, relationships
3. **Yahoo Finance** (5 endpoints) - Financials, stock data
4. **Apify** (3 actors) - LinkedIn scraping
5. **Apollo.io** (2 endpoints) - Buying committee

**Parallel Strategy**: Build all 5 clients in parallel (1-2 hours each)

---

## 🧪 Testing Phase 1

**Test Script** (`tests/phase1-integration.test.ts`):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisClient } from '../cache/redis-client';
import { HttpClient } from '../services/http-client';
import { SupabaseClient } from '../database/supabase';
import { CostTracker } from '../services/cost-tracker';

describe('Phase 1 Integration Tests', () => {
  let redis: RedisClient;
  let http: HttpClient;
  let db: SupabaseClient;
  let costs: CostTracker;

  beforeAll(async () => {
    redis = new RedisClient();
    http = new HttpClient('https://httpbin.org');
    db = new SupabaseClient();
    costs = new CostTracker();
  });

  it('should connect to Redis', async () => {
    await redis.set('test:key', 'hello', 60);
    const value = await redis.get('test:key');
    expect(value).toBe('hello');
  });

  it('should cache HTTP responses', async () => {
    const data1 = await http.get('/get', { foo: 'bar' });
    const data2 = await http.get('/get', { foo: 'bar' });
    expect(data2.meta.cached).toBe(true);
  });

  it('should track API costs', async () => {
    await costs.recordAPICall('similarweb', '/traffic', false);
    const dailyCost = await costs.getDailyCosts();
    expect(dailyCost.total).toBeGreaterThan(0);
  });

  it('should connect to Supabase', async () => {
    const companies = await db.query('companies', { limit: 1 });
    expect(companies).toBeDefined();
  });

  afterAll(async () => {
    await redis.disconnect();
    await db.disconnect();
  });
});
```

**Run Tests**:
```bash
npm test
```

---

## 📊 API Clients to Implement

See [`docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md`](../docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md) for complete specifications.

### 1. SimilarWeb Client (14 endpoints)
- Traffic & engagement metrics
- Traffic sources breakdown
- Keywords & search terms
- Competitors analysis
- Audience demographics & interests

### 2. BuiltWith Client (7 endpoints)
- Technology detection
- Partner relationships
- Company financials
- Social media presence
- Trust indicators

### 3. Yahoo Finance Client (5 endpoints)
- Stock information
- Financial statements
- Analyst recommendations
- Company holders
- Historical prices

### 4. Apify Client (3 actors)
- LinkedIn company scraper
- LinkedIn jobs scraper
- LinkedIn profile scraper

### 5. Apollo.io Client (2 endpoints)
- People search (buying committee)
- Intent signals

---

## 🔄 Background Jobs (BullMQ)

### Enrichment Worker

```typescript
// workers/enrichment-worker.ts
import { Worker } from 'bullmq';
import { RedisClient } from '../cache/redis-client';

const worker = new Worker('enrichment', async (job) => {
  const { domain, providers } = job.data;

  const results: any = {};

  // Parallel enrichment from multiple sources
  const promises = providers.map(async (provider: string) => {
    switch (provider) {
      case 'similarweb':
        results.similarweb = await similarwebClient.enrich(domain);
        break;
      case 'builtwith':
        results.builtwith = await builtwithClient.enrich(domain);
        break;
      // ... other providers
    }
  });

  await Promise.all(promises);

  return results;
}, {
  connection: redisConnection,
  concurrency: 5  // Process 5 jobs in parallel
});
```

### Audit Worker

```typescript
// workers/audit-worker.ts
import { Worker } from 'bullmq';

const worker = new Worker('audit', async (job) => {
  const { companyId, auditType } = job.data;

  // Phase 1: Enrichment (parallel)
  const enrichmentJob = await enrichmentQueue.add('enrich', {
    domain: company.domain,
    providers: ['similarweb', 'builtwith', 'yahoo-finance']
  });

  const enrichmentResults = await enrichmentJob.waitUntilFinished();

  // Phase 2: Analysis & Scoring
  const score = calculateCompositeScore(enrichmentResults);

  // Phase 3: Report Generation
  const report = generateReport(enrichmentResults, score);

  // Phase 4: Persist to database
  await saveAudit({ companyId, auditType, data: enrichmentResults, score, report });

  return { score, report };
}, {
  connection: redisConnection,
  concurrency: 3  // Limit concurrent audits
});
```

---

## 🗄️ Database Schema

See [`../data/README.md`](../data/README.md) for migration scripts.

**Key tables**:
- `companies` - Company entities
- `audits` - Audit snapshots (JSONB data)
- `enrichment_cache` - API response cache (Redis-backed)
- `jobs` - Background job tracking

---

## 🚀 Running the Server

### Development
```bash
# Start Redis (required)
redis-server

# Run database migrations
npm run migrate

# Start dev server (with hot reload)
npm run dev

# Server runs on http://localhost:3001
```

### Production
```bash
npm run build
npm start
```

### Health Checks
- `GET /health` - Server health (returns 200 if alive)
- `GET /ready` - Readiness check (Redis + DB connection)

---

## 📞 API Endpoints

### Phase 1 Endpoints (Week 1)
- `GET /health` - Health check
- `GET /ready` - Readiness check (Redis + DB)
- `GET /metrics` - Cache stats, costs, performance

### Partner Intelligence (Phase 3)
- `POST /api/partners/search` - Search for displacement targets
- `GET /api/partners/:id` - Get company details
- `POST /api/partners/:id/enrich` - Trigger enrichment

### Search Audit (Phase 3)
- `POST /api/audits/create` - Create new audit
- `GET /api/audits/:id` - Get audit status
- `POST /api/audits/:id/execute` - Execute audit
- `GET /api/audits/:id/results` - Get audit results

---

## 📈 Phase 1 Success Metrics

After Phase 1 completion, you should have:

✅ **Working infrastructure**:
- Express server running on port 3001
- Redis connection with 7-day TTL
- Supabase database connection
- Health endpoints returning 200

✅ **Core services operational**:
- HTTP client with cache-first pattern
- Cost tracking (0 calls = $0 spent)
- Metrics collection (cache hit rate = 0%)
- Source citation builder

✅ **Tests passing**:
- Redis read/write tests
- HTTP client cache tests
- Database connection tests
- Cost tracking tests

✅ **Ready for Phase 2**:
- Foundation solid enough to build API clients
- Can extend HttpClient for SimilarWeb, BuiltWith, etc.
- Database migrations run successfully

---

## 🔗 Related Documentation

- [PHASE1_DETAILED.md](./PHASE1_DETAILED.md) - Complete Phase 1 specifications
- [API Client Specifications](../docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md)
- [Architecture Decisions](../docs/features/search-audit/ARCHITECTURE_APPROVED.md)
- [Master Plan](../docs/features/search-audit/MASTER_PLAN.md)
- [Database Schema](../data/README.md)

---

## 📋 Phase 1 Summary

| Phase | Files | Lines | Time (Sequential) | Time (Parallel) | Status |
|-------|-------|-------|-------------------|-----------------|--------|
| **1A: Core** | 9 | ~750 | 4-6 hrs | 1.5-2 hrs | 🏗️ To Build |
| **1B: Critical** | 6 | ~850 | 4-6 hrs | 1.5-2 hrs | 🏗️ To Build |
| **1C: Production** | 8 | ~740 | 2-4 hrs | 1-1.5 hrs | 🏗️ To Build |
| **1D: Browser** | 4 | ~700 | 2-3 hrs | 1-1.5 hrs | 🏗️ To Build |
| **1E: Copilot** | 6 | ~1,150 | 3-4 hrs | 1.5-2 hrs | 🏗️ To Build |
| **Total** | **33** | **~4,190** | **15-23 hrs** | **7-9 hrs** | 🏗️ To Build |

**Parallel Strategy**: Build Phase 1A, 1B, 1C, 1D, 1E concurrently with 5 agents = **7-9 hours total**

**Key Additions**:
- ✅ Browser Automation (Playwright + WebSocket streaming)
- ✅ AI Copilot (Anthropic Agent SDK + contextual chat)

---

**Status**: 🏗️ Ready for parallel implementation (5 agents)
**Owner**: Backend Team
**Last Updated**: March 6, 2026, 8:00 PM
**Key Updates**: Added Phase 1D (Browser Automation) and Phase 1E (AI Copilot) as core components
