# PartnerForge Source Citation Mandate

**Version:** 1.0
**Date:** 2026-02-25
**Status:** MANDATORY DESIGN PRINCIPLE
**Enforcement:** BLOCKING - No data accepted without sources

---

## ⚠️ ABSOLUTE REQUIREMENT

**Every single data point in PartnerForge MUST include:**
1. **Source URL** - Direct link to original source
2. **Source Type** - API, document, or search result
3. **Source Date** - When the data was published/retrieved
4. **Maximum Age** - **12 MONTHS** - No source older than 12 months is acceptable

**Data without sources is INCOMPLETE and will be REJECTED by the system.**

---

## Design Principle Enforcement

### At Database Level

Every intelligence table includes mandatory source columns:

```sql
-- EVERY intel_* table MUST have these columns
CREATE TABLE intel_example (
    id UUID PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,

    -- Data fields...
    data_field_1 TEXT,
    data_field_2 INTEGER,

    -- MANDATORY SOURCE FIELDS (cannot be null)
    source_url VARCHAR(500) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_date DATE NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraint: Source cannot be older than 12 months
    CONSTRAINT source_freshness CHECK (
        source_date > CURRENT_DATE - INTERVAL '12 months'
    ),

    -- Constraint: Source type must be valid
    CONSTRAINT valid_source_type CHECK (
        source_type IN (
            'builtwith_api',
            'similarweb_api',
            'yahoo_finance_api',
            'sec_edgar',
            'websearch',
            'earnings_transcript',
            'press_release',
            'linkedin_jobs',
            'company_website',
            'news_article'
        )
    )
);
```

### At Model Level (Pydantic)

All data models enforce source citation:

```python
# models/base.py

from pydantic import BaseModel, field_validator, HttpUrl
from datetime import date, datetime
from typing import Literal

class SourceCitation(BaseModel):
    """
    MANDATORY source citation for every data point.
    This model CANNOT be bypassed.
    """
    url: HttpUrl
    source_type: Literal[
        'builtwith_api',
        'similarweb_api',
        'yahoo_finance_api',
        'sec_edgar',
        'websearch',
        'earnings_transcript',
        'press_release',
        'linkedin_jobs',
        'company_website',
        'news_article'
    ]
    source_date: date
    fetched_at: datetime = datetime.utcnow()
    title: str | None = None
    author: str | None = None

    @field_validator('source_date')
    @classmethod
    def validate_source_freshness(cls, v: date) -> date:
        """Reject sources older than 12 months."""
        max_age = date.today() - timedelta(days=365)
        if v < max_age:
            raise ValueError(
                f"Source date {v} is older than 12 months. "
                f"Minimum acceptable date: {max_age}"
            )
        return v


class SourcedDataPoint(BaseModel):
    """
    Base class for ALL data points.
    Every piece of data MUST have at least one source.
    """
    value: Any
    sources: list[SourceCitation]

    @field_validator('sources')
    @classmethod
    def validate_has_sources(cls, v: list) -> list:
        """Reject data without sources."""
        if not v or len(v) == 0:
            raise ValueError(
                "Data point has no sources. "
                "ALL data must have at least one source citation."
            )
        return v


class MultiSourcedDataPoint(SourcedDataPoint):
    """
    Data point that can have multiple sources.
    Automatically selects freshest source.
    """
    primary_source: SourceCitation | None = None

    def __init__(self, **data):
        super().__init__(**data)
        # Always use the freshest source as primary
        self.primary_source = max(
            self.sources,
            key=lambda s: s.source_date
        )
```

### At Adapter Level

All API adapters automatically attach source metadata:

```python
# adapters/base_adapter.py

class SourcedAdapter(ABC):
    """
    Base adapter that ALWAYS attaches source metadata.
    Subclasses cannot bypass source citation.
    """

    SOURCE_TYPE: str  # Must be set by subclass

    @abstractmethod
    async def _fetch_raw(self, endpoint: str, **params) -> dict:
        """Fetch raw data from API."""
        pass

    async def fetch(self, endpoint: str, **params) -> SourcedResponse:
        """
        Fetch data with mandatory source metadata.
        THIS METHOD CANNOT BE OVERRIDDEN.
        """
        raw_data = await self._fetch_raw(endpoint, **params)

        return SourcedResponse(
            data=raw_data,
            source=SourceCitation(
                url=self._build_source_url(endpoint, params),
                source_type=self.SOURCE_TYPE,
                source_date=self._extract_source_date(raw_data),
                fetched_at=datetime.utcnow()
            )
        )

    def _extract_source_date(self, data: dict) -> date:
        """
        Extract source date from API response.
        Defaults to today if not available in response.
        """
        # Try common date fields
        for field in ['date', 'published', 'timestamp', 'created_at', 'updated_at']:
            if field in data:
                return self._parse_date(data[field])

        return date.today()


class BuiltWithAdapter(SourcedAdapter):
    SOURCE_TYPE = 'builtwith_api'

    def _build_source_url(self, endpoint: str, params: dict) -> str:
        domain = params.get('domain', '')
        return f"https://builtwith.com/{domain}"


class SimilarWebAdapter(SourcedAdapter):
    SOURCE_TYPE = 'similarweb_api'

    def _build_source_url(self, endpoint: str, params: dict) -> str:
        domain = params.get('domain', '')
        return f"https://www.similarweb.com/website/{domain}/"


class YahooFinanceAdapter(SourcedAdapter):
    SOURCE_TYPE = 'yahoo_finance_api'

    def _build_source_url(self, endpoint: str, params: dict) -> str:
        ticker = params.get('ticker', '')
        return f"https://finance.yahoo.com/quote/{ticker}/"
```

