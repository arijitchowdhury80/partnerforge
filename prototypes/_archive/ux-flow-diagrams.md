# Algolia Search Audit Dashboard — UX Flow Diagrams

**Date**: March 2, 2026

---

## User Flow 1: Marketing Manager — First Time Full Audit

```mermaid
graph TD
    A[Landing: Dashboard] --> B[Click: + New Audit]
    B --> C[Wizard Step 1: Enter URL]
    C --> D{URL Valid?}
    D -->|No| C
    D -->|Yes| E[Wizard Step 2: Select Mode]
    E --> F[Select: Full Audit]
    F --> G[Wizard Step 3: Configuration]
    G --> H{Customize?}
    H -->|No| I[Click: Skip]
    H -->|Yes| J[Edit Settings]
    J --> I
    I --> K[Wizard Step 4: Review]
    K --> L[Click: Launch Audit]
    L --> M[Redirect: Audit Detail - Overview Tab]
    M --> N[Monitor: Real-time Progress]
    N --> O{Audit Complete?}
    O -->|No| N
    O -->|Yes| P[Email Notification Received]
    P --> Q[Return to Platform]
    Q --> R[Navigate: Deliverables Tab]
    R --> S[Click: Download PDF Book]
    S --> T[Click: Share Link]
    T --> U[Send URL via Slack/Email]
    U --> V[End: Prospect has audit]

    style A fill:#e3f2fd
    style L fill:#4caf50,color:#fff
    style P fill:#ff9800,color:#fff
    style V fill:#4caf50,color:#fff
```

**Key Touchpoints**: 8 screens, 3 clicks to launch, ~40 min wait, 2 clicks to share

---

## User Flow 2: Sales Engineer — Quick Research Mode

```mermaid
graph TD
    A[Dashboard] --> B[+ New Audit]
    B --> C[Enter URL: therealreal.com]
    C --> D[Select Mode: Research Only]
    D --> E[Skip Configuration]
    E --> F[Launch]
    F --> G[Monitor or Close Tab]
    G --> H[Email: Research Complete]
    H --> I[Return: Audit Detail]
    I --> J[Research Tab]
    J --> K[Expand: 01-company-context.md]
    K --> L[Expand: 08-financial-profile.md]
    L --> M[Expand: 11-investor-intelligence.md]
    M --> N[Deliverables Tab]
    N --> O[Generate: AE Brief Only]
    O --> P[Download Markdown]
    P --> Q[Paste into Call Prep Doc]
    Q --> R[End: Ready for Call]

    style A fill:#e3f2fd
    style D fill:#2196f3,color:#fff
    style H fill:#ff9800,color:#fff
    style R fill:#4caf50,color:#fff
```

**Key Touchpoints**: 7 screens, 20 min wait, focused on scratchpad data

---

## User Flow 3: Product Marketing — Advanced Custom Audit

```mermaid
graph TD
    A[Dashboard] --> B[+ New Audit]
    B --> C[Enter URL: lacoste.com]
    C --> D[Expand: Advanced Phase Selection]
    D --> E[Select: Custom Phases]
    E --> F[Uncheck: Hiring, Investor Intel]
    F --> G[Configuration]
    G --> H[Add 8 Custom Test Queries]
    H --> I[Adjust Scoring Weights]
    I --> J[Launch]
    J --> K[Monitor: Phase 1]
    K --> L{Phase 1 Done?}
    L -->|Yes| M[Research Tab]
    M --> N[Edit: 05-test-queries.md]
    N --> O[Actions Panel: Resume Audit]
    O --> P[Monitor: Phase 2 with Updated Queries]
    P --> Q[Phase 2 Complete]
    Q --> R[Browser Tests Tab]
    R --> S[Review Screenshots]
    S --> T[Scoring Tab]
    T --> U[Export Scoring Matrix CSV]
    U --> V[Deliverables: Generate All]
    V --> W[End: Analysis Complete]

    style A fill:#e3f2fd
    style E fill:#9c27b0,color:#fff
    style N fill:#ff5722,color:#fff
    style O fill:#ff9800,color:#fff
    style W fill:#4caf50,color:#fff
```

**Key Touchpoints**: 10+ screens, iterative editing, advanced controls

---

## User Flow 4: Partner Marketing — Batch Processing

