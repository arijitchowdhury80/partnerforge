/**
 * ICPScorecard - Right sidebar showing Best/Worst segment comparison
 *
 * Shows DIFFERENT data than the hero:
 * - Evidence Score (computed)
 * - Featured Quote (from that segment)
 * - Key Buyer Persona
 * - Case Study Link
 *
 * NO raw counts that duplicate the Evidence Funnel hero.
 */

import { Box, Text, Stack, Group, Badge, Button, Anchor } from '@mantine/core';
import { IconArrowRight, IconTrendingUp, IconTrendingDown, IconQuote, IconExternalLink } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { industries, personas } from '@/data/icpData';

// Find best and worst segments
const sortedByEvidence = [...industries].sort((a, b) => {
  const scoreA = (a.proofPoints * 4) + (a.stories * 3) + (a.quotes * 2) + (a.logos * 0.1);
  const scoreB = (b.proofPoints * 4) + (b.stories * 3) + (b.quotes * 2) + (b.logos * 0.1);
  return scoreB - scoreA;
});

const bestSegment = sortedByEvidence[0];
const weakestSegment = sortedByEvidence[sortedByEvidence.length - 1];

// Compute scores
function computeScore(industry: typeof bestSegment): number {
  const score = (industry.proofPoints * 4) + (industry.stories * 3) + (industry.quotes * 2) + (industry.logos * 0.1);
  return Math.min(Math.round((score / 300) * 100), 100);
}

// Sample quotes by segment (would come from database in production)
const segmentQuotes: Record<string, { quote: string; speaker: string; company: string; storyUrl?: string }> = {
  'Fashion/Apparel': {
    quote: 'Speed of search request, speed of execution. This is why our attention turned to Algolia.',
    speaker: 'Pascal Sardella',
    company: 'TAG Heuer',
    storyUrl: 'https://www.algolia.com/customers/tag-heuer/',
  },
  'Grocery/Food': {
    quote: 'Algolia helped us deliver relevant results even with complex product catalogs.',
    speaker: 'E-Commerce Director',
    company: 'Major Grocery Chain',
  },
  'Retail E-commerce': {
    quote: 'Delivering a fast, relevant experience to our online customers is a top priority.',
    speaker: 'Digital Team',
    company: 'Under Armour',
    storyUrl: 'https://www.algolia.com/customers/under-armour/',
  },
  'Media/Publishing': {
    quote: 'Search needed to handle millions of articles across decades of content.',
    speaker: 'CTO',
    company: 'Publishing Company',
  },
};

export function ICPScorecard() {
  const navigate = useNavigate();

  const bestQuote = segmentQuotes[bestSegment.industry] || segmentQuotes['Fashion/Apparel'];
  const topPersona = personas[0]; // Technical Decision Maker

  return (
    <Box
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        height: '100%',
      }}
    >
      {/* Header */}
      <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Text size="lg" fw={700} c="white">ICP Insights</Text>
      </Box>

      {/* Best Segment */}
      <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Group justify="space-between" mb="md">
          <Text size="sm" fw={600} c="gray.4" tt="uppercase">Strongest Fit</Text>
          <Badge size="lg" color="green" variant="filled">
            {bestSegment.industry}
          </Badge>
        </Group>

        {/* Evidence Score - Big and prominent */}
        <Group gap="xs" mb="lg">
          <IconTrendingUp size={20} color="#10b981" />
          <Text size="xl" fw={700} c="green">{computeScore(bestSegment)}%</Text>
          <Text size="sm" c="gray.4">evidence strength</Text>
        </Group>

        {/* Featured Quote */}
        <Box
          p="sm"
          mb="md"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 8,
            borderLeft: '3px solid #10b981',
          }}
        >
          <Group gap="xs" mb="xs">
            <IconQuote size={16} color="#10b981" />
            <Text size="xs" fw={600} c="green">Featured Quote</Text>
          </Group>
          <Text size="sm" c="gray.3" fs="italic" mb="xs">
            "{bestQuote.quote}"
          </Text>
          <Text size="xs" c="gray.5">
            — {bestQuote.speaker}, {bestQuote.company}
          </Text>
        </Box>

        {/* Case Study Link */}
        {bestQuote.storyUrl && (
          <Anchor
            href={bestQuote.storyUrl}
            target="_blank"
            size="sm"
            c="blue"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Read {bestQuote.company} case study
            <IconExternalLink size={14} />
          </Anchor>
        )}
      </Box>

      {/* Weakest Segment */}
      <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Group justify="space-between" mb="md">
          <Text size="sm" fw={600} c="gray.4" tt="uppercase">Weakest Fit</Text>
          <Badge size="lg" color="gray" variant="light">
            {weakestSegment.industry}
          </Badge>
        </Group>

        {/* Evidence Score */}
        <Group gap="xs" mb="md">
          <IconTrendingDown size={20} color="#64748b" />
          <Text size="xl" fw={700} c="gray.4">{computeScore(weakestSegment)}%</Text>
          <Text size="sm" c="gray.5">evidence strength</Text>
        </Group>

        {/* Gap Analysis */}
        <Box
          p="sm"
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: 8,
            borderLeft: '3px solid #f59e0b',
          }}
        >
          <Text size="sm" fw={600} c="yellow" mb="xs">Evidence Gap</Text>
          <Text size="sm" c="gray.4">
            {weakestSegment.proofPoints === 0
              ? 'No quantified proof points yet. Need ROI metrics and case studies.'
              : `Only ${weakestSegment.proofPoints} proof points. Need more success stories.`
            }
          </Text>
        </Box>
      </Box>

      {/* Key Buyer Insight */}
      <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Text size="sm" fw={600} c="gray.4" tt="uppercase" mb="md">Primary Buyer</Text>
        <Text size="lg" fw={600} c="white" mb="xs">{topPersona.name}</Text>
        <Text size="sm" c="gray.4" mb="sm">
          {topPersona.titles.slice(0, 2).join(', ')}
        </Text>
        <Group gap="xs" wrap="wrap">
          {topPersona.themes.slice(0, 3).map((theme) => (
            <Badge key={theme} size="sm" variant="light" color="blue">
              {theme}
            </Badge>
          ))}
        </Group>
      </Box>

      {/* CTA */}
      <Box p="md">
        <Button
          fullWidth
          size="md"
          variant="gradient"
          gradient={{ from: '#003DFF', to: '#5468FF' }}
          rightSection={<IconArrowRight size={18} />}
          onClick={() => navigate('/galaxy')}
        >
          Find Targets in Galaxy
        </Button>
      </Box>
    </Box>
  );
}

export default ICPScorecard;
