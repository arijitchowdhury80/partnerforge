/**
 * CompaniesPage - Focused Company List View
 *
 * A dedicated page for browsing displacement targets with Excel-style
 * column filtering. All filters are in the table headers.
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mantine/core';
import {
  IconSearch,
  IconUpload,
  IconX,
  IconFilter,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { getCompanies, getDistribution } from '@/services/api';
import { TargetList, type ColumnFilter } from '@/components/targets/TargetList';

// =============================================================================
// Companies Page Component
// =============================================================================

export function CompaniesPage() {
  const navigate = useNavigate();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

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
      limit: 25,
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
  const { data: companiesData, isLoading } = useQuery({
    queryKey: ['companies', apiFilters],
    queryFn: () => getCompanies(apiFilters),
  });

  // Fetch distribution data to get all available verticals
  const { data: distributionData } = useQuery({
    queryKey: ['distribution'],
    queryFn: getDistribution,
  });

  // Get available filter options from distribution data
  const availableVerticals = useMemo(() => {
    if (!distributionData?.allVerticals) return [];
    return distributionData.allVerticals.map((v) => v.name);
  }, [distributionData]);

  // Static partner tech options (these come from BuiltWith)
  const availablePartnerTechs = useMemo(() => {
    return [
      'Adobe AEM',
      'Shopify',
      'Salesforce Commerce',
      'BigCommerce',
      'Magento',
      'SAP Hybris',
      'Contentful',
      'Sitecore',
    ];
  }, []);

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
    if (partnerFilter && partnerFilter.values.length > 1) {
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
    <Container size="xl" py="md">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2} c="white">
              Companies
            </Title>
            <Text c="dimmed" size="sm" mt={4}>
              Browse and filter displacement targets
            </Text>
          </div>
          <Button
            leftSection={<IconUpload size={16} />}
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
            onClick={() => navigate('/upload')}
          >
            Upload New List
          </Button>
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
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
          }}
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
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&::placeholder': {
                    color: 'rgba(255, 255, 255, 0.4)',
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
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Showing
            </Text>
            <Badge variant="light" color="blue" size="lg">
              {filteredCompanies.length}
            </Badge>
            <Text size="sm" c="dimmed">
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
                  <IconFilter size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
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

      {/* Hint about column filters */}
      {!hasActiveFilters && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Text size="xs" c="dimmed" mb="sm">
            <IconFilter
              size={12}
              style={{ marginRight: 4, verticalAlign: 'middle' }}
            />
            Tip: Click the dropdown arrow on column headers (Status, Vertical,
            Partner Tech) to filter like Excel
          </Text>
        </motion.div>
      )}

      {/* Company Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <TargetList
          companies={filteredCompanies}
          isLoading={isLoading}
          pagination={companiesData?.pagination}
          onPageChange={handlePageChange}
          onEnrichCompany={handleEnrichCompany}
          columnFilters={columnFilters}
          onColumnFilterChange={handleColumnFilterChange}
          availableVerticals={availableVerticals}
          availablePartnerTechs={availablePartnerTechs}
        />
      </motion.div>
    </Container>
  );
}
