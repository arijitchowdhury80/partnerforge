/**
 * ExecutiveCard Component
 *
 * Displays executive intelligence from M09 module including key people,
 * quotes ("In Their Own Words"), and LinkedIn presence.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  SegmentedControl,
  Blockquote,
  Avatar,
  Anchor,
  Tooltip,
} from '@mantine/core';
import {
  IconUser,
  IconQuote,
  IconBrandLinkedin,
  IconCrown,
  IconExternalLink,
  IconBriefcase,
  IconTargetArrow,
  IconUsers,
  IconMessageCircle,
  IconCalendar,
} from '@tabler/icons-react';
import type { SourceCitation } from '@/types';
import { SourceBadge, calculateFreshness } from '@/components/common/SourceBadge';
import { Skeleton } from '@/components/common/LoadingSpinner';

// =============================================================================
// Types
// =============================================================================

export interface ExecutiveCardProps {
  data?: ExecutiveData;
  source?: SourceCitation;
  isLoading?: boolean;
}

export interface ExecutiveData {
  executives: Array<{
    name: string;
    title: string;
    linkedin_url?: string;
    tenure_years?: number;
    relevance: 'decision_maker' | 'influencer' | 'technical';
    focus_areas?: string[];
  }>;
  quotes: Array<{
    text: string;
    speaker: string;
    title: string;
    source: string;
    source_date: string;
    algolia_relevance?: string;
  }>;
  linkedin_summary?: {
    followers: number;
    connections: number;
    recent_posts: number;
  };
}

// =============================================================================
// Config
// =============================================================================

const relevanceConfig: Record<string, {
  label: string;
  color: string;
  icon: React.ElementType;
}> = {
  decision_maker: {
    label: 'Decision Maker',
    color: 'green',
    icon: IconCrown,
  },
  influencer: {
    label: 'Influencer',
    color: 'blue',
    icon: IconUsers,
  },
  technical: {
    label: 'Technical',
    color: 'violet',
    icon: IconBriefcase,
  },
};

// =============================================================================
// Component
// =============================================================================

export function ExecutiveCard({
  data,
  source,
  isLoading = false,
}: ExecutiveCardProps) {
  const [view, setView] = useState<string>('people');

  if (isLoading) {
    return <ExecutiveSkeleton />;
  }

  if (!data) {
    return (
      <Paper
        p="lg"
        radius="lg"
        className="bg-white/5 border border-white/10"
      >
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <IconUser size={20} className="text-purple-400" />
            <Text fw={600} c="white">Executive Intelligence</Text>
          </Group>
        </Group>
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No executive data available. Trigger enrichment to collect.
        </Text>
      </Paper>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Paper
        p="lg"
        radius="lg"
        className="bg-white/5 border border-white/10 hover:border-white/20 transition-all"
      >
        {/* Header */}
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <IconUser size={20} className="text-purple-400" />
            </div>
            <div>
              <Text fw={600} c="white">Executive Intelligence</Text>
              <Text size="xs" c="dimmed">M09 Module</Text>
            </div>
          </Group>
          <Group gap="sm">
            {source && (
              <SourceBadge
                source={source}
                freshness={calculateFreshness(source.date)}
                compact
              />
            )}
          </Group>
        </Group>

        {/* View selector */}
        <SegmentedControl
          value={view}
          onChange={setView}
          size="xs"
          mb="md"
          data={[
            { label: 'Key People', value: 'people' },
            { label: 'Quotes', value: 'quotes' },
            { label: 'LinkedIn', value: 'linkedin' },
          ]}
          classNames={{
            root: 'bg-white/5',
          }}
        />

        {/* Key People View */}
        {view === 'people' && (
          <Stack gap="sm">
            {data.executives.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="md">
                No executives identified yet.
              </Text>
            ) : (
              data.executives.map((exec, index) => {
                const relevance = relevanceConfig[exec.relevance] || relevanceConfig.influencer;
                const RelevanceIcon = relevance.icon;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <Avatar
                          size="md"
                          radius="xl"
                          color={relevance.color}
                          className="border border-white/10"
                        >
                          {getInitials(exec.name)}
                        </Avatar>
                        <div className="min-w-0">
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm" fw={600} c="white" truncate>
                              {exec.name}
                            </Text>
                            {exec.linkedin_url && (
                              <Anchor
                                href={exec.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0"
                              >
                                <IconBrandLinkedin size={14} className="text-blue-400 hover:text-blue-300" />
                              </Anchor>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed" truncate>
                            {exec.title}
                          </Text>
                        </div>
                      </Group>

                      <Group gap="xs" wrap="nowrap" className="flex-shrink-0">
                        {exec.tenure_years !== undefined && (
                          <Tooltip label={`${exec.tenure_years} years at company`}>
                            <Badge
                              size="sm"
                              variant="light"
                              color="gray"
                              leftSection={<IconCalendar size={10} />}
                            >
                              {exec.tenure_years}y
                            </Badge>
                          </Tooltip>
                        )}
                        <Tooltip label={relevance.label}>
                          <Badge
                            size="sm"
                            variant="light"
                            color={relevance.color}
                            leftSection={<RelevanceIcon size={10} />}
                          >
                            {relevance.label}
                          </Badge>
                        </Tooltip>
                      </Group>
                    </Group>

                    {exec.focus_areas && exec.focus_areas.length > 0 && (
                      <Group gap="xs" mt="sm">
                        {exec.focus_areas.map((area, idx) => (
                          <Badge
                            key={idx}
                            size="xs"
                            variant="outline"
                            color="gray"
                          >
                            {area}
                          </Badge>
                        ))}
                      </Group>
                    )}
                  </motion.div>
                );
              })
            )}
          </Stack>
        )}

        {/* Quotes View - "In Their Own Words" */}
        {view === 'quotes' && (
          <Stack gap="md">
            <div className="flex items-center gap-2 mb-2">
              <IconQuote size={16} className="text-amber-400" />
              <Text size="sm" fw={600} c="white">In Their Own Words</Text>
            </div>

            {data.quotes.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="md">
                No executive quotes available.
              </Text>
            ) : (
              data.quotes.map((quote, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
                >
                  <Blockquote
                    color="yellow"
                    icon={<IconQuote size={18} className="text-amber-400" />}
                    cite={null}
                    classNames={{
                      root: 'bg-transparent border-none p-0',
                    }}
                  >
                    <Text size="sm" c="white" className="italic leading-relaxed">
                      "{quote.text}"
                    </Text>
                  </Blockquote>

                  <div className="mt-3 pt-3 border-t border-white/10">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text size="sm" fw={600} c="white">
                          {quote.speaker}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {quote.title}
                        </Text>
                      </div>
                      <div className="text-right">
                        <Text size="xs" c="dimmed">
                          {quote.source}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {quote.source_date}
                        </Text>
                      </div>
                    </Group>

                    {quote.algolia_relevance && (
                      <Group gap="xs" mt="sm">
                        <IconTargetArrow size={12} className="text-purple-400" />
                        <Text size="xs" c="purple.4">
                          Algolia relevance: {quote.algolia_relevance}
                        </Text>
                      </Group>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </Stack>
        )}

        {/* LinkedIn View */}
        {view === 'linkedin' && (
          <Stack gap="md">
            {data.linkedin_summary ? (
              <>
                {/* LinkedIn Summary Stats */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                  <Group gap="xs" mb="md">
                    <IconBrandLinkedin size={20} className="text-blue-400" />
                    <Text size="sm" fw={600} c="white">LinkedIn Presence</Text>
                  </Group>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <Text size="lg" fw={700} c="white">
                        {formatNumber(data.linkedin_summary.followers)}
                      </Text>
                      <Text size="xs" c="dimmed">Followers</Text>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <Text size="lg" fw={700} c="white">
                        {formatNumber(data.linkedin_summary.connections)}
                      </Text>
                      <Text size="xs" c="dimmed">Connections</Text>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <Text size="lg" fw={700} c="white">
                        {data.linkedin_summary.recent_posts}
                      </Text>
                      <Text size="xs" c="dimmed">Recent Posts</Text>
                    </div>
                  </div>
                </div>

                {/* Executive LinkedIn Links */}
                <div className="space-y-2">
                  <Text size="sm" c="dimmed" mb="sm">Executive Profiles</Text>
                  {data.executives
                    .filter(exec => exec.linkedin_url)
                    .map((exec, index) => (
                      <Anchor
                        key={index}
                        href={exec.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white no-underline"
                      >
                        <Avatar size="sm" color="blue" radius="xl">
                          {getInitials(exec.name)}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Text size="sm" c="white" truncate>{exec.name}</Text>
                          <Text size="xs" c="dimmed" truncate>{exec.title}</Text>
                        </div>
                        <IconExternalLink size={14} className="text-blue-400 flex-shrink-0" />
                      </Anchor>
                    ))}

                  {data.executives.filter(exec => exec.linkedin_url).length === 0 && (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No LinkedIn profiles linked.
                    </Text>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <IconBrandLinkedin size={48} className="text-white/20 mx-auto mb-4" />
                <Text c="dimmed" size="sm">
                  LinkedIn summary not available.
                </Text>
                <Text c="dimmed" size="xs" mt="xs">
                  Trigger enrichment to collect LinkedIn data.
                </Text>
              </div>
            )}
          </Stack>
        )}
      </Paper>
    </motion.div>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

function ExecutiveSkeleton() {
  return (
    <Paper
      p="lg"
      radius="lg"
      className="bg-white/5 border border-white/10"
    >
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Skeleton width={36} height={36} />
          <div>
            <Skeleton width={140} height={16} />
            <Skeleton width={80} height={12} className="mt-1" />
          </div>
        </Group>
        <Skeleton width={60} height={20} />
      </Group>
      <Skeleton width="100%" height={32} className="mb-4" />
      <Stack gap="sm">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-3 rounded-lg bg-white/5 border border-white/10"
          >
            <Group justify="space-between">
              <Group gap="sm">
                <Skeleton width={40} height={40} circle />
                <div>
                  <Skeleton width={120} height={14} />
                  <Skeleton width={100} height={10} className="mt-1" />
                </div>
              </Group>
              <Group gap="xs">
                <Skeleton width={40} height={20} />
                <Skeleton width={80} height={20} />
              </Group>
            </Group>
          </div>
        ))}
      </Stack>
    </Paper>
  );
}
