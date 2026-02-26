# PartnerForge Architecture Document

**Version:** 3.0 (Production Architecture)
**Date:** 2026-02-25
**Status:** Handoff document for parallel development threads

---

# THREAD 1: BACKEND ARCHITECTURE

## 1.1 Your Mission

You are the **Backend Architecture Thread**. Your responsibility is to design and implement a production-grade FastAPI backend that can:
1. Serve 50-100 concurrent Algolia sales users
2. Handle on-demand enrichment requests without blocking
3. Integrate with 3 external APIs (BuiltWith, SimilarWeb, Yahoo Finance)
4. Maintain data consistency in a multi-user environment
5. Be deployable to Railway/Render with zero-downtime updates

**DO NOT** work on: Frontend code, deployment scripts, data pipeline internals (that's Thread 2).

---

## 1.2 Current State (What Exists)

### 1.2.1 File Structure
```
api/
├── __init__.py          # Package init (empty)
├── main.py              # FastAPI app, 4 endpoints, ~275 lines
├── enrichment.py        # Data fetching logic, ~500 lines
├── config.py            # Configuration, ~42 lines
```

### 1.2.2 Current Endpoints

| Endpoint | Method | Current Implementation | Issues |
|----------|--------|----------------------|--------|
| `GET /` | GET | Health check | None |
| `GET /api/company/{domain}` | GET | Reads from SQLite, returns company data | No auth, no rate limiting |
| `POST /api/enrich/{domain}` | POST | Calls external APIs, updates SQLite | **SYNCHRONOUS** - blocks for 10-30 seconds |
| `GET /api/targets` | GET | Paginated list with filters | N+1 query potential |
| `GET /api/stats` | GET | Aggregate counts | No caching |

### 1.2.3 Current Database

**Type:** SQLite file at `data/partnerforge.db`

**Critical Limitation:** SQLite does not support concurrent writes. If two users click "Refresh Data" simultaneously, one will fail.

**Current Schema (displacement_targets table):**
```sql
CREATE TABLE displacement_targets (
    id INTEGER PRIMARY KEY,
    domain TEXT,
    company_name TEXT,
    partner_tech TEXT,
    vertical TEXT,
    country TEXT,
    city TEXT,
    state TEXT,
    tech_spend INTEGER,
    emails TEXT,
    phones TEXT,
    socials TEXT,
    exec_titles TEXT,
    sw_monthly_visits INTEGER,
    sw_bounce_rate REAL,
    sw_pages_per_visit REAL,
    sw_avg_duration INTEGER,
    sw_search_traffic_pct REAL,
    sw_rank_global INTEGER,
    matched_case_studies TEXT,
    lead_score INTEGER,
    created_at TEXT,
    icp_tier INTEGER,
    icp_score INTEGER,
    score_reasons TEXT,
    icp_tier_name TEXT,
    score_breakdown TEXT,
    ticker TEXT,
    is_public INTEGER DEFAULT 0,
    enrichment_level TEXT DEFAULT 'basic',
    last_enriched TIMESTAMP,
    revenue REAL,
    gross_margin REAL,
    traffic_growth REAL,
    current_search TEXT,
    trigger_events TEXT,
    exec_quote TEXT,
    exec_name TEXT,
    exec_title TEXT,
    quote_source TEXT,
    competitors_using_algolia TEXT,
    displacement_angle TEXT,
    financials_json TEXT,
    hiring_signals TEXT,
    tech_stack_json TEXT
);
```

### 1.2.4 Current Pain Points

1. **Synchronous enrichment** - User waits 10-30 seconds while API calls complete
2. **No authentication** - Anyone with the URL can access
3. **No rate limiting** - External API quotas can be exhausted
4. **SQLite concurrency** - Will fail under multi-user load
5. **No connection pooling** - New connection per request
6. **Monolithic enrichment** - All-or-nothing, no partial success
7. **No retry logic** - If BuiltWith fails, whole request fails
8. **No structured logging** - Just print statements
9. **No health checks** - No readiness/liveness probes
10. **Hardcoded config** - API URLs in code, not environment

---

## 1.3 Target Architecture

### 1.3.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER (FastAPI)                       │
│  • Route handlers (thin - validation + delegation only)          │
│  • Request/Response models (Pydantic)                            │
│  • Authentication middleware                                     │
│  • Rate limiting middleware                                      │
│  • Error handling middleware                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
│  • CompanyService - business logic for company operations        │
│  • EnrichmentService - orchestrates enrichment workflow          │
│  • ScoringService - ICP + signal scoring calculations            │
│  • CacheService - Redis operations                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REPOSITORY LAYER                              │
│  • CompanyRepository - CRUD for companies                        │
│  • EnrichmentRepository - enrichment status tracking             │
│  • CaseStudyRepository - case study matching                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  • PostgreSQL (via SQLAlchemy + asyncpg)                        │
│  • Redis (caching + job queue)                                   │
│  • Connection pooling                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3.2 Target File Structure

```
api/
├── __init__.py
├── main.py                    # FastAPI app factory, middleware setup
├── config.py                  # Pydantic Settings class
├── dependencies.py            # Dependency injection setup
│
├── routes/
│   ├── __init__.py
│   ├── companies.py           # /api/companies/* endpoints
│   ├── enrichment.py          # /api/enrich/* endpoints
│   ├── targets.py             # /api/targets/* endpoints
│   └── health.py              # /health, /ready, /live
│
├── services/
│   ├── __init__.py
│   ├── company_service.py
│   ├── enrichment_service.py
│   ├── scoring_service.py
│   └── cache_service.py
│
├── repositories/
│   ├── __init__.py
│   ├── base.py                # Abstract base repository
│   ├── company_repository.py
│   └── enrichment_repository.py
│
├── models/
│   ├── __init__.py
│   ├── database.py            # SQLAlchemy models
│   ├── requests.py            # Pydantic request models
│   └── responses.py           # Pydantic response models
│
├── middleware/
│   ├── __init__.py
│   ├── auth.py                # API key authentication
│   ├── rate_limit.py          # Per-user rate limiting
│   └── logging.py             # Structured logging
│
├── exceptions/
│   ├── __init__.py
│   └── handlers.py            # Global exception handlers
│
└── tests/
    ├── __init__.py
    ├── conftest.py            # pytest fixtures
    ├── test_companies.py
    ├── test_enrichment.py
    └── test_scoring.py
```

---

## 1.4 Specific Implementation Tasks

### 1.4.1 Task: Database Migration (SQLite → PostgreSQL)

**Priority:** CRITICAL - Must be done first

**Requirements:**
1. Create SQLAlchemy ORM models that match current schema
2. Use Alembic for migrations
3. Create migration script that:
   - Creates Postgres schema
   - Copies all 2,687 records from SQLite
   - Verifies row counts match
4. Use asyncpg for async database operations
5. Implement connection pooling (min=5, max=20)

**SQLAlchemy Model to Create:**
```python
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class DisplacementTarget(Base):
    __tablename__ = "displacement_targets"

    id = Column(Integer, primary_key=True)
    domain = Column(String(255), unique=True, nullable=False, index=True)
    company_name = Column(String(255))
    partner_tech = Column(String(255))
    vertical = Column(String(100), index=True)
    country = Column(String(10), index=True)
    city = Column(String(100))
    state = Column(String(100))
    tech_spend = Column(Integer)

    # SimilarWeb data
    sw_monthly_visits = Column(Integer)
    sw_bounce_rate = Column(Float)
    sw_pages_per_visit = Column(Float)
    sw_avg_duration = Column(Integer)
    sw_search_traffic_pct = Column(Float)
    sw_rank_global = Column(Integer)

    # Scoring
    icp_tier = Column(Integer, index=True)
    icp_tier_name = Column(String(50))
    icp_score = Column(Integer, index=True)
    score_breakdown = Column(JSON)

    # Financial
    ticker = Column(String(20))
    is_public = Column(Boolean, default=False)
    revenue = Column(Float)
    gross_margin = Column(Float)

    # Intelligence
    traffic_growth = Column(Float)
    current_search = Column(String(255))
    trigger_events = Column(JSON)  # Changed from TEXT to JSON
    exec_quote = Column(Text)
    exec_name = Column(String(255))
    exec_title = Column(String(255))
    quote_source = Column(String(500))
    competitors_using_algolia = Column(Text)
    displacement_angle = Column(Text)
    financials_json = Column(JSON)
    hiring_signals = Column(Text)
    tech_stack_json = Column(JSON)

    # Metadata
    enrichment_level = Column(String(20), default='basic')
    last_enriched = Column(DateTime)
    created_at = Column(DateTime, server_default='now()')
    updated_at = Column(DateTime, server_default='now()', onupdate='now()')
```

**Acceptance Criteria:**
- [ ] All 2,687 records migrated
- [ ] All queries work with new schema
- [ ] Connection pooling verified under load
- [ ] Rollback script exists

---

### 1.4.2 Task: Authentication System

**Priority:** HIGH

**Design Decision:** API Key authentication (not OAuth)

**Rationale:**
- Internal tool for Algolia employees only
- No need for OAuth complexity
- API keys can be rotated easily
- Can add Algolia SSO later as middleware

**Implementation:**
```python
# api/middleware/auth.py
from fastapi import HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    if api_key is None:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Missing API key"
        )

    # Check against stored keys (from DB or env)
    valid_keys = get_valid_api_keys()  # Implement this
    if api_key not in valid_keys:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )

    return api_key
```

**API Key Storage:**
- Store hashed keys in `api_keys` table
- Include: key_hash, user_email, created_at, last_used, rate_limit_tier
- Never store raw keys

**Acceptance Criteria:**
- [ ] All endpoints require API key except /health
- [ ] Invalid key returns 403
- [ ] Keys are hashed in database
- [ ] Key usage is logged

---

### 1.4.3 Task: Rate Limiting

**Priority:** HIGH

**Design:**
- Per-user rate limits (based on API key)
- Separate limits for read vs write operations
- External API call budget tracking

**Rate Limit Tiers:**
| Tier | Read/min | Write/min | Enrichments/day |
|------|----------|-----------|-----------------|
| Standard | 100 | 20 | 50 |
| Power | 500 | 100 | 200 |
| Admin | Unlimited | Unlimited | Unlimited |

**Implementation:** Use `slowapi` or custom Redis-based limiter

```python
# api/middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

def get_api_key_or_ip(request):
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return api_key
    return get_remote_address(request)

limiter = Limiter(key_func=get_api_key_or_ip)
```

**Acceptance Criteria:**
- [ ] Rate limits enforced per API key
- [ ] 429 response when exceeded
- [ ] Rate limit headers in response (X-RateLimit-Remaining, etc.)
- [ ] Redis-backed for distributed deployments

---

### 1.4.4 Task: Async Enrichment with Background Jobs

**Priority:** CRITICAL

**Current Problem:** POST /api/enrich/{domain} blocks for 10-30 seconds

**Solution:** Return immediately, process in background

**Design:**
```
Client                    API                     Worker              External APIs
  │                        │                        │                       │
  │ POST /enrich/costco    │                        │                       │
  │───────────────────────>│                        │                       │
  │                        │ Queue job              │                       │
  │                        │───────────────────────>│                       │
  │ 202 Accepted           │                        │                       │
  │<───────────────────────│                        │                       │
  │ {job_id: "abc123"}     │                        │                       │
  │                        │                        │ Fetch BuiltWith       │
  │                        │                        │──────────────────────>│
  │                        │                        │<──────────────────────│
  │                        │                        │ Fetch SimilarWeb      │
  │                        │                        │──────────────────────>│
  │                        │                        │<──────────────────────│
  │                        │                        │ Fetch Yahoo Finance   │
  │                        │                        │──────────────────────>│
  │                        │                        │<──────────────────────│
  │                        │                        │ Update DB             │
  │                        │                        │                       │
  │ GET /enrich/status/abc │                        │                       │
  │───────────────────────>│                        │                       │
  │ {status: "completed"}  │                        │                       │
  │<───────────────────────│                        │                       │
```

**Technology Choice:** Redis Queue (RQ) or Celery

**Recommendation:** RQ for simplicity (Celery is overkill for this scale)

**New Endpoints:**
```
POST /api/enrich/{domain}
  Returns: 202 Accepted, {job_id: string, status_url: string}

GET /api/enrich/status/{job_id}
  Returns: {status: "pending"|"running"|"completed"|"failed", progress: int, result?: object}

GET /api/enrich/jobs
  Returns: List of recent jobs for this API key
```

**Acceptance Criteria:**
- [ ] Enrichment returns in <500ms
- [ ] Job status queryable
- [ ] Failed jobs have error details
- [ ] Jobs expire after 24 hours
- [ ] Concurrent job limit per user

---

### 1.4.5 Task: Service Layer Implementation

**CompanyService:**
```python
class CompanyService:
    def __init__(self, repo: CompanyRepository, cache: CacheService):
        self.repo = repo
        self.cache = cache

    async def get_by_domain(self, domain: str) -> Optional[Company]:
        # Check cache first
        cached = await self.cache.get(f"company:{domain}")
        if cached:
            return Company.parse_raw(cached)

        # Fetch from DB
        company = await self.repo.get_by_domain(domain)
        if company:
            await self.cache.set(f"company:{domain}", company.json(), ttl=3600)

        return company

    async def list_targets(
        self,
        page: int = 1,
        per_page: int = 50,
        tier: Optional[int] = None,
        score_min: Optional[int] = None,
        score_max: Optional[int] = None,
        search: Optional[str] = None,
    ) -> PaginatedResult[Company]:
        return await self.repo.list_with_filters(
            page=page,
            per_page=per_page,
            filters={"tier": tier, "score_min": score_min, "score_max": score_max},
            search=search,
        )
```

**Acceptance Criteria:**
- [ ] All business logic in services, not routes
- [ ] Services are testable (inject mocked repos)
- [ ] Caching transparent to caller
- [ ] Error handling consistent

---

### 1.4.6 Task: Error Handling

**Global Exception Handler:**
```python
# api/exceptions/handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR

class AppException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code

class NotFoundError(AppException):
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource} with identifier '{identifier}' not found",
            status_code=404
        )

class RateLimitError(AppException):
    def __init__(self, retry_after: int):
        super().__init__(
            code="RATE_LIMITED",
            message=f"Rate limit exceeded. Retry after {retry_after} seconds",
            status_code=429
        )

async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        }
    )
```

**Standard Error Response Format:**
```json
{
    "error": {
        "code": "ENRICHMENT_FAILED",
        "message": "Failed to fetch data from BuiltWith",
        "details": {
            "provider": "builtwith",
            "status_code": 403,
            "retry_after": 3600
        }
    }
}
```

---

### 1.4.7 Task: OpenAPI Specification

Generate OpenAPI 3.0 spec with:
- All endpoints documented
- Request/response schemas
- Authentication requirements
- Rate limit documentation
- Error response schemas

**Example Endpoint Documentation:**
```python
@router.get(
    "/companies/{domain}",
    response_model=CompanyResponse,
    responses={
        200: {"description": "Company data retrieved successfully"},
        404: {"model": ErrorResponse, "description": "Company not found"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
    tags=["Companies"],
    summary="Get company by domain",
    description="Retrieve company data including ICP score, enrichment status, and intelligence.",
)
async def get_company(domain: str = Path(..., example="costco.com")):
    ...
```

---

## 1.5 Testing Requirements

### Unit Tests
- Every service method
- Every repository method
- Authentication middleware
- Rate limiting logic

### Integration Tests
- Full request/response cycles
- Database operations
- Cache operations

### Load Tests
- 50 concurrent users
- 100 requests/second sustained
- Enrichment queue under load

**Test Coverage Target:** 80%+

---

## 1.6 Deliverables Checklist

- [ ] SQLAlchemy models + Alembic migrations
- [ ] PostgreSQL connection with pooling
- [ ] API key authentication
- [ ] Rate limiting (Redis-backed)
- [ ] Background job processing (RQ)
- [ ] Service layer (Company, Enrichment, Scoring)
- [ ] Repository layer with async operations
- [ ] Global error handling
- [ ] Structured logging (JSON format)
- [ ] OpenAPI spec generation
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] Load test scripts

