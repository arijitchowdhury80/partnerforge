/**
 * SourceBadge Component
 *
 * Premium source citation display with hover effects and freshness indicators.
 * P0 requirement: All data points must have visible source citations.
 */

import { Badge, Tooltip, Anchor, Group, Text, HoverCard, Stack, ThemeIcon } from '@mantine/core';
import { motion } from 'framer-motion';
import {
  IconExternalLink,
  IconClock,
  IconApi,
  IconWorld,
  IconFile,
  IconMicrophone,
  IconCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconDatabase,
  IconBrandYahoo,
  IconBrandChrome,
  IconChartBar,
} from '@tabler/icons-react';
import type { SourceCitation, FreshnessStatus } from '@/types';

interface SourceBadgeProps {
  source: SourceCitation;
  freshness?: FreshnessStatus;
  showDate?: boolean;
  compact?: boolean;
  variant?: 'default' | 'inline' | 'card' | 'minimal';
}

const freshnessConfig: Record<FreshnessStatus, {
  color: string;
  label: string;
  icon: React.ElementType;
  description: string;
}> = {
  fresh: {
    color: 'green',
    label: 'Fresh',
    icon: IconCheck,
    description: 'Data is current (within 7 days)',
  },
  stale: {
    color: 'yellow',
    label: 'Stale',
    icon: IconAlertTriangle,
    description: 'Data may be outdated (7-30 days old)',
  },
  expired: {
    color: 'red',
    label: 'Expired',
    icon: IconAlertCircle,
    description: 'Data is outdated (>30 days old)',
  },
};

const sourceTypeConfig: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
}> = {
  api: { label: 'API', icon: IconApi, color: 'blue' },
  builtwith: { label: 'BuiltWith', icon: IconDatabase, color: 'violet' },
  similarweb: { label: 'SimilarWeb', icon: IconChartBar, color: 'cyan' },
  yahoo_finance: { label: 'Yahoo Finance', icon: IconBrandYahoo, color: 'purple' },
  webpage: { label: 'Web', icon: IconWorld, color: 'teal' },
  document: { label: 'Doc', icon: IconFile, color: 'orange' },
  transcript: { label: 'Transcript', icon: IconMicrophone, color: 'pink' },
  sec_filing: { label: 'SEC', icon: IconFile, color: 'indigo' },
  chrome: { label: 'Browser', icon: IconBrandChrome, color: 'yellow' },
};

