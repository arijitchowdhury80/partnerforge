# Arian Documentation Rules

**Version:** 1.0
**Last Updated:** 2026-02-26

---

## Core Principle

> **"Documentation is not an afterthought — it's a deliverable."**

Every feature, API endpoint, module, or significant change MUST include documentation as part of the completion criteria. Undocumented code is incomplete code.

---

## Documentation Workflow

### Rule 1: Document As You Build

When creating or modifying any of the following, documentation MUST be updated:

| Change Type | Required Documentation |
|-------------|----------------------|
| **New API Endpoint** | Add to `docs/api/endpoints/{resource}.md` |
| **New Database Table** | Add to `docs/architecture/database.md` |
| **New Frontend Page** | Update navigation in `DocsPage.tsx` |
| **New Feature** | Add to relevant guide or create new guide |
| **Schema Changes** | Update `docs/api/schemas.md` |
| **Breaking Changes** | Add migration guide to `docs/guides/` |
| **Bug Fixes** | Document in error handling if systemic |

### Rule 2: Documentation Checklist (Before PR)

Before marking any task as complete, verify:

- [ ] API changes documented with request/response examples
- [ ] Database schema changes documented with DDL
- [ ] New TypeScript interfaces added to schemas.md
- [ ] Error scenarios documented
- [ ] Breaking changes flagged and migration noted
- [ ] Code examples updated if affected

### Rule 3: Documentation Structure

Follow this hierarchy:

```
docs/
├── README.md                 # Project overview (auto-update stats)
├── api/
│   ├── README.md            # API overview, auth, versioning
│   ├── endpoints/           # One file per resource
│   │   ├── targets.md       # /api/v1/targets/*
│   │   ├── enrichment.md    # /api/v1/enrich/*
│   │   └── health.md        # /health/*
│   ├── schemas.md           # TypeScript interfaces
│   └── errors.md            # Error codes and handling
├── guides/
│   ├── quickstart.md        # 5-minute getting started
│   └── [feature].md         # Feature-specific guides
├── architecture/
│   ├── overview.md          # System design
│   └── database.md          # Schema documentation
└── changelog/               # Release notes (future)
```

---

## Documentation Templates

### New API Endpoint Template

```markdown
## [Endpoint Name]

[Brief description of what this endpoint does]

\`\`\`http
[METHOD] /api/v1/[path]
\`\`\`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `param1` | string | Yes | Description |

### Request Body

\`\`\`json
{
  "field": "value"
}
\`\`\`

### Response

\`\`\`json
{
  "data": {}
}
\`\`\`

### Example

\`\`\`bash
curl -X [METHOD] "[URL]" \\
  -H "Content-Type: application/json" \\
  -d '{"field": "value"}'
\`\`\`

### Errors

| Code | Description |
|------|-------------|
| 400 | Invalid request |
| 404 | Resource not found |
```

### New Database Table Template

```markdown
### [table_name]

[Brief description of what this table stores]

\`\`\`sql
CREATE TABLE [table_name] (
    id                    INTEGER PRIMARY KEY,
    field_1               TEXT NOT NULL,
    field_2               INTEGER,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_[table]_[field] ON [table_name]([field]);
\`\`\`

**Relationships:**
- [Foreign key to other_table]

**Sample Data:**
| field_1 | field_2 |
|---------|---------|
| value1  | 100     |
```

### New TypeScript Interface Template

```markdown
### [InterfaceName]

[When this interface is used]

\`\`\`typescript
interface [InterfaceName] {
  field1: string;
  field2: number;
  field3?: boolean;  // Optional field
}
\`\`\`
```

---

## Auto-Documentation Triggers

The following actions should automatically trigger documentation updates:

### 1. API/Database Changes

When new Supabase tables or API patterns are added:
- Create corresponding section in `docs/api/endpoints/`
- Add to endpoint summary table in `docs/api/README.md`
- Update schemas.md with new TypeScript interfaces

### 2. Database Migration

When a new migration or table is created:
- Add DDL to `docs/architecture/database.md`
- Add relationship diagram if foreign keys exist
- Document indexes and their purpose

### 3. Frontend Page Creation

When a new page is added to `frontend/src/pages/`:
- Add navigation entry to `DocsPage.tsx` if user-facing
- Update feature guides if introducing new functionality

### 4. Module/Component Creation

When creating significant new components:
- Add JSDoc comments to the component
- Document props interface in code
- Add usage examples if reusable

---

## Documentation Quality Standards

### Completeness Checklist

Every documented feature must include:
1. **Purpose** — What it does and why
2. **Usage** — How to use it (with examples)
3. **Parameters** — All inputs documented
4. **Responses** — All outputs documented
5. **Errors** — What can go wrong and how to handle
6. **Examples** — Working code snippets

### Writing Style

- Use **active voice** ("Returns a list" not "A list is returned")
- Be **concise** but complete
- Include **code examples** for every endpoint
- Use **tables** for parameters and fields
- Include **curl, Python, JavaScript** examples where relevant

### Versioning

- Include version badge in docs (`v2.2.0`)
- Note when features were added
- Document breaking changes prominently

---

## Integration with Claude Code

### Session Memory Update

After completing any documentation:
1. Update `MEMORY.md` with new docs added
2. Note the documentation status in session summary
3. Flag any documentation debt

### Commit Convention

Documentation commits should use:
```
docs: [Brief description]

- Add [endpoint] documentation
- Update [schema] with new fields
- Create [guide] for [feature]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Documentation Debt Tracking

If documentation cannot be completed immediately, create a tracking entry:

```markdown
## Documentation Debt

| Feature | Missing Docs | Priority | Owner |
|---------|--------------|----------|-------|
| Batch import | API docs, guide | High | - |
| Webhooks | Endpoint docs | Medium | - |
```

Review and resolve documentation debt in each sprint/session.

---

## Automation (Future)

Planned automation for documentation:
1. **OpenAPI Generation** — Auto-generate API docs from Supabase schema
2. **Schema Extraction** — Auto-generate TypeScript types from PostgreSQL
3. **Test Coverage** — Link test files to documented features
4. **Changelog Generation** — Auto-generate from commits

---

*This document is part of the Arian development standards.*
