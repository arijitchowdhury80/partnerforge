# Architecture Diagrams

Visual diagrams of PartnerForge system architecture using Mermaid.

---

## System Overview

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TB
    subgraph Users["👥 USERS"]
        BDR[BDRs]
        AE[Account Executives]
        CSM[CSM]
        Leadership[Leadership]
    end

    subgraph Frontend["🖥️ FRONTEND (Vercel)"]
        Dashboard[Dashboard]
        Companies[Companies]
        Analytics[Analytics]
        Docs[Documentation]
    end

    subgraph Supabase["⚡ SUPABASE"]
        RestAPI[PostgREST API]
        DB[(PostgreSQL)]
        RestAPI --> DB
    end

    subgraph Enrichment["📦 ENRICHMENT (MCP / Scripts)"]
        M01[Company Context]
        M02[Tech Stack]
        M03[Traffic]
        M04[Financial]
    end

    subgraph DataSources["🔌 DATA SOURCES"]
        BW[BuiltWith MCP]
        SW[SimilarWeb MCP]
        YF[Yahoo Finance]
        WS[WebSearch]
    end

    Users --> Frontend
    Frontend -->|Direct HTTPS| Supabase
    Enrichment --> DataSources
    Enrichment --> DB
    DataSources --> DB
```

---

## 4-Wave Parallel Execution Model

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
    subgraph W1["WAVE 1 - Foundation (Parallel)"]
        direction TB
        M01[M01: Company Context]
        M02[M02: Tech Stack]
        M03[M03: Traffic Analysis]
        M04[M04: Financial Profile]
    end

    subgraph W2["WAVE 2 - Competitive (Parallel)"]
        direction TB
        M05[M05: Competitor Intel]
        M06[M06: Hiring Signals]
        M07[M07: Strategic Context]
    end

    subgraph W3["WAVE 3 - Buying Signals (Parallel)"]
        direction TB
        M08[M08: Investor Intel]
        M09[M09: Executive Intel]
        M10[M10: Buying Committee]
        M11[M11: Displacement Analysis]
    end

    subgraph W4["WAVE 4 - Synthesis (Parallel)"]
        direction TB
        M12[M12: Case Study Match]
        M13[M13: ICP-Priority Map]
        M14[M14: Signal Scoring]
        M15[M15: Strategic Brief]
    end

    W1 --> |JOIN BARRIER| W2
    W2 --> |JOIN BARRIER| W3
    W3 --> |JOIN BARRIER| W4
    W4 --> Output[📊 Dashboard + Reports]

    style W1 fill:#003dff,color:#fff
    style W2 fill:#5468ff,color:#fff
    style W3 fill:#8099ff,color:#000
    style W4 fill:#b3c2ff,color:#000
```

---

## Data Flow Diagram

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TD
    subgraph Input["📥 INPUT"]
        Domain[Company Domain]
        CSV[CSV Upload]
        API[API Request]
    end

    subgraph Collection["🔄 DATA COLLECTION"]
        BW[BuiltWith API]
        SW[SimilarWeb API]
        YF[Yahoo Finance API]
        WS[Web Search]
    end

    subgraph Processing["⚙️ PROCESSING"]
        Normalize[Normalize Data]
        Validate[Validate Sources]
        Score[ICP Scoring]
        Match[Case Study Match]
    end

    subgraph Storage["💾 STORAGE"]
        Targets[(displacement_targets)]
        Companies[(companies)]
        CaseStudies[(case_studies)]
        Enrichment[(enrichment_cache)]
    end

    subgraph Output["📤 OUTPUT"]
        Dashboard[Dashboard View]
        Detail[Company Detail]
        Reports[PDF Reports]
        Export[CRM Export]
    end

    Input --> Collection
    Collection --> Processing
    Processing --> Storage
    Storage --> Output

    BW --> |Tech Stack| Normalize
    SW --> |Traffic Data| Normalize
    YF --> |Financials| Normalize
    WS --> |Hiring, Quotes| Normalize
```

---

## ICP Scoring Flow

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
    subgraph Inputs[SCORING INPUTS]
        V[Vertical 40%]
        T[Traffic 30%]
        TS[Tech Spend 20%]
        PT[Partner Tech 10%]
    end

    subgraph Calculation[CALCULATION]
        Calc[Score = V*0.4 + T*0.3 + TS*0.2 + PT*0.1]
    end

    subgraph Tiers[ICP TIERS]
        Hot[Hot 80-100]
        Warm[Warm 60-79]
        Cool[Cool 40-59]
        Cold[Cold 0-39]
    end

    Inputs --> Calculation
    Calculation --> Tiers

    style Hot fill:#ef4444,color:#fff
    style Warm fill:#f97316,color:#fff
    style Cool fill:#5468ff,color:#fff
    style Cold fill:#6b7280,color:#fff
```

---

