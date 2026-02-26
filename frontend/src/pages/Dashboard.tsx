/**
 * Dashboard Page - Algolia Brand
 *
 * Clean, professional design matching Algolia's brand aesthetic.
 * Light theme with Algolia Blue (#003DFF) accents.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Text,
  Group,
  Paper,
  Badge,
  Tooltip,
  Modal,
  Table,
  Loader,
  Button,
  SimpleGrid,
  Stack,
  Progress,
  Card,
  ThemeIcon,
  Divider,
  Select,
  MultiSelect,
  Box,
} from '@mantine/core';
import {
  IconMinus,
  IconEqual,
  IconTarget,
  IconFlame,
  IconTrendingUp,
  IconSnowflake,
  IconChevronRight,
  IconBuilding,
  IconWorld,
} from '@tabler/icons-react';

import { getStats, getCompanies, getDistribution, type DistributionData } from '@/services/api';
import { getTargets, type DisplacementTarget } from '@/services/supabase';
import { TargetList } from '@/components/targets/TargetList';
import { ViewModeToggle, DistributionGrid, AccountDrillDown, type ViewMode } from '@/components/dashboard';
import { usePartner, getSelectionTechName, PARTNERS, type Partner, type Product } from '@/contexts/PartnerContext';
import { AlgoliaLogo } from '@/components/common/AlgoliaLogo';
import { getPartnerLogo } from '@/components/common/PartnerLogos';
import type { FilterState, DashboardStats } from '@/types';

// Algolia brand colors
const ALGOLIA_BLUE = '#003DFF';
const ALGOLIA_PURPLE = '#5468FF';
const GRAY_50 = '#f8fafc';
const GRAY_100 = '#f1f5f9';
const GRAY_200 = '#e2e8f0';
const GRAY_500 = '#64748b';
const GRAY_700 = '#334155';
const GRAY_900 = '#0f172a';

// Tier colors - clear visual hierarchy
const TIER_COLORS = {
  hot: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', badge: 'red' },
  warm: { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c', badge: 'orange' },
  cold: { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', badge: 'gray' },
};

// Column filter type for TargetList
interface ColumnFilter {
  column: string;
  values: string[];
}

export function Dashboard() {
  const { selectedPartner, selection, selectPartner, selectProduct, partners } = usePartner();
  const [filters, setFilters] = useState<FilterState>({
    sort_by: 'icp_score',
    sort_order: 'desc',
  });
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);

  // Check if a specific partner is selected (not "All Partners")
  const hasPartnerSelected = selection.partner.key !== 'all';

  // View mode for distribution grid (Partner/Product/Vertical/Account)
  const [viewMode, setViewMode] = useState<ViewMode>('product');

  // Drill-down state for when a cell is clicked
  const [drillDown, setDrillDown] = useState<{
    opened: boolean;
    title: string;
    targets: DisplacementTarget[];
  }>({
    opened: false,
    title: '',
    targets: [],
  });

  // All targets for the distribution grid
  const { data: allTargetsData } = useQuery({
    queryKey: ['allTargets', selectedPartner.key],
    queryFn: async () => {
      const result = await getTargets({ limit: 5000 });
      return result.targets;
    },
  });

  // Handle column filter changes from TargetList
  const handleColumnFilterChange = (column: string, values: string[]) => {
    setColumnFilters(prev => {
      const existing = prev.filter(f => f.column !== column);
      if (values.length > 0) {
        return [...existing, { column, values }];
      }
      return existing;
    });
    // Reset to page 1 when filters change
    setPage(1);
  };

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['stats', selectedPartner.key],
    queryFn: getStats,
  });

  // Fetch distribution
  const { data: distribution } = useQuery({
    queryKey: ['distribution', selectedPartner.key],
    queryFn: getDistribution,
  });

  // Get proper tech name for filtering
  const partnerTechName = getSelectionTechName(selection);

  // Fetch companies
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useQuery({
    queryKey: ['companies', filters, page, selectedPartner.key, partnerTechName],
    queryFn: () => getCompanies({
      ...filters,
      page,
      limit: 20,
      partner: partnerTechName,
    }),
  });

  const hotCount = stats?.hot_leads || 0;
  const warmCount = stats?.warm_leads || 0;
  const coldCount = stats?.cold_leads || 0;
  const total = stats?.total_companies || 0;

  // Apply client-side filtering based on column filters
  const filteredCompanies = useMemo(() => {
    if (!companies?.data || columnFilters.length === 0) {
      return companies?.data || [];
    }

    return companies.data.filter(company => {
      return columnFilters.every(filter => {
        if (filter.values.length === 0) return true;

        if (filter.column === 'status') {
          return filter.values.includes(company.status);
        }
        if (filter.column === 'vertical') {
          return filter.values.includes(company.vertical || '');
        }
        if (filter.column === 'partner_tech') {
          // Match if any of the company's techs are in the filter
          return company.partner_tech?.some(tech => filter.values.includes(tech)) || false;
        }
        return true;
      });
    });
  }, [companies?.data, columnFilters]);

  // Handle grid cell click - opens drill-down drawer
  const handleGridCellClick = (rowKey: string, colKey: string, targets: DisplacementTarget[]) => {
    const title = viewMode === 'vertical'
      ? `${rowKey} - ${colKey}`
      : `${rowKey} in ${colKey}`;
    setDrillDown({
      opened: true,
      title,
      targets,
    });
  };

  // Handle target selection from drill-down
  const handleSelectTarget = (domain: string) => {
    // Navigate to target detail page
    window.location.href = `/company/${domain}`;
  };

  // Close drill-down drawer
  const closeDrillDown = () => {
    setDrillDown(prev => ({ ...prev, opened: false }));
  };

  return (
    <div style={{ background: GRAY_50, minHeight: '100vh' }}>
      <Container size="xl" py="xl">
        {/* Header with Partner Selection */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Paper
            p="lg"
            radius="lg"
            mb="xl"
            style={{
              background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: `1px solid ${GRAY_200}`,
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
              <div>
                <Text size="sm" c={GRAY_500} fw={500} tt="uppercase" mb={4}>
                  Partner Intelligence
                </Text>
                <Text size="xl" fw={700} c={GRAY_900}>
                  Displacement Targets
                </Text>
                <Text size="sm" c={GRAY_500} mt={4}>
                  Select a partner to see their tech stack targets minus Algolia customers
                </Text>
              </div>

              {/* Partner/Tech Selection */}
              <Group gap="md" wrap="wrap">
                <Select
                  label="Partner"
                  placeholder="Select partner..."
                  value={selection.partner.key}
                  onChange={(value) => {
                    const partner = partners.find(p => p.key === value);
                    if (partner) selectPartner(partner);
                  }}
                  data={partners.filter(p => p.key !== 'all').map(p => ({
                    value: p.key,
                    label: p.name,
                  }))}
                  w={180}
                  size="md"
                  clearable
                  styles={{
                    input: {
                      backgroundColor: 'white',
                      borderColor: GRAY_200,
                      color: GRAY_900,
                      fontSize: '14px',
                    },
                    label: {
                      color: GRAY_700,
                      fontWeight: 600,
                      marginBottom: 4,
                    },
                  }}
                />

                {hasPartnerSelected && selection.partner.products.length > 0 && (
                  <Select
                    label="Tech Stack"
                    placeholder="Select product..."
                    value={selection.product?.key || null}
                    onChange={(value) => {
                      const product = selection.partner.products.find(p => p.key === value);
                      selectProduct(product || null);
                    }}
                    data={selection.partner.products.map(p => ({
                      value: p.key,
                      label: p.name,
                    }))}
                    w={220}
                    size="md"
                    clearable
                    styles={{
                      input: {
                        backgroundColor: 'white',
                        borderColor: GRAY_200,
                        color: GRAY_900,
                        fontSize: '14px',
                      },
                      label: {
                        color: GRAY_700,
                        fontWeight: 600,
                        marginBottom: 4,
                      },
                    }}
                  />
                )}
              </Group>
            </Group>

            {/* Formula Display - only show when partner selected */}
            {hasPartnerSelected && (
              <Box mt="lg" pt="lg" style={{ borderTop: `1px solid ${GRAY_200}` }}>
                <FormulaDisplay partnerName={selectedPartner.name} partnerKey={selectedPartner.key} />
              </Box>
            )}
          </Paper>
        </motion.div>

        {/* KPI Cards - only show when partner selected */}
        {hasPartnerSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
              <KPICard
                label="Total Targets"
                value={total}
                icon={<IconTarget size={20} />}
                color={ALGOLIA_BLUE}
              />
              <KPICard
                label="Hot Leads"
                value={hotCount}
                sublabel="Ready for outreach"
                icon={<IconFlame size={20} />}
                color="#dc2626"
              />
              <KPICard
                label="Warm Leads"
                value={warmCount}
                sublabel="Nurture pipeline"
                icon={<IconTrendingUp size={20} />}
                color="#ea580c"
              />
              <KPICard
                label="Cold Leads"
                value={coldCount}
                sublabel="Low priority"
                icon={<IconSnowflake size={20} />}
                color={GRAY_500}
              />
            </SimpleGrid>
          </motion.div>
        )}

        {/* Empty State - when no partner selected */}
        {!hasPartnerSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Paper
              p="xl"
              radius="lg"
              mb="xl"
              style={{
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: `1px solid ${GRAY_200}`,
                textAlign: 'center',
              }}
            >
              <ThemeIcon size={64} radius="xl" variant="light" color="blue" mx="auto" mb="lg">
                <IconTarget size={32} />
              </ThemeIcon>
              <Text size="xl" fw={600} c={GRAY_900} mb="xs">
                Select a Partner to Get Started
              </Text>
              <Text size="md" c={GRAY_500} mb="lg" maw={500} mx="auto">
                Choose a partner from the dropdown above to see displacement targets.
                We'll show you companies using their tech stack who aren't using Algolia yet.
              </Text>
              <Group justify="center" gap="md">
                {partners.filter(p => p.key !== 'all').slice(0, 4).map(partner => {
                  const Logo = getPartnerLogo(partner.key);
                  return (
                    <Button
                      key={partner.key}
                      variant="light"
                      leftSection={<Logo size={18} />}
                      onClick={() => selectPartner(partner)}
                      size="md"
                    >
                      {partner.name}
                    </Button>
                  );
                })}
              </Group>
            </Paper>
          </motion.div>
        )}

        {/* Distribution Section - Multi-Dimensional Grid (only when partner selected) */}
        {hasPartnerSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Paper
              p="lg"
              radius="lg"
              mb="xl"
              style={{
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: `1px solid ${GRAY_200}`,
              }}
            >
              <Group justify="space-between" mb="lg">
                <div>
                  <Text fw={600} c={GRAY_900} size="lg">Target Distribution</Text>
                  <Text size="sm" c={GRAY_500}>
                    {viewMode === 'partner' && 'By partner and vertical'}
                    {viewMode === 'product' && 'By product and vertical'}
                    {viewMode === 'vertical' && 'By vertical and ICP tier'}
                    {viewMode === 'account' && 'All accounts'}
                  </Text>
                </div>
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </Group>

              {allTargetsData ? (
                <DistributionGrid
                  viewMode={viewMode}
                  targets={allTargetsData}
                  onCellClick={handleGridCellClick}
                />
              ) : (
                <div className="flex justify-center py-8">
                  <Loader color={ALGOLIA_BLUE} size="sm" />
                </div>
              )}
            </Paper>
          </motion.div>
        )}

        {/* Account Drill-Down Drawer */}
        <AccountDrillDown
          opened={drillDown.opened}
          onClose={closeDrillDown}
          title={drillDown.title}
          targets={drillDown.targets}
          onSelectTarget={handleSelectTarget}
        />

        {/* Targets Table (only when partner selected) */}
        {hasPartnerSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Paper
              p="lg"
              radius="lg"
              style={{
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: `1px solid ${GRAY_200}`,
              }}
            >
              <Group justify="space-between" mb="lg">
                <div>
                  <Text fw={600} c={GRAY_900} size="lg">All Targets</Text>
                  <Text size="sm" c={GRAY_500}>Click any row to view full intelligence</Text>
                </div>
                <Group gap="xs">
                  <Badge color="red" variant="filled" size="sm" styles={{ root: { color: '#fff' } }}>{hotCount} Hot</Badge>
                  <Badge color="orange" variant="filled" size="sm" styles={{ root: { color: '#fff' } }}>{warmCount} Warm</Badge>
                  <Badge color="gray" variant="filled" size="sm" styles={{ root: { color: '#fff' } }}>{coldCount} Cold</Badge>
                </Group>
              </Group>

              <TargetList
                companies={filteredCompanies}
                allCompanies={companies?.data || []}
                isLoading={companiesLoading}
                pagination={companies?.pagination}
                onPageChange={setPage}
                columnFilters={columnFilters}
                onColumnFilterChange={handleColumnFilterChange}
              />
            </Paper>
          </motion.div>
        )}
      </Container>
    </div>
  );
}

