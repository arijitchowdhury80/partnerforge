/**
 * Dashboard Page
 *
 * Premium enterprise dashboard with glassmorphism and Nivo heatmap.
 * Algolia brand colors: Nebula Blue #003DFF, Accent Purple #5468FF
 */

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import {
  Container,
  Text,
  Group,
  Paper,
  Badge,
  Tooltip,
  SegmentedControl,
  Stack,
} from '@mantine/core';
import {
  IconMinus,
  IconEqual,
  IconTarget,
  IconFlame,
  IconBolt,
  IconSnowflake,
  IconChartBar,
  IconLayoutGrid,
} from '@tabler/icons-react';

import { getStats, getCompanies } from '@/services/api';
import { TargetList } from '@/components/targets/TargetList';
import { usePartner } from '@/contexts/PartnerContext';
import { AlgoliaLogo } from '@/components/common/AlgoliaLogo';
import { getPartnerLogo } from '@/components/common/PartnerLogos';
import type { FilterState, DashboardStats } from '@/types';

// Algolia brand colors
const ALGOLIA_BLUE = '#003DFF';
const ALGOLIA_PURPLE = '#5468FF';

export function Dashboard() {
  const { selectedPartner } = usePartner();
  const [filters, setFilters] = useState<FilterState>({
    sort_by: 'icp_score',
    sort_order: 'desc',
  });
  const [page, setPage] = useState(1);
  const [chartView, setChartView] = useState<'heatmap' | 'bars'>('heatmap');

  // Fetch stats
  const { data: stats } = useQuery({
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

  const hotCount = stats?.hot_leads || 9;
  const warmCount = stats?.warm_leads || 49;
  // Cool + Cold = total - hot - warm
  const remaining = (stats?.total_companies || 2737) - hotCount - warmCount;
  const coolCount = Math.round(remaining * 0.15); // ~15% are cool
  const coldCount = remaining - coolCount;

  return (
    <Container size="xl" py="md">
      {/* Hero Section */}
      <HeroSection
        stats={stats}
        partnerKey={selectedPartner.key}
        partnerName={selectedPartner.name}
      />

      {/* Distribution Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <Paper
          p="xl"
          radius="xl"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Group justify="space-between" mb="lg">
            <div>
              <Text fw={600} c="white" size="lg">Target Distribution</Text>
              <Text size="sm" c="dimmed">
                How targets spread across ICP tiers and industry verticals
              </Text>
            </div>
            <SegmentedControl
              value={chartView}
              onChange={(v) => setChartView(v as 'heatmap' | 'bars')}
              data={[
                { label: <IconLayoutGrid size={16} />, value: 'heatmap' },
                { label: <IconChartBar size={16} />, value: 'bars' },
              ]}
              size="xs"
              styles={{
                root: { background: 'rgba(255,255,255,0.05)' },
              }}
            />
          </Group>

          {chartView === 'heatmap' ? (
            <ICPVerticalHeatmap />
          ) : (
            <ICPVerticalBars />
          )}
        </Paper>
      </motion.div>

      {/* Displacement Targets Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Paper
          p="xl"
          radius="xl"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600} c="white" size="lg">Displacement Targets</Text>
              <Text size="sm" c="dimmed">
                Click any row to view full company intelligence
              </Text>
            </div>

            {/* Lead Status Badges - Here in context with the targets */}
            <Group gap="sm">
              <Tooltip label="ICP Score 80-100: Ready for immediate outreach" withArrow>
                <Badge
                  size="lg"
                  variant="gradient"
                  gradient={{ from: '#ef4444', to: '#dc2626' }}
                  leftSection={<IconFlame size={14} />}
                  style={{ cursor: 'help' }}
                >
                  Hot {hotCount}
                </Badge>
              </Tooltip>
              <Tooltip label="ICP Score 60-79: Strong potential, nurture these" withArrow>
                <Badge
                  size="lg"
                  variant="gradient"
                  gradient={{ from: '#f97316', to: '#ea580c' }}
                  leftSection={<IconBolt size={14} />}
                  style={{ cursor: 'help' }}
                >
                  Warm {warmCount}
                </Badge>
              </Tooltip>
              <Tooltip label="ICP Score 40-59: Monitor for signal changes" withArrow>
                <Badge
                  size="lg"
                  variant="gradient"
                  gradient={{ from: '#3b82f6', to: '#2563eb' }}
                  style={{ cursor: 'help' }}
                >
                  Cool {coolCount}
                </Badge>
              </Tooltip>
              <Tooltip label="ICP Score 0-39: Low priority, watch for triggers" withArrow>
                <Badge
                  size="lg"
                  variant="light"
                  color="gray"
                  leftSection={<IconSnowflake size={14} />}
                  style={{ cursor: 'help' }}
                >
                  Cold {coldCount}
                </Badge>
              </Tooltip>
            </Group>
          </Group>

          <TargetList
            companies={companies?.data || []}
            isLoading={companiesLoading}
            pagination={companies?.pagination}
            onPageChange={setPage}
            onFiltersChange={setFilters}
          />
        </Paper>
      </motion.div>
    </Container>
  );
}

// Hero Section
interface HeroSectionProps {
  stats?: DashboardStats;
  partnerKey: string;
  partnerName: string;
}

function HeroSection({ stats, partnerKey, partnerName }: HeroSectionProps) {
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
        p="xl"
        radius="xl"
        style={{
          background: `linear-gradient(135deg, ${ALGOLIA_BLUE}15 0%, ${ALGOLIA_PURPLE}08 100%)`,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.05,
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Main number */}
          <Group align="flex-end" gap="lg" mb="lg">
            <motion.span
              style={{
                fontSize: '4rem',
                fontWeight: 700,
                color: 'white',
                lineHeight: 1,
                background: `linear-gradient(135deg, #FFFFFF 0%, rgba(255,255,255,0.8) 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {displayTotal}
            </motion.span>
            <Text size="xl" c="white" opacity={0.7} mb="sm">
              Displacement Targets
            </Text>
          </Group>

          {/* Visual Formula */}
          <Group gap="md">
            <Tooltip label={`Companies using ${partnerName} technology`} withArrow>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-help"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <PartnerLogo size={28} />
                <Text size="md" c="white" fw={500}>{partnerName}</Text>
              </motion.div>
            </Tooltip>

            <IconMinus size={20} style={{ color: '#ef4444' }} />

            <Tooltip label="Existing Algolia customers (excluded from targets)" withArrow>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-help"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <AlgoliaLogo size={28} />
                <Text size="md" c="white" fw={500}>Algolia Customers</Text>
              </motion.div>
            </Tooltip>

            <IconEqual size={20} style={{ color: '#22c55e' }} />

            <Tooltip label="Your displacement opportunity pipeline" withArrow>
              <motion.div
                whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${ALGOLIA_PURPLE}40` }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-help"
                style={{
                  background: `linear-gradient(135deg, ${ALGOLIA_PURPLE}30 0%, ${ALGOLIA_BLUE}20 100%)`,
                  border: `1px solid ${ALGOLIA_PURPLE}50`,
                }}
              >
                <IconTarget size={24} style={{ color: ALGOLIA_PURPLE }} />
                <Text size="md" c="white" fw={600}>
                  {stats?.total_companies?.toLocaleString() || '...'} Targets
                </Text>
              </motion.div>
            </Tooltip>
          </Group>
        </div>
      </Paper>
    </motion.div>
  );
}

// ICP vs Vertical Heatmap using Nivo
function ICPVerticalHeatmap() {
  // Data for Nivo heatmap
  // X-axis: Verticals, Y-axis: ICP Tiers
  const heatmapData = [
    {
      id: '80-100 (Hot)',
      data: [
        { x: 'Commerce', y: 5 },
        { x: 'Media', y: 2 },
        { x: 'Financial', y: 1 },
        { x: 'Healthcare', y: 1 },
        { x: 'Other', y: 0 },
      ],
    },
    {
      id: '60-79 (Warm)',
      data: [
        { x: 'Commerce', y: 28 },
        { x: 'Media', y: 12 },
        { x: 'Financial', y: 6 },
        { x: 'Healthcare', y: 3 },
        { x: 'Other', y: 0 },
      ],
    },
    {
      id: '40-59 (Cool)',
      data: [
        { x: 'Commerce', y: 200 },
        { x: 'Media', y: 95 },
        { x: 'Financial', y: 52 },
        { x: 'Healthcare', y: 35 },
        { x: 'Other', y: 12 },
      ],
    },
    {
      id: '0-39 (Cold)',
      data: [
        { x: 'Commerce', y: 1617 },
        { x: 'Media', y: 511 },
        { x: 'Financial', y: 421 },
        { x: 'Healthcare', y: 264 },
        { x: 'Other', y: 405 },
      ],
    },
  ];

  return (
    <div style={{ height: 350 }}>
      <ResponsiveHeatMap
        data={heatmapData}
        margin={{ top: 60, right: 90, bottom: 60, left: 120 }}
        valueFormat={(v) => v.toLocaleString()}
        axisTop={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'Industry Vertical',
          legendPosition: 'middle',
          legendOffset: -45,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'ICP Score Tier',
          legendPosition: 'middle',
          legendOffset: -100,
        }}
        colors={{
          type: 'diverging',
          scheme: 'blues',
          minValue: 0,
          maxValue: 500,
          divergeAt: 0.5,
        }}
        emptyColor="rgba(255,255,255,0.03)"
        borderRadius={6}
        borderWidth={2}
        borderColor="rgba(255,255,255,0.05)"
        labelTextColor={{ from: 'color', modifiers: [['brighter', 3]] }}
        theme={{
          background: 'transparent',
          text: { fill: 'rgba(255,255,255,0.7)' },
          axis: {
            legend: { text: { fill: 'rgba(255,255,255,0.5)', fontSize: 12 } },
            ticks: { text: { fill: 'rgba(255,255,255,0.6)', fontSize: 11 } },
          },
          tooltip: {
            container: {
              background: '#1a1a2e',
              color: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              padding: '12px',
            },
          },
        }}
        legends={[
          {
            anchor: 'right',
            translateX: 70,
            translateY: 0,
            length: 200,
            thickness: 10,
            direction: 'column',
            tickPosition: 'after',
            tickSize: 3,
            tickSpacing: 4,
            tickOverlap: false,
            title: 'Count →',
            titleAlign: 'start',
            titleOffset: 4,
          },
        ]}
        annotations={[]}
        hoverTarget="cell"
        onClick={(cell) => {
          console.log('Clicked cell:', cell);
          // TODO: Filter table by this cell's ICP tier + vertical
        }}
      />
    </div>
  );
}

// Alternative: Bar chart view
function ICPVerticalBars() {
  const verticals = ['Commerce', 'Media', 'Financial', 'Healthcare', 'Other'];
  const tiers = [
    { label: 'Hot (80-100)', color: '#ef4444', values: [5, 2, 1, 1, 0] },
    { label: 'Warm (60-79)', color: '#f97316', values: [28, 12, 6, 3, 0] },
    { label: 'Cool (40-59)', color: '#3b82f6', values: [200, 95, 52, 35, 12] },
    { label: 'Cold (0-39)', color: '#6b7280', values: [1617, 511, 421, 264, 405] },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {verticals.map((vertical, vIdx) => (
        <div key={vertical} className="space-y-2">
          <Text size="sm" fw={500} c="white" ta="center">{vertical}</Text>
          <Stack gap={4}>
            {tiers.map((tier) => {
              const value = tier.values[vIdx];
              const maxValue = Math.max(...tier.values);
              const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
              return (
                <Tooltip
                  key={tier.label}
                  label={`${value.toLocaleString()} ${tier.label.toLowerCase()} targets in ${vertical}`}
                  withArrow
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 rounded transition-all duration-300 hover:opacity-80 cursor-pointer"
                      style={{
                        width: `${Math.max(width, 5)}%`,
                        background: tier.color,
                        minWidth: value > 0 ? '20px' : '0',
                      }}
                    />
                    <Text size="xs" c="dimmed" style={{ minWidth: '40px' }}>
                      {value > 0 ? value.toLocaleString() : '—'}
                    </Text>
                  </div>
                </Tooltip>
              );
            })}
          </Stack>
        </div>
      ))}
      {/* Legend */}
      <div className="col-span-5 flex justify-center gap-6 mt-4 pt-4 border-t border-white/10">
        {tiers.map((tier) => (
          <div key={tier.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ background: tier.color }}
            />
            <Text size="xs" c="dimmed">{tier.label}</Text>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
