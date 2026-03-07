# SimilarWeb API Client - Usage Guide

**Version**: 1.0
**Date**: March 7, 2026
**Status**: Production Ready

---

## Overview

The `SimilarWebClient` provides access to 14 SimilarWeb API endpoints for comprehensive traffic analytics, engagement metrics, competitor analysis, and audience insights.

### Features

- **Automatic Caching**: 7-day Redis cache (604800 seconds)
- **Rate Limiting**: 2 requests/second (configurable)
- **Retry Logic**: Exponential backoff on failures
- **Cost Tracking**: $0.03 per API call
- **Type Safety**: Full TypeScript types for all responses
- **Batch Operations**: Fetch all endpoints in parallel

---

## Quick Start

```typescript
import { SimilarWebClient, DateRange } from './services/similarweb';

const client = new SimilarWebClient();

// Get traffic data for last 6 months
const dateRange: DateRange = {
  start: '2025-06',
  end: '2025-12'
};

const traffic = await client.getTrafficData('costco.com', dateRange);
console.log(`Monthly visits: ${traffic.data.visits[0].visits.toLocaleString()}`);
```

---

## Configuration

### Environment Variables

```bash
# Required
SIMILARWEB_API_KEY=your_api_key_here

# Optional (with defaults)
RATE_LIMIT_SIMILARWEB=2              # Requests per second
COST_SIMILARWEB_PER_CALL=0.03        # USD per API call
CACHE_TTL_DEFAULT=604800              # 7 days in seconds
```

### Config File

Defined in `backend/config/index.ts`:

```typescript
{
  redis: {
    cacheTTL: 604800  // 7 days
  },
  rateLimit: {
    similarweb: 2     // 2 req/s
  },
  costs: {
    similarweb: 0.03  // $0.03 per call
  }
}
```

---

## API Endpoints

### 1. Traffic & Engagement (2 endpoints)

#### 1.1 Traffic Data

Get monthly visits and unique visitors.

```typescript
const traffic = await client.getTrafficData('costco.com', {
  start: '2025-06',
  end: '2025-12'
});

// Response
{
  data: {
    visits: [
      { date: '2025-12', visits: 100900000 }
    ],
    meta: {
      request: { domain: 'costco.com', start_date: '2025-06', end_date: '2025-12' },
      status: 'success',
      last_updated: '2025-12-15'
    }
  },
  meta: {
    source: 'api',       // 'api' or 'cache'
    cached: false,
    timestamp: '2025-12-15T10:00:00Z',
    latency_ms: 250
  }
}
```

#### 1.2 Engagement Metrics

Get bounce rate, pages per visit, and average duration.

```typescript
const engagement = await client.getEngagementMetrics('costco.com', {
  start: '2025-12',
  end: '2025-12'
});

console.log(`Bounce rate: ${engagement.data.bounce_rate[0].bounce_rate * 100}%`);
console.log(`Pages/visit: ${engagement.data.pages_per_visit[0].pages_per_visit}`);
console.log(`Avg duration: ${engagement.data.avg_visit_duration[0].avg_visit_duration}s`);
```

---

### 2. Traffic Sources (1 endpoint)

Get breakdown by channel (direct, search, social, referral, email, display).

```typescript
const sources = await client.getTrafficSources('costco.com', {
  start: '2025-12',
  end: '2025-12'
});

console.log('Traffic Sources:');
console.log(`- Direct: ${sources.data.channels.direct * 100}%`);
console.log(`- Search: ${sources.data.channels.search * 100}%`);
console.log(`  - Organic: ${sources.data.search_breakdown.organic * 100}%`);
console.log(`  - Paid: ${sources.data.search_breakdown.paid * 100}%`);
```

---

### 3. Geographic Distribution (1 endpoint)

Get traffic by country (top 5).

```typescript
const geo = await client.getGeography('costco.com', {
  start: '2025-12',
  end: '2025-12'
});

geo.data.countries.forEach(country => {
  console.log(`${country.country_name}: ${country.visits_share * 100}%`);
});
```

