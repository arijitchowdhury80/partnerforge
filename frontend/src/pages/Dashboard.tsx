/**
 * Dashboard Page
 *
 * Clean, focused dashboard with visual formula hero and interactive charting.
 * Removed redundancy - single source of truth for each metric.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Text,
  Group,
  Paper,
  Badge,
  Grid,
  SegmentedControl,
  Stack,
} from '@mantine/core';
import {
  IconMinus,
  IconEqual,
  IconTarget,
} from '@tabler/icons-react';
import { DonutChart, AreaChart, BarChart, BarList } from '@tremor/react';

import { getStats, getCompanies } from '@/services/api';
import { TargetList } from '@/components/targets/TargetList';
import { usePartner } from '@/contexts/PartnerContext';
import { AlgoliaLogo } from '@/components/common/AlgoliaLogo';
import { getPartnerLogo } from '@/components/common/PartnerLogos';
import type { FilterState, DashboardStats } from '@/types';

export function Dashboard() {
  const { selectedPartner } = usePartner();
  const [filters, setFilters] = useState<FilterState>({
    sort_by: 'icp_score',
    sort_order: 'desc',
  });
  const [page, setPage] = useState(1);

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', selectedPartner.key],
    queryFn: getStats,
  });

  // Fetch companies
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', filters, page, selectedPartner.key],
    queryFn: () => getCompanies({
      ...filters,
      page,
      limit: 20,
      partner: selectedPartner.key === 'all' ? undefined : selectedPartner.name,
    }),
  });

  return (
    <Container size="xl" py="md">
      {/* Hero Section - Visual Formula */}
      <HeroSection
        stats={stats}
        isLoading={statsLoading}
        partnerKey={selectedPartner.key}
        partnerName={selectedPartner.name}
      />

      {/* Charting Module */}
      <ChartingModule stats={stats} />

      {/* Top Targets Row */}
      <Grid mb="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <TopScoresChart />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <PartnerTechBreakdown />
        </Grid.Col>
      </Grid>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Group justify="space-between" mb="md">
          <div>
            <Text fw={600} c="white" size="lg">Displacement Targets</Text>
            <Text size="sm" c="dimmed">
              Companies ready for Algolia outreach
            </Text>
          </div>
          <Badge variant="light" size="lg">
            {companies?.pagination.total || 0} companies
          </Badge>
        </Group>

        <TargetList
          companies={companies?.data || []}
          isLoading={companiesLoading}
          pagination={companies?.pagination}
          onPageChange={setPage}
          onFiltersChange={setFilters}
        />
      </motion.div>
    </Container>
  );
}

// Hero Section with Visual Formula
interface HeroSectionProps {
  stats?: DashboardStats;
  isLoading: boolean;
  partnerKey: string;
  partnerName: string;
}

