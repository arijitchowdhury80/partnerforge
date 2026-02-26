/**
 * ListProgress - Enrichment Progress Tracker
 *
 * Real-time progress tracking for list enrichment jobs.
 * Shows wave-by-wave progress and individual company status.
 */

import { useState } from 'react';
import {
  Paper,
  Group,
  Stack,
  Text,
  Progress,
  Badge,
  RingProgress,
  Box,
  Timeline,
  Accordion,
  ThemeIcon,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import {
  IconCheck,
  IconLoader,
  IconAlertCircle,
  IconClock,
  IconBuilding,
  IconCode,
  IconChartBar,
  IconUsers,
  IconBrain,
} from '@tabler/icons-react';
import type { ModuleId } from '@/types';

interface WaveProgress {
  wave: number;
  name: string;
  icon: React.ElementType;
  status: 'pending' | 'running' | 'complete' | 'error';
  modules: {
    id: ModuleId;
    name: string;
    status: 'pending' | 'running' | 'complete' | 'error';
  }[];
  completedCompanies: number;
  totalCompanies: number;
}

interface ListProgressProps {
  listId: string;
  listName: string;
  totalCompanies: number;
  completedCompanies: number;
  failedCompanies: number;
  waves: WaveProgress[];
  estimatedTimeRemaining?: number;
  currentCompany?: string;
}

const waveIcons: Record<number, React.ElementType> = {
  1: IconBuilding,
  2: IconCode,
  3: IconChartBar,
  4: IconBrain,
};

const waveColors: Record<number, string> = {
  1: 'blue',
  2: 'violet',
  3: 'green',
  4: 'orange',
};

export function ListProgress({
  listName,
  totalCompanies,
  completedCompanies,
  failedCompanies,
  waves,
  estimatedTimeRemaining,
  currentCompany,
}: ListProgressProps) {
  const theme = useMantineTheme();
  const [expandedWave, setExpandedWave] = useState<string | null>('wave-1');

  const overallProgress = totalCompanies > 0 ? Math.round((completedCompanies / totalCompanies) * 100) : 0;
  const pendingCompanies = totalCompanies - completedCompanies - failedCompanies;

  const formatTime = (seconds?: number) => {
    if (!seconds) return 'Calculating...';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <Stack gap="lg">
      {/* Overall Progress Header */}
      <Paper
        p="lg"
        withBorder
        style={{
          background: 'linear-gradient(135deg, rgba(0, 61, 255, 0.05), rgba(84, 104, 255, 0.02))',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="lg" fw={600}>
              {listName}
            </Text>
            <Text size="sm" c="dimmed">
              Enrichment Progress
            </Text>
          </div>

          {/* Ring Progress */}
          <RingProgress
            size={100}
            thickness={10}
            roundCaps
            sections={[
              { value: overallProgress, color: 'blue' },
              { value: (failedCompanies / totalCompanies) * 100, color: 'red' },
            ]}
            label={
              <Text ta="center" fw={700} size="lg">
                {overallProgress}%
              </Text>
            }
          />
        </Group>

        {/* Stats Row */}
        <Group gap="xl" mt="md">
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase">
              Completed
            </Text>
            <Group gap="xs">
              <ThemeIcon size="sm" color="green" variant="light">
                <IconCheck size={12} />
              </ThemeIcon>
              <Text fw={600}>{completedCompanies.toLocaleString()}</Text>
            </Group>
          </Box>
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase">
              Failed
            </Text>
            <Group gap="xs">
              <ThemeIcon size="sm" color="red" variant="light">
                <IconAlertCircle size={12} />
              </ThemeIcon>
              <Text fw={600}>{failedCompanies.toLocaleString()}</Text>
            </Group>
          </Box>
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase">
              Pending
            </Text>
            <Group gap="xs">
              <ThemeIcon size="sm" color="gray" variant="light">
                <IconClock size={12} />
              </ThemeIcon>
              <Text fw={600}>{pendingCompanies.toLocaleString()}</Text>
            </Group>
          </Box>
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase">
              Est. Time
            </Text>
            <Group gap="xs">
              <ThemeIcon size="sm" color="blue" variant="light">
                <IconLoader size={12} />
              </ThemeIcon>
              <Text fw={600}>{formatTime(estimatedTimeRemaining)}</Text>
            </Group>
          </Box>
        </Group>

        {/* Overall Progress Bar */}
        <Progress.Root size="lg" mt="md">
          <Tooltip label={`${completedCompanies} completed`}>
            <Progress.Section value={overallProgress} color="blue">
              <Progress.Label>{overallProgress}%</Progress.Label>
            </Progress.Section>
          </Tooltip>
          {failedCompanies > 0 && (
            <Tooltip label={`${failedCompanies} failed`}>
              <Progress.Section
                value={(failedCompanies / totalCompanies) * 100}
                color="red"
              />
            </Tooltip>
          )}
        </Progress.Root>

        {/* Current Company */}
        {currentCompany && (
          <Group mt="md" gap="xs">
            <IconLoader
              size={14}
              style={{ animation: 'spin 1s linear infinite' }}
            />
            <Text size="sm" c="dimmed">
              Currently processing: <Text span fw={500}>{currentCompany}</Text>
            </Text>
          </Group>
        )}
      </Paper>

      {/* Wave-by-Wave Progress */}
      <Paper p="md" withBorder>
        <Text fw={600} mb="md">
          Wave Progress
        </Text>

        <Accordion
          value={expandedWave}
          onChange={setExpandedWave}
          variant="separated"
          styles={{
            item: {
              borderRadius: theme.radius.md,
              marginBottom: theme.spacing.sm,
              border: '1px solid var(--mantine-color-dark-4)',
            },
          }}
        >
          {waves.map((wave) => {
            const WaveIcon = waveIcons[wave.wave] || IconBuilding;
            const waveProgress = wave.totalCompanies > 0
              ? Math.round((wave.completedCompanies / wave.totalCompanies) * 100)
              : 0;
            const completedModules = wave.modules.filter((m) => m.status === 'complete').length;

            return (
              <Accordion.Item key={wave.wave} value={`wave-${wave.wave}`}>
                <Accordion.Control>
                  <Group justify="space-between" wrap="nowrap">
                    <Group>
                      <ThemeIcon
                        size="lg"
                        radius="md"
                        variant={wave.status === 'running' ? 'filled' : 'light'}
                        color={waveColors[wave.wave]}
                      >
                        <WaveIcon size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={500}>Wave {wave.wave}: {wave.name}</Text>
                        <Text size="xs" c="dimmed">
                          {completedModules} of {wave.modules.length} modules complete
                        </Text>
                      </div>
                    </Group>
                    <Group gap="md">
                      <Badge
                        variant={wave.status === 'running' ? 'filled' : 'light'}
                        color={
                          wave.status === 'complete'
                            ? 'green'
                            : wave.status === 'error'
                            ? 'red'
                            : wave.status === 'running'
                            ? 'blue'
                            : 'gray'
                        }
                      >
                        {wave.status}
                      </Badge>
                      <Text size="sm" fw={500} w={50}>
                        {waveProgress}%
                      </Text>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Timeline
                    active={wave.modules.findIndex((m) => m.status === 'running')}
                    bulletSize={24}
                    lineWidth={2}
                    mt="sm"
                  >
                    {wave.modules.map((module) => (
                      <Timeline.Item
                        key={module.id}
                        bullet={
                          module.status === 'complete' ? (
                            <IconCheck size={12} />
                          ) : module.status === 'running' ? (
                            <IconLoader
                              size={12}
                              style={{ animation: 'spin 1s linear infinite' }}
                            />
                          ) : module.status === 'error' ? (
                            <IconAlertCircle size={12} />
                          ) : (
                            <IconClock size={12} />
                          )
                        }
                        color={
                          module.status === 'complete'
                            ? 'green'
                            : module.status === 'error'
                            ? 'red'
                            : module.status === 'running'
                            ? 'blue'
                            : 'gray'
                        }
                        title={module.name}
                      >
                        <Text size="xs" c="dimmed">
                          {module.id}
                        </Text>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      </Paper>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Stack>
  );
}

// Sample data for demonstration
export const sampleWaveProgress: WaveProgress[] = [
  {
    wave: 1,
    name: 'Foundation',
    icon: IconBuilding,
    status: 'complete',
    modules: [
      { id: 'm01_company_context', name: 'Company Context', status: 'complete' },
      { id: 'm02_tech_stack', name: 'Tech Stack', status: 'complete' },
      { id: 'm03_traffic', name: 'Traffic Analysis', status: 'complete' },
      { id: 'm04_financials', name: 'Financials', status: 'complete' },
    ],
    completedCompanies: 100,
    totalCompanies: 100,
  },
  {
    wave: 2,
    name: 'Competitive',
    icon: IconCode,
    status: 'running',
    modules: [
      { id: 'm05_competitors', name: 'Competitors', status: 'complete' },
      { id: 'm06_hiring', name: 'Hiring Signals', status: 'running' },
    ],
    completedCompanies: 65,
    totalCompanies: 100,
  },
  {
    wave: 3,
    name: 'Buying Signals',
    icon: IconChartBar,
    status: 'pending',
    modules: [
      { id: 'm08_investor', name: 'Investor Intelligence', status: 'pending' },
      { id: 'm09_executive', name: 'Executive Quotes', status: 'pending' },
      { id: 'm10_buying_committee', name: 'Buying Committee', status: 'pending' },
    ],
    completedCompanies: 0,
    totalCompanies: 100,
  },
  {
    wave: 4,
    name: 'Synthesis',
    icon: IconBrain,
    status: 'pending',
    modules: [
      { id: 'm12_case_study', name: 'Case Study Match', status: 'pending' },
      { id: 'm13_icp_priority', name: 'ICP Scoring', status: 'pending' },
      { id: 'm14_signal_scoring', name: 'Signal Scoring', status: 'pending' },
      { id: 'm15_strategic_brief', name: 'Strategic Brief', status: 'pending' },
    ],
    completedCompanies: 0,
    totalCompanies: 100,
  },
];