---

### 4. Demographics (1 endpoint)

Get age and gender distribution.

```typescript
const demographics = await client.getDemographics('costco.com');

console.log('Age Distribution:');
Object.entries(demographics.data.age_distribution).forEach(([age, share]) => {
  console.log(`- ${age}: ${share * 100}%`);
});

console.log('\nGender Distribution:');
console.log(`- Male: ${demographics.data.gender_distribution.male * 100}%`);
console.log(`- Female: ${demographics.data.gender_distribution.female * 100}%`);
```

---

### 5. Keywords (1 endpoint)

Get top organic search keywords.

```typescript
const keywords = await client.getTopKeywords('costco.com', 20);

keywords.data.keywords.forEach((kw, i) => {
  console.log(`${i + 1}. ${kw.keyword}`);
  console.log(`   Traffic share: ${kw.visits_share * 100}%`);
  console.log(`   Volume: ${kw.volume.toLocaleString()} searches/month`);
  console.log(`   SERP position: ${kw.position}`);
});
```

---

### 6. Competitors (2 endpoints)

#### 6.1 Similar Sites

Get competitor websites.

```typescript
const competitors = await client.getSimilarSites('costco.com', 10);

competitors.data.sites.forEach(site => {
  console.log(`${site.domain} - ${site.similarity_score * 100}% similar`);
});
```

#### 6.2 Keyword Competitors

Get keyword overlap with competitors.

```typescript
const overlap = await client.getKeywordCompetitors('costco.com', 5);

overlap.data.competitors.forEach(comp => {
  console.log(`${comp.domain}:`);
  console.log(`  - ${comp.shared_keywords} shared keywords`);
  console.log(`  - ${comp.keyword_overlap * 100}% overlap`);
});
```

---

### 7. Audience Insights (1 endpoint)

Get interest categories and affinity scores.

```typescript
const interests = await client.getAudienceInterests('costco.com');

interests.data.interests.forEach(interest => {
  console.log(`${interest.category}: ${interest.affinity}x more likely than average`);
});
```

---

### 8. Technology Stack (1 endpoint)

Get detected technologies (analytics, advertising, CMS).

**Note**: Limited data. Use BuiltWith as primary source.

```typescript
const tech = await client.getTechnologies('costco.com');

tech.data.technologies.forEach(t => {
  console.log(`${t.category}: ${t.name}`);
});
```

---

### 9. Referrals (1 endpoint)

Get top referring domains.

```typescript
const referrals = await client.getReferrals('costco.com', 20);

referrals.data.referrals.forEach(ref => {
  console.log(`${ref.domain}: ${ref.share * 100}%`);
});
```

---

### 10. Content Analysis (3 endpoints)

#### 10.1 Popular Pages

Get most visited pages.

```typescript
const pages = await client.getPopularPages('costco.com', 20);

pages.data.pages.forEach(page => {
  console.log(`${page.page}: ${page.share * 100}%`);
});
```

#### 10.2 Leading Folders

Get top site sections.

```typescript
const folders = await client.getLeadingFolders('costco.com', 10);

folders.data.folders.forEach(folder => {
  console.log(`${folder.folder}: ${folder.share * 100}%`);
});
```

#### 10.3 Landing Pages

Get SEO entry pages with keywords.

```typescript
const landing = await client.getLandingPages('costco.com', 20);

landing.data.landing_pages.forEach(page => {
  console.log(`${page.page}`);
  console.log(`  Keyword: ${page.keyword}`);
  console.log(`  Share: ${page.visits_share * 100}%`);
});
```

---

### 11. Website Rank (1 endpoint)

Get global and category rank.

```typescript
const rank = await client.getWebsiteRank('costco.com');

console.log(`Global rank: #${rank.data.global_rank}`);
console.log(`Category: ${rank.data.category}`);
console.log(`Category rank: #${rank.data.category_rank}`);
```

---

## Batch Operations

### Fetch All Data at Once

Use `fetchAllData()` to execute all 14 endpoints in parallel.

```typescript
const allData = await client.fetchAllData('costco.com', {
  start: '2025-12',
  end: '2025-12'
});

