/**
 * EnrichConfirmModal Component
 *
 * Confirms before enriching a company, showing API credits warning.
 * Includes "Don't ask again" preference option.
 */

import { useState } from 'react';
import {
  Modal,
  Text,
  Button,
  Group,
  Stack,
  Checkbox,
  Badge,
  Box,
} from '@mantine/core';
import { IconAlertTriangle, IconBolt, IconCoins } from '@tabler/icons-react';
import { COLORS } from '@/lib/constants';

export interface EnrichConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (domain: string, skipFutureConfirm?: boolean) => void;
  companyName: string;
  domain: string;
  loading?: boolean;
}

export function EnrichConfirmModal({
  opened,
  onClose,
  onConfirm,
  companyName,
  domain,
  loading = false,
}: EnrichConfirmModalProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleConfirm = () => {
    if (dontAskAgain) {
      onConfirm(domain, true);
    } else {
      onConfirm(domain);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconBolt size={20} color={COLORS.ALGOLIA_NEBULA_BLUE} />
          <Text fw={600}>Enrich Company</Text>
        </Group>
      }
      centered
      size="sm"
    >
      <Stack gap="md">
        {/* Company info */}
        <Box
          p="md"
          style={{
            background: COLORS.GRAY_50,
            borderRadius: 'var(--mantine-radius-md)',
            border: `1px solid ${COLORS.GRAY_200}`,
          }}
        >
          <Text fw={600} size="lg" c={COLORS.ALGOLIA_SPACE_GRAY}>
            {companyName}
          </Text>
          <Text size="sm" c={COLORS.GRAY_500}>
            {domain}
          </Text>
        </Box>

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
            SimilarWeb and BuiltWith.
          </Text>
        </Group>

        {/* Don't ask again checkbox */}
        <Checkbox
          label="Don't ask again for this session"
          checked={dontAskAgain}
          onChange={(event) => setDontAskAgain(event.currentTarget.checked)}
          size="sm"
          aria-label="Don't ask again"
        />

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
          >
            {loading ? 'Enriching...' : 'Enrich'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
