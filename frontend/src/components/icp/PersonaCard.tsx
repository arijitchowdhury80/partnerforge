/**
 * PersonaCard - Displays a buyer persona derived from quote data
 */

import { Paper, Text, Group, Stack, Badge, Box, RingProgress, Blockquote } from '@mantine/core';
import { motion } from 'framer-motion';
import { IconUser, IconQuote } from '@tabler/icons-react';
import type { BuyerPersona } from '@/data/icpData';

interface PersonaCardProps {
  persona: BuyerPersona;
  index: number;
}

export function PersonaCard({ persona, index }: PersonaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Paper
        p="lg"
        radius="lg"
        withBorder
        style={{
          height: '100%',
          borderColor: `${persona.color}40`,
          background: `linear-gradient(135deg, white, ${persona.color}08)`,
          transition: 'all 0.3s ease',
        }}
      >
        <Stack gap="md">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Group gap="md">
              <Box
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${persona.color}, ${persona.color}cc)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 12px ${persona.color}40`,
                }}
              >
                <IconUser size={24} color="white" />
              </Box>
              <Box>
                <Text fw={700} size="md">{persona.name}</Text>
                <Text c="dimmed" size="xs">from {persona.percentage}% of quotes</Text>
              </Box>
            </Group>

            <RingProgress
              size={50}
              thickness={4}
              roundCaps
              sections={[{ value: persona.percentage, color: persona.color }]}
              label={
                <Text ta="center" fw={700} size="xs">
                  {persona.percentage}%
                </Text>
              }
            />
          </Group>

          {/* Titles */}
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
              Typical Titles
            </Text>
            <Group gap={4}>
              {persona.titles.map((title) => (
                <Badge
                  key={title}
                  variant="light"
                  color="gray"
                  size="sm"
                >
                  {title}
                </Badge>
              ))}
            </Group>
          </Box>

          {/* Themes */}
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
              Key Themes
            </Text>
            <Group gap={4}>
              {persona.themes.map((theme) => (
                <Badge
                  key={theme}
                  variant="outline"
                  color={persona.color}
                  size="sm"
                >
                  {theme}
                </Badge>
              ))}
            </Group>
          </Box>

          {/* Quote */}
          <Box
            style={{
              background: `${persona.color}10`,
              borderRadius: 8,
              padding: 12,
              borderLeft: `3px solid ${persona.color}`,
            }}
          >
            <Group gap={4} mb={4}>
              <IconQuote size={14} color={persona.color} />
              <Text size="xs" c="dimmed" fw={600}>Sample Quote</Text>
            </Group>
            <Text size="sm" fs="italic" c="dark">
              "{persona.sampleQuote}"
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              — {persona.sampleSpeaker}
            </Text>
          </Box>
        </Stack>
      </Paper>
    </motion.div>
  );
}