---
---
---

# THREAD 2: DATA PIPELINE

## 2.1 Your Mission

You are the **Data Pipeline Thread**. Your responsibility is to design and implement robust, fault-tolerant data fetching from three external APIs:
1. BuiltWith - Technology stack detection
2. SimilarWeb - Traffic and engagement metrics
3. Yahoo Finance - Financial data for public companies

**DO NOT** work on: API routes, authentication, database schema (that's Thread 1), or frontend (that's Thread 3).

---

## 2.2 Current State (What Exists)

### 2.2.1 Current Implementation

**File:** `api/enrichment.py` (~500 lines)

**Current Functions:**
```python
def fetch_builtwith_data(domain: str) -> Optional[Dict]:
    # Uses BUILTWITH_FREE_API_URL
    # No retry logic
    # No rate limiting awareness
    # No circuit breaker

def fetch_similarweb_data(domain: str) -> Optional[Dict]:
    # Uses SIMILARWEB_API_BASE
    # Hardcoded date range
    # No pagination handling
    # Falls back to None on any error

def fetch_yahoo_finance_data(ticker: str) -> Optional[Dict]:
    # Uses yfinance library
    # No error differentiation
    # No caching

def enrich_company(domain: str, force: bool = False) -> Dict:
    # Orchestrates all three
    # All synchronous
    # All-or-nothing (no partial success)
```

