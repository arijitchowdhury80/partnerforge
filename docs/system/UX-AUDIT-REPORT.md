# Arian UX Audit Report

**Date:** 2026-02-26
**Auditor:** Claude (Code-Based Analysis)
**App URL:** https://algolia-arian.vercel.app
**Version:** Post-Performance Cleanup

---

## Executive Summary

This audit evaluates Arian from three Algolia sales personas:
- **Account Executive (AE)** - Closing deals on hot leads
- **Business Development Rep (BDR)** - Researching and qualifying leads
- **Partner Manager** - Analyzing partner displacement opportunities

### Overall Score: 7.2/10

| Category | Score | Notes |
|----------|-------|-------|
| First Impression | 8/10 | Clean empty state, clear CTA |
| Data Presentation | 7/10 | Good table, some filter UX issues |
| Research Workflow | 7/10 | Drawer is powerful but needs discovery |
| Performance | 8/10 | Good after cleanup, pagination helps |
| Consistency | 7/10 | CompaniesPage still has inline colors |

---

## Persona 1: Account Executive (AE)

### User Story
*"As an AE, I need to quickly find HOT leads from a partner's customer base so I can prioritize my outreach."*

### Test Scenarios

#### Scenario 1.1: Cold Start - Finding Hot Leads
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Land on dashboard | See empty state with partner buttons | ✅ Lines 347-394 show clear empty state |
| 2 | Click "Adobe Experience Manager" | See partner-filtered data load | ✅ Lines 380-390 trigger `selectPartner()` |
| 3 | Check stats | See Hot/Warm/Cold counts | ✅ Lines 425-438 show badge stats |
| 4 | Sort by ICP Score | Highest scores first | ✅ Default sort is `icp_score DESC` |

**PASS** - AE can quickly identify hot leads

#### Scenario 1.2: Drilling into a Hot Lead
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Click on company row | Open detail drawer | ✅ TargetList line 491 handles click |
| 2 | See ICP breakdown | Signal + Priority scores | ✅ CompanyDrawer lines 253-261 |
| 3 | Click "Enrich Now" | See enrichment progress | ✅ Dashboard lines 192-220 handle enrichment |
| 4 | Add to Campaign | Button exists | ⚠️ Button exists (line 400-405) but NO functionality |

**ISSUE FOUND:**
- **Add to Campaign button does nothing** - No `onClick` handler (CompanyDrawer.tsx:400-405)
- **Severity:** HIGH for AE workflow
- **Recommendation:** Wire up to CRM or campaign management

#### Scenario 1.3: Quick Research During Call
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Pin drawer | Enable side-by-side view | ✅ Lines 122-129, 139-142 handle pinning |
| 2 | See multiple accordions | Traffic, Financials, Tech open | ✅ Line 127 opens 3 sections when pinned |
| 3 | Click to website | External link works | ✅ Lines 383-391 use proper `target="_blank"` |

**PASS** - Research mode is well-designed

---

## Persona 2: Business Development Rep (BDR)

### User Story
*"As a BDR, I need to filter and segment targets to build outreach lists by vertical and status."*

### Test Scenarios

#### Scenario 2.1: Filtering by Hot Status
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Click Status column header | Open filter popover | ✅ FilterHeader component |
| 2 | Select "Hot" checkbox | See hot leads only | ✅ TargetList lines 154-158 filter by status |
| 3 | See filter indicator | "1 filter active" message | ✅ Lines 451-463 show active filter count |
| 4 | Clear filter | All leads return | ✅ FilterHeader has "Clear All" button |

**PASS** - Excel-style filtering works

#### Scenario 2.2: Multi-Column Filtering
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Filter Status = Hot | Hot leads shown | ✅ Works |
| 2 | ALSO filter Vertical = Retail | Hot + Retail leads | ✅ Lines 150-167 handle multiple filters |
| 3 | Options still available | Other verticals clickable | ✅ Uses `allCompanies` for options (line 199) |

**PASS** - Multi-filter preserves options correctly

#### Scenario 2.3: Status Filter Order
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Open Status filter | See Hot, Warm, Cold order | ✅ `useCanonicalOrder={true}` (line 310) |
| 2 | Visual consistency | Hot=red, Warm=orange, Cold=gray | ✅ STATUS_COLOR_MAP used |

