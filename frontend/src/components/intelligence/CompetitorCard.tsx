/**
 * CompetitorCard Component
 *
 * Displays competitive intelligence including similar companies and their search providers.
 */

import { motion } from 'framer-motion';
import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  Progress,
  Tooltip,
  Avatar,
  Anchor,
} from '@mantine/core';
import {
  IconUsers,
  IconCheck,
  IconX,
  IconExternalLink,
  IconSearch,
  IconTrophy,
} from '@tabler/icons-react';
import type { CompetitorData, Competitor, SourceCitation } from '@/types';
import { SourceBadge, calculateFreshness } from '@/components/common/SourceBadge';
import { Skeleton } from '@/components/common/LoadingSpinner';

interface CompetitorCardProps {
  data?: CompetitorData;
  source?: SourceCitation;
  isLoading?: boolean;
}

const searchProviderConfig: Record<string, { color: string; isAlgolia: boolean }> = {
  algolia: { color: 'green', isAlgolia: true },
  elasticsearch: { color: 'red', isAlgolia: false },
  solr: { color: 'orange', isAlgolia: false },
  coveo: { color: 'red', isAlgolia: false },
  bloomreach: { color: 'red', isAlgolia: false },
  lucidworks: { color: 'red', isAlgolia: false },
  searchspring: { color: 'red', isAlgolia: false },
  klevu: { color: 'red', isAlgolia: false },
  'constructor.io': { color: 'red', isAlgolia: false },
};

function getSearchProviderColor(provider?: string): string {
  if (!provider) return 'gray';
  const key = provider.toLowerCase();
  return searchProviderConfig[key]?.color || 'gray';
}

function isAlgoliaCustomer(provider?: string): boolean {
  if (!provider) return false;
  return provider.toLowerCase().includes('algolia');
}

export function CompetitorCard({
  data,
  source,
  isLoading = false,
}: CompetitorCardProps) {
  if (isLoading) {
    return <CompetitorSkeleton />;
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
            <IconUsers size={20} className="text-violet-400" />
            <Text fw={600} c="white">Competitors</Text>
          </Group>
        </Group>
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No competitor data available. Trigger enrichment to collect.
        </Text>
      </Paper>
    );
  }

  const competitors = data.competitors || [];
  const algoliaUsers = competitors.filter(c => c.using_algolia);
  const nonAlgoliaUsers = competitors.filter(c => !c.using_algolia);

  // Calculate competitive opportunity
  const algoliaShare = competitors.length > 0
    ? Math.round((algoliaUsers.length / competitors.length) * 100)
    : 0;

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
            <div className="p-2 rounded-lg bg-violet-500/20">
              <IconUsers size={20} className="text-violet-400" />
            </div>
            <div>
              <Text fw={600} c="white">Competitor Landscape</Text>
              <Text size="xs" c="dimmed">
                {competitors.length} similar companies
              </Text>
            </div>
          </Group>
          {source && (
            <SourceBadge
              source={source}
              freshness={calculateFreshness(source.date)}
              compact
            />
          )}
        </Group>

        <Stack gap="md">
          {/* Market Position */}
          {data.market_position && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <Text size="xs" c="dimmed" mb="xs">Market Position</Text>
              <Text size="sm" c="white">{data.market_position}</Text>
            </div>
          )}

          {/* Algolia Penetration */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="white">
                Algolia Market Share (Competitors)
              </Text>
              <Badge
                size="lg"
                variant="light"
                color={algoliaShare > 50 ? 'green' : algoliaShare > 25 ? 'yellow' : 'blue'}
              >
                {algoliaShare}%
              </Badge>
            </Group>
            <Progress
              value={algoliaShare}
              size="lg"
              radius="xl"
              color={algoliaShare > 50 ? 'green' : algoliaShare > 25 ? 'yellow' : 'blue'}
              className="mb-2"
            />
            <Group gap="md">
              <Group gap="xs">
                <IconCheck size={14} className="text-green-400" />
                <Text size="xs" c="dimmed">
                  {algoliaUsers.length} using Algolia
                </Text>
              </Group>
              <Group gap="xs">
                <IconX size={14} className="text-red-400" />
                <Text size="xs" c="dimmed">
                  {nonAlgoliaUsers.length} using competitors
                </Text>
              </Group>
            </Group>
          </div>

          {/* Opportunity highlight */}
          {algoliaShare === 0 && competitors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30"
            >
              <Group gap="xs">
                <IconTrophy size={16} className="text-blue-400" />
                <Text size="sm" fw={600} c="blue.4">
                  First-Mover Advantage
                </Text>
              </Group>
              <Text size="xs" c="dimmed" mt="xs">
                None of the {competitors.length} competitors are using Algolia.
                This is an opportunity to be the first in this space.
              </Text>
            </motion.div>
          )}

          {/* Competitor list */}
          <div>
            <Text size="sm" fw={600} c="dimmed" mb="sm">
              Similar Companies
            </Text>
            <Stack gap="xs">
              {competitors.slice(0, 5).map((competitor, index) => (
                <CompetitorRow
                  key={competitor.domain}
                  competitor={competitor}
                  index={index}
                />
              ))}
            </Stack>
            {competitors.length > 5 && (
              <Text size="xs" c="dimmed" ta="center" mt="sm">
                +{competitors.length - 5} more competitors
              </Text>
            )}
          </div>

          {/* Competitive landscape summary */}
          {data.competitive_landscape && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <Text size="xs" c="dimmed" mb="xs">Landscape Summary</Text>
              <Text size="sm" c="white/80">{data.competitive_landscape}</Text>
            </div>
          )}
        </Stack>
      </Paper>
    </motion.div>
  );
}

