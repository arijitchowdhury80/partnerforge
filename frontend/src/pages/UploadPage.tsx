/**
 * UploadPage - Dead Simple Upload
 */

import { useState, useRef } from 'react';
import { Container, Title, Text, Paper, Button, Group, Select, TextInput, Progress, Alert } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconUpload, IconArrowLeft, IconCheck, IconX } from '@tabler/icons-react';
import { GalaxyBackground } from '@/components/common/GalaxyBackground';
import { uploadFile } from '@/services/uploadService';

export function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [listName, setListName] = useState('');
  const [partnerTech, setPartnerTech] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setListName(selected.name.replace(/\.(csv|xlsx|xls)$/i, ''));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await uploadFile(file, {
        partnerTech,
        listName: listName || file.name,
        source: 'manual',
        onProgress: (p) => {
          const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
          setProgress(pct);
        },
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => navigate('/companies'), 1500);
      } else {
        setError(result.errors[0]?.message || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <GalaxyBackground>
      <Container size="sm" py="lg">
        <Group justify="space-between" mb="xl">
          <Title order={2} c="white">Upload Companies</Title>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Group>

        <Paper p="xl" radius="md" className="galaxy-glass-panel">
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
          />

          {/* Step 1: Select File */}
          <Group mb="md">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isUploading}
            >
              Browse...
            </Button>
            <Text c="dimmed">{file ? file.name : 'No file selected'}</Text>
          </Group>

          {/* Step 2: Options (only show after file selected) */}
          {file && (
            <>
              <TextInput
                label="List Name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                mb="md"
              />
              <Select
                label="Partner Technology"
                placeholder="Select partner"
                value={partnerTech}
                onChange={(v) => setPartnerTech(v || '')}
                data={[
                  { value: '', label: '(None)' },
                  { value: 'Lucidworks', label: 'Lucidworks' },
                  { value: 'Adobe Experience Manager', label: 'Adobe AEM' },
                  { value: 'Amplience', label: 'Amplience' },
                  { value: 'Spryker', label: 'Spryker' },
                ]}
                mb="md"
              />

              {/* Progress */}
              {isUploading && (
                <Progress value={progress} mb="md" animated />
              )}

              {/* Error */}
              {error && (
                <Alert color="red" icon={<IconX size={16} />} mb="md">
                  {error}
                </Alert>
              )}

              {/* Success */}
              {success && (
                <Alert color="green" icon={<IconCheck size={16} />} mb="md">
                  Upload complete! Redirecting...
                </Alert>
              )}

              {/* Upload Button */}
              <Button
                onClick={handleUpload}
                loading={isUploading}
                disabled={success}
                leftSection={<IconUpload size={16} />}
                fullWidth
              >
                Upload
              </Button>
            </>
          )}
        </Paper>
      </Container>
    </GalaxyBackground>
  );
}
