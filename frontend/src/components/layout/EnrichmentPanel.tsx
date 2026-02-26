/**
 * Enrichment Panel Component
 *
 * Shows enrichment depth breakdown and provides on-demand enrichment controls.
 */

import {
  Box,
  Text,
  Progress,
  Group,
  Stack,
  Button,
  Tooltip,
  Badge,
  Collapse,
  Divider,
  Notification,
} from '@mantine/core';
import {
  IconBolt,
  IconDatabase,
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconX,
  IconLoader,
} from '@tabler/icons-react';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStats } from '@/services/api';
import { enrichBatch, EnrichmentProgress } from '@/services/enrichment';
import { COLORS } from '@/lib/constants';

interface EnrichmentNotification {
  id: string;
  domain: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
}

export function EnrichmentPanel() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [notifications, setNotifications] = useState<EnrichmentNotification[]>([]);

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const depth = stats?.enrichment_depth;
  const total = stats?.total_companies || 0;

  // Calculate percentages
  const deepPct = depth && total ? Math.round((depth.deep / total) * 100) : 0;
  const standardPct = depth && total ? Math.round((depth.standard / total) * 100) : 0;
  const basicPct = depth && total ? Math.round((depth.basic / total) * 100) : 0;
  const unenrichedPct = depth && total ? Math.round((depth.unenriched / total) * 100) : 0;

  // Overall enrichment progress (any enrichment = not unenriched)
  const enrichedPct = 100 - unenrichedPct;

  // Handle enrichment progress updates
  const handleProgress = useCallback((domain: string, progress: EnrichmentProgress) => {
    setNotifications(prev => {
      const existing = prev.find(n => n.domain === domain);
      const newNotif: EnrichmentNotification = {
        id: domain,
        domain,
        status: progress.status === 'complete' ? 'success' :
                progress.status === 'error' ? 'error' : 'running',
        message: progress.message,
      };

      if (existing) {
        return prev.map(n => n.domain === domain ? newNotif : n);
      }
      return [...prev.slice(-4), newNotif]; // Keep last 5
    });
  }, []);

  // Start batch enrichment of unenriched hot leads
  const handleEnrichHotLeads = async () => {
    if (isEnriching) return;

    setIsEnriching(true);
    setNotifications([]);

    try {
      // Fetch hot leads that need enrichment (top 10)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/displacement_targets?` +
        `select=domain&icp_score=gte.80&sw_monthly_visits=is.null&limit=10`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch unenriched leads');
      }

      const leads = await response.json() as Array<{ domain: string }>;

      if (leads.length === 0) {
        setNotifications([{
          id: 'none',
          domain: 'all',
          status: 'success',
          message: 'All hot leads are already enriched!',
        }]);
        setIsEnriching(false);
        return;
      }

      // Run batch enrichment
      const domains = leads.map(l => l.domain);
      await enrichBatch(domains, handleProgress);

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });

    } catch (error) {
      setNotifications(prev => [...prev, {
        id: 'error',
        domain: 'batch',
        status: 'error',
        message: error instanceof Error ? error.message : 'Enrichment failed',
      }]);
    } finally {
      setIsEnriching(false);
    }
  };

  // Start batch enrichment of any unenriched companies
  const handleEnrichNext = async (count: number) => {
    if (isEnriching) return;

    setIsEnriching(true);
    setNotifications([]);

    try {
      // Fetch unenriched companies (no traffic data)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/displacement_targets?` +
        `select=domain&sw_monthly_visits=is.null&order=icp_score.desc.nullslast&limit=${count}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }

      const companies = await response.json() as Array<{ domain: string }>;

      if (companies.length === 0) {
        setNotifications([{
          id: 'none',
          domain: 'all',
          status: 'success',
          message: 'All companies are enriched!',
        }]);
        setIsEnriching(false);
        return;
      }

      // Run batch enrichment
      const domains = companies.map(c => c.domain);
      await enrichBatch(domains, handleProgress);

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });

    } catch (error) {
      setNotifications(prev => [...prev, {
        id: 'error',
        domain: 'batch',
        status: 'error',
        message: error instanceof Error ? error.message : 'Enrichment failed',
      }]);
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <Box
      p="md"
      style={{
        background: 'linear-gradient(135deg, rgba(0, 61, 255, 0.1), rgba(84, 104, 255, 0.05))',
        borderRadius: 'var(--mantine-radius-md)',
        border: '1px solid rgba(0, 61, 255, 0.2)',
      }}
    >
      {/* Header with expand toggle */}
      <Group
        justify="space-between"
        mb="xs"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <Group gap="xs">
          <IconDatabase size={16} color={COLORS.ALGOLIA_NEBULA_BLUE} />
          <Text size="xs" fw={600} c="#334155">Enrichment Status</Text>
        </Group>
        <Group gap="xs">
          <Text size="xs" fw={500} c="#64748b">{enrichedPct}%</Text>
          {expanded ? (
            <IconChevronUp size={14} color="#64748b" />
          ) : (
            <IconChevronDown size={14} color="#64748b" />
          )}
        </Group>
      </Group>

      {/* Main progress bar */}
      <Progress.Root size="sm" mb="xs">
        <Tooltip label={`Deep: ${depth?.deep || 0} companies`}>
          <Progress.Section value={deepPct} color="indigo" />
        </Tooltip>
        <Tooltip label={`Standard: ${depth?.standard || 0} companies`}>
          <Progress.Section value={standardPct} color="blue" />
        </Tooltip>
        <Tooltip label={`Basic: ${depth?.basic || 0} companies`}>
          <Progress.Section value={basicPct} color="cyan" />
        </Tooltip>
        <Tooltip label={`Unenriched: ${depth?.unenriched || 0} companies`}>
          <Progress.Section value={unenrichedPct} color="gray" />
        </Tooltip>
      </Progress.Root>

      <Text size="xs" c="#64748b">
        {stats?.enriched_companies || 0} of {total} enriched
      </Text>

      {/* Expanded view with depth breakdown */}
      <Collapse in={expanded}>
        <Divider my="sm" />

        {/* Depth breakdown */}
        <Stack gap="xs" mb="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Box w={8} h={8} bg="indigo" style={{ borderRadius: 2 }} />
              <Text size="xs" c="#334155">Deep</Text>
              <Tooltip label="Has financials, tech stack, or competitors" position="right">
                <Badge size="xs" variant="light" color="gray">?</Badge>
              </Tooltip>
            </Group>
            <Text size="xs" fw={500} c="#334155">{depth?.deep || 0}</Text>
          </Group>

          <Group justify="space-between">
            <Group gap="xs">
              <Box w={8} h={8} bg="blue" style={{ borderRadius: 2 }} />
              <Text size="xs" c="#334155">Standard</Text>
              <Tooltip label="Has traffic data from SimilarWeb" position="right">
                <Badge size="xs" variant="light" color="gray">?</Badge>
              </Tooltip>
            </Group>
            <Text size="xs" fw={500} c="#334155">{depth?.standard || 0}</Text>
          </Group>

          <Group justify="space-between">
            <Group gap="xs">
              <Box w={8} h={8} bg="cyan" style={{ borderRadius: 2 }} />
              <Text size="xs" c="#334155">Basic</Text>
              <Tooltip label="Has ICP score only" position="right">
                <Badge size="xs" variant="light" color="gray">?</Badge>
              </Tooltip>
            </Group>
            <Text size="xs" fw={500} c="#334155">{depth?.basic || 0}</Text>
          </Group>

          <Group justify="space-between">
            <Group gap="xs">
              <Box w={8} h={8} bg="gray" style={{ borderRadius: 2 }} />
              <Text size="xs" c="#334155">Unenriched</Text>
            </Group>
            <Text size="xs" fw={500} c="#334155">{depth?.unenriched || 0}</Text>
          </Group>
        </Stack>

        <Divider my="sm" />

        {/* On-demand enrichment buttons */}
        <Stack gap="xs">
          <Text size="xs" fw={600} c="#334155" mb={4}>Enrich On Demand</Text>

          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconBolt size={14} />}
              loading={isEnriching}
              onClick={handleEnrichHotLeads}
              disabled={isEnriching}
            >
              Hot Leads
            </Button>
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconBolt size={14} />}
              loading={isEnriching}
              onClick={() => handleEnrichNext(10)}
              disabled={isEnriching}
            >
              Next 10
            </Button>
            <Button
              size="xs"
              variant="light"
              color="gray"
              leftSection={<IconBolt size={14} />}
              loading={isEnriching}
              onClick={() => handleEnrichNext(50)}
              disabled={isEnriching}
            >
              Next 50
            </Button>
          </Group>
        </Stack>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Stack gap="xs" mt="sm">
            {notifications.slice(-3).map((notif) => (
              <Notification
                key={notif.id}
                icon={
                  notif.status === 'success' ? <IconCheck size={14} /> :
                  notif.status === 'error' ? <IconX size={14} /> :
                  <IconLoader size={14} className="animate-spin" />
                }
                color={
                  notif.status === 'success' ? 'green' :
                  notif.status === 'error' ? 'red' : 'blue'
                }
                title={notif.domain}
                withCloseButton={false}
                style={{ padding: '8px 12px' }}
              >
                <Text size="xs">{notif.message}</Text>
              </Notification>
            ))}
          </Stack>
        )}
      </Collapse>
    </Box>
  );
}
