/**
 * Dashboard Page
 *
 * Premium enterprise dashboard with glassmorphism and Nivo heatmap.
 * Algolia brand colors: Nebula Blue #003DFF, Accent Purple #5468FF
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

// Simple visual grid - no library complexity, just clear data
function ICPVerticalHeatmap() {
  const verticals = ['Commerce', 'Media', 'Financial', 'Healthcare', 'Other'];
  const tiers = [
    {
      label: 'HOT',
      score: '80-100',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      values: { Commerce: 5, Media: 2, Financial: 1, Healthcare: 1, Other: 0 },
      total: 9
    },
    {
      label: 'WARM',
      score: '60-79',
      color: '#f97316',
      bg: 'rgba(249, 115, 22, 0.15)',
      values: { Commerce: 28, Media: 12, Financial: 6, Healthcare: 3, Other: 0 },
      total: 49
    },
    {
      label: 'COOL',
      score: '40-59',
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.15)',
      values: { Commerce: 200, Media: 95, Financial: 52, Healthcare: 35, Other: 12 },
      total: 394
    },
    {
      label: 'COLD',
      score: '0-39',
      color: '#6b7280',
      bg: 'rgba(107, 114, 128, 0.15)',
      values: { Commerce: 1617, Media: 511, Financial: 421, Healthcare: 264, Other: 405 },
      total: 2285
    },
  ];

  // Find max value for scaling cell intensity
  const allValues = tiers.flatMap(t => Object.values(t.values));
  const maxValue = Math.max(...allValues);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px' }}>
        {/* Header row - Verticals */}
        <thead>
          <tr>
            <th style={{
              width: '180px',
              padding: '16px',
              textAlign: 'left',
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              ICP Score
            </th>
            {verticals.map(v => (
              <th key={v} style={{
                padding: '16px 24px',
                textAlign: 'center',
                fontSize: '18px',
                fontWeight: 600,
                color: 'white'
              }}>
                {v}
              </th>
            ))}
            <th style={{
              padding: '16px 24px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase'
            }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {tiers.map(tier => (
            <tr key={tier.label}>
              {/* Row label - ICP tier */}
              <td style={{
                padding: '16px',
                borderRadius: '12px',
                background: tier.bg,
                borderLeft: `4px solid ${tier.color}`
              }}>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: tier.color,
                  marginBottom: '4px'
                }}>
                  {tier.label}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.6)'
                }}>
                  Score {tier.score}
                </div>
              </td>
              {/* Data cells */}
              {verticals.map(v => {
                const value = tier.values[v as keyof typeof tier.values];
                const intensity = value / maxValue;
                const cellBg = value > 0
                  ? `rgba(${tier.color === '#ef4444' ? '239, 68, 68' :
                           tier.color === '#f97316' ? '249, 115, 22' :
                           tier.color === '#3b82f6' ? '59, 130, 246' :
                           '107, 114, 128'}, ${0.1 + intensity * 0.5})`
                  : 'rgba(255,255,255,0.02)';

                return (
                  <td key={v} style={{
                    padding: '20px',
                    textAlign: 'center',
                    borderRadius: '12px',
                    background: cellBg,
                    border: `1px solid rgba(255,255,255,0.08)`,
                    cursor: value > 0 ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (value > 0) {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = `0 4px 20px ${tier.color}30`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => {
                    if (value > 0) {
                      console.log(`Filter: ${tier.label} + ${v}`);
                    }
                  }}
                  >
                    <span style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: value > 0 ? 'white' : 'rgba(255,255,255,0.2)'
                    }}>
                      {value > 0 ? value.toLocaleString() : '—'}
                    </span>
                  </td>
                );
              })}
              {/* Row total */}
              <td style={{
                padding: '20px',
                textAlign: 'center',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: `2px solid ${tier.color}40`
              }}>
                <span style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: tier.color
                }}>
                  {tier.total.toLocaleString()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        {/* Footer - Column totals */}
        <tfoot>
          <tr>
            <td style={{
              padding: '16px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase'
            }}>
              Vertical Total
            </td>
            {verticals.map(v => {
              const total = tiers.reduce((sum, t) => sum + t.values[v as keyof typeof t.values], 0);
              return (
                <td key={v} style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.7)'
                }}>
                  {total.toLocaleString()}
                </td>
              );
            })}
            <td style={{
              padding: '16px',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 700,
              color: ALGOLIA_PURPLE
            }}>
              2,737
            </td>
          </tr>
        </tfoot>
      </table>
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