### At Service Level

Services validate source freshness before saving:

```python
# services/validation_service.py

class SourceValidationService:
    """
    Central service for source validation.
    Called before ANY data is saved.
    """

    MAX_SOURCE_AGE_DAYS = 365  # 12 months

    def validate_sources(self, data: dict) -> ValidationResult:
        """
        Validate all sources in a data payload.
        Returns errors if ANY source is missing or stale.
        """
        errors = []

        # Find all source citations in the data
        sources = self._extract_sources(data)

        if not sources:
            errors.append(ValidationError(
                field="sources",
                message="No source citations found. ALL data must have sources.",
                severity="BLOCKING"
            ))
            return ValidationResult(valid=False, errors=errors)

        # Validate each source
        for source in sources:
            if not source.get('url'):
                errors.append(ValidationError(
                    field=f"source.url",
                    message="Source missing URL",
                    severity="BLOCKING"
                ))

            if not source.get('source_date'):
                errors.append(ValidationError(
                    field=f"source.source_date",
                    message="Source missing date",
                    severity="BLOCKING"
                ))
            else:
                source_date = self._parse_date(source['source_date'])
                age_days = (date.today() - source_date).days

                if age_days > self.MAX_SOURCE_AGE_DAYS:
                    errors.append(ValidationError(
                        field=f"source.source_date",
                        message=f"Source is {age_days} days old. Maximum allowed: {self.MAX_SOURCE_AGE_DAYS} days",
                        severity="BLOCKING",
                        source_url=source.get('url')
                    ))

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors
        )

    def _extract_sources(self, data: dict, path: str = "") -> list:
        """Recursively extract all source citations from nested data."""
        sources = []

        if isinstance(data, dict):
            # Check if this is a source citation
            if 'source_url' in data or 'url' in data:
                sources.append(data)

            # Check for sources array
            if 'sources' in data:
                sources.extend(data['sources'])

            # Recurse into nested dicts
            for key, value in data.items():
                if key not in ('source', 'sources', 'source_url', 'source_urls'):
                    sources.extend(self._extract_sources(value, f"{path}.{key}"))

        elif isinstance(data, list):
            for i, item in enumerate(data):
                sources.extend(self._extract_sources(item, f"{path}[{i}]"))

        return sources
```

### At Repository Level

Repositories reject unsourced data:

```python
# repositories/base_repository.py

class SourcedRepository(ABC):
    """
    Base repository that BLOCKS unsourced data.
    """

    def __init__(self, db: AsyncSession, validator: SourceValidationService):
        self.db = db
        self.validator = validator

    async def save(self, entity: BaseModel) -> BaseModel:
        """
        Save entity ONLY if source validation passes.
        """
        # Validate sources BEFORE any database operation
        validation = self.validator.validate_sources(entity.dict())

        if not validation.valid:
            raise SourceValidationError(
                message="Cannot save data without valid sources",
                errors=validation.errors
            )

        # Proceed with save only after validation passes
        return await self._save(entity)

    @abstractmethod
    async def _save(self, entity: BaseModel) -> BaseModel:
        pass
```

---

## Inline Citation Format

### For Text Fields

All text fields with factual claims use inline citations:

