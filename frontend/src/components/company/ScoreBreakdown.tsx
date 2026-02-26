/**
 * ScoreBreakdown - Multi-Factor Composite Score Display
 *
 * Shows the breakdown of Fit/Intent/Value/Displacement scores
 * with visual progress bars and signal tooltips.
 *
 * Two variants:
 * - compact: For QuickLookCard (horizontal, minimal)
 * - detailed: For CompanyDrawer (vertical, full signals)
 */

import { Group, Stack, Text, Progress, Tooltip, Badge, Paper, RingProgress, ThemeIcon } from '@mantine/core';
import {
  IconTarget,
  IconBolt,
  IconCurrencyDollar,
  IconReplace,
  IconAlertCircle,
  IconCheck,
  IconMinus,
} from '@tabler/icons-react';
import type { Company, CompositeScore, DetailedScoreBreakdown } from '@/types';
import { calculateCompositeScore, getDetailedBreakdown, getStatusFromCompositeScore } from '@/services/scoring';
import { COLORS } from '@/lib/constants';

interface ScoreBreakdownProps {
  company: Company;
  variant?: 'compact' | 'detailed';
}

// Factor configuration
const FACTOR_CONFIG = {
  fit: {
    label: 'Fit',
    icon: IconTarget,
    color: '#8b5cf6',  // Purple
    description: 'How well they match ICP criteria',
  },
  intent: {
    label: 'Intent',
    icon: IconBolt,
    color: '#f59e0b',  // Amber
    description: 'Buying signals and readiness',
  },
  value: {
    label: 'Value',
    icon: IconCurrencyDollar,
    color: '#10b981',  // Emerald
    description: 'Deal size potential',
  },
  displacement: {
    label: 'Displace',
    icon: IconReplace,
    color: '#3b82f6',  // Blue
    description: 'Ease of switching from current provider',
  },
};

// Confidence badge config with detailed explanations
const CONFIDENCE_CONFIG = {
  high: {
    color: 'green',
    icon: IconCheck,
    label: 'High Confidence',
    tooltip: 'Score calculated from fully enriched data including traffic, financials, tech stack, and competitor analysis.',
  },
  medium: {
    color: 'yellow',
    icon: IconMinus,
    label: 'Medium Confidence',
    tooltip: 'Some data is missing. Score is partially estimated. Enrich to improve accuracy.',
  },
  low: {
    color: 'red',
    icon: IconAlertCircle,
    label: 'Low Confidence',
    tooltip: 'Limited data available. Score is mostly estimated from basic company info. Enrich for accurate scoring.',
  },
};

export function ScoreBreakdown({ company, variant = 'compact' }: ScoreBreakdownProps) {
  const score = calculateCompositeScore(company);
  const status = getStatusFromCompositeScore(score.total);
  const statusColor = status === 'hot' ? '#dc2626' : status === 'warm' ? '#ea580c' : '#64748b';

  if (variant === 'compact') {
    return <CompactScore score={score} statusColor={statusColor} />;
  }

  return <DetailedScore company={company} score={score} statusColor={statusColor} />;
}

// =============================================================================
// Compact Variant (for QuickLookCard)
// =============================================================================

function CompactScore({ score, statusColor }: { score: CompositeScore; statusColor: string }) {
  const confidence = CONFIDENCE_CONFIG[score.confidence];

  return (
    <Paper p="sm" withBorder style={{ borderColor: COLORS.GRAY_200 }}>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Text size="xs" c={COLORS.GRAY_500} fw={600} tt="uppercase">Composite Score</Text>
          <Tooltip
            label={confidence.tooltip}
            multiline
            w={220}
            withArrow
          >
            <Badge size="xs" color={confidence.color} variant="light" style={{ cursor: 'help' }}>
              {score.dataCompleteness}% data
            </Badge>
          </Tooltip>
        </Group>
        <Text size="xl" fw={800} style={{ color: statusColor }}>{score.total}</Text>
      </Group>

      {/* Mini factor bars */}
      <Group gap="xs" wrap="nowrap">
        {(Object.keys(FACTOR_CONFIG) as Array<keyof typeof FACTOR_CONFIG>).map((key) => {
          const config = FACTOR_CONFIG[key];
          const value = score.factors[key];
          return (
            <Tooltip key={key} label={`${config.label}: ${value}/100`} withArrow>
              <div style={{ flex: 1 }}>
                <Text size="xs" c={COLORS.GRAY_400} ta="center" mb={2}>{config.label[0]}</Text>
                <Progress
                  value={value}
                  size="sm"
                  color={config.color}
                  radius="xl"
                />
              </div>
            </Tooltip>
          );
        })}
      </Group>
    </Paper>
  );
}