interface CompetitorRowProps {
  competitor: Competitor;
  index: number;
}

function CompetitorRow({ competitor, index }: CompetitorRowProps) {
  const isAlgolia = competitor.using_algolia;
  const providerColor = getSearchProviderColor(competitor.search_provider);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
    >
      {/* Company avatar */}
      <Avatar
        size="sm"
        radius="md"
        color="violet"
        className="flex-shrink-0"
      >
        {competitor.company_name?.charAt(0) || competitor.domain.charAt(0).toUpperCase()}
      </Avatar>

      {/* Company info */}
      <div className="flex-1 min-w-0">
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={500} c="white" truncate>
            {competitor.company_name || competitor.domain}
          </Text>
          <Anchor
            href={`https://${competitor.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            size="xs"
          >
            <IconExternalLink size={12} className="text-white/40 hover:text-white/60" />
          </Anchor>
        </Group>
        <Text size="xs" c="dimmed" truncate>
          {competitor.domain}
        </Text>
      </div>

      {/* Similarity score */}
      <Tooltip label={`${competitor.similarity_score}% similar`}>
        <div className="flex items-center gap-1">
          <Progress
            value={competitor.similarity_score}
            size="xs"
            w={40}
            color="violet"
          />
          <Text size="xs" c="dimmed">{competitor.similarity_score}%</Text>
        </div>
      </Tooltip>

      {/* Search provider */}
      <Tooltip
        label={
          competitor.search_provider
            ? `Using: ${competitor.search_provider}`
            : 'Search provider unknown'
        }
      >
        <Badge
          size="sm"
          variant="light"
          color={providerColor}
          leftSection={
            isAlgolia
              ? <IconCheck size={10} />
              : competitor.search_provider
              ? <IconSearch size={10} />
              : null
          }
        >
          {isAlgolia
            ? 'Algolia'
            : competitor.search_provider || 'Unknown'}
        </Badge>
      </Tooltip>
    </motion.div>
  );
}

function CompetitorSkeleton() {
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
            <Skeleton width={120} height={16} />
            <Skeleton width={100} height={12} className="mt-1" />
          </div>
        </Group>
        <Skeleton width={60} height={20} />
      </Group>
      <Stack gap="md">
        <Skeleton width="100%" height={80} />
        <Stack gap="xs">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width="100%" height={52} />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
