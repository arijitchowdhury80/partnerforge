# Phase 1E Testing Guide - AI Copilot

**Quick Start**: How to test the AI Copilot functionality

---

## 🚀 Setup Steps

### 1. Install Dependencies
```bash
cd backend
npm install
```

**New dependencies installed**:
- `@anthropic-ai/sdk` - Anthropic Claude integration
- `@supabase/pgvector-js` - Vector database for RAG
- `openai` - OpenAI embeddings

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

**Required for Phase 1E**:
```bash
# AI Copilot
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
COPILOT_MODEL=claude-sonnet-4-5-20250929
COPILOT_MAX_TOKENS=2048

# RAG System (for documentation search)
OPENAI_API_KEY=sk-your-actual-openai-key-here
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_MATCH_THRESHOLD=0.78
RAG_MATCH_COUNT=3

# Database (must already be configured)
SUPABASE_URL=https://xbitqeejsgqnwvxlnjra.supabase.co
SUPABASE_KEY=your_supabase_key

# Redis (must already be configured)
REDIS_URL=redis://localhost:6379
```

### 3. Mount Routes in server.ts

Add to your `server.ts`:

```typescript
import { createCopilotRoutes } from './api/copilot/chat';
import { copilotContextMiddleware } from './middleware/copilot-context';

// Use context tracking middleware (optional, but recommended)
app.use(copilotContextMiddleware);

// Mount copilot routes
app.use('/api/copilot', createCopilotRoutes());
```

### 4. Start Server
```bash
npm run dev
```

Server should start on `http://localhost:3001`

---

## 🧪 Test Endpoints

### Test 1: Basic Chat (No Database)

**Request**:
```bash
curl -X POST http://localhost:3001/api/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "message": "Hello! What can you help me with?",
    "conversationHistory": []
  }'
```

**Expected Response**:
```json
{
  "message": "I'm the Algolia Arian Copilot. I can help you with:\n- Searching companies by technology, ICP score, or status\n- Getting company details and tech stacks\n- Viewing audit results and findings\n- Understanding metrics and scores",
  "actions": []
}
```

---

### Test 2: Company Query (Database Tool)

**Request**:
```bash
curl -X POST http://localhost:3001/api/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "message": "What companies use Adobe AEM?",
    "conversationHistory": [],
    "userContext": {
      "page": "dashboard"
    }
  }'
```

**Expected Behavior**:
1. Copilot calls `searchCompanies` tool with filter `technology: "Adobe AEM"`
2. Tool queries database
3. Response includes list of companies with navigation buttons

**Expected Response**:
```json
{
  "message": "I found 47 companies using Adobe AEM...\n[View All Companies →]",
  "actions": [
    {
      "type": "button",
      "label": "View All Companies",
      "action": "navigate",
      "data": "/companies?tech=Adobe+AEM"
    }
  ]
}
```

---

### Test 3: Company Details Query

**Request**:
```bash
curl -X POST http://localhost:3001/api/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "message": "What is Costco'\''s ICP score?",
    "conversationHistory": [],
    "userContext": {
      "page": "dashboard"
    }
  }'
```

**Expected Behavior**:
1. Copilot calls `getCompany('costco.com')` tool
2. Tool queries companies table
3. Response includes ICP score with source citation

---

### Test 4: Context Management

**Get Context**:
```bash
curl http://localhost:3001/api/copilot/context/test_user_123
```

**Update Context**:
```bash
curl -X POST http://localhost:3001/api/copilot/context \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "context": {
      "page": "company-details",
      "companyId": "comp_456",
      "companyName": "Costco"
    }
  }'
```

**Clear Context**:
```bash
curl -X DELETE http://localhost:3001/api/copilot/context/test_user_123
```

---

## 🔍 Verify Tool Execution

### Check Logs
Look for log entries showing tool execution:

```
[INFO] Copilot chat request { userId: 'test_user_123', message: 'What companies...' }
[INFO] Executing copilot tool { toolName: 'searchCompanies', input: {...} }
```