```python
# Example: Strategic Signal Brief

{
    "sixty_second_story": (
        "Sally Beauty Holdings (NYSE: SBH) is a $3.72B beauty retailer "
        "[Source: Yahoo Finance, 2026-02-25](https://finance.yahoo.com/quote/SBH/) "
        "executing a major digital transformation called 'Sally Ignited' that "
        "explicitly prioritizes AI, search efficiency, and personalization. "
        "CEO Denise Paulonis stated on the Q1 2026 earnings call that the company "
        "is building 'a more efficient search engine for easier product discovery' "
        "[Source: Q1 2026 Earnings Transcript, 2026-02-09]"
        "(https://www.fool.com/earnings/call-transcripts/2026/02/09/...)"
    ),

    "in_their_own_words": [
        {
            "quote": "More efficient search engine for easier product discovery",
            "speaker": "Denise Paulonis",
            "title": "President & CEO",
            "source_url": "https://www.theglobeandmail.com/...",
            "source_date": "2026-02-09",
            "source_type": "earnings_transcript"
        }
    ]
}
```

### For Metrics

All metrics include source as adjacent field:

```python
{
    "monthly_visits": 15200000,
    "monthly_visits_source": {
        "url": "https://www.similarweb.com/website/sallybeauty.com/",
        "type": "similarweb_api",
        "date": "2026-02-25"
    },

    "revenue": 3720000000,
    "revenue_source": {
        "url": "https://finance.yahoo.com/quote/SBH/financials/",
        "type": "yahoo_finance_api",
        "date": "2026-02-25"
    }
}
```

### For Executive Quotes

EVERY quote requires full attribution:

```python
{
    "quote": "The customer right now says, 'I'm overwhelmed by choices. Help me make the right choice.'",
    "speaker": {
        "name": "Denise Paulonis",
        "title": "President & CEO",
        "company": "Sally Beauty Holdings"
    },
    "source": {
        "url": "https://www.beautyindependent.com/ceo-denise-paulonis-sally-beauty-new-store-format/",
        "type": "news_article",
        "date": "2025-11-15",
        "publication": "Beauty Independent"
    }
}
```

---

## Source Freshness Rules

### By Source Type

| Source Type | Max Age | Refresh Frequency |
|-------------|---------|-------------------|
| Stock price / Market cap | 1 day | Daily |
| Traffic data | 30 days | Monthly |
| Technology stack | 90 days | Quarterly |
| Financial statements | 12 months | Quarterly |
| Earnings transcripts | 12 months | Per earnings cycle |
| Executive profiles | 6 months | Quarterly |
| Hiring signals | 30 days | Weekly |
| News / Press releases | 12 months | On-demand |

### Automatic Staleness Detection

```python
# services/freshness_service.py

class FreshnessService:
    """
    Detect and flag stale sources.
    """

    FRESHNESS_RULES = {
        'yahoo_finance_api': timedelta(days=1),
        'similarweb_api': timedelta(days=30),
        'builtwith_api': timedelta(days=90),
        'sec_edgar': timedelta(days=365),
        'earnings_transcript': timedelta(days=365),
        'linkedin_jobs': timedelta(days=30),
        'press_release': timedelta(days=365),
        'news_article': timedelta(days=365),
    }

    def check_freshness(self, source: SourceCitation) -> FreshnessStatus:
        """
        Check if source is fresh, stale, or expired.
        """
        max_age = self.FRESHNESS_RULES.get(
            source.source_type,
            timedelta(days=365)  # Default to 12 months
        )

        age = datetime.utcnow().date() - source.source_date

        if age <= max_age:
            return FreshnessStatus.FRESH
        elif age <= max_age * 2:
            return FreshnessStatus.STALE  # Warning, should refresh
        else:
            return FreshnessStatus.EXPIRED  # Block, must refresh

    async def get_stale_records(self, domain: str) -> list[StaleRecord]:
        """
        Find all records for a domain with stale sources.
        Used to trigger re-enrichment.
        """
        # Query all intel tables for records older than their freshness threshold
        ...
```

---

## API Response Format

All API responses include source metadata:

```json
{
    "domain": "sallybeauty.com",
    "data": {
        "company_name": "Sally Beauty Holdings, Inc.",
        "revenue": 3720000000,
        "monthly_visits": 15200000
    },
    "_meta": {
        "sources": [
            {
                "url": "https://finance.yahoo.com/quote/SBH/",
                "type": "yahoo_finance_api",
                "date": "2026-02-25",
                "fields_sourced": ["revenue", "ticker", "market_cap"]
            },
            {
                "url": "https://www.similarweb.com/website/sallybeauty.com/",
                "type": "similarweb_api",
                "date": "2026-02-25",
                "fields_sourced": ["monthly_visits", "traffic_sources"]
            }
        ],
        "freshness": {
            "oldest_source": "2026-02-25",
            "all_sources_fresh": true,
            "stale_warnings": []
        },
        "generated_at": "2026-02-25T14:30:00Z"
    }
}
```

---

## Dashboard UI Requirements

### Source Indicators

Every data point in the dashboard shows source on hover:

