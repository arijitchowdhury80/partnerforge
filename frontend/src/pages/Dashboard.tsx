/**
 * Dashboard Page
 *
 * Main dashboard with premium KPI cards, hero section, and target overview.
 * Championship-level UI with glassmorphism and animations.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Title,
  Text,
  Group,
  Paper,
  Badge,
  Button,
  TextInput,
  SegmentedControl,
  SimpleGrid,
  Grid,
  Stack,
  ThemeIcon,
  RingProgress,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconFilter,
  IconTarget,
  IconDatabase,
  IconFlame,
  IconSun,
  IconTrendingUp,
  IconCheck,
  IconClock,
  IconUpload,
  IconSparkles,
  IconChartBar,
  IconBrandAdobe,
} from '@tabler/icons-react';
import { DonutChart, AreaChart, BarList } from '@tremor/react';
import { formatDistanceToNow } from 'date-fns';

import { getStats, getCompanies } from '@/services/api';
import { TargetList } from '@/components/targets/TargetList';
import type { FilterState, DashboardStats } from '@/types';

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>({
    sort_by: 'icp_score',
    sort_order: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Fetch stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  // Fetch companies
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', filters, page],
    queryFn: () => getCompanies({ ...filters, page, limit: 20 }),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <Container size="xl" py="md">
      {/* Hero Section */}
      <HeroSection stats={stats} isLoading={statsLoading} />

      {/* KPI Cards */}
      <KPISection stats={stats} isLoading={statsLoading} />

      {/* Charts Row */}
      <Grid mb="lg">
        {/* Lead Distribution */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <LeadDistributionChart stats={stats} />
        </Grid.Col>

        {/* Enrichment Trend */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <EnrichmentTrendChart />
        </Grid.Col>

        {/* Quick Stats */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <QuickStatsPanel stats={stats} />
        </Grid.Col>
      </Grid>

      {/* Top Targets */}
      <Grid mb="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <TopScoresChart />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <PartnerTechBreakdown />
        </Grid.Col>
      </Grid>

      {/* Filters */}
      <Paper
        p="md"
        mb="lg"
        radius="lg"
        className="bg-white/5 border border-white/10"
      >
        <Group justify="space-between" wrap="wrap" gap="md">
          <TextInput
            placeholder="Search companies..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] max-w-[400px]"
            classNames={{
              input: 'bg-white/5 border-white/10 text-white placeholder:text-white/40',
            }}
          />

          <Group gap="md">
            <SegmentedControl
              value={filters.status || 'all'}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  status: value === 'all' ? undefined : (value as 'hot' | 'warm' | 'cool' | 'cold'),
                }))
              }
              data={[
                { label: 'All', value: 'all' },
                { label: 'Hot', value: 'hot' },
                { label: 'Warm', value: 'warm' },
                { label: 'Cool', value: 'cool' },
              ]}
              size="xs"
              classNames={{
                root: 'bg-white/5',
              }}
            />

            <Button
              variant="subtle"
              leftSection={<IconFilter size={16} />}
              size="sm"
            >
              More Filters
            </Button>

            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={handleRefresh}
              size="sm"
            >
              Refresh
            </Button>
          </Group>
        </Group>
      </Paper>

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
              Companies using partner tech that should be using Algolia
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

// Hero Section Component
interface HeroSectionProps {
  stats?: DashboardStats;
  isLoading: boolean;
}

