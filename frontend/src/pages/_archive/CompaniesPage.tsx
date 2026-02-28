/**
 * CompaniesPage - Focused Company List View
 *
 * A dedicated page for browsing displacement targets with Excel-style
 * column filtering. All filters are in the table column headers.
 *
 * Updated: White theme to match Dashboard
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Button,
  TextInput,
  Tooltip,
  ActionIcon,
  Select,
} from '@mantine/core';
import {
  IconSearch,
  IconUpload,
  IconDownload,
  IconX,
  IconFilter,
  IconChevronDown,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { getCompanies } from '@/services/api';
import { TargetList, type ColumnFilter } from '@/components/targets/TargetList';
import { ExportModal } from '@/components/modals/ExportModal';
import { COLORS } from '@/lib/constants';
import { uploadFile } from '@/services/uploadService';
import { notifications } from '@mantine/notifications';
import type { Company } from '@/types';

// =============================================================================
// Companies Page Component
// =============================================================================

// =============================================================================
// URL Filter Helpers
// =============================================================================

/**
 * Parse URL search params into ColumnFilter array
 * URL format: ?status=hot,warm&vertical=Retail&partner=Adobe&search=walmart&page=2
 */
function parseUrlFilters(searchParams: URLSearchParams): {
  columnFilters: ColumnFilter[];
  searchQuery: string;
  currentPage: number;
} {
  const columnFilters: ColumnFilter[] = [];

  // Parse status filter (comma-separated)
  const status = searchParams.get('status');
  if (status) {
    columnFilters.push({ column: 'status', values: status.split(',').filter(Boolean) });
  }

  // Parse vertical filter (comma-separated)
  const vertical = searchParams.get('vertical');
  if (vertical) {
    columnFilters.push({ column: 'vertical', values: vertical.split(',').filter(Boolean) });
  }

  // Parse partner filter (comma-separated)
  const partner = searchParams.get('partner');
  if (partner) {
    columnFilters.push({ column: 'partner_tech', values: partner.split(',').filter(Boolean) });
  }

  // Parse search query
  const searchQuery = searchParams.get('search') || '';

  // Parse page number
  const page = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = isNaN(page) || page < 1 ? 1 : page;

  return { columnFilters, searchQuery, currentPage };
}

/**
 * Serialize filter state to URL search params
 */
function serializeFiltersToUrl(
  columnFilters: ColumnFilter[],
  searchQuery: string,
  currentPage: number
): URLSearchParams {
  const params = new URLSearchParams();

  // Serialize status filter
  const statusFilter = columnFilters.find((f) => f.column === 'status');
  if (statusFilter?.values.length) {
    params.set('status', statusFilter.values.join(','));
  }

  // Serialize vertical filter
  const verticalFilter = columnFilters.find((f) => f.column === 'vertical');
  if (verticalFilter?.values.length) {
    params.set('vertical', verticalFilter.values.join(','));
  }

  // Serialize partner filter
  const partnerFilter = columnFilters.find((f) => f.column === 'partner_tech');
  if (partnerFilter?.values.length) {
    params.set('partner', partnerFilter.values.join(','));
  }

  // Serialize search query
  if (searchQuery.trim()) {
    params.set('search', searchQuery.trim());
  }

  // Serialize page (only if not page 1)
  if (currentPage > 1) {
    params.set('page', String(currentPage));
  }

  return params;
}

// =============================================================================
// Companies Page Component
// =============================================================================