// =============================================================================
// Detailed Variant (for CompanyDrawer)
// =============================================================================

function DetailedScore({
  company,
  score,
  statusColor,
}: {
  company: Company;
  score: CompositeScore;
  statusColor: string;
}) {
  const breakdown = getDetailedBreakdown(company);
  const confidence = CONFIDENCE_CONFIG[score.confidence];

  return (
    <Paper p="md" radius="md" style={{ background: COLORS.GRAY_50 }}>
      {/* Header with total score */}
      <Group justify="space-between" mb="md">
        <div>
          <Text size="sm" fw={600} c={COLORS.GRAY_900}>Composite Score</Text>
          <Group gap="xs">
            <Text size="xs" c={COLORS.GRAY_500}>Multi-factor prioritization</Text>
            <Tooltip
              label={confidence.tooltip}
              multiline
              w={250}
              withArrow
            >
              <Badge
                size="xs"
                color={confidence.color}
                variant="light"
                leftSection={<confidence.icon size={10} />}
                style={{ cursor: 'help' }}
              >
                {confidence.label} ({score.dataCompleteness}%)
              </Badge>
            </Tooltip>
          </Group>
        </div>

        <RingProgress
          size={80}
          thickness={8}
          roundCaps
          sections={[{ value: score.total, color: statusColor }]}
          label={
            <Text ta="center" fw={700} size="lg" style={{ color: statusColor }}>
              {score.total}
            </Text>
          }
        />
      </Group>

      {/* Factor breakdown */}
      <Stack gap="sm">
        {(Object.keys(FACTOR_CONFIG) as Array<keyof typeof FACTOR_CONFIG>).map((key) => {
          const config = FACTOR_CONFIG[key];
          const detail = breakdown[key];
          const Icon = config.icon;

          return (
            <div key={key}>
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="light" color={config.color} radius="xl">
                    <Icon size={12} />
                  </ThemeIcon>
                  <Text size="sm" fw={500} c={COLORS.GRAY_700}>{detail.name}</Text>
                  <Text size="xs" c={COLORS.GRAY_400}>({detail.weight}%)</Text>
                </Group>
                <Text size="sm" fw={600} style={{ color: config.color }}>{detail.score}</Text>
              </Group>

              <Progress
                value={detail.score}
                size="md"
                color={config.color}
                radius="xl"
                mb={4}
              />

              {/* Signal pills */}
              {detail.signals.length > 0 && (
                <Group gap={4} wrap="wrap">
                  {detail.signals.slice(0, 3).map((signal, idx) => (
                    <Badge
                      key={idx}
                      size="xs"
                      variant="outline"
                      color="gray"
                      styles={{ root: { fontWeight: 400, textTransform: 'none' } }}
                    >
                      {signal}
                    </Badge>
                  ))}
                  {detail.signals.length > 3 && (
                    <Tooltip label={detail.signals.slice(3).join(', ')}>
                      <Badge size="xs" variant="light" color="gray">
                        +{detail.signals.length - 3} more
                      </Badge>
                    </Tooltip>
                  )}
                </Group>
              )}
            </div>
          );
        })}
      </Stack>

      {/* Legend */}
      <Group justify="center" mt="md" gap="lg">
        {(Object.keys(FACTOR_CONFIG) as Array<keyof typeof FACTOR_CONFIG>).map((key) => {
          const config = FACTOR_CONFIG[key];
          return (
            <Tooltip key={key} label={config.description}>
              <Group gap={4}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: config.color }} />
                <Text size="xs" c={COLORS.GRAY_500}>{config.label}</Text>
              </Group>
            </Tooltip>
          );
        })}
      </Group>
    </Paper>
  );
}

export default ScoreBreakdown;
