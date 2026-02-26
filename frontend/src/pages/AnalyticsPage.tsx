/**
 * AnalyticsPage
 *
 * Route: /analytics
 * Traffic analysis and performance metrics dashboard.
 */

import {
  Container,
  Paper,
  Text,
  Group,
  Stack,
  SimpleGrid,
  ThemeIcon,
  Skeleton,
  Table,
  Badge,
  ScrollArea,
} from '@mantine/core';
import {
  IconChartLine,
  IconWorld,
  IconUsers,
  IconPercentage,
  IconArrowUpRight,
  IconArrowDownRight,
  IconBrandGoogle,
  IconBrandFacebook,
  IconLink,
  IconAd,
  IconMail,
} from '@tabler/icons-react';
import {
  Card,
  Metric,
  Text as TremorText,
  DonutChart,
  BarList,
  AreaChart,
  BarChart,
} from '@tremor/react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { getStats, getCompanies } from '@/services/api';

// =============================================================================
// Mock Data for Charts
// =============================================================================

// Traffic trend over last 6 months (mock)
const trafficTrendData = [
  { month: 'Sep 2025', visits: 245000000 },
  { month: 'Oct 2025', visits: 268000000 },
  { month: 'Nov 2025', visits: 312000000 },
  { month: 'Dec 2025', visits: 298000000 },
  { month: 'Jan 2026', visits: 342000000 },
  { month: 'Feb 2026', visits: 385000000 },
];

// Traffic sources breakdown (mock)
const trafficSourcesData = [
  { name: 'Direct', value: 35, color: 'blue' },
  { name: 'Organic Search', value: 28, color: 'green' },
  { name: 'Paid Search', value: 15, color: 'orange' },
  { name: 'Social', value: 12, color: 'violet' },
  { name: 'Referral', value: 10, color: 'cyan' },
];

// ICP score distribution (mock)
const icpDistributionData = [
  { range: '0-20', count: 450 },
  { range: '21-40', count: 680 },
  { range: '41-60', count: 890 },
  { range: '61-80', count: 520 },
  { range: '81-100', count: 147 },
];

// Top countries by traffic (mock)
const topCountriesData = [
  { country: 'United States', code: 'US', share: 42.5, visits: '163.6M' },
  { country: 'United Kingdom', code: 'GB', share: 12.3, visits: '47.4M' },
  { country: 'Germany', code: 'DE', share: 8.7, visits: '33.5M' },
  { country: 'France', code: 'FR', share: 6.2, visits: '23.9M' },
  { country: 'Canada', code: 'CA', share: 5.8, visits: '22.3M' },
  { country: 'Japan', code: 'JP', share: 4.5, visits: '17.3M' },
  { country: 'Australia', code: 'AU', share: 3.9, visits: '15.0M' },
  { country: 'Brazil', code: 'BR', share: 3.2, visits: '12.3M' },
];

// Source icons map
const sourceIcons: Record<string, React.ReactNode> = {
  Direct: <IconLink size={14} />,
  'Organic Search': <IconBrandGoogle size={14} />,
  'Paid Search': <IconAd size={14} />,
  Social: <IconBrandFacebook size={14} />,
  Referral: <IconMail size={14} />,
};

