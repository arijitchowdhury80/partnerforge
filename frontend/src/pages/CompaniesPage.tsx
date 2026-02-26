/**
 * CompaniesPage - Focused Company List View
 *
 * A dedicated page for browsing and filtering displacement targets with
 * advanced filtering capabilities distinct from the Dashboard overview.
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
  Select,
  MultiSelect,
  Slider,
  Stack,
  Tooltip,
  ActionIcon,
  Box,
} from '@mantine/core';
import {
  IconSearch,
  IconUpload,
  IconX,
  IconFilter,
  IconFlame,
  IconBolt,
  IconSnowflake,
  IconMoon,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { getCompanies } from '@/services/api';
import { TargetList } from '@/components/targets/TargetList';
import type { FilterState } from '@/types';

// =============================================================================
// Status Badge Button Component
// =============================================================================

interface StatusBadgeButtonProps {
  status: 'hot' | 'warm' | 'cold';
  label: string;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

function StatusBadgeButton({ status, label, selected, onClick, icon }: StatusBadgeButtonProps) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    hot: {
      bg: selected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.05)',
      border: selected ? 'rgba(239, 68, 68, 0.6)' : 'rgba(239, 68, 68, 0.2)',
      text: selected ? '#ef4444' : 'rgba(239, 68, 68, 0.6)',
    },
    warm: {
      bg: selected ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.05)',
      border: selected ? 'rgba(249, 115, 22, 0.6)' : 'rgba(249, 115, 22, 0.2)',
      text: selected ? '#f97316' : 'rgba(249, 115, 22, 0.6)',
    },
    cold: {
      bg: selected ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.05)',
      border: selected ? 'rgba(107, 114, 128, 0.6)' : 'rgba(107, 114, 128, 0.2)',
      text: selected ? '#6b7280' : 'rgba(107, 114, 128, 0.6)',
    },
  };

  const colorSet = colors[status];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: `1px solid ${colorSet.border}`,
        background: colorSet.bg,
        color: colorSet.text,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontWeight: selected ? 600 : 400,
        fontSize: '13px',
      }}
    >
      {icon}
      {label}
    </motion.button>
  );
}

// =============================================================================
// Partner Tech Options
// =============================================================================

const PARTNER_TECH_OPTIONS = [
  { value: 'Adobe AEM', label: 'Adobe AEM' },
  { value: 'Shopify', label: 'Shopify' },
  { value: 'Salesforce Commerce', label: 'Salesforce Commerce' },
  { value: 'BigCommerce', label: 'BigCommerce' },
  { value: 'Magento', label: 'Magento' },
  { value: 'SAP Hybris', label: 'SAP Hybris' },
  { value: 'Contentful', label: 'Contentful' },
  { value: 'Sitecore', label: 'Sitecore' },
];

// =============================================================================
// Companies Page Component
// =============================================================================

export function CompaniesPage() {
  const navigate = useNavigate();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [minIcpScore, setMinIcpScore] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Build filter state for API
  const filters: FilterState & { page?: number; limit?: number } = useMemo(() => {
    const base: FilterState & { page?: number; limit?: number } = {
      sort_by: 'icp_score',
      sort_order: 'desc',
      page: currentPage,
      limit: 25,
    };

    // Add status filter (only first selected for now - API limitation)
    if (selectedStatuses.length === 1) {
      base.status = selectedStatuses[0] as 'hot' | 'warm' | 'cold';
    }

    // Add partner filter
    if (selectedPartners.length > 0) {
      base.partner = selectedPartners[0];
    }

    // Add min score filter
    if (minIcpScore > 0) {
      base.min_score = minIcpScore;
    }

    return base;
  }, [selectedStatuses, selectedPartners, minIcpScore, currentPage]);

  // Fetch companies
  const { data: companiesData, isLoading, refetch } = useQuery({
    queryKey: ['companies', filters, searchQuery],
    queryFn: () => getCompanies(filters),
  });

  // Filter companies by search query locally (for instant search)
  const filteredCompanies = useMemo(() => {
    if (!companiesData?.data) return [];
    if (!searchQuery.trim()) return companiesData.data;

    const query = searchQuery.toLowerCase().trim();
    return companiesData.data.filter(
      (company) =>
        company.company_name?.toLowerCase().includes(query) ||
        company.domain?.toLowerCase().includes(query)
    );
  }, [companiesData?.data, searchQuery]);

  // Also filter by multiple statuses locally if more than one selected
  const statusFilteredCompanies = useMemo(() => {
    if (selectedStatuses.length <= 1) return filteredCompanies;
    return filteredCompanies.filter((company) =>
      selectedStatuses.includes(company.status)
    );
  }, [filteredCompanies, selectedStatuses]);

  // Toggle status selection
  const toggleStatus = useCallback((status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
    setCurrentPage(1);
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedStatuses([]);
    setSelectedPartners([]);
    setMinIcpScore(0);
    setCurrentPage(1);
  }, []);

  // Check if any filters are active
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedStatuses.length > 0 ||
    selectedPartners.length > 0 ||
    minIcpScore > 0;

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle enrich company
  const handleEnrichCompany = useCallback((domain: string) => {
    console.log('Enrich company:', domain);
    // TODO: Trigger enrichment API call
  }, []);

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

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Paper
          p="lg"
          mb="lg"
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Stack gap="md">
            {/* Top row: Search + Partner Tech */}
            <Group gap="md" grow>
              <TextInput
                placeholder="Search by company name or domain..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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
              <MultiSelect
                placeholder="Filter by partner technology"
                data={PARTNER_TECH_OPTIONS}
                value={selectedPartners}
                onChange={(value) => {
                  setSelectedPartners(value);
                  setCurrentPage(1);
                }}
                searchable
                clearable
                leftSection={<IconFilter size={16} />}
                size="md"
                styles={{
                  input: {
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                  },
                  pill: {
                    background: 'rgba(0, 61, 255, 0.2)',
                    color: '#3b82f6',
                  },
                }}
              />
            </Group>

            {/* Bottom row: Status badges + ICP Score + Clear */}
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
              {/* Status Badges */}
              <Group gap="xs">
                <Text size="sm" c="dimmed" mr="xs">
                  Status:
                </Text>
                <StatusBadgeButton
                  status="hot"
                  label="Hot"
                  selected={selectedStatuses.includes('hot')}
                  onClick={() => toggleStatus('hot')}
                  icon={<IconFlame size={14} />}
                />
                <StatusBadgeButton
                  status="warm"
                  label="Warm"
                  selected={selectedStatuses.includes('warm')}
                  onClick={() => toggleStatus('warm')}
                  icon={<IconBolt size={14} />}
                />
                <StatusBadgeButton
                  status="cold"
                  label="Cold"
                  selected={selectedStatuses.includes('cold')}
                  onClick={() => toggleStatus('cold')}
                  icon={<IconSnowflake size={14} />}
                />
              </Group>

              {/* ICP Score Slider */}
              <Group gap="md" align="flex-end">
                <Box w={200}>
                  <Text size="xs" c="dimmed" mb={4}>
                    Min ICP Score: {minIcpScore}
                  </Text>
                  <Slider
                    value={minIcpScore}
                    onChange={(value) => {
                      setMinIcpScore(value);
                      setCurrentPage(1);
                    }}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 50, label: '50' },
                      { value: 100, label: '100' },
                    ]}
                    styles={{
                      track: { background: 'rgba(255, 255, 255, 0.1)' },
                      bar: { background: 'linear-gradient(90deg, #003dff, #00d4ff)' },
                      mark: { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      markLabel: { color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px' },
                    }}
                  />
                </Box>

                {/* Clear Filters Button */}
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
                          onClick={clearFilters}
                          size="sm"
                        >
                          Clear Filters
                        </Button>
                      </Tooltip>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Group>
            </Group>
          </Stack>
        </Paper>
      </motion.div>

      {/* Results Count */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Showing
            </Text>
            <Badge variant="light" color="blue" size="lg">
              {statusFilteredCompanies.length}
            </Badge>
            <Text size="sm" c="dimmed">
              of {companiesData?.pagination?.total || 0} companies
            </Text>
          </Group>

          {hasActiveFilters && (
            <Group gap="xs">
              {selectedStatuses.map((status) => (
                <Badge
                  key={status}
                  variant="outline"
                  color={
                    status === 'hot'
                      ? 'red'
                      : status === 'warm'
                      ? 'orange'
                      : 'gray'
                  }
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      onClick={() => toggleStatus(status)}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  }
                >
                  {status}
                </Badge>
              ))}
              {selectedPartners.map((partner) => (
                <Badge
                  key={partner}
                  variant="outline"
                  color="green"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      onClick={() =>
                        setSelectedPartners((prev) => prev.filter((p) => p !== partner))
                      }
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  }
                >
                  {partner}
                </Badge>
              ))}
              {minIcpScore > 0 && (
                <Badge
                  variant="outline"
                  color="violet"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      onClick={() => setMinIcpScore(0)}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  }
                >
                  ICP {'>'}= {minIcpScore}
                </Badge>
              )}
            </Group>
          )}
        </Group>
      </motion.div>

      {/* Company Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <TargetList
          companies={statusFilteredCompanies}
          isLoading={isLoading}
          pagination={companiesData?.pagination}
          onPageChange={handlePageChange}
          onEnrichCompany={handleEnrichCompany}
        />
      </motion.div>
    </Container>
  );
}
