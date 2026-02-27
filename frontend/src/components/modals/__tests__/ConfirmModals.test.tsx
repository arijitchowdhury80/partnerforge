/**
 * Confirmation Modals Test Suite
 *
 * TDD tests for EnrichConfirmModal, DeleteConfirmModal, and BulkEnrichConfirmModal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils';
import {
  EnrichConfirmModal,
  DeleteConfirmModal,
  BulkEnrichConfirmModal,
} from '../index';
import type { Company } from '@/types';

// =============================================================================
// Mock Data
// =============================================================================

const mockCompany: Company = {
  domain: 'example.com',
  company_name: 'Example Corp',
  industry: 'Technology',
  vertical: 'SaaS',
  icp_score: 85,
  signal_score: 70,
  priority_score: 78,
  status: 'hot',
  is_public: true,
  headquarters: { city: 'San Francisco', state: 'CA', country: 'United States' },
};

const mockCompanies: Company[] = [
  { ...mockCompany, domain: 'example1.com', company_name: 'Example 1' },
  { ...mockCompany, domain: 'example2.com', company_name: 'Example 2', enrichment_level: 'basic' },
  { ...mockCompany, domain: 'example3.com', company_name: 'Example 3', enrichment_level: 'deep' },
];

// =============================================================================
// EnrichConfirmModal Tests
// =============================================================================

describe('EnrichConfirmModal', () => {
  const defaultProps = {
    opened: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    companyName: 'Example Corp',
    domain: 'example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with company name and domain', () => {
    renderWithProviders(<EnrichConfirmModal {...defaultProps} />);

    expect(screen.getByText(/example corp/i)).toBeInTheDocument();
    expect(screen.getByText(/example\.com/i)).toBeInTheDocument();
  });

  it('shows API credit warning', () => {
    renderWithProviders(<EnrichConfirmModal {...defaultProps} />);

    expect(screen.getByText(/api credits/i)).toBeInTheDocument();
  });

  it('cancel button closes modal without calling onConfirm', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EnrichConfirmModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('confirm button calls onConfirm with domain', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EnrichConfirmModal {...defaultProps} />);

    const confirmButton = screen.getByRole('button', { name: /enrich/i });
    await user.click(confirmButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith('example.com');
  });

  it('"Don\'t ask again" checkbox works', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EnrichConfirmModal {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: /don't ask again/i });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    // Confirm with checkbox checked should pass the preference
    const confirmButton = screen.getByRole('button', { name: /enrich/i });
    await user.click(confirmButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith('example.com', true);
  });

  it('disabled state during loading', () => {
    renderWithProviders(<EnrichConfirmModal {...defaultProps} loading />);

    const confirmButton = screen.getByRole('button', { name: /enriching/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('does not render when opened is false', () => {
    renderWithProviders(<EnrichConfirmModal {...defaultProps} opened={false} />);

    expect(screen.queryByText(/example corp/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
// DeleteConfirmModal Tests
// =============================================================================

describe('DeleteConfirmModal', () => {
  const defaultProps = {
    opened: true,
    onClose: vi.fn(),
    onDelete: vi.fn(),
    itemName: 'Example Corp',
    itemType: 'company' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with item name', () => {
    renderWithProviders(<DeleteConfirmModal {...defaultProps} />);

    expect(screen.getByText(/example corp/i)).toBeInTheDocument();
    // Check for the modal title "Delete company"
    expect(screen.getByText(/delete company/i)).toBeInTheDocument();
  });

  it('delete button is disabled until user types "DELETE"', () => {
    renderWithProviders(<DeleteConfirmModal {...defaultProps} />);

    const deleteButton = screen.getByRole('button', { name: /^delete$/i });
    expect(deleteButton).toBeDisabled();
  });

  it('cancel closes without calling onDelete', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteConfirmModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onDelete).not.toHaveBeenCalled();
  });

  it('typing DELETE enables the button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteConfirmModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/type delete/i);
    const deleteButton = screen.getByRole('button', { name: /^delete$/i });

    expect(deleteButton).toBeDisabled();

    await user.type(input, 'DELETE');

    expect(deleteButton).toBeEnabled();
  });

  it('confirm calls onDelete', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteConfirmModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/type delete/i);
    await user.type(input, 'DELETE');

    const deleteButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(deleteButton);

    expect(defaultProps.onDelete).toHaveBeenCalled();
  });

  it('typing is case-insensitive', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteConfirmModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/type delete/i);
    const deleteButton = screen.getByRole('button', { name: /^delete$/i });

    await user.type(input, 'delete');

    expect(deleteButton).toBeEnabled();
  });

  it('shows warning icon', () => {
    renderWithProviders(<DeleteConfirmModal {...defaultProps} />);

    // The warning icon should be present (IconAlertTriangle)
    expect(screen.getByTestId('delete-warning-icon')).toBeInTheDocument();
  });
});

// =============================================================================
// BulkEnrichConfirmModal Tests
// =============================================================================

describe('BulkEnrichConfirmModal', () => {
  const defaultProps = {
    opened: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    companies: mockCompanies,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows count of selected companies', () => {
    renderWithProviders(<BulkEnrichConfirmModal {...defaultProps} />);

    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/companies/i)).toBeInTheDocument();
  });

  it('shows breakdown: new vs re-enrich', () => {
    renderWithProviders(<BulkEnrichConfirmModal {...defaultProps} />);

    // 1 company has no enrichment_level (new), 2 have enrichment (re-enrich)
    expect(screen.getByText(/new enrichments/i)).toBeInTheDocument();
    expect(screen.getByText(/re-enrichments/i)).toBeInTheDocument();
  });

  it('shows estimated time and API calls', () => {
    renderWithProviders(<BulkEnrichConfirmModal {...defaultProps} />);

    // Each company takes ~3 API calls (SimilarWeb, BuiltWith, etc.)
    expect(screen.getByText(/estimated time/i)).toBeInTheDocument();
    expect(screen.getByText(/api calls/i)).toBeInTheDocument();
  });

  it('cancel works correctly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BulkEnrichConfirmModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('confirm works correctly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BulkEnrichConfirmModal {...defaultProps} />);

    const confirmButton = screen.getByRole('button', { name: /enrich all/i });
    await user.click(confirmButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith(mockCompanies);
  });

  it('shows loading state', () => {
    renderWithProviders(<BulkEnrichConfirmModal {...defaultProps} loading />);

    const confirmButton = screen.getByRole('button', { name: /enriching/i });
    expect(confirmButton).toBeDisabled();
  });

  it('shows API credit warning', () => {
    renderWithProviders(<BulkEnrichConfirmModal {...defaultProps} />);

    expect(screen.getByText(/api credits/i)).toBeInTheDocument();
  });

  it('handles empty companies array', () => {
    renderWithProviders(<BulkEnrichConfirmModal {...defaultProps} companies={[]} />);

    // Look for the specific count using testId
    const countElement = screen.getByTestId('companies-count');
    expect(countElement).toHaveTextContent('0');
    expect(screen.getByText(/companies selected for enrichment/i)).toBeInTheDocument();

    // Confirm button should be disabled when no companies
    const confirmButton = screen.getByRole('button', { name: /enrich all/i });
    expect(confirmButton).toBeDisabled();
  });
});