## Module Dependency Graph

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TD
    M01[M01: Company Context] --> M05
    M01 --> M06
    M01 --> M07
    M01 --> M08
    M01 --> M09
    M01 --> M12
    M01 --> M13

    M02[M02: Tech Stack] --> M05
    M02 --> M11
    M02 --> M12
    M02 --> M13

    M03[M03: Traffic] --> M13

    M04[M04: Financial] --> M08
    M04 --> M13

    M05[M05: Competitor Intel] --> M11
    M05 --> M13

    M06[M06: Hiring Signals] --> M10
    M06 --> M14

    M07[M07: Strategic Context] --> M09
    M07 --> M14

    M08[M08: Investor Intel] --> M14

    M09[M09: Executive Intel] --> M10

    M10[M10: Buying Committee]
    M11[M11: Displacement]
    M12[M12: Case Study Match]
    M13[M13: ICP-Priority]
    M14[M14: Signal Scoring]

    M10 --> M15
    M11 --> M15
    M12 --> M15
    M13 --> M15
    M14 --> M15

    M15[M15: Strategic Brief]

    style M01 fill:#003dff,color:#fff
    style M02 fill:#003dff,color:#fff
    style M03 fill:#003dff,color:#fff
    style M04 fill:#003dff,color:#fff
    style M15 fill:#10b981,color:#fff
