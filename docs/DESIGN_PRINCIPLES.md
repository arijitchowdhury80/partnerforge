# PartnerForge Design Principles

**Version**: 1.0
**Date**: 2026-02-25
**Status**: MANDATORY — All code must comply

---

## Principle 1: SOURCE CITATION IS MANDATORY

### The Rule

> **Every data point MUST have an inline citation with source URL.**
> **No source older than 12 months is acceptable.**

This is NON-NEGOTIABLE. There are no exceptions.

### Why This Matters

1. **Enterprise ABM requires auditability** — Sales reps need to verify claims before customer conversations
2. **Legal/compliance** — Factual claims must be traceable
3. **Data freshness** — Stale data leads to bad decisions
4. **Credibility** — Unsourced claims are worthless

### Implementation Requirements

#### Every API Response MUST Include:

```json
{
  "revenue": {
    "value": 3720000000,
    "source_url": "https://www.businesswire.com/news/home/20241114390606/en/...",
    "source_name": "Business Wire - FY2024 Results",
    "retrieved_at": "2026-02-25T10:30:00Z"
  }
}
```

#### Every Module Output MUST Use:

```python
from api.orchestrator.source_citation import CitedModuleOutput, create_yahoo_finance_citation

output = CitedModuleOutput("financial")
output.add_raw_data(
    field_name="revenue",
    value=3_720_000_000,
    source_url="https://finance.yahoo.com/quote/SBH/",
    source_name="Yahoo Finance",
)
```

#### Every Deliverable MUST Have:

1. **Inline citations** — `[Source Name](url)` in markdown
2. **Sources section** — Bibliography at the end
3. **No uncited facts** — Validator will reject

### Validation Gates

| Gate | When | What |
|------|------|------|
| **Module Validation** | After each module completes | Check all fields have `source_url` |
| **Deliverable Validation** | Before generating output | Check sources section exists, inline citations present |
| **API Response Validation** | Before returning to client | Check all facts have citations |
| **Freshness Check** | On every citation | Reject if `retrieved_at` > 365 days old |

### Error Handling

If a data point lacks citation:
1. Log error with field path
2. Mark module as `partial`
3. Add warning to job errors
4. Still generate deliverable but flag uncited sections

### Estimate Handling

For calculated/estimated values:
```python
output.add_data_point(
    field_name="addressable_revenue",
    value=54_700_000,
    citation=create_estimate_citation(
        calculation="$364.6M × 15%",
        based_on=[ecommerce_citation, industry_benchmark_citation]
    ),
    is_estimate=True,
    calculation_formula="Digital Revenue × Search-Driven Share (15%)",
)
```

---

## Principle 2: PARALLEL BY DEFAULT

### The Rule

> **Always invoke parallel execution when tasks are independent.**
> **Never execute sequentially when parallel is possible.**

### Implementation

```python
# ❌ WRONG: Sequential execution
for competitor in competitors:
    result = await fetch_competitor_data(competitor)
    results.append(result)

# ✅ CORRECT: Parallel execution
tasks = [fetch_competitor_data(c) for c in competitors]
results = await asyncio.gather(*tasks)
```

### Parallelization Points

| Level | What | How |
|-------|------|-----|
| **Wave** | Modules within same wave | `asyncio.gather()` |
| **Module** | API calls within module | `asyncio.gather()` |
| **Competitor** | Each competitor analysis | `asyncio.gather()` |
| **Batch** | Multiple accounts | Semaphore-limited `gather()` |

---

## Principle 3: HUMAN TRIGGERS, ORCHESTRATOR COORDINATES

### The Rule

> **Humans initiate work. The orchestrator executes it.**

### Responsibilities

| Actor | Responsibility |
|-------|----------------|
| **Human** | Click "Enrich", run `/pf enrich`, call API |
| **Orchestrator** | Wave resolution, parallel execution, progress tracking |
| **Workers** | Module execution, API calls, data transformation |
| **Redis** | Job queues, progress events, rate limiting |

---

## Principle 4: EVERY DATA POINT MAPS TO ALGOLIA

### The Rule

> **Every insight should connect to an Algolia product.**

### Implementation

Executive quotes MUST include:
```json
{
  "quote_text": "A more efficient search engine for easier product discovery",
  "speaker_name": "Denise Paulonis",
  "speaker_title": "President & CEO",
  "source_url": "https://...",
  "maps_to_algolia_product": "Algolia InstantSearch, Dynamic Faceting"
}
```

Gaps MUST include:
```json
{
  "area": "NLP/Semantic Search",
  "score": "3/10",
  "severity": "HIGH",
  "algolia_solution": "Algolia NeuralSearch"
}
```

---

## Principle 5: MODULARITY FOR EXTENSIBILITY

### The Rule

> **Every intelligence capability is a self-contained module.**
> **New modules plug in without touching existing code.**

### Module Interface

```python
class IntelligenceModule(ABC):
    module_id: str
    dependencies: List[str]

    @abstractmethod
    async def collect(self, domain: str, context: Dict) -> RawData:
        """Fetch raw data from external sources."""

    @abstractmethod
    async def transform(self, raw: RawData) -> NormalizedData:
        """Transform and validate."""

    @abstractmethod
    async def enrich(self, data: NormalizedData, context: Dict) -> CitedModuleOutput:
        """Cross-reference, score, and ADD CITATIONS."""
```

### Adding New Modules

1. Create module class implementing interface
2. Add to `WAVE_CONFIG` with dependencies
3. Register in `modules/registry.py`
4. No changes to orchestrator needed

---

## Principle 6: ROI CALCULATION FOLLOWS THE FORMULA

### The Rule

> **ROI estimates use a consistent, documented formula.**

### Formula

```
Addressable Search Revenue = Digital Revenue × 15% (search-driven share)
Annual Impact = Addressable Revenue × Lift % (5%, 10%, 15%)
```

### Scenarios

| Scenario | Lift % | Use When |
|----------|--------|----------|
| **Conservative** | 5% | Baseline, always defensible |
| **Moderate** | 10% | Primary pitch number |
| **Aggressive** | 15% | With strong comparables |

### Must Include

1. Calculation formula in output
2. Citation for industry benchmark (15%)
3. Case study benchmarks for validation

---

## Principle 7: MARGIN ZONE INFORMS PITCH

### The Rule

> **Financial health determines pitch angle.**

### Zones

| Zone | EBITDA Margin | Pitch Angle |
|------|---------------|-------------|
| **Red** | ≤10% | Efficiency gains, cost reduction |
| **Yellow** | 10-20% | Efficiency + revenue lift |
| **Green** | >20% | Growth story, competitive advantage |

---

## Compliance Checklist

Before any PR is merged:

- [ ] All data points have `source_url`
- [ ] No sources older than 12 months
- [ ] Module uses `CitedModuleOutput`
- [ ] Parallel execution for independent tasks
- [ ] Executive quotes have `maps_to_algolia_product`
- [ ] ROI follows standard formula
- [ ] Deliverables have Sources section

---

*These principles are MANDATORY. Non-compliant code will be rejected.*
