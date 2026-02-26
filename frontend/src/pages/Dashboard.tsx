/**
 * Dashboard Page
 *
 * Enterprise dashboard with ICP vs Vertical heatmap visualization.
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
} from '@mantine/core';
import {
  IconMinus,
  IconEqual,
  IconTarget,
  IconFlame,
  IconBolt,
  IconSnowflake,
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

  return (
    <Container size="xl" py="md">
      {/* Hero Section */}
      <HeroSection
        stats={stats}
        partnerKey={selectedPartner.key}
        partnerName={selectedPartner.name}
      />

      {/* ICP vs Vertical Heatmap */}
      <ICPVerticalHeatmap />

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
              Click any row to view full company intelligence
            </Text>
          </div>
          <Badge variant="light" size="lg" color="blue">
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
  const hotCount = stats?.hot_leads || 9;
  const warmCount = stats?.warm_leads || 49;
  const coldCount = (stats?.total_companies || 2687) - hotCount - warmCount;

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
        style={{
          background: `linear-gradient(135deg, ${ALGOLIA_BLUE}20 0%, ${ALGOLIA_PURPLE}10 100%)`,
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
            opacity: 0.1,
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Main number and lead counts */}
          <Group align="flex-end" gap="lg" mb="md">
            <motion.span
              style={{ fontSize: '3.5rem', fontWeight: 700, color: 'white' }}
            >
              {displayTotal}
            </motion.span>
            <Text size="lg" c="white" opacity={0.7} mb="sm">
              Displacement Targets
            </Text>

            {/* Inline lead counts with tooltips */}
            <Group gap="md" ml="auto">
              <Tooltip label="ICP Score 80-100: Ready for immediate outreach" withArrow>
                <Badge
                  size="lg"
                  variant="light"
                  color="red"
                  leftSection={<IconFlame size={14} />}
                  style={{ cursor: 'help' }}
                >
                  Hot ({hotCount})
                </Badge>
              </Tooltip>
              <Tooltip label="ICP Score 60-79: Strong potential, nurture these" withArrow>
                <Badge
                  size="lg"
                  variant="light"
                  color="orange"
                  leftSection={<IconBolt size={14} />}
                  style={{ cursor: 'help' }}
                >
                  Warm ({warmCount})
                </Badge>
              </Tooltip>
              <Tooltip label="ICP Score 0-59: Monitor for changes" withArrow>
                <Badge
                  size="lg"
                  variant="light"
                  color="gray"
                  leftSection={<IconSnowflake size={14} />}
                  style={{ cursor: 'help' }}
                >
                  Cold ({coldCount})
                </Badge>
              </Tooltip>
            </Group>
          </Group>

          {/* Visual Formula */}
          <Group gap="sm">
            <Tooltip label={`Companies using ${partnerName} technology`} withArrow>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-help">
                <PartnerLogo size={24} />
                <Text size="sm" c="white" fw={500}>{partnerName}</Text>
              </div>
            </Tooltip>

            <IconMinus size={16} style={{ color: '#ef4444' }} />

            <Tooltip label="Existing Algolia customers (excluded from targets)" withArrow>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-help">
                <AlgoliaLogo size={24} />
                <Text size="sm" c="white" fw={500}>Algolia</Text>
              </div>
            </Tooltip>

            <IconEqual size={16} style={{ color: '#22c55e' }} />

            <Tooltip label="Your displacement opportunity pipeline" withArrow>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-help"
                style={{
                  background: `${ALGOLIA_PURPLE}30`,
                  border: `1px solid ${ALGOLIA_PURPLE}50`,
                }}
              >
                <IconTarget size={20} style={{ color: ALGOLIA_PURPLE }} />
                <Text size="sm" c="white" fw={600}>
                  {stats?.total_companies?.toLocaleString() || '...'} targets
                </Text>
              </div>
            </Tooltip>
          </Group>
        </div>
      </Paper>
    </motion.div>
  );
}

