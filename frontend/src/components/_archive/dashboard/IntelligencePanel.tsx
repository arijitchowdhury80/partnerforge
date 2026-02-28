/**
 * IntelligencePanel Component
 *
 * Display all 15 intelligence modules with status, data preview,
 * and actions. Premium glassmorphism with wave-based grouping.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paper,
  Text,
  Badge,
  Group,
  ActionIcon,
  Collapse,
  Progress,
  Tooltip,
  Button,
  Tabs,
  ScrollArea,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
  IconCheck,
  IconX,
  IconClock,
  IconLoader2,
  IconExternalLink,
  IconBuilding,
  IconCode,
  IconChartLine,
  IconCurrencyDollar,
  IconUsers,
  IconBriefcase,
  IconTarget,
  IconMessageCircle,
  IconUserCircle,
  IconUsersGroup,
  IconReplace,
  IconFileAnalytics,
  IconAward,
  IconTrendingUp,
  IconFileText,
} from '@tabler/icons-react';
import type { ModuleId, ModuleStatus, EnrichmentStatus, FreshnessStatus } from '@/types';

interface IntelligencePanelProps {
  domain: string;
  enrichmentStatus: EnrichmentStatus | undefined;
  onRefreshModule?: (moduleId: ModuleId) => void;
  onRefreshWave?: (wave: 1 | 2 | 3 | 4) => void;
  onRefreshAll?: () => void;
  isLoading?: boolean;
}

// Module configurations
interface ModuleConfig {
  id: ModuleId;
  name: string;
  shortName: string;
  description: string;
  icon: React.ReactNode;
  wave: 1 | 2 | 3 | 4;
}

const MODULE_CONFIGS: ModuleConfig[] = [
  // Wave 1: Foundation
  { id: 'm01_company_context', name: 'Company Context', shortName: 'Company', description: 'Basic company information, headquarters, industry', icon: <IconBuilding size={18} />, wave: 1 },
  { id: 'm02_tech_stack', name: 'Tech Stack', shortName: 'Tech', description: 'Technology detection via BuiltWith', icon: <IconCode size={18} />, wave: 1 },
  { id: 'm03_traffic', name: 'Traffic Analytics', shortName: 'Traffic', description: 'Website traffic and engagement from SimilarWeb', icon: <IconChartLine size={18} />, wave: 1 },
  { id: 'm04_financials', name: 'Financial Data', shortName: 'Finance', description: 'Revenue, margins, stock data from Yahoo Finance', icon: <IconCurrencyDollar size={18} />, wave: 1 },

  // Wave 2: Competitive
  { id: 'm05_competitors', name: 'Competitor Analysis', shortName: 'Competitors', description: 'Similar companies and their tech stacks', icon: <IconUsers size={18} />, wave: 2 },
  { id: 'm06_hiring', name: 'Hiring Signals', shortName: 'Hiring', description: 'Job openings and tech keywords', icon: <IconBriefcase size={18} />, wave: 2 },
  { id: 'm07_strategic', name: 'Strategic Angles', shortName: 'Strategic', description: 'Trigger events and opportunities', icon: <IconTarget size={18} />, wave: 2 },

  // Wave 3: Buying Signals
  { id: 'm08_investor', name: 'Investor Intelligence', shortName: 'Investor', description: 'SEC filings, earnings, risk factors', icon: <IconFileAnalytics size={18} />, wave: 3 },
  { id: 'm09_executive', name: 'Executive Quotes', shortName: 'Quotes', description: 'In Their Own Words - leadership priorities', icon: <IconMessageCircle size={18} />, wave: 3 },
  { id: 'm10_buying_committee', name: 'Buying Committee', shortName: 'Committee', description: 'Key decision makers and influencers', icon: <IconUsersGroup size={18} />, wave: 3 },

  // Wave 4: Synthesis
  { id: 'm11_displacement', name: 'Displacement Analysis', shortName: 'Displacement', description: 'Current search provider and migration potential', icon: <IconReplace size={18} />, wave: 4 },
  { id: 'm12_case_study', name: 'Case Study Matching', shortName: 'Cases', description: 'Relevant Algolia customer stories', icon: <IconFileText size={18} />, wave: 4 },
  { id: 'm13_icp_priority', name: 'ICP Priority Score', shortName: 'ICP', description: 'Ideal Customer Profile fit analysis', icon: <IconAward size={18} />, wave: 4 },
  { id: 'm14_signal_scoring', name: 'Signal Scoring', shortName: 'Signals', description: 'Buying intent signals aggregation', icon: <IconTrendingUp size={18} />, wave: 4 },
  { id: 'm15_strategic_brief', name: 'Strategic Brief', shortName: 'Brief', description: 'AI-generated account summary', icon: <IconFileText size={18} />, wave: 4 },
];

const WAVE_NAMES: Record<number, { name: string; color: string }> = {
  1: { name: 'Foundation', color: 'blue' },
  2: { name: 'Competitive', color: 'purple' },
  3: { name: 'Buying Signals', color: 'orange' },
  4: { name: 'Synthesis', color: 'green' },
};

export function IntelligencePanel({
  domain,
  enrichmentStatus,
  onRefreshModule,
  onRefreshWave,
  onRefreshAll,
  isLoading,
}: IntelligencePanelProps) {
  const [activeWave, setActiveWave] = useState<string>('all');
  const [expandedModules, setExpandedModules] = useState<Set<ModuleId>>(new Set());

  // Filter modules by wave
  const filteredModules = useMemo(() => {
    if (activeWave === 'all') return MODULE_CONFIGS;
    return MODULE_CONFIGS.filter((m) => m.wave === parseInt(activeWave));
  }, [activeWave]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (!enrichmentStatus?.modules) return 0;
    const completed = Object.values(enrichmentStatus.modules).filter(
      (m) => m.status === 'complete'
    ).length;
    return Math.round((completed / MODULE_CONFIGS.length) * 100);
  }, [enrichmentStatus]);

  // Get module status
  const getModuleStatus = (moduleId: ModuleId): ModuleStatus => {
    return enrichmentStatus?.modules[moduleId] || { status: 'pending' };
  };

  // Toggle module expansion
  const toggleModule = (moduleId: ModuleId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  // Get status badge
  const getStatusBadge = (status: ModuleStatus) => {
    const configs = {
      pending: { color: 'gray', icon: <IconClock size={12} />, label: 'Pending' },
      running: { color: 'blue', icon: <IconLoader2 size={12} className="animate-spin" />, label: 'Running' },
      complete: { color: 'green', icon: <IconCheck size={12} />, label: 'Complete' },
      error: { color: 'red', icon: <IconX size={12} />, label: 'Error' },
    };
    const config = configs[status.status];

    return (
      <Badge color={config.color} variant="light" size="sm" leftSection={config.icon}>
        {config.label}
      </Badge>
    );
  };

  // Get freshness badge
  const getFreshnessBadge = (freshness: FreshnessStatus | undefined) => {
    if (!freshness) return null;

    const configs = {
      fresh: { color: 'green', label: 'Fresh' },
      stale: { color: 'yellow', label: 'Stale' },
      expired: { color: 'red', label: 'Expired' },
    };
    const config = configs[freshness];

    return (
      <Badge color={config.color} variant="dot" size="xs">
        {config.label}
      </Badge>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <Paper
        p="md"
        radius="lg"
        className="backdrop-blur-xl bg-white/5 border border-white/10"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <Text size="lg" fw={600} c="white">
              Intelligence Modules
            </Text>
            <Text size="sm" c="dimmed">
              15 enrichment modules across 4 waves
            </Text>
          </div>

          <Group gap="sm">
            {/* Overall progress */}
            <div className="w-32">
              <Text size="xs" c="dimmed" mb={4}>
                Overall: {overallProgress}%
              </Text>
              <Progress
                value={overallProgress}
                size="sm"
                radius="xl"
                color={overallProgress === 100 ? 'green' : 'blue'}
                classNames={{ root: 'bg-white/10' }}
              />
            </div>

            {/* Refresh all button */}
            {onRefreshAll && (
              <Tooltip label="Refresh all modules">
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconRefresh size={16} />}
                  onClick={onRefreshAll}
                  loading={isLoading}
                >
                  Refresh All
                </Button>
              </Tooltip>
            )}
          </Group>
        </div>

        {/* Wave tabs */}
        <Tabs
          value={activeWave}
          onChange={(value) => setActiveWave(value || 'all')}
          mt="md"
          variant="pills"
          classNames={{
            root: 'border-t border-white/10 pt-3',
            tab: 'data-[active]:bg-white/10',
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="all">All Modules</Tabs.Tab>
            {Object.entries(WAVE_NAMES).map(([wave, config]) => (
              <Tabs.Tab key={wave} value={wave}>
                Wave {wave}: {config.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </Paper>

      {/* Modules list */}
      <ScrollArea h={600} type="auto">
        <div className="space-y-2">
          <AnimatePresence>
            {filteredModules.map((module, index) => {
              const status = getModuleStatus(module.id);
              const isExpanded = expandedModules.has(module.id);

              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Paper
                    p="md"
                    radius="md"
                    className={`
                      backdrop-blur-xl border transition-all duration-200 cursor-pointer
                      ${status.status === 'complete'
                        ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                        : status.status === 'error'
                        ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                        : status.status === 'running'
                        ? 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                      }
                    `}
                    onClick={() => toggleModule(module.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Expand/collapse icon */}
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <IconChevronRight size={16} className="text-white/40" />
                      </motion.div>

                      {/* Module icon */}
                      <div
                        className={`
                          p-2 rounded-lg
                          ${status.status === 'complete'
                            ? 'bg-green-500/20 text-green-400'
                            : status.status === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : status.status === 'running'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-white/10 text-white/60'
                          }
                        `}
                      >
                        {module.icon}
                      </div>

                      {/* Module info */}
                      <div className="flex-1 min-w-0">
                        <Group gap="xs" mb={2}>
                          <Text size="sm" fw={500} c="white">
                            {module.name}
                          </Text>
                          <Badge
                            size="xs"
                            variant="outline"
                            color={WAVE_NAMES[module.wave].color}
                          >
                            Wave {module.wave}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" truncate>
                          {module.description}
                        </Text>
                      </div>

                      {/* Status and freshness */}
                      <Group gap="xs">
                        {getFreshnessBadge(status.freshness)}
                        {getStatusBadge(status)}
                      </Group>

                      {/* Refresh button */}
                      {onRefreshModule && (
                        <Tooltip label="Refresh this module">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRefreshModule(module.id);
                            }}
                          >
                            <IconRefresh size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </div>

                    {/* Expanded content */}
                    <Collapse in={isExpanded}>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        {status.status === 'complete' ? (
                          <div className="space-y-2">
                            <Text size="xs" c="dimmed">
                              Last updated:{' '}
                              {status.last_updated
                                ? new Date(status.last_updated).toLocaleString()
                                : 'Unknown'}
                            </Text>
                            <Button
                              variant="light"
                              size="xs"
                              rightSection={<IconExternalLink size={14} />}
                            >
                              View Full Data
                            </Button>
                          </div>
                        ) : status.status === 'error' ? (
                          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <Text size="xs" c="red.4">
                              {status.error_message || 'An error occurred during enrichment'}
                            </Text>
                          </div>
                        ) : status.status === 'running' ? (
                          <div className="flex items-center gap-3">
                            <IconLoader2 size={16} className="animate-spin text-blue-400" />
                            <Text size="xs" c="dimmed">
                              Enrichment in progress...
                            </Text>
                          </div>
                        ) : (
                          <Text size="xs" c="dimmed">
                            Module has not been enriched yet. Click refresh to start.
                          </Text>
                        )}
                      </div>
                    </Collapse>
                  </Paper>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Wave-specific actions */}
      {activeWave !== 'all' && onRefreshWave && (
        <Paper
          p="md"
          radius="lg"
          className="backdrop-blur-xl bg-white/5 border border-white/10"
        >
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={500} c="white">
                Wave {activeWave}: {WAVE_NAMES[parseInt(activeWave)].name}
              </Text>
              <Text size="xs" c="dimmed">
                {filteredModules.length} modules in this wave
              </Text>
            </div>
            <Button
              variant="light"
              size="sm"
              color={WAVE_NAMES[parseInt(activeWave)].color}
              leftSection={<IconRefresh size={16} />}
              onClick={() => onRefreshWave(parseInt(activeWave) as 1 | 2 | 3 | 4)}
            >
              Refresh Wave {activeWave}
            </Button>
          </Group>
        </Paper>
      )}
    </motion.div>
  );
}
