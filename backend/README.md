# Algolia-Arian Backend

**Status**: 🏗️ TO BE BUILT (Week 1-2)
**Purpose**: All server-side code for Algolia-Arian application
**Language**: TypeScript + Node.js

---

## 📂 Structure

```
backend/
├── api/                    # API endpoints (Express routes)
│   ├── partners/           # Partner Intelligence APIs
│   ├── audits/             # Search Audit APIs
│   └── enrichment/         # Enrichment APIs
│
├── services/               # Business logic & API clients
│   ├── http-client.ts      # Base HTTP client (retry, cache, rate limit)
│   ├── similarweb.ts       # SimilarWeb API client (14 endpoints)
│   ├── builtwith.ts        # BuiltWith API client (7 endpoints)
│   ├── yahoo-finance.ts    # Yahoo Finance client (5 endpoints)
│   ├── apify.ts            # Apify client (3 actors)
│   ├── apollo.ts           # Apollo.io client (2 endpoints)
│   └── scoring.ts          # Composite scoring logic
│
├── workers/                # Background jobs (BullMQ)
│   ├── enrichment-worker.ts    # Enrichment queue worker
│   └── audit-worker.ts         # Audit execution worker
│
├── cache/                  # Redis cache layer
│   └── redis-client.ts     # Redis connection & helpers
│
├── middleware/             # Express middleware
│   ├── auth.ts             # Authentication
│   ├── rate-limit.ts       # Rate limiting
│   └── error-handler.ts    # Error handling
│
└── server.ts               # Express server entry point
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
| Real-Time | Socket.IO | Live updates to frontend |
| Browser | Puppeteer + Chrome | Browser-based testing |

---

## 📋 Week 1-2: Implementation Plan

### Step 1: Project Setup

```bash
cd backend/
npm init -y
npm install express typescript ts-node @types/node @types/express
npm install bullmq redis ioredis
npm install prisma @prisma/client
npm install axios axios-retry
npm install dotenv cors helmet compression
npm install winston  # Logging
```

### Step 2: TypeScript Configuration

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 3: Environment Variables

Create `.env`:
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
SIMILARWEB_API_KEY=...
BUILTWITH_API_KEY=...
YAHOO_FINANCE_API_KEY=...
APIFY_API_KEY=...
APOLLO_API_KEY=...

# Cache TTLs (seconds)
CACHE_TTL_STABLE=604800   # 7 days
CACHE_TTL_DYNAMIC=86400   # 24 hours
```

### Step 4: Base HTTP Client

See [`docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md`](../docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md) for complete specification.

```typescript
// services/http-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import { RedisClient } from '../cache/redis-client';

export class HttpClient {
  private client: AxiosInstance;
  private redis: RedisClient;
  private cacheTTL: number;

  constructor(baseURL: string, cacheTTL: number = 604800) {
    this.client = axios.create({ baseURL, timeout: 30000 });
    this.redis = new RedisClient();
    this.cacheTTL = cacheTTL;

    // Retry on 429, 500, 502, 503, 504
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429;
      }
    });
  }

  async get<T>(endpoint: string, params: any, options?: RequestOptions): Promise<T> {
    // 1. Build cache key
    const cacheKey = this.buildCacheKey(endpoint, params);

    // 2. Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached && !options?.skipCache) {
      return JSON.parse(cached);
    }

    // 3. Rate limit check
    await this.rateLimit(options?.rateLimitKey);

    // 4. Make API call
    const response = await this.client.get(endpoint, { params });

    // 5. Save to cache
    await this.redis.set(cacheKey, JSON.stringify(response.data), this.cacheTTL);

    // 6. Persist to database (optional)
    if (options?.persist) {
      await this.persistToDatabase(cacheKey, response.data);
    }

    return response.data;
  }

  private buildCacheKey(endpoint: string, params: any): string {
    const paramStr = JSON.stringify(params, Object.keys(params).sort());
    return `api:${endpoint}:${paramStr}`;
  }

  private async rateLimit(key?: string): Promise<void> {
    // Implement rate limiting logic
  }

  private async persistToDatabase(key: string, data: any): Promise<void> {
    // Implement database persistence
  }
}
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
npm run dev
```

### Production
```bash
npm run build
npm start
```

---

## 📞 API Endpoints (To Be Implemented)

### Partner Intelligence
- `POST /api/partners/search` - Search for displacement targets
- `GET /api/partners/:id` - Get company details
- `POST /api/partners/:id/enrich` - Trigger enrichment

### Search Audit
- `POST /api/audits/create` - Create new audit
- `GET /api/audits/:id` - Get audit status
- `POST /api/audits/:id/execute` - Execute audit
- `GET /api/audits/:id/results` - Get audit results

---

## 🔗 Related Documentation

- [API Client Specifications](../docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md)
- [Architecture Decisions](../docs/features/search-audit/ARCHITECTURE_APPROVED.md)
- [Master Plan](../docs/features/search-audit/MASTER_PLAN.md)
- [Database Schema](../data/README.md)

---

**Status**: 🏗️ Ready for Week 1 implementation
**Owner**: Backend Team
**Last Updated**: March 6, 2026
