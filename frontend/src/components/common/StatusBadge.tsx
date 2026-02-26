/**
 * StatusBadge Component
 *
 * Premium gradient status pills for Hot/Warm/Cool/Cold indicators.
 * Features hover animations and consistent styling.
 */

import { motion } from 'framer-motion';
import { Tooltip } from '@mantine/core';

type StatusType = 'hot' | 'warm' | 'cool' | 'cold';

interface StatusBadgeProps {
  status: StatusType;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
}

const statusConfig: Record<StatusType, {
  gradient: string;
  shadow: string;
  label: string;
  icon: string;
  description: string;
}> = {
  hot: {
    gradient: 'from-red-500 to-red-600',
    shadow: 'shadow-red-500/30',
    label: 'HOT',
    icon: '\u{1F525}', // Fire emoji
    description: 'High priority - Score 80+',
  },
  warm: {
    gradient: 'from-orange-500 to-orange-600',
    shadow: 'shadow-orange-500/30',
    label: 'WARM',
    icon: '\u{2600}\u{FE0F}', // Sun emoji
    description: 'Medium priority - Score 60-79',
  },
  cool: {
    gradient: 'from-blue-500 to-blue-600',
    shadow: 'shadow-blue-500/30',
    label: 'COOL',
    icon: '\u{2744}\u{FE0F}', // Snowflake emoji
    description: 'Lower priority - Score 40-59',
  },
  cold: {
    gradient: 'from-gray-500 to-gray-600',
    shadow: 'shadow-gray-500/30',
    label: 'COLD',
    icon: '\u{1F319}', // Moon emoji
    description: 'Low priority - Score <40',
  },
};

const sizeConfig = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    iconSize: 'text-xs',
    gap: 'gap-1',
  },
  md: {
    padding: 'px-3 py-1',
    text: 'text-xs',
    iconSize: 'text-sm',
    gap: 'gap-1.5',
  },
  lg: {
    padding: 'px-4 py-1.5',
    text: 'text-sm',
    iconSize: 'text-base',
    gap: 'gap-2',
  },
};

export function StatusBadge({
  status,
  showIcon = true,
  size = 'md',
  tooltip,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];

  const badge = (
    <motion.span
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        inline-flex items-center ${sizeStyles.gap} ${sizeStyles.padding} rounded-full
        ${sizeStyles.text} font-semibold text-white
        bg-gradient-to-r ${config.gradient}
        shadow-lg ${config.shadow}
        tracking-wider cursor-default
        transition-all duration-200
      `}
    >
      {showIcon && <span className={sizeStyles.iconSize}>{config.icon}</span>}
      <span>{config.label}</span>
    </motion.span>
  );

  if (tooltip) {
    return (
      <Tooltip label={tooltip} withArrow>
        {badge}
      </Tooltip>
    );
  }

  return (
    <Tooltip label={config.description} withArrow>
      {badge}
    </Tooltip>
  );
}

// Utility function to determine status from score
export function getStatusFromScore(score: number): StatusType {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'cool';
  return 'cold';
}

// Alternative minimal variant without emojis
export function StatusDot({ status, size = 'md' }: { status: StatusType; size?: 'sm' | 'md' | 'lg' }) {
  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const colors: Record<StatusType, string> = {
    hot: 'bg-red-500',
    warm: 'bg-orange-500',
    cool: 'bg-blue-500',
    cold: 'bg-gray-500',
  };

  return (
    <Tooltip label={statusConfig[status].description} withArrow>
      <span className={`inline-block ${dotSizes[size]} ${colors[status]} rounded-full`} />
    </Tooltip>
  );
}
