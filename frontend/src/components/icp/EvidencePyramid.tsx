/**
 * EvidencePyramid - Interactive SVG pyramid showing ICP derivation methodology
 * Bottom to top: Logos → Proof Points → Stories → Quotes → ICP
 */

import { useState } from 'react';
import { Box, Paper, Text, Group, Stack, Badge, Title } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { IconUsers, IconChartBar, IconBook, IconQuote, IconTarget } from '@tabler/icons-react';
import { evidenceLevels, type EvidenceLevel } from '@/data/icpData';

const tierIcons = {
  logos: IconUsers,
  proofpoints: IconChartBar,
  stories: IconBook,
  quotes: IconQuote,
  icp: IconTarget,
};

interface PyramidTierProps {
  tier: EvidenceLevel;
  index: number;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  totalTiers: number;
}

function PyramidTier({ tier, index, isSelected, onSelect, totalTiers }: PyramidTierProps) {
  const Icon = tierIcons[tier.id as keyof typeof tierIcons];

  // Calculate tier dimensions (wider at bottom, narrower at top)
  const baseWidth = 400;
  const topWidth = 120;
  const tierHeight = 60;
  const widthStep = (baseWidth - topWidth) / (totalTiers - 1);
  const tierWidth = baseWidth - (index * widthStep);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      style={{
        display: 'flex',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(isSelected ? null : tier.id)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Box
        style={{
          width: tierWidth,
          height: tierHeight,
          background: isSelected
            ? `linear-gradient(135deg, ${tier.color}, ${tier.color}dd)`
            : `linear-gradient(135deg, ${tier.color}20, ${tier.color}40)`,
          borderRadius: index === totalTiers - 1 ? '12px 12px 4px 4px' : '4px',
          border: `2px solid ${tier.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'all 0.3s ease',
          boxShadow: isSelected
            ? `0 4px 20px ${tier.color}40`
            : '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <Group gap="sm">
          <Icon
            size={24}
            color={isSelected ? '#fff' : tier.color}
            style={{ transition: 'color 0.3s ease' }}
          />
          <Text
            fw={600}
            size="sm"
            c={isSelected ? 'white' : 'dark'}
            style={{ transition: 'color 0.3s ease' }}
          >
            {tier.name}
          </Text>
          <Badge
            size="lg"
            variant={isSelected ? 'white' : 'light'}
            color={isSelected ? 'white' : tier.color}
            style={{
              backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : undefined,
              color: isSelected ? 'white' : tier.color,
            }}
          >
            {tier.count.toLocaleString()}
          </Badge>
        </Group>
      </Box>
    </motion.div>
  );
}

interface TierDetailProps {
  tier: EvidenceLevel;
}

function TierDetail({ tier }: TierDetailProps) {
  const Icon = tierIcons[tier.id as keyof typeof tierIcons];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Paper
        p="lg"
        radius="md"
        withBorder
        style={{
          borderColor: tier.color,
          borderWidth: 2,
          background: `linear-gradient(135deg, ${tier.color}08, ${tier.color}15)`,
        }}
      >
        <Group gap="md" mb="sm">
          <Box
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: tier.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={28} color="white" />
          </Box>
          <Box>
            <Text fw={700} size="lg">{tier.name}</Text>
            <Text c="dimmed" size="sm">{tier.description}</Text>
          </Box>
        </Group>

        <Group gap="lg" mt="md">
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Records</Text>
            <Text fw={700} size="xl" c={tier.color}>{tier.count.toLocaleString()}</Text>
          </Box>

          {tier.id === 'logos' && (
            <>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Top Industry</Text>
                <Text fw={600}>E-Commerce (50%+)</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Top Region</Text>
                <Text fw={600}>US & EMEA</Text>
              </Box>
            </>
          )}

          {tier.id === 'proofpoints' && (
            <>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Fashion</Text>
                <Text fw={600}>65% (53 results)</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Grocery</Text>
                <Text fw={600}>35% (28 results)</Text>
              </Box>
            </>
          )}

          {tier.id === 'stories' && (
            <>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Fashion</Text>
                <Text fw={600}>15 stories</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Retail</Text>
                <Text fw={600}>17 stories</Text>
              </Box>
            </>
          )}

          {tier.id === 'quotes' && (
            <>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>C-Level</Text>
                <Text fw={600}>30% (112)</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Managers</Text>
                <Text fw={600}>26% (98)</Text>
              </Box>
            </>
          )}

          {tier.id === 'icp' && (
            <>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Primary</Text>
                <Text fw={600}>Fashion, Grocery, Retail</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Confidence</Text>
                <Badge color="green" variant="light">HIGH</Badge>
              </Box>
            </>
          )}
        </Group>
      </Paper>
    </motion.div>
  );
}

export function EvidencePyramid() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  // Reverse to show pyramid bottom-up (logos at bottom, ICP at top)
  const tiers = [...evidenceLevels].reverse();
  const selectedTierData = evidenceLevels.find(t => t.id === selectedTier);

  return (
    <Box>
      <Title order={3} ta="center" mb="xs">The Evidence Pyramid</Title>
      <Text c="dimmed" ta="center" mb="xl" size="sm">
        Click each tier to explore the data behind our ICP
      </Text>

      <Group align="flex-start" gap="xl" wrap="nowrap">
        {/* Pyramid */}
        <Stack gap={4} style={{ flex: '0 0 auto' }}>
          {tiers.map((tier, index) => (
            <PyramidTier
              key={tier.id}
              tier={tier}
              index={index}
              isSelected={selectedTier === tier.id}
              onSelect={setSelectedTier}
              totalTiers={tiers.length}
            />
          ))}
        </Stack>

        {/* Detail Panel */}
        <Box style={{ flex: 1, minWidth: 300 }}>
          <AnimatePresence mode="wait">
            {selectedTierData && (
              <TierDetail key={selectedTierData.id} tier={selectedTierData} />
            )}
          </AnimatePresence>

          {!selectedTierData && (
            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                borderStyle: 'dashed',
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
              }}
            >
              <Text c="dimmed" ta="center" size="sm">
                Click a tier to see details
              </Text>
            </Paper>
          )}
        </Box>
      </Group>
    </Box>
  );
}
