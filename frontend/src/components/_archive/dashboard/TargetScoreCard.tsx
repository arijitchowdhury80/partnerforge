/**
 * TargetScoreCard Component
 *
 * ICP scoring visualization with animated circular progress,
 * score breakdown, and status indicators.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paper, Text, Group, Badge, Progress, Tooltip, ThemeIcon, Button } from '@mantine/core';
import {
  IconFlame,
  IconSun,
  IconSnowflake,
  IconMoon,
  IconTrendingUp,
  IconBuilding,
  IconChartLine,
  IconCurrencyDollar,
  IconCode,
  IconExternalLink,
  IconSparkles,
} from '@tabler/icons-react';
import type { Company, IcpPriorityData } from '@/types';

interface TargetScoreCardProps {
  company: Company;
  icpData?: IcpPriorityData;
  onViewDetails?: () => void;
  compact?: boolean;
}

export function TargetScoreCard({
  company,
  icpData,
  onViewDetails,
  compact = false,
}: TargetScoreCardProps) {
  // Calculate score breakdown from ICP data or estimate from company data
  const scoreBreakdown = useMemo(() => {
    if (icpData?.score_breakdown) {
      return icpData.score_breakdown;
    }

    // Estimate breakdown from company score
    const total = company.icp_score;
    return {
      vertical: Math.round(total * 0.4),
      traffic: Math.round(total * 0.3),
      tech_spend: Math.round(total * 0.2),
      partner_tech: Math.round(total * 0.1),
    };
  }, [company, icpData]);

  // Get status config
  const getStatusConfig = (status: string) => {
    const configs = {
      hot: {
        color: 'red',
        gradient: 'from-red-500 to-orange-500',
        icon: <IconFlame size={16} />,
        label: 'Hot Lead',
        glow: 'rgba(239, 68, 68, 0.3)',
      },
      warm: {
        color: 'orange',
        gradient: 'from-orange-500 to-yellow-500',
        icon: <IconSun size={16} />,
        label: 'Warm Lead',
        glow: 'rgba(249, 115, 22, 0.3)',
      },
      cold: {
        color: 'gray',
        gradient: 'from-gray-500 to-gray-600',
        icon: <IconSnowflake size={16} />,
        label: 'Cold Lead',
        glow: 'rgba(107, 114, 128, 0.3)',
      },
    };
    return configs[status as keyof typeof configs] || configs.cold;
  };

  const statusConfig = getStatusConfig(company.status);

  // Score breakdown items
  const breakdownItems = [
    {
      key: 'vertical',
      label: 'Vertical Fit',
      value: scoreBreakdown.vertical,
      max: 40,
      icon: <IconBuilding size={14} />,
      color: 'blue',
    },
    {
      key: 'traffic',
      label: 'Traffic Scale',
      value: scoreBreakdown.traffic,
      max: 30,
      icon: <IconChartLine size={14} />,
      color: 'green',
    },
    {
      key: 'tech_spend',
      label: 'Tech Spend',
      value: scoreBreakdown.tech_spend,
      max: 20,
      icon: <IconCurrencyDollar size={14} />,
      color: 'yellow',
    },
    {
      key: 'partner_tech',
      label: 'Partner Tech',
      value: scoreBreakdown.partner_tech,
      max: 10,
      icon: <IconCode size={14} />,
      color: 'purple',
    },
  ];

  if (compact) {
    return <CompactScoreCard company={company} statusConfig={statusConfig} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Paper
        p="lg"
        radius="lg"
        className={`
          relative overflow-hidden backdrop-blur-xl
          bg-gradient-to-br from-white/5 to-white/[0.02]
          border border-white/10
          transition-all duration-300
          hover:border-white/20
        `}
      >
        {/* Animated glow */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${statusConfig.glow}, transparent 70%)`,
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1 min-w-0">
              <Group gap="xs" mb="xs">
                <Text size="lg" fw={600} c="white" truncate>
                  {company.company_name}
                </Text>
                {company.ticker && (
                  <Badge variant="outline" color="gray" size="xs">
                    {company.exchange}:{company.ticker}
                  </Badge>
                )}
              </Group>
              <Text size="sm" c="dimmed" truncate>
                {company.domain}
              </Text>
            </div>

            {/* Status badge */}
            <Badge
              size="lg"
              variant="filled"
              className={`bg-gradient-to-r ${statusConfig.gradient} border-0`}
              leftSection={statusConfig.icon}
            >
              {statusConfig.label}
            </Badge>
          </div>

          {/* Score ring and breakdown */}
          <div className="flex items-center gap-8">
            {/* Score ring */}
            <ScoreRing value={company.icp_score} color={statusConfig.color} />

            {/* Breakdown */}
            <div className="flex-1 space-y-3">
              {breakdownItems.map((item) => (
                <div key={item.key}>
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <ThemeIcon size="xs" variant="light" color={item.color} radius="xl">
                        {item.icon}
                      </ThemeIcon>
                      <Text size="xs" c="dimmed">
                        {item.label}
                      </Text>
                    </Group>
                    <Text size="xs" fw={500} c="white">
                      {item.value}/{item.max}
                    </Text>
                  </Group>
                  <Progress
                    value={(item.value / item.max) * 100}
                    size="sm"
                    radius="xl"
                    color={item.color}
                    classNames={{ root: 'bg-white/10' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Additional info */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <Group justify="space-between">
              <div className="flex gap-4">
                <Tooltip label="Industry Vertical">
                  <Badge variant="light" color="blue" size="sm">
                    {company.vertical}
                  </Badge>
                </Tooltip>
                {company.partner_tech?.map((tech) => (
                  <Tooltip key={tech} label="Partner Technology">
                    <Badge variant="outline" color="purple" size="sm">
                      {tech}
                    </Badge>
                  </Tooltip>
                ))}
              </div>

              {onViewDetails && (
                <Button
                  variant="subtle"
                  size="xs"
                  rightSection={<IconExternalLink size={14} />}
                  onClick={onViewDetails}
                >
                  View Details
                </Button>
              )}
            </Group>
          </div>

          {/* ICP tier indicator */}
          {icpData?.tier && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-4 right-4"
            >
              <Tooltip label={`ICP Tier: ${icpData.tier}`}>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10">
                  <IconSparkles size={12} className="text-yellow-400" />
                  <Text size="xs" fw={500} c="white">
                    {icpData.tier}
                  </Text>
                </div>
              </Tooltip>
            </motion.div>
          )}
        </div>
      </Paper>
    </motion.div>
  );
}

// Score ring component
interface ScoreRingProps {
  value: number;
  max?: number;
  color: string;
  size?: number;
}

function ScoreRing({ value, max = 100, color, size = 100 }: ScoreRingProps) {
  const percentage = (value / max) * 100;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Get color value
  const getColorValue = (colorName: string): string => {
    const colors: Record<string, string> = {
      red: '#ef4444',
      orange: '#f97316',
      blue: '#3b82f6',
      gray: '#6b7280',
      green: '#22c55e',
    };
    return colors[colorName] || colors.gray;
  };

  const colorValue = getColorValue(color);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" style={{ width: size, height: size }}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
          fill="none"
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorValue}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
            filter: `drop-shadow(0 0 8px ${colorValue})`,
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-bold text-white"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {value}
        </motion.span>
        <span className="text-xs text-white/60">ICP Score</span>
      </div>
    </div>
  );
}

// Compact variant for table cells
interface CompactScoreCardProps {
  company: Company;
  statusConfig: ReturnType<typeof getStatusConfig>;
}

function getStatusConfig(status: string) {
  const configs = {
    hot: { color: 'red', gradient: 'from-red-500 to-orange-500', icon: <IconFlame size={14} />, glow: 'rgba(239, 68, 68, 0.3)' },
    warm: { color: 'orange', gradient: 'from-orange-500 to-yellow-500', icon: <IconSun size={14} />, glow: 'rgba(249, 115, 22, 0.3)' },
    cold: { color: 'gray', gradient: 'from-gray-500 to-gray-600', icon: <IconSnowflake size={14} />, glow: 'rgba(107, 114, 128, 0.3)' },
  };
  return configs[status as keyof typeof configs] || configs.cold;
}

function CompactScoreCard({ company, statusConfig }: CompactScoreCardProps) {
  const percentage = company.icp_score;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const getColorValue = (colorName: string): string => {
    const colors: Record<string, string> = {
      red: '#ef4444',
      orange: '#f97316',
      blue: '#3b82f6',
      gray: '#6b7280',
    };
    return colors[colorName] || colors.gray;
  };

  const colorValue = getColorValue(statusConfig.color);

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: 40, height: 40 }}>
        <svg className="transform -rotate-90" style={{ width: 40, height: 40 }}>
          <circle
            cx={20}
            cy={20}
            r={radius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="3"
            fill="none"
          />
          <motion.circle
            cx={20}
            cy={20}
            r={radius}
            stroke={colorValue}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              strokeDasharray: circumference,
              filter: `drop-shadow(0 0 4px ${colorValue})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-white">{company.icp_score}</span>
        </div>
      </div>
    </div>
  );
}

// Export score ring for standalone use
export { ScoreRing };