// Access individual results
console.log('Traffic:', allData.traffic.data.visits);
console.log('Competitors:', allData.competitors.data.sites);
console.log('Demographics:', allData.demographics.data.age_distribution);

// Check metadata
console.log('\nBatch Metadata:');
console.log(`Total endpoints: ${allData.meta.totalEndpoints}`);
console.log(`Cache hits: ${allData.meta.cacheHits}`);
console.log(`Cache misses: ${allData.meta.cacheMisses}`);
console.log(`Total time: ${allData.meta.totalTimeMs}ms`);
console.log(`Estimated cost: $${allData.meta.estimatedCost.toFixed(2)}`);
```

**Response Structure**:

```typescript
{
  traffic: APIResponse<TrafficData>,
  engagement: APIResponse<EngagementData>,
  sources: APIResponse<TrafficSourceData>,
  geography: APIResponse<GeographyData>,
  demographics: APIResponse<DemographicsData>,
  keywords: APIResponse<KeywordData>,
  competitors: APIResponse<CompetitorData>,
  interests: APIResponse<InterestData>,
  technologies: APIResponse<TechnologyData>,
  referrals: APIResponse<ReferralData>,
  popularPages: APIResponse<PopularPagesData>,
  leadingFolders: APIResponse<LeadingFoldersData>,
  landingPages: APIResponse<LandingPagesData>,
  keywordCompetitors: APIResponse<KeywordCompetitorsData>,
  websiteRank: APIResponse<WebsiteRankData>,
  meta: {
    totalEndpoints: number,
    cacheHits: number,
    cacheMisses: number,
    totalTimeMs: number,
    estimatedCost: number
  }
}
```

---

## Caching Behavior

### Cache Key Generation

Keys are generated from:
- Endpoint path
- Query parameters (sorted for consistency)
- MD5 hash of parameters

Example: `api:/website/costco.com/traffic:a3d8f9c2b1e4`

### Cache TTL

- Default: **7 days** (604800 seconds)
- Configurable via `CACHE_TTL_DEFAULT`

### Bypass Cache

```typescript
// Force fresh API call (not yet implemented in client)
const traffic = await client.getTrafficData('costco.com', dateRange);
// Note: Cache bypass requires HttpClient modification
```

### Cache Hit Indicators

```typescript
const result = await client.getTrafficData('costco.com', dateRange);

if (result.meta.cached) {
  console.log('Data served from cache');
  console.log(`Latency: ${result.meta.latency_ms}ms`); // ~5ms for cache hits
} else {
  console.log('Data from live API');
  console.log(`Latency: ${result.meta.latency_ms}ms`); // ~200-300ms for API calls
}
```

---

## Rate Limiting

### Token Bucket Algorithm

- **Rate**: 2 requests/second (default)
- **Burst**: Up to 5 concurrent requests
- **Wait**: Automatic delay when limit exceeded

### Monitoring

```typescript
// Rate limiting is transparent
// The client automatically waits when rate limit is hit
// Check logs for rate limit warnings

// Example log output:
// [WARN] Rate limit hit for similarweb, waiting 500ms
```

---

## Error Handling

### API Errors

```typescript
try {
  const traffic = await client.getTrafficData('invalid-domain.com', dateRange);
} catch (error) {
  if (error instanceof APIError) {
    console.error(`API Error ${error.status}: ${error.message}`);
    console.error(`Endpoint: ${error.endpoint}`);
    console.error(`Retryable: ${error.retryable}`);
  }
}
```

### Rate Limit Errors

```typescript
try {
  const traffic = await client.getTrafficData('costco.com', dateRange);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error(`Rate limit exceeded for ${error.endpoint}`);
    console.error(`Retry after: ${error.retryAfter} seconds`);
  }
}
```

### Network Errors

```typescript
try {
  const traffic = await client.getTrafficData('costco.com', dateRange);
} catch (error) {
  console.error('Network error:', error.message);
  // Retry logic is automatic (3 retries with exponential backoff)
}
```

---

## Cost Optimization

### Cache Hit Rate

Target: **86% cache hit rate** (from architecture specs)

```typescript
const allData = await client.fetchAllData('costco.com', dateRange);

