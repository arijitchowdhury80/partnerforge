/**
 * DashboardPage - Main Dashboard View
 *
 * Overview of partner intelligence with stats, charts, and recent activity.
 */

import { useState } from 'react';
import {
  Container,
  Title,
  Grid,
  Paper,
  Group,
  Text,
  Badge,
  Button,
  SegmentedControl,
  TextInput,
  SimpleGrid,
  Box,
  ThemeIcon,
  Stack,
  RingProgress,
  Timeline,
  Skeleton,
  Tooltip,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconFilter,
  IconTarget,
  IconBolt,
  IconBuilding,
  IconCheck,
  IconClock,
  IconTrendingUp,
  IconDatabase,
  IconArrowUpRight,
  IconArrowDownRight,
} from '@tabler/icons-react';
import { Card, Metric, Text as TremorText, DonutChart, BarList, AreaChart } from '@tremor/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

import { getStats, getCompanies } from '@/services/api';
import { TargetTable } from '@/components/dashboard/TargetTable';
import { ICPVerticalHeatmap } from '@/components/dashboard/ICPVerticalHeatmap';
import type { FilterState } from '@/types';

// Stat card component with trend indicator
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  trend?: number;
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, color, trend, loading }: StatCardProps) {
  return (
    <Paper
      p="lg"
      withBorder
      style={{
        background: `linear-gradient(135deg, rgba(var(--mantine-color-${color}-5-rgb), 0.1), rgba(var(--mantine-color-${color}-5-rgb), 0.02))`,
        borderColor: `rgba(var(--mantine-color-${color}-5-rgb), 0.2)`,
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="xs" tt="uppercase" fw={500} c="dimmed">
            {title}
          </Text>
          {loading ? (
            <Skeleton height={36} width={80} mt="xs" />
          ) : (
            <Text size="xl" fw={700} mt="xs">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Text>
          )}
          {trend !== undefined && !loading && (
            <Group gap="xs" mt="xs">
              {trend >= 0 ? (
                <IconArrowUpRight size={14} color="var(--mantine-color-green-6)" />
              ) : (
                <IconArrowDownRight size={14} color="var(--mantine-color-red-6)" />
              )}
              <Text size="xs" c={trend >= 0 ? 'green' : 'red'}>
                {trend >= 0 ? '+' : ''}{trend}% from last week
              </Text>
            </Group>
          )}
        </div>
        <ThemeIcon size="xl" radius="md" variant="light" color={color}>
          <Icon size={24} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

// Recent activity mock data
const recentActivity = [
  { id: 1, action: 'Enrichment complete', company: 'Mercedes-Benz', time: new Date(Date.now() - 300000) },
  { id: 2, action: 'New list uploaded', company: 'Adobe AEM Targets', time: new Date(Date.now() - 1800000) },
  { id: 3, action: 'Hot lead identified', company: 'Infiniti', time: new Date(Date.now() - 3600000) },
  { id: 4, action: 'Enrichment complete', company: "Mark's", time: new Date(Date.now() - 7200000) },
];

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>({
    sort_by: 'icp_score',
    sort_order: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', filters],
    queryFn: () => getCompanies({ ...filters, limit: 50 }),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  const statusData = [
    { name: 'Hot', value: stats?.hot_leads || 0 },
    { name: 'Warm', value: stats?.warm_leads || 0 },
    { name: 'Cold', value: stats?.cold_leads || 0 },
  ];

  const trendData = [
    { date: 'Jan', Enriched: 500, New: 200 },
    { date: 'Feb', Enriched: 800, New: 350 },
    { date: 'Mar', Enriched: 1200, New: 400 },
    { date: 'Apr', Enriched: 1800, New: 300 },
    { date: 'May', Enriched: 2200, New: 450 },
    { date: 'Jun', Enriched: 2687, New: 500 },
  ];

  const enrichmentProgress = stats?.enriched_companies && stats?.total_companies
    ? Math.round((stats.enriched_companies / stats.total_companies) * 100)
    : 0;

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap="md" align="baseline">
            <Title order={2}>Partner Intelligence Dashboard</Title>
            <Group gap="xs">
              <Tooltip label="ICP Score 80-100: High-value displacement targets" withArrow>
                <Badge color="red" variant="filled" size="sm" style={{ cursor: 'help' }}>
                  Hot ({stats?.hot_leads || 0})
                </Badge>
              </Tooltip>
              <Tooltip label="ICP Score 60-79: Medium-priority targets" withArrow>
                <Badge color="orange" variant="filled" size="sm" style={{ cursor: 'help' }}>
                  Warm ({stats?.warm_leads || 0})
                </Badge>
              </Tooltip>
              <Tooltip label="ICP Score 0-59: Lower-priority targets" withArrow>
                <Badge color="gray" variant="filled" size="sm" style={{ cursor: 'help' }}>
                  Cold ({(stats?.total_companies || 0) - (stats?.hot_leads || 0) - (stats?.warm_leads || 0)})
                </Badge>
              </Tooltip>
            </Group>
          </Group>
          <Text c="dimmed" size="sm">
            Track displacement targets and enrichment progress
          </Text>
        </div>
        <Tooltip label="Refresh all data from API" withArrow>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Tooltip>
      </Group>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg">
        <StatCard
          title="Total Companies"
          value={stats?.total_companies || 0}
          icon={IconDatabase}
          color="blue"
          trend={12}
          loading={statsLoading}
        />
        <StatCard
          title="Enriched"
          value={stats?.enriched_companies || 0}
          icon={IconCheck}
          color="green"
          trend={8}
          loading={statsLoading}
        />
        <StatCard
          title="Hot Leads"
          value={stats?.hot_leads || 0}
          icon={IconTarget}
          color="red"
          trend={15}
          loading={statsLoading}
        />
        <StatCard
          title="Warm Leads"
          value={stats?.warm_leads || 0}
          icon={IconBolt}
          color="orange"
          trend={-3}
          loading={statsLoading}
        />
      </SimpleGrid>

      {/* ICP vs Vertical Heatmap */}
      <Box mb="lg">
        <ICPVerticalHeatmap loading={statsLoading} />
      </Box>

      {/* Charts Row */}
      <Grid mb="lg">
        {/* Lead Distribution */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" withBorder h="100%">
            <Group justify="space-between" mb="md">
              <Tooltip label="Breakdown of targets by ICP score tier" withArrow>
                <Text fw={500} style={{ cursor: 'help' }}>Lead Distribution</Text>
              </Tooltip>
              <Tooltip label="Data updates in real-time" withArrow>
                <Badge variant="light" size="sm" style={{ cursor: 'help' }}>Live</Badge>
              </Tooltip>
            </Group>
            <DonutChart
              data={statusData}
              category="value"
              index="name"
              colors={['red', 'orange', 'blue', 'gray']}
              showAnimation
            />
          </Paper>
        </Grid.Col>

        {/* Enrichment Trend */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper p="md" withBorder h="100%">
            <Group justify="space-between" mb="md">
              <Tooltip label="Monthly enrichment progress over time" withArrow>
                <Text fw={500} style={{ cursor: 'help' }}>Enrichment Trend</Text>
              </Tooltip>
              <Tooltip label="Growth from previous month" withArrow>
                <Badge variant="light" color="green" size="sm" style={{ cursor: 'help' }}>
                  <Group gap={4}>
                    <IconTrendingUp size={12} />
                    +23%
                  </Group>
                </Badge>
              </Tooltip>
            </Group>
            <AreaChart
              data={trendData}
              index="date"
              categories={['Enriched', 'New']}
              colors={['blue', 'cyan']}
              showAnimation
              showLegend={false}
              curveType="monotone"
            />
          </Paper>
        </Grid.Col>

        {/* Enrichment Progress & Activity */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Paper p="md" withBorder h="100%">
            <Text fw={500} mb="md">Overall Progress</Text>
            <Box ta="center" mb="md">
              <RingProgress
                size={120}
                thickness={12}
                roundCaps
                sections={[{ value: enrichmentProgress, color: 'blue' }]}
                label={
                  <Text ta="center" fw={700} size="lg">
                    {enrichmentProgress}%
                  </Text>
                }
              />
              <Text size="sm" c="dimmed" mt="xs">
                {stats?.enriched_companies || 0} of {stats?.total_companies || 0} enriched
              </Text>
            </Box>

            <Text fw={500} size="sm" mb="xs">Recent Activity</Text>
            <Stack gap="xs">
              {recentActivity.slice(0, 3).map((activity) => (
                <Group key={activity.id} gap="xs" wrap="nowrap">
                  <ThemeIcon size="xs" variant="light" color="blue">
                    <IconCheck size={10} />
                  </ThemeIcon>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" truncate>{activity.company}</Text>
                    <Text size="xs" c="dimmed">
                      {formatDistanceToNow(activity.time, { addSuffix: true })}
                    </Text>
                  </div>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Top ICP Scores */}
      <Grid mb="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <Tooltip label="Companies with highest Ideal Customer Profile scores" withArrow>
              <Text fw={500} mb="md" style={{ cursor: 'help' }}>Top ICP Scores</Text>
            </Tooltip>
            <BarList
              data={[
                { name: 'Mercedes-Benz', value: 95, icon: () => <IconBuilding size={16} /> },
                { name: "Mark's", value: 85 },
                { name: 'Infiniti', value: 85 },
                { name: 'Allianz', value: 85 },
                { name: 'Chevrolet Mexico', value: 85 },
              ]}
              color="blue"
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <Tooltip label="Distribution of targets by partner technology stack" withArrow>
              <Text fw={500} mb="md" style={{ cursor: 'help' }}>Partner Technology Breakdown</Text>
            </Tooltip>
            <BarList
              data={[
                { name: 'Adobe AEM', value: 2687 },
                { name: 'Shopify', value: 1500 },
                { name: 'Salesforce Commerce', value: 890 },
                { name: 'BigCommerce', value: 450 },
                { name: 'Magento', value: 320 },
              ]}
              color="violet"
            />
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Filters */}
      <Paper p="md" mb="lg" withBorder>
        <Group>
          <TextInput
            placeholder="Search companies..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <SegmentedControl
            data={[
              { label: 'All', value: 'all' },
              { label: 'Hot', value: 'hot' },
              { label: 'Warm', value: 'warm' },
              { label: 'Cold', value: 'cold' },
            ]}
            value={filters.status || 'all'}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status: value === 'all' ? undefined : (value as 'hot' | 'warm' | 'cold'),
              }))
            }
          />
          <Button variant="subtle" leftSection={<IconFilter size={16} />}>
            More Filters
          </Button>
        </Group>
      </Paper>

      {/* Data Table */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={500}>Displacement Targets</Text>
          <Badge variant="light">
            {companies?.pagination.total || 0} companies
          </Badge>
        </Group>
        <TargetTable
          companies={companies?.data || []}
          loading={companiesLoading}
          pagination={companies?.pagination}
        />
      </Paper>
    </Container>
  );
}