### 2.2.2 Current Pain Points

1. **No retry logic** - Transient failures cause complete failure
2. **No rate limiting awareness** - Exhaust API quotas quickly
3. **No circuit breaker** - Keep hammering failed services
4. **No backoff** - Immediate retries overwhelm APIs
5. **No partial success** - One failure = entire enrichment fails
6. **No validation** - Bad data passes through silently
7. **No transformation layer** - Raw API responses stored directly
8. **No monitoring** - No visibility into success/failure rates
9. **Synchronous** - Blocks the calling thread
10. **No idempotency** - Re-running may cause inconsistent state

---

## 2.3 API Details

### 2.3.1 BuiltWith API

**Base URL:** `https://api.builtwith.com/free1/api.json`

**Authentication:** API key in query parameter `KEY`

**Rate Limits:**
- Free tier: 100 calls/day
- Pro tier: 10,000 calls/day
- Key: Set via `BUILTWITH_API_KEY` environment variable

**Endpoints Used:**

| Endpoint | Purpose | Response Size |
|----------|---------|---------------|
| `free1/api.json?KEY={key}&LOOKUP={domain}` | Full tech stack | ~5-50KB |

**Response Structure:**
```json
{
    "Results": [{
        "Result": {
            "Paths": [{
                "Technologies": [{
                    "Name": "Algolia",
                    "Tag": "search",
                    "FirstDetected": 1609459200000,
                    "LastDetected": 1708819200000
                }]
            }]
        }
    }]
}
```

**Error Codes:**
- 200: Success
- 403: Invalid API key or quota exceeded
- 404: Domain not found
- 429: Rate limited
- 500: Server error

**Fallback Strategy:**
1. Try free API first
2. If 403/429, check if we have SimilarWeb tech data
3. Use `get-website-content-technologies-agg` from SimilarWeb as fallback

---

### 2.3.2 SimilarWeb API

**Base URL:** `https://api.similarweb.com/v1/website`

**Authentication:** API key in query parameter `api_key`

**Rate Limits:**
- ~500 calls/day
- Key: Set via `SIMILARWEB_API_KEY` environment variable

**Endpoints Used:**

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `/{domain}/total-traffic-and-engagement/visits` | Monthly visits | `/costco.com/total-traffic-and-engagement/visits` |
| `/{domain}/traffic-sources/overview` | Traffic sources | |
| `/{domain}/similar-sites/similarsites` | Competitors | |
| `/{domain}/keywords-competitors` | Keyword competitors | |
| `/{domain}/technologies-agg` | Tech stack (fallback) | |

**Common Parameters:**
```
start_date=2024-01 (YYYY-MM)
end_date=2024-12
country=world (or "us", "gb", etc.)
granularity=monthly
main_domain_only=false
```

**Response Structure (visits):**
```json
{
    "visits": [
        {"date": "2024-01", "visits": 45000000},
        {"date": "2024-02", "visits": 47000000}
    ]
}
```

**Error Codes:**
- 200: Success
- 400: Bad request (invalid parameters)
- 403: Access denied (quota or permissions)
- 404: Domain not found
- 500: Server error

**Known Issues:**
- `country: "us"` sometimes returns 403 - use `"world"` as fallback
- Some domains require specific subscription tiers
- Rate limits are per-minute, not just daily

---

### 2.3.3 Yahoo Finance (via yfinance)

**Library:** `yfinance>=0.2.36`

**Not an API** - Library scrapes Yahoo Finance pages

**Functions Used:**
```python
import yfinance as yf

stock = yf.Ticker("COST")
stock.info                     # Company info, sector, employees
stock.income_stmt              # Income statement (3 years)
stock.balance_sheet            # Balance sheet (3 years)
stock.quarterly_income_stmt    # Recent quarters
stock.recommendations          # Analyst recommendations
stock.news                     # Recent news articles
```

**Rate Limits:**
- No official limits, but aggressive scraping gets blocked
- Recommendation: Max 1 request per second
- Use 2-second delay between companies

**Ticker Resolution Challenge:**
- yfinance has no search function
- Must resolve ticker via WebSearch first
- 54 tickers already mapped in code (see TICKER_MAP in skill)

**Error Handling:**
- `stock.info` returns empty dict if ticker not found
- Some fields may be `None`
- Network errors throw exceptions

---

## 2.4 Target Architecture

### 2.4.1 Pipeline Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENRICHMENT ORCHESTRATOR                       │
│  • Receives enrichment request                                   │
│  • Determines which providers to call                            │
│  • Handles partial success                                       │
│  • Reports final status                                          │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  BuiltWith    │     │   SimilarWeb    │     │  Yahoo Finance  │
│   Adapter     │     │    Adapter      │     │    Adapter      │
├───────────────┤     ├─────────────────┤     ├─────────────────┤
│ • Rate limit  │     │ • Rate limit    │     │ • Rate limit    │
│ • Retry logic │     │ • Retry logic   │     │ • Retry logic   │
│ • Circuit brk │     │ • Circuit brk   │     │ • Circuit brk   │
│ • Transform   │     │ • Transform     │     │ • Transform     │
│ • Validate    │     │ • Validate      │     │ • Validate      │
└───────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RESULT AGGREGATOR                         │
│  • Merge results from all providers                             │
│  • Apply data quality scoring                                   │
│  • Calculate derived fields (margin zone, signals, etc.)        │
│  • Persist to database                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4.2 Target File Structure