function HeroSection({ stats, isLoading }: HeroSectionProps) {
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

        {/* Floating elements */}
        <motion.div
          className="absolute top-8 right-8 p-4 rounded-2xl bg-white/5 border border-white/10"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <IconBrandAdobe size={32} className="text-white/40" />
        </motion.div>

        <div className="relative z-10">
          <Badge
            variant="light"
            color="blue"
            size="lg"
            leftSection={<IconSparkles size={14} />}
            mb="md"
          >
            Partner Intelligence Platform
          </Badge>

          <Group align="flex-end" gap="md" mb="md">
            <motion.span
              className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent"
            >
              {displayTotal}
            </motion.span>
            <Text size="xl" c="white/70" mb="sm">
              Displacement Targets
            </Text>
          </Group>

          <Text c="dimmed" size="lg" mb="lg" maw={600}>
            Companies using partner technologies (Adobe AEM, Shopify) who are NOT using Algolia.
            Your co-sell pipeline starts here.
          </Text>

          <Group gap="md">
            <MetricBadge
              icon={<IconFlame size={14} />}
              label="Hot Leads"
              value={stats?.hot_leads || 0}
              color="red"
            />
            <MetricBadge
              icon={<IconSun size={14} />}
              label="Warm Leads"
              value={stats?.warm_leads || 0}
              color="orange"
            />
            <MetricBadge
              icon={<IconCheck size={14} />}
              label="Enriched"
              value={stats?.enriched_companies || 0}
              color="green"
            />
          </Group>
        </div>
      </Paper>
    </motion.div>
  );
}

// Metric Badge Component
interface MetricBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function MetricBadge({ icon, label, value, color }: MetricBadgeProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full
        bg-${color}-500/20 border border-${color}-500/30
      `}
    >
      <span className={`text-${color}-400`}>{icon}</span>
      <Text size="sm" c="white" fw={600}>{value.toLocaleString()}</Text>
      <Text size="sm" c="dimmed">{label}</Text>
    </motion.div>
  );
}

// KPI Section Component
interface KPISectionProps {
  stats?: DashboardStats;
  isLoading: boolean;
}

function KPISection({ stats, isLoading }: KPISectionProps) {
  const kpis = [
    {
      title: 'Total Companies',
      value: stats?.total_companies || 0,
      icon: IconDatabase,
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
      trend: 12,
    },
    {
      title: 'Enriched',
      value: stats?.enriched_companies || 0,
      icon: IconCheck,
      gradient: 'from-green-500/20 to-emerald-500/20',
      iconColor: 'text-green-400',
      trend: 8,
    },
    {
      title: 'Hot Leads',
      value: stats?.hot_leads || 0,
      icon: IconFlame,
      gradient: 'from-red-500/20 to-orange-500/20',
      iconColor: 'text-red-400',
      trend: 15,
    },
    {
      title: 'Warm Leads',
      value: stats?.warm_leads || 0,
      icon: IconSun,
      gradient: 'from-orange-500/20 to-yellow-500/20',
      iconColor: 'text-orange-400',
      trend: -3,
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg">
      {kpis.map((kpi, index) => (
        <KPICard key={kpi.title} kpi={kpi} index={index} isLoading={isLoading} />
      ))}
    </SimpleGrid>
  );
}

// KPI Card Component
interface KPICardProps {
  kpi: {
    title: string;
    value: number;
    icon: React.ElementType;
    gradient: string;
    iconColor: string;
    trend: number;
  };
  index: number;
  isLoading: boolean;
}

function KPICard({ kpi, index, isLoading }: KPICardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    if (isInView && !isLoading) {
      const animation = animate(count, kpi.value, {
        duration: 1.5,
        ease: 'easeOut',
      });
      return animation.stop;
    }
  }, [isInView, kpi.value, isLoading]);

  const Icon = kpi.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -4 }}
    >
      <Paper
        p="lg"
        radius="lg"
        className={`
          relative overflow-hidden backdrop-blur-xl
          bg-gradient-to-br ${kpi.gradient}
          border border-white/10 hover:border-white/20
          transition-all duration-300
        `}
      >
        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(84, 104, 255, 0.15), transparent 70%)`,
          }}
        />

        <div className="relative z-10">
          <Group justify="space-between" mb="md">
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" className="tracking-wider">
              {kpi.title}
            </Text>
            <div className={`p-2 rounded-lg bg-white/10 ${kpi.iconColor}`}>
              <Icon size={18} />
            </div>
          </Group>

          {isLoading ? (
            <div className="h-10 w-24 bg-white/10 rounded animate-pulse" />
          ) : (
            <motion.span className="text-3xl font-bold text-white">
              {rounded}
            </motion.span>
          )}

          <Group gap="xs" mt="sm">
            <Badge
              size="sm"
              variant="light"
              color={kpi.trend >= 0 ? 'green' : 'red'}
              leftSection={
                kpi.trend >= 0
                  ? <IconTrendingUp size={12} />
                  : <IconTrendingUp size={12} style={{ transform: 'rotate(180deg)' }} />
              }
            >
              {kpi.trend >= 0 ? '+' : ''}{kpi.trend}%
            </Badge>
            <Text size="xs" c="dimmed">vs last month</Text>
          </Group>
        </div>
      </Paper>
    </motion.div>
  );
}

