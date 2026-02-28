/**
 * ICPLandingPage - The entry point to PartnerForge
 * Tells the visual story of Algolia's data-derived ICP
 *
 * Features:
 * - Cascading drill-down explorer: Industries → Companies → Evidence
 * - Click any industry to expand companies below
 * - Click any company to see quotes, story link, and evidence inline
 * - External links to actual algolia.com customer stories
 */

import { Container, Title, Text, Group, Stack, Paper, Button, SimpleGrid, Box, Badge, Divider, Tabs } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IconArrowRight, IconDatabase, IconTarget, IconUsers, IconTrendingUp, IconBrandAlgolia, IconSparkles, IconList, IconChartPie } from '@tabler/icons-react';
import { COLORS } from '@/lib/constants';
import { EvidencePyramid, PersonaCard, IndustryDistribution, TechPlatformChart, CompetitorChart, ICPConfidenceMatrix, ICPCascade, ICPVisualStory } from '@/components/icp';
import { personas, icpSummary } from '@/data/icpData';

// Hero KPI Card component
function HeroKPICard({ label, value, icon: Icon, color, delay }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Paper
        p="md"
        radius="lg"
        withBorder
        style={{
          borderColor: `${color}40`,
          background: `linear-gradient(135deg, white, ${color}08)`,
          textAlign: 'center',
        }}
      >
        <Box
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: `0 4px 12px ${color}40`,
          }}
        >
          <Icon size={24} color="white" />
        </Box>
        <Text fw={800} size="xl" style={{ color }}>
          {value.toLocaleString()}
        </Text>
        <Text c="dimmed" size="sm" fw={500}>
          {label}
        </Text>
      </Paper>
    </motion.div>
  );
}

export function ICPLandingPage() {
  const navigate = useNavigate();

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, white 100%)',
      }}
    >
      <Container size="xl" py="xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Stack align="center" gap="xs" mb="xl">
            <Group gap="sm">
              <IconBrandAlgolia size={40} color={COLORS.ALGOLIA_NEBULA_BLUE} />
              <Title
                order={1}
                style={{
                  background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE}, ${COLORS.ALGOLIA_PURPLE})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Data-Derived ICP
              </Title>
            </Group>
            <Text c="dimmed" size="lg" ta="center" maw={600}>
              Algolia's Ideal Customer Profile, derived from <strong>1,306 customers</strong>,{' '}
              <strong>379 quotes</strong>, and <strong>81 quantified proof points</strong>
            </Text>
          </Stack>
        </motion.div>

        {/* Hero KPIs */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
          <HeroKPICard
            label="Customer Logos"
            value={1306}
            icon={IconUsers}
            color="#003DFF"
            delay={0.1}
          />
          <HeroKPICard
            label="Customer Quotes"
            value={379}
            icon={IconDatabase}
            color="#8b5cf6"
            delay={0.2}
          />
          <HeroKPICard
            label="Success Stories"
            value={82}
            icon={IconTrendingUp}
            color="#f59e0b"
            delay={0.3}
          />
          <HeroKPICard
            label="Proof Points"
            value={81}
            icon={IconTarget}
            color="#10b981"
            delay={0.4}
          />
        </SimpleGrid>

        <Divider my="xl" />

        {/* Interactive ICP Explorer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Paper p="xl" radius="lg" withBorder mb="xl">
            <Tabs defaultValue="visual">
              <Tabs.List mb="md">
                <Tabs.Tab value="visual" leftSection={<IconSparkles size={16} />}>
                  Visual Story
                </Tabs.Tab>
                <Tabs.Tab value="explorer" leftSection={<IconList size={16} />}>
                  Deep Dive
                </Tabs.Tab>
                <Tabs.Tab value="pyramid" leftSection={<IconChartPie size={16} />}>
                  Evidence Pyramid
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="visual">
                <ICPVisualStory />
              </Tabs.Panel>

              <Tabs.Panel value="explorer">
                <ICPCascade />
              </Tabs.Panel>

              <Tabs.Panel value="pyramid" pt="md">
                <EvidencePyramid />
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </motion.div>

        {/* Primary ICP Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Title order={2} mb="xs">Primary ICP Segments</Title>
          <Text c="dimmed" mb="lg">
            HIGH confidence segments with evidence across all 4 levels
          </Text>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
            <IndustryDistribution />
            <ICPConfidenceMatrix />
          </SimpleGrid>
        </motion.div>

        {/* Tech & Competitors Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
            <TechPlatformChart />
            <CompetitorChart />
          </SimpleGrid>
        </motion.div>

        <Divider my="xl" />

        {/* Buyer Personas Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Title order={2} mb="xs">Buyer Personas</Title>
          <Text c="dimmed" mb="lg">
            Derived from {personas.reduce((sum, p) => sum + Math.round(379 * p.percentage / 100), 0)} customer quotes
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
            {personas.map((persona, index) => (
              <PersonaCard key={persona.id} persona={persona} index={index} />
            ))}
          </SimpleGrid>
        </motion.div>

        <Divider my="xl" />

        {/* ICP Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <Paper
            p="xl"
            radius="lg"
            withBorder
            style={{
              borderColor: `${COLORS.ALGOLIA_NEBULA_BLUE}40`,
              background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE}05, ${COLORS.ALGOLIA_PURPLE}08)`,
            }}
            mb="xl"
          >
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
              {/* Primary ICP */}
              <Box>
                <Group gap="xs" mb="sm">
                  <Badge color="green" variant="filled" size="lg">PRIMARY</Badge>
                  <Badge color="green" variant="light">HIGH CONFIDENCE</Badge>
                </Group>
                <Text fw={600} mb="xs">Target Segments</Text>
                <Stack gap={4}>
                  {icpSummary.primary.segments.map(seg => (
                    <Text key={seg} size="sm">• {seg}</Text>
                  ))}
                </Stack>
              </Box>

              {/* Secondary ICP */}
              <Box>
                <Group gap="xs" mb="sm">
                  <Badge color="yellow" variant="filled" size="lg">SECONDARY</Badge>
                  <Badge color="yellow" variant="light">MEDIUM CONFIDENCE</Badge>
                </Group>
                <Text fw={600} mb="xs">Explore Segments</Text>
                <Stack gap={4}>
                  {icpSummary.secondary.segments.map(seg => (
                    <Text key={seg} size="sm">• {seg}</Text>
                  ))}
                </Stack>
                <Text size="xs" c="dimmed" mt="xs">
                  Gap: Need more proof points
                </Text>
              </Box>

              {/* Geography */}
              <Box>
                <Group gap="xs" mb="sm">
                  <Badge color="blue" variant="filled" size="lg">GEOGRAPHY</Badge>
                </Group>
                <Text fw={600} mb="xs">Top Regions</Text>
                <Stack gap={4}>
                  {icpSummary.geography.regions.map(reg => (
                    <Text key={reg} size="sm">• {reg}</Text>
                  ))}
                </Stack>
              </Box>
            </SimpleGrid>
          </Paper>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Stack align="center" gap="md">
            <Button
              size="xl"
              rightSection={<IconArrowRight size={20} />}
              onClick={() => navigate('/dashboard')}
              style={{
                background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE}, ${COLORS.ALGOLIA_PURPLE})`,
              }}
            >
              Enter Dashboard
            </Button>
            <Text c="dimmed" size="sm">
              Apply this ICP to find displacement opportunities
            </Text>
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
}