```
pipeline/
├── __init__.py
├── orchestrator.py           # EnrichmentOrchestrator class
├── aggregator.py             # ResultAggregator class
│
├── adapters/
│   ├── __init__.py
│   ├── base.py               # BaseAdapter abstract class
│   ├── builtwith.py          # BuiltWithAdapter
│   ├── similarweb.py         # SimilarWebAdapter
│   └── yahoo_finance.py      # YahooFinanceAdapter
│
├── transformers/
│   ├── __init__.py
│   ├── builtwith.py          # Transform raw BW response
│   ├── similarweb.py         # Transform raw SW response
│   └── yahoo_finance.py      # Transform raw YF response
│
├── validators/
│   ├── __init__.py
│   └── schemas.py            # Pydantic validation schemas
│
├── utils/
│   ├── __init__.py
│   ├── retry.py              # Retry decorator with backoff
│   ├── circuit_breaker.py    # Circuit breaker implementation
│   └── rate_limiter.py       # Token bucket rate limiter
│
└── tests/
    ├── __init__.py
    ├── test_builtwith.py
    ├── test_similarweb.py
    ├── test_yahoo_finance.py
    └── test_orchestrator.py
```

---

## 2.5 Specific Implementation Tasks

### 2.5.1 Task: Base Adapter Class

```python
# pipeline/adapters/base.py
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional
from datetime import datetime

T = TypeVar('T')

class AdapterResult(Generic[T]):
    def __init__(
        self,
        success: bool,
        data: Optional[T] = None,
        error: Optional[str] = None,
        provider: str = "",
        latency_ms: int = 0,
        cached: bool = False,
    ):
        self.success = success
        self.data = data
        self.error = error
        self.provider = provider
        self.latency_ms = latency_ms
        self.cached = cached
        self.timestamp = datetime.utcnow()

class BaseAdapter(ABC):
    def __init__(self, config: dict):
        self.config = config
        self.rate_limiter = RateLimiter(config.get('rate_limit', 60))
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=config.get('failure_threshold', 5),
            recovery_timeout=config.get('recovery_timeout', 60),
        )

    @abstractmethod
    async def fetch(self, identifier: str) -> AdapterResult:
        """Fetch data for the given identifier (domain or ticker)"""
        pass

    @abstractmethod
    def transform(self, raw_data: dict) -> dict:
        """Transform raw API response to normalized format"""
        pass

    @abstractmethod
    def validate(self, data: dict) -> bool:
        """Validate transformed data against schema"""
        pass
```

---

### 2.5.2 Task: Retry Logic with Exponential Backoff

```python
# pipeline/utils/retry.py
import asyncio
from functools import wraps
from typing import Type, Tuple
import random

def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,),
):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e

                    if attempt == max_retries:
                        raise

                    # Calculate delay with exponential backoff
                    delay = min(
                        base_delay * (exponential_base ** attempt),
                        max_delay
                    )

                    # Add jitter to prevent thundering herd
                    if jitter:
                        delay = delay * (0.5 + random.random())

                    await asyncio.sleep(delay)

            raise last_exception

        return wrapper
    return decorator
```

**Usage:**
```python
@retry_with_backoff(
    max_retries=3,
    base_delay=1.0,
    retryable_exceptions=(httpx.TimeoutError, httpx.HTTPStatusError),
)
async def fetch_builtwith(self, domain: str):
    ...
```

---

### 2.5.3 Task: Circuit Breaker

```python
# pipeline/utils/circuit_breaker.py
import asyncio
from datetime import datetime, timedelta
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        success_threshold: int = 2,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self.state = CircuitState.CLOSED
        self.failures = 0
        self.successes = 0
        self.last_failure_time = None

    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                return True
            return False

        # HALF_OPEN: allow limited requests
        return True

    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.successes += 1
            if self.successes >= self.success_threshold:
                self._reset()
        else:
            self._reset()

    def record_failure(self):
        self.failures += 1
        self.last_failure_time = datetime.utcnow()

        if self.failures >= self.failure_threshold:
            self.state = CircuitState.OPEN

    def _should_attempt_reset(self) -> bool:
        if self.last_failure_time is None:
            return True
        return datetime.utcnow() > self.last_failure_time + timedelta(seconds=self.recovery_timeout)

    def _reset(self):
        self.state = CircuitState.CLOSED
        self.failures = 0
        self.successes = 0

class CircuitOpenError(Exception):
    pass
```

---

### 2.5.4 Task: Rate Limiter (Token Bucket)

```python
# pipeline/utils/rate_limiter.py
import asyncio
from datetime import datetime

class RateLimiter:
    def __init__(self, rate: int, per: int = 60):
        """
        Token bucket rate limiter.

        Args:
            rate: Number of tokens (requests) allowed
            per: Time period in seconds (default 60 = per minute)
        """
        self.rate = rate
        self.per = per
        self.tokens = rate
        self.last_refill = datetime.utcnow()
        self._lock = asyncio.Lock()

    async def acquire(self) -> bool:
        async with self._lock:
            self._refill()

            if self.tokens >= 1:
                self.tokens -= 1
                return True

            return False

    async def wait_for_token(self, timeout: float = 30.0):
        """Wait until a token is available or timeout."""
        start = datetime.utcnow()

        while True:
            if await self.acquire():
                return

            elapsed = (datetime.utcnow() - start).total_seconds()
            if elapsed > timeout:
                raise TimeoutError("Rate limit timeout")

            # Wait for refill interval
            await asyncio.sleep(self.per / self.rate)

    def _refill(self):
        now = datetime.utcnow()
        elapsed = (now - self.last_refill).total_seconds()

        # Add tokens based on elapsed time
        new_tokens = elapsed * (self.rate / self.per)
        self.tokens = min(self.rate, self.tokens + new_tokens)
        self.last_refill = now
```

---

### 2.5.5 Task: BuiltWith Adapter

```python
# pipeline/adapters/builtwith.py
import httpx
from typing import Optional
from .base import BaseAdapter, AdapterResult
from ..utils.retry import retry_with_backoff

class BuiltWithAdapter(BaseAdapter):
    PROVIDER = "builtwith"

    def __init__(self, api_key: str, config: dict = None):
        super().__init__(config or {})
        self.api_key = api_key
        self.base_url = "https://api.builtwith.com/free1/api.json"

    @retry_with_backoff(max_retries=3, retryable_exceptions=(httpx.TimeoutError,))
    async def fetch(self, domain: str) -> AdapterResult:
        if not self.circuit_breaker.can_execute():
            return AdapterResult(
                success=False,
                error="Circuit breaker open",
                provider=self.PROVIDER,
            )

        await self.rate_limiter.wait_for_token()

        start = datetime.utcnow()

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    self.base_url,
                    params={"KEY": self.api_key, "LOOKUP": domain}
                )

                latency = int((datetime.utcnow() - start).total_seconds() * 1000)

                if response.status_code == 403:
                    self.circuit_breaker.record_failure()
                    return AdapterResult(
                        success=False,
                        error="API key invalid or quota exceeded",
                        provider=self.PROVIDER,
                        latency_ms=latency,
                    )

                if response.status_code == 429:
                    self.circuit_breaker.record_failure()
                    return AdapterResult(
                        success=False,
                        error="Rate limited",
                        provider=self.PROVIDER,
                        latency_ms=latency,
                    )

                response.raise_for_status()

                self.circuit_breaker.record_success()

                raw_data = response.json()
                transformed = self.transform(raw_data)

                if not self.validate(transformed):
                    return AdapterResult(
                        success=False,
                        error="Validation failed",
                        provider=self.PROVIDER,
                        latency_ms=latency,
                    )

                return AdapterResult(
                    success=True,
                    data=transformed,
                    provider=self.PROVIDER,
                    latency_ms=latency,
                )

        except httpx.HTTPStatusError as e:
            self.circuit_breaker.record_failure()
            return AdapterResult(
                success=False,
                error=f"HTTP {e.response.status_code}",
                provider=self.PROVIDER,
            )
        except Exception as e:
            self.circuit_breaker.record_failure()
            return AdapterResult(
                success=False,
                error=str(e),
                provider=self.PROVIDER,
            )

    def transform(self, raw_data: dict) -> dict:
        technologies = []

        results = raw_data.get("Results", [])
        if results and "Result" in results[0]:
            paths = results[0]["Result"].get("Paths", [])
            for path in paths:
                for tech in path.get("Technologies", []):
                    technologies.append({
                        "name": tech.get("Name"),
                        "category": tech.get("Tag"),
                        "first_detected": tech.get("FirstDetected"),
                        "last_detected": tech.get("LastDetected"),
                    })

        # Detect search vendor
        search_vendor = None
        search_techs = ["Algolia", "Elasticsearch", "Coveo", "Bloomreach",
                       "Constructor", "Lucidworks", "Searchspring", "Klevu"]
        for tech in technologies:
            if tech["name"] in search_techs:
                search_vendor = tech["name"]
                break

        return {
            "technologies": technologies,
            "technology_count": len(technologies),
            "search_vendor": search_vendor,
            "has_algolia": any(t["name"] == "Algolia" for t in technologies),
        }

    def validate(self, data: dict) -> bool:
        return isinstance(data.get("technologies"), list)
```

