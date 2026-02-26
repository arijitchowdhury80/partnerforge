# PartnerForge UI/UX Library Research

**Research Date:** 2026-02-25
**Objective:** Find premium UI/UX libraries that deliver enterprise-grade experience while managing complexity across 15 intelligence modules.

---

## The Usability Challenge

PartnerForge has **15 intelligence modules** spanning:
- Company Profile, Tech Stack, Traffic, Financials (Foundation)
- Competitors, Market Position (Competitive)
- Hiring, Executive Quotes, Triggers, Investor Intel (Buying Signals)
- Account Engagement, Relationship Mapping (Engagement)
- ZoomInfo, Crossbeam, Demandbase (Future)

**Key Challenge:** Present deep, data-heavy information that is:
- Functional (actionable for sales teams)
- In-depth (comprehensive intelligence)
- Not overwhelming (clear information hierarchy)

---

## Recommended Stack: Premium Tier

### Primary Choice: **Mantine + Tremor + Magic UI**

| Library | Purpose | License |
|---------|---------|---------|
| [Mantine](https://mantine.dev/) | Core components, forms, data display | MIT (Free) |
| [Tremor](https://www.tremor.so/) | Charts, KPIs, metrics, dashboards | Apache 2.0 (Free) |
| [Magic UI](https://magicui.design/) | Animations, micro-interactions | MIT (Free) + Pro ($199) |

### Why This Combination?

**Mantine** is the #1 choice for enterprise dashboards in 2026:
> "If you're building an enterprise dashboard, go with Mantine or shadcn/ui for control freaks" - [Builder.io](https://www.builder.io/blog/react-component-libraries-2026)

- 100+ components with batteries included
- Full TypeScript support
- RTL, dark mode, theme customization
- Data tables, forms, date pickers out of the box
- Building a sortable, filterable data table is a 20-minute task vs full day with shadcn

**Tremor** fills the gap for data visualization:
- 35+ chart/visualization components
- Built specifically for dashboards
- KPI cards, metrics, trackers, sparklines
- Works seamlessly with Tailwind
- [300K+ monthly downloads](https://www.tremor.so/)

**Magic UI** adds premium polish:
- 150+ animated components
- Smooth transitions and micro-interactions
- Bento grids, animated lists, blur effects
- Perfect for "wow factor" without complexity
- [15K+ GitHub stars](https://magicui.design/)

---

## Alternative Options Compared

### Option A: shadcn/ui + Tremor + Aceternity

| Pros | Cons |
|------|------|
| Maximum design control | More setup time |
| Copy-paste ownership | Need to style everything |
| Growing ecosystem | Data tables require manual work |

**Best for:** Teams with strong designers who want pixel-perfect custom UI

### Option B: Ant Design (Enterprise Standard)

| Pros | Cons |
|------|------|
| Enterprise-proven (94K GitHub stars) | Opinionated design system |
| Rich data tables, forms, charts | Bundle size concerns |
| Used by Alibaba, Tencent | Less modern aesthetic |

**Best for:** Traditional enterprise apps prioritizing stability over aesthetics

### Option C: TailAdmin + Horizon UI (Templates)

| Pros | Cons |
|------|------|
| Pre-built dashboard layouts | Less flexibility |
| 500+ UI elements | May look generic |
| AI-ready components | Harder to customize deeply |

**Best for:** MVP/rapid prototyping, not long-term premium product

---

## Component Selection by Use Case

### 1. Main Dashboard (Target List)

| Component | Library | Why |
|-----------|---------|-----|
| Data Table | **Mantine DataTable** | Sorting, filtering, pagination, virtual scroll in one |
| Stats Cards | **Tremor KPICard** | Clean metrics display with deltas |
| Quick Filters | **Mantine SegmentedControl** | Tier 1/2/3, Hot/Warm/Cool chips |
| Search | **Mantine Spotlight** | Command palette for power users |

### 2. Company Intelligence View (Tabs)

| Component | Library | Why |
|-----------|---------|-----|
| Tabs | **Mantine Tabs** | Vertical or horizontal, with badges |
| Financial Charts | **Tremor AreaChart** | 3-year revenue trends |
| Margin Zone | **Tremor DonutChart** | Red/Yellow/Green visualization |
| Quote Cards | **Mantine Blockquote** | Executive quotes with attribution |
| Source Citations | **Magic UI Blur Fade** | Subtle highlight on hover |

### 3. Executive Quotes ("In Their Own Words")

| Component | Library | Why |
|-----------|---------|-----|
| Quote Card | Custom w/ Mantine | Speaker, title, source link |
| Topic Tags | **Mantine Badge** | "Search", "Digital", "AI" |
| Relevance Score | **Tremor ProgressCircle** | Visual 0-100 score |
| Source Link | **Magic UI Animated Border** | Draws attention to citation |

### 4. Hiring Signals View

| Component | Library | Why |
|-----------|---------|-----|
| Signal Strength | **Tremor BarList** | Strong/Moderate/Weak ranking |
| Job Postings | **Mantine Timeline** | Chronological with links |
| Tech Detection | **Mantine Badge Group** | "SFCC", "Blue Yonder" tags |
| Tier Breakdown | **Tremor DonutChart** | VP/Director/IC distribution |

### 5. Batch Enrichment Progress

| Component | Library | Why |
|-----------|---------|-----|
| Overall Progress | **Tremor ProgressBar** | 45/100 completed |
| Module Status | **Tremor Tracker** | Red/Yellow/Green per module |
| Real-time Updates | **Magic UI Animated List** | Smooth additions |
| ETA Display | **Mantine Text** | Simple countdown |

---

## Data Table Strategy: Critical Decision

For 2,687+ targets with virtual scrolling, we need a serious data table solution:

### Option 1: Mantine DataTable (Recommended)

```tsx
import { DataTable } from 'mantine-datatable';

<DataTable
  columns={columns}
  records={targets}
  sortable
  pinFirstColumn
  virtualized
  height={600}
  onRowClick={({ record }) => navigate(`/company/${record.domain}`)}
/>
```

**Pros:**
- Mantine-native, consistent styling
- Built-in sorting, filtering, pagination
- Virtualization for large datasets
- Row selection, column pinning

### Option 2: TanStack Table + Mantine

```tsx
import { useReactTable } from '@tanstack/react-table';
import { Table } from '@mantine/core';
```

**Pros:**
- Maximum control over behavior
- Headless = use any styling
- Industry standard

**Cons:**
- Requires more setup
- Manual virtualization integration

### Option 3: AG Grid (Enterprise)

**Pros:**
- Handles 100K+ rows
- Excel-like features
- Industry gold standard

**Cons:**
- $999/license for enterprise features
- Overkill for our dataset size
- Styling mismatch with rest of app

**Recommendation:** Start with **Mantine DataTable**. Migrate to TanStack Table only if we hit limitations.

---

## Design Patterns for Data Density

### Pattern 1: Progressive Disclosure

```
Level 1: Dashboard Table (minimal columns)
├── Company, Score, Status, Partner, Traffic
│
Level 2: Row Expansion (on click)
├── Quick preview: ICP breakdown, top signals, last enriched
│
Level 3: Full Company View (navigate)
├── All 15 intelligence modules in tabs
```

### Pattern 2: Information Hierarchy (F-Pattern)

```
┌─────────────────────────────────────────────────────────────┐
│  [Company Name]            [Score: 85]  [Status: HOT]       │  ← Primary scan
├─────────────────────────────────────────────────────────────┤
│  Tech: SFCC | Traffic: 9.2M | E-com: $446M | Margin: Yellow │  ← Secondary scan
├─────────────────────────────────────────────────────────────┤
│  Active Signals:                                            │  ← Action items
│  • VP Ecommerce OPEN [LinkedIn]                             │
│  • CEO: "more efficient search engine" [Earnings Call]      │
│  • BSG Platform Update Spring 2026 [SEC Filing]             │
└─────────────────────────────────────────────────────────────┘
```

### Pattern 3: Contextual Actions

```tsx
// Every data point has inline actions
<FinancialMetric
  label="Revenue"
  value="$3.72B"
  source={{ url: "...", date: "2026-02", type: "yahoo_finance" }}
  onRefresh={() => triggerEnrichment("financials")}
  onExpand={() => showFullFinancials()}
/>
```

### Pattern 4: Signal Prioritization

```
┌─────────────────────────────────────────────────────────────┐
│  🔥 HOT SIGNALS (Act Now)                                   │
│  ┌─────────────────────────────────────────────────────────│
│  │ VP Ecommerce role OPEN - Leadership vacancy             │
│  │ CEO mentions "search engine" in Feb 2026 earnings       │
│  │ BSG Platform Update with AI - Spring 2026               │
│  └─────────────────────────────────────────────────────────│
│                                                             │
│  📊 CONTEXT (Background Intel)                              │
│  ┌─────────────────────────────────────────────────────────│
│  │ E-commerce growing 34% YoY                              │
│  │ EBITDA margin 12.6% (Yellow Zone)                       │
│  │ Using Salesforce Commerce Cloud                         │
│  └─────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────┘
```

---

## Animation Guidelines (Premium Feel)

### Use Magic UI Sparingly

| When to Animate | Component | Effect |
|-----------------|-----------|--------|
| New data arrives | Animated List | Slide in |
| Score changes | Number Ticker | Count up |
| Status change | Blur Fade | Smooth transition |
| Enrichment complete | Confetti | Celebration |
| Loading states | Shimmer | Placeholder |

### What NOT to Animate

- Data tables (performance)
- Form inputs (distraction)
- Navigation (delay)
- Charts (use Tremor's built-in)

---

## Color System for Intelligence Status

```css
/* Signal Status */
--hot: #ef4444;      /* Red-500 */
--warm: #f97316;     /* Orange-500 */
--cool: #3b82f6;     /* Blue-500 */
--cold: #6b7280;     /* Gray-500 */

/* Margin Zones */
--margin-green: #22c55e;  /* Healthy >20% */
--margin-yellow: #eab308; /* Moderate 10-20% */
--margin-red: #ef4444;    /* Pressure <10% */

/* Source Freshness */
--fresh: #22c55e;    /* < 30 days */
--stale: #eab308;    /* 30-365 days */
--expired: #ef4444;  /* > 365 days (blocked) */
```

---

## Implementation Roadmap

### Week 1: Foundation
```bash
# Install core libraries
npm install @mantine/core @mantine/hooks @mantine/dates @mantine/form
npm install @tremor/react
npm install magic-ui  # or copy components
npm install mantine-datatable
```

### Week 2: Dashboard Shell
- Navigation sidebar
- Stats cards (Tremor)
- Filter bar (Mantine)
- Data table (Mantine DataTable)

### Week 3: Company Detail View
- Tab system (Mantine)
- Financial charts (Tremor)
- Quote cards (Custom)
- Source citations (Custom)

### Week 4: Polish
- Loading states (Magic UI Shimmer)
- Animations (Magic UI)
- Dark mode
- Accessibility audit

---

## Cost Analysis

| Library | License | Cost |
|---------|---------|------|
| Mantine | MIT | **Free** |
| Tremor | Apache 2.0 | **Free** |
| Magic UI | MIT | **Free** (Pro: $199 lifetime) |
| Mantine DataTable | MIT | **Free** |
| TanStack Table | MIT | **Free** |
| Tailwind CSS | MIT | **Free** |

**Total: $0 - $199** (if Magic UI Pro needed)

vs. Alternatives:
- AG Grid Enterprise: $999/license
- MUI X Pro: $249/dev/year
- Ant Design Pro: Free but less flexible

---

## Final Recommendation

### For PartnerForge: **Mantine + Tremor + Magic UI**

**Why:**
1. **Mantine** handles 80% of UI needs (forms, tables, tabs, modals)
2. **Tremor** handles all data visualization (charts, KPIs, metrics)
3. **Magic UI** adds premium animations where needed
4. All three use **Tailwind CSS** = consistent styling
5. All three are **free/open-source** = no licensing overhead
6. All three have **excellent TypeScript support**

### Design Philosophy

> "Make the complex feel simple, make the simple feel delightful."

- Use progressive disclosure to manage complexity
- Lead with signals, support with context
- Every data point gets a source citation
- Animate sparingly for delight, not distraction

---

## Sources

- [Untitled UI - React Component Libraries](https://www.untitledui.com/blog/react-component-libraries)
- [Builder.io - React Component Libraries 2026](https://www.builder.io/blog/react-component-libraries-2026)
- [Tremor - Dashboard Components](https://www.tremor.so/)
- [Magic UI - Animated Components](https://magicui.design/)
- [Mantine - React Component Library](https://mantine.dev/)
- [TailAdmin - Dashboard Templates](https://tailadmin.com/)
- [Horizon UI - React Dashboard](https://horizon-ui.com/)
- [Aceternity UI - Premium Components](https://ui.aceternity.com)
- [Makers Den - UI Libraries Comparison](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [Eleken - Dashboard Design Examples](https://www.eleken.co/blog-posts/dashboard-design-examples-that-catch-the-eye)
- [Aufait UX - Dashboard Design Principles](https://www.aufaitux.com/blog/dashboard-design-principles/)

---

*Document Version: 1.0.0*
*Last Updated: 2026-02-25*
