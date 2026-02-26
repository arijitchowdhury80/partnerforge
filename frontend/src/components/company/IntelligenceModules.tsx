/**
 * IntelligenceModules Component
 *
 * Grid of 15 intelligence module cards organized by waves.
 * Each card shows module name, status, last updated, and key data.
 * Supports expandable detail view.
 */

import { useState } from 'react';
import {
  Paper,
  Text,
  Badge,
  Group,
  Stack,
  Grid,
  ThemeIcon,
  Collapse,
  ActionIcon,
  Progress,
  Tooltip,
  Divider,
  Skeleton,
  Box,
} from '@mantine/core';
import {
  IconBuilding,
  IconServer,
  IconChartLine,
  IconCoin,
  IconUsers,
  IconBriefcase,
  IconTarget,
  IconFileText,
  IconQuote,
  IconUserCircle,
  IconArrowsExchange,
  IconBook,
  IconPriorityHigh,
  IconActivity,
  IconReport,
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
  IconCheck,
  IconX,
  IconClock,
  IconExternalLink,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ModuleId, ModuleStatus, SourceCitation } from '@/types';
import { SourceBadge } from '@/components/common/SourceBadge';

// =============================================================================
// Module Configuration
// =============================================================================

interface ModuleConfig {
  id: ModuleId;
  name: string;
  shortName: string;
  description: string;
  icon: React.ElementType;
  wave: 1 | 2 | 3 | 4;
  color: string;
}

const MODULE_CONFIGS: ModuleConfig[] = [
  // Wave 1: Foundation
  {
    id: 'm01_company_context',
    name: 'Company Context',
    shortName: 'Context',
    description: 'Basic company information, HQ, industry classification',
    icon: IconBuilding,
    wave: 1,
    color: 'blue',
  },
  {
    id: 'm02_tech_stack',
    name: 'Tech Stack',
    shortName: 'Tech',
    description: 'Technology detection via BuiltWith',
    icon: IconServer,
    wave: 1,
    color: 'grape',
  },
  {
    id: 'm03_traffic',
    name: 'Traffic Analysis',
    shortName: 'Traffic',
    description: 'SimilarWeb traffic and engagement data',
    icon: IconChartLine,
    wave: 1,
    color: 'cyan',
  },
  {
    id: 'm04_financials',
    name: 'Financial Profile',
    shortName: 'Financials',
    description: 'Revenue, margins, stock performance',
    icon: IconCoin,
    wave: 1,
    color: 'green',
  },

  // Wave 2: Competitive
  {
    id: 'm05_competitors',
    name: 'Competitors',
    shortName: 'Competitors',
    description: 'Competitor identification and search providers',
    icon: IconUsers,
    wave: 2,
    color: 'orange',
  },
  {
    id: 'm06_hiring',
    name: 'Hiring Signals',
    shortName: 'Hiring',
    description: 'Job postings and hiring patterns',
    icon: IconBriefcase,
    wave: 2,
    color: 'pink',
  },
  {
    id: 'm07_strategic',
    name: 'Strategic Angles',
    shortName: 'Strategic',
    description: 'Strategic positioning and angles',
    icon: IconTarget,
    wave: 2,
    color: 'red',
  },

  // Wave 3: Buying Signals
  {
    id: 'm08_investor',
    name: 'Investor Intelligence',
    shortName: 'Investor',
    description: 'SEC filings, earnings, risk factors',
    icon: IconFileText,
    wave: 3,
    color: 'indigo',
  },
  {
    id: 'm09_executive',
    name: 'Executive Quotes',
    shortName: 'Quotes',
    description: '"In Their Own Words" executive statements',
    icon: IconQuote,
    wave: 3,
    color: 'violet',
  },
  {
    id: 'm10_buying_committee',
    name: 'Buying Committee',
    shortName: 'Committee',
    description: 'Key stakeholders and decision makers',
    icon: IconUserCircle,
    wave: 3,
    color: 'teal',
  },
  {
    id: 'm11_displacement',
    name: 'Displacement Analysis',
    shortName: 'Displacement',
    description: 'Current search provider analysis',
    icon: IconArrowsExchange,
    wave: 3,
    color: 'lime',
  },

  // Wave 4: Synthesis
  {
    id: 'm12_case_study',
    name: 'Case Study Match',
    shortName: 'Cases',
    description: 'Relevant Algolia case studies',
    icon: IconBook,
    wave: 4,
    color: 'yellow',
  },
  {
    id: 'm13_icp_priority',
    name: 'ICP Priority',
    shortName: 'ICP',
    description: 'Ideal Customer Profile scoring',
    icon: IconPriorityHigh,
    wave: 4,
    color: 'red',
  },
  {
    id: 'm14_signal_scoring',
    name: 'Signal Scoring',
    shortName: 'Signals',
    description: 'Aggregated signal strength',
    icon: IconActivity,
    wave: 4,
    color: 'orange',
  },
  {
    id: 'm15_strategic_brief',
    name: 'Strategic Brief',
    shortName: 'Brief',
    description: 'Executive summary and recommendations',
    icon: IconReport,
    wave: 4,
    color: 'blue',
  },
];