---

### 2.5.6 Task: Enrichment Orchestrator

```python
# pipeline/orchestrator.py
import asyncio
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

class EnrichmentStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"

@dataclass
class EnrichmentResult:
    domain: str
    status: EnrichmentStatus
    builtwith: Optional[Dict] = None
    similarweb: Optional[Dict] = None
    yahoo_finance: Optional[Dict] = None
    errors: Dict[str, str] = None
    duration_ms: int = 0

class EnrichmentOrchestrator:
    def __init__(
        self,
        builtwith_adapter: BuiltWithAdapter,
        similarweb_adapter: SimilarWebAdapter,
        yahoo_adapter: YahooFinanceAdapter,
        ticker_resolver: TickerResolver,
    ):
        self.builtwith = builtwith_adapter
        self.similarweb = similarweb_adapter
        self.yahoo = yahoo_adapter
        self.ticker_resolver = ticker_resolver

    async def enrich(
        self,
        domain: str,
        include_financials: bool = True,
    ) -> EnrichmentResult:
        start = datetime.utcnow()
        errors = {}

        # Run BuiltWith and SimilarWeb in parallel
        bw_task = asyncio.create_task(self.builtwith.fetch(domain))
        sw_task = asyncio.create_task(self.similarweb.fetch(domain))

        bw_result, sw_result = await asyncio.gather(bw_task, sw_task)

        # Handle BuiltWith result
        builtwith_data = None
        if bw_result.success:
            builtwith_data = bw_result.data
        else:
            errors["builtwith"] = bw_result.error

        # Handle SimilarWeb result
        similarweb_data = None
        if sw_result.success:
            similarweb_data = sw_result.data
        else:
            errors["similarweb"] = sw_result.error

        # Yahoo Finance (if applicable)
        yahoo_data = None
        if include_financials:
            ticker = await self.ticker_resolver.resolve(domain)
            if ticker:
                yf_result = await self.yahoo.fetch(ticker)
                if yf_result.success:
                    yahoo_data = yf_result.data
                else:
                    errors["yahoo_finance"] = yf_result.error

        # Determine overall status
        has_any_data = any([builtwith_data, similarweb_data, yahoo_data])
        all_failed = all([e is not None for e in errors.values()])

        if not has_any_data:
            status = EnrichmentStatus.FAILED
        elif errors:
            status = EnrichmentStatus.PARTIAL
        else:
            status = EnrichmentStatus.COMPLETED

        duration = int((datetime.utcnow() - start).total_seconds() * 1000)

        return EnrichmentResult(
            domain=domain,
            status=status,
            builtwith=builtwith_data,
            similarweb=similarweb_data,
            yahoo_finance=yahoo_data,
            errors=errors if errors else None,
            duration_ms=duration,
        )
```

---

### 2.5.7 Task: Data Validation Schemas

```python
# pipeline/validators/schemas.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime

class Technology(BaseModel):
    name: str
    category: Optional[str]
    first_detected: Optional[int]
    last_detected: Optional[int]

class BuiltWithData(BaseModel):
    technologies: List[Technology]
    technology_count: int = Field(ge=0)
    search_vendor: Optional[str]
    has_algolia: bool

class SimilarWebData(BaseModel):
    monthly_visits: int = Field(ge=0)
    bounce_rate: Optional[float] = Field(ge=0, le=1)
    pages_per_visit: Optional[float] = Field(ge=0)
    avg_duration: Optional[int] = Field(ge=0)
    search_traffic_pct: Optional[float] = Field(ge=0, le=1)

    @validator('bounce_rate', 'search_traffic_pct', pre=True)
    def convert_percentage(cls, v):
        if v is not None and v > 1:
            return v / 100
        return v

class YahooFinanceData(BaseModel):
    ticker: str
    company_name: Optional[str]
    market_cap: Optional[int]
    revenue: Optional[int]
    gross_margin: Optional[float]
    operating_margin: Optional[float]
    profit_margin: Optional[float]
    employees: Optional[int]
    sector: Optional[str]
    industry: Optional[str]
```

---

## 2.6 Testing Requirements

### Mock Responses
Create mock responses for all three APIs:
- Happy path (full data)
- Partial data (some fields missing)
- Error responses (403, 429, 500)
- Timeout scenarios

### Test Scenarios
1. All three APIs succeed
2. BuiltWith fails, others succeed (partial)
3. All APIs fail (complete failure)
4. Circuit breaker opens after failures
5. Rate limiter delays requests
6. Retry succeeds after transient failure
7. Retry exhausts retries

---

## 2.7 Deliverables Checklist

- [ ] Base adapter class with standard interface
- [ ] BuiltWith adapter with full error handling
- [ ] SimilarWeb adapter with full error handling
- [ ] Yahoo Finance adapter with full error handling
- [ ] Retry decorator with exponential backoff + jitter
- [ ] Circuit breaker implementation
- [ ] Token bucket rate limiter
- [ ] Enrichment orchestrator with parallel execution
- [ ] Data validation schemas (Pydantic)
- [ ] Transformation functions (raw → normalized)
- [ ] Ticker resolver (domain → ticker mapping)
- [ ] Unit tests for all adapters
- [ ] Integration tests with mocked APIs
- [ ] Monitoring metrics (success rate, latency, errors)

---
---
---

# THREAD 3: FRONTEND / UX

## 3.1 Your Mission

You are the **Frontend/UX Thread**. Your responsibility is to design and implement a modern, responsive web interface that:
1. Displays 2,687 displacement targets efficiently
2. Provides rich detail views with intelligence data
3. Handles loading states and errors gracefully
4. Works on desktop and tablet
5. Integrates with the backend API

**DO NOT** work on: Backend code, data pipeline, deployment (those are other threads).

---

## 3.2 Current State (What Exists)

### 3.2.1 Current Implementation

**Files:**
- `index.html` - Single-file dashboard (~2,100 lines of HTML/CSS/JS)
- `api-client.js` - API integration functions (~245 lines)

**Architecture:**
- Static HTML generated by Python script
- All 2,687 companies embedded as JSON in the HTML
- No framework (vanilla JS)
- No build process

### 3.2.2 Current Features

| Feature | Status | Issues |
|---------|--------|--------|
| Company list | Works | All data loaded at once (slow) |
| Search/filter | Works | Client-side only |
| Column sorting | Works | |
| Excel-style filters | Works | |
| Detail modal | Works | Dark theme, glassmorphism |
| Refresh button | Exists | API not deployed |
| Loading spinner | Exists | |
| CSV export | Works | |

