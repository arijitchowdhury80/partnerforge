/**
 * TechStackCard Component
 *
 * Displays technology stack intelligence for a company.
 * Shows detected technologies, partner tech, search provider, etc.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  Tooltip,
  ActionIcon,
  Collapse,
  Divider,
} from '@mantine/core';
import {
  IconServer,
  IconSearch,
  IconShoppingCart,
  IconBrandChrome,
  IconCloud,
  IconCode,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconDatabase,
  IconLayersLinked,
} from '@tabler/icons-react';
import type { TechStackData, SourceCitation } from '@/types';
import { SourceBadge, calculateFreshness } from '@/components/common/SourceBadge';
import { Skeleton } from '@/components/common/LoadingSpinner';

interface TechStackCardProps {
  data?: TechStackData;
  source?: SourceCitation;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  'search': IconSearch,
  'ecommerce': IconShoppingCart,
  'analytics': IconBrandChrome,
  'cdn': IconCloud,
  'cms': IconCode,
  'tag_manager': IconLayersLinked,
  'default': IconServer,
};

const categoryColors: Record<string, string> = {
  'search': 'blue',
  'ecommerce': 'green',
  'analytics': 'orange',
  'cdn': 'cyan',
  'cms': 'violet',
  'tag_manager': 'pink',
  'default': 'gray',
};

// Partner tech that signals Algolia opportunity
const PARTNER_TECHNOLOGIES = [
  'Adobe AEM',
  'Shopify',
  'Shopify Plus',
  'Salesforce Commerce Cloud',
  'BigCommerce',
  'Magento',
  'WooCommerce',
  'Contentful',
  'Contentstack',
];

// Competitor search providers
const COMPETITOR_SEARCH = [
  'Elasticsearch',
  'Solr',
  'Coveo',
  'Bloomreach',
  'Lucidworks',
  'SearchSpring',
  'Klevu',
  'Constructor.io',
];

export function TechStackCard({
  data,
  source,
  isLoading = false,
  onRefresh,
}: TechStackCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return <TechStackSkeleton />;
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
            <IconServer size={20} className="text-blue-400" />
            <Text fw={600} c="white">Tech Stack</Text>
          </Group>
        </Group>
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No tech stack data available. Trigger enrichment to collect.
        </Text>
      </Paper>
    );
  }

  const partnerTechDetected = data.partner_tech_detected || [];
  const hasPartnerTech = partnerTechDetected.length > 0;
  const searchProvider = data.search_provider;
  const isCompetitorSearch = searchProvider && COMPETITOR_SEARCH.some(s =>
    searchProvider.toLowerCase().includes(s.toLowerCase())
  );
  const isAlgolia = searchProvider?.toLowerCase().includes('algolia');

  // Group technologies by category
  const groupedTech = (data.technologies || []).reduce((acc, tech) => {
    const category = tech.category?.toLowerCase() || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tech);
    return acc;
  }, {} as Record<string, typeof data.technologies>);

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
            <div className="p-2 rounded-lg bg-blue-500/20">
              <IconServer size={20} className="text-blue-400" />
            </div>
            <div>
              <Text fw={600} c="white">Tech Stack</Text>
              <Text size="xs" c="dimmed">
                {data.technologies?.length || 0} technologies detected
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

        {/* Key insights */}
        <Stack gap="md">
          {/* Partner Tech Alert */}
          {hasPartnerTech && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 rounded-lg bg-green-500/10 border border-green-500/30"
            >
              <Group gap="xs" mb="xs">
                <IconDatabase size={16} className="text-green-400" />
                <Text size="sm" fw={600} c="green.4">
                  Partner Technology Detected
                </Text>
              </Group>
              <Group gap="xs">
                {partnerTechDetected.map((tech) => (
                  <Badge
                    key={tech}
                    size="sm"
                    variant="light"
                    color="green"
                  >
                    {tech}
                  </Badge>
                ))}
              </Group>
            </motion.div>
          )}

          {/* Search Provider */}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <Group justify="space-between">
              <Group gap="xs">
                <IconSearch size={16} className="text-white/60" />
                <Text size="sm" c="dimmed">Search Provider</Text>
              </Group>
              {searchProvider ? (
                <Badge
                  size="sm"
                  variant="light"
                  color={isAlgolia ? 'green' : isCompetitorSearch ? 'red' : 'gray'}
                >
                  {searchProvider}
                  {isAlgolia && ' (already using)'}
                  {isCompetitorSearch && ' (competitor)'}
                </Badge>
              ) : (
                <Badge size="sm" variant="light" color="yellow">
                  Not detected
                </Badge>
              )}
            </Group>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <Text size="xl" fw={700} c="white">
                {data.technologies?.length || 0}
              </Text>
              <Text size="xs" c="dimmed">Technologies</Text>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <Text size="xl" fw={700} c={hasPartnerTech ? 'green.4' : 'dimmed'}>
                {partnerTechDetected.length}
              </Text>
              <Text size="xs" c="dimmed">Partner Tech</Text>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <Text size="xl" fw={700} c="white">
                {Object.keys(groupedTech).length}
              </Text>
              <Text size="xs" c="dimmed">Categories</Text>
            </div>
          </div>

          {/* E-commerce & CMS */}
          {(data.ecommerce_platform || data.cms) && (
            <Group gap="md">
              {data.ecommerce_platform && (
                <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Group gap="xs" mb="xs">
                    <IconShoppingCart size={14} className="text-green-400" />
                    <Text size="xs" c="dimmed">E-commerce</Text>
                  </Group>
                  <Text size="sm" fw={500} c="white">{data.ecommerce_platform}</Text>
                </div>
              )}
              {data.cms && (
                <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Group gap="xs" mb="xs">
                    <IconCode size={14} className="text-violet-400" />
                    <Text size="xs" c="dimmed">CMS</Text>
                  </Group>
                  <Text size="sm" fw={500} c="white">{data.cms}</Text>
                </div>
              )}
            </Group>
          )}
        </Stack>

        {/* Expandable full tech list */}
        <Divider my="md" color="gray.8" />

        <Group
          justify="space-between"
          onClick={() => setExpanded(!expanded)}
          className="cursor-pointer"
        >
          <Text size="sm" c="dimmed">
            {expanded ? 'Hide' : 'Show'} all technologies
          </Text>
          <ActionIcon variant="subtle" size="sm">
            {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </ActionIcon>
        </Group>

        <Collapse in={expanded}>
          <div className="mt-4 space-y-4">
            {Object.entries(groupedTech).map(([category, techs]) => {
              const IconComponent = categoryIcons[category] || categoryIcons.default;
              const color = categoryColors[category] || categoryColors.default;

              return (
                <div key={category}>
                  <Group gap="xs" mb="xs">
                    <IconComponent size={14} className={`text-${color}-400`} />
                    <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                      {category}
                    </Text>
                  </Group>
                  <div className="flex flex-wrap gap-2">
                    {techs.map((tech) => (
                      <Tooltip
                        key={tech.name}
                        label={
                          tech.first_detected
                            ? `First detected: ${new Date(tech.first_detected).toLocaleDateString()}`
                            : tech.name
                        }
                      >
                        <Badge
                          size="sm"
                          variant="light"
                          color={color}
                          className="cursor-help"
                        >
                          {tech.name}
                        </Badge>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Collapse>
      </Paper>
    </motion.div>
  );
}

function TechStackSkeleton() {
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
            <Skeleton width={80} height={16} />
            <Skeleton width={120} height={12} className="mt-1" />
          </div>
        </Group>
        <Skeleton width={60} height={20} />
      </Group>
      <Stack gap="md">
        <Skeleton width="100%" height={60} />
        <Skeleton width="100%" height={40} />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton width="100%" height={60} />
          <Skeleton width="100%" height={60} />
          <Skeleton width="100%" height={60} />
        </div>
      </Stack>
    </Paper>
  );
}
