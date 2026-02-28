/**
 * ICPCascade - Unified ICP visualization showing BOTH layers:
 *
 * LEFT COLUMN: Ideal Customers (Business Layer)
 *   - Industries → Companies → Evidence (Quotes, Story Link, Features)
 *
 * RIGHT COLUMN: Ideal Personas (People Layer)
 *   - Personas → Titles → Themes → Sample Quotes
 *
 * This dual-view shows the full ICP: WHO (companies) + WHO (buyers within)
 */

import { useState, useMemo } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Box,
  Collapse,
  SimpleGrid,
  ActionIcon,
  Tooltip,
  Divider,
  Avatar,
  ThemeIcon,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconBuilding,
  IconQuote,
  IconExternalLink,
  IconMapPin,
  IconUser,
  IconCopy,
  IconCheck,
  IconBriefcase,
  IconSparkles,
  IconUsers,
  IconTag,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS } from '@/lib/constants';
import customerEvidenceData from '@/data/customerEvidence.json';
import { CustomerEvidence, CustomerEvidenceData, INDUSTRY_CONFIG } from '@/data/customerEvidenceTypes';
import { personas, BuyerPersona } from '@/data/icpData';

const data = customerEvidenceData as CustomerEvidenceData;

// =============================================================================
// Types
// =============================================================================