// Formula Display - compact
interface FormulaDisplayProps {
  partnerName: string;
  partnerKey: string;
}

function FormulaDisplay({ partnerName, partnerKey }: FormulaDisplayProps) {
  const PartnerLogo = getPartnerLogo(partnerKey);

  return (
    <Group gap="sm" style={{ background: GRAY_100, padding: '8px 16px', borderRadius: 8 }}>
      <Group gap={6}>
        <PartnerLogo size={20} />
        <Text size="sm" fw={500} c={GRAY_700}>{partnerName}</Text>
      </Group>
      <IconMinus size={14} style={{ color: GRAY_500 }} />
      <Group gap={6}>
        <AlgoliaLogo size={20} />
        <Text size="sm" fw={500} c={GRAY_700}>Algolia Customers</Text>
      </Group>
      <IconEqual size={14} style={{ color: GRAY_500 }} />
      <Badge color="blue" variant="filled" size="sm" styles={{ root: { color: '#fff' } }}>TARGETS</Badge>
    </Group>
  );
}

// KPI Card - clean design
interface KPICardProps {
  label: string;
  value: number;
  sublabel?: string;
  icon: React.ReactNode;
  color: string;
}

function KPICard({ label, value, sublabel, icon, color }: KPICardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const displayValue = useTransform(motionValue, Math.round);

  useEffect(() => {
    if (isInView && value > 0) {
      const animation = animate(motionValue, value, { duration: 1.5, ease: 'easeOut' });
      return animation.stop;
    }
  }, [isInView, value]);

  return (
    <Paper
      ref={ref}
      p="lg"
      radius="md"
      style={{
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: `1px solid ${GRAY_200}`,
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text size="sm" c={GRAY_500} fw={500}>{label}</Text>
        <ThemeIcon variant="light" color={color === ALGOLIA_BLUE ? 'blue' : color === '#dc2626' ? 'red' : color === '#ea580c' ? 'orange' : 'gray'} size="sm">
          {icon}
        </ThemeIcon>
      </Group>
      <motion.div style={{ fontSize: 32, fontWeight: 700, color: GRAY_900, lineHeight: 1 }}>
        {displayValue}
      </motion.div>
      {sublabel && (
        <Text size="xs" c={GRAY_500} mt={4}>{sublabel}</Text>
      )}
    </Paper>
  );
}

// Distribution Table - clean, professional
interface DistributionTableProps {
  distribution: DistributionData;
}

function DistributionTable({ distribution }: DistributionTableProps) {
  const { allVerticals, tiers, grandTotal } = distribution;

  // Sort by HOT priority: Hot×1000 + Warm×10 + Cold×1 (hot leads matter most)
  const sortedVerticals = [...allVerticals].sort((a, b) => {
    const priorityA = a.hot * 1000 + a.warm * 10 + a.cold;
    const priorityB = b.hot * 1000 + b.warm * 10 + b.cold;
    return priorityB - priorityA;
  });

  // Take top 6 verticals by HOT priority for display
  const displayVerticals = sortedVerticals.slice(0, 6);
  const otherVerticals = sortedVerticals.slice(6);
  const hasOther = otherVerticals.length > 0;

  // Calculate "Other" totals
  const otherTotals = {
    hot: otherVerticals.reduce((sum, v) => sum + v.hot, 0),
    warm: otherVerticals.reduce((sum, v) => sum + v.warm, 0),
    cold: otherVerticals.reduce((sum, v) => sum + v.cold, 0),
  };

  const pct = (n: number) => grandTotal > 0 ? ((n / grandTotal) * 100).toFixed(1) : '0';

  const shortName = (name: string) => {
    const map: Record<string, string> = {
      'Business And Industrial': 'Business',
      'Technology And Computing': 'Technology',
      'Automotive And Vehicles': 'Automotive',
      'Law, Govt And Politics': 'Government',
      'Health And Fitness': 'Healthcare',
      'Art And Entertainment': 'Entertainment',
      'Style And Fashion': 'Fashion',
      'Food And Drink': 'F&B',
      'Home And Garden': 'Home',
      'Hobbies And Interests': 'Hobbies',
      'Unknown': 'Other',
    };
    return map[name] || name;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${GRAY_200}` }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: GRAY_500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tier
            </th>
            {displayVerticals.map(v => (
              <th key={v.name} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: GRAY_700 }}>
                {shortName(v.name)}
              </th>
            ))}
            {hasOther && (
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: GRAY_500 }}>
                Other ({otherVerticals.length})
              </th>
            )}
            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: GRAY_500, textTransform: 'uppercase' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Hot Row */}
          <tr style={{ background: TIER_COLORS.hot.bg }}>
            <td style={{ padding: '16px', borderLeft: `4px solid ${TIER_COLORS.hot.text}` }}>
              <Text fw={700} c={TIER_COLORS.hot.text} size="sm">HOT</Text>
              <Text size="xs" c={GRAY_500}>80-100</Text>
            </td>
            {displayVerticals.map(v => (
              <td key={v.name} style={{ padding: '16px', textAlign: 'center' }}>
                <CellValue value={v.hot} color={TIER_COLORS.hot.text} />
              </td>
            ))}
            {hasOther && (
              <td style={{ padding: '16px', textAlign: 'center' }}>
                <CellValue value={otherTotals.hot} color={TIER_COLORS.hot.text} muted />
              </td>
            )}
            <td style={{ padding: '16px', textAlign: 'center', borderLeft: `1px solid ${GRAY_200}` }}>
              <Text fw={700} size="lg" c={TIER_COLORS.hot.text}>{tiers[0]?.total || 0}</Text>
              <Text size="xs" c={GRAY_500}>{pct(tiers[0]?.total || 0)}%</Text>
            </td>
          </tr>

          {/* Warm Row */}
          <tr style={{ background: TIER_COLORS.warm.bg }}>
            <td style={{ padding: '16px', borderLeft: `4px solid ${TIER_COLORS.warm.text}` }}>
              <Text fw={700} c={TIER_COLORS.warm.text} size="sm">WARM</Text>
              <Text size="xs" c={GRAY_500}>40-79</Text>
            </td>
            {displayVerticals.map(v => (
              <td key={v.name} style={{ padding: '16px', textAlign: 'center' }}>
                <CellValue value={v.warm} color={TIER_COLORS.warm.text} />
              </td>
            ))}
            {hasOther && (
              <td style={{ padding: '16px', textAlign: 'center' }}>
                <CellValue value={otherTotals.warm} color={TIER_COLORS.warm.text} muted />
              </td>
            )}
            <td style={{ padding: '16px', textAlign: 'center', borderLeft: `1px solid ${GRAY_200}` }}>
              <Text fw={700} size="lg" c={TIER_COLORS.warm.text}>{tiers[1]?.total || 0}</Text>
              <Text size="xs" c={GRAY_500}>{pct(tiers[1]?.total || 0)}%</Text>
            </td>
          </tr>

          {/* Cold Row */}
          <tr style={{ background: TIER_COLORS.cold.bg }}>
            <td style={{ padding: '16px', borderLeft: `4px solid ${TIER_COLORS.cold.text}` }}>
              <Text fw={700} c={TIER_COLORS.cold.text} size="sm">COLD</Text>
              <Text size="xs" c={GRAY_500}>0-39</Text>
            </td>
            {displayVerticals.map(v => (
              <td key={v.name} style={{ padding: '16px', textAlign: 'center' }}>
                <CellValue value={v.cold} color={TIER_COLORS.cold.text} />
              </td>
            ))}
            {hasOther && (
              <td style={{ padding: '16px', textAlign: 'center' }}>
                <CellValue value={otherTotals.cold} color={TIER_COLORS.cold.text} muted />
              </td>
            )}
            <td style={{ padding: '16px', textAlign: 'center', borderLeft: `1px solid ${GRAY_200}` }}>
              <Text fw={700} size="lg" c={TIER_COLORS.cold.text}>{tiers[2]?.total || 0}</Text>
              <Text size="xs" c={GRAY_500}>{pct(tiers[2]?.total || 0)}%</Text>
            </td>
          </tr>

          {/* Column Totals */}
          <tr style={{ borderTop: `2px solid ${GRAY_200}`, background: 'white' }}>
            <td style={{ padding: '12px 16px' }}>
              <Text fw={600} c={GRAY_700} size="sm">TOTAL</Text>
            </td>
            {displayVerticals.map(v => (
              <td key={v.name} style={{ padding: '12px 16px', textAlign: 'center' }}>
                <Text fw={600} c={GRAY_700}>{v.total}</Text>
              </td>
            ))}
            {hasOther && (
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                <Text fw={600} c={GRAY_500}>{otherTotals.hot + otherTotals.warm + otherTotals.cold}</Text>
              </td>
            )}
            <td style={{ padding: '12px 16px', textAlign: 'center', borderLeft: `1px solid ${GRAY_200}` }}>
              <Text fw={700} size="lg" c={ALGOLIA_BLUE}>{grandTotal}</Text>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Cell Value - clean number display
function CellValue({ value, color, muted }: { value: number; color: string; muted?: boolean }) {
  if (value === 0) {
    return <Text c="#94a3b8" size="sm">—</Text>;
  }
  return (
    <Text fw={600} size="md" c={muted ? GRAY_500 : color}>
      {value.toLocaleString()}
    </Text>
  );
}

export default Dashboard;
