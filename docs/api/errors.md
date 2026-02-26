# Error Handling

This document describes error responses, status codes, and how to handle errors when using the Supabase REST API for PartnerForge.

---

## Architecture Note

With the migration from Railway to Supabase, error handling now follows the **PostgREST** error format used by Supabase's auto-generated REST API.

---

## Error Response Format

Supabase REST API errors follow this structure:

```json
{
  "code": "PGRST116",
  "details": null,
  "hint": null,
  "message": "The result contains 0 rows"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | PostgREST error code |
| `details` | string/null | Additional details |
| `hint` | string/null | Suggestion for fixing |
| `message` | string | Human-readable error message |

---

## HTTP Status Codes

### Success Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 204 | No Content | Success with no response body |
| 207 | Multi-Status | Partial success (batch operations) |

### Client Error Codes

| Code | Name | Description |
|------|------|-------------|
| 400 | Bad Request | Invalid parameters or request body |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |

### Server Error Codes

| Code | Name | Description |
|------|------|-------------|
| 500 | Internal Server Error | Unexpected server error |
| 502 | Bad Gateway | Upstream service error |
| 503 | Service Unavailable | Service temporarily unavailable |
| 504 | Gateway Timeout | Upstream service timeout |

---

## Common Error Scenarios

### 400 Bad Request

Invalid query parameters or request body.

```json
{
  "success": false,
  "error": "Bad Request",
  "detail": "Invalid value for 'min_score': must be 0-100",
  "status_code": 400
}
```

**Common Causes:**
- Invalid query parameter value
- Missing required field
- Malformed JSON body
- Invalid domain format

**Example:**
```bash
# Invalid operator syntax
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?icp_score=invalid.80" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

---

### 401 Unauthorized

Missing or invalid API key.

```json
{
  "code": "401",
  "message": "Invalid API key"
}
```

**Solution:**
```bash
# Add apikey header
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

---

### 403 Forbidden

Valid authentication but insufficient permissions.

```json
{
  "success": false,
  "error": "Forbidden",
  "detail": "You don't have permission to delete targets.",
  "status_code": 403
}
```

---

### 404 Not Found / Empty Result

With Supabase, a query that matches no rows returns an **empty array** (200 status), not a 404:

```json
[]
```

If you need single-row queries to error on no match, use the `Accept: application/vnd.pgrst.object+json` header:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?domain=eq.nonexistent.com" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Accept: application/vnd.pgrst.object+json"
```

Returns:
```json
{
  "code": "PGRST116",
  "details": null,
  "hint": null,
  "message": "The result contains 0 rows"
}
```

**Common Causes:**
- Domain not in database
- Typo in domain name
- Incorrect filter syntax

---

### 409 Conflict

Resource already exists or operation conflicts.

```json
{
  "success": false,
  "error": "Conflict",
  "detail": "An enrichment job is already running for 'costco.com'. Cancel it first or wait for completion.",
  "status_code": 409
}
```

**Solution:**
Cancel the existing job or wait for it to complete.

---

### 422 Validation Error

Request body failed validation.

```json
{
  "success": false,
  "error": "Validation Error",
  "detail": [
    {
      "loc": ["body", "domains", 0],
      "msg": "invalid domain format",
      "type": "value_error"
    }
  ],
  "status_code": 422
}
```

---

### 429 Rate Limited

Too many requests.

```json
{
  "success": false,
  "error": "Rate Limit Exceeded",
  "detail": "Rate limit exceeded. Try again in 30 seconds.",
  "status_code": 429
}
```