interface Industry {
  id: string;
  name: string;
  displayName: string;
  count: number;
  companies: CustomerEvidence[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  proofPoints: number;
  color: string;
  withQuotes: number;
  withStories: number;
}

// =============================================================================
// Quote Card Component
// =============================================================================

function QuoteCard({ quote, index }: { quote: CustomerEvidence['quotes'][0]; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${quote.text}" — ${quote.speaker}, ${quote.title}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Paper
        p="md"
        radius="md"
        withBorder
        style={{
          borderLeft: `3px solid ${COLORS.ALGOLIA_PURPLE}`,
          background: `linear-gradient(90deg, ${COLORS.ALGOLIA_PURPLE}05, transparent)`,
        }}
      >
        <Group justify="space-between" align="flex-start" mb="xs">
          <Badge size="xs" variant="light" color="violet">
            {quote.source}
          </Badge>
          <Tooltip label={copied ? 'Copied!' : 'Copy quote'}>
            <ActionIcon variant="subtle" size="sm" onClick={handleCopy}>
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="sm" fs="italic" c="dark" mb="sm" lineClamp={3}>
          "{quote.text}"
        </Text>
        <Group gap="xs">
          <Avatar size="xs" color="blue" radius="xl">
            <IconUser size={10} />
          </Avatar>
          <Text size="xs" fw={600}>{quote.speaker}</Text>
          <Text size="xs" c="dimmed">•</Text>
          <Text size="xs" c="dimmed">{quote.title}</Text>
        </Group>
      </Paper>
    </motion.div>
  );
}

// =============================================================================
// Company Detail Panel (Level 4 - Evidence)
// =============================================================================

function CompanyDetailPanel({ company }: { company: CustomerEvidence }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        ml={48}
        pl="md"
        py="md"
        style={{
          borderLeft: `2px solid ${COLORS.ALGOLIA_PURPLE}40`,
        }}
      >
        {/* Story Link */}
        {company.storyUrl && (
          <Button
            component="a"
            href={company.storyUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="light"
            color="blue"
            size="sm"
            leftSection={<IconExternalLink size={14} />}
            mb="md"
          >
            View Customer Story on Algolia.com
          </Button>
        )}

        {/* Features */}
        {company.featuresUsed.length > 0 && (
          <Box mb="md">
            <Text size="xs" fw={600} c="dimmed" mb="xs">ALGOLIA FEATURES</Text>
            <Group gap={6}>
              {company.featuresUsed.map(feature => (
                <Badge key={feature} size="sm" variant="light" color="cyan">
                  {feature}
                </Badge>
              ))}
            </Group>
          </Box>
        )}

        {/* Quotes */}
        {company.quotes.length > 0 && (
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb="xs">
              CUSTOMER QUOTES ({company.quotes.length})
            </Text>
            <Stack gap="sm">
              {company.quotes.slice(0, 3).map((quote, idx) => (
                <QuoteCard key={idx} quote={quote} index={idx} />
              ))}
              {company.quotes.length > 3 && (
                <Text size="xs" c="dimmed" ta="center">
                  +{company.quotes.length - 3} more quotes
                </Text>
              )}
            </Stack>
          </Box>
        )}

        {/* No evidence state */}
        {!company.storyUrl && company.quotes.length === 0 && (
          <Text size="sm" c="dimmed" fs="italic">
            Logo reference only — no detailed evidence available
          </Text>
        )}
      </Box>
    </motion.div>
  );
}

// =============================================================================
// Evidence Type Badges - Shows which of the 4 evidence types are available
// =============================================================================

function EvidenceBadges({ company }: { company: CustomerEvidence }) {
  const hasQuotes = company.quotes.length > 0;
  const hasStory = !!company.storyUrl;
  const hasFeatures = company.featuresUsed && company.featuresUsed.length > 0;
  const hasMetrics = company.metrics && company.metrics.length > 0;

  return (
    <Group gap={4}>
      <Tooltip label={hasQuotes ? `${company.quotes.length} quotes` : 'No quotes'}>
        <Badge
          size="xs"
          variant={hasQuotes ? 'filled' : 'outline'}
          color={hasQuotes ? 'violet' : 'gray'}
          style={{ opacity: hasQuotes ? 1 : 0.4 }}
        >
          Q
        </Badge>
      </Tooltip>
      <Tooltip label={hasStory ? 'Has case study' : 'No case study'}>
        <Badge
          size="xs"
          variant={hasStory ? 'filled' : 'outline'}
          color={hasStory ? 'blue' : 'gray'}
          style={{ opacity: hasStory ? 1 : 0.4 }}
        >
          S
        </Badge>
      </Tooltip>
      <Tooltip label={hasFeatures ? `${company.featuresUsed.length} features` : 'No features listed'}>
        <Badge
          size="xs"
          variant={hasFeatures ? 'filled' : 'outline'}
          color={hasFeatures ? 'cyan' : 'gray'}
          style={{ opacity: hasFeatures ? 1 : 0.4 }}
        >
          F
        </Badge>
      </Tooltip>
      <Tooltip label={hasMetrics ? 'Has proof points' : 'No proof points'}>
        <Badge
          size="xs"
          variant={hasMetrics ? 'filled' : 'outline'}
          color={hasMetrics ? 'green' : 'gray'}
          style={{ opacity: hasMetrics ? 1 : 0.4 }}
        >
          P
        </Badge>
      </Tooltip>
    </Group>
  );
}

// =============================================================================
// Company Card (Level 3)
// =============================================================================

function CompanyCard({
  company,
  isExpanded,
  onToggle,
  industryColor,
}: {
  company: CustomerEvidence;
  isExpanded: boolean;
  onToggle: () => void;
  industryColor: string;
}) {
  const hasEvidence = company.storyUrl || company.quotes.length > 0 || (company.featuresUsed && company.featuresUsed.length > 0);

  // Count evidence types
  const evidenceCount = [
    company.quotes.length > 0,
    !!company.storyUrl,
    company.featuresUsed && company.featuresUsed.length > 0,
    company.metrics && company.metrics.length > 0,
  ].filter(Boolean).length;

  return (
    <Box>
      <Paper
        p="sm"
        radius="md"
        withBorder
        onClick={hasEvidence ? onToggle : undefined}
        style={{
          cursor: hasEvidence ? 'pointer' : 'default',
          borderColor: isExpanded ? industryColor : undefined,
          background: isExpanded
            ? `linear-gradient(90deg, ${industryColor}10, transparent)`
            : evidenceCount >= 3
            ? 'linear-gradient(90deg, #10b98110, transparent)'  // Gold - has most evidence
            : company.storyUrl
            ? 'linear-gradient(90deg, #e0f2fe10, transparent)'
            : undefined,
          transition: 'all 0.2s ease',
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {hasEvidence && (
              <ThemeIcon variant="light" size="sm" color={isExpanded ? 'blue' : 'gray'}>
                {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              </ThemeIcon>
            )}
            <Box>
              <Group gap="xs">
                <Text fw={600} size="sm">{company.company}</Text>
                {evidenceCount >= 3 && (
                  <Badge size="xs" variant="filled" color="green">GOLD</Badge>
                )}
              </Group>
              <Group gap="xs" mt={2}>
                {company.country && (
                  <Group gap={2}>
                    <IconMapPin size={10} color="#64748b" />
                    <Text size="xs" c="dimmed">{company.country}</Text>
                  </Group>
                )}
                {company.useCase && (
                  <Text size="xs" c="dimmed">• {company.useCase}</Text>
                )}
              </Group>
            </Box>
          </Group>
          <EvidenceBadges company={company} />
        </Group>
      </Paper>

      <AnimatePresence>
        {isExpanded && hasEvidence && (
          <CompanyDetailPanel company={company} />
        )}
      </AnimatePresence>
    </Box>
  );
}

// =============================================================================
// Industry Panel (Level 2)
// =============================================================================

function IndustryPanel({
  industry,
  isExpanded,
  onToggle,
  expandedCompany,
  onCompanyToggle,
}: {
  industry: Industry;
  isExpanded: boolean;
  onToggle: () => void;
  expandedCompany: string | null;
  onCompanyToggle: (companyName: string) => void;
}) {
  const config = INDUSTRY_CONFIG[industry.name] || INDUSTRY_CONFIG['Other'];

  return (
    <Box>
      <Paper
        p="md"
        radius="md"
        withBorder
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          borderColor: isExpanded ? config.color : undefined,
          borderWidth: isExpanded ? 2 : 1,
          background: isExpanded
            ? `linear-gradient(135deg, ${config.color}08, ${config.color}03)`
            : undefined,
          transition: 'all 0.2s ease',
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <ThemeIcon
              variant={isExpanded ? 'filled' : 'light'}
              color={config.color}
              size="lg"
              radius="md"
            >
              {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
            </ThemeIcon>
            <Box>
              <Group gap="xs" mb={4}>
                <Text fw={700} size="md">{industry.displayName}</Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={
                    industry.confidence === 'HIGH' ? 'green' :
                    industry.confidence === 'MEDIUM' ? 'yellow' : 'gray'
                  }
                >
                  {industry.confidence}
                </Badge>
              </Group>
              <Group gap="md">
                <Text size="sm" c="dimmed">
                  <strong>{industry.count}</strong> companies
                </Text>
                {industry.withStories > 0 && (
                  <Text size="sm" c="dimmed">
                    <strong>{industry.withStories}</strong> stories
                  </Text>
                )}
                {industry.withQuotes > 0 && (
                  <Text size="sm" c="dimmed">
                    <strong>{industry.withQuotes}</strong> with quotes
                  </Text>
                )}
              </Group>
            </Box>
          </Group>

          <Group gap="xs">
            {industry.proofPoints > 0 && (
              <Badge variant="filled" color={config.color} size="md">
                {industry.proofPoints} proof points
              </Badge>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Expanded Companies List */}
      <Collapse in={isExpanded}>
        <Box
          ml={24}
          pl="md"
          py="md"
          style={{
            borderLeft: `2px solid ${config.color}40`,
          }}
        >
          <Stack gap="xs">
            {industry.companies
              .sort((a, b) => {
                // Sort by: has story, then quote count
                if (a.storyUrl && !b.storyUrl) return -1;
                if (!a.storyUrl && b.storyUrl) return 1;
                return b.quotes.length - a.quotes.length;
              })
              .map(company => (
                <CompanyCard
                  key={company.company}
                  company={company}
                  isExpanded={expandedCompany === company.company}
                  onToggle={() => onCompanyToggle(company.company)}
                  industryColor={config.color}
                />
              ))}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

// =============================================================================
// Persona Panel Component
// =============================================================================

function PersonaPanel({
  persona,
  isExpanded,
  onToggle,
}: {
  persona: BuyerPersona;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Box>
      <Paper
        p="md"
        radius="md"
        withBorder
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          borderColor: isExpanded ? persona.color : undefined,
          borderWidth: isExpanded ? 2 : 1,
          background: isExpanded
            ? `linear-gradient(135deg, ${persona.color}08, ${persona.color}03)`
            : undefined,
          transition: 'all 0.2s ease',
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <ThemeIcon
              variant={isExpanded ? 'filled' : 'light'}
              color={persona.color}
              size="lg"
              radius="md"
            >
              {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
            </ThemeIcon>
            <Box>
              <Group gap="xs" mb={4}>
                <Text fw={700} size="md">{persona.name}</Text>
                <Badge size="sm" variant="filled" color={persona.color}>
                  {persona.percentage}% of quotes
                </Badge>
              </Group>
              <Group gap="xs">
                {persona.titles.slice(0, 2).map(title => (
                  <Badge key={title} size="xs" variant="light" color="gray">
                    {title}
                  </Badge>
                ))}
                {persona.titles.length > 2 && (
                  <Text size="xs" c="dimmed">+{persona.titles.length - 2} more</Text>
                )}
              </Group>
            </Box>
          </Group>
        </Group>
      </Paper>

      {/* Expanded Persona Details */}
      <Collapse in={isExpanded}>
        <Box
          ml={24}
          pl="md"
          py="md"
          style={{
            borderLeft: `2px solid ${persona.color}40`,
          }}
        >
          {/* Titles */}
          <Box mb="md">
            <Text size="xs" fw={600} c="dimmed" mb="xs">TYPICAL TITLES</Text>
            <Group gap={6}>
              {persona.titles.map(title => (
                <Badge key={title} size="sm" variant="light" color={persona.color}>
                  {title}
                </Badge>
              ))}
            </Group>
          </Box>

          {/* Key Themes */}
          <Box mb="md">
            <Text size="xs" fw={600} c="dimmed" mb="xs">KEY THEMES THEY CARE ABOUT</Text>
            <Group gap={6}>
              {persona.themes.map(theme => (
                <Badge key={theme} size="sm" variant="outline" color={persona.color} leftSection={<IconTag size={10} />}>
                  {theme}
                </Badge>
              ))}
            </Group>
          </Box>

          {/* Sample Quote */}
          <Paper
            p="md"
            radius="md"
            withBorder
            style={{
              borderLeft: `3px solid ${persona.color}`,
              background: `linear-gradient(90deg, ${persona.color}05, transparent)`,
            }}
          >
            <Text size="sm" fs="italic" c="dark" mb="sm">
              "{persona.sampleQuote}"
            </Text>
            <Group gap="xs">
              <Avatar size="xs" color={persona.color} radius="xl">
                <IconUser size={10} />
              </Avatar>
              <Text size="xs" fw={600}>{persona.sampleSpeaker}</Text>
            </Group>
          </Paper>
        </Box>
      </Collapse>
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ICPCascade() {
  const [expandedIndustry, setExpandedIndustry] = useState<string | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);

  // Process data into industries
  const industries = useMemo((): Industry[] => {
    const industryMap: Record<string, CustomerEvidence[]> = {};

    data.companies.forEach((company) => {
      const ind = company.industry.toLowerCase();
      let key = 'Other';

      if (ind.includes('fashion') || ind.includes('apparel') || ind.includes('clothing') || ind.includes('fitness')) {
        key = 'Fashion/Apparel';
      } else if (ind.includes('grocery') || ind.includes('food')) {
        key = 'Grocery/Food';
      } else if (ind.includes('saas') || ind.includes('software')) {
        key = 'SaaS';
      } else if (ind.includes('b2b')) {
        key = 'B2B E-commerce';
      } else if (ind.includes('media') || ind.includes('publishing')) {
        key = 'Media/Publishing';
      } else if (ind.includes('retail') || ind.includes('e-comm') || ind.includes('ecomm')) {
        key = 'Retail E-commerce';
      } else if (ind.includes('health') || ind.includes('pharmacy')) {
        key = 'Healthcare';
      }

      if (!industryMap[key]) industryMap[key] = [];
      industryMap[key].push(company);
    });

    return Object.entries(industryMap)
      .map(([name, companies]) => {
        const config = INDUSTRY_CONFIG[name] || INDUSTRY_CONFIG['Other'];
        return {
          id: name.toLowerCase().replace(/[^a-z]/g, '-'),
          name,
          displayName: config.name || name,
          count: companies.length,
          companies,
          confidence: config.confidence,
          proofPoints: config.proofPoints,
          color: config.color,
          withQuotes: companies.filter(c => c.quotes.length > 0).length,
          withStories: companies.filter(c => c.storyUrl).length,
        };
      })
      .sort((a, b) => {
        // Sort by confidence first, then count
        const confOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        if (confOrder[a.confidence] !== confOrder[b.confidence]) {
          return confOrder[a.confidence] - confOrder[b.confidence];
        }
        return b.count - a.count;
      });
  }, []);

  const handleIndustryToggle = (industryId: string) => {
    setExpandedIndustry(prev => prev === industryId ? null : industryId);
    setExpandedCompany(null); // Reset company when switching industry
  };

  const handleCompanyToggle = (companyName: string) => {
    setExpandedCompany(prev => prev === companyName ? null : companyName);
  };

  // Stats
  const totalCompanies = industries.reduce((sum, i) => sum + i.count, 0);
  const totalQuotes = data.companies.reduce((sum, c) => sum + c.quotes.length, 0);
  const totalStories = data.companies.filter(c => c.storyUrl).length;

  return (
    <Box>
      {/* ICP Hub Header */}
      <Paper
        p="lg"
        radius="lg"
        mb="lg"
        style={{
          background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE}, ${COLORS.ALGOLIA_PURPLE})`,
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <Box>
            <Group gap="sm" mb="xs">
              <IconSparkles size={24} />
              <Text fw={800} size="xl">Algolia ICP Evidence Explorer</Text>
            </Group>
            <Text size="sm" opacity={0.9}>
              Click an industry to expand → Click a company to see quotes and case studies
            </Text>
          </Box>
          <Group gap="md">
            <Box ta="center">
              <Text fw={800} size="xl">{totalCompanies}</Text>
              <Text size="xs" opacity={0.8}>Companies</Text>
            </Box>
            <Box ta="center">
              <Text fw={800} size="xl">{totalStories}</Text>
              <Text size="xs" opacity={0.8}>Stories</Text>
            </Box>
            <Box ta="center">
              <Text fw={800} size="xl">{totalQuotes}</Text>
              <Text size="xs" opacity={0.8}>Quotes</Text>
            </Box>
          </Group>
        </Group>
      </Paper>

      {/* Two-Column ICP View: Customers + Personas */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* LEFT: Ideal Customers (Business Layer) */}
        <Paper p="md" radius="md" withBorder style={{ height: 'fit-content' }}>
          <Group gap="sm" mb="md">
            <ThemeIcon variant="light" color="blue" size="md">
              <IconBuilding size={16} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md">Ideal Customers</Text>
              <Text size="xs" c="dimmed">Which companies buy Algolia?</Text>
            </Box>
          </Group>
          <Stack gap="xs">
            {industries.map(industry => (
              <IndustryPanel
                key={industry.id}
                industry={industry}
                isExpanded={expandedIndustry === industry.id}
                onToggle={() => handleIndustryToggle(industry.id)}
                expandedCompany={expandedCompany}
                onCompanyToggle={handleCompanyToggle}
              />
            ))}
          </Stack>
        </Paper>

        {/* RIGHT: Ideal Personas (People Layer) */}
        <Paper p="md" radius="md" withBorder style={{ height: 'fit-content' }}>
          <Group gap="sm" mb="md">
            <ThemeIcon variant="light" color="violet" size="md">
              <IconUsers size={16} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md">Ideal Personas</Text>
              <Text size="xs" c="dimmed">Who buys within those companies? (from 379 quotes)</Text>
            </Box>
          </Group>
          <Stack gap="xs">
            {personas.map(persona => (
              <PersonaPanel
                key={persona.id}
                persona={persona}
                isExpanded={expandedPersona === persona.id}
                onToggle={() => setExpandedPersona(prev => prev === persona.id ? null : persona.id)}
              />
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* Legend */}
      <Paper p="md" radius="md" withBorder mt="lg" bg="gray.0">
        <Stack gap="sm">
          {/* Evidence Types Legend */}
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb="xs">4 EVIDENCE TYPES (per company)</Text>
            <Group gap="lg">
              <Group gap="xs">
                <Badge size="xs" variant="filled" color="violet">Q</Badge>
                <Text size="xs" c="dimmed">Quotes</Text>
              </Group>
              <Group gap="xs">
                <Badge size="xs" variant="filled" color="blue">S</Badge>
                <Text size="xs" c="dimmed">Story URL</Text>
              </Group>
              <Group gap="xs">
                <Badge size="xs" variant="filled" color="cyan">F</Badge>
                <Text size="xs" c="dimmed">Features</Text>
              </Group>
              <Group gap="xs">
                <Badge size="xs" variant="filled" color="green">P</Badge>
                <Text size="xs" c="dimmed">Proof Points</Text>
              </Group>
              <Group gap="xs">
                <Badge size="xs" variant="filled" color="green">GOLD</Badge>
                <Text size="xs" c="dimmed">= 3+ evidence types</Text>
              </Group>
            </Group>
          </Box>

          <Divider />

          {/* Industry Confidence Legend */}
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb="xs">INDUSTRY CONFIDENCE</Text>
            <Group gap="lg">
              <Group gap="xs">
                <Badge color="green" size="xs">HIGH</Badge>
                <Text size="xs" c="dimmed">Strong evidence across all types</Text>
              </Group>
              <Group gap="xs">
                <Badge color="yellow" size="xs">MEDIUM</Badge>
                <Text size="xs" c="dimmed">Some evidence gaps</Text>
              </Group>
              <Group gap="xs">
                <Badge color="gray" size="xs">LOW</Badge>
                <Text size="xs" c="dimmed">Logos only</Text>
              </Group>
            </Group>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
