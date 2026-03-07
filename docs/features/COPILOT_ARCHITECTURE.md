# AI Copilot Architecture - Algolia Arian

**Purpose**: Contextual AI assistant embedded throughout the platform for self-service onboarding
**Status**: ✅ Architecture Approved - Ready for Implementation
**Last Updated**: March 6, 2026, 8:45 PM

---

## 🎯 Core Principle

**The Copilot is NOT a chatbot bolt-on. It's an organic UX component deeply integrated into the platform.**

### What This Means

❌ **NOT**:
- Separate chat widget in bottom-right corner
- Generic Q&A that works the same everywhere
- Replacement for good UI design
- Standalone feature that can be disabled

✅ **IS**:
- Contextual assistant that knows where you are and what you're looking at
- Embedded help triggers throughout the interface
- Proactive insights ("I noticed 3 of your targets use the same CMS...")
- Self-service onboarding system (no training calls needed)
- Grows smarter as the system grows

---

## 🧠 Design Philosophy

### 1. Context-Aware by Default

**Every chat interaction knows**:
- What page you're on (`dashboard`, `company-details`, `audit-details`)
- What company you're viewing (if any)
- What audit you're viewing (if any)
- What tab you're on (`overview`, `research`, `tests`, `deliverables`)
- What filters you've applied
- Your recent actions (last 5 clicks)

**Example**:
```
User is on: /companies/costco.com/audit/aud_123/tests
Context: {
  page: 'audit-details',
  companyId: 'comp_456',
  companyName: 'Costco',
  auditId: 'aud_123',
  tab: 'tests'
}

User types: "Why did this test fail?"
Copilot knows: "this test" = the currently viewed test in aud_123
```

---

### 2. Tool-First Architecture (No Hallucination)

**CRITICAL**: Copilot MUST call database tools before answering data questions.

**Workflow**:
```
User: "What's Costco's ICP score?"
  ↓
Anthropic Agent SDK
  ↓
Tool: getCompany('costco.com')
  ↓
Database: { domain: 'costco.com', icp_score: 85, status: 'hot' }
  ↓
Response: "Costco has an ICP score of 85 (Hot status). [View Company →]"
```

**Forbidden**:
```
User: "What's Costco's ICP score?"
  ↓
Response: "Costco's ICP score is approximately 80-90..."  ❌ HALLUCINATION
```

---

### 3. Actionable Responses with Navigation

**Every response includes navigation buttons when relevant**:

```markdown
Costco scored 4.4/10 on search experience. Main gaps:
• **No NLP** - Complex queries return irrelevant results
• **Zero recommendations** - No "You might also like"
• **Poor typo handling** - Misspellings return no results

[View Full Scorecard →] [View Findings →]
```

**Frontend renders**:
```tsx
<div className="copilot-response">
  <p>Costco scored 4.4/10 on search experience...</p>
  <div className="actions">
    <button onClick={() => navigate('/audits/aud_123/scorecard')}>
      View Full Scorecard →
    </button>
    <button onClick={() => navigate('/audits/aud_123/findings')}>
      View Findings →
    </button>
  </div>
</div>
```

---

## 🎨 UX Integration Points

### 1. Floating Chat Button (Always Available)

**Location**: Bottom-right corner (but context-aware)

```tsx
// frontend/components/Copilot/FloatingButton.tsx
<button
  className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg"
  onClick={() => openCopilot()}
>
  <SparklesIcon /> Ask Copilot
</button>
```

**Behavior**:
- Opens chat panel when clicked
- Badge shows unread proactive insights
- Pulses when copilot has a suggestion

---

### 2. Inline Help Triggers (Contextual)

**Example**: Company Details Page

```tsx
// frontend/pages/CompanyDetails.tsx
<div className="section">
  <h3>
    ICP Score: {company.icpScore}
    <CopilotTrigger
      query="What is ICP score and how is it calculated?"
      icon="help"
    />
  </h3>

  <p>Status: {company.status}</p>
</div>
```

**Clicking the help icon**:
1. Opens copilot panel
2. Pre-fills the question
3. Gets instant answer from RAG (documentation)

---

### 3. Empty State Helpers

**Example**: No audits yet

```tsx
// frontend/components/EmptyState.tsx
<div className="empty-state">
  <h3>No audits yet</h3>
  <p>Get started by running your first search audit</p>

  <CopilotPrompt
    suggestions={[
      "How do I run my first audit?",
      "What data will I get?",
      "How long does an audit take?"
    ]}
  />
</div>
```

Clicking a suggestion opens copilot with that question pre-filled.

---

### 4. Proactive Insights (Notification-Style)

**Example**: After user filters to "Hot" companies

