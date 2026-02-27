/**
 * ErrorNotification Component Test Suite
 *
 * Tests for the ErrorNotification component that displays user-friendly error messages.
 * TDD approach: These tests are written BEFORE the implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { ErrorNotification } from '../ErrorNotification';
import type { EnrichmentError } from '@/services/errorHandling';

// Helper to create mock EnrichmentError
function createMockError(overrides: Partial<EnrichmentError> = {}): EnrichmentError {
  return {
    type: 'unknown',
    message: 'Original error message',
    userMessage: 'Something went wrong. Please try again.',
    suggestedActions: ['Try again later', 'Contact support'],
    errorCode: 'ERR-UNKNOWN-ABC123',
    ...overrides,
  };
}

describe('ErrorNotification', () => {
  const defaultProps = {
    error: createMockError(),
    onRetry: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('basic rendering', () => {
    it('should render error message', () => {
      renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });

    it('should render error code', () => {
      renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      expect(screen.getByText(/ERR-UNKNOWN-ABC123/)).toBeInTheDocument();
    });

    it('should render error title based on type', () => {
      const error = createMockError({ type: 'network' });
      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      expect(screen.getByText(/network/i)).toBeInTheDocument();
    });

    it('should render suggested actions as buttons', () => {
      renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      expect(screen.getByRole('button', { name: /try again later/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /contact support/i })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Button Interactions
  // ============================================================================
  describe('button interactions', () => {
    it('should call onRetry when retry button is clicked', async () => {
      const onRetry = vi.fn();
      renderWithProviders(
        <ErrorNotification {...defaultProps} onRetry={onRetry} />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onDismiss when dismiss button is clicked', async () => {
      const onDismiss = vi.fn();
      renderWithProviders(
        <ErrorNotification {...defaultProps} onDismiss={onDismiss} />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await userEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should call onDismiss when close icon is clicked', async () => {
      const onDismiss = vi.fn();
      renderWithProviders(
        <ErrorNotification {...defaultProps} onDismiss={onDismiss} />
      );

      const closeButton = screen.getByLabelText(/close/i);
      await userEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should hide retry button when onRetry is not provided', () => {
      renderWithProviders(
        <ErrorNotification
          error={defaultProps.error}
          onDismiss={defaultProps.onDismiss}
        />
      );

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Partial Success Display
  // ============================================================================
  describe('partial success display', () => {
    it('should show completed sources', () => {
      const error = createMockError({
        type: 'partial_success',
        userMessage: 'Enrichment partially completed.',
        completedSources: ['SimilarWeb', 'BuiltWith'],
        failedSources: [{ source: 'YahooFinance', reason: 'API timeout' }],
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      expect(screen.getByText(/similarweb/i)).toBeInTheDocument();
      expect(screen.getByText(/builtwith/i)).toBeInTheDocument();
    });

    it('should show failed sources with reasons', () => {
      const error = createMockError({
        type: 'partial_success',
        userMessage: 'Enrichment partially completed.',
        completedSources: ['SimilarWeb'],
        failedSources: [
          { source: 'YahooFinance', reason: 'API timeout' },
          { source: 'WebSearch', reason: 'Rate limited' },
        ],
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      expect(screen.getByText(/yahoofinance/i)).toBeInTheDocument();
      expect(screen.getByText(/api timeout/i)).toBeInTheDocument();
      expect(screen.getByText(/websearch/i)).toBeInTheDocument();
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    });

    it('should show count of completed vs failed sources', () => {
      const error = createMockError({
        type: 'partial_success',
        userMessage: 'Enrichment partially completed.',
        completedSources: ['SimilarWeb', 'BuiltWith'],
        failedSources: [{ source: 'YahooFinance', reason: 'Failed' }],
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should show "2 succeeded" and "1 failed" or similar
      expect(screen.getByText(/2.*succeeded|2.*completed/i)).toBeInTheDocument();
      expect(screen.getByText(/1.*failed/i)).toBeInTheDocument();
    });

    it('should display success indicator for completed sources', () => {
      const error = createMockError({
        type: 'partial_success',
        completedSources: ['SimilarWeb'],
        failedSources: [{ source: 'BuiltWith', reason: 'Failed' }],
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should have visual indicators (check marks, colors, etc.)
      const similarWebElement = screen.getByText(/similarweb/i);
      expect(similarWebElement).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Rate Limit Display
  // ============================================================================
  describe('rate limit display', () => {
    it('should show retry timer for rate limit errors', () => {
      const error = createMockError({
        type: 'rate_limit',
        userMessage: 'Too many requests. Please wait.',
        retryAfter: 60,
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // The component shows a badge with "Retry available in X minute(s)"
      expect(screen.getByText(/retry available in/i)).toBeInTheDocument();
    });

    it('should disable retry button during rate limit cooldown', () => {
      const error = createMockError({
        type: 'rate_limit',
        userMessage: 'Too many requests.',
        retryAfter: 30,
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeDisabled();
    });
  });

  // ============================================================================
  // Copy Error Code
  // ============================================================================
  describe('copy error code', () => {
    it('should have a copy button for error code', () => {
      renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      const copyButton = screen.getByRole('button', { name: /copy.*code|copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('should copy error code to clipboard when clicked', async () => {
      // Mock clipboard API
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      const copyButton = screen.getByRole('button', { name: /copy.*code|copy/i });
      await userEvent.click(copyButton);

      expect(writeText).toHaveBeenCalledWith('ERR-UNKNOWN-ABC123');
    });

    it('should show feedback after copying', async () => {
      // Mock clipboard API
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      const copyButton = screen.getByRole('button', { name: /copy.*code|copy/i });
      await userEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Error Types Visual Distinction
  // ============================================================================
  describe('error types visual distinction', () => {
    it('should render network error with appropriate styling', () => {
      const error = createMockError({
        type: 'network',
        userMessage: 'Please check your connection.',
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should have network-specific title "Network Error"
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });

    it('should render auth error with appropriate styling', () => {
      const error = createMockError({
        type: 'auth',
        userMessage: 'Your API key is invalid.',
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should have auth-specific title "Authentication Error"
      expect(screen.getByText('Authentication Error')).toBeInTheDocument();
    });

    it('should render rate limit error with appropriate styling', () => {
      const error = createMockError({
        type: 'rate_limit',
        userMessage: 'Please slow down your requests.',
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should have rate-limit-specific title "Rate Limit Exceeded"
      expect(screen.getByText('Rate Limit Exceeded')).toBeInTheDocument();
    });

    it('should render partial success with warning styling', () => {
      const error = createMockError({
        type: 'partial_success',
        userMessage: 'Some sources completed.',
        completedSources: ['A'],
        failedSources: [{ source: 'B', reason: 'Failed' }],
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should have partial-success-specific title
      expect(screen.getByText(/partial/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Action Buttons
  // ============================================================================
  describe('action buttons from suggested actions', () => {
    it('should render suggested actions as clickable items', async () => {
      const onAction = vi.fn();
      const error = createMockError({
        suggestedActions: ['Check connection', 'Refresh page'],
      });

      renderWithProviders(
        <ErrorNotification
          {...defaultProps}
          error={error}
          onAction={onAction}
        />
      );

      const checkButton = screen.getByRole('button', { name: /check connection/i });
      await userEvent.click(checkButton);

      expect(onAction).toHaveBeenCalledWith('Check connection');
    });

    it('should not render action buttons if suggestedActions is empty', () => {
      const error = createMockError({
        suggestedActions: [],
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should only have retry, dismiss, close, and copy buttons (no action buttons)
      const buttons = screen.getAllByRole('button');
      // retry, dismiss, close icon, copy button = 4 buttons max
      expect(buttons.length).toBeLessThanOrEqual(4);
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================
  describe('accessibility', () => {
    it('should have role alert for error notifications', () => {
      renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have accessible labels for buttons', () => {
      renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should announce error to screen readers', () => {
      const { container } = renderWithProviders(
        <ErrorNotification {...defaultProps} />
      );

      // Should have aria-live or role="alert" for screen reader announcement
      const alert = container.querySelector('[role="alert"], [aria-live]');
      expect(alert).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle long error messages gracefully', () => {
      const error = createMockError({
        userMessage: 'A'.repeat(500), // Very long message
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should render without breaking layout
      const messageElement = screen.getByText(/^A+$/);
      expect(messageElement).toBeInTheDocument();
    });

    it('should handle many suggested actions', () => {
      const error = createMockError({
        suggestedActions: [
          'Action 1',
          'Action 2',
          'Action 3',
          'Action 4',
          'Action 5',
        ],
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should limit or scroll actions
      const actionButtons = screen.getAllByRole('button');
      expect(actionButtons.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle empty completedSources and failedSources', () => {
      const error = createMockError({
        type: 'partial_success',
        completedSources: [],
        failedSources: [],
      });

      renderWithProviders(
        <ErrorNotification {...defaultProps} error={error} />
      );

      // Should not crash and should render normally
      expect(screen.getByText(error.userMessage)).toBeInTheDocument();
    });
  });
});