const WAVE_LABELS: Record<number, { name: string; color: string }> = {
  1: { name: 'Foundation', color: 'blue' },
  2: { name: 'Competitive', color: 'orange' },
  3: { name: 'Buying Signals', color: 'violet' },
  4: { name: 'Synthesis', color: 'green' },
};

// =============================================================================
// Component Props
// =============================================================================

interface ModuleData {
  status: ModuleStatus;
  data?: unknown;
  source?: SourceCitation;
  summary?: string;
}

interface IntelligenceModulesProps {
  domain: string;
  modules: Record<ModuleId, ModuleData>;
  isLoading?: boolean;
  onRefreshModule?: (moduleId: ModuleId) => void;
  onExpandModule?: (moduleId: ModuleId) => void;
}

// =============================================================================
// Module Card Component
// =============================================================================

interface ModuleCardProps {
  config: ModuleConfig;
  data: ModuleData;
  onRefresh?: () => void;
  onExpand?: () => void;
}

function ModuleCard({ config, data, onRefresh, onExpand }: ModuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = config.icon;

  const statusConfig = {
    complete: { color: 'green', icon: IconCheck, label: 'Complete' },
    running: { color: 'blue', icon: IconClock, label: 'Running' },
    pending: { color: 'gray', icon: IconClock, label: 'Pending' },
    error: { color: 'red', icon: IconX, label: 'Error' },
  };

  const status = statusConfig[data.status.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && onExpand) {
      onExpand();
    }
  };

  // Format last updated time
  const formatLastUpdated = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Paper
        p="md"
        radius="md"
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(10px)',
          border: `1px solid rgba(100, 116, 139, ${isExpanded ? '0.4' : '0.2'})`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={handleToggleExpand}
      >
        {/* Header */}
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon
              variant="light"
              color={config.color}
              size="lg"
              radius="md"
            >
              <Icon size={18} />
            </ThemeIcon>
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {config.shortName}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {config.description}
              </Text>
            </div>
          </Group>

          <Group gap={4} wrap="nowrap">
            <Badge
              size="xs"
              variant="light"
              color={status.color}
              leftSection={<StatusIcon size={10} />}
            >
              {status.label}
            </Badge>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand();
              }}
            >
              {isExpanded ? (
                <IconChevronDown size={14} />
              ) : (
                <IconChevronRight size={14} />
              )}
            </ActionIcon>
          </Group>
        </Group>

        {/* Last Updated */}
        <Group gap="xs" mt="xs" justify="space-between">
          <Text size="xs" c="dimmed">
            Updated: {formatLastUpdated(data.status.last_updated)}
          </Text>
          {data.source && (
            <SourceBadge
              source={data.source}
              freshness={data.status.freshness}
              compact
            />
          )}
        </Group>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Divider my="sm" />
              <Stack gap="xs">
                {data.summary ? (
                  <Text size="sm" c="dimmed">
                    {data.summary}
                  </Text>
                ) : data.status.status === 'error' ? (
                  <Text size="sm" c="red">
                    {data.status.error_message || 'Module enrichment failed'}
                  </Text>
                ) : data.status.status === 'pending' ? (
                  <Text size="sm" c="dimmed" fs="italic">
                    Not yet enriched. Click refresh to start.
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed" fs="italic">
                    No summary available.
                  </Text>
                )}

                <Group gap="xs" justify="flex-end">
                  <Tooltip label="Refresh this module">
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRefresh?.();
                      }}
                    >
                      <IconRefresh size={14} />
                    </ActionIcon>
                  </Tooltip>
                  {data.source && (
                    <Tooltip label="View source">
                      <ActionIcon
                        variant="light"
                        size="sm"
                        color="gray"
                        component="a"
                        href={data.source.url}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconExternalLink size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>
    </motion.div>
  );
}

