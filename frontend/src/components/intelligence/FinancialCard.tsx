/**
 * FinancialCard Component
 *
 * Displays financial intelligence including revenue, margins, and ROI estimates.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  Tooltip,
  SegmentedControl,
} from '@mantine/core';
import {
  IconCoin,
  IconTrendingUp,
  IconTrendingDown,
  IconPercentage,
  IconChartBar,
  IconTargetArrow,
  IconMinus,
} from '@tabler/icons-react';
import { AreaChart, BarChart } from '@tremor/react';
import type { FinancialData, SourceCitation } from '@/types';
import { SourceBadge, calculateFreshness } from '@/components/common/SourceBadge';
import { Skeleton } from '@/components/common/LoadingSpinner';

interface FinancialCardProps {
  data?: FinancialData;
  source?: SourceCitation;
  isLoading?: boolean;
}

const marginZoneConfig = {
  green: {
    label: 'Healthy',
    color: 'green',
    description: 'Strong margins (>20%)',
    icon: IconTrendingUp,
  },
  yellow: {
    label: 'Moderate',
    color: 'yellow',
    description: 'Average margins (10-20%)',
    icon: IconMinus,
  },
  red: {
    label: 'Pressure',
    color: 'red',
    description: 'Thin margins (<10%)',
    icon: IconTrendingDown,
  },
};

export function FinancialCard({
  data,
  source,
  isLoading = false,
}: FinancialCardProps) {
  const [view, setView] = useState<string>('overview');

  if (isLoading) {
    return <FinancialSkeleton />;
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
            <IconCoin size={20} className="text-green-400" />
            <Text fw={600} c="white">Financials</Text>
          </Group>
        </Group>
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No financial data available. May require public company ticker.
        </Text>
      </Paper>
    );
  }

  const formatCurrency = (value: number): string => {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  };

  const marginZone = marginZoneConfig[data.margin_zone || 'yellow'];
  const MarginIcon = marginZone.icon;

  // Prepare chart data
  const revenueChartData = (data.revenue || []).map(r => ({
    year: r.year.toString(),
    Revenue: r.value / 1_000_000_000, // Convert to billions
  }));

  const incomeChartData = (data.net_income || []).map(r => ({
    year: r.year.toString(),
    'Net Income': r.value / 1_000_000_000,
  }));

  // Get latest revenue for YoY
  const latestRevenue = data.revenue?.[data.revenue.length - 1];
  const previousRevenue = data.revenue?.[data.revenue.length - 2];
  const revenueYoY = latestRevenue && previousRevenue
    ? ((latestRevenue.value - previousRevenue.value) / previousRevenue.value * 100).toFixed(1)
    : null;

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
            <div className="p-2 rounded-lg bg-green-500/20">
              <IconCoin size={20} className="text-green-400" />
            </div>
            <div>
              <Text fw={600} c="white">Financials</Text>
              {data.ticker && (
                <Text size="xs" c="dimmed">{data.ticker}</Text>
              )}
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
            { label: 'Trends', value: 'trends' },
            { label: 'ROI', value: 'roi' },
          ]}
          classNames={{
            root: 'bg-white/5',
          }}
        />

        {/* Overview */}
        {view === 'overview' && (
          <Stack gap="md">
            {/* Revenue hero metric */}
            {latestRevenue && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                <Text size="xs" c="dimmed" tt="uppercase" mb="xs">
                  Latest Revenue ({latestRevenue.year})
                </Text>
                <Group justify="space-between" align="flex-end">
                  <Text
                    size="xl"
                    fw={700}
                    className="text-3xl bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent"
                  >
                    {formatCurrency(latestRevenue.value)}
                  </Text>
                  {revenueYoY && (
                    <Badge
                      size="lg"
                      variant="light"
                      color={parseFloat(revenueYoY) >= 0 ? 'green' : 'red'}
                      leftSection={
                        parseFloat(revenueYoY) >= 0
                          ? <IconTrendingUp size={14} />
                          : <IconTrendingDown size={14} />
                      }
                    >
                      {parseFloat(revenueYoY) >= 0 ? '+' : ''}{revenueYoY}% YoY
                    </Badge>
                  )}
                </Group>
              </div>
            )}

            {/* Margin zone indicator */}
            <div className={`p-4 rounded-xl bg-${marginZone.color}-500/10 border border-${marginZone.color}-500/30`}>
              <Group justify="space-between">
                <div>
                  <Group gap="xs" mb="xs">
                    <IconPercentage size={16} className={`text-${marginZone.color}-400`} />
                    <Text size="sm" c="dimmed">EBITDA Margin</Text>
                  </Group>
                  <Text size="xl" fw={700} c={`${marginZone.color}.4`}>
                    {data.ebitda_margin?.toFixed(1) || '—'}%
                  </Text>
                </div>
                <Tooltip label={marginZone.description}>
                  <Badge
                    size="lg"
                    variant="light"
                    color={marginZone.color}
                    leftSection={<MarginIcon size={14} />}
                  >
                    {marginZone.label}
                  </Badge>
                </Tooltip>
              </Group>
            </div>

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              {data.stock_price && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <Text size="xs" c="dimmed">Stock Price</Text>
                  <Text size="lg" fw={700} c="white">
                    ${data.stock_price.toFixed(2)}
                  </Text>
                </div>
              )}
              {data.market_cap && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <Text size="xs" c="dimmed">Market Cap</Text>
                  <Text size="lg" fw={700} c="white">
                    {formatCurrency(data.market_cap)}
                  </Text>
                </div>
              )}
              {data.ecommerce_revenue && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <Text size="xs" c="dimmed">E-commerce Revenue</Text>
                  <Text size="lg" fw={700} c="white">
                    {formatCurrency(data.ecommerce_revenue)}
                  </Text>
                </div>
              )}
              {data.ecommerce_percentage && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <Text size="xs" c="dimmed">E-commerce %</Text>
                  <Text size="lg" fw={700} c="white">
                    {data.ecommerce_percentage}%
                  </Text>
                </div>
              )}
            </div>
          </Stack>
        )}

        {/* Trends */}
        {view === 'trends' && (
          <Stack gap="md">
            {revenueChartData.length > 0 && (
              <div>
                <Text size="sm" c="dimmed" mb="sm">Revenue Trend ($B)</Text>
                <div className="h-48">
                  <AreaChart
                    data={revenueChartData}
                    index="year"
                    categories={['Revenue']}
                    colors={['emerald']}
                    showAnimation
                    showLegend={false}
                    curveType="monotone"
                  />
                </div>
              </div>
            )}

            {incomeChartData.length > 0 && (
              <div>
                <Text size="sm" c="dimmed" mb="sm">Net Income Trend ($B)</Text>
                <div className="h-48">
                  <BarChart
                    data={incomeChartData}
                    index="year"
                    categories={['Net Income']}
                    colors={['blue']}
                    showAnimation
                    showLegend={false}
                  />
                </div>
              </div>
            )}

            {/* Year over year breakdown */}
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">Year-over-Year</Text>
              {(data.revenue || []).slice(-3).reverse().map((r) => (
                <div
                  key={r.year}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                >
                  <Text size="sm" c="white">{r.year}</Text>
                  <Text size="sm" fw={500} c="white">{formatCurrency(r.value)}</Text>
                  {r.yoy_change !== undefined && (
                    <Badge
                      size="sm"
                      variant="light"
                      color={r.yoy_change >= 0 ? 'green' : 'red'}
                    >
                      {r.yoy_change >= 0 ? '+' : ''}{r.yoy_change.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              ))}
            </Stack>
          </Stack>
        )}

        {/* ROI Estimate */}
        {view === 'roi' && (
          <Stack gap="md">
            {data.roi_estimate ? (
              <>
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
                  <Group gap="xs" mb="sm">
                    <IconTargetArrow size={18} className="text-purple-400" />
                    <Text size="sm" fw={600} c="white">Addressable Revenue</Text>
                  </Group>
                  <Text
                    size="xl"
                    fw={700}
                    className="text-2xl bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
                  >
                    {formatCurrency(data.roi_estimate.addressable_revenue)}
                  </Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    Estimated e-commerce revenue addressable by Algolia
                  </Text>
                </div>

                <Text size="sm" fw={600} c="dimmed">Potential Impact (Annual)</Text>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                    <Text size="xs" c="dimmed" mb="xs">Conservative</Text>
                    <Text size="lg" fw={700} c="green.4">
                      {formatCurrency(data.roi_estimate.conservative)}
                    </Text>
                    <Text size="xs" c="dimmed">1% uplift</Text>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                    <Text size="xs" c="dimmed" mb="xs">Moderate</Text>
                    <Text size="lg" fw={700} c="blue.4">
                      {formatCurrency(data.roi_estimate.moderate)}
                    </Text>
                    <Text size="xs" c="dimmed">3% uplift</Text>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
                    <Text size="xs" c="dimmed" mb="xs">Aggressive</Text>
                    <Text size="lg" fw={700} c="purple.4">
                      {formatCurrency(data.roi_estimate.aggressive)}
                    </Text>
                    <Text size="xs" c="dimmed">5% uplift</Text>
                  </div>
                </div>

                <Text size="xs" c="dimmed" className="italic">
                  Based on Algolia case study benchmarks for similar verticals.
                </Text>
              </>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                ROI estimate not available. Requires e-commerce revenue data.
              </Text>
            )}
          </Stack>
        )}
      </Paper>
    </motion.div>
  );
}

function FinancialSkeleton() {
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
            <Skeleton width={80} height={16} />
            <Skeleton width={50} height={12} className="mt-1" />
          </div>
        </Group>
        <Skeleton width={60} height={20} />
      </Group>
      <Skeleton width="100%" height={32} className="mb-4" />
      <Stack gap="md">
        <Skeleton width="100%" height={90} />
        <Skeleton width="100%" height={70} />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton width="100%" height={60} />
          <Skeleton width="100%" height={60} />
        </div>
      </Stack>
    </Paper>
  );
}