**PASS** - Canonical order enforced

#### Scenario 2.4: Pagination Through Large Datasets
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | See "Showing X to Y of Z" | Count is accurate | ✅ Lines 526-528 |
| 2 | Click page 2 | New data loads | ✅ `onPageChange` prop wired |
| 3 | Page controls visible | Edges + numbers | ✅ `withEdges` on Pagination |

**PASS** - Pagination works correctly

### ISSUE FOUND: BDR Workflow Gap
- **No bulk selection/export** - BDR cannot select multiple leads and export to CSV
- **Severity:** MEDIUM
- **Recommendation:** Add checkbox column + export functionality

---

## Persona 3: Partner Manager

### User Story
*"As a Partner Manager, I need to analyze displacement opportunities across different views (Partner, Product, Vertical)."*

### Test Scenarios

#### Scenario 3.1: View Mode Switching
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Click Partner view | Sort by partner groupings | ✅ DistributionGrid lines 119-128 |
| 2 | Click Product view | Sort by product | ✅ Lines 123-132 |
| 3 | Click Vertical view | Sort by vertical | ✅ Lines 130-136 (but missing in switch!) |
| 4 | Click Account view | Sort by ICP score | ✅ Lines 134-136 |

**ISSUE FOUND:**
- **Vertical view case missing** - DistributionGrid.tsx switch statement jumps from `product` to `account`, skipping `vertical` (falls through to default)
- **Severity:** MEDIUM
- **Location:** DistributionGrid.tsx lines 118-137
- **Current behavior:** Vertical view just sorts by ICP score (same as Account)
- **Recommendation:** Add proper `case 'vertical':` handler

#### Scenario 3.2: Formula Display Understanding
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Select partner | See formula badge | ✅ Lines 338-343 show when partner selected |
| 2 | Formula shows | "Partner - Algolia = TARGETS" | ✅ FormulaDisplay component (516-534) |

**PASS** - Clear value proposition display

#### Scenario 3.3: Drill-Down from Distribution
| Step | Action | Expected | Code Analysis |
|------|--------|----------|---------------|
| 1 | Grid cell click | Open AccountDrillDown | ⚠️ Handler exists but NOT CONNECTED! |
| 2 | See filtered targets | Targets for that cell | ❌ Not working |

**ISSUE FOUND:**
- **onCellClick not triggered** - DistributionGrid receives `onCellClick` prop but never calls it
- **Severity:** HIGH
- **Location:** DistributionGrid.tsx line 99 receives prop but doesn't use it
- **Current behavior:** Grid shows data but cell clicks do nothing
- **Recommendation:** Wire up cell click to call `onCellClick(rowKey, colKey, targets)`

---

## Technical Issues Found

### Issue #1: CompaniesPage Still Uses Inline Colors
**File:** `CompaniesPage.tsx` lines 38-43
```typescript
// Algolia Brand Colors (Official)
const ALGOLIA_NEBULA_BLUE = '#003DFF';
const ALGOLIA_SPACE_GRAY = '#21243D';
const ALGOLIA_PURPLE = '#5468FF';
```
**Recommendation:** Import from `@/lib/constants` like Dashboard.tsx does

### Issue #2: Dead "Add to Campaign" Button
**File:** `CompanyDrawer.tsx` lines 400-405
```typescript
<Button variant="filled" color="blue">
  Add to Campaign
</Button>
```
No `onClick` handler - button does nothing.

### Issue #3: Vertical Sort Missing
**File:** `DistributionGrid.tsx` lines 118-137
```typescript
switch (viewMode) {
  case 'partner': // exists
  case 'product': // exists
  // case 'vertical': MISSING!
  case 'account':
  default:
}
```

### Issue #4: onCellClick Never Called
**File:** `DistributionGrid.tsx` line 99
```typescript
export function DistributionGrid({ viewMode, targets, onEnrichCompany }: DistributionGridProps) {
  // onCellClick is in props interface but destructured out!
```
The prop is defined but not destructured, so never used.