```

---

## Database Entity Relationship

```mermaid
%%{init: {'theme': 'dark'}}%%
erDiagram
    displacement_targets ||--o{ enrichment_jobs : "has"
    displacement_targets ||--o{ executive_quotes : "has"
    displacement_targets ||--o{ hiring_signals : "has"
    displacement_targets ||--o{ strategic_triggers : "has"
    displacement_targets ||--o{ buying_committee : "has"

    companies ||--o{ case_studies : "has"

    displacement_targets {
        int id PK
        string domain UK
        string company_name
        string partner_tech
        string vertical
        int icp_score
        string icp_tier_name
        bigint sw_monthly_visits
        decimal revenue
        string ticker
        boolean is_public
        timestamp last_enriched
    }

    companies {
        int id PK
        string domain UK
        string name
        string vertical
        boolean is_algolia_customer
        decimal algolia_arr
    }

    case_studies {
        int id PK
        string customer_name
        string customer_domain
        string vertical
        string use_case
        string story_url
    }

    enrichment_jobs {
        string job_id PK
        string domain FK
        string status
        int progress_percent
        int current_wave
        timestamp created_at
        timestamp completed_at
    }

    executive_quotes {
        int id PK
        string domain FK
        string speaker_name
        string speaker_title
        text quote
        string source_type
        string source_url
    }

    hiring_signals {
        int id PK
        string domain FK
        string role_title
        string team
        string signal_type
        string careers_url
    }
```

---

## Enrichment Job State Machine

```mermaid
%%{init: {'theme': 'dark'}}%%
stateDiagram-v2
    [*] --> Queued: POST /enrich
    Queued --> Running: Worker picks up
    Running --> Wave1: Start processing
    Wave1 --> Wave2: All W1 complete
    Wave2 --> Wave3: All W2 complete
    Wave3 --> Wave4: All W3 complete
    Wave4 --> Completed: All modules done

    Running --> Failed: Critical error
    Wave1 --> PartialComplete: Non-critical failure
    Wave2 --> PartialComplete: Non-critical failure
    Wave3 --> PartialComplete: Non-critical failure
    Wave4 --> PartialComplete: Non-critical failure

    PartialComplete --> [*]
    Completed --> [*]
    Failed --> [*]

    Running --> Cancelled: User cancels
    Cancelled --> [*]
```

---

## Frontend Component Hierarchy

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TD
    App[App.tsx]

    App --> AppShell[AppShell]
    AppShell --> Sidebar[Sidebar]
    AppShell --> Header[Header]
    AppShell --> Content[Route Content]

    Content --> Dashboard[Dashboard Page]
    Content --> Companies[Companies Page]
    Content --> Detail[Target Detail Page]
    Content --> Analytics[Analytics Page]
    Content --> Docs[Docs Page]

    Dashboard --> Hero[Hero Stats]
    Dashboard --> Heatmap[ICP vs Vertical Heatmap]
    Dashboard --> TargetTable[Target Table]

    Detail --> CompanyHeader[Company Header]
    Detail --> IntelTabs[Intelligence Tabs]

    IntelTabs --> OverviewTab[Overview]
    IntelTabs --> FinancialsTab[Financials]
    IntelTabs --> HiringTab[Hiring Signals]
    IntelTabs --> ExecutiveTab[Executive Intel]

    Docs --> DocNav[Doc Navigation]
    Docs --> DocContent[Markdown Renderer]
```

---

## API Request Flow

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
    participant U as User
    participant F as Frontend (Vercel)
    participant S as Supabase REST API
    participant D as PostgreSQL

    U->>F: View Targets
    F->>S: GET /rest/v1/displacement_targets
    S->>D: SELECT query
    D-->>S: Results
    S-->>F: JSON response
    F-->>U: Display results

    Note over F,S: All queries go directly to Supabase
    Note over F,S: No intermediate backend server
```

---

## Enrichment Flow (Offline/MCP)

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
    participant C as Claude/MCP
    participant E as External APIs
    participant D as Supabase DB

    C->>E: Call BuiltWith API
    E-->>C: Tech stack data
    C->>E: Call SimilarWeb API
    E-->>C: Traffic data
    C->>E: Call Yahoo Finance API
    E-->>C: Financial data
    C->>D: INSERT/UPDATE via REST API
    D-->>C: Confirmation

    Note over C,D: Enrichment runs via MCP tools
    Note over C,D: or local Python scripts
```

---

## Deployment Architecture

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TB
    subgraph GitHub["📦 GitHub"]
        Repo[partnerforge repo]
    end

    subgraph Vercel["🔺 Vercel"]
        FE[Frontend - React + Vite]
    end

    subgraph Supabase["⚡ Supabase"]
        RestAPI[PostgREST API]
        DB[(PostgreSQL)]
        Auth[Auth]
        Storage[Storage]
    end

    subgraph External["🌐 External APIs"]
        BW[BuiltWith]
        SW[SimilarWeb]
        YF[Yahoo Finance]
    end

    Repo -->|Auto-deploy| Vercel

    FE -->|Direct REST calls| RestAPI
    RestAPI --> DB

    External -.->|Enrichment scripts| DB

    style Vercel fill:#000,color:#fff
    style Supabase fill:#3ECF8E,color:#000
```

---

## Circuit Breaker Pattern

```mermaid
%%{init: {'theme': 'dark'}}%%
stateDiagram-v2
    [*] --> Closed

    Closed --> Open: 5 failures
    Open --> HalfOpen: 60s timeout
    HalfOpen --> Closed: Success
    HalfOpen --> Open: Failure

    state Closed {
        [*] --> Normal
        Normal --> Counting: Failure
        Counting --> Normal: Success
    }

    note right of Open: Requests blocked
    note right of HalfOpen: Test single request
```

---

## Build Process - Parallel Agent Strategy

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TB
    subgraph Build["🔨 PARALLEL BUILD EXECUTION"]
        direction TB

        subgraph T1["Thread 1: Backend Core"]
            B1[Models]
            B2[Repos]
            B3[Services]
            B4[Tests]
        end

        subgraph T2["Thread 2: Data Pipeline"]
            D1[Adapters]
            D2[Modules]
            D3[Orchestrator]
            D4[Tests]
        end

        subgraph T3["Thread 3: Frontend UI"]
            F1[Components]
            F2[Dashboard]
            F3[Views]
            F4[Tests]
        end

        subgraph T4["Thread 4: Infra/DevOps"]
            I1[Migrations]
            I2[Deploy]
            I3[Monitoring]
            I4[Tests]
        end
    end

    T1 --> Integration
    T2 --> Integration
    T3 --> Integration
    T4 --> Integration

    Integration[INTEGRATION PHASE - All threads merge and verify]

    style T1 fill:#003dff,color:#fff
    style T2 fill:#5468ff,color:#fff
    style T3 fill:#8099ff,color:#000
    style T4 fill:#b3c2ff,color:#000
```

---

## 15 Intelligence Modules Overview

| Wave | Module | Description | Data Source |
|------|--------|-------------|-------------|
| **1** | M01 | Company Context | BuiltWith |
| **1** | M02 | Tech Stack | BuiltWith |
| **1** | M03 | Traffic Analysis | SimilarWeb |
| **1** | M04 | Financial Profile | Yahoo Finance |
| **2** | M05 | Competitor Intel | SimilarWeb |
| **2** | M06 | Hiring Signals | WebSearch |
| **2** | M07 | Strategic Context | WebSearch |
| **3** | M08 | Investor Intel | SEC/WebSearch |
| **3** | M09 | Executive Intel | WebSearch |
| **3** | M10 | Buying Committee | LinkedIn |
| **3** | M11 | Displacement Analysis | Internal |
| **4** | M12 | Case Study Matching | Internal DB |
| **4** | M13 | ICP-Priority Mapping | Internal |
| **4** | M14 | Signal Scoring | Internal |
| **4** | M15 | Strategic Brief | AI Generated |

---

## Related Documents

- [Parallel Execution Architecture](../PARALLEL_EXECUTION_ARCHITECTURE.md)
- [Enterprise Architecture](../ENTERPRISE-ARCHITECTURE.md)
- [Database Schema](./database.md)
- [Architecture Index](../ARCHITECTURE_INDEX.md)

---

*Generated with Mermaid diagrams for GitHub/GitLab rendering*
