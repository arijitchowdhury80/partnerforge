/**
 * CompetitorAccordion - Deep Competitor Analysis
 *
 * Shows competitors with their search providers and Algolia usage.
 * Triggers 3-step analysis pipeline:
 * 1. SimilarWeb → Get similar sites (competitors)
 * 2. BuiltWith → Get tech stack for each competitor
 * 3. Analysis → Identify search providers, flag Algolia users
 */

import { useState, useCallback } from 'react';
import {
  Accordion,
  Group,
  Stack,
  Text,
  Badge,
  Paper,
  Button,
  Progress,
  Anchor,
  ThemeIcon,
  Tooltip,
  SimpleGrid,
  Divider,
} from '@mantine/core';
import {
  IconUsersGroup,
  IconRefresh,
  IconSearch,
  IconCheck,
  IconX,
  IconExternalLink,
  IconLoader,
  IconBrandAlgolia,
} from '@tabler/icons-react';
import {
  analyzeCompetitorsDeep,
  type CompetitorWithTech,
  type CompetitorAnalysisProgress,
} from '@/services/enrichment';
import { COLORS } from '@/lib/constants';

// =============================================================================
// Types
// =============================================================================

interface CompetitorAccordionProps {
  domain: string;
  /** Cached competitor data from database (competitors_json) */
  cachedCompetitors?: string | null;
  /** Callback when competitor data is updated */
  onCompetitorsUpdated?: (competitors: CompetitorWithTech[]) => void;
}

// =============================================================================
// Algolia Logo Component
// =============================================================================

function AlgoliaLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#5468FF" />
      <path
        d="M16 7.5c-4.7 0-8.5 3.8-8.5 8.5s3.8 8.5 8.5 8.5 8.5-3.8 8.5-8.5-3.8-8.5-8.5-8.5zm0 14.5c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"
        fill="white"
      />
      <circle cx="16" cy="16" r="2.5" fill="white" />
    </svg>
  );
}

// =============================================================================
// Search Provider Badge
// =============================================================================

function SearchProviderBadge({ provider, usesAlgolia }: { provider?: string; usesAlgolia: boolean }) {
  if (usesAlgolia) {
    return (
      <Badge
        leftSection={<AlgoliaLogo size={12} />}
        variant="filled"
        color="indigo"
        size="sm"
        styles={{ root: { fontWeight: 600 } }}
      >
        Algolia
      </Badge>
    );
  }

  if (provider) {
    // Color code by competitor search provider
    const providerLower = provider.toLowerCase();
    let color = 'gray';
    if (providerLower.includes('elastic')) color = 'yellow';
    if (providerLower.includes('coveo')) color = 'red';
    if (providerLower.includes('bloomreach')) color = 'pink';
    if (providerLower.includes('constructor')) color = 'orange';
    if (providerLower.includes('lucid') || providerLower.includes('solr')) color = 'teal';
    if (providerLower.includes('searchspring')) color = 'lime';
    if (providerLower.includes('klevu')) color = 'cyan';

    return (
      <Badge variant="outline" color={color} size="sm">
        {provider}
      </Badge>
    );
  }

  return (
    <Badge variant="light" color="gray" size="sm">
      Unknown
    </Badge>
  );
}

// =============================================================================
// Competitor Card
// =============================================================================

