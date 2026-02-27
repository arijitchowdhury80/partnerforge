/**
 * DeleteConfirmModal Component
 *
 * Confirms before deleting with type-to-confirm safety mechanism.
 * User must type "DELETE" to enable the delete button.
 */

import { useState } from 'react';
import {
  Modal,
  Text,
  Button,
  Group,
  Stack,
  TextInput,
  Box,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertTriangle, IconTrash } from '@tabler/icons-react';
import { COLORS } from '@/lib/constants';

export interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onDelete: () => void;
  itemName: string;
  itemType: 'company' | 'list' | 'item';
  loading?: boolean;
}

export function DeleteConfirmModal({
  opened,
  onClose,
  onDelete,
  itemName,
  itemType,
  loading = false,
}: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');

  const isDeleteEnabled = confirmText.toUpperCase() === 'DELETE';

  const handleDelete = () => {
    if (isDeleteEnabled) {
      onDelete();
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onClose();
  };

  // Reset state when modal closes
  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconTrash size={20} color="#dc2626" />
          <Text fw={600} c="#dc2626">Delete {itemType}</Text>
        </Group>
      }
      centered
      size="sm"
    >
      <Stack gap="md">
        {/* Warning icon and message */}
        <Box
          p="md"
          style={{
            background: 'rgba(220, 38, 38, 0.05)',
            borderRadius: 'var(--mantine-radius-md)',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            textAlign: 'center',
          }}
        >
          <ThemeIcon
            size={48}
            radius="xl"
            color="red"
            variant="light"
            mb="sm"
            style={{ margin: '0 auto' }}
            data-testid="delete-warning-icon"
          >
            <IconAlertTriangle size={28} />
          </ThemeIcon>
          <Text fw={600} size="lg" c={COLORS.ALGOLIA_SPACE_GRAY}>
            {itemName}
          </Text>
          <Text size="sm" c={COLORS.GRAY_600} mt="xs">
            This action cannot be undone. All associated data will be permanently deleted.
          </Text>
        </Box>

        {/* Type to confirm */}
        <Box>
          <Text size="sm" c={COLORS.GRAY_700} mb="xs">
            Type <Text span fw={700} c="#dc2626">DELETE</Text> to confirm:
          </Text>
          <TextInput
            placeholder="Type DELETE to confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.currentTarget.value)}
            styles={{
              input: {
                borderColor: confirmText && !isDeleteEnabled ? '#dc2626' : undefined,
              },
            }}
          />
        </Box>

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
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleDelete}
            disabled={!isDeleteEnabled || loading}
            loading={loading}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