```tsx
// Copilot detects pattern and sends notification
<CopilotInsight
  type="info"
  message="I noticed 12 of your Hot leads use Adobe AEM. Want to see the full list?"
  actions={[
    { label: "Show List", action: () => applyFilter('technology', 'Adobe AEM') },
    { label: "Dismiss", action: () => dismiss() }
  ]}
/>
```

---

### 5. In-Page Quick Actions

**Example**: Audit Details page has a "Quick Actions" section

```tsx
<div className="quick-actions">
  <h4>Quick Actions</h4>
  <button onClick={() => askCopilot("Summarize this audit")}>
    ✨ Summarize Audit
  </button>
  <button onClick={() => askCopilot("Compare to competitors")}>
    ✨ Compare to Competitors
  </button>
  <button onClick={() => askCopilot("Export findings to PDF")}>
    ✨ Export to PDF
  </button>
</div>
```

---

## 🔧 Technical Architecture

### Backend Components

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - Floating chat button                                  │
│  - Inline help triggers                                  │
│  - Proactive insight notifications                       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ HTTP POST /api/copilot/chat
                  ↓
┌─────────────────────────────────────────────────────────┐
│              Backend (Express + TypeScript)              │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │         CopilotService                      │        │
│  │  - Anthropic Agent SDK integration          │        │
│  │  - Message routing                          │        │
│  │  - Response formatting                      │        │
│  └────────┬──────────────┬─────────────────────┘        │
│           │              │                               │
│           ↓              ↓                               │
│  ┌────────────┐   ┌─────────────┐                       │
│  │ CopilotRAG │   │ CopilotTools│                       │
│  │ (pgvector) │   │ (MCP Tools) │                       │
│  └────────────┘   └──────┬──────┘                       │
│                          │                               │
│                          ↓                               │
│                   ┌─────────────┐                        │
│                   │  Supabase   │                        │
│                   │ (PostgreSQL)│                        │
│                   └─────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

---

### Data Flow

**1. User asks a question**

```
Frontend: "What's Costco's revenue?"
  ↓
POST /api/copilot/chat {
  userId: 'user_123',
  message: "What's Costco's revenue?",
  conversationHistory: [...],
  userContext: {
    page: 'company-details',
    companyId: 'comp_456',
    companyName: 'Costco'
  }
}
```

**2. Backend processes**

```typescript
// services/copilot.ts
async chat(userId, message, history, context) {
  // 1. Get page context (what user is looking at)
  const pageContext = context || await this.contextService.getContext(userId);

  // 2. Get relevant docs (RAG)
  const docContext = await this.ragService.search(message);

  // 3. Build system prompt with context
  const systemPrompt = this.buildSystemPrompt(pageContext, docContext);

  // 4. Call Anthropic Agent SDK
  const response = await this.anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    system: systemPrompt,
    messages: [...history, { role: 'user', content: message }],
    tools: this.tools.getToolDefinitions()
  });

  // 5. If tool use, execute database queries
  if (response.stop_reason === 'tool_use') {
    const toolResults = await this.executeTools(response);

    // 6. Continue conversation with tool results
    const finalResponse = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ]
    });

    return this.formatResponse(finalResponse);
  }

  return this.formatResponse(response);
}
```

**3. Tool execution**

```typescript
// services/copilot-tools.ts
async executeTool(toolName, input) {
  switch (toolName) {
    case 'getCompany':
      return await supabase
        .from('companies')
        .select('*')
        .eq('domain', input.domain)
        .single();

    case 'getFinancials':
      return await supabase
        .from('company_financials')
        .select('*')
        .eq('company_id', input.companyId)
        .order('fiscal_year', { ascending: false })
        .limit(3);
  }
}
```

**4. Response with citations**

```json
{
  "message": "According to Yahoo Finance data from Q4 2025, Costco's annual revenue is **$242.3B**, up 6.7% YoY. [View Financials →]",
  "actions": [
    {
      "type": "button",
      "label": "View Financials",
      "action": "navigate",
      "data": "/companies/comp_456/financials"
    }
  ],
  "citations": [
    "https://finance.yahoo.com/quote/COST/financials"
  ]
}
```

---

## 🛡️ Anti-Hallucination Safeguards

### 1. Tool-First Enforcement

**System prompt explicitly requires**:
```
If the user asks a data question ("What is X?", "Show me Y"), you MUST:
1. Call the appropriate tool (getCompany, getAudit, searchCompanies)
2. Wait for the tool result
3. Answer ONLY based on the tool result
4. Cite the source (Company ID, Audit ID, Date)

If the tool returns null/empty, respond: "I don't have that information in the database."
NEVER fill in missing data with general knowledge or estimates.
```

### 2. Structured Output Validation

**Every tool response includes**:
- `source`: Where data came from (table name, audit ID)
- `timestamp`: When data was collected
- `confidence`: Data freshness indicator

