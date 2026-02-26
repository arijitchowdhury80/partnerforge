/**
 * HiringCard Component
 *
 * Displays hiring signals from the M06 module including job postings,
 * department breakdown, and hiring velocity trends.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  SegmentedControl,
  Table,
  Select,
} from '@mantine/core';
import {
  IconBriefcase,
  IconUsers,
  IconTrendingUp,
  IconTrendingDown,
  IconMapPin,
  IconCalendar,
  IconChartBar,
  IconFlame,
  IconActivity,
  IconMinus,
} from '@tabler/icons-react';
import { AreaChart, BarChart } from '@tremor/react';
import type { SourceCitation } from '@/types';
import { SourceBadge, calculateFreshness } from '@/components/common/SourceBadge';
import { Skeleton } from '@/components/common/LoadingSpinner';

// Props interface as specified
export interface HiringCardProps {
  data?: HiringCardData;
  source?: SourceCitation;
  isLoading?: boolean;
}

// Data interface as specified
export interface HiringCardData {
  total_jobs: number;
  jobs_trend: number; // percentage change
  hiring_velocity: 'aggressive' | 'steady' | 'slow';
  jobs_by_department: Array<{ department: string; count: number }>;
  recent_jobs: Array<{
    title: string;
    department: string;
    location: string;
    posted_date: string;
  }>;
  monthly_postings: Array<{ month: string; count: number }>;
}

const velocityConfig = {
  aggressive: {
    label: 'Aggressive',
    color: 'red',
    description: 'Rapidly expanding workforce',
    icon: IconFlame,
  },
  steady: {
    label: 'Steady',
    color: 'yellow',
    description: 'Consistent hiring pace',
    icon: IconActivity,
  },
  slow: {
    label: 'Slow',
    color: 'blue',
    description: 'Conservative hiring approach',
    icon: IconMinus,
  },
};

const departmentColors: Record<string, string> = {
  Engineering: 'blue',
  Product: 'violet',
  Sales: 'green',
  Marketing: 'pink',
  Operations: 'orange',
  Finance: 'yellow',
  HR: 'cyan',
  Design: 'grape',
  Support: 'teal',
  Other: 'gray',
};

export function HiringCard({
  data,
  source,
  isLoading = false,
}: HiringCardProps) {
  const [view, setView] = useState<string>('overview');
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);

  if (isLoading) {
    return <HiringSkeleton />;
  }

  if (!data) {
    return (
      <Paper
        p="lg"
        radius="lg"
        className="bg-white/5 border border-white/10"
      >
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <IconBriefcase size={20} className="text-orange-400" />
            <Text fw={600} c="white">Hiring Signals</Text>
          </Group>
        </Group>
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No hiring data available. Trigger enrichment to collect.
        </Text>
      </Paper>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const trendColor = data.jobs_trend >= 0 ? 'green' : 'red';
  const TrendIcon = data.jobs_trend >= 0 ? IconTrendingUp : IconTrendingDown;

  const velocityData = velocityConfig[data.hiring_velocity];
  const VelocityIcon = velocityData.icon;

  // Get departments for filter
  const departments = Array.from(
    new Set(data.recent_jobs.map((j) => j.department))
  );

  // Filter jobs by department
  const filteredJobs = departmentFilter
    ? data.recent_jobs.filter((j) => j.department === departmentFilter)
    : data.recent_jobs;

  // Prepare chart data
  const deptChartData = data.jobs_by_department.map((d) => ({
    department: d.department,
    Jobs: d.count,
  }));

  const trendChartData = data.monthly_postings.map((m) => ({
    month: m.month,
    Postings: m.count,
  }));

  // Generate insight based on data
  const generateInsight = () => {
    const topDept = data.jobs_by_department.reduce(
      (max, d) => (d.count > max.count ? d : max),
      data.jobs_by_department[0]
    );

    if (topDept.department.toLowerCase().includes('engineer')) {
      return `Hiring ${topDept.count} engineers suggests significant tech investment`;
    }
    if (topDept.department.toLowerCase().includes('sales')) {
      return `Hiring ${topDept.count} in sales indicates market expansion`;
    }
    if (topDept.department.toLowerCase().includes('product')) {
      return `Hiring ${topDept.count} in product signals new feature development`;
    }
    return `Focus on ${topDept.department} with ${topDept.count} open positions`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Paper
        p="lg"
        radius="lg"
        className="bg-white/5 border border-white/10 hover:border-white/20 transition-all"
      >
        {/* Header */}
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <IconBriefcase size={20} className="text-orange-400" />
            </div>
            <div>
              <Text fw={600} c="white">Hiring Signals</Text>
              <Text size="xs" c="dimmed">Job postings analysis</Text>
            </div>
          </Group>
          <Group gap="sm">
            {source && (
              <SourceBadge
                source={source}
                freshness={calculateFreshness(source.date)}
                compact
              />
            )}
          </Group>
        </Group>

        {/* View selector */}
        <SegmentedControl
          value={view}
          onChange={setView}
          size="xs"
          mb="md"
          data={[
            { label: 'Overview', value: 'overview' },
            { label: 'Jobs', value: 'jobs' },
            { label: 'Trends', value: 'trends' },
          ]}
          classNames={{
            root: 'bg-white/5',
          }}
        />

        {/* Overview View */}
        {view === 'overview' && (
          <Stack gap="md">
            {/* Hero metric */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30">
              <Text size="xs" c="dimmed" tt="uppercase" mb="xs">
                Total Open Jobs
              </Text>
              <Group justify="space-between" align="flex-end">
                <Text
                  size="xl"
                  fw={700}
                  className="text-3xl bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent"
                >
                  {data.total_jobs}
                </Text>
                <Badge
                  size="lg"
                  variant="light"
                  color={trendColor}
                  leftSection={<TrendIcon size={14} />}
                >
                  {data.jobs_trend >= 0 ? '+' : ''}{data.jobs_trend}%
                </Badge>
              </Group>
            </div>

            {/* Velocity indicator */}
            <div className={`p-4 rounded-xl bg-${velocityData.color}-500/10 border border-${velocityData.color}-500/30`}>
              <Group justify="space-between">
                <div>
                  <Group gap="xs" mb="xs">
                    <VelocityIcon size={16} className={`text-${velocityData.color}-400`} />
                    <Text size="sm" c="dimmed">Hiring Velocity</Text>
                  </Group>
                  <Text size="lg" fw={700} c={`${velocityData.color}.4`}>
                    {velocityData.label}
                  </Text>
                </div>
                <Badge
                  size="md"
                  variant="light"
                  color={velocityData.color}
                >
                  {velocityData.description}
                </Badge>
              </Group>
            </div>

            {/* Department breakdown */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <Text size="xs" c="dimmed" mb="sm">Jobs by Department</Text>
              <Group gap="xs" wrap="wrap">
                {data.jobs_by_department.slice(0, 6).map((dept) => (
                  <Badge
                    key={dept.department}
                    size="md"
                    variant="light"
                    color={departmentColors[dept.department] || 'gray'}
                    leftSection={<IconUsers size={12} />}
                  >
                    {dept.department}: {dept.count}
                  </Badge>
                ))}
              </Group>
            </div>

            {/* Key insight */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Group gap="xs">
                <IconChartBar size={16} className="text-blue-400" />
                <Text size="sm" c="white" fw={500}>
                  {generateInsight()}
                </Text>
              </Group>
            </div>
          </Stack>
        )}

        {/* Jobs View */}
        {view === 'jobs' && (
          <Stack gap="md">
            {/* Department filter */}
            <Select
              placeholder="Filter by department"
              clearable
              size="xs"
              value={departmentFilter}
              onChange={setDepartmentFilter}
              data={departments.map((d) => ({ value: d, label: d }))}
              classNames={{
                input: 'bg-white/5 border-white/10',
              }}
            />

            {/* Jobs table */}
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Table
                highlightOnHover
                verticalSpacing="sm"
                horizontalSpacing="md"
                className="bg-white/5"
              >
                <Table.Thead className="bg-white/5">
                  <Table.Tr>
                    <Table.Th className="text-white/60">Title</Table.Th>
                    <Table.Th className="text-white/60">Department</Table.Th>
                    <Table.Th className="text-white/60">Location</Table.Th>
                    <Table.Th className="text-white/60">Posted</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredJobs.slice(0, 5).map((job, index) => (
                    <Table.Tr key={index} className="border-b border-white/5">
                      <Table.Td>
                        <Text size="sm" c="white" fw={500}>
                          {job.title}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={departmentColors[job.department] || 'gray'}
                        >
                          {job.department}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <IconMapPin size={12} className="text-white/40" />
                          <Text size="xs" c="dimmed">
                            {job.location}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <IconCalendar size={12} className="text-white/40" />
                          <Text size="xs" c="dimmed">
                            {formatDate(job.posted_date)}
                          </Text>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>

            {filteredJobs.length === 0 && (
              <Text c="dimmed" ta="center" size="sm">
                No jobs found for this department
              </Text>
            )}

            {filteredJobs.length > 5 && (
              <Text c="dimmed" ta="center" size="xs">
                Showing 5 of {filteredJobs.length} jobs
              </Text>
            )}
          </Stack>
        )}

        {/* Trends View */}
        {view === 'trends' && (
          <Stack gap="md">
            {/* Monthly postings trend */}
            {trendChartData.length > 0 && (
              <div>
                <Text size="sm" c="dimmed" mb="sm">Job Postings Over Time</Text>
                <div className="h-48">
                  <AreaChart
                    data={trendChartData}
                    index="month"
                    categories={['Postings']}
                    colors={['orange']}
                    showAnimation
                    showLegend={false}
                    curveType="monotone"
                  />
                </div>
              </div>
            )}

            {/* Jobs by department bar chart */}
            {deptChartData.length > 0 && (
              <div>
                <Text size="sm" c="dimmed" mb="sm">Jobs by Department</Text>
                <div className="h-48">
                  <BarChart
                    data={deptChartData}
                    index="department"
                    categories={['Jobs']}
                    colors={['amber']}
                    showAnimation
                    showLegend={false}
                  />
                </div>
              </div>
            )}

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <Text size="lg" fw={700} c="white">
                  {data.jobs_by_department.length}
                </Text>
                <Text size="xs" c="dimmed">Departments</Text>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <Text size="lg" fw={700} c="white">
                  {Math.round(data.total_jobs / Math.max(data.jobs_by_department.length, 1))}
                </Text>
                <Text size="xs" c="dimmed">Avg per Dept</Text>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <Text size="lg" fw={700} c="white">
                  {data.monthly_postings.length}
                </Text>
                <Text size="xs" c="dimmed">Months Data</Text>
              </div>
            </div>
          </Stack>
        )}
      </Paper>
    </motion.div>
  );
}

function HiringSkeleton() {
  return (
    <Paper
      p="lg"
      radius="lg"
      className="bg-white/5 border border-white/10"
    >
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Skeleton width={36} height={36} />
          <div>
            <Skeleton width={100} height={16} />
            <Skeleton width={80} height={12} className="mt-1" />
          </div>
        </Group>
        <Skeleton width={60} height={20} />
      </Group>
      <Skeleton width="100%" height={32} className="mb-4" />
      <Stack gap="md">
        <Skeleton width="100%" height={90} />
        <Skeleton width="100%" height={70} />
        <Skeleton width="100%" height={50} />
        <Skeleton width="100%" height={40} />
      </Stack>
    </Paper>
  );
}