// Lead Distribution Chart
function LeadDistributionChart({ stats }: { stats?: DashboardStats }) {
  const data = [
    { name: 'Hot', value: stats?.hot_leads || 0 },
    { name: 'Warm', value: stats?.warm_leads || 0 },
    { name: 'Cool', value: 50 },
    { name: 'Cold', value: 100 },
  ];

  return (
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10 h-full">
      <Group justify="space-between" mb="md">
        <Text fw={600} c="white">Lead Distribution</Text>
        <Badge variant="light" size="sm" color="blue">Live</Badge>
      </Group>
      <DonutChart
        data={data}
        category="value"
        index="name"
        colors={['red', 'orange', 'blue', 'gray']}
        showAnimation
      />
    </Paper>
  );
}

// Enrichment Trend Chart
function EnrichmentTrendChart() {
  const data = [
    { date: 'Jan', Enriched: 500, New: 200 },
    { date: 'Feb', Enriched: 800, New: 350 },
    { date: 'Mar', Enriched: 1200, New: 400 },
    { date: 'Apr', Enriched: 1800, New: 300 },
    { date: 'May', Enriched: 2200, New: 450 },
    { date: 'Jun', Enriched: 2687, New: 500 },
  ];

  return (
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10 h-full">
      <Group justify="space-between" mb="md">
        <Text fw={600} c="white">Enrichment Trend</Text>
        <Badge variant="light" color="green" size="sm" leftSection={<IconTrendingUp size={12} />}>
          +23%
        </Badge>
      </Group>
      <AreaChart
        data={data}
        index="date"
        categories={['Enriched', 'New']}
        colors={['blue', 'cyan']}
        showAnimation
        showLegend={false}
        curveType="monotone"
      />
    </Paper>
  );
}

// Quick Stats Panel
function QuickStatsPanel({ stats }: { stats?: DashboardStats }) {
  const enrichmentProgress = stats?.enriched_companies && stats?.total_companies
    ? Math.round((stats.enriched_companies / stats.total_companies) * 100)
    : 0;

  return (
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10 h-full">
      <Text fw={600} c="white" mb="md">Overall Progress</Text>
      <div className="flex justify-center mb-4">
        <RingProgress
          size={120}
          thickness={12}
          roundCaps
          sections={[{ value: enrichmentProgress, color: 'blue' }]}
          label={
            <Text ta="center" fw={700} size="lg" c="white">
              {enrichmentProgress}%
            </Text>
          }
        />
      </div>
      <Text size="sm" c="dimmed" ta="center" mb="md">
        {stats?.enriched_companies || 0} of {stats?.total_companies || 0} enriched
      </Text>

      <Text fw={600} size="sm" c="white" mb="xs">Recent Activity</Text>
      <Stack gap="xs">
        {[
          { company: 'Mercedes-Benz', time: '5 min ago' },
          { company: 'Adobe AEM Targets', time: '30 min ago' },
          { company: 'Infiniti', time: '1 hour ago' },
        ].map((item) => (
          <Group key={item.company} gap="xs" wrap="nowrap">
            <ThemeIcon size="xs" variant="light" color="blue">
              <IconCheck size={10} />
            </ThemeIcon>
            <div className="flex-1 min-w-0">
              <Text size="xs" c="white" truncate>{item.company}</Text>
              <Text size="xs" c="dimmed">{item.time}</Text>
            </div>
          </Group>
        ))}
      </Stack>
    </Paper>
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
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10">
      <Text fw={600} c="white" mb="md">Top ICP Scores</Text>
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
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10">
      <Text fw={600} c="white" mb="md">Partner Technology Breakdown</Text>
      <BarList data={data} color="violet" />
    </Paper>
  );
}

export default Dashboard;