### 3. Response Post-Processing

```typescript
formatResponse(response, context) {
  const message = response.content[0].text;

  // Check for hallucination indicators
  const redFlags = [
    'approximately',
    'around',
    'estimated',
    'I believe',
    'probably',
    'likely'
  ];

  for (const flag of redFlags) {
    if (message.toLowerCase().includes(flag)) {
      logger.warn('Potential hallucination detected', { message, flag });
    }
  }

  return { message, ... };
}
```

### 4. Citation Requirement

**Every data point must be cited**:
```
✅ GOOD: "Costco uses Elastic Enterprise Search (Source: BuiltWith audit from March 1, 2026)"
❌ BAD:  "Costco uses Elastic Enterprise Search"
```

---

## 📊 RAG System (Documentation Q&A)

### Document Indexing

**What gets indexed**:
1. Product documentation (What is ICP score? How to run an audit?)
2. Data source definitions (What is SimilarWeb? What is BuiltWith?)
3. Metric explanations (How is search score calculated?)
4. Common workflows (How do I export an audit?)

**Indexing process**:
```typescript
// services/copilot-rag.ts
async indexDocument(id, content, metadata) {
  // 1. Generate embedding
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content
  });

  // 2. Store in pgvector
  await supabase
    .from('copilot_documents')
    .insert({
      id,
      content,
      metadata,
      embedding: embedding.data[0].embedding
    });
}
```

### Search Process

```typescript
async search(query) {
  // 1. Embed query
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });

  // 2. Vector search
  const { data } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding.data[0].embedding,
    match_threshold: 0.78,
    match_count: 3
  });

  // 3. Return concatenated results
  return data.map(d => d.content).join('\n\n');
}
```

---

## 🎭 User Experience Flows

### Flow 1: First-Time User Onboarding

**Goal**: User runs their first audit without any training

```
User lands on Dashboard
  ↓
Copilot proactively appears: "👋 Welcome! I'm your Algolia Arian assistant. Want me to show you around?"
  ↓
User clicks "Yes, show me around"
  ↓
Copilot: "Let's start by running your first search audit. Click the '+ New Audit' button in the top right."
  ↓
User clicks button, enters domain
  ↓
Copilot: "Great! This audit will analyze Costco's search experience across 20 tests. It takes about 35 minutes. You'll get an email when it's done, or you can watch it live. [Watch Live] [Come Back Later]"
  ↓
User clicks "Watch Live"
  ↓
Copilot: "You're now in the Live Monitor view. The top section shows the current test, and the bottom shows progress. I'll notify you when I find something interesting!"
```

**Result**: User successfully runs their first audit without reading docs or attending training

---

### Flow 2: Data Exploration

**Goal**: User wants to understand a specific data point

```
User views Company Details page for Costco
  ↓
Sees "ICP Score: 85"
  ↓
Clicks help icon next to ICP Score
  ↓
Copilot opens with pre-filled question: "What is ICP score and how is it calculated?"
  ↓
Copilot (via RAG): "ICP (Ideal Customer Profile) score measures how well a company matches your ideal target. It's calculated from 4 factors:
• Fit Score (40%): Tech stack + industry + size
• Intent Score (30%): Hiring signals + growth trends
• Value Score (20%): Revenue + traffic volume
• Displacement Score (10%): Current search provider

Costco's score of 85 (Hot status) means they're a high-priority target. [View Score Breakdown →]"
```

**Result**: User understands the metric without leaving the page

---

### Flow 3: Proactive Insights

**Goal**: Copilot surfaces a pattern the user hasn't noticed

```
User filters companies to "Hot" status (ICP ≥ 80)
  ↓
Copilot detects pattern in background
  ↓
Copilot notification appears: "💡 I noticed something interesting: 12 of your 47 Hot leads use Adobe AEM. This could be a good displacement opportunity. [Show List] [Learn More]"
  ↓
User clicks "Show List"
  ↓
UI filters to: status=hot AND technology=Adobe AEM
  ↓
Copilot: "Here are the 12 companies. The top 3 by traffic are Hallmark, Herman Miller, and AutoZone. Want me to compare their current search providers? [Compare Providers]"
```

**Result**: Copilot proactively helps user discover insights

---

## 🔐 Security & Privacy

### 1. Data Isolation

**Copilot can ONLY access**:
- Companies in the user's organization
- Audits created by the user's team
- Public documentation

**Copilot CANNOT access**:
- Other organizations' data
- User credentials
- API keys
- Internal system logs

### 2. Rate Limiting

**Per user limits**:
- 20 messages per day (free tier)
- 100 messages per day (pro tier)
- 500 messages per day (enterprise tier)

