/**
 * Dashboard Page
 *
 * Clean, focused dashboard with visual formula hero and compact metrics row.
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
  Stack,
  Tabs,
} from '@mantine/core';
import {
  IconMinus,
  IconEqual,
  IconTarget,
  IconFlame,
  IconChartPie,
  IconBuildingSkyscraper,
  IconCode,
} from '@tabler/icons-react';
import { DonutChart, BarList } from '@tremor/react';

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

      {/* Three Column Metrics Row */}
      <Grid mb="lg" gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <StatusBreakdown stats={stats} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <TopScoresChart />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <PartnerTechBreakdown />
        </Grid.Col>
      </Grid>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
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
      className="mb-6"
    >
      <Paper
        p="lg"
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
          <Group align="flex-end" gap="md" mb="md">
            <motion.span
              className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent"
            >
              {displayTotal}
            </motion.span>
            <Text size="lg" c="white/70" mb="xs">
              Displacement Targets
            </Text>
          </Group>

          {/* Visual Formula: Partner Logo − Algolia Logo = Targets */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Companies using partner tech */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <PartnerLogo size={24} />
              <Text size="sm" c="white" fw={500}>{partnerName}</Text>
            </div>

            {/* Minus */}
            <IconMinus size={16} className="text-red-400" />

            {/* Already using Algolia */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <AlgoliaLogo size={24} />
              <Text size="sm" c="white" fw={500}>Algolia</Text>
            </div>

            {/* Equals */}
            <IconEqual size={16} className="text-green-400" />

            {/* Result */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <IconTarget size={20} className="text-blue-400" />
              <Text size="sm" c="white" fw={600}>
                {stats?.total_companies?.toLocaleString() || '...'} targets
              </Text>
            </div>
          </div>
        </div>
      </Paper>
    </motion.div>
  );
}

// Status Breakdown - Compact Pie Chart
interface StatusBreakdownProps {
  stats?: DashboardStats;
}

function StatusBreakdown({ stats }: StatusBreakdownProps) {
  const statusData = [
    { name: 'Hot', value: stats?.hot_leads || 9 },
    { name: 'Warm', value: stats?.warm_leads || 49 },
    { name: 'Cool', value: 150 },
    { name: 'Cold', value: 200 },
  ];

  const colors: Record<string, string> = {
    Hot: '#ef4444',
    Warm: '#f97316',
    Cool: '#3b82f6',
    Cold: '#6b7280',
  };

  return (
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10 h-full">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconChartPie size={16} className="text-blue-400" />
          <Text fw={600} size="sm" c="white">By Status</Text>
        </Group>
        <Badge size="xs" variant="light" color="red">
          {stats?.hot_leads || 9} Hot
        </Badge>
      </Group>

      <div className="h-32">
        <DonutChart
          data={statusData}
          category="value"
          index="name"
          colors={['red', 'orange', 'blue', 'slate']}
          showAnimation
          showTooltip
        />
      </div>

      <Stack gap={4} mt="sm">
        {statusData.map((item) => (
          <Group key={item.name} justify="space-between">
            <Group gap="xs">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors[item.name] }}
              />
              <Text size="xs" c="dimmed">{item.name}</Text>
            </Group>
            <Text size="xs" c="white" fw={500}>{item.value}</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

// Top Scores Chart - Compact
function TopScoresChart() {
  const data = [
    { name: 'Mercedes-Benz', value: 95 },
    { name: "Mark's", value: 85 },
    { name: 'Infiniti', value: 85 },
    { name: 'Allianz', value: 85 },
    { name: 'Chevrolet Mexico', value: 85 },
  ];

  return (
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10 h-full">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconFlame size={16} className="text-orange-400" />
          <Text fw={600} size="sm" c="white">Top ICP Scores</Text>
        </Group>
        <Badge size="xs" variant="light" color="blue">Top 5</Badge>
      </Group>
      <BarList data={data} color="blue" className="mt-2" />
    </Paper>
  );
}

// Partner Tech Breakdown - Compact
function PartnerTechBreakdown() {
  const data = [
    { name: 'Adobe AEM', value: 2687 },
    { name: 'Shopify', value: 1500 },
    { name: 'Salesforce Commerce', value: 890 },
    { name: 'BigCommerce', value: 450 },
    { name: 'Magento', value: 320 },
  ];

  return (
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10 h-full">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconCode size={16} className="text-violet-400" />
          <Text fw={600} size="sm" c="white">Partner Technology</Text>
        </Group>
        <Badge size="xs" variant="light" color="violet">All</Badge>
      </Group>
      <BarList data={data} color="violet" className="mt-2" />
    </Paper>
  );
}

export default Dashboard;