```mermaid
graph TD
    A[Dashboard] --> B[+ New Audit]
    B --> C[Select: Batch Mode]
    C --> D[Upload CSV: 10 Domains]
    D --> E[Configure Once: Full Audit]
    E --> F[Launch Batch]
    F --> G[Dashboard: View Queue]
    G --> H[All 10 Running]
    H --> I{All Complete?}
    I -->|No| H
    I -->|Yes| J[Email: Batch Complete]
    J --> K[Library]
    K --> L[Filter: Batch ID]
    L --> M[Select All 10]
    M --> N[Bulk Export: Download ZIP]
    N --> O[Unzip: 10 PDFs + 20 Briefs]
    O --> P[End: 10 Prospects Analyzed]

    style A fill:#e3f2fd
    style C fill:#673ab7,color:#fff
    style J fill:#ff9800,color:#fff
    style P fill:#4caf50,color:#fff
```

**Key Touchpoints**: 6 screens, bulk operations, overnight processing

---

## Navigation Map: Information Architecture

```mermaid
graph LR
    A[Dashboard] --> B[New Audit Wizard]
    A --> C[Audit Detail]
    A --> D[Library]
    A --> E[Settings]
    A --> F[Help]

    B --> B1[Step 1: Company Input]
    B1 --> B2[Step 2: Mode Selection]
    B2 --> B3[Step 3: Configuration]
    B3 --> B4[Step 4: Review & Launch]
    B4 --> C

    C --> C1[Overview Tab]
    C --> C2[Research Tab]
    C --> C3[Browser Tests Tab]
    C --> C4[Scoring Tab]
    C --> C5[Deliverables Tab]
    C --> C6[Actions Panel]

    D --> D1[All Audits Grid]
    D --> D2[Filters & Search]
    D --> D3[Bulk Actions]

    E --> E1[MCP Server Status]
    E --> E2[API Credits]
    E --> E3[User Preferences]
    E --> E4[Team Management]

    F --> F1[Video Tutorials]
    F --> F2[Documentation]
    F --> F3[API Reference]

    style A fill:#003dff,color:#fff
    style C fill:#5468ff,color:#fff
    style B4 fill:#4caf50,color:#fff
```

---

## State Machine: Audit Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Queued: User clicks Launch
    Queued --> Running: Worker picks up job
    Running --> Paused: User clicks Pause
    Paused --> Running: User clicks Resume
    Running --> Failed: Error occurs
    Failed --> Running: User clicks Retry
    Running --> Completed: All phases done
    Completed --> [*]

    state Running {
        [*] --> Phase0: Workspace Setup
        Phase0 --> Phase1: Pre-Audit Research
        Phase1 --> Phase2: Browser Testing
        Phase2 --> Phase3: Scoring
        Phase3 --> Phase4: Report Generation
        Phase4 --> Phase5: Deliverables
        Phase5 --> [*]
    }

    note right of Queued
        User can cancel here
    end note

    note right of Failed
        Show error message
        Offer retry or cancel
    end note

    note right of Completed
        Send email notification
        Enable deliverable download
    end note
```

---

## Screen-to-Screen Transitions

### From Dashboard
| Action | Destination | Transition Type |
|--------|-------------|-----------------|
| Click "+ New Audit" | Wizard Step 1 | Modal overlay |
| Click audit card | Audit Detail (Overview) | Full page |
| Click "View All" (Recent) | Library | Full page |
| Click "Settings" | Settings | Full page |
| Click "Profile" | User Profile | Dropdown menu |

### From Wizard
| Action | Destination | Transition Type |
|--------|-------------|-----------------|
| Click "Next" | Next wizard step | Slide animation |
| Click "Back" | Previous step | Slide animation |
| Click "Close X" | Dashboard | Modal closes |
| Click "Launch Audit" | Audit Detail (Overview) | Full page redirect |

### From Audit Detail
| Action | Destination | Transition Type |
|--------|-------------|-----------------|
| Click "← Back to Dashboard" | Dashboard | Full page |
| Click tab (Research, Browser, etc.) | Same page, tab change | Tab switch |
| Click "View" on scratchpad file | File detail modal | Modal overlay |
| Click "Download PDF" | File downloads | Browser download |
| Click "Share Link" | Share modal | Modal overlay |
| Click "Pause Audit" | Same page, status updates | In-place update |

### From Library
| Action | Destination | Transition Type |
|--------|-------------|-----------------|
| Click audit row | Audit Detail | Full page |
| Click "View" | Audit Detail | Full page |
| Click "Download" | File downloads | Browser download |
| Click "Share" | Share modal | Modal overlay |
| Click "Delete" | Confirm modal → refresh | Modal + update |

---

## Error Flows

### Error: CAPTCHA Detected (Phase 2)

```mermaid
graph TD
    A[Browser Test Running] --> B{CAPTCHA Detected?}
    B -->|Yes| C[Pause Audit]
    C --> D[Show Modal: CAPTCHA Challenge]
    D --> E[User Action Required]
    E --> F[User: View Browser Window]
    F --> G[User: Solve CAPTCHA]
    G --> H[User: Click 'Mark as Solved']
    H --> I[Resume Audit]
    I --> J[Continue Testing]

    style D fill:#ff9800,color:#fff
    style E fill:#ff5722,color:#fff