**Per organization limits**:
- 1000 messages per day (free tier)
- 10,000 messages per day (pro tier)
- Unlimited (enterprise tier with custom pricing)

### 3. Audit Logging

**Every copilot interaction is logged**:
```typescript
{
  userId: 'user_123',
  timestamp: '2026-03-06T20:00:00Z',
  query: "What's Costco's revenue?",
  response: "According to Yahoo Finance...",
  toolsCalled: ['getCompany', 'getFinancials'],
  tokenCount: 450,
  cost: 0.009 // $0.009
}
```

---

## 📈 Success Metrics

### Product Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Copilot Engagement** | 60% of users use copilot within first session | % users with ≥1 chat message in first 24 hours |
| **Onboarding Time** | 50% reduction in time-to-first-audit | Median time from signup to first audit completion |
| **Support Ticket Reduction** | 40% fewer "how to" tickets | Count of support tickets tagged "how-to" or "onboarding" |
| **Feature Discovery** | 80% of users discover 5+ features via copilot | Count of unique features accessed via copilot navigation |

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Response Latency** | <2 seconds (p95) | Time from user message to copilot response |
| **Tool Accuracy** | 95% correct tool selection | % of queries where correct tool was called |
| **Hallucination Rate** | <1% | % of responses flagged for potential hallucination |
| **Cache Hit Rate** | 40% | % of queries answered from cache vs new API call |

---

## 🚀 Implementation Phases

### Phase 1 (Week 1): Foundation
✅ Anthropic Agent SDK integration
✅ MCP tools for database queries
✅ Context tracking middleware
✅ Basic chat endpoint

### Phase 2 (Week 2): RAG System
- Document indexing (pgvector)
- Embedding generation (OpenAI)
- Semantic search
- Documentation Q&A

### Phase 3 (Week 3): Frontend Integration
- Floating chat button
- Inline help triggers
- Empty state helpers
- Navigation button rendering

### Phase 4 (Week 4): Proactive Insights
- Pattern detection algorithms
- Notification system
- Background analysis workers
- Insight ranking

### Phase 5 (Week 5): Polish
- Rate limiting
- Cost tracking
- Analytics dashboard
- A/B testing framework

---

## 💡 Example Conversations

### Example 1: Onboarding

```
User: "How do I get started?"

Copilot: "Let's run your first search audit! Here's how:

1. Click '+ New Audit' in the top right
2. Enter a company domain (e.g., costco.com)
3. Choose 'Full Audit' (recommended for first time)
4. Click 'Launch'

The audit takes ~35 minutes. You'll get an email when it's done.

[Start My First Audit]"
```

### Example 2: Data Question

```
User: "What's AutoZone's search score?"

Copilot: [Calls getCompany('autozone.com') tool]
         [Calls getLatestAudit(comp_789) tool]

"AutoZone scored **3.2/10** on search experience (audit from Feb 20, 2026). Key issues:

• No federated search (returns 0 results for 'return policy')
• Weak synonyms (headlamp≠headlight: 23 vs 538 results)
• Typos bypass redirects

[View Full Report →] [Compare to Competitors →]"
```

### Example 3: Workflow Assistance

```
User: "How do I export this audit to PDF?"

Copilot: [Checks current context: user is on audit-details page]

"You're viewing Costco's audit (aud_123). To export to PDF:

1. Click the 'Deliverables' tab
2. Find 'Search Audit Report'
3. Click 'Download PDF'

The PDF includes all findings, screenshots, and recommendations.

[Go to Deliverables Tab]"
```

### Example 4: Proactive Insight

```
User: [Filters to companies with declining traffic]

Copilot: [Detects pattern in background]

"💡 I noticed 8 of these 15 companies have high ICP scores despite declining traffic. This often indicates internal challenges—perfect timing for a search improvement conversation.

The top 3 are Macy's, Kohl's, and JCPenney (all retail).

[View List] [Learn More About Trigger Events]"
```

---

## 🎯 Key Takeaways

1. **Copilot is NOT a chatbot** - It's an organic UX component deeply integrated throughout the platform

2. **Context is everything** - Every interaction knows what page you're on, what company you're viewing, and what you're trying to do

3. **Tool-first architecture** - ALWAYS call database tools before answering data questions (never hallucinate)

4. **Actionable responses** - Every response includes navigation buttons to take action

5. **Proactive insights** - Copilot doesn't just answer questions; it surfaces patterns and opportunities

6. **Self-service onboarding** - Users should NEVER need training calls or documentation to use the platform

---

**Status**: ✅ Architecture Approved
**Next Step**: Implement Phase 1 (Week 1) - Backend foundation
**Owner**: Backend Team (Agent 5)
**Last Updated**: March 6, 2026, 8:45 PM