### 3.2.3 Current Pain Points

1. **No framework** - Difficult to maintain, no component reuse
2. **All data in HTML** - 2,687 records = large initial load
3. **No lazy loading** - Everything rendered at once
4. **No state management** - Scattered across global variables
5. **No error boundaries** - JS errors break entire page
6. **No accessibility** - Missing ARIA labels, keyboard nav
7. **No responsive design** - Fixed widths
8. **No dark mode toggle** - Hardcoded light theme (list) vs dark (detail)
9. **Inconsistent styling** - Mix of inline and embedded CSS

---

## 3.3 Target Architecture

### 3.3.1 Technology Stack

| Category | Choice | Rationale |
|----------|--------|-----------|
| Framework | **React 18** | Component model, hooks, suspense |
| Build tool | **Vite** | Fast HMR, simple config |
| Styling | **Tailwind CSS** | Utility-first, consistent design |
| State | **Zustand** | Lightweight, no boilerplate |
| Data fetching | **React Query** | Caching, loading states, pagination |
| Routing | **React Router v6** | SPA navigation |
| Tables | **TanStack Table** | Virtual scrolling, sorting, filtering |
| Charts | **Recharts** | Financial charts |
| Icons | **Lucide React** | Modern icon set |

### 3.3.2 File Structure

```
frontend/
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
│
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component + routing
│   ├── index.css                   # Tailwind imports
│   │
│   ├── api/
│   │   ├── client.ts               # Axios instance with interceptors
│   │   ├── companies.ts            # Company API functions
│   │   └── types.ts                # API response types
│   │
│   ├── stores/
│   │   ├── useFilters.ts           # Filter state (Zustand)
│   │   ├── useSettings.ts          # User preferences
│   │   └── useAuth.ts              # API key storage
│   │
│   ├── hooks/
│   │   ├── useCompanies.ts         # React Query hook for company list
│   │   ├── useCompanyDetail.ts     # React Query hook for detail
│   │   └── useEnrichment.ts        # Enrichment mutation
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── company/
│   │   │   ├── CompanyTable.tsx    # Main data table
│   │   │   ├── CompanyRow.tsx      # Single row
│   │   │   ├── CompanyFilters.tsx  # Filter controls
│   │   │   ├── CompanyDetail.tsx   # Full detail view
│   │   │   ├── ScoreBadge.tsx      # ICP score visualization
│   │   │   └── SignalIndicator.tsx # Budget/Pain/Timing chips
│   │   │
│   │   ├── detail/
│   │   │   ├── FinancialsTab.tsx
│   │   │   ├── QuotesTab.tsx
│   │   │   ├── HiringTab.tsx
│   │   │   ├── TechStackTab.tsx
│   │   │   └── FullIntelTab.tsx
│   │   │
│   │   ├── charts/
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── TrafficChart.tsx
│   │   │   └── ScoreGauge.tsx
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Modal.tsx
│   │       ├── Tabs.tsx
│   │       ├── Loading.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── Toast.tsx
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx           # Main list view
│   │   ├── CompanyPage.tsx         # Detail page (/company/:domain)
│   │   └── SettingsPage.tsx        # API key config
│   │
│   └── utils/
│       ├── format.ts               # Number/currency formatters
│       ├── constants.ts            # API URLs, verticals, etc.
│       └── cn.ts                   # Tailwind class merge utility
│
└── public/
    ├── favicon.ico
    └── algolia-logo.svg
```

---

## 3.4 Specific Implementation Tasks

### 3.4.1 Task: Virtual Scrolling Table

**Problem:** 2,687 rows causes janky scrolling and slow rendering

**Solution:** TanStack Table with virtualization

```tsx
// src/components/company/CompanyTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';

export function CompanyTable({ data }: { data: Company[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // Row height in pixels
    overscan: 20, // Render 20 extra rows for smooth scrolling
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-white">
          {/* Header rows */}
        </thead>
        <tbody>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={row.id}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Cells */}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Smooth scrolling at 60fps
- [ ] Only visible rows rendered
- [ ] Sorting works without re-rendering all rows
- [ ] Filtering updates efficiently

---

### 3.4.2 Task: API Integration with React Query

```tsx
// src/hooks/useCompanies.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi } from '../api/companies';

export function useCompanies(filters: CompanyFilters) {
  return useQuery({
    queryKey: ['companies', filters],
    queryFn: () => companiesApi.list(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: previousData => previousData, // Keep old data while loading
  });
}

export function useCompanyDetail(domain: string) {
  return useQuery({
    queryKey: ['company', domain],
    queryFn: () => companiesApi.getByDomain(domain),
    staleTime: 60 * 1000, // 1 minute
    enabled: !!domain, // Only fetch when domain is provided
  });
}

export function useEnrichment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ domain, force }: { domain: string; force?: boolean }) =>
      companiesApi.enrich(domain, force),
    onSuccess: (data, variables) => {
      // Invalidate the company detail query
      queryClient.invalidateQueries(['company', variables.domain]);
      // Optionally update the list cache
      queryClient.invalidateQueries(['companies']);
    },
  });
}
```

---

### 3.4.3 Task: Filter State Management

```tsx
// src/stores/useFilters.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FilterState {
  search: string;
  tier: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  verticals: string[];
  countries: string[];
  sortBy: 'score' | 'traffic' | 'company';
  sortDir: 'asc' | 'desc';
  page: number;
  perPage: number;

  // Actions
  setSearch: (search: string) => void;
  setTier: (tier: number | null) => void;
  setScoreRange: (min: number | null, max: number | null) => void;
  toggleVertical: (vertical: string) => void;
  toggleCountry: (country: string) => void;
  setSort: (by: string, dir: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  reset: () => void;
}

const initialState = {
  search: '',
  tier: null,
  scoreMin: null,
  scoreMax: null,
  verticals: [],
  countries: [],
  sortBy: 'score' as const,
  sortDir: 'desc' as const,
  page: 1,
  perPage: 50,
};

export const useFilters = create<FilterState>()(
  persist(
    (set) => ({
      ...initialState,

      setSearch: (search) => set({ search, page: 1 }),
      setTier: (tier) => set({ tier, page: 1 }),
      setScoreRange: (min, max) => set({ scoreMin: min, scoreMax: max, page: 1 }),
      toggleVertical: (vertical) => set((state) => ({
        verticals: state.verticals.includes(vertical)
          ? state.verticals.filter((v) => v !== vertical)
          : [...state.verticals, vertical],
        page: 1,
      })),
      toggleCountry: (country) => set((state) => ({
        countries: state.countries.includes(country)
          ? state.countries.filter((c) => c !== country)
          : [...state.countries, country],
        page: 1,
      })),
      setSort: (by, dir) => set({ sortBy: by as any, sortDir: dir }),
      setPage: (page) => set({ page }),
      reset: () => set(initialState),
    }),
    {
      name: 'partnerforge-filters',
    }
  )
);
```

---

### 3.4.4 Task: Company Detail View

```tsx
// src/pages/CompanyPage.tsx
import { useParams } from 'react-router-dom';
import { useCompanyDetail, useEnrichment } from '../hooks';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '../components/ui/Tabs';