**Response Headers:**
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709000030
Retry-After: 30
```

**Solution:**
Wait for `Retry-After` seconds before retrying.

---

### 500 Internal Server Error

Unexpected server error.

```json
{
  "success": false,
  "error": "Internal Server Error",
  "detail": "An unexpected error occurred. Please try again later.",
  "status_code": 500,
  "request_id": "req_abc123"
}
```

**Action:**
- Report the `request_id` to support
- Retry after a short delay

---

### 502 Bad Gateway

Upstream service (BuiltWith, SimilarWeb) error.

```json
{
  "success": false,
  "error": "Bad Gateway",
  "detail": "SimilarWeb API returned an error: 502 Bad Gateway",
  "status_code": 502
}
```

---

### 503 Service Unavailable

Service is temporarily unavailable (often during deploys).

```json
{
  "success": false,
  "error": "Service Unavailable",
  "detail": "Database connection failed",
  "status_code": 503
}
```

**Action:**
Retry after 10-30 seconds.

---

## Enrichment-Specific Errors

### 207 Partial Success

Some enrichment modules succeeded, others failed.

```json
{
  "success": false,
  "message": "Enrichment partially completed",
  "errors": [
    "BuiltWith API: Credit limit exceeded",
    "SimilarWeb API: Access denied for domain"
  ],
  "result": {
    "domain": "example.com",
    "status": "partial",
    "builtwith": null,
    "similarweb": null,
    "yahoo_finance": {
      "ticker": "EXMP",
      "revenue": 1000000000
    }
  },
  "status_code": 207
}
```

---

### Job Already Running

```json
{
  "success": false,
  "error": "Conflict",
  "detail": "Enrichment job 'enrich_costco_com_...' is already running (45% complete)",
  "status_code": 409,
  "existing_job": {
    "job_id": "enrich_costco_com_20260226103500_abc12345",
    "status": "running",
    "progress_percent": 45
  }
}
```

---

### API Key Missing

```json
{
  "success": false,
  "error": "Configuration Error",
  "detail": "BuiltWith API key not configured. Set BUILTWITH_API_KEY environment variable.",
  "status_code": 500
}
```

---

## Error Handling Best Practices

### 1. Always Check Status Code

```python
import requests

response = requests.get(f"{BASE_URL}/targets/{domain}")

if response.status_code == 200:
    target = response.json()
elif response.status_code == 404:
    print(f"Target {domain} not found")
elif response.status_code == 429:
    retry_after = int(response.headers.get("Retry-After", 30))
    time.sleep(retry_after)
    # Retry request
else:
    error = response.json()
    print(f"Error: {error['error']} - {error['detail']}")
```

### 2. Implement Exponential Backoff

```python
import time
import random

def fetch_with_retry(url, max_retries=3):
    for attempt in range(max_retries):
        response = requests.get(url)

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 30))
            time.sleep(retry_after)
        elif response.status_code >= 500:
            # Exponential backoff with jitter
            delay = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)
        else:
            # Client error - don't retry
            raise Exception(f"Client error: {response.status_code}")

    raise Exception("Max retries exceeded")
```

### 3. Handle Partial Success

```python
response = requests.post(f"{BASE_URL}/enrich/batch", json={
    "domains": ["costco.com", "walmart.com", "target.com"]
})

if response.status_code == 207:
    result = response.json()
    print(f"Partial success: {result['message']}")
    for error in result.get('errors', []):
        print(f"  - {error}")
```

### 4. Log Request IDs

```python
response = requests.get(url)

if response.status_code >= 500:
    error = response.json()
    request_id = error.get('request_id', 'unknown')
    logging.error(f"Server error: {error['detail']} (request_id: {request_id})")
```

---

## Debugging Tips

### 1. Check Supabase Status

Visit [status.supabase.com](https://status.supabase.com) to check if Supabase is operational.

### 2. Verify API Key

Ensure the `apikey` header is included:

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=*&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg"
```

### 3. Verify Domain Format

Domains should be stored in lowercase without protocol:
- Correct: `costco.com`
- Incorrect: `https://costco.com`, `COSTCO.COM`

### 4. Check Filter Syntax

Supabase uses PostgREST operators. Common mistakes:
- Wrong: `?icp_score>=80`
- Right: `?icp_score=gte.80`

### 5. Test Simple Query First

```bash
curl "https://xbitqeejsgqnwvxlnjra.supabase.co/rest/v1/displacement_targets?select=domain,icp_score&limit=5" \
  -H "apikey: YOUR_ANON_KEY"
```

---

## Contact Support

For persistent errors:
- Email: arijit.chowdhury@algolia.com
- Include: `request_id`, timestamp, endpoint, request body
- GitHub: https://github.com/arijitchowdhury80/partnerforge/issues
