# PartnerForge - Development Guidelines

## CRITICAL: Use Shared Libraries

**NEVER define colors, statuses, or filter components inline. Always import from shared libraries.**

### 1. Colors - Import from `@/lib/constants`

```typescript
// ✅ CORRECT - Import from shared constants
import { COLORS } from '@/lib/constants';
const bg = COLORS.ALGOLIA_NEBULA_BLUE;
const text = COLORS.GRAY_700;

// ❌ WRONG - Never define colors inline
const ALGOLIA_BLUE = '#003DFF';  // NO!
const GRAY_500 = '#64748b';       // NO!
```

Available colors:
- `COLORS.ALGOLIA_NEBULA_BLUE` (#003DFF) - Primary blue
- `COLORS.ALGOLIA_SPACE_GRAY` (#21243D) - Dark text
- `COLORS.ALGOLIA_PURPLE` (#5468FF) - Accents
- `COLORS.GRAY_50` through `COLORS.GRAY_900` - Grayscale

### 2. Status Definitions - Import from `@/lib/constants`

```typescript
// ✅ CORRECT
import { STATUSES, STATUS_MAP, getStatusFromScore } from '@/lib/constants';

// Canonical order is ALWAYS: Hot → Warm → Cold
STATUSES.forEach(status => console.log(status.key)); // hot, warm, cold

// Get status from ICP score
const status = getStatusFromScore(85); // returns 'hot'

// ❌ WRONG - Never define status arrays inline
const statuses = ['warm', 'hot', 'cold']; // NO! Wrong order!
```

### 3. Table Filters - Import from `@/components/common/TableFilters`

```typescript
// ✅ CORRECT - Use shared FilterHeader component
import { FilterHeader, STATUS_COLOR_MAP } from '@/components/common/TableFilters';

<FilterHeader
  label="Status"
  options={statusOptions}
  selectedValues={selectedValues}
  onFilterChange={handleChange}
  colorMap={STATUS_COLOR_MAP}
  useCanonicalOrder={true}  // For status filters - ensures Hot → Warm → Cold
/>

// ❌ WRONG - Never build custom filter UI inline
<Popover>...</Popover>  // NO! Use FilterHeader
```

### 4. File Structure

```
frontend/src/
├── lib/
│   └── constants.ts      # COLORS, STATUSES, STATUS_MAP, helpers
├── components/
│   └── common/
│       └── TableFilters.tsx  # FilterHeader, SortHeader, STATUS_COLOR_MAP
```

## UI Consistency Rules

1. **Same component everywhere** - If TargetList is used on Dashboard, it must be the SAME component on Companies page
2. **No inline styles for colors** - Always reference shared constants
3. **Status order is sacred** - Hot → Warm → Cold, never any other order
4. **Filter dropdowns** - Always use `useCanonicalOrder={true}` for status filters

## Backend

- **Database**: Supabase (project: xbitqeejsgqnwvxlnjra)
- **API**: Direct Supabase REST API via `@/services/supabase.ts`

## Deployment

- **Frontend**: Vercel (auto-deploys from main branch)
- **URL**: https://partnerforge.vercel.app