### Redis Inspection
Check if context is being saved:

```bash
redis-cli
> KEYS copilot:context:*
> GET copilot:context:test_user_123
```

---

## 🛠️ Troubleshooting

### Issue: "ANTHROPIC_API_KEY is required"
**Solution**: Add your Anthropic API key to `.env`

### Issue: "Failed to get company"
**Possible Causes**:
1. Database not connected (check SUPABASE_URL and SUPABASE_KEY)
2. Company doesn't exist in database
3. Database table schema mismatch

**Debug**:
```bash
# Check database connection
curl http://localhost:3001/health
```

### Issue: "Redis connection failed"
**Solution**: Start Redis locally:
```bash
redis-server
```

Or use remote Redis:
```bash
REDIS_URL=redis://your-redis-host:6379
```

### Issue: Tool not being called
**Check**:
1. Is the question a data question? (e.g., "What is X?")
2. Check logs for tool execution
3. Verify tool definitions in response

**Debug Tool Definitions**:
```typescript
// Add to copilot.ts for debugging
console.log('Available tools:', this.tools.getToolDefinitions());
```

---

## 📊 Expected Performance

| Metric | Target | Notes |
|--------|--------|-------|
| **Response Time** | <2s | Without caching |
| **Response Time (cached)** | <500ms | With Redis context cache |
| **Tool Execution** | <1s | Database queries |
| **Token Usage** | ~500-1500 tokens/request | Depends on context |
| **Cost per Query** | ~$0.01-0.03 | At Claude Sonnet 4.5 pricing |

---

## 🧪 Manual Test Scenarios

### Scenario 1: Onboarding Flow
1. User: "How do I get started?"
2. Expected: Copilot explains the platform
3. User: "Show me hot leads"
4. Expected: Copilot calls searchCompanies with status=hot filter

### Scenario 2: Company Deep Dive
1. User: "Tell me about Costco"
2. Expected: Copilot calls getCompany('costco.com')
3. User: "What's their tech stack?"
4. Expected: Copilot calls getTechnologies(companyId)
5. User: "Show me their audit"
6. Expected: Copilot calls getLatestAudit(companyId)

### Scenario 3: Search Query
1. User: "Find companies using Elastic"
2. Expected: searchCompanies tool with technology filter
3. User: "Filter to only hot leads"
4. Expected: searchCompanies with technology + status filters

---

## 🔬 Advanced Testing

### Test Navigation Button Parsing
```typescript
// Test message with markdown buttons
const message = `
Here are the results [View All →]
You can also [Compare Competitors →]
`;

// Expected actions array:
[
  { type: 'button', label: 'View All', action: 'navigate', data: '...' },
  { type: 'button', label: 'Compare Competitors', action: 'navigate', data: '...' }
]
```

### Test Context Inference
```typescript
// When user is on /api/companies/comp_456
// Context should include:
{
  page: 'company-details',
  companyId: 'comp_456'
}

// When user asks: "Show me the tech stack"
// Navigation should infer: /companies/comp_456/tech-stack
```

---

## 📝 Next Steps

Once basic tests pass:

1. **Frontend Integration**: Build React chat component
2. **Streaming**: Add Server-Sent Events for streaming responses
3. **RAG Setup**: Create pgvector tables and index documentation
4. **Rate Limiting**: Add per-user rate limits (20 messages/day)
5. **Analytics**: Track copilot usage and effectiveness

---

## 🎯 Success Criteria

✅ **Phase 1E is complete when**:
- [ ] Chat endpoint returns responses
- [ ] Tool execution works (database queries)
- [ ] Context tracking works (Redis)
- [ ] Navigation buttons are extracted
- [ ] Error handling is graceful
- [ ] Logs show tool execution

---

**Status**: Ready for testing
**Dependencies**: ANTHROPIC_API_KEY, SUPABASE credentials, Redis
**Next**: Frontend integration (Week 3)
