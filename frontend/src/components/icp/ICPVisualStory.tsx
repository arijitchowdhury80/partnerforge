/**
 * ICPVisualStory - Presentation-style ICP Infographics
 *
 * Clean, slide-like layout inspired by professional ICP infographic templates:
 * - Persona cards with avatars and attribute bars
 * - Industry breakdown with percentage bars
 * - Firmographic data visualization
 * - Clean section headers with icons
 */

import {
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  Box,
  SimpleGrid,
  Progress,
  ThemeIcon,
  Avatar,
  Title,
  Divider,
  RingProgress,
} from '@mantine/core';
import {
  IconUser,
  IconBuildingStore,
  IconChartBar,
  IconTarget,
  IconUsers,
  IconWorld,
  IconCoin,
  IconDeviceDesktop,
  IconQuote,
  IconTrendingUp,
  IconShoppingCart,
  IconShirt,
  IconApple,
  IconCode,
} from '@tabler/icons-react';
import { COLORS } from '@/lib/constants';
import { personas } from '@/data/icpData';
import customerEvidenceData from '@/data/customerEvidence.json';
import { CustomerEvidenceData } from '@/data/customerEvidenceTypes';

const data = customerEvidenceData as CustomerEvidenceData;

// Brand colors - teal/green palette like the reference
const INFOGRAPHIC_COLORS = {
  primary: '#0d9488',      // Teal
  secondary: '#f59e0b',    // Amber
  accent: '#6366f1',       // Indigo
  success: '#10b981',      // Green
  neutral: '#64748b',      // Slate
  light: '#f1f5f9',        // Light gray
};

// =============================================================================
// Slide Header Component
// =============================================================================

function SlideHeader({ title, subtitle, icon: Icon }: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ size: number; color?: string }>;
}) {
  return (
    <Box mb="lg" pb="md" style={{ borderBottom: `2px solid ${INFOGRAPHIC_COLORS.primary}` }}>
      <Group gap="sm">
        {Icon && (
          <ThemeIcon size="lg" radius="md" color="teal" variant="light">
            <Icon size={20} />
          </ThemeIcon>
        )}
        <Box>
          <Title order={3} c="dark">{title}</Title>
          {subtitle && <Text size="sm" c="dimmed">{subtitle}</Text>}
        </Box>
      </Group>
    </Box>
  );
}

// =============================================================================
// Persona Card - Avatar style with attributes
// =============================================================================

function PersonaInfoCard({ persona, index }: {
  persona: typeof personas[0];
  index: number;
}) {
  const avatarColors = ['teal', 'orange', 'indigo', 'green'];
  const color = avatarColors[index % avatarColors.length];

  return (
    <Paper p="lg" radius="md" withBorder>
      <Group align="flex-start" gap="md">
        {/* Avatar */}
        <Avatar size={80} radius="xl" color={color} variant="filled">
          <IconUser size={40} />
        </Avatar>

        {/* Info */}
        <Box style={{ flex: 1 }}>
          <Text fw={700} size="lg" mb={4}>{persona.name}</Text>
          <Badge color={color} variant="light" size="sm" mb="sm">
            {persona.percentage}% of buyers
          </Badge>

          {/* Titles */}
          <Text size="xs" c="dimmed" fw={600} mb={4}>TYPICAL TITLES</Text>
          <Group gap={4} mb="md">
            {persona.titles.map(title => (
              <Badge key={title} size="xs" variant="outline" color="gray">
                {title}
              </Badge>
            ))}
          </Group>

          {/* Key Themes as bars */}
          <Text size="xs" c="dimmed" fw={600} mb={4}>KEY PRIORITIES</Text>
          <Stack gap={6}>
            {persona.themes.slice(0, 3).map((theme, i) => (
              <Group key={theme} gap="xs" wrap="nowrap">
                <Text size="xs" w={100} style={{ flexShrink: 0 }}>{theme}</Text>
                <Progress
                  value={90 - i * 15}
                  size="sm"
                  color={color}
                  style={{ flex: 1 }}
                  radius="xl"
                />
              </Group>
            ))}
          </Stack>
        </Box>
      </Group>
    </Paper>
  );
}

