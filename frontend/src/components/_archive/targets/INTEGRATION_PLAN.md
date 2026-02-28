# TargetList Integration Plan

## Overview
This document outlines how to integrate all new UX modules into the TargetList component.

## Modules to Integrate

### 1. Selection Context (Module A)
- Import `SelectionProvider` and `useSelection` from `@/contexts/SelectionContext`
- Wrap TargetList or its parent with `SelectionProvider`
- Add checkbox column as first column in table

### 2. Confirmation Modals (Module B)
- Import `EnrichConfirmModal`, `BulkEnrichConfirmModal` from `@/components/modals`
- Add modal state management
- Wire up to enrich button clicks

### 3. Error Handling (Module C)
- Import `ErrorNotification` from `@/components/common/ErrorNotification`
- Integrate with enrichment error states
- Show partial success notifications

### 4. Progress Steps (Module D)
- Import `EnrichmentProgress` from `@/components/company/EnrichmentProgress`
- Add to CompanyDrawer when enriching
- Track enrichment status per company

### 5. Export Modal (Module E)
- Import `ExportModal` from `@/components/modals/ExportModal`
- Wire to bulk action toolbar
- Pass selected companies

## Integration Steps

### Step 1: Add Checkbox Column
```tsx
// Add to columns array (first position)
{
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected()}
      onChange={table.getToggleAllPageRowsSelectedHandler()}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onChange={row.getToggleSelectedHandler()}
    />
  ),
}
```

### Step 2: Add Bulk Action Toolbar
```tsx
// Above table, conditionally rendered when selections exist
{selectionCount > 0 && (
  <BulkActionToolbar
    selectionCount={selectionCount}
    onEnrich={() => setShowBulkEnrichModal(true)}
    onExport={() => setShowExportModal(true)}
    onClear={clearSelection}
  />
)}
```

### Step 3: Wire Modal States
```tsx
const [showEnrichModal, setShowEnrichModal] = useState(false);
const [showBulkEnrichModal, setShowBulkEnrichModal] = useState(false);
const [showExportModal, setShowExportModal] = useState(false);
const [enrichTarget, setEnrichTarget] = useState<{domain: string; name: string} | null>(null);
```

### Step 4: Add Modals to JSX
```tsx
<EnrichConfirmModal
  opened={showEnrichModal}
  domain={enrichTarget?.domain}
  companyName={enrichTarget?.name}
  onConfirm={handleEnrichConfirmed}
  onCancel={() => setShowEnrichModal(false)}
/>

<BulkEnrichConfirmModal
  opened={showBulkEnrichModal}
  selectedCompanies={getSelectedCompanies()}
  onConfirm={handleBulkEnrichConfirmed}
  onCancel={() => setShowBulkEnrichModal(false)}
/>

<ExportModal
  opened={showExportModal}
  companies={getSelectedCompanies()}
  onExport={handleExport}
  onClose={() => setShowExportModal(false)}
/>
```

## Props Changes

### New Props
```typescript
interface TargetListProps {
  // ... existing props

  // Selection (optional - for controlled mode)
  selectedDomains?: Set<string>;
  onSelectionChange?: (domains: Set<string>) => void;

  // Bulk actions
  onBulkEnrich?: (domains: string[]) => Promise<void>;
  onExport?: (domains: string[], options: ExportOptions) => void;
}
```

## Test Integration Points

1. **Selection Tests**
   - Checkbox renders in each row
   - Header checkbox selects all visible
   - Selection count updates correctly
   - "Select all matching" works

2. **Confirm Modal Tests**
   - Modal opens when enrich clicked
   - Confirm triggers enrichment
   - Cancel closes without action

3. **Export Tests**
   - Export button in toolbar
   - Modal shows selected count
   - Download triggers

## Files Modified

1. `components/targets/TargetList.tsx` - Main integration
2. `pages/Dashboard.tsx` - Wrap with SelectionProvider
3. `pages/CompaniesPage.tsx` - Wrap with SelectionProvider

## Files Created (by parallel agents)

1. `contexts/SelectionContext.tsx`
2. `components/modals/EnrichConfirmModal.tsx`
3. `components/modals/BulkEnrichConfirmModal.tsx`
4. `components/modals/DeleteConfirmModal.tsx`
5. `components/modals/ExportModal.tsx`
6. `components/common/ErrorNotification.tsx`
7. `components/company/EnrichmentProgress.tsx`
8. `services/errorHandling.ts`
9. `services/exportService.ts`
