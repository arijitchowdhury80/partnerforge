/**
 * ExportModal Component Tests
 *
 * TDD: These tests are written FIRST, before implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, userEvent, createMockCompany } from '@/test/utils';
import { ExportModal } from '../ExportModal';
import type { Company } from '@/types';

// Mock the export service
vi.mock('@/services/exportService', () => ({
  exportToCSV: vi.fn(() => 'mocked,csv,data'),
  exportToJSON: vi.fn(() => '{"mocked": "json"}'),
  downloadExport: vi.fn(),
  generateFilename: vi.fn((format: string) => `test-export.${format}`),
  EXPORT_PRESETS: {
    salesOutreach: ['company_name', 'domain', 'status', 'icp_score', 'revenue', 'industry', 'partner_tech'],
    fullIntel: ['company_name', 'domain', 'status', 'icp_score', 'revenue', 'industry', 'partner_tech', 'current_search', 'sw_monthly_visits', 'employee_count', 'headquarters', 'ticker'],
    crmImport: ['company_name', 'domain', 'industry', 'revenue', 'employee_count', 'headquarters'],
  },
  EXPORT_COLUMNS: [
    { key: 'company_name', label: 'Company Name' },
    { key: 'domain', label: 'Domain' },
    { key: 'status', label: 'Status' },
    { key: 'icp_score', label: 'ICP Score' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'industry', label: 'Industry' },
    { key: 'partner_tech', label: 'Partner Technology' },
    { key: 'current_search', label: 'Current Search Provider' },
    { key: 'sw_monthly_visits', label: 'Monthly Visits' },
    { key: 'employee_count', label: 'Employee Count' },
    { key: 'headquarters', label: 'Headquarters' },
    { key: 'ticker', label: 'Ticker' },
  ],
}));

const mockExportService = await import('@/services/exportService');

// =============================================================================
// Test Data
// =============================================================================

const mockCompanies: Company[] = [
  createMockCompany({ domain: 'walmart.com', company_name: 'Walmart' }),
  createMockCompany({ domain: 'target.com', company_name: 'Target' }),
  createMockCompany({ domain: 'costco.com', company_name: 'Costco' }),
];

const defaultProps = {
  opened: true,
  onClose: vi.fn(),
  companies: mockCompanies,
  selectedCount: 3,
};

// =============================================================================
// Rendering Tests
// =============================================================================

describe('ExportModal rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with selected count', () => {
    renderWithProviders(<ExportModal {...defaultProps} selectedCount={25} />);

    // Use getAllByText since count appears in badge and summary
    const elements = screen.getAllByText(/25/);
    expect(elements.length).toBeGreaterThan(0);
    // "companies" appears in title and summary, so use getAllByText
    const companiesElements = screen.getAllByText(/companies/i);
    expect(companiesElements.length).toBeGreaterThan(0);
  });

  it('renders when opened is true', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Export Companies/i)).toBeInTheDocument();
  });

  it('does not render when opened is false', () => {
    renderWithProviders(<ExportModal {...defaultProps} opened={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays export format options', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('displays column selection checkboxes', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    expect(screen.getByText('Company Name')).toBeInTheDocument();
    expect(screen.getByText('Domain')).toBeInTheDocument();
    expect(screen.getByText('ICP Score')).toBeInTheDocument();
  });

  it('displays preset chips', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    expect(screen.getByText('Sales Outreach')).toBeInTheDocument();
    expect(screen.getByText('Full Intel')).toBeInTheDocument();
    expect(screen.getByText('CRM Import')).toBeInTheDocument();
  });

  it('displays download and cancel buttons', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});

// =============================================================================
// Format Selection Tests
// =============================================================================

describe('ExportModal format selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CSV is selected by default', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    const csvRadio = screen.getByLabelText('CSV');
    expect(csvRadio).toBeChecked();
  });

  it('allows selecting Excel format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const excelRadio = screen.getByLabelText('Excel');
    await user.click(excelRadio);

    expect(excelRadio).toBeChecked();
  });

  it('allows selecting JSON format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const jsonRadio = screen.getByLabelText('JSON');
    await user.click(jsonRadio);

    expect(jsonRadio).toBeChecked();
  });

  it('only one format can be selected at a time', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const csvRadio = screen.getByLabelText('CSV');
    const jsonRadio = screen.getByLabelText('JSON');

    await user.click(jsonRadio);

    expect(jsonRadio).toBeChecked();
    expect(csvRadio).not.toBeChecked();
  });
});

// =============================================================================
// Column Selection Tests
// =============================================================================

describe('ExportModal column selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has default columns pre-selected', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    // Sales Outreach preset should be default
    const companyNameCheckbox = screen.getByRole('checkbox', { name: /company name/i });
    const domainCheckbox = screen.getByRole('checkbox', { name: /domain/i });

    expect(companyNameCheckbox).toBeChecked();
    expect(domainCheckbox).toBeChecked();
  });

  it('column checkboxes are interactive', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const tickerCheckbox = screen.getByRole('checkbox', { name: /ticker/i });

    // Initially might be unchecked (not in default preset)
    await user.click(tickerCheckbox);
    expect(tickerCheckbox).toBeChecked();

    await user.click(tickerCheckbox);
    expect(tickerCheckbox).not.toBeChecked();
  });

  it('select all button selects all columns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    await user.click(selectAllButton);

    // Check specific checkboxes rather than all (since radios are also inputs)
    const companyNameCheckbox = screen.getByRole('checkbox', { name: /company name/i });
    const tickerCheckbox = screen.getByRole('checkbox', { name: /ticker/i });
    const headquartersCheckbox = screen.getByRole('checkbox', { name: /headquarters/i });

    expect(companyNameCheckbox).toBeChecked();
    expect(tickerCheckbox).toBeChecked();
    expect(headquartersCheckbox).toBeChecked();
  });

  it('clear all button deselects all columns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const clearAllButton = screen.getByRole('button', { name: /clear all/i });
    await user.click(clearAllButton);

    const companyNameCheckbox = screen.getByRole('checkbox', { name: /company name/i });
    const domainCheckbox = screen.getByRole('checkbox', { name: /domain/i });

    expect(companyNameCheckbox).not.toBeChecked();
    expect(domainCheckbox).not.toBeChecked();
  });
});

// =============================================================================
// Preset Selection Tests
// =============================================================================

describe('ExportModal preset selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Sales Outreach preset selects correct columns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    // Clear first, then select preset
    const clearAllButton = screen.getByRole('button', { name: /clear all/i });
    await user.click(clearAllButton);

    // Find the chip by text and click it
    const salesOutreachChip = screen.getByText('Sales Outreach');
    await user.click(salesOutreachChip);

    // Check that preset columns are selected
    expect(screen.getByRole('checkbox', { name: /company name/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /domain/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /status/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /icp score/i })).toBeChecked();
  });

  it('Full Intel preset selects all intelligence columns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const fullIntelChip = screen.getByText('Full Intel');
    await user.click(fullIntelChip);

    // Full Intel should include technical columns
    expect(screen.getByRole('checkbox', { name: /current search provider/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /monthly visits/i })).toBeChecked();
  });

  it('CRM Import preset selects CRM-friendly columns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const crmImportChip = screen.getByText('CRM Import');
    await user.click(crmImportChip);

    expect(screen.getByRole('checkbox', { name: /company name/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /headquarters/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /employee count/i })).toBeChecked();
  });

  it('preset chips have visual indication when active', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    // Sales Outreach should be active by default
    const salesOutreachChip = screen.getByText('Sales Outreach').closest('[data-checked]');
    expect(salesOutreachChip).toHaveAttribute('data-checked', 'true');
  });
});

// =============================================================================
// Download Action Tests
// =============================================================================

describe('ExportModal download action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('download button triggers export with selected options', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);

    expect(mockExportService.exportToCSV).toHaveBeenCalled();
    expect(mockExportService.downloadExport).toHaveBeenCalled();
  });

  it('download button is disabled when no columns selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    // Clear all columns
    const clearAllButton = screen.getByRole('button', { name: /clear all/i });
    await user.click(clearAllButton);

    const downloadButton = screen.getByRole('button', { name: /download/i });
    expect(downloadButton).toBeDisabled();
  });

  it('exports to JSON when JSON format is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    const jsonRadio = screen.getByLabelText('JSON');
    await user.click(jsonRadio);

    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);

    expect(mockExportService.exportToJSON).toHaveBeenCalled();
  });

  it('passes only selected columns to export function', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} />);

    // Clear all and select just company_name and domain
    const clearAllButton = screen.getByRole('button', { name: /clear all/i });
    await user.click(clearAllButton);

    await user.click(screen.getByRole('checkbox', { name: /company name/i }));
    await user.click(screen.getByRole('checkbox', { name: /domain/i }));

    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);

    expect(mockExportService.exportToCSV).toHaveBeenCalledWith(
      mockCompanies,
      expect.objectContaining({
        columns: expect.arrayContaining(['company_name', 'domain']),
      })
    );
  });
});

// =============================================================================
// Cancel/Close Tests
// =============================================================================

describe('ExportModal close behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancel button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('closes modal after successful download', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} onClose={onClose} />);

    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('clicking overlay closes the modal', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...defaultProps} onClose={onClose} />);

    // Find and click the overlay
    const overlay = document.querySelector('.mantine-Modal-overlay');
    if (overlay) {
      await user.click(overlay);
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    }
  });
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('ExportModal accessibility', () => {
  it('modal has proper ARIA attributes', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('format radios have proper grouping', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toBeInTheDocument();
  });

  it('checkboxes have accessible labels', () => {
    renderWithProviders(<ExportModal {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAccessibleName();
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('ExportModal edge cases', () => {
  it('handles empty companies array', () => {
    renderWithProviders(<ExportModal {...defaultProps} companies={[]} selectedCount={0} />);

    // Zero appears in multiple places
    const badgeContainer = document.querySelector('.mantine-Badge-label');
    expect(badgeContainer?.textContent).toContain('0');
  });

  it('handles large number of companies', () => {
    const largeList = Array.from({ length: 5000 }, (_, i) =>
      createMockCompany({ domain: `company${i}.com`, company_name: `Company ${i}` })
    );

    renderWithProviders(
      <ExportModal {...defaultProps} companies={largeList} selectedCount={5000} />
    );

    // Check the badge contains the formatted number
    const badgeContainer = document.querySelector('.mantine-Badge-label');
    expect(badgeContainer?.textContent).toMatch(/5,?000/);
  });
});
