/**
 * TrafficCard Component
 *
 * Displays traffic intelligence including visits, engagement, sources, and geography.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  Progress,
  Tooltip,
  SegmentedControl,
} from '@mantine/core';
import {
  IconChartLine,
  IconTrendingUp,
  IconTrendingDown,
  IconWorld,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconSearch,
  IconLink,
  IconBrandFacebook,
  IconMail,
  IconCurrencyDollar,
  IconUser,
} from '@tabler/icons-react';
import { AreaChart, DonutChart } from '@tremor/react';
import type { TrafficData, SourceCitation } from '@/types';
import { SourceBadge, calculateFreshness } from '@/components/common/SourceBadge';
import { Skeleton } from '@/components/common/LoadingSpinner';

interface TrafficCardProps {
  data?: TrafficData;
  source?: SourceCitation;
  isLoading?: boolean;
}

const sourceIcons: Record<string, React.ElementType> = {
  direct: IconUser,
  search: IconSearch,
  referral: IconLink,
  social: IconBrandFacebook,
  mail: IconMail,
  paid: IconCurrencyDollar,
};

const sourceColors: Record<string, string> = {
  direct: 'blue',
  search: 'green',
  referral: 'violet',
  social: 'pink',
  mail: 'orange',
  paid: 'yellow',
};

export function TrafficCard({
  data,
  source,
  isLoading = false,
}: TrafficCardProps) {
  const [view, setView] = useState<string>('overview');

  if (isLoading) {
    return <TrafficSkeleton />;
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
            <IconChartLine size={20} className="text-cyan-400" />
            <Text fw={600} c="white">Traffic Analytics</Text>
          </Group>
        </Group>
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No traffic data available. Trigger enrichment to collect.
        </Text>
      </Paper>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const trendColor = data.monthly_visits_trend >= 0 ? 'green' : 'red';
  const TrendIcon = data.monthly_visits_trend >= 0 ? IconTrendingUp : IconTrendingDown;

  // Prepare chart data
  const sourceChartData = (data.traffic_sources || []).map(s => ({
    name: s.source.charAt(0).toUpperCase() + s.source.slice(1),
    value: s.percentage,
  }));

  const deviceData = data.device_distribution ? [
    { name: 'Desktop', value: data.device_distribution.desktop },
    { name: 'Mobile', value: data.device_distribution.mobile },
    { name: 'Tablet', value: data.device_distribution.tablet },
  ] : [];

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
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <IconChartLine size={20} className="text-cyan-400" />
            </div>
            <div>
              <Text fw={600} c="white">Traffic Analytics</Text>
              <Text size="xs" c="dimmed">SimilarWeb data</Text>
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
            { label: 'Sources', value: 'sources' },
            { label: 'Geography', value: 'geography' },
          ]}
          classNames={{
            root: 'bg-white/5',
          }}
        />

        {/* Overview */}
        {view === 'overview' && (
          <Stack gap="md">
            {/* Hero metric */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Text size="xs" c="dimmed" tt="uppercase" mb="xs">
                Monthly Visits
              </Text>
              <Group justify="space-between" align="flex-end">
                <Text
                  size="xl"
                  fw={700}
                  className="text-3xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"
                >
                  {formatNumber(data.monthly_visits)}
                </Text>
                <Badge
                  size="lg"
                  variant="light"
                  color={trendColor}
                  leftSection={<TrendIcon size={14} />}
                >
                  {data.monthly_visits_trend >= 0 ? '+' : ''}{data.monthly_visits_trend}%
                </Badge>
              </Group>
            </div>

            {/* Engagement metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <Text size="lg" fw={700} c="white">
                  {data.bounce_rate}%
                </Text>
                <Text size="xs" c="dimmed">Bounce Rate</Text>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <Text size="lg" fw={700} c="white">
                  {data.pages_per_visit.toFixed(1)}
                </Text>
                <Text size="xs" c="dimmed">Pages/Visit</Text>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                <Text size="lg" fw={700} c="white">
                  {formatDuration(data.avg_visit_duration)}
                </Text>
                <Text size="xs" c="dimmed">Avg Duration</Text>
              </div>
            </div>

            {/* Device distribution */}
            {data.device_distribution && (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <Text size="xs" c="dimmed" mb="sm">Device Distribution</Text>
                <Group gap="md">
                  <Group gap="xs">
                    <IconDeviceDesktop size={14} className="text-blue-400" />
                    <Text size="sm" c="white">{data.device_distribution.desktop}%</Text>
                  </Group>
                  <Group gap="xs">
                    <IconDeviceMobile size={14} className="text-green-400" />
                    <Text size="sm" c="white">{data.device_distribution.mobile}%</Text>
                  </Group>
                  <Group gap="xs">
                    <IconDeviceTablet size={14} className="text-orange-400" />
                    <Text size="sm" c="white">{data.device_distribution.tablet}%</Text>
                  </Group>
                </Group>
              </div>
            )}
          </Stack>
        )}

        {/* Traffic Sources */}
        {view === 'sources' && (
          <Stack gap="md">
            {sourceChartData.length > 0 && (
              <div className="h-48">
                <DonutChart
                  data={sourceChartData}
                  category="value"
                  index="name"
                  colors={['blue', 'green', 'violet', 'pink', 'orange', 'yellow']}
                  showAnimation
                />
              </div>
            )}

            <Stack gap="xs">
              {(data.traffic_sources || []).map((src) => {
                const IconComponent = sourceIcons[src.source] || IconLink;
                const color = sourceColors[src.source] || 'gray';

                return (
                  <div
                    key={src.source}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                  >
                    <IconComponent size={16} className={`text-${color}-400`} />
                    <Text size="sm" c="white" className="flex-1 capitalize">
                      {src.source}
                    </Text>
                    <Progress
                      value={src.percentage}
                      size="sm"
                      color={color}
                      className="flex-1"
                    />
                    <Text size="sm" fw={500} c="white" w={50} ta="right">
                      {src.percentage}%
                    </Text>
                  </div>
                );
              })}
            </Stack>
          </Stack>
        )}

        {/* Geography */}
        {view === 'geography' && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">Top Countries by Traffic</Text>
            <Stack gap="xs">
              {(data.top_countries || []).slice(0, 5).map((country, index) => (
                <div
                  key={country.country_code}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                >
                  <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <Text size="sm" c="white">{country.country}</Text>
                    <Progress
                      value={country.percentage}
                      size="xs"
                      color="cyan"
                      mt={4}
                    />
                  </div>
                  <Text size="sm" fw={500} c="white">
                    {country.percentage}%
                  </Text>
                </div>
              ))}
            </Stack>
          </Stack>
        )}
      </Paper>
    </motion.div>
  );
}

function TrafficSkeleton() {
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
        <Skeleton width="100%" height={80} />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton width="100%" height={60} />
          <Skeleton width="100%" height={60} />
          <Skeleton width="100%" height={60} />
        </div>
        <Skeleton width="100%" height={50} />
      </Stack>
    </Paper>
  );
}