function CompetitorCard({ competitor }: { competitor: CompetitorWithTech }) {
  return (
    <Paper p="sm" withBorder radius="md" style={{ background: competitor.using_algolia ? '#f0f4ff' : 'white' }}>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Text size="sm" fw={600} c={COLORS.GRAY_900}>
            {competitor.company_name || competitor.domain}
          </Text>
          {competitor.using_algolia && (
            <Tooltip label="This competitor uses Algolia!">
              <ThemeIcon size="sm" variant="filled" color="indigo" radius="xl">
                <IconCheck size={12} />
              </ThemeIcon>
            </Tooltip>
          )}
        </Group>
        <Anchor
          href={`https://${competitor.domain}`}
          target="_blank"
          size="xs"
          c={COLORS.GRAY_500}
        >
          <Group gap={4}>
            {competitor.domain}
            <IconExternalLink size={12} />
          </Group>
        </Anchor>
      </Group>

      <Group justify="space-between">
        <Group gap="xs">
          <Text size="xs" c={COLORS.GRAY_500}>
            {competitor.similarity_score}% similar
          </Text>
        </Group>
        <SearchProviderBadge
          provider={competitor.search_provider_detected}
          usesAlgolia={competitor.using_algolia}
        />
      </Group>

      {/* Tech stack preview if available */}
      {competitor.tech_stack && (
        <Group gap={4} mt="xs">
          {competitor.tech_stack.cms?.slice(0, 1).map(tech => (
            <Badge key={tech} size="xs" variant="light" color="gray">{tech}</Badge>
          ))}
          {competitor.tech_stack.ecommerce?.slice(0, 1).map(tech => (
            <Badge key={tech} size="xs" variant="light" color="blue">{tech}</Badge>
          ))}
        </Group>
      )}
    </Paper>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CompetitorAccordion({
  domain,
  cachedCompetitors,
  onCompetitorsUpdated,
}: CompetitorAccordionProps) {
  const [competitors, setCompetitors] = useState<CompetitorWithTech[]>(() => {
    if (cachedCompetitors) {
      try {
        return JSON.parse(cachedCompetitors);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<CompetitorAnalysisProgress | null>(null);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setProgress({
      total: 0,
      completed: 0,
      status: 'pending',
      message: 'Starting competitor analysis...',
    });

    try {
      const results = await analyzeCompetitorsDeep(domain, (p) => {
        setProgress(p);
      });

      setCompetitors(results);
      onCompetitorsUpdated?.(results);
    } catch (err) {
      console.error('[CompetitorAccordion] Analysis failed:', err);
      setProgress({
        total: 0,
        completed: 0,
        status: 'error',
        message: 'Analysis failed. Please try again.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [domain, onCompetitorsUpdated]);

  // Calculate stats
  const algoliaCount = competitors.filter(c => c.using_algolia).length;
  const withSearchProvider = competitors.filter(c => c.search_provider_detected).length;
  const hasDeepData = competitors.length > 0 && competitors[0].tech_stack;

  return (
    <Accordion.Item value="competitors">
      <Accordion.Control icon={<IconUsersGroup size={20} color={COLORS.ALGOLIA_NEBULA_BLUE} />}>
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text fw={600} c={COLORS.GRAY_900}>Competitor Intelligence</Text>
          <Group gap="xs">
            {competitors.length > 0 && (
              <>
                <Badge variant="light" color="gray">
                  {competitors.length} competitors
                </Badge>
                {algoliaCount > 0 && (
                  <Badge variant="filled" color="indigo">
                    {algoliaCount} use Algolia
                  </Badge>
                )}
              </>
            )}
          </Group>
        </Group>
      </Accordion.Control>

      <Accordion.Panel>
        <Stack gap="md">
          {/* Analysis Controls */}
          <Paper p="md" bg={COLORS.GRAY_50} radius="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text size="sm" fw={600} c={COLORS.GRAY_900} mb={4}>
                  3-Step Competitor Analysis
                </Text>
                <Text size="xs" c={COLORS.GRAY_500}>
                  1. SimilarWeb → Find similar sites{' '}
                  2. BuiltWith → Detect tech stack{' '}
                  3. Analyze → Identify Algolia users
                </Text>
              </div>
              <Button
                variant="filled"
                color="blue"
                size="sm"
                leftSection={isAnalyzing ? <IconLoader size={16} className="animate-spin" /> : <IconRefresh size={16} />}
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing...' : hasDeepData ? 'Refresh' : 'Analyze Competitors'}
              </Button>
            </Group>

            {/* Progress indicator */}
            {isAnalyzing && progress && (
              <Stack gap="xs" mt="md">
                <Group justify="space-between">
                  <Text size="xs" c={COLORS.GRAY_600}>{progress.message}</Text>
                  {progress.total > 0 && (
                    <Text size="xs" c={COLORS.GRAY_500}>
                      {progress.completed}/{progress.total}
                    </Text>
                  )}
                </Group>
                {progress.total > 0 && (
                  <Progress
                    value={(progress.completed / progress.total) * 100}
                    size="sm"
                    color="blue"
                    radius="xl"
                    animated
                  />
                )}
              </Stack>
            )}
          </Paper>

          {/* Stats Summary */}
          {competitors.length > 0 && (
            <SimpleGrid cols={3}>
              <Paper p="sm" bg="white" withBorder radius="md" ta="center">
                <Text size="xs" c={COLORS.GRAY_500}>Total Competitors</Text>
                <Text size="xl" fw={700} c={COLORS.GRAY_900}>{competitors.length}</Text>
              </Paper>
              <Paper p="sm" bg="#f0f4ff" withBorder radius="md" ta="center" style={{ borderColor: COLORS.ALGOLIA_NEBULA_BLUE }}>
                <Text size="xs" c={COLORS.ALGOLIA_NEBULA_BLUE}>Use Algolia</Text>
                <Text size="xl" fw={700} c={COLORS.ALGOLIA_NEBULA_BLUE}>{algoliaCount}</Text>
              </Paper>
              <Paper p="sm" bg="white" withBorder radius="md" ta="center">
                <Text size="xs" c={COLORS.GRAY_500}>Search Detected</Text>
                <Text size="xl" fw={700} c={COLORS.GRAY_900}>{withSearchProvider}</Text>
              </Paper>
            </SimpleGrid>
          )}

          {/* Competitor List */}
          {competitors.length > 0 ? (
            <Stack gap="sm">
              {/* Algolia users first */}
              {algoliaCount > 0 && (
                <>
                  <Text size="xs" fw={600} c={COLORS.ALGOLIA_NEBULA_BLUE} tt="uppercase">
                    Competitors Using Algolia ({algoliaCount})
                  </Text>
                  {competitors
                    .filter(c => c.using_algolia)
                    .map((comp, idx) => (
                      <CompetitorCard key={`algolia-${idx}`} competitor={comp} />
                    ))}
                  <Divider my="xs" />
                </>
              )}

              {/* Others */}
              <Text size="xs" fw={600} c={COLORS.GRAY_500} tt="uppercase">
                Other Competitors ({competitors.length - algoliaCount})
              </Text>
              {competitors
                .filter(c => !c.using_algolia)
                .map((comp, idx) => (
                  <CompetitorCard key={`other-${idx}`} competitor={comp} />
                ))}
            </Stack>
          ) : (
            <Paper p="lg" bg={COLORS.GRAY_50} radius="md" ta="center">
              <IconUsersGroup size={32} color={COLORS.GRAY_400} style={{ margin: '0 auto 8px' }} />
              <Text size="sm" c={COLORS.GRAY_600}>
                Click "Analyze Competitors" to discover who your target competes with
                and which competitors already use Algolia.
              </Text>
            </Paper>
          )}

          {/* Strategic Insight */}
          {algoliaCount > 0 && (
            <Paper p="md" bg="#f0fdf4" radius="md" style={{ border: '1px solid #22c55e' }}>
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="filled" color="green" radius="xl">
                  <IconCheck size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600} c="#166534">Competitive Advantage</Text>
              </Group>
              <Text size="sm" c="#166534">
                {algoliaCount} of {competitors.length} competitors use Algolia.
                This is a strong social proof point — their competitors are already investing in search excellence.
              </Text>
            </Paper>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export default CompetitorAccordion;
