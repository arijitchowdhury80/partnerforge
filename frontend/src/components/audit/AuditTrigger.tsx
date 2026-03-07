/**
 * AuditTrigger - Create New Audit
 *
 * Form component for creating a new search audit or partner intelligence audit.
 * Validates domain and submits to API, then navigates to audit progress page.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Stack,
  TextInput,
  Radio,
  Group,
  Button,
  Text,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconRocket,
  IconSearch,
  IconBuilding,
} from '@tabler/icons-react';
import axios from 'axios';

interface AuditTriggerProps {
  defaultType?: 'partner-intel' | 'search-audit';
  onSuccess?: (auditId: string) => void;
}

interface CreateAuditResponse {
  audit_id: string;
  company_id: string;
  company_domain: string;
  status: string;
  websocket_url: string;
  created_at: string;
}

export function AuditTrigger({ defaultType = 'search-audit', onSuccess }: AuditTriggerProps) {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [auditType, setAuditType] = useState<'partner-intel' | 'search-audit'>(defaultType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateDomain = (value: string): string | null => {
    if (!value || value.trim().length === 0) {
      return 'Domain is required';
    }

    // Basic domain validation regex
    const domainRegex = /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/.*)?$/;
    if (!domainRegex.test(value)) {
      return 'Invalid domain format (e.g., example.com or https://www.example.com)';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate domain
    const validationError = validateDomain(domain);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Call API to create audit
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.post<CreateAuditResponse>(
        `${API_BASE_URL}/api/audits`,
        {
          company_domain: domain.trim(),
          audit_type: auditType,
        }
      );

      const { audit_id } = response.data;

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(audit_id);
      }

      // Navigate to audit progress page
      navigate(`/audits/${audit_id}`);
    } catch (err: any) {
      console.error('Failed to create audit:', err);

      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Failed to create audit. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper p="xl" shadow="sm" radius="md" pos="relative">
      <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Header */}
          <div>
            <Text size="xl" fw={600} mb={4}>
              Create New Audit
            </Text>
            <Text size="sm" c="dimmed">
              Enter a company domain to start an audit
            </Text>
          </div>

          {/* Domain Input */}
          <TextInput
            label="Company Domain"
            placeholder="example.com or https://www.example.com"
            value={domain}
            onChange={(e) => setDomain(e.currentTarget.value)}
            leftSection={<IconBuilding size={16} />}
            required
            error={error && error.includes('domain') ? error : null}
            description="Enter the company's website domain"
          />

          {/* Audit Type */}
          <Radio.Group
            label="Audit Type"
            value={auditType}
            onChange={(value) => setAuditType(value as 'partner-intel' | 'search-audit')}
            required
          >
            <Stack gap="sm" mt="xs">
              <Radio
                value="search-audit"
                label="Search Audit"
                description="Comprehensive search experience analysis with browser testing, screenshots, and scoring"
                icon={IconSearch}
              />
              <Radio
                value="partner-intel"
                label="Partner Intelligence"
                description="Identify displacement opportunities based on partner technology stack"
                icon={IconBuilding}
              />
            </Stack>
          </Radio.Group>

          {/* Error Alert */}
          {error && !error.includes('domain') && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Error"
              color="red"
              variant="light"
            >
              {error}
            </Alert>
          )}

          {/* Submit Button */}
          <Group justify="flex-end" mt="md">
            <Button
              type="submit"
              leftSection={<IconRocket size={16} />}
              loading={loading}
              size="md"
            >
              Start Audit
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