```

### Error: WAF Block (Phase 2)

```mermaid
graph TD
    A[Navigate to Site] --> B{WAF Block?}
    B -->|Yes| C[Wait 10s, Retry]
    C --> D{Success?}
    D -->|No| E[Try Homepage First]
    E --> F{Success?}
    F -->|No| G[Show Modal: Manual Intervention]
    G --> H[User: Navigate Manually]
    H --> I[User: Confirm Ready]
    I --> J[Resume from Current Point]

    style G fill:#ff5722,color:#fff
```

### Error: MCP Server Disconnected

```mermaid
graph TD
    A[API Call to MCP] --> B{Connection?}
    B -->|Failed| C[Retry 3x with Backoff]
    C --> D{Success?}
    D -->|No| E[Pause Audit]
    E --> F[Show Error Toast]
    F --> G[Log Error in Activity Feed]
    G --> H[Settings: Show Red Status]
    H --> I[User: Go to Settings]
    I --> J[User: Test Connection]
    J --> K{Fixed?}
    K -->|Yes| L[Resume Audit]
    K -->|No| M[Contact Support]

    style F fill:#ff5722,color:#fff
    style H fill:#ff9800,color:#fff
```

---

## Interaction Patterns

### Real-Time Progress Updates

```
User View (Browser)          WebSocket           Backend Worker
       |                          |                      |
       |                          |<------ emit("phase.progress", data)
       |<------ message ----------|                      |
       | Update progress bar      |                      |
       | Show current step        |                      |
       |                          |                      |
       |                          |<------ emit("activity.log", data)
       |<------ message ----------|                      |
       | Append to activity feed  |                      |
       |                          |                      |
       |                          |<------ emit("audit.complete", data)
       |<------ message ----------|                      |
       | Show toast notification  |                      |
       | Enable deliverable links |                      |
```

### Scratchpad File Editing (Advanced)

```
1. User clicks "Edit" on 05-test-queries.md
   ↓
2. Modal opens with markdown editor
   ↓
3. User edits queries, adds 2 new ones
   ↓
4. User clicks "Save"
   ↓
5. API: PUT /audits/{id}/scratchpad/05-test-queries.md
   ↓
6. Backend: Validate markdown format
   ↓
7. Backend: Save to database
   ↓
8. Frontend: Show success toast
   ↓
9. Frontend: Show "Resume Audit" button
   ↓
10. User clicks "Resume Audit"
    ↓
11. API: POST /audits/{id}/resume?from_phase=2
    ↓
12. Backend: Re-run Phase 2 with updated queries
    ↓
