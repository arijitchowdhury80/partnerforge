/**
 * CompanyDetailDrawer - Shows full evidence for a selected company
 * Includes quotes with attribution, story link, metrics, and features
 */

import { Drawer, Stack, Group, Text, Badge, Button, Paper, Box, Divider, ActionIcon, Tooltip } from '@mantine/core';
import { IconExternalLink, IconQuote, IconUser, IconMapPin, IconBriefcase, IconX, IconCopy, IconCheck } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { CustomerEvidence } from '@/data/customerEvidenceTypes';
import { COLORS } from '@/lib/constants';

interface CompanyDetailDrawerProps {
  company: CustomerEvidence | null;
  onClose: () => void;
}

function QuoteCard({ quote, index }: { quote: CustomerEvidence['quotes'][0]; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${quote.text}" — ${quote.speaker}, ${quote.title}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Paper
        p="md"
        radius="md"
        withBorder
        style={{
          borderLeft: `4px solid ${COLORS.ALGOLIA_PURPLE}`,
          background: `linear-gradient(135deg, white, ${COLORS.ALGOLIA_PURPLE}05)`,
        }}
      >
        <Group justify="space-between" align="flex-start" mb="xs">
          <Group gap="xs">
            <IconQuote size={16} color={COLORS.ALGOLIA_PURPLE} />
            <Badge size="xs" variant="light" color="violet">
              {quote.source}
            </Badge>
          </Group>
          <Tooltip label={copied ? 'Copied!' : 'Copy quote'}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleCopy}>
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </ActionIcon>
          </Tooltip>
        </Group>

        <Text size="sm" fs="italic" c="dark" mb="sm">
          "{quote.text}"
        </Text>

        <Group gap="xs">
          <IconUser size={14} color="#64748b" />
          <Text size="xs" fw={600}>{quote.speaker}</Text>
          <Text size="xs" c="dimmed">•</Text>
          <Text size="xs" c="dimmed">{quote.title}</Text>
        </Group>
      </Paper>
    </motion.div>
  );
}

export function CompanyDetailDrawer({ company, onClose }: CompanyDetailDrawerProps) {
  if (!company) return null;

  return (
    <Drawer
      opened={!!company}
      onClose={onClose}
      position="right"
      size="lg"
      title={null}
      withCloseButton={false}
      styles={{
        body: { padding: 0 },
        header: { display: 'none' },
      }}
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <Box
            p="lg"
            style={{
              background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE}, ${COLORS.ALGOLIA_PURPLE})`,
              color: 'white',
            }}
          >
            <Group justify="space-between" mb="md">
              <Text fw={800} size="xl">{company.company}</Text>
              <ActionIcon
                variant="subtle"
                color="white"
                size="lg"
                onClick={onClose}
              >
                <IconX size={20} />
              </ActionIcon>
            </Group>

            <Group gap="lg">
              {company.industry && (
                <Group gap={4}>
                  <IconBriefcase size={14} />
                  <Text size="sm">{company.industry}</Text>
                </Group>
              )}
              {company.country && (
                <Group gap={4}>
                  <IconMapPin size={14} />
                  <Text size="sm">{company.country}</Text>
                </Group>
              )}
            </Group>

            {company.useCase && (
              <Badge mt="sm" variant="white" color="white" size="md">
                {company.useCase}
              </Badge>
            )}
          </Box>

          <Stack p="lg" gap="lg">
            {/* Story Link */}
            {company.storyUrl && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Button
                  component="a"
                  href={company.storyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  size="lg"
                  rightSection={<IconExternalLink size={18} />}
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE}, ${COLORS.ALGOLIA_PURPLE})`,
                  }}
                >
                  View Customer Story on Algolia.com
                </Button>
                <Text size="xs" c="dimmed" ta="center" mt={4}>
                  {company.storyUrl}
                </Text>
              </motion.div>
            )}

            {/* Features Used */}
            {company.featuresUsed.length > 0 && (
              <Box>
                <Text size="sm" fw={600} c="dimmed" mb="xs">
                  ALGOLIA FEATURES USED
                </Text>
                <Group gap="xs">
                  {company.featuresUsed.map((feature) => (
                    <Badge key={feature} variant="light" color="blue">
                      {feature}
                    </Badge>
                  ))}
                </Group>
              </Box>
            )}

            <Divider />

            {/* Quotes */}
            <Box>
              <Group justify="space-between" mb="md">
                <Text size="sm" fw={600} c="dimmed">
                  CUSTOMER QUOTES ({company.quotes.length})
                </Text>
              </Group>

              {company.quotes.length > 0 ? (
                <Stack gap="md">
                  {company.quotes.map((quote, index) => (
                    <QuoteCard key={index} quote={quote} index={index} />
                  ))}
                </Stack>
              ) : (
                <Paper p="lg" radius="md" withBorder style={{ borderStyle: 'dashed' }}>
                  <Text c="dimmed" ta="center" size="sm">
                    No attributed quotes available for this company yet.
                  </Text>
                </Paper>
              )}
            </Box>

            {/* Metrics (if any) */}
            {company.metrics && company.metrics.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Text size="sm" fw={600} c="dimmed" mb="xs">
                    KEY METRICS
                  </Text>
                  <Stack gap="xs">
                    {company.metrics.map((metric, index) => (
                      <Badge key={index} variant="light" color="green" size="lg">
                        {metric}
                      </Badge>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        </motion.div>
      </AnimatePresence>
    </Drawer>
  );
}
