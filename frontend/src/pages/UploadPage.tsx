/**
 * UploadPage - Simple Upload Interface
 *
 * Clean, simple upload page. Drop a file, click upload, done.
 */

import { useCallback } from 'react';
import { Container, Title, Text, Paper, Button, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { CSVUploader } from '@/components/upload/CSVUploader';
import type { UploadResponse } from '@/types';

export function UploadPage() {
  const navigate = useNavigate();

  // Handle successful upload - navigate to companies page
  const handleUploadComplete = useCallback(
    (listId: string, response: UploadResponse) => {
      notifications.show({
        title: 'Upload Complete',
        message: `${response.total_rows} companies imported. Redirecting to Companies page...`,
        color: 'green',
      });

      // Navigate to companies page after short delay
      setTimeout(() => {
        navigate('/companies');
      }, 1500);
    },
    [navigate]
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px' }}>
      <Container size="md">
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <div>
            <Title order={2}>Upload Companies</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Import a CSV or Excel file with company domains
            </Text>
          </div>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Group>

        {/* Upload Area */}
        <Paper p="xl" radius="md" withBorder>
          <CSVUploader onUploadComplete={handleUploadComplete} />
        </Paper>

        {/* Help Text */}
        <Text size="sm" c="dimmed" mt="lg" ta="center">
          Your file should have a column named "domain", "website", or "url".
          <br />
          Company names and other data will be auto-detected if present.
        </Text>
      </Container>
    </div>
  );
}
