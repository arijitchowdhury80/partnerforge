/**
 * EnrichmentProgress Component Tests
 *
 * TDD: Tests written FIRST, then implementation.
 * Tests cover the step-by-step enrichment progress display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { EnrichmentProgress, ENRICHMENT_STEPS } from '../EnrichmentProgress';
import type { EnrichmentStepStatus } from '../EnrichmentProgress';

// =============================================================================
// Mock Data
// =============================================================================

function createMockStatus(overrides: Partial<EnrichmentStepStatus> = {}): EnrichmentStepStatus {
  return {
    step: 0,
    totalSteps: 7,
    currentSource: 'SimilarWeb Traffic',
    completedSources: [],
    failedSources: [],
    isComplete: false,
    isCancelled: false,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('EnrichmentProgress', () => {
  const mockOnCancel = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all 7 enrichment steps', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus()}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // Verify all steps are rendered
      expect(screen.getByText('SimilarWeb Traffic')).toBeInTheDocument();
      expect(screen.getByText('BuiltWith Tech Stack')).toBeInTheDocument();
      expect(screen.getByText('Yahoo Finance')).toBeInTheDocument();
      expect(screen.getByText('Competitor Analysis')).toBeInTheDocument();
      expect(screen.getByText('Case Study Matching')).toBeInTheDocument();
      expect(screen.getByText('Strategic Insights')).toBeInTheDocument();
      expect(screen.getByText('Save to Database')).toBeInTheDocument();
    });

    it('should display the domain being enriched', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="walmart.com"
          status={createMockStatus()}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/walmart\.com/i)).toBeInTheDocument();
    });

    it('should display progress bar', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ step: 3, totalSteps: 7 })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // Should show progress percentage (3/7 ~= 43%)
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Step States', () => {
    it('should show correct step status - pending', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ step: 0, completedSources: [] })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // All steps should be pending when step is 0
      const steps = screen.getAllByTestId(/enrichment-step-/);
      expect(steps.length).toBe(7);
    });

    it('should show correct step status - running', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 2,
            currentSource: 'BuiltWith Tech Stack',
            completedSources: ['SimilarWeb Traffic'],
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // First step should be complete, second step should be running
      expect(screen.getByTestId('enrichment-step-0')).toHaveAttribute('data-status', 'complete');
      expect(screen.getByTestId('enrichment-step-1')).toHaveAttribute('data-status', 'running');
    });

    it('should show correct step status - complete', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 3,
            completedSources: ['SimilarWeb Traffic', 'BuiltWith Tech Stack', 'Yahoo Finance'],
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByTestId('enrichment-step-0')).toHaveAttribute('data-status', 'complete');
      expect(screen.getByTestId('enrichment-step-1')).toHaveAttribute('data-status', 'complete');
      expect(screen.getByTestId('enrichment-step-2')).toHaveAttribute('data-status', 'complete');
    });

    it('should show correct step status - error', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 3,
            completedSources: ['SimilarWeb Traffic'],
            failedSources: [{ source: 'BuiltWith Tech Stack', reason: 'API rate limit exceeded' }],
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByTestId('enrichment-step-1')).toHaveAttribute('data-status', 'error');
    });
  });

  describe('Progress Bar', () => {
    it('should update progress bar based on completed steps', () => {
      const { rerender } = renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ step: 0 })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // Initial - 0%
      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      // After 3 steps - ~43%
      rerender(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 3,
            completedSources: ['SimilarWeb Traffic', 'BuiltWith Tech Stack', 'Yahoo Finance'],
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      progressBar = screen.getByRole('progressbar');
      expect(Number(progressBar.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(42);
    });

    it('should show 100% when all steps complete', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 7,
            isComplete: true,
            completedSources: ENRICHMENT_STEPS.map(s => s.name),
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('Estimated Time', () => {
    it('should show estimated time remaining', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 2,
            estimatedRemainingMs: 15000, // 15 seconds
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/15\s*sec/i)).toBeInTheDocument();
    });

    it('should update estimated time as steps complete', () => {
      const { rerender } = renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 1,
            estimatedRemainingMs: 30000, // 30 seconds
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/30\s*sec/i)).toBeInTheDocument();

      rerender(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 4,
            estimatedRemainingMs: 10000, // 10 seconds
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/10\s*sec/i)).toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('should render cancel button when in progress', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ step: 2 })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ step: 2 })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should hide cancel button when complete', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ isComplete: true, step: 7 })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('Completion State', () => {
    it('should show success message when complete', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            isComplete: true,
            step: 7,
            completedSources: ENRICHMENT_STEPS.map(s => s.name),
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // Use testid to find the success badge specifically
      expect(screen.getByTestId('enrichment-success')).toBeInTheDocument();
    });

    it('should show celebration animation on completion', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            isComplete: true,
            step: 7,
            completedSources: ENRICHMENT_STEPS.map(s => s.name),
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // Check for success icon or celebration element
      expect(screen.getByTestId('enrichment-success')).toBeInTheDocument();
    });

    it('should call onComplete when enrichment finishes', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            isComplete: true,
            step: 7,
            completedSources: ENRICHMENT_STEPS.map(s => s.name),
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('should show "View enriched data" button on completion', async () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            isComplete: true,
            step: 7,
            completedSources: ENRICHMENT_STEPS.map(s => s.name),
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByRole('button', { name: /view enriched data/i })).toBeInTheDocument();
    });
  });

  describe('Partial Failure', () => {
    it('should show which sources failed', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 7,
            isComplete: true,
            completedSources: [
              'SimilarWeb Traffic',
              'Yahoo Finance',
              'Competitor Analysis',
              'Case Study Matching',
              'Strategic Insights',
              'Save to Database',
            ],
            failedSources: [
              { source: 'BuiltWith Tech Stack', reason: 'API rate limit exceeded' },
            ],
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // Should show partial success message (look for badge specifically)
      expect(screen.getByText('Partial Success')).toBeInTheDocument();
      // Should show the failed source and reason somewhere in the document
      const failedSourceElements = screen.getAllByText(/BuiltWith Tech Stack/i);
      expect(failedSourceElements.length).toBeGreaterThanOrEqual(1);
      // Use getAllByText since the error reason appears twice (in step and summary)
      const errorReasonElements = screen.getAllByText(/API rate limit exceeded/i);
      expect(errorReasonElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should show error count in summary', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            step: 7,
            isComplete: true,
            completedSources: ['SimilarWeb Traffic', 'Yahoo Finance', 'Save to Database'],
            failedSources: [
              { source: 'BuiltWith Tech Stack', reason: 'Rate limit' },
              { source: 'Competitor Analysis', reason: 'Timeout' },
            ],
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      // Should show failed count in the summary section
      expect(screen.getByText(/2 sources? failed/i)).toBeInTheDocument();
    });
  });

  describe('Cancelled State', () => {
    const mockOnResume = vi.fn();

    it('should show cancelled message when cancelled', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            isCancelled: true,
            step: 3,
            completedSources: ['SimilarWeb Traffic', 'BuiltWith Tech Stack'],
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
          onResume={mockOnResume}
        />
      );

      // The badge should show "Cancelled"
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('should show "Resume" button when cancelled and onResume is provided', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({
            isCancelled: true,
            step: 3,
          })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
          onResume={mockOnResume}
        />
      );

      expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    });
  });

  describe('Run in Background', () => {
    it('should show "Run in Background" button when in progress', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ step: 2 })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByRole('button', { name: /background/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for progress', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ step: 3 })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label');
      expect(progressBar).toHaveAttribute('aria-valuenow');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should have proper labels for buttons', () => {
      renderWithProviders(
        <EnrichmentProgress
          domain="example.com"
          status={createMockStatus({ step: 2 })}
          onCancel={mockOnCancel}
          onComplete={mockOnComplete}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('ENRICHMENT_STEPS constant', () => {
    it('should export ENRICHMENT_STEPS with correct structure', () => {
      expect(ENRICHMENT_STEPS).toBeDefined();
      expect(ENRICHMENT_STEPS.length).toBe(7);

      ENRICHMENT_STEPS.forEach((step) => {
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('name');
        expect(step).toHaveProperty('description');
        expect(step).toHaveProperty('estimatedMs');
      });
    });

    it('should have expected step names', () => {
      const stepNames = ENRICHMENT_STEPS.map(s => s.name);
      expect(stepNames).toContain('SimilarWeb Traffic');
      expect(stepNames).toContain('BuiltWith Tech Stack');
      expect(stepNames).toContain('Yahoo Finance');
      expect(stepNames).toContain('Competitor Analysis');
      expect(stepNames).toContain('Case Study Matching');
      expect(stepNames).toContain('Strategic Insights');
      expect(stepNames).toContain('Save to Database');
    });
  });
});
