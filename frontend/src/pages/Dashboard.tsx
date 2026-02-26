/**
 * Dashboard Page
 *
 * Premium enterprise dashboard with glassmorphism.
 * Algolia brand colors: Nebula Blue #003DFF, Accent Purple #5468FF
 */

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Text,
  Group,
  Paper,
  Badge,
  Tooltip,
  Modal,
  Table,
  Loader,
  Button,
} from '@mantine/core';
import {
  IconMinus,
  IconEqual,
  IconTarget,
  IconFlame,
  IconBolt,
  IconSnowflake,
  IconExternalLink,
  IconDownload,
  IconChevronDown,
  IconChevronUp,
  IconLayoutGrid,
} from '@tabler/icons-react';

import { getStats, getCompanies, getDistribution, type DistributionData } from '@/services/api';
import { TargetList } from '@/components/targets/TargetList';
import { usePartner } from '@/contexts/PartnerContext';
import { AlgoliaLogo } from '@/components/common/AlgoliaLogo';
import { getPartnerLogo } from '@/components/common/PartnerLogos';
import type { FilterState, DashboardStats } from '@/types';

// Algolia brand colors
const ALGOLIA_BLUE = '#003DFF';
const ALGOLIA_PURPLE = '#5468FF';

// Types for cell click modal
interface CellSelection {
  tier: string;
  tierLabel: string;
  vertical: string;
  count: number;
  color: string;
}