export function CompaniesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse initial state from URL
  const initialState = useMemo(() => parseUrlFilters(searchParams), []);

  // Filter state (initialized from URL)
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>(initialState.columnFilters);
  const [currentPage, setCurrentPage] = useState(initialState.currentPage);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);

  // Sync state changes back to URL
  useEffect(() => {
    const newParams = serializeFiltersToUrl(columnFilters, searchQuery, currentPage);
    const currentParamsString = searchParams.toString();
    const newParamsString = newParams.toString();

    // Only update URL if params actually changed (avoid infinite loops)
    if (currentParamsString !== newParamsString) {
      setSearchParams(newParams, { replace: true });
    }
  }, [columnFilters, searchQuery, currentPage, searchParams, setSearchParams]);

  // Build API filters from column filters
  const apiFilters = useMemo(() => {
    const base: {
      sort_by: 'icp_score' | 'traffic' | 'revenue' | 'name';
      sort_order: 'asc' | 'desc';
      page: number;
      limit: number;
      status?: 'hot' | 'warm' | 'cold';
      partner?: string;
      vertical?: string;
      search?: string;
    } = {
      sort_by: 'icp_score',
      sort_order: 'desc',
      page: currentPage,
      limit: 50, // Fetch more for local filtering
    };

    // Add search filter
    if (searchQuery.trim()) {
      base.search = searchQuery.trim();
    }

    // Add status filter (API only supports single status)
    const statusFilter = columnFilters.find((f) => f.column === 'status');
    if (statusFilter?.values.length === 1) {
      base.status = statusFilter.values[0] as 'hot' | 'warm' | 'cold';
    }

    // Add vertical filter (API only supports single vertical)
    const verticalFilter = columnFilters.find((f) => f.column === 'vertical');
    if (verticalFilter?.values.length === 1) {
      base.vertical = verticalFilter.values[0];
    }

    // Add partner tech filter (API only supports single partner)
    const partnerFilter = columnFilters.find((f) => f.column === 'partner_tech');
    if (partnerFilter?.values.length === 1) {
      base.partner = partnerFilter.values[0];
    }

    return base;
  }, [searchQuery, columnFilters, currentPage]);

  // Fetch companies
  const { data: companiesData, isLoading, refetch } = useQuery({
    queryKey: ['companies', apiFilters],
    queryFn: () => getCompanies(apiFilters),
  });

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const result = await uploadFile(file, {
        listName: file.name.replace(/\.(csv|xlsx|xls)$/i, ''),
        partnerTech: '',
        source: 'manual',
      });

      if (result.success) {
        notifications.show({
          title: 'Upload Complete',
          message: `Added ${result.insertedRows} companies`,
          color: 'green',
        });
        refetch();
      } else {
        notifications.show({
          title: 'Upload Failed',
          message: result.errors[0]?.message || 'Unknown error',
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Upload Failed',
        message: err instanceof Error ? err.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Apply local filtering for multi-select scenarios (API only supports single values)
  const filteredCompanies = useMemo(() => {
    if (!companiesData?.data) return [];

    let result = companiesData.data;

    // Apply multi-status filter locally
    const statusFilter = columnFilters.find((f) => f.column === 'status');
    if (statusFilter && statusFilter.values.length > 1) {
      result = result.filter((c) => statusFilter.values.includes(c.status));
    }

    // Apply multi-vertical filter locally
    const verticalFilter = columnFilters.find((f) => f.column === 'vertical');
    if (verticalFilter && verticalFilter.values.length > 1) {
      result = result.filter((c) =>
        verticalFilter.values.includes(c.vertical || '')
      );
    }

    // Apply multi-partner filter locally
    const partnerFilter = columnFilters.find((f) => f.column === 'partner_tech');
    if (partnerFilter && partnerFilter.values.length > 0) {
      result = result.filter((c) =>
        c.partner_tech?.some((t) => partnerFilter.values.includes(t))
      );
    }

    return result;
  }, [companiesData?.data, columnFilters]);

  // Handle column filter change
  const handleColumnFilterChange = useCallback((column: string, values: string[]) => {
    setColumnFilters((prev) => {
      const existing = prev.filter((f) => f.column !== column);
      if (values.length > 0) {
        return [...existing, { column, values }];
      }
      return existing;
    });
    setCurrentPage(1);
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setColumnFilters([]);
    setCurrentPage(1);
  }, []);

  // Clear a specific column filter
  const clearColumnFilter = useCallback((column: string) => {
    setColumnFilters((prev) => prev.filter((f) => f.column !== column));
    setCurrentPage(1);
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle enrich company
  const handleEnrichCompany = useCallback((domain: string) => {
    console.log('Enrich company:', domain);
    // TODO: Trigger enrichment API call
  }, []);

  // Check if any filters are active
  const hasActiveFilters = searchQuery.trim() !== '' || columnFilters.length > 0;

  // Get color for filter badge
  const getFilterColor = (column: string): string => {
    switch (column) {
      case 'status':
        return 'red';
      case 'vertical':
        return 'blue';
      case 'partner_tech':
        return 'green';
      default:
        return 'gray';
    }
  };

  // Get display name for filter column
  const getFilterLabel = (column: string): string => {
    switch (column) {
      case 'status':
        return 'Status';
      case 'vertical':
        return 'Vertical';
      case 'partner_tech':
        return 'Partner Tech';
      default:
        return column;
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Fixed Header Section */}
      <div style={{ flexShrink: 0, padding: '16px 24px', background: '#f8fafc' }}>
        <Container size="xl" p={0}>
          {/* Title Row */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Group justify="space-between" mb="md">
              <div>
                <Title order={2}>Companies</Title>
                <Text c="#64748b" size="md" mt={4}>
                  Click column header dropdowns (Status, Vertical, Partner Tech) to filter like Excel
                </Text>
              </div>
              <Group gap="sm">
                <Button
                  leftSection={<IconDownload size={16} />}
                  variant="light"
                  color="green"
                  onClick={() => setShowExportModal(true)}
                  disabled={filteredCompanies.length === 0}
                >
                  Export ({filteredCompanies.length})
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                />
                <Button
                  leftSection={<IconUpload size={16} />}
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
                  onClick={() => fileInputRef.current?.click()}
                  loading={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </Group>
            </Group>
          </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Paper
          p="md"
          mb="md"
          withBorder
          style={{ background: 'white' }}
        >
          <Group gap="md">
            <TextInput
              placeholder="Search by company name or domain..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ flex: 1 }}
              size="md"
              styles={{
                input: {
                  backgroundColor: 'white',
                  borderColor: '#e2e8f0',
                  color: '#334155',
                  '&::placeholder': {
                    color: '#94a3b8',
                  },
                },
              }}
            />

            {/* Partner Tech Filter */}
            <Select
              placeholder="All Partners"
              data={[
                { value: '', label: 'All Partners' },
                { value: 'Adobe Experience Manager', label: 'Adobe AEM' },
                { value: 'Adobe Commerce', label: 'Adobe Commerce' },
                { value: 'Amplience', label: 'Amplience' },
                { value: 'Spryker', label: 'Spryker' },
              ]}
              value={columnFilters.find(f => f.column === 'partner_tech')?.values[0] || ''}
              onChange={(value) => {
                if (value) {
                  handleColumnFilterChange('partner_tech', [value]);
                } else {
                  handleColumnFilterChange('partner_tech', []);
                }
              }}
              w={180}
              size="md"
              rightSection={<IconChevronDown size={14} color="#64748b" />}
              styles={{
                input: {
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                },
                dropdown: {
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                },
                option: {
                  color: '#1e293b',
                  fontSize: '14px',
                  padding: '10px 14px',
                  '&[data-selected]': {
                    backgroundColor: COLORS.ALGOLIA_NEBULA_BLUE,
                    color: '#ffffff',
                  },
                  '&[data-hovered]': {
                    backgroundColor: '#f1f5f9',
                    color: '#1e293b',
                  },
                },
              }}
            />

            {/* Clear All Filters */}
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tooltip label="Clear all filters">
                    <Button
                      variant="subtle"
                      color="gray"
                      leftSection={<IconX size={14} />}
                      onClick={clearAllFilters}
                      size="sm"
                    >
                      Clear All
                    </Button>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>
          </Group>
        </Paper>
      </motion.div>

      {/* Results Count + Active Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Group justify="space-between" mb="sm" wrap="wrap">
          <Group gap="sm">
            <Text size="md" c="#64748b" fw={500}>
              Showing
            </Text>
            <Badge variant="filled" color="blue" size="xl" style={{ fontWeight: 700, fontSize: 14, padding: '8px 14px' }}>
              {filteredCompanies.length}
            </Badge>
            <Text size="md" c="#64748b" fw={500}>
              of {companiesData?.pagination?.total || 0} companies
            </Text>
          </Group>

          {/* Active Filter Badges */}
          <AnimatePresence>
            {columnFilters.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Group gap="xs">
                  <IconFilter size={14} color="#94a3b8" />
                  {columnFilters.map((filter) => (
                    <Badge
                      key={filter.column}
                      variant="outline"
                      color={getFilterColor(filter.column)}
                      rightSection={
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          onClick={() => clearColumnFilter(filter.column)}
                        >
                          <IconX size={10} />
                        </ActionIcon>
                      }
                    >
                      {getFilterLabel(filter.column)}:{' '}
                      {filter.values.length === 1
                        ? filter.values[0]
                        : `${filter.values.length} selected`}
                    </Badge>
                  ))}
                </Group>
              </motion.div>
            )}
          </AnimatePresence>
        </Group>
      </motion.div>
        </Container>
      </div>

      {/* Scrollable Table Area - Takes remaining height */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 16px 24px' }}>
        <Container size="xl" p={0} style={{ height: '100%' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{ height: '100%' }}
          >
            <Paper withBorder style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <TargetList
                companies={filteredCompanies}
                allCompanies={companiesData?.data || []}
                isLoading={isLoading}
                pagination={companiesData?.pagination}
                onPageChange={handlePageChange}
                onEnrichCompany={handleEnrichCompany}
                columnFilters={columnFilters}
                onColumnFilterChange={handleColumnFilterChange}
              />
            </Paper>
          </motion.div>
        </Container>
      </div>

      {/* Export Modal */}
      <ExportModal
        opened={showExportModal}
        onClose={() => setShowExportModal(false)}
        companies={filteredCompanies as Company[]}
        selectedCount={filteredCompanies.length}
      />
    </div>
  );
}