export function CompanyPage() {
  const { domain } = useParams<{ domain: string }>();
  const { data: company, isLoading, error } = useCompanyDetail(domain!);
  const enrichment = useEnrichment();

  if (isLoading) return <CompanyDetailSkeleton />;
  if (error) return <ErrorState error={error} />;
  if (!company) return <NotFound />;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="p-8 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold">{company.company_name}</h1>
              <ScoreBadge score={company.icp_score} />
              <PriorityBadge score={company.icp_score} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-slate-400">
              <span>{company.domain}</span>
              <span>{company.vertical}</span>
              <span>{company.country}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <EnrichmentStatus
              level={company.enrichment_level}
              lastEnriched={company.last_enriched}
            />
            <Button
              onClick={() => enrichment.mutate({ domain: domain!, force: true })}
              loading={enrichment.isPending}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Signal indicators */}
        <div className="flex gap-4 mt-6">
          <SignalChip type="budget" active={hasBudgetSignal(company)} />
          <SignalChip type="pain" active={hasPainSignal(company)} />
          <SignalChip type="timing" active={hasTimingSignal(company)} />
        </div>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-8 p-8">
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <MetricBox label="Revenue" value={formatCurrency(company.revenue)} />
            <MetricBox label="Gross Margin" value={formatPercent(company.gross_margin)} />
            <MetricBox label="Monthly Visits" value={formatNumber(company.sw_monthly_visits)} />
            <MetricBox label="Traffic Growth" value={formatPercent(company.traffic_growth)} trend />
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Trigger Events</h3>
          <TriggerEventList events={company.trigger_events} />
        </GlassCard>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financials" className="p-8">
        <TabList>
          <Tab value="financials">Financials</Tab>
          <Tab value="quotes">Executive Quotes</Tab>
          <Tab value="hiring">Hiring</Tab>
          <Tab value="techstack">Tech Stack</Tab>
          <Tab value="full">Full Intel</Tab>
        </TabList>

        <TabPanels className="mt-6">
          <TabPanel value="financials">
            <FinancialsTab company={company} />
          </TabPanel>
          <TabPanel value="quotes">
            <QuotesTab company={company} />
          </TabPanel>
          <TabPanel value="hiring">
            <HiringTab company={company} />
          </TabPanel>
          <TabPanel value="techstack">
            <TechStackTab company={company} />
          </TabPanel>
          <TabPanel value="full">
            <FullIntelTab company={company} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
}
```

---

### 3.4.5 Task: Design System Components

**Color Palette (Tailwind):**
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'algolia-blue': '#003DFF',
        'algolia-purple': '#5468FF',
        'space-gray': '#21243D',
        'nebula': {
          50: '#f0f3ff',
          100: '#e0e7ff',
          500: '#5468FF',
          600: '#003DFF',
          700: '#0033cc',
        },
        'priority': {
          hot: '#ef4444',
          warm: '#f59e0b',
          cool: '#3b82f6',
          cold: '#94a3b8',
        },
      },
    },
  },
};
```

**Glass Card Component:**
```tsx
// src/components/ui/GlassCard.tsx
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        'bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6',
        className
      )}
    >
      {children}
    </div>
  );
}
```

---

### 3.4.6 Task: Loading States

```tsx
// src/components/company/CompanyTableSkeleton.tsx
export function CompanyTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-48" />
          <div className="h-4 bg-slate-200 rounded w-32" />
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="h-4 bg-slate-200 rounded w-16" />
          <div className="h-4 bg-slate-200 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

// src/components/company/CompanyDetailSkeleton.tsx
export function CompanyDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-900 animate-pulse">
      <header className="p-8 border-b border-white/10">
        <div className="h-8 bg-white/10 rounded w-64 mb-4" />
        <div className="h-4 bg-white/10 rounded w-48" />
      </header>
      <div className="grid grid-cols-2 gap-8 p-8">
        <div className="h-48 bg-white/5 rounded-2xl" />
        <div className="h-48 bg-white/5 rounded-2xl" />
      </div>
    </div>
  );
}
```

---

### 3.4.7 Task: Error Handling

```tsx
// src/components/ui/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-red-600">Something went wrong</h2>
          <p className="text-slate-600 mt-2">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 3.5 Deliverables Checklist

- [ ] Vite + React + TypeScript project setup
- [ ] Tailwind CSS configuration with Algolia colors
- [ ] Virtual scrolling table (2,687 rows smooth)
- [ ] React Query integration for data fetching
- [ ] Zustand store for filter state
- [ ] Company list page with search/filter/sort
- [ ] Company detail page with tabs
- [ ] Glassmorphism card components
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] API key settings page
- [ ] Responsive design (desktop + tablet)
- [ ] Keyboard navigation
- [ ] Unit tests for components
- [ ] E2E tests with Playwright

---
---
---

# THREAD 4: INFRASTRUCTURE / DEVOPS

## 4.1 Your Mission

You are the **Infrastructure Thread**. Your responsibility is to:
1. Deploy the FastAPI backend to production
2. Set up PostgreSQL database (managed service)
3. Set up Redis for caching and job queues
4. Configure CI/CD pipelines
5. Set up monitoring and alerting
6. Handle secrets management

**DO NOT** work on: Application code, database schema, frontend (those are other threads).

---

## 4.2 Current State

### 4.2.1 Current Deployments

| Component | Platform | URL | Status |
|-----------|----------|-----|--------|
| Frontend (static) | Vercel | https://partnerforge.vercel.app | Live |
| Backend (API) | None | N/A | Not deployed |
| Database | Local SQLite | `data/partnerforge.db` | Not deployed |

### 4.2.2 Current Configuration

**Files:**
- `.env` - Local environment (API keys)
- `.env.example` - Template
- `vercel.json` - Vercel config (static hosting only)

**GitHub:**
- Repo: `https://github.com/arijitchowdhury80/partnerforge`
- Branch: `main`
- Auto-deploy to Vercel on push

---

## 4.3 Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE                                │
│  • DNS                                                          │
│  • SSL termination                                              │
│  • DDoS protection                                              │
│  • Edge caching (static assets)                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────┐                     ┌─────────────────────┐
│      VERCEL       │                     │      RAILWAY        │
│  (Frontend)       │                     │  (Backend)          │
├───────────────────┤                     ├─────────────────────┤
│  • React app      │   API calls         │  • FastAPI app      │
│  • Static assets  │ ─────────────────>  │  • RQ workers       │
│  • CDN delivery   │                     │  • Health checks    │
└───────────────────┘                     └─────────────────────┘
                                                    │
                            ┌───────────────────────┼───────────────────────┐
                            ▼                       ▼                       ▼
                    ┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
                    │   SUPABASE    │     │    UPSTASH      │     │   EXTERNAL      │
                    │  (PostgreSQL) │     │    (Redis)      │     │     APIs        │
                    ├───────────────┤     ├─────────────────┤     ├─────────────────┤
                    │  • Companies  │     │  • Cache        │     │  • BuiltWith    │
                    │  • Intel data │     │  • Job queue    │     │  • SimilarWeb   │
                    │  • Users      │     │  • Rate limits  │     │  • Yahoo Fin    │
                    │  • Backups    │     │  • Sessions     │     │                 │
                    └───────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 4.4 Specific Implementation Tasks

### 4.4.1 Task: Railway Deployment

**Why Railway:**
- Easy Python deployment
- Free tier for development
- PostgreSQL addon
- Redis addon
- Auto-deploy from GitHub

**Files to Create:**

```yaml
# railway.toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt"

[deploy]
startCommand = "uvicorn api.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 5
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

```dockerfile
# Dockerfile (alternative)
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Deployment Steps:**
1. `railway login`
2. `railway init`
3. `railway add --database postgres`
4. `railway add --database redis`
5. Configure environment variables (see 4.4.4)
6. `railway up`

---

### 4.4.2 Task: PostgreSQL Setup (Supabase)

**Why Supabase:**
- Generous free tier (500MB)
- Built-in connection pooling
- Dashboard for management
- Easy migrations

**Setup Steps:**
1. Create Supabase project
2. Get connection string
3. Run migrations (see Thread 1)
4. Import data from SQLite

