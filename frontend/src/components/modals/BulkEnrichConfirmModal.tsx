/**
 * BulkEnrichConfirmModal Component
 *
 * Confirms bulk enrichment with summary of selected companies,
 * breakdown of new vs re-enrich, and estimated time/API calls.
 */

import {
  Modal,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  Box,
  Progress,
  SimpleGrid,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBolt,
  IconClock,
  IconApi,
  IconRefresh,
  IconSparkles,
} from '@tabler/icons-react';
import { COLORS } from '@/lib/constants';
import type { Company } from '@/types';

export interface BulkEnrichConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (companies: Company[]) => void;
  companies: Company[];
  loading?: boolean;
}

// Estimate ~3 API calls per company (SimilarWeb, BuiltWith, potentially Yahoo Finance)
const API_CALLS_PER_COMPANY = 3;
// Estimate ~5 seconds per company for enrichment
const SECONDS_PER_COMPANY = 5;

export function BulkEnrichConfirmModal({
  opened,
  onClose,
  onConfirm,
  companies,
  loading = false,
}: BulkEnrichConfirmModalProps) {
  const totalCount = companies.length;

  // Calculate new vs re-enrich breakdown
  const newEnrichments = companies.filter(
    (c) => !c.enrichment_level || c.enrichment_level === ''
  ).length;
  const reEnrichments = totalCount - newEnrichments;

  // Estimates
  const estimatedApiCalls = totalCount * API_CALLS_PER_COMPANY;
  const estimatedSeconds = totalCount * SECONDS_PER_COMPANY;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  const handleConfirm = () => {
    onConfirm(companies);
  };

  const handleCancel = () => {
    onClose();
  };

  // Calculate progress percentages for breakdown bar
  const newPct = totalCount > 0 ? (newEnrichments / totalCount) * 100 : 0;
  const rePct = totalCount > 0 ? (reEnrichments / totalCount) * 100 : 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconBolt size={20} color={COLORS.ALGOLIA_NEBULA_BLUE} />
          <Text fw={600}>Bulk Enrichment</Text>
        </Group>
      }
      centered
      size="md"
    >
      <Stack gap="md">
        {/* Count summary */}
        <Box
          p="md"
          style={{
            background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE}10, ${COLORS.ALGOLIA_PURPLE}10)`,
            borderRadius: 'var(--mantine-radius-md)',
            border: `1px solid ${COLORS.ALGOLIA_NEBULA_BLUE}30`,
            textAlign: 'center',
          }}
          data-testid="companies-count-section"
        >
          <Text size="xl" fw={700} c={COLORS.ALGOLIA_NEBULA_BLUE} data-testid="companies-count">
            {totalCount}
          </Text>
          <Text size="sm" c={COLORS.GRAY_600}>
            companies selected for enrichment
          </Text>
        </Box>

        {/* Breakdown: new vs re-enrich */}
        <Box>
          <Text size="sm" fw={600} c={COLORS.GRAY_700} mb="xs">
            Enrichment Breakdown
          </Text>
          <Progress.Root size="lg" mb="xs">
            <Progress.Section value={newPct} color="green">
              <Progress.Label>{newEnrichments}</Progress.Label>
            </Progress.Section>
            <Progress.Section value={rePct} color="blue">
              <Progress.Label>{reEnrichments}</Progress.Label>
            </Progress.Section>
          </Progress.Root>
          <Group justify="space-between">
            <Group gap="xs">
              <IconSparkles size={14} color="green" />
              <Text size="xs" c={COLORS.GRAY_600}>
                <Text span fw={600}>{newEnrichments}</Text> new enrichments
              </Text>
            </Group>
            <Group gap="xs">
              <IconRefresh size={14} color="blue" />
              <Text size="xs" c={COLORS.GRAY_600}>
                <Text span fw={600}>{reEnrichments}</Text> re-enrichments
              </Text>
            </Group>
          </Group>
        </Box>

        {/* Estimates grid */}
        <SimpleGrid cols={2} spacing="sm">
          <Box
            p="sm"
            style={{
              background: COLORS.GRAY_50,
              borderRadius: 'var(--mantine-radius-md)',
              border: `1px solid ${COLORS.GRAY_200}`,
            }}
          >
            <Group gap="xs" mb={4}>
              <IconClock size={16} color={COLORS.GRAY_500} />
              <Text size="xs" c={COLORS.GRAY_500} fw={500}>
                Estimated Time
              </Text>
            </Group>
            <Text size="lg" fw={600} c={COLORS.ALGOLIA_SPACE_GRAY}>
              ~{estimatedMinutes} min
            </Text>
          </Box>
          <Box
            p="sm"
            style={{
              background: COLORS.GRAY_50,
              borderRadius: 'var(--mantine-radius-md)',
              border: `1px solid ${COLORS.GRAY_200}`,
            }}
          >
            <Group gap="xs" mb={4}>
              <IconApi size={16} color={COLORS.GRAY_500} />
              <Text size="xs" c={COLORS.GRAY_500} fw={500}>
                API Calls
              </Text>
            </Group>
            <Text size="lg" fw={600} c={COLORS.ALGOLIA_SPACE_GRAY}>
              ~{estimatedApiCalls}
            </Text>
          </Box>
        </SimpleGrid>

        {/* Warning message */}
        <Group
          gap="xs"
          p="sm"
          style={{
            background: 'rgba(251, 191, 36, 0.1)',
            borderRadius: 'var(--mantine-radius-md)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
          }}
        >
          <IconAlertTriangle size={18} color="#f59e0b" />
          <Text size="sm" c={COLORS.GRAY_700}>
            This will use <Badge size="sm" color="orange" variant="light">API credits</Badge> from
            SimilarWeb and BuiltWith for each company.
          </Text>
        </Group>

        {/* Action buttons */}
        <Group justify="flex-end" gap="sm" mt="md">
          <Button
            variant="subtle"
            color="gray"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="gradient"
            gradient={{ from: COLORS.ALGOLIA_NEBULA_BLUE, to: COLORS.ALGOLIA_PURPLE }}
            leftSection={<IconBolt size={16} />}
            onClick={handleConfirm}
            loading={loading}
            disabled={totalCount === 0 || loading}
          >
            {loading ? 'Enriching...' : 'Enrich All'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
