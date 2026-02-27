/**
 * Galaxy Explorer - Layer 0 Visualization
 *
 * Main dashboard for exploring the Partner Tech Galaxy.
 * Shows companies grouped by 4 galaxies (CMS, Commerce, MarTech, Search)
 * with cohort classification and sales play tagging.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Paper,
  Badge,
  Table,
  TextInput,
  MultiSelect,
  Pagination,
  Loader,
  Center,
  SimpleGrid,
  ThemeIcon,
  Tooltip,
  ActionIcon,
  Box,
  BackgroundImage,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconDownload,
  IconDatabase,
  IconCode,
  IconShoppingCart,
  IconMail,
  IconTargetArrow,
} from '@tabler/icons-react';
import { COLORS } from '../lib/constants';
import {
  getCompanies,
  getGalaxySummary,
  getCohortSummary,
  getTechOptions,
} from '../services/galaxyApi';
import type {
  GalaxyCompany,
  GalaxySummary,
  CohortSummary,
  TechOption,
  GalaxyFilterState,
  TechCohort,
  SalesPlay,
} from '../types';

// =============================================================================
// Constants
// =============================================================================

const ITEMS_PER_PAGE = 50;

const GALAXY_ICONS: Record<string, React.ReactNode> = {
  cms: <IconCode size={20} />,
  commerce: <IconShoppingCart size={20} />,
  martech: <IconMail size={20} />,
  search: <IconTargetArrow size={20} />,
};

const GALAXY_COLORS: Record<string, string> = {
  cms: COLORS.ALGOLIA_PURPLE,
  commerce: COLORS.ALGOLIA_NEBULA_BLUE,
  martech: '#10b981',
  search: '#f59e0b',
};

const COHORT_COLORS: Record<TechCohort, string> = {
  JACKPOT: '#10b981',
  HIGH: COLORS.ALGOLIA_NEBULA_BLUE,
  MEDIUM: '#f59e0b',
  BASE: COLORS.GRAY_500,
};

const SALES_PLAY_COLORS: Record<SalesPlay, string> = {
  DISPLACEMENT: '#ef4444',
  GREENFIELD: '#10b981',
};

// Glassmorphism style for cards - more opaque for readability
const GLASS_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

// =============================================================================
// Components
// =============================================================================

interface GalaxyCardProps {
  galaxy: string;
  data: GalaxySummary[];
  onFilterClick: (tech: string) => void;
}

function GalaxyCard({ galaxy, data, onFilterClick }: GalaxyCardProps) {
  const totalCount = data.reduce((sum, d) => sum + d.company_count, 0);
  const displacementCount = data.reduce((sum, d) => sum + d.displacement_count, 0);

  return (
    <Paper p="md" radius="md" className="galaxy-glass-panel">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <ThemeIcon
            size="lg"
            radius="md"
            style={{ backgroundColor: GALAXY_COLORS[galaxy] }}
          >
            {GALAXY_ICONS[galaxy]}
          </ThemeIcon>
          <div>
            <Text size="sm" fw={600} tt="uppercase" c="white">
              {galaxy}
            </Text>
            <Text size="xs" c="gray.3">
              {totalCount.toLocaleString()} companies
            </Text>
          </div>
        </Group>
        <Badge size="sm" color={displacementCount > 0 ? 'red' : 'gray'}>
          {displacementCount} displacement
        </Badge>
      </Group>

      <Stack gap={4}>
        {data.slice(0, 5).map((item) => (
          <Group
            key={item.tech}
            justify="space-between"
            style={{ cursor: 'pointer' }}
            onClick={() => onFilterClick(item.tech)}
          >
            <Text size="sm" c="white">{item.tech}</Text>
            <Group gap="xs">
              <Badge size="xs" variant="light">
                {item.company_count.toLocaleString()}
              </Badge>
            </Group>
          </Group>
        ))}
        {data.length > 5 && (
          <Text size="xs" c="gray.3" ta="center">
            +{data.length - 5} more
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

interface CohortBadgeProps {
  cohort: TechCohort;
}

function CohortBadge({ cohort }: CohortBadgeProps) {
  return (
    <Badge
      size="sm"
      style={{ backgroundColor: COHORT_COLORS[cohort], color: 'white' }}
    >
      {cohort}
    </Badge>
  );
}

interface SalesPlayBadgeProps {
  play: SalesPlay;
}

function SalesPlayBadge({ play }: SalesPlayBadgeProps) {
  return (
    <Badge
      size="sm"
      variant="outline"
      style={{ borderColor: SALES_PLAY_COLORS[play], color: SALES_PLAY_COLORS[play] }}
    >
      {play}
    </Badge>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function GalaxyExplorer() {
  // State
  const [companies, setCompanies] = useState<GalaxyCompany[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [galaxySummary, setGalaxySummary] = useState<GalaxySummary[]>([]);
  const [cohortSummary, setCohortSummary] = useState<CohortSummary[]>([]);
  const [techOptions, setTechOptions] = useState<TechOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [filters, setFilters] = useState<Partial<GalaxyFilterState>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [summaryResult, cohortResult, optionsResult] = await Promise.all([
          getGalaxySummary(),
          getCohortSummary(),
          getTechOptions(),
        ]);

        setGalaxySummary(summaryResult);
        setCohortSummary(cohortResult);
        setTechOptions(optionsResult);
      } catch (error) {
        console.error('Error loading galaxy data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Load companies when filters or page changes
  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const { companies: result, total } = await getCompanies(
        { ...filters, search: searchQuery },
        { limit: ITEMS_PER_PAGE, offset: (page - 1) * ITEMS_PER_PAGE }
      );
      setCompanies(result);
      setTotalCount(total);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, page]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Group summary by galaxy
  const cmsData = galaxySummary.filter((s) => s.galaxy === 'cms');
  const commerceData = galaxySummary.filter((s) => s.galaxy === 'commerce');
  const martechData = galaxySummary.filter((s) => s.galaxy === 'martech');
  const searchData = galaxySummary.filter((s) => s.galaxy === 'search');

  // Build filter options from tech_options
  const cmsOptions = techOptions
    .filter((t) => t.galaxy === 'cms')
    .map((t) => ({ value: t.slug, label: t.display_name }));
  const commerceOptions = techOptions
    .filter((t) => t.galaxy === 'commerce')
    .map((t) => ({ value: t.slug, label: t.display_name }));
  const martechOptions = techOptions
    .filter((t) => t.galaxy === 'martech')
    .map((t) => ({ value: t.slug, label: t.display_name }));
  const searchOptions = techOptions
    .filter((t) => t.galaxy === 'search')
    .map((t) => ({ value: t.slug, label: t.display_name }));

  const cohortOptions = [
    { value: 'JACKPOT', label: 'JACKPOT (CMS + Commerce + MarTech/Search)' },
    { value: 'HIGH', label: 'HIGH (CMS + Commerce)' },
    { value: 'MEDIUM', label: 'MEDIUM (Premium Commerce)' },
    { value: 'BASE', label: 'BASE (Any Partner Tech)' },
  ];

  const salesPlayOptions = [
    { value: 'DISPLACEMENT', label: 'Displacement (Has Competitor Search)' },
    { value: 'GREENFIELD', label: 'Greenfield (No/Native Search)' },
  ];

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <Box pos="relative" style={{ minHeight: '100vh' }}>
      {/* Galaxy Background Image */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          overflow: 'hidden',
          backgroundImage: 'url(/images/milky-way.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay for better readability */}
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.75) 100%)',
          }}
        />
      </Box>

      {/* Content */}
      <Container size="xl" py="md" pos="relative" style={{ zIndex: 1 }}>
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2} c="white">
            <Group gap="xs">
              <IconDatabase size={28} />
              Partner Tech Galaxy
            </Group>
          </Title>
          <Text c="gray.3" size="sm">
            Layer 0: All companies using partner technologies (excluding Algolia customers)
          </Text>
        </div>
        <Group>
          <Tooltip label="Refresh data">
            <ActionIcon variant="light" color="gray" onClick={loadCompanies}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Export CSV">
            <ActionIcon variant="light" color="gray">
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Galaxy Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg">
        <GalaxyCard
          galaxy="cms"
          data={cmsData}
          onFilterClick={(tech) => setFilters((f) => ({ ...f, cms_tech: [tech as any] }))}
        />
        <GalaxyCard
          galaxy="commerce"
          data={commerceData}
          onFilterClick={(tech) => setFilters((f) => ({ ...f, commerce_tech: [tech as any] }))}
        />
        <GalaxyCard
          galaxy="martech"
          data={martechData}
          onFilterClick={(tech) => setFilters((f) => ({ ...f, martech_tech: [tech as any] }))}
        />
        <GalaxyCard
          galaxy="search"
          data={searchData}
          onFilterClick={(tech) => setFilters((f) => ({ ...f, search_tech: [tech as any] }))}
        />
      </SimpleGrid>

      {/* Cohort Summary */}
      <Paper p="md" radius="md" mb="lg" className="galaxy-glass-panel">
        <Text size="sm" fw={600} mb="sm" c="white">
          Tech Cohorts
        </Text>
        <Group>
          {cohortSummary.map((c) => (
            <Box
              key={c.tech_cohort}
              style={{ cursor: 'pointer' }}
              onClick={() => setFilters((f) => ({ ...f, tech_cohort: [c.tech_cohort] }))}
            >
              <Badge
                size="lg"
                variant="filled"
                style={{ backgroundColor: COHORT_COLORS[c.tech_cohort] }}
                rightSection={
                  <Text size="xs" fw={700}>
                    {c.company_count.toLocaleString()}
                  </Text>
                }
              >
                {c.tech_cohort}
              </Badge>
            </Box>
          ))}
        </Group>
      </Paper>

      {/* Filters */}
      <Paper p="md" radius="md" mb="lg" className="galaxy-glass-panel galaxy-glass-input">
        <Group grow align="flex-start">
          <TextInput
            placeholder="Search by domain or company name..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.currentTarget.value);
              setPage(1);
            }}
          />
          <MultiSelect
            placeholder="CMS"
            data={cmsOptions}
            value={filters.cms_tech?.filter(Boolean) as string[] || []}
            onChange={(value) => {
              setFilters((f) => ({ ...f, cms_tech: value as any }));
              setPage(1);
            }}
            clearable
          />
          <MultiSelect
            placeholder="Commerce"
            data={commerceOptions}
            value={filters.commerce_tech?.filter(Boolean) as string[] || []}
            onChange={(value) => {
              setFilters((f) => ({ ...f, commerce_tech: value as any }));
              setPage(1);
            }}
            clearable
          />
          <MultiSelect
            placeholder="Cohort"
            data={cohortOptions}
            value={filters.tech_cohort || []}
            onChange={(value) => {
              setFilters((f) => ({ ...f, tech_cohort: value as TechCohort[] }));
              setPage(1);
            }}
            clearable
          />
          <MultiSelect
            placeholder="Sales Play"
            data={salesPlayOptions}
            value={filters.sales_play || []}
            onChange={(value) => {
              setFilters((f) => ({ ...f, sales_play: value as SalesPlay[] }));
              setPage(1);
            }}
            clearable
          />
        </Group>
      </Paper>

      {/* Results */}
      <Paper p="md" radius="md" className="galaxy-glass-panel">
        <Group justify="space-between" mb="md">
          <Text size="sm" c="gray.3">
            Showing {((page - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(page * ITEMS_PER_PAGE, totalCount)} of{' '}
            {totalCount.toLocaleString()} companies
          </Text>
        </Group>

        {loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : companies.length === 0 ? (
          <Center py="xl">
            <Text c="gray.3">No companies found. Run the migration and import data.</Text>
          </Center>
        ) : (
          <Table striped highlightOnHover styles={{
            th: { color: 'white', borderColor: 'rgba(255,255,255,0.1)' },
            td: { borderColor: 'rgba(255,255,255,0.1)' },
            tr: { '&[data-striped]': { backgroundColor: 'rgba(255,255,255,0.05)' } },
          }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Domain</Table.Th>
                <Table.Th>Company</Table.Th>
                <Table.Th>CMS</Table.Th>
                <Table.Th>Commerce</Table.Th>
                <Table.Th>MarTech</Table.Th>
                <Table.Th>Search</Table.Th>
                <Table.Th>Cohort</Table.Th>
                <Table.Th>Sales Play</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {companies.map((company) => (
                <Table.Tr key={company.domain}>
                  <Table.Td>
                    <Text size="sm" fw={500} c="white">
                      {company.domain}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="gray.3">{company.company_name || '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    {company.cms_tech ? (
                      <Badge size="xs" variant="light" color="violet">
                        {company.cms_tech}
                      </Badge>
                    ) : (
                      <Text size="xs" c="gray.4">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {company.commerce_tech ? (
                      <Badge size="xs" variant="light" color="blue">
                        {company.commerce_tech}
                      </Badge>
                    ) : (
                      <Text size="xs" c="gray.4">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {company.martech_tech ? (
                      <Badge size="xs" variant="light" color="teal">
                        {company.martech_tech}
                      </Badge>
                    ) : (
                      <Text size="xs" c="gray.4">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {company.search_tech ? (
                      <Badge size="xs" variant="light" color="orange">
                        {company.search_tech}
                      </Badge>
                    ) : (
                      <Text size="xs" c="gray.4">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <CohortBadge cohort={company.tech_cohort} />
                  </Table.Td>
                  <Table.Td>
                    <SalesPlayBadge play={company.sales_play} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Group justify="center" mt="lg" className="galaxy-pagination">
            <Pagination
              value={page}
              onChange={setPage}
              total={totalPages}
              size="sm"
            />
          </Group>
        )}
      </Paper>
      </Container>
    </Box>
  );
}

export default GalaxyExplorer;