// =============================================================================
// Industry Bar Chart
// =============================================================================

function IndustryBarChart() {
  const industries = [
    { name: 'Fashion / Apparel', value: 65, count: 70, icon: IconShirt, color: 'red' },
    { name: 'Retail E-commerce', value: 100, count: 650, icon: IconShoppingCart, color: 'blue' },
    { name: 'Grocery / Food', value: 35, count: 30, icon: IconApple, color: 'green' },
    { name: 'SaaS / Tech', value: 25, count: 36, icon: IconCode, color: 'cyan' },
    { name: 'B2B Commerce', value: 20, count: 30, icon: IconBuildingStore, color: 'violet' },
  ];

  return (
    <Stack gap="md">
      {industries.map(ind => {
        const Icon = ind.icon;
        return (
          <Box key={ind.name}>
            <Group justify="space-between" mb={4}>
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color={ind.color}>
                  <Icon size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500}>{ind.name}</Text>
              </Group>
              <Text size="sm" fw={700} c={ind.color}>{ind.count}</Text>
            </Group>
            <Progress value={ind.value} size="lg" color={ind.color} radius="xl" />
          </Box>
        );
      })}
    </Stack>
  );
}

// =============================================================================
// Geography Breakdown
// =============================================================================

function GeographyBreakdown() {
  const regions = [
    { name: 'North America', value: 39, flag: '🇺🇸' },
    { name: 'EMEA', value: 40, flag: '🇪🇺' },
    { name: 'APAC', value: 10, flag: '🌏' },
    { name: 'LATAM', value: 6, flag: '🌎' },
    { name: 'Other', value: 5, flag: '🌐' },
  ];

  return (
    <Stack gap="sm">
      {regions.map(region => (
        <Group key={region.name} gap="sm" wrap="nowrap">
          <Text size="lg">{region.flag}</Text>
          <Box style={{ flex: 1 }}>
            <Group justify="space-between" mb={2}>
              <Text size="sm">{region.name}</Text>
              <Text size="sm" fw={700}>{region.value}%</Text>
            </Group>
            <Progress value={region.value} size="md" color="teal" radius="xl" />
          </Box>
        </Group>
      ))}
    </Stack>
  );
}

// =============================================================================
// Company Size / Revenue
// =============================================================================

function CompanySizeBreakdown() {
  const sizes = [
    { label: 'Enterprise ($500M+)', value: 45, color: 'indigo' },
    { label: 'Mid-Market ($50-500M)', value: 35, color: 'blue' },
    { label: 'SMB (<$50M)', value: 20, color: 'cyan' },
  ];

  return (
    <Stack gap="md">
      <Group justify="center" gap="xl">
        {sizes.map(size => (
          <Stack key={size.label} align="center" gap={4}>
            <RingProgress
              size={100}
              thickness={10}
              roundCaps
              sections={[{ value: size.value, color: size.color }]}
              label={
                <Text ta="center" fw={700} size="lg">{size.value}%</Text>
              }
            />
            <Text size="xs" ta="center" maw={100}>{size.label}</Text>
          </Stack>
        ))}
      </Group>
    </Stack>
  );
}

// =============================================================================
// Evidence Stats
// =============================================================================

