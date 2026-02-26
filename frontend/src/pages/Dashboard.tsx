/**
 * Dashboard Page
 *
 * Premium enterprise dashboard with glassmorphism.
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
  IconX,
  IconExternalLink,
  IconDownload,
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
      status: selectedCell?.tier as 'hot' | 'warm' | 'cool' | 'cold',
      vertical: selectedCell?.vertical,
      sort_by: 'icp_score',
      sort_order: 'desc',
      page: 1,
      limit: 10,
    }),
    enabled: !!selectedCell,
  });

  const hotCount = stats?.hot_leads || 9;
  const warmCount = stats?.warm_leads || 49;
  const remaining = (stats?.total_companies || 2737) - hotCount - warmCount;
  const coolCount = Math.round(remaining * 0.15);
  const coldCount = remaining - coolCount;
  const total = hotCount + warmCount + coolCount + coldCount;

  const handleCellClick = (cell: CellSelection) => {
    if (cell.count > 0) {
      setSelectedCell(cell);
    }
  };

  const handleViewAll = () => {
    if (selectedCell) {
      setFilters({
        ...filters,
        status: selectedCell.tier as 'hot' | 'warm' | 'cool' | 'cold',
        vertical: selectedCell.vertical,
      });
      setSelectedCell(null);
      // Scroll to targets section
      document.getElementById('targets-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Container size="xl" py="md">
      {/* Cell Detail Modal */}
      <Modal
        opened={!!selectedCell}
        onClose={() => setSelectedCell(null)}
        title={
          <Group gap="sm">
            <Badge
              size="lg"
              style={{ background: selectedCell?.color, color: 'white' }}
            >
              {selectedCell?.tierLabel}
            </Badge>
            <Text fw={600} c="white">{selectedCell?.vertical}</Text>
            <Text c="dimmed">({selectedCell?.count} targets)</Text>
          </Group>
        }
        size="lg"
        styles={{
          header: { background: '#1a1a2e', borderBottom: '1px solid rgba(255,255,255,0.1)' },
          content: { background: '#1a1a2e' },
          body: { padding: '20px' },
        }}
      >
        {cellLoading ? (
          <div className="flex justify-center py-8">
            <Loader color={selectedCell?.color} />
          </div>
        ) : (
          <>
            <Table
              striped
              highlightOnHover
              styles={{
                table: { background: 'transparent' },
                tr: { borderColor: 'rgba(255,255,255,0.1)' },
                td: { color: 'white', padding: '12px' },
                th: { color: 'rgba(255,255,255,0.6)', padding: '12px' },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Company</Table.Th>
                  <Table.Th>ICP Score</Table.Th>
                  <Table.Th>Traffic</Table.Th>
                  <Table.Th>Search</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cellCompanies?.data.slice(0, 10).map((company) => (
                  <Table.Tr key={company.domain} style={{ cursor: 'pointer' }}>
                    <Table.Td>
                      <Text fw={500}>{company.company_name}</Text>
                      <Text size="xs" c="dimmed">{company.domain}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={selectedCell?.color} variant="light">
                        {company.icp_score}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {company.sw_monthly_visits
                        ? `${(company.sw_monthly_visits / 1000000).toFixed(1)}M`
                        : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {company.current_search || 'Unknown'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="space-between" mt="lg">
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconDownload size={16} />}
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
                rightSection={<IconExternalLink size={16} />}
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
            <Text fw={600} c="white" size="md">Target Distribution</Text>
            <Text size="xs" c="dimmed">Click any cell to see companies</Text>
          </Group>
          <DistributionGrid total={total} onCellClick={handleCellClick} />
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
              <Tooltip label="ICP 60-79: Strong potential" withArrow>
                <Badge size="sm" variant="gradient" gradient={{ from: '#f97316', to: '#ea580c' }} leftSection={<IconBolt size={12} />} style={{ cursor: 'help' }}>
                  {warmCount} Warm
                </Badge>
              </Tooltip>
              <Tooltip label="ICP 40-59: Monitor for signals" withArrow>
                <Badge size="sm" variant="gradient" gradient={{ from: '#3b82f6', to: '#2563eb' }} style={{ cursor: 'help' }}>
                  {coolCount} Cool
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

// Compact Distribution Grid
interface DistributionGridProps {
  total: number;
  onCellClick: (cell: CellSelection) => void;
}

function DistributionGrid({ total, onCellClick }: DistributionGridProps) {
  const verticals = ['Commerce', 'Media', 'Financial', 'Healthcare', 'Other'];
  const tiers = [
    {
      key: 'hot',
      label: 'HOT',
      score: '80-100',
      color: '#ef4444',
      values: { Commerce: 5, Media: 2, Financial: 1, Healthcare: 1, Other: 0 },
      total: 9
    },
    {
      key: 'warm',
      label: 'WARM',
      score: '60-79',
      color: '#f97316',
      values: { Commerce: 28, Media: 12, Financial: 6, Healthcare: 3, Other: 0 },
      total: 49
    },
    {
      key: 'cool',
      label: 'COOL',
      score: '40-59',
      color: '#3b82f6',
      values: { Commerce: 200, Media: 95, Financial: 52, Healthcare: 35, Other: 12 },
      total: 394
    },
    {
      key: 'cold',
      label: 'COLD',
      score: '0-39',
      color: '#6b7280',
      values: { Commerce: 1617, Media: 511, Financial: 421, Healthcare: 264, Other: 405 },
      total: 2285
    },
  ];

  const pct = (n: number) => ((n / total) * 100).toFixed(1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
        <thead>
          <tr>
            <th style={{ width: '100px', padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              ICP Tier
            </th>
            {verticals.map(v => (
              <th key={v} style={{ padding: '8px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'white' }}>
                {v}
              </th>
            ))}
            <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, idx) => (
            <tr key={tier.key}>
              <td style={{
                padding: '8px 10px',
                borderRadius: '8px',
                background: `${tier.color}15`,
                borderLeft: `3px solid ${tier.color}`,
                // Hot row gets extra glow
                boxShadow: idx === 0 ? `0 0 12px ${tier.color}30` : 'none',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: tier.color }}>{tier.label}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{tier.score}</div>
              </td>
              {verticals.map(v => {
                const value = tier.values[v as keyof typeof tier.values];
                return (
                  <td
                    key={v}
                    onClick={() => onCellClick({
                      tier: tier.key,
                      tierLabel: tier.label,
                      vertical: v,
                      count: value,
                      color: tier.color,
                    })}
                    style={{
                      padding: '10px',
                      textAlign: 'center',
                      borderRadius: '8px',
                      background: value > 0 ? `${tier.color}${Math.min(15 + Math.round((value / 1617) * 40), 55).toString(16)}` : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      cursor: value > 0 ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (value > 0) {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.boxShadow = `0 2px 12px ${tier.color}40`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontSize: '18px', fontWeight: 700, color: value > 0 ? 'white' : 'rgba(255,255,255,0.15)' }}>
                      {value > 0 ? value.toLocaleString() : '—'}
                    </div>
                    {value > 0 && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                        {pct(value)}%
                      </div>
                    )}
                  </td>
                );
              })}
              <td style={{
                padding: '10px',
                textAlign: 'center',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${tier.color}30`,
              }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: tier.color }}>
                  {tier.total.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                  {pct(tier.total)}%
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;