**Migration Script:**
```python
# scripts/migrate_to_postgres.py
import sqlite3
import psycopg2
from psycopg2.extras import execute_batch

SQLITE_PATH = "data/partnerforge.db"
POSTGRES_URL = os.environ["DATABASE_URL"]

def migrate():
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_cursor = sqlite_conn.cursor()

    # Connect to Postgres
    pg_conn = psycopg2.connect(POSTGRES_URL)
    pg_cursor = pg_conn.cursor()

    # Get all records from SQLite
    sqlite_cursor.execute("SELECT * FROM displacement_targets")
    rows = sqlite_cursor.fetchall()

    # Get column names
    columns = [desc[0] for desc in sqlite_cursor.description]

    # Insert into Postgres
    insert_sql = f"""
        INSERT INTO displacement_targets ({', '.join(columns)})
        VALUES ({', '.join(['%s'] * len(columns))})
        ON CONFLICT (id) DO NOTHING
    """

    execute_batch(pg_cursor, insert_sql, rows, page_size=100)

    pg_conn.commit()
    print(f"Migrated {len(rows)} records")
```

---

### 4.4.3 Task: Redis Setup (Upstash)

**Why Upstash:**
- Serverless Redis (pay per request)
- Free tier (10,000 commands/day)
- REST API (no persistent connections needed)

**Setup:**
1. Create Upstash account
2. Create Redis database
3. Get connection URL
4. Configure in environment

**Usage in app:**
```python
import redis
from urllib.parse import urlparse

def get_redis():
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return None

    url = urlparse(redis_url)
    return redis.Redis(
        host=url.hostname,
        port=url.port,
        password=url.password,
        ssl=True,
    )
```

---

### 4.4.4 Task: Environment Variables

**Required Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `rediss://default:pass@host:6379` |
| `BUILTWITH_API_KEY` | BuiltWith API key | `8fd992ef-...` |
| `SIMILARWEB_API_KEY` | SimilarWeb API key | `483b77d4...` |
| `API_KEY_SALT` | Salt for hashing API keys | Random 32-char string |
| `CORS_EXTRA_ORIGINS` | Additional CORS origins | `https://custom.domain.com` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `ENVIRONMENT` | Environment name | `production` |

**Railway Configuration:**
```bash
railway variables set DATABASE_URL="postgresql://..."
railway variables set REDIS_URL="rediss://..."
railway variables set BUILTWITH_API_KEY="..."
railway variables set SIMILARWEB_API_KEY="..."
railway variables set API_KEY_SALT="..."
railway variables set ENVIRONMENT="production"
```

---

### 4.4.5 Task: CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  PYTHON_VERSION: "3.11"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio

      - name: Run tests
        run: pytest --cov=api --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: coverage.xml

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install linters
        run: pip install ruff mypy

      - name: Run ruff
        run: ruff check api/

      - name: Run mypy
        run: mypy api/

  deploy:
    needs: [test, lint]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy to Railway
        run: railway up --service partnerforge-api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

### 4.4.6 Task: Monitoring & Alerting

**Observability Stack:**

| Tool | Purpose | Free Tier |
|------|---------|-----------|
| **Better Stack (Logtail)** | Logs | 1GB/month |
| **Sentry** | Error tracking | 5K errors/month |
| **Better Uptime** | Uptime monitoring | 10 monitors |

**Structured Logging:**
```python
# api/middleware/logging.py
import structlog
import logging

def configure_logging():
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(),
    )

# Usage
logger = structlog.get_logger()
logger.info("enrichment_started", domain="costco.com", user_id="abc123")
logger.error("enrichment_failed", domain="costco.com", error="API timeout")
```

**Health Check Endpoints:**
```python
@router.get("/health")
async def health():
    return {"status": "healthy"}

@router.get("/ready")
async def ready(db: Database = Depends(get_db)):
    # Check database connection
    await db.execute("SELECT 1")
    return {"status": "ready"}

@router.get("/live")
async def live():
    return {"status": "live"}
```

---

### 4.4.7 Task: Secrets Management

**For Railway:**
- Use Railway's built-in secrets (encrypted at rest)
- Reference via environment variables
- No secrets in code or Git

**For Local Development:**
```bash
# .env (never commit)
DATABASE_URL=postgresql://localhost/partnerforge
REDIS_URL=redis://localhost:6379
BUILTWITH_API_KEY=your-key
SIMILARWEB_API_KEY=your-key
```

**.gitignore:**
```
.env
.env.local
.env.*.local
*.pem
*.key
secrets/
```

---

## 4.5 Deliverables Checklist

- [ ] Railway project setup
- [ ] PostgreSQL database (Supabase)
- [ ] Redis cache (Upstash)
- [ ] SQLite → PostgreSQL migration script
- [ ] Dockerfile (optional, for debugging)
- [ ] `railway.toml` configuration
- [ ] GitHub Actions CI/CD workflow
- [ ] Environment variables configured
- [ ] Health check endpoints
- [ ] Structured logging
- [ ] Sentry error tracking
- [ ] Uptime monitoring
- [ ] DNS configuration (optional subdomain)
- [ ] SSL certificate (automatic via Railway)
- [ ] Deployment runbook documentation

---

# THREAD OPENING INSTRUCTIONS

## For Thread 1 (Backend Architecture)

```
Open the PartnerForge project directory:
/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge

Read ARCHITECTURE.md, specifically the "THREAD 1: BACKEND ARCHITECTURE" section (lines 1-350 approximately).

Your mission is to implement a production-grade FastAPI backend. Start with:
1. Database migration (SQLite → PostgreSQL with SQLAlchemy + Alembic)
2. Authentication system (API key-based)
3. Async enrichment with background jobs

Do NOT work on frontend, data pipeline internals, or deployment. Focus only on the backend service layer and API design.

Begin by reading the current api/ directory to understand what exists, then start implementing the target architecture.
```

## For Thread 2 (Data Pipeline)

```
Open the PartnerForge project directory:
/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge

Read ARCHITECTURE.md, specifically the "THREAD 2: DATA PIPELINE" section (lines 351-650 approximately).

Your mission is to implement robust, fault-tolerant data fetching from BuiltWith, SimilarWeb, and Yahoo Finance. Start with:
1. Base adapter class with retry logic, circuit breaker, rate limiting
2. BuiltWith adapter implementation
3. Enrichment orchestrator with parallel execution

Do NOT work on API routes, authentication, or deployment. Focus only on the data fetching layer.

Begin by reading api/enrichment.py to understand current implementation, then refactor using the adapter pattern.
```

## For Thread 3 (Frontend/UX)

```
Open the PartnerForge project directory:
/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge

Read ARCHITECTURE.md, specifically the "THREAD 3: FRONTEND / UX" section (lines 651-950 approximately).

Your mission is to implement a modern React frontend with virtual scrolling, state management, and a polished UX. Start with:
1. Vite + React + TypeScript project setup
2. Virtual scrolling table for 2,687 companies
3. React Query integration for data fetching

Do NOT work on backend code, data pipeline, or deployment. Focus only on the frontend application.

Begin by examining index.html to understand current features, then create a new frontend/ directory with the React app.
```

## For Thread 4 (Infrastructure)

```
Open the PartnerForge project directory:
/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge

Read ARCHITECTURE.md, specifically the "THREAD 4: INFRASTRUCTURE / DEVOPS" section (lines 951-1200 approximately).

Your mission is to deploy the FastAPI backend to production with proper infrastructure. Start with:
1. Railway project setup
2. PostgreSQL database (Supabase)
3. GitHub Actions CI/CD pipeline

Do NOT write application code. Focus only on infrastructure, deployment, and monitoring.

Begin by reviewing the current deployment (Vercel static site), then set up the backend infrastructure.
```

---

*Document Version: 3.0*
*Created: 2026-02-25*
*Purpose: Handoff document for parallel development threads*
