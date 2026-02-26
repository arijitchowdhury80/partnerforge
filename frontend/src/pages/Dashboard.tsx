/**
 * Dashboard Page
 *
 * Clean, focused dashboard with visual formula hero and 2x2 matrix.
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
  Grid,
  Stack,
  Tooltip,
  Progress,
} from '@mantine/core';
import {
  IconMinus,
  IconEqual,
  IconTarget,
  IconFlame,
  IconTrendingUp,
  IconBuildingSkyscraper,
  IconChevronRight,
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
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

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

      {/* Metrics Row: ICP Matrix (2 cols) + Vertical Distribution (1 col) */}
      <Grid mb="lg" gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <ICPMatrix stats={stats} expandedTier={expandedTier} onTierClick={setExpandedTier} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <VerticalDistribution />
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
        style={{
          background: `linear-gradient(135deg, ${ALGOLIA_BLUE}20 0%, ${ALGOLIA_PURPLE}10 100%)`,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
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
              className="text-4xl md:text-6xl font-bold"
              style={{ color: 'white' }}
            >
              {displayTotal}
            </motion.span>
            <Text size="lg" c="white" opacity={0.7} mb="xs">
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
            <IconMinus size={16} style={{ color: '#ef4444' }} />

            {/* Already using Algolia */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <AlgoliaLogo size={24} />
              <Text size="sm" c="white" fw={500}>Algolia</Text>
            </div>

            {/* Equals */}
            <IconEqual size={16} style={{ color: '#22c55e' }} />

            {/* Result */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
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
          </div>
        </div>
      </Paper>
    </motion.div>
  );
}

// ICP Matrix - 2x2 showing Score Tiers with expandable details
interface ICPMatrixProps {
  stats?: DashboardStats;
  expandedTier: string | null;
  onTierClick: (tier: string | null) => void;
}

function ICPMatrix({ stats, expandedTier, onTierClick }: ICPMatrixProps) {
  // ICP Score Tiers with sample data
  const tiers = [
    {
      id: 'tier1',
      label: 'Tier 1 (80-100)',
      range: '80-100',
      count: stats?.hot_leads || 9,
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      description: 'High-value targets ready for outreach',
      companies: ['Mercedes-Benz (95)', 'Mark\'s (85)', 'Infiniti (85)'],
    },
    {
      id: 'tier2',
      label: 'Tier 2 (60-79)',
      range: '60-79',
      count: stats?.warm_leads || 49,
      color: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.15)',
      borderColor: 'rgba(249, 115, 22, 0.3)',
      description: 'Strong potential, needs nurturing',
      companies: ['HOFER (75)', 'Fiat (72)', 'Bever (70)'],
    },
    {
      id: 'tier3',
      label: 'Tier 3 (40-59)',
      range: '40-59',
      count: 150,
      color: ALGOLIA_PURPLE,
      bgColor: `${ALGOLIA_PURPLE}20`,
      borderColor: `${ALGOLIA_PURPLE}40`,
      description: 'Moderate fit, long-term prospects',
      companies: ['Company A (55)', 'Company B (48)', 'Company C (42)'],
    },
    {
      id: 'tier4',
      label: 'Tier 4 (0-39)',
      range: '0-39',
      count: 200,
      color: '#6b7280',
      bgColor: 'rgba(107, 114, 128, 0.15)',
      borderColor: 'rgba(107, 114, 128, 0.3)',
      description: 'Low priority, monitor for changes',
      companies: ['Company X (35)', 'Company Y (28)', 'Company Z (15)'],
    },
  ];

  const total = tiers.reduce((sum, t) => sum + t.count, 0);

  return (
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10 h-full">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconTrendingUp size={16} style={{ color: ALGOLIA_PURPLE }} />
          <Text fw={600} size="sm" c="white">ICP Score Distribution</Text>
        </Group>
        <Badge size="xs" variant="light" style={{ backgroundColor: `${ALGOLIA_PURPLE}30`, color: ALGOLIA_PURPLE }}>
          {total.toLocaleString()} total
        </Badge>
      </Group>

      {/* 2x2 Grid of Tiers */}
      <div className="grid grid-cols-2 gap-3">
        {tiers.map((tier) => (
          <motion.div
            key={tier.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Tooltip
              label={tier.description}
              position="top"
              withArrow
            >
              <Paper
                p="sm"
                radius="md"
                className="cursor-pointer transition-all"
                style={{
                  background: expandedTier === tier.id ? tier.bgColor : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${expandedTier === tier.id ? tier.borderColor : 'rgba(255,255,255,0.08)'}`,
                }}
                onClick={() => onTierClick(expandedTier === tier.id ? null : tier.id)}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="xs" c="dimmed">{tier.range}</Text>
                  <IconChevronRight
                    size={14}
                    style={{
                      color: tier.color,
                      transform: expandedTier === tier.id ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}
                  />
                </Group>
                <Text size="xl" fw={700} style={{ color: tier.color }}>
                  {tier.count}
                </Text>
                <Progress
                  value={(tier.count / total) * 100}
                  size="xs"
                  mt="xs"
                  color={tier.color === '#ef4444' ? 'red' : tier.color === '#f97316' ? 'orange' : tier.color === ALGOLIA_PURPLE ? 'violet' : 'gray'}
                />

                {/* Expanded view */}
                {expandedTier === tier.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 pt-2 border-t border-white/10"
                  >
                    <Stack gap={2}>
                      {tier.companies.map((company, i) => (
                        <Text key={i} size="xs" c="white" className="truncate">
                          {company}
                        </Text>
                      ))}
                      <Text size="xs" c="dimmed" className="mt-1">
                        +{tier.count - 3} more...
                      </Text>
                    </Stack>
                  </motion.div>
                )}
              </Paper>
            </Tooltip>
          </motion.div>
        ))}
      </div>
    </Paper>
  );
}

// Vertical/Industry Distribution (replaces Partner Technology)
function VerticalDistribution() {
  // Industry distribution with ICP tier breakdown
  const verticals = [
    { name: 'Commerce', total: 1850, tier1: 5, tier2: 28, tier3: 80 },
    { name: 'Media & Publishing', total: 620, tier1: 2, tier2: 12, tier3: 35 },
    { name: 'Financial Services', total: 480, tier1: 1, tier2: 6, tier3: 22 },
    { name: 'Healthcare', total: 320, tier1: 1, tier2: 3, tier3: 13 },
    { name: 'Other', total: 417, tier1: 0, tier2: 0, tier3: 0 },
  ];

  return (
    <Paper p="md" radius="lg" className="bg-white/5 border border-white/10 h-full">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconBuildingSkyscraper size={16} style={{ color: '#06b6d4' }} />
          <Text fw={600} size="sm" c="white">By Vertical</Text>
        </Group>
        <Badge size="xs" variant="light" color="cyan">Industry</Badge>
      </Group>

      <Stack gap="sm">
        {verticals.map((vertical) => (
          <div key={vertical.name}>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="white">{vertical.name}</Text>
              <Text size="xs" c="dimmed">{vertical.total.toLocaleString()}</Text>
            </Group>
            {/* Stacked bar showing tier distribution */}
            <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
              {vertical.tier1 > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(vertical.tier1 / vertical.total) * 100}%`,
                    backgroundColor: '#ef4444',
                  }}
                />
              )}
              {vertical.tier2 > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(vertical.tier2 / vertical.total) * 100}%`,
                    backgroundColor: '#f97316',
                  }}
                />
              )}
              {vertical.tier3 > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(vertical.tier3 / vertical.total) * 100}%`,
                    backgroundColor: ALGOLIA_PURPLE,
                  }}
                />
              )}
              <div
                className="h-full flex-1"
                style={{ backgroundColor: '#374151' }}
              />
            </div>
          </div>
        ))}
      </Stack>

      {/* Legend */}
      <div className="flex gap-3 mt-4 pt-3 border-t border-white/10">
        <Group gap={4}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
          <Text size="xs" c="dimmed">T1</Text>
        </Group>
        <Group gap={4}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f97316' }} />
          <Text size="xs" c="dimmed">T2</Text>
        </Group>
        <Group gap={4}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALGOLIA_PURPLE }} />
          <Text size="xs" c="dimmed">T3</Text>
        </Group>
        <Group gap={4}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#374151' }} />
          <Text size="xs" c="dimmed">T4</Text>
        </Group>
      </div>
    </Paper>
  );
}

export default Dashboard;