```jsx
// components/SourcedMetric.tsx

const SourcedMetric = ({ label, value, source }: Props) => {
    return (
        <Tooltip content={
            <SourceTooltip>
                <div>Source: {source.type}</div>
                <div>Date: {formatDate(source.date)}</div>
                <a href={source.url} target="_blank">View Source →</a>
            </SourceTooltip>
        }>
            <MetricContainer>
                <Label>{label}</Label>
                <Value>{formatValue(value)}</Value>
                <SourceIcon freshness={source.freshness} />
            </MetricContainer>
        </Tooltip>
    );
};

// Freshness indicator colors
const FRESHNESS_COLORS = {
    fresh: '#22c55e',    // Green
    stale: '#f59e0b',    // Yellow
    expired: '#ef4444'   // Red
};
```

### Source Bibliography

Every report/brief includes full bibliography:

```markdown
## Sources

### Financial Data
- Yahoo Finance - SBH: https://finance.yahoo.com/quote/SBH/ (Retrieved: 2026-02-25)
- SEC 10-K FY2025: https://www.sec.gov/Archives/edgar/data/1368458/... (Filed: 2025-11-13)

### Traffic Data
- SimilarWeb - sallybeauty.com: https://www.similarweb.com/website/sallybeauty.com/ (Retrieved: 2026-02-25)

### Technology Stack
- BuiltWith - sallybeauty.com: https://builtwith.com/sallybeauty.com (Retrieved: 2026-02-25)

### Earnings Transcripts
- Q1 2026 Earnings Call: https://www.fool.com/earnings/call-transcripts/2026/02/09/... (Published: 2026-02-09)
- Q4 2025 Earnings Call: https://seekingalpha.com/article/4843182... (Published: 2025-11-13)

### Executive Interviews
- Beauty Independent - CEO Interview: https://www.beautyindependent.com/ceo-denise-paulonis... (Published: 2025-11-15)

### Hiring Data
- LinkedIn Jobs - Sally Beauty: https://www.linkedin.com/company/sally-beauty-company/jobs (Retrieved: 2026-02-25)
```

---

## Enforcement Mechanisms

### 1. Schema-Level Constraints (Database)
- `NOT NULL` on source columns
- `CHECK` constraint for 12-month freshness
- Foreign keys to source registry

### 2. Model-Level Validation (Pydantic)
- `@field_validator` on source fields
- Required fields in BaseModel
- Custom validators for freshness

### 3. Service-Level Validation (Business Logic)
- `SourceValidationService` called before save
- Raises `SourceValidationError` if invalid
- Logs all validation failures

### 4. Repository-Level Blocking (Data Access)
- `save()` method validates before write
- Rejects unsourced data with error
- No bypass possible

### 5. API-Level Response Metadata
- All responses include `_meta.sources`
- Freshness indicators included
- Stale warnings surfaced

### 6. CI/CD Enforcement
- Unit tests verify source presence
- Integration tests check freshness
- Pre-commit hooks validate schemas

---

## Error Messages

When source validation fails:

```python
# Clear, actionable error messages

SourceValidationError(
    code="MISSING_SOURCE",
    message="Data point 'monthly_visits' has no source citation",
    field="traffic_analysis.monthly_visits",
    action="Add source_url, source_type, and source_date to this field"
)

SourceValidationError(
    code="SOURCE_TOO_OLD",
    message="Source is 14 months old (426 days). Maximum allowed: 365 days",
    field="financial_profile.revenue",
    source_url="https://old-source.com/...",
    source_date="2025-01-01",
    action="Fetch fresh data from Yahoo Finance or SEC EDGAR"
)

SourceValidationError(
    code="INVALID_SOURCE_TYPE",
    message="Source type 'unknown' is not valid",
    field="executive_intelligence.background",
    allowed_types=[
        'builtwith_api', 'similarweb_api', 'yahoo_finance_api',
        'sec_edgar', 'websearch', 'earnings_transcript',
        'press_release', 'linkedin_jobs', 'company_website', 'news_article'
    ]
)
```

---

## Summary

| Requirement | Enforcement |
|-------------|-------------|
| Every data point has source | Pydantic model validation |
| Source URL is valid HTTP(S) | Pydantic HttpUrl validator |
| Source date within 12 months | Database CHECK constraint + Pydantic validator |
| Source type is known enum | Database CHECK constraint + Pydantic Literal |
| Inline citations in text | Output formatting service |
| Bibliography in reports | Report generation service |
| Freshness indicators in UI | React components |

**This mandate is NON-NEGOTIABLE. No exceptions.**

---

*Document Version: 1.0*
*Last Updated: 2026-02-25*
*Author: Thread 1 - Backend Architecture*
*Status: MANDATORY DESIGN PRINCIPLE*
