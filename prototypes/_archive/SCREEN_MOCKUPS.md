# Algolia Search Audit Platform - Screen Mockups & UX Flows

**Document Version**: 1.0
**Date**: 2026-03-02
**Purpose**: Visual supplement to SAAS_ARCHITECTURE.md with detailed screen mockups

---

## Table of Contents
1. [Navigation & Layout](#navigation--layout)
2. [User Flows](#user-flows)
3. [Component Library](#component-library)
4. [Responsive Design](#responsive-design)
5. [Interaction Patterns](#interaction-patterns)

---

## Navigation & Layout

### Global Navigation (Top Bar)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Algolia Search Audit Platform            [Search: _______] 🔍│
│                                                                   │
│ [Dashboard] [My Audits] [Templates] [Docs]                       │
│                                                                   │
│                                    [+ New Audit]  [Admin]  [JK ▼]│
└─────────────────────────────────────────────────────────────────┘
                                                     ↑ User dropdown
                                                     Profile, Settings, Logout
```

### Dashboard Layout (3-Column)

```
┌─────────────────────────────────────────────────────────────────┐
│                         HEADER (fixed)                           │
├────────┬────────────────────────────────────────────────┬───────┤
│        │                                                 │       │
│ SIDE   │            MAIN CONTENT AREA                    │ RIGHT │
│ NAV    │                                                 │ PANEL │
│ (200px)│            (responsive)                         │(280px)│
│        │                                                 │       │
│ • Home │  ┌─────────────────────────────────────────┐  │ Quick │
│ • Mine │  │                                          │  │ Stats │
│ • Team │  │         Audit Cards Grid                 │  │       │
│ • All  │  │                                          │  │ MCP   │
│ • Star │  │                                          │  │ Health│
│        │  └─────────────────────────────────────────┘  │       │
│        │                                                 │ Recent│
│ Filters│  [Load More]                                   │ Users │
│ ───────│                                                 │       │
│ Status │                                                 │       │
│ ☐ Run  │                                                 │       │
│ ☐ Done │                                                 │       │
│ ☐ Fail │                                                 │       │
│        │                                                 │       │
│ Team   │                                                 │       │
│ ☐ Sales│                                                 │       │
│ ☐ Mktg │                                                 │       │
│        │                                                 │       │
└────────┴────────────────────────────────────────────────┴───────┘
```

---

## User Flows

### Flow 1: Create & Monitor Audit (Happy Path)

```
Step 1: Dashboard → Click [+ New Audit]
   ↓
Step 2: Wizard Page 1 — Enter Domain
   Input: "costco.com"
   Click: [Next: Phases →]
   ↓
Step 3: Wizard Page 2 — Select Phases
   Select: ☑ Full Audit (default)
   Click: [Next: Custom Queries →]
   ↓
Step 4: Wizard Page 3 — Queries (Optional)
   Select: ○ Auto-generate from vertical (default)
   Click: [Next: Review & Launch →]
   ↓
Step 5: Wizard Page 4 — Review
   Review: Domain, Phases, MCP Health Check ✅
   Click: [🚀 Launch Audit]
   ↓
Step 6: Redirect to Execution Monitor
   Real-time progress:
   Phase 1: ████████████████░░░░░░░░ 67% (8/12 steps)
   Live logs scrolling
   ↓
Step 7: Completion Notification
   Browser: ✅ Audit complete! [View Report]
   Email: "Your Costco audit is ready"
   Slack: "@jordan Your Costco audit scored 4.4/10"
   ↓
Step 8: View Report (Audit Details)
   Tab 1: Overview (KPIs, summary)
   Tab 2: Research Data (12 scratchpad tabs)
   Tab 3: Findings (screenshot gallery)
   Tab 4: Deliverables (PDF viewer + downloads)
   ↓
Step 9: Download PDF Book
   Click: [📥 Download] on book card
   Browser downloads: costco-search-audit-book.pdf (3.8 MB)
```

### Flow 2: Re-Run Failed Audit

```
Step 1: Dashboard → See audit with 🔴 FAILED status
   Audit card: "Boden | 🔴 FAILED | Error: MCP tools not loaded"
   ↓
Step 2: Click [View Details] OR [Retry]
   Opens Audit Details page
   ↓
Step 3: Navigate to Settings Tab
   Tab 5: Settings
   ↓
Step 4: Select Phases to Re-Run
   Re-Run Phases:
   ☑ Phase 1: Pre-Audit Research
   ☑ Phase 2: Browser Testing
   ☐ Phase 3: Scoring
   ☐ Phase 4-5: Deliverables
   ↓
Step 5: Click [🔄 Re-Run Selected Phases]
   Confirmation modal: "Re-run will overwrite existing data. Continue?"
   Click: [Confirm]
   ↓
Step 6: Redirect to Execution Monitor
   Status changes to 🟡 IN PROGRESS
   Real-time progress resumes
```

### Flow 3: Fact-Check Validation

```
Step 1: Audit Details → Settings Tab
   Scroll to "Quality Control" section
   ↓
Step 2: Click [🧪 Run Fact-Check]
   Modal: "Fact-check will validate all claims across 7 dimensions (~10 min). Continue?"
   Select tier: ○ Full  ○ Standard  ○ Quick
   Click: [Start Fact-Check]
   ↓
Step 3: New Window/Tab Opens
   Fact-Check Execution Monitor (similar to audit monitor)
   Progress: Dimension 1/7: Cross-File Consistency ████████░░░░ 67%
   ↓
Step 4: Completion
   Fact-Check Report generated:
   - Overall Score: 8.2/10 ✅ HIGH CONFIDENCE
   - 3 warnings, 0 critical errors
   - Correction Manifest: 2 fixes needed
   ↓
Step 5: Review & Apply Fixes
   [View Fact-Check Report]
   [Download Correction Manifest]
   [Apply Fixes Automatically] (future feature)
```

---

## Component Library

### 1. Audit Card (Dashboard List Item)

```
┌─────────────────────────────────────────────────────────────┐
│ Costco Wholesale                           🟢 COMPLETED     │ ← Status badge
│ Created: Feb 21, 2026 by Alex Rivera    Runtime: 34m 12s    │ ← Metadata
│ ────────────────────────────────────────────────────────────│
│ Score: 4.4/10 | 3 Critical Gaps | $15M-$30M Opportunity     │ ← Key metrics
│ ────────────────────────────────────────────────────────────│
│ 📕 47-page book | 📄 AE Brief | 📊 Signal Brief             │ ← Deliverables
│ ────────────────────────────────────────────────────────────│
│ [View Report] [Download All] [⭐ Star] [•••]                │ ← Actions
└─────────────────────────────────────────────────────────────┘
```

**Component Props**:
```typescript
interface AuditCardProps {
  audit: {
    id: string;
    company_name: string;
    domain: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    created_at: Date;
    created_by: User;
    runtime_seconds?: number;
    overall_score?: number;
    critical_gaps?: number;
    opportunity_min?: number;
    opportunity_max?: number;
    deliverables: Deliverable[];
  };
  onView: () => void;
  onDownload: () => void;
  onStar: () => void;
}
```

### 2. Progress Bar (Live Update)

```
Phase 2: Browser Testing             🔵 IN PROGRESS
████████████████████████████░░░░░░░░ 14/20 steps (70%)

Live Logs                               [Filter: ▼] [Export]
┌─────────────────────────────────────────────────────────────┐
│ 2:52 PM  [Browser] Typing query: "dynamic facets"           │
│ 2:52 PM  [Browser] Waiting for SAYT dropdown...             │
│ 2:52 PM  [Browser] Screenshot saved: 15-dynamic.png         │
│ 2:51 PM  [Chrome] ✅ Network: no Constructor API calls     │
│ 2:51 PM  [Chrome] ℹ️ Search powered by native Shopify     │
└─────────────────────────────────────────────────────────────┘
```

**Component Props**:
```typescript
interface ProgressBarProps {
  phase: string;
  currentStep: number;
  totalSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  logs: LogEntry[];
  onPause?: () => void;
  onCancel?: () => void;
}
```

### 3. Screenshot Gallery (Findings Tab)

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│[Thumbnail 1] │[Thumbnail 2] │[Thumbnail 3] │[Thumbnail 4] │
│ 01-homepage  │ 02-empty     │ 03-sayt      │ 04-results   │
│ ✅ PASS      │ ⚠️ WARNING   │ ✅ PASS      │ ✅ PASS      │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┐
│[Thumbnail 5] │[Thumbnail 6] │[Thumbnail 7] │[Thumbnail 8] │
│ 05-typo-1    │ 06-typo-2    │ 07-synonym   │ 08-no-results│
│ 🔴 CRITICAL  │ 🔴 CRITICAL  │ ✅ PASS      │ ⚠️ WARNING   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Click thumbnail** → Opens lightbox modal with:
- Full-size screenshot (1920x1080)
- Metadata panel (query, expected, found, severity, Algolia solution)
- Navigation arrows (prev/next)
- Download button

### 4. Deliverable Card (Deliverables Tab)

```
┌─────────────────────────────────────────────────────────────┐
│ 📕 Search Audit Book                                         │
│    costco-search-audit-book.pdf                              │
│    47 pages | 3.8 MB | Brand Score: 9.2/10 ✅              │
│                                                              │
│    [👁️ Preview in Browser] [📥 Download] [📧 Email]         │
└─────────────────────────────────────────────────────────────┘
```

**Component Props**:
```typescript
interface DeliverableCardProps {
  deliverable: {
    type: 'book' | 'ae_brief' | 'signal_brief';
    file_name: string;
    storage_url: string;
    file_size_bytes: number;
    page_count?: number;
    brand_score?: number;
  };
  onPreview: () => void;
  onDownload: () => void;
  onEmail: () => void;
}
```

### 5. MCP Health Widget (Admin Dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│ MCP Server Status                                            │
│                                                              │
│ BuiltWith MCP           ✅ HEALTHY    Latency: 842ms        │
│   Last call: 2m ago     Credits: 2,134 / 5,000              │
│   [View Details] [Test Connection]                          │
│                                                              │
│ SimilarWeb MCP          ✅ HEALTHY    Latency: 1.2s         │
│   Last call: 5m ago     Credits: 847 / 10,000               │
│   [View Details] [Test Connection]                          │
│                                                              │
│ Chrome MCP (Browser)    🟡 DEGRADED   Pool: 7/10            │
│   3 instances stuck on CAPTCHA                               │
│   [View Details] [Restart Pool]                              │
│                                                              │
│ Yahoo Finance MCP       ✅ HEALTHY    Latency: 340ms        │
│   Last call: 12m ago    Rate: 8/10 req/sec                  │
│   [View Details] [Test Connection]                          │
│                                                              │
│ WebSearch API           ✅ HEALTHY    Latency: 2.1s         │
│   Last call: 1m ago     Credits: 4,821 / 10,000             │
│   [View Details] [Test Connection]                          │
└─────────────────────────────────────────────────────────────┘
```

### 6. Score Gauge (Overview Tab)

```
┌──────────────────────────┐
│   Overall Score          │
│                          │
│      ┌─────────┐         │
│      │  4.4    │ ← SVG gauge with arc
│      │  / 10   │
│      └─────────┘         │
│   Below Average          │
│                          │
│ Critical Gaps:    3      │
│ Medium Gaps:      4      │
│ Low-Priority:     3      │
└──────────────────────────┘
```

**SVG Gauge Example**:
```html
<svg viewBox="0 0 200 120" class="score-gauge">
  <!-- Background arc (gray) -->
  <path d="M 30,100 A 70,70 0 0,1 170,100"
        fill="none" stroke="#e5e7eb" stroke-width="20"/>

  <!-- Score arc (colored: red/yellow/green) -->
  <path d="M 30,100 A 70,70 0 0,1 110,40"
        fill="none" stroke="#FFAB00" stroke-width="20" stroke-linecap="round"/>

  <!-- Score text -->
  <text x="100" y="80" text-anchor="middle" font-size="36" font-weight="700" fill="#21243D">
    4.4
  </text>
  <text x="100" y="105" text-anchor="middle" font-size="14" fill="#6B7280">
    / 10
  </text>
</svg>
```

**Color Logic**:
- 0-3.9: Red `#E8513D` (Critical)
- 4.0-6.9: Yellow `#FFAB00` (Needs Improvement)
- 7.0-10.0: Green `#36B37E` (Good)

---

## Responsive Design

### Mobile (320px - 768px)

**Dashboard** → Simplified list view:
```
┌──────────────────────┐
│ 🔍 Audit Platform    │
│ [☰]         [+ New]  │
├──────────────────────┤
│                      │
│ Costco Wholesale     │
│ 🟢 4.4/10            │
│ Feb 21, 2026         │
│ [View] [Download]    │
│ ──────────────────── │
│                      │
│ The RealReal         │
│ 🟡 In Progress (60%) │
│ Mar 2, 2026          │
│ [View Live]          │
│ ──────────────────── │
│                      │
│ [Load More]          │
└──────────────────────┘
```

**Execution Monitor** → Vertical stack:
```
┌──────────────────────┐
│ Costco Audit         │
│ 🟡 Phase 2           │
├──────────────────────┤
│ Overall              │
│ ████████░░░░ 72%     │
│                      │
│ Phase 1 ✅          │
│ Phase 2 🔵          │
│ Phase 3 ⏳          │
│                      │
│ Live Logs            │
│ ┌──────────────────┐ │
│ │ 2:52 PM Browser  │ │
│ │ Typing query...  │ │
│ │ 2:52 PM Screenshot│ │
│ │ saved: 15-*.png  │ │
│ └──────────────────┘ │
│                      │
│ [⏸ Pause] [❌ Cancel]│
└──────────────────────┘
```

### Tablet (768px - 1024px)

**Dashboard** → 2-column grid:
```
┌────────────────────────────────────┐
│ 🔍 Algolia Audit       [+ New Audit]│
├────────────────────────────────────┤
│ ┌───────────┐  ┌───────────┐      │
│ │ Costco    │  │ RealReal  │      │
│ │ ✅ 4.4/10 │  │ 🟡 60%    │      │
│ │ Feb 21    │  │ Mar 2     │      │
│ └───────────┘  └───────────┘      │
│                                     │
│ ┌───────────┐  ┌───────────┐      │
│ │ Boden     │  │ Lacoste   │      │
│ │ 🔴 Failed │  │ ✅ 3.8/10 │      │
│ │ Mar 1     │  │ Feb 28    │      │
│ └───────────┘  └───────────┘      │
└────────────────────────────────────┘
```

### Desktop (1024px+)

**Dashboard** → 3-column grid with sidebar:
```
┌────┬────────────────────────────────────┬───────┐
│SIDE│        AUDIT CARDS (3 cols)        │ RIGHT │
│NAV │  ┌──────┐ ┌──────┐ ┌──────┐       │ PANEL │
│    │  │Card 1│ │Card 2│ │Card 3│       │       │
│    │  └──────┘ └──────┘ └──────┘       │       │
│    │  ┌──────┐ ┌──────┐ ┌──────┐       │       │
│    │  │Card 4│ │Card 5│ │Card 6│       │       │
│    │  └──────┘ └──────┘ └──────┘       │       │
└────┴────────────────────────────────────┴───────┘
```

---

## Interaction Patterns

### 1. Real-Time Updates (WebSocket)

**Pattern**: Server → Client push updates

```typescript
// Client subscribes when mounting Execution Monitor
useEffect(() => {
  socket.emit('subscribe', { auditId });

  socket.on('audit:progress', (data) => {
    setProgress(data.progress_pct);
    setCurrentPhase(data.phase);
    addLog(data.message);
  });

  socket.on('audit:complete', (data) => {
    showNotification('Audit complete!');
    redirect(`/audits/${auditId}`);
  });

  return () => {
    socket.emit('unsubscribe', { auditId });
  };
}, [auditId]);
```

**Visual Feedback**:
- Progress bar animates smoothly (CSS transition)
- Logs auto-scroll to bottom (with pause-on-hover)
- Phase badges change color: ⏳ → 🔵 → ✅
- Success confetti animation on completion (optional)

### 2. Optimistic Updates

**Pattern**: Update UI immediately, rollback on error

```typescript
// Example: Star audit
const handleStar = async (auditId) => {
  // Optimistically update UI
  setStarred(true);

  try {
    await api.post(`/audits/${auditId}/star`);
  } catch (error) {
    // Rollback on error
    setStarred(false);
    showToast('Failed to star audit', 'error');
  }
};
```

### 3. Lazy Loading (Infinite Scroll)

**Pattern**: Load more audits as user scrolls

```typescript
// Dashboard audit list
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery(
  'audits',
  ({ pageParam = 0 }) => api.get('/audits', { params: { offset: pageParam, limit: 20 } }),
  { getNextPageParam: (lastPage) => lastPage.nextOffset }
);

// Trigger when scrolling near bottom
const handleScroll = () => {
  if (scrollY + windowHeight >= documentHeight - 200 && hasNextPage) {
    fetchNextPage();
  }
};
```

**Visual Feedback**:
- Loading spinner at bottom: "Loading more audits..."
- Skeleton cards while loading
- "End of list" message when no more

### 4. Error Handling

**Pattern**: Graceful degradation with retry

```typescript
// MCP call with retry
const callMCP = async (endpoint, params, retries = 3) => {
  try {
    return await api.post(`/mcp/${endpoint}`, params);
  } catch (error) {
    if (retries > 0 && error.status === 429) { // Rate limit
      await delay(2000);
      return callMCP(endpoint, params, retries - 1);
    }
    throw error;
  }
};
```

**User-Facing Errors**:
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Audit Failed: MCP Connection Error                       │
│                                                              │
│ The SimilarWeb MCP server is temporarily unavailable.       │
│                                                              │
│ What happened:                                               │
│ • Phase 1 completed successfully (12/14 steps)              │
│ • Phase 2 failed at step 3 (traffic data)                  │
│                                                              │
│ What you can do:                                             │
│ [🔄 Retry Phase 2] [📧 Contact Support] [View Debug Logs]  │
└─────────────────────────────────────────────────────────────┘
```

### 5. Keyboard Shortcuts

**Global Shortcuts**:
- `Cmd/Ctrl + K`: Open command palette / search
- `Cmd/Ctrl + N`: New audit
- `Cmd/Ctrl + F`: Focus search bar
- `/`: Focus search (Gmail-style)
- `Esc`: Close modals/drawers

**Audit Details Shortcuts**:
- `1-5`: Switch tabs (Overview, Research, Findings, Deliverables, Settings)
- `←/→`: Previous/Next screenshot (when in gallery)
- `D`: Download current deliverable
- `S`: Star/unstar audit

**Implementation**:
```typescript
useHotkeys('cmd+k, ctrl+k', () => setCommandPaletteOpen(true));
useHotkeys('cmd+n, ctrl+n', () => navigate('/audits/new'));
useHotkeys('1', () => setActiveTab('overview'));
useHotkeys('2', () => setActiveTab('research'));
// ... etc
```

### 6. Command Palette (Power Users)

**Trigger**: `Cmd/Ctrl + K`

```
┌─────────────────────────────────────────────────────────────┐
│ Type a command or search...                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ new aud_                                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Commands                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ➕ Create New Audit                      Cmd+N          │ │
│ │ 🔍 Search Audits                          /             │ │
│ │ 📋 View Templates                                       │ │
│ │ ⚙️ Admin Dashboard                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Recent Audits                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Costco Wholesale                         ✅ 4.4/10     │ │
│ │ The RealReal                             🟡 60%        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 7. Bulk Actions (Multi-Select)

**Pattern**: Select multiple audits, apply action

```
Dashboard with 3 audits selected:

┌─────────────────────────────────────────────────────────────┐
│ 🔍 Algolia Audit Platform                    [+ New Audit]  │
│                                                              │
│ ☑ 3 selected    [📥 Download All] [🗑️ Delete] [Cancel]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ☑ Costco Wholesale             ✅ COMPLETED                 │
│ ☑ The RealReal                 ✅ COMPLETED                 │
│ ☐ Boden                        🔴 FAILED                    │
│ ☑ Lacoste                      ✅ COMPLETED                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:
```typescript
const [selected, setSelected] = useState<Set<string>>(new Set());

const handleSelectAll = () => {
  if (selected.size === audits.length) {
    setSelected(new Set());
  } else {
    setSelected(new Set(audits.map(a => a.id)));
  }
};

const handleBulkDownload = async () => {
  const auditIds = Array.from(selected);
  const zip = await api.post('/audits/bulk-download', { auditIds });
  downloadFile(zip);
};
```

---

## Animation & Transitions

### Page Transitions

```css
/* Fade in on route change */
.page-enter {
  opacity: 0;
  transform: translateY(20px);
}

.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 300ms, transform 300ms;
}
```

### Loading States

**Skeleton Screens** (preferred over spinners):

```
Audit Card Skeleton:

┌─────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                    ▓▓▓▓▓▓▓▓▓▓▓         │ ← Shimmering gray blocks
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ▓▓▓▓▓▓▓▓▓▓▓▓          │
│ ────────────────────────────────────────────────────────────│
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│ ────────────────────────────────────────────────────────────│
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     ▓▓▓▓▓▓▓▓▓▓▓▓     ▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│ ────────────────────────────────────────────────────────────│
│ [▓▓▓▓▓▓▓▓▓▓] [▓▓▓▓▓▓▓▓▓▓] [▓▓▓]                            │
└─────────────────────────────────────────────────────────────┘
```

### Success Animations

**Completion Checkmark** (SVG animation):

```html
<svg viewBox="0 0 52 52" class="checkmark">
  <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
  <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
</svg>

<style>
@keyframes stroke {
  100% { stroke-dashoffset: 0; }
}
@keyframes scale {
  0%, 100% { transform: none; }
  50% { transform: scale3d(1.1, 1.1, 1); }
}

.checkmark__circle {
  stroke: #36B37E;
  stroke-width: 2;
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark__check {
  stroke: #36B37E;
  stroke-width: 2;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}
</style>
```

---

## Accessibility (a11y)

### ARIA Labels

```html
<!-- Progress bar -->
<div role="progressbar"
     aria-valuenow="72"
     aria-valuemin="0"
     aria-valuemax="100"
     aria-label="Audit progress">
  <div class="progress-fill" style="width: 72%"></div>
</div>

<!-- Status badge -->
<span role="status" aria-live="polite" aria-label="Status: completed">
  ✅ COMPLETED
</span>

<!-- Screenshot gallery -->
<div role="list" aria-label="Browser test screenshots">
  <div role="listitem" aria-label="Screenshot 1 of 20: Homepage">
    <img src="..." alt="Homepage with search bar visible, test passed"/>
  </div>
</div>
```

### Keyboard Navigation

**Focus Indicators** (clear outlines):
```css
:focus {
  outline: 3px solid #003DFF;
  outline-offset: 2px;
}

/* Skip to main content link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #003DFF;
  color: white;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

### Screen Reader Announcements

```typescript
// Live region for dynamic updates
<div role="region" aria-live="polite" aria-atomic="true" className="sr-only">
  {liveMessage}
</div>

// Announce progress updates
const announceLiveMessage = (message: string) => {
  setLiveMessage(message);
  setTimeout(() => setLiveMessage(''), 1000); // Clear after announcing
};

// Usage
announceLiveMessage('Phase 2 completed successfully');
```

---

## Dark Mode (Optional Future Feature)

**Color Palette Mapping**:

```css
:root {
  /* Light mode (default) */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;
  --text-primary: #21243D;
  --text-secondary: #6B7280;
  --border: #E5E7EB;
  --accent: #003DFF;
}

[data-theme="dark"] {
  /* Dark mode */
  --bg-primary: #1F2937;
  --bg-secondary: #111827;
  --text-primary: #F9FAFB;
  --text-secondary: #9CA3AF;
  --border: #374151;
  --accent: #5468FF; /* Lighter accent for contrast */
}
```

**Toggle Button** (top nav):
```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Algolia Search Audit             [🌙] [JK ▼]            │
│                                       ↑ Dark mode toggle     │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary: Key UX Principles

1. **Progressive Disclosure**: Simple by default (just enter domain), advanced options available (phase selection, custom queries)
2. **Real-Time Feedback**: Never block, always show progress, use WebSocket for live updates
3. **Transparency**: Show data sources, API calls, confidence levels ([FACT] vs [ESTIMATE])
4. **Error Recovery**: Graceful degradation, clear error messages, retry mechanisms
5. **Efficiency**: Keyboard shortcuts, command palette, bulk actions for power users
6. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
7. **Performance**: Lazy loading, optimistic updates, caching, skeleton screens

---

**Document Version**: 1.0
**Last Updated**: 2026-03-02
**Next**: Prototype in Figma → User testing → Development kickoff
