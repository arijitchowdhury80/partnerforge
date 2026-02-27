/**
 * Selection Context
 *
 * Manages bulk selection state for batch operations on companies.
 * Uses useReducer for predictable state updates.
 *
 * Key features:
 * - Select single, all on page, or all matching filters
 * - Track selection count and all/partial states
 * - Provide helper methods for components
 */

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';

// =============================================================================
// Types
// =============================================================================

export interface SelectionState {
  selectedDomains: Set<string>;
  currentPageDomains: string[];  // Domains currently visible on page
}

export interface SelectionDerivedState {
  selectedDomains: Set<string>;
  selectionCount: number;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
}

export interface SelectionActions {
  select: (domain: string) => void;
  deselect: (domain: string) => void;
  toggle: (domain: string) => void;
  selectAll: (domains: string[]) => void;
  selectAllMatching: (domains: string[]) => void;
  clearSelection: () => void;
  isSelected: (domain: string) => boolean;
  setCurrentPageDomains: (domains: string[]) => void;
}

export type SelectionContextValue = SelectionDerivedState & SelectionActions;

// =============================================================================
// Reducer Actions
// =============================================================================

type SelectionAction =
  | { type: 'SELECT'; domain: string }
  | { type: 'DESELECT'; domain: string }
  | { type: 'TOGGLE'; domain: string }
  | { type: 'SELECT_ALL'; domains: string[] }
  | { type: 'SELECT_ALL_MATCHING'; domains: string[] }
  | { type: 'CLEAR' }
  | { type: 'SET_PAGE_DOMAINS'; domains: string[] };

// =============================================================================
// Reducer
// =============================================================================

function selectionReducer(
  state: SelectionState,
  action: SelectionAction
): SelectionState {
  switch (action.type) {
    case 'SELECT': {
      const newSet = new Set(state.selectedDomains);
      newSet.add(action.domain);
      return { ...state, selectedDomains: newSet };
    }

    case 'DESELECT': {
      const newSet = new Set(state.selectedDomains);
      newSet.delete(action.domain);
      return { ...state, selectedDomains: newSet };
    }

    case 'TOGGLE': {
      const newSet = new Set(state.selectedDomains);
      if (newSet.has(action.domain)) {
        newSet.delete(action.domain);
      } else {
        newSet.add(action.domain);
      }
      return { ...state, selectedDomains: newSet };
    }

    case 'SELECT_ALL': {
      // Replace entire selection with provided domains
      return { ...state, selectedDomains: new Set(action.domains) };
    }

    case 'SELECT_ALL_MATCHING': {
      // Add to existing selection (union)
      const newSet = new Set(state.selectedDomains);
      action.domains.forEach((domain) => newSet.add(domain));
      return { ...state, selectedDomains: newSet };
    }

    case 'CLEAR': {
      return { ...state, selectedDomains: new Set<string>() };
    }

    case 'SET_PAGE_DOMAINS': {
      return { ...state, currentPageDomains: action.domains };
    }

    default:
      return state;
  }
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: SelectionState = {
  selectedDomains: new Set<string>(),
  currentPageDomains: [],
};

// =============================================================================
// Context
// =============================================================================

const SelectionContext = createContext<SelectionContextValue | undefined>(
  undefined
);

// =============================================================================
// Provider
// =============================================================================

interface SelectionProviderProps {
  children: ReactNode;
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [state, dispatch] = useReducer(selectionReducer, initialState);

  // Actions
  const select = useCallback((domain: string) => {
    dispatch({ type: 'SELECT', domain });
  }, []);

  const deselect = useCallback((domain: string) => {
    dispatch({ type: 'DESELECT', domain });
  }, []);

  const toggle = useCallback((domain: string) => {
    dispatch({ type: 'TOGGLE', domain });
  }, []);

  const selectAll = useCallback((domains: string[]) => {
    dispatch({ type: 'SELECT_ALL', domains });
  }, []);

  const selectAllMatching = useCallback((domains: string[]) => {
    dispatch({ type: 'SELECT_ALL_MATCHING', domains });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const setCurrentPageDomains = useCallback((domains: string[]) => {
    dispatch({ type: 'SET_PAGE_DOMAINS', domains });
  }, []);

  const isSelected = useCallback(
    (domain: string) => state.selectedDomains.has(domain),
    [state.selectedDomains]
  );

  // Derived state
  const selectionCount = state.selectedDomains.size;

  const isAllSelected = useMemo(() => {
    if (state.currentPageDomains.length === 0) return false;
    return state.currentPageDomains.every((domain) =>
      state.selectedDomains.has(domain)
    );
  }, [state.selectedDomains, state.currentPageDomains]);

  const isPartiallySelected = useMemo(() => {
    if (state.currentPageDomains.length === 0) return false;
    const selectedOnPage = state.currentPageDomains.filter((domain) =>
      state.selectedDomains.has(domain)
    ).length;
    return selectedOnPage > 0 && selectedOnPage < state.currentPageDomains.length;
  }, [state.selectedDomains, state.currentPageDomains]);

  // Memoized context value
  const value: SelectionContextValue = useMemo(
    () => ({
      selectedDomains: state.selectedDomains,
      selectionCount,
      isAllSelected,
      isPartiallySelected,
      select,
      deselect,
      toggle,
      selectAll,
      selectAllMatching,
      clearSelection,
      isSelected,
      setCurrentPageDomains,
    }),
    [
      state.selectedDomains,
      selectionCount,
      isAllSelected,
      isPartiallySelected,
      select,
      deselect,
      toggle,
      selectAll,
      selectAllMatching,
      clearSelection,
      isSelected,
      setCurrentPageDomains,
    ]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}