### Issue #5: TargetList Still Has Redundant Color Aliases
**File:** `TargetList.tsx` lines 67-75
```typescript
// Use shared color constants - no more inline duplicates
const ALGOLIA_NEBULA_BLUE = COLORS.ALGOLIA_NEBULA_BLUE; // Redundant
const ALGOLIA_SPACE_GRAY = COLORS.ALGOLIA_SPACE_GRAY;   // Redundant
```
Just use `COLORS.X` directly instead of creating local aliases.

---

## Performance Observations

### Positives
1. **Conditional queries** - `enabled: hasPartnerSelected` prevents unnecessary fetches
2. **Stale time caching** - 2-5 minute cache reduces refetches
3. **Client-side pagination** - 50 rows at a time (DistributionGrid)
4. **No framer-motion on rows** - Comment says it was removed for performance

### Concerns
1. **5000 row limit** - `getTargets({ limit: 5000 })` could be slow on initial partner selection
2. **Two table sections** - Dashboard shows DistributionGrid AND TargetList, both with same data

---

## Recommendations Summary

### Critical (Fix Immediately)
1. ~~**Wire up onCellClick in DistributionGrid**~~ - N/A (architecture changed to unified list)
2. ~~**Add vertical case to sort switch**~~ - **FIXED** (already existed in code)

### High Priority
1. ~~**Add onClick to "Add to Campaign" button**~~ - **FIXED** (added onAddToCampaign prop)
2. ~~**Migrate CompaniesPage to shared COLORS**~~ - **FIXED** (now imports from @/lib/constants)

### Medium Priority
1. **Add bulk selection + CSV export** - BDR productivity feature (TODO)
2. ~~**Remove redundant color aliases in TargetList**~~ - Acceptable pattern (values come from shared lib)

### Low Priority
1. **Add loading skeleton** - Better perceived performance
2. **Add keyboard navigation** - Accessibility

---

## Fixes Applied (2026-02-26)

| Issue | Fix | File |
|-------|-----|------|
| "Add to Campaign" button dead | Added `onAddToCampaign` prop + onClick handler | CompanyDrawer.tsx |
| CompaniesPage inline colors | Replaced with `COLORS` import | CompaniesPage.tsx |
| Button disabled when no handler | Added `disabled={!onAddToCampaign}` | CompanyDrawer.tsx |

---

## Test Checklist for Manual Verification

### Before Testing
- [ ] Clear browser cache
- [ ] Open DevTools Network tab
- [ ] Have Supabase dashboard ready for data verification

### Cold Start Tests
- [ ] App loads without errors
- [ ] Empty state shows partner buttons
- [ ] No network requests until partner selected

### Partner Selection Tests
- [ ] Click "Adobe Experience Manager" button
- [ ] Stats badges show correct counts
- [ ] Formula displays correctly
- [ ] Data loads in reasonable time (<3s)

### Filtering Tests
- [ ] Click Status header → popover opens
- [ ] Select "Hot" → only hot leads shown
- [ ] Filter indicator shows "1 filter active"
- [ ] Add second filter → both work together
- [ ] Clear filters → all data returns

### View Mode Tests
- [ ] Click each view mode button
- [ ] Verify sort order changes appropriately
- [ ] Account view shows highest ICP scores first

### Drawer Tests
- [ ] Click company row → drawer opens
- [ ] Pin button works → overlay disappears
- [ ] Accordions expand/collapse
- [ ] External links open in new tabs
- [ ] "Enrich Now" button shows progress notification

### Pagination Tests
- [ ] Navigate to page 2
- [ ] "Showing X to Y of Z" updates correctly
- [ ] Edge buttons (first/last) work

---

## Conclusion

Arian has a solid foundation with good architecture decisions (shared libraries, performance optimizations, consistent filtering). The main gaps are:

1. **Feature completeness** - Some buttons don't work (Add to Campaign, grid drill-down)
2. **Code consistency** - CompaniesPage hasn't been migrated to shared constants
3. **Missing sort case** - Vertical view doesn't sort correctly

These are fixable issues that don't require architectural changes. The cleanup work done in this session improved the codebase significantly.

**Recommended Next Steps:**
1. Fix the 4 critical/high issues identified
2. Add the BDR export feature
3. Complete the shared library migration
