/**
 * CreateAuditPage - Simple form to create a new search audit
 *
 * Features:
 * - Domain input (required)
 * - Company name input (optional)
 * - WebSocket connection status indicator
 * - Submit button that POSTs to /api/enrich
 * - Redirects to AuditProgressPage on success
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  Button,
  Stack,
  Group,
  Alert,
  Badge,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconRocket,
  IconWifi,
  IconWifiOff,
} from '@tabler/icons-react';

export function CreateAuditPage() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(true); // TODO: Connect to actual WebSocket

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!domain) {
      setError('Domain is required');
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      setError('Please enter a valid domain (e.g., example.com)');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          companyName: companyName || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create audit');
      }

      const data = await response.json();

      // Redirect to progress page
      navigate(`/search-audit/${data.auditId}/progress`);
    } catch (err: any) {
      setError(err.message || 'Failed to create audit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <div>
          <Group justify="space-between" mb="xs">
            <Title
              order={1}
              style={{
                background: 'linear-gradient(135deg, #21243D 0%, #003DFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: '36px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              Create Search Audit
            </Title>
            <Badge
              color={wsConnected ? 'green' : 'red'}
              variant="light"
              leftSection={wsConnected ? <IconWifi size={14} /> : <IconWifiOff size={14} />}
            >
              {wsConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </Group>
          <Text c="dimmed" size="lg">
            Run a comprehensive search audit on any e-commerce website. Our AI-powered system will
            analyze search functionality, identify gaps, and provide actionable recommendations.
          </Text>
        </div>

        {/* Form */}
        <Paper
          shadow="lg"
          p="xl"
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(0, 61, 255, 0.1)',
          }}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              {/* Domain Input */}
              <TextInput
                label="Domain"
                placeholder="example.com"
                description="Enter the company's domain (without http:// or www)"
                value={domain}
                onChange={(e) => setDomain(e.currentTarget.value.trim())}
                required
                size="md"
                disabled={loading}
                styles={{
                  label: {
                    fontWeight: 600,
                    marginBottom: 8,
                  },
                }}
              />

              {/* Company Name Input (Optional) */}
              <TextInput
                label="Company Name (Optional)"
                placeholder="Acme Corporation"
                description="If not provided, we'll use the domain as the company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.currentTarget.value)}
                size="md"
                disabled={loading}
                styles={{
                  label: {
                    fontWeight: 600,
                    marginBottom: 8,
                  },
                }}
              />

              {/* Error Alert */}
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                  {error}
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                loading={loading}
                leftSection={<IconRocket size={20} />}
                fullWidth
                styles={{
                  root: {
                    background: 'linear-gradient(135deg, #003DFF 0%, #5468FF 100%)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '16px',
                    height: '52px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(0, 61, 255, 0.3)',
                    },
                  },
                }}
              >
                {loading ? 'Creating Audit...' : 'Start Search Audit'}
              </Button>

              {/* Info Text */}
              <Text size="sm" c="dimmed" ta="center">
                Estimated time: 15-25 minutes
                <br />
                You'll be able to track real-time progress in the next step
              </Text>
            </Stack>
          </form>
        </Paper>

        {/* What's Included */}
        <Paper
          p="lg"
          radius="md"
          style={{
            background: 'rgba(239, 246, 255, 0.6)',
            border: '1px solid rgba(0, 61, 255, 0.1)',
          }}
        >
          <Title order={4} mb="sm" c="#003DFF">
            What's Included in the Audit:
          </Title>
          <Stack gap="xs">
            <Text size="sm">
              ✓ <strong>20+ browser-based search tests</strong> (homepage, mobile, NLP, facets)
            </Text>
            <Text size="sm">
              ✓ <strong>10-dimension scoring</strong> (search UX, facets, mobile, personalization)
            </Text>
            <Text size="sm">
              ✓ <strong>Competitor analysis</strong> (identify search providers used by competitors)
            </Text>
            <Text size="sm">
              ✓ <strong>Strategic insights</strong> (traffic data, hiring signals, financials)
            </Text>
            <Text size="sm">
              ✓ <strong>Executive summary + deliverables</strong> (PDF report, landing page, deck)
            </Text>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