function EvidenceStats() {
  const stats = [
    { label: 'Customer Logos', value: 1306, color: 'blue', icon: IconUsers },
    { label: 'Documented Quotes', value: 379, color: 'violet', icon: IconQuote },
    { label: 'Case Studies', value: 82, color: 'orange', icon: IconTrendingUp },
    { label: 'Proof Points', value: 81, color: 'green', icon: IconTarget },
  ];

  return (
    <SimpleGrid cols={4} spacing="md">
      {stats.map(stat => {
        const Icon = stat.icon;
        return (
          <Paper key={stat.label} p="md" radius="md" bg={`${stat.color}.0`} ta="center">
            <ThemeIcon size="xl" radius="xl" color={stat.color} variant="light" mx="auto" mb="xs">
              <Icon size={24} />
            </ThemeIcon>
            <Text size="xl" fw={900} c={stat.color}>{stat.value.toLocaleString()}</Text>
            <Text size="xs" c="dimmed">{stat.label}</Text>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}

// =============================================================================
// Firmographics Panel
// =============================================================================

function FirmographicsPanel() {
  return (
    <SimpleGrid cols={2} spacing="lg">
      {/* Left: Industry */}
      <Box>
        <Group gap="xs" mb="md">
          <ThemeIcon size="sm" variant="light" color="teal">
            <IconBuildingStore size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>Industry Distribution</Text>
        </Group>
        <IndustryBarChart />
      </Box>

      {/* Right: Geography */}
      <Box>
        <Group gap="xs" mb="md">
          <ThemeIcon size="sm" variant="light" color="teal">
            <IconWorld size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>Geographic Distribution</Text>
        </Group>
        <GeographyBreakdown />
      </Box>
    </SimpleGrid>
  );
}

// =============================================================================
// Tech Platform Distribution
// =============================================================================

function TechPlatformPanel() {
  const platforms = [
    { name: 'Shopify', value: 29 },
    { name: 'Magento', value: 20 },
    { name: 'SAP Commerce', value: 9 },
    { name: 'SFCC', value: 7 },
    { name: 'Adobe AEM', value: 7 },
    { name: 'Commercetools', value: 6 },
  ];

  const competitors = [
    { name: 'Elasticsearch', value: 56, color: 'yellow' },
    { name: 'Solr', value: 23, color: 'orange' },
    { name: 'SearchSpring', value: 13, color: 'red' },
    { name: 'Klevu', value: 12, color: 'pink' },
  ];

  return (
    <SimpleGrid cols={2} spacing="lg">
      {/* Commerce Platforms */}
      <Box>
        <Group gap="xs" mb="md">
          <ThemeIcon size="sm" variant="light" color="blue">
            <IconDeviceDesktop size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>Commerce Platforms</Text>
        </Group>
        <Stack gap="xs">
          {platforms.map(p => (
            <Group key={p.name} gap="sm" wrap="nowrap">
              <Text size="xs" w={100}>{p.name}</Text>
              <Progress value={p.value * 3} size="sm" color="blue" style={{ flex: 1 }} radius="xl" />
              <Text size="xs" fw={600} w={30}>{p.value}</Text>
            </Group>
          ))}
        </Stack>
      </Box>

      {/* Competitors Displaced */}
      <Box>
        <Group gap="xs" mb="md">
          <ThemeIcon size="sm" variant="light" color="orange">
            <IconTarget size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>Competitors Displaced</Text>
        </Group>
        <Stack gap="xs">
          {competitors.map(c => (
            <Group key={c.name} gap="sm" wrap="nowrap">
              <Text size="xs" w={100}>{c.name}</Text>
              <Progress value={c.value} size="sm" color={c.color} style={{ flex: 1 }} radius="xl" />
              <Text size="xs" fw={600} w={30}>{c.value}</Text>
            </Group>
          ))}
        </Stack>
      </Box>
    </SimpleGrid>
  );
}

// =============================================================================
// Featured Quote Card
// =============================================================================

function QuoteCard({ quote, speaker, title, company }: {
  quote: string;
  speaker: string;
  title: string;
  company: string;
}) {
  return (
    <Paper p="md" radius="md" withBorder style={{ borderLeft: `4px solid ${INFOGRAPHIC_COLORS.primary}` }}>
      <Text size="sm" fs="italic" c="dark" mb="sm" lineClamp={3}>
        "{quote}"
      </Text>
      <Group gap="xs">
        <Avatar size="sm" color="teal" radius="xl">
          <IconUser size={14} />
        </Avatar>
        <Box>
          <Text size="xs" fw={600}>{speaker}</Text>
          <Text size="xs" c="dimmed">{title} • {company}</Text>
        </Box>
      </Group>
    </Paper>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ICPVisualStory() {
  // Get featured quotes
  const featuredQuotes = data.companies
    .filter(c => c.quotes.length > 0 && c.storyUrl)
    .flatMap(c => c.quotes.map(q => ({ ...q, company: c.company })))
    .slice(0, 3);

  return (
    <Stack gap="xl">
      {/* Slide 1: Evidence Foundation */}
      <Paper p="xl" radius="lg" withBorder shadow="sm">
        <SlideHeader
          title="Ideal Customer Profile (ICP) Infographics"
          subtitle="Data-derived from 1,306 customers across 82 case studies"
          icon={IconTarget}
        />
        <EvidenceStats />
      </Paper>

      {/* Slide 2: Buyer Personas */}
      <Paper p="xl" radius="lg" withBorder shadow="sm">
        <SlideHeader
          title="Buyer Personas"
          subtitle="Who makes the buying decision (derived from 379 quotes)"
          icon={IconUsers}
        />
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {personas.map((persona, i) => (
            <PersonaInfoCard key={persona.id} persona={persona} index={i} />
          ))}
        </SimpleGrid>
      </Paper>

      {/* Slide 3: Firmographics */}
      <Paper p="xl" radius="lg" withBorder shadow="sm">
        <SlideHeader
          title="Firmographics"
          subtitle="Company characteristics of ideal customers"
          icon={IconBuildingStore}
        />
        <FirmographicsPanel />

        <Divider my="xl" />

        {/* Company Size */}
        <Group gap="xs" mb="md">
          <ThemeIcon size="sm" variant="light" color="indigo">
            <IconCoin size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>Company Size (Revenue)</Text>
        </Group>
        <CompanySizeBreakdown />
      </Paper>

      {/* Slide 4: Technology Landscape */}
      <Paper p="xl" radius="lg" withBorder shadow="sm">
        <SlideHeader
          title="Technology Landscape"
          subtitle="Platforms used and competitors displaced"
          icon={IconDeviceDesktop}
        />
        <TechPlatformPanel />
      </Paper>

      {/* Slide 5: Voice of Customer */}
      <Paper p="xl" radius="lg" withBorder shadow="sm">
        <SlideHeader
          title="Voice of Customer"
          subtitle="What they say about Algolia"
          icon={IconQuote}
        />
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {featuredQuotes.map((q, i) => (
            <QuoteCard
              key={i}
              quote={q.text}
              speaker={q.speaker}
              title={q.title}
              company={q.company}
            />
          ))}
        </SimpleGrid>
      </Paper>

      {/* Slide 6: ICP Summary */}
      <Paper p="xl" radius="lg" withBorder shadow="sm" bg="teal.0">
        <SlideHeader
          title="ICP Summary"
          subtitle="Primary target segments with HIGH confidence"
          icon={IconChartBar}
        />
        <SimpleGrid cols={3} spacing="lg">
          <Paper p="lg" radius="md" withBorder bg="white">
            <Badge color="green" variant="filled" mb="sm">PRIMARY</Badge>
            <Text fw={700} mb="xs">Target Industries</Text>
            <Stack gap={4}>
              <Text size="sm">• Fashion / Apparel</Text>
              <Text size="sm">• Grocery / Food</Text>
              <Text size="sm">• Retail E-commerce</Text>
            </Stack>
          </Paper>
          <Paper p="lg" radius="md" withBorder bg="white">
            <Badge color="yellow" variant="filled" mb="sm">SECONDARY</Badge>
            <Text fw={700} mb="xs">Explore Segments</Text>
            <Stack gap={4}>
              <Text size="sm">• SaaS / Tech</Text>
              <Text size="sm">• B2B E-commerce</Text>
              <Text size="sm">• Media / Publishing</Text>
            </Stack>
          </Paper>
          <Paper p="lg" radius="md" withBorder bg="white">
            <Badge color="blue" variant="filled" mb="sm">GEOGRAPHY</Badge>
            <Text fw={700} mb="xs">Top Regions</Text>
            <Stack gap={4}>
              <Text size="sm">• US (33%)</Text>
              <Text size="sm">• UK (12%)</Text>
              <Text size="sm">• Netherlands (6%)</Text>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}