const hitRate = allData.meta.cacheHits / allData.meta.totalEndpoints;
console.log(`Cache hit rate: ${hitRate * 100}%`);

// Expected cost scenarios:
// - 0% cache: $0.70 per audit (14 endpoints × $0.05)
// - 86% cache: $0.10 per audit (2 endpoints × $0.05)
```

### Selective Fetching

Don't use `fetchAllData()` if you only need specific endpoints:

```typescript
// BAD: Fetches all 14 endpoints ($0.70)
const allData = await client.fetchAllData('costco.com', dateRange);
const traffic = allData.traffic;

// GOOD: Fetches only 1 endpoint ($0.05)
const traffic = await client.getTrafficData('costco.com', dateRange);
```

---

## Integration with Enrichment Service

### Example: Enrichment Orchestrator

```typescript
import { SimilarWebClient } from './services/similarweb';
import { EnrichmentOrchestrator } from './services/enrichment-orchestrator';

class EnrichmentOrchestrator {
  private similarweb: SimilarWebClient;

  constructor() {
    this.similarweb = new SimilarWebClient();
  }

  async enrichCompany(domain: string, auditId: string) {
    // Define date range (last 6 months)
    const dateRange = this.getDateRange(6);

    // Fetch SimilarWeb data
    const swData = await this.similarweb.fetchAllData(domain, dateRange);

    // Store in database
    await this.storeTraffic(domain, auditId, swData.traffic);
    await this.storeEngagement(domain, auditId, swData.engagement);
    await this.storeCompetitors(domain, auditId, swData.competitors);
    // ... store other data

    return {
      success: true,
      cacheHitRate: swData.meta.cacheHits / swData.meta.totalEndpoints,
      cost: swData.meta.estimatedCost
    };
  }

  private getDateRange(months: number): DateRange {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
    };
  }
}
```

---

## Testing

### Unit Tests

Located at: `backend/services/__tests__/similarweb.test.ts`

Run tests:

```bash
npm test similarweb
```

### Integration Tests

```typescript
import { SimilarWebClient } from './services/similarweb';

describe('SimilarWeb Integration', () => {
  const client = new SimilarWebClient();

  it('should fetch real traffic data', async () => {
    const traffic = await client.getTrafficData('costco.com', {
      start: '2025-12',
      end: '2025-12'
    });

    expect(traffic.data.visits).toHaveLength(1);
    expect(traffic.data.visits[0].visits).toBeGreaterThan(0);
  }, 30000); // 30s timeout for API calls
});
```

---

## Troubleshooting

### Issue: "Missing API Key"

**Error**: `SIMILARWEB_API_KEY environment variable not set`

**Solution**:

```bash
export SIMILARWEB_API_KEY=your_api_key_here
```

### Issue: Rate Limit Exceeded

**Error**: `Rate limit hit for similarweb, waiting 500ms`

**Solution**:

- Reduce concurrent requests
- Increase `RATE_LIMIT_SIMILARWEB` config
- Wait for rate limiter to recover

### Issue: Cache Not Working

**Symptoms**: All requests return `cached: false`

**Solution**:

1. Check Redis connection:
   ```typescript
   const redis = new RedisClient();
   await redis.ping(); // Should return 'PONG'
   ```

2. Check cache TTL:
   ```typescript
   console.log(config.redis.cacheTTL); // Should be 604800
   ```

3. Check cache keys:
   ```bash
   redis-cli KEYS "api:*"
   ```

### Issue: Slow Response Times

**Symptoms**: Latency > 5 seconds

**Solution**:

1. Check network connectivity
2. Verify SimilarWeb API status
3. Check Redis latency: `redis-cli --latency`
4. Review rate limit settings

---

## Best Practices

### 1. Use Date Ranges Wisely

```typescript
// GOOD: Last month only (small dataset)
const dateRange = {
  start: '2025-12',
  end: '2025-12'
};