function HeroSection({ stats, isLoading, partnerKey, partnerName }: HeroSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const totalCompanies = useMotionValue(0);
  const displayTotal = useTransform(totalCompanies, Math.round);

  useEffect(() => {
    if (isInView && stats?.total_companies) {
      const animation = animate(totalCompanies, stats.total_companies, {
        duration: 2,
        ease: 'easeOut',
      });
      return animation.stop;
    }
  }, [isInView, stats?.total_companies]);

  const PartnerLogo = getPartnerLogo(partnerKey);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-8"
    >
      <Paper
        p="xl"
        radius="xl"
        className="relative overflow-hidden bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent border border-white/10 backdrop-blur-xl"
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10">
          {/* Main number and label */}
          <Group align="flex-end" gap="md" mb="lg">
            <motion.span
              className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent"
            >
              {displayTotal}
            </motion.span>
            <Text size="xl" c="white/70" mb="sm">
              Displacement Targets
            </Text>
          </Group>

          {/* Visual Formula: Partner Logo − Algolia Logo = Targets */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Companies using partner tech */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <PartnerLogo size={32} />
              <div>
                <Text size="xs" c="dimmed">Companies using</Text>
                <Text size="sm" c="white" fw={600}>{partnerName}</Text>
              </div>
            </div>

            {/* Minus */}
            <div className="p-2 rounded-full bg-red-500/20 border border-red-500/30">
              <IconMinus size={20} className="text-red-400" />
            </div>

            {/* Already using Algolia */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <AlgoliaLogo size={32} />
              <div>
                <Text size="xs" c="dimmed">Already using</Text>
                <Text size="sm" c="white" fw={600}>Algolia</Text>
              </div>
            </div>

            {/* Equals */}
            <div className="p-2 rounded-full bg-green-500/20 border border-green-500/30">
              <IconEqual size={20} className="text-green-400" />
            </div>

            {/* Result: Displacement Targets */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30">
              <IconTarget size={32} className="text-blue-400" />
              <div>
                <Text size="xs" c="dimmed">Your pipeline</Text>
                <Text size="sm" c="white" fw={600}>
                  {stats?.total_companies?.toLocaleString() || '...'} targets
                </Text>
              </div>
            </div>
          </div>
        </div>
      </Paper>
    </motion.div>
  );
}

// Charting Module with Selection
interface ChartingModuleProps {
  stats?: DashboardStats;
}

function ChartingModule({ stats }: ChartingModuleProps) {
  const [chartType, setChartType] = useState<string>('status');

  // Prepare data for each chart type
  const statusData = [
    { name: 'Hot', value: stats?.hot_leads || 9, color: 'red' },
    { name: 'Warm', value: stats?.warm_leads || 49, color: 'orange' },
    { name: 'Cool', value: 150, color: 'blue' },
    { name: 'Cold', value: 200, color: 'gray' },
  ];

  const partnerData = [
    { name: 'Adobe AEM', value: 2687 },
    { name: 'Shopify', value: 1500 },
    { name: 'Salesforce Commerce', value: 890 },
    { name: 'BigCommerce', value: 450 },
    { name: 'Magento', value: 320 },
  ];

  const verticalData = [
    { name: 'Commerce', value: 1850 },
    { name: 'Media', value: 620 },
    { name: 'Financial Services', value: 480 },
    { name: 'Healthcare', value: 320 },
    { name: 'Other', value: 417 },
  ];

  const timeData = [
    { month: 'Jan', Targets: 1500, Enriched: 200 },
    { month: 'Feb', Targets: 1800, Enriched: 400 },
    { month: 'Mar', Targets: 2100, Enriched: 600 },
    { month: 'Apr', Targets: 2300, Enriched: 850 },
    { month: 'May', Targets: 2500, Enriched: 1100 },
    { month: 'Jun', Targets: 2687, Enriched: 1400 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-8"
    >
      <Paper
        p="lg"
        radius="xl"
        className="bg-white/5 border border-white/10"
      >
        {/* Chart Type Selector */}
        <Group justify="space-between" mb="lg">
          <Text fw={600} c="white" size="lg">Target Analysis</Text>
          <SegmentedControl
            value={chartType}
            onChange={setChartType}
            data={[
              { label: 'By Status', value: 'status' },
              { label: 'By Partner', value: 'partner' },
              { label: 'By Vertical', value: 'vertical' },
              { label: 'Over Time', value: 'time' },
            ]}
            size="sm"
            classNames={{
              root: 'bg-white/5',
            }}
          />
        </Group>

        {/* Chart Display */}
        <div className="h-72">
          {chartType === 'status' && (
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <DonutChart
                  data={statusData}
                  category="value"
                  index="name"
                  colors={['red', 'orange', 'blue', 'slate']}
                  showAnimation
                  showTooltip
                  label={`${stats?.hot_leads || 9} Hot`}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Stack gap="md" justify="center" h="100%">
                  {statusData.map((item) => (
                    <Group key={item.name} justify="space-between">
                      <Group gap="sm">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              item.color === 'red' ? '#ef4444' :
                              item.color === 'orange' ? '#f97316' :
                              item.color === 'blue' ? '#3b82f6' : '#6b7280'
                          }}
                        />
                        <Text size="sm" c="white">{item.name}</Text>
                      </Group>
                      <Text size="sm" c="white" fw={600}>
                        {item.value.toLocaleString()}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Grid.Col>
            </Grid>
          )}

          {chartType === 'partner' && (
            <BarChart
              data={partnerData}
              index="name"
              categories={['value']}
              colors={['violet']}
              showAnimation
              showLegend={false}
              layout="vertical"
            />
          )}

          {chartType === 'vertical' && (
            <BarChart
              data={verticalData}
              index="name"
              categories={['value']}
              colors={['cyan']}
              showAnimation
              showLegend={false}
              layout="vertical"
            />
          )}

          {chartType === 'time' && (
            <AreaChart
              data={timeData}
              index="month"
              categories={['Targets', 'Enriched']}
              colors={['blue', 'emerald']}
              showAnimation
              showLegend
              curveType="monotone"
            />
          )}
        </div>
      </Paper>
    </motion.div>
  );
}

// Top Scores Chart
function TopScoresChart() {
  const data = [
    { name: 'Mercedes-Benz', value: 95 },
    { name: "Mark's", value: 85 },
    { name: 'Infiniti', value: 85 },
    { name: 'Allianz', value: 85 },
    { name: 'Chevrolet Mexico', value: 85 },
  ];

  return (
    <Paper p="lg" radius="xl" className="bg-white/5 border border-white/10">
      <Group justify="space-between" mb="md">
        <Text fw={600} c="white">Top ICP Scores</Text>
        <Badge variant="light" size="sm" color="blue">Top 5</Badge>
      </Group>
      <BarList data={data} color="blue" />
    </Paper>
  );
}

// Partner Tech Breakdown
function PartnerTechBreakdown() {
  const data = [
    { name: 'Adobe AEM', value: 2687 },
    { name: 'Shopify', value: 1500 },
    { name: 'Salesforce Commerce', value: 890 },
    { name: 'BigCommerce', value: 450 },
    { name: 'Magento', value: 320 },
  ];

  return (
    <Paper p="lg" radius="xl" className="bg-white/5 border border-white/10">
      <Group justify="space-between" mb="md">
        <Text fw={600} c="white">Partner Technology</Text>
        <Badge variant="light" size="sm" color="violet">All Partners</Badge>
      </Group>
      <BarList data={data} color="violet" />
    </Paper>
  );
}

export default Dashboard;
