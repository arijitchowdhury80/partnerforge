/**
 * SelectionContext Tests
 *
 * TDD: Tests written FIRST, then implementation.
 * Tests cover all selection operations for bulk actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { SelectionProvider, useSelection } from '../SelectionContext';

// Wrapper for testing hooks
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SelectionProvider>{children}</SelectionProvider>
);

describe('SelectionContext', () => {
  describe('Initial State', () => {
    it('should have empty selection initially', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      expect(result.current.selectedDomains.size).toBe(0);
      expect(result.current.selectionCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isPartiallySelected).toBe(false);
    });
  });

  describe('Single Selection', () => {
    it('should select a single company', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('example.com');
      });

      expect(result.current.selectedDomains.has('example.com')).toBe(true);
      expect(result.current.selectionCount).toBe(1);
      expect(result.current.isSelected('example.com')).toBe(true);
    });

    it('should not duplicate selection when selecting same domain twice', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('example.com');
        result.current.select('example.com');
      });

      expect(result.current.selectionCount).toBe(1);
    });

    it('should deselect a single company', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('example.com');
      });
      expect(result.current.isSelected('example.com')).toBe(true);

      act(() => {
        result.current.deselect('example.com');
      });

      expect(result.current.isSelected('example.com')).toBe(false);
      expect(result.current.selectionCount).toBe(0);
    });

    it('should handle deselecting a non-selected domain gracefully', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.deselect('nonexistent.com');
      });

      expect(result.current.selectionCount).toBe(0);
    });
  });

  describe('Toggle Selection', () => {
    it('should toggle selection from unselected to selected', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.toggle('example.com');
      });

      expect(result.current.isSelected('example.com')).toBe(true);
    });

    it('should toggle selection from selected to unselected', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('example.com');
      });
      expect(result.current.isSelected('example.com')).toBe(true);

      act(() => {
        result.current.toggle('example.com');
      });

      expect(result.current.isSelected('example.com')).toBe(false);
    });
  });

  describe('Bulk Selection', () => {
    it('should select all provided companies', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });
      const domains = ['example1.com', 'example2.com', 'example3.com'];

      act(() => {
        result.current.selectAll(domains);
      });

      expect(result.current.selectionCount).toBe(3);
      domains.forEach((domain) => {
        expect(result.current.isSelected(domain)).toBe(true);
      });
    });

    it('should replace existing selection when selectAll is called', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('initial.com');
      });
      expect(result.current.selectionCount).toBe(1);

      act(() => {
        result.current.selectAll(['new1.com', 'new2.com']);
      });

      expect(result.current.selectionCount).toBe(2);
      expect(result.current.isSelected('initial.com')).toBe(false);
      expect(result.current.isSelected('new1.com')).toBe(true);
      expect(result.current.isSelected('new2.com')).toBe(true);
    });

    it('should handle empty array in selectAll', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('example.com');
      });
      expect(result.current.selectionCount).toBe(1);

      act(() => {
        result.current.selectAll([]);
      });

      expect(result.current.selectionCount).toBe(0);
    });
  });

  describe('Select All Matching', () => {
    it('should add matching domains to existing selection', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('existing.com');
      });
      expect(result.current.selectionCount).toBe(1);

      act(() => {
        result.current.selectAllMatching(['new1.com', 'new2.com']);
      });

      expect(result.current.selectionCount).toBe(3);
      expect(result.current.isSelected('existing.com')).toBe(true);
      expect(result.current.isSelected('new1.com')).toBe(true);
      expect(result.current.isSelected('new2.com')).toBe(true);
    });

    it('should not duplicate domains when selectAllMatching includes already selected', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('duplicate.com');
      });

      act(() => {
        result.current.selectAllMatching(['duplicate.com', 'new.com']);
      });

      expect(result.current.selectionCount).toBe(2);
    });
  });

  describe('Clear Selection', () => {
    it('should clear all selections', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.selectAll(['a.com', 'b.com', 'c.com']);
      });
      expect(result.current.selectionCount).toBe(3);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectionCount).toBe(0);
      expect(result.current.selectedDomains.size).toBe(0);
    });

    it('should handle clearing an already empty selection', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectionCount).toBe(0);
    });
  });

  describe('Selection Count', () => {
    it('should accurately track selection count', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      expect(result.current.selectionCount).toBe(0);

      act(() => {
        result.current.select('a.com');
      });
      expect(result.current.selectionCount).toBe(1);

      act(() => {
        result.current.select('b.com');
      });
      expect(result.current.selectionCount).toBe(2);

      act(() => {
        result.current.deselect('a.com');
      });
      expect(result.current.selectionCount).toBe(1);

      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectionCount).toBe(0);
    });
  });

  describe('isSelected Helper', () => {
    it('should return true for selected domains', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.selectAll(['a.com', 'b.com']);
      });

      expect(result.current.isSelected('a.com')).toBe(true);
      expect(result.current.isSelected('b.com')).toBe(true);
    });

    it('should return false for non-selected domains', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('a.com');
      });

      expect(result.current.isSelected('notselected.com')).toBe(false);
    });
  });

  describe('All/Partial Selection States', () => {
    it('should update isAllSelected when setCurrentPageDomains is set', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });
      const pageDomains = ['a.com', 'b.com', 'c.com'];

      act(() => {
        result.current.setCurrentPageDomains(pageDomains);
      });

      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isPartiallySelected).toBe(false);

      act(() => {
        result.current.selectAll(pageDomains);
      });

      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.isPartiallySelected).toBe(false);
    });

    it('should show isPartiallySelected when some but not all are selected', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });
      const pageDomains = ['a.com', 'b.com', 'c.com'];

      act(() => {
        result.current.setCurrentPageDomains(pageDomains);
        result.current.select('a.com');
      });

      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isPartiallySelected).toBe(true);
    });

    it('should not show partially selected when nothing is selected', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.setCurrentPageDomains(['a.com', 'b.com', 'c.com']);
      });

      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isPartiallySelected).toBe(false);
    });
  });

  describe('useSelection Hook Error Handling', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSelection());
      }).toThrow('useSelection must be used within a SelectionProvider');

      consoleSpy.mockRestore();
    });
  });
});