// AVOID: Multi-year ranges (large dataset, slow response)
const dateRange = {
  start: '2023-01',
  end: '2025-12'
};
```

### 2. Leverage Caching

```typescript
// GOOD: Use cache for historical data
const traffic = await client.getTrafficData('costco.com', {
  start: '2025-06',
  end: '2025-11'
});

// Cache hit likely on second call
const trafficAgain = await client.getTrafficData('costco.com', {
  start: '2025-06',
  end: '2025-11'
});
```

### 3. Handle Errors Gracefully

```typescript
async function getTrafficSafely(domain: string) {
  try {
    return await client.getTrafficData(domain, dateRange);
  } catch (error) {
    logger.error(`Failed to fetch traffic for ${domain}`, error);
    return null; // Return null instead of throwing
  }
}
```

### 4. Monitor Costs

```typescript
const allData = await client.fetchAllData('costco.com', dateRange);

await logCost({
  service: 'similarweb',
  domain: 'costco.com',
  cost: allData.meta.estimatedCost,
  cacheHitRate: allData.meta.cacheHits / allData.meta.totalEndpoints
});
```

---

## API Reference

### Class: `SimilarWebClient`

**Constructor**:

```typescript
new SimilarWebClient()
```

**Methods**:

| Method | Returns | Description |
|--------|---------|-------------|
| `getTrafficData(domain, dateRange)` | `Promise<APIResponse<TrafficData>>` | Monthly visits |
| `getEngagementMetrics(domain, dateRange)` | `Promise<APIResponse<EngagementData>>` | Bounce rate, pages/visit, duration |
| `getTrafficSources(domain, dateRange)` | `Promise<APIResponse<TrafficSourceData>>` | Channel breakdown |
| `getGeography(domain, dateRange)` | `Promise<APIResponse<GeographyData>>` | Traffic by country |
| `getDemographics(domain)` | `Promise<APIResponse<DemographicsData>>` | Age and gender |
| `getTopKeywords(domain, limit?)` | `Promise<APIResponse<KeywordData>>` | Top keywords |
| `getSimilarSites(domain, limit?)` | `Promise<APIResponse<CompetitorData>>` | Competitors |
| `getAudienceInterests(domain)` | `Promise<APIResponse<InterestData>>` | Interest categories |
| `getTechnologies(domain)` | `Promise<APIResponse<TechnologyData>>` | Tech stack |
| `getReferrals(domain, limit?)` | `Promise<APIResponse<ReferralData>>` | Referring domains |
| `getPopularPages(domain, limit?)` | `Promise<APIResponse<PopularPagesData>>` | Top pages |
| `getLeadingFolders(domain, limit?)` | `Promise<APIResponse<LeadingFoldersData>>` | Top folders |
| `getLandingPages(domain, limit?)` | `Promise<APIResponse<LandingPagesData>>` | SEO landing pages |
| `getKeywordCompetitors(domain, limit?)` | `Promise<APIResponse<KeywordCompetitorsData>>` | Keyword overlap |
| `getWebsiteRank(domain)` | `Promise<APIResponse<WebsiteRankData>>` | Global rank |
| `fetchAllData(domain, dateRange)` | `Promise<BatchResponse>` | All 14 endpoints |

---

## Support

**Documentation**: `/backend/services/SIMILARWEB_USAGE.md`
**Tests**: `/backend/services/__tests__/similarweb.test.ts`
**Source Code**: `/backend/services/similarweb.ts`

---

**Last Updated**: March 7, 2026
**Maintainer**: Dashboard Builder Team