// =============================================================================
// Wave Section Component
// =============================================================================

interface WaveSectionProps {
  waveNumber: 1 | 2 | 3 | 4;
  modules: ModuleConfig[];
  moduleData: Record<ModuleId, ModuleData>;
  onRefreshModule?: (moduleId: ModuleId) => void;
  onExpandModule?: (moduleId: ModuleId) => void;
}

function WaveSection({
  waveNumber,
  modules,
  moduleData,
  onRefreshModule,
  onExpandModule,
}: WaveSectionProps) {
  const wave = WAVE_LABELS[waveNumber];
  const completedCount = modules.filter(
    (m) => moduleData[m.id]?.status.status === 'complete'
  ).length;
  const progress = Math.round((completedCount / modules.length) * 100);

  return (
    <Box>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Badge variant="filled" color={wave.color} size="sm">
            Wave {waveNumber}
          </Badge>
          <Text size="sm" fw={600}>
            {wave.name}
          </Text>
        </Group>
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {completedCount}/{modules.length}
          </Text>
          <Progress
            value={progress}
            size="sm"
            color={wave.color}
            w={60}
            radius="xl"
          />
        </Group>
      </Group>

      <Grid gutter="sm">
        {modules.map((module) => (
          <Grid.Col key={module.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
            <ModuleCard
              config={module}
              data={moduleData[module.id] || { status: { status: 'pending' } }}
              onRefresh={() => onRefreshModule?.(module.id)}
              onExpand={() => onExpandModule?.(module.id)}
            />
          </Grid.Col>
        ))}
      </Grid>
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function IntelligenceModules({
  domain,
  modules: moduleData,
  isLoading = false,
  onRefreshModule,
  onExpandModule,
}: IntelligenceModulesProps) {
  // Group modules by wave
  const waves = [1, 2, 3, 4] as const;

  if (isLoading) {
    return (
      <Stack gap="xl">
        {waves.map((wave) => (
          <Box key={wave}>
            <Group justify="space-between" mb="sm">
              <Skeleton height={24} width={150} />
              <Skeleton height={20} width={100} />
            </Group>
            <Grid gutter="sm">
              {[1, 2, 3, 4].map((i) => (
                <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                  <Skeleton height={120} radius="md" />
                </Grid.Col>
              ))}
            </Grid>
          </Box>
        ))}
      </Stack>
    );
  }

  // Calculate overall stats
  const allModuleStatuses = Object.values(moduleData);
  const totalModules = MODULE_CONFIGS.length;
  const completedModules = allModuleStatuses.filter(
    (m) => m.status.status === 'complete'
  ).length;
  const runningModules = allModuleStatuses.filter(
    (m) => m.status.status === 'running'
  ).length;
  const erroredModules = allModuleStatuses.filter(
    (m) => m.status.status === 'error'
  ).length;

  return (
    <Stack gap="xl">
      {/* Overall Progress Header */}
      <Paper
        p="md"
        radius="md"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.6))',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
        }}
      >
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={600}>
              Intelligence Modules
            </Text>
            <Text size="sm" c="dimmed">
              {completedModules} of {totalModules} modules complete
              {runningModules > 0 && ` (${runningModules} running)`}
              {erroredModules > 0 && ` (${erroredModules} errors)`}
            </Text>
          </div>
          <Group gap="lg">
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700} c="green">
                {completedModules}
              </Text>
              <Text size="xs" c="dimmed">
                Complete
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700} c="blue">
                {runningModules}
              </Text>
              <Text size="xs" c="dimmed">
                Running
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700} c="red">
                {erroredModules}
              </Text>
              <Text size="xs" c="dimmed">
                Errors
              </Text>
            </div>
          </Group>
        </Group>
        <Progress
          value={(completedModules / totalModules) * 100}
          size="lg"
          mt="md"
          color="green"
          radius="xl"
          animated={runningModules > 0}
        />
      </Paper>

      {/* Wave Sections */}
      {waves.map((waveNumber) => (
        <WaveSection
          key={waveNumber}
          waveNumber={waveNumber}
          modules={MODULE_CONFIGS.filter((m) => m.wave === waveNumber)}
          moduleData={moduleData}
          onRefreshModule={onRefreshModule}
          onExpandModule={onExpandModule}
        />
      ))}
    </Stack>
  );
}

// Export module configs for use in other components
export { MODULE_CONFIGS, WAVE_LABELS };
export type { ModuleConfig, ModuleData };
