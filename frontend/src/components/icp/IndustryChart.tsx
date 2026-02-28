/**
 * IndustryChart - Shows industry distribution and confidence levels
 */

import { Paper, Text, Group, Stack, Badge, Box, Progress, SimpleGrid } from '@mantine/core';
import { motion } from 'framer-motion';
import { IconTrendingUp, IconCheck, IconAlertTriangle, IconX } from '@tabler/icons-react';
import { industries, techPlatforms, competitors } from '@/data/icpData';

const confidenceColors = {
  HIGH: '#10b981',
  MEDIUM: '#f59e0b',
  LOW: '#64748b',
};

const confidenceIcons = {
  HIGH: IconCheck,
  MEDIUM: IconAlertTriangle,
  LOW: IconX,
};

export function IndustryDistribution() {
  // Sort by proof points
  const sortedIndustries = [...industries].sort((a, b) => b.proofPoints - a.proofPoints);
  const maxProofPoints = Math.max(...industries.map(i => i.proofPoints));

  return (
    <Paper p="lg" radius="lg" withBorder>
      <Text fw={700} size="lg" mb="xs">Primary ICP Segments</Text>
      <Text c="dimmed" size="sm" mb="lg">
        Industries with strongest proof point evidence
      </Text>

      <Stack gap="sm">
        {sortedIndustries.slice(0, 4).map((industry, index) => {
          const Icon = confidenceIcons[industry.confidence];
          return (
            <motion.div
              key={industry.industry}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <Text fw={600} size="sm">{industry.industry}</Text>
                  <Badge
                    size="xs"
                    variant="light"
                    color={industry.confidence === 'HIGH' ? 'green' : industry.confidence === 'MEDIUM' ? 'yellow' : 'gray'}
                    leftSection={<Icon size={10} />}
                  >
                    {industry.confidence}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {industry.proofPoints} proof points
                </Text>
              </Group>
              <Progress
                value={maxProofPoints > 0 ? (industry.proofPoints / maxProofPoints) * 100 : 0}
                color={confidenceColors[industry.confidence]}
                size="lg"
                radius="xl"
              />
              <Group gap="lg" mt={4}>
                <Text size="xs" c="dimmed">{industry.stories} stories</Text>
                <Text size="xs" c="dimmed">{industry.quotes} quotes</Text>
                <Text size="xs" c="dimmed">{industry.logos} logos</Text>
              </Group>
            </motion.div>
          );
        })}
      </Stack>
    </Paper>
  );
}

export function TechPlatformChart() {
  const maxCount = Math.max(...techPlatforms.map(t => t.count));

  return (
    <Paper p="lg" radius="lg" withBorder>
      <Text fw={700} size="lg" mb="xs">Tech Platform Distribution</Text>
      <Text c="dimmed" size="sm" mb="lg">
        Partner technologies in customer base
      </Text>

      <Stack gap="xs">
        {techPlatforms.map((platform, index) => (
          <motion.div
            key={platform.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Group justify="space-between" mb={2}>
              <Group gap="xs">
                <Text fw={500} size="sm">{platform.name}</Text>
                <Badge size="xs" variant="outline" color="blue">
                  {platform.category}
                </Badge>
              </Group>
              <Text size="sm" fw={600}>{platform.count}</Text>
            </Group>
            <Progress
              value={(platform.count / maxCount) * 100}
              color={platform.category === 'Commerce' ? 'blue' : 'violet'}
              size="sm"
              radius="xl"
            />
          </motion.div>
        ))}
      </Stack>
    </Paper>
  );
}

export function CompetitorChart() {
  const maxCount = Math.max(...competitors.map(c => c.count));

  return (
    <Paper p="lg" radius="lg" withBorder>
      <Text fw={700} size="lg" mb="xs">Competitors Displaced</Text>
      <Text c="dimmed" size="sm" mb="lg">
        Search providers replaced by Algolia
      </Text>

      <Stack gap="xs">
        {competitors.map((competitor, index) => (
          <motion.div
            key={competitor.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Group justify="space-between" mb={2}>
              <Text fw={500} size="sm">{competitor.name}</Text>
              <Text size="sm" fw={600} c="red.6">{competitor.count}</Text>
            </Group>
            <Progress
              value={(competitor.count / maxCount) * 100}
              color="red"
              size="sm"
              radius="xl"
            />
          </motion.div>
        ))}
      </Stack>
    </Paper>
  );
}

export function ICPConfidenceMatrix() {
  return (
    <Paper p="lg" radius="lg" withBorder>
      <Text fw={700} size="lg" mb="xs">ICP Confidence Matrix</Text>
      <Text c="dimmed" size="sm" mb="lg">
        Evidence strength across dimensions
      </Text>

      <SimpleGrid cols={4} spacing="xs">
        {/* Header */}
        <Box />
        <Text size="xs" fw={600} ta="center">Logos</Text>
        <Text size="xs" fw={600} ta="center">Quotes</Text>
        <Text size="xs" fw={600} ta="center">Proof Pts</Text>

        {/* Rows */}
        {industries.slice(0, 5).map((industry) => (
          <>
            <Text size="xs" fw={500} key={`label-${industry.industry}`}>
              {industry.industry.split('/')[0]}
            </Text>
            <Box key={`logos-${industry.industry}`} ta="center">
              <Badge
                size="sm"
                color={industry.logos > 50 ? 'green' : industry.logos > 20 ? 'yellow' : 'gray'}
                variant="light"
              >
                {industry.logos > 50 ? '+++' : industry.logos > 20 ? '++' : '+'}
              </Badge>
            </Box>
            <Box key={`quotes-${industry.industry}`} ta="center">
              <Badge
                size="sm"
                color={industry.quotes > 100 ? 'green' : industry.quotes > 30 ? 'yellow' : 'gray'}
                variant="light"
              >
                {industry.quotes > 100 ? '+++' : industry.quotes > 30 ? '++' : '+'}
              </Badge>
            </Box>
            <Box key={`proof-${industry.industry}`} ta="center">
              <Badge
                size="sm"
                color={industry.proofPoints > 20 ? 'green' : industry.proofPoints > 0 ? 'yellow' : 'gray'}
                variant="light"
              >
                {industry.proofPoints > 20 ? '+++' : industry.proofPoints > 0 ? '++' : '-'}
              </Badge>
            </Box>
          </>
        ))}
      </SimpleGrid>

      <Group mt="md" gap="lg">
        <Group gap={4}>
          <Badge size="xs" color="green" variant="light">+++</Badge>
          <Text size="xs" c="dimmed">Strong</Text>
        </Group>
        <Group gap={4}>
          <Badge size="xs" color="yellow" variant="light">++</Badge>
          <Text size="xs" c="dimmed">Moderate</Text>
        </Group>
        <Group gap={4}>
          <Badge size="xs" color="gray" variant="light">+</Badge>
          <Text size="xs" c="dimmed">Weak</Text>
        </Group>
      </Group>
    </Paper>
  );
}