export function SourceBadge({
  source,
  freshness = 'fresh',
  showDate = true,
  compact = false,
  variant = 'default',
}: SourceBadgeProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  const freshnessData = freshnessConfig[freshness];
  const sourceData = sourceTypeConfig[source.type] || sourceTypeConfig.api;
  const SourceIcon = sourceData.icon;
  const FreshnessIcon = freshnessData.icon;

  // Minimal variant - just a dot indicator
  if (variant === 'minimal') {
    return (
      <Tooltip label={`Source: ${sourceData.label} | ${formatDate(source.date)}`} withArrow>
        <motion.span
          whileHover={{ scale: 1.2 }}
          className={`inline-block w-2 h-2 rounded-full bg-${freshnessData.color}-500`}
          style={{ cursor: 'pointer' }}
        />
      </Tooltip>
    );
  }

  // Compact variant - small badge with tooltip
  if (compact || variant === 'inline') {
    return (
      <HoverCard width={280} shadow="lg" withArrow openDelay={200}>
        <HoverCard.Target>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Badge
              size="xs"
              variant="dot"
              color={freshnessData.color}
              style={{ cursor: 'pointer' }}
              component="a"
              href={source.url}
              target="_blank"
              leftSection={<SourceIcon size={10} />}
              classNames={{
                root: 'bg-white/5 border border-white/10 hover:bg-white/10 transition-colors',
              }}
            >
              {sourceData.label}
            </Badge>
          </motion.div>
        </HoverCard.Target>
        <HoverCard.Dropdown
          className="bg-gray-900/95 border border-white/10 backdrop-blur-xl"
        >
          <SourceDetailCard source={source} freshness={freshness} />
        </HoverCard.Dropdown>
      </HoverCard>
    );
  }

  // Card variant - full source card
  if (variant === 'card') {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
      >
        <SourceDetailCard source={source} freshness={freshness} showLink />
      </motion.div>
    );
  }

  // Default variant - inline badges with date
  return (
    <Group gap="xs" wrap="nowrap">
      <HoverCard width={280} shadow="lg" withArrow openDelay={200}>
        <HoverCard.Target>
          <Badge
            size="sm"
            variant="light"
            color={freshnessData.color}
            leftSection={<FreshnessIcon size={12} />}
            style={{ cursor: 'pointer' }}
            classNames={{
              root: 'hover:brightness-110 transition-all',
            }}
          >
            {showDate ? formatRelativeDate(source.date) : freshnessData.label}
          </Badge>
        </HoverCard.Target>
        <HoverCard.Dropdown
          className="bg-gray-900/95 border border-white/10 backdrop-blur-xl"
        >
          <SourceDetailCard source={source} freshness={freshness} />
        </HoverCard.Dropdown>
      </HoverCard>

      <Anchor
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        size="xs"
        c="dimmed"
        className="hover:text-blue-400 transition-colors"
      >
        <Group gap={4} wrap="nowrap">
          <SourceIcon size={12} />
          <span>{sourceData.label}</span>
          <IconExternalLink size={10} />
        </Group>
      </Anchor>
    </Group>
  );
}

// Detailed source card for hover/expanded view
interface SourceDetailCardProps {
  source: SourceCitation;
  freshness: FreshnessStatus;
  showLink?: boolean;
}

function SourceDetailCard({ source, freshness, showLink = false }: SourceDetailCardProps) {
  const freshnessData = freshnessConfig[freshness];
  const sourceData = sourceTypeConfig[source.type] || sourceTypeConfig.api;
  const SourceIcon = sourceData.icon;
  const FreshnessIcon = freshnessData.icon;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Stack gap="sm">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color={sourceData.color}>
            <SourceIcon size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600} c="white">
            {sourceData.label}
          </Text>
        </Group>
        <Badge
          size="xs"
          variant="light"
          color={freshnessData.color}
          leftSection={<FreshnessIcon size={10} />}
        >
          {freshnessData.label}
        </Badge>
      </Group>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <IconClock size={12} className="text-white/40" />
          <Text size="xs" c="dimmed">
            Collected: {formatDate(source.date)}
          </Text>
        </div>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {source.url}
        </Text>
      </div>

      {/* Freshness description */}
      <Text size="xs" c={freshnessData.color + '.4'} className="italic">
        {freshnessData.description}
      </Text>

      {/* Link */}
      {showLink && (
        <Anchor
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          size="xs"
          className="flex items-center gap-1 hover:text-blue-400"
        >
          View source <IconExternalLink size={12} />
        </Anchor>
      )}
    </Stack>
  );
}

// Multiple sources display component
interface MultipleSourcesProps {
  sources: Array<{
    source: SourceCitation;
    freshness?: FreshnessStatus;
  }>;
  maxVisible?: number;
}

export function MultipleSources({ sources, maxVisible = 3 }: MultipleSourcesProps) {
  const visible = sources.slice(0, maxVisible);
  const remaining = sources.length - maxVisible;

  return (
    <Group gap="xs">
      {visible.map((item, index) => (
        <SourceBadge
          key={index}
          source={item.source}
          freshness={item.freshness}
          compact
        />
      ))}
      {remaining > 0 && (
        <Tooltip label={`${remaining} more sources`}>
          <Badge size="xs" variant="light" color="gray">
            +{remaining}
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
}

// Calculate freshness from date
export function calculateFreshness(dateStr: string): FreshnessStatus {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) return 'fresh';
  if (diffDays <= 30) return 'stale';
  return 'expired';
}