export function Dashboard() {
  const { selectedPartner } = usePartner();
  const [filters, setFilters] = useState<FilterState>({
    sort_by: 'icp_score',
    sort_order: 'desc',
  });
  const [page, setPage] = useState(1);
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['stats', selectedPartner.key],
    queryFn: getStats,
  });

  // Fetch distribution data for the grid
  const { data: distribution } = useQuery({
    queryKey: ['distribution', selectedPartner.key],
    queryFn: getDistribution,
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

  // Fetch companies for modal when cell is selected
  const { data: cellCompanies, isLoading: cellLoading } = useQuery({
    queryKey: ['cell-companies', selectedCell?.tier, selectedCell?.vertical],
    queryFn: () => getCompanies({
      status: selectedCell?.tier as 'hot' | 'warm' | 'cold',
      vertical: selectedCell?.vertical,
      sort_by: 'icp_score',
      sort_order: 'desc',
      page: 1,
      limit: 10,
    }),
    enabled: !!selectedCell,
  });

  const hotCount = stats?.hot_leads || 0;
  const warmCount = stats?.warm_leads || 0;
  const coldCount = stats?.cold_leads || 0;
  const total = stats?.total_companies || 0;

  const handleCellClick = (cell: CellSelection) => {
    if (cell.count > 0) {
      setSelectedCell(cell);
    }
  };

  const handleViewAll = () => {
    if (selectedCell) {
      setFilters({
        ...filters,
        status: selectedCell.tier as 'hot' | 'warm' | 'cold',
        vertical: selectedCell.vertical,
      });
      setSelectedCell(null);
      // Scroll to targets section
      document.getElementById('targets-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Container size="xl" py="md">
      {/* Cell Detail Modal - RESIZABLE with larger fonts */}
      <Modal
        opened={!!selectedCell}
        onClose={() => setSelectedCell(null)}
        title={
          <Group gap="md">
            <Badge
              size="xl"
              style={{ background: selectedCell?.color, color: 'white', fontSize: '16px', padding: '12px 20px' }}
            >
              {selectedCell?.tierLabel}
            </Badge>
            <Text fw={700} c="white" size="xl">{selectedCell?.vertical}</Text>
            <Text c="dimmed" size="lg">({selectedCell?.count} targets)</Text>
          </Group>
        }
        size="70%"
        styles={{
          header: {
            background: '#1a1a2e',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '20px 24px',
          },
          content: {
            background: '#1a1a2e',
            resize: 'both',
            overflow: 'auto',
            minWidth: '500px',
            minHeight: '400px',
          },
          body: { padding: '24px' },
          title: { fontSize: '18px' },
        }}
      >
        {/* Resize hint */}
        <Text size="sm" c="dimmed" mb="md" style={{ fontStyle: 'italic' }}>
          💡 Drag bottom-right corner to resize this modal
        </Text>

        {cellLoading ? (
          <div className="flex justify-center py-12">
            <Loader color={selectedCell?.color} size="lg" />
          </div>
        ) : (
          <>
            <Table
              striped
              highlightOnHover
              styles={{
                table: { background: 'transparent' },
                tr: { borderColor: 'rgba(255,255,255,0.1)' },
                td: { color: 'white', padding: '16px 20px', fontSize: '16px' },
                th: { color: 'rgba(255,255,255,0.7)', padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase' },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Company</Table.Th>
                  <Table.Th>ICP Score</Table.Th>
                  <Table.Th>Traffic</Table.Th>
                  <Table.Th>Search Provider</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cellCompanies?.data.slice(0, 10).map((company) => (
                  <Table.Tr key={company.domain} style={{ cursor: 'pointer' }}>
                    <Table.Td>
                      <Text fw={600} size="lg">{company.company_name}</Text>
                      <Text size="sm" c="dimmed">{company.domain}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="lg" color={selectedCell?.color} variant="light" style={{ fontSize: '16px', padding: '8px 16px' }}>
                        {company.icp_score}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="lg" fw={500}>
                        {company.sw_monthly_visits
                          ? `${(company.sw_monthly_visits / 1000000).toFixed(1)}M`
                          : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="md" c="dimmed">
                        {company.current_search || 'Unknown'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="space-between" mt="xl">
              <Button
                variant="subtle"
                color="gray"
                size="md"
                leftSection={<IconDownload size={20} />}
                onClick={() => {
                  // TODO: Export CSV
                  console.log('Export CSV for', selectedCell);
                }}
              >
                Export CSV
              </Button>
              <Button
                variant="gradient"
                gradient={{ from: selectedCell?.color || '#5468FF', to: ALGOLIA_PURPLE }}
                size="lg"
                rightSection={<IconExternalLink size={20} />}
                onClick={handleViewAll}
              >
                View All {selectedCell?.count} Targets
              </Button>
            </Group>
          </>
        )}
      </Modal>

      {/* Hero Section */}
      <HeroSection
        stats={stats}
        partnerKey={selectedPartner.key}
        partnerName={selectedPartner.name}
      />

      {/* Distribution Grid - Compact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-4"
      >
        <Paper
          p="md"
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Group justify="space-between" mb="sm">
            <Group gap="sm">
              <Text fw={700} c="white" size="xl">Target Distribution</Text>
              <Text size="sm" c="dimmed">Verticals ranked by Hot leads priority</Text>
            </Group>
            <Text size="sm" c="dimmed">Click cells to drill down</Text>
          </Group>
          {distribution ? (
            <DistributionGrid distribution={distribution} onCellClick={handleCellClick} />
          ) : (
            <div className="flex justify-center py-8">
              <Loader color="blue" size="sm" />
            </div>
          )}
        </Paper>
      </motion.div>

      {/* Displacement Targets Section */}
      <motion.div
        id="targets-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Paper
          p="lg"
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600} c="white" size="md">Displacement Targets</Text>
              <Text size="xs" c="dimmed">
                Click any row to view full company intelligence
              </Text>
            </div>

            {/* Lead Status Badges */}
            <Group gap="xs">
              <Tooltip label="ICP 80-100: Ready for outreach" withArrow>
                <Badge size="sm" variant="gradient" gradient={{ from: '#ef4444', to: '#dc2626' }} leftSection={<IconFlame size={12} />} style={{ cursor: 'help' }}>
                  {hotCount} Hot
                </Badge>
              </Tooltip>
              <Tooltip label="ICP 40-79: Nurture pipeline" withArrow>
                <Badge size="sm" variant="gradient" gradient={{ from: '#f97316', to: '#ea580c' }} leftSection={<IconBolt size={12} />} style={{ cursor: 'help' }}>
                  {warmCount} Warm
                </Badge>
              </Tooltip>
              <Tooltip label="ICP 0-39: Low priority" withArrow>
                <Badge size="sm" variant="light" color="gray" leftSection={<IconSnowflake size={12} />} style={{ cursor: 'help' }}>
                  {coldCount} Cold
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

// Distribution Grid with Expand/Collapse Animation - LARGER FONTS
interface DistributionGridProps {
  distribution: DistributionData;
  onCellClick: (cell: CellSelection) => void;
}

function DistributionGrid({ distribution, onCellClick }: DistributionGridProps) {
  const { verticals, allVerticals, tiers, grandTotal, hiddenVerticalsCount } = distribution;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOtherModal, setShowOtherModal] = useState(false);

  const pct = (n: number) => grandTotal > 0 ? ((n / grandTotal) * 100).toFixed(1) : '0.0';

  // Shorten long vertical names for display
  const shortName = (name: string) => {
    const map: Record<string, string> = {
      'Business And Industrial': 'Business',
      'Technology And Computing': 'Technology',
      'Automotive And Vehicles': 'Automotive',
      'Law, Govt And Politics': 'Government',
      'Health And Fitness': 'Healthcare',
      'Art And Entertainment': 'Entertainment',
      'Style And Fashion': 'Fashion',
      'Food And Drink': 'F&B',
      'Home And Garden': 'Home',
      'Hobbies And Interests': 'Hobbies',
      'Family And Parenting': 'Family',
      'Religion And Spirituality': 'Religion',
    };
    return map[name] || name;
  };

  // Get displayed verticals based on expanded state
  const displayedVerticals = isExpanded
    ? allVerticals.map(v => v.name)
    : verticals;

  // Hidden verticals for the modal (excludes top 5)
  const hiddenVerticals = allVerticals.slice(5);

  return (
    <>
      {/* All Verticals Modal - RESIZABLE with LARGE fonts */}
      <Modal
        opened={showOtherModal}
        onClose={() => setShowOtherModal(false)}
        title={
          <Group gap="md">
            <Text fw={700} c="white" size="xl">All Verticals</Text>
            <Badge size="lg" color="gray" style={{ fontSize: '14px', padding: '8px 16px' }}>{allVerticals.length} total</Badge>
          </Group>
        }
        size="70%"
        styles={{
          header: {
            background: '#1a1a2e',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '20px 24px',
          },
          content: {
            background: '#1a1a2e',
            resize: 'both',
            overflow: 'auto',
            minWidth: '600px',
            minHeight: '400px',
          },
          body: { padding: '24px' },
        }}
      >
        {/* Resize hint */}
        <Text size="sm" c="dimmed" mb="md" style={{ fontStyle: 'italic' }}>
          💡 Drag bottom-right corner to resize this modal
        </Text>

        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <Table
            striped
            highlightOnHover
            styles={{
              table: { background: 'transparent' },
              tr: { borderColor: 'rgba(255,255,255,0.1)' },
              td: { color: 'white', padding: '16px 20px', fontSize: '16px' },
              th: { color: 'rgba(255,255,255,0.7)', padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase' },
            }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Vertical</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Hot</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Warm</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Cold</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allVerticals.map((v, idx) => (
                <Table.Tr key={v.name} style={{ opacity: idx < 5 ? 1 : 0.85 }}>
                  <Table.Td>
                    <Group gap="sm">
                      {idx < 5 && <Badge size="md" color="blue" variant="light" style={{ fontSize: '12px' }}>Top 5</Badge>}
                      <Text size="lg" fw={500}>{v.shortName}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge size="lg" color="red" variant={v.hot > 0 ? 'filled' : 'light'} style={{ fontSize: '16px', padding: '8px 16px' }}>
                      {v.hot}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge size="lg" color="orange" variant={v.warm > 0 ? 'filled' : 'light'} style={{ fontSize: '16px', padding: '8px 16px' }}>
                      {v.warm}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge size="lg" color="gray" variant={v.cold > 0 ? 'filled' : 'light'} style={{ fontSize: '16px', padding: '8px 16px' }}>
                      {v.cold}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Text fw={700} size="lg">{v.total.toLocaleString()}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Modal>

      {/* Expand/Collapse Toggle - Clean, no redundancy */}
      <Group justify="flex-end" mb="sm">
        {hiddenVerticalsCount > 0 && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant={isExpanded ? 'light' : 'gradient'}
              gradient={{ from: ALGOLIA_BLUE, to: ALGOLIA_PURPLE }}
              size="md"
              onClick={() => setIsExpanded(!isExpanded)}
              leftSection={
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <IconChevronDown size={20} />
                </motion.div>
              }
              style={{ fontWeight: 600 }}
            >
              {isExpanded ? 'Show Top 5' : `Show All ${allVerticals.length}`}
            </Button>
          </motion.div>
        )}
      </Group>

      {/* Grid Container - PREMIUM DESIGN with LARGE fonts, TIGHT spacing */}
      <motion.div
        layout
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ overflowX: 'auto' }}
      >
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px' }}>
          <thead>
            <tr>
              <th style={{ width: '90px', padding: '6px 8px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tier
              </th>
              <AnimatePresence mode="popLayout">
                {displayedVerticals.map(v => (
                  <motion.th
                    key={v}
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ padding: '6px 8px', textAlign: 'center', fontSize: '16px', fontWeight: 700, color: 'white' }}
                  >
                    {v === 'Other' ? (
                      <Tooltip label={`Click to see all ${hiddenVerticalsCount} hidden verticals`} withArrow>
                        <span
                          onClick={() => setShowOtherModal(true)}
                          style={{
                            cursor: 'pointer',
                            color: '#a78bfa',
                            textDecoration: 'underline',
                            textDecorationStyle: 'dotted',
                            fontSize: '16px',
                            fontWeight: 700,
                          }}
                        >
                          Other ({hiddenVerticalsCount})
                        </span>
                      </Tooltip>
                    ) : (
                      shortName(v)
                    )}
                  </motion.th>
                ))}
              </AnimatePresence>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, idx) => {
              // VIBRANT colors with higher saturation
              const vibrantColors: Record<string, { bg: string; text: string; glow: string }> = {
                hot: { bg: 'rgba(239, 68, 68, 0.35)', text: '#ff6b6b', glow: 'rgba(239, 68, 68, 0.5)' },
                warm: { bg: 'rgba(251, 146, 60, 0.35)', text: '#ffa94d', glow: 'rgba(251, 146, 60, 0.5)' },
                cold: { bg: 'rgba(148, 163, 184, 0.25)', text: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)' },
              };
              const colors = vibrantColors[tier.key] || vibrantColors.cold;

              return (
                <tr key={tier.key}>
                  <td style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: colors.bg,
                    borderLeft: `4px solid ${colors.text}`,
                    boxShadow: idx === 0 ? `0 0 20px ${colors.glow}` : 'none',
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: colors.text, letterSpacing: '0.5px' }}>{tier.label}</div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' }}>{tier.score}</div>
                  </td>
                  <AnimatePresence mode="popLayout">
                    {displayedVerticals.map(v => {
                      // For "Other" in collapsed view, sum up all hidden verticals
                      const value = v === 'Other'
                        ? hiddenVerticals.reduce((sum, hv) => sum + (tier.values[hv.name] || 0), 0)
                        : (tier.values[v] || 0);
                      const maxValue = Math.max(...Object.values(tier.values), 1);
                      const intensity = value > 0 ? Math.min(0.25 + (value / maxValue) * 0.45, 0.7) : 0.03;

                      return (
                        <motion.td
                          key={v}
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => {
                            if (v === 'Other') {
                              setShowOtherModal(true);
                            } else {
                              onCellClick({
                                tier: tier.key,
                                tierLabel: tier.label,
                                vertical: v,
                                count: value,
                                color: colors.text,
                              });
                            }
                          }}
                          style={{
                            padding: '8px 6px',
                            textAlign: 'center',
                            borderRadius: '8px',
                            background: value > 0
                              ? `rgba(${tier.key === 'hot' ? '239, 68, 68' : tier.key === 'warm' ? '251, 146, 60' : '148, 163, 184'}, ${intensity})`
                              : 'rgba(255,255,255,0.03)',
                            border: v === 'Other' ? '2px dashed rgba(167, 139, 250, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                            cursor: value > 0 || v === 'Other' ? 'pointer' : 'default',
                            transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (value > 0 || v === 'Other') {
                              e.currentTarget.style.transform = 'scale(1.05)';
                              e.currentTarget.style.boxShadow = `0 4px 20px ${colors.glow}`;
                              e.currentTarget.style.zIndex = '10';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.zIndex = '1';
                          }}
                        >
                          <div style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            color: value > 0 ? 'white' : 'rgba(255,255,255,0.15)',
                            lineHeight: 1,
                            textShadow: value > 0 ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                          }}>
                            {value > 0 ? value.toLocaleString() : '—'}
                          </div>
                          {value > 0 && (
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px', fontWeight: 500 }}>
                              {pct(value)}%
                            </div>
                          )}
                        </motion.td>
                      );
                    })}
                  </AnimatePresence>
                  <td style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    background: `rgba(${tier.key === 'hot' ? '239, 68, 68' : tier.key === 'warm' ? '251, 146, 60' : '148, 163, 184'}, 0.15)`,
                    border: `2px solid ${colors.text}50`,
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: colors.text, lineHeight: 1 }}>
                      {tier.total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px', fontWeight: 500 }}>
                      {pct(tier.total)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>

      {/* Footer - minimal */}
      <Text size="sm" c="dimmed" mt="xs" ta="center">
        Click any cell to view companies
      </Text>
    </>
  );
}

export default Dashboard;