// =============================================================================
// Stat Card Component
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: number;
  loading?: boolean;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, color, trend, loading, subtitle }: StatCardProps) {
  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(100, 116, 139, 0.2)',
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="xs" tt="uppercase" fw={500} c="dimmed">
            {title}
          </Text>
          {loading ? (
            <Skeleton height={36} width={100} mt="xs" />
          ) : (
            <Text size="xl" fw={700} mt="xs">
              {value}
            </Text>
          )}
          {subtitle && !loading && (
            <Text size="xs" c="dimmed" mt={4}>
              {subtitle}
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
                {trend >= 0 ? '+' : ''}{trend}% vs last month
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

// =============================================================================
// Main Component
// =============================================================================

export function AnalyticsPage() {
  // Fetch real stats data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  // Fetch companies to compute top performer
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', { sort_by: 'icp_score', sort_order: 'desc', limit: 50 }],
    queryFn: () => getCompanies({ sort_by: 'icp_score', sort_order: 'desc', limit: 50 }),
  });

  // Calculate aggregate values
  const totalMonthlyVisits = '385M'; // Mock - real aggregation requires backend endpoint
  const avgIcpScore = companies?.data?.length
    ? Math.round(companies.data.reduce((acc, c) => acc + c.icp_score, 0) / companies.data.length)
    : 0;
  const topPerformer = companies?.data?.[0]?.company_name || 'N/A';
  const enrichmentCoverage = stats?.total_companies && stats?.enriched_companies
    ? Math.round((stats.enriched_companies / stats.total_companies) * 100)
    : 0;

  // Build top companies by traffic (mock traffic values based on ICP score)
  const topCompaniesByTraffic = (companies?.data || [])
    .slice(0, 10)
    .map((c) => ({
      name: c.company_name,
      value: Math.round(c.icp_score * 1.2 * 1000000), // Mock traffic based on score
    }));

  return (
    <Container size="xl" py="md">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Stack gap="lg">
          {/* Header */}
          <div>
            <Text size="xl" fw={700}>
              Analytics
            </Text>
            <Text size="sm" c="dimmed">
              Traffic analysis and performance metrics
            </Text>
          </div>

          {/* Stats Overview */}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <StatCard
              title="Total Monthly Visits"
              value={totalMonthlyVisits}
              icon={IconChartLine}
              color="blue"
              trend={12.5}
              loading={false}
              subtitle="Across all targets"
            />
            <StatCard
              title="Average ICP Score"
              value={avgIcpScore}
              icon={IconPercentage}
              color="green"
              trend={3.2}
              loading={companiesLoading}
              subtitle="Out of 100"
            />
            <StatCard
              title="Top Performer"
              value={topPerformer}
              icon={IconUsers}
              color="violet"
              loading={companiesLoading}
              subtitle="Highest traffic"
            />
            <StatCard
              title="Enrichment Coverage"
              value={`${enrichmentCoverage}%`}
              icon={IconWorld}
              color="orange"
              trend={8.1}
              loading={statsLoading}
              subtitle={`${stats?.enriched_companies || 0} of ${stats?.total_companies || 0}`}
            />
          </SimpleGrid>

          {/* Charts Section Row 1 */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {/* Traffic Trend */}
            <Paper
              p="lg"
              radius="lg"
              style={{
                background: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(100, 116, 139, 0.2)',
              }}
            >
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600}>Traffic Trend</Text>
                  <Text size="xs" c="dimmed">
                    Monthly visits over last 6 months
                  </Text>
                </div>
                <Badge variant="light" color="green" size="sm">
                  <Group gap={4}>
                    <IconArrowUpRight size={12} />
                    +12.5%
                  </Group>
                </Badge>
              </Group>
              <AreaChart
                data={trafficTrendData}
                index="month"
                categories={['visits']}
                colors={['blue']}
                showAnimation
                showLegend={false}
                curveType="monotone"
                valueFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                className="h-64"
              />
            </Paper>

            {/* Traffic Sources Breakdown */}
            <Paper
              p="lg"
              radius="lg"
              style={{
                background: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(100, 116, 139, 0.2)',
              }}
            >
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600}>Traffic Sources</Text>
                  <Text size="xs" c="dimmed">
                    Breakdown by channel
                  </Text>
                </div>
              </Group>
              <Group align="flex-start" gap="xl">
                <DonutChart
                  data={trafficSourcesData}
                  category="value"
                  index="name"
                  colors={['blue', 'green', 'orange', 'violet', 'cyan']}
                  showAnimation
                  className="h-52 w-52"
                />
                <Stack gap="xs" style={{ flex: 1 }}>
                  {trafficSourcesData.map((source) => (
                    <Group key={source.name} justify="space-between">
                      <Group gap="xs">
                        <ThemeIcon size="sm" variant="light" color={source.color}>
                          {sourceIcons[source.name]}
                        </ThemeIcon>
                        <Text size="sm">{source.name}</Text>
                      </Group>
                      <Text size="sm" fw={600}>
                        {source.value}%
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Group>
            </Paper>
          </SimpleGrid>

          {/* Charts Section Row 2 */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {/* Top 10 Companies by Traffic */}
            <Paper
              p="lg"
              radius="lg"
              style={{
                background: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(100, 116, 139, 0.2)',
              }}
            >
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600}>Top 10 Companies by Traffic</Text>
                  <Text size="xs" c="dimmed">
                    Estimated monthly visits
                  </Text>
                </div>
              </Group>
              {companiesLoading ? (
                <Stack gap="sm">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} height={24} />
                  ))}
                </Stack>
              ) : (
                <BarList
                  data={topCompaniesByTraffic}
                  color="blue"
                  valueFormatter={(value: number) => `${(value / 1000000).toFixed(1)}M`}
                />
              )}
            </Paper>

            {/* ICP Score Distribution */}
            <Paper
              p="lg"
              radius="lg"
              style={{
                background: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(100, 116, 139, 0.2)',
              }}
            >
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600}>ICP Score Distribution</Text>
                  <Text size="xs" c="dimmed">
                    Company count by score range
                  </Text>
                </div>
              </Group>
              <BarChart
                data={icpDistributionData}
                index="range"
                categories={['count']}
                colors={['violet']}
                showAnimation
                showLegend={false}
                valueFormatter={(value) => value.toLocaleString()}
                className="h-64"
              />
            </Paper>
          </SimpleGrid>

          {/* Geography Section */}
          <Paper
            p="lg"
            radius="lg"
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(100, 116, 139, 0.2)',
            }}
          >
            <Group justify="space-between" mb="lg">
              <div>
                <Text fw={600}>Geographic Distribution</Text>
                <Text size="xs" c="dimmed">
                  Top countries by traffic share
                </Text>
              </div>
              <Badge variant="light" color="blue" size="sm">
                8 countries
              </Badge>
            </Group>
            <ScrollArea>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rank</Table.Th>
                    <Table.Th>Country</Table.Th>
                    <Table.Th>Code</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Traffic Share</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Monthly Visits</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {topCountriesData.map((country, index) => (
                    <Table.Tr key={country.code}>
                      <Table.Td>
                        <Badge
                          variant={index < 3 ? 'filled' : 'light'}
                          color={index === 0 ? 'yellow' : index === 1 ? 'gray' : index === 2 ? 'orange' : 'blue'}
                          size="sm"
                        >
                          #{index + 1}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {country.country}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline" color="gray" size="xs">
                          {country.code}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={600}>
                          {country.share}%
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="dimmed">
                          {country.visits}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </Stack>
      </motion.div>
    </Container>
  );
}

export default AnalyticsPage;