// ICP vs Vertical Heatmap
function ICPVerticalHeatmap() {
  // Verticals (X-axis)
  const verticals = ['Commerce', 'Media', 'Financial', 'Healthcare', 'Other'];

  // ICP Tiers (Y-axis) - from high to low
  const tiers = [
    { id: 'T1', label: '80-100', color: '#ef4444', description: 'Hot - Ready for outreach' },
    { id: 'T2', label: '60-79', color: '#f97316', description: 'Warm - Strong potential' },
    { id: 'T3', label: '40-59', color: ALGOLIA_PURPLE, description: 'Medium - Nurture' },
    { id: 'T4', label: '0-39', color: '#6b7280', description: 'Cold - Monitor' },
  ];

  // Heatmap data: [tier][vertical] = count
  const data: Record<string, Record<string, number>> = {
    T1: { Commerce: 5, Media: 2, Financial: 1, Healthcare: 1, Other: 0 },
    T2: { Commerce: 28, Media: 12, Financial: 6, Healthcare: 3, Other: 0 },
    T3: { Commerce: 80, Media: 35, Financial: 22, Healthcare: 13, Other: 0 },
    T4: { Commerce: 1737, Media: 571, Financial: 451, Healthcare: 303, Other: 417 },
  };

  // Get max value for color intensity
  const maxValue = Math.max(...Object.values(data).flatMap(row => Object.values(row)));

  // Calculate color intensity (0-1)
  const getIntensity = (value: number) => Math.min(value / (maxValue * 0.3), 1);

  // Row totals
  const getRowTotal = (tierId: string) =>
    Object.values(data[tierId]).reduce((a, b) => a + b, 0);

  // Column totals
  const getColTotal = (vertical: string) =>
    tiers.reduce((sum, tier) => sum + data[tier.id][vertical], 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-6"
    >
      <Paper
        p="lg"
        radius="xl"
        className="bg-white/5 border border-white/10"
      >
        <Group justify="space-between" mb="lg">
          <div>
            <Text fw={600} c="white" size="lg">ICP Score × Vertical Distribution</Text>
            <Text size="xs" c="dimmed">Click any cell to filter the table below</Text>
          </div>
          <Tooltip label="This heatmap shows how your targets distribute across industries (columns) and ICP score tiers (rows). Darker cells = more targets." withArrow multiline w={300}>
            <Badge variant="light" color="blue" style={{ cursor: 'help' }}>?</Badge>
          </Tooltip>
        </Group>

        {/* Heatmap Grid */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}></th>
                {verticals.map((v) => (
                  <Tooltip key={v} label={`${getColTotal(v).toLocaleString()} targets in ${v}`} withArrow>
                    <th
                      style={{
                        padding: '8px',
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'help',
                      }}
                    >
                      {v}
                    </th>
                  </Tooltip>
                ))}
                <th style={{ width: '60px', padding: '8px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id}>
                  <Tooltip label={tier.description} withArrow position="right">
                    <td
                      style={{
                        padding: '8px',
                        color: tier.color,
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'help',
                      }}
                    >
                      {tier.label}
                    </td>
                  </Tooltip>
                  {verticals.map((v) => {
                    const value = data[tier.id][v];
                    const intensity = getIntensity(value);
                    return (
                      <Tooltip
                        key={v}
                        label={`${value.toLocaleString()} ${tier.description.split(' - ')[0].toLowerCase()} targets in ${v}`}
                        withArrow
                      >
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            background: value > 0
                              ? `rgba(${tier.color === '#ef4444' ? '239,68,68' : tier.color === '#f97316' ? '249,115,22' : tier.color === ALGOLIA_PURPLE ? '84,104,255' : '107,114,128'}, ${0.1 + intensity * 0.5})`
                              : 'rgba(255,255,255,0.02)',
                            borderRadius: '6px',
                            cursor: value > 0 ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (value > 0) {
                              (e.target as HTMLElement).style.transform = 'scale(1.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.transform = 'scale(1)';
                          }}
                        >
                          <Text
                            size="sm"
                            fw={value > 0 ? 600 : 400}
                            c={value > 0 ? 'white' : 'dimmed'}
                          >
                            {value > 0 ? value.toLocaleString() : '—'}
                          </Text>
                        </td>
                      </Tooltip>
                    );
                  })}
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">{getRowTotal(tier.id).toLocaleString()}</Text>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Total</td>
                {verticals.map((v) => (
                  <td key={v} style={{ padding: '8px', textAlign: 'center' }}>
                    <Text size="xs" c="dimmed">{getColTotal(v).toLocaleString()}</Text>
                  </td>
                ))}
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  <Text size="xs" fw={600} c="white">
                    {tiers.reduce((sum, t) => sum + getRowTotal(t.id), 0).toLocaleString()}
                  </Text>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Legend */}
        <Group gap="lg" mt="md" pt="md" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Text size="xs" c="dimmed">Intensity:</Text>
          <Group gap="xs">
            <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(84,104,255,0.15)' }} />
            <Text size="xs" c="dimmed">Low</Text>
          </Group>
          <Group gap="xs">
            <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(84,104,255,0.4)' }} />
            <Text size="xs" c="dimmed">Medium</Text>
          </Group>
          <Group gap="xs">
            <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(84,104,255,0.7)' }} />
            <Text size="xs" c="dimmed">High</Text>
          </Group>
        </Group>
      </Paper>
    </motion.div>
  );
}

export default Dashboard;