13. WebSocket: Stream progress to user
```

---

## Key Screens by Persona

### Marketing Manager (Simplicity)
1. ⭐ Dashboard (quick start)
2. ⭐ Wizard Step 1 (URL only)
3. ⭐ Wizard Step 2 (Full Audit button)
4. ⭐ Audit Detail - Overview (monitor)
5. ⭐ Audit Detail - Deliverables (download PDF)

**Screens NOT needed**: Research tab, Browser Tests tab, Settings

---

### Sales Engineer (Speed)
1. ⭐ Dashboard
2. ⭐ Wizard (Research Only mode)
3. ⭐ Audit Detail - Research (scratchpad explorer)
4. ⭐ Audit Detail - Deliverables (AE Brief download)

**Screens NOT needed**: Browser Tests, Scoring, Configuration

---

### Product Marketing (Control)
1. ⭐ Dashboard
2. ⭐ Wizard - Advanced Mode (custom phases)
3. ⭐ Wizard - Configuration (custom queries, weights)
4. ⭐ Audit Detail - Research (edit scratchpad)
5. ⭐ Audit Detail - Browser Tests (screenshot review)
6. ⭐ Audit Detail - Scoring (export matrix)
7. ⭐ Audit Detail - Actions (resume/regenerate)

**Screens needed**: ALL screens + advanced controls

---

### Partner Marketing (Scale)
1. ⭐ Dashboard (queue view)
2. ⭐ Wizard - Batch Mode (CSV upload)
3. ⭐ Library (filter by batch)
4. ⭐ Library - Bulk Actions (export all)

**Screens NOT needed**: Individual audit details (batch summary only)

---

## Responsive Breakpoints

### Desktop (1440px+)
- Full 3-column layout (sidebar + main + detail panel)
- All features visible
- No collapsed menus

### Tablet (768px - 1439px)
- 2-column layout (main + detail panel)
- Sidebar collapses to hamburger menu
- Wizard becomes full-width

### Mobile (< 768px)
- Single column layout
- Stack all content vertically
- Bottom nav bar for main sections
- Simplified wizard (auto-skip Step 3)

---

## Animation & Transitions

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Modal open | Fade in + scale(0.95→1) | 200ms | ease-out |
| Modal close | Fade out + scale(1→0.95) | 150ms | ease-in |
| Wizard step forward | Slide left | 300ms | ease-in-out |
| Wizard step back | Slide right | 300ms | ease-in-out |
| Tab switch | Fade swap | 200ms | ease-in-out |
| Progress bar update | Width transition | 300ms | ease-out |
| Toast notification | Slide down from top | 250ms | ease-out |
| Audit card hover | Lift (shadow increase) | 150ms | ease-out |
| Button hover | Background darken | 100ms | ease-out |

---

## Accessibility Considerations

### Keyboard Navigation
- ✅ All buttons/links focusable with Tab
- ✅ Modal traps focus (Esc to close)
- ✅ Wizard: Enter = Next, Shift+Enter = Back
- ✅ Audit cards: Space/Enter to open

### Screen Readers
- ✅ All images have alt text
- ✅ Progress bars have aria-valuenow/min/max
- ✅ Status badges have aria-label (e.g., "Status: Running")
- ✅ Activity log has aria-live="polite" for updates

### Color Contrast
- ✅ All text meets WCAG AA (4.5:1 for body, 3:1 for large text)
- ✅ Status colors tested with Color Oracle (colorblind simulation)
- ✅ Never rely on color alone (icons + text)

### Focus Indicators
- ✅ 2px blue outline on all interactive elements
- ✅ Visible skip-to-main link

---

## Loading States

### Skeleton Screens (before data loads)

**Dashboard**:
```
┌─────────────────────────────────────┐
│  ▓▓▓▓▓▓▓  (skeleton header)         │
├─────────────────────────────────────┤
│  ┌───────────┐ ┌───────────┐       │
│  │░░░░░░░░░░░│ │░░░░░░░░░░░│       │
│  │░░░░░░░░░░░│ │░░░░░░░░░░░│       │
│  │░░░░░░░░░░░│ │░░░░░░░░░░░│       │
│  └───────────┘ └───────────┘       │
│                                     │
└─────────────────────────────────────┘
```

**Audit Detail - Research Tab**:
```
┌─────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  │
│  ┌─────────────────────────────────┐│
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ││
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ││
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Spinners (inline operations)
- Small (16px): Inline with text (e.g., "Saving... ⏳")
- Medium (32px): Modal centers (e.g., "Generating PDF...")
- Large (64px): Full-page overlays (rare, only on initial load)

---

## Notification Strategy

### Email Notifications (User Preference)
- ✅ Audit started (optional, default OFF)
- ✅ Phase 1 complete (optional, default OFF)
- ✅ Audit complete (default ON)
- ✅ Audit failed (default ON)
- ✅ Batch complete (default ON)

### In-App Toasts
- ✅ Audit launched (success, 3s)
- ✅ Audit paused (info, 3s)
- ✅ Audit resumed (info, 3s)
- ✅ Error occurred (error, 5s + dismiss button)
- ✅ File downloaded (success, 2s)
- ✅ Link copied (success, 2s)

### Browser Push (Future)
- ⏳ Audit complete (when tab not focused)
- ⏳ User action required (CAPTCHA)

---

This flow diagram set provides the complete navigation structure, error handling patterns, and interaction models for the dashboard.
